# DATA REQUIREMENTS & DATABASE DESIGN (DRD)
**SIMT DJBK - Modul Manajemen Talenta**

> **Konversi dari [`03_DRD_Modul_Talenta.docx`](03_DRD_Modul_Talenta.docx).** Isi mengikuti dokumen asli apa adanya —
> tidak diringkas, ditafsirkan, atau diselaraskan dengan dokumen lain di `doc/`.

- **Instansi** — Direktorat Jenderal Bina Konstruksi - Kementerian Pekerjaan Umum
- **Sistem** — SIMT DJBK - Modul Manajemen Talenta
- **Arsitektur** — Web Dashboard - Modular Monolith
- **Versi Dokumen** — 1.0 - Juli 2026

Dokumen kerja untuk pengembangan, validasi stakeholder, dan persiapan implementasi modul talenta. Seluruh rancangan mempertahankan pendekatan rule-based, bukan AI recommendation.

## 1. Prinsip Data
- Pisahkan raw, staging, canonical, transaction, result snapshot, dan audit.
- Gunakan UUID/internal ID untuk canonical; jangan pakai ID sumber sebagai primary key.
- Simpan source link untuk traceability.
- Published configuration immutable; perubahan membuat version baru.
- Soft delete hanya untuk master; hasil keputusan dan audit tidak dihapus normal.

## 2. Domain dan Tabel

| Domain | Tabel Utama |
|---|---|
| Integration | integration_sources, integration_endpoints, integration_field_mappings, integration_code_mappings, integration_sync_batches, raw_source_payloads |
| Staging | stg_employees, stg_positions, stg_org_units, stg_position_histories, stg_assessments, stg_performances, stg_validation_issues |
| Canonical Master | employees, positions, org_units, job_families, job_levels, education_levels, study_fields, training_types, discipline_types |
| Employee Facts | employee_position_histories, employee_educations, employee_trainings, employee_certifications, employee_assessments, employee_performances, employee_disciplinary_records |
| Target & Rules | target_positions, requirement_sets, requirement_versions, requirement_rules, scoring_models, scoring_versions, scoring_components, scoring_rules, score_bands |
| Execution | eligibility_runs, eligibility_results, scoring_runs, scoring_results, scoring_result_components, result_evidences |
| Workflow | nominations, nomination_candidates, nomination_approvals, nomination_comments |
| System | users, roles, permissions, audit_logs, system_settings, feature_flags |

## 3. Struktur Tabel Kunci

### integration_sources

| Field | Type | Catatan |
|---|---|---|
| id | uuid | PK |
| code | varchar | unique |
| name | varchar |  |
| type | enum | REST/SOAP/DB/CSV |
| auth_type | enum |  |
| priority | int | source precedence |
| status | enum | DRAFT/ACTIVE/SUSPENDED |
| config_encrypted | text | secret config |
| effective_from/to | datetime |  |

### raw_source_payloads

| Field | Type | Catatan |
|---|---|---|
| id | uuid | PK |
| source_id | uuid | FK |
| entity_type | varchar |  |
| source_record_id | varchar |  |
| batch_id | uuid | FK |
| payload_json | json | immutable raw |
| payload_hash | varchar | idempotency |
| source_updated_at | datetime |  |
| processing_status | enum |  |
| received_at | datetime |  |

### positions

| Field | Type | Catatan |
|---|---|---|
| id | uuid | PK |
| position_code | varchar | unique canonical |
| position_name | varchar |  |
| org_unit_id | uuid | FK |
| job_family_id | uuid | FK |
| job_level_id | uuid | FK |
| position_grade_id | uuid | FK |
| is_strategic | boolean |  |
| valid_from/to | date |  |
| status | enum | ACTIVE/INACTIVE |

### target_positions

| Field | Type | Catatan |
|---|---|---|
| id | uuid | PK |
| position_id | uuid | FK canonical |
| talent_period_id | uuid | FK |
| need_type | enum | VACANT/PROJECTED/SUCCESSION |
| required_count | int |  |
| requirement_version_id | uuid | FK |
| scoring_version_id | uuid | FK |
| status | enum | DRAFT/ACTIVE/CLOSED |

### requirement_rules

| Field | Type | Catatan |
|---|---|---|
| id | uuid | PK |
| requirement_version_id | uuid | FK |
| rule_code | varchar |  |
| rule_type | enum | MANDATORY/SOFT |
| data_path | varchar | canonical fact |
| operator | enum | whitelist |
| expected_value_json | json |  |
| missing_policy | enum |  |
| effective_from/to | date |  |

### scoring_results

| Field | Type | Catatan |
|---|---|---|
| id | uuid | PK |
| scoring_run_id | uuid | FK |
| employee_id | uuid | FK |
| target_position_id | uuid | FK |
| eligibility_status | enum |  |
| total_score | decimal |  |
| rank_no | int |  |
| formula_snapshot_json | json |  |
| data_snapshot_hash | varchar |  |
| calculated_at | datetime |  |

## 4. Relasi Inti
Satu position dapat memiliki banyak target_positions lintas periode. Setiap target_position menunjuk satu published requirement_version dan satu published scoring_version. Satu scoring_run menghasilkan banyak scoring_results; setiap result memiliki banyak component result dan evidence. Source entity link menghubungkan record external ke canonical entity.

## 5. Data Mapping dan Conflict Resolution

| Kondisi | Aturan Default |
|---|---|
| ID sumber sama, payload hash sama | Skip sebagai no-change |
| ID sumber sama, payload berubah | Buat raw baru dan update staging |
| Dua sumber mengisi field sama | Gunakan source priority per field |
| Nilai berbeda dengan priority sama | Tandai conflict untuk review |
| Kode jabatan belum dikenal | NEEDS_MAPPING |
| Pegawai berpotensi duplicate | Match NIP; fallback kombinasi identitas terkontrol |
| Tanggal riwayat overlap | Validation issue; tidak langsung overwrite |

## 6. Data Quality Metrics

| Metric | Formula |
|---|---|
| Completeness | field wajib terisi / total field wajib |
| Validity | record valid / record diproses |
| Mapping Coverage | record mapped / record memerlukan mapping |
| Freshness | waktu sekarang - source_updated_at |
| Uniqueness | record unik / total record |
| Consistency | record tanpa conflict / total record |

## 7. Index dan Kinerja
- Unique index pada source_id + entity_type + source_record_id + payload_hash.
- Index employees.employee_identifier dan positions.position_code.
- Composite index pada scoring_results(target_position_id, scoring_run_id, rank_no).
- Index issue berdasarkan status, entity_type, source_id, batch_id.
- Partisi atau arsip raw payload bila volume tumbuh besar.
- Materialized summary/cache untuk dashboard, bukan query transaksi berat langsung.

## 8. Retention dan Audit

| Data | Retention Rekomendasi |
|---|---|
| Raw payload | Minimal 1-2 tahun atau sesuai kebijakan instansi |
| Staging sukses | Dapat diarsip setelah merge; issue tetap disimpan |
| Scoring snapshot | Tidak dihapus selama periode audit |
| Nomination decision | Permanen sesuai retensi dokumen kepegawaian |
| Audit log | Minimal sesuai kebijakan keamanan dan audit |
| Export file | Terbatas; dapat dibuat ulang dari snapshot |
