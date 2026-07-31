import { cn } from '@/lib/cn'

/** Indikator proses inline. Untuk pemuatan halaman pakai Skeleton, bukan ini. */
export function Spinner({
  className,
  label = 'Memuat',
}: {
  className?: string
  label?: string
}) {
  return (
    <span
      role="status"
      aria-label={label}
      className={cn(
        'inline-block size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  )
}
