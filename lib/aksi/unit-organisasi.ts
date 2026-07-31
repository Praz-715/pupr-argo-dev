'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { jalankanMutasi } from '../audit'
import { eksekusi, kueri, kueriSatu } from '../db'
import { berhasil, gagal, galatDariZod, pesanDariGalatDb, type HasilAksi } from './hasil'

/**
 * Mutasi Master Unit Organisasi. Hanya Super Admin (PRD §6.4).
 *
 * Validasi ada **di sini**, bukan cuma di form: server action adalah endpoint
 * yang bisa dipanggil langsung, jadi form yang rapi bukan jaminan apa pun
 * (phase.md §5, CLAUDE.md #5 — validasi di boundary).
 */

const JENIS_UNIT = [
  'DITJEN',
  'SEKRETARIAT',
  'DIREKTORAT',
  'BALAI',
  'BP2JK',
  'SUBDIT',
  'BAGIAN',
  'SEKSI',
] as const

const SkemaUnit = z.object({
  kodeUnit: z
    .string()
    .trim()
    .min(2, 'Kode unit minimal 2 karakter')
    .max(30, 'Kode unit maksimal 30 karakter')
    .regex(/^[A-Za-z0-9._-]+$/, 'Kode unit hanya boleh huruf, angka, titik, garis, dan underscore'),
  namaUnit: z
    .string()
    .trim()
    .min(3, 'Nama unit minimal 3 karakter')
    .max(200, 'Nama unit maksimal 200 karakter'),
  parentId: z.number().int().positive().nullable(),
  jenis: z.enum(JENIS_UNIT),
  levelEselon: z.number().int().min(1).max(5).nullable(),
})

export type MasukanUnit = z.infer<typeof SkemaUnit>

const PERAN_MASTER_UNIT = ['Super Admin'] as const

async function bacaUnit(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, kode_unit, nama_unit, parent_id, jenis, level_eselon
     FROM unit_organisasi WHERE id = ?`,
    [id],
  )
}

/**
 * Apakah `calonParent` berada di bawah `id`? Dipakai mencegah siklus.
 *
 * Tanpa pemeriksaan ini, menyetel induk sebuah unit ke salah satu turunannya
 * membuat cabang itu **lepas dari pohon** — unitnya masih ada di tabel tapi
 * tidak pernah muncul di tampilan tree mana pun, dan filter unit hierarkis
 * (`SUBKUERI_UNIT_TURUNAN`) akan berputar tanpa henti.
 */
async function akanJadiSiklus(id: number, calonParent: number): Promise<boolean> {
  if (id === calonParent) return true
  const baris = await kueri<{ id: number }>(
    `WITH RECURSIVE turunan AS (
       SELECT id FROM unit_organisasi WHERE id = ?
       UNION ALL
       SELECT u.id FROM unit_organisasi u JOIN turunan t ON u.parent_id = t.id
     )
     SELECT id FROM turunan WHERE id = ?`,
    [id, calonParent],
  )
  return baris.length > 0
}

export async function buatUnit(masukan: unknown): Promise<HasilAksi<{ id: number }>> {
  const urai = SkemaUnit.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  try {
    const hasil = await jalankanMutasi({
      entitas: 'unit_organisasi',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_MASTER_UNIT,
      jalankan: async () => {
        const { insertId } = await eksekusi(
          `INSERT INTO unit_organisasi (kode_unit, nama_unit, parent_id, jenis, level_eselon)
           VALUES (?, ?, ?, ?, ?)`,
          [d.kodeUnit, d.namaUnit, d.parentId, d.jenis, d.levelEselon],
        )
        return { entitasId: insertId, sesudah: { id: insertId, ...d } }
      },
    })
    revalidatePath('/master/unit')
    return berhasil({ id: hasil.entitasId ?? 0 }, `Unit "${d.namaUnit}" ditambahkan.`)
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Kode unit "${d.kodeUnit}"` })
    if (pesan) return gagal(pesan, { kodeUnit: pesan })
    throw e
  }
}

export async function ubahUnit(id: unknown, masukan: unknown): Promise<HasilAksi<void>> {
  const idUnit = z.number().int().positive().safeParse(id)
  if (!idUnit.success) return gagal('Unit tidak dikenali.')

  const urai = SkemaUnit.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  if (d.parentId !== null && (await akanJadiSiklus(idUnit.data, d.parentId))) {
    const pesan =
      'Unit itu berada di bawah unit ini, jadi tidak bisa dijadikan induknya — cabangnya akan lepas dari pohon organisasi.'
    return gagal(pesan, { parentId: pesan })
  }

  try {
    await jalankanMutasi({
      entitas: 'unit_organisasi',
      aksi: 'UBAH',
      peranDiizinkan: PERAN_MASTER_UNIT,
      sebelum: () => bacaUnit(idUnit.data),
      jalankan: async () => {
        await eksekusi(
          `UPDATE unit_organisasi
           SET kode_unit = ?, nama_unit = ?, parent_id = ?, jenis = ?, level_eselon = ?
           WHERE id = ?`,
          [d.kodeUnit, d.namaUnit, d.parentId, d.jenis, d.levelEselon, idUnit.data],
        )
        return { entitasId: idUnit.data, sesudah: { id: idUnit.data, ...d } }
      },
    })
    revalidatePath('/master/unit')
    return berhasil(undefined, `Unit "${d.namaUnit}" disimpan.`)
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Kode unit "${d.kodeUnit}"` })
    if (pesan) return gagal(pesan, { kodeUnit: pesan })
    throw e
  }
}

/**
 * Hapus unit. Ditolak kalau masih punya turunan atau masih dipakai jabatan —
 * dan **alasannya disebutkan beserta angkanya**, karena "tidak bisa dihapus"
 * tanpa sebab memaksa pengguna menebak apa yang harus dibereskan dulu.
 */
export async function hapusUnit(id: unknown): Promise<HasilAksi<void>> {
  const idUnit = z.number().int().positive().safeParse(id)
  if (!idUnit.success) return gagal('Unit tidak dikenali.')

  const pemakaian = await kueriSatu<{ anak: number; jabatan: number }>(
    `SELECT
       (SELECT COUNT(*) FROM unit_organisasi WHERE parent_id = ?) AS anak,
       (SELECT COUNT(*) FROM jabatan WHERE unit_organisasi_id = ?) AS jabatan`,
    [idUnit.data, idUnit.data],
  )
  const anak = Number(pemakaian?.anak ?? 0)
  const jabatan = Number(pemakaian?.jabatan ?? 0)

  if (anak > 0 || jabatan > 0) {
    const sebab = [
      anak > 0 ? `${anak} unit di bawahnya` : null,
      jabatan > 0 ? `${jabatan} jabatan` : null,
    ].filter(Boolean)
    return gagal(
      `Unit ini masih dipakai: ${sebab.join(' dan ')}. Pindahkan atau hapus itu lebih dulu.`,
    )
  }

  try {
    await jalankanMutasi({
      entitas: 'unit_organisasi',
      aksi: 'HAPUS',
      peranDiizinkan: PERAN_MASTER_UNIT,
      sebelum: () => bacaUnit(idUnit.data),
      jalankan: async () => {
        await eksekusi(`DELETE FROM unit_organisasi WHERE id = ?`, [idUnit.data])
        return { entitasId: idUnit.data, sesudah: null }
      },
    })
    revalidatePath('/master/unit')
    return berhasil(undefined, 'Unit dihapus.')
  } catch (e) {
    const pesan = pesanDariGalatDb(e, {})
    if (pesan) return gagal(pesan)
    throw e
  }
}
