/**
 * Jabatan target dibatasi pada **delapan jabatan lembar "Persyaratan Jabatan"**
 * (PP 11/2017), beserta seluruh syarat minimalnya.
 *
 *   npm run syarat:pp11                     # KERING — melapor, tidak menulis
 *   npm run syarat:pp11 -- --tulis          # tulis syarat + buat target yang belum ada
 *   npm run syarat:pp11 -- --tulis --hanya-aktifkan-delapan
 *                                           # + nonaktifkan target AKTIF lainnya
 *
 * Kering secara bawaan. Skrip yang langsung menulis pada jalan pertama membuat
 * orang membacanya sesudah, bukan sebelum.
 *
 * ## Kenapa ada
 *
 * Permintaan pemilik proses 25 Agu 2026: *"di jabatan target sekarang taro yang ada
 * di sheet itu aja ada jabatan apa aja, jadi yang lain keluarin dulu aja sama
 * pastiin semua persyaratan minimal yang ada di sheet masuk semua di aplikasi"*.
 *
 * Sumbernya lembar **Persyaratan Jabatan** di `doc/doc_tambahan_2/sample(1).xlsx`
 * (identik dengan `sample.xlsx` yang diserahkan): 8 jabatan × 5 kolom syarat —
 * Pendidikan, Bidang Pendidikan, Pelatihan, Pengalaman Kerja, Golongan.
 *
 * Sebelum ini `jabatan_target_persyaratan` berisi prosa hasil penyiapan awal ("Cek
 * syarat jabatan Direktorat Pengadaan…") yang hanya longgar cocok dengan tabel
 * resminya, dan **golongan sama sekali belum punya jenis syarat** (`doc/sql/019`).
 *
 * ## Keputusan pemilik proses yang dipatuhi skrip ini
 *
 *   - **Satu contoh per jabatan yang berulang antar daerah.** *"sebenernya kan itu
 *     jabatan yang sama cuma daerahnya yang beda jadi sama aja, tinggal ambil salah
 *     satu balai yang kosong buat jadi contoh"*. Karena itu Kepala Balai memakai
 *     **BP2JK Wilayah Sumatera Selatan** — kursinya KOSONG, dan balai itu justru
 *     yang disebut sendiri oleh pemilik proses saat meminta kandidat per balai.
 *     Ke-33 target BP2JK lain **tidak dihapus**, hanya tidak ikut diaktifkan.
 *   - **Golongan MENGGUGURKAN** (bukan sekadar keterangan), dengan penolakan yang
 *     selalu menyebut alasannya — ditegakkan `lib/scoring/eligibility.ts`.
 *   - **Yang lain DINONAKTIFKAN, bukan dihapus.** Menghapus mengaskade ke
 *     `match_score`, `talent_pool`, dan lewat itu ke nominasi & persetujuan.
 *     NONAKTIF berarti tidak dihitung dan tidak muncul di pemilih Peta Talenta,
 *     tetapi **persyaratannya tetap bisa diisi manual dari aplikasi** — persis yang
 *     diminta: *"nanti kalo emang lagi kosong bisa diisi persyaratan minimalnya
 *     manual dari aplikasi"*. Tidak ada gerbang status pada `simpanPersyaratan()`.
 *
 * ## Yang JUJUR dan tidak dikarang
 *
 *   - **Bidang pendidikan diisi `semua`**, bukan sembilan rumpun itu sebagai
 *     penyaring. Sel aslinya menutup daftarnya dengan **"(semua jurusan)"**, jadi
 *     memakai daftarnya sebagai gerbang akan MENGGUGURKAN orang yang menurut
 *     lembarnya sendiri memenuhi syarat. Sembilan rumpunnya tetap ditulis utuh di
 *     `deskripsi` supaya tidak hilang, dan indikator rubrik Kesesuaian Bidang Ilmu
 *     tetap memberi nilai lebih pada yang sesuai — menyaring dan menilai memang dua
 *     hal berbeda.
 *   - **Durasi pengalaman dicatat, belum ditegakkan.** "pengawas paling singkat 3
 *     tahun" masuk sebagai `durasi_tahun_min`, dan mesin menandainya PERLU
 *     VERIFIKASI MANUAL beserta angkanya. Alasannya data: dari 670 baris
 *     `riwayat_jabatan`, hanya ~5% terpetakan ke master DAN bertanggal, sehingga
 *     "lama menjabat pada jenjang itu" belum bisa dihitung. Meloloskannya diam-diam
 *     akan menyembunyikan syarat yang belum pernah diperiksa siapa pun.
 *   - **Kamus diklat ditambah "Manajemen Umum"** beserta 8 turunannya — kolom
 *     Pelatihan pada dua baris Kasubag memuatnya, dan `doc/sql/014` melewatkannya.
 *     Diambil apa adanya dari sel itu, tidak ditambah-tambahi.
 *
 * ## Sesudah menjalankan skrip ini
 *
 * Syarat berubah berarti KELAYAKAN berubah, dan `match_score.eligible` adalah kolom
 * TERSIMPAN. Jalankan `npm run db:recompute` (atau Hitung Ulang per target di UI),
 * kalau tidak, daftar kandidat masih memajang kelayakan menurut syarat yang lama.
 * Skrip ini mengatakannya lagi di akhir keluarannya.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')
const HANYA_DELAPAN = process.argv.includes('--hanya-aktifkan-delapan')
/** Buang rubrik yang sudah ada pada kedelapan target lalu salin ulang dari sumber terbersih. */
const RUBRIK_ULANG = process.argv.includes('--rubrik-ulang')

