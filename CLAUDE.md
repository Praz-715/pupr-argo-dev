# CLAUDE.md

Panduan kerja untuk Claude Code di project ini. Baca ini duluan sebelum menyentuh kode.

## Tentang Project

**SIMT DJBK** — Sistem Informasi Manajemen Talenta untuk Direktorat Jenderal Bina Konstruksi (modul peningkatan fitur *karir.pu.go.id*). Aplikasi web internal untuk mengelola data talenta ASN, rule engine penilaian jabatan target, workflow nominasi & persetujuan suksesi, plus API eksternal bertoken untuk instansi terkait.

**Stack:** Next.js 16 (App Router, full-stack — frontend + backend dalam satu app) + React 19 + Tailwind v4 + Drizzle ORM + MySQL.

**Status:** implementasi berjalan. **Fase 0** (fondasi + rule engine), **0.5** (rapikan data dev), **1** (Dashboard Utama), **2** (Direktori & Profil Talenta), **3** (Peta Talenta & Perbandingan Kandidat), **4** (Master Data, Importer & Kualitas Data), **5** (Rule Engine — jabatan target, editor rubrik, simulasi & diff), **6** (Talent Pool & Workflow Nominasi + Inbox Tugas), **7** (Auth & RBAC — sesi asli, manajemen pengguna, audit log viewer, pengaturan sistem, pembatasan data per unit), **8** (Laporan & Ekspor — Gap Analysis, Rekap Nominasi & Approval, Pusat Ekspor CSV), **9** (API Eksternal `/api/v1` — Bearer + scope, Klien & Token API, Log Aktivitas, Dokumentasi), dan **10** (Kategori Riwayat Diklat, Validasi Riwayat, + peralihan skoring ke kategori tervalidasi) sudah selesai. Sisa Fase 10 (Hardening) yang belum: review indeks terhadap `EXPLAIN`, audit aksesibilitas keyboard, `openapi.yaml`, dan tiga verifikasi ulang yang tertunda — lihat "Titik masuk Fase 10". Dokumen di `doc/` tetap **source of truth** — kode mengikuti dokumen, bukan sebaliknya:

| Dokumen | Isi |
|---|---|
| [`doc/PRD.md`](doc/PRD.md) | Spesifikasi produk lengkap: tujuan, role, alur proses, inventaris halaman, desain API eksternal, fase implementasi. §10 memuat 12 keputusan terbuka (⚙️ = sudah ada default yang jalan di kode) |
| [`doc/ERD.md`](doc/ERD.md) | Skema database (31 tabel), relasi, aturan bisnis level data | 
| [`doc/sql/`](doc/sql/) | DDL & data dev, **dijalankan berurutan `001` → `015`**. Sumber kebenaran skema; perubahan berikutnya jadi berkas bernomor baru, bukan menyunting yang sudah tereksekusi |
| [`doc/KERANGKA TALENT POOL.md`](doc/KERANGKA%20TALENT%20POOL.md) | Rubrik penilaian talenta yang harus direplikasi di rule engine (Komponen→Indikator→Kategori Skor) |
| [`doc/BLUEPRINT READINESS - MODUL MANAJEMEN TALENTA.md`](doc/BLUEPRINT%20READINESS%20-%20MODUL%20MANAJEMEN%20TALENTA.md) | Gap analysis data & modul yang jadi dasar seluruh desain |
| [`doc/manajemen talenta 27 juli utk tim SIM.md`](doc/manajemen%20talenta%2027%20juli%20utk%20tim%20SIM.md) | Konteks organisasi, roadmap 3 fase, peta stakeholder |

**Rencana eksekusi:** [`phase.md`](phase.md) (di root, bukan di `doc/`) — hierarki kebenaran (doc = aturan, DB dev = dummy yang kita kendalikan), spesifikasi `lib/scoring` yang dikunci dari `KERANGKA TALENT POOL.md`, standar mutu interaksi (loading/skeleton/chart), keputusan teknis, dan urutan fase. **Fase 0, 0.5, 1, 2, 3, 4, 5, 6, dan 7 sudah selesai** — berikutnya Fase 8 (Laporan & Ekspor).

**Sebelum mulai fitur apa pun:** cek dulu apakah itu sudah dirancang di PRD.md (§6 Inventaris Halaman) dan ERD.md. Kalau implementasi ternyata perlu menyimpang dari desain di sana, update dokumennya juga — jangan biarkan kode dan dokumen jadi tidak sinkron.

---

## Keadaan Sekarang (per akhir Fase 10 — commit `56c3d10`)

> **Baris Kotak 9 + Jabatan Kosong bertinggi TETAP 39rem** dan keduanya sejajar (624px, selisih 0). Daftar jabatan bergulir DI DALAM panelnya, tidak memanjangkannya — terukur: 24 baris → panel tetap 624px, tergulir 1.438px; 6 baris sekarang → tanpa gulir (474 = 474). Dua hal yang mudah salah di sini: **`grid-rows-[minmax(0,1fr)]` wajib** (`h-` sendirian hanya menetapkan tinggi container, barisnya tetap `auto` dan boleh melebihinya — versi pertama tanpa itu tumbuh 613px → 2.062px dan `overflow-y-auto` tidak pernah aktif), dan **`min-h-0` wajib** di panel & `<ul>` (flex item menolak lebih pendek dari isinya). Grid Kotak 9 punya prop `isiTinggi` supaya halaman Peta Talenta tetap memakai sel ber-rasio 4:3.
>
> **Revisi tampilan dari `PUR.pdf` (12 Agu 2026) — 5 dari 8 butir sudah dieksekusi.** Tiga sisanya menunggu jawaban user karena maksudnya ambigu (lihat akhir catatan ini).
>   - **Lencana "N tanpa jabatan target" dihapus** dari widget Jabatan Strategis Kosong — tiap baris sudah menulis "Belum ada jabatan target" sendiri. Cabang positifnya ("Semua punya jabatan target") ikut dilepas supaya tidak ada satu lencana yang muncul hanya di keadaan sebaliknya.
>   - **Direktori: "NIP & Nama Lengkap" dipecah dua kolom.** `KOLOM_URUT` di `lib/kueri/pegawai.ts` sudah memuat `nip` sejak awal, jadi kolomnya langsung bisa diurutkan. Hanya kolom nama yang `sticky` — dua kolom menempel sekaligus memakan hampir separuh lebar layar saat tabel digulir. **Ini menyimpang dari mockup #1 di `doc/KERANGKA TALENT POOL.md`** yang menyebutnya satu kolom; `KOLOM_MOCKUP` di `e2e/fase-2.smoke.mjs` disesuaikan karena yang dijaga langkah itu adalah kelengkapan informasi, bukan jumlah kolom.
>   - **Toolbar penyaring Direktori jadi satu baris di `xl`.** Penyebab bungkusnya bukan tata letak melainkan `shrink-0` di `components/ui/pilih.tsx`: enam dropdown berlebar tetap = 60rem, melewati ruang setelah sidebar 240px. Solusinya `LEBAR_RINGKAS` (`xl:w-auto xl:min-w-0 xl:flex-1 xl:shrink`) — varian `xl:` menang karena media query-nya lahir belakangan di CSS. Terukur: **satu baris di 1280 · 1400 · 1600px**, tetap membungkus di 1024px (di bawah `xl`, memaksa satu baris di sana membuat label dropdown tak terbaca).
>   - **Talent Pool: sel kandidat dipecah** jadi Kandidat · NIP · Jabatan. Peringatan konsistensi tetap di kolom nama — ia soal barisnya secara keseluruhan, bukan soal NIP atau jabatannya.
>   - **Talent Pool: tujuh teks kecil dihapus** — tiga sub-keterangan di kepala tabel ("kinerja × potensial", "tidak masuk match score", "65/20/15 · 0–100") dan empat di kartu KPI. Satu di antaranya memuat **tautan ke `/rencana-pengembangan`**; ia tetap terjangkau dari sidebar, jadi tidak ada yang terjebak — tapi kalau tautan itu diperlukan lagi, di situ tempatnya. `LABEL_POOL` jadi impor tak terpakai dan ikut dilepas.
>
> **Lanjutan revisi (12 Agu 2026, instruksi susulan):**
>   - **Panel Jabatan Strategis Kosong DIGANTI Peta Kinerja × Potensial** di dashboard. Komponennya utuh di `_widget/jabatan-kosong.tsx`; isinya tetap terjangkau di `/jabatan-target#jabatan-kosong`. **Konsekuensi yang wajib diikuti:** anchor `#jabatan-kosong` lenyap dari dashboard, jadi kartu KPI "Jabatan strategis kosong" dialihkan ke `/jabatan-target#jabatan-kosong` — kalau tidak, ia jadi klik mati, kegagalan yang sama seperti saat widget Antrian Nominasi dilepas. `loading.tsx` ikut ditukar supaya tata letaknya tidak melompat.
>   - **Kartu "Nominasi menunggu tindakan" → "Daftar nominasi"**, dan **angkanya ikut berubah** ke `nominasiTotal`. Kartu yang menaut ke daftar penuh sambil memajang angka sebagian membuat pembaca menghitung selisih yang tidak pernah dijelaskan; yang menunggu tindakan turun ke baris konteks.
>   - **Tombol pemilih kolom dilepas dari Direktori** lewat prop baru `tanpaPemilihKolom` di `components/ui/data-table.tsx` — **bukan dihapus dari `DataTable`**, sebab tiga tabel lain (Kandidat · Master Jabatan · drill-down Peta Talenta) masih memakainya. Alasan yang dibaca dari tangkapan layar: pemilih kolom duduk berdampingan dengan "Menampilkan 1–10 dari 10 baris", dan keduanya memajang pasangan angka berbentuk sama ("10/11" vs "1–10 dari 10") yang menghitung hal berbeda.
>   - **Asersi smoke F1 "nol chart Recharts" DILINGKUPI ke panel Kotak 9.** Aturan lamanya benar hanya selama dashboard tidak memuat widget chart; Peta Kinerja × Potensial adalah scatter Recharts, jadi asersi itu jadi merah tanpa ada yang rusak. Yang sebenarnya dijaga: grid Kotak 9 digambar sebagai sel yang bisa diklik, bukan SVG.
>
> **Satu butir masih TERBUKA:** kartu KPI "Terverifikasi" (butir 2 di `PUR.pdf`). Alasan yang ditulis user — "biar tidak digabung dengan tab nominasi menunggu tindakan" — **larut sendiri** begitu kartu itu dinamai ulang "Daftar nominasi": tidak ada lagi kartu "menunggu tindakan" yang bisa mencampurnya. Menambah kartu kelima tanpa premis itu berarti menebak, jadi ditahan. Kalau nanti diminta, "terverifikasi" perlu diperjelas dulu: **nominasi berstatus `DISETUJUI`** (sudah lewat verifikasi Admin Talenta, menunggu Pimpinan) atau **`talent_pool.status = 'DIVERIFIKASI'`** — dua angka yang berbeda.
>
> **Panel di halaman PROFIL juga bertinggi TETAP dengan gulir di dalamnya** (permintaan user, 12 Agu 2026: "bikin semua kotaknya fix aja, kalo kepanjangan mending di scroll"). Penyebab lubang kosongnya adalah **`items-start`** pada kedua grid dua-kolom: tiap panel mengambil tinggi alaminya, jadi panel berisi 1 riwayat jabatan meninggalkan celah sebesar selisihnya terhadap kolom sebelah yang memuat 13 diklat. Sekarang barisnya dipatok — grid 1 (Asesmen | Tren kinerja) **27rem**, grid 2 (Riwayat jabatan | Pendidikan + Diklat) **36rem**, dan panel Kecocokan **32rem** (satu-satunya panel selebar halaman yang perlu dipatok: terukur 794px dengan 3 jabatan target dan tumbuh tiap target baru → 512px + gulir 282px).
>   - Terukur sesudahnya: baris 1 **432 = 432**, baris 2 **576 = 278 + 278 + gap**, nol gulir horizontal halaman, tinggi halaman 2.449 → 2.321px.
>   - **Kolom kanan grid 2 memuat DUA panel**, jadi ia membagi tinggi barisnya sendiri lewat `flex-col` + tiap panel `flex-1 min-h-0`. Dengan `space-y-5` biasa keduanya kembali setinggi isinya dan lubangnya cuma pindah ke bawah panel yang lebih pendek.
>   - **Kelengkapan Data & Integritas SENGAJA dibiarkan setinggi isinya** (196px & 145px). Mematok panel yang lebih pendek dari patokannya justru **menambah** ruang kosong — kebalikan dari yang diminta.
>   - Patokannya hanya di `xl`. Di layar sempit panel-panel ini bertumpuk satu kolom, dan memaksa tinggi di sana menghasilkan gulir bersarang di dalam halaman yang juga menggulir.
>   - Fallback `<Suspense>`-nya ikut menerima `className` supaya kerangkanya setinggi panel jadinya — tanpa itu halaman melompat tepat saat data masuk, jebakan yang sama seperti `loading.tsx` dashboard.
>
> **SEMUA opsi filter/dropdown diturunkan dari data, dan dari populasi yang DITAMPILKAN** — bukan daftar tetap, dan bukan dari populasi penuh. Diuji dengan mencoba **setiap opsi satu per satu** lalu menghitung barisnya: direktori **16 opsi · 0 mati** · peta talenta **19 · 0** · gap analysis **11 · 0**. Sebelumnya direktori punya **55 opsi dan 9 di antaranya menjawab nol baris** — 21 unit terdaftar padahal hanya 3 punya pegawai yang ditampilkan, plus daftar tetap `Kotak 1–9` dan keempat `status asesmen`. Klik mati begitu terbaca sebagai "penyaringnya rusak", bukan sebagai "datanya memang tidak ada" (phase.md §5.2).
>   - Yang diubah: opsi unit/eselon/jenjang/pendidikan di `pegawai.ts` & `peta-talenta.ts` ikut `filterSumber`; **`Kotak 9` & `status asesmen` berhenti jadi konstanta di komponen** dan kini datang dari `ambilOpsiFilter()`; opsi unit & jenjang laporan berhenti diturunkan dari tabel `jabatan` (yang memuat unit tanpa pegawai) dan beralih ke `pegawai`; opsi jabatan target Gap Analysis hanya yang benar-benar punya `match_score_detail`.
>   - **Laporan Nominasi sengaja dibiarkan** boleh menghasilkan nol baris: ia menjelaskan keadaannya sendiri ("Belum ada nominasi · Tidak ada baris yang cocok dengan penyaring"), jadi itu keadaan kosong yang jujur, bukan klik mati.
>
> **Pita pemberitahuan filter populasi DILEPAS dari app shell** (11 Agu 2026, permintaan user: "ilangin"). Komponennya utuh di `components/layout/pita-populasi.tsx` — nol pemakai, tinggal dipasang kembali satu baris di `app/(app)/layout.tsx`. **Jangan memasangnya kembali sebagai perbaikan bug**; itu keputusan user, dan komentar di titik pemasangannya menyatakan hal yang sama supaya tidak ditemukan ulang dari nol.
>
> **Akibatnya, terukur: sekarang TIDAK ADA penanda apa pun di UI bahwa tampilan dibatasi.** Angka `43` tidak muncul di dashboard sama sekali — diperiksa atas teks yang dirender, bukan ditebak. Alasannya `ambilKartuRingkas` menyaring **kedua** penghitungnya (`pegawai_aktif` dan `pegawai_total` sama-sama lewat `filterSumberTanpaAlias()`), jadi 10 = 10 dan kartu "Pegawai aktif" mengambil cabang kalimat `'Semua yang dihitung di sini berstatus aktif'`. Cabang `dari N pegawai terdata` tidak akan pernah tercapai selama filternya menyala.
>
> Jadi aplikasi ini sekarang menampilkan 10 pegawai **sebagai kalau itu seluruh DJBK**. Itu diterima sadar sebagai keputusan user untuk lingkungan dev, dan dicatat di sini karena satu-satunya yang tahu populasinya 43 adalah `.env.local`. **Sebelum layar ini diperlihatkan ke siapa pun di luar tim pengembang — apalagi pimpinan — matikan `HANYA_PEGAWAI_SUMBER`**, karena tidak ada lagi apa pun di layar yang akan mengoreksi kesimpulan yang salah.
>
> **Frontend disaring ke pegawai yang ADA DI API eNominasi saja** (10 dari 43) lewat `HANYA_PEGAWAI_SUMBER=true` di `.env.local`. **DB TIDAK diubah sama sekali** — ini murni filter kueri baca, dan terbukti reversibel: flag dimatikan → 43 kembali seketika, dinyalakan → 10 lagi. Definisinya **satu tempat**, [`lib/kueri/dasar.ts`](lib/kueri/dasar.ts), dengan **tiga varian yang merupakan satu definisi populasi** — yang berbeda hanya cara menyebut pegawainya: `filterSumber(alias)` (ada tabel `pegawai`), `filterSumberTanpaAlias()` (`FROM pegawai` tanpa alias), dan `filterSumberPegawaiId(kolom)` untuk kueri yang **hanya memegang kolom `pegawai_id`** (mis. `FROM hukuman_disiplin`, `FROM riwayat_jabatan`). Varian ketiga ada supaya menyaring tidak menuntut JOIN `pegawai` yang ditambahkan semata demi filternya — JOIN begitu mengubah rencana kueri dan bisa melipatgandakan baris kalau relasinya bukan 1:1. **Jangan menulis `EXISTS`-nya langsung di kueri**; begitu ia ada di dua tempat, "siapa yang ditampilkan" punya dua jawaban dan halaman mulai berselisih tanpa ada yang gagal (larangan yang sama dengan `CTE_ASESMEN_TERBARU`).
>
> **Cakupannya diperluas ke SELURUH halaman pada 11 Agu 2026** (permintaan user: "pastiin lagi semua page ambil datanya cuma dari 10 orang yang ada di enom"). Sebelumnya hanya `pegawai.ts` · `kualitas.ts` (kelengkapan) · `rubrik.ts` · `peta-talenta.ts` · `dashboard.ts` yang disaring, dan **sisanya bocor** — bukan karena lupa, tapi karena modul-modul itu tidak *terlihat* seperti daftar pegawai. Yang ditambahkan: `disiplin.ts` (daftar + ringkasan + opsi form) · `kategori-riwayat.ts` (penghitung antrian diklat, antrian jabatan, ringkasan validasi) · `perbandingan.ts` (`?nip=` di URL **dan** pencarian kandidat) · `kualitas.ts` **Antrian Pembersihan** (6 penghitung + 5 daftar rinci) · `laporan.ts` (**kedua** pembangun `where` — sebelumnya opsi dropdown-nya disaring tapi barisnya tidak, jadi Gap Analysis menawarkan 11 pilihan dari 10 pegawai sementara angkanya dihitung dari 43) · `suksesi.ts` (daftar nominasi, entri pool per id, kandidat luar pool, rencana pengembangan) · `master.ts` `ambilPejabatBerisiko` · `pegawai.ts` `ambilProfil`.
>
> **Diverifikasi dengan menyapu 27 rute dan mencari kemunculan salah satu dari 33 nama yang disembunyikan** (regex berbatas kata atas `main.innerText`), bukan dengan membaca kode. Hasil sebelum: **10 kemunculan di 3 halaman** — `/jabatan-target` (Budi Santoso · Ika Puspita · Iwan · Rus, dari panel Risiko Kekosongan), `/nominasi` (Agus Purnomo · Ahmad Fauzi · Iwan · Yuliana Wijaya), `/inbox` (Iwan · Yuliana Wijaya). Sesudah: **0**. Ditambah satu jalur yang tidak terlihat dari daftar mana pun: **`/talenta/{nip}` pegawai tersembunyi tetap terbuka lewat URL langsung** — halaman dengan data ASN paling lengkap di aplikasi ini. Sekarang dijawab **`null` = "tidak ada"**, bukan "akses ditolak", mengikuti pola pembatasan unit Fase 7 (pesan yang membedakan keduanya membuat URL bisa dipakai menebak keberadaan orang). Ada kontrol positif: profil pegawai yang **ditampilkan** harus tetap terbuka — tanpa itu, "nol kebocoran" bisa berarti halamannya rusak untuk semua orang.
>
> **Tiga titik yang menyaring TIGA halaman sekaligus, jangan dipecah:** `ambilDaftarNominasi()` menyuplai `/nominasi`, `/inbox` (`ambilTugas` menyaring hasilnya), dan `/nominasi/[id]` (`ambilNominasi` mencarinya di sana). Menyaringnya per halaman berarti tiga definisi yang harus sepakat — dan yang paling mungkin tertinggal justru inbox, karena ia tidak terbaca sebagai daftar pegawai.
>
> **⚠️ `OR` di klausa yang disaring WAJIB dikurung.** `A OR B AND filter` mengikat sebagai `A OR (B AND filter)`, jadi menempelkan filter di belakang klausa ber-`OR` menyaring **cabang kanan saja** dan lolos tanpa galat apa pun. Kena di **8 kueri**: `cariKandidat` (pencarian menurut nama akan lolos tanpa disaring sama sekali), keempat penghitung temuan ber-`OR`, dan tiga daftar rincinya. Semuanya sekarang berbentuk `WHERE (…OR…) ${filter}`. Ini kelas kesalahan yang tidak akan ditemukan uji mana pun kecuali kebetulan subjeknya cocok di cabang yang salah.
>
> **`master.ts` sebagian besar tetap TIDAK disaring, dan itu disengaja** — unit & jabatan ada terlepas dari siapa yang terases, jadi menyaringnya mengecilkan struktur organisasi alih-alih membatasi populasi. **Kecualinya `ambilPejabatBerisiko`**, yang barisnya adalah *orang* (pejabat mendekati BUP), bukan jabatan. Akibat langsung yang harus diketahui: **panel Risiko Kekosongan jadi kosong** selama filter menyala, karena keempat pejabat yang mendekati BUP di data dev (Budi Santoso · Ika Puspita · Iwan · Rus, tanggal lahirnya sengaja diatur `008`) semuanya di luar 10. Kalimat panelnya tetap jujur sendiri karena `totalDiperiksa` ikut disaring: **"0 dari 7 pejabat aktif"**, bukan "0 dari 43".
>
> **Empat kartu KPI & panel Jabatan Kosong semuanya MENAUT ke tujuan yang hidup** (11 Agu 2026, permintaan user). Sebelumnya kartu "Kandidat dalam talent pool" adalah satu-satunya dari empat yang tidak bisa diklik, dan footer panel Jabatan Kosong berupa **kalimat** — "Daftar lengkap … ada di halaman Jabatan Kosong & Risiko" — yang menyuruh pengguna pergi tanpa membawanya, sambil menyebut halaman yang **sudah tidak ada** sejak Fase 11 meleburkan `/master/jabatan-kosong` ke `/jabatan-target`. Sekarang: kartu → `/talenta` · `#jabatan-kosong` · `/talent-pool` · `/nominasi`, dan footer panel → `/jabatan-target#jabatan-kosong` (keadaan kosongnya → `#risiko-kekosongan`, sebab "semua terisi hari ini" bukan berarti tidak ada yang kosong tahun depan). Terverifikasi dengan mengeklik: mendarat di `/jabatan-target#jabatan-kosong` dengan `main.scrollTop` 719 dan panelnya di y=72.
>
> **Dashboard DIPANGKAS jadi tiga panel** (10 Agu 2026, permintaan user): 4 KPI · Sebaran Kotak 9 + drill-down pegawai · Jabatan Strategis Kosong. Lima widget lain (Peta Kinerja × Potensial, Kesehatan Data, Tren Kinerja, Antrian Nominasi, Aktivitas Terakhir) **dilepas dari halaman, TIDAK dihapus** — komponennya utuh di `app/(app)/_widget/`, tinggal dipasang kembali. `doc/PRD.md` §6.2 sudah diberi catatan penyimpangannya. Tiga hal yang wajib diikuti kalau daftarnya diubah lagi: **`loading.tsx`** menyusun skeleton dengan tata letak yang sama (kalau tidak, halaman melompat tepat saat data masuk), **kartu KPI menaut ke anchor di halaman ini** (widget yang dilepas = anchor lenyap = klik mati; kartu Nominasi karena itu kini menaut ke `/nominasi`), dan **`e2e/fase-1.smoke.mjs`** menguji kehadiran panel per nama plus memakai panel terbawah sebagai penanda selesai-streaming.
>
> **Kotak 9 sekarang berwarna per band kualitas**, bukan gradasi satu aksen. HUE = band (merah kiri-bawah → hijau tua kanan-atas, konvensi 9-box diporting dari v1), PEKATNYA = jumlah pegawai relatif sel terpadat. Token `--k9-1..5`, band & plafon tint di `lib/warna-seri.ts`. **Nilai v1 tidak dipakai apa adanya**: v1 memasang teks putih di atas semua sel termasuk kuning & hijau muda — terukur **1,74–2,28:1** di kotak 4/5/7/8, empat dari sembilan sel tak terbaca. Di sini band hanya untuk latar & garis, teks tetap `--text`, tint diplafon 45% (aman sampai 51%, diikat tema gelap). Dijaga `audit:kontras` (kini **218** pasangan) yang **membaca plafon tint dari `lib/warna-seri.ts`**, jadi menaikkannya tanpa mengubah warna akan merah.

