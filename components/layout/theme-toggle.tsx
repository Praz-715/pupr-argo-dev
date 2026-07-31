'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

import { cn } from '@/lib/cn'
import { useHydrated } from '@/lib/hooks'

const PILIHAN = [
  { nilai: 'light', label: 'Terang', Ikon: Sun },
  { nilai: 'dark', label: 'Gelap', Ikon: Moon },
  { nilai: 'system', label: 'Sistem', Ikon: Monitor },
] as const

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  // Tema sebenarnya baru diketahui di klien; sebelum itu render bentuk yang
  // sama ukurannya supaya tidak ada layout shift.
  const siap = useHydrated()

  return (
    <div
      role="radiogroup"
      aria-label="Tema tampilan"
      className="flex items-center gap-0.5 rounded-md border border-border bg-surface-2 p-0.5"
    >
      {PILIHAN.map(({ nilai, label, Ikon }) => {
        const aktif = siap && theme === nilai
        return (
          <button
            key={nilai}
            type="button"
            role="radio"
            aria-checked={aktif}
            title={`Tema ${label}`}
            onClick={() => setTheme(nilai)}
            className={cn(
              'flex size-7 items-center justify-center rounded transition-colors',
              aktif
                ? 'bg-surface text-text shadow-none ring-1 ring-border'
                : 'text-text-subtle hover:text-text',
            )}
          >
            <Ikon className="size-3.5" />
            <span className="sr-only">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
