import 'server-only'

import { kueri, kueriSatu } from '../db'
import type { Peran } from '../peran'

/**
 * Kueri halaman Administrasi Sistem (Fase 7): Manajemen Pengguna & Peran,
 * Audit Log Viewer.
 *
 * Dua hal yang membedakan berkas ini dari kueri lain:
 *
 * 1. **`password_hash` tidak pernah masuk ke SELECT mana pun di sini.** Bukan
 *    karena hash bcrypt berbahaya kalau bocor, tapi karena sekali ia ada di
 *    objek yang dikirim ke komponen, ia akan ikut ke payload RSC yang terkirim
 *    ke browser — dan tidak ada yang akan menyadarinya, sebab halamannya tetap
 *    tampil benar.
 * 2. **Audit log dibaca berpaginasi dengan penyaring, bukan diambil semua.**
 *    `audit_log` adalah satu-satunya tabel yang hanya bertambah dan tidak
 *    pernah dipangkas; kueri tanpa LIMIT di sini akan berjalan baik selama
 *    sebulan lalu menjatuhkan halaman.
 */

// ---------------------------------------------------------------------------
// Manajemen Pengguna & Peran
// ---------------------------------------------------------------------------

export interface BarisPengguna {
  id: number
  nama: string
  username: string
  email: string
  peran: string
  roleId: number
  unitOrganisasiId: number | null
  namaUnit: string | null
  statusAktif: boolean
  harusGantiSandi: boolean
  lastLoginAt: Date | null
  passwordDiubahPada: Date | null
  terkunci: boolean
  gagalMasukBeruntun: number
  /** Sesi yang masih hidup. Menonaktifkan akun berarti memutus sebanyak ini. */
  sesiAktif: number
}

export interface FilterPengguna {
  cari?: string
  roleId?: number
  status?: 'aktif' | 'nonaktif'
}

export async function ambilDaftarPengguna(f: FilterPengguna = {}): Promise<BarisPengguna[]> {
  const syarat: string[] = []
  const params: unknown[] = []

  if (f.cari && f.cari.trim() !== '') {
    syarat.push('(u.nama LIKE ? OR u.username LIKE ? OR u.email LIKE ?)')
    const pola = `%${f.cari.trim()}%`
    params.push(pola, pola, pola)
  }
  if (f.roleId) {
    syarat.push('u.role_id = ?')
    params.push(f.roleId)
  }
  if (f.status) {
    syarat.push('u.status_aktif = ?')
    params.push(f.status === 'aktif' ? 1 : 0)
  }

  const where = syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : ''

  const baris = await kueri<Record<string, unknown>>(
    `SELECT u.id, u.nama, u.username, u.email, u.role_id, r.nama_role,
            u.unit_organisasi_id, uo.nama_unit,
            u.status_aktif, u.harus_ganti_sandi, u.last_login_at, u.password_diubah_pada,
            u.gagal_masuk_beruntun,
            (u.terkunci_sampai IS NOT NULL AND u.terkunci_sampai > NOW()) AS terkunci,
            (SELECT COUNT(*) FROM sesi s
              WHERE s.user_id = u.id AND s.dicabut_pada IS NULL
                AND s.kedaluwarsa_pada > NOW())                            AS sesi_aktif
     FROM users u
     JOIN roles r ON r.id = u.role_id
     LEFT JOIN unit_organisasi uo ON uo.id = u.unit_organisasi_id
     ${where}
     ORDER BY u.status_aktif DESC, r.id, u.nama`,
    params,
  )

  return baris.map((r) => ({
    id: Number(r.id),
    nama: String(r.nama),
    username: String(r.username),
    email: String(r.email),
    peran: String(r.nama_role),
    roleId: Number(r.role_id),
    unitOrganisasiId: r.unit_organisasi_id === null ? null : Number(r.unit_organisasi_id),
    namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
    statusAktif: Number(r.status_aktif) === 1,
    harusGantiSandi: Number(r.harus_ganti_sandi) === 1,
    lastLoginAt: r.last_login_at === null ? null : new Date(String(r.last_login_at)),
    passwordDiubahPada:
      r.password_diubah_pada === null ? null : new Date(String(r.password_diubah_pada)),
    terkunci: Number(r.terkunci) === 1,
    gagalMasukBeruntun: Number(r.gagal_masuk_beruntun),
    sesiAktif: Number(r.sesi_aktif),
  }))
}

export interface OpsiPeran {
  id: number
  nama: Peran | string
  deskripsi: string | null
  jumlahPengguna: number
}

