import { Panel } from '@/components/ui/panel'
import { ChartSkeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton'

/** Skeleton rute Perbandingan Kandidat — menyusun ulang bentuk akhir halaman. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
      </div>

      <Panel>
        <Skeleton className="h-4 w-52" />
        <Skeleton className="mt-2 h-3 w-full max-w-lg" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 flex-1" />
        </div>
      </Panel>

      <Panel>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-2 h-3 w-full max-w-xl" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-8 w-72" />
        </div>
      </Panel>

      <Panel>
        <Skeleton className="h-4 w-52" />
        <Skeleton className="mt-2 h-3 w-full max-w-xl" />
        <div className="mt-3 grid gap-5 lg:grid-cols-2">
          <ChartSkeleton ratio="1 / 1" />
          <div className="space-y-2.5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-4 w-full" />
            ))}
          </div>
        </div>
      </Panel>

      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="mt-2 h-3 w-full max-w-lg" />
        </div>
        <TableSkeleton rows={14} cols={['1.6fr', '1fr', '1fr', '1fr']} />
      </Panel>
    </div>
  )
}
