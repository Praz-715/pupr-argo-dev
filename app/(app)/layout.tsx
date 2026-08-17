import { redirect } from 'next/navigation'

import { Navbar } from '@/components/layout/navbar'
import { Sidebar } from '@/components/layout/sidebar'
import { RUTE_GANTI_SANDI, wajibMasuk } from '@/lib/auth'
import { logoResmi } from '@/lib/aset-publik'
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
    <div className="flex h-dvh overflow-hidden bg-kanvas">
      <Sidebar navigasi={navigasi} logo={logoResmi()} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Navbar navigasi={navigasi} penggunaAktif={sesi.pengguna} />
        {/* Pita pemberitahuan filter populasi DILEPAS dari sini atas permintaan
            user (11 Agu 2026). Komponennya utuh di
            `components/layout/pita-populasi.tsx` dan tinggal dipasang kembali
            satu baris di titik ini — pola yang sama dengan lima widget dashboard
            yang dilepas tapi tidak dihapus.

            Yang hilang bersamanya, supaya tidak perlu ditemukan ulang: itu
            satu-satunya tempat aplikasi menyatakan tampilannya dibatasi ke 10
            dari 43 pegawai. Setelah dilepas, TIDAK ada penanda apa pun lagi —
            terukur, bukan dugaan: angka 43 tidak muncul di dashboard sama sekali,
            sebab `ambilKartuRingkas` menyaring kedua penghitungnya sehingga
            10 = 10 dan kartu "Pegawai aktif" jatuh ke kalimat "Semua yang
            dihitung di sini berstatus aktif". Aplikasi ini kini menampilkan 10
            pegawai seolah itu seluruh DJBK.

            JANGAN memasangnya kembali sebagai "perbaikan bug". Ini keputusan
            user, bukan kelalaian. */}
        {/* bg-kanvas, bukan bg-surface: panel & kartu memakai --surface, jadi
            kalau area konten juga putih maka satu-satunya yang memisahkan kartu
            dari latarnya adalah border 1px — dan halaman padat kartu (dashboard,
            laporan) jadi rata tanpa hierarki. Kanvas satu tingkat lebih gelap
            mengembalikan pemisahan itu tanpa menambah shadow (v1 memakai cara
            yang sama: --bg #eef2f7 di bawah kartu putih). */}
        <main className="min-h-0 flex-1 overflow-y-auto bg-kanvas">
          <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">{children}</div>
        </main>
      </div>
    </div>
  )
}
