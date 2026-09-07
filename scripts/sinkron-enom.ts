/**
 * Sinkronisasi `asesmen_talenta` dari API eNominasi — **DRY-RUN bawaan**.
 *
 *   npm run sinkron:enom                 # laporkan saja, TIDAK menulis
 *   npm run sinkron:enom -- --tulis      # benar-benar menulis
 *   npm run sinkron:enom -- --nip 1984…  # batasi ke NIP tertentu
 *   npm run sinkron:enom -- --batas 100  # batasi jumlah pegawai yang diperiksa
 *
 * **Kenapa dry-run yang jadi bawaan, bukan sebaliknya.** Menulis ke
 * `asesmen_talenta` menggeser angka yang dijaga tiga pemeriksaan sekaligus
 * (`verifikasi:data`, `verifikasi:skoring`, dan rata skor per jabatan target di
 * CLAUDE.md). Perintah yang menulis secara bawaan berarti satu kali salah ketik
 * membuat seluruh baseline itu tidak lagi bisa dipercaya, dan yang paling mahal
 * bukan menulisnya — melainkan tidak tahu bahwa ia sudah tertulis.
 *
 * **Yang TIDAK dilakukan skrip ini:**
 *   - Tidak menyentuh `match_score`. Setelah menulis, jalankan
 *     `npm run ukur:dampak-skoring` (mengukur, tidak menulis) lalu
 *     `npm run db:recompute` — kalau tidak, skor kandidat masih memakai asesmen lama.
 *   - Tidak membuat baris `pegawai` baru. NIP yang ada di eNom tapi belum ada di
 *     `pegawai` dilaporkan sebagai `TANPA_PEGAWAI`, bukan disisipkan diam-diam:
 *     menambah pegawai adalah keputusan data master, bukan efek samping sinkron.
 *   - Tidak menulis `nilai_potensial_x` dari sumber. eNom mengirim `nilai_potkom`
 *     yang bisa >100 (terukur 130,73); X selalu turunan potkom setelah clamp,
 *     dan selisihnya tercatat sebagai temuan. Lihat catatan skala di CLAUDE.md.
 */

import { config } from 'dotenv'
import mysql from 'mysql2/promise'

config({ path: '.env.local' })
config({ path: '.env' })

import { ambilAsesmen, bacaKonfigurasi, GalatEnom } from '@/lib/enom/klien'
import { petakanSemua, type AsesmenTerpetakan } from '@/lib/enom/pemetaan'

const arg = process.argv.slice(2)
const TULIS = arg.includes('--tulis')
const nipTerpilih = arg.filter((a) => /^\d{18}$/.test(a))
const idxBatas = arg.indexOf('--batas')
const BATAS = idxBatas >= 0 ? Number(arg[idxBatas + 1]) || 500 : 500
const TAHUN_SEKARANG = new Date().getFullYear()

type Aksi = 'INSERT' | 'UPDATE' | 'SAMA' | 'TANPA_PEGAWAI'

