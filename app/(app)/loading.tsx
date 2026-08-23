import { Skeleton } from '@/components/ui/skeleton'
import { PetaSebaranSkeleton } from './_widget/peta-sebaran'
import { KartuRingkasSkeleton } from './_widget/kartu-ringkas'
import { SebaranKotak9Skeleton } from './_widget/sebaran-kotak9'

/**
 * Skeleton tingkat segmen — menyusun ulang skeleton milik tiap widget dengan
 * tata letak yang SAMA seperti halaman aslinya, sehingga tidak ada layout shift
 * saat konten masuk (phase.md §5.3). Skeletonnya diimpor dari widget
 * masing-masing, bukan ditulis ulang di sini.
 *
 * **Susunannya wajib mengikuti `page.tsx`.** Kalau salah satu diubah tanpa yang
 * lain, halamannya melompat tepat pada detik data masuk — dan itu justru momen
 * ketika pengguna sedang menatapnya. Sekarang tiga panel: KPI · Sebaran Kotak 9
 * berdampingan dengan Jabatan Kosong.
 *
 * Skeleton drill-down (`AnggotaKotakSkeleton`) sengaja TIDAK ada di sini: ia
 * hanya muncul saat `?kotak=N` ada di URL, dan menampilkannya pada pemuatan
 * pertama akan menjanjikan panel yang mungkin tidak pernah datang.
 */
export default function Loading() {
  return (
    <div className="space-y-5">
      <div>
        <Skeleton className="h-7 w-52" />
        <Skeleton className="mt-2 h-4 w-full max-w-3xl" />
      </div>

      <KartuRingkasSkeleton />

      {/* Kolomnya WAJIB sama dengan `page.tsx` — `6fr : 5fr`, Kotak 9 lebih lebar
          (keputusan user, 18 Agu 2026). Kalau salah satu diubah tanpa yang lain,
          halamannya melompat tepat pada detik data masuk. */}
      <div className="grid gap-5 xl:h-[39rem] xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] xl:grid-rows-[minmax(0,1fr)]">
        <SebaranKotak9Skeleton />
        <PetaSebaranSkeleton />
      </div>
    </div>
  )
}
