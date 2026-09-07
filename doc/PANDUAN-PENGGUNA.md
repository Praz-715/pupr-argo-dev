# Panduan Pengguna — SIMT DJBK

Satu sekuens utuh: **masuk → susun formulasi → siapkan data pegawai → hitung → baca nilai akhir → ajukan & tetapkan suksesor**. Ikuti berurutan; tiap langkah menyebut **siapa yang boleh**, **apa yang diklik**, dan **apa yang seharusnya terlihat sesudahnya**.

Untuk gambaran proses & kendalinya, lihat [`PROBIS.md`](PROBIS.md).

> Nama menu, label tombol, dan pesan di panduan ini diambil dari aplikasi pada **24 Agustus 2026**. Kalau ada label yang tidak Anda temukan, kemungkinan besar panduannya yang menua — bukan Anda yang salah lihat.

---

## Ringkasan sekuens

| # | Langkah | Peran | Halaman |
|---|---|---|---|
| 0 | Masuk | semua | `/masuk` |
| 1 | Buat jabatan target (DRAFT) | Admin Talenta · **Pengelola Unit** (dari kursi kosong unitnya) | Suksesi › Jabatan Target |
| 2 | Isi jabatan anggota | Admin Talenta | tab **Jabatan Anggota** |
| 3 | Isi persyaratan | Admin Talenta · **Pengelola Unit** | tab **Persyaratan** |
| 4 | Susun rubrik | Admin Talenta | tab **Rubrik Penilaian** |
| 5 | Aktifkan (lewat gerbang) | Admin Talenta | tombol status |
| 6 | Siapkan data pegawai | Admin Talenta / Pengelola Unit | Data & Kualitas + profil |
| 7 | **Hitung Ulang** | Admin Talenta | `/jabatan-target/{id}` |
| 8 | Baca nilai akhir | semua | Kandidat · Peta Talenta · profil |
| 8b | Masukkan kandidat ke talent pool | Admin Talenta · **Pengelola Unit** (pegawai unitnya) | Talent Pool |
| 9 | Ajukan nominasi | Pengelola Unit · Admin Talenta | Talent Pool |
| 10 | Verifikasi | Admin Talenta | Nominasi |
| 11 | Tetapkan suksesor | Pimpinan | Nominasi |
| 12 | Rencana pengembangan & ekspor | Admin Talenta | Rencana Pengembangan · Laporan |

---

## 0 · Masuk

Buka `/masuk`, isi username & sandi.

Akun dev (sandi semuanya `password123`):

| Username | Peran |
|---|---|
| `superadmin` | Super Admin |
| `martyanti.rbs` | Admin Talenta |
| `reza.kurniawan` | Pengelola Unit |
| `dirjen` | Pimpinan |
| `reviewer.bpsdm` | Viewer |

**Yang seharusnya terlihat:** Dashboard dengan 4 kartu angka, Sebaran Kotak 9, dan Peta Kinerja × Potensial.

Kalau sandi Anda masih buatan Super Admin, aplikasi menahan Anda di halaman ganti sandi sampai diganti — itu disengaja.

> **Kalau halaman terbuka tapi tidak ada yang bisa diklik** (tema terkunci, menu mati): itu bukan tampilan, itu React yang tidak hidup. Beri tahu tim teknis **alamat & port yang Anda buka** — itu petunjuk pertama yang mereka butuhkan.

---

## 1–5 · Setup formulasi

> **Siapa mengerjakan apa (berubah 24 Agustus 2026).** Dua peran, dua tanggung jawab:
>
> - **Pengelola Unit MENGUSULKAN** — menjadikan kursi kosong di unitnya sebagai draft (langkah 1) dan mengisi persyaratannya (langkah 3). Ia hanya melihat kekosongan **unitnya sendiri**; daftarnya diberi keterangan "Dibatasi ke unit Anda".
> - **Admin Talenta MEMUTUSKAN** — jabatan anggota (2), rubrik penilaian (4), dan **aktivasi** (5).
>
> Alasan pembagiannya: unit yang paling tahu kursinya kosong dan syarat apa yang dibutuhkan, sedangkan bobot 65/20/15 berlaku se-organisasi — kalau tiap unit menyetel bobotnya sendiri, peringkat antar unit tidak bisa lagi dibandingkan padahal Peta Talenta memajangnya bersebelahan. Aktivasi ditahan karena itulah titik verifikasinya: selama DRAFT, jabatan target **tidak** dihitung dan **tidak** muncul di pemilih Peta Talenta.
>
> Pimpinan & Viewer membaca saja di semua langkah ini.

