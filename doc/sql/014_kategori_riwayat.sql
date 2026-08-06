-- 014_kategori_riwayat.sql — dijalankan setelah 013
--
-- KENAPA BERKAS INI ADA
--
-- Sampai sekarang dua indikator rubrik disimpulkan dari TEKS BEBAS dengan
-- pencocokan kata kunci:
--
--   * Pengembangan Kompetensi  → `pegawai.riwayat_diklat` (JSON, daftar nama
--     diklat apa adanya dari eHRM) dicocokkan dengan `jabatan_target.
--     kata_kunci_relevansi`;
--   * Substansi Riwayat Jabatan → `riwayat_jabatan.jabatan_nama_mentah` diuji
--     dengan regex /\b(plt|pelaksana tugas)\b/ dan /\b(plh|pelaksana harian)\b/.
--
-- Keduanya menghasilkan angka yang wajar untuk data yang rapi, dan **diam-diam
-- salah** untuk data yang tidak. Terukur di `pupr_dev`: dari 182 nama diklat
-- yang benar-benar ada, hanya **36** cocok dengan pola kategori mana pun —
-- "Bimtek Pengelolaan Kontrak Konstruksi" tidak cocok dengan kata kunci
-- "hukum kontrak" padahal isinya kontrak konstruksi. Ke arah sebaliknya,
-- "Pelaksana Tugas Belajar" akan tertangkap sebagai Plt padahal itu tugas
-- belajar (frasa itu nol kejadian di data dev, jadi ini risiko yang diantisipasi,
-- bukan bug yang teramati). Tidak satu pun dari kedua arah kekeliruan itu
-- menimbulkan galat: skornya tetap keluar, peringkatnya tetap tersusun, dan
-- tidak ada yang tahu kecuali kebetulan memeriksa orangnya satu per satu.
--
-- Berkas ini memindahkan keputusan itu dari tebakan mesin ke **kamus + validasi
-- manusia**, sekaligus menutup dua utang yang sudah tercatat:
--
--   * CLAUDE.md — "Pemetaan manual & tanda 'diverifikasi' di Antrian Pembersihan:
--     butuh tempat menyimpan keputusan manusia (siapa/kapan/catatan) yang belum
--     ada di skema";
--   * ERD.md §1 poin 6 — "riwayat diklat disimpan JSON; kalau nanti perlu query
--     'siapa saja yang ikut diklat X', baru layak dipecah". Kebutuhan itu sudah
--     datang: Kotak 9 akan disaring menurut jabatan target, dan syarat pelatihan
--     per jabatan ada di `doc/doc_tambahan_2/sample(1).md` lembar 6.
--
-- KENAPA KAMUS PER NAMA, BUKAN BARIS PER PEGAWAI
--
-- `pemetaan_diklat` dikunci pada NAMA DIKLAT, bukan pada (pegawai × diklat).
-- Di data dev 40 pegawai punya ratusan entri diklat tetapi hanya puluhan nama
-- yang benar-benar berbeda; di produksi 1.872 pegawai perbandingannya jauh lebih
-- ekstrem. Memvalidasi per baris berarti orang yang sama memutuskan "Diklat PIM
-- IV itu Manajerial" ratusan kali. Sekali per nama, berlaku untuk semua pegawai.
--
-- KENAPA `pola_cocok` TETAP ADA PADAHAL MANUSIA YANG MEMUTUSKAN
--
-- Supaya manusia MENGOREKSI usulan, bukan mengetik dari nol. Yang berubah bukan
-- "ada tidaknya pencocokan kata kunci", tapi statusnya: dulu ia keputusan akhir
-- yang tak terlihat, sekarang ia usulan yang harus dikonfirmasi dan jejaknya
-- tercatat. Kolomnya JSON dan bisa disunting dari UI — daftar kata kunci yang
-- hidup di kode akan menua tanpa ada yang berani menyentuhnya.
--
-- GAGAL TERTUTUP
--
-- Diklat yang belum dipetakan TIDAK dianggap relevan, dan riwayat jabatan yang
-- belum divalidasi TIDAK dianggap Plt/Plh. Arah sebaliknya menaikkan skor orang
-- yang datanya paling berantakan — persis kebalikan dari yang dimaksud.

