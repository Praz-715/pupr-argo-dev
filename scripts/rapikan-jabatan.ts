/**
 * Seragamkan `jabatan.nama_jabatan` dengan daftar resmi **Nama Jabatan Struktural**.
 *
 *   npm run rapikan:jabatan             # KERING — melapor, tidak menulis
 *   npm run rapikan:jabatan -- --tulis  # benar-benar mengganti nama
 *
 * Acuannya `doc/data/jabatan-struktural.json`, hasil ekstraksi
 * `Nama Jabatan Struktural.xlsx` (123 jabatan: 1 eselon I · 6 II · 63 III · 53 IV).
 *
 * ## Yang dilakukan: HANYA mengganti nama
 *
 * Master jabatan di DB tumbuh dari tiga sumber berbeda (seed awal, Excel ES 2 & 3,
 * Excel Pengawas), dan masing-masing menulis ejaan sendiri: `Kepala Subdirektorat`
 * vs `Kepala Sub Direktorat`, `Kepala Subbagian` vs `Kepala Sub Bagian`,
 * `Perencanaan, Program, dan Keuangan` vs `Perencanaan, Program dan Keuangan`.
 * Terukur **79 dari 125** baris berbeda ejaannya dari daftar resmi — dan ejaan
 * yang berbeda-beda itulah yang membuat satu jabatan yang sama tampak seperti
 * beberapa jabatan di penyaring, laporan, dan pencocokan riwayat.
 *
 * Eselonnya TIDAK diubah, sebab terukur **0 selisih** — DB sudah benar di situ.
 *
 * ## Yang TIDAK dilakukan, dan kenapa
 *
 * - **20 jabatan NON_ESELON tidak disentuh.** Berkas acuan berjudul "Nama Jabatan
 *   *Struktural*"; jabatan fungsional (Pembina Jasa Konstruksi, Analis SDM
 *   Aparatur, Pengelola PBJ) memang bukan isinya. Ketidakhadiran di daftar itu
 *   bukan bukti jabatannya tidak ada.
 * - **13 jabatan struktural tanpa padanan tidak dihapus, hanya dilaporkan.**
 *   Semuanya berpenghuni 0, tapi 5 di antaranya anggota `jabatan_target` — dan
 *   menghapus master jabatan akan melubangi target itu. Menghapus data master
 *   adalah keputusan pemilik proses; skrip ini tidak mengambilnya. (Pelajaran
 *   mahal 22 Agu 2026: `jabatan_target` 176 saya simpulkan "sisa uji" lalu hapus
 *   — ternyata dibuat manusia.)
 *
 * ## Pencocokannya (nama, unit), bukan nama saja
 *
 * Daftar resmi menulis nama Balai secara GENERIK ("Kepala Balai Pelaksana
 * Pemilihan Jasa Konstruksi") dan menaruh unitnya di kolom `Ket.`, sedangkan DB
 * menuliskannya lengkap per wilayah. Dicocokkan per nama saja, 40-an Balai akan
 * tampak tak berpadanan.
 *
 * Nama unit dibandingkan sebagai **himpunan kata**, bukan string: acuan menulis
 * "Direktorat Kompetensi dan Produktivitas Konstruksi Tenaga Kerja" sementara DB
 * "Direktorat Kompetensi dan Produktivitas Tenaga Kerja Konstruksi" — urutan
 * katanya berbeda, isinya sama.
 */

import { config } from 'dotenv'

import { klasifikasiUnit, kodeUnitUnik } from './_unit-organisasi'
import { kunciPasangan, kunciUnit } from './rapikan-jabatan-alias'
import { readFileSync } from 'node:fs'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')
/**
 * `--tambah-hilang`: buat jabatan struktural yang ada di daftar resmi tapi belum
 * ada di master.
 *
 * Dipisah dari penyeragaman nama karena sifatnya berbeda: mengganti nama tidak
 * menambah baris apa pun, sedangkan ini menambah 56 jabatan baru yang akan
 * muncul di setiap dropdown jabatan dan — karena belum ada penghuninya — di
 * halaman Jabatan Kosong & KPI "Jabatan strategis kosong". Itu ANGKA YANG BENAR
 * (daftar resmi memuat 123 jabatan sementara populasi kita 79 orang), tapi ia
 * berubah drastis, jadi pemiliknya harus memilihnya secara sadar.
 */
