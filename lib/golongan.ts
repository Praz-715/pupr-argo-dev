/**
 * Golongan/pangkat PNS — pengurutan & perbandingan.
 *
 * Dipakai gerbang kelayakan untuk syarat `GOLONGAN_MIN` yang datang dari lembar
 * **Persyaratan Jabatan** (PP 11/2017): IV/b untuk Direktur, III/d untuk
 * Kasubdit & Kepala Balai, III/b untuk Kasubag.
 *
 * ## Kenapa modul sendiri, bukan larik di dalam `eligibility.ts`
 *
 * Ia dipakai tiga tempat berbeda — gerbang kelayakan, form persyaratan (daftar
 * pilihan), dan skrip pemuat syarat — dan ketiganya harus sepakat tentang
 * urutannya. Urutan yang disalin tiga kali adalah tiga urutan yang bisa berselisih;
 * dan bentuk selisihnya bukan galat, melainkan kandidat yang lolos di satu halaman
 * dan gugur di halaman lain.
 *
 * ## Kenapa penulisannya dinormalkan, bukan dibandingkan apa adanya
 *
 * Satu golongan ditulis bermacam cara di data nyata: `III/d`, `IIId`, `III d`,
 * `iii/D`. Membandingkan teks apa adanya membuat pegawai bergolongan `IIId`
 * dinyatakan tidak memenuhi syarat `III/d` — sama, hanya beda tanda garis miring.
 * `kunciGolongan()` melumatkan spasi, garis miring, titik, dan besar-kecil huruf
 * lebih dulu.
 *
 * Lembar Excel-nya sendiri menulis tanpa garis miring ("IVb", "IIId"), sedangkan
 * `pegawai.golongan` di basis data memakai garis miring ("IV/b") — jadi
 * normalisasi ini bukan pertahanan teoretis, ia yang membuat keduanya bisa
 * dibandingkan sama sekali.
 */

/**
 * Golongan dari terendah ke tertinggi, apa adanya menurut PP 11/2017 & UU ASN.
 *
 * Indeksnya yang dipakai membandingkan, jadi **jangan mengubah urutannya** —
 * tambahkan di ujung yang benar bila ada golongan yang belum tercakup.
 */
export const URUTAN_GOLONGAN = [
  'I/a', 'I/b', 'I/c', 'I/d',
  'II/a', 'II/b', 'II/c', 'II/d',
  'III/a', 'III/b', 'III/c', 'III/d',
  'IV/a', 'IV/b', 'IV/c', 'IV/d', 'IV/e',
] as const

export type Golongan = (typeof URUTAN_GOLONGAN)[number]

/** Bentuk yang bisa dibandingkan: huruf besar, tanpa pemisah. `III/d` → `IIID`. */
export function kunciGolongan(nilai: string): string {
  return nilai.replace(/[\s/.\-_]/g, '').toUpperCase()
}

const PERINGKAT = new Map<string, number>(
  URUTAN_GOLONGAN.map((g, i) => [kunciGolongan(g), i]),
)

/**
 * Peringkat golongan (0 = I/a). `null` bila tulisannya tidak dikenali.
 *
 * `null` **bukan** nol: nol berarti golongan terendah, sedangkan tidak dikenali
 * berarti tidak diketahui — dan keduanya harus berujung pada perlakuan berbeda di
 * gerbang kelayakan (gugur vs perlu verifikasi manusia).
 */
export function peringkatGolongan(nilai: string | null | undefined): number | null {
  if (nilai === null || nilai === undefined) return null
  const kunci = kunciGolongan(nilai)
  if (kunci === '') return null
  return PERINGKAT.get(kunci) ?? null
}

/** Tulisan baku golongan (`IIId` → `III/d`), atau `null` bila tak dikenali. */
export function bakukanGolongan(nilai: string | null | undefined): Golongan | null {
  const p = peringkatGolongan(nilai)
  return p === null ? null : URUTAN_GOLONGAN[p]!
}

/**
 * `true` bila `punya` memenuhi syarat minimal `minimal`.
 *
 * Mengembalikan `null` bila salah satunya tidak dikenali — pemanggilnya yang
 * memutuskan apa arti "tidak diketahui", sebab jawabannya berbeda per konteks.
 */
export function memenuhiGolongan(
  punya: string | null | undefined,
  minimal: string | null | undefined,
): boolean | null {
  const a = peringkatGolongan(punya)
  const b = peringkatGolongan(minimal)
  if (a === null || b === null) return null
  return a >= b
}
