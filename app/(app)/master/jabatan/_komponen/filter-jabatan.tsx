'use client'

import { RotateCcw, Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Pilih } from '@/components/ui/pilih'
import { Spinner } from '@/components/ui/spinner'
import { formatAngka } from '@/lib/format'

const LABEL_ESELON: Record<string, string> = {
  I: 'Eselon I',
  II: 'Eselon II',
  III: 'Eselon III',
  IV: 'Eselon IV',
  NON_ESELON: 'Non-eselon',
}

const LABEL_JENIS: Record<string, string> = {
  STRUKTURAL: 'Struktural',
  FUNGSIONAL_TERTENTU: 'Fungsional Tertentu',
  FUNGSIONAL_UMUM: 'Fungsional Umum',
}

export function FilterMasterJabatan({
  opsi,
  opsiUnit,
  total,
}: {
  opsi: { eselon: string[]; jenisJabatan: string[]; jenjang: string[] }
  opsiUnit: Array<{ id: number; nama: string; kedalaman: number }>
  total: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  const cariAwal = searchParams.get('cari') ?? ''
  const [cari, setCari] = useState(cariAwal)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [cariUrlTerakhir, setCariUrlTerakhir] = useState(cariAwal)
  if (cariAwal !== cariUrlTerakhir) {
    setCariUrlTerakhir(cariAwal)
    setCari(cariAwal)
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function terapkan(perubahan: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(perubahan)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    params.delete('hal')
    mulaiTransisi(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  function onCariBerubah(nilai: string) {
    setCari(nilai)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => terapkan({ cari: nilai }), 300)
  }

  const filterAktif = ['cari', 'unit', 'eselon', 'jenis', 'status'].filter((k) =>
    searchParams.get(k),
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-subtle" />
          <input
            value={cari}
            onChange={(e) => onCariBerubah(e.target.value)}
            placeholder="Cari nama atau kode jabatan…"
            aria-label="Cari nama atau kode jabatan"
            className="h-8 w-full rounded-md border border-border bg-surface pr-16 pl-8 text-[13px] text-text outline-none placeholder:text-text-subtle focus:border-accent"
          />
          {pending ? (
            <span className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1 text-[10px] text-text-subtle">
              <Spinner className="size-3" />
              mencari
            </span>
          ) : null}
        </div>

        <Pilih
          label="Unit organisasi"
          nilai={searchParams.get('unit') ?? ''}
          onUbah={(v) => terapkan({ unit: v })}
          opsi={[
            { nilai: '', label: 'Semua unit' },
            ...opsiUnit.map((u) => ({
              nilai: String(u.id),
              label: `${'  '.repeat(u.kedalaman)}${u.nama}`,
            })),
          ]}
          lebar="w-56"
        />

        <Pilih
          label="Eselon"
          nilai={searchParams.get('eselon') ?? ''}
          onUbah={(v) => terapkan({ eselon: v })}
          opsi={[
            { nilai: '', label: 'Semua eselon' },
            ...opsi.eselon.map((e) => ({ nilai: e, label: LABEL_ESELON[e] ?? e })),
          ]}
          lebar="w-40"
        />

        <Pilih
          label="Jenis jabatan"
          nilai={searchParams.get('jenis') ?? ''}
          onUbah={(v) => terapkan({ jenis: v })}
          opsi={[
            { nilai: '', label: 'Semua jenis' },
            ...opsi.jenisJabatan.map((j) => ({ nilai: j, label: LABEL_JENIS[j] ?? j })),
          ]}
          lebar="w-44"
        />

        <Pilih
          label="Status jabatan"
          nilai={searchParams.get('status') ?? ''}
          onUbah={(v) => terapkan({ status: v })}
          opsi={[
            { nilai: '', label: 'Semua status' },
            { nilai: 'TERISI', label: 'Terisi' },
            { nilai: 'KOSONG', label: 'Kosong' },
            { nilai: 'DIHAPUS', label: 'Diarsipkan' },
          ]}
          lebar="w-40"
        />

        {filterAktif.length > 0 ? (
          <Button
            size="sm"
            variant="halus"
            onClick={() => {
              setCari('')
              mulaiTransisi(() => router.push(pathname, { scroll: false }))
            }}
            ikon={<RotateCcw className="size-3.5" />}
          >
            Reset
          </Button>
        ) : null}
      </div>

      <p className="text-[11px] text-text-subtle">
        {filterAktif.length === 0 ? (
          <>Menampilkan seluruh {formatAngka(total)} jabatan.</>
        ) : (
          <>
            {formatAngka(total)} jabatan cocok dengan {filterAktif.length} filter aktif.
          </>
        )}{' '}
        Jabatan berstatus <strong className="font-medium text-text-muted">Diarsipkan</strong> tetap
        ada supaya riwayat jabatan pegawai tidak bolong, tapi tidak dihitung sebagai kekosongan.
      </p>
    </div>
  )
}
