/**
 * Kamus kategori riwayat: **mengusulkan**, bukan memutuskan.
 *
 * Sampai `doc/sql/014`, dua indikator rubrik disimpulkan dari teks bebas dengan
 * pencocokan kata kunci, dan hasilnya dipakai apa adanya sebagai angka. Yang
 * berubah bukan ada tidaknya pencocokan itu — pencocokan tetap perlu, karena
 * tidak ada yang mau mengetik 182 kategori dari nol — tapi **statusnya**: dulu
 * keputusan akhir yang tak terlihat, sekarang usulan yang harus dikonfirmasi
 * manusia dan jejaknya tercatat (`pemetaan_diklat.divalidasi_oleh`).
 *
 * Modul ini **murni & bebas DB** supaya bisa diuji tanpa database, dan supaya
 * normalisasi namanya punya SATU definisi. Kalau normalisasi hidup di dua tempat
 * — sekali di SQL saat benih antrian, sekali di TypeScript saat pemetaan — maka
 * `pemetaan_diklat` akan punya baris yang tidak pernah cocok dengan apa pun,
 * dan tampilannya adalah diklat yang "sudah divalidasi tapi tetap tidak dihitung".
 */

/** Jenis kompetensi PP 11/2017 Ps. 203 (+ FUNGSIONAL yang dipakai di lingkungan PU). */
export const JENIS_KATEGORI_DIKLAT = [
  'MANAJERIAL',
  'TEKNIS',
  'FUNGSIONAL',
  'SOSIAL_KULTURAL',
] as const
export type JenisKategoriDiklat = (typeof JENIS_KATEGORI_DIKLAT)[number]

export const STATUS_PEMETAAN = ['USULAN', 'TERVALIDASI', 'DITOLAK'] as const
export type StatusPemetaan = (typeof STATUS_PEMETAAN)[number]

export const JENIS_PENUGASAN = ['DEFINITIF', 'PLT', 'PLH'] as const
export type JenisPenugasan = (typeof JENIS_PENUGASAN)[number]

/** Satu baris `master_kategori_riwayat_diklat`, sebatas yang dipakai pencocokan. */
export interface KategoriDiklat {
  id: number
  kode: string
  nama: string
  jenis: JenisKategoriDiklat
  parentId: number | null
  setaraJenjang: 'II' | 'III' | 'IV' | null
  polaCocok: string[]
}

/**
 * Nama diklat → bentuk pembanding.
 *
 * eHRM mengirim `"Diklat PIM IV"`, `"DIKLAT PIM  IV"`, dan `"diklat pim iv."`
 * sebagai tiga string berbeda untuk satu diklat yang sama. Tanpa ini kamusnya
 * tumbuh jadi daftar ejaan, bukan daftar diklat, dan orang yang sama memvalidasi
 * hal yang sama berulang kali.
 *
 * Yang dilakukan: huruf kecil, tanda baca jadi spasi, spasi rangkap dipadatkan.
 * Angka Romawi & Arab **tidak** disatukan di sini — `PIM III` dan `PIM 3` tetap
 * dua baris kamus. Itu disengaja: menyatukannya menuntut tahu bahwa `3` di situ
 * berarti tingkat, sedangkan di `"Diklat Dasar 3 Hari"` tidak. Keduanya tetap
 * bertemu di kategori yang sama lewat `polaCocok`, jadi tidak ada yang hilang —
 * yang bertambah cuma satu baris antrian yang perlu dikonfirmasi sekali.
 */
export function normalisasiNamaDiklat(nama: string): string {
  return nama
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
}

export interface UsulanKategori {
  kategoriId: number
  kode: string
  /** Pola yang memicu usulan — ditampilkan supaya pemeriksa tahu SEBABNYA. */
  alasan: string[]
}

/**
 * Usulkan kategori untuk satu nama diklat.
 *
 * Mengembalikan **seluruh** kategori yang polanya cocok, bukan satu yang
 * "terbaik". Satu diklat memang bisa masuk dua kategori (`"Diklat Pengadaan
 * Barang/Jasa dan Hukum Kontrak"`), dan lebih penting: memilih otomatis di
 * antara dua yang cocok berarti mesin mengambil keputusan yang justru sedang
 * dipindahkan ke manusia. Pemeriksa melihat keduanya beserta alasannya.
 *
 * Kategori rumpun (yang punya turunan) **tidak** diusulkan kalau salah satu
 * turunannya cocok — mengusulkan "Pelatihan Manajerial" berdampingan dengan
 * "Diklat PIM IV" hanya menambah pilihan yang selalu kalah.
 */
