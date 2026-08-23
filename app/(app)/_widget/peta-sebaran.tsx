import { ambangSumbuDari, ambilPengaturan } from '@/lib/pengaturan'
import { PetaTalenta } from '@/components/charts/peta-talenta'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ChartSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatAngka } from '@/lib/format'
import { ambilTitikTalenta } from '@/lib/kueri/dashboard'

/**
 * W3 · Peta sebaran Kinerja × Potensial.
 *
 * Pendamping grid Kotak 9: grid menjawab "berapa orang di tiap kotak", peta ini
 * menjawab "bagaimana sebarannya DI DALAM kotak" — yang hilang kalau hanya ada
 * grid, karena satu sel bisa memuat orang dengan potensial 82 dan 99 sekaligus.
 */
export async function PetaSebaran() {
  const { titik, totalPegawai } = await ambilTitikTalenta()

  if (titik.length === 0) {
    return (
      <Panel>
        <PanelHeader judul="Peta Kinerja × Potensial" />
        <EmptyState
          className="mt-4"
          judul="Belum ada data asesmen untuk dipetakan"
          deskripsi="Peta ini terbentuk dari nilai kinerja dan potensial pada asesmen terbaru tiap pegawai."
        />
      </Panel>
    )
  }

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        judul="Peta Kinerja × Potensial"
        // Legenda ("dikelompokkan jadi N titik · ukuran gelembung = jumlah
        // pegawai · garis putus-putus = ambang 60 & 80") DIHAPUS atas permintaan
        // user (18 Agu 2026). Angkanya tetap DINAMIS — `totalPegawai` dijumlahkan
        // dari hasil kueri `ambilTitikTalenta()`, bukan konstanta.
        //
        // Template string, BUKAN fragment: bentuk fragment terukur menelan spasi
        // setelah `}` dan terender "10pegawai".
        deskripsi={`${formatAngka(totalPegawai)} pegawai`}
      />

      <div className="mt-2">
        <PetaTalenta titik={titik} ambang={ambangSumbuDari(await ambilPengaturan())} />
      </div>

      {/* Paragraf metodologi (kenapa gelembung, bukan titik ber-jitter) DIHAPUS
          atas permintaan user, 18 Agu 2026. Alasan teknisnya tidak hilang — ia
          sudah tertulis sebagai komentar di `components/charts/peta-talenta.tsx`,
          tempat keputusannya benar-benar dieksekusi. Yang hilang cuma
          penyampaiannya di layar.

          JANGAN dikembalikan sebagai "perbaikan"; ini keputusan user. */}
    </Panel>
  )
}

export function PetaSebaranSkeleton() {
  return (
    <Panel>
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-2 h-3 w-full max-w-lg" />
      <div className="mt-3">
        <ChartSkeleton ratio="16 / 10" />
      </div>
    </Panel>
  )
}
