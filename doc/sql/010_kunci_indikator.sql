-- 010_kunci_indikator.sql — dijalankan setelah 009
--
-- KENAPA BERKAS INI ADA
--
-- Dua celah yang baru terlihat begitu rubrik menjadi BISA DIEDIT (Fase 5).
--
-- 1. `rubrik_indikator.kunci_sistem`
--
--    Sampai Fase 4, jembatan "data pegawai → indikator mana" bekerja dengan
--    MENCOCOKKAN NAMA: scripts/recompute.ts mencari indikator bernama persis
--    'Lama Jabatan', 'Kesesuaian Bidang Ilmu', dan seterusnya, lalu MELEMPAR
--    kalau tidak ketemu. Itu aman selama rubrik hanya lahir dari seed.
--
--    Begitu editor rubrik ada, nama indikator jadi milik pengguna. Mengganti
--    'Lama Jabatan' menjadi 'Masa Kerja dalam Jenjang' — perubahan yang sangat
--    wajar — akan membuat seluruh perhitungan match score GAGAL, dan pesan
--    galatnya menunjuk nama indikator, bukan penyebabnya. Sebaliknya, indikator
--    baru buatan pengguna tidak punya sumber data otomatis sama sekali, dan
--    tidak ada cara membedakannya dari indikator yang seharusnya terisi mesin.
--
--    `kunci_sistem` memisahkan LABEL (milik pengguna, bebas diubah) dari
--    PENGENAL SUMBER DATA (milik sistem, dipilih dari daftar tertutup).
--    NULL berarti "tidak ada sumber otomatis" → nilainya diisi manusia dan
--    ditandai MANUAL di match_score_detail (phase.md §8 usulan U-3).
--
--    Dipakai ENUM, bukan VARCHAR: kunci yang salah tulis akan diperlakukan
--    sebagai "tanpa sumber otomatis" — indikatornya diam-diam berubah jadi
--    input manual dan skornya tetap keluar. Salah ketik yang tidak menimbulkan
--    galat adalah salah ketik yang tidak akan pernah ketemu.
--
-- 2. `match_score` UNIQUE (pegawai_id, jabatan_target_id)
--
--    ERD.md §Kamus menggambarkan `match_score ||--o| talent_pool` — paling
--    banyak satu skor per pasangan pegawai × jabatan target, dan
--    `talent_pool.match_score_id` menunjuk satu baris. Tapi kuncinya tidak
--    pernah dipasang: yang ada hanya index biasa. Selama pengisian dilakukan
--    007_recompute yang menghapus seluruh tabel lebih dulu, duplikat tidak
--    mungkin muncul. Tombol "Hitung Ulang" di Fase 5 mengubah itu — ia
--    memperbarui satu jabatan target saja, dan tanpa kunci unik, jalur
--    "sudah ada → perbarui" tidak bisa dijamin oleh database. Duplikatnya pun
--    tidak akan terlihat: halaman menampilkan salah satunya, dan
--    `talent_pool.match_score_id` menunjuk entah yang mana.

ALTER TABLE rubrik_indikator
  ADD COLUMN kunci_sistem ENUM(
    'PREDIKAT_KINERJA',
    'POTKOM',
    'TINGKAT_PENDIDIKAN',
    'KESESUAIAN_BIDANG_ILMU',
    'PENGEMBANGAN_KOMPETENSI',
    'LAMA_JABATAN',
    'KERAGAMAN_JABATAN',
    'SUBSTANSI_JABATAN',
    'INTEGRITAS'
  ) NULL
    COMMENT 'Pengenal sumber data otomatis (lib/penilaian.ts). NULL = tidak ada sumber otomatis, nilainya diisi manusia dan ditandai MANUAL. Bukan label — label ada di nama_indikator dan bebas diubah pengguna.'
    AFTER nama_indikator;

CREATE INDEX idx_ri_kunci ON rubrik_indikator (kunci_sistem);

-- Backfill menurut nama indikator yang berlaku SAAT INI (satu-satunya jembatan
-- yang tersedia sebelum kolom ini ada). Setelah ini, namanya bebas berubah.
-- 'Nilai Pengalaman Jabatan' sengaja dibiarkan NULL: ia node agregator murni
-- yang nilainya rata-rata sub-indikatornya, bukan diambil dari data pegawai.
UPDATE rubrik_indikator SET kunci_sistem = 'PREDIKAT_KINERJA'        WHERE nama_indikator = 'Penilaian Kinerja';
UPDATE rubrik_indikator SET kunci_sistem = 'POTKOM'                  WHERE nama_indikator = 'Penilaian Potensi dan Kompetensi';
UPDATE rubrik_indikator SET kunci_sistem = 'TINGKAT_PENDIDIKAN'      WHERE nama_indikator = 'Tingkat Pendidikan Formal';
UPDATE rubrik_indikator SET kunci_sistem = 'KESESUAIAN_BIDANG_ILMU'  WHERE nama_indikator = 'Kesesuaian Bidang Ilmu';
UPDATE rubrik_indikator SET kunci_sistem = 'PENGEMBANGAN_KOMPETENSI' WHERE nama_indikator = 'Pengembangan Kompetensi';
UPDATE rubrik_indikator SET kunci_sistem = 'LAMA_JABATAN'            WHERE nama_indikator = 'Lama Jabatan';
UPDATE rubrik_indikator SET kunci_sistem = 'KERAGAMAN_JABATAN'       WHERE nama_indikator = 'Keragaman Riwayat Jabatan';
UPDATE rubrik_indikator SET kunci_sistem = 'SUBSTANSI_JABATAN'       WHERE nama_indikator = 'Substansi Riwayat Jabatan';
UPDATE rubrik_indikator SET kunci_sistem = 'INTEGRITAS'              WHERE nama_indikator = 'Verifikasi Rekam Jejak Disiplin';

ALTER TABLE match_score
  ADD UNIQUE KEY uk_match_score_pegawai_target (pegawai_id, jabatan_target_id);

-- Pemeriksaan.
-- 1. Setiap indikator DAUN (tanpa anak) pada rubrik yang ada harus punya kunci;
--    kalau ada yang NULL, ia akan jatuh ke input manual — sah, tapi harus
--    disengaja, bukan akibat backfill yang tidak kena.
SELECT i.id, i.nama_indikator
FROM rubrik_indikator i
WHERE i.kunci_sistem IS NULL
  AND NOT EXISTS (SELECT 1 FROM rubrik_indikator a WHERE a.parent_indikator_id = i.id);

-- 2. Node agregator justru HARUS tanpa kunci.
SELECT i.id, i.nama_indikator
FROM rubrik_indikator i
WHERE i.kunci_sistem IS NOT NULL
  AND EXISTS (SELECT 1 FROM rubrik_indikator a WHERE a.parent_indikator_id = i.id);

-- 3. Sebaran kunci — harus 3 baris per kunci milik jabatan target (3 target)
--    + 1 baris untuk kunci milik rubrik generik.
SELECT kunci_sistem, COUNT(*) AS jumlah
FROM rubrik_indikator
GROUP BY kunci_sistem
ORDER BY kunci_sistem;
