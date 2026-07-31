import { CircleCheck, TriangleAlert, Wrench } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { formatAngka, formatNip } from '@/lib/format'
import { DEFINISI_TEMUAN, type KodeTemuan } from '@/lib/importer'
import { ambilRingkasTemuan, ambilTemuanRinci } from '@/lib/kueri/kualitas'

export const metadata = { title: 'Antrian Pembersihan Data' }

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Antrian Pembersihan Data (PRD §6.7).
 *
 * **Isinya dihitung dari keadaan DB sekarang, bukan dari catatan importer.**
 * Temuan yang disimpan akan basi begitu seseorang membetulkan barisnya lewat
 * jalur lain — dan antrian yang menampilkan pekerjaan yang sudah selesai adalah
 * antrian yang berhenti dipercaya. Aturannya tetap satu sumber: `lib/importer`
 * mendefinisikan kode & dampaknya, kueri mendeteksi jejaknya di data.
 *
 * Konsekuensi yang harus jujur disampaikan ke pengguna: temuan yang **sudah
 * dikoreksi otomatis** importer (format golongan, istilah asesmen, skala
 * integritas) bernilai 0 di sini — bukan karena tidak pernah terjadi, tapi karena
 * jejaknya memang sudah tidak ada lagi di data. Itu ditulis di halaman.
 */
export default async function PembersihanPage({ searchParams }: { searchParams: ParamHalaman }) {
  const params = await searchParams
  const kode = bacaKode(params.temuan)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Antrian Pembersihan Data"
        deskripsi="Anomali dan data yang belum terpetakan, dikelompokkan menurut aturan importer. Pilih satu kelompok untuk melihat barisnya."
      />

      <Suspense fallback={<RingkasSkeleton />}>
        <IsiRingkas kodeAktif={kode} />
      </Suspense>

      {kode !== null ? (
        <Suspense key={kode} fallback={<RinciSkeleton />}>
          <IsiRinci kode={kode} />
        </Suspense>
      ) : null}
    </div>
  )
}

