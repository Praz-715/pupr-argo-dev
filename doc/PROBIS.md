# Proses Bisnis — Manajemen Talenta DJBK (SIMT DJBK)

Dokumen ini menjelaskan **proses bisnisnya**: siapa aktornya, tahap apa saja yang dilalui sebuah keputusan suksesi, apa yang menjadi masukan & keluaran tiap tahap, dan kendali apa yang menjaganya. Untuk urutan klik langkah demi langkah, lihat [`PANDUAN-PENGGUNA.md`](PANDUAN-PENGGUNA.md).

> **Yang membedakan dokumen ini dari `ALUR.md`.** `doc/ALUR.md` **dihasilkan program** dari `lib/peran.ts`, `lib/workflow.ts`, dan `lib/navigasi.ts` — ia peta teknis yang selalu sinkron dengan kode. Dokumen ini ditulis tangan dan menjelaskan **kenapa** prosesnya begitu, termasuk hal-hal yang tidak ada di kode: keputusan yang masih terbuka, batas kewenangan, dan risiko tiap tahap.
>
> Setiap angka & nama aksi di sini diambil dari kode pada **12 Agustus 2026**. Kalau kode berubah, dokumen ini ikut diubah — bukan dibiarkan menua.

---

## 1. Aktor & kewenangan

Lima peran, dan pembagiannya bukan soal "level akses" melainkan **pekerjaan yang berbeda**.

| Peran | Pekerjaan intinya | Yang HANYA bisa dia lakukan |
|---|---|---|
| **Super Admin** | menjaga sistem & master data | manajemen pengguna, pengaturan sistem, unit organisasi, klien & token API |
| **Admin Talenta** | menyusun formulasi & memverifikasi | susun jabatan target + rubrik, jalankan perhitungan, isi nilai manual, verifikasi nominasi |
| **Pengelola Unit** | mengajukan & merawat data unitnya | ajukan nominasi, kurasi data pegawai & validasi riwayat — **dibatasi unitnya sendiri**. Ia TIDAK bisa menambah kandidat baru ke talent pool; panel "Kandidat lolos syarat di luar pool" hanya untuk Admin Talenta & Super Admin |
| **Pimpinan** | memutuskan | tetapkan suksesor |
| **Viewer** | membaca | tidak ada aksi tulis |

Dua hal yang mudah salah dipahami:

- **Pengelola Unit tidak bisa memverifikasi nominasinya sendiri.** Yang mengajukan dan yang memverifikasi wajib orang berbeda — itu inti kendali proses ini, bukan pembatasan teknis.
- **Pembatasan unit gagal TERTUTUP.** Pengelola Unit yang belum punya unit tidak melihat apa-apa, bukan melihat semua.

---

## 2. Peta proses

```
      ┌────────────────────────── A. SETUP FORMULASI (Admin Talenta) ──────────────────────────┐
      │  Jabatan target (DRAFT) → jabatan anggota → persyaratan → rubrik → GERBANG → AKTIF     │
      └───────────────────────────────────────────┬───────────────────────────────────────────┘
                                                  │ rubrik siap dipakai menilai
      ┌────────────────────── B. PENYIAPAN DATA PEGAWAI (Admin Talenta / Pengelola Unit) ──────┐
      │  sinkron eNominasi · isi manual · validasi riwayat diklat & jabatan · bereskan temuan  │
      └───────────────────────────────────────────┬───────────────────────────────────────────┘
                                                  │ profil layak dinilai
      ┌────────────────────────── C. PERHITUNGAN (Admin Talenta) ─────────────────────────────┐
      │  Hitung Ulang → match_score + rincian per indikator + peringkat + kelayakan            │
      └───────────────────────────────────────────┬───────────────────────────────────────────┘
                                                  │ skor & Kotak 9 keluar
      ┌────────────────────────── D. SUKSESI (Unit → Admin Talenta → Pimpinan) ────────────────┐
      │  Ajukan → Verifikasi → Approval → Ditetapkan   (atau: Minta revisi / Tolak)            │
      └───────────────────────────────────────────┬───────────────────────────────────────────┘
                                                  │
                              E. RENCANA PENGEMBANGAN + LAPORAN & EKSPOR
```

