-- =====================================================================
-- SIMT DJBK - Migrasi tambahan: perkaya jabatan_target
-- Jalankan SETELAH 001_schema.sql + 002_seed.sql
-- Menambahkan 2 profil jabatan target baru (total jadi 3):
--   1. Kepala Balai BP2JK / Kasubdit Pengadaan   (sudah ada di 002_seed.sql)
--   2. Direktur Pengadaan Jasa Konstruksi        (BARU - suksesi jenjang JPT Pratama)
--   3. Kepala Balai Jasa Konstruksi Wilayah (BJKW) (BARU - rubrik non-pengadaan)
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- Jabatan baru: BJKW Wilayah IV Surabaya (KOSONG - anggota target 3)
-- ---------------------------------------------------------------------
INSERT INTO jabatan (id, kode_jabatan, nama_jabatan, unit_organisasi_id, jenis_jabatan, jenjang, eselon, status_jabatan) VALUES
(16, 'JAB-KABALAI-BJKW-SBY', 'Kepala Balai Jasa Konstruksi Wilayah IV Surabaya', 16, 'STRUKTURAL', 'Administrator', 'III', 'KOSONG');

-- ---------------------------------------------------------------------
-- JABATAN_TARGET baru
-- ---------------------------------------------------------------------
INSERT INTO jabatan_target (id, kode_target, nama_target, deskripsi, status, dibuat_oleh) VALUES
(2, 'JT-DIREKTUR-PENGADAAN', 'Direktur Pengadaan Jasa Konstruksi', 'Profil jabatan sasaran suksesi jenjang JPT Pratama (Eselon II) untuk perencanaan suksesi jangka menengah-panjang Direktorat Pengadaan Jasa Konstruksi. Kandidat berasal dari jenjang Administrator (Kepala Balai/Kasubdit) yang telah memenuhi syarat pendidikan minimal S2.', 'AKTIF', 2),
(3, 'JT-KABALAI-BJKW', 'Kepala Balai Jasa Konstruksi Wilayah (BJKW)', 'Profil jabatan sasaran suksesi untuk seluruh posisi Kepala Balai Jasa Konstruksi Wilayah (fungsi pembinaan kompetensi & produktivitas konstruksi, berbeda dari BP2JK yang fokus pemilihan/pengadaan). Rubrik menilai kesesuaian bidang ilmu teknik/konstruksi, bukan pengadaan.', 'AKTIF', 2);

INSERT INTO jabatan_target_anggota (jabatan_target_id, jabatan_id) VALUES
(2, 1),                 -- Direktur Pengadaan Jasa Konstruksi (Budi Santoso, saat ini terisi - suksesi jangka menengah)
(3, 8), (3, 16);         -- Kepala Balai BJKW Makassar (terisi - Rus) + BJKW Surabaya (kosong)

INSERT INTO jabatan_target_persyaratan (jabatan_target_id, jenis_syarat, deskripsi, nilai_minimal) VALUES
(2, 'PENDIDIKAN_MIN', 'Minimal S2 (Magister) - persyaratan jenjang JPT Pratama', 'S2'),
(2, 'BIDANG_ILMU', 'Untuk Direktorat Pengadaan: semua bidang ilmu diperbolehkan selama relevan dengan tugas kedinasan', NULL),
(2, 'PENGALAMAN_MIN', 'Memiliki pengalaman jabatan minimal setara Administrator (Eselon III) ke atas', NULL),
(3, 'PENDIDIKAN_MIN', 'Minimal S1/D-IV, diutamakan bidang teknik/konstruksi', 'S1_D4'),
(3, 'BIDANG_ILMU', 'Diutamakan bidang ilmu teknik sipil, konstruksi, atau pengembangan kompetensi/produktivitas konstruksi', NULL),
(3, 'PENGALAMAN_MIN', 'Memiliki pengalaman jabatan minimal setara Administrator (Eselon III) ke atas, atau Ahli Utama fungsional bidang jasa konstruksi', NULL);

