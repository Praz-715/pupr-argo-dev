-- 015_syarat_diklat_target.sql — dijalankan setelah 014
--
-- KENAPA BERKAS INI ADA
--
-- `014` membuat kamus kategori diklat, tapi kategori saja tidak bisa dipakai
-- menilai apa pun: rubrik menanyakan "punya pengembangan kompetensi yang SESUAI
-- DENGAN JABATAN TARGET?", dan sampai sekarang jawabannya dicari dengan
-- mencocokkan `jabatan_target.kata_kunci_relevansi` (JSON berisi frasa bebas)
-- terhadap teks nama diklat.
--
-- Berkas ini memberi tempat menyimpan syaratnya sebagai **relasi ke kategori**,
-- bukan sebagai frasa. Bedanya bukan kerapian: `kata_kunci_relevansi` dipakai
-- BERSAMA oleh dua indikator yang berbeda — Kesesuaian Bidang Ilmu (pendidikan)
-- dan Pengembangan Kompetensi (diklat) — sehingga menambah kata kunci untuk
-- salah satunya diam-diam mengubah yang lain. Nilai `"semua"` bahkan sudah harus
-- diperlakukan berbeda di antara keduanya (lihat `nilaiPengembanganKompetensi`),
-- yang adalah gejala dari satu kolom dipakai dua maksud.
--
-- KENAPA TABEL JUNCTION, BUKAN NILAI DI `jabatan_target_persyaratan`
--
-- Tabel itu menyimpan satu syarat per baris dengan `nilai_minimal VARCHAR(60)` —
-- cukup untuk "S1_D4" atau "IV", tidak untuk daftar kategori. Menaruh daftar di
-- situ berarti memisahkan string dengan koma lagi, dan kembali kehilangan relasi
-- ke `master_kategori_riwayat_diklat` (kategori yang dihapus/diubah kodenya tidak
-- akan terdeteksi). Bentuknya mengikuti `jabatan_target_anggota` yang sudah ada.

DROP TABLE IF EXISTS jabatan_target_syarat_diklat;

