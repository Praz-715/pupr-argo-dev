import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // typedRoutes menyusul begitu halaman-halaman Fase 2+ sudah ada; kalau
  // dinyalakan sekarang, seluruh href yang belum punya route gagal typecheck.
  serverExternalPackages: ['mysql2'],

  /**
   * Rute yang pindah tempat.
   *
   * Ditaruh di sini, **bukan** sebagai halaman yang memanggil
   * `permanentRedirect()`. Versi halaman sudah dicoba dan **tersangkut di batas
   * `<Suspense>`**: penggunanya melihat skeleton yang tidak pernah selesai, yang
   * lebih buruk daripada 404 karena tidak menyatakan apa pun dan tidak bisa
   * dilaporkan sebagai galat. `redirects()` diselesaikan **sebelum** render
   * dimulai, jadi tidak ada yang bisa tersangkut, dan berlaku untuk semua metode
   * HTTP sekaligus.
   *
   * `permanent: true` (308) karena kepindahannya memang tetap. Query string ikut
   * terbawa sendiri; fragment (`#jabatan-kosong`) **tidak** bisa dikirim server —
   * ia milik peramban — jadi tidak dijanjikan di sini.
   */
  async redirects() {
    return [
      {
        // Jabatan Kosong & Risiko Kekosongan melebur ke Jabatan Target di Fase 11
        // (U-14). Alamat lamanya hidup sejak Fase 4 dan sudah mengendap di riwayat
        // peramban, tab yang dibiarkan terbuka, serta tautan antar staf.
        source: '/master/jabatan-kosong',
        destination: '/jabatan-target',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
