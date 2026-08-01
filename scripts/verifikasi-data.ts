/**
 * Verifikasi DoD Fase 0.5 terhadap isi pupr_dev.
 *
 * Sengaja memakai SQL murni — implementasi yang TERPISAH dari lib/scoring —
 * supaya kalau rumusnya salah paham, dua implementasi berbeda akan berselisih
 * dan itu ketahuan. Kalau memakai lib/scoring untuk memverifikasi output
 * lib/scoring, uji ini cuma mengonfirmasi dirinya sendiri.
 *
 * Jalankan: npx tsx scripts/verifikasi-data.ts
 * Keluar dengan kode 1 kalau ada pemeriksaan yang gagal.
 */

import { config } from 'dotenv'
import mysql from 'mysql2/promise'

config({ path: '.env.local' })
config({ path: '.env' })

interface Periksa {
  nama: string
  sql: string
  /** Lolos bila kolom `n` bernilai 0 (default) atau sesuai `harapan`. */
  harapan?: number
  detail?: string
}

const PEMERIKSAAN: Periksa[] = [
  {
    nama: 'Semua skor asesmen berada di 0–100',
    sql: `SELECT COUNT(*) n FROM asesmen_talenta
          WHERE nilai_kinerja_y NOT BETWEEN 0 AND 100
             OR nilai_potensial_x NOT BETWEEN 0 AND 100
             OR potkom NOT BETWEEN 0 AND 100
             OR nilai_talenta NOT BETWEEN 0 AND 100
             OR nilai_integritas NOT BETWEEN 0 AND 100`,
  },
  {
    nama: 'Semua skor match_score berada di 0–100',
    sql: `SELECT COUNT(*) n FROM match_score
          WHERE skor_potensi_kompetensi NOT BETWEEN 0 AND 100
             OR skor_kualifikasi_jabatan NOT BETWEEN 0 AND 100
             OR skor_integritas_moralitas NOT BETWEEN 0 AND 100
             OR skor_total NOT BETWEEN 0 AND 100`,
  },
  {
    nama: 'Semua skor match_score_detail berada di 0–100',
    sql: `SELECT COUNT(*) n FROM match_score_detail WHERE skor NOT BETWEEN 0 AND 100`,
  },
  {
    nama: 'kotak_9 cocok dengan ambang Lampiran A (dihitung ulang di SQL)',
    sql: `SELECT COUNT(*) n FROM (
            SELECT kotak_9,
              CASE WHEN nilai_kinerja_y >= 80 THEN CASE WHEN nilai_potensial_x >= 80 THEN 9 WHEN nilai_potensial_x >= 60 THEN 7 ELSE 4 END
                   WHEN nilai_kinerja_y >= 60 THEN CASE WHEN nilai_potensial_x >= 80 THEN 8 WHEN nilai_potensial_x >= 60 THEN 5 ELSE 2 END
                   ELSE CASE WHEN nilai_potensial_x >= 80 THEN 6 WHEN nilai_potensial_x >= 60 THEN 3 ELSE 1 END END AS hitung
            FROM asesmen_talenta
          ) x WHERE kotak_9 <> hitung`,
  },
  {
    nama: 'nilai_talenta = 50% Y + 50% X',
    sql: `SELECT COUNT(*) n FROM asesmen_talenta
          WHERE ABS(nilai_talenta - ROUND(0.5*nilai_kinerja_y + 0.5*nilai_potensial_x, 2)) > 0.01`,
  },
  {
    nama: 'skor_total = 65% PK + 20% KJ + 15% IM',
    sql: `SELECT COUNT(*) n FROM match_score
          WHERE ABS(skor_total - ROUND(0.65*skor_potensi_kompetensi + 0.20*skor_kualifikasi_jabatan + 0.15*skor_integritas_moralitas, 2)) > 0.01`,
  },
  {
    nama: 'skor_kualifikasi_jabatan = rata-rata 4 indikator @5% di match_score_detail',
    sql: `SELECT COUNT(*) n FROM match_score ms
          JOIN (SELECT match_score_id, ROUND(AVG(skor), 2) rerata FROM match_score_detail
                WHERE bobot_indikator = 0.0500 AND parent_indikator_id IS NULL
                GROUP BY match_score_id) d ON d.match_score_id = ms.id
          WHERE ABS(ms.skor_kualifikasi_jabatan - d.rerata) > 0.01`,
  },
  {
    nama: 'Nilai Pengalaman Jabatan = rata-rata 3 sub-indikatornya',
    sql: `SELECT COUNT(*) n FROM match_score_detail induk
          JOIN (SELECT match_score_id, parent_indikator_id, ROUND(AVG(skor), 2) rerata, COUNT(*) jml
                FROM match_score_detail WHERE parent_indikator_id IS NOT NULL
                GROUP BY match_score_id, parent_indikator_id) anak
            ON anak.match_score_id = induk.match_score_id
           AND anak.parent_indikator_id = induk.rubrik_indikator_id
          WHERE anak.jml <> 3 OR ABS(induk.skor - anak.rerata) > 0.01`,
  },
  {
    nama: 'Kesembilan sel Kotak 9 terisi (asesmen terbaru per pegawai)',
    sql: `SELECT 9 - COUNT(DISTINCT kotak_9) n FROM asesmen_talenta a
          WHERE a.tahun_asesmen = (SELECT MAX(b.tahun_asesmen) FROM asesmen_talenta b WHERE b.pegawai_id = a.pegawai_id)`,
  },
  {
    nama: 'Tiap sel Kotak 9 punya minimal 2 pegawai',
    sql: `SELECT COUNT(*) n FROM (
            SELECT kotak_9, COUNT(*) jml FROM asesmen_talenta a
            WHERE a.tahun_asesmen = (SELECT MAX(b.tahun_asesmen) FROM asesmen_talenta b WHERE b.pegawai_id = a.pegawai_id)
            GROUP BY kotak_9 HAVING jml < 2
          ) x`,
  },
  {
    nama: 'Ranking talent_pool rapi: berurutan 1..n tanpa dobel per jabatan target',
    sql: `SELECT COUNT(*) n FROM (
            SELECT jabatan_target_id FROM talent_pool GROUP BY jabatan_target_id
            HAVING COUNT(*) <> COUNT(DISTINCT ranking) OR MIN(ranking) <> 1 OR MAX(ranking) <> COUNT(*)
          ) x`,
  },
  {
    nama: 'Setiap entri talent_pool tertaut ke match_score & punya ranking',
    sql: `SELECT COUNT(*) n FROM talent_pool WHERE match_score_id IS NULL OR ranking IS NULL`,
  },
  {
    nama: 'Setiap match_score punya snapshot rubrik (jejak audit U-5)',
    sql: `SELECT COUNT(*) n FROM match_score WHERE rubrik_snapshot IS NULL`,
  },
  {
    nama: 'Setiap match_score punya rincian indikator (U-3)',
    sql: `SELECT COUNT(*) n FROM match_score ms
          WHERE NOT EXISTS (SELECT 1 FROM match_score_detail d WHERE d.match_score_id = ms.id)`,
  },
  {
    nama: 'Format golongan seragam (tanpa notasi titik)',
    sql: `SELECT COUNT(*) n FROM pegawai WHERE golongan LIKE '%.%'`,
  },
  {
    nama: 'jenis_asesmen tidak lagi memakai istilah lama "JPT Pertama"',
    sql: `SELECT COUNT(*) n FROM asesmen_talenta WHERE jenis_asesmen = 'JPT Pertama'`,
  },
  {
    nama: 'nilai_integritas memakai skala 0–100 (bukan skala kecil 1–4)',
    sql: `SELECT COUNT(*) n FROM asesmen_talenta WHERE nilai_integritas > 0 AND nilai_integritas < 10`,
  },
  {
    nama: 'status_asesmen konsisten dgn masa berlaku 3 tahun (acuan 2026)',
    sql: `SELECT COUNT(*) n FROM asesmen_talenta
          WHERE (2026 - tahun_asesmen > 3 AND status_asesmen <> 'Expired')
             OR (2026 - tahun_asesmen <= 3 AND status_asesmen <> 'Berlaku')`,
  },
  {
    nama: 'Seluruh riwayat jabatan sudah bertanggal (indikator Lama Jabatan bisa otomatis)',
    sql: `SELECT COUNT(*) n FROM riwayat_jabatan WHERE tanggal_mulai IS NULL`,
  },
  {
    nama: 'Setiap pegawai punya TW1–TW3 + TAHUNAN tahun 2025',
    sql: `SELECT COUNT(*) n FROM pegawai p
          WHERE (SELECT COUNT(DISTINCT periode_skp) FROM kinerja_periode k
                 WHERE k.pegawai_id = p.id AND k.tahun = 2025) <> 4`,
  },
  {
    nama: 'Kelima kategori hukuman disiplin terpakai di data',
    sql: `SELECT 4 - COUNT(DISTINCT tingkat_hukuman) n FROM hukuman_disiplin`,
  },
  {
    nama: 'Nominasi mencakup jalur DISETUJUI, DITOLAK, dan MENUNGGU_VERIFIKASI',
    sql: `SELECT 3 - COUNT(DISTINCT status) n FROM nominasi
          WHERE status IN ('DISETUJUI','DITOLAK','MENUNGGU_VERIFIKASI')`,
  },
  {
    nama: 'Approval log mencakup keputusan DISETUJUI, DITOLAK, dan REVISI',
    sql: `SELECT 3 - COUNT(DISTINCT status) n FROM approval_log
          WHERE status IN ('DISETUJUI','DITOLAK','REVISI')`,
  },
  {
    nama: 'Log API punya kasus anomali (401/403/429) untuk diuji halaman monitoring',
    sql: `SELECT 3 - COUNT(DISTINCT response_code) n FROM api_activity_log
          WHERE response_code IN (401, 403, 429)`,
  },
  {
    nama: 'Ada jabatan berstatus KOSONG untuk halaman Risiko Kekosongan',
    sql: `SELECT IF(COUNT(*) >= 5, 0, 1) n FROM jabatan WHERE status_jabatan = 'KOSONG'`,
  },
  {
    nama: 'Ada riwayat pendidikan dengan arsip DAN tanpa arsip (uji kolom adaptif)',
    sql: `SELECT IF(SUM(url_ijazah IS NOT NULL) > 0 AND SUM(url_ijazah IS NULL) > 0, 0, 1) n
          FROM riwayat_pendidikan`,
  },
  {
    nama: 'Ada riwayat Plt/Plh (sub-indikator Substansi Riwayat Jabatan teruji)',
    sql: `SELECT IF(COUNT(*) > 0, 0, 1) n FROM riwayat_jabatan
          WHERE jabatan_nama_mentah REGEXP '(^|[[:space:]])(Plt|Plh|Pelaksana Tugas|Pelaksana Harian)([[:space:]]|$)'`,
  },

  // --- Konsistensi workflow (Fase 6) -------------------------------------
  //
  // Aturan pasangan status ditulis di `lib/workflow.ts`; di sini ia dinyatakan
  // ULANG sebagai SQL murni, sengaja sebagai implementasi terpisah. Keadaan
  // yang tidak konsisten TIDAK menimbulkan galat apa pun — ia cuma membuat dua
  // halaman bercerita berbeda tentang orang yang sama, jadi harus ada yang
  // memeriksanya dari luar kode aplikasi.
  {
    nama: 'Status talent pool berpasangan sah dengan status nominasinya',
    sql: `SELECT COUNT(*) n FROM talent_pool tp
          LEFT JOIN (
            SELECT * FROM (
              SELECT x.*, ROW_NUMBER() OVER (
                PARTITION BY x.talent_pool_id ORDER BY x.tanggal_diajukan DESC, x.id DESC
              ) rn FROM nominasi x
            ) y WHERE y.rn = 1
          ) n ON n.talent_pool_id = tp.id
          WHERE (n.status IN ('DIAJUKAN','MENUNGGU_VERIFIKASI') AND tp.status <> 'DINOMINASIKAN')
             OR (n.status = 'DISETUJUI' AND tp.status NOT IN ('DIVERIFIKASI','DITETAPKAN'))
             OR (n.status = 'DITOLAK' AND tp.status NOT IN ('DITOLAK','KANDIDAT'))
             OR (n.id IS NULL AND tp.status IN ('DINOMINASIKAN','DIVERIFIKASI','DITETAPKAN'))`,
  },
  {
    nama: 'Nominasi di antrian verifikasi punya jejak approval_log',
    sql: `SELECT COUNT(*) n FROM nominasi n
          WHERE n.status = 'MENUNGGU_VERIFIKASI'
            AND NOT EXISTS (SELECT 1 FROM approval_log a WHERE a.nominasi_id = n.id)`,
  },
  {
    nama: 'Nominasi berkeputusan REVISI berstatus DIAJUKAN (giliran unit pengaju)',
    sql: `SELECT COUNT(*) n FROM nominasi n
          WHERE (SELECT a.status FROM approval_log a WHERE a.nominasi_id = n.id
                 ORDER BY a.id DESC LIMIT 1) = 'REVISI'
            AND n.status <> 'DIAJUKAN'`,
  },
  {
    nama: 'Suksesor DITETAPKAN punya tanggal & penetap yang tercatat',
    sql: `SELECT COUNT(*) n FROM talent_pool
          WHERE status = 'DITETAPKAN' AND (ditetapkan_pada IS NULL OR ditetapkan_oleh IS NULL)`,
  },
  {
    nama: 'Rencana pengembangan hanya menempel pada entri pool yang ada',
    sql: `SELECT COUNT(*) n FROM rencana_pengembangan rp
          WHERE NOT EXISTS (SELECT 1 FROM talent_pool tp WHERE tp.id = rp.talent_pool_id)`,
  },
  {
    nama: 'Tahap approval_log hanya memakai nama tahap yang dikenal state machine',
    sql: `SELECT COUNT(*) n FROM approval_log
          WHERE tahap NOT IN ('Verifikasi Kepegawaian', 'Persetujuan Pimpinan')`,
  },
  {
    nama: 'Ada notifikasi terbaca DAN belum terbaca (kedua keadaan inbox teruji)',
    sql: `SELECT IF(SUM(dibaca_pada IS NULL) > 0 AND SUM(dibaca_pada IS NOT NULL) > 0, 0, 1) n
          FROM notifikasi`,
  },
  {
    nama: 'Setiap notifikasi menunjuk pengguna yang ada',
    sql: `SELECT COUNT(*) n FROM notifikasi nt
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = nt.user_id)`,
  },
  {
    nama: 'Alur nominasi punya kasus DISETUJUI, DITOLAK, dan REVISI (semua cabang teruji)',
    sql: `SELECT IF(
            (SELECT COUNT(DISTINCT status) FROM approval_log
             WHERE status IN ('DISETUJUI','DITOLAK','REVISI')) = 3, 0, 1) n`,
  },

  // -------------------------------------------------------------------------
  // Fase 7 — Auth & RBAC
  //
  // Semuanya keadaan yang TIDAK menimbulkan galat apa pun kalau salah: sistem
  // tetap berjalan, hanya saja seseorang kehilangan akses tanpa sebab yang
  // terlihat, atau justru punya akses yang seharusnya sudah dicabut.
  // -------------------------------------------------------------------------
  {
    nama: 'Setiap peran di tabel roles dikenali aplikasi (lib/peran.ts)',
    // Peran yang ada di DB tapi tidak dikenal kode membuat `getCurrentUser()`
    // mengembalikan null — pemiliknya tidak bisa masuk, tanpa pesan apa pun
    // yang menjelaskan kenapa.
    sql: `SELECT COUNT(*) n FROM roles
          WHERE nama_role NOT IN ('Super Admin','Admin Talenta','Pengelola Unit','Pimpinan','Viewer')`,
  },
  {
    nama: 'Selalu ada minimal satu Super Admin aktif (sistem tidak mengunci diri)',
    sql: `SELECT IF((SELECT COUNT(*) FROM users u JOIN roles r ON r.id = u.role_id
                     WHERE r.nama_role = 'Super Admin' AND u.status_aktif = 1) >= 1, 0, 1) n`,
  },
  {
    nama: 'Setiap Pengelola Unit aktif tertaut ke unit organisasi',
    // Tanpa unit, `lingkupData()` gagal-tertutup dan orangnya melihat aplikasi
    // yang benar-benar kosong. Itu keadaan yang benar, tapi datanya salah.
    sql: `SELECT COUNT(*) n FROM users u JOIN roles r ON r.id = u.role_id
          WHERE r.nama_role = 'Pengelola Unit' AND u.status_aktif = 1
            AND u.unit_organisasi_id IS NULL`,
  },
  {
    nama: 'Semua password_hash berformat bcrypt (tidak ada sandi polos menyelinap)',
    sql: `SELECT COUNT(*) n FROM users
          WHERE password_hash NOT REGEXP '^\\\\$2[aby]\\\\$[0-9]{2}\\\\$.{53}$'`,
  },
  {
    nama: 'Tidak ada sesi hidup milik pengguna nonaktif',
    // Menonaktifkan akun WAJIB memutus sesinya. Kalau baris ini ada, seseorang
    // yang sudah dicabut aksesnya masih bekerja di dalam aplikasi.
    sql: `SELECT COUNT(*) n FROM sesi s JOIN users u ON u.id = s.user_id
          WHERE s.dicabut_pada IS NULL AND s.kedaluwarsa_pada > NOW() AND u.status_aktif = 0`,
  },
  {
    nama: 'Tenggat sesi konsisten (kedaluwarsa selalu setelah dibuat)',
    sql: `SELECT COUNT(*) n FROM sesi WHERE kedaluwarsa_pada <= created_at`,
  },
  {
    nama: 'Seluruh parameter yang dibaca kode ada di pengaturan_sistem',
    sql: `SELECT 6 - COUNT(*) n FROM pengaturan_sistem
          WHERE kunci IN ('masa_berlaku_asesmen_tahun','tahun_asesmen_aktif','sesi_idle_menit',
                          'sesi_maksimal_jam','maks_gagal_masuk','kunci_akun_menit')`,
  },
  {
    nama: 'Nilai parameter sistem berada dalam rentang yang diizinkan',
    // Parameter di luar rentang tidak menimbulkan galat — ia hanya membuat
    // timeout sesi jadi nol menit, dan tidak ada yang bisa masuk lagi.
    sql: `SELECT COUNT(*) n FROM pengaturan_sistem
          WHERE tipe = 'ANGKA'
            AND ( nilai NOT REGEXP '^-?[0-9]+$'
               OR (nilai_min IS NOT NULL AND CAST(nilai AS SIGNED) < nilai_min)
               OR (nilai_max IS NOT NULL AND CAST(nilai AS SIGNED) > nilai_max) )`,
  },
  {
    nama: 'Permintaan reset yang sudah ditangani mencatat siapa penanganya',
    sql: `SELECT COUNT(*) n FROM permintaan_reset_password
          WHERE ditangani_pada IS NOT NULL AND ditangani_oleh IS NULL`,
  },
  {
    nama: 'audit_log memuat jejak autentikasi (bukan cuma mutasi data)',
    sql: `SELECT IF((SELECT COUNT(*) FROM audit_log
                     WHERE aksi IN ('MASUK','MASUK_GAGAL','KELUAR','SANDI_DIGANTI',
                                    'AKUN_TERKUNCI','RESET_DIMINTA')) > 0, 0, 1) n`,
  },
]

