'use client'

import { RotateCcw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'

/** Penyaring Log Aktivitas API — tersinkron URL supaya bisa di-bookmark & dibagikan. */
export function FilterAktivitas({
  nilai,
}: {
  nilai: { golongan: string; endpoint: string; dari: string; sampai: string }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulai] = useTransition()

  function ganti(perubahan: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(perubahan)) {
      if (v === '') params.delete(k)
      else params.set(k, v)
    }
    // Mengubah penyaring selalu kembali ke halaman 1 — menyaring dari halaman 7
    // sering mendarat di daftar kosong yang terbaca sebagai "tidak ada hasil".
    params.delete('hal')
    mulai(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  const adaFilter = Object.values(nilai).some((v) => v !== '')

  return (
    <div className={cn('flex flex-wrap items-end gap-2', pending && 'opacity-60')}>
      <label className="block">
        <span className="mb-1 block text-[11px] text-text-subtle">Hasil</span>
        <select
          value={nilai.golongan}
          onChange={(e) => ganti({ golongan: e.target.value })}
          className={`${kelasInput()} w-auto`}
        >
          <option value="">Semua</option>
          <option value="sukses">Berhasil (2xx)</option>
          <option value="ditolak">Ditolak (4xx) — klien yang salah</option>
          <option value="galat">Galat (5xx) — kita yang salah</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] text-text-subtle">Endpoint memuat</span>
        <input
          defaultValue={nilai.endpoint}
          onBlur={(e) => {
            if (e.target.value !== nilai.endpoint) ganti({ endpoint: e.target.value })
          }}
          placeholder="mis. talent-pool"
          className={`${kelasInput()} w-48`}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] text-text-subtle">Dari tanggal</span>
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
          onClick={() => mulai(() => router.replace(pathname, { scroll: false }))}
          ikon={<RotateCcw className="size-3.5" />}
        >
          Reset
        </Button>
      ) : null}
    </div>
  )
}
