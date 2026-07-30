# PRD — Sistem Informasi Manajemen Talenta DJBK

**Codename:** SIMT DJBK (Sistem Informasi Manajemen Talenta) — modul peningkatan fitur *karir.pu.go.id*
**Stack:** Next.js (frontend + backend dalam satu app) + MySQL + API eksternal berbasis token
**Skema data pendukung:** lihat [`ERD.md`](ERD.md)
**Status dokumen:** Draft untuk audit — **belum ada implementasi kode**.

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
- **Database**: MySQL, diakses lewat ORM (rekomendasi: Prisma — tapi ini keputusan teknis yang bisa didiskusikan saat mulai coding, tidak mengunci di PRD ini).
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
| Login | Form email/username + password | Login, lupa password | Semua |
| Lupa Password | Form request reset via email | Kirim link reset | Semua |
| Profil Saya | Info akun, unit, role; ganti password | Update profil/password | Semua (login) |

### 6.2 Dashboard

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Dashboard Utama** | Widget: sebaran Kotak 9 (ringkas), jumlah talenta per jenjang/unit, daftar jabatan strategis kosong butuh suksesor, status kesehatan data (traffic light — reuse tabel "Status Readiness Data" jadi widget live: hijau/kuning/merah per kategori data), notifikasi nominasi menunggu persetujuan (untuk Pimpinan/Admin) | Klik-through ke modul terkait | Semua (konten menyesuaikan role: Pimpinan lihat ringkasan strategis, Admin lihat status data/antrian kerja) |

### 6.3 Direktori & Profil Talenta

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Direktori Pegawai** | Tabel pegawai: NIP, Nama, Jabatan, Eselon, Unit Organisasi, Pangkat, Jenjang, Kotak 9 terakhir (kolom persis mockup Blueprint) — filter unit/jenjang/golongan/pendidikan, search nama/NIP | Buka Profil Talenta, ekspor list | Admin Talenta, Pengelola Unit, Pimpinan, Viewer |
| **Profil Talenta** | Halaman 360°: bio (golongan, pangkat, TMT), jabatan saat ini & riwayat jabatan (timeline), riwayat pendidikan (dgn link arsip ijazah), riwayat diklat, grafik kinerja per periode (triwulan), histori Kotak 9 per tahun asesmen, match score terhadap jabatan target relevan, ringkasan integritas (hukuman disiplin — tampil terbatas sesuai role), catatan reviewer | Tambah ke talent pool jabatan target, unduh profil PDF | Admin Talenta, Pengelola Unit (data unit sendiri), Pimpinan, Viewer |
| **Sebaran Kotak 9** | Grid visual 3×3 (Kinerja × Potensial), tiap sel menampilkan jumlah & avatar pegawai; filter unit/jenjang/tahun asesmen; klik sel → daftar pegawai di kotak itu | Filter, ekspor, klik-through ke profil | Admin Talenta, Pimpinan, Viewer |
| **Perbandingan Kandidat** | Pilih 2–4 pegawai, tabel sisi-berdampingan: skor kinerja/potensial, match score (jika ada jabatan target sama), riwayat pendidikan/diklat/jabatan ringkas | Pilih kandidat, ekspor perbandingan | Admin Talenta, Pimpinan |

### 6.4 Master Data (Admin)

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Master Unit Organisasi** | Tree/tabel hierarki unit (kode, nama, induk, jenis, level eselon) | CRUD unit, atur hierarki | Super Admin |
| **Master Jabatan** | Tabel jabatan (kode, nama, unit, jenis, jenjang, eselon, status terisi/kosong) | CRUD jabatan, tandai status kosong | Super Admin, Admin Talenta |
| **Status Jabatan Kosong** | Daftar jabatan berstatus `KOSONG`, terutama jabatan strategis — highlight yang belum ada `jabatan_target`/talent pool terkait | Buat jabatan target dari sini | Admin Talenta, Pimpinan |
| **Data Hukuman Disiplin** | Tabel rekam jejak disiplin per pegawai (tingkat, tanggal SK, keterangan) — input manual karena belum ada sumber sistem resmi | Tambah/edit/hapus record, upload SK | Admin Talenta (akses terbatas, data sensitif) |

### 6.5 Rule Engine — Jabatan Target

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Daftar Jabatan Target** | List profil jabatan target (nama, jumlah jabatan anggota, jumlah kandidat eligible, status draft/aktif) | Buat jabatan target baru, duplikasi rubrik dari target lain | Admin Talenta, Super Admin |
| **Editor Jabatan Target** | Halaman paling kompleks — 3 tab: (1) *Jabatan Anggota*: pilih 1+ jabatan definitif yang termasuk target ini; (2) *Persyaratan*: syarat minimal (pendidikan, bidang ilmu, pengalaman) — replikasi format `KERANGKA TALENT POOL.md`; (3) *Rubrik Penilaian*: builder Komponen → Indikator (+ sub-indikator) → Kategori Skor, dengan validasi bobot komponen (sumbu X) harus total 100% dan bobot indikator *top-level* dalam 1 komponen harus total = bobot komponennya. Sub-indikator (mis. Lama/Keragaman/Substansi Jabatan di bawah "Nilai Pengalaman Jabatan") **tidak** ikut divalidasi terhadap total 100% karena `bobot_indikator`-nya NULL by design (digabung ke induk lewat rata-rata, bukan dijumlah — lihat metode agregasi yang masih perlu dikonfirmasi di §10) | Simpan draft, aktifkan rubrik, preview simulasi skor dengan data dummy | Admin Talenta, Super Admin |
| **Kandidat & Eligibility Check** | Untuk 1 jabatan target: daftar semua pegawai yang lolos syarat minimal, dengan breakdown match score (65/20/15) per kandidat, sudah terurut ranking | Recompute skor, tambahkan kandidat ke Talent Pool | Admin Talenta, Pimpinan (lihat saja) |