/** Sembilan rumpun bidang pendidikan, apa adanya dari selnya. */
const RUMPUN =
  'Teknik / Ekonomi Studi Pembangunan / Manajemen / Akuntansi / Hukum / Komunikasi / ' +
  'Administrasi Negara / Administrasi Publik / Teknik Informatika (semua jurusan)'

const TEKNIS = ['PBJ', 'HUKUM_KONTRAK', 'MANAJEMEN_KONSTRUKSI']

/**
 * Kategori "Pelatihan Manajemen Umum" beserta turunannya — dari kolom Pelatihan
 * pada baris Kasubag TU & Kasubag Umum dan Tata Usaha.
 */
const MANAJEMEN_UMUM = {
  kode: 'MANAJEMEN_UMUM',
  nama: 'Pelatihan Manajemen Umum',
  anak: [
    ['MU_KEPATUHAN', 'Kepatuhan Internal'],
    ['MU_RISIKO', 'Pengelolaan Manajemen Risiko'],
    ['MU_BMN', 'Pengelolaan BMN'],
    ['MU_SDM', 'Manajemen Pengembangan SDM'],
    ['MU_AKUNTANSI', 'Sistem Akuntansi Instansi'],
    ['MU_PELAKSANAAN_ANGGARAN', 'Pelaksanaan Anggaran'],
    ['MU_PERENCANAAN_ANGGARAN', 'Perencanaan Anggaran'],
    ['MU_KEARSIPAN', 'Tata Persuratan dan Kearsipan'],
  ] as const,
}

interface BarisLembar {
  no: number
  /** Nama pada lembar, apa adanya. */
  namaLembar: string
  /** Nama & unit di MASTER jabatan — penamaannya berbeda dari lembar. */
  namaMaster: string
  namaUnit: string
  pendidikan: 'S2' | 'S1_D4'
  golongan: string
  /** Eselon jenjang pengalaman + lamanya, dari kolom Pengalaman Kerja. */
  pengalaman: { eselon: 'III' | 'IV' | 'NON_ESELON'; tahun: number; teks: string }
  /** Kode kategori diklat yang dipersyaratkan. */
  diklat: string[]
}

