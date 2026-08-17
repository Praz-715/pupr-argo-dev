import 'server-only'

import { cache } from 'react'

import { kueriSatu } from '../db'
import { HANYA_SUMBER } from './dasar'

/**
 * Berapa pegawai yang DISEMBUNYIKAN oleh filter populasi.
 *
 * Ada karena saklar `HANYA_PEGAWAI_SUMBER` menciptakan masalah yang lebih buruk
 * daripada yang dipecahkannya kalau dibiarkan senyap: aplikasi menampilkan 10
 * pegawai, kartu KPI menulis "Seluruh pegawai terdata berstatus aktif", dan
 * pembaca menyimpulkan DJBK punya 10 pegawai. Sementara di layar yang sama,
 * jabatan (19) dan nominasi (6) TIDAK disaring — jadi dua skala berbeda duduk
 * berdampingan tanpa penanda apa pun.
 *
 * Prinsipnya sama dengan `lib/importer`: data yang disaring diam-diam
 * menghilangkan sinyal. Kalau tampilan dibatasi, halamannya yang harus
 * menyatakannya — bukan pembacanya yang harus menebak.
 *
 * `cache()` per permintaan: app shell merendernya sekali, tapi tiap halaman
 * memanggil layout yang sama.
 */
export const ringkasPopulasi = cache(
  async (): Promise<{ aktif: boolean; ditampilkan: number; total: number } | null> => {
    if (!HANYA_SUMBER) return null
    const r = await kueriSatu<{ ditampilkan: number; total: number }>(`
      SELECT
        (SELECT COUNT(*) FROM pegawai p
          WHERE EXISTS (SELECT 1 FROM asesmen_talenta a
                         WHERE a.pegawai_id = p.id AND a.sumber_sync = 'eNominasi')) AS ditampilkan,
        (SELECT COUNT(*) FROM pegawai) AS total
    `)
    return {
      aktif: true,
      ditampilkan: Number(r?.ditampilkan ?? 0),
      total: Number(r?.total ?? 0),
    }
  },
)
