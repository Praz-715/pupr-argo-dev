import { Panel } from '@/components/ui/panel'
import { ChartSkeleton, ListSkeleton, Skeleton } from '@/components/ui/skeleton'

/**
 * Skeleton profil — meniru tata letak akhir: kepala profil dengan avatar &
 * grid 8 butir bio, lalu panel-panel dalam susunan kolom yang sama.
 */
export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-36" />

      <Panel>
        <div className="flex items-start gap-3">
          <Skeleton className="size-11 shrink-0 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-3.5 w-44" />
            <Skeleton className="h-4 w-80" />
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-2.5 w-20" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-2.5 w-16" />
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-3 h-1.5 w-full rounded-full" />
        <div className="mt-4">
          <ListSkeleton rows={3} />
        </div>
      </Panel>

      {/* Tinggi baris sama dengan halaman jadinya (27rem di page.tsx) — kerangka
          yang lebih pendek membuat halaman melompat tepat saat data masuk. */}
      <div className="grid gap-5 xl:h-[27rem] xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] xl:grid-rows-[minmax(0,1fr)]">
        <Panel className="xl:h-full">
          <Skeleton className="h-4 w-56" />
          <div className="mt-4">
            <ListSkeleton rows={4} />
          </div>
        </Panel>
        <Panel className="xl:h-full">
          <Skeleton className="h-4 w-40" />
          <div className="mt-3">
            <ChartSkeleton ratio="16 / 9" />
          </div>
        </Panel>
      </div>

      <Panel>
        <Skeleton className="h-4 w-64" />
        <div className="mt-4">
          <ListSkeleton rows={5} />
        </div>
      </Panel>
    </div>
  )
}
