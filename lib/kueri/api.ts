import 'server-only'

import { bacaScope, type ScopeAkses } from '../api/scope'
import { angka, angkaWajib, kueri, kueriSatu } from '../db'
import { tanggalIso } from '../param'

/**
 * Kueri halaman Integrasi API Eksternal (Fase 9, PRD §6.9).
 *
 * Satu aturan yang mengikat berkas ini: **`token_hash` tidak pernah masuk SELECT
 * mana pun.** Bukan karena hash SHA-256 berbahaya kalau bocor — ia tidak bisa
 * dibalik — tapi karena sekali ia ada di objek yang dikirim ke komponen, ia ikut
 * ke payload RSC yang terkirim ke browser, dan tidak ada yang akan menyadarinya
 * sebab halamannya tetap tampil benar. Alasan yang sama dipakai `lib/kueri/admin.ts`
 * untuk `password_hash`.
 *
 * Yang ditampilkan sebagai pengganti: label, status, tenggat, dan kapan terakhir
 * dipakai — yang memang dibutuhkan pengelola untuk membedakan satu token dari yang
 * lain dan memutuskan mana yang perlu dicabut.
 */

export interface BarisKlienApi {
  id: number
  namaInstansi: string
  kodeInstansi: string
  contactPerson: string | null
  email: string | null
  noMou: string | null
  status: 'AKTIF' | 'NONAKTIF' | 'PENDING'
  scope: ScopeAkses
  /** true bila kolom scope_akses ada isinya tapi tidak bisa ditafsirkan. */
  scopeTidakTerbaca: boolean
  jumlahTokenAktif: number
  jumlahTokenTotal: number
  permintaan7Hari: number
  permintaanDitolak7Hari: number
  terakhirDipakai: Date | null
  createdAt: Date
}

/**
 * Daftar klien + ringkasan pemakaiannya.
 *
 * Angka pemakaian 7 hari ikut diambil karena tanpa itu halaman ini hanya
 * mendaftar siapa yang **boleh**, bukan siapa yang **benar-benar memakai** — dan
 * klien yang tokennya aktif tapi tidak pernah dipanggil setahun adalah kredensial
 * menganggur yang layak dicabut.
 */
