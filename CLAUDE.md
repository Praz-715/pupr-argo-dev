# CLAUDE.md

Panduan kerja untuk Claude Code di project ini. Baca ini duluan sebelum menyentuh kode.

## Tentang Project

**SIMT DJBK** — Sistem Informasi Manajemen Talenta untuk Direktorat Jenderal Bina Konstruksi (modul peningkatan fitur *karir.pu.go.id*). Aplikasi web internal untuk mengelola data talenta ASN, rule engine penilaian jabatan target, workflow nominasi & persetujuan suksesi, plus API eksternal bertoken untuk instansi terkait.

**Stack:** Next.js 16 (App Router, full-stack — frontend + backend dalam satu app) + React 19 + Tailwind v4 + Drizzle ORM + MySQL.

**Status:** implementasi berjalan. **Fase 0** (fondasi + rule engine), **0.5** (rapikan data dev), **1** (Dashboard Utama), **2** (Direktori & Profil Talenta), **3** (Peta Talenta & Perbandingan Kandidat), **4** (Master Data, Importer & Kualitas Data), **5** (Rule Engine — jabatan target, editor rubrik, simulasi & diff), **6** (Talent Pool & Workflow Nominasi + Inbox Tugas), **7** (Auth & RBAC — sesi asli, manajemen pengguna, audit log viewer, pengaturan sistem, pembatasan data per unit), **8** (Laporan & Ekspor — Gap Analysis, Rekap Nominasi & Approval, Pusat Ekspor CSV), dan **9** (API Eksternal `/api/v1` — Bearer + scope, Klien & Token API, Log Aktivitas, Dokumentasi) sudah selesai; berikutnya Fase 10 (Hardening). Dokumen di `doc/` tetap **source of truth** — kode mengikuti dokumen, bukan sebaliknya:

| Dokumen | Isi |
|---|---|
| [`doc/PRD.md`](doc/PRD.md) | Spesifikasi produk lengkap: tujuan, role, alur proses, inventaris halaman, desain API eksternal, fase implementasi. §10 memuat 12 keputusan terbuka (⚙️ = sudah ada default yang jalan di kode) |
| [`doc/ERD.md`](doc/ERD.md) | Skema database (31 tabel), relasi, aturan bisnis level data | 
| [`doc/sql/`](doc/sql/) | DDL & data dev, **dijalankan berurutan `001` → `013`**. Sumber kebenaran skema; perubahan berikutnya jadi berkas bernomor baru, bukan menyunting yang sudah tereksekusi |
| [`doc/KERANGKA TALENT POOL.md`](doc/KERANGKA%20TALENT%20POOL.md) | Rubrik penilaian talenta yang harus direplikasi di rule engine (Komponen→Indikator→Kategori Skor) |
| [`doc/BLUEPRINT READINESS - MODUL MANAJEMEN TALENTA.md`](doc/BLUEPRINT%20READINESS%20-%20MODUL%20MANAJEMEN%20TALENTA.md) | Gap analysis data & modul yang jadi dasar seluruh desain |
| [`doc/manajemen talenta 27 juli utk tim SIM.md`](doc/manajemen%20talenta%2027%20juli%20utk%20tim%20SIM.md) | Konteks organisasi, roadmap 3 fase, peta stakeholder |

**Rencana eksekusi:** [`phase.md`](phase.md) (di root, bukan di `doc/`) — hierarki kebenaran (doc = aturan, DB dev = dummy yang kita kendalikan), spesifikasi `lib/scoring` yang dikunci dari `KERANGKA TALENT POOL.md`, standar mutu interaksi (loading/skeleton/chart), keputusan teknis, dan urutan fase. **Fase 0, 0.5, 1, 2, 3, 4, 5, 6, dan 7 sudah selesai** — berikutnya Fase 8 (Laporan & Ekspor).

**Sebelum mulai fitur apa pun:** cek dulu apakah itu sudah dirancang di PRD.md (§6 Inventaris Halaman) dan ERD.md. Kalau implementasi ternyata perlu menyimpang dari desain di sana, update dokumennya juga — jangan biarkan kode dan dokumen jadi tidak sinkron.

---

## Keadaan Sekarang (per akhir Fase 9)

### Baseline verifikasi — kalau angka ini turun, ada yang regresi

```
npm run verifikasi           → 442 uji unit lolos (16 berkas uji)
npm run verifikasi:data      → 46/46 pemeriksaan (SQL murni, silang-uji isi DB)
npm run verifikasi:skoring   → 120/120 baris match_score lahir ulang, 0 menyimpang
npm run smoke                → 15/15 (F0) · 21/21 (F1) · 23/23 (F2) · 34/34 (F3) · 46/46 (F4)
                               · 44/44 (F5) · 39/39 (F6) · 46/46 (F7) · 30/30 (F8) · 39/39 (F9)
                               = 337 pemeriksaan
npm run build                → sukses, 30 entri route (31 halaman + /_not-found + /icon.svg + route ekspor) + middleware
npm run ukur:kueri           → 69 kueri = ~245 ms · :volume di 2.000 pegawai = ~1.070 ms
                               ambang 150 ms/kueri; agregat laporan 500 ms (alasannya di skripnya)
                               terberat di volume: gapIndikator 254 ms · ringkasGap 132 ms
npm run ukur:hitung-ulang    → ~195 ms · :volume 1.960 pegawai (17.640 baris rincian) = ~4,4 s
```

**Cara menjalankan smoke:** butuh dev server hidup. `npm run smoke` memakai `localhost:3000` (punya user) untuk **kesepuluh** berkasnya. Untuk server sendiri: `npx next dev -p 3100` lalu `node e2e/fase-N.smoke.mjs .next/smoke http://localhost:3100`.

`fase-0` sempat sendirian default ke port **3210** — sisa server sekali-pakai saat fase itu dikerjakan. Karena skrip gabungan tidak meneruskan base-url ke satu pun berkasnya, `npm run smoke` **selalu berhenti di langkah pertama** dengan `ERR_CONNECTION_REFUSED`, dan sembilan berkas sesudahnya tidak pernah jalan lewat jalur itu. Kalau menambah berkas smoke baru, defaultnya 3000.

**Sejak Fase 7 smoke benar-benar MASUK lewat halaman login** ([`e2e/_masuk.mjs`](e2e/_masuk.mjs)) — tidak ada lagi cookie `simt_dev_user`. Hasil login di-cache sebagai `storageState` per pengguna, jadi satu login per akun per proses meskipun satu berkas smoke membuat belasan konteks. Akun seed: `superadmin` · `martyanti.rbs` · `reza.kurniawan` · `dirjen` · `reviewer.bpsdm`, sandi dev `password123`.

