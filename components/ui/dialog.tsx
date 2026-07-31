'use client'

import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { Button } from './button'

/**
 * Dialog modal berbasis `<dialog>` bawaan browser.
 *
 * Dipilih daripada div+portal karena elemen native sudah memberi gratis:
 * focus trap, backdrop, tombol Esc, dan `aria-modal` — hal-hal yang biasanya
 * diimplementasikan setengah jalan lalu jadi masalah aksesibilitas.
 */
export function Dialog({
  buka,
  onTutup,
  judul,
  deskripsi,
  children,
  aksi,
  lebar = 'md',
}: {
  buka: boolean
  onTutup: () => void
  judul: string
  deskripsi?: string
  children?: ReactNode
  /** Tombol aksi di kaki dialog. */
  aksi?: ReactNode
  lebar?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (buka && !el.open) el.showModal()
    if (!buka && el.open) el.close()
  }, [buka])

  const kelasLebar = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[lebar]

  return (
    <dialog
      ref={ref}
      // `close` menyala juga saat pengguna menekan Esc — jadi state di induk
      // tetap sinkron tanpa perlu menangani keydown sendiri.
      onClose={onTutup}
      onClick={(e) => {
        // Klik pada backdrop: target-nya elemen dialog itu sendiri.
        if (e.target === ref.current) onTutup()
      }}
      className={cn(
        'w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-0 text-text shadow-[var(--shadow-overlay)]',
        'backdrop:bg-black/40',
        kelasLebar,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text">{judul}</h2>
          {deskripsi ? (
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{deskripsi}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onTutup}
          aria-label="Tutup dialog"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-surface-3 hover:text-text"
        >
          <X className="size-4" />
        </button>
      </div>

      {children ? <div className="p-4">{children}</div> : null}

      {aksi ? (
        <div className="flex items-center justify-end gap-2 border-t border-border p-3">{aksi}</div>
      ) : null}
    </dialog>
  )
}

/**
 * Dialog konfirmasi untuk aksi yang sulit dibatalkan.
 * Tombol konfirmasi punya pending state sendiri — aksi destruktif justru yang
 * paling butuh umpan balik bahwa klik sudah diterima (phase.md §5.2).
 */
export function DialogKonfirmasi({
  buka,
  onTutup,
  onKonfirmasi,
  judul,
  deskripsi,
  labelKonfirmasi = 'Lanjutkan',
  labelPending = 'Memproses…',
  pending = false,
  destruktif = false,
}: {
  buka: boolean
  onTutup: () => void
  onKonfirmasi: () => void
  judul: string
  deskripsi?: string
  labelKonfirmasi?: string
  labelPending?: string
  pending?: boolean
  destruktif?: boolean
}) {
  return (
    <Dialog
      buka={buka}
      onTutup={onTutup}
      judul={judul}
      deskripsi={deskripsi}
      lebar="sm"
      aksi={
        <>
          <Button variant="sekunder" size="sm" onClick={onTutup} disabled={pending}>
            Batal
          </Button>
          <Button
            variant={destruktif ? 'bahaya' : 'utama'}
            size="sm"
            onClick={onKonfirmasi}
            pending={pending}
            labelPending={labelPending}
          >
            {labelKonfirmasi}
          </Button>
        </>
      }
    />
  )
}
