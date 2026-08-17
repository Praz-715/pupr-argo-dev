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

/**
 * Band kualitas Kotak 9 — 5 tingkat dari kiri-bawah ke kanan-atas grid.
 *
 * Diporting dari konvensi v1 (`web/lib/talenta.ts`): merah = perlu perhatian,
 * hijau tua = siap peran strategis. Pengelompokannya mengikuti **pita diagonal**
 * grid, bukan nomor kotaknya: kotak 4 (kinerja tinggi, potensi terbatas) dan
 * kotak 6 (potensi tinggi, kinerja rendah) berada di pita yang sama karena
 * keduanya "menengah" — dan itu memang bentuk gridnya.
 *
 * Warnanya dipakai untuk LATAR & GARIS sel, tidak untuk teksnya; alasannya ada
 * di komentar `--k9-*` di `app/globals.css`.
 */
const BAND_KOTAK_9: Record<number, 1 | 2 | 3 | 4 | 5> = {
  1: 1,
  2: 2,
  3: 2,
  4: 3,
  5: 3,
  6: 3,
  7: 4,
  8: 4,
  9: 5,
}

/** Warna band untuk satu nomor kotak, sebagai `var(--k9-N)`. */
export function warnaKotak9(kotak: number): string {
  return `var(--k9-${BAND_KOTAK_9[kotak] ?? 3})`
}

/**
 * Plafon tint latar sel. **Jangan dinaikkan tanpa menjalankan
 * `npm run audit:kontras`**: batas amannya 51% (diikat tema gelap), dan di atas
 * itu `--text` di sel terpadat turun di bawah 4,5:1.
 */
export const TINT_KOTAK_9 = {
  /** Sel berisi minimal 1 orang. Sengaja jelas di atas `kosong` — kalau sama,
      sel berisi satu orang tidak bisa dibedakan dari sel kosong. */
  dasar: 0.14,
  rentang: 0.31,
  /** Sel kosong tetap menampilkan band-nya, hanya samar. Nol bukan berarti
      tidak bermakna: "tidak ada seorang pun di Kotak 1" adalah informasi. */
  kosong: 0.08,
} as const
