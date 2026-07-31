import Link from 'next/link'

import { gayaTombol } from '@/components/ui/button-style'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-surface px-4">
      <div className="text-center">
        <p className="text-[11px] font-semibold tracking-wider text-text-subtle uppercase">
          404
        </p>
        <h1 className="mt-2 text-xl font-semibold text-text">Halaman tidak ditemukan</h1>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-text-muted">
          Halaman yang kamu tuju belum ada. Sebagian modul SIMT DJBK masih dibangun bertahap —
          lihat penanda fase di sidebar.
        </p>
        <Link href="/" className={`${gayaTombol({ variant: 'utama' })} mt-5`}>
          Kembali ke Dashboard
        </Link>
      </div>
    </div>
  )
}