const PENGALAMAN_ADMINISTRATOR = {
  eselon: 'III' as const,
  tahun: 2,
  teks:
    'Sedang atau pernah menduduki jabatan administrator (kepala bagian / kepala sub direktorat / ' +
    'kepala bidang / kepala balai) atau jabatan fungsional jenjang Ahli Madya (Pembina Jasa ' +
    'Konstruksi Ahli Madya / Pengelola Pengadaan Barang dan Jasa Ahli Madya) paling singkat 2 tahun',
}

const PENGALAMAN_PENGAWAS = {
  eselon: 'IV' as const,
  tahun: 3,
  teks:
    'Memiliki pengalaman pada jabatan pengawas (kepala subbagian / kepala seksi) paling singkat ' +
    '3 tahun, atau jabatan fungsional setingkat pengawas (Pembina Jasa Konstruksi Ahli Muda / ' +
    'Pengelola Pengadaan Barang dan Jasa Ahli Muda) sesuai bidang tugas jabatan yang akan diduduki',
}

const PENGALAMAN_PELAKSANA = {
  eselon: 'NON_ESELON' as const,
  tahun: 4,
  teks:
    'Memiliki pengalaman dalam jabatan pelaksana paling singkat 4 tahun, atau jabatan fungsional ' +
    'yang setingkat dengan jabatan pelaksana sesuai bidang tugas jabatan yang akan diduduki',
}

const UNIT_PENGADAAN = 'Direktorat Pengadaan Jasa Konstruksi'
const UNIT_BALAI_CONTOH = 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera Selatan'

const LEMBAR: BarisLembar[] = [
  {
    no: 1,
    namaLembar: 'Direktur Pengadaan Jasa Konstruksi',
    namaMaster: 'Direktur Pengadaan Jasa Konstruksi',
    namaUnit: UNIT_PENGADAAN,
    pendidikan: 'S2',
    golongan: 'IV/b',
    pengalaman: PENGALAMAN_ADMINISTRATOR,
    diklat: ['PIM_III', ...TEKNIS],
  },
  {
    no: 2,
    namaLembar: 'Kasubdit Sistem Pengadaan Jasa Konstruksi',
    namaMaster: 'Kepala Sub Direktorat Sistem Pengadaan Jasa Konstruksi',
    namaUnit: UNIT_PENGADAAN,
    pendidikan: 'S1_D4',
    golongan: 'III/d',
    pengalaman: PENGALAMAN_PENGAWAS,
    diklat: ['PIM_IV', ...TEKNIS],
  },
  {
    no: 3,
    namaLembar: 'Kasubdit Fasilitasi dan Kelembagaan Pengadaan Jasa Konstruksi',
    namaMaster: 'Kepala Sub Direktorat Fasilitasi dan Kelembagaan Pengadaan Jasa Konstruksi',
    namaUnit: UNIT_PENGADAAN,
    pendidikan: 'S1_D4',
    golongan: 'III/d',
    pengalaman: PENGALAMAN_PENGAWAS,
    diklat: ['PIM_IV', ...TEKNIS],
  },
  {
    no: 4,
    namaLembar: 'Kasubdit Pengelolaan Katalog Elektronik',
    namaMaster: 'Kepala Sub Direktorat Pengelolaan Katalog Elektronik',
    namaUnit: UNIT_PENGADAAN,
    pendidikan: 'S1_D4',
    golongan: 'III/d',
    pengalaman: PENGALAMAN_PENGAWAS,
    diklat: ['PIM_IV', ...TEKNIS],
  },
  {
    no: 5,
    namaLembar: 'Kasubdit Kontrak Kontruksi',
    namaMaster: 'Kepala Sub Direktorat Kontrak Kontruksi',
    namaUnit: UNIT_PENGADAAN,
    pendidikan: 'S1_D4',
    golongan: 'III/d',
    pengalaman: PENGALAMAN_PENGAWAS,
    diklat: ['PIM_IV', ...TEKNIS],
  },
  {
    no: 6,
    namaLembar: 'Kasubag TU',
    namaMaster: 'Kepala Sub Bagian Tata Usaha',
    namaUnit: UNIT_PENGADAAN,
    pendidikan: 'S1_D4',
    golongan: 'III/b',
    pengalaman: PENGALAMAN_PELAKSANA,
    diklat: [...TEKNIS, MANAJEMEN_UMUM.kode],
  },
  {
    no: 7,
    namaLembar: 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi',
    namaMaster: 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi',
    namaUnit: UNIT_BALAI_CONTOH,
    pendidikan: 'S1_D4',
    golongan: 'III/d',
    pengalaman: PENGALAMAN_PENGAWAS,
    diklat: ['PIM_IV', ...TEKNIS],
  },
  {
    no: 8,
    namaLembar: 'Kasubag Umum dan Tata Usaha',
    namaMaster: 'Kepala Sub Bagian Umum dan Tata Usaha',
    namaUnit: UNIT_BALAI_CONTOH,
    pendidikan: 'S1_D4',
    golongan: 'III/b',
    pengalaman: PENGALAMAN_PELAKSANA,
    diklat: [...TEKNIS, MANAJEMEN_UMUM.kode],
  },
]

