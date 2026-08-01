import 'server-only'

import { createHash, randomBytes } from 'node:crypto'

import { cookies, headers } from 'next/headers'
import { cache } from 'react'

import { eksekusi, kueri, kueriSatu } from './db'
import { ambilPengaturan } from './pengaturan'
import { adalahPeranValid, type PenggunaAktif } from './peran'

/**
 * Sesi login: pembuatan, pembacaan, pencabutan.
 *
 * Alasan bentuknya (token acak + hash di DB, dua tenggat, bukan JWT) ditulis
 * lengkap di `doc/sql/012_auth.sql`. Yang perlu diketahui saat membaca kode ini:
 *
 *   - Token asli **hanya pernah ada di cookie**. Yang tersimpan hashnya.
 *   - Cookie hanya bisa DITULIS dari server action / route handler, tidak saat
 *     merender. Karena itu `buatSesi()` & `akhiriSesi()` dipanggil dari
 *     `lib/aksi/auth.ts`, sedangkan `bacaSesi()` aman dipanggil saat render.
 *   - `bacaSesi()` di-`cache()` per permintaan. Tanpa itu layout, halaman, dan
 *     tiap server action akan menembak kueri yang sama berkali-kali.
 */

export const COOKIE_SESI = 'simt_sesi'

/**
 * Jarak minimal antar penulisan `terakhir_aktif_pada`.
 *
 * Timeout idle butuh kolom itu tetap segar, tapi memperbaruinya di SETIAP
 * permintaan berarti satu UPDATE untuk setiap gambar, prefetch, dan navigasi —
 * penulisan yang jauh lebih ramai daripada seluruh aplikasi lainnya digabung.
 * Satu menit cukup: ketelitian timeout 60 menit tidak berubah oleh geseran
 * satu menit.
 */
const JEDA_SENTUH_DETIK = 60

export interface SesiAktif {
  sesiId: number
  pengguna: PenggunaAktif
  /** Sandi diatur orang lain — akses ditahan sampai diganti (lihat `doc/sql/012`). */
  harusGantiSandi: boolean
  kedaluwarsaPada: Date
  terakhirAktifPada: Date
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function konteksPermintaan(): Promise<{ ip: string | null; userAgent: string | null }> {
  try {
    const h = await headers()
    const rantai = h.get('x-forwarded-for')
    const ip = rantai ? rantai.split(',')[0]!.trim().slice(0, 45) : (h.get('x-real-ip')?.slice(0, 45) ?? null)
    return { ip, userAgent: h.get('user-agent')?.slice(0, 255) ?? null }
  } catch {
    return { ip: null, userAgent: null }
  }
}

/**
 * Buat sesi baru + pasang cookie. Hanya boleh dipanggil dari server action.
 *
 * Cookie-nya `httpOnly` (JavaScript halaman tidak boleh membacanya — itu yang
 * membedakan pencurian sesi lewat XSS jadi mungkin atau tidak), `sameSite=lax`
 * (menutup CSRF untuk navigasi lintas situs tanpa merusak tautan masuk yang
 * wajar), dan `secure` di produksi saja — memaksanya di dev berarti cookie-nya
 * tidak pernah terpasang di `http://localhost`.
 */
export async function buatSesi(userId: number): Promise<string> {
  const p = await ambilPengaturan()
  const token = randomBytes(32).toString('base64url')
  const { ip, userAgent } = await konteksPermintaan()

  const { insertId } = await eksekusi(
    `INSERT INTO sesi (user_id, token_hash, ip_address, user_agent, kedaluwarsa_pada)
     VALUES (?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? HOUR))`,
    [userId, hashToken(token), ip, userAgent, p.sesiMaksimalJam],
  )

  const store = await cookies()
  store.set(COOKIE_SESI, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: p.sesiMaksimalJam * 3600,
  })

  return String(insertId)
}

/**
 * Sesi yang berlaku sekarang, atau `null`.
 *
 * Dua tenggat diperiksa **di dalam SQL yang sama** dengan pengambilan
 * penggunanya. Memeriksanya di JavaScript setelah barisnya diambil akan
 * memakai jam server aplikasi, sedangkan yang menulis `terakhir_aktif_pada`
 * adalah jam MySQL — dan dua jam yang berbeda beberapa detik akan menghasilkan
 * sesi yang kadang hidup kadang mati tanpa pola.
 */
