import { Badge, StatusDot } from '@/components/ui/badge'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { formatAngka, formatPersenNilai } from '@/lib/format'
import {
  ambilKesehatanData,
  statusKesehatan,
  type BarisKesehatan,
  type StatusKesehatan,
} from '@/lib/kueri/dashboard'

/**
 * W4 · Kesehatan Data — tabel *Status Readiness Data* Blueprint §3 sebagai
 * **widget hidup**, bukan status statis yang ditulis sekali lalu basi.
 *
 * Kolom "Blueprint" menampilkan status yang tertulis di dokumen; kolom
 * persentase menampilkan kenyataan sekarang. Selisih di antara keduanya justru
 * informasi yang paling berguna — dokumen bisa menandai sesuatu ✅ padahal
 * datanya baru 77% lengkap.
 */

const LABEL_BLUEPRINT: Record<BarisKesehatan['statusBlueprint'], string> = {
  SIAP: '✅ Sudah ada',
  SEBAGIAN: '🟡 Perlu dibersihkan',
  BELUM: '❌ Belum ada',
}

const NADA: Record<StatusKesehatan, 'sukses' | 'peringatan' | 'bahaya'> = {
  SIAP: 'sukses',
  SEBAGIAN: 'peringatan',
  BELUM: 'bahaya',
}

export async function KesehatanData() {
  const { baris, rerata } = await ambilKesehatanData()
  const perluPerhatian = baris.filter((b) => statusKesehatan(b.persen) !== 'SIAP')

  return (
    <Panel padat className="flex flex-col">
      <div className="border-b border-border p-4">
        <PanelHeader
          judul="Kesehatan Data"
          deskripsi="Tabel Status Readiness Data pada Blueprint §3, dihitung langsung dari isi database — bukan status yang ditulis manual."
          aksi={
            <Badge tone={NADA[statusKesehatan(rerata)]}>
              <StatusDot tone={NADA[statusKesehatan(rerata)]} />
              Rerata {formatPersenNilai(rerata)}
            </Badge>
          }
        />
      </div>

      <ul className="divide-y divide-border">
        {baris.map((b) => {
          const nada = NADA[statusKesehatan(b.persen)]
          return (
            <li key={b.item} className="px-4 py-2.5">
              <div className="flex items-center gap-3">
                <StatusDot tone={nada} />
                <span className="min-w-0 flex-1 text-[13px] font-medium text-text break-words">
                  {b.item}
                </span>
                <span className="shrink-0 text-[10px] text-text-subtle">
                  {LABEL_BLUEPRINT[b.statusBlueprint]}
                </span>
                <span className="tabular w-24 shrink-0 text-right text-[11px] text-text-subtle">
                  {formatAngka(b.terpenuhi)}/{formatAngka(b.total)}
                </span>
                <span className="tabular w-14 shrink-0 text-right text-[13px] font-semibold text-text">
                  {formatPersenNilai(b.persen)}
                </span>
              </div>

              {/* Batang proporsi: memakai warna status, lebar = persentase */}
              <div className="mt-1.5 ml-5 h-1 overflow-hidden rounded-full bg-surface-3">
                <div
                  className={
                    nada === 'sukses'
                      ? 'h-full bg-success'
                      : nada === 'peringatan'
                        ? 'h-full bg-warning'
                        : 'h-full bg-danger'
                  }
                  style={{ width: `${Math.min(100, Math.max(2, b.persen))}%` }}
                />
              </div>

              {statusKesehatan(b.persen) !== 'SIAP' ? (
                <p className="mt-1.5 ml-5 text-[11px] leading-relaxed text-text-subtle">
                  {b.keterangan}
                </p>
              ) : null}
            </li>
          )
        })}
      </ul>

      <p className="border-t border-border px-4 py-3 text-[11px] leading-relaxed text-text-subtle">
        Ambang: hijau ≥90% · kuning 60–89% · merah &lt;60%.{' '}
        {perluPerhatian.length === 0
          ? 'Semua kategori data sudah di atas 90%.'
          : `${perluPerhatian.length} kategori belum mencapai 90% — target proyek adalah akurasi & kelengkapan data ≥90% (PRD §2).`}
      </p>
    </Panel>
  )
}

export function KesehatanDataSkeleton() {
  return (
    <Panel>
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-2 h-3 w-full max-w-lg" />
      <div className="mt-4">
        <ListSkeleton rows={8} />
      </div>
    </Panel>
  )
}
