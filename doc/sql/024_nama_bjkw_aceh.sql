-- 024 — "Kepala Balai Jasa Konstruksi Wilayah I MEDAN" → "… Wilayah I ACEH".
--
-- Dilaporkan pemilik proses 31 Agu 2026 lewat tangkapan layar daftar Tambah Jabatan:
-- barisnya berbunyi
--
--     Kepala Balai Jasa Konstruksi Wilayah I Medan
--     Balai Jasa Konstruksi Wilayah I Aceh · Eselon III
--
-- Nama jabatan menyebut Medan, unitnya Aceh — terbaca seperti jabatan yang salah
-- tempat, padahal unitnya justru sudah benar.
--
-- ## Kenapa keadaannya begitu
--
-- `JAB-KABALAI-BJKW-MDN` adalah Kepala Balai untuk balai yang dulu bernama Wilayah I
-- **Medan** dan kini bernama Wilayah I **Aceh** — balai yang sama, nama lama. Pada
-- 24 Agu 2026 `rapikan:unit --rapikan-terparkir` memindahkannya dari akar Ditjen ke
-- `BALAI-ACEH` (jabatan STRUKTURAL Kepala Balai tidak mungkin milik Ditjen, dan
-- daftar acuan menyebut Wilayah I = Aceh). Yang dipindah **unitnya**; namanya tidak
-- ikut diperbarui, dan sejak itu keduanya saling bertentangan di layar.
--
-- Ia tidak dihapus waktu itu karena masih jadi anggota `jabatan_target` #176 — target
-- yang dibuat MANUSIA (jejak `audit_log` ber-IP publik), dan yang pernah saya hapus
-- keliru lalu harus dipulihkan. Mengganti namanya menyelesaikan keluhannya tanpa
-- menyentuh keanggotaan itu sama sekali.
--
-- ## Yang diperiksa sebelum menulis
--
-- - **0 penghuni, 0 riwayat jabatan** → tidak ada sejarah karier siapa pun yang ikut
--   berubah bunyinya.
-- - **1 anggota jabatan target** → keanggotaan menunjuk `jabatan_id`, bukan nama, jadi
--   target #176 tidak berlubang. Hanya labelnya yang berubah.
-- - **Tidak bentrok**: unit `Balai Jasa Konstruksi Wilayah I Aceh` belum punya jabatan
--   bernama tujuan. Nama tujuan sengaja mengikuti pola 6 BJKW lain
--   ("Kepala Balai Jasa Konstruksi Wilayah <romawi> <kota>"), bukan nama versi daftar
--   acuan — yang itu memuat "Jasa Konstruksi" tiga kali (salah ketik di sumbernya,
--   sudah tercatat di CLAUDE.md) dan sudah ada terpisah sebagai jabatan id 191.
--
-- `kode_jabatan` **TIDAK diubah**. Ia jejak asal baris ini dan dirujuk catatan
-- sebelumnya; mengubahnya membuat riwayat penelusuran tidak bisa dicocokkan lagi,
-- tanpa memperbaiki apa pun yang dilihat pengguna.
--
-- Idempoten: `WHERE` mencocokkan nama LAMA, jadi jalan kedua tidak mengubah apa pun.

UPDATE jabatan
   SET nama_jabatan = 'Kepala Balai Jasa Konstruksi Wilayah I Aceh'
 WHERE kode_jabatan = 'JAB-KABALAI-BJKW-MDN'
   AND nama_jabatan = 'Kepala Balai Jasa Konstruksi Wilayah I Medan';
