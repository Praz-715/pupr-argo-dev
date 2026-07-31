import { ArrowDown, ArrowRight, Briefcase, FileCheck2, Target, Users } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { LabelFase } from '@/components/layout/tautan-fase'
import { CardSkeleton } from '@/components/ui/skeleton'
import { ambilKartuRingkas } from '@/lib/kueri/dashboard'
import { formatAngka, formatPersenNilai } from '@/lib/format'

/**
 * W1 · Empat angka yang paling sering ditanya pimpinan.
 *
 * Setiap kartu menyertakan **konteks pembanding** (mis. "6 dari 19 jabatan
 * strategis"), karena angka telanjang tanpa penyebut tidak bisa dinilai
 * besar-kecilnya. Kartu bernilai nol tetap bermakna, bukan menampilkan "0"
 * saja (phase.md §7 DoD Fase 1).
 */
export async function KartuRingkas() {
  const d = await ambilKartuRingkas()

  const persenKosong =
    d.jabatanStrategisTotal > 0
      ? (d.jabatanStrategisKosong / d.jabatanStrategisTotal) * 100
      : 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kartu
        ikon={<Users className="size-4" />}
        label="Pegawai aktif"
        nilai={d.pegawaiAktif}
        konteks={
          d.pegawaiAktif === d.pegawaiTotal
            ? 'Seluruh pegawai terdata berstatus aktif'
            : `dari ${formatAngka(d.pegawaiTotal)} pegawai terdata`
        }
        tautan={{ href: '/talenta', label: 'Buka Direktori Pegawai' }}
      />

      <Kartu
        ikon={<Briefcase className="size-4" />}
        label="Jabatan strategis kosong"
        nilai={d.jabatanStrategisKosong}
        nada={d.jabatanStrategisKosong > 0 ? 'peringatan' : 'sukses'}
        konteks={
          d.jabatanStrategisKosong === 0
            ? 'Semua jabatan eselon I–III terisi'
            : `${formatPersenNilai(persenKosong)} dari ${formatAngka(d.jabatanStrategisTotal)} jabatan eselon I–III`
        }
        tautan={{ href: '#jabatan-kosong', label: 'Lihat daftar' }}
      />

      <Kartu
        ikon={<Target className="size-4" />}
        label="Kandidat dalam talent pool"
        nilai={d.kandidatPool}
        konteks={
          d.jabatanTargetAktif === 0
            ? 'Belum ada jabatan target aktif'
            : `tersebar di ${formatAngka(d.jabatanTargetAktif)} jabatan target aktif`
        }
        faseTujuan={6}
      />

      <Kartu
        ikon={<FileCheck2 className="size-4" />}
        label="Nominasi menunggu tindakan"
        nilai={d.nominasiMenunggu}
        nada={d.nominasiMenunggu > 0 ? 'peringatan' : 'netral'}
        konteks={
          d.nominasiMenunggu === 0
            ? 'Tidak ada nominasi yang menunggu — antrian bersih'
            : `dari ${formatAngka(d.nominasiTotal)} nominasi tercatat`
        }
        tautan={{ href: '#antrian-nominasi', label: 'Lihat antrian' }}
      />
    </div>
  )
}

function Kartu({
  ikon,
  label,
  nilai,
  konteks,
  nada = 'netral',
  tautan,
  faseTujuan,
}: {
  ikon: ReactNode
  label: string
  nilai: number
  konteks: string
  nada?: 'netral' | 'peringatan' | 'sukses'
  tautan?: { href: string; label: string }
  faseTujuan?: number
}) {
  const warnaNilai =
    nada === 'peringatan' ? 'text-warning' : nada === 'sukses' ? 'text-success' : 'text-text'

  return (
    <div className="flex flex-col rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-text-subtle">
        {ikon}
        <span className="min-w-0 truncate text-[11px] font-medium tracking-wide uppercase">
          {label}
        </span>
        {faseTujuan ? <LabelFase fase={faseTujuan} /> : null}
      </div>

      <p className={`tabular mt-3 text-3xl leading-none font-semibold ${warnaNilai}`}>
        {formatAngka(nilai)}
      </p>

      <p className="mt-2 flex-1 text-[11px] leading-relaxed text-text-subtle">{konteks}</p>

      {tautan ? (
        <Link
          href={tautan.href}
          className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-medium text-accent hover:underline"
        >
          {tautan.label}
          {tautan.href.startsWith("#") ? (
            <ArrowDown className="size-3" />
          ) : (
            <ArrowRight className="size-3" />
          )}
        </Link>
      ) : null}
    </div>
  )
}

export function KartuRingkasSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  )
}
