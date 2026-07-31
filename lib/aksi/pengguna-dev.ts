'use server'

import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'

import { COOKIE_PENGGUNA_DEV, devRoleSwitchAktif } from '../auth'

/**
 * Ganti pengguna aktif untuk keperluan pembangunan UI bergantung-peran sebelum
 * auth ada. WAJIB tidak berfungsi kalau flag dev mati (phase.md §5.6) —
 * pemeriksaannya di server, bukan cuma menyembunyikan tombol di UI.
 */
export async function gantiPenggunaDev(penggunaId: number): Promise<void> {
  if (!devRoleSwitchAktif()) {
    throw new Error('Dev role switcher tidak aktif di environment ini')
  }
  if (!Number.isInteger(penggunaId) || penggunaId <= 0) {
    throw new Error('ID pengguna tidak valid')
  }

  const store = await cookies()
  store.set(COOKIE_PENGGUNA_DEV, String(penggunaId), {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  revalidatePath('/', 'layout')
}
