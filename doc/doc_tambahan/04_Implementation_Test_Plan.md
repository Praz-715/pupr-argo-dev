# IMPLEMENTATION, MIGRATION & TEST PLAN
**SIMT DJBK - Modul Manajemen Talenta**

> **Konversi dari [`04_Implementation_Test_Plan.docx`](04_Implementation_Test_Plan.docx).** Isi mengikuti dokumen asli apa adanya —
> tidak diringkas, ditafsirkan, atau diselaraskan dengan dokumen lain di `doc/`.

- **Instansi** — Direktorat Jenderal Bina Konstruksi - Kementerian Pekerjaan Umum
- **Sistem** — SIMT DJBK - Modul Manajemen Talenta
- **Arsitektur** — Web Dashboard - Modular Monolith
- **Versi Dokumen** — 1.0 - Juli 2026

Dokumen kerja untuk pengembangan, validasi stakeholder, dan persiapan implementasi modul talenta. Seluruh rancangan mempertahankan pendekatan rule-based, bukan AI recommendation.

## 1. Strategi Implementasi
- Implementasi incremental di aplikasi existing.
- Mulai dari CSV import sebagai fallback, lalu aktifkan API per sumber.
- Canonical master dan mapping dikunci sebelum full import.
- Formula diujikan melalui simulation sebelum publish.
- Go-live memakai snapshot data dan rollback plan.

## 2. Work Breakdown Structure

| Stream | Aktivitas | Deliverable |
|---|---|---|
| Analysis | Audit data, source, formula, role | Gap register, data dictionary |
| Backend | Modul integration, master, rule, scoring, workflow | API dan job |
| Frontend | Dashboard, selector, mapping, candidate, ranking | Screen dan validation |
| Database | Schema, migration, seed master, index | Migration scripts |
| Integration | Adapter, auth, pagination, retry | Source connector |
| QA | Unit, integration, UAT, performance, security | Test evidence |
| Deployment | Config, backup, migration, rollback | Runbook |
| Training | Admin data, admin talenta, reviewer | Guide dan handover |

## 3. Migration Runbook
1. Backup aplikasi dan database existing.
1. Deploy schema baru dalam mode feature off.
1. Seed master referensi dan role.
1. Import master unit dan jabatan.
1. Jalankan mapping report dan resolve unmapped.
1. Import pegawai dan riwayat secara dry run.
1. Validasi jumlah, duplicate, dan completeness.
1. Merge canonical.
1. Import asesmen, kinerja, pendidikan, diklat, disiplin.
1. Jalankan baseline scoring simulation.
1. Stakeholder sign-off.
1. Aktifkan feature flag secara bertahap.

## 4. Test Matrix

| Test ID | Area | Skenario | Expected |
|---|---|---|---|
| UT-001 | Rule Engine | Operator GTE, IN, BETWEEN | Hasil sesuai input |
| UT-002 | Missing Policy | REVIEW_REQUIRED | Status review dan reason |
| IT-001 | Integration | Replay payload sama | Tidak duplicate |
| IT-002 | Mapping | Unknown position code | Masuk mapping queue |
| IT-003 | Merge | Conflict source priority | Nilai sesuai policy |
| FT-001 | Target Position | Publish bobot 95% | Ditolak |
| FT-002 | Eligibility | Mandatory experience gagal | NOT_ELIGIBLE |
| FT-003 | Scoring | Semua data lengkap | Total dan breakdown benar |
| FT-004 | Nomination | Submit tanpa kandidat | Ditolak |
| SEC-001 | Authorization | Viewer akses config | 403 |
| PERF-001 | Batch | 1.872 kandidat | Selesai sesuai target |
| UAT-001 | Explainability | Buka detail kandidat | Rule, weight, evidence tampil |

## 5. UAT Scenario

| No | Aktor | Skenario | Kriteria Lulus |
|---|---|---|---|
| 1 | Admin Data | Import data dari CSV | Batch tercatat dan issue terlihat |
| 2 | Admin Data | Resolve mapping jabatan | Record dapat merge ke canonical |
| 3 | Admin Talenta | Buat target jabatan | Requirement dan scoring dapat dipublish |
| 4 | Admin Talenta | Jalankan eligibility | Status dan alasan akurat |
| 5 | Admin Talenta | Jalankan scoring | Ranking dan breakdown tampil |
| 6 | Reviewer | Review kandidat | Evidence dan data gap terlihat |
| 7 | Reviewer | Approve/reject | Audit trail lengkap |
| 8 | Pimpinan | Buka dashboard | Angka konsisten dengan snapshot |
| 9 | Auditor | Telusuri hasil | Dapat melihat formula dan sumber evidence |

## 6. Cutover Checklist
- Backup verified dan restore point tersedia.
- Environment variable dan secret sudah dikonfigurasi.
- Migration database sukses.
- Master dan mapping coverage memenuhi threshold.
- Data reconciliation disetujui PIC.
- Scoring version resmi sudah published.
- User dan role telah diverifikasi.
- Scheduler/queue aktif dan health check normal.
- Monitoring dan log retention aktif.
- Rollback command dan PIC tersedia.

## 7. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| API belum tersedia | Sync otomatis tertunda | Gunakan CSV adapter dengan format contract yang sama |
| Data disiplin kosong | Integritas tidak akurat | Policy REVIEW dan label data incomplete |
| Riwayat jabatan tidak mapped | Pengalaman salah | Mapping queue dan blocking readiness |
| Formula berubah saat development | Rework dan hasil tidak konsisten | Versioning dan simulation |
| Source ID tidak stabil | Duplicate | Canonical ID dan configurable identity matching |
| Batch besar gagal | Data parsial | Chunk, retry, idempotency, checkpoint |
| Hasil dipertanyakan | Kepercayaan rendah | Evidence dan immutable snapshot |
