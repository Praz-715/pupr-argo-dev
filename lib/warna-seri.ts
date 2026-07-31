/**
 * Identitas visual seri chart — warna **dan** pola garisnya.
 *
 * Berkas biasa (tanpa `'use client'`) supaya bisa dipakai Server Component
 * maupun Client Component. Semua ekspor dari berkas `'use client'` berubah jadi
 * client reference, sehingga fungsi seperti `warnaSeri()` tidak bisa dipanggil
 * di server kalau ditaruh di sana.
 *
 * Nilai warnanya menunjuk token CSS `--chart-N` yang sudah divalidasi sebagai
 * himpunan 4 warna untuk SEMUA pasangan (lihat komentar di `app/globals.css`).
 * Pemisahan terburuknya masih di pita CVD 6–8, jadi **pola garis bukan hiasan**:
 * itu pembeda kedua yang membuat identitas seri tidak bergantung pada warna
 * saja. Tabel warna dan tabel pola harus selalu dipakai berpasangan.
 */

export const WARNA_SERI = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
] as const

/** Utuh · putus-putus · titik · putus-titik. */
export const POLA_GARIS_SERI = ['0', '6 3', '2 3', '8 3 2 3'] as const

export function warnaSeri(indeks: number): string {
  return WARNA_SERI[indeks % WARNA_SERI.length]!
}

export function polaGarisSeri(indeks: number): string {
  return POLA_GARIS_SERI[indeks % POLA_GARIS_SERI.length]!
}
