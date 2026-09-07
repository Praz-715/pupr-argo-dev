'use client'

import { RotateCcw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { KotakCari } from '@/components/ui/kotak-cari'
import { Pilih } from '@/components/ui/pilih'
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

  function terapkan(perubahan: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(perubahan)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    params.delete('hal')
    mulaiTransisi(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  const filterAktif = ['cari', 'unit', 'eselon', 'jenis', 'status'].filter((k) =>
    searchParams.get(k),
  )

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Pencarian dijalankan saat Enter, bukan per huruf (2 Sep 2026). */}
        <KotakCari
          nilaiAwal={cariAwal}
          onCari={(q: string) => terapkan({ cari: q })}
          placeholder="Cari nama atau kode jabatan…"
          label="Cari nama atau kode jabatan"
          pending={pending}
          className="min-w-56 flex-1"
        />

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
