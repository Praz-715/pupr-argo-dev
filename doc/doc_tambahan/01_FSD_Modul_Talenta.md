# FUNCTIONAL SPECIFICATION DOCUMENT (FSD)
**SIMT DJBK - Modul Manajemen Talenta**

> **Konversi dari [`01_FSD_Modul_Talenta.docx`](01_FSD_Modul_Talenta.docx).** Isi mengikuti dokumen asli apa adanya —
> tidak diringkas, ditafsirkan, atau diselaraskan dengan dokumen lain di `doc/`.

- **Instansi** — Direktorat Jenderal Bina Konstruksi - Kementerian Pekerjaan Umum
- **Sistem** — SIMT DJBK - Modul Manajemen Talenta
- **Arsitektur** — Web Dashboard - Modular Monolith
- **Versi Dokumen** — 1.0 - Juli 2026

Dokumen kerja untuk pengembangan, validasi stakeholder, dan persiapan implementasi modul talenta. Seluruh rancangan mempertahankan pendekatan rule-based, bukan AI recommendation.

## 1. Tujuan dan Ruang Lingkup
FSD mendefinisikan perilaku sistem dari perspektif pengguna. Scope mencakup dashboard, pengelolaan jabatan target, integrasi data, data quality, kandidat dan eligibility, scoring, ranking, nominasi, master data, laporan, dan administrasi.

## 2. Aktor dan Hak Akses

| Aktor | Hak Utama |
|---|---|
| Super Admin | Seluruh konfigurasi, source, master, user, formula, audit |
| Admin Talenta | Target jabatan, requirement, kandidat, scoring, nominasi, laporan |
| Admin Data | Import, mapping, validasi, merge, koreksi staging |
| Pejabat Reviewer | Review kandidat, catatan, persetujuan/penolakan |
| Pimpinan | Dashboard, ranking, laporan, keputusan sesuai kewenangan |
| Auditor/Viewer | Akses baca, histori, evidence, audit trail |

## 3. Daftar Menu Frontend

| Kelompok | Menu | Fungsi |
|---|---|---|
| Utama | Dashboard | KPI, 9-box, jabatan kosong, readiness, source health |
| Talenta | Jabatan Target | CRUD target, kebutuhan, requirement, scoring model |
| Talenta | Kandidat & Eligibility | Selector jabatan, gate result, candidate list |
| Talenta | Ranking & Match | Breakdown score, gap, compare, simulation |
| Nominasi | Draft Nominasi | Pilih kandidat, justification, submit |
| Nominasi | Persetujuan | Review, approve, reject, revise |
| Data | Integration Center | Source, endpoint, schedule, test connection |
| Data | Data Quality | Unmapped, invalid, duplicate, conflict |
| Administrasi | Master Data | Unit, jabatan, pendidikan, bidang ilmu, diklat, disiplin |
| Administrasi | Formula & Rule | Scoring model, version, rule, band, policy |
| Laporan | Laporan Nominasi | PDF/Excel, snapshot dan audit |
| Sistem | User & Audit | User, role, permission, log |

## 4. Functional Requirements

