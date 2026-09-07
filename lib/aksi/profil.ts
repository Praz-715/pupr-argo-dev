'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { hitungUlangSatuPegawai } from '../skoring-satu'

import { ambilPengaturan, parameterSkoringDari } from '../pengaturan'
import { jalankanMutasi } from '../audit'
import { getCurrentUser } from '../auth'
import { KATEGORI_CATATAN, MAKS_KETERANGAN_CATATAN } from '../catatan-pegawai'
import { eksekusi, kueri, kueriSatu } from '../db'
import { normalisasiAsesmen, normalisasiTanggal } from '../importer/normalisasi-baris'
import { gerbangPeran } from './gerbang'
import { jabatanTerjangkau, pegawaiTerjangkau } from './lingkup-data'
import { berhasil, gagal, galatDariZod, pesanDariGalatDb, type HasilAksi } from './hasil'

/**
 * Pengisian & perbaikan data profil pegawai secara manual.
 *
 * **Kenapa ada.** Sebagian besar profil dev berisi kolom kosong — riwayat
 * pendidikan tanpa tahun lulus, riwayat jabatan tanpa nomor SK, pegawai tanpa
 * asesmen — dan sampai sekarang satu-satunya cara mengisinya adalah lewat SQL.
 * Akibatnya bukan sekadar tidak praktis: Antrian Pembersihan Data mendaftar 27
 * temuan yang **tidak punya satu pun tombol untuk dibereskan**, jadi halaman itu
 * hanya bisa menuduh, tidak bisa menyelesaikan.
 *
 * **Enam permukaan tulis, satu berkas.** `pegawai` (identitas & pendidikan
 * terakhir) · `riwayat_pendidikan` · `riwayat_jabatan` · `pegawai.riwayat_diklat`
 * (JSON) · `kinerja_periode` · `asesmen_talenta`. Hukuman disiplin **tidak** ikut
 * — ia sudah punya CRUD sendiri di [`hukuman-disiplin.ts`](hukuman-disiplin.ts)
 * dengan aturan yang lebih ketat (dua peran saja, tanpa penghapusan, keterangan
 * tidak masuk audit). Menyalinnya ke sini berarti dua pintu tulis dengan dua
 * aturan berbeda ke tabel yang sama.
 *
 * **Tambah & ubah saja — tidak ada penghapusan.** Itu yang diminta, dan itu juga
 * yang benar: baris riwayat adalah dasar perhitungan skor yang sudah tersimpan,
 * jadi menghilangkannya membuat skor lama tidak bisa dipertanggungjawabkan. Pola
 * yang sama dengan `nonaktifkanHukuman()`.
 *
 * **Tiga aturan yang tidak boleh dilonggarkan:**
 *
 * 1. **Rumus tidak ditulis ulang di sini.** Asesmen manual melewati
 *    `normalisasiAsesmen()` — sama dengan jalur importer dan jalur eNom — jadi
 *    Kotak 9, `nilai_talenta`, clamp 0–100, skala integritas 1–4→100, dan status
 *    masa berlaku semuanya datang dari satu implementasi. Mengetikkan `kotak_9`
 *    langsung dari formulir akan membuat profil ini satu-satunya tempat di
 *    aplikasi yang boleh tidak setuju dengan `lib/scoring`.
 * 2. **Pegawai di luar lingkup unit dijawab "tidak ditemukan"**, bukan "akses
 *    ditolak" — pola yang sama dengan `ambilProfil()` dan `/talenta/{nip}`.
 *    Pesan yang membedakan keduanya membuat id pegawai bisa dipakai menebak
 *    keberadaan orang.
 * 3. **NIP TIDAK bisa diubah dari sini, dan itu bukan kelalaian.** NIP adalah
 *    identitas barisnya (UNIQUE), alamat halamannya (`/talenta/{nip}`), dan
 *    **satu-satunya sumber** tanggal lahir, usia, jenis kelamin, TMT CPNS, masa
 *    kerja, BUP, dan tanggal pensiun — semuanya diturunkan `lib/nip.ts`, tidak
 *    ada kolomnya di DB. Satu digit salah ketik akan menggeser proyeksi pensiun
 *    seseorang tanpa satu pun pesan galat. NIP yang benar-benar salah diperbaiki
 *    lewat Antrian Pembersihan Data, di mana ia terlihat sebagai temuan.
 */

const PERAN_PROFIL = ['Super Admin', 'Admin Talenta', 'Pengelola Unit'] as const

const JENJANG = ['SLTA', 'D3', 'S1_D4', 'S2', 'S3'] as const
const STATUS_AKTIF = ['AKTIF', 'PENSIUN', 'MUTASI_KELUAR', 'NONAKTIF'] as const
const PREDIKAT = ['Sangat Baik', 'Baik', 'Butuh Perbaikan', 'Kurang', 'Sangat Kurang'] as const
const PERIODE = ['TW1', 'TW2', 'TW3', 'TAHUNAN'] as const
const PENUGASAN = ['DEFINITIF', 'PLT', 'PLH'] as const
const STATUS_ASESMEN = ['Berlaku', 'Expired', 'Draft'] as const

/** `''` dari `<input>` yang dikosongkan berarti NULL, bukan string kosong. */
const teksOpsional = (maks: number, label: string) =>
  z
    .string()
    .trim()
    .max(maks, `${label} maksimal ${maks} karakter`)
    .transform((v) => (v === '' ? null : v))
    .nullable()

const tanggalOpsional = (label: string) =>
  z
    .string()
    .trim()
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), `${label} harus YYYY-MM-DD`)

/**
 * Tahun dibatasi 1950–(tahun ini + 1). Batas atasnya bukan kesopanan: kolomnya
 * bertipe MySQL `YEAR`, yang **menerima 2155 lalu menyimpannya apa adanya**, dan
 * tahun lulus 2155 membuat perhitungan masa kerja menghasilkan angka negatif di
 * tempat yang jauh dari sini.
 */
const tahunWajar = (label: string) =>
  z
    .number()
    .int()
    .min(1950, `${label} paling awal 1950`)
    .max(new Date().getFullYear() + 1, `${label} tidak boleh di masa depan`)

// ---------------------------------------------------------------------------
// Penjagaan lingkup
// ---------------------------------------------------------------------------

/** Halaman yang perlu disegarkan setiap kali data profil berubah. */
function segarkan(nip: string) {
  revalidatePath(`/talenta/${nip}`)
  revalidatePath('/talenta')
  // Kelengkapan & Antrian Pembersihan menghitung dari kolom yang sama, jadi
  // membiarkannya basi berarti temuan yang baru dibereskan tetap terdaftar —
  // dan orang akan membereskannya dua kali.
  revalidatePath('/data/kelengkapan')
  revalidatePath('/data/pembersihan')
}

/**
 * Hitung ulang skor SATU pegawai setelah datanya disunting dari profil.
 *
 * Permintaan pemilik proses 1 Sep 2026: *"pastiin di profil pegawai semua butir
 * revisi udah bisa sinkron ya termasuk saat ubah data manual di profil pegawai"*.
 *
 * ## Yang tidak sinkron, dan kenapa itu tidak pernah terlihat sebagai galat
 *
 * `match_score` & `match_score_detail` adalah kolom TERSIMPAN. Sampai berkas ini,
 * dari tujuh jalur tulis di halaman profil hanya `pilihAsesmenDipakai()` yang
 * menghitung ulang — enam lainnya (identitas, pendidikan, riwayat jabatan, diklat,
 * kinerja, asesmen) menyimpan datanya lalu berhenti. Akibatnya: seorang verifikator
 * membetulkan golongan dari III/c ke III/d, halaman profil langsung memajang
 * nilainya yang baru, dan panel Kecocokan di bawahnya **tetap menyatakan dia tidak
 * lolos syarat** — dua angka yang bertentangan di satu layar, tanpa satu pun tanda
 * bahwa yang kedua dihitung sebelum suntingan itu. Pesan "jalankan Hitung Ulang"
 * hanya menyuruh orang mengerjakan langkah kedua untuk menyelesaikan langkah
 * pertama; itu pekerjaan yang belum selesai, bukan keterangan.
 *
 * ## Satu pegawai, bukan seluruh populasi
 *
 * Menghitung ulang semua orang di dalam permintaan yang sedang ditunggu pengguna
 * memakan 1–5 detik × jumlah jabatan target. Yang berubah hanya data SATU orang,
 * dan `hitungUlangSatuPegawai()` (`lib/skoring-satu.ts`) sudah menutup jalur itu —
 * terukur 0,7–1,4 detik untuk seluruh jabatan target yang punya baris skornya.
 *
 * ## Kegagalannya TIDAK membatalkan mutasi
 *
 * Datanya sudah tersimpan dan itu yang diminta pengguna. Yang berubah cuma
 * kalimatnya, jadi permintaan menjalankan Hitung Ulang muncul **hanya** ketika
 * sinkronisasinya benar-benar gagal — bukan sebagai kalimat tetap yang selalu ada
 * dan karena itu berhenti dibaca. Pola yang sama dengan `ubahHukuman()`.
 */
async function sinkronkanSkor(pegawaiId: number): Promise<string> {
  try {
    const r = await hitungUlangSatuPegawai(pegawaiId)
    if (r.jumlahTarget === 0) return ''
    return ` Skor ${r.jumlahTarget} jabatan target ikut dihitung ulang.`
  } catch {
    return ' Skornya BELUM ikut berubah — jalankan Hitung Ulang di jabatan targetnya.'
  }
}

// ---------------------------------------------------------------------------
// Pembaca baris untuk jejak audit
// ---------------------------------------------------------------------------

/**
 * Satu pembaca per tabel, dipakai **oleh `sebelum` DAN `sesudah`**.
 *
 * Kalau keduanya menulis SELECT-nya sendiri, keduanya boleh memilih kolom yang
 * berbeda — dan diff audit lalu melaporkan "field ini ditambahkan" untuk kolom
 * yang sejak awal ada, cuma tidak ikut terbaca di sisi sebelum. `lib/diff-audit.ts`
 * tidak bisa membedakan itu dari perubahan sungguhan.
 */
function bacaPegawaiInti(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, nama_lengkap, golongan, pangkat, tmt_golongan, tmt_jabatan, jabatan_id,
            sekolah_terakhir, bidang_studi_terakhir, tingkat_pendidikan, status_aktif, sumber_sinkron
       FROM pegawai WHERE id = ?`,
    [id],
  )
}

function bacaPendidikan(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, pegawai_id, urutan, jenjang_pendidikan, bidang_studi, nama_sekolah,
            tahun_lulus, no_pertek_bkn
       FROM riwayat_pendidikan WHERE id = ?`,
    [id],
  )
}

function bacaRiwayatJabatan(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, pegawai_id, urutan, jabatan_nama_mentah, jabatan_id, jenis_penugasan,
            unit_kerja_mentah, tanggal_mulai, tanggal_akhir, no_sk
       FROM riwayat_jabatan WHERE id = ?`,
    [id],
  )
}

function bacaKinerja(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, pegawai_id, tahun, periode_skp, nilai_kinerja, nilai_perilaku, predikat, sumber_sync
       FROM kinerja_periode WHERE id = ?`,
    [id],
  )
}

