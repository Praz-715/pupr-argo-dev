# Rangkuman — Paket Dokumen Tambahan SIMT DJBK

Ringkasan dari **tujuh berkas** di folder ini: lima dokumen rancangan (Blueprint, FSD, SRD, DRD, Implementation & Test Plan) dan dua diagram. Semuanya berversi **1.0 — Juli 2026**, memakai blok metadata yang sama, dan saling merujuk sebagai satu paket.

Rangkuman ini **memampatkan**, tidak menambahkan. Setiap angka, nama tabel, dan nama status di bawah berasal dari berkas sumbernya — kalau butuh detail penuh, ikuti tautan ke berkas aslinya. Satu-satunya bagian yang bukan isi dokumen adalah [§14](#14-catatan-pembaca--hubungan-dengan-doc-yang-sudah-ada), dan itu ditandai jelas.

---

## 1. Tesis rancangan, dalam enam kalimat

Kalimat yang diulang di seluruh paket, dari [Blueprint §1](00_Blueprint_Arsitektur_Talenta.md):

> **Sistem sumber boleh diganti, tetapi data canonical, rule jabatan, formula scoring, histori hasil, dan pengalaman pengguna tetap stabil.**

Enam prinsip yang menurunkan kalimat itu:

1. **Satu aplikasi modular monolith** — modul bisnis dipisah tegas di dalam satu deployment dan satu basis kode, dengan kontrak internal yang jelas.
2. **Semua sumber lewat satu gerbang** — integration gateway + tabel tampungan, tidak ada sumber yang menulis langsung ke tabel domain.
3. **Master jabatan canonical jadi pusat** — seluruh kode/nama jabatan eksternal dipetakan ke sana; ID sumber tidak pernah jadi primary key.
4. **Persyaratan & formula adalah konfigurasi berversi**, bukan kode. Yang sudah *published* bersifat immutable; perubahan melahirkan versi baru.
5. **Eligibility dipisah dari match score** — kandidat tidak diranking sebelum lolos syarat wajib.
6. **Setiap hasil menyimpan snapshot** formula, data, evidence, dan alasan — supaya hasil lama tetap bisa direproduksi dan dipertanggungjawabkan.

Ditegaskan di seluruh dokumen: pendekatannya **rule-based, bukan AI recommendation**.

---

## 2. Peta dokumen — mana menjawab apa

| Berkas | Menjawab | Isi paling padat |
|---|---|---|
| [00 Blueprint Arsitektur](00_Blueprint_Arsitektur_Talenta.md) | *Bentuk sistemnya seperti apa?* | Gap kondisi sekarang, 10 modul, deployment layer, versioning, roadmap 10 minggu, Definition of Done |
| [01 FSD](01_FSD_Modul_Talenta.md) | *Penggunanya melihat & melakukan apa?* | 6 aktor, 12 menu, 18 functional requirement, detail 2 layar, status workflow, acceptance criteria |
| [02 SRD](02_SRD_Modul_Talenta.md) | *Sistemnya dibangun bagaimana?* | Package structure, 14 endpoint internal, adapter contract, processing pipeline, rule engine, 12 NFR, error code |
| [03 DRD](03_DRD_Modul_Talenta.md) | *Datanya disimpan bagaimana?* | 8 domain tabel, struktur 6 tabel kunci, conflict resolution, metrik kualitas data, index, retention |
| [04 Implementation & Test Plan](04_Implementation_Test_Plan.md) | *Cara memasangnya?* | WBS 8 stream, migration runbook 12 langkah, 12 test case, 9 skenario UAT, cutover checklist, 7 risiko |
| [Diagram arsitektur](WhatsApp%20Image%202026-07-31%20at%204.40.35%20PM.md) | Aliran data ujung ke ujung | Sama dengan gambar §4 Blueprint |
| [Diagram alur matching](WhatsApp%20Image%202026-07-31%20at%204.40.37%20PM.md) | Urutan pencocokan kandidat | Sama dengan gambar §7 Blueprint |

Kedua diagram itu **duplikat** dari gambar yang sudah tertanam di Blueprint — bukan tambahan.

---

## 3. Aliran data, ujung ke ujung

```
eHRM / SIASN · eKinerja · Sistem Asesmen · eNominasi · CSV / Excel / DB Legacy
        │   (kelimanya "sistem sumber yang dapat diganti")
        ▼
Integration Gateway      Source Registry + Adapter + Auth + Scheduler
        ▼
Raw Intake               payload asli, batch, hash, timestamp
        ▼
Staging & Data Quality   validasi, normalisasi, dedup, mapping, quarantine
        ▼
Canonical Talent DB      pegawai, jabatan, unit, riwayat, asesmen, kinerja, disiplin
        ▼
Internal Application API / Service Layer
        ▼
MODULAR MONOLITH SIMT
   Master Data · Target Position · Dashboard & Reporting · IAM/Audit/Config
   Eligibility Engine ──eligible/review──▶ Scoring Engine ──ranking──▶ Nomination & Approval
        ▼
Web Dashboard            selector jabatan, kandidat, ranking, data health
```

Sepuluh modul beserta tanggung jawabnya ada di [Blueprint §5](00_Blueprint_Arsitektur_Talenta.md); lapisan deployment (reverse proxy, worker/queue, object storage, observability) di [§6](00_Blueprint_Arsitektur_Talenta.md).

**Pipeline pemrosesan** ([SRD §5](02_SRD_Modul_Talenta.md)), 10 langkah: fetch/upload → simpan raw idempotent → transform ke staging → validasi → deteksi duplicate & conflict → resolve code mapping → tandai `READY_TO_MERGE` → merge dalam transaction → catat source entity link & audit → refresh summary.

---

## 4. Alur matching jabatan

Sepuluh langkah, dari [diagram §7](WhatsApp%20Image%202026-07-31%20at%204.40.37%20PM.md):

```
Pilih Periode & Unit → Pilih Jabatan Dituju → Load Requirement Version
  → Cek Kelengkapan Data → Eligibility Gate (PASS / FAIL / REVIEW)
        ├─ PASS/REVIEW ─→ Hitung Komponen (65% + 20% + 15%) ─┐
        └─ FAIL ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┤
                                                            ▼
  Ranking & Gap Analysis → Snapshot Hasil (Formula + Data + Evidence)
  → Draft Nominasi → Approval & Audit
```

Perhatikan garis putus-putusnya: kandidat **FAIL tetap masuk Ranking & Gap Analysis**, hanya saja melewati perhitungan komponen.

---

## 5. Formula & versioning

Baseline: **65% Potensi & Kompetensi + 20% Kualifikasi + 15% Integritas**, dengan Kualifikasi dipecah rata jadi Pendidikan 5% · Bidang Ilmu 5% · Diklat 5% · Pengalaman Jabatan 5%.

Blueprint menegaskan angka itu **tidak ditanam permanen di kode** — seluruh bobot, rule, band nilai, dan kebijakan data kosong hidup di *scoring model version*. Empat objek yang diversikan:

| Objek | Contoh | Kenapa penting |
|---|---|---|
| Requirement Version | Jabatan A v1.2 | Syarat jabatan berubah tanpa menghapus histori |
| Scoring Model Version | Talent Match 2026 v1 | Bobot & formula bisa dibandingkan |
| Mapping Version | eHRM Position Mapping v3 | Perubahan mapping bisa diaudit |
| Result Snapshot | Run 31-07-2026 14:30 | Hasil lama tetap bisa direproduksi |

**Rule engine** ([SRD §6](02_SRD_Modul_Talenta.md)) menyusun tiap rule dari: tipe (mandatory gate / weighted score) · data path · operator · expected value · bobot · score band · missing policy · evidence resolver · masa berlaku · versi.

- **Operator (daftar putih):** `EQUALS` `IN` `GTE` `BETWEEN` `EXISTS` `VALID_ON_DATE` `DURATION_AT_LEAST`
- **Missing policy:** `ZERO` `FAIL` `REVIEW` `EXCLUDE` `RENORMALIZE`

Keamanannya disebut eksplisit: **tidak ada dynamic code execution pada formula** — hanya operator dari daftar putih.

---

## 6. Aktor & hak akses

| Aktor | Hak utama |
|---|---|
| Super Admin | Seluruh konfigurasi, source, master, user, formula, audit |
| Admin Talenta | Target jabatan, requirement, kandidat, scoring, nominasi, laporan |
| **Admin Data** | Import, mapping, validasi, merge, koreksi staging |
| **Pejabat Reviewer** | Review kandidat, catatan, persetujuan/penolakan |
| Pimpinan | Dashboard, ranking, laporan, keputusan sesuai kewenangan |
| Auditor/Viewer | Akses baca, histori, evidence, audit trail |

Dua belas menu dikelompokkan jadi enam: Utama · Talenta · Nominasi · Data · Administrasi · Laporan ([FSD §3](01_FSD_Modul_Talenta.md)).

---

## 7. Functional requirements — 18 butir, semuanya *Must*

Tidak ada satu pun bertingkat *Should* atau *Could*. Yang paling menentukan bentuk sistem:

- **FR-TP-01** — jabatan dipilih dari master canonical, **bukan input bebas**.
- **FR-TP-03** — target hanya bisa diaktifkan bila bobot 100%, syarat wajib lengkap, dan sumber data tersedia (*readiness check*).
- **FR-INT-02** — *dry run sync* menampilkan preview record valid / invalid / duplicate / unmapped sebelum apa pun masuk.
- **FR-ELG-01 & 02** — gate menghasilkan `ELIGIBLE` / `NOT_ELIGIBLE` / `REVIEW_REQUIRED`, **selalu** disertai alasan dan evidence.
- **FR-SCR-03** — simulasi formula tanpa mengubah hasil resmi.
- **FR-AUD-01** — perubahan rule, mapping, target, dan keputusan tercatat *immutable*.

Enam **acceptance criteria** ([FSD §8](01_FSD_Modul_Talenta.md)) menguji tepat titik-titik itu, termasuk yang paling mudah terlewat: *formula berubah → hasil lama tetap memakai versi sebelumnya*.

---

## 8. Status & workflow

| Objek | Status |
|---|---|
| Sync Batch | `QUEUED` `RUNNING` `PARTIAL` `SUCCESS` `FAILED` `CANCELLED` |
| Staging Record | `RECEIVED` `VALIDATED` `NEEDS_MAPPING` `INVALID` `DUPLICATE` `READY_TO_MERGE` `MERGED` |
| Requirement Version | `DRAFT` `PUBLISHED` `RETIRED` |
| Scoring Version | `DRAFT` `PUBLISHED` `RETIRED` |
| Eligibility Result | `ELIGIBLE` `NOT_ELIGIBLE` `REVIEW_REQUIRED` |
| Nomination | `DRAFT` `SUBMITTED` `IN_REVIEW` `REVISION` `APPROVED` `REJECTED` `CANCELLED` |

---

## 9. Model data

Delapan domain, dipisah menurut umur & sifat datanya ([DRD §2](03_DRD_Modul_Talenta.md)):

| Domain | Isi |
|---|---|
| Integration | source, endpoint, field mapping, code mapping, sync batch, raw payload |
| Staging | `stg_*` per entitas + `stg_validation_issues` |
| Canonical Master | employees, positions, org_units, job_families/levels, referensi pendidikan & diklat |
| Employee Facts | riwayat jabatan, pendidikan, diklat, sertifikasi, asesmen, kinerja, disiplin |
| Target & Rules | target_positions, requirement_*, scoring_*, score_bands |
| Execution | eligibility_runs/results, scoring_runs/results/components, result_evidences |
| Workflow | nominations, candidates, approvals, comments |
| System | users, roles, permissions, audit_logs, system_settings, feature_flags |

**Lima prinsip data:** pisahkan raw/staging/canonical/transaction/snapshot/audit · UUID internal untuk canonical · simpan source link · published config immutable · soft delete hanya untuk master (keputusan & audit tidak dihapus).

**Conflict resolution** ([DRD §5](03_DRD_Modul_Talenta.md)) sudah punya aturan bawaan per kondisi — termasuk yang paling sering muncul: dua sumber mengisi field yang sama → *source priority per field*; nilai berbeda dengan prioritas sama → **tandai conflict**, jangan pilih diam-diam.

**Enam metrik kualitas data** dengan rumus eksplisit: Completeness · Validity · Mapping Coverage · Freshness · Uniqueness · Consistency.

---

## 10. Non-functional & keamanan

Dua target angka yang bisa diuji:

- **Dashboard ≤ 3 detik** untuk data teragregasi normal.
- **Scoring batch 1.872 kandidat per jabatan ≤ 5 menit.**

Sisanya kualitatif tapi spesifik: TLS & secure session · RBAC per permission · credential terenkripsi & tidak tampil di log · sync idempotent (replay tidak menggandakan) · merge atomic · log ber-correlation ID · backup harian + restore test · **skor dapat ditelusuri ke rule dan evidence**.

Kontrol keamanan tambahan: rate limiting (login, sync, scoring, export) · CSRF + token auth · upload dibatasi tipe/ukuran & dipindai · export mengikuti permission + masking · audit log append-only.

Tujuh **error code** terstandar ([SRD §9](02_SRD_Modul_Talenta.md)), mis. `SCR-001` total bobot ≠ 100% → publish ditolak; `MAP-001` kode referensi belum dipetakan → `NEEDS_MAPPING`.

---

## 11. Roadmap 10 minggu

| Minggu | Fokus | Output |
|---|---|---|
| 1 | Lock scope & audit data | Data inventory, gap register, keputusan canonical key |
| 2 | Master canonical | Pegawai, unit, jabatan, referensi, source crosswalk |
| 3 | Integration foundation | Source registry, raw intake, sync batch, CSV import |
| 4 | Staging & data quality | Validation issue, mapping UI, merge process |
| 5 | Target position | Selector, requirement set, versioning, readiness check |
| 6 | Eligibility engine | Hard gate, review policy, evidence |
| 7 | Scoring engine | Komponen, bobot, band, formula simulation |
| 8 | Ranking & nominasi | Ranking, gap analysis, draft nomination |
| 9 | Dashboard & laporan | Source health, readiness, export, audit explanation |
| 10 | UAT & rollout | Test, training, migration rehearsal, release |

**Strategi implementasinya bertahap:** mulai dari CSV import sebagai *fallback*, baru aktifkan API per sumber; canonical master & mapping **dikunci sebelum full import**; formula diuji lewat simulation sebelum publish; go-live memakai snapshot + rollback plan, dan fitur dinyalakan bertahap lewat *feature flag*.

Migration runbook ([Plan §3](04_Implementation_Test_Plan.md)) memuat 12 langkah berurutan — perhatikan langkah 6–8: **import pegawai secara dry run → validasi jumlah/duplicate/completeness → baru merge canonical**.

---

## 12. Definition of Done

Enam pernyataan yang menutup Blueprint — ini ukuran "selesai" untuk seluruh paket:

- [ ] Jabatan target dapat dipilih dan punya requirement version aktif.
- [ ] Data dari **minimal CSV dan satu API** masuk lewat pipeline yang sama.
- [ ] Data unmapped **tidak masuk diam-diam** ke master; muncul di data quality queue.
- [ ] Hasil eligibility menampilkan alasan `PASS` / `FAIL` / `REVIEW_REQUIRED`.
- [ ] Match score menampilkan breakdown per komponen, bobot, evidence, dan formula version.
- [ ] Hasil nominasi punya audit trail dan **tidak berubah** ketika formula baru diterbitkan.

Diuji lewat 12 test case (unit → integration → functional → security → performance → UAT) dan 9 skenario UAT per aktor.

---

## 13. Risiko yang sudah diakui

| Risiko | Mitigasi yang dipilih |
|---|---|
| API sumber belum tersedia | CSV adapter dengan *format contract* yang sama |
| Data disiplin kosong | Policy `REVIEW` + label data incomplete |
| Riwayat jabatan tidak mapped | Mapping queue + blocking readiness |
| Formula berubah saat development | Versioning + simulation |
| Source ID tidak stabil | Canonical ID + identity matching yang dapat dikonfigurasi |
| Batch besar gagal | Chunk, retry, idempotency, checkpoint |
| Hasil dipertanyakan | Evidence + immutable snapshot |

Pola mitigasinya konsisten: **tidak ada kegagalan yang dibiarkan senyap** — semuanya jadi antrean kerja, label, atau versi baru.

---

## 14. Catatan pembaca — hubungan dengan `doc/` yang sudah ada

> Bagian ini **bukan** isi dokumen sumber. Ini pembacaan silang terhadap
> [`doc/PRD.md`](../PRD.md), [`doc/ERD.md`](../ERD.md), dan [`phase.md`](../../phase.md),
> supaya jelas mana yang beririsan dan mana yang benar-benar baru. Keputusan
> menggabungkan atau tidak ada di pemilik proses, bukan di rangkuman ini.

**Yang sejalan** — formula 65/20/15 dengan Kualifikasi 4×5%; eligibility terpisah dari match score; snapshot rubrik supaya skor lama bisa direproduksi; rincian skor sampai indikator beserta evidence; audit trail wajib; jabatan dipilih dari master, bukan teks bebas; batas 1.872 pegawai sebagai ukuran performa.

**Yang berbeda namanya saja** — `target_positions` ↔ `jabatan_target`; `requirement_rules` ↔ `jabatan_target_persyaratan`; `scoring_components/rules/bands` ↔ `rubrik_komponen/indikator/kategori_skor`; `scoring_results` ↔ `match_score`; `result_evidences` ↔ `match_score_detail`.

**Yang benar-benar baru** dan belum ada padanannya di kode:

| Konsep | Keadaan sekarang di repo |
|---|---|
| Lapisan raw intake + staging + `stg_validation_issues` | Belum ada; `lib/importer` menormalisasi tanpa tabel tampungan |
| Source registry, adapter contract, sync scheduler | `sync_log` ada sebagai catatan; mekanismenya belum diputuskan (PRD §10.2) |
| Mapping queue (`NEEDS_MAPPING`) sebagai penghalang merge | Antrian Pembersihan membaca keadaan DB, bukan memblokir masuknya data |
| Requirement/Scoring **version** sebagai baris berstatus DRAFT/PUBLISHED/RETIRED | Rubrik disunting langsung; yang dibekukan hanya `rubrik_snapshot` per perhitungan |
| `missing_policy` per rule (5 nilai) | Mesin rubrik memakai satu perilaku: fallback kategori terdekat + `perluReview` |
| Conflict resolution lintas sumber (source priority per field) | Belum relevan — baru satu jalur data |
| Feature flags, materialized summary | Belum ada |

**Yang perlu dikonfirmasi karena bertabrakan:**

1. **Daftar aktor berbeda.** Paket ini memakai 6 aktor termasuk **Admin Data** dan **Pejabat Reviewer**, tetapi **tidak** memuat **Pengelola Unit** — padahal Pengelola Unit adalah peran yang sudah terpasang di kode dan jadi dasar pembatasan data per unit ([PRD §3](../PRD.md)). Perlu dipastikan apakah ini penggantian, penambahan, atau sekadar penamaan berbeda.
2. **Kandidat FAIL tetap masuk ranking.** Diagram §7 menggambarkannya begitu, dan itu sejalan dengan halaman Kandidat yang sudah ada — tapi berlawanan dengan kalimat Blueprint §3 "kandidat tidak langsung diranking sebelum lolos syarat wajib". Dua pernyataan itu perlu didamaikan sebelum dipakai sebagai acuan.
3. **Modular monolith vs struktur sekarang.** Paket ini mengusulkan `Modules/<Domain>/` dengan `Shared/Contracts`; kode berjalan memakai pembagian `lib/scoring` · `lib/kueri` · `lib/aksi` yang batasnya *teknis*, bukan per domain bisnis. Keduanya sama-sama monolith modular, tapi garis pemisahnya berbeda arah.