| ID | Fungsi | Deskripsi | Prioritas |
|---|---|---|---|
| FR-DASH-01 | Filter global dashboard | Sistem menyediakan filter periode, unit, job family, level jabatan, tahun asesmen, dan snapshot. | Must |
| FR-DASH-02 | Data health | Sistem menampilkan completeness dan issue count per entitas. | Must |
| FR-TP-01 | Pilih jabatan canonical | Admin memilih jabatan dari master canonical, bukan input bebas. | Must |
| FR-TP-02 | Requirement version | Sistem menyimpan draft/published/retired version per target. | Must |
| FR-TP-03 | Readiness check | Target hanya dapat diaktifkan bila bobot 100%, syarat wajib lengkap, dan sumber data tersedia. | Must |
| FR-INT-01 | Source registry | Admin mendaftarkan sumber REST, SOAP, DB, atau CSV. | Must |
| FR-INT-02 | Dry run sync | Sistem menampilkan preview record valid, invalid, duplicate, dan unmapped. | Must |
| FR-DQ-01 | Mapping queue | Admin memetakan kode jabatan/unit sumber ke canonical. | Must |
| FR-DQ-02 | Merge trace | Setiap merge menyimpan source record dan batch asal. | Must |
| FR-ELG-01 | Eligibility gate | Sistem menghasilkan ELIGIBLE, NOT_ELIGIBLE, atau REVIEW_REQUIRED. | Must |
| FR-ELG-02 | Reason code | Setiap hasil gate memiliki alasan dan evidence. | Must |
| FR-SCR-01 | Dynamic scoring | Formula dibaca dari published scoring model version. | Must |
| FR-SCR-02 | Missing data policy | Setiap rule mendukung ZERO, FAIL, REVIEW, EXCLUDE, atau RENORMALIZE. | Must |
| FR-SCR-03 | Simulation | Admin dapat simulasi formula tanpa mengubah hasil resmi. | Must |
| FR-NOM-01 | Draft nomination | Kandidat dipilih dari hasil run yang valid. | Must |
| FR-NOM-02 | Approval flow | Reviewer dapat approve, reject, atau request revision. | Must |
| FR-AUD-01 | Immutable audit | Perubahan rule, mapping, target, dan keputusan dicatat. | Must |
| FR-REP-01 | Explainable report | Laporan menyertakan formula version, score breakdown, dan issue data. | Must |

## 5. Detail Screen: Jabatan Target

| Bagian | Field/Komponen | Validasi |
|---|---|---|
| Identitas | Jabatan canonical, unit, job family, level, kelas, lokasi | Jabatan dan unit wajib |
| Kebutuhan | Status kosong/proyeksi/suksesi, jumlah kebutuhan, periode | Tanggal mulai \<= selesai |
| Requirement | Pendidikan, bidang ilmu, pengalaman, diklat, kompetensi, disiplin | Setiap rule punya operator dan policy |
| Scoring | Scoring model, version, threshold, tie breaker | Bobot published harus 100% |
| Status | Draft, Active, Closed, Archived | Active wajib lolos readiness check |

## 6. Detail Screen: Kandidat & Eligibility
1. Pilih periode talenta.
1. Pilih unit atau ruang lingkup kandidat.
1. Pilih jabatan dituju.
1. Sistem memuat requirement dan scoring version.
1. Sistem menjalankan pemeriksaan data readiness.
1. Sistem menjalankan eligibility gate.
1. Pengguna memfilter PASS, FAIL, atau REVIEW.
1. Pengguna membuka alasan dan evidence setiap kandidat.
1. Pengguna menjalankan scoring atau memasukkan kandidat ke draft nominasi.

## 7. Status dan Workflow

| Objek | Status |
|---|---|
| Sync Batch | QUEUED, RUNNING, PARTIAL, SUCCESS, FAILED, CANCELLED |
| Staging Record | RECEIVED, VALIDATED, NEEDS_MAPPING, INVALID, DUPLICATE, READY_TO_MERGE, MERGED |
| Requirement Version | DRAFT, PUBLISHED, RETIRED |
| Scoring Version | DRAFT, PUBLISHED, RETIRED |
| Eligibility Result | ELIGIBLE, NOT_ELIGIBLE, REVIEW_REQUIRED |
| Nomination | DRAFT, SUBMITTED, IN_REVIEW, REVISION, APPROVED, REJECTED, CANCELLED |

## 8. Acceptance Criteria Utama

| Skenario | Given | When | Then |
|---|---|---|---|
| Selector jabatan | Master jabatan aktif tersedia | Admin membuka kandidat | Hanya jabatan canonical aktif yang tampil |
| Unmapped source | Kode jabatan sumber tidak dikenal | Sync dijalankan | Record masuk NEEDS_MAPPING dan tidak merge |
| Rule mandatory gagal | Pengalaman minimum tidak terpenuhi | Eligibility dijalankan | Status NOT_ELIGIBLE dan alasan tampil |
| Data belum lengkap | Tanggal riwayat kosong dan policy REVIEW | Eligibility dijalankan | Status REVIEW_REQUIRED |
| Formula berubah | Versi baru dipublish | Hasil lama dibuka | Hasil lama tetap memakai versi sebelumnya |
| Nomination audit | Reviewer menyetujui | Keputusan disimpan | User, waktu, catatan, dan snapshot tercatat |
