import { URUTAN_PENDIDIKAN, type TingkatPendidikan } from './normalisasi'
import { selisihTahun } from './nip'
import type { Eselon } from './scoring/eligibility'
import { hitungSkorIntegritas, type RiwayatHukuman } from './scoring/integritas'
import type { NilaiMentah, PetaNilai, Predikat } from './scoring/types'

/**
 * Jembatan antara DATA pegawai dan MESIN rubrik.
 *
 * `lib/scoring` sengaja tidak tahu apa-apa soal tabel — ia hanya menerima
 * "nilai mentah per indikator". Modul inilah yang menurunkan nilai mentah itu
 * dari data pegawai, dengan aturan yang ditulis eksplisit di satu tempat supaya
 * dipakai sama oleh job recompute (Fase 0.5) dan UI editor/simulasi (Fase 5).
 *
 * Aturan turunan di sini adalah **interpretasi** dari
 * doc/KERANGKA TALENT POOL.md §B.2 — bagian yang doc-nya hanya memberi contoh,
 * bukan definisi operasional. Setiap fungsi menyebutkan aturannya agar bisa
 * diaudit dan diubah kalau pemilik proses berpendapat lain.
 */

const URUTAN_ESELON: Record<Eselon, number> = {
  NON_ESELON: 0,
  IV: 1,
  III: 2,
  II: 3,
  I: 4,
}

/** KERANGKA §B.2.1 — jenjang pendidikan → label kategori rubrik. */
const LABEL_PENDIDIKAN: Record<TingkatPendidikan, string> = {
  S3: 'Doktor',
  S2: 'Magister',
  S1_D4: 'S1/DIV',
  D3: 'DIII',
  SLTA: 'SLTA',
}

export function labelTingkatPendidikan(
  tingkat: TingkatPendidikan | null | undefined,
): string | null {
  if (!tingkat) return null
  return LABEL_PENDIDIKAN[tingkat] ?? null
}

/** Cocokkan daftar teks terhadap kata kunci relevansi jabatan target. */
function adaYangRelevan(daftar: string[], kataKunci: string[]): boolean {
  if (kataKunci.length === 0) return false
  if (kataKunci.some((k) => k.trim().toLowerCase() === 'semua')) return true

  const kunciBersih = kataKunci.map((k) => k.trim().toLowerCase()).filter((k) => k !== '')
  return daftar.some((teks) => {
    const t = teks.toLowerCase()
    return kunciBersih.some((k) => t.includes(k))
  })
}

/**
 * KERANGKA §B.2.2 — Kesesuaian Bidang Ilmu: 100 bila ada riwayat pendidikan di
 * bidang yang sesuai jabatan target, 50 bila tidak. Kata kunci "semua" berarti
 * semua jurusan diperbolehkan (kasus Direktorat Pengadaan).
 */
export function nilaiKesesuaianBidangIlmu(bidangStudi: string[], kataKunci: string[]): number {
  return adaYangRelevan(bidangStudi, kataKunci) ? 100 : 50
}

/**
 * KERANGKA §B.2.3 — Pengembangan Kompetensi: 100 bila punya riwayat diklat/
 * sertifikasi di bidang yang sesuai jabatan target, 50 bila tidak.
 *
 * Catatan: kata kunci "semua" TIDAK berlaku di sini — "semua jurusan
 * diperbolehkan" adalah kelonggaran pendidikan formal, bukan pembebasan syarat
 * diklat. Untuk indikator ini dipakai kata kunci selain "semua".
 */
export function nilaiPengembanganKompetensi(
  riwayatDiklat: string[],
  kataKunci: string[],
): number {
  const kunciDiklat = kataKunci.filter((k) => k.trim().toLowerCase() !== 'semua')
  return adaYangRelevan(riwayatDiklat, kunciDiklat) ? 100 : 50
}

