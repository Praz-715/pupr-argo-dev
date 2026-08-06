'use client'

import { ChartColumnBig, Table2 } from 'lucide-react'
import { useState } from 'react'

import { PetaTalenta, type TitikBubble } from '@/components/charts/peta-talenta'
import { cn } from '@/lib/cn'
import { formatAngka, formatSkorRingkas } from '@/lib/format'
import { klasifikasiSumbuX, klasifikasiSumbuY } from '@/lib/scoring'

/**
 * Bubble Kinerja × Potensial + **padanan tabelnya**.
 *
 * Tabel bukan pelengkap opsional: phase.md §5.5 mewajibkannya untuk setiap chart
 * (aksesibilitas, dan staf kepegawaian sering perlu menyalin angkanya). Yang
 * ditampilkan tabel adalah data yang sama persis dengan yang digambar — bukan
 * kueri kedua — sehingga keduanya tidak mungkin berselisih.
 */
/**
 * `labelX` ada karena sumbu Potensial punya dua definisi (phase.md §2.10): Potkom
 * apa adanya, atau match score jabatan target terpilih. Kolom yang tetap berbunyi
 * "Potensial" pada kedua tampilan membuat dua angka berbeda tampil dengan nama
 * yang sama — dan padanan tabel ini justru yang dipakai orang untuk menyalin
 * angka ke tempat lain.
 */
export function TampilanPeta({
  titik,
  labelX = 'Potensial',
}: {
  titik: TitikBubble[]
  labelX?: string
}) {
  const [tabel, setTabel] = useState(false)

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <div
          role="group"
          aria-label="Tampilan peta"
          className="inline-flex overflow-hidden rounded-md border border-border"
        >
          <Tombol aktif={!tabel} onClick={() => setTabel(false)} ikon={<ChartColumnBig className="size-3.5" />}>
            Gelembung
          </Tombol>
          <Tombol aktif={tabel} onClick={() => setTabel(true)} ikon={<Table2 className="size-3.5" />}>
            Tabel
          </Tombol>
        </div>
      </div>

      {tabel ? <TabelTitik titik={titik} labelX={labelX} /> : <PetaTalenta titik={titik} />}
    </div>
  )
}

function Tombol({
  aktif,
  onClick,
  ikon,
  children,
}: {
  aktif: boolean
  onClick: () => void
  ikon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={aktif}
      className={cn(
        'flex items-center gap-1.5 px-2.5 py-1 text-[11px] transition-colors',
        aktif ? 'bg-accent-subtle font-medium text-accent' : 'text-text-muted hover:bg-surface-3',
      )}
    >
      {ikon}
      {children}
    </button>
  )
}

function TabelTitik({ titik, labelX }: { titik: TitikBubble[]; labelX: string }) {
  // Urut dari titik terpadat: yang paling banyak orangnya adalah yang paling
  // dulu ingin dilihat, sedangkan chart mengurutkan menurut koordinat.
  const urut = [...titik].sort((a, b) => b.jumlah - a.jumlah || b.x - a.x)

  return (
    <div className="max-h-[26rem] overflow-auto rounded-md border border-border">
      <table className="w-full border-collapse text-[12px]">
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr className="border-b border-border text-left text-[10px] tracking-wide text-text-subtle uppercase">
            <th className="px-3 py-2 text-right font-medium">Kinerja</th>
            <th className="px-3 py-2 font-medium">Kategori Y</th>
            <th className="px-3 py-2 text-right font-medium">{labelX}</th>
            <th className="px-3 py-2 font-medium">Kategori X</th>
            <th className="px-3 py-2 text-right font-medium">Kotak</th>
            <th className="px-3 py-2 text-right font-medium">Pegawai</th>
            <th className="px-3 py-2 font-medium">Contoh nama</th>
          </tr>
        </thead>
        <tbody>
          {urut.map((t) => (
            <tr key={`${t.y}-${t.x}`} className="border-b border-border last:border-b-0">
              <td className="tabular px-3 py-1.5 text-right text-text">{formatSkorRingkas(t.y)}</td>
              <td className="px-3 py-1.5 text-text-muted">{klasifikasiSumbuY(t.y)}</td>
              <td className="tabular px-3 py-1.5 text-right text-text">{formatSkorRingkas(t.x)}</td>
              <td className="px-3 py-1.5 text-text-muted">{klasifikasiSumbuX(t.x)}</td>
              <td className="tabular px-3 py-1.5 text-right font-medium text-text">{t.kotak}</td>
              <td className="tabular px-3 py-1.5 text-right text-text">{formatAngka(t.jumlah)}</td>
              <td className="px-3 py-1.5 text-text-subtle">
                {t.contohNama.join(', ')}
                {t.jumlah > t.contohNama.length
                  ? ` +${formatAngka(t.jumlah - t.contohNama.length)} lainnya`
                  : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
