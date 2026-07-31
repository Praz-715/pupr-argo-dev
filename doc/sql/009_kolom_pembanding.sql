-- 009_kolom_pembanding.sql — dijalankan setelah 008
--
-- KENAPA BERKAS INI ADA
--
-- phase.md §6 no. 2 mewajibkan importer: "kotak_9 dari sumber beda dengan
-- hitungan Lampiran A → hitung ulang, **simpan nilai sumber sbg pembanding**,
-- masuk antrian". Bagian "hitung ulang" sudah jalan sejak Fase 0.5, tapi bagian
-- "simpan nilai sumber" ternyata tidak punya tempat: `asesmen_talenta` hanya
-- punya satu kolom `kotak_9`, dan 007_recompute menimpanya dengan hasil hitung.
--
-- Akibatnya nilai sumber HILANG. Halaman Antrian Pembersihan Data tidak bisa
-- menunjukkan selisih apa pun, dan dua kasus nyata dari e-Nominasi (Tasya &
-- Tina) hanya hidup sebagai komentar di 002_seed.sql — bukan sebagai data yang
-- bisa ditindak. Ini celah antara dokumen dan skema, bukan pilihan desain.
--
-- Kolom `kotak_9_sumber` diisi HANYA kalau sumber memang mengirim nilainya, dan
-- TIDAK pernah dipakai perhitungan — murni pembanding untuk kualitas data.

ALTER TABLE asesmen_talenta
  ADD COLUMN kotak_9_sumber TINYINT UNSIGNED NULL
    COMMENT 'Nilai kotak_9 apa adanya dari sistem sumber. Pembanding kualitas data (phase.md §6 no.2) — JANGAN dipakai perhitungan; kotak_9 selalu hasil hitung.'
    AFTER kotak_9;

-- Backfill dua kasus nyata dari data contoh e-Nominasi.
-- Nilai sumbernya terdokumentasi di 002_seed.sql baris asesmen pegawai_id 7 & 8:
--   Tasya (pegawai_id 7): Y=100 X=69.58 → hitung 7, sumber mengirim 4
--   Tina  (pegawai_id 8): Y=100 X=61.74 → hitung 7, sumber mengirim 4
-- Keduanya berstatus asesmen lama; sumber tampaknya memakai ambang yang berbeda.
UPDATE asesmen_talenta a
JOIN pegawai p ON p.id = a.pegawai_id
SET a.kotak_9_sumber = 4
WHERE p.nama_lengkap IN ('Tasya', 'Tina')
  AND a.tahun_asesmen IN (2022, 2023)
  AND a.nilai_kinerja_y = 100.00;

-- Pemeriksaan: harus tepat 2 baris berselisih, dan tidak ada nilai sumber yang
-- sama dengan hasil hitung (itu berarti backfill-nya keliru sasaran).
SELECT COUNT(*) AS baris_berselisih
FROM asesmen_talenta
WHERE kotak_9_sumber IS NOT NULL AND kotak_9_sumber <> kotak_9;

SELECT COUNT(*) AS backfill_salah_sasaran
FROM asesmen_talenta
WHERE kotak_9_sumber IS NOT NULL AND kotak_9_sumber = kotak_9;
