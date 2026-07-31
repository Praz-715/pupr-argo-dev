# CLAUDE.md

Panduan kerja untuk Claude Code di project ini. Baca ini duluan sebelum menyentuh kode.

## Tentang Project

**SIMT DJBK** — Sistem Informasi Manajemen Talenta untuk Direktorat Jenderal Bina Konstruksi (modul peningkatan fitur *karir.pu.go.id*). Aplikasi web internal untuk mengelola data talenta ASN, rule engine penilaian jabatan target, workflow nominasi & persetujuan suksesi, plus API eksternal bertoken untuk instansi terkait.

**Stack:** Next.js 16 (App Router, full-stack — frontend + backend dalam satu app) + React 19 + Tailwind v4 + Drizzle ORM + MySQL.

**Status:** implementasi berjalan. **Fase 0** (fondasi + rule engine), **0.5** (rapikan data dev), **1** (Dashboard Utama), **2** (Direktori & Profil Talenta), **3** (Peta Talenta & Perbandingan Kandidat), **4** (Master Data, Importer & Kualitas Data), **5** (Rule Engine — jabatan target, editor rubrik, simulasi & diff), dan **6** (Talent Pool & Workflow Nominasi + Inbox Tugas) sudah selesai; berikutnya Fase 7 (Auth & RBAC). Dokumen di `doc/` tetap **source of truth** — kode mengikuti dokumen, bukan sebaliknya:

| Dokumen | Isi |
|---|---|
| [`doc/PRD.md`](doc/PRD.md) | Spesifikasi produk lengkap: tujuan, role, alur proses, inventaris halaman, desain API eksternal, fase implementasi. §10 memuat 12 keputusan terbuka (⚙️ = sudah ada default yang jalan di kode) |
| [`doc/ERD.md`](doc/ERD.md) | Skema database (28 tabel), relasi, aturan bisnis level data | 
| [`doc/sql/`](doc/sql/) | DDL & data dev, **dijalankan berurutan `001` → `011`**. Sumber kebenaran skema; perubahan berikutnya jadi berkas bernomor baru, bukan menyunting yang sudah tereksekusi |
| [`doc/KERANGKA TALENT POOL.md`](doc/KERANGKA%20TALENT%20POOL.md) | Rubrik penilaian talenta yang harus direplikasi di rule engine (Komponen→Indikator→Kategori Skor) |
| [`doc/BLUEPRINT READINESS - MODUL MANAJEMEN TALENTA.md`](doc/BLUEPRINT%20READINESS%20-%20MODUL%20MANAJEMEN%20TALENTA.md) | Gap analysis data & modul yang jadi dasar seluruh desain |
| [`doc/manajemen talenta 27 juli utk tim SIM.md`](doc/manajemen%20talenta%2027%20juli%20utk%20tim%20SIM.md) | Konteks organisasi, roadmap 3 fase, peta stakeholder |

**Rencana eksekusi:** [`phase.md`](phase.md) (di root, bukan di `doc/`) — hierarki kebenaran (doc = aturan, DB dev = dummy yang kita kendalikan), spesifikasi `lib/scoring` yang dikunci dari `KERANGKA TALENT POOL.md`, standar mutu interaksi (loading/skeleton/chart), keputusan teknis, dan urutan fase. **Fase 0, 0.5, 1, 2, 3, 4, 5, dan 6 sudah selesai** — berikutnya Fase 7 (Auth & RBAC).

**Sebelum mulai fitur apa pun:** cek dulu apakah itu sudah dirancang di PRD.md (§6 Inventaris Halaman) dan ERD.md. Kalau implementasi ternyata perlu menyimpang dari desain di sana, update dokumennya juga — jangan biarkan kode dan dokumen jadi tidak sinkron.

---

## Keadaan Sekarang (per akhir Fase 6)

### Baseline verifikasi — kalau angka ini turun, ada yang regresi

