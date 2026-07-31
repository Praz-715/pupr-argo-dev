import { describe, expect, it } from 'vitest'

import {
  BARIS_KOTAK_9,
  KOLOM_KOTAK_9,
  asesmenLayakDipakai,
  bandingkanKotak9,
  kategoriDariKotak9,
  clampSkor,
  evaluasiKelayakan,
  evaluasiMasaBerlaku,
  hitungKotak9,
  hitungMatchScore,
  hitungNilaiTalenta,
  hitungRanking,
  hitungSkorIntegritas,
  hitungSumbu,
  klasifikasiSumbuX,
  klasifikasiSumbuY,
  koordinatKotak9,
  pilihKategori,
  ratakanDetail,
  skorPredikat,
  totalBobotKomponen,
  type Kotak9,
  type PetaNilai,
  type Predikat,
} from './index'
import {
  ID_INDIKATOR,
  KATEGORI_LAMA_JABATAN_BERLUBANG,
  KATEGORI_LAMA_JABATAN_KONTINU,
  KATEGORI_PENDIDIKAN,
  KATEGORI_POTKOM,
  KATEGORI_PREDIKAT,
  RUBRIK_GENERIK,
  rubrikJabatanTarget,
} from './fixture'

// =============================================================================
// §2.1 Skala & clamp
// =============================================================================

describe('§2.1 skala skor 0–100', () => {
  it('membiarkan nilai dalam rentang apa adanya', () => {
    expect(clampSkor(0)).toEqual({ skor: 0, diClamp: false })
    expect(clampSkor(75.5)).toEqual({ skor: 75.5, diClamp: false })
    expect(clampSkor(100)).toEqual({ skor: 100, diClamp: false })
  })

  it('memotong nilai di luar rentang DAN melaporkannya', () => {
    expect(clampSkor(115.1)).toEqual({ skor: 100, diClamp: true })
    expect(clampSkor(-5)).toEqual({ skor: 0, diClamp: true })
    expect(clampSkor(Number.NaN)).toEqual({ skor: 0, diClamp: true })
  })
})

// =============================================================================
// §2.2 Formula A — predikat & nilai talenta
// =============================================================================

describe('§2.2 skor predikat kinerja', () => {
  it.each([
    ['Sangat Baik', 100],
    ['Baik', 80],
    ['Butuh Perbaikan', 60],
    ['Kurang', 40],
    ['Sangat Kurang', 20],
  ] as Array<[Predikat, number]>)('%s → %i', (predikat, harapan) => {
    expect(skorPredikat(predikat)).toBe(harapan)
  })

  it('toleran terhadap kapitalisasi & spasi ganda dari sumber', () => {
    expect(skorPredikat('SANGAT BAIK')).toBe(100)
    expect(skorPredikat('  baik  ')).toBe(80)
    expect(skorPredikat('Butuh   Perbaikan')).toBe(60)
  })

  it('mengembalikan null untuk predikat tak dikenal, bukan 0 senyap', () => {
    expect(skorPredikat('Luar Biasa')).toBeNull()
    expect(skorPredikat(null)).toBeNull()
    expect(skorPredikat('')).toBeNull()
  })

  it('Nilai Talenta = 50% Y + 50% X (contoh Lampiran B: 80 & 70 → 75)', () => {
    expect(hitungNilaiTalenta(80, 70)).toBe(75)
    expect(hitungNilaiTalenta(100, 90)).toBe(95)
  })

  it('tidak pernah menghasilkan Nilai Talenta di atas 100', () => {
    expect(hitungNilaiTalenta(100, 115.1)).toBe(100)
  })
})

// =============================================================================
// §2.3 Klasifikasi sumbu & Kotak 9
// =============================================================================

describe('§2.3 klasifikasi sumbu — batas bawah inklusif', () => {
  it('sumbu Y', () => {
    expect(klasifikasiSumbuY(100)).toBe('Di Atas Ekspektasi')
    expect(klasifikasiSumbuY(80)).toBe('Di Atas Ekspektasi') // tepat 80 masuk atas (K-2)
    expect(klasifikasiSumbuY(79.99)).toBe('Sesuai Ekspektasi')
    expect(klasifikasiSumbuY(60)).toBe('Sesuai Ekspektasi') // tepat 60 masuk tengah
    expect(klasifikasiSumbuY(59.99)).toBe('Di Bawah Ekspektasi')
    expect(klasifikasiSumbuY(0)).toBe('Di Bawah Ekspektasi')
  })

  it('sumbu X', () => {
    expect(klasifikasiSumbuX(100)).toBe('Tinggi')
    expect(klasifikasiSumbuX(80)).toBe('Tinggi')
    expect(klasifikasiSumbuX(79.99)).toBe('Menengah')
    expect(klasifikasiSumbuX(60)).toBe('Menengah')
    expect(klasifikasiSumbuX(59.99)).toBe('Rendah')
  })
})