-- ---------------------------------------------------------------------------
-- 1. Kamus kategori diklat
-- ---------------------------------------------------------------------------
DROP TABLE IF EXISTS pemetaan_diklat;
DROP TABLE IF EXISTS master_kategori_riwayat_diklat;

CREATE TABLE master_kategori_riwayat_diklat (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    kode            VARCHAR(60) NOT NULL COMMENT 'pengenal stabil; nama boleh diubah pengguna, kode tidak',
    nama            VARCHAR(150) NOT NULL,
    -- Tiga jenis kompetensi PP 11/2017 Ps. 203. SOSIAL_KULTURAL disertakan
    -- walau sample(1).xlsx lembar 6 belum memakainya: menambah nilai ENUM nanti
    -- adalah ALTER TABLE pada tabel yang sudah berisi, sedangkan menyediakannya
    -- sekarang tidak berbiaya apa pun.
    jenis           ENUM('MANAJERIAL','TEKNIS','FUNGSIONAL','SOSIAL_KULTURAL') NOT NULL,
    parent_id       BIGINT UNSIGNED NULL COMMENT 'hierarki: PIM III berada di bawah Kepemimpinan',
    -- Jenjang yang disetarakan diklat ini. Dipakai memeriksa syarat pelatihan
    -- per jabatan target: Direktur (eselon II) menuntut PIM III, Kepala Balai &
    -- Kasubdit (eselon III/IV) menuntut PIM IV — sample(1).md lembar 6.
    setara_jenjang  ENUM('II','III','IV') NULL,
    pola_cocok      JSON NULL COMMENT 'kata kunci pengUSUL kategori, bukan penentu; dikonfirmasi manusia',
    keterangan      VARCHAR(500) NULL,
    urutan          SMALLINT UNSIGNED NOT NULL DEFAULT 0,
    aktif           TINYINT(1) NOT NULL DEFAULT 1,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_mkrd_kode (kode),
    KEY idx_mkrd_jenis (jenis),
    KEY idx_mkrd_parent (parent_id),
    CONSTRAINT fk_mkrd_parent FOREIGN KEY (parent_id)
        REFERENCES master_kategori_riwayat_diklat (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Kamus kategori diklat/pelatihan. Sumber: sample(1).md lembar 6 (Persyaratan Jabatan) + PP 11/2017.';

-- ---------------------------------------------------------------------------
-- 2. Pemetaan nama diklat mentah → kategori (satu keputusan per NAMA)
-- ---------------------------------------------------------------------------
CREATE TABLE pemetaan_diklat (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    -- Kunci uniknya versi ternormalisasi, bukan teks aslinya: eHRM mengirim
    -- "Diklat PIM IV", "DIKLAT PIM  IV", dan "diklat pim iv" sebagai tiga string
    -- berbeda untuk satu diklat yang sama. Tanpa normalisasi, kamus ini tumbuh
    -- jadi daftar ejaan, bukan daftar diklat — dan manusia memvalidasi hal yang
    -- sama berkali-kali. Normalisasinya di lib/kategori-riwayat.ts (huruf kecil,
    -- spasi rangkap dipadatkan, tanda baca dibuang) supaya bisa diuji tanpa DB.
    nama_normal     VARCHAR(300) NOT NULL COMMENT 'hasil normalisasiNamaDiklat(); kunci pencocokan',
    nama_mentah     VARCHAR(300) NOT NULL COMMENT 'satu contoh ejaan asli, untuk ditampilkan ke pemeriksa',
    kategori_id     BIGINT UNSIGNED NULL COMMENT 'NULL = sudah diperiksa dan memang TIDAK berkategori',
    -- Dipisah dari kategori_id: "belum diperiksa" dan "sudah diperiksa, hasilnya
    -- bukan kategori mana pun" adalah dua keadaan berbeda, dan menyamakannya
    -- membuat antrian pemeriksaan tidak pernah habis.
    status          ENUM('USULAN','TERVALIDASI','DITOLAK') NOT NULL DEFAULT 'USULAN',
    divalidasi_oleh BIGINT UNSIGNED NULL,
    divalidasi_pada DATETIME NULL,
    catatan         VARCHAR(500) NULL,
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_pemetaan_diklat_nama (nama_normal),
    KEY idx_pemetaan_diklat_kategori (kategori_id),
    KEY idx_pemetaan_diklat_status (status),
    CONSTRAINT fk_pemetaan_diklat_kategori FOREIGN KEY (kategori_id)
        REFERENCES master_kategori_riwayat_diklat (id) ON DELETE SET NULL,
    CONSTRAINT fk_pemetaan_diklat_user FOREIGN KEY (divalidasi_oleh)
        REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Kamus: satu nama diklat → satu kategori. Divalidasi sekali, berlaku untuk semua pegawai.';

-- ---------------------------------------------------------------------------
-- 3. Jenis penugasan pada riwayat jabatan (Plt/Plh) — divalidasi, bukan ditebak
-- ---------------------------------------------------------------------------
--
-- NULL = belum diperiksa manusia. Usulan dari regex tetap dihitung dan
-- ditampilkan di antrian, tapi ia TIDAK disimpan di sini — kolom ini hanya
-- berisi keputusan. Kalau usulan ikut ditulis, tidak ada lagi cara membedakan
-- "mesin menebak Plt" dari "manusia memastikan Plt", dan seluruh gunanya hilang.
ALTER TABLE riwayat_jabatan
    ADD COLUMN jenis_penugasan ENUM('DEFINITIF','PLT','PLH') NULL
        COMMENT 'NULL = belum divalidasi manusia; usulan regex tidak ditulis ke sini'
        AFTER jabatan_id,
    ADD COLUMN relevan_substansi TINYINT(1) NULL
        COMMENT 'NULL = belum diperiksa. Relevansi isi jabatan thd jabatan target — dipakai versi 2-kategori Substansi (sample(1).md lembar 1)'
        AFTER jenis_penugasan,
    ADD COLUMN divalidasi_oleh BIGINT UNSIGNED NULL,
    ADD COLUMN divalidasi_pada DATETIME NULL,
    ADD KEY idx_riwayat_jabatan_penugasan (jenis_penugasan),
    ADD CONSTRAINT fk_riwayat_jabatan_validator FOREIGN KEY (divalidasi_oleh)
        REFERENCES users (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 4. Tanda "riwayat pegawai ini sudah diperiksa"
-- ---------------------------------------------------------------------------
--
-- Disimpan, bukan diturunkan. Kelengkapan bisa dihitung kapan saja ("semua
-- entri sudah berkategori"), tapi yang dibutuhkan di sini bukan kelengkapan —
-- melainkan PERNYATAAN seseorang bahwa ia sudah memeriksa. Keduanya berbeda:
-- pegawai tanpa satu pun riwayat diklat otomatis "lengkap" padahal belum pernah
-- dilihat siapa pun.
ALTER TABLE pegawai
    ADD COLUMN riwayat_divalidasi_oleh BIGINT UNSIGNED NULL AFTER riwayat_diklat,
    ADD COLUMN riwayat_divalidasi_pada DATETIME NULL AFTER riwayat_divalidasi_oleh,
    ADD COLUMN riwayat_catatan_validasi VARCHAR(500) NULL AFTER riwayat_divalidasi_pada,
    ADD KEY idx_pegawai_riwayat_validasi (riwayat_divalidasi_pada),
    ADD CONSTRAINT fk_pegawai_riwayat_validator FOREIGN KEY (riwayat_divalidasi_oleh)
        REFERENCES users (id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- 5. Isi kamus — diturunkan dari sample(1).md lembar 6 "Persyaratan Jabatan"
-- ---------------------------------------------------------------------------
--
-- Lembar itu menyebut dua rumpun pelatihan untuk kedelapan jabatan:
--
--   Pelatihan Manajerial (Diklat Kepemimpinan / Diklat PIM III / Pelatihan
--     Kepemimpinan Administrator)                       ← Direktur, eselon II
--   Pelatihan Manajerial (Diklat Kepemimpinan / Diklat PIM IV / Pelatihan
--     Kepemimpinan Pengawas)                            ← Kasubdit/Ka Balai
--   Pelatihan Teknis (Pelatihan Pengadaan Barang dan Jasa / Procurement,
--     Pelatihan Hukum Kontrak, Pelatihan Manajemen Konstruksi)
--
-- `pola_cocok` di bawah adalah pengUSUL. Ia sengaja tidak berusaha pintar:
-- menambah pola yang terlalu longgar akan membuat pemeriksa menyetujui usulan
-- tanpa membaca, dan itu mengembalikan keadaan ke tebakan mesin dengan tambahan
-- rasa aman yang palsu.
INSERT INTO master_kategori_riwayat_diklat
    (kode, nama, jenis, parent_id, setara_jenjang, pola_cocok, keterangan, urutan)
VALUES
    ('MANAJERIAL', 'Pelatihan Manajerial', 'MANAJERIAL', NULL, NULL,
     JSON_ARRAY('kepemimpinan', 'manajerial', 'diklatpim', 'diklat pim'),
     'Rumpun. Kategori sesungguhnya ada di turunannya.', 10),

    ('TEKNIS', 'Pelatihan Teknis', 'TEKNIS', NULL, NULL,
     JSON_ARRAY('pelatihan teknis', 'diklat teknis'),
     'Rumpun. Kategori sesungguhnya ada di turunannya.', 20),

    ('FUNGSIONAL', 'Pelatihan Fungsional', 'FUNGSIONAL', NULL, NULL,
     JSON_ARRAY('fungsional', 'jabatan fungsional'),
     'Belum dipakai syarat jabatan mana pun di lembar 6; disediakan karena PP 11/2017 memuatnya.', 30);

SET @manajerial = (SELECT id FROM master_kategori_riwayat_diklat WHERE kode = 'MANAJERIAL');
SET @teknis     = (SELECT id FROM master_kategori_riwayat_diklat WHERE kode = 'TEKNIS');

INSERT INTO master_kategori_riwayat_diklat
    (kode, nama, jenis, parent_id, setara_jenjang, pola_cocok, keterangan, urutan)
VALUES
    ('PIM_III', 'Diklat PIM III / Kepemimpinan Administrator', 'MANAJERIAL', @manajerial, 'III',
     JSON_ARRAY('pim iii', 'pim 3', 'diklatpim iii', 'kepemimpinan administrator', 'pka'),
     'Syarat Direktur Pengadaan Jasa Konstruksi (eselon II) — sample(1).md lembar 6 baris 3.', 11),

    ('PIM_IV', 'Diklat PIM IV / Kepemimpinan Pengawas', 'MANAJERIAL', @manajerial, 'IV',
     JSON_ARRAY('pim iv', 'pim 4', 'diklatpim iv', 'kepemimpinan pengawas', 'pkp'),
     'Syarat Kasubdit / Kepala Balai / Kasubag (eselon III & IV) — lembar 6 baris 4-10.', 12),

    ('PIM_II', 'Diklat PIM II / Kepemimpinan Nasional', 'MANAJERIAL', @manajerial, 'II',
     JSON_ARRAY('pim ii', 'pim 2', 'diklatpim ii', 'kepemimpinan nasional', 'pkn'),
     'Tidak disyaratkan di lembar 6; ada di data pegawai dan setara jenjang lebih tinggi.', 13),

    ('PBJ', 'Pengadaan Barang dan Jasa / Procurement', 'TEKNIS', @teknis, NULL,
     JSON_ARRAY('pengadaan barang', 'pengadaan barang dan jasa', 'procurement', 'pbj'),
     'Syarat teknis seluruh jabatan di lembar 6.', 21),

    ('HUKUM_KONTRAK', 'Hukum Kontrak', 'TEKNIS', @teknis, NULL,
     JSON_ARRAY('hukum kontrak', 'kontrak konstruksi'),
     'Syarat teknis seluruh jabatan di lembar 6.', 22),

    ('MANAJEMEN_KONSTRUKSI', 'Manajemen Konstruksi', 'TEKNIS', @teknis, NULL,
     JSON_ARRAY('manajemen konstruksi', 'manajemen proyek'),
     'Syarat teknis seluruh jabatan di lembar 6.', 23);

-- ---------------------------------------------------------------------------
-- 6. Benih antrian: setiap nama diklat yang SUDAH ADA di data masuk sebagai USULAN
-- ---------------------------------------------------------------------------
--
-- Tanpa langkah ini antriannya kosong pada hari pertama dan fiturnya terlihat
-- seperti tidak bekerja. Normalisasinya di SQL sengaja HANYA huruf kecil +
-- rapikan spasi — sisanya (buang tanda baca) dikerjakan lib/kategori-riwayat.ts
-- saat memetakan, supaya tidak ada dua definisi normalisasi yang bisa berbeda.
--
-- `status` tetap USULAN dan `kategori_id` tetap NULL: tidak ada satu pun baris
-- di sini yang boleh mengaku sudah divalidasi.
-- Dipakai `JSON_TABLE`, BUKAN generator angka `SELECT 0 UNION ALL SELECT 1 …`.
-- Versi pertama berkas ini memakai generator sampai indeks 14 karena "lima belas
-- diklat per orang pasti cukup". Di data dev ada pegawai dengan **30** entri,
-- jadi 68 dari 182 nama tidak pernah masuk antrian — dan tidak ada galat apa pun
-- yang menandainya: antriannya terisi, terlihat wajar, dan sepertiga isinya
-- hilang. Batas yang ditulis sebagai angka akan terlampaui oleh data.
INSERT IGNORE INTO pemetaan_diklat (nama_normal, nama_mentah, kategori_id, status)
SELECT LOWER(TRIM(REGEXP_REPLACE(jt.nama, '[[:space:]]+', ' '))) AS nama_normal,
       MIN(TRIM(jt.nama)) AS nama_mentah,
       NULL,
       'USULAN'
  FROM pegawai p,
       JSON_TABLE(p.riwayat_diklat, '$[*]' COLUMNS (nama VARCHAR(300) PATH '$')) jt
 WHERE p.riwayat_diklat IS NOT NULL
   AND jt.nama IS NOT NULL
   AND TRIM(jt.nama) <> ''
 GROUP BY nama_normal;

-- ---------------------------------------------------------------------------
-- Pemeriksaan
-- ---------------------------------------------------------------------------
SELECT 'kategori diklat' AS objek, COUNT(*) AS jumlah FROM master_kategori_riwayat_diklat
UNION ALL SELECT 'kategori (rumpun)', COUNT(*) FROM master_kategori_riwayat_diklat WHERE parent_id IS NULL
UNION ALL SELECT 'nama diklat masuk antrian', COUNT(*) FROM pemetaan_diklat
UNION ALL SELECT 'sudah tervalidasi (harus 0)', COUNT(*) FROM pemetaan_diklat WHERE status = 'TERVALIDASI'
UNION ALL SELECT 'riwayat jabatan belum divalidasi', COUNT(*) FROM riwayat_jabatan WHERE jenis_penugasan IS NULL
UNION ALL SELECT 'pegawai riwayat belum diperiksa', COUNT(*) FROM pegawai WHERE riwayat_divalidasi_pada IS NULL;
