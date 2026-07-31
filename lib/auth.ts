import 'server-only'

import { eq } from 'drizzle-orm'
import { cookies } from 'next/headers'

import { db, roles, unitOrganisasi, users } from './db'
import { adalahPeranValid, punyaPeran, type Peran, type PenggunaAktif } from './peran'

/**
 * SATU-SATUNYA titik akses identitas pengguna.
 *
 * Fase 0–6: belum ada auth. Identitas diambil dari cookie dev `simt_dev_user`
 * yang diset oleh Dev Role Switcher di navbar, dengan fallback ke Super Admin.
 * Fase 7: isi `getCurrentUser()` diganti sesi asli — **tidak ada komponen lain
 * yang perlu berubah**, karena tidak ada yang membaca cookie langsung
 * (phase.md §5.6).
 */

export const COOKIE_PENGGUNA_DEV = 'simt_dev_user'

/** Dipakai kalau cookie dev belum diset. */
const ID_PENGGUNA_BAWAAN = 1

export function devRoleSwitchAktif(): boolean {
  return process.env.NEXT_PUBLIC_DEV_ROLE_SWITCH === '1'
}

async function ambilPengguna(id: number): Promise<PenggunaAktif | null> {
  const baris = await db
    .select({
      id: users.id,
      nama: users.nama,
      username: users.username,
      email: users.email,
      namaPeran: roles.namaRole,
      unitOrganisasiId: users.unitOrganisasiId,
      namaUnit: unitOrganisasi.namaUnit,
      statusAktif: users.statusAktif,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .leftJoin(unitOrganisasi, eq(unitOrganisasi.id, users.unitOrganisasiId))
    .where(eq(users.id, id))
    .limit(1)

  const u = baris[0]
  if (!u || u.statusAktif === 0) return null
  if (!adalahPeranValid(u.namaPeran)) return null

  return {
    id: u.id,
    nama: u.nama,
    username: u.username,
    email: u.email,
    peran: u.namaPeran,
    unitOrganisasiId: u.unitOrganisasiId ?? null,
    namaUnit: u.namaUnit ?? null,
  }
}

export async function getCurrentUser(): Promise<PenggunaAktif | null> {
  let id = ID_PENGGUNA_BAWAAN

  if (devRoleSwitchAktif()) {
    const store = await cookies()
    const dariCookie = Number(store.get(COOKIE_PENGGUNA_DEV)?.value)
    if (Number.isInteger(dariCookie) && dariCookie > 0) id = dariCookie
  }

  const pengguna = await ambilPengguna(id)
  if (pengguna) return pengguna

  // Cookie menunjuk user yang sudah tidak ada/nonaktif → jatuh ke bawaan.
  return id === ID_PENGGUNA_BAWAAN ? null : ambilPengguna(ID_PENGGUNA_BAWAAN)
}

/**
 * Guard untuk server action & route handler. Sudah aktif sejak Fase 0 memakai
 * user dev, jadi tidak ada "tambal RBAC" di Fase 7 (phase.md §5.6).
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

/** Daftar akun untuk Dev Role Switcher. Kosong kalau flag-nya mati. */
export async function daftarPenggunaDev(): Promise<PenggunaAktif[]> {
  if (!devRoleSwitchAktif()) return []

  const baris = await db
    .select({
      id: users.id,
      nama: users.nama,
      username: users.username,
      email: users.email,
      namaPeran: roles.namaRole,
      unitOrganisasiId: users.unitOrganisasiId,
      namaUnit: unitOrganisasi.namaUnit,
    })
    .from(users)
    .innerJoin(roles, eq(roles.id, users.roleId))
    .leftJoin(unitOrganisasi, eq(unitOrganisasi.id, users.unitOrganisasiId))
    .where(eq(users.statusAktif, 1))
    .orderBy(users.roleId, users.nama)

  return baris.filter((u) => adalahPeranValid(u.namaPeran)).map((u) => ({
    id: u.id,
    nama: u.nama,
    username: u.username,
    email: u.email,
    peran: u.namaPeran as Peran,
    unitOrganisasiId: u.unitOrganisasiId ?? null,
    namaUnit: u.namaUnit ?? null,
  }))
}
