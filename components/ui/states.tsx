'use client'

import { AlertTriangle, RotateCcw, SearchX } from 'lucide-react'

import { cn } from '@/lib/cn'
import { Button } from './button'

/**
 * Dua dari TIGA keadaan kosong yang dibedakan tegas (phase.md §5.4).
 * Keadaan pertama ("belum ada data sama sekali") ada di empty-state.tsx karena
 * tidak butuh interaktivitas, jadi tidak perlu jadi Client Component.
 * Jangan pakai satu komponen generik "no data" untuk ketiganya — pesan dan
 * aksi berikutnya berbeda, dan itu yang menentukan pengguna paham atau bingung.
 */

/** 2. Filter tidak menghasilkan apa pun → tampilkan filter aktif + reset. */
export function NoResultState({
  filterAktif,
  onReset,
  className,
}: {
  /** Ringkasan filter yang sedang dipakai, mis. ["Unit: BP2JK DKI", "Tahun: 2025"]. */
  filterAktif?: string[]
  onReset?: () => void
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
        <SearchX className="size-5" />
      </div>
      <p className="text-sm font-medium text-text">Tidak ada data yang cocok dengan filter</p>
      {filterAktif && filterAktif.length > 0 ? (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-text-muted">
          Filter aktif: {filterAktif.join(' · ')}
        </p>
      ) : null}
      {onReset ? (
        <Button className="mt-4" size="sm" onClick={onReset} ikon={<RotateCcw className="size-3.5" />}>
          Reset filter
        </Button>
      ) : null}
    </div>
  )
}

/** 3. Gagal memuat → jelaskan + tombol coba lagi. Per widget, bukan per halaman. */
export function ErrorState({
  judul = 'Gagal memuat data',
  deskripsi,
  onCobaLagi,
  className,
}: {
  judul?: string
  deskripsi?: string
  onCobaLagi?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-danger-border bg-danger-subtle px-6 py-10 text-center',
        className,
      )}
    >
      <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-surface text-danger">
        <AlertTriangle className="size-5" />
      </div>
      <p className="text-sm font-medium text-text">{judul}</p>
      {deskripsi ? (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-text-muted">{deskripsi}</p>
      ) : null}
      {onCobaLagi ? (
        <Button
          className="mt-4"
          size="sm"
          variant="sekunder"
          onClick={onCobaLagi}
          ikon={<RotateCcw className="size-3.5" />}
        >
          Coba lagi
        </Button>
      ) : null}
    </div>
  )
}
