/**
 * Pembaca parameter URL di boundary — **jangan percaya isi query string.**
 *
 * ## Kenapa ini modul tersendiri
 *
 * Aturannya sepele, tapi sebelum berkas ini ada, `angkaPositif` hidup sebagai
 * closure lokal di **tiga** halaman (Direktori, Peta Talenta, Master Jabatan)
 * dengan isi identik. Halaman keempat yang membutuhkannya — Audit Log Viewer —
 * tidak menemukannya lewat `grep` karena ia tidak punya nama di tingkat modul,
 * lalu memakai `Number(sp.hal)` apa adanya. Akibatnya `?hal=abc` menjadi `NaN`,
 * `NaN` masuk ke `OFFSET`, dan MySQL menjawab `Undeclared variable: NaN` —
 * halaman jatuh ke error boundary hanya karena satu karakter di URL.
 *
 * Itu bukan kelalaian penulisnya; itu akibat yang bisa diramalkan dari helper
 * yang disalin. Salinan keempat tidak akan pernah ditemukan oleh orang kelima.
 *
 * Modul ini **murni**: tanpa `server-only`, supaya komponen klien yang menyusun
 * URL bisa memakai validator yang sama dengan yang membacanya — dua penafsir
 * berbeda atas satu query string adalah cara halus menghasilkan tautan yang
 * tidak bisa dibuka kembali.
 */

/**
 * Bilangan bulat positif, atau `undefined` kalau bukan.
 *
 * Dipakai untuk id (unit, peran, jabatan target) dan nomor kotak — nilai yang
 * artinya "tidak ada penyaring" saat tidak valid, bukan nilai bawaan.
 */
export function angkaPositif(nilai: string | undefined | null): number | undefined {
  if (!nilai) return undefined
  const n = Number(nilai)
  return Number.isSafeInteger(n) && n > 0 ? n : undefined
}

/**
 * Nomor halaman: **selalu** bilangan bulat ≥ 1.
 *
 * Berbeda dari `angkaPositif` karena paginasi tidak punya keadaan "tidak ada" —
 * pembacanya butuh angka untuk menghitung `OFFSET`. Nilai rusak jatuh ke
 * halaman 1, bukan ke `NaN`.
 *
 * `Number.isSafeInteger` bukan kehati-hatian berlebihan: `?hal=1e309` menjadi
 * `Infinity`, dan `Infinity - 1` tetap `Infinity`. Nomor halaman besar tapi sah
 * (mis. 99999) sengaja **dibiarkan lewat** — hasilnya daftar kosong, dan itu
 * jawaban yang benar untuk permintaan itu.
 */
export function nomorHalaman(nilai: string | undefined | null): number {
  const n = angkaPositif(nilai)
  return n ?? 1
}

const POLA_TANGGAL = /^(\d{4})-(\d{2})-(\d{2})$/

/**
 * Tanggal `YYYY-MM-DD` yang **benar-benar ada di kalender**, atau `undefined`.
 *
 * Dua lapis, karena regex saja tidak cukup: `2026-13-45` lolos bentuknya tapi
 * bukan tanggal. Tanpa pemeriksaan kedua, nilainya diteruskan ke MySQL dan
 * dijawab `Incorrect DATETIME value` — galat server untuk masukan pengguna.
 *
 * Kenapa mengembalikan string, bukan `Date`: penyaringnya bekerja pada batas
 * hari (`00:00:00` s.d. `23:59:59`) menurut jam **MySQL**, sedangkan `Date`
 * membawa zona waktu proses Node. Menyerahkan tanggalnya sebagai teks membuat
 * satu-satunya jam yang menafsirkannya adalah jam database.
 *
 * Input `<input type="date">` mengirim bentuk ini atau string kosong, jadi jalur
 * normal tidak pernah kena. Yang kena adalah URL yang disunting, dipotong, atau
 * dibagikan — dan §5.7 memang menjanjikan filter bisa di-bookmark & dikirim.
 */
export function tanggalIso(nilai: string | undefined | null): string | undefined {
  if (!nilai) return undefined
  const cocok = POLA_TANGGAL.exec(nilai.trim())
  if (!cocok) return undefined

  const [, thn, bln, tgl] = cocok
  const tahun = Number(thn)
  const bulan = Number(bln)
  const tanggal = Number(tgl)

  if (bulan < 1 || bulan > 12) return undefined
  if (tanggal < 1 || tanggal > 31) return undefined

  // Round-trip: tanggal yang tidak ada akan bergulir (31 Feb → 3 Mar), jadi
  // komponennya tidak lagi sama dengan yang diminta.
  const d = new Date(Date.UTC(tahun, bulan - 1, tanggal))
  if (
    d.getUTCFullYear() !== tahun ||
    d.getUTCMonth() !== bulan - 1 ||
    d.getUTCDate() !== tanggal
  ) {
    return undefined
  }

  return `${thn}-${bln}-${tgl}`
}

/**
 * Nilai yang harus berasal dari daftar tertutup, atau `undefined`.
 *
 * Menggantikan pola `['I','II',…].includes(p.eselon ?? '') ? p.eselon : undefined`
 * yang tersebar di beberapa halaman — bentuk itu benar, tapi menuntut penulisnya
 * mengingat cast-nya setiap kali.
 */
export function dariDaftar<T extends string>(
  nilai: string | undefined | null,
  daftar: readonly T[],
): T | undefined {
  if (!nilai) return undefined
  return (daftar as readonly string[]).includes(nilai) ? (nilai as T) : undefined
}
