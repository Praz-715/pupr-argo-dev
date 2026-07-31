-- =====================================================================
-- SIMT DJBK - 007 Recompute
--
-- DIHASILKAN OLEH scripts/recompute.ts — jangan diedit tangan.
-- Regenerasi (setelah 001–006 tereksekusi):
--   npm run db:recompute
--
-- Seluruh angka di berkas ini adalah OUTPUT lib/scoring + lib/penilaian +
-- lib/skor-massal, bukan hitungan manual. Kalau ada nilai di DB yang tidak
-- bisa dilahirkan ulang oleh kode, selisihnya akan terlihat saat berkas ini
-- diregenerasi atau saat `npm run verifikasi:skoring` dijalankan.
--
-- Acuan waktu perhitungan : 2026-07-30
-- Masa berlaku asesmen     : 3 tahun (phase.md §2.9)
-- URUTAN JALANKAN: 001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. asesmen_talenta: nilai turunan Formula A
--    nilai_potensial_x dihitung lewat rubrik generik di DB (bukan
--    menyalin potkom), supaya jalurnya sama dengan yang dipakai UI.
--    46 baris.
-- ---------------------------------------------------------------------
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 97.50, nilai_talenta = 88.75, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 1;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 88.40, nilai_talenta = 84.20, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Expired', sumber_sync = 'recalculated' WHERE id = 41;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 98.00, nilai_talenta = 89.00, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 2;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 91.20, nilai_talenta = 85.60, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 42;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 99.50, nilai_talenta = 89.75, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 3;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 93.47, nilai_talenta = 86.74, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 4;
UPDATE asesmen_talenta SET nilai_kinerja_y = 100.00, nilai_potensial_x = 76.04, nilai_talenta = 88.02, kotak_9 = 7, nilai_integritas = 100.00, status_asesmen = 'Expired', sumber_sync = 'recalculated' WHERE id = 5;
UPDATE asesmen_talenta SET nilai_kinerja_y = 100.00, nilai_potensial_x = 98.50, nilai_talenta = 99.25, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 6;
UPDATE asesmen_talenta SET nilai_kinerja_y = 100.00, nilai_potensial_x = 69.58, nilai_talenta = 84.79, kotak_9 = 7, nilai_integritas = 100.00, status_asesmen = 'Expired', sumber_sync = 'recalculated' WHERE id = 7;
UPDATE asesmen_talenta SET nilai_kinerja_y = 100.00, nilai_potensial_x = 61.74, nilai_talenta = 80.87, kotak_9 = 7, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 8;
UPDATE asesmen_talenta SET nilai_kinerja_y = 100.00, nilai_potensial_x = 90.16, nilai_talenta = 95.08, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 9;
UPDATE asesmen_talenta SET nilai_kinerja_y = 100.00, nilai_potensial_x = 99.00, nilai_talenta = 99.50, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 10;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 79.50, nilai_talenta = 79.75, kotak_9 = 7, nilai_integritas = 100.00, status_asesmen = 'Expired', sumber_sync = 'recalculated' WHERE id = 43;
UPDATE asesmen_talenta SET nilai_kinerja_y = 100.00, nilai_potensial_x = 88.00, nilai_talenta = 94.00, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 11;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 74.00, nilai_talenta = 67.00, kotak_9 = 5, nilai_integritas = 75.00, status_asesmen = 'Expired', sumber_sync = 'recalculated' WHERE id = 44;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 82.00, nilai_talenta = 81.00, kotak_9 = 9, nilai_integritas = 75.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 12;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 65.00, nilai_talenta = 72.50, kotak_9 = 7, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 13;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 58.00, nilai_talenta = 59.00, kotak_9 = 2, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 14;
UPDATE asesmen_talenta SET nilai_kinerja_y = 100.00, nilai_potensial_x = 97.00, nilai_talenta = 98.50, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 15;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 70.00, nilai_talenta = 75.00, kotak_9 = 7, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 16;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 80.00, nilai_talenta = 80.00, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Expired', sumber_sync = 'recalculated' WHERE id = 45;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 85.00, nilai_talenta = 72.50, kotak_9 = 8, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 17;
UPDATE asesmen_talenta SET nilai_kinerja_y = 100.00, nilai_potensial_x = 83.10, nilai_talenta = 91.55, kotak_9 = 9, nilai_integritas = 100.00, status_asesmen = 'Expired', sumber_sync = 'recalculated' WHERE id = 46;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 88.00, nilai_talenta = 74.00, kotak_9 = 8, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 18;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 82.00, nilai_talenta = 71.00, kotak_9 = 8, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 19;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 91.00, nilai_talenta = 75.50, kotak_9 = 8, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 20;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 74.00, nilai_talenta = 77.00, kotak_9 = 7, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 21;
UPDATE asesmen_talenta SET nilai_kinerja_y = 40.00, nilai_potensial_x = 86.00, nilai_talenta = 63.00, kotak_9 = 6, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 22;
UPDATE asesmen_talenta SET nilai_kinerja_y = 40.00, nilai_potensial_x = 83.00, nilai_talenta = 61.50, kotak_9 = 6, nilai_integritas = 75.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 23;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 72.00, nilai_talenta = 66.00, kotak_9 = 5, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 24;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 68.00, nilai_talenta = 64.00, kotak_9 = 5, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 25;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 76.00, nilai_talenta = 68.00, kotak_9 = 5, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 26;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 63.00, nilai_talenta = 61.50, kotak_9 = 5, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 27;
UPDATE asesmen_talenta SET nilai_kinerja_y = 100.00, nilai_potensial_x = 55.00, nilai_talenta = 77.50, kotak_9 = 4, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 28;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 48.00, nilai_talenta = 64.00, kotak_9 = 4, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 29;
UPDATE asesmen_talenta SET nilai_kinerja_y = 100.00, nilai_potensial_x = 52.00, nilai_talenta = 76.00, kotak_9 = 4, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 30;
UPDATE asesmen_talenta SET nilai_kinerja_y = 80.00, nilai_potensial_x = 57.00, nilai_talenta = 68.50, kotak_9 = 4, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 31;
UPDATE asesmen_talenta SET nilai_kinerja_y = 40.00, nilai_potensial_x = 66.00, nilai_talenta = 53.00, kotak_9 = 3, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 32;
UPDATE asesmen_talenta SET nilai_kinerja_y = 20.00, nilai_potensial_x = 71.00, nilai_talenta = 45.50, kotak_9 = 3, nilai_integritas = 0.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 33;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 54.00, nilai_talenta = 57.00, kotak_9 = 2, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 34;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 47.00, nilai_talenta = 53.50, kotak_9 = 2, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 35;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 58.00, nilai_talenta = 59.00, kotak_9 = 2, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 36;
UPDATE asesmen_talenta SET nilai_kinerja_y = 60.00, nilai_potensial_x = 51.00, nilai_talenta = 55.50, kotak_9 = 2, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 37;
UPDATE asesmen_talenta SET nilai_kinerja_y = 40.00, nilai_potensial_x = 44.00, nilai_talenta = 42.00, kotak_9 = 1, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 38;
UPDATE asesmen_talenta SET nilai_kinerja_y = 20.00, nilai_potensial_x = 38.00, nilai_talenta = 29.00, kotak_9 = 1, nilai_integritas = 25.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 39;
UPDATE asesmen_talenta SET nilai_kinerja_y = 40.00, nilai_potensial_x = 56.00, nilai_talenta = 48.00, kotak_9 = 1, nilai_integritas = 100.00, status_asesmen = 'Berlaku', sumber_sync = 'recalculated' WHERE id = 40;

