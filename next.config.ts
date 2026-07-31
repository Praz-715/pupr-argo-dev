import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // typedRoutes menyusul begitu halaman-halaman Fase 2+ sudah ada; kalau
  // dinyalakan sekarang, seluruh href yang belum punya route gagal typecheck.
  serverExternalPackages: ['mysql2'],
}

export default nextConfig
