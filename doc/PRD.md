# PRD — Sistem Informasi Manajemen Talenta DJBK

**Codename:** SIMT DJBK (Sistem Informasi Manajemen Talenta) — modul peningkatan fitur *karir.pu.go.id*
**Stack:** Next.js (frontend + backend dalam satu app) + MySQL + API eksternal berbasis token
**Skema data pendukung:** lihat [`ERD.md`](ERD.md)
**Status dokumen:** Sudah diaudit; implementasi berjalan. **Fase 0 sampai 7 selesai** — fondasi & rule engine, data dev, Dashboard Utama, Direktori & Profil Talenta, Peta Talenta & Perbandingan Kandidat, Master Data & Kualitas Data, Rule Engine (Jabatan Target), Talent Pool & Workflow Nominasi, serta Auth & RBAC. Berikutnya Fase 8 (Laporan & Ekspor). Halaman yang sudah dibangun ditandai ✅ di §6; lihat [`../phase.md`](../phase.md) untuk urutan fase, keputusan teknis, dan usulan perbaikan halaman (§8 U-1…U-12).

---

## 1. Ringkasan Eksekutif

DJBK punya data pegawai (eNominasi, eHRM, eKinerja) tapi **belum punya peta talenta** yang bisa langsung menjawab "siapa yang siap mengisi jabatan strategis X, secara cepat dan objektif". [`manajemen talenta 27 juli utk tim SIM.md`](manajemen%20talenta%2027%20juli%20utk%20tim%20SIM.md) menetapkan aksi perubahan untuk membangun Dashboard Talenta Terintegrasi; [`BLUEPRINT READINESS - MODUL MANAJEMEN TALENTA.md`](BLUEPRINT%20READINESS%20-%20MODUL%20MANAJEMEN%20TALENTA.md) memetakan data apa yang sudah siap vs belum, dan modul apa yang perlu dibangun; [`KERANGKA TALENT POOL.md`](KERANGKA%20TALENT%20POOL.md) memberi contoh konkret rubrik penilaian yang harus bisa dikonfigurasi per jabatan target.

PRD ini merancang **produk yang mengeksekusi blueprint tersebut**: aplikasi web (Next.js, full-stack) untuk staf DJBK mengelola data talenta, menjalankan rule engine penilaian, workflow nominasi & persetujuan, sampai laporan — ditambah **API eksternal bertoken** supaya instansi lain (Kementerian, BKN, dsb.) bisa menarik data talenta yang diizinkan.

---

## 2. Tujuan Produk & Metrik Keberhasilan

Diturunkan dari `manajemen talenta...md` §06 (Indikator Keberhasilan) dan `BLUEPRINT READINESS...md` §1:

| Tujuan | Indikator Keberhasilan (target) |
|---|---|
| Konsolidasi data talenta dari berbagai sumber (eHRM, eNominasi, eKinerja) | Data talenta terintegrasi ≥90% (unit Eselon II & III); akurasi & kelengkapan data ≥90% |
| Tampilkan kandidat potensial untuk jabatan target secara objektif | Rekomendasi penempatan/promosi berbasis data ≥80% dari seluruh keputusan |
| Dukung proses nominasi → verifikasi → penetapan talent pool | Talent pool terbentuk sesuai kriteria (100%); workflow nominasi berjalan penuh |
| Sediakan dasar pengembangan talenta & suksesi | Succession planning tersedia untuk 100% jabatan strategis |
| Efisiensi proses kepegawaian | Waktu proses layanan kepegawaian berkurang ≥30%; kepuasan pengguna internal ≥80% |
| Adopsi oleh pimpinan | Penggunaan dashboard oleh pimpinan ≥75% |

---

## 3. Pengguna & Peran (Roles)

Dipetakan dari peta stakeholder & Tim Kerja di `manajemen talenta...md` §07 ke role sistem konkret:

| Role Sistem | Representasi Organisasi | Akses Utama |
|---|---|---|
| **Super Admin** | Tim IT DJBK (Support) | Kelola pengguna & role, master unit/jabatan, konfigurasi sistem, kelola klien & token API, lihat seluruh audit log |
| **Admin Talenta** | Core Team — Pengelola Kepegawaian, Bagian Kepegawaian & Umum (Champion) | Jalankan konsolidasi data, kelola jabatan target & rubrik penilaian, kelola talent pool, verifikasi nominasi, susun rencana pengembangan, generate laporan |
| **Pengelola Unit** | Data Provider — staf kepegawaian di Balai/BP2JK/Direktorat (Unit Eselon II & III) | Input/validasi riwayat data pegawai unitnya, ajukan nominasi kandidat dari unit ("Nominasi Unit") |
| **Pimpinan** | Sponsor & Decision Maker — Dirjen, Sesditjen, Para Direktur | Lihat dashboard, profil talenta, perbandingan kandidat, laporan; setujui/tolak nominasi tahap akhir & rencana suksesi |
| **Viewer** | Pembina kebijakan (Biro Kepegawaian & Ortala, BPSDM Kementerian PU) — opsional | Akses baca terbatas ke dashboard & laporan ringkas, tanpa hak ubah |

Semua role di atas adalah **pengguna internal** (login sesi). Instansi eksternal **tidak** memakai role di atas — mereka mengakses lewat **API token** (lihat §7), bukan login UI.

> **Koreksi audit:** draf sebelumnya memasukkan "Kepala Balai, Kabag" ke role **Pimpinan**. Ini keliru dan sudah diperbaiki — di peta stakeholder `manajemen talenta 27 juli utk tim SIM.md` §07, Kepala Balai/Kasubdit/Kepala Seksi masuk kuadran **Crowd (Keep Informed)**, bukan *Decision Maker*, dan tabel Tim Kerja hanya mencantumkan "Pimpinan DJBK (Dirjen, Sesditjen, Para Direktur)" untuk peran User/Decision Maker. "Kabag" (Kepala Bagian Kepegawaian dan Umum) juga sudah dipetakan sebagai **Champion** ke role **Admin Talenta** di atas — menaruhnya lagi di **Pimpinan** menimbulkan peran ganda yang kontradiktif. Kepala Balai tetap terwakili lewat role **Pengelola Unit** (Data Provider) sesuai kapasitasnya di level unit.

---

## 4. Lingkup & Arsitektur Tingkat Tinggi

### 4.1 Dalam Lingkup
- Aplikasi web internal (dashboard, manajemen data, rule engine, workflow) — Next.js App Router, satu codebase untuk frontend + backend (Route Handlers sebagai API internal).
- Database MySQL sesuai [`ERD.md`](ERD.md).
- API eksternal versi `v1`, autentikasi Bearer token, untuk instansi terkait menarik data talenta (read-only, scoped).
- Proses konsolidasi data dari sistem sumber (eHRM, eNominasi, eKinerja) — asumsi tahap awal berupa *batch import* terjadwal/manual (lihat §9 Fase Implementasi), sinkron *real-time* menyusul jika sistem sumber mendukung webhook/API.

