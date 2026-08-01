import 'server-only'

import { redirect } from 'next/navigation'

import { punyaPeran, type Peran, type PenggunaAktif } from './peran'
import { bacaSesi, type SesiAktif } from './sesi'

/**
 * SATU-SATUNYA titik akses identitas pengguna.
 *
 * Fase 0–6 memakai cookie dev `simt_dev_user` + pengalih peran di navbar; Fase 7
 * menggantinya dengan sesi asli. Janji phase.md §5.6 ditepati: **hanya isi
 * berkas ini yang berubah**, karena sejak awal tidak ada komponen yang membaca
 * cookie sendiri dan setiap mutasi sudah lewat `assertPeran()`.
 *
 * Pengalih peran dev dihapus, bukan dimatikan di balik flag. Dua sumber
 * identitas yang hidup berdampingan adalah dua sumber identitas yang bisa
 * berselisih — dan yang satu memang dirancang untuk melewati sandi. Menguji
 * per peran sekarang dilakukan dengan benar-benar masuk sebagai peran itu
 * (lihat `e2e/_masuk.mjs`), yang sekalian menguji jalur autentikasinya juga.
 */

export const RUTE_MASUK = '/masuk'
export const RUTE_GANTI_SANDI = '/ganti-sandi'

export async function getCurrentUser(): Promise<PenggunaAktif | null> {
  const sesi = await bacaSesi()
  return sesi?.pengguna ?? null
}

/** Sesi lengkap (id sesi, tenggat, penanda wajib ganti sandi). Untuk Profil Saya & app shell. */
export async function sesiSaatIni(): Promise<SesiAktif | null> {
  return bacaSesi()
}

/**
 * Gerbang halaman: pastikan ada sesi, kalau tidak alihkan ke halaman masuk.
 *
 * `next` dibawa serta supaya pengguna kembali ke halaman yang ia tuju setelah
 * masuk — kehilangan tujuan setelah timeout adalah cara tercepat membuat orang
 * berhenti memakai aplikasi yang dibuka sepanjang hari.
 */
export async function wajibMasuk(tujuan?: string): Promise<SesiAktif> {
  const sesi = await bacaSesi()
  if (!sesi) {
    const q = tujuan && tujuan !== '/' ? `?next=${encodeURIComponent(tujuan)}` : ''
    redirect(`${RUTE_MASUK}${q}`)
  }
  return sesi
}

/**
 * Guard untuk server action & route handler. Sudah aktif sejak Fase 0 memakai
 * user dev, jadi tidak ada "tambal RBAC" di Fase 7 (phase.md §5.6) — yang
 * berganti hanya dari mana identitasnya datang.
 */
export async function assertPeran(diizinkan: readonly Peran[]): Promise<PenggunaAktif> {
  const pengguna = await getCurrentUser()
  if (!pengguna) {
    throw new Error('Tidak ada pengguna aktif — akses ditolak')
  }
  if (!punyaPeran(pengguna, diizinkan)) {
    throw new Error(
      `Peran "${pengguna.peran}" tidak berwenang. Dibutuhkan salah satu: ${diizinkan.join(', ')}`,
    )
  }
  return pengguna
}
