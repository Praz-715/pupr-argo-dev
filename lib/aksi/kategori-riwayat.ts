'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { jalankanMutasi } from '../audit'
import { getCurrentUser } from '../auth'
import { eksekusi, kueriSatu } from '../db'
import { JENIS_KATEGORI_DIKLAT, JENIS_PENUGASAN } from '../kategori-riwayat'
import { lingkupData, tanpaAkses, unitWajib } from '../lingkup'
import { gerbangPeran } from './gerbang'
import { berhasil, gagal, galatDariZod, pesanDariGalatDb, type HasilAksi } from './hasil'

/**
 * Mutasi kamus kategori diklat & validasi riwayat (`doc/sql/014`).
 *
 * ## Dua daftar peran, sengaja berbeda
 *
 * **Siapa mendefinisikan kategori ≠ siapa menerapkannya.** Kamusnya master data
 * yang berlaku ke seluruh DJBK, jadi Super Admin & Admin Talenta. Penerapannya —
 * memutuskan diklat ini masuk kategori itu, riwayat ini Plt atau bukan — adalah
 * kurasi data pegawai, dan PRD §3 sudah menetapkan pemiliknya: Pengelola Unit,
 * *"Input/validasi riwayat data pegawai unitnya"*.
 *
 * ## Pembatasan unit di sini tidak seragam, dan itu bukan kelalaian
 *
 * `pemetaan_diklat` dikunci pada NAMA diklat, yang tidak dimiliki unit mana pun:
 * Pengelola Unit yang memetakan "Diklat PIM IV" ikut memengaruhi pegawai unit
 * lain. Itu sifat kamus, bukan kebocoran — dan halamannya menyatakannya. Yang
 * TETAP dibatasi ketat: `tetapkanJenisPenugasan()` dan `tandaiRiwayatDiperiksa()`,
 * karena keduanya menyentuh baris milik satu pegawai tertentu. Di kedua aksi itu
 * lingkup diperiksa **sebelum** mutasi, dan pegawai di luar lingkup dijawab
 * seperti pegawai yang tidak ada — bukan dengan "Anda tidak berhak", yang justru
 * mengonfirmasi keberadaan orangnya.
 */

const PERAN_KAMUS = ['Super Admin', 'Admin Talenta'] as const
const PERAN_VALIDASI = ['Super Admin', 'Admin Talenta', 'Pengelola Unit'] as const

// ---------------------------------------------------------------------------
// Master kategori
// ---------------------------------------------------------------------------

const SkemaKategori = z.object({
  kode: z
    .string()
    .trim()
    .min(2, 'Kode minimal 2 karakter')
    .max(60, 'Kode maksimal 60 karakter')
    // Kode dipakai sebagai pengenal stabil di `penuhiSyaratPelatihan()`; spasi &
    // huruf kecil membuatnya rapuh terhadap salin-tempel.
    .regex(/^[A-Z0-9_]+$/, 'Kode hanya huruf besar, angka, dan garis bawah'),
  nama: z.string().trim().min(3, 'Nama minimal 3 karakter').max(150),
  jenis: z.enum(JENIS_KATEGORI_DIKLAT),
  parentId: z.number().int().positive().nullable(),
  setaraJenjang: z.enum(['II', 'III', 'IV']).nullable(),
  polaCocok: z.array(z.string().trim().min(2, 'Pola minimal 2 karakter').max(120)).max(30),
  keterangan: z.string().trim().max(500).nullable(),
  urutan: z.number().int().min(0).max(9999),
  aktif: z.boolean(),
})

export type MasukanKategoriDiklat = z.infer<typeof SkemaKategori>

