import { bakukanNamaJabatan, rumpunJabatan } from './jenis-jabatan'

/**
 * Klasifikasi sebuah NAMA jabatan menjadi kategori & jenjang — **usulan**, bukan
 * keputusan.
 *
 * Permintaan pemilik proses 2 Sep 2026, dua butir yang ternyata satu kebutuhan:
 *
 *   - *"penyesuaian lama jabatan pada jenjang saat ini masih belum sesuai …
 *     contoh Maul yang terbaca masa kerja kurang dari 2 tahun padahal pengalaman
 *     dia di jabatan pengawas (kasubag TU dan kepala Seksi) sudah hampir 10
 *     tahun"*;
 *   - *"tambahin filter riwayat jabatan per kategori jabatannya di perhitungan
 *     masing-masing pegawai … per kategori jabatan: fungsional, struktural,
 *     lainnya."*
 *
 * ## Kenapa keduanya satu masalah
 *
 * `nilaiLamaJabatan()` menjumlahkan riwayat yang **jenjangnya sama** dengan
 * jabatan sekarang, dan jenjang itu hanya diketahui kalau barisnya sudah
 * dipetakan ke master jabatan. Terukur di produksi: **36 dari 1.405** baris
 * riwayat yang terpetakan. Jadi untuk hampir semua orang perhitungannya jatuh ke
 * `tmt_jabatan` — tanggal SK terakhir — dan itu persis kasus Maul: lima baris
 * riwayat, semuanya `jabatan_id` NULL, sehingga 9 tahun pengalaman Pengawas
 * terbaca 0,89 tahun.
 *
 * ## Kenapa MENGUSULKAN, tidak menulis
 *
 * Nama riwayat adalah teks bebas dari sumber ("Kasi Pemeliharaan Jalan dan
 * Jembatan Dinas Pekerjaan Umum, …"), dan proyek ini sudah membayar mahal untuk
 * pelajaran yang sama: pencocokan samar `samaUnit()` 85% pernah menempelkan 56
 * jabatan ke unit yang salah tanpa satu pun galat. Aturannya sejak itu —
 * **pencocokan samar boleh MENGUSULKAN, tidak boleh MENULIS**. Modul ini karena
 * itu tidak menyentuh DB sama sekali; keputusannya tetap milik verifikator, lewat
 * ceklis yang diminta di butir kedua.
 *
 * Pola & alasan yang sama dengan `lib/kategori-riwayat.ts` untuk diklat.
 */

export const KATEGORI_JABATAN = ['STRUKTURAL', 'FUNGSIONAL', 'LAINNYA'] as const
export type KategoriJabatan = (typeof KATEGORI_JABATAN)[number]

/**
 * Jenjang struktural beserta eselonnya, ditulis persis seperti yang pemilik
 * proses sebutkan di PDF 2 Sep 2026 butir 3.
 */
export const JENJANG_STRUKTURAL = [
  { jenjang: 'JPT Pratama', eselon: 'II' },
  { jenjang: 'Administrator', eselon: 'III' },
  { jenjang: 'Pengawas', eselon: 'IV' },
] as const
export type JenjangStruktural = (typeof JENJANG_STRUKTURAL)[number]['jenjang']

/**
 * Rumpun → jenjang, DITURUNKAN dari daftar yang pemilik proses tulis sendiri:
 *
 *   - Pengawas (es IV)      : Kepala Sub Bagian Tata Usaha · Kepala Sub Bagian
 *                             Umum dan Tata Usaha · Kepala Seksi
 *   - Administrator (es III): Kepala Bagian · Kepala Sub Direktorat · Kepala Balai
 *   - JPT Pratama (es II)   : Direktur · Sekretaris Direktorat Jenderal
 *
 * Kuncinya `rumpunJabatan()`, bukan nama penuh: yang menentukan jenjang adalah
 * frasa depannya ("Kepala Seksi"), sementara ekornya menyebut bidang atau tempat
 * dan berbeda di tiap baris.
 */
const JENJANG_PER_RUMPUN: Record<string, JenjangStruktural> = {
  'kepala sub bagian': 'Pengawas',
  'kepala sub bidang': 'Pengawas',
  'kepala seksi': 'Pengawas',
  'kepala bagian': 'Administrator',
  'kepala bidang': 'Administrator',
  'kepala sub direktorat': 'Administrator',
  'kepala balai': 'Administrator',
  direktur: 'JPT Pratama',
  'direktur jenderal': 'JPT Pratama',
  'sekretaris direktorat jenderal': 'JPT Pratama',
}

