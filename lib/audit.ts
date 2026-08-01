import 'server-only'

import { headers } from 'next/headers'

import { assertPeran } from './auth'
import { kueri, kueriSatu } from './db'
import type { Peran } from './peran'

/**
 * Jejak audit untuk setiap perubahan data penting (PRD §8 "Auditability").
 *
 * **Bentuknya sengaja bukan `catatAudit()` yang dipanggil manual.** Fungsi audit
 * yang berdiri sendiri akan terlupakan justru pada mutasi yang paling perlu
 * dicatat — biasanya yang ditulis buru-buru. Yang diekspor adalah
 * `jalankanMutasi()`: satu-satunya jalan menulis, dan ia **selalu** menulis
 * jejaknya. Kalau ada mutasi tanpa audit, itu berarti seseorang melewati helper
 * ini, dan itu ketahuan dari `grep` — bukan tersembunyi di dalam sepuluh baris
 * yang kelihatan wajar.
 *
 * Yang dicatat: siapa, kapan, aksi apa, entitas apa, dan **isi sebelum vs
 * sesudah**. Tanpa keadaan sebelum, log audit cuma memberi tahu bahwa sesuatu
 * berubah — bukan berubah dari apa, yang justru pertanyaan pemeriksa.
 */

export type AksiAudit =
  | 'BUAT'
  | 'UBAH'
  | 'HAPUS'
  | 'UBAH_STATUS'
  | 'IMPOR'
  | 'RECOMPUTE'
  // Peristiwa autentikasi (Fase 7) — lihat `catatPeristiwaAuth()` di bawah.
  | 'MASUK'
  | 'MASUK_GAGAL'
  | 'KELUAR'
  | 'SANDI_DIGANTI'
  | 'AKUN_TERKUNCI'
  | 'RESET_DIMINTA'

export interface KonteksMutasi<T> {
  /** Nama tabel/entitas seperti di ERD — snake_case. */
  entitas: string
  aksi: AksiAudit
  /** Peran yang boleh menjalankan mutasi ini. Diperiksa di server, bukan di UI. */
  peranDiizinkan: readonly Peran[]
  /**
   * Ambil keadaan SEBELUM mutasi. Dijalankan di dalam transaksi logis yang sama
   * dengan mutasinya, sebelum apa pun ditulis.
   */
  sebelum?: () => Promise<T | null>
  /** Jalankan mutasinya. Mengembalikan id entitas yang tersentuh. */
  jalankan: () => Promise<{ entitasId: number | null; sesudah: T | null }>
}

/**
 * Jalankan mutasi + tulis jejak auditnya. Satu-satunya pintu tulis.
 *
 * Urutannya penting: **periksa peran dulu**, baru baca keadaan sebelum, baru
 * tulis. Membaca dulu berarti pengguna tanpa wewenang tetap bisa memancing isi
 * baris lewat pesan error.
 */
export async function jalankanMutasi<T>(
  ctx: KonteksMutasi<T>,
): Promise<{ entitasId: number | null; sesudah: T | null }> {
  const pengguna = await assertPeran(ctx.peranDiizinkan)

  const sebelum = ctx.sebelum ? await ctx.sebelum() : null
  const hasil = await ctx.jalankan()

  await tulisAudit({
    userId: pengguna.id,
    aksi: ctx.aksi,
    entitas: ctx.entitas,
    entitasId: hasil.entitasId,
    sebelum,
    sesudah: hasil.sesudah,
  })

  return hasil
}

/**
 * Pintu tulis KEDUA — khusus peristiwa autentikasi.
 *
 * `jalankanMutasi()` memanggil `assertPeran()`, yang menuntut ada pengguna yang
 * sudah masuk. Peristiwa yang **terjadi sebelum** ada pengguna — percobaan
 * masuk, masuk gagal, permintaan reset sandi — menurut definisi tidak bisa
 * lewat sana. Ketimbang melonggarkan `jalankanMutasi()` (yang akan membuka
 * jalan bagi mutasi biasa untuk melewati pemeriksaan peran), peristiwa auth
 * diberi pintu sendiri yang **sempit dan bernama jelas**, sehingga
 * `grep 'jalankanMutasi\|catatPeristiwaAuth'` tetap menemukan seluruh jalur
 * tulis ke `audit_log`.
 *
 * Yang TIDAK boleh masuk ke sini: apa pun yang mengubah data domain. Fungsi ini
 * tidak memeriksa wewenang, jadi ia hanya aman untuk peristiwa yang wewenangnya
 * memang belum ada.
 */
