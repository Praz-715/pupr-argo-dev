import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { formatNip, formatSkor } from '@/lib/format'
import type { BarisDiff, JenisPerubahan } from '@/lib/skor-massal'

/**
 * Tabel perubahan hasil simulasi. Server Component — murni tampilan.
 *
 * Peringkat ditulis "3 → 1", bukan hanya angka barunya: yang jadi keputusan
 * pimpinan adalah **pergeserannya**, dan nomor peringkat baru tanpa pembanding
 * tidak memberi tahu apakah seseorang naik atau turun.
 */

const LABEL: Record<JenisPerubahan, { teks: string; tone: 'sukses' | 'peringatan' | 'bahaya' | 'aksen' | 'netral' }> = {
  KELUAR: { teks: 'keluar dari kelayakan', tone: 'bahaya' },
  MASUK: { teks: 'masuk kelayakan', tone: 'sukses' },
  BARU: { teks: 'belum pernah dinilai', tone: 'aksen' },
  NAIK: { teks: 'naik peringkat', tone: 'sukses' },
  TURUN: { teks: 'turun peringkat', tone: 'peringatan' },
  SKOR: { teks: 'skor berubah', tone: 'netral' },
  TETAP: { teks: 'tetap', tone: 'netral' },
}

export function TabelDiff({
  baris,
  jabatanTargetId,
}: {
  baris: BarisDiff[]
  jabatanTargetId: number
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-[13px]">
        <thead className="bg-surface-2">
          <tr className="border-b border-border text-left text-[11px] tracking-wide text-text-subtle uppercase">
            <th className="px-3.5 py-2 font-medium">Pegawai</th>
            <th className="px-3 py-2 font-medium">Perubahan</th>
            <th className="px-3 py-2 text-right font-medium">
              Match score
              <span className="mt-0.5 block text-[9px] font-normal normal-case">
                tersimpan → hitungan baru
              </span>
            </th>
            <th className="px-3 py-2 text-right font-medium">Selisih</th>
            <th className="px-3 py-2 text-right font-medium">
              Peringkat
              <span className="mt-0.5 block text-[9px] font-normal normal-case">
                di antara yang lolos syarat
              </span>
            </th>
            <th className="px-3.5 py-2 font-medium">Kelayakan</th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <tr key={b.pegawaiId} className="border-b border-border last:border-b-0 hover:bg-surface-2">
              <td className="px-3.5 py-2.5">
                <Link
                  href={`/jabatan-target/${jabatanTargetId}/kandidat?cari=${b.nip}&rincian=${b.nip}#rincian`}
                  className="block font-medium text-text hover:text-accent"
                >
                  {b.nama}
                </Link>
                <span className="tabular block text-[11px] text-text-subtle">{formatNip(b.nip)}</span>
              </td>

              <td className="px-3 py-2.5">
                <Badge tone={LABEL[b.jenis].tone}>{LABEL[b.jenis].teks}</Badge>
              </td>

              <td className="tabular px-3 py-2.5 text-right">
                <span className="text-text-subtle">
                  {b.totalSebelum === null ? '—' : formatSkor(b.totalSebelum)}
                </span>
                <span className="mx-1 text-text-subtle">→</span>
                <span className="font-medium text-text">{formatSkor(b.totalSesudah)}</span>
              </td>

              <td className="tabular px-3 py-2.5 text-right">
                {b.selisihTotal === null ? (
                  <span className="text-text-subtle">—</span>
                ) : (
                  <span
                    className={cn(
                      'inline-flex items-center gap-0.5 font-medium',
                      b.selisihTotal > 0
                        ? 'text-success'
                        : b.selisihTotal < 0
                          ? 'text-danger'
                          : 'text-text-subtle',
                    )}
                  >
                    {b.selisihTotal > 0 ? (
                      <ArrowUp className="size-3" />
                    ) : b.selisihTotal < 0 ? (
                      <ArrowDown className="size-3" />
                    ) : (
                      <Minus className="size-3" />
                    )}
                    {formatSkor(Math.abs(b.selisihTotal))}
                  </span>
                )}
              </td>

              <td className="tabular px-3 py-2.5 text-right">
                {b.rankingSebelum === null && b.rankingSesudah === null ? (
                  <span className="text-text-subtle">—</span>
                ) : (
                  <span>
                    <span className="text-text-subtle">{b.rankingSebelum ?? '—'}</span>
                    <span className="mx-1 text-text-subtle">→</span>
                    <span className="font-medium text-text">{b.rankingSesudah ?? '—'}</span>
                    {b.geserRanking !== null && b.geserRanking !== 0 ? (
                      <span
                        className={cn(
                          'ml-1.5 text-[11px]',
                          b.geserRanking < 0 ? 'text-success' : 'text-warning',
                        )}
                      >
                        {b.geserRanking < 0 ? '↑' : '↓'}
                        {Math.abs(b.geserRanking)}
                      </span>
                    ) : null}
                  </span>
                )}
              </td>

              <td className="px-3.5 py-2.5 text-[11px]">
                <span className="text-text-subtle">
                  {b.eligibleSebelum === null ? '—' : b.eligibleSebelum ? 'lolos' : 'tidak'}
                </span>
                <span className="mx-1 text-text-subtle">→</span>
                <span className={b.eligibleSesudah ? 'text-success' : 'text-text-muted'}>
                  {b.eligibleSesudah ? 'lolos' : 'tidak'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