describe('§2.3 matriks Kotak 9 — kesembilan sel', () => {
  // Lampiran A: [Y][X]
  it.each([
    [100, 100, 9],
    [100, 70, 7],
    [100, 40, 4],
    [70, 100, 8],
    [70, 70, 5],
    [70, 40, 2],
    [40, 100, 6],
    [40, 70, 3],
    [40, 40, 1],
  ] as Array<[number, number, Kotak9]>)('Y=%i X=%i → kotak %i', (y, x, kotak) => {
    expect(hitungKotak9(y, x).kotak).toBe(kotak)
  })

  it('predikat "Baik" (80) + potkom tinggi → kotak 9 (bukti K-2)', () => {
    const hasil = hitungKotak9(skorPredikat('Baik')!, 93.47)
    expect(hasil.kategoriY).toBe('Di Atas Ekspektasi')
    expect(hasil.kotak).toBe(9)
  })

  it('memetakan setiap kotak ke koordinat grid 3×3 yang unik', () => {
    const terlihat = new Set<string>()
    for (const kotak of [1, 2, 3, 4, 5, 6, 7, 8, 9] as Kotak9[]) {
      const { baris, kolom } = koordinatKotak9(kotak)
      terlihat.add(`${baris}-${kolom}`)
    }
    expect(terlihat.size).toBe(9)
  })

  it('menghitung nilai talenta sekaligus', () => {
    expect(hitungKotak9(80, 70).nilaiTalenta).toBe(75)
  })

  // Dipakai judul drill-down Peta Talenta & baris Kotak 9 di Perbandingan
  // Kandidat. Harus kebalikan tepat dari MATRIKS_KOTAK_9 — kalau tidak, UI
  // akan melabeli sel dengan kategori yang bukan miliknya.
  it('kategoriDariKotak9 adalah kebalikan tepat dari hitungKotak9', () => {
    for (const kotak of [1, 2, 3, 4, 5, 6, 7, 8, 9] as Kotak9[]) {
      const kat = kategoriDariKotak9(kotak)
      expect(kat, `kotak ${kotak} tidak punya kategori`).not.toBeNull()
      // Ambil satu nilai wakil dari tiap band lalu hitung ulang kotaknya.
      const y = kat!.y === 'Di Atas Ekspektasi' ? 100 : kat!.y === 'Sesuai Ekspektasi' ? 70 : 40
      const x = kat!.x === 'Tinggi' ? 90 : kat!.x === 'Menengah' ? 70 : 40
      expect(hitungKotak9(y, x).kotak).toBe(kotak)
    }
  })

  it('kategoriDariKotak9 menolak nomor kotak di luar 1–9', () => {
    expect(kategoriDariKotak9(0)).toBeNull()
    expect(kategoriDariKotak9(10)).toBeNull()
  })

  it('urutan baris & kolom grid konsisten dengan koordinat', () => {
    expect(BARIS_KOTAK_9).toHaveLength(3)
    expect(KOLOM_KOTAK_9).toHaveLength(3)
    // Baris 0 harus yang teratas (Di Atas Ekspektasi), kolom 0 paling kiri.
    expect(koordinatKotak9(4)).toEqual({ baris: 0, kolom: 0 })
    expect(koordinatKotak9(9)).toEqual({ baris: 0, kolom: 2 })
    expect(koordinatKotak9(1)).toEqual({ baris: 2, kolom: 0 })
  })
})

describe('§2.3 pembanding Kotak 9 terhadap nilai sumber', () => {
  it('menandai selisih, bukan menyembunyikannya', () => {
    // Kasus nyata di data contoh: Y=100, X=69.58 → hitung 7, sumber bilang 4
    const hasil = hitungKotak9(100, 69.58)
    expect(hasil.kotak).toBe(7)

    const banding = bandingkanKotak9(hasil, 4)
    expect(banding.cocok).toBe(false)
    expect(banding.perluReview).toBe(true)
    expect(banding.keterangan).toContain('berbeda')
  })

  it('tidak mengeluh kalau nilai sumber cocok', () => {
    const banding = bandingkanKotak9(hitungKotak9(100, 76.04), 7)
    expect(banding.cocok).toBe(true)
    expect(banding.perluReview).toBe(false)
  })

  it('tidak mengeluh kalau sumber tidak mengirim kotak_9', () => {
    expect(bandingkanKotak9(hitungKotak9(80, 80), null).perluReview).toBe(false)
  })
})