function bacaAsesmen(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, pegawai_id, tahun_asesmen, jenis_asesmen, status_asesmen, nilai_kinerja_y,
            nilai_potensial_x, potkom, nilai_integritas, nilai_talenta, kotak_9,
            tahun_kinerja, rating_kinerja, sumber_sync
       FROM asesmen_talenta WHERE id = ?`,
    [id],
  )
}

// ---------------------------------------------------------------------------
// 1 · Identitas & pendidikan terakhir (tabel `pegawai`)
// ---------------------------------------------------------------------------

const SkemaIdentitas = z.object({
  pegawaiId: z.number().int().positive(),
  namaLengkap: z.string().trim().min(3, 'Nama minimal 3 karakter').max(150, 'Nama maksimal 150 karakter'),
  golongan: z.string().trim().min(1, 'Golongan wajib diisi').max(10, 'Golongan maksimal 10 karakter'),
  pangkat: z.string().trim().min(1, 'Pangkat wajib diisi').max(60, 'Pangkat maksimal 60 karakter'),
  tmtGolongan: tanggalOpsional('TMT golongan'),
  tmtJabatan: tanggalOpsional('TMT jabatan'),
  jabatanId: z.number().int().positive().nullable(),
  sekolahTerakhir: teksOpsional(200, 'Sekolah terakhir'),
  bidangStudiTerakhir: teksOpsional(200, 'Bidang studi terakhir'),
  tingkatPendidikan: z.enum(JENJANG),
  statusAktif: z.enum(STATUS_AKTIF),
})

export async function ubahIdentitas(masukan: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_PROFIL)
  if (tolak) return tolak

  const urai = SkemaIdentitas.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const pegawai = await pegawaiTerjangkau(d.pegawaiId)
  if (!pegawai) return gagal('Pegawai tidak ditemukan.')

  // Jabatan yang dipilih harus ada. Kolomnya `ON DELETE SET NULL`, jadi id yang
  // tidak ada tidak akan ditolak constraint — ia hanya gagal saat INSERT dengan
  // pesan yang tidak menyebut field mana yang salah.
  if (d.jabatanId !== null) {
    const ada = await kueriSatu<{ id: number }>(`SELECT id FROM jabatan WHERE id = ?`, [d.jabatanId])
    if (!ada) return gagal('Jabatan tidak ditemukan.', { jabatanId: 'Jabatan tidak ditemukan.' })
  }

  try {
    await jalankanMutasi({
      entitas: 'pegawai',
      aksi: 'UBAH',
      peranDiizinkan: PERAN_PROFIL,
      sebelum: () => bacaPegawaiInti(d.pegawaiId),
      jalankan: async () => {
        await eksekusi(
          `UPDATE pegawai
              SET nama_lengkap = ?, golongan = ?, pangkat = ?, tmt_golongan = ?, tmt_jabatan = ?,
                  jabatan_id = ?, sekolah_terakhir = ?, bidang_studi_terakhir = ?,
                  tingkat_pendidikan = ?, status_aktif = ?, sumber_sinkron = 'manual'
            WHERE id = ?`,
          [
            d.namaLengkap,
            d.golongan,
            d.pangkat,
            d.tmtGolongan,
            d.tmtJabatan,
            d.jabatanId,
            d.sekolahTerakhir,
            d.bidangStudiTerakhir,
            d.tingkatPendidikan,
            d.statusAktif,
            d.pegawaiId,
          ],
        )
        return { entitasId: d.pegawaiId, sesudah: await bacaPegawaiInti(d.pegawaiId) }
      },
    })

    segarkan(pegawai.nip)
    // Golongan, tingkat pendidikan, bidang studi, dan jabatan semuanya masukan
    // rubrik ATAU syarat kelayakan — menyimpannya tanpa menghitung ulang membuat
    // panel Kecocokan di halaman yang sama menyatakan hal yang sudah tidak benar.
    const sinkron = await sinkronkanSkor(d.pegawaiId)
    revalidatePath('/peta-talenta')
    revalidatePath('/')
    return berhasil(undefined, `Identitas ${d.namaLengkap} disimpan.${sinkron}`)
  } catch (e) {
    const pesan = pesanDariGalatDb(e, {})
    if (pesan) return gagal(pesan)
    throw e
  }
}

// ---------------------------------------------------------------------------
// 2 · Riwayat pendidikan
// ---------------------------------------------------------------------------

const SkemaPendidikan = z.object({
  /** `null` = baris baru. */
  id: z.number().int().positive().nullable(),
  pegawaiId: z.number().int().positive(),
  jenjangPendidikan: z.enum(JENJANG),
  bidangStudi: z.string().trim().min(2, 'Bidang studi wajib diisi').max(200, 'Bidang studi maksimal 200 karakter'),
  namaSekolah: teksOpsional(200, 'Nama sekolah'),
  tahunLulus: tahunWajar('Tahun lulus').nullable(),
  noPertekBkn: teksOpsional(80, 'No. pertek BKN'),
})

export async function simpanPendidikan(masukan: unknown): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_PROFIL)
  if (tolak) return tolak

  const urai = SkemaPendidikan.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const pegawai = await pegawaiTerjangkau(d.pegawaiId)
  if (!pegawai) return gagal('Pegawai tidak ditemukan.')

  // Baris yang diubah harus MILIK pegawai ini. Tanpa pemeriksaan ini, `id`
  // sembarang dari formulir bisa menyunting riwayat pegawai lain — termasuk
  // pegawai di luar lingkup unit, yang sudah dijaga di atas untuk pegawainya
  // tapi bukan untuk baris anaknya.
  if (d.id !== null) {
    const milik = await kueriSatu<{ id: number }>(
      `SELECT id FROM riwayat_pendidikan WHERE id = ? AND pegawai_id = ?`,
      [d.id, d.pegawaiId],
    )
    if (!milik) return gagal('Baris riwayat pendidikan tidak ditemukan.')
  }

  try {
    const hasil = await jalankanMutasi({
      entitas: 'riwayat_pendidikan',
      aksi: d.id === null ? 'BUAT' : 'UBAH',
      peranDiizinkan: PERAN_PROFIL,
      sebelum:
        d.id === null
          ? undefined
          : () => bacaPendidikan(d.id!),
      jalankan: async () => {
        if (d.id !== null) {
          await eksekusi(
            `UPDATE riwayat_pendidikan
                SET jenjang_pendidikan = ?, bidang_studi = ?, nama_sekolah = ?,
                    tahun_lulus = ?, no_pertek_bkn = ?
              WHERE id = ?`,
            [d.jenjangPendidikan, d.bidangStudi, d.namaSekolah, d.tahunLulus, d.noPertekBkn, d.id],
          )
          return { entitasId: d.id, sesudah: await bacaPendidikan(d.id) }
        }
        // `urutan` NOT NULL tanpa default — dihitung, bukan diminta dari
        // pengguna: nomor urut yang diisi tangan akan bertabrakan.
        const maks = await kueriSatu<{ n: number | null }>(
          `SELECT MAX(urutan) AS n FROM riwayat_pendidikan WHERE pegawai_id = ?`,
          [d.pegawaiId],
        )
        const { insertId } = await eksekusi(
          `INSERT INTO riwayat_pendidikan
             (pegawai_id, urutan, jenjang_pendidikan, bidang_studi, nama_sekolah,
              tahun_lulus, no_pertek_bkn)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            d.pegawaiId,
            Number(maks?.n ?? 0) + 1,
            d.jenjangPendidikan,
            d.bidangStudi,
            d.namaSekolah,
            d.tahunLulus,
            d.noPertekBkn,
          ],
        )
        return { entitasId: insertId, sesudah: await bacaPendidikan(insertId) }
      },
    })

    segarkan(pegawai.nip)
    const sinkron = await sinkronkanSkor(d.pegawaiId)
    revalidatePath('/peta-talenta')
    revalidatePath('/')
    return berhasil(
      { id: hasil.entitasId ?? 0 },
      `Riwayat pendidikan ${d.jenjangPendidikan.replace('_', '/')} ${d.bidangStudi} disimpan.${sinkron}`,
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, {})
    if (pesan) return gagal(pesan)
    throw e
  }
}

// ---------------------------------------------------------------------------
// 3 · Riwayat jabatan
// ---------------------------------------------------------------------------

const SkemaRiwayatJabatan = z
  .object({
    id: z.number().int().positive().nullable(),
    pegawaiId: z.number().int().positive(),
    jabatanNamaMentah: z
      .string()
      .trim()
      .min(3, 'Nama jabatan minimal 3 karakter')
      .max(500, 'Nama jabatan maksimal 500 karakter'),
    jabatanId: z.number().int().positive().nullable(),
    jenisPenugasan: z.enum(PENUGASAN).nullable(),
    unitKerjaMentah: teksOpsional(500, 'Unit kerja'),
    tanggalMulai: tanggalOpsional('Tanggal mulai'),
    tanggalAkhir: tanggalOpsional('Tanggal akhir'),
    /**
     * Lama menjabat dalam BULAN — jalan masuk untuk baris yang tanggalnya memang
     * tidak ada di sumbernya (229 baris dari berkas Talent Pool ES 2 & 3). Tanpa
     * bidang ini, durasi hanya bisa masuk lewat importir dan enam baris yang
     * importirnya lewati sengaja tidak punya cara diperbaiki dari aplikasi.
     *
     * Batas 1200 bulan (100 tahun) sama dengan `uraiMasaKerjaBulan()`: satu
     * definisi "angka ini tidak mungkin", bukan dua yang bisa berselisih.
     * Nol DIIZINKAN — "baru menjabat" adalah jawaban yang sah, dan `null` yang
     * berarti "tidak diketahui" tetap bisa dinyatakan dengan mengosongkannya.
     */
    lamaBulan: z
      .number()
      .int('Lama menjabat harus bilangan bulat bulan')
      .min(0, 'Lama menjabat tidak boleh negatif')
      .max(1200, 'Lama menjabat maksimal 1200 bulan')
      .nullable(),
    noSk: teksOpsional(80, 'Nomor SK'),
  })
  .refine((d) => d.tanggalMulai === null || d.tanggalAkhir === null || d.tanggalAkhir >= d.tanggalMulai, {
    message: 'Tanggal akhir tidak boleh lebih awal dari tanggal mulai',
    path: ['tanggalAkhir'],
  })

