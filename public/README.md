# `public/` — aset merek yang disediakan operator

Dua aset di sini **tidak bisa dibuat oleh kode** dan karena itu tidak ikut di
repositori: lambang resmi Kementerian PU dan foto pegawai. Keduanya opsional —
aplikasi tetap terlihat utuh tanpa keduanya, bukan menampilkan kotak kosong atau
ikon gambar rusak.

Keberadaannya diperiksa **di server** ([`lib/aset-publik.ts`](../lib/aset-publik.ts)),
jadi tinggal menaruh berkasnya: dipakai di permintaan berikutnya, tanpa restart
dan tanpa menyunting komponen.

---

## 1. Lambang resmi — `logo-pu.svg` (opsional)

Lambang PU **sudah ada di dalam kode** ([`components/ui/logo-pu.tsx`](../components/ui/logo-pu.tsx),
path diporting dari v1) dan dipakai di sidebar, panel halaman masuk, header auth,
serta ikon tab. Jadi berkas di sini **tidak wajib**.

```
logo-pu.svg    ← menimpa lambang bawaan
logo-pu.png
logo-pu.webp
```

Gunanya: menimpa lambang bawaan tanpa menyunting kode — lambang instansi bisa
berubah, dan ketika itu terjadi jangan sampai perlu rilis kode. **SVG lebih
disukai:** lambangnya dirender dari 28px (sidebar) sampai 420px (watermark).

**Ikon tab (favicon) terpisah.** Next membacanya dari
[`app/icon.svg`](../app/icon.svg), bukan dari `public/`. Jadi setelah menaruh
lambang baru di sini, ganti berkas itu juga — dua tempat, sengaja: yang satu aset
operator, yang satu metadata build.

> **Catatan untuk yang membaca path-nya dan merasa ada yang salah:** monogramnya
> **memang mengisi penuh bidangnya** (bbox `25000×25000` di viewBox
> `25000×25000`, nol ruang kosong). Itu desainnya, bukan path terpotong. Jangan
> "perbaiki" viewBox-nya. Kalau butuh ruang kosong di sekelilingnya, beri padding
> pada wadahnya.

## 2. Foto latar halaman masuk — `masuk-latar.jpg`

```
masuk-latar.webp   ← paling disarankan (paling kecil)
masuk-latar.jpg
masuk-latar.jpeg
masuk-latar.png
```

Tanpa berkas ini, panel kiri menampilkan gradien navy bermerek dengan watermark
lambang — komposisi yang dirancang untuk berdiri sendiri. Aman dibiarkan tanpa
foto selamanya.

### Kepatuhan — baca sebelum memilih foto

Foto pegawai yang dapat diidentifikasi adalah **data pribadi** (UU PDP No.
27/2022 — [`doc/PRD.md`](../doc/PRD.md) §7.3). Halaman masuk bersifat
**pra-autentikasi**: siapa pun yang bisa menjangkau alamatnya bisa melihat foto
itu, termasuk dari luar jaringan internal.

Pakai foto yang memang disiapkan untuk publikasi — dokumentasi humas, foto
kegiatan resmi — dan yang subjeknya sudah menyetujui. **Jangan** foto dari berkas
kepegawaian, dan jangan foto yang ditemukan di `doc/`: berkas di sana dokumen
kerja internal.

### Teknis

| Hal | Anjuran | Alasan |
|---|---|---|
| Rasio | potret / kotak, tinggi ≥ lebar | panelnya kolom tinggi (46% lebar layar, setinggi viewport) |
| Ukuran piksel | ±1400×1800 | panel maksimal 46rem; lebih besar hanya menambah berat |
| Berat berkas | ≤ 400 KB | ini gambar pertama yang dimuat sebelum orang bisa bekerja |
| Komposisi | ruang lapang di **kiri bawah** | di situ judul & daftar butir diletakkan |
| Kontras | tidak perlu diukur | panel memasang scrim navy dua lapis, jadi teks tetap terbaca untuk foto terang maupun gelap |

Wajah sebaiknya **tidak** di kiri-bawah — bagian itu paling gelap tertutup scrim.