// =============================================================================
// §2.6 Dua mode skor + §2.8 fallback ambang
// =============================================================================

describe('§2.6 mode KATEGORI_TETAP', () => {
  it('mencocokkan nilai berupa teks ke nama kategori', () => {
    const hasil = pilihKategori('Magister', KATEGORI_PENDIDIKAN, 'KATEGORI_TETAP')
    expect(hasil.skor).toBe(90)
    expect(hasil.kategoriTerpilih).toBe('Magister')
    expect(hasil.perluReview).toBe(false)
  })

  it('toleran kapitalisasi & spasi', () => {
    expect(pilihKategori('  sangat baik ', KATEGORI_PREDIKAT, 'KATEGORI_TETAP').skor).toBe(100)
  })

  it('menandai kategori tak dikenal alih-alih diam-diam memberi 0', () => {
    const hasil = pilihKategori('Profesor', KATEGORI_PENDIDIKAN, 'KATEGORI_TETAP')
    expect(hasil.perluReview).toBe(true)
    expect(hasil.alasan).toBe('KATEGORI_TIDAK_DIKENAL')
  })

  it('mencocokkan angka ke nilai_skor persis saat rubrik tanpa ambang', () => {
    const hasil = pilihKategori(90, KATEGORI_PENDIDIKAN, 'KATEGORI_TETAP')
    expect(hasil.skor).toBe(90)
    expect(hasil.kategoriTerpilih).toBe('Magister')
    expect(hasil.perluReview).toBe(false)
  })

  it('menandai nilai kosong', () => {
    const hasil = pilihKategori(null, KATEGORI_PENDIDIKAN, 'KATEGORI_TETAP')
    expect(hasil.perluReview).toBe(true)
    expect(hasil.alasan).toBe('NILAI_KOSONG')
  })
})

describe('§2.6 mode NILAI_LANGSUNG', () => {
  it('memakai nilai mentah sebagai skor, kategori hanya label', () => {
    const hasil = pilihKategori(93.47, KATEGORI_POTKOM, 'NILAI_LANGSUNG')
    expect(hasil.skor).toBe(93.47)
    expect(hasil.kategoriTerpilih).toBe('Memenuhi Syarat')
    expect(hasil.perluReview).toBe(false)
  })

  it('band tertinggi menang saat nilai persis di batas (80 → Memenuhi Syarat)', () => {
    // "Masih Memenuhi Syarat" tersimpan sbg min 68 / max 80 → 80 cocok di dua band
    const hasil = pilihKategori(80, KATEGORI_POTKOM, 'NILAI_LANGSUNG')
    expect(hasil.kategoriTerpilih).toBe('Memenuhi Syarat')
  })

  it('memotong nilai di atas 100 dan melaporkannya', () => {
    const hasil = pilihKategori(115.1, KATEGORI_POTKOM, 'NILAI_LANGSUNG')
    expect(hasil.skor).toBe(100)
    expect(hasil.perluReview).toBe(true)
    expect(hasil.alasan).toBe('NILAI_DI_CLAMP')
  })

  it('menolak nilai berupa teks', () => {
    const hasil = pilihKategori('tinggi', KATEGORI_POTKOM, 'NILAI_LANGSUNG')
    expect(hasil.perluReview).toBe(true)
    expect(hasil.alasan).toBe('KATEGORI_TIDAK_DIKENAL')
  })
})

describe('§2.8 rubrik ambang: rentang kontinu vs berlubang', () => {
  it('rentang kontinu memberi hasil tanpa perlu review', () => {
    expect(pilihKategori(6, KATEGORI_LAMA_JABATAN_KONTINU, 'KATEGORI_TETAP')).toMatchObject({
      skor: 100,
      perluReview: false,
    })
    expect(pilihKategori(4.1, KATEGORI_LAMA_JABATAN_KONTINU, 'KATEGORI_TETAP')).toMatchObject({
      skor: 80,
      perluReview: false,
    })
    expect(pilihKategori(2, KATEGORI_LAMA_JABATAN_KONTINU, 'KATEGORI_TETAP')).toMatchObject({
      skor: 80,
      perluReview: false,
    })
    expect(pilihKategori(1.9, KATEGORI_LAMA_JABATAN_KONTINU, 'KATEGORI_TETAP')).toMatchObject({
      skor: 60,
      perluReview: false,
    })
    // batas bawah band teratas: tepat 5 tahun → 100, bukan 80
    expect(pilihKategori(5, KATEGORI_LAMA_JABATAN_KONTINU, 'KATEGORI_TETAP').skor).toBe(100)
  })

  it('rentang berlubang: 4,1 tahun tetap dapat skor terdekat di bawah + ditandai', () => {
    // Kasus nyata: Siti Rahayu 4,1 tahun jatuh di celah (4,5) rubrik asli
    const hasil = pilihKategori(4.1, KATEGORI_LAMA_JABATAN_BERLUBANG, 'KATEGORI_TETAP')
    expect(hasil.skor).toBe(80)
    expect(hasil.perluReview).toBe(true)
    expect(hasil.alasan).toBe('DI_LUAR_AMBANG')
  })

  it('rentang berlubang: 2,5 tahun jatuh ke band terbawah + ditandai', () => {
    const hasil = pilihKategori(2.5, KATEGORI_LAMA_JABATAN_BERLUBANG, 'KATEGORI_TETAP')
    expect(hasil.skor).toBe(60)
    expect(hasil.perluReview).toBe(true)
  })
})

