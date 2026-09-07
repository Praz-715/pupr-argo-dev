'use client'

import { X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { KotakCari } from '@/components/ui/kotak-cari'
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

  function terapkan(perubahan: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(perubahan)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    mulaiTransisi(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
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

        {/* Pencarian dijalankan saat Enter, bukan per huruf (2 Sep 2026). */}
        <KotakCari
          nilaiAwal={cariAwal}
          onCari={(q: string) => terapkan({ cari: q })}
          disabled={penuh}
          placeholder={
            penuh
              ? `Maksimum ${MAKS_KANDIDAT} kandidat — keluarkan satu untuk menambah`
              : 'Cari nama atau NIP untuk ditambahkan…'
          }
          label="Cari kandidat"
          pending={pending}
          className="min-w-56 flex-1"
        />
      </div>
    </div>
  )
}
