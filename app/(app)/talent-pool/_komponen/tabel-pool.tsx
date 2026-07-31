'use client'

import { TriangleAlert } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { NoResultState } from '@/components/ui/states'
import { AksiWorkflowTombol, type OpsiAksi } from '@/components/suksesi/aksi-workflow'
import { cn } from '@/lib/cn'
import { formatNip, formatSkor, formatTanggal } from '@/lib/format'
import type { BarisPool } from '@/lib/kueri/suksesi'
import { LABEL_GILIRAN, LABEL_NOMINASI, LABEL_POOL, NADA_POOL } from '@/lib/workflow'

/**
 * Tabel anggota talent pool.
 *
 * Kolom **Giliran** ada di sini karena itu satu-satunya informasi yang tidak bisa
 * dibaca dari kolom mana pun: ia turunan dari pasangan status kandidat × nominasi
 * (`lib/workflow.ts`). Tanpa kolom itu, pengguna harus menghafal aturan alurnya
 * untuk tahu apakah sesuatu sedang menunggunya.
 */
export function TabelPool({
  baris,
  opsiUnit,
  unitPenggunaId,
}: {
  baris: Array<{ baris: BarisPool; opsiAksi: OpsiAksi[] }>
  opsiUnit: Array<{ id: number; nama: string }>
  unitPenggunaId: number | null
}) {
  if (baris.length === 0) {
    return <NoResultState className="m-3.5 border-0" />
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[62rem] border-collapse text-[13px]">
        <thead className="bg-surface-2">
          <tr className="border-b border-border text-left text-[11px] tracking-wide text-text-subtle uppercase">
            <th className="px-3.5 py-2 text-right font-medium">#</th>
            <th className="px-3 py-2 font-medium">Kandidat</th>
            <th className="px-3 py-2 text-right font-medium">
              Kotak 9
              <span className="mt-0.5 block text-[9px] font-normal normal-case">
                kinerja × potensial
              </span>
            </th>
            <th className="px-3 py-2 font-medium">
              Predikat kinerja
              <span className="mt-0.5 block text-[9px] font-normal normal-case">
                tidak masuk match score
              </span>
            </th>
            <th className="px-3 py-2 text-right font-medium">
              Match score
              <span className="mt-0.5 block text-[9px] font-normal normal-case">
                65/20/15 · 0–100
              </span>
            </th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Giliran</th>
            <th className="px-3.5 py-2 font-medium">Aksi</th>
          </tr>
        </thead>
        <tbody>
          {baris.map(({ baris: b, opsiAksi }) => (
            <tr key={b.talentPoolId} className="border-b border-border last:border-b-0 hover:bg-surface-2">
              <td className="tabular px-3.5 py-2.5 text-right font-medium text-text-subtle">
                {b.ranking ?? '—'}
              </td>

              <td className="px-3 py-2.5">
                <Link
                  href={`/talenta/${b.nip}`}
                  className="block font-medium text-text hover:text-accent"
                >
                  {b.nama}
                </Link>
                <span className="tabular block text-[11px] text-text-subtle">
                  {formatNip(b.nip)}
                </span>
                {b.namaJabatan !== null ? (
                  <span className="block text-[11px] text-text-subtle">{b.namaJabatan}</span>
                ) : null}
                {b.peringatanKonsistensi !== null ? (
                  <span className="mt-1 flex items-start gap-1 text-[10px] leading-relaxed text-danger">
                    <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                    {b.peringatanKonsistensi}
                  </span>
                ) : null}
              </td>

              <td className="tabular px-3 py-2.5 text-right">
                {b.kotak9 === null ? (
                  <span className="text-text-subtle">—</span>
                ) : (
                  <span className="font-medium text-text">{b.kotak9}</span>
                )}
              </td>

              <td className="px-3 py-2.5 text-text-muted">{b.predikatKinerja ?? '—'}</td>

              <td className="tabular px-3 py-2.5 text-right">
                {b.skorTotal === null ? (
                  <span className="text-text-subtle" title="Jabatan target ini belum dihitung">
                    —
                  </span>
                ) : (
                  <span className="font-semibold text-text">{formatSkor(b.skorTotal)}</span>
                )}
                {b.eligible === false ? (
                  <span className="mt-0.5 block text-[10px] text-warning">tidak lolos syarat</span>
                ) : null}
              </td>

              <td className="px-3 py-2.5">
                <Badge tone={NADA_POOL[b.status]}>{LABEL_POOL[b.status]}</Badge>
                {b.statusNominasi !== null ? (
                  <span className="mt-1 block text-[10px] leading-relaxed text-text-subtle">
                    {b.nominasiId !== null ? (
                      <Link href={`/nominasi/${b.nominasiId}`} className="hover:text-accent">
                        {LABEL_NOMINASI[b.statusNominasi]}
                      </Link>
                    ) : (
                      LABEL_NOMINASI[b.statusNominasi]
                    )}
                    {b.namaUnitPengaju !== null ? ` · ${b.namaUnitPengaju}` : ''}
                  </span>
                ) : null}
                {b.ditetapkanPada !== null ? (
                  <span className="mt-0.5 block text-[10px] text-text-subtle">
                    ditetapkan {formatTanggal(b.ditetapkanPada)}
                    {b.namaPenetap !== null ? ` oleh ${b.namaPenetap}` : ''}
                  </span>
                ) : null}
              </td>

              <td className="px-3 py-2.5">
                <span
                  className={cn(
                    'text-[11px]',
                    b.giliran === 'SELESAI' ? 'text-text-subtle' : 'font-medium text-text',
                  )}
                >
                  {LABEL_GILIRAN[b.giliran]}
                </span>
                {b.jumlahRencana > 0 ? (
                  <Link
                    href={`/rencana-pengembangan?pool=${b.talentPoolId}`}
                    className="mt-0.5 block text-[10px] text-accent hover:underline"
                  >
                    {b.jumlahRencana} rencana pengembangan
                  </Link>
                ) : null}
              </td>

              <td className="px-3.5 py-2.5">
                {opsiAksi.length === 0 ? (
                  <span className="text-[11px] text-text-subtle">—</span>
                ) : (
                  <AksiWorkflowTombol
                    talentPoolId={b.talentPoolId}
                    namaKandidat={b.nama}
                    opsi={opsiAksi}
                    opsiUnit={opsiUnit}
                    unitBawaanId={unitPenggunaId}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
