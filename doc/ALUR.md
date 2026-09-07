# ALUR.md — Peta Alur Pengguna SIMT DJBK

> **Dokumen ini DIHASILKAN PROGRAM.** Tabel peran, transisi nominasi, giliran,
> dan daftar menu dibaca langsung dari `lib/peran.ts`, `lib/workflow.ts`, dan
> `lib/navigasi.ts`. Jangan disunting tangan — jalankan `npm run doc:alur`.
> Yang ditulis manusia hanya narasi di antara tabel.

## 1. Siapa memakai aplikasi ini

| Peran | Cakupan | Jumlah menu |
|---|---|---|
| **Super Admin** | Tim IT DJBK — kelola pengguna, master data, klien & token API, audit log | 28 |
| **Admin Talenta** | Bagian Kepegawaian & Umum — rubrik, talent pool, verifikasi nominasi, laporan | 21 |
| **Pengelola Unit** | Staf kepegawaian unit — input & validasi data unitnya, ajukan nominasi | 10 |
| **Pimpinan** | Dirjen, Sesditjen, Para Direktur — dashboard, profil talenta, persetujuan akhir | 15 |
| **Viewer** | Pembina kebijakan — akses baca terbatas ke dashboard & laporan | 7 |

Jumlah menu berbeda karena navigasi disaring per peran (`navigasiUntuk()`), dan
penyaringan itu **bukan** satu-satunya penjagaan: setiap halaman punya gerbang
bacanya sendiri, dan setiap mutasi diperiksa lagi di server action. Menyembunyikan
menu hanya merapikan tampilan.

## 2. Alur masuk

1. `/masuk` — username/email + sandi. Balasan gagal **sama untuk semua sebab**
   (akun tidak ada, sandi salah, akun nonaktif) supaya tidak bisa dipakai
   menebak akun mana yang ada.
2. Sandi yang dibuatkan Super Admin memaksa `/ganti-sandi` sebelum aplikasi
   terbuka.
3. Lupa sandi → `/lupa-password` mengarahkan ke Super Admin. **Belum ada
   pengiriman surel**, dan halamannya menyatakan itu apa adanya alih-alih
   menjanjikan email yang tidak akan datang.
4. Sesi punya dua tenggat: kedaluwarsa absolut dan idle. Keduanya diperiksa di
   dalam SQL yang sama dengan pengambilan penggunanya.

## 3. Alur utama, dari data mentah sampai suksesor

```
  Data sumber (eNominasi / impor)
        │
        ▼
  [Kualitas]  Konsolidasi → Antrian Pembersihan → Validasi Riwayat → Kelengkapan
        │      menormalisasi & MENCATAT temuan; tidak pernah menebak diam-diam
        ▼
  [Penilaian] Jabatan Target → rubrik (komponen/indikator/kategori) → Hitung Ulang
        │      menghasilkan match_score + rincian per indikator
        ▼
  [Pemetaan]  Kotak 9 · Peta Talenta · Perbandingan Kandidat · Gap Analysis
        │
        ▼
  [Suksesi]   Kandidat & Eligibility → Talent Pool → Nominasi → Penetapan
        │
        ▼
  Rencana Pengembangan  ·  Laporan & Ekspor  ·  API eksternal /api/v1
```

Dua aturan yang berlaku di seluruh alur:

- **Kotak 9 SELALU hasil hitung** dari (Kinerja, Potensial). Nilai `kotak_9` yang
  datang dari sistem sumber disimpan terpisah sebagai pembanding kualitas data,
  tidak pernah dipakai perhitungan.
- **Skor tidak pernah menyaring kelayakan.** Gerbang syarat (`eligible`) dan skor
  adalah dua hal berbeda; kandidat yang tidak lolos syarat tetap dihitung skornya
  sebagai pembanding.

## 4. Alur nominasi — tabel transisi

Satu keputusan manusia mengubah **tiga** hal sekaligus: status talent pool, status
nominasi, dan satu baris `approval_log`. Ketiganya ditulis dalam satu transaksi
lewat `lib/workflow.ts`; tidak ada halaman yang boleh menuliskan transisinya
sendiri.

| Aksi | Siapa | Status pool | Status nominasi | Jejak | Perlu alasan |
|---|---|---|---|---|---|
| **Ajukan nominasi** | Pengelola Unit, Admin Talenta, Super Admin | Kandidat → **Dinominasikan** | _(belum ada)_ → **Menunggu verifikasi** | Verifikasi Kepegawaian · MENUNGGU | ya |
| **Ajukan ulang setelah revisi** | Pengelola Unit, Admin Talenta, Super Admin | Dinominasikan → **Dinominasikan** | Dikembalikan untuk revisi → **Menunggu verifikasi** | Verifikasi Kepegawaian · MENUNGGU | ya |
| **Setujui verifikasi** | Admin Talenta, Super Admin | Dinominasikan → **Diverifikasi** | Menunggu verifikasi → **Lolos verifikasi** | Verifikasi Kepegawaian · DISETUJUI | tidak |
| **Minta revisi** | Admin Talenta, Super Admin | Dinominasikan → **Dinominasikan** | Menunggu verifikasi → **Dikembalikan untuk revisi** | Verifikasi Kepegawaian · REVISI | ya |
| ⚠️ **Tolak nominasi** | Admin Talenta, Super Admin | Dinominasikan → **Ditolak** | Menunggu verifikasi → **Ditolak** | Verifikasi Kepegawaian · DITOLAK | ya |
| **Tetapkan sebagai suksesor** | Pimpinan, Super Admin | Diverifikasi → **Ditetapkan** | Lolos verifikasi → **Lolos verifikasi** | Persetujuan Pimpinan · DISETUJUI | tidak |
| ⚠️ **Tolak di tahap pimpinan** | Pimpinan, Super Admin | Diverifikasi → **Ditolak** | Lolos verifikasi → **Ditolak** | Persetujuan Pimpinan · DITOLAK | ya |
| ⚠️ **Batalkan penetapan** | Pimpinan, Super Admin | Ditetapkan → **Diverifikasi** | Lolos verifikasi → **Lolos verifikasi** | Persetujuan Pimpinan · REVISI | ya |
| ⚠️ **Keluarkan dari pool** | Admin Talenta, Super Admin | Kandidat → **Ditolak** | _(belum ada)_ → **_(tidak disentuh)_** | — | ya |
| **Pulihkan sebagai kandidat** | Admin Talenta, Super Admin | Ditolak → **Kandidat** | _(belum ada)_ / Ditolak / Dikembalikan untuk revisi / Menunggu verifikasi / Lolos verifikasi → **_(tidak disentuh)_** | — | ya |

