/**
 * Aktifkan jabatan target lewat GERBANG yang sama dengan tombol di UI — kering
 * secara bawaan.
 *
 *   npm run aktifkan:target -- --id 441,442,443,444,445
 *   npm run aktifkan:target -- --id 441,442,443,444,445 --tulis
 *
 * Gerbangnya `halanganAktivasi()` di `lib/aktivasi-target.ts`, modul yang sama
 * dengan `ubahStatusJabatanTarget()`. Menulis `UPDATE ... SET status='AKTIF'`
 * langsung akan berhasil untuk target yang tombolnya sendiri menolak — dan yang
 * dilanggar bukan kerapian melainkan arti statusnya: AKTIF berarti ikut dihitung,
 * muncul di pemilih Peta Talenta, dan peringkatnya dipakai memutuskan orang.
 *
 * Ia sengaja TIDAK mencatat jejak `UBAH_STATUS` ke `audit_log` — itu milik server
 * action, yang punya pengguna untuk diatribusikan. Skrip tidak punya sesi, dan
 * mengarang pelakunya lebih buruk daripada tidak mencatat.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')
const arg = (nama: string): string | null => {
  const i = process.argv.indexOf(nama)
  return i === -1 ? null : (process.argv[i + 1] ?? null)
}

async function main() {
  const { kueri, eksekusi } = await import('../lib/db')
  const { halanganAktivasi } = await import('../lib/aktivasi-target')

  const ids = (arg('--id') ?? '').split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0)
  if (ids.length === 0) {
    console.error('pakai: --id <id,id,...> [--tulis]')
    process.exit(1)
  }

  const target = await kueri<{ id: number; nama_target: string; status: string }>(
    'SELECT id, nama_target, status FROM jabatan_target WHERE id IN (?) ORDER BY id', [ids],
  )
  console.log(`\nmode: ${TULIS ? 'TULIS' : 'kering'}\n`)

  let siap = 0
  let ditahan = 0
  for (const t of target) {
    const halangan = await halanganAktivasi(t.id)
    const label = `  #${t.id} ${t.nama_target.slice(0, 44).padEnd(46)} ${t.status.padEnd(8)}`
    if (halangan !== null) {
      ditahan++
      console.log(`${label} DITAHAN — ${halangan}`)
      continue
    }
    if (t.status === 'AKTIF') {
      console.log(`${label} sudah AKTIF`)
      continue
    }
    siap++
    if (TULIS) {
      await eksekusi(`UPDATE jabatan_target SET status = 'AKTIF' WHERE id = ?`, [t.id])
      console.log(`${label} → AKTIF`)
    } else {
      console.log(`${label} lolos gerbang → akan diaktifkan`)
    }
  }

  console.log(`\n  ${TULIS ? 'diaktifkan' : 'siap diaktifkan'}: ${siap} · ditahan: ${ditahan}`)
  if (!TULIS) console.log('\nKering — tidak ada yang ditulis. Tambahkan `--tulis`.\n')
  else console.log('\nSkor BELUM bergerak — jalankan `npm run hitung:ulang -- --tulis`.\n')
  process.exit(ditahan === 0 ? 0 : 1)
}

void main()