interface Rencana {
  nip: string
  aksi: Aksi
  pegawaiId: number | null
  terpetakan: AsesmenTerpetakan
  sebelum: Record<string, unknown> | null
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

/** Bandingkan nilai numerik DB (datang sebagai string dari driver) dengan hasil hitung. */
function samaAngka(db: unknown, baru: number | null): boolean {
  if (db === null || db === undefined) return baru === null
  if (baru === null) return false
  return Math.abs(Number(db) - baru) < 0.005
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
  const { ambilPengaturan, parameterSkoringDari } = await import('@/lib/pengaturan')
  const cfg = bacaKonfigurasi()
  const db = await koneksi()

  console.log(`\n=== SINKRON eNOM → asesmen_talenta ===`)
  console.log(`    mode      : ${TULIS ? '*** MENULIS ***' : 'dry-run (tidak menulis)'}`)
  console.log(`    sumber    : ${cfg.url}`)
  console.log(`    database  : ${process.env.DATABASE_NAME}\n`)

  // ── NIP yang akan ditanyakan ───────────────────────────────────────────────
  let nip: string[]
  if (nipTerpilih.length > 0) {
    nip = nipTerpilih
  } else {
    const [baris] = await db.query<mysql.RowDataPacket[]>(
      'SELECT nip FROM pegawai WHERE nip REGEXP "^[0-9]{18}$" ORDER BY id LIMIT ?',
      [BATAS],
    )
    nip = baris.map((b) => String(b.nip))
  }
  console.log(`  ${nip.length} NIP akan ditanyakan ke eNom`)

  // ── Ambil & petakan ────────────────────────────────────────────────────────
  /*
    Galat yang berlaku untuk SELURUH jalan (auth, konfigurasi, endpoint hilang)
    sengaja dilempar `ambilAsesmen` — meneruskan 36 permintaan ke alamat yang
    sudah tidak dilayani hanya membanjiri log eNom tanpa satu pun bisa berhasil.
    Ditangkap DI SINI supaya yang dilihat operator adalah kalimat yang bisa
    ditindak, bukan stack trace. Stack trace pada kegagalan yang sudah dipahami
    membuat orang mengira aplikasinya rusak, padahal yang perlu dilakukan hanya
    meminta alamat baru ke pengelola sumber.
  */
  let rekaman, gagal
  try {
    ;({ rekaman, gagal } = await ambilAsesmen(nip, { konfigurasi: cfg }))
  } catch (e) {
    if (!(e instanceof GalatEnom)) throw e
    console.log(`\n  GAGAL TOTAL [${e.sebab}] — tidak ada yang ditulis.\n`)
    for (const baris of e.message.split('\n')) console.log(`  ${baris}`)
    console.log('')
    await db.end()
    process.exit(1)
  }
  for (const g of gagal) console.log(`  ! batch gagal [${g.galat.sebab}]: ${g.galat.message}`)

  const { hasil, temuan } = petakanSemua(rekaman, { tahunSekarang: TAHUN_SEKARANG, ...parameterSkoringDari(await ambilPengaturan()) })
  const tidakDitemukan = nip.length - rekaman.length
  console.log(
    `  eNom menjawab ${rekaman.length} · terpetakan ${hasil.length} · tidak ada di eNom ${tidakDitemukan} · temuan ${temuan.length}`,
  )

  if (hasil.length === 0) {
    /*
      Kesimpulannya BERGANTUNG pada sebab kegagalannya, dan itu bukan detail.

      Versi sebelumnya selalu menyimpulkan "populasi dev sebagian besar NIP hasil
      generator" — menyalahkan DATA. Pada 22 Agu 2026 kesimpulan itu keliru dan
      memakan waktu: endpoint-nya yang lenyap (HTTP 404 berisi halaman HTML pada
      keempat varian path & metode, termasuk untuk NIP contoh yang sebelumnya
      berhasil). Tidak ada daftar NIP yang bisa memperbaiki alamat yang sudah
      tidak dilayani.
    */
    const endpointHilang = gagal.some((g) => g.galat.sebab === 'endpoint')
    console.log(
      endpointHilang
        ? '\n  ENDPOINT eNom TIDAK ADA LAGI — bukan soal NIP, dan bukan soal jaringan.\n' +
            `  ${gagal[0]?.galat.message.split('\n')[0] ?? ''}\n` +
            '  Host-nya hidup dan me-routing; X-Secret serta bentuk permintaan kita sudah sesuai\n' +
            '  contoh resmi mereka (lihat CLAUDE.md §API eNominasi). Yang dibutuhkan: ALAMAT\n' +
            '  endpoint yang berlaku sekarang dari pengelola eNom. Sampai itu ada, jalur ini\n' +
            '  tidak bisa dijalankan sama sekali.\n'
        : '\n  Tidak ada satu pun NIP yang dijawab eNom, jadi tidak ada yang bisa disinkronkan.\n' +
            '  Ini BUKAN kegagalan teknis: populasi dev sebagian besar NIP hasil generator, dan\n' +
            '  eNom hanya memuat pegawai yang sudah punya rekaman asesmen di sana. Minta daftar\n' +
            '  NIP yang ada di eNom ke pengelolanya, lalu ulangi.\n',
    )
    await db.end()
    return
  }

  // ── Susun rencana per NIP ──────────────────────────────────────────────────
  const [pegawai] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, nip FROM pegawai WHERE nip IN (?)',
    [hasil.map((h) => h.nip)],
  )
  const idPerNip = new Map(pegawai.map((p) => [String(p.nip), Number(p.id)]))

