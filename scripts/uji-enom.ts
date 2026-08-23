/**
 * Uji koneksi & pemetaan API eNominasi — **read-only, tidak menulis apa pun**.
 *
 *   npm run uji:enom                       # NIP contoh bawaan
 *   npm run uji:enom -- 1984... 1990...    # NIP tertentu
 *   npm run uji:enom -- --dari-db 20       # 20 NIP pertama dari pupr_dev
 *
 * `--conditions react-server` WAJIB (sudah ada di skrip npm): `lib/enom/klien`
 * ber-`server-only`, dan tanpa kondisi itu paket tersebut melempar di Node biasa.
 *
 * Diperiksa BERLAPIS supaya kegagalan bisa dibedakan, bukan cuma "gagal":
 * konfigurasi → jaringan → auth → bentuk balasan → pemetaan → selisih dengan DB.
 * Integrasi baru paling sering mati di lapis pertama sementara orang mengira
 * lapis ketiga; memisahkannya menghemat jam, bukan menit.
 *
 * Keluar dengan kode 1 kalau ada lapis yang gagal.
 */

import { config } from 'dotenv'
import mysql from 'mysql2/promise'

config({ path: '.env.local' })
config({ path: '.env' })

import { ambilAsesmen, bacaKonfigurasi, GalatEnom } from '@/lib/enom/klien'
import { petakanSemua } from '@/lib/enom/pemetaan'

const NIP_CONTOH = ['198411242010121003']
const TAHUN_SEKARANG = new Date().getFullYear()

let gagal = 0
function lapis(nama: string, ok: boolean, detail: string) {
  if (!ok) gagal++
  console.log(`  ${ok ? 'OK   ' : 'GAGAL'} ${nama.padEnd(34)} ${detail}`)
}

async function nipDariDb(batas: number): Promise<string[]> {
  const c = await mysql.createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  })
  const [baris] = await c.query<mysql.RowDataPacket[]>(
    'SELECT nip FROM pegawai WHERE nip IS NOT NULL AND nip <> "" ORDER BY id LIMIT ?',
    [batas],
  )
  await c.end()
  return baris.map((b) => String(b.nip))
}

/** Isi `asesmen_talenta` yang sekarang, untuk dibandingkan — TIDAK diubah. */
async function asesmenDiDb(nip: readonly string[]) {
  if (nip.length === 0) return new Map<string, Record<string, unknown>>()
  const c = await mysql.createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  })
  const [baris] = await c.query<mysql.RowDataPacket[]>(
    `SELECT p.nip, a.tahun_asesmen, a.nilai_kinerja_y, a.nilai_potensial_x,
            a.potkom, a.nilai_integritas, a.kotak_9, a.rating_kinerja
       FROM pegawai p
       JOIN asesmen_talenta a ON a.pegawai_id = p.id
      WHERE p.nip IN (?)
      ORDER BY a.tahun_asesmen DESC`,
    [nip],
  )
  await c.end()
  const peta = new Map<string, Record<string, unknown>>()
  for (const b of baris) if (!peta.has(String(b.nip))) peta.set(String(b.nip), b)
  return peta
}

