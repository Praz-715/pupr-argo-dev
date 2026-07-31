-- =====================================================================
-- SIMT DJBK - 005 Skema Tambahan
--
-- Menutup tiga gap skema yang ditemukan saat menyusun rule engine
-- (phase.md §8 usulan U-3, U-5, dan U-12):
--   1. match_score_detail            -> skor bisa ditelusuri sampai indikator
--   2. match_score.rubrik_snapshot   -> skor lama tetap bisa direproduksi
--   3. jabatan_target.kata_kunci_relevansi
--                                    -> definisi "sesuai jabatan target"
--
-- URUTAN JALANKAN: 001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007
-- Berkas ini memakai ALTER TABLE, jadi tidak idempoten: kalau perlu ulang,
-- jalankan dari 001 (drop+recreate) supaya keadaan akhirnya pasti sama.
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. match_score_detail (U-3)
--
-- `match_score` hanya menyimpan 3 agregat + total, sehingga pertanyaan
-- "kenapa kandidat ini dapat 75,83 di target A tapi 88,33 di target B?"
-- tidak bisa dijawab dari UI. Padahal indikator yang sama memang bisa
-- bernilai beda antar jabatan target (relevansi bidang ilmu & diklat
-- berbeda). Tabel ini menyimpan hasil per indikator DAN sub-indikator.
--
-- `sumber_nilai` memisahkan nilai hasil hitung otomatis dari nilai yang
-- diisi manusia -- penting karena sebagian indikator (Lama/Keragaman/
-- Substansi Jabatan) datanya belum tentu lengkap di sumber, dan memaksa
-- semuanya otomatis akan menghasilkan skor yang salah tapi terlihat resmi.
-- ---------------------------------------------------------------------

