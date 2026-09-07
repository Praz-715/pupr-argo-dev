# Poin Revisi SIMT DJBK — 25 Agustus 2026

Lima butir revisi beserta kondisi saat ini, rencana penyelesaian, dan hal-hal yang
masih memerlukan keputusan Bapak/Ibu (butir 5 ditambahkan sore hari yang sama, atas
permintaan menyusul mengenai lama jabatan pejabat Eselon II & III). Setiap butir ditulis apa adanya, termasuk
bagian yang **belum dapat dijanjikan** karena datanya belum tersedia — supaya tidak
ada yang dianggap selesai padahal baru tampak selesai.

---

## 1. Penambahan jabatan target dipilih dari master jabatan, tidak diketik bebas

**Yang diminta.** Saat menambah jabatan target, pengguna memilih dari daftar master
jabatan dan unit organisasi yang sudah ada, bukan mengetik sendiri. Daftarnya harus
dapat dicari.

**Kondisi saat ini.** Formulir "Buat jabatan target" meminta **kode target** dan
**nama jabatan target** diisi manual. Akibatnya tiga hal:

1. nama jabatan target dapat berbeda dari nama resmi di master jabatan, sehingga dua
   sebutan untuk satu kursi hidup berdampingan tanpa ada yang menyadarinya;
2. kode target dapat bentrok atau terpotong tanpa peringatan;
3. jabatan target yang baru dibuat belum tertaut ke posisi mana pun sampai pengguna
   mengisi tab **Jabatan Anggota** secara terpisah — jika langkah itu terlewat,
   jabatan target tersebut tidak menunjuk kursi apa pun.

**Yang akan dikerjakan.** Formulir diganti menjadi **pemilih jabatan dari master**
dengan kolom pencarian. Pencarian mencakup nama jabatan, kode jabatan, dan nama unit
organisasi. Tiap pilihan menampilkan eselon, unit organisasi, status terisi/kosong,
serta keterangan apabila jabatan tersebut sudah dipakai jabatan target lain. Kode
target, nama target, dan jabatan anggotanya terisi otomatis dari master.

**Catatan.** Jalur "Jadikan draft" pada daftar jabatan kosong sudah bekerja seperti
ini sejak 24 Agustus 2026. Revisi ini menyamakan jalur penambahan manual dengan jalur
tersebut, sehingga hanya ada satu cara memilih kursi.

---

## 2. Jabatan target dibatasi pada daftar di lembar "Persyaratan Jabatan", beserta seluruh syarat minimalnya

**Yang diminta.** Jabatan target di aplikasi diisi hanya dengan jabatan yang tercantum
pada lembar **Persyaratan Jabatan** di `sample.xlsx`; sisanya dikeluarkan lebih dulu.
Seluruh persyaratan minimal pada lembar tersebut harus masuk ke aplikasi, dan seluruh
aspek penilaian diperhitungkan sesuai persentasenya.

**Delapan jabatan pada lembar tersebut** (sumber: PP 11/2017), beserta syarat
minimalnya:

| # | Jabatan | Pendidikan | Golongan | Pengalaman minimal |
|---|---|---|---|---|
| 1 | Direktur Pengadaan Jasa Konstruksi | S2 | IV/b | administrator atau JF Ahli Madya, paling singkat 2 tahun |
| 2 | Kasubdit Sistem Pengadaan Jasa Konstruksi | D4/S1 | III/d | pengawas atau JF Ahli Muda, paling singkat 3 tahun |
| 3 | Kasubdit Fasilitasi dan Kelembagaan Pengadaan Jasa Konstruksi | D4/S1 | III/d | pengawas atau JF Ahli Muda, paling singkat 3 tahun |
| 4 | Kasubdit Pengelolaan Katalog Elektronik | D4/S1 | III/d | pengawas atau JF Ahli Muda, paling singkat 3 tahun |
| 5 | Kasubdit Kontrak Konstruksi | D4/S1 | III/d | pengawas atau JF Ahli Muda, paling singkat 3 tahun |
| 6 | Kasubag TU | D4/S1 | III/b | pelaksana, paling singkat 4 tahun |
| 7 | Kepala Balai Pelaksana Pemilihan Jasa Konstruksi | D4/S1 | III/d | pengawas atau JF Ahli Muda, paling singkat 3 tahun |
| 8 | Kasubag Umum dan Tata Usaha | D4/S1 | III/b | pelaksana, paling singkat 4 tahun |