```
npm run verifikasi           → 346 uji unit lolos (10 berkas uji)
npm run verifikasi:data      → 36/36 pemeriksaan (SQL murni, silang-uji isi DB)
npm run verifikasi:skoring   → 120/120 baris match_score lahir ulang, 0 menyimpang
npm run smoke                → 15/15 (F0) · 21/21 (F1) · 23/23 (F2) · 34/34 (F3) · 46/46 (F4) · 44/44 (F5) · 39/39 (F6)
npm run build                → sukses, 23 entri route (21 halaman + /_not-found + /icon.svg)
npm run ukur:kueri           → 44 kueri = ~218 ms · :volume di 2.000 pegawai = ~515 ms, semua <150 ms
npm run ukur:hitung-ulang    → ~114 ms · :volume 1.960 pegawai (17.640 baris rincian) = ~2,5 s
```

**Cara menjalankan smoke:** butuh dev server hidup. `npm run smoke` memakai `localhost:3000` (punya user). Untuk server sendiri: `npx next dev -p 3100` lalu `node e2e/fase-N.smoke.mjs .next/smoke http://localhost:3100`.

**Jangan `npm run build` sambil dev server hidup di direktori yang sama** — build produksi menulis ke `.next` yang sedang dipakai server dev, dan akibatnya route bersarang mendadak 404. Urutannya: smoke dulu, build terakhir. Kalau sudah terjadi, cukup restart dev server (matikan **hanya PID yang memegang portnya**, jangan `taskkill /IM node.exe`).

### Route yang sudah ada

`/` (dashboard) · `/talenta` · `/talenta/[nip]` · `/peta-talenta` · `/bandingkan` · `/jabatan-target` · `/jabatan-target/[id]` · `/jabatan-target/[id]/kandidat` · `/jabatan-target/[id]/simulasi` · `/master/unit` · `/master/jabatan` · `/master/jabatan-kosong` · `/data/kelengkapan` · `/data/pembersihan` · `/data/konsolidasi` · `/master/hukuman-disiplin` · `/talent-pool` · `/nominasi` · `/nominasi/[id]` · `/rencana-pengembangan` · `/inbox`

Menu diaktifkan lewat `FASE_TERSEDIA` di [`lib/navigasi.ts`](lib/navigasi.ts) — **naikkan angkanya saat fase selesai**, kalau tidak menu-nya tetap tampil abu-abu.

### Utang yang ditunda dengan sengaja (bukan lupa)

| Yang ditunda | Alasan | Target |
|---|---|---|
| Ekspor CSV/Excel/PDF & ekspor gambar chart | Butuh infrastruktur job asinkron (U-10); dua implementasi ekspor kalau dibuat sekarang. Warna chart dari CSS variable, serialisasi SVG naif menghasilkan gambar tanpa warna | Fase 8 |
| Tombol trigger sinkronisasi manual | Mekanisme sumber produksi belum diputuskan (PRD §10.2: batch vs API/webhook). Tombol yang memanggil sumber yang belum ada **selalu gagal** → pengguna menyimpulkan sinkronisasi rusak. Aturan normalisasinya sendiri sudah siap di `lib/importer` | Fase 4 lanjutan, setelah §10.2 dijawab |
| Pemetaan manual & tanda "diverifikasi" di Antrian Pembersihan | Butuh tempat menyimpan keputusan manusia (siapa/kapan/catatan) yang belum ada di skema; pemetaan riwayat jabatan lebih tepat dari editor riwayat pegawai | Fase 4 lanjutan / 5 |
| Unggah berkas SK hukuman disiplin & arsip ijazah | Belum ada strategi penyimpanan berkas | Fase 8 |
| Auth asli (login, sesi, middleware) | Sesuai permintaan: dashboard dulu. `getCurrentUser()` sudah jadi satu-satunya titik akses identitas, jadi Fase 7 cukup mengganti isinya | Fase 7 |
| Progress determinate pada Hitung Ulang | Setelah jalur tulisnya di-batch, satu jabatan target di 1.960 pegawai selesai **2,5 detik** — pending state biasa sudah memadai. Kalau nanti dipakai untuk seluruh jabatan target sekaligus, itu barulah kasus job asinkron (U-10) | Fase 8, bila perlu |
| Syarat minimal kinerja/Kotak 9 di eligibility (U-11) | Perlu keputusan bisnis (phase.md §9 no. 5). Sementara ini Kotak 9 & predikat kinerja ditampilkan berdampingan dengan match score, jadi konteksnya ada walau tidak menyaring | setelah §9 no. 5 dijawab |
| Penanda notifikasi belum dibaca di navbar/sidebar | Inbox sudah jadi item nav & antrian nominasi sudah jadi widget dashboard (PRD §6.2), jadi pekerjaan yang menunggu tidak tersembunyi. Yang belum ada cuma lencana angka — butuh pembacaan per permintaan di app shell, dan itu menyentuh setiap halaman | Fase 7, sekalian saat sesi asli dipasang |
| "Tarik nominasi" oleh unit pengaju | Unit yang salah mengajukan sekarang harus minta Admin Talenta menolaknya. Enum `nominasi.status` tidak punya nilai untuk "ditarik", dan menambahnya berarti satu keadaan baru di state machine yang belum diminta PRD. Jejaknya tetap utuh lewat jalur penolakan | setelah dikonfirmasi pemilik proses |