-- ---------------------------------------------------------------------
-- Rubrik penilaian utk target 2 & target 3 (struktur identik dgn target 1
-- - lihat KERANGKA TALENT POOL.md - masing2 disalin independen krn tiap
-- jabatan_target rubriknya bisa dikonfigurasi/diubah terpisah dari UI)
-- ---------------------------------------------------------------------

-- Rubrik target 2: Direktur Pengadaan Jasa Konstruksi
INSERT INTO rubrik_komponen (id, jabatan_target_id, sumbu, nama_komponen, bobot_komponen, urutan) VALUES
(6, 2, 'X_POTENSIAL', 'Potensi & Kompetensi', 0.6500, 1),
(7, 2, 'X_POTENSIAL', 'Kualifikasi Jabatan', 0.2000, 2),
(8, 2, 'X_POTENSIAL', 'Integritas & Moralitas', 0.1500, 3);

INSERT INTO rubrik_indikator (id, rubrik_komponen_id, parent_indikator_id, nama_indikator, bobot_indikator, mode_skor, kebutuhan_data, sumber_data, urutan) VALUES
(12, 6, NULL, 'Penilaian Potensi dan Kompetensi', 0.6500, 'NILAI_LANGSUNG', 'Nilai Potkom Jabatan saat ini', 'karir.pu.go.id/enom', 1),
(13, 7, NULL, 'Tingkat Pendidikan Formal', 0.0500, 'KATEGORI_TETAP', 'Data Riwayat Pendidikan PNS-PENDIDIKAN', 'ehrm.pu.go.id/layanan-kepegawaian', 1),
(14, 7, NULL, 'Kesesuaian Bidang Ilmu', 0.0500, 'KATEGORI_TETAP', 'Data Riwayat Pendidikan PNS - Jurusan/Bidang Studi', 'ehrm.pu.go.id/layanan-kepegawaian', 2),
(15, 7, NULL, 'Pengembangan Kompetensi', 0.0500, 'KATEGORI_TETAP', 'Data Riwayat Diklat / Sertifikasi Keahlian PNS', 'ehrm.pu.go.id/layanan-kepegawaian', 3),
(16, 7, NULL, 'Nilai Pengalaman Jabatan', 0.0500, 'KATEGORI_TETAP', 'Data Riwayat Jabatan PNS', 'ehrm.pu.go.id/layanan-kepegawaian', 4),
(17, 7, 16, 'Lama Jabatan', NULL, 'KATEGORI_TETAP', NULL, NULL, 1),
(18, 7, 16, 'Keragaman Riwayat Jabatan', NULL, 'KATEGORI_TETAP', NULL, NULL, 2),
(19, 7, 16, 'Substansi Riwayat Jabatan', NULL, 'KATEGORI_TETAP', NULL, NULL, 3),
(20, 8, NULL, 'Verifikasi Rekam Jejak Disiplin', 0.1500, 'KATEGORI_TETAP', 'input manual', 'input manual', 1);

INSERT INTO rubrik_kategori_skor (rubrik_indikator_id, nama_kategori, nilai_skor, ambang_min, ambang_max, urutan) VALUES
(12, 'Memenuhi Syarat', NULL, 80, NULL, 1),
(12, 'Masih Memenuhi Syarat', NULL, 68, 80, 2),
(12, 'Kurang Memenuhi Syarat', NULL, NULL, 68, 3),
(13, 'Doktor', 100, NULL, NULL, 1),
(13, 'Magister', 90, NULL, NULL, 2),
(13, 'S1/DIV', 80, NULL, NULL, 3),
(13, 'DIII', 70, NULL, NULL, 4),
(13, 'SLTA', 60, NULL, NULL, 5),
(14, 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100, NULL, NULL, 1),
(14, 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50, NULL, NULL, 2),
(15, 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100, NULL, NULL, 1),
(15, 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50, NULL, NULL, 2),
(17, 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100, NULL, NULL, 1),
(17, 'Memiliki masa kerja dalam jenjang jabatan 3 sampai dengan 4 tahun', 80, NULL, NULL, 2),
(17, 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60, NULL, NULL, 3),
(18, 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100, NULL, NULL, 1),
(18, 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80, NULL, NULL, 2),
(18, 'Memiliki pengalaman jabatan satu Unit Kerja', 60, NULL, NULL, 3),
(19, 'Memiliki pengalaman penugasan sbg Pelaksana Tugas/Plt pada jenjang jabatan yang lebih tinggi', 100, NULL, NULL, 1),
(19, 'Memiliki pengalaman penugasan sbg Pelaksana Tugas/Plt pada jenjang jabatan yang setara', 80, NULL, NULL, 2),
(19, 'Memiliki pengalaman penugasan sbg Pelaksana Harian/Plh pada jenjang jabatan yang lebih tinggi', 60, NULL, NULL, 3),
(19, 'Memiliki pengalaman penugasan sbg Pelaksana Harian/Plh pada jenjang jabatan yang setara', 40, NULL, NULL, 4),
(19, 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0, NULL, NULL, 5),
(20, 'Tidak Pernah', 100, NULL, NULL, 1),
(20, 'Ringan', 75, NULL, NULL, 2),
(20, 'Sedang', 50, NULL, NULL, 3),
(20, 'Berat', 25, NULL, NULL, 4),
(20, 'Sedang Menjalani', 0, NULL, NULL, 5);