---

## 3. Tahap A — Setup formulasi

**Tujuan:** menyatakan *bagaimana* seorang kandidat dinilai untuk satu jabatan sasaran, sebelum ada satu pun nama yang dinilai.

**Aktor:** Admin Talenta (dan Super Admin).

### Struktur formulasinya

Jabatan target punya tiga isi, masing-masing satu tab di editornya:

1. **Jabatan Anggota** — posisi konkret mana saja yang diwakili jabatan target ini. Satu jabatan target bisa mewakili beberapa posisi sejenis (mis. "Kepala Balai BP2JK / Kepala Subdirektorat Direktorat Pengadaan").
2. **Persyaratan** — syarat minimal: bidang ilmu, pendidikan minimal, pelatihan, pengalaman. **Satu tempat untuk seluruh syarat**, supaya gerbang kelayakan dan indikator rubrik tidak menyimpan dua daftar yang berbeda.
3. **Rubrik Penilaian** — Komponen → Indikator → Kategori Skor, berbobot, mereplikasi [`KERANGKA TALENT POOL.md`](KERANGKA%20TALENT%20POOL.md).

### Rumusnya

| Sumbu | Susunan | Bobot |
|---|---|---|
| **Y — Nilai Kinerja** | Kinerja Utama → Penilaian Kinerja | 100% |
| **X — Nilai Potensial** | Potensi & Kompetensi | 65% |
| | Kualifikasi Jabatan (pendidikan · bidang ilmu · pengembangan kompetensi · pengalaman jabatan) | 20% |
| | Integritas & Moralitas | 15% |

**Nilai Talenta = 50% Y + 50% X** (Formula A). **Match score = 65/20/15** dari ketiga komponen sumbu X (Formula B) — **match score TIDAK memuat unsur kinerja**, karena itu ia selalu dibaca berdampingan dengan Kotak 9.

**Klasifikasi Kotak 9** memakai ambang **≥80** (teratas) dan **≥60** (tengah) pada kedua sumbu. Sejak 18 Agu 2026 keduanya **parameter sistem** (`ambang_sumbu_atas` / `ambang_sumbu_tengah`), bisa diubah Super Admin di Admin › Pengaturan Sistem tanpa rilis. Yang perlu diingat: mengubahnya **tidak** menulis ulang kotak yang sudah tersimpan — tampilan per jabatan target ikut seketika, sebaran organisasi baru menyusul setelah Hitung Ulang.

### Gerbang aktivasi — kendali terpenting di tahap ini

Jabatan target **selalu lahir sebagai DRAFT** dan tidak bisa diaktifkan sebelum dua hal terpenuhi:

1. **Minimal satu jabatan anggota.** Tanpa itu, jabatan target tidak menunjuk posisi mana pun.
2. **Rubrik tanpa galat.** Validator memeriksa bobot, ambang berlubang/tumpang tindih/terbalik, dan kategori yang tidak menutup rentang 0–100.

**Kenapa gerbangnya perlu:** mesin rubrik **sengaja tidak pernah melempar** — itu benar untuk perhitungan massal, tapi berarti rubrik cacat tetap menghasilkan angka yang tampak wajar. Angka wajar dari rubrik salah adalah kegagalan yang paling sulit ditemukan, karena tidak ada yang terlihat rusak.

**Keluaran tahap A:** jabatan target berstatus AKTIF dengan rubrik yang bisa dipertanggungjawabkan.

---

## 4. Tahap B — Penyiapan data pegawai

**Tujuan:** memastikan profil yang akan dinilai cukup lengkap, sebab indikator yang datanya tidak ada **tidak menghasilkan nol** — ia menghasilkan "tidak diketahui", dan itu berbeda.

**Aktor:** Admin Talenta; Pengelola Unit untuk pegawai di unitnya.

### Sumber data

| Sumber | Keadaan | Isi |
|---|---|---|
| **eNominasi** (`karir.pu.go.id/enom`) | ✅ tersambung | hasil asesmen, potkom, integritas, predikat kinerja, Kotak 9 sumber |
| **Manual** | ✅ tersambung | diisi manusia lewat aplikasi |
| **eHRM** | ⬜ belum ada klien | data biografis & riwayat pegawai |
| **eKinerja** | ⬜ belum ada klien | rekap kinerja triwulan |

