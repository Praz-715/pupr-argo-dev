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

import { klasifikasiUnit, kodeUnitUnik, samakan } from './_unit-organisasi'

import { config } from 'dotenv'
import mysql from 'mysql2/promise'

config({ path: '.env.local' })
config({ path: '.env' })

import { normalisasiAsesmen } from '@/lib/importer/normalisasi-baris'
import { skorPredikat } from '@/lib/scoring'

const TULIS = process.argv.includes('--tulis')
/**
 * `--selaraskan-pendidikan`: untuk pegawai yang SUDAH ADA, ganti seluruh baris
 * `riwayat_pendidikan`-nya dengan hasil parse ulang dari JSON.
 *
 * Ada karena parser jenjang pernah salah: `tingkat()` mengembalikan `'S1_D4'`
 * untuk token apa pun yang tak dikenal, sehingga 58 baris SLTP + 57 baris SD
 * tercatat sebagai S1/D4 dan 10 baris `SM/D-3` kehilangan D3-nya — 125 dari 340
 * baris. Menghapus lalu mengimpor ulang 79 pegawai untuk membetulkannya berarti
 * membuang asesmen & skor mereka juga; mode ini menyentuh satu tabel saja.
 *
 * Aman diulang: ia MENGGANTI (hapus lalu tulis), bukan menambah, jadi menjalankannya
 * dua kali menghasilkan keadaan yang sama.
 */
const SELARASKAN_PENDIDIKAN = process.argv.includes('--selaraskan-pendidikan')
/**
 * `--selaraskan-riwayat`: untuk pegawai yang SUDAH ADA, tulis ulang seluruh baris
 * `riwayat_jabatan`-nya dari JSON.
 *
 * Ada karena importir versi awal tidak pernah mengisi `tanggal_mulai`/`tanggal_akhir`
 * — 670 baris masuk tanpa tanggal padahal berkas Pengawas memuat serialnya lengkap.
 * Sama seperti mode pendidikan: MENGGANTI, jadi aman diulang.
 */
const SELARASKAN_RIWAYAT = process.argv.includes('--selaraskan-riwayat')
/**
 * Berkas sumber & prefiks kode jabatan bisa ditentukan — sudah ada DUA berkas.
 *
 *   npm run impor:talentpool                              # ES 2 & 3 (bawaan)
 *   npm run impor:talentpool -- --sumber doc/data/talentpool-pengawas.json \
 *                               --prefiks JAB-ES4 --tulis  # Pengawas / Eselon IV
 *
 * Prefiks WAJIB berbeda per berkas. Kalau dua berkas memakai `JAB-ES23-###`, kode
 * jabatannya bertabrakan pada nomor urut yang sama — `kode_jabatan` UNIQUE, jadi
 * yang terjadi bukan data tercampur melainkan transaksi gagal di tengah. Lebih
 * penting lagi: prefiks itu satu-satunya jejak dari berkas mana sebuah jabatan
 * datang, dan itu yang dipakai untuk memeriksa hasil impor belakangan.
 */
const argSumber = process.argv.indexOf('--sumber')
const SUMBER = argSumber !== -1 ? process.argv[argSumber + 1]! : 'doc/data/talentpool-es23.json'
const argPrefiks = process.argv.indexOf('--prefiks')
const PREFIKS_JAB = argPrefiks !== -1 ? process.argv[argPrefiks + 1]! : 'JAB-ES23'

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
  riwayatJabatan: Array<{
    nama: string
    masaKerja: string
    tmtMulaiSerial?: string
    tmtAkhirSerial?: string
  }>
  riwayatDiklat: string[]
  foto: string
  /**
   * Asesmen per JENJANG — berkas Kabalai & Fungsional (2026) ke atas.
   *
   * Opsional karena dua berkas yang sudah diimpor (`talentpool-es23.json` &
   * `talentpool-pengawas.json`) dihasilkan sebelum ekstraktor mengenal bentuk
   * ini. Kalau tidak ada, importir menyusun satu entri dari field tunggal —
   * jadi berkas lama tetap menghasilkan baris yang sama persis.
   */
  asesmen?: Array<{
    jenjangAsesmen: string
    potkom: string
    kotak9Sumber: string
    tahunAsesmen: string
    jenisAsesmen: string
    statusAsesmen: string
  }>
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