CREATE TABLE jabatan_target_syarat_diklat (
    id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    jabatan_target_id BIGINT UNSIGNED NOT NULL,
    kategori_id       BIGINT UNSIGNED NOT NULL,
    -- Disediakan untuk membedakan "wajib" dari "nilai tambah" kalau nanti
    -- rubriknya membutuhkannya. **Belum dipakai perhitungan**: indikator
    -- Pengembangan Kompetensi hanya punya DUA kategori skor (punya → 100, tidak
    -- → 50), jadi tidak ada tempat untuk membedakan "punya 1 dari 3" dari
    -- "punya 3 dari 3". Menambahkan kolom sekarang lebih murah daripada ALTER
    -- pada tabel berisi nanti, tapi jangan dianggap sudah berpengaruh.
    wajib             TINYINT(1) NOT NULL DEFAULT 1,
    keterangan        VARCHAR(300) NULL,
    created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_jtsd_target_kategori (jabatan_target_id, kategori_id),
    KEY idx_jtsd_kategori (kategori_id),
    CONSTRAINT fk_jtsd_target FOREIGN KEY (jabatan_target_id)
        REFERENCES jabatan_target (id) ON DELETE CASCADE,
    CONSTRAINT fk_jtsd_kategori FOREIGN KEY (kategori_id)
        REFERENCES master_kategori_riwayat_diklat (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
COMMENT='Kategori diklat yang dianggap relevan untuk sebuah jabatan target. Sumber: sample(1).md lembar 6.';

-- ---------------------------------------------------------------------------
-- Isi dari sample(1).md lembar 6 "Persyaratan Jabatan"
-- ---------------------------------------------------------------------------
--
-- Lembar itu menyebut, untuk kedelapan jabatan di lingkungan Pengadaan:
--
--   Direktur (eselon II)      → Pelatihan Manajerial: Diklat PIM III /
--                               Kepemimpinan Administrator
--   Kasubdit & Ka Balai (III/IV) → Pelatihan Manajerial: Diklat PIM IV /
--                               Kepemimpinan Pengawas
--   semuanya                  → Pelatihan Teknis: Pengadaan Barang dan Jasa /
--                               Procurement, Hukum Kontrak, Manajemen Konstruksi
--
-- **Jabatan target ke-3 (BJKW) sengaja TIDAK diberi syarat**: lembar 6 hanya
-- memuat jabatan di lingkungan Pengadaan, dan BJKW (Jasa Konstruksi Wilayah)
-- tidak ada di sana. Mengarang syaratnya berarti mengarang persyaratan jabatan.
-- Akibatnya terdefinisi dan terlihat: `penuhiSyaratPelatihan()` menandainya
-- `tanpaSyarat`, dan indikator Pengembangan Kompetensi untuk target itu bernilai
-- "tidak diketahui" (perlu review), bukan lolos maupun gagal.

SET @pim3 = (SELECT id FROM master_kategori_riwayat_diklat WHERE kode = 'PIM_III');
SET @pim4 = (SELECT id FROM master_kategori_riwayat_diklat WHERE kode = 'PIM_IV');
SET @pbj  = (SELECT id FROM master_kategori_riwayat_diklat WHERE kode = 'PBJ');
SET @hk   = (SELECT id FROM master_kategori_riwayat_diklat WHERE kode = 'HUKUM_KONTRAK');
SET @mk   = (SELECT id FROM master_kategori_riwayat_diklat WHERE kode = 'MANAJEMEN_KONSTRUKSI');

-- Target 1: Kepala Balai BP2JK / Kasubdit Dit Pengadaan (eselon III & IV → PIM IV)
INSERT INTO jabatan_target_syarat_diklat (jabatan_target_id, kategori_id, keterangan)
SELECT t.id, k.kategori_id, k.ket
  FROM jabatan_target t
  JOIN (SELECT @pim4 AS kategori_id, 'Manajerial jenjang Pengawas/Administrator - lembar 6 baris 4-10' AS ket
        UNION ALL SELECT @pbj, 'Teknis: Pengadaan Barang dan Jasa / Procurement'
        UNION ALL SELECT @hk,  'Teknis: Hukum Kontrak'
        UNION ALL SELECT @mk,  'Teknis: Manajemen Konstruksi') k
 WHERE t.nama_target LIKE '%BP2JK%Kepala Subdirektorat%';

-- Target 2: Direktur Pengadaan Jasa Konstruksi (eselon II → PIM III)
INSERT INTO jabatan_target_syarat_diklat (jabatan_target_id, kategori_id, keterangan)
SELECT t.id, k.kategori_id, k.ket
  FROM jabatan_target t
  JOIN (SELECT @pim3 AS kategori_id, 'Manajerial jenjang Administrator - lembar 6 baris 3' AS ket
        UNION ALL SELECT @pbj, 'Teknis: Pengadaan Barang dan Jasa / Procurement'
        UNION ALL SELECT @hk,  'Teknis: Hukum Kontrak'
        UNION ALL SELECT @mk,  'Teknis: Manajemen Konstruksi') k
 WHERE t.nama_target = 'Direktur Pengadaan Jasa Konstruksi';

-- ---------------------------------------------------------------------------
-- Pemeriksaan
-- ---------------------------------------------------------------------------
SELECT t.id, t.nama_target,
       COUNT(s.id) AS jumlah_syarat_diklat,
       COALESCE(GROUP_CONCAT(k.kode ORDER BY k.kode SEPARATOR ', '), '(tanpa syarat)') AS kategori
  FROM jabatan_target t
  LEFT JOIN jabatan_target_syarat_diklat s ON s.jabatan_target_id = t.id
  LEFT JOIN master_kategori_riwayat_diklat k ON k.id = s.kategori_id
 GROUP BY t.id, t.nama_target
 ORDER BY t.id;