> ## ⚠️ KEADAAN `pupr_dev_v2` SEKARANG TIDAK SESUAI BASELINE DI BAWAH
>
> **`asesmen_talenta` sedang berisi DATA MURNI DARI API eNominasi** — eksperimen yang diminta user (10 Agu 2026). Seluruh 46 baris asesmen hasil seed **dihapus**, diganti 10 baris dari eNom. Jadi angka-angka di baseline di bawah **memang tidak akan cocok**, dan itu bukan regresi.
>
> | | seed (baseline) | sekarang (API saja) |
> |---|---|---|
> | pegawai | 40 | **43** (+3 orang yang ada di eNom) |
> | baris `asesmen_talenta` | 46 | **10** |
> | pegawai punya asesmen | 40 | **10** (33 belum diases) |
> | kandidat lolos syarat per target | 17 · 8 · 10 | **5 · 2 · 2** |
> | rata skor total | 73,31 · 73,31 · 72,43 | **39,37 · 39,37 · 38,38** |
> | Kotak 9 terisi | 9 sel | **2 sel** (Kotak 7 = 3 · Kotak 9 = 7) |
> | Kesehatan Data "Hasil Asesmen" | 100% | **23,3%** |
>
> **Yang eksperimen ini buktikan** (dan inilah nilainya): masalah skala potkom **nyata dan besar**. Lima dari sepuluh baris berakhir dengan `nilai_potensial_x` = **100,00 tepat** karena potkom eNom >100 di-clamp — separuh populasi kehilangan seluruh daya bedanya di sumbu X, dan semuanya menumpuk di kolom "Tinggi". Sebaran Kotak 9 yang cuma mengisi 2 sel adalah akibat langsungnya. **Jangan sinkronkan produksi sebelum skala potkom dijawab pengelola eNom.**
>
> **PULIHKAN dengan satu perintah:**
>
> ```
> npm run db:sql doc/sql/cadangan-sebelum-enom.sql
> ```
>
> Cadangan itu dump lengkap 6 tabel (`pegawai`, `asesmen_talenta`, `match_score`, `match_score_detail`, `sync_log`, `talent_pool`) — 1319 INSERT, dibuat tepat sebelum eksperimen, `FOREIGN_KEY_CHECKS=0` di kepalanya. Strukturnya sudah diperiksa (jumlah statement cocok per tabel, kolom JSON `riwayat_diklat` ter-escape benar) **tapi pemulihannya belum pernah dieksekusi** — memulihkan berarti membatalkan eksperimen ini, dan menerapkannya kembali menghabiskan ~43 panggilan eNom lagi.
>
> **`verifikasi:data` sekarang 44/48.** Keempat kegagalannya sudah ditelusuri dan semuanya AKIBAT eksperimen, bukan cacat kode — jangan didiagnosis ulang dari nol:
>
> | Gagal | Sebabnya |
> |---|---|
> | *Kesembilan sel Kotak 9 terisi* (7 sel kosong) | hanya 10 pegawai punya asesmen, semuanya Kotak 7 & 9 |
> | *Kasus bernama: Yuliana Wijaya 90,88 … eligible = 0* | Yuliana tidak ada di eNom → asesmennya hilang → kasus ujinya tidak punya bahan |
> | *Gerbang terpisah dari skor* | pola "tak lolos tapi skor tinggi" tinggal 1 dari 3 karena populasi berskor menyusut |
> | *Setiap pegawai punya TW1–TW3 + TAHUNAN 2025* (3 kurang) | tiga pegawai yang saya tambahkan dari eNom belum punya baris `penilaian_kinerja` — eNom tidak mengirimnya |
>
> Setelah memulihkan, `verifikasi:data` harus kembali **48/48** dan `verifikasi:skoring` **120/120**.

### Baseline verifikasi — kalau angka ini turun, ada yang regresi

