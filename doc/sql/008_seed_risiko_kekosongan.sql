-- 008_seed_risiko_kekosongan.sql — DIHASILKAN PROGRAM, jangan disunting tangan
-- Sumber: scripts/gen-008-seed-risiko.ts  ·  acuan tanggal: 2026-07-31
--
-- Tujuan: memberi data dev beberapa pejabat yang mendekati Batas Usia Pensiun,
-- supaya halaman "Jabatan Kosong & Risiko Kekosongan" (U-6) punya isi dan semua
-- cabang UI-nya teruji. Sebelum berkas ini, pejabat terdekat BUP masih 6,3 tahun
-- lagi sehingga halaman itu selalu kosong pada ambang 3 tahun.
--
-- Yang diubah HANYA delapan digit pertama NIP (tanggal lahir). Digit TMT CPNS,
-- jenis kelamin, dan nomor urut dipertahankan supaya masa kerja & komposisi
-- gender tidak ikut bergeser.
--
-- Perubahan:
--   Budi Santoso       197211081996031001 → 196703071996031001  (usia 59, BUP 60, sisa ~0.6 thn)
--   Rus                197805251998032005 → 196912241998032005  (usia 56, BUP 58, sisa ~1.4 thn)
--   Ika Puspita        197806232003122002 → 197011172003122002  (usia 55, BUP 58, sisa ~2.3 thn)
--   Iwan               197906192010121002 → 197106242010121002  (usia 55, BUP 58, sisa ~2.9 thn)

-- Budi Santoso: lahir 19670307 → usia 59 thn, BUP 60, sisa ~0.6 thn
UPDATE pegawai SET nip = '196703071996031001' WHERE nip = '197211081996031001';

-- Rus: lahir 19691224 → usia 56 thn, BUP 58, sisa ~1.4 thn
UPDATE pegawai SET nip = '196912241998032005' WHERE nip = '197805251998032005';

-- Ika Puspita: lahir 19701117 → usia 55 thn, BUP 58, sisa ~2.3 thn
UPDATE pegawai SET nip = '197011172003122002' WHERE nip = '197806232003122002';

-- Iwan: lahir 19710624 → usia 55 thn, BUP 58, sisa ~2.9 thn
UPDATE pegawai SET nip = '197106242010121002' WHERE nip = '197906192010121002';

-- Pemeriksaan: keempat NIP baru harus tetap 18 digit & unik.
SELECT COUNT(*) AS nip_18_digit FROM pegawai WHERE nip REGEXP '^[0-9]{18}$';
SELECT COUNT(*) AS total_pegawai, COUNT(DISTINCT nip) AS nip_unik FROM pegawai;
