'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { kelasInput } from '@/components/ui/bidang'
import { KotakCari } from '@/components/ui/kotak-cari'
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
  /*
    Pencarian dijalankan saat ENTER, bukan per huruf (permintaan pemilik proses
    2 Sep 2026). Debounce 300 ms yang dulu ada di sini — beserta effect-nya —
    pindah ke `KotakCari`, satu tempat untuk sebelas kotak pencarian.
  */

  function ganti(kunci: string, nilai: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nilai === '') params.delete(kunci)
    else params.set(kunci, nilai)
    mulaiTransisi(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'opacity-60')}>
      <KotakCari
        nilaiAwal={cari}
        onCari={(q: string) => ganti('cari', q)}
        placeholder="Cari nama, username, email…"
        label="Cari pengguna"
        pending={pending}
        className="w-64"
      />

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
