# Data DTM — Hasil Konversi & Normalisasi

Sumber: `Data DTM.xlsx` (9 sheet, 1 sheet = 1 pegawai, format vertikal key-value hasil tempel dari **e-Nominasi** dan **e-Hrm**).

Alur konversi: **xlsx → `Data DTM.json`** (representasi 1:1 per pegawai, termasuk field berulang seperti riwayat jabatan/diklat/pendidikan sebagai array) **→ 5 CSV ternormalisasi** (siap jadi tabel MySQL).

## Skema Tabel (CSV)

| File | Grain (1 baris = ...) | Kolom |
|---|---|---|
| `dtm_pegawai.csv` | 1 pegawai (PK: `nip`) | nip, nama, golongan, tmt_golongan_pangkat, unit_organisasi, unit_kerja, eselon, jabatan_saat_ini, jenjang, tmt_jabatan, sekolah, bidang_studi, tingkat_pendidikan, riwayat_diklat (JSON) |
| `dtm_asesmen_talenta.csv` | 1 pegawai × 1 tahun asesmen (FK: `nip`) | nip, tahun_asesmen, jenis_asesmen, status_asesmen, potkom, nilai_integritas, tahun_kinerja, rating_kinerja, kotak_9 |
| `dtm_riwayat_jabatan.csv` | 1 baris riwayat jabatan (FK: `nip`) | nip, urutan, nama_jabatan |
| `dtm_riwayat_pendidikan.csv` | 1 baris riwayat pendidikan (FK: `nip`) | nip, urutan, riwayat_pendidikan |

Relasi: `dtm_pegawai.nip` adalah PK; ketiga tabel lain punya FK `nip` ke `dtm_pegawai` (relasi 1-ke-banyak). `nip + urutan` bisa jadi composite key pada 2 tabel riwayat.

Riwayat diklat/sertifikasi **tidak** dipisah jadi tabel/CSV sendiri — datanya cuma daftar nama diklat tanpa kolom relasional yang benar-benar berguna (lokasi, TMT, arsip mayoritas kosong di data contoh), jadi disimpan langsung sebagai array JSON di kolom `dtm_pegawai.csv:riwayat_diklat`, persis seperti struktur `Data DTM.json` per pegawai (lihat juga [`ERD.md`](ERD.md) §1 poin 6).

Kolom numerik (`potkom`, `nilai_integritas`) sudah dinormalisasi ke format desimal titik (`.`) — sumbernya campur koma/titik (`101,25` vs `93.47`). Kolom tanggal (`tmt_golongan_pangkat`, `tmt_jabatan`) **belum** diparse jadi tipe DATE karena formatnya tidak konsisten antar baris (lihat catatan di bawah) — perlu tahap cleaning terpisah sebelum masuk kolom `DATE` di MySQL.

## Catatan Kualitas Data (dari data contoh ini)

- **Format tanggal TMT tidak konsisten**: campur `"01 April 2024/ Pembina Tk.I"` (tanggal panjang Indonesia + pangkat digabung), `"1-Apr-23"` (short date, tanpa pangkat), dan `"01 Agustus 2025"` (tanggal saja). Perlu normalisasi ke satu format sebelum jadi kolom `DATE`.
- **Irwan** — kolom `Unit Kerja` di source berisi teks yang polanya seperti jabatan ("Kepala Seksi Pemantauan dan Evaluasi, Subdirektorat..."), bukan nama unit kerja singkat seperti pegawai lain. Kemungkinan salah tempel dari daftar riwayat jabatan saat input data — perlu diverifikasi ke sumber aslinya (e-Hrm), bukan diperbaiki otomatis di sini.
- **Irwan** — `Sekolah` dan `Bidang Studi/Jurusan` bernilai sama persis (`"UNIV OF ROORKEE BID WATER RESOURCES"`), kemungkinan jurusan belum diisi terpisah.
- **Tasya** — `tmt_golongan_pangkat` mengandung typo penggabungan (`"...PembinaI/ IV.a"`, seharusnya "Pembina I/ IV.a").
- **Format Golongan tidak konsisten**: sebagian pakai titik (`IV.b`, `IV.a`), sebagian pakai garis miring (`III/d`, `III/b`) — perlu diseragamkan.
- **Nilai Integritas** ternyata bukan selalu integer (Yatno = `3.5`) — gunakan tipe `DECIMAL`, bukan `INT`, di MySQL.
- `status_asesmen` mayoritas kosong, kecuali `Expired` pada 2 baris (Mardi, Tasya) — nilai kategorikal, cocok jadi `ENUM` atau tetap `VARCHAR` kalau nilainya bisa bertambah.

## Referensi Silang

Struktur `dtm_asesmen_talenta` (potkom, nilai_integritas, rating_kinerja, kotak_9) adalah hasil akhir dari rubrik penilaian pada [`KERANGKA TALENT POOL.md`](KERANGKA%20TALENT%20POOL.md) — file ini adalah **contoh data mentah** (9 pegawai) yang jadi input untuk rubrik tersebut.
