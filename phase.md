# phase.md — Rencana Implementasi SIMT DJBK

Rencana eksekusi teknis untuk membangun aplikasi dari desain di [`doc/`](doc/). Dokumen ini **pelengkap**: [`doc/PRD.md`](doc/PRD.md) menentukan *apa* yang dibangun, [`doc/ERD.md`](doc/ERD.md) *struktur datanya*, [`doc/KERANGKA TALENT POOL.md`](doc/KERANGKA%20TALENT%20POOL.md) *aturan penilaiannya*, dan `phase.md` mengatur *urutan kerja, standar mutu, dan keputusan teknis*.

**Titik mulai:** Dashboard dulu, **tanpa auth**. Auth & RBAC di Fase 7 — tapi kode disiapkan supaya penyisipannya cuma menyentuh satu file (§5.6).

---

## 1. Hierarki Kebenaran — baca ini dulu

Urutan otoritas saat ada yang tidak cocok:

| Prioritas | Sumber | Perannya |
|:--:|---|---|
| **1** | [`KERANGKA TALENT POOL.md`](doc/KERANGKA%20TALENT%20POOL.md) + Lampiran A [`manajemen talenta...md`](doc/manajemen%20talenta%2027%20juli%20utk%20tim%20SIM.md) | **Aturan penilaian.** Rubrik, bobot, ambang, klasifikasi Kotak 9. Kode wajib mengikuti ini. |
| **2** | [`BLUEPRINT READINESS...md`](doc/BLUEPRINT%20READINESS%20-%20MODUL%20MANAJEMEN%20TALENTA.md) | **Sumber & kesiapan data.** Field apa datang dari eHRM/eNominasi/eKinerja, mana yang masih ❌/🟡. |
| **3** | `PRD.md` / `ERD.md` | Halaman & struktur data. |
| **4** | `doc/sql/*` (isi `pupr_dev`) | **Data dummy dev.** Alat uji, bukan bukti. |

**Konsekuensi praktis:** kalau isi database bentrok dengan rubrik di doc, **database-nya yang dibetulkan**, bukan rubriknya yang ditawar. Data produksi belum terkumpul (Blueprint §3 masih banyak 🟡/❌) — jadi dummy kita tugasnya cuma satu: **jadi dataset yang konsisten dengan rubrik dan cukup beragam untuk menguji semua cabang logika & semua keadaan UI.**

`doc/Data DTM.json` + CSV turunannya tetap disimpan **apa adanya** sebagai rekaman contoh mentah dari e-Nominasi/eHRM. Setelah normalisasi (§4), isi `pupr_dev` akan sengaja **berbeda** dari CSV itu — itu disengaja, bukan drift.

---

## 2. Aturan Mengikat dari Dokumen — spesifikasi `lib/scoring`

Ini yang diimplementasikan, dikunci, dan diuji. Tidak ada improvisasi di sini.

### 2.1 Skala & pembulatan
- Semua nilai skor berada di **0–100**. Nilai dari sumber yang keluar rentang **di-clamp saat impor** (`lib/importer`), sehingga isi DB selalu 0–100 dan tidak ada lapisan aplikasi yang perlu tahu soal clamp.
- Nilai mentah pra-clamp disimpan di `sync_log`/staging untuk jejak, tidak di tabel domain.
- Simpan `DECIMAL(6,2)`; pembulatan hanya di titik penyajian (`lib/format.ts`), bukan di tengah perhitungan.

### 2.2 Formula A — Nilai Talenta (generik, Kotak 9)
```
nilai_kinerja_y   = skor predikat kinerja        (Sangat Baik 100 · Baik 80 · Butuh Perbaikan 60 · Kurang 40 · Sangat Kurang 20)
nilai_potensial_x = skor rubrik sumbu X generik  (rubrik_komponen dengan jabatan_target_id IS NULL)
nilai_talenta     = 0.5 × nilai_kinerja_y + 0.5 × nilai_potensial_x
```

### 2.3 Klasifikasi sumbu & Kotak 9 (Lampiran A)
```
Sumbu Y: ≥80 Di Atas Ekspektasi · ≥60–<80 Sesuai Ekspektasi · <60 Di Bawah Ekspektasi
Sumbu X: ≥80 Tinggi            · ≥60–<80 Menengah          · <60 Rendah

              Rendah  Menengah  Tinggi
Di Atas          4        7        9
Sesuai           2        5        8
Di Bawah         1        3        6
```
`kotak_9` **selalu hasil hitung** dari (Y, X) — bukan kolom yang diisi bebas. Nilai yang datang dari impor dipakai hanya sebagai **pembanding**: kalau beda, baris masuk **Antrian Pembersihan Data** (§6).

### 2.4 Formula B — Match Score per jabatan target
```
skor_potensi_kompetensi   ← Potkom jabatan saat ini            bobot 0.65
skor_kualifikasi_jabatan  ← rata-rata tertimbang 4 indikator   bobot 0.20
skor_integritas_moralitas ← rubrik rekam jejak disiplin        bobot 0.15
skor_total = Σ (skor komponen × bobot komponen)
```
Kualifikasi Jabatan (20%) = 4 indikator @5%: Tingkat Pendidikan Formal · Kesesuaian Bidang Ilmu · Pengembangan Kompetensi · Nilai Pengalaman Jabatan.
Nilai Pengalaman Jabatan = agregat 3 sub-indikator: Lama Jabatan · Keragaman Riwayat Jabatan · Substansi Riwayat Jabatan.

### 2.5 Agregasi berjenjang — generik, tanpa angka ajaib
```
nilaiNode = Σ(nilaiAnak × bobotAnak) / Σ(bobotAnak)
```
Node dengan `bobot_indikator = NULL` (sub-indikator) → bobot dianggap sama rata. Node induk tanpa `rubrik_kategori_skor` = **agregator murni**.
**Jangan pernah hardcode `/4` atau `/3`** — jumlah indikator bisa berubah dari UI editor rubrik. Rata-rata sederhana untuk sub-indikator masih perlu konfirmasi resmi (`ERD.md` §5.2) tapi dipakai sebagai default.

### 2.6 Dua mode skor indikator
| Mode | Perilaku | Contoh |
|---|---|---|
| `KATEGORI_TETAP` | nilai mentah → dicocokkan ke `rubrik_kategori_skor` → ambil `nilai_skor` | predikat kinerja → 100/80/60/40/20 |
| `NILAI_LANGSUNG` | nilai mentah dipakai apa adanya sebagai skor; kategori hanya label | Potkom → skor = Potkom |

### 2.7 Rubrik Integritas & Moralitas (satu-satunya skala integritas)
`Tidak pernah` 100 · `Ringan` 75 · `Sedang` 50 · `Berat` 25 · `Sedang Menjalani` 0 — diambil dari `hukuman_disiplin` **baris `status_aktif=1` dengan tingkat terberat**. Baris `status_aktif=0` tidak menurunkan skor (`PRD.md` §10.8, masih perlu konfirmasi resmi).

Kolom `asesmen_talenta.nilai_integritas` **memakai skala yang sama (0–100)**. Ini keputusan penyeragaman: `KERANGKA TALENT POOL.md` hanya mendefinisikan integritas pada 0–100, dan menyimpan dua skala berbeda dengan nama nyaris identik adalah sumber salah baca yang tidak perlu. Kalau nanti e-Nominasi mengirim skala lain, **importer yang menormalisasi** (§6).

### 2.8 Aturan yang harus **ditutup lubangnya** sebelum dikodekan

Dua hal di rubrik sumber tidak mendefinisikan seluruh rentang. Keputusan di bawah dipilih supaya **setiap pernyataan literal di doc tetap benar**, hanya rentang yang menganga yang diisi:

**a. Lama Jabatan** — doc: `≥5 thn → 100`, `3 s.d. 4 thn → 80`, `<2 thn → 60`. Rentang (4,5) dan [2,3) tidak terdefinisi.
> **Keputusan:** `≥5 → 100` · `≥2–<5 → 80` · `<2 → 60`. Kedua pernyataan literal doc tetap utuh ("5 ke atas"=100, "kurang dari 2"=60); hanya band tengah yang dilebarkan agar kontinu.

**b. Aturan umum untuk semua rubrik ambang:** `lib/scoring` **wajib** punya fallback tertulis untuk nilai yang tidak masuk kategori mana pun → ambil kategori terdekat di bawah + set `perluReview = true`. Tidak boleh `0` senyap atau `undefined`. Editor rubrik (Fase 5) memvalidasi kontinuitas & tumpang-tindih `ambang_min`/`ambang_max` saat simpan.

### 2.9 Masa berlaku asesmen
Blueprint menandai "Status Asesmen Valid & Masa Berlaku" 🟡 — belum ada aturannya.
> **Keputusan:** masa berlaku = **3 tahun** sejak `tahun_asesmen`, disimpan sebagai **parameter sistem** (bukan konstanta di kode) agar bisa diubah tanpa deploy. `isExpired` dihitung turunan; `status_asesmen` dari sumber jadi pembanding. Asesmen kedaluwarsa **tidak eligible** untuk talent pool dan ditandai jelas di UI.

---

## 3. Konsekuensi Desain yang Lahir dari Rubrik Itu Sendiri

Empat hal berikut **bukan** anomali data — ini sifat rumus di doc, jadi tetap berlaku betapa pun bersihnya data nanti. Semuanya berdampak langsung ke desain halaman.

### K-1 · Sumbu Y hanya punya 5 nilai diskrit
Predikat → 100/80/60/40/20. Tidak ada nilai di antaranya.
> **Dampak:** peta talenta efektifnya **5 baris**, bukan kontinu. Scatter Y×X **wajib pakai jitter vertikal** — tanpa itu semua orang berpredikat "Baik" bertumpuk jadi satu titik. Untuk tren kinerja per pegawai gunakan `kinerja_periode.nilai_kinerja` (granular 60–100 per triwulan), **bukan** `nilai_kinerja_y`.

### K-2 · Baris atas Kotak 9 menyerap predikat "Baik" ke atas
Ambang Di Atas Ekspektasi adalah **≥80 inklusif**, dan "Baik" tepat bernilai 80. Jadi semua pegawai berpredikat Baik atau Sangat Baik otomatis masuk baris teratas. Karena di organisasi nyata mayoritas ASN berpredikat Baik/Sangat Baik, grid akan **selalu berat di atas**.
> **Dampak:** grid 3×3 tetap wajib (regulasi BKN), tapi tidak boleh berdiri sendiri: tampilkan **jumlah + persentase**, intensitas warna **relatif terhadap sel terpadat** (bukan skala absolut), dan sediakan scatter sebagai pendamping supaya sebaran *di dalam* satu sel terlihat.

### K-3 · Label predikat vs label kategori sumbu tidak sejalan
Predikat **"Butuh Perbaikan"** → nilai 60 → kategori sumbu **"Sesuai Ekspektasi"**. Secara bahasa itu bertolak belakang.
> **Dampak:** di UI, **jangan campur dua taksonomi ini dalam satu kolom**. Tampilkan predikat sebagai predikat ("Butuh Perbaikan") dan kategori sumbu sebagai kategori ("Sesuai Ekspektasi"), masing-masing berlabel jelas sumbernya. Tooltip menjelaskan pemetaannya.

### K-4 · Match Score tidak mengandung unsur kinerja
Formula B = 65% Potkom + 20% Kualifikasi + 15% Integritas — ketiganya komponen **sumbu X**. Secara matematis Match Score **identik** dengan Nilai Potensial versi rubrik jabatan target; sumbu Y tidak masuk sama sekali.
> **Dampak:** ranking talent pool bisa menaruh pegawai berpredikat rendah di peringkat atas kalau Potkom-nya tinggi. **Jangan ubah rumusnya** (itu keputusan bisnis). Yang wajib: di halaman Kandidat & Talent Pool, kolom **Kotak 9 + predikat kinerja tampil berdampingan** dengan match score, plus filter cepat "hanya Kotak 7/8/9" dan sort sekunder pada `nilai_kinerja_y`. Ranking tanpa konteks kinerja tidak boleh disajikan sendirian.
> **Usul opsional (U-11):** tambah `jenis_syarat` kinerja di `jabatan_target_persyaratan` supaya bisa memasang syarat minimal predikat/Kotak 9 — perlu keputusan bisnis.