export interface RiwayatJabatanUntukSkor {
  jabatanNamaMentah: string
  /** null = belum terpetakan ke master jabatan DJBK (mis. jabatan di luar DJBK). */
  jabatanId: number | null
  jenjang: string | null
  eselon: Eselon | null
  unitOrganisasiId: number | null
  tanggalMulai: Date | null
  tanggalAkhir: Date | null
}

/**
 * KERANGKA §B.2.4.a — Lama Jabatan, dikembalikan sebagai **jumlah tahun** supaya
 * dicocokkan oleh ambang rubrik (≥5 → 100 · ≥2–<5 → 80 · <2 → 60, lihat
 * phase.md §2.8a).
 *
 * Aturan: "masa kerja dalam jenjang jabatan" ditafsirkan sebagai total durasi
 * seluruh riwayat jabatan yang **jenjangnya sama** dengan jabatan sekarang
 * (mis. akumulasi seluruh masa sebagai Administrator, bukan hanya di posisi
 * terakhir). Kalau riwayat belum bertanggal, jatuh ke lama menjabat di posisi
 * sekarang dari `tmt_jabatan`; kalau itu juga tidak ada, kembalikan null supaya
 * indikatornya ditandai NILAI_KOSONG, bukan diberi 0 diam-diam.
 */
export function nilaiLamaJabatan(
  riwayat: RiwayatJabatanUntukSkor[],
  jenjangSaatIni: string | null,
  tmtJabatan: Date | null,
  sekarang: Date = new Date(),
): number | null {
  const sejenjang = riwayat.filter(
    (r) =>
      r.jenjang !== null &&
      jenjangSaatIni !== null &&
      r.jenjang.toLowerCase() === jenjangSaatIni.toLowerCase() &&
      r.tanggalMulai !== null,
  )

  if (sejenjang.length > 0) {
    let total = 0
    for (const r of sejenjang) {
      const akhir = r.tanggalAkhir ?? sekarang
      const tahun = selisihTahun(r.tanggalMulai, akhir)
      if (tahun !== null) total += tahun
    }
    return Math.round(total * 100) / 100
  }

  const dariTmt = selisihTahun(tmtJabatan, sekarang)
  return dariTmt === null ? null : Math.round(dariTmt * 100) / 100
}

/**
 * KERANGKA §B.2.4.b — Keragaman Riwayat Jabatan.
 *
 * Aturan: riwayat yang tidak terpetakan ke master jabatan DJBK dianggap
 * pengalaman **di luar Bina Konstruksi** (100). Kalau seluruh riwayat ada di
 * dalam DJBK, dibedakan berdasarkan jumlah unit kerja berbeda: ≥2 unit → 80,
 * satu unit → 60.
 */
export function nilaiKeragamanJabatan(riwayat: RiwayatJabatanUntukSkor[]): number | null {
  if (riwayat.length === 0) return null

  const adaLuarDjbk = riwayat.some((r) => r.jabatanId === null)
  if (adaLuarDjbk) return 100

  const unit = new Set(
    riwayat.map((r) => r.unitOrganisasiId).filter((u): u is number => u !== null),
  )
  if (unit.size === 0) return null
  return unit.size >= 2 ? 80 : 60
}

const POLA_PLT = /\b(plt|pelaksana tugas)\b/i
const POLA_PLH = /\b(plh|pelaksana harian)\b/i

/**
 * KERANGKA §B.2.4.c — Substansi Riwayat Jabatan (penugasan non-definitif).
 *
 * Plt lebih tinggi → 100 · Plt setara → 80 · Plh lebih tinggi → 60 ·
 * Plh setara → 40 · tidak punya riwayat non-definitif → 0.
 * "Lebih tinggi/setara" dibandingkan terhadap eselon jabatan pegawai sekarang.
 */
