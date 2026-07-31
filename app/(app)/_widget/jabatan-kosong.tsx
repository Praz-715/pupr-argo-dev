import { Badge } from '@/components/ui/badge'
import { LabelFase } from '@/components/layout/tautan-fase'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatAngka } from '@/lib/format'
import { ambilJabatanKosong } from '@/lib/kueri/dashboard'

/**
 * W5 · Jabatan strategis (eselon I–III) yang kosong.
 *
 * Yang paling penting di sini bukan daftar kosongnya, tapi **mana yang belum
 * punya jabatan target** — jabatan kosong tanpa profil jabatan target berarti
 * belum ada kandidat yang bisa dinilai sama sekali. Itu yang diurutkan ke atas.
 */
export async function JabatanKosong() {
  const { daftar, total, tanpaTarget } = await ambilJabatanKosong()

  if (total === 0) {
    return (
      <Panel id="jabatan-kosong">
        <PanelHeader judul="Jabatan strategis kosong" />
        <EmptyState
          className="mt-4"
          judul="Semua jabatan strategis terisi"
          deskripsi="Tidak ada jabatan eselon I–III berstatus kosong saat ini."
        />
      </Panel>
    )
  }

  return (
    <Panel id="jabatan-kosong" padat className="flex flex-col scroll-mt-20">
      <div className="border-b border-border p-4">
        <PanelHeader
          judul="Jabatan strategis kosong"
          deskripsi={`${formatAngka(total)} jabatan eselon I–III berstatus kosong. Yang belum punya profil jabatan target ditampilkan lebih dulu.`}
          aksi={
            tanpaTarget > 0 ? (
              <Badge tone="bahaya" title="Tanpa jabatan target, kandidat belum bisa dinilai sama sekali">
                {formatAngka(tanpaTarget)} tanpa jabatan target
              </Badge>
            ) : (
              <Badge tone="sukses">Semua punya jabatan target</Badge>
            )
          }
        />
      </div>

      <ul className="divide-y divide-border">
        {daftar.map((j) => (
          <li key={j.id} className="flex items-start gap-3 px-4 py-3">
            <span className="tabular mt-0.5 w-8 shrink-0 rounded bg-surface-3 py-0.5 text-center text-[10px] font-semibold text-text-muted">
              {j.eselon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-text">{j.namaJabatan}</span>
              <span className="block truncate text-[11px] text-text-subtle">
                {j.namaUnit ?? 'Unit belum tertaut'} · {j.jenjang}
              </span>
            </span>
            <span className="shrink-0 text-right">
              {!j.punyaJabatanTarget ? (
                <Badge tone="bahaya">Belum ada jabatan target</Badge>
              ) : j.suksesorDitetapkan > 0 ? (
                <Badge tone="sukses">
                  {formatAngka(j.suksesorDitetapkan)} suksesor ditetapkan
                </Badge>
              ) : j.kandidatSiap > 0 ? (
                <Badge tone="aksen">{formatAngka(j.kandidatSiap)} kandidat siap</Badge>
              ) : (
                <Badge tone="peringatan">Belum ada kandidat lolos syarat</Badge>
              )}
            </span>
          </li>
        ))}
      </ul>

      <p className="border-t border-border px-4 py-2.5 text-[11px] text-text-subtle">
        {total > daftar.length
          ? `Menampilkan ${formatAngka(daftar.length)} dari ${formatAngka(total)} jabatan. `
          : ''}
        Daftar lengkap beserta proyeksi risiko kekosongan ada di halaman Jabatan Kosong &amp; Risiko
        <LabelFase fase={4} />
      </p>
    </Panel>
  )
}

export function JabatanKosongSkeleton() {
  return (
    <Panel>
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-2 h-3 w-full max-w-md" />
      <div className="mt-4">
        <ListSkeleton rows={5} />
      </div>
    </Panel>
  )
}