Kedelapan jabatan tersebut **seluruhnya sudah ada** di master jabatan aplikasi, dengan
catatan penamaan: "Kasubdit …" tercatat sebagai "Kepala Sub Direktorat …", dan
"Kasubag TU" sebagai "Kepala Sub Bagian Tata Usaha". Kolom **Bidang Pendidikan**
(sembilan rumpun, termasuk keterangan "semua jurusan") dan **Pelatihan** (Manajerial /
Teknis / Manajemen Umum) juga terbaca lengkap dan sudah punya tempat di aplikasi.

**Kondisi saat ini.** Aplikasi memuat **72 jabatan target** — 4 aktif dan 68 draft.
Sebagian besar lahir dari dua pekerjaan sebelumnya: impor struktur organisasi dari
Excel, dan permintaan agar jabatan Kepala Balai dibuat **per balai** (34 BP2JK + 7
BJKW) supaya kandidat dapat dicari untuk balai tertentu, bukan digeneralisir.
Persyaratan yang tersimpan sekarang sebagian masih berupa uraian bebas hasil
penyiapan awal, belum tabel resmi PP 11/2017 di atas.

**Yang akan dikerjakan.**

1. Jabatan target di luar delapan jabatan tersebut **dinonaktifkan**, tidak dihapus.
   Dinonaktifkan berarti tidak ikut dihitung dan tidak muncul di pemilih Peta Talenta,
   tetapi riwayat, skor, dan usulan yang pernah menunjuk ke sana tetap utuh dan dapat
   diaktifkan kembali kapan saja. Menghapusnya akan turut menghapus riwayat nominasi
   dan persetujuan yang tertaut — kerugian yang tidak dapat dibatalkan.
2. Persyaratan kedelapan jabatan diisi **dari tabel di atas**, per jabatan, mengganti
   uraian bebas yang ada sekarang: pendidikan minimal, bidang pendidikan, pelatihan,
   pengalaman, dan golongan.
3. **Golongan minimal ditambahkan sebagai jenis persyaratan baru.** Saat ini aplikasi
   belum mengenal jenis syarat "golongan", sehingga IV/b, III/d, dan III/b hanya
   dapat dicatat sebagai keterangan tanpa dapat diperiksa mesin. Data golongan pegawai
   sudah terisi (**78 dari 79** pegawai aktif), jadi begitu jenis syaratnya ada,
   pemeriksaannya langsung berjalan.

**Yang belum dapat dijanjikan sekarang, beserta alasannya.** Lembar tersebut menyebut
**durasi** pengalaman ("paling singkat 3 tahun"). Aplikasi baru dapat memeriksa
*jenjangnya* (pengawas/administrator), belum durasinya. Penyebabnya bukan rumus,
melainkan data riwayat jabatan: dari **670 baris** riwayat jabatan, **441 baris** punya
tanggal mulai, namun hanya **35 baris (5%)** yang sudah terpetakan ke master jabatan
sehingga jenjangnya dapat dibaca mesin. Bila durasi ditegakkan sekarang, hampir semua
kandidat akan berlabel "perlu verifikasi manual" — bukan karena tidak memenuhi syarat,
melainkan karena riwayatnya belum terbaca. **Usul kami:** syarat durasi ditampilkan
lengkap sebagai syarat yang harus diverifikasi manusia, dan pemeriksaan otomatisnya
menyusul setelah antrean pemetaan riwayat jabatan dikerjakan (antrean itu sudah ada di
menu Data & Kualitas).

