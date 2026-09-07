-- 031 — `jabatan_target_persyaratan.nilai_minimal` VARCHAR(60) → VARCHAR(500).
--
-- Ditemukan MySQL, bukan oleh pemeriksaan saya: memasang syarat `RUMPUN_JABATAN`
-- (`doc/sql/030`) untuk jabatan target eselon IV gagal dengan
-- `ER_DATA_TOO_LONG` — daftar sepuluh rumpun fungsional di bawahnya panjangnya
-- ~290 karakter ("Analis Pengelolaan Keuangan APBN, Analis Sumber Daya Manusia
-- Aparatur, Arsiparis, Pembina Jasa Konstruksi, …").
--
-- ## 60 memang sudah sempit sebelum ini, dan diam
--
-- Kolom ini menampung DUA bentuk nilai: skalar (`III/d`, `S1_D4`, `IV`) yang
-- pendek, dan DAFTAR BERKOMA untuk `BIDANG_ILMU` — yang lembar Persyaratan Jabatan
-- `sample.xlsx` sendiri isinya sembilan rumpun. Terpanjang yang tersimpan hari ini
-- 50 karakter, jadi batas 60 belum pernah tersentuh; ia akan menggigit pertama kali
-- justru saat seseorang mengetik daftar bidang ilmu yang lengkap dari lembar itu,
-- dan gejalanya bukan penolakan yang bisa dibaca melainkan galat 500.
--
-- ## Kenapa 500, dan kenapa bukan TEXT
--
-- Daftar terpanjang yang bisa lahir dari master sekarang ~290 karakter; 500 memberi
-- ruang tanpa mengubah kolom jadi tak terbatas. Batas yang masih ADA tetap berguna:
-- ia yang membedakan "daftar nilai" dari "prosa", dan prosa tempatnya `deskripsi`
-- yang memang `TEXT`. Kolom tanpa batas mengundang kalimat masuk ke tempat yang
-- dibaca mesin sebagai daftar berkoma.
--
-- Melebarkan VARCHAR tidak menulis ulang barisnya dan tidak bisa memotong data yang
-- sudah ada. Idempoten: hanya diubah kalau lebarnya masih di bawah 500.

SET @sempit := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'jabatan_target_persyaratan'
       AND COLUMN_NAME = 'nilai_minimal'
       AND CHARACTER_MAXIMUM_LENGTH < 500
);
SET @sql := IF(
    @sempit = 1,
    "ALTER TABLE jabatan_target_persyaratan
       MODIFY COLUMN nilai_minimal VARCHAR(500) NULL
       COMMENT 'Nilai terstruktur syarat: skalar (III/d, S1_D4) ATAU daftar berkoma (BIDANG_ILMU, RUMPUN_JABATAN). Prosa tempatnya kolom deskripsi.'",
    "SELECT 'nilai_minimal sudah cukup lebar'"
);
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;
