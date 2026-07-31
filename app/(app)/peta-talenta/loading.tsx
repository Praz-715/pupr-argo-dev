import { Panel } from '@/components/ui/panel'
import { ChartSkeleton, Kotak9Skeleton, Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton rute Peta Talenta — bentuknya menyusun ulang bentuk akhir halaman
 * (bilah filter, dua panel berdampingan) supaya tidak ada pergeseran tata letak
 * saat data masuk (phase.md §5.3).
 */
export default function Loading() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl" />
      </div>

      <div className="flex flex-wrap gap-2">
        {['w-56', 'w-44', 'w-40', 'w-40', 'w-44'].map((w) => (
          <Skeleton key={w} className={`h-8 ${w}`} />
        ))}
      </div>
      <Skeleton className="h-3 w-full max-w-2xl" />

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Panel>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-3 w-full max-w-sm" />
          <div className="mt-3">
            <Kotak9Skeleton />
          </div>
        </Panel>
        <Panel>
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-2 h-3 w-full max-w-sm" />
          <div className="mt-3">
            <ChartSkeleton ratio="16 / 10" />
          </div>
        </Panel>
      </div>
    </div>
  )
}