```
npm run verifikasi           → 477 uji unit lolos (18 berkas uji) — +11 dari lib/enom
                               Node di mesin ini 20.18.1, vitest 4 butuh >=20.19 untuk require(ESM):
                               pakai NODE_OPTIONS=--experimental-require-module sampai Node dinaikkan
npm run verifikasi:data      → 48/48 pemeriksaan (SQL murni, silang-uji isi DB)
                               dua terbaru menjaga gerbang tetap terpisah dari skor (Fase 11)
npm run verifikasi:skoring   → 128 baris diperiksa · 0 menyimpang (11 Agu 2026)
                               + 1 baris MANUAL & 1 jabatan target DRAFT DILEWATI dengan sengaja —
                               lihat §"Indikator di profil bisa diisi manual". Kalau angka
                               "dilewati" naik tanpa ada yang memakai Isi manual, itu yang dicek
                               + 441/441 pasangan (Y,X): ekspresi SQL Kotak 9 setara hitungKotak9()
npm run smoke                → SELURUH 12 fase dijalankan 11 Agu 2026 (satu per satu, BUKAN npm run smoke —
                               skrip gabungan memakai && sehingga satu gagal menghentikan sisanya).
                               Hasil dengan HANYA_PEGAWAI_SUMBER=true, SETELAH filter populasi
                               diperluas ke seluruh halaman:
                               18/18 (F0) · 21/21 (F1) · 23/23 (F2) · 34/34 (F3) · 44/46 (F4) · 43/44 (F5)
                               28/39 (F6 — filter populasi, lihat catatan) · 46/46 (F7) · 30/30 (F8)
                               39/39 (F9) · 23/23 (F10) · 25/27 (F11 — data API-only)
                               Dengan filter DIMATIKAN: F6 kembali 39/39.
                               F4 turun 45→44: langkah "U-6 pejabat berisiko punya isi" tidak bisa lulus
                               selama filter menyala — keempat pejabat mendekati BUP di luar 10.
                               Asersinya SENGAJA tidak dilemahkan: melonggarkannya berarti panel itu
                               boleh rusak diam-diam nanti tanpa satu pun uji yang merah.
npm run smoke (baseline lama)  → 18/18 (F0) · 21/21 (F1) · 23/23 (F2) · 33/34 (F3 — catatan) · 45/46 (F4 — catatan)
                               · 44/44 (F5) · 39/39 (F6) · 46/46 (F7) · 30/30 (F8) · 39/39 (F9)
                               · 23/23 (F10) · 27/27 (F11) = 390 pemeriksaan
npm run build                → 42 entri route (Fase 11), build sukses, typecheck 16,9 s
                               36 halaman statis dihasilkan · `/master/jabatan-kosong` TIDAK ada
                               (dihapus Fase 11, dialihkan 308 lewat next.config)
npm run build:pratinjau      → build ke distDir TERPISAH (.next-pratinjau) — aman dijalankan
                               sambil dev server hidup. `npm run mulai:pratinjau` → port 5000
                               TERAKHIR DIBANGUN 11 Agu 2026 15:21 & diverifikasi di port 5000:
                               4 kartu KPI bisa diklik · tautan "Lihat selengkapnya" ·
                               pita populasi hilang · 10 pegawai bernama lengkap dari eNom ·
                               7 tombol editor profil · 9 tombol "Isi manual" ·
                               pemilih kategori Keragaman = 100/80/60 · tanpa error halaman
npm run nama:enom            → selaraskan pegawai.nama_lengkap dengan nama dari API eNominasi.
                               DRY-RUN bawaan; `-- --tulis` untuk menulis. Cadangan nama lama
                               ditulis ke doc/sql/cadangan-nama-sebelum-enom.sql SEBELUM mengubah.
                               Hasil 11 Agu 2026: 7 dari 10 nama benih ternyata cuma KATA PERTAMA
                               nama resminya ("Tasya" → "Annisa Tasya Azhari, S.Kom., M.M.")
npm run ukur:kueri           → 77 kueri = ~327 ms · :volume di 2.000 pegawai = ~900 ms (BELUM diukur ulang
                               sejak Fase 11 menambah 3 kueri Kotak 9 per jabatan target)
                               ambang 150 ms/kueri; agregat laporan 500 ms (alasannya di skripnya)
                               terberat di volume: gapIndikator 254 ms · antrianDiklat 153 ms · ringkasGap 132 ms
npm run ukur:hitung-ulang    → ~195 ms · :volume 1.960 pegawai (17.640 baris rincian) = ~4,4 s
```

**Cara menjalankan smoke:** butuh dev server hidup. `npm run smoke` memakai `localhost:3000` (punya user) untuk **kesepuluh** berkasnya. Untuk server sendiri: `npx next dev -p 3100` lalu `node e2e/fase-N.smoke.mjs .next/smoke http://localhost:3100`.

`fase-0` sempat sendirian default ke port **3210** — sisa server sekali-pakai saat fase itu dikerjakan. Karena skrip gabungan tidak meneruskan base-url ke satu pun berkasnya, `npm run smoke` **selalu berhenti di langkah pertama** dengan `ERR_CONNECTION_REFUSED`, dan sembilan berkas sesudahnya tidak pernah jalan lewat jalur itu. Kalau menambah berkas smoke baru, defaultnya 3000.

**Sejak Fase 7 smoke benar-benar MASUK lewat halaman login** ([`e2e/_masuk.mjs`](e2e/_masuk.mjs)) — tidak ada lagi cookie `simt_dev_user`. Hasil login di-cache sebagai `storageState` per pengguna, jadi satu login per akun per proses meskipun satu berkas smoke membuat belasan konteks. Akun seed: `superadmin` · `martyanti.rbs` · `reza.kurniawan` · `dirjen` · `reviewer.bpsdm`, sandi dev `password123`.

**Ekspektasi uji yang MEMATOK data akan patah begitu populasinya berubah — dan gejalanya menuduh aplikasinya.** Tiga langkah merah saat filter populasi diperluas, ketiganya cacat di ujinya, bukan di kode:

| Langkah | Gejalanya | Sebab sebenarnya |
|---|---|---|
| F3 *pencarian: menambahkan kandidat lewat hasil pencarian* | `waitForSelector` timeout 15 s — terbaca seperti pencariannya rusak | mengetik `'bu'`, cocok selama "Budi Santoso"/"Bambang Wijaya" ada di populasi. Sekarang kata kuncinya **diambil dari baris pertama direktori** |
| F8 *penyaring ikut ke berkas* | "?target=3 memberi 0 baris, DB bilang 1" — menuduh penyaring ekspor diabaikan | pembandingnya ditanyakan ke DB **tanpa** batas populasi, sementara ekspornya tersaring. Pembanding yang datang dari sumber berbeda dengan yang diuji akan jadi kegagalan palsu suatu hari |
| F6 *Kotak 9 & predikat kinerja SEBELUM match score* | `waitForFunction` timeout 20 s — terbaca seperti tabelnya tidak pernah muncul | penjaganya menunggu `th.length >= 8`; kolom peringkat `#` dilepas jadi 7. Sekarang penjaganya **menyebut kolom yang diperiksa**, bukan jumlahnya |

Pola ketiganya sama: **penjaga atau pembanding yang memakai angka/nama tetap alih-alih menurunkannya dari data yang sedang diuji.** Kalau menulis asersi baru, tanyakan "apa yang membuat ini merah kalau populasinya berubah tapi kodenya benar?"

**Satu lagi yang wajib diperiksa SEBELUM mendiagnosis smoke yang merah: RAM.** F11 memberi **dua set kegagalan yang berbeda di dua jalannya** (`?target= tak dikenal` + `Panel syarat pelatihan`, lalu `Reset filter` + `Tab Persyaratan`) saat dev server sudah 4,3 GB RSS dengan 247 MB RAM bebas — `/masuk` sendiri butuh **47 detik**. Keempatnya lulus saat direproduksi manual di server yang baru dinyalakan, dan F11 mendarat di **25/27** dengan hanya dua kegagalan stabil (sebaran Kotak 9 vs baseline seed). **Kegagalan yang berpindah-pindah antar jalan bukan bug kode** — lihat §"Kehabisan memori terlihat seperti kode rusak".

**Empat jebakan berulang saat menulis smoke** — semuanya menghasilkan langkah HIJAU yang salah, bukan galat:
1. **Menunggu sebuah kata yang sudah ada di layar.** Kalimat akibat di dialog memuat kata status yang ditunggu ("Diverifikasi"), label penyaring memuat nama status, header tabel memuat kata "Sebelum". Penantiannya lolos seketika, `ctx.close()` menyusul, dan **konteks yang ditutup membatalkan POST server action yang masih terbang** — mutasinya batal tanpa jejak. Tunggu **keadaan**: dialog tertutup, tombol lenyap, aksi baru muncul.
2. **`innerText` menerapkan `text-transform`.** Label ber-`uppercase` terbaca "ANGGOTA POOL", bukan "Anggota pool". Dan `[role="dialog"]` **tidak pernah** cocok dengan `<dialog>` native — elemen itu punya *implicit* role tanpa atributnya; pakai `dialog[open]`.
3. **`hasText` mencocokkan sebagian, dan dialog konfirmasi hidup di baris yang sama.** `locator('tr', {hasText: label}).locator('button', {hasText: 'Cabut'})` cocok dengan **dua** elemen: tombol baris, dan tombol "Cabut token" milik `DialogKonfirmasi` yang dirender sebagai saudaranya. Pakai regex berjangkar: `{hasText: /^Cabut$/}`.
4. **Asersi "tidak ada" lolos ketika lokatornya yang salah.** `locator('section, div').filter({hasText: kode}).last()` cocok dengan puluhan div bersarang, dan `.last()` mengembalikan yang **terdalam** — yang memang tidak memuat tombol apa pun. Jadi `expect(count === 0)` untuk "klien PENDING belum bisa menerbitkan token" LULUS karena tombolnya tidak *ditemukan*, bukan karena tidak *ada*. Terjadi di smoke Fase 9 dan hanya ketahuan karena langkah **sesudahnya** gagal mengeklik. Obatnya dua-duanya sekaligus: **tegaskan lokatornya cocok tepat satu elemen** (`Panel` merender `<section>`, jadi `main section`), dan sertakan **kontrol positif** — sesuatu yang memang ada di wadah itu (tombol "Ubah") harus ditemukan, supaya hitungan nol benar-benar berarti nol.

### API eNominasi terbukti hidup — dan itu menjawab keputusan nomor 5 dengan data

`POST https://karir.pu.go.id/enom/api/cekdata_bikon` (Bearer-nya berupa header `X-Secret`) **ada, hidup, dan mengembalikan seluruh masukan Formula A sekaligus.** Diuji dengan `npm run uji:enom` — read-only, tidak menulis satu baris pun. Balasan nyata untuk satu NIP:

```json
{"status":true,"message":"Data Success","data":{"detail":[{
  "nip":"...", "nama_pegawai":"...", "jenjang":"PENGAWAS", "tahun_asesmen":"2026",
  "nilai_integritas":"3.25", "nilai_potkom":"130.729166925",
  "tahun_kinerja":"2025", "predikat_kinerja":"SANGAT BAIK", "kotak":"9" }]}}
```

**Enam sifat sumber yang HARUS diketahui sebelum menulis jalur sinkronisasi.** Semuanya hasil pengujian, bukan dokumen — endpoint ini tidak berdokumen:

1. **Semua angka datang sebagai STRING**, termasuk tahun dan kotak. Skema Zod-nya memakai `z.coerce`.
2. **`nilai_potkom` RUTIN di atas 100 — bukan pencilan.** Terukur pada 10 rekaman: rentang **61,74–130,73**, dan **5 dari 10 melebihi 100** (101,25 · 102,50 · 103,89 · 115,10 · 130,73). Setengah sampel. Itu mematikan penjelasan "cuma derau pembulatan" — 115 dan 130 jauh dari 100. Jadi skala potkom eNom **bukan** 0–100 yang dipakai `nilai_potensial_x`.

   Aturan clamp yang ada memotongnya ke 100 dan mencatat `SKOR_DI_LUAR_RENTANG`, **tapi itu belum menjawab pertanyaannya, dan dampaknya besar**: memotong berarti separuh populasi menumpuk di X=100 tepat, kehilangan seluruh daya bedanya di sumbu X, lalu semuanya jatuh ke kolom Kotak 9 yang sama. Kalau skalanya memang mis. 0–150, yang benar **menormalisasi**, bukan memotong. **Wajib dikonfirmasi pengelola eNom sebelum sinkronisasi sungguhan** — ini pertanyaan bisnis, bukan teknis.
3. **`nilai_integritas` berskala 1–4** (terukur 3,25). Sudah ditangani `normalisasiNilaiIntegritas` → 75.
4. **Predikat datang HURUF BESAR** ("SANGAT BAIK"). `skorPredikat()` sudah case-insensitive.
5. **Balasannya HANYA memuat NIP yang ketemu**, tanpa penanda apa pun untuk yang tidak ketemu — jadi "siapa yang belum ada di eNom" wajib disimpulkan dengan membandingkan daftar diminta vs dijawab.
7. **PARAMETER `nip` BERBENTUK ARRAY TAPI HANYA ELEMEN PERTAMA YANG DIPROSES.** Ini jebakan paling berbahaya di seluruh integrasi ini, dan terbukti terukur:

   | Kiriman | Hasil |
   |---|---|
   | `[ADA]` | 1 rekaman |
   | `[ADA, tidak-ada]` | 1 rekaman (yang kedua diabaikan) |
   | `[tidak-ada, ADA]` | **0 rekaman** + "data nip tidak ditemukam" ← yang ADA hilang |
   | `[tidak-ada, ×2, ADA]` | **0 rekaman** |

   Mengirim 50 NIP **berhasil** — HTTP 200, `status:true` — sambil diam-diam menjawab satu. Sinkronisasi 1.872 pegawai dengan batch 50 akan melaporkan sukses untuk 38 permintaan sementara **1.834 orang tidak pernah ditanyakan**, tanpa satu pun galat. Karena itu `ENOM_BATCH` bawaannya **1**. Kalau suatu hari sumbernya benar-benar mendukung batch, **buktikan dengan menaruh NIP yang diketahui ADA di posisi TERAKHIR**, bukan pertama — menaruhnya di depan akan lulus dan menyembunyikan bug ini.

   Konsekuensi beban: 1.872 pegawai = 1.872 permintaan ≈ **8 menit** berurutan, dan **setiap permintaan tercatat di eNom**. Sinkronisasi penuh perlu disepakati dengan pengelolanya. Mempercepat dengan menaikkan batch tidak berpengaruh; yang bisa dinaikkan hanya paralelisme, dan itu keputusan beban di sisi mereka.
6. **`{"status":false,"message":"...tidak ditemukam"}` (typo milik sumber) BUKAN kegagalan, itu hasil KOSONG.** Diuji: `[nip_ada, nip_tidak_ada]` tetap menjawab `status:true` berisi yang ada; pesan itu hanya muncul ketika tidak satu pun ketemu. Memperlakukannya sebagai galat berarti sinkronisasi berhenti hanya karena satu batch berisi orang yang semuanya belum diasesmen — kejadian wajar. Versi pertama klien ini salah di titik ini.

**Cakupan terukur: 10 dari 49 NIP asli yang ada di repositori ini ditemukan di eNom** (ditanyakan satu per satu — lihat sifat nomor 7). Sebaran: tahun asesmen 2021–2026 · jenjang ADMINISTRATOR 4 · AHLI MUDA 3 · PENGAWAS/AHLI MADYA/AHLI PERTAMA 1 masing-masing.

**Angka "0 dari 44" yang sempat tertulis di sini SALAH** — itu hasil satu panggilan berisi 44 NIP, yang karena sifat nomor 7 hanya benar-benar memeriksa NIP pertama. Jangan mengulangi kesalahan itu: kesimpulan apa pun tentang cakupan eNom harus datang dari panggilan **per NIP**.