export function usulkanKategoriDiklat(
  nama: string,
  master: readonly KategoriDiklat[],
): UsulanKategori[] {
  const normal = normalisasiNamaDiklat(nama)
  if (normal === '') return []

  const cocok: UsulanKategori[] = []
  for (const k of master) {
    const alasan = k.polaCocok.filter((p) => {
      const pola = normalisasiNamaDiklat(p)
      return pola !== '' && normal.includes(pola)
    })
    if (alasan.length > 0) cocok.push({ kategoriId: k.id, kode: k.kode, alasan })
  }

  const punyaTurunan = new Set(
    master.filter((k) => k.parentId !== null).map((k) => k.parentId as number),
  )
  const idCocok = new Set(cocok.map((c) => c.kategoriId))
  const adaTurunanYangCocok = (id: number) =>
    master.some((k) => k.parentId === id && idCocok.has(k.id))

  return cocok.filter((c) => !(punyaTurunan.has(c.kategoriId) && adaTurunanYangCocok(c.kategoriId)))
}

const POLA_PLT = /\b(plt|pelaksana tugas)\b/i
const POLA_PLH = /\b(plh|pelaksana harian)\b/i

/**
 * Kata yang membuat "Pelaksana Tugas" BUKAN penugasan jabatan.
 *
 * `"Pelaksana Tugas Belajar"` cocok dengan regex Plt padahal itu tugas belajar,
 * dan regex di `lib/penilaian.ts` akan menaikkan skor Substansi orang itu ke 80
 * atau 100 tanpa satu pun tanda kekeliruan.
 *
 * **Penjagaan ini belum pernah terpicu oleh data sungguhan:** di `pupr_dev`
 * frasa itu nol kejadian (82 baris riwayat jabatan, 1 Plt + 1 Plh). Jadi ia
 * bersifat antisipatif, bukan perbaikan atas bug yang teramati — dan karena
 * begitu, ia juga belum terbukti benar terhadap ejaan yang dipakai eHRM
 * sesungguhnya. Yang membuatnya tetap layak ada: akibatnya kalau salah bukan
 * galat, melainkan skor yang wajar dan keliru.
 */
const PENGECUALIAN_PLT = [/\btugas belajar\b/i, /\bpelaksana tugas belajar\b/i]

export interface UsulanPenugasan {
  jenis: JenisPenugasan
  /** `false` bila usulannya lemah — pemeriksa perlu melihat baris ini lebih dulu. */
  yakin: boolean
  alasan: string
}

/**
 * Usulkan jenis penugasan dari teks jabatan mentah.
 *
 * Sengaja TIDAK dipakai langsung oleh perhitungan skor. Ia mengisi antrian
 * pemeriksaan; yang dipakai skor adalah `riwayat_jabatan.jenis_penugasan` yang
 * sudah berisi keputusan manusia.
 */
export function usulkanJenisPenugasan(jabatanNamaMentah: string): UsulanPenugasan {
  const teks = jabatanNamaMentah ?? ''
  const dikecualikan = PENGECUALIAN_PLT.some((p) => p.test(teks))

  if (POLA_PLT.test(teks)) {
    return dikecualikan
      ? {
          jenis: 'DEFINITIF',
          yakin: false,
          alasan:
            'Memuat "Pelaksana Tugas" tetapi juga "tugas belajar" — kemungkinan besar bukan penugasan jabatan. Perlu diperiksa.',
        }
      : { jenis: 'PLT', yakin: true, alasan: 'Memuat "Plt"/"Pelaksana Tugas".' }
  }
  if (POLA_PLH.test(teks)) {
    return { jenis: 'PLH', yakin: true, alasan: 'Memuat "Plh"/"Pelaksana Harian".' }
  }
  return {
    jenis: 'DEFINITIF',
    yakin: true,
    alasan: 'Tidak memuat penanda Plt maupun Plh.',
  }
}

/**
 * Apakah kumpulan kategori tervalidasi seseorang memenuhi syarat pelatihan
 * sebuah jabatan target?
 *
 * **Gagal tertutup:** diklat yang belum dipetakan tidak dihitung. Arah
 * sebaliknya — menganggap yang belum diperiksa sebagai memenuhi — menaikkan skor
 * orang yang datanya paling berantakan, persis kebalikan dari yang dimaksud.
 *
 * `syaratKode` kosong berarti jabatan target itu belum menetapkan syarat
 * pelatihan; hasilnya `true` (tidak ada yang dilanggar), tapi `tanpaSyarat`
 * menandainya supaya UI tidak menampilkannya sebagai "memenuhi syarat" seolah
 * ada syarat yang dilewati.
 */
export function penuhiSyaratPelatihan(
  kategoriDimiliki: readonly string[],
  syaratKode: readonly string[],
): { memenuhi: boolean; kurang: string[]; tanpaSyarat: boolean } {
  if (syaratKode.length === 0) return { memenuhi: true, kurang: [], tanpaSyarat: true }
  const dimiliki = new Set(kategoriDimiliki)
  const kurang = syaratKode.filter((k) => !dimiliki.has(k))
  return { memenuhi: kurang.length === 0, kurang, tanpaSyarat: false }
}
