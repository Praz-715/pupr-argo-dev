/**
 * Kode CATATAN pada profil pegawai — HDS · HDB · TBTL · TBS.
 *
 * Permintaan pemilik proses 2 Sep 2026 (`2 sept- masukan sistem informasi.pdf`
 * butir 1), ditegaskan susulan: *"biarin aja singkatan, yang penting user bisa
 * milih pilihan itu."*
 *
 * ## Kepanjangannya SENGAJA tidak ada di sini
 *
 * Bukan kelalaian: pemilik proses memutuskan kodenya dipakai apa adanya. Yang
 * mengikat dari keputusan itu — dan alasan catatan ini ditulis — adalah bahwa
 * aplikasi **tidak tahu artinya**, sehingga ia tidak boleh menurunkan apa pun
 * darinya:
 *
 *   - tidak menggeser skor (Integritas & Moralitas sudah punya masukannya sendiri
 *     lewat `hukuman_disiplin`; menghitung dua kali tidak bisa dijelaskan halaman
 *     mana pun),
 *   - tidak menggugurkan kelayakan,
 *   - **tidak diurutkan seolah berjenjang** — tidak ada dasar untuk menyatakan HDB
 *     "lebih berat" daripada TBS. Urutannya di UI mengikuti urutan yang pemilik
 *     proses tulis, dan itu urutan penulisan, bukan urutan bobot.
 *
 * Yang dilakukannya persis satu: **menandai**, supaya yang membaca direktori atau
 * daftar kandidat tahu baris itu perlu dilihat lagi.
 */

export const KATEGORI_CATATAN = ['HDS', 'HDB', 'TBTL', 'TBS'] as const
export type KategoriCatatan = (typeof KATEGORI_CATATAN)[number]

export function adalahKategoriCatatan(nilai: string): nilai is KategoriCatatan {
  return (KATEGORI_CATATAN as readonly string[]).includes(nilai)
}

/**
 * Batas panjang keterangan — sama dengan lebar kolomnya (`VARCHAR(500)`).
 *
 * Ditulis di sini supaya validasi Zod dan kolom DB tidak bisa berselisih diam-diam:
 * yang lebih longgar di aplikasi berakhir sebagai `ER_DATA_TOO_LONG` di tengah
 * penyimpanan, kegagalan yang sudah pernah terjadi di proyek ini pada
 * `jabatan_target_persyaratan.nilai_minimal`.
 */
export const MAKS_KETERANGAN_CATATAN = 500