export async function simpanRiwayatJabatan(masukan: unknown): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_PROFIL)
  if (tolak) return tolak

  const urai = SkemaRiwayatJabatan.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const pegawai = await pegawaiTerjangkau(d.pegawaiId)
  if (!pegawai) return gagal('Pegawai tidak ditemukan.')

  if (d.id !== null) {
    const milik = await kueriSatu<{ id: number }>(
      `SELECT id FROM riwayat_jabatan WHERE id = ? AND pegawai_id = ?`,
      [d.id, d.pegawaiId],
    )
    if (!milik) return gagal('Baris riwayat jabatan tidak ditemukan.')
  }
  if (d.jabatanId !== null) {
    const ada = await kueriSatu<{ id: number }>(`SELECT id FROM jabatan WHERE id = ?`, [d.jabatanId])
    if (!ada) return gagal('Jabatan tidak ditemukan.', { jabatanId: 'Jabatan tidak ditemukan.' })
  }

  try {
    const hasil = await jalankanMutasi({
      entitas: 'riwayat_jabatan',
      aksi: d.id === null ? 'BUAT' : 'UBAH',
      peranDiizinkan: PERAN_PROFIL,
      sebelum:
        d.id === null
          ? undefined
          : () => bacaRiwayatJabatan(d.id!),
      jalankan: async () => {
        if (d.id !== null) {
          await eksekusi(
            `UPDATE riwayat_jabatan
                SET jabatan_nama_mentah = ?, jabatan_id = ?, jenis_penugasan = ?,
                    unit_kerja_mentah = ?, tanggal_mulai = ?, tanggal_akhir = ?,
                    lama_bulan = ?, no_sk = ?
              WHERE id = ?`,
            [
              d.jabatanNamaMentah,
              d.jabatanId,
              d.jenisPenugasan,
              d.unitKerjaMentah,
              d.tanggalMulai,
              d.tanggalAkhir,
              d.lamaBulan,
              d.noSk,
              d.id,
            ],
          )
          return { entitasId: d.id, sesudah: await bacaRiwayatJabatan(d.id) }
        }
        const maks = await kueriSatu<{ n: number | null }>(
          `SELECT MAX(urutan) AS n FROM riwayat_jabatan WHERE pegawai_id = ?`,
          [d.pegawaiId],
        )
        const { insertId } = await eksekusi(
          `INSERT INTO riwayat_jabatan
             (pegawai_id, urutan, jabatan_nama_mentah, jabatan_id, jenis_penugasan,
              unit_kerja_mentah, tanggal_mulai, tanggal_akhir, lama_bulan, no_sk)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            d.pegawaiId,
            Number(maks?.n ?? 0) + 1,
            d.jabatanNamaMentah,
            d.jabatanId,
            d.jenisPenugasan,
            d.unitKerjaMentah,
            d.tanggalMulai,
            d.tanggalAkhir,
            d.lamaBulan,
            d.noSk,
          ],
        )
        return { entitasId: insertId, sesudah: await bacaRiwayatJabatan(insertId) }
      },
    })

    segarkan(pegawai.nip)
    // Riwayat jabatan adalah bahan indikator Lama Jabatan, Keragaman Jabatan,
    // dan Substansi Riwayat Jabatan. Sampai 1 Sep 2026 baris ini hanya MENYURUH
    // pengguna menjalankan Hitung Ulang; sekarang ia mengerjakannya.
    const sinkron = await sinkronkanSkor(d.pegawaiId)
    revalidatePath('/peta-talenta')
    revalidatePath('/')
    return berhasil({ id: hasil.entitasId ?? 0 }, `Riwayat jabatan disimpan.${sinkron}`)
  } catch (e) {
    const pesan = pesanDariGalatDb(e, {})
    if (pesan) return gagal(pesan)
    throw e
  }
}

// ---------------------------------------------------------------------------
// 4 · Riwayat diklat (JSON di `pegawai.riwayat_diklat`)
// ---------------------------------------------------------------------------

const SkemaDiklat = z.object({
  pegawaiId: z.number().int().positive(),
  /** Indeks yang diganti; `null` = tambah entri baru. */
  indeks: z.number().int().min(0).nullable(),
  nama: z
    .string()
    .trim()
    .min(3, 'Nama diklat minimal 3 karakter')
    .max(300, 'Nama diklat maksimal 300 karakter'),
})

export async function simpanDiklat(masukan: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_PROFIL)
  if (tolak) return tolak

  const urai = SkemaDiklat.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const pegawai = await pegawaiTerjangkau(d.pegawaiId)
  if (!pegawai) return gagal('Pegawai tidak ditemukan.')

  const baris = await kueriSatu<{ riwayat_diklat: unknown }>(
    `SELECT riwayat_diklat FROM pegawai WHERE id = ?`,
    [d.pegawaiId],
  )

  /**
   * Kolomnya JSON, dan driver MySQL bisa mengembalikannya sebagai objek ATAU
   * sebagai string tergantung versi & konfigurasi koneksi. Menganggapnya selalu
   * salah satu adalah cara termudah menghasilkan `riwayat_diklat` bernilai
   * `["[\"Diklat A\"]"]` — larik berisi satu string JSON, yang tampak benar di
   * halaman profil dan tidak akan pernah cocok dengan kamus `pemetaan_diklat`.
   */
  const mentah = baris?.riwayat_diklat ?? null
  let daftar: string[] = []
  try {
    const nilai = typeof mentah === 'string' ? JSON.parse(mentah) : mentah
    if (Array.isArray(nilai)) daftar = nilai.map((x) => String(x))
  } catch {
    daftar = []
  }

  if (d.indeks !== null && d.indeks >= daftar.length) {
    return gagal('Entri diklat yang diubah sudah tidak ada. Muat ulang halamannya.')
  }

  const sesudah = [...daftar]
  if (d.indeks === null) sesudah.push(d.nama)
  else sesudah[d.indeks] = d.nama

  try {
    await jalankanMutasi({
      entitas: 'pegawai',
      aksi: 'UBAH',
      peranDiizinkan: PERAN_PROFIL,
      // Yang dicatat: berapa entri sebelum & sesudah, bukan seluruh larik.
      // Riwayat diklat bisa 30 entri per orang, dan menyalinnya utuh ke setiap
      // baris audit membuat tabel itu tumbuh jauh lebih cepat daripada isinya
      // berguna.
      sebelum: async () => ({ id: d.pegawaiId, jumlah_diklat: daftar.length }),
      jalankan: async () => {
        await eksekusi(
          `UPDATE pegawai SET riwayat_diklat = CAST(? AS JSON), sumber_sinkron = 'manual' WHERE id = ?`,
          [JSON.stringify(sesudah), d.pegawaiId],
        )
        return { entitasId: d.pegawaiId, sesudah: { id: d.pegawaiId, jumlah_diklat: sesudah.length } }
      },
    })

    segarkan(pegawai.nip)
    /*
      Skornya dihitung ulang seperti jalur tulis profil lainnya, TAPI kalimatnya
      tetap menyebut Validasi Riwayat — dan itu bukan kelebihan kata. Diklat baru
      belum punya baris di `pemetaan_diklat`, jadi hitung ulang di sini menghasilkan
      angka yang SAMA: ia belum berkontribusi ke indikator Pengembangan Kompetensi
      sampai kategorinya dipetakan & divalidasi. Tanpa kalimat itu, orang melihat
      "skor dihitung ulang" lalu menunggu angkanya naik dan menyimpulkan fiturnya
      rusak.
    */
    const sinkron = await sinkronkanSkor(d.pegawaiId)
    revalidatePath('/peta-talenta')
    revalidatePath('/')
    return berhasil(
      undefined,
      (d.indeks === null
        ? `"${d.nama}" ditambahkan. Agar dihitung dalam skor, petakan kategorinya di Validasi Riwayat.`
        : 'Nama diklat diperbarui.') + sinkron,
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, {})
    if (pesan) return gagal(pesan)
    throw e
  }
}

// ---------------------------------------------------------------------------
// 5 · Kinerja per periode
// ---------------------------------------------------------------------------

const SkemaKinerja = z.object({
  id: z.number().int().positive().nullable(),
  pegawaiId: z.number().int().positive(),
  tahun: tahunWajar('Tahun'),
  periodeSkp: z.enum(PERIODE),
  nilaiKinerja: z.number().min(0, 'Nilai kinerja 0–100').max(100, 'Nilai kinerja 0–100').nullable(),
  nilaiPerilaku: z.number().min(0, 'Nilai perilaku 0–100').max(100, 'Nilai perilaku 0–100').nullable(),
  predikat: z.enum(PREDIKAT),
})

export async function simpanKinerja(masukan: unknown): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_PROFIL)
  if (tolak) return tolak

  const urai = SkemaKinerja.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const pegawai = await pegawaiTerjangkau(d.pegawaiId)
  if (!pegawai) return gagal('Pegawai tidak ditemukan.')

  if (d.id !== null) {
    const milik = await kueriSatu<{ id: number }>(
      `SELECT id FROM kinerja_periode WHERE id = ? AND pegawai_id = ?`,
      [d.id, d.pegawaiId],
    )
    if (!milik) return gagal('Baris kinerja tidak ditemukan.')
  }

  // Satu pegawai hanya boleh punya satu baris per (tahun, periode). Tidak ada
  // UNIQUE-nya di skema, jadi ini diperiksa di sini — kalau tidak, "TAHUNAN
  // 2025" bisa ada dua kali dengan predikat berbeda dan tidak ada satu pun
  // halaman yang bisa memutuskan mana yang benar.
  const bentrok = await kueriSatu<{ id: number }>(
    `SELECT id FROM kinerja_periode
      WHERE pegawai_id = ? AND tahun = ? AND periode_skp = ?${d.id === null ? '' : ' AND id <> ?'}`,
    d.id === null ? [d.pegawaiId, d.tahun, d.periodeSkp] : [d.pegawaiId, d.tahun, d.periodeSkp, d.id],
  )
  if (bentrok) {
    return gagal(`${d.periodeSkp} tahun ${d.tahun} sudah ada. Ubah baris itu, jangan menambah baru.`, {
      periodeSkp: 'Periode ini sudah terisi untuk tahun tersebut.',
    })
  }

  try {
    const hasil = await jalankanMutasi({
      entitas: 'kinerja_periode',
      aksi: d.id === null ? 'BUAT' : 'UBAH',
      peranDiizinkan: PERAN_PROFIL,
      sebelum:
        d.id === null
          ? undefined
          : () => bacaKinerja(d.id!),
      jalankan: async () => {
        if (d.id !== null) {
          await eksekusi(
            `UPDATE kinerja_periode
                SET tahun = ?, periode_skp = ?, nilai_kinerja = ?, nilai_perilaku = ?,
                    predikat = ?, sumber_sync = 'manual'
              WHERE id = ?`,
            [d.tahun, d.periodeSkp, d.nilaiKinerja, d.nilaiPerilaku, d.predikat, d.id],
          )
          return { entitasId: d.id, sesudah: await bacaKinerja(d.id) }
        }
        const { insertId } = await eksekusi(
          `INSERT INTO kinerja_periode
             (pegawai_id, tahun, periode_skp, nilai_kinerja, nilai_perilaku, predikat, sumber_sync)
           VALUES (?, ?, ?, ?, ?, ?, 'manual')`,
          [d.pegawaiId, d.tahun, d.periodeSkp, d.nilaiKinerja, d.nilaiPerilaku, d.predikat],
        )
        return { entitasId: insertId, sesudah: await bacaKinerja(insertId) }
      },
    })

    segarkan(pegawai.nip)
    const sinkron = await sinkronkanSkor(d.pegawaiId)
    revalidatePath('/peta-talenta')
    revalidatePath('/')
    return berhasil(
      { id: hasil.entitasId ?? 0 },
      `Kinerja ${d.periodeSkp} ${d.tahun} disimpan.${sinkron}`,
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, {})
    if (pesan) return gagal(pesan)
    throw e
  }
}

// ---------------------------------------------------------------------------
// 6 · Asesmen talenta
// ---------------------------------------------------------------------------

/**
 * Yang diminta dari pengguna hanya **masukan mentah**: kinerja (Y), potkom, dan
 * predikat. `nilai_potensial_x`, `nilai_talenta`, dan `kotak_9` **tidak** ada di
 * formulir — ketiganya turunan, dan menyediakan kolomnya berarti mengizinkan
 * seseorang menyimpan Kotak 9 yang tidak sesuai dengan Y & X di baris yang sama.
 * Itu tepat jenis ketidakcocokan yang Antrian Pembersihan Data ada untuk
 * melaporkan; menambahkan pintu untuk membuatnya adalah kemunduran.
 */
const SkemaAsesmen = z.object({
  id: z.number().int().positive().nullable(),
  pegawaiId: z.number().int().positive(),
  tahunAsesmen: tahunWajar('Tahun asesmen'),
  jenisAsesmen: z.string().trim().min(2, 'Jenis asesmen wajib diisi').max(60, 'Jenis asesmen maksimal 60 karakter'),
  /*
    Jenjang tempat asesmen ini dinilai (doc/sql/022). NULLABLE, dan itu disengaja:
    baris yang masuk sebelum kolomnya ada memang tidak punya, dan memaksa isian di
    sini berarti tiap penyuntingan baris lama menuntut orang MENGARANG jenjangnya.
    String kosong dianggap "tidak tercatat", bukan jenjang bernama kosong.
  */
  jenjangAsesmen: z
    .string()
    .trim()
    .max(40, 'Jenjang asesmen maksimal 40 karakter')
    .nullable()
    .transform((v) => (v === '' ? null : v)),
  statusAsesmen: z.enum(STATUS_ASESMEN),
  nilaiKinerjaY: z.number().min(0, 'Nilai kinerja 0–100').max(100, 'Nilai kinerja 0–100'),
  potkom: z.number().min(0, 'Potkom tidak boleh negatif').max(200, 'Potkom di luar rentang yang wajar'),
  nilaiIntegritas: z.number().min(0).max(100, 'Nilai integritas 0–100').nullable(),
  tahunKinerja: tahunWajar('Tahun kinerja').nullable(),
  ratingKinerja: z.enum(PREDIKAT),
})

export async function simpanAsesmen(masukan: unknown): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_PROFIL)
  if (tolak) return tolak

  const urai = SkemaAsesmen.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const pegawai = await pegawaiTerjangkau(d.pegawaiId)
  if (!pegawai) return gagal('Pegawai tidak ditemukan.')

  if (d.id !== null) {
    const milik = await kueriSatu<{ id: number }>(
      `SELECT id FROM asesmen_talenta WHERE id = ? AND pegawai_id = ?`,
      [d.id, d.pegawaiId],
    )
    if (!milik) return gagal('Baris asesmen tidak ditemukan.')
  }

  // Seluruh turunannya lahir di SINI, lewat implementasi yang sama dengan
  // importer & sinkron eNom. Tidak ada satu pun rumus di berkas ini.
  const norm = normalisasiAsesmen(
    {
      tahunAsesmen: d.tahunAsesmen,
      jenisAsesmen: d.jenisAsesmen,
      statusAsesmen: d.statusAsesmen,
      nilaiKinerjaY: d.nilaiKinerjaY,
      potkom: d.potkom,
      nilaiIntegritas: d.nilaiIntegritas,
      kotak9Sumber: null,
    },
    {
      tahunSekarang: new Date().getFullYear(),
      ...parameterSkoringDari(await ambilPengaturan()),
    },
  )
  const a = norm.nilai

  try {
    const hasil = await jalankanMutasi({
      entitas: 'asesmen_talenta',
      aksi: d.id === null ? 'BUAT' : 'UBAH',
      peranDiizinkan: PERAN_PROFIL,
      sebelum:
        d.id === null
          ? undefined
          : () => bacaAsesmen(d.id!),
      jalankan: async () => {
        if (d.id !== null) {
          await eksekusi(
            `UPDATE asesmen_talenta
                SET tahun_asesmen = ?, jenis_asesmen = ?, jenjang_asesmen = ?, status_asesmen = ?, nilai_kinerja_y = ?,
                    nilai_potensial_x = ?, potkom = ?, nilai_integritas = ?, nilai_talenta = ?,
                    kotak_9 = ?, tahun_kinerja = ?, rating_kinerja = ?, sumber_sync = 'manual'
              WHERE id = ?`,
            [
              a.tahunAsesmen,
              a.jenisAsesmen,
              d.jenjangAsesmen,
              a.statusAsesmen,
              a.nilaiKinerjaY,
              a.nilaiPotensialX,
              a.potkom,
              a.nilaiIntegritas,
              a.nilaiTalenta,
              a.kotak9,
              d.tahunKinerja,
              d.ratingKinerja,
              d.id,
            ],
          )
          return { entitasId: d.id, sesudah: await bacaAsesmen(d.id) }
        }
        const { insertId } = await eksekusi(
          `INSERT INTO asesmen_talenta
             (pegawai_id, tahun_asesmen, jenis_asesmen, jenjang_asesmen, status_asesmen,
              nilai_kinerja_y, nilai_potensial_x, potkom, nilai_integritas, nilai_talenta,
              kotak_9, tahun_kinerja, rating_kinerja, sumber_sync)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
          [
            d.pegawaiId,
            a.tahunAsesmen,
            a.jenisAsesmen,
            d.jenjangAsesmen,
            a.statusAsesmen,
            a.nilaiKinerjaY,
            a.nilaiPotensialX,
            a.potkom,
            a.nilaiIntegritas,
            a.nilaiTalenta,
            a.kotak9,
            d.tahunKinerja,
            d.ratingKinerja,
          ],
        )
        return { entitasId: insertId, sesudah: await bacaAsesmen(insertId) }
      },
    })

    segarkan(pegawai.nip)
    revalidatePath('/peta-talenta')
    revalidatePath('/')

    const catatan = norm.temuan.length > 0 ? ` Catatan: ${norm.temuan[0]!.keterangan}` : ''
    const sinkron = await sinkronkanSkor(d.pegawaiId)
    return berhasil(
      { id: hasil.entitasId ?? 0 },
      `Asesmen ${a.tahunAsesmen} disimpan — Kotak ${a.kotak9} (dihitung dari Kinerja ${a.nilaiKinerjaY} × Potensial ${a.nilaiPotensialX}).${catatan}${sinkron}`,
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, {})
    if (pesan) return gagal(pesan)
    throw e
  }
}

