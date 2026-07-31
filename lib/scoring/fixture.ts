import type { IndikatorNode, KategoriSkor, KomponenNode } from './types'

/**
 * Fixture rubrik yang MENIRU isi `pupr_dev` untuk jabatan target 1
 * ("Kepala Balai BP2JK / Kepala Subdirektorat Direktorat Pengadaan"),
 * turunan doc/KERANGKA TALENT POOL.md.
 *
 * Dipakai oleh uji dan oleh halaman "Simulasi Rubrik" (Fase 5) sebagai contoh
 * bawaan. Bukan data produksi.
 */

function kat(
  nama: string,
  nilaiSkor: number | null,
  urutan: number,
  ambangMin: number | null = null,
  ambangMax: number | null = null,
): KategoriSkor {
  return { namaKategori: nama, nilaiSkor, ambangMin, ambangMax, urutan }
}

function indikator(
  id: number,
  nama: string,
  bobot: number | null,
  modeSkor: IndikatorNode['modeSkor'],
  urutan: number,
  kategori: KategoriSkor[] = [],
  anak: IndikatorNode[] = [],
): IndikatorNode {
  return { id, namaIndikator: nama, bobot, modeSkor, urutan, kategori, anak }
}

/** KERANGKA §B.1 — kategori Potkom (batas atas eksklusif disimpan sbg ambang_max). */
export const KATEGORI_POTKOM: KategoriSkor[] = [
  kat('Memenuhi Syarat', null, 1, 80, null),
  kat('Masih Memenuhi Syarat', null, 2, 68, 80),
  kat('Kurang Memenuhi Syarat', null, 3, null, 68),
]

/** KERANGKA §A — predikat kinerja. */
export const KATEGORI_PREDIKAT: KategoriSkor[] = [
  kat('Sangat Baik', 100, 1),
  kat('Baik', 80, 2),
  kat('Butuh Perbaikan', 60, 3),
  kat('Kurang', 40, 4),
  kat('Sangat Kurang', 20, 5),
]

/** KERANGKA §B.2.1 */
export const KATEGORI_PENDIDIKAN: KategoriSkor[] = [
  kat('Doktor', 100, 1),
  kat('Magister', 90, 2),
  kat('S1/DIV', 80, 3),
  kat('DIII', 70, 4),
  kat('SLTA', 60, 5),
]

const KATEGORI_BINER = (ya: string, tidak: string): KategoriSkor[] => [
  kat(ya, 100, 1),
  kat(tidak, 50, 2),
]

/**
 * Lama Jabatan versi rentang SUDAH KONTINU (phase.md §2.8a):
 * ≥5 → 100 · ≥2–<5 → 80 · <2 → 60
 */
