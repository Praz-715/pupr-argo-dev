-- =====================================================================
-- SIMT DJBK - Sistem Informasi Manajemen Talenta
-- Skema database (DDL) turunan dari doc/ERD.md
-- Target: MySQL 8+ / pupr_dev
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- 1. MASTER DATA & KEPEGAWAIAN (ERD §2.1)
-- =====================================================================

DROP TABLE IF EXISTS unit_organisasi;
CREATE TABLE unit_organisasi (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode_unit       VARCHAR(30) NOT NULL,
    nama_unit       VARCHAR(200) NOT NULL,
    parent_id       BIGINT UNSIGNED NULL,
    jenis           ENUM('DITJEN','SEKRETARIAT','DIREKTORAT','BALAI','BP2JK','SUBDIT','BAGIAN','SEKSI') NOT NULL,
    level_eselon    TINYINT UNSIGNED NULL COMMENT '1-4, NULL jika non-struktural',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_unit_kode (kode_unit),
    KEY idx_unit_parent (parent_id),
    CONSTRAINT fk_unit_parent FOREIGN KEY (parent_id) REFERENCES unit_organisasi (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Hierarki unit organisasi DJBK (konsolidasi Unit Organisasi eNominasi + Unit Kerja eHRM)';

DROP TABLE IF EXISTS roles;
CREATE TABLE roles (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nama_role       VARCHAR(60) NOT NULL,
    deskripsi       TEXT NULL,
    UNIQUE KEY uk_role_nama (nama_role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Peran pengguna internal, lihat PRD.md §3';

DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nama                VARCHAR(150) NOT NULL,
    email               VARCHAR(150) NOT NULL,
    username            VARCHAR(60) NOT NULL,
    password_hash       VARCHAR(255) NOT NULL COMMENT 'placeholder dev seed, bukan hash produksi',
    role_id             BIGINT UNSIGNED NOT NULL,
    unit_organisasi_id  BIGINT UNSIGNED NULL COMMENT 'nullable: user pusat/lintas-unit (mis. Super Admin)',
    status_aktif        TINYINT(1) NOT NULL DEFAULT 1,
    last_login_at       DATETIME NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_users_email (email),
    UNIQUE KEY uk_users_username (username),
    KEY idx_users_role (role_id),
    KEY idx_users_unit (unit_organisasi_id),
    CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles (id),
    CONSTRAINT fk_users_unit FOREIGN KEY (unit_organisasi_id) REFERENCES unit_organisasi (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Pengguna internal sistem';

DROP TABLE IF EXISTS jabatan;
CREATE TABLE jabatan (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode_jabatan        VARCHAR(40) NOT NULL,
    nama_jabatan        VARCHAR(250) NOT NULL,
    unit_organisasi_id  BIGINT UNSIGNED NOT NULL,
    jenis_jabatan       ENUM('STRUKTURAL','FUNGSIONAL_TERTENTU','FUNGSIONAL_UMUM') NOT NULL,
    jenjang             VARCHAR(60) NOT NULL COMMENT 'cth: Administrator, Pengawas, Ahli Madya, JPT Pratama',
    eselon              ENUM('I','II','III','IV','NON_ESELON') NOT NULL,
    status_jabatan      ENUM('TERISI','KOSONG','DIHAPUS') NOT NULL DEFAULT 'TERISI',
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_jabatan_kode (kode_jabatan),
    KEY idx_jabatan_unit (unit_organisasi_id),
    KEY idx_jabatan_status (status_jabatan),
    CONSTRAINT fk_jabatan_unit FOREIGN KEY (unit_organisasi_id) REFERENCES unit_organisasi (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Master jabatan/posisi definitif. status_jabatan=KOSONG = sumber Status Jabatan Kosong (Blueprint)';

DROP TABLE IF EXISTS pegawai;
CREATE TABLE pegawai (
    id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nip                     VARCHAR(20) NOT NULL,
    nama_lengkap            VARCHAR(150) NOT NULL,
    golongan                VARCHAR(10) NOT NULL,
    tmt_golongan            DATE NULL,
    pangkat                 VARCHAR(60) NOT NULL,
    jabatan_id              BIGINT UNSIGNED NULL,
    tmt_jabatan             DATE NULL,
    sekolah_terakhir        VARCHAR(200) NULL,
    bidang_studi_terakhir   VARCHAR(200) NULL,
    tingkat_pendidikan      ENUM('SLTA','D3','S1_D4','S2','S3') NOT NULL,
    status_aktif            ENUM('AKTIF','PENSIUN','MUTASI_KELUAR','NONAKTIF') NOT NULL DEFAULT 'AKTIF',
    sumber_sinkron          ENUM('eHRM','eNominasi','manual') NOT NULL DEFAULT 'manual',
    last_synced_at          DATETIME NULL,
    riwayat_diklat          JSON NULL COMMENT 'daftar nama diklat dari eHRM, tidak dinormalisasi - lihat ERD.md §1.6',
    created_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_pegawai_nip (nip),
    KEY idx_pegawai_jabatan (jabatan_id),
    CONSTRAINT fk_pegawai_jabatan FOREIGN KEY (jabatan_id) REFERENCES jabatan (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Data biografis & posisi terkini pegawai. eselon/unit_kerja diturunkan lewat jabatan_id.';

DROP TABLE IF EXISTS riwayat_jabatan;
CREATE TABLE riwayat_jabatan (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pegawai_id          BIGINT UNSIGNED NOT NULL,
    urutan              SMALLINT UNSIGNED NOT NULL,
    jabatan_nama_mentah VARCHAR(500) NOT NULL COMMENT 'teks asli dari eHRM',
    jabatan_id          BIGINT UNSIGNED NULL COMMENT 'nullable, hasil pemetaan ke master jabatan',
    unit_kerja_mentah   VARCHAR(500) NULL,
    tanggal_mulai       DATE NULL,
    tanggal_akhir       DATE NULL,
    no_sk               VARCHAR(80) NULL,
    url_arsip_digital   VARCHAR(500) NULL,
    KEY idx_riwayat_jabatan_pegawai (pegawai_id),
    KEY idx_riwayat_jabatan_jabatan (jabatan_id),
    CONSTRAINT fk_riwayat_jabatan_pegawai FOREIGN KEY (pegawai_id) REFERENCES pegawai (id) ON DELETE CASCADE,
    CONSTRAINT fk_riwayat_jabatan_jabatan FOREIGN KEY (jabatan_id) REFERENCES jabatan (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Histori jabatan per pegawai (Blueprint: Riwayat Jabatan Terstruktur masih sebagian)';

DROP TABLE IF EXISTS riwayat_pendidikan;
CREATE TABLE riwayat_pendidikan (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pegawai_id          BIGINT UNSIGNED NOT NULL,
    urutan              SMALLINT UNSIGNED NOT NULL,
    jenjang_pendidikan  ENUM('SLTA','D3','S1_D4','S2','S3') NOT NULL,
    bidang_studi        VARCHAR(200) NOT NULL,
    nama_sekolah        VARCHAR(200) NULL,
    tahun_lulus         YEAR NULL,
    url_ijazah          VARCHAR(500) NULL,
    url_transkrip       VARCHAR(500) NULL,
    no_pertek_bkn       VARCHAR(80) NULL,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_riwayat_pendidikan_pegawai (pegawai_id),
    CONSTRAINT fk_riwayat_pendidikan_pegawai FOREIGN KEY (pegawai_id) REFERENCES pegawai (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Histori pendidikan per pegawai';

DROP TABLE IF EXISTS kinerja_periode;
CREATE TABLE kinerja_periode (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pegawai_id      BIGINT UNSIGNED NOT NULL,
    tahun           YEAR NOT NULL,
    periode_skp     ENUM('TW1','TW2','TW3','TAHUNAN') NOT NULL,
    nilai_kinerja   DECIMAL(5,2) NULL,
    nilai_perilaku  DECIMAL(5,2) NULL,
    predikat        ENUM('Sangat Baik','Baik','Butuh Perbaikan','Kurang','Sangat Kurang') NOT NULL,
    sumber_sync     VARCHAR(30) NOT NULL DEFAULT 'eKinerja',
    synced_at       DATETIME NULL,
    KEY idx_kinerja_periode_pegawai (pegawai_id, tahun),
    CONSTRAINT fk_kinerja_periode_pegawai FOREIGN KEY (pegawai_id) REFERENCES pegawai (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Rekap kinerja per triwulan/tahunan (sumber granular utk asesmen_talenta.rating_kinerja)';

DROP TABLE IF EXISTS hukuman_disiplin;
CREATE TABLE hukuman_disiplin (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pegawai_id      BIGINT UNSIGNED NOT NULL,
    tingkat_hukuman ENUM('Tidak Pernah','Ringan','Sedang','Berat','Sedang Menjalani') NOT NULL,
    tanggal_sk      DATE NULL,
    no_sk           VARCHAR(80) NULL,
    keterangan      TEXT NULL,
    status_aktif    TINYINT(1) NOT NULL DEFAULT 1,
    input_by        BIGINT UNSIGNED NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_hukuman_pegawai (pegawai_id),
    CONSTRAINT fk_hukuman_pegawai FOREIGN KEY (pegawai_id) REFERENCES pegawai (id) ON DELETE CASCADE,
    CONSTRAINT fk_hukuman_input_by FOREIGN KEY (input_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Rekam jejak disiplin (input manual, menutup gap Blueprint: Data Hukuman Disiplin Resmi)';

-- =====================================================================
-- 2. RULE ENGINE / RUBRIK PENILAIAN (ERD §2.2)
-- =====================================================================

DROP TABLE IF EXISTS jabatan_target;
CREATE TABLE jabatan_target (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode_target     VARCHAR(40) NOT NULL,
    nama_target     VARCHAR(250) NOT NULL,
    deskripsi       TEXT NULL,
    status          ENUM('DRAFT','AKTIF','NONAKTIF') NOT NULL DEFAULT 'DRAFT',
    dibuat_oleh     BIGINT UNSIGNED NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_jabatan_target_kode (kode_target),
    CONSTRAINT fk_jabatan_target_dibuat_oleh FOREIGN KEY (dibuat_oleh) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Profil jabatan sasaran suksesi, bisa mencakup >1 jabatan definitif';

DROP TABLE IF EXISTS jabatan_target_anggota;
CREATE TABLE jabatan_target_anggota (
    jabatan_target_id  BIGINT UNSIGNED NOT NULL,
    jabatan_id         BIGINT UNSIGNED NOT NULL,
    PRIMARY KEY (jabatan_target_id, jabatan_id),
    KEY idx_jta_jabatan (jabatan_id),
    CONSTRAINT fk_jta_target FOREIGN KEY (jabatan_target_id) REFERENCES jabatan_target (id) ON DELETE CASCADE,
    CONSTRAINT fk_jta_jabatan FOREIGN KEY (jabatan_id) REFERENCES jabatan (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Junction: jabatan definitif mana saja yang termasuk 1 profil jabatan target';

DROP TABLE IF EXISTS jabatan_target_persyaratan;
CREATE TABLE jabatan_target_persyaratan (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    jabatan_target_id   BIGINT UNSIGNED NOT NULL,
    jenis_syarat        ENUM('PENDIDIKAN_MIN','BIDANG_ILMU','PENGALAMAN_MIN','LAINNYA') NOT NULL,
    deskripsi           TEXT NOT NULL,
    nilai_minimal       VARCHAR(60) NULL,
    KEY idx_jtp_target (jabatan_target_id),
    CONSTRAINT fk_jtp_target FOREIGN KEY (jabatan_target_id) REFERENCES jabatan_target (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Syarat minimal per jabatan target (Master Jabatan Target & Persyaratan)';

DROP TABLE IF EXISTS rubrik_komponen;
CREATE TABLE rubrik_komponen (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    jabatan_target_id   BIGINT UNSIGNED NULL COMMENT 'NULL = rubrik generik Kotak 9 (Formula A)',
    sumbu               ENUM('Y_KINERJA','X_POTENSIAL') NOT NULL,
    nama_komponen       VARCHAR(150) NOT NULL,
    bobot_komponen      DECIMAL(5,4) NOT NULL COMMENT '0.0000 - 1.0000',
    urutan              SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    KEY idx_rk_target (jabatan_target_id),
    CONSTRAINT fk_rk_target FOREIGN KEY (jabatan_target_id) REFERENCES jabatan_target (id) ON DELETE CASCADE,
    CONSTRAINT chk_rk_bobot CHECK (bobot_komponen >= 0 AND bobot_komponen <= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Komponen berbobot per sumbu Y/X, bisa dikonfigurasi per jabatan_target dari UI';

DROP TABLE IF EXISTS rubrik_indikator;
CREATE TABLE rubrik_indikator (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rubrik_komponen_id  BIGINT UNSIGNED NOT NULL,
    parent_indikator_id BIGINT UNSIGNED NULL COMMENT 'nullable, untuk sub-indikator (mis. Nilai Pengalaman Jabatan)',
    nama_indikator      VARCHAR(200) NOT NULL,
    bobot_indikator     DECIMAL(5,4) NULL COMMENT 'NULL jika sub-indikator (digabung via rata-rata, lihat ERD.md §5)',
    mode_skor           ENUM('KATEGORI_TETAP','NILAI_LANGSUNG') NOT NULL DEFAULT 'KATEGORI_TETAP',
    kebutuhan_data      TEXT NULL,
    sumber_data         VARCHAR(200) NULL,
    urutan              SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    KEY idx_ri_komponen (rubrik_komponen_id),
    KEY idx_ri_parent (parent_indikator_id),
    CONSTRAINT fk_ri_komponen FOREIGN KEY (rubrik_komponen_id) REFERENCES rubrik_komponen (id) ON DELETE CASCADE,
    CONSTRAINT fk_ri_parent FOREIGN KEY (parent_indikator_id) REFERENCES rubrik_indikator (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Indikator berbobot per komponen, mendukung sub-indikator (self-FK)';

DROP TABLE IF EXISTS rubrik_kategori_skor;
CREATE TABLE rubrik_kategori_skor (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    rubrik_indikator_id BIGINT UNSIGNED NOT NULL,
    nama_kategori       VARCHAR(300) NOT NULL,
    nilai_skor          DECIMAL(6,2) NULL COMMENT 'NULL jika mode_skor=NILAI_LANGSUNG (skor = nilai mentah)',
    ambang_min          DECIMAL(6,2) NULL,
    ambang_max          DECIMAL(6,2) NULL,
    urutan              SMALLINT UNSIGNED NOT NULL DEFAULT 1,
    KEY idx_rks_indikator (rubrik_indikator_id),
    CONSTRAINT fk_rks_indikator FOREIGN KEY (rubrik_indikator_id) REFERENCES rubrik_indikator (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Rubrik skor per indikator (kategori->nilai, atau ambang batas)';

-- =====================================================================
-- 3. ASESMEN, TALENT POOL & WORKFLOW NOMINASI (ERD §2.3)
-- =====================================================================

DROP TABLE IF EXISTS asesmen_talenta;
CREATE TABLE asesmen_talenta (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pegawai_id          BIGINT UNSIGNED NOT NULL,
    tahun_asesmen       YEAR NOT NULL,
    jenis_asesmen       VARCHAR(60) NOT NULL,
    status_asesmen      ENUM('Berlaku','Expired','Draft') NOT NULL DEFAULT 'Berlaku',
    nilai_kinerja_y     DECIMAL(6,2) NOT NULL,
    nilai_potensial_x   DECIMAL(6,2) NOT NULL,
    potkom              DECIMAL(6,2) NOT NULL,
    nilai_integritas    DECIMAL(4,2) NULL COMMENT 'skala kecil apa adanya dari eNominasi, BUKAN skor rubrik Integritas&Moralitas',
    nilai_talenta       DECIMAL(6,2) NOT NULL COMMENT '50 persen Y + 50 persen X',
    kotak_9             TINYINT UNSIGNED NOT NULL,
    tahun_kinerja       YEAR NULL,
    rating_kinerja      ENUM('Sangat Baik','Baik','Butuh Perbaikan','Kurang','Sangat Kurang') NOT NULL,
    sumber_sync         ENUM('eNominasi','manual','recalculated') NOT NULL DEFAULT 'eNominasi',
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_asesmen_pegawai (pegawai_id, tahun_asesmen),
    CONSTRAINT fk_asesmen_pegawai FOREIGN KEY (pegawai_id) REFERENCES pegawai (id) ON DELETE CASCADE,
    CONSTRAINT chk_asesmen_kotak9 CHECK (kotak_9 BETWEEN 1 AND 9)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Snapshot tahunan skor generik (Formula A, Kotak 9) - setara dtm_asesmen_talenta.csv';

DROP TABLE IF EXISTS match_score;
CREATE TABLE match_score (
    id                          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pegawai_id                  BIGINT UNSIGNED NOT NULL,
    jabatan_target_id           BIGINT UNSIGNED NOT NULL,
    skor_potensi_kompetensi     DECIMAL(6,2) NOT NULL,
    skor_kualifikasi_jabatan    DECIMAL(6,2) NOT NULL,
    skor_integritas_moralitas   DECIMAL(6,2) NOT NULL,
    skor_total                  DECIMAL(6,2) NOT NULL COMMENT '65/20/15 weighted (Formula B)',
    eligible                    TINYINT(1) NOT NULL DEFAULT 0,
    catatan_eligibility         TEXT NULL,
    computed_at                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_match_score_pegawai (pegawai_id),
    KEY idx_match_score_target (jabatan_target_id),
    CONSTRAINT fk_match_score_pegawai FOREIGN KEY (pegawai_id) REFERENCES pegawai (id) ON DELETE CASCADE,
    CONSTRAINT fk_match_score_target FOREIGN KEY (jabatan_target_id) REFERENCES jabatan_target (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Skor kecocokan pegawai x jabatan target spesifik (Eligibility Check & Match Scoring)';

DROP TABLE IF EXISTS talent_pool;
CREATE TABLE talent_pool (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    pegawai_id          BIGINT UNSIGNED NOT NULL,
    jabatan_target_id   BIGINT UNSIGNED NOT NULL,
    match_score_id      BIGINT UNSIGNED NULL,
    ranking             INT UNSIGNED NULL,
    status              ENUM('KANDIDAT','DINOMINASIKAN','DIVERIFIKASI','DITETAPKAN','DITOLAK') NOT NULL DEFAULT 'KANDIDAT',
    catatan_reviewer    TEXT NULL,
    ditetapkan_pada     DATE NULL,
    ditetapkan_oleh     BIGINT UNSIGNED NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_talent_pool_pegawai_target (pegawai_id, jabatan_target_id),
    KEY idx_talent_pool_target_status (jabatan_target_id, status),
    CONSTRAINT fk_talent_pool_pegawai FOREIGN KEY (pegawai_id) REFERENCES pegawai (id) ON DELETE CASCADE,
    CONSTRAINT fk_talent_pool_target FOREIGN KEY (jabatan_target_id) REFERENCES jabatan_target (id) ON DELETE CASCADE,
    CONSTRAINT fk_talent_pool_score FOREIGN KEY (match_score_id) REFERENCES match_score (id) ON DELETE SET NULL,
    CONSTRAINT fk_talent_pool_ditetapkan_oleh FOREIGN KEY (ditetapkan_oleh) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Daftar kandidat final per jabatan target + status workflow';

DROP TABLE IF EXISTS nominasi;
CREATE TABLE nominasi (
    id                      BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    talent_pool_id          BIGINT UNSIGNED NOT NULL,
    diajukan_oleh_unit_id   BIGINT UNSIGNED NOT NULL,
    diajukan_oleh_user_id   BIGINT UNSIGNED NULL,
    tanggal_diajukan        DATE NOT NULL,
    status                  ENUM('DIAJUKAN','MENUNGGU_VERIFIKASI','DISETUJUI','DITOLAK') NOT NULL DEFAULT 'DIAJUKAN',
    catatan                 TEXT NULL,
    KEY idx_nominasi_pool (talent_pool_id),
    KEY idx_nominasi_unit (diajukan_oleh_unit_id),
    CONSTRAINT fk_nominasi_pool FOREIGN KEY (talent_pool_id) REFERENCES talent_pool (id) ON DELETE CASCADE,
    CONSTRAINT fk_nominasi_unit FOREIGN KEY (diajukan_oleh_unit_id) REFERENCES unit_organisasi (id),
    CONSTRAINT fk_nominasi_user FOREIGN KEY (diajukan_oleh_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Pengajuan nominasi kandidat oleh unit (langkah Nominasi Unit)';

DROP TABLE IF EXISTS approval_log;
CREATE TABLE approval_log (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nominasi_id         BIGINT UNSIGNED NOT NULL,
    tahap               VARCHAR(100) NOT NULL COMMENT 'cth: Verifikasi Kepegawaian, Persetujuan Pimpinan',
    status              ENUM('MENUNGGU','DISETUJUI','DITOLAK','REVISI') NOT NULL,
    approver_user_id    BIGINT UNSIGNED NULL,
    catatan             TEXT NULL,
    tanggal_aksi        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_approval_log_nominasi (nominasi_id),
    CONSTRAINT fk_approval_log_nominasi FOREIGN KEY (nominasi_id) REFERENCES nominasi (id) ON DELETE CASCADE,
    CONSTRAINT fk_approval_log_approver FOREIGN KEY (approver_user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Log berjenjang persetujuan nominasi (langkah Verifikasi Kepegawaian)';

DROP TABLE IF EXISTS rencana_pengembangan;
CREATE TABLE rencana_pengembangan (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    talent_pool_id      BIGINT UNSIGNED NOT NULL,
    jenis_pengembangan  ENUM('DIKLAT','ROTASI','MENTORING','PENUGASAN') NOT NULL,
    deskripsi           TEXT NOT NULL,
    target_selesai      DATE NULL,
    status              ENUM('DIRENCANAKAN','BERJALAN','SELESAI') NOT NULL DEFAULT 'DIRENCANAKAN',
    dibuat_oleh         BIGINT UNSIGNED NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_rp_pool (talent_pool_id),
    CONSTRAINT fk_rp_pool FOREIGN KEY (talent_pool_id) REFERENCES talent_pool (id) ON DELETE CASCADE,
    CONSTRAINT fk_rp_dibuat_oleh FOREIGN KEY (dibuat_oleh) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Rencana pengembangan suksesor (Lampiran B & langkah Rencana Pengembangan)';

-- =====================================================================
-- 4. SISTEM, KEAMANAN & INTEGRASI API (ERD §2.4)
-- =====================================================================

DROP TABLE IF EXISTS audit_log;
CREATE TABLE audit_log (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id         BIGINT UNSIGNED NULL COMMENT 'NULL jika via API/sistem',
    aksi            VARCHAR(60) NOT NULL COMMENT 'CREATE/UPDATE/DELETE/APPROVE/dll',
    entitas         VARCHAR(60) NOT NULL COMMENT 'nama tabel yang diubah',
    entitas_id      BIGINT UNSIGNED NULL,
    data_sebelum    JSON NULL,
    data_sesudah    JSON NULL,
    ip_address      VARCHAR(45) NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_audit_entitas (entitas, entitas_id),
    KEY idx_audit_user (user_id),
    CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Jejak audit semua perubahan data penting';

DROP TABLE IF EXISTS api_client;
CREATE TABLE api_client (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    nama_instansi   VARCHAR(200) NOT NULL,
    kode_instansi   VARCHAR(40) NOT NULL,
    contact_person  VARCHAR(150) NULL,
    email           VARCHAR(150) NULL,
    no_mou          VARCHAR(100) NULL COMMENT 'referensi Nota Kesepahaman/PKS',
    status          ENUM('AKTIF','NONAKTIF','PENDING') NOT NULL DEFAULT 'PENDING',
    scope_akses     JSON NULL COMMENT 'daftar endpoint & field yang diizinkan',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_api_client_kode (kode_instansi)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Instansi eksternal yang mengonsumsi API';

DROP TABLE IF EXISTS api_token;
CREATE TABLE api_token (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    api_client_id   BIGINT UNSIGNED NOT NULL,
    token_hash      VARCHAR(255) NOT NULL COMMENT 'hash token, bukan token asli',
    label           VARCHAR(100) NULL,
    expired_at      DATETIME NULL,
    last_used_at    DATETIME NULL,
    status          ENUM('AKTIF','DICABUT') NOT NULL DEFAULT 'AKTIF',
    created_by      BIGINT UNSIGNED NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_api_token_hash (token_hash),
    KEY idx_api_token_client (api_client_id),
    CONSTRAINT fk_api_token_client FOREIGN KEY (api_client_id) REFERENCES api_client (id) ON DELETE CASCADE,
    CONSTRAINT fk_api_token_created_by FOREIGN KEY (created_by) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Token akses (Bearer) per klien eksternal';

DROP TABLE IF EXISTS api_activity_log;
CREATE TABLE api_activity_log (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    api_client_id       BIGINT UNSIGNED NOT NULL,
    api_token_id        BIGINT UNSIGNED NULL,
    endpoint            VARCHAR(200) NOT NULL,
    method              VARCHAR(10) NOT NULL,
    response_code       SMALLINT UNSIGNED NOT NULL,
    response_time_ms    INT UNSIGNED NULL,
    ip_address          VARCHAR(45) NULL,
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_api_activity_client_time (api_client_id, created_at),
    CONSTRAINT fk_api_activity_client FOREIGN KEY (api_client_id) REFERENCES api_client (id) ON DELETE CASCADE,
    CONSTRAINT fk_api_activity_token FOREIGN KEY (api_token_id) REFERENCES api_token (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Log pemanggilan API eksternal (audit & pemantauan rate-limit)';

DROP TABLE IF EXISTS sync_log;
CREATE TABLE sync_log (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sumber_sistem       ENUM('eHRM','eNominasi','eKinerja','Manual') NOT NULL,
    jenis_data          VARCHAR(100) NOT NULL,
    status              ENUM('SUKSES','GAGAL','SEBAGIAN') NOT NULL,
    jumlah_baris        INT UNSIGNED NULL,
    mulai_pada          DATETIME NOT NULL,
    selesai_pada        DATETIME NULL,
    catatan_error       TEXT NULL,
    dijalankan_oleh     BIGINT UNSIGNED NULL COMMENT 'NULL jika terjadwal/sistem',
    CONSTRAINT fk_sync_log_user FOREIGN KEY (dijalankan_oleh) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Log konsolidasi data dari eHRM/eNominasi/eKinerja (Komponen #1 Blueprint)';

SET FOREIGN_KEY_CHECKS = 1;
