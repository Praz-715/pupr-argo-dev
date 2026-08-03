# SYSTEM REQUIREMENTS DOCUMENT (SRD)
**SIMT DJBK - Modular Monolith**

> **Konversi dari [`02_SRD_Modul_Talenta.docx`](02_SRD_Modul_Talenta.docx).** Isi mengikuti dokumen asli apa adanya —
> tidak diringkas, ditafsirkan, atau diselaraskan dengan dokumen lain di `doc/`.

- **Instansi** — Direktorat Jenderal Bina Konstruksi - Kementerian Pekerjaan Umum
- **Sistem** — SIMT DJBK - Modul Manajemen Talenta
- **Arsitektur** — Web Dashboard - Modular Monolith
- **Versi Dokumen** — 1.0 - Juli 2026

Dokumen kerja untuk pengembangan, validasi stakeholder, dan persiapan implementasi modul talenta. Seluruh rancangan mempertahankan pendekatan rule-based, bukan AI recommendation.

## 1. System Context
Sistem terdiri dari browser, reverse proxy, aplikasi modular monolith, worker/scheduler, relational database, penyimpanan file, dan konektor sistem sumber. Integrasi eksternal tidak mengakses tabel domain secara langsung.

## 2. Logical Package Structure
Contoh struktur implementasi yang dapat diterapkan pada Laravel, Java, .NET, atau framework monolith lain:

```
app/
  Modules/
    Identity/
    Integration/
    DataQuality/
    MasterData/
    TargetPosition/
    Eligibility/
    Scoring/
    Nomination/
    Reporting/
    Audit/
  Shared/
    Contracts/
    ValueObjects/
    Exceptions/
    Infrastructure/
  Http/
  Console/
  Jobs/
```

## 3. API Internal dan Endpoint Aplikasi

| Method | Endpoint | Fungsi |
|---|---|---|
| GET | /api/dashboard/summary | Ringkasan KPI dan data health |
| GET | /api/positions/targets | Daftar target jabatan |
| POST | /api/positions/targets | Membuat target jabatan |
| POST | /api/positions/targets/{id}/publish | Publish requirement |
| GET | /api/candidates?target_position_id= | Daftar kandidat |
| POST | /api/eligibility-runs | Menjalankan eligibility |
| POST | /api/scoring-runs | Menjalankan scoring |
| GET | /api/scoring-runs/{id}/results | Ranking dan breakdown |
| POST | /api/nominations | Membuat draft nominasi |
| POST | /api/nominations/{id}/submit | Submit workflow |
| POST | /api/integrations/{id}/sync | Menjalankan sync |
| GET | /api/data-quality/issues | Daftar issue |
| POST | /api/mappings/resolve | Resolve mapping |
| GET | /api/audit-logs | Audit trail |

## 4. Source Adapter Contract
Setiap adapter mengimplementasikan kontrak yang sama: testConnection, fetchPage, fetchChangedSince, transformToRawEnvelope, acknowledge bila diperlukan, dan expose source metadata. Adapter tidak melakukan business scoring.

| Komponen Envelope | Keterangan |
|---|---|
| source_code | Kode sumber terdaftar |
| entity_type | EMPLOYEE, POSITION, PERFORMANCE, ASSESSMENT, dll. |
| source_record_id | ID unik pada sumber |
| source_updated_at | Waktu perubahan pada sumber |
| payload | Payload asli JSON atau representasi row |
| checksum | Hash untuk idempotency |
| batch_id | Batch proses |
| received_at | Waktu diterima |

## 5. Processing Pipeline
1. Fetch atau upload data.
1. Simpan raw payload secara idempotent.
1. Transform ke staging sesuai field mapping version.
1. Jalankan validation rule.
1. Deteksi duplicate dan conflict.
1. Resolve code mapping ke canonical.
1. Tandai READY_TO_MERGE.
1. Merge dalam transaction.
1. Catat source entity link dan audit.
1. Refresh materialized summary bila diperlukan.

## 6. Rule Engine Design

| Elemen | Deskripsi |
|---|---|
| Rule Type | Mandatory gate atau weighted score |
| Data Path | Field canonical atau calculated fact |
| Operator | EQUALS, IN, GTE, BETWEEN, EXISTS, VALID_ON_DATE, DURATION_AT_LEAST |
| Expected Value | Nilai pembanding atau daftar nilai |
| Weight | Bobot kontribusi |
| Score Band | Rentang hasil ke skor |
| Missing Policy | ZERO, FAIL, REVIEW, EXCLUDE, RENORMALIZE |
| Evidence Resolver | Referensi record yang mendukung hasil |
| Effective Period | Masa berlaku rule |
| Version | Versi immutable setelah publish |

## 7. Non-Functional Requirements

| ID | Requirement | Target |
|---|---|---|
| NFR-SEC-01 | TLS dan secure session | Seluruh akses produksi HTTPS |
| NFR-SEC-02 | RBAC | Akses menu dan aksi berdasarkan permission |
| NFR-SEC-03 | Secret protection | Credential terenkripsi dan tidak tampil di log |
| NFR-AUD-01 | Auditability | Semua publish, mapping, scoring, dan keputusan tercatat |
| NFR-PERF-01 | Dashboard response | \<= 3 detik untuk data teragregasi normal |
| NFR-PERF-02 | Scoring batch | 1.872 kandidat per jabatan selesai dalam target operasional \<= 5 menit |
| NFR-REL-01 | Idempotent sync | Replay batch tidak menggandakan data |
| NFR-REL-02 | Transaction safety | Merge domain atomic per record/batch |
| NFR-OPS-01 | Observability | Log dengan correlation ID, batch ID, user ID |
| NFR-OPS-02 | Backup | Backup database harian dan restore test berkala |
| NFR-COMP-01 | Explainability | Skor dapat ditelusuri ke rule dan evidence |
| NFR-MNT-01 | Maintainability | Module boundary dan dependency direction terdokumentasi |

## 8. Security Controls
- Rate limiting untuk endpoint login, sync, scoring, dan export.
- CSRF protection untuk form web dan token-based auth untuk API.
- Credential sumber disimpan terenkripsi.
- Upload file dibatasi tipe, ukuran, dan dipindai.
- Export mengacu pada permission dan masking data sensitif.
- Audit log append-only secara aplikasi.
- Tidak ada dynamic code execution pada formula; gunakan operator whitelist.

## 9. Error Handling

| Kode | Situasi | Respons |
|---|---|---|
| INT-001 | Koneksi sumber gagal | Batch FAILED/PARTIAL, retry policy, detail aman |
| MAP-001 | Kode referensi belum dipetakan | NEEDS_MAPPING |
| VAL-001 | Field wajib tidak tersedia | INVALID atau REVIEW sesuai konfigurasi |
| SCR-001 | Total bobot tidak 100% | Publish ditolak |
| SCR-002 | Formula version tidak aktif | Run ditolak |
| NOM-001 | Hasil scoring kedaluwarsa | Minta rerun atau explicit override |
| AUTH-001 | Tidak punya permission | 403 dan audit security event |

## 10. Deployment dan Konfigurasi

| Komponen | Konfigurasi |
|---|---|
| Web/App | APP_ENV, APP_URL, session, cache, queue |
| Database | Host, port, schema, pool, SSL |
| Queue | Driver, retry, timeout, failed job store |
| Scheduler | Sync source, refresh dashboard, expiry check |
| Storage | Import, export, evidence retention |
| Integration | Per-source endpoint, auth, timeout, pagination |
| Feature Flags | Nomination, API sync, simulation, export |
| Logging | Level, retention, masking, correlation |
