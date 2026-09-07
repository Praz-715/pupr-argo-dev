-- 023 — Skala nilai mentah per indikator, dan Potkom dinilai pada skala 0–150.
--
-- Permintaan pemilik proses (`koreksi sistem informasi.pdf`, butir 3): *"penyesuaian
-- rumus di sistem terkait nilai potensi kompetensi supaya otomatis menghitung"* —
-- diganti dengan **65% × (Nilai Potkom Ybs / 150) × 100**.
--
-- ## 65% ADALAH bobot yang sudah ada — tidak dikalikan dua kali
--
-- Dikonfirmasi pemilik proses 31 Agu 2026: *"65% itu udah bobot jadi jangan dikali
-- 0,65 lagi"*. `rubrik_indikator.bobot_indikator` untuk Potkom memang sudah 0,6500 dan
-- mesin mengalikannya lewat `Σ(skor × bobot) / Σ(bobot)`. Jadi yang berubah **hanya**
-- bagian `(nilai / 150) × 100`, dan itulah yang kolom ini kerjakan:
--
--     SKOR  = (130,73 / 150) × 100 = 87,15     ← berubah, dulu 100,00
--     BOBOT = 65%                              ← tidak disentuh
--
-- Memasang rumusnya apa adanya sebagai isi kolom skor akan membuat bobot efektifnya
-- 42,25% — bukan 65% — tanpa satu pun galat.
--
-- ## Cacat yang ditutupnya
--
-- Potkom bermode `NILAI_LANGSUNG`, jadi skornya = nilai mentah lalu **di-clamp ke
-- 100**. Terukur di `pupr_dev_v2` sesudah impor 2026: dari 176 baris asesmen, **61
-- ber-potkom di atas 100** — dan mereka semua mendapat skor Potkom **100,00 yang
-- persis sama**, dari nilai yang sebenarnya membentang sampai 147,92. Daya bedanya
-- hilang tepat di ujung atas, tempat kandidat terbaik berada, dan itu tidak pernah
-- muncul sebagai galat — hanya sebagai peringkat yang seri.
--
-- Terukur SESUDAH berkas ini + Hitung Ulang, pada jabatan target #1: **60 kandidat
-- ber-potkom di atas 100 yang tadinya berbagi satu skor kini punya 46 skor berbeda.**
--
-- ## Kenapa 150
--
-- Bukan angka yang dikarang: tiga sumber independen sepakat potkom melewati 100 tapi
-- tidak pernah 150. Terukur — Pengawas maks **143,23**, Kabalai maks **116,74**,
-- Fungsional maks **147,92**, eNominasi maks **130,73**. Nol dari 176 baris melebihi
-- 150. PDF pemilik proses menyebut 150 eksplisit.
--
-- ## Kenapa kolom per-indikator, bukan `pengaturan_sistem`
--
-- CLAUDE.md sudah menetapkan pembagiannya, dan ini jatuh di sisi rubrik: angka yang
-- mengubah **nilai mentah → skor** hidup di rubrik dan bisa disunting dari editor
-- rubrik; yang lintas jabatan target (skala predikat, bobot Formula A) hidup di
-- `pengaturan_sistem`. Menaruh skala di sana akan membuat SUMBER KEDUA yang harus
-- sepakat dengan rubrik, dan bentuk kegagalannya bukan galat melainkan dua halaman
-- yang memberi skor berbeda untuk orang yang sama.
--
-- Konsekuensi yang diterima sadar: skalanya kini ada di 14 baris (satu per rubrik).
-- Berkas ini menyetel **semuanya sekaligus lewat `kunci_sistem`**, bukan per id, jadi
-- rubrik yang lahir belakangan lewat salin-rubrik ikut membawa nilainya.
--
-- ## Yang TIDAK berubah
--
-- `skala_maks` NULL = nilai mentahnya memang 0–100 → jalur lama persis. Seluruh
-- indikator selain Potkom NULL, jadi berkas ini tidak menggeser satu pun skor mereka.
-- Nilai mentah Potkom tetap tersimpan & tampil **apa adanya** (130,73), sebab yang
-- diminta berubah skornya, bukan datanya — dan butir 2 PDF justru menuntut nilai
-- mentahnya tetap bisa dibaca & dipilih verifikator.
--
-- Idempoten: penambahan kolom dijaga `information_schema`; UPDATE-nya menyetel nilai
-- yang sama kalau dijalankan ulang.

SET @ada := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'rubrik_indikator'
       AND COLUMN_NAME = 'skala_maks'
);
SET @sql := IF(
    @ada = 0,
    'ALTER TABLE rubrik_indikator
       ADD COLUMN skala_maks DECIMAL(6,2) NULL
       COMMENT ''Skala MAKSIMUM nilai mentah indikator ini bila bukan 0-100. NULL = 0-100 (jalur lama). Skor = nilai / skala_maks * 100; nilai mentahnya sendiri tidak diubah.''
       AFTER mode_skor',
    'SELECT ''kolom skala_maks sudah ada'''
);
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;

UPDATE rubrik_indikator
   SET skala_maks = 150.00
 WHERE kunci_sistem = 'POTKOM';
