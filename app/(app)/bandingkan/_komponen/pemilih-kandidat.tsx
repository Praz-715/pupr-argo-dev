'use client'

import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { MAKS_KANDIDAT } from '@/lib/banding'

/**
 * Pemilih kandidat — kotak pencarian & chip kandidat terpilih.
 *
 * Hasil pencarian **dirender di server** dari `?cari=`, bukan lewat fetch dari
 * klien. Konsisten dengan halaman lain (seluruh state di URL, bisa dibagikan)
 * dan tidak menambah permukaan API baru yang perlu diamankan sendiri. Yang
 * dikerjakan komponen klien ini hanya debounce + menulis ulang query string.
 */
export function PemilihKandidat({
  terpilih,
}: {
  terpilih: Array<{ nip: string; nama: string }>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  const cariAwal = searchParams.get('cari') ?? ''
  const [cari, setCari] = useState(cariAwal)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Kalau URL berubah dari luar (tombol back, klik "tambahkan"), field ikut.
  const [cariUrlTerakhir, setCariUrlTerakhir] = useState(cariAwal)
  if (cariAwal !== cariUrlTerakhir) {
    setCariUrlTerakhir(cariAwal)
    setCari(cariAwal)
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
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    mulaiTransisi(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  function onCariBerubah(nilai: string) {
    setCari(nilai)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => terapkan({ cari: nilai }), 300)
  }

  function hapus(nip: string) {
    const sisa = terpilih.filter((k) => k.nip !== nip).map((k) => k.nip)
    terapkan({ nip: sisa.length > 0 ? sisa.join(',') : null })
  }

  const penuh = terpilih.length >= MAKS_KANDIDAT

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {terpilih.map((k, i) => (
          <span
            key={k.nip}
            className="flex h-8 items-center gap-1.5 rounded-md border border-accent-border bg-accent-subtle pr-1 pl-2.5 text-[13px] text-text"
          >
            <span
              aria-hidden
              className="tabular text-[10px] font-semibold text-text-subtle"
              title={`Kandidat ke-${i + 1}`}
            >
              {i + 1}
            </span>
            {k.nama}
            <button
              type="button"
              onClick={() => hapus(k.nip)}
              disabled={pending}
              aria-label={`Keluarkan ${k.nama} dari perbandingan`}
              className="rounded p-1 text-text-subtle transition-colors hover:bg-surface-3 hover:text-text disabled:opacity-50"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}

        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-subtle" />
          <input
            value={cari}
            onChange={(e) => onCariBerubah(e.target.value)}
            disabled={penuh}
            placeholder={
              penuh
                ? `Maksimum ${MAKS_KANDIDAT} kandidat — keluarkan satu untuk menambah`
                : 'Cari nama atau NIP untuk ditambahkan…'
            }
            aria-label="Cari kandidat"
            className="h-8 w-full rounded-md border border-border bg-surface pr-16 pl-8 text-[13px] text-text outline-none placeholder:text-text-subtle focus:border-accent disabled:opacity-60"
          />
          {pending ? (
            <span className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1 text-[10px] text-text-subtle">
              <Spinner className="size-3" />
              mencari
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
