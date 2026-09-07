-- 021 — Lama tiap jabatan sebagai DURASI, untuk riwayat yang tidak bertanggal.
--
-- Permintaan pemilik proses 25 Agu 2026: *"pegawai eselon 2 dan 3 lama jabatannya
-- ambil data dari sini soalnya blm masuk ke aplikasi"* — merujuk
-- `DATA TALENT POOL ES 2 & 3 LENGKAP.xlsx`, kolom **MASA KERJA JABATAN PENEMPATAN**.
--
-- ## Apa yang sebenarnya kurang
--
-- Terukur di `pupr_dev_v2`: 26 pegawai berjabatan eselon II & III punya **229 baris
-- riwayat jabatan, dan NOL di antaranya bertanggal** — berkas sumbernya memang tidak
-- memuat tanggal, hanya lamanya sebagai teks ("2 Tahun 7 Bulan").
--
-- Akibatnya: `nilaiLamaJabatan()` tidak menemukan riwayat bertanggal, jatuh ke
-- `tmt_jabatan` (yang hanya mewakili jabatan TERAKHIR), dan ke-26 pegawai itu
-- seluruhnya mendapat kategori terendah — "masa kerja dalam jenjang jabatan kurang
-- dari 2 tahun", skor 60.
--
-- **Hasil sesudah kolom ini diisi (229 baris): 5 dari 26 naik** — 2 ke 100, 3 ke 80;
-- 21 tetap 60. Angka itu ditulis di sini supaya tidak ada yang mengharapkan
-- pergeseran besar: sumbernya sendiri menyebut ±1 tahun di kursi sekarang untuk
-- sebagian besar mereka, dan durasi belasan tahunnya ada di baris riwayat LAMA. Yang
-- diperbaiki kolom ini **dasar** angkanya, bukan besarnya: 60 yang berarti "tidak ada
-- datanya" kini berarti "sumbernya memang menyebut kurang dari 2 tahun".
--
-- ## Kenapa DURASI, bukan tanggal yang diturunkan
--
-- Menurunkan `tanggal_mulai` dari "2 Tahun 7 Bulan" berarti menuliskan tanggal yang
-- tidak ada di sumber mana pun, dan begitu tersimpan **tidak ada lagi yang bisa
-- membedakannya dari tanggal sungguhan** — termasuk halaman Validasi Riwayat yang
-- tugasnya justru menandai apa yang belum terverifikasi. Durasi adalah tepat apa yang
-- sumbernya berikan.
--
-- Satuannya BULAN, bukan tahun desimal: sumbernya memberi tahun+bulan bulat, dan
-- menyimpannya sebagai `2.58` tahun berarti membuang informasi lalu mengembalikannya
-- dengan pembulatan yang tidak pernah sama.
--
-- ## Yang TIDAK berubah
--
-- Riwayat yang **bertanggal** tetap dihitung dari tanggalnya — itu lebih presisi, dan
-- untuk berkas Pengawas selisih tanggalnya sudah diverifikasi terhadap kolom durasi
-- (cocok 386/386, lihat CLAUDE.md). Kolom ini hanya dipakai ketika tanggalnya tidak
-- ada, dan urutan itu ditegakkan di `lib/penilaian.ts`, bukan di sini.
--
-- Idempoten: penambahan kolom dijaga pemeriksaan `information_schema`.

SET @ada := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'riwayat_jabatan'
       AND COLUMN_NAME = 'lama_bulan'
);
SET @sql := IF(
    @ada = 0,
    'ALTER TABLE riwayat_jabatan
       ADD COLUMN lama_bulan SMALLINT UNSIGNED NULL
       COMMENT ''Lama menjabat dalam BULAN, dari kolom MASA KERJA JABATAN PENEMPATAN. Dipakai hanya bila tanggal_mulai NULL. NULL = tidak diketahui, bukan nol.''
       AFTER tanggal_akhir',
    'SELECT ''kolom lama_bulan sudah ada'''
);
PREPARE j FROM @sql;
EXECUTE j;
DEALLOCATE PREPARE j;