### 4.2 Di Luar Lingkup (untuk versi ini)
- Menggantikan/mematikan aplikasi *existing* eHRM, eNominasi, eKinerja — sistem ini **mengonsumsi** data mereka, bukan menggantikan.
- Self-service portal pegawai (pegawai login lihat profil sendiri) — dicatat sebagai kandidat fase panjang/opsional, lihat §9.
- Modul di luar manajemen talenta (payroll, cuti, dsb).

### 4.3 Arsitektur (tingkat tinggi, bukan kode)
- **Frontend**: Next.js App Router. Halaman dashboard/data berat pakai Server Components (fetch langsung dari DB/API internal); form & komponen interaktif (rule engine builder, perbandingan kandidat) pakai Client Components.
- **Backend**: Route Handlers Next.js dibagi dua namespace:
  - `internal` (dipakai UI sendiri, auth via sesi/cookie, role-based middleware) — CRUD **seluruh entitas ERD** (§2.1–2.4), termasuk entitas sistem (`users`, `sync_log`, `api_client`, `api_token`) yang dikelola lewat halaman admin di §6.9–6.10.
  - `api/v1/*` (dipakai instansi eksternal, auth via header `Authorization: Bearer <token>`, terpisah dari sesi) — **subset read-only** dari data di atas, dibatasi sesuai `scope_akses` klien (lihat §7). Bukan namespace terpisah per kelompok ERD, melainkan irisan terbatas dari data yang sama.
- **Autentikasi internal**: sesi berbasis credential (email/username + password) di fase awal; integrasi SSO Kementerian PU dicatat sebagai opsi fase panjang (§10 asumsi).
- **Database**: MySQL, diakses lewat **Drizzle ORM + mysql2** — *sudah diputuskan saat mulai coding*. Skema TypeScript **di-introspect dari database** (`drizzle-kit pull`), bukan didefinisikan ulang manual, karena sumber kebenaran skema adalah [`sql/001_schema.sql`](sql/001_schema.sql) yang turunan 1:1 dari [`ERD.md`](ERD.md). Dengan begitu tidak ada skema paralel yang bisa *drift*. Agregasi dashboard ditulis sebagai SQL langsung (`GROUP BY`), bukan diambil semua lalu dihitung di JavaScript — dev punya 40 pegawai, produksi 1.872. *(Draf awal PRD merekomendasikan Prisma; diganti karena Prisma menuntut skema paralel di `schema.prisma` dan menambah query engine tanpa manfaat di sini.)*
- **Penyimpanan berkas**: arsip digital (ijazah, sertifikat diklat, SK jabatan, SK hukuman disiplin) perlu object storage terpisah (S3-compatible/lokal) — kolom `url_*` di ERD menyimpan referensinya saja.
- **Job terjadwal**: proses konsolidasi data (`sync_log`) dan perhitungan ulang `match_score`/`talent_pool.ranking` berjalan sebagai job terjadwal (cron), bukan dihitung on-the-fly setiap halaman dibuka (demi performa dashboard).

---

## 5. Alur Proses Utama (Traceability: Blueprint → Sistem)

Memetakan "Garis Besar Proses" di `BLUEPRINT READINESS...md` §5 ke aktor, halaman, dan tabel data konkret:

| # | Tahap (Blueprint) | Aktor | Halaman Terkait | Tabel Data Utama | Output |
|---|---|---|---|---|---|
| 1 | Konsolidasi Data | Super Admin | Konsolidasi & Sinkronisasi Data | `sync_log`, `pegawai`, `riwayat_*` | Data terbaru dari eHRM/eNominasi/eKinerja masuk ke DB |
| 2 | Validasi & Normalisasi | Admin Talenta | Antrian Pembersihan Data | `pegawai.jabatan_id`, `riwayat_jabatan.jabatan_id` | Data bersih & terpetakan ke master jabatan/unit |
| 3 | Seleksi Kelayakan | Sistem (otomatis) | Kandidat & Eligibility Check | `jabatan_target_persyaratan`, `match_score.eligible` | Daftar pegawai yang memenuhi syarat jabatan target |
| 4 | Hitung Match Score | Sistem (rule engine) | Kandidat & Eligibility Check | `rubrik_komponen/indikator/kategori_skor`, `match_score` | Skor 65/20/15 per kandidat |
| 5 | Ranking Kandidat | Sistem (otomatis) | Talent Pool per Jabatan Target | `talent_pool.ranking` | Daftar kandidat terurut |
| 6 | Nominasi Unit | Pengelola Unit | Form Pengajuan Nominasi | `nominasi` | Pengajuan nominasi tercatat |
| 7 | Verifikasi Kepegawaian | Admin Talenta | Verifikasi Nominasi | `approval_log`, `nominasi.status` | Nominasi disetujui/ditolak/revisi |
| 8 | Talent Pool Final | Admin Talenta / Pimpinan | Talent Pool per Jabatan Target | `talent_pool.status = DITETAPKAN` | Talent pool resmi jabatan tsb. |
| 9 | Rencana Pengembangan | Admin Talenta | Rencana Suksesi & Pengembangan | `rencana_pengembangan` | Rencana diklat/rotasi/mentoring suksesor |
| 10 | Implementasi ke Aplikasi Existing | Super Admin | Manajemen Klien/Token API | `api_client`, `api_token`, `api_activity_log` | Data talent pool tersedia utk ditarik *karir.pu.go.id*/pihak lain via API |

> Catatan tahap #10: diasumsikan sistem ini **berdiri sendiri** dan hasilnya (talent pool, match score) diekspos balik ke *karir.pu.go.id* (atau sistem lain) lewat API/ekspor — bukan sistem ini yang "masuk ke dalam" *karir.pu.go.id*. Ini asumsi arsitektur penting, lihat §10.

---

## 6. Inventaris Halaman

