import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { Badge } from '@/components/ui/badge'
import { gayaTombol } from '@/components/ui/button-style'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { wajibMasuk } from '@/lib/auth'
import { formatAngka, formatTanggalWaktu } from '@/lib/format'
import {
  ambilAktivitasApi,
  ambilRingkasAktivitasApi,
  UKURAN_HALAMAN_AKTIVITAS,
  type FilterAktivitasApi,
} from '@/lib/kueri/api'
import { angkaPositif, dariDaftar, nomorHalaman, tanggalIso } from '@/lib/param'
import { punyaPeran } from '@/lib/peran'
import { FilterAktivitas } from './_komponen/filter-aktivitas'

export const metadata = { title: 'Log Aktivitas API' }

const PERAN_HALAMAN = ['Super Admin'] as const
const GOLONGAN = ['sukses', 'ditolak', 'galat'] as const

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Log Aktivitas API (PRD §6.9).
 *
 * **`ditolak` (4xx) dipisah tegas dari `galat` (5xx)**, dan itu bukan kerapian
 * belaka: 4xx berarti **klien** yang salah — token mati, scope tidak mencakup,
 * rate limit — yaitu sistem bekerja sebagaimana mestinya. 5xx berarti **kita**
 * yang salah. Menggabungkannya jadi satu angka "error" membuat lonjakan penolakan
 * yang wajar terlihat seperti kerusakan, dan kerusakan yang sesungguhnya tersamar
 * di antaranya.
 *
 * **Batas yang jujur:** permintaan dengan token yang **tidak dikenali sama sekali**
 * tidak muncul di sini. `api_activity_log.api_client_id` adalah `NOT NULL`, jadi
 * tidak ada klien untuk diatribusikan. Akibatnya "seseorang memindai token acak"
 * tidak terlihat di halaman ini — hanya sampai log server. Itu ditulis di halaman,
 * bukan cuma di dokumen, supaya nol di sini tidak dibaca sebagai "tidak ada yang
 * mencoba".
 */
export default async function LogAktivitasApiPage({
  searchParams,
}: {
  searchParams: ParamHalaman
}) {
  const sesi = await wajibMasuk('/admin/api/log')

  if (!punyaPeran(sesi.pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Log Aktivitas API"
        deskripsiHalaman="Riwayat pemanggilan /api/v1 per klien & token."
        peranAnda={sesi.pengguna.peran}
        alasan={
          <>
            Log ini memperlihatkan pola pemakaian data ASN oleh instansi eksternal, jadi hanya{' '}
            <strong className="font-medium text-text">Super Admin</strong> yang bisa membukanya.
          </>
        }
      />
    )
  }

  const p = await searchParams
  const dari = tanggalIso(p.dari)
  const sampai = tanggalIso(p.sampai)
  const filter: FilterAktivitasApi = {
    apiClientId: angkaPositif(p.klien),
    golongan: dariDaftar(p.golongan, GOLONGAN),
    endpoint: p.endpoint?.slice(0, 120),
    dari,
    sampai,
    halaman: nomorHalaman(p.hal),
  }
  const kunci = JSON.stringify(filter)

  return (
    <div className="space-y-5">
      <Link
        href="/admin/api"
        className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        Klien &amp; Token API
      </Link>

      <PageHeader
        judul="Log Aktivitas API"
        deskripsi="Setiap pemanggilan /api/v1 tercatat — yang berhasil maupun yang ditolak. Waktu respons ikut dicatat supaya perlambatan terlihat sebelum klien melaporkannya."
      />

      <Suspense fallback={<Skeleton className="h-20 w-full" />}>
        <IsiRingkas />
      </Suspense>

      <Panel>
        <PanelHeader judul="Penyaring" />
        <div className="mt-3.5">
          <FilterAktivitas
            nilai={{
              golongan: filter.golongan ?? '',
              endpoint: p.endpoint ?? '',
              dari: dari ?? '',
              sampai: sampai ?? '',
            }}
          />
        </div>
      </Panel>

      <Suspense key={kunci} fallback={<TabelSkeleton />}>
        <IsiTabel filter={filter} />
      </Suspense>
    </div>
  )
}

