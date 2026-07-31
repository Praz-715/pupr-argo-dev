import { RefreshCw, ScrollText } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { LabelFase } from '@/components/layout/tautan-fase'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatTanggalWaktu } from '@/lib/format'
import { ambilAktivitasTerakhir } from '@/lib/kueri/dashboard'

/**
 * W8 · Aktivitas terakhir — gabungan jejak audit (`audit_log`) dan riwayat
 * sinkronisasi data (`sync_log`).
 *
 * Digabung karena dari sudut pandang pengguna keduanya menjawab pertanyaan yang
 * sama: "apa yang terakhir terjadi pada data ini?" Sinkronisasi yang GAGAL
 * ditandai jelas — itu penyebab paling umum angka dashboard terlihat aneh.
 */

const NADA_SYNC: Record<string, 'sukses' | 'peringatan' | 'bahaya'> = {
  SUKSES: 'sukses',
  SEBAGIAN: 'peringatan',
  GAGAL: 'bahaya',
}

export async function AktivitasTerakhir() {
  const daftar = await ambilAktivitasTerakhir()

  if (daftar.length === 0) {
    return (
      <Panel>
        <PanelHeader judul="Aktivitas terakhir" />
        <EmptyState
          className="mt-4"
          judul="Belum ada aktivitas tercatat"
          deskripsi="Perubahan data dan proses sinkronisasi akan muncul di sini."
        />
      </Panel>
    )
  }

  const adaGagal = daftar.some((a) => a.status === 'GAGAL')

  return (
    <Panel padat>
      <div className="border-b border-border p-4">
        <PanelHeader
          judul="Aktivitas terakhir"
          deskripsi="Gabungan jejak audit perubahan data dan riwayat sinkronisasi dari sistem sumber."
          aksi={
            adaGagal ? (
              <Badge tone="bahaya">Ada sinkronisasi gagal</Badge>
            ) : (
              <Badge tone="netral">{daftar.length} kejadian terakhir</Badge>
            )
          }
        />
      </div>

      <ul className="divide-y divide-border">
        {daftar.map((a, i) => (
          <li key={`${a.jenis}-${a.waktu}-${i}`} className="flex items-start gap-3 px-4 py-2.5">
            <span
              aria-hidden
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-text-subtle"
            >
              {a.jenis === 'SYNC' ? (
                <RefreshCw className="size-3" />
              ) : (
                <ScrollText className="size-3" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[13px] font-medium text-text">{a.judul}</span>
                {a.status ? (
                  <Badge tone={NADA_SYNC[a.status] ?? 'netral'}>{a.status}</Badge>
                ) : null}
              </span>
              <span className="mt-0.5 block truncate text-[11px] text-text-subtle">
                {a.keterangan ?? '—'}
                {a.aktor ? ` · ${a.aktor}` : ''}
              </span>
            </span>
            <span className="tabular shrink-0 text-[11px] whitespace-nowrap text-text-subtle">
              {formatTanggalWaktu(a.waktu)}
            </span>
          </li>
        ))}
      </ul>

      <p className="border-t border-border px-4 py-2.5 text-[11px] text-text-subtle">
        Jejak audit lengkap tersedia di Audit Log Viewer
        <LabelFase fase={7} /> · detail sinkronisasi di Konsolidasi Data
        <LabelFase fase={4} />
      </p>
    </Panel>
  )
}

export function AktivitasTerakhirSkeleton() {
  return (
    <Panel>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-full max-w-lg" />
      <div className="mt-4">
        <ListSkeleton rows={6} />
      </div>
    </Panel>
  )
}