**Mengenai persentase penilaian.** Bobot penilaian sudah mengikuti kerangka dan **sudah
diuji ulang terhadap lembar "Sample"** pada berkas yang sama: dua kandidat contoh
(Iwan dan Mardi) dihitung ulang oleh aplikasi dan hasilnya sama sampai selisih 0,006 —
selisih pembulatan, bukan selisih rumus. Rinciannya:

- **Potensi & Kompetensi 65%** — nilai potensi & kompetensi;
- **Kualifikasi Jabatan 20%** — Tingkat Pendidikan Formal 5% · Kesesuaian Bidang Ilmu
  5% · Pengembangan Kompetensi 5% · Nilai Pengalaman Jabatan 5% (rata-rata dari Lama,
  Keragaman, dan Substansi);
- **Integritas & Moralitas 15%** — verifikasi rekam jejak disiplin;
- Nilai Talenta = rata-rata nilai kinerja dan nilai di atas.

Satu hal yang perlu diketahui: **persyaratan minimal dan skor adalah dua hal berbeda.**
Persyaratan menentukan lolos/tidak lolos (gerbang kelayakan), sedangkan persentase di
atas menentukan peringkat. Kandidat berskor tinggi tetap dapat dinyatakan tidak lolos
syarat, dan itu memang perilaku yang benar.

---

## 3. Panel "Kecocokan dengan jabatan target" mengikuti konteks saat dibuka dari menu Suksesi

**Yang diminta.** Bila nama pegawai dibuka dari bagian Suksesi (Talent Pool atau
Nominasi), panel "Kecocokan dengan jabatan target" pada profilnya cukup menampilkan
jabatan target yang bersangkutan — jabatan yang pegawai tersebut dinominasikan
padanya.

**Kondisi saat ini.** Panel tersebut menampilkan **seluruh** jabatan target yang pernah
menghitung pegawai itu. Setelah jumlah jabatan target bertambah, daftarnya menjadi
panjang dan jabatan yang sedang dibicarakan justru tidak menonjol.

**Yang akan dikerjakan.** Tautan nama pegawai dari Talent Pool dan Nominasi membawa
konteks jabatan targetnya. Profil yang dibuka dari sana menampilkan jabatan target
tersebut lebih dulu, disertai keterangan singkat statusnya (kandidat / diverifikasi /
ditetapkan). Jabatan target lainnya tetap dapat dilihat lewat satu tautan "tampilkan
semua", sehingga informasi tidak hilang — hanya tidak lagi ikut memenuhi layar.
Profil yang dibuka dari Direktori Pegawai tetap menampilkan seluruhnya seperti
sekarang.

---

## 4. Integritas & rekam jejak disiplin: bawaan "tanpa catatan", disertai ceklis verifikasi

**Yang diminta.** Pada profil pegawai, bagian Integritas & rekam jejak disiplin
bawaannya cukup menyatakan tidak ada catatan, disertai ceklis untuk menyatakan bahwa
hal itu sudah diverifikasi.

**Kondisi saat ini.** Bila pegawai belum punya catatan disiplin, panel menampilkan
kotak peringatan berwarna dan lencana "Belum diverifikasi", serta mengarahkan pengguna
ke halaman Data Hukuman Disiplin. Untuk mayoritas pegawai yang memang tidak pernah
dijatuhi hukuman, tampilan itu terbaca seperti ada masalah pada datanya.

**Yang akan dikerjakan.**

1. Keadaan bawaan menjadi pernyataan netral: **"Tanpa catatan hukuman disiplin"**,
   tanpa kotak peringatan.
2. Di panel yang sama disediakan **ceklis verifikasi** — "sudah diperiksa, tidak ada
   catatan hukuman disiplin" — yang merekam **siapa** yang memverifikasi dan **kapan**,
   lalu ditampilkan sebagai keterangan pada panel tersebut. Pola yang sama sudah
   dipakai untuk validasi riwayat pegawai, jadi tampilannya konsisten.
