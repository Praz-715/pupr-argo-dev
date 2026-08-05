# Disposisi Paket doc_tambahan terhadap Sistem yang Sudah Jalan

Memo keputusan: **mana yang diadopsi, diadaptasi, ditolak, atau ditunda** dari paket [doc_tambahan](.) terhadap `doc/PRD.md`, `doc/ERD.md`, dan kode Fase 0–8 yang sudah berjalan.

**Kedudukan dokumen.** doc_tambahan diperlakukan sebagai **peta jalan**, bukan cetak biru pengganti — `PRD.md` & `ERD.md` tetap sumber kebenaran (CLAUDE.md). Alasannya bukan keengganan: paket ini v1.0 Juli 2026 dan menggambarkan sistem yang **belum dibangun**, sementara Fase 0–8 sudah berjalan dengan 422 uji unit, 268 pemeriksaan smoke, dan data dev yang konsisten. Membongkarnya untuk mencocokkan diagram akan membuang bukti yang sudah ada demi rancangan yang belum punya bukti.

Yang **tidak** ditawar: setiap konsep di paket ini yang menutup lubang nyata diambil — dengan alasan tertulis, satu per satu.

---

## 1. Ringkasan disposisi

| Konsep di doc_tambahan | Keadaan sekarang | Disposisi |
|---|---|---|
| Formula 65/20/15 + Kualifikasi 4×5% | Terpasang, dikunci uji | **Sudah sama** |
| Eligibility dipisah dari scoring | Terpasang (`evaluasiKelayakan` → `match_score.eligible`) | **Sudah sama** |
| Tiga hasil gate: `ELIGIBLE`/`NOT_ELIGIBLE`/`REVIEW_REQUIRED` | Terpasang sebagai `TERPENUHI`/`TIDAK_TERPENUHI`/`PERLU_VERIFIKASI_MANUAL` | **Sudah sama**, beda nama |
| Snapshot hasil (formula + data + evidence) | `match_score.rubrik_snapshot` + `match_score_detail` | **Sebagian** — lihat §2.1 |
| Explainability sampai indikator + bobot | Terpasang (U-3, halaman Rincian Skor) | **Sudah sama** |
| Audit trail immutable | Terpasang, tiga pintu tulis | **Sudah sama** |
| Jabatan dipilih dari master canonical | Terpasang (`jabatan_target_anggota` → `jabatan`) | **Sudah sama** |
| **Requirement/Scoring version** DRAFT→PUBLISHED→RETIRED | Rubrik disunting **langsung**; hanya status jabatan target yang berdaur | **ADOPSI** — §2.1 |
| **`missing_policy` per rule** (5 nilai) | Satu perilaku tetap: fallback kategori terdekat + `perluReview` | **ADAPTASI** — §2.2 |
| **Mapping queue memblokir merge** | Antrian Pembersihan **melaporkan**, tidak memblokir | **ADAPTASI** — §2.3 |
| Raw intake + staging (`raw_source_payloads`, `stg_*`) | Tidak ada; `lib/importer` menormalisasi langsung | **TUNDA** — §3.1 |
| Source registry + adapter contract + scheduler | `sync_log` ada sebagai catatan; mekanismenya belum diputuskan | **TUNDA** — §3.1 |
| Conflict resolution lintas sumber (priority per field) | Belum relevan — baru satu jalur data | **TUNDA** — §3.1 |
| Operator whitelist (`GTE`, `BETWEEN`, `DURATION_AT_LEAST`, …) | Ambang `ambang_min`/`ambang_max` + `kunci_sistem` di `lib/penilaian.ts` | **TOLAK** — §4.1 |
| Modular monolith `Modules/<Domain>/` | Pembagian per lapisan (`lib/scoring`/`kueri`/`aksi`) | **TOLAK** — §4.2 |
| Feature flags | Tidak ada | **TOLAK** — §4.3 |
| Materialized summary untuk dashboard | Tidak ada; 54 kueri = 390 ms terukur | **TOLAK** — §4.3 |
| Daftar 6 aktor (tanpa Pengelola Unit) | 5 peran, Pengelola Unit jadi dasar batas unit | **KEPUTUSAN TERBUKA** — §5 |
| Kandidat FAIL masuk ranking (§7) vs tidak (§3) | Masuk ranking, sesuai PRD §6.5 | **KEPUTUSAN TERBUKA** — §5 |

---

## 2. Yang diambil

### 2.1 Requirement & Scoring version — nilai tertinggi, biaya paling terkendali

**Lubang nyata yang ditutupnya.** Rubrik disunting langsung, tanpa salinan draft (keputusan Fase 5, dan itu benar untuk kemudahan menyusun). Yang membekukan bobot hanyalah `match_score.rubrik_snapshot`, **per perhitungan**. Akibatnya: skor kandidat yang sudah **DITETAPKAN** sebagai suksesor bisa tidak lagi bisa dilahirkan ulang begitu seseorang menyunting bobotnya, dan tidak ada satu pun objek yang bisa disebut "rubrik versi yang dipakai saat keputusan itu diambil". `rubrik_snapshot` menyelamatkan angkanya, bukan **aturannya** — ia tidak memuat ambang kategori, jadi "kenapa indikator ini dapat 80" tidak bisa dijawab setelah ambangnya berubah.

