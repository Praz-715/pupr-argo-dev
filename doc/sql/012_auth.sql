-- 012_auth.sql — dijalankan setelah 011
--
-- KENAPA BERKAS INI ADA
--
-- Fase 7 mengganti identitas dev (cookie `simt_dev_user` + pengalih peran di
-- navbar) dengan sesi asli. Yang dibutuhkan skema, bukan cuma kode:
--
-- 1. Tabel `sesi` — sesi disimpan di DB, bukan JWT
--
--    JWT stateless terdengar lebih ringan, tapi ia salah untuk aplikasi ini
--    karena dua hal yang justru jadi inti Fase 7:
--
--      a. PENCABUTAN HARUS SEKETIKA. Menonaktifkan pengguna di Manajemen
--         Pengguna wajib memutus aksesnya sekarang, bukan setelah tokennya
--         kedaluwarsa sendiri. Dengan JWT, satu-satunya cara adalah menyimpan
--         daftar-cabut di server — yang berarti sudah punya keadaan server,
--         jadi sekalian saja simpan sesinya.
--      b. TIMEOUT IDLE BUTUH "TERAKHIR AKTIF". PRD §8 meminta sesi timeout;
--         token yang tidak bisa diperbarui tidak tahu apakah penggunanya masih
--         bekerja. Kolom `terakhir_aktif_pada` adalah satu-satunya tempat yang
--         jujur untuk itu.
--
--    Biayanya satu SELECT berindeks per permintaan — sama dengan yang sudah
--    dilakukan `getCurrentUser()` sejak Fase 0 untuk memuat peran & unit.
--
--    TOKENNYA DISIMPAN SEBAGAI HASH SHA-256, bukan apa adanya. Isi tabel `sesi`
--    yang bocor tidak boleh langsung jadi sesi hidup. Dipakai SHA-256 dan BUKAN
--    bcrypt karena tokennya 256 bit acak: tidak ada yang bisa ditebak, jadi
--    fungsi lambat hanya menambah biaya di setiap permintaan tanpa menambah
--    keamanan. (Sandi berbeda — di sana bcrypt memang perlu, lihat `lib/sandi.ts`.)
--
--    DUA TENGGAT, bukan satu. `terakhir_aktif_pada` menutup sesi yang ditinggal;
--    `kedaluwarsa_pada` menutup sesi yang dibiarkan hidup terus oleh tab yang
--    memuat ulang sendiri. Satu tenggat saja selalu bisa dilangkahi salah satu
--    dari dua cara itu.
--
-- 2. Tabel `pengaturan_sistem` — halaman Pengaturan Sistem (PRD §6.10)
--
--    PRD §10.11 menetapkan masa berlaku asesmen "3 tahun" sebagai PARAMETER
--    SISTEM yang bisa diubah tanpa deploy — tapi sampai Fase 6 angka itu hidup
--    sebagai konstanta di `lib/scoring/konstanta.ts`. Selama masih di sana,
--    jawaban atas pertanyaan terbuka §9 no. 2 tidak bisa dijalankan tanpa
--    menyentuh kode.
--
--    Bentuknya kunci–nilai bertipe, bukan satu baris berkolom banyak, supaya
--    menambah parameter tidak berarti ALTER TABLE. Nilainya disimpan sebagai
--    teks + kolom `tipe`; penerjemahannya satu tempat di `lib/pengaturan.ts`.
--
-- 3. Tabel `permintaan_reset_password` — Lupa Password TANPA berpura-pura
--
--    PRD §6.1 meminta "kirim link reset via email", tapi belum ada transport
--    surel yang diputuskan (tidak ada SMTP, tidak ada layanan surel di §4.3).
--    Halaman yang menjanjikan "cek email Anda" padahal tidak ada surel yang
--    dikirim adalah cacat yang paling mahal: penggunanya menunggu sesuatu yang
--    tidak akan datang, dan tidak melapor karena mengira itu salahnya sendiri.
--
--    KEPUTUSAN: permintaan DICATAT, lalu muncul di Manajemen Pengguna sebagai
--    pekerjaan Super Admin, yang mengatur ulang sandinya dan menyerahkan sandi
--    sementara lewat jalur di luar aplikasi. Halamannya mengatakan itu apa
--    adanya. Begitu transport surel diputuskan, tabel ini tinggal ditambahi
--    kolom token — alurnya sudah benar.
--
--    Balasannya SELALU sama, ada tidaknya akunnya. Pesan yang membedakan
--    "email tidak terdaftar" dari "link dikirim" adalah alat pencacah akun.
--
-- 4. Kolom baru di `users`
--
--    - `harus_ganti_sandi`: sandi yang dibuatkan Super Admin diketahui Super
--      Admin. Tanpa paksaan ganti di login berikutnya, ia tetap diketahui
--      selamanya, dan jejak audit "siapa melakukan apa" jadi bisa dibantah.
--    - `password_diubah_pada`: ditampilkan di Profil Saya & Manajemen Pengguna.
--    - `gagal_masuk_beruntun` + `terkunci_sampai`: penghambat tebak-sandi.
--      Penghitungnya di baris pengguna dan bukan di memori proses karena
--      Next.js bisa berjalan lebih dari satu instans — penghitung per proses
--      berarti batasnya terkalikan jumlah instans tanpa ada yang menyadarinya.

