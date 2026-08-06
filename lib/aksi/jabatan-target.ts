'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { jalankanMutasi } from '../audit'
import { eksekusi, kueri, kueriSatu } from '../db'
import { ambilPohonRubrik } from '../kueri/rubrik'
import { validasiRubrik } from '../scoring'
import { gerbangPeran } from './gerbang'
import { berhasil, gagal, galatDariZod, pesanDariGalatDb, type HasilAksi } from './hasil'

/**
 * Mutasi Jabatan Target (PRD §6.5). Admin Talenta & Super Admin.
 *
 * Aturan yang ditegakkan di sini, bukan di form:
 *   - **Aktivasi menuntut rubrik yang lolos validasi.** Rubrik aktif dipakai
 *     menilai orang; mengaktifkan rubrik bercacat berarti menghasilkan peringkat
 *     yang salah tanpa ada tanda apa pun di angkanya (`lib/scoring/validasi.ts`).
 *   - **Jabatan target yang skornya sudah dipakai talent pool tidak dihapus,
 *     tapi dinonaktifkan** — sama seperti perlakuan jabatan & catatan disiplin di
 *     Fase 4. Menghapusnya akan meruntuhkan nominasi & approval yang menunjuk ke
 *     entri pool-nya lewat `ON DELETE CASCADE`.
 */

const PERAN_JABATAN_TARGET = ['Super Admin', 'Admin Talenta'] as const

const SkemaTarget = z.object({
  kodeTarget: z
    .string()
    .trim()
    .min(3, 'Kode target minimal 3 karakter')
    .max(40, 'Kode target maksimal 40 karakter')
    .regex(/^[A-Za-z0-9._/-]+$/, 'Kode target hanya boleh huruf, angka, titik, garis, dan garis miring'),
  namaTarget: z
    .string()
    .trim()
    .min(5, 'Nama jabatan target minimal 5 karakter')
    .max(250, 'Nama jabatan target maksimal 250 karakter'),
  deskripsi: z.string().trim().max(2000, 'Deskripsi maksimal 2.000 karakter').nullable(),
})

export type MasukanTarget = z.infer<typeof SkemaTarget>

const idPositif = z.number().int().positive()

async function bacaTarget(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, kode_target, nama_target, deskripsi, status, kata_kunci_relevansi
     FROM jabatan_target WHERE id = ?`,
    [id],
  )
}

function segarkan(id?: number): void {
  revalidatePath('/jabatan-target')
  if (id !== undefined) {
    revalidatePath(`/jabatan-target/${id}`)
    revalidatePath(`/jabatan-target/${id}/kandidat`)
    revalidatePath(`/jabatan-target/${id}/simulasi`)
  }
}

export async function buatJabatanTarget(
  masukan: unknown,
): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_JABATAN_TARGET)
  if (tolak) return tolak

  const urai = SkemaTarget.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  try {
    const hasil = await jalankanMutasi({
      entitas: 'jabatan_target',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_JABATAN_TARGET,
      jalankan: async () => {
        // Selalu lahir DRAFT: jabatan target tanpa rubrik & anggota belum bisa
        // menilai siapa pun, jadi status AKTIF pada saat dibuat akan berbohong.
        // `kata_kunci_relevansi` lahir kosong dan **hanya** ditulis lewat tab
        // Persyaratan (Fase 11 no. 3). Form profil ini mengurus identitas jabatan
        // target — kode, nama, deskripsi — bukan syaratnya; dua form yang bisa
        // menulis satu kolom adalah cara kolom itu berselisih dengan dirinya.
        const { insertId } = await eksekusi(
          `INSERT INTO jabatan_target (kode_target, nama_target, deskripsi, kata_kunci_relevansi, status)
           VALUES (?, ?, ?, JSON_ARRAY(), 'DRAFT')`,
          [d.kodeTarget, d.namaTarget, d.deskripsi],
        )
        return { entitasId: insertId, sesudah: { id: insertId, ...d, status: 'DRAFT' } }
      },
    })
    segarkan(hasil.entitasId ?? undefined)
    return berhasil(
      { id: hasil.entitasId ?? 0 },
      `Jabatan target "${d.namaTarget}" dibuat sebagai draft.`,
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Kode target "${d.kodeTarget}"` })
    if (pesan) return gagal(pesan, { kodeTarget: pesan })
    throw e
  }
}

/**
 * Buat jabatan target DRAFT dari sebuah jabatan kosong (Fase 11 no. 2, U-14).
 *
 * Lahir dari lubang yang baru terlihat setelah Peta Talenta bisa disaring per
 * jabatan target: `pupr_dev` punya **6 jabatan KOSONG tapi hanya 2** yang jadi
 * anggota sebuah target, sehingga empat sisanya tidak bisa dinilai sama sekali —
 * dan tidak ada satu tempat pun yang menyatakan itu sebagai pekerjaan.
 *
 * Tidak menambah kolom apa pun: hasilnya satu baris `jabatan_target` berstatus
 * DRAFT + satu `jabatan_target_anggota`. Relasi "target ini lahir dari jabatan
 * itu" sudah terwakili oleh keanggotaannya, jadi kolom asal-usul akan jadi
 * definisi kedua yang bisa berselisih.
 *
 * Kode & nama diturunkan dari jabatannya, bukan diminta ke pengguna: satu klik
 * dari daftar kekosongan gunanya justru menghilangkan langkah mengisi form.
 * Keduanya tetap bisa disunting sesudahnya dari Editor Jabatan Target — DRAFT
 * memang untuk itu.
 */
