-- =====================================================================
-- SIMT DJBK - 004 Normalisasi Data Dev
--
-- Menyelaraskan isi pupr_dev dengan aturan di phase.md §2. Data dev adalah
-- DUMMY (alat uji), sementara doc/KERANGKA TALENT POOL.md adalah ATURAN --
-- jadi kalau keduanya bentrok, datanya yang dibetulkan (phase.md §1).
--
-- Berkas ini hanya memperbaiki FORMAT & STRUKTUR RUBRIK. Nilai turunan
-- (nilai_kinerja_y, nilai_potensial_x, nilai_talenta, kotak_9,
-- nilai_integritas, status_asesmen, match_score) TIDAK disentuh di sini --
-- semuanya dihitung ulang oleh lib/scoring di 007_recompute.sql, supaya
-- tidak ada angka hasil hitung yang ditulis tangan.
--
-- URUTAN JALANKAN: 001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007
-- =====================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------------
-- 1. Format golongan diseragamkan ke GARIS MIRING
--
-- Data contoh dari eHRM memakai titik (IV.a, IV.b) sementara mayoritas
-- baris lain memakai garis miring (III/d, IV/a). Dua format yang hidup
-- bersamaan membuat filter & GROUP BY golongan terpecah dua.
-- Format garis miring dipilih karena sudah dipakai 11 dari 16 baris.
-- ---------------------------------------------------------------------

UPDATE pegawai SET golongan = REPLACE(golongan, '.', '/') WHERE golongan LIKE '%.%';

-- ---------------------------------------------------------------------
-- 2. Jenis asesmen: kapitalisasi seragam + istilah terkini
--
-- Sumber pernah mengirim 'PENGAWAS' (kapital) berdampingan dengan
-- 'Pengawas', sehingga GROUP BY menghasilkan dua bucket untuk hal yang
-- sama. 'JPT Pertama' adalah istilah lama dari 'JPT Pratama'.
-- ---------------------------------------------------------------------

UPDATE asesmen_talenta SET jenis_asesmen = 'Pengawas'     WHERE UPPER(jenis_asesmen) = 'PENGAWAS';
UPDATE asesmen_talenta SET jenis_asesmen = 'Administrator' WHERE UPPER(jenis_asesmen) = 'ADMINISTRATOR';
UPDATE asesmen_talenta SET jenis_asesmen = 'Pelaksana'    WHERE UPPER(jenis_asesmen) = 'PELAKSANA';
UPDATE asesmen_talenta SET jenis_asesmen = 'JPT Pratama'  WHERE UPPER(jenis_asesmen) IN ('JPT PERTAMA', 'JPT PRATAMA');
UPDATE asesmen_talenta SET jenis_asesmen = 'JPT Madya'    WHERE UPPER(jenis_asesmen) = 'JPT MADYA';
UPDATE asesmen_talenta SET jenis_asesmen = 'JFT Pertama'  WHERE UPPER(jenis_asesmen) = 'JFT PERTAMA';
UPDATE asesmen_talenta SET jenis_asesmen = 'JFT Muda'     WHERE UPPER(jenis_asesmen) = 'JFT MUDA';
UPDATE asesmen_talenta SET jenis_asesmen = 'JFT Madya'    WHERE UPPER(jenis_asesmen) = 'JFT MADYA';
UPDATE asesmen_talenta SET jenis_asesmen = 'JFT Utama'    WHERE UPPER(jenis_asesmen) = 'JFT UTAMA';

-- ---------------------------------------------------------------------
-- 3. Potkom dibawa ke rentang sah 0-100
--
-- Lima baris melebihi 100 (tertinggi 115,10) sementara klasifikasi Sumbu X
-- di KERANGKA §B mendefinisikan "Tinggi >=80-100" -- jelas mengasumsikan
-- batas atas 100.
--
-- Nilai baru dipilih agar URUTAN RELATIF antar pegawai tetap sama dan
-- semuanya tetap berada di band "Tinggi", bukan di-clamp rata ke 100 (yang
-- akan membuat lima orang seri persis dan menghilangkan pembeda ranking).
--   Yatno  115,10 -> 99,50
--   Budi   112,00 -> 99,00
--   Rahmat 103,89 -> 98,50
--   Irwan  102,50 -> 98,00
--   Rus    101,25 -> 97,50   (tetap di atas Yuliana yang 97,00)
-- ---------------------------------------------------------------------

