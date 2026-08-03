'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { jalankanMutasi } from '../audit'
import { getCurrentUser } from '../auth'
import { eksekusi, kueriSatu } from '../db'
import { gerbangPeran } from './gerbang'
import { berhasil, gagal, galatDariZod, pesanDariGalatDb, type HasilAksi } from './hasil'

/**
 * Mutasi Data Hukuman Disiplin — data ASN paling sensitif di aplikasi ini
 * (PRD §7.3, UU PDP No. 27/2022).
 *
 * Tiga hal yang membedakan berkas ini dari mutasi master lain:
 *
 * 1. **Hanya Admin Talenta & Super Admin**, dan itu diperiksa di server.
 * 2. **Tidak ada penghapusan permanen.** Catatan disiplin dinonaktifkan
 *    (`status_aktif = 0`), tidak dihapus: ia dasar hukum penilaian integritas,
 *    dan skor yang sudah dihitung harus tetap bisa dipertanggungjawabkan setelah
 *    catatannya tidak lagi berlaku. Baris nonaktif tidak menurunkan skor
 *    (phase.md §2.7) tapi tetap ada jejaknya.
 * 3. **Isi keterangan tidak masuk ke `audit_log`.** Kolom itu bisa memuat uraian
 *    pelanggaran; menyalinnya ke jejak audit akan menyebarkan data sensitif ke
 *    tabel yang aturan aksesnya berbeda. Yang dicatat: field apa yang berubah,
 *    bukan isinya.
 */

const TINGKAT = ['Tidak Pernah', 'Ringan', 'Sedang', 'Berat', 'Sedang Menjalani'] as const

const SkemaHukuman = z.object({
  pegawaiId: z.number().int().positive('Pegawai wajib dipilih'),
  tingkatHukuman: z.enum(TINGKAT),
  tanggalSk: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal SK harus berformat YYYY-MM-DD')
    .nullable(),
  noSk: z.string().trim().max(80, 'Nomor SK maksimal 80 karakter').nullable(),
  keterangan: z.string().trim().max(2000, 'Keterangan maksimal 2.000 karakter').nullable(),
  statusAktif: z.boolean(),
})

export type MasukanHukuman = z.infer<typeof SkemaHukuman>

const PERAN_DISIPLIN = ['Super Admin', 'Admin Talenta'] as const

/**
 * Ringkasan untuk `audit_log` — **tanpa** isi keterangan.
 * Yang dicatat cukup untuk pemeriksaan ("siapa mengubah tingkat hukuman siapa,
 * dari apa ke apa") tanpa menduplikasi uraian pelanggarannya.
 */
function ringkasUntukAudit(r: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!r) return null
  return {
    id: r.id,
    pegawai_id: r.pegawai_id,
    tingkat_hukuman: r.tingkat_hukuman,
    tanggal_sk: r.tanggal_sk,
    no_sk: r.no_sk,
    status_aktif: r.status_aktif,
    ada_keterangan: r.keterangan !== null && String(r.keterangan).trim() !== '',
  }
}

async function bacaHukuman(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, pegawai_id, tingkat_hukuman, tanggal_sk, no_sk, keterangan, status_aktif
     FROM hukuman_disiplin WHERE id = ?`,
    [id],
  )
}

export async function buatHukuman(masukan: unknown): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_DISIPLIN)
  if (tolak) return tolak

  const urai = SkemaHukuman.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const pegawai = await kueriSatu<{ nama: string }>(
    `SELECT nama_lengkap AS nama FROM pegawai WHERE id = ?`,
    [d.pegawaiId],
  )
  if (!pegawai) return gagal('Pegawai tidak ditemukan.', { pegawaiId: 'Pegawai tidak ditemukan.' })

  const pengguna = await getCurrentUser()

  try {
    const hasil = await jalankanMutasi({
      entitas: 'hukuman_disiplin',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_DISIPLIN,
      jalankan: async () => {
        const { insertId } = await eksekusi(
          `INSERT INTO hukuman_disiplin
             (pegawai_id, tingkat_hukuman, tanggal_sk, no_sk, keterangan, status_aktif, input_by)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            d.pegawaiId,
            d.tingkatHukuman,
            d.tanggalSk,
            d.noSk,
            d.keterangan,
            d.statusAktif ? 1 : 0,
            pengguna?.id ?? null,
          ],
        )
        return {
          entitasId: insertId,
          sesudah: ringkasUntukAudit({
            id: insertId,
            pegawai_id: d.pegawaiId,
            tingkat_hukuman: d.tingkatHukuman,
            tanggal_sk: d.tanggalSk,
            no_sk: d.noSk,
            keterangan: d.keterangan,
            status_aktif: d.statusAktif ? 1 : 0,
          }),
        }
      },
    })

    revalidatePath('/master/hukuman-disiplin')
    // Nilai integritas pegawai ikut berubah → halaman yang menampilkannya.
    revalidatePath('/talenta')
    return berhasil(
      { id: hasil.entitasId ?? 0 },
      `Catatan disiplin ${d.tingkatHukuman} untuk ${pegawai.nama} disimpan.`,
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, {})
    if (pesan) return gagal(pesan)
    throw e
  }
}