// ---------------------------------------------------------------------------
// 7 · Pegawai BARU — manual satu per satu, atau massal dari tempelan
// ---------------------------------------------------------------------------

/**
 * Permintaan user butir 9: "tambah manual / bulk data pegawai di direktorat pegawai".
 *
 * ## Kenapa di berkas ini, bukan `lib/aksi/pegawai.ts` yang baru
 *
 * Validasi NIP, golongan, jenjang pendidikan, dan batas lingkup unit sudah hidup
 * di sini untuk `ubahIdentitas`. Menaruh jalur "buat baru" di berkas lain berarti
 * aturan yang sama ditulis dua kali, dan yang kedua akan menyimpang begitu salah
 * satunya diubah — larangan CLAUDE.md #1. Satu tabel, satu tempat aturannya.
 *
 * ## Kenapa NIP divalidasi 18 digit di sini padahal `parseNip()` ada
 *
 * `parseNip()` menjawab "apa isi NIP ini" (tanggal lahir, jenis kelamin, TMT
 * CPNS) dan sengaja **toleran**: ia melaporkan masalah tanpa menolak, sebab
 * Direktori harus tetap bisa menampilkan pegawai ber-NIP cacat yang sudah ada di
 * DB. Di jalur BUAT, toleransi itu salah — NIP adalah kunci alami yang dipakai
 * seluruh aplikasi (URL profil, penautan foto, pencocokan eNominasi), jadi
 * membiarkan satu yang cacat masuk berarti membuat baris yang profilnya tidak
 * bisa dibuka. Karena itu di sini ia **ditolak**, dan `parseNip()` tetap dipakai
 * untuk melaporkan isinya.
 */

const SkemaPegawaiBaru = z.object({
  nip: z
    .string()
    .trim()
    .regex(/^\d{18}$/, 'NIP harus tepat 18 angka, tanpa spasi atau tanda baca'),
  namaLengkap: z
    .string()
    .trim()
    .min(3, 'Nama minimal 3 karakter')
    .max(150, 'Nama maksimal 150 karakter'),
  golongan: teksOpsional(10, 'Golongan'),
  pangkat: teksOpsional(60, 'Pangkat'),
  tmtGolongan: tanggalOpsional('TMT golongan'),
  tmtJabatan: tanggalOpsional('TMT jabatan'),
  jabatanId: z.number().int().positive().nullable(),
  sekolahTerakhir: teksOpsional(200, 'Sekolah terakhir'),
  bidangStudiTerakhir: teksOpsional(200, 'Bidang studi terakhir'),
  tingkatPendidikan: z.enum(JENJANG).nullable(),
  statusAktif: z.enum(STATUS_AKTIF),
})

async function bacaPegawaiBaru(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, nip, nama_lengkap, golongan, pangkat, tmt_golongan, tmt_jabatan,
            jabatan_id, tingkat_pendidikan, sekolah_terakhir, bidang_studi_terakhir,
            status_aktif, sumber_sinkron
       FROM pegawai WHERE id = ?`,
    [id],
  )
}

export async function tambahPegawai(masukan: unknown): Promise<HasilAksi<{ nip: string }>> {
  const tolak = await gerbangPeran(PERAN_PROFIL)
  if (tolak) return tolak

  const urai = SkemaPegawaiBaru.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const kembar = await kueriSatu<{ nama_lengkap: string }>(
    `SELECT nama_lengkap FROM pegawai WHERE nip = ?`,
    [d.nip],
  )
  if (kembar) {
    return gagal(
      `NIP ${d.nip} sudah dipakai ${kembar.nama_lengkap}. Buka profilnya untuk mengubah datanya, jangan membuat baris kedua.`,
      { nip: 'NIP sudah terpakai.' },
    )
  }

  if (d.jabatanId !== null && !(await jabatanTerjangkau(d.jabatanId))) {
    return gagal('Jabatan tidak ditemukan dalam lingkup unit Anda.', {
      jabatanId: 'Jabatan tidak ditemukan.',
    })
  }

  try {
    await jalankanMutasi({
      entitas: 'pegawai',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_PROFIL,
      jalankan: async () => {
        const r = await eksekusi(
          `INSERT INTO pegawai
             (nip, nama_lengkap, golongan, pangkat, tmt_golongan, tmt_jabatan, jabatan_id,
              tingkat_pendidikan, sekolah_terakhir, bidang_studi_terakhir, status_aktif,
              sumber_sinkron)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
          [
            d.nip,
            d.namaLengkap,
            d.golongan,
            d.pangkat,
            d.tmtGolongan,
            d.tmtJabatan,
            d.jabatanId,
            d.tingkatPendidikan,
            d.sekolahTerakhir,
            d.bidangStudiTerakhir,
            d.statusAktif,
          ],
        )
        const id = Number(r.insertId)
        return { entitasId: id, sesudah: await bacaPegawaiBaru(id) }
      },
    })

    segarkan(d.nip)
    revalidatePath('/talenta')
    return berhasil(
      { nip: d.nip },
      `${d.namaLengkap} ditambahkan. Belum punya asesmen, jadi ia belum muncul di Kotak 9 — isi asesmennya dari profilnya.`,
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `NIP ${d.nip}` })
    if (pesan) return gagal(pesan)
    throw e
  }
}

