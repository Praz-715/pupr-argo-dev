-- 011_notifikasi.sql — dijalankan setelah 010
--
-- KENAPA BERKAS INI ADA
--
-- 1. Tabel `notifikasi` (phase.md §8 usulan U-7)
--
--    PRD memakai notifikasi sebagai widget dashboard, tapi tidak ada entitas
--    yang menyimpannya. Tanpa itu, alur approval menggantung: unit mengajukan
--    nominasi lalu tidak tahu apa-apa sampai seseorang kebetulan membuka
--    halaman, dan Admin Talenta tidak punya daftar "apa yang menunggu saya".
--    Workflow tanpa inbox adalah workflow yang berjalan lewat percakapan lisan.
--
--    KEPUTUSAN: notifikasi disebar per PENGGUNA saat dibuat (fan-out), bukan
--    disimpan sebagai satu baris bertujuan peran. Alasannya `dibaca_pada`:
--    kalau satu baris ditujukan ke peran yang dipegang tiga orang, satu orang
--    menandainya terbaca akan menyembunyikannya dari dua orang lain — padahal
--    mereka belum melihatnya. Kolom `peran_tujuan` tetap disimpan sebagai
--    keterangan "Anda menerima ini sebagai Admin Talenta", bukan sebagai alamat.
--
-- 2. Membetulkan keadaan workflow di data dev
--
--    `007_recompute.sql` menyisipkan nominasi & approval_log untuk menguji
--    cabang DITOLAK dan REVISI, tapi tidak memperbarui `talent_pool.status`
--    yang berpasangan dengannya. Akibatnya ada dua keadaan yang tidak mungkin
--    terjadi lewat UI mana pun:
--
--      a. Nominasi Agus Purnomo berstatus MENUNGGU_VERIFIKASI padahal
--         keputusan terakhirnya REVISI — artinya bola ada di tangan unit, bukan
--         di antrian verifikator. Menurut state machine (`lib/workflow.ts`),
--         nominasi yang diminta revisi berstatus DIAJUKAN. Status pool-nya juga
--         masih KANDIDAT padahal ia punya nominasi aktif.
--      b. Nominasi Iwan berstatus MENUNGGU_VERIFIKASI tanpa satu pun baris
--         `approval_log` — sehingga antrian verifikasi tidak bisa menampilkan
--         sudah berapa lama ia menunggu.
--
--    Keadaan seperti ini tidak menimbulkan galat apa pun; ia hanya membuat dua
--    halaman bercerita berbeda tentang orang yang sama. Karena itu setelah
--    dibetulkan, pemeriksaannya ditambahkan ke `scripts/verifikasi-data.ts` —
--    supaya tidak bisa menyelip lagi tanpa ketahuan.
--
--    Ahmad Fauzi SENGAJA dibiarkan berstatus KANDIDAT walau nominasinya
--    DITOLAK: itu keadaan yang sah (kandidat dipulihkan setelah penolakan, dan
--    riwayat nominasinya tetap tersimpan sebagai jejak), sekaligus menguji
--    tampilan kandidat yang punya riwayat penolakan.

