/**
 * Selaraskan `pegawai.nama_lengkap` dengan nama yang dikirim API eNominasi —
 * **DRY-RUN bawaan**.
 *
 *   npm run nama:enom                 # laporkan saja, TIDAK menulis
 *   npm run nama:enom -- --tulis      # benar-benar menulis
 *   npm run nama:enom -- --semua      # periksa SELURUH pegawai, bukan cuma yang ditampilkan
 *
 * **Kenapa ada.** Sebagian nama di `pegawai` adalah nama benih pendek ("Tasya",
 * "Tina", "Mardi") sementara eNom mengirim nama resmi lengkap beserta gelarnya.
 * Selama keduanya berbeda, layar menyebut orang dengan nama yang tidak dikenal
 * di sistem kepegawaian — dan yang paling merugikan bukan tampilannya, melainkan
 * bahwa nama itu ikut ke ekspor CSV, laporan, dan API eksternal.
 *
 * **Cakupan bawaannya sengaja HANYA pegawai yang ditampilkan** (punya asesmen
 * `sumber_sync='eNominasi'`), sebab hanya mereka yang pasti ada di eNom. Memakai
 * `--semua` berarti menanyakan 43 NIP satu per satu — lihat sifat batch nomor 7
 * di CLAUDE.md — dan setiap panggilan tercatat di sisi eNom.
 *
 * **Yang TIDAK dilakukan skrip ini:**
 *   - Tidak menyentuh `users.nama`. Itu akun aplikasi, bukan data pegawai.
 *   - Tidak menambah baris `pegawai`. NIP yang ada di eNom tapi belum ada di
 *     `pegawai` dilaporkan, tidak disisipkan.
 *   - Tidak menormalkan apa pun. Nama dipakai apa adanya dari sumber; itu
 *     seluruh tujuannya. Membersihkan gelar atau kapitalisasi di sini berarti
 *     memperkenalkan versi KETIGA dari nama yang sama.
 */

import { writeFileSync } from 'node:fs'

import { config } from 'dotenv'
import mysql from 'mysql2/promise'

config({ path: '.env.local' })
config({ path: '.env' })

import { ambilAsesmen, bacaKonfigurasi } from '@/lib/enom/klien'
import { petakanSemua } from '@/lib/enom/pemetaan'

const arg = process.argv.slice(2)
const TULIS = arg.includes('--tulis')
const SEMUA = arg.includes('--semua')
const BERKAS_PULIH = 'doc/sql/cadangan-nama-sebelum-enom.sql'

type Aksi = 'BEDA' | 'SAMA' | 'TANPA_NAMA' | 'TANPA_PEGAWAI'

interface Rencana {
  nip: string
  aksi: Aksi
  pegawaiId: number | null
  sebelum: string | null
  sesudah: string | null
}

function koneksi() {
  return mysql.createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  })
}

/** Kutip literal SQL — berkas pemulihan harus bisa dijalankan apa adanya. */
function kutip(s: string): string {
  return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
}

