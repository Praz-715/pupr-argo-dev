'use client'

import { AlertTriangle, Check, Info, X } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { cn } from '@/lib/cn'

/**
 * Toast untuk umpan balik hasil mutasi (phase.md §5.2 & §5.4).
 *
 * Aturan pemakaian:
 *   - Toast untuk hasil AKSI ("Nominasi disimpan", "Gagal menyimpan").
 *   - Error validasi field TIDAK pakai toast — tampilkan inline di fieldnya,
 *     supaya pengguna tahu bagian mana yang harus dibetulkan.
 *   - Toast error TIDAK auto-hilang: pengguna harus bisa membacanya sampai habis.
 */

export type NadaToast = 'sukses' | 'bahaya' | 'info'

interface Toast {
  id: number
  nada: NadaToast
  judul: string
  keterangan?: string
}

interface KonteksToast {
  tampilkan: (toast: Omit<Toast, 'id'>) => void
}

const Konteks = createContext<KonteksToast | null>(null)

const DURASI: Record<NadaToast, number> = {
  sukses: 4000,
  info: 5000,
  // Error dibiarkan sampai ditutup manual.
  bahaya: 0,
}

const IKON = { sukses: Check, bahaya: AlertTriangle, info: Info } as const

const GAYA: Record<NadaToast, string> = {
  sukses: 'border-success-border bg-success-subtle text-success',
  bahaya: 'border-danger-border bg-danger-subtle text-danger',
  info: 'border-accent-border bg-accent-subtle text-accent',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [daftar, setDaftar] = useState<Toast[]>([])
  const idBerikut = useRef(1)

  const tutup = useCallback((id: number) => {
    setDaftar((s) => s.filter((t) => t.id !== id))
  }, [])

  const tampilkan = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = idBerikut.current
      idBerikut.current += 1
      setDaftar((s) => [...s, { ...toast, id }])

      const durasi = DURASI[toast.nada]
      if (durasi > 0) {
        window.setTimeout(() => tutup(id), durasi)
      }
    },
    [tutup],
  )

  const nilai = useMemo(() => ({ tampilkan }), [tampilkan])

  return (
    <Konteks.Provider value={nilai}>
      {children}
      {/* aria-live supaya pembaca layar mengumumkan hasil aksi */}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed right-4 bottom-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {daftar.map((t) => {
          const Ikon = IKON[t.nada]
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto flex items-start gap-2.5 rounded-lg border p-3 shadow-[var(--shadow-overlay)]',
                GAYA[t.nada],
              )}
            >
              <Ikon className="mt-px size-4 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-text">{t.judul}</p>
                {t.keterangan ? (
                  <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
                    {t.keterangan}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => tutup(t.id)}
                aria-label="Tutup notifikasi"
                className="shrink-0 rounded p-0.5 text-text-subtle transition-colors hover:bg-surface-3 hover:text-text"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </Konteks.Provider>
  )
}

export function useToast(): KonteksToast {
  const konteks = useContext(Konteks)
  if (!konteks) {
    throw new Error('useToast harus dipakai di dalam <ToastProvider>')
  }
  return konteks
}
