import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { gayaTombol } from '@/components/ui/button-style'
import { EmptyState } from '@/components/ui/empty-state'

export default function NotFound() {
  return (
    <div className="space-y-5">
      <Link
        href="/talenta"
        className="inline-flex items-center gap-1.5 text-[13px] text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        Direktori Pegawai
      </Link>

      <EmptyState
        judul="Pegawai tidak ditemukan"
        deskripsi="NIP yang dituju tidak ada di basis data. Mungkin pegawai sudah dihapus, atau NIP-nya keliru — periksa kembali dari Direktori Pegawai."
        aksi={
          <Link href="/talenta" className={gayaTombol({ variant: 'utama', size: 'sm' })}>
            Buka Direktori Pegawai
          </Link>
        }
      />
    </div>
  )
}
