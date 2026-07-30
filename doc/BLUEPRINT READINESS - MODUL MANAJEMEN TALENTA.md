# Blueprint Readiness — Modul Manajemen Talenta

**Peningkatan Fitur pada Aplikasi Existing:** *karir.pu.go.id*

*Fokus: validasi kesiapan data, rule engine talent pool, workflow nominasi, dan rencana implementasi*

---

## 1. Tujuan Pengembangan

- Mengonsolidasikan data talenta pegawai dari beberapa sumber
- Menampilkan kandidat potensial untuk jabatan target
- Mendukung proses nominasi, verifikasi, dan penetapan talent pool
- Menyediakan dasar pengembangan talenta dan suksesi jabatan

---

## 2. Sumber Data yang Sudah Diidentifikasi

### eNominasi
- NIP
- Nama Pegawai
- Jabatan
- Eselon
- Pangkat
- TMT Gol/Pangkat
- Unit Organisasi
- Jenjang
- Tahun Asesmen
- Jenis Asesmen
- Status Asesmen
- Potensi & Kompetensi (Potkom)
- Nilai Integritas
- Tahun Kinerja
- Rating Kinerja
- Kotak 9

### eHRM
- Nama Lengkap
- NIP
- TMT Golongan
- Golongan
- Nama Jabatan (termasuk riwayat)
- Unit Kerja
- TMT Jabatan
- Riwayat Diklat/Sertifikasi
- Sekolah
- Bidang Studi/Jurusan
- Tingkat Pendidikan
- Riwayat Pendidikan

### eKinerja
- Rating/Predikat Kinerja
- Tahun Kinerja
- Sumber nilai kinerja final

### Input Manual / Master Data
- Persyaratan Jabatan Target
- Bobot Penilaian
- Status Jabatan Kosong
- Data Hukuman Disiplin
- Catatan Reviewer

---

## 3. Status Readiness Data

| Item | Sudah Ada | Sebagian / Perlu Dibersihkan | Belum Ada / Perlu Disiapkan |
|---|:---:|:---:|:---:|
| Identitas Pegawai | ✅ | | |
| Hasil Asesmen & Kotak 9 | ✅ | | |
| Riwayat Pendidikan | ✅ | | |
| Riwayat Diklat / Sertifikasi | ✅ | | |
| Rating Kinerja Numerik | | 🟡 | |
| Status Asesmen Valid & Masa Berlaku | | 🟡 | |
| Riwayat Jabatan Terstruktur | | 🟡 | |
| Kode Jabatan & Kode Unit | | | ❌ |
| Master Jabatan Target & Persyaratan | | | ❌ |
| Data Hukuman Disiplin Resmi | | | ❌ |
| Workflow Nominasi & Approval | | | ❌ |

---

## 4. Komponen yang Akan Dikembangkan

1. **Data Consolidation & Cleansing**
2. **Master Jabatan Target & Rule Configuration**
3. **Eligibility Check & Match Scoring**
4. **Ranking, Gap Analysis & Talent Profile**
5. **Workflow Nominasi, Approval & Implementasi ke Aplikasi Existing**

---

## 5. Garis Besar Proses

**Konsolidasi Data** → **Validasi & Normalisasi** → **Seleksi Kelayakan** → **Hitung Match Score** → **Ranking Kandidat** → **Nominasi Unit** → **Verifikasi Biro Kepegawaian** → **Talent Pool Final** → **Rencana Pengembangan** → **Implementasi pada Aplikasi Existing**

---

## 6. Formula Dasar

### A. Nilai Talenta (Pemetaan Generik)

**50% Nilai Kinerja + 50% Nilai Potensial**

### B. Match Score Jabatan

**65% Potensi & Kompetensi + 20% Kualifikasi Jabatan + 15% Integritas & Moralitas**

> Kualifikasi Jabatan (20%) terdiri dari: Pendidikan 5%, Bidang Ilmu 5%, Diklat/Sertifikasi 5%, Pengalaman Jabatan 5%

---

## 7. Output Modul

- Dashboard sebaran Kotak 9
- Daftar kandidat per jabatan target
- Talent profile pegawai
- Perbandingan kandidat
- Gap analysis dan kebutuhan pengembangan
- Laporan nominasi & approval
- Audit log dan ekspor laporan

---

**Posisi saat ini:** tahap asesmen readiness data & perumusan requirement.
**Tahap berikutnya:** finalisasi rule, blueprint teknis, presentasi awal September, lalu implementasi pada aplikasi existing.
