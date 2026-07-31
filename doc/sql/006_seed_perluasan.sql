-- =====================================================================
-- SIMT DJBK - 006 Seed Perluasan Data Dev
--
-- DIHASILKAN OLEH scripts/gen-006-seed-perluasan.ts — jangan diedit tangan.
-- Regenerasi: npx tsx scripts/gen-006-seed-perluasan.ts
--
-- Tujuan (phase.md §4.2–4.3): membuat data dev cukup beragam untuk menguji
-- SEMUA cabang logika & keadaan UI:
--   * pegawai 16 -> 40, unit 17 -> 28, jabatan 16 -> 47
--   * KESEMBILAN sel Kotak 9 terisi (sebelumnya hanya 3 sel)
--   * riwayat jabatan BERTANGGAL -> indikator Lama Jabatan bisa otomatis
--   * ada Plt & Plh -> sub-indikator Substansi Riwayat Jabatan teruji
--   * kelima kategori hukuman disiplin terpakai
--   * nominasi mencakup jalur DISETUJUI, DITOLAK, dan REVISI
--   * log API punya kasus 401/403/429
--
-- URUTAN JALANKAN: 001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. Unit organisasi tambahan
-- ---------------------------------------------------------------------
INSERT INTO unit_organisasi (id, kode_unit, nama_unit, parent_id, jenis, level_eselon) VALUES
  (18, 'BP2JK-JABAR', 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Barat', 1, 'BP2JK', 3),
  (19, 'BP2JK-JATIM', 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Timur', 1, 'BP2JK', 3),
  (20, 'BP2JK-SULSEL', 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sulawesi Selatan', 1, 'BP2JK', 3),
  (21, 'BP2JK-KALTIM', 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Kalimantan Timur', 1, 'BP2JK', 3),
  (22, 'BP2JK-PAPUA', 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Papua', 1, 'BP2JK', 3),
  (23, 'BJKW-MDN', 'Balai Jasa Konstruksi Wilayah I Medan', 1, 'BALAI', 3),
  (24, 'BJKW-BJM', 'Balai Jasa Konstruksi Wilayah V Banjarmasin', 1, 'BALAI', 3),
  (25, 'SUBDIT-KELEMBAGAAN', 'Subdirektorat Kelembagaan dan Sumber Daya Konstruksi', 4, 'SUBDIT', 3),
  (26, 'SUBDIT-STANDAR', 'Subdirektorat Standar dan Materi Kompetensi', 5, 'SUBDIT', 3),
  (27, 'BAG-KEUANGAN', 'Bagian Keuangan dan Barang Milik Negara', 2, 'BAGIAN', 3),
  (28, 'BAG-PROGRAM', 'Bagian Program dan Evaluasi', 2, 'BAGIAN', 3);

-- ---------------------------------------------------------------------
-- 2. Jabatan tambahan
--    4 di antaranya berstatus KOSONG supaya widget
--    "Jabatan Kosong & Risiko Kekosongan" punya isi yang berarti
-- ---------------------------------------------------------------------
INSERT INTO jabatan (id, kode_jabatan, nama_jabatan, unit_organisasi_id, jenis_jabatan, jenjang, eselon, status_jabatan) VALUES
  (17, 'JAB-KABALAI-BP2JK-JABAR', 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Barat', 18, 'STRUKTURAL', 'Administrator', 'III', 'TERISI'),
  (18, 'JAB-KABALAI-BP2JK-JATIM', 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Timur', 19, 'STRUKTURAL', 'Administrator', 'III', 'TERISI'),
  (19, 'JAB-KABALAI-BP2JK-SULSEL', 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sulawesi Selatan', 20, 'STRUKTURAL', 'Administrator', 'III', 'KOSONG'),
  (20, 'JAB-KABALAI-BP2JK-KALTIM', 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Kalimantan Timur', 21, 'STRUKTURAL', 'Administrator', 'III', 'TERISI'),
  (21, 'JAB-KABALAI-BP2JK-PAPUA', 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Papua', 22, 'STRUKTURAL', 'Administrator', 'III', 'KOSONG'),
  (22, 'JAB-KABALAI-BJKW-MDN', 'Kepala Balai Jasa Konstruksi Wilayah I Medan', 23, 'STRUKTURAL', 'Administrator', 'III', 'TERISI'),
  (23, 'JAB-KABALAI-BJKW-BJM', 'Kepala Balai Jasa Konstruksi Wilayah V Banjarmasin', 24, 'STRUKTURAL', 'Administrator', 'III', 'KOSONG'),
  (24, 'JAB-KASUBDIT-KELEMBAGAAN', 'Kepala Subdirektorat Kelembagaan dan Sumber Daya Konstruksi', 25, 'STRUKTURAL', 'Administrator', 'III', 'TERISI'),
  (25, 'JAB-KASUBDIT-STANDAR', 'Kepala Subdirektorat Standar dan Materi Kompetensi', 26, 'STRUKTURAL', 'Administrator', 'III', 'KOSONG'),
  (26, 'JAB-KABAG-KEUANGAN', 'Kepala Bagian Keuangan dan Barang Milik Negara', 27, 'STRUKTURAL', 'Administrator', 'III', 'TERISI'),
  (27, 'JAB-KABAG-PROGRAM', 'Kepala Bagian Program dan Evaluasi', 28, 'STRUKTURAL', 'Administrator', 'III', 'TERISI'),
  (28, 'JAB-KASUBBAG-TU-JABAR', 'Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Barat', 18, 'STRUKTURAL', 'Pengawas', 'IV', 'TERISI'),
  (29, 'JAB-KASUBBAG-TU-JATIM', 'Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Timur', 19, 'STRUKTURAL', 'Pengawas', 'IV', 'TERISI'),
  (30, 'JAB-KASUBBAG-TU-MDN', 'Kepala Subbagian Umum dan Tata Usaha BJKW Wilayah I Medan', 23, 'STRUKTURAL', 'Pengawas', 'IV', 'TERISI'),
  (31, 'JAB-KASI-KELEMBAGAAN', 'Kepala Seksi Kelembagaan', 25, 'STRUKTURAL', 'Pengawas', 'IV', 'TERISI'),
  (32, 'JAB-KASI-STANDAR', 'Kepala Seksi Penyusunan Standar Kompetensi', 26, 'STRUKTURAL', 'Pengawas', 'IV', 'TERISI'),
  (33, 'JAB-KASI-KEUANGAN', 'Kepala Seksi Perbendaharaan', 27, 'STRUKTURAL', 'Pengawas', 'IV', 'TERISI'),
  (34, 'JAB-PJK-MADYA-KSP', 'Pembina Jasa Konstruksi Ahli Madya', 4, 'FUNGSIONAL_TERTENTU', 'Ahli Madya', 'NON_ESELON', 'TERISI'),
  (35, 'JAB-PJK-MADYA-BINKOM', 'Pembina Jasa Konstruksi Ahli Madya (Bina Kompetensi)', 5, 'FUNGSIONAL_TERTENTU', 'Ahli Madya', 'NON_ESELON', 'TERISI'),
  (36, 'JAB-PJK-MUDA-KSP', 'Pembina Jasa Konstruksi Ahli Muda (Kerja Sama)', 4, 'FUNGSIONAL_TERTENTU', 'Ahli Muda', 'NON_ESELON', 'TERISI'),
  (37, 'JAB-PJK-PERTAMA-STANDAR', 'Pembina Jasa Konstruksi Ahli Pertama (Standar Kompetensi)', 26, 'FUNGSIONAL_TERTENTU', 'Ahli Pertama', 'NON_ESELON', 'TERISI'),
  (38, 'JAB-PPBJ-MADYA', 'Pengelola Pengadaan Barang/Jasa Ahli Madya', 7, 'FUNGSIONAL_TERTENTU', 'Ahli Madya', 'NON_ESELON', 'TERISI'),
  (39, 'JAB-PPBJ-MUDA', 'Pengelola Pengadaan Barang/Jasa Ahli Muda', 7, 'FUNGSIONAL_TERTENTU', 'Ahli Muda', 'NON_ESELON', 'TERISI'),
  (40, 'JAB-PPBJ-MUDA-JABAR', 'Pengelola Pengadaan Barang/Jasa Ahli Muda BP2JK Jawa Barat', 18, 'FUNGSIONAL_TERTENTU', 'Ahli Muda', 'NON_ESELON', 'TERISI'),
  (41, 'JAB-ANALIS-SDM-PERTAMA', 'Analis Sumber Daya Manusia Aparatur Ahli Pertama', 6, 'FUNGSIONAL_TERTENTU', 'Ahli Pertama', 'NON_ESELON', 'TERISI'),
  (42, 'JAB-PERENCANA-MUDA', 'Perencana Ahli Muda', 28, 'FUNGSIONAL_TERTENTU', 'Ahli Muda', 'NON_ESELON', 'TERISI'),
  (43, 'JAB-ANALIS-KEUANGAN-MUDA', 'Analis Pengelolaan Keuangan APBN Ahli Muda', 27, 'FUNGSIONAL_TERTENTU', 'Ahli Muda', 'NON_ESELON', 'TERISI'),
  (44, 'JAB-PRANATA-KOMPUTER-MUDA', 'Pranata Komputer Ahli Muda', 6, 'FUNGSIONAL_TERTENTU', 'Ahli Muda', 'NON_ESELON', 'TERISI'),
  (45, 'JAB-ARSIPARIS-PERTAMA', 'Arsiparis Ahli Pertama', 6, 'FUNGSIONAL_TERTENTU', 'Ahli Pertama', 'NON_ESELON', 'TERISI'),
  (46, 'JAB-PENGADMIN-UMUM-JATIM', 'Pengadministrasi Umum BP2JK Wilayah Jawa Timur', 19, 'FUNGSIONAL_UMUM', 'Pelaksana', 'NON_ESELON', 'TERISI'),
  (47, 'JAB-PENGOLAH-DATA-SULSEL', 'Pengolah Data dan Informasi BP2JK Wilayah Sulawesi Selatan', 20, 'FUNGSIONAL_UMUM', 'Pelaksana', 'NON_ESELON', 'TERISI');

-- ---------------------------------------------------------------------
-- 3. Pegawai tambahan
--    NIP disusun valid (tanggal lahir + TMT CPNS + digit jenis kelamin)
--    dan sudah diuji oleh lib/nip.ts di dalam generator.
-- ---------------------------------------------------------------------
INSERT INTO pegawai (id, nip, nama_lengkap, golongan, tmt_golongan, pangkat, jabatan_id, tmt_jabatan, sekolah_terakhir, bidang_studi_terakhir, tingkat_pendidikan, status_aktif, sumber_sinkron, last_synced_at, riwayat_diklat) VALUES
  (17, '198102142006041002', 'Agus Purnomo', 'IV/a', '2021-04-01', 'Pembina', 17, '2022-03-01', 'Institut Teknologi Bandung', 'Teknik Sipil', 'S2', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Kepemimpinan Administrator","Sertifikasi Pengadaan Barang/Jasa Tingkat Lanjut","Diklat Manajemen Konstruksi"]'),
  (18, '198407252009122003', 'Ratna Dewi Sari', 'III/d', '2020-10-01', 'Penata Tingkat I', 38, '2021-06-01', 'Universitas Gadjah Mada', 'Manajemen Konstruksi', 'S2', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Sertifikasi Pengelola Pengadaan Barang/Jasa Ahli Madya","Diklat Kontrak Konstruksi"]'),
  (19, '197911032005021004', 'Bambang Wijaya', 'IV/a', '2020-04-01', 'Pembina', 18, '2020-09-01', 'Universitas Brawijaya', 'Teknik Sipil', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Kepemimpinan Administrator","Sertifikasi Pengadaan Barang/Jasa"]'),
  (20, '198606192010122004', 'Nur Aini Fitri', 'III/d', '2021-04-01', 'Penata Tingkat I', 35, '2022-01-03', 'Universitas Indonesia', 'Administrasi Publik', 'S2', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Pembinaan Kompetensi Konstruksi","Sertifikasi Asesor Kompetensi","Diklat Pengadaan Barang/Jasa"]'),
  (21, '198209152008011003', 'Teguh Wibowo', 'III/d', '2020-10-01', 'Penata Tingkat I', 20, '2023-02-01', 'Universitas Hasanuddin', 'Teknik Sipil', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Kepemimpinan Pengawas","Sertifikasi Pengadaan Barang/Jasa"]'),
  (22, '198812052012122002', 'Lestari Handayani', 'III/c', '2022-04-01', 'Penata', 39, '2023-08-01', 'Institut Teknologi Sepuluh Nopember', 'Manajemen Proyek Konstruksi', 'S2', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Sertifikasi Pengelola Pengadaan Barang/Jasa Ahli Muda","Diklat Manajemen Risiko Konstruksi"]'),
  (23, '198503282011011005', 'Joko Susilo', 'III/c', '2021-10-01', 'Penata', 36, '2022-05-02', 'Universitas Sriwijaya', 'Teknik Sipil', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Pemberdayaan Jasa Konstruksi"]'),
  (24, '198710142012122005', 'Maya Kusumawati', 'III/c', '2022-04-01', 'Penata', 41, '2023-01-02', 'Universitas Padjadjaran', 'Ilmu Administrasi Negara', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Manajemen Kepegawaian"]'),
  (25, '198611232010121006', 'Andi Setiawan', 'III/c', '2021-10-01', 'Penata', 31, '2022-08-01', 'Universitas Tadulako', 'Teknik Sipil', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Kepemimpinan Pengawas","Diklat Kelembagaan Konstruksi"]'),
  (26, '198305172009122006', 'Sri Wahyuni', 'III/d', '2020-10-01', 'Penata Tingkat I', 43, '2021-04-01', 'Universitas Diponegoro', 'Manajemen Keuangan', 'S2', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Pengelolaan Keuangan Negara","Diklat Bendahara Pengeluaran"]'),
  (27, '199003082015011007', 'Dedi Kurniadi', 'III/b', '2022-04-01', 'Penata Muda Tingkat I', 44, '2024-01-02', 'Universitas Lampung', 'Teknik Informatika', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Tata Kelola Teknologi Informasi"]'),
  (28, '197806232003122002', 'Ika Puspita', 'IV/a', '2019-04-01', 'Pembina', 27, '2020-02-03', 'Universitas Negeri Semarang', 'Manajemen Pendidikan', 'S2', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Kepemimpinan Administrator","Diklat Perencanaan Program"]'),
  (29, '198901172014021008', 'Fajar Nugroho', 'III/b', '2022-04-01', 'Penata Muda Tingkat I', 37, '2023-05-02', 'Politeknik Negeri Jakarta', 'Teknik Konstruksi Sipil', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Dasar Jabatan Fungsional Pembina Jasa Konstruksi"]'),
  (30, '198002112004122003', 'Wulan Sari Utami', 'IV/a', '2019-10-01', 'Pembina', 26, '2021-01-04', 'Universitas Gadjah Mada', 'Ilmu Hukum', 'S2', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Kepemimpinan Administrator","Diklat Hukum Kontrak Pemerintah"]'),
  (31, '198404092009011009', 'Herman Saputra', 'III/d', '2020-04-01', 'Penata Tingkat I', 22, '2023-09-01', 'Universitas Sumatera Utara', 'Teknik Sipil', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Kepemimpinan Pengawas"]'),
  (32, '199105292015122008', 'Rina Marlina', 'III/b', '2022-10-01', 'Penata Muda Tingkat I', 40, '2024-03-01', 'Universitas Andalas', 'Teknik Lingkungan', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Sertifikasi Pengadaan Barang/Jasa Tingkat Dasar"]'),
  (33, '198707142012021010', 'Slamet Riyadi', 'III/b', '2022-04-01', 'Penata Muda Tingkat I', 46, '2022-04-01', 'Politeknik Negeri Semarang', 'Teknik Sipil', 'D3', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '[]'),
  (34, '198909022014122009', 'Diah Permatasari', 'III/b', '2022-10-01', 'Penata Muda Tingkat I', 29, '2023-06-01', 'Universitas Negeri Malang', 'Pendidikan Teknik Bangunan', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Kearsipan Dasar"]'),
  (35, '198205062006041011', 'Gunawan Hidayat', 'III/d', '2020-10-01', 'Penata Tingkat I', 28, '2022-03-01', 'Universitas Mulawarman', 'Teknik Sipil', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Kepemimpinan Pengawas"]'),
  (36, '199206112016122010', 'Novi Anggraeni', 'III/a', '2020-04-01', 'Penata Muda', 47, '2020-04-01', 'Universitas Negeri Makassar', 'Administrasi Perkantoran', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Dasar Pengelolaan Data"]'),
  (37, '198611052011011012', 'Eko Prasetyo', 'III/c', '2021-10-01', 'Penata', 42, '2022-11-01', 'Universitas Jember', 'Ekonomi Pembangunan', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Perencanaan dan Penganggaran"]'),
  (38, '199308232017122011', 'Yuni Astuti', 'III/a', '2021-04-01', 'Penata Muda', 45, '2021-04-01', 'Universitas Negeri Surabaya', 'Manajemen', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '[]'),
  (39, '198512142010011013', 'Rudi Hartono', 'III/b', '2021-04-01', 'Penata Muda Tingkat I', 32, '2024-06-03', 'SMK Negeri 2 Palembang', 'Teknik Bangunan', 'SLTA', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '[]'),
  (40, '199410072018122012', 'Citra Ayu Lestari', 'III/a', '2022-04-01', 'Penata Muda', 34, '2025-01-02', 'Universitas Udayana', 'Teknik Sipil', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '["Diklat Dasar Jabatan Fungsional Pembina Jasa Konstruksi"]');

-- ---------------------------------------------------------------------
-- 4. Riwayat jabatan pegawai baru — BERTANGGAL
--    jabatan_id NULL = jabatan di luar master DJBK (dipakai indikator
--    Keragaman Riwayat Jabatan, lihat lib/penilaian.ts)
-- ---------------------------------------------------------------------
INSERT INTO riwayat_jabatan (pegawai_id, urutan, jabatan_nama_mentah, jabatan_id, tanggal_mulai, tanggal_akhir, no_sk) VALUES
  (17, 1, 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Barat', 17, '2022-03-01', NULL, 'SK-2022/DJBK/017-1'),
  (17, 2, 'Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Barat', 28, '2017-05-01', '2022-03-01', 'SK-2017/DJBK/017-2'),
  (17, 3, 'Staf Teknis Dinas Pekerjaan Umum Provinsi Jawa Barat', NULL, '2010-01-01', '2017-05-01', 'SK-2010/DJBK/017-3'),
  (18, 1, 'Pengelola Pengadaan Barang/Jasa Ahli Madya, Subdirektorat Pengadaan', 38, '2021-06-01', NULL, 'SK-2021/DJBK/018-1'),
  (18, 2, 'Pengelola Pengadaan Barang/Jasa Ahli Muda, Subdirektorat Pengadaan', 39, '2016-04-01', '2021-06-01', 'SK-2016/DJBK/018-2'),
  (19, 1, 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Timur', 18, '2020-09-01', NULL, 'SK-2020/DJBK/019-1'),
  (19, 2, 'Plt Kepala Balai Jasa Konstruksi Wilayah V Banjarmasin', 23, '2019-02-01', '2020-09-01', 'SK-2019/DJBK/019-2'),
  (19, 3, 'Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Timur', 29, '2014-07-01', '2019-02-01', 'SK-2014/DJBK/019-3'),
  (20, 1, 'Pembina Jasa Konstruksi Ahli Madya, Direktorat Bina Kompetensi dan Produktivitas Konstruksi', 35, '2022-01-03', NULL, 'SK-2022/DJBK/020-1'),
  (20, 2, 'Pembina Jasa Konstruksi Ahli Muda, Subdirektorat Standar dan Materi Kompetensi', 37, '2016-02-01', '2022-01-03', 'SK-2016/DJBK/020-2'),
  (21, 1, 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Kalimantan Timur', 20, '2023-02-01', NULL, 'SK-2023/DJBK/021-1'),
  (21, 2, 'Kepala Seksi Perbendaharaan, Bagian Keuangan dan Barang Milik Negara', 33, '2018-03-01', '2023-02-01', 'SK-2018/DJBK/021-2'),
  (22, 1, 'Pengelola Pengadaan Barang/Jasa Ahli Muda, Subdirektorat Pengadaan', 39, '2023-08-01', NULL, 'SK-2023/DJBK/022-1'),
  (22, 2, 'Pengelola Pengadaan Barang/Jasa Ahli Pertama, Subdirektorat Pengadaan', NULL, '2018-01-02', '2023-08-01', 'SK-2018/DJBK/022-2'),
  (23, 1, 'Pembina Jasa Konstruksi Ahli Muda, Direktorat Kerja Sama dan Pemberdayaan', 36, '2022-05-02', NULL, 'SK-2022/DJBK/023-1'),
  (23, 2, 'Pembina Jasa Konstruksi Ahli Pertama, Direktorat Kerja Sama dan Pemberdayaan', NULL, '2017-03-01', '2022-05-02', 'SK-2017/DJBK/023-2'),
  (24, 1, 'Analis Sumber Daya Manusia Aparatur Ahli Pertama, Bagian Kepegawaian dan Umum', 41, '2023-01-02', NULL, 'SK-2023/DJBK/024-1'),
  (24, 2, 'Pengadministrasi Kepegawaian, Bagian Kepegawaian dan Umum', NULL, '2016-05-01', '2023-01-02', 'SK-2016/DJBK/024-2'),
  (25, 1, 'Kepala Seksi Kelembagaan, Subdirektorat Kelembagaan dan Sumber Daya Konstruksi', 31, '2022-08-01', NULL, 'SK-2022/DJBK/025-1'),
  (25, 2, 'Plh Kepala Seksi Penyusunan Standar Kompetensi', 32, '2021-02-01', '2022-08-01', 'SK-2021/DJBK/025-2'),
  (25, 3, 'Pengolah Data Direktorat Kerja Sama dan Pemberdayaan', NULL, '2015-01-05', '2021-02-01', 'SK-2015/DJBK/025-3'),
  (26, 1, 'Analis Pengelolaan Keuangan APBN Ahli Muda, Bagian Keuangan dan Barang Milik Negara', 43, '2021-04-01', NULL, 'SK-2021/DJBK/026-1'),
  (26, 2, 'Bendahara Pengeluaran Sekretariat Direktorat Jenderal Bina Konstruksi', NULL, '2014-02-01', '2021-04-01', 'SK-2014/DJBK/026-2'),
  (27, 1, 'Pranata Komputer Ahli Muda, Bagian Kepegawaian dan Umum', 44, '2024-01-02', NULL, 'SK-2024/DJBK/027-1'),
  (27, 2, 'Pranata Komputer Ahli Pertama, Bagian Kepegawaian dan Umum', NULL, '2019-03-01', '2024-01-02', 'SK-2019/DJBK/027-2'),
  (28, 1, 'Kepala Bagian Program dan Evaluasi, Sekretariat Direktorat Jenderal Bina Konstruksi', 27, '2020-02-03', NULL, 'SK-2020/DJBK/028-1'),
  (28, 2, 'Kepala Seksi Perbendaharaan, Bagian Keuangan dan Barang Milik Negara', 33, '2013-06-01', '2020-02-03', 'SK-2013/DJBK/028-2'),
  (29, 1, 'Pembina Jasa Konstruksi Ahli Pertama, Subdirektorat Standar dan Materi Kompetensi', 37, '2023-05-02', NULL, 'SK-2023/DJBK/029-1'),
  (29, 2, 'Pengolah Data dan Informasi, Direktorat Bina Kompetensi dan Produktivitas Konstruksi', NULL, '2018-02-01', '2023-05-02', 'SK-2018/DJBK/029-2'),
  (30, 1, 'Kepala Bagian Keuangan dan Barang Milik Negara, Sekretariat Direktorat Jenderal Bina Konstruksi', 26, '2021-01-04', NULL, 'SK-2021/DJBK/030-1'),
  (30, 2, 'Kepala Bagian Hukum dan Kepatuhan, Sekretariat Jenderal Kementerian PUPR', NULL, '2015-08-01', '2021-01-04', 'SK-2015/DJBK/030-2'),
  (31, 1, 'Kepala Balai Jasa Konstruksi Wilayah I Medan', 22, '2023-09-01', NULL, 'SK-2023/DJBK/031-1'),
  (31, 2, 'Kepala Subbagian Umum dan Tata Usaha BJKW Wilayah I Medan', 30, '2017-04-01', '2023-09-01', 'SK-2017/DJBK/031-2'),
  (32, 1, 'Pengelola Pengadaan Barang/Jasa Ahli Muda BP2JK Jawa Barat', 40, '2024-03-01', NULL, 'SK-2024/DJBK/032-1'),
  (32, 2, 'Pengadministrasi Umum BP2JK Wilayah Jawa Barat', NULL, '2019-02-01', '2024-03-01', 'SK-2019/DJBK/032-2'),
  (33, 1, 'Pengadministrasi Umum BP2JK Wilayah Jawa Timur', 46, '2022-04-01', NULL, 'SK-2022/DJBK/033-1'),
  (34, 1, 'Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Timur', 29, '2023-06-01', NULL, 'SK-2023/DJBK/034-1'),
  (34, 2, 'Pengadministrasi Umum BP2JK Wilayah Jawa Timur', NULL, '2018-05-01', '2023-06-01', 'SK-2018/DJBK/034-2'),
  (35, 1, 'Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Barat', 28, '2022-03-01', NULL, 'SK-2022/DJBK/035-1'),
  (35, 2, 'Pengolah Data dan Informasi BP2JK Wilayah Kalimantan Timur', NULL, '2013-01-02', '2022-03-01', 'SK-2013/DJBK/035-2'),
  (36, 1, 'Pengolah Data dan Informasi BP2JK Wilayah Sulawesi Selatan', 47, '2020-04-01', NULL, 'SK-2020/DJBK/036-1'),
  (37, 1, 'Perencana Ahli Muda, Bagian Program dan Evaluasi', 42, '2022-11-01', NULL, 'SK-2022/DJBK/037-1'),
  (37, 2, 'Perencana Ahli Pertama, Bagian Program dan Evaluasi', NULL, '2017-01-03', '2022-11-01', 'SK-2017/DJBK/037-2'),
  (38, 1, 'Arsiparis Ahli Pertama, Bagian Kepegawaian dan Umum', 45, '2021-04-01', NULL, 'SK-2021/DJBK/038-1'),
  (39, 1, 'Kepala Seksi Penyusunan Standar Kompetensi, Subdirektorat Standar dan Materi Kompetensi', 32, '2024-06-03', NULL, 'SK-2024/DJBK/039-1'),
  (39, 2, 'Pengadministrasi Umum Direktorat Bina Kompetensi dan Produktivitas Konstruksi', NULL, '2014-01-02', '2024-06-03', 'SK-2014/DJBK/039-2'),
  (40, 1, 'Pembina Jasa Konstruksi Ahli Madya, Direktorat Kerja Sama dan Pemberdayaan', 34, '2025-01-02', NULL, 'SK-2025/DJBK/040-1');

-- ---------------------------------------------------------------------
-- 5. Riwayat pendidikan pegawai baru
--    Arsip (ijazah/pertek BKN) sengaja hanya terisi SEBAGIAN supaya UI
--    teruji di dua keadaan: ada arsip dan belum ada arsip.
-- ---------------------------------------------------------------------
INSERT INTO riwayat_pendidikan (pegawai_id, urutan, jenjang_pendidikan, bidang_studi, nama_sekolah, tahun_lulus, url_ijazah, url_transkrip, no_pertek_bkn) VALUES
  (17, 1, 'S2', 'Teknik Sipil', 'Institut Teknologi Bandung', 2015, '/arsip/ijazah/198102142006041002-1.pdf', '/arsip/transkrip/198102142006041002-1.pdf', 'PERTEK/BKN/2015/0017'),
  (17, 2, 'S1_D4', 'Teknik Sipil', 'Universitas Diponegoro', 2005, NULL, NULL, NULL),
  (18, 1, 'S2', 'Manajemen Konstruksi', 'Universitas Gadjah Mada', 2016, '/arsip/ijazah/198407252009122003-1.pdf', '/arsip/transkrip/198407252009122003-1.pdf', 'PERTEK/BKN/2016/0018'),
  (18, 2, 'S1_D4', 'Teknik Sipil', 'Universitas Sebelas Maret', 2008, '/arsip/ijazah/198407252009122003-2.pdf', '/arsip/transkrip/198407252009122003-2.pdf', 'PERTEK/BKN/2008/0018'),
  (19, 1, 'S1_D4', 'Teknik Sipil', 'Universitas Brawijaya', 2003, '/arsip/ijazah/197911032005021004-1.pdf', '/arsip/transkrip/197911032005021004-1.pdf', 'PERTEK/BKN/2003/0019'),
  (20, 1, 'S2', 'Administrasi Publik', 'Universitas Indonesia', 2018, '/arsip/ijazah/198606192010122004-1.pdf', '/arsip/transkrip/198606192010122004-1.pdf', 'PERTEK/BKN/2018/0020'),
  (20, 2, 'S1_D4', 'Pendidikan Teknik Bangunan', 'Universitas Negeri Yogyakarta', 2008, NULL, NULL, NULL),
  (21, 1, 'S1_D4', 'Teknik Sipil', 'Universitas Hasanuddin', 2006, '/arsip/ijazah/198209152008011003-1.pdf', '/arsip/transkrip/198209152008011003-1.pdf', 'PERTEK/BKN/2006/0021'),
  (22, 1, 'S2', 'Manajemen Proyek Konstruksi', 'Institut Teknologi Sepuluh Nopember', 2019, '/arsip/ijazah/198812052012122002-1.pdf', '/arsip/transkrip/198812052012122002-1.pdf', 'PERTEK/BKN/2019/0022'),
  (22, 2, 'S1_D4', 'Teknik Sipil', 'Universitas Airlangga', 2011, NULL, NULL, NULL),
  (23, 1, 'S1_D4', 'Teknik Sipil', 'Universitas Sriwijaya', 2009, NULL, NULL, NULL),
  (24, 1, 'S1_D4', 'Ilmu Administrasi Negara', 'Universitas Padjadjaran', 2010, '/arsip/ijazah/198710142012122005-1.pdf', '/arsip/transkrip/198710142012122005-1.pdf', 'PERTEK/BKN/2010/0024'),
  (25, 1, 'S1_D4', 'Teknik Sipil', 'Universitas Tadulako', 2009, NULL, NULL, NULL),
  (26, 1, 'S2', 'Manajemen Keuangan', 'Universitas Diponegoro', 2017, '/arsip/ijazah/198305172009122006-1.pdf', '/arsip/transkrip/198305172009122006-1.pdf', 'PERTEK/BKN/2017/0026'),
  (26, 2, 'S1_D4', 'Akuntansi', 'Universitas Jenderal Soedirman', 2007, '/arsip/ijazah/198305172009122006-2.pdf', '/arsip/transkrip/198305172009122006-2.pdf', 'PERTEK/BKN/2007/0026'),
  (27, 1, 'S1_D4', 'Teknik Informatika', 'Universitas Lampung', 2013, NULL, NULL, NULL),
  (28, 1, 'S2', 'Manajemen Pendidikan', 'Universitas Negeri Semarang', 2012, '/arsip/ijazah/197806232003122002-1.pdf', '/arsip/transkrip/197806232003122002-1.pdf', 'PERTEK/BKN/2012/0028'),
  (28, 2, 'S1_D4', 'Pendidikan Ekonomi', 'Universitas Negeri Semarang', 2001, NULL, NULL, NULL),
  (29, 1, 'S1_D4', 'Teknik Konstruksi Sipil', 'Politeknik Negeri Jakarta', 2012, NULL, NULL, NULL),
  (30, 1, 'S2', 'Ilmu Hukum', 'Universitas Gadjah Mada', 2011, '/arsip/ijazah/198002112004122003-1.pdf', '/arsip/transkrip/198002112004122003-1.pdf', 'PERTEK/BKN/2011/0030'),
  (30, 2, 'S1_D4', 'Ilmu Hukum', 'Universitas Gadjah Mada', 2002, '/arsip/ijazah/198002112004122003-2.pdf', '/arsip/transkrip/198002112004122003-2.pdf', 'PERTEK/BKN/2002/0030'),
  (31, 1, 'S1_D4', 'Teknik Sipil', 'Universitas Sumatera Utara', 2007, NULL, NULL, NULL),
  (32, 1, 'S1_D4', 'Teknik Lingkungan', 'Universitas Andalas', 2014, NULL, NULL, NULL),
  (33, 1, 'D3', 'Teknik Sipil', 'Politeknik Negeri Semarang', 2010, NULL, NULL, NULL),
  (34, 1, 'S1_D4', 'Pendidikan Teknik Bangunan', 'Universitas Negeri Malang', 2013, NULL, NULL, NULL),
  (35, 1, 'S1_D4', 'Teknik Sipil', 'Universitas Mulawarman', 2005, NULL, NULL, NULL),
  (36, 1, 'S1_D4', 'Administrasi Perkantoran', 'Universitas Negeri Makassar', 2015, NULL, NULL, NULL),
  (37, 1, 'S1_D4', 'Ekonomi Pembangunan', 'Universitas Jember', 2010, '/arsip/ijazah/198611052011011012-1.pdf', '/arsip/transkrip/198611052011011012-1.pdf', 'PERTEK/BKN/2010/0037'),
  (38, 1, 'S1_D4', 'Manajemen', 'Universitas Negeri Surabaya', 2016, NULL, NULL, NULL),
  (39, 1, 'SLTA', 'Teknik Bangunan', 'SMK Negeri 2 Palembang', 2004, NULL, NULL, NULL),
  (40, 1, 'S1_D4', 'Teknik Sipil', 'Universitas Udayana', 2017, NULL, NULL, NULL);

-- ---------------------------------------------------------------------
-- 6. Kinerja per triwulan pegawai baru (TW1..TAHUNAN lengkap)
--    Nilai numerik dibuat konsisten dengan predikatnya. Untuk grafik tren
--    dipakai kolom nilai_kinerja ini (granular), BUKAN nilai_kinerja_y
--    yang hanya punya 5 nilai diskrit (phase.md §3 K-1).
-- ---------------------------------------------------------------------
INSERT INTO kinerja_periode (pegawai_id, tahun, periode_skp, nilai_kinerja, nilai_perilaku, predikat, sumber_sync, synced_at) VALUES
  (17, 2025, 'TW1', 68.00, 69.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (17, 2025, 'TW2', 70.00, 71.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (17, 2025, 'TW3', 72.00, 73.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (17, 2025, 'TAHUNAN', 74.00, 75.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (18, 2025, 'TW1', 68.00, 69.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (18, 2025, 'TW2', 70.00, 71.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (18, 2025, 'TW3', 72.00, 73.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (18, 2025, 'TAHUNAN', 74.00, 75.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (19, 2025, 'TW1', 68.00, 69.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (19, 2025, 'TW2', 70.00, 71.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (19, 2025, 'TW3', 72.00, 73.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (19, 2025, 'TAHUNAN', 74.00, 75.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (20, 2025, 'TW1', 68.00, 69.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (20, 2025, 'TW2', 70.00, 71.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (20, 2025, 'TW3', 72.00, 73.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (20, 2025, 'TAHUNAN', 74.00, 75.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (21, 2025, 'TW1', 80.00, 81.00, 'Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (21, 2025, 'TW2', 82.00, 83.00, 'Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (21, 2025, 'TW3', 83.00, 84.00, 'Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (21, 2025, 'TAHUNAN', 85.00, 86.00, 'Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (22, 2025, 'TW1', 52.00, 53.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (22, 2025, 'TW2', 54.00, 55.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (22, 2025, 'TW3', 55.00, 56.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (22, 2025, 'TAHUNAN', 57.00, 58.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (23, 2025, 'TW1', 52.00, 53.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (23, 2025, 'TW2', 54.00, 55.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (23, 2025, 'TW3', 55.00, 56.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (23, 2025, 'TAHUNAN', 57.00, 58.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (24, 2025, 'TW1', 68.00, 69.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (24, 2025, 'TW2', 70.00, 71.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (24, 2025, 'TW3', 72.00, 73.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (24, 2025, 'TAHUNAN', 74.00, 75.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (25, 2025, 'TW1', 68.00, 69.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (25, 2025, 'TW2', 70.00, 71.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (25, 2025, 'TW3', 72.00, 73.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (25, 2025, 'TAHUNAN', 74.00, 75.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (26, 2025, 'TW1', 68.00, 69.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (26, 2025, 'TW2', 70.00, 71.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (26, 2025, 'TW3', 72.00, 73.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (26, 2025, 'TAHUNAN', 74.00, 75.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (27, 2025, 'TW1', 68.00, 69.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (27, 2025, 'TW2', 70.00, 71.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (27, 2025, 'TW3', 72.00, 73.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (27, 2025, 'TAHUNAN', 74.00, 75.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (28, 2025, 'TW1', 92.00, 93.00, 'Sangat Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (28, 2025, 'TW2', 94.00, 95.00, 'Sangat Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (28, 2025, 'TW3', 96.00, 97.00, 'Sangat Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (28, 2025, 'TAHUNAN', 97.00, 98.00, 'Sangat Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (29, 2025, 'TW1', 80.00, 81.00, 'Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (29, 2025, 'TW2', 82.00, 83.00, 'Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (29, 2025, 'TW3', 83.00, 84.00, 'Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (29, 2025, 'TAHUNAN', 85.00, 86.00, 'Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (30, 2025, 'TW1', 92.00, 93.00, 'Sangat Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (30, 2025, 'TW2', 94.00, 95.00, 'Sangat Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (30, 2025, 'TW3', 96.00, 97.00, 'Sangat Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (30, 2025, 'TAHUNAN', 97.00, 98.00, 'Sangat Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (31, 2025, 'TW1', 80.00, 81.00, 'Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (31, 2025, 'TW2', 82.00, 83.00, 'Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (31, 2025, 'TW3', 83.00, 84.00, 'Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (31, 2025, 'TAHUNAN', 85.00, 86.00, 'Baik', 'eKinerja', '2026-01-15 09:00:00'),
  (32, 2025, 'TW1', 52.00, 53.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (32, 2025, 'TW2', 54.00, 55.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (32, 2025, 'TW3', 55.00, 56.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (32, 2025, 'TAHUNAN', 57.00, 58.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (33, 2025, 'TW1', 38.00, 39.00, 'Sangat Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (33, 2025, 'TW2', 40.00, 41.00, 'Sangat Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (33, 2025, 'TW3', 41.00, 42.00, 'Sangat Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (33, 2025, 'TAHUNAN', 42.00, 43.00, 'Sangat Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (34, 2025, 'TW1', 68.00, 69.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (34, 2025, 'TW2', 70.00, 71.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (34, 2025, 'TW3', 72.00, 73.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (34, 2025, 'TAHUNAN', 74.00, 75.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (35, 2025, 'TW1', 68.00, 69.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (35, 2025, 'TW2', 70.00, 71.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (35, 2025, 'TW3', 72.00, 73.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (35, 2025, 'TAHUNAN', 74.00, 75.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (36, 2025, 'TW1', 68.00, 69.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (36, 2025, 'TW2', 70.00, 71.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (36, 2025, 'TW3', 72.00, 73.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (36, 2025, 'TAHUNAN', 74.00, 75.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (37, 2025, 'TW1', 68.00, 69.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (37, 2025, 'TW2', 70.00, 71.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (37, 2025, 'TW3', 72.00, 73.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (37, 2025, 'TAHUNAN', 74.00, 75.00, 'Butuh Perbaikan', 'eKinerja', '2026-01-15 09:00:00'),
  (38, 2025, 'TW1', 52.00, 53.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (38, 2025, 'TW2', 54.00, 55.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (38, 2025, 'TW3', 55.00, 56.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (38, 2025, 'TAHUNAN', 57.00, 58.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (39, 2025, 'TW1', 38.00, 39.00, 'Sangat Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (39, 2025, 'TW2', 40.00, 41.00, 'Sangat Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (39, 2025, 'TW3', 41.00, 42.00, 'Sangat Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (39, 2025, 'TAHUNAN', 42.00, 43.00, 'Sangat Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (40, 2025, 'TW1', 52.00, 53.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (40, 2025, 'TW2', 54.00, 55.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (40, 2025, 'TW3', 55.00, 56.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00'),
  (40, 2025, 'TAHUNAN', 57.00, 58.00, 'Kurang', 'eKinerja', '2026-01-15 09:00:00');

-- ---------------------------------------------------------------------
-- 7. Asesmen talenta pegawai baru
--    kotak_9 & status_asesmen DIHITUNG lib/scoring di dalam generator —
--    bukan placeholder — supaya laporan "selisih kotak_9 vs sumber" di 007
--    hanya menunjukkan selisih NYATA (kasus Tasya & Tina dari data contoh),
--    bukan selisih palsu buatan seed sendiri.
--    nilai_kinerja_y / nilai_potensial_x / nilai_talenta / nilai_integritas
--    diisi 0 dulu (kolomnya NOT NULL) dan dihitung ulang di 007.
-- ---------------------------------------------------------------------
INSERT INTO asesmen_talenta (pegawai_id, tahun_asesmen, jenis_asesmen, status_asesmen, nilai_kinerja_y, nilai_potensial_x, potkom, nilai_integritas, nilai_talenta, kotak_9, tahun_kinerja, rating_kinerja, sumber_sync) VALUES
  (17, 2025, 'Administrator', 'Berlaku', 0, 0, 85.00, 0, 0, 8, 2025, 'Butuh Perbaikan', 'eNominasi'),
  (18, 2025, 'JFT Madya', 'Berlaku', 0, 0, 88.00, 0, 0, 8, 2025, 'Butuh Perbaikan', 'eNominasi'),
  (19, 2024, 'Administrator', 'Berlaku', 0, 0, 82.00, 0, 0, 8, 2025, 'Butuh Perbaikan', 'eNominasi'),
  (20, 2026, 'JFT Madya', 'Berlaku', 0, 0, 91.00, 0, 0, 8, 2025, 'Butuh Perbaikan', 'eNominasi'),
  (21, 2025, 'Administrator', 'Berlaku', 0, 0, 74.00, 0, 0, 7, 2025, 'Baik', 'eNominasi'),
  (22, 2025, 'JFT Muda', 'Berlaku', 0, 0, 86.00, 0, 0, 6, 2025, 'Kurang', 'eNominasi'),
  (23, 2024, 'JFT Muda', 'Berlaku', 0, 0, 83.00, 0, 0, 6, 2025, 'Kurang', 'eNominasi'),
  (24, 2025, 'JFT Pertama', 'Berlaku', 0, 0, 72.00, 0, 0, 5, 2025, 'Butuh Perbaikan', 'eNominasi'),
  (25, 2024, 'Pengawas', 'Berlaku', 0, 0, 68.00, 0, 0, 5, 2025, 'Butuh Perbaikan', 'eNominasi'),
  (26, 2025, 'JFT Muda', 'Berlaku', 0, 0, 76.00, 0, 0, 5, 2025, 'Butuh Perbaikan', 'eNominasi'),
  (27, 2026, 'JFT Muda', 'Berlaku', 0, 0, 63.00, 0, 0, 5, 2025, 'Butuh Perbaikan', 'eNominasi'),
  (28, 2025, 'Administrator', 'Berlaku', 0, 0, 55.00, 0, 0, 4, 2025, 'Sangat Baik', 'eNominasi'),
  (29, 2025, 'JFT Pertama', 'Berlaku', 0, 0, 48.00, 0, 0, 4, 2025, 'Baik', 'eNominasi'),
  (30, 2024, 'Administrator', 'Berlaku', 0, 0, 52.00, 0, 0, 4, 2025, 'Sangat Baik', 'eNominasi'),
  (31, 2025, 'Administrator', 'Berlaku', 0, 0, 57.00, 0, 0, 4, 2025, 'Baik', 'eNominasi'),
  (32, 2025, 'JFT Muda', 'Berlaku', 0, 0, 66.00, 0, 0, 3, 2025, 'Kurang', 'eNominasi'),
  (33, 2024, 'Pelaksana', 'Berlaku', 0, 0, 71.00, 0, 0, 3, 2025, 'Sangat Kurang', 'eNominasi'),
  (34, 2025, 'Pengawas', 'Berlaku', 0, 0, 54.00, 0, 0, 2, 2025, 'Butuh Perbaikan', 'eNominasi'),
  (35, 2024, 'Pengawas', 'Berlaku', 0, 0, 47.00, 0, 0, 2, 2025, 'Butuh Perbaikan', 'eNominasi'),
  (36, 2025, 'Pelaksana', 'Berlaku', 0, 0, 58.00, 0, 0, 2, 2025, 'Butuh Perbaikan', 'eNominasi'),
  (37, 2026, 'JFT Muda', 'Berlaku', 0, 0, 51.00, 0, 0, 2, 2025, 'Butuh Perbaikan', 'eNominasi'),
  (38, 2025, 'JFT Pertama', 'Berlaku', 0, 0, 44.00, 0, 0, 1, 2025, 'Kurang', 'eNominasi'),
  (39, 2024, 'Pengawas', 'Berlaku', 0, 0, 38.00, 0, 0, 1, 2025, 'Sangat Kurang', 'eNominasi'),
  (40, 2026, 'JFT Madya', 'Berlaku', 0, 0, 56.00, 0, 0, 1, 2025, 'Kurang', 'eNominasi');

-- ---------------------------------------------------------------------
-- 8. Lengkapi data 16 pegawai lama
-- ---------------------------------------------------------------------

-- 8a. Riwayat jabatan lama belum punya tanggal sama sekali (35/35 NULL),
--     sehingga indikator Lama Jabatan tidak bisa dihitung. Tanggal di
--     bawah SINTETIS: urutan 1 = jabatan sekarang (mulai = tmt_jabatan),
--     urutan berikutnya blok 3 tahun ke belakang.
UPDATE riwayat_jabatan r JOIN pegawai p ON p.id = r.pegawai_id
SET r.tanggal_mulai = p.tmt_jabatan, r.tanggal_akhir = NULL
WHERE r.urutan = 1 AND r.pegawai_id < 17 AND r.tanggal_mulai IS NULL;

UPDATE riwayat_jabatan r JOIN pegawai p ON p.id = r.pegawai_id
SET r.tanggal_mulai = DATE_SUB(p.tmt_jabatan, INTERVAL ((r.urutan - 1) * 3) YEAR),
    r.tanggal_akhir = DATE_SUB(p.tmt_jabatan, INTERVAL ((r.urutan - 2) * 3) YEAR)
WHERE r.urutan > 1 AND r.pegawai_id < 17 AND r.tanggal_mulai IS NULL;

UPDATE riwayat_jabatan
SET no_sk = CONCAT('SK-', YEAR(tanggal_mulai), '/DJBK/', LPAD(id, 4, '0'))
WHERE no_sk IS NULL AND tanggal_mulai IS NOT NULL;

-- 8b. Petakan riwayat lama ke master jabatan yang baru tersedia, supaya
--     indikator Keragaman Riwayat Jabatan tidak salah membaca "belum
--     terpetakan" sebagai "pengalaman di luar DJBK".
UPDATE riwayat_jabatan SET jabatan_id = (SELECT id FROM jabatan WHERE kode_jabatan = 'JAB-KABALAI-BP2JK-JABAR')
WHERE jabatan_id IS NULL AND jabatan_nama_mentah LIKE '%Pemilihan Jasa Konstruksi Wilayah Jawa Barat%';

UPDATE riwayat_jabatan SET jabatan_id = (SELECT id FROM jabatan WHERE kode_jabatan = 'JAB-KABALAI-BJKW-SBY')
WHERE jabatan_id IS NULL AND jabatan_nama_mentah LIKE '%Balai Jasa Konstruksi Wilayah IV Surabaya%';

UPDATE riwayat_jabatan SET jabatan_id = (SELECT id FROM jabatan WHERE kode_jabatan = 'JAB-KASUBBAG-TU-MALUT')
WHERE jabatan_id IS NULL AND jabatan_nama_mentah LIKE '%Subbagian Umum dan Tata Usaha%';

-- 8c. Triwulan yang belum ada untuk pegawai lama (banyak yang hanya punya
--     TAHUNAN), supaya grafik tren kinerja tidak bolong.
INSERT INTO kinerja_periode (pegawai_id, tahun, periode_skp, nilai_kinerja, nilai_perilaku, predikat, sumber_sync, synced_at)
SELECT k.pegawai_id, k.tahun, p.periode,
       ROUND(k.nilai_kinerja - p.selisih, 2), ROUND(k.nilai_perilaku - p.selisih, 2),
       k.predikat, 'eKinerja', '2026-01-15 09:00:00'
FROM kinerja_periode k
JOIN (SELECT 'TW1' AS periode, 4 AS selisih UNION ALL SELECT 'TW2', 3 UNION ALL SELECT 'TW3', 1) p
WHERE k.periode_skp = 'TAHUNAN'
  AND k.pegawai_id < 17
  AND NOT EXISTS (
    SELECT 1 FROM kinerja_periode x
    WHERE x.pegawai_id = k.pegawai_id AND x.tahun = k.tahun AND x.periode_skp = p.periode
  );

-- ---------------------------------------------------------------------
-- 9. Hukuman disiplin — melengkapi kelima kategori rubrik §B.3
--    Sebelumnya hanya ada Ringan (aktif) & Sedang (nonaktif).
-- ---------------------------------------------------------------------
INSERT INTO hukuman_disiplin (pegawai_id, tingkat_hukuman, tanggal_sk, no_sk, keterangan, status_aktif, input_by) VALUES
  ((SELECT id FROM pegawai WHERE nip = '198512142010011013'), 'Berat', '2024-02-19', 'SK-HD/DJBK/2024/007', 'Pelanggaran ketentuan disiplin berat, penurunan jabatan setingkat lebih rendah selama 12 bulan', 1, 2),
  ((SELECT id FROM pegawai WHERE nip = '198707142012021010'), 'Sedang Menjalani', '2026-03-02', 'SK-HD/DJBK/2026/002', 'Sedang menjalani hukuman disiplin sedang, pemotongan tukin 25% selama 6 bulan', 1, 2),
  ((SELECT id FROM pegawai WHERE nip = '198503282011011005'), 'Ringan', '2025-09-11', 'SK-HD/DJBK/2025/014', 'Teguran tertulis atas keterlambatan penyampaian laporan kinerja triwulan', 1, 2),
  ((SELECT id FROM pegawai WHERE nip = '198205062006041011'), 'Sedang', '2019-06-04', 'SK-HD/DJBK/2019/003', 'Pelanggaran administrasi pengadaan, sanksi telah selesai dijalani', 0, 2);

-- ---------------------------------------------------------------------
-- 10. Asesmen tahun sebelumnya untuk beberapa pegawai
--     Supaya halaman "histori Kotak 9 per tahun" punya isi dan filter
--     tahun asesmen tidak memecah data jadi satu orang per tahun.
--     kotak_9 & status_asesmen dihitung lib/scoring di generator; nilai
--     turunan lain tetap dihitung ulang di 007.
-- ---------------------------------------------------------------------
INSERT INTO asesmen_talenta (pegawai_id, tahun_asesmen, jenis_asesmen, status_asesmen, nilai_kinerja_y, nilai_potensial_x, potkom, nilai_integritas, nilai_talenta, kotak_9, tahun_kinerja, rating_kinerja, sumber_sync) VALUES
  ((SELECT id FROM pegawai WHERE nip = '197907292005021003'), 2021, 'Administrator', 'Expired', 0, 0, 88.40, 0, 0, 9, 2021, 'Baik', 'eNominasi'),
  ((SELECT id FROM pegawai WHERE nip = '198405202009121008'), 2023, 'Pengawas', 'Berlaku', 0, 0, 91.20, 0, 0, 9, 2023, 'Baik', 'eNominasi'),
  ((SELECT id FROM pegawai WHERE nip = '198503122010012002'), 2022, 'Pengawas', 'Expired', 0, 0, 79.50, 0, 0, 7, 2022, 'Baik', 'eNominasi'),
  ((SELECT id FROM pegawai WHERE nip = '198006202006021003'), 2022, 'Pengawas', 'Expired', 0, 0, 74.00, 0, 0, 5, 2022, 'Butuh Perbaikan', 'eNominasi'),
  ((SELECT id FROM pegawai WHERE nip = '198102142006041002'), 2022, 'Pengawas', 'Expired', 0, 0, 80.00, 0, 0, 9, 2022, 'Baik', 'eNominasi'),
  ((SELECT id FROM pegawai WHERE nip = '198407252009122003'), 2022, 'JFT Muda', 'Expired', 0, 0, 83.10, 0, 0, 9, 2022, 'Sangat Baik', 'eNominasi');

-- ---------------------------------------------------------------------
-- 11. Nominasi jalur DITOLAK & REVISI
--     Seed sebelumnya hanya punya jalur mulus, sehingga cabang UI
--     penolakan/revisi tidak pernah teruji.
--     talent_pool untuk kandidat ini dibuat di 007 (butuh match_score).
-- ---------------------------------------------------------------------

-- ---------------------------------------------------------------------
-- 12. Log aktivitas API dengan kasus anomali (401/403/429)
--     Supaya halaman Log Aktivitas API punya yang perlu dideteksi.
-- ---------------------------------------------------------------------
INSERT INTO api_activity_log (api_client_id, api_token_id, endpoint, method, response_code, response_time_ms, ip_address, created_at) VALUES
  (1, 1, '/api/v1/talent-pool', 'GET', 200, 142, '10.10.4.21', '2026-07-28 08:14:02'),
  (1, 1, '/api/v1/pegawai', 'GET', 403, 18, '10.10.4.21', '2026-07-28 08:15:40'),
  (1, 1, '/api/v1/kotak-9/summary', 'GET', 200, 96, '10.10.4.21', '2026-07-28 08:16:11'),
  (2, 2, '/api/v1/pegawai', 'GET', 200, 318, '10.20.9.8', '2026-07-28 10:02:55'),
  (2, 2, '/api/v1/pegawai/197805251998032005', 'GET', 200, 88, '10.20.9.8', '2026-07-28 10:03:20'),
  (3, 3, '/api/v1/talent-pool', 'GET', 401, 9, '10.30.1.77', '2026-07-29 14:44:03'),
  (3, 3, '/api/v1/talent-pool', 'GET', 401, 7, '10.30.1.77', '2026-07-29 14:44:09'),
  (3, 3, '/api/v1/talent-pool', 'GET', 429, 5, '10.30.1.77', '2026-07-29 14:44:12'),
  (1, 1, '/api/v1/talent-pool', 'GET', 429, 6, '10.10.4.21', '2026-07-29 16:20:44'),
  (1, 1, '/api/v1/kotak-9/summary', 'GET', 500, 1204, '10.10.4.21', '2026-07-30 07:05:31');

-- ---------------------------------------------------------------------
-- 13. Riwayat sinkronisasi tambahan (termasuk yang GAGAL)
-- ---------------------------------------------------------------------
INSERT INTO sync_log (sumber_sistem, jenis_data, status, jumlah_baris, mulai_pada, selesai_pada, catatan_error, dijalankan_oleh) VALUES
  ('eHRM', 'Data biografis & riwayat pegawai', 'SUKSES', 40, '2026-07-28 02:00:00', '2026-07-28 02:06:18', NULL, NULL),
  ('eNominasi', 'Hasil asesmen & Kotak 9', 'SEBAGIAN', 46, '2026-07-28 02:07:00', '2026-07-28 02:09:44', '6 baris ditolak: potkom di luar rentang 0-100 dan kotak_9 tidak sesuai hasil hitung — masuk Antrian Pembersihan Data', NULL),
  ('eKinerja', 'Rekap kinerja triwulan', 'SUKSES', 156, '2026-07-28 02:10:00', '2026-07-28 02:14:02', NULL, NULL),
  ('eHRM', 'Data biografis & riwayat pegawai', 'GAGAL', 0, '2026-07-29 02:00:00', '2026-07-29 02:00:37', 'Koneksi ke endpoint eHRM timeout setelah 30s (ETIMEDOUT)', NULL),
  ('Manual', 'Input data hukuman disiplin', 'SUKSES', 4, '2026-07-29 11:20:00', '2026-07-29 11:31:00', NULL, 2);

-- ---------------------------------------------------------------------
-- 14. Setel ulang AUTO_INCREMENT
-- ---------------------------------------------------------------------
ALTER TABLE unit_organisasi AUTO_INCREMENT = 29;
ALTER TABLE jabatan         AUTO_INCREMENT = 48;
ALTER TABLE pegawai         AUTO_INCREMENT = 41;