export async function catatPeristiwaAuth(a: {
  userId: number | null
  aksi: Extract<
    AksiAudit,
    'MASUK' | 'MASUK_GAGAL' | 'KELUAR' | 'SANDI_DIGANTI' | 'AKUN_TERKUNCI' | 'RESET_DIMINTA'
  >
  /** Konteks secukupnya. **Jangan pernah** memuat sandi, token, atau hash. */
  detail?: Record<string, unknown>
}): Promise<void> {
  await tulisAudit({
    userId: a.userId,
    aksi: a.aksi,
    entitas: 'users',
    entitasId: a.userId,
    sebelum: null,
    sesudah: a.detail ?? null,
  })
}

async function tulisAudit(a: {
  /** NULL untuk peristiwa tanpa pengguna dikenali (mis. masuk gagal, permintaan reset). */
  userId: number | null
  aksi: AksiAudit
  entitas: string
  entitasId: number | null
  sebelum: unknown
  sesudah: unknown
}): Promise<void> {
  // Gagal menulis audit TIDAK boleh membatalkan mutasi yang sudah berhasil —
  // itu akan meninggalkan keadaan setengah jalan yang lebih buruk daripada
  // kehilangan satu baris log. Tapi juga tidak boleh senyap.
  try {
    await kueri(
      `INSERT INTO audit_log (user_id, aksi, entitas, entitas_id, data_sebelum, data_sesudah, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        a.userId,
        a.aksi,
        a.entitas,
        a.entitasId,
        a.sebelum === null || a.sebelum === undefined ? null : JSON.stringify(a.sebelum),
        a.sesudah === null || a.sesudah === undefined ? null : JSON.stringify(a.sesudah),
        await ambilIp(),
      ],
    )
  } catch (e) {
    console.error(
      `[audit] GAGAL mencatat ${a.aksi} pada ${a.entitas}#${a.entitasId} oleh user ${a.userId}:`,
      e,
    )
  }
}

/**
 * IP pemanggil. Di belakang proxy, `x-forwarded-for` berisi rantai — yang dipakai
 * entri pertama (klien asli). Header ini bisa dipalsukan klien, jadi nilainya
 * jejak bantu, bukan bukti identitas; identitas datang dari `user_id`.
 */
async function ambilIp(): Promise<string | null> {
  try {
    const h = await headers()
    const rantai = h.get('x-forwarded-for')
    if (rantai) return rantai.split(',')[0]!.trim().slice(0, 45)
    return h.get('x-real-ip')?.slice(0, 45) ?? null
  } catch {
    return null
  }
}

/** Satu baris audit untuk ditampilkan (Audit Log Viewer, Fase 7). */
export interface BarisAudit {
  id: number
  namaPengguna: string | null
  aksi: string
  entitas: string
  entitasId: number | null
  dataSebelum: unknown
  dataSesudah: unknown
  ipAddress: string | null
  createdAt: Date
}

/** Audit terakhir untuk satu entitas — dipakai panel "riwayat perubahan". */
export async function ambilAuditEntitas(
  entitas: string,
  entitasId: number,
  batas = 10,
): Promise<BarisAudit[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT a.id, u.nama AS nama_pengguna, a.aksi, a.entitas, a.entitas_id,
            a.data_sebelum, a.data_sesudah, a.ip_address, a.created_at
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.user_id
     WHERE a.entitas = ? AND a.entitas_id = ?
     ORDER BY a.id DESC
     LIMIT ?`,
    [entitas, entitasId, batas],
  )
  return baris.map(petakanAudit)
}

/** Jumlah perubahan per entitas — dipakai widget & halaman kualitas data. */
export async function hitungAuditTerakhir(sejakHari = 30): Promise<number> {
  const r = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM audit_log WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [sejakHari],
  )
  return Number(r?.n ?? 0)
}

function petakanAudit(r: Record<string, unknown>): BarisAudit {
  return {
    id: Number(r.id),
    namaPengguna: r.nama_pengguna === null ? null : String(r.nama_pengguna),
    aksi: String(r.aksi),
    entitas: String(r.entitas),
    entitasId: r.entitas_id === null ? null : Number(r.entitas_id),
    dataSebelum: uraiJson(r.data_sebelum),
    dataSesudah: uraiJson(r.data_sesudah),
    ipAddress: r.ip_address === null ? null : String(r.ip_address),
    createdAt: new Date(String(r.created_at)),
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
