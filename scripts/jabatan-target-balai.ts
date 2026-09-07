/**
 * Satu JABATAN TARGET per BALAI — bukan satu target generik untuk semuanya.
 *
 *   npm run target:balai                 # KERING — melapor, tidak menulis
 *   npm run target:balai -- --tulis      # buat target + salin rubrik
 *   npm run target:balai -- --tulis --aktifkan   # + langsung AKTIF
 *
 * ## Kenapa ada
 *
 * Permintaan pemilik proses 24 Agu 2026: *"tlg ditambahkan jabatan per balai jd
 * tdk dijeneralisir … jd once mau dicoba kandidat yang memenuhi untuk misal Kepala
 * BP2JK Sumatera Selatan, Kepala BP2JK Kalimantan Utara, kita sdh punya
 * kandidatnya"*.
 *
 * Sebelumnya hanya ada target GENERIK — "Kepala Balai BP2JK / Kepala Subdirektorat
 * Direktorat Pengadaan" (#1) dan "Kepala Balai Jasa Konstruksi Wilayah (BJKW)" (#3)
 * — sehingga pertanyaan "siapa kandidat untuk BP2JK Sumatera Selatan" tidak bisa
 * dijawab: satu daftar kandidat mewakili 34 balai sekaligus. Padahal syarat &
 * kandidatnya bisa berbeda per balai (lokasi, jenjang pengalaman, kesiapan orang
 * yang sudah ada di wilayah itu).
 *
 * ## Rubrik DISALIN, bukan dibiarkan kosong — ini bagian terpentingnya
 *
 * Jabatan target tanpa rubrik menghasilkan **skor 0 untuk semua orang**: mesin
 * rubrik sengaja tidak melempar (`lib/scoring`), jadi target kosong memajang
 * peringkat yang seluruhnya nol tanpa satu pun tanda bahwa angkanya belum berarti.
 * Terukur di DB ini sebelum skrip dibuat: **27 dari 31 jabatan target berstatus
 * DRAFT dan 26 di antaranya nol komponen rubrik**. Jadi menambah 41 target begitu
 * saja bukan menjawab permintaan — ia menambah 41 daftar kandidat kosong.
 *
 * Karena itu tiap target baru langsung diberi rubrik hasil salinan dari target
 * SEJENIS yang rubriknya sudah lolos pemeriksaan: BP2JK dari target BP2JK generik,
 * BJKW dari target BJKW generik. Penyalinnya `lib/rubrik-salin.ts`, modul yang sama
 * yang dipakai tombol "Salin rubrik" di UI.
 *
 * ## Yang TIDAK dilakukan
 *
 * Target generiknya **tidak dihapus**. Ia masih punya `match_score` dan mungkin
 * anggota talent pool; menghapusnya mengaskade. Yang benar: pemilik proses
 * memutuskan sendiri apakah target generik itu masih dipakai setelah yang per-balai
 * ada.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')
const AKTIFKAN = process.argv.includes('--aktifkan')

/** Jenis unit → target generik yang rubriknya dipakai sebagai cetakan. */
const CETAKAN: Record<string, { kode: string; label: string }> = {
  BP2JK: { kode: 'JT-KABALAI-BP2JK-KASUBDIT-PENGADAAN', label: 'target BP2JK generik' },
  BALAI: { kode: 'JT-KABALAI-BJKW', label: 'target BJKW generik' },
}

/**
 * Nama target dipendekkan: "Kepala BP2JK Wilayah Sumatera Selatan", bukan
 * "Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera Selatan".
 *
 * Alasannya terlihat langsung di tangkapan layar yang dikirim pemilik proses:
 * pemilih jabatan target adalah `<select>` satu baris, dan nama sepanjang 60+
 * karakter membuat pembedanya — nama wilayahnya — terdorong ke ujung yang
 * terpotong. Yang membedakan 34 balai justru bagian itu, jadi ia harus terbaca
 * lebih dulu, bukan terakhir.
 */
