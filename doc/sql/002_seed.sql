-- =====================================================================
-- SIMT DJBK - Seed Data (dev)
-- Kombinasi: data nyata 9 pegawai (Data DTM.json) + master data & dummy
-- Jalankan SETELAH 001_schema.sql
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- =====================================================================
-- Data tambahan (master data + dummy) - lihat doc/ERD.md & doc/PRD.md
-- =====================================================================

-- ---------------------------------------------------------------------
-- ROLES
-- ---------------------------------------------------------------------
INSERT INTO roles (id, nama_role, deskripsi) VALUES
(1, 'Super Admin', 'Tim IT DJBK (Support) - kelola user, master data, API client & token, konfigurasi sistem'),
(2, 'Admin Talenta', 'Core Team Pengelola Kepegawaian / Champion Bagian Kepegawaian dan Umum - kelola rubrik, talent pool, verifikasi nominasi'),
(3, 'Pengelola Unit', 'Data Provider - staf kepegawaian Balai/BP2JK/Direktorat, input data unit & ajukan nominasi'),
(4, 'Pimpinan', 'Sponsor & Decision Maker - Dirjen/Sesditjen/Direktur/Kepala Balai, approve nominasi & rencana suksesi'),
(5, 'Viewer', 'Pembina kebijakan (Biro Kepegawaian & Ortala/BPSDM Kementerian PU) - akses baca terbatas');

