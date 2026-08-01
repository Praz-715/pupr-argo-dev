/**
 * Jalankan satu berkas SQL dari `doc/sql/` ke database dev.
 *
 * Dibuat karena berkas skema di `doc/sql/` adalah sumber kebenaran yang
 * dieksekusi berurutan (CLAUDE.md §Database Dev), dan sampai Fase 6 itu
 * dijalankan lewat perkakas di luar repo. Menaruhnya di sini membuat langkahnya
 * bisa diulang siapa pun tanpa menebak-nebak parameter koneksi.
 *
 *   npx tsx scripts/jalankan-sql.ts doc/sql/012_auth.sql
 *   npx tsx scripts/jalankan-sql.ts doc/sql/012_auth.sql --db pupr_dev_volume
 *
 * Sengaja TIDAK memakai `lib/db`: modul itu membangun pool saat dimuat dengan
 * `multipleStatements` mati (benar untuk aplikasi — mematikan satu kelas
 * injeksi SQL), sedangkan berkas skema justru berisi banyak pernyataan.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { config } from 'dotenv'
import mysql from 'mysql2/promise'

config({ path: '.env.local' })
config({ path: '.env' })

async function main() {
  const argv = process.argv.slice(2)
  const berkas = argv.find((a) => !a.startsWith('--'))
  if (!berkas) {
    console.error('Pakai: tsx scripts/jalankan-sql.ts <berkas.sql> [--db nama_database]')
    process.exit(1)
  }

  const iDb = argv.indexOf('--db')
  const database = iDb >= 0 ? argv[iDb + 1] : process.env.DATABASE_NAME
  if (!database) throw new Error('DATABASE_NAME belum diset dan --db tidak diberikan.')

  const sql = readFileSync(resolve(berkas), 'utf8')

  const koneksi = await mysql.createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database,
    multipleStatements: true,
  })

  console.log(`Menjalankan ${berkas} → ${database} …`)
  try {
    await koneksi.query(sql)
    console.log('Selesai tanpa galat.')
  } finally {
    await koneksi.end()
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e)
  process.exit(1)
})
