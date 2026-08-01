import { ThemeToggle } from '@/components/layout/theme-toggle'

/**
 * Shell halaman autentikasi: tanpa sidebar, tanpa navbar, tanpa breadcrumb.
 *
 * Sengaja bukan app shell yang dikosongkan. Halaman masuk yang memperlihatkan
 * kerangka navigasi memberi kesan aplikasinya sudah terbuka, dan menu yang
 * terlihat tapi tidak bisa diklik adalah cara paling cepat membuat orang
 * mengira aplikasinya rusak, bukan mengira dirinya belum masuk.
 *
 * Pengalih tema tetap ada: preferensi tema tersimpan per perangkat, dan
 * seseorang yang memakai tema gelap tidak boleh disilaukan lebih dulu sebelum
 * boleh mengubahnya.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-2">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <span className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-bold tracking-tight text-accent-text"
          >
            MT
          </span>
          <span className="leading-tight">
            <span className="block text-[13px] font-semibold text-text">SIMT DJBK</span>
            <span className="block text-[10px] text-text-subtle">Manajemen Talenta</span>
          </span>
        </span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 items-start justify-center px-4 pb-16 pt-6 sm:items-center sm:pt-0">
        <div className="w-full max-w-[26rem]">{children}</div>
      </main>

      <footer className="shrink-0 px-4 pb-5 text-center">
        <p className="text-[11px] leading-relaxed text-text-subtle">
          Direktorat Jenderal Bina Konstruksi · Kementerian Pekerjaan Umum
          <br />
          Aplikasi internal. Data pegawai di dalamnya termasuk data pribadi yang dilindungi UU No.
          27/2022.
        </p>
      </footer>
    </div>
  )
}