export async function ambilOpsiPeran(): Promise<OpsiPeran[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT r.id, r.nama_role, r.deskripsi,
            (SELECT COUNT(*) FROM users u WHERE u.role_id = r.id AND u.status_aktif = 1) AS n
     FROM roles r ORDER BY r.id`,
  )
  return baris.map((r) => ({
    id: Number(r.id),
    nama: String(r.nama_role),
    deskripsi: r.deskripsi === null ? null : String(r.deskripsi),
    jumlahPengguna: Number(r.n),
  }))
}

export interface OpsiUnitRingkas {
  id: number
  label: string
}

/** Unit untuk pemilih di form pengguna — diberi awalan agar hierarkinya terbaca. */
export async function ambilOpsiUnitRingkas(): Promise<OpsiUnitRingkas[]> {
  const baris = await kueri<Record<string, unknown>>(`
    WITH RECURSIVE pohon AS (
      SELECT id, nama_unit, parent_id, 0 AS kedalaman,
             CAST(LPAD(id, 10, '0') AS CHAR(600)) AS jalur
      FROM unit_organisasi WHERE parent_id IS NULL
      UNION ALL
      SELECT u.id, u.nama_unit, u.parent_id, p.kedalaman + 1,
             CONCAT(p.jalur, '/', LPAD(u.id, 10, '0'))
      FROM unit_organisasi u JOIN pohon p ON u.parent_id = p.id
    )
    SELECT id, nama_unit, kedalaman FROM pohon ORDER BY jalur
  `)
  return baris.map((r) => ({
    id: Number(r.id),
    label: `${'— '.repeat(Number(r.kedalaman))}${String(r.nama_unit)}`,
  }))
}

export interface PermintaanReset {
  id: number
  email: string
  userId: number | null
  namaPengguna: string | null
  usernamePengguna: string | null
  ipAddress: string | null
  createdAt: Date
}

/**
 * Permintaan Lupa Password yang belum ditangani.
 *
 * Ini **pekerjaan**, bukan sekadar log: selama belum ada transport surel,
 * satu-satunya yang bisa menyelesaikan permintaan ini adalah manusia. Karena
 * itu ia muncul di halaman Manajemen Pengguna, bukan disembunyikan di audit
 * log — permintaan yang tidak terlihat adalah permintaan yang tidak dikerjakan.
 */
export async function ambilPermintaanReset(): Promise<PermintaanReset[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT p.id, p.email, p.user_id, u.nama, u.username, p.ip_address, p.created_at
     FROM permintaan_reset_password p
     LEFT JOIN users u ON u.id = p.user_id
     WHERE p.ditangani_pada IS NULL
     ORDER BY p.id DESC
     LIMIT 50`,
  )
  return baris.map((r) => ({
    id: Number(r.id),
    email: String(r.email),
    userId: r.user_id === null ? null : Number(r.user_id),
    namaPengguna: r.nama === null ? null : String(r.nama),
    usernamePengguna: r.username === null ? null : String(r.username),
    ipAddress: r.ip_address === null ? null : String(r.ip_address),
    createdAt: new Date(String(r.created_at)),
  }))
}

// ---------------------------------------------------------------------------
// Audit Log Viewer
// ---------------------------------------------------------------------------

export interface FilterAudit {
  userId?: number
  entitas?: string
  aksi?: string
  dari?: string
  sampai?: string
  cari?: string
  halaman?: number
  perHalaman?: number
}

export interface BarisAuditTampil {
  id: number
  userId: number | null
  namaPengguna: string | null
  peranPengguna: string | null
  aksi: string
  entitas: string
  entitasId: number | null
  dataSebelum: unknown
  dataSesudah: unknown
  ipAddress: string | null
  createdAt: Date
}

export interface HasilAudit {
  baris: BarisAuditTampil[]
  total: number
  halaman: number
  perHalaman: number
}

function syaratAudit(f: FilterAudit): { where: string; params: unknown[] } {
  const syarat: string[] = []
  const params: unknown[] = []

  if (f.userId) {
    syarat.push('a.user_id = ?')
    params.push(f.userId)
  }
  if (f.entitas) {
    syarat.push('a.entitas = ?')
    params.push(f.entitas)
  }
  if (f.aksi) {
    syarat.push('a.aksi = ?')
    params.push(f.aksi)
  }
  if (f.dari) {
    syarat.push('a.created_at >= ?')
    params.push(`${f.dari} 00:00:00`)
  }
  if (f.sampai) {
    syarat.push('a.created_at <= ?')
    params.push(`${f.sampai} 23:59:59`)
  }
  if (f.cari && f.cari.trim() !== '') {
    // Pencarian menyentuh isi JSON sebelum/sesudah. Sengaja LIKE dan bukan
    // JSON_SEARCH: yang dicari pemeriksa biasanya potongan nama atau NIP yang
    // bisa muncul di kunci mana pun, jadi mencocokkan seluruh dokumen justru
    // yang benar. Dibatasi rentang tanggal supaya tidak memindai seluruh tabel.
    syarat.push('(a.entitas LIKE ? OR CAST(a.data_sebelum AS CHAR) LIKE ? OR CAST(a.data_sesudah AS CHAR) LIKE ?)')
    const pola = `%${f.cari.trim()}%`
    params.push(pola, pola, pola)
  }

  return { where: syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : '', params }
}

