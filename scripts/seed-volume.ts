/**
 * Bangun database uji volume `pupr_dev_volume` berisi ~2.000 pegawai.
 *
 * Alasannya (phase.md §3 K-5): dev punya 40 pegawai, produksi 1.872 ASN di 48
 * unit kerja — 47x lebih besar. Dashboard yang terasa instan di dev bisa
 * merangkak di produksi kalau ada agregasi yang tanpa sadar dikerjakan di
 * JavaScript. Uji ini jadi GERBANG penyelesaian Fase 1, bukan aktivitas
 * belakangan.
 *
 * Database ini SEKALI PAKAI dan terpisah dari `pupr_dev` — isinya data
 * berulang hasil penggandaan, bukan data yang layak dilihat manusia.
 *
 * Jalankan: npm run db:volume
 * Ukur    : npm run ukur:kueri:volume
 */

import { readFileSync } from 'node:fs'
import { config } from 'dotenv'
import mysql from 'mysql2/promise'

config({ path: '.env.local' })
config({ path: '.env' })

const SUMBER = process.env.DATABASE_NAME ?? 'pupr_dev'
const TUJUAN = 'pupr_dev_volume'
/** 40 pegawai sumber x 50 salinan = 2.000 pegawai. */
const SALINAN = 50

/** Tabel master yang disalin apa adanya — strukturnya tidak digandakan. */
const TABEL_MASTER = [
  'roles',
  'unit_organisasi',
  'users',
  'jabatan',
  'jabatan_target',
  'jabatan_target_anggota',
  'jabatan_target_persyaratan',
  'rubrik_komponen',
  'rubrik_indikator',
  'rubrik_kategori_skor',
  'api_client',
  'api_token',
  // `master_kategori_riwayat_diklat` SENGAJA tidak di sini: isinya lahir dari
  // INSERT di dalam `014_kategori_riwayat.sql` sendiri, yang sudah ikut dipasang
  // lewat BERKAS_SKEMA. Menyalinnya lagi menabrak primary key.
  //
  // `jabatan_target_syarat_diklat` SEBALIKNYA harus disalin: `015` mengisinya
  // lewat `INSERT … SELECT FROM jabatan_target`, dan di alur volume tabel itu
  // masih kosong saat skema dipasang — jadi hasilnya nol baris. Tanpa disalin,
  // seluruh jabatan target di volume jadi "tanpa syarat pelatihan" dan indikator
  // Pengembangan Kompetensi tidak pernah menghasilkan 100 maupun 50 di sana.
  'jabatan_target_syarat_diklat',
]

/** Ekspresi Kotak 9 versi SQL (ambang Lampiran A). Lihat catatan di bawah. */
const SQL_KOTAK_9 = `
  CASE WHEN y >= 80 THEN CASE WHEN x >= 80 THEN 9 WHEN x >= 60 THEN 7 ELSE 4 END
       WHEN y >= 60 THEN CASE WHEN x >= 80 THEN 8 WHEN x >= 60 THEN 5 ELSE 2 END
       ELSE CASE WHEN x >= 80 THEN 6 WHEN x >= 60 THEN 3 ELSE 1 END END
`