export function nilaiSubstansiJabatan(
  riwayat: RiwayatJabatanUntukSkor[],
  eselonSaatIni: Eselon | null,
): number {
  const dasar = eselonSaatIni ? URUTAN_ESELON[eselonSaatIni] : -1
  let terbaik = 0

  for (const r of riwayat) {
    const plt = POLA_PLT.test(r.jabatanNamaMentah)
    const plh = POLA_PLH.test(r.jabatanNamaMentah)
    if (!plt && !plh) continue

    const tingkat = r.eselon ? URUTAN_ESELON[r.eselon] : -1
    const lebihTinggi = tingkat > dasar

    const skor = plt ? (lebihTinggi ? 100 : 80) : lebihTinggi ? 60 : 40
    if (skor > terbaik) terbaik = skor
  }

  return terbaik
}

export interface ProfilPenilaian {
  pegawaiId: number
  tingkatPendidikan: TingkatPendidikan | null
  bidangStudi: string[]
  riwayatDiklat: string[]
  jenjangSaatIni: string | null
  eselonSaatIni: Eselon | null
  tmtJabatan: Date | null
  riwayatJabatan: RiwayatJabatanUntukSkor[]
  /** Potkom mentah dari asesmen; boleh >100, mesin rubrik yang meng-clamp. */
  potkom: number | null
  hukumanDisiplin: RiwayatHukuman[]
  /**
   * Predikat kinerja asesmen terbaru. Hanya diperlukan bila rubriknya memuat
   * indikator berkunci `PREDIKAT_KINERJA` (rubrik generik sumbu Y) — rubrik
   * jabatan target tidak memakainya sama sekali (phase.md §3 K-4).
   */
  predikatKinerja?: Predikat | null
}

export interface TargetPenilaian {
  jabatanTargetId: number
  /** Kata kunci relevansi bidang ilmu & diklat untuk jabatan target ini. */
  kataKunciRelevansi: string[]
}

/**
 * Kunci sumber data indikator (`rubrik_indikator.kunci_sistem`, `doc/sql/010`).
 *
 * Ini yang memisahkan **label** indikator — milik pengguna, bebas diubah dari
 * editor rubrik — dari **pengenal sumber datanya**, milik sistem. Sebelum kolom
 * ini ada, jembatannya adalah pencocokan nama persis, sehingga mengganti nama
 * 'Lama Jabatan' mematikan seluruh perhitungan match score.
 *
 * Indikator tanpa kunci (`null`) sah: ia berarti "tidak ada sumber otomatis",
 * nilainya diisi manusia dan ditandai MANUAL di `match_score_detail`.
 */
export const KUNCI_INDIKATOR = [
  'PREDIKAT_KINERJA',
  'POTKOM',
  'TINGKAT_PENDIDIKAN',
  'KESESUAIAN_BIDANG_ILMU',
  'PENGEMBANGAN_KOMPETENSI',
  'LAMA_JABATAN',
  'KERAGAMAN_JABATAN',
  'SUBSTANSI_JABATAN',
  'INTEGRITAS',
] as const

export type KunciIndikator = (typeof KUNCI_INDIKATOR)[number]

/** Keterangan sumber tiap kunci — dipakai dropdown editor rubrik. */
export const SUMBER_KUNCI: Record<KunciIndikator, { label: string; asal: string }> = {
  PREDIKAT_KINERJA: {
    label: 'Predikat kinerja',
    asal: 'asesmen_talenta.rating_kinerja (eKinerja)',
  },
  POTKOM: {
    label: 'Nilai Potkom',
    asal: 'asesmen_talenta.potkom (e-Nominasi)',
  },
  TINGKAT_PENDIDIKAN: {
    label: 'Tingkat pendidikan formal',
    asal: 'pegawai.tingkat_pendidikan (eHRM)',
  },
  KESESUAIAN_BIDANG_ILMU: {
    label: 'Kesesuaian bidang ilmu',
    asal: 'riwayat_pendidikan.bidang_studi × kata kunci relevansi jabatan target',
  },
  PENGEMBANGAN_KOMPETENSI: {
    label: 'Pengembangan kompetensi',
    asal: 'pegawai.riwayat_diklat × kata kunci relevansi jabatan target',
  },
  LAMA_JABATAN: {
    label: 'Lama jabatan (tahun)',
    asal: 'riwayat_jabatan bertanggal pada jenjang yang sama; fallback tmt_jabatan',
  },
  KERAGAMAN_JABATAN: {
    label: 'Keragaman riwayat jabatan',
    asal: 'riwayat_jabatan — sebaran unit & riwayat di luar DJBK',
  },
  SUBSTANSI_JABATAN: {
    label: 'Substansi riwayat jabatan',
    asal: 'riwayat_jabatan — penugasan Plt/Plh',
  },
  INTEGRITAS: {
    label: 'Rekam jejak disiplin',
    asal: 'hukuman_disiplin — tingkat terberat yang berstatus aktif',
  },
}

