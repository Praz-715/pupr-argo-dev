/**
 * Peran pengguna internal — cocok persis dengan `roles.nama_role` di DB dan
 * tabel peran di doc/PRD.md §3.
 *
 * Modul ini BEBAS dependensi server supaya aman diimpor komponen klien.
 * Logika sesi ada di `lib/auth.ts` (server-only).
 */

export const SEMUA_PERAN = [
  'Super Admin',
  'Admin Talenta',
  'Pengelola Unit',
  'Pimpinan',
  'Viewer',
] as const

export type Peran = (typeof SEMUA_PERAN)[number]

export interface PenggunaAktif {
  id: number
  nama: string
  username: string
  email: string
  peran: Peran
  unitOrganisasiId: number | null
  namaUnit: string | null
}

export const DESKRIPSI_PERAN: Record<Peran, string> = {
  'Super Admin': 'Tim IT DJBK — kelola pengguna, master data, klien & token API, audit log',
  'Admin Talenta': 'Bagian Kepegawaian & Umum — rubrik, talent pool, verifikasi nominasi, laporan',
  'Pengelola Unit': 'Staf kepegawaian unit — input & validasi data unitnya, ajukan nominasi',
  Pimpinan: 'Dirjen, Sesditjen, Para Direktur — dashboard, profil talenta, persetujuan akhir',
  Viewer: 'Pembina kebijakan — akses baca terbatas ke dashboard & laporan',
}

/** Peran yang datanya dibatasi ke unit sendiri (dipakai penuh di Fase 7). */
export const PERAN_TERBATAS_UNIT: readonly Peran[] = ['Pengelola Unit']

export function punyaPeran(
  pengguna: PenggunaAktif | null,
  diizinkan: readonly Peran[],
): boolean {
  if (!pengguna) return false
  return diizinkan.includes(pengguna.peran)
}

export function adalahPeranValid(nilai: string): nilai is Peran {
  return (SEMUA_PERAN as readonly string[]).includes(nilai)
}