### Alur usulan dari kursi kosong — langkah demi langkah

| # | Siapa | Yang dilakukan | Yang terjadi sesudahnya |
|---|---|---|---|
| 1 | **Pengelola Unit** | **Suksesi › Jabatan Target** → panel **Sudah kosong** → tombol **Jadikan draft** pada barisnya | Draft dibuat + 1 jabatan anggota terisi otomatis. Halaman langsung membuka tab **Persyaratan**. Admin Talenta menerima notifikasi *"Usulan jabatan target"* di Inbox. |
| 2 | **Pengelola Unit** | Isi **Persyaratan** & **Syarat pelatihan** | Tersimpan. Tombol **Aktifkan** memang tidak ada — bukan kerusakan. |
| 3 | **Admin Talenta** | Buka notifikasinya → tinjau persyaratan → tab **Rubrik Penilaian** → **Salin rubrik** dari jabatan target yang sudah lolos pemeriksaan | Rubrik terisi tanpa mengetik ulang 9 indikator. |
| 4 | **Admin Talenta** | **Aktifkan** | Status AKTIF, skor mulai dihitung. Pengusulnya menerima notifikasi *"Jabatan target aktif"*. |
| 5 | **Pengelola Unit** | **Talent Pool** → pilih jabatan target itu → **Tambahkan ke pool** | Hanya pegawai **di unitnya** yang ditawarkan. Sesudah masuk pool, ia bisa **Ajukan nominasi** (langkah 9). |

**Kalau tombol "Jadikan draft" tidak ada pada satu baris:** kursi itu **sudah** punya jabatan target. Buka yang itu alih-alih membuat draft kedua — dua jabatan target untuk satu kursi berarti dua daftar kandidat yang bersaing tanpa ada yang menjelaskan mana yang berlaku.

### 1. Buat jabatan target

Dua jalan, dan **keduanya memilih dari master jabatan** — tidak ada lagi kode & nama yang diketik sendiri (berubah 25 Agustus 2026):

- **Dari kursi kosong**: panel **Sudah kosong** → **Jadikan draft** pada barisnya.
- **Dari seluruh master**: tombol **Buat jabatan target** (kanan atas) → cari jabatannya (bisa dicari menurut **nama jabatan, kode, atau unit organisasi**) → **Pilih**.

Tiap pilihan menampilkan eselon, unit organisasi, dan status terisi/kosong. Jabatan yang **sudah** punya jabatan target tetap tampil, ditandai nama targetnya, dan tombol Pilih-nya mati — sunting yang itu alih-alih membuat yang kedua untuk kursi yang sama.

Kode target, nama target, dan **jabatan anggotanya** terisi otomatis dari master. Itu yang menutup tiga kekeliruan yang dulu mungkin terjadi: nama yang berbeda dari master, kode yang bentrok/terpotong, dan jabatan target yang tidak menunjuk kursi mana pun karena tab Jabatan Anggota terlewat.

> Menyunting nama/deskripsi jabatan target yang **sudah ada** tetap bisa — menu baris → **Ubah profil**. Yang dicabut hanya cara MEMBUAT.

**Yang seharusnya terlihat:** baris baru berstatus **DRAFT**, rubrik "belum ada", kandidat "—".

**Kenapa selalu DRAFT:** jabatan target belum bisa menilai siapa pun sebelum punya jabatan anggota dan rubrik yang lolos pemeriksaan. Status AKTIF saat dibuat akan berbohong.

### 2. Jabatan Anggota

Klik nama jabatan targetnya → tab **Jabatan Anggota** → tambahkan posisi konkret yang diwakili jabatan target ini. Minimal satu.

Satu jabatan target boleh mewakili beberapa posisi sejenis — itu gunanya tab ini.

### 3. Persyaratan

> Peran: Admin Talenta **dan Pengelola Unit** (untuk jabatan target yang salah satu jabatan anggotanya ada di unitnya). Kalau isian di tab ini hanya bisa dibaca, jabatan target itu di luar lingkup unit Anda.

