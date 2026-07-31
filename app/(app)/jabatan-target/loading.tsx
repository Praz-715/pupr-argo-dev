import { Panel } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'

/**
 * Skeleton daftar jabatan target — meniru tata letak akhir (phase.md §5.3):
 * tiga kartu ringkas lalu tabel, dengan lebar kolom yang sama, supaya tidak ada
 * pergeseran tata letak saat isinya datang.
 */
export default function Loading() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-6 w-52" />
        <Skeleton className="mt-2 h-4 w-full max-w-2xl" />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Panel key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-12" />
            <Skeleton className="mt-2 h-3 w-full" />
          </Panel>
        ))}
      </div>

      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-2 h-3 w-full max-w-xl" />
        </div>
        <TableSkeleton rows={4} cols={['2.4fr', '1fr', '0.8fr', '0.8fr', '1fr', '1.2fr']} />
      </Panel>
    </div>
  )
}