### Yang perlu diketahui soal data dev

- **`008_seed_risiko_kekosongan.sql` mengubah tanggal lahir di NIP 4 pejabat** (Budi Santoso, Rus, Ika Puspita, Iwan) supaya ada yang mendekati BUP — halaman Risiko Kekosongan kosong tanpa itu. Jadi NIP mereka **sengaja berbeda** dari `doc/dtm_pegawai.csv`; itu bukan drift. Digit TMT CPNS & gender dipertahankan.
- **`009_kolom_pembanding.sql` menambah `asesmen_talenta.kotak_9_sumber`** — nilai `kotak_9` apa adanya dari sumber, dipakai HANYA sebagai pembanding kualitas data. Backfill 2 kasus nyata (Tasya & Tina = 4, hasil hitung = 7). Jangan pakai kolom ini di perhitungan apa pun.
- **`010_kunci_indikator.sql` menambah `rubrik_indikator.kunci_sistem`** — pengenal sumber data otomatis, terpisah dari nama indikator yang kini bebas diubah pengguna. `NULL` = tidak ada sumber otomatis → nilainya diisi manusia. Ditambah juga UNIQUE `(pegawai_id, jabatan_target_id)` di `match_score`.
- **`011_notifikasi.sql` menambah tabel `notifikasi`** + membetulkan **tiga keadaan workflow mustahil** yang ditinggalkan `007` (nominasi aktif tapi pool masih KANDIDAT · keputusan REVISI tapi status masih MENUNGGU_VERIFIKASI · nominasi di antrian tanpa `approval_log`). Ahmad Fauzi **sengaja** dibiarkan KANDIDAT walau nominasinya DITOLAK — itu keadaan sah (dipulihkan setelah penolakan) dan menguji tampilan kandidat berjejak penolakan.
- Keadaan workflow dev: **6 nominasi** (2 disetujui · 2 menunggu verifikasi · 1 dikembalikan untuk revisi · 1 ditolak), **1 suksesor ditetapkan** dengan 2 rencana pengembangan, **6 notifikasi** (5 belum dibaca + 1 sudah). Kalau angkanya bergeser tanpa ada yang menyentuh workflow, jalankan `npm run verifikasi:data`.
- Sisa temuan Antrian Pembersihan yang wajar ada: **27** riwayat jabatan belum terstruktur + **2** selisih Kotak 9. Kalau angkanya berubah drastis, cek apa yang menyentuh data.
- Ketiga jabatan target dev berstatus **AKTIF** dengan rubrik yang lolos seluruh pemeriksaan; kandidat lolos syarat: **17 · 8 · 10**. Kalau angka ini berubah tanpa ada yang menyunting rubrik, jalankan `npm run verifikasi:skoring`.

