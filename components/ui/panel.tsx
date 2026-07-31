import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Wadah dasar konten. Border tipis, bukan shadow tebal — sesuai arah desain
 * "profesional seperti Notion" (CLAUDE.md).
 */
export function Panel({
  children,
  className,
  padat = false,
  id,
}: {
  children: ReactNode
  className?: string
  /** Hilangkan padding — untuk panel yang isinya tabel penuh. */
  padat?: boolean
  /** Target anchor dalam halaman (mis. dari kartu ringkas dashboard). */
  id?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        'rounded-lg border border-border bg-surface',
        padat ? '' : 'p-4',
        // scroll-mt supaya judul panel tidak tertutup navbar saat dituju anchor
        id ? 'scroll-mt-4' : '',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function PanelHeader({
  judul,
  deskripsi,
  aksi,
  className,
}: {
  judul: ReactNode
  /** Basis data / cakupan angka — wajib untuk panel berisi chart (phase.md §5.5). */
  deskripsi?: ReactNode
  aksi?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-text">{judul}</h2>
        {deskripsi ? (
          <p className="mt-0.5 text-xs leading-relaxed text-text-subtle">{deskripsi}</p>
        ) : null}
      </div>
      {aksi ? <div className="flex shrink-0 items-center gap-1.5">{aksi}</div> : null}
    </header>
  )
}

/** Judul halaman + deskripsi + aksi kanan. Dipakai di puncak setiap halaman. */
export function PageHeader({
  judul,
  deskripsi,
  aksi,
}: {
  judul: ReactNode
  deskripsi?: ReactNode
  aksi?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-text">{judul}</h1>
        {deskripsi ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-text-muted">{deskripsi}</p>
        ) : null}
      </div>
      {aksi ? <div className="flex shrink-0 items-center gap-2">{aksi}</div> : null}
    </div>
  )
}