export const bacaSesi = cache(async (): Promise<SesiAktif | null> => {
  let token: string | undefined
  try {
    token = (await cookies()).get(COOKIE_SESI)?.value
  } catch {
    return null
  }
  if (!token) return null

  const p = await ambilPengaturan()

  const r = await kueriSatu<Record<string, unknown>>(
    `SELECT s.id AS sesi_id, s.kedaluwarsa_pada, s.terakhir_aktif_pada,
            u.id, u.nama, u.username, u.email, u.harus_ganti_sandi,
            u.unit_organisasi_id, uo.nama_unit, r.nama_role,
            TIMESTAMPDIFF(SECOND, s.terakhir_aktif_pada, NOW()) AS diam_detik
     FROM sesi s
     JOIN users u ON u.id = s.user_id
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN unit_organisasi uo ON uo.id = u.unit_organisasi_id
     WHERE s.token_hash = ?
       AND s.dicabut_pada IS NULL
       AND s.kedaluwarsa_pada > NOW()
       AND s.terakhir_aktif_pada > DATE_SUB(NOW(), INTERVAL ? MINUTE)
       AND u.status_aktif = 1
     LIMIT 1`,
    [hashToken(token), p.sesiIdleMenit],
  )

  if (!r) return null

  const namaPeran = String(r.nama_role)
  if (!adalahPeranValid(namaPeran)) return null

  // Sentuh terakhir-aktif, tapi hemat. Kegagalannya diabaikan: gagal menulis
  // penanda aktivitas tidak boleh menendang pengguna yang sedang bekerja.
  if (Number(r.diam_detik ?? 0) >= JEDA_SENTUH_DETIK) {
    void eksekusi('UPDATE sesi SET terakhir_aktif_pada = NOW() WHERE id = ?', [
      Number(r.sesi_id),
    ]).catch(() => {})
  }

  return {
    sesiId: Number(r.sesi_id),
    harusGantiSandi: Number(r.harus_ganti_sandi ?? 0) === 1,
    kedaluwarsaPada: new Date(String(r.kedaluwarsa_pada)),
    terakhirAktifPada: new Date(String(r.terakhir_aktif_pada)),
    pengguna: {
      id: Number(r.id),
      nama: String(r.nama),
      username: String(r.username),
      email: String(r.email),
      peran: namaPeran,
      unitOrganisasiId: r.unit_organisasi_id === null ? null : Number(r.unit_organisasi_id),
      namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
    },
  }
})

/** Cabut sesi yang sedang dipakai + hapus cookie-nya. Hanya dari server action. */
export async function akhiriSesi(): Promise<void> {
  const store = await cookies()
  const token = store.get(COOKIE_SESI)?.value
  if (token) {
    await eksekusi(
      'UPDATE sesi SET dicabut_pada = NOW() WHERE token_hash = ? AND dicabut_pada IS NULL',
      [hashToken(token)],
    )
  }
  store.delete(COOKIE_SESI)
}

/**
 * Cabut seluruh sesi milik satu pengguna.
 *
 * Dipanggil pada tiga peristiwa, dan ketiganya penting:
 *   - sandi diganti (sesi lama mungkin milik orang yang tahu sandi lamanya),
 *   - akun dinonaktifkan Super Admin,
 *   - peran atau unit diubah (wewenang lama masih menempel di sesi yang jalan).
 */
export async function cabutSesiPengguna(userId: number, kecualiSesiId?: number): Promise<number> {
  const { affectedRows } = await eksekusi(
    `UPDATE sesi SET dicabut_pada = NOW()
     WHERE user_id = ? AND dicabut_pada IS NULL${kecualiSesiId ? ' AND id <> ?' : ''}`,
    kecualiSesiId ? [userId, kecualiSesiId] : [userId],
  )
  return affectedRows
}

export interface BarisSesi {
  id: number
  ipAddress: string | null
  userAgent: string | null
  terakhirAktifPada: Date
  kedaluwarsaPada: Date
  createdAt: Date
  iniSesiSaya: boolean
}

/** Sesi hidup milik satu pengguna — dipakai panel "perangkat aktif" di Profil Saya. */
export async function daftarSesiAktif(userId: number, sesiSaatIni: number): Promise<BarisSesi[]> {
  const p = await ambilPengaturan()
  const baris = await kueri<Record<string, unknown>>(
    `SELECT id, ip_address, user_agent, terakhir_aktif_pada, kedaluwarsa_pada, created_at
     FROM sesi
     WHERE user_id = ? AND dicabut_pada IS NULL AND kedaluwarsa_pada > NOW()
       AND terakhir_aktif_pada > DATE_SUB(NOW(), INTERVAL ? MINUTE)
     ORDER BY terakhir_aktif_pada DESC`,
    [userId, p.sesiIdleMenit],
  )
  return baris.map((r) => ({
    id: Number(r.id),
    ipAddress: r.ip_address === null ? null : String(r.ip_address),
    userAgent: r.user_agent === null ? null : String(r.user_agent),
    terakhirAktifPada: new Date(String(r.terakhir_aktif_pada)),
    kedaluwarsaPada: new Date(String(r.kedaluwarsa_pada)),
    createdAt: new Date(String(r.created_at)),
    iniSesiSaya: Number(r.id) === sesiSaatIni,
  }))
}

/**
 * Buang sesi yang sudah lewat tenggat dari tabel.
 *
 * Baris sesi mati tidak berbahaya (semua kueri sudah menyaringnya), tapi tabel
 * ini tumbuh setiap kali siapa pun masuk dan tidak pernah menyusut sendiri.
 * Dipanggil oportunistik saat login — tidak butuh cron untuk sesuatu sesepele
 * ini, dan login adalah satu-satunya saat tabelnya pasti tumbuh.
 */
export async function bersihkanSesiMati(simpanHari = 30): Promise<number> {
  const { affectedRows } = await eksekusi(
    `DELETE FROM sesi
     WHERE (kedaluwarsa_pada < DATE_SUB(NOW(), INTERVAL ? DAY))
        OR (dicabut_pada IS NOT NULL AND dicabut_pada < DATE_SUB(NOW(), INTERVAL ? DAY))`,
    [simpanHari, simpanHari],
  )
  return affectedRows
}
