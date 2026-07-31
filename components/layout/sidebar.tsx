'use client'

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/cn'
import { useHydrated, useLocalStorageBoolean } from '@/lib/hooks'
import { itemTersedia, type GrupNav } from '@/lib/navigasi'
import { IkonNav } from './ikon-nav'

const KUNCI_SIMPAN = 'simt-sidebar-collapsed'

export function Sidebar({ navigasi }: { navigasi: GrupNav[] }) {
  const pathname = usePathname()
  // Pilihan collapse bertahan antar kunjungan & tersinkron antar tab.
  const [ciut, setCiut] = useLocalStorageBoolean(KUNCI_SIMPAN)
  const siap = useHydrated()

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border bg-surface-2',
        ciut ? 'w-14' : 'w-60',
        siap ? 'transition-[width] duration-150' : '',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-border',
          ciut ? 'justify-center px-0' : 'gap-2.5 px-3',
        )}
      >
        <span
          aria-hidden
          className="flex size-7 shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-bold tracking-tight text-accent-text"
        >
          MT
        </span>
        {!ciut ? (
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-text">SIMT DJBK</span>
            <span className="block truncate text-[10px] text-text-subtle">Manajemen Talenta</span>
          </span>
        ) : null}
      </div>

      {/* Baris tetap untuk tombol ciutkan — ditaruh di ATAS (konvensi Notion/
          VS Code) dan tingginya sama di kedua state, jadi daftar menu tidak
          bergeser saat sidebar dibuka-tutup. */}
      <div className="shrink-0 border-b border-border p-2">
        <button
          type="button"
          onClick={() => setCiut(!ciut)}
          title={ciut ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          className={cn(
            'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] text-text-muted transition-colors hover:bg-surface-3 hover:text-text',
            ciut && 'justify-center px-0',
          )}
        >
          {ciut ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <PanelLeftClose className="size-4 shrink-0" />
          )}
          {!ciut ? <span>Ciutkan</span> : null}
        </button>
      </div>

      <nav
        aria-label="Navigasi utama"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-3"
      >
        {navigasi.map((grup, i) => (
          <div key={grup.label ?? `grup-${i}`}>
            {grup.label && !ciut ? (
              <p className="mb-1 px-2 text-[10px] font-semibold tracking-wider text-text-subtle uppercase">
                {grup.label}
              </p>
            ) : null}
            {grup.label && ciut ? <div className="mx-2 mb-2 border-t border-border" /> : null}

            <ul className="space-y-0.5">
              {grup.item.map((item) => {
                const tersedia = itemTersedia(item)
                const aktif =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

                const isi = (
                  <>
                    <IkonNav nama={item.ikon} className="size-4 shrink-0" />
                    {!ciut ? (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {!tersedia ? (
                          <span className="shrink-0 rounded bg-surface-3 px-1 py-px text-[9px] font-medium text-text-subtle">
                            F{item.fase}
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </>
                )

                const kelasDasar = cn(
                  'flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px]',
                  ciut && 'justify-center px-0',
                )

                return (
                  <li key={item.href}>
                    {tersedia ? (
                      <Link
                        href={item.href}
                        title={ciut ? item.label : undefined}
                        aria-current={aktif ? 'page' : undefined}
                        className={cn(
                          kelasDasar,
                          'transition-colors',
                          aktif
                            ? 'bg-accent-subtle font-medium text-accent'
                            : 'text-text-muted hover:bg-surface-3 hover:text-text',
                        )}
                      >
                        {isi}
                      </Link>
                    ) : (
                      <span
                        title={
                          ciut
                            ? `${item.label} — dibangun di Fase ${item.fase}`
                            : `Dibangun di Fase ${item.fase}`
                        }
                        aria-disabled
                        className={cn(kelasDasar, 'cursor-not-allowed text-text-subtle')}
                      >
                        {isi}
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Ruang bawah sengaja dibiarkan kosong: di dev, indikator Next.js muncul
          di pojok kiri-bawah dan akan menutupi kontrol apa pun yang ditaruh di
          sini. */}
    </aside>
  )
}
