'use client'

import { ChevronDown, LogOut, ShieldCheck, UserRound } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { keluar } from '@/lib/aksi/auth'
import { cn } from '@/lib/cn'
import { inisial } from '@/lib/format'
import { DESKRIPSI_PERAN, type PenggunaAktif } from '@/lib/peran'

/**
 * Menu pengguna di navbar — pengganti Dev Role Switcher (phase.md §5.6).
 *
 * Perbedaannya bukan hanya kosmetik: pendahulunya **berpindah identitas tanpa
 * sandi**, yang wajar selama auth belum ada dan berbahaya begitu auth ada.
 * Komponen ini hanya bisa melihat siapa dirinya dan keluar.
 *
 * Peran ditampilkan permanen di tombolnya, bukan disembunyikan di dalam menu.
 * Di aplikasi yang isinya berubah menurut peran, "kenapa tombol itu tidak ada
 * di layar saya" adalah pertanyaan yang paling sering muncul — dan jawabannya
 * harus terlihat tanpa mengklik apa pun.
 */
export function MenuPengguna({ pengguna }: { pengguna: PenggunaAktif }) {
  const [buka, setBuka] = useState(false)
  const [pending, mulaiTransisi] = useTransition()
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

  return (
    <div ref={wadahRef} className="relative">
      <button
        type="button"
        onClick={() => setBuka((s) => !s)}
        aria-haspopup="menu"
        aria-expanded={buka}
        className="flex h-8 items-center gap-2 rounded-md border border-border bg-surface px-1.5 text-[13px] transition-colors hover:bg-surface-3"
      >
        <span
          aria-hidden
          className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-[9px] font-semibold text-accent"
        >
          {inisial(pengguna.nama)}
        </span>
        <span className="hidden max-w-[12rem] text-left leading-tight font-medium break-words text-text sm:inline-block">
          {pengguna.nama}
        </span>
        <span className="hidden rounded bg-surface-3 px-1.5 py-px text-[10px] text-text-muted md:inline">
          {pengguna.peran}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-text-subtle" />
      </button>

      {buka ? (
        <div
          role="menu"
          className="absolute right-0 z-40 mt-1.5 w-72 overflow-hidden rounded-lg border border-border bg-surface shadow-[var(--shadow-overlay)]"
        >
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-[13px] leading-snug font-medium break-words text-text">
              {pengguna.nama}
            </p>
            {/* Surel dipecah per karakter bila perlu: ia satu kata tanpa spasi,
                jadi `break-words` saja membiarkannya meluber dari panel 18rem. */}
            <p className="text-[11px] leading-snug break-all text-text-subtle">{pengguna.email}</p>
            <p className="mt-2 flex items-start gap-1.5 text-[11px] leading-relaxed text-text-muted">
              <ShieldCheck className="mt-px size-3.5 shrink-0 text-text-subtle" />
              <span>
                <span className="font-medium text-text">{pengguna.peran}</span>
                {pengguna.namaUnit ? ` · ${pengguna.namaUnit}` : ''}
                <span className="block text-text-subtle">{DESKRIPSI_PERAN[pengguna.peran]}</span>
              </span>
            </p>
          </div>

          <div className="p-1.5">
            <Link
              href="/profil"
              role="menuitem"
              onClick={() => setBuka(false)}
              className="flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] text-text transition-colors hover:bg-surface-3"
            >
              <UserRound className="size-4 shrink-0 text-text-subtle" />
              Profil Saya
            </Link>

            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => mulaiTransisi(() => keluar())}
              className={cn(
                'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] text-text transition-colors hover:bg-surface-3 disabled:opacity-60',
              )}
            >
              {pending ? (
                <Spinner className="size-4 shrink-0 text-text-subtle" />
              ) : (
                <LogOut className="size-4 shrink-0 text-text-subtle" />
              )}
              {pending ? 'Keluar…' : 'Keluar'}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