async function main() {
  const cfg = bacaKonfigurasi()
  const db = await koneksi()
  const mulai = new Date()

  console.log('\n=== NAMA eNOM → pegawai.nama_lengkap ===')
  console.log(`    mode     : ${TULIS ? '*** MENULIS ***' : 'dry-run (tidak menulis)'}`)
  console.log(`    cakupan  : ${SEMUA ? 'SELURUH pegawai' : 'hanya pegawai yang ditampilkan'}`)
  console.log(`    sumber   : ${cfg.url}`)
  console.log(`    database : ${process.env.DATABASE_NAME}\n`)

  // Bawaan: pegawai yang punya asesmen dari eNom. Mereka sudah terbukti ada di
  // sana, jadi tidak ada panggilan yang terbuang untuk NIP hasil generator.
  const [baris] = await db.query<mysql.RowDataPacket[]>(
    SEMUA
      ? 'SELECT id, nip, nama_lengkap FROM pegawai WHERE nip REGEXP "^[0-9]{18}$" ORDER BY nama_lengkap'
      : `SELECT p.id, p.nip, p.nama_lengkap
           FROM pegawai p
          WHERE p.nip REGEXP "^[0-9]{18}$"
            AND EXISTS (SELECT 1 FROM asesmen_talenta a
                         WHERE a.pegawai_id = p.id AND a.sumber_sync = 'eNominasi')
          ORDER BY p.nama_lengkap`,
  )
  const namaPerNip = new Map(baris.map((b) => [String(b.nip), String(b.nama_lengkap)]))
  const idPerNip = new Map(baris.map((b) => [String(b.nip), Number(b.id)]))
  const nip = baris.map((b) => String(b.nip))

  console.log(`  ${nip.length} NIP akan ditanyakan ke eNom (satu per satu)`)

  const { rekaman, gagal } = await ambilAsesmen(nip, { konfigurasi: cfg })
  for (const g of gagal) console.log(`  ! gagal [${g.galat.sebab}]: ${g.galat.message}`)

  const { hasil } = petakanSemua(rekaman, { tahunSekarang: mulai.getFullYear() })
  console.log(`  eNom menjawab ${rekaman.length} · terpetakan ${hasil.length}\n`)

  const rencana: Rencana[] = []
  for (const h of hasil) {
    const pegawaiId = idPerNip.get(h.nip) ?? null
    const sebelum = namaPerNip.get(h.nip) ?? null
    const sesudah = h.namaSumber === null ? null : h.namaSumber.trim()

    if (pegawaiId === null) {
      rencana.push({ nip: h.nip, aksi: 'TANPA_PEGAWAI', pegawaiId, sebelum, sesudah })
    } else if (sesudah === null || sesudah === '') {
      // eNom boleh tidak mengirim nama; itu hasil kosong, bukan alasan menimpa
      // nama yang sudah ada dengan string kosong.
      rencana.push({ nip: h.nip, aksi: 'TANPA_NAMA', pegawaiId, sebelum, sesudah: null })
    } else {
      rencana.push({
        nip: h.nip,
        aksi: sesudah === sebelum ? 'SAMA' : 'BEDA',
        pegawaiId,
        sebelum,
        sesudah,
      })
    }
  }

  const beda = rencana.filter((r) => r.aksi === 'BEDA')
  const lebar = Math.max(...rencana.map((r) => (r.sebelum ?? '').length), 12)

  for (const r of rencana) {
    const tanda = r.aksi === 'BEDA' ? '→' : r.aksi === 'SAMA' ? '=' : '!'
    console.log(
      `  ${tanda} ${(r.sebelum ?? '(tanpa baris pegawai)').padEnd(lebar)}  ${
        r.aksi === 'BEDA' ? r.sesudah : r.aksi === 'SAMA' ? '(sama)' : r.aksi
      }`,
    )
  }

  console.log(
    `\n  ${beda.length} berbeda · ${rencana.filter((r) => r.aksi === 'SAMA').length} sama · ` +
      `${rencana.filter((r) => r.aksi === 'TANPA_NAMA').length} eNom tidak mengirim nama · ` +
      `${nip.length - hasil.length} tidak dijawab eNom`,
  )

  if (beda.length === 0) {
    console.log('\n  Tidak ada yang perlu diubah.\n')
    await db.end()
    return
  }

  if (!TULIS) {
    console.log('\n  DRY-RUN — tidak ada yang ditulis. Ulangi dengan `-- --tulis`.\n')
    await db.end()
    return
  }

  // Berkas pemulihan ditulis SEBELUM perubahan, dan berisi nama LAMA. Tanpa ini
  // tidak ada jalan kembali: nama lama hanya hidup di baris yang sedang ditimpa.
  const pulih = [
    '-- Nama pegawai SEBELUM diselaraskan dengan API eNominasi.',
    `-- Dihasilkan ${mulai.toISOString()} oleh scripts/nama-enom.ts`,
    `-- Jalankan untuk membatalkan: npm run db:sql ${BERKAS_PULIH}`,
    '',
    ...beda.map(
      (r) =>
        `UPDATE pegawai SET nama_lengkap = ${kutip(r.sebelum ?? '')} WHERE id = ${r.pegawaiId};`,
    ),
    '',
  ].join('\n')
  writeFileSync(BERKAS_PULIH, pulih, 'utf8')
  console.log(`\n  Cadangan nama lama → ${BERKAS_PULIH} (${beda.length} UPDATE)`)

  let ditulis = 0
  let galatTulis: string | null = null
  try {
    await db.beginTransaction()
    for (const r of beda) {
      await db.execute('UPDATE pegawai SET nama_lengkap = ? WHERE id = ?', [r.sesudah, r.pegawaiId])
      ditulis += 1
    }
    await db.commit()
  } catch (e) {
    await db.rollback()
    ditulis = 0
    galatTulis = e instanceof Error ? e.message : String(e)
  }

  await db.execute(
    `INSERT INTO sync_log
       (sumber_sistem, jenis_data, status, jumlah_baris, mulai_pada, selesai_pada, catatan_error)
     VALUES ('eNominasi', 'pegawai', ?, ?, ?, NOW(), ?)`,
    [
      galatTulis ? 'GAGAL' : gagal.length > 0 ? 'SEBAGIAN' : 'SUKSES',
      ditulis,
      mulai,
      galatTulis ?? `nama_lengkap diselaraskan untuk ${ditulis} pegawai`,
    ],
  )

  console.log(
    galatTulis
      ? `\n  GAGAL — transaksi di-rollback, nol baris berubah: ${galatTulis}\n`
      : `\n  ${ditulis} nama diperbarui. Jejak masuk sync_log.\n`,
  )
  await db.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
