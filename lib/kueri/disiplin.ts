import 'server-only'

import { kueri, kueriSatu } from '../db'
import { filterSumber, filterSumberPegawaiId, filterSumberTanpaAlias } from './dasar'
import { SKOR_INTEGRITAS, type TingkatHukuman } from '../scoring'

/**
 * Kueri Data Hukuman Disiplin — data ASN sensitif (PRD §7.3).
 *
 * Berkas ini TIDAK memeriksa wewenang; itu tugas halaman/aksi pemanggilnya
 * (`assertPeran`). Alasannya konsistensi: kalau sebagian kueri memeriksa sendiri
 * dan sebagian tidak, tidak ada lagi satu tempat untuk memastikan penjagaannya
 * lengkap. Yang dijamin di sini: kueri hanya mengembalikan apa yang diminta.
 */

export interface BarisDisiplin {
  id: number
  pegawaiId: number
  nip: string
  nama: string
  namaUnit: string | null
  tingkatHukuman: TingkatHukuman
  tanggalSk: Date | null
  noSk: string | null
  keterangan: string | null
  statusAktif: boolean
  diinputOleh: string | null
  createdAt: Date
  /** Skor integritas yang dihasilkan tingkat ini (phase.md §2.7). */
  skorIntegritas: number
}

export async function ambilDaftarDisiplin(opsi: {
  cari?: string
  tingkat?: string
  hanyaAktif?: boolean
}): Promise<BarisDisiplin[]> {
  const syarat: string[] = []
  const params: unknown[] = []

  if (opsi.cari && opsi.cari.trim() !== '') {
    const q = `%${opsi.cari.trim()}%`
    syarat.push('(p.nama_lengkap LIKE ? OR p.nip LIKE ? OR h.no_sk LIKE ?)')
    params.push(q, q.replace(/\s/g, ''), q)
  }
  if (opsi.tingkat) {
    syarat.push('h.tingkat_hukuman = ?')
    params.push(opsi.tingkat)
  }
  if (opsi.hanyaAktif) syarat.push('h.status_aktif = 1')
  // Barisnya adalah catatan hukuman MILIK SEORANG PEGAWAI, jadi ia ikut filter
  // populasi seperti halaman lain — daftar yang menyebut nama di luar populasi
  // yang ditampilkan membocorkan justru data paling sensitif di aplikasi ini.
  const batasPopulasi = filterSumber('p')
  if (batasPopulasi) syarat.push(batasPopulasi.replace(/^ AND /, ''))

  const where = syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : ''

  const baris = await kueri<Record<string, unknown>>(
    `SELECT h.id, h.pegawai_id, p.nip, p.nama_lengkap, u.nama_unit,
            h.tingkat_hukuman, h.tanggal_sk, h.no_sk, h.keterangan, h.status_aktif,
            h.created_at, ui.nama AS nama_input
     FROM hukuman_disiplin h
     JOIN pegawai p ON p.id = h.pegawai_id
     LEFT JOIN jabatan j ON j.id = p.jabatan_id
     LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     LEFT JOIN users ui ON ui.id = h.input_by
     ${where}
     ORDER BY h.status_aktif DESC,
              FIELD(h.tingkat_hukuman,'Sedang Menjalani','Berat','Sedang','Ringan','Tidak Pernah'),
              h.tanggal_sk DESC`,
    params,
  )

  return baris.map((r) => {
    const tingkat = String(r.tingkat_hukuman) as TingkatHukuman
    return {
      id: Number(r.id),
      pegawaiId: Number(r.pegawai_id),
      nip: String(r.nip),
      nama: String(r.nama_lengkap),
      namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
      tingkatHukuman: tingkat,
      tanggalSk: r.tanggal_sk === null ? null : new Date(String(r.tanggal_sk)),
      noSk: r.no_sk === null ? null : String(r.no_sk),
      keterangan: r.keterangan === null ? null : String(r.keterangan),
      statusAktif: Number(r.status_aktif) === 1,
      diinputOleh: r.nama_input === null ? null : String(r.nama_input),
      createdAt: new Date(String(r.created_at)),
      skorIntegritas: SKOR_INTEGRITAS[tingkat] ?? 0,
    }
  })
}

export interface RingkasDisiplin {
  totalCatatan: number
  catatanAktif: number
  pegawaiTerdampak: number
  /** Pegawai aktif yang tidak punya catatan sama sekali. */
  tanpaCatatan: number
  perTingkat: Array<{ tingkat: string; jumlah: number; aktif: number }>
}

export async function ambilRingkasDisiplin(): Promise<RingkasDisiplin> {
  const [ringkas, perTingkat] = await Promise.all([
    kueriSatu<Record<string, unknown>>(`
      SELECT COUNT(*)                                   AS total,
             SUM(h.status_aktif = 1)                    AS aktif,
             COUNT(DISTINCT h.pegawai_id)               AS pegawai,
             (SELECT COUNT(*) FROM pegawai p
                WHERE p.status_aktif = 'AKTIF'
                  ${filterSumber('p')}
                  AND NOT EXISTS (SELECT 1 FROM hukuman_disiplin x
                                    WHERE x.pegawai_id = p.id)) AS tanpa
      FROM hukuman_disiplin h
      WHERE 1 = 1 ${filterSumberPegawaiId('h.pegawai_id')}
    `),
    kueri<Record<string, unknown>>(`
      SELECT tingkat_hukuman, COUNT(*) AS jumlah, SUM(status_aktif = 1) AS aktif
      FROM hukuman_disiplin
      WHERE 1 = 1 ${filterSumberPegawaiId('pegawai_id')}
      GROUP BY tingkat_hukuman
      ORDER BY FIELD(tingkat_hukuman,'Sedang Menjalani','Berat','Sedang','Ringan','Tidak Pernah')
    `),
  ])

  return {
    totalCatatan: Number(ringkas?.total ?? 0),
    catatanAktif: Number(ringkas?.aktif ?? 0),
    pegawaiTerdampak: Number(ringkas?.pegawai ?? 0),
    tanpaCatatan: Number(ringkas?.tanpa ?? 0),
    perTingkat: perTingkat.map((r) => ({
      tingkat: String(r.tingkat_hukuman),
      jumlah: Number(r.jumlah),
      aktif: Number(r.aktif),
    })),
  }
}

/** Opsi pegawai untuk form — nama + NIP saja, tanpa data lain. */
export async function ambilOpsiPegawai(): Promise<Array<{ id: number; label: string }>> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT id, nip, nama_lengkap FROM pegawai
     WHERE status_aktif = 'AKTIF' ${filterSumberTanpaAlias()}
     ORDER BY nama_lengkap`,
  )
  return baris.map((r) => ({
    id: Number(r.id),
    label: `${String(r.nama_lengkap)} — ${String(r.nip)}`,
  }))
}