⚠️ **Riwayat sinkronisasi eHRM & eKinerja di halaman Konsolidasi adalah data contoh**, bukan sinkronisasi yang pernah berjalan. Halaman itu menandainya "Belum tersambung".

### Empat permukaan penyiapan data

1. **Kelengkapan Data** — skor kelengkapan per pegawai & per unit, butir mana yang paling mendesak (diurutkan menurut bobot × jumlah pegawai, bukan menurut persentase).
2. **Antrian Pembersihan** — temuan konkret: NIP tidak valid, riwayat belum terstruktur, pendidikan tidak terurai, tanggal kosong, Kotak 9 sumber ≠ hasil hitung.
3. **Validasi Riwayat** — memetakan nama diklat ke kategori kamus, dan menetapkan jenis penugasan (Definitif/Plt/Plh) pada riwayat jabatan. **Ini yang membuat riwayat ikut dihitung**: sejak peralihan skoring, indikator Pengembangan Kompetensi & Substansi Riwayat Jabatan membaca **kategori hasil validasi**, bukan teks nama diklat.
4. **Profil pegawai** — pengisian & perbaikan manual per pegawai: identitas, riwayat pendidikan, riwayat jabatan, diklat, kinerja, asesmen.

### Kendali

- **Semua mutasi lewat satu pintu** (`jalankanMutasi`) yang memeriksa peran → membaca keadaan sebelum → menulis → mencatat `audit_log`. Tidak ada jalur tulis tanpa jejak.
- **Tambah & ubah, tanpa hapus.** Baris riwayat adalah dasar skor yang sudah tersimpan; menghilangkannya membuat skor lama tidak bisa dipertanggungjawabkan.
- **NIP tidak bisa diubah dari profil.** Ia identitas baris, alamat halaman, dan satu-satunya sumber tanggal lahir, usia, masa kerja, dan proyeksi pensiun.

---

## 5. Tahap C — Perhitungan

**Tujuan:** menerjemahkan profil + rubrik menjadi angka yang bisa dijelaskan sampai ke indikator.

**Aktor:** Admin Talenta.

**Pemicunya sadar, bukan otomatis.** Perhitungan berjalan ketika seseorang menekan **Hitung Ulang** pada satu jabatan target — bukan setiap kali data berubah. Alasannya: perhitungan menggeser peringkat dan kelayakan seluruh kandidat, jadi ia keputusan, bukan efek samping.

### Keluarannya

- `match_score` — skor per komponen + skor total + kelayakan, satu baris per (pegawai × jabatan target)
- `match_score_detail` — **rincian per indikator**: nilai mentah, kategori terpilih, skor, sumber nilai (OTOMATIS/MANUAL), penanda perlu ditinjau
- peringkat di `talent_pool`
- `rubrik_snapshot` — salinan aturan yang dipakai saat itu

### Nilai manual per indikator

Indikator yang datanya belum ada bisa dinilai manusia dengan **memilih kategori dari rubrik** — bukan mengetik angka. Yang wajib menyertainya: **alasan & bukti**, tersimpan bersama nama pengisinya. Nilai manual **dipertahankan** saat Hitung Ulang berikutnya.

**Kenapa alasan diwajibkan:** nilai manual adalah satu-satunya tempat penilaian menjadi subjektif. Tanpa alasan tertulis, angkanya tidak bisa dipertanggungjawabkan ketika keputusan suksesinya dipersoalkan.

### Kelayakan dipisah dari skor

Gerbang kelayakan (syarat minimal) **terpisah** dari skor. Kandidat bisa berskor tinggi tapi tidak lolos syarat — dan itu keadaan yang sah, bukan kekeliruan. Halaman kandidat menampilkan keduanya.

---

## 6. Tahap D — Suksesi

**Tujuan:** memindahkan kandidat dari "berskor" menjadi "ditetapkan", dengan jejak siapa memutuskan apa.

### Lima tahap yang saling meniadakan

