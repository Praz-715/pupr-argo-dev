-- 029 — Rencana pengembangan untuk SETIAP pegawai, bukan hanya yang sudah di talent pool.
--
-- Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 5): rencana
-- pengembangan *"bagian atas untuk yang sudah jadi suksesor, bagian bawah semua
-- pegawai tetap bisa diberi rekomendasi … kaya persis si suksesor tertentu"*.
--
-- ## Yang mengunci sekarang adalah SKEMA, bukan halamannya
--
-- `talent_pool_id` NOT NULL dengan FK ke `talent_pool` berarti sebuah rencana hanya
-- bisa lahir untuk orang yang **sudah masuk pool sebuah jabatan target**. Terukur:
-- 146 pegawai aktif, 4 entri pool. Jadi 142 orang tidak punya tempat untuk menyimpan
-- satu baris rencana pun, dan tidak ada perubahan UI yang bisa membukanya.
--
-- ## `pegawai_id` jadi kolom WAJIB, `talent_pool_id` jadi opsional
--
-- Arah ini dipilih di atas "biarkan keduanya boleh kosong" karena ia menegakkan
-- jawaban atas pertanyaan yang selalu punya jawaban: **rencana ini untuk siapa**.
-- Dengan kedua kolom nullable, sebuah baris tanpa keduanya adalah rencana tanpa
-- pemilik — dan itu tidak akan pernah muncul sebagai galat, hanya sebagai baris
-- yang tidak tampil di halaman mana pun. Konteks suksesinya (jabatan target mana)
-- memang bisa tidak ada, dan di situlah NULL berarti sesuatu.
--
-- ## FK pool: CASCADE → SET NULL, dan ini yang paling mudah terlewat
--
-- Selama `talent_pool_id` NOT NULL + CASCADE, mengeluarkan seseorang dari talent
-- pool **menghapus seluruh rencana pengembangannya**. Itu masuk akal ketika rencana
-- hanya bisa ada di dalam konteks pool; begitu rencana boleh berdiri sendiri, ia
-- jadi kehilangan data: orangnya masih ada, rencananya masih berlaku, dan yang
-- berubah cuma ia tidak lagi dicalonkan untuk kursi itu. Sekarang barisnya bertahan
-- dan `talent_pool_id`-nya jadi NULL.
--
-- `pegawai_id` sendiri tetap CASCADE — rencana tanpa orangnya memang tidak berarti apa-apa.
--
-- ## `dicontoh_dari_pegawai_id` mencatat ASALNYA, bukan menyalin diam-diam
--
-- *"kaya persis si suksesor tertentu"* dijalankan sebagai **menyalin rencana
-- suksesor itu sebagai templat lalu boleh disunting** — bukan sebagai rencana yang
-- diturunkan mesin dari selisih `match_score_detail`. Yang kedua lebih berguna dan
-- datanya memang sudah ada, tapi ia menghasilkan kalimat rencana yang tidak pernah
-- ditulis siapa pun, dan itu keputusan pemilik proses. Kolom ini yang membuat
-- pilihannya bisa dibalik nanti: asal tiap baris tercatat, jadi "mana yang disalin
-- dan dari siapa" bisa dijawab tanpa menebak.
--
-- Idempoten: tiap langkah dijaga `information_schema`, dan backfill dijalankan
-- sebelum kolomnya dijadikan NOT NULL sehingga menjalankan ulang aman.

-- ── 1. pegawai_id ───────────────────────────────────────────────────────────────
SET @ada := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rencana_pengembangan'
       AND COLUMN_NAME = 'pegawai_id'
);
SET @sql := IF(
    @ada = 0,
    'ALTER TABLE rencana_pengembangan
       ADD COLUMN pegawai_id BIGINT UNSIGNED NULL
       COMMENT ''Untuk siapa rencana ini. WAJIB — rencana tanpa pemilik tidak tampil di halaman mana pun.''
       AFTER id',
    'SELECT ''kolom pegawai_id sudah ada'''
);
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;