Ini bukan kekhawatiran teoretis: `talent_pool.status = DITETAPKAN` adalah keputusan kepegawaian atas nama orang, dan §6.6 sudah menuntut jejaknya utuh.

**Yang diadopsi:** siklus `DRAFT → PUBLISHED → RETIRED` untuk rubrik, dengan published bersifat immutable. Yang **tidak** diadopsi: memecahnya jadi `requirement_versions` + `scoring_versions` + `scoring_models` terpisah — struktur rubrik di sini sudah berjenjang (Komponen→Indikator→Kategori), jadi satu versi per jabatan target sudah cukup dan tidak memaksa migrasi tabel besar.

**Konsekuensi yang harus diterima:** menyunting rubrik aktif jadi dua langkah (buat versi baru → publikasikan). Itu memang lebih lambat, dan itu memang gunanya. Editor tetap bisa dipakai bebas selama versinya DRAFT.

**Prasyarat:** `doc/sql/013` (kolom versi + status), lalu `lib/scoring/validasi.ts` menolak publikasi bercacat (mesinnya sudah ada — aktivasi sudah diblokir pada GALAT sejak Fase 5).

### 2.2 `missing_policy` per rule — diadaptasi, tidak disalin

Mesin rubrik sekarang punya **satu** perilaku untuk nilai yang tidak ketemu: ambil kategori terdekat di bawah + tandai `perluReview` (phase.md §2.8b). Itu pilihan sadar dan tetap benar sebagai *default* — tapi doc_tambahan benar bahwa satu perilaku tidak cukup untuk semua indikator.

Contoh konkret dari data yang ada: **Substansi Riwayat Jabatan** rata-rata 3 dari 100 karena bernilai 0 tanpa riwayat Plt/Plh (temuan Gap Analysis Fase 8). Nilai 0 di situ **bukan** "buruk", melainkan "tidak ada datanya" — dan keduanya sekarang tidak bisa dibedakan, sehingga rata-rata unit ikut tertarik ke bawah oleh ketiadaan data.

**Yang diadopsi:** dua nilai dari lima — `REVIEW` (perilaku sekarang) dan `EXCLUDE` (indikator dikeluarkan dari rata-rata, bobotnya dinormalisasi ulang ke saudaranya). Itu yang menjawab kasus di atas. `ZERO`, `FAIL`, dan `RENORMALIZE` ditunda sampai ada kasus nyatanya — `RENORMALIZE` khususnya nyaris sama dengan `EXCLUDE` pada mesin yang sudah memakai `Σ(nilai×bobot)/Σ(bobot)`.

### 2.3 Mapping queue sebagai penghalang — diadaptasi ke arah yang bisa dipertanggungjawabkan

Antrian Pembersihan sekarang **melaporkan** temuan, dihitung dari keadaan DB (keputusan Fase 4: catatan importer jadi basi begitu seseorang membetulkan barisnya lewat jalur lain). Itu tetap benar untuk halamannya.

Yang benar dari doc_tambahan: data yang **belum terpetakan tidak boleh masuk diam-diam** ke master. Bedanya, di sini belum ada jalur impor produksi yang bisa memblokir apa pun — jadi yang diadopsi sekarang cukup **satu penanda tegas**: baris `riwayat_jabatan` tanpa `jabatan_id` sudah ditandai "belum terstruktur" dan indikator yang bergantung padanya jatuh ke `PERLU_VERIFIKASI_MANUAL`. Penghalang merge yang sebenarnya menyusul bersama §3.1.

---

## 3. Yang ditunda

### 3.1 Seluruh lapisan integrasi (raw intake, staging, source registry, adapter, conflict resolution)

Ini bagian terbesar paket, dan **bukan** ditolak — ditunda karena **prasyaratnya belum ada jawabannya**: PRD §10.2 masih terbuka soal sumber produksi (batch berkas vs API/webhook). Membangun `integration_sources` + `integration_endpoints` + adapter contract sebelum tahu apakah eHRM/eNominasi punya API keluar berarti merancang konektor untuk protokol yang belum diketahui.

Ini juga sudah jadi alasan tertulis mengapa tombol sinkronisasi manual sengaja tidak dipasang (Fase 4): tombol yang memanggil sumber yang belum ada **selalu gagal**, dan pengguna menyimpulkan sinkronisasinya rusak.

**Pemicu untuk mulai:** §10.2 dijawab. Begitu dijawab, urutan di doc_tambahan (`raw → staging → validation → mapping → merge`) layak diikuti apa adanya — itu bagian paket ini yang paling matang, dan `lib/importer` sudah mengerjakan normalisasinya, tinggal diberi tempat menampung.

---

## 4. Yang ditolak, dengan alasan

### 4.1 Operator whitelist di rule engine