/**
 * Tambah pegawai MASSAL dari tempelan (butir 9).
 *
 * ## Bentuk masukannya, dan kenapa tanpa unggah berkas
 *
 * Satu pegawai per baris, kolom dipisah TAB atau `;`. TAB karena itu yang keluar
 * saat orang menyalin blok sel dari Excel — jalur yang benar-benar dipakai staf
 * kepegawaian. Unggah `.xlsx` sengaja TIDAK dipakai di sini: repo ini tidak punya
 * pembaca xlsx (lihat `scripts/xlsx-ke-json.py` yang memakai Python justru untuk
 * menghindari menambah dependensi), dan menambahkannya demi satu form berarti
 * memasang parser biner di jalur unggahan pengguna. Tempelan teks bisa dilihat
 * dan dikoreksi orangnya sendiri sebelum dikirim.
 *
 * Kolom, berurutan — hanya dua yang pertama wajib:
 *   NIP · Nama · Golongan · TMT Golongan · Kode Jabatan · Jenjang · Sekolah · Bidang Studi
 *
 * ## Semua-atau-tidak, dan itu keputusan sadar
 *
 * Seluruh baris divalidasi lebih dulu; satu baris cacat membatalkan semuanya.
 * Impor sebagian terasa lebih ramah tapi meninggalkan pengguna tidak tahu apa
 * yang sudah masuk dan apa yang belum — dan pada tabel pegawai, "tidak tahu"
 * berarti orang harus membandingkan 200 baris tempelan dengan isi direktori satu
 * per satu. Penulisannya satu pernyataan `INSERT` multi-baris, jadi atomisitasnya
 * ditegakkan InnoDB, bukan oleh urutan kode di sini.
 *
 * `kodeJabatan` dicocokkan PERSIS dengan `jabatan.kode_jabatan`, bukan dengan
 * namanya. Pencocokan nama secara samar adalah cara tercepat menempatkan orang
 * di jabatan yang mirip namanya tapi bukan miliknya, dan kekeliruan itu baru
 * ketahuan saat perhitungan kandidat.
 */

const MAKS_BARIS_MASSAL = 500

interface BarisMassal {
  nomor: number
  nip: string
  namaLengkap: string
  golongan: string | null
  tmtGolongan: string | null
  kodeJabatan: string | null
  tingkatPendidikan: (typeof JENJANG)[number] | null
  sekolahTerakhir: string | null
  bidangStudiTerakhir: string | null
}

function pisahKolom(baris: string): string[] {
  // TAB lebih dulu: tempelan Excel memakai TAB, dan nama jabatan sering memuat
  // koma sehingga CSV berkoma justru memecah kolom di tempat yang salah.
  const pemisah = baris.includes('\t') ? '\t' : ';'
  return baris.split(pemisah).map((k) => k.trim())
}

export async function tambahPegawaiMassal(
  masukan: unknown,
): Promise<HasilAksi<{ jumlah: number }>> {
  const tolak = await gerbangPeran(PERAN_PROFIL)
  if (tolak) return tolak

  const urai = z
    .object({ teks: z.string().min(1, 'Tempelkan dulu datanya.') })
    .safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))

  const barisTeks = urai.data.teks
    .split(/\r?\n/)
    .map((b) => b.trim())
    .filter((b) => b !== '')
  if (barisTeks.length === 0) return gagal('Tidak ada baris yang bisa dibaca.')
  if (barisTeks.length > MAKS_BARIS_MASSAL) {
    return gagal(
      `Sekali tempel maksimal ${MAKS_BARIS_MASSAL} baris; yang ditempel ${barisTeks.length}. Pecah jadi beberapa bagian.`,
    )
  }

  const galat: string[] = []
  const baris: BarisMassal[] = []
  const nipTerlihat = new Map<string, number>()

  barisTeks.forEach((teks, i) => {
    const nomor = i + 1
    const k = pisahKolom(teks)
    const nip = (k[0] ?? '').replace(/\D/g, '')
    const nama = (k[1] ?? '').replace(/\s+/g, ' ').trim()

    if (!/^\d{18}$/.test(nip)) {
      galat.push(`Baris ${nomor}: NIP "${k[0] ?? ''}" bukan 18 angka.`)
      return
    }
    if (nama.length < 3) {
      galat.push(`Baris ${nomor}: nama wajib diisi (minimal 3 karakter).`)
      return
    }
    const kembarDalamTempelan = nipTerlihat.get(nip)
    if (kembarDalamTempelan !== undefined) {
      galat.push(`Baris ${nomor}: NIP ${nip} sudah ada di baris ${kembarDalamTempelan}.`)
      return
    }
    nipTerlihat.set(nip, nomor)

    const jenjangMentah = (k[5] ?? '').toUpperCase().replace(/[\s/-]/g, '_')
    const jenjang =
      jenjangMentah === ''
        ? null
        : ((JENJANG as readonly string[]).includes(jenjangMentah)
            ? (jenjangMentah as (typeof JENJANG)[number])
            : undefined)
    if (jenjang === undefined) {
      galat.push(
        `Baris ${nomor}: jenjang "${k[5]}" tidak dikenali — pakai salah satu dari ${JENJANG.join(', ')}.`,
      )
      return
    }

    baris.push({
      nomor,
      nip,
      namaLengkap: nama,
      golongan: k[2] || null,
      tmtGolongan: k[3] || null,
      kodeJabatan: k[4] || null,
      tingkatPendidikan: jenjang,
      sekolahTerakhir: k[6] || null,
      bidangStudiTerakhir: k[7] || null,
    })
  })

  if (galat.length > 0) {
    return gagal(
      `${galat.length} baris bermasalah — tidak ada yang disimpan. ${galat.slice(0, 5).join(' ')}${galat.length > 5 ? ` (+${galat.length - 5} lagi)` : ''}`,
    )
  }

  // TMT divalidasi setelah bentuk dasarnya lolos, memakai normaliser yang sama
  // dengan importir supaya "12/2019" dan "1 Des 2019" diterima seperti di sana.
  // `Date | null`, bukan string: `normalisasiTanggal()` mengembalikan `Date`, dan
  // mysql2 menuliskannya ke kolom DATE tanpa perlu diformat ulang. Memformatnya
  // sendiri di sini berarti satu tempat lagi yang bisa salah soal zona waktu.
  const tmt = new Map<number, Date | null>()
  for (const b of baris) {
    if (b.tmtGolongan === null) {
      tmt.set(b.nomor, null)
      continue
    }
    const hasil = normalisasiTanggal(b.tmtGolongan, 'tmt_golongan')
    if (hasil.nilai === null) {
      galat.push(`Baris ${b.nomor}: TMT golongan "${b.tmtGolongan}" tidak bisa dibaca sebagai tanggal.`)
    }
    tmt.set(b.nomor, hasil.nilai)
  }
  if (galat.length > 0) {
    return gagal(`${galat.length} baris bermasalah — tidak ada yang disimpan. ${galat.slice(0, 5).join(' ')}`)
  }

  // NIP yang sudah ada di DB
  const nipSemua = baris.map((b) => b.nip)
  const sudahAda = await kueri<{ nip: string; nama_lengkap: string }>(
    `SELECT nip, nama_lengkap FROM pegawai WHERE nip IN (${nipSemua.map(() => '?').join(',')})`,
    nipSemua,
  )
  if (sudahAda.length > 0) {
    return gagal(
      `${sudahAda.length} NIP sudah ada di direktori — tidak ada yang disimpan. ` +
        sudahAda
          .slice(0, 5)
          .map((r) => `${r.nip} (${r.nama_lengkap})`)
          .join('; ') +
        '. Ubah datanya dari profil masing-masing, jangan menambah baris kedua.',
    )
  }

  // Kode jabatan → id, dengan batas lingkup unit yang sama seperti jalur manual.
  const kodeDiminta = [...new Set(baris.map((b) => b.kodeJabatan).filter((k): k is string => k !== null))]
  const petaJabatan = new Map<string, number>()
  if (kodeDiminta.length > 0) {
    const ditemukan = await kueri<{ id: number; kode_jabatan: string }>(
      `SELECT id, kode_jabatan FROM jabatan WHERE kode_jabatan IN (${kodeDiminta.map(() => '?').join(',')})`,
      kodeDiminta,
    )
    for (const j of ditemukan) petaJabatan.set(j.kode_jabatan, Number(j.id))
    const hilang = kodeDiminta.filter((k) => !petaJabatan.has(k))
    if (hilang.length > 0) {
      return gagal(
        `Kode jabatan tidak ada di master: ${hilang.slice(0, 5).join(', ')}${hilang.length > 5 ? ` (+${hilang.length - 5})` : ''}. Tidak ada yang disimpan.`,
      )
    }
    for (const k of kodeDiminta) {
      if (!(await jabatanTerjangkau(petaJabatan.get(k)!))) {
        return gagal(
          `Kode jabatan ${k} berada di luar lingkup unit Anda. Tidak ada yang disimpan.`,
        )
      }
    }
  }

  const nilai = baris.map((b) => [
    b.nip,
    b.namaLengkap,
    b.golongan,
    tmt.get(b.nomor) ?? null,
    b.kodeJabatan === null ? null : petaJabatan.get(b.kodeJabatan)!,
    b.tingkatPendidikan,
    b.sekolahTerakhir,
    b.bidangStudiTerakhir,
  ])

  try {
    await jalankanMutasi({
      entitas: 'pegawai',
      aksi: 'IMPOR',
      peranDiizinkan: PERAN_PROFIL,
      jalankan: async () => {
        await eksekusi(
          `INSERT INTO pegawai
             (nip, nama_lengkap, golongan, tmt_golongan, jabatan_id, tingkat_pendidikan,
              sekolah_terakhir, bidang_studi_terakhir, status_aktif, sumber_sinkron)
           VALUES ${nilai.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, 'AKTIF', 'manual')").join(', ')}`,
          nilai.flat(),
        )
        return {
          entitasId: null,
          sesudah: {
            jumlah: nilai.length,
            nip: baris.map((b) => b.nip),
            denganJabatan: baris.filter((b) => b.kodeJabatan !== null).length,
          },
        }
      },
    })

    revalidatePath('/talenta')
    revalidatePath('/')
    const tanpaJabatan = baris.filter((b) => b.kodeJabatan === null).length
    return berhasil(
      { jumlah: baris.length },
      `${baris.length} pegawai ditambahkan.` +
        (tanpaJabatan > 0
          ? ` ${tanpaJabatan} di antaranya belum tertaut jabatan, jadi tidak muncul pada penyaring unit sampai jabatannya diisi.`
          : '') +
        ' Semuanya belum punya asesmen, jadi belum masuk Kotak 9.',
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: 'Salah satu NIP' })
    if (pesan) return gagal(`${pesan} Tidak ada baris yang disimpan.`)
    throw e
  }
}

// ---------------------------------------------------------------------------
// Impor pegawai dari berkas .xlsx Talent Pool
// ---------------------------------------------------------------------------

/**
 * Batas ukuran unggahan. Berkas Talent Pool Pengawas ~2 MB dengan 53 foto
 * tertanam; 20 MB memberi ruang untuk berkas yang jauh lebih besar tanpa
 * membiarkan seseorang mengirim ratusan MB ke `inflateRawSync` yang sinkron
 * (yang akan memblokir event loop, bukan cuma memakan memori).
 */
const MAKS_BITA_XLSX = 20 * 1024 * 1024

/** Jenjang di berkas → enum DB. Yang tidak terpetakan dibiarkan `null`. */
const JENJANG_BERKAS: Record<string, (typeof JENJANG)[number]> = {
  SLTA: 'SLTA',
  SMA: 'SLTA',
  SMK: 'SLTA',
  STM: 'SLTA',
  D3: 'D3',
  DIII: 'D3',
  D4: 'S1_D4',
  DIV: 'S1_D4',
  S1: 'S1_D4',
  'S1/D4': 'S1_D4',
  S2: 'S2',
  S3: 'S3',
}

