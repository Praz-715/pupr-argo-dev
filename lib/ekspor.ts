/**
 * Serialisasi CSV untuk Pusat Ekspor (Fase 8).
 *
 * Murni & bebas DB supaya bisa diuji tanpa database — yang diuji di sini bukan
 * "apakah kolomnya benar", tapi tiga hal yang tidak akan terlihat sampai berkasnya
 * dibuka orang lain di aplikasi lain.
 *
 * ## 1. Injeksi formula — alasan `lindungiSel()` ada
 *
 * Excel & LibreOffice menjalankan sel yang dimulai dengan `=`, `+`, `-`, `@`, tab,
 * atau CR sebagai **formula**. Aplikasi ini mengekspor kolom teks bebas yang diisi
 * manusia — `catatan_reviewer`, catatan nilai manual, keterangan disiplin — jadi
 * satu catatan berbunyi `=HYPERLINK(...)` menjadi tautan hidup di berkas yang
 * dibuka staf lain, dan bentuk yang lebih jahat bisa memanggil perintah eksternal.
 * Ini kelas kerentanan tersendiri (CSV/formula injection), bukan soal estetika:
 * datanya keluar dari batas aplikasi, jadi pertahanannya harus ikut keluar.
 *
 * Yang dipakai: sisipkan kutip tunggal di depan. Sel tetap terbaca manusia, dan
 * Excel memperlakukannya sebagai teks.
 *
 * ## 2. BOM UTF-8
 *
 * Tanpa BOM, Excel di Windows membaca CSV sebagai ANSI — dan setiap nama ber-akhiran
 * non-ASCII rusak. Ini akan dilaporkan sebagai "ekspornya rusak", bukan sebagai
 * masalah encoding, lalu didiagnosis di tempat yang salah.
 *
 * ## 3. CRLF & pengutipan RFC 4180
 *
 * Sel yang memuat koma, kutip, atau baris baru wajib dikutip, dan kutip di dalamnya
 * digandakan. Catatan reviewer memang sering memuat ketiganya.
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

/** Ubah satu nilai apa pun jadi teks sel yang aman & terkutip bila perlu. */
export function selCsv(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return ''

  const teks =
    nilai instanceof Date
      ? nilai.toISOString().slice(0, 19).replace('T', ' ')
      : typeof nilai === 'boolean'
        ? nilai
          ? 'ya'
          : 'tidak'
        : String(nilai)

  const aman = lindungiSel(teks)
  return /[",\r\n;]/.test(aman) ? `"${aman.replace(/"/g, '""')}"` : aman
}

export interface KolomEkspor<T> {
  kunci: string
  judul: string
  nilai: (baris: T) => unknown
}

/** BOM UTF-8 — wajib supaya Excel di Windows tidak membaca berkasnya sebagai ANSI. */
export const BOM_UTF8 = '﻿'

/**
 * Susun CSV lengkap: BOM + header + baris, dipisah CRLF.
 *
 * Mengembalikan string, bukan stream. Itu pilihan sadar: seluruh ekspor di
 * aplikasi ini dibatasi beberapa ribu baris (`LIMIT` di kuerinya), dan tabel
 * terbesar di produksi 1.872 pegawai — beberapa ratus kilobyte. Streaming baru
 * berguna kalau berkasnya tidak muat di memori, dan itu belum pernah terjadi di
 * sini. Kalau nanti terjadi, yang berubah cuma fungsi ini.
 */
export function susunCsv<T>(kolom: Array<KolomEkspor<T>>, baris: T[]): string {
  const garis = [kolom.map((k) => selCsv(k.judul)).join(',')]
  for (const b of baris) {
    garis.push(kolom.map((k) => selCsv(k.nilai(b))).join(','))
  }
  return BOM_UTF8 + garis.join('\r\n') + '\r\n'
}

/**
 * Nama berkas unduhan: `simt-<jenis>-<stempel>.csv`.
 *
 * Stempel waktu masuk ke nama karena laporan yang sama diekspor berkali-kali
 * dengan penyaring berbeda, dan berkas bernama sama akan saling menimpa di folder
 * Unduhan tanpa pemiliknya sadar mana yang mana.
 */
export function namaBerkasCsv(jenis: string, pada: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stempel = `${pada.getFullYear()}${p(pada.getMonth() + 1)}${p(pada.getDate())}-${p(pada.getHours())}${p(pada.getMinutes())}`
  const bersih = jenis.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return `simt-${bersih}-${stempel}.csv`
}

/**
 * Header HTTP untuk unduhan CSV.
 *
 * `no-store` disengaja: isinya data pegawai yang tersaring menurut peran
 * pengunduhnya, jadi ia tidak boleh mengendap di cache bersama mana pun.
 */
export function headerCsv(namaBerkas: string): Record<string, string> {
  return {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="${namaBerkas}"`,
    'Cache-Control': 'no-store, max-age=0',
  }
}