**Tiga dari 10 cocok PERSIS dengan isi `asesmen_talenta` dev** (Y/X/Kotak 9 identik), termasuk **dua kasus "Tasya & Tina"** yang `doc/sql/009_kolom_pembanding.sql` backfill: eNom benar-benar mengirim `kotak:4` untuk baris yang hitungannya 7 (Y=100 · X=61,74 dan Y=100 · X=69,58). Jadi backfill itu **terkonfirmasi dari sumber hidup**, bukan tafsiran. Dua baris lain berbeda karena potkom eNom sekarang >100 sementara DB menyimpan 98,00 & 99,50.

**Mengisi dev dari eNom belum bisa untuk populasi penuh** — 39 dari 49 NIP tidak ada di sana, dan sebagian besar `pegawai` dev memang NIP hasil generator. Mintakan daftar NIP ke pengelola eNom; **jangan menyisir endpoint lain yang tidak berdokumen** di `karir.pu.go.id` — itu sistem produksi instansi lain dan menebak endpoint di sana terbaca sebagai pemindaian.

**Jalur tulisnya sudah siap dan TERVERIFIKASI**: `npm run sinkron:enom` (dry-run bawaan; `--tulis` untuk benar-benar menulis). Cabang tulisnya diuji dengan menambahkan satu pegawai ber-NIP nyata ke `pupr_dev_v2`, menjalankan `--tulis`, memeriksa hasilnya, lalu **menghapus seluruh jejaknya** — `verifikasi:data` kembali **48/48** dan hitungan tabel kembali persis (pegawai 40 · asesmen 46 · sync_log 9). Yang terbukti: nilai benar (potkom 130,73 → 100 ter-clamp, integritas 3,25 → 75, `kotak_9` hasil hitung, `kotak_9_sumber` dari sumber, `rating_kinerja` jadi Title Case, `sumber_sync='eNominasi'`), `sync_log` terisi, dan **idempoten** — jalan kedua melaporkan `SAMA` dan menulis 0 baris. Idempotensi itu tidak gratis: `asesmen_talenta` **tidak punya UNIQUE (pegawai_id, tahun_asesmen)**, hanya indeks biasa, jadi `ON DUPLICATE KEY UPDATE` tidak akan pernah menemukan duplikat dan akan menumpuk baris ganda tiap kali dijalankan — skripnya membaca dulu, lalu memutuskan INSERT/UPDATE.

**`DATABASE_NAME` di `.env.local` adalah `pupr_dev_v2`, bukan `pupr_dev`** seperti yang tertulis di bagian Database Dev di bawah. Perlu diselaraskan supaya perintah yang disalin dari dokumen ini tidak menyasar DB yang salah.

**Batas batch belum diketahui.** `ENOM_BATCH` bawaan 50, konservatif — endpoint tidak berdokumen dan belum diuji sampai gagal. Menaikkannya berarti pengujian, dan **setiap panggilan tercatat di sisi eNom** (balasannya memuat `infoip` & `waktu_ambil`). Uji bervolume perlu sepengetahuan pengelolanya.

**Kredensial WAJIB dari env** (`ENOM_SECRET`, lihat `.env.example`). Berkas contoh yang beredar (`enom_api_bikon.php`) menuliskan `X-Secret` langsung di kode dan menyertakan header `Cookie: ci_session=...` — **cookie itu tidak berpengaruh sama sekali** (diuji: balasan identik byte-per-byte tanpa cookie), sisa dari Postman. Jangan diikuti dua-duanya.

### Profil pegawai bisa diisi & diubah manual (11 Agu 2026, permintaan user)

Sebelumnya satu-satunya cara mengisi kolom profil yang kosong adalah SQL, sehingga Antrian Pembersihan Data mendaftar 27 temuan yang **tidak punya satu pun tombol untuk dibereskan**.

- **Jalur tulisnya satu berkas:** [`lib/aksi/profil.ts`](lib/aksi/profil.ts) — enam permukaan: `pegawai` (identitas & pendidikan terakhir) · `riwayat_pendidikan` · `riwayat_jabatan` · `pegawai.riwayat_diklat` (JSON) · `kinerja_periode` · `asesmen_talenta`. **Tambah & ubah saja, tanpa hapus** (baris riwayat adalah dasar skor yang sudah tersimpan). Hukuman disiplin **tidak** ikut — sudah punya CRUD sendiri dengan aturan lebih ketat.
- **Peran:** Super Admin · Admin Talenta · Pengelola Unit (dibatasi unitnya, diperiksa **di dalam SQL** lewat `pegawaiTerjangkau()`). Pegawai di luar lingkup dijawab "tidak ditemukan", bukan "akses ditolak".
- **Asesmen manual melewati `normalisasiAsesmen()`** — Kotak 9, `nilai_potensial_x`, dan `nilai_talenta` DIHITUNG, tidak diketik, dan formulirnya tidak menyediakan kolomnya. Menyediakannya berarti membuka pintu untuk menyimpan Kotak 9 yang tidak cocok dengan Y & X di baris yang sama — tepat jenis ketidakcocokan yang Antrian Pembersihan ada untuk melaporkan.
- **NIP tidak bisa diubah dari sini, dan itu disengaja:** ia UNIQUE, jadi alamat halaman (`/talenta/{nip}`), dan **satu-satunya sumber** tanggal lahir, usia, jenis kelamin, TMT CPNS, masa kerja, BUP, dan tanggal pensiun. Satu digit salah menggeser proyeksi pensiun tanpa galat apa pun.
- **Satu dialog deklaratif** ([`editor-bagian.tsx`](app/(app)/talenta/[nip]/_komponen/editor-bagian.tsx)) dipakai keenamnya; yang berbeda hanya daftar bidang & aksinya ([`tombol-editor.tsx`](app/(app)/talenta/[nip]/_komponen/tombol-editor.tsx)). Enam salinan form berarti enam tempat yang bisa lupa `role="alert"` — alasan yang sama dengan diangkatnya `Bidang` ke `components/ui` di Fase 7.

**TIGA cacat kehilangan data ditemukan & ditutup saat membangunnya. Semuanya sekelas, dan tidak satu pun memunculkan galat** — pola yang wajib diingat kalau menambah bidang baru ke formulir mana pun:

| Cacat | Akibatnya |
|---|---|
| `ProfilPegawai` tidak memuat `jabatanId` | pemilih Jabatan terbuka "tidak diisi"; menyimpan tanpa menyentuhnya **mengosongkan `jabatan_id`** pegawai itu |
| Kueri baca tidak mengembalikan `jenis_penugasan`, `unit_kerja_mentah`, `tahun_kinerja` | ketiganya terhapus begitu barisnya disunting untuk alasan lain |
| Indeks diklat diambil dari larik yang sudah DIFILTER | dengan pencarian aktif, mengubah satu entri **mengganti nama entri yang lain**; tampak benar sampai halaman dimuat ulang. `indexOf` bukan obatnya — nama diklat boleh sama |

**Aturannya: setiap bidang di formulir WAJIB punya nilai awal dari kueri bacanya.** Bidang yang ada di dialog tapi tidak ada di kueri akan selalu tersimpan sebagai `null`. Dan **kunci antarmuka ≠ kunci formulir** di beberapa tempat (`jenjang` vs `jenjangPendidikan`, `predikatKinerja` vs `ratingKinerja`) — pemetaannya ditulis eksplisit di `page.tsx`, jangan meneruskan barisnya apa adanya.

Diuji end-to-end lewat UI, bukan lewat pemanggilan fungsi: tambah riwayat pendidikan → baris masuk DB dengan `urutan` terhitung + `audit_log` `BUAT/riwayat_pendidikan`; ganti nama diklat **dengan pencarian aktif** → jatuh di indeks 2 yang benar, 30 entri tetap 30. Keduanya dibersihkan setelahnya. **Yang belum: uji unit untuk skema Zod-nya dan langkah smoke.**

### Indikator di profil bisa diisi manual dengan MEMILIH kategori rubrik (11 Agu 2026, permintaan user)

Menjawab "banyaknya data yang kosong": indikator yang datanya belum ada di sistem sumber bisa dinilai manusia dengan **memilih kategori dari `doc/KERANGKA TALENT POOL.md`** — mis. Keragaman Riwayat Jabatan → *lintas Unit Organisasi* 100 · *lintas Unit Kerja/antar direktorat* 80 · *satu Unit Kerja* 60.

- **Jalur tulisnya SUDAH ADA sejak Fase 5** (`simpanNilaiManual()` di [`lib/aksi/skoring.ts`](lib/aksi/skoring.ts), `match_score_detail.sumber_nilai='MANUAL'`, dan `lib/skoring-tulis.ts` yang **mempertahankan** jejak manual saat Hitung Ulang). Yang ditambahkan hanya permukaannya di profil — **jangan membuat aksi kedua**.
- **Pilihannya diambil dari `rubrik_kategori_skor` di DB, bukan dari daftar yang ditulis ulang dari dokumen.** Alasannya mengikat: `simpanNilaiManual()` menolak nilai yang tidak **sama persis** dengan salah satu nama kategori indikatornya (setelah normalisasi spasi & huruf). Daftar hardcoded akan menawarkan kalimat yang tidak lagi ada begitu rubrik disunting lewat editor rubrik, dan penolakannya terbaca sebagai fitur rusak. Itu juga sebabnya bentuk masukannya **pemilih**, bukan teks bebas: mengetik ulang kalimat 70 karakter tanpa salah satu huruf pun bukan permukaan yang bisa dipakai.
- **Dua bentuk masukan, ditentukan rubriknya sendiri:** kategori bernama → pemilih (nilainya ditampilkan di sebelah namanya, seperti tabel di dokumen); kategori ber-`ambang_min` (Potkom) atau indikator `NILAI_LANGSUNG` → isian angka. Keduanya dikirim sebagai **string** — `SkemaNilaiManual` menerima teks, dan penerjemahan teks → skor sengaja hanya terjadi di rubrik saat Hitung Ulang.
- **Skor TIDAK berubah seketika, dan UI menyatakannya.** Nilai mentah + `catatan` (wajib, min. 5 karakter) + `diisi_oleh` disimpan; skornya lahir saat Hitung Ulang. Terukur end-to-end: pilih kategori bernilai 80 → simpan → Hitung Ulang → `skor` **80,00**, `sumber_nilai` tetap **MANUAL**, `perlu_review` **1 → 0** (temuannya selesai), induk "Nilai Pengalaman Jabatan" ikut teragregasi 26,67, `skor_total` 89,00 → **90,33**. Dipulihkan setelahnya.
- Tombolnya hanya muncul untuk **Super Admin & Admin Talenta** (`PERAN_HITUNG`), diputuskan di server lewat prop — aksinya tetap penegak terakhirnya.

**Skornya keluar SEKETIKA** (11 Agu 2026, permintaan user): `simpanNilaiManual()` merantai `hitungUlangSkor()` sendiri. Sebelumnya ia berhenti setelah menyimpan nilai mentah dan menyuruh pengguna menjalankan Hitung Ulang — di layar nilai mentahnya muncul sementara `kategori_terpilih` kosong dan **skornya tetap 0,00**, yang terbaca seperti simpan gagal separuh. Yang dihitung ulang adalah **seluruh jabatan target, bukan satu pegawai**, dan itu bukan kemalasan: peringkat talent pool ditentukan dengan membandingkan skor SEMUA kandidat, jadi memperbarui satu baris meninggalkan `talent_pool.ranking` basi tanpa satu pun galat — peringkat salah yang terlihat wajar lebih berbahaya daripada skor yang belum diperbarui. Kalau perhitungannya gagal, nilai mentahnya tetap tersimpan dan pesannya mengatakan apa adanya.

**Baris indikator INDUK hanya menampilkan bobotnya** (11 Agu 2026, permintaan user). "Nilai Pengalaman Jabatan" adalah agregator murni — nilainya rata-rata Lama · Keragaman · Substansi — jadi di `rincian-skor.tsx` ia **tanpa nilai mentah, tanpa kategori terpilih, tanpa tombol Isi manual**; yang tampil cuma `5%` plus keterangan "(rata-rata sub-indikator)". Selnya dibiarkan **kosong, bukan `—`**: tanda hubung berarti "ada tempatnya tapi datanya belum ada", padahal di sini tempatnya memang tidak ada. Menyediakan tombol Isi manual di baris induk berarti mengizinkan seseorang menimpa hasil agregasi tanpa menyentuh satu pun sub-indikatornya — angka induk lalu tidak sama dengan rata-rata anaknya dan tidak ada halaman yang bisa menjelaskan selisihnya. Induk dikenali dari **namanya muncul sebagai `indukNama` baris lain**, bukan dari daftar nama yang ditulis tetap.

**⚠️ `<select>` WAJIB punya opsi bernilai `''`, walau bidangnya wajib diisi.** Tanpa itu `<select value="">` tidak menemukan `<option>` yang cocok dan browser menampilkan **opsi pertama** sementara state React-nya masih kosong. Di rubrik, opsi pertama selalu yang **bernilai paling tinggi** — untuk Pengembangan Kompetensi berarti layar memperlihatkan kategori bernilai **100** seolah sudah terpilih, lalu Simpan ditolak "Nilai tidak boleh kosong" dan pengguna tidak punya cara menebak apa yang salah. Dilaporkan user pada 11 Agu 2026. Obatnya `<option value="" disabled>— pilih —</option>`, **bukan** menjadikan opsi pertama sebagai default: default begitu berarti nilai maksimum bisa tersimpan tanpa seseorang pernah memutuskan apa pun, cukup menekan Simpan.

**Nilai manual TIDAK menyebar antar jabatan target, dan sebagian besar memang tidak boleh.** Tiap jabatan target punya `rubrik_indikator` sendiri (Keragaman Riwayat Jabatan = id 9 · 18 · 27 untuk target 1 · 2 · 3), jadi mengisi satu target tidak menyentuh dua lainnya. Kalau suatu saat propagasi diminta, ia **tidak boleh diterapkan menyeluruh**: kategori beberapa indikator berbunyi *"…dalam bidang yang sesuai dengan **jabatan target**"* (Kesesuaian Bidang Ilmu, Pengembangan Kompetensi, Substansi Riwayat Jabatan), sehingga jawabannya memang berbeda per target — menyalinnya berarti menegaskan sesuatu yang bisa salah. Yang benar-benar target-independen hanya Tingkat Pendidikan Formal, Lama Jabatan, Keragaman Riwayat Jabatan, dan Integritas.

**⚠️ `verifikasi:skoring` MEMBUTUHKAN pengecualian untuk ini, dan sudah dipasang.** Skrip itu menjalankan `lib/skor-massal` lalu membandingkannya dengan isi `match_score`; `skor-massal` tidak tahu apa-apa soal jejak manual, jadi **setiap pemakaian fitur ini akan membuatnya merah selamanya** — merah yang tidak menunjukkan cacat apa pun dan melatih orang mengabaikannya. Sekarang skrip melewati pasangan (pegawai, target) yang punya indikator MANUAL, **dan melaporkan berapa yang dilewati** — "0 menyimpang" yang sebenarnya berarti "semuanya dilewati" adalah hijau yang menipu. Sekelas dengan itu: **jabatan target `DRAFT` yang belum pernah di-Hitung Ulang** juga dilewati (target 176 di dev menghasilkan 43 "tidak ada baris match_score", cukup untuk menenggelamkan penyimpangan sungguhan). Hasil sekarang: **128 baris diperiksa · 0 menyimpang · 1 MANUAL & 1 DRAFT dilewati**.