-- ── 2. Backfill dari pool, SEBELUM kolomnya dijadikan wajib ─────────────────────
UPDATE rencana_pengembangan r
  JOIN talent_pool tp ON tp.id = r.talent_pool_id
   SET r.pegawai_id = tp.pegawai_id
 WHERE r.pegawai_id IS NULL;

-- ── 3. talent_pool_id jadi opsional + FK-nya SET NULL ──────────────────────────
SET @ada := (
    SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rencana_pengembangan'
       AND CONSTRAINT_NAME = 'fk_rp_pool'
);
SET @sql := IF(@ada = 1, 'ALTER TABLE rencana_pengembangan DROP FOREIGN KEY fk_rp_pool',
                         'SELECT ''fk_rp_pool memang tidak ada''');
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;

ALTER TABLE rencana_pengembangan
  MODIFY COLUMN talent_pool_id BIGINT UNSIGNED NULL
    COMMENT 'Konteks suksesi rencana ini, kalau ada. NULL = rencana pengembangan umum, di luar pencalonan jabatan target mana pun.';

SET @ada := (
    SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rencana_pengembangan'
       AND CONSTRAINT_NAME = 'fk_rp_pool'
);
SET @sql := IF(
    @ada = 0,
    'ALTER TABLE rencana_pengembangan
       ADD CONSTRAINT fk_rp_pool FOREIGN KEY (talent_pool_id)
       REFERENCES talent_pool (id) ON DELETE SET NULL',
    'SELECT ''fk_rp_pool sudah terpasang'''
);
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;

-- ── 4. pegawai_id jadi WAJIB + FK ──────────────────────────────────────────────
--
-- Dijalankan sesudah backfill. Kalau masih ada baris tanpa pemilik (hanya mungkin
-- kalau data disisipkan langsung lewat SQL), ALTER-nya GAGAL — dan itu benar:
-- diam-diam membuang barisnya jauh lebih buruk daripada berhenti dengan pesan.
ALTER TABLE rencana_pengembangan
  MODIFY COLUMN pegawai_id BIGINT UNSIGNED NOT NULL
    COMMENT 'Untuk siapa rencana ini. WAJIB — rencana tanpa pemilik tidak tampil di halaman mana pun.';

SET @ada := (
    SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rencana_pengembangan'
       AND CONSTRAINT_NAME = 'fk_rp_pegawai'
);
SET @sql := IF(
    @ada = 0,
    'ALTER TABLE rencana_pengembangan
       ADD CONSTRAINT fk_rp_pegawai FOREIGN KEY (pegawai_id)
       REFERENCES pegawai (id) ON DELETE CASCADE',
    'SELECT ''fk_rp_pegawai sudah terpasang'''
);
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;

SET @ada := (
    SELECT COUNT(*) FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rencana_pengembangan'
       AND INDEX_NAME = 'idx_rp_pegawai'
);
SET @sql := IF(@ada = 0,
    'ALTER TABLE rencana_pengembangan ADD INDEX idx_rp_pegawai (pegawai_id, status)',
    'SELECT ''idx_rp_pegawai sudah ada''');
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;

-- ── 5. Asal salinan ────────────────────────────────────────────────────────────
SET @ada := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rencana_pengembangan'
       AND COLUMN_NAME = 'dicontoh_dari_pegawai_id'
);
SET @sql := IF(
    @ada = 0,
    'ALTER TABLE rencana_pengembangan
       ADD COLUMN dicontoh_dari_pegawai_id BIGINT UNSIGNED NULL
       COMMENT ''Suksesor yang rencananya dijadikan contoh. NULL = ditulis sendiri, bukan salinan.''
       AFTER talent_pool_id,
       ADD CONSTRAINT fk_rp_dicontoh FOREIGN KEY (dicontoh_dari_pegawai_id)
       REFERENCES pegawai (id) ON DELETE SET NULL',
    'SELECT ''kolom dicontoh_dari_pegawai_id sudah ada'''
);
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;
