import { ArrowRight, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { formatAngka, formatNip, formatSkorRingkas } from '@/lib/format'
import { ambilJabatanKosongRinci, ambilPejabatBerisiko } from '@/lib/kueri/master'

export const metadata = { title: 'Jabatan Kosong & Risiko Kekosongan' }

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Jabatan Kosong & Risiko Kekosongan (U-6 — perluasan PRD §6.4 "Status Jabatan
 * Kosong").
 *
 * PRD hanya mencakup jabatan yang **sudah** kosong. Lampiran B langkah 2 meminta
 * jabatan yang **berisiko** kosong — dan itu pertanyaan yang berbeda secara
 * operasional: kekosongan yang sudah terjadi berarti sudah terlambat, sedangkan
 * kekosongan yang akan datang masih bisa disiapkan suksesornya.
 *
 * Bahan untuk bagian "berisiko" tidak butuh kolom baru maupun data baru: tanggal
 * lahir ada di dalam NIP (phase.md §3 K-6) → usia → proyeksi Batas Usia Pensiun
 * per jenis jabatan (58/60/65).
 */
export default async function JabatanKosongPage({ searchParams }: { searchParams: ParamHalaman }) {
  const params = await searchParams
  const ambang = bacaAmbang(params.ambang)
  const hanyaStrategis = params.strategis === '1'

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Jabatan Kosong & Risiko Kekosongan"
        deskripsi="Jabatan yang sudah kosong, dan jabatan yang akan kosong karena pejabatnya mendekati Batas Usia Pensiun."
      />

      <Suspense fallback={<KosongSkeleton />}>
        <IsiKosong hanyaStrategis={hanyaStrategis} />
      </Suspense>

      <Suspense key={ambang} fallback={<RisikoSkeleton />}>
        <IsiRisiko ambang={ambang} />
      </Suspense>
    </div>
  )
}

async function IsiKosong({ hanyaStrategis }: { hanyaStrategis: boolean }) {
  const { daftar, total, tanpaTarget } = await ambilJabatanKosongRinci(hanyaStrategis)

  return (
    <Panel padat>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3.5 py-3">
        <PanelHeader
          judul="Sudah kosong"
          deskripsi={
            total === 0
              ? 'Tidak ada jabatan berstatus kosong.'
              : `${formatAngka(total)} jabatan${hanyaStrategis ? ' strategis (eselon I–III)' : ''} · ${formatAngka(tanpaTarget)} belum punya jabatan target`
          }
        />
        <Link
          href={hanyaStrategis ? '/master/jabatan-kosong' : '/master/jabatan-kosong?strategis=1'}
          scroll={false}
          className="text-[11px] whitespace-nowrap text-accent hover:underline"
        >
          {hanyaStrategis ? 'Tampilkan semua eselon' : 'Hanya eselon I–III'}
        </Link>
      </div>

      {total === 0 ? (
        <div className="p-4">
          <EmptyState
            judul="Tidak ada jabatan kosong"
            deskripsi="Seluruh jabatan berstatus terisi. Bagian di bawah menunjukkan yang akan kosong."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-text-subtle uppercase">
                <th className="px-3 py-2">Jabatan</th>
                <th className="px-3 py-2">Unit Organisasi</th>
                <th className="px-3 py-2">Eselon</th>
                <th className="px-3 py-2">Kesiapan suksesi</th>
                <th className="px-3 py-2 text-right">Kandidat pool</th>
                <th className="px-3 py-2 text-right">Siap</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="block font-medium text-text">{d.namaJabatan}</span>
                    <span className="tabular block text-[11px] text-text-subtle">
                      {d.kodeJabatan} · {d.jenjang}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-muted">{d.namaUnit}</td>
                  <td className="px-3 py-2 text-text-muted">
                    {d.eselon === 'NON_ESELON' ? (
                      <span className="whitespace-nowrap text-text-subtle">Non-eselon</span>
                    ) : (
                      d.eselon
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {!d.adaJabatanTarget ? (
                      <span className="flex items-start gap-1.5">
                        <Badge tone="peringatan">Belum ada jabatan target</Badge>
                      </span>
                    ) : d.jumlahKandidatSiap > 0 ? (
                      <Badge tone="sukses">Ada suksesor siap</Badge>
                    ) : (
                      <Badge tone="aksen">Target ada, suksesor belum</Badge>
                    )}
                  </td>
                  <td className="tabular px-3 py-2 text-right text-text-muted">
                    {formatAngka(d.jumlahKandidatPool)}
                  </td>
                  <td className="tabular px-3 py-2 text-right font-medium text-text">
                    {formatAngka(d.jumlahKandidatSiap)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-border px-3.5 py-3 text-[11px] leading-relaxed text-text-subtle">
        Diurutkan dengan <strong className="font-medium text-text-muted">yang belum punya jabatan
        target di atas</strong>: tanpa profil target, kandidatnya belum bisa dinilai sama sekali —
        itu kekosongan yang paling jauh dari terisi, bukan sekadar yang paling tinggi eselonnya.
      </p>
    </Panel>
  )
}

async function IsiRisiko({ ambang }: { ambang: number }) {
  const { daftar, totalDiperiksa, nipTidakTerbaca } = await ambilPejabatBerisiko(ambang)

  return (
    <Panel padat>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3.5 py-3">
        <PanelHeader
          judul="Akan kosong — pejabat mendekati Batas Usia Pensiun"
          deskripsi={
            <>
              {formatAngka(daftar.length)} dari {formatAngka(totalDiperiksa)} pejabat aktif berada
              dalam {ambang} tahun menuju BUP · usia & BUP diturunkan dari NIP, bukan kolom
              tersendiri
              {nipTidakTerbaca > 0
                ? ` · ${formatAngka(nipTidakTerbaca)} dikecualikan karena NIP-nya tidak terbaca`
                : ''}
            </>
          }
        />
        <span className="flex shrink-0 items-center gap-1 text-[11px]">
          {[1, 3, 5, 10].map((n) => (
            <Link
              key={n}
              href={`/master/jabatan-kosong?ambang=${n}`}
              scroll={false}
              className={
                n === ambang
                  ? 'rounded border border-accent bg-accent-subtle px-1.5 py-0.5 font-medium text-text'
                  : 'rounded border border-border px-1.5 py-0.5 text-text-muted hover:border-border-strong hover:text-text'
              }
            >
              {n} thn
            </Link>
          ))}
        </span>
      </div>

      {daftar.length === 0 ? (
        <div className="p-4">
          <EmptyState
            judul={`Tidak ada pejabat dalam ${ambang} tahun menuju BUP`}
            deskripsi="Perlebar jangka waktu di atas untuk melihat yang lebih jauh. Angka ini dihitung dari tanggal lahir di NIP terhadap batas usia pensiun jenis jabatannya (58/60/65)."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-text-subtle uppercase">
                <th className="px-3 py-2">Pejabat</th>
                <th className="px-3 py-2">Jabatan &amp; unit</th>
                <th className="px-3 py-2 text-right">Usia</th>
                <th className="px-3 py-2 text-right">BUP</th>
                <th className="px-3 py-2 text-right">Sisa</th>
                <th className="px-3 py-2 text-right">Lama menjabat</th>
                <th className="px-3 py-2">Kesiapan suksesi</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((d) => {
                const mendesak = (d.tahunKePensiun ?? 99) <= 1
                return (
                  <tr key={d.pegawaiId} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      <Link
                        href={`/talenta/${d.nip}`}
                        className="block font-medium text-text hover:text-accent hover:underline"
                      >
                        {d.nama}
                      </Link>
                      <span className="tabular block text-[11px] text-text-subtle">
                        {formatNip(d.nip)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="block max-w-[20rem] truncate text-text-muted" title={d.namaJabatan}>
                        {d.namaJabatan}
                      </span>
                      <span className="block max-w-[20rem] truncate text-[11px] text-text-subtle" title={d.namaUnit}>
                        {d.eselon === 'NON_ESELON' ? 'Non-eselon' : `Eselon ${d.eselon}`} ·{' '}
                        {d.namaUnit}
                      </span>
                    </td>
                    <td className="tabular px-3 py-2 text-right text-text-muted">
                      {formatAngka(d.usia)}
                    </td>
                    <td className="tabular px-3 py-2 text-right text-text-subtle">
                      {d.batasUsiaPensiun}
                    </td>
                    <td
                      className={
                        mendesak
                          ? 'tabular px-3 py-2 text-right font-semibold text-warning'
                          : 'tabular px-3 py-2 text-right font-medium text-text'
                      }
                    >
                      {formatSkorRingkas(d.tahunKePensiun)} thn
                    </td>
                    <td className="tabular px-3 py-2 text-right text-text-muted">
                      {d.lamaMenjabatTahun === null
                        ? '—'
                        : `${formatSkorRingkas(d.lamaMenjabatTahun)} thn`}
                    </td>
                    <td className="px-3 py-2">
                      {!d.adaJabatanTarget ? (
                        <span className="flex items-center gap-1.5">
                          <TriangleAlert className="size-3.5 shrink-0 text-warning" />
                          <span className="text-[12px] text-text-muted">
                            Belum ada jabatan target
                          </span>
                        </span>
                      ) : d.jumlahKandidatSiap > 0 ? (
                        <Badge tone="sukses">
                          {formatAngka(d.jumlahKandidatSiap)} suksesor siap
                        </Badge>
                      ) : (
                        <Badge tone="peringatan">Tanpa suksesor siap</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3.5 py-3">
        <p className="max-w-3xl text-[11px] leading-relaxed text-text-subtle">
          Sisa masa jabatan dihitung dari tanggal lahir pada NIP terhadap batas usia pensiun jenis
          jabatannya. Angka ini <strong className="font-medium text-text-muted">turunan</strong>,
          tidak disimpan sebagai kolom — jadi otomatis ikut betul kalau NIP dibetulkan, dan otomatis
          hilang kalau NIP-nya tidak valid.
        </p>
        <Link
          href="/bandingkan"
          className="flex shrink-0 items-center gap-1 text-[11px] text-accent hover:underline"
        >
          Bandingkan calon suksesor
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </Panel>
  )
}

function bacaAmbang(nilai: string | undefined): number {
  const n = Number(nilai)
  return Number.isInteger(n) && n >= 1 && n <= 20 ? n : 3
}

function KosongSkeleton() {
  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3 w-full max-w-md" />
      </div>
      <TableSkeleton rows={6} cols={['2fr', '2fr', '0.6fr', '1.4fr', '0.8fr', '0.5fr']} />
    </Panel>
  )
}

function RisikoSkeleton() {
  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="mt-2 h-3 w-full max-w-xl" />
      </div>
      <TableSkeleton rows={4} cols={['1.6fr', '2fr', '0.5fr', '0.5fr', '0.6fr', '0.8fr', '1.2fr']} />
    </Panel>
  )
}
