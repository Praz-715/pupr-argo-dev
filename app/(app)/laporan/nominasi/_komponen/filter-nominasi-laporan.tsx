'use client'

import { RotateCcw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { OpsiLaporan } from '@/lib/kueri/laporan'

/**
 * Penyaring Laporan Nominasi. Tersinkron URL supaya laporan tersaring bisa
 * dikirim apa adanya, dan tombol back berfungsi (phase.md §5.7).
 *
 * Tanggalnya `type="date"`. Nilai yang tidak sah tetap **diabaikan di server**
 * lewat `tanggalIso()` — pelajaran dari Audit Log Viewer: input yang benar tidak
 * cukup, karena URL bisa disunting dan dipotong saat dibagikan.
 */
export function FilterLaporanNominasi({
  opsi,
  nilai,
}: {
  opsi: OpsiLaporan
  nilai: { target: string; unit: string; dari: string; sampai: string }
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
      <label className="block">
        <span className="mb-1 block text-[11px] text-text-subtle">Jabatan target</span>
        <select
          value={nilai.target}
          onChange={(e) => ganti({ target: e.target.value })}
          className={`${kelasInput()} w-auto max-w-[16rem]`}
        >
          <option value="">Semua jabatan target</option>
          {opsi.jabatanTarget.map((t) => (
            <option key={t.id} value={String(t.id)}>
              {t.nama}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] text-text-subtle">Unit pengaju</span>
        <select
          value={nilai.unit}
          onChange={(e) => ganti({ unit: e.target.value })}
          className={`${kelasInput()} w-auto max-w-[16rem]`}
        >
          <option value="">Semua unit</option>
          {opsi.unit.map((u) => (
            <option key={u.id} value={String(u.id)}>
              {u.nama}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] text-text-subtle">Diajukan dari</span>
        <input
          type="date"
          value={nilai.dari}
          onChange={(e) => ganti({ dari: e.target.value })}
          className={`${kelasInput()} w-auto`}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] text-text-subtle">Sampai</span>
        <input
          type="date"
          value={nilai.sampai}
          onChange={(e) => ganti({ sampai: e.target.value })}
          className={`${kelasInput()} w-auto`}
        />
      </label>

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
