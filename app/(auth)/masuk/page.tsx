import { redirect } from 'next/navigation'

import { bacaSesi } from '@/lib/sesi'
import { FormMasuk } from './_komponen/form-masuk'

export const metadata = { title: 'Masuk' }

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Halaman Masuk (PRD §6.1).
 *
 * Middleware sudah memantulkan pemilik cookie ke dashboard, tapi cookie ADA
 * tidak sama dengan sesi HIDUP — dan hanya di sini (bukan di edge) sesi bisa
 * benar-benar diperiksa. Pemeriksaan kedua ini yang mencegah pengguna yang
 * sudah masuk melihat formulir masuk lagi setelah menekan tombol back.
 */
export default async function MasukPage({ searchParams }: { searchParams: ParamHalaman }) {
  const sp = await searchParams
  const sesi = await bacaSesi()

  if (sesi) {
    // Sesi hidup + wajib ganti sandi → jangan pulangkan ke dashboard, karena
    // app shell akan langsung memantulkannya kembali ke sini.
    redirect(sesi.harusGantiSandi ? '/ganti-sandi' : '/')
  }

  return <FormMasuk next={sp.next ?? null} baruKeluar={sp.keluar === '1'} />
}
