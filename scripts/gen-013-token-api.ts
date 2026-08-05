/**
 * Hasilkan `doc/sql/013_token_api_dev.sql`.
 *
 * Hash token di `002_seed.sql` adalah **placeholder** — bukan SHA-256 dari apa
 * pun (salah satunya bahkan hanya 63 karakter hex), jadi tidak ada satu pun token
 * dev yang bisa dipakai memanggil `/api/v1`. Berkas ini menggantinya dengan hash
 * yang benar-benar berasal dari plaintext yang tercatat, supaya Fase 9 bisa diuji
 * ujung-ke-ujung.
 *
 * Seperti `007_recompute.sql`, isinya **output kode**, bukan tulisan tangan —
 * hash yang diketik manusia tidak bisa diverifikasi tanpa menjalankan hash-nya.
 *
 *   npm run db:gen-token-api
 */
import { writeFileSync } from 'node:fs'

import { hashTokenApi, PREFIKS_TOKEN } from '../lib/api/token'

/**
 * Plaintext token dev. **Sengaja bukan acak** dan sengaja menyebut dirinya dev:
 * token acak harus disalin dari keluaran script (dan akan berbeda tiap kali
 * di-generate, sehingga smoke test tidak bisa memakainya), sedangkan token yang
 * bisa dibaca manusia tidak mungkin tertukar dengan token produksi.
 *
 * Konsekuensinya harus diterima terang-terangan: token ini **publik** — ia ada di
 * repositori. Ia hanya boleh berlaku untuk `pupr_dev`, dan penerbitan token
 * produksi wajib lewat halaman Manajemen Token (acak, ditampilkan sekali).
 */
const TOKEN_DEV: Array<{ id: number; klien: string; plaintext: string }> = [
  { id: 1, klien: 'BKN', plaintext: `${PREFIKS_TOKEN}dev-bkn-hanya-untuk-pupr_dev` },
  {
    id: 2,
    klien: 'BIROKEPEG-PU',
    plaintext: `${PREFIKS_TOKEN}dev-birokepeg-hanya-untuk-pupr_dev`,
  },
  {
    id: 3,
    klien: 'BKN (dicabut)',
    plaintext: `${PREFIKS_TOKEN}dev-bkn-lama-sudah-dicabut`,
  },
]

const baris: string[] = [
  '-- 013_token_api_dev.sql — DIHASILKAN PROGRAM oleh scripts/gen-013-token-api.ts.',
  '-- Jangan disunting tangan; jalankan `npm run db:gen-token-api` untuk membuat ulang.',
  '--',
  '-- Alasan berkas ini ada: hash token di 002_seed.sql adalah placeholder yang tidak',
  '-- berasal dari plaintext mana pun, sehingga /api/v1 tidak bisa diuji sama sekali.',
  '--',
  '-- PERINGATAN: ketiga plaintext di bawah ADA DI REPOSITORI, jadi ia publik.',
  '-- Berlaku HANYA untuk pupr_dev. Token produksi diterbitkan dari halaman',
  '-- Manajemen Token API (acak 256 bit, ditampilkan sekali, tidak pernah disimpan).',
  '',
]

for (const t of TOKEN_DEV) {
  baris.push(`-- klien ${t.klien}: ${t.plaintext}`)
}
baris.push('')

for (const t of TOKEN_DEV) {
  baris.push(
    `UPDATE api_token SET token_hash = '${hashTokenApi(t.plaintext)}' WHERE id = ${t.id};`,
  )
}

baris.push('')
baris.push('-- Sanity: ketiga hash wajib berbeda & berformat sha256:<64 hex>.')
baris.push(
  "SELECT id, label, status, LEFT(token_hash, 14) AS awal_hash, LENGTH(token_hash) AS panjang FROM api_token ORDER BY id;",
)
baris.push('')

const isi = baris.join('\n')
writeFileSync('doc/sql/013_token_api_dev.sql', isi, 'utf8')

console.log('doc/sql/013_token_api_dev.sql ditulis.\n')
console.log('Token dev (dev-only, ada di repo):')
for (const t of TOKEN_DEV) {
  console.log(`  ${t.klien.padEnd(16)} ${t.plaintext}`)
  console.log(`  ${''.padEnd(16)} -> ${hashTokenApi(t.plaintext)}`)
}
