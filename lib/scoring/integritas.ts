import { KEPARAHAN_HUKUMAN, SKOR_INTEGRITAS } from './konstanta'
import type { TingkatHukuman } from './types'

/**
 * Komponen Integritas & Moralitas (KERANGKA §B.3).
 *
 * CATATAN SKALA: ini satu-satunya skala integritas di sistem — 0–100. Kolom
 * `asesmen_talenta.nilai_integritas` juga memakai skala ini (phase.md §2.7).
 * Kalau sumber mengirim skala lain, importer yang menormalisasi, bukan UI.
 */

export interface RiwayatHukuman {
  tingkatHukuman: TingkatHukuman
  statusAktif: boolean
}

export interface HasilIntegritas {
  skor: number
  tingkatTerberat: TingkatHukuman
  /** Jumlah riwayat aktif yang diperhitungkan. */
  jumlahAktif: number
  /** Jumlah riwayat tidak aktif yang diabaikan — ditampilkan sbg konteks di UI. */
  jumlahNonaktif: number
  keterangan: string
}

/**
 * Ambil tingkat hukuman TERBERAT yang masih `status_aktif = 1`.
 *
 * Baris `status_aktif = 0` dianggap sudah tidak berlaku dan TIDAK menurunkan
 * skor. Aturan ini belum dikonfirmasi resmi (PRD.md §10 poin 8) — kalau nanti
 * ada masa kedaluwarsa formal, cukup ubah di sini.
 */
export function hitungSkorIntegritas(riwayat: RiwayatHukuman[]): HasilIntegritas {
  const aktif = riwayat.filter((r) => r.statusAktif && r.tingkatHukuman !== 'Tidak Pernah')
  const nonaktif = riwayat.filter((r) => !r.statusAktif && r.tingkatHukuman !== 'Tidak Pernah')

  if (aktif.length === 0) {
    return {
      skor: SKOR_INTEGRITAS['Tidak Pernah'],
      tingkatTerberat: 'Tidak Pernah',
      jumlahAktif: 0,
      jumlahNonaktif: nonaktif.length,
      keterangan:
        nonaktif.length > 0
          ? `Tidak ada hukuman disiplin aktif (${nonaktif.length} riwayat sudah tidak berlaku, tidak memengaruhi skor)`
          : 'Tidak pernah dijatuhi hukuman disiplin',
    }
  }

  let terberat: TingkatHukuman = aktif[0]!.tingkatHukuman
  for (const r of aktif) {
    if (KEPARAHAN_HUKUMAN.indexOf(r.tingkatHukuman) > KEPARAHAN_HUKUMAN.indexOf(terberat)) {
      terberat = r.tingkatHukuman
    }
  }

  return {
    skor: SKOR_INTEGRITAS[terberat],
    tingkatTerberat: terberat,
    jumlahAktif: aktif.length,
    jumlahNonaktif: nonaktif.length,
    keterangan: `Hukuman disiplin aktif terberat: ${terberat}`,
  }
}
