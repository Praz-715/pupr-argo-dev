import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Keadaan "belum ada data sama sekali" — mendorong ke aksi utama.
 *
 * Dipisahkan dari `states.tsx` (yang `'use client'` karena butuh handler) sebab
 * komponen ini murni tampilan. Server Component by default: tidak ada alasan
 * mengirim JavaScript untuk sesuatu yang tidak pernah bereaksi (CLAUDE.md #4).
 *
 * Bedakan dari dua keadaan lain di `states.tsx`:
 *   - `NoResultState` — filter tidak menghasilkan apa pun (butuh tombol reset)
 *   - `ErrorState`    — gagal memuat (butuh tombol coba lagi)
 */
export function EmptyState({
  judul,
  deskripsi,
  aksi,
  ikon,
  className,
}: {
  judul: string
  deskripsi?: string
  aksi?: ReactNode
  ikon?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface-3 text-text-subtle">
        {ikon ?? <Inbox className="size-5" />}
      </div>
      <p className="text-sm font-medium text-text">{judul}</p>
      {deskripsi ? (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-text-muted">{deskripsi}</p>
      ) : null}
      {aksi ? <div className="mt-4">{aksi}</div> : null}
    </div>
  )
}
