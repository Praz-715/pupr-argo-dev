import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { FASE_TERSEDIA } from '@/lib/navigasi'

/**
 * Tautan ke halaman yang mungkin belum dibangun.
 *
 * Kalau fasenya belum tiba, dirender sebagai teks biasa dengan keterangan fase —
 * BUKAN link yang mengarah ke 404. Tidak ada klik mati (phase.md §5.2).
 */
export function TautanFase({
  href,
  fase,
  children,
  className,
  title,
}: {
  href: string
  fase: number
  children: ReactNode
  className?: string
  title?: string
}) {
  const tersedia = fase <= FASE_TERSEDIA

  if (!tersedia) {
    return (
      <span
        aria-disabled
        title={title ?? `Halaman ini dibangun di Fase ${fase}`}
        className={cn('cursor-not-allowed text-text-muted', className)}
      >
        {children}
      </span>
    )
  }

  return (
    <Link href={href} title={title} className={cn('hover:text-accent', className)}>
      {children}
    </Link>
  )
}

/** Penanda kecil "Fase N" untuk melabeli tujuan yang belum ada. */
export function LabelFase({ fase }: { fase: number }) {
  if (fase <= FASE_TERSEDIA) return null
  return (
    <span
      title={`Dibangun di Fase ${fase}`}
      className="ml-1.5 shrink-0 rounded bg-surface-3 px-1 py-px align-middle text-[9px] font-medium text-text-subtle"
    >
      F{fase}
    </span>
  )
}
