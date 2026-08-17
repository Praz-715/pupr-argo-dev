import type { GrupNav } from '@/lib/navigasi'
import type { PenggunaAktif } from '@/lib/peran'
import { Breadcrumb } from './breadcrumb'
import { CommandPalette } from './command-palette'
import { MenuPengguna } from './menu-pengguna'
import { ThemeToggle } from './theme-toggle'

/**
 * Navbar atas: breadcrumb · pencarian · pengalih tema · menu pengguna.
 * Sesuai app shell yang diminta CLAUDE.md — tanpa hero, langsung ke konten kerja.
 */
export function Navbar({
  navigasi,
  penggunaAktif,
}: {
  navigasi: GrupNav[]
  penggunaAktif: PenggunaAktif
}) {
  return (
    // Strip emas 3px di tepi kiri (v1 `.topbar::before`) menyambung tepi kanan
    // sidebar, jadi garis identitasnya berlanjut tanpa putus di sudut layar.
    <header className="tanpa-cetak relative flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4 before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-emas">
      <div className="min-w-0 flex-1">
        <Breadcrumb />
      </div>

      {/* `lg:`, bukan `md:`. Di tepat 768px (breakpoint md) kotak pencarian
          `max-w-xs` muncul sementara ruang yang tersisa setelah sidebar 240px
          hanya 528px — bersama breadcrumb & menu pengguna, navbar meluber 152px
          dan halaman ikut menggulir horizontal 12px. Terukur, dan sudah ada
          sebelum perombakan tampilan ini: langkah smoke `tablet sempit 768px`
          di Fase 4 memang merah karenanya.

          Pencarian tetap terjangkau di lebar mana pun lewat Ctrl/⌘+K — jadi
          yang hilang di bawah `lg` cuma pintu masuk visualnya, bukan fiturnya. */}
      <div className="hidden flex-1 justify-center lg:flex">
        <CommandPalette navigasi={navigasi} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <MenuPengguna pengguna={penggunaAktif} />
      </div>
    </header>
  )
}
