import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
      </div>

      {/* Baris filter: tinggi & jumlah kontrol sama dengan aslinya */}
      <div className="flex flex-wrap items-center gap-2">
        <Skeleton className="h-8 min-w-56 flex-1" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-8 w-40" />
      </div>
      <Skeleton className="h-3 w-full max-w-xl" />

      <TableSkeleton
        rows={25}
        cols={[
          '2fr',
          '2.5fr',
          '0.7fr',
          '2fr',
          '1.2fr',
          '1.2fr',
          '1.2fr',
          '0.8fr',
          '0.8fr',
          '1.2fr',
          '0.6fr',
        ]}
      />
    </div>
  )
}
