import { Download } from 'lucide-react'

import { gayaTombol } from '@/components/ui/button-style'

/**
 * Tombol unduh .xlsx — **Server Component**, tanpa JavaScript sama sekali.
 *
 * Dua hal yang membuatnya tidak perlu jadi Client Component:
 *
 * 1. Unduhan berheader `Content-Disposition` sudah ditangani peramban. Menyalurkannya
 *    lewat `fetch` + Blob hanya menambah satu salinan berkas di memori tab dan satu
 *    cara baru untuk gagal tanpa pesan.
 * 2. Penyaring yang aktif sudah diketahui server — ia datang dari `searchParams`
 *    halaman yang merender tombol ini. Tidak ada state klien yang perlu dibaca.
 *
 * Yang **wajib** dibawa: penyaring yang sedang tampil di layar. Ekspor yang
 * diam-diam mengunduh seluruh tabel padahal layarnya tersaring adalah cara paling
 * halus untuk membuat seseorang mengirimkan data yang tidak ia maksudkan.
 *
 * Umpan baliknya datang dari indikator unduhan peramban, bukan dari label yang
 * berubah — §5.2 melarang klik yang tidak menghasilkan apa-apa, bukan menuntut
 * kepastian yang halaman ini tidak bisa dapatkan (peramban tidak memberi tahu
 * kapan unduhan selesai).
 */
export function TombolEkspor({
  jenis,
  params,
  label = 'Unduh Excel',
}: {
  jenis: string
  params: Record<string, string | undefined>
  label?: string
}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') qs.set(k, v)
  }
  const href = `/api/internal/ekspor/${jenis}${qs.size > 0 ? `?${qs.toString()}` : ''}`

  return (
    <a href={href} download className={gayaTombol({ variant: 'sekunder', size: 'sm' })}>
      <Download className="size-3.5" />
      {label}
    </a>
  )
}
