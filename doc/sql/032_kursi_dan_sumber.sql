-- 032 — Pisahkan "KURSI YANG DITUJU" dari "JABATAN YANG BISA DINOMINASIKAN".
--
-- Permintaan pemilik proses 1 Sep 2026: *"si jabatan anggota itu mending buat pilih
-- jabatan yang bisa dinominasikan aja dah … yang udah ada di jabatan target sekarang
-- lu bikin dah jabatan apa aja yang bisa di nominasiin. Nah kalo yang baru nanti di
-- bikin draft berarti defaultnya kosong, terus keisi kalo dia tambah jabatan atau
-- diisi dari persyaratan."*
--
-- ## Kenapa TIDAK cukup membalik arti `jabatan_target_anggota` begitu saja
--
-- Tabel itu sekarang menjawab "kursi mana yang target ini isi", dan EMPAT hal lain
-- bergantung pada jawaban itu:
--
--   1. gerbang aktivasi — target tanpa kursi tidak menunjuk posisi mana pun;
--   2. panel Jabatan Kosong & Risiko Kekosongan — "kursi ini sudah punya jabatan
--      target atau belum" (`lib/kueri/master.ts`, `lib/kueri/dashboard.ts`);
--   3. kolom Unit Organisasi di daftar jabatan target (1 Sep 2026);
--   4. `cariJabatanUntukTarget()` menurunkan saringan jenjangnya dari eselon kursi itu.
--
-- Dibalik artinya tanpa memindahkan kursinya, keempatnya mulai membaca "jabatan
-- asal kandidat" seolah itu kursi yang dituju — dan tidak satu pun menghasilkan
-- galat. Yang terjadi: Risiko Kekosongan menganggap kursi Kepala Seksi sudah punya
-- target, dan kolom Unit menyebut unit kandidatnya.
--
-- ## Jadi kursinya pindah ke kolomnya sendiri, dan itu memang bentuk yang benar
--
-- Satu jabatan target = satu kursi. Terukur: **14 dari 14 jabatan target punya TEPAT
-- satu anggota**, tidak ada yang nol maupun lebih. Relasi banyak-ke-banyak memang
-- tidak pernah dipakai sebagai banyak-ke-banyak; ia FK tunggal yang kebetulan
-- disimpan di tabel penghubung. Sesudah pindah, `jabatan_target_anggota` bebas
-- dipakai untuk hal yang MEMANG banyak: daftar jabatan asal yang boleh dinominasikan.
--
-- ## `ON DELETE SET NULL`, bukan CASCADE
--
-- Menghapus sebuah jabatan dari master tidak boleh menghapus jabatan targetnya
-- beserta seluruh `match_score`, `talent_pool`, dan rantai nominasi di bawahnya.
-- Yang benar: targetnya kehilangan kursinya dan berhenti bisa diaktifkan — keadaan
-- yang terlihat dan bisa dibetulkan, bukan data yang lenyap.
--
-- Berkas ini HANYA memindahkan kursinya. Isi `jabatan_target_anggota` sengaja belum
-- disentuh: pembacanya diganti lebih dulu di kode, baru isinya diganti lewat
-- `npm run sumber:nominasi`. Mengosongkannya di sini berarti ada jendela waktu saat
-- aplikasi yang sedang berjalan kehilangan kursinya.
--
-- Idempoten: penambahan kolom & FK dijaga `information_schema`, backfill hanya
-- mengisi yang masih NULL.

-- ── 1. Kolom kursi ──────────────────────────────────────────────────────────────
SET @ada := (
    SELECT COUNT(*) FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'jabatan_target'
       AND COLUMN_NAME = 'jabatan_id'
);
SET @sql := IF(
    @ada = 0,
    'ALTER TABLE jabatan_target
       ADD COLUMN jabatan_id BIGINT UNSIGNED NULL
       COMMENT ''Kursi yang DITUJU jabatan target ini. NULL = belum ditentukan; target begitu tidak bisa diaktifkan.''
       AFTER nama_target',
    'SELECT ''kolom jabatan_id sudah ada'''
);
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;

-- ── 2. Backfill dari anggota tunggalnya ─────────────────────────────────────────
--
-- `MIN(jabatan_id)` aman KARENA sudah dibuktikan tiap target beranggota tepat satu.
-- Kalau suatu saat ada yang beranggota lebih, barisnya tetap terisi salah satu —
-- dan itu sebabnya langkah 3 melaporkannya alih-alih membiarkannya lewat diam.
UPDATE jabatan_target t
   SET t.jabatan_id = (
     SELECT MIN(a.jabatan_id) FROM jabatan_target_anggota a WHERE a.jabatan_target_id = t.id
   )
 WHERE t.jabatan_id IS NULL;

-- ── 3. Laporkan yang tidak bisa dipindah bersih ────────────────────────────────
SELECT t.id, t.nama_target, COUNT(*) AS jumlah_anggota
  FROM jabatan_target t
  JOIN jabatan_target_anggota a ON a.jabatan_target_id = t.id
 GROUP BY t.id, t.nama_target
HAVING COUNT(*) > 1;

-- ── 4. FK ──────────────────────────────────────────────────────────────────────
SET @ada := (
    SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'jabatan_target'
       AND CONSTRAINT_NAME = 'fk_jt_jabatan'
);
SET @sql := IF(
    @ada = 0,
    'ALTER TABLE jabatan_target
       ADD CONSTRAINT fk_jt_jabatan FOREIGN KEY (jabatan_id)
       REFERENCES jabatan (id) ON DELETE SET NULL',
    'SELECT ''fk_jt_jabatan sudah terpasang'''
);
PREPARE j FROM @sql; EXECUTE j; DEALLOCATE PREPARE j;
