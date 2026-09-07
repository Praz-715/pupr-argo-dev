-- 028 — Kepala BJKW: "Kepala Balai Jasa Konstruksi" → "… Wilayah".
--
-- Permintaan pemilik proses 31 Agu 2026: *"kasih wilayah … Kepala Balai Jasa
-- Konstruksi jadi Kepala Balai Jasa Konstruksi Wilayah"*.
--
-- Menyusul `doc/sql/027` yang menggenerikkan ketujuh nama itu. Yang kurang di sana:
-- kata **Wilayah** bukan keterangan tempat, ia bagian dari nama badannya — BJKW =
-- Balai Jasa Konstruksi **Wilayah**, dan ketujuh unitnya memang bernama "Balai Jasa
-- Konstruksi Wilayah <romawi> <kota>". Jadi gelar kepalanya "Kepala Balai Jasa
-- Konstruksi Wilayah", dan yang dibuang hanya bagian "<romawi> <kota>"-nya.
--
-- Pembedanya tetap `unit_organisasi_id`, sama seperti 34 kepala BP2JK yang juga
-- berbagi satu nama.
--
-- ## Satu aturan kode ikut diperketat, dan itu WAJIB bersama berkas ini
--
-- `jenisJabatan()` di `lib/jenis-jabatan.ts` membuang ekor `/\s+Wilayah\b.*$/` —
-- sehingga nama baru ini akan terpangkas kembali jadi "Kepala Balai Jasa Konstruksi",
-- dan daftar "Tambah jabatan" akan memberi label kelompok yang **tidak sama dengan
-- nama jabatan di dalamnya**. Polanya sekarang `/\s+Wilayah\s+\S.*$/`: "Wilayah"
-- hanya dianggap keterangan tempat kalau ADA yang mengikutinya.
--
-- Terjaga uji `lib/jenis-jabatan.test.ts` ("Wilayah tanpa nama daerah TIDAK
-- dipangkas"), beserta kontrol sebaliknya — "…Wilayah VI Makassar" tetap dipangkas,
-- supaya pelonggaran ini tidak diam-diam mematikan pengelompokan 63 kursi BP2JK.
--
-- ## Yang tidak berubah
--
-- Hanya `nama_jabatan`. `kode_jabatan` & `unit_organisasi_id` tetap; dependen
-- (`pegawai`, `jabatan_target_anggota`, `riwayat_jabatan`) menunjuk `id` jadi tidak
-- tersentuh — terukur 6 penghuni · 4 keanggotaan target · 2 riwayat, sama sebelum
-- dan sesudah. Alias acuan di `scripts/rapikan-jabatan-alias.ts` ikut diarahkan ke
-- nama baru supaya kesesuaian tetap 123/123.
--
-- Idempoten: `WHERE` mencocokkan nama LAMA persis, jadi jalan kedua 0 baris.

UPDATE jabatan j
  JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
   SET j.nama_jabatan = 'Kepala Balai Jasa Konstruksi Wilayah'
 WHERE u.nama_unit LIKE 'Balai Jasa Konstruksi Wilayah %'
   AND j.eselon = 'III'
   AND j.status_jabatan <> 'DIHAPUS'
   AND j.nama_jabatan = 'Kepala Balai Jasa Konstruksi';