async function IsiRingkas() {
  const r = await ambilRingkasAktivitasApi()

  const kartu = [
    {
      label: 'Permintaan 24 jam',
      nilai: formatAngka(r.total24Jam),
      penyebut: `${formatAngka(r.klienAktif24Jam)} klien memanggil`,
    },
    {
      label: 'Ditolak (4xx)',
      nilai: formatAngka(r.ditolak24Jam),
      penyebut: 'token mati, scope tidak mencakup, atau rate limit — sistem bekerja benar',
    },
    {
      label: 'Galat (5xx)',
      nilai: formatAngka(r.galat24Jam),
      penyebut: r.galat24Jam === 0 ? 'tidak ada — bersih' : 'ini kita yang salah, bukan klien',
    },
    {
      label: 'Rata waktu respons',
      nilai: r.rataMs24Jam === null ? '—' : `${formatAngka(r.rataMs24Jam)} ms`,
      penyebut: 'rata-rata seluruh endpoint dalam 24 jam',
    },
  ]

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kartu.map((k) => (
          <Panel key={k.label}>
            <p className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
              {k.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-text">{k.nilai}</p>
            <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{k.penyebut}</p>
          </Panel>
        ))}
      </div>

      {r.endpointTerbanyak.length > 0 ? (
        <p className="text-[12px] text-text-muted">
          Endpoint tersibuk 24 jam:{' '}
          {r.endpointTerbanyak.map((e, i) => (
            <span key={e.endpoint}>
              {i > 0 ? ' · ' : ''}
              <code className="text-[11px]">{e.endpoint}</code> ({formatAngka(e.jumlah)})
            </span>
          ))}
        </p>
      ) : null}

      <p className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-text-muted">
        <strong className="font-medium text-text">Yang tidak terlihat di sini:</strong> permintaan
        dengan token yang sama sekali tidak dikenali. Kolom <code>api_client_id</code> wajib terisi,
        jadi percobaan seperti itu tidak punya klien untuk diatribusikan dan hanya sampai ke log
        server. Nol di halaman ini bukan berarti tidak ada yang mencoba.
      </p>
    </div>
  )
}

async function IsiTabel({ filter }: { filter: FilterAktivitasApi }) {
  const hasil = await ambilAktivitasApi(filter)

  if (hasil.baris.length === 0) {
    return (
      <Panel>
        <EmptyState
          judul="Tidak ada aktivitas yang cocok"
          deskripsi="Longgarkan penyaring, atau periksa apakah klien memang sudah pernah memanggil API."
        />
      </Panel>
    )
  }

  const totalHalaman = Math.ceil(hasil.total / UKURAN_HALAMAN_AKTIVITAS)

  return (
    <Panel>
      <PanelHeader
        judul="Riwayat pemanggilan"
        deskripsi={`${formatAngka(hasil.total)} baris cocok · halaman ${hasil.halaman} dari ${formatAngka(totalHalaman)}`}
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[52rem] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-subtle">
              <th className="px-2 py-2 font-medium">Waktu</th>
              <th className="px-2 py-2 font-medium">Klien</th>
              <th className="px-2 py-2 font-medium">Token</th>
              <th className="px-2 py-2 font-medium">Endpoint</th>
              <th className="px-2 py-2 font-medium">Kode</th>
              <th className="px-2 py-2 text-right font-medium">Waktu respons</th>
              <th className="px-2 py-2 font-medium">IP</th>
            </tr>
          </thead>
          <tbody>
            {hasil.baris.map((b) => (
              <tr key={b.id} className="border-b border-border-subtle last:border-0">
                <td className="px-2 py-2 tabular-nums text-text-muted">
                  {formatTanggalWaktu(b.createdAt)}
                </td>
                <td className="px-2 py-2">
                  <code className="text-[12px] text-text">{b.kodeInstansi}</code>
                </td>
                <td className="px-2 py-2 text-text-muted">{b.labelToken ?? '—'}</td>
                <td className="px-2 py-2">
                  <code className="text-[12px] text-text-muted">
                    {b.method} {b.endpoint}
                  </code>
                </td>
                <td className="px-2 py-2">
                  <Badge
                    tone={
                      b.responseCode >= 500
                        ? 'bahaya'
                        : b.responseCode >= 400
                          ? 'peringatan'
                          : 'sukses'
                    }
                  >
                    {b.responseCode}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                  {b.responseTimeMs === null ? '—' : `${formatAngka(b.responseTimeMs)} ms`}
                </td>
                <td className="px-2 py-2 tabular-nums text-text-subtle">{b.ipAddress ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalHalaman > 1 ? (
        <Paginasi halaman={hasil.halaman} totalHalaman={totalHalaman} />
      ) : null}
    </Panel>
  )
}

/** Paginasi sederhana lewat tautan — tersinkron URL, tanpa JavaScript. */
function Paginasi({ halaman, totalHalaman }: { halaman: number; totalHalaman: number }) {
  const tautan = (h: number) => `?hal=${h}`
  return (
    <div className="mt-3 flex items-center justify-between text-[12px]">
      {halaman > 1 ? (
        <Link href={tautan(halaman - 1)} className={gayaTombol({ variant: 'halus', size: 'sm' })}>
          Sebelumnya
        </Link>
      ) : (
        <span />
      )}
      <span className="tabular-nums text-text-muted">
        {halaman} / {totalHalaman}
      </span>
      {halaman < totalHalaman ? (
        <Link href={tautan(halaman + 1)} className={gayaTombol({ variant: 'halus', size: 'sm' })}>
          Berikutnya
        </Link>
      ) : (
        <span />
      )}
    </div>
  )
}

function TabelSkeleton() {
  return (
    <Panel>
      <Skeleton className="h-4 w-44" />
      <div className="mt-3">
        <TableSkeleton rows={12} cols={['1.4fr', '1fr', '1.2fr', '2fr', '0.6fr', '0.8fr', '1fr']} />
      </div>
    </Panel>
  )
}