### ⚠️ DUA cacat `Dialog` yang menyentuh SELURUH aplikasi (12 Agu 2026)

Dilaporkan user sebagai "form jabatan target gak keliatan". Keduanya bukan khas halaman itu — **setiap dialog di aplikasi ini kena**, dan keduanya terukur, bukan dugaan.

1. **Dialog mewarisi token bermerek dan jadi hampir tembus pandang.** Custom property CSS diwarisi menurut pohon **DOM**, dan itu tetap berlaku untuk elemen di **top layer**. `.pita-kepala-aksi` sengaja mendefinisikan ulang `--surface: rgb(255 255 255 / 0.12)` supaya tombol di pita kepala navy terbaca. Dialog yang dipicu tombol di pita itu lahir sebagai anaknya → `background-color` terukur **`rgba(255,255,255,0.12)`**, isi halaman menembus dari belakang. **Obatnya `createPortal` ke `document.body`**, bukan menimpa warnanya di komponen — menimpa berarti menyalin nilai token ke tempat kedua, tepat yang dilarang, dan `audit:kontras` membaca token dari `globals.css` sehingga salinan itu tidak terjaga. Portal memperbaiki setiap dialog sekaligus, termasuk yang belum ditulis.
   - Portal ditahan sampai hidrasi lewat **`useHydrated()`**, bukan `useState` + `useEffect`: lint repo ini menolak `setState` di dalam effect ("cascading renders").
2. **Semua dialog menempel di POJOK KIRI-ATAS.** Stylesheet UA menengahkan `dialog:modal` lewat `inset: 0` + `margin: auto`, tapi **preflight Tailwind menyetel `margin: 0` ke semua elemen** — jadi centeringnya mati. Terukur `0,0` pada viewport 1600×1000; sesudah `m-auto` → `464,235` (tepat di tengah). Ditambah `max-h-[calc(100dvh-4rem)] overflow-y-auto` supaya dialog panjang tidak melewati layar.

**Kalau ada laporan "dialog aneh" lagi, ukur dulu dua hal ini** — `getComputedStyle(dialog).backgroundColor` dan `getBoundingClientRect()`. Keduanya menjawab lebih cepat daripada membaca kode.

### Nominasi: satu penyaring, lima tahap yang saling meniadakan (12 Agu 2026)

Permintaan user: satu dropdown alih-alih lima chip, dan baris yang menunggu Pimpinan jangan lagi berbunyi "Lolos verifikasi".

- **Akar masalahnya taksonomi ganda.** Penyaring berbicara **giliran** ("Menunggu Admin Talenta") sementara kolom Status berbicara **status nominasi** ("Lolos verifikasi") — dua kosakata untuk satu kenyataan, sehingga pengguna tidak bisa tahu opsi mana memunculkan baris mana.
- **`nominasi.status` sendiri tidak cukup.** `DISETUJUI` berarti "lolos verifikasi Admin Talenta", tapi selama `talent_pool.status` belum `DITETAPKAN` yang sebenarnya terjadi adalah **menunggu approval Pimpinan** — dan setelah ditetapkan, status barisnya **tetap** `DISETUJUI`. Satu status, dua keadaan yang sangat berbeda; label lama menulis "Lolos verifikasi" untuk keduanya sehingga baris yang masih menunggu tampak sudah beres.
- **Obatnya `tahapNominasi()` di [`lib/workflow.ts`](lib/workflow.ts)** — diturunkan dari status nominasi + status pool, sumber yang sama dengan `giliranSiapa()`. Lima tahap **saling meniadakan dan menutup semua kemungkinan**: `REVISI · VERIFIKASI · APPROVAL · DITETAPKAN · DITOLAK`, masing-masing satu nada lencana berbeda. Tabel dan penyaring memakai fungsi yang sama, jadi **jumlah baris tidak mungkin lagi berselisih dengan label lencananya** — diuji dengan memilih tiap opsi lalu mencocokkan lencana baris pertamanya.
- Param URL pindah `?giliran=` → `?tahap=`; yang lama masih dihormati supaya bookmark tidak mati, dan memilih tahap membuang `giliran` dari URL agar tidak ada dua penyaring hidup bersamaan.

### Cacat bawaan yang SUDAH ADA sebelum perombakan tampilan — jangan salah tuduh

- **F6 turun ke 28/39 SELAMA `HANYA_PEGAWAI_SUMBER=true`** — 11 langkah alur nominasi gagal karena subjek ujinya (pegawai bernama **Rus**) bukan bagian dari 10 pegawai eNom, jadi UI tidak menampilkannya. **Bukan bug**: dengan filter dimatikan F6 kembali **39/39**. Kalau perlu menguji alur nominasi, matikan filternya dulu.
- **F11 25/27** karena `asesmen_talenta` sekarang berisi data API saja: dua langkahnya membandingkan sebaran Kotak 9 dengan baseline seed (K1=3 … K9=10), sementara sekarang hanya K7=3 & K9=7 — dan karena sebarannya cuma mengisi 2 sel, sebaran per jabatan target jadi tidak bisa dibedakan dari yang generik. Sama sekelas dengan F6: konsekuensi eksperimen, bukan cacat kode.
- **F4 44/46** — di samping cacat 22px di bawah, langkah *U-6: pejabat berisiko punya isi* tidak bisa lulus selama `HANYA_PEGAWAI_SUMBER=true`: keempat pejabat yang mendekati BUP di data dev ada di luar 10 pegawai eNom. Bukan regresi panelnya; panelnya menyatakan "0 dari 7 pejabat aktif" dengan benar.
- **`/jabatan-target` menggulir horizontal 22px TEPAT di 768px** (sebelumnya terukur 12px). Disapu di **30 rute × 768px & 834px**: hanya rute ini, dan hanya di 768px — 834px bersih, 1440px bersih. Yang sudah dikesampingkan, semuanya terukur: bukan dari perombakan tampilan (dibuktikan dengan stash), navbar sudah dibetulkan terpisah, tabelnya memang terkurung benar di `overflow-x-auto` (wadah 751px, tabel 835px), dan **`overflow-x: hidden` pada `html`, `body`, shell, `main`, maupun wrapper TIDAK menghentikannya**. Gulirannya nyata (`window.scrollX` mencapai 22). Bisect menunjuk `DataTable` di dalam panel halaman itu. Mekanismenya belum ketemu — jangan mulai dari nol, mulai dari daftar ini.
- **F3 `filter: unit menyaring & mengosongkan drill-down yang basi` gagal** (**33/34**) dengan `locator.getAttribute: Timeout`. **Bukan** dari perombakan tampilan maupun dari pewarnaan Kotak 9: dibuktikan dengan menyimpan `kotak9-grid.tsx`, `warna-seri.ts`, `globals.css`, dan kedua halaman pemakainya ke stash lalu mengukur ulang — tetap gagal di langkah yang sama. Yang sudah dikesampingkan juga: dropdown unit **ada 21 opsi** (jadi `nth(3)` bukan penyebabnya), select-nya tunggal & visible, dan **reproduksi manual atas urutan yang sama BERHASIL** (`nth(3).value = "13"`). Bentuk kegagalannya — `count()` melihat 21 opsi stabil sementara `getAttribute` menunggu sampai timeout — menunjuk elemennya terus diganti (churn) hanya ketika langkah-langkah sebelumnya sudah berjalan di halaman yang sama. Belum tertelusuri lebih jauh.
- **`/jabatan-target` menggulir horizontal 12px di 768px** → langkah smoke `tablet sempit 768px` di Fase 4 merah (**45/46**). **Bukan** dari perombakan tampilan: dibuktikan dengan menyimpan `navbar.tsx` & `panel.tsx` ke stash lalu mengukur ulang — tetap 12px. Sumbernya bukan navbar dan bukan di dalam `main` (keduanya sudah diukur bersih); ia datang dari sesuatu di level `body` di luar app shell, khusus halaman itu. `/talenta` dan `/` bersih di lebar yang sama.
- **Navbar meluber 152px di tepat 768px** (terukur `scrollWidth 680` vs `clientWidth 528`) karena kotak pencarian `max-w-xs` muncul di breakpoint `md` sementara ruang setelah sidebar 240px hanya 528px. Ini **sudah diperbaiki**: breakpoint-nya dinaikkan ke `lg`, dan tombol profil kini berakhir di 752px (aman di dalam 768). Pencarian tetap terjangkau lewat Ctrl/⌘+K di lebar mana pun.

### "Tema mentok di gelap, header tidak bisa diklik" = HIDRASI MATI, bukan CSS

Dilaporkan sebagai bug tampilan, didiagnosis **tiga kali ke arah yang salah**, dan penyebab utamanya tidak menyentuh CSS sama sekali. **Kenali polanya, jangan mengulang penelusurannya.**

Gejalanya: halaman terender **sempurna**, tapi pengalih tema, command palette, menu pengguna, dan ciutkan sidebar mati semua sekaligus — tanpa halaman galat, tanpa pesan apa pun di layar. Temanya terkunci di gelap.

Kenapa gejalanya menipu ke arah CSS: class tema dipasang **inline script next-themes yang ikut terkirim di dalam HTML**, jadi ia berjalan bahkan ketika tidak satu pun chunk React termuat. Tema sempat terpasang dari preferensi sistem — lalu tidak ada React yang bisa mengubahnya lagi. Yang terlihat: "temanya mentok di gelap". Yang sebenarnya terjadi: React klien tidak pernah hidup.

**Ada DUA penyebab berbeda dengan gejala yang identik. Yang pertama jauh lebih sering.**

#### 1. Aplikasi dibuka bukan lewat `localhost` → chunk 403 (penyebab sebenarnya di kasus nyata)

`next dev` menolak permintaan `/_next/*` dari origin yang tidak terdaftar di **`allowedDevOrigins`** dengan **403**, sementara render servernya jalan normal. Jadi HTML-nya lengkap dan tidak ada galat di layar, tapi tidak satu pun chunk React termuat.

Mesin dev ini punya banyak alamat sekaligus (LAN `192.168.*`, Tailscale `100.*`, nama host `pupr-argo-dev`), dan bekerja lewat **VS Code Remote SSH biasanya TIDAK memakai `localhost`**. Karena itu `allowedDevOrigins` di [`next.config.ts`](next.config.ts) berisi **pola**, bukan satu IP — IP LAN berubah mengikuti DHCP, dan mengunci satu nilai berarti bug ini kembali sendiri suatu hari.

**Cara membuktikannya dalam satu perintah** (bukan dengan membaca kode):

```bash
C=$(curl -s http://localhost:3000/masuk | grep -oE '/_next/static/chunks/[^"]+\.js' | head -1)
curl -s -o /dev/null -w '%{http_code}\n' -H "Origin: http://mesin-lain:3000" "http://localhost:3000$C"
# 200 = sehat · 403 = inilah bug-nya
```

**Kesalahan diagnosis yang menghabiskan waktu paling banyak:** seluruh pengujian dijalankan lewat `localhost` dan **semuanya lulus** — smoke 36/36, klik nyata berhasil, 252 pemeriksaan penghalang bersih. Selama jalur akses penguji berbeda dari jalur akses pengguna, hasil hijau tidak membuktikan apa pun. **Tanyakan alamat yang dibuka pengguna sebelum menguji apa pun.**

Dijaga oleh langkah smoke `aset dev boleh dimuat dari origin non-localhost` di [`e2e/fase-0.smoke.mjs`](e2e/fase-0.smoke.mjs).

#### 2. `window.localStorage` yang MELEMPAR, bukan mengembalikan null

Penyebab kedua dengan gejala sama, ditemukan saat menelusuri yang pertama. Ia melempar `SecurityError` saat site data diblokir, di sebagian mode privat, di bawah kebijakan enterprise, dan di dalam iframe/webview berpartisi penyimpanan mati — **termasuk Simple Browser milik VS Code**. `setItem` juga bisa melempar `QuotaExceededError`.

Yang membuatnya fatal dan bukan cuma menjengkelkan: pembacaannya ada di dalam `getSnapshot` milik `useSyncExternalStore` di [`lib/hooks.ts`](lib/hooks.ts), yaitu **saat render**. Lemparan di sana menggagalkan **hidrasi**, bukan satu komponen — dan halaman yang gagal terhidrasi tetap tampak utuh karena HTML-nya sudah dikirim server. Satu `localStorage.getItem` tanpa penjaga mematikan setiap kontrol interaktif di aplikasi.

Sekarang `bacaPenyimpanan`/`tulisPenyimpanan` menelan lemparannya dan ada **cadangan `Map` dalam memori** — tanpa cadangan itu, tombolnya tetap terlihat mati karena `getSnapshot` selalu membaca null, sama buruknya dengan bug aslinya. Preferensi tidak bertahan antar kunjungan; aplikasinya tetap bisa dipakai. **Jangan pernah menyentuh `localStorage`/`sessionStorage` langsung di komponen** — lewat `lib/hooks.ts`.

Dijaga oleh langkah smoke `localStorage diblokir: aplikasi tetap terhidrasi & bisa diklik` di [`e2e/fase-0.smoke.mjs`](e2e/fase-0.smoke.mjs). Ia menguji **"aplikasinya masih bisa diklik"**, bukan "hook mengembalikan nilai bawaan" — uji unit atas hook-nya akan lulus sementara aplikasinya tetap mati.

**Pelajaran diagnosisnya, urut sesuai biaya:**

1. **Tanyakan alamat & port yang dibuka pengguna sebelum menguji apa pun.** `localhost:3000`, IP, nama host, Simple Browser, atau port yang diteruskan — keempatnya jalur berbeda, dan hanya satu di antaranya yang rusak. Pengujian lewat jalur yang salah menghasilkan hijau yang menyesatkan.
2. **Periksa tab Network / `pageerror` lebih dulu, bukan stylesheet.** "Tidak bisa diklik" + "halaman terlihat normal" + "tanpa galat di layar" hampir selalu berarti hidrasi. Satu `403` pada `/_next/*` atau satu `PAGEERROR` adalah seluruh jawabannya.
3. **Hitung dulu ada berapa server.** `ss -ltnp | grep next-server`.
4. Baru sesudah itu curigai kode.

**Dua server Next di satu `.next` juga menghasilkan gejala mirip.** Saat menelusuri ini ditemukan `next-server` kedua hidup di **port 5000** dari direktori yang sama, umur 4 jam, melayani CSS lama — sementara dev server di 3000 menulis ke `.next` yang sama. Cek `ss -ltnp | grep next-server` sebelum menyimpulkan apa pun tentang kode: memperbaiki port 3000 tidak pernah sampai ke orang yang membuka port 5000.

**Dua jebakan MySQL yang lolos di CLI tapi jatuh (atau melambat) di aplikasi** — ditemukan saat Fase 10, keduanya lewat alat ukur & smoke, bukan lewat pembacaan kode:

1. **Keluaran `JSON_TABLE` mewarisi collation KONEKSI, bukan collation tabel.** Membandingkannya dengan kolom `utf8mb4_0900_ai_ci` melempar *"Illegal mix of collations"* — tapi **hanya lewat aplikasi**: `mysql` CLI memakai collation koneksi berbeda, jadi kuerinya lolos di sana. "Sudah kuuji langsung ke DB, aman" bukan bukti apa pun untuk kueri yang menyentuh `JSON_TABLE`. Sebutkan `CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci` di definisi kolomnya — lihat `JSON_TABLE_DIKLAT` di [`lib/kueri/kategori-riwayat.ts`](lib/kueri/kategori-riwayat.ts).
2. **`ORDER BY` atas kolom terhitung membatalkan penghematan `LIMIT`.** Antrian diklat diurutkan menurut "dipakai berapa pegawai", yang dihitung dari `pegawai.riwayat_diklat`. Sebagai subkueri berkorelasi, MySQL menghitungnya untuk **seluruh** 182 baris sebelum memotong 25 — 182 × 2.000 pegawai × ekspansi JSON = **5.677 ms** di volume. Diubah jadi satu `WITH … GROUP BY` yang memindai `pegawai` sekali: **153 ms**. Selama pengurutannya menurut kolom **tersimpan**, subkueri per baris hanya berjalan untuk baris yang tampil. Di dev 141 ms → 6 ms — dan 141 ms itulah yang membuatnya dicurigai lalu diperiksa di volume.

**Jangan menyunting berkas Markdown lewat pipa teks PowerShell.** `Get-Content -Raw` + `Set-Content -Encoding utf8` pada berkas berisi non-ASCII **merusak encoding** (`→` menjadi `â†'`) dan menyisipkan BOM — terjadi ke CLAUDE.md di sesi ini, 77 baris rusak. Mojibake CP1252 itu deterministik jadi bisa dibalik, tapi jangan diulang: pakai alat Edit.

### Kehabisan memori terlihat seperti kode rusak — kenali dulu sebelum mendiagnosis

Terjadi setelah beberapa jam menjalankan smoke berulang kali, dan **sempat salah kudiagnosis dua kali**. Gejalanya berturut-turut:

| Gejala | Yang sebenarnya terjadi |
|---|---|
| ESLint mati dengan jejak tumpukan V8 + `Could not determine Node.js install directory` | Bukan konfigurasi ESLint. V8 gagal mengalokasikan heap |
| `vitest`: `Worker exited unexpectedly`, hanya 8 dari 17 berkas jalan | Worker fork dibunuh OS, bukan uji yang gagal |
| MySQL `ECONNREFUSED 3306`, `docker ps` menjawab *Internal Server Error* | Service `com.docker.service` berhenti. **Menyalakannya butuh elevasi admin** — tidak bisa dari sesi ini |
| Halaman 404 / dev server tidak menjawab | Server mati, bukan `.next` rusak — jangan langsung `rm -rf .next` |

**Cara memastikan dalam satu perintah** (PowerShell, bukan pipa bash — `$o` akan ditelan bash):

```powershell
$o = Get-CimInstance Win32_OperatingSystem
"RAM bebas : {0} GB / {1} GB" -f [math]::Round($o.FreePhysicalMemory/1MB,1), [math]::Round($o.TotalVisibleMemorySize/1MB,1)
"proses node: $(@(Get-Process node -ErrorAction SilentlyContinue).Count)"
```

Pernah terbaca **1.128 proses node** sekaligus — sisa Playwright & dev server yang dimatikan paksa. Di mesin 11,7 GB, RAM bebas turun ke 0,7 GB dan semua di atas menyusul.

**Membereskannya tetap TIDAK boleh dengan `taskkill /IM node.exe`** (aturan di bawah masih berlaku — itu membunuh dev server user). Yang aman: matikan **hanya PID yang memegang portnya**, `Get-NetTCPConnection -LocalPort <port> -State Listen` → `Stop-Process -Id`. Kalau perlu server sendiri, pakai port lain (3100) dan matikan hanya PID itu.

**`npm run build` polos masih menulis ke `.next` yang sama dengan dev server** — akibatnya route bersarang mendadak 404. Urutannya kalau memakai `npm run build`: smoke dulu, build terakhir.

**MATIKAN & NYALAKAN pratinjau dalam SATU perintah — jeda sedetik pun cukup untuk merusaknya.** Ini kesalahan yang paling banyak menghabiskan waktu pada 11 Agu 2026, dan anjuran "matikan pasangannya lalu nyalakan" **tidak cukup**: `next start` meninggalkan worker yang, beberapa detik setelah dibunuh, **mengambil kembali port 5000 sendiri**. Akibatnya berantai: server baru gagal bind, induknya mati, dan yang melayani port 5000 adalah worker lama — atau lebih buruk, sebuah `next start` yang jatuh ke `distDir` bawaan `.next` dan **menyajikan build produksi 10 Agustus** yang masih tertinggal di sana (`.next/BUILD_ID` bertanggal 10/08 09:51 dari insiden `npm run build` di atas dev server). Semuanya tampak sehat: HTTP 200, halaman utuh, tanpa galat — hanya fiturnya yang tidak ada.

Perintah yang benar, kill dan start **tanpa jeda**:

```bash
DEV=$(ss -ltnp | grep ':3000' | grep -oE 'pid=[0-9]+' | cut -d= -f2)
MATI=$(ps -eo pid,cmd | grep -E "next-server|next start -p 5000" | grep -v grep | awk -v d="$DEV" '$1!=d {print $1}')
kill -9 $MATI 2>/dev/null
NEXT_DIST_DIR=.next-pratinjau SESI_COOKIE_SECURE=false nohup npx next start -p 5000 > /tmp/p.log 2>&1 &
```

**Dua tanda bahwa ia benar-benar jalan**, dan keduanya wajib diperiksa: lognya memuat **`✓ Ready`** (bukan `EADDRINUSE`), dan pendengar port 5000 **punya induk** — `ps -o ppid= -p <pid>` bukan `1`. Pendengar ber-`ppid=1` adalah worker orphan dari server lama, dan ia akan menjawab 200 sambil menyajikan build yang salah.

**Nyalakan pratinjau dengan `npx next start` LANGSUNG, bukan lewat `npm run mulai:pratinjau`, kalau baru saja mematikan yang lama.** Pembungkus npm-nya kalah balapan port dan meninggalkan keadaan yang menipu: npm keluar dengan **kode 1** dan lognya menulis `EADDRINUSE`, tapi sebuah `next-server` **ORPHAN (ppid=1)** tetap memegang port 5000 dan **melayani dist yang LAMA**. Jadi `curl` menjawab 200, halaman terbuka normal, dan satu-satunya gejalanya adalah perubahan terbaru tidak muncul. Kena dua kali pada 11 Agu 2026; yang membongkarnya bukan HTTP 200 melainkan **memeriksa penanda perubahan terbaru di halamannya** (tautan yang baru ditambahkan tidak ada). Perintah yang aman:

```bash
NEXT_DIST_DIR=.next-pratinjau SESI_COOKIE_SECURE=false npx next start -p 5000
```

**Jangan pernah menyimpulkan pratinjau sudah diperbarui dari `HTTP 200`.** Cocokkan satu perubahan yang baru dibuat — sebuah tautan, sebuah tombol, sebuah kalimat — di halaman yang dilayaninya.

**Mengukur anchor: `window.scrollY` SELALU 0 di aplikasi ini.** Yang menggulir adalah `<main>` (app shell `h-dvh` + `overflow-hidden`), bukan window. Mengukur `scrollY` menghasilkan kesimpulan keliru bahwa anchor-nya mati; yang benar `document.querySelector('main').scrollTop`. Dan ukur **setelah** gulirannya selesai — pengukuran 1,5 detik setelah klik memberi posisi panel 791px, sementara pada 4 detik ia 72px dengan `scrollTop` 719. Beda itu bukan cacat, cuma penantian yang kurang.

**Mematikan pratinjau: bunuh PASANGANNYA, bukan cuma `next-server`.** `npm run mulai:pratinjau` menghasilkan dua proses — `sh -c NEXT_DIST_DIR=… next start -p 5000` dan `next-server` anaknya. Mem-`kill` anaknya saja membuat induknya **menyalakan penggantinya**, dan gejalanya menyesatkan tepat ke arah yang salah: build baru gagal bind dengan `EADDRINUSE` (tercatat di lognya, tidak di layar), sementara port 5000 tetap menjawab **200 dengan build LAMA**. Yang terlihat: "sudah aku build ulang tapi perubahannya tidak muncul." Terjadi 11 Agu 2026; PID 533530 selamat dari SIGTERM maupun SIGKILL yang hanya ditujukan padanya karena induknya terus mengganti. Matikan `sh` dan `next-server`-nya sekaligus, lalu **pastikan `ss -ltn | grep :5000` kosong SEBELUM** menyalakan yang baru, dan sesudahnya cocokkan `.next-pratinjau/BUILD_ID` dengan jam build — bukan sekadar percaya HTTP 200.

**Untuk build yang dilihat orang, pakai `npm run build:pratinjau` + `npm run mulai:pratinjau` (port 5000).** Keduanya memakai `NEXT_DIST_DIR=.next-pratinjau`, jadi artefaknya tidak pernah bertemu `.next` milik dev server dan keduanya boleh hidup bersamaan — terverifikasi: setelah build pratinjau selesai, dev server di 3000 tetap menjawab 200 di semua grup route. `distDir` di [`next.config.ts`](next.config.ts) yang mengaturnya; **`build` dan `start` WAJIB memakai nilai yang sama**, kalau tidak `next start` gagal dengan "could not find a production build" — itu sebabnya keduanya dibungkus skrip npm, bukan diserahkan ke hafalan.

Dua hal yang ditemukan saat memasangnya, keduanya sudah pernah menyesatkan diagnosis:

1. **Kerusakan `.next` yang sudah lama itu memang berasal dari sini.** `.next/BUILD_ID` ditemukan bertanggal sama dengan saat server produksi di port 5000 dinyalakan — jadi build produksi memang pernah menimpa `.next` milik dev, dan sesudah itu grup `(auth)` menjawab **404** (`/masuk`, `/lupa-password`) sementara grup `(app)` sehat **307**. Sembuh dengan `rm -rf .next` + nyalakan ulang; sekarang `distDir` terpisah mencegahnya secara struktural, bukan lewat aturan yang harus diingat.
2. **Build produksi lewat HTTP polos = tidak bisa masuk, tanpa pesan galat.** `lib/sesi.ts` memasang cookie `Secure` di produksi, dan browser **menolak menyimpan** cookie `Secure` yang datang lewat HTTP — `localhost` dikecualikan sebagai secure context, **alamat IP TIDAK**. Jadi masuk berhasil di server, cookie dibuang di klien, pengguna kembali ke halaman masuk. Gejalanya "sandinya benar tapi tidak bisa masuk". `mulai:pratinjau` menyetel `SESI_COOKIE_SECURE=false` **inline di package.json** supaya pelemahannya terlihat oleh siapa pun yang membaca skripnya — bukan disembunyikan di berkas env. **Jangan pernah setel itu di produksi sungguhan**; bawaannya sudah aman, dan `=== 'false'` yang eksplisit membuat env yang salah tulis atau kosong jatuh ke aman.

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

Ditambah Fase 10: `/master/kategori-diklat` (Super Admin + Admin Talenta) · `/data/validasi-riwayat` (**+ Pengelola Unit**, PRD §3 — satu-satunya halaman `data/*` yang dibukanya).

**Fase 11 mengubah dua rute, tidak menambah:** `/master/jabatan-kosong` **DIHAPUS** — isinya melebur ke `/jabatan-target` (dua panel: `#jabatan-kosong` & `#risiko-kekosongan`), dan alamat lamanya dialihkan **308 lewat `redirects()` di `next.config.ts`**. Pengalihannya sengaja **bukan** halaman ber-`permanentRedirect()`: versi itu sudah dicoba dan **tersangkut di batas `<Suspense>`** — HTTP 200, URL tidak bergerak, skeleton tidak pernah selesai. Lebih buruk daripada 404 karena tidak menyatakan apa pun. `/peta-talenta` sekarang menerima `?target=<id jabatan target>` yang mengganti **definisi sumbu X**, bukan menyaring populasi.

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
- **`014_kategori_riwayat.sql` menambah `master_kategori_riwayat_diklat` (9 kategori), `pemetaan_diklat` (182 baris USULAN), `riwayat_jabatan.jenis_penugasan`/`relevan_substansi`, dan `pegawai.riwayat_divalidasi_*`.** Isi kamusnya diturunkan dari `doc/doc_tambahan_2/sample(1).md` lembar 6. **`015_syarat_diklat_target.sql`** menambah `jabatan_target_syarat_diklat` (target 1 & 2 berisi 4 kategori; **target 3 BJKW sengaja tanpa syarat** — lembar 6 tidak memuat BJKW, dan mengarangnya berarti mengarang persyaratan jabatan).
- **Skoring SUDAH dialihkan ke kategori tervalidasi** (Tahap 2). `nilaiPengembanganKompetensi()` & `nilaiSubstansiJabatan()` tidak lagi membaca teks; keduanya sekarang bisa mengembalikan **`null`** untuk "tidak diketahui", dan mesin rubrik memberi `skor 0` + `perlu_review` untuk itu. Dampaknya **diukur, bukan ditebak** (`npm run ukur:dampak-skoring`, dijalankan sebelum menimpa `match_score`): 120/120 baris turun, **rata-rata 3,92 poin**, terbesar −6,33 — dan **kelayakan tidak bergeser sama sekali (35 → 35; 17 · 8 · 10 per target, sama dengan baseline)**. Selisihnya mengecil sendiri seiring antrian validasi dikerjakan.
  - Karena itu **`match_score_detail.perlu_review` sekarang 120 dari 120 baris** untuk Pengembangan Kompetensi, Substansi Riwayat Jabatan, dan induknya Nilai Pengalaman Jabatan. Itu **keadaan yang benar**, bukan regresi: antriannya memang belum dikerjakan. Angka itu akan turun sendiri, dan kalau ia turun **tanpa** ada yang memvalidasi, berarti ada yang menyentuh skoring.
  - Rata skor total per target: **73,31 · 73,31 · 72,43**.
  - Versi pertama benih antriannya memakai generator angka sampai indeks 14 ("lima belas diklat per orang pasti cukup"); ada pegawai dengan **30** entri, jadi **68 dari 182 nama hilang tanpa galat apa pun**. Sekarang `JSON_TABLE`. Kalau menulis ekstraksi JSON lagi, jangan pakai generator berbatas.
  - `pemetaan_diklat` di `pupr_dev_volume` diisi oleh langkah `benih pemetaan diklat` di `seed-volume.ts`, **bukan** oleh berkas skemanya — di alur volume, skema dipasang saat `pegawai` masih kosong.