export async function ambilDaftarKlienApi(): Promise<BarisKlienApi[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT c.id, c.nama_instansi, c.kode_instansi, c.contact_person, c.email, c.no_mou,
            c.status, c.scope_akses, c.created_at,
            (SELECT COUNT(*) FROM api_token t
              WHERE t.api_client_id = c.id AND t.status = 'AKTIF'
                AND (t.expired_at IS NULL OR t.expired_at > NOW()))            AS token_aktif,
            (SELECT COUNT(*) FROM api_token t WHERE t.api_client_id = c.id)    AS token_total,
            (SELECT COUNT(*) FROM api_activity_log l
              WHERE l.api_client_id = c.id
                AND l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))           AS req_7h,
            (SELECT COUNT(*) FROM api_activity_log l
              WHERE l.api_client_id = c.id AND l.response_code >= 400
                AND l.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY))           AS tolak_7h,
            (SELECT MAX(t.last_used_at) FROM api_token t WHERE t.api_client_id = c.id) AS terakhir
       FROM api_client c
      ORDER BY FIELD(c.status, 'AKTIF', 'PENDING', 'NONAKTIF'), c.nama_instansi ASC`,
  )

  return baris.map((r) => {
    const scope = bacaScope(r.scope_akses)
    // Kolom yang ada isinya tapi menghasilkan scope nihil = bentuknya tidak
    // dikenali. Itu harus TERLIHAT di UI: kalau tidak, "klien ini tidak bisa apa
    // pun" terbaca sebagai kebijakan yang disengaja.
    const adaIsi =
      r.scope_akses !== null &&
      r.scope_akses !== undefined &&
      JSON.stringify(r.scope_akses) !== '{}' &&
      JSON.stringify(r.scope_akses) !== '""'
    return {
      id: angkaWajib(r.id as number),
      namaInstansi: String(r.nama_instansi),
      kodeInstansi: String(r.kode_instansi),
      contactPerson: r.contact_person === null ? null : String(r.contact_person),
      email: r.email === null ? null : String(r.email),
      noMou: r.no_mou === null ? null : String(r.no_mou),
      status: String(r.status) as BarisKlienApi['status'],
      scope,
      scopeTidakTerbaca: adaIsi && scope.endpoints.length === 0 && !scope.dataPersonal,
      jumlahTokenAktif: angkaWajib(r.token_aktif as number),
      jumlahTokenTotal: angkaWajib(r.token_total as number),
      permintaan7Hari: angkaWajib(r.req_7h as number),
      permintaanDitolak7Hari: angkaWajib(r.tolak_7h as number),
      terakhirDipakai: r.terakhir === null ? null : new Date(String(r.terakhir)),
      createdAt: new Date(String(r.created_at)),
    }
  })
}

export interface BarisTokenApi {
  id: number
  apiClientId: number
  kodeInstansi: string
  label: string | null
  status: 'AKTIF' | 'DICABUT'
  expiredAt: Date | null
  kedaluwarsa: boolean
  lastUsedAt: Date | null
  namaPenerbit: string | null
  createdAt: Date
}

export async function ambilDaftarTokenApi(apiClientId?: number): Promise<BarisTokenApi[]> {
  const syarat = apiClientId ? 'WHERE t.api_client_id = ?' : ''
  const baris = await kueri<Record<string, unknown>>(
    `SELECT t.id, t.api_client_id, c.kode_instansi, t.label, t.status, t.expired_at,
            (t.expired_at IS NOT NULL AND t.expired_at <= NOW()) AS kedaluwarsa,
            t.last_used_at, u.nama AS nama_penerbit, t.created_at
       FROM api_token t
       JOIN api_client c ON c.id = t.api_client_id
       LEFT JOIN users u ON u.id = t.created_by
       ${syarat}
      ORDER BY FIELD(t.status, 'AKTIF', 'DICABUT'), t.id DESC`,
    apiClientId ? [apiClientId] : [],
  )

  return baris.map((r) => ({
    id: angkaWajib(r.id as number),
    apiClientId: angkaWajib(r.api_client_id as number),
    kodeInstansi: String(r.kode_instansi),
    label: r.label === null ? null : String(r.label),
    status: String(r.status) as BarisTokenApi['status'],
    expiredAt: r.expired_at === null ? null : new Date(String(r.expired_at)),
    kedaluwarsa: Number(r.kedaluwarsa) === 1,
    lastUsedAt: r.last_used_at === null ? null : new Date(String(r.last_used_at)),
    namaPenerbit: r.nama_penerbit === null ? null : String(r.nama_penerbit),
    createdAt: new Date(String(r.created_at)),
  }))
}

// ---------------------------------------------------------------------------
// Log Aktivitas API
// ---------------------------------------------------------------------------

export interface FilterAktivitasApi {
  apiClientId?: number
  /** `sukses` = 2xx, `ditolak` = 4xx, `galat` = 5xx. */
  golongan?: 'sukses' | 'ditolak' | 'galat'
  endpoint?: string
  dari?: string
  sampai?: string
  halaman?: number
}

export interface BarisAktivitasApi {
  id: number
  kodeInstansi: string
  namaInstansi: string
  labelToken: string | null
  endpoint: string
  method: string
  responseCode: number
  responseTimeMs: number | null
  ipAddress: string | null
  createdAt: Date
}

export const UKURAN_HALAMAN_AKTIVITAS = 50

function syaratAktivitas(f: FilterAktivitasApi): { where: string; params: unknown[] } {
  const syarat: string[] = []
  const params: unknown[] = []

  if (f.apiClientId) {
    syarat.push('l.api_client_id = ?')
    params.push(f.apiClientId)
  }
  if (f.golongan === 'sukses') syarat.push('l.response_code < 400')
  if (f.golongan === 'ditolak') syarat.push('l.response_code >= 400 AND l.response_code < 500')
  if (f.golongan === 'galat') syarat.push('l.response_code >= 500')
  if (f.endpoint) {
    syarat.push('l.endpoint LIKE ?')
    params.push(`%${f.endpoint.slice(0, 120)}%`)
  }
  // Tanggal divalidasi di sini juga, bukan hanya di halaman — pelajaran Audit Log
  // Viewer: teks bebas yang sampai ke pembanding DATETIME jadi galat MySQL.
  const dari = tanggalIso(f.dari)
  const sampai = tanggalIso(f.sampai)
  if (dari) {
    syarat.push('l.created_at >= ?')
    params.push(`${dari} 00:00:00`)
  }
  if (sampai) {
    syarat.push('l.created_at <= ?')
    params.push(`${sampai} 23:59:59`)
  }

  return { where: syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : '', params }
}

export async function ambilAktivitasApi(f: FilterAktivitasApi = {}): Promise<{
  baris: BarisAktivitasApi[]
  total: number
  halaman: number
}> {
  const halaman = Number.isSafeInteger(f.halaman) && (f.halaman ?? 0) > 0 ? f.halaman! : 1
  const { where, params } = syaratAktivitas(f)

  const total = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM api_activity_log l ${where}`,
    params,
  )

  const baris = await kueri<Record<string, unknown>>(
    `SELECT l.id, c.kode_instansi, c.nama_instansi, t.label AS label_token,
            l.endpoint, l.method, l.response_code, l.response_time_ms, l.ip_address, l.created_at
       FROM api_activity_log l
       JOIN api_client c ON c.id = l.api_client_id
       LEFT JOIN api_token t ON t.id = l.api_token_id
       ${where}
      ORDER BY l.id DESC
      LIMIT ? OFFSET ?`,
    [...params, UKURAN_HALAMAN_AKTIVITAS, (halaman - 1) * UKURAN_HALAMAN_AKTIVITAS],
  )

  return {
    baris: baris.map((r) => ({
      id: angkaWajib(r.id as number),
      kodeInstansi: String(r.kode_instansi),
      namaInstansi: String(r.nama_instansi),
      labelToken: r.label_token === null ? null : String(r.label_token),
      endpoint: String(r.endpoint),
      method: String(r.method),
      responseCode: angkaWajib(r.response_code as number),
      responseTimeMs: angka(r.response_time_ms as number | null),
      ipAddress: r.ip_address === null ? null : String(r.ip_address),
      createdAt: new Date(String(r.created_at)),
    })),
    total: angkaWajib(total?.n as number),
    halaman,
  }
}