-- Rubrik target 3: Kepala Balai Jasa Konstruksi Wilayah (BJKW)
INSERT INTO rubrik_komponen (id, jabatan_target_id, sumbu, nama_komponen, bobot_komponen, urutan) VALUES
(9, 3, 'X_POTENSIAL', 'Potensi & Kompetensi', 0.6500, 1),
(10, 3, 'X_POTENSIAL', 'Kualifikasi Jabatan', 0.2000, 2),
(11, 3, 'X_POTENSIAL', 'Integritas & Moralitas', 0.1500, 3);

INSERT INTO rubrik_indikator (id, rubrik_komponen_id, parent_indikator_id, nama_indikator, bobot_indikator, mode_skor, kebutuhan_data, sumber_data, urutan) VALUES
(21, 9, NULL, 'Penilaian Potensi dan Kompetensi', 0.6500, 'NILAI_LANGSUNG', 'Nilai Potkom Jabatan saat ini', 'karir.pu.go.id/enom', 1),
(22, 10, NULL, 'Tingkat Pendidikan Formal', 0.0500, 'KATEGORI_TETAP', 'Data Riwayat Pendidikan PNS-PENDIDIKAN', 'ehrm.pu.go.id/layanan-kepegawaian', 1),
(23, 10, NULL, 'Kesesuaian Bidang Ilmu', 0.0500, 'KATEGORI_TETAP', 'Data Riwayat Pendidikan PNS - Jurusan/Bidang Studi', 'ehrm.pu.go.id/layanan-kepegawaian', 2),
(24, 10, NULL, 'Pengembangan Kompetensi', 0.0500, 'KATEGORI_TETAP', 'Data Riwayat Diklat / Sertifikasi Keahlian PNS', 'ehrm.pu.go.id/layanan-kepegawaian', 3),
(25, 10, NULL, 'Nilai Pengalaman Jabatan', 0.0500, 'KATEGORI_TETAP', 'Data Riwayat Jabatan PNS', 'ehrm.pu.go.id/layanan-kepegawaian', 4),
(26, 10, 25, 'Lama Jabatan', NULL, 'KATEGORI_TETAP', NULL, NULL, 1),
(27, 10, 25, 'Keragaman Riwayat Jabatan', NULL, 'KATEGORI_TETAP', NULL, NULL, 2),
(28, 10, 25, 'Substansi Riwayat Jabatan', NULL, 'KATEGORI_TETAP', NULL, NULL, 3),
(29, 11, NULL, 'Verifikasi Rekam Jejak Disiplin', 0.1500, 'KATEGORI_TETAP', 'input manual', 'input manual', 1);

