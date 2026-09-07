-- 034 — kotak CATATAN berkategori di profil pegawai (HDS · HDB · TBTL · TBS).
--
-- Permintaan pemilik proses (`2 sept- masukan sistem informasi.pdf`, butir 1):
-- *"Pada Profil Talenta kita harus menyiapkan tambahan kotak judulnya catatan untuk
-- diisi keterangan kategori inisial : HDS, HDB, TBTL, TBS … sehingga saat di
-- direktori pegawai dan list kandidat akan kelihatan yang punya inisial tersebut
-- berwarna/ada highlight kuning."*
--
-- Ditegaskan susulan: *"biarin aja singkatan, yang penting user bisa milih pilihan
-- itu"* — jadi kodenya disimpan APA ADANYA tanpa kepanjangan. Itu keputusan yang
-- disengaja dan perlu dicatat: aplikasi ini tidak tahu arti keempatnya, sehingga ia
-- tidak boleh menurunkan apa pun darinya — tidak menggeser skor, tidak menggugurkan
-- kelayakan, tidak diurutkan seolah HDB "lebih berat" dari TBS. Yang dilakukannya
-- persis satu: menandai, supaya manusia yang membaca daftar tahu harus melihat lagi.
--
-- ## Kenapa KOLOM di `pegawai`, bukan tabel sendiri
--
-- Bentuk yang diminta satu kotak berisi satu pilihan + keterangannya, sejajar dengan
-- `hukdis_diverifikasi_*` yang sudah ada di tabel ini — bukan daftar berjalan seperti
-- `hukuman_disiplin` yang memang punya banyak baris per orang, masing-masing ber-SK
-- dan bermasa berlaku. Tabel terpisah untuk satu nilai per pegawai berarti setiap
-- pembaca daftar (direktori, kandidat, talent pool) menambah satu JOIN demi satu
-- kolom, dan halaman yang lupa menambahkannya diam-diam berhenti menandai.
--
-- Kalau nanti seseorang perlu MEMPUNYAI dua kode sekaligus, itu perubahan bentuk
-- (kolom → tabel), bukan penambahan nilai enum. Sengaja dibiarkan single-choice
-- sekarang karena permintaannya "pilihan", dan menebak jamak lebih mahal dibalik
-- daripada menebak tunggal.
--
-- ## Kenapa TIDAK menyentuh skor
--
-- `hukuman_disiplin` sudah menjadi masukan indikator Integritas & Moralitas (15%).
-- Kalau kode di sini ikut menggeser skor, satu kejadian yang sama bisa terhitung dua
-- kali — sekali lewat catatan hukumannya, sekali lewat kodenya — dan tidak ada
-- halaman yang bisa menjelaskan selisihnya. Kotak ini penanda untuk MANUSIA.

ALTER TABLE pegawai
  ADD COLUMN catatan_kategori ENUM('HDS','HDB','TBTL','TBS') NULL
    COMMENT 'Kode catatan pilihan verifikator; artinya di luar sistem'
    AFTER hukdis_catatan_verifikasi,
  ADD COLUMN catatan_keterangan VARCHAR(500) NULL AFTER catatan_kategori,
  ADD COLUMN catatan_oleh BIGINT UNSIGNED NULL AFTER catatan_keterangan,
  ADD COLUMN catatan_pada DATETIME NULL AFTER catatan_oleh;

-- `pada` yang jadi penanda "catatan ini pernah diisi", bukan `oleh`: FK-nya
-- SET NULL, jadi menghapus akun penulisnya mengosongkan `oleh` sementara
-- catatannya memang pernah ditulis. Aturan yang sama dengan `hukdis_diverifikasi_*`.
ALTER TABLE pegawai
  ADD CONSTRAINT fk_pegawai_catatan_oleh
    FOREIGN KEY (catatan_oleh) REFERENCES users (id) ON DELETE SET NULL;

-- Dipakai menyaring "yang punya kode" di direktori & daftar kandidat.
ALTER TABLE pegawai ADD INDEX idx_pegawai_catatan_kategori (catatan_kategori);
