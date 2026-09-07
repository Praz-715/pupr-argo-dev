-- 017 — Skor predikat & bobot Formula A jadi parameter sistem.
--
-- Permintaan pemilik proses 24 Agu 2026: *"bikin biar ada enumnya gitu biar kalo
-- user mau ganti2 bisa dari ui jangan di hardcode biar gausah ubah kode lagi"*.
--
-- ## Yang dipindahkan ke sini, dan yang SUDAH bisa diubah di tempat lain
--
-- Sebagian besar angka rubrik SUDAH bisa diubah dari UI — bukan lewat berkas ini,
-- melainkan lewat **editor rubrik per jabatan target** (Fase 5), sebab di sanalah
-- ia disimpan: bobot komponen 0,65 / 0,20 / 0,15, bobot indikator 0,05, skor tiap
-- kategori (Doktor 100 … SLTA 60, hukdis 100/75/50/25/0, keragaman & substansi
-- riwayat), serta ambang potkom ≥80 / ≥68 / <68. Menyalinnya ke
-- `pengaturan_sistem` akan membuat SUMBER KEDUA yang harus sepakat dengan rubrik
-- — pelanggaran aturan satu-sumber-kebenaran, dan bentuk kegagalannya bukan galat
-- melainkan dua halaman yang berhitung berbeda.
--
-- Yang benar-benar masih hidup sebagai konstanta kode — dan karena itu ada di
-- berkas ini — hanya dua kelompok:
--
--   1. **Skor sumbu Y per predikat kinerja.** Ia dipakai `skorPredikat()` untuk
--      menurunkan `asesmen_talenta.nilai_kinerja_y` dari predikat yang dikirim
--      sumber, sebelum rubrik mana pun terlibat. Jadi ia bukan bagian rubrik satu
--      jabatan target; ia skala organisasi.
--   2. **Bobot Formula A** (Nilai Talenta = 50% Y + 50% X). Sama: satu skala untuk
--      seluruh organisasi, tidak per jabatan target.
--
-- ## Kenapa lima BARIS, bukan satu baris JSON
--
-- Satu baris berisi `{"Sangat Baik":100,...}` akan lolos dari `nilai_min`/
-- `nilai_max`, tidak bisa dirender halaman Pengaturan yang sudah ada, dan
-- memaksa pengguna menyunting JSON di kotak teks — permukaan yang dijamin
-- menghasilkan tanda kutip yang salah. Lima baris ANGKA memakai UI, validasi, dan
-- jejak audit yang sudah terbukti; tidak ada yang perlu ditulis baru.
--
-- Kelima PREDIKATNYA tidak bisa ditambah dari UI, dan itu disengaja: namanya
-- datang dari sumber (e-Kinerja / Excel Talent Pool), jadi predikat keenam yang
-- dibuat di sini tidak akan pernah dikirim siapa pun.
--
-- ## Yang perlu diketahui operator
--
-- Mengubah angka di sini TIDAK menulis ulang `asesmen_talenta` yang sudah ada.
-- `nilai_kinerja_y` & `nilai_talenta` adalah kolom TERSIMPAN, jadi sesudah
-- mengubahnya jalankan Hitung Ulang di tiap jabatan target lalu
-- `npm run db:recompute`. Aksi `ubahPengaturan` mengatakan ini di UI.
--
-- Nilainya SENGAJA sama persis dengan konstanta di `lib/scoring/konstanta.ts`,
-- jadi menjalankan berkas ini tidak menggeser satu pun angka tersimpan.
--
-- Idempoten: `ON DUPLICATE KEY UPDATE` hanya menyegarkan metadata tampilan,
-- TIDAK menimpa `nilai` — menjalankannya ulang tidak boleh mengembalikan skala
-- yang sudah disetel operator ke angka bawaan.

INSERT INTO pengaturan_sistem (kunci, nilai, tipe, label, deskripsi, nilai_min, nilai_max)
VALUES
  ('skor_predikat_sangat_baik', '100', 'ANGKA', 'Skor sumbu Y — predikat Sangat Baik',
   'Nilai sumbu Y (kinerja) untuk predikat "Sangat Baik". Skala ini menurunkan nilai_kinerja_y dari predikat yang dikirim sumber, dan berlaku untuk SELURUH organisasi — bukan per jabatan target. Harus >= skor predikat Baik.',
   0, 100),
  ('skor_predikat_baik', '80', 'ANGKA', 'Skor sumbu Y — predikat Baik',
   'Nilai sumbu Y untuk predikat "Baik". Pada ambang bawaan (80) predikat ini tepat menyentuh batas "Di Atas Ekspektasi" — batas bawahnya inklusif, jadi menurunkannya satu poin saja memindahkan seluruh pegawai berpredikat Baik ke kategori tengah.',
   0, 100),
  ('skor_predikat_butuh_perbaikan', '60', 'ANGKA', 'Skor sumbu Y — predikat Butuh Perbaikan',
   'Nilai sumbu Y untuk predikat "Butuh Perbaikan". Harus di antara skor Baik dan skor Kurang.',
   0, 100),
  ('skor_predikat_kurang', '40', 'ANGKA', 'Skor sumbu Y — predikat Kurang',
   'Nilai sumbu Y untuk predikat "Kurang". Harus di antara skor Butuh Perbaikan dan skor Sangat Kurang.',
   0, 100),
  ('skor_predikat_sangat_kurang', '20', 'ANGKA', 'Skor sumbu Y — predikat Sangat Kurang',
   'Nilai sumbu Y untuk predikat "Sangat Kurang", predikat terendah. Boleh 0.',
   0, 100),
  ('bobot_talenta_kinerja', '50', 'ANGKA', 'Bobot sumbu Y pada Nilai Talenta (%)',
   'Bobot nilai kinerja (sumbu Y) dalam Formula A: Nilai Talenta = bobot Y x nilai kinerja + bobot X x nilai potensial. Dijumlahkan dengan bobot sumbu X harus tepat 100.',
   0, 100),
  ('bobot_talenta_potensial', '50', 'ANGKA', 'Bobot sumbu X pada Nilai Talenta (%)',
   'Bobot nilai potensial (sumbu X) dalam Formula A. Dijumlahkan dengan bobot sumbu Y harus tepat 100. Nilai Talenta tetap diplafon 100 walau sumbu X sendiri boleh melewatinya.',
   0, 100)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  deskripsi = VALUES(deskripsi),
  nilai_min = VALUES(nilai_min),
  nilai_max = VALUES(nilai_max);
