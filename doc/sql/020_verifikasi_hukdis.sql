-- 020 — Jejak VERIFIKASI rekam jejak disiplin.
--
-- Permintaan pemilik proses 25 Agu 2026: *"di profil Integritas & rekam jejak disiplin
-- defaultnya tanpa catatan aja dulu tapi ada ceklis buat verifikasi"*.
--
-- ## Masalah yang diselesaikan, dan kenapa ia bukan soal tampilan
--
-- `hukuman_disiplin` KOSONG untuk seluruh 79 pegawai, dan mesin skor
-- memperlakukan ketiadaan catatan sebagai "tidak pernah dijatuhi hukuman disiplin"
-- → skor Integritas **100 untuk semua orang**. Semantiknya benar, tapi ia
-- **asumsi**, bukan fakta yang sudah diperiksa siapa pun — dan 15% match score
-- bergantung padanya.
--
-- Sampai sekarang perbedaan itu hanya bisa disampaikan lewat kotak peringatan di
-- profil: setiap pegawai tanpa catatan tampil seolah datanya bermasalah, padahal
-- bagi mayoritas yang memang tidak pernah dihukum itu keadaan yang benar. Yang
-- kurang bukan peringatannya, melainkan **tempat menyimpan hasil pemeriksaan**:
-- "sudah diperiksa, hasilnya bersih" tidak bisa dibedakan dari "belum diperiksa".
--
-- ## Kenapa kolom di `pegawai`, bukan tabel baru
--
-- Yang dicatat satu pernyataan per pegawai ("pada tanggal ini, orang ini memeriksa
-- dan tidak menemukan catatan"), bukan daftar peristiwa — jadi kardinalitasnya 1:1.
-- Polanya sama persis dengan `riwayat_divalidasi_oleh/_pada/_catatan` di `doc/sql/014`,
-- dan memakai bentuk yang sudah ada berarti halaman kualitas data, ekspor, dan
-- jejak audit tidak perlu belajar bentuk kedua.
--
-- Riwayat SIAPA yang pernah memverifikasi tetap ada — `jalankanMutasi()` mencatat
-- setiap perubahan kolom ini ke `audit_log` beserta nilai sebelumnya. Jadi tabel
-- terpisah tidak menambah kemampuan apa pun, hanya menambah tempat yang bisa
-- berselisih.
--
-- ## Yang TIDAK berubah
--
-- Skor Integritas **tidak bergeser sedikit pun** karena berkas ini. Ketiadaan
-- catatan sudah dinilai 100 sejak awal; yang ditambahkan hanya jejak bahwa hal itu
-- benar sudah diperiksa manusia. Kalau suatu hari diputuskan bahwa yang BELUM
-- diverifikasi harus ditandai `perlu_review`, kolom inilah yang menjawabnya — dan
-- itu keputusan pemilik proses, bukan efek samping migrasi.
--
-- Idempoten: tiap kolom dijaga pemeriksaan `information_schema`.

SET @sql := IF(
    (SELECT COUNT(*) FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'pegawai'
        AND COLUMN_NAME = 'hukdis_diverifikasi_oleh') = 0,
    'ALTER TABLE pegawai
       ADD COLUMN hukdis_diverifikasi_oleh BIGINT UNSIGNED NULL
         COMMENT ''Pengguna yang menyatakan rekam jejak disiplin sudah diperiksa''
         AFTER riwayat_catatan_validasi,
       ADD COLUMN hukdis_diverifikasi_pada DATETIME NULL
         COMMENT ''Kapan pemeriksaan itu dinyatakan. NULL = belum pernah diperiksa''
         AFTER hukdis_diverifikasi_oleh,
       ADD COLUMN hukdis_catatan_verifikasi VARCHAR(500) NULL
         COMMENT ''Catatan pemeriksa (mis. nomor surat keterangan, sumber yang dicek)''
         AFTER hukdis_diverifikasi_pada,
       ADD CONSTRAINT fk_pegawai_hukdis_verif FOREIGN KEY (hukdis_diverifikasi_oleh)
         REFERENCES users (id) ON DELETE SET NULL',
    'SELECT ''kolom verifikasi hukdis sudah ada'''
);
PREPARE j FROM @sql;
EXECUTE j;
DEALLOCATE PREPARE j;