export async function buatTargetDariJabatan(
  jabatanId: unknown,
): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_JABATAN_TARGET)
  if (tolak) return tolak

  const idJabatan = idPositif.safeParse(jabatanId)
  if (!idJabatan.success) return gagal('Pilihan jabatan tidak dikenali.')

  const jabatan = await kueriSatu<{
    kode_jabatan: string
    nama_jabatan: string
    status_jabatan: string
    nama_target_ada: string | null
  }>(
    `SELECT j.kode_jabatan, j.nama_jabatan, j.status_jabatan,
            (SELECT t.nama_target FROM jabatan_target_anggota a
               JOIN jabatan_target t ON t.id = a.jabatan_target_id
              WHERE a.jabatan_id = j.id LIMIT 1) AS nama_target_ada
       FROM jabatan j WHERE j.id = ?`,
    [idJabatan.data],
  )
  if (jabatan === null) return gagal('Jabatan itu tidak ada. Muat ulang halaman lalu coba lagi.')
  if (jabatan.status_jabatan === 'DIHAPUS') {
    return gagal(`"${jabatan.nama_jabatan}" sudah diarsipkan di master jabatan.`)
  }
  // Ditolak walaupun tombolnya memang hanya tampil untuk jabatan tanpa target —
  // halaman bisa basi, dan membuat target kedua untuk jabatan yang sama berarti
  // dua rubrik menilai orang untuk posisi yang sama tanpa ada yang tahu mana
  // yang berlaku.
  if (jabatan.nama_target_ada !== null) {
    return gagal(
      `"${jabatan.nama_jabatan}" sudah termasuk jabatan target "${jabatan.nama_target_ada}". Sunting yang itu alih-alih membuat draft kedua.`,
    )
  }

  const kodeTarget = `JT-${jabatan.kode_jabatan}`.slice(0, 40)
  const namaTarget = jabatan.nama_jabatan.slice(0, 250)

  try {
    const hasil = await jalankanMutasi({
      entitas: 'jabatan_target',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_JABATAN_TARGET,
      jalankan: async () => {
        const { insertId } = await eksekusi(
          `INSERT INTO jabatan_target (kode_target, nama_target, deskripsi, kata_kunci_relevansi, status)
           VALUES (?, ?, ?, JSON_ARRAY(), 'DRAFT')`,
          [
            kodeTarget,
            namaTarget,
            `Dibuat dari jabatan kosong ${jabatan.kode_jabatan}. Lengkapi persyaratan & rubrik sebelum diaktifkan.`,
          ],
        )
        // Satu mutasi, dua baris. Kalau keanggotaannya dipisah jadi aksi kedua,
        // kegagalan di tengah meninggalkan jabatan target tanpa anggota — yang
        // tampil sebagai draft kosong tanpa petunjuk asal-usulnya.
        await eksekusi(
          `INSERT INTO jabatan_target_anggota (jabatan_target_id, jabatan_id) VALUES (?, ?)`,
          [insertId, idJabatan.data],
        )
        return {
          entitasId: insertId,
          sesudah: {
            id: insertId,
            kodeTarget,
            namaTarget,
            status: 'DRAFT',
            dariJabatanId: idJabatan.data,
          },
        }
      },
    })
    segarkan(hasil.entitasId ?? undefined)
    revalidatePath('/jabatan-target')
    return berhasil(
      { id: hasil.entitasId ?? 0 },
      `Draft jabatan target "${namaTarget}" dibuat. Lengkapi persyaratan & rubriknya, lalu aktifkan.`,
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Kode target "${kodeTarget}"` })
    if (pesan) return gagal(pesan)
    throw e
  }
}

export async function ubahJabatanTarget(
  id: unknown,
  masukan: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_JABATAN_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(id)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')

  const urai = SkemaTarget.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  try {
    await jalankanMutasi({
      entitas: 'jabatan_target',
      aksi: 'UBAH',
      peranDiizinkan: PERAN_JABATAN_TARGET,
      sebelum: () => bacaTarget(idTarget.data),
      jalankan: async () => {
        // `kata_kunci_relevansi` SENGAJA tidak ada di sini — satu-satunya jalur
        // tulisnya adalah syarat BIDANG_ILMU di tab Persyaratan (Fase 11 no. 3).
        // Selama form ini juga bisa menulisnya, menyunting profil akan menimpa
        // deklarasi syarat tanpa menyebutnya, dan skor bergeser karena tindakan
        // yang kelihatannya cuma mengganti nama.
        await eksekusi(
          `UPDATE jabatan_target SET kode_target = ?, nama_target = ?, deskripsi = ? WHERE id = ?`,
          [d.kodeTarget, d.namaTarget, d.deskripsi, idTarget.data],
        )
        return { entitasId: idTarget.data, sesudah: { id: idTarget.data, ...d } }
      },
    })
    segarkan(idTarget.data)
    return berhasil(
      undefined,
      'Profil jabatan target disimpan. Bidang ilmu & syarat lain diubah dari tab Persyaratan.',
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Kode target "${d.kodeTarget}"` })
    if (pesan) return gagal(pesan, { kodeTarget: pesan })
    throw e
  }
}

