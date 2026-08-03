# BLUEPRINT ARSITEKTUR & PENGEMBANGAN
**SIMT DJBK - Modul Manajemen Talenta**

> **Konversi dari [`00_Blueprint_Arsitektur_Talenta.docx`](00_Blueprint_Arsitektur_Talenta.docx).** Isi mengikuti dokumen asli apa adanya —
> tidak diringkas, ditafsirkan, atau diselaraskan dengan dokumen lain di `doc/`. Gambar §4 & §7 diekstrak ke [`media/`](media/) — keduanya sama dengan dua tangkapan layar WhatsApp di folder ini.

- **Instansi** — Direktorat Jenderal Bina Konstruksi - Kementerian Pekerjaan Umum
- **Sistem** — SIMT DJBK - Modul Manajemen Talenta
- **Arsitektur** — Web Dashboard - Modular Monolith
- **Versi Dokumen** — 1.0 - Juli 2026

Dokumen kerja untuk pengembangan, validasi stakeholder, dan persiapan implementasi modul talenta. Seluruh rancangan mempertahankan pendekatan rule-based, bukan AI recommendation.

## 1. Ringkasan Eksekutif
Modul Manajemen Talenta dikembangkan sebagai modul web pada aplikasi existing dengan pola modular monolith. Arsitektur memisahkan domain bisnis secara tegas di dalam satu deployment dan satu basis kode, sehingga tetap realistis untuk ruang lingkup MVP namun tidak mengunci sistem pada satu API atau satu struktur data sumber.

> Prinsip Utama
> Sistem sumber boleh diganti, tetapi data canonical, rule jabatan, formula scoring, histori hasil, dan pengalaman pengguna tetap stabil.

## 2. Kondisi Dasar dan Gap

| Area | Kondisi Saat Ini | Kebutuhan Blueprint |
|---|---|---|
| Dashboard | KPI, 9-box, jabatan strategis kosong, dan data health sudah terlihat | Tambahkan filter global, source health, readiness per jabatan, dan penjelasan formula |
| Data Pegawai | Data sampel dan sebagian data operasional tersedia | Canonical employee, source link, deduplication, completeness score |
| Jabatan Target | Sudah ada konsep target aktif | Selector jabatan, requirement version, kebutuhan posisi, periode, status |
| Kualifikasi | Komponen 20% belum lengkap | Rule pendidikan, bidang ilmu, diklat, pengalaman jabatan |
| Integritas | Data disiplin sangat terbatas | Policy data kosong, evidence, validitas masa hukuman |
| Integrasi | Masih bergantung proses manual | Source registry, adapter, raw intake, staging, mapping |
| Nominasi | Belum lengkap | Draft, review, approval, rejection, revision, audit trail |

## 3. Sasaran Arsitektur
- Satu aplikasi modular monolith dengan modul bisnis terpisah dan kontrak internal yang jelas.
- Semua sumber data masuk melalui integration gateway dan tabel tampungan sebelum merge.
- Master jabatan canonical menjadi pusat mapping seluruh kode/nama jabatan eksternal.
- Persyaratan jabatan dan formula perhitungan disimpan sebagai konfigurasi berversi.
- Eligibility dipisahkan dari match score agar kandidat tidak langsung diranking sebelum lolos syarat wajib.
- Setiap hasil perhitungan menyimpan snapshot formula, data, evidence, dan alasan hasil.

## 4. Gambar Arsitektur
![gambar](media/image1.png)

## 5. Struktur Modul Monolith

| Modul | Tanggung Jawab | Interface Internal |
|---|---|---|
| Identity & Access | Login, role, permission, session, access policy | AuthService, PermissionService |
| Integration | Source registry, adapter, sync, raw payload, batch log | IntegrationService |
| Data Quality | Validation, mapping, dedup, quarantine, merge | DataQualityService |
| Master Data | Pegawai, jabatan, unit, referensi, source crosswalk | MasterDataService |
| Target Position | Target jabatan, requirement set, periode, vacancy | TargetPositionService |
| Eligibility | Hard gate dan review required | EligibilityService |
| Scoring | Komponen, bobot, rule, simulation, snapshot | ScoringService |
| Nomination | Draft kandidat, approval, revision, decision | NominationService |
| Dashboard & Report | KPI, 9-box, ranking, export | ReportingService |
| Audit & Configuration | Audit log, feature flag, system setting | AuditService, ConfigService |

## 6. Deployment Blueprint

| Layer | Komponen | Catatan |
|---|---|---|
| Client | Browser desktop/responsive | Tanpa mobile app khusus |
| Reverse Proxy | Nginx/Apache existing | TLS, routing, security header |
| Application | Modular monolith | Satu deployment; modul dipisah pada source code |
| Worker | Queue/scheduler | Sync API, import, scoring batch, export |
| Database | Relational DB | Schema per domain atau prefix tabel |
| Object Storage | File import/export/evidence | Opsional local secured storage atau S3-compatible |
| Observability | Application log, audit, job log | Correlation ID per request dan sync batch |

## 7. Alur Matching Jabatan
![gambar](media/image2.png)

## 8. Formula Dasar dan Versioning
Formula baseline yang digunakan pada rancangan: 65% Potensi & Kompetensi, 20% Kualifikasi, dan 15% Integritas. Kualifikasi dibagi menjadi Pendidikan 5%, Bidang Ilmu 5%, Diklat 5%, dan Pengalaman Jabatan 5%. Nilai ini tidak ditanam permanen di kode; seluruh bobot, rule, band nilai, dan kebijakan data kosong disimpan dalam scoring model version.

| Objek Versioning | Contoh | Dampak |
|---|---|---|
| Requirement Version | Jabatan A v1.2 | Syarat jabatan dapat berubah tanpa menghapus histori |
| Scoring Model Version | Talent Match 2026 v1 | Bobot dan formula dapat dibandingkan |
| Mapping Version | eHRM Position Mapping v3 | Perubahan mapping dapat diaudit |
| Result Snapshot | Run 31-07-2026 14:30 | Hasil lama tetap dapat direproduksi |

## 9. Roadmap Implementasi 10 Minggu

| Minggu | Fokus | Output |
|---|---|---|
| 1 | Lock scope dan audit data | Data inventory, gap register, keputusan canonical key |
| 2 | Master canonical | Pegawai, unit, jabatan, referensi, source crosswalk |
| 3 | Integration foundation | Source registry, raw intake, sync batch, CSV import |
| 4 | Staging dan data quality | Validation issue, mapping UI, merge process |
| 5 | Target position | Selector, requirement set, versioning, readiness check |
| 6 | Eligibility engine | Hard gate, review policy, evidence |
| 7 | Scoring engine | Komponen, bobot, band, formula simulation |
| 8 | Ranking dan nominasi | Ranking, gap analysis, draft nomination |
| 9 | Dashboard dan laporan | Source health, readiness, export, audit explanation |
| 10 | UAT dan rollout | Test, training, migration rehearsal, release |

## 10. Definition of Done
- Jabatan target dapat dipilih dan memiliki requirement version aktif.
- Data dari minimal CSV dan satu API dapat masuk melalui pipeline yang sama.
- Data unmapped tidak masuk diam-diam ke master dan muncul pada data quality queue.
- Hasil eligibility menampilkan alasan PASS, FAIL, atau REVIEW_REQUIRED.
- Match score menampilkan breakdown per komponen, bobot, evidence, dan formula version.
- Hasil nominasi memiliki audit trail dan tidak berubah ketika formula baru diterbitkan.
