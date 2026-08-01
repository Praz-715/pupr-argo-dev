import { redirect } from 'next/navigation'

import { Navbar } from '@/components/layout/navbar'
import { Sidebar } from '@/components/layout/sidebar'
import { RUTE_GANTI_SANDI, wajibMasuk } from '@/lib/auth'
import { navigasiUntuk } from '@/lib/navigasi'

/**
 * App shell full-screen: sidebar kiri persisten + navbar atas + area konten.
 * Hanya area konten yang menggulir — sidebar & navbar tetap di tempat, supaya
 * halaman padat tabel tidak kehilangan navigasi (CLAUDE.md §Desain UI/UX).
 *
 * **Di sinilah sesi benar-benar diperiksa.** Middleware hanya melihat ada
 * tidaknya cookie (ia berjalan di edge, tidak bisa menyentuh MySQL), jadi
 * cookie yang sudah dicabut atau kedaluwarsa baru ketahuan di sini. Karena
 * layout ini membungkus SELURUH halaman aplikasi, tidak ada route di bawahnya
 * yang bisa lupa memasang penjagaan — itu alasan gerbangnya di layout dan
 * bukan disalin ke tiap `page.tsx`.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesi = await wajibMasuk()

  // Sandi masih yang dibuatkan Super Admin → tahan di luar aplikasi sampai
  // diganti. Halaman tujuannya ada di grup (auth), jadi tidak ada lingkaran.
  if (sesi.harusGantiSandi) redirect(RUTE_GANTI_SANDI)

  const navigasi = navigasiUntuk(sesi.pengguna.peran)

  return (
    <div className="flex h-dvh overflow-hidden bg-surface">
      <Sidebar navigasi={navigasi} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar navigasi={navigasi} penggunaAktif={sesi.pengguna} />
        <main className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
