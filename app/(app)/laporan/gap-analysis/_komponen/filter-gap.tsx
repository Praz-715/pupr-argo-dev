'use client'

import { RotateCcw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { OpsiLaporan } from '@/lib/kueri/laporan'

/**
 * Penyaring Gap Analysis. Seluruh state ada di URL supaya laporan yang sudah
 * disaring bisa dikirim ke pimpinan apa adanya (phase.md §5.7).
 */
export function FilterLaporanGap({
  opsi,
  nilai,
}: {
  opsi: OpsiLaporan
  nilai: { target: string; unit: string; jenjang: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  function ganti(perubahan: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(perubahan)) {
      if (v === '') params.delete(k)
      else params.set(k, v)
    }
    mulaiTransisi(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  const adaFilter = Object.values(nilai).some((v) => v !== '')

  return (
    <div className={cn('flex flex-wrap items-end gap-2', pending && 'opacity-60')}>
      <Pilih
        label="Jabatan target"
        value={nilai.target}
        onChange={(v) => ganti({ target: v })}
        opsi={[
          { nilai: '', label: 'Semua jabatan target' },
          ...opsi.jabatanTarget.map((t) => ({ nilai: String(t.id), label: t.nama })),
        ]}
      />
      <Pilih
        label="Unit organisasi"
        value={nilai.unit}
        onChange={(v) => ganti({ unit: v })}
        opsi={[
          { nilai: '', label: 'Semua unit' },
          ...opsi.unit.map((u) => ({ nilai: String(u.id), label: u.nama })),
        ]}
      />
      <Pilih
        label="Jenjang"
        value={nilai.jenjang}
        onChange={(v) => ganti({ jenjang: v })}
        opsi={[
          { nilai: '', label: 'Semua jenjang' },
          ...opsi.jenjang.map((j) => ({ nilai: j, label: j })),
        ]}
      />

      {adaFilter ? (
        <Button
          variant="halus"
          size="sm"
          onClick={() => mulaiTransisi(() => router.replace(pathname, { scroll: false }))}
          ikon={<RotateCcw className="size-3.5" />}
        >
          Reset
        </Button>
      ) : null}
    </div>
  )
}

function Pilih({
  label,
  value,
  onChange,
  opsi,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  opsi: Array<{ nilai: string; label: string }>
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-text-subtle">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${kelasInput()} w-auto max-w-[16rem]`}
      >
        {opsi.map((o) => (
          <option key={o.nilai} value={o.nilai}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}