| Tahap | Yang harus bertindak | Aksi yang tersedia |
|---|---|---|
| **Dikembalikan untuk revisi** | unit pengaju | *Ajukan ulang setelah revisi* |
| **Menunggu verifikasi kepegawaian** | Admin Talenta | *Setujui verifikasi* · *Minta revisi* · *Tolak nominasi* |
| **Menunggu approval Pimpinan** | Pimpinan | *Tetapkan sebagai suksesor* |
| **Ditetapkan sebagai suksesor** | — selesai | — |
| **Ditolak** | — selesai | — |

Tahap **diturunkan** dari status nominasi + status talent pool, bukan disimpan sebagai kolom sendiri. Karena itu tabel dan penyaring tidak mungkin berselisih.

### Kendali

- **Satu keputusan manusia mengubah tiga hal sekaligus**: status talent pool, status nominasi, dan satu baris `approval_log`. Ketiganya ditulis oleh satu state machine (`lib/workflow.ts`) — kalau ditebar sebagai `if` di komponen, salah satunya akan tertinggal dan keadaan setengah jalan itu tidak menghasilkan galat, hanya halaman yang saling bertentangan.
- **Notifikasi** dikirim ke peran yang giliran berikutnya, diturunkan dari peta giliran yang sama.
- **Tidak ada "tarik nominasi"** oleh unit pengaju. Unit yang salah mengajukan harus meminta Admin Talenta menolaknya; jejaknya tetap utuh lewat jalur penolakan.

---

## 7. Keputusan yang MASIH TERBUKA

Bagian ini sengaja ada di dokumen proses, bukan disembunyikan di catatan teknis — kelimanya **mengubah hasil**, bukan sekadar tampilan.

| # | Keputusan | Keadaan sekarang | Risiko kalau dibiarkan |
|---|---|---|---|
| 1 | **Skala potkom eNominasi** | nilai >100 dipotong ke 100 | terukur: 5 dari 10 rekaman >100 (sampai 130,73). Memotong membuat separuh populasi menumpuk di X=100 dan kehilangan daya bedanya. **Harus dijawab pengelola eNominasi sebelum sinkronisasi produksi** |
| 2 | ~~**Ambang Kotak 9 (80/60)**~~ | **DIPUTUSKAN 18 Agu 2026** | jadi parameter sistem. Jawaban atas "apakah skor lama ikut bergeser": **tidak otomatis** — kotak yang tersimpan tetap memakai ambang saat ia dihitung, sampai Hitung Ulang dijalankan. Itu dipilih supaya angka yang sudah dipakai dalam keputusan tidak berubah di belakang punggung orang; harganya, dua halaman bisa berselisih sampai perhitungan ulang dijalankan, dan UI mengatakannya terus terang |
| 3 | **Sumber Penilaian Kinerja** | label eKinerja, tapi klien-nya belum ada | dokumen sumber saling bertentangan (eKinerja vs karir.pu.go.id/enom) |
| 4 | **Substansi Riwayat Jabatan: 2 atau 5 kategori** | 5 kategori Plt/Plh | dua lembar sumber mengukur hal berbeda, bukan sekadar beda jumlah kategori |
| 5 | **Kandidat tidak lolos syarat masuk peringkat atau tidak** | masuk | dokumen sumber bertentangan dengan dirinya sendiri |

---

## 8. Batas prototipe ini

Supaya tidak ada yang salah menyangka:

- **Tampilan sedang dibatasi ke 10 dari 43 pegawai** (`HANYA_PEGAWAI_SUMBER=true`) — hanya pegawai yang ada di API eNominasi. DB tidak diubah; matikan flag-nya dan 43 kembali.
- **Foto pegawai belum ada** — strategi penyimpanan berkas belum diputuskan, dan foto pegawai adalah data pribadi (UU PDP 27/2022) sehingga aksesnya harus dibatasi peran.
- **Impor struktur organisasi dari Excel belum ada.**
- **Belum ada sesi perhitungan sebagai satu transaksi.** Jejaknya sudah lengkap tapi tersebar: `audit_log` mencatat peristiwa `RECOMPUTE`, `match_score_detail` menyimpan hasilnya. Yang belum ada: satu id yang menyatukan "perhitungan ke-N oleh user X menghasilkan skor ini untuk N pegawai" agar bisa diekspor sebagai satu laporan.