-- ---------------------------------------------------------------------
-- UNIT ORGANISASI (hierarki DJBK, digrounding dari nama unit yang benar-benar
-- muncul di riwayat jabatan Data DTM.json + kebutuhan jabatan_target demo)
-- ---------------------------------------------------------------------
INSERT INTO unit_organisasi (id, kode_unit, nama_unit, parent_id, jenis, level_eselon) VALUES
(1, 'DJBK', 'Direktorat Jenderal Bina Konstruksi', NULL, 'DITJEN', 1),
(2, 'SET-DJBK', 'Sekretariat Direktorat Jenderal Bina Konstruksi', 1, 'SEKRETARIAT', 2),
(3, 'DIT-PENGADAAN', 'Direktorat Pengadaan Jasa Konstruksi', 1, 'DIREKTORAT', 2),
(4, 'DIT-KSP', 'Direktorat Kerja Sama dan Pemberdayaan', 1, 'DIREKTORAT', 2),
(5, 'DIT-BINKOMPROD', 'Direktorat Bina Kompetensi dan Produktivitas Konstruksi', 1, 'DIREKTORAT', 2),
(6, 'BAG-KEPEG', 'Bagian Kepegawaian dan Umum', 2, 'BAGIAN', 3),
(7, 'SUBDIT-PENGADAAN', 'Subdirektorat Pengadaan', 3, 'SUBDIT', 3),
(8, 'SUBDIT-PENERAPAN-KOMP', 'Subdirektorat Penerapan Kompetensi', 5, 'SUBDIT', 3),
(9, 'SUBDIT-PW1', 'Subdirektorat Pemberdayaan Wilayah I', 4, 'SUBDIT', 3),
(10, 'SUBDIT-PW2', 'Subdirektorat Pemberdayaan Wilayah II', 4, 'SUBDIT', 3),
(11, 'BP2JK-DKI', 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah DKI Jakarta', 1, 'BP2JK', 3),
(12, 'BP2JK-MALUT', 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Maluku Utara', 1, 'BP2JK', 3),
(13, 'BP2JK-DIY', 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah D.I. Yogyakarta', 1, 'BP2JK', 3),
(14, 'BP2JK-SUMSEL', 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera Selatan', 1, 'BP2JK', 3),
(15, 'BJKW-MKS', 'Balai Jasa Konstruksi Wilayah VI Makassar', 1, 'BALAI', 3),
(16, 'BJKW-SBY', 'Balai Jasa Konstruksi Wilayah IV Surabaya', 1, 'BALAI', 3),
(17, 'BALAI-MATERIAL', 'Balai Material dan Peralatan Konstruksi', 1, 'BALAI', 3);

-- ---------------------------------------------------------------------
-- USERS (akun internal dev seed)
-- Password dev utk SEMUA user di bawah: "password123" (bcrypt cost 10).
-- Cuma buat login-testing di environment dev - ganti/hapus sebelum ke prod.
-- ---------------------------------------------------------------------
INSERT INTO users (id, nama, email, username, password_hash, role_id, unit_organisasi_id, status_aktif) VALUES
(1, 'Admin Sistem', 'superadmin@djbk.pu.go.id', 'superadmin', '$2b$10$IekKg3EGFAr9xA/2OgJaN.BgBkj56K5Gwhju2FOKvVeM4r8dPrxOq', 1, NULL, 1),
(2, 'Martyanti R.B. Sianturi', 'martyanti.sianturi@djbk.pu.go.id', 'martyanti.rbs', '$2b$10$IekKg3EGFAr9xA/2OgJaN.BgBkj56K5Gwhju2FOKvVeM4r8dPrxOq', 2, 6, 1),
(3, 'Reza Kurniawan', 'reza.kurniawan@djbk.pu.go.id', 'reza.kurniawan', '$2b$10$IekKg3EGFAr9xA/2OgJaN.BgBkj56K5Gwhju2FOKvVeM4r8dPrxOq', 3, 11, 1),
(4, 'Farid Hidayat', 'farid.hidayat@djbk.pu.go.id', 'farid.hidayat', '$2b$10$IekKg3EGFAr9xA/2OgJaN.BgBkj56K5Gwhju2FOKvVeM4r8dPrxOq', 3, 12, 1),
(5, 'Bayu Saputra', 'bayu.saputra@djbk.pu.go.id', 'bayu.saputra', '$2b$10$IekKg3EGFAr9xA/2OgJaN.BgBkj56K5Gwhju2FOKvVeM4r8dPrxOq', 3, 13, 1),
(6, 'Sesditjen Bina Konstruksi', 'sesditjen@djbk.pu.go.id', 'sesditjen', '$2b$10$IekKg3EGFAr9xA/2OgJaN.BgBkj56K5Gwhju2FOKvVeM4r8dPrxOq', 4, 2, 1),
(7, 'Direktur Jenderal Bina Konstruksi', 'dirjen@djbk.pu.go.id', 'dirjen', '$2b$10$IekKg3EGFAr9xA/2OgJaN.BgBkj56K5Gwhju2FOKvVeM4r8dPrxOq', 4, 1, 1),
(8, 'Reviewer BPSDM PU', 'reviewer@bpsdm.pu.go.id', 'reviewer.bpsdm', '$2b$10$IekKg3EGFAr9xA/2OgJaN.BgBkj56K5Gwhju2FOKvVeM4r8dPrxOq', 5, NULL, 1);

-- ---------------------------------------------------------------------
-- JABATAN (master posisi definitif)
-- ---------------------------------------------------------------------
INSERT INTO jabatan (id, kode_jabatan, nama_jabatan, unit_organisasi_id, jenis_jabatan, jenjang, eselon, status_jabatan) VALUES
(1, 'JAB-DIR-PENGADAAN', 'Direktur Pengadaan Jasa Konstruksi', 3, 'STRUKTURAL', 'JPT Pratama', 'II', 'TERISI'),
(2, 'JAB-KASUBDIT-PENGADAAN', 'Kepala Subdirektorat Pengadaan', 7, 'STRUKTURAL', 'Administrator', 'III', 'KOSONG'),
(3, 'JAB-KASI-PENGADAAN', 'Kepala Seksi Pengadaan', 7, 'STRUKTURAL', 'Pengawas', 'IV', 'TERISI'),
(4, 'JAB-KABALAI-BP2JK-DKI', 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah DKI Jakarta', 11, 'STRUKTURAL', 'Administrator', 'III', 'TERISI'),
(5, 'JAB-KABALAI-BP2JK-MALUT', 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Maluku Utara', 12, 'STRUKTURAL', 'Administrator', 'III', 'TERISI'),
(6, 'JAB-KABALAI-BP2JK-DIY', 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah D.I. Yogyakarta', 13, 'STRUKTURAL', 'Administrator', 'III', 'TERISI'),
(7, 'JAB-KABALAI-BP2JK-SUMSEL', 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera Selatan', 14, 'STRUKTURAL', 'Administrator', 'III', 'TERISI'),
(8, 'JAB-KABALAI-BJKW-MKS', 'Kepala Balai Jasa Konstruksi Wilayah VI Makassar', 15, 'STRUKTURAL', 'Administrator', 'III', 'TERISI'),
(9, 'JAB-PJK-AHLI-MUDA', 'Pembina Jasa Konstruksi Ahli Muda', 2, 'FUNGSIONAL_TERTENTU', 'Ahli Muda', 'NON_ESELON', 'TERISI'),
(10, 'JAB-PJK-AHLI-PERTAMA', 'Pembina Jasa Konstruksi Ahli Pertama', 2, 'FUNGSIONAL_TERTENTU', 'Ahli Pertama', 'NON_ESELON', 'TERISI'),
(11, 'JAB-ANALIS-SDM-MADYA', 'Analis Sumber Daya Manusia Aparatur Ahli Madya', 6, 'FUNGSIONAL_TERTENTU', 'Ahli Madya', 'NON_ESELON', 'TERISI'),
(12, 'JAB-ANALIS-SDM-MUDA', 'Analis Sumber Daya Manusia Aparatur Ahli Muda', 6, 'FUNGSIONAL_TERTENTU', 'Ahli Muda', 'NON_ESELON', 'TERISI'),
(13, 'JAB-KASUBBAG-TU-MALUT', 'Kepala Subbagian Tata Usaha', 12, 'STRUKTURAL', 'Pengawas', 'IV', 'TERISI'),
(14, 'JAB-PPBJ-AHLI-PERTAMA', 'Pengelola Pengadaan Barang/Jasa Ahli Pertama', 7, 'FUNGSIONAL_TERTENTU', 'Ahli Pertama', 'NON_ESELON', 'TERISI'),
(15, 'JAB-PJK-AHLI-UTAMA', 'Pembina Jasa Konstruksi Ahli Utama', 5, 'FUNGSIONAL_TERTENTU', 'Ahli Utama', 'NON_ESELON', 'TERISI');


-- ---------------------------------------------------------------------
-- 9 pegawai nyata dari Data DTM.json (di-generate, lihat gen_seed_real.js)
-- ---------------------------------------------------------------------
INSERT INTO pegawai (id, nip, nama_lengkap, golongan, tmt_golongan, pangkat, jabatan_id, tmt_jabatan, sekolah_terakhir, bidang_studi_terakhir, tingkat_pendidikan, status_aktif, sumber_sinkron, last_synced_at, riwayat_diklat) VALUES
(1, '197805251998032005', 'Rus', 'IV.b', '2024-04-01', 'Pembina Tk. I', 8, '2025-07-18', 'UGM', 'SISTEM DAN TEKNIK TRANSPORTASI', 'S2', 'AKTIF', 'eHRM', '2026-07-20 09:00:00', CAST('["Webinar Series Kepatuhan Intern dan Tata Kelola Bina Konstruksi (KITABina) dengan tema Membangun Ekosistem Anti Suap Melalui Penerapan Sistem Manajemen Anti Penyuapan (SMAP)","Sosialisasi Peraturan Menteri PU Nomor 7 Tahun 2026 tentang Sistem Akuntabilitas Kinerja Instansi Pemerintah Kementerian Pekerjaan Umum","UPG Talks Seri 4: Kenali dan Pahami, Serba Serbi Gratifikasi","Aparatur Sipil Negara (ASN) Berintegritas","Webinar Series Kepatuhan Intern dan Tata Kelola Bina Konstruksi (KITABina) dengan tema Pengendalian Gratifikasi di Hari Raya","Sharing Session - Less is More: Lean Construction towards Sustainable Public Infrastructure","Sosialisasi Implementasi PU Corpu dan SE No. 01 Tahun 2025 Tentang Pedoman Pelaksanaan Pelatihan PISK Serta Konsolidasi Hasil Identifikasi Bangkom","e-Learning Manajemen Rantai Pasok","Bimbingan Teknis Terkait Program Penyuluh Anti Korupsi (PAKSI)","Webinar Percepatan Transformasi Ekonomi Digital dalam Konteks Barang/Jasa Pemerintah","Public Lecture Penerapan Prinsip Environmental, Social, and Governance (ESG) Pada Penyediaan Infrastruktur PUPR dan Kolokium bagi Generasi Muda PUPR","Penguatan Budaya BerAKHLAK Bagi Insan PUPR","Leadership Lecture \\"Enterpreneurship Penyelenggaraan Infrastruktur Publik\\"","Training of Trainers (TOT) - Teaching Skill","TOF Internalisasi Kode Etik & Kode Perilaku Pegawai Kementerian PUPR","SERTIFIKAT KOMPETENSI AHLI MUDA K3 KONSTRUKSI","Pelatihan Ahli Muda Keselamatan dan Kesehatan Kerja (K3) Konstruksi","E-Learning Pengetahuan Anti Korupsi dan Integritas (PADI)","Pembekalan Bagi Calon Pemberi Materi/Narasumber/Tenaga Pengajar pada Bimbingan Teknis/Workshop/Pelatihan Terkait Kegiatan Telaah Sejawat Ekstern","Management Of Training ( MOT )","Pelatihan Sistem Manajemen Anti Penyuapan","Analisis Manajemen Risiko Organisasi Terintegrasi","Kepemimpinan Administrator","Apresiasi Kegiatan Pendampingan Pengendalian Gratifikasi","Manajemen Pengembangan SDM Distance Learning","BIMTEK Calon Penguji Calon Mentor Latsar CPNS","Powerful Coaching and Counseling For Millennials Generation","Nol Kilometer Wilayah Negara Kesatuan Republik Indonesia","Workshop Sistem Informasi Bina Jabatan Auditor Berkualitas (SIBIJAK)","BIMTEK Calon Penguji Calon Mentor Latsar CPNS"]' AS JSON)),
(2, '197907292005021003', 'Irwan', 'IV.b', '2023-04-01', 'Pembina Tk. I', 4, '2025-07-18', 'UNIV OF ROORKEE BID WATER RESOURCES', 'UNIV OF ROORKEE BID WATER RESOURCES', 'S2', 'AKTIF', 'eHRM', '2026-07-20 09:00:00', CAST('["Tadaa!:Tanya Pengadaan Episode 17 -Sosialisasi Peraturan Menteri Pendayagunaan Aparatur Negara dan Reformasi Birokrasi Republik Indonesia Nomor 6 Tahun 2026 tentang Jabatan Fungsional Pengelola Pengadaan Barang/Jasa","TERAS LPJK Episode 3 - Integrasi Sistem Informasi untuk Layanan dan Tata Kelola yang Lebih Efektif","Webinar KORPRI PU Menyapa ASN \\"ASN PU Upgrade: Organisasi Kuat, Kerja Makin Semangat\\"","Sosialisasi Peraturan Menteri PU Nomor 7 Tahun 2026 tentang Sistem Akuntabilitas Kinerja Instansi Pemerintah Kementerian Pekerjaan Umum","Webinar Series Kepatuhan Intern dan Tata Kelola Bina Konstruksi (KITABina) dengan tema Membangun Ekosistem Anti Suap Melalui Penerapan Sistem Manajemen Anti Penyuapan (SMAP)","Tadaa!:Tanya Pengadaan Episode 16- Sosialisasi Penerapan SIMPAN TA 2026 di Kementerian Pekerjaan Umum","Tadaa!:Tanya Pengadaan Episode 15- Sosialisasi Perubahan Model Dokumen Kompetisi untuk Pekerjaan Konstruksi pada Katalog Elektronik dan Penugasan Tim Teknis e-Purchasing","Aparatur Sipil Negara (ASN) Berintegritas","Tadaa!:Tanya Pengadaan Episode 14- Sosialisasi Penyusunan Biaya Pekerjaan Konstruksi di Kementerian PU","Aparatur Sipil Negara (ASN) Berintegritas","Tadaa!:Tanya Pengadaan Episode 12- Pengadaan Barang/Jasa Berkelanjutan: Dari Regulasi Menuju Implementasi di Kementerian Pekerjaan Umum","Sasirangan (Semangat Berbagi Solusi dan Informasi Pengadaan) #15 - Tindak Lanjut Tender/Seleksi Gagal/Batal di Kementerian PU Sesuai Dengan MDP Terbaru","Governance Beyond Compliance: Penguatan Integritas dan Peran Aparatur dalam Pencegahan Korupsi","Sasirangan (Semangat Berbagi Solusi dan Informasi Pengadaan) #14 - Persiapan Pelaksanaan Tender/Seleksi Dini di Kementerian PU","Governance I Risk Management I Compliance","Tadaa!:Tanya Pengadaan Episode 11 - Ketentuan Keadaan Kahar dan Pemberian Kesempatan oleh PPK pada Pelaksanaan Kontrak Konstruksi","Tadaa!:Tanya Pengadaan Episode 10 - Membangun Trust dengan Memperkuat Integritas pada proses Pengadaan Barang/Jasa","Sasirangan (Semangat Berbagi Solusi dan Informasi Pengadaan) #13 - Refreshment SIKOMPAK pada Kontrak Konstruksi di Kementerian PU","Tadaa!:Tanya Pengadaan Episode 9 - Pengendalian Kontrak Pekerjaan Konstruksi Terintegrasi Rancang Bangun (Design and Build)","Webinar \\"Metode Pemilihan E-Purchasing Katalog Melalui Metode Mini-Kompetisi untuk Pekerjaan Konstruksi","Sasirangan (Semangat Berbagi Solusi dan Informasi Pengadaan) #7","Tadaa! Tanya Pengadaan - Sosialisasi Peraturan Presiden Nomor 46 Tahun 2025 tentang Perubahan Kedua atas Peraturan Presiden Nomor 16 Tahun 2018 tentang Pengadaan Barang/Jasa","Pejabat Inti Satuan Kerja (PISK) Bidang Manajemen","Sasirangan (Semangat Berbagi Solusi dan Informasi Pengadaan) #4","Webinar Sharing Knowledge Pengelolaan Sumber Daya Air di Belanda","Bimbingan Teknis Implementasi P3DN di Kementerian PU Wilayah Sumatera Bagian Utara","Optimasi Pemanfaatan Kecerdasan Buatan (AI) dalam Pembangunan Infrastruktur Pekerjaan Umum","Webinar Tematik \\"Kebijakan Penyusunan Harga Perkiraan Sendiri (HPS), Penerapan Aplikasi Sistem Informasi Harga Perkiraan Sendiri Terintegrasi (SIPASTI) dan Sistem Manajemen Keselamatan Konstruksi (SMKK)\\"","Pengembangan Kompetensi Sosial Kultural dengan Tema “Becoming A Change Maker”","Leadership Lecture \\"Enterpreneurship Penyelenggaraan Infrastruktur Publik\\""]' AS JSON)),
(3, '198405202009121008', 'Yatno', 'IV.a', '2024-10-01', 'Pembina', 5, '2025-07-18', 'Universitas Indonesia', 'PASCA BID TEK INDUSTRI', 'S2', 'AKTIF', 'eHRM', '2026-07-20 09:00:00', CAST('["Webinar Series KITaBina - Menjaga Diri dari Perilaku Berisiko dengan Patuh Kode Etik, Kode Perilaku, dan Disiplin Pegawai","Sosialisasi Peraturan Menteri PU Nomor 7 Tahun 2026 tentang Sistem Akuntabilitas Kinerja Instansi Pemerintah Kementerian Pekerjaan Umum","Webinar Series Kepatuhan Intern dan Tata Kelola Bina Konstruksi (KITABina) dengan tema Membangun Ekosistem Anti Suap Melalui Penerapan Sistem Manajemen Anti Penyuapan (SMAP)","Tadaa!:Tanya Pengadaan Episode 16- Sosialisasi Penerapan SIMPAN TA 2026 di Kementerian Pekerjaan Umum","Manajemen Risiko Proyek Infrastruktur","Tadaa!:Tanya Pengadaan Episode 15- Sosialisasi Perubahan Model Dokumen Kompetisi untuk Pekerjaan Konstruksi pada Katalog Elektronik dan Penugasan Tim Teknis e-Purchasing","Aparatur Sipil Negara (ASN) Berintegritas","Tadaa!:Tanya Pengadaan Episode 14- Sosialisasi Penyusunan Biaya Pekerjaan Konstruksi di Kementerian PU","Pelatihan Refleksi dan Aktualisasi Integritas (PRESTASI)","Pelatihan Pengembangan Kapasitas Pemimpin Masa Depan Kementerian Pekerjaan Umum Angkatan II","Pengembangan Kapasitas Pemimpin Masa Depan Kementerian Pekerjaan Umum","Ruang Belajar Data Episode 8: Analisis dan Visualisasi Spasial","Pelatihan Data Science","Workshop Penyusunan Corruption Risk Assessment (CRA)","Workshop Coaching Clinic dan Mentoring for Performance untuk Pejabat Pengawas Kementerian PUPR","Estimasi Biaya Konstruksi","PPK Negara Tersertifikasi (PNT)","Quality and Reliability Engineering","Manajemen Rantai Pasok","Tantangan dan Strategi Pencapaian Target Program Sejuta Rumah pada Masa Pandemi Covid-19","Pelatihan Online BIM Archicad","Pelatihan Manajemen Mutu Pekerjaan Konstruksi","Ahli Manajemen Konstruksi - Muda","Corporate Class of Amazing Data Presentation","Pelatihan Kepemimpinan Tingkat IV Angkatan II Tahun 2019","Tekla Structures 2018 Foundation Certification Program","Training of Trainer (ToT) Building Information Modelling (BIM)","Ahli K3 Konstruksi - Muda","Leadership and Teamwork Building Training","Bimbingan Teknis Supply Chain Management/Rantai Pasok Penyelenggaraan Jasa Konstruksi"]' AS JSON)),
(4, '197906192010121002', 'Iwan', 'IV.a', '2023-04-01', 'Pembina', 6, '2025-07-18', 'ITB', 'Sistem dan Teknik Jalan Raya', 'S2', 'AKTIF', 'eHRM', '2026-07-20 09:00:00', CAST('["Webinar Series Kepatuhan Intern dan Tata Kelola Bina Konstruksi (KITABina) dengan tema Membangun Ekosistem Anti Suap Melalui Penerapan Sistem Manajemen Anti Penyuapan (SMAP)","Tadaa!:Tanya Pengadaan Episode 16- Sosialisasi Penerapan SIMPAN TA 2026 di Kementerian Pekerjaan Umum","KORPRI PU Menyapa ASN series 3: \\"Role Model Matters\\"","Tadaa!:Tanya Pengadaan Episode 14- Sosialisasi Penyusunan Biaya Pekerjaan Konstruksi di Kementerian PU","Workshop Pembangunan Zona Integritas","Webinar Series Kepatuhan Intern dan Tata Kelola Bina Konstruksi (KITABina) dengan tema Pengendalian Gratifikasi di Hari Raya","Tadaa!:Tanya Pengadaan Episode 13- Reviu Rancangan Kontrak Konstruksi dalam Pengadaan Jasa Konstruksi untuk Pokja Pemilihan beserta Tim Pelaksana/Tim Peneliti di Kementerian PU","KORPRI PU Menyapa ASN series 1: Konsultasi dan Bimbingan Hukum \\"Paham Hukum, Kerja Aman Berkualitas\\"","Tadaa!:Tanya Pengadaan Episode 12- Pengadaan Barang/Jasa Berkelanjutan: Dari Regulasi Menuju Implementasi di Kementerian Pekerjaan Umum","Governance Beyond Compliance: Penguatan Integritas dan Peran Aparatur dalam Pencegahan Korupsi","Sharing Session - Less is More: Lean Construction towards Sustainable Public Infrastructure","Tadaa! Tanya Pengadaan - Penjelasan Proses Validasi Peralatan pada SIMPK dalam Proses Pengadaan Jasa Konstruksi di Kementerian Pekerjaan Umum","Webinar i-Emonitoring, e-Sakip, dan SPIP di Direktorat Jenderal Bina Konstruksi","Pejabat Inti Satuan Kerja (PISK) Bidang Manajemen","Tadaa!:Tanya Pengadaan - Persyaratan Peralatan Utama pada Tender Pekerjaan Konstruksi","E-Learning Pengetahuan Antikorupsi Dasar dan Integritas (PADI)","10th World Water Forum - Water For Shared Prosperity","Public Lecture Penerapan Prinsip Environmental, Social, and Governance (ESG) Pada Penyediaan Infrastruktur PUPR dan Kolokium bagi Generasi Muda PUPR","LAIN - LAIN","Leadership Lecture \\"Enterpreneurship Penyelenggaraan Infrastruktur Publik\\"","Pembiayaan Infrastruktur","Seminar Pengelolaan Kinerja Individu “Becoming Empowering Leader Through Perfomance Dialogue”","Kepemimpinan Administrator","Internalisasi Pengendalian Gratifikasi, Benturan Kepentingan dan Whistleblowing System (WBS)","MEMBANGUN EKOSISTEM ANTI PENYUAPAN MELALUI PENERAPAN ISO 37001:2016 SISTEM MANAJEMEN ANTI PENYUAPAN (SMAP)","FOCUS GROUP DISCUSSION Tender Dini 2022","WORKSHOP PENYUSUNAN DOKUMEN MANAJEMEN RISIKO","PELATIHAN SNI ISO 37001:2016 SISTEM MANAJEMEN ANTI PENYUAPAN","Program Terpadu Infrastruktur untuk Keseimbangan Pengembangan Wilayah Utara dan Selatan Pulau Jawa","Pengadaan Barang/Jasa Pemerintah"]' AS JSON)),
(5, '198503192010121008', 'Mardi', 'III/d', '2025-04-01', 'Penata Tingkat I', 9, '2025-08-01', 'Universitas Padjadjaran', 'MAGISTER AKUNTANSI', 'S2', 'AKTIF', 'eHRM', '2026-07-20 09:00:00', CAST('["Webinar Series Kepatuhan Intern dan Tata Kelola Bina Konstruksi (KITABina) dengan tema Membangun Ekosistem Anti Suap Melalui Penerapan Sistem Manajemen Anti Penyuapan (SMAP)","Tadaa!:Tanya Pengadaan Episode 16- Sosialisasi Penerapan SIMPAN TA 2026 di Kementerian Pekerjaan Umum","Aparatur Sipil Negara (ASN) Berintegritas","Tadaa!:Tanya Pengadaan Episode 15- Sosialisasi Perubahan Model Dokumen Kompetisi untuk Pekerjaan Konstruksi pada Katalog Elektronik dan Penugasan Tim Teknis e-Purchasing","Webinar Series Kepatuhan Intern dan Tata Kelola Bina Konstruksi (KITABina) dengan tema Pengendalian Gratifikasi di Hari Raya","Tadaa!:Tanya Pengadaan Episode 13- Reviu Rancangan Kontrak Konstruksi dalam Pengadaan Jasa Konstruksi untuk Pokja Pemilihan beserta Tim Pelaksana/Tim Peneliti di Kementerian PU","Tadaa!:Tanya Pengadaan Episode 12- Pengadaan Barang/Jasa Berkelanjutan: Dari Regulasi Menuju Implementasi di Kementerian Pekerjaan Umum","Governance Beyond Compliance: Penguatan Integritas dan Peran Aparatur dalam Pencegahan Korupsi","Workshop Jurnalistik dan Fotografi Direktorat Jenderal Bina Konstruksi Tahun 2025","Tadaa!:Tanya Pengadaan Episode 10 - Membangun Trust dengan Memperkuat Integritas pada proses Pengadaan Barang/Jasa","Sosialisasi dan Koordinasi Kepatuhan Intern dan Manajemen Risiko Regional II","Tadaa! Tanya Pengadaan - Sosialisasi Peraturan Presiden Nomor 46 Tahun 2025 tentang Perubahan Kedua atas Peraturan Presiden Nomor 16 Tahun 2018 tentang Pengadaan Barang/Jasa","Webinar Resensi Buku “Managing Change\\" Karya Bernard Burnes","Manajemen Resiko Organisasi Sektor Publik","E-Learning Manajemen Risiko","Seminar Meningkatkan Kesiapsiagaan dan Penanganan Longsoran di Infrastruktur Jalan Provinsi Sulawesi Barat","Workshop Manajemen Risiko di Lingkungan Kementerian PUPR","Pelatihan Jarak Jauh Pejabat Pembuat Komitmen Angkatan I Tahun 2023","Workshop Pengendalian Gratifikasi Bagi UPG Unit Organisasi dan Satgas Pengendalian Gratifikasi Di UPT Wilayah Pulau Kalimantan, Sulawesi, Bali, Nusa Tenggara, Maluku, dan Papua","Seminar Pengelolaan Kinerja Individu â€œBecoming Empowering Leader Through Perfomance Dialogueâ€","Internalisasi Pengendalian Gratifikasi, Benterun Kepentingan dan Whistleblowing System (WBS)","Membangun Ekosistem Anti Penyuapan Melalui Penerapan ISO 37001:2016 Sistem Manajemen Anti Penyuapan (SMAP)","Workshop Penyusunan Dokumen Manajemen Risiko","PELATIHAN SNI ISO 37001:2016 SISTEM MANAJEMEN ANTI PENYUAPAN","Konektivitas Prasarana Jalan Untuk Kesejahteraan Bangkasa","Pejabat Pembuat Komitmen (PPK) Distance Learning","Tantangan dan Strategi Pencapaian Target Program Sejuta Rumah pada Masa Pandemi Covid-19","Sistem Manajemen K3 Konstruksi (E-Learning)","Sertifikat Pengadaan Barang dan Jasa Level 1 (Dasar)","Pengadaan Barang/Jasa Pemerintah"]' AS JSON)),
(6, '198901292010121003', 'Rahmat', 'III/b', '2023-10-01', 'Penata Muda Tingkat I', 10, '2025-08-01', 'Sekolah Tinggi Ilmu Administrasi Lembaga Administrasi Negara', 'ILMU ADM NEGARA', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 09:00:00', CAST('["Webinar KORPRI PU Menyapa ASN \\"ASN PU Upgrade: Organisasi Kuat, Kerja Makin Semangat\\"","Webinar Series Kepatuhan Intern dan Tata Kelola Bina Konstruksi (KITABina) dengan tema Membangun Ekosistem Anti Suap Melalui Penerapan Sistem Manajemen Anti Penyuapan (SMAP)","Aparatur Sipil Negara (ASN) Berintegritas","Tadaa!:Tanya Pengadaan Episode 15- Sosialisasi Perubahan Model Dokumen Kompetisi untuk Pekerjaan Konstruksi pada Katalog Elektronik dan Penugasan Tim Teknis e-Purchasing","Tadaa!:Tanya Pengadaan Episode 14- Sosialisasi Penyusunan Biaya Pekerjaan Konstruksi di Kementerian PU","Tadaa!:Tanya Pengadaan Episode 13- Reviu Rancangan Kontrak Konstruksi dalam Pengadaan Jasa Konstruksi untuk Pokja Pemilihan beserta Tim Pelaksana/Tim Peneliti di Kementerian PU","Tadaa!:Tanya Pengadaan Episode 12- Pengadaan Barang/Jasa Berkelanjutan: Dari Regulasi Menuju Implementasi di Kementerian Pekerjaan Umum","Governance Beyond Compliance: Penguatan Integritas dan Peran Aparatur dalam Pencegahan Korupsi","Dasar Fungsional Pembina Jasa Konstruksi","Tadaa! Tanya Pengadaan - Sosialisasi Peraturan Presiden Nomor 46 Tahun 2025 tentang Perubahan Kedua atas Peraturan Presiden Nomor 16 Tahun 2018 tentang Pengadaan Barang/Jasa","e-Learning Manajemen Rantai Pasok","E-Learning Manajemen Pengembangan SDM","Bimbingan Teknis","Bela Negara Bagi Pejabat Pembuat Komitmen (PPK) dan Kelompok Kerja Pengadaan Barang/Jasa (Pokja PBJ) Kementerian PUPR","Webinar Pentingnya Keberadaan Kontrak Kerja Konstruksi dalam Pembangunan Infrastruktur","Workshop Analisis Jabatan, Analisis Beban Kerja. dan Evaluasi Jabatan","BIMBINGAN TEKNIS PENGADAAN BARANG / JASA PEMERINTA","Bimtek dan Ujian Sertifikasi Pengadaan Barang /Jasa Pemerintah","Peningkatan Kompetensi Pranata Komputer Terampil","Diklat Prajabatan","DIKLAT PRAJAB GOL.II"]' AS JSON)),
(7, '198508032008012001', 'Tasya', 'IV.a', '2023-10-01', 'Pembina', 11, '2025-08-01', 'Universitas Katolik Indonesia Atma Jaya', 'Ilmu Manajemen', 'S2', 'AKTIF', 'eHRM', '2026-07-20 09:00:00', CAST('["Aparatur Sipil Negara (ASN) Berintegritas","Webinar Series Kepatuhan Intern dan Tata Kelola Bina Konstruksi (KITABina) dengan tema Pengendalian Gratifikasi di Hari Raya","Pengelolaan Manajemen Risiko","Sosialisasi Penerapan Disiplin Pegawai Sesuai dengan Peraturan Pemerintah (PP) Nomor 48 Tahun 2016 tentang Tata Cara Pengenaan Sanksi Administratif Kepada Pejabat Pemerintahan dan PP Nomor 94 Tahun 2021 tentang Disiplin PNS","E-learning Kepatuhan Intern","Workshop Identifikasi Kebutuhan Pengembangan Kompetensi di Direktorat Jenderal Bina Konstruksi","Benchmarking Sistem Informasi Manajemen Talenta Pemerintah Provinsi Jawa Barat (JAWARA) Dalam Rangka Evaluasi Pemanfaatan dan Ujicoba Pengembangan Fitur pada Sistem Informasi Suksesi dan Manajemen Talenta (E-Nominasi)","Manajemen Pengembangan SDM Distance Learning","Kepemimpinan Tingkat IV","Sertifikat Pengadaan Barang dan Jasa Level 1 (Dasar)","Sertifikat Pengadaan Barang dan Jasa Level 1 (Dasar)","PELATIHAN MEMBANGUN BUDAYA KERJA PRESTATIF","DIKLAT PRAJAB GOL. III"]' AS JSON)),
(8, '198506022008122001', 'Tina', 'III/d', '2024-02-01', 'Penata Tingkat I', 12, '2025-08-01', 'Universitas Padjadjaran', 'Ilmu Komunikasi', 'S1_D4', 'AKTIF', 'eHRM', '2026-07-20 09:00:00', CAST('["Webinar KORPRI PU Menyapa ASN \\"ASN PU Upgrade: Organisasi Kuat, Kerja Makin Semangat\\"","Webinar Series Kepatuhan Intern dan Tata Kelola Bina Konstruksi (KITABina) dengan tema Membangun Ekosistem Anti Suap Melalui Penerapan Sistem Manajemen Anti Penyuapan (SMAP)","Focus Group Discussion (FGD) Penerapan dan Evaluasi Sistem/Aplikasi Layanan Konseling dan Konsultasi Melalui SoHappy \\"Strategi Mengelola Stress dan Mengatasi Burn Out\\"","Manajemen Kinerja ASN","KORPRI PU Menyapa ASN series 3: \\"Role Model Matters\\"","KORPRI PU Menyapa ASN series 1: Konsultasi dan Bimbingan Hukum \\"Paham Hukum, Kerja Aman Berkualitas\\"","Teknis Jabatan Fungsional Kepegawaian","E-learning Kepatuhan Intern","Workshop Identifikasi Kebutuhan Pengembangan Kompetensi di Direktorat Jenderal Bina Konstruksi","Seminar Pengelolaan Kinerja Individu “Becoming Empowering Leader Through Perfomance Dialogue”","Internalisasi Core Values ASN BerAKHLAK","Internalisasi Core Values ASN BerAKHLAK","Sertifikat Pengadaan Barang dan Jasa Level 1 (Dasar)","Pengadaan Barang/Jasa Pemerintah Tingkat Dasar (Blended Learning)","Manajemen Pengembangan SDM Distance Learning","Perencanaan Anggaran","PRAJAB TINGKAT III"]' AS JSON)),
(9, '198707012010122006', 'Rachma', 'III/d', '2023-04-01', 'Penata Tingkat I', 12, '2025-08-01', 'Universitas Indonesia', 'Psikologi', 'S2', 'AKTIF', 'eHRM', '2026-07-20 09:00:00', CAST('["Workshop Pengelolaan Talenta Dalam Rangka Peningkatan Kualitas Pembangunan Zona Integritas","Focus Group Discussion (FGD) Penerapan dan Evaluasi Sistem/Aplikasi Layanan Konseling dan Konsultasi Melalui SoHappy \\"Strategi Mengelola Stress dan Mengatasi Burn Out\\"","Manajemen Kinerja ASN","Pengelolaan Manajemen Risiko","Training of Trainer (ToT) Workshop Pembinaan Kinerja","E-learning Kepatuhan Intern","Sosialisasi SE 01/SE/KM/2025 dan Konsolidasi Hasil Identifikasi Pengembangan Kompetensi di Regional Sumatera Bagian Selatan","Workshop Identifikasi Kebutuhan Pengembangan Kompetensi di Direktorat Jenderal Bina Konstruksi","Sosialisasi Corporate University di Kementerian Pekerjaan Umum","Workshop Pembinaan Kinerja bagi Pengelola Kepegawaian Unit Kerja dan Unit Organisasi di Lingkungan Kementerian PUPR","Public Lecture Penerapan Prinsip Environmental, Social, and Governance (ESG) Pada Penyediaan Infrastruktur PUPR dan Kolokium bagi Generasi Muda PUPR","Manajemen Pengembangan SDM","Seminar Pengelolaan Kinerja Individu “Becoming Empowering Leader Through Perfomance Dialogue”","Sertifikat Pengadaan Barang dan Jasa Level 1 (Dasar)","Prajabatan Tingkat III","ADMINISTRASI KEPEGAWAIAN"]' AS JSON));

-- riwayat_jabatan (9 pegawai nyata)
INSERT INTO riwayat_jabatan (pegawai_id, urutan, jabatan_nama_mentah, jabatan_id, unit_kerja_mentah) VALUES
(1, 1, 'Kepala Balai Jasa Konstruksi Wilayah VI Makassar', 8, NULL),
(1, 2, 'Kepala Bagian Kepegawaian dan Umum, Sekretariat Inspektorat Jenderal, Inspektorat Jenderal, Kementerian Pekerjaan Umum Dan Perumahan Rakyat', NULL, NULL),
(1, 3, 'Kepala Bagian Umum, Sekretariat Inspektorat Jenderal, Inspektorat Jenderal, Kementerian Pekerjaan Umum Dan Perumahan Rakyat', NULL, NULL),
(1, 4, 'KEPALA SUBBAGIAN PENYUSUNAN RENCANA DAN PROGRAM, BAGIAN RENCANA DAN PROGRAM, SEKRETARIAT INSPEKTORAT JENDERAL, INSPEKTORAT JENDERAL, KEMENTERIAN PEKERJAAN UMUM DAN PERUMAHAN RAKYAT', NULL, NULL),
(1, 5, 'Kepala Sub Bagian Penyusunan Rencana Dan Program, Bagian Rencana Dan Program, Sekretriat Inspektorat Jenderal , Kementerian PU', NULL, NULL),
(1, 6, 'Kepala Subbagian Program Dinas Bina Marga , Pemerintah Provinsi Sulawesi Selatan', NULL, NULL),
(2, 1, 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah DKI Jakarta', 4, NULL),
(2, 2, 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Barat, Direktorat Jenderal Bina Konstruksi, Kementerian Pekerjaan Umum Dan Perumahan Rakyat', NULL, NULL),
(2, 3, 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Barat, Direktorat Jenderal Bina Konstruksi, Kementerian Pekerjaan Umum Dan Perumahan Rakyat', NULL, NULL),
(2, 4, 'Kepala Balai Jasa Konstruksi Wilayah IV Surabaya, Direktorat Jenderal Bina Konstruksi, Kementerian Pekerjaan Umum Dan Perumahan Rakyat', NULL, NULL),
(2, 5, 'Kepala, Balai Jasa Konstruksi Wilayah IV Surabaya, Direktorat Jenderal Bina Konstruksi, Kementerian Pekerjaan Umum Dan Perumahan Rakyat', NULL, NULL),
(2, 6, 'Kepala, Seksi Pendayagunaan, Balai Material dan Peralatan Konstruksi, Direktorat Jenderal Bina Konstruksi, Kementerian Pekerjaan Umum Dan Perumahan Rakyat', NULL, NULL),
(3, 1, 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Maluku Utara', 5, NULL),
(3, 2, 'Kepala Subbagian Umum dan Tata Usaha, Balai Jasa Konstruksi Wilayah III Jakarta, Direktorat Jenderal Bina Konstruksi, Kementerian Pekerjaan Umum Dan Perumahan Rakyat', NULL, NULL),
(3, 3, 'Kepala Subbagian Umum dan Tata Usaha, Balai Jasa Konstruksi Wilayah III Jakarta, Direktorat Jenderal Bina Konstruksi, Kementerian Pekerjaan Umum Dan Perumahan Rakyat', NULL, NULL),
(3, 4, 'Kepala Seksi Penjaminan Mutu, Subdirektorat Pemberdayaan Wilayah II, Direktorat Kerja Sama dan Pemberdayaan, Direktorat Jenderal Bina Konstruksi, Kementerian Pekerjaan Umum Dan Perumahan Rakyat', NULL, NULL),
(3, 5, 'KEPALA SEKSI PEMANTAUAN DAN EVALUASI, SUBDIREKTORAT PEMBERDAYAAN WILAYAH I, DIREKTORAT KERJA SAMA DAN PEMBERDAYAAN, DIREKTORAT JENDERAL BINA KONSTRUKSI, KEMENTERIAN PEKERJAAN UMUM DAN PERUMAHAN RAKYAT', NULL, NULL),
(3, 6, 'Kepala Seksi Pemantauan dan Evaluasi, Subdirektorat Pemberdayaan Wilayah II, Direktorat Kerja Sama dan Pemberdayaan, Direktorat Jenderal Bina Konstruksi, Kementerian Pekerjaan Umum Dan Perumahan Rakyat', NULL, NULL),
(4, 1, 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah D.I. Yogyakarta', 6, NULL),
(5, 1, 'Pembina Jasa Konstruksi Ahli Muda', 9, NULL),
(6, 1, 'Pembina Jasa Konstruksi Ahli Pertama', 10, NULL),
(7, 1, 'Analis Sumber Daya Manusia Aparatur Ahli Madya', 11, NULL),
(8, 1, 'Analis Sumber Daya Manusia Aparatur Ahli Muda, Bagian Kepegawaian dan Umum, Sekretariat Direktorat Jenderal Bina Konstruksi, Direktorat Jenderal Bina Konstruksi, Kementerian Pekerjaan Umum', 12, NULL),
(9, 1, 'Analis Sumber Daya Manusia Aparatur Ahli Muda, Bagian Kepegawaian dan Umum, Sekretariat Direktorat Jenderal Bina Konstruksi, Direktorat Jenderal Bina Konstruksi, Kementerian Pekerjaan Umum', 12, NULL);

-- riwayat_pendidikan (9 pegawai nyata)
INSERT INTO riwayat_pendidikan (pegawai_id, urutan, jenjang_pendidikan, bidang_studi, nama_sekolah) VALUES
(1, 1, 'S2', 'SISTEM DAN TEKNIK TRANSPORTASI', 'UGM'),
(1, 2, 'S1_D4', 'Teknik Sipil', NULL),
(2, 1, 'S2', 'UNIV OF ROORKEE BID WATER RESOURCES', 'UNIV OF ROORKEE BID WATER RESOURCES'),
(2, 2, 'S1_D4', 'TEKNIK INDUSTRI', NULL),
(3, 1, 'S2', 'PASCA BID TEK INDUSTRI', 'Universitas Indonesia'),
(3, 2, 'S1_D4', 'Teknik Sipil', NULL),
(4, 1, 'S2', 'Sistem dan Teknik Jalan Raya', 'ITB'),
(4, 2, 'S1_D4', 'Teknik Sipil', NULL),
(5, 1, 'D3', 'ILMU ADMINISTRASI', 'Universitas Padjadjaran'),
(5, 2, 'S1_D4', 'FIS ADMINISTRASI', NULL),
(5, 3, 'S2', 'MAGISTER AKUNTANSI', NULL),
(6, 1, 'S1_D4', 'Ilmu Administrasi Negara', 'Sekolah Tinggi Ilmu Administrasi Lembaga Administrasi Negara'),
(7, 1, 'S1_D4', 'Teknik Informatika', 'Universitas Katolik Indonesia Atma Jaya'),
(7, 2, 'S2', 'Magister Manajemen', NULL),
(8, 1, 'S1_D4', 'Ilmu Komunikasi', 'Universitas Padjadjaran'),
(9, 1, 'S2', 'Psikologi', 'Universitas Indonesia'),
(9, 2, 'S1_D4', 'Psikologi', NULL);

-- asesmen_talenta (9 pegawai nyata - APA ADANYA dari e-Nominasi, TIDAK dihitung ulang)
-- catatan: Tasya & Tina kotak_9-nya tidak konsisten dgn klasifikasi ambang murni Y/X karena status_asesmen=Expired
-- dan jenis_asesmen tidak sesuai jenjang terkini - dipertahankan sesuai sumber, bukan dikoreksi (lihat ERD.md/README).
INSERT INTO asesmen_talenta (pegawai_id, tahun_asesmen, jenis_asesmen, status_asesmen, nilai_kinerja_y, nilai_potensial_x, potkom, nilai_integritas, nilai_talenta, kotak_9, tahun_kinerja, rating_kinerja, sumber_sync) VALUES
(1, 2025, 'Administrator', 'Berlaku', 80.00, 101.25, 101.25, 3.00, 90.63, 9, 2025, 'Baik', 'eNominasi'),
(2, 2023, 'Administrator', 'Berlaku', 80.00, 102.50, 102.50, 3.00, 91.25, 9, 2025, 'Baik', 'eNominasi'),
(3, 2026, 'Administrator', 'Berlaku', 80.00, 115.10, 115.10, 3.50, 97.55, 9, 2025, 'Baik', 'eNominasi'),
(4, 2023, 'Administrator', 'Berlaku', 80.00, 93.47, 93.47, 3.00, 86.73, 9, 2025, 'Baik', 'eNominasi'),
(5, 2021, 'PENGAWAS', 'Expired', 100.00, 76.04, 76.04, 2.00, 88.02, 7, 2025, 'Sangat Baik', 'eNominasi'),
(6, 2024, 'JPT Pertama', 'Berlaku', 100.00, 103.89, 103.89, 2.00, 101.94, 9, 2025, 'Sangat Baik', 'eNominasi'),
(7, 2022, 'JFT Muda', 'Expired', 100.00, 69.58, 69.58, 3.00, 84.79, 4, 2025, 'Sangat Baik', 'eNominasi'),
(8, 2023, 'JFT Muda', 'Berlaku', 100.00, 61.74, 61.74, 1.00, 80.87, 4, 2025, 'Sangat Baik', 'eNominasi'),
(9, 2023, 'JFT Muda', 'Berlaku', 100.00, 90.16, 90.16, 2.00, 95.08, 9, 2025, 'Sangat Baik', 'eNominasi');

-- ---------------------------------------------------------------------
-- 7 PEGAWAI TAMBAHAN (dummy, memperkaya sebaran jenjang/eselon utk demo)
-- id 10-16 (id 1-9 dipakai 9 pegawai nyata di _fragment_real9.sql)
-- ---------------------------------------------------------------------
INSERT INTO pegawai (id, nip, nama_lengkap, golongan, tmt_golongan, pangkat, jabatan_id, tmt_jabatan, sekolah_terakhir, bidang_studi_terakhir, tingkat_pendidikan, status_aktif, sumber_sinkron, riwayat_diklat) VALUES
(10, '197211081996031001', 'Budi Santoso', 'IV/c', '2021-04-01', 'Pembina Utama Muda', 1, '2024-01-06', 'Institut Teknologi Bandung', 'Teknik Sipil', 'S2', 'AKTIF', 'manual', JSON_ARRAY('Sekolah Pimpinan Tinggi Nasional Tingkat I', 'Workshop Kebijakan Pengadaan Barang/Jasa Pemerintah Terkini')),
(11, '198503122010012002', 'Siti Rahayu', 'III/d', '2022-04-01', 'Penata Tingkat I', 3, '2022-06-01', 'Universitas Gadjah Mada', 'Manajemen', 'S1_D4', 'AKTIF', 'manual', JSON_ARRAY('Sertifikasi Ahli Pengadaan Barang/Jasa Pemerintah Tingkat Dasar', 'Sertifikasi Ahli Pengadaan Barang/Jasa Pemerintah Tingkat Lanjutan', 'Bimtek Pengelolaan Kontrak Konstruksi')),
(12, '198006202006021003', 'Ahmad Fauzi', 'IV/a', '2023-10-01', 'Pembina', 7, '2025-02-10', 'Universitas Sriwijaya', 'Teknik Sipil', 'S1_D4', 'AKTIF', 'manual', JSON_ARRAY('Diklat Kepemimpinan Administrator', 'Workshop Manajemen Mutu Konstruksi')),
(13, '199009152015012004', 'Dewi Anggraini', 'III/b', '2021-01-01', 'Penata Muda Tingkat I', 13, '2023-03-01', 'Universitas Diponegoro', 'Administrasi Negara', 'S1_D4', 'AKTIF', 'manual', JSON_ARRAY('Diklat Kepemimpinan Pengawas', 'Pelatihan Tata Naskah Dinas Elektronik')),
(14, '199602282020011005', 'Rizky Pratama', 'III/a', '2020-01-01', 'Penata Muda', 14, '2020-01-01', 'Institut Teknologi Sepuluh Nopember', 'Teknik Industri', 'S1_D4', 'AKTIF', 'manual', JSON_ARRAY('Diklat Prajabatan Golongan III', 'Pelatihan Dasar Pengadaan Barang/Jasa Pemerintah')),
(15, '196804041993032006', 'Yuliana Wijaya', 'IV/d', '2019-04-01', 'Pembina Utama Madya', 15, '2019-04-01', 'Universitas Indonesia', 'Teknik Konstruksi', 'S2', 'AKTIF', 'manual', JSON_ARRAY('Sertifikasi Ahli Utama Jasa Konstruksi', 'Training of Trainers Manajemen Mutu')),
(16, '198807192012021007', 'Hendra Gunawan', 'III/c', '2022-10-01', 'Penata', 12, '2022-10-01', 'Universitas Brawijaya', 'Ilmu Administrasi', 'S1_D4', 'AKTIF', 'manual', JSON_ARRAY('Workshop Identifikasi Kebutuhan Pengembangan Kompetensi di Direktorat Jenderal Bina Konstruksi'));

-- riwayat_jabatan untuk 7 pegawai tambahan
INSERT INTO riwayat_jabatan (pegawai_id, urutan, jabatan_nama_mentah, jabatan_id, unit_kerja_mentah) VALUES
(10, 1, 'Direktur Pengadaan Jasa Konstruksi', 1, 'Direktorat Pengadaan Jasa Konstruksi'),
(10, 2, 'Kepala Subdirektorat Pengadaan, Direktorat Pengadaan Jasa Konstruksi', NULL, NULL),
(11, 1, 'Kepala Seksi Pengadaan, Subdirektorat Pengadaan, Direktorat Pengadaan Jasa Konstruksi', 3, 'Subdirektorat Pengadaan'),
(11, 2, 'Staf Pengadaan, Subdirektorat Pengadaan, Direktorat Pengadaan Jasa Konstruksi', NULL, NULL),
(12, 1, 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera Selatan', 7, 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera Selatan'),
(12, 2, 'Kepala Seksi Pemilihan, Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera Selatan', NULL, NULL),
(13, 1, 'Kepala Subbagian Tata Usaha, Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Maluku Utara', 13, 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Maluku Utara'),
(14, 1, 'Pengelola Pengadaan Barang/Jasa Ahli Pertama, Subdirektorat Pengadaan', 14, 'Subdirektorat Pengadaan'),
(15, 1, 'Pembina Jasa Konstruksi Ahli Utama, Direktorat Bina Kompetensi dan Produktivitas Konstruksi', 15, 'Direktorat Bina Kompetensi dan Produktivitas Konstruksi'),
(15, 2, 'Pembina Jasa Konstruksi Ahli Madya, Direktorat Bina Kompetensi dan Produktivitas Konstruksi', NULL, NULL),
(16, 1, 'Analis Sumber Daya Manusia Aparatur Ahli Muda, Bagian Kepegawaian dan Umum', 12, 'Bagian Kepegawaian dan Umum');

-- riwayat_pendidikan untuk 7 pegawai tambahan
INSERT INTO riwayat_pendidikan (pegawai_id, urutan, jenjang_pendidikan, bidang_studi, nama_sekolah, tahun_lulus) VALUES
(10, 1, 'S2', 'Teknik Sipil', 'Institut Teknologi Bandung', 2001),
(10, 2, 'S1_D4', 'Teknik Sipil', 'Universitas Sriwijaya', 1995),
(11, 1, 'S1_D4', 'Manajemen', 'Universitas Gadjah Mada', 2008),
(12, 1, 'S1_D4', 'Teknik Sipil', 'Universitas Sriwijaya', 2004),
(13, 1, 'S1_D4', 'Administrasi Negara', 'Universitas Diponegoro', 2013),
(14, 1, 'S1_D4', 'Teknik Industri', 'Institut Teknologi Sepuluh Nopember', 2019),
(15, 1, 'S2', 'Teknik Konstruksi', 'Universitas Indonesia', 1998),
(15, 2, 'S1_D4', 'Teknik Sipil', 'Universitas Hasanuddin', 1992),
(16, 1, 'S1_D4', 'Ilmu Administrasi', 'Universitas Brawijaya', 2011);

-- asesmen_talenta untuk 7 pegawai tambahan (dihitung konsisten via Formula A: 50% Y + 50% X)
INSERT INTO asesmen_talenta (pegawai_id, tahun_asesmen, jenis_asesmen, status_asesmen, nilai_kinerja_y, nilai_potensial_x, potkom, nilai_integritas, nilai_talenta, kotak_9, tahun_kinerja, rating_kinerja, sumber_sync) VALUES
(10, 2025, 'JPT Pratama', 'Berlaku', 100.00, 112.00, 112.00, 4.0, 106.00, 9, 2025, 'Sangat Baik', 'manual'),
(11, 2025, 'Pengawas', 'Berlaku', 100.00, 88.00, 88.00, 4.0, 94.00, 9, 2025, 'Sangat Baik', 'manual'),
(12, 2025, 'Administrator', 'Berlaku', 80.00, 82.00, 82.00, 3.0, 81.00, 9, 2025, 'Baik', 'manual'),
(13, 2025, 'Pengawas', 'Berlaku', 80.00, 65.00, 65.00, 3.0, 72.50, 7, 2025, 'Baik', 'manual'),
(14, 2025, 'JFT Pertama', 'Berlaku', 60.00, 58.00, 58.00, 3.0, 59.00, 2, 2025, 'Butuh Perbaikan', 'manual'),
(15, 2025, 'JFT Utama', 'Berlaku', 100.00, 97.00, 97.00, 3.5, 98.50, 9, 2025, 'Sangat Baik', 'manual'),
(16, 2026, 'JFT Muda', 'Expired', 80.00, 70.00, 70.00, 3.0, 75.00, 7, 2025, 'Baik', 'manual');

-- ---------------------------------------------------------------------
-- KINERJA_PERIODE (2025) - detail triwulan utk 5 kandidat demo jabatan target,
-- 1 baris TAHUNAN utk 11 pegawai lain
-- ---------------------------------------------------------------------
INSERT INTO kinerja_periode (pegawai_id, tahun, periode_skp, nilai_kinerja, nilai_perilaku, predikat, synced_at) VALUES
-- Irwan (id 2)
(2, 2025, 'TW1', 78.00, 80.00, 'Baik', '2025-04-05 10:00:00'),
(2, 2025, 'TW2', 79.00, 81.00, 'Baik', '2025-07-05 10:00:00'),
(2, 2025, 'TW3', 80.00, 82.00, 'Baik', '2025-10-05 10:00:00'),
(2, 2025, 'TAHUNAN', 80.00, 81.00, 'Baik', '2026-01-10 10:00:00'),
-- Yatno (id 3)
(3, 2025, 'TW1', 77.00, 79.00, 'Baik', '2025-04-05 10:00:00'),
(3, 2025, 'TW2', 78.00, 80.00, 'Baik', '2025-07-05 10:00:00'),
(3, 2025, 'TW3', 79.00, 81.00, 'Baik', '2025-10-05 10:00:00'),
(3, 2025, 'TAHUNAN', 80.00, 80.00, 'Baik', '2026-01-10 10:00:00'),
-- Iwan (id 4)
(4, 2025, 'TW1', 76.00, 78.00, 'Baik', '2025-04-05 10:00:00'),
(4, 2025, 'TW2', 78.00, 79.00, 'Baik', '2025-07-05 10:00:00'),
(4, 2025, 'TW3', 79.00, 80.00, 'Baik', '2025-10-05 10:00:00'),
(4, 2025, 'TAHUNAN', 80.00, 80.00, 'Baik', '2026-01-10 10:00:00'),
-- Siti (id 11)
(11, 2025, 'TW1', 88.00, 90.00, 'Sangat Baik', '2025-04-05 10:00:00'),
(11, 2025, 'TW2', 90.00, 91.00, 'Sangat Baik', '2025-07-05 10:00:00'),
(11, 2025, 'TW3', 91.00, 92.00, 'Sangat Baik', '2025-10-05 10:00:00'),
(11, 2025, 'TAHUNAN', 92.00, 92.00, 'Sangat Baik', '2026-01-10 10:00:00'),
-- Ahmad (id 12)
(12, 2025, 'TW1', 75.00, 77.00, 'Baik', '2025-04-05 10:00:00'),
(12, 2025, 'TW2', 77.00, 78.00, 'Baik', '2025-07-05 10:00:00'),
(12, 2025, 'TW3', 78.00, 79.00, 'Baik', '2025-10-05 10:00:00'),
(12, 2025, 'TAHUNAN', 80.00, 79.00, 'Baik', '2026-01-10 10:00:00'),
-- sisanya, 1 baris TAHUNAN saja
(1, 2025, 'TAHUNAN', 80.00, 81.00, 'Baik', '2026-01-10 10:00:00'),
(5, 2025, 'TAHUNAN', 100.00, 95.00, 'Sangat Baik', '2026-01-10 10:00:00'),
(6, 2025, 'TAHUNAN', 100.00, 95.00, 'Sangat Baik', '2026-01-10 10:00:00'),
(7, 2025, 'TAHUNAN', 100.00, 90.00, 'Sangat Baik', '2026-01-10 10:00:00'),
(8, 2025, 'TAHUNAN', 100.00, 90.00, 'Sangat Baik', '2026-01-10 10:00:00'),
(9, 2025, 'TAHUNAN', 100.00, 90.00, 'Sangat Baik', '2026-01-10 10:00:00'),
(10, 2025, 'TAHUNAN', 100.00, 95.00, 'Sangat Baik', '2026-01-10 10:00:00'),
(13, 2025, 'TAHUNAN', 80.00, 82.00, 'Baik', '2026-01-10 10:00:00'),
(14, 2025, 'TAHUNAN', 60.00, 65.00, 'Butuh Perbaikan', '2026-01-10 10:00:00'),
(15, 2025, 'TAHUNAN', 100.00, 92.00, 'Sangat Baik', '2026-01-10 10:00:00'),
(16, 2025, 'TAHUNAN', 80.00, 78.00, 'Baik', '2026-01-10 10:00:00');

-- ---------------------------------------------------------------------
-- HUKUMAN_DISIPLIN (dummy - hanya utk pegawai yg punya rekam jejak;
-- absennya baris = "Tidak Pernah" secara default)
-- ---------------------------------------------------------------------
INSERT INTO hukuman_disiplin (pegawai_id, tingkat_hukuman, tanggal_sk, no_sk, keterangan, status_aktif, input_by) VALUES
(12, 'Ringan', '2022-03-14', 'SK.123/KP.02/DJBK/2022', 'Keterlambatan penyampaian laporan pertanggungjawaban keuangan unit', 1, 2),
(15, 'Sedang', '2015-08-20', 'SK.087/KP.02/DJBK/2015', 'Pelanggaran disiplin kehadiran, telah menjalani sanksi dan berkinerja baik pasca sanksi', 0, 2);

-- ---------------------------------------------------------------------
-- JABATAN_TARGET: contoh dari KERANGKA TALENT POOL.md
-- ---------------------------------------------------------------------
INSERT INTO jabatan_target (id, kode_target, nama_target, deskripsi, status, dibuat_oleh) VALUES
(1, 'JT-KABALAI-BP2JK-KASUBDIT-PENGADAAN', 'Kepala Balai BP2JK / Kepala Subdirektorat Direktorat Pengadaan', 'Profil jabatan sasaran suksesi gabungan untuk seluruh posisi Kepala Balai Pelaksana Pemilihan Jasa Konstruksi (BP2JK) dan Kepala Subdirektorat Pengadaan Jasa Konstruksi - mengikuti rubrik KERANGKA TALENT POOL.md', 'AKTIF', 2);

INSERT INTO jabatan_target_anggota (jabatan_target_id, jabatan_id) VALUES
(1, 2), (1, 4), (1, 5), (1, 6), (1, 7);

INSERT INTO jabatan_target_persyaratan (jabatan_target_id, jenis_syarat, deskripsi, nilai_minimal) VALUES
(1, 'PENDIDIKAN_MIN', 'Cek syarat jabatan Direktorat Pengadaan - minimal S1 semua jurusan', 'S1_D4'),
(1, 'BIDANG_ILMU', 'Untuk Jabatan Pengadaan: semua jurusan diperbolehkan', NULL),
(1, 'PENGALAMAN_MIN', 'Memiliki pengalaman jabatan minimal setara Eselon IV (Pengawas) ke atas', NULL);

-- ---------------------------------------------------------------------
-- RUBRIK GENERIK (jabatan_target_id NULL) - Formula A: 50% Kinerja + 50% Potensial
-- ---------------------------------------------------------------------
INSERT INTO rubrik_komponen (id, jabatan_target_id, sumbu, nama_komponen, bobot_komponen, urutan) VALUES
(1, NULL, 'Y_KINERJA', 'Kinerja Utama', 1.0000, 1),
(2, NULL, 'X_POTENSIAL', 'Potensi & Kompetensi (Generik)', 1.0000, 1);

INSERT INTO rubrik_indikator (id, rubrik_komponen_id, parent_indikator_id, nama_indikator, bobot_indikator, mode_skor, kebutuhan_data, sumber_data, urutan) VALUES
(1, 1, NULL, 'Penilaian Kinerja', 1.0000, 'KATEGORI_TETAP', 'Predikat Kinerja Triwulan IV/akhir tahun PNS', 'ekinerja.pu.go.id', 1),
(2, 2, NULL, 'Penilaian Potensi dan Kompetensi', 1.0000, 'NILAI_LANGSUNG', 'Nilai Potkom Jabatan saat ini', 'karir.pu.go.id/enom', 1);

INSERT INTO rubrik_kategori_skor (rubrik_indikator_id, nama_kategori, nilai_skor, ambang_min, ambang_max, urutan) VALUES
(1, 'Sangat Baik', 100.00, NULL, NULL, 1),
(1, 'Baik', 80.00, NULL, NULL, 2),
(1, 'Butuh Perbaikan', 60.00, NULL, NULL, 3),
(1, 'Kurang', 40.00, NULL, NULL, 4),
(1, 'Sangat Kurang', 20.00, NULL, NULL, 5),
(2, 'Tinggi', NULL, 80.00, NULL, 1),
(2, 'Menengah', NULL, 60.00, 80.00, 2),
(2, 'Rendah', NULL, NULL, 60.00, 3);

-- ---------------------------------------------------------------------
-- RUBRIK SPESIFIK jabatan_target=1 (Formula B: 65/20/15) - replika persis
-- KERANGKA TALENT POOL.md. Hanya sumbu X_POTENSIAL (match_score tidak
-- melibatkan Kinerja, lihat ERD.md/PRD.md).
-- ---------------------------------------------------------------------
INSERT INTO rubrik_komponen (id, jabatan_target_id, sumbu, nama_komponen, bobot_komponen, urutan) VALUES
(3, 1, 'X_POTENSIAL', 'Potensi & Kompetensi', 0.6500, 1),
(4, 1, 'X_POTENSIAL', 'Kualifikasi Jabatan', 0.2000, 2),
(5, 1, 'X_POTENSIAL', 'Integritas & Moralitas', 0.1500, 3);

INSERT INTO rubrik_indikator (id, rubrik_komponen_id, parent_indikator_id, nama_indikator, bobot_indikator, mode_skor, kebutuhan_data, sumber_data, urutan) VALUES
(3, 3, NULL, 'Penilaian Potensi dan Kompetensi', 0.6500, 'NILAI_LANGSUNG', 'Nilai Potkom Jabatan saat ini', 'karir.pu.go.id/enom', 1),
(4, 4, NULL, 'Tingkat Pendidikan Formal', 0.0500, 'KATEGORI_TETAP', 'Data Riwayat Pendidikan PNS-PENDIDIKAN', 'ehrm.pu.go.id/layanan-kepegawaian', 1),
(5, 4, NULL, 'Kesesuaian Bidang Ilmu', 0.0500, 'KATEGORI_TETAP', 'Data Riwayat Pendidikan PNS - Jurusan/Bidang Studi', 'ehrm.pu.go.id/layanan-kepegawaian', 2),
(6, 4, NULL, 'Pengembangan Kompetensi', 0.0500, 'KATEGORI_TETAP', 'Data Riwayat Diklat / Sertifikasi Keahlian PNS', 'ehrm.pu.go.id/layanan-kepegawaian', 3),
(7, 4, NULL, 'Nilai Pengalaman Jabatan', 0.0500, 'KATEGORI_TETAP', 'Data Riwayat Jabatan PNS', 'ehrm.pu.go.id/layanan-kepegawaian', 4),
(8, 4, 7, 'Lama Jabatan', NULL, 'KATEGORI_TETAP', NULL, NULL, 1),
(9, 4, 7, 'Keragaman Riwayat Jabatan', NULL, 'KATEGORI_TETAP', NULL, NULL, 2),
(10, 4, 7, 'Substansi Riwayat Jabatan', NULL, 'KATEGORI_TETAP', NULL, NULL, 3),
(11, 5, NULL, 'Verifikasi Rekam Jejak Disiplin', 0.1500, 'KATEGORI_TETAP', 'input manual', 'input manual', 1);

INSERT INTO rubrik_kategori_skor (rubrik_indikator_id, nama_kategori, nilai_skor, ambang_min, ambang_max, urutan) VALUES
(3, 'Memenuhi Syarat', NULL, 80.00, NULL, 1),
(3, 'Masih Memenuhi Syarat', NULL, 68.00, 80.00, 2),
(3, 'Kurang Memenuhi Syarat', NULL, NULL, 68.00, 3),
(4, 'Doktor', 100.00, NULL, NULL, 1),
(4, 'Magister', 90.00, NULL, NULL, 2),
(4, 'S1/DIV', 80.00, NULL, NULL, 3),
(4, 'DIII', 70.00, NULL, NULL, 4),
(4, 'SLTA', 60.00, NULL, NULL, 5),
(5, 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, NULL, NULL, 1),
(5, 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, NULL, NULL, 2),
(6, 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, NULL, NULL, 1),
(6, 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, NULL, NULL, 2),
(8, 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, NULL, NULL, 1),
(8, 'Memiliki masa kerja dalam jenjang jabatan 3 sampai dengan 4 tahun', 80.00, NULL, NULL, 2),
(8, 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, NULL, NULL, 3),
(9, 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, NULL, NULL, 1),
(9, 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, NULL, NULL, 2),
(9, 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, NULL, NULL, 3),
(10, 'Memiliki pengalaman penugasan sbg Pelaksana Tugas/Plt pada jenjang jabatan yang lebih tinggi', 100.00, NULL, NULL, 1),
(10, 'Memiliki pengalaman penugasan sbg Pelaksana Tugas/Plt pada jenjang jabatan yang setara', 80.00, NULL, NULL, 2),
(10, 'Memiliki pengalaman penugasan sbg Pelaksana Harian/Plh pada jenjang jabatan yang lebih tinggi', 60.00, NULL, NULL, 3),
(10, 'Memiliki pengalaman penugasan sbg Pelaksana Harian/Plh pada jenjang jabatan yang setara', 40.00, NULL, NULL, 4),
(10, 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, NULL, NULL, 5),
(11, 'Tidak Pernah', 100.00, NULL, NULL, 1),
(11, 'Ringan', 75.00, NULL, NULL, 2),
(11, 'Sedang', 50.00, NULL, NULL, 3),
(11, 'Berat', 25.00, NULL, NULL, 4),
(11, 'Sedang Menjalani', 0.00, NULL, NULL, 5);

-- ---------------------------------------------------------------------
-- MATCH_SCORE: 5 kandidat jabatan_target=1, dihitung manual mengikuti
-- rubrik di atas (65% potensi + 20% kualifikasi[avg 4 indikator] + 15% integritas).
-- Potkom di-cap 100 untuk pembobotan (nilai mentah bisa >100, lihat catatan ERD).
-- ---------------------------------------------------------------------
INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, computed_at) VALUES
(1, 2, 1, 100.00, 92.50, 100.00, 98.50, 1, 'Memenuhi syarat S1 semua jurusan; Potkom 102.50 (di-cap 100 utk pembobotan)', '2026-07-25 09:00:00'),
(2, 3, 1, 100.00, 80.00, 100.00, 96.00, 1, 'Memenuhi syarat; Potkom 115.10 (di-cap 100 utk pembobotan)', '2026-07-25 09:00:00'),
(3, 4, 1, 93.47, 87.50, 100.00, 93.26, 1, 'Memenuhi syarat; riwayat jabatan tercatat masih minim (1 entri)', '2026-07-25 09:00:00'),
(4, 11, 1, 88.00, 88.33, 100.00, 89.87, 1, 'Kandidat promosi vertikal dari Kasi Pengadaan, memenuhi syarat', '2026-07-25 09:00:00'),
(5, 12, 1, 82.00, 75.83, 75.00, 79.72, 1, 'Memenuhi syarat; skor integritas turun akibat riwayat hukuman disiplin ringan', '2026-07-25 09:00:00');

-- ---------------------------------------------------------------------
-- TALENT_POOL (ranking sesuai skor_total, status bervariasi utk demo workflow)
-- ---------------------------------------------------------------------
INSERT INTO talent_pool (id, pegawai_id, jabatan_target_id, match_score_id, ranking, status, catatan_reviewer, ditetapkan_pada, ditetapkan_oleh) VALUES
(1, 2, 1, 1, 1, 'DITETAPKAN', 'Kandidat terbaik, direkomendasikan rotasi ke Kasubdit Pengadaan', '2026-07-28', 6),
(2, 3, 1, 2, 2, 'DIVERIFIKASI', 'Sudah diverifikasi Bagian Kepegawaian, menunggu keputusan pimpinan', NULL, NULL),
(3, 4, 1, 3, 3, 'DINOMINASIKAN', 'Diajukan unit, menunggu verifikasi', NULL, NULL),
(4, 11, 1, 4, 4, 'KANDIDAT', 'Kandidat promosi vertikal, potensi kuat utk jangka menengah', NULL, NULL),
(5, 12, 1, 5, 5, 'KANDIDAT', 'Perlu pembinaan lanjutan terkait rekam jejak disiplin', NULL, NULL);

-- ---------------------------------------------------------------------
-- NOMINASI + APPROVAL_LOG (Irwan: selesai penuh; Yatno: terverifikasi;
-- Iwan: baru diajukan, menunggu verifikasi)
-- ---------------------------------------------------------------------
INSERT INTO nominasi (id, talent_pool_id, diajukan_oleh_unit_id, diajukan_oleh_user_id, tanggal_diajukan, status, catatan) VALUES
(1, 1, 11, 3, '2026-07-10', 'DISETUJUI', 'Diajukan oleh BP2JK Wilayah DKI Jakarta sebagai kandidat suksesor Kasubdit Pengadaan'),
(2, 2, 12, 4, '2026-07-12', 'DISETUJUI', 'Diajukan oleh BP2JK Wilayah Maluku Utara'),
(3, 3, 13, 5, '2026-07-20', 'MENUNGGU_VERIFIKASI', 'Diajukan oleh BP2JK Wilayah D.I. Yogyakarta');

INSERT INTO approval_log (nominasi_id, tahap, status, approver_user_id, catatan, tanggal_aksi) VALUES
(1, 'Verifikasi Kepegawaian', 'DISETUJUI', 2, 'Data lengkap dan valid, memenuhi seluruh persyaratan jabatan target', '2026-07-15 09:00:00'),
(1, 'Persetujuan Pimpinan', 'DISETUJUI', 6, 'Disetujui sebagai suksesor Kasubdit Pengadaan', '2026-07-28 14:00:00'),
(2, 'Verifikasi Kepegawaian', 'DISETUJUI', 2, 'Data lengkap dan valid', '2026-07-18 09:00:00');

-- ---------------------------------------------------------------------
-- RENCANA_PENGEMBANGAN (utk suksesor yang sudah DITETAPKAN)
-- ---------------------------------------------------------------------
INSERT INTO rencana_pengembangan (talent_pool_id, jenis_pengembangan, deskripsi, target_selesai, status, dibuat_oleh) VALUES
(1, 'ROTASI', 'Rotasi dari Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah DKI Jakarta menjadi Kepala Subdirektorat Pengadaan, didahului program transisi/serah terima selama 3 bulan bersama pejabat lama', '2027-01-31', 'DIRENCANAKAN', 2),
(1, 'MENTORING', 'Mentoring teknis pengadaan konstruksi lanjutan bersama Direktur Pengadaan Jasa Konstruksi selama masa transisi', '2027-01-31', 'DIRENCANAKAN', 2);

-- ---------------------------------------------------------------------
-- API_CLIENT, API_TOKEN, API_ACTIVITY_LOG
-- ---------------------------------------------------------------------
INSERT INTO api_client (id, nama_instansi, kode_instansi, contact_person, email, no_mou, status, scope_akses) VALUES
(1, 'Badan Kepegawaian Negara', 'BKN', 'Ir. Wahyu Nugroho', 'data.talenta@bkn.go.id', 'MoU/BKN-PUPR/2026/001', 'AKTIF', JSON_OBJECT('endpoints', JSON_ARRAY('talent-pool', 'kotak-9-summary'), 'data_personal', false)),
(2, 'Biro Kepegawaian dan Ortala Kementerian PU', 'BIROKEPEG-PU', 'Dra. Anita Puspita', 'kepegawaian@pu.go.id', 'NK/BIROKEPEG/2026/014', 'AKTIF', JSON_OBJECT('endpoints', JSON_ARRAY('pegawai', 'talent-pool', 'kotak-9-summary'), 'data_personal', true)),
(3, 'Kementerian PANRB', 'KEMENPANRB', 'Drs. Bambang Setiawan', 'talenta@menpan.go.id', NULL, 'PENDING', JSON_OBJECT());

INSERT INTO api_token (id, api_client_id, token_hash, label, expired_at, last_used_at, status, created_by) VALUES
(1, 1, 'sha256:9f2b1c4e6a7d8f0123456789abcdef0123456789abcdef0123456789abcdef0', 'Token Produksi BKN 2026', '2027-12-31 23:59:59', '2026-07-29 08:12:00', 'AKTIF', 1),
(2, 2, 'sha256:a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f9', 'Token Produksi Biro Kepegawaian 2026', '2027-12-31 23:59:59', '2026-07-28 16:40:00', 'AKTIF', 1),
(3, 1, 'sha256:0011223344556677889900aabbccddeeff00112233445566778899aabbccdd', 'Token Lama BKN (dicabut, rotasi kredensial)', '2026-06-30 23:59:59', '2026-05-10 11:00:00', 'DICABUT', 1);

INSERT INTO api_activity_log (api_client_id, api_token_id, endpoint, method, response_code, response_time_ms, ip_address, created_at) VALUES
(1, 1, '/api/v1/kotak-9/summary', 'GET', 200, 82, '10.20.30.11', '2026-07-29 08:12:00'),
(1, 1, '/api/v1/talent-pool?jabatan_target=1', 'GET', 200, 145, '10.20.30.11', '2026-07-29 08:13:20'),
(2, 2, '/api/v1/pegawai?unit=BP2JK-DKI', 'GET', 200, 176, '10.20.31.5', '2026-07-28 16:40:00'),
(2, 2, '/api/v1/pegawai/197907292005021003', 'GET', 200, 98, '10.20.31.5', '2026-07-28 16:41:05'),
(1, 3, '/api/v1/talent-pool', 'GET', 401, 12, '10.20.30.11', '2026-06-29 09:00:00');

-- ---------------------------------------------------------------------
-- SYNC_LOG
-- ---------------------------------------------------------------------
INSERT INTO sync_log (sumber_sistem, jenis_data, status, jumlah_baris, mulai_pada, selesai_pada, catatan_error, dijalankan_oleh) VALUES
('eHRM', 'Data biografis & riwayat pegawai', 'SEBAGIAN', 16, '2026-07-20 08:00:00', '2026-07-20 08:04:32', 'Kolom Unit Kerja pada NIP 197907292005021003 (Irwan) terindikasi tertukar dengan teks riwayat jabatan - butuh verifikasi manual sebelum dipetakan ke jabatan_id', 1),
('eNominasi', 'Hasil asesmen & Kotak 9', 'SUKSES', 9, '2026-07-20 08:05:00', '2026-07-20 08:06:10', NULL, 1),
('eKinerja', 'Rekap kinerja triwulan', 'SUKSES', 20, '2026-07-20 08:06:30', '2026-07-20 08:07:45', NULL, 1),
('Manual', 'Input data hukuman disiplin', 'SUKSES', 2, '2026-07-22 10:00:00', '2026-07-22 10:05:00', NULL, 2);

-- ---------------------------------------------------------------------
-- AUDIT_LOG (contoh jejak audit)
-- ---------------------------------------------------------------------
INSERT INTO audit_log (user_id, aksi, entitas, entitas_id, data_sebelum, data_sesudah, ip_address, created_at) VALUES
(2, 'CREATE', 'jabatan_target', 1, NULL, JSON_OBJECT('kode_target', 'JT-KABALAI-BP2JK-KASUBDIT-PENGADAAN', 'status', 'DRAFT'), '192.168.1.50', '2026-07-24 09:00:00'),
(2, 'UPDATE', 'jabatan_target', 1, JSON_OBJECT('status', 'DRAFT'), JSON_OBJECT('status', 'AKTIF'), '192.168.1.50', '2026-07-24 11:30:00'),
(2, 'UPDATE', 'hukuman_disiplin', 1, JSON_OBJECT('status_aktif', 0), JSON_OBJECT('status_aktif', 1), '192.168.1.50', '2026-07-22 10:04:00'),
(6, 'APPROVE', 'approval_log', 2, JSON_OBJECT('status', 'MENUNGGU'), JSON_OBJECT('status', 'DISETUJUI'), '192.168.1.10', '2026-07-28 14:00:00'),
(NULL, 'SYNC', 'sync_log', 1, NULL, JSON_OBJECT('status', 'SEBAGIAN', 'jumlah_baris', 16), 'system', '2026-07-20 08:04:32');

-- ---------------------------------------------------------------------
-- Samakan AUTO_INCREMENT counter setelah insert dengan id eksplisit
-- ---------------------------------------------------------------------
ALTER TABLE roles AUTO_INCREMENT = 6;
ALTER TABLE unit_organisasi AUTO_INCREMENT = 18;
ALTER TABLE users AUTO_INCREMENT = 9;
ALTER TABLE jabatan AUTO_INCREMENT = 16;
ALTER TABLE pegawai AUTO_INCREMENT = 17;
ALTER TABLE jabatan_target AUTO_INCREMENT = 2;
ALTER TABLE rubrik_komponen AUTO_INCREMENT = 6;
ALTER TABLE rubrik_indikator AUTO_INCREMENT = 12;
ALTER TABLE match_score AUTO_INCREMENT = 6;
ALTER TABLE talent_pool AUTO_INCREMENT = 6;
ALTER TABLE nominasi AUTO_INCREMENT = 4;
ALTER TABLE api_client AUTO_INCREMENT = 4;
ALTER TABLE api_token AUTO_INCREMENT = 4;

SET FOREIGN_KEY_CHECKS = 1;