Tab **Persyaratan** — syarat minimal kandidat. **Lima jenis** (golongan ditambahkan 25 Agustus 2026):

| Jenis | Isi nilai minimalnya | Perilaku |
|---|---|---|
| **Pendidikan minimal** | `SLTA` · `D3` · `S1_D4` · `S2` · `S3` | menggugurkan |
| **Bidang ilmu** | daftar kata kunci dipisah koma; `semua` = semua bidang | menggugurkan |
| **Golongan minimal** | `I/a` sampai `IV/e` (mis. `III/d`) | **menggugurkan** — syarat keras PP 11/2017 |
| **Pengalaman minimal** | eselon (`I`–`IV`, `NON_ESELON`) atau jumlah tahun; ditambah kolom **Lama minimal (tahun)** | eselon menggugurkan; **durasinya** ditandai perlu verifikasi manusia |
| **Lainnya** | bebas | selalu perlu penilaian manusia |

**Kenapa durasi belum diperiksa mesin:** "pengawas paling singkat 3 tahun" menuntut riwayat jabatan yang sudah dipetakan ke master **dan** lamanya diketahui. Lamanya kini diketahui untuk **seluruh** baris (bertanggal, atau berdurasi dari kolom *Masa Kerja Jabatan Penempatan* berkas Talent Pool), tapi **pemetaan ke master** yang belum: baru 35 dari 670 baris (5%) memenuhi keduanya — jadi menegakkannya sekarang akan menandai hampir semua kandidat "perlu verifikasi manual" bukan karena syaratnya tidak dipenuhi, melainkan karena riwayatnya belum terbaca. Syaratnya tetap ditampilkan lengkap (mis. lencana *min. 3 tahun*) supaya pemeriksanya tahu apa yang harus dicek.

**Penolakan golongan selalu menyebut alasannya** — mis. "Golongan IV/a di bawah syarat minimal IV/b" — sehingga tidak ada kandidat yang hilang dari daftar tanpa keterangan.

**Ini satu-satunya tempat syarat diisi.** Gerbang kelayakan dan indikator rubrik membaca daftar yang sama, jadi tidak ada dua daftar yang bisa berselisih.

Kosong itu sah — tapi kandidatnya akan ditandai **perlu verifikasi manual** alih-alih otomatis lolos/tidak.

### 4. Rubrik Penilaian

Tab **Rubrik Penilaian** — susun **Komponen → Indikator → Kategori Skor**, mengikuti [`KERANGKA TALENT POOL.md`](KERANGKA%20TALENT%20POOL.md):

- **Potensi & Kompetensi** 65% → Penilaian Potensi dan Kompetensi
- **Kualifikasi Jabatan** 20% → Tingkat Pendidikan Formal 5% · Kesesuaian Bidang Ilmu 5% · Pengembangan Kompetensi 5% · Nilai Pengalaman Jabatan 5% (Lama · Keragaman · Substansi)
- **Integritas & Moralitas** 15% → Verifikasi Rekam Jejak Disiplin

Tiap indikator diberi **kategori skor** — nama kategori + nilainya (mis. *"Memiliki pengalaman jabatan lintas Unit Organisasi/di luar Bina Konstruksi" → 100*).

Ada tombol **duplikasi rubrik** dari jabatan target lain — pakai itu daripada menyusun ulang dari nol.

### 5. Aktifkan

Ubah status **DRAFT → AKTIF**.

**Kalau ditolak, pesannya menyebut sebabnya.** Ada dua gerbang:

1. *"Belum ada jabatan anggota…"* → kembali ke langkah 2.
2. *"Rubrik masih punya N galat sehingga skornya akan salah. Yang pertama: …"* → perbaiki di tab Rubrik. Yang diperiksa: bobot, ambang berlubang / tumpang tindih / terbalik, dan kategori yang tidak menutup rentang 0–100.

**Yang seharusnya terlihat:** status **AKTIF**, dan jabatan target itu mulai dipakai menilai kandidat.

---

## 6 · Siapkan data pegawai

> Peran: **Admin Talenta**; **Pengelola Unit** untuk pegawai di unitnya sendiri.

Kerjakan yang paling berdampak lebih dulu — urutan di bawah sudah menurut dampaknya.

