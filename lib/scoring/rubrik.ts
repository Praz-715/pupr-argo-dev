import { SKOR_MAKS, SKOR_MIN } from './konstanta'
import type {
  AlasanReview,
  CatatanReview,
  HasilIndikator,
  HasilKomponen,
  HasilSumbu,
  IndikatorNode,
  KategoriSkor,
  KomponenNode,
  ModeSkor,
  NilaiMentah,
  PetaNilai,
  Sumbu,
} from './types'

/**
 * Mesin rubrik generik: Komponen → Indikator → Sub-indikator → Kategori Skor.
 *
 * Dipakai untuk KEDUA formula (phase.md §2):
 *   Formula A → jalankan rubrik generik (`jabatan_target_id IS NULL`)
 *   Formula B → jalankan rubrik milik satu jabatan target
 * Jadi tidak ada dua implementasi rumus yang bisa berbeda hasilnya.
 */

/** Batasi skor ke rentang sah, sekaligus laporkan kalau nilainya dipotong. */
export function clampSkor(nilai: number): { skor: number; diClamp: boolean } {
  if (Number.isNaN(nilai)) return { skor: SKOR_MIN, diClamp: true }
  if (nilai < SKOR_MIN) return { skor: SKOR_MIN, diClamp: true }
  if (nilai > SKOR_MAKS) return { skor: SKOR_MAKS, diClamp: true }
  return { skor: nilai, diClamp: false }
}

/** Pembulatan 2 desimal — hanya di titik keluaran, tidak di tengah perhitungan. */
export function bulatkan2(nilai: number): number {
  return Math.round((nilai + Number.EPSILON) * 100) / 100
}

function samakan(teks: string): string {
  return teks.trim().replace(/\s+/g, ' ').toLowerCase()
}

function punyaAmbang(kategori: KategoriSkor[]): boolean {
  return kategori.some((k) => k.ambangMin !== null || k.ambangMax !== null)
}

function cocokAmbang(nilai: number, k: KategoriSkor): boolean {
  const minOk = k.ambangMin === null || nilai >= k.ambangMin
  const maxOk = k.ambangMax === null || nilai <= k.ambangMax
  return minOk && maxOk
}

/**
 * Urut menurun berdasarkan `ambangMin` (null paling belakang) lalu ambil yang
 * cocok pertama → **band tertinggi yang berlaku yang menang**.
 *
 * Ini penting karena rubrik sumber menulis batas atas secara eksklusif ("≥60–<80")
 * tapi menyimpannya sebagai `ambang_max = 80`. Tanpa aturan ini, nilai tepat 80
 * cocok di dua kategori sekaligus.
 */
function urutAmbangMenurun(kategori: KategoriSkor[]): KategoriSkor[] {
  return [...kategori].sort((a, b) => {
    if (a.ambangMin === null && b.ambangMin === null) return a.urutan - b.urutan
    if (a.ambangMin === null) return 1
    if (b.ambangMin === null) return -1
    return b.ambangMin - a.ambangMin
  })
}

export interface HasilKategori {
  kategoriTerpilih: string | null
  skor: number
  perluReview: boolean
  alasan: AlasanReview | null
  keterangan: string | null
}

/**
 * Tentukan skor satu indikator daun dari nilai mentahnya.
 *
 * Pencocokan, berurutan:
 *   1. nilai berupa teks   → cocokkan ke `namaKategori`
 *   2. nilai berupa angka + rubrik punya ambang → cocokkan ke rentang ambang
 *   3. nilai berupa angka + rubrik TANPA ambang → cocokkan persis ke `nilaiSkor`
 *   4. tidak ada yang cocok → ambil kategori terdekat DI BAWAH + tandai review
 *
 * Langkah 4 adalah jaring pengaman wajib untuk rubrik yang rentangnya belum
 * kontinu (phase.md §2.8b). Tidak pernah mengembalikan 0 senyap.
 */
