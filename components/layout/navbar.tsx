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
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface px-4">
      <div className="min-w-0 flex-1">
        <Breadcrumb />
      </div>

      <div className="hidden flex-1 justify-center md:flex">
        <CommandPalette navigasi={navigasi} />
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <ThemeToggle />
        <MenuPengguna pengguna={penggunaAktif} />
      </div>
    </header>
  )
}