**Empat jebakan berulang saat menulis smoke** — semuanya menghasilkan langkah HIJAU yang salah, bukan galat:
1. **Menunggu sebuah kata yang sudah ada di layar.** Kalimat akibat di dialog memuat kata status yang ditunggu ("Diverifikasi"), label penyaring memuat nama status, header tabel memuat kata "Sebelum". Penantiannya lolos seketika, `ctx.close()` menyusul, dan **konteks yang ditutup membatalkan POST server action yang masih terbang** — mutasinya batal tanpa jejak. Tunggu **keadaan**: dialog tertutup, tombol lenyap, aksi baru muncul.
2. **`innerText` menerapkan `text-transform`.** Label ber-`uppercase` terbaca "ANGGOTA POOL", bukan "Anggota pool". Dan `[role="dialog"]` **tidak pernah** cocok dengan `<dialog>` native — elemen itu punya *implicit* role tanpa atributnya; pakai `dialog[open]`.
3. **`hasText` mencocokkan sebagian, dan dialog konfirmasi hidup di baris yang sama.** `locator('tr', {hasText: label}).locator('button', {hasText: 'Cabut'})` cocok dengan **dua** elemen: tombol baris, dan tombol "Cabut token" milik `DialogKonfirmasi` yang dirender sebagai saudaranya. Pakai regex berjangkar: `{hasText: /^Cabut$/}`.
4. **Asersi "tidak ada" lolos ketika lokatornya yang salah.** `locator('section, div').filter({hasText: kode}).last()` cocok dengan puluhan div bersarang, dan `.last()` mengembalikan yang **terdalam** — yang memang tidak memuat tombol apa pun. Jadi `expect(count === 0)` untuk "klien PENDING belum bisa menerbitkan token" LULUS karena tombolnya tidak *ditemukan*, bukan karena tidak *ada*. Terjadi di smoke Fase 9 dan hanya ketahuan karena langkah **sesudahnya** gagal mengeklik. Obatnya dua-duanya sekaligus: **tegaskan lokatornya cocok tepat satu elemen** (`Panel` merender `<section>`, jadi `main section`), dan sertakan **kontrol positif** — sesuatu yang memang ada di wadah itu (tombol "Ubah") harus ditemukan, supaya hitungan nol benar-benar berarti nol.

**Jangan menyunting berkas Markdown lewat pipa teks PowerShell.** `Get-Content -Raw` + `Set-Content -Encoding utf8` pada berkas berisi non-ASCII **merusak encoding** (`→` menjadi `â†'`) dan menyisipkan BOM — terjadi ke CLAUDE.md di sesi ini, 77 baris rusak. Mojibake CP1252 itu deterministik jadi bisa dibalik, tapi jangan diulang: pakai alat Edit.

**Jangan `npm run build` sambil dev server hidup di direktori yang sama** — build produksi menulis ke `.next` yang sedang dipakai server dev, dan akibatnya route bersarang mendadak 404. Urutannya: smoke dulu, build terakhir.

### Gejala `.next` rusak: sebagian route 404, sisanya sehat

Muncul **tiga kali dalam satu sesi** dengan wujud berbeda-beda, dan dua kali salah didiagnosis lebih dulu. Ditulis di sini supaya tidak didiagnosis ulang dari nol.

**Kenali dalam 10 detik — ini bukan bug kode:** route **induk melayani 200 sementara anaknya 404**, atau **satu grup route jatuh utuh** sementara grup lain sehat. Kalau kodenya yang salah, induknya ikut jatuh. Dua jebakan saat mendiagnosis:

- **`404` tanpa sesi tidak berarti apa-apa** — route di `(app)` memang menjawab 307 ke `/masuk`. Reproduksi harus **dengan sesi**.
- **`application-code: 40ms` di log dev TIDAK membuktikan halamannya jalan** — merender `not-found.tsx` juga kode aplikasi. Aku sempat menyimpulkan sebaliknya dan salah arah karenanya.

**Pemicunya:** `.next` ditulis oleh lebih dari satu proses atau mode. Yang terbukti: (a) `npm run build` sementara dev server hidup di direktori yang sama — jejaknya `.next/BUILD_ID` ada; (b) dev server dimatikan paksa (`Stop-Process -Force`) meninggalkan artefak per-route setengah tertulis.

**Obatnya berjenjang, mulai dari yang termurah** — semuanya terbukti dipakai di sesi yang sama:

| # | Tindakan | Kapan berhasil |
|---|---|---|
| 1 | **Restart dev server** | Menyembuhkan grup `(auth)` yang jatuh utuh. Gagal untuk kasus berikutnya |
| 2 | **Sunting berkas route-nya** (mis. tambah spasi lalu simpan) | Menyembuhkan `/kandidat` & `/simulasi` yang 404 padahal server sudah di-restart — perubahan sumber memaksa modulnya dikompilasi ulang |
| 3 | **`rm -rf .next` lalu nyalakan ulang** | Selalu berhasil. Perlu saat `.next/BUILD_ID` ada. Kompilasi pertamanya lambat sekali, sesudahnya normal |

Urutannya: smoke dulu, build terakhir. Saat mematikan server, matikan **hanya PID yang memegang portnya**, jangan `taskkill /IM node.exe`.

### Route yang sudah ada

**Di dalam app shell** (grup `(app)`, wajib sesi): `/` (dashboard) · `/talenta` · `/talenta/[nip]` · `/peta-talenta` · `/bandingkan` · `/jabatan-target` · `/jabatan-target/[id]` · `/jabatan-target/[id]/kandidat` · `/jabatan-target/[id]/simulasi` · `/master/unit` · `/master/jabatan` · `/master/jabatan-kosong` · `/data/kelengkapan` · `/data/pembersihan` · `/data/konsolidasi` · `/master/hukuman-disiplin` · `/talent-pool` · `/nominasi` · `/nominasi/[id]` · `/rencana-pengembangan` · `/inbox` · `/profil` · `/admin/pengguna` · `/admin/audit-log` · `/admin/pengaturan` · `/laporan/gap-analysis` · `/laporan/nominasi` · `/laporan/ekspor`

Ditambah Fase 9: `/admin/api` · `/admin/api/log` · `/admin/api/dokumentasi`.

**Route handler** (bukan halaman):
- `GET /api/internal/ekspor/[jenis]` — unduhan CSV, tujuh jenis, peran ditegakkan per jenis (sesi internal).
- `GET /api/v1/{kotak-9/summary,pegawai,pegawai/[nip],talent-pool}` — API eksternal, **auth Bearer**, scope per klien.

**`api/` sengaja DILEWATI middleware** — gerbang di sana memeriksa cookie sesi, dan kedua permukaan `api/` tidak memakainya (`api/v1` pakai Bearer; `api/internal` membalas berkas unduhan, dan pengalihan menghasilkan HTML bernama `.csv`). Keduanya menegakkan aksesnya sendiri di route handler. Alasan lengkapnya ada di `middleware.ts`.

**Di luar app shell** (grup `(auth)`, tanpa sidebar/navbar): `/masuk` · `/lupa-password` · `/ganti-sandi`

Menu diaktifkan lewat `FASE_TERSEDIA` di [`lib/navigasi.ts`](lib/navigasi.ts) — **naikkan angkanya saat fase selesai**, kalau tidak menu-nya tetap tampil abu-abu. Item ber-`luarSidebar: true` (mis. Profil Saya) tetap ada di breadcrumb & command palette tapi tidak di sidebar.

### Utang yang ditunda dengan sengaja (bukan lupa)

