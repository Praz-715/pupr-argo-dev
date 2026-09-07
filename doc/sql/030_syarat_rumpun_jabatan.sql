-- 030 — Syarat RUMPUN JABATAN ASAL: kandidat harus sedang menjabat rumpun tertentu.
--
-- Permintaan pemilik proses 1 Sep 2026, sesudah ia menanyakan apakah jabatan
-- anggota dipakai menyaring kandidat: *"bikinnya kaya gitu bisa gak, jadi filtering
-- kandidat dari jabatan anggota itu juga"*, lalu memilih: **menggugurkan** (seperti
-- golongan), dengan isi bawaan **satu tingkat di bawah jabatan anggota**.
--
-- ## Kenapa RUMPUN, bukan jabatan anggotanya persis
--
-- Menyaring persis ke `jabatan_target_anggota` MENGOSONGKAN setiap daftar kandidat,
-- dan itu terukur bukan ditaksir: pada jabatan target #439 (Ka BP2JK Sumatera
-- Selatan) kandidat lolos syarat turun **109 → 0**. Sebabnya struktural, bukan
-- kebetulan data — sebuah kursi jadi jabatan target justru karena KOSONG, jadi
-- menurut definisinya tidak ada seorang pun yang sedang mendudukinya.
--
-- Rumpun jabatan (`lib/jenis-jabatan.ts`) adalah tingkat pelipatan yang membuat
-- pertanyaannya bisa dijawab. Sebaran 109 kandidat #439 menurut rumpun jabatan
-- mereka sekarang: Kepala Sub Bagian 42 · Kepala Balai 34 · Kepala Sub Direktorat
-- 18 · Kepala Seksi 7 · Direktur 5 · Kepala Bagian 3.
--
-- ## Bawaannya DITULIS ke baris syarat, bukan dibaca hidup dari jabatan anggota
--
-- Ini keputusan yang paling mudah diambil keliru. Kalau aturannya "kandidat harus
-- satu tingkat di bawah jabatan anggota" dihitung SETIAP kali skor dievaluasi,
-- maka menambah satu jabatan anggota diam-diam mengubah SIAPA YANG LOLOS — tanpa
-- ada yang memutuskannya, tanpa jejak, dan tanpa satu pun galat.
--
-- Karena itu jabatan anggota hanya menentukan **isi bawaan** yang dituliskan ke
-- `jabatan_target_persyaratan` saat syaratnya dibuat: ia jadi baris yang terlihat
-- di tab Persyaratan, bisa disunting, dan tercatat di jejak audit seperti syarat
-- lain. Gerbangnya tetap SATU tempat — persyaratan — sejajar dengan golongan,
-- pendidikan, dan bidang ilmu.
--
-- ## Bentuk nilainya
--
-- `nilai_minimal` berisi daftar rumpun dipisah koma dan hubungannya **ATAU**, sama
-- dengan `BIDANG_ILMU`. Satu baris, bukan satu baris per rumpun: beberapa baris
-- sejenis di-AND oleh `evaluasiKelayakan()`, sehingga dua baris berarti menuntut
-- seseorang menjabat dua kursi sekaligus — nol orang lolos. `semua` = tidak
-- menyaring, jalan keluar eksplisit yang sejajar dengan `BIDANG_ILMU`.
--
-- Idempoten: enum-nya hanya diubah kalau nilainya belum ada.

SET @ada := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'jabatan_target_persyaratan'
       AND COLUMN_NAME = 'jenis_syarat'
       AND COLUMN_TYPE LIKE '%RUMPUN_JABATAN%'
);
SET @sql := IF(
    @ada = 0,
    "ALTER TABLE jabatan_target_persyaratan
       MODIFY COLUMN jenis_syarat
       ENUM('PENDIDIKAN_MIN','BIDANG_ILMU','PENGALAMAN_MIN','LAINNYA','GOLONGAN_MIN','RUMPUN_JABATAN')
       NOT NULL",
    "SELECT 'jenis_syarat sudah memuat RUMPUN_JABATAN'"
);
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;