export interface HasilImporXlsx {
  dibuat: number
  diperbarui: number
  dilewati: number
  /** Baris yang ditolak beserta sebabnya — dipajang apa adanya di UI. */
  masalah: string[]
}

/**
 * Impor pegawai dari berkas `.xlsx` Talent Pool (permintaan pemilik proses
 * 24 Agu 2026: *"gw mau tambah pegawai pake upload excel pake template …"*).
 *
 * ## Kenapa jalur ini ada padahal mode tempel sudah ada
 *
 * Template Talent Pool **bukan satu baris per pegawai**. Terukur pada
 * `TALENT POOL PENGAWAS#2 fix.xlsx`: 653 baris berisi, hanya **53 ber-NIP**; 600
 * sisanya baris LANJUTAN yang memuat riwayat jabatan & pelatihan milik pegawai di
 * atasnya. Menempelkannya ke mode massal akan menolak ke-600 baris itu ("NIP bukan
 * 18 angka") dan — karena aturannya semua-atau-tidak — yang masuk **nol**. Kolomnya
 * juga tidak berbaris: template menaruh NAMA di kolom 2 dan NIP di kolom 3,
 * sementara mode tempel menunggu NIP lebih dulu, dan ia butuh **kode** jabatan
 * sementara berkasnya hanya punya **nama** jabatan.
 *
 * ## Aturan pembacaannya SATU, dibuktikan bukan diklaim
 *
 * Pembacaan berkasnya memakai `lib/importer/talentpool-xlsx.ts`, modul yang sama
 * yang diuji **setara dengan `scripts/xlsx-ke-json.py`** pada berkas nyata
 * (`lib/importer/talentpool-xlsx.test.ts`: 53 pegawai sama, pengelompokan blok
 * identik baris per baris, >300 entri riwayat jabatan & >100 diklat identik). Tanpa
 * uji itu, "dua jalur satu aturan" hanya niat.
 *
 * ## Baris yang perlu ditinjau DITOLAK, tidak diperbaiki di sini
 *
 * Ekstraktor CLI memuat dua perbaikan yang divalidasi terhadap data (memulihkan
 * unit dari riwayat jabatan, 46/46; mengoreksi blok kolom yang tergeser). Keduanya
 * **tidak** dijalankan di jalur unggahan — perbaikan yang divalidasi terhadap satu
 * berkas adalah penilaian manusia, bukan aturan umum, dan menerapkannya pada
 * berkas yang belum ditinjau berarti menebak. Jadi barisnya ditolak dengan
 * menyebut nomor barisnya, dan operator memutuskan: betulkan berkasnya, atau impor
 * lewat jalur CLI yang sudah ditinjau.
 *
 * ## `perbarui` dan mengapa ia TIDAK menimpa dengan sel kosong
 *
 * Dengan `perbarui: true`, NIP yang sudah ada **diperbarui**, bukan ditolak
 * (permintaan susulan: *"kasih opsi pengecekan dari nip, kalo nip udah ada berarti
 * update aja"*). Yang diperbarui hanya field yang berkasnya **benar-benar isi**:
 * sel kosong TIDAK mengosongkan nilai yang sudah ada. Alasannya ada di riwayat
 * proyek ini — tiga cacat kehilangan data di editor profil semuanya berbentuk
 * "field yang tidak diisi ternyata menimpa dengan `null`", dan berkas impor punya
 * kolom kosong jauh lebih sering daripada form.
 */