| Yang ditunda | Alasan | Target |
|---|---|---|
| Ekspor **Excel (.xlsx) & PDF**, ekspor gambar chart | CSV sudah jalan (Fase 8) tanpa dependensi apa pun. `.xlsx` & PDF menuntut pustaka baru — keputusan yang pantas diambil sadar, bukan diselipkan. Gambar chart: warna dari CSS variable, serialisasi SVG naif menghasilkan gambar tanpa warna; harus menyuntikkan nilai warna terhitung, bukan menyalin `var(--chart-1)` | setelah dependensi diputuskan |
| Job asinkron ekspor (U-10) | **Ditolak untuk sekarang, dengan alasan terukur**: kueri laporan 2–60 ms, tiap ekspor dibatasi `LIMIT`. Antrean job = infrastruktur untuk masalah yang belum ada. Dipasang **per jenis** begitu ada satu yang benar-benar lambat | bila ada ekspor lambat |
| `openapi.yaml` untuk `/api/v1` | Halaman Dokumentasi API sudah memuat isinya (endpoint, scope, galat, rate limit) dan daftarnya diturunkan dari konstanta yang sama dengan gerbang. Spesifikasi mesin belum ada | Fase 10 |
| Tombol trigger sinkronisasi manual | Mekanisme sumber produksi belum diputuskan (PRD §10.2: batch vs API/webhook). Tombol yang memanggil sumber yang belum ada **selalu gagal** → pengguna menyimpulkan sinkronisasi rusak. Aturan normalisasinya sendiri sudah siap di `lib/importer` | Fase 4 lanjutan, setelah §10.2 dijawab |
| Pemetaan manual & tanda "diverifikasi" di Antrian Pembersihan | Butuh tempat menyimpan keputusan manusia (siapa/kapan/catatan) yang belum ada di skema; pemetaan riwayat jabatan lebih tepat dari editor riwayat pegawai | Fase 4 lanjutan / 5 |
| Unggah berkas SK hukuman disiplin & arsip ijazah | Belum ada strategi penyimpanan berkas | Fase 8 |
| Progress determinate pada Hitung Ulang | Setelah jalur tulisnya di-batch, satu jabatan target di 1.960 pegawai selesai **beberapa detik** (terukur 2,5–4,4 s tergantung beban mesin) — pending state biasa sudah memadai. Kalau nanti dipakai untuk seluruh jabatan target sekaligus, itu barulah kasus job asinkron (U-10) | bila perlu |
| Rate limit `/api/v1` **per klien**, bukan konstanta global | Sekarang 120/menit sebagai konstanta di `lib/api/gerbang.ts`. MoU berbeda berarti kuota berbeda, jadi tempatnya di kolom `api_client` — keputusan skema | setelah kebijakan kuota ditetapkan |
| Jejak percobaan token API yang **tidak dikenali** | `api_activity_log.api_client_id` NOT NULL, jadi permintaan bertoken asing tidak punya klien untuk diatribusikan → tidak masuk tabel itu, hanya log server. Akibatnya "seseorang memindai token acak" tidak terlihat di Log Aktivitas API, dan halamannya mengatakan itu apa adanya. Butuh kolom nullable atau tabel terpisah | keputusan skema |
| Syarat minimal kinerja/Kotak 9 di eligibility (U-11) | Perlu keputusan bisnis (phase.md §9 no. 5). Sementara ini Kotak 9 & predikat kinerja ditampilkan berdampingan dengan match score, jadi konteksnya ada walau tidak menyaring | setelah §9 no. 5 dijawab |
| Penanda notifikasi belum dibaca di navbar/sidebar | Inbox sudah jadi item nav & antrian nominasi sudah jadi widget dashboard (PRD §6.2), jadi pekerjaan yang menunggu tidak tersembunyi. Yang belum ada cuma lencana angka — butuh satu kueri hitung per permintaan di app shell, yang berarti tiap halaman membayar biayanya. Sekarang app shell sudah punya satu pembacaan sesi ber-`cache()`, jadi menumpangkannya di sana lebih murah daripada saat direncanakan | Fase 8 |
| Pengiriman surel (reset sandi, notifikasi keluar) | Belum ada layanan surel yang diputuskan di PRD §4.3. Lupa Password **mengatakan** itu apa adanya dan dialihkan ke Super Admin, bukan menjanjikan email yang tidak akan datang. Begitu transportnya diputuskan, `permintaan_reset_password` tinggal ditambahi kolom token — alurnya sudah benar | setelah transport surel diputuskan |
| 2FA untuk Super Admin & Admin Talenta (PRD §8) | Disebut sebagai *opsi* di PRD, bukan syarat. Penghambat tebak-sandi + sesi berbatas sudah menutup jalur serangan yang paling mungkin. 2FA menuntut keputusan operasional (TOTP? SMS? siapa yang memulihkan perangkat hilang?) yang belum ada pemiliknya | setelah kebijakan keamanan ditetapkan |
| "Tarik nominasi" oleh unit pengaju | Unit yang salah mengajukan sekarang harus minta Admin Talenta menolaknya. Enum `nominasi.status` tidak punya nilai untuk "ditarik", dan menambahnya berarti satu keadaan baru di state machine yang belum diminta PRD. Jejaknya tetap utuh lewat jalur penolakan | setelah dikonfirmasi pemilik proses |

### Yang perlu diketahui soal data dev