// =============================================================================
// §2.5 Agregasi berjenjang
// =============================================================================

describe('§2.5 agregasi berjenjang', () => {
  const rubrik = rubrikJabatanTarget()

  it('bobot komponen sumbu X berjumlah 100%', () => {
    expect(totalBobotKomponen(rubrik, 'X_POTENSIAL')).toBe(1)
  })

  it('sub-indikator tanpa bobot digabung rata-rata sederhana', () => {
    const nilai: PetaNilai = {
      [ID_INDIKATOR.potkom]: 100,
      [ID_INDIKATOR.tingkatPendidikan]: 'Magister',
      [ID_INDIKATOR.kesesuaianBidangIlmu]: 100,
      [ID_INDIKATOR.pengembanganKompetensi]: 100,
      [ID_INDIKATOR.lamaJabatan]: 6, // → 100
      [ID_INDIKATOR.keragamanJabatan]: 80,
      [ID_INDIKATOR.substansiJabatan]: 60,
      [ID_INDIKATOR.integritas]: 'Tidak Pernah',
    }

    const hasil = hitungSumbu(rubrik, 'X_POTENSIAL', nilai)
    const kualifikasi = hasil.komponen.find((k) => k.namaKomponen === 'Kualifikasi Jabatan')!
    const pengalaman = kualifikasi.indikator.find(
      (i) => i.indikatorId === ID_INDIKATOR.pengalamanJabatan,
    )!

    // (100 + 80 + 60) / 3 = 80
    expect(pengalaman.skor).toBe(80)
    expect(pengalaman.anak).toHaveLength(3)
    // 4 indikator @5% → rata-rata sederhana (90 + 100 + 100 + 80)/4
    expect(kualifikasi.skor).toBe(92.5)
  })

  it('indikator agregator memakai bobot sendiri di level komponen', () => {
    const hasil = hitungSumbu(rubrik, 'X_POTENSIAL', {
      [ID_INDIKATOR.potkom]: 0,
      [ID_INDIKATOR.tingkatPendidikan]: 'SLTA', // 60
      [ID_INDIKATOR.kesesuaianBidangIlmu]: 50,
      [ID_INDIKATOR.pengembanganKompetensi]: 50,
      [ID_INDIKATOR.lamaJabatan]: 1, // 60
      [ID_INDIKATOR.keragamanJabatan]: 60,
      [ID_INDIKATOR.substansiJabatan]: 0,
      [ID_INDIKATOR.integritas]: 'Tidak Pernah',
    })
    const kualifikasi = hasil.komponen.find((k) => k.namaKomponen === 'Kualifikasi Jabatan')!
    // pengalaman = (60+60+0)/3 = 40 ; kualifikasi = (60+50+50+40)/4 = 50
    expect(kualifikasi.skor).toBe(50)
  })

  it('melaporkan sumbu yang tidak punya komponen sama sekali', () => {
    // Rubrik jabatan target sengaja tidak punya komponen Y (K-4)
    const hasil = hitungSumbu(rubrik, 'Y_KINERJA', {})
    expect(hasil.skor).toBe(0)
    expect(hasil.perluReview).toBe(true)
    expect(hasil.catatanReview[0]!.alasan).toBe('RUBRIK_KOSONG')
  })

  it('mengumpulkan catatan review dari indikator terdalam', () => {
    const hasil = hitungSumbu(rubrik, 'X_POTENSIAL', {
      [ID_INDIKATOR.potkom]: 90,
      [ID_INDIKATOR.tingkatPendidikan]: 'Magister',
      [ID_INDIKATOR.kesesuaianBidangIlmu]: 100,
      [ID_INDIKATOR.pengembanganKompetensi]: 100,
      // lamaJabatan sengaja tidak diisi → NILAI_KOSONG dari kedalaman 2
      [ID_INDIKATOR.keragamanJabatan]: 80,
      [ID_INDIKATOR.substansiJabatan]: 60,
      [ID_INDIKATOR.integritas]: 'Tidak Pernah',
    })
    expect(hasil.perluReview).toBe(true)
    expect(hasil.catatanReview.some((c) => c.alasan === 'NILAI_KOSONG')).toBe(true)
    expect(
      hasil.catatanReview.some((c) => c.indikatorId === ID_INDIKATOR.lamaJabatan),
    ).toBe(true)
  })
})

