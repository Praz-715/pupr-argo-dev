-- 019 — Dua syarat jabatan dari PP 11/2017 yang belum punya tempat: GOLONGAN dan
-- DURASI pengalaman.
--
-- Permintaan pemilik proses 25 Agu 2026: *"pastiin semua persyaratan minimal yang
-- ada di sheet masuk semua di aplikasi"*, merujuk lembar **Persyaratan Jabatan** di
-- `sample.xlsx` (identik dengan `doc/doc_tambahan_2/sample(1).xlsx`).
--
-- ## Yang kurang, dan mengapa keduanya bukan sekadar kolom tambahan
--
-- Lembar itu memuat lima kolom syarat per jabatan: Pendidikan, Bidang Pendidikan,
-- Pelatihan, Pengalaman Kerja, dan **Golongan**. Empat yang pertama sudah punya
-- rumahnya (`jabatan_target_persyaratan` + `jabatan_target_syarat_diklat`). Dua hal
-- ini belum:
--
--   1. **Golongan minimal** (IV/b Direktur · III/d Kasubdit & Ka BP2JK · III/b
--      Kasubag). Selama `jenis_syarat` tidak mengenalnya, ia hanya bisa dicatat
--      sebagai `LAINNYA` — dan `LAINNYA` selalu ditandai "perlu penilaian manusia",
--      jadi syarat KERAS berubah menjadi catatan yang tidak menyaring siapa pun.
--      `pegawai.golongan` sudah terisi untuk **78 dari 79** pegawai aktif, jadi
--      begitu jenisnya ada, pemeriksaannya langsung berjalan.
--   2. **Durasi pengalaman** ("pengawas **paling singkat 3 tahun**"). `nilai_minimal`
--      hanya dapat memuat SATU nilai, jadi ia sekarang menyimpan jenjangnya saja —
--      dan jenjang tanpa durasi meloloskan orang yang baru sebulan di jenjang itu.
--      Kolom terpisah dipilih alih-alih menyandikan keduanya ke satu teks
--      (`'IV:3'`): teks bersandi harus diurai di setiap tempat yang membacanya, dan
--      tempat yang lupa menguraikannya akan membandingkan `'IV:3'` dengan `'IV'`
--      lalu menyimpulkan syaratnya tidak terpenuhi.
--
-- ## Yang PERLU diketahui soal durasi: ia belum bisa ditegakkan otomatis
--
-- Kolomnya ditambahkan sekarang supaya syaratnya dapat DICATAT dan DITAMPILKAN utuh
-- seperti di lembar aslinya. Penegakan otomatisnya menunggu data: dari **670 baris**
-- `riwayat_jabatan`, **441** punya tanggal mulai tetapi hanya **35 (5%)** yang sudah
-- terpetakan ke master jabatan sehingga jenjangnya dapat dibaca mesin. Menegakkannya
-- sekarang akan menandai hampir semua kandidat "perlu verifikasi manual" — bukan
-- karena tidak memenuhi syarat, melainkan karena riwayatnya belum terbaca. Karena
-- itu `evaluasiKelayakan()` menyatakan durasinya perlu diperiksa manusia, DENGAN
-- alasannya, alih-alih menggugurkan atau meloloskan berdasarkan tebakan.
--
-- Idempoten: MODIFY menulis ulang definisi kolom secara utuh; nilai ENUM lama
-- dipertahankan pada urutan yang sama (MySQL menyimpan ENUM sebagai indeks —
-- mengubah urutannya akan MENAFSIRKAN ULANG baris lama tanpa satu pun galat).
-- Penambahan kolom dijaga pemeriksaan `information_schema` supaya menjalankannya dua
-- kali tidak menghasilkan galat "Duplicate column".

ALTER TABLE jabatan_target_persyaratan
    MODIFY COLUMN jenis_syarat ENUM(
        'PENDIDIKAN_MIN',
        'BIDANG_ILMU',
        'PENGALAMAN_MIN',
        'LAINNYA',
        'GOLONGAN_MIN'
    ) NOT NULL;

SET @ada := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'jabatan_target_persyaratan'
       AND COLUMN_NAME = 'durasi_tahun_min'
);
SET @sql := IF(
    @ada = 0,
    'ALTER TABLE jabatan_target_persyaratan
       ADD COLUMN durasi_tahun_min TINYINT UNSIGNED NULL
       COMMENT ''Lama minimal pada jenjang di nilai_minimal, dalam TAHUN. NULL = tidak dipersyaratkan.''
       AFTER nilai_minimal',
    'SELECT ''kolom durasi_tahun_min sudah ada'''
);
PREPARE j FROM @sql;
EXECUTE j;
DEALLOCATE PREPARE j;