export function pilihKategori(
  nilai: NilaiMentah | null | undefined,
  kategori: KategoriSkor[],
  modeSkor: ModeSkor,
): HasilKategori {
  if (nilai === null || nilai === undefined || nilai === '') {
    return {
      kategoriTerpilih: null,
      skor: 0,
      perluReview: true,
      alasan: 'NILAI_KOSONG',
      keterangan: 'Nilai mentah belum tersedia',
    }
  }

  if (kategori.length === 0) {
    // Rubrik tanpa kategori: masih bisa dipakai kalau modenya NILAI_LANGSUNG.
    if (modeSkor === 'NILAI_LANGSUNG' && typeof nilai === 'number') {
      const { skor, diClamp } = clampSkor(nilai)
      return {
        kategoriTerpilih: null,
        skor,
        perluReview: diClamp,
        alasan: diClamp ? 'NILAI_DI_CLAMP' : null,
        keterangan: diClamp ? `Nilai ${nilai} di luar 0–100, dipotong ke ${skor}` : null,
      }
    }
    return {
      kategoriTerpilih: null,
      skor: 0,
      perluReview: true,
      alasan: 'RUBRIK_KOSONG',
      keterangan: 'Indikator belum punya kategori skor',
    }
  }

  // NILAI_LANGSUNG: skor = nilai mentah; kategori hanya label klasifikasi.
  if (modeSkor === 'NILAI_LANGSUNG') {
    if (typeof nilai !== 'number') {
      return {
        kategoriTerpilih: null,
        skor: 0,
        perluReview: true,
        alasan: 'KATEGORI_TIDAK_DIKENAL',
        keterangan: `Mode NILAI_LANGSUNG butuh angka, diterima "${nilai}"`,
      }
    }
    const { skor, diClamp } = clampSkor(nilai)
    const label = urutAmbangMenurun(kategori).find((k) => cocokAmbang(skor, k))
    return {
      kategoriTerpilih: label?.namaKategori ?? null,
      skor,
      perluReview: diClamp,
      alasan: diClamp ? 'NILAI_DI_CLAMP' : null,
      keterangan: diClamp ? `Nilai ${nilai} di luar 0–100, dipotong ke ${skor}` : null,
    }
  }

  // ---- KATEGORI_TETAP ----

  // (1) nilai berupa teks → cocokkan nama kategori
  if (typeof nilai === 'string') {
    const target = samakan(nilai)
    const cocok = kategori.find((k) => samakan(k.namaKategori) === target)
    if (cocok) return dariKategori(cocok)
    return {
      kategoriTerpilih: null,
      skor: 0,
      perluReview: true,
      alasan: 'KATEGORI_TIDAK_DIKENAL',
      keterangan: `Kategori "${nilai}" tidak ada di rubrik indikator ini`,
    }
  }

  // (2) angka + rubrik punya ambang
  if (punyaAmbang(kategori)) {
    const cocok = urutAmbangMenurun(kategori).find((k) => cocokAmbang(nilai, k))
    if (cocok) return dariKategori(cocok)

    // (4) fallback: kategori terdekat di bawah
    const dibawah = kategori
      .filter((k) => k.ambangMin !== null && k.ambangMin <= nilai)
      .sort((a, b) => b.ambangMin! - a.ambangMin!)[0]
    const terpilih = dibawah ?? terendah(kategori)
    return {
      kategoriTerpilih: terpilih.namaKategori,
      skor: clampSkor(terpilih.nilaiSkor ?? 0).skor,
      perluReview: true,
      alasan: 'DI_LUAR_AMBANG',
      keterangan: `Nilai ${nilai} tidak masuk rentang mana pun; dipakai kategori terdekat di bawah ("${terpilih.namaKategori}")`,
    }
  }

  // (3) angka + rubrik tanpa ambang → cocokkan persis ke nilai_skor
  const persis = kategori.find((k) => k.nilaiSkor !== null && k.nilaiSkor === nilai)
  if (persis) return dariKategori(persis)

  const dibawahSkor = kategori
    .filter((k) => k.nilaiSkor !== null && k.nilaiSkor <= nilai)
    .sort((a, b) => b.nilaiSkor! - a.nilaiSkor!)[0]
  const terpilih = dibawahSkor ?? terendah(kategori)
  return {
    kategoriTerpilih: terpilih.namaKategori,
    skor: clampSkor(terpilih.nilaiSkor ?? 0).skor,
    perluReview: true,
    alasan: 'DI_LUAR_AMBANG',
    keterangan: `Rubrik indikator ini tidak punya ambang; nilai ${nilai} dicocokkan ke kategori terdekat di bawah ("${terpilih.namaKategori}")`,
  }
}

