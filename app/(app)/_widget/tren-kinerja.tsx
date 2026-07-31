import { TrenKinerja as ChartTren } from '@/components/charts/tren-kinerja'
import { Badge } from '@/components/ui/badge'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ChartSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatAngka, formatPersenNilai, formatSkor } from '@/lib/format'
import { ambilTrenKinerja } from '@/lib/kueri/dashboard'

/**
 * W7 · Tren kinerja agregat per periode SKP.
 *
 * Memakai `kinerja_periode.nilai_kinerja` yang granular, BUKAN
 * `asesmen_talenta.nilai_kinerja_y` yang hanya punya lima nilai diskrit —
 * garis tren dari nilai diskrit akan tampak melompat dan menyesatkan
 * (phase.md §3 K-1).
 */
export async function TrenKinerja() {
  const { titik, tahun, cakupanPegawai, totalPegawai } = await ambilTrenKinerja()

  if (titik.length === 0 || tahun === null) {
    return (
      <Panel>
        <PanelHeader judul="Tren kinerja" />
        <EmptyState
          className="mt-4"
          judul="Belum ada data kinerja periodik"
          deskripsi="Tren terbentuk dari rekap kinerja triwulan yang disinkronkan dari e-Kinerja."
        />
      </Panel>
    )
  }

  const awal = titik[0]!
  const akhir = titik[titik.length - 1]!
  const selisih = Math.round((akhir.rerataKinerja - awal.rerataKinerja) * 100) / 100
  const cakupan = totalPegawai > 0 ? (cakupanPegawai / totalPegawai) * 100 : 0

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        judul={`Tren kinerja ${tahun}`}
        deskripsi={
          <>
            Rata-rata nilai kinerja &amp; perilaku per periode SKP ·{' '}
            {formatAngka(cakupanPegawai)} dari {formatAngka(totalPegawai)} pegawai (
            {formatPersenNilai(cakupan)}) punya data periodik
          </>
        }
        aksi={
          <Badge tone={selisih >= 0 ? 'sukses' : 'peringatan'}>
            {selisih >= 0 ? '+' : ''}
            {formatSkor(selisih)} poin
          </Badge>
        }
      />

      <div className="mt-2">
        <ChartTren
          titik={titik.map((t) => ({
            periode: t.periode,
            nilaiKinerja: t.rerataKinerja,
            nilaiPerilaku: t.rerataPerilaku,
            jumlahPegawai: t.jumlahPegawai,
          }))}
          namaSeriKinerja="Rata-rata kinerja"
          namaSeriPerilaku="Rata-rata perilaku"
        />
      </div>

      <p className="mt-2 border-t border-border pt-3 text-[11px] leading-relaxed text-text-subtle">
        Sumbu diperbesar ke rentang data supaya perubahan beberapa poin terlihat — perhatikan skalanya
        saat membaca. Memakai nilai kinerja granular (skala penuh 0–100) dari rekap triwulan, bukan
        skor sumbu Kinerja pada Kotak 9 yang hanya punya lima nilai (100/80/60/40/20).
      </p>
    </Panel>
  )
}

export function TrenKinerjaSkeleton() {
  return (
    <Panel>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-full max-w-lg" />
      <div className="mt-3">
        <ChartSkeleton ratio="16 / 9" />
      </div>
    </Panel>
  )
}