async function main() {
  /*
    Impor DINAMIS, bukan statis di kepala berkas.

    `lib/pengaturan` menarik `lib/db`, dan `lib/db` membangun pool koneksinya
    **saat modul dimuat** — sementara `config({ path: '.env.local' })` baru
    mengisi env sesudahnya. Impor statis membuat pool lahir tanpa kredensial dan
    skripnya mati dengan "DATABASE_NAME belum diset" sebelum satu baris pun
    jalan. Aturan ini sudah tertulis di `scripts/recompute.ts`; saya melanggarnya
    di empat skrip sekaligus saat memindahkan ambang ke pengaturan (22 Agu 2026).
  */
  const { ambangSumbuDari, ambilPengaturan } = await import('@/lib/pengaturan')
  const arg = process.argv.slice(2)
  const idxDb = arg.indexOf('--dari-db')
  const nip =
    idxDb >= 0
      ? await nipDariDb(Number(arg[idxDb + 1]) || 10)
      : arg.filter((a) => /^\d{18}$/.test(a)).length > 0
        ? arg.filter((a) => /^\d{18}$/.test(a))
        : NIP_CONTOH

  console.log(`\n=== UJI API eNOM — ${nip.length} NIP (read-only) ===\n`)

  // ── Lapis 1: konfigurasi ─────────────────────────────────────────────────────
  let cfg
  try {
    cfg = bacaKonfigurasi()
    lapis('konfigurasi env', true, `url=${cfg.url} timeout=${cfg.timeoutMs}ms batch=${cfg.batch}`)
  } catch (e) {
    lapis('konfigurasi env', false, e instanceof Error ? e.message : String(e))
    console.log('\nIsi ENOM_SECRET di .env.local lalu ulangi.')
    process.exit(1)
  }

  // ── Lapis 2-4: jaringan · auth · bentuk balasan ──────────────────────────────
  const mulai = Date.now()
  let rekaman: Awaited<ReturnType<typeof ambilAsesmen>>
  try {
    rekaman = await ambilAsesmen(nip, { konfigurasi: cfg })
    lapis(
      'jaringan + auth + balasan',
      true,
      `${rekaman.rekaman.length} rekaman dalam ${Date.now() - mulai} ms` +
        (rekaman.gagal.length ? ` · ${rekaman.gagal.length} batch gagal` : ''),
    )
  } catch (e) {
    const g = e instanceof GalatEnom ? e : null
    lapis('jaringan + auth + balasan', false, `[${g?.sebab ?? 'tak terduga'}] ${String(e)}`)
    process.exit(1)
  }

  for (const { nip: n, galat } of rekaman.gagal) {
    lapis(`batch ${n[0]}…`, false, `[${galat.sebab}] ${galat.message}`)
  }

  // NIP yang diminta tapi tidak dijawab sumber — bukan galat, tapi harus terlihat.
  const dijawab = new Set(rekaman.rekaman.map((r) => r.nip))
  const hilang = nip.filter((n) => !dijawab.has(n))
  lapis(
    'kelengkapan jawaban',
    hilang.length === 0,
    hilang.length === 0
      ? 'semua NIP dijawab'
      : `${hilang.length} NIP tidak ada di eNom: ${hilang.slice(0, 5).join(', ')}${hilang.length > 5 ? '…' : ''}`,
  )

  // ── Lapis 5: pemetaan ────────────────────────────────────────────────────────
  const { hasil, temuan } = petakanSemua(rekaman.rekaman, { tahunSekarang: TAHUN_SEKARANG, ambang: ambangSumbuDari(await ambilPengaturan()) })
  lapis(
    'pemetaan ke asesmen_talenta',
    hasil.length === rekaman.rekaman.length,
    `${hasil.length}/${rekaman.rekaman.length} terpetakan · ${temuan.length} temuan`,
  )

  if (temuan.length) {
    console.log('\n--- temuan (data dikoreksi / perlu manusia) ---')
    const per = new Map<string, number>()
    for (const t of temuan) per.set(t.kode, (per.get(t.kode) ?? 0) + 1)
    for (const [kode, n] of [...per].sort((a, b) => b[1] - a[1])) {
      const contoh = temuan.find((t) => t.kode === kode)!
      console.log(`  ${String(n).padStart(4)}× ${kode}`)
      console.log(`       ${contoh.keterangan}`)
    }
  }

  // ── Lapis 6: selisih terhadap isi DB (TIDAK menulis) ─────────────────────────
  let db: Awaited<ReturnType<typeof asesmenDiDb>>
  try {
    db = await asesmenDiDb(nip)
    lapis('baca pembanding dari DB', true, `${db.size} pegawai punya asesmen tersimpan`)
  } catch (e) {
    lapis('baca pembanding dari DB', false, String(e))
    db = new Map()
  }

  console.log('\n--- perbandingan eNom vs isi DB sekarang ---')
  console.log(
    '  NIP'.padEnd(21) +
      'thn'.padEnd(6) +
      'Y'.padEnd(7) +
      'X'.padEnd(8) +
      'K9'.padEnd(5) +
      'K9src'.padEnd(7) +
      'DB: Y/X/K9',
  )
  for (const h of hasil.slice(0, 25)) {
    const d = db.get(h.nip)
    const a = h.asesmen
    const dbTeks = d
      ? `${d.nilai_kinerja_y}/${d.nilai_potensial_x}/${d.kotak_9} (${d.tahun_asesmen})`
      : '— belum ada'
    const beda =
      d &&
      (Number(d.nilai_kinerja_y) !== a.nilaiKinerjaY ||
        Number(d.nilai_potensial_x) !== a.nilaiPotensialX ||
        Number(d.kotak_9) !== a.kotak9)
    console.log(
      `  ${h.nip.padEnd(19)}${String(a.tahunAsesmen).padEnd(6)}${String(a.nilaiKinerjaY).padEnd(7)}` +
        `${String(a.nilaiPotensialX).padEnd(8)}${String(a.kotak9).padEnd(5)}` +
        `${String(h.kotak9Sumber ?? '—').padEnd(7)}${dbTeks}${beda ? '   ← BEDA' : ''}`,
    )
  }
  if (hasil.length > 25) console.log(`  … ${hasil.length - 25} baris lain disembunyikan`)

  console.log(
    `\n${gagal === 0 ? 'SEMUA LAPIS LOLOS' : `${gagal} lapis GAGAL`}` +
      ' — tidak ada satu pun baris DB yang ditulis oleh skrip ini.\n',
  )
  process.exit(gagal === 0 ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
