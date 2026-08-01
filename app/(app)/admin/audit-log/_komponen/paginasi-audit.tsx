'use client'

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { formatAngka } from '@/lib/format'

/**
 * Paginasi audit log.
 *
 * Berdiri sendiri (tidak memakai `DataTable`) karena daftar audit bukan tabel
 * yang bisa diurutkan pengguna: urutannya **selalu** terbaru dulu. Kolom
 * pengurutan yang bisa dipilih pada tabel yang hanya bertambah cuma menambah
 * cara mendarat di halaman yang salah.
 */
export function PaginasiAudit({
  halaman,
  perHalaman,
  total,
}: {
  halaman: number
  perHalaman: number
  total: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  const halamanTerakhir = Math.max(1, Math.ceil(total / perHalaman))
  const dari = total === 0 ? 0 : (halaman - 1) * perHalaman + 1
  const sampai = Math.min(halaman * perHalaman, total)

  function ke(h: number) {
    const params = new URLSearchParams(searchParams.toString())
    if (h <= 1) params.delete('hal')
    else params.set('hal', String(h))
    mulaiTransisi(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-text-muted">
      <p className="tabular-nums">
        {total === 0
          ? 'Tidak ada baris'
          : `Menampilkan ${formatAngka(dari)}–${formatAngka(sampai)} dari ${formatAngka(total)} baris`}
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="sekunder"
          size="sm"
          disabled={halaman <= 1 || pending}
          onClick={() => ke(halaman - 1)}
          ikon={<ChevronLeft className="size-3.5" />}
        >
          Sebelumnya
        </Button>
        <span className="tabular-nums px-1">
          {halaman} / {halamanTerakhir}
        </span>
        <Button
          variant="sekunder"
          size="sm"
          disabled={halaman >= halamanTerakhir || pending}
          onClick={() => ke(halaman + 1)}
          ikon={<ChevronRight className="size-3.5" />}
        >
          Berikutnya
        </Button>
      </div>
    </div>
  )
}
