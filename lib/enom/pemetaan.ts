import type { ParameterSkoring } from '../scoring'
import {
  normalisasiAsesmen,
  buatTemuan,
  type AsesmenBersih,
  type Temuan,
} from '@/lib/importer'
import { skorPredikat } from '@/lib/scoring'
import type { RekamanEnom } from './tipe'

/**
 * Terjemahan payload eNom → bentuk yang dimengerti `lib/importer`.
 *
 * **Modul ini sengaja TIPIS dan tidak mengandung satu pun aturan bisnis.**
 * Clamp skor, hitung ulang Kotak 9, banding terhadap `kotak_9` sumber, kenaikan
 * skala integritas, dan evaluasi masa berlaku semuanya sudah hidup di
 * `normalisasiAsesmen()`. Menyalinnya ke sini akan menghasilkan dua definisi
 * yang berselisih diam-diam — persis yang dilarang CLAUDE.md §Prinsip Kerja
 * nomor 2. Yang eNom-spesifik hanya bentuk payload-nya: nama field, angka yang
 * datang sebagai string, dan predikat yang datang HURUF BESAR.
 *
 * Murni & bebas DB/jaringan, jadi bisa diuji tanpa menyentuh eNom.
 */

export interface AsesmenTerpetakan {
  nip: string
  namaSumber: string | null
  /** Hasil normalisasi — siap dibandingkan dengan isi `asesmen_talenta`. */
  asesmen: AsesmenBersih
  /** `kotak` apa adanya dari eNom. Pembanding kualitas data, BUKAN perhitungan. */
  kotak9Sumber: number | null
  tahunKinerja: number | null
  predikatKinerja: string | null
  temuan: Temuan[]
}

/**
 * Petakan satu rekaman eNom.
 *
 * Mengembalikan `null` hanya ketika barisnya tidak bisa dipakai sama sekali —
 * yaitu saat predikat kinerjanya tidak dikenali, sebab predikat itulah satu-
 * satunya sumber sumbu Y. Menebak Y dari nilai lain akan menghasilkan Kotak 9
 * yang tampak wajar dan salah, dan angka yang salah tapi wajar jauh lebih
 * berbahaya daripada baris yang hilang dengan temuan tercatat.
 */
export function petakanRekaman(
  r: RekamanEnom,
  opsi: { tahunSekarang: number } & ParameterSkoring,
): { hasil: AsesmenTerpetakan | null; temuan: Temuan[] } {
  const temuan: Temuan[] = []

  // `skorPredikat` sudah case-insensitive & merapikan spasi, jadi "SANGAT BAIK"
  // dari eNom cocok dengan "Sangat Baik" di rubrik tanpa peta terjemahan sendiri.
  const y = skorPredikat(r.predikat_kinerja, opsi.skalaPredikat)
  if (y === null) {
    return {
      hasil: null,
      temuan: [
        buatTemuan(
          'PREDIKAT_TIDAK_DIKENALI',
          'predikat_kinerja',
          r.predikat_kinerja ?? null,
          null,
          `Predikat "${r.predikat_kinerja ?? '(kosong)'}" tidak ada di rubrik ` +
            '(Sangat Baik/Baik/Butuh Perbaikan/Kurang/Sangat Kurang). ' +
            'Baris dilewati — sumbu Y tidak bisa diturunkan dari nilai lain.',
        ),
      ],
    }
  }

  const hasil = normalisasiAsesmen(
    {
      tahunAsesmen: r.tahun_asesmen,
      jenisAsesmen: r.jenis_asesmen ?? r.jenjang ?? null,
      // eNom tidak mengirim status asesmen; `normalisasiAsesmen` menghitungnya
      // sendiri dari umur asesmen (aturan 3 tahun). Jangan mengarang "Berlaku"
      // di sini — itu akan menutupi asesmen kedaluwarsa.
      statusAsesmen: null,
      nilaiKinerjaY: y,
      potkom: r.nilai_potkom,
      nilaiIntegritas: r.nilai_integritas ?? null,
      kotak9Sumber: r.kotak ?? null,
    },
    opsi,
  )

  temuan.push(...hasil.temuan)

  return {
    hasil: {
      nip: r.nip,
      namaSumber: r.nama_pegawai ?? null,
      asesmen: hasil.nilai,
      kotak9Sumber: r.kotak ?? null,
      tahunKinerja: r.tahun_kinerja ?? null,
      predikatKinerja: r.predikat_kinerja ?? null,
      temuan: hasil.temuan,
    },
    temuan,
  }
}

/** Petakan sekumpulan rekaman. Baris yang tidak terpakai tetap meninggalkan temuan. */
export function petakanSemua(
  rekaman: readonly RekamanEnom[],
  opsi: { tahunSekarang: number } & ParameterSkoring,
): { hasil: AsesmenTerpetakan[]; temuan: Temuan[] } {
  const hasil: AsesmenTerpetakan[] = []
  const temuan: Temuan[] = []
  for (const r of rekaman) {
    const satu = petakanRekaman(r, opsi)
    temuan.push(...satu.temuan)
    if (satu.hasil) hasil.push(satu.hasil)
  }
  return { hasil, temuan }
}
