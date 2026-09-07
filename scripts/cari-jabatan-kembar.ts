/**
 * Jabatan KEMBAR di dalam satu unit — deteksi, dan (opsional) penggabungan.
 *
 *   npx tsx --conditions react-server scripts/cari-jabatan-kembar.ts            # laporkan saja
 *   npx tsx --conditions react-server scripts/cari-jabatan-kembar.ts --tulis    # gabungkan yang aman
 *
 * Dilaporkan pemilik proses 31 Agu 2026 lewat tangkapan layar Struktur Organisasi:
 * BP2JK Wilayah Maluku memuat **dua** Kepala Balai —
 *
 *     JAB-STR-044   KOSONG  "Kepala Balai Pelaksana Pemilihan Jasa Konstruksi"
 *     JAB-KAB26-187 TERISI  "Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Maluku"
 *
 * *"itu kan jabatan yang sama tapi karna ambil dari sumber yang beda jadi dianggap
 * beda"* — tepat. Yang satu dari `Nama Jabatan Struktural.xlsx` (nama pendek, resmi),
 * yang satu dari berkas Talent Pool (nama berimbuhan wilayah).
 *
 * ## Aturannya HIMPUNAN, bukan kemiripan persen
 *
 * Dua jabatan disebut kembar bila **unitnya sama** DAN `jenisJabatan()`-nya sama.
 * `lib/jenis-jabatan.ts` membuang keterangan tempat dan menyeragamkan ejaan Sub —
 * jadi "…Wilayah Maluku" dan "…" bertemu, sementara "Kepala Seksi Pelaksanaan" dan
 * "Kepala Seksi Pengadaan" tetap terpisah.
 *
 * Ini penting dan sudah mahal dipelajari di repo ini: ambang kemiripan persen sudah
 * TIGA KALI menghasilkan temuan yang salah atau tak terpakai (`samaUnit()` 85%
 * menempelkan 56 jabatan ke unit yang keliru; pemeriksa nama unit 85% berteriak 108
 * kali; pemeriksa "jabatan >1 pada eselon sama" berteriak 32 kali). Aturan himpunan
 * memberi daftar yang seluruhnya layak dibaca.
 *
 * ## Pemenangnya DITURUNKAN, bukan dipilih
 *
 * Berurutan, dan berhenti di yang pertama terpenuhi:
 *   1. sisi yang pasangannya **(nama, unit) ADA di `doc/data/jabatan-struktural.json`** —
 *      123 pasangan resmi yang dijaga `rapikan:jabatan`. Ini yang menentukan, bukan
 *      "sisi mana yang berpenghuni": dependen dialihkan ke pemenang apa pun arahnya,
 *      jadi memilih sisi berpenghuni tidak menyelamatkan apa-apa sementara menghapus
 *      sisi bernama-acuan **menurunkan kesesuaian 123/123** — cacat yang tidak
 *      menghasilkan galat dan baru ketahuan berbulan kemudian;
 *   2. sisi yang **berpenghuni / punya riwayat**, kalau tidak satu pun ada di acuan;
 *   3. `id` terkecil — baris yang lebih dulu ada.
 *
 * ## Yang DILEWATI, dan kenapa
 *
 * Kelompok yang **dua sisinya sama-sama berpengikat** (masing-masing punya penghuni
 * atau riwayat) tidak disentuh: menggabungkannya berarti menulis ulang riwayat
 * jabatan seseorang, dan itu perubahan data, bukan kerapian. Ia dilaporkan supaya
 * keputusannya diambil manusia.
 *
 * ## Menggabungkan, BUKAN menghapus
 *
 * Dependen sisi yang kalah dialihkan lebih dulu (`pegawai.jabatan_id`,
 * `riwayat_jabatan.jabatan_id`, `jabatan_target_anggota.jabatan_id`), baru barisnya
 * dihapus. Menghapus tanpa mengalihkan akan **melubangi jabatan target** yang
 * memuatnya — pelajaran dari `--gabungkan-kembar` 24 Agu 2026.
 *
 * `jabatan_target_anggota` berkunci (target, jabatan): kalau pemenang SUDAH anggota
 * target yang sama, baris yang kalah **dibuang** (dedup); kalau belum, `jabatan_id`-nya
 * diarahkan. Tanpa cabang itu `UPDATE` gagal dengan galat kunci ganda di tengah jalan.
 */