/**
 * Ubah status jabatan target.
 *
 * Aktivasi diperiksa lebih dulu terhadap validasi rubrik & kelengkapan anggota.
 * Penolakannya menyebut **temuan pertamanya beserta angkanya**, bukan "rubrik
 * tidak valid" — pengguna harus tahu apa yang mesti dibetulkan tanpa menebak.
 */
export async function ubahStatusJabatanTarget(
  id: unknown,
  status: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_JABATAN_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(id)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')

  const uraiStatus = z.enum(['DRAFT', 'AKTIF', 'NONAKTIF']).safeParse(status)
  if (!uraiStatus.success) return gagal('Status tidak dikenali.')
  const statusBaru = uraiStatus.data

  if (statusBaru === 'AKTIF') {
    const halangan = await halanganAktivasi(idTarget.data)
    if (halangan !== null) return gagal(halangan)
  }

  await jalankanMutasi({
    entitas: 'jabatan_target',
    aksi: 'UBAH_STATUS',
    peranDiizinkan: PERAN_JABATAN_TARGET,
    sebelum: () => bacaTarget(idTarget.data),
    jalankan: async () => {
      await eksekusi(`UPDATE jabatan_target SET status = ? WHERE id = ?`, [
        statusBaru,
        idTarget.data,
      ])
      return { entitasId: idTarget.data, sesudah: { id: idTarget.data, status: statusBaru } }
    },
  })

  segarkan(idTarget.data)
  const pesan =
    statusBaru === 'AKTIF'
      ? 'Jabatan target diaktifkan. Rubriknya lolos seluruh pemeriksaan.'
      : statusBaru === 'NONAKTIF'
        ? 'Jabatan target dinonaktifkan. Skor & talent pool yang sudah ada tetap tersimpan.'
        : 'Jabatan target dikembalikan ke draft.'
  return berhasil(undefined, pesan)
}

/** null = boleh diaktifkan. Selain itu: alasan penolakan yang bisa ditindak. */
async function halanganAktivasi(jabatanTargetId: number): Promise<string | null> {
  const [komponen, hitung] = await Promise.all([
    ambilPohonRubrik(jabatanTargetId),
    kueriSatu<{ anggota: number; syarat: number }>(
      `SELECT
         (SELECT COUNT(*) FROM jabatan_target_anggota WHERE jabatan_target_id = ?) AS anggota,
         (SELECT COUNT(*) FROM jabatan_target_persyaratan WHERE jabatan_target_id = ?) AS syarat`,
      [jabatanTargetId, jabatanTargetId],
    ),
  ])

  if (Number(hitung?.anggota ?? 0) === 0) {
    return 'Belum ada jabatan anggota. Tanpa itu, jabatan target ini tidak menunjuk posisi mana pun — tambahkan minimal satu jabatan di tab Jabatan Anggota.'
  }

  const hasil = validasiRubrik(komponen, { untukJabatanTarget: true })
  if (!hasil.bisaDiaktifkan) {
    const pertama = hasil.temuan.find((t) => t.tingkat === 'GALAT')
    return `Rubrik masih punya ${hasil.jumlahGalat} galat sehingga skornya akan salah. Yang pertama: ${pertama?.nama} — ${pertama?.pesan} ${pertama?.saran}`
  }

  return null
}

/**
 * Hapus jabatan target; diarsipkan (NONAKTIF) kalau skornya sudah dipakai.
 *
 * `talent_pool` menunjuk jabatan target dengan `ON DELETE CASCADE`, dan
 * `nominasi` menunjuk `talent_pool` dengan cascade juga — jadi menghapus satu
 * jabatan target bisa menghapus rantai nominasi & approval tanpa peringatan.
 */