export function adalahKunciIndikator(nilai: string): nilai is KunciIndikator {
  return (KUNCI_INDIKATOR as readonly string[]).includes(nilai)
}

/**
 * Nilai mentah satu indikator dari data pegawai.
 *
 * **Satu-satunya** tempat "data pegawai → nilai indikator" diterjemahkan;
 * dipakai bersama oleh job recompute, editor/simulasi rubrik, dan halaman
 * kandidat (CLAUDE.md #2).
 */
export function nilaiUntukKunci(
  kunci: KunciIndikator,
  profil: ProfilPenilaian,
  target: TargetPenilaian,
  sekarang: Date = new Date(),
): NilaiMentah | null {
  switch (kunci) {
    case 'PREDIKAT_KINERJA':
      return profil.predikatKinerja ?? null
    case 'POTKOM':
      return profil.potkom
    case 'TINGKAT_PENDIDIKAN':
      return labelTingkatPendidikan(profil.tingkatPendidikan)
    case 'KESESUAIAN_BIDANG_ILMU':
      return nilaiKesesuaianBidangIlmu(profil.bidangStudi, target.kataKunciRelevansi)
    case 'PENGEMBANGAN_KOMPETENSI':
      return nilaiPengembanganKompetensi(profil.riwayatDiklat, target.kataKunciRelevansi)
    case 'LAMA_JABATAN':
      return nilaiLamaJabatan(
        profil.riwayatJabatan,
        profil.jenjangSaatIni,
        profil.tmtJabatan,
        sekarang,
      )
    case 'KERAGAMAN_JABATAN':
      return nilaiKeragamanJabatan(profil.riwayatJabatan)
    case 'SUBSTANSI_JABATAN':
      return nilaiSubstansiJabatan(profil.riwayatJabatan, profil.eselonSaatIni)
    case 'INTEGRITAS':
      return hitungSkorIntegritas(profil.hukumanDisiplin).tingkatTerberat
  }
}

/** Satu indikator daun beserta kunci sumber datanya. */
export interface IndikatorBerkunci {
  indikatorId: number
  kunci: KunciIndikator | null
}

export interface HasilPetaNilai {
  peta: PetaNilai
  /**
   * Indikator yang tidak punya sumber otomatis — nilainya harus datang dari
   * manusia. Dilaporkan, bukan dibiarkan jadi 0 senyap.
   */
  tanpaKunci: number[]
}

/**
 * Susun peta nilai mentah untuk seluruh indikator satu jabatan target.
 *
 * `nilaiManual` menimpa hasil otomatis: indikator yang datanya belum ada di
 * sistem sumber diisi manusia, dan nilainya harus bertahan melewati perhitungan
 * ulang (U-3) — kalau tidak, recompute menghapus pekerjaan orang tanpa pesan.
 */