UPDATE asesmen_talenta a JOIN pegawai p ON p.id = a.pegawai_id
SET a.potkom = 99.50 WHERE p.nip = '198405202009121008' AND a.potkom > 100;   -- Yatno

UPDATE asesmen_talenta a JOIN pegawai p ON p.id = a.pegawai_id
SET a.potkom = 99.00 WHERE p.nip = '197211081996031001' AND a.potkom > 100;   -- Budi Santoso

UPDATE asesmen_talenta a JOIN pegawai p ON p.id = a.pegawai_id
SET a.potkom = 98.50 WHERE p.nip = '198901292010121003' AND a.potkom > 100;   -- Rahmat

UPDATE asesmen_talenta a JOIN pegawai p ON p.id = a.pegawai_id
SET a.potkom = 98.00 WHERE p.nip = '197907292005021003' AND a.potkom > 100;   -- Irwan

UPDATE asesmen_talenta a JOIN pegawai p ON p.id = a.pegawai_id
SET a.potkom = 97.50 WHERE p.nip = '197805251998032005' AND a.potkom > 100;   -- Rus

-- Jaring pengaman: kalau masih ada yang di luar rentang, potong.
UPDATE asesmen_talenta SET potkom = 100 WHERE potkom > 100;
UPDATE asesmen_talenta SET potkom = 0   WHERE potkom < 0;

-- ---------------------------------------------------------------------
-- 4. Rubrik "Lama Jabatan": tutup lubang rentang & isi ambang
--
-- KERANGKA §B.2.4.a menulis: ">=5 tahun -> 100", "3 s.d. 4 tahun -> 80",
-- "kurang dari 2 tahun -> 60". Rentang (4,5) dan [2,3) TIDAK terdefinisi --
-- dan ada kasus nyatanya (pegawai dengan 4,1 tahun masa jabatan).
--
-- Keputusan (phase.md §2.8a): lebarkan band tengah menjadi >=2 - <5.
-- Dengan begitu KEDUA pernyataan literal doc tetap benar ("5 ke atas"=100,
-- "kurang dari 2"=60); hanya celah di antaranya yang diisi.
--
-- Selain itu ambang_min/ambang_max diisi -- sebelumnya NULL semua, sehingga
-- angka lama jabatan (mis. 4,1 tahun) tidak punya cara dicocokkan ke
-- kategori mana pun.
-- ---------------------------------------------------------------------

UPDATE rubrik_kategori_skor s
JOIN rubrik_indikator i ON i.id = s.rubrik_indikator_id
SET s.nama_kategori = 'Memiliki masa kerja dalam jenjang jabatan 5 tahun ke atas',
    s.ambang_min = 5,
    s.ambang_max = NULL
WHERE i.nama_indikator = 'Lama Jabatan' AND s.nilai_skor = 100;

UPDATE rubrik_kategori_skor s
JOIN rubrik_indikator i ON i.id = s.rubrik_indikator_id
SET s.nama_kategori = 'Memiliki masa kerja dalam jenjang jabatan 2 sampai kurang dari 5 tahun',
    s.ambang_min = 2,
    s.ambang_max = 5
WHERE i.nama_indikator = 'Lama Jabatan' AND s.nilai_skor = 80;

UPDATE rubrik_kategori_skor s
JOIN rubrik_indikator i ON i.id = s.rubrik_indikator_id
SET s.nama_kategori = 'Memiliki masa kerja dalam jenjang jabatan kurang dari 2 tahun',
    s.ambang_min = NULL,
    s.ambang_max = 2
WHERE i.nama_indikator = 'Lama Jabatan' AND s.nilai_skor = 60;

-- ---------------------------------------------------------------------
-- 5. Satuan kebutuhan data indikator Lama Jabatan dibuat eksplisit
--
-- Supaya jelas bagi pembaca berikutnya bahwa nilai mentah indikator ini
-- adalah JUMLAH TAHUN, bukan skor.
-- ---------------------------------------------------------------------

UPDATE rubrik_indikator
SET kebutuhan_data = 'Akumulasi masa kerja pada jenjang jabatan yang sama (satuan: tahun, desimal). Sumber: riwayat_jabatan bertanggal; fallback pegawai.tmt_jabatan.'
WHERE nama_indikator = 'Lama Jabatan';
