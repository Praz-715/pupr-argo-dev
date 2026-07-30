# ERD — Sistem Informasi Manajemen Talenta DJBK

**Target DBMS:** MySQL 8.x
**Sumber rancangan:** [`Data DTM.json`](Data%20DTM.json) & CSV turunannya (data contoh 9 pegawai), [`KERANGKA TALENT POOL.md`](KERANGKA%20TALENT%20POOL.md) (rubrik penilaian), [`BLUEPRINT READINESS - MODUL MANAJEMEN TALENTA.md`](BLUEPRINT%20READINESS%20-%20MODUL%20MANAJEMEN%20TALENTA.md) (gap data & modul yang akan dibangun), [`manajemen talenta 27 juli utk tim SIM.md`](manajemen%20talenta%2027%20juli%20utk%20tim%20SIM.md) (roadmap & stakeholder).

> Dokumen ini murni desain data (skema tabel), **belum ada kode**. Tujuannya untuk diaudit dulu sebelum implementasi MySQL/Prisma/ORM apa pun.

---

## 1. Prinsip Desain

1. **Surrogate key di semua tabel** (`id BIGINT UNSIGNED AUTO_INCREMENT`). Natural key (NIP, kode unit, kode jabatan) disimpan sebagai `UNIQUE`, bukan PK — supaya aman kalau suatu saat ada koreksi data dari sumber eksternal.
2. **Pisahkan data yang "sudah ada" dari data yang "perlu dibangun"**, mengikuti tabel *Status Readiness Data* di Blueprint:
   - Sudah ada (dari eNominasi/eHRM) → tabel kelompok B (`pegawai`, `riwayat_*`, `asesmen_talenta`).
   - Perlu dibangun (❌ di Blueprint: Kode Jabatan & Kode Unit, Master Jabatan Target & Persyaratan, Data Hukuman Disiplin, Workflow Nominasi & Approval) → tabel kelompok A, C, E di bawah.
