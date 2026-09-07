import type { Eselon } from './scoring/eligibility'

/**
 * Tingkatan eselon — SATU definisi tentang "yang mana di atas yang mana".
 *
 * Sampai berkas ini ada, aturannya hidup sebagai konstanta privat di
 * `lib/penilaian.ts` sementara empat berkas kueri menuliskan urutannya sendiri
 * sebagai `FIELD(j.eselon,'I','II','III','IV','NON_ESELON')`. Keduanya benar dan
 * **berlawanan arah**: yang satu memberi angka BESAR untuk jabatan tinggi (dipakai
 * membandingkan), yang lain memberi angka KECIL (dipakai mengurutkan tampilan,
 * eselon I di baris pertama). Dua orientasi yang sama-sama masuk akal adalah cara
 * termudah menulis perbandingan yang terbalik tanpa satu pun galat — jadi keduanya
 * duduk di sini, bersebelahan, masing-masing dengan namanya sendiri.
 */
export const URUTAN_ESELON: Record<Eselon, number> = {
  NON_ESELON: 0,
  IV: 1,
  III: 2,
  II: 3,
  I: 4,
}

/**
 * Ekspresi SQL yang menghasilkan peringkat yang SAMA dengan `peringkatEselon()`.
 *
 * Diturunkan dari `URUTAN_ESELON` — bukan ditulis ulang sebagai daftar literal.
 * Menuliskannya dua kali berarti perbandingan di TypeScript dan di SQL bisa
 * TERBALIK arah, dan itu bukan keadaan yang menghasilkan galat: yang terjadi
 * hanya daftar pilihan yang berisi jabatan yang salah.
 *
 * `FIELD()` mengembalikan **0** untuk NULL maupun nilai di luar daftar, dan itu
 * bertabrakan dengan `NON_ESELON` yang peringkat sahnya juga 0 — jadi daftarnya
 * digeser satu (`+ 1` di seluruh peringkat) sehingga 0 tersisa untuk "tidak
 * diketahui", sama seperti `null` di sisi TypeScript.
 */
export function sqlPeringkatEselon(kolom: string): string {
  const menaik = (Object.keys(URUTAN_ESELON) as Eselon[]).sort(
    (a, b) => URUTAN_ESELON[a] - URUTAN_ESELON[b],
  )
  return `FIELD(${kolom}, ${menaik.map((e) => `'${e}'`).join(', ')})`
}

/**
 * Peringkat sebuah eselon; `null` untuk yang tidak dikenali.
 *
 * `null` **bukan** nol. `NON_ESELON` adalah jabatan fungsional — sebuah tingkatan
 * yang benar-benar ada — sementara `null` berarti kolomnya kosong atau berisi
 * tulisan yang bukan eselon. Menyamakan keduanya membuat jabatan tak bereselon
 * ikut lolos setiap perbandingan "di atas NON_ESELON".
 */
export function peringkatEselon(eselon: string | null | undefined): number | null {
  if (!eselon) return null
  const n = URUTAN_ESELON[eselon.trim().toUpperCase() as Eselon]
  return n === undefined ? null : n
}

/**
 * Apakah `kandidat` setingkat dengan `acuan` atau di atasnya.
 *
 * Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 4):
 * *"…jenjangnya minimal setingkat atau di atasnya"* — menggantikan aturan lama
 * yang menuntut eselon PERSIS sama (`jj.eselon <=> j.eselon`).
 *
 * Aturan lama menutup keadaan yang wajar: sebuah jabatan target beranggota eselon
 * III tidak bisa ditambahi kursi eselon II yang fungsinya sama di unit lain, dan
 * penolakannya tidak terlihat sebagai penolakan — jabatannya cuma tidak muncul di
 * daftar, yang terbaca sebagai "tidak ada di master".
 *
 * **Eselon yang tidak diketahui tidak pernah lolos.** Kalau salah satu sisi `null`,
 * jawabannya `false`, bukan "biarkan lewat": yang diputuskan di sini adalah baris
 * mana yang MASUK ke daftar pilihan, dan meloloskan yang tidak diketahui
 * mengembalikan justru kebisingan yang saringan ini ada untuk membuang. Jalan
 * keluarnya sudah ada dan eksplisit — `semuaJenjang` di UI.
 */
export function setingkatAtauDiAtas(
  kandidat: string | null | undefined,
  acuan: string | null | undefined,
): boolean {
  const a = peringkatEselon(kandidat)
  const b = peringkatEselon(acuan)
  if (a === null || b === null) return false
  return a >= b
}
