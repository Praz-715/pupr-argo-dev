/**
 * Parser & validator NIP ASN (18 digit).
 *
 * Format: YYYYMMDD (tanggal lahir) + YYYYMM (TMT CPNS) + S (1=L, 2=P) + NNN (urut)
 * Contoh:  19780525          199803         2          005
 *
 * NIP menyimpan tanggal lahir & jenis kelamin yang TIDAK ada sebagai kolom di
 * tabel `pegawai`. Semua nilai di sini bersifat TURUNAN — jangan didenormalisasi
 * ke kolom baru kecuali terbukti jadi hambatan performa (phase.md §3 K-6).
 */

export type JenisKelamin = 'L' | 'P'

export interface NipTerurai {
  nip: string
  valid: boolean
  tanggalLahir: Date | null
  tmtCpnsTahun: number | null
  tmtCpnsBulan: number | null
  jenisKelamin: JenisKelamin | null
  nomorUrut: string | null
  masalah: string[]
}

const TAHUN_LAHIR_PALING_AWAL = 1930

/** Bikin Date lokal tengah hari supaya bebas geser zona waktu. */
function tanggalLokal(tahun: number, bulan1sd12: number, hari: number): Date {
  return new Date(tahun, bulan1sd12 - 1, hari, 12, 0, 0, 0)
}

function tanggalMasukAkal(tahun: number, bulan: number, hari: number): boolean {
  if (bulan < 1 || bulan > 12) return false
  if (hari < 1 || hari > 31) return false
  const d = tanggalLokal(tahun, bulan, hari)
  return d.getFullYear() === tahun && d.getMonth() === bulan - 1 && d.getDate() === hari
}

export function parseNip(nipMentah: string | null | undefined, pada: Date = new Date()): NipTerurai {
  const nip = (nipMentah ?? '').trim()
  const kosong: NipTerurai = {
    nip,
    valid: false,
    tanggalLahir: null,
    tmtCpnsTahun: null,
    tmtCpnsBulan: null,
    jenisKelamin: null,
    nomorUrut: null,
    masalah: [],
  }

  if (nip.length === 0) return { ...kosong, masalah: ['NIP kosong'] }
  if (!/^\d+$/.test(nip)) return { ...kosong, masalah: ['NIP harus berisi angka saja'] }
  if (nip.length !== 18) {
    return { ...kosong, masalah: [`Panjang NIP ${nip.length} digit, seharusnya 18`] }
  }

  const masalah: string[] = []

  const thnLahir = Number(nip.slice(0, 4))
  const blnLahir = Number(nip.slice(4, 6))
  const hrLahir = Number(nip.slice(6, 8))
  const thnCpns = Number(nip.slice(8, 12))
  const blnCpns = Number(nip.slice(12, 14))
  const digitJk = nip.slice(14, 15)
  const nomorUrut = nip.slice(15)

  let tanggalLahir: Date | null = null
  if (!tanggalMasukAkal(thnLahir, blnLahir, hrLahir)) {
    masalah.push(`Tanggal lahir tidak valid (${nip.slice(0, 8)})`)
  } else if (thnLahir < TAHUN_LAHIR_PALING_AWAL) {
    masalah.push(`Tahun lahir ${thnLahir} terlalu awal`)
  } else {
    tanggalLahir = tanggalLokal(thnLahir, blnLahir, hrLahir)
    if (tanggalLahir.getTime() > pada.getTime()) {
      masalah.push('Tanggal lahir di masa depan')
      tanggalLahir = null
    }
  }

  let tmtCpnsTahun: number | null = null
  let tmtCpnsBulan: number | null = null
  if (blnCpns < 1 || blnCpns > 12) {
    masalah.push(`Bulan TMT CPNS tidak valid (${nip.slice(12, 14)})`)
  } else if (thnCpns < TAHUN_LAHIR_PALING_AWAL) {
    masalah.push(`Tahun TMT CPNS ${thnCpns} tidak masuk akal`)
  } else if (tanggalLokal(thnCpns, blnCpns, 1).getTime() > pada.getTime()) {
    masalah.push('TMT CPNS di masa depan')
  } else {
    tmtCpnsTahun = thnCpns
    tmtCpnsBulan = blnCpns
    if (tanggalLahir && thnCpns < thnLahir + 17) {
      masalah.push('TMT CPNS kurang dari 17 tahun setelah tanggal lahir')
    }
  }

  let jenisKelamin: JenisKelamin | null = null
  if (digitJk === '1') jenisKelamin = 'L'
  else if (digitJk === '2') jenisKelamin = 'P'
  else masalah.push(`Digit jenis kelamin tidak dikenal (${digitJk}), seharusnya 1 atau 2`)

  return {
    nip,
    valid: masalah.length === 0,
    tanggalLahir,
    tmtCpnsTahun,
    tmtCpnsBulan,
    jenisKelamin,
    nomorUrut,
    masalah,
  }
}

