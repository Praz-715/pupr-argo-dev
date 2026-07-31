import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

// Next.js membaca .env.local otomatis; drizzle-kit jalan di luar Next, jadi
// harus dimuat manual.
config({ path: '.env.local' })
config({ path: '.env' })

/**
 * Skema DB **bukan** dikelola dari sini — sumber kebenarannya `doc/sql/*.sql`
 * (turunan 1:1 dari doc/ERD.md). Config ini hanya untuk `drizzle-kit pull`
 * (introspect) supaya tipe TypeScript diturunkan dari DB, bukan didefinisikan
 * ulang manual dan gampang drift. Lihat phase.md §5.
 */
export default defineConfig({
  dialect: 'mysql',
  out: './lib/db',
  dbCredentials: {
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER ?? 'devuser',
    password: process.env.DATABASE_PASSWORD ?? '',
    database: process.env.DATABASE_NAME ?? 'pupr_dev',
  },
})