export async function ambilAuditLog(f: FilterAudit = {}): Promise<HasilAudit> {
  const perHalaman = Math.min(Math.max(f.perHalaman ?? 25, 5), 100)
  const halaman = Math.max(f.halaman ?? 1, 1)
  const { where, params } = syaratAudit(f)

  const total = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM audit_log a ${where}`,
    params,
  )

  const baris = await kueri<Record<string, unknown>>(
    `SELECT a.id, a.user_id, u.nama AS nama_pengguna, r.nama_role,
            a.aksi, a.entitas, a.entitas_id, a.data_sebelum, a.data_sesudah,
            a.ip_address, a.created_at
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.user_id
     LEFT JOIN roles r ON r.id = u.role_id
     ${where}
     ORDER BY a.id DESC
     LIMIT ? OFFSET ?`,
    [...params, perHalaman, (halaman - 1) * perHalaman],
  )

  return {
    baris: baris.map((r) => ({
      id: Number(r.id),
      userId: r.user_id === null ? null : Number(r.user_id),
      namaPengguna: r.nama_pengguna === null ? null : String(r.nama_pengguna),
      peranPengguna: r.nama_role === null ? null : String(r.nama_role),
      aksi: String(r.aksi),
      entitas: String(r.entitas),
      entitasId: r.entitas_id === null ? null : Number(r.entitas_id),
      dataSebelum: uraiJson(r.data_sebelum),
      dataSesudah: uraiJson(r.data_sesudah),
      ipAddress: r.ip_address === null ? null : String(r.ip_address),
      createdAt: new Date(String(r.created_at)),
    })),
    total: Number(total?.n ?? 0),
    halaman,
    perHalaman,
  }
}

export interface OpsiAudit {
  entitas: Array<{ nilai: string; jumlah: number }>
  aksi: Array<{ nilai: string; jumlah: number }>
  pengguna: Array<{ id: number; nama: string; jumlah: number }>
  rentang: { paling_lama: Date | null; paling_baru: Date | null }
}

/**
 * Isi pilihan penyaring — diturunkan dari isi tabel, bukan dari daftar tetap
 * di kode. Entitas & aksi bertambah setiap kali ada modul baru; daftar yang
 * ditulis tangan akan ketinggalan tanpa ada yang menyadarinya, dan pemeriksa
 * akan menyimpulkan modul itu tidak pernah menulis apa pun.
 */
export async function ambilOpsiAudit(): Promise<OpsiAudit> {
  const [entitas, aksi, pengguna, rentang] = await Promise.all([
    kueri<Record<string, unknown>>(
      'SELECT entitas AS nilai, COUNT(*) AS n FROM audit_log GROUP BY entitas ORDER BY entitas',
    ),
    kueri<Record<string, unknown>>(
      'SELECT aksi AS nilai, COUNT(*) AS n FROM audit_log GROUP BY aksi ORDER BY aksi',
    ),
    kueri<Record<string, unknown>>(
      `SELECT a.user_id AS id, u.nama, COUNT(*) AS n
       FROM audit_log a JOIN users u ON u.id = a.user_id
       GROUP BY a.user_id, u.nama ORDER BY u.nama`,
    ),
    kueriSatu<Record<string, unknown>>(
      'SELECT MIN(created_at) AS paling_lama, MAX(created_at) AS paling_baru FROM audit_log',
    ),
  ])

  return {
    entitas: entitas.map((r) => ({ nilai: String(r.nilai), jumlah: Number(r.n) })),
    aksi: aksi.map((r) => ({ nilai: String(r.nilai), jumlah: Number(r.n) })),
    pengguna: pengguna.map((r) => ({
      id: Number(r.id),
      nama: String(r.nama),
      jumlah: Number(r.n),
    })),
    rentang: {
      paling_lama: rentang?.paling_lama ? new Date(String(rentang.paling_lama)) : null,
      paling_baru: rentang?.paling_baru ? new Date(String(rentang.paling_baru)) : null,
    },
  }
}

/** Kolom JSON MySQL bisa datang sebagai objek ATAU string, tergantung driver. */
function uraiJson(nilai: unknown): unknown {
  if (nilai === null || nilai === undefined) return null
  if (typeof nilai !== 'string') return nilai
  try {
    return JSON.parse(nilai)
  } catch {
    return nilai
  }
}