function dariKategori(k: KategoriSkor): HasilKategori {
  const { skor, diClamp } = clampSkor(k.nilaiSkor ?? 0)
  return {
    kategoriTerpilih: k.namaKategori,
    skor,
    perluReview: diClamp,
    alasan: diClamp ? 'NILAI_DI_CLAMP' : null,
    keterangan: diClamp ? `Nilai skor kategori di luar 0–100, dipotong ke ${skor}` : null,
  }
}

function terendah(kategori: KategoriSkor[]): KategoriSkor {
  const urut = [...kategori].sort((a, b) => (a.nilaiSkor ?? 0) - (b.nilaiSkor ?? 0))
  return urut[0] ?? kategori[0]!
}

/**
 * Rata-rata tertimbang generik: Σ(nilai × bobot) / Σ(bobot).
 *
 * Anak dengan `bobot = null` dianggap sama rata — HANYA bila semua anak begitu
 * (kasus sub-indikator). Kalau tercampur, yang null diberi bobot 0 dan ditandai,
 * karena menebak bobotnya berisiko mengubah hasil tanpa disadari.
 */
function rataTertimbang(
  anak: Array<{ skor: number; bobot: number | null }>,
): { skor: number; bobotCampur: boolean; bobotNol: boolean } {
  if (anak.length === 0) return { skor: 0, bobotCampur: false, bobotNol: true }

  const adaNull = anak.some((a) => a.bobot === null)
  const adaAngka = anak.some((a) => a.bobot !== null)
  const semuaNull = adaNull && !adaAngka
  const bobotCampur = adaNull && adaAngka

  let totalNilai = 0
  let totalBobot = 0
  for (const a of anak) {
    const bobot = a.bobot ?? (semuaNull ? 1 : 0)
    totalNilai += a.skor * bobot
    totalBobot += bobot
  }

  if (totalBobot === 0) return { skor: 0, bobotCampur, bobotNol: true }
  return { skor: totalNilai / totalBobot, bobotCampur, bobotNol: false }
}

function hitungIndikator(
  node: IndikatorNode,
  nilai: PetaNilai,
  catatan: CatatanReview[],
): HasilIndikator {
  // Node dengan anak = agregator murni (mis. "Nilai Pengalaman Jabatan").
  if (node.anak.length > 0) {
    const anakUrut = [...node.anak].sort((a, b) => a.urutan - b.urutan)
    const hasilAnak = anakUrut.map((a) => hitungIndikator(a, nilai, catatan))
    const { skor, bobotCampur, bobotNol } = rataTertimbang(
      hasilAnak.map((h) => ({ skor: h.skor, bobot: h.bobot })),
    )

    if (bobotCampur) {
      catatan.push({
        indikatorId: node.id,
        namaIndikator: node.namaIndikator,
        alasan: 'BOBOT_CAMPUR',
        keterangan:
          'Sebagian sub-indikator punya bobot dan sebagian tidak; yang tanpa bobot dihitung 0',
      })
    }
    if (bobotNol) {
      catatan.push({
        indikatorId: node.id,
        namaIndikator: node.namaIndikator,
        alasan: 'BOBOT_NOL',
        keterangan: 'Total bobot sub-indikator 0, skor tidak bisa dihitung',
      })
    }

    return {
      indikatorId: node.id,
      namaIndikator: node.namaIndikator,
      bobot: node.bobot,
      nilaiMentah: null,
      kategoriTerpilih: null,
      skor: bulatkan2(skor),
      perluReview: bobotCampur || bobotNol || hasilAnak.some((h) => h.perluReview),
      anak: hasilAnak,
    }
  }

  const mentah = nilai[node.id] ?? null
  const hasil = pilihKategori(mentah, node.kategori, node.modeSkor)

  if (hasil.perluReview && hasil.alasan) {
    catatan.push({
      indikatorId: node.id,
      namaIndikator: node.namaIndikator,
      alasan: hasil.alasan,
      keterangan: hasil.keterangan ?? '',
    })
  }

  return {
    indikatorId: node.id,
    namaIndikator: node.namaIndikator,
    bobot: node.bobot,
    nilaiMentah: mentah,
    kategoriTerpilih: hasil.kategoriTerpilih,
    skor: bulatkan2(hasil.skor),
    perluReview: hasil.perluReview,
    anak: [],
  }
}

