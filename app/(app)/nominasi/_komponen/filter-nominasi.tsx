'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { cn } from '@/lib/cn'
import type { Peran } from '@/lib/peran'
import { LABEL_GILIRAN, type Giliran } from '@/lib/workflow'

/**
 * Penyaring antrian menurut giliran.
 *
 * Pilihan "milik saya" muncul lebih dulu dan ditandai, karena itu yang dibuka
 * paling sering: pengguna datang ke halaman ini untuk mengerjakan bagiannya, bukan
 * untuk menelusuri seluruh antrian.
 */
export function FilterNominasi({
  giliran,
  peran,
}: {
  giliran: Giliran | null
  peran: Peran | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  const giliranSaya: Giliran | null =
    peran === 'Admin Talenta'
      ? 'ADMIN_TALENTA'
      : peran === 'Pimpinan'
        ? 'PIMPINAN'
        : peran === 'Pengelola Unit'
          ? 'UNIT'
          : null

  function pilih(nilai: Giliran | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (nilai === null) params.delete('giliran')
    else params.set('giliran', nilai)
    mulaiTransisi(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  const opsi: Array<{ nilai: Giliran | null; label: string; utama?: boolean }> = [
    ...(giliranSaya !== null
      ? [{ nilai: giliranSaya, label: `Menunggu saya (${LABEL_GILIRAN[giliranSaya]})`, utama: true }]
      : []),
    { nilai: null, label: 'Semua' },
    { nilai: 'ADMIN_TALENTA' as Giliran, label: 'Menunggu Admin Talenta' },
    { nilai: 'PIMPINAN' as Giliran, label: 'Menunggu Pimpinan' },
    { nilai: 'UNIT' as Giliran, label: 'Dikembalikan ke unit' },
    { nilai: 'SELESAI' as Giliran, label: 'Selesai' },
  ].filter(
    // Jangan tampilkan pilihan yang sama dua kali (mis. "Menunggu saya" = Admin Talenta).
    (o, i, semua) => semua.findIndex((x) => x.nilai === o.nilai) === i,
  )

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', pending && 'opacity-60')}>
      {opsi.map((o) => {
        const aktif = o.nilai === giliran
        return (
          <button
            key={o.label}
            type="button"
            onClick={() => pilih(o.nilai)}
            disabled={pending}
            className={cn(
              'h-8 rounded-md border px-2.5 text-[12px] transition-colors',
              aktif
                ? 'border-accent-border bg-accent-subtle font-medium text-text'
                : 'border-border bg-surface text-text-muted hover:text-text',
              o.utama === true && !aktif ? 'border-accent-border/60' : '',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