const TAMBAH_HILANG = process.argv.includes('--tambah-hilang')
const SELARASKAN_STATUS = process.argv.includes('--selaraskan-status')
const HAPUS_BUATAN = process.argv.includes('--hapus-buatan')

/** Awalan kode untuk jabatan yang lahir dari daftar resmi — bisa dilacak balik. */
const PREFIKS = 'JAB-STR'

/**
 * Eselon → `jenjang`, memakai nomenklatur ASN.
 *
 * Kolom `jenjang` di DB tercampur DUA konvensi: baris seed memakai nomenklatur
 * ("JPT Pratama", "Administrator", "Pengawas") sementara baris hasil impor Excel
 * memakai kode eselon mentah ("II.a", "III.a", "IV.a"). Terukur: eselon III muncul
 * sebagai `III.a` (21×) DAN `Administrator` (18×) — satu hal yang sama tampil
 * sebagai dua entri di penyaring Jenjang, dan pengguna harus memilih keduanya
 * untuk melihat semua Administrator.
 *
 * Daftar resmi hanya memberi eselon, jadi ia tidak bisa menjadi acuan `jenjang`.
 * Yang dipakai nomenklatur ASN, sebab itu yang bermakna bagi pembaca — "III.a"
 * hanya kode, "Administrator" menyebut perannya.
 */
const JENJANG_DARI_ESELON: Record<string, string> = {
  I: 'JPT Madya',
  II: 'JPT Pratama',
  III: 'Administrator',
  IV: 'Pengawas',
}
const ACUAN = 'doc/data/jabatan-struktural.json'

interface Acuan {
  no: number
  namaJabatan: string
  unitKerja: string
  eselon: string
}

interface BarisJabatan {
  id: number
  nama_jabatan: string
  eselon: string
  jenjang: string | null
  nama_unit: string | null
  penghuni: number
  target: number
}

/** Ejaan disamakan HANYA untuk membandingkan; yang ditulis tetap ejaan resmi. */
const norm = (s: string): string =>
  (s || '')
    .toLowerCase()
    .replace(/\bsub\s+direktorat\b/g, 'subdirektorat')
    .replace(/\bsub\s+bagian\b/g, 'subbagian')
    .replace(/\bsub\s+bidang\b/g, 'subbidang')
    .replace(/\bjf\b/g, 'jabatan fungsional')
    .replace(/kontruksi/g, 'konstruksi')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/**
 * Ejaan berbeda yang MEMANG unit yang sama — daftar tertutup, diperiksa manusia.
 *
 * Hanya satu sejauh ini: daftar resmi menulis "Produktivitas **Konstruksi**
 * Tenaga Kerja Konstruksi" (kata "Konstruksi" muncul dua kali), sementara master
 * dan seluruh baris Excel Talent Pool menulis "Produktivitas Tenaga Kerja
 * Konstruksi". Tanpa entri ini, keenam jabatan direktorat itu akan dibuat ulang
 * di bawah unit kedua yang isinya sama.
 */


/**
 * Unit dianggap sama HANYA kalau ejaan normalnya identik (atau lewat `ALIAS_UNIT`).
 *
 * ## Versi pertama memakai irisan ≥85% himpunan kata, dan itu SALAH BESAR
 *
 * `kataUnit()` membuang kata ≤2 huruf, sehingga angka romawi hilang dan yang
 * membedakan satu BP2JK dari BP2JK lain tinggal nama provinsinya — satu kata dari
 * tujuh. Terukur: "…Wilayah **Aceh**" vs "…Wilayah **Bali**" berbagi 6 dari 7 kata
 * = **85,7%**, lolos ambang. Artinya **seluruh 34 BP2JK saling dianggap unit yang
 * sama**, dan karena `unitDb.find()` mengembalikan yang PERTAMA cocok, jabatan
 * yang dibuat menumpuk di beberapa balai sementara puluhan balai lain kosong.
 *
 * Kerusakan nyatanya sebelum diperbaiki: `Kepala Balai Pelaksana Pemilihan Jasa
 * Konstruksi` ada **9 kali di BP2JK D.I. Yogyakarta** (seharusnya 1) sementara
 * **24 BP2JK lain tidak punya Kepala Balai sama sekali**. Tidak ada satu pun galat
 * — `unit_organisasi_id` yang salah tetap FK yang sah.
 *
 * Pelajarannya: pencocokan samar boleh untuk mengUSULkan, tidak boleh untuk
 * MENULIS. Di sini yang ditulis adalah `unit_organisasi_id`, jadi ambangnya harus
 * "identik", dan perkecualiannya harus ditulis satu per satu supaya terlihat.
 */