3. Skor Integritas & Moralitas **tidak berubah** karena revisi ini. Ketiadaan catatan
   sudah dinilai 100 sejak awal; yang ditambahkan adalah jejak bahwa hal itu benar
   sudah diperiksa manusia, bukan sekadar diasumsikan. Perbedaan antara "belum
   diperiksa" dan "sudah diperiksa, hasilnya bersih" menjadi terlihat.

---

## 5. Lama jabatan pejabat Eselon II & III dimasukkan dari berkas Talent Pool

**Permintaan:** *"pegawai eselon 2 dan 3 lama jabatannya ambil data dari sini soalnya
blm masuk ke aplikasi"* — `DATA TALENT POOL ES 2 & 3 LENGKAP.xlsx`, kolom **MASA KERJA
JABATAN PENEMPATAN**.

**Sudah dikerjakan.** Seluruh **229 baris** riwayat jabatan milik **26 pejabat Eselon II
& III** kini memuat lama menjabatnya.

### Yang perlu Bapak/Ibu ketahui tentang bentuk datanya

Berkas tersebut memberi **lamanya** ("2 Tahun 7 Bulan"), tetapi **tidak memberi
tanggalnya**. Karena itu yang kami simpan adalah durasinya apa adanya — kami **tidak**
mengarang tanggal mulai/selesai dari durasi itu. Alasannya: begitu tanggal karangan
tersimpan, tidak ada lagi yang bisa membedakannya dari tanggal yang benar, termasuk
petugas yang memverifikasi. Di layar profil, baris seperti itu kini berbunyi
**"Lama 2,6 tahun · tanggal tidak ada di sumbernya"**, bukan lagi "tanggal belum ada –
sekarang" yang terbaca seolah jabatannya masih berjalan.

### Pengaruhnya terhadap penilaian — kecil, dan ini penjelasannya

Sebelum ini, indikator **Lama Jabatan** untuk ke-26 pejabat itu tidak dapat dihitung
dari riwayatnya sehingga semuanya jatuh ke kategori terendah ("kurang dari 2 tahun",
nilai 60). Sesudah datanya masuk:

| | Sebelum | Sesudah |
|---|---|---|
| Nilai 100 (≥5 tahun) | 0 | **2 pejabat** |
| Nilai 80 (2–5 tahun) | 0 | **3 pejabat** |
| Nilai 60 (<2 tahun) | 26 | 21 |

Pergeseran nilai akhirnya kecil — rata-rata **+0,03 poin**, paling besar **+0,67 poin**
pada satu orang — karena indikator ini berbobot 5% di dalam satu komponen. **Kelayakan
(lolos/tidak lolos syarat) tidak berubah sama sekali.**

Yang sesungguhnya diperbaiki bukan besar nilainya, melainkan **dasarnya**: nilai 60
yang sebelumnya berarti *"datanya tidak ada di aplikasi"* sekarang berarti *"berkasnya
memang menyebut kurang dari 2 tahun"*. Dua hal itu sebelumnya tidak bisa dibedakan.

### Satu selisih yang perlu diputuskan Bapak/Ibu

Untuk sebagian pejabat, **berkas dan tanggal SK menyebut lama yang berbeda**. Contoh
yang kami temukan: berkas Talent Pool menulis **2 Tahun 7 Bulan** untuk jabatan
sekarang, sementara TMT jabatan pada data kepegawaian (18-07-2025) menyiratkan **±1,1
tahun**.

Keduanya bisa benar sekaligus — TMT adalah tanggal SK **terakhir**, sehingga
pengangkatan ulang pada kursi yang sama memotongnya, sedangkan kolom berkas mengukur
periode jabatannya. Untuk sekarang aplikasi **mengutamakan angka dari berkas Talent
Pool** karena itu yang menjawab pertanyaan "berapa lama menjabat". Mohon dikonfirmasi
apakah pilihan itu tepat, atau TMT SK yang harus dipakai.

### Yang masih membatasi, dan cara menaikkannya

