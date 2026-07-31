'use client'

import { ChevronDown, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { formatBobot, formatSkor } from '@/lib/format'
import type { RincianIndikator } from '@/lib/kueri/pegawai'

/**
 * Rincian match score sampai indikator & sub-indikator (usulan U-3 phase.md §8).
 *
 * Ini yang membuat pertanyaan "kenapa pegawai yang sama dapat skor berbeda antar
 * jabatan target?" bisa dijawab dari UI. Tanpa tabel ini, `match_score` hanya
 * memberi tiga angka agregat dan skornya jadi kotak hitam — bertentangan dengan
 * tujuan proyek yang menuntut penilaian transparan & akuntabel.
 *
 * Kolom `sumberNilai` dibedakan karena sebagian indikator (Lama/Keragaman/
 * Substansi Jabatan) datanya belum tentu lengkap di sistem sumber, sehingga
 * nilainya bisa berasal dari input manusia — dan itu harus terlihat.
 */
export function RincianSkor({ rincian }: { rincian: RincianIndikator[] }) {
  const [buka, setBuka] = useState(false)

  if (rincian.length === 0) {
    return (
      <p className="mt-3 border-t border-border pt-3 text-[11px] text-text-subtle">
        Rincian per indikator belum tersedia — skor ini dihitung sebelum tabel rincian ada.
        Jalankan perhitungan ulang untuk mengisinya.
      </p>
    )
  }

  const perluReview = rincian.filter((r) => r.perluReview)
  const manual = rincian.filter((r) => r.sumberNilai === 'MANUAL')

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setBuka(!buka)}
        aria-expanded={buka}
        className="flex w-full items-center gap-2 text-[11px] font-medium text-accent hover:underline"
      >
        <ChevronDown className={cn('size-3.5 transition-transform', buka && 'rotate-180')} />
        {buka ? 'Sembunyikan' : 'Lihat'} rincian perhitungan ({rincian.length} indikator)
        {perluReview.length > 0 ? (
          <Badge tone="peringatan" className="ml-1">
            {perluReview.length} perlu ditinjau
          </Badge>
        ) : null}
        {manual.length > 0 ? (
          <Badge tone="aksen" className="ml-1">
            {manual.length} nilai manual
          </Badge>
        ) : null}
      </button>

      {buka ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[38rem] text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] tracking-wide text-text-subtle uppercase">
                <th className="py-1.5 pr-3 font-medium">Indikator</th>
                <th className="px-3 py-1.5 text-right font-medium">Bobot</th>
                <th className="px-3 py-1.5 font-medium">Nilai mentah</th>
                <th className="px-3 py-1.5 font-medium">Kategori terpilih</th>
                <th className="py-1.5 pl-3 text-right font-medium">Skor</th>
              </tr>
            </thead>
            <tbody>
              {rincian.map((r, i) => {
                const sub = r.indukNama !== null
                return (
                  <tr key={`${r.namaIndikator}-${i}`} className="border-b border-border last:border-b-0">
                    <td className={cn('py-1.5 pr-3', sub && 'pl-4')}>
                      <span className="flex items-center gap-1.5">
                        {sub ? (
                          <span aria-hidden className="text-text-subtle">
                            └
                          </span>
                        ) : null}
                        <span className={sub ? 'text-text-muted' : 'font-medium text-text'}>
                          {r.namaIndikator}
                        </span>
                        {r.perluReview ? (
                          <span title="Nilai di luar ambang, kosong, atau dipotong — perlu ditinjau manusia">
                            <TriangleAlert className="size-3 shrink-0 text-warning" />
                          </span>
                        ) : null}
                        {r.sumberNilai === 'MANUAL' ? (
                          <Badge tone="aksen" title="Diisi manusia, bukan hasil hitung otomatis">
                            manual
                          </Badge>
                        ) : null}
                      </span>
                    </td>
                    <td className="tabular px-3 py-1.5 text-right text-text-subtle">
                      {r.bobot === null ? (
                        <span title="Sub-indikator digabung ke induknya lewat rata-rata">
                          rata-rata
                        </span>
                      ) : (
                        formatBobot(r.bobot)
                      )}
                    </td>
                    <td className="tabular px-3 py-1.5 text-text-muted">{r.nilaiMentah ?? '—'}</td>
                    <td className="px-3 py-1.5 text-text-subtle">
                      <span className="block max-w-[16rem] truncate" title={r.kategoriTerpilih ?? ''}>
                        {r.kategoriTerpilih ?? '—'}
                      </span>
                    </td>
                    <td className="tabular py-1.5 pl-3 text-right font-medium text-text">
                      {formatSkor(r.skor)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          <p className="mt-2 text-[11px] leading-relaxed text-text-subtle">
            Sub-indikator (baris berindentasi) digabung ke indikator induknya lewat rata-rata; nilai
            indikator lalu dikalikan bobotnya untuk membentuk skor komponen. Indikator bertanda{' '}
            <TriangleAlert className="inline size-3 text-warning" /> berarti nilainya di luar
            rentang rubrik, kosong, atau dipotong ke 0–100 — perlu ditinjau manusia.
          </p>
        </div>
      ) : null}
    </div>
  )
}