  const rencana: Rencana[] = []
  for (const h of hasil) {
    const pegawaiId = idPerNip.get(h.nip) ?? null
    if (pegawaiId === null) {
      rencana.push({ nip: h.nip, aksi: 'TANPA_PEGAWAI', pegawaiId: null, terpetakan: h, sebelum: null })
      continue
    }

    // Tidak ada UNIQUE (pegawai_id, tahun_asesmen) di skema — hanya indeks biasa.
    // Jadi upsert HARUS baca dulu; `ON DUPLICATE KEY UPDATE` di sini tidak akan
    // pernah menemukan duplikat dan akan menumpuk baris ganda tiap kali dijalankan.
    const [ada] = await db.query<mysql.RowDataPacket[]>(
      `SELECT id, nilai_kinerja_y, nilai_potensial_x, potkom, nilai_integritas,
              nilai_talenta, kotak_9, kotak_9_sumber, rating_kinerja, status_asesmen
         FROM asesmen_talenta
        WHERE pegawai_id = ? AND tahun_asesmen = ? LIMIT 1`,
      [pegawaiId, h.asesmen.tahunAsesmen],
    )
    const sebelum = ada[0] ?? null
    const a = h.asesmen
    const sama =
      sebelum !== null &&
      samaAngka(sebelum.nilai_kinerja_y, a.nilaiKinerjaY) &&
      samaAngka(sebelum.nilai_potensial_x, a.nilaiPotensialX) &&
      samaAngka(sebelum.potkom, a.potkom) &&
      samaAngka(sebelum.nilai_integritas, a.nilaiIntegritas) &&
      Number(sebelum.kotak_9) === a.kotak9 &&
      samaAngka(sebelum.kotak_9_sumber, h.kotak9Sumber) &&
      String(sebelum.status_asesmen) === a.statusAsesmen

    rencana.push({
      nip: h.nip,
      aksi: sebelum === null ? 'INSERT' : sama ? 'SAMA' : 'UPDATE',
      pegawaiId,
      terpetakan: h,
      sebelum,
    })
  }

  // ── Laporan ────────────────────────────────────────────────────────────────
  const hitung = (a: Aksi) => rencana.filter((r) => r.aksi === a).length
  console.log(
    `\n  rencana: ${hitung('INSERT')} INSERT · ${hitung('UPDATE')} UPDATE · ` +
      `${hitung('SAMA')} sudah sama · ${hitung('TANPA_PEGAWAI')} tanpa baris pegawai`,
  )

  console.log('\n  NIP                aksi           Y    X    K9  K9src  sebelum (Y/X/K9)')
  for (const r of rencana.slice(0, 30)) {
    const a = r.terpetakan.asesmen
    const sblm = r.sebelum
      ? `${r.sebelum.nilai_kinerja_y}/${r.sebelum.nilai_potensial_x}/${r.sebelum.kotak_9}`
      : '—'
    console.log(
      `  ${r.nip.padEnd(19)}${r.aksi.padEnd(15)}${String(a.nilaiKinerjaY).padEnd(5)}` +
        `${String(a.nilaiPotensialX).padEnd(5)}${String(a.kotak9).padEnd(4)}` +
        `${String(r.terpetakan.kotak9Sumber ?? '—').padEnd(7)}${sblm}`,
    )
  }
  if (rencana.length > 30) console.log(`  … ${rencana.length - 30} baris lain`)