export function petaNilaiDariKunci(
  indikator: IndikatorBerkunci[],
  profil: ProfilPenilaian,
  target: TargetPenilaian,
  sekarang: Date = new Date(),
  nilaiManual: Record<number, NilaiMentah> = {},
): HasilPetaNilai {
  const peta: PetaNilai = {}
  const tanpaKunci: number[] = []

  for (const { indikatorId, kunci } of indikator) {
    const manual = nilaiManual[indikatorId]
    if (manual !== undefined) {
      peta[indikatorId] = manual
      if (kunci === null) tanpaKunci.push(indikatorId)
      continue
    }
    if (kunci === null) {
      tanpaKunci.push(indikatorId)
      continue
    }
    peta[indikatorId] = nilaiUntukKunci(kunci, profil, target, sekarang)
  }

  return { peta, tanpaKunci }
}

/** ID indikator rubrik pada satu jabatan target (dibaca dari DB, bukan hardcode). */
export interface IdIndikatorTarget {
  potkom: number
  tingkatPendidikan: number
  kesesuaianBidangIlmu: number
  pengembanganKompetensi: number
  lamaJabatan: number
  keragamanJabatan: number
  substansiJabatan: number
  integritas: number
}

/**
 * Bentuk lama berbasis nama indikator — dipertahankan untuk uji & pemanggil yang
 * sudah tahu id tiap indikator. Isinya diturunkan dari `petaNilaiDariKunci`
 * supaya tidak ada dua tafsiran atas rubrik yang sama.
 */
export function petaNilaiIndikator(
  profil: ProfilPenilaian,
  target: TargetPenilaian,
  id: IdIndikatorTarget,
  sekarang: Date = new Date(),
): PetaNilai {
  const pasangan: Array<[keyof IdIndikatorTarget, KunciIndikator]> = [
    ['potkom', 'POTKOM'],
    ['tingkatPendidikan', 'TINGKAT_PENDIDIKAN'],
    ['kesesuaianBidangIlmu', 'KESESUAIAN_BIDANG_ILMU'],
    ['pengembanganKompetensi', 'PENGEMBANGAN_KOMPETENSI'],
    ['lamaJabatan', 'LAMA_JABATAN'],
    ['keragamanJabatan', 'KERAGAMAN_JABATAN'],
    ['substansiJabatan', 'SUBSTANSI_JABATAN'],
    ['integritas', 'INTEGRITAS'],
  ]

  return petaNilaiDariKunci(
    pasangan.map(([bidang, kunci]) => ({ indikatorId: id[bidang], kunci })),
    profil,
    target,
    sekarang,
  ).peta
}

/** Eselon tertinggi yang pernah dijabat — dipakai cek kelayakan pengalaman. */
export function eselonTertinggi(riwayat: RiwayatJabatanUntukSkor[]): Eselon | null {
  let terbaik: Eselon | null = null
  for (const r of riwayat) {
    if (!r.eselon) continue
    if (terbaik === null || URUTAN_ESELON[r.eselon] > URUTAN_ESELON[terbaik]) terbaik = r.eselon
  }
  return terbaik
}

/** Total tahun pengalaman jabatan dari seluruh riwayat bertanggal. */
export function totalPengalamanTahun(
  riwayat: RiwayatJabatanUntukSkor[],
  sekarang: Date = new Date(),
): number | null {
  const bertanggal = riwayat.filter((r) => r.tanggalMulai !== null)
  if (bertanggal.length === 0) return null

  let total = 0
  for (const r of bertanggal) {
    const tahun = selisihTahun(r.tanggalMulai, r.tanggalAkhir ?? sekarang)
    if (tahun !== null) total += tahun
  }
  return Math.round(total * 100) / 100
}

/** Bandingkan tingkat pendidikan terhadap syarat minimal. */
export function memenuhiPendidikanMinimal(
  dimiliki: TingkatPendidikan | null,
  minimal: TingkatPendidikan,
): boolean {
  if (!dimiliki) return false
  return URUTAN_PENDIDIKAN[dimiliki] >= URUTAN_PENDIDIKAN[minimal]
}
