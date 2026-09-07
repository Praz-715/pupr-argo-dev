'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { jalankanMutasi } from '../audit'
import { eksekusi, kueriSatu } from '../db'
import { gerbangPeran } from './gerbang'
import { berhasil, gagal, galatDariZod, pesanDariGalatDb, type HasilAksi } from './hasil'

/**
 * Mutasi Master Jabatan. Super Admin & Admin Talenta (PRD §6.4).
 *
 * Satu aturan integritas ditegakkan di sini dan tidak bisa dilanggar dari UI
 * mana pun: **jabatan yang masih ditempati tidak boleh ditandai KOSONG.**
 * Widget "jabatan strategis kosong" di dashboard dan halaman Risiko Kekosongan
 * keduanya membaca `status_jabatan`; kalau kolom itu boleh berbohong, kedua
 * halaman itu ikut berbohong — dan yang dilihat pimpinan adalah kekosongan yang
 * tidak ada.
 */

const JENIS_JABATAN = ['STRUKTURAL', 'FUNGSIONAL_TERTENTU', 'FUNGSIONAL_UMUM'] as const
const ESELON = ['I', 'II', 'III', 'IV', 'NON_ESELON'] as const
const STATUS_JABATAN = ['TERISI', 'KOSONG', 'DIHAPUS'] as const

const SkemaJabatan = z.object({
  kodeJabatan: z
    .string()
    .trim()
    .min(2, 'Kode jabatan minimal 2 karakter')
    .max(40, 'Kode jabatan maksimal 40 karakter')
    .regex(/^[A-Za-z0-9._-]+$/, 'Kode jabatan hanya boleh huruf, angka, titik, garis, underscore'),
  namaJabatan: z
    .string()
    .trim()
    .min(3, 'Nama jabatan minimal 3 karakter')
    .max(250, 'Nama jabatan maksimal 250 karakter'),
  unitOrganisasiId: z.number().int().positive('Unit organisasi wajib dipilih'),
  jenisJabatan: z.enum(JENIS_JABATAN),
  jenjang: z.string().trim().min(2, 'Jenjang wajib diisi').max(60, 'Jenjang maksimal 60 karakter'),
  eselon: z.enum(ESELON),
  statusJabatan: z.enum(STATUS_JABATAN),
})

export type MasukanJabatan = z.infer<typeof SkemaJabatan>

const PERAN_MASTER_JABATAN = ['Super Admin', 'Admin Talenta'] as const

async function bacaJabatan(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, kode_jabatan, nama_jabatan, unit_organisasi_id, jenis_jabatan,
            jenjang, eselon, status_jabatan
     FROM jabatan WHERE id = ?`,
    [id],
  )
}

async function jumlahPenghuni(idJabatan: number): Promise<number> {
  const r = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM pegawai WHERE jabatan_id = ? AND status_aktif = 'AKTIF'`,
    [idJabatan],
  )
  return Number(r?.n ?? 0)
}

/** Nama penghuni untuk pesan galat — "masih ditempati" tanpa nama sulit ditindak. */
async function namaPenghuni(idJabatan: number): Promise<string[]> {
  const r = await kueriSatu<{ nama: string | null }>(
    `SELECT GROUP_CONCAT(nama_lengkap ORDER BY nama_lengkap SEPARATOR ', ') AS nama
     FROM pegawai WHERE jabatan_id = ? AND status_aktif = 'AKTIF'`,
    [idJabatan],
  )
  return r?.nama ? r.nama.split(', ') : []
}