// =============================================================================
// §2.2 Formula A lewat mesin rubrik generik
// =============================================================================

describe('§2.2 Formula A memakai mesin rubrik yang sama', () => {
  it('sumbu Y generik = skor predikat', () => {
    const hasil = hitungSumbu(RUBRIK_GENERIK, 'Y_KINERJA', {
      [ID_INDIKATOR.predikatGenerik]: 'Baik',
    })
    expect(hasil.skor).toBe(80)
  })

  it('sumbu X generik = potkom apa adanya (setelah clamp)', () => {
    expect(
      hitungSumbu(RUBRIK_GENERIK, 'X_POTENSIAL', { [ID_INDIKATOR.potkomGenerik]: 93.47 }).skor,
    ).toBe(93.47)
    expect(
      hitungSumbu(RUBRIK_GENERIK, 'X_POTENSIAL', { [ID_INDIKATOR.potkomGenerik]: 115.1 }).skor,
    ).toBe(100)
  })
})

// =============================================================================
// §2.4 Formula B — Match Score
// =============================================================================

describe('§2.4 Match Score (65/20/15)', () => {
  const rubrik = rubrikJabatanTarget()

  it('mereproduksi kasus kandidat berkualifikasi penuh → 98,50', () => {
    const hasil = hitungMatchScore(rubrik, {
      [ID_INDIKATOR.potkom]: 100,
      [ID_INDIKATOR.tingkatPendidikan]: 'Magister', // 90
      [ID_INDIKATOR.kesesuaianBidangIlmu]: 100,
      [ID_INDIKATOR.pengembanganKompetensi]: 100,
      [ID_INDIKATOR.lamaJabatan]: 6, // 100
      [ID_INDIKATOR.keragamanJabatan]: 80,
      [ID_INDIKATOR.substansiJabatan]: 60,
      [ID_INDIKATOR.integritas]: 'Tidak Pernah', // 100
    })

    expect(hasil.skorPotensiKompetensi).toBe(100)
    expect(hasil.skorKualifikasiJabatan).toBe(92.5)
    expect(hasil.skorIntegritasMoralitas).toBe(100)
    // 100×0,65 + 92,5×0,20 + 100×0,15 = 65 + 18,5 + 15
    expect(hasil.skorTotal).toBe(98.5)
    expect(hasil.perluReview).toBe(false)
  })

  it('mereproduksi kandidat dengan hukuman disiplin ringan → 79,72', () => {
    const hasil = hitungMatchScore(rubrik, {
      [ID_INDIKATOR.potkom]: 82,
      [ID_INDIKATOR.tingkatPendidikan]: 'S1/DIV', // 80
      [ID_INDIKATOR.kesesuaianBidangIlmu]: 100,
      [ID_INDIKATOR.pengembanganKompetensi]: 50,
      [ID_INDIKATOR.lamaJabatan]: 6, // 100
      [ID_INDIKATOR.keragamanJabatan]: 60,
      [ID_INDIKATOR.substansiJabatan]: 60,
      [ID_INDIKATOR.integritas]: 'Ringan', // 75
    })

    // pengalaman = (100+60+60)/3 = 73,33 ; kualifikasi = (80+100+50+73,33)/4 = 75,83
    expect(hasil.skorKualifikasiJabatan).toBe(75.83)
    expect(hasil.skorIntegritasMoralitas).toBe(75)
    expect(hasil.skorTotal).toBe(79.72)
  })

  it('indikator yang sama bisa beda skor antar jabatan target (alasan U-3)', () => {
    // Pegawai yang sama, hanya relevansi diklat berbeda: 50 → 100
    const dasar: PetaNilai = {
      [ID_INDIKATOR.potkom]: 82,
      [ID_INDIKATOR.tingkatPendidikan]: 'S1/DIV',
      [ID_INDIKATOR.kesesuaianBidangIlmu]: 100,
      [ID_INDIKATOR.lamaJabatan]: 6,
      [ID_INDIKATOR.keragamanJabatan]: 60,
      [ID_INDIKATOR.substansiJabatan]: 60,
      [ID_INDIKATOR.integritas]: 'Ringan',
    }

    const targetA = hitungMatchScore(rubrik, {
      ...dasar,
      [ID_INDIKATOR.pengembanganKompetensi]: 50,
    })
    const targetB = hitungMatchScore(rubrik, {
      ...dasar,
      [ID_INDIKATOR.pengembanganKompetensi]: 100,
    })

    expect(targetA.skorKualifikasiJabatan).toBe(75.83)
    expect(targetB.skorKualifikasiJabatan).toBe(88.33)
    expect(targetA.skorTotal).toBe(79.72)
    expect(targetB.skorTotal).toBe(82.22)
  })

  it('skor total tidak terpengaruh unsur kinerja (bukti K-4)', () => {
    const nilai: PetaNilai = {
      [ID_INDIKATOR.potkom]: 90,
      [ID_INDIKATOR.tingkatPendidikan]: 'Magister',
      [ID_INDIKATOR.kesesuaianBidangIlmu]: 100,
      [ID_INDIKATOR.pengembanganKompetensi]: 100,
      [ID_INDIKATOR.lamaJabatan]: 6,
      [ID_INDIKATOR.keragamanJabatan]: 100,
      [ID_INDIKATOR.substansiJabatan]: 100,
      [ID_INDIKATOR.integritas]: 'Tidak Pernah',
      // predikat kinerja sengaja disertakan — harus DIABAIKAN
      [ID_INDIKATOR.predikatGenerik]: 'Sangat Kurang',
    }
    const hasil = hitungMatchScore(rubrik, nilai)
    expect(hasil.detail.komponen.every((k) => k.sumbu === 'X_POTENSIAL')).toBe(true)
    expect(hasil.skorTotal).toBeGreaterThan(90)
  })

  it('meratakan pohon hasil sampai sub-indikator untuk match_score_detail', () => {
    const hasil = hitungMatchScore(rubrik, {
      [ID_INDIKATOR.potkom]: 90,
      [ID_INDIKATOR.tingkatPendidikan]: 'Magister',
      [ID_INDIKATOR.kesesuaianBidangIlmu]: 100,
      [ID_INDIKATOR.pengembanganKompetensi]: 100,
      [ID_INDIKATOR.lamaJabatan]: 6,
      [ID_INDIKATOR.keragamanJabatan]: 80,
      [ID_INDIKATOR.substansiJabatan]: 60,
      [ID_INDIKATOR.integritas]: 'Tidak Pernah',
    })

    const baris = ratakanDetail(hasil.detail)
    // 6 indikator top-level + 3 sub-indikator
    expect(baris).toHaveLength(9)

    const sub = baris.filter((b) => b.kedalaman === 1)
    expect(sub).toHaveLength(3)
    expect(sub.every((b) => b.parentIndikatorId === ID_INDIKATOR.pengalamanJabatan)).toBe(true)

    const potkom = baris.find((b) => b.rubrikIndikatorId === ID_INDIKATOR.potkom)!
    expect(potkom.nilaiMentah).toBe(90)
    expect(potkom.kategoriTerpilih).toBe('Memenuhi Syarat')
  })
})