-- ---------------------------------------------------------------------
-- 1. SESI
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS sesi;
CREATE TABLE sesi (
    id                  BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id             BIGINT UNSIGNED NOT NULL,
    token_hash          CHAR(64) NOT NULL COMMENT 'SHA-256 hex dari token acak 256-bit. Token aslinya hanya pernah ada di cookie.',
    ip_address          VARCHAR(45) NULL,
    user_agent          VARCHAR(255) NULL COMMENT 'Untuk daftar "perangkat aktif" di Profil Saya',
    terakhir_aktif_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'Dasar timeout idle',
    kedaluwarsa_pada    DATETIME NOT NULL COMMENT 'Tenggat mutlak, tidak diperpanjang oleh aktivitas',
    dicabut_pada        DATETIME NULL COMMENT 'Diisi saat keluar / dicabut admin / sandi diganti',
    created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_sesi_token (token_hash),
    KEY idx_sesi_user (user_id, dicabut_pada),
    CONSTRAINT fk_sesi_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Sesi login pengguna internal (Fase 7). Token disimpan sebagai hash.';

-- ---------------------------------------------------------------------
-- 2. PENGATURAN SISTEM
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS pengaturan_sistem;
CREATE TABLE pengaturan_sistem (
    kunci       VARCHAR(60) NOT NULL PRIMARY KEY,
    nilai       VARCHAR(255) NOT NULL,
    tipe        ENUM('ANGKA','TEKS','BOOLEAN') NOT NULL DEFAULT 'TEKS',
    label       VARCHAR(150) NOT NULL,
    deskripsi   TEXT NULL COMMENT 'Ditampilkan di halaman Pengaturan: apa yang berubah kalau nilainya diubah',
    nilai_min   INT NULL COMMENT 'Batas bawah untuk tipe ANGKA (divalidasi di server juga)',
    nilai_max   INT NULL,
    diubah_oleh BIGINT UNSIGNED NULL,
    diubah_pada DATETIME NULL,
    CONSTRAINT fk_pengaturan_user FOREIGN KEY (diubah_oleh) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Parameter sistem yang boleh diubah tanpa deploy (PRD §6.10, §10.11)';

-- Nilai awal = default yang SUDAH berjalan di kode sejak Fase 0. Tabel ini
-- memindahkan tempat menyimpannya, bukan mengubah perilakunya.
INSERT INTO pengaturan_sistem (kunci, nilai, tipe, label, deskripsi, nilai_min, nilai_max) VALUES
('masa_berlaku_asesmen_tahun', '3', 'ANGKA', 'Masa berlaku hasil asesmen (tahun)',
 'Asesmen yang lebih tua dari ini dianggap kedaluwarsa dan pemiliknya tidak lolos syarat talent pool. Mengubahnya menggeser kelayakan kandidat — jalankan Hitung Ulang di tiap jabatan target setelahnya. Angka 3 adalah default PRD §10.11 yang belum dikonfirmasi pemilik proses.', 1, 15),
('tahun_asesmen_aktif', '2026', 'ANGKA', 'Tahun asesmen berjalan',
 'Tahun acuan untuk widget dashboard dan pilihan bawaan filter tahun. Tidak dipakai dalam perhitungan skor.', 2015, 2100),
('sesi_idle_menit', '60', 'ANGKA', 'Timeout sesi menganggur (menit)',
 'Sesi tanpa aktivitas selama ini akan berakhir dan pengguna diminta masuk lagi (PRD §8 Keamanan).', 5, 1440),
('sesi_maksimal_jam', '12', 'ANGKA', 'Umur maksimal satu sesi (jam)',
 'Tenggat mutlak: sesi berakhir setelah sekian jam sejak login, seaktif apa pun penggunanya. Menutup celah tab yang memperbarui diri sendiri terus-menerus.', 1, 168),
('maks_gagal_masuk', '5', 'ANGKA', 'Batas percobaan masuk yang gagal',
 'Setelah sekian kegagalan beruntun, akun terkunci sementara. Diatur ulang oleh login yang berhasil atau oleh Super Admin.', 3, 20),
('kunci_akun_menit', '15', 'ANGKA', 'Lama akun terkunci (menit)',
 'Berapa lama akun tidak bisa dipakai masuk setelah melewati batas kegagalan.', 1, 1440);

-- ---------------------------------------------------------------------
-- 3. PERMINTAAN RESET SANDI
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS permintaan_reset_password;
CREATE TABLE permintaan_reset_password (
    id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    email           VARCHAR(150) NOT NULL COMMENT 'Apa yang diketik pemohon — disimpan apa adanya walau tidak cocok akun mana pun',
    user_id         BIGINT UNSIGNED NULL COMMENT 'NULL kalau emailnya tidak terdaftar. Barisnya tetap dicatat sebagai jejak percobaan.',
    ip_address      VARCHAR(45) NULL,
    ditangani_pada  DATETIME NULL,
    ditangani_oleh  BIGINT UNSIGNED NULL,
    catatan         VARCHAR(255) NULL COMMENT 'Diisi Super Admin: bagaimana sandi sementara diserahkan',
    created_at      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_reset_belum_ditangani (ditangani_pada, id),
    KEY idx_reset_user (user_id),
    CONSTRAINT fk_reset_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    CONSTRAINT fk_reset_penangan FOREIGN KEY (ditangani_oleh) REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Permintaan Lupa Password. Belum ada transport surel — ditangani manual oleh Super Admin.';

-- ---------------------------------------------------------------------
-- 4. KOLOM BARU DI users
-- ---------------------------------------------------------------------
ALTER TABLE users
    ADD COLUMN harus_ganti_sandi    TINYINT(1) NOT NULL DEFAULT 0
        COMMENT 'Sandi diatur orang lain (Super Admin) — wajib diganti saat masuk berikutnya'
        AFTER password_hash,
    ADD COLUMN password_diubah_pada DATETIME NULL
        AFTER harus_ganti_sandi,
    ADD COLUMN gagal_masuk_beruntun SMALLINT UNSIGNED NOT NULL DEFAULT 0
        AFTER last_login_at,
    ADD COLUMN terkunci_sampai      DATETIME NULL
        COMMENT 'Diisi saat gagal_masuk_beruntun melewati batas'
        AFTER gagal_masuk_beruntun;

-- Akun seed sudah punya sandi dev yang diketahui (password123), jadi tidak ada
-- yang perlu dipaksa ganti. `password_diubah_pada` diisi dari created_at supaya
-- kolom "sandi terakhir diubah" tidak kosong di halaman admin.
UPDATE users SET password_diubah_pada = created_at WHERE password_diubah_pada IS NULL;

-- ---------------------------------------------------------------------
-- 5. INDEKS UNTUK AUDIT LOG VIEWER
-- ---------------------------------------------------------------------
-- `audit_log` sudah berindeks per entitas & per pengguna (001), tapi Audit Log
-- Viewer mengurutkan & menyaring menurut WAKTU — dan itu kolom yang paling
-- sering dipakai di halaman itu. Tanpa indeks ini, halaman pertama saja sudah
-- memindai seluruh tabel, dan audit_log adalah tabel yang hanya bertambah.
ALTER TABLE audit_log
    ADD KEY idx_audit_waktu (created_at, id),
    ADD KEY idx_audit_aksi (aksi, created_at);