- **`008_seed_risiko_kekosongan.sql` mengubah tanggal lahir di NIP 4 pejabat** (Budi Santoso, Rus, Ika Puspita, Iwan) supaya ada yang mendekati BUP — halaman Risiko Kekosongan kosong tanpa itu. Jadi NIP mereka **sengaja berbeda** dari `doc/dtm_pegawai.csv`; itu bukan drift. Digit TMT CPNS & gender dipertahankan.
- **`009_kolom_pembanding.sql` menambah `asesmen_talenta.kotak_9_sumber`** — nilai `kotak_9` apa adanya dari sumber, dipakai HANYA sebagai pembanding kualitas data. Backfill 2 kasus nyata (Tasya & Tina = 4, hasil hitung = 7). Jangan pakai kolom ini di perhitungan apa pun.
- **`010_kunci_indikator.sql` menambah `rubrik_indikator.kunci_sistem`** — pengenal sumber data otomatis, terpisah dari nama indikator yang kini bebas diubah pengguna. `NULL` = tidak ada sumber otomatis → nilainya diisi manusia. Ditambah juga UNIQUE `(pegawai_id, jabatan_target_id)` di `match_score`.
- **`011_notifikasi.sql` menambah tabel `notifikasi`** + membetulkan **tiga keadaan workflow mustahil** yang ditinggalkan `007` (nominasi aktif tapi pool masih KANDIDAT · keputusan REVISI tapi status masih MENUNGGU_VERIFIKASI · nominasi di antrian tanpa `approval_log`). Ahmad Fauzi **sengaja** dibiarkan KANDIDAT walau nominasinya DITOLAK — itu keadaan sah (dipulihkan setelah penolakan) dan menguji tampilan kandidat berjejak penolakan.
- Keadaan workflow dev: **6 nominasi** (2 disetujui · 2 menunggu verifikasi · 1 dikembalikan untuk revisi · 1 ditolak), **1 suksesor ditetapkan** dengan 2 rencana pengembangan, **6 notifikasi** (5 belum dibaca + 1 sudah). Kalau angkanya bergeser tanpa ada yang menyentuh workflow, jalankan `npm run verifikasi:data`.
- Sisa temuan Antrian Pembersihan yang wajar ada: **27** riwayat jabatan belum terstruktur + **2** selisih Kotak 9. Kalau angkanya berubah drastis, cek apa yang menyentuh data.
- Ketiga jabatan target dev berstatus **AKTIF** dengan rubrik yang lolos seluruh pemeriksaan; kandidat lolos syarat: **17 · 8 · 10**. Kalau angka ini berubah tanpa ada yang menyunting rubrik, jalankan `npm run verifikasi:skoring`.
- **`012_auth.sql` menambah `sesi`, `pengaturan_sistem`, `permintaan_reset_password`** + empat kolom di `users` + indeks waktu di `audit_log`. **Sandi seluruh akun seed tetap `password123`** — dan sandi itu kini ada di daftar terlarang `lib/sandi.ts`, jadi tidak bisa dipakai lagi saat mengganti sandi. Itu disengaja: sandi dev tidak boleh ikut ke produksi lewat "sudah jalan di dev".
- Tabel `sesi` **bertambah setiap kali smoke dijalankan** (satu login per akun per proses) dan dibersihkan oportunistik saat login berikutnya. Jumlahnya tidak masuk baseline; kalau ingin bersih: `DELETE FROM sesi`.
- **`013_token_api_dev.sql` (dihasilkan program) membetulkan `token_hash` yang di `002` ternyata PLACEHOLDER** — bukan SHA-256 dari apa pun, salah satunya cuma 63 karakter hex, sehingga tidak ada satu pun token dev yang bisa memanggil `/api/v1`. Plaintext-nya **sengaja bukan acak** dan menyebut dirinya dev (token acak berbeda tiap generate sehingga smoke tak bisa memakainya), jadi **ketiganya publik karena ada di repo** — berlaku hanya untuk `pupr_dev`. Token dev: `simt_dev-bkn-hanya-untuk-pupr_dev` (BKN, tanpa data personal) · `simt_dev-birokepeg-hanya-untuk-pupr_dev` (Biro Kepegawaian, **dengan** data personal) · `simt_dev-bkn-lama-sudah-dicabut` (DICABUT + kedaluwarsa, untuk menguji penolakan).
- `api_activity_log` & `api_token.last_used_at` **bertambah/berubah setiap kali API diuji**. Tidak masuk baseline. Smoke Fase 9 menambah **~130 baris** dalam satu jalannya (uji rate limit menembakkan 120 permintaan), tapi seluruhnya milik klien uji `UJIF9` dan **ikut terhapus** saat pembersihan — klien dev tidak ikut terpengaruh. Kalau `UJIF9` masih ada di Klien & Token API, berarti smoke-nya mati di tengah; hapus dari DB.
- **Tidak ada klien dev dengan `endpoints:['pegawai']` TAPI `data_personal:false`**, jadi cabang `GalatScopePersonal` di `/api/v1/pegawai/{nip}` belum pernah dieksekusi — BKN tertolak lebih dulu oleh gerbang endpoint (smoke Fase 9 mencetak catatan ini setiap kali jalan). Kalau cabang itu perlu diuji, tambah klien dev keempat.
- **Pembatasan unit pada ekspor (`unitWajib`) juga belum pernah dieksekusi**, sebab alasan yang sejenis: satu-satunya peran berlingkup unit — Pengelola Unit — tidak berwenang mengunduh laporan apa pun (PRD §6.7–6.8), jadi cabangnya tak tercapai lewat HTTP. Ia **dipertahankan** sebagai pertahanan berlapis; yang perlu diingat cuma bahwa ia belum terbukti berjalan, jadi jangan memperluas daftar peran laporan tanpa menguji ulang lingkupnya.

### Keputusan yang MENUNGGU pemilik proses — jangan diputuskan sendiri

Ketiganya sudah dianalisis, punya default yang berjalan, dan **mengubah siapa boleh apa**. Menyentuhnya tanpa jawaban berarti mengubah desain, bukan memperbaiki cacat.

| # | Keputusan | Default yang berjalan | Tercatat di |
|---|---|---|---|
| 1 | **34 selisih gerbang baca halaman vs PRD §6** — Viewer & Pengelola Unit bisa membuka `/master/unit`, `/jabatan-target/*`, `/data/*`, `/talent-pool`, `/rencana-pengembangan` lewat URL langsung (menu disembunyikan, tapi URL tembus). PRD-nya kurang lengkap, atau halamannya kurang gerbang? | seperti sekarang | audit sesi; belum masuk PRD |
| 2 | **Daftar aktor `doc_tambahan`** memakai 6 aktor termasuk *Admin Data* & *Pejabat Reviewer* tapi **tanpa Pengelola Unit** — padahal itu dasar seluruh pembatasan unit | 5 peran; keduanya dibaca sebagai penamaan lain | PRD §10.13 · phase.md §9 no. 11 |
| 3 | **Kandidat FAIL masuk ranking atau tidak** — `doc_tambahan` bertentangan dengan dirinya sendiri (Blueprint §3 vs diagram §7) | **masuk**, sesuai diagram §7 & PRD §6.5 | PRD §10.14 · phase.md §9 no. 12 |

Disposisi lengkap paket `doc_tambahan` (7 sudah sama · 3 diambil · 3 ditunda · 4 ditolak, semuanya beralasan) ada di [`doc/doc_tambahan/DISPOSISI.md`](doc/doc_tambahan/DISPOSISI.md). **Dua pekerjaan dari sana siap jalan tanpa menunggu siapa pun:** versioning rubrik `DRAFT→PUBLISHED→RETIRED` (menutup lubang nyata — `rubrik_snapshot` menyelamatkan angka tapi bukan aturannya, jadi skor suksesor yang sudah DITETAPKAN tidak bisa dipertanggungjawabkan setelah ambang berubah) dan `missing_policy` REVIEW+EXCLUDE (Gap Analysis sekarang tidak bisa membedakan "tidak ada datanya" dari "buruk", sehingga rata-rata unit tertarik ke bawah oleh ketiadaan data).

### Titik masuk Fase 10 (Hardening)

- ~~Berkas smoke `fase-8` & `fase-9`~~ **sudah ada** (30 + 39 pemeriksaan, masuk `npm run smoke`).
- ~~Kueri laporan Fase 8 & Fase 9 belum diukur~~ **sudah masuk `ukur:kueri`** (69 kueri). Lihat temuan di bawah.
- **Yang MASIH belum terukur di skala volume: `aktivitasApi`.** `pupr_dev_volume` punya **0 baris** `api_activity_log` (seed-nya menyalin `api_client`/`api_token` tapi tidak menghasilkan aktivitas), jadi angka 3 ms itu mengukur tabel kosong — bukan bukti apa pun. Ia sekelas `auditLog`: hanya bertambah, tidak pernah dipangkas, dan **satu baris per permintaan `/api/v1`**. Kalau ada kueri yang akan melambat seiring waktu, ini dia.
- **Indeks yang disebut PRD §8** (`nip`, `unit_organisasi_id`, `jabatan_target_id`, `(pegawai_id, tahun_asesmen)`) belum pernah di-review sistematis terhadap `EXPLAIN`.
- **Aksesibilitas**: tiap chart sudah punya padanan tabel, palet sudah divalidasi CVD di kedua tema. Yang belum: audit fokus keyboard & `aria-label` menyeluruh.

#### Temuan pengukuran Fase 8: `gapIndikator` & alat ukur yang sempat menipu