Agar indikator ini dinilai sepenuhnya benar, yang dibutuhkan bukan lagi data lamanya —
itu sudah ada — melainkan **penautan riwayat jabatan ke master jabatan** lewat menu
**Validasi Riwayat**. Aturannya "masa kerja **pada jenjang** jabatan", jadi selama
sistem belum mengetahui jenjang tiap baris riwayat, yang bisa dijumlahkan hanya lama
pada kursi yang sekarang — padahal beberapa pejabat sudah bertahun-tahun pada jenjang
yang sama di kursi yang berbeda-beda. Contohnya satu pejabat yang pernah menjabat Kepala
Balai di **tiga wilayah** (2 bulan · 2 tahun 3 bulan · 1 tahun 2 bulan) sebelum
jabatannya sekarang (2 tahun 7 bulan): keempatnya jenjang yang sama, dan dijumlahkan
menjadi **±6,2 tahun** — kategori tertinggi. Yang terhitung sekarang hanya 2 tahun 7
bulan, sehingga ia masuk kategori 2–5 tahun.

### Bisa diperbaiki sendiri dari aplikasi

Pada profil pegawai, dialog **Ubah riwayat jabatan** kini memiliki bidang **"Lama
menjabat (bulan)"**, dipakai bila tanggalnya tidak ada. Dengan begitu koreksi tidak
perlu menunggu impor ulang.

---

## Status pengerjaan — 25 Agustus 2026 (sesudah keputusan Bapak/Ibu masuk)

Kelima butir **sudah dikerjakan dan diperiksa**. Ringkasan hasilnya:

| # | Butir | Hasil |
|---|---|---|
| 1 | Penambahan jabatan target dari master | **Selesai.** Formulir bebas-teks dicabut; penambahan sekarang lewat pemilih berpencarian (nama jabatan · kode · unit organisasi), menampilkan eselon, unit, status terisi/kosong, serta keterangan bila jabatan itu sudah dipakai jabatan target lain. Kode & nama target dan jabatan anggotanya terisi otomatis dari master |
| 2 | Jabatan target dibatasi 8 jabatan lembar + seluruh syaratnya | **Selesai.** 8 jabatan aktif; 4 jabatan target lain dinonaktifkan (tidak dihapus). Tiap jabatan berisi 4 persyaratan (pendidikan · bidang pendidikan · **golongan** · pengalaman) + 4 kategori pelatihan. Golongan menggugurkan sesuai keputusan Bapak/Ibu — mis. Direktur Pengadaan (syarat IV/b): **18 dari 79** pegawai lolos, dan yang tidak lolos disertai alasan tertulis ("Golongan IV/a di bawah syarat minimal IV/b") |
| 3 | Panel Kecocokan mengikuti konteks | **Selesai.** Dibuka dari Talent Pool / Nominasi: dari **53 baris** menjadi **1 baris** — jabatan target yang bersangkutan — dengan judul yang menyebut namanya dan tautan "Tampilkan semua" bila ingin melihat seluruhnya |
| 4 | Integritas: bawaan tanpa catatan + ceklis verifikasi | **Selesai.** Kotak peringatan diganti pernyataan netral "Tanpa catatan hukuman disiplin"; ceklis "Sudah diperiksa" merekam siapa & kapan, bertahan setelah halaman dimuat ulang, dan bisa dibatalkan |
| 5 | Lama jabatan Eselon II & III dari berkas Talent Pool | **Selesai.** 229 baris riwayat milik 26 pejabat kini memuat lama menjabatnya; 5 di antaranya naik dari kategori terendah. Lamanya juga bisa disunting sendiri dari profil. Pergeseran nilai akhir kecil (rata-rata +0,03 poin) dan kelayakan tidak berubah — penjelasan lengkap di butir 5 |

**Keputusan Bapak/Ibu yang dijalankan apa adanya:** satu contoh per jabatan yang berulang antar daerah — Kepala Balai memakai **BP2JK Wilayah Sumatera Selatan** (kursinya kosong) dan Kasubag Umum & Tata Usaha memakai balai yang sama; golongan **menggugurkan**; jabatan target lain **dinonaktifkan**, dan persyaratannya **tetap bisa diisi manual dari aplikasi** kapan pun kursinya kosong.

