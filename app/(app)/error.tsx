'use client'

import { useEffect } from 'react'

import { ErrorState } from '@/components/ui/states'

/**
 * Error boundary tingkat segmen — halaman gagal tetap menyisakan sidebar &
 * navbar, dan pengguna dapat tombol "Coba lagi" (phase.md §5.4).
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[SIMT] gagal merender halaman:', error)
  }, [error])

  const kemungkinanDb =
    /ECONNREFUSED|ER_ACCESS_DENIED|DATABASE_|ETIMEDOUT|Unknown database/i.test(error.message)

  return (
    <div className="py-8">
      <ErrorState
        judul="Halaman gagal dimuat"
        deskripsi={
          kemungkinanDb
            ? 'Sepertinya koneksi ke database dev gagal. Pastikan container MySQL berjalan dan nilai koneksi di .env.local sudah benar (lihat CLAUDE.md §Database Dev).'
            : error.message
        }
        onCobaLagi={reset}
      />
    </div>
  )
}