### a. Lihat apa yang kurang

**Data & Kualitas › Kelengkapan Data.** Panel "Butir yang paling mendesak" sudah diurutkan menurut **bobot × jumlah pegawai** — bukan menurut persentase, supaya butir berbobot besar tidak tertutup butir remeh yang kebetulan lebih banyak bolongnya.

### b. Bereskan temuan

**Data & Kualitas › Antrian Pembersihan.** Temuan konkret per baris: NIP tidak valid, riwayat jabatan belum terstruktur, pendidikan tidak terurai, tanggal kosong, Kotak 9 sumber ≠ hasil hitung.

### c. Validasi riwayat — **jangan dilewati**

**Data & Kualitas › Validasi Riwayat.** Dua pekerjaan:

- **Kamus diklat** — petakan nama diklat ke kategori. Sistem hanya **mengusulkan** (dan hanya untuk sekitar 36 dari 182 nama); sisanya keputusan manusia.
- **Jenis penugasan** — tandai riwayat jabatan sebagai Definitif / Plt / Plh.

**Kenapa penting:** indikator **Pengembangan Kompetensi** dan **Substansi Riwayat Jabatan** membaca **kategori hasil validasi**, bukan teks nama diklat. Diklat yang belum dipetakan **tidak dihitung** — walau namanya sudah tercatat di profil.

### d. Lengkapi profil per pegawai

**Talenta › Direktori Pegawai** → klik satu baris → profilnya.

Tiap bagian punya tombol **Tambah** / **Ubah**:

| Bagian | Yang bisa diisi |
|---|---|
| Kepala profil — **Ubah data** | nama, golongan, pangkat, TMT, jabatan, pendidikan terakhir, status kepegawaian |
| Riwayat pendidikan | jenjang, bidang studi, sekolah, tahun lulus, no. pertek BKN |
| Riwayat jabatan | nama jabatan, tautan ke jabatan master, jenis penugasan, unit, tanggal, **lama menjabat (bulan)**, no. SK |
| Riwayat diklat | nama diklat/sertifikasi |
| Tren kinerja | tahun, periode SKP, nilai kinerja & perilaku, predikat |
| Posisi Kotak 9 | tahun asesmen, jenis, nilai kinerja (Y), potkom, integritas, predikat |

Tiga hal yang perlu diketahui:

- **NIP tidak bisa diubah dari sini.** Ia identitas baris, alamat halaman, dan satu-satunya sumber tanggal lahir, usia, masa kerja, dan proyeksi pensiun. NIP yang salah diperbaiki lewat Antrian Pembersihan.
- **Kotak 9, nilai potensial, dan nilai talenta DIHITUNG** dari isian asesmen — tidak diketik. Formulirnya tidak menyediakan kolomnya.
- **Diklat baru belum langsung dihitung.** Ia perlu dipetakan kategorinya di Validasi Riwayat (langkah c).
- **"Lama menjabat (bulan)" hanya dipakai kalau tanggalnya kosong.** Kolom itu untuk riwayat yang sumbernya memberi lamanya saja tanpa tanggal — mis. berkas Talent Pool Eselon II & III. Kalau tanggal mulai terisi, lamanya dihitung dari tanggal dan isian ini tidak berpengaruh. Dikosongkan berarti "tidak diketahui", **bukan** nol bulan.

### e. Verifikasi rekam jejak disiplin — **ceklis di panel Integritas** (25 Agustus 2026)

Panel **Integritas & rekam jejak disiplin** pada profil kini berbunyi netral bila pegawainya
tidak punya catatan: *"Tanpa catatan hukuman disiplin. Skor Integritas & Moralitas dihitung
100 untuk keadaan ini."* — bukan lagi kotak peringatan, yang dulu muncul di hampir semua
profil dan karena itu berhenti dibaca.

Di bawahnya ada ceklis **"Sudah diperiksa, tidak ada catatan hukuman disiplin"**. Yang
dicentang adalah **pemeriksaannya**, bukan orangnya: sistem merekam siapa yang memeriksa dan
kapan, lalu menampilkannya di panel itu. Tekan sekali lagi untuk melepas tandanya.

**Skor tidak berubah karena mencentangnya.** Ketiadaan catatan sudah dinilai 100 sejak awal;
yang ditambahkan adalah jejak bahwa angka itu benar sudah diperiksa manusia — pembedaan yang
penting karena komponen ini 15% dari match score.