### 6.6 Talent Pool & Workflow Nominasi

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Talent Pool per Jabatan Target** | Daftar kandidat dalam pool untuk 1 jabatan target, dengan status masing-masing (Kandidat/Dinominasikan/Diverifikasi/Ditetapkan/Ditolak), ranking, match score | Ubah status, tetapkan sebagai suksesor final | Admin Talenta, Pimpinan (approve final) |
| **Form Pengajuan Nominasi** | Pilih kandidat dari talent pool, isi catatan pengajuan, submit atas nama unit | Submit nominasi | Pengelola Unit |
| **Verifikasi Nominasi** | Antrian nominasi masuk, detail kandidat & catatan unit, form keputusan (setuju/tolak/minta revisi + catatan) | Approve/reject/revisi | Admin Talenta |
| **Riwayat/Log Approval** | Timeline tahap persetujuan 1 nominasi (siapa, kapan, keputusan, catatan) | — (read-only) | Semua yang terlibat + Pimpinan |
| **Rencana Suksesi & Pengembangan** | Per entri talent pool berstatus Ditetapkan: rencana pengembangan (jenis: diklat/rotasi/mentoring/penugasan), target selesai, status progres | Tambah/update rencana, tandai selesai | Admin Talenta, Pimpinan (lihat/approve) |

### 6.7 Konsolidasi & Kualitas Data

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Konsolidasi & Sinkronisasi Data** | Status tiap sumber (eHRM/eNominasi/eKinerja): terakhir sync, jumlah baris, status sukses/gagal/sebagian; tombol trigger sync manual; riwayat `sync_log` | Trigger sync, lihat detail error | Super Admin |
| **Antrian Pembersihan Data** | Daftar anomali/data belum terpetakan: riwayat jabatan tanpa `jabatan_id`, format tanggal/golongan tidak konsisten, kandidat kasus seperti "Unit Kerja tertukar" (lihat `Data DTM - README.md`) | Petakan manual ke master, tandai "diverifikasi" | Admin Talenta |

### 6.8 Laporan & Ekspor

| Halaman | Isi / Konten | Aksi Kunci | Role |
|---|---|---|---|
| **Laporan Gap Analysis** | Kebutuhan pengembangan kompetensi per unit/jenjang, dibandingkan persyaratan jabatan target yang belum terpenuhi | Filter, ekspor PDF/Excel | Admin Talenta, Pimpinan |
| **Laporan Nominasi & Approval** | Rekap seluruh nominasi per periode: status, waktu proses, unit pengaju | Filter, ekspor | Admin Talenta, Pimpinan |
| **Audit Log Viewer** | Log semua perubahan data penting (siapa, kapan, entitas apa, sebelum/sesudah) — searchable | Filter by user/entitas/tanggal, ekspor | Super Admin |
| **Pusat Ekspor Laporan** | Halaman terpusat generate laporan (pilih jenis, filter, format PDF/Excel) | Generate & unduh | Admin Talenta, Pimpinan |

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
| **Manajemen Pengguna & Peran** | Daftar user internal, role, unit scope, status aktif | CRUD user, assign role | Super Admin |
| **Pengaturan Sistem** | Konfigurasi umum: tahun asesmen aktif, parameter notifikasi, dsb. | Update pengaturan | Super Admin |

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
6. **Metode SSO internal** — pakai akun lokal dulu (email/username+password) atau langsung integrasi ke sistem identitas Kementerian PU yang sudah ada?
7. **Metode agregasi 3 sub-indikator "Nilai Pengalaman Jabatan"** (Lama Jabatan, Keragaman Riwayat Jabatan, Substansi Riwayat Jabatan) — sama seperti `ERD.md` §5 poin 2, ini langsung memengaruhi implementasi halaman **Editor Jabatan Target** (§6.5) dan logika perhitungan **Hitung Match Score** (§5 langkah 4). Rata-rata sederhana dipakai sbg default di data contoh (`003_seed_jabatan_target_tambahan.sql`), tapi belum tentu ini yang dimaksud sumber dokumen.
8. **Riwayat hukuman disiplin yang sudah tidak aktif** (`hukuman_disiplin.status_aktif = 0`) — di data contoh, record berstatus tidak aktif diperlakukan TIDAK menurunkan skor indikator Integritas & Moralitas (dianggap sudah selesai/tidak relevan lagi). Aturan ini belum dituliskan secara eksplisit di `KERANGKA TALENT POOL.md` maupun `ERD.md` — perlu dikonfirmasi apakah ini kebijakan yang benar (mis. apakah ada batas waktu "kedaluwarsa" hukuman disiplin secara resmi) sebelum jadi logic tetap di rule engine.

---

*Setelah ERD & PRD ini diaudit dan poin §10 dikonfirmasi, tahap berikutnya (belum dilakukan di sini) adalah menyusun DDL/skema Prisma dari ERD, wireframe/UI detail per halaman di §6, dan spesifikasi API OpenAPI untuk §7.*
