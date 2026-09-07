'use client'

import { X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { KotakCari } from '@/components/ui/kotak-cari'
import { Pilih } from '@/components/ui/pilih'
import { formatAngka } from '@/lib/format'
import { LABEL_POOL, type StatusPool } from '@/lib/workflow'

/**
 * Pemilih jabatan target + filter status, seluruhnya tersinkron ke URL.
 *
 * Semua state di URL supaya tautan "lihat pool jabatan ini yang statusnya
 * Diverifikasi" bisa dikirim ke pimpinan apa adanya (phase.md §5.7).
 */
export function PemilihTarget({
  opsi,
  aktifId,
  status,
}: {
  opsi: Array<{ id: number; nama: string; jumlahPool: number; status: string }>
  aktifId: number
  status: StatusPool | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  const cariUrl = searchParams.get('cari') ?? ''

  function terapkan(perubahan: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(perubahan)) {
      if (v === null) params.delete(k)
      else params.set(k, v)
    }
    mulaiTransisi(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  const adaFilter = status !== null || cariUrl !== ''

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={String(aktifId)}
        onChange={(e) => terapkan({ target: e.target.value, cari: null })}
        aria-label="Jabatan target"
        className="h-8 min-w-72 max-w-full flex-1 rounded-md border border-border bg-surface px-2 text-[13px] text-text outline-none focus:border-accent"
      >
        {opsi.map((o) => (
          <option key={o.id} value={String(o.id)}>
            {o.nama} — {formatAngka(o.jumlahPool)} anggota
            {o.status === 'AKTIF' ? '' : ` (${o.status})`}
          </option>
        ))}
      </select>

      <Pilih
        label="Status kandidat"
        nilai={status ?? ''}
        onUbah={(v) => terapkan({ status: v === '' ? null : v })}
        lebar="w-44"
        opsi={[
          { nilai: '', label: 'Semua status' },
          ...(['DITETAPKAN', 'DIVERIFIKASI', 'DINOMINASIKAN', 'KANDIDAT', 'DITOLAK'] as const).map(
            (s) => ({ nilai: s, label: LABEL_POOL[s] }),
          ),
        ]}
      />

      {/* Pencarian dijalankan saat Enter, bukan per huruf (2 Sep 2026). */}
      <KotakCari
        nilaiAwal={cariUrl}
        onCari={(q: string) => terapkan({ cari: q === '' ? null : q })}
        placeholder="Cari nama atau NIP…"
        label="Cari anggota pool"
        pending={pending}
        className="min-w-48 flex-1"
      />

      {adaFilter ? (
        <Button
          size="sm"
          variant="halus"
          onClick={() => terapkan({ status: null, cari: null })}
          pending={pending}
          ikon={<X className="size-3.5" />}
        >
          Reset
        </Button>
      ) : null}
    </div>
  )
}
