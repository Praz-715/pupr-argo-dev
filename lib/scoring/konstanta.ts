import type {
  AmbangSumbu,
  KategoriSumbuX,
  KategoriSumbuY,
  Kotak9,
  Predikat,
  TingkatHukuman,
} from './types'

/**
 * Konstanta rubrik — turunan LANGSUNG dari doc/KERANGKA TALENT POOL.md dan
 * Lampiran A doc/manajemen talenta 27 juli utk tim SIM.md.
 *
 * Dokumen itu otoritatif (phase.md §1). Jangan ubah angka di sini untuk
 * "menyesuaikan data" — kalau data bentrok, datanya yang dibetulkan.
 */

/** Rentang skor yang sah untuk seluruh sistem (phase.md §2.1). */
export const SKOR_MIN = 0
export const SKOR_MAKS = 100

/** KERANGKA §A — Komponen Kinerja Utama, indikator Penilaian Kinerja. */
export const SKOR_PREDIKAT: Record<Predikat, number> = {
  'Sangat Baik': 100,
  Baik: 80,
  'Butuh Perbaikan': 60,
  Kurang: 40,
  'Sangat Kurang': 20,
}

/**
 * Ambang klasifikasi kedua sumbu (Lampiran A) — **nilai BAWAAN.**
 *
 * Sejak 18 Agu 2026 angka ini bisa diubah Super Admin lewat `pengaturan_sistem`
 * (`ambang_sumbu_atas` / `ambang_sumbu_tengah`), jadi ia bukan lagi satu-satunya
 * sumber: ia nilai bawaan yang dipakai `PENGATURAN_BAWAAN`, seed, dan uji.
 * Fungsi di `kotak9.ts` **tidak membacanya** — mereka menerima ambang sebagai
 * argumen wajib, supaya jalur yang lupa mengambil pengaturan gagal kompilasi
 * alih-alih diam-diam memakai angka lain.
 *
 * Batas bawah bersifat inklusif.
 */
export const AMBANG_SUMBU: AmbangSumbu = {
  /** ≥80 → kategori teratas */
  atas: 80,
  /** ≥60–<80 → kategori tengah; <60 → kategori terbawah */
  tengah: 60,
}

/** KERANGKA §B.3 — Verifikasi Rekam Jejak Disiplin. */
export const SKOR_INTEGRITAS: Record<TingkatHukuman, number> = {
  'Tidak Pernah': 100,
  Ringan: 75,
  Sedang: 50,
  Berat: 25,
  'Sedang Menjalani': 0,
}

/** Urutan keparahan hukuman disiplin (indeks besar = lebih berat). */
export const KEPARAHAN_HUKUMAN: TingkatHukuman[] = [
  'Tidak Pernah',
  'Ringan',
  'Sedang',
  'Berat',
  'Sedang Menjalani',
]

/**
 * Matriks 9 Kotak Manajemen Talenta ASN (Lampiran A) — [kategori Y][kategori X].
 *
 *                 Rendah  Menengah  Tinggi
 *  Di Atas          4        7        9
 *  Sesuai           2        5        8
 *  Di Bawah         1        3        6
 */
export const MATRIKS_KOTAK_9: Record<KategoriSumbuY, Record<KategoriSumbuX, Kotak9>> = {
  'Di Atas Ekspektasi': { Rendah: 4, Menengah: 7, Tinggi: 9 },
  'Sesuai Ekspektasi': { Rendah: 2, Menengah: 5, Tinggi: 8 },
  'Di Bawah Ekspektasi': { Rendah: 1, Menengah: 3, Tinggi: 6 },
}

/** Bobot Formula A (Lampiran B): Nilai Talenta = 50% Y + 50% X. */
export const BOBOT_FORMULA_A = { kinerja: 0.5, potensial: 0.5 } as const

/**
 * Masa berlaku asesmen dalam tahun. Doc sumber tidak menetapkannya (Blueprint
 * menandai "Status Asesmen Valid & Masa Berlaku" 🟡), jadi ini DEFAULT yang
 * dipakai sampai dikonfirmasi — dan disimpan sebagai parameter, bukan konstanta
 * tersebar (phase.md §2.9, pertanyaan terbuka §9 no. 2).
 */
export const MASA_BERLAKU_ASESMEN_TAHUN_DEFAULT = 3

/** Deskripsi tiap kotak untuk tooltip & legenda (Lampiran A). */
export const DESKRIPSI_KOTAK_9: Record<Kotak9, string> = {
  9: 'Kinerja di atas ekspektasi dan potensial tinggi. Siap untuk peran strategis.',
  8: 'Kinerja sesuai ekspektasi dan potensial tinggi. Perlu dipersiapkan untuk peran lebih tinggi.',
  7: 'Kinerja di atas ekspektasi dan potensial menengah. Memiliki potensi untuk terus berkembang.',
  6: 'Kinerja di bawah ekspektasi meskipun potensi tinggi. Perlu intervensi dan pengembangan intensif.',
  5: 'Kinerja sesuai ekspektasi dan potensial menengah. Memiliki potensi berkembang lebih tinggi.',
  4: 'Kinerja di atas ekspektasi namun potensi untuk peran lebih tinggi masih terbatas.',
  3: 'Kinerja di bawah ekspektasi, namun masih memiliki potensi untuk berkembang.',
  2: 'Kinerja sesuai ekspektasi namun potensi untuk peran lebih tinggi masih terbatas.',
  1: 'Kinerja belum memenuhi ekspektasi dan potensi untuk peran lebih tinggi masih terbatas.',
}

/**
 * Nama komponen Formula B sesuai KERANGKA §B — dipakai untuk memetakan hasil
 * rubrik ke kolom `match_score.skor_*`. Pencocokan dilakukan longgar
 * (case-insensitive, cocok sebagian) supaya nama komponen tetap bisa diedit
 * dari UI editor rubrik tanpa memutus pemetaan.
 */
export const PENANDA_KOMPONEN = {
  potensiKompetensi: 'potensi',
  kualifikasiJabatan: 'kualifikasi',
  integritasMoralitas: 'integritas',
} as const
