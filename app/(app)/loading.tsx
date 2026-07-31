import { Skeleton } from '@/components/ui/skeleton'
import { AktivitasTerakhirSkeleton } from './_widget/aktivitas-terakhir'
import { AntrianNominasiSkeleton } from './_widget/antrian-nominasi'
import { JabatanKosongSkeleton } from './_widget/jabatan-kosong'
import { KartuRingkasSkeleton } from './_widget/kartu-ringkas'
import { KesehatanDataSkeleton } from './_widget/kesehatan-data'
import { PetaSebaranSkeleton } from './_widget/peta-sebaran'
import { SebaranKotak9Skeleton } from './_widget/sebaran-kotak9'
import { TrenKinerjaSkeleton } from './_widget/tren-kinerja'

/**
 * Skeleton tingkat segmen — menyusun ulang skeleton milik tiap widget dengan
 * tata letak yang SAMA seperti halaman aslinya, sehingga tidak ada layout shift
 * saat konten masuk (phase.md §5.3). Skeletonnya diimpor dari widget
 * masing-masing, bukan ditulis ulang di sini.
 */
export default function Loading() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-2 h-4 w-full max-w-3xl" />
      </div>

      <KartuRingkasSkeleton />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <SebaranKotak9Skeleton />
        <PetaSebaranSkeleton />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <KesehatanDataSkeleton />
        <JabatanKosongSkeleton />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <TrenKinerjaSkeleton />
        <AntrianNominasiSkeleton />
      </div>

      <AktivitasTerakhirSkeleton />
    </div>
  )
}