export const KATEGORI_LAMA_JABATAN_KONTINU: KategoriSkor[] = [
  kat('Masa kerja dalam jenjang jabatan 5 tahun ke atas', 100, 1, 5, null),
  kat('Masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80, 2, 2, 5),
  kat('Masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60, 3, null, 2),
]

/**
 * Versi APA ADANYA dari doc — punya lubang di (4,5) dan [2,3).
 * Disimpan untuk menguji jaring pengaman fallback (phase.md §2.8b).
 */
export const KATEGORI_LAMA_JABATAN_BERLUBANG: KategoriSkor[] = [
  kat('Masa kerja 5 tahun ke atas', 100, 1, 5, null),
  kat('Masa kerja 3 sampai dengan 4 tahun', 80, 2, 3, 4),
  kat('Masa kerja kurang dari 2 tahun', 60, 3, null, 2),
]

export const KATEGORI_KERAGAMAN: KategoriSkor[] = [
  kat('Pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100, 1),
  kat('Pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80, 2),
  kat('Pengalaman jabatan satu Unit Kerja', 60, 3),
]

export const KATEGORI_SUBSTANSI: KategoriSkor[] = [
  kat('Plt pada jenjang jabatan yang lebih tinggi', 100, 1),
  kat('Plt pada jenjang jabatan yang setara', 80, 2),
  kat('Plh pada jenjang jabatan yang lebih tinggi', 60, 3),
  kat('Plh pada jenjang jabatan yang setara', 40, 4),
  kat('Tidak memiliki riwayat jabatan non-definitif', 0, 5),
]

/** KERANGKA §B.3 */
export const KATEGORI_INTEGRITAS: KategoriSkor[] = [
  kat('Tidak Pernah', 100, 1),
  kat('Ringan', 75, 2),
  kat('Sedang', 50, 3),
  kat('Berat', 25, 4),
  kat('Sedang Menjalani', 0, 5),
]

/** ID indikator dibuat sama dengan `pupr_dev` supaya uji mudah dicocokkan. */
export const ID_INDIKATOR = {
  potkomGenerik: 2,
  predikatGenerik: 1,
  potkom: 3,
  tingkatPendidikan: 4,
  kesesuaianBidangIlmu: 5,
  pengembanganKompetensi: 6,
  pengalamanJabatan: 7,
  lamaJabatan: 8,
  keragamanJabatan: 9,
  substansiJabatan: 10,
  integritas: 11,
} as const

/** Rubrik generik (jabatan_target_id IS NULL) — dipakai Formula A. */
export const RUBRIK_GENERIK: KomponenNode[] = [
  {
    id: 1,
    sumbu: 'Y_KINERJA',
    namaKomponen: 'Kinerja Utama',
    bobot: 1,
    urutan: 1,
    indikator: [
      indikator(
        ID_INDIKATOR.predikatGenerik,
        'Penilaian Kinerja',
        1,
        'KATEGORI_TETAP',
        1,
        KATEGORI_PREDIKAT,
      ),
    ],
  },
  {
    id: 2,
    sumbu: 'X_POTENSIAL',
    namaKomponen: 'Potensi & Kompetensi (Generik)',
    bobot: 1,
    urutan: 1,
    indikator: [
      indikator(
        ID_INDIKATOR.potkomGenerik,
        'Penilaian Potensi dan Kompetensi',
        1,
        'NILAI_LANGSUNG',
        1,
        [kat('Tinggi', null, 1, 80, null), kat('Menengah', null, 2, 60, 80), kat('Rendah', null, 3, null, 60)],
      ),
    ],
  },
]

/**
 * Rubrik sumbu X untuk 1 jabatan target — Formula B (65/20/15).
 * Perhatikan: TIDAK ada komponen Y_KINERJA di sini (phase.md §3 K-4).
 */
export function rubrikJabatanTarget(
  opsi: { lamaJabatanKontinu?: boolean } = {},
): KomponenNode[] {
  const kategoriLama = opsi.lamaJabatanKontinu === false
    ? KATEGORI_LAMA_JABATAN_BERLUBANG
    : KATEGORI_LAMA_JABATAN_KONTINU

  return [
    {
      id: 3,
      sumbu: 'X_POTENSIAL',
      namaKomponen: 'Potensi & Kompetensi',
      bobot: 0.65,
      urutan: 1,
      indikator: [
        indikator(
          ID_INDIKATOR.potkom,
          'Penilaian Potensi dan Kompetensi',
          0.65,
          'NILAI_LANGSUNG',
          1,
          KATEGORI_POTKOM,
        ),
      ],
    },
    {
      id: 4,
      sumbu: 'X_POTENSIAL',
      namaKomponen: 'Kualifikasi Jabatan',
      bobot: 0.2,
      urutan: 2,
      indikator: [
        indikator(
          ID_INDIKATOR.tingkatPendidikan,
          'Tingkat Pendidikan Formal',
          0.05,
          'KATEGORI_TETAP',
          1,
          KATEGORI_PENDIDIKAN,
        ),
        indikator(
          ID_INDIKATOR.kesesuaianBidangIlmu,
          'Kesesuaian Bidang Ilmu',
          0.05,
          'KATEGORI_TETAP',
          2,
          KATEGORI_BINER(
            'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target',
            'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target',
          ),
        ),
        indikator(
          ID_INDIKATOR.pengembanganKompetensi,
          'Pengembangan Kompetensi',
          0.05,
          'KATEGORI_TETAP',
          3,
          KATEGORI_BINER(
            'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target',
            'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target',
          ),
        ),
        // Node agregator: tanpa kategori sendiri, skornya rata-rata 3 sub-indikator
        indikator(ID_INDIKATOR.pengalamanJabatan, 'Nilai Pengalaman Jabatan', 0.05, 'KATEGORI_TETAP', 4, [], [
          indikator(ID_INDIKATOR.lamaJabatan, 'Lama Jabatan', null, 'KATEGORI_TETAP', 1, kategoriLama),
          indikator(
            ID_INDIKATOR.keragamanJabatan,
            'Keragaman Riwayat Jabatan',
            null,
            'KATEGORI_TETAP',
            2,
            KATEGORI_KERAGAMAN,
          ),
          indikator(
            ID_INDIKATOR.substansiJabatan,
            'Substansi Riwayat Jabatan',
            null,
            'KATEGORI_TETAP',
            3,
            KATEGORI_SUBSTANSI,
          ),
        ]),
      ],
    },
    {
      id: 5,
      sumbu: 'X_POTENSIAL',
      namaKomponen: 'Integritas & Moralitas',
      bobot: 0.15,
      urutan: 3,
      indikator: [
        indikator(
          ID_INDIKATOR.integritas,
          'Verifikasi Rekam Jejak Disiplin',
          0.15,
          'KATEGORI_TETAP',
          1,
          KATEGORI_INTEGRITAS,
        ),
      ],
    },
  ]
}
