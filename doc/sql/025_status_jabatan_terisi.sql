-- 025 — `status_jabatan` diselaraskan: KOSONG yang ternyata BERPENGHUNI → TERISI.
--
-- Konsekuensi langsung dari dua pekerjaan 31 Agu 2026, dan harus dibereskan bersama
-- keduanya:
--
--   * **penggabungan jabatan kembar** (`scripts/cari-jabatan-kembar.ts`) — 29 baris
--     `JAB-STR-*` bernama-acuan bertahan dan menerima pegawai dari kembarannya yang
--     dilebur. Sebelum itu mereka memang KOSONG; sesudahnya tidak lagi.
--   * **impor Talent Pool Kabalai & Fungsional** — 5 jabatan master yang sudah ada
--     (`JAB-KABALAI-*` ×3, `JAB-PJK-*`, `JAB-PPBJ-*`) menerima penghuni baru;
--     importir menautkan pegawainya tapi tidak menyentuh kolom status.
--
-- ## Kenapa ini penting, bukan kerapian
--
-- `docblock lib/aksi/jabatan.ts` menyatakan alasannya: kartu KPI **"Jabatan strategis
-- kosong"** dan panel **Risiko Kekosongan** membaca kolom ini, bukan menghitung
-- penghuni. Kolom yang berbohong membuat kedua halaman berbohong — dan bentuknya
-- bukan galat, melainkan angka yang terlihat masuk akal. Terukur sebelum berkas ini:
-- **34 jabatan berstatus KOSONG padahal berpenghuni aktif**, 32 di antaranya eselon
-- III, jadi KPI-nya melebih-lebihkan kekosongan strategis sebanyak itu.
--
-- ## Arahnya SATU saja, dan itu disengaja
--
-- Hanya `KOSONG` → `TERISI` untuk yang benar-benar berpenghuni. Arah sebaliknya
-- (`TERISI` tanpa penghuni) sengaja TIDAK disentuh di sini; itu urusan
-- `npm run rapikan:jabatan -- --selaraskan-status`, dan terukur **0 baris** saat ini.
--
-- CLAUDE.md mencatat bahwa arah KOSONG→TERISI biasanya hanya DILAPORKAN, tidak
-- disetel, sebab "KOSONG tapi ada penghuni" umumnya menandakan **penautan pegawai
-- yang salah** — dan menutupinya dengan mengubah status akan menyembunyikan masalah
-- yang sebenarnya. Di sini kekhawatiran itu tidak berlaku dan bisa dinyatakan
-- sebabnya satu per satu: ke-34 baris itu berpenghuni karena dua tindakan yang
-- disengaja hari ini, bukan karena ada pegawai yang tertaut ke kursi yang bukan
-- miliknya. Penautannya justru yang benar; kolomnya yang tertinggal.
--
-- Idempoten: `WHERE`-nya menyaring keadaan yang mau diperbaiki, jadi jalan kedua
-- menyentuh 0 baris.

UPDATE jabatan j
   SET j.status_jabatan = 'TERISI'
 WHERE j.status_jabatan = 'KOSONG'
   AND EXISTS (
     SELECT 1 FROM pegawai p
      WHERE p.jabatan_id = j.id AND p.status_aktif = 'AKTIF'
   );