export async function hapusJabatanTarget(id: unknown): Promise<HasilAksi<{ diarsipkan: boolean }>> {
  const tolak = await gerbangPeran(PERAN_JABATAN_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(id)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')

  const pakai = await kueriSatu<{ pool: number; skor: number; nominasi: number }>(
    `SELECT
       (SELECT COUNT(*) FROM talent_pool WHERE jabatan_target_id = ?) AS pool,
       (SELECT COUNT(*) FROM match_score WHERE jabatan_target_id = ?) AS skor,
       (SELECT COUNT(*) FROM nominasi n JOIN talent_pool tp ON tp.id = n.talent_pool_id
          WHERE tp.jabatan_target_id = ?) AS nominasi`,
    [idTarget.data, idTarget.data, idTarget.data],
  )
  const pool = Number(pakai?.pool ?? 0)
  const skor = Number(pakai?.skor ?? 0)
  const nominasi = Number(pakai?.nominasi ?? 0)

  const arsipkan = pool > 0 || nominasi > 0

  await jalankanMutasi({
    entitas: 'jabatan_target',
    aksi: arsipkan ? 'UBAH_STATUS' : 'HAPUS',
    peranDiizinkan: PERAN_JABATAN_TARGET,
    sebelum: () => bacaTarget(idTarget.data),
    jalankan: async () => {
      if (arsipkan) {
        await eksekusi(`UPDATE jabatan_target SET status = 'NONAKTIF' WHERE id = ?`, [idTarget.data])
      } else {
        await eksekusi(`DELETE FROM jabatan_target WHERE id = ?`, [idTarget.data])
      }
      return {
        entitasId: idTarget.data,
        sesudah: arsipkan ? { id: idTarget.data, status: 'NONAKTIF' } : null,
      }
    },
  })

  segarkan(idTarget.data)
  return berhasil(
    { diarsipkan: arsipkan },
    arsipkan
      ? `Dinonaktifkan, bukan dihapus: masih dipakai ${pool} entri talent pool${nominasi > 0 ? ` dan ${nominasi} nominasi` : ''}. Menghapusnya akan ikut menghapus riwayat nominasi & persetujuannya.`
      : `Jabatan target dihapus${skor > 0 ? ` beserta ${skor} baris skor yang belum dipakai pool` : ''}.`,
  )
}

// ---------------------------------------------------------------------------
// Tab 1 — Jabatan Anggota
// ---------------------------------------------------------------------------

export async function tambahAnggotaJabatan(
  jabatanTargetId: unknown,
  jabatanId: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_JABATAN_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  const idJabatan = idPositif.safeParse(jabatanId)
  if (!idTarget.success || !idJabatan.success) return gagal('Pilihan jabatan tidak dikenali.')

  const jabatan = await kueriSatu<{ nama_jabatan: string; status_jabatan: string }>(
    `SELECT nama_jabatan, status_jabatan FROM jabatan WHERE id = ?`,
    [idJabatan.data],
  )
  if (jabatan === null) return gagal('Jabatan itu tidak ada. Muat ulang halaman lalu coba lagi.')
  if (jabatan.status_jabatan === 'DIHAPUS') {
    return gagal(
      `"${jabatan.nama_jabatan}" sudah diarsipkan di master jabatan, jadi tidak bisa dijadikan jabatan target.`,
    )
  }

  try {
    await jalankanMutasi({
      entitas: 'jabatan_target_anggota',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_JABATAN_TARGET,
      jalankan: async () => {
        await eksekusi(
          `INSERT INTO jabatan_target_anggota (jabatan_target_id, jabatan_id) VALUES (?, ?)`,
          [idTarget.data, idJabatan.data],
        )
        return {
          entitasId: idTarget.data,
          sesudah: { jabatanTargetId: idTarget.data, jabatanId: idJabatan.data },
        }
      },
    })
    segarkan(idTarget.data)
    return berhasil(undefined, `"${jabatan.nama_jabatan}" ditambahkan sebagai jabatan anggota.`)
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Jabatan "${jabatan.nama_jabatan}"` })
    if (pesan) return gagal(pesan)
    throw e
  }
}

export async function hapusAnggotaJabatan(
  jabatanTargetId: unknown,
  jabatanId: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_JABATAN_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  const idJabatan = idPositif.safeParse(jabatanId)
  if (!idTarget.success || !idJabatan.success) return gagal('Pilihan jabatan tidak dikenali.')

  const sisa = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM jabatan_target_anggota WHERE jabatan_target_id = ?`,
    [idTarget.data],
  )
  const status = await kueriSatu<{ status: string }>(
    `SELECT status FROM jabatan_target WHERE id = ?`,
    [idTarget.data],
  )
  // Jabatan target AKTIF tanpa anggota tidak menunjuk posisi apa pun, padahal
  // skornya tetap muncul di talent pool. Dihalangi di sini, bukan dibiarkan
  // lalu ditemukan sebagai daftar kandidat untuk jabatan yang tidak ada.
  if (Number(sisa?.n ?? 0) <= 1 && status?.status === 'AKTIF') {
    return gagal(
      'Ini satu-satunya jabatan anggota dan jabatan targetnya sedang AKTIF. Tambahkan jabatan lain lebih dulu, atau nonaktifkan jabatan targetnya.',
    )
  }

  await jalankanMutasi({
    entitas: 'jabatan_target_anggota',
    aksi: 'HAPUS',
    peranDiizinkan: PERAN_JABATAN_TARGET,
    sebelum: () =>
      kueriSatu(
        `SELECT jabatan_target_id, jabatan_id FROM jabatan_target_anggota
         WHERE jabatan_target_id = ? AND jabatan_id = ?`,
        [idTarget.data, idJabatan.data],
      ),
    jalankan: async () => {
      await eksekusi(
        `DELETE FROM jabatan_target_anggota WHERE jabatan_target_id = ? AND jabatan_id = ?`,
        [idTarget.data, idJabatan.data],
      )
      return { entitasId: idTarget.data, sesudah: null }
    },
  })

  segarkan(idTarget.data)
  return berhasil(undefined, 'Jabatan anggota dilepas.')
}

// ---------------------------------------------------------------------------
// Tab 2 — Persyaratan
// ---------------------------------------------------------------------------

const JENIS_SYARAT = ['PENDIDIKAN_MIN', 'BIDANG_ILMU', 'PENGALAMAN_MIN', 'LAINNYA'] as const

const SkemaSyarat = z.object({
  jenisSyarat: z.enum(JENIS_SYARAT),
  deskripsi: z
    .string()
    .trim()
    .min(5, 'Deskripsi syarat minimal 5 karakter')
    .max(1000, 'Deskripsi syarat maksimal 1.000 karakter'),
  /**
   * Bentuk `nilaiMinimal` menentukan apakah syaratnya bisa diperiksa mesin.
   * Kosong = sah, tapi kandidat akan ditandai PERLU_VERIFIKASI_MANUAL — bukan
   * lolos, bukan gagal (`lib/scoring/eligibility.ts`).
   */
  nilaiMinimal: z.string().trim().max(60, 'Nilai minimal maksimal 60 karakter').nullable(),
})

export type MasukanSyarat = z.infer<typeof SkemaSyarat>

const TINGKAT_PENDIDIKAN = ['SLTA', 'D3', 'S1_D4', 'S2', 'S3'] as const

/** Bentuk `nilaiMinimal` yang bisa dibaca mesin, per jenis syarat. */
function periksaNilaiMinimal(d: MasukanSyarat): string | null {
  const nilai = (d.nilaiMinimal ?? '').trim()
  if (nilai === '') return null

  if (d.jenisSyarat === 'PENDIDIKAN_MIN' && !TINGKAT_PENDIDIKAN.includes(nilai as never)) {
    return `Untuk pendidikan minimal, isi salah satu: ${TINGKAT_PENDIDIKAN.join(' · ')}. Nilai lain tidak bisa diperiksa otomatis.`
  }
  if (d.jenisSyarat === 'PENGALAMAN_MIN') {
    const eselon = ['I', 'II', 'III', 'IV', 'NON_ESELON']
    if (!eselon.includes(nilai.toUpperCase()) && Number.isNaN(Number(nilai))) {
      return `Untuk pengalaman minimal, isi eselon (${eselon.join(' · ')}) atau jumlah tahun berupa angka.`
    }
  }
  return null
}

/**
 * Pecah daftar bidang ilmu dari satu teks berkoma.
 *
 * Satu definisi untuk dua penyimpanan — lihat catatan di `simpanPersyaratan()`.
 * Dinormalisasi (trim, huruf kecil, buang duplikat) supaya `"Teknik, teknik "`
 * tidak tersimpan sebagai dua kata kunci yang mesin anggap berbeda.
 */
function pecahBidangIlmu(nilai: string): string[] {
  const hasil: string[] = []
  for (const bagian of nilai.split(',')) {
    const k = bagian.trim().toLowerCase()
    if (k !== '' && !hasil.includes(k)) hasil.push(k)
  }
  return hasil
}

/**
 * Simpan satu persyaratan jabatan target.
 *
 * **Untuk `BIDANG_ILMU`, aksi ini juga menulis `jabatan_target.kata_kunci_relevansi`
 * — dan itu inti Fase 11 no. 3 (U-15).**
 *
 * Sebelum ini, "bidang ilmu apa yang dianggap sesuai" dideklarasikan di **dua**
 * tempat dengan dua jalur tulis: baris persyaratan `BIDANG_ILMU` (dibaca gerbang
 * kelayakan, `lib/scoring/eligibility.ts`) dan kolom `kata_kunci_relevansi`
 * (dibaca indikator rubrik Kesesuaian Bidang Ilmu, `lib/penilaian.ts`). Keduanya
 * menyimpan **informasi yang sama** — daftar kata kunci, dengan `"semua"`
 * bermakna sama di keduanya — hanya berbeda format.
 *
 * Akibatnya sudah terjadi, bukan diperkirakan: di `pupr_dev` target 3 menyimpan
 * 3 kata kunci di gerbang tapi **5** di rubrik, dan target 1–2 masih menyimpan
 * kata *diklat* (`ppbj`, `kepemimpinan`) di daftar bidang ilmu — sisa sebelum
 * `doc/sql/015` memindahkan syarat diklat ke tabelnya sendiri. Dua jalur tulis
 * berarti menyunting salah satunya menggeser skor **atau** kelayakan, tapi tidak
 * pernah keduanya, dan tidak ada apa pun yang menunjukkan mana yang tertinggal.
 *
 * Yang **tidak** dilebur: fungsinya. Gerbang menjawab "lolos syarat atau tidak",
 * rubrik menjawab "berapa poin" — dan pemisahan itu memikul beban nyata berupa
 * **inversi**: di dev ada kandidat yang tidak lolos syarat tapi skornya di atas
 * kandidat yang lolos (Yuliana Wijaya 90,88, eselon tertinggi NON_ESELON). Kalau
 * syarat dilebur jadi indikator rubrik, ketidaklolosan akan menekan skornya
 * sendiri dan inversi seperti itu tidak mungkin lagi ada — dijaga dua pemeriksaan
 * di `scripts/verifikasi-data.ts`.
 */
export async function simpanPersyaratan(
  jabatanTargetId: unknown,
  persyaratanId: unknown,
  masukan: unknown,
): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_JABATAN_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')
  const idSyarat = persyaratanId === null ? null : idPositif.safeParse(persyaratanId)
  if (idSyarat !== null && !idSyarat.success) return gagal('Persyaratan tidak dikenali.')

  const urai = SkemaSyarat.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const galatNilai = periksaNilaiMinimal(d)
  if (galatNilai !== null) return gagal(galatNilai, { nilaiMinimal: galatNilai })

  // Satu daftar, dua penyimpanan. Diturunkan di sini — bukan di dua pemanggil —
  // supaya tidak mungkin ada jalur yang menulis salah satunya saja.
  const bidangIlmu = d.jenisSyarat === 'BIDANG_ILMU' ? pecahBidangIlmu(d.nilaiMinimal ?? '') : null

  const hasil = await jalankanMutasi({
    entitas: 'jabatan_target_persyaratan',
    aksi: idSyarat === null ? 'BUAT' : 'UBAH',
    peranDiizinkan: PERAN_JABATAN_TARGET,
    sebelum:
      idSyarat === null
        ? undefined
        : () =>
            kueriSatu(
              `SELECT p.id, p.jenis_syarat, p.deskripsi, p.nilai_minimal,
                      (SELECT t.kata_kunci_relevansi FROM jabatan_target t WHERE t.id = p.jabatan_target_id)
                        AS kata_kunci_relevansi
                 FROM jabatan_target_persyaratan p WHERE p.id = ?`,
              [idSyarat.data],
            ),
    jalankan: async () => {
      // Ditulis di dalam mutasi yang sama, bukan sesudahnya: kalau yang kedua
      // gagal sementara yang pertama sudah masuk, kedua penyimpanan berselisih —
      // keadaan yang justru sedang dihapuskan oleh aksi ini.
      if (bidangIlmu !== null) {
        await eksekusi(`UPDATE jabatan_target SET kata_kunci_relevansi = ? WHERE id = ?`, [
          JSON.stringify(bidangIlmu),
          idTarget.data,
        ])
      }

      if (idSyarat === null) {
        const { insertId } = await eksekusi(
          `INSERT INTO jabatan_target_persyaratan (jabatan_target_id, jenis_syarat, deskripsi, nilai_minimal)
           VALUES (?, ?, ?, ?)`,
          [idTarget.data, d.jenisSyarat, d.deskripsi, d.nilaiMinimal || null],
        )
        return { entitasId: insertId, sesudah: { id: insertId, ...d, kataKunciRelevansi: bidangIlmu } }
      }
      await eksekusi(
        `UPDATE jabatan_target_persyaratan SET jenis_syarat = ?, deskripsi = ?, nilai_minimal = ?
         WHERE id = ? AND jabatan_target_id = ?`,
        [d.jenisSyarat, d.deskripsi, d.nilaiMinimal || null, idSyarat.data, idTarget.data],
      )
      return {
        entitasId: idSyarat.data,
        sesudah: { id: idSyarat.data, ...d, kataKunciRelevansi: bidangIlmu },
      }
    },
  })

  segarkan(idTarget.data)
  return berhasil(
    { id: hasil.entitasId ?? 0 },
    bidangIlmu === null
      ? 'Persyaratan disimpan. Kelayakan kandidat berubah setelah skor dihitung ulang.'
      : `Bidang ilmu disimpan untuk gerbang kelayakan DAN indikator rubrik (${bidangIlmu.length} kata kunci). Jalankan Hitung Ulang agar skornya ikut.`,
  )
}