**Yang paling penting bukan angkanya, tapi bahwa alat ukurnya sempat melegakan secara keliru.** `pupr_dev_volume` hanya punya rincian skor untuk **satu dari tiga** jabatan target — sebab `seed-volume.ts` menulis `match_score` lewat SQL tapi `match_score_detail` hanya bisa lahir dari mesin rubrik, dan yang mengisinya adalah `ukur:hitung-ulang:volume` yang menghitung satu target saja. Jadi `gapIndikator` terukur **117 ms (lolos)** padahal memindai sepertiga baris yang seharusnya. Setelah ketiga target dihitung (52.920 baris rincian, 8,82/skor — sama dengan bentuk `pupr_dev`), angka sebenarnya **241–275 ms**.

Dua pengaman dipasang supaya ini tidak terulang: `npm run ukur:hitung-ulang:volume:semua`, dan `ukur-kueri.ts` sekarang **melaporkan bentuk beban yang diukurnya** (`8.82/skor · 3/3 jabatan target`) beserta peringatan eksplisit kalau tidak representatif.

Soal angkanya sendiri:
- **Indeks penutup dicoba dan DITOLAK.** `idx_msd_agregat (rubrik_indikator_id, match_score_id, skor, sumber_nilai, perlu_review)` membuatnya **lebih lambat** (255–468 ms vs 241–275 ms) — optimizer berpindah ke indeks itu lalu memilih rencana yang lebih buruk. Jangan dicoba ulang.
- Biayanya **linear** terhadap jumlah baris rincian: 3 target = 254 ms, 1 target = 76 ms. Tidak ada yang salah secara struktural; barisnya memang banyak.
- Ambangnya **dipisah kelas, bukan dilonggarkan**: 150 ms lahir dari DoD Fase 1 untuk widget dashboard di jalur first paint. Panel laporan dirender di dalam `<Suspense>` berskeleton dan dibuka sesekali, jadi kelasnya beda — 500 ms, alasan lengkapnya di `scripts/ukur-kueri.ts`. Kalau tembus, yang dilakukan **bukan** menaikkan angkanya lagi: pilihannya menyaring ke satu jabatan target sebagai bawaan halaman, atau tabel agregat terpelihara.

### Bagaimana auth bekerja (Fase 7 + 9) — baca sebelum menyentuh apa pun yang berkaitan dengan akses

**Ada DUA permukaan autentikasi, dan keduanya tidak boleh dicampur.** Sesi ber-cookie untuk UI internal (`lib/auth.ts` → `lib/sesi.ts`), dan Bearer token untuk `/api/v1` (`lib/api/gerbang.ts`). Konsekuensi paling mudah dilupakan: **`api/` sengaja dilewati `middleware.ts`** — gerbang di sana hanya melihat cookie, dan menerapkannya ke `api/` membuat instansi eksternal menerima 307 + HTML halaman login alih-alih 401 JSON (benar-benar terjadi saat Fase 9 pertama diuji), serta membuat unduhan CSV bersesi mati menghasilkan berkas HTML bernama `.csv`. Keduanya menegakkan aksesnya sendiri di route handler.

- **Satu titik identitas, masih.** [`lib/auth.ts`](lib/auth.ts) → `getCurrentUser()`. Isinya sekarang membaca sesi asli lewat [`lib/sesi.ts`](lib/sesi.ts). Tidak ada komponen yang membaca cookie sendiri, dan jangan mulai — mengganti ke SSO nanti harus tetap cukup menyentuh satu berkas.
- **Tiga lapis, dengan pembagian tugas yang tegas:**
  1. `middleware.ts` — **gerbang cepat, bukan otoritas.** Berjalan di edge, tidak bisa menyentuh MySQL, jadi ia hanya melihat ada tidaknya cookie. **Jangan menaruh RBAC di sini**: cookie yang sudah dicabut akan lolos, dan peran tidak tersimpan di cookie sama sekali.
  2. `app/(app)/layout.tsx` — `wajibMasuk()`, tempat sesi **benar-benar** divalidasi. Karena ia membungkus seluruh halaman aplikasi, tidak ada route di bawahnya yang bisa lupa memasang penjagaan.
  3. `assertPeran()` / `jalankanMutasi()` di setiap server action — penegakan wewenang, tidak peduli middleware berkata apa.
- **Penolakan baca di halaman** memakai `<AksesDitolak>` ([`components/ui/akses-ditolak.tsx`](components/ui/akses-ditolak.tsx)) dan harus terjadi **sebelum kueri apa pun** — data yang sudah terkirim ke klien tidak bisa ditarik kembali. Contohnya di `master/hukuman-disiplin`, `bandingkan`, dan ketiga halaman `admin/*`.
- **Pembatasan per unit** diputuskan di [`lib/lingkup.ts`](lib/lingkup.ts) (murni, teruji) dan ditegakkan **di SQL** lewat `unitWajib` pada filter kueri. Filter unit wajib dipasang **berdampingan** dengan filter pilihan pengguna — dua klausa unit beririsan dengan sendirinya, sehingga `?unit=` milik unit lain menghasilkan nol baris alih-alih diam-diam dialihkan ke unit sendiri.
- **Peristiwa auth punya pintu tulis audit sendiri**, `catatPeristiwaAuth()` — `jalankanMutasi()` menuntut pengguna yang sudah masuk, jadi "masuk gagal" menurut definisi tidak bisa lewat sana. `grep 'jalankanMutasi\|catatPeristiwaAuth'` tetap menemukan seluruh jalur tulis ke `audit_log`.
- **Yang tidak boleh dilonggarkan tanpa alasan tertulis:** balasan gagal login yang sama untuk semua sebab, sandi yang tidak pernah masuk URL (pakai `<form action>`, bukan `onSubmit`), sandi sementara yang hanya tampil sekali, dan larangan menonaktifkan Super Admin aktif terakhir.

## Peta Kode