export function hitungKomponen(
  komponen: KomponenNode,
  nilai: PetaNilai,
  catatan: CatatanReview[],
): HasilKomponen {
  const indikatorUrut = [...komponen.indikator].sort((a, b) => a.urutan - b.urutan)
  const hasilIndikator = indikatorUrut.map((i) => hitungIndikator(i, nilai, catatan))
  const { skor, bobotCampur, bobotNol } = rataTertimbang(
    hasilIndikator.map((h) => ({ skor: h.skor, bobot: h.bobot })),
  )

  if (bobotNol) {
    catatan.push({
      indikatorId: null,
      namaIndikator: komponen.namaKomponen,
      alasan: 'BOBOT_NOL',
      keterangan: `Komponen "${komponen.namaKomponen}" tidak punya indikator berbobot`,
    })
  }

  return {
    komponenId: komponen.id,
    namaKomponen: komponen.namaKomponen,
    sumbu: komponen.sumbu,
    bobot: komponen.bobot,
    skor: bulatkan2(skor),
    indikator: hasilIndikator,
    perluReview: bobotCampur || bobotNol || hasilIndikator.some((h) => h.perluReview),
  }
}

/**
 * Hitung satu sumbu dari daftar komponennya.
 *
 * Memakai Σ(skor × bobot)/Σ(bobot) — kalau total bobot komponen = 1 (seperti
 * seharusnya: 0.65 + 0.20 + 0.15), hasilnya identik dengan penjumlahan
 * tertimbang biasa. Pembagian dipertahankan supaya rubrik yang bobotnya belum
 * pas 100% tetap menghasilkan angka yang masuk akal, bukan skor yang mengecil
 * tanpa penjelasan.
 */
export function hitungSumbu(
  komponen: KomponenNode[],
  sumbu: Sumbu,
  nilai: PetaNilai,
): HasilSumbu {
  const catatan: CatatanReview[] = []
  const relevan = komponen
    .filter((k) => k.sumbu === sumbu)
    .sort((a, b) => a.urutan - b.urutan)

  if (relevan.length === 0) {
    return {
      sumbu,
      skor: 0,
      komponen: [],
      catatanReview: [
        {
          indikatorId: null,
          namaIndikator: sumbu,
          alasan: 'RUBRIK_KOSONG',
          keterangan: `Tidak ada komponen rubrik untuk sumbu ${sumbu}`,
        },
      ],
      perluReview: true,
    }
  }

  const hasilKomponen = relevan.map((k) => hitungKomponen(k, nilai, catatan))
  const { skor, bobotNol } = rataTertimbang(
    hasilKomponen.map((h) => ({ skor: h.skor, bobot: h.bobot })),
  )

  if (bobotNol) {
    catatan.push({
      indikatorId: null,
      namaIndikator: sumbu,
      alasan: 'BOBOT_NOL',
      keterangan: `Total bobot komponen sumbu ${sumbu} adalah 0`,
    })
  }

  const { skor: skorAman, diClamp } = clampSkor(skor)
  if (diClamp) {
    catatan.push({
      indikatorId: null,
      namaIndikator: sumbu,
      alasan: 'NILAI_DI_CLAMP',
      keterangan: `Skor sumbu ${bulatkan2(skor)} di luar 0–100, dipotong ke ${skorAman}`,
    })
  }

  return {
    sumbu,
    skor: bulatkan2(skorAman),
    komponen: hasilKomponen,
    catatanReview: catatan,
    perluReview: catatan.length > 0,
  }
}

/** Total bobot komponen per sumbu — dipakai validasi editor rubrik (Fase 5). */
export function totalBobotKomponen(komponen: KomponenNode[], sumbu: Sumbu): number {
  return bulatkan2(
    komponen.filter((k) => k.sumbu === sumbu).reduce((total, k) => total + k.bobot, 0),
  )
}