/**
 * Simpan syarat pelatihan jabatan target (Fase 11 no. 3 lanjutan, U-15).
 *
 * Sebelum ini `jabatan_target_syarat_diklat` **hanya bisa diubah lewat SQL** —
 * satu-satunya bagian lembar 6 tanpa permukaan UI, padahal ia menentukan indikator
 * Pengembangan Kompetensi (5%) untuk seluruh kandidat. Sekarang ia dideklarasikan
 * dari tab yang sama dengan pendidikan, bidang ilmu, dan pengalaman.
 *
 * Ditulis sebagai **ganti seluruhnya** (hapus lalu isi ulang), bukan tambah/kurang
 * per baris: yang dinyatakan pengguna adalah "inilah daftar syaratnya", dan daftar
 * yang disusun dari beberapa mutasi terpisah bisa berhenti di tengah — meninggalkan
 * syarat separuh yang tetap dipakai menghitung skor.
 *
 * **Rumpun ditolak di server, bukan cuma tidak ditawarkan di UI.** Menuntut
 * "Pelatihan Teknis" tanpa menyebut teknis apa membuat `penuhiSyaratPelatihan()`
 * tidak bisa membedakan Pengadaan dari Hukum Kontrak, dan indikatornya berhenti
 * bermakna. Halaman bisa basi; gerbangnya tidak boleh.
 */
