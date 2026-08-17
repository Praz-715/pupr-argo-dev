import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

/**
 * Wadah dasar konten. Border tipis, bukan shadow tebal — sesuai arah desain
 * "profesional seperti Notion" (CLAUDE.md).
 */
export function Panel({
  children,
  className,
  padat = false,
  id,
}: {
  children: ReactNode
  className?: string
  /** Hilangkan padding — untuk panel yang isinya tabel penuh. */
  padat?: boolean
  /** Target anchor dalam halaman (mis. dari kartu ringkas dashboard). */
  id?: string
}) {
  return (
    <section
      id={id}
      className={cn(
        // shadow-kartu sangat tipis (2%+4%) — tugasnya mengangkat panel dari
        // kanvas setipis mungkin, bukan menggambar kotak kedua di sekitarnya.
        'rounded-lg border border-border bg-surface shadow-kartu',
        padat ? '' : 'p-4',
        // scroll-mt supaya judul panel tidak tertutup navbar saat dituju anchor
        id ? 'scroll-mt-4' : '',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function PanelHeader({
  judul,
  deskripsi,
  aksi,
  className,
}: {
  judul: ReactNode
  /** Basis data / cakupan angka — wajib untuk panel berisi chart (phase.md §5.5). */
  deskripsi?: ReactNode
  aksi?: ReactNode
  className?: string
}) {
  return (
    <header className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-text">{judul}</h2>
        {deskripsi ? (
          <p className="mt-0.5 text-xs leading-relaxed text-text-subtle">{deskripsi}</p>
        ) : null}
      </div>
      {aksi ? <div className="flex shrink-0 items-center gap-1.5">{aksi}</div> : null}
    </header>
  )
}

/**
 * Judul halaman + deskripsi + aksi kanan, di atas pita bermerek DJBK.
 * Diporting dari v1 `.page-head` — gradien navy→teal dengan teks putih.
 *
 * Kenapa pita dan bukan judul biasa di atas kanvas: setiap halaman aplikasi ini
 * dibuka lewat sidebar, dan tanpa penanda visual di puncak konten, satu-satunya
 * yang membedakan satu halaman dari halaman lain adalah baris teks kecil di
 * pojok kiri atas. Pita ini memberi tiap halaman kepala yang jelas — sekaligus
 * jadi satu-satunya elemen bermerek yang IKUT TERCETAK (lihat @media print di
 * globals.css), supaya lembar cetaknya dikenali sebagai dokumen DJBK.
 *
 * `aksi` dibungkus wadah yang MENDEFINISIKAN ULANG token warna, bukan yang
 * menimpa class anaknya. Alasannya: tombol `utama` berlatar --accent, dan pita
 * ini juga berbasis --accent, jadi di tengah gradien tombolnya benar-benar
 * lenyap. Karena `@theme inline` membuat setiap utility menunjuk langsung ke
 * token (bg-accent → var(--accent)), mendefinisikan ulang tokennya di scope ini
 * membuat SEMUA komponen di dalam pita ikut menyesuaikan diri — tanpa satu pun
 * dari 33 halaman pemakainya perlu tahu bahwa latarnya berubah.
 */
export function PageHeader({
  judul,
  deskripsi,
  aksi,
}: {
  judul: ReactNode
  deskripsi?: ReactNode
  aksi?: ReactNode
}) {
  return (
    <div className="pita-kepala flex flex-wrap items-center justify-between gap-4 rounded-lg px-5 py-4 shadow-kartu">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-kepala-teks">{judul}</h1>
        {deskripsi ? (
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-kepala-teks-samar">
            {deskripsi}
          </p>
        ) : null}
      </div>
      {aksi ? <div className="pita-kepala-aksi flex shrink-0 items-center gap-2">{aksi}</div> : null}
    </div>
  )
}
