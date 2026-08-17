'use client'

import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { useHydrated } from '@/lib/hooks'

import { cn } from '@/lib/cn'
import { Button } from './button'

/**
 * Dialog modal berbasis `<dialog>` bawaan browser.
 *
 * Dipilih daripada div+portal karena elemen native sudah memberi gratis:
 * focus trap, backdrop, tombol Esc, dan `aria-modal` — hal-hal yang biasanya
 * diimplementasikan setengah jalan lalu jadi masalah aksesibilitas.
 */
export function Dialog({
  buka,
  onTutup,
  judul,
  deskripsi,
  children,
  aksi,
  lebar = 'md',
}: {
  buka: boolean
  onTutup: () => void
  judul: string
  deskripsi?: string
  children?: ReactNode
  /** Tombol aksi di kaki dialog. */
  aksi?: ReactNode
  lebar?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (buka && !el.open) el.showModal()
    if (!buka && el.open) el.close()
  }, [buka])

  const kelasLebar = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[lebar]

  /**
   * Dialog dipasang lewat PORTAL ke `document.body`, bukan di tempat pemanggilnya.
   *
   * **Kenapa wajib.** Custom property CSS diwarisi menurut pohon DOM, dan itu tetap
   * berlaku untuk elemen di top layer. Aplikasi ini punya scope bermerek
   * `.pita-kepala-aksi` yang sengaja mendefinisikan ulang `--surface`,
   * `--accent`, dan `--text` supaya tombol di dalam pita kepala navy terbaca —
   * `--surface` di sana bernilai **putih 12%**. Dialog yang dipicu tombol di pita
   * itu (mis. "Buat jabatan target") lahir sebagai anaknya, mewarisi nilai itu,
   * dan tampil **hampir tembus pandang** dengan isi halaman menembus dari
   * belakang. Dilaporkan user 12 Agu 2026; terukur `background-color:
   * rgba(255,255,255,0.12)` pada elemen `<dialog>`-nya.
   *
   * Memperbaikinya dengan menimpa warna di komponen ini akan menyalin nilai token
   * ke tempat kedua — tepat yang dilarang CLAUDE.md, dan `audit:kontras` membaca
   * token dari `globals.css` sehingga salinan itu tidak terjaga. Portal
   * memindahkan dialognya keluar dari scope bermerek, jadi ia mewarisi token
   * tingkat akar seperti dialog lain. Berlaku untuk SETIAP dialog sekaligus,
   * termasuk yang belum ditulis.
   *
   * Portal ditahan sampai setelah hidrasi lewat `useHydrated()` — `document` tidak
   * ada saat render server. Dipakai hook itu, BUKAN `useState` + `useEffect`:
   * memanggil setState di dalam effect memicu render berantai dan dilarang lint
   * di repo ini.
   */
  if (!useHydrated()) return null

  return createPortal(
    <dialog
      ref={ref}
      // `close` menyala juga saat pengguna menekan Esc — jadi state di induk
      // tetap sinkron tanpa perlu menangani keydown sendiri.
      onClose={onTutup}
      onClick={(e) => {
        // Klik pada backdrop: target-nya elemen dialog itu sendiri.
        if (e.target === ref.current) onTutup()
      }}
      className={cn(
        'w-[calc(100vw-2rem)] rounded-xl border border-border bg-surface p-0 text-text shadow-[var(--shadow-overlay)]',
        'backdrop:bg-black/40',
        // `m-auto` WAJIB. Stylesheet UA menengahkan `dialog:modal` lewat
        // `inset: 0` + `margin: auto`, tapi preflight Tailwind menyetel
        // `margin: 0` ke semua elemen — jadi centeringnya mati dan setiap dialog
        // menempel di POJOK KIRI-ATAS, menumpuk sidebar. Terukur 0,0 pada
        // viewport 1600×1000 (12 Agu 2026). Ini menyentuh SEMUA dialog, bukan
        // cuma yang dilaporkan.
        'm-auto max-h-[calc(100dvh-4rem)] overflow-y-auto',
        kelasLebar,
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text">{judul}</h2>
          {deskripsi ? (
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{deskripsi}</p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onTutup}
          aria-label="Tutup dialog"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-surface-3 hover:text-text"
        >
          <X className="size-4" />
        </button>
      </div>

      {children ? <div className="p-4">{children}</div> : null}

      {aksi ? (
        <div className="flex items-center justify-end gap-2 border-t border-border p-3">{aksi}</div>
      ) : null}
    </dialog>,
    document.body,
  )
}

/**
 * Dialog konfirmasi untuk aksi yang sulit dibatalkan.
 * Tombol konfirmasi punya pending state sendiri — aksi destruktif justru yang
 * paling butuh umpan balik bahwa klik sudah diterima (phase.md §5.2).
 */
export function DialogKonfirmasi({
  buka,
  onTutup,
  onKonfirmasi,
  judul,
  deskripsi,
  labelKonfirmasi = 'Lanjutkan',
  labelPending = 'Memproses…',
  pending = false,
  destruktif = false,
}: {
  buka: boolean
  onTutup: () => void
  onKonfirmasi: () => void
  judul: string
  deskripsi?: string
  labelKonfirmasi?: string
  labelPending?: string
  pending?: boolean
  destruktif?: boolean
}) {
  return (
    <Dialog
      buka={buka}
      onTutup={onTutup}
      judul={judul}
      deskripsi={deskripsi}
      lebar="sm"
      aksi={
        <>
          <Button variant="sekunder" size="sm" onClick={onTutup} disabled={pending}>
            Batal
          </Button>
          <Button
            variant={destruktif ? 'bahaya' : 'utama'}
            size="sm"
            onClick={onKonfirmasi}
            pending={pending}
            labelPending={labelPending}
          >
            {labelKonfirmasi}
          </Button>
        </>
      }
    />
  )
}
