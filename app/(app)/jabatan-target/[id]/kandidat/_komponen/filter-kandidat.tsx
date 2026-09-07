'use client'

import { X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { KotakCari } from '@/components/ui/kotak-cari'
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
  opsiRumpun,
}: {
  total: number
  jumlahEligible: number
  /** Rumpun jabatan yang benar-benar ada pada populasi (`lib/kueri/rumpun.ts`). */
  opsiRumpun: Array<{ kunci: string; label: string; jumlahPegawai: number }>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  const cariUrl = searchParams.get('cari') ?? ''
  // Bawaannya MENYARING; `?eligible=0` yang membukanya. Harus sama persis dengan
  // pembacaan di `page.tsx` — kalau berselisih, kotaknya menampilkan keadaan yang
  // berbeda dari daftar yang sedang tampil di bawahnya.
  const eligibleUrl = searchParams.get('eligible') !== '0'

  const [hanyaEligible, setHanyaEligible] = useState(eligibleUrl)

  const [eligibleTerakhir, setEligibleTerakhir] = useState(eligibleUrl)
  if (eligibleUrl !== eligibleTerakhir) {
    setEligibleTerakhir(eligibleUrl)
    setHanyaEligible(eligibleUrl)
  }

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

  const rumpunUrl = searchParams.get('rumpun') ?? ''
  const adaFilter = cariUrl !== '' || eligibleUrl || rumpunUrl !== ''

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Pencarian dijalankan saat Enter, bukan per huruf (2 Sep 2026). */}
      <KotakCari
        nilaiAwal={cariUrl}
        onCari={(q: string) => terapkan({ cari: q === '' ? null : q })}
        placeholder="Cari nama atau NIP kandidat…"
        label="Cari kandidat"
        pending={pending}
        className="min-w-56 flex-1"
      />

      {/*
        Rumpun jabatan (`Detail Revisi PUPR 1_9_2026.pdf`, butir 4): penyaring
        awal yang sama di setiap modul berkandidat. Yang disaring jabatan
        pegawainya SEKARANG, bukan jabatan targetnya — pertanyaannya "siapa yang
        hari ini kepala seksi", dan targetnya sudah ditentukan halaman ini.

        `<select>` polos, bukan `Pilih`: bilah ini bukan toolbar penyaring
        berlebar tetap seperti di Direktori, dan `Pilih` memasang `shrink-0` yang
        akan mendorong kotak pencarian membungkus di layar sempit.
      */}
      {opsiRumpun.length > 0 ? (
        <select
          value={rumpunUrl}
          onChange={(e) => terapkan({ rumpun: e.target.value === '' ? null : e.target.value })}
          aria-label="Saring menurut rumpun jabatan kandidat"
          className="h-8 shrink-0 rounded-md border border-border bg-surface px-2 text-[13px] text-text outline-none focus:border-accent"
        >
          <option value="">Semua rumpun jabatan</option>
          {opsiRumpun.map((r) => (
            <option key={r.kunci} value={r.kunci}>
              {r.label} ({formatAngka(r.jumlahPegawai)})
            </option>
          ))}
        </select>
      ) : null}

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
            terapkan({ eligible: e.target.checked ? null : '0' })
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
          onClick={() => terapkan({ cari: null, eligible: null, rumpun: null })}
          pending={pending}
          ikon={<X className="size-3.5" />}
        >
          Reset
        </Button>
      ) : null}
    </div>
  )
}