export async function simpanSyaratDiklat(
  jabatanTargetId: unknown,
  kategoriIds: unknown,
): Promise<HasilAksi<{ jumlah: number }>> {
  const tolak = await gerbangPeran(PERAN_JABATAN_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')

  const uraiId = z.array(idPositif).max(50, 'Terlalu banyak kategori').safeParse(kategoriIds)
  if (!uraiId.success) return gagal('Pilihan kategori pelatihan tidak dikenali.')
  const diminta = [...new Set(uraiId.data)]

  if (diminta.length > 0) {
    const sah = await kueri<{ id: number; kode: string; nama: string; parent_id: number | null }>(
      `SELECT id, kode, nama, parent_id FROM master_kategori_riwayat_diklat
        WHERE id IN (${diminta.map(() => '?').join(',')})`,
      diminta,
    )
    if (sah.length !== diminta.length) {
      return gagal('Ada kategori pelatihan yang sudah tidak ada. Muat ulang halaman lalu coba lagi.')
    }
    const rumpun = sah.filter((k) => k.parent_id === null)
    if (rumpun.length > 0) {
      return gagal(
        `${rumpun.map((k) => `"${k.nama}"`).join(', ')} adalah rumpun, bukan kategori yang bisa disyaratkan — pilih turunannya (mis. PIM IV, Pengadaan Barang dan Jasa) supaya syaratnya bisa diperiksa.`,
      )
    }
  }

  await jalankanMutasi({
    entitas: 'jabatan_target_syarat_diklat',
    aksi: 'UBAH',
    peranDiizinkan: PERAN_JABATAN_TARGET,
    sebelum: async (): Promise<Record<string, unknown>> => {
      const baris = await kueri<{ kode: string }>(
        `SELECT k.kode FROM jabatan_target_syarat_diklat s
           JOIN master_kategori_riwayat_diklat k ON k.id = s.kategori_id
          WHERE s.jabatan_target_id = ? ORDER BY k.kode`,
        [idTarget.data],
      )
      return { kategori: baris.map((r) => r.kode) }
    },
    jalankan: async () => {
      await eksekusi(`DELETE FROM jabatan_target_syarat_diklat WHERE jabatan_target_id = ?`, [
        idTarget.data,
      ])
      for (const id of diminta) {
        // `wajib` selalu 1: kolomnya ada di skema tapi BELUM dipakai perhitungan
        // (ERD §3.2) — indikator Pengembangan Kompetensi hanya punya dua kategori
        // skor, jadi tidak ada tempat membedakan "punya 1 dari 3" dari "punya 3
        // dari 3". Menawarkan penanda wajib/opsional di UI berarti kontrol yang
        // tidak berakibat apa pun.
        await eksekusi(
          `INSERT INTO jabatan_target_syarat_diklat (jabatan_target_id, kategori_id, wajib)
           VALUES (?, ?, 1)`,
          [idTarget.data, id],
        )
      }
      return { entitasId: idTarget.data, sesudah: { jumlah: diminta.length, kategoriIds: diminta } }
    },
  })

  segarkan(idTarget.data)
  return berhasil(
    { jumlah: diminta.length },
    diminta.length === 0
      ? 'Syarat pelatihan dikosongkan. Indikator Pengembangan Kompetensi jadi "tidak diketahui" — bukan gagal. Jalankan Hitung Ulang agar skornya ikut.'
      : `${diminta.length} kategori pelatihan disimpan. Jalankan Hitung Ulang agar skor Pengembangan Kompetensi ikut berubah.`,
  )
}

export async function hapusPersyaratan(
  jabatanTargetId: unknown,
  persyaratanId: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_JABATAN_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  const idSyarat = idPositif.safeParse(persyaratanId)
  if (!idTarget.success || !idSyarat.success) return gagal('Persyaratan tidak dikenali.')

  const lama = await kueriSatu<{ jenis_syarat: string }>(
    `SELECT jenis_syarat FROM jabatan_target_persyaratan WHERE id = ? AND jabatan_target_id = ?`,
    [idSyarat.data, idTarget.data],
  )
  if (lama === null) return gagal('Persyaratan itu sudah tidak ada. Muat ulang halaman.')

  await jalankanMutasi({
    entitas: 'jabatan_target_persyaratan',
    aksi: 'HAPUS',
    peranDiizinkan: PERAN_JABATAN_TARGET,
    sebelum: () =>
      kueriSatu(
        `SELECT id, jenis_syarat, deskripsi, nilai_minimal FROM jabatan_target_persyaratan WHERE id = ?`,
        [idSyarat.data],
      ),
    jalankan: async () => {
      await eksekusi(
        `DELETE FROM jabatan_target_persyaratan WHERE id = ? AND jabatan_target_id = ?`,
        [idSyarat.data, idTarget.data],
      )
      // Menghapus syarat BIDANG_ILMU ikut mengosongkan `kata_kunci_relevansi`.
      // Tanpa ini, gerbang berhenti memeriksa bidang ilmu sementara indikator
      // rubrik **tetap** menilainya dari kata kunci yang tidak lagi punya pemilik
      // — kata kunci yatim yang masih menggerakkan skor dan tidak tampil di layar
      // mana pun.
      if (lama.jenis_syarat === 'BIDANG_ILMU') {
        await eksekusi(
          `UPDATE jabatan_target SET kata_kunci_relevansi = JSON_ARRAY() WHERE id = ?`,
          [idTarget.data],
        )
      }
      return { entitasId: idSyarat.data, sesudah: null }
    },
  })

  segarkan(idTarget.data)
  return berhasil(
    undefined,
    'Persyaratan dihapus. Kandidat yang tadinya tersaring olehnya akan lolos setelah skor dihitung ulang.',
  )
}

// ---------------------------------------------------------------------------
// Duplikasi rubrik dari jabatan target lain
// ---------------------------------------------------------------------------

/**
 * Salin seluruh rubrik (komponen → indikator → sub-indikator → kategori) dari
 * jabatan target lain.
 *
 * Ini bukan kemudahan belaka: menyusun rubrik 65/20/15 dari nol berarti mengetik
 * 9 indikator dan 30-an kategori skor beserta ambangnya, dan setiap salah ketik
 * ambang menghasilkan rubrik yang tetap memberi angka (lihat `validasi.ts`).
 * Menyalin dari rubrik yang sudah lolos validasi jauh lebih kecil risikonya.
 *
 * Rubrik tujuan harus KOSONG — menimpa rubrik yang sudah dipakai menghitung
 * berarti membuang bobot yang mungkin sudah disetel, tanpa jejak.
 */
export async function duplikasiRubrik(
  jabatanTargetId: unknown,
  dariJabatanTargetId: unknown,
): Promise<HasilAksi<{ jumlahKomponen: number; jumlahIndikator: number; jumlahKategori: number }>> {
  const tolak = await gerbangPeran(PERAN_JABATAN_TARGET)
  if (tolak) return tolak

  const idTujuan = idPositif.safeParse(jabatanTargetId)
  const idSumber = idPositif.safeParse(dariJabatanTargetId)
  if (!idTujuan.success || !idSumber.success) return gagal('Jabatan target tidak dikenali.')
  if (idTujuan.data === idSumber.data) return gagal('Sumber dan tujuan tidak boleh sama.')

  const adaKomponen = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM rubrik_komponen WHERE jabatan_target_id = ?`,
    [idTujuan.data],
  )
  if (Number(adaKomponen?.n ?? 0) > 0) {
    return gagal(
      `Jabatan target ini sudah punya ${adaKomponen?.n} komponen rubrik. Hapus komponennya lebih dulu bila memang mau diganti — menyalin ke atas rubrik yang sudah ada akan membuang bobot yang sudah disetel.`,
    )
  }

  const sumber = await ambilPohonRubrik(idSumber.data)
  if (sumber.length === 0) return gagal('Jabatan target sumber belum punya rubrik untuk disalin.')

  let jumlahIndikator = 0
  let jumlahKategori = 0

  await jalankanMutasi({
    entitas: 'rubrik_komponen',
    aksi: 'BUAT',
    peranDiizinkan: PERAN_JABATAN_TARGET,
    jalankan: async () => {
      for (const k of sumber) {
        const { insertId: komponenId } = await eksekusi(
          `INSERT INTO rubrik_komponen (jabatan_target_id, sumbu, nama_komponen, bobot_komponen, urutan)
           VALUES (?, ?, ?, ?, ?)`,
          [idTujuan.data, k.sumbu, k.namaKomponen, k.bobot, k.urutan],
        )

        // Sub-indikator butuh id induknya, jadi induk ditulis lebih dulu lalu
        // anaknya menyusul — bukan satu INSERT berisi seluruh pohon.
        for (const i of k.indikator) {
          const indukId = await salinIndikator(komponenId, null, i)
          jumlahIndikator++
          jumlahKategori += i.kategori.length
          for (const anak of i.anak) {
            await salinIndikator(komponenId, indukId, anak)
            jumlahIndikator++
            jumlahKategori += anak.kategori.length
          }
        }
      }
      return {
        entitasId: idTujuan.data,
        sesudah: { disalinDari: idSumber.data, jumlahKomponen: sumber.length },
      }
    },
  })

  segarkan(idTujuan.data)
  return berhasil(
    { jumlahKomponen: sumber.length, jumlahIndikator, jumlahKategori },
    `Rubrik disalin: ${sumber.length} komponen · ${jumlahIndikator} indikator · ${jumlahKategori} kategori skor.`,
  )
}

async function salinIndikator(
  komponenId: number,
  parentId: number | null,
  node: {
    namaIndikator: string
    kunci: string | null
    bobot: number | null
    modeSkor: string
    kebutuhanData: string | null
    sumberData: string | null
    urutan: number
    kategori: Array<{
      namaKategori: string
      nilaiSkor: number | null
      ambangMin: number | null
      ambangMax: number | null
      urutan: number
    }>
  },
): Promise<number> {
  const { insertId } = await eksekusi(
    `INSERT INTO rubrik_indikator
       (rubrik_komponen_id, parent_indikator_id, nama_indikator, kunci_sistem, bobot_indikator,
        mode_skor, kebutuhan_data, sumber_data, urutan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      komponenId,
      parentId,
      node.namaIndikator,
      node.kunci,
      node.bobot,
      node.modeSkor,
      node.kebutuhanData,
      node.sumberData,
      node.urutan,
    ],
  )

  if (node.kategori.length > 0) {
    const nilai = node.kategori.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')
    const params = node.kategori.flatMap((s) => [
      insertId,
      s.namaKategori,
      s.nilaiSkor,
      s.ambangMin,
      s.ambangMax,
      s.urutan,
    ])
    await eksekusi(
      `INSERT INTO rubrik_kategori_skor
         (rubrik_indikator_id, nama_kategori, nilai_skor, ambang_min, ambang_max, urutan)
       VALUES ${nilai}`,
      params,
    )
  }

  return insertId
}
