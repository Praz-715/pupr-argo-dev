'use client'

import { Check, ChevronDown, FlaskConical } from 'lucide-react'
import { useEffect, useRef, useState, useTransition } from 'react'

import { gantiPenggunaDev } from '@/lib/aksi/pengguna-dev'
import { cn } from '@/lib/cn'
import { inisial } from '@/lib/format'
import { DESKRIPSI_PERAN, type PenggunaAktif } from '@/lib/peran'
import { Spinner } from '@/components/ui/spinner'

/**
 * SEMENTARA — pengganti sesi sampai Fase 7 (phase.md §5.6).
 * Hanya dirender kalau `NEXT_PUBLIC_DEV_ROLE_SWITCH=1`; server action-nya juga
 * menolak jalan tanpa flag itu, jadi tidak bisa lolos ke produksi diam-diam.
 */
export function DevRoleSwitcher({
  penggunaAktif,
  daftarPengguna,
}: {
  penggunaAktif: PenggunaAktif | null
  daftarPengguna: PenggunaAktif[]
}) {
  const [buka, setBuka] = useState(false)
  const [pending, mulaiTransisi] = useTransition()
  const [idBerpindah, setIdBerpindah] = useState<number | null>(null)
  const wadahRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKlikLuar(e: MouseEvent) {
      if (wadahRef.current && !wadahRef.current.contains(e.target as Node)) setBuka(false)
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') setBuka(false)
    }
    document.addEventListener('mousedown', onKlikLuar)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onKlikLuar)
      document.removeEventListener('keydown', onEsc)
    }
  }, [])

  if (daftarPengguna.length === 0) return null

  function pilih(id: number) {
    if (id === penggunaAktif?.id) {
      setBuka(false)
      return
    }
    setIdBerpindah(id)
    mulaiTransisi(async () => {
      await gantiPenggunaDev(id)
      setBuka(false)
      setIdBerpindah(null)
    })
  }

  return (
    <div ref={wadahRef} className="relative">
      <button
        type="button"
        onClick={() => setBuka((s) => !s)}
        aria-haspopup="menu"
        aria-expanded={buka}
        aria-busy={pending || undefined}
        className="flex h-8 items-center gap-2 rounded-md border border-warning-border bg-warning-subtle px-2 text-[13px] transition-colors hover:brightness-[1.02]"
        title="Pengalih peran khusus pengembangan — auth asli dibangun di Fase 7"
      >
        {pending ? (
          <Spinner className="size-3.5 text-warning" />
        ) : (
          <FlaskConical className="size-3.5 shrink-0 text-warning" />
        )}
        <span className="hidden max-w-[9rem] truncate font-medium text-text sm:inline">
          {penggunaAktif?.nama ?? 'Tanpa pengguna'}
        </span>
        <span className="hidden rounded bg-surface px-1.5 py-px text-[10px] text-text-muted md:inline">
          {penggunaAktif?.peran ?? '—'}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-text-subtle" />
      </button>

      {buka ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1.5 w-80 overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-overlay)]"
        >
          <div className="border-b border-border bg-warning-subtle px-3 py-2">
            <p className="text-[11px] leading-relaxed text-text-muted">
              <span className="font-semibold text-text">Mode pengembangan.</span> Auth belum
              dibangun — pilih akun untuk menguji tampilan per peran. Tombol ini hilang begitu{' '}
              <code className="font-mono text-[10px]">NEXT_PUBLIC_DEV_ROLE_SWITCH</code> dimatikan.
            </p>
          </div>

          <ul className="max-h-96 overflow-y-auto p-1.5">
            {daftarPengguna.map((u) => {
              const aktif = u.id === penggunaAktif?.id
              const sedangPindah = idBerpindah === u.id
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={aktif}
                    disabled={pending}
                    onClick={() => pilih(u.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors disabled:opacity-60',
                      aktif ? 'bg-accent-subtle' : 'hover:bg-surface-3',
                    )}
                  >
                    <span
                      aria-hidden
                      className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[10px] font-semibold text-text-muted"
                    >
                      {inisial(u.nama)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-text">
                        {u.nama}
                      </span>
                      <span className="block truncate text-[11px] text-text-subtle">
                        {u.peran}
                        {u.namaUnit ? ` · ${u.namaUnit}` : ''}
                      </span>
                    </span>
                    {sedangPindah ? (
                      <Spinner className="size-3.5 shrink-0 text-accent" />
                    ) : aktif ? (
                      <Check className="size-4 shrink-0 text-accent" />
                    ) : null}
                  </button>
                </li>
              )
            })}
          </ul>

          {penggunaAktif ? (
            <p className="border-t border-border px-3 py-2 text-[11px] leading-relaxed text-text-subtle">
              {DESKRIPSI_PERAN[penggunaAktif.peran]}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