**Melengkapi butir kesiapan data "Rekam jejak disiplin terverifikasi" — DUA cara:**

1. **Pegawai punya hukuman disiplin** → catat di **Master Data › Hukuman Disiplin** (tingkat, SK, status aktif).
2. **Pegawai tidak punya** → cukup centang **"Sudah diperiksa, tidak ada catatan hukuman disiplin"** di panel Integritas pada profilnya.

Keduanya memenuhi butir yang sama (bobot 3 dari 32 — sekitar 9,4 poin kesiapan data). **Jangan** mencentang verifikasi untuk pegawai yang sebenarnya punya hukuman: yang hilang bukan angkanya, tapi catatan yang justru paling perlu ada.

**Kalau catatan hukuman disiplin DIISI atau DIUBAH, skornya langsung menyesuaikan.** Sejak
25 Agustus 2026, menyimpan catatan di **Master Data › Hukuman Disiplin** ikut menghitung ulang
skor pegawai itu pada seluruh jabatan target aktif — tidak perlu menekan Hitung Ulang, dan
pesan suksesnya menyebutkan berapa jabatan target yang disesuaikan. Nilainya mengikuti tingkat
**terberat yang berstatus aktif**: Ringan 75 · Sedang 50 · Berat 25 · Sedang Menjalani 0 ·
tanpa catatan aktif 100. Pengaruhnya pada skor total = (100 − nilai) × 15%, jadi hukuman Berat
menurunkan **11,25 poin**.

Peran: sama dengan pengisian profil (Admin Talenta · Super Admin · Pengelola Unit untuk
pegawai di unitnya).

---

## 7 · Hitung Ulang

> Peran: **Admin Talenta**.

**Suksesi › Jabatan Target** → klik jabatan targetnya → tombol **Hitung Ulang** → konfirmasi.

**Yang dihasilkan:**

- skor per komponen + skor total per kandidat
- **rincian per indikator** — nilai mentah, kategori terpilih, skor, sumbernya
- kelayakan (lolos syarat / tidak)
- peringkat di talent pool
- salinan rubrik yang dipakai saat itu

**Yang seharusnya terlihat:** kolom "Dihitung terakhir" berubah, dan kolom Kandidat menunjukkan `lolos syarat / dinilai`.

### Kalau ada indikator yang datanya belum ada

Buka **profil pegawai › Kecocokan dengan jabatan target › Lihat rincian perhitungan** → tombol **Isi manual** pada indikator yang bersangkutan.

- **Pilih kategori** dari rubrik (nilainya tertera di sebelah namanya). Untuk indikator berambang angka (mis. Potkom), yang diminta angkanya.
- **Alasan & bukti wajib diisi** — dokumen/SK yang jadi dasarnya. Tersimpan bersama nama Anda.
- **Skornya langsung keluar**: skor indikator, skor total, dan peringkat pool ikut dihitung ulang saat itu.
- Nilai manual **tidak terhapus** oleh Hitung Ulang berikutnya.

Baris **Nilai Pengalaman Jabatan** tidak punya tombol Isi manual — ia rata-rata dari tiga sub-indikatornya. Isi sub-indikatornya, bukan induknya.

---

## 8 · Membaca nilai akhir

**Tiga tempat, tiga pertanyaan berbeda:**

| Halaman | Menjawab |
|---|---|
| `/jabatan-target/{id}/kandidat` | "siapa kandidat terbaik untuk jabatan ini, dan siapa yang lolos syarat" |
| **Talenta › Peta Talenta** | "bagaimana sebaran seluruh pegawai pada 9 kotak" |
| **profil pegawai** | "kenapa orang ini mendapat skor sebesar itu" — sampai per indikator |

**Cara membacanya, dan ini paling sering salah:**

- **Match score TIDAK memuat unsur kinerja.** Ketiga komponennya (Potensi & Kompetensi, Kualifikasi Jabatan, Integritas & Moralitas) semuanya milik sumbu **Potensial**. Karena itu halaman kandidat menampilkan **Kotak 9 dan predikat kinerja berdampingan** dengan skornya — keduanya wajib dibaca bersama.
- **Kelayakan terpisah dari skor.** Kandidat berskor tinggi bisa tidak lolos syarat, dan itu sah.
- **Tanda ⚠ pada indikator** berarti nilainya di luar rentang rubrik, kosong, atau dipotong — perlu ditinjau manusia, bukan berarti salah.

