/**
 * Impor data Talent Pool Eselon 2 & 3 dari `doc/data/talentpool-es23.json`
 * — **DRY-RUN bawaan**.
 *
 *   npm run impor:talentpool              # laporkan rencananya, TIDAK menulis
 *   npm run impor:talentpool -- --tulis   # benar-benar menulis
 *
 * JSON-nya dihasilkan `scripts/xlsx-ke-json.py` dari berkas Excel aslinya. Dua
 * langkah, bukan satu: berkas Excel akan direvisi berkali-kali, dan yang perlu
 * ditinjau saat itu adalah **selisih JSON**-nya, bukan biner 9 MB.
 *
 * **Yang ditulis:** `unit_organisasi` & `jabatan` yang belum ada (master),
 * `pegawai`, `riwayat_jabatan`, `riwayat_pendidikan`, `pegawai.riwayat_diklat`
 * (JSON), dan `asesmen_talenta`.
 *
 * **Yang TIDAK ditulis, dan alasannya:**
 * - **Foto.** Sudah diekstrak ke `doc/data/foto/<nip>.png` tapi tidak dipasang ke
 *   aplikasi: strategi penyimpanan berkas belum diputuskan, dan foto pegawai
 *   adalah data pribadi (UU PDP No. 27/2022) sehingga tidak boleh diletakkan di
 *   `public/` yang dilayani tanpa autentikasi.
 * - **`match_score`.** Skor lahir dari mesin rubrik, bukan dari impor. Setelah
 *   ini jalankan Hitung Ulang di tiap jabatan target.
 * - **Nilai kinerja mentah per triwulan** (`kinerja_periode`). Excel hanya memuat
 *   predikat akhir, bukan nilai TW1–TW3; mengarang barisnya berarti mengarang data.
 *
 * **Aturan bisnis TIDAK ditulis ulang di sini.** Kotak 9, clamp potkom, skala
 * integritas, dan status masa berlaku semuanya lewat `normalisasiAsesmen()` —
 * implementasi yang sama dengan importer & jalur eNominasi.
 */

import { readFileSync } from 'node:fs'

import { config } from 'dotenv'
import mysql from 'mysql2/promise'

config({ path: '.env.local' })
config({ path: '.env' })

import { normalisasiAsesmen } from '@/lib/importer/normalisasi-baris'
import { skorPredikat } from '@/lib/scoring'

const TULIS = process.argv.includes('--tulis')
const SUMBER = 'doc/data/talentpool-es23.json'

interface Rekaman {
  no: string
  nama: string
  nip: string
  tmtGolongan: string
  golongan: string
  eselon: string
  namaJabatan: string
  unitKerja: string
  tmtJabatan: string
  sekolah: string
  bidangStudi: string
  tingkatPendidikan: string
  jurusan: string
  riwayatPendidikan: string
  tahunAsesmen: string
  jenisAsesmen: string
  statusAsesmen: string
  potkom: string
  ratingKinerja: string
  kotak9Sumber: string
  riwayatJabatan: Array<{ nama: string; masaKerja: string }>
  riwayatDiklat: string[]
  foto: string
}

/**
 * Golongan → pangkat, aturan kepegawaian ASN yang baku.
 *
 * Ada di sini dan bukan di `lib/` karena hanya importir yang membutuhkannya:
 * `pegawai.pangkat` normalnya diisi manusia atau datang dari sumber. Kalau suatu
 * hari aplikasi perlu menurunkannya sendiri, pindahkan ke `lib/` — jangan disalin.
 */
const PANGKAT: Record<string, string> = {
  'III/a': 'Penata Muda',
  'III/b': 'Penata Muda Tingkat I',
  'III/c': 'Penata',
  'III/d': 'Penata Tingkat I',
  'IV/a': 'Pembina',
  'IV/b': 'Pembina Tk. I',
  'IV/c': 'Pembina Utama Muda',
  'IV/d': 'Pembina Utama Madya',
  'IV/e': 'Pembina Utama',
}

/** `II.a` → `II`. Enum DB hanya menyimpan tingkat eselonnya, bukan sub-a/b-nya. */
function eselonDb(v: string): string {
  const m = /^(I{1,3}V?|IV)/.exec(v.trim().toUpperCase())
  return m ? m[1]! : 'NON_ESELON'
}

