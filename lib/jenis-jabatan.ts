/**
 * Nama jabatan **generik** — "jabatan apa", tanpa "di mana".
 *
 * Permintaan pemilik proses 31 Agu 2026: daftar "Tambah jabatan" *"masih terlalu
 * spesifik … bikin lebih general aja jabatan apa aja yang bisa dinominasikan buat
 * jabatan target"*.
 *
 * ## Bentuk masalahnya, terukur
 *
 * Master memuat **211 jabatan**, tapi sebagian besarnya adalah kursi yang SAMA di
 * balai berbeda: 63 baris "Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah
 * …" dan 41 baris "Kepala Sub Bagian Umum dan Tata Usaha". Memilih dari daftar itu
 * berarti menggulir 63 baris yang bagi pembacanya adalah satu jabatan.
 *
 * Aturan di berkas ini melipatnya jadi **60 jenis**.
 *
 * ## Kenapa aturan yang diturunkan, bukan daftar lima nama
 *
 * Lampiran `koreksi sistem informasi.pdf` menyebut lima ("Kepala Balai, Kepala
 * Bagian, Kepala Sub Direktorat, Kepala Sub Bagian Tata Usaha, Kepala Seksi") dan
 * lembar **Persyaratan Jabatan** di `sample.xlsx` menyebut delapan. Keduanya CONTOH
 * yang tidak lengkap — daftarnya sendiri menyisakan baris nomor 9–12 kosong, dan
 * master memuat jenis yang tidak ada di keduanya (Kepala Bidang, jabatan fungsional).
 * Daftar yang dipaku akan salah pada jenis pertama yang belum terdaftar, dan
 * salahnya berupa jabatan yang "tidak ada di master" padahal ada.
 *
 * Aturan ini **diverifikasi terhadap lembar itu**, bukan menggantikannya: nama yang
 * dihasilkannya untuk kedua kursi balai — "Kepala Balai Pelaksana Pemilihan Jasa
 * Konstruksi" dan "Kepala Sub Bagian Umum dan Tata Usaha" — sama persis dengan baris
 * 7 & 8 lembar tersebut.
 *
 * ## Yang dibuang, dan hanya itu
 *
 * Hanya keterangan TEMPAT. Bukan pemendekan nama: "Kepala Seksi Pelaksanaan" tetap
 * utuh dan tidak dilebur jadi "Kepala Seksi", sebab "Kepala Seksi Pengadaan" adalah
 * kursi yang berbeda dan meleburnya berarti menyatukan dua jabatan yang persyaratannya
 * memang berbeda. Melipat terlalu jauh lebih berbahaya daripada tidak melipat: yang
 * pertama menyembunyikan perbedaan, yang kedua cuma merepotkan.
 */

/** Ejaan yang sama-arti — disatukan supaya satu kursi tidak jadi dua jenis. */
const EJAAN: Array<[RegExp, string]> = [
  [/\bSubdirektorat\b/gi, 'Sub Direktorat'],
  [/\bSubbagian\b/gi, 'Sub Bagian'],
  [/\bSubbidang\b/gi, 'Sub Bidang'],
  // Singkatan yang dipakai lembar Persyaratan Jabatan (`sample.xlsx`), supaya
  // mengetik "Kasubdit"/"Kasubag" menemukan jabatan yang master tulis panjang.
  [/\bKasubdit\b/gi, 'Kepala Sub Direktorat'],
  [/\bKasubbag\b/gi, 'Kepala Sub Bagian'],
  [/\bKasubag\b/gi, 'Kepala Sub Bagian'],
  [/\bKabag\b/gi, 'Kepala Bagian'],
  [/\bKasi\b/gi, 'Kepala Seksi'],
]

/**
 * Ekor yang menyatakan TEMPAT, bukan jabatan.
 *
 * Diurut dari yang paling spesifik. `Wilayah` menangkap sebagian besar kasus
 * ("… Wilayah I Aceh", "… Wilayah Sumatera Selatan"); dua sisanya menangkap
 * penulisan yang tidak memakai kata itu.
 */