Di **Sebaran Kotak 9** (dashboard) dan **Peta Talenta**: klik satu kotak → daftar pegawainya muncul → klik namanya → profil lengkapnya.

**Membuka profil dari Talent Pool, Nominasi, atau Peta Talenta per jabatan target (25 Agustus 2026):** panel *Kecocokan dengan jabatan target* menampilkan **jabatan target yang sedang dibicarakan saja** — judulnya menyebut namanya, dan tautan **Tampilkan semua** membuka kembali seluruh daftarnya. Dari Direktori Pegawai atau Peta Talenta tanpa jabatan target, panelnya menampilkan seluruh jabatan target **aktif**.

> Di Peta Talenta, konteks itu ikut hanya kalau Anda sedang memilih satu jabatan target (kesiapan per jabatan) — sebab di keadaan itu sumbu Potensial-nya memang match score jabatan tersebut.

### Mengubah ambang Kotak 9 (Super Admin)

**Admin › Pengaturan Sistem** → `Ambang kategori teratas Kotak 9` (bawaan **80**) dan
`Ambang kategori tengah Kotak 9` (bawaan **60**). Batas bawah **inklusif**: nilai tepat
sama dengan ambang sudah masuk kategori itu.

Tiga hal yang perlu dipahami sebelum mengubahnya:

1. **Ambang atas harus lebih besar daripada ambang tengah.** Kalau tidak, kategori
   tengah jadi wilayah kosong dan setiap pegawai jatuh ke teratas atau terbawah.
   Sistem menolak penyimpanannya dan menjelaskan sebabnya.
2. **Tampilan per jabatan target langsung ikut berubah**, sebab kotaknya dihitung saat
   halaman dibuka.
3. **Sebaran organisasi TIDAK langsung berubah**, sebab ia membaca kotak yang sudah
   tersimpan pada data asesmen. Sesudah mengubah ambang, jalankan **Hitung Ulang** di
   tiap jabatan target. Sampai itu dilakukan, dua halaman bisa menempatkan orang yang
   sama di kotak berbeda — dan pesan sesudah menyimpan mengatakan ini.

---

## 9–11 · Suksesi

### 9. Ajukan nominasi — **Pengelola Unit** (juga Admin Talenta)

**Suksesi › Talent Pool** → pilih jabatan targetnya → temukan kandidatnya → **Ajukan nominasi**.

Kandidat yang lolos syarat tapi belum masuk daftar ada di panel **"Kandidat lolos syarat di luar pool"** → **Tambahkan ke pool**.

**Sejak 24 Agustus 2026 Pengelola Unit ikut melihat panel itu**, dengan satu batas: yang ditawarkan hanya **pegawai di unitnya**. Sebelumnya panel ini milik Admin Talenta & Super Admin saja, dan itu membuat alur usulan pincang — aksi **Ajukan nominasi** sudah mengizinkan Pengelola Unit tapi menuntut kandidatnya sudah ada di pool, sehingga unit tidak bisa memulai apa pun.

Yang dibatasi **orangnya**, bukan kursinya: unit tetap boleh mengusulkan pegawainya untuk jabatan target unit mana pun — suksesi memang sering memindahkan orang antar unit, dan nominasi mencatat unit pengaju secara terpisah.

### 10. Verifikasi — **Admin Talenta**

**Suksesi › Nominasi**. Penyaring **Tahap** di atas tabel; pilih **Menunggu verifikasi kepegawaian**.

Buka barisnya, lalu satu dari tiga:

| Aksi | Akibatnya |
|---|---|
| **Setujui verifikasi** | lanjut ke Pimpinan → tahap jadi *Menunggu approval Pimpinan* |
| **Minta revisi** | kembali ke unit pengaju → tahap jadi *Dikembalikan untuk revisi* |
| **Tolak nominasi** | selesai, ditolak |

**Pengelola Unit tidak bisa memverifikasi nominasi yang ia ajukan sendiri** — yang mengajukan dan yang memverifikasi wajib orang berbeda.