/** `01-10-2022` → `2022-10-01`. Kosong/tak terbaca → null, BUKAN tanggal hari ini. */
function tanggal(v: string): string | null {
  const m = /^(\d{2})-(\d{2})-(\d{4})$/.exec(v.trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

const TINGKAT = new Set(['SLTA', 'D3', 'S1_D4', 'S2', 'S3'])
function tingkat(v: string): string {
  const s = v.trim().toUpperCase().replace('/', '_').replace('S1_D4', 'S1_D4')
  return TINGKAT.has(s) ? s : 'S1_D4'
}

/** `VALID`/`Valid` → `Berlaku`. Sumbernya tidak konsisten kapitalisasinya. */
function statusAsesmen(v: string): string {
  const s = v.trim().toLowerCase()
  if (s === 'valid') return 'Berlaku'
  if (s === 'expired') return 'Expired'
  return 'Draft'
}

/** `SANGAT BAIK` → `Sangat Baik`. Enum DB Title Case. */
function predikat(v: string): string {
  const s = v.trim().toLowerCase()
  return s.replace(/(^|\s)\S/g, (t) => t.toUpperCase())
}

/**
 * `S2 - MAGISTER TEKNIK SIPIL (2014)` → satu baris riwayat pendidikan.
 * Baris yang tidak cocok polanya DILEWATI dan dilaporkan, bukan dipaksa masuk
 * dengan bidang studi berisi seluruh teksnya.
 */
function uraiPendidikan(teks: string): Array<{ jenjang: string; bidang: string; tahun: number | null }> {
  const hasil: Array<{ jenjang: string; bidang: string; tahun: number | null }> = []
  for (const baris of teks.split('\n')) {
    const b = baris.trim()
    if (b === '') continue
    const m = /^([A-Za-z0-9/]+)\s*-\s*(.*?)(?:\s*\((\d{4})\))?$/.exec(b)
    if (!m) continue
    const j = tingkat(m[1]!)
    const bidang = (m[2] ?? '').replace(/\s+/g, ' ').trim()
    hasil.push({ jenjang: j, bidang: bidang === '' ? '(tidak disebutkan)' : bidang, tahun: m[3] ? Number(m[3]) : null })
  }
  return hasil
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

const samakan = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

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
  const data: Rekaman[] = JSON.parse(readFileSync(SUMBER, 'utf8'))
  const db = await koneksi()
  const mulai = new Date()
  // Ambang Kotak 9 dari `pengaturan_sistem`, bukan dari konstanta: importir
  // menulis `kotak_9` yang tersimpan, jadi ia wajib memakai angka yang sama
  // dengan yang dipakai halaman saat membacanya.
  const ambang = ambangSumbuDari(await ambilPengaturan())

  console.log('\n=== IMPOR TALENT POOL ES 2 & 3 ===')
  console.log(`    mode     : ${TULIS ? '*** MENULIS ***' : 'dry-run (tidak menulis)'}`)
  console.log(`    sumber   : ${SUMBER} (${data.length} pegawai)`)
  console.log(`    database : ${process.env.DATABASE_NAME}\n`)

  const [unitDb] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, nama_unit FROM unit_organisasi',
  )
  const [jabDb] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, nama_jabatan FROM jabatan',
  )
  const [pegDb] = await db.query<mysql.RowDataPacket[]>('SELECT nip FROM pegawai')
  const [kodeDb] = await db.query<mysql.RowDataPacket[]>('SELECT kode_jabatan FROM jabatan')
  const kodeTerpakai = new Set(kodeDb.map((k) => String(k.kode_jabatan)))
  const petaUnit = new Map(unitDb.map((u) => [samakan(String(u.nama_unit)), Number(u.id)]))
  const petaJab = new Map(jabDb.map((j) => [samakan(String(j.nama_jabatan)), Number(j.id)]))
  const nipAda = new Set(pegDb.map((p) => String(p.nip)))

  const unitBaru = [...new Set(data.map((r) => r.unitKerja).filter((u) => u && !petaUnit.has(samakan(u))))]
  const jabBaru = [...new Set(data.map((r) => r.namaJabatan).filter((j) => j && !petaJab.has(samakan(j))))]
  const pegBaru = data.filter((r) => !nipAda.has(r.nip))
  const pegAda = data.filter((r) => nipAda.has(r.nip))

  console.log('── RENCANA ──')
  console.log(`  unit organisasi BARU : ${unitBaru.length}`)
  unitBaru.forEach((u) => console.log(`      + ${u}`))
  console.log(`  jabatan BARU         : ${jabBaru.length}`)
  console.log(`  pegawai BARU         : ${pegBaru.length}`)
  console.log(`  pegawai SUDAH ADA    : ${pegAda.length}${pegAda.length ? ' (dilewati)' : ''}`)
  console.log(`  riwayat jabatan      : ${pegBaru.reduce((a, r) => a + r.riwayatJabatan.length, 0)}`)
  console.log(`  riwayat pendidikan   : ${pegBaru.reduce((a, r) => a + uraiPendidikan(r.riwayatPendidikan).length, 0)}`)
  console.log(`  entri diklat (JSON)  : ${pegBaru.reduce((a, r) => a + r.riwayatDiklat.length, 0)}`)
  console.log(`  asesmen              : ${pegBaru.length}`)

  // Temuan normalisasi dilaporkan SEBELUM menulis — potkom >100 di sumber ini
  // sama seperti eNominasi, dan itu keputusan bisnis yang belum dijawab.
  const temuan: string[] = []
  for (const r of pegBaru) {
    const y = skorPredikat(predikat(r.ratingKinerja))
    const hasil = normalisasiAsesmen(
      {
        tahunAsesmen: Number(r.tahunAsesmen),
        jenisAsesmen: r.jenisAsesmen,
        statusAsesmen: statusAsesmen(r.statusAsesmen),
        nilaiKinerjaY: y ?? 0,
        potkom: Number(r.potkom),
        nilaiIntegritas: null,
        kotak9Sumber: r.kotak9Sumber === '' ? null : Number(r.kotak9Sumber),
      },
      { tahunSekarang: mulai.getFullYear(), ambang },
    )
    for (const t of hasil.temuan) temuan.push(`${r.nama}: ${t.kode} — ${t.keterangan}`)
  }
  if (temuan.length > 0) {
    console.log(`\n── TEMUAN NORMALISASI (${temuan.length}) ──`)
    temuan.slice(0, 8).forEach((t) => console.log(`  ! ${t}`))
    if (temuan.length > 8) console.log(`  … dan ${temuan.length - 8} lainnya`)
  }

  if (!TULIS) {
    console.log('\n  DRY-RUN — tidak ada yang ditulis. Ulangi dengan `-- --tulis`.\n')
    await db.end()
    return
  }

  const [djbk] = await db.query<mysql.RowDataPacket[]>(
    "SELECT id FROM unit_organisasi WHERE kode_unit = 'DJBK' LIMIT 1",
  )
  const indukDjbk = djbk.length > 0 ? Number(djbk[0]!.id) : null

  let nUnit = 0
  let nJab = 0
  let nPeg = 0
  let nRj = 0
  let nRp = 0
  let nAs = 0

  try {
    await db.beginTransaction()

    // 1 · Unit yang belum ada → Direktorat eselon 2 di bawah DJBK.
    for (const nama of unitBaru) {
      const kode = `DIT-${samakan(nama).split(' ').filter((w) => w.length > 3).slice(1, 3).join('-').toUpperCase()}`.slice(0, 30)
      const [h] = await db.execute<mysql.ResultSetHeader>(
        `INSERT INTO unit_organisasi (kode_unit, nama_unit, parent_id, jenis, level_eselon)
         VALUES (?, ?, ?, 'DIREKTORAT', 2)`,
        [kode, nama, indukDjbk],
      )
      petaUnit.set(samakan(nama), h.insertId)
      nUnit++
    }

    // 2 · Jabatan yang belum ada, ditautkan ke unitnya.
    for (const r of data) {
      if (!r.namaJabatan || petaJab.has(samakan(r.namaJabatan))) continue
      const unitId = petaUnit.get(samakan(r.unitKerja)) ?? null
      /**
       * Kode berurutan, BUKAN turunan NIP.
       *
       * Versi pertama memakai enam digit terakhir NIP — dan langsung gagal:
       * dua pegawai berakhiran `122001`, sementara `kode_jabatan` UNIQUE. Yang
       * menyelamatkan bukan pemeriksaan saya melainkan transaksinya (rollback,
       * nol baris berubah). Turunan dari data orang tidak pernah aman sebagai
       * kunci unik entitas LAIN — jabatan bukan milik satu pegawai.
       */
      let urut = kodeTerpakai.size + 1
      let kode = ''
      do {
        kode = `JAB-ES23-${String(urut++).padStart(3, '0')}`
      } while (kodeTerpakai.has(kode))
      kodeTerpakai.add(kode)
      const [h] = await db.execute<mysql.ResultSetHeader>(
        `INSERT INTO jabatan (kode_jabatan, nama_jabatan, unit_organisasi_id, jenis_jabatan,
                              jenjang, eselon, status_jabatan)
         VALUES (?, ?, ?, 'STRUKTURAL', ?, ?, 'TERISI')`,
        [kode, r.namaJabatan, unitId, r.eselon, eselonDb(r.eselon)],
      )
      petaJab.set(samakan(r.namaJabatan), h.insertId)
      nJab++
    }

    // 3 · Pegawai + seluruh riwayatnya.
    for (const r of pegBaru) {
      const jabatanId = petaJab.get(samakan(r.namaJabatan)) ?? null
      const [hp] = await db.execute<mysql.ResultSetHeader>(
        `INSERT INTO pegawai
           (nip, nama_lengkap, golongan, tmt_golongan, pangkat, jabatan_id, tmt_jabatan,
            sekolah_terakhir, bidang_studi_terakhir, tingkat_pendidikan, status_aktif,
            sumber_sinkron, riwayat_diklat)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'AKTIF', 'manual', CAST(? AS JSON))`,
        [
          r.nip,
          r.nama,
          r.golongan,
          tanggal(r.tmtGolongan),
          PANGKAT[r.golongan] ?? r.golongan,
          jabatanId,
          tanggal(r.tmtJabatan),
          r.sekolah || null,
          r.jurusan || r.bidangStudi || null,
          tingkat(r.tingkatPendidikan),
          JSON.stringify(r.riwayatDiklat),
        ],
      )
      const pegawaiId = hp.insertId
      nPeg++

      let urutan = 1
      for (const rj of r.riwayatJabatan) {
        await db.execute(
          `INSERT INTO riwayat_jabatan
             (pegawai_id, urutan, jabatan_nama_mentah, jabatan_id, unit_kerja_mentah)
           VALUES (?, ?, ?, ?, ?)`,
          [pegawaiId, urutan++, rj.nama, petaJab.get(samakan(rj.nama)) ?? null, r.unitKerja || null],
        )
        nRj++
      }

      let urutP = 1
      for (const p of uraiPendidikan(r.riwayatPendidikan)) {
        await db.execute(
          `INSERT INTO riwayat_pendidikan
             (pegawai_id, urutan, jenjang_pendidikan, bidang_studi, nama_sekolah, tahun_lulus)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [pegawaiId, urutP++, p.jenjang, p.bidang, urutP === 2 ? r.sekolah || null : null, p.tahun],
        )
        nRp++
      }

      const y = skorPredikat(predikat(r.ratingKinerja)) ?? 0
      const a = normalisasiAsesmen(
        {
          tahunAsesmen: Number(r.tahunAsesmen),
          jenisAsesmen: r.jenisAsesmen,
          statusAsesmen: statusAsesmen(r.statusAsesmen),
          nilaiKinerjaY: y,
          potkom: Number(r.potkom),
          nilaiIntegritas: null,
          kotak9Sumber: r.kotak9Sumber === '' ? null : Number(r.kotak9Sumber),
        },
        { tahunSekarang: mulai.getFullYear(), ambang },
      ).nilai
      await db.execute(
        `INSERT INTO asesmen_talenta
           (pegawai_id, tahun_asesmen, jenis_asesmen, status_asesmen, nilai_kinerja_y,
            nilai_potensial_x, potkom, nilai_integritas, nilai_talenta, kotak_9,
            kotak_9_sumber, tahun_kinerja, rating_kinerja, sumber_sync)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
        [
          pegawaiId,
          a.tahunAsesmen,
          a.jenisAsesmen,
          a.statusAsesmen,
          a.nilaiKinerjaY,
          a.nilaiPotensialX,
          a.potkom,
          a.nilaiIntegritas,
          a.nilaiTalenta,
          a.kotak9,
          r.kotak9Sumber === '' ? null : Number(r.kotak9Sumber),
          Number(r.tahunAsesmen),
          predikat(r.ratingKinerja),
        ],
      )
      nAs++
    }

    await db.execute(
      `INSERT INTO sync_log
         (sumber_sistem, jenis_data, status, jumlah_baris, mulai_pada, selesai_pada, catatan_error)
       VALUES ('Manual', 'pegawai', 'SUKSES', ?, ?, NOW(), ?)`,
      [nPeg, mulai, `Impor Excel Talent Pool ES 2 & 3 · ${temuan.length} temuan normalisasi`],
    )

    await db.commit()
  } catch (e) {
    await db.rollback()
    console.log('\n  GAGAL — transaksi di-rollback, nol baris berubah:', e instanceof Error ? e.message : String(e), '\n')
    await db.end()
    process.exit(1)
  }

  console.log('\n── DITULIS ──')
  console.log(`  unit ${nUnit} · jabatan ${nJab} · pegawai ${nPeg} · riwayat jabatan ${nRj} · riwayat pendidikan ${nRp} · asesmen ${nAs}`)
  console.log('\n  LANJUTKAN: jalankan Hitung Ulang di tiap jabatan target — skor & kelayakan')
  console.log('  belum memuat pegawai baru ini sampai itu dilakukan.\n')
  await db.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