interface Rencana {
  baris: BarisLembar
  jabatanId: number
  targetId: number | null
  namaTarget: string | null
  statusTarget: string | null
  komponenRubrik: number
}

async function main() {
  const { kueri, kueriSatu, eksekusi } = await import('../lib/db')
  const { ambilPohonRubrik } = await import('../lib/kueri/rubrik')
  const { validasiRubrik } = await import('../lib/scoring')
  const { salinPohonRubrik } = await import('../lib/rubrik-salin')

  console.log(`\n=== SYARAT JABATAN PP 11/2017 → JABATAN TARGET ${TULIS ? '(MENULIS)' : '(kering)'} ===\n`)

  // ── 1. Cocokkan 8 baris lembar ke master jabatan ─────────────────────────
  const rencana: Rencana[] = []
  const tidakCocok: string[] = []

  for (const b of LEMBAR) {
    const j = await kueriSatu<{ id: number }>(
      `SELECT j.id FROM jabatan j JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
        WHERE j.nama_jabatan = ? AND u.nama_unit = ? AND j.status_jabatan <> 'DIHAPUS'
        LIMIT 1`,
      [b.namaMaster, b.namaUnit],
    )
    if (j === null) {
      tidakCocok.push(`#${b.no} ${b.namaLembar} → "${b.namaMaster}" @ ${b.namaUnit}`)
      continue
    }
    /*
      Yang dicari target yang anggotanya **HANYA jabatan ini** — bukan yang AKTIF, dan
      bukan yang rubriknya paling lengkap.

      Alasannya justru keluhan yang memulai seluruh pekerjaan ini: target generik.
      `jabatan_target` #1 beranggota SATU Kasubdit + LIMA Kepala Balai sekaligus, dan
      #2 beranggota Direktur Pengadaan + Kepala Bagian Keuangan + **Direktur Jenderal**.
      Menuliskan syarat "Kepala Balai, golongan III/d" ke #1 berarti syarat itu juga
      menggugurkan kandidat Kasubdit; menuliskan syarat Direktur ke #2 berarti kursi
      Dirjen ikut dinilai dengan syarat Direktur. Keduanya salah tanpa memunculkan
      galat apa pun — daftar kandidatnya tetap terisi, hanya isinya keliru.

      Kalau tidak ada target satu-anggota, skrip MEMBUAT yang baru alih-alih memakai
      yang generik. Target generiknya tidak disentuh; ia cukup tidak ikut diaktifkan.
    */
    const t = await kueriSatu<{ id: number; nama_target: string; status: string; komponen: number }>(
      `SELECT t.id, t.nama_target, t.status,
              (SELECT COUNT(*) FROM rubrik_komponen k WHERE k.jabatan_target_id = t.id) AS komponen
         FROM jabatan_target t
         JOIN jabatan_target_anggota a ON a.jabatan_target_id = t.id
        WHERE a.jabatan_id = ?
          AND (SELECT COUNT(*) FROM jabatan_target_anggota a2 WHERE a2.jabatan_target_id = t.id) = 1
        ORDER BY (SELECT COUNT(*) FROM rubrik_komponen k2 WHERE k2.jabatan_target_id = t.id) DESC,
                 (t.status = 'AKTIF') DESC,
                 t.id
        LIMIT 1`,
      [Number(j.id)],
    )
    rencana.push({
      baris: b,
      jabatanId: Number(j.id),
      targetId: t === null ? null : Number(t.id),
      namaTarget: t?.nama_target ?? null,
      statusTarget: t?.status ?? null,
      komponenRubrik: t === null ? 0 : Number(t.komponen),
    })
  }

  if (tidakCocok.length > 0) {
    console.log(`TIDAK COCOK dengan master jabatan (${tidakCocok.length}) — DIHENTIKAN:`)
    for (const t of tidakCocok) console.log(`  · ${t}`)
    console.log(
      '\n  Nama pada lembar berbeda dari master (mis. "Kasubdit" vs "Kepala Sub Direktorat").\n' +
        '  Perbaiki pemetaannya di `LEMBAR` — JANGAN membuat jabatan baru di master hanya\n' +
        '  supaya skrip ini jalan; itu menambah kursi yang tidak ada di struktur organisasi.\n',
    )
    process.exit(1)
  }

  console.log('Delapan jabatan lembar → master jabatan → jabatan target:')
  for (const r of rencana) {
    const t =
      r.targetId === null
        ? 'BELUM ADA target → akan dibuat'
        : `target #${r.targetId} ${r.statusTarget} (${r.komponenRubrik} komponen rubrik)`
    console.log(`  #${r.baris.no} ${r.baris.namaMaster}`)
    console.log(`      @ ${r.baris.namaUnit}`)
    console.log(`      jabatan #${r.jabatanId} · ${t}`)
  }

  // ── 2. Kategori diklat "Manajemen Umum" ─────────────────────────────────
  const kategoriAda = new Map(
    (
      await kueri<{ id: number; kode: string }>(
        `SELECT id, kode FROM master_kategori_riwayat_diklat`,
      )
    ).map((r) => [r.kode, Number(r.id)]),
  )
  const diklatKurang = [
    ...new Set(LEMBAR.flatMap((b) => b.diklat).filter((k) => !kategoriAda.has(k))),
  ]
  console.log(
    `\nKategori diklat: ${kategoriAda.size} sudah ada · ${diklatKurang.length} perlu dibuat` +
      (diklatKurang.length > 0 ? ` (${diklatKurang.join(', ')})` : ''),
  )
  if (diklatKurang.includes(MANAJEMEN_UMUM.kode)) {
    console.log(
      `  "${MANAJEMEN_UMUM.nama}" + ${MANAJEMEN_UMUM.anak.length} turunannya akan ditambahkan —\n` +
        '  kolom Pelatihan pada dua baris Kasubag memuatnya, dan doc/sql/014 melewatkannya.',
    )
  }

  // ── 3. Target AKTIF yang akan dinonaktifkan ─────────────────────────────
  const idDelapan = new Set(rencana.map((r) => r.targetId).filter((x): x is number => x !== null))
  const aktifLain = await kueri<{ id: number; nama_target: string; pool: number }>(
    `SELECT t.id, t.nama_target,
            (SELECT COUNT(*) FROM talent_pool tp WHERE tp.jabatan_target_id = t.id) AS pool
       FROM jabatan_target t WHERE t.status = 'AKTIF'`,
  )
  const akanNonaktif = aktifLain.filter((t) => !idDelapan.has(Number(t.id)))
  console.log(
    `\nTarget AKTIF sekarang: ${aktifLain.length}. Di luar delapan: ${akanNonaktif.length}` +
      (HANYA_DELAPAN ? ' → akan DINONAKTIFKAN' : ' → dibiarkan (tambahkan --hanya-aktifkan-delapan)'),
  )
  for (const t of akanNonaktif) {
    console.log(`  · #${t.id} ${t.nama_target}${Number(t.pool) > 0 ? ` · ${t.pool} entri pool (TETAP UTUH)` : ''}`)
  }

  if (!TULIS) {
    console.log('\nKering — tidak ada yang ditulis. Tambahkan `-- --tulis`.\n')
    process.exit(0)
  }

  // ── 4. TULIS: kategori diklat lebih dulu ────────────────────────────────
  if (!kategoriAda.has(MANAJEMEN_UMUM.kode)) {
    const { insertId } = await eksekusi(
      `INSERT INTO master_kategori_riwayat_diklat (kode, nama, parent_id, aktif)
       VALUES (?, ?, NULL, 1)`,
      [MANAJEMEN_UMUM.kode, MANAJEMEN_UMUM.nama],
    )
    kategoriAda.set(MANAJEMEN_UMUM.kode, Number(insertId))
    for (const [kode, nama] of MANAJEMEN_UMUM.anak) {
      if (kategoriAda.has(kode)) continue
      const anak = await eksekusi(
        `INSERT INTO master_kategori_riwayat_diklat (kode, nama, parent_id, aktif)
         VALUES (?, ?, ?, 1)`,
        [kode, nama, Number(insertId)],
      )
      kategoriAda.set(kode, Number(anak.insertId))
    }
    console.log(`\n  kategori "${MANAJEMEN_UMUM.nama}" + ${MANAJEMEN_UMUM.anak.length} turunan dibuat`)
  }

  // ── 5. Buat target yang belum ada ───────────────────────────────────────
  console.log('\n── MENULIS ──')
  for (const r of rencana) {
    if (r.targetId !== null) continue
    const j = await kueriSatu<{ kode_jabatan: string; nama_jabatan: string }>(
      `SELECT kode_jabatan, nama_jabatan FROM jabatan WHERE id = ?`,
      [r.jabatanId],
    )
    const kode = `JT-${j!.kode_jabatan}`.slice(0, 40)
    const { insertId } = await eksekusi(
      `INSERT INTO jabatan_target (kode_target, nama_target, deskripsi, kata_kunci_relevansi, status)
       VALUES (?, ?, ?, JSON_ARRAY('semua'), 'DRAFT')`,
      [
        kode,
        j!.nama_jabatan.slice(0, 250),
        `Syarat minimal dari lembar "Persyaratan Jabatan" (PP 11/2017) — ${r.baris.namaLembar}.`,
      ],
    )
    await eksekusi(
      `INSERT INTO jabatan_target_anggota (jabatan_target_id, jabatan_id) VALUES (?, ?)`,
      [Number(insertId), r.jabatanId],
    )
    r.targetId = Number(insertId)
    r.namaTarget = j!.nama_jabatan
    r.statusTarget = 'DRAFT'
    console.log(`  target #${insertId} dibuat — ${j!.nama_jabatan} (${kode})`)
  }

  // ── 6. Tulis persyaratan (ganti utuh) + syarat diklat ───────────────────
  for (const r of rencana) {
    const id = r.targetId!
    const b = r.baris

    await eksekusi(`DELETE FROM jabatan_target_persyaratan WHERE jabatan_target_id = ?`, [id])
    const syarat: Array<[string, string, string | null, number | null]> = [
      [
        'PENDIDIKAN_MIN',
        `Pendidikan minimal ${b.pendidikan === 'S2' ? 'S2' : 'D4/S1'} (PP 11/2017).`,
        b.pendidikan,
        null,
      ],
      [
        'BIDANG_ILMU',
        `Bidang pendidikan: ${RUMPUN}. Sel aslinya menutup daftarnya dengan "(semua jurusan)", jadi gerbang kelayakan diisi "semua" — daftar rumpun di atas dipakai indikator rubrik Kesesuaian Bidang Ilmu untuk MENILAI, bukan untuk menggugurkan.`,
        'semua',
        null,
      ],
      ['GOLONGAN_MIN', `Golongan minimal ${b.golongan} (PP 11/2017).`, b.golongan, null],
      ['PENGALAMAN_MIN', b.pengalaman.teks, b.pengalaman.eselon, b.pengalaman.tahun],
    ]
    for (const [jenis, deskripsi, nilai, durasi] of syarat) {
      await eksekusi(
        `INSERT INTO jabatan_target_persyaratan
           (jabatan_target_id, jenis_syarat, deskripsi, nilai_minimal, durasi_tahun_min)
         VALUES (?, ?, ?, ?, ?)`,
        [id, jenis, deskripsi, nilai, durasi],
      )
    }

    // `kata_kunci_relevansi` HARUS ikut baris BIDANG_ILMU — satu deklarasi, dua
    // penyimpanan (lihat `simpanPersyaratan()`); membiarkannya berselisih membuat
    // gerbang & rubrik menilai bidang ilmu dengan daftar berbeda.
    await eksekusi(`UPDATE jabatan_target SET kata_kunci_relevansi = JSON_ARRAY('semua') WHERE id = ?`, [id])

    await eksekusi(`DELETE FROM jabatan_target_syarat_diklat WHERE jabatan_target_id = ?`, [id])
    for (const kode of b.diklat) {
      const kategoriId = kategoriAda.get(kode)
      if (kategoriId === undefined) {
        console.log(`  ! kategori diklat "${kode}" tidak ada — dilewati untuk #${id}`)
        continue
      }
      await eksekusi(
        `INSERT INTO jabatan_target_syarat_diklat (jabatan_target_id, kategori_id, wajib, keterangan)
         VALUES (?, ?, 1, ?)`,
        [id, kategoriId, `Kolom Pelatihan lembar Persyaratan Jabatan — ${b.namaLembar}`],
      )
    }
    console.log(`  #${id} ${r.namaTarget}: 4 persyaratan + ${b.diklat.length} kategori diklat`)
  }

  /*
    ── 7. Salin rubrik ke target yang kosong ───────────────────────────────

    Sumbernya dipilih menurut **jumlah temuan pemeriksaan**, bukan jumlah indikator.
    Versi pertama skrip ini memilih "yang indikatornya paling banyak" dan mendapat
    target #199 — yang justru rubrik BERCACAT yang sudah tercatat di CLAUDE.md:
    indikator ke-10 "Semua Jurusan" tanpa kategori skor, dan "Tingkat Pendidikan
    Formal" punya 1 sub-indikator sekaligus 5 kategori sendiri sehingga kategorinya
    diabaikan. Rubrik itu **tetap lolos aktivasi** (keduanya PERINGATAN, bukan GALAT),
    jadi kekeliruannya menyebar ke 7 target tanpa satu pun penolakan — persis bentuk
    kegagalan yang membuat `lib/scoring/validasi.ts` ada.

    Jadi: temuan paling sedikit dulu (galat, lalu peringatan), baru indikator
    terbanyak. Kedelapan target tujuan dikecualikan dari daftar sumber — kalau tidak,
    salinan bercacat dari jalan sebelumnya bisa dipilih sebagai sumber jalan ini.
  */
  const idTujuan = new Set(rencana.map((r) => r.targetId).filter((x): x is number => x !== null))
  const kandidatSumber = await kueri<{ id: number }>(
    `SELECT t.id FROM jabatan_target t
      WHERE (SELECT COUNT(*) FROM rubrik_komponen k WHERE k.jabatan_target_id = t.id) > 0
      ORDER BY (SELECT COUNT(*) FROM rubrik_indikator i
                  JOIN rubrik_komponen k3 ON k3.id = i.rubrik_komponen_id
                 WHERE k3.jabatan_target_id = t.id) DESC, t.id`,
  )
  let sumberRubrik: { id: number } | null = null
  let temuanSumber = Number.POSITIVE_INFINITY
  for (const k of kandidatSumber) {
    const id = Number(k.id)
    if (idTujuan.has(id)) continue
    const v = validasiRubrik(await ambilPohonRubrik(id), { untukJabatanTarget: true })
    const temuan = v.jumlahGalat * 1000 + v.temuan.length
    if (!v.bisaDiaktifkan) continue
    if (temuan < temuanSumber) {
      temuanSumber = temuan
      sumberRubrik = { id }
    }
    if (temuan === 0) break
  }
  if (sumberRubrik !== null) {
    console.log(`\n  sumber rubrik terpilih: target #${sumberRubrik.id} · ${temuanSumber} temuan pemeriksaan`)
  }

  if (RUBRIK_ULANG) {
    for (const r of rencana) {
      // Hapus KOMPONEN-nya; indikator & kategori ikut lewat ON DELETE CASCADE.
      const { affectedRows } = await eksekusi(
        `DELETE FROM rubrik_komponen WHERE jabatan_target_id = ?`,
        [r.targetId],
      )
      if (affectedRows > 0) console.log(`  #${r.targetId} rubrik lama dibuang (${affectedRows} komponen)`)
    }
  }
  for (const r of rencana) {
    const id = r.targetId!
    const n = await kueriSatu<{ n: number }>(
      `SELECT COUNT(*) AS n FROM rubrik_komponen WHERE jabatan_target_id = ?`,
      [id],
    )
    if (Number(n?.n ?? 0) > 0) continue
    if (sumberRubrik === null) {
      console.log(`  ! tidak ada rubrik sumber untuk disalin ke #${id}`)
      continue
    }
    const hasil = await salinPohonRubrik(id, Number(sumberRubrik.id))
    console.log(
      `  #${id} rubrik disalin dari target #${sumberRubrik.id}: ` +
        `${hasil.jumlahKomponen} komponen · ${hasil.jumlahIndikator} indikator · ${hasil.jumlahKategori} kategori`,
    )
  }

  // ── 8. Aktifkan yang rubriknya lolos ────────────────────────────────────
  console.log('\n── AKTIVASI ──')
  for (const r of rencana) {
    const id = r.targetId!
    const pohon = await ambilPohonRubrik(id)
    const v = validasiRubrik(pohon, { untukJabatanTarget: true })
    if (!v.bisaDiaktifkan) {
      console.log(`  #${id} ${r.namaTarget}: TIDAK diaktifkan — ${v.jumlahGalat} galat rubrik`)
      const pertama = v.temuan.find((t) => t.tingkat === 'GALAT')
      if (pertama) console.log(`      ${pertama.nama}: ${pertama.pesan}`)
      continue
    }
    await eksekusi(`UPDATE jabatan_target SET status = 'AKTIF' WHERE id = ?`, [id])
    console.log(`  #${id} ${r.namaTarget}: AKTIF`)
  }

  if (HANYA_DELAPAN) {
    const idFinal = rencana.map((r) => r.targetId!).filter((x) => x > 0)
    const { affectedRows } = await eksekusi(
      `UPDATE jabatan_target SET status = 'NONAKTIF'
        WHERE status = 'AKTIF' AND id NOT IN (${idFinal.map(() => '?').join(',')})`,
      idFinal,
    )
    console.log(`\n  ${affectedRows} jabatan target lain DINONAKTIFKAN (tidak dihapus).`)
  }

  const ringkas = await kueri<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM jabatan_target GROUP BY status`,
  )
  console.log('\n── HASIL ──')
  console.log('  jabatan_target per status:', ringkas.map((r) => `${r.status} ${r.n}`).join(' · '))
  console.log(
    '\n  LANGKAH BERIKUTNYA — wajib: `npm run db:recompute`.\n' +
      '  Syarat berubah berarti kelayakan berubah, dan `match_score.eligible` kolom\n' +
      '  TERSIMPAN. Sebelum dihitung ulang, daftar kandidat masih memajang kelayakan\n' +
      '  menurut syarat yang lama — angka yang terlihat wajar tapi sudah tidak benar.\n',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
