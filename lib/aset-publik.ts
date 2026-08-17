import 'server-only'

import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { cache } from 'react'

/**
 * Aset merek yang **disediakan operator**, bukan yang ikut di repositori.
 *
 * Dua aset di sini tidak bisa dibuat oleh kode: lambang resmi Kementerian PU dan
 * foto pegawai. Keduanya diperiksa keberadaannya **di server** lalu komponennya
 * memilih komposisi — bukan diserahkan ke `<img>` yang gagal memuat. Gambar yang
 * 404 meninggalkan ikon rusak, dan salah satu tempat pemakaiannya adalah halaman
 * MASUK, layar pertama yang dilihat orang. Aplikasi yang tampak rusak di layar
 * pertama akan dilaporkan rusak, apa pun keadaan sebenarnya.
 *
 * `cache()` supaya satu permintaan tidak menyentuh disk berkali-kali: app shell
 * merender lambang di sidebar sementara halaman auth merender di dua tempat.
 */

const PUBLIK = join(process.cwd(), 'public')

function pertamaYangAda(nama: readonly string[]): string | null {
  for (const n of nama) if (existsSync(join(PUBLIK, n))) return `/${n}`
  return null
}

/**
 * Lambang resmi Kementerian Pekerjaan Umum, kalau operator sudah menaruhnya.
 *
 * **Sengaja TIDAK ada versi bawaan di repositori ini.** Lambang instansi
 * pemerintah harus berupa artwork resmi; rekonstruksi yang mendekati tetap
 * salah, dan salahnya akan tampil di setiap layar sistem resmi. v1
 * (`web/app/(app)/Logo.tsx`) mengklaim memuat lambangnya, tapi path-nya
 * **mengisi 100% area viewBox tanpa ruang kosong** — terukur, bukan dugaan —
 * jadi ia hampir pasti satu `<path>` yang terambil dari berkas Wikimedia
 * bermultipath lalu dipakai dengan viewBox aslinya. Di 38px ia lolos sebagai
 * bentuk abstrak; di 240px ia jelas bentuk terpotong. Jangan diporting.
 *
 * SVG lebih disukai daripada PNG: lambangnya dipakai dari 28px (sidebar) sampai
 * 520px (watermark panel masuk).
 */
export const logoResmi = cache((): string | null =>
  pertamaYangAda(['logo-pu.svg', 'logo-pu.png', 'logo-pu.webp']),
)

/** Foto latar halaman masuk. WebP lebih dulu karena paling kecil. */
export const fotoMasuk = cache((): string | null =>
  pertamaYangAda(['masuk-latar.webp', 'masuk-latar.jpg', 'masuk-latar.jpeg', 'masuk-latar.png']),
)