describe('ranking talent pool', () => {
  it('urut skor menurun, seri diputus oleh nilai kinerja', () => {
    const hasil = hitungRanking([
      { pegawaiId: 1, skorTotal: 90, nilaiKinerjaY: 80 },
      { pegawaiId: 2, skorTotal: 95, nilaiKinerjaY: 60 },
      { pegawaiId: 3, skorTotal: 90, nilaiKinerjaY: 100 },
    ])

    expect(hasil.map((h) => h.pegawaiId)).toEqual([2, 3, 1])
    expect(hasil.map((h) => h.ranking)).toEqual([1, 2, 3])
  })
})

// =============================================================================
// §2.7 Integritas & Moralitas
// =============================================================================

describe('§2.7 skor integritas', () => {
  it('tanpa riwayat hukuman → 100', () => {
    const hasil = hitungSkorIntegritas([])
    expect(hasil.skor).toBe(100)
    expect(hasil.tingkatTerberat).toBe('Tidak Pernah')
  })

  it.each([
    ['Ringan', 75],
    ['Sedang', 50],
    ['Berat', 25],
    ['Sedang Menjalani', 0],
  ] as const)('hukuman aktif %s → %i', (tingkat, harapan) => {
    expect(hitungSkorIntegritas([{ tingkatHukuman: tingkat, statusAktif: true }]).skor).toBe(
      harapan,
    )
  })

  it('riwayat tidak aktif TIDAK menurunkan skor, tapi tetap dilaporkan', () => {
    const hasil = hitungSkorIntegritas([{ tingkatHukuman: 'Sedang', statusAktif: false }])
    expect(hasil.skor).toBe(100)
    expect(hasil.jumlahNonaktif).toBe(1)
    expect(hasil.keterangan).toContain('tidak berlaku')
  })

  it('mengambil yang TERBERAT bila ada beberapa riwayat aktif', () => {
    const hasil = hitungSkorIntegritas([
      { tingkatHukuman: 'Ringan', statusAktif: true },
      { tingkatHukuman: 'Berat', statusAktif: true },
      { tingkatHukuman: 'Sedang', statusAktif: true },
    ])
    expect(hasil.tingkatTerberat).toBe('Berat')
    expect(hasil.skor).toBe(25)
    expect(hasil.jumlahAktif).toBe(3)
  })

  it('mengabaikan baris "Tidak Pernah" sebagai penurun skor', () => {
    expect(
      hitungSkorIntegritas([{ tingkatHukuman: 'Tidak Pernah', statusAktif: true }]).skor,
    ).toBe(100)
  })
})