export async function ubahHukuman(id: unknown, masukan: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_DISIPLIN)
  if (tolak) return tolak

  const idH = z.number().int().positive().safeParse(id)
  if (!idH.success) return gagal('Catatan tidak dikenali.')

  const urai = SkemaHukuman.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  try {
    await jalankanMutasi({
      entitas: 'hukuman_disiplin',
      aksi: 'UBAH',
      peranDiizinkan: PERAN_DISIPLIN,
      sebelum: async () => ringkasUntukAudit(await bacaHukuman(idH.data)),
      jalankan: async () => {
        await eksekusi(
          `UPDATE hukuman_disiplin
           SET tingkat_hukuman = ?, tanggal_sk = ?, no_sk = ?, keterangan = ?, status_aktif = ?
           WHERE id = ?`,
          [
            d.tingkatHukuman,
            d.tanggalSk,
            d.noSk,
            d.keterangan,
            d.statusAktif ? 1 : 0,
            idH.data,
          ],
        )
        return {
          entitasId: idH.data,
          sesudah: ringkasUntukAudit({
            id: idH.data,
            pegawai_id: d.pegawaiId,
            tingkat_hukuman: d.tingkatHukuman,
            tanggal_sk: d.tanggalSk,
            no_sk: d.noSk,
            keterangan: d.keterangan,
            status_aktif: d.statusAktif ? 1 : 0,
          }),
        }
      },
    })

    revalidatePath('/master/hukuman-disiplin')
    revalidatePath('/talenta')
    return berhasil(undefined, 'Catatan disiplin disimpan.')
  } catch (e) {
    const pesan = pesanDariGalatDb(e, {})
    if (pesan) return gagal(pesan)
    throw e
  }
}

/**
 * Nonaktifkan catatan — bukan hapus.
 *
 * Catatan disiplin adalah dasar skor integritas yang sudah dipakai menghitung
 * match score. Menghapus barisnya membuat skor lama tidak bisa dipertanggung-
 * jawabkan lagi ("kenapa integritasnya 75 padahal tidak ada catatan?").
 */
export async function nonaktifkanHukuman(id: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_DISIPLIN)
  if (tolak) return tolak

  const idH = z.number().int().positive().safeParse(id)
  if (!idH.success) return gagal('Catatan tidak dikenali.')

  const sekarang = await bacaHukuman(idH.data)
  if (!sekarang) return gagal('Catatan tidak ditemukan.')
  if (Number(sekarang.status_aktif) === 0) {
    return gagal('Catatan ini sudah berstatus tidak aktif.')
  }

  await jalankanMutasi({
    entitas: 'hukuman_disiplin',
    aksi: 'UBAH_STATUS',
    peranDiizinkan: PERAN_DISIPLIN,
    sebelum: async () => ringkasUntukAudit(sekarang),
    jalankan: async () => {
      await eksekusi(`UPDATE hukuman_disiplin SET status_aktif = 0 WHERE id = ?`, [idH.data])
      return {
        entitasId: idH.data,
        sesudah: ringkasUntukAudit({ ...sekarang, status_aktif: 0 }),
      }
    },
  })

  revalidatePath('/master/hukuman-disiplin')
  revalidatePath('/talenta')
  return berhasil(
    undefined,
    'Catatan dinonaktifkan. Ia tidak lagi menurunkan skor integritas, tapi jejaknya tetap ada.',
  )
}
