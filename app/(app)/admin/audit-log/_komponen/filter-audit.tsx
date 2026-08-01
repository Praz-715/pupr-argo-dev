'use client'

import { RotateCcw, Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/cn'
import type { OpsiAudit } from '@/lib/kueri/admin'

/**
 * Penyaring audit log.
 *
 * Pilihan entitas, aksi, dan pengguna **diturunkan dari isi tabel**, bukan
 * dari daftar tetap: setiap modul baru menambah entitas baru, dan daftar yang
 * ditulis tangan akan ketinggalan tanpa ada yang tahu — pemeriksa lalu
 * menyimpulkan modul itu tidak pernah menulis apa pun.
 */
export function FilterAudit({
  opsi,
  nilai,
}: {
  opsi: OpsiAudit
  nilai: {
    pengguna: string
    entitas: string
    aksi: string
    dari: string
    sampai: string
    cari: string
  }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()
  const [teks, setTeks] = useState(nilai.cari)

  useEffect(() => {
    if (teks === nilai.cari) return
    const t = setTimeout(() => ganti({ cari: teks }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teks])

  function ganti(perubahan: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(perubahan)) {
      if (v === '') params.delete(k)
      else params.set(k, v)
    }
    // Setiap perubahan filter mengembalikan ke halaman 1. Tanpa ini, menyaring
    // dari halaman 7 sering mendarat di daftar kosong yang terbaca sebagai
    // "tidak ada hasil".
    params.delete('hal')
    mulaiTransisi(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  const adaFilter = Object.values(nilai).some((v) => v !== '')

  return (
    <div className={cn('flex flex-wrap items-end gap-2', pending && 'opacity-60')}>
      <span className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-subtle" />
        <input
          value={teks}
          onChange={(e) => setTeks(e.target.value)}
          placeholder="Cari isi perubahan…"
          aria-label="Cari isi perubahan"
          className={`${kelasInput()} w-56 pl-8`}
        />
      </span>

      <Pilih
        label="Pengguna"
        value={nilai.pengguna}
        onChange={(v) => ganti({ pengguna: v })}
        opsi={[
          { nilai: '', label: 'Semua pengguna' },
          ...opsi.pengguna.map((p) => ({ nilai: String(p.id), label: `${p.nama} (${p.jumlah})` })),
        ]}
      />

      <Pilih
        label="Entitas"
        value={nilai.entitas}
        onChange={(v) => ganti({ entitas: v })}
        opsi={[
          { nilai: '', label: 'Semua entitas' },
          ...opsi.entitas.map((e) => ({ nilai: e.nilai, label: `${e.nilai} (${e.jumlah})` })),
        ]}
      />

      <Pilih
        label="Aksi"
        value={nilai.aksi}
        onChange={(v) => ganti({ aksi: v })}
        opsi={[
          { nilai: '', label: 'Semua aksi' },
          ...opsi.aksi.map((a) => ({ nilai: a.nilai, label: `${a.nilai} (${a.jumlah})` })),
        ]}
      />

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
          onClick={() => {
            setTeks('')
            mulaiTransisi(() => router.replace(pathname, { scroll: false }))
          }}
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
        className={`${kelasInput()} w-auto max-w-[14rem]`}
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
