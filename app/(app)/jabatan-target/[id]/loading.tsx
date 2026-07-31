import { Panel } from '@/components/ui/panel'
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton'

/** Skeleton editor jabatan target: header, empat kartu, panel pemeriksaan, tab. */
export default function Loading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-4 w-40" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Skeleton className="h-7 w-full max-w-md" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-28 rounded-md" />
          <Skeleton className="h-8 w-24 rounded-md" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Panel key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-5 w-16" />
            <Skeleton className="mt-2 h-3 w-full" />
          </Panel>
        ))}
      </div>

      <Skeleton className="h-24 w-full rounded-lg" />

      <div className="flex gap-4 border-b border-border pb-2">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-24" />
        <Skeleton className="h-5 w-28" />
      </div>

      <ListSkeleton rows={5} />
    </div>
  )
}