DROP TABLE IF EXISTS match_score_detail;
CREATE TABLE match_score_detail (
    id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    match_score_id          BIGINT UNSIGNED NOT NULL,
    rubrik_indikator_id     BIGINT UNSIGNED NOT NULL,
    parent_indikator_id     BIGINT UNSIGNED NULL COMMENT 'NULL utk indikator top-level',
    bobot_indikator         DECIMAL(5,4) NULL COMMENT 'snapshot bobot saat dihitung; NULL utk sub-indikator',
    nilai_mentah            VARCHAR(255) NULL COMMENT 'input apa adanya (angka atau label kategori)',
    kategori_terpilih       VARCHAR(300) NULL COMMENT 'kategori rubrik yang cocok',
    skor                    DECIMAL(6,2) NOT NULL COMMENT 'hasil konversi, 0-100',
    sumber_nilai            ENUM('OTOMATIS','MANUAL') NOT NULL DEFAULT 'OTOMATIS',
    perlu_review            TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 = nilai di luar ambang / kosong / di-clamp',
    catatan                 TEXT NULL,
    diisi_oleh              BIGINT UNSIGNED NULL COMMENT 'wajib terisi bila sumber_nilai=MANUAL',
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_msd_skor_indikator (match_score_id, rubrik_indikator_id),
    KEY idx_msd_match_score (match_score_id),
    KEY idx_msd_indikator (rubrik_indikator_id),
    KEY idx_msd_review (perlu_review),
    CONSTRAINT fk_msd_match_score FOREIGN KEY (match_score_id) REFERENCES match_score (id) ON DELETE CASCADE,
    CONSTRAINT fk_msd_indikator FOREIGN KEY (rubrik_indikator_id) REFERENCES rubrik_indikator (id) ON DELETE CASCADE,
    CONSTRAINT fk_msd_parent FOREIGN KEY (parent_indikator_id) REFERENCES rubrik_indikator (id) ON DELETE SET NULL,
    CONSTRAINT fk_msd_diisi_oleh FOREIGN KEY (diisi_oleh) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Rincian match score per indikator & sub-indikator (transparansi perhitungan, U-3)';

-- ---------------------------------------------------------------------
-- 2. match_score.rubrik_snapshot (U-5)
--
-- Bobot rubrik bisa diubah dari UI editor. Tanpa snapshot, skor talent
-- pool yang sudah DITETAPKAN jadi tidak bisa direproduksi setelah bobot
-- berubah -- artinya keputusan suksesi kehilangan jejak audit.
-- ---------------------------------------------------------------------

ALTER TABLE match_score
    ADD COLUMN rubrik_snapshot JSON NULL
        COMMENT 'beku: bobot komponen & indikator saat skor ini dihitung (U-5)'
        AFTER catatan_eligibility;

-- ---------------------------------------------------------------------
-- 2b. asesmen_talenta.nilai_integritas dilebarkan ke DECIMAL(6,2)
--
-- Kolom ini semula DECIMAL(4,2) -- maksimum 99,99 -- karena data contoh
-- e-Nominasi mengirim skala kecil (1 s.d. 3,5). Setelah diputuskan bahwa
-- SELURUH sistem memakai satu skala integritas 0-100 (phase.md §2.7),
-- nilai 100 (= tidak pernah dijatuhi hukuman disiplin) tidak lagi muat.
--
-- Ini ditemukan justru karena DB menolak menyimpannya -- bukti bahwa
-- constraint yang ketat lebih berguna daripada kolom yang serba boleh.
-- ---------------------------------------------------------------------

ALTER TABLE asesmen_talenta
    MODIFY COLUMN nilai_integritas DECIMAL(6,2) NULL
        COMMENT 'skor Integritas & Moralitas 0-100 (satu skala dgn rubrik §B.3, lihat phase.md §2.7)';

-- ---------------------------------------------------------------------
-- 3. jabatan_target.kata_kunci_relevansi (U-12)
--
-- Rubrik memakai frasa "sesuai dengan jabatan target" pada indikator
-- Kesesuaian Bidang Ilmu dan Pengembangan Kompetensi, tapi sebelumnya
-- tidak ada tempat menyimpan APA yang dianggap sesuai. Akibatnya kedua
-- indikator itu tidak bisa dihitung otomatis. Kolom ini mengisinya.
--
-- Kata kunci 'semua' berarti semua bidang ilmu diperbolehkan. Untuk
-- indikator Pengembangan Kompetensi, 'semua' TIDAK dianggap membebaskan
-- syarat diklat -- lihat lib/penilaian.ts.
-- ---------------------------------------------------------------------

ALTER TABLE jabatan_target
    ADD COLUMN kata_kunci_relevansi JSON NULL
        COMMENT 'kata kunci bidang ilmu & diklat yang dianggap relevan (U-12)'
        AFTER deskripsi;

UPDATE jabatan_target SET kata_kunci_relevansi = JSON_ARRAY('semua', 'pengadaan', 'barang/jasa', 'ppbj')
WHERE kode_target = 'JT-KABALAI-BP2JK-KASUBDIT-PENGADAAN';

UPDATE jabatan_target SET kata_kunci_relevansi = JSON_ARRAY('semua', 'pengadaan', 'barang/jasa', 'kepemimpinan')
WHERE kode_target = 'JT-DIREKTUR-PENGADAAN';

UPDATE jabatan_target SET kata_kunci_relevansi = JSON_ARRAY('teknik', 'sipil', 'konstruksi', 'kompetensi', 'produktivitas')
WHERE kode_target = 'JT-KABALAI-BJKW';

-- ---------------------------------------------------------------------
-- 4. Lengkapi jabatan_target_persyaratan.nilai_minimal
--
-- Sebelumnya hanya PENDIDIKAN_MIN yang punya nilai terstruktur; BIDANG_ILMU
-- dan PENGALAMAN_MIN cuma deskripsi untuk dibaca manusia, sehingga selalu
-- jatuh ke status PERLU_VERIFIKASI_MANUAL di mesin kelayakan.
-- ---------------------------------------------------------------------

UPDATE jabatan_target_persyaratan p
JOIN jabatan_target t ON t.id = p.jabatan_target_id
SET p.nilai_minimal = 'semua'
WHERE p.jenis_syarat = 'BIDANG_ILMU'
  AND t.kode_target IN ('JT-KABALAI-BP2JK-KASUBDIT-PENGADAAN', 'JT-DIREKTUR-PENGADAAN');

UPDATE jabatan_target_persyaratan p
JOIN jabatan_target t ON t.id = p.jabatan_target_id
SET p.nilai_minimal = 'teknik, sipil, konstruksi'
WHERE p.jenis_syarat = 'BIDANG_ILMU'
  AND t.kode_target = 'JT-KABALAI-BJKW';

-- Eselon minimal yang pernah dijabat (dibandingkan lib/scoring/eligibility.ts)
UPDATE jabatan_target_persyaratan p
JOIN jabatan_target t ON t.id = p.jabatan_target_id
SET p.nilai_minimal = 'IV'
WHERE p.jenis_syarat = 'PENGALAMAN_MIN'
  AND t.kode_target = 'JT-KABALAI-BP2JK-KASUBDIT-PENGADAAN';

UPDATE jabatan_target_persyaratan p
JOIN jabatan_target t ON t.id = p.jabatan_target_id
SET p.nilai_minimal = 'III'
WHERE p.jenis_syarat = 'PENGALAMAN_MIN'
  AND t.kode_target IN ('JT-DIREKTUR-PENGADAAN', 'JT-KABALAI-BJKW');
