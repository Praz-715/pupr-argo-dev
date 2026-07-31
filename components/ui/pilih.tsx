'use client'

import { cn } from '@/lib/cn'

/**
 * Dropdown filter padat — dipakai bilah filter Direktori, Peta Talenta, dan
 * halaman berdata lain.
 *
 * Bagian yang penting bukan gayanya, tapi **penanda "filter ini sedang aktif"**:
 * begitu ada nilai terpilih, latar & garisnya memakai warna aksen. Tanpa itu,
 * pengguna yang membuka tautan berfilter dari orang lain tidak punya cara cepat
 * melihat kenapa datanya lebih sedikit dari yang ia harapkan.
 */
export function Pilih({
  label,
  nilai,
  onUbah,
  opsi,
  lebar = 'w-36',
}: {
  label: string
  nilai: string
  onUbah: (nilai: string) => void
  opsi: Array<{ nilai: string; label: string }>
  lebar?: string
}) {
  const aktif = nilai !== ''
  return (
    <select
      aria-label={label}
      value={nilai}
      onChange={(e) => onUbah(e.target.value)}
      className={cn(
        'h-8 shrink-0 rounded-md border bg-surface px-2 text-[13px] outline-none focus:border-accent',
        lebar,
        aktif ? 'border-accent-border bg-accent-subtle text-text' : 'border-border text-text-muted',
      )}
    >
      {opsi.map((o) => (
        <option key={o.nilai} value={o.nilai}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
