/**
 * Proteksi injeksi formula bersama untuk Pusat Ekspor — dipakai `lib/ekspor-xlsx.ts`.
 *
 * Murni & bebas DB. Excel & LibreOffice menjalankan sel yang dimulai dengan `=`,
 * `+`, `-`, `@`, tab, atau CR sebagai **formula**. Aplikasi ini mengekspor kolom
 * teks bebas yang diisi manusia — `catatan_reviewer`, catatan nilai manual,
 * keterangan disiplin — jadi satu catatan berbunyi `=HYPERLINK(...)` menjadi
 * tautan hidup di berkas yang dibuka staf lain, dan bentuk yang lebih jahat bisa
 * memanggil perintah eksternal. Ini kelas kerentanan tersendiri (CSV/formula
 * injection), bukan soal estetika: datanya keluar dari batas aplikasi, jadi
 * pertahanannya harus ikut keluar. Berlaku sama persis untuk `.xlsx` — itu
 * sebabnya `lindungiSel()` dipakai ulang di sana, bukan ditulis dua kali.
 *
 * Yang dipakai: sisipkan kutip tunggal di depan. Sel tetap terbaca manusia, dan
 * Excel memperlakukannya sebagai teks.
 */

/** Karakter pembuka yang membuat Excel menafsirkan sel sebagai formula. */
const PEMBUKA_FORMULA = ['=', '+', '-', '@', '\t', '\r']

/**
 * Netralkan sel yang bisa ditafsirkan sebagai formula.
 *
 * Angka negatif (`-12`) ikut kena — itu disengaja: memutuskan "ini angka, bukan
 * formula" menuntut menebak maksud sel, dan salah menebak sekali sudah cukup.
 * Kolom numerik pada ekspor ini diformat lewat `formatAngka`-nya sendiri, jadi
 * tidak ada kolom angka yang bergantung pada tanda minus di posisi pertama.
 */
export function lindungiSel(nilai: string): string {
  if (nilai === '') return ''
  return PEMBUKA_FORMULA.includes(nilai[0]!) ? `'${nilai}` : nilai
}

export interface KolomEkspor<T> {
  kunci: string
  judul: string
  nilai: (baris: T) => unknown
}