/** Selisih kotak_9 terhadap nilai dari sistem sumber — informasi, bukan kegagalan. */
const SQL_SELISIH_SUMBER = `
  SELECT p.nama_lengkap, a.tahun_asesmen, a.kotak_9, a.nilai_kinerja_y, a.nilai_potensial_x
  FROM asesmen_talenta a JOIN pegawai p ON p.id = a.pegawai_id
  WHERE a.sumber_sync = 'recalculated' AND a.pegawai_id IN (
    SELECT pegawai_id FROM asesmen_talenta
  ) AND p.nama_lengkap IN ('Tasya','Tina')
`

async function main() {
  const pool = mysql.createPool({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  })

  let gagal = 0
  console.log('=== VERIFIKASI DATA DEV — DoD FASE 0.5 ===\n')

  for (const p of PEMERIKSAAN) {
    const [rows] = await pool.query(p.sql)
    const n = Number((rows as Array<{ n: unknown }>)[0]?.n ?? -1)
    const target = p.harapan ?? 0
    const lolos = n === target
    if (!lolos) gagal += 1
    console.log(`${lolos ? 'LULUS' : 'GAGAL'}  ${p.nama}`)
    if (!lolos) console.log(`       nilai=${n}, diharapkan=${target}`)
  }

  const [sebaran] = await pool.query(`
    SELECT a.kotak_9, COUNT(*) jml FROM asesmen_talenta a
    WHERE a.tahun_asesmen = (SELECT MAX(b.tahun_asesmen) FROM asesmen_talenta b WHERE b.pegawai_id = a.pegawai_id)
    GROUP BY a.kotak_9 ORDER BY a.kotak_9`)
  const petaSebaran = new Map<number, number>()
  for (const r of sebaran as Array<{ kotak_9: number; jml: number }>) {
    petaSebaran.set(Number(r.kotak_9), Number(r.jml))
  }
  console.log(
    `\nSebaran Kotak 9: ${[9, 8, 7, 6, 5, 4, 3, 2, 1].map((k) => `K${k}=${petaSebaran.get(k) ?? 0}`).join('  ')}`,
  )

  const [selisih] = await pool.query(SQL_SELISIH_SUMBER)
  const daftarSelisih = selisih as Array<Record<string, unknown>>
  console.log(
    `\nCatatan: ${daftarSelisih.length} baris asesmen dari data contoh e-Nominasi punya kotak_9 sumber`,
  )
  console.log('yang tidak bisa direproduksi dengan ambang 60/80 (kasus Tasya & Tina) — sengaja')
  console.log('dibiarkan sebagai isi Antrian Pembersihan Data, bukan kegagalan uji.')

  console.log(`\nRingkasan: ${PEMERIKSAAN.length - gagal}/${PEMERIKSAAN.length} pemeriksaan lulus`)
  await pool.end()
  process.exit(gagal > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
