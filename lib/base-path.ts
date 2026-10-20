/**
 * Path dasar aplikasi kalau di-deploy di sub-path lewat reverse proxy
 * (mis. `sijkt.pu.go.id/simt`) — nilainya SAMA dengan `basePath` di
 * `next.config.ts`, dan memang harus begitu: keduanya membaca env var yang
 * sama supaya tidak ada dua "kebenaran" yang bisa berselisih.
 *
 * Next.js membuat `next/link`, `next/image` (untuk src lokal), `useRouter()`,
 * `redirect()` dari `next/navigation`, dan `redirects()` di next.config.ts
 * OTOMATIS sadar basePath — tidak perlu disentuh. Yang TIDAK pernah
 * diprefiks otomatis: `<img>`/`<a>` polos yang menulis path absolut sebagai
 * string (dipakai di beberapa tempat karena alasannya sendiri — cek
 * dokumentasi di lokasi pemakainya) dan `new URL(...)` manual di middleware.
 * Tempat-tempat itu WAJIB mengimpor konstanta ini, bukan menuliskan `/simt`
 * langsung — supaya pindah balik ke root domain cukup mengosongkan SATU
 * env var, bukan menyisir seluruh kode.
 *
 * WAJIB `NEXT_PUBLIC_*`: basePath dipatri Next.js saat BUILD, bukan runtime,
 * jadi nilainya harus konsisten antara next.config.ts (server, saat build)
 * dan komponen klien (bundel browser) — env var non-public tidak akan
 * terlihat di bundel klien sama sekali.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
