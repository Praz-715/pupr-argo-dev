-- 026 — Buang 7 "Kepala Balai" BJKW bernama-acuan yang kacau; sisakan yang benar.
--
-- Dilaporkan pemilik proses 31 Agu 2026 lewat tangkapan layar BJKW Wilayah VI
-- Makassar: unit itu memuat DUA kepala balai —
--
--     JAB-STR-010          "Kepala Balai Jasa Konstruksi Pelaksana Pemilihan
--                           Jasa Konstruksi Jasa Konstruksi"        (kosong)
--     JAB-KABALAI-BJKW-MKS "Kepala Balai Jasa Konstruksi Wilayah VI Makassar" (terisi)
--
-- Berlaku untuk **ketujuh** unit BJKW, bukan hanya Makassar.
--
-- ## Nama mana yang benar — diperiksa, bukan ditebak
--
-- Pemilik proses menduga nama yang benar "Kepala Balai Pelaksana Pemilihan Jasa
-- Konstruksi" dan meminta dicek dulu. **Bukan** — dan sumbernya jelas:
--
--   * Nama itu milik **BP2JK**: di `Nama Jabatan Struktural.xlsx` ia muncul 34 kali,
--     seluruhnya berpasangan dengan unit "Balai Pelaksana Pemilihan Jasa Konstruksi
--     Wilayah …", dan tiap BP2JK punya 2 kursi (kepala + Kasubbag TU).
--   * Nama kacau di atas muncul **7 kali, seluruhnya di unit BJKW** ("Balai Jasa
--     Konstruksi Wilayah I–VII"), dan tiap BJKW punya 3 kursi (kepala + Kasubbag TU
--     + Kasi Pelaksanaan).
--
-- BJKW dan BP2JK dua badan berbeda. Memakai nama BP2JK di BJKW berarti memberi
-- kepala BJKW gelar kepala badan lain. Diverifikasi langsung ke sel mentah berkasnya
-- (baris 37, 40, 43, 46, 49, 52, 55 kolom C) — "Jasa Konstruksi" memang tertulis tiga
-- kali di sumbernya, jadi ini salah ketik pemilik daftar, bukan salah ekstraksi.
--
-- Nama yang BENAR untuk kepala BJKW = "Kepala " + nama unitnya, dan master sudah
-- memakainya. Jadi yang dibuang baris bernama-acuan, yang bertahan baris berpenghuni.
--
-- ## Kesesuaian 123/123 TIDAK turun
--
-- Ketujuh baris inilah yang selama ini memenuhi 7 pasangan acuan tersebut, jadi
-- menghapusnya tanpa persiapan akan menurunkan kesesuaian ke 116/123 — cacat yang
-- tidak menghasilkan galat dan baru ketahuan berbulan kemudian.
--
-- Karena itu `scripts/rapikan-jabatan-alias.ts` lebih dulu diberi `kunciPasangan()`:
-- alias berkunci **(nama, unit)**, bukan nama saja. Alias nama-saja memang dulu
-- ditolak dengan alasan yang benar — satu nama acuan menunjuk tujuh balai, jadi
-- memilih salah satunya berarti mengarang. Yang berubah: daftar acuan menyebut
-- unitnya di kolom sebelah, dan per unit pemetaannya satu-ke-satu. Terukur:
-- kesesuaian **123/123 sebelum DAN sesudah** berkas ini.
--
-- ## Penjaganya ada DI DALAM `WHERE`, bukan di kepala operator
--
-- Ketiga `NOT EXISTS` di bawah membuat baris yang ternyata berpenghuni, beranggota
-- jabatan target, atau punya riwayat **tidak akan terhapus** — walau namanya cocok.
-- Terukur saat ditulis: ketujuhnya 0/0/0. Kalau suatu saat tidak lagi, yang terjadi
-- bukan data hilang melainkan barisnya dilewati, dan `scripts/audit-jabatan.ts` akan
-- tetap melaporkannya sebagai "lebih dari satu kepala di satu unit".
--
-- Idempoten: jalan kedua tidak menemukan apa pun yang cocok.

DELETE j FROM jabatan j
  JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
 WHERE j.nama_jabatan = 'Kepala Balai Jasa Konstruksi Pelaksana Pemilihan Jasa Konstruksi Jasa Konstruksi'
   AND u.nama_unit LIKE 'Balai Jasa Konstruksi Wilayah %'
   AND NOT EXISTS (SELECT 1 FROM pegawai p WHERE p.jabatan_id = j.id)
   AND NOT EXISTS (SELECT 1 FROM jabatan_target_anggota a WHERE a.jabatan_id = j.id)
   AND NOT EXISTS (SELECT 1 FROM riwayat_jabatan r WHERE r.jabatan_id = j.id)
   -- Hanya kalau unit itu MASIH punya kepala lain; jangan sampai balai kehilangan
   -- kursi kepalanya karena baris penggantinya ternyata belum ada.
   AND EXISTS (
     SELECT 1 FROM (SELECT * FROM jabatan) lain
      WHERE lain.unit_organisasi_id = j.unit_organisasi_id
        AND lain.id <> j.id
        AND lain.eselon = 'III'
        AND lain.status_jabatan <> 'DIHAPUS'
        AND lain.nama_jabatan LIKE 'Kepala Balai Jasa Konstruksi Wilayah %'
   );
