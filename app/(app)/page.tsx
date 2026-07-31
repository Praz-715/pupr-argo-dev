import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { PageHeader } from '@/components/ui/panel'
import { AktivitasTerakhir, AktivitasTerakhirSkeleton } from './_widget/aktivitas-terakhir'
import { AntrianNominasi, AntrianNominasiSkeleton } from './_widget/antrian-nominasi'
import { JabatanKosong, JabatanKosongSkeleton } from './_widget/jabatan-kosong'
import { KartuRingkas, KartuRingkasSkeleton } from './_widget/kartu-ringkas'
import { KesehatanData, KesehatanDataSkeleton } from './_widget/kesehatan-data'
import { PetaSebaran, PetaSebaranSkeleton } from './_widget/peta-sebaran'
import {
  AnggotaKotak,
  AnggotaKotakSkeleton,
  SebaranKotak9,
  SebaranKotak9Skeleton,
} from './_widget/sebaran-kotak9'
import { TrenKinerja, TrenKinerjaSkeleton } from './_widget/tren-kinerja'

export const metadata = { title: 'Dashboard' }

/**
 * Dashboard Utama (Fase 1).
 *
 * Setiap widget dibungkus <Suspense> SENDIRI, bukan satu Suspense untuk seluruh
 * halaman: shell (sidebar, navbar, judul) langsung terkirim, lalu tiap kartu
 * mengalir masuk begitu kuerinya selesai. Satu widget yang lambat tidak menahan
 * tujuh lainnya (phase.md §5.3).
 *
 * Semua agregasi dikerjakan di SQL — lihat lib/kueri/dashboard.ts.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ kotak?: string }>
}) {
  const params = await searchParams
  const kotakDipilih = bacaKotak(params.kotak)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Dashboard Talenta"
        deskripsi="Ringkasan kondisi talenta ASN Direktorat Jenderal Bina Konstruksi — sebaran Kotak 9, kesiapan data, jabatan strategis yang kosong, dan antrian nominasi."
        aksi={<Badge tone="aksen">Fase 1</Badge>}
      />

      {/* W1 */}
      <Suspense fallback={<KartuRingkasSkeleton />}>
        <KartuRingkas />
      </Suspense>

      {/* W2 + W3 — grid menjawab "berapa di tiap kotak", peta menjawab
          "bagaimana sebarannya di dalam kotak" */}
      <div id="peta-talenta" className="grid scroll-mt-4 gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Suspense fallback={<SebaranKotak9Skeleton />}>
          <SebaranKotak9 kotakAktif={kotakDipilih} />
        </Suspense>
        <Suspense fallback={<PetaSebaranSkeleton />}>
          <PetaSebaran />
        </Suspense>
      </div>

      {/* W2b — drill-down, hanya saat ?kotak=N ada di URL */}
      {kotakDipilih !== null ? (
        <Suspense key={kotakDipilih} fallback={<AnggotaKotakSkeleton />}>
          <AnggotaKotak kotak={kotakDipilih} />
        </Suspense>
      ) : null}

      {/* W4 + W5 */}
      {/* items-start: panel mengikuti tinggi isinya sendiri. Tanpa ini, panel
          yang lebih pendek (mis. chart dengan rasio aspek tetap) ikut
          diregangkan setinggi pasangannya dan menyisakan ruang kosong besar. */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <Suspense fallback={<KesehatanDataSkeleton />}>
          <KesehatanData />
        </Suspense>
        <Suspense fallback={<JabatanKosongSkeleton />}>
          <JabatanKosong />
        </Suspense>
      </div>

      {/* W7 + W6 */}
      {/* items-start: panel mengikuti tinggi isinya sendiri. Tanpa ini, panel
          yang lebih pendek (mis. chart dengan rasio aspek tetap) ikut
          diregangkan setinggi pasangannya dan menyisakan ruang kosong besar. */}
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,6fr)_minmax(0,5fr)]">
        <Suspense fallback={<TrenKinerjaSkeleton />}>
          <TrenKinerja />
        </Suspense>
        <Suspense fallback={<AntrianNominasiSkeleton />}>
          <AntrianNominasi />
        </Suspense>
      </div>

      {/* W8 */}
      <Suspense fallback={<AktivitasTerakhirSkeleton />}>
        <AktivitasTerakhir />
      </Suspense>
    </div>
  )
}

/** Validasi param URL di boundary — jangan percaya isi query string. */
function bacaKotak(nilai: string | undefined): number | null {
  if (!nilai) return null
  const n = Number(nilai)
  if (!Number.isInteger(n) || n < 1 || n > 9) return null
  return n
}