export async function buatJabatan(masukan: unknown): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_MASTER_JABATAN)
  if (tolak) return tolak

  const urai = SkemaJabatan.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  try {
    const hasil = await jalankanMutasi({
      entitas: 'jabatan',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_MASTER_JABATAN,
      jalankan: async () => {
        const { insertId } = await eksekusi(
          `INSERT INTO jabatan
             (kode_jabatan, nama_jabatan, unit_organisasi_id, jenis_jabatan, jenjang, eselon, status_jabatan)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            d.kodeJabatan,
            d.namaJabatan,
            d.unitOrganisasiId,
            d.jenisJabatan,
            d.jenjang,
            d.eselon,
            d.statusJabatan,
          ],
        )
        return { entitasId: insertId, sesudah: { id: insertId, ...d } }
      },
    })
    revalidatePath('/master/jabatan')
    revalidatePath('/jabatan-target')
    return berhasil({ id: hasil.entitasId ?? 0 }, `Jabatan "${d.namaJabatan}" ditambahkan.`)
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Kode jabatan "${d.kodeJabatan}"` })
    if (pesan) return gagal(pesan, { kodeJabatan: pesan })
    throw e
  }
}

export async function ubahJabatan(id: unknown, masukan: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_MASTER_JABATAN)
  if (tolak) return tolak

  const idJab = z.number().int().positive().safeParse(id)
  if (!idJab.success) return gagal('Jabatan tidak dikenali.')

  const urai = SkemaJabatan.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  if (d.statusJabatan === 'KOSONG') {
    const penghuni = await namaPenghuni(idJab.data)
    if (penghuni.length > 0) {
      const pesan = `Jabatan ini masih ditempati ${penghuni.length} pegawai aktif (${penghuni.slice(0, 3).join(', ')}${penghuni.length > 3 ? ', …' : ''}), jadi tidak bisa ditandai kosong. Pindahkan pegawainya lebih dulu.`
      return gagal(pesan, { statusJabatan: pesan })
    }
  }

  try {
    await jalankanMutasi({
      entitas: 'jabatan',
      aksi: 'UBAH',
      peranDiizinkan: PERAN_MASTER_JABATAN,
      sebelum: () => bacaJabatan(idJab.data),
      jalankan: async () => {
        await eksekusi(
          `UPDATE jabatan
           SET kode_jabatan = ?, nama_jabatan = ?, unit_organisasi_id = ?, jenis_jabatan = ?,
               jenjang = ?, eselon = ?, status_jabatan = ?
           WHERE id = ?`,
          [
            d.kodeJabatan,
            d.namaJabatan,
            d.unitOrganisasiId,
            d.jenisJabatan,
            d.jenjang,
            d.eselon,
            d.statusJabatan,
            idJab.data,
          ],
        )
        return { entitasId: idJab.data, sesudah: { id: idJab.data, ...d } }
      },
    })
    revalidatePath('/master/jabatan')
    revalidatePath('/jabatan-target')
    return berhasil(undefined, `Jabatan "${d.namaJabatan}" disimpan.`)
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Kode jabatan "${d.kodeJabatan}"` })
    if (pesan) return gagal(pesan, { kodeJabatan: pesan })
    throw e
  }
}

/**
 * Ubah hanya `status_jabatan` — aksi cepat dari tabel tanpa membuka form penuh.
 * Aturan "tidak boleh KOSONG kalau masih ditempati" berlaku sama di sini; kalau
 * hanya dipasang di `ubahJabatan`, jalur pintas ini jadi lubangnya.
 */
export async function ubahStatusJabatan(
  id: unknown,
  status: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_MASTER_JABATAN)
  if (tolak) return tolak

  const idJab = z.number().int().positive().safeParse(id)
  if (!idJab.success) return gagal('Jabatan tidak dikenali.')

  const st = z.enum(STATUS_JABATAN).safeParse(status)
  if (!st.success) return gagal('Status jabatan tidak dikenali.')

  if (st.data === 'KOSONG') {
    const jml = await jumlahPenghuni(idJab.data)
    if (jml > 0) {
      return gagal(
        `Jabatan ini masih ditempati ${jml} pegawai aktif, jadi tidak bisa ditandai kosong. Pindahkan pegawainya lebih dulu.`,
      )
    }
  }

  await jalankanMutasi({
    entitas: 'jabatan',
    aksi: 'UBAH_STATUS',
    peranDiizinkan: PERAN_MASTER_JABATAN,
    sebelum: () => bacaJabatan(idJab.data),
    jalankan: async () => {
      await eksekusi(`UPDATE jabatan SET status_jabatan = ? WHERE id = ?`, [st.data, idJab.data])
      return { entitasId: idJab.data, sesudah: { id: idJab.data, statusJabatan: st.data } }
    },
  })

  revalidatePath('/master/jabatan')
  revalidatePath('/jabatan-target')
  revalidatePath('/')
  return berhasil(undefined, `Status jabatan diubah menjadi ${st.data}.`)
}

/**
 * Jabatan tidak pernah benar-benar dihapus kalau sudah pernah dipakai —
 * ditandai `DIHAPUS`. Menghapus barisnya akan memutus riwayat jabatan pegawai
 * dan membuat jejak karier mereka bolong tanpa jejak apa pun.
 */
export async function hapusJabatan(id: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_MASTER_JABATAN)
  if (tolak) return tolak

  const idJab = z.number().int().positive().safeParse(id)
  if (!idJab.success) return gagal('Jabatan tidak dikenali.')

  const pakai = await kueriSatu<{ pegawai: number; riwayat: number; anggota: number }>(
    `SELECT
       (SELECT COUNT(*) FROM pegawai WHERE jabatan_id = ?)                      AS pegawai,
       (SELECT COUNT(*) FROM riwayat_jabatan WHERE jabatan_id = ?)              AS riwayat,
       -- Dua arah sejak doc/sql/032: jabatan ini bisa jadi KURSI sebuah target
       -- (kolom jabatan_id) ATAU salah satu jabatan ASAL kandidatnya. Memeriksa
       -- satu saja membiarkan penghapusan yang melubangi sisi yang lain.
       (SELECT COUNT(*) FROM jabatan_target_anggota WHERE jabatan_id = ?)
         + (SELECT COUNT(*) FROM jabatan_target WHERE jabatan_id = ?)          AS anggota`,
    [idJab.data, idJab.data, idJab.data, idJab.data],
  )
  const pegawai = Number(pakai?.pegawai ?? 0)
  const riwayat = Number(pakai?.riwayat ?? 0)
  const anggota = Number(pakai?.anggota ?? 0)

  if (pegawai > 0) {
    return gagal(
      `Jabatan ini masih tercatat pada ${pegawai} pegawai. Pindahkan pegawainya lebih dulu.`,
    )
  }

  // Masih tersangkut riwayat atau jabatan target → arsipkan, jangan hapus.
  if (riwayat > 0 || anggota > 0) {
    const sebab = [
      riwayat > 0 ? `${riwayat} riwayat jabatan pegawai` : null,
      anggota > 0 ? `${anggota} keanggotaan jabatan target` : null,
    ].filter(Boolean)

    await jalankanMutasi({
      entitas: 'jabatan',
      aksi: 'UBAH_STATUS',
      peranDiizinkan: PERAN_MASTER_JABATAN,
      sebelum: () => bacaJabatan(idJab.data),
      jalankan: async () => {
        await eksekusi(`UPDATE jabatan SET status_jabatan = 'DIHAPUS' WHERE id = ?`, [idJab.data])
        return { entitasId: idJab.data, sesudah: { id: idJab.data, statusJabatan: 'DIHAPUS' } }
      },
    })
    revalidatePath('/master/jabatan')
    revalidatePath('/jabatan-target')
    return berhasil(
      undefined,
      `Jabatan diarsipkan (status DIHAPUS), bukan dihapus permanen — masih tersangkut ${sebab.join(' dan ')}.`,
    )
  }

  try {
    await jalankanMutasi({
      entitas: 'jabatan',
      aksi: 'HAPUS',
      peranDiizinkan: PERAN_MASTER_JABATAN,
      sebelum: () => bacaJabatan(idJab.data),
      jalankan: async () => {
        await eksekusi(`DELETE FROM jabatan WHERE id = ?`, [idJab.data])
        return { entitasId: idJab.data, sesudah: null }
      },
    })
    revalidatePath('/master/jabatan')
    revalidatePath('/jabatan-target')
    return berhasil(undefined, 'Jabatan dihapus.')
  } catch (e) {
    const pesan = pesanDariGalatDb(e, {})
    if (pesan) return gagal(pesan)
    throw e
  }
}