### Giliran bertindak

| Giliran | Peran yang harus bertindak |
|---|---|
| `UNIT` | Pengelola Unit |
| `ADMIN_TALENTA` | Admin Talenta |
| `PIMPINAN` | Pimpinan |
| `SELESAI` | _alur selesai_ |

"Giliran siapa" **diturunkan** dari status pool + status nominasi (`giliranSiapa()`),
tidak disimpan sebagai kolom. Menyimpannya berarti dua sumber kebenaran yang bisa
berselisih tanpa ketahuan.

## 5. Inbox Tugas

Setiap peran melihat pekerjaan yang menunggu **dirinya**, diturunkan dari giliran
di atas — bukan daftar notifikasi yang perlu dibaca manual. Notifikasi disebar
per pengguna saat aksi workflow terjadi.

## 6. Seluruh halaman

| Grup | Halaman | Rute | Fase |
|---|---|---|---|
| _(tanpa grup)_ | Dashboard | `/` | 1 |
|  | Inbox Tugas | `/inbox` | 6 |
| Talenta | Direktori Pegawai | `/talenta` | 2 |
|  | Peta Talenta | `/peta-talenta` | 3 |
|  | Perbandingan Kandidat | `/bandingkan` | 3 |
| Suksesi | Jabatan Target | `/jabatan-target` | 5 |
|  | Talent Pool | `/talent-pool` | 6 |
|  | Nominasi | `/nominasi` | 6 |
|  | Rencana Pengembangan | `/rencana-pengembangan` | 6 |
| Data & Kualitas | Konsolidasi Data | `/data/konsolidasi` | 4 |
|  | Antrian Pembersihan | `/data/pembersihan` | 4 |
|  | Validasi Riwayat | `/data/validasi-riwayat` | 10 |
|  | Kelengkapan Data | `/data/kelengkapan` | 4 |
| Master Data | Unit Organisasi | `/master/unit` | 4 |
|  | Jabatan | `/master/jabatan` | 4 |
|  | Jabatan Kosong & Risiko | `/jabatan-target#jabatan-kosong` | 4 |
|  | Kategori Riwayat Diklat | `/master/kategori-diklat` | 10 |
|  | Hukuman Disiplin | `/master/hukuman-disiplin` | 4 |
| Laporan | Gap Analysis | `/laporan/gap-analysis` | 8 |
|  | Nominasi & Approval | `/laporan/nominasi` | 8 |
|  | Pusat Ekspor | `/laporan/ekspor` | 8 |
| Administrasi | Pengguna & Peran | `/admin/pengguna` | 7 |
|  | Klien & Token API | `/admin/api` | 9 |
|  | Log Aktivitas API | `/admin/api/log` | 9 |
|  | Dokumentasi API | `/admin/api/dokumentasi` | 9 |
|  | Audit Log | `/admin/audit-log` | 7 |
|  | Pengaturan Sistem | `/admin/pengaturan` | 7 |
| Akun | Profil Saya | `/profil` | 7 |

Halaman ber-`luarSidebar` (mis. Profil Saya) tetap ada di breadcrumb dan command
palette, tapi tidak di sidebar — jalan masuknya lewat menu pengguna di navbar.

## 7. Di mana tiap alur diuji

| Berkas smoke | Yang dijaga |
|---|---|
| `fase-0` | App shell, tema, command palette, menu pengguna, RBAC navigasi, collapse sidebar & grup, localStorage diblokir, aset dev lintas-origin |
| `fase-1` | Dashboard: KPI, Kotak 9 + drill-down, jabatan kosong |
| `fase-2` | Direktori & profil talenta 360° |
| `fase-3` | Peta Talenta & Perbandingan Kandidat |
| `fase-4` | Master data, importer, kualitas data |
| `fase-5` | Rule engine: jabatan target, editor rubrik, simulasi & diff |
| `fase-6` | Talent pool & **seluruh alur nominasi** sampai penetapan + Inbox |
| `fase-7` | Auth & RBAC: sesi asli, manajemen pengguna, audit log, pengaturan |
| `fase-8` | Laporan & ekspor CSV |
| `fase-9` | API eksternal `/api/v1`: Bearer, scope, rate limit, jejak |
| `fase-10` | Kategori riwayat diklat & validasi riwayat |
| `fase-11` | Kotak 9 per jabatan target, syarat pelatihan, risiko kekosongan |

Jalankan satu per satu (`node e2e/fase-N.smoke.mjs .next/smoke`), **bukan**
`npm run smoke`: skrip gabungan memakai `&&` sehingga satu kegagalan
menghentikan sisanya.