INSERT INTO rubrik_kategori_skor (rubrik_indikator_id, nama_kategori, nilai_skor, ambang_min, ambang_max, urutan) VALUES
(21, 'Memenuhi Syarat', NULL, 80, NULL, 1),
(21, 'Masih Memenuhi Syarat', NULL, 68, 80, 2),
(21, 'Kurang Memenuhi Syarat', NULL, NULL, 68, 3),
(22, 'Doktor', 100, NULL, NULL, 1),
(22, 'Magister', 90, NULL, NULL, 2),
(22, 'S1/DIV', 80, NULL, NULL, 3),
(22, 'DIII', 70, NULL, NULL, 4),
(22, 'SLTA', 60, NULL, NULL, 5),
(23, 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100, NULL, NULL, 1),
(23, 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50, NULL, NULL, 2),
(24, 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100, NULL, NULL, 1),
(24, 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50, NULL, NULL, 2),
(26, 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100, NULL, NULL, 1),
(26, 'Memiliki masa kerja dalam jenjang jabatan 3 sampai dengan 4 tahun', 80, NULL, NULL, 2),
(26, 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60, NULL, NULL, 3),
(27, 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100, NULL, NULL, 1),
(27, 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80, NULL, NULL, 2),
(27, 'Memiliki pengalaman jabatan satu Unit Kerja', 60, NULL, NULL, 3),
(28, 'Memiliki pengalaman penugasan sbg Pelaksana Tugas/Plt pada jenjang jabatan yang lebih tinggi', 100, NULL, NULL, 1),
(28, 'Memiliki pengalaman penugasan sbg Pelaksana Tugas/Plt pada jenjang jabatan yang setara', 80, NULL, NULL, 2),
(28, 'Memiliki pengalaman penugasan sbg Pelaksana Harian/Plh pada jenjang jabatan yang lebih tinggi', 60, NULL, NULL, 3),
(28, 'Memiliki pengalaman penugasan sbg Pelaksana Harian/Plh pada jenjang jabatan yang setara', 40, NULL, NULL, 4),
(28, 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0, NULL, NULL, 5),
(29, 'Tidak Pernah', 100, NULL, NULL, 1),
(29, 'Ringan', 75, NULL, NULL, 2),
(29, 'Sedang', 50, NULL, NULL, 3),
(29, 'Berat', 25, NULL, NULL, 4),
(29, 'Sedang Menjalani', 0, NULL, NULL, 5);

-- ---------------------------------------------------------------------
-- MATCH_SCORE target 2 (Direktur Pengadaan): Irwan/Yatno/Iwan/Rus eligible
-- (S2), Ahmad TIDAK eligible (cuma S1) - demo persyaratan beda per target.
-- ---------------------------------------------------------------------
INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, computed_at) VALUES
(6, 2, 2, 100.00, 92.50, 100.00, 98.50, 1, 'Memenuhi syarat S2 & Administrator ke atas', '2026-07-30 09:00:00'),
(7, 3, 2, 100.00, 80.00, 100.00, 96.00, 1, 'Memenuhi syarat S2 & Administrator ke atas', '2026-07-30 09:00:00'),
(8, 4, 2, 93.47, 87.50, 100.00, 93.26, 1, 'Memenuhi syarat S2 & Administrator ke atas', '2026-07-30 09:00:00'),
(9, 1, 2, 100.00, 81.67, 100.00, 96.33, 1, 'Memenuhi syarat S2 & Administrator ke atas; lintas Unit Organisasi (eks Itjen) memperkuat keragaman jabatan', '2026-07-30 09:00:00'),
(10, 12, 2, 82.00, 75.83, 75.00, 79.72, 0, 'Skor tetap dihitung sbg referensi, namun TIDAK memenuhi syarat pendidikan minimal S2 (Ahmad Fauzi hanya S1) - eligible=0 shg tidak masuk talent_pool', '2026-07-30 09:00:00');

