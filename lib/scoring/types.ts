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
