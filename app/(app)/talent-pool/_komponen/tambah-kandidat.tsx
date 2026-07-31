'use client'

import { Plus } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { useToast } from '@/components/ui/toast'
import { tambahKePool } from '@/lib/aksi/suksesi'
import { cn } from '@/lib/cn'
import { formatNip, formatSkor } from '@/lib/format'
import type { KandidatLuarPool } from '@/lib/kueri/suksesi'

/**
 * Menambahkan kandidat yang lolos syarat ke daftar suksesi.
 *
 * Ini jembatan Fase 5 → Fase 6: halaman Kandidat menghitung skor untuk **semua**
 * pegawai, sedangkan keanggotaan pool adalah keputusan manusia tentang siapa yang
 * masuk daftar suksesi. Karena itu daftar di sini hanya memuat yang **lolos
 * syarat** — dan yang tidak lolos ditolak di server juga, bukan cuma disembunyikan.
 */
export function TambahKandidat({
  jabatanTargetId,
  kandidat,
  namaTarget,
}: {
  jabatanTargetId: number
  kandidat: KandidatLuarPool[]
  namaTarget: string
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [buka, setBuka] = useState(false)

  function tambah(k: KandidatLuarPool) {
    mulaiTransisi(async () => {
      const hasil = await tambahKePool(jabatanTargetId, k.pegawaiId)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Ditambahkan.' }
          : { nada: 'bahaya', judul: 'Gagal menambahkan', keterangan: hasil.pesan },
      )
    })
  }

  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <PanelHeader
          judul={`Kandidat lolos syarat di luar daftar suksesi (${kandidat.length})`}
          deskripsi={`Sudah dinilai untuk ${namaTarget} dan memenuhi syarat minimal, tapi belum dimasukkan ke pool. Menambahkan seseorang akan menghitung ulang peringkat seluruh anggota.`}
          aksi={
            <Button size="sm" variant="sekunder" onClick={() => setBuka(!buka)} aria-expanded={buka}>
              {buka ? 'Sembunyikan' : 'Tampilkan'}
            </Button>
          }
        />
      </div>

      {buka ? (
        <ul className={cn('divide-y divide-border', pending && 'opacity-60')}>
          {kandidat.map((k) => (
            <li key={k.pegawaiId} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
              <div className="min-w-0">
                <Link
                  href={`/talenta/${k.nip}`}
                  className="text-[13px] font-medium text-text hover:text-accent"
                >
                  {k.nama}
                </Link>
                <span className="tabular block text-[11px] text-text-subtle">
                  {formatNip(k.nip)}
                  {k.namaJabatan !== null ? ` · ${k.namaJabatan}` : ''}
                </span>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="text-[11px] text-text-subtle">
                  Kotak 9 <span className="tabular text-text">{k.kotak9 ?? '—'}</span>
                  {k.predikatKinerja !== null ? ` · ${k.predikatKinerja}` : ''}
                </span>
                <span className="tabular text-[13px] font-semibold text-text">
                  {formatSkor(k.skorTotal)}
                </span>
                <Button
                  size="sm"
                  variant="sekunder"
                  onClick={() => tambah(k)}
                  pending={pending}
                  ikon={<Plus className="size-3.5" />}
                >
                  Masukkan
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </Panel>
  )
}