async function bacaKategori(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, kode, nama, jenis, parent_id, setara_jenjang, pola_cocok, keterangan, urutan, aktif
       FROM master_kategori_riwayat_diklat WHERE id = ?`,
    [id],
  )
}

export async function buatKategoriDiklat(
  masukan: unknown,
): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_KAMUS)
  if (tolak) return tolak

  const urai = SkemaKategori.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  try {
    const hasil = await jalankanMutasi({
      entitas: 'master_kategori_riwayat_diklat',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_KAMUS,
      jalankan: async () => {
        const { insertId } = await eksekusi(
          `INSERT INTO master_kategori_riwayat_diklat
             (kode, nama, jenis, parent_id, setara_jenjang, pola_cocok, keterangan, urutan, aktif)
           VALUES (?, ?, ?, ?, ?, CAST(? AS JSON), ?, ?, ?)`,
          [
            d.kode,
            d.nama,
            d.jenis,
            d.parentId,
            d.setaraJenjang,
            JSON.stringify(d.polaCocok),
            d.keterangan,
            d.urutan,
            d.aktif ? 1 : 0,
          ],
        )
        return { entitasId: insertId, sesudah: { ...d, id: insertId } }
      },
    })

    revalidatePath('/master/kategori-diklat')
    revalidatePath('/data/validasi-riwayat')
    return berhasil({ id: hasil.entitasId ?? 0 }, `Kategori ${d.kode} disimpan.`)
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: 'Kode kategori' })
    if (pesan) return gagal(pesan, { kode: pesan })
    throw e
  }
}

export async function ubahKategoriDiklat(
  id: unknown,
  masukan: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_KAMUS)
  if (tolak) return tolak

  const idK = z.number().int().positive().safeParse(id)
  if (!idK.success) return gagal('Kategori tidak dikenali.')

  const urai = SkemaKategori.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  // Hierarki tidak boleh menunjuk dirinya sendiri. Tanpa penjagaan ini,
  // `ORDER BY COALESCE(p.urutan, k.urutan)` dan pohon di UI masih jalan, tapi
  // kategorinya jadi induk & anak sekaligus — keadaan yang tidak bisa
  // ditampilkan dan tidak menimbulkan galat.
  if (d.parentId === idK.data) {
    return gagal('Kategori tidak bisa menjadi induk dirinya sendiri.', {
      parentId: 'Pilih induk yang lain.',
    })
  }

  try {
    await jalankanMutasi({
      entitas: 'master_kategori_riwayat_diklat',
      aksi: 'UBAH',
      peranDiizinkan: PERAN_KAMUS,
      sebelum: async () => bacaKategori(idK.data),
      jalankan: async () => {
        await eksekusi(
          `UPDATE master_kategori_riwayat_diklat
              SET kode = ?, nama = ?, jenis = ?, parent_id = ?, setara_jenjang = ?,
                  pola_cocok = CAST(? AS JSON), keterangan = ?, urutan = ?, aktif = ?
            WHERE id = ?`,
          [
            d.kode,
            d.nama,
            d.jenis,
            d.parentId,
            d.setaraJenjang,
            JSON.stringify(d.polaCocok),
            d.keterangan,
            d.urutan,
            d.aktif ? 1 : 0,
            idK.data,
          ],
        )
        return { entitasId: idK.data, sesudah: { ...d, id: idK.data } }
      },
    })

    revalidatePath('/master/kategori-diklat')
    revalidatePath('/data/validasi-riwayat')
    return berhasil(undefined, `Kategori ${d.kode} disimpan.`)
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: 'Kode kategori' })
    if (pesan) return gagal(pesan, { kode: pesan })
    throw e
  }
}

// ---------------------------------------------------------------------------
// Validasi pemetaan diklat
// ---------------------------------------------------------------------------

const SkemaPemetaan = z.object({
  id: z.number().int().positive(),
  /** `null` = sudah diperiksa dan memang tidak masuk kategori mana pun. */
  kategoriId: z.number().int().positive().nullable(),
  catatan: z.string().trim().max(500).nullable(),
})

/**
 * Tetapkan kategori satu nama diklat.
 *
 * `kategoriId = null` **tidak** berarti "batal" — ia berarti pemeriksa memutuskan
 * diklat ini tidak masuk kategori mana pun, dan statusnya jadi `DITOLAK` supaya
 * ia keluar dari antrian. Menyamakan "belum diperiksa" dengan "tidak berkategori"
 * membuat antriannya tidak pernah habis.
 */
export async function validasiPemetaanDiklat(masukan: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_VALIDASI)
  if (tolak) return tolak

  const urai = SkemaPemetaan.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const pengguna = await getCurrentUser()

  const sekarang = await kueriSatu<Record<string, unknown>>(
    `SELECT id, nama_mentah, kategori_id, status FROM pemetaan_diklat WHERE id = ?`,
    [d.id],
  )
  if (!sekarang) return gagal('Nama diklat itu tidak ada di kamus.')

  if (d.kategoriId !== null) {
    const kategori = await kueriSatu<{ aktif: number }>(
      `SELECT aktif FROM master_kategori_riwayat_diklat WHERE id = ?`,
      [d.kategoriId],
    )
    if (!kategori) return gagal('Kategori tidak ditemukan.', { kategoriId: 'Kategori tidak ada.' })
    // Kategori nonaktif tetap terpasang di baris lama (tidak ditarik), tapi tidak
    // boleh dipilih untuk pemetaan BARU — kalau boleh, kamusnya diam-diam
    // menerima kategori yang sudah diputuskan tidak dipakai lagi.
    if (Number(kategori.aktif) !== 1) {
      return gagal('Kategori itu sudah dinonaktifkan.', {
        kategoriId: 'Pilih kategori yang masih aktif.',
      })
    }
  }

  const status = d.kategoriId === null ? 'DITOLAK' : 'TERVALIDASI'

  await jalankanMutasi({
    entitas: 'pemetaan_diklat',
    aksi: 'UBAH',
    peranDiizinkan: PERAN_VALIDASI,
    sebelum: async () => sekarang,
    jalankan: async () => {
      await eksekusi(
        `UPDATE pemetaan_diklat
            SET kategori_id = ?, status = ?, catatan = ?, divalidasi_oleh = ?, divalidasi_pada = NOW()
          WHERE id = ?`,
        [d.kategoriId, status, d.catatan, pengguna?.id ?? null, d.id],
      )
      return {
        entitasId: d.id,
        sesudah: { id: d.id, kategori_id: d.kategoriId, status, catatan: d.catatan },
      }
    },
  })

  revalidatePath('/data/validasi-riwayat')
  return berhasil(
    undefined,
    d.kategoriId === null
      ? `"${String(sekarang.nama_mentah)}" ditandai tidak berkategori.`
      : `"${String(sekarang.nama_mentah)}" dikategorikan.`,
  )
}

// ---------------------------------------------------------------------------
// Validasi riwayat jabatan
// ---------------------------------------------------------------------------

const SkemaPenugasan = z.object({
  id: z.number().int().positive(),
  jenis: z.enum(JENIS_PENUGASAN),
  relevanSubstansi: z.boolean().nullable(),
})

/**
 * Pastikan pengguna berhak menyentuh riwayat milik satu pegawai.
 *
 * Mengembalikan pesan penolakan, atau `null` kalau boleh. Pegawai di luar lingkup
 * dijawab **sama dengan pegawai yang tidak ada** — jawaban yang berbeda
 * mengonfirmasi keberadaan orangnya kepada yang tidak berhak tahu, pola yang sama
 * dengan `/talenta/{nip}` di Fase 7.
 */
async function periksaLingkupRiwayat(riwayatId: number): Promise<string | null> {
  const pengguna = await getCurrentUser()
  const lingkup = lingkupData(pengguna)
  if (tanpaAkses(lingkup)) return lingkup.alasan

  const unit = unitWajib(lingkup)
  if (unit === null) {
    const ada = await kueriSatu<{ n: number }>(
      `SELECT COUNT(*) AS n FROM riwayat_jabatan WHERE id = ?`,
      [riwayatId],
    )
    return Number(ada?.n ?? 0) > 0 ? null : 'Baris riwayat itu tidak ditemukan.'
  }

  const terjangkau = await kueriSatu<{ n: number }>(
    `WITH RECURSIVE pohon AS (
       SELECT id FROM unit_organisasi WHERE id = ?
       UNION ALL
       SELECT u.id FROM unit_organisasi u JOIN pohon t ON u.parent_id = t.id
     )
     SELECT COUNT(*) AS n
       FROM riwayat_jabatan rj
       JOIN pegawai p ON p.id = rj.pegawai_id
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
      WHERE rj.id = ? AND j.unit_organisasi_id IN (SELECT id FROM pohon)`,
    [unit, riwayatId],
  )
  return Number(terjangkau?.n ?? 0) > 0 ? null : 'Baris riwayat itu tidak ditemukan.'
}

export async function tetapkanJenisPenugasan(masukan: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_VALIDASI)
  if (tolak) return tolak

  const urai = SkemaPenugasan.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const masalah = await periksaLingkupRiwayat(d.id)
  if (masalah) return gagal(masalah)

  const pengguna = await getCurrentUser()
  const sebelum = await kueriSatu<Record<string, unknown>>(
    `SELECT id, pegawai_id, jenis_penugasan, relevan_substansi FROM riwayat_jabatan WHERE id = ?`,
    [d.id],
  )

  await jalankanMutasi({
    entitas: 'riwayat_jabatan',
    aksi: 'UBAH',
    peranDiizinkan: PERAN_VALIDASI,
    sebelum: async () => sebelum,
    jalankan: async () => {
      await eksekusi(
        `UPDATE riwayat_jabatan
            SET jenis_penugasan = ?, relevan_substansi = ?, divalidasi_oleh = ?, divalidasi_pada = NOW()
          WHERE id = ?`,
        [
          d.jenis,
          d.relevanSubstansi === null ? null : d.relevanSubstansi ? 1 : 0,
          pengguna?.id ?? null,
          d.id,
        ],
      )
      return {
        entitasId: d.id,
        sesudah: { id: d.id, jenis_penugasan: d.jenis, relevan_substansi: d.relevanSubstansi },
      }
    },
  })

  revalidatePath('/data/validasi-riwayat')
  return berhasil(undefined, `Penugasan ditetapkan sebagai ${d.jenis}.`)
}

/**
 * Tandai "riwayat pegawai ini sudah saya periksa".
 *
 * Sengaja TIDAK menuntut seluruh entrinya sudah berkategori. Kelengkapan bisa
 * dihitung kapan saja; yang disimpan di sini pernyataan seseorang, dan keduanya
 * berbeda — pegawai tanpa satu pun riwayat diklat otomatis "lengkap" padahal
 * belum pernah dilihat siapa pun. Yang ditampilkan halamannya: kedua angka
 * berdampingan, sehingga "sudah diperiksa tapi masih ada yang belum berkategori"
 * terlihat apa adanya alih-alih dilarang.
 */
export async function tandaiRiwayatDiperiksa(
  pegawaiId: unknown,
  catatan: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_VALIDASI)
  if (tolak) return tolak

  const idP = z.number().int().positive().safeParse(pegawaiId)
  if (!idP.success) return gagal('Pegawai tidak dikenali.')
  const uraiCatatan = z.string().trim().max(500).nullable().safeParse(catatan ?? null)
  if (!uraiCatatan.success) return gagal('Catatan maksimal 500 karakter.')

  const pengguna = await getCurrentUser()
  const lingkup = lingkupData(pengguna)
  if (tanpaAkses(lingkup)) return gagal(lingkup.alasan)
  const unit = unitWajib(lingkup)

  const pegawai = await kueriSatu<{ nama: string }>(
    unit === null
      ? `SELECT nama_lengkap AS nama FROM pegawai WHERE id = ?`
      : `WITH RECURSIVE pohon AS (
           SELECT id FROM unit_organisasi WHERE id = ?
           UNION ALL
           SELECT u.id FROM unit_organisasi u JOIN pohon t ON u.parent_id = t.id
         )
         SELECT p.nama_lengkap AS nama
           FROM pegawai p
           LEFT JOIN jabatan j ON j.id = p.jabatan_id
          WHERE p.id = ? AND j.unit_organisasi_id IN (SELECT id FROM pohon)`,
    unit === null ? [idP.data] : [unit, idP.data],
  )
  if (!pegawai) return gagal('Pegawai itu tidak ditemukan.')

  await jalankanMutasi({
    entitas: 'pegawai',
    aksi: 'UBAH',
    peranDiizinkan: PERAN_VALIDASI,
    sebelum: async () =>
      kueriSatu<Record<string, unknown>>(
        `SELECT id, riwayat_divalidasi_oleh, riwayat_divalidasi_pada FROM pegawai WHERE id = ?`,
        [idP.data],
      ),
    jalankan: async () => {
      await eksekusi(
        `UPDATE pegawai
            SET riwayat_divalidasi_oleh = ?, riwayat_divalidasi_pada = NOW(),
                riwayat_catatan_validasi = ?
          WHERE id = ?`,
        [pengguna?.id ?? null, uraiCatatan.data, idP.data],
      )
      return {
        entitasId: idP.data,
        sesudah: { id: idP.data, riwayat_divalidasi_oleh: pengguna?.id ?? null },
      }
    },
  })

  revalidatePath('/data/validasi-riwayat')
  revalidatePath(`/talenta`)
  return berhasil(undefined, `Riwayat ${pegawai.nama} ditandai sudah diperiksa.`)
}