3. **Rule engine dibuat generik/berjenjang** (Komponen → Indikator → Kategori Skor), persis struktur [`KERANGKA TALENT POOL.md`](KERANGKA%20TALENT%20POOL.md), supaya bobot & rubrik bisa dikonfigurasi per **jabatan target** tanpa ubah kode (ini yang dimaksud Blueprint komponen #2 "Master Jabatan Target & Rule Configuration").
4. **Dua level skor yang berbeda tujuan, jangan ditumpuk jadi satu tabel:**
   - `asesmen_talenta` = skor **generik** dari e-Nominasi (Formula Dasar A: 50% Kinerja + 50% Potensial → Kotak 9). Ini snapshot tahunan yang sudah ada per pegawai, tidak terikat jabatan target tertentu.
   - `match_score` = skor **spesifik per jabatan target** (Formula Dasar B: 65% Potensi&Kompetensi + 20% Kualifikasi Jabatan + 15% Integritas&Moralitas), dihitung oleh rule engine baru saat pegawai dicalonkan untuk suatu jabatan target. `match_score` MEMAKAI `asesmen_talenta.potkom` sebagai salah satu input, tidak menghitung ulang dari nol.
5. Semua tabel riwayat (`riwayat_jabatan`, `riwayat_pendidikan`) tetap simpan **teks mentah** dari sumber (karena Blueprint menandai "Riwayat Jabatan Terstruktur" masih 🟡 sebagian), plus kolom FK opsional ke master setelah data dibersihkan/dipetakan.
6. **Riwayat Diklat/Sertifikasi tidak dibuat tabel terpisah** — datanya cuma daftar nama diklat per pegawai tanpa kolom yang benar-benar unik/bisa direlasikan (lokasi, TMT, arsip mayoritas kosong di data contoh), jadi disimpan sebagai kolom `JSON` langsung di `pegawai.riwayat_diklat` (lihat §2.1). Kalau nanti kebutuhan berkembang (perlu query "siapa saja yang ikut diklat X", atau field lokasi/TMT/arsip mulai konsisten terisi), baru layak dipecah jadi tabel relasional lagi.

---

## 2. Diagram ERD

### 2.1 Master Data & Kepegawaian

```mermaid
erDiagram
    unit_organisasi ||--o{ unit_organisasi : "induk dari"
    unit_organisasi ||--o{ jabatan : memiliki
    jabatan ||--o{ pegawai : dijabat_oleh
    pegawai ||--o{ riwayat_jabatan : punya
    pegawai ||--o{ riwayat_pendidikan : punya
    pegawai ||--o{ kinerja_periode : punya
    pegawai ||--o{ hukuman_disiplin : punya
    riwayat_jabatan }o--o| jabatan : "dipetakan ke (nullable)"

    unit_organisasi {
        bigint id PK
        varchar kode_unit UK
        varchar nama_unit
        bigint parent_id FK
        enum jenis "DITJEN,SEKRETARIAT,DIREKTORAT,BALAI,BP2JK,SUBDIT,BAGIAN,SEKSI"
        tinyint level_eselon "1-4, null jika non-struktural"
    }
    jabatan {
        bigint id PK
        varchar kode_jabatan UK
        varchar nama_jabatan
        bigint unit_organisasi_id FK
        enum jenis_jabatan "STRUKTURAL,FUNGSIONAL_TERTENTU,FUNGSIONAL_UMUM"
        varchar jenjang "Administrator,Pengawas,Ahli Madya,dst"
        enum eselon "I,II,III,IV,NON_ESELON"
        enum status_jabatan "TERISI,KOSONG,DIHAPUS"
        datetime updated_at
    }
    pegawai {
        bigint id PK
        varchar nip UK
        varchar nama_lengkap
        varchar golongan
        date tmt_golongan
        varchar pangkat
        bigint jabatan_id FK
        date tmt_jabatan
        varchar sekolah_terakhir
        varchar bidang_studi_terakhir
        enum tingkat_pendidikan "SLTA,D3,S1_D4,S2,S3"
        enum status_aktif "AKTIF,PENSIUN,MUTASI_KELUAR,NONAKTIF"
        varchar sumber_sinkron "eHRM,eNominasi,manual"
        datetime last_synced_at
        json riwayat_diklat "list nama diklat dari eHRM, tidak dinormalisasi"
    }
    riwayat_jabatan {
        bigint id PK
        bigint pegawai_id FK
        smallint urutan
        varchar jabatan_nama_mentah "teks asli dari eHRM"
        bigint jabatan_id FK "nullable, hasil pemetaan"
        varchar unit_kerja_mentah
        date tanggal_mulai
        date tanggal_akhir
        varchar no_sk
        varchar url_arsip_digital
    }
    riwayat_pendidikan {
        bigint id PK
        bigint pegawai_id FK
        smallint urutan
        enum jenjang_pendidikan "SLTA,D3,S1_D4,S2,S3"
        varchar bidang_studi
        varchar nama_sekolah
        year tahun_lulus
        varchar url_ijazah
        varchar url_transkrip
        varchar no_pertek_bkn
        datetime updated_at
    }
    kinerja_periode {
        bigint id PK
        bigint pegawai_id FK
        year tahun
        enum periode_skp "TW1,TW2,TW3,TAHUNAN"
        decimal nilai_kinerja
        decimal nilai_perilaku
        enum predikat "Sangat_Baik,Baik,Butuh_Perbaikan,Kurang,Sangat_Kurang"
        varchar sumber_sync "eKinerja"
        datetime synced_at
    }
    hukuman_disiplin {
        bigint id PK
        bigint pegawai_id FK
        enum tingkat_hukuman "TIDAK_PERNAH,RINGAN,SEDANG,BERAT,SEDANG_MENJALANI"
        date tanggal_sk
        varchar no_sk
        text keterangan
        boolean status_aktif
        bigint input_by FK
        datetime created_at
    }
```

### 2.2 Rule Engine / Rubrik Penilaian (Master Jabatan Target)

```mermaid
erDiagram
    jabatan_target ||--o{ jabatan_target_anggota : mencakup
    jabatan ||--o{ jabatan_target_anggota : "termasuk dalam"
    jabatan_target ||--o{ jabatan_target_persyaratan : punya
    jabatan_target ||--o{ rubrik_komponen : punya
    rubrik_komponen ||--o{ rubrik_indikator : punya
    rubrik_indikator ||--o{ rubrik_indikator : "sub-indikator dari"
    rubrik_indikator ||--o{ rubrik_kategori_skor : punya

    jabatan_target {
        bigint id PK
        varchar kode_target UK
        varchar nama_target "cth: Kepala Balai BP2JK/Kasubdit Pengadaan"
        text deskripsi
        enum status "DRAFT,AKTIF,NONAKTIF"
        bigint dibuat_oleh FK
        datetime created_at
    }
    jabatan_target_anggota {
        bigint jabatan_target_id FK
        bigint jabatan_id FK
    }
    jabatan_target_persyaratan {
        bigint id PK
        bigint jabatan_target_id FK
        enum jenis_syarat "PENDIDIKAN_MIN,BIDANG_ILMU,PENGALAMAN_MIN,LAINNYA"
        text deskripsi
        varchar nilai_minimal
    }
    rubrik_komponen {
        bigint id PK
        bigint jabatan_target_id FK "NULL = rubrik generik Kotak 9 (Formula A)"
        enum sumbu "Y_KINERJA,X_POTENSIAL"
        varchar nama_komponen
        decimal bobot_komponen "0-1"
        smallint urutan
    }
    rubrik_indikator {
        bigint id PK
        bigint rubrik_komponen_id FK
        bigint parent_indikator_id FK "nullable, untuk sub-rubrik"
        varchar nama_indikator
        decimal bobot_indikator "0-1"
        enum mode_skor "KATEGORI_TETAP,NILAI_LANGSUNG"
        text kebutuhan_data
        varchar sumber_data
        smallint urutan
    }
    rubrik_kategori_skor {
        bigint id PK
        bigint rubrik_indikator_id FK
        varchar nama_kategori
        decimal nilai_skor
        decimal ambang_min
        decimal ambang_max
        smallint urutan
    }
```

> Catatan `mode_skor` pada `rubrik_indikator`: sebagian besar indikator memakai **KATEGORI_TETAP** (mis. predikat kinerja → nilai tetap 100/80/60/40/20, lihat `rubrik_kategori_skor`). Tapi indikator **Penilaian Potensi dan Kompetensi** memakai **NILAI_LANGSUNG** — angka Potkom mentah dipakai langsung sebagai skor, kategori (Memenuhi Syarat/dst) hanya label klasifikasi, bukan konversi ke poin tetap. Bedakan dua mode ini di logic aplikasi.

### 2.3 Asesmen, Talent Pool & Workflow Nominasi

```mermaid
erDiagram
    pegawai ||--o{ asesmen_talenta : punya
    pegawai ||--o{ match_score : dinilai
    jabatan_target ||--o{ match_score : "dinilai untuk"
    match_score ||--o| talent_pool : menghasilkan
    pegawai ||--o{ talent_pool : masuk
    jabatan_target ||--o{ talent_pool : menampung
    talent_pool ||--o{ nominasi : diajukan
    unit_organisasi ||--o{ nominasi : mengajukan
    nominasi ||--o{ approval_log : dicatat
    talent_pool ||--o{ rencana_pengembangan : punya

    asesmen_talenta {
        bigint id PK
        bigint pegawai_id FK
        year tahun_asesmen
        varchar jenis_asesmen "Administrator,Pengawas,JPT Pertama,JFT Muda,dst"
        enum status_asesmen "BERLAKU,EXPIRED,DRAFT"
        decimal nilai_kinerja_y
        decimal nilai_potensial_x
        decimal potkom
        decimal nilai_integritas
        decimal nilai_talenta "50 percent Y + 50 percent X"
        tinyint kotak_9 "1-9"
        year tahun_kinerja
        enum rating_kinerja "Sangat_Baik,Baik,Butuh_Perbaikan,Kurang,Sangat_Kurang"
        varchar sumber_sync "eNominasi,manual,recalculated"
        datetime updated_at
    }
    match_score {
        bigint id PK
        bigint pegawai_id FK
        bigint jabatan_target_id FK
        decimal skor_potensi_kompetensi
        decimal skor_kualifikasi_jabatan
        decimal skor_integritas_moralitas
        decimal skor_total "65/20/15 weighted"
        boolean eligible "hasil cek jabatan_target_persyaratan"
        text catatan_eligibility
        datetime computed_at
    }
    talent_pool {
        bigint id PK
        bigint pegawai_id FK
        bigint jabatan_target_id FK
        bigint match_score_id FK
        int ranking
        enum status "KANDIDAT,DINOMINASIKAN,DIVERIFIKASI,DITETAPKAN,DITOLAK"
        text catatan_reviewer
        date ditetapkan_pada
        bigint ditetapkan_oleh FK
    }
    nominasi {
        bigint id PK
        bigint talent_pool_id FK
        bigint diajukan_oleh_unit_id FK
        bigint diajukan_oleh_user_id FK
        date tanggal_diajukan
        enum status "DIAJUKAN,MENUNGGU_VERIFIKASI,DISETUJUI,DITOLAK"
        text catatan
    }
    approval_log {
        bigint id PK
        bigint nominasi_id FK
        varchar tahap "Verifikasi Kepegawaian,Persetujuan Pimpinan"
        enum status "MENUNGGU,DISETUJUI,DITOLAK,REVISI"
        bigint approver_user_id FK
        text catatan
        datetime tanggal_aksi
    }
    rencana_pengembangan {
        bigint id PK
        bigint talent_pool_id FK
        enum jenis_pengembangan "DIKLAT,ROTASI,MENTORING,PENUGASAN"
        text deskripsi
        date target_selesai
        enum status "DIRENCANAKAN,BERJALAN,SELESAI"
        bigint dibuat_oleh FK
    }
```

### 2.4 Sistem, Keamanan & Integrasi API

```mermaid
erDiagram
    roles ||--o{ users : memiliki
    unit_organisasi ||--o{ users : "scope akses"
    users ||--o{ audit_log : melakukan
    users ||--o{ api_token : menerbitkan
    api_client ||--o{ api_token : memiliki
    api_client ||--o{ api_activity_log : memanggil
    api_token ||--o{ api_activity_log : dipakai_pada

    roles {
        bigint id PK
        varchar nama_role UK "Super Admin,Admin Talenta DJBK,Verifikator Kepegawaian,Pimpinan Unit,Pimpinan DJBK,Viewer"
        text deskripsi
    }
    users {
        bigint id PK
        varchar nama
        varchar email UK
        varchar username UK
        varchar password_hash
        bigint role_id FK
        bigint unit_organisasi_id FK "nullable, batasi akses data per unit"
        boolean status_aktif
        datetime last_login_at
    }
    audit_log {
        bigint id PK
        bigint user_id FK "nullable jika via API/sistem"
        varchar aksi
        varchar entitas
        bigint entitas_id
        json data_sebelum
        json data_sesudah
        varchar ip_address
        datetime created_at
    }
    api_client {
        bigint id PK
        varchar nama_instansi
        varchar kode_instansi UK
        varchar contact_person
        varchar email
        varchar no_mou "referensi Nota Kesepahaman/PKS"
        enum status "AKTIF,NONAKTIF,PENDING"
        json scope_akses "daftar endpoint & field yang diizinkan"
        datetime created_at
    }
    api_token {
        bigint id PK
        bigint api_client_id FK
        varchar token_hash UK
        varchar label
        datetime expired_at
        datetime last_used_at
        enum status "AKTIF,DICABUT"
        bigint created_by FK
        datetime created_at
    }
    api_activity_log {
        bigint id PK
        bigint api_client_id FK
        bigint api_token_id FK
        varchar endpoint
        varchar method
        int response_code
        int response_time_ms
        varchar ip_address
        datetime created_at
    }
    sync_log {
        bigint id PK
        enum sumber_sistem "eHRM,eNominasi,eKinerja,Manual"
        varchar jenis_data
        enum status "SUKSES,GAGAL,SEBAGIAN"
        int jumlah_baris
        datetime mulai_pada
        datetime selesai_pada
        text catatan_error
        bigint dijalankan_oleh FK "nullable jika terjadwal/sistem"
    }
```

---

## 3. Detail Tabel

### 3.1 Master Data & Kepegawaian

| Tabel | Fungsi | Kolom Kunci | Catatan |
|---|---|---|---|
| `unit_organisasi` | Hierarki unit (Ditjen → Sekretariat/Direktorat → Balai/BP2JK → Bagian/Seksi), self-referencing via `parent_id` | `kode_unit` UK | Menutup gap ❌ "Kode Jabatan & Kode Unit" di Blueprint. Konsolidasi `Unit Organisasi` (eNominasi) + `Unit Kerja` (eHRM) jadi satu hierarki. |
| `jabatan` | Master posisi/jabatan definitif | `kode_jabatan` UK | `status_jabatan='KOSONG'` = sumber untuk "Status Jabatan Kosong" (Input Manual/Master Data di Blueprint). |
| `pegawai` | Data biografis & posisi terkini | `nip` UK | `eselon`/`unit_kerja` TIDAK disimpan redundan di sini — diturunkan dari `jabatan_id → jabatan.eselon/unit_organisasi_id`. Kolom `riwayat_diklat` (JSON) menyimpan daftar nama diklat langsung di baris pegawai — lihat catatan §1 poin 6. |
| `riwayat_jabatan` | Histori jabatan (1-ke-banyak per pegawai) | FK `pegawai_id` | Simpan teks mentah + FK opsional ke `jabatan` setelah dibersihkan (Blueprint: 🟡 "Riwayat Jabatan Terstruktur"). |
| `riwayat_pendidikan` | Histori pendidikan | FK `pegawai_id` | Kolom sesuai mockup Blueprint (ijazah, transkrip, no. pertek BKN). |
| `kinerja_periode` | Rekap kinerja per triwulan/tahunan | FK `pegawai_id` | Sumber granular untuk `asesmen_talenta.rating_kinerja` (Blueprint: 🟡 "Rating Kinerja Numerik" perlu dibersihkan). |
| `hukuman_disiplin` | Rekam jejak disiplin | FK `pegawai_id` | Menutup gap ❌ "Data Hukuman Disiplin Resmi". Input manual, dipakai indikator Integritas & Moralitas (`KERANGKA TALENT POOL.md` §B.3). **Aturan skoring** (dipakai di data contoh, belum resmi dikonfirmasi — lihat PRD.md §10 poin 8): hanya baris dengan `status_aktif=1` yang menurunkan skor indikator; baris `status_aktif=0` (dianggap sudah tidak berlaku/kedaluwarsa) tidak memengaruhi skor Integritas & Moralitas berjalan. |

### 3.2 Rule Engine / Rubrik Penilaian

| Tabel | Fungsi | Catatan |
|---|---|---|
| `jabatan_target` | Profil "jabatan sasaran suksesi" — bisa mencakup beberapa jabatan definitif sekaligus (cth: gabungan Kepala Balai BP2JK + Kasubdit Pengadaan) | Menutup gap ❌ "Master Jabatan Target & Persyaratan". |
| `jabatan_target_anggota` | Junction many-to-many `jabatan_target` ↔ `jabatan` | |
| `jabatan_target_persyaratan` | Syarat minimal (pendidikan, bidang ilmu, dst) per jabatan target | Cth: "cek syarat jabatan Dit Pengadaan — minimal S1 semua jurusan" dari `KERANGKA TALENT POOL.md`. |
| `rubrik_komponen` | Komponen berbobot per sumbu (Y/X), `jabatan_target_id` NULL = rubrik generik Kotak 9 | Menutup gap ❌ "Master Jabatan Target & Rule Configuration" — bobot **bisa diubah dari UI**, bukan hardcode. |
| `rubrik_indikator` | Indikator berbobot per komponen, mendukung sub-indikator (self-FK `parent_indikator_id`) | Sub-indikator dipakai utk 3 sub-rubrik "Nilai Pengalaman Jabatan" (Lama/Keragaman/Substansi Jabatan). |
| `rubrik_kategori_skor` | Rubrik skor per indikator (kategori → nilai, atau ambang batas) | Merepresentasikan tabel-tabel skor di `KERANGKA TALENT POOL.md` (Sangat Baik=100, dst). |

### 3.3 Asesmen, Talent Pool & Workflow

| Tabel | Fungsi | Catatan |
|---|---|---|
| `asesmen_talenta` | Snapshot tahunan hasil e-Nominasi (Kotak 9 generik) | Data yang **sudah ada** ✅ per Blueprint. Setara `dtm_asesmen_talenta.csv`. |
| `match_score` | Skor kecocokan pegawai × jabatan target spesifik | Output komponen Blueprint #3 "Eligibility Check & Match Scoring". |
| `talent_pool` | Daftar kandidat final per jabatan target + status workflow | Output komponen #4 "Ranking, Gap Analysis & Talent Profile". |
| `nominasi` | Pengajuan nominasi oleh unit | Langkah "Nominasi Unit" di Garis Besar Proses. |
| `approval_log` | Log berjenjang persetujuan (bisa >1 tahap) | Langkah "Verifikasi Biro Kepegawaian" (lihat asumsi §6). |
| `rencana_pengembangan` | Rencana pengembangan suksesor | Sesuai `Lampiran B` (`manajemen talenta...md`) & langkah "Rencana Pengembangan". |

### 3.4 Sistem, Keamanan & Integrasi API

| Tabel | Fungsi | Catatan |
|---|---|---|
| `roles`, `users` | Pengguna internal & peran | Peran mengikuti Tim Kerja di `manajemen talenta...md` §07 (Champion, Core Team, dst) — dipetakan ke role sistem, lihat PRD. |
| `audit_log` | Jejak audit semua perubahan data | Output Modul Blueprint "Audit log dan ekspor laporan". |
| `api_client` | Instansi eksternal yang mengonsumsi API | Kolom `no_mou` untuk keterkaitan dasar hukum berbagi data (relevan UU PDP). |
| `api_token` | Token akses per klien (Bearer token) | Bisa lebih dari 1 token aktif per klien (rotasi). |
| `api_activity_log` | Log pemanggilan API eksternal | Untuk audit & pemantauan rate-limit. |
| `sync_log` | Log konsolidasi data dari eHRM/eNominasi/eKinerja | Output komponen Blueprint #1 "Data Consolidation & Cleansing". |

---

## 4. Peta Migrasi: Data Contoh (CSV) → Skema Baru

| Sumber (CSV existing) | Tujuan (tabel baru) | Transformasi |
|---|---|---|
| `dtm_pegawai.csv` | `pegawai` | `unit_organisasi`, `unit_kerja`, `eselon`, `jabatan_saat_ini` **tidak** disalin apa adanya — dipetakan manual ke `jabatan.id` (buat dulu master `jabatan`/`unit_organisasi`, lalu isi `pegawai.jabatan_id`). `tmt_golongan_pangkat` & `golongan` diparse ulang (lihat catatan kualitas di `Data DTM - README.md`) sebelum jadi `pegawai.tmt_golongan`/`golongan`. Kolom `riwayat_diklat` (array JSON dari `Data DTM.json`) disalin langsung ke `pegawai.riwayat_diklat` (JSON) — tidak lagi lewat tabel/CSV terpisah. |
| `dtm_asesmen_talenta.csv` | `asesmen_talenta` | Kolom sama persis (`potkom`, `nilai_integritas`, `kotak_9`, dst) + tambahan `nilai_kinerja_y`/`nilai_potensial_x`/`nilai_talenta` yang dihitung ulang dari rubrik (bisa dihitung mundur dari `rating_kinerja` & `potkom` yang sudah ada). |
| `dtm_riwayat_jabatan.csv` | `riwayat_jabatan` | `nama_jabatan` → `jabatan_nama_mentah`. `jabatan_id` diisi NULL dulu (butuh pemetaan manual/fuzzy-match ke master `jabatan`). |
| `dtm_riwayat_pendidikan.csv` | `riwayat_pendidikan` | Teks seperti `"S2 SISTEM DAN TEKNIK TRANSPORTASI"` perlu di-parse jadi `jenjang_pendidikan='S2'` + `bidang_studi='SISTEM DAN TEKNIK TRANSPORTASI'` — **tidak seragam** di data contoh (ada yang prefix `"DIII ..."`, ada yang `"S1 FIS ADMINISTRASI"`), perlu aturan parsing atau normalisasi manual saat migrasi. |
| — (belum ada sumber) | `hukuman_disiplin`, `jabatan_target*`, `rubrik_*`, `match_score`, `talent_pool`, `nominasi`, `approval_log`, `rencana_pengembangan`, `users`, `roles`, `api_client`, `api_token`, `audit_log`, `sync_log` | Tabel baru, mulai kosong — diisi lewat UI begitu modul terkait dibangun (lihat PRD §Fase Implementasi). |

**Isu kualitas data dari sample (dari `Data DTM - README.md`) yang harus diselesaikan *sebelum* migrasi produksi:**
- Format tanggal TMT tidak konsisten antar baris → wajib dinormalisasi ke `DATE` MySQL.
- Kasus "Irwan": `Unit Kerja` kemungkinan salah tempel (isinya teks jabatan) → perlu verifikasi manual ke eHRM sebelum masuk `pegawai.jabatan_id`.
- Format Golongan campur (`IV.b` vs `III/d`) → seragamkan format sebelum masuk kolom `golongan`.
- `nilai_integritas` bisa desimal (3.5) → sudah diantisipasi dengan `DECIMAL`, bukan `INT`, konsisten dari `Data DTM - README.md`.

---

## 5. Asumsi & Hal yang Perlu Dikonfirmasi

Sebelum implementasi, tolong konfirmasi poin-poin berikut (aku ambil asumsi paling masuk akal, tapi ini keputusan bisnis yang sebaiknya divalidasi):

1. **"Verifikasi Biro Kepegawaian"** di Garis Besar Proses — asumsi ini merujuk ke **Bagian Kepegawaian dan Umum DJBK sendiri** (bukan Biro Kepegawaian & Ortala Kementerian PU, yang di peta stakeholder berperan sebagai *Latens*/pembina kebijakan, bukan operasional harian). Kalau ternyata verifikasi memang harus lewat Kementerian, perlu tabel `approval_log.tahap` tambahan + role baru.
2. **Agregasi 3 sub-indikator "Nilai Pengalaman Jabatan"** (Lama Jabatan, Keragaman Riwayat Jabatan, Substansi Riwayat Jabatan) — skema `rubrik_indikator` sudah mendukung struktur sub-indikator, tapi metode gabungnya (rata-rata sederhana? bobot custom per sub-indikator?) belum ditentukan di dokumen sumber manapun.
3. **Satu pegawai bisa masuk banyak `talent_pool`** untuk jabatan target berbeda secara bersamaan (diasumsikan YA — relasi many-to-many via baris `talent_pool` terpisah).
4. **Level data yang boleh dibagi ke instansi eksternal via API** — asumsi: berbasis `scope_akses` per klien (bisa dibatasi read-only, bisa dibatasi ke data agregat saja tanpa NIP/nama individu, tergantung ada/tidaknya MoU). Perlu ketentuan resmi (rujukan UU PDP No. 27/2022 karena ini data ASN).
5. **Autentikasi user internal** — asumsi: akun lokal (email/username + password) untuk fase awal; integrasi SSO Kementerian PU (kalau ada) bisa menyusul di fase panjang.

---

*Dokumen ini adalah rancangan skema (DDL belum dibuat). Setelah diaudit dan poin §5 dikonfirmasi, DDL MySQL (atau schema Prisma) bisa disusun 1:1 dari struktur di atas.*