**Dua hal yang kami putuskan sendiri dan perlu Bapak/Ibu ketahui:**

1. **Bidang pendidikan diisi "semua jurusan", bukan sembilan rumpun itu sebagai penyaring.** Sel aslinya menutup daftarnya dengan tulisan "(semua jurusan)", jadi memakai daftarnya sebagai penggugur akan menyatakan tidak lolos untuk orang yang menurut lembar itu sendiri memenuhi syarat. Kesembilan rumpun tetap tercatat utuh pada keterangan syaratnya, dan penilaian Kesesuaian Bidang Ilmu tetap memberi nilai lebih kepada yang sesuai — **menyaring dan menilai memang dua hal berbeda**. Bila yang dimaksud justru menyaring, cukup beri tahu kami: perubahannya satu baris per jabatan.
2. **Durasi pengalaman dicatat, belum ditegakkan otomatis** — alasannya data riwayat jabatan, seperti dijelaskan di butir 2 di atas. Di aplikasi ia tampil sebagai "min. 3 tahun" dan ditandai perlu verifikasi manusia, bukan diloloskan diam-diam.

---

## Hal yang memerlukan keputusan Bapak/Ibu

> **Keempat pertanyaan di bawah SUDAH DIJAWAB** dan jawabannya sudah dijalankan —
> bagian ini disimpan sebagai catatan keputusan, bukan sebagai pertanyaan terbuka.

1. **Kepala Balai Pelaksana Pemilihan Jasa Konstruksi — satu jabatan target atau 34?**
   Lembar Persyaratan Jabatan mencantumkannya sebagai **satu** baris, sedangkan
   permintaan sebelumnya adalah dibuat **per balai** agar kandidat dapat dicari untuk
   BP2JK Sumatera Selatan, BP2JK Kalimantan Utara, dan seterusnya.
   *Usul kami:* tetap **34 jabatan target per balai**, dengan persyaratan yang sama
   persis dari lembar tersebut — keduanya tidak bertentangan, sebab yang dibedakan
   hanya unit organisasinya. Hal yang sama berlaku untuk BJKW bila diperlukan.

2. **"Kasubag TU" dan "Kasubag Umum dan Tata Usaha" berlaku di unit mana saja?**
   Nama jabatan tersebut ada di **48 unit organisasi**, sedangkan lembar itu tidak
   menyebut unitnya.
   *Usul kami:* dibuatkan untuk lingkup yang menjadi contoh pada berkas tersebut lebih
   dulu — Direktorat Pengadaan Jasa Konstruksi dan balai-balai BP2JK — bukan 48
   sekaligus. Menambahkan sisanya nanti cukup satu langkah.

3. **Golongan minimal ditegakkan sebagai syarat yang menggugurkan, atau sebagai
   keterangan saja?** Bila menggugurkan, pegawai bergolongan di bawah syarat akan
   dinyatakan **tidak lolos** dan tidak muncul sebagai kandidat.
   *Usul kami:* **menggugurkan**, sesuai PP 11/2017 — dengan catatan penolakannya
   selalu menyebut alasannya, sehingga tidak ada kandidat yang hilang tanpa
   keterangan.

4. **Jabatan target yang tidak termasuk delapan jabatan tersebut: dinonaktifkan atau
   dihapus?**
   *Usul kami:* **dinonaktifkan**. Hasilnya di layar sama — tidak muncul, tidak
   dihitung — tetapi dapat dipulihkan, dan riwayat nominasi serta persetujuan yang
   tertaut tidak ikut hilang.

Selain itu, satu hal yang perlu kami sampaikan meski bukan bagian dari empat butir di
atas: **ambang penilaian pada empat indikator masih tertanam di dalam program**,
sehingga mengubah nilai kategorinya dari layar Pengaturan dapat membuat perhitungannya
tidak lagi sesuai. Kami mengusulkan hal ini dibereskan bersama revisi butir 2, karena
keduanya menyentuh bagian yang sama.