### Titik masuk Fase 7 (Auth & RBAC)

Yang sudah siap dipakai, jangan dibangun ulang:

- [`lib/auth.ts`](lib/auth.ts) — `getCurrentUser()` masih **satu-satunya** titik akses identitas. Fase 7 cukup mengganti isinya; tidak ada komponen yang membaca cookie langsung. Pengalih peran dev dijaga env flag `NEXT_PUBLIC_DEV_ROLE_SWITCH` dan **wajib mati** di produksi.
- `assertPeran()` + `jalankanMutasi()` sudah menegakkan wewenang **di server** untuk seluruh mutasi sejak Fase 4 — jadi tidak ada "tambal RBAC" yang perlu dikerjakan, hanya sumber identitasnya yang berganti.
- Wewenang workflow **tidak** ditulis di halaman: daftar tombol datang dari `aksiTersedia()` di [`lib/workflow.ts`](lib/workflow.ts) dan diperiksa ulang di server oleh `terapkanAksi()`. Menyembunyikan tombol dan menolak aksi memakai satu sumber yang sama, jadi keduanya tidak bisa berselisih.
- Pembatasan data per unit sudah ada contoh kerjanya: `ambilTugas()` dan halaman Nominasi membatasi Pengelola Unit ke `unitOrganisasiId`-nya sendiri. Fase 7 memperluas pola itu, bukan memulainya.
- `audit_log` sudah terisi lengkap (isi sebelum & sesudah per mutasi) dan `ambilAuditEntitas()` sudah ada di `lib/audit.ts` — halaman Audit Log Viewer tinggal menampilkannya.
- Halaman data sensitif sudah punya contoh **penolakan baca di server sebelum kueri**: `app/(app)/master/hukuman-disiplin/page.tsx`. Ikuti itu untuk halaman lain yang perlu dibatasi.
- Yang **belum** ada dan jadi inti Fase 7: Login/Lupa Password, sesi & timeout, middleware, Profil Saya, Manajemen Pengguna & Peran, Audit Log Viewer, dan mematikan pengalih peran dev.

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
| `lib/urut.ts`, `lib/banding.ts`, `lib/warna-seri.ts` | Konstanta & aturan yang dipakai **server dan klien sekaligus** | Sengaja di luar `lib/kueri/*` (yang ber-`server-only`) dan di luar berkas `'use client'`. Semua ekspor dari berkas `'use client'` jadi client reference — fungsi di sana tidak bisa dipanggil Server Component |
| `lib/db/schema.ts`, `relations.ts` | Hasil `npm run db:pull` | **Jangan diedit tangan** |
| `lib/auth.ts` | `getCurrentUser()` — satu-satunya titik akses identitas | Fase 7 cukup mengganti isinya; tidak ada komponen yang membaca cookie langsung |
| `components/ui/` | Primitif: Button (pending state bawaan), Skeleton, Badge, Panel, DataTable, Dialog, Toast, tiga keadaan kosong | `EmptyState` ada di berkas sendiri (bukan Client Component) karena tidak butuh interaktivitas |
| `components/charts/` | Wrapper chart sadar tema; warna dari token `--chart-1..4` lewat `lib/warna-seri.ts` | Kotak 9 pakai CSS Grid, bukan library chart. **Warna seri chart TIDAK BOLEH memakai warna status** (success/warning/danger) — itu punya makna tetap. Palet 4 warna sudah divalidasi untuk **semua pasangan** di kedua tema, tapi pemisahan terburuknya di pita CVD 6–8 → **setiap seri wajib punya pola garis berbeda** + legenda yang menggambar polanya + padanan tabel angka. Warna sendirian tidak cukup |
| `lib/importer/` | Gerbang masuk data sumber: normalisasi §6 + **pencatatan temuan**. Bebas DB, bisa diuji murni | Mengorkestrasi `lib/normalisasi`/`lib/nip`/`lib/scoring`, bukan mengulangnya. Uji diorganisasi menurut **nomor aturan phase.md §6** supaya kelengkapannya terukur terhadap dokumen |
| `lib/audit.ts` | `jalankanMutasi()` — **satu-satunya pintu tulis** | Ia memeriksa peran → baca keadaan sebelum → tulis → catat audit. Menulis DB tanpa lewat sini berarti mutasi tanpa jejak audit |
| `lib/aksi/` | Server action: Zod di boundary, `HasilAksi` seragam, galat per-field | Tidak melempar untuk kesalahan wajar (validasi/wewenang/constraint) — melempar akan mengganti seluruh halaman padahal yang perlu cuma pesan di sebelah field |
| `scripts/` | Generator SQL & pemeriksa: `gen-006-seed-perluasan`, `gen-008-seed-risiko`, `recompute`, `verifikasi-data`, `verifikasi-skoring`, `ukur-kueri`, `ukur-hitung-ulang` | Angka hasil hitung di DB **selalu** output kode, bukan tulisan tangan. `seed-volume.ts` memuat daftar berkas skema — **tambahkan berkas DDL baru ke sana**, kalau tidak `pupr_dev_volume` gagal dibangun (tabel master disalin dengan `SELECT *`, jadi satu kolom tertinggal = jumlah kolom tidak cocok) |