- **Pembatasan unit pada ekspor (`unitWajib`) juga belum pernah dieksekusi**, sebab alasan yang sejenis: satu-satunya peran berlingkup unit — Pengelola Unit — tidak berwenang mengunduh laporan apa pun (PRD §6.7–6.8), jadi cabangnya tak tercapai lewat HTTP. Ia **dipertahankan** sebagai pertahanan berlapis; yang perlu diingat cuma bahwa ia belum terbukti berjalan, jadi jangan memperluas daftar peran laporan tanpa menguji ulang lingkupnya.

### Keputusan yang MENUNGGU pemilik proses — jangan diputuskan sendiri

Ketiganya sudah dianalisis, punya default yang berjalan, dan **mengubah siapa boleh apa**. Menyentuhnya tanpa jawaban berarti mengubah desain, bukan memperbaiki cacat.

| # | Keputusan | Default yang berjalan | Tercatat di |
|---|---|---|---|
| 1 | **34 selisih gerbang baca halaman vs PRD §6** — Viewer & Pengelola Unit bisa membuka `/master/unit`, `/jabatan-target/*`, `/data/*`, `/talent-pool`, `/rencana-pengembangan` lewat URL langsung (menu disembunyikan, tapi URL tembus). PRD-nya kurang lengkap, atau halamannya kurang gerbang? | seperti sekarang | audit sesi; belum masuk PRD |
| 2 | **Daftar aktor `doc_tambahan`** memakai 6 aktor termasuk *Admin Data* & *Pejabat Reviewer* tapi **tanpa Pengelola Unit** — padahal itu dasar seluruh pembatasan unit | 5 peran; keduanya dibaca sebagai penamaan lain | PRD §10.13 · phase.md §9 no. 11 |
| 3 | **Kandidat FAIL masuk ranking atau tidak** — `doc_tambahan` bertentangan dengan dirinya sendiri (Blueprint §3 vs diagram §7) | **masuk**, sesuai diagram §7 & PRD §6.5 | PRD §10.14 · phase.md §9 no. 12 |
| 4 | **Substansi Riwayat Jabatan: 2 kategori atau 5?** `sample(1).md` lembar 1 memakai 2 kategori ("berkaitan dengan jabatan target" 100 / tidak 50) sementara lembar 2–5 & 7 memakai 5 kategori Plt/Plh (100/80/60/40/0). Keduanya **mengukur hal berbeda**, bukan sekadar beda jumlah kategori. Kolom `relevan_substansi` di `doc/sql/014` menyiapkan tempat untuk versi 2-kategori tanpa memakainya | **5 kategori Plt/Plh** — cocok dengan `KERANGKA TALENT POOL.md`, 5 dari 6 lembar, dan kode sekarang | sample(1).md; kolom komentar lembar 7 menanyakannya sendiri: *"Bagaimana jika tidak ada riwayat Plt/Plh"* |
| 5 | **Sumber data Penilaian Kinerja**: `KERANGKA TALENT POOL.md` menulis `ekinerja.pu.go.id`, `sample(1).md` (4 lembar) menulis `karir.pu.go.id/enom`, dan `ekinerja` tidak muncul sekali pun di berkas baru. Mengubah **sistem mana yang diintegrasikan** (bertaut ke PRD §10.2) | label `(eKinerja)` di `SUMBER_KUNCI.PREDIKAT_KINERJA`, mengikuti dokumen lama | sample(1).md vs KERANGKA TALENT POOL.md |

Disposisi lengkap paket `doc_tambahan` (7 sudah sama · 3 diambil · 3 ditunda · 4 ditolak, semuanya beralasan) ada di [`doc/doc_tambahan/DISPOSISI.md`](doc/doc_tambahan/DISPOSISI.md). **Dua pekerjaan dari sana siap jalan tanpa menunggu siapa pun:** versioning rubrik `DRAFT→PUBLISHED→RETIRED` (menutup lubang nyata — `rubrik_snapshot` menyelamatkan angka tapi bukan aturannya, jadi skor suksesor yang sudah DITETAPKAN tidak bisa dipertanggungjawabkan setelah ambang berubah) dan `missing_policy` REVIEW+EXCLUDE (Gap Analysis sekarang tidak bisa membedakan "tidak ada datanya" dari "buruk", sehingga rata-rata unit tertarik ke bawah oleh ketiadaan data).

### Titik masuk Fase 10 (Hardening)

- ~~Berkas smoke `fase-8` & `fase-9`~~ **sudah ada** (30 + 39), ditambah `fase-10` (23) — 360 pemeriksaan di 11 berkas.
- ~~Kueri laporan Fase 8 & Fase 9 belum diukur~~ **sudah masuk `ukur:kueri`** (74 kueri, termasuk Fase 10). Lihat temuan di bawah.
- ~~Kamus kategori diklat & validasi riwayat~~ **selesai** (`doc/sql/014`–`015`, dua halaman, skoring sudah dialihkan — lihat "Keadaan Sekarang").
- **Yang MASIH belum terukur di skala volume: `aktivitasApi`.** `pupr_dev_volume` punya **0 baris** `api_activity_log` (seed-nya menyalin `api_client`/`api_token` tapi tidak menghasilkan aktivitas), jadi angka 3 ms itu mengukur tabel kosong — bukan bukti apa pun. Ia sekelas `auditLog`: hanya bertambah, tidak pernah dipangkas, dan **satu baris per permintaan `/api/v1`**. Kalau ada kueri yang akan melambat seiring waktu, ini dia.
- **Indeks yang disebut PRD §8** (`nip`, `unit_organisasi_id`, `jabatan_target_id`, `(pegawai_id, tahun_asesmen)`) belum pernah di-review sistematis terhadap `EXPLAIN`.
- **Aksesibilitas**: tiap chart sudah punya padanan tabel, palet sudah divalidasi CVD di kedua tema. Yang belum: audit fokus keyboard & `aria-label` menyeluruh.

#### Tiga hal yang BELUM diverifikasi ulang setelah peralihan skoring Tahap 2 (`56c3d10`)

Ditulis di sini supaya tidak dikira sudah beres. Ketiganya terhenti karena **mesinnya kehabisan memori**, bukan karena kode — lihat catatan lingkungan di bawah.

1. ~~**Smoke `fase-10`**~~ — **sudah dijalankan sesudah peralihan: 23/23 lolos, tanpa error konsol** (dikerjakan di sela Fase 11).
2. **Rebuild `pupr_dev_volume` dengan `015`** — `BERKAS_SKEMA` & `TABEL_MASTER` di `seed-volume.ts` sudah diperbarui, tapi `npm run db:volume` belum dijalankan sejak itu. Sampai dijalankan, `ukur:kueri:volume` mengukur volume DB versi lama.
3. ~~**`npm run lint` & `vitest`**~~ — **sudah bersih**: lint tanpa temuan, 466 uji lolos (17 berkas). Kuncinya `npx vitest run --no-file-parallelism` — di RAM bebas ~1 GB, worker paralel dibunuh OS dan gejalanya `Worker exited unexpectedly`, yang terbaca seperti uji gagal. Jalankan berurutan dulu sebelum mencurigai kode.

**`npm run build` masih belum dijalankan ulang** sejak Fase 10 menambah dua halaman, dan Fase 11 mengubah jumlah route lagi (`/master/jabatan-kosong` dihapus, dialihkan dari `next.config`). Jumlah route di baseline masih angka akhir Fase 9.

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
| `lib/kategori-riwayat.ts` | Normalisasi nama diklat + **usulan** kategori & jenis penugasan (`doc/sql/014`) | Murni & bebas DB. Yang penting dipahami: modul ini **mengusulkan, tidak memutuskan** — keputusannya ada di `pemetaan_diklat.status` & `riwayat_jabatan.jenis_penugasan`. Normalisasi namanya wajib **satu** definisi: kalau ia hidup di SQL benih dan di TypeScript pemetaan sekaligus, kamusnya akan punya baris yang tak pernah cocok, dan gejalanya adalah diklat yang "sudah divalidasi tapi tetap tidak dihitung". Usulannya sengaja mengembalikan **semua** yang cocok, bukan yang "terbaik" — memilih otomatis di antara dua kandidat berarti mesin mengambil keputusan yang justru sedang dipindahkan ke manusia. Terukur di data nyata: hanya **36 dari 182** nama diklat mendapat usulan, jadi 80% antrian memang murni manual |
| `lib/penilaian.ts` | Jembatan **data pegawai → nilai mentah per indikator**, dipetakan lewat `kunci_sistem` | Di sini letak semua tafsiran atas bagian rubrik yang doc-nya cuma memberi contoh. Menambah sumber data baru = menambah satu kunci di `KUNCI_INDIKATOR` + satu cabang di `nilaiUntukKunci`, bukan menyebar `if` di pemanggil. **Sejak Tahap 2, empat indikator Kualifikasi Jabatan seragam memakai `null` untuk "tidak diketahui"** — sebelumnya `nilaiLamaJabatan`/`nilaiKeragamanJabatan` memakai `null` sementara `nilaiPengembanganKompetensi` memberi 50 dan `nilaiSubstansiJabatan` memberi 0 untuk data yang tidak ada; ketidakseragaman itu yang sebenarnya bug, karena "belum diperiksa" jadi tak bisa dibedakan dari "sudah diperiksa dan memang rendah" |
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
| `lib/enom/` | Klien **BACA** API eNominasi `karir.pu.go.id/enom`: `klien.ts` (HTTP + env + taksonomi galat, `server-only`) · `pemetaan.ts` (terjemahan payload, MURNI) · `tipe.ts` (skema Zod dari balasan NYATA) | **Tidak ada jalur TULIS ke DB, dan itu disengaja** — sumber Penilaian Kinerja masih keputusan terbuka (§Keputusan nomor 5). Modul ini ada supaya keputusannya bisa diambil dari data, bukan dari dua dokumen yang bertentangan. Aturan bisnisnya **nol**: clamp, hitung ulang Kotak 9, banding kotak sumber, skala integritas, masa berlaku — semuanya didelegasikan ke `normalisasiAsesmen()`. Yang eNom-spesifik hanya bentuk payload |
| `lib/importer/` | Gerbang masuk data sumber: normalisasi §6 + **pencatatan temuan**. Bebas DB, bisa diuji murni | Mengorkestrasi `lib/normalisasi`/`lib/nip`/`lib/scoring`, bukan mengulangnya. Uji diorganisasi menurut **nomor aturan phase.md §6** supaya kelengkapannya terukur terhadap dokumen |
| `lib/audit.ts` | `jalankanMutasi()` — **satu-satunya pintu tulis** | Ia memeriksa peran → baca keadaan sebelum → tulis → catat audit. Menulis DB tanpa lewat sini berarti mutasi tanpa jejak audit |
| `lib/aksi/` | Server action: Zod di boundary, `HasilAksi` seragam, galat per-field | Tidak melempar untuk kesalahan wajar (validasi/wewenang/constraint) — melempar akan mengganti seluruh halaman padahal yang perlu cuma pesan di sebelah field |
| `lib/api/` | Permukaan API eksternal: `token.ts` (buat/hash/baca header — murni) · `scope.ts` (penegakan `scope_akses` + penyamaran — murni) · `gerbang.ts` (auth → scope → rate limit → jejak) · `bungkus.ts` (`tanganiV1()`) | Dua yang murni diuji tanpa DB (20 uji), dikelompokkan menurut **cara data bisa bocor**. Dua aturan yang tidak boleh dilonggarkan: **gagal tertutup** (`scope_akses` tak terbaca = nol endpoint, bukan semua) dan **penyamaran allowlist** — `samarkanPegawai()` menyusun balasan dari field yang diizinkan, bukan `delete baris.nip`; dengan blocklist, kolom yang ditambahkan ke kueri nanti menetes diam-diam ke klien tanpa MoU dan tidak ada uji yang gagal. `tanganiV1()` jadi pembungkus supaya endpoint berikutnya tidak **bisa** lupa memanggil gerbang |
| `lib/ekspor.ts` | Serialisasi CSV (murni, 16 uji) | Tiga hal yang baru terlihat setelah berkasnya dibuka orang lain di aplikasi lain: **injeksi formula** (Excel menjalankan sel berawalan `=` `+` `-` `@`, dan aplikasi ini mengekspor catatan teks bebas yang diisi manusia), **BOM UTF-8** (tanpa itu Excel Windows membaca CSV sebagai ANSI dan setiap nama non-ASCII rusak — akan dilaporkan sebagai "ekspornya rusak" lalu didiagnosis di tempat yang salah), dan pengutipan RFC 4180 |
| `lib/kueri/kategori-riwayat.ts` | Kamus kategori & antrian validasi riwayat (Fase 10) | Dua jebakan MySQL yang terdokumentasi di dalamnya, keduanya **lolos di `mysql` CLI**: collation keluaran `JSON_TABLE` (lihat konstanta `JSON_TABLE_DIKLAT`) dan `ORDER BY` atas kolom terhitung yang membatalkan `LIMIT` (5.677 ms → 153 ms di volume). Satu keanehan yang disengaja: **`unitWajib` di sini menyaring PENGHITUNG, bukan barisnya** — baris antriannya adalah *nama diklat*, yang tidak dimiliki unit mana pun. Pengelola Unit yang memetakan "Diklat PIM IV" memang ikut memengaruhi pegawai unit lain; yang dibatasi cuma "berapa pegawai **di unit saya** yang terdampak", supaya urutan kerjanya mengikuti dampak yang ia lihat. Halamannya menyatakan ini, tidak menyembunyikannya |
| `lib/aksi/kategori-riwayat.ts` | Mutasi kamus + validasi riwayat | **Dua daftar peran yang sengaja berbeda**: kamusnya master data lintas DJBK (Super Admin & Admin Talenta), penerapannya kurasi data pegawai yang PRD §3 berikan ke Pengelola Unit. Pembatasan unitnya juga tidak seragam — ketat di `tetapkanJenisPenugasan()` & `tandaiRiwayatDiperiksa()` (menyentuh baris satu pegawai), longgar di pemetaan diklat (menyentuh kamus). Pegawai di luar lingkup dijawab **sama dengan pegawai yang tidak ada**, pola yang sama dengan `/talenta/{nip}` di Fase 7 |
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
                            #           + 8 (laporan/ekspor CSV) + 9 (API eksternal)
                            #           + 10 (kategori & validasi riwayat) — 360 pemeriksaan, ~11 menit
npm run db:recompute        # hasilkan ulang doc/sql/007_recompute.sql dari lib/scoring
npm run ukur:kueri          # waktu 69 kueri halaman Fase 1-9 (150 ms/kueri · 500 ms agregat laporan)
npm run ukur:hitung-ulang   # waktu jalur TULIS Hitung Ulang (ambang 30 s/jabatan target)
npm run ukur:hitung-ulang:volume:semua  # hitung SEMUA jabatan target di pupr_dev_volume —
                            # WAJIB sebelum ukur:kueri:volume, kalau tidak beban Gap Analysis
                            # cuma sepertiga dan hasil ukurnya melegakan secara keliru