function namaTarget(namaUnit: string, jenis: string): string {
  const wilayah = namaUnit
    .replace(/^Balai Pelaksana Pemilihan Jasa Konstruksi\s*/i, '')
    .replace(/^Balai Jasa Konstruksi\s*/i, '')
    .trim()
  const singkat = jenis === 'BP2JK' ? 'BP2JK' : 'BJKW'
  return `Kepala ${singkat} ${wilayah}`.replace(/\s+/g, ' ').trim()
}

interface BarisJabatan {
  id: number
  kode_jabatan: string
  nama_jabatan: string
  unit_id: number
  nama_unit: string
  jenis: string
  sudah_target: number
  penghuni: number
}

async function main() {
  const { kueri, eksekusi } = await import('../lib/db')
  const { salinPohonRubrik } = await import('../lib/rubrik-salin')

  console.log(`\n=== JABATAN TARGET PER BALAI ${TULIS ? '(MENULIS)' : '(kering)'} ===\n`)

  // Cetakan rubrik: dipastikan ADA dan BERISI sebelum apa pun dibuat. Membuat 41
  // target lalu gagal menyalin di tengah jalan meninggalkan keadaan separuh yang
  // harus dibereskan tangan.
  const cetakanId = new Map<string, { id: number; komponen: number }>()
  for (const [jenis, c] of Object.entries(CETAKAN)) {
    const [t] = await kueri<{ id: number; komponen: number }>(
      `SELECT jt.id, (SELECT COUNT(*) FROM rubrik_komponen k WHERE k.jabatan_target_id = jt.id) AS komponen
         FROM jabatan_target jt WHERE jt.kode_target = ?`,
      [c.kode],
    )
    if (!t) {
      console.error(`  ✗ cetakan untuk ${jenis} tidak ada: kode_target ${c.kode}`)
      process.exit(1)
    }
    if (Number(t.komponen) === 0) {
      console.error(`  ✗ cetakan ${c.kode} tidak punya rubrik — tidak ada yang bisa disalin.`)
      process.exit(1)
    }
    cetakanId.set(jenis, { id: Number(t.id), komponen: Number(t.komponen) })
    console.log(`  cetakan ${jenis.padEnd(6)} : #${t.id} ${c.kode} (${t.komponen} komponen) — ${c.label}`)
  }

  /*
    Yang dicari: jabatan KEPALA BALAI, satu per unit Balai/BP2JK.

    Dikunci `eselon = 'III'` DAN unitnya berjenis BALAI/BP2JK — bukan menurut nama
    jabatannya. Nama jabatan Kepala Balai di daftar resmi tidak seragam (berkas
    acuan bahkan menuliskan "Kepala Balai Jasa Konstruksi Pelaksana Pemilihan Jasa
    Konstruksi Jasa Konstruksi" untuk BJKW — "Jasa Konstruksi" tiga kali), jadi
    mencocokkan nama akan melewatkan sebagian balai tanpa memberi tahu.
  */
  const jab = await kueri<BarisJabatan>(
    `SELECT j.id, j.kode_jabatan, j.nama_jabatan, u.id AS unit_id, u.nama_unit, u.jenis,
            (SELECT COUNT(*) FROM jabatan_target_anggota a WHERE a.jabatan_id = j.id) AS sudah_target,
            (SELECT COUNT(*) FROM pegawai p WHERE p.jabatan_id = j.id AND p.status_aktif = 'AKTIF') AS penghuni
       FROM jabatan j
       JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
      WHERE u.jenis IN ('BALAI', 'BP2JK')
        AND j.eselon = 'III'
        AND j.status_jabatan <> 'DIHAPUS'
      ORDER BY u.jenis, u.nama_unit`,
  )

  /*
    SATU target per UNIT, bukan per jabatan.

    Terukur: **12 balai punya DUA jabatan eselon III** — satu dari impor Excel
    dengan nama berimbuhan wilayah ("Kepala Balai Pelaksana Pemilihan Jasa
    Konstruksi Wilayah Sumatera Selatan", BERPENGHUNI) dan satu dari daftar
    struktural resmi dengan nama pendek ("Kepala Balai Pelaksana Pemilihan Jasa
    Konstruksi", KOSONG). Keduanya kursi yang SAMA; audit pasangan (nama, unit)
    tidak menangkapnya justru karena namanya berbeda.

    Kalau target dibuat per jabatan, 12 balai itu dapat DUA target — persis
    generalisasi terbalik: bukan satu daftar untuk 34 balai, tapi dua daftar untuk
    satu balai. Jadi dipilih SATU: yang BERPENGHUNI lebih dulu, sebab suksesi
    menyoal kursi yang benar-benar diduduki dan riwayat pegawainya menempel di
    sana; kalau tidak ada yang berpenghuni, yang kode-nya dari daftar resmi.

    Duplikasinya sendiri TIDAK dibereskan di sini — menggabungkan dua jabatan
    berarti mengalihkan pegawai/riwayat/anggota target lalu menghapus satu, dan
    memilih nama mana yang resmi adalah keputusan pemilik proses.
  */
  const perUnit = new Map<number, BarisJabatan[]>()
  for (const j of jab) {
    if (!perUnit.has(j.unit_id)) perUnit.set(j.unit_id, [])
    perUnit.get(j.unit_id)!.push(j)
  }
  const gandaDiUnit: string[] = []
  const terpilih: BarisJabatan[] = []
  for (const kandidat of perUnit.values()) {
    if (kandidat.length > 1) {
      const berpenghuni = kandidat.filter((k) => Number(k.penghuni) > 0)
      gandaDiUnit.push(
        `${kandidat[0]!.nama_unit}: ${kandidat
          .map((k) => `${k.kode_jabatan}${Number(k.penghuni) > 0 ? ' (berpenghuni)' : ' (kosong)'}`)
          .join(' + ')}`,
      )
      terpilih.push(
        berpenghuni[0] ??
          kandidat.find((k) => k.kode_jabatan.startsWith('JAB-STR')) ??
          kandidat[0]!,
      )
      continue
    }
    terpilih.push(kandidat[0]!)
  }

  const kodeTerpakai = new Set(
    (await kueri<{ kode_target: string }>('SELECT kode_target FROM jabatan_target')).map(
      (r) => r.kode_target,
    ),
  )

  const rencana: Array<{ j: BarisJabatan; kode: string; nama: string; cetakan: number }> = []
  const dilewati: string[] = []
  const anggotaGanda: string[] = []
  for (const j of terpilih) {
    /*
      Jabatan yang SUDAH jadi anggota target lain TIDAK dilewati — dan itu berbeda
      dari `impor-jabatan-target.ts`, yang memang menolaknya.

      Di sana alasannya benar: dua target untuk satu jabatan berarti dua daftar
      kandidat yang bersaing tanpa ada di UI yang menjelaskan mana yang dipakai. Di
      sini keadaannya justru itu yang sedang dibetulkan — 8 balai "terwakili" oleh
      target GENERIK (#1 memuat 5 balai BP2JK sekaligus, #3 memuat 2 BJKW), dan
      melewatinya berarti 8 balai tetap tanpa daftar kandidatnya sendiri: separuh
      pekerjaan yang justru diminta.

      Konsekuensinya dilaporkan terang-terangan, bukan disembunyikan: jabatan itu
      jadi anggota DUA target sampai pemilik proses memutuskan menon-aktifkan yang
      generik.
    */
    if (Number(j.sudah_target) > 0) {
      anggotaGanda.push(`${j.nama_unit} (${j.kode_jabatan})`)
    }
    const kode = `JT-${j.kode_jabatan}`.slice(0, 40)
    if (kodeTerpakai.has(kode)) {
      dilewati.push(`${j.nama_unit} — kode ${kode} sudah dipakai`)
      continue
    }
    const c = cetakanId.get(j.jenis)
    if (!c) {
      dilewati.push(`${j.nama_unit} — tidak ada cetakan rubrik untuk jenis ${j.jenis}`)
      continue
    }
    kodeTerpakai.add(kode)
    rencana.push({ j, kode, nama: namaTarget(j.nama_unit, j.jenis), cetakan: c.id })
  }

  console.log(`\n── jabatan Kepala Balai di master : ${jab.length} pada ${perUnit.size} unit balai`)
  if (gandaDiUnit.length > 0) {
    console.log(`── ⚠ unit ber-DUA jabatan eselon III: ${gandaDiUnit.length} — dipilih SATU per unit`)
    for (const g of gandaDiUnit.slice(0, 5)) console.log(`     · ${g}`)
    if (gandaDiUnit.length > 5) console.log(`     … dan ${gandaDiUnit.length - 5} lainnya`)
    console.log(
      '     Duplikasi jabatannya TIDAK dibereskan skrip ini — menggabungkan dua jabatan\n' +
        '     berarti mengalihkan pegawai/riwayat/anggota target, dan memilih nama mana yang\n' +
        '     resmi adalah keputusan pemilik proses.',
    )
  }
  console.log(`── AKAN DIBUAT                    : ${rencana.length}`)
  const perJenis = new Map<string, number>()
  for (const r of rencana) perJenis.set(r.j.jenis, (perJenis.get(r.j.jenis) ?? 0) + 1)
  for (const [k, n] of perJenis) console.log(`     ${k}: ${n}`)
  for (const r of rencana.slice(0, 8)) console.log(`     ${r.kode.padEnd(30)} ${r.nama}`)
  if (rencana.length > 8) console.log(`     … dan ${rencana.length - 8} lainnya`)
  if (anggotaGanda.length > 0) {
    console.log(`── ⚠ jadi anggota DUA target      : ${anggotaGanda.length}`)
    for (const g of anggotaGanda.slice(0, 6)) console.log(`     · ${g}`)
    if (anggotaGanda.length > 6) console.log(`     … dan ${anggotaGanda.length - 6} lainnya`)
    console.log(
      '     Balai ini sebelumnya "terwakili" target GENERIK. Sesudah target per-balainya\n' +
        '     ada, nonaktifkan yang generik dari UI supaya tidak ada dua daftar kandidat\n' +
        '     untuk satu kursi.',
    )
  }
  console.log(`── DILEWATI                       : ${dilewati.length}`)
  for (const d of dilewati.slice(0, 6)) console.log(`     · ${d}`)
  if (dilewati.length > 6) console.log(`     … dan ${dilewati.length - 6} lainnya`)

  console.log(
    `\n  Status: ${AKTIFKAN ? 'AKTIF' : 'DRAFT'}. ` +
      (AKTIFKAN
        ? 'Target AKTIF ikut dihitung & muncul di pemilih Peta Talenta.'
        : 'DRAFT tetap muncul di pemilih Talent Pool, dan skornya tetap dihitung karena rubriknya ADA — yang DRAFT hanya menahannya dari Peta Talenta.'),
  )



  const DESKRIPSI =
    'Jabatan target per balai, dibuat dari master jabatan struktural resmi. ' +
    'Rubriknya disalin dari target sejenis yang sudah lolos pemeriksaan — periksa ' +
    'persyaratan & bobotnya sebelum diaktifkan bila balai ini punya syarat khusus.'

  /*
    PERSYARATAN ikut disalin, bukan hanya pohon rubriknya.

    `salinPohonRubrik()` menyalin komponen → indikator → kategori, dan itu memang
    tugasnya. Tapi dua hal lain menempel pada JABATAN TARGET, bukan pada rubriknya:
    `kata_kunci_relevansi` (dipakai `nilaiKesesuaianBidangIlmu`) dan baris
    `jabatan_target_syarat_diklat`. Tanpa keduanya, salinan jadi **lebih permisif
    daripada cetakannya** — terukur: cetakan BJKW (#3) punya 5 kata kunci dan
    menyaring 79 kandidat jadi **20**, sementara salinan tanpa kata kunci
    meloloskan **79 dari 79**. Dan karena kesesuaian bidang ilmu jadi seragam untuk
    semua orang, ke-41 balai menghasilkan peringkat yang IDENTIK — yaitu
    generalisasi yang justru sedang dihapus, cuma pindah tempat.

    Jadi keduanya dibaca dari cetakan sekali, lalu ditulis untuk tiap salinan.
  */
  const bawaanCetakan = new Map<
    number,
    {
      kataKunci: string
      syarat: Array<{ kategori_id: number; wajib: number; keterangan: string | null }>
      persyaratan: Array<{
        jenis_syarat: string
        deskripsi: string
        nilai_minimal: string | null
      }>
    }
  >()
  for (const c of cetakanId.values()) {
    const [t] = await kueri<{ kk: string | null }>(
      'SELECT CAST(kata_kunci_relevansi AS CHAR) AS kk FROM jabatan_target WHERE id = ?',
      [c.id],
    )
    const syarat = await kueri<{ kategori_id: number; wajib: number; keterangan: string | null }>(
      'SELECT kategori_id, wajib, keterangan FROM jabatan_target_syarat_diklat WHERE jabatan_target_id = ?',
      [c.id],
    )
    /*
      `jabatan_target_persyaratan` — ini yang MENENTUKAN KELAYAKAN, dan ia yang
      paling mudah terlupakan.

      Jalan pertama menyalin pohon rubrik saja; jalan kedua menambahkan kata kunci
      & syarat diklat. Keduanya menaikkan skor tapi **kelayakan tetap 79 dari 79**,
      sementara cetakan BJKW (#3) hanya meloloskan 20. Yang kurang ternyata tabel
      keempat ini — dan ia ditemukan bukan dengan menebak melainkan dengan
      MENGENUMERASI seluruh FK ke `jabatan_target` di `information_schema` lalu
      membandingkan jumlah barisnya antara cetakan dan salinan. Dua tebakan sebelum
      itu keliru.

      Pelajarannya: "salin konfigurasi jabatan target" bukan satu tabel melainkan
      EMPAT (rubrik, kata kunci, syarat diklat, persyaratan). Kalau nanti ada tabel
      kelima, cara menemukannya sama — enumerasi FK, bandingkan jumlah baris.
    */
    const persyaratan = await kueri<{
      jenis_syarat: string
      deskripsi: string
      nilai_minimal: string | null
    }>(
      'SELECT jenis_syarat, deskripsi, nilai_minimal FROM jabatan_target_persyaratan WHERE jabatan_target_id = ?',
      [c.id],
    )
    bawaanCetakan.set(c.id, { kataKunci: t?.kk ?? '[]', syarat, persyaratan })
  }

  if (!TULIS) console.log('\n  (kering — bagian di bawah hanya dilaporkan)')

  /*
    LENGKAPI target yang sudah dibuat jalan sebelumnya tapi belum berpersyaratan.

    Jalan pertama skrip ini (24 Agu 2026) menyalin pohon rubriknya saja, jadi 41
    target sudah ada tanpa `kata_kunci_relevansi` maupun syarat diklat. Membuatnya
    ulang berarti membuang `match_score` yang sudah dihitung; melengkapinya di
    tempat jauh lebih murah dan hasilnya sama. Ia juga membuat skrip ini bisa
    dijalankan berulang tanpa efek — yang sudah lengkap dilewati.
  */
  let dilengkapi = 0
  for (const [jenis, c] of cetakanId) {
    const bawaan = bawaanCetakan.get(c.id)!
    if (bawaan.kataKunci === '[]' && bawaan.syarat.length === 0 && bawaan.persyaratan.length === 0) continue
    const kurang = await kueri<{ id: number; nama_target: string }>(
      `SELECT jt.id, jt.nama_target FROM jabatan_target jt
         JOIN jabatan_target_anggota a ON a.jabatan_target_id = jt.id
         JOIN jabatan j ON j.id = a.jabatan_id
         JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
        WHERE u.jenis = ?
          AND EXISTS (SELECT 1 FROM rubrik_komponen k WHERE k.jabatan_target_id = jt.id)
          AND NOT EXISTS (SELECT 1 FROM jabatan_target_persyaratan ps WHERE ps.jabatan_target_id = jt.id)
          AND jt.id <> ?`,
      [jenis, c.id],
    )
    if (kurang.length === 0) continue
    console.log(`\n── LENGKAPI persyaratan ${jenis}: ${kurang.length} target dari cetakan #${c.id}`)
    if (!TULIS) continue
    for (const t of kurang) {
      if (bawaan.kataKunci !== '[]' && bawaan.kataKunci !== 'null') {
        await eksekusi(
          'UPDATE jabatan_target SET kata_kunci_relevansi = CAST(? AS JSON) WHERE id = ?',
          [bawaan.kataKunci, t.id],
        )
      }
      for (const sy of bawaan.syarat) {
        await eksekusi(
          `INSERT IGNORE INTO jabatan_target_syarat_diklat (jabatan_target_id, kategori_id, wajib, keterangan)
           VALUES (?, ?, ?, ?)`,
          [t.id, sy.kategori_id, sy.wajib, sy.keterangan],
        )
      }
      for (const ps of bawaan.persyaratan) {
        await eksekusi(
          `INSERT INTO jabatan_target_persyaratan (jabatan_target_id, jenis_syarat, deskripsi, nilai_minimal)
           VALUES (?, ?, ?, ?)`,
          [t.id, ps.jenis_syarat, ps.deskripsi, ps.nilai_minimal],
        )
      }
      dilengkapi++
    }
    console.log(`   ${kurang.length} target dilengkapi`)
  }

  if (!TULIS) {
    console.log('\n  Kering — tidak ada yang ditulis. Tambahkan `-- --tulis`.\n')
    process.exit(0)
  }

  let dibuat = 0
  let komponen = 0
  let indikator = 0
  let kataKunciDisalin = 0
  let syaratDisalin = 0
  let persyaratanDisalin = 0
  for (const r of rencana) {
    const hasil = await eksekusi(
      `INSERT INTO jabatan_target (kode_target, nama_target, deskripsi, kata_kunci_relevansi, status)
       VALUES (?, ?, ?, CAST('[]' AS JSON), ?)`,
      [r.kode, r.nama, DESKRIPSI, AKTIFKAN ? 'AKTIF' : 'DRAFT'],
    )
    const idTarget = Number(hasil.insertId)
    await eksekusi(
      `INSERT INTO jabatan_target_anggota (jabatan_target_id, jabatan_id) VALUES (?, ?)`,
      [idTarget, r.j.id],
    )
    const salin = await salinPohonRubrik(idTarget, r.cetakan)
    komponen += salin.jumlahKomponen
    indikator += salin.jumlahIndikator

    const bawaan = bawaanCetakan.get(r.cetakan)!
    if (bawaan.kataKunci !== '[]' && bawaan.kataKunci !== 'null') {
      await eksekusi('UPDATE jabatan_target SET kata_kunci_relevansi = CAST(? AS JSON) WHERE id = ?', [
        bawaan.kataKunci,
        idTarget,
      ])
      kataKunciDisalin++
    }
    for (const sy of bawaan.syarat) {
      await eksekusi(
        `INSERT INTO jabatan_target_syarat_diklat (jabatan_target_id, kategori_id, wajib, keterangan)
         VALUES (?, ?, ?, ?)`,
        [idTarget, sy.kategori_id, sy.wajib, sy.keterangan],
      )
      syaratDisalin++
    }
    for (const ps of bawaan.persyaratan) {
      await eksekusi(
        `INSERT INTO jabatan_target_persyaratan (jabatan_target_id, jenis_syarat, deskripsi, nilai_minimal)
         VALUES (?, ?, ?, ?)`,
        [idTarget, ps.jenis_syarat, ps.deskripsi, ps.nilai_minimal],
      )
      persyaratanDisalin++
    }
    dibuat++
    if (dibuat <= 5 || dibuat === rencana.length) {
      console.log(`  #${idTarget} ${r.nama} — rubrik ${salin.jumlahKomponen} komponen / ${salin.jumlahIndikator} indikator`)
    }
  }

  await eksekusi(
    `INSERT INTO audit_log (user_id, aksi, entitas, entitas_id, data_sebelum, data_sesudah, ip_address, created_at)
     VALUES (1, 'BUAT', 'jabatan_target', NULL, CAST(? AS JSON), CAST(? AS JSON), '::1', NOW())`,
    [
      JSON.stringify({ akanDibuat: rencana.length, dilewati: dilewati.length }),
      JSON.stringify({
        dibuat,
        status: AKTIFKAN ? 'AKTIF' : 'DRAFT',
        rubrikDisalinDari: Object.fromEntries(
          [...cetakanId].map(([j, c]) => [j, c.id]),
        ),
        catatan:
          'Jabatan target per balai (permintaan pemilik proses 24 Agu 2026). Rubrik disalin dari target sejenis; target generik TIDAK dihapus.',
      }),
    ],
  )

  console.log(`\n── DITULIS`)
  console.log(`  ${dibuat} jabatan target dibuat · ${komponen} komponen · ${indikator} indikator rubrik`)
  console.log(`  ${kataKunciDisalin} kata kunci · ${syaratDisalin} syarat diklat · ${persyaratanDisalin} persyaratan ikut disalin`)
  if (dilengkapi > 0) console.log(`  ${dilengkapi} target lama dilengkapi persyaratannya`)
  /*
    Target GENERIK yang masih memegang jabatan balai — dilaporkan SESUDAH menulis.

    Sesudah tiap balai punya targetnya sendiri, target generik yang masih memuat
    jabatan balai berarti DUA daftar kandidat untuk satu kursi, dan tidak ada di UI
    yang menjelaskan mana yang dipakai. Tidak dinonaktifkan otomatis: keduanya punya
    `match_score`, mungkin punya anggota talent pool, dan menonaktifkan target milik
    orang lain bukan keputusan skrip.
  */
  const generik = await kueri<{ id: number; nama_target: string; status: string; balai: number }>(
    `SELECT jt.id, jt.nama_target, jt.status,
            COUNT(*) AS balai
       FROM jabatan_target jt
       JOIN jabatan_target_anggota a ON a.jabatan_target_id = jt.id
       JOIN jabatan j ON j.id = a.jabatan_id
       JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
      WHERE u.jenis IN ('BALAI', 'BP2JK')
        AND jt.kode_target NOT LIKE 'JT-JAB-STR%'
        AND jt.kode_target NOT LIKE 'JT-JAB-KABALAI-BP2JK-%'
      GROUP BY jt.id
      HAVING balai > 1
      ORDER BY balai DESC`,
  )
  if (generik.length > 0) {
    console.log(`\n── ⚠ TARGET GENERIK yang masih memegang >1 balai: ${generik.length}`)
    for (const g of generik) {
      console.log(`     #${g.id} [${g.status}] ${g.nama_target} — ${g.balai} balai`)
    }
    console.log(
      '     Sesudah tiap balai punya targetnya sendiri, target ini berarti DUA daftar\n' +
        '     kandidat untuk satu kursi. Nonaktifkan dari UI kalau memang sudah tidak\n' +
        '     dipakai — TIDAK dilakukan skrip ini: keduanya punya match_score dan mungkin\n' +
        '     anggota talent pool, dan itu keputusan pemilik proses.',
    )
  }

  console.log(
    '\n  BELUM ADA SKORNYA. Jalankan `npm run ukur:hitung-ulang -- --semua` supaya\n' +
      '  daftar kandidat tiap balai terisi — tanpa itu halaman Kandidat menyatakan\n' +
      '  "belum dihitung", bukan memajang nol.\n',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