CREATE TABLE notifikasi (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL COMMENT 'Penerima. Notifikasi bertujuan peran disebar per pengguna saat dibuat, supaya dibaca_pada tidak saling menutupi.',
    peran_tujuan VARCHAR(40) NULL COMMENT 'Keterangan: pengguna menerima ini karena memegang peran tsb. Bukan alamat pengiriman.',
    jenis ENUM(
        'NOMINASI_MASUK',
        'NOMINASI_REVISI',
        'NOMINASI_DISETUJUI',
        'NOMINASI_DITOLAK',
        'MENUNGGU_PENETAPAN',
        'SUKSESOR_DITETAPKAN',
        'PENETAPAN_DIBATALKAN'
    ) NOT NULL,
    judul VARCHAR(200) NOT NULL,
    pesan TEXT NOT NULL,
    tautan VARCHAR(300) NULL COMMENT 'Path internal ke halaman yang menindaklanjuti, mis. /nominasi/12',
    entitas VARCHAR(50) NULL COMMENT 'Nama tabel seperti di ERD',
    entitas_id BIGINT UNSIGNED NULL,
    dibaca_pada DATETIME NULL,
    dibuat_oleh BIGINT UNSIGNED NULL COMMENT 'Pengguna yang tindakannya memicu notifikasi ini',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_notifikasi_user (user_id, dibaca_pada, id),
    KEY idx_notifikasi_entitas (entitas, entitas_id),
    CONSTRAINT fk_notifikasi_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_notifikasi_pembuat FOREIGN KEY (dibuat_oleh) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- ---------------------------------------------------------------------
-- Betulkan keadaan workflow (lihat alasan di atas)
-- ---------------------------------------------------------------------

-- (a) Nominasi yang keputusan terakhirnya REVISI: giliran ada di unit pengaju.
UPDATE nominasi n
SET n.status = 'DIAJUKAN'
WHERE n.status = 'MENUNGGU_VERIFIKASI'
  AND (
    SELECT a.status FROM approval_log a
    WHERE a.nominasi_id = n.id ORDER BY a.id DESC LIMIT 1
  ) = 'REVISI';

-- Kandidat yang punya nominasi aktif tidak mungkin berstatus KANDIDAT.
UPDATE talent_pool tp
JOIN nominasi n ON n.talent_pool_id = tp.id
SET tp.status = 'DINOMINASIKAN'
WHERE tp.status = 'KANDIDAT'
  AND n.status IN ('DIAJUKAN', 'MENUNGGU_VERIFIKASI');

-- (b) Nominasi di antrian verifikasi wajib punya baris approval_log MENUNGGU,
--     kalau tidak, "sudah berapa lama menunggu" tidak bisa dihitung.
INSERT INTO approval_log (nominasi_id, tahap, status, approver_user_id, catatan, tanggal_aksi)
SELECT n.id, 'Verifikasi Kepegawaian', 'MENUNGGU', NULL,
       'Masuk antrian verifikasi.', CONCAT(n.tanggal_diajukan, ' 09:00:00')
FROM nominasi n
WHERE n.status = 'MENUNGGU_VERIFIKASI'
  AND NOT EXISTS (SELECT 1 FROM approval_log a WHERE a.nominasi_id = n.id);

-- ---------------------------------------------------------------------
-- Backfill notifikasi dari keadaan workflow yang sudah ada
-- ---------------------------------------------------------------------
--
-- Diturunkan dari keadaan nyata, bukan ditulis sebagai contoh: inbox yang
-- isinya karangan akan menyesatkan saat dibandingkan dengan antrian nominasi.

-- Nominasi yang menunggu verifikasi → seluruh pemegang peran Admin Talenta.
INSERT INTO notifikasi (user_id, peran_tujuan, jenis, judul, pesan, tautan, entitas, entitas_id, created_at)
SELECT u.id, 'Admin Talenta', 'NOMINASI_MASUK',
       CONCAT('Nominasi menunggu verifikasi: ', p.nama_lengkap),
       CONCAT('Unit ', uo.nama_unit, ' mengajukan ', p.nama_lengkap,
              ' untuk jabatan target ', jt.nama_target, '.'),
       CONCAT('/nominasi/', n.id), 'nominasi', n.id,
       CONCAT(n.tanggal_diajukan, ' 09:05:00')
FROM nominasi n
JOIN talent_pool tp ON tp.id = n.talent_pool_id
JOIN pegawai p ON p.id = tp.pegawai_id
JOIN jabatan_target jt ON jt.id = tp.jabatan_target_id
JOIN unit_organisasi uo ON uo.id = n.diajukan_oleh_unit_id
JOIN users u ON u.role_id = (SELECT id FROM roles WHERE nama_role = 'Admin Talenta')
WHERE n.status = 'MENUNGGU_VERIFIKASI';

-- Nominasi yang diminta revisi → pengaju aslinya (giliran unit).
INSERT INTO notifikasi (user_id, peran_tujuan, jenis, judul, pesan, tautan, entitas, entitas_id, dibuat_oleh, created_at)
SELECT n.diajukan_oleh_user_id, 'Pengelola Unit', 'NOMINASI_REVISI',
       CONCAT('Nominasi perlu direvisi: ', p.nama_lengkap),
       COALESCE(a.catatan, 'Verifikator meminta revisi.'),
       CONCAT('/nominasi/', n.id), 'nominasi', n.id, a.approver_user_id, a.tanggal_aksi
FROM nominasi n
JOIN talent_pool tp ON tp.id = n.talent_pool_id
JOIN pegawai p ON p.id = tp.pegawai_id
JOIN approval_log a ON a.nominasi_id = n.id AND a.status = 'REVISI'
WHERE n.status = 'DIAJUKAN' AND n.diajukan_oleh_user_id IS NOT NULL;

-- Kandidat yang lolos verifikasi & menunggu penetapan → seluruh Pimpinan.
INSERT INTO notifikasi (user_id, peran_tujuan, jenis, judul, pesan, tautan, entitas, entitas_id, created_at)
SELECT u.id, 'Pimpinan', 'MENUNGGU_PENETAPAN',
       CONCAT('Menunggu penetapan: ', p.nama_lengkap),
       CONCAT(p.nama_lengkap, ' sudah lolos Verifikasi Kepegawaian untuk ', jt.nama_target,
              ' dan menunggu keputusan penetapan sebagai suksesor.'),
       CONCAT('/talent-pool?target=', tp.jabatan_target_id), 'talent_pool', tp.id,
       a.tanggal_aksi
FROM talent_pool tp
JOIN pegawai p ON p.id = tp.pegawai_id
JOIN jabatan_target jt ON jt.id = tp.jabatan_target_id
JOIN nominasi n ON n.talent_pool_id = tp.id
JOIN approval_log a ON a.nominasi_id = n.id AND a.tahap = 'Verifikasi Kepegawaian'
                   AND a.status = 'DISETUJUI'
JOIN users u ON u.role_id = (SELECT id FROM roles WHERE nama_role = 'Pimpinan')
WHERE tp.status = 'DIVERIFIKASI';

-- Suksesor yang sudah ditetapkan → Admin Talenta, DAN ditandai sudah terbaca.
-- Satu notifikasi terbaca perlu ada supaya kedua keadaan inbox teruji.
INSERT INTO notifikasi (user_id, peran_tujuan, jenis, judul, pesan, tautan, entitas, entitas_id, dibaca_pada, created_at)
SELECT u.id, 'Admin Talenta', 'SUKSESOR_DITETAPKAN',
       CONCAT('Suksesor ditetapkan: ', p.nama_lengkap),
       CONCAT(p.nama_lengkap, ' ditetapkan sebagai suksesor ', jt.nama_target,
              '. Rencana pengembangannya bisa disusun sekarang.'),
       CONCAT('/rencana-pengembangan?pool=', tp.id), 'talent_pool', tp.id,
       DATE_ADD(a.tanggal_aksi, INTERVAL 1 DAY), a.tanggal_aksi
FROM talent_pool tp
JOIN pegawai p ON p.id = tp.pegawai_id
JOIN jabatan_target jt ON jt.id = tp.jabatan_target_id
JOIN nominasi n ON n.talent_pool_id = tp.id
JOIN approval_log a ON a.nominasi_id = n.id AND a.tahap = 'Persetujuan Pimpinan'
                   AND a.status = 'DISETUJUI'
JOIN users u ON u.role_id = (SELECT id FROM roles WHERE nama_role = 'Admin Talenta')
WHERE tp.status = 'DITETAPKAN';

-- ---------------------------------------------------------------------
-- Pemeriksaan
-- ---------------------------------------------------------------------

-- 1. Tidak boleh ada pasangan status pool × nominasi yang mustahil.
SELECT tp.id AS talent_pool_id, p.nama_lengkap, tp.status AS status_pool, n.status AS status_nominasi
FROM talent_pool tp
JOIN pegawai p ON p.id = tp.pegawai_id
LEFT JOIN nominasi n ON n.talent_pool_id = tp.id
WHERE (n.status IN ('DIAJUKAN', 'MENUNGGU_VERIFIKASI') AND tp.status <> 'DINOMINASIKAN')
   OR (n.status = 'DISETUJUI' AND tp.status NOT IN ('DIVERIFIKASI', 'DITETAPKAN'))
   OR (n.id IS NULL AND tp.status IN ('DINOMINASIKAN', 'DIVERIFIKASI', 'DITETAPKAN'));

-- 2. Setiap nominasi di antrian verifikasi punya jejak approval_log.
SELECT n.id FROM nominasi n
WHERE n.status = 'MENUNGGU_VERIFIKASI'
  AND NOT EXISTS (SELECT 1 FROM approval_log a WHERE a.nominasi_id = n.id);

-- 3. Sebaran notifikasi per jenis — harus ada yang terbaca DAN belum terbaca.
SELECT jenis, COUNT(*) AS jumlah, SUM(dibaca_pada IS NULL) AS belum_dibaca
FROM notifikasi GROUP BY jenis ORDER BY jenis;
