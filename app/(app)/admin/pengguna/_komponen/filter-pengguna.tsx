'use client'

import { Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { kelasInput } from '@/components/ui/bidang'
import { cn } from '@/lib/cn'
import type { OpsiPeran } from '@/lib/kueri/admin'

/** Penyaring daftar pengguna. State di URL supaya bisa dibagikan & tombol back bekerja. */
export function FilterPengguna({
  opsiPeran,
  cari,
  roleId,
  status,
}: {
  opsiPeran: OpsiPeran[]
  cari: string
  roleId: string
  status: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()
  const [teks, setTeks] = useState(cari)

  // Debounce 300ms (phase.md §5.7) — mengetik nama tidak boleh jadi satu
  // permintaan per huruf.
  useEffect(() => {
    if (teks === cari) return
    const t = setTimeout(() => ganti('cari', teks), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teks])

  function ganti(kunci: string, nilai: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nilai === '') params.delete(kunci)
    else params.set(kunci, nilai)
    mulaiTransisi(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'opacity-60')}>
      <span className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-subtle" />
        <input
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          placeholder="Cari nama, username, email…"
          aria-label="Cari pengguna"
          className={`${kelasInput()} w-64 pl-8`}
        />
      </span>

      <select
        value={roleId}
        onChange={(e) => ganti('peran', e.target.value)}
        aria-label="Saring menurut peran"
        className={`${kelasInput()} w-auto`}
      >
        <option value="">Semua peran</option>
        {opsiPeran.map((p) => (
          <option key={p.id} value={String(p.id)}>
            {p.nama}
          </option>
        ))}
      </select>

      <select
        value={status}
        onChange={(e) => ganti('status', e.target.value)}
        aria-label="Saring menurut status"
        className={`${kelasInput()} w-auto`}
      >
        <option value="">Aktif & nonaktif</option>
        <option value="aktif">Hanya aktif</option>
        <option value="nonaktif">Hanya nonaktif</option>
      </select>
    </div>
  )
}