  if (temuan.length) {
    const per = new Map<string, number>()
    for (const t of temuan) per.set(t.kode, (per.get(t.kode) ?? 0) + 1)
    console.log('\n  temuan:')
    for (const [k, n] of [...per].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${String(n).padStart(4)}× ${k}`)
    }
  }

  // ── Tulis (hanya dengan --tulis) ───────────────────────────────────────────
  if (!TULIS) {
    console.log(
      '\n  DRY-RUN — tidak ada baris yang ditulis.' +
        '\n  Jalankan ulang dengan --tulis kalau rencana di atas sudah benar.' +
        '\n  Setelah menulis: `npm run ukur:dampak-skoring` lalu `npm run db:recompute`,' +
        '\n  dan catat ulang baseline verifikasi:data / verifikasi:skoring di CLAUDE.md.\n',
    )
    await db.end()
    return
  }

  const perlu = rencana.filter((r) => r.aksi === 'INSERT' || r.aksi === 'UPDATE')
  // Format DATETIME MySQL eksplisit, bukan objek Date: driver menolak Date di
  // dalam larik nilai bercampur, dan `toISOString()` menyisipkan 'T' + 'Z' yang
  // membuat MySQL menyimpan waktu bergeser tanpa memberi peringatan apa pun.
  const mulai = new Date().toISOString().slice(0, 19).replace('T', ' ')
  let ditulis = 0
  let galatTulis: string | null = null

  // Satu transaksi: sinkronisasi setengah jalan menghasilkan campuran asesmen
  // lama & baru yang tidak bisa dibedakan dari data yang memang beragam.
  try {
    await db.beginTransaction()
    for (const r of perlu) {
      const a = r.terpetakan.asesmen
      const nilai = [
        r.pegawaiId,
        a.tahunAsesmen,
        a.jenisAsesmen ?? 'Tidak Diketahui',
        a.statusAsesmen,
        a.nilaiKinerjaY,
        a.nilaiPotensialX,
        a.potkom,
        a.nilaiIntegritas,
        a.nilaiTalenta,
        a.kotak9,
        r.terpetakan.kotak9Sumber,
        r.terpetakan.tahunKinerja,
        r.terpetakan.predikatKinerja
          ? // rating_kinerja adalah ENUM Title Case; predikat eNom HURUF BESAR.
            r.terpetakan.predikatKinerja
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : 'Baik',
      ]
      if (r.aksi === 'INSERT') {
        await db.execute(
          `INSERT INTO asesmen_talenta
             (pegawai_id, tahun_asesmen, jenis_asesmen, status_asesmen, nilai_kinerja_y,
              nilai_potensial_x, potkom, nilai_integritas, nilai_talenta, kotak_9,
              kotak_9_sumber, tahun_kinerja, rating_kinerja, sumber_sync)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?, 'eNominasi')`,
          nilai,
        )
      } else {
        await db.execute(
          `UPDATE asesmen_talenta SET
             jenis_asesmen=?, status_asesmen=?, nilai_kinerja_y=?, nilai_potensial_x=?,
             potkom=?, nilai_integritas=?, nilai_talenta=?, kotak_9=?, kotak_9_sumber=?,
             tahun_kinerja=?, rating_kinerja=?, sumber_sync='eNominasi'
           WHERE id=?`,
          [...nilai.slice(2), Number(r.sebelum!.id)],
        )
      }
      ditulis++
    }
    await db.commit()
  } catch (e) {
    await db.rollback()
    galatTulis = e instanceof Error ? e.message : String(e)
    ditulis = 0
  }

  // Jejak WAJIB — `sync_log.sumber_sistem` sudah punya nilai 'eNominasi' sejak
  // skema awal. Sinkronisasi tanpa jejak berarti tidak ada cara menjawab
  // "kapan angka ini berubah dan dari mana" enam bulan dari sekarang.
  await db.execute(
    `INSERT INTO sync_log
       (sumber_sistem, jenis_data, status, jumlah_baris, mulai_pada, selesai_pada, catatan_error)
     VALUES ('eNominasi', 'asesmen_talenta', ?, ?, ?, NOW(), ?)`,
    [
      galatTulis ? 'GAGAL' : gagal.length > 0 || tidakDitemukan > 0 ? 'SEBAGIAN' : 'SUKSES',
      ditulis,
      mulai,
      galatTulis ??
        (temuan.length || tidakDitemukan
          ? `${temuan.length} temuan · ${tidakDitemukan} NIP tidak ada di eNom`
          : null),
    ],
  )

  console.log(
    galatTulis
      ? `\n  GAGAL menulis — transaksi di-rollback, nol baris berubah: ${galatTulis}\n`
      : `\n  ${ditulis} baris ditulis. Jejak masuk sync_log.` +
          '\n  LANJUTKAN: `npm run ukur:dampak-skoring` lalu `npm run db:recompute`,' +
          '\n  dan catat ulang baseline verifikasi:data / verifikasi:skoring di CLAUDE.md.\n',
  )

  await db.end()
  if (galatTulis) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