// =============================================================================
// §2.9 Masa berlaku asesmen
// =============================================================================

describe('§2.9 masa berlaku asesmen (default 3 tahun)', () => {
  it('asesmen tahun berjalan masih berlaku', () => {
    expect(evaluasiMasaBerlaku(2026, 'Berlaku', { tahunSekarang: 2026 }).kedaluwarsa).toBe(false)
  })

  it('tepat di batas masa berlaku masih berlaku', () => {
    expect(evaluasiMasaBerlaku(2023, 'Berlaku', { tahunSekarang: 2026 }).kedaluwarsa).toBe(false)
  })

  it('lewat masa berlaku → kedaluwarsa', () => {
    const hasil = evaluasiMasaBerlaku(2021, 'Expired', { tahunSekarang: 2026 })
    expect(hasil.kedaluwarsa).toBe(true)
    expect(hasil.umurTahun).toBe(5)
    expect(hasil.tahunKedaluwarsa).toBe(2024)
    expect(hasil.bedaDenganSumber).toBe(false)
  })

  it('menandai status sumber yang tidak masuk akal (2026 tapi Expired)', () => {
    const hasil = evaluasiMasaBerlaku(2026, 'Expired', { tahunSekarang: 2026 })
    expect(hasil.kedaluwarsa).toBe(false)
    expect(hasil.bedaDenganSumber).toBe(true)
    expect(hasil.keterangan).toContain('tidak sejalan')
  })

  it('masa berlaku bisa diubah lewat parameter, bukan konstanta tersebar', () => {
    expect(
      evaluasiMasaBerlaku(2021, null, { tahunSekarang: 2026, masaBerlakuTahun: 10 }).kedaluwarsa,
    ).toBe(false)
  })

  it('status Draft tidak layak dipakai penilaian', () => {
    expect(asesmenLayakDipakai(2026, 'Draft', { tahunSekarang: 2026 })).toBe(false)
    expect(asesmenLayakDipakai(2026, 'Berlaku', { tahunSekarang: 2026 })).toBe(true)
  })
})

// =============================================================================
// Eligibility
// =============================================================================

