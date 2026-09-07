'use client'

import { Search } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/cn'
import { itemTersedia, type GrupNav, type ItemNav } from '@/lib/navigasi'
import { IkonNav } from './ikon-nav'

/**
 * Command palette (Ctrl/⌘+K) — usulan U-8 phase.md.
 *
 * Fase 0 baru mencari halaman. Fase 2 menambah pencarian pegawai/jabatan
 * (server-side, debounce 300ms) lewat sumber data tambahan di komponen ini.
 */
export function CommandPalette({ navigasi }: { navigasi: GrupNav[] }) {
  const router = useRouter()
  const [buka, setBuka] = useState(false)
  const [kueri, setKueri] = useState('')
  const [terpilih, setTerpilih] = useState(0)
  const [kueriTerakhir, setKueriTerakhir] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset sorotan saat kata kunci berubah — disesuaikan SAAT RENDER, bukan lewat
  // useEffect (pola resmi React untuk menyelaraskan state dengan input berubah).
  if (kueri !== kueriTerakhir) {
    setKueriTerakhir(kueri)
    setTerpilih(0)
  }

  const semua = useMemo(
    () => navigasi.flatMap((grup) => grup.item.map((item) => ({ item, grup: grup.label }))),
    [navigasi],
  )

  const hasil = useMemo(() => {
    const q = kueri.trim().toLowerCase()
    if (q === '') return semua.slice(0, 8)
    return semua
      .filter(({ item }) => cocok(item, q))
      .slice(0, 10)
  }, [kueri, semua])

  const tutup = useCallback(() => {
    setBuka(false)
    setKueri('')
    setTerpilih(0)
  }, [])

  // Pintasan global
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuka((s) => !s)
      }
      if (e.key === 'Escape') tutup()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [tutup])

  useEffect(() => {
    if (buka) inputRef.current?.focus()
  }, [buka])

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setTerpilih((i) => Math.min(i + 1, hasil.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setTerpilih((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const pilihan = hasil[terpilih]
      if (pilihan && itemTersedia(pilihan.item)) {
        router.push(pilihan.item.href)
        tutup()
      }
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setBuka(true)}
        className="flex h-8 w-full max-w-xs items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 text-left text-[13px] text-text-subtle transition-colors hover:border-border-strong hover:text-text-muted"
      >
        <Search className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1">Cari halaman, pegawai, jabatan…</span>
        <kbd className="shrink-0 rounded border border-border bg-surface px-1 py-px font-sans text-[10px] text-text-subtle">
          Ctrl K
        </kbd>
      </button>

      {buka ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/35 p-4 pt-[12vh]"
          onClick={tutup}
        >
          <div
            role="dialog"
            aria-modal
            aria-label="Pencarian cepat"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg overflow-hidden rounded-xl border border-border bg-surface shadow-[var(--shadow-overlay)]"
          >
            <div className="flex items-center gap-2.5 border-b border-border px-3.5">
              <Search className="size-4 shrink-0 text-text-subtle" />
              <input
                ref={inputRef}
                value={kueri}
                onChange={(e) => setKueri(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Cari halaman…"
                aria-label="Kata kunci pencarian"
                className="h-11 min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text-subtle"
              />
              <kbd className="shrink-0 rounded border border-border bg-surface-2 px-1.5 py-0.5 font-sans text-[10px] text-text-subtle">
                Esc
              </kbd>
            </div>

            {hasil.length === 0 ? (
              <p className="px-4 py-8 text-center text-[13px] text-text-muted">
                Tidak ada halaman yang cocok dengan “{kueri}”.
              </p>
            ) : (
              <ul className="max-h-80 overflow-y-auto p-1.5">
                {hasil.map(({ item, grup }, i) => {
                  const tersedia = itemTersedia(item)
                  const isi = (
                    <>
                      <IkonNav nama={item.ikon} className="size-4 shrink-0 text-text-subtle" />
                      <span className="min-w-0 flex-1 break-words">{item.label}</span>
                      {grup ? (
                        <span className="shrink-0 text-[11px] text-text-subtle">{grup}</span>
                      ) : null}
                      {!tersedia ? (
                        <span className="shrink-0 rounded bg-surface-3 px-1.5 py-px text-[10px] text-text-subtle">
                          Belum tersedia
                        </span>
                      ) : null}
                    </>
                  )

                  const kelas = cn(
                    'flex min-h-9 items-center gap-2.5 rounded-md px-2.5 py-1 text-[13px]',
                    i === terpilih ? 'bg-surface-3 text-text' : 'text-text-muted',
                    !tersedia && 'cursor-not-allowed opacity-60',
                  )

                  return (
                    <li key={item.href}>
                      {tersedia ? (
                        <Link
                          href={item.href}
                          onClick={tutup}
                          onMouseEnter={() => setTerpilih(i)}
                          className={kelas}
                        >
                          {isi}
                        </Link>
                      ) : (
                        <span
                          aria-disabled
                          onMouseEnter={() => setTerpilih(i)}
                          className={kelas}
                        >
                          {isi}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </>
  )
}

function cocok(item: ItemNav, kueri: string): boolean {
  if (item.label.toLowerCase().includes(kueri)) return true
  if (item.href.toLowerCase().includes(kueri)) return true
  return (item.kataKunci ?? []).some((k) => k.toLowerCase().includes(kueri))
}