| Lokasi | Isi | Catatan |
|---|---|---|
| `lib/scoring/` | **Satu-satunya** implementasi rumus penilaian: Formula A & B, Kotak 9, agregasi rubrik berjenjang, integritas, masa berlaku, eligibility, **validasi struktur rubrik** (`validasi.ts`) | Bebas dependensi DB supaya bisa diuji murni. Rumus yang sama muncul di luar folder ini = bug. Mesin rubriknya sengaja **tidak pernah melempar** — itu benar untuk perhitungan massal, tapi berarti rubrik cacat tetap menghasilkan angka wajar, jadi kesalahannya ditangkap `validasi.ts` saat disimpan/diaktifkan |
| `lib/kelengkapan.ts` | Definisi & bobot butir kelengkapan data (U-2) | Satu sumber untuk badge profil, widget dashboard, dan halaman Fase 4 |
| `lib/penilaian.ts` | Jembatan **data pegawai → nilai mentah per indikator**, dipetakan lewat `kunci_sistem` | Di sini letak semua tafsiran atas bagian rubrik yang doc-nya cuma memberi contoh. Menambah sumber data baru = menambah satu kunci di `KUNCI_INDIKATOR` + satu cabang di `nilaiUntukKunci`, bukan menyebar `if` di pemanggil |
| `lib/skor-massal.ts` | Pipeline "rubrik + profil banyak pegawai → skor + kelayakan + peringkat + diff" | Bebas DB. Dipakai **empat** pemanggil: generator `007`, Hitung Ulang, Simulasi & Diff, halaman Kandidat. Menuliskan urutannya ulang di salah satu pemanggil = empat halaman bisa menampilkan skor berbeda untuk orang yang sama |
| `lib/workflow.ts` | **Satu** state machine transisi status nominasi & talent pool: tabel transisi eksplisit, wewenang per peran, `giliranSiapa()`, `periksaKonsistensi()` | Bebas DB. Satu keputusan manusia mengubah **tiga** hal (status pool, status nominasi, satu baris `approval_log`); `if` yang ditebar di komponen akan membuat salah satunya tertinggal — dan keadaan setengah jalan itu tidak menghasilkan galat, hanya halaman yang saling bertentangan |
| `lib/notifikasi.ts` | Isi & tujuan notifikasi per aksi workflow (U-7) | Peran tujuan diambil dari `PERAN_GILIRAN` di `lib/workflow.ts`, bukan ditulis ulang — menambah tahap approval tidak perlu menyunting dua tempat. Notifikasi **disebar per pengguna**, lihat catatan di `doc/sql/011` |
| `lib/skoring-tulis.ts` | Jalur tulis `match_score` + `match_score_detail` + peringkat pool | Ber-`server-only`, dipisah dari server action supaya bisa **diukur** tanpa browser. Semuanya di-batch: versi per-pegawai butuh 48 detik di 1.960 pegawai, versi batch 2,5 detik |
| `lib/kueri/` | Kueri baca untuk halaman; **agregasi wajib di SQL**, bukan `.reduce()` di server | Dev 40 pegawai, produksi 1.872. Kolom pengurutan dibatasi **daftar putih**, jangan interpolasi `?urut=` langsung ke SQL |
| `lib/kueri/rubrik.ts` | Dua jenis pembacaan yang **sengaja dipisah**: per halaman (beragregasi & berpaginasi) vs `ambilProfilKandidat()` yang memuat riwayat lengkap seluruh pegawai | Yang kedua memang berat dan itu tidak masalah — rubrik menilai **isi** riwayat tiap orang, jadi tidak bisa diagregasi di SQL. Tapi ia hanya boleh dipanggil Hitung Ulang & Simulasi, **tidak pernah** saat merender halaman biasa |
| `lib/kueri/suksesi.ts` | Talent pool, nominasi, timeline approval, rencana pengembangan, notifikasi & tugas | Satu baris pool **tidak bisa dibaca sendirian**: statusnya hanya bermakna bersama nominasi terakhir & keputusan approval terakhir, jadi ketiganya selalu diambil sekaligus. "Giliran siapa" diturunkan lewat `lib/workflow.ts`, tidak pernah ditulis sebagai kondisi SQL — itu akan jadi definisi kedua |
| `lib/kueri/dasar.ts` | Potongan SQL lintas berkas: `CTE_ASESMEN_TERBARU` (asesmen mana yang berlaku) & `SUBKUERI_UNIT_TURUNAN` (unit + seluruh turunannya, rekursif) | Keduanya **aturan bisnis**, bukan kenyamanan menulis. Menyalinnya ke berkas lain = dua halaman menghitung populasi berbeda tanpa ketahuan |
| `lib/param.ts` | Pembaca parameter URL di boundary: `angkaPositif` · `nomorHalaman` · `tanggalIso` · `dariDaftar` | Murni & teruji. Lahir dari bug nyata: `angkaPositif` sempat hidup sebagai closure lokal di **tiga** halaman, sehingga halaman keempat (Audit Log) tidak menemukannya lewat `grep` dan memakai `Number()` mentah — `?hal=abc` jadi `NaN`, masuk `OFFSET`, dan MySQL menjawab `Undeclared variable: NaN`. **Jangan menulis pembaca angka/tanggal baru di halaman**; `Math.max(NaN, 1)` tetap `NaN`, jadi bentuk yang terlihat seperti penjepit ternyata tidak menjepit |
| `lib/urut.ts`, `lib/banding.ts`, `lib/warna-seri.ts` | Konstanta & aturan yang dipakai **server dan klien sekaligus** | Sengaja di luar `lib/kueri/*` (yang ber-`server-only`) dan di luar berkas `'use client'`. Semua ekspor dari berkas `'use client'` jadi client reference — fungsi di sana tidak bisa dipanggil Server Component |
| `lib/db/schema.ts`, `relations.ts` | Hasil `npm run db:pull` | **Jangan diedit tangan** |
| `lib/auth.ts` | `getCurrentUser()`, `wajibMasuk()`, `assertPeran()` — satu-satunya titik akses identitas | Isinya sudah diganti ke sesi asli di Fase 7. Tetap satu titik: penggantian berikutnya (SSO) juga harus cukup menyentuh berkas ini |
| `lib/sesi.ts` | Pembuatan, pembacaan, pencabutan sesi; daftar perangkat aktif | Ber-`server-only`. `bacaSesi()` di-`cache()` per permintaan — tanpa itu layout, halaman, dan tiap server action menembak kueri yang sama berkali-kali. Kedua tenggat diperiksa **di dalam SQL yang sama** dengan pengambilan penggunanya: memeriksanya di JavaScript memakai jam server aplikasi, sedangkan yang menulis `terakhir_aktif_pada` adalah jam MySQL, dan dua jam yang berbeda beberapa detik menghasilkan sesi yang kadang hidup kadang mati tanpa pola |
| `lib/sandi.ts` | Hash bcrypt + **kebijakan sandi** | Bebas DB & Next supaya bisa diuji murni. Mengunci satu aturan yang tidak akan ditemukan siapa pun dengan mencoba-coba: **bcrypt memotong di 72 byte tanpa memberi tahu**, jadi dua sandi panjang yang berbeda di ujungnya akan saling cocok. Diukur dalam byte, bukan karakter |
| `lib/lingkup.ts` | Aturan pembatasan data per unit | Murni & teruji, **bukan** `server-only` — dipakai juga komponen klien untuk menjelaskan batasannya. **Gagal tertutup:** Pengelola Unit tanpa unit tidak melihat apa-apa, bukan melihat semua. Penegakannya di SQL lewat `unitWajib` pada filter kueri |
| `lib/pengaturan.ts` | Parameter sistem (masa berlaku asesmen, tenggat sesi, batas gagal masuk) | Nilai bawaannya **sama persis** dengan konstanta yang sudah dipakai sejak Fase 0, jadi baris yang hilang atau nilai rusak jatuh ke angka yang sudah terbukti — bukan ke nol atau ke error. `lib/scoring` tetap bebas DB: ia **menerima** `masaBerlakuTahun` sebagai argumen, pemanggilnya yang mengambil dari sini |
| `lib/diff-audit.ts` | Bandingkan `data_sebelum` vs `data_sesudah` satu baris audit | Murni & teruji. Perbandingannya **longgar** terhadap beda tipe dari driver (`1` vs `true`, `"10"` vs `10`): riwayat yang penuh perubahan palsu tidak bisa dibedakan dari riwayat yang benar, dan pada baris ke-30 pemeriksanya berhenti membaca |
| `components/ui/` | Primitif: Button (pending state bawaan), Skeleton, Badge, Panel, DataTable, Dialog, Toast, tiga keadaan kosong, `Bidang`+`kelasInput`, `AksesDitolak`, `CatatanLingkup` | `EmptyState` ada di berkas sendiri (bukan Client Component) karena tidak butuh interaktivitas. `Bidang` & `AksesDitolak` diangkat ke sini di Fase 7 setelah polanya tersalin di lima berkas — sepuluh salinan komponen penampil pesan kesalahan berarti sepuluh cara pesan itu bisa terlihat berbeda, dan yang paling mungkin tertinggal justru `role="alert"`-nya |
| `components/charts/` | Wrapper chart sadar tema; warna dari token `--chart-1..4` lewat `lib/warna-seri.ts` | Kotak 9 pakai CSS Grid, bukan library chart. **Warna seri chart TIDAK BOLEH memakai warna status** (success/warning/danger) — itu punya makna tetap. Palet 4 warna sudah divalidasi untuk **semua pasangan** di kedua tema, tapi pemisahan terburuknya di pita CVD 6–8 → **setiap seri wajib punya pola garis berbeda** + legenda yang menggambar polanya + padanan tabel angka. Warna sendirian tidak cukup |
| `lib/importer/` | Gerbang masuk data sumber: normalisasi §6 + **pencatatan temuan**. Bebas DB, bisa diuji murni | Mengorkestrasi `lib/normalisasi`/`lib/nip`/`lib/scoring`, bukan mengulangnya. Uji diorganisasi menurut **nomor aturan phase.md §6** supaya kelengkapannya terukur terhadap dokumen |
| `lib/audit.ts` | `jalankanMutasi()` — **satu-satunya pintu tulis** | Ia memeriksa peran → baca keadaan sebelum → tulis → catat audit. Menulis DB tanpa lewat sini berarti mutasi tanpa jejak audit |
| `lib/aksi/` | Server action: Zod di boundary, `HasilAksi` seragam, galat per-field | Tidak melempar untuk kesalahan wajar (validasi/wewenang/constraint) — melempar akan mengganti seluruh halaman padahal yang perlu cuma pesan di sebelah field |
| `lib/api/` | Permukaan API eksternal: `token.ts` (buat/hash/baca header — murni) · `scope.ts` (penegakan `scope_akses` + penyamaran — murni) · `gerbang.ts` (auth → scope → rate limit → jejak) · `bungkus.ts` (`tanganiV1()`) | Dua yang murni diuji tanpa DB (20 uji), dikelompokkan menurut **cara data bisa bocor**. Dua aturan yang tidak boleh dilonggarkan: **gagal tertutup** (`scope_akses` tak terbaca = nol endpoint, bukan semua) dan **penyamaran allowlist** — `samarkanPegawai()` menyusun balasan dari field yang diizinkan, bukan `delete baris.nip`; dengan blocklist, kolom yang ditambahkan ke kueri nanti menetes diam-diam ke klien tanpa MoU dan tidak ada uji yang gagal. `tanganiV1()` jadi pembungkus supaya endpoint berikutnya tidak **bisa** lupa memanggil gerbang |
| `lib/ekspor.ts` | Serialisasi CSV (murni, 16 uji) | Tiga hal yang baru terlihat setelah berkasnya dibuka orang lain di aplikasi lain: **injeksi formula** (Excel menjalankan sel berawalan `=` `+` `-` `@`, dan aplikasi ini mengekspor catatan teks bebas yang diisi manusia), **BOM UTF-8** (tanpa itu Excel Windows membaca CSV sebagai ANSI dan setiap nama non-ASCII rusak — akan dilaporkan sebagai "ekspornya rusak" lalu didiagnosis di tempat yang salah), dan pengutipan RFC 4180 |
| `lib/kueri/laporan.ts` · `lib/kueri/api.ts` | Agregat laporan Fase 8 · klien/token/log aktivitas Fase 9 | Keduanya hanya `GROUP BY` data yang sudah ada — **tidak ada rumus baru**. `api.ts` tidak pernah menyeleksi `token_hash`, alasan yang sama dengan `password_hash` di `admin.ts` |
| `lib/aksi/gerbang.ts` | `gerbangPeran()` — **wajib jadi dua baris pertama setiap server action** | Lahir dari audit: `jalankanMutasi()` memang memeriksa peran, tapi **di dalam dirinya**, sedangkan 28 dari 47 aksi perlu membaca keadaan lebih dulu untuk menyusun penolakan yang berguna ("masih ditempati 3 pegawai aktif"). Pembacaan itu berjalan **sebelum** peran diperiksa dan balasannya berbeda-beda menurut isi DB — jadi siapa pun yang punya sesi bisa membedakan "baris itu ada" dari "Anda tidak berhak", dan satu penolakan bahkan menyebut **nama pegawai**. Aturannya justru sudah tertulis di `lib/audit.ts` sejak awal ("periksa peran dulu, baru baca"); yang belum ada cuma alatnya. Daftar peran **wajib** konstanta yang sama dengan `peranDiizinkan` di `jalankanMutasi()` di bawahnya — `jalankanMutasi()` tetap penegak terakhir, gerbang ini hanya mempercepat penolakan |
| `scripts/` | Generator SQL & pemeriksa: `gen-006-seed-perluasan`, `gen-008-seed-risiko`, `recompute`, `verifikasi-data`, `verifikasi-skoring`, `ukur-kueri`, `ukur-hitung-ulang`, `jalankan-sql` | Angka hasil hitung di DB **selalu** output kode, bukan tulisan tangan. `seed-volume.ts` memuat daftar berkas skema — **tambahkan berkas DDL baru ke sana**, kalau tidak `pupr_dev_volume` gagal dibangun (tabel master disalin dengan `SELECT *`, jadi satu kolom tertinggal = jumlah kolom tidak cocok) |

