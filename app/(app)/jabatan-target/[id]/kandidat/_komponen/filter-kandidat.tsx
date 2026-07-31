'use client'

import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import { formatAngka } from '@/lib/format'

/**
 * Bilah filter kandidat.
 *
 * Checkbox-nya menampilkan keadaan **optimistis** lalu disinkronkan dari URL.
 * Membacanya langsung dari URL terasa seperti klik mati: kotaknya baru tercentang
 * setelah server menjawab — cacat nyata yang ketemu di Fase 3 (phase.md §5.2).
 */
export function FilterKandidat({
  total,
  jumlahEligible,
}: {
  total: number
  jumlahEligible: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  const cariUrl = searchParams.get('cari') ?? ''
  const eligibleUrl = searchParams.get('eligible') === '1'

  const [cari, setCari] = useState(cariUrl)
  const [hanyaEligible, setHanyaEligible] = useState(eligibleUrl)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [cariTerakhir, setCariTerakhir] = useState(cariUrl)
  if (cariUrl !== cariTerakhir) {
    setCariTerakhir(cariUrl)
    setCari(cariUrl)
  }
  const [eligibleTerakhir, setEligibleTerakhir] = useState(eligibleUrl)
  if (eligibleUrl !== eligibleTerakhir) {
    setEligibleTerakhir(eligibleUrl)
    setHanyaEligible(eligibleUrl)
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
      if (v === null) params.delete(k)
      else params.set(k, v)
    }
    // Mengubah filter membuang paginasi & panel rincian yang sudah basi.
    params.delete('hal')
    params.delete('rincian')
    mulaiTransisi(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  function onCariBerubah(nilai: string) {
    setCari(nilai)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => terapkan({ cari: nilai === '' ? null : nilai }), 300)
  }

  const adaFilter = cariUrl !== '' || eligibleUrl

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-56 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-subtle" />
        <input
          value={cari}
          onChange={(e) => onCariBerubah(e.target.value)}
          placeholder="Cari nama atau NIP kandidat…"
          aria-label="Cari kandidat"
          className="h-8 w-full rounded-md border border-border bg-surface pr-16 pl-8 text-[13px] text-text outline-none focus:border-accent"
        />
        {pending ? (
          <span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-text-subtle">
            mencari…
          </span>
        ) : null}
      </div>

      <label
        className={cn(
          'flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border px-2.5 text-[13px] transition-colors',
          hanyaEligible
            ? 'border-accent-border bg-accent-subtle text-text'
            : 'border-border bg-surface text-text-muted',
        )}
      >
        <input
          type="checkbox"
          checked={hanyaEligible}
          onChange={(e) => {
            setHanyaEligible(e.target.checked)
            terapkan({ eligible: e.target.checked ? '1' : null })
          }}
          className="size-3.5 accent-[var(--accent)]"
        />
        Hanya lolos syarat
        <span className="tabular text-[11px] text-text-subtle">
          {formatAngka(jumlahEligible)}/{formatAngka(total)}
        </span>
      </label>

      {adaFilter ? (
        <Button
          size="sm"
          variant="halus"
          onClick={() => terapkan({ cari: null, eligible: null })}
          pending={pending}
          ikon={<X className="size-3.5" />}
        >
          Reset
        </Button>
      ) : null}
    </div>
  )
}
