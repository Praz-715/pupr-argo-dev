import { drizzle } from 'drizzle-orm/mysql2'
import mysql from 'mysql2/promise'

import * as relations from './relations'
import * as schema from './schema'

/**
 * Klien database tunggal.
 *
 * `schema.ts` & `relations.ts` adalah HASIL INTROSPECT (`npm run db:pull`) —
 * jangan diedit tangan. Sumber kebenaran skema tetap `doc/sql/*.sql` yang
 * turunan 1:1 dari doc/ERD.md (phase.md §5).
 */

function buatPool(): mysql.Pool {
  const { DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME } =
    process.env

  if (!DATABASE_NAME) {
    throw new Error(
      'DATABASE_NAME belum diset. Salin nilai koneksi dev ke .env.local (lihat CLAUDE.md §Database Dev).',
    )
  }

  return mysql.createPool({
    host: DATABASE_HOST ?? '127.0.0.1',
    port: Number(DATABASE_PORT ?? 3306),
    user: DATABASE_USER,
    password: DATABASE_PASSWORD,
    database: DATABASE_NAME,
    connectionLimit: 10,
    // MySQL DECIMAL default dikembalikan sebagai string oleh mysql2 supaya
    // presisi tidak hilang. Kita biarkan begitu dan konversi eksplisit lewat
    // `angka()` di bawah — jangan pakai `decimalNumbers: true` diam-diam.
    dateStrings: true,
    timezone: 'local',
  })
}

// Cache pool antar hot-reload dev supaya koneksi tidak menumpuk.
const global_ = globalThis as unknown as { __simtPool?: mysql.Pool }
const pool = global_.__simtPool ?? buatPool()
if (process.env.NODE_ENV !== 'production') global_.__simtPool = pool

export const db = drizzle(pool, { schema: { ...schema, ...relations }, mode: 'default' })

export { schema, relations }
export * from './schema'

/**
 * Kueri SQL mentah untuk agregasi.
 *
 * Dashboard WAJIB mengagregasi di SQL (`GROUP BY`), bukan mengambil seluruh
 * baris lalu `.reduce()` di server — dev punya 40 pegawai, produksi 1.872
 * (phase.md §3 K-5). Query builder Drizzle dipakai untuk CRUD; untuk agregat
 * berjenjang, SQL langsung lebih jujur dan lebih mudah dibaca.
 *
 * Selalu pakai `params` untuk nilai dari pengguna — jangan template string.
 */
export async function kueri<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  const [rows] = await pool.query(sql, params)
  return rows as T[]
}

/** Varian untuk kueri yang pasti mengembalikan satu baris. */
export async function kueriSatu<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await kueri<T>(sql, params)
  return rows[0] ?? null
}

/**
 * INSERT / UPDATE / DELETE — mengembalikan `insertId` & `affectedRows`.
 *
 * Dipisah dari `kueri()` karena perintah tulis **tidak mengembalikan baris**:
 * MySQL mengirim OkPacket, sehingga memakai `kueri()` untuk INSERT memaksa
 * pemanggilnya meng-cast hasil "array" menjadi objek — bohong yang kebetulan
 * jalan, dan akan menggigit begitu ada yang mencoba `.map()` di atasnya.
 */
export async function eksekusi(
  sql: string,
  params: unknown[] = [],
): Promise<{ insertId: number; affectedRows: number }> {
  const [hasil] = await pool.query(sql, params)
  const ok = hasil as unknown as { insertId?: number; affectedRows?: number }
  return { insertId: Number(ok.insertId ?? 0), affectedRows: Number(ok.affectedRows ?? 0) }
}

/**
 * MySQL DECIMAL datang sebagai string. Konversi eksplisit di satu tempat supaya
 * tidak ada `Number(x)` bertebaran yang diam-diam menghasilkan NaN.
 */
export function angka(nilai: string | number | null | undefined): number | null {
  if (nilai === null || nilai === undefined || nilai === '') return null
  const n = typeof nilai === 'number' ? nilai : Number(nilai)
  return Number.isNaN(n) ? null : n
}

/** Varian yang wajib ada nilainya — untuk kolom NOT NULL. */
export function angkaWajib(nilai: string | number | null | undefined, bawaan = 0): number {
  return angka(nilai) ?? bawaan
}