-- ---------------------------------------------------------------------
-- TALENT_POOL target 2 (hanya yang eligible; Ahmad tidak masuk pool)
-- ---------------------------------------------------------------------
INSERT INTO talent_pool (id, pegawai_id, jabatan_target_id, match_score_id, ranking, status, catatan_reviewer) VALUES
(6, 2, 2, 6, 1, 'KANDIDAT', 'Skor tertinggi lintas target; sudah ditetapkan sbg suksesor Kasubdit Pengadaan (target 1), dipertimbangkan jg utk jenjang Direktur jangka panjang'),
(7, 1, 2, 9, 2, 'KANDIDAT', 'Rekam jejak lintas unit organisasi (eks Itjen) jadi nilai tambah keragaman pengalaman'),
(8, 3, 2, 7, 3, 'KANDIDAT', NULL),
(9, 4, 2, 8, 4, 'KANDIDAT', NULL);

-- ---------------------------------------------------------------------
-- MATCH_SCORE + TALENT_POOL target 3 (BJKW): Rus, Yuliana, Ahmad
-- Catatan skor Yuliana: hukuman disiplin 'Sedang' tapi status_aktif=0
-- (sudah tidak berlaku) -> tidak menurunkan skor integritas (masih 100).
-- ---------------------------------------------------------------------
INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, computed_at) VALUES
(11, 1, 3, 100.00, 94.17, 100.00, 98.83, 1, 'Memenuhi syarat; bidang ilmu Teknik Transportasi relevan dgn konstruksi; sudah menjabat definitif di BJKW', '2026-07-30 09:00:00'),
(12, 15, 3, 97.00, 85.83, 100.00, 95.22, 1, 'Memenuhi syarat; Ahli Utama Teknik Konstruksi sangat relevan; riwayat hukuman disiplin Sedang sudah tidak aktif shg tidak menurunkan skor integritas; skor pengalaman jabatan struktural relatif rendah krn riwayat murni jalur fungsional', '2026-07-30 09:00:00'),
(13, 12, 3, 82.00, 88.33, 75.00, 82.22, 1, 'Memenuhi syarat; Teknik Sipil relevan; skor integritas tertahan akibat riwayat hukuman disiplin ringan yang masih aktif', '2026-07-30 09:00:00');

INSERT INTO talent_pool (id, pegawai_id, jabatan_target_id, match_score_id, ranking, status, catatan_reviewer) VALUES
(10, 1, 3, 11, 1, 'KANDIDAT', 'Incumbent BJKW Makassar berkinerja sangat baik, jadi benchmark kandidat lain'),
(11, 15, 3, 12, 2, 'DINOMINASIKAN', 'Kandidat jalur alih fungsional-ke-struktural, diajukan Direktorat Bina Kompetensi dan Produktivitas Konstruksi utk mengisi BJKW Surabaya'),
(12, 12, 3, 13, 3, 'KANDIDAT', 'Kandidat lintas fungsi dari BP2JK Sumsel');

INSERT INTO nominasi (id, talent_pool_id, diajukan_oleh_unit_id, diajukan_oleh_user_id, tanggal_diajukan, status, catatan) VALUES
(4, 11, 5, NULL, '2026-07-29', 'MENUNGGU_VERIFIKASI', 'Diajukan oleh Direktorat Bina Kompetensi dan Produktivitas Konstruksi sbg kandidat alih jalur fungsional ke struktural untuk BJKW Wilayah IV Surabaya');

INSERT INTO approval_log (nominasi_id, tahap, status, approver_user_id, catatan, tanggal_aksi) VALUES
(4, 'Verifikasi Kepegawaian', 'MENUNGGU', NULL, 'Menunggu telaah Bagian Kepegawaian dan Umum terkait kesesuaian jalur karier fungsional-ke-struktural', '2026-07-29 10:00:00');

-- ---------------------------------------------------------------------
-- Update AUTO_INCREMENT counters
-- ---------------------------------------------------------------------
ALTER TABLE jabatan AUTO_INCREMENT = 17;
ALTER TABLE jabatan_target AUTO_INCREMENT = 4;
ALTER TABLE rubrik_komponen AUTO_INCREMENT = 12;
ALTER TABLE rubrik_indikator AUTO_INCREMENT = 30;
ALTER TABLE match_score AUTO_INCREMENT = 14;
ALTER TABLE talent_pool AUTO_INCREMENT = 13;
ALTER TABLE nominasi AUTO_INCREMENT = 5;

SET FOREIGN_KEY_CHECKS = 1;
