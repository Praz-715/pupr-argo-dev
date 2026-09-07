-- 018 — Dua jenis notifikasi untuk alur USULAN jabatan target.
--
-- Permintaan pemilik proses 24 Agu 2026: *"rapihin yok biar flownya jalan dengan
-- benar"*, sesudah pembagian peran diubah menjadi **unit mengusulkan, Admin
-- Talenta memutuskan** (`PERAN_USUL_TARGET` / `PERAN_KELOLA_TARGET` di
-- `lib/peran.ts`).
--
-- ## Kenapa alurnya belum jalan tanpa berkas ini
--
-- Pembagian peran itu membuat dua serah-terima BARU, dan keduanya semula tidak
-- punya sinyal apa pun:
--
--   1. Pengelola Unit membuat draft + mengisi persyaratan → **tidak ada yang
--      memberi tahu Admin Talenta**. Draftnya memang tampil di daftar Jabatan
--      Target, tapi hanya bagi orang yang kebetulan membuka halaman itu dan
--      memperhatikan barisnya. Usulan yang menunggu di antrean yang tidak
--      ditonton siapa pun sama saja dengan usulan yang hilang.
--   2. Admin Talenta menyusun rubrik lalu MENGAKTIFKAN → **pengusulnya tidak
--      tahu**. Padahal justru sesudah aktif ia bisa melanjutkan: skor terhitung,
--      kandidat bisa dimasukkan ke talent pool. Tanpa sinyal, ia harus menebak
--      kapan harus kembali memeriksa.
--
-- Keduanya sudah punya rumahnya: tabel `notifikasi` (011) beserta halaman Inbox
-- dan penghitung di navbar. Yang kurang hanya dua nilai ENUM.
--
-- ## Kenapa ENUM ditambah, bukan memakai nilai yang sudah ada
--
-- Tujuh nilai lama semuanya tentang NOMINASI/penetapan orang. Menumpangkan
-- usulan JABATAN pada `NOMINASI_MASUK` akan membuat Inbox menuliskan "Nominasi
-- masuk" untuk sesuatu yang bukan nominasi, dan penyaring per jenis di halaman
-- Inbox tidak akan pernah bisa memisahkannya lagi. Nilai ENUM lebih murah
-- daripada label yang berbohong.
--
-- Idempoten: MODIFY menulis ulang definisi kolom secara utuh, jadi menjalankannya
-- dua kali menghasilkan keadaan yang sama. Baris yang sudah ada tidak tersentuh
-- karena seluruh nilai lama tetap ada di daftar — urutannya pun dijaga, sebab
-- MySQL menyimpan ENUM sebagai indeks, dan mengubah urutan akan MENAFSIRKAN ULANG
-- baris lama menjadi jenis yang berbeda tanpa satu pun galat.

ALTER TABLE notifikasi
    MODIFY COLUMN jenis ENUM(
        'NOMINASI_MASUK',
        'NOMINASI_REVISI',
        'NOMINASI_DISETUJUI',
        'NOMINASI_DITOLAK',
        'MENUNGGU_PENETAPAN',
        'SUKSESOR_DITETAPKAN',
        'PENETAPAN_DIBATALKAN',
        'TARGET_DIUSULKAN',
        'TARGET_DIAKTIFKAN'
    ) NOT NULL;
