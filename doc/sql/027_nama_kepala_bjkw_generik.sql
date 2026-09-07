-- 027 — Kepala BJKW dinamai GENERIK: "Kepala Balai Jasa Konstruksi".
--
-- Permintaan pemilik proses 31 Agu 2026: *"Kepala Balai Jasa Konstruksi kaya gini aja
-- yang kepala bjkw"*.
--
-- Sebelum ini ketujuhnya membawa nama wilayahnya sendiri:
--
--     "Kepala Balai Jasa Konstruksi Wilayah I Aceh"
--     "Kepala Balai Jasa Konstruksi Wilayah II Palembang"   … dan lima lagi
--
-- ## Kenapa ini benar, bukan sekadar selera
--
-- Ia menyeragamkan BJKW dengan BP2JK, dan BP2JK-lah yang sudah benar: terukur di
-- master, **ke-34 kepala BP2JK bernama satu nama yang sama** — "Kepala Balai
-- Pelaksana Pemilihan Jasa Konstruksi" — dan yang membedakan mereka `unit_organisasi_id`,
-- bukan imbuhan di nama jabatannya. Daftar acuan `Nama Jabatan Struktural.xlsx` juga
-- menulisnya begitu: satu nama, 34 baris, unitnya di kolom sebelah.
--
-- Nama berimbuhan wilayah menduplikasi informasi yang sudah ada di unitnya, dan
-- akibatnya terlihat langsung di daftar "Tambah jabatan": tujuh kursi yang bagi
-- pembacanya SATU jabatan tampil sebagai tujuh baris berbeda, sebab `jenisJabatan()`
-- mengelompokkan menurut nama. Sesudah berkas ini, ketujuhnya melipat jadi satu
-- kelompok — sama seperti 34 BP2JK.
--
-- ## Yang TIDAK berubah
--
-- Hanya kolom `nama_jabatan`. `kode_jabatan` dipertahankan (ia jejak asal baris, dan
-- mengubahnya memutus penelusuran riwayat tanpa memperbaiki apa pun yang dilihat
-- pengguna), begitu pula `unit_organisasi_id` — yang justru menjadi satu-satunya
-- pembeda ketujuhnya sesudah ini.
--
-- **Dependen tidak tersentuh sama sekali**: `pegawai.jabatan_id`,
-- `jabatan_target_anggota.jabatan_id`, dan `riwayat_jabatan.jabatan_id` menunjuk `id`,
-- bukan nama. Terukur sebelum menulis: 6 penghuni, 4 keanggotaan jabatan target, 2
-- baris riwayat — seluruhnya ikut apa adanya.
--
-- ## Kesesuaian acuan tetap 123/123
--
-- Alias di `scripts/rapikan-jabatan-alias.ts` ikut disederhanakan pada perubahan yang
-- sama. Sebelumnya ia harus berkunci (nama, unit) karena nama masternya berbeda per
-- unit; sesudah ini ketujuhnya bernama sama, jadi pemetaannya kembali satu-ke-satu di
-- tingkat NAMA: nama kacau versi acuan → "Kepala Balai Jasa Konstruksi".
--
-- Idempoten: `WHERE` mencocokkan pola nama LAMA, jadi jalan kedua menyentuh 0 baris.

UPDATE jabatan j
  JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
   SET j.nama_jabatan = 'Kepala Balai Jasa Konstruksi'
 WHERE u.nama_unit LIKE 'Balai Jasa Konstruksi Wilayah %'
   AND j.eselon = 'III'
   AND j.status_jabatan <> 'DIHAPUS'
   AND j.nama_jabatan LIKE 'Kepala Balai Jasa Konstruksi Wilayah %';
