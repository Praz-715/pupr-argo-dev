'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { jalankanMutasi } from '../audit'
import { eksekusi, kueriSatu } from '../db'
import { ambilPohonRubrik } from '../kueri/rubrik'
import { validasiRubrik } from '../scoring'
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
  /**
   * Kata kunci relevansi (U-12). Dipakai indikator Kesesuaian Bidang Ilmu &
   * Pengembangan Kompetensi; tanpa isi, keduanya selalu bernilai 50.
   */
  kataKunciRelevansi: z
    .array(z.string().trim().min(2, 'Kata kunci minimal 2 karakter').max(60))
    .max(20, 'Maksimal 20 kata kunci'),
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
        const { insertId } = await eksekusi(
          `INSERT INTO jabatan_target (kode_target, nama_target, deskripsi, kata_kunci_relevansi, status)
           VALUES (?, ?, ?, ?, 'DRAFT')`,
          [d.kodeTarget, d.namaTarget, d.deskripsi, JSON.stringify(d.kataKunciRelevansi)],
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

export async function ubahJabatanTarget(
  id: unknown,
  masukan: unknown,
): Promise<HasilAksi<void>> {
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
        await eksekusi(
          `UPDATE jabatan_target
           SET kode_target = ?, nama_target = ?, deskripsi = ?, kata_kunci_relevansi = ?
           WHERE id = ?`,
          [
            d.kodeTarget,
            d.namaTarget,
            d.deskripsi,
            JSON.stringify(d.kataKunciRelevansi),
            idTarget.data,
          ],
        )
        return { entitasId: idTarget.data, sesudah: { id: idTarget.data, ...d } }
      },
    })
    segarkan(idTarget.data)
    return berhasil(
      undefined,
      'Profil jabatan target disimpan. Kata kunci relevansi baru berlaku setelah skor dihitung ulang.',
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

export async function simpanPersyaratan(
  jabatanTargetId: unknown,
  persyaratanId: unknown,
  masukan: unknown,
): Promise<HasilAksi<{ id: number }>> {
  const idTarget = idPositif.safeParse(jabatanTargetId)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')
  const idSyarat = persyaratanId === null ? null : idPositif.safeParse(persyaratanId)
  if (idSyarat !== null && !idSyarat.success) return gagal('Persyaratan tidak dikenali.')

  const urai = SkemaSyarat.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const galatNilai = periksaNilaiMinimal(d)
  if (galatNilai !== null) return gagal(galatNilai, { nilaiMinimal: galatNilai })

  const hasil = await jalankanMutasi({
    entitas: 'jabatan_target_persyaratan',
    aksi: idSyarat === null ? 'BUAT' : 'UBAH',
    peranDiizinkan: PERAN_JABATAN_TARGET,
    sebelum:
      idSyarat === null
        ? undefined
        : () =>
            kueriSatu(
              `SELECT id, jenis_syarat, deskripsi, nilai_minimal FROM jabatan_target_persyaratan WHERE id = ?`,
              [idSyarat.data],
            ),
    jalankan: async () => {
      if (idSyarat === null) {
        const { insertId } = await eksekusi(
          `INSERT INTO jabatan_target_persyaratan (jabatan_target_id, jenis_syarat, deskripsi, nilai_minimal)
           VALUES (?, ?, ?, ?)`,
          [idTarget.data, d.jenisSyarat, d.deskripsi, d.nilaiMinimal || null],
        )
        return { entitasId: insertId, sesudah: { id: insertId, ...d } }
      }
      await eksekusi(
        `UPDATE jabatan_target_persyaratan SET jenis_syarat = ?, deskripsi = ?, nilai_minimal = ?
         WHERE id = ? AND jabatan_target_id = ?`,
        [d.jenisSyarat, d.deskripsi, d.nilaiMinimal || null, idSyarat.data, idTarget.data],
      )
      return { entitasId: idSyarat.data, sesudah: { id: idSyarat.data, ...d } }
    },
  })

  segarkan(idTarget.data)
  return berhasil(
    { id: hasil.entitasId ?? 0 },
    'Persyaratan disimpan. Kelayakan kandidat berubah setelah skor dihitung ulang.',
  )
}

export async function hapusPersyaratan(
  jabatanTargetId: unknown,
  persyaratanId: unknown,
): Promise<HasilAksi<void>> {
  const idTarget = idPositif.safeParse(jabatanTargetId)
  const idSyarat = idPositif.safeParse(persyaratanId)
  if (!idTarget.success || !idSyarat.success) return gagal('Persyaratan tidak dikenali.')

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