/**
 * Singkatan lazim di riwayat jabatan yang sumbernya ketik bebas.
 *
 * "Kasi" dan "Kasubbag" TIDAK ada di master jabatan mana pun — master memakai
 * bentuk panjangnya. Tanpa daftar ini, empat dari lima baris riwayat Maul tidak
 * terklasifikasi, dan yang tersisa justru barisnya yang PLH.
 */
const SINGKATAN: Array<[RegExp, string]> = [
  [/^ka\.?\s?sub\.?\s?bag(ian)?\b\.?/i, 'Kepala Sub Bagian'],
  [/^kasubbag\b\.?/i, 'Kepala Sub Bagian'],
  [/^kasubdit\b\.?/i, 'Kepala Sub Direktorat'],
  [/^kasubbid\b\.?/i, 'Kepala Sub Bidang'],
  [/^kabag\b\.?/i, 'Kepala Bagian'],
  [/^kabid\b\.?/i, 'Kepala Bidang'],
  [/^kabalai\b\.?/i, 'Kepala Balai'],
  [/^kasi\b\.?/i, 'Kepala Seksi'],
  [/^kepala\s+subbagian\b/i, 'Kepala Sub Bagian'],
  [/^kepala\s+subdirektorat\b/i, 'Kepala Sub Direktorat'],
  [/^kepala\s+subbidang\b/i, 'Kepala Sub Bidang'],
]

/** Jenjang fungsional — ekor yang menyatakan tingkatnya. */
const EKOR_FUNGSIONAL =
  /\b(ahli\s+(utama|madya|muda|pertama)|penyelia|mahir|terampil|pemula)\b/i

/** Awalan penugasan sementara. Ditangkap supaya bisa DIPISAHKAN, bukan dibuang. */
const AWALAN_PENUGASAN = /^\s*(plt|plh)\.?\s*/i

export interface UsulanKategoriJabatan {
  kategori: KategoriJabatan
  /** Hanya untuk STRUKTURAL yang rumpunnya dikenali. */
  jenjang: JenjangStruktural | null
  eselon: 'II' | 'III' | 'IV' | null
  penugasan: 'DEFINITIF' | 'PLT' | 'PLH'
  /** Rumpun yang dipakai menyimpulkan — supaya usulannya bisa dibantah. */
  rumpun: string
}

/**
 * Usulkan kategori & jenjang dari nama jabatan apa adanya.
 *
 * Nama yang tidak dikenali jatuh ke `LAINNYA` dengan `jenjang: null` — **bukan**
 * ke salah satu jenjang sebagai tebakan. Yang tidak diketahui harus terlihat
 * tidak diketahui; menebak di sini berarti menambah masa kerja seseorang pada
 * jenjang yang tidak pernah ia jabat.
 */
export function usulkanKategoriJabatan(namaMentah: string): UsulanKategoriJabatan {
  const cocokPenugasan = AWALAN_PENUGASAN.exec(namaMentah)
  const penugasan =
    cocokPenugasan === null
      ? 'DEFINITIF'
      : (cocokPenugasan[1] ?? '').toLowerCase() === 'plt'
        ? 'PLT'
        : 'PLH'

  let nama = bakukanNamaJabatan(namaMentah.replace(AWALAN_PENUGASAN, ''))
  for (const [pola, ganti] of SINGKATAN) {
    if (pola.test(nama)) {
      nama = nama.replace(pola, ganti)
      break
    }
  }

  const rumpun = rumpunJabatan(nama)
  const kunci = rumpun.toLowerCase()

  // Fungsional diperiksa LEBIH DULU: "Pembina Jasa Konstruksi Ahli Madya" tidak
  // berawalan rumpun struktural mana pun, tapi "Kepala Balai … Ahli Muda" tidak
  // pernah ada — jadi urutan ini tidak bisa saling merebut.
  if (EKOR_FUNGSIONAL.test(nama)) {
    return { kategori: 'FUNGSIONAL', jenjang: null, eselon: null, penugasan, rumpun }
  }

  const jenjang = JENJANG_PER_RUMPUN[kunci] ?? null
  if (jenjang !== null) {
    const eselon = JENJANG_STRUKTURAL.find((j) => j.jenjang === jenjang)?.eselon ?? null
    return { kategori: 'STRUKTURAL', jenjang, eselon, penugasan, rumpun }
  }

  return { kategori: 'LAINNYA', jenjang: null, eselon: null, penugasan, rumpun }
}