### K-5 · Skala dev vs produksi: 117×
`manajemen talenta...md` §Latar Belakang: **1.872 ASN**, **48 unit kerja & UPT**, 67% jabatan fungsional. Dev saat ini 16 pegawai.
> **Aturan yang mengikat sejak Fase 1:** (a) agregasi dashboard **wajib di SQL** (`GROUP BY`), bukan `SELECT *` lalu `.reduce()`; (b) semua tabel **server-side pagination + filter + sort** sejak awal, tidak ada "nanti dioptimasi"; (c) `scripts/seed-volume.ts` (±2.000 pegawai, database `pupr_dev_volume`) jadi **gerbang penyelesaian Fase 1**, bukan aktivitas Fase 10.

### K-6 · NIP menyimpan data yang tidak ada di kolom mana pun
`pegawai` tidak punya `tanggal_lahir` maupun `jenis_kelamin`, tapi NIP 18 digit ASN berformat `YYYYMMDD`(lahir) + `YYYYMM`(TMT CPNS) + `S`(1=L, 2=P) + `NNN`. Sudah diuji ke 16 baris dev: **terparse 100%**, hasil konsisten (usia 30–58, TMT CPNS 1993–2020).
> **Peluang tanpa tambah kolom & tanpa menunggu data baru:** usia, **proyeksi BUP** (58/60/65 tergantung jenis jabatan), masa kerja ASN, piramida usia & komposisi gender per unit, serta **validasi format NIP** sebagai aturan kualitas data. Ini yang menutup Lampiran B langkah 2 ("jabatan kritis yang **berisiko** kekosongan") yang belum tercakup PRD — lihat U-6. Semua nilai bersifat **turunan** di `lib/nip.ts`, tidak didenormalisasi ke kolom baru.

---

## 4. Rapikan & Perkaya Data Dev (Fase 0.5)

Data dev sekarang tidak konsisten dengan §2 dan sebarannya kurang untuk menguji UI. Karena ini dummy dan kita yang pegang, dirapikan langsung. Semua perubahan lewat file baru di `doc/sql/` (bukan mengedit `002`/`003` yang sudah tereksekusi), supaya riwayatnya jelas dan bisa diulang dari nol.

### 4.1 Kondisi sekarang yang harus dibetulkan

| Hal | Kondisi sekarang | Target |
|---|---|---|
| `potkom` / `nilai_potensial_x` | 5 baris >100 (tertinggi 115.10), `nilai_talenta` bisa 106.00 | semua 0–100, sebaran menyilang tiga band X |
| `kotak_9` | tidak semuanya cocok dengan hitungan Lampiran A | **100% hasil hitung** dari (Y, X) |
| `asesmen_talenta.nilai_integritas` | skala kecil 1–3.5 | 0–100, konsisten §2.7 dan sinkron dengan `hukuman_disiplin` |
| Sebaran Kotak 9 | 10 dari 16 (62.5%) di kotak 9; kotak 1,3,5,6,8 kosong | **kesembilan kotak terisi** (§4.3) |
| `riwayat_jabatan.tanggal_mulai`/`tanggal_akhir` | NULL 35/35 | terisi semua → Lama Jabatan bisa **otomatis** |
| `riwayat_jabatan.jabatan_id` | NULL 19/35 | terpetakan, kecuali riwayat di luar DJBK (ditandai eksplisit) |
| `riwayat_jabatan` variasi Plt/Plh | tidak ada | tambahkan beberapa → sub-indikator Substansi Riwayat Jabatan bisa diuji |
| `riwayat_pendidikan` | `tahun_lulus` NULL 17/26, `nama_sekolah` NULL 8/26, arsip NULL 26/26 | tahun & sekolah terisi; arsip terisi **sebagian saja** supaya UI menguji dua keadaan (ada arsip / belum) |
| `pegawai.golongan` | dua format (`IV.a` vs `IV/a`) | satu format: **garis miring** (`IV/b`) |
| `jenis_asesmen` | `PENGAWAS` vs `Pengawas`; `JPT Pertama` vs `JPT Pratama` | Title Case + istilah terkini (`JPT Pratama`) |
| `status_asesmen` | ada baris tahun 2026 berstatus `Expired` | konsisten dengan aturan masa berlaku 3 tahun (§2.9) |
| `hukuman_disiplin` | 2 baris (Ringan aktif, Sedang nonaktif) | tambah `Berat` & `Sedang Menjalani` → kelima kategori rubrik terpakai |
| `match_score` | nilai hasil hitung manual | **dihitung ulang oleh `lib/scoring`** + baris `match_score_detail` |
| `jabatan` status `KOSONG` | 2 baris | 5–6 baris, tersebar di beberapa unit → widget Jabatan Kosong jadi berarti |

### 4.2 Perluasan volume & keragaman
- `pegawai` **16 → ±40**, tersebar ke lebih banyak unit & jenjang (Blueprint: 67% fungsional → jaga proporsi itu).
- `unit_organisasi` 17 → ±28, `jabatan` 16 → ±40 → dropdown filter jadi realistis dan tree unit punya kedalaman nyata.
- `kinerja_periode`: pastikan **semua** pegawai punya TW1–TW3 + TAHUNAN (sekarang hanya 6 dari 16) → grafik tren tidak bolong.
- `asesmen_talenta`: beberapa pegawai punya **>1 tahun asesmen** → halaman "histori Kotak 9 per tahun" punya isi, dan filter tahun tidak memecah data jadi 1 orang per tahun.
- `nominasi` / `approval_log`: tambah kasus **DITOLAK** dan **REVISI** (sekarang cuma jalur mulus) → UI workflow teruji di semua cabang.
- `api_activity_log`: tambah beberapa baris response 401/403/429 → halaman Log Aktivitas API punya kasus anomali untuk ditampilkan.

### 4.3 Target sebaran Kotak 9
Perlu variasi predikat sampai ke bawah, karena baris tengah/bawah cuma bisa dihuni predikat "Butuh Perbaikan" ke bawah (K-2). Target indikatif untuk ±40 pegawai — realistis tapi kesembilan sel terisi:

| | Rendah (<60) | Menengah (60–<80) | Tinggi (≥80) |
|---|:--:|:--:|:--:|
| **Di Atas Ekspektasi** (Sangat Baik / Baik) | **4** → 4 org | **7** → 6 org | **9** → 8 org |
| **Sesuai Ekspektasi** (Butuh Perbaikan) | **2** → 5 org | **5** → 5 org | **8** → 5 org |
| **Di Bawah Ekspektasi** (Kurang / Sangat Kurang) | **1** → 3 org | **3** → 2 org | **6** → 2 org |

### 4.4 Berkas yang dihasilkan
| Berkas | Isi |
|---|---|
| `doc/sql/004_normalisasi_data_dev.sql` | perbaikan format & skala (golongan, jenis_asesmen, nilai_integritas, potkom, status_asesmen), rapikan `rubrik_kategori_skor` Lama Jabatan sesuai §2.8a |
| `doc/sql/005_match_score_detail.sql` | DDL tabel baru `match_score_detail` (U-3) |
| `doc/sql/006_seed_perluasan.sql` | tambahan unit/jabatan/pegawai/riwayat/kinerja/asesmen/nominasi sesuai §4.2–4.3 |
| `doc/sql/007_recompute.sql` *(dihasilkan program)* | `kotak_9`, `nilai_*`, `match_score`, `match_score_detail`, `talent_pool.ranking` — **output `lib/scoring`, bukan tulisan tangan** |

`ERD.md` diperbarui untuk `match_score_detail` (+ `notifikasi` di Fase 6). `PRD.md` diperbarui untuk keputusan ORM & usulan halaman yang disetujui.

> **Prinsip:** angka di `pupr_dev` harus bisa **dilahirkan ulang** oleh `lib/scoring` dari data mentah. Kalau ada angka di DB yang tidak bisa direproduksi kode, salah satunya salah — dan itu harus ketahuan lewat test, bukan lewat mata.

---

## 5. Keputusan Teknis