async function main() {
  const conn = await mysql.createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    multipleStatements: true,
  })

  const mulai = Date.now()
  const langkah = async (nama: string, fn: () => Promise<unknown>) => {
    const t0 = Date.now()
    await fn()
    console.log(`  ${nama.padEnd(34)} ${Date.now() - t0} ms`)
  }

  console.log(`Membangun ${TUJUAN} dari ${SUMBER} (x${SALINAN} pegawai)\n`)

  await langkah('buat database', async () => {
    await conn.query(`DROP DATABASE IF EXISTS \`${TUJUAN}\``)
    await conn.query(
      `CREATE DATABASE \`${TUJUAN}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`,
    )
  })

  // SEMUA berkas doc/sql yang memuat DDL harus ada di sini. Tabel master di
  // bawah disalin dengan `SELECT *`, jadi satu kolom yang tertinggal membuat
  // jumlah kolom sumber & tujuan berbeda dan penyalinannya gagal — bukan
  // menghasilkan skema yang diam-diam ketinggalan. Tambahkan berkas baru di sini
  // setiap kali ada perubahan skema.
  const BERKAS_SKEMA = [
    'doc/sql/001_schema.sql',
    'doc/sql/005_skema_tambahan.sql',
    'doc/sql/009_kolom_pembanding.sql',
    'doc/sql/010_kunci_indikator.sql',
    'doc/sql/011_notifikasi.sql',
    'doc/sql/012_auth.sql',
    'doc/sql/014_kategori_riwayat.sql',
    'doc/sql/015_syarat_diklat_target.sql',
    /*
      016–029 masuk 1 Sep 2026 — sebelumnya daftar ini berhenti di 015 sementara
      tujuh berkas sesudahnya mengubah SKEMA, jadi `pupr_dev_volume` dibangun
      tanpa `pegawai.hukdis_diverifikasi_*`, `riwayat_jabatan.lama_bulan`,
      `asesmen_dipakai`, `rubrik_indikator.skala_maks`, dan kolom pegawai di
      `rencana_pengembangan`. Akibatnya bukan galat saat membangun melainkan
      pengukuran atas bentuk tabel yang sudah tidak dipakai lagi.

      YANG SENGAJA TIDAK MASUK: `016`/`017` (isi `pengaturan_sistem` — nilainya
      ikut lewat salinan tabel master, dan menjalankannya di sini akan menimpa
      pengaturan yang sudah tersalin) dan `024`–`028`, yang bukan skema melainkan
      perbaikan data khusus `pupr_dev_v2` (rename BJKW, hapus 7 duplikat). Yang
      terakhir itu akan menghapus baris di DB yang isinya sama sekali berbeda.
    */
    'doc/sql/018_notifikasi_usulan_target.sql',
    'doc/sql/019_syarat_golongan_durasi.sql',
    'doc/sql/020_verifikasi_hukdis.sql',
    'doc/sql/021_lama_jabatan.sql',
    'doc/sql/022_jenjang_asesmen.sql',
    'doc/sql/023_skala_potkom.sql',
    'doc/sql/029_rencana_semua_pegawai.sql',
    'doc/sql/030_syarat_rumpun_jabatan.sql',
    'doc/sql/031_nilai_minimal_lebih_panjang.sql',
  ]

  await langkah(`pasang skema (${BERKAS_SKEMA.length} berkas)`, async () => {
    await conn.query(`USE \`${TUJUAN}\``)
    for (const berkas of BERKAS_SKEMA) {
      const isi = readFileSync(berkas, 'utf8')
      // Berkas-berkas ini juga memuat UPDATE/SELECT terhadap data yang belum ada
      // di DB kosong — aman: UPDATE tanpa baris tidak error, SELECT hanya
      // menghasilkan hasil kosong. Yang dibutuhkan di sini bagian DDL-nya.
      await conn.query(isi)
    }
  })

  await langkah('salin tabel master', async () => {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0')
    for (const t of TABEL_MASTER) {
      await conn.query(`INSERT INTO \`${TUJUAN}\`.\`${t}\` SELECT * FROM \`${SUMBER}\`.\`${t}\``)
    }
    await conn.query('SET FOREIGN_KEY_CHECKS = 1')
  })

  // Tabel angka 1..SALINAN untuk menggandakan baris pegawai. Di MySQL, klausa
  // WITH pada INSERT..SELECT harus berada SESUDAH daftar kolom, bukan di depan
  // INSERT.
  const cteAngka = `WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < ${SALINAN})`

  await langkah('gandakan pegawai', async () => {
    // NIP dijaga tetap unik & 18 digit: 15 karakter pertama diambil dari
    // pegawai sumber (tanggal lahir + TMT CPNS + digit jenis kelamin), tiga
    // digit terakhir jadi nomor salinan. Karena 40 prefiks sumber berbeda,
    // seluruh 2.000 NIP unik.
    await conn.query(`
      INSERT INTO \`${TUJUAN}\`.pegawai
        (nip, nama_lengkap, golongan, tmt_golongan, pangkat, jabatan_id, tmt_jabatan,
         sekolah_terakhir, bidang_studi_terakhir, tingkat_pendidikan, status_aktif,
         sumber_sinkron, last_synced_at, riwayat_diklat)
      ${cteAngka}
      SELECT CONCAT(SUBSTRING(p.nip, 1, 15), LPAD(n.i, 3, '0')),
             CONCAT(p.nama_lengkap, ' ', n.i),
             p.golongan, p.tmt_golongan, p.pangkat, p.jabatan_id, p.tmt_jabatan,
             p.sekolah_terakhir, p.bidang_studi_terakhir, p.tingkat_pendidikan,
             IF(n.i % 40 = 0, 'PENSIUN', 'AKTIF'),
             p.sumber_sinkron, p.last_synced_at, p.riwayat_diklat
      FROM \`${SUMBER}\`.pegawai p CROSS JOIN n
    `)
  })

  await langkah('asesmen talenta', async () => {
    // Potkom & predikat divariasikan deterministik dari id supaya sebaran
    // Kotak 9 tetap mengisi kesembilan sel pada skala besar.
    await conn.query(`
      INSERT INTO \`${TUJUAN}\`.asesmen_talenta
        (pegawai_id, tahun_asesmen, jenis_asesmen, status_asesmen, nilai_kinerja_y,
         nilai_potensial_x, potkom, nilai_integritas, nilai_talenta, kotak_9,
         tahun_kinerja, rating_kinerja, sumber_sync)
      SELECT id, tahun, 'Administrator', IF(2026 - tahun > 3, 'Expired', 'Berlaku'),
             y, x, x, 100, ROUND(0.5 * y + 0.5 * x, 2), ${SQL_KOTAK_9},
             tahun, predikat, 'recalculated'
      FROM (
        SELECT p.id,
               2022 + (p.id % 5) AS tahun,
               ELT(1 + (p.id % 5), 100, 80, 60, 40, 20) AS y,
               ELT(1 + (p.id % 5), 'Sangat Baik', 'Baik', 'Butuh Perbaikan', 'Kurang', 'Sangat Kurang') AS predikat,
               ROUND(MOD(p.id * 37, 101), 2) AS x
        FROM \`${TUJUAN}\`.pegawai p
      ) d
    `)
  })

  await langkah('kinerja per triwulan', async () => {
    await conn.query(`
      INSERT INTO \`${TUJUAN}\`.kinerja_periode
        (pegawai_id, tahun, periode_skp, nilai_kinerja, nilai_perilaku, predikat, sumber_sync, synced_at)
      SELECT a.pegawai_id, 2025, per.p,
             LEAST(100, GREATEST(0, a.nilai_kinerja_y - per.selisih)),
             LEAST(100, GREATEST(0, a.nilai_kinerja_y - per.selisih + 1)),
             a.rating_kinerja, 'eKinerja', '2026-01-15 09:00:00'
      FROM \`${TUJUAN}\`.asesmen_talenta a
      CROSS JOIN (
        SELECT 'TW1' AS p, 6 AS selisih UNION ALL SELECT 'TW2', 4
        UNION ALL SELECT 'TW3', 2 UNION ALL SELECT 'TAHUNAN', 0
      ) per
    `)
  })

  await langkah('riwayat jabatan', async () => {
    await conn.query(`
      INSERT INTO \`${TUJUAN}\`.riwayat_jabatan
        (pegawai_id, urutan, jabatan_nama_mentah, jabatan_id, tanggal_mulai, tanggal_akhir, no_sk)
      SELECT p.id, 1, COALESCE(j.nama_jabatan, 'Jabatan tidak terpetakan'), p.jabatan_id,
             p.tmt_jabatan, NULL, CONCAT('SK-', YEAR(p.tmt_jabatan), '/V/', p.id)
      FROM \`${TUJUAN}\`.pegawai p LEFT JOIN \`${TUJUAN}\`.jabatan j ON j.id = p.jabatan_id
    `)
    // Riwayat kedua: sebagian sengaja tidak terpetakan (jabatan_id NULL) supaya
    // widget Kesehatan Data punya angka "Riwayat Jabatan Terstruktur" < 100%,
    // seperti keadaan nyata.
    await conn.query(`
      INSERT INTO \`${TUJUAN}\`.riwayat_jabatan
        (pegawai_id, urutan, jabatan_nama_mentah, jabatan_id, tanggal_mulai, tanggal_akhir, no_sk)
      SELECT p.id, 2, 'Jabatan sebelumnya di luar DJBK',
             IF(p.id % 3 = 0, p.jabatan_id, NULL),
             DATE_SUB(p.tmt_jabatan, INTERVAL 4 YEAR), p.tmt_jabatan, NULL
      FROM \`${TUJUAN}\`.pegawai p
    `)
  })

  await langkah('riwayat pendidikan', async () => {
    await conn.query(`
      INSERT INTO \`${TUJUAN}\`.riwayat_pendidikan
        (pegawai_id, urutan, jenjang_pendidikan, bidang_studi, nama_sekolah, tahun_lulus, url_ijazah)
      SELECT p.id, 1, p.tingkat_pendidikan, COALESCE(p.bidang_studi_terakhir, 'Tidak diketahui'),
             p.sekolah_terakhir,
             IF(p.id % 4 = 0, NULL, 2005 + (p.id % 15)),
             IF(p.id % 3 = 0, CONCAT('/arsip/ijazah/', p.nip, '.pdf'), NULL)
      FROM \`${TUJUAN}\`.pegawai p
    `)
  })

  /**
   * Benih antrian pemetaan diklat — WAJIB di sini, bukan di berkas skemanya.
   *
   * `014_kategori_riwayat.sql` mengisi `pemetaan_diklat` dari
   * `pegawai.riwayat_diklat`, tapi di alur volume berkas skema dipasang saat
   * tabel `pegawai` masih KOSONG. Akibatnya antriannya nol baris padahal 2.000
   * pegawai punya riwayat diklat — dan pengukuran halaman antrian nanti akan
   * mengukur tabel kosong lalu melaporkannya sebagai cepat. Persis kekeliruan
   * yang sama sudah terjadi pada `gapIndikator`, jadi diulang di sini akan jadi
   * kelalaian, bukan kejutan.
   */
  await langkah('benih pemetaan diklat', async () => {
    await conn.query(`
      INSERT IGNORE INTO \`${TUJUAN}\`.pemetaan_diklat (nama_normal, nama_mentah, kategori_id, status)
      SELECT LOWER(TRIM(REGEXP_REPLACE(jt.nama, '[[:space:]]+', ' '))) AS nama_normal,
             MIN(TRIM(jt.nama)), NULL, 'USULAN'
        FROM \`${TUJUAN}\`.pegawai p,
             JSON_TABLE(p.riwayat_diklat, '$[*]' COLUMNS (nama VARCHAR(300) PATH '$')) jt
       WHERE p.riwayat_diklat IS NOT NULL AND jt.nama IS NOT NULL AND TRIM(jt.nama) <> ''
       GROUP BY nama_normal
    `)
  })

  await langkah('hukuman disiplin', async () => {
    await conn.query(`
      INSERT INTO \`${TUJUAN}\`.hukuman_disiplin
        (pegawai_id, tingkat_hukuman, tanggal_sk, no_sk, keterangan, status_aktif, input_by)
      SELECT p.id, ELT(1 + (p.id % 4), 'Ringan', 'Sedang', 'Berat', 'Sedang Menjalani'),
             '2024-06-01', CONCAT('SK-HD/V/', p.id), 'Data uji volume', p.id % 2, NULL
      FROM \`${TUJUAN}\`.pegawai p WHERE p.id % 7 = 0
    `)
  })

  await langkah('match score', async () => {
    await conn.query(`
      INSERT INTO \`${TUJUAN}\`.match_score
        (pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan,
         skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot)
      SELECT a.pegawai_id, t.id, a.potkom, kj.nilai, im.nilai,
             ROUND(0.65 * a.potkom + 0.20 * kj.nilai + 0.15 * im.nilai, 2),
             IF(a.status_asesmen = 'Berlaku', 1, 0),
             'Data uji volume', JSON_OBJECT('volume', true)
      FROM \`${TUJUAN}\`.asesmen_talenta a
      CROSS JOIN \`${TUJUAN}\`.jabatan_target t
      JOIN (SELECT 1 AS k, 92.50 AS nilai UNION ALL SELECT 2, 75.83 UNION ALL SELECT 3, 88.33) kj
        ON kj.k = 1 + (a.pegawai_id % 3)
      JOIN (SELECT 1 AS k, 100.00 AS nilai UNION ALL SELECT 2, 75.00 UNION ALL SELECT 3, 50.00) im
        ON im.k = 1 + (a.pegawai_id % 3)
    `)
  })

  await langkah('talent pool', async () => {
    // 100 kandidat teratas per jabatan target — cukup untuk menguji join
    // talent_pool -> match_score pada widget Jabatan Kosong.
    await conn.query(`
      INSERT INTO \`${TUJUAN}\`.talent_pool
        (pegawai_id, jabatan_target_id, match_score_id, ranking, status)
      SELECT pegawai_id, jabatan_target_id, id, peringkat,
             ELT(1 + (peringkat % 5), 'KANDIDAT', 'DINOMINASIKAN', 'DIVERIFIKASI', 'DITETAPKAN', 'KANDIDAT')
      FROM (
        SELECT ms.id, ms.pegawai_id, ms.jabatan_target_id,
               ROW_NUMBER() OVER (PARTITION BY ms.jabatan_target_id ORDER BY ms.skor_total DESC, ms.id) AS peringkat
        FROM \`${TUJUAN}\`.match_score ms WHERE ms.eligible = 1
      ) r WHERE r.peringkat <= 100
    `)
  })

  await langkah('nominasi & approval', async () => {
    await conn.query(`
      INSERT INTO \`${TUJUAN}\`.nominasi
        (talent_pool_id, diajukan_oleh_unit_id, diajukan_oleh_user_id, tanggal_diajukan, status, catatan)
      SELECT tp.id, 1, NULL, DATE_SUB(CURDATE(), INTERVAL (tp.id % 90) DAY),
             ELT(1 + (tp.id % 4), 'DIAJUKAN', 'MENUNGGU_VERIFIKASI', 'DISETUJUI', 'DITOLAK'),
             'Data uji volume'
      FROM \`${TUJUAN}\`.talent_pool tp WHERE tp.id % 3 = 0
    `)
    await conn.query(`
      INSERT INTO \`${TUJUAN}\`.approval_log
        (nominasi_id, tahap, status, approver_user_id, catatan, tanggal_aksi)
      SELECT n.id, 'Verifikasi Kepegawaian',
             ELT(1 + (n.id % 4), 'MENUNGGU', 'DISETUJUI', 'DITOLAK', 'REVISI'),
             NULL, 'Data uji volume', NOW()
      FROM \`${TUJUAN}\`.nominasi n
    `)
  })

  await langkah('audit & sync log', async () => {
    await conn.query(`
      INSERT INTO \`${TUJUAN}\`.audit_log (user_id, aksi, entitas, entitas_id, ip_address, created_at)
      SELECT NULL, 'UPDATE', 'pegawai', p.id, '10.0.0.1', NOW()
      FROM \`${TUJUAN}\`.pegawai p WHERE p.id % 40 = 0
    `)
    await conn.query(
      `INSERT INTO \`${TUJUAN}\`.sync_log SELECT * FROM \`${SUMBER}\`.sync_log`,
    )
  })

  const [ringkas] = await conn.query<mysql.RowDataPacket[]>(`
    SELECT
      (SELECT COUNT(*) FROM \`${TUJUAN}\`.pegawai) AS pegawai,
      (SELECT COUNT(*) FROM \`${TUJUAN}\`.asesmen_talenta) AS asesmen,
      (SELECT COUNT(*) FROM \`${TUJUAN}\`.kinerja_periode) AS kinerja,
      (SELECT COUNT(*) FROM \`${TUJUAN}\`.riwayat_jabatan) AS riwayat,
      (SELECT COUNT(*) FROM \`${TUJUAN}\`.match_score) AS skor,
      (SELECT COUNT(*) FROM \`${TUJUAN}\`.talent_pool) AS pool,
      (SELECT COUNT(*) FROM \`${TUJUAN}\`.nominasi) AS nominasi,
      (SELECT COUNT(DISTINCT kotak_9) FROM \`${TUJUAN}\`.asesmen_talenta) AS sel_terisi
  `)
  const r = ringkas[0]!

  console.log(`\nSelesai dalam ${Date.now() - mulai} ms`)
  console.log(
    `  pegawai ${r.pegawai} · asesmen ${r.asesmen} · kinerja ${r.kinerja} · riwayat jabatan ${r.riwayat}`,
  )
  console.log(
    `  match_score ${r.skor} · talent_pool ${r.pool} · nominasi ${r.nominasi} · sel Kotak 9 terisi ${r.sel_terisi}/9`,
  )
  console.log(`\nUkur performa: npm run ukur:kueri:volume`)

  await conn.end()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