/**
 * Alias jenjang yang dipakai sumber tapi bukan nilai enum DB.
 *
 * `SM/D-3` adalah D3 — dan sebelumnya ia hilang menjadi S1/D4, yaitu MENAIKKAN
 * jenjang pendidikan 10 orang tanpa jejak apa pun.
 */
const ALIAS_TINGKAT: Record<string, string> = {
  SM_D_3: 'D3',
  SM_D: 'D3',
  D_III: 'D3',
  DIII: 'D3',
  D3: 'D3',
  D_IV: 'S1_D4',
  DIV: 'S1_D4',
  D4: 'S1_D4',
  S1: 'S1_D4',
  S1_D4: 'S1_D4',
}

/**
 * Jenjang DI BAWAH SLTA. Enum DB tidak punya slot untuk keduanya, dan itu
 * disengaja: manajemen talenta tidak menilai pendidikan dasar.
 *
 * Yang penting: baris ini DILEWATI dan DILAPORKAN, bukan dinaikkan. Sebelumnya
 * `tingkat()` mengembalikan `'S1_D4'` untuk apa pun yang tak dikenal, sehingga
 * **58 baris SLTP dan 57 baris SD tercatat sebagai S1/D4** — 115 dari 340 baris
 * riwayat pendidikan mengklaim gelar sarjana yang tidak pernah ada. Tidak ada
 * galat, tidak ada peringatan; profil orangnya saja jadi salah.
 */
const DI_BAWAH_SLTA = new Set(['SD', 'SLTP', 'SMP', 'MI', 'MTS'])
/**
 * Token jenjang dari sumber → nilai enum DB, atau `null` kalau tidak bisa
 * dipetakan. **Tidak pernah menebak.**
 */
function tingkat(v: string): string | null {
  const s = v.trim().toUpperCase().replace(/[/\-\s]+/g, '_')
  if (DI_BAWAH_SLTA.has(s)) return null
  if (ALIAS_TINGKAT[s]) return ALIAS_TINGKAT[s]!
  return TINGKAT.has(s) ? s : null
}

