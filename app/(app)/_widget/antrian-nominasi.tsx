import { LabelFase } from '@/components/layout/tautan-fase'
import { Badge } from '@/components/ui/badge'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatAngka, formatEnum, formatSkor, formatTanggal } from '@/lib/format'
import { ambilAntrianNominasi } from '@/lib/kueri/dashboard'

/**
 * W6 · Antrian nominasi & approval.
 *
 * Menampilkan **lama menunggu** dalam hari, bukan hanya tanggal pengajuan:
 * salah satu target proyek adalah memangkas waktu proses layanan kepegawaian
 * ≥30% (PRD §2), dan itu tidak bisa dipantau kalau yang tampil hanya tanggal.
 */

const NADA_STATUS: Record<string, 'aksen' | 'peringatan' | 'sukses' | 'bahaya' | 'netral'> = {
  DIAJUKAN: 'aksen',
  MENUNGGU_VERIFIKASI: 'peringatan',
  DISETUJUI: 'sukses',
  DITOLAK: 'bahaya',
}

export async function AntrianNominasi() {
  const { daftar, perStatus } = await ambilAntrianNominasi()

  if (daftar.length === 0) {
    return (
      <Panel id="antrian-nominasi">
        <PanelHeader judul="Antrian nominasi & approval" />
        <EmptyState
          className="mt-4"
          judul="Belum ada nominasi diajukan"
          deskripsi="Nominasi muncul di sini setelah unit mengajukan kandidat dari talent pool."
        />
      </Panel>
    )
  }

  const menunggu =
    (perStatus.get('MENUNGGU_VERIFIKASI') ?? 0) + (perStatus.get('DIAJUKAN') ?? 0)

  return (
    <Panel id="antrian-nominasi" padat className="flex flex-col">
      <div className="border-b border-border p-4">
        <PanelHeader
          judul="Antrian nominasi & approval"
          deskripsi={
            <>
              {[...perStatus.entries()]
                .map(([s, n]) => `${formatEnum(s)}: ${formatAngka(n)}`)
                .join(' · ')}
            </>
          }
          aksi={
            menunggu > 0 ? (
              <Badge tone="peringatan">{formatAngka(menunggu)} perlu tindakan</Badge>
            ) : (
              <Badge tone="sukses">Antrian bersih</Badge>
            )
          }
        />
      </div>

      <ul className="divide-y divide-border">
        {daftar.map((n) => {
          const perluTindakan = n.status === 'MENUNGGU_VERIFIKASI' || n.status === 'DIAJUKAN'
          return (
            <li key={n.id} className="px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-text">{n.nama}</span>
                  <span className="block truncate text-[11px] text-text-subtle">
                    {n.namaTarget}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <Badge tone={NADA_STATUS[n.status] ?? 'netral'}>{formatEnum(n.status)}</Badge>
                  {n.skorTotal !== null ? (
                    <span className="tabular mt-1 block text-[11px] text-text-subtle">
                      skor {formatSkor(n.skorTotal)}
                    </span>
                  ) : null}
                </span>
              </div>

              <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
                Diajukan {formatTanggal(n.tanggalDiajukan)}
                {n.namaUnitPengaju ? ` oleh ${n.namaUnitPengaju}` : ''}
                {perluTindakan && n.hariMenunggu > 0 ? (
                  <>
                    {' · '}
                    <span
                      className={
                        n.hariMenunggu > 30 ? 'font-medium text-warning' : 'text-text-subtle'
                      }
                    >
                      menunggu {formatAngka(n.hariMenunggu)} hari
                    </span>
                  </>
                ) : null}
                {n.tahapTerakhir
                  ? ` · tahap terakhir: ${n.tahapTerakhir} (${formatEnum(n.statusTahapTerakhir)})`
                  : ' · belum ada catatan approval'}
              </p>
            </li>
          )
        })}
      </ul>

      <p className="border-t border-border px-4 py-2.5 text-[11px] text-text-subtle">
        Verifikasi & keputusan dilakukan di halaman Nominasi
        <LabelFase fase={6} />
      </p>
    </Panel>
  )
}

export function AntrianNominasiSkeleton() {
  return (
    <Panel>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-2 h-3 w-full max-w-md" />
      <div className="mt-4">
        <ListSkeleton rows={5} />
      </div>
    </Panel>
  )
}
