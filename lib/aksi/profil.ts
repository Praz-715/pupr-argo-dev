'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { ambangSumbuDari, ambilPengaturan } from '../pengaturan'
import { jalankanMutasi } from '../audit'
import { getCurrentUser } from '../auth'
import { eksekusi, kueri, kueriSatu } from '../db'
import { normalisasiAsesmen, normalisasiTanggal } from '../importer/normalisasi-baris'
import { lingkupData, tanpaAkses, unitWajib } from '../lingkup'
import { gerbangPeran } from './gerbang'
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

/**
 * Pastikan pegawainya ada DAN terjangkau lingkup unit pengguna.
 *
 * Dikerjakan **di dalam SQL**, bukan dengan membaca barisnya lalu memeriksa
 * unitnya di JavaScript: yang tidak pernah terambil tidak bisa bocor lewat log
 * atau prop komponen. Alasan yang sama dengan `unitWajib` di `lib/kueri`.
 */
async function pegawaiTerjangkau(
  pegawaiId: number,
): Promise<{ id: number; nip: string; nama: string } | null> {
  const pengguna = await getCurrentUser()
  const lingkup = lingkupData(pengguna)
  if (tanpaAkses(lingkup)) return null

  const unit = unitWajib(lingkup)
  const batas =
    unit === null
      ? ''
      : ` AND j.unit_organisasi_id IN (
           WITH RECURSIVE turunan AS (
             SELECT id FROM unit_organisasi WHERE id = ?
             UNION ALL
             SELECT u.id FROM unit_organisasi u JOIN turunan t ON u.parent_id = t.id
           ) SELECT id FROM turunan
         )`

  return kueriSatu<{ id: number; nip: string; nama: string }>(
    `SELECT p.id, p.nip, p.nama_lengkap AS nama
       FROM pegawai p
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
      WHERE p.id = ?${batas}`,
    unit === null ? [pegawaiId] : [pegawaiId, unit],
  )
}

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
    return berhasil(undefined, `Identitas ${d.namaLengkap} disimpan.`)
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
    return berhasil(
      { id: hasil.entitasId ?? 0 },
      `Riwayat pendidikan ${d.jenjangPendidikan.replace('_', '/')} ${d.bidangStudi} disimpan.`,
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
                    unit_kerja_mentah = ?, tanggal_mulai = ?, tanggal_akhir = ?, no_sk = ?
              WHERE id = ?`,
            [
              d.jabatanNamaMentah,
              d.jabatanId,
              d.jenisPenugasan,
              d.unitKerjaMentah,
              d.tanggalMulai,
              d.tanggalAkhir,
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
              unit_kerja_mentah, tanggal_mulai, tanggal_akhir, no_sk)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            d.pegawaiId,
            Number(maks?.n ?? 0) + 1,
            d.jabatanNamaMentah,
            d.jabatanId,
            d.jenisPenugasan,
            d.unitKerjaMentah,
            d.tanggalMulai,
            d.tanggalAkhir,
            d.noSk,
          ],
        )
        return { entitasId: insertId, sesudah: await bacaRiwayatJabatan(insertId) }
      },
    })

    segarkan(pegawai.nip)
    // Riwayat jabatan adalah bahan indikator Lama Jabatan, Keragaman Jabatan,
    // dan Substansi Riwayat Jabatan — skor tersimpan jadi basi sampai dihitung
    // ulang. Kalimatnya menyebutkannya, bukan membiarkan orang mengira skornya
    // sudah menyesuaikan sendiri.
    return berhasil(
      { id: hasil.entitasId ?? 0 },
      'Riwayat jabatan disimpan. Match score belum berubah — jalankan Hitung Ulang pada jabatan target terkait.',
    )
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
    // Diklat baru belum punya baris di `pemetaan_diklat`, jadi ia belum
    // berkontribusi ke indikator Pengembangan Kompetensi sampai dipetakan &
    // divalidasi. Menyembunyikan itu berarti orang menunggu skor naik dan
    // menyimpulkan fiturnya rusak.
    return berhasil(
      undefined,
      d.indeks === null
        ? `"${d.nama}" ditambahkan. Agar dihitung dalam skor, petakan kategorinya di Validasi Riwayat.`
        : 'Nama diklat diperbarui.',
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
    return berhasil({ id: hasil.entitasId ?? 0 }, `Kinerja ${d.periodeSkp} ${d.tahun} disimpan.`)
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
    { tahunSekarang: new Date().getFullYear(), ambang: ambangSumbuDari(await ambilPengaturan()) },
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
                SET tahun_asesmen = ?, jenis_asesmen = ?, status_asesmen = ?, nilai_kinerja_y = ?,
                    nilai_potensial_x = ?, potkom = ?, nilai_integritas = ?, nilai_talenta = ?,
                    kotak_9 = ?, tahun_kinerja = ?, rating_kinerja = ?, sumber_sync = 'manual'
              WHERE id = ?`,
            [
              a.tahunAsesmen,
              a.jenisAsesmen,
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
             (pegawai_id, tahun_asesmen, jenis_asesmen, status_asesmen, nilai_kinerja_y,
              nilai_potensial_x, potkom, nilai_integritas, nilai_talenta, kotak_9,
              tahun_kinerja, rating_kinerja, sumber_sync)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
          [
            d.pegawaiId,
            a.tahunAsesmen,
            a.jenisAsesmen,
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
    return berhasil(
      { id: hasil.entitasId ?? 0 },
      `Asesmen ${a.tahunAsesmen} disimpan — Kotak ${a.kotak9} (dihitung dari Kinerja ${a.nilaiKinerjaY} × Potensial ${a.nilaiPotensialX}).${catatan}` +
        ' Match score belum berubah — jalankan Hitung Ulang.',
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

/**
 * Jabatan tujuan harus BERADA DI DALAM lingkup unit pengguna.
 *
 * Tanpa ini, Pengelola Unit bisa menciptakan pegawai pada jabatan unit lain —
 * dan sesudah tercipta ia tidak akan bisa melihatnya lagi (halaman profil
 * menyaring per unit), sehingga barisnya menjadi data hantu: ada di DB, tak
 * terjangkau pembuatnya, dan tak diketahui unit yang sebenarnya memilikinya.
 * `null` = jabatan tidak ada ATAU di luar lingkup; keduanya dijawab sama supaya
 * jawabannya tidak jadi cara menebak isi unit lain.
 */
async function jabatanTerjangkau(jabatanId: number): Promise<{ id: number } | null> {
  const lingkup = lingkupData(await getCurrentUser())
  if (tanpaAkses(lingkup)) return null
  const batas = unitWajib(lingkup)
  if (batas === null || batas === undefined) {
    return kueriSatu<{ id: number }>(`SELECT id FROM jabatan WHERE id = ?`, [jabatanId])
  }
  return kueriSatu<{ id: number }>(
    `SELECT j.id FROM jabatan j
      WHERE j.id = ?
        AND j.unit_organisasi_id IN (
          WITH RECURSIVE turunan (id) AS (
            SELECT id FROM unit_organisasi WHERE id = ?
            UNION ALL
            SELECT u.id FROM unit_organisasi u JOIN turunan t ON u.parent_id = t.id
          )
          SELECT id FROM turunan
        )`,
    [jabatanId, batas],
  )
}

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