describe('seleksi kelayakan', () => {
  const asesmenBerlaku = { tahunAsesmen: 2025, statusAsesmen: 'Berlaku' as const }

  it('meloloskan pegawai yang memenuhi pendidikan minimal', () => {
    const hasil = evaluasiKelayakan(
      [
        {
          id: 1,
          jenisSyarat: 'PENDIDIKAN_MIN',
          deskripsi: 'Minimal S1',
          nilaiMinimal: 'S1_D4',
        },
      ],
      {
        tingkatPendidikan: 'S2',
        bidangStudi: ['Teknik Sipil'],
        eselonTertinggi: 'III',
        totalPengalamanTahun: 8,
        asesmen: asesmenBerlaku,
      },
      { tahunSekarang: 2026 },
    )

    expect(hasil.eligible).toBe(true)
    expect(hasil.perluVerifikasiManual).toBe(false)
  })

  it('menggagalkan pegawai di bawah pendidikan minimal', () => {
    const hasil = evaluasiKelayakan(
      [{ id: 1, jenisSyarat: 'PENDIDIKAN_MIN', deskripsi: 'Minimal S2', nilaiMinimal: 'S2' }],
      {
        tingkatPendidikan: 'S1_D4',
        bidangStudi: [],
        eselonTertinggi: 'III',
        totalPengalamanTahun: 8,
        asesmen: asesmenBerlaku,
      },
      { tahunSekarang: 2026 },
    )

    expect(hasil.eligible).toBe(false)
    expect(hasil.catatan).toContain('Tidak memenuhi')
  })

  it('syarat tanpa nilai_minimal ditandai perlu verifikasi manual, bukan lolos/gagal diam-diam', () => {
    const hasil = evaluasiKelayakan(
      [
        { id: 2, jenisSyarat: 'BIDANG_ILMU', deskripsi: 'Semua jurusan', nilaiMinimal: null },
        { id: 3, jenisSyarat: 'PENGALAMAN_MIN', deskripsi: 'Setara eselon IV', nilaiMinimal: null },
      ],
      {
        tingkatPendidikan: 'S2',
        bidangStudi: ['Teknik Sipil'],
        eselonTertinggi: 'IV',
        totalPengalamanTahun: 5,
        asesmen: asesmenBerlaku,
      },
      { tahunSekarang: 2026 },
    )

    expect(hasil.eligible).toBe(true)
    expect(hasil.perluVerifikasiManual).toBe(true)
    expect(hasil.rincian.filter((r) => r.status === 'PERLU_VERIFIKASI_MANUAL')).toHaveLength(2)
  })

  it('mengevaluasi bidang ilmu bila daftarnya terstruktur', () => {
    const profil = {
      tingkatPendidikan: 'S1_D4' as const,
      bidangStudi: ['Teknik Sipil'],
      eselonTertinggi: 'IV' as const,
      totalPengalamanTahun: 5,
      asesmen: asesmenBerlaku,
    }

    const lolos = evaluasiKelayakan(
      [{ id: 1, jenisSyarat: 'BIDANG_ILMU', deskripsi: '', nilaiMinimal: 'teknik, konstruksi' }],
      profil,
      { tahunSekarang: 2026 },
    )
    expect(lolos.eligible).toBe(true)

    const gagal = evaluasiKelayakan(
      [{ id: 1, jenisSyarat: 'BIDANG_ILMU', deskripsi: '', nilaiMinimal: 'hukum, ekonomi' }],
      profil,
      { tahunSekarang: 2026 },
    )
    expect(gagal.eligible).toBe(false)

    const semua = evaluasiKelayakan(
      [{ id: 1, jenisSyarat: 'BIDANG_ILMU', deskripsi: '', nilaiMinimal: 'semua' }],
      profil,
      { tahunSekarang: 2026 },
    )
    expect(semua.eligible).toBe(true)
  })

  it('mengevaluasi pengalaman berbasis eselon minimal', () => {
    const hasil = evaluasiKelayakan(
      [{ id: 1, jenisSyarat: 'PENGALAMAN_MIN', deskripsi: '', nilaiMinimal: 'III' }],
      {
        tingkatPendidikan: 'S2',
        bidangStudi: [],
        eselonTertinggi: 'IV',
        totalPengalamanTahun: 9,
        asesmen: asesmenBerlaku,
      },
      { tahunSekarang: 2026 },
    )
    expect(hasil.eligible).toBe(false)
    expect(hasil.rincian[0]!.keterangan).toContain('di bawah syarat minimal III')
  })

  it('riwayat jabatan belum terpetakan → verifikasi manual, bukan gagal', () => {
    const hasil = evaluasiKelayakan(
      [{ id: 1, jenisSyarat: 'PENGALAMAN_MIN', deskripsi: '', nilaiMinimal: 'IV' }],
      {
        tingkatPendidikan: 'S2',
        bidangStudi: [],
        eselonTertinggi: null,
        totalPengalamanTahun: null,
        asesmen: asesmenBerlaku,
      },
      { tahunSekarang: 2026 },
    )
    expect(hasil.eligible).toBe(true)
    expect(hasil.perluVerifikasiManual).toBe(true)
  })

  it('asesmen kedaluwarsa membatalkan kelayakan', () => {
    const hasil = evaluasiKelayakan(
      [{ id: 1, jenisSyarat: 'PENDIDIKAN_MIN', deskripsi: '', nilaiMinimal: 'S1_D4' }],
      {
        tingkatPendidikan: 'S2',
        bidangStudi: [],
        eselonTertinggi: 'III',
        totalPengalamanTahun: 10,
        asesmen: { tahunAsesmen: 2021, statusAsesmen: 'Expired' },
      },
      { tahunSekarang: 2026 },
    )
    expect(hasil.eligible).toBe(false)
    expect(hasil.rincian.at(-1)!.keterangan).toContain('kedaluwarsa')
  })

  it('pegawai tanpa asesmen tidak eligible', () => {
    const hasil = evaluasiKelayakan([], {
      tingkatPendidikan: 'S2',
      bidangStudi: [],
      eselonTertinggi: 'III',
      totalPengalamanTahun: 10,
      asesmen: null,
    })
    expect(hasil.eligible).toBe(false)
  })
})
