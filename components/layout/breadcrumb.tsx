'use client'

import { ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { formatNip } from '@/lib/format'
import { itemDariPath } from '@/lib/navigasi'

/**
 * Label untuk segmen halaman detail (mis. NIP di `/talenta/{nip}`).
 *
 * Sengaja memakai NIP, bukan nama pegawai: breadcrumb dirender di navbar
 * (app shell) yang tidak punya akses ke data halaman, dan menyalurkan nama ke
 * atas lewat context berarti menulis state saat render — persoalan yang tidak
 * sebanding dengan hasilnya, karena nama sudah jadi judul H1 di halaman itu.
 */
function labelSegmen(segmen: string): string {
  const bersih = decodeURIComponent(segmen)
  if (/^\d{18}$/.test(bersih)) return formatNip(bersih)
  return bersih.replace(/-/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

/** Breadcrumb diturunkan dari `lib/navigasi.ts`, bukan ditulis ulang per halaman. */
export function Breadcrumb() {
  const pathname = usePathname()
  const cocok = itemDariPath(pathname)

  const jejak: Array<{ label: string; href?: string }> = [{ label: 'SIMT DJBK', href: '/' }]

  if (cocok) {
    if (cocok.grup.label) jejak.push({ label: cocok.grup.label })
    const hrefItem = cocok.item.href
    jejak.push({ label: cocok.item.label, href: hrefItem === '/' ? undefined : hrefItem })

    // Halaman detail berada DI BAWAH item navigasi, bukan item itu sendiri.
    // Tanpa titik tambahan ini breadcrumb menyatakan "Direktori Pegawai" padahal
    // yang terbuka adalah profil satu pegawai — keliru, dan menghapus jejak
    // kembali ke daftarnya.
    if (hrefItem !== '/' && pathname.length > hrefItem.length) {
      const sisa = pathname.slice(hrefItem.length).replace(/^\/+/, '').split('/')[0]
      if (sisa) jejak.push({ label: labelSegmen(sisa) })
    }
  }

  return (
    <nav aria-label="Breadcrumb" className="min-w-0">
      {/* `flex-wrap`: jejaknya boleh turun ke baris kedua daripada dipotong.
          Tanpa itu, melepas `truncate` hanya memindahkan masalahnya — jejaknya
          meluber keluar bilah, mendorong kotak pencarian & menu pengguna. */}
      <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-[13px]">
        {jejak.map((titik, i) => {
          const terakhir = i === jejak.length - 1
          return (
            <li key={`${titik.label}-${i}`} className="flex min-w-0 items-center gap-1">
              {i > 0 ? (
                <ChevronRight aria-hidden className="size-3.5 shrink-0 text-text-subtle" />
              ) : null}
              {terakhir || !titik.href ? (
                <span
                  aria-current={terakhir ? 'page' : undefined}
                  className={terakhir ? 'font-medium text-text' : 'text-text-subtle'}
                >
                  {titik.label}
                </span>
              ) : (
                <Link
                  href={titik.href}
                  className="text-text-muted transition-colors hover:text-text"
                >
                  {titik.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