function samaUnit(a: string, b: string | null): boolean {
  const A = kunciUnit(a)
  const B = kunciUnit(b)
  return A !== '' && A === B
}

function padanan(d: BarisJabatan, ref: Acuan[]): Acuan | undefined {
  return (
    ref.find((r) => norm(r.namaJabatan) === norm(d.nama_jabatan) && samaUnit(r.unitKerja, d.nama_unit)) ??
    ref.find((r) => norm(r.namaJabatan) === norm(d.nama_jabatan)) ??
    // Balai: acuan generik + unit yang membedakan.
    ref.find(
      (r) =>
        samaUnit(r.unitKerja, d.nama_unit) &&
        norm(d.nama_jabatan).startsWith(norm(r.namaJabatan).slice(0, 26)),
    )
  )
}

async function main() {
  const { kueri, eksekusi } = await import('../lib/db')
  const ref = JSON.parse(readFileSync(ACUAN, 'utf8')) as Acuan[]

  const db = await kueri<BarisJabatan>(
    `SELECT jb.id, jb.nama_jabatan, jb.eselon, jb.jenjang, u.nama_unit,
            (SELECT COUNT(*) FROM pegawai p WHERE p.jabatan_id = jb.id)               AS penghuni,
            (SELECT COUNT(*) FROM jabatan_target_anggota a WHERE a.jabatan_id = jb.id) AS target
       FROM jabatan jb
       LEFT JOIN unit_organisasi u ON u.id = jb.unit_organisasi_id
      ORDER BY jb.id`,
  )

  console.log(`\n=== RAPIKAN NAMA JABATAN ${TULIS ? '(MENULIS)' : '(kering)'} ===\n`)
  console.log(`  acuan  : ${ACUAN} · ${ref.length} jabatan struktural`)
  console.log(`  master : ${db.length} jabatan di DB\n`)

  const gantiNama: Array<{ id: number; dari: string; ke: string }> = []
  const eselonBeda: Array<{ nama: string; db: string; acuan: string }> = []
  const takBerpadanan: BarisJabatan[] = []

  for (const d of db) {
    const r = padanan(d, ref)
    if (!r) {
      takBerpadanan.push(d)
      continue
    }
    if (r.eselon !== d.eselon) eselonBeda.push({ nama: d.nama_jabatan, db: d.eselon, acuan: r.eselon })
    // Nama Balai di DB memuat wilayahnya, acuan tidak — jangan dipangkas jadi
    // generik, sebab 40-an Balai lalu bernama sama dan tak bisa dibedakan lagi.
    const acuanGenerik = norm(d.nama_jabatan) !== norm(r.namaJabatan)
    if (!acuanGenerik && r.namaJabatan !== d.nama_jabatan) {
      gantiNama.push({ id: d.id, dari: d.nama_jabatan, ke: r.namaJabatan })
    }
  }

  // Jenjang yang masih berupa kode eselon mentah ("III.a") diseragamkan ke
  // nomenklatur. NON_ESELON tidak disentuh — di sana `jenjang` memuat jenjang
  // fungsional ("Ahli Muda") yang memang bukan turunan eselon.
  const gantiJenjang = db
    .filter((d) => d.eselon !== 'NON_ESELON')
    .filter((d) => /^(I{1,3}V?|IV)\.[a-z]$/i.test(d.jenjang ?? ''))
    .map((d) => ({ id: d.id, dari: d.jenjang!, ke: JENJANG_DARI_ESELON[d.eselon] ?? d.jenjang! }))
    .filter((g) => g.ke !== g.dari)

  // `status_jabatan` vs penghuni sesungguhnya.
  //
  // `lib/aksi/jabatan.ts` menegakkan SATU arah — jabatan yang masih ditempati
  // tidak boleh ditandai KOSONG — dan docblock-nya menyebut alasannya: kartu KPI
  // "Jabatan strategis kosong" di dashboard dan panel Risiko Kekosongan
  // dua-duanya MEMBACA kolom ini, jadi kolom yang berbohong membuat kedua halaman
  // itu berbohong. Arah sebaliknya tidak pernah dijaga siapa pun: ketika penghuni
  // sebuah jabatan dihapus, kolomnya tetap `TERISI`. Dan itu benar-benar terjadi
  // di DB ini — 33 pegawai non-eNominasi dihapus 12 Agu, 10 pegawai eNominasi
  // dikeluarkan 24 Agu, dan jabatan mereka tetap mengaku terisi.
  //
  // Arahnya cuma satu di sini: TERISI tanpa penghuni → KOSONG. Kebalikannya
  // (KOSONG tapi ada penghuni) TIDAK ikut disetel — kalau ada, itu bukan kolom
  // yang basi melainkan penautan pegawai yang salah, dan menutupinya dengan
  // mengubah statusnya akan menyembunyikan masalah yang sebenarnya. Ia hanya
  // dilaporkan. `DIHAPUS` tidak disentuh: itu penonaktifan, bukan kekosongan.
  const hunian = await kueri<{ id: number; status_jabatan: string; nama_jabatan: string; eselon: string; penghuni: number }>(
    `SELECT j.id, j.status_jabatan, j.nama_jabatan, j.eselon, COALESCE(p.c, 0) AS penghuni
       FROM jabatan j
       LEFT JOIN (SELECT jabatan_id, COUNT(*) c FROM pegawai
                   WHERE status_aktif = 'AKTIF' AND jabatan_id IS NOT NULL
                   GROUP BY jabatan_id) p ON p.jabatan_id = j.id
      WHERE j.status_jabatan <> 'DIHAPUS'`,
  )
  const basiTerisi = hunian.filter((h) => h.status_jabatan === 'TERISI' && Number(h.penghuni) === 0)
  const basiKosong = hunian.filter((h) => h.status_jabatan === 'KOSONG' && Number(h.penghuni) > 0)

  const fungsional = takBerpadanan.filter((d) => d.eselon === 'NON_ESELON')
  const struktural = takBerpadanan.filter((d) => d.eselon !== 'NON_ESELON')

  console.log(`── AKAN DISERAGAMKAN NAMANYA: ${gantiNama.length} ──`)
  for (const g of gantiNama.slice(0, 12)) {
    console.log(`  "${g.dari.slice(0, 46)}"\n      → "${g.ke.slice(0, 46)}"`)
  }
  if (gantiNama.length > 12) console.log(`  … dan ${gantiNama.length - 12} lainnya`)

  console.log(`\n── AKAN DISERAGAMKAN JENJANGNYA: ${gantiJenjang.length} ──`)
  const ringkasJenjang = new Map<string, number>()
  for (const g of gantiJenjang) {
    const k = `${g.dari} → ${g.ke}`
    ringkasJenjang.set(k, (ringkasJenjang.get(k) ?? 0) + 1)
  }
  for (const [k, n] of ringkasJenjang) console.log(`  ${String(n).padStart(3)} × ${k}`)

  console.log(`\n── STATUS JABATAN vs PENGHUNI ──`)
  const perEs = new Map<string, number>()
  for (const h of basiTerisi) perEs.set(h.eselon, (perEs.get(h.eselon) ?? 0) + 1)
  console.log(`  TERISI tapi nol penghuni aktif : ${basiTerisi.length}` +
    (basiTerisi.length ? `  (${[...perEs.entries()].sort().map(([e, n]) => `es ${e}: ${n}`).join(' · ')})` : ''))
  console.log(`  KOSONG tapi ADA penghuni       : ${basiKosong.length}` +
    (basiKosong.length ? '  ← BUKAN kolom basi, penautan pegawainya yang perlu diperiksa' : ''))
  if (basiTerisi.length > 0) {
    const strategis = basiTerisi.filter((h) => ['I', 'II', 'III'].includes(h.eselon)).length
    console.log(
      `     ${SELARASKAN_STATUS ? 'AKAN diselaraskan' : 'tidak disentuh tanpa `--selaraskan-status`'}` +
        ` — ${strategis} di antaranya eselon I/II/III, jadi KPI "Jabatan strategis` +
        `\n     kosong" akan naik sebanyak itu. Angkanya BENAR: jabatannya memang tak berpenghuni.`,
    )
  }

  console.log(`\n── TIDAK DISENTUH ──`)
  console.log(`  jabatan FUNGSIONAL (NON_ESELON) : ${fungsional.length}`)
  console.log(`     daftar acuan hanya memuat jabatan STRUKTURAL, jadi absennya bukan bukti apa pun`)
  console.log(`  eselon berbeda dari acuan        : ${eselonBeda.length}`)
  for (const e of eselonBeda) console.log(`     ${e.nama.slice(0, 44)} · DB ${e.db} vs acuan ${e.acuan}`)

  console.log(`\n── PERLU KEPUTUSAN ANDA: struktural tanpa padanan (${struktural.length}) ──`)
  for (const d of struktural) {
    console.log(
      `  [${d.eselon}] ${d.nama_jabatan.slice(0, 48)} · penghuni ${d.penghuni} · anggota target ${d.target}`,
    )
  }
  if (struktural.length > 0) {
    console.log(
      '     TIDAK dihapus skrip ini. Yang beranggota target akan melubangi target itu\n' +
        '     kalau dihapus, dan menghapus master jabatan adalah keputusan pemilik proses.',
    )
  }

  /*
    Acuan yang "belum ada" dihitung sebagai MULTISET pasangan (jabatan, unit).

    Versi pertama menandai sebuah baris acuan "sudah ada" kalau ADA SATU baris
    master yang berpadanan lewat `padanan()`. Dua hal membuatnya salah sekaligus:
    `padanan()` punya fallback yang mencocokkan NAMA SAJA (mengabaikan unit), dan
    `samaUnit()` waktu itu masih samar. Akibatnya satu baris master bernama
    "Kepala Sub Bagian Umum dan Tata Usaha" bisa menandai SATU dari 34 baris acuan
    senama sebagai "sudah ada" — yang mana, tidak ditentukan apa pun — sehingga
    33 sisanya dianggap belum ada lalu dibuat, dan semuanya menempel di unit yang
    ditemukan pertama.

    Hitungan multiset menjawab pertanyaan yang benar: "berapa banyak (jabatan X di
    unit Y) yang masih kurang". Ia juga membuat skrip ini KONVERGEN — dijalankan
    dua kali tidak menambah apa pun, sebab yang sudah lengkap tidak lagi kurang.
  */
  const punyaMaster = new Map<string, number>()
  for (const d of db) {
    if (d.eselon === 'NON_ESELON') continue
    const k = kunciPasangan(d.nama_jabatan, d.nama_unit)
    punyaMaster.set(k, (punyaMaster.get(k) ?? 0) + 1)
  }
  const sisaMaster = new Map(punyaMaster)
  const belumAda: Acuan[] = []
  for (const r of ref) {
    const k = kunciPasangan(r.namaJabatan, r.unitKerja)
    const sisa = sisaMaster.get(k) ?? 0
    if (sisa > 0) sisaMaster.set(k, sisa - 1)
    else belumAda.push(r)
  }

  // Surplus = baris master struktural yang TIDAK diminta acuan sebanyak itu.
  // Untuk baris berkode PREFIKS (buatan skrip ini) surplus berarti salah unit,
  // dan itu bisa dibersihkan; untuk baris lain ia cuma dilaporkan.
  const surplus: Array<{ kunci: string; lebih: number }> = []
  for (const [k, n] of sisaMaster) if (n > 0 && punyaMaster.has(k)) surplus.push({ kunci: k, lebih: n })
  /*
    Angka SURPLUS di bawah hanya menghitung jabatan STRUKTURAL, dan itu perlu
    dinyatakan supaya ia tidak dibandingkan dengan hitungan total yang berbeda.

    `punyaMaster` mengecualikan `NON_ESELON` dengan sengaja: berkas acuan bernama
    "Nama Jabatan Struktural" dan memang tidak memuat jabatan fungsional, jadi
    membandingkan fungsional dengannya akan SELALU melaporkannya surplus — 19 baris
    kebisingan permanen. Ketidakhadiran di daftar struktural bukan bukti sebuah
    jabatan fungsional tidak seharusnya ada.

    Jadi kalau seseorang menghitung "master 156 − acuan 123 = 33" lalu bingung
    kenapa di sini tertulis 14, selisihnya adalah 19 jabatan fungsional itu.
  */
  const fungsionalDb = db.filter((d) => d.eselon === 'NON_ESELON').length
  console.log(
    `\n── SURPLUS: ${surplus.reduce((t, x) => t + x.lebih, 0)} jabatan STRUKTURAL lebih dari yang diminta acuan ──`,
  )
  console.log(
    `  (${fungsionalDb} jabatan FUNGSIONAL tidak dihitung di sini — daftar acuan struktural-saja,\n` +
      '   jadi ketidakhadiran jabatan fungsional di sana bukan bukti ia tidak seharusnya ada)',
  )
  if (surplus.length === 0) console.log('  (tidak ada)')
  for (const x of surplus.slice(0, 10)) {
    const [nama, unit] = x.kunci.split('@@')
    console.log(`  +${x.lebih}× ${nama?.slice(0, 44)}  @  ${unit?.slice(0, 40)}`)
  }
  if (surplus.length > 10) console.log(`  … dan ${surplus.length - 10} pasangan lain`)

  console.log(`\n── ACUAN BELUM ADA DI MASTER: ${belumAda.length} ──`)
  for (const r of belumAda.slice(0, 12)) {
    console.log(`  [${r.eselon}] ${r.namaJabatan.slice(0, 50)} @ ${r.unitKerja.slice(0, 34)}`)
  }
  if (belumAda.length > 12) console.log(`  … dan ${belumAda.length - 12} lainnya`)

  if (TAMBAH_HILANG) {
    const unitDb = await kueri<{ id: number; nama_unit: string }>(
      'SELECT id, nama_unit FROM unit_organisasi',
    )
    const tanpaUnit = belumAda.filter((r) => !unitDb.some((u) => samaUnit(r.unitKerja, u.nama_unit)))
    console.log(`\n  --tambah-hilang: ${belumAda.length} akan dibuat`)
    console.log(`     unitnya sudah ada : ${belumAda.length - tanpaUnit.length}`)
    if (tanpaUnit.length > 0) {
      console.log(`     unit BARU dibuat  : ${new Set(tanpaUnit.map((r) => r.unitKerja)).size}`)
      for (const u of new Set(tanpaUnit.map((r) => r.unitKerja))) console.log(`        + ${u}`)
    }
    console.log(
      '     CATATAN: jabatan baru berstatus KOSONG, jadi halaman Jabatan Kosong &\n' +
        '     KPI "Jabatan strategis kosong" akan naik tajam. Itu angka yang BENAR —\n' +
        `     daftar resmi memuat ${ref.length} jabatan sementara populasi kita jauh lebih kecil.`,
    )
  }

  /*
    `--hapus-buatan` membuang baris berkode PREFIKS yang NOL DEPENDEN.

    Ada karena jalan pertama `--tambah-hilang` (24 Agu 2026) memakai `samaUnit()`
    versi samar dan menempelkan 56 jabatan ke unit yang salah — menumpuk 9 "Kepala
    Balai Pelaksana Pemilihan Jasa Konstruksi" di BP2JK D.I. Yogyakarta sementara 24
    BP2JK lain tidak punya satu pun. Memindahkan `unit_organisasi_id` satu per satu
    mungkin, tapi menghapus-lalu-membuat-ulang bisa DIVERIFIKASI: hasilnya ditentukan
    sepenuhnya oleh daftar acuan, bukan oleh urutan langkah perbaikan.

    Syarat NOL DEPENDEN ditegakkan di SQL, bukan dipercayai: baris yang sudah
    ditempati pegawai, jadi anggota jabatan target, atau dirujuk riwayat jabatan
    TIDAK dihapus walau berkode PREFIKS. Kalau ada yang begitu, ia dilaporkan dan
    dilewati — menghapusnya akan melubangi jabatan target dan mengosongkan jabatan
    seseorang.
  */
  let dihapus = 0
  if (HAPUS_BUATAN) {
    const buatan = await kueri<{ id: number; nama_jabatan: string; dependen: number }>(
      `SELECT jb.id, jb.nama_jabatan,
              (SELECT COUNT(*) FROM pegawai p WHERE p.jabatan_id = jb.id)
            + (SELECT COUNT(*) FROM jabatan_target_anggota a WHERE a.jabatan_id = jb.id)
            + (SELECT COUNT(*) FROM riwayat_jabatan r WHERE r.jabatan_id = jb.id) AS dependen
         FROM jabatan jb WHERE jb.kode_jabatan LIKE ?`,
      [`${PREFIKS}%`],
    )
    const aman = buatan.filter((b) => Number(b.dependen) === 0)
    const ditahan = buatan.filter((b) => Number(b.dependen) > 0)
    console.log(`\n── --hapus-buatan: ${buatan.length} baris berkode ${PREFIKS} ──`)
    console.log(`  nol dependen, akan dihapus : ${aman.length}`)
    console.log(`  berdependen, DITAHAN       : ${ditahan.length}`)
    for (const t of ditahan) console.log(`     · ${t.nama_jabatan} (${t.dependen} dependen)`)
    if (TULIS) {
      for (const b of aman) {
        await eksekusi('DELETE FROM jabatan WHERE id = ?', [b.id])
        dihapus++
      }
      console.log(`  ${dihapus} dihapus. Jalankan ulang dengan --tambah-hilang untuk membuatnya kembali.`)
    }
  }

  if (!TULIS) {
    console.log(`\n  Kering — tidak ada yang ditulis. Tambahkan \`-- --tulis\`.\n`)
    process.exit(0)
  }
  if (
    gantiNama.length === 0 &&
    gantiJenjang.length === 0 &&
    !TAMBAH_HILANG &&
    !(SELARASKAN_STATUS && basiTerisi.length > 0) &&
    !HAPUS_BUATAN
  ) {
    console.log('\n  Tidak ada yang perlu diseragamkan.\n')
    process.exit(0)
  }

  for (const g of gantiNama) {
    await eksekusi('UPDATE jabatan SET nama_jabatan = ? WHERE id = ?', [g.ke, g.id])
  }
  for (const g of gantiJenjang) {
    await eksekusi('UPDATE jabatan SET jenjang = ? WHERE id = ?', [g.ke, g.id])
  }
  await eksekusi(
    `INSERT INTO audit_log (user_id, aksi, entitas, entitas_id, data_sebelum, data_sesudah, ip_address, created_at)
     VALUES (1, 'UBAH_MASSAL', 'jabatan', NULL, CAST(? AS JSON), CAST(? AS JSON), '::1', NOW())`,
    [
      JSON.stringify({ jumlah: gantiNama.length, contoh: gantiNama.slice(0, 5) }),
      JSON.stringify({
        acuan: 'Nama Jabatan Struktural.xlsx',
        catatan:
          'Nama jabatan diseragamkan dengan daftar resmi. Eselon tidak diubah (0 selisih). Jabatan fungsional & yang tak berpadanan tidak disentuh.',
      }),
    ],
  )

  let statusDiselaraskan = 0
  if (SELARASKAN_STATUS && basiTerisi.length > 0) {
    for (const h of basiTerisi) {
      await eksekusi("UPDATE jabatan SET status_jabatan = 'KOSONG' WHERE id = ?", [h.id])
      statusDiselaraskan++
    }
  }

  let dibuat = 0
  let unitBaru = 0
  if (TAMBAH_HILANG) {
    const unitDb = await kueri<{ id: number; nama_unit: string }>(
      'SELECT id, nama_unit FROM unit_organisasi',
    )
    const kodeUnitAda = new Set(
      (await kueri<{ kode_unit: string }>('SELECT kode_unit FROM unit_organisasi')).map(
        (u) => u.kode_unit,
      ),
    )
    const petaUnit = new Map<string, number>()
    const djbk = await kueri<{ id: number }>(
      "SELECT id FROM unit_organisasi WHERE kode_unit = 'DJBK' LIMIT 1",
    )
    const indukDjbk = djbk[0]?.id ?? null
    const kodeAda = new Set(
      (await kueri<{ kode_jabatan: string }>('SELECT kode_jabatan FROM jabatan')).map(
        (k) => k.kode_jabatan,
      ),
    )
    let urut = 1
    for (const r of belumAda) {
      let unitId = unitDb.find((u) => samaUnit(r.unitKerja, u.nama_unit))?.id ?? petaUnit.get(r.unitKerja)
      if (unitId === undefined) {
        // Unit yang disebut daftar resmi tapi belum ada — dibuat, bukan jabatannya
        // digantung tanpa unit (`unit_organisasi_id` NOT NULL).
        // Kode & klasifikasinya diturunkan dengan aturan yang SAMA dengan importir
        // (`_unit-organisasi.ts`). Versi pertama blok ini memakai
        // `LPJK-<nomor urut jabatan>` dan memaku `'SEKRETARIAT', 2` — nomor yang
        // tak berhubungan dengan unitnya, dan klasifikasi yang kebetulan benar
        // untuk satu unit lalu salah untuk unit berikutnya.
        const kodeUnit = kodeUnitUnik(r.unitKerja, kodeUnitAda)
        const kelas = klasifikasiUnit(r.unitKerja)
        const h = await eksekusi(
          `INSERT INTO unit_organisasi (kode_unit, nama_unit, parent_id, jenis, level_eselon)
           VALUES (?, ?, ?, ?, ?)`,
          [kodeUnit, r.unitKerja, indukDjbk, kelas.jenis, kelas.level],
        )
        unitId = Number(h.insertId)
        petaUnit.set(r.unitKerja, unitId)
        unitBaru++
      }
      let kode = ''
      do {
        kode = `${PREFIKS}-${String(urut++).padStart(3, '0')}`
      } while (kodeAda.has(kode))
      kodeAda.add(kode)
      await eksekusi(
        `INSERT INTO jabatan (kode_jabatan, nama_jabatan, unit_organisasi_id, jenis_jabatan,
                              jenjang, eselon, status_jabatan)
         VALUES (?, ?, ?, 'STRUKTURAL', ?, ?, 'KOSONG')`,
        [kode, r.namaJabatan, unitId, JENJANG_DARI_ESELON[r.eselon] ?? r.eselon, r.eselon],
      )
      dibuat++
    }
  }

  console.log(`\n── DITULIS ──`)
  console.log(`  ${gantiNama.length} nama · ${gantiJenjang.length} jenjang diseragamkan · eselon tidak diubah`)
  if (TAMBAH_HILANG) console.log(`  ${dibuat} jabatan struktural dibuat · ${unitBaru} unit baru`)
  if (statusDiselaraskan > 0)
    console.log(`  ${statusDiselaraskan} jabatan TERISI-tanpa-penghuni disetel KOSONG`)
  if (dihapus > 0) console.log(`  ${dihapus} jabatan buatan skrip dihapus (nol dependen)`)
  /*
    PENJAGA AKHIR — dijalankan SESUDAH menulis, bukan sebelum.

    Ini yang tidak ada pada jalan pertama, dan ketiadaannya itulah kenapa 56 jabatan
    bisa menempel di unit yang salah tanpa ada yang tahu: skrip melaporkan "56 dibuat"
    dan berhenti di situ. Yang harus dijawab bukan "berapa yang saya tulis" melainkan
    "apakah seluruh daftar acuan sekarang benar-benar ada di master".
  */
  const sesudah = await kueri<{ nama_jabatan: string; nama_unit: string | null }>(
    `SELECT jb.nama_jabatan, u.nama_unit FROM jabatan jb
       LEFT JOIN unit_organisasi u ON u.id = jb.unit_organisasi_id
      WHERE jb.eselon <> 'NON_ESELON'`,
  )
  const punya = new Map<string, number>()
  for (const d of sesudah) {
    const k = kunciPasangan(d.nama_jabatan, d.nama_unit)
    punya.set(k, (punya.get(k) ?? 0) + 1)
  }
  const kurang: Acuan[] = []
  for (const r of ref) {
    const k = kunciPasangan(r.namaJabatan, r.unitKerja)
    const n = punya.get(k) ?? 0
    if (n > 0) punya.set(k, n - 1)
    else kurang.push(r)
  }
  console.log(`\n── PERIKSA ULANG SESUDAH MENULIS ──`)
  console.log(`  pasangan (jabatan, unit) di acuan : ${ref.length}`)
  console.log(`  ADA di master                     : ${ref.length - kurang.length}`)
  console.log(`  MASIH KURANG                      : ${kurang.length}`)
  for (const r of kurang.slice(0, 15)) {
    console.log(`     ✗ [${r.eselon}] ${r.namaJabatan.slice(0, 46)} @ ${r.unitKerja.slice(0, 34)}`)
  }
  if (kurang.length > 15) console.log(`     … dan ${kurang.length - 15} lainnya`)
  if (kurang.length === 0) {
    console.log(`  ✓ seluruh ${ref.length} jabatan pada daftar resmi ada di master, di unit yang benar.`)
  }

  console.log(
    '\n  Nama jabatan dipakai untuk mencocokkan riwayat jabatan saat impor, jadi\n' +
      '  jalankan `impor:talentpool -- --selaraskan-riwayat` bila ingin penautannya\n' +
      '  ikut menyegar.\n',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
