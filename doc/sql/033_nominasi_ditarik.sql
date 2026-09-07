-- 033 — `nominasi.status` dapat nilai DITARIK.
--
-- Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 3):
-- *"Mundurin status … user ada kemungkinan salah pencet dll dsb jd perlu disediain
-- dia turun kebawah ke nominasi lg **dan diatas datanya klir**."*
--
-- ## Bagian "datanya klir" yang belum terpenuhi
--
-- Aksi `BATALKAN_NOMINASI` (1 Sep 2026) sudah memindahkan orangnya turun, tapi baris
-- nominasinya ditutup dengan status **DITOLAK** — sebab itu satu-satunya nilai enum
-- yang tersedia untuk "sudah tidak berjalan". Akibatnya persis kebalikan dari yang
-- diminta: sebuah salah pencet yang DIBATALKAN tetap meninggalkan catatan bahwa
-- orang itu **pernah ditolak**, dan ia muncul di daftar & penyaring "Ditolak" —
-- padahal tidak ada seorang pun yang pernah menolaknya.
--
-- Bedanya bukan kosmetik. "Ditolak" adalah keputusan tentang ORANGNYA yang bisa
-- dibaca lagi bertahun kemudian, mis. saat ia dicalonkan di kursi lain. "Ditarik"
-- menyatakan pengajuannya yang dibatalkan, bukan orangnya yang gagal.
--
-- ## Kenapa nilai enum baru, bukan menghapus barisnya
--
-- Menghapus baris nominasi + `approval_log` memang membuat "data di atas" hilang
-- sepenuhnya, tapi ia juga menghapus jejak siapa memutuskan apa — dan itu membalik
-- prinsip yang dipegang seluruh modul suksesi (`lib/audit.ts`: tidak ada mutasi
-- tanpa jejak). Dengan `DITARIK`, yang di atas benar-benar bersih (tidak ada lagi
-- nominasi berjalan, dan tidak ada penolakan yang mengendap di rekam jejaknya)
-- sementara riwayatnya tetap bisa dipertanggungjawabkan.
--
-- Idempoten: enum hanya diubah kalau nilainya belum ada.

SET @ada := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'nominasi'
       AND COLUMN_NAME = 'status'
       AND COLUMN_TYPE LIKE '%DITARIK%'
);
SET @sql := IF(
    @ada = 0,
    "ALTER TABLE nominasi
       MODIFY COLUMN status
       ENUM('DIAJUKAN','MENUNGGU_VERIFIKASI','DISETUJUI','DITOLAK','DITARIK')
       NOT NULL DEFAULT 'DIAJUKAN'",
    "SELECT 'status nominasi sudah memuat DITARIK'"
);
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;