export interface RingkasAktivitasApi {
  total24Jam: number
  ditolak24Jam: number
  galat24Jam: number
  rataMs24Jam: number | null
  klienAktif24Jam: number
  endpointTerbanyak: Array<{ endpoint: string; jumlah: number }>
}

/**
 * Angka pembuka halaman log.
 *
 * `ditolak` dipisah dari `galat` karena keduanya berarti hal yang sangat berbeda:
 * 4xx adalah **klien** yang salah (token mati, scope tidak mencakup, rate limit) —
 * itu sistem bekerja benar. 5xx adalah **kita** yang salah. Menggabungkannya jadi
 * satu angka "error" membuat lonjakan penolakan yang wajar terlihat seperti
 * kerusakan, dan kerusakan yang sesungguhnya tersamar di antaranya.
 */
export async function ambilRingkasAktivitasApi(): Promise<RingkasAktivitasApi> {
  const [r] = await kueri<Record<string, unknown>>(
    `SELECT COUNT(*) AS total,
            SUM(response_code >= 400 AND response_code < 500) AS ditolak,
            SUM(response_code >= 500) AS galat,
            ROUND(AVG(response_time_ms)) AS rata_ms,
            COUNT(DISTINCT api_client_id) AS klien
       FROM api_activity_log
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`,
  )

  const top = await kueri<Record<string, unknown>>(
    `SELECT endpoint, COUNT(*) AS jumlah
       FROM api_activity_log
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY endpoint
      ORDER BY jumlah DESC
      LIMIT 5`,
  )

  return {
    total24Jam: angkaWajib(r?.total as number),
    ditolak24Jam: angkaWajib(r?.ditolak as number),
    galat24Jam: angkaWajib(r?.galat as number),
    rataMs24Jam: angka(r?.rata_ms as number | null),
    klienAktif24Jam: angkaWajib(r?.klien as number),
    endpointTerbanyak: top.map((t) => ({
      endpoint: String(t.endpoint),
      jumlah: angkaWajib(t.jumlah as number),
    })),
  }
}