const EKOR_TEMPAT: RegExp[] = [
  /*
    `Wilayah` harus DIIKUTI sesuatu untuk dianggap keterangan tempat.
    "…Wilayah Aceh" dibuang; "Kepala Balai Jasa Konstruksi Wilayah" TIDAK —
    di sana "Wilayah" bagian dari nama badannya (BJKW = Balai Jasa Konstruksi
    **Wilayah**), bukan penunjuk lokasi. Tanpa `\s+\S`, nama generik kepala BJKW
    terpangkas jadi "Kepala Balai Jasa Konstruksi" dan label kelompoknya
    menyebut nama yang tidak sama dengan isi kelompoknya.
  */
  /\s+Wilayah\s+\S.*$/i,
  /\s+BP2JK\b.*$/i,
  /\s*\(.*$/, // "(Bina Kompetensi)", "(Kerja Sama)" — pembeda unit, bukan jabatan
]

/** Rapatkan spasi & seragamkan ejaan, tanpa mengubah huruf besar-kecilnya. */
export function bakukanNamaJabatan(nama: string): string {
  let s = nama.replace(/\s+/g, ' ').trim()
  for (const [pola, ganti] of EJAAN) s = s.replace(pola, ganti)
  return s
}

/**
 * Nama generik sebuah jabatan — dipakai mengelompokkan daftar pilihan.
 *
 * Contoh:
 *   "Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Aceh"
 *     → "Kepala Balai Pelaksana Pemilihan Jasa Konstruksi"
 *   "Kepala Sub Bagian Umum dan Tata Usaha"  → tidak berubah (memang sudah generik)
 *   "Pembina Jasa Konstruksi Ahli Madya (Kerja Sama)"
 *     → "Pembina Jasa Konstruksi Ahli Madya"
 */
export function jenisJabatan(nama: string): string {
  let s = bakukanNamaJabatan(nama)
  for (const ekor of EKOR_TEMPAT) s = s.replace(ekor, '')
  const hasil = s.trim()
  // Kalau pemangkasan menghabiskan namanya (nama yang SELURUHNYA keterangan
  // tempat), kembalikan bentuk bakunya — jenis kosong akan menggabungkan
  // jabatan-jabatan yang tidak berhubungan ke dalam satu kelompok tanpa nama.
  return hasil === '' ? bakukanNamaJabatan(nama) : hasil
}

/** Kunci pembanding: `jenisJabatan()` yang dilumatkan besar-kecil & spasinya. */
export function kunciJenisJabatan(nama: string): string {
  return jenisJabatan(nama).toLowerCase()
}

/**
 * Kebalikan `jenisJabatan()`: ambil bagian yang menyatakan TEMPAT.
 *
 * Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 1):
 * *"Penamaan talent pool dan peta talenta sampai ketingkat belakangnya misalnya
 * kepala balai wilayah apa. Itu sudah ada di data tinggal tambahan."*
 *
 * Betul — dan itu akibat langsung revisi sebelumnya: nama jabatan digenerikkan,
 * jadi lima target Kepala Balai BP2JK kini bernama identik dan tidak terbedakan di
 * dropdown. Pembedanya ada di unitnya.
 *
 * ## Kenapa ekornya, bukan seluruh nama unit
 *
 * Nama unit lengkapnya "Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera
 * Selatan" — ditempel utuh, labelnya jadi 100+ karakter dan `<select>` satu baris
 * akan memotong justru bagian yang membedakannya. Pelajaran yang sama sudah dicatat
 * saat nama target per-balai dipendekkan (CLAUDE.md, 24 Agu 2026).
 *
 * Aturan pemotongnya SAMA dengan `EKOR_TEMPAT` di atas — satu definisi tentang
 * "bagian mana dari sebuah nama yang menyatakan tempat", dipakai dua arah. Kalau
 * ditulis terpisah, keduanya akan berselisih pada penulisan yang tidak lazim dan
 * yang terjadi bukan galat, melainkan label yang kehilangan pembedanya.
 *
 * `null` bila unitnya tidak punya keterangan tempat — pemanggilnya yang memutuskan
 * memakai nama unit apa adanya atau tidak menambahkan apa-apa.
 */
export function keteranganTempat(namaUnit: string): string | null {
  const s = bakukanNamaJabatan(namaUnit)
  for (const ekor of EKOR_TEMPAT) {
    const cocok = ekor.exec(s)
    if (cocok !== null && cocok[0].trim() !== '') return cocok[0].trim()
  }
  return null
}

/**
 * Label target yang bisa dibedakan: nama jabatan + tempat/unitnya.
 *
 *   ("Kepala Balai Pelaksana Pemilihan Jasa Konstruksi",
 *    "Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera Selatan", 1)
 *     → "Kepala Balai Pelaksana Pemilihan Jasa Konstruksi — Wilayah Sumatera Selatan"
 *
 * Target ber-anggota LEBIH DARI SATU unit tidak menyebut salah satunya: menyebut
 * yang pertama saja membuat label menyatakan sesuatu yang tidak benar untuk anggota
 * lainnya, dan itu lebih buruk daripada tidak menyebut tempat sama sekali.
 */
export function labelTargetDenganTempat(
  namaTarget: string,
  namaUnit: string | null,
  jumlahUnit = 1,
): string {
  if (jumlahUnit > 1) return `${namaTarget} — ${jumlahUnit} unit`
  if (namaUnit === null || namaUnit.trim() === '') return namaTarget
  return `${namaTarget} — ${keteranganTempat(namaUnit) ?? bakukanNamaJabatan(namaUnit)}`
}

// ---------------------------------------------------------------------------
// Rumpun jabatan — satu tingkat LEBIH KASAR daripada `jenisJabatan()`
// ---------------------------------------------------------------------------

/**
 * Frasa depan jabatan struktural, **diurut dari yang paling panjang**.
 *
 * Urutannya bukan gaya penulisan melainkan syarat kebenaran: "Kepala Sub
 * Direktorat Bakuan Kompetensi" cocok dengan `Kepala Sub Direktorat` maupun
 * `Kepala`, dan yang benar yang pertama. Daftar yang tidak terurut akan melipat
 * seluruh jabatan berawalan "Kepala" — 111 dari 211 baris master — jadi satu
 * rumpun tanpa daya beda.
 *
 * Diturunkan dari isi master (`SELECT DISTINCT nama_jabatan`), bukan dari daftar
 * di lampiran mana pun: lampiran `koreksi sistem informasi.pdf` menyebut lima dan
 * lembar Persyaratan Jabatan menyebut delapan, dan keduanya menyisakan baris
 * kosong — daftar yang dipaku akan salah pada rumpun pertama yang belum terdaftar.
 */
const RUMPUN_STRUKTURAL: string[] = [
  'Sekretaris Direktorat Jenderal',
  'Kepala Sub Direktorat',
  'Kepala Sub Bagian',
  'Kepala Sub Bidang',
  'Direktur Jenderal',
  'Kepala Bagian',
  'Kepala Bidang',
  'Kepala Balai',
  'Kepala Seksi',
  'Sekretaris',
  'Direktur',
  'Kepala',
]

/**
 * Jenjang jabatan FUNGSIONAL — ekor yang menyatakan tingkat, bukan bidangnya.
 *
 * "Pembina Jasa Konstruksi Ahli Madya" dan "… Ahli Muda" adalah pekerjaan yang
 * sama pada jenjang berbeda, jadi rumpunnya "Pembina Jasa Konstruksi". Jenjangnya
 * sendiri tidak hilang dari sistem — ia ada di kolom `jabatan.jenjang`.
 */
const JENJANG_FUNGSIONAL = /\s+(Ahli\s+(Utama|Madya|Muda|Pertama)|Penyelia|Mahir|Terampil|Pemula)\s*$/i

/**
 * Rumpun sebuah jabatan — *"kepala balai"*, bukan *"kepala balai apa"*.
 *
 * Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 4):
 * *"Filtrasi sesuai nama jabatan … cukup frasa depannya, jadi mengetik 'kepala
 * balai' langsung menjaring semua kepala balai."*
 *
 * ## Kenapa ini TIDAK menggantikan `jenisJabatan()`
 *
 * Keduanya melipat pada tingkat yang berbeda, dan keduanya diperlukan:
 *
 * ```
 * "Kepala Seksi Pelaksanaan"   jenisJabatan → "Kepala Seksi Pelaksanaan"
 *                              rumpunJabatan → "Kepala Seksi"
 * ```
 *
 * `jenisJabatan()` membuang keterangan TEMPAT dan tidak lebih — meleburnya lebih
 * jauh akan menyatukan "Kepala Seksi Pengadaan" dengan "Kepala Seksi Perbendaharaan",
 * dua kursi yang persyaratannya memang berbeda, dan itu ditolak dengan sengaja
 * ketika berkas ini dibuat. Rumpun dipakai untuk hal lain: **menyaring**, di mana
 * pelipatan kasar justru yang diminta — pengguna mengetik "kepala balai" dan ingin
 * melihat semuanya, lalu memilih sendiri dari situ.
 *
 * Jadi rumpun boleh kasar karena ia tidak pernah dipakai memutuskan bahwa dua
 * jabatan itu SAMA; ia hanya memutuskan keduanya layak muncul berdampingan.
 */
export function rumpunJabatan(nama: string): string {
  const s = jenisJabatan(nama)
  for (const r of RUMPUN_STRUKTURAL) {
    if (s.toLowerCase().startsWith(`${r.toLowerCase()} `) || s.toLowerCase() === r.toLowerCase()) {
      return r
    }
  }
  const tanpaJenjang = s.replace(JENJANG_FUNGSIONAL, '').trim()
  return tanpaJenjang === '' ? s : tanpaJenjang
}

/** Kunci pembanding rumpun: dilumatkan besar-kecil hurufnya. */
export function kunciRumpunJabatan(nama: string): string {
  return rumpunJabatan(nama).toLowerCase()
}
