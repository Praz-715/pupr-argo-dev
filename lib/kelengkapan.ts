/**
 * Skor kelengkapan data per pegawai (usulan U-2 phase.md §8).
 *
 * PRD §2 menargetkan "akurasi & kelengkapan data ≥90%", tapi tidak ada definisi
 * operasionalnya. Modul ini yang mendefinisikan: daftar butir yang diperiksa,
 * bobotnya, dan alasan tiap butir penting. Dipakai bersama oleh badge di Profil
 * Talenta (Fase 2), widget Kesehatan Data (Fase 1), dan halaman Kelengkapan Data
 * (Fase 4) — supaya angkanya tidak pernah beda antar halaman.
 *
 * Bobot mencerminkan **dampak ke penilaian**, bukan sekadar jumlah kolom:
 * data yang menjadi input rubrik diberi bobot lebih besar daripada data
 * administratif, karena kekosongannya langsung membuat skor tidak bisa dihitung.
 */

export type KategoriKelengkapan = 'IDENTITAS' | 'PENILAIAN' | 'RIWAYAT' | 'INTEGRITAS'

export interface ButirKelengkapan {
  kunci: string
  label: string
  kategori: KategoriKelengkapan
  bobot: number
  /** Kenapa butir ini penting — ditampilkan sebagai alasan di UI. */
  alasan: string
}

export const BUTIR_KELENGKAPAN: ButirKelengkapan[] = [
  {
    kunci: 'nipValid',
    label: 'NIP valid 18 digit',
    kategori: 'IDENTITAS',
    bobot: 2,
    alasan: 'NIP memuat tanggal lahir & TMT CPNS; kalau tidak valid, usia dan proyeksi pensiun tidak bisa diturunkan',
  },
  {
    kunci: 'jabatanTertaut',
    label: 'Tertaut ke master jabatan',
    kategori: 'IDENTITAS',
    bobot: 3,
    alasan: 'Eselon dan unit organisasi diturunkan dari jabatan — tanpa ini pegawai tidak muncul di agregasi per unit',
  },
  {
    kunci: 'tmtLengkap',
    label: 'TMT golongan & jabatan terisi',
    kategori: 'IDENTITAS',
    bobot: 2,
    alasan: 'Dipakai menghitung lama menjabat pada indikator Lama Jabatan',
  },
  {
    kunci: 'adaAsesmen',
    label: 'Punya asesmen talenta',
    kategori: 'PENILAIAN',
    bobot: 4,
    alasan: 'Tanpa asesmen, pegawai tidak punya posisi di Kotak 9 dan tidak bisa dinilai untuk jabatan target',
  },
  {
    kunci: 'asesmenBerlaku',
    label: 'Asesmen masih berlaku',
    kategori: 'PENILAIAN',
    bobot: 3,
    alasan: 'Asesmen kedaluwarsa tidak eligible untuk talent pool',
  },
  {
    kunci: 'adaKinerjaTahunan',
    label: 'Nilai kinerja tahunan terisi',
    kategori: 'PENILAIAN',
    bobot: 3,
    alasan: 'Sumbu Kinerja pada Kotak 9 diturunkan dari predikat kinerja',
  },
  {
    kunci: 'kinerjaTriwulanLengkap',
    label: 'Kinerja TW1–TW3 lengkap',
    kategori: 'PENILAIAN',
    bobot: 1,
    alasan: 'Dibutuhkan grafik tren kinerja; ketidaklengkapannya tidak menghalangi penilaian',
  },
  {
    kunci: 'adaPendidikan',
    label: 'Riwayat pendidikan terisi',
    kategori: 'RIWAYAT',
    bobot: 3,
    alasan: 'Input indikator Tingkat Pendidikan Formal & Kesesuaian Bidang Ilmu',
  },
  {
    kunci: 'pendidikanBertahun',
    label: 'Tahun lulus pendidikan terisi',
    kategori: 'RIWAYAT',
    bobot: 1,
    alasan: 'Diperlukan untuk verifikasi keabsahan ijazah',
  },
  {
    kunci: 'adaDiklat',
    label: 'Riwayat diklat terisi',
    kategori: 'RIWAYAT',
    bobot: 2,
    alasan: 'Input indikator Pengembangan Kompetensi',
  },
  {
    kunci: 'riwayatJabatanBertanggal',
    label: 'Riwayat jabatan bertanggal',
    kategori: 'RIWAYAT',
    bobot: 3,
    alasan: 'Tanpa tanggal, indikator Lama Jabatan tidak bisa dihitung otomatis',
  },
  {
    kunci: 'riwayatJabatanTerpetakan',
    label: 'Riwayat jabatan terpetakan',
    kategori: 'RIWAYAT',
    bobot: 2,
    alasan: 'Input indikator Keragaman Riwayat Jabatan (butuh unit organisasi tiap riwayat)',
  },
  {
    kunci: 'disiplinTerverifikasi',
    label: 'Rekam jejak disiplin terverifikasi',
    kategori: 'INTEGRITAS',
    bobot: 3,
    alasan:
      'Tanpa catatan, sistem menganggap "tidak pernah dihukum" (skor 100) — itu asumsi, bukan fakta terverifikasi',
  },
]

const TOTAL_BOBOT = BUTIR_KELENGKAPAN.reduce((n, b) => n + b.bobot, 0)

/** Fakta mentah per pegawai; diisi oleh kueri, bukan dihitung di sini. */
export type FaktaKelengkapan = Record<string, boolean>

export interface HasilKelengkapan {
  persen: number
  bobotTerpenuhi: number
  bobotTotal: number
  terpenuhi: ButirKelengkapan[]
  belum: ButirKelengkapan[]
  /** Butir belum terpenuhi dengan bobot tertinggi — saran tindakan berikutnya. */
  prioritas: ButirKelengkapan | null
}

export function hitungKelengkapan(fakta: FaktaKelengkapan): HasilKelengkapan {
  const terpenuhi: ButirKelengkapan[] = []
  const belum: ButirKelengkapan[] = []

  for (const butir of BUTIR_KELENGKAPAN) {
    if (fakta[butir.kunci] === true) terpenuhi.push(butir)
    else belum.push(butir)
  }

  const bobotTerpenuhi = terpenuhi.reduce((n, b) => n + b.bobot, 0)
  const prioritas =
    belum.length === 0
      ? null
      : belum.reduce((a, b) => (b.bobot > a.bobot ? b : a), belum[0]!)

  return {
    persen: Math.round((bobotTerpenuhi / TOTAL_BOBOT) * 1000) / 10,
    bobotTerpenuhi,
    bobotTotal: TOTAL_BOBOT,
    terpenuhi,
    belum,
    prioritas,
  }
}

export type TingkatKelengkapan = 'LENGKAP' | 'CUKUP' | 'KURANG'

/** Ambang sama dengan widget Kesehatan Data supaya angka & warna konsisten. */
export function tingkatKelengkapan(persen: number): TingkatKelengkapan {
  if (persen >= 90) return 'LENGKAP'
  if (persen >= 60) return 'CUKUP'
  return 'KURANG'
}

export const LABEL_TINGKAT: Record<TingkatKelengkapan, string> = {
  LENGKAP: 'Data lengkap',
  CUKUP: 'Perlu dilengkapi',
  KURANG: 'Banyak data kosong',
}