-- ---------------------------------------------------------------------
-- 2. match_score + match_score_detail
--    120 baris skor (3 jabatan target x 40 pegawai),
--    1080 baris rincian indikator.
--
--    Dihitung untuk SELURUH pegawai, bukan hanya yang lolos syarat —
--    kolom `eligible` yang membedakan. Ini mengikuti Garis Besar Proses
--    Blueprint: seleksi kelayakan dan match scoring adalah dua langkah
--    terpisah, dan skor kandidat tidak lolos tetap berguna sebagai
--    pembanding di halaman Kandidat & Eligibility Check.
-- ---------------------------------------------------------------------
DELETE FROM match_score_detail;
DELETE FROM match_score;
ALTER TABLE match_score AUTO_INCREMENT = 1;
ALTER TABLE match_score_detail AUTO_INCREMENT = 1;

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (1, 1, 1, 97.50, 85.83, 100.00, 95.54, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (1, 3, NULL, 0.6500, '97.5', 'Memenuhi Syarat', 97.50, 'OTOMATIS', 0),
  (1, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (1, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (1, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (1, 7, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (1, 8, 7, NULL, '1.03', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (1, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (1, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (1, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (2, 2, 1, 98.00, 89.17, 100.00, 96.53, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (2, 3, NULL, 0.6500, '98', 'Memenuhi Syarat', 98.00, 'OTOMATIS', 0),
  (2, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (2, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (2, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (2, 7, NULL, 0.0500, NULL, NULL, 66.67, 'OTOMATIS', 0),
  (2, 8, 7, NULL, '13.03', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (2, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (2, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (2, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (3, 3, 1, 99.50, 85.83, 100.00, 96.84, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (3, 3, NULL, 0.6500, '99.5', 'Memenuhi Syarat', 99.50, 'OTOMATIS', 0),
  (3, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (3, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (3, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (3, 7, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (3, 8, 7, NULL, '1.03', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (3, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (3, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (3, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (4, 4, 1, 93.47, 82.50, 100.00, 92.26, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (4, 3, NULL, 0.6500, '93.47', 'Memenuhi Syarat', 93.47, 'OTOMATIS', 0),
  (4, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (4, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (4, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (4, 7, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (4, 8, 7, NULL, '1.03', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (4, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (4, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (4, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (5, 5, 1, 76.04, 82.50, 100.00, 80.93, 0, 'Tidak memenuhi 2 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV; Asesmen tahun 2021 sudah kedaluwarsa atau berstatus draft', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (5, 3, NULL, 0.6500, '76.04', 'Masih Memenuhi Syarat', 76.04, 'OTOMATIS', 0),
  (5, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (5, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (5, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (5, 7, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (5, 8, 7, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (5, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (5, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (5, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (6, 6, 1, 98.50, 80.00, 100.00, 95.03, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (6, 3, NULL, 0.6500, '98.5', 'Memenuhi Syarat', 98.50, 'OTOMATIS', 0),
  (6, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (6, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (6, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (6, 7, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (6, 8, 7, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (6, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (6, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (6, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (7, 7, 1, 69.58, 82.50, 100.00, 76.73, 0, 'Tidak memenuhi 2 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV; Asesmen tahun 2022 sudah kedaluwarsa atau berstatus draft', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (7, 3, NULL, 0.6500, '69.58', 'Masih Memenuhi Syarat', 69.58, 'OTOMATIS', 0),
  (7, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (7, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (7, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (7, 7, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (7, 8, 7, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (7, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (7, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (7, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (8, 8, 1, 61.74, 80.00, 100.00, 71.13, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (8, 3, NULL, 0.6500, '61.74', 'Kurang Memenuhi Syarat', 61.74, 'OTOMATIS', 0),
  (8, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (8, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (8, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (8, 7, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (8, 8, 7, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (8, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (8, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (8, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (9, 9, 1, 90.16, 82.50, 100.00, 90.10, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (9, 3, NULL, 0.6500, '90.16', 'Memenuhi Syarat', 90.16, 'OTOMATIS', 0),
  (9, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (9, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (9, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (9, 7, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (9, 8, 7, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (9, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (9, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (9, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (10, 10, 1, 99.00, 87.50, 100.00, 96.85, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (10, 3, NULL, 0.6500, '99', 'Memenuhi Syarat', 99.00, 'OTOMATIS', 0),
  (10, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (10, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (10, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (10, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (10, 8, 7, NULL, '2.56', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (10, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (10, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (10, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (11, 11, 1, 88.00, 85.00, 100.00, 89.20, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (11, 3, NULL, 0.6500, '88', 'Memenuhi Syarat', 88.00, 'OTOMATIS', 0),
  (11, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (11, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (11, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (11, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (11, 8, 7, NULL, '4.16', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (11, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (11, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (11, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (12, 12, 1, 82.00, 70.83, 75.00, 78.72, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (12, 3, NULL, 0.6500, '82', 'Memenuhi Syarat', 82.00, 'OTOMATIS', 0),
  (12, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (12, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (12, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (12, 7, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (12, 8, 7, NULL, '1.47', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (12, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (12, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (12, 11, NULL, 0.1500, 'Ringan', 'Ringan', 75.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (13, 13, 1, 65.00, 69.17, 100.00, 71.08, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (13, 3, NULL, 0.6500, '65', 'Kurang Memenuhi Syarat', 65.00, 'OTOMATIS', 0),
  (13, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (13, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (13, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (13, 7, NULL, 0.0500, NULL, NULL, 46.67, 'OTOMATIS', 0),
  (13, 8, 7, NULL, '3.41', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (13, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (13, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (13, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (14, 14, 1, 58.00, 83.33, 100.00, 69.37, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (14, 3, NULL, 0.6500, '58', 'Kurang Memenuhi Syarat', 58.00, 'OTOMATIS', 0),
  (14, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (14, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (14, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (14, 7, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (14, 8, 7, NULL, '6.58', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (14, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (14, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (14, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (15, 15, 1, 97.00, 76.67, 100.00, 93.38, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (15, 3, NULL, 0.6500, '97', 'Memenuhi Syarat', 97.00, 'OTOMATIS', 0),
  (15, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (15, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (15, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (15, 7, NULL, 0.0500, NULL, NULL, 66.67, 'OTOMATIS', 0),
  (15, 8, 7, NULL, '7.33', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (15, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (15, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (15, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (16, 16, 1, 70.00, 69.17, 100.00, 74.33, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (16, 3, NULL, 0.6500, '70', 'Masih Memenuhi Syarat', 70.00, 'OTOMATIS', 0),
  (16, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (16, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (16, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (16, 7, NULL, 0.0500, NULL, NULL, 46.67, 'OTOMATIS', 0),
  (16, 8, 7, NULL, '3.83', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (16, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (16, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (16, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (17, 17, 1, 85.00, 87.50, 100.00, 87.75, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (17, 3, NULL, 0.6500, '85', 'Memenuhi Syarat', 85.00, 'OTOMATIS', 0),
  (17, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (17, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (17, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (17, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (17, 8, 7, NULL, '4.41', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (17, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (17, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (17, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (18, 18, 1, 88.00, 85.83, 100.00, 89.37, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (18, 3, NULL, 0.6500, '88', 'Memenuhi Syarat', 88.00, 'OTOMATIS', 0),
  (18, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (18, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (18, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (18, 7, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (18, 8, 7, NULL, '5.16', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (18, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (18, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (18, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (19, 19, 1, 82.00, 91.67, 100.00, 86.63, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (19, 3, NULL, 0.6500, '82', 'Memenuhi Syarat', 82.00, 'OTOMATIS', 0),
  (19, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (19, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (19, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (19, 7, NULL, 0.0500, NULL, NULL, 86.67, 'OTOMATIS', 0),
  (19, 8, 7, NULL, '7.49', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (19, 9, 7, NULL, '80', 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, 'OTOMATIS', 0),
  (19, 10, 7, NULL, '80', 'Memiliki pengalaman penugasan sbg Pelaksana Tugas/Plt pada jenjang jabatan yang setara', 80.00, 'OTOMATIS', 0),
  (19, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (20, 20, 1, 91.00, 85.83, 100.00, 91.32, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (20, 3, NULL, 0.6500, '91', 'Memenuhi Syarat', 91.00, 'OTOMATIS', 0),
  (20, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (20, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (20, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (20, 7, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (20, 8, 7, NULL, '4.57', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (20, 9, 7, NULL, '80', 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, 'OTOMATIS', 0),
  (20, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (20, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (21, 21, 1, 74.00, 83.33, 100.00, 79.77, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (21, 3, NULL, 0.6500, '74', 'Masih Memenuhi Syarat', 74.00, 'OTOMATIS', 0),
  (21, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (21, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (21, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (21, 7, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (21, 8, 7, NULL, '3.49', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (21, 9, 7, NULL, '80', 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, 'OTOMATIS', 0),
  (21, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (21, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (22, 22, 1, 86.00, 87.50, 100.00, 88.40, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (22, 3, NULL, 0.6500, '86', 'Memenuhi Syarat', 86.00, 'OTOMATIS', 0),
  (22, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (22, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (22, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (22, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (22, 8, 7, NULL, '3', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (22, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (22, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (22, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (23, 23, 1, 83.00, 72.50, 75.00, 79.70, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (23, 3, NULL, 0.6500, '83', 'Memenuhi Syarat', 83.00, 'OTOMATIS', 0),
  (23, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (23, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (23, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (23, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (23, 8, 7, NULL, '4.24', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (23, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (23, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (23, 11, NULL, 0.1500, 'Ringan', 'Ringan', 75.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (24, 24, 1, 72.00, 72.50, 100.00, 76.30, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (24, 3, NULL, 0.6500, '72', 'Masih Memenuhi Syarat', 72.00, 'OTOMATIS', 0),
  (24, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (24, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (24, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (24, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (24, 8, 7, NULL, '3.57', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (24, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (24, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (24, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (25, 25, 1, 68.00, 77.50, 100.00, 74.70, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (25, 3, NULL, 0.6500, '68', 'Masih Memenuhi Syarat', 68.00, 'OTOMATIS', 0),
  (25, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (25, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (25, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (25, 7, NULL, 0.0500, NULL, NULL, 80.00, 'OTOMATIS', 0),
  (25, 8, 7, NULL, '5.49', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (25, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (25, 10, 7, NULL, '40', 'Memiliki pengalaman penugasan sbg Pelaksana Harian/Plh pada jenjang jabatan yang setara', 40.00, 'OTOMATIS', 0),
  (25, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (26, 26, 1, 76.00, 76.67, 100.00, 79.73, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (26, 3, NULL, 0.6500, '76', 'Masih Memenuhi Syarat', 76.00, 'OTOMATIS', 0),
  (26, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (26, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (26, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (26, 7, NULL, 0.0500, NULL, NULL, 66.67, 'OTOMATIS', 0),
  (26, 8, 7, NULL, '5.33', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (26, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (26, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (26, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (27, 27, 1, 63.00, 72.50, 100.00, 70.45, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (27, 3, NULL, 0.6500, '63', 'Kurang Memenuhi Syarat', 63.00, 'OTOMATIS', 0),
  (27, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (27, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (27, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (27, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (27, 8, 7, NULL, '2.57', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (27, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (27, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (27, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (28, 28, 1, 55.00, 75.00, 100.00, 65.75, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (28, 3, NULL, 0.6500, '55', 'Kurang Memenuhi Syarat', 55.00, 'OTOMATIS', 0),
  (28, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (28, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (28, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (28, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (28, 8, 7, NULL, '6.49', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (28, 9, 7, NULL, '80', 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, 'OTOMATIS', 0),
  (28, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (28, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (29, 29, 1, 48.00, 72.50, 100.00, 60.70, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (29, 3, NULL, 0.6500, '48', 'Kurang Memenuhi Syarat', 48.00, 'OTOMATIS', 0),
  (29, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (29, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (29, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (29, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (29, 8, 7, NULL, '3.24', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (29, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (29, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (29, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (30, 30, 1, 52.00, 76.67, 100.00, 64.13, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (30, 3, NULL, 0.6500, '52', 'Kurang Memenuhi Syarat', 52.00, 'OTOMATIS', 0),
  (30, 4, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (30, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (30, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (30, 7, NULL, 0.0500, NULL, NULL, 66.67, 'OTOMATIS', 0),
  (30, 8, 7, NULL, '5.57', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (30, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (30, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (30, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (31, 31, 1, 57.00, 69.17, 100.00, 65.88, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (31, 3, NULL, 0.6500, '57', 'Kurang Memenuhi Syarat', 57.00, 'OTOMATIS', 0),
  (31, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (31, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (31, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (31, 7, NULL, 0.0500, NULL, NULL, 46.67, 'OTOMATIS', 0),
  (31, 8, 7, NULL, '2.91', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (31, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (31, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (31, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (32, 32, 1, 66.00, 85.00, 100.00, 74.90, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (32, 3, NULL, 0.6500, '66', 'Kurang Memenuhi Syarat', 66.00, 'OTOMATIS', 0),
  (32, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (32, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (32, 6, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (32, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (32, 8, 7, NULL, '2.41', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (32, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (32, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (32, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (33, 33, 1, 71.00, 66.67, 0.00, 59.48, 0, 'Tidak memenuhi 2 syarat: Pendidikan D3 di bawah syarat minimal S1_D4; Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (33, 3, NULL, 0.6500, '71', 'Masih Memenuhi Syarat', 71.00, 'OTOMATIS', 0),
  (33, 4, NULL, 0.0500, 'DIII', 'DIII', 70.00, 'OTOMATIS', 0),
  (33, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (33, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (33, 7, NULL, 0.0500, NULL, NULL, 46.67, 'OTOMATIS', 0),
  (33, 8, 7, NULL, '4.33', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (33, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (33, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (33, 11, NULL, 0.1500, 'Sedang Menjalani', 'Sedang Menjalani', 0.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (34, 34, 1, 54.00, 72.50, 100.00, 64.60, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (34, 3, NULL, 0.6500, '54', 'Kurang Memenuhi Syarat', 54.00, 'OTOMATIS', 0),
  (34, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (34, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (34, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (34, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (34, 8, 7, NULL, '3.16', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (34, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (34, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (34, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (35, 35, 1, 47.00, 72.50, 100.00, 60.05, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (35, 3, NULL, 0.6500, '47', 'Kurang Memenuhi Syarat', 47.00, 'OTOMATIS', 0),
  (35, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (35, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (35, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (35, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (35, 8, 7, NULL, '4.41', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (35, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (35, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (35, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (36, 36, 1, 58.00, 70.83, 100.00, 66.87, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (36, 3, NULL, 0.6500, '58', 'Kurang Memenuhi Syarat', 58.00, 'OTOMATIS', 0),
  (36, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (36, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (36, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (36, 7, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (36, 8, 7, NULL, '6.33', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (36, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (36, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (36, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (37, 37, 1, 51.00, 72.50, 100.00, 62.65, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (37, 3, NULL, 0.6500, '51', 'Kurang Memenuhi Syarat', 51.00, 'OTOMATIS', 0),
  (37, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (37, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (37, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (37, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (37, 8, 7, NULL, '3.74', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (37, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (37, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (37, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (38, 38, 1, 44.00, 70.83, 100.00, 57.77, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (38, 3, NULL, 0.6500, '44', 'Kurang Memenuhi Syarat', 44.00, 'OTOMATIS', 0),
  (38, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (38, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (38, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (38, 7, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (38, 8, 7, NULL, '5.33', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (38, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (38, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (38, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (39, 39, 1, 38.00, 67.50, 25.00, 41.95, 0, 'Tidak memenuhi 1 syarat: Pendidikan SLTA di bawah syarat minimal S1_D4', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (39, 3, NULL, 0.6500, '38', 'Kurang Memenuhi Syarat', 38.00, 'OTOMATIS', 0),
  (39, 4, NULL, 0.0500, 'SLTA', 'SLTA', 60.00, 'OTOMATIS', 0),
  (39, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (39, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (39, 7, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (39, 8, 7, NULL, '2.16', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (39, 9, 7, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (39, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (39, 11, NULL, 0.1500, 'Berat', 'Berat', 25.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (40, 40, 1, 56.00, 67.50, 100.00, 64.90, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal IV', '{"komponen":[{"id":3,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":3,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":4,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":4,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":5,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":6,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":7,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":8,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":9,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":10,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":5,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":11,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (40, 3, NULL, 0.6500, '56', 'Kurang Memenuhi Syarat', 56.00, 'OTOMATIS', 0),
  (40, 4, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (40, 5, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (40, 6, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (40, 7, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (40, 8, 7, NULL, '1.57', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (40, 9, 7, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (40, 10, 7, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (40, 11, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (41, 1, 2, 97.50, 85.83, 100.00, 95.54, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (41, 12, NULL, 0.6500, '97.5', 'Memenuhi Syarat', 97.50, 'OTOMATIS', 0),
  (41, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (41, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (41, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (41, 16, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (41, 17, 16, NULL, '1.03', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (41, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (41, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (41, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (42, 2, 2, 98.00, 89.17, 100.00, 96.53, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (42, 12, NULL, 0.6500, '98', 'Memenuhi Syarat', 98.00, 'OTOMATIS', 0),
  (42, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (42, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (42, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (42, 16, NULL, 0.0500, NULL, NULL, 66.67, 'OTOMATIS', 0),
  (42, 17, 16, NULL, '13.03', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (42, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (42, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (42, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (43, 3, 2, 99.50, 85.83, 100.00, 96.84, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (43, 12, NULL, 0.6500, '99.5', 'Memenuhi Syarat', 99.50, 'OTOMATIS', 0),
  (43, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (43, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (43, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (43, 16, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (43, 17, 16, NULL, '1.03', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (43, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (43, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (43, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (44, 4, 2, 93.47, 82.50, 100.00, 92.26, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (44, 12, NULL, 0.6500, '93.47', 'Memenuhi Syarat', 93.47, 'OTOMATIS', 0),
  (44, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (44, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (44, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (44, 16, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (44, 17, 16, NULL, '1.03', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (44, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (44, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (44, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (45, 5, 2, 76.04, 82.50, 100.00, 80.93, 0, 'Tidak memenuhi 2 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III; Asesmen tahun 2021 sudah kedaluwarsa atau berstatus draft', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (45, 12, NULL, 0.6500, '76.04', 'Masih Memenuhi Syarat', 76.04, 'OTOMATIS', 0),
  (45, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (45, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (45, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (45, 16, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (45, 17, 16, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (45, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (45, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (45, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (46, 6, 2, 98.50, 80.00, 100.00, 95.03, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (46, 12, NULL, 0.6500, '98.5', 'Memenuhi Syarat', 98.50, 'OTOMATIS', 0),
  (46, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (46, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (46, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (46, 16, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (46, 17, 16, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (46, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (46, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (46, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (47, 7, 2, 69.58, 82.50, 100.00, 76.73, 0, 'Tidak memenuhi 2 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III; Asesmen tahun 2022 sudah kedaluwarsa atau berstatus draft', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (47, 12, NULL, 0.6500, '69.58', 'Masih Memenuhi Syarat', 69.58, 'OTOMATIS', 0),
  (47, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (47, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (47, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (47, 16, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (47, 17, 16, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (47, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (47, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (47, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (48, 8, 2, 61.74, 80.00, 100.00, 71.13, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (48, 12, NULL, 0.6500, '61.74', 'Kurang Memenuhi Syarat', 61.74, 'OTOMATIS', 0),
  (48, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (48, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (48, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (48, 16, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (48, 17, 16, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (48, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (48, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (48, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (49, 9, 2, 90.16, 82.50, 100.00, 90.10, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (49, 12, NULL, 0.6500, '90.16', 'Memenuhi Syarat', 90.16, 'OTOMATIS', 0),
  (49, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (49, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (49, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (49, 16, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (49, 17, 16, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (49, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (49, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (49, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (50, 10, 2, 99.00, 87.50, 100.00, 96.85, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (50, 12, NULL, 0.6500, '99', 'Memenuhi Syarat', 99.00, 'OTOMATIS', 0),
  (50, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (50, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (50, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (50, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (50, 17, 16, NULL, '2.56', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (50, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (50, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (50, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (51, 11, 2, 88.00, 85.00, 100.00, 89.20, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi IV di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (51, 12, NULL, 0.6500, '88', 'Memenuhi Syarat', 88.00, 'OTOMATIS', 0),
  (51, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (51, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (51, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (51, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (51, 17, 16, NULL, '4.16', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (51, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (51, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (51, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (52, 12, 2, 82.00, 83.33, 75.00, 81.22, 0, 'Tidak memenuhi 1 syarat: Pendidikan S1_D4 di bawah syarat minimal S2', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (52, 12, NULL, 0.6500, '82', 'Memenuhi Syarat', 82.00, 'OTOMATIS', 0),
  (52, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (52, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (52, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (52, 16, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (52, 17, 16, NULL, '1.47', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (52, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (52, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (52, 20, NULL, 0.1500, 'Ringan', 'Ringan', 75.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (53, 13, 2, 65.00, 81.67, 100.00, 73.58, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi IV di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (53, 12, NULL, 0.6500, '65', 'Kurang Memenuhi Syarat', 65.00, 'OTOMATIS', 0),
  (53, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (53, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (53, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (53, 16, NULL, 0.0500, NULL, NULL, 46.67, 'OTOMATIS', 0),
  (53, 17, 16, NULL, '3.41', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (53, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (53, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (53, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (54, 14, 2, 58.00, 83.33, 100.00, 69.37, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (54, 12, NULL, 0.6500, '58', 'Kurang Memenuhi Syarat', 58.00, 'OTOMATIS', 0),
  (54, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (54, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (54, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (54, 16, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (54, 17, 16, NULL, '6.58', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (54, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (54, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (54, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (55, 15, 2, 97.00, 76.67, 100.00, 93.38, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (55, 12, NULL, 0.6500, '97', 'Memenuhi Syarat', 97.00, 'OTOMATIS', 0),
  (55, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (55, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (55, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (55, 16, NULL, 0.0500, NULL, NULL, 66.67, 'OTOMATIS', 0),
  (55, 17, 16, NULL, '7.33', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (55, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (55, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (55, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (56, 16, 2, 70.00, 69.17, 100.00, 74.33, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (56, 12, NULL, 0.6500, '70', 'Masih Memenuhi Syarat', 70.00, 'OTOMATIS', 0),
  (56, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (56, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (56, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (56, 16, NULL, 0.0500, NULL, NULL, 46.67, 'OTOMATIS', 0),
  (56, 17, 16, NULL, '3.83', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (56, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (56, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (56, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (57, 17, 2, 85.00, 87.50, 100.00, 87.75, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (57, 12, NULL, 0.6500, '85', 'Memenuhi Syarat', 85.00, 'OTOMATIS', 0),
  (57, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (57, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (57, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (57, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (57, 17, 16, NULL, '4.41', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (57, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (57, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (57, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (58, 18, 2, 88.00, 85.83, 100.00, 89.37, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (58, 12, NULL, 0.6500, '88', 'Memenuhi Syarat', 88.00, 'OTOMATIS', 0),
  (58, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (58, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (58, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (58, 16, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (58, 17, 16, NULL, '5.16', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (58, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (58, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (58, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (59, 19, 2, 82.00, 91.67, 100.00, 86.63, 0, 'Tidak memenuhi 1 syarat: Pendidikan S1_D4 di bawah syarat minimal S2', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (59, 12, NULL, 0.6500, '82', 'Memenuhi Syarat', 82.00, 'OTOMATIS', 0),
  (59, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (59, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (59, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (59, 16, NULL, 0.0500, NULL, NULL, 86.67, 'OTOMATIS', 0),
  (59, 17, 16, NULL, '7.49', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (59, 18, 16, NULL, '80', 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, 'OTOMATIS', 0),
  (59, 19, 16, NULL, '80', 'Memiliki pengalaman penugasan sbg Pelaksana Tugas/Plt pada jenjang jabatan yang setara', 80.00, 'OTOMATIS', 0),
  (59, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (60, 20, 2, 91.00, 85.83, 100.00, 91.32, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (60, 12, NULL, 0.6500, '91', 'Memenuhi Syarat', 91.00, 'OTOMATIS', 0),
  (60, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (60, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (60, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (60, 16, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (60, 17, 16, NULL, '4.57', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (60, 18, 16, NULL, '80', 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, 'OTOMATIS', 0),
  (60, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (60, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (61, 21, 2, 74.00, 83.33, 100.00, 79.77, 0, 'Tidak memenuhi 1 syarat: Pendidikan S1_D4 di bawah syarat minimal S2', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (61, 12, NULL, 0.6500, '74', 'Masih Memenuhi Syarat', 74.00, 'OTOMATIS', 0),
  (61, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (61, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (61, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (61, 16, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (61, 17, 16, NULL, '3.49', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (61, 18, 16, NULL, '80', 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, 'OTOMATIS', 0),
  (61, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (61, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (62, 22, 2, 86.00, 87.50, 100.00, 88.40, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (62, 12, NULL, 0.6500, '86', 'Memenuhi Syarat', 86.00, 'OTOMATIS', 0),
  (62, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (62, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (62, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (62, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (62, 17, 16, NULL, '3', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (62, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (62, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (62, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (63, 23, 2, 83.00, 72.50, 75.00, 79.70, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (63, 12, NULL, 0.6500, '83', 'Memenuhi Syarat', 83.00, 'OTOMATIS', 0),
  (63, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (63, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (63, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (63, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (63, 17, 16, NULL, '4.24', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (63, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (63, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (63, 20, NULL, 0.1500, 'Ringan', 'Ringan', 75.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (64, 24, 2, 72.00, 72.50, 100.00, 76.30, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (64, 12, NULL, 0.6500, '72', 'Masih Memenuhi Syarat', 72.00, 'OTOMATIS', 0),
  (64, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (64, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (64, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (64, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (64, 17, 16, NULL, '3.57', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (64, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (64, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (64, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (65, 25, 2, 68.00, 90.00, 100.00, 77.20, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi IV di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (65, 12, NULL, 0.6500, '68', 'Masih Memenuhi Syarat', 68.00, 'OTOMATIS', 0),
  (65, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (65, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (65, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (65, 16, NULL, 0.0500, NULL, NULL, 80.00, 'OTOMATIS', 0),
  (65, 17, 16, NULL, '5.49', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (65, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (65, 19, 16, NULL, '40', 'Memiliki pengalaman penugasan sbg Pelaksana Harian/Plh pada jenjang jabatan yang setara', 40.00, 'OTOMATIS', 0),
  (65, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (66, 26, 2, 76.00, 76.67, 100.00, 79.73, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (66, 12, NULL, 0.6500, '76', 'Masih Memenuhi Syarat', 76.00, 'OTOMATIS', 0),
  (66, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (66, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (66, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (66, 16, NULL, 0.0500, NULL, NULL, 66.67, 'OTOMATIS', 0),
  (66, 17, 16, NULL, '5.33', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (66, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (66, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (66, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (67, 27, 2, 63.00, 72.50, 100.00, 70.45, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (67, 12, NULL, 0.6500, '63', 'Kurang Memenuhi Syarat', 63.00, 'OTOMATIS', 0),
  (67, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (67, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (67, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (67, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (67, 17, 16, NULL, '2.57', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (67, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (67, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (67, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (68, 28, 2, 55.00, 87.50, 100.00, 68.25, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (68, 12, NULL, 0.6500, '55', 'Kurang Memenuhi Syarat', 55.00, 'OTOMATIS', 0),
  (68, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (68, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (68, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (68, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (68, 17, 16, NULL, '6.49', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (68, 18, 16, NULL, '80', 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, 'OTOMATIS', 0),
  (68, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (68, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (69, 29, 2, 48.00, 72.50, 100.00, 60.70, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (69, 12, NULL, 0.6500, '48', 'Kurang Memenuhi Syarat', 48.00, 'OTOMATIS', 0),
  (69, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (69, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (69, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (69, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (69, 17, 16, NULL, '3.24', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (69, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (69, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (69, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (70, 30, 2, 52.00, 89.17, 100.00, 66.63, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (70, 12, NULL, 0.6500, '52', 'Kurang Memenuhi Syarat', 52.00, 'OTOMATIS', 0),
  (70, 13, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (70, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (70, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (70, 16, NULL, 0.0500, NULL, NULL, 66.67, 'OTOMATIS', 0),
  (70, 17, 16, NULL, '5.57', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (70, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (70, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (70, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (71, 31, 2, 57.00, 81.67, 100.00, 68.38, 0, 'Tidak memenuhi 1 syarat: Pendidikan S1_D4 di bawah syarat minimal S2', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (71, 12, NULL, 0.6500, '57', 'Kurang Memenuhi Syarat', 57.00, 'OTOMATIS', 0),
  (71, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (71, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (71, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (71, 16, NULL, 0.0500, NULL, NULL, 46.67, 'OTOMATIS', 0),
  (71, 17, 16, NULL, '2.91', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (71, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (71, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (71, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (72, 32, 2, 66.00, 85.00, 100.00, 74.90, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (72, 12, NULL, 0.6500, '66', 'Kurang Memenuhi Syarat', 66.00, 'OTOMATIS', 0),
  (72, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (72, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (72, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (72, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (72, 17, 16, NULL, '2.41', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (72, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (72, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (72, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (73, 33, 2, 71.00, 66.67, 0.00, 59.48, 0, 'Tidak memenuhi 2 syarat: Pendidikan D3 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (73, 12, NULL, 0.6500, '71', 'Masih Memenuhi Syarat', 71.00, 'OTOMATIS', 0),
  (73, 13, NULL, 0.0500, 'DIII', 'DIII', 70.00, 'OTOMATIS', 0),
  (73, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (73, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (73, 16, NULL, 0.0500, NULL, NULL, 46.67, 'OTOMATIS', 0),
  (73, 17, 16, NULL, '4.33', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (73, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (73, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (73, 20, NULL, 0.1500, 'Sedang Menjalani', 'Sedang Menjalani', 0.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (74, 34, 2, 54.00, 72.50, 100.00, 64.60, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi IV di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (74, 12, NULL, 0.6500, '54', 'Kurang Memenuhi Syarat', 54.00, 'OTOMATIS', 0),
  (74, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (74, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (74, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (74, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (74, 17, 16, NULL, '3.16', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (74, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (74, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (74, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (75, 35, 2, 47.00, 85.00, 100.00, 62.55, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi IV di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (75, 12, NULL, 0.6500, '47', 'Kurang Memenuhi Syarat', 47.00, 'OTOMATIS', 0),
  (75, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (75, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (75, 15, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (75, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (75, 17, 16, NULL, '4.41', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (75, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (75, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (75, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (76, 36, 2, 58.00, 70.83, 100.00, 66.87, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (76, 12, NULL, 0.6500, '58', 'Kurang Memenuhi Syarat', 58.00, 'OTOMATIS', 0),
  (76, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (76, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (76, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (76, 16, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (76, 17, 16, NULL, '6.33', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (76, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (76, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (76, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (77, 37, 2, 51.00, 72.50, 100.00, 62.65, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (77, 12, NULL, 0.6500, '51', 'Kurang Memenuhi Syarat', 51.00, 'OTOMATIS', 0),
  (77, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (77, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (77, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (77, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (77, 17, 16, NULL, '3.74', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (77, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (77, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (77, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (78, 38, 2, 44.00, 70.83, 100.00, 57.77, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (78, 12, NULL, 0.6500, '44', 'Kurang Memenuhi Syarat', 44.00, 'OTOMATIS', 0),
  (78, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (78, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (78, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (78, 16, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (78, 17, 16, NULL, '5.33', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (78, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (78, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (78, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (79, 39, 2, 38.00, 67.50, 25.00, 41.95, 0, 'Tidak memenuhi 2 syarat: Pendidikan SLTA di bawah syarat minimal S2; Eselon tertinggi IV di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (79, 12, NULL, 0.6500, '38', 'Kurang Memenuhi Syarat', 38.00, 'OTOMATIS', 0),
  (79, 13, NULL, 0.0500, 'SLTA', 'SLTA', 60.00, 'OTOMATIS', 0),
  (79, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (79, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (79, 16, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (79, 17, 16, NULL, '2.16', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (79, 18, 16, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (79, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (79, 20, NULL, 0.1500, 'Berat', 'Berat', 25.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (80, 40, 2, 56.00, 67.50, 100.00, 64.90, 0, 'Tidak memenuhi 2 syarat: Pendidikan S1_D4 di bawah syarat minimal S2; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":6,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":12,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":7,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":13,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":14,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":15,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":16,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":17,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":18,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":19,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":8,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":20,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (80, 12, NULL, 0.6500, '56', 'Kurang Memenuhi Syarat', 56.00, 'OTOMATIS', 0),
  (80, 13, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (80, 14, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (80, 15, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (80, 16, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (80, 17, 16, NULL, '1.57', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (80, 18, 16, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (80, 19, 16, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (80, 20, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (81, 1, 3, 97.50, 85.83, 100.00, 95.54, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (81, 21, NULL, 0.6500, '97.5', 'Memenuhi Syarat', 97.50, 'OTOMATIS', 0),
  (81, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (81, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (81, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (81, 25, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (81, 26, 25, NULL, '1.03', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (81, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (81, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (81, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (82, 2, 3, 98.00, 89.17, 100.00, 96.53, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (82, 21, NULL, 0.6500, '98', 'Memenuhi Syarat', 98.00, 'OTOMATIS', 0),
  (82, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (82, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (82, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (82, 25, NULL, 0.0500, NULL, NULL, 66.67, 'OTOMATIS', 0),
  (82, 26, 25, NULL, '13.03', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (82, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (82, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (82, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (83, 3, 3, 99.50, 85.83, 100.00, 96.84, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (83, 21, NULL, 0.6500, '99.5', 'Memenuhi Syarat', 99.50, 'OTOMATIS', 0),
  (83, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (83, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (83, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (83, 25, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (83, 26, 25, NULL, '1.03', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (83, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (83, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (83, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (84, 4, 3, 93.47, 82.50, 100.00, 92.26, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (84, 21, NULL, 0.6500, '93.47', 'Memenuhi Syarat', 93.47, 'OTOMATIS', 0),
  (84, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (84, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (84, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (84, 25, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (84, 26, 25, NULL, '1.03', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (84, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (84, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (84, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (85, 5, 3, 76.04, 70.00, 100.00, 78.43, 0, 'Tidak memenuhi 3 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi; Eselon tertinggi NON_ESELON di bawah syarat minimal III; Asesmen tahun 2021 sudah kedaluwarsa atau berstatus draft', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (85, 21, NULL, 0.6500, '76.04', 'Masih Memenuhi Syarat', 76.04, 'OTOMATIS', 0),
  (85, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (85, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (85, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (85, 25, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (85, 26, 25, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (85, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (85, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (85, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (86, 6, 3, 98.50, 67.50, 100.00, 92.53, 0, 'Tidak memenuhi 2 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (86, 21, NULL, 0.6500, '98.5', 'Memenuhi Syarat', 98.50, 'OTOMATIS', 0),
  (86, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (86, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (86, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (86, 25, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (86, 26, 25, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (86, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (86, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (86, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (87, 7, 3, 69.58, 82.50, 100.00, 76.73, 0, 'Tidak memenuhi 2 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III; Asesmen tahun 2022 sudah kedaluwarsa atau berstatus draft', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (87, 21, NULL, 0.6500, '69.58', 'Masih Memenuhi Syarat', 69.58, 'OTOMATIS', 0),
  (87, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (87, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (87, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (87, 25, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (87, 26, 25, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (87, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (87, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (87, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (88, 8, 3, 61.74, 67.50, 100.00, 68.63, 0, 'Tidak memenuhi 2 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (88, 21, NULL, 0.6500, '61.74', 'Kurang Memenuhi Syarat', 61.74, 'OTOMATIS', 0),
  (88, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (88, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (88, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (88, 25, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (88, 26, 25, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (88, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (88, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (88, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (89, 9, 3, 90.16, 70.00, 100.00, 87.60, 0, 'Tidak memenuhi 2 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (89, 21, NULL, 0.6500, '90.16', 'Memenuhi Syarat', 90.16, 'OTOMATIS', 0),
  (89, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (89, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (89, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (89, 25, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (89, 26, 25, NULL, '0.99', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (89, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (89, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (89, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (90, 10, 3, 99.00, 75.00, 100.00, 94.35, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (90, 21, NULL, 0.6500, '99', 'Memenuhi Syarat', 99.00, 'OTOMATIS', 0),
  (90, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (90, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (90, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (90, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (90, 26, 25, NULL, '2.56', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (90, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (90, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (90, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (91, 11, 3, 88.00, 72.50, 100.00, 86.70, 0, 'Tidak memenuhi 2 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi; Eselon tertinggi IV di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (91, 21, NULL, 0.6500, '88', 'Memenuhi Syarat', 88.00, 'OTOMATIS', 0),
  (91, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (91, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (91, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (91, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (91, 26, 25, NULL, '4.16', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (91, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (91, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (91, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (92, 12, 3, 82.00, 83.33, 75.00, 81.22, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (92, 21, NULL, 0.6500, '82', 'Memenuhi Syarat', 82.00, 'OTOMATIS', 0),
  (92, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (92, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (92, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (92, 25, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (92, 26, 25, NULL, '1.47', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (92, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (92, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (92, 29, NULL, 0.1500, 'Ringan', 'Ringan', 75.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (93, 13, 3, 65.00, 56.67, 100.00, 68.58, 0, 'Tidak memenuhi 2 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi; Eselon tertinggi IV di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (93, 21, NULL, 0.6500, '65', 'Kurang Memenuhi Syarat', 65.00, 'OTOMATIS', 0),
  (93, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (93, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (93, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (93, 25, NULL, 0.0500, NULL, NULL, 46.67, 'OTOMATIS', 0),
  (93, 26, 25, NULL, '3.41', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (93, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (93, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (93, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (94, 14, 3, 58.00, 70.83, 100.00, 66.87, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (94, 21, NULL, 0.6500, '58', 'Kurang Memenuhi Syarat', 58.00, 'OTOMATIS', 0),
  (94, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (94, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (94, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (94, 25, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (94, 26, 25, NULL, '6.58', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (94, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (94, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (94, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (95, 15, 3, 97.00, 89.17, 100.00, 95.88, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (95, 21, NULL, 0.6500, '97', 'Memenuhi Syarat', 97.00, 'OTOMATIS', 0),
  (95, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (95, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (95, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (95, 25, NULL, 0.0500, NULL, NULL, 66.67, 'OTOMATIS', 0),
  (95, 26, 25, NULL, '7.33', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (95, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (95, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (95, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (96, 16, 3, 70.00, 69.17, 100.00, 74.33, 0, 'Tidak memenuhi 2 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (96, 21, NULL, 0.6500, '70', 'Masih Memenuhi Syarat', 70.00, 'OTOMATIS', 0),
  (96, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (96, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (96, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (96, 25, NULL, 0.0500, NULL, NULL, 46.67, 'OTOMATIS', 0),
  (96, 26, 25, NULL, '3.83', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (96, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (96, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (96, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (97, 17, 3, 85.00, 87.50, 100.00, 87.75, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (97, 21, NULL, 0.6500, '85', 'Memenuhi Syarat', 85.00, 'OTOMATIS', 0),
  (97, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (97, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (97, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (97, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (97, 26, 25, NULL, '4.41', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (97, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (97, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (97, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (98, 18, 3, 88.00, 85.83, 100.00, 89.37, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (98, 21, NULL, 0.6500, '88', 'Memenuhi Syarat', 88.00, 'OTOMATIS', 0),
  (98, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (98, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (98, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (98, 25, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (98, 26, 25, NULL, '5.16', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (98, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (98, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (98, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (99, 19, 3, 82.00, 79.17, 100.00, 84.13, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (99, 21, NULL, 0.6500, '82', 'Memenuhi Syarat', 82.00, 'OTOMATIS', 0),
  (99, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (99, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (99, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (99, 25, NULL, 0.0500, NULL, NULL, 86.67, 'OTOMATIS', 0),
  (99, 26, 25, NULL, '7.49', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (99, 27, 25, NULL, '80', 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, 'OTOMATIS', 0),
  (99, 28, 25, NULL, '80', 'Memiliki pengalaman penugasan sbg Pelaksana Tugas/Plt pada jenjang jabatan yang setara', 80.00, 'OTOMATIS', 0),
  (99, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (100, 20, 3, 91.00, 85.83, 100.00, 91.32, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (100, 21, NULL, 0.6500, '91', 'Memenuhi Syarat', 91.00, 'OTOMATIS', 0),
  (100, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (100, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (100, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (100, 25, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (100, 26, 25, NULL, '4.57', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (100, 27, 25, NULL, '80', 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, 'OTOMATIS', 0),
  (100, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (100, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (101, 21, 3, 74.00, 70.83, 100.00, 77.27, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (101, 21, NULL, 0.6500, '74', 'Masih Memenuhi Syarat', 74.00, 'OTOMATIS', 0),
  (101, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (101, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (101, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (101, 25, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (101, 26, 25, NULL, '3.49', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (101, 27, 25, NULL, '80', 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, 'OTOMATIS', 0),
  (101, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (101, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (102, 22, 3, 86.00, 87.50, 100.00, 88.40, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (102, 21, NULL, 0.6500, '86', 'Memenuhi Syarat', 86.00, 'OTOMATIS', 0),
  (102, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (102, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (102, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (102, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (102, 26, 25, NULL, '3', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (102, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (102, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (102, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (103, 23, 3, 83.00, 85.00, 75.00, 82.20, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (103, 21, NULL, 0.6500, '83', 'Memenuhi Syarat', 83.00, 'OTOMATIS', 0),
  (103, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (103, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (103, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (103, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (103, 26, 25, NULL, '4.24', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (103, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (103, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (103, 29, NULL, 0.1500, 'Ringan', 'Ringan', 75.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (104, 24, 3, 72.00, 60.00, 100.00, 73.80, 0, 'Tidak memenuhi 2 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (104, 21, NULL, 0.6500, '72', 'Masih Memenuhi Syarat', 72.00, 'OTOMATIS', 0),
  (104, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (104, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (104, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (104, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (104, 26, 25, NULL, '3.57', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (104, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (104, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (104, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (105, 25, 3, 68.00, 90.00, 100.00, 77.20, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi IV di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (105, 21, NULL, 0.6500, '68', 'Masih Memenuhi Syarat', 68.00, 'OTOMATIS', 0),
  (105, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (105, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (105, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (105, 25, NULL, 0.0500, NULL, NULL, 80.00, 'OTOMATIS', 0),
  (105, 26, 25, NULL, '5.49', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (105, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (105, 28, 25, NULL, '40', 'Memiliki pengalaman penugasan sbg Pelaksana Harian/Plh pada jenjang jabatan yang setara', 40.00, 'OTOMATIS', 0),
  (105, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (106, 26, 3, 76.00, 64.17, 100.00, 77.23, 0, 'Tidak memenuhi 2 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (106, 21, NULL, 0.6500, '76', 'Masih Memenuhi Syarat', 76.00, 'OTOMATIS', 0),
  (106, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (106, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (106, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (106, 25, NULL, 0.0500, NULL, NULL, 66.67, 'OTOMATIS', 0),
  (106, 26, 25, NULL, '5.33', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (106, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (106, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (106, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (107, 27, 3, 63.00, 72.50, 100.00, 70.45, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (107, 21, NULL, 0.6500, '63', 'Kurang Memenuhi Syarat', 63.00, 'OTOMATIS', 0),
  (107, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (107, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (107, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (107, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (107, 26, 25, NULL, '2.57', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (107, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (107, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (107, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (108, 28, 3, 55.00, 62.50, 100.00, 63.25, 0, 'Tidak memenuhi 1 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (108, 21, NULL, 0.6500, '55', 'Kurang Memenuhi Syarat', 55.00, 'OTOMATIS', 0),
  (108, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (108, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (108, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (108, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (108, 26, 25, NULL, '6.49', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (108, 27, 25, NULL, '80', 'Memiliki pengalaman jabatan lintas Unit Kerja/antar direktorat atau balai di DJBK', 80.00, 'OTOMATIS', 0),
  (108, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (108, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (109, 29, 3, 48.00, 85.00, 100.00, 63.20, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (109, 21, NULL, 0.6500, '48', 'Kurang Memenuhi Syarat', 48.00, 'OTOMATIS', 0),
  (109, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (109, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (109, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (109, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (109, 26, 25, NULL, '3.24', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (109, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (109, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (109, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (110, 30, 3, 52.00, 64.17, 100.00, 61.63, 0, 'Tidak memenuhi 1 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (110, 21, NULL, 0.6500, '52', 'Kurang Memenuhi Syarat', 52.00, 'OTOMATIS', 0),
  (110, 22, NULL, 0.0500, 'Magister', 'Magister', 90.00, 'OTOMATIS', 0),
  (110, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (110, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (110, 25, NULL, 0.0500, NULL, NULL, 66.67, 'OTOMATIS', 0),
  (110, 26, 25, NULL, '5.57', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (110, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (110, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (110, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (111, 31, 3, 57.00, 69.17, 100.00, 65.88, 1, 'Memenuhi seluruh persyaratan jabatan target', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (111, 21, NULL, 0.6500, '57', 'Kurang Memenuhi Syarat', 57.00, 'OTOMATIS', 0),
  (111, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (111, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (111, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (111, 25, NULL, 0.0500, NULL, NULL, 46.67, 'OTOMATIS', 0),
  (111, 26, 25, NULL, '2.91', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (111, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (111, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (111, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (112, 32, 3, 66.00, 72.50, 100.00, 72.40, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (112, 21, NULL, 0.6500, '66', 'Kurang Memenuhi Syarat', 66.00, 'OTOMATIS', 0),
  (112, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (112, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (112, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (112, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (112, 26, 25, NULL, '2.41', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (112, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (112, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (112, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (113, 33, 3, 71.00, 66.67, 0.00, 59.48, 0, 'Tidak memenuhi 2 syarat: Pendidikan D3 di bawah syarat minimal S1_D4; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (113, 21, NULL, 0.6500, '71', 'Masih Memenuhi Syarat', 71.00, 'OTOMATIS', 0),
  (113, 22, NULL, 0.0500, 'DIII', 'DIII', 70.00, 'OTOMATIS', 0),
  (113, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (113, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (113, 25, NULL, 0.0500, NULL, NULL, 46.67, 'OTOMATIS', 0),
  (113, 26, 25, NULL, '4.33', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (113, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (113, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (113, 29, NULL, 0.1500, 'Sedang Menjalani', 'Sedang Menjalani', 0.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (114, 34, 3, 54.00, 72.50, 100.00, 64.60, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi IV di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (114, 21, NULL, 0.6500, '54', 'Kurang Memenuhi Syarat', 54.00, 'OTOMATIS', 0),
  (114, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (114, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (114, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (114, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (114, 26, 25, NULL, '3.16', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (114, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (114, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (114, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (115, 35, 3, 47.00, 72.50, 100.00, 60.05, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi IV di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (115, 21, NULL, 0.6500, '47', 'Kurang Memenuhi Syarat', 47.00, 'OTOMATIS', 0),
  (115, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (115, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (115, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (115, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (115, 26, 25, NULL, '4.41', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (115, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (115, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (115, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (116, 36, 3, 58.00, 58.33, 100.00, 64.37, 0, 'Tidak memenuhi 2 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (116, 21, NULL, 0.6500, '58', 'Kurang Memenuhi Syarat', 58.00, 'OTOMATIS', 0),
  (116, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (116, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (116, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (116, 25, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (116, 26, 25, NULL, '6.33', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (116, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (116, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (116, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (117, 37, 3, 51.00, 60.00, 100.00, 60.15, 0, 'Tidak memenuhi 2 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (117, 21, NULL, 0.6500, '51', 'Kurang Memenuhi Syarat', 51.00, 'OTOMATIS', 0),
  (117, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (117, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (117, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (117, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (117, 26, 25, NULL, '3.74', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (117, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (117, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (117, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (118, 38, 3, 44.00, 58.33, 100.00, 55.27, 0, 'Tidak memenuhi 2 syarat: Tidak ada riwayat pendidikan pada bidang: teknik, sipil, konstruksi; Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (118, 21, NULL, 0.6500, '44', 'Kurang Memenuhi Syarat', 44.00, 'OTOMATIS', 0),
  (118, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (118, 23, NULL, 0.0500, '50', 'Tidak memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (118, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (118, 25, NULL, 0.0500, NULL, NULL, 53.33, 'OTOMATIS', 0),
  (118, 26, 25, NULL, '5.33', 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas', 100.00, 'OTOMATIS', 0),
  (118, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (118, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (118, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (119, 39, 3, 38.00, 67.50, 25.00, 41.95, 0, 'Tidak memenuhi 2 syarat: Pendidikan SLTA di bawah syarat minimal S1_D4; Eselon tertinggi IV di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (119, 21, NULL, 0.6500, '38', 'Kurang Memenuhi Syarat', 38.00, 'OTOMATIS', 0),
  (119, 22, NULL, 0.0500, 'SLTA', 'SLTA', 60.00, 'OTOMATIS', 0),
  (119, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (119, 24, NULL, 0.0500, '50', 'Tidak memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 50.00, 'OTOMATIS', 0),
  (119, 25, NULL, 0.0500, NULL, NULL, 60.00, 'OTOMATIS', 0),
  (119, 26, 25, NULL, '2.16', 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun', 80.00, 'OTOMATIS', 0),
  (119, 27, 25, NULL, '100', 'Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi', 100.00, 'OTOMATIS', 0),
  (119, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (119, 29, NULL, 0.1500, 'Berat', 'Berat', 25.00, 'OTOMATIS', 0);

INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES
  (120, 40, 3, 56.00, 80.00, 100.00, 67.40, 0, 'Tidak memenuhi 1 syarat: Eselon tertinggi NON_ESELON di bawah syarat minimal III', '{"komponen":[{"id":9,"nama":"Potensi & Kompetensi","sumbu":"X_POTENSIAL","bobot":0.65,"indikator":[{"id":21,"nama":"Penilaian Potensi dan Kompetensi","bobot":0.65,"modeSkor":"NILAI_LANGSUNG"}]},{"id":10,"nama":"Kualifikasi Jabatan","sumbu":"X_POTENSIAL","bobot":0.2,"indikator":[{"id":22,"nama":"Tingkat Pendidikan Formal","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":23,"nama":"Kesesuaian Bidang Ilmu","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":24,"nama":"Pengembangan Kompetensi","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":25,"nama":"Nilai Pengalaman Jabatan","bobot":0.05,"modeSkor":"KATEGORI_TETAP"},{"id":26,"nama":"Lama Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":27,"nama":"Keragaman Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"},{"id":28,"nama":"Substansi Riwayat Jabatan","bobot":null,"modeSkor":"KATEGORI_TETAP"}]},{"id":11,"nama":"Integritas & Moralitas","sumbu":"X_POTENSIAL","bobot":0.15,"indikator":[{"id":29,"nama":"Verifikasi Rekam Jejak Disiplin","bobot":0.15,"modeSkor":"KATEGORI_TETAP"}]}],"dihitungPada":"2026-07-30T05:00:00.000Z"}');
INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES
  (120, 21, NULL, 0.6500, '56', 'Kurang Memenuhi Syarat', 56.00, 'OTOMATIS', 0),
  (120, 22, NULL, 0.0500, 'S1/DIV', 'S1/DIV', 80.00, 'OTOMATIS', 0),
  (120, 23, NULL, 0.0500, '100', 'Memiliki riwayat pendidikan dalam bidang ilmu yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (120, 24, NULL, 0.0500, '100', 'Memiliki riwayat pengembangan kompetensi dalam bidang yang sesuai dengan jabatan target', 100.00, 'OTOMATIS', 0),
  (120, 25, NULL, 0.0500, NULL, NULL, 40.00, 'OTOMATIS', 0),
  (120, 26, 25, NULL, '1.57', 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun', 60.00, 'OTOMATIS', 0),
  (120, 27, 25, NULL, '60', 'Memiliki pengalaman jabatan satu Unit Kerja', 60.00, 'OTOMATIS', 0),
  (120, 28, 25, NULL, '0', 'Tidak memiliki riwayat jabatan yang berkaitan dengan jabatan non-definitif', 0.00, 'OTOMATIS', 0),
  (120, 29, NULL, 0.1500, 'Tidak Pernah', 'Tidak Pernah', 100.00, 'OTOMATIS', 0);

-- ---------------------------------------------------------------------
-- 3. talent_pool: tautkan ulang ke match_score & hitung ranking
--
--    Status workflow entri lama (DITETAPKAN/DIVERIFIKASI/dst) DIPERTAHANKAN
--    karena ada nominasi & approval_log yang menunjuk ke sana.
--    Kandidat baru yang lolos syarat ditambahkan berstatus KANDIDAT.
-- ---------------------------------------------------------------------
UPDATE talent_pool tp
JOIN match_score ms ON ms.pegawai_id = tp.pegawai_id AND ms.jabatan_target_id = tp.jabatan_target_id
SET tp.match_score_id = ms.id;

-- Jabatan target 1: 17 kandidat eligible; pool = 8 anggota lama + 0 kandidat baru
-- Ranking ulang seluruh 8 anggota pool jabatan target 1
UPDATE talent_pool SET ranking = 1 WHERE pegawai_id = 10 AND jabatan_target_id = 1;
UPDATE talent_pool SET ranking = 2 WHERE pegawai_id = 3 AND jabatan_target_id = 1;
UPDATE talent_pool SET ranking = 3 WHERE pegawai_id = 2 AND jabatan_target_id = 1;
UPDATE talent_pool SET ranking = 4 WHERE pegawai_id = 1 AND jabatan_target_id = 1;
UPDATE talent_pool SET ranking = 5 WHERE pegawai_id = 4 AND jabatan_target_id = 1;
UPDATE talent_pool SET ranking = 6 WHERE pegawai_id = 11 AND jabatan_target_id = 1;
UPDATE talent_pool SET ranking = 7 WHERE pegawai_id = 17 AND jabatan_target_id = 1;
UPDATE talent_pool SET ranking = 8 WHERE pegawai_id = 12 AND jabatan_target_id = 1;
-- 9 kandidat eligible lain TIDAK masuk pool (batas 8).
-- Skornya tetap tersimpan di match_score dan tampil di halaman Kandidat & Eligibility Check.

-- Jabatan target 2: 8 kandidat eligible; pool = 8 anggota lama + 0 kandidat baru
-- Ranking ulang seluruh 8 anggota pool jabatan target 2
UPDATE talent_pool SET ranking = 1 WHERE pegawai_id = 10 AND jabatan_target_id = 2;
UPDATE talent_pool SET ranking = 2 WHERE pegawai_id = 3 AND jabatan_target_id = 2;
UPDATE talent_pool SET ranking = 3 WHERE pegawai_id = 2 AND jabatan_target_id = 2;
UPDATE talent_pool SET ranking = 4 WHERE pegawai_id = 1 AND jabatan_target_id = 2;
UPDATE talent_pool SET ranking = 5 WHERE pegawai_id = 4 AND jabatan_target_id = 2;
UPDATE talent_pool SET ranking = 6 WHERE pegawai_id = 17 AND jabatan_target_id = 2;
UPDATE talent_pool SET ranking = 7 WHERE pegawai_id = 28 AND jabatan_target_id = 2;
UPDATE talent_pool SET ranking = 8 WHERE pegawai_id = 30 AND jabatan_target_id = 2;

-- Jabatan target 3: 10 kandidat eligible; pool = 8 anggota lama + 0 kandidat baru
-- Ranking ulang seluruh 8 anggota pool jabatan target 3
UPDATE talent_pool SET ranking = 1 WHERE pegawai_id = 3 AND jabatan_target_id = 3;
UPDATE talent_pool SET ranking = 2 WHERE pegawai_id = 2 AND jabatan_target_id = 3;
UPDATE talent_pool SET ranking = 3 WHERE pegawai_id = 15 AND jabatan_target_id = 3;
UPDATE talent_pool SET ranking = 4 WHERE pegawai_id = 1 AND jabatan_target_id = 3;
UPDATE talent_pool SET ranking = 5 WHERE pegawai_id = 10 AND jabatan_target_id = 3;
UPDATE talent_pool SET ranking = 6 WHERE pegawai_id = 4 AND jabatan_target_id = 3;
UPDATE talent_pool SET ranking = 7 WHERE pegawai_id = 17 AND jabatan_target_id = 3;
UPDATE talent_pool SET ranking = 8 WHERE pegawai_id = 12 AND jabatan_target_id = 3;
-- 2 kandidat eligible lain TIDAK masuk pool (batas 8).
-- Skornya tetap tersimpan di match_score dan tampil di halaman Kandidat & Eligibility Check.

-- Kandidat yang ternyata tidak lolos syarat namun masih tercatat di pool
-- lama: statusnya tidak diubah otomatis (keputusan manusia), tapi diberi
-- catatan supaya muncul di Antrian Pembersihan Data.
UPDATE talent_pool tp JOIN match_score ms ON ms.id = tp.match_score_id
SET tp.catatan_reviewer = CONCAT(COALESCE(CONCAT(tp.catatan_reviewer, ' | '), ''), '[recompute] Tidak lolos syarat jabatan target pada perhitungan terakhir')
WHERE ms.eligible = 0 AND tp.status <> 'DITOLAK'
  AND (tp.catatan_reviewer IS NULL OR tp.catatan_reviewer NOT LIKE '%[recompute]%');

-- ---------------------------------------------------------------------
-- 4. Nominasi jalur DITOLAK & REVISI
--    Seed sebelumnya hanya punya jalur mulus; kedua cabang ini membuat
--    UI verifikasi & timeline approval teruji seluruhnya.
-- ---------------------------------------------------------------------
INSERT INTO nominasi (talent_pool_id, diajukan_oleh_unit_id, diajukan_oleh_user_id, tanggal_diajukan, status, catatan)
SELECT tp.id, 11, 3, '2026-05-12', 'DITOLAK', 'Diusulkan unit sebagai kandidat Kepala Balai; mohon dipertimbangkan.'
FROM talent_pool tp JOIN pegawai p ON p.id = tp.pegawai_id
WHERE p.nip = '198006202006021003' AND tp.jabatan_target_id = 1
  AND NOT EXISTS (SELECT 1 FROM nominasi n WHERE n.talent_pool_id = tp.id)
LIMIT 1;

INSERT INTO approval_log (nominasi_id, tahap, status, approver_user_id, catatan, tanggal_aksi)
SELECT n.id, 'Verifikasi Kepegawaian', 'DITOLAK', 2, 'Terdapat hukuman disiplin ringan yang masih aktif; skor Integritas & Moralitas 75. Diusulkan ditinjau kembali setelah masa berlaku sanksi berakhir.', '2026-05-20 10:15:00'
FROM nominasi n WHERE n.status = 'DITOLAK'
  AND NOT EXISTS (SELECT 1 FROM approval_log a WHERE a.nominasi_id = n.id)
LIMIT 1;

INSERT INTO nominasi (talent_pool_id, diajukan_oleh_unit_id, diajukan_oleh_user_id, tanggal_diajukan, status, catatan)
SELECT tp.id, 12, 4, '2026-06-02', 'MENUNGGU_VERIFIKASI', 'Pengajuan kandidat dari unit; dokumen pendukung menyusul.'
FROM talent_pool tp JOIN pegawai p ON p.id = tp.pegawai_id
WHERE p.nip = '198102142006041002' AND tp.jabatan_target_id = 1
  AND NOT EXISTS (SELECT 1 FROM nominasi n WHERE n.talent_pool_id = tp.id)
LIMIT 1;

INSERT INTO approval_log (nominasi_id, tahap, status, approver_user_id, catatan, tanggal_aksi)
SELECT n.id, 'Verifikasi Kepegawaian', 'REVISI', 2, 'Riwayat diklat pengadaan belum terlampir dan tahun lulus S1 belum terisi. Mohon dilengkapi sebelum diverifikasi ulang.', '2026-06-09 14:30:00'
FROM nominasi n JOIN talent_pool tp ON tp.id = n.talent_pool_id JOIN pegawai p ON p.id = tp.pegawai_id
WHERE p.nip = '198102142006041002' AND n.status = 'MENUNGGU_VERIFIKASI'
  AND NOT EXISTS (SELECT 1 FROM approval_log a WHERE a.nominasi_id = n.id)
LIMIT 1;