/** Jenjang untuk kolom `pegawai.tingkat_pendidikan`, yang WAJIB terisi. */
function tingkatWajib(v: string): string {
  return tingkat(v) ?? 'S1_D4'
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
interface BarisPendidikan {
  jenjang: string
  bidang: string
  tahun: number | null
}

/**
 * Baris yang DILEWATI beserta alasannya — dilaporkan, tidak ditelan.
 *
 * Regex jenjangnya memuat `-` dan spasi karena sumber menulis `SM/D-3`; pola
 * lama `[A-Za-z0-9/]+` berhenti di tanda hubung sehingga token itu terpotong.
 */
const lewatPendidikan: string[] = []

function uraiPendidikan(teks: string): BarisPendidikan[] {
  const hasil: BarisPendidikan[] = []
  for (const baris of teks.split('\n')) {
    const b = baris.trim()
    if (b === '') continue
    const m = /^([A-Za-z0-9/\- ]+?)\s*-\s*(.*?)(?:\s*\((\d{4})\))?$/.exec(b)
    if (!m) {
      lewatPendidikan.push(`tak terurai: ${b.slice(0, 40)}`)
      continue
    }
    const j = tingkat(m[1]!)
    if (j === null) {
      lewatPendidikan.push(`${m[1]!.trim()} (di bawah SLTA / tak dikenali): ${b.slice(0, 40)}`)
      continue
    }
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


/**
 * Serial tanggal Excel → `YYYY-MM-DD`.
 *
 * Epoch-nya **1899-12-30**, bukan 1900-01-01: Excel memperlakukan 1900 sebagai
 * tahun kabisat yang sebenarnya bukan, dan menggeser epoch dua hari adalah cara
 * baku mengompensasinya. Diverifikasi terhadap data sendiri — serial `45940`
 * menghasilkan `2025-10-10`, sama dengan kolom TMT JABATAN pegawai itu.
 *
 * Tanpa fungsi ini seluruh 441 entri riwayat jabatan dari berkas Pengawas masuk
 * DB dengan `tanggal_mulai` NULL, padahal sumbernya punya tanggalnya — dan
 * indikator `LAMA_JABATAN` lalu tidak bisa dihitung dari riwayat, hanya dari
 * `tmt_jabatan` yang cuma mewakili jabatan terakhir.
 */
function dariSerialExcel(v: string): string | null {
  const n = Number(String(v).trim())
  if (!Number.isFinite(n) || n <= 0) return null
  const ms = Date.UTC(1899, 11, 30) + n * 86400000
  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().slice(0, 10)
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
  const data: Rekaman[] = JSON.parse(readFileSync(SUMBER, 'utf8'))
  const db = await koneksi()
  const mulai = new Date()
  // Ambang Kotak 9 dari `pengaturan_sistem`, bukan dari konstanta: importir
  // menulis `kotak_9` yang tersimpan, jadi ia wajib memakai angka yang sama
  // dengan yang dipakai halaman saat membacanya.
  const par = parameterSkoringDari(await ambilPengaturan())

  console.log('\n=== IMPOR TALENT POOL ES 2 & 3 ===')
  console.log(`    mode     : ${TULIS ? '*** MENULIS ***' : 'dry-run (tidak menulis)'}`)
  console.log(`    sumber   : ${SUMBER} (${data.length} pegawai)`)
  console.log(`    database : ${process.env.DATABASE_NAME}\n`)

  const [unitDb] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, nama_unit FROM unit_organisasi',
  )
  const [jabDb] = await db.query<mysql.RowDataPacket[]>(
    'SELECT id, nama_jabatan, unit_organisasi_id FROM jabatan',
  )
  const [pegDb] = await db.query<mysql.RowDataPacket[]>('SELECT nip FROM pegawai')
  const [kodeDb] = await db.query<mysql.RowDataPacket[]>('SELECT kode_jabatan FROM jabatan')
  const kodeTerpakai = new Set(kodeDb.map((k) => String(k.kode_jabatan)))
  const [kodeUnitDb] = await db.query<mysql.RowDataPacket[]>('SELECT kode_unit FROM unit_organisasi')
  const kodeUnitTerpakai = new Set(kodeUnitDb.map((k) => String(k.kode_unit)))
  const petaUnit = new Map(unitDb.map((u) => [samakan(String(u.nama_unit)), Number(u.id)]))
  /**
   * Jabatan dikunci (NAMA + UNIT), BUKAN nama saja.
   *
   * Berkas Pengawas membongkar asumsi yang selamat di berkas ES 2 & 3: ia punya
   * **3 nama jabatan** tapi **53 pasangan (jabatan, unit)** — "Kepala Subbagian
   * Umum dan Tata Usaha" ada di 41 Balai berbeda, dan masing-masing jabatan yang
   * berbeda. Dikunci nama saja, 41 pegawai akan menunjuk SATU baris jabatan yang
   * hanya bisa bermilik satu unit, sehingga 40 di antaranya tertaut ke unit yang
   * salah — dan itu merembet ke penyaring unit, lingkup Pengelola Unit, serta
   * daftar kandidat. Tidak ada yang gagal; angkanya saja yang salah.
   *
   * Untuk ES 2 & 3 hasilnya identik (namanya memang unik di sana), jadi ini bukan
   * perubahan perilaku untuk berkas lama.
   */
  const kunciJab = (nama: string, unitId: number | null) => `${samakan(nama)}@@${unitId ?? 0}`
  const petaJab = new Map(
    jabDb.map((j) => [
      kunciJab(String(j.nama_jabatan), j.unit_organisasi_id === null ? null : Number(j.unit_organisasi_id)),
      Number(j.id),
    ]),
  )
  /** Cadangan berkunci NAMA saja — dipakai riwayat jabatan, yang tidak menyebut unit. */
  const petaJabNama = new Map(jabDb.map((j) => [samakan(String(j.nama_jabatan)), Number(j.id)]))
  const nipAda = new Set(pegDb.map((p) => String(p.nip)))

  const unitBaru = [...new Set(data.map((r) => r.unitKerja).filter((u) => u && !petaUnit.has(samakan(u))))]
  // Perhitungan "jabatan baru" ikut memakai kunci (nama, unit). Unit yang belum
  // ada di DB belum punya id, jadi pasangannya dihitung dari NAMA unitnya dan
  // dianggap baru — konsisten dengan urutan eksekusi di bawah (unit dulu, lalu
  // jabatan), sebab jabatan tidak bisa dibuat sebelum unitnya ada.
  const jabBaru = [
    ...new Map(
      data
        .filter((r) => r.namaJabatan)
        .map((r) => [`${samakan(r.namaJabatan)}@@${samakan(r.unitKerja)}`, r] as const)
        .filter(([, r]) => {
          const unitId = petaUnit.get(samakan(r.unitKerja)) ?? null
          return unitId === null || !petaJab.has(kunciJab(r.namaJabatan, unitId))
        }),
    ).values(),
  ]
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
  // Satu pegawai bisa menghasilkan BEBERAPA baris asesmen (satu per jenjang,
  // doc/sql/022). Menghitungnya sebagai jumlah pegawai membuat rencana
  // menyebutkan angka yang berbeda dari yang benar-benar ditulis — dan rencana
  // yang tidak sama dengan hasilnya membuat dry-run berhenti berguna.
  const barisAsesmen = pegBaru.reduce((a, r) => a + Math.max(r.asesmen?.length ?? 1, 0), 0)
  const pegTanpaAsesmen = pegBaru.filter((r) => r.asesmen && r.asesmen.length === 0).length
  console.log(
    `  asesmen              : ${barisAsesmen} baris untuk ${pegBaru.length - pegTanpaAsesmen} pegawai` +
      (pegTanpaAsesmen ? ` · ${pegTanpaAsesmen} pegawai TANPA asesmen di sumbernya` : ''),
  )
  if (SELARASKAN_PENDIDIKAN) {
    const barisBaru = pegAda.reduce((a, r) => a + uraiPendidikan(r.riwayatPendidikan).length, 0)
    console.log(
      `  SELARASKAN pendidikan: ${pegAda.length} pegawai yang sudah ada → ${barisBaru} baris (ganti total)`,
    )
  }
  if (lewatPendidikan.length > 0) {
    // Dilaporkan, bukan ditelan: 115 di antaranya dulu masuk DB sebagai S1/D4.
    const ringkas = new Map<string, number>()
    for (const l of lewatPendidikan) {
      const kunci = l.split(':')[0]!
      ringkas.set(kunci, (ringkas.get(kunci) ?? 0) + 1)
    }
    console.log(`  baris pendidikan DILEWATI: ${lewatPendidikan.length}`)
    for (const [k, n] of [...ringkas.entries()].sort((x, y) => y[1] - x[1])) {
      console.log(`      ${String(n).padStart(4)} × ${k}`)
    }
  }

  // Temuan normalisasi dilaporkan SEBELUM menulis — potkom >100 di sumber ini
  // sama seperti eNominasi, dan itu keputusan bisnis yang belum dijawab.
  const temuan: string[] = []
  for (const r of pegBaru) {
    const y = skorPredikat(predikat(r.ratingKinerja), par.skalaPredikat)
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
      { tahunSekarang: mulai.getFullYear(), ...par },
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
      /*
        Jenis & eselon unit DISIMPULKAN dari namanya, tidak lagi selalu
        `DIREKTORAT` eselon 2.

        Versi pertama memaku keduanya karena berkas ES 2 & 3 memang hanya memuat
        Direktorat & Sekretariat. Berkas Pengawas membawa **40 Balai** (BP2JK &
        BJKW) — memasukkannya sebagai Direktorat eselon 2 akan membuat pohon
        organisasi menyatakan ada 40 direktorat baru di DJBK, dan filter unit di
        seluruh aplikasi mengikuti pohon itu. Salah di sini tidak berhenti di
        master data.
      */
      const { jenis, level } = klasifikasiUnit(nama)
      const kode = kodeUnitUnik(nama, kodeUnitTerpakai)
      const [h] = await db.execute<mysql.ResultSetHeader>(
        `INSERT INTO unit_organisasi (kode_unit, nama_unit, parent_id, jenis, level_eselon)
         VALUES (?, ?, ?, ?, ?)`,
        [kode, nama, indukDjbk, jenis, level],
      )
      petaUnit.set(samakan(nama), h.insertId)
      nUnit++
    }

    // 2 · Jabatan yang belum ada, ditautkan ke unitnya.
    for (const r of data) {
      const unitId = petaUnit.get(samakan(r.unitKerja)) ?? null
      if (!r.namaJabatan || petaJab.has(kunciJab(r.namaJabatan, unitId))) continue
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
        kode = `${PREFIKS_JAB}-${String(urut++).padStart(3, '0')}`
      } while (kodeTerpakai.has(kode))
      kodeTerpakai.add(kode)
      const [h] = await db.execute<mysql.ResultSetHeader>(
        `INSERT INTO jabatan (kode_jabatan, nama_jabatan, unit_organisasi_id, jenis_jabatan,
                              jenjang, eselon, status_jabatan)
         VALUES (?, ?, ?, 'STRUKTURAL', ?, ?, 'TERISI')`,
        [kode, r.namaJabatan, unitId, r.eselon, eselonDb(r.eselon)],
      )
      petaJab.set(kunciJab(r.namaJabatan, unitId), h.insertId)
      if (!petaJabNama.has(samakan(r.namaJabatan))) petaJabNama.set(samakan(r.namaJabatan), h.insertId)
      nJab++
    }

    // 3 · Pegawai + seluruh riwayatnya.
    for (const r of pegBaru) {
      const jabatanId =
        petaJab.get(kunciJab(r.namaJabatan, petaUnit.get(samakan(r.unitKerja)) ?? null)) ?? null
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
          // Kolom `pegawai.tingkat_pendidikan` NOT NULL, jadi di sini pakai varian
          // wajib. Ia hanya berlaku untuk pendidikan TERAKHIR, yang di sumber ini
          // selalu SLTA ke atas — bukan tempat SD/SLTP bisa muncul.
          tingkatWajib(r.tingkatPendidikan),
          JSON.stringify(r.riwayatDiklat),
        ],
      )
      const pegawaiId = hp.insertId
      nPeg++

      let urutan = 1
      for (const rj of r.riwayatJabatan) {
        await db.execute(
          `INSERT INTO riwayat_jabatan
             (pegawai_id, urutan, jabatan_nama_mentah, jabatan_id, unit_kerja_mentah,
              tanggal_mulai, tanggal_akhir)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            pegawaiId,
            urutan++,
            rj.nama,
            petaJabNama.get(samakan(rj.nama)) ?? null,
            r.unitKerja || null,
            dariSerialExcel(rj.tmtMulaiSerial ?? ''),
            dariSerialExcel(rj.tmtAkhirSerial ?? ''),
          ],
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

      const y = skorPredikat(predikat(r.ratingKinerja), par.skalaPredikat) ?? 0

      /*
        Satu pegawai bisa punya BEBERAPA asesmen — satu per jenjang tempat ia
        dinilai (doc/sql/022). Berkas lama tidak punya `asesmen`, jadi field
        tunggalnya disusun jadi satu entri: bentuknya seragam di bawah sini,
        dan berkas lama menghasilkan baris yang sama persis seperti sebelumnya.
      */
      // `asesmen` TIDAK ADA (berkas lama) ≠ `asesmen` ADA TAPI KOSONG (berkas
      // baru, pegawai yang sumbernya memang belum memuat asesmennya). Yang
      // pertama disusun dari field tunggal; yang kedua tidak menulis apa pun.
      // Menyamakan keduanya menulis satu baris asesmen berisi field kosong —
      // dan itulah yang membatalkan transaksi pertama ('jenis_asesmen' null),
      // yang justru beruntung: tanpa NOT NULL itu, satu baris asesmen palsu
      // ber-potkom 0 akan masuk dan menyeret Kotak 9 orang itu ke kotak 1.
      const daftarAsesmen =
        r.asesmen !== undefined
          ? r.asesmen
          : [
              {
                jenjangAsesmen: '',
                potkom: r.potkom,
                kotak9Sumber: r.kotak9Sumber,
                tahunAsesmen: r.tahunAsesmen,
                jenisAsesmen: r.jenisAsesmen,
                statusAsesmen: r.statusAsesmen,
              },
            ]

      let asesmenDipakaiId: number | null = null
      for (const src of daftarAsesmen) {
        const a = normalisasiAsesmen(
          {
            tahunAsesmen: Number(src.tahunAsesmen),
            jenisAsesmen: src.jenisAsesmen,
            statusAsesmen: statusAsesmen(src.statusAsesmen),
            nilaiKinerjaY: y,
            potkom: Number(src.potkom),
            nilaiIntegritas: null,
            kotak9Sumber: src.kotak9Sumber === '' ? null : Number(src.kotak9Sumber),
          },
          { tahunSekarang: mulai.getFullYear(), ...par },
        ).nilai
        const [hasil] = await db.execute(
          `INSERT INTO asesmen_talenta
             (pegawai_id, tahun_asesmen, jenis_asesmen, jenjang_asesmen, status_asesmen,
              nilai_kinerja_y, nilai_potensial_x, potkom, nilai_integritas, nilai_talenta,
              kotak_9, kotak_9_sumber, tahun_kinerja, rating_kinerja, sumber_sync)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'manual')`,
          [
            pegawaiId,
            a.tahunAsesmen,
            a.jenisAsesmen,
            src.jenjangAsesmen || null,
            a.statusAsesmen,
            a.nilaiKinerjaY,
            a.nilaiPotensialX,
            a.potkom,
            a.nilaiIntegritas,
            a.nilaiTalenta,
            a.kotak9,
            src.kotak9Sumber === '' ? null : Number(src.kotak9Sumber),
            Number(src.tahunAsesmen),
            predikat(r.ratingKinerja),
          ],
        )
        // Baris PERTAMA jadi pilihan bawaan — di sumbernya, itu jenjang pegawai
        // itu sendiri (baris berikutnya jenjang lain yang ia ikut dinilai di
        // sana). Ini BAWAAN, bukan keputusan: verifikator yang menentukannya,
        // dan `asesmen_dipakai` ada supaya keputusan itu punya tempat.
        if (asesmenDipakaiId === null) {
          asesmenDipakaiId = (hasil as unknown as { insertId: number }).insertId
        }
        nAs++
      }
      if (asesmenDipakaiId !== null) {
        await db.execute(
          `INSERT INTO asesmen_dipakai (pegawai_id, asesmen_id, ditetapkan_oleh, catatan)
           VALUES (?, ?, NULL, 'Bawaan impor — jenjang pertama di berkas sumber')
           ON DUPLICATE KEY UPDATE asesmen_id = VALUES(asesmen_id)`,
          [pegawaiId, asesmenDipakaiId],
        )
      }
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

  if (SELARASKAN_RIWAYAT && pegAda.length > 0) {
    let ganti = 0
    let barisTulis = 0
    let berTanggal = 0
    for (const r of pegAda) {
      const [pg] = await db.query<mysql.RowDataPacket[]>('SELECT id FROM pegawai WHERE nip = ?', [
        r.nip,
      ])
      if (pg.length === 0) continue
      const id = Number(pg[0]!.id)
      await db.execute('DELETE FROM riwayat_jabatan WHERE pegawai_id = ?', [id])
      let urut = 1
      for (const rj of r.riwayatJabatan) {
        const mulai = dariSerialExcel(rj.tmtMulaiSerial ?? '')
        await db.execute(
          `INSERT INTO riwayat_jabatan
             (pegawai_id, urutan, jabatan_nama_mentah, jabatan_id, unit_kerja_mentah,
              tanggal_mulai, tanggal_akhir)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            id,
            urut++,
            rj.nama,
            petaJabNama.get(samakan(rj.nama)) ?? null,
            r.unitKerja || null,
            mulai,
            dariSerialExcel(rj.tmtAkhirSerial ?? ''),
          ],
        )
        barisTulis++
        if (mulai !== null) berTanggal++
      }
      ganti++
    }
    console.log(`\n── RIWAYAT JABATAN DISELARASKAN ──`)
    console.log(`  ${ganti} pegawai · ${barisTulis} baris ditulis ulang · ${berTanggal} bertanggal`)
  }

  if (SELARASKAN_PENDIDIKAN && pegAda.length > 0) {
    let ganti = 0
    let barisTulis = 0
    for (const r of pegAda) {
      const [pg] = await db.query<mysql.RowDataPacket[]>('SELECT id FROM pegawai WHERE nip = ?', [
        r.nip,
      ])
      if (pg.length === 0) continue
      const id = Number(pg[0]!.id)
      await db.execute('DELETE FROM riwayat_pendidikan WHERE pegawai_id = ?', [id])
      let urut = 1
      for (const pd of uraiPendidikan(r.riwayatPendidikan)) {
        await db.execute(
          `INSERT INTO riwayat_pendidikan
             (pegawai_id, urutan, jenjang_pendidikan, bidang_studi, nama_sekolah, tahun_lulus)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [id, urut, pd.jenjang, pd.bidang, urut === 1 ? r.sekolah || null : null, pd.tahun],
        )
        urut++
        barisTulis++
      }
      ganti++
    }
    console.log(`\n── PENDIDIKAN DISELARASKAN ──`)
    console.log(`  ${ganti} pegawai · ${barisTulis} baris ditulis ulang`)
  }

  console.log('\n── DITULIS ──')
  console.log(`  unit ${nUnit} · jabatan ${nJab} · pegawai ${nPeg} · riwayat jabatan ${nRj} · riwayat pendidikan ${nRp} · asesmen ${nAs}`)
  console.log('\n  LANJUTKAN: jalankan Hitung Ulang di tiap jabatan target — skor & kelayakan')
  console.log('  belum memuat pegawai baru ini sampai itu dilakukan.\n')
  await db.end()
}

main()
  .then(() => {
    /*
      `process.exit(0)` EKSPLISIT, dan alasannya bukan kerapian.

      Sejak ambang Kotak 9 dibaca dari `pengaturan_sistem` (22 Agu 2026), skrip
      ini menarik `lib/pengaturan` → `lib/db`, dan `lib/db` membuat POOL koneksi
      yang tidak pernah ditutup. `db.end()` di atas hanya menutup koneksi milik
      skrip ini sendiri, bukan pool itu — jadi event loop tidak pernah kosong dan
      prosesnya menggantung SETELAH seluruh laporannya tercetak.

      Gejalanya sangat menipu ketika keluarannya dipipe ke `tail`/`grep`, yang
      block-buffer saat bukan terminal: yang terlihat adalah program yang diam
      selama 30 menit tanpa satu pun baris keluaran, padahal ia sudah selesai
      bekerja sejak detik-detik pertama. Terjadi 24 Agu 2026.
    */
    process.exit(0)
  })
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