npm run db:gen-risiko       # hasilkan ulang doc/sql/008_seed_risiko_kekosongan.sql
npm run db:gen-token-api    # hasilkan ulang doc/sql/013_token_api_dev.sql (hash token dev)
npm run ukur:dampak-skoring # bandingkan match_score TERSIMPAN vs hasil lib/skor-massal sekarang.
                            # Jalankan SEBELUM db:recompute setiap kali menyentuh lib/penilaian
                            # atau lib/scoring — ia tidak menulis apa pun, dan ia yang menjawab
                            # "berapa yang bergeser & apakah kelayakan berubah" dengan angka
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
- Skema & seed sudah dieksekusi. Reset total = jalankan `doc/sql/001` → `015` **berurutan** (001 drop+recreate semua tabel), mis. `npm run db:sql doc/sql/001_schema.sql` satu per satu. Rantai ini terbukti reproducible: dua kali jalan dari nol menghasilkan checksum tabel inti yang identik.
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

Target rasa: **profesional & padat seperti Notion, tapi berjaket institusi** — alat kerja internal untuk staf kepegawaian & pimpinan eselon 1 dan 2 yang dipakai tiap hari, bukan tampilan marketing/landing page.

> **Arah ini berubah atas keputusan user (7 Agu 2026), jangan "diperbaiki" balik.** Versi sebelumnya melarang gradient dan menuntut palet netral sepenuhnya; hasilnya benar secara prinsip tapi tidak punya identitas — layarnya bisa jadi milik aplikasi mana pun. Identitas visual dari **v1** (`pupr-argo-dev/web`) diporting masuk: navy Kementerian PU + emas `#FCB717`, sidebar bergradien navy dengan tepi emas 3px, pita kepala halaman bergradien navy→teal, dan kartu KPI berwarna. Yang **tidak** ikut: shadow tebal, dekorasi tanpa fungsi, dan emoji di UI produksi. Kerangka kerjanya tetap Notion — densitas data, border tipis, whitespace lega.
>
> **Kompromi yang dibuat sadar:** v1 memakai `style` inline untuk warna kartu KPI dan karena itu tidak bisa punya tema gelap. Di sini semua warna bermerek jadi **token berpasangan light/dark** (`--merek-*`, `--emas`, `--sidebar-*`, `--kepala-*`, `.nada-*`), jadi larangan "tidak ada warna hardcoded di komponen" **tetap berlaku penuh**. Satu-satunya tempat warna di luar blok `:root`/`.dark` adalah class `.nada-*` di `globals.css` — palet kategorikal kartu KPI, dan itu memang tempatnya.

- **Tipografi & spacing**: tipografi jelas dan tenang, whitespace lega, border/divider tipis alih-alih shadow tebal (`--bayang-kartu` sengaja hanya 6%+4% — mengangkat, bukan menggambar kotak), hindari emoji dekoratif di UI produksi.
- **Emas PU BUKAN warna status.** Ia penanda identitas: tepi sidebar, strip navbar, indikator menu aktif, tombol utama di dalam pita kepala. Memakainya untuk "peringatan" membuatnya bertabrakan dengan `--warning` yang maknanya sudah tetap. Emas juga **tidak bisa jadi warna teks** di atas permukaan terang (kontras 1,7:1) — untuk itu ada `--emas-teks`.
- **`npm run audit:kontras` wajib hijau** (198 pasangan, `scripts/audit-kontras.mjs`, sudah masuk `npm run verifikasi`). Ia membaca nilainya **langsung dari `globals.css`**, jadi token yang diubah tanpa mengubah skripnya akan gagal — bukan tetap hijau. Warna bermerek adalah tempat kontras paling mudah jebol karena latar bergradien tidak punya satu nilai: tiap stop gradien diaudit sendiri. Port ini memunculkan **14 pasangan di bawah ambang**, dan tiga di antaranya sudah ada di v2/v1 sebelumnya — termasuk `--warning` yang cuma 4,28:1 di atas `--surface` dan teks deskripsi 3,59:1 di ujung teal pita kepala. "Sudah kulihat dan terbaca" hanya berlaku untuk titik gradien yang kebetulan dilihat.
- **Latar area konten `--kanvas`, bukan `--surface`.** Kartu & panel memakai `--surface`; kalau area konten juga putih, satu-satunya pemisah adalah border 1px dan halaman padat kartu jadi rata tanpa hierarki. Auditnya menjaga selisih keduanya ≥1,1:1 di kedua tema.
- **Menimpa gaya di atas permukaan bermerek dilakukan lewat TOKEN, bukan nama class.** Contohnya `.pita-kepala-aksi`: ia mendefinisikan ulang `--accent`/`--surface`/`--text` di scope-nya, dan karena `@theme inline` membuat tiap utility menunjuk langsung ke token (`bg-accent` → `var(--accent)`), semua tombol & badge di dalamnya menyesuaikan diri tanpa satu pun dari 33 halaman pemakainya perlu tahu. Menimpa per nama class akan lolos di halaman yang diperiksa dan gagal di halaman yang tidak.
- **Jangan namai kunci `@theme inline` sama dengan token mentahnya.** `--shadow-kartu: var(--shadow-kartu)` adalah referensi sirkular yang membuat nilainya invalid tanpa pesan galat apa pun. Karena itu token mentahnya bernama `--bayang-kartu`.
- **Tema terang & gelap wajib sejak awal** — bukan tambahan belakangan. Pakai CSS variables/design tokens untuk warna (bukan warna hardcoded di komponen), strategi `dark:` class Tailwind atau setara, toggle tema mudah dijangkau dari navbar. Setiap komponen baru harus dicek tampil benar di kedua tema.
- **JANGAN memajang nomor fase di UI.** Badge `Fase 1` di kepala dashboard, `F{n}` di sidebar, `Fase {n}` di command palette, dan komponen `LabelFase` semuanya **dihapus** (10 Agu 2026, permintaan user). Nomor fase adalah penanda rencana pengembangan internal: bagi staf kepegawaian ia tidak berarti apa pun, dan lebih buruk — "Fase 1" di dashboard terbaca seperti "aplikasi ini baru tahap awal" padahal Fase 11 sudah selesai. Item nav yang belum tersedia kini berlabel **"Segera"** dan tooltip **"Belum tersedia"**; fungsinya (menjelaskan kenapa menu mati) tetap, jargonnya hilang. `components/layout/tautan-fase.tsx` dihapus seluruhnya — nol pemakai setelahnya.
  - Catatan yang menjelaskan kenapa badge-badge itu selama ini tak terlihat: `FASE_TERSEDIA = 10` sementara fase tertinggi di `lib/navigasi.ts` juga 10, jadi `itemTersedia()` selalu true dan `LabelFase` selalu mengembalikan `null`. Satu-satunya yang benar-benar tampil adalah badge dashboard. **Verifikasi memakai teks yang dirender**, bukan grep: 30 rute diperiksa untuk `Fase \d+` dan `\bF\d+\b` di `body.innerText` DAN di seluruh atribut `title` — nol kemunculan.
- **Sidebar punya DUA tingkat collapse, dan keduanya perlu ada.** Ciutkan **lebar** (240px → 56px, tombol di atas) menyembunyikan label; ciutkan **grup** (klik header TALENTA/SUKSESI/…) memendekkan daftarnya. Yang kedua ditambahkan karena navigasinya sudah 28 item di 6 grup — daftarnya **1060px** sementara ruang tampak 895px, jadi selalu harus digulir. Dengan semua grup diciutkan: **895px, pas tanpa gulir**.
  - **Grup yang memuat halaman aktif TIDAK BISA ditutup** (tombolnya `disabled`, dan state tersimpannya diabaikan). Tanpa aturan itu, orang yang menciutkan sebuah grup lalu masuk ke salah satu halamannya melihat sidebar yang tidak menunjukkan di mana ia berada — dan gejalanya terbaca sebagai "menu saya hilang", bukan "grupnya tertutup". Dijaga langkah smoke `sidebar: grup bisa diciutkan & grup halaman aktif tetap terlihat`.
  - Grup yang tertutup menampilkan **jumlah item**-nya, supaya ia tetap menyatakan ada apa di dalamnya alih-alih sekadar lenyap.
  - State-nya **satu kunci localStorage berisi himpunan** (`useLocalStorageSet`), bukan satu kunci boolean per grup: jumlah grup berbeda menurut peran, dan memanggil hook di dalam `map()` atas daftar yang panjangnya berubah melanggar rules-of-hooks — React mencocokkan hook menurut urutan, jadi Viewer & Super Admin akan memetakan state ke grup yang berbeda. `getSnapshot`-nya mengembalikan **string mentah**, bukan `Set` baru; `useSyncExternalStore` membandingkan dengan `Object.is`, jadi objek baru tiap panggilan membuat render tak berhenti.
- **Layout app shell full-screen**: sidebar kiri persisten (navigasi utama, bisa collapse) + navbar atas (breadcrumb/judul halaman, search, menu user, toggle tema) + area konten utama. Tidak ada hero section ala landing page — langsung ke konten kerja.
- **Halaman padat data** (tabel, dashboard, tabel talent pool, editor rubrik) mengutamakan keterbacaan & densitas informasi di atas dekorasi visual — sesuai kebutuhan pengguna yang menatap tabel/grafik seharian.
- **Lambang resmi Kementerian PU ada di [`components/ui/logo-pu.tsx`](components/ui/logo-pu.tsx)**, path diporting dari v1 ([`web/app/icon.svg`](../pupr-argo-dev/web/app/icon.svg) — identik, sudah dicek checksum). Dipakai di sidebar, panel halaman masuk, header auth, dan `app/icon.svg`. Empat varian (`kotak`/`navy`/`emas`/`putih`) supaya satu lambang berkontras di latar terang, navy, maupun di atas foto.
  - **Monogramnya MEMANG mengisi penuh bidangnya (full-bleed). Jangan "perbaiki" viewBox-nya.** `getBBox()` memberi bbox `25000×25000` di viewBox `25000×25000` — nol ruang kosong. Dalam satu sesi itu **salah** disimpulkan sebagai tanda satu `<path>` yang terambil dari berkas bermultipath, lalu lambangnya sempat diganti monogram teks sementara. Premis yang keliru: *"tidak ada lambang resmi tanpa ruang kosong"* — lambang ini justru membantahnya, dan watermark di foto resmi Kementerian PU memperlihatkan monogram yang sama. Kalau butuh ruang kosong di sekelilingnya, beri padding pada **wadahnya**.
  - `sumber` (dari `logoResmi()` di [`lib/aset-publik.ts`](lib/aset-publik.ts), yaitu `public/logo-pu.svg`) **menimpa** lambang bawaan tanpa menyunting kode — lambang instansi bisa berubah, dan ketika itu terjadi jangan sampai perlu rilis kode. **Ikon tab terpisah** (`app/icon.svg`, dibaca Next dari metadata build, bukan dari `public/`) — dua tempat, ganti dua-duanya.
  - **Foto latar halaman masuk** (`public/masuk-latar.*`) disediakan operator, tidak ikut di repositori. Tanpa foto, panelnya menampilkan gradien navy + watermark lambang — komposisi yang dirancang berdiri sendiri, bukan kotak kosong. Cara menaruhnya di [`public/README.md`](public/README.md).
  - **Foto pegawai di halaman masuk = data pribadi di permukaan PRA-AUTENTIKASI** (UU PDP No. 27/2022, PRD §7.3). Siapa pun yang menjangkau alamatnya bisa melihatnya. Pakai foto yang disiapkan untuk publikasi & subjeknya menyetujui — bukan dari berkas kepegawaian, dan bukan gambar yang ada di `doc/` (itu dokumen kerja internal).
  - Panel masuk memasang **scrim navy dua lapis** supaya kontras teksnya tidak bergantung pada isi foto — foto terang maupun gelap sama-sama terbaca, jadi tidak perlu diukur ulang tiap kali fotonya diganti.
- **Sudut kiri-bawah viewport adalah AREA TERLARANG.** Indikator dev Next.js duduk di sana dan memotong apa pun yang ditaruh di situ. Sudah dicatat untuk sidebar, dan terbukti dua kali lagi di panel halaman masuk (kalimat kepatuhan tertutup separuh, lalu baris terakhir daftar butir). Kalau butuh teks di dasar panel, sisakan ruang (`pb-24`), jangan `p-10` rata.
- **`mix-blend-*` pada watermark memunculkan kotak-batasnya.** Mode blend memaksa lapisan komposit sendiri, dan hasilnya persegi terang di atas gradien. Pakai `opacity` biasa.
- **Cetak/PDF punya gayanya sendiri** (`@media print` di `globals.css`, diporting dari v1). Sidebar, navbar, dan apa pun ber-`.tanpa-cetak` hilang; pembatas tinggi app shell (`h-dvh` + `overflow-hidden`) dilepas — tanpa itu yang tercetak hanya sepanjang satu layar. Pita kepala halaman **ikut berwarna** (`print-color-adjust: exact`) karena itulah yang membuat lembarnya dikenali sebagai dokumen DJBK; sisanya tidak, supaya tint tabel tidak menghabiskan toner. Pasang `.tanpa-cetak` pada toolbar penyaring & tombol aksi di halaman baru.
- Ikuti inventaris halaman & isi kontennya persis seperti di `doc/PRD.md` §6 kecuali ada alasan kuat untuk menyimpang (dan kalau menyimpang, update PRD.md juga).

## Catatan Penting Lain

- Data pegawai (NIP, kinerja, hukuman disiplin) adalah data ASN sensitif — perlakukan sesuai catatan kepatuhan di `doc/PRD.md` §7.3 (rujukan UU PDP No. 27/2022), jangan expose lebih dari yang diizinkan `scope_akses` di endpoint eksternal.
- Ada beberapa keputusan desain yang masih berstatus **asumsi, belum dikonfirmasi user** — lihat `doc/ERD.md` §5 dan `doc/PRD.md` §10 sebelum mengambil keputusan implementasi yang bergantung padanya (mis. metode agregasi sub-indikator, siapa yang menjalankan tahap verifikasi kepegawaian, relasi dengan *karir.pu.go.id*).
- **Sebelum produksi, EMPAT hal wajib diganti** dan tidak satu pun bisa ditemukan oleh uji: (1) **sandi seluruh akun seed** masih `password123` — atur ulang semuanya lewat Manajemen Pengguna supaya pemiliknya dipaksa mengganti saat masuk; (2) `NEXT_PUBLIC_DEV_ROLE_SWITCH` sudah tidak dipakai kode mana pun, hapus saja dari env; (3) **HTTPS wajib** — cookie sesi dipasang `secure` hanya ketika `NODE_ENV === 'production'`, jadi menjalankan build produksi di belakang HTTP polos berarti cookie sesi melintas terbuka; (4) **ketiga token API dev di `doc/sql/013_token_api_dev.sql` PUBLIK** — plaintext-nya ada di repositori (disengaja, supaya smoke bisa memakainya). Cabut ketiganya lewat halaman Klien & Token API lalu terbitkan yang baru; token produksi acak 256 bit dan ditampilkan sekali. Kalau `pupr_dev` pernah dipromosikan ke environment lain, ketiga token itu ikut.
