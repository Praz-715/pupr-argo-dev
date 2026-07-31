import { cn } from '@/lib/cn'

/**
 * Satu-satunya primitif skeleton. Halaman menyusun bentuknya dari sini —
 * jangan menulis skeleton ad-hoc per halaman (phase.md §5.3).
 *
 * Aturan: skeleton HARUS meniru bentuk akhir (jumlah baris, lebar kolom, tinggi
 * baris) supaya tidak ada layout shift saat data masuk.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('skeleton-pulse rounded-md bg-surface-3', className)}
    />
  )
}

/** Skeleton tabel: `rows` = ukuran halaman, `cols` = lebar kolom (fraksi grid). */
export function TableSkeleton({
  rows = 10,
  cols = ['2fr', '1.5fr', '1fr', '1fr', '0.75fr'],
  header = true,
}: {
  rows?: number
  cols?: string[]
  header?: boolean
}) {
  const template = cols.join(' ')
  return (
    <div role="status" aria-label="Memuat tabel" className="overflow-hidden rounded-lg border border-border">
      {header ? (
        <div
          className="grid gap-4 border-b border-border bg-surface-2 px-4 py-2.5"
          style={{ gridTemplateColumns: template }}
        >
          {cols.map((_, i) => (
            <Skeleton key={i} className="h-3.5 w-2/3" />
          ))}
        </div>
      ) : null}
      {Array.from({ length: rows }).map((_, r) => (
        <div
          key={r}
          className="grid items-center gap-4 border-b border-border px-4 py-3 last:border-b-0"
          style={{ gridTemplateColumns: template }}
        >
          {cols.map((_, c) => (
            <Skeleton key={c} className={cn('h-4', c === 0 ? 'w-4/5' : 'w-3/5')} />
          ))}
        </div>
      ))}
    </div>
  )
}

/** Kelas tinggi batang skeleton — statis supaya Tailwind ikut men-generate-nya. */
const TINGGI_BATANG: Record<number, string> = {
  45: 'h-[45%]',
  50: 'h-[50%]',
  55: 'h-[55%]',
  60: 'h-[60%]',
  70: 'h-[70%]',
  75: 'h-[75%]',
  85: 'h-[85%]',
  95: 'h-[95%]',
}

/** Skeleton chart: rasio aspek harus sama dengan chart aslinya, bukan spinner. */
export function ChartSkeleton({
  ratio = '16 / 9',
  className,
}: {
  ratio?: string
  className?: string
}) {
  return (
    <div
      role="status"
      aria-label="Memuat grafik"
      className={cn('flex w-full items-end gap-2 rounded-lg border border-border p-4', className)}
      style={{ aspectRatio: ratio }}
    >
      {[45, 70, 55, 85, 60, 95, 50, 75].map((tinggi, i) => (
        <div key={i} className="flex h-full flex-1 items-end">
          <Skeleton className={cn('w-full', TINGGI_BATANG[tinggi])} />
        </div>
      ))}
      <span className="sr-only">Memuat grafik…</span>
    </div>
  )
}

/** Skeleton kartu ringkas dashboard. */
export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border p-4', className)} role="status" aria-label="Memuat kartu">
      <Skeleton className="h-3.5 w-24" />
      <Skeleton className="mt-3 h-7 w-16" />
      <Skeleton className="mt-3 h-3 w-32" />
    </div>
  )
}

/** Skeleton grid Kotak 9 (3×3). */
export function Kotak9Skeleton() {
  return (
    <div className="grid grid-cols-3 gap-2" role="status" aria-label="Memuat sebaran Kotak 9">
      {Array.from({ length: 9 }).map((_, i) => (
        <Skeleton key={i} className="aspect-4/3" />
      ))}
    </div>
  )
}

/** Skeleton daftar baris sederhana (antrian, aktivitas terakhir). */
export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="Memuat daftar">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