doc_tambahan mengusulkan `operator` bernilai `EQUALS`/`IN`/`GTE`/`BETWEEN`/`EXISTS`/`VALID_ON_DATE`/`DURATION_AT_LEAST` pada tiap rule. Model di sini berbeda dan **sudah setara untuk kasus yang ada**: ambang numerik ditangani `ambang_min`/`ambang_max` (mencakup `GTE` & `BETWEEN`), pencocokan kategori menangani `EQUALS`/`IN`, dan yang butuh perhitungan (`DURATION_AT_LEAST` untuk Lama Jabatan, `EXISTS` untuk riwayat Plt/Plh) dikerjakan `lib/penilaian.ts` lewat `kunci_sistem` — di mana ia bisa diuji sebagai fungsi murni.

Memindahkannya ke operator berbasis data berarti menaruh **logika** di baris tabel. Itu terdengar lebih fleksibel dan berakibat: rumus jadi tidak bisa diuji unit, dan `doc/KERANGKA TALENT POOL.md` sebagai otoritas rubrik kehilangan padanan kodenya yang sekarang satu-ke-satu. Ditolak.

### 4.2 Batas modul `Modules/<Domain>/`

Keduanya monolith modular; yang berbeda arah garisnya. Pembagian sekarang **per lapisan** (`lib/scoring` rumus murni · `lib/kueri` baca · `lib/aksi` tulis) dan batasnya **ditegakkan mesin**: `server-only` menghalangi kueri terimpor klien, `lib/scoring` bebas DB sehingga bisa diuji tanpa database, dan satu pintu tulis membuat mutasi tanpa audit ketahuan lewat `grep`.

Pembagian per domain memindahkan batas itu jadi konvensi direktori yang tidak ditegakkan apa pun. Menukar batas yang dijaga kompiler dengan batas yang dijaga niat adalah kemunduran. Ditolak — dan ini bukan soal selera: ketiga invarian di atas sudah menangkap cacat nyata di sesi-sesi sebelumnya.

### 4.3 Feature flags & materialized summary

**Feature flags** berguna kalau ada rilis bertahap ke banyak pengguna. Aplikasi ini internal, satu instansi, dan fase-nya dikendalikan `FASE_TERSEDIA` di `lib/navigasi.ts` — satu angka yang sudah melakukan pekerjaan yang sama tanpa tabel.

**Materialized summary** menjawab dashboard lambat. Terukur: 54 kueri = **390 ms** total di dev, **~670 ms** pada 2.000 pegawai, tidak satu pun melewati ambang 150 ms. Menambah lapisan cache berarti menambah kemungkinan angka dashboard **basi** — kelas bug yang jauh lebih mahal daripada 390 ms. Ditolak sampai ada pengukuran yang menuntutnya.

---

## 5. Dua tabrakan: keputusan terbuka, bukan tunggakan

Keduanya **tidak** kuputuskan sendiri karena keduanya mengubah siapa boleh apa. Dicatat sebagai keputusan terbuka bertanda ⚙️ di [`PRD.md` §10](../PRD.md) & [`phase.md` §9](../../phase.md) — pola yang sama dengan 12 keputusan terbuka lain, lengkap dengan default yang sekarang berjalan.

1. **Daftar aktor.** doc_tambahan memakai 6 aktor termasuk *Admin Data* & *Pejabat Reviewer*, tetapi **tidak memuat Pengelola Unit** — padahal peran itu dasar seluruh pembatasan data per unit (`lib/lingkup.ts`, ditegakkan di SQL, diuji smoke). Default yang berjalan: 5 peran seperti sekarang, dan *Admin Data*/*Pejabat Reviewer* dibaca sebagai penamaan lain dari Admin Talenta & Pimpinan.

2. **Kandidat FAIL: masuk ranking atau tidak.** Blueprint §3 menulis "kandidat tidak langsung diranking sebelum lolos syarat wajib", tetapi diagram §7 di dokumen yang sama menggambar jalur FAIL **tetap** menuju Ranking & Gap Analysis. Default yang berjalan: **masuk**, sesuai diagram §7 dan PRD §6.5 ("termasuk yang tidak lolos syarat, karena skornya tetap berguna sebagai pembanding"). Dokumen sumbernya perlu didamaikan sendiri lebih dulu.

---

## 6. Urutan kerja yang disarankan

| # | Pekerjaan | Prasyarat | Kenapa urutan ini |
|---|---|---|---|
| 1 | **Versioning rubrik** (§2.1) | tidak ada | Menutup lubang yang sudah nyata sekarang, dan tidak menunggu keputusan siapa pun |
| 2 | **`missing_policy`: REVIEW + EXCLUDE** (§2.2) | tidak ada | Membetulkan angka Gap Analysis yang sudah terlihat menyesatkan (0 = tidak ada data, bukan buruk) |
| 3 | Damaikan dua tabrakan (§5) | keputusan pemilik proses | Memblokir apa pun yang menyentuh peran atau halaman Kandidat |
| 4 | Lapisan integrasi (§3.1) | PRD §10.2 dijawab | Paling besar, dan paling sia-sia kalau dimulai sebelum sumbernya diketahui |

Fase 9 (`/api/v1`) **tidak** tergantung salah satu pun di atas dan bisa jalan paralel.