### 6.1 Modul Auth & Akun

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Masuk** ✅ | Form username **atau** email + sandi. Dipasang sebagai `<form action>`, bukan `onSubmit`: sebelum React ter-hidrasi, form `onSubmit` jatuh ke pengiriman HTML biasa — GET dengan **sandi di query string**, yang lalu mengendap di riwayat peramban & log server. Balasan gagal **tidak membedakan** "akun tidak ada" dari "sandi salah" (kalau berbeda, halaman ini jadi alat mendata siapa saja yang punya akun); lamanya balasan pun disamakan. `?next=` disaring terhadap *open redirect*. Akun terkunci sementara setelah beberapa kegagalan beruntun — satu-satunya keadaan yang diberi tahu apa adanya, karena yang mencapainya sudah tahu akun itu ada | Masuk, lanjut ke tujuan semula | Semua |
| **Lupa Password** ✅ | Form permintaan pengaturan ulang. **Tidak ada email yang dikirim, dan halaman ini mengatakannya** — belum ada transport surel yang diputuskan (§4.3), jadi permintaannya dicatat lalu muncul sebagai pekerjaan Super Admin di Manajemen Pengguna, yang menerbitkan sandi sementara lewat jalur kepegawaian. Balasannya selalu sama, terdaftar atau tidak | Ajukan pengaturan ulang | Semua |
| **Ganti Sandi Wajib** ✅ *(baru)* | Penahan setelah sandi diatur Super Admin. Selama sandi yang berlaku masih diketahui orang lain, tindakan atas nama akun itu tidak bisa dipertanggungjawabkan sebagai perbuatan pemiliknya — jadi aplikasi belum dibuka sama sekali, dan jalan keluarnya hanya dua: ganti sandi, atau keluar | Simpan sandi baru | Semua (masuk dengan sandi sementara) |
| **Profil Saya** ✅ | Identitas akun, peran + penjelasannya, lingkup unit yang berlaku, riwayat akun (masuk terakhir, sandi terakhir diubah, kapan sesi ini berakhir), ganti sandi, dan **daftar perangkat yang sedang terbuka** dengan tombol akhiri per sesi. Nama/email/unit **sengaja tidak bisa diubah sendiri**: ketiganya menentukan lingkup data dan jadi identitas di `audit_log`, jadi membiarkan pemiliknya menggeser sendiri berarti jejak audit bisa diarahkan — dan itu ditulis di halaman, bukan dibiarkan jadi field yang tampak bisa diklik tapi ternyata mati | Ganti sandi, akhiri sesi perangkat lain | Semua (login) |

### 6.2 Dashboard

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Dashboard Utama** | Widget: sebaran Kotak 9 (ringkas), jumlah talenta per jenjang/unit, daftar jabatan strategis kosong butuh suksesor, status kesehatan data (traffic light — reuse tabel "Status Readiness Data" jadi widget live: hijau/kuning/merah per kategori data), notifikasi nominasi menunggu persetujuan (untuk Pimpinan/Admin) | Klik-through ke modul terkait | Semua (konten menyesuaikan role: Pimpinan lihat ringkasan strategis, Admin lihat status data/antrian kerja) |