async function IsiRingkas({ kodeAktif }: { kodeAktif: KodeTemuan | null }) {
  const kelompok = await ambilRingkasTemuan()
  const adaKerja = kelompok.filter((k) => k.jumlah > 0)
  const bersih = kelompok.filter((k) => k.jumlah === 0)
  const totalKerja = adaKerja.reduce((n, k) => n + k.jumlah, 0)
  const perluManusia = adaKerja
    .filter((k) => k.tingkat === 'PERLU_MANUSIA')
    .reduce((n, k) => n + k.jumlah, 0)

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          judul={
            totalKerja === 0
              ? 'Tidak ada pekerjaan tertunda'
              : `${formatAngka(totalKerja)} baris perlu ditinjau`
          }
          deskripsi={
            totalKerja === 0
              ? 'Semua aturan importer terpenuhi pada data yang ada sekarang.'
              : `${formatAngka(perluManusia)} di antaranya menuntut keputusan manusia — sistem sengaja tidak menebaknya.`
          }
        />
      </Panel>

      {adaKerja.length === 0 ? (
        <EmptyState
          judul="Antrian bersih"
          deskripsi="Tidak ada anomali yang terdeteksi dari keadaan data sekarang. Antrian akan terisi sendiri begitu ada sinkronisasi yang membawa bentuk data yang tidak sesuai aturan."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {adaKerja.map((k) => {
            const aktif = k.kode === kodeAktif
            return (
              <Link
                key={k.kode}
                href={aktif ? '/data/pembersihan' : `/data/pembersihan?temuan=${k.kode}`}
                scroll={false}
                className={
                  aktif
                    ? 'rounded-lg border border-accent bg-accent-subtle p-3.5 transition-colors'
                    : 'rounded-lg border border-border p-3.5 transition-colors hover:border-border-strong'
                }
              >
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-text">{k.label}</span>
                    <span className="block text-[10px] text-text-subtle">
                      aturan §6 no. {k.aturan}
                    </span>
                  </span>
                  <span className="tabular shrink-0 text-xl leading-none font-semibold text-text">
                    {formatAngka(k.jumlah)}
                  </span>
                </span>
                <span className="mt-2 block">
                  <Badge tone={k.tingkat === 'PERLU_MANUSIA' ? 'peringatan' : 'aksen'}>
                    {k.tingkat === 'PERLU_MANUSIA' ? 'Perlu keputusan manusia' : 'Sudah dikoreksi'}
                  </Badge>
                </span>
                <span className="mt-2 block text-[11px] leading-relaxed text-text-subtle">
                  {k.dampak}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {bersih.length > 0 ? (
        <Panel>
          <PanelHeader
            judul={`${formatAngka(bersih.length)} jenis temuan lain: nol`}
            deskripsi="Tidak berarti belum pernah terjadi — sebagian memang sudah dikoreksi otomatis oleh importer, sehingga jejaknya tidak ada lagi di data."
          />
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
            {bersih.map((k) => (
              <li key={k.kode} className="flex items-center gap-1.5 text-[11px] text-text-subtle">
                <CircleCheck className="size-3 shrink-0 text-success" />
                {k.label}
                <span className="text-text-subtle">(§6 no. {k.aturan})</span>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}

async function IsiRinci({ kode }: { kode: KodeTemuan }) {
  const baris = await ambilTemuanRinci(kode)
  const def = DEFINISI_TEMUAN[kode]

  return (
    <Panel padat id="rinci-temuan">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3.5 py-3">
        <PanelHeader
          judul={
            <span className="flex flex-wrap items-center gap-2">
              {def.label}
              <Badge tone={def.tingkat === 'PERLU_MANUSIA' ? 'peringatan' : 'aksen'}>
                aturan §6 no. {def.aturan}
              </Badge>
            </span>
          }
          deskripsi={`${formatAngka(baris.length)} baris ditampilkan${baris.length >= 50 ? ' (dibatasi 50 — perbaiki sebagian, lalu muat ulang)' : ''}.`}
        />
        <Link
          href="/data/pembersihan"
          scroll={false}
          className="text-[11px] whitespace-nowrap text-accent hover:underline"
        >
          Tutup daftar
        </Link>
      </div>

      {baris.length === 0 ? (
        <div className="p-4">
          <EmptyState
            judul="Tidak ada baris untuk temuan ini"
            deskripsi="Kemungkinan sudah dibetulkan sejak halaman terakhir dimuat."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-text-subtle uppercase">
                <th className="px-3 py-2">Subjek</th>
                <th className="px-3 py-2">Entitas</th>
                <th className="px-3 py-2">Yang perlu dibereskan</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => (
                <tr key={`${b.entitas}-${b.entitasId}`} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="block font-medium text-text">{b.subjek}</span>
                    {b.nip ? (
                      <span className="tabular block text-[11px] text-text-subtle">
                        {formatNip(b.nip)}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <span className="font-mono text-[11px] text-text-subtle">
                      {b.entitas}#{b.entitasId}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-muted">{b.keterangan}</td>
                  <td className="px-3 py-2 text-right">
                    {b.nip ? (
                      <Link
                        href={`/talenta/${b.nip}`}
                        className="text-[11px] whitespace-nowrap text-accent hover:underline"
                      >
                        Buka profil
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex items-start gap-2.5 border-t border-border px-3.5 py-3">
        {def.tingkat === 'PERLU_MANUSIA' ? (
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-warning" />
        ) : (
          <Wrench className="mt-0.5 size-3.5 shrink-0 text-text-subtle" />
        )}
        <p className="max-w-3xl text-[11px] leading-relaxed text-text-subtle">
          {def.dampak}
        </p>
      </div>

      <p className="border-t border-border px-3.5 py-3 text-[11px] leading-relaxed text-text-subtle">
        <strong className="font-medium text-text-muted">Pemetaan manual & tanda
        &quot;diverifikasi&quot; belum tersedia di halaman ini.</strong> Keduanya butuh tempat
        menyimpan keputusan manusia (siapa memverifikasi, kapan, dengan catatan apa) yang belum ada
        di skema, sedangkan pemetaan riwayat jabatan ke master jabatan lebih tepat dikerjakan dari
        editor riwayat pegawai. Untuk sekarang halaman ini berfungsi sebagai daftar kerja yang
        akurat; perbaikannya dilakukan di sumber datanya.
      </p>
    </Panel>
  )
}

function bacaKode(nilai: string | undefined): KodeTemuan | null {
  if (!nilai) return null
  return nilai in DEFINISI_TEMUAN ? (nilai as KodeTemuan) : null
}

function RingkasSkeleton() {
  return (
    <div className="space-y-4">
      <Panel>
        <Skeleton className="h-4 w-52" />
        <Skeleton className="mt-2 h-3 w-full max-w-lg" />
      </Panel>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Panel key={i}>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="mt-2 h-5 w-16" />
            <Skeleton className="mt-2 h-3 w-full" />
          </Panel>
        ))}
      </div>
    </div>
  )
}

function RinciSkeleton() {
  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="mt-2 h-3 w-40" />
      </div>
      <TableSkeleton rows={8} cols={['2fr', '1fr', '2.4fr', '0.7fr']} />
    </Panel>
  )
}
