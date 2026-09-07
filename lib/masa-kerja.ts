/**
 * Baca lama jabatan yang datang sebagai **teks berbahasa Indonesia** — "2 Tahun
 * 7 Bulan", "2 bulan", "0 Tahun 0 Bulan 11 Hari" — menjadi jumlah bulan.
 *
 * ## Kenapa ada, dan kenapa BULAN yang disimpan
 *
 * Berkas `DATA TALENT POOL ES 2 & 3 LENGKAP.xlsx` memberi lama tiap jabatan pada
 * kolom **MASA KERJA JABATAN PENEMPATAN**, tapi **tidak memberi tanggalnya**.
 * Terukur: 229 baris riwayat jabatan milik 26 pegawai eselon II & III, seluruhnya
 * bermasa-kerja terisi dan **nol** bertanggal.
 *
 * Akibatnya di aplikasi sebelum kolom ini ada: `nilaiLamaJabatan()` tidak menemukan
 * riwayat bertanggal, jatuh ke `tmt_jabatan` (hanya jabatan TERAKHIR), dan ke-26
 * pegawai itu mendapat kategori terendah — "masa kerja dalam jenjang jabatan kurang
 * dari 2 tahun", skor 60.
 *
 * **Sesudah durasinya masuk, 5 dari 26 naik dari kategori terendah** (2 → 100 · 3 →
 * 80); 21 sisanya tetap 60. Angka itu ditulis di sini karena ia mengoreksi dugaan
 * saya sendiri: saya menulis "padahal sebagiannya belasan tahun di jenjang itu"
 * sebelum mengukurnya, sementara sumbernya justru menyebut **±1 tahun** di kursi
 * sekarang untuk sebagian besar mereka (durasi belasan tahunnya ada di baris riwayat
 * LAMA, bukan yang sekarang). Jadi yang diperbaiki kolom ini bukan besar skornya,
 * melainkan **dasarnya**: 60 yang sebelumnya berarti "datanya tidak ada" sekarang
 * berarti "sumbernya memang menyebut kurang dari 2 tahun" — dua hal yang tidak bisa
 * dibedakan sebelum ini.
 *
 * **Yang disimpan durasinya, bukan tanggal yang dikarang.** Menurunkan
 * `tanggal_mulai` dari "2 Tahun 7 Bulan" berarti membuat tanggal yang tidak pernah
 * ada di sumber mana pun — dan sesudah tersimpan, tidak ada lagi yang bisa
 * membedakannya dari tanggal sungguhan. Durasi adalah tepat apa yang sumbernya
 * berikan, tidak lebih.
 *
 * ## Bentuk yang ditemui di berkas nyata (semuanya diuji)
 *
 *   "2 Tahun 7 Bulan"              → 31
 *   "2 bulan"                      → 2     (tanpa komponen tahun, huruf kecil)
 *   "0 Tahun 0 Bulan 11 Hari"      → 0     (hari DIBUANG, lihat di bawah)
 *   "1 Tahun"                      → 12
 *   ""                             → null  (tidak diketahui, BUKAN nol)
 *
 * **Hari sengaja dibuang, tidak dibulatkan.** Kategori rubrik Lama Jabatan
 * berambang TAHUN (≥5 · ≥2 · <2), jadi 11 hari tidak pernah mengubah kategori mana
 * pun; membulatkannya ke atas justru bisa menaikkan "0 bulan" jadi "1 bulan" dan
 * menambah bulan yang tidak ada di sumbernya.
 *
 * **`null` bukan 0.** Nol berarti "baru menjabat"; `null` berarti "sumbernya tidak
 * memberi tahu". Menyamakannya membuat baris yang belum diisi ikut menurunkan
 * skor — kelas kesalahan yang sama dengan `hukumanDisiplin` kosong yang dulu
 * dianggap "tidak pernah dihukum".
 */

/** Jumlah bulan dari teks masa kerja. `null` = tidak terbaca / kosong. */
export function uraiMasaKerjaBulan(teks: string | null | undefined): number | null {
  if (teks === null || teks === undefined) return null
  const bersih = String(teks).trim()
  if (bersih === '') return null

  /*
    Dicari per SATUAN, bukan dengan satu pola kaku "<n> Tahun <n> Bulan": berkasnya
    memuat "2 bulan" (tanpa tahun), "1 Tahun" (tanpa bulan), dan "0 Tahun 0 Bulan
    11 Hari" (bertambah hari) di kolom yang sama. Pola kaku akan menolak dua di
    antaranya dan mengembalikan null untuk data yang sebenarnya terbaca.
  */
  const tahun = /(\d+)\s*tahun/i.exec(bersih)
  const bulan = /(\d+)\s*bulan/i.exec(bersih)
  if (tahun === null && bulan === null) return null

  const n = (m: RegExpExecArray | null): number => (m === null ? 0 : Number(m[1]))
  const total = n(tahun) * 12 + n(bulan)
  // Angka yang tidak mungkin (mis. salah baca kolom) ditolak, bukan disimpan:
  // 100 tahun masa kerja pada satu jabatan berarti kolomnya bukan masa kerja.
  return total >= 0 && total <= 1200 ? total : null
}

/** Bulan → tahun desimal 2 angka. `null` tetap `null`. */
export function bulanKeTahun(bulan: number | null | undefined): number | null {
  if (bulan === null || bulan === undefined) return null
  return Math.round((bulan / 12) * 100) / 100
}