export async function imporPegawaiDariXlsx(
  formData: FormData,
): Promise<HasilAksi<HasilImporXlsx>> {
  const tolak = await gerbangPeran(PERAN_PROFIL)
  if (tolak) return tolak

  const berkas = formData.get('berkas')
  if (!(berkas instanceof File) || berkas.size === 0) {
    return gagal('Pilih dulu berkas .xlsx-nya.', { berkas: 'Berkas wajib dipilih.' })
  }
  if (berkas.size > MAKS_BITA_XLSX) {
    return gagal(
      `Berkas ${(berkas.size / 1024 / 1024).toFixed(1)} MB, batasnya ${MAKS_BITA_XLSX / 1024 / 1024} MB.`,
      { berkas: 'Berkas terlalu besar.' },
    )
  }
  if (!/\.xlsx$/i.test(berkas.name)) {
    return gagal(
      `"${berkas.name}" bukan .xlsx. Berkas .xls lama dan .csv belum didukung — simpan ulang sebagai .xlsx dari Excel.`,
      { berkas: 'Harus .xlsx.' },
    )
  }
  const perbarui = formData.get('perbarui') === 'true'
  /*
    `lewati` = impor baris yang bersih, LEWATI yang perlu ditinjau.

    Bukan pelemahan aturan semua-atau-tidak, dan bedanya penting: yang boleh
    dilewati hanya baris yang **sudah dikenali** modul pembacanya sebagai perlu
    ditinjau, dan setiap satunya dilaporkan beserta sebabnya di pesan hasil.
    Galat lain — NIP cacat, tanggal tak terbaca, pasangan (jabatan, unit) yang
    tidak ada di master — tetap MEMBATALKAN seluruh impor, sebab itu keadaan yang
    operator harus betulkan, bukan pilih untuk diabaikan.

    Tanpa pilihan ini, berkas dengan satu baris rusak tidak bisa diimpor sama
    sekali lewat UI — terukur pada `TALENT POOL PENGAWAS#2 fix.xlsx`: 7 dari 53
    barisnya selnya tergeser, jadi 46 pegawai yang datanya sempurna ikut tertahan.
  */
  const lewatiBermasalah = formData.get('lewati') === 'true'

  const { bacaTalentPool } = await import('../importer/talentpool-xlsx')
  let dibaca: Awaited<ReturnType<typeof bacaTalentPool>>
  try {
    dibaca = bacaTalentPool(Buffer.from(await berkas.arrayBuffer()))
  } catch (e) {
    // Pesan dari pembacanya sendiri sudah menyebut sebabnya (header tidak
    // dikenali, ZIP rusak, kompresi tak didukung) — diteruskan apa adanya alih-alih
    // diganti "gagal membaca berkas", yang tidak memberi tahu apa yang harus
    // dibetulkan.
    return gagal(e instanceof Error ? e.message : 'Berkas tidak bisa dibaca.')
  }

  const masalah: string[] = []
  interface Siap {
    nip: string
    nama: string
    golongan: string | null
    tmtGolongan: Date | null
    namaJabatan: string
    unitKerja: string
    tingkatPendidikan: (typeof JENJANG)[number] | null
    sekolah: string | null
    bidangStudi: string | null
  }
  const siap: Siap[] = []
  const nipTerlihat = new Map<string, number>()

  for (const b of dibaca.baris) {
    const label = `Baris Excel ${b.barisExcel}`
    if (b.perluTinjau.length > 0) {
      masalah.push(`${label} (${b.nama || 'tanpa nama'}): ${b.perluTinjau.join('; ')}.`)
      continue
    }
    const nip = b.nip.replace(/\D/g, '')
    if (!/^\d{18}$/.test(nip)) {
      masalah.push(`${label}: NIP "${b.nip}" bukan 18 angka.`)
      continue
    }
    const nama = b.nama.replace(/\s+/g, ' ').trim()
    if (nama.length < 3) {
      masalah.push(`${label}: nama wajib diisi (minimal 3 karakter).`)
      continue
    }
    const kembar = nipTerlihat.get(nip)
    if (kembar !== undefined) {
      masalah.push(`${label}: NIP ${nip} sudah muncul di baris ${kembar}.`)
      continue
    }
    nipTerlihat.set(nip, b.barisExcel)

    let tmtGolongan: Date | null = null
    if (b.tmtGolongan !== '') {
      const hasil = normalisasiTanggal(b.tmtGolongan, 'tmt_golongan')
      if (hasil.nilai === null) {
        masalah.push(`${label}: TMT golongan "${b.tmtGolongan}" tidak bisa dibaca sebagai tanggal.`)
        continue
      }
      tmtGolongan = hasil.nilai
    }

    const kunciJenjang = b.tingkatPendidikan.replace(/\s+/g, '').toUpperCase()
    siap.push({
      nip,
      nama,
      golongan: b.golongan || null,
      tmtGolongan,
      namaJabatan: b.namaJabatan,
      unitKerja: b.unitKerja,
      // Jenjang di luar enum DB (mis. SLTP, SD) jadi `null`, BUKAN penolakan:
      // pendidikan terakhir bukan syarat keberadaan seorang pegawai, dan menolak
      // seluruh berkas karena satu orang berpendidikan SLTP akan membuat impor
      // gagal atas alasan yang tidak bisa dibetulkan operator.
      tingkatPendidikan: JENJANG_BERKAS[kunciJenjang] ?? null,
      sekolah: b.sekolah || null,
      /*
        `jurusan` DULU, `bidangStudi` sebagai cadangan — urutan yang sama dengan
        importir CLI (`r.jurusan || r.bidangStudi`).

        Berkasnya punya DUA kolom yang mudah tertukar: `BIDANG STUDI` berisi
        klasifikasi kasar ("Teknik" / "Non Teknik") sementara `JURUSAN` berisi
        bidang studi sesungguhnya ("MAGISTER TEKNIK SIPIL"). Versi pertama aksi ini
        memakai `BIDANG STUDI`, dan akibatnya **44 nilai `bidang_studi_terakhir`
        tertimpa** dari yang spesifik jadi "Teknik" saat menguji jalur perbarui —
        24 Agu 2026. Tidak ada galat, tidak ada uji yang merah; yang menangkapnya
        hanya membandingkan potret DB sebelum & sesudah.

        Pelajaran yang lebih besar daripada satu field: dua jalur impor bisa
        memakai modul PEMBACA yang sama dan tetap menyimpan hal berbeda, kalau
        pemetaan field → kolom DB-nya ditulis dua kali. Yang dijaga uji kesetaraan
        adalah pembacaan berkasnya; pemetaan ke kolom DB belum, dan itu utang yang
        sengaja dicatat di sini.
      */
      bidangStudi: b.jurusan || b.bidangStudi || null,
    })
  }

  if (siap.length === 0) {
    return gagal(
      masalah.length > 0
        ? `Tidak ada baris yang bisa dipakai. ${masalah.slice(0, 5).join(' ')}${masalah.length > 5 ? ` (+${masalah.length - 5} lagi)` : ''}`
        : 'Berkas tidak memuat satu pun baris pegawai (kolom NO berisi angka).',
    )
  }
  const adaSelainTinjau = masalah.some((m) => !/perlu ditinjau|tergeser|bukan nama unit|bukan jenjang|UNIT KERJA kosong/.test(m))
  if (masalah.length > 0 && (!lewatiBermasalah || adaSelainTinjau)) {
    // SEMUA-ATAU-TIDAK secara baku. Impor sebagian yang TIDAK diminta meninggalkan
    // operator membandingkan berkas 53 baris dengan isi direktori satu per satu
    // untuk tahu mana yang masuk.
    return gagal(
      `${masalah.length} baris bermasalah — tidak ada yang disimpan. ` +
        `${masalah.slice(0, 5).join(' ')}${masalah.length > 5 ? ` (+${masalah.length - 5} lagi)` : ''}` +
        (adaSelainTinjau
          ? ''
          : ' Centang "lewati baris yang perlu ditinjau" kalau ingin mengimpor sisanya saja.'),
    )
  }

  /*
    Jabatan dicocokkan (NAMA + UNIT), keduanya PERSIS setelah normalisasi ejaan.

    Berkasnya hanya punya nama jabatan, sementara nama seperti "Kepala Subbagian
    Umum dan Tata Usaha" ada di 41 Balai berbeda — dicocokkan nama saja, 40 pegawai
    akan tertaut ke unit yang salah, merembet ke penyaring unit, lingkup Pengelola
    Unit, dan daftar kandidat, tanpa satu pun galat. Itu bukan hipotesis: persis itu
    yang terjadi saat importir CLI mengunci jabatan menurut nama saja.

    Dan pencocokannya PERSIS, bukan samar: pencocokan samar untuk memutuskan
    `unit_organisasi_id` sudah sekali menempelkan 56 jabatan ke unit yang salah
    (`samaUnit()` ambang 85% menyamakan seluruh 34 BP2JK).
  */
  const kunciJab = (nama: string, unit: string) =>
    `${nama.toLowerCase().replace(/\bsub\s+(direktorat|bagian|bidang)\b/g, 'sub$1').replace(/[^a-z0-9]+/g, ' ').trim()}@@${unit.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()}`

  const semuaJab = await kueri<{ id: number; nama_jabatan: string; nama_unit: string }>(
    `SELECT j.id, j.nama_jabatan, u.nama_unit FROM jabatan j
       JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
      WHERE j.status_jabatan <> 'DIHAPUS'`,
  )
  const petaJab = new Map<string, number>()
  for (const j of semuaJab) petaJab.set(kunciJab(j.nama_jabatan, j.nama_unit), Number(j.id))

  const tidakKetemu: string[] = []
  const jabatanId = new Map<string, number | null>()
  for (const s of siap) {
    if (s.namaJabatan === '' || s.unitKerja === '') {
      jabatanId.set(s.nip, null)
      continue
    }
    const id = petaJab.get(kunciJab(s.namaJabatan, s.unitKerja)) ?? null
    if (id === null) tidakKetemu.push(`${s.namaJabatan} @ ${s.unitKerja}`)
    jabatanId.set(s.nip, id)
  }
  if (tidakKetemu.length > 0) {
    const unik = [...new Set(tidakKetemu)]
    return gagal(
      `${unik.length} pasangan (jabatan, unit) tidak ada di master — tidak ada yang disimpan. ` +
        `${unik.slice(0, 4).join('; ')}${unik.length > 4 ? ` (+${unik.length - 4} lagi)` : ''}. ` +
        'Buat jabatannya lebih dulu di Master Jabatan, atau impor lewat `npm run impor:talentpool` yang membuat unit & jabatan sekaligus.',
    )
  }
  for (const [nip, id] of jabatanId) {
    if (id !== null && !(await jabatanTerjangkau(id))) {
      const s = siap.find((x) => x.nip === nip)!
      return gagal(
        `Jabatan "${s.namaJabatan}" (${s.unitKerja}) di luar lingkup unit Anda. Tidak ada yang disimpan.`,
      )
    }
  }

  const nipSemua = siap.map((s) => s.nip)
  const adaDb = await kueri<{ id: number; nip: string; nama_lengkap: string }>(
    `SELECT id, nip, nama_lengkap FROM pegawai WHERE nip IN (${nipSemua.map(() => '?').join(',')})`,
    nipSemua,
  )
  const idPerNip = new Map(adaDb.map((r) => [r.nip, Number(r.id)]))
  if (!perbarui && adaDb.length > 0) {
    return gagal(
      `${adaDb.length} NIP sudah ada di direktori — tidak ada yang disimpan. ` +
        adaDb.slice(0, 5).map((r) => `${r.nip} (${r.nama_lengkap})`).join('; ') +
        `${adaDb.length > 5 ? ` (+${adaDb.length - 5})` : ''}. ` +
        'Centang "perbarui yang NIP-nya sudah ada" kalau memang ingin memperbaruinya.',
    )
  }

  const baru = siap.filter((s) => !idPerNip.has(s.nip))
  const lama = siap.filter((s) => idPerNip.has(s.nip))

  await jalankanMutasi({
    entitas: 'pegawai',
    aksi: 'BUAT',
    peranDiizinkan: PERAN_PROFIL,
    sebelum: async () => ({
      berkas: berkas.name,
      barisTerbaca: dibaca.baris.length,
      akanDibuat: baru.length,
      akanDiperbarui: lama.length,
    }),
    jalankan: async () => {
      if (baru.length > 0) {
        await eksekusi(
          `INSERT INTO pegawai
             (nip, nama_lengkap, golongan, tmt_golongan, jabatan_id, tingkat_pendidikan,
              sekolah_terakhir, bidang_studi_terakhir, status_aktif)
           VALUES ${baru.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
          baru.flatMap((s) => [
            s.nip,
            s.nama,
            s.golongan,
            s.tmtGolongan,
            jabatanId.get(s.nip) ?? null,
            s.tingkatPendidikan,
            s.sekolah,
            s.bidangStudi,
            'AKTIF',
          ]),
        )
      }
      for (const s of lama) {
        /*
          Hanya field yang BERISI yang diperbarui — sel kosong tidak mengosongkan
          nilai yang sudah ada. `jabatan_id` ikut aturan itu: berkas tanpa nama
          jabatan tidak boleh melepas tautan jabatan seseorang, kekeliruan yang
          persis pernah terjadi di editor profil (`ProfilPegawai` tanpa `jabatanId`
          → menyimpan tanpa menyentuhnya mengosongkan `jabatan_id`).
        */
        const set: string[] = ['nama_lengkap = ?']
        const nilai: unknown[] = [s.nama]
        const tambah = (kolom: string, v: unknown) => {
          if (v === null || v === '') return
          set.push(`${kolom} = ?`)
          nilai.push(v)
        }
        tambah('golongan', s.golongan)
        tambah('tmt_golongan', s.tmtGolongan)
        tambah('jabatan_id', jabatanId.get(s.nip) ?? null)
        tambah('tingkat_pendidikan', s.tingkatPendidikan)
        tambah('sekolah_terakhir', s.sekolah)
        tambah('bidang_studi_terakhir', s.bidangStudi)
        nilai.push(idPerNip.get(s.nip)!)
        await eksekusi(`UPDATE pegawai SET ${set.join(', ')} WHERE id = ?`, nilai)
      }
      // Bentuk `sesudah` mengikuti `sebelum` — `jalankanMutasi()` menurunkan
      // tipenya dari sana, dan itu berguna: jejak audit yang bentuknya beda
      // sebelum/sesudah tidak bisa dibandingkan `lib/diff-audit.ts`.
      return {
        entitasId: null,
        sesudah: {
          berkas: berkas.name,
          barisTerbaca: dibaca.baris.length,
          akanDibuat: baru.length,
          akanDiperbarui: lama.length,
        },
      }
    },
  })

  revalidatePath('/talenta')
  const ringkas =
    `${baru.length} pegawai ditambahkan` +
    (lama.length > 0 ? `, ${lama.length} diperbarui` : '') +
    (masalah.length > 0 ? `, ${masalah.length} DILEWATI` : '') +
    ` dari ${dibaca.baris.length} baris terbaca di "${berkas.name}".`
  return berhasil(
    { dibuat: baru.length, diperbarui: lama.length, dilewati: masalah.length, masalah },
    `${ringkas}` +
      (masalah.length > 0
        ? ` Yang dilewati: ${masalah.slice(0, 3).join(' ')}${masalah.length > 3 ? ` (+${masalah.length - 3} lagi)` : ''}`
        : '') +
      ` Asesmen, riwayat jabatan, dan foto TIDAK ikut — jalur ini hanya identitas pegawai; pakai \`npm run impor:talentpool\` untuk berkas lengkap.`,
  )
}

// ---------------------------------------------------------------------------
// Verifikasi rekam jejak disiplin (25 Agu 2026)
// ---------------------------------------------------------------------------

/**
 * Tandai rekam jejak disiplin seorang pegawai **sudah diperiksa**.
 *
 * Permintaan pemilik proses: *"di profil Integritas & rekam jejak disiplin
 * defaultnya tanpa catatan aja dulu tapi ada ceklis buat verifikasi"*.
 *
 * ## Apa yang sebenarnya dicatat
 *
 * Bukan "pegawai ini bersih" — itu sudah jadi perlakuan bawaan mesin skor sejak
 * awal (tidak ada catatan → skor Integritas 100). Yang dicatat adalah **seseorang
 * pernah memeriksanya**, beserta kapan dan catatannya. Sebelum ini "sudah
 * diperiksa, hasilnya bersih" tidak bisa dibedakan dari "belum diperiksa", padahal
 * 15% match score bergantung pada komponen itu.
 *
 * ## Skor TIDAK bergeser karena aksi ini, dan itu disengaja
 *
 * Kalau verifikasi ikut menggeser skor, angka orang yang belum diperiksa akan
 * berubah begitu ada yang mencentangnya — perubahan yang terlihat seperti penilaian
 * ulang padahal tidak ada data baru. Yang berubah hanya apa yang **dinyatakan** di
 * profil. Kalau nanti diputuskan bahwa yang belum diverifikasi harus ditandai
 * `perlu_review`, kolom ini yang menjawabnya — dan itu keputusan pemilik proses.
 *
 * ## Bisa DIBATALKAN
 *
 * `verifikasi=false` mengosongkan ketiga kolomnya. Tanpa itu, satu klik keliru jadi
 * pernyataan permanen bahwa seseorang telah memeriksa sesuatu yang tidak ia periksa
 * — dan pernyataan itu ikut ke jejak audit atas namanya.
 */
/**
 * Pilih asesmen mana yang dipakai menilai seorang pegawai.
 *
 * Permintaan pemilik proses (`koreksi sistem informasi.pdf`, butir 2): *"Nanti
 * verifikator tinggal memasukkan datanya dan memilih mana yang digunakan."*
 *
 * Sejak `doc/sql/022`, satu pegawai bisa punya beberapa asesmen — satu per
 * JENJANG tempat ia dinilai (terukur: 31 dari 32 pegawai di berkas Fungsional
 * 2026 punya dua). Sebelum ada pilihan eksplisit, pemenangnya ditentukan
 * `id DESC` di `urutAsesmenBerlaku()`, yaitu **urutan impor** — sewenang-wenang,
 * dan tidak pernah terlihat sebagai galat.
 *
 * Skornya bergerak SEKETIKA, pola yang sama dengan `lib/aksi/hukuman-disiplin.ts`:
 * pesan yang menyuruh pengguna menjalankan Hitung Ulang untuk menyelesaikan apa
 * yang baru saja ia minta adalah pekerjaan yang belum selesai, bukan keterangan.
 * Kegagalan hitung ulang TIDAK membatalkan pilihannya — pilihannya sudah tersimpan
 * dan itu yang diminta; yang berubah cuma kalimatnya.
 */
export async function pilihAsesmenDipakai(
  pegawaiId: unknown,
  asesmenId: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_PROFIL)
  if (tolak) return tolak

  const idP = z.number().int().positive().safeParse(pegawaiId)
  if (!idP.success) return gagal('Pegawai tidak dikenali.')
  const idA = z.number().int().positive().safeParse(asesmenId)
  if (!idA.success) return gagal('Asesmen tidak dikenali.')

  const pegawai = await pegawaiTerjangkau(idP.data)
  if (pegawai === null) return gagal('Pegawai itu tidak ditemukan.')

  // `pegawai_id` ikut disaring: tanpa itu, id asesmen milik ORANG LAIN yang
  // ditebak akan tertaut ke pegawai ini — dan `asesmen_dipakai.asesmen_id`
  // UNIQUE, jadi akibatnya bukan galat melainkan pilihan orang lain yang dicuri.
  const milik = await kueriSatu<{ id: number }>(
    'SELECT id FROM asesmen_talenta WHERE id = ? AND pegawai_id = ?',
    [idA.data, idP.data],
  )
  if (milik === null) return gagal('Asesmen itu bukan milik pegawai ini.')

  const pengguna = await getCurrentUser()

  await jalankanMutasi({
    entitas: 'asesmen_dipakai',
    aksi: 'UBAH',
    peranDiizinkan: PERAN_PROFIL,
    sebelum: async () =>
      kueriSatu<Record<string, unknown>>(
        'SELECT pegawai_id, asesmen_id, ditetapkan_oleh FROM asesmen_dipakai WHERE pegawai_id = ?',
        [idP.data],
      ),
    jalankan: async () => {
      await eksekusi(
        `INSERT INTO asesmen_dipakai (pegawai_id, asesmen_id, ditetapkan_oleh, catatan)
         VALUES (?, ?, ?, NULL)
         ON DUPLICATE KEY UPDATE asesmen_id = VALUES(asesmen_id),
                                 ditetapkan_oleh = VALUES(ditetapkan_oleh),
                                 ditetapkan_pada = NOW()`,
        [idP.data, idA.data, pengguna?.id ?? null],
      )
      return {
        entitasId: idP.data,
        sesudah: { pegawai_id: idP.data, asesmen_id: idA.data, ditetapkan_oleh: pengguna?.id ?? null },
      }
    },
  })

  let pesan = `Asesmen yang dipakai untuk ${pegawai.nama} diperbarui.`
  try {
    const r = await hitungUlangSatuPegawai(idP.data)
    pesan += ` Skor ${r.jumlahTarget} jabatan target ikut dihitung ulang.`
  } catch {
    pesan += ' Skornya BELUM ikut berubah — jalankan Hitung Ulang di jabatan targetnya.'
  }

  revalidatePath(`/talenta/${pegawai.nip}`)
  revalidatePath('/peta-talenta')
  revalidatePath('/')
  return berhasil(undefined, pesan)
}

export async function tandaiHukdisDiperiksa(
  pegawaiId: unknown,
  verifikasi: unknown,
  catatan: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_PROFIL)
  if (tolak) return tolak

  const idP = z.number().int().positive().safeParse(pegawaiId)
  if (!idP.success) return gagal('Pegawai tidak dikenali.')
  const nyala = z.boolean().safeParse(verifikasi)
  if (!nyala.success) return gagal('Nilai centang tidak dikenali.')
  const uraiCatatan = z.string().trim().max(500, 'Catatan maksimal 500 karakter').nullable()
    .safeParse(catatan ?? null)
  if (!uraiCatatan.success) return gagal('Catatan maksimal 500 karakter.')

  // Lingkup diperiksa DI DALAM SQL, dan pegawai di luar lingkup dijawab sama
  // dengan pegawai yang tidak ada — "Anda tidak berhak" akan mengonfirmasi
  // keberadaan orangnya kepada yang tidak berhak tahu.
  const pegawai = await pegawaiTerjangkau(idP.data)
  if (pegawai === null) return gagal('Pegawai itu tidak ditemukan.')

  const pengguna = await getCurrentUser()

  await jalankanMutasi({
    entitas: 'pegawai',
    aksi: 'UBAH',
    peranDiizinkan: PERAN_PROFIL,
    sebelum: async () =>
      kueriSatu<Record<string, unknown>>(
        `SELECT id, hukdis_diverifikasi_oleh, hukdis_diverifikasi_pada, hukdis_catatan_verifikasi
           FROM pegawai WHERE id = ?`,
        [idP.data],
      ),
    jalankan: async () => {
      if (nyala.data) {
        await eksekusi(
          `UPDATE pegawai
              SET hukdis_diverifikasi_oleh = ?, hukdis_diverifikasi_pada = NOW(),
                  hukdis_catatan_verifikasi = ?
            WHERE id = ?`,
          [pengguna?.id ?? null, uraiCatatan.data, idP.data],
        )
      } else {
        await eksekusi(
          `UPDATE pegawai
              SET hukdis_diverifikasi_oleh = NULL, hukdis_diverifikasi_pada = NULL,
                  hukdis_catatan_verifikasi = NULL
            WHERE id = ?`,
          [idP.data],
        )
      }
      return {
        entitasId: idP.data,
        sesudah: {
          id: idP.data,
          hukdis_diverifikasi_oleh: nyala.data ? (pengguna?.id ?? null) : null,
        },
      }
    },
  })

  revalidatePath(`/talenta/${pegawai.nip}`)
  /*
    Kelengkapan data IKUT berubah — butir "Rekam jejak disiplin terverifikasi"
    (bobot 3) sekarang terpenuhi oleh ceklis ini, bukan hanya oleh adanya catatan
    hukuman (`lib/kueri/kelengkapan-sql.ts`, 25 Agu 2026). Jadi halaman yang
    memajang skornya harus ikut disegarkan; kalau tidak, angka lamanya bertahan dan
    yang terlihat adalah ceklis yang "tidak berpengaruh ke kesiapan data" — persis
    keluhan yang membuat aturannya diubah.

    Skornya sendiri DIHITUNG saat dibaca (ekspresi SQL), bukan kolom tersimpan, jadi
    tidak ada yang perlu dihitung ulang — cukup cache halamannya dibatalkan.
  */
  revalidatePath('/talenta')
  revalidatePath('/data/kelengkapan')
  return berhasil(
    undefined,
    nyala.data
      ? `Rekam jejak disiplin ${pegawai.nama} ditandai sudah diperiksa. Butir kesiapan data "Rekam jejak disiplin terverifikasi" ikut terpenuhi.`
      : `Tanda verifikasi rekam jejak disiplin ${pegawai.nama} dilepas. Butir kesiapan datanya kembali kosong.`,
  )
}

/**
 * Simpan / hapus kode CATATAN pegawai (HDS · HDB · TBTL · TBS).
 *
 * Permintaan pemilik proses 2 Sep 2026 (`2 sept- masukan sistem informasi.pdf`
 * butir 1). Kodenya dipakai apa adanya — lihat `lib/catatan-pegawai.ts` untuk
 * alasan lengkap kenapa sistem TIDAK menurunkan apa pun darinya.
 *
 * ## Kenapa TIDAK memanggil `sinkronkanSkor()`
 *
 * Ini satu-satunya jalur tulis baru di berkas ini yang dikecualikan dari aturan
 * "setiap write ikut menghitung ulang", dan alasannya harus jelas supaya
 * pengecualiannya tidak menular: kode ini **bukan masukan rubrik**. Kejadian yang
 * mungkin diwakilinya (mis. hukuman disiplin) sudah punya jalannya sendiri lewat
 * `hukuman_disiplin` → indikator Integritas & Moralitas. Kalau kode di sini ikut
 * menggeser skor, satu kejadian yang sama terhitung dua kali dan tidak ada halaman
 * yang bisa menjelaskan selisihnya.
 *
 * Dijaga `lib/aksi/sinkron-skor.test.ts` — ia menuntut pengecualian ini terdaftar
 * BESERTA alasannya, dan menolak kalau ternyata fungsinya memanggil sinkronisasi.
 *
 * `kategori === null` MENGHAPUS catatannya beserta keterangan & jejak penulisnya:
 * keterangan yang tertinggal tanpa kode akan tampil sebagai catatan tanpa sebab.
 */
export async function simpanCatatanPegawai(
  pegawaiId: unknown,
  kategori: unknown,
  keterangan: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_PROFIL)
  if (tolak) return tolak

  const idP = z.number().int().positive().safeParse(pegawaiId)
  if (!idP.success) return gagal('Pegawai tidak dikenali.')

  const uraiKategori = z
    .union([z.enum(KATEGORI_CATATAN), z.null()])
    .safeParse(kategori === '' ? null : (kategori ?? null))
  if (!uraiKategori.success) {
    return gagal(`Kode catatan harus salah satu dari ${KATEGORI_CATATAN.join(', ')}.`)
  }

  const uraiKeterangan = z
    .string()
    .trim()
    .max(MAKS_KETERANGAN_CATATAN)
    .nullable()
    .safeParse(keterangan === '' ? null : (keterangan ?? null))
  if (!uraiKeterangan.success) {
    return gagal(`Keterangan maksimal ${MAKS_KETERANGAN_CATATAN} karakter.`)
  }

  // Lingkup diperiksa DI DALAM SQL; pegawai di luar lingkup dijawab sama dengan
  // pegawai yang tidak ada.
  const pegawai = await pegawaiTerjangkau(idP.data)
  if (pegawai === null) return gagal('Pegawai itu tidak ditemukan.')

  const pengguna = await getCurrentUser()
  const hapus = uraiKategori.data === null

  await jalankanMutasi({
    entitas: 'pegawai',
    aksi: 'UBAH',
    peranDiizinkan: PERAN_PROFIL,
    sebelum: async () =>
      kueriSatu<Record<string, unknown>>(
        `SELECT id, catatan_kategori, catatan_keterangan, catatan_oleh, catatan_pada
           FROM pegawai WHERE id = ?`,
        [idP.data],
      ),
    jalankan: async () => {
      if (hapus) {
        await eksekusi(
          `UPDATE pegawai
              SET catatan_kategori = NULL, catatan_keterangan = NULL,
                  catatan_oleh = NULL, catatan_pada = NULL
            WHERE id = ?`,
          [idP.data],
        )
      } else {
        await eksekusi(
          `UPDATE pegawai
              SET catatan_kategori = ?, catatan_keterangan = ?,
                  catatan_oleh = ?, catatan_pada = NOW()
            WHERE id = ?`,
          [uraiKategori.data, uraiKeterangan.data, pengguna?.id ?? null, idP.data],
        )
      }
      return {
        entitasId: idP.data,
        sesudah: {
          id: idP.data,
          catatan_kategori: uraiKategori.data,
          catatan_keterangan: hapus ? null : uraiKeterangan.data,
        },
      }
    },
  })

  /*
    Ketiga halaman ini memajang penandanya, jadi ketiganya harus ikut disegarkan —
    direktori & daftar kandidat justru TEMPAT penandanya diminta muncul (highlight
    kuning), dan cache yang tidak dibatalkan membuat kode yang baru diisi tidak
    terlihat di sana sampai halamannya kedaluwarsa sendiri.
  */
  revalidatePath(`/talenta/${pegawai.nip}`)
  revalidatePath('/talenta')
  revalidatePath('/jabatan-target', 'layout')

  return berhasil(
    undefined,
    hapus
      ? `Catatan ${pegawai.nama} dihapus — penandanya hilang dari direktori & daftar kandidat.`
      : `Catatan ${pegawai.nama} disimpan: ${uraiKategori.data}. Namanya kini ditandai di direktori pegawai & daftar kandidat.`,
  )
}