import { readFileSync } from 'node:fs'

import { config } from 'dotenv'
import mysql from 'mysql2/promise'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')

interface Baris {
  id: number
  kode_jabatan: string
  nama_jabatan: string
  eselon: string | null
  status_jabatan: string
  unit_id: number
  nama_unit: string
  penghuni: number
  anggota: number
  riwayat: number
}

async function main() {
  const { jenisJabatan, kunciJenisJabatan } = await import('../lib/jenis-jabatan')

  const db = await mysql.createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    multipleStatements: false,
  })

  /*
    Daftar 123 pasangan (jabatan, unit) resmi — hasil ekstraksi
    `Nama Jabatan Struktural.xlsx`, dan acuan yang dijaga `npm run rapikan:jabatan`.
    Dibaca di sini supaya pemilihan pemenang tidak menebak nama mana yang "resmi".
  */
  const acuan = JSON.parse(
    readFileSync('doc/data/jabatan-struktural.json', 'utf8'),
  ) as Array<{ namaJabatan: string; unitKerja: string }>
  const rapat = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase()
  const kunciAcuan = new Set(acuan.map((a) => `${rapat(a.namaJabatan)}|${rapat(a.unitKerja)}`))
  const diAcuan = (r: Baris) =>
    kunciAcuan.has(`${rapat(r.nama_jabatan)}|${rapat(r.nama_unit)}`)

  const [rows] = await db.query<mysql.RowDataPacket[]>(`
    SELECT j.id, j.kode_jabatan, j.nama_jabatan, j.eselon, j.status_jabatan,
           u.id AS unit_id, u.nama_unit,
           (SELECT COUNT(*) FROM pegawai p WHERE p.jabatan_id = j.id AND p.status_aktif = 'AKTIF') AS penghuni,
           (SELECT COUNT(*) FROM jabatan_target_anggota a WHERE a.jabatan_id = j.id) AS anggota,
           (SELECT COUNT(*) FROM riwayat_jabatan r WHERE r.jabatan_id = j.id) AS riwayat
      FROM jabatan j
      JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     WHERE j.status_jabatan <> 'DIHAPUS'`)
  const semua = rows as unknown as Baris[]

  const per = new Map<string, Baris[]>()
  for (const r of semua) {
    const k = `${r.unit_id}|${kunciJenisJabatan(r.nama_jabatan)}`
    if (!per.has(k)) per.set(k, [])
    per.get(k)!.push(r)
  }
  const kembar = [...per.values()].filter((g) => g.length > 1)

  const berpengikat = (r: Baris) => Number(r.penghuni) > 0 || Number(r.riwayat) > 0
  const aman: Baris[][] = []
  const ditahan: Baris[][] = []
  for (const g of kembar) (g.filter(berpengikat).length <= 1 ? aman : ditahan).push(g)

  console.log(`\nmode      : ${TULIS ? 'TULIS' : 'kering (laporkan saja)'}`)
  console.log(`database  : ${process.env.DATABASE_NAME}`)
  console.log(`\njabatan diperiksa            : ${semua.length}`)
  console.log(`kelompok kembar dalam 1 unit : ${kembar.length}  (${kembar.reduce((a, g) => a + g.length, 0)} baris)`)
  console.log(`  bisa digabung otomatis     : ${aman.length}`)
  console.log(`  DITAHAN (dua sisi berisi)  : ${ditahan.length}`)

  const asal = new Map<string, number>()
  for (const g of kembar)
    for (const r of g) {
      const p = r.kode_jabatan.split('-').slice(0, 2).join('-')
      asal.set(p, (asal.get(p) ?? 0) + 1)
    }
  console.log(
    `asal baris terlibat          : ${[...asal].sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p}=${n}`).join(' · ')}`,
  )

  function pemenang(g: Baris[]): Baris {
    const dg = [...g].sort((a, b) => a.id - b.id)
    return dg.find(diAcuan) ?? dg.find(berpengikat) ?? dg[0]!
  }

  console.log('\n── RENCANA ──')
  for (const g of aman.slice(0, TULIS ? aman.length : 10)) {
    const menang = pemenang(g)
    console.log(`\n  ${g[0]!.nama_unit} · jenis "${jenisJabatan(g[0]!.nama_jabatan)}"`)
    for (const r of g) {
      const tanda = r.id === menang.id ? 'BERTAHAN' : 'dilebur  '
      console.log(
        `    ${tanda} ${r.kode_jabatan.padEnd(18)} penghuni=${r.penghuni} target=${r.anggota} riwayat=${r.riwayat}  "${r.nama_jabatan}"`,
      )
    }
  }
  if (!TULIS && aman.length > 10) console.log(`\n  … dan ${aman.length - 10} kelompok lain`)

  if (ditahan.length > 0) {
    console.log('\n── DITAHAN: dua sisi sama-sama berpengikat, perlu keputusan Anda ──')
    for (const g of ditahan) {
      console.log(`\n  ${g[0]!.nama_unit} · jenis "${jenisJabatan(g[0]!.nama_jabatan)}"`)
      for (const r of g) {
        console.log(
          `    ${r.kode_jabatan.padEnd(18)} penghuni=${r.penghuni} target=${r.anggota} riwayat=${r.riwayat}  "${r.nama_jabatan}"`,
        )
      }
    }
  }

  if (!TULIS) {
    console.log('\nKering — tidak ada yang ditulis. Ulangi dengan `--tulis`.\n')
    await db.end()
    return
  }

  let digabung = 0
  let dialihkanPeg = 0
  let dialihkanRiw = 0
  let dialihkanTgt = 0
  let dedupTgt = 0
  await db.beginTransaction()
  try {
    for (const g of aman) {
      const menang = pemenang(g)
      for (const kalah of g.filter((r) => r.id !== menang.id)) {
        const [p] = await db.execute<mysql.ResultSetHeader>(
          'UPDATE pegawai SET jabatan_id = ? WHERE jabatan_id = ?',
          [menang.id, kalah.id],
        )
        dialihkanPeg += p.affectedRows
        const [r] = await db.execute<mysql.ResultSetHeader>(
          'UPDATE riwayat_jabatan SET jabatan_id = ? WHERE jabatan_id = ?',
          [menang.id, kalah.id],
        )
        dialihkanRiw += r.affectedRows
        // Kunci ganda (target, jabatan): buang yang bertabrakan, alihkan sisanya.
        const [d] = await db.execute<mysql.ResultSetHeader>(
          `DELETE a FROM jabatan_target_anggota a
             WHERE a.jabatan_id = ?
               AND EXISTS (SELECT 1 FROM (SELECT * FROM jabatan_target_anggota) b
                            WHERE b.jabatan_target_id = a.jabatan_target_id AND b.jabatan_id = ?)`,
          [kalah.id, menang.id],
        )
        dedupTgt += d.affectedRows
        const [t] = await db.execute<mysql.ResultSetHeader>(
          'UPDATE jabatan_target_anggota SET jabatan_id = ? WHERE jabatan_id = ?',
          [menang.id, kalah.id],
        )
        dialihkanTgt += t.affectedRows
        await db.execute('DELETE FROM jabatan WHERE id = ?', [kalah.id])
        digabung++
      }
    }
    await db.commit()
  } catch (e) {
    await db.rollback()
    console.error('\nGAGAL — transaksi di-rollback, nol baris berubah:', (e as Error).message)
    await db.end()
    process.exit(1)
  }

  console.log(
    `\n── DITULIS ──\n  ${digabung} jabatan dilebur · pegawai dialihkan ${dialihkanPeg} · riwayat ${dialihkanRiw} · anggota target ${dialihkanTgt} (dedup ${dedupTgt})`,
  )

  // Penjaga SESUDAH menulis: jawab "apakah masih ada kembar", bukan "berapa yang saya gabung".
  const [sisaRows] = await db.query<mysql.RowDataPacket[]>(
    `SELECT j.nama_jabatan, j.unit_organisasi_id FROM jabatan j WHERE j.status_jabatan <> 'DIHAPUS'`,
  )
  const cek = new Map<string, number>()
  for (const r of sisaRows as unknown as Array<{ nama_jabatan: string; unit_organisasi_id: number }>) {
    const k = `${r.unit_organisasi_id}|${kunciJenisJabatan(r.nama_jabatan)}`
    cek.set(k, (cek.get(k) ?? 0) + 1)
  }
  const sisa = [...cek.values()].filter((n) => n > 1).length
  console.log(`  penjaga akhir: kelompok kembar tersisa = ${sisa} (ditahan sengaja: ${ditahan.length})`)
  await db.end()
}

void main()