**Perintah yang sering dipakai:**

```
npm run verifikasi          # typecheck + lint + uji unit
npm run verifikasi:data     # 46 pemeriksaan isi pupr_dev (silang-uji SQL murni: skoring, konsistensi workflow, keadaan auth)
npm run verifikasi:skoring  # lib/skor-massal vs isi match_score — menangkap KODE yang menyimpang
npm run smoke               # Playwright Fase 0 (shell) + 1 (dashboard) + 2 (direktori/profil) + 3 (peta/bandingkan)
                            #           + 4 (master/kualitas) + 5 (rule engine) + 6 (talent pool/workflow) + 7 (auth & RBAC)
                            #           + 8 (laporan/ekspor CSV) + 9 (API eksternal) — 337 pemeriksaan, ~9 menit
npm run db:recompute        # hasilkan ulang doc/sql/007_recompute.sql dari lib/scoring
npm run ukur:kueri          # waktu 69 kueri halaman Fase 1-9 (150 ms/kueri · 500 ms agregat laporan)
npm run ukur:hitung-ulang   # waktu jalur TULIS Hitung Ulang (ambang 30 s/jabatan target)
npm run ukur:hitung-ulang:volume:semua  # hitung SEMUA jabatan target di pupr_dev_volume —
                            # WAJIB sebelum ukur:kueri:volume, kalau tidak beban Gap Analysis
                            # cuma sepertiga dan hasil ukurnya melegakan secara keliru
npm run db:gen-risiko       # hasilkan ulang doc/sql/008_seed_risiko_kekosongan.sql
npm run db:gen-token-api    # hasilkan ulang doc/sql/013_token_api_dev.sql (hash token dev)
npm run db:volume           # bangun pupr_dev_volume (~2.000 pegawai)
npm run db:sql doc/sql/0NN_*.sql   # jalankan satu berkas skema ke pupr_dev (tambah --db untuk DB lain)
npm run ukur:kueri:volume   # waktu kueri pada skala produksi
npm run ukur:hitung-ulang:volume  # waktu Hitung Ulang pada skala produksi
npm run ukur:payload        # buktikan payload render tidak tumbuh linear
```