/** Usia penuh (tahun) pada tanggal tertentu. */
export function hitungUsia(tanggalLahir: Date | null, pada: Date = new Date()): number | null {
  if (!tanggalLahir) return null
  let usia = pada.getFullYear() - tanggalLahir.getFullYear()
  const belumUlangTahun =
    pada.getMonth() < tanggalLahir.getMonth() ||
    (pada.getMonth() === tanggalLahir.getMonth() && pada.getDate() < tanggalLahir.getDate())
  if (belumUlangTahun) usia -= 1
  return usia
}

/** Selisih tahun desimal antara dua tanggal (untuk masa kerja / lama jabatan). */
export function selisihTahun(dari: Date | null, sampai: Date = new Date()): number | null {
  if (!dari) return null
  const ms = sampai.getTime() - dari.getTime()
  if (ms < 0) return 0
  return ms / (1000 * 60 * 60 * 24 * 365.25)
}

export type JenisJabatan = 'STRUKTURAL' | 'FUNGSIONAL_TERTENTU' | 'FUNGSIONAL_UMUM'

/**
 * Batas Usia Pensiun menurut jenis & jenjang jabatan:
 *   65 — Pejabat Fungsional Ahli Utama
 *   60 — Pejabat Pimpinan Tinggi (JPT) & Pejabat Fungsional Ahli Madya
 *   58 — Pejabat Administrasi (Administrator, Pengawas, Pelaksana) & JF lainnya
 *
 * `jenjang` memakai teks kolom `jabatan.jenjang` (mis. "Administrator",
 * "JPT Pratama", "Ahli Utama", "Ahli Madya").
 */
export function batasUsiaPensiun(jenisJabatan: JenisJabatan | null, jenjang: string | null): 58 | 60 | 65 {
  const j = (jenjang ?? '').toLowerCase()

  if (jenisJabatan === 'FUNGSIONAL_TERTENTU') {
    if (j.includes('utama')) return 65
    if (j.includes('madya')) return 60
    return 58
  }

  if (j.includes('jpt') || j.includes('pimpinan tinggi') || j.includes('pratama')) return 60

  return 58
}

export interface ProyeksiPensiun {
  batasUsia: 58 | 60 | 65
  /** Akhir bulan saat pegawai mencapai BUP (aturan umum ASN: pensiun akhir bulan). */
  tanggalPensiun: Date | null
  tahunTersisa: number | null
  /** true bila BUP tercapai dalam <= 24 bulan — bahan halaman Risiko Kekosongan (U-6). */
  segeraPensiun: boolean
}

export function proyeksiPensiun(
  tanggalLahir: Date | null,
  jenisJabatan: JenisJabatan | null,
  jenjang: string | null,
  pada: Date = new Date(),
): ProyeksiPensiun {
  const batasUsia = batasUsiaPensiun(jenisJabatan, jenjang)
  if (!tanggalLahir) {
    return { batasUsia, tanggalPensiun: null, tahunTersisa: null, segeraPensiun: false }
  }

  // Akhir bulan pada saat usia BUP tercapai.
  const tahunPensiun = tanggalLahir.getFullYear() + batasUsia
  const tanggalPensiun = new Date(tahunPensiun, tanggalLahir.getMonth() + 1, 0, 12, 0, 0, 0)
  const tahunTersisa = (tanggalPensiun.getTime() - pada.getTime()) / (1000 * 60 * 60 * 24 * 365.25)

  return {
    batasUsia,
    tanggalPensiun,
    tahunTersisa,
    segeraPensiun: tahunTersisa <= 2,
  }
}
