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

  const terpadat = titik.reduce((a, b) => (b.jumlah > a.jumlah ? b : a), titik[0]!)

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        judul="Peta Kinerja × Potensial"
        deskripsi={
          <>
            {formatAngka(totalPegawai)} pegawai dikelompokkan jadi {formatAngka(titik.length)} titik
            · ukuran gelembung = jumlah pegawai · garis putus-putus = ambang 60 & 80
          </>
        }
      />

      <div className="mt-2">
        <PetaTalenta titik={titik} />
      </div>

      <p className="mt-2 border-t border-border pt-3 text-[11px] leading-relaxed text-text-subtle">
        Digambar sebagai gelembung, bukan titik ber-<em>jitter</em>: sumbu Kinerja hanya punya lima
        nilai yang mungkin (100/80/60/40/20), sehingga pegawai bertumpuk. <em>Jitter</em>{' '}
        mengatasinya dengan memindahkan titik ke koordinat yang bukan nilainya — pada halaman
        pengambilan keputusan, itu berarti menampilkan posisi palsu. Titik terpadat saat ini:{' '}
        {formatAngka(terpadat.jumlah)} pegawai di Kinerja {terpadat.y} × Potensial {terpadat.x}.
      </p>
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
