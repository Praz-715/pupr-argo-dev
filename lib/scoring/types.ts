/**
 * Tipe rule engine penilaian talenta.
 *
 * Sengaja BEBAS dari tipe DB/Drizzle supaya bisa diuji murni dan dipakai sama
 * oleh server component, server action, job terjadwal, dan `api/v1`
 * (phase.md §5.1 aturan anti-duplikasi).
 */

export type Predikat = 'Sangat Baik' | 'Baik' | 'Butuh Perbaikan' | 'Kurang' | 'Sangat Kurang'

export type KategoriSumbuY = 'Di Atas Ekspektasi' | 'Sesuai Ekspektasi' | 'Di Bawah Ekspektasi'
export type KategoriSumbuX = 'Tinggi' | 'Menengah' | 'Rendah'

/**
 * Ambang klasifikasi kedua sumbu Kotak 9. Batas bawah inklusif: `>= atas` →
 * kategori teratas, `>= tengah` → tengah, sisanya terbawah.
 *
 * Berupa tipe, bukan konstanta, karena nilainya bisa diubah Super Admin lewat
 * `pengaturan_sistem`. Nilai bawaannya `AMBANG_SUMBU` di `konstanta.ts`.
 */
/**
 * Predikat kinerja → skor sumbu Y.
 *
 * Nilainya dari KERANGKA TALENT POOL (100/80/60/40/20) tapi **bisa diubah Super
 * Admin** lewat `pengaturan_sistem`, jadi ia dikirim sebagai argumen — bukan
 * dibaca dari konstanta modul. Kuncinya tetap kelima predikat resmi: yang boleh
 * diatur adalah skornya, bukan daftar predikatnya, sebab nama predikat datang
 * dari sumber (e-Kinerja / Excel) dan menambah satu nama di sini tidak membuat
 * sumbernya mengirimkannya.
 */
export type SkalaPredikat = Record<Predikat, number>

/**
 * Bobot Formula A: Nilai Talenta = kinerja×Y + potensial×X.
 *
 * Disimpan sebagai FRAKSI (0,5), bukan persen — supaya rumusnya terbaca sama
 * dengan dokumen. Halaman Pengaturan menyimpannya sebagai bilangan bulat persen
 * karena `pengaturan_sistem.nilai_min/max` bertipe INT; konversinya satu tempat,
 * di `bobotTalentaDari()`.
 */
export interface BobotTalenta {
  kinerja: number
  potensial: number
}

/**
 * Seluruh parameter skoring yang boleh diubah pengguna, dalam SATU objek.
 *
 * Dikumpulkan jadi satu supaya menambah parameter berikutnya adalah galat
 * kompilasi di tiap tempat yang menyusunnya — bukan argumen keempat yang
 * diam-diam kehilangan nilai di satu jalur. Tiga argumen terpisah yang harus
 * ditulis berurutan juga tempat tertukarnya dua angka bertipe sama.
 *
 * `lib/scoring` & `lib/importer` MENERIMA objek ini; keduanya tidak pernah
 * membaca DB. Yang mengambilnya dari `pengaturan_sistem` adalah
 * `parameterSkoringDari()` di `lib/pengaturan.ts`.
 */
export interface ParameterSkoring {
  ambang: AmbangSumbu
  skalaPredikat: SkalaPredikat
  bobotTalenta: BobotTalenta
}

export interface AmbangSumbu {
  atas: number
  tengah: number
}

export type Kotak9 = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9

export type Sumbu = 'Y_KINERJA' | 'X_POTENSIAL'

export type ModeSkor = 'KATEGORI_TETAP' | 'NILAI_LANGSUNG'

export type TingkatHukuman = 'Tidak Pernah' | 'Ringan' | 'Sedang' | 'Berat' | 'Sedang Menjalani'

export type StatusAsesmen = 'Berlaku' | 'Expired' | 'Draft'

/** Nilai mentah per indikator: angka (dicocokkan ke ambang) atau label kategori. */
export type NilaiMentah = number | string

/** Peta `rubrik_indikator.id` → nilai mentah pegawai untuk indikator tersebut. */
export type PetaNilai = Record<number, NilaiMentah | null | undefined>

export interface KategoriSkor {
  namaKategori: string
  /** null bila `mode_skor = NILAI_LANGSUNG` (skor = nilai mentah). */
  nilaiSkor: number | null
  /** null = tak berbatas di sisi itu. */
  ambangMin: number | null
  ambangMax: number | null
  urutan: number
}

export interface IndikatorNode {
  id: number
  namaIndikator: string
  /** null untuk sub-indikator → bobot dianggap sama rata (phase.md §2.5). */
  bobot: number | null
  modeSkor: ModeSkor
  /**
   * Skala MAKSIMUM nilai mentahnya, bila bukan 0–100.
   *
   * `null` = nilai mentahnya memang berskala 0–100 → perilaku lama persis.
   * Angka = skor dihitung `nilai / skalaMaks × 100`, sementara nilai mentahnya
   * TETAP disimpan & ditampilkan apa adanya.
   *
   * Ada karena Potkom berskala **0–150** (terukur: maksimum 147,92 di berkas
   * Fungsional, 143,23 di Pengawas — semuanya di bawah 150, tidak satu pun di
   * bawah 100 secara sistematis). Tanpa ini, `NILAI_LANGSUNG` memotongnya ke
   * 100 dan **setiap orang ber-potkom di atas 100 mendapat skor yang sama** —
   * daya bedanya hilang tepat di ujung atas, tempat kandidat terbaik berada.
   */
  skalaMaks: number | null
  urutan: number
  kategori: KategoriSkor[]
  /** Node dengan anak = agregator murni; `kategori` boleh kosong. */
  anak: IndikatorNode[]
}

export interface KomponenNode {
  id: number
  sumbu: Sumbu
  namaKomponen: string
  bobot: number
  urutan: number
  indikator: IndikatorNode[]
}

/** Alasan sebuah skor perlu ditinjau manusia. */
export type AlasanReview =
  | 'NILAI_KOSONG'
  | 'DI_LUAR_AMBANG'
  | 'KATEGORI_TIDAK_DIKENAL'
  | 'RUBRIK_KOSONG'
  | 'BOBOT_CAMPUR'
  | 'BOBOT_NOL'
  | 'NILAI_DI_CLAMP'

export interface CatatanReview {
  indikatorId: number | null
  namaIndikator: string
  alasan: AlasanReview
  keterangan: string
}

export interface HasilIndikator {
  indikatorId: number
  namaIndikator: string
  bobot: number | null
  /** Nilai mentah yang masuk (untuk `match_score_detail.nilai_mentah`). */
  nilaiMentah: NilaiMentah | null
  kategoriTerpilih: string | null
  skor: number
  perluReview: boolean
  anak: HasilIndikator[]
}

export interface HasilKomponen {
  komponenId: number
  namaKomponen: string
  sumbu: Sumbu
  bobot: number
  skor: number
  indikator: HasilIndikator[]
  perluReview: boolean
}

export interface HasilSumbu {
  sumbu: Sumbu
  skor: number
  komponen: HasilKomponen[]
  catatanReview: CatatanReview[]
  perluReview: boolean
}
