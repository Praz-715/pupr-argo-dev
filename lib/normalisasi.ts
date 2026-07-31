/**
 * Normalisasi nilai kategorikal dari sistem sumber (eHRM/eNominasi/eKinerja).
 *
 * Dipakai oleh `lib/importer` (Fase 4) DAN oleh lapisan tampilan/agregasi —
 * jangan `toLowerCase()` ad-hoc di komponen, karena hasil grouping harus sama
 * di mana pun (phase.md §6, CLAUDE.md §1).
 */

export type TingkatPendidikan = 'SLTA' | 'D3' | 'S1_D4' | 'S2' | 'S3'

/** Urutan jenjang untuk perbandingan syarat "pendidikan minimal". */
export const URUTAN_PENDIDIKAN: Record<TingkatPendidikan, number> = {
  SLTA: 1,
  D3: 2,
  S1_D4: 3,
  S2: 4,
  S3: 5,
}

/**
 * Golongan diseragamkan ke format GARIS MIRING (`IV/b`), karena mayoritas data
 * sudah begitu. Sumber campur: `IV.b`, `IV b`, `iv/B`.
 */
export function normalisasiGolongan(mentah: string | null | undefined): string | null {
  if (!mentah) return null
  const bersih = mentah.trim().replace(/\s+/g, ' ')
  if (bersih === '') return null

  const cocok = bersih.match(/^(IV|III|II|I)\s*[./\s-]\s*([a-eA-E])$/i)
  if (!cocok) return bersih.toUpperCase()

  const romawi = cocok[1]!.toUpperCase()
  const huruf = cocok[2]!.toLowerCase()
  return `${romawi}/${huruf}`
}

/**
 * Jenis asesmen: seragamkan kapitalisasi + peta istilah lama → terkini.
 * Sumber pernah mengirim `PENGAWAS` (kapital) dan `JPT Pertama` (istilah lama
 * untuk `JPT Pratama`).
 */
const PETA_JENIS_ASESMEN: Record<string, string> = {
  'jpt pertama': 'JPT Pratama',
  'jpt pratama': 'JPT Pratama',
  'jpt madya': 'JPT Madya',
  administrator: 'Administrator',
  pengawas: 'Pengawas',
  pelaksana: 'Pelaksana',
  'jft pertama': 'JFT Pertama',
  'jft muda': 'JFT Muda',
  'jft madya': 'JFT Madya',
  'jft utama': 'JFT Utama',
}

export function normalisasiJenisAsesmen(mentah: string | null | undefined): string | null {
  if (!mentah) return null
  const kunci = mentah.trim().replace(/\s+/g, ' ').toLowerCase()
  if (kunci === '') return null
  return PETA_JENIS_ASESMEN[kunci] ?? judulKata(mentah)
}

/** "SISTEM DAN TEKNIK TRANSPORTASI" → "Sistem dan Teknik Transportasi" */
const KATA_KECIL = new Set(['dan', 'atau', 'di', 'ke', 'dari', 'pada', 'untuk', 'yang', 'the', 'of'])

export function judulKata(mentah: string | null | undefined): string {
  if (!mentah) return ''
  return mentah
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .split(' ')
    .map((kata, i) => {
      if (i > 0 && KATA_KECIL.has(kata)) return kata
      // pertahankan singkatan pendek seperti "tu", "bp2jk" → huruf awal saja
      return kata.length > 0 ? kata[0]!.toUpperCase() + kata.slice(1) : kata
    })
    .join(' ')
}

const PREFIKS_PENDIDIKAN: Array<{ pola: RegExp; jenjang: TingkatPendidikan }> = [
  { pola: /^(s\s*-?\s*3|s3|doktor|dr\.?)\b/i, jenjang: 'S3' },
  { pola: /^(s\s*-?\s*2|s2|magister|master)\b/i, jenjang: 'S2' },
  { pola: /^(s\s*-?\s*1|s1|d\s*-?\s*iv|div|d4|sarjana)\b/i, jenjang: 'S1_D4' },
  { pola: /^(d\s*-?\s*iii|diii|d3|diploma\s*3)\b/i, jenjang: 'D3' },
  { pola: /^(slta|sma|smk|stm|sltp)\b/i, jenjang: 'SLTA' },
]

export interface PendidikanTerurai {
  jenjang: TingkatPendidikan | null
  bidangStudi: string | null
  /** true bila jenjang tidak bisa ditentukan → masuk Antrian Pembersihan Data. */
  perluReview: boolean
}

/**
 * Data contoh menyimpan riwayat pendidikan sebagai SATU teks:
 *   "S2 SISTEM DAN TEKNIK TRANSPORTASI" → { S2, "Sistem dan Teknik Transportasi" }
 * Formatnya tidak seragam ("DIII ...", "S1 FIS ADMINISTRASI"), jadi yang gagal
 * diparse ditandai, bukan dibuang (phase.md §6 no. 10).
 */
