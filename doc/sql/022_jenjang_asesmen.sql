-- 022 — Potkom BERGANDA per pegawai: satu asesmen per JENJANG, satu yang dipakai.
--
-- Permintaan pemilik proses (`koreksi sistem informasi.pdf`, butir 2): *"Nilai mentah
-- Potkom agar ditambahkan 3 jenis jenjang asesmen: Asesmen fungsional, Asesmen
-- Pengawas, Asesmen Administrator. Nanti verifikator tinggal memasukkan datanya dan
-- memilih mana yang digunakan."*
--
-- ## Keadaannya BUKAN permintaan baru — sumbernya sudah begitu
--
-- Terukur di `Database Talenta Fungsional#binaka.xlsx`: **31 dari 32 pegawai punya DUA
-- baris asesmen** — satu pada jenjang fungsionalnya (AHLI MADYA / AHLI MUDA) dan satu
-- pada jenjang struktural (ADMINISTRATOR / PENGAWAS), dengan potkom yang berbeda.
-- Contoh: NIP …120 07 → AHLI MADYA 52,08 **dan** ADMINISTRATOR 59,86.
--
-- Sampai berkas ini, ekstraktor membaca kolom itu sebagai kolom TUNGGAL dan menyimpan
-- baris pertamanya saja. Tidak ada galat — potkom yang tersimpan tetap angka yang
-- masuk akal, jadi yang hilang hanya separuh dasar penilaian, diam-diam.
--
-- ## `jenjang_asesmen` disimpan APA ADANYA, tidak dilebur jadi tiga
--
-- Tiga kelompok yang diminta PDF (fungsional / Pengawas / Administrator) adalah
-- pengelompokan untuk DIBACA; peleburannya ditulis sekali di `lib/jenjang-asesmen.ts`.
-- Melebur di kolom berarti membuang beda AHLI MUDA vs AHLI MADYA yang ada di sumber
-- dan tidak bisa dikembalikan.
--
-- ## Kenapa pilihannya TABEL, bukan kolom `dipakai`
--
-- Pemilih asesmen di seluruh aplikasi berbentuk
-- `ROW_NUMBER() OVER (PARTITION BY pegawai_id ORDER BY tahun_asesmen DESC, id DESC)`
-- — dan ia ada di EMPAT berkas (`suksesi.ts` ×2, `skoring-tulis.ts`, `kualitas.ts`).
-- Begitu satu pegawai punya dua baris pada tahun yang sama, pemenangnya ditentukan
-- `id DESC`, yaitu urutan impor: sewenang-wenang. Itu persis keadaan yang tabel ini
-- ada untuk mengakhiri.
--
-- Kalau DUA baris tertandai dipakai untuk satu orang, kesewenang-wenangan itu kembali
-- **tanpa satu pun galat**. Sebuah kolom `dipakai TINYINT` tidak bisa mencegahnya:
-- MySQL menolak indeks unik parsial, dan akal-akalannya — kolom terhitung
-- `IF(dipakai=1, pegawai_id, NULL)` — **ditolak InnoDB** dengan "Cannot add foreign key
-- constraint", sebab `pegawai_id` adalah kolom ber-FK `ON DELETE CASCADE` dan MySQL
-- melarang kolom semacam itu jadi dasar kolom terhitung. (Dicoba lebih dulu; dicatat
-- di sini supaya tidak dicoba lagi.)
--
-- Tabel ber-PRIMARY KEY `pegawai_id` menegakkannya secara struktural: satu baris per
-- pegawai, titik. Ia sekaligus memberi tempat untuk **siapa yang memilih dan kapan** —
-- pola yang sama dengan `pegawai.hukdis_diverifikasi_oleh/_pada` dan
-- `riwayat_divalidasi_*`, dan memang itu yang diminta ("verifikator … memilih").
--
-- `ditetapkan_oleh` boleh NULL: FK-nya `ON DELETE SET NULL`, jadi menghapus akun
-- pemilihnya tidak boleh menghapus fakta bahwa pilihannya pernah dibuat — alasan yang
-- sama dengan `hukdis_diverifikasi_pada` yang jadi penanda, bukan `_oleh`.
--
-- ## Backfill TIDAK menggeser satu pun angka
--
-- Baris yang didaftarkan adalah **tepat baris yang selama ini menang** di ekspresi
-- ROW_NUMBER di atas, dan `ditetapkan_oleh` dibiarkan NULL karena memang tidak ada
-- manusia yang memilihnya. Jadi menjalankan berkas ini pada DB yang sudah ada
-- menghasilkan pilihan yang identik dengan perilaku sekarang; yang berubah hanya
-- pilihannya jadi eksplisit dan bisa diubah manusia.
--
-- Idempoten: penambahan kolom & tabel dijaga `information_schema`, dan backfill
-- memakai `INSERT IGNORE` sehingga pilihan yang sudah ada tidak tertimpa.