**Dua pemeriksaan yang saling melengkapi, jangan dianggap ganda:** `verifikasi:data` memakai SQL murni untuk menguji **isi DB** terhadap rumus (menangkap data yang menyimpang); `verifikasi:skoring` menjalankan `lib/skor-massal` lalu membandingkannya dengan isi DB (menangkap **kode** yang menyimpang). Memverifikasi `lib/scoring` dengan `lib/scoring` hanya mengonfirmasi dirinya sendiri.

**Dev server dijalankan sendiri oleh user di `http://localhost:3000`** — jangan mematikan proses Node sembarangan (`taskkill /IM node.exe` membunuh dev server user). Kalau perlu server sendiri untuk pengujian, pakai port lain dan matikan hanya PID itu.

## Database Dev

- MySQL 8-compatible (docker container lokal), host `127.0.0.1:3306`, database `pupr_dev`.
- Kredensial dev: `devuser` / `dev123` (dev-only, container lokal — bukan kredensial produksi, jangan pernah dipakai/disamakan dengan environment lain).
- Skema & seed sudah dieksekusi. Reset total = jalankan `doc/sql/001` → `012` **berurutan** (001 drop+recreate semua tabel), mis. `npm run db:sql doc/sql/001_schema.sql` satu per satu. Rantai ini terbukti reproducible: dua kali jalan dari nol menghasilkan checksum tabel inti yang identik.
- Setelah menambah berkas DDL baru: jalankan `npm run db:pull` (regenerasi `lib/db/schema.ts` — **jangan diedit tangan**) dan tambahkan berkasnya ke `BERKAS_SKEMA` di `scripts/seed-volume.ts`.
- `007_recompute.sql` **dihasilkan program**, bukan ditulis tangan. Kalau `lib/scoring` berubah, jalankan `npm run db:recompute` untuk membuatnya ulang, lalu eksekusi.
- `pupr_dev_volume` adalah database uji performa terpisah (~2.000 pegawai), dibangun ulang oleh `npm run db:volume`. Aman dihapus: `DROP DATABASE pupr_dev_volume`.

## Prinsip Kerja Full-Stack

Kerjakan sebagai full-stack developer profesional — bukan sekadar bikin fitur nyala, tapi kode yang bisa dipercaya jangka panjang:

1. **Selalu crosscheck function sebelum menulis yang baru.** Sebelum bikin helper/util/komponen baru, cari dulu di codebase apakah sudah ada yang serupa (grep nama, cek folder `lib/`/`utils/`/`components/`). Jangan sampai ada 2-3 versi logika yang sama tersebar di file berbeda. Kalau nemu yang mirip tapi belum pas, pertimbangkan generalisasi fungsi yang ada daripada duplikasi.
2. **Satu sumber kebenaran untuk logika bisnis inti** — terutama formula skoring (Formula A generik 50/50, Formula B match score 65/20/15, klasifikasi Kotak 9, agregasi sub-indikator). Implementasikan sekali sebagai shared utility yang dipakai bareng oleh UI, route handler internal, route API eksternal, dan job terjadwal (`sync_log`/recompute). Jangan reimplementasi rumus yang sama di dua tempat.
3. **Skema & tipe konsisten dengan ERD.md** — nama tabel/kolom di DB pakai snake_case persis ERD, tipe TypeScript-nya derive dari situ (bukan didefinisikan manual terpisah dan gampang drift).
4. **Server Components by default**, Client Components hanya untuk yang benar-benar interaktif (form, builder rubrik, perbandingan kandidat, toggle tema).
5. Validasi input di boundary (form submit, route handler `api/v1/*`), percaya pada data internal yang sudah tervalidasi — jangan validasi berlebihan di setiap layer.
6. Route internal (dipakai UI sendiri, auth sesi) vs `api/v1/*` (dipakai instansi eksternal, auth Bearer token) itu **dua permukaan berbeda di atas data yang sama** — jangan duplikasi logic query, cukup beda lapisan auth & filtering scope di atasnya.

## Desain UI/UX

Target rasa: **profesional, bersih, seperti Notion** — bukan tampilan marketing/landing page, ini alat kerja internal untuk staf kepegawaian & pimpinan eselon 1 dan 2 yang dipakai tiap hari.

- **Tipografi & spacing**: tipografi jelas dan tenang, whitespace lega, gunakan border/divider tipis alih-alih shadow tebal, palet warna netral dengan 1 warna aksen — hindari gradient berlebihan, hindari emoji dekoratif di UI produksi.
- **Tema terang & gelap wajib sejak awal** — bukan tambahan belakangan. Pakai CSS variables/design tokens untuk warna (bukan warna hardcoded di komponen), strategi `dark:` class Tailwind atau setara, toggle tema mudah dijangkau dari navbar. Setiap komponen baru harus dicek tampil benar di kedua tema.
- **Layout app shell full-screen**: sidebar kiri persisten (navigasi utama, bisa collapse) + navbar atas (breadcrumb/judul halaman, search, menu user, toggle tema) + area konten utama. Tidak ada hero section ala landing page — langsung ke konten kerja.
- **Halaman padat data** (tabel, dashboard, tabel talent pool, editor rubrik) mengutamakan keterbacaan & densitas informasi di atas dekorasi visual — sesuai kebutuhan pengguna yang menatap tabel/grafik seharian.
- Ikuti inventaris halaman & isi kontennya persis seperti di `doc/PRD.md` §6 kecuali ada alasan kuat untuk menyimpang (dan kalau menyimpang, update PRD.md juga).

## Catatan Penting Lain

- Data pegawai (NIP, kinerja, hukuman disiplin) adalah data ASN sensitif — perlakukan sesuai catatan kepatuhan di `doc/PRD.md` §7.3 (rujukan UU PDP No. 27/2022), jangan expose lebih dari yang diizinkan `scope_akses` di endpoint eksternal.
- Ada beberapa keputusan desain yang masih berstatus **asumsi, belum dikonfirmasi user** — lihat `doc/ERD.md` §5 dan `doc/PRD.md` §10 sebelum mengambil keputusan implementasi yang bergantung padanya (mis. metode agregasi sub-indikator, siapa yang menjalankan tahap verifikasi kepegawaian, relasi dengan *karir.pu.go.id*).
- **Sebelum produksi, EMPAT hal wajib diganti** dan tidak satu pun bisa ditemukan oleh uji: (1) **sandi seluruh akun seed** masih `password123` — atur ulang semuanya lewat Manajemen Pengguna supaya pemiliknya dipaksa mengganti saat masuk; (2) `NEXT_PUBLIC_DEV_ROLE_SWITCH` sudah tidak dipakai kode mana pun, hapus saja dari env; (3) **HTTPS wajib** — cookie sesi dipasang `secure` hanya ketika `NODE_ENV === 'production'`, jadi menjalankan build produksi di belakang HTTP polos berarti cookie sesi melintas terbuka; (4) **ketiga token API dev di `doc/sql/013_token_api_dev.sql` PUBLIK** — plaintext-nya ada di repositori (disengaja, supaya smoke bisa memakainya). Cabut ketiganya lewat halaman Klien & Token API lalu terbitkan yang baru; token produksi acak 256 bit dan ditampilkan sekali. Kalau `pupr_dev` pernah dipromosikan ke environment lain, ketiga token itu ikut.
