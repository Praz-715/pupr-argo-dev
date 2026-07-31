import {
  AMBANG_SUMBU,
  BOBOT_FORMULA_A,
  MATRIKS_KOTAK_9,
  SKOR_PREDIKAT,
} from './konstanta'
import { bulatkan2, clampSkor } from './rubrik'
import type { KategoriSumbuX, KategoriSumbuY, Kotak9, Predikat } from './types'

/**
 * Formula A — Nilai Talenta & pemetaan 9 Kotak Manajemen Talenta ASN.
 * Sumber: doc/KERANGKA TALENT POOL.md §A + Lampiran A & B
 * doc/manajemen talenta 27 juli utk tim SIM.md.
 */

/** Predikat kinerja → skor sumbu Y (100/80/60/40/20). */
export function skorPredikat(predikat: Predikat | string | null | undefined): number | null {
  if (!predikat) return null
  const cocok = (Object.keys(SKOR_PREDIKAT) as Predikat[]).find(
    (p) => p.toLowerCase() === predikat.trim().replace(/\s+/g, ' ').toLowerCase(),
  )
  return cocok ? SKOR_PREDIKAT[cocok] : null
}

/**
 * Klasifikasi sumbu Y. Batas bawah INKLUSIF — jadi predikat "Baik" (tepat 80)
 * masuk "Di Atas Ekspektasi". Itu sifat rubrik sumber, bukan kekeliruan
 * pembulatan (phase.md §3 K-2).
 */
export function klasifikasiSumbuY(nilai: number): KategoriSumbuY {
  if (nilai >= AMBANG_SUMBU.atas) return 'Di Atas Ekspektasi'
  if (nilai >= AMBANG_SUMBU.tengah) return 'Sesuai Ekspektasi'
  return 'Di Bawah Ekspektasi'
}

export function klasifikasiSumbuX(nilai: number): KategoriSumbuX {
  if (nilai >= AMBANG_SUMBU.atas) return 'Tinggi'
  if (nilai >= AMBANG_SUMBU.tengah) return 'Menengah'
  return 'Rendah'
}

/** Nilai Talenta = 50% sumbu Y + 50% sumbu X. */
export function hitungNilaiTalenta(nilaiKinerjaY: number, nilaiPotensialX: number): number {
  const total =
    nilaiKinerjaY * BOBOT_FORMULA_A.kinerja + nilaiPotensialX * BOBOT_FORMULA_A.potensial
  return bulatkan2(clampSkor(total).skor)
}

export interface HasilKotak9 {
  kotak: Kotak9
  kategoriY: KategoriSumbuY
  kategoriX: KategoriSumbuX
  nilaiKinerjaY: number
  nilaiPotensialX: number
  nilaiTalenta: number
}

/**
 * Kotak 9 SELALU hasil hitung dari (Y, X) — bukan kolom yang diisi bebas
 * (phase.md §2.3). Nilai `kotak_9` yang datang dari sistem sumber dipakai
 * sebagai pembanding lewat `bandingkanKotak9()`, bukan sebagai kebenaran.
 */
export function hitungKotak9(nilaiKinerjaY: number, nilaiPotensialX: number): HasilKotak9 {
  const y = clampSkor(nilaiKinerjaY).skor
  const x = clampSkor(nilaiPotensialX).skor
  const kategoriY = klasifikasiSumbuY(y)
  const kategoriX = klasifikasiSumbuX(x)

  return {
    kotak: MATRIKS_KOTAK_9[kategoriY][kategoriX],
    kategoriY,
    kategoriX,
    nilaiKinerjaY: bulatkan2(y),
    nilaiPotensialX: bulatkan2(x),
    nilaiTalenta: hitungNilaiTalenta(y, x),
  }
}

export interface PerbandinganKotak9 {
  kotakHitung: Kotak9
  kotakSumber: number | null
  cocok: boolean
  /** true bila ada nilai sumber yang berbeda → masuk Antrian Pembersihan Data. */
  perluReview: boolean
  keterangan: string | null
}

/**
 * Bandingkan hasil hitung dengan nilai `kotak_9` yang datang dari sistem sumber.
 * Selisih TIDAK disembunyikan: baris yang beda ditandai supaya muncul di
 * Antrian Pembersihan Data (phase.md §6 no. 2).
 */
export function bandingkanKotak9(
  hasil: HasilKotak9,
  kotakSumber: number | null | undefined,
): PerbandinganKotak9 {
  if (kotakSumber === null || kotakSumber === undefined) {
    return {
      kotakHitung: hasil.kotak,
      kotakSumber: null,
      cocok: true,
      perluReview: false,
      keterangan: null,
    }
  }

  const cocok = kotakSumber === hasil.kotak
  return {
    kotakHitung: hasil.kotak,
    kotakSumber,
    cocok,
    perluReview: !cocok,
    keterangan: cocok
      ? null
      : `Kotak 9 dari sumber (${kotakSumber}) berbeda dengan hasil hitung (${hasil.kotak}) untuk Y=${hasil.nilaiKinerjaY} · X=${hasil.nilaiPotensialX}`,
  }
}

/** Urutan baris grid dari atas ke bawah (baris 0 = Di Atas Ekspektasi). */
export const BARIS_KOTAK_9: readonly KategoriSumbuY[] = [
  'Di Atas Ekspektasi',
  'Sesuai Ekspektasi',
  'Di Bawah Ekspektasi',
]

/** Urutan kolom grid dari kiri ke kanan. */
export const KOLOM_KOTAK_9: readonly KategoriSumbuX[] = ['Rendah', 'Menengah', 'Tinggi']

/**
 * Kebalikan `MATRIKS_KOTAK_9`: dari nomor kotak → pasangan kategori sumbunya.
 *
 * Dipakai judul drill-down ("Kotak 7 · Di Atas Ekspektasi × Potensial
 * Menengah"). Diturunkan dari matriks yang sama, jadi tidak ada tabel Kotak 9
 * kedua yang bisa berselisih dengan rumusnya.
 */
export function kategoriDariKotak9(
  kotak: number,
): { y: KategoriSumbuY; x: KategoriSumbuX } | null {
  for (const y of BARIS_KOTAK_9) {
    for (const x of KOLOM_KOTAK_9) {
      if (MATRIKS_KOTAK_9[y][x] === kotak) return { y, x }
    }
  }
  return null
}

/** Koordinat sel pada grid 3×3 (baris 0 = Di Atas Ekspektasi). */
export function koordinatKotak9(kotak: Kotak9): { baris: 0 | 1 | 2; kolom: 0 | 1 | 2 } {
  const kategori = kategoriDariKotak9(kotak)
  if (!kategori) return { baris: 2, kolom: 0 }
  return {
    baris: BARIS_KOTAK_9.indexOf(kategori.y) as 0 | 1 | 2,
    kolom: KOLOM_KOTAK_9.indexOf(kategori.x) as 0 | 1 | 2,
  }
}