**Perintah yang sering dipakai:**

```
npm run verifikasi          # typecheck + lint + uji unit
npm run verifikasi:data     # 36 pemeriksaan isi pupr_dev (silang-uji SQL murni, termasuk konsistensi workflow)
npm run verifikasi:skoring  # lib/skor-massal vs isi match_score — menangkap KODE yang menyimpang
npm run smoke               # Playwright Fase 0 (shell) + 1 (dashboard) + 2 (direktori/profil) + 3 (peta/bandingkan) + 4 (master/kualitas) + 5 (rule engine) + 6 (talent pool/workflow)
npm run db:recompute        # hasilkan ulang doc/sql/007_recompute.sql dari lib/scoring
npm run ukur:kueri          # waktu 44 kueri halaman Fase 1-6 (ambang 150 ms/kueri)
npm run ukur:hitung-ulang   # waktu jalur TULIS Hitung Ulang (ambang 30 s/jabatan target)
npm run db:gen-risiko       # hasilkan ulang doc/sql/008_seed_risiko_kekosongan.sql
npm run db:volume           # bangun pupr_dev_volume (~2.000 pegawai)
npm run ukur:kueri:volume   # waktu kueri pada skala produksi
npm run ukur:hitung-ulang:volume  # waktu Hitung Ulang pada skala produksi
npm run ukur:payload        # buktikan payload render tidak tumbuh linear
```

**Dua pemeriksaan yang saling melengkapi, jangan dianggap ganda:** `verifikasi:data` memakai SQL murni untuk menguji **isi DB** terhadap rumus (menangkap data yang menyimpang); `verifikasi:skoring` menjalankan `lib/skor-massal` lalu membandingkannya dengan isi DB (menangkap **kode** yang menyimpang). Memverifikasi `lib/scoring` dengan `lib/scoring` hanya mengonfirmasi dirinya sendiri.

**Dev server dijalankan sendiri oleh user di `http://localhost:3000`** — jangan mematikan proses Node sembarangan (`taskkill /IM node.exe` membunuh dev server user). Kalau perlu server sendiri untuk pengujian, pakai port lain dan matikan hanya PID itu.

## Database Dev

- MySQL 8-compatible (docker container lokal), host `127.0.0.1:3306`, database `pupr_dev`.
- Kredensial dev: `devuser` / `dev123` (dev-only, container lokal — bukan kredensial produksi, jangan pernah dipakai/disamakan dengan environment lain).
- Skema & seed sudah dieksekusi. Reset total = jalankan `doc/sql/001` → `009` **berurutan** (001 drop+recreate semua tabel). Rantai ini terbukti reproducible: dua kali jalan dari nol menghasilkan checksum tabel inti yang identik.
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