### 11. Tetapkan suksesor — **Pimpinan**

**Suksesi › Nominasi** → penyaring **Menunggu approval Pimpinan** → buka barisnya → **Tetapkan sebagai suksesor**.

**Yang seharusnya terlihat:** tahapnya jadi **Ditetapkan sebagai suksesor**, dan barisnya muncul di Talent Pool sebagai suksesor ditetapkan.

### Lima tahap & artinya

| Tahap | Menunggu siapa |
|---|---|
| Dikembalikan untuk revisi | unit pengaju |
| Menunggu verifikasi kepegawaian | Admin Talenta |
| Menunggu approval Pimpinan | Pimpinan |
| Ditetapkan sebagai suksesor | — selesai |
| Ditolak | — selesai |

Kolom **Giliran** menyebut siapa yang harus bertindak; kolom **Status** menyebut tahapnya. Keduanya memakai kosakata yang sama.

---

## 12 · Rencana pengembangan & ekspor

**Suksesi › Rencana Pengembangan** — untuk suksesor yang sudah ditetapkan, susun rencana pengembangannya (jenis, deskripsi, target selesai, status).

**Laporan › Gap Analysis** — indikator mana yang paling lemah di populasi, diurutkan dari rata-rata terendah. Hanya indikator **daun** yang dihitung, supaya anak-anaknya tidak terhitung dua kali.

**Laporan › Nominasi & Approval** — rekap per periode, unit, dan tahap approval.

**Laporan › Pusat Ekspor** — unduh CSV (tujuh jenis). Setiap unduhan tercatat di audit log: jenis, penyaring, dan jumlah baris — **isi datanya tidak**.

**Administrasi › Audit Log** — jejak semua mutasi: siapa, kapan, aksi, entitas. Termasuk peristiwa `RECOMPUTE` setiap kali Hitung Ulang dijalankan.

---

## Yang belum bisa dilakukan di prototipe ini

Supaya tidak dicari-cari:

- **Foto pegawai untuk 10 pegawai eNominasi** — belum ada berkasnya. 26 pegawai dari Excel Talent Pool ES 2/3 fotonya sudah tampil; sisanya menampilkan inisial.
- **Impor struktur organisasi dari Excel** — belum ada.
- **Unggah berkas** SK hukuman disiplin & arsip ijazah — belum ada.
- **Ekspor Excel (.xlsx) & PDF** — baru CSV.
- **Tombol sinkronisasi manual** dari UI — jalur eNominasi dijalankan lewat perintah, bukan tombol.
- **eHRM & eKinerja belum tersambung.** Riwayat sinkronisasi keduanya di halaman Konsolidasi adalah **data contoh**, dan halaman itu menandainya "Belum tersambung".
- **Populasi prototipe: 79 pegawai** — 26 dari `DATA TALENT POOL ES 2 & 3 LENGKAP.xlsx` (Eselon II & III) + 53 dari `TALENT POOL PENGAWAS#2 fix.xlsx` (Eselon IV). **10 pegawai eNominasi sudah dikeluarkan** atas permintaan pemilik proses (24 Agu 2026); bersama mereka ikut hilang seluruh alur nominasi & approval di data demo (9 entri talent pool, 3 nominasi, 6 approval log), jadi kartu "Daftar nominasi" dan "Terverifikasi" di dashboard sekarang 0. Cadangannya ada dan bisa dipulihkan. Pembatasan "hanya yang ada di eNominasi" (`HANYA_PEGAWAI_SUMBER`) **mati**; kalau dinyalakan sekarang, SELURUH 79 pegawai hilang dari semua halaman karena tak satu pun punya asesmen dari eNominasi.
- **26 pegawai Excel belum terkonfirmasi ada di eNominasi**, dan tidak bisa dikonfirmasi sekarang: **endpoint eNominasi sudah tidak dilayani**. Terbukti 22 Agu 2026 dengan membandingkan implementasi referensi resmi mereka — URL, metode, body, dan secret kita semuanya identik; server membalas 404 pada keempat varian path/metode dan mengirim `Set-Cookie: PHPSESSID` padahal referensi memakai `ci_session`. Yang dibutuhkan satu hal dari pengelola eNominasi: **alamat endpoint yang berlaku sekarang**. Sisi kita tidak perlu diubah.