-- ── 1. jenjang_asesmen ──────────────────────────────────────────────────────────
SET @ada := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'asesmen_talenta'
       AND COLUMN_NAME = 'jenjang_asesmen'
);
SET @sql := IF(
    @ada = 0,
    'ALTER TABLE asesmen_talenta
       ADD COLUMN jenjang_asesmen VARCHAR(40) NULL
       COMMENT ''Jenjang tempat asesmen ini dinilai (AHLI MADYA, ADMINISTRATOR, PENGAWAS, ...), apa adanya dari sumber. NULL = sumber tidak menyebutkannya.''
       AFTER jenis_asesmen',
    'SELECT ''kolom jenjang_asesmen sudah ada'''
);
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;

-- ── 2. Buang kolom `dipakai` bila sempat terpasang ──────────────────────────────
--
-- Jalan pertama berkas ini menambahkannya sebelum penegaknya ternyata ditolak InnoDB.
-- Kolom tanpa penegak justru lebih buruk daripada tidak ada: ia terlihat seperti
-- jaminan yang tidak ia berikan.
SET @ada := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'asesmen_talenta'
       AND COLUMN_NAME = 'dipakai'
);
SET @sql := IF(
    @ada = 1,
    'ALTER TABLE asesmen_talenta DROP COLUMN dipakai',
    'SELECT ''kolom dipakai memang tidak ada'''
);
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;

-- ── 3. Pilihan verifikator: satu baris per pegawai, ditegakkan PRIMARY KEY ───────
CREATE TABLE IF NOT EXISTS asesmen_dipakai (
  pegawai_id      BIGINT UNSIGNED NOT NULL,
  asesmen_id      BIGINT UNSIGNED NOT NULL,
  ditetapkan_oleh BIGINT UNSIGNED NULL,
  ditetapkan_pada DATETIME NOT NULL DEFAULT (CURRENT_TIMESTAMP),
  catatan         VARCHAR(255) NULL,
  PRIMARY KEY (pegawai_id),
  UNIQUE KEY uk_asesmen_dipakai_asesmen (asesmen_id),
  CONSTRAINT fk_asesmen_dipakai_pegawai FOREIGN KEY (pegawai_id)
    REFERENCES pegawai (id) ON DELETE CASCADE,
  CONSTRAINT fk_asesmen_dipakai_asesmen FOREIGN KEY (asesmen_id)
    REFERENCES asesmen_talenta (id) ON DELETE CASCADE,
  CONSTRAINT fk_asesmen_dipakai_user FOREIGN KEY (ditetapkan_oleh)
    REFERENCES users (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
  COMMENT='Asesmen mana yang dipakai menilai tiap pegawai. PK pegawai_id = paling banyak satu, ditegakkan InnoDB.';

-- ── 4. Backfill: daftarkan baris yang SELAMA INI menang ─────────────────────────
INSERT IGNORE INTO asesmen_dipakai (pegawai_id, asesmen_id, ditetapkan_oleh, catatan)
SELECT pegawai_id, id, NULL, 'Backfill 022 — baris yang sudah dipakai sebelum pilihan ini bisa dinyatakan'
  FROM (
    SELECT id, pegawai_id, ROW_NUMBER() OVER (
             PARTITION BY pegawai_id ORDER BY tahun_asesmen DESC, id DESC
           ) AS rn
      FROM asesmen_talenta
  ) x
 WHERE x.rn = 1;
