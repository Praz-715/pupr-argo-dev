-- 016 — Ambang Kotak 9 jadi parameter sistem (butir 7 daftar Penyesuaian).
--
-- Sebelum ini, ambang 80/60 hidup HANYA sebagai konstanta `AMBANG_SUMBU` di
-- `lib/scoring/konstanta.ts`, sehingga mengubahnya butuh deploy. Dua baris di
-- bawah memindahkan tempat menyimpannya; nilainya SENGAJA sama persis dengan
-- konstanta itu, jadi menjalankan berkas ini tidak mengubah satu pun angka yang
-- sudah tersimpan.
--
-- Yang perlu diketahui operator: mengubah ambang TIDAK otomatis menulis ulang
-- `asesmen_talenta.kotak_9`. Tampilan per jabatan target menghitung kotaknya di
-- SQL sehingga ikut berubah seketika, sedangkan sebaran organisasi membaca kolom
-- tersimpan. Sesudah mengubahnya, jalankan Hitung Ulang di tiap jabatan target
-- dan `npm run db:recompute`. Aksi `ubahPengaturan` sudah mengatakan ini di UI.
--
-- `nilai_min`/`nilai_max` dipasang lebar (1–99) karena yang benar-benar penting
-- adalah syarat ANTAR-baris (`atas > tengah`), dan itu ditegakkan di
-- `lib/aksi/pengaturan.ts` — batas per baris tidak bisa menyatakannya.
--
-- Idempoten: `ON DUPLICATE KEY UPDATE` hanya menyegarkan metadata tampilan,
-- TIDAK menimpa `nilai`. Menjalankan ulang berkas ini tidak boleh mengembalikan
-- ambang yang sudah disetel operator ke angka bawaan.

INSERT INTO pengaturan_sistem (kunci, nilai, tipe, label, deskripsi, nilai_min, nilai_max)
VALUES
  ('ambang_sumbu_atas', '80', 'ANGKA', 'Ambang kategori teratas Kotak 9',
   'Nilai minimum untuk masuk kategori teratas (sumbu Y "Di Atas Ekspektasi", sumbu X "Tinggi"). Batas bawah inklusif: nilai tepat sama dengan ambang sudah masuk. Harus lebih besar daripada ambang tengah.',
   1, 99),
  ('ambang_sumbu_tengah', '60', 'ANGKA', 'Ambang kategori tengah Kotak 9',
   'Nilai minimum untuk masuk kategori tengah (sumbu Y "Sesuai Ekspektasi", sumbu X "Menengah"); di bawah ini masuk kategori terbawah. Harus lebih kecil daripada ambang atas.',
   1, 99)
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  deskripsi = VALUES(deskripsi),
  nilai_min = VALUES(nilai_min),
  nilai_max = VALUES(nilai_max);