### 6.3 Direktori & Profil Talenta

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Direktori Pegawai** ✅ | Tabel pegawai: NIP, Nama, Jabatan, Eselon, Unit Organisasi, Pangkat, Jenjang, Jenis Asesmen, Potkom, Integritas, Predikat Kinerja, Kotak 9 (kolom persis mockup #1 `KERANGKA TALENT POOL.md`) — filter unit (hierarkis)/eselon/jenjang/pendidikan/Kotak 9/status asesmen, pencarian nama & NIP, pemilih kolom. Paginasi, pengurutan, dan penyaringan **dikerjakan di SQL**, bukan di klien | Buka Profil Talenta | Admin Talenta, Pengelola Unit, Pimpinan, Viewer |
| **Profil Talenta** ✅ | Halaman 360°: bio (golongan, pangkat, TMT) + **data turunan NIP** (usia, jenis kelamin, TMT CPNS, masa kerja ASN, proyeksi batas usia pensiun); **skor kelengkapan data berbobot** (U-2); posisi Kotak 9 + riwayat asesmen antar tahun; tren kinerja per triwulan; **match score ke setiap jabatan target dengan rincian sampai sub-indikator** (U-3); timeline riwayat jabatan (menandai penugasan Plt/Plh dan riwayat yang belum terpetakan); riwayat pendidikan dengan kolom arsip adaptif; riwayat diklat bercari & terlipat; integritas & rekam jejak disiplin | Unduh profil PDF *(Fase 8)*, tambah ke talent pool *(Fase 6)* | Admin Talenta, Pengelola Unit (data unit sendiri), Pimpinan, Viewer |
| **Peta Talenta** ✅ *(dulu "Sebaran Kotak 9", diperluas oleh U-1)* | Grid visual 3×3 (Kinerja × Potensial) dengan jumlah + persentase & intensitas warna relatif, **berdampingan dengan bubble Kinerja × Potensial** (plus padanan tabelnya) — grid menjawab "berapa orang per kotak", bubble menjawab "bagaimana sebarannya di dalam kotak"; filter unit (hierarkis rekursif)/eselon/jenjang/tahun asesmen/hanya-berlaku, semuanya tersinkron URL; klik sel → daftar pegawai berpaginasi dengan nilai aslinya. **Avatar per sel tidak dipakai** — pada 1.872 pegawai avatar di dalam sel tidak terbaca dan tidak menjawab pertanyaan apa pun; digantikan angka + drill-down | Filter, klik-through ke profil, lanjut ke Direktori untuk pengurutan lanjut. *Ekspor gambar → Fase 8* | Admin Talenta, Pimpinan, Viewer |
| **Perbandingan Kandidat** ✅ | Pilih 2–4 pegawai lewat pencarian; tabel sisi-berdampingan (baris = atribut, kolom = kandidat): identitas & posisi, **Kotak 9 + predikat kinerja**, nilai asesmen, match score per komponen 65/20/15 + eligibility + status talent pool, pengalaman & rekam jejak disiplin; **radar per indikator rubrik** + penanda nilai terbaik & selisih ≥10 poin. Skor hanya ditampilkan **per satu jabatan target** (bobot & indikatornya berbeda antar target); radar disembunyikan kalau ada kandidat tanpa skor di target itu | Pilih kandidat, ganti jabatan target pembanding, buka profil. *Ekspor perbandingan → Fase 8* | Admin Talenta, Pimpinan |

### 6.4 Master Data (Admin)

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Master Unit Organisasi** ✅ | Tree hierarki unit (kode, nama, induk, jenis, level eselon) yang bisa dilipat per cabang, dengan jumlah jabatan & pegawai per unit — termasuk pegawai seluruh turunannya. Unit yang **tidak terjangkau dari akar** (induk menunjuk baris tidak ada / tersangkut siklus) ditampilkan terpisah di atas, karena ia tidak muncul di pohon dan pegawainya hilang dari agregasi per unit | CRUD unit, atur hierarki | Super Admin |
| **Master Jabatan** ✅ | Tabel jabatan (kode, nama, unit, jenis, jenjang, eselon, status, jumlah penghuni, ada/belum jabatan target) — filter unit hierarkis/eselon/jenis/status + pencarian, paginasi di SQL | CRUD jabatan, tandai kosong/terisi, arsipkan. **Jabatan berpenghuni tidak bisa ditandai kosong** — status itu dibaca widget dashboard & halaman Risiko Kekosongan, jadi tidak boleh berbohong | Super Admin, Admin Talenta |
| **Jabatan Kosong & Risiko Kekosongan** ✅ *(dulu "Status Jabatan Kosong", diperluas oleh U-6)* | Dua bagian: **(1) sudah kosong** — diurutkan dengan yang belum punya jabatan target di atas, plus jumlah kandidat pool & yang siap; **(2) akan kosong** — pejabat yang mendekati Batas Usia Pensiun dengan ambang 1/3/5/10 tahun, lama menjabat, dan penanda "tanpa suksesor siap". Usia & BUP diturunkan dari NIP, bukan kolom tersendiri | Filter ambang, klik-through ke profil, lanjut ke Perbandingan Kandidat | Admin Talenta, Pimpinan |
| **Data Hukuman Disiplin** ✅ | Tabel rekam jejak disiplin per pegawai (tingkat, skor integritas yang dihasilkan, SK, status aktif, keterangan) + ringkasan sebaran tingkat. Catatan **tidak pernah dihapus**, hanya dinonaktifkan — ia dasar skor integritas yang sudah dipakai menghitung match score. Isi keterangan **tidak** disalin ke `audit_log` agar uraian pelanggaran tidak menyebar ke tabel dengan aturan akses berbeda | Tambah/edit catatan, nonaktifkan. *Unggah berkas SK → Fase 8* | Admin Talenta, Super Admin. **Akses BACA ditolak di server** untuk peran lain (UU PDP No. 27/2022) — bukan hanya menu disembunyikan |

### 6.5 Rule Engine — Jabatan Target

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Daftar Jabatan Target** ✅ | List profil jabatan target (nama, jumlah jabatan anggota, jumlah komponen & indikator rubrik, jumlah persyaratan, kandidat lolos syarat / dinilai, kapan skornya terakhir dihitung, status draft/aktif/nonaktif). Kolomnya dipilih untuk menjawab "apakah jabatan target ini siap dipakai?" — tiga hal pertama adalah prasyarat aktivasi, dan tanggal perhitungan menentukan apakah angka di halaman kandidat masih bisa dipercaya | Buat jabatan target baru (selalu lahir DRAFT), ubah profil & kata kunci relevansi, aktifkan/nonaktifkan, duplikasi rubrik dari target lain, hapus. **Jabatan target yang punya entri talent pool dinonaktifkan, bukan dihapus** — `talent_pool` & `nominasi` menunjuk ke sini lewat cascade, jadi menghapusnya ikut menghapus riwayat persetujuan | Admin Talenta, Super Admin |
| **Editor Jabatan Target** ✅ | Halaman paling kompleks — 3 tab: (1) *Jabatan Anggota*: pilih 1+ jabatan definitif yang termasuk target ini, lewat pencarian sisi-server (dibatasi 20 hasil); (2) *Persyaratan*: syarat minimal (pendidikan, bidang ilmu, pengalaman) — replikasi format `KERANGKA TALENT POOL.md`, dengan penegasan tegas bahwa syarat **tanpa nilai minimal terstruktur tidak menyaring siapa pun** (ditandai "perlu verifikasi manual"); (3) *Rubrik Penilaian*: builder Komponen → Indikator (+ sub-indikator) → Kategori Skor, dengan validasi bobot komponen (sumbu X) harus total 100% dan bobot indikator *top-level* dalam 1 komponen harus total = bobot komponennya. Sub-indikator (mis. Lama/Keragaman/Substansi Jabatan di bawah "Nilai Pengalaman Jabatan") **tidak** ikut divalidasi terhadap total 100% karena `bobot_indikator`-nya NULL by design (digabung ke induk lewat rata-rata, bukan dijumlah — lihat metode agregasi yang masih perlu dikonfirmasi di §10). **Panel pemeriksaan rubrik** tampil di atas ketiga tab (bukan di dalam tab Rubrik) karena yang memblokir aktivasi bukan hanya rubrik: jabatan anggota yang kosong juga. Setiap temuan menampilkan pesan + saran beserta angkanya, bukan kode galat — mesin rubrik sengaja tidak pernah melempar, jadi rubrik yang salah tetap menghasilkan angka yang kelihatan wajar. Tab aktif ada di URL supaya bisa dibagikan | Simpan (langsung, tanpa salinan draft), **aktifkan — ditolak selama masih ada galat**, Hitung Ulang, duplikasi rubrik | Admin Talenta, Super Admin |
| **Simulasi & Diff** ✅ *(U-4)* | Jalankan rubrik yang tersimpan sekarang terhadap seluruh pegawai aktif, lalu bandingkan dengan isi `match_score`: baris berubah, peringkat bergeser (↑/↓), kelayakan masuk/keluar, selisih skor terbesar. Hanya baris yang berubah ditampilkan, diurutkan menurut besar dampaknya. **Tidak menulis apa pun.** Halaman menyatakan dua hal yang mudah disalahpahami: (a) editor menyimpan langsung, jadi ini "tersimpan vs hitungan sekarang", bukan "sebelum vs sesudah suntingan"; (b) sebagian selisih bisa muncul karena waktu berjalan (Lama Jabatan bertambah), bukan karena rubriknya diubah | — (read-only) | Admin Talenta, Super Admin |
| **Kandidat & Eligibility Check** ✅ | Untuk 1 jabatan target: seluruh pegawai yang dinilai — **termasuk yang tidak lolos syarat**, karena skornya tetap berguna sebagai pembanding — dengan breakdown 65/20/15, filter "hanya lolos syarat", pencarian, paginasi & pengurutan di SQL. Kolom **Kotak 9 dan predikat kinerja tampil sebelum match score** (K-4). **Rincian Perhitungan Skor** (U-3) sebagai panel drill-down `?rincian=<nip>`: turun sampai sub-indikator, dikelompokkan per komponen, menandai baris yang perlu ditinjau dan yang nilainya diisi manusia beserta siapa pengisinya | Hitung Ulang (dari editor), isi nilai manual per indikator — **catatan wajib**, karena indikator yang diisi manusia adalah tempat penilaian jadi subjektif. Nilai manual **bertahan** melewati Hitung Ulang. *Tambahkan kandidat ke Talent Pool → Fase 6* | Admin Talenta, Pimpinan (lihat saja) |

### 6.6 Talent Pool & Workflow Nominasi

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Talent Pool per Jabatan Target** ✅ | Daftar kandidat dalam pool untuk 1 jabatan target (pemilih target di URL) dengan status masing-masing, peringkat, match score, **Kotak 9 & predikat kinerja berdampingan** (K-4), dan kolom **Giliran** — siapa yang harus bertindak berikutnya, turunan dari pasangan status kandidat × nominasi. Di atas kartu ada penyebut lintas jabatan target, supaya angka "0 menunggu tindakan" pada satu target tidak terbaca sebagai nol secara keseluruhan. Entri berstatus mustahil ditandai beserta penjelasannya | Ajukan nominasi, setujui/tolak/minta revisi, tetapkan & batalkan penetapan, keluarkan/pulihkan kandidat, masukkan kandidat lolos syarat ke pool. **Aksi yang tampil dihitung dari state machine di server**, bukan disusun di klien | Admin Talenta, Pimpinan (penetapan final), Pengelola Unit (pengajuan) |
| **Form Pengajuan Nominasi** ✅ | Dialog dari baris kandidat di Talent Pool, bukan halaman terpisah — pengajuan memang dimulai dengan memilih kandidat, jadi memindahkannya ke route lain hanya menambah langkah. Memuat pemilih unit pengaju (nominasi diajukan atas nama unit, bukan pribadi) + catatan **wajib** | Submit nominasi, ajukan ulang setelah revisi | Pengelola Unit |
| **Verifikasi Nominasi** ✅ | Satu antrian untuk semua peran, disaring menurut **giliran** (bukan satu halaman per peran — yang membedakan pekerjaan Admin Talenta & Pimpinan adalah tahap yang menunggu mereka, bukan daftar nominasinya). Lama menunggu ditampilkan dalam **hari** karena waktu layanan adalah metrik proyek §2. Detail memuat konteks kandidat + form keputusan | Setuju / tolak / minta revisi + catatan | Admin Talenta |
| **Riwayat/Log Approval** ✅ | Timeline dua tahap (Verifikasi Kepegawaian → Persetujuan Pimpinan) berisi siapa, kapan, keputusan, catatan. **Tahap yang belum dijalani tetap ditampilkan** — tanpa itu, nominasi yang baru lolos verifikasi terlihat seperti sudah tuntas. Satu tahap yang dilalui dua kali (diminta revisi lalu diajukan ulang) menampilkan seluruh jejaknya | — (read-only) | Semua yang terlibat + Pimpinan |
| **Rencana Suksesi & Pengembangan** ✅ | Dikelompokkan **per suksesor**, bukan sebagai daftar rencana datar: yang ditanyakan adalah "apa rencana untuk orang ini". Memuat jenis (diklat/rotasi/mentoring/penugasan), target selesai + **sisa hari** (tenggat tidak terbaca dari tanggal tanpa menghitung), dan status progres. Rencana milik kandidat yang penetapannya dibatalkan **tidak dihapus** — dikelompokkan terpisah sebagai riwayat | Tambah/ubah rencana, tandai selesai. Rencana berstatus Selesai tidak bisa dihapus (rekam jejak) | Admin Talenta, Pimpinan |
| **Inbox Tugas & Notifikasi** ✅ *(U-7)* | Dua panel berdampingan yang sengaja DIPISAH: **tugas** (keadaan workflow yang menunggu peran pengguna — hilang hanya kalau keputusannya diambil) dan **notifikasi** (kabar — bisa ditandai terbaca tanpa pekerjaannya selesai). Menggabungkannya akan membuat "tandai terbaca" terasa seperti menyelesaikan pekerjaan. Notifikasi disebar per pengguna saat dibuat, bukan disimpan bertujuan peran, supaya penanda terbaca satu orang tidak menyembunyikannya dari yang lain | Tandai terbaca (satu/semua), buka tugas yang menunggu | Semua peran internal (isinya mengikuti peran & unit pengguna) |

### 6.7 Konsolidasi & Kualitas Data

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Konsolidasi & Sinkronisasi Data** ✅ | Status tiap sumber (eHRM/eNominasi/eKinerja/Manual): terakhir sync, total baris, jumlah sukses/sebagian/gagal; riwayat `sync_log` dengan durasi & detail error, baris GAGAL ditandai jelas. **Tombol trigger sync manual belum dipasang** — mekanisme sumber produksi masih pertanyaan terbuka §10.2 (batch vs API/webhook), dan tombol yang memanggil sumber yang belum ada akan selalu gagal sehingga pengguna menyimpulkan sinkronisasinya rusak. Aturan normalisasinya sendiri sudah siap & teruji di `lib/importer` | Lihat status & detail error | Super Admin |
| **Antrian Pembersihan Data** ✅ | Temuan dikelompokkan menurut **nomor aturan** normalisasi (phase.md §6) dengan jumlah, tingkat (sudah dikoreksi otomatis vs perlu keputusan manusia), dan dampaknya ke penilaian; drill-down per kelompok menampilkan barisnya. Dihitung dari keadaan DB sekarang — bukan dari catatan importer yang bisa basi. Temuan bernilai nol tetap didaftar beserta alasannya. *Pemetaan manual & tanda "diverifikasi" belum ada: keduanya butuh tempat menyimpan keputusan manusia yang belum ada di skema; perbaikan dilakukan di sumber datanya* | Lihat & telusuri temuan, buka profil terkait | Admin Talenta |
| **Kelengkapan Data** ✅ *(usulan U-2)* | Mengukur target PRD §2 "kelengkapan ≥90%" yang sebelumnya tidak punya alat ukur: rerata & sebaran per tingkat, **butir terurut menurut bobot × jumlah yang belum terpenuhi** (bukan menurut persentase) beserta alasan tiap butir, rollup per unit, dan daftar pegawai terendah. Bobot butir satu sumber dengan badge profil — ekspresi SQL-nya dihasilkan dari daftar bobot yang sama | Filter, klik-through ke profil/direktori | Admin Talenta, Pimpinan |

### 6.8 Laporan & Ekspor

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Laporan Gap Analysis** ✅ | Kebutuhan pengembangan kompetensi **per indikator rubrik** (yang paling perlu diintervensi lebih dulu), plus rollup per unit & per jenjang dengan pecahan 65/20/15. Sumbernya `match_score_detail` yang sudah tersimpan sejak Fase 5 — bukan hitungan baru, sehingga angkanya tidak bisa berbeda dari halaman Kandidat. **Rincian per persyaratan jabatan target belum bisa ditampilkan** dan halamannya mengatakan itu apa adanya: `match_score` hanya menyimpan satu penanda lolos + catatan teks, sedangkan hasil per syarat dihitung saat penilaian lalu dibuang. Mengurainya dari teks membuat angka laporan bergeser tiap kali kalimatnya disunting; menghitungnya ulang menuntut pembacaan seluruh riwayat tiap pegawai. Menampilkannya perlu kolom/tabel baru — keputusan skema | Filter (jabatan target/unit/jenjang), ekspor CSV | Admin Talenta, Pimpinan |
| **Laporan Nominasi & Approval** ✅ | Rekap per periode, per unit pengaju, dan sebaran keputusan per tahap, plus daftar rinci. Angka utamanya **waktu proses dalam hari** — metrik PRD §2. Nominasi yang **masih berjalan ikut dihitung** sampai hari ini: kalau yang berjalan dibuang dari rata-rata, angka waktu layanan justru membaik setiap kali ada berkas menggantung lama | Filter (jabatan target/unit/rentang tanggal), ekspor CSV | Admin Talenta, Pimpinan |
| **Audit Log Viewer** ✅ | Log semua perubahan data penting (siapa, kapan, entitas apa, sebelum/sesudah) — berpaginasi & tersaring di SQL. Rincian per baris menampilkan **hanya field yang berubah**; yang nilainya sama dilipat. Dua blok JSON berdampingan menyuruh pembacanya mengerjakan perbandingan itu sendiri, dan pada baris ke-30 ia berhenti membaca — jejak audit yang ada tapi tidak dipakai. Perbandingannya longgar terhadap beda tipe dari driver (`1` vs `true`, `"10"` vs `10`), karena riwayat yang penuh perubahan palsu tidak bisa dibedakan dari riwayat yang benar. Pilihan penyaring diturunkan dari isi tabel, bukan daftar tetap, supaya modul baru langsung muncul. Peristiwa autentikasi yang gagal diberi nada bahaya — itu satu-satunya baris yang bisa menandakan serangan. **Akses baca ditolak di server**: isinya memuat nilai sebelum/sesudah seluruh mutasi, termasuk baris yang aslinya dibatasi peran tertentu | Filter user/entitas/aksi/tanggal, cari isi perubahan. *Ekspor → Fase 8* | Super Admin |
| **Pusat Ekspor Laporan** ✅ | Halaman terpusat berisi tujuh jenis ekspor beserta isinya, disaring menurut peran. **Formatnya CSV, bukan PDF/Excel** — CSV dibuka Excel & LibreOffice apa adanya tanpa satu pun dependensi baru, sedangkan `.xlsx` dan PDF menuntut pustaka tambahan; itu keputusan yang pantas diambil sadar, bukan diselipkan. **Ekspornya sinkron, menyimpang dari U-10**: kueri laporan selesai 2–60 ms dan tiap ekspor dibatasi `LIMIT`, jadi antrean job akan jadi infrastruktur untuk masalah yang belum ada. Tombol di halaman ini mengunduh tanpa penyaring; ekspor bersyarat dimulai dari halaman laporannya, supaya isi berkas sama dengan isi layar. Setiap unduhan tercatat di `audit_log` (jenis, penyaring, jumlah baris — **bukan** isi datanya) karena setelah berkas terunduh tidak ada aturan akses aplikasi yang masih berlaku atasnya (§7.3, UU PDP) | Unduh CSV | Admin Talenta, Pimpinan. Audit log: **Super Admin** saja |

### 6.9 Integrasi API Eksternal

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Manajemen Klien API** | Daftar instansi eksternal terdaftar (nama, kode, kontak, no. MoU/PKS, status, scope akses) | Tambah/edit klien, atur scope akses | Super Admin |
| **Manajemen Token API** | Daftar token per klien (label, masa berlaku, terakhir dipakai, status) | Generate token baru, cabut token | Super Admin |
| **Log Aktivitas API** | Riwayat pemanggilan API per klien/token (endpoint, waktu, response code/time) | Filter, deteksi anomali pemakaian | Super Admin |
| **Dokumentasi API** | Halaman dokumentasi endpoint publik/semi-publik: cara autentikasi (Bearer token), daftar endpoint & contoh request/response, format error, rate limit | — (referensi) | Publik terbatas (butuh kredensial developer) / Super Admin (kelola konten) |

### 6.10 Administrasi Sistem

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Manajemen Pengguna & Peran** ✅ | Daftar akun internal: peran, unit scope, status aktif, akun terkunci, sandi sementara yang belum diganti, dan **jumlah sesi yang sedang berjalan** — angka terakhir itu yang membuat akibat penonaktifan terbaca sebelum tombolnya ditekan. Di atasnya, antrian **permintaan Lupa Password** yang menunggu ditangani (pekerjaan, bukan log; permintaan dari email tak terdaftar tetap ditampilkan & ditandai, karena pola email asing yang berulang adalah percobaan mencacah akun). Sandi sementara ditampilkan **tepat sekali** dan tidak pernah masuk `audit_log`: sandi yang bisa dilihat kapan saja oleh Super Admin tidak pernah benar-benar jadi milik penggunanya | Buat/ubah akun, atur peran & unit, atur ulang sandi, buka kunci, aktif/nonaktifkan. **Mengubah peran atau unit langsung memutus sesi aktifnya** — wewenang lama tidak boleh menempel sampai ia keluar sendiri. **Super Admin aktif terakhir tidak bisa dinonaktifkan atau diturunkan**, dan tidak seorang pun bisa menonaktifkan dirinya sendiri: satu klik yang wajar akan membuat halaman ini tidak bisa dibuka siapa pun lagi, dan pemulihannya hanya lewat SQL langsung ke produksi | Super Admin |
| **Pengaturan Sistem** ✅ | Parameter yang boleh diubah tanpa deploy, dikelompokkan: **penilaian** (masa berlaku asesmen, tahun asesmen berjalan) dan **keamanan & sesi** (timeout idle, umur maksimal sesi, batas percobaan masuk, lama kunci akun). Tiap parameter punya tombol simpannya sendiri — akibatnya berbeda-beda dan sebagian berat, jadi menyimpan enam sekaligus membuat akibatnya menumpuk jadi satu peristiwa yang tidak bisa ditelusuri balik ke penyebabnya. Halaman menyatakan tegas bahwa perubahannya **tidak retroaktif**: skor di `match_score` tetap hasil hitungan dengan nilai lama sampai Hitung Ulang dijalankan. Parameter yang belum ditempatkan ke kelompok mana pun muncul di panel penadah, bukan hilang tanpa jejak | Update parameter — batas nilainya ditegakkan **di server** dari kolom `nilai_min`/`nilai_max`, bukan hanya atribut `min`/`max` di input | Super Admin |

---

## 7. Desain API Eksternal (untuk Instansi Terkait)

### 7.1 Prinsip
- Read-only (fase awal) — instansi eksternal **menarik** data, tidak menulis.
- Auth: header `Authorization: Bearer <token>`, token dipetakan ke `api_client` + `scope_akses` (§ERD 2.4).
- Semua pemanggilan tercatat di `api_activity_log` (audit & deteksi penyalahgunaan).
- Data yang boleh diakses **dibatasi per klien** — bisa hanya data agregat (statistik sebaran Kotak 9) tanpa NIP/nama individu, kecuali klien punya MoU yang mengizinkan data personal (kolom `api_client.no_mou`).
- Versioning lewat prefix path (`/api/v1/...`) supaya perubahan skema tidak memutus integrasi klien lama.

### 7.2 Contoh Kebutuhan Endpoint (indikatif, bukan final)

| Endpoint | Deskripsi | Catatan Scope |
|---|---|---|
| `GET /api/v1/pegawai` | List pegawai (paginated, filter unit/jenjang) | Field NIP/nama bisa disembunyikan tergantung scope |
| `GET /api/v1/pegawai/{nip}` | Detail profil talenta 1 pegawai | Butuh scope "data personal" |
| `GET /api/v1/talent-pool` | List kandidat talent pool per jabatan target | Butuh scope "talent pool" |
| `GET /api/v1/kotak-9/summary` | Statistik agregat sebaran Kotak 9 (tanpa data personal) | Scope minimal, cocok untuk klien tanpa MoU personal data |

### 7.3 Kepatuhan Data
Karena ini data ASN (termasuk data sensitif seperti rekam jejak disiplin), berbagi data ke instansi lain sebaiknya mengacu ke **UU No. 27/2022 (PDP)** — prinsip minimalisasi data, dasar hukum berbagi (MoU/PKS), dan hak akses dibatasi sesuai kebutuhan (bukan "buka semua" ke semua klien). Ini alasan `scope_akses` & `no_mou` ada di `api_client` (lihat ERD §2.4).

---

## 8. Kebutuhan Non-Fungsional

| Aspek | Kebutuhan |
|---|---|
| **Keamanan** | RBAC per role; password hashing (bcrypt/argon2); HTTPS wajib; rate limiting di `api/v1/*`; sesi timeout untuk UI internal; opsi 2FA untuk Super Admin/Admin Talenta |
| **Kepatuhan Data** | Data minimization di API eksternal; retensi & jejak audit (`audit_log`) untuk semua perubahan data pegawai/hukuman disiplin; akses data hukuman disiplin dibatasi role tertentu |
| **Performa** | Pagination di semua halaman list; index DB pada kolom FK & filter umum (`nip`, `unit_organisasi_id`, `jabatan_target_id`); agregat dashboard (Sebaran Kotak 9) dihitung berkala (job), bukan query berat real-time |
| **Ketersediaan** | Backup MySQL terjadwal; environment staging terpisah dari produksi mengingat sensitivitas data ASN |
| **Auditability** | Setiap CRUD pada entitas penting (pegawai, hukuman_disiplin, rubrik, talent_pool, nominasi) tercatat otomatis ke `audit_log` di level aplikasi |
| **Bahasa & Aksesibilitas** | UI penuh Bahasa Indonesia; responsif (Pimpinan sering akses lewat tablet/HP) |

---

## 9. Fase Implementasi (selaras roadmap `manajemen talenta...md` §04)

| Fase | Periode | Fokus Halaman/Fitur | Selaras Dengan |
|---|---|---|---|
| **Tahap Pendek** | Jul–Sep 2026 | Auth & RBAC dasar · Master Unit & Jabatan · Direktori Pegawai & Profil Talenta (data hasil migrasi/impor awal, sync masih manual) · Konsolidasi Data (impor batch) · Dashboard dasar + Sebaran Kotak 9 (pakai `asesmen_talenta` yang sudah ada apa adanya) | Output roadmap: "Proses Bisnis, SOP, Prototype Sistem Informasi" |
| **Tahap Menengah** | Okt 2026–Jun 2027 | Rule Engine (Jabatan Target + Editor Rubrik) · Kandidat & Eligibility Check · Talent Pool per Jabatan Target · Perbandingan Kandidat · Nominasi dasar (pengajuan + 1 tahap verifikasi) · Laporan Gap Analysis · Sinkronisasi data otomatis (bukan manual lagi) | Output roadmap: "Talent Pool, Dashboard" |
| **Tahap Panjang** | >Jul 2027 | Workflow approval berjenjang penuh · Rencana Pengembangan Suksesor lengkap · Audit Log matang · Integrasi API Eksternal (Manajemen Klien/Token, Dokumentasi API) · Monitoring berkelanjutan · *(opsional)* Self-service portal pegawai | Output roadmap: "Monitoring, Succession Planning" |

---

## 10. Asumsi & Pertanyaan Terbuka

Sama seperti [`ERD.md`](ERD.md) §5, beberapa keputusan produk berikut sebaiknya dikonfirmasi sebelum coding:

1. **Relasi dengan *karir.pu.go.id*** — asumsi: sistem ini **berdiri sendiri** (aplikasi baru), lalu hasil talent pool/match score diekspos balik ke *karir.pu.go.id* lewat API (§7). Kalau ternyata maksudnya sistem ini **jadi bagian/menggantikan** modul di *karir.pu.go.id* langsung (shared DB/shared auth), arsitektur §4.3 & scope autentikasi perlu disesuaikan.
2. **Sumber data real-time vs batch** — asumsi Tahap Pendek masih *impor manual/batch* dari eHRM/eNominasi/eKinerja (karena belum jelas apakah sistem-sistem itu punya API/webhook keluar). Perlu konfirmasi ke pemilik sistem sumber.
3. **Siapa yang menjalankan tahap "Verifikasi Kepegawaian"** — asumsi: Bagian Kepegawaian dan Umum DJBK sendiri (role Admin Talenta), bukan Biro Kepegawaian Kementerian (lihat juga `ERD.md` §5 poin 1).
4. **Cakupan self-service pegawai** — belum masuk MVP; perlu keputusan apakah pegawai butuh akses lihat profil talenta sendiri di fase awal atau cukup fase panjang.
5. **Kebijakan berbagi data via API eksternal** — perlu kebijakan resmi (siapa yang berhak menyetujui `api_client` baru, data apa saja yang butuh MoU, siapa yang menandatangani).
6. ⚙️ **Metode SSO internal** — **terpasang di Fase 7: akun lokal** (username atau email + sandi bcrypt), sesi tersimpan di tabel `sesi` dengan timeout idle & tenggat mutlak. Integrasi ke sistem identitas Kementerian PU tetap terbuka dan **murah dilakukan**: seluruh aplikasi mengambil identitas dari satu fungsi `getCurrentUser()`, jadi penggantiannya menyentuh satu berkas. Perlu konfirmasi apakah SSO memang diinginkan sebelum produksi.
7. ⚙️ **Metode agregasi 3 sub-indikator "Nilai Pengalaman Jabatan"** (Lama Jabatan, Keragaman Riwayat Jabatan, Substansi Riwayat Jabatan) — sama seperti `ERD.md` §5 poin 2. **Default terpasang: rata-rata sederhana** (bobot sama rata), dan aritmatikanya sudah diverifikasi konsisten dengan data contoh. Mesin rubrik memakai rumus generik `Σ(nilai × bobot) / Σ(bobot)`, jadi kalau ternyata bobotnya harus berbeda, cukup isi `rubrik_indikator.bobot_indikator` pada sub-indikator — **tanpa mengubah kode**.
8. ⚙️ **Riwayat hukuman disiplin yang sudah tidak aktif** (`hukuman_disiplin.status_aktif = 0`) — **default terpasang: TIDAK menurunkan skor** Integritas & Moralitas (dianggap sudah selesai dijalani); yang diambil adalah tingkat hukuman **teraktif-terberat**. Aturan ini tidak tertulis eksplisit di `KERANGKA TALENT POOL.md`, jadi perlu dikonfirmasi — termasuk apakah ada batas waktu "kedaluwarsa" hukuman disiplin secara resmi.

Empat pertanyaan berikut **baru muncul saat rubrik diterjemahkan ke kode**, bukan saat perancangan. Semuanya sudah punya default yang berjalan (ditandai ⚙️), tapi tetap keputusan bisnis:

9. ⚙️ **Batas atas skala Potkom.** Data contoh e-Nominasi memuat nilai Potkom **di atas 100** (tertinggi 115,10; 4 dari 9 pegawai nyata), padahal `KERANGKA TALENT POOL.md` §B mengklasifikasikan Sumbu X sebagai "Tinggi ≥80–100" — jelas mengasumsikan batas atas 100. **Default terpasang:** seluruh skor dibatasi 0–100, clamp dilakukan **saat impor** supaya nilai mentah tetap terekam di jejak sinkronisasi. Perlu konfirmasi ke pemilik e-Nominasi: apakah Potkom memang bisa >100 (mis. hasil normalisasi psikometri), atau itu anomali data?
10. ⚙️ **Rentang "Lama Jabatan" yang tidak lengkap.** `KERANGKA TALENT POOL.md` §B.2.4.a menetapkan `≥5 thn → 100`, `3 s.d. 4 thn → 80`, `<2 thn → 60` — rentang **(4,5) dan [2,3) tidak terdefinisi**, dan ada kasus nyatanya (pegawai dengan masa jabatan 4,1 tahun). **Default terpasang:** band tengah dilebarkan menjadi `≥2–<5 → 80`, dipilih karena kedua pernyataan literal dokumen tetap benar dan hanya celahnya yang diisi. Perlu konfirmasi apakah maksud penyusun memang demikian.
11. ⚙️ **Masa berlaku asesmen.** Blueprint menandai "Status Asesmen Valid & Masa Berlaku" 🟡 tanpa menyebut angkanya. **Default terpasang: 3 tahun**, disimpan sebagai **parameter sistem** (halaman Pengaturan Sistem §6.10) supaya bisa diubah tanpa deploy. Asesmen kedaluwarsa tidak eligible untuk talent pool.
12. ⚙️ **Definisi "sesuai dengan jabatan target".** Indikator Kesesuaian Bidang Ilmu (§B.2.2) dan Pengembangan Kompetensi (§B.2.3) bergantung pada frasa itu, tapi tidak ada tempat menyimpan *apa* yang dianggap sesuai — akibatnya keduanya tidak bisa dihitung otomatis. **Default terpasang:** kolom `jabatan_target.kata_kunci_relevansi` (JSON), dapat diedit dari Editor Jabatan Target (§6.5). Kata kunci `"semua"` berarti semua bidang ilmu diperbolehkan; untuk indikator diklat, `"semua"` **tidak** dianggap membebaskan syarat. Perlu konfirmasi daftar kata kunci per jabatan target dari pemilik proses.

> **Catatan penting soal Kotak 9.** Pada data contoh e-Nominasi, nilai `kotak_9` untuk **2 dari 9 pegawai** (Tasya & Tina) **tidak bisa direproduksi** dengan ambang 60/80 di Lampiran A `manajemen talenta 27 juli utk tim SIM.md` — keduanya tercatat Kotak 4 padahal rumus dokumen menghasilkan Kotak 7. Sistem **tidak menimpa** nilai dari sumber secara diam-diam: `kotak_9` dihitung dari (Kinerja, Potensial), dan bila hasilnya berbeda dari nilai sumber, barisnya masuk **Antrian Pembersihan Data** (§6.7) untuk ditinjau manusia. Ambang yang sebenarnya dipakai e-Nominasi perlu dikonfirmasi.

---

---

## 11. Riwayat Perubahan Dokumen

| Perubahan | Alasan |
|---|---|
| §4.3 ORM: Prisma → **Drizzle** | Skema sudah ada sebagai SQL; tipe TS harus diturunkan dari DB, bukan dari skema paralel |
| §10 poin 7 & 8 dapat keputusan default | Dibutuhkan untuk menulis rule engine; ditandai default agar tetap bisa dikonfirmasi |
| §10 bertambah poin 9–12 | Empat keputusan baru muncul saat rubrik diterjemahkan ke kode |
| §6 belum memuat usulan halaman U-1…U-12 | Usulan masih di [`../phase.md`](../phase.md) §8, digabung ke sini setelah disetujui |
| §6.1 bertambah halaman **Ganti Sandi Wajib** | Sandi yang dibuatkan Super Admin diketahui Super Admin. Tanpa pemaksaan ganti, "siapa melakukan apa" di `audit_log` bisa dibantah — jadi penahannya jadi halaman tersendiri, bukan sekadar peringatan |
| §10 poin 6 dapat keputusan terpasang | Fase 7 memasang akun lokal; SSO tetap terbuka lewat satu titik ganti (`getCurrentUser()`) |

*DDL MySQL sudah disusun 1:1 dari ERD ([`sql/001_schema.sql`](sql/001_schema.sql) → [`012_auth.sql`](sql/012_auth.sql)). Yang belum: wireframe/UI detail per halaman §6 (dikerjakan per fase) dan spesifikasi OpenAPI untuk §7 (Fase 9).*