| Aspek | Keputusan | Alasan |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript strict** | PRD §4.3 |
| Styling | **Tailwind CSS v4**, token warna sebagai CSS variables | CLAUDE.md: token, bukan warna hardcoded |
| Akses DB | **Drizzle ORM + mysql2** ✅ *(disetujui)*, skema di-*introspect* dari `pupr_dev` (`drizzle-kit pull`) | `001_schema.sql` sudah jadi sumber kebenaran → tipe TS diturunkan dari DB, tidak ada skema paralel yang bisa drift (CLAUDE.md #3). SQL agregat mentah mudah — wajib karena K-5. **`PRD.md` §4.3 perlu diperbarui** (di sana masih tertulis rekomendasi Prisma). |
| Migrasi | file `.sql` bernomor di `doc/sql/` sebagai satu-satunya jalur perubahan skema; `drizzle-kit pull` menyusul setelahnya | skema tetap bisa dibaca manusia & 1:1 dengan ERD |
| Validasi | **Zod** di boundary (server action & route handler) | PRD §4.3 poin 5 |
| Mutasi | **Server Actions** + `revalidateTag` | pending state gratis lewat `useFormStatus` |
| Chart | **Recharts**, dibungkus di `components/charts/*` | komposabel, SSR-friendly, warna dari CSS variable → satu sumber untuk light & dark |
| Kotak 9 & heatmap | **CSS Grid tangan sendiri** | lebih tajam, tema-native, 9 sel tidak butuh library |
| Tabel | **TanStack Table** (headless) + state di URL | data-dense, kontrol kolom, tetap server-side |
| Tema | provider `class`-based + `data-theme`, skrip inline anti-flash | CLAUDE.md: light & dark wajib sejak awal |
| Ikon | **lucide-react** | netral, tanpa emoji dekoratif |
| Format | `Intl.NumberFormat('id-ID')` + `date-fns` locale `id`, terpusat di `lib/format.ts` | satu sumber format |
| Test | **Vitest** untuk `lib/scoring` (wajib) · **Playwright** smoke per fase (skill `webapp-testing`) | scoring = logika bisnis inti |
| Auth | **ditunda** ke Fase 7; sementara `getCurrentUser()` baca cookie dev + role switcher di navbar, dijaga env flag | §5.6 |

### 5.1 Struktur folder
```
app/
  (app)/                        # app shell: sidebar + navbar + breadcrumb
    layout.tsx  page.tsx        # Dashboard Utama
    loading.tsx                 # skeleton dashboard
    talenta/[nip]/              # Direktori & Profil Talenta 360°
    peta-talenta/               # Kotak 9 + scatter
    bandingkan/                 # Perbandingan Kandidat
    jabatan-target/[id]/        # Editor rubrik, kandidat & eligibility
    talent-pool/  nominasi/
    master/                     # unit, jabatan, hukuman disiplin
    data/                       # konsolidasi, antrian pembersihan, kelengkapan
    laporan/  admin/
  api/
    internal/                   # hanya untuk yang tak bisa server action (ekspor, webhook)
    v1/                         # API eksternal bertoken (Fase 9)
lib/
  db/            # klien drizzle + skema hasil introspect (jangan diedit tangan)
  scoring/       # SATU sumber kebenaran: formulaA, formulaB, kotak9, agregasi, eligibility, fallback
  importer/      # clamp, normalisasi, validasi saat impor  (§6)
  nip.ts         # parser & validator NIP  (K-6)
  normalisasi.ts # golongan, jenis_asesmen, jenjang pendidikan
  kelengkapan.ts # skor kelengkapan data  (U-2)
  format.ts      # formatter id-ID
  auth.ts        # getCurrentUser() — satu-satunya file yang berubah di Fase 7
components/
  ui/            # Button, Skeleton, Badge, DataTable, EmptyState, ErrorState, Dialog, Toast
  charts/        # wrapper chart sadar tema
  layout/        # Sidebar, Navbar, Breadcrumb, ThemeToggle, CommandPalette
scripts/
  seed-volume.ts # generator ±2.000 pegawai untuk uji performa  (K-5)
  recompute.ts   # jalankan lib/scoring ke seluruh DB → hasilkan 007_recompute.sql
```

**Aturan anti-duplikasi (CLAUDE.md #1 & #2):** sebelum menulis helper baru, `grep` dulu di `lib/`. Rumus skoring **hanya boleh** ada di `lib/scoring`, dipakai bersama oleh server component, server action, job terjadwal, dan `api/v1`. Rumus yang sama muncul di dua file = bug.

### 5.2 Tidak ada klik mati
- Setiap tombol aksi punya **pending state**: `disabled` + spinner + label berubah ("Simpan" → "Menyimpan…"), via `useFormStatus` (form) atau `useTransition` (non-form).
- Aksi destruktif → dialog konfirmasi, dan tombol konfirmasinya juga punya pending state.
- Proses panjang (recompute match score, ekspor) → progress determinate kalau langkahnya diketahui, indeterminate + estimasi kalau tidak.
- Anti double-submit: idempotency di server action, bukan cuma `disabled` di klien.

### 5.3 Skeleton, bukan spinner
- `loading.tsx` per segmen route, skeleton **meniru layout akhir**: jumlah baris = ukuran halaman, lebar kolom & tinggi baris sama → **nol layout shift**.
- Dashboard: `<Suspense>` **per widget** → shell + sidebar + judul tampil instan, tiap kartu terisi sendiri (streaming SSR). Bukan satu spinner besar.
- Chart: skeleton dengan **rasio aspek sama**, bukan kotak berisi spinner.
- Satu primitif `<Skeleton/>` + komposisi (`<TableSkeleton rows={20}/>`, `<ChartSkeleton ratio="16/9"/>`). Tidak ada skeleton ad-hoc per halaman.
- Refetch karena filter berubah: **pertahankan data lama** dalam keadaan dim + progress bar tipis di atas tabel — **jangan** kembali ke skeleton.

### 5.4 Tiga keadaan kosong yang dibedakan
| Keadaan | Tampilan |
|---|---|
| **Belum ada data sama sekali** | penjelasan + **tombol aksi utama** ("Buat jabatan target") |
| **Filter tidak menghasilkan apa pun** | pesan berbeda + "Reset filter" + ringkasan filter aktif |
| **Error** | `error.tsx` per segmen + "Coba lagi"; error boundary **per widget** agar 1 kartu gagal tidak menjatuhkan seluruh dashboard |

### 5.5 Chart profesional
- Warna dari CSS variable → satu definisi untuk light & dark, tanpa warna hardcoded di komponen chart.
- Sumbu: satuan jelas, `tabular-nums`, format id-ID.
- Tooltip menampilkan angka **dan** konteks (kategori rubrik, tahun asesmen), bukan angka telanjang.
- Tanpa gradient dekoratif, tanpa 3D, animasi masuk ≤200ms. Grid line tipis, whitespace dominan — arah "profesional seperti Notion" (CLAUDE.md).
- Semua chart punya padanan **tabel data** (toggle "Lihat sebagai tabel") — aksesibilitas + staf sering perlu menyalin angka.
- Setiap chart mencantumkan **basis datanya** ("40 pegawai · asesmen berlaku · 3 dikecualikan").
- Sumbu nilai `max = Math.max(100, dataMax)` sebagai pertahanan berlapis — walau §2.1 menjamin data 0–100, chart tidak boleh memotong titik kalau ada yang lolos.

### 5.6 Menunda auth tanpa menimbun utang teknis
- Semua akses identitas lewat **satu fungsi** `lib/auth.ts → getCurrentUser()`. Fase 1–6: baca cookie dev `simt_dev_user`; Fase 7: ganti isinya dengan sesi asli. **Tidak ada komponen yang membaca cookie langsung.**
- Navbar punya **Dev Role Switcher** (8 user seed, password `password123`) agar UI bergantung-role bisa dibangun & diuji sekarang. Dijaga `NEXT_PUBLIC_DEV_ROLE_SWITCH === '1'`, **wajib mati** di build produksi.
- Guard ditulis sejak awal sebagai `assertRole(user, [...])` di server action, aktif sejak Fase 1 memakai user dev → tidak ada "tambal RBAC" belakangan.
- Halaman Login/Lupa Password (PRD §6.1) dikerjakan di Fase 7, tidak dibuat kerangka kosong sekarang.

### 5.7 Detail densitas & navigasi
- `tabular-nums` untuk semua angka supaya kolom tidak bergoyang saat sorting.
- Baris tabel → prefetch on hover ke halaman detail.
- Semua filter & pagination **tersinkron ke URL** (`?unit=&tahun=&page=`) → bisa di-bookmark, tombol back berfungsi, link bisa dikirim ke pimpinan.
- Pencarian: debounce 300ms + indikator "mencari…" di dalam field.
- Command palette `Ctrl/⌘+K` (U-8). Header tabel sticky; kolom NIP+Nama sticky saat scroll horizontal.
- Setiap komponen baru dicek di **kedua tema** sebelum dianggap selesai (CLAUDE.md).

---

## 6. Kebutuhan Importer Produksi (`lib/importer`, dipakai Fase 4)

Data contoh dari eHRM/eNominasi menunjukkan bentuk-bentuk yang akan datang lagi dari sistem sumber. Ini **bukan** perdebatan aturan — ini daftar tugas validasi & normalisasi supaya isi DB produksi selalu memenuhi §2. Tiap pelanggaran tidak dibuang, tapi dicatat dan muncul di **Antrian Pembersihan Data**.

| # | Bentuk yang pernah muncul di data contoh | Perlakuan importer |
|---|---|---|
| 1 | Potkom di luar 0–100 (sampai 115.10) | clamp ke 0–100, simpan nilai mentah di jejak sync, tandai baris |
| 2 | `kotak_9` dari sumber beda dengan hitungan Lampiran A | hitung ulang (§2.3), simpan nilai sumber sbg pembanding, masuk antrian |
| 3 | Nilai integritas berskala kecil (1–4) | normalisasi ke 0–100 (§2.7) |
| 4 | Format golongan campur (`IV.b` vs `III/d`) | seragamkan ke garis miring |
| 5 | `jenis_asesmen` beda kapitalisasi & istilah (`PENGAWAS`, `JPT Pertama`) | Title Case + peta istilah lama→baru |
| 6 | TMT campur (`01 April 2024/ Pembina Tk.I`, `1-Apr-23`, `01 Agustus 2025`) | parser multi-format → `DATE`; gagal parse = masuk antrian, **bukan** NULL senyap |
| 7 | Riwayat jabatan tanpa tanggal/SK, unit belum terpetakan | terima apa adanya, tandai "belum terstruktur"; indikator yang bergantung padanya jatuh ke **input manual bertanda jejak** |
| 8 | Kolom arsip (ijazah/transkrip/pertek) kosong | kolom yang 100% kosong pada dataset terfilter **disembunyikan adaptif**; sel kosong diganti aksi "Unggah", bukan `—` |
| 9 | Unit Kerja berisi teks jabatan (kasus Irwan) | deteksi heuristik + masuk antrian untuk verifikasi manual; **jangan** dibetulkan otomatis |
| 10 | Riwayat pendidikan sebagai satu teks (`"S2 SISTEM DAN TEKNIK TRANSPORTASI"`) | parser jenjang + bidang studi; gagal parse = antrian |
| 11 | NIP tidak valid | validasi panjang 18, tanggal lahir valid, digit gender ∈ {1,2}, TMT CPNS ≤ hari ini (K-6) |
| 12 | `status_asesmen` tidak sesuai umur asesmen | hitung `isExpired` dari aturan §2.9, jangan percaya kolom mentah saja |

---

## 7. Fase Implementasi

Setiap fase punya *Definition of Done*. Fase tidak selesai kalau DoD + kontrak §5.2–5.7 belum lengkap.

### Fase 0 · Fondasi & Rule Engine — ✅ **SELESAI**
1. ✅ Next.js 16 + React 19 + TS strict (`noUncheckedIndexedAccess`) + Tailwind v4; token warna light/dark di `app/globals.css`.
2. ✅ App shell: sidebar persisten (collapsible, tersimpan di localStorage lewat `useSyncExternalStore`, tersinkron antar tab), navbar (breadcrumb, command palette, theme toggle, dev role switcher), konten full-screen. Tanpa hero/landing.
3. ✅ Primitif `components/ui/*`: `Button` (pending state bawaan via `useFormStatus`), `Skeleton` + `TableSkeleton`/`ChartSkeleton`/`CardSkeleton`/`Kotak9Skeleton`/`ListSkeleton`, `Badge`+`StatusDot`, `Panel`/`PanelHeader`/`PageHeader`, `Spinner`, dan **tiga** keadaan kosong terpisah (`EmptyState`/`NoResultState`/`ErrorState`). **Dilunasi bersamaan dengan Fase 2:** `DataTable`, `Dialog`+`DialogKonfirmasi`, `Toast`+`ToastProvider` — sengaja ditunda sampai ada pemakai nyata, karena mendesain primitif tanpa kasus konkret menghasilkan API yang salah.
4. ✅ `lib/db` via `drizzle-kit pull` — ter-introspect dari `pupr_dev` (26 tabel saat Fase 0; menjadi **27** setelah `match_score_detail` ditambahkan di Fase 0.5).
5. ✅ **`lib/scoring`** — §2 seluruhnya: Formula A & B lewat satu mesin rubrik, klasifikasi Kotak 9 + pembanding nilai sumber, agregasi berjenjang generik, dua mode skor, rubrik integritas, fallback ambang, eligibility, masa berlaku asesmen, `ratakanDetail()` untuk `match_score_detail` (U-3), `buatSnapshotRubrik()` (U-5), `hitungRanking()`.
6. ✅ `lib/nip.ts`, `lib/normalisasi.ts`, `lib/format.ts`, `lib/peran.ts`, `lib/navigasi.ts`, `lib/hooks.ts`, `lib/auth.ts` + dev role switcher (server action ikut memeriksa flag, bukan cuma UI disembunyikan).
7. ✅ Command palette `Ctrl/⌘+K` (U-8) — mencari label, path, dan kata kunci.

**DoD:**
- [x] `typecheck` & `lint` bersih; tidak ada `any` di `lib/`; `next build` sukses
- [x] **Uji Vitest `lib/scoring` menutupi setiap cabang §2** — kelima skor predikat, ketiga band tiap sumbu, kesembilan sel Kotak 9, kedua mode skor, agregasi bersarang 2 level, kelima kategori integritas, batas inklusif (tepat 60 & tepat 80), fallback ambang (kasus 4,1 tahun), asesmen kedaluwarsa, eligibility 3 jenis syarat
- [x] Uji `lib/nip.ts`: 16/16 NIP dev terparse + 9 kasus tidak valid tertolak dengan alasan
- [x] App shell benar di light & dark, sidebar collapse bertahan setelah reload, tanpa flash tema
- **Hasil: 142 uji Vitest lolos · 17/17 smoke Playwright lolos** (`npm run verifikasi`, `npm run smoke`)

> **Catatan implementasi.** Tombol ciutkan sidebar dipindah dari footer ke atas daftar menu: di dev, indikator Next.js menempati pojok kiri-bawah dan menutupi kontrol apa pun di sana. Posisi atas juga konvensi Notion/VS Code. `gayaTombol` dipisah ke `button-style.ts` (tanpa `'use client'`) supaya Server Component bisa memakainya untuk `<Link>`. `typedRoutes` sengaja belum dinyalakan sampai route Fase 2+ ada.

### Fase 0.5 · Rapikan & Perkaya Data Dev — ✅ **SELESAI**
Eksekusi §4. Berkas yang dihasilkan, dijalankan berurutan setelah `001`–`003`:

| Berkas | Isi | Cara dihasilkan |
|---|---|---|
| `004_normalisasi_data_dev.sql` | golongan → format garis miring · `jenis_asesmen` Title Case + istilah terkini · potkom dibawa ke 0–100 dengan urutan relatif dipertahankan · **ambang `Lama Jabatan` diisi & lubang rentang ditutup** (§2.8a) | tulisan tangan |
| `005_skema_tambahan.sql` | `match_score_detail` (U-3) · `match_score.rubrik_snapshot` (U-5) · `jabatan_target.kata_kunci_relevansi` (U-12) · `nilai_integritas` dilebarkan ke `DECIMAL(6,2)` · isi `nilai_minimal` persyaratan | tulisan tangan |
| `006_seed_perluasan.sql` | pegawai 16→**40**, unit 17→**28**, jabatan 16→**47** (6 KOSONG), kinerja 31→**160**, riwayat jabatan 35→**82** (semua bertanggal), hukuman disiplin 2→**6** | `scripts/gen-006-seed-perluasan.ts` |
| `007_recompute.sql` | `asesmen_talenta` (46 baris) · `match_score` (**120**) · `match_score_detail` (**1.080**) · ranking `talent_pool` · nominasi jalur DITOLAK & REVISI | `scripts/recompute.ts` |

**DoD:**
- [x] **Semua nilai skor di DB berada di 0–100** — diverifikasi query, bukan asumsi
- [x] **`kotak_9` nol selisih** terhadap hitungan ambang Lampiran A
- [x] **Kesembilan sel Kotak 9 terisi**, masing-masing ≥2 pegawai — `K9=10 K8=4 K7=6 K6=2 K5=4 K4=4 K3=2 K2=5 K1=3`
- [x] `match_score` & `match_score_detail` **seluruhnya output `lib/scoring`**, bukan angka tulis tangan
- [x] Semua pegawai punya TW1–TW3 + TAHUNAN; `riwayat_jabatan` bertanggal lengkap (dari 35/35 NULL → 0)
- [x] `nominasi` mencakup DISETUJUI · DITOLAK · MENUNGGU_VERIFIKASI; `approval_log` mencakup DISETUJUI · DITOLAK · REVISI
- [x] Menjalankan `001`→`007` dari database kosong menghasilkan keadaan **identik** — diuji dengan membandingkan checksum CRC32 lima tabel inti antar dua kali jalan
- **Hasil: 27/27 pemeriksaan `npm run verifikasi:data` lulus**

> **Silang-uji, bukan uji diri sendiri.** `scripts/verifikasi-data.ts` menghitung ulang `kotak_9`, `nilai_talenta`, `skor_total` (65/20/15), rata-rata 4 indikator Kualifikasi, dan rata-rata 3 sub-indikator Pengalaman Jabatan **memakai SQL murni** — implementasi terpisah dari `lib/scoring`. Kalau rumusnya salah paham, dua implementasi berbeda akan berselisih. Memverifikasi output `lib/scoring` dengan `lib/scoring` hanya akan mengonfirmasi dirinya sendiri.

**Tiga hal yang ditemukan justru karena dikerjakan, bukan direncanakan:**

1. **`nilai_integritas` bertipe `DECIMAL(4,2)` — maksimum 99,99.** Keputusan §2.7 (satu skala integritas 0–100) membuat nilai 100 (= tidak pernah dijatuhi hukuman) tidak muat, dan **DB menolak menyimpannya**. Kolomnya dilebarkan di `005`. Constraint yang ketat lebih berguna daripada kolom serba boleh.

2. **Placeholder `kotak_9` di seed merusak sinyal Antrian Pembersihan.** Versi pertama `006` mengisi `kotak_9 = 1` sebagai placeholder, sehingga laporan "selisih kotak_9 vs sumber" menunjukkan **29** selisih — padahal 27 di antaranya buatan seed sendiri. Generator diubah agar menghitung `kotak_9` & `status_asesmen` lewat `lib/scoring`, sehingga selisih yang tersisa tepat **2** — dua kasus nyata dari data contoh e-Nominasi (Tasya & Tina, lihat §2.3). Data uji yang berisik membuat indikator kualitas kehilangan arti.

3. **Recompute meninggalkan ranking basi.** Versi pertama `scripts/recompute.ts` hanya meng-`UPDATE` ranking untuk kandidat yang baru dimasukkan ke pool, sehingga anggota lama yang skornya turun di luar batas atas mempertahankan ranking dari seed — menghasilkan **nomor ranking ganda** dalam satu jabatan target (dua orang di peringkat 5). Diperbaiki dengan me-ranking ulang **seluruh** anggota pool, dan ditambahkan pemeriksaan "ranking berurutan 1..n tanpa dobel" ke `verifikasi-data.ts` supaya tidak terulang.

> **Catatan tentang reproducibility.** Yang dijamin identik adalah **keadaan akhir DB** setelah `001`→`007`. Isi berkas `007` sendiri bergantung pada keadaan DB saat digenerate (ia memang me-recompute keadaan hidup) — jadi regenerasi setelah `007` diterapkan menghasilkan pernyataan SQL yang berbeda tetapi keadaan akhir yang sama. `006` sepenuhnya deterministik dan selalu identik.

### Fase 1 · Dashboard Utama — ✅ **SELESAI**
Delapan widget, masing-masing `<Suspense>` sendiri, seluruh agregasi di SQL (`lib/kueri/dashboard.ts`):
1. ✅ **Kartu ringkas** — pegawai aktif · jabatan strategis kosong · kandidat dalam pool · nominasi menunggu tindakan. Tiap angka disertai **penyebut pembanding** (mis. "31,6% dari 19 jabatan eselon I–III") karena angka telanjang tanpa penyebut tidak bisa dinilai besar-kecilnya.
2. ✅ **Sebaran Kotak 9** — grid 3×3 CSS (tanpa library chart), jumlah + persentase, intensitas warna relatif (K-2). Klik sel → drill-down `?kotak=N` di halaman yang sama.
3. ✅ **Peta Kinerja × Potensial** — **bubble**, bukan scatter berjitter (lihat catatan di bawah), garis ambang 60/80, tooltip memuat nama.
4. ✅ **Kesehatan Data** — tabel *Status Readiness Data* Blueprint §3 sebagai **widget hidup**, menyandingkan status yang tertulis di dokumen dengan persentase kenyataan.
5. ✅ **Jabatan strategis kosong** — yang **belum punya jabatan target** diurutkan ke atas, karena tanpa profil target kandidat belum bisa dinilai sama sekali.
6. ✅ **Antrian nominasi & approval** — tahap terakhir dari `approval_log` + **lama menunggu dalam hari** (target proyek memangkas waktu layanan ≥30%, PRD §2 — tidak terpantau kalau yang tampil hanya tanggal).
7. ✅ **Tren kinerja** dari `kinerja_periode` (TW1→TAHUNAN) — nilai granular, bukan `nilai_kinerja_y` (K-1).
8. ✅ **Aktivitas terakhir** — gabungan `audit_log` + `sync_log`, sinkronisasi GAGAL ditandai jelas karena itu penyebab paling umum angka dashboard terlihat aneh.

**DoD:**
- [x] Semua widget punya skeleton yang meniru bentuk final; `loading.tsx` menyusun ulang skeleton milik tiap widget (bukan menulis ulang), sehingga tata letaknya identik
- [x] **Nol query `SELECT *` lalu agregasi di JS** — 9 kueri, semuanya `GROUP BY`/`COUNT`/`LIMIT` di SQL
- [x] Diuji `scripts/seed-volume.ts` di **2.000 pegawai**: total 9 kueri **175 ms** (vs 139 ms di 40 pegawai), tiap kueri jauh di bawah ambang 150 ms
- [x] Tiap chart mencantumkan basis data & jumlah record yang dikecualikan
- [x] Benar di light & dark; tanpa scroll horizontal sampai lebar 768px
- [x] Playwright smoke: **21/21** (`e2e/fase-1.smoke.mjs`)
- [x] Kartu bernilai nol tetap bermakna ("Tidak ada nominasi yang menunggu — antrian bersih")
- **Hasil: 182 uji unit · 21/21 smoke Fase 1 · 15/15 smoke Fase 0 · 27/27 verifikasi data**

> **Bubble menggantikan scatter berjitter (menyimpang dari rencana K-1).** Sumbu Kinerja hanya punya lima nilai (100/80/60/40/20), jadi titik pegawai bertumpuk. *Jitter* mengatasinya dengan **memindahkan titik ke koordinat yang bukan nilainya** — pada halaman yang dipakai pimpinan untuk mengambil keputusan penempatan, itu berarti menampilkan posisi palsu. Bubble menampilkan angka sebenarnya (ukuran = jumlah pegawai) dan agregasinya dikerjakan SQL, sehingga tetap terbaca dari 40 sampai ribuan pegawai.

> **Skala terukur, bukan diasumsikan.** Kueri cepat belum menjawab "apakah React harus merender ribuan baris?" — kalau payload ikut membesar, halaman tetap melambat walau SQL-nya kilat. `npm run ukur:payload` mengukurnya: dari 40 → 2.000 pegawai (50×), baris yang dirender hanya tumbuh 91 → 563 (6,2×), dan rasio baris-per-pegawai turun dari 2,275 → 0,281. Penyebabnya setiap kueri dibatasi secara struktural: `LIMIT` untuk daftar, jumlah sel tetap untuk grid, dan peta talenta terbatas 5 nilai Y × 101 nilai X = **505 titik** sebagai plafon mutlak. Angka 505 itu tercapai di uji volume karena generatornya sengaja menyebar Potkom merata ke semua nilai (kasus terburuk); data nyata mengelompok, jadi akan di bawah itu.

**Tiga cacat yang ketemu karena dijalankan & dilihat, bukan dibayangkan:**

1. **Label baris Kotak 9 tidak sejajar dengan selnya.** Awalnya label ditaruh di kolom terpisah di samping grid; tinggi keduanya dihitung terhadap wadah berbeda sehingga "Sesuai Ekspektasi" melayang di antara dua baris. Diperbaiki dengan menjadikan label sebagai **kolom keempat di dalam grid yang sama** (`grid-cols-subgrid`).
2. **Panel Tren kinerja menyisakan ruang kosong besar.** Baris grid memaksa tinggi seragam, sehingga panel chart (rasio aspek tetap) ikut diregangkan setinggi panel Antrian yang lebih panjang. Diperbaiki dengan `items-start`.
3. **Smoke test Fase 0 jadi merah (13/17) setelah dashboard jadi.** Empat pemeriksaannya mengunci teks halaman placeholder Fase 0. Lingkupnya dipersempit ke **kerangka aplikasi saja** — isi halaman diuji di `fase-1.smoke.mjs` — supaya tidak ikut merah tiap kali dashboard berkembang.

> **Catatan basis data uji volume.** `pupr_dev_volume` adalah database **terpisah** dan sekali pakai (`npm run db:volume` membangunnya ulang dari nol). Membuatnya perlu satu penyesuaian di server MySQL dev: `GRANT ALL PRIVILEGES ON pupr_dev_volume.* TO devuser`. Dipilih begitu supaya `pupr_dev` — data kerja yang dipakai dev server — sama sekali tidak tersentuh. Hapus kapan saja dengan `DROP DATABASE pupr_dev_volume`.

### Fase 2 · Direktori & Profil Talenta — ✅ **SELESAI**
- ✅ **Direktori Pegawai** — kolom persis mockup #1 `KERANGKA TALENT POOL.md` (NIP+Nama, Jabatan, Eselon, Unit, Pangkat, Jenis Asesmen, Potkom, Integritas, Predikat Kinerja, Jenjang, Kotak 9) + kolom Usia turunan NIP yang bisa dimunculkan. Paginasi/pengurutan/penyaringan **seluruhnya di SQL**; filter unit (hierarkis, mencakup unit di bawahnya), eselon, jenjang, tingkat pendidikan, Kotak 9, status asesmen; pencarian nama/NIP ber-debounce; pemilih kolom.
- ✅ **Profil Talenta 360°** — bio + turunan NIP (usia, jenis kelamin, TMT CPNS, masa kerja, proyeksi BUP — K-6); kelengkapan data berbobot (U-2); posisi Kotak 9 + riwayat asesmen antar tahun; tren kinerja per triwulan; **match score ke semua jabatan target dengan rincian sampai sub-indikator** (U-3); timeline riwayat jabatan (menandai Plt/Plh & yang belum terpetakan); riwayat pendidikan dengan kolom arsip adaptif; riwayat diklat bercari & terlipat; integritas & rekam jejak disiplin.

**DoD:**
- [x] Filter & pengurutan tersinkron URL — hasil pencarian bisa di-bookmark & dibagikan
- [x] Ganti filter/urutan **tanpa blank flash**: data lama tetap tampil redup + progress bar tipis, bukan kembali ke skeleton
- [x] 30 entri diklat tidak merusak layout (dibatasi 8 + pencarian + tombol perluas)
- [x] Predikat & kategori sumbu **tidak dicampur** dalam satu kolom (K-3); skala tiap kolom skor ditulis di subjudul header (K-2/T-2)
- [x] Profil pegawai berdata minimal tetap tampil rapi — setiap bagian punya keadaan kosong sendiri yang menjelaskan **akibat** kekosongannya terhadap penilaian
- [x] Kolom arsip pendidikan disembunyikan otomatis kalau seluruh baris kosong, dengan keterangan berapa kolom disembunyikan (§6 no. 8)
- **Hasil: 198 uji unit · 27/27 verifikasi data · smoke 15/15 (F0) + 21/21 (F1) + 23/23 (F2), tanpa error konsol**

**Ekspor CSV ditunda ke Fase 8** (Pusat Ekspor) — di sana sudah ada infrastruktur job asinkron untuk ekspor besar (U-10), jadi membuatnya sekarang berarti dua implementasi ekspor.

> **DataTable ditulis sendiri, bukan TanStack Table (menyimpang dari §5).** TanStack unggul untuk sorting/filtering/paginasi **di klien**; di sini semuanya dikerjakan SQL karena produksi punya 1.872 pegawai, sehingga yang tersisa dari TanStack hanya definisi kolom — lapisan tambahan tanpa manfaat. Dependensinya **dilepas** (`npm uninstall @tanstack/react-table`) daripada dibiarkan menganggur.

> **Palet chart divalidasi, bukan dikira-kira.** Saat menambah chart profil, terungkap bahwa seri kedua memakai `--success` — **warna status**. Itu keliru: warna status punya makna tetap "baik/waspada/buruk", jadi memakainya sebagai seri ke-2 membuat pembaca menyangka seri itu bermakna positif. Diperbaiki dengan token khusus `--chart-1`/`--chart-2`, dipilih lewat validator (lightness band, chroma floor, pemisahan CVD, kontras vs surface) sampai **lolos semua di kedua tema**. Pemisahan tritanopia untuk pasangan biru–hijau tergolong rendah (ΔE ≈5), sehingga **garis putus-putus pada seri kedua bukan hiasan** — itu pembeda kedua yang wajib ada agar identitas seri tidak bergantung pada warna saja.

**Tiga hal yang ketemu karena dikerjakan:**

1. **`EmptyState` terjebak di berkas `'use client'`.** Komponen itu murni tampilan tanpa interaktivitas, tapi ikut jadi Client Component karena satu berkas dengan `NoResultState`/`ErrorState` yang butuh handler. Dipisah ke `components/ui/empty-state.tsx` — tujuh berkas berhenti mengirim JavaScript untuk sesuatu yang tidak pernah bereaksi.
2. **Skala kolom skor harus ditulis di header.** Kolom "Integritas" pernah berskala 1–4 di data sumber dan kini 0–100 (§2.7). Tanpa subjudul skala di header, pembaca lama akan menafsirkannya dengan skala yang salah — dan angka 75 vs 3 tidak memberi petunjuk apa pun soal itu.
3. **Setiap keadaan kosong di profil menjelaskan akibatnya, bukan cuma "belum ada data".** Contoh: bagian diklat kosong menyebut bahwa indikator Pengembangan Kompetensi akan bernilai 50; bagian disiplin kosong menyebut bahwa sistem memperlakukannya sebagai skor 100 dan itu **asumsi**. Keadaan kosong yang hanya berbunyi "tidak ada data" membuang kesempatan memberi tahu konsekuensinya.

**Empat cacat yang hanya ketemu setelah halaman dijalankan & dilihat** — bukti bahwa "kode hijau" bukan "fitur benar":

1. **Direktori terbuka dalam urutan Z→A.** `arah` bawaan ditulis `params.arah === 'asc' ? 'asc' : 'desc'`, jadi tanpa `?arah=` semuanya menurun — daftar nama dibuka dari "Yuni" ke "Agus". Diperbaiki dengan menjadikan arah bawaan **milik kolom**, bukan satu nilai global: nama/jabatan/unit naik (A→Z), skor & peringkat menurun (tertinggi dulu). Karena arah itu dipakai dua lapisan — kueri (`lib/kueri/pegawai.ts`, ber-`server-only`) dan panah di header (`DataTable`, Client Component) — definisinya ditaruh di **`lib/urut.ts`** supaya tidak ada dua versi yang bisa berselisih tanpa disadari.
2. **Breadcrumb halaman profil menyatakan "Direktori Pegawai".** `itemDariPath` mencocokkan awalan path, jadi `/talenta/{nip}` mewarisi label item navigasinya — breadcrumb mengaku pengguna sedang berada di daftar, dan jejak kembali ke daftar itu hilang. Diperbaiki dengan menambahkan titik untuk segmen detail; labelnya **NIP terformat**, bukan nama pegawai, karena breadcrumb dirender di navbar yang tidak punya akses data halaman — dan namanya sudah jadi H1 di halaman itu.
3. **"Non-eselon" terpotong dua baris** sehingga tinggi baris tabel naik — merusak densitas yang justru jadi tujuan halaman padat data.
4. **Dua smoke test hijau-palsu/merah-palsu.** (a) Uji RBAC menunggu teks "Pengelola Unit" muncul di halaman — padahal menu pengalih peran yang sedang terbuka memang mendaftar peran tiap akun, jadi kondisinya **lolos seketika** sebelum penggantian selesai, lalu jumlah menu dibaca terlalu cepat. Diganti menunggu label tombol pengalih berubah + polling jumlah item nav. (b) Uji "tidak ada tautan mati" menegaskan dashboard **tidak boleh** punya tautan keluar — benar di Fase 1, salah sejak Fase 2 menambah tautan ke Direktori. Diganti: setiap tautan keluar di-*request* dan harus tidak 4xx. Verifikasi terpisah lewat SQL & cookie membuktikan RBAC-nya sendiri **memang benar** (22 item nav → 5 untuk Pengelola Unit) — yang salah cuma tesnya.

### Fase 3 · Peta Talenta & Perbandingan Kandidat — ✅ **SELESAI**
- ✅ **Peta Talenta** (U-1) — grid 3×3 penuh + **bubble Kinerja × Potensial** berdampingan (dengan padanan tabel) + drill-down per sel berpaginasi + filter unit (hierarkis rekursif)/eselon/jenjang/tahun asesmen/hanya-berlaku, seluruhnya tersinkron URL.
- ✅ **Perbandingan Kandidat** — pilih 2–4 pegawai lewat pencarian yang dirender server, tabel sisi-berdampingan (baris = atribut, kolom = kandidat) + radar per indikator rubrik + penanda nilai terbaik & selisih ≥10 poin; pemilih jabatan target yang menyebut berapa kandidat punya skornya.

**DoD:**
- [x] Agregasi grid, bubble, dan drill-down **seluruhnya di SQL** dengan filter yang sama — tidak ada `SELECT *` lalu difilter di JS
- [x] Filter tersinkron URL & **ikut terbawa ke drill-down**; mengubah filter membuang `?kotak=` yang sudah basi
- [x] Angka pada sel grid **sama dengan** jumlah baris daftar drill-down sel itu (diuji, bukan diasumsikan)
- [x] Chart bubble punya padanan tabel (§5.5); radar punya tabel angka di panel yang sama
- [x] Radar **disembunyikan** kalau ada kandidat tanpa skor di jabatan target terpilih
- [x] K-4 ditegakkan: Kotak 9 + predikat kinerja tampil sebelum/berdampingan match score dalam satu tabel
- [x] Batas 2–4 kandidat ditegakkan di tiga lapisan dari satu definisi (`lib/banding.ts`); `?nip=` berisi 6 NIP dipangkas ke 4, isi sampah diabaikan tanpa error
- [x] Benar di light & dark; tanpa scroll horizontal halaman sampai 768px
- **Hasil: 223 uji unit · 34/34 smoke Fase 3 · 15/15 (F0) + 21/21 (F1) + 23/23 (F2) tanpa regresi · 27/27 verifikasi data**
- **Skala terukur:** 23 kueri di 2.000 pegawai = **470 ms total**, tiap kueri jauh di bawah ambang 150 ms (kueri peta terberat 17 ms). Payload render 167 → 1.117 baris saat data naik 50×, rasio baris/pegawai turun 4,175 → 0,558

> **Bubble, bukan scatter berjitter — U-1 diselaraskan dengan keputusan Fase 1.** Teks U-1 semula menulis "scatter Y×X **berjitter**". Itu ditulis sebelum Fase 1 dikerjakan, dan Fase 1 sudah menolaknya dengan alasan yang tetap berlaku: jitter memindahkan titik ke koordinat yang **bukan nilai pegawai itu**, dan halaman ini dipakai pimpinan untuk memutuskan penempatan orang. Fase 3 memakai bubble (ukuran = jumlah pegawai), dan kebutuhan "melihat sebaran di dalam satu sel" dijawab oleh **drill-down per sel** yang memang sudah diminta PRD §6.3 — bukan oleh koordinat palsu.

> **Palet chart divalidasi ulang sebagai himpunan 4 warna, dengan pemeriksaan SEMUA pasangan.** Radar menampilkan sampai 4 seri sekaligus, jadi memeriksa pasangan bertetangga saja tidak cukup — pasangan mana pun bisa bersebelahan di grafik. Kandidat pertama (biru–hijau–ungu–oranye) **gagal**: ungu vs biru cuma ΔE 5,7 deutan dan 13,4 pada penglihatan normal. Yang lolos: biru · hijau · oranye · magenta. Pemisahan terburuk tetap di pita 6–8 (terang 8,6 · gelap 6,6 deutan), yang menurut aturan hanya sah **bila ada pembeda kedua** — karena itu tiap seri radar punya **pola garis berbeda**, legendanya menggambar polanya (bukan cuma kotak warna), dan ada tabel angka di panel yang sama.

> **Radar tanpa isian.** Versi pertama memberi tiap poligon `fillOpacity` 0,08. Dengan 3–4 kandidat yang skornya mirip, isian itu saling menimpa jadi massa kelabu yang justru menyembunyikan garis yang mau dibandingkan. Diganti garis saja.

> **Ekspor gambar ditunda ke Fase 8** (Pusat Ekspor), bukan dikerjakan di sini. Warna chart datang dari CSS variable, jadi men-serialisasi SVG-nya apa adanya menghasilkan gambar tanpa warna; melakukannya benar berarti me-resolve computed style tiap elemen — pekerjaan yang wajarnya duduk bersama infrastruktur ekspor lain (U-10), bukan diimprovisasi di sini. Ekspor tabel sudah terjawab oleh tampilan tabel yang bisa disalin.

**Empat hal yang ditemukan karena dikerjakan:**

1. **Aturan "asesmen mana yang terbaru" ternyata ditulis dua kali.** `CTE_ASESMEN_TERBARU` ada di `lib/kueri/dashboard.ts` **dan** `lib/kueri/pegawai.ts` dengan isi identik. Itu bukan duplikasi kosmetik: CTE itu mendefinisikan **populasi** yang dihitung setiap halaman. Kalau aturan pemecah serinya berubah di satu berkas, dashboard dan direktori diam-diam menghitung orang yang berbeda. Diangkat ke `lib/kueri/dasar.ts`.
2. **Filter unit hanya menjangkau tiga level.** Versi lama menuliskan `u.id = ? OR u.parent_id = ? OR u.parent_id IN (…)` — begitu ada unit di level keempat, pegawainya **hilang dari hasil filter tanpa pesan apa pun**. Diganti CTE rekursif (`SUBKUERI_UNIT_TURUNAN`) yang tidak peduli kedalaman, dipakai bersama oleh direktori & peta talenta.
3. **Checkbox filter terasa mati.** "Hanya asesmen berlaku" nilainya dibaca langsung dari URL, jadi kotaknya baru tercentang **setelah** server menjawab — persis pelanggaran §5.2. Sekarang ditampilkan optimistis lalu disinkronkan kembali dari URL. Ini ketemu karena smoke test-nya gagal dengan pesan "clicking the checkbox did not change its state" — kegagalan test yang menunjuk cacat produk, bukan cacat test.
4. **Klik sel grid tidak menggerakkan apa pun.** Hasil drill-down muncul di bawah dua panel, di luar layar, sementara `Kotak9Grid` memaksa `scroll={false}` (benar untuk dashboard, salah di sini). Grid diberi opsi `gulirKeSel` + href berjangkar `#isi-kotak`.

> **Radar hanya sah dalam satu jabatan target.** Komponen rubrik & bobotnya berbeda per jabatan target, jadi radar lintas-target menggambar sumbu yang bukan hal yang sama sambil tetap *terlihat* bisa dibandingkan. Karena itu radarnya **disembunyikan** kalau ada kandidat tanpa skor di target terpilih, tidak cukup diberi peringatan. Tabel sisi-berdampingan tetap tampil dengan peringatan, karena angkanya masih bisa dibaca satu per satu — dan sel kosongnya dijelaskan berarti "belum dihitung", bukan "bernilai rendah".

> **K-4 berlaku di halaman perbandingan.** Match score tidak mengandung unsur kinerja sama sekali, jadi kolom **Kotak 9 + predikat kinerja wajib berdampingan** dengan skor — sama seperti aturan di Talent Pool. Diuji urutannya di smoke test, bukan cuma diniatkan.

### Fase 4 · Master Data, Importer & Kualitas Data — ✅ **SELESAI**
- ✅ **Master Unit Organisasi** (tree rekursif + CRUD) · **Master Jabatan** (CRUD, tandai kosong, arsipkan) · **Data Hukuman Disiplin** (akses terbatas, data sensitif).
- ✅ **Jabatan Kosong & Risiko Kekosongan** (U-6) — yang sudah kosong + **pejabat mendekati BUP** (K-6) dengan ambang 1/3/5/10 tahun, lama menjabat, dan penanda "tanpa suksesor siap".
- ✅ **`lib/importer`** — §6 seluruhnya sebagai satu lapisan koreksi + pelaporan · halaman **Konsolidasi & Sinkronisasi Data** (status per sumber, riwayat `sync_log`, detail error).
- ✅ **Antrian Pembersihan Data** — temuan dikelompokkan menurut nomor aturan §6, dengan drill-down per kelompok.
- ✅ **Kelengkapan Data** (U-2) — rerata & sebaran, butir terurut prioritas, rollup per unit, daftar pegawai terendah; menutup metrik PRD §2 "kelengkapan ≥90%".
- ✅ Mutasi lewat server action + **`audit_log` otomatis** (PRD §8) — Zod di boundary, `assertPeran` di server.

**DoD:**
- [x] **Satu-satunya pintu tulis** adalah `jalankanMutasi()` — ia memeriksa peran, membaca keadaan sebelum, menulis, lalu mencatat audit. Mutasi tanpa audit hanya mungkin dengan melewati helper ini, dan itu ketahuan lewat `grep`
- [x] Galat validasi tampil **per field**, isian lain tetap utuh; toast hanya untuk hasil aksi & galat non-field
- [x] Penolakan menyebut **sebab + angkanya** ("masih dipakai: 5 unit di bawahnya dan 3 jabatan"), bukan "tidak bisa dihapus"
- [x] Jabatan berpenghuni **tidak bisa** ditandai kosong — ditegakkan di `ubahJabatan` **dan** jalur pintas `ubahStatusJabatan`, serta opsinya dinonaktifkan di form
- [x] Jabatan/catatan disiplin yang masih tersangkut riwayat **diarsipkan**, tidak dihapus
- [x] Halaman data sensitif menolak **di server sebelum kueri** — diuji bahwa isi data tidak ikut terkirim ke HTML, bukan hanya disembunyikan di UI
- [x] Skor kelengkapan di SQL **cocok persis** dengan `hitungKelengkapan()` (silang-uji: 78,1% = 78,1%)
- **Hasil: 272 uji unit · 46/46 smoke Fase 4 · 15/15 + 21/21 + 23/23 + 34/34 (Fase 0–3, tanpa regresi) · 27/27 verifikasi data**
- **Skala terukur:** 23 kueri pada 2.000 pegawai = 470 ms total; kueri Fase 4 terberat (pohon unit rekursif) di bawah ambang

> **Importer mengorkestrasi, bukan mengulang.** Sebelum menulis `lib/importer`, ternyata 7 dari 12 aturan §6 sudah ada implementasinya: parser golongan, jenis asesmen, TMT multi-format, pendidikan, NIP, clamp skor, dan aturan masa berlaku. Yang benar-benar belum ada cuma dua: **normalisasi skala integritas** (1–4 → 0–100) dan **pencatatan temuan**. Jadi importer dibangun sebagai lapisan yang memanggil yang sudah ada lalu mengubah "ada yang aneh" menjadi baris yang bisa ditindak — bukan sebagai implementasi kedua. Ujinya diorganisasi menurut **nomor aturan di §6**, bukan menurut nama fungsi, supaya yang dijamin adalah kelengkapan terhadap dokumen.

> **Ambang skala integritas dipilih dari asimetri risiko, bukan tebakan.** Nilai 3 bisa berarti "3 dari 4" (=75) atau "3 dari 100" (≈nol). Yang menentukan: rubrik 0–100 hanya mengenal lima nilai (100/75/50/25/0), jadi angka 1–4 **tidak mungkin** valid pada skala besar, sementara pada skala kecil ia satu-satunya bentuk yang mungkin. Ambang ≤4 karena itu aman ke dua arah.

> **Antrian Pembersihan dihitung dari keadaan DB, bukan dari catatan importer.** Temuan yang disimpan akan basi begitu seseorang membetulkan barisnya lewat jalur lain — dan antrian yang menampilkan pekerjaan yang sudah selesai adalah antrian yang berhenti dipercaya. Konsekuensinya jujur disampaikan di halaman: temuan yang sudah dikoreksi otomatis (format golongan, istilah asesmen) bernilai **nol** di sana, bukan karena tidak pernah terjadi, tapi karena jejaknya memang sudah hilang dari data.

> **Tombol sinkronisasi manual sengaja tidak dipasang** (menyimpang dari PRD §6.7). Mekanisme sumber produksi masih pertanyaan terbuka no. 7 — batch berkas atau API/webhook. Tombol yang memanggil sumber yang belum ada akan **selalu gagal**, dan itu lebih buruk daripada tidak ada tombol: pengguna menyimpulkan sinkronisasinya rusak. Aturan normalisasinya sendiri sudah siap & teruji. Alasan ini ditulis di halamannya, bukan cuma di dokumen.

> **Pemetaan manual & tanda "diverifikasi" di Antrian Pembersihan belum ada** (pengurangan lingkup dari PRD §6.7). Keduanya butuh tempat menyimpan keputusan manusia (siapa, kapan, catatan apa) yang belum ada di skema, dan pemetaan riwayat jabatan ke master jabatan lebih tepat dikerjakan dari editor riwayat pegawai. Halaman ini berfungsi sebagai daftar kerja yang akurat; perbaikannya dilakukan di sumber datanya.

**Lima hal yang ditemukan karena dikerjakan:**

1. **`ToastProvider` dibangun di Fase 2 tapi belum pernah dipasang di app tree.** `useToast()` melempar `'useToast harus dipakai di dalam <ToastProvider>'` — jadi setiap tombol simpan pertama akan menjatuhkan halaman. Ketemu saat menulis form pertama; provider dipasang di `app/(app)/layout.tsx`. Primitif yang tidak punya pemakai belum terbukti apa pun.
2. **`asesmen_talenta` tidak punya tempat menyimpan `kotak_9` dari sumber.** §6 no. 2 mewajibkan "simpan nilai sumber sbg pembanding", tapi kolomnya cuma satu dan `007_recompute` menimpanya dengan hasil hitung — sehingga nilai sumber **hilang**, dan dua kasus nyata (Tasya & Tina) hanya hidup sebagai komentar di `002_seed.sql`. Ditutup dengan `009_kolom_pembanding.sql` + backfill; Antrian Pembersihan sekarang punya isi nyata.
3. **Data dev tidak punya satu pun pejabat mendekati BUP.** Setelah halaman U-6 jadi, ambang bawaan 3 tahun menghasilkan **nol baris** — pejabat tertua masih 6,3 tahun lagi, jadi seluruh cabang UI-nya tidak pernah teruji. Sesuai §1 (data dev = dummy yang kita kendalikan, tugasnya menguji semua cabang), yang dibetulkan datanya: `008_seed_risiko_kekosongan.sql` menggeser tanggal lahir empat pejabat lewat generator, bukan tulisan tangan.
4. **`kueri()` dipakai untuk INSERT adalah kebohongan yang kebetulan jalan.** MySQL mengirim OkPacket untuk perintah tulis, bukan baris — jadi `kueri<{insertId}>()` memaksa pemanggil meng-cast "array" menjadi objek. Ditambahkan `eksekusi()` yang mengembalikan `{insertId, affectedRows}` apa adanya.
5. **Filter unit hierarkis dan bobot kelengkapan dua-duanya berisiko jadi implementasi kedua.** Filter unit sudah dibereskan di Fase 3 (CTE rekursif bersama). Untuk kelengkapan, rollup per unit butuh agregasi SQL sementara bobotnya tinggal di `lib/kelengkapan.ts` — jadi ekspresi SQL-nya **dihasilkan** dari daftar bobot yang sama (`lib/kueri/kelengkapan-sql.ts`), dan akan **melempar saat dimuat** kalau ada butir tanpa pasangan ekspresi. Silang-ujinya membuktikan keduanya sama: 78,1% = 78,1%.

### Fase 5 · Rule Engine (Jabatan Target) — ✅ **SELESAI**
- ✅ **Daftar Jabatan Target** · **Editor** 3 tab (Anggota / Persyaratan / Rubrik) · **Simulasi & Diff** · **Kandidat & Eligibility Check**.
- ✅ Rubrik builder: Komponen → Indikator → Sub-indikator → Kategori Skor; validasi bobot (komponen total 100% **per sumbu**; indikator top-level = bobot komponennya; sub-indikator dikecualikan karena `bobot_indikator` NULL by design) + **validasi kontinuitas ambang** (§2.8b) + node induk sebagai agregator (§2.5) — seluruhnya di `lib/scoring/validasi.ts`, 17 kode temuan bertingkat GALAT/PERINGATAN.
- ✅ **Simulasi & Diff** (U-4) — jalankan rubrik terhadap seluruh pegawai, tampilkan pergeseran peringkat & kelayakan tanpa menulis apa pun.
- ✅ **Snapshot rubrik** (U-5) — dibekukan sekali per perhitungan, bukan per pegawai.
- ✅ **Rincian Perhitungan Skor** (U-3) dari `match_score_detail`, termasuk **input manual bertanda jejak** (catatan wajib + `diisi_oleh`) yang bertahan melewati Hitung Ulang.
- ✅ Kandidat & Eligibility Check — kolom Kotak 9/predikat kinerja berdampingan sebelum match score (K-4), filter & paginasi di SQL.

**DoD:**
- [x] **Aktivasi diblokir selama rubriknya bercacat**, dan penolakannya menyebut temuan pertama beserta angkanya — bukan "rubrik tidak valid"
- [x] Rubrik bercacat tetap bisa **disimpan & dihitung** (menyusun rubrik itu bertahap; menolak menyimpan komponen pertama karena totalnya belum 100% membuat editor tidak bisa dipakai). Yang diblokir hanya aktivasi
- [x] Sub-indikator **tidak bisa** diberi bobot — ditegakkan di server *dan* kotaknya dinonaktifkan di form, karena bobot campur membuat mesin memberi bobot 0 ke saudaranya (§2.5)
- [x] Mengganti nama indikator **tidak** mematikan perhitungan — jembatan data→indikator memakai `kunci_sistem`, bukan pencocokan nama (`doc/sql/010`)
- [x] Nilai manual **bertahan** melewati Hitung Ulang, beserta siapa yang mengisi & catatannya
- [x] Diff kosong saat rubrik tidak berubah — bukti bahwa pipeline yang dipakai UI melahirkan angka yang sama dengan isi DB; diuji di smoke, bukan diasumsikan
- **Hasil: 318 uji unit · 44/44 smoke Fase 5 · 15/15 + 21/21 + 23/23 + 34/34 + 46/46 (Fase 0–4, tanpa regresi) · 27/27 verifikasi data · 120/120 silang-uji skoring**
- **Skala terukur:** 34 kueri halaman di 2.000 pegawai = **393 ms**, semua di bawah ambang 150 ms. Hitung Ulang satu jabatan target di 1.960 pegawai (17.640 baris rincian) = **2,5 detik**

> **Satu pipeline, empat pemanggil.** Urutan "baca rubrik → susun nilai mentah per indikator → hitung match score → periksa kelayakan → ranking" sebelumnya hanya hidup di dalam `scripts/recompute.ts`. Fase 5 butuh urutan yang sama di **tiga tempat lain** (tombol Hitung Ulang, halaman Simulasi, halaman Kandidat), jadi ia diangkat ke `lib/skor-massal.ts` dan `scripts/recompute.ts` ikut memakainya — bukan dibiarkan sebagai salinan kedua. Buktinya bahwa pengangkatan itu tidak mengubah hasil: `npm run verifikasi:skoring` menghitung ulang 120 baris `match_score` dan membandingkannya dengan isi DB (0 selisih), dan regenerasi `007_recompute.sql` hanya berbeda pada `nilai_mentah` Lama Jabatan sebesar 0,01 — akibat parsing tanggal kini seragam dengan seluruh aplikasi, bukan memakai pool sendiri.

> **`kunci_sistem` lahir dari sifat Fase 5, bukan dari selera.** Sampai Fase 4, `scripts/recompute.ts` mencari indikator dengan `nama_indikator = 'Lama Jabatan'` dan **melempar** kalau tidak ketemu. Itu aman selama rubrik hanya lahir dari seed. Begitu editor ada, nama indikator jadi milik pengguna: mengganti 'Lama Jabatan' menjadi 'Masa Kerja dalam Jenjang' — perubahan yang sangat wajar — akan mematikan seluruh perhitungan match score, dengan pesan galat yang menunjuk nama indikator alih-alih penyebabnya. `doc/sql/010` memisahkan label (milik pengguna) dari pengenal sumber data (milik sistem, ENUM tertutup). Efek sampingnya justru yang paling berguna: indikator **tanpa** kunci menjadi bentuk resmi dari "indikator yang datanya belum tersedia" yang diminta U-3, jadi input manual bertanda jejak punya tempat yang jelas.

**Empat hal yang ditemukan karena dikerjakan & diukur:**

1. **Jalur tulis Hitung Ulang: 48 detik di 1.960 pegawai.** Versi pertama menulis per pegawai — satu upsert + satu SELECT id + satu DELETE + satu INSERT. Di 40 pegawai itu 1,4 detik dan terasa wajar; di skala produksi ternyata **48,3 detik**, dan seluruhnya di jalur tulis (bacaan & perhitungannya hanya 116 ms). Penyebabnya bukan MySQL lambat, tapi ~8.000 perjalanan bolak-balik kecil. Setelah semuanya di-batch: **2,5 detik** — 19× lebih cepat, tanpa perlu infrastruktur job asinkron. Ini tidak akan ketemu tanpa `npm run ukur:hitung-ulang:volume`; di dev, versi lambatnya lulus dengan mudah.
2. **`match_score` tidak punya kunci unik pada (pegawai, jabatan target).** ERD menggambarkannya sebagai relasi paling-banyak-satu, dan `talent_pool.match_score_id` menunjuk satu baris — tapi yang ada hanya index biasa. Selama pengisian dilakukan `007_recompute` yang menghapus seluruh tabel lebih dulu, duplikat tidak mungkin muncul; tombol Hitung Ulang yang memperbarui satu jabatan target mengubah itu. Ditutup di `doc/sql/010`.
3. **Duplikasi rubrik ternyata bukan kemudahan, tapi pengurang risiko.** Menyusun rubrik 65/20/15 dari nol berarti mengetik 9 indikator dan 30-an kategori beserta ambangnya, dan setiap salah ketik ambang menghasilkan rubrik yang **tetap memberi angka** (mesin sengaja tidak melempar). Karena itu menyalin dari rubrik yang sudah lolos validasi dijadikan jalur utama untuk jabatan target baru, dan hanya diizinkan ke rubrik yang masih kosong.
4. **Tiga smoke test gagal-palsu karena membaca DOM saat streaming.** (a) Badge status dibaca sebelum editor selesai dirender; (b) toast hasil Hitung Ulang dibaca setelah 6 detik padahal toast sukses hilang sendiri setelah 4 detik — tesnya berlomba dengan penghilangan toast; (c) urutan kolom K-4 dibaca dari header yang baru separuh terkirim ("Kandidat | Jabatan | Kotak 9"). Yang (c) paling menyesatkan: `waitForFunction` untuk jumlah kolom lalu `allInnerTexts()` sesudahnya adalah **dua snapshot DOM berbeda**, jadi isinya dibaca di dalam satu evaluasi. Ketiganya diverifikasi sebagai cacat test — recompute memang selesai 3 detik dengan toast benar, dan header memang lengkap 8 kolom dengan urutan K-4 betul.

> **`next build` sambil `next dev` hidup merusak `.next`.** Dua route bersarang (`/kandidat`, `/simulasi`) tiba-tiba 404 di server dev, padahal sebelumnya lulus 44/44. Penyebabnya bukan kode: build produksi menulis ke direktori yang sedang dipakai server dev. Dicatat di sini supaya tidak didiagnosis ulang sebagai regresi — urutannya: smoke dulu, build terakhir.

### Fase 6 · Talent Pool & Workflow Nominasi — ✅ **SELESAI**
- ✅ **Talent Pool per Jabatan Target** (pemilih target di URL) · **Pengajuan Nominasi** (dari baris pool, bukan halaman terpisah) · **Verifikasi Nominasi** · **Timeline Approval** · **Rencana Suksesi & Pengembangan**.
- ✅ **Notifikasi & Inbox Tugas** (U-7) + tabel `notifikasi` (`doc/sql/011`) — tugas & notifikasi **dipisah tegas** di satu halaman.
- ✅ Transisi status sebagai **satu state machine** di [`lib/workflow.ts`](lib/workflow.ts): 10 aksi, tabel transisi eksplisit, wewenang per peran, dan `periksaKonsistensi()` yang dipakai bersama UI & `verifikasi-data`.

**DoD:**
- [x] **Satu keputusan memindahkan tiga hal sekaligus** — `talent_pool.status`, `nominasi.status`, dan satu baris `approval_log` — lewat satu pintu (`jalankanAksiWorkflow`). Tidak ada server action terpisah per keputusan
- [x] Wewenang datang dari state machine, bukan ditulis ulang di aksi: Pengelola Unit tidak bisa memverifikasi nominasinya sendiri, Admin Talenta tidak bisa menetapkan suksesor — **diuji lewat UI dengan berganti peran**, bukan diasumsikan
- [x] Langkah tidak bisa dilompati; penolakannya menyebut **keadaan sekarang + aksi yang sah saat ini**, bukan "transisi tidak valid"
- [x] Setiap keputusan yang mengubah peringkat orang menuntut **catatan**; catatan ditumpuk di `catatan_reviewer`, tidak ditimpa
- [x] Notifikasi sampai ke **giliran berikutnya** (bukan ke yang baru bertindak) dan ke pengaju asli; kegagalan mengirim notifikasi **tidak** membatalkan keputusan yang sudah tercatat
- [x] Timeline menampilkan tahap yang **belum dijalani**, supaya nominasi yang baru lolos verifikasi tidak terlihat tuntas
- [x] Rencana pengembangan hanya bisa dibuat untuk suksesor DITETAPKAN, tapi **tidak dihapus** kalau penetapannya dibatalkan — ia jadi riwayat dan ditandai di halamannya
- **Hasil: 346 uji unit · 39/39 smoke Fase 6 · 15/15 + 21/21 + 23/23 + 34/34 + 46/46 + 44/44 (Fase 0–5, tanpa regresi) · 36/36 verifikasi data · 120/120 silang-uji skoring**
- **Skala terukur:** 44 kueri halaman di 2.000 pegawai (300 anggota pool · 100 nominasi) = **515 ms**, semua di bawah ambang 150 ms

> **`DIAJUKAN` diberi makna "dikembalikan untuk revisi".** Enum `nominasi.status` tidak punya nilai `REVISI` (yang punya adalah `approval_log.status`), jadi ada dua pilihan: menambah nilai enum, atau memberi `DIAJUKAN` makna yang membuatnya berguna. Yang dipilih yang kedua — **bola ada di tangan unit pengaju** — karena dengan begitu "giliran siapa" bisa dibaca dari satu kolom tanpa men-join `approval_log`, dan keadaan yang butuh join untuk diketahui adalah keadaan yang akan salah dibaca di suatu tempat. Bonusnya: tafsiran alternatif (`DIAJUKAN` = "baru masuk, belum diproses") akan **selalu** bernilai sama dengan `MENUNGGU_VERIFIKASI`, karena tidak ada langkah intake di antara keduanya — dua status yang selalu identik adalah cacat model.

> **Notifikasi disebar per pengguna, bukan disimpan bertujuan peran.** Satu baris untuk "Admin Talenta" akan hilang dari dua orang lain begitu satu orang menandainya terbaca — `dibaca_pada` tidak bisa dibagi. Kolom `peran_tujuan` tetap disimpan, tapi sebagai keterangan ("Anda menerima ini sebagai Admin Talenta"), bukan sebagai alamat.

> **Tugas ≠ notifikasi, dan itu yang menentukan bentuk halaman Inbox.** Notifikasi adalah kabar: ia bisa ditandai terbaca tanpa pekerjaannya selesai. Tugas adalah keadaan workflow: ia hilang hanya kalau keputusannya diambil. Menggabungkan keduanya jadi satu daftar akan membuat "tandai terbaca" terasa seperti menyelesaikan pekerjaan — cara paling rapi untuk kehilangan nominasi yang menggantung. Karena itu keduanya jadi dua panel berdampingan, dengan bedanya ditulis di halaman.

**Empat hal yang ditemukan karena dikerjakan:**

1. **Data dev punya tiga keadaan workflow yang mustahil.** `007_recompute.sql` menyisipkan nominasi & `approval_log` untuk menguji cabang DITOLAK dan REVISI, tapi tidak memperbarui `talent_pool.status` yang berpasangan dengannya. Hasilnya: satu kandidat berstatus KANDIDAT padahal punya nominasi aktif, dan satu nominasi berstatus MENUNGGU_VERIFIKASI padahal keputusan terakhirnya REVISI (artinya giliran unit, bukan verifikator). Satu nominasi lain di antrian verifikasi bahkan tidak punya baris `approval_log` sama sekali, sehingga "sudah berapa lama menunggu" tidak bisa dihitung. Dibetulkan di `doc/sql/011`, lalu **9 pemeriksaan konsistensi workflow ditambahkan** ke `verifikasi-data.ts` (27 → 36) supaya tidak bisa menyelip lagi.
2. **Halaman Talent Pool mendarat di jabatan target yang antriannya kosong.** Tanpa `?target=`, pilihan bawaannya jabatan target pertama menurut abjad — yang kebetulan tidak punya nominasi apa pun. Kartu "Menunggu tindakan **0**" lalu terbaca sebagai nol secara keseluruhan, padahal 4 kandidat sedang menunggu di jabatan target lain. Diperbaiki dua arah: bawaannya kini jabatan target yang **punya** pekerjaan menunggu, dan di atas kartu ditulis penyebut lintas jabatan target ("Di seluruh 3 jabatan target: 4 kandidat menunggu tindakan").
3. **Rencana pengembangan bisa jadi yatim.** Rencana hanya boleh dibuat untuk suksesor DITETAPKAN, tapi penetapan bisa dibatalkan setelahnya. Menghapus rencananya berarti membuang pekerjaan pengembangan yang mungkin sudah berjalan; menyembunyikannya berarti ia hilang tanpa penjelasan. Keputusannya: dipertahankan dan **dikelompokkan terpisah** dengan keterangan bahwa penetapannya dibatalkan — diuji di smoke, karena keadaan ini hanya muncul setelah dua aksi berlawanan.
4. **Dua smoke test gagal-palsu karena `innerText` menerapkan `text-transform`.** Label kartu ber-`uppercase`, jadi menunggu teks "Anggota pool" tidak akan pernah cocok — yang ada di `innerText` adalah "ANGGOTA POOL". Satu lagi lebih halus: menunggu kata "Ditetapkan" setelah menekan tombol penetapan **lolos seketika**, karena kalimat akibat di dialog yang masih terbuka memuat kata itu. Diganti menunggu munculnya aksi yang hanya ada di keadaan baru (`Batalkan penetapan`) — penanda keadaan, bukan penanda kata.

### Fase 7 · Auth & RBAC *(ditunda ke sini sesuai permintaan)*
Login · sesi & timeout · middleware · ganti isi `getCurrentUser()` · **matikan dev role switcher** · Profil Saya · Manajemen Pengguna & Peran · Audit Log Viewer · pembatasan data per `unit_organisasi_id` untuk Pengelola Unit · pembatasan akses data hukuman disiplin.
**DoD tambahan:** Playwright per role memastikan halaman & aksi yang seharusnya tertutup memang tertutup **di level server action**, bukan cuma disembunyikan di UI.

### Fase 8 · Laporan & Ekspor
Laporan Gap Analysis · Laporan Nominasi & Approval · Pusat Ekspor (PDF/Excel). Ekspor besar → job asinkron + progress + notifikasi selesai (U-10).

### Fase 9 · API Eksternal `/api/v1`
Auth Bearer + hash token · penegakan `scope_akses` (BKN tanpa data personal, Biro Kepegawaian dengan data personal, KEMENPANRB masih PENDING) · rate limit · `api_activity_log` · halaman Dokumentasi API. **Query memakai `lib/scoring` & repository yang sama dengan UI** — beda hanya lapisan auth & filter scope (PRD §4.3 poin 6).

### Fase 10 · Hardening
Uji volume ±2.000 pegawai · review index (`nip`, `unit_organisasi_id`, `jabatan_target_id`, `(pegawai_id, tahun_asesmen)`) · Lighthouse · aksesibilitas (kontras kedua tema, fokus keyboard, `aria-label`, chart punya padanan tabel) · suite Playwright penuh · konsistensi Bahasa Indonesia · backup & staging.

---

## 8. Usulan Perbaikan terhadap PRD §6 (Inventaris Halaman)

Hasil membaca ulang daftar halaman terhadap rubrik & alur di doc. **`PRD.md` diperbarui** kalau disetujui (CLAUDE.md: kode & dokumen jangan tidak sinkron).

| # | Usulan | Alasan | Fase |
|---|---|---|---|
| **U-1** | "Sebaran Kotak 9" → **"Peta Talenta"**: grid 3×3 **+ bubble Y×X + drill-down per sel** | baris atas grid selalu berat (K-2) dan sumbu Y hanya 5 nilai diskrit (K-1); grid sendirian tidak informatif. *Semula ditulis "scatter berjitter"; diubah setelah Fase 1 menolak jitter — lihat catatan di Fase 3.* | 3 |
| **U-2** | Halaman & skor **Kelengkapan Data** (per pegawai & per unit) | PRD §2 menargetkan "kelengkapan ≥90%" dan §6.2 menyebut traffic light, tapi tidak ada halaman yang mendefinisikan & mengukurnya | 4 |
| **U-3** ✅ | Tabel **`match_score_detail`** + halaman **Rincian Perhitungan Skor** | `match_score` hanya menyimpan 3 agregat + total → breakdown tidak bisa turun ke indikator. Indikator yang sama bisa bernilai beda antar jabatan target (bidang ilmu & relevansi diklat berbeda), jadi "kok beda?" tidak terjawab dari UI. Menabrak tuntutan *transparan & akuntabel* di §06 dokumen aksi perubahan | 5 |
| **U-4** ✅ | **Simulasi & Diff Rubrik** (what-if sebelum aktivasi) | mengubah bobot = me-ranking ulang orang; dampaknya harus terlihat lebih dulu | 5 |
| **U-5** ✅ | **Snapshot/versi rubrik** pada `match_score` | tanpa ini skor talent pool yang sudah ditetapkan tidak bisa direproduksi setelah rubrik diubah | 5 |
| **U-6** | "Status Jabatan Kosong" → **"Jabatan Kosong & Risiko Kekosongan"** | Lampiran B langkah 2 meminta jabatan **berisiko** kosong; PRD baru mencakup yang sudah kosong. Data pendukung sudah ada di NIP tanpa kolom baru (K-6) | 4 |
| **U-7** ✅ | **Notifikasi & Inbox Tugas** + tabel `notifikasi` | PRD memakai notifikasi sebagai widget tanpa entitas & halaman; approval tanpa inbox menggantung | 6 |
| **U-8** | **Command palette `Ctrl/⌘+K`** | CLAUDE.md meminta rasa Notion & navbar bersearch; jauh lebih cepat untuk staf yang seharian di aplikasi | 0 |
| **U-9** | **Dev Role Switcher** (sementara, di balik env flag) | membangun UI bergantung-role sebelum auth ada, tanpa utang teknis (§5.6) | 0 |
| **U-10** | Ekspor besar jadi **job asinkron berprogres** | 1.872 pegawai × PDF tidak layak dalam satu request | 8 |
| **U-11** | `jenis_syarat` **kinerja** pada `jabatan_target_persyaratan` *(perlu keputusan bisnis)* | match score mengabaikan kinerja sepenuhnya (K-4); belum ada cara memasang syarat minimal predikat/Kotak 9 | 5 |
| **U-12** ✅ | Kolom **`jabatan_target.kata_kunci_relevansi`** (JSON) | Rubrik memakai frasa "sesuai dengan jabatan target" pada indikator Kesesuaian Bidang Ilmu & Pengembangan Kompetensi, tapi tidak ada tempat menyimpan APA yang dianggap sesuai — akibatnya kedua indikator itu tidak bisa dihitung otomatis dan selalu jatuh ke penilaian manual. Sudah diterapkan di `005`. | 0.5 |

---

## 9. Pertanyaan Terbuka

Semua non-blocking — sudah ada keputusan default yang dipakai, tinggal dikonfirmasi saat data & kebijakan produksi matang.

| # | Pertanyaan | Default yang dipakai | Perlu jawaban sebelum |
|---|---|---|---|
| 1 | Rentang Lama Jabatan: benar maksudnya `≥2–<5` untuk nilai 80? | ya (§2.8a) | data produksi masuk |
| 2 | Masa berlaku asesmen berapa tahun? | **3 tahun**, parameter sistem (§2.9) | data produksi masuk |
| 3 | Agregasi sub-indikator: rata-rata sederhana? | ya, bobot sama rata (§2.5) | data produksi masuk |
| 4 | Hukuman disiplin `status_aktif=0` benar tidak menurunkan skor? Ada masa kedaluwarsa resmi? | tidak menurunkan (§2.7) | **jawaban mengubah skor Integritas 15% seluruh kandidat** — perlu dikonfirmasi sebelum talent pool ditetapkan (Fase 6) |
| 5 | Perlu syarat minimal kinerja/Kotak 9 di eligibility? | belum dipasang (K-4, U-11). Sementara ini Kotak 9 & predikat kinerja **ditampilkan berdampingan** di halaman kandidat, jadi konteksnya ada walau tidak menyaring | penetapan suksesor (Fase 6) |
| 6 | Siapa berwenang mengisi nilai manual untuk indikator yang datanya belum ada? | **terpasang di Fase 5**: Admin Talenta & Super Admin, catatan **wajib**, tercatat di `match_score_detail.diisi_oleh` | — sudah jalan; tinggal dikonfirmasi apakah peran lain juga berhak |
| 7 | Sumber produksi: batch atau API/webhook dari eHRM/eNominasi/eKinerja? | batch/impor berkas (PRD §10.2) | Fase 4 |
| 8 | Relasi dengan *karir.pu.go.id* — berdiri sendiri lalu ekspos API, atau menyatu? | berdiri sendiri (PRD §10.1) | Fase 9 |
| 9 | SSO Kementerian PU atau akun lokal? | akun lokal (PRD §10.6) | Fase 7 |
| 10 | Siapa menjalankan "Verifikasi Kepegawaian"? | **terpasang di Fase 6**: peran Admin Talenta, tahap `Verifikasi Kepegawaian`, diikuti tahap `Persetujuan Pimpinan` (ERD §5.1) | — sudah jalan; tinggal dikonfirmasi apakah perlu tahap ketiga di Kementerian |

**Yang bisa langsung dikerjakan tanpa menunggu jawaban apa pun:** Fase 0 → 0.5 → 1 → 2 → 3 → 5, dan sebagian besar Fase 4. Itu sudah mencakup seluruh permukaan dashboard, direktori, profil talenta, peta talenta, dan perbandingan kandidat.

---

*Dokumen ini diperbarui seiring fase berjalan. Kalau implementasi menyimpang dari `PRD.md`/`ERD.md`, dokumen sumber ikut diperbarui — jangan biarkan kode dan dokumen tidak sinkron (CLAUDE.md).*