export function parsePendidikan(mentah: string | null | undefined): PendidikanTerurai {
  if (!mentah || mentah.trim() === '') {
    return { jenjang: null, bidangStudi: null, perluReview: true }
  }

  const teks = mentah.trim().replace(/\s+/g, ' ')

  for (const { pola, jenjang } of PREFIKS_PENDIDIKAN) {
    const cocok = teks.match(pola)
    if (cocok) {
      const sisa = teks.slice(cocok[0].length).replace(/^[\s.:/-]+/, '')
      return {
        jenjang,
        bidangStudi: sisa === '' ? null : judulKata(sisa),
        perluReview: sisa === '',
      }
    }
  }

  return { jenjang: null, bidangStudi: judulKata(teks), perluReview: true }
}

/**
 * Parser TMT multi-format. Sumber campur:
 *   "01 April 2024/ Pembina Tk.I"  (tanggal panjang + pangkat digabung)
 *   "1-Apr-23"                      (short date)
 *   "01 Agustus 2025"
 *   "2025-07-18"
 * Yang gagal diparse mengembalikan null + perluReview, BUKAN NULL senyap
 * (phase.md §6 no. 6).
 */
const NAMA_BULAN: Record<string, number> = {
  jan: 1, januari: 1,
  feb: 2, februari: 2, pebruari: 2,
  mar: 3, maret: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6,
  jul: 7, juli: 7,
  agu: 8, agt: 8, agustus: 8, aug: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oct: 10, oktober: 10,
  nov: 11, november: 11,
  des: 12, dec: 12, desember: 12,
}

export interface TmtTerurai {
  tanggal: Date | null
  /** Teks tambahan setelah tanggal, mis. pangkat yang ikut tertempel. */
  sisaTeks: string | null
  perluReview: boolean
}

export function parseTmt(mentah: string | null | undefined): TmtTerurai {
  if (!mentah || mentah.trim() === '') {
    return { tanggal: null, sisaTeks: null, perluReview: true }
  }

  const teks = mentah.trim().replace(/\s+/g, ' ')
  // Buang bagian setelah "/" (biasanya pangkat yang ikut tertempel)
  const [bagianTanggal, ...bagianSisa] = teks.split('/')
  const kandidat = (bagianTanggal ?? '').trim()
  const sisaTeks = bagianSisa.length > 0 ? bagianSisa.join('/').trim() : null

  // ISO: 2025-07-18
  const iso = kandidat.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (iso) {
    return jadikanTanggal(Number(iso[1]), Number(iso[2]), Number(iso[3]), sisaTeks)
  }

  // "18 Juli 2025" / "18 Jul 2025" / "1-Apr-23"
  const teksBulan = kandidat.match(/^(\d{1,2})[\s.-]+([A-Za-z]+)[\s.-]+(\d{2,4})$/)
  if (teksBulan) {
    const bulan = NAMA_BULAN[teksBulan[2]!.toLowerCase()]
    if (bulan) {
      let tahun = Number(teksBulan[3])
      if (tahun < 100) tahun += tahun <= 40 ? 2000 : 1900
      return jadikanTanggal(tahun, bulan, Number(teksBulan[1]), sisaTeks)
    }
  }

  // "18/07/2025" — hanya tercapai kalau tidak ada bagian pangkat
  const angka = teks.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/)
  if (angka) {
    return jadikanTanggal(Number(angka[3]), Number(angka[2]), Number(angka[1]), null)
  }

  return { tanggal: null, sisaTeks: teks, perluReview: true }
}

function jadikanTanggal(
  tahun: number,
  bulan: number,
  hari: number,
  sisaTeks: string | null,
): TmtTerurai {
  if (bulan < 1 || bulan > 12 || hari < 1 || hari > 31) {
    return { tanggal: null, sisaTeks, perluReview: true }
  }
  const d = new Date(tahun, bulan - 1, hari, 12, 0, 0, 0)
  const valid = d.getFullYear() === tahun && d.getMonth() === bulan - 1 && d.getDate() === hari
  return { tanggal: valid ? d : null, sisaTeks, perluReview: !valid }
}

/**
 * Heuristik pendeteksi kolom "Unit Kerja" yang isinya sebenarnya teks jabatan
 * (kasus Irwan di data contoh). Dipakai importer untuk menandai baris supaya
 * diverifikasi manual — TIDAK untuk membetulkan otomatis (phase.md §6 no. 9).
 */
const PENANDA_JABATAN = [
  'kepala',
  'kasubdit',
  'kasubbag',
  'kepala seksi',
  'kepala subbagian',
  'direktur',
  'sekretaris',
  'analis',
  'pembina jasa',
  'pengelola pengadaan',
]

export function terindikasiTeksJabatan(unitKerjaMentah: string | null | undefined): boolean {
  if (!unitKerjaMentah) return false
  const teks = unitKerjaMentah.toLowerCase()
  return PENANDA_JABATAN.some((penanda) => teks.startsWith(penanda))
}
