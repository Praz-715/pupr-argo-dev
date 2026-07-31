import { describe, expect, it } from 'vitest'

import {
  eselonTertinggi,
  labelTingkatPendidikan,
  memenuhiPendidikanMinimal,
  nilaiKeragamanJabatan,
  nilaiKesesuaianBidangIlmu,
  nilaiLamaJabatan,
  nilaiPengembanganKompetensi,
  nilaiSubstansiJabatan,
  petaNilaiIndikator,
  totalPengalamanTahun,
  type RiwayatJabatanUntukSkor,
} from './penilaian'
import { hitungMatchScore } from './scoring'
import { ID_INDIKATOR, rubrikJabatanTarget } from './scoring/fixture'

const SEKARANG = new Date(2026, 6, 30, 12)

function riwayat(p: Partial<RiwayatJabatanUntukSkor> = {}): RiwayatJabatanUntukSkor {
  return {
    jabatanNamaMentah: 'Kepala Seksi Pengadaan',
    jabatanId: 3,
    jenjang: 'Pengawas',
    eselon: 'IV',
    unitOrganisasiId: 7,
    tanggalMulai: new Date(2020, 0, 1, 12),
    tanggalAkhir: new Date(2023, 0, 1, 12),
    ...p,
  }
}

describe('label tingkat pendidikan → kategori rubrik', () => {
  it.each([
    ['S3', 'Doktor'],
    ['S2', 'Magister'],
    ['S1_D4', 'S1/DIV'],
    ['D3', 'DIII'],
    ['SLTA', 'SLTA'],
  ] as const)('%s → %s', (tingkat, label) => {
    expect(labelTingkatPendidikan(tingkat)).toBe(label)
  })

  it('null bila tidak diketahui', () => {
    expect(labelTingkatPendidikan(null)).toBeNull()
  })

  it('label cocok dengan kategori rubrik sesungguhnya', () => {
    // Kalau label & nama kategori tidak sinkron, mesin rubrik akan menandai
    // KATEGORI_TIDAK_DIKENAL — uji ini yang menangkapnya lebih dulu.
    const rubrik = rubrikJabatanTarget()
    const komponen = rubrik.find((k) => k.namaKomponen === 'Kualifikasi Jabatan')!
    const indikator = komponen.indikator.find(
      (i) => i.id === ID_INDIKATOR.tingkatPendidikan,
    )!
    const namaKategori = indikator.kategori.map((k) => k.namaKategori)

    for (const tingkat of ['S3', 'S2', 'S1_D4', 'D3', 'SLTA'] as const) {
      expect(namaKategori).toContain(labelTingkatPendidikan(tingkat))
    }
  })
})

describe('Kesesuaian Bidang Ilmu (§B.2.2)', () => {
  it('kata kunci "semua" meloloskan bidang apa pun', () => {
    expect(nilaiKesesuaianBidangIlmu(['Ilmu Hukum'], ['semua'])).toBe(100)
  })

  it('cocok sebagian nama bidang', () => {
    expect(nilaiKesesuaianBidangIlmu(['Teknik Sipil'], ['teknik', 'konstruksi'])).toBe(100)
  })

  it('tidak cocok → 50, bukan 0', () => {
    expect(nilaiKesesuaianBidangIlmu(['Ilmu Hukum'], ['teknik', 'konstruksi'])).toBe(50)
  })

  it('tanpa riwayat pendidikan → 50', () => {
    expect(nilaiKesesuaianBidangIlmu([], ['teknik'])).toBe(50)
  })

  it('kata kunci kosong → 50 (tidak bisa dinyatakan sesuai)', () => {
    expect(nilaiKesesuaianBidangIlmu(['Teknik Sipil'], [])).toBe(50)
  })
})

describe('Pengembangan Kompetensi (§B.2.3)', () => {
  it('punya diklat relevan → 100', () => {
    expect(
      nilaiPengembanganKompetensi(
        ['Diklat Pengadaan Barang/Jasa Tingkat Lanjut'],
        ['pengadaan'],
      ),
    ).toBe(100)
  })

  it('tidak punya diklat relevan → 50', () => {
    expect(nilaiPengembanganKompetensi(['Diklat Kearsipan'], ['pengadaan'])).toBe(50)
  })

  it('"semua" TIDAK membebaskan syarat diklat', () => {
    // "semua jurusan diperbolehkan" adalah kelonggaran pendidikan formal,
    // bukan pembebasan relevansi diklat.
    expect(nilaiPengembanganKompetensi(['Diklat Kearsipan'], ['semua'])).toBe(50)
    expect(nilaiPengembanganKompetensi(['Diklat Pengadaan'], ['semua', 'pengadaan'])).toBe(100)
  })

  it('tanpa riwayat diklat → 50', () => {
    expect(nilaiPengembanganKompetensi([], ['pengadaan'])).toBe(50)
  })
})

describe('Lama Jabatan (§B.2.4.a) — dikembalikan sbg jumlah tahun', () => {
  it('mengakumulasi seluruh riwayat pada jenjang yang sama', () => {
    const hasil = nilaiLamaJabatan(
      [
        riwayat({
          jenjang: 'Administrator',
          tanggalMulai: new Date(2018, 0, 1, 12),
          tanggalAkhir: new Date(2021, 0, 1, 12),
        }),
        riwayat({
          jenjang: 'Administrator',
          tanggalMulai: new Date(2021, 0, 1, 12),
          tanggalAkhir: new Date(2023, 0, 1, 12),
        }),
        riwayat({ jenjang: 'Pengawas', tanggalMulai: new Date(2015, 0, 1, 12) }),
      ],
      'Administrator',
      new Date(2023, 0, 1, 12),
      SEKARANG,
    )
    // 3 tahun + 2 tahun = 5 → masuk band tertinggi
    expect(hasil).toBeGreaterThanOrEqual(4.99)
    expect(hasil).toBeLessThan(5.02)
  })

  it('riwayat tanpa tanggal akhir dihitung sampai sekarang', () => {
    const hasil = nilaiLamaJabatan(
      [
        riwayat({
          jenjang: 'Administrator',
          tanggalMulai: new Date(2024, 6, 30, 12),
          tanggalAkhir: null,
        }),
      ],
      'Administrator',
      null,
      SEKARANG,
    )
    expect(hasil).toBeGreaterThan(1.9)
    expect(hasil).toBeLessThan(2.1)
  })

  it('jatuh ke tmt_jabatan bila riwayat belum bertanggal', () => {
    const hasil = nilaiLamaJabatan(
      [riwayat({ jenjang: 'Administrator', tanggalMulai: null })],
      'Administrator',
      new Date(2022, 5, 1, 12),
      SEKARANG,
    )
    expect(hasil).toBeGreaterThan(4)
    expect(hasil).toBeLessThan(4.2)
  })

  it('null bila tidak ada data sama sekali (bukan 0)', () => {
    expect(nilaiLamaJabatan([], null, null, SEKARANG)).toBeNull()
  })

  it('nilai tahun cocok dengan ambang rubrik yang sudah kontinu', () => {
    const rubrik = rubrikJabatanTarget()
    const hasil = hitungMatchScore(rubrik, {
      [ID_INDIKATOR.potkom]: 90,
      [ID_INDIKATOR.tingkatPendidikan]: 'Magister',
      [ID_INDIKATOR.kesesuaianBidangIlmu]: 100,
      [ID_INDIKATOR.pengembanganKompetensi]: 100,
      [ID_INDIKATOR.lamaJabatan]: 4.1, // celah rubrik asli; versi kontinu → 80
      [ID_INDIKATOR.keragamanJabatan]: 80,
      [ID_INDIKATOR.substansiJabatan]: 0,
      [ID_INDIKATOR.integritas]: 'Tidak Pernah',
    })
    expect(hasil.perluReview).toBe(false)
  })
})

describe('Keragaman Riwayat Jabatan (§B.2.4.b)', () => {
  it('ada riwayat di luar master DJBK → 100', () => {
    expect(
      nilaiKeragamanJabatan([
        riwayat(),
        riwayat({ jabatanId: null, unitOrganisasiId: null, jenjang: null, eselon: null }),
      ]),
    ).toBe(100)
  })

  it('lintas ≥2 unit kerja di dalam DJBK → 80', () => {
    expect(
      nilaiKeragamanJabatan([
        riwayat({ unitOrganisasiId: 7 }),
        riwayat({ unitOrganisasiId: 11 }),
      ]),
    ).toBe(80)
  })

  it('hanya satu unit kerja → 60', () => {
    expect(
      nilaiKeragamanJabatan([
        riwayat({ unitOrganisasiId: 7 }),
        riwayat({ unitOrganisasiId: 7 }),
      ]),
    ).toBe(60)
  })

  it('tanpa riwayat → null (ditandai kosong, bukan 60)', () => {
    expect(nilaiKeragamanJabatan([])).toBeNull()
  })
})

describe('Substansi Riwayat Jabatan (§B.2.4.c)', () => {
  it('Plt pada jenjang lebih tinggi → 100', () => {
    expect(
      nilaiSubstansiJabatan(
        [riwayat({ jabatanNamaMentah: 'Plt Kepala Balai BP2JK Wilayah DKI', eselon: 'III' })],
        'IV',
      ),
    ).toBe(100)
  })

  it('Plt pada jenjang setara → 80', () => {
    expect(
      nilaiSubstansiJabatan(
        [riwayat({ jabatanNamaMentah: 'Pelaksana Tugas Kepala Seksi Pengadaan', eselon: 'IV' })],
        'IV',
      ),
    ).toBe(80)
  })

  it('Plh pada jenjang lebih tinggi → 60', () => {
    expect(
      nilaiSubstansiJabatan(
        [riwayat({ jabatanNamaMentah: 'Plh Kepala Subdirektorat Pengadaan', eselon: 'III' })],
        'IV',
      ),
    ).toBe(60)
  })

  it('Plh pada jenjang setara → 40', () => {
    expect(
      nilaiSubstansiJabatan(
        [riwayat({ jabatanNamaMentah: 'Pelaksana Harian Kepala Seksi', eselon: 'IV' })],
        'IV',
      ),
    ).toBe(40)
  })

  it('tanpa riwayat non-definitif → 0', () => {
    expect(nilaiSubstansiJabatan([riwayat()], 'IV')).toBe(0)
  })

  it('mengambil yang paling menguntungkan bila ada beberapa', () => {
    expect(
      nilaiSubstansiJabatan(
        [
          riwayat({ jabatanNamaMentah: 'Plh Kepala Seksi', eselon: 'IV' }),
          riwayat({ jabatanNamaMentah: 'Plt Kepala Balai', eselon: 'III' }),
        ],
        'IV',
      ),
    ).toBe(100)
  })

  it('tidak salah tangkap kata "Pelaksana" pada jabatan definitif', () => {
    expect(
      nilaiSubstansiJabatan(
        [riwayat({ jabatanNamaMentah: 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi' })],
        'III',
      ),
    ).toBe(0)
  })
})

describe('turunan untuk kelayakan', () => {
  it('eselon tertinggi dari riwayat', () => {
    expect(
      eselonTertinggi([riwayat({ eselon: 'IV' }), riwayat({ eselon: 'II' }), riwayat({ eselon: 'III' })]),
    ).toBe('II')
    expect(eselonTertinggi([riwayat({ eselon: null })])).toBeNull()
  })

  it('total pengalaman tahun', () => {
    const total = totalPengalamanTahun(
      [
        riwayat({
          tanggalMulai: new Date(2016, 0, 1, 12),
          tanggalAkhir: new Date(2020, 0, 1, 12),
        }),
        riwayat({
          tanggalMulai: new Date(2020, 0, 1, 12),
          tanggalAkhir: new Date(2023, 0, 1, 12),
        }),
      ],
      SEKARANG,
    )
    expect(total).toBeGreaterThan(6.9)
    expect(total).toBeLessThan(7.1)
  })

  it('null bila seluruh riwayat belum bertanggal', () => {
    expect(totalPengalamanTahun([riwayat({ tanggalMulai: null })], SEKARANG)).toBeNull()
  })

  it('perbandingan pendidikan minimal', () => {
    expect(memenuhiPendidikanMinimal('S2', 'S1_D4')).toBe(true)
    expect(memenuhiPendidikanMinimal('S1_D4', 'S1_D4')).toBe(true)
    expect(memenuhiPendidikanMinimal('D3', 'S1_D4')).toBe(false)
    expect(memenuhiPendidikanMinimal(null, 'S1_D4')).toBe(false)
  })
})

describe('petaNilaiIndikator → rangkai penuh ke mesin rubrik', () => {
  const idIndikator = {
    potkom: ID_INDIKATOR.potkom,
    tingkatPendidikan: ID_INDIKATOR.tingkatPendidikan,
    kesesuaianBidangIlmu: ID_INDIKATOR.kesesuaianBidangIlmu,
    pengembanganKompetensi: ID_INDIKATOR.pengembanganKompetensi,
    lamaJabatan: ID_INDIKATOR.lamaJabatan,
    keragamanJabatan: ID_INDIKATOR.keragamanJabatan,
    substansiJabatan: ID_INDIKATOR.substansiJabatan,
    integritas: ID_INDIKATOR.integritas,
  }

  it('menghasilkan match score utuh tanpa perlu review', () => {
    const peta = petaNilaiIndikator(
      {
        pegawaiId: 1,
        tingkatPendidikan: 'S2',
        bidangStudi: ['Teknik Sipil'],
        riwayatDiklat: ['Diklat Pengadaan Barang/Jasa'],
        jenjangSaatIni: 'Administrator',
        eselonSaatIni: 'III',
        tmtJabatan: new Date(2019, 0, 1, 12),
        riwayatJabatan: [
          riwayat({
            jabatanNamaMentah: 'Kepala Balai BP2JK Wilayah DKI Jakarta',
            jenjang: 'Administrator',
            eselon: 'III',
            unitOrganisasiId: 11,
            tanggalMulai: new Date(2019, 0, 1, 12),
            tanggalAkhir: null,
          }),
          riwayat({
            jabatanNamaMentah: 'Plt Kepala Subdirektorat Pengadaan',
            jenjang: 'Administrator',
            eselon: 'II',
            unitOrganisasiId: 7,
            tanggalMulai: new Date(2017, 0, 1, 12),
            tanggalAkhir: new Date(2019, 0, 1, 12),
          }),
        ],
        potkom: 100,
        hukumanDisiplin: [],
      },
      { jabatanTargetId: 1, kataKunciRelevansi: ['semua', 'pengadaan'] },
      idIndikator,
      SEKARANG,
    )

    const hasil = hitungMatchScore(rubrikJabatanTarget(), peta)

    expect(hasil.perluReview).toBe(false)
    expect(hasil.skorPotensiKompetensi).toBe(100)
    expect(hasil.skorIntegritasMoralitas).toBe(100)
    // pendidikan 90 · bidang 100 · diklat 100 · pengalaman (100 lama, 100 keragaman? )
    expect(hasil.skorKualifikasiJabatan).toBeGreaterThan(90)
    expect(hasil.skorTotal).toBeGreaterThan(95)
  })

  it('potkom >100 tetap diterima mentah, mesin rubrik yang meng-clamp', () => {
    const peta = petaNilaiIndikator(
      {
        pegawaiId: 3,
        tingkatPendidikan: 'S2',
        bidangStudi: ['Teknik Sipil'],
        riwayatDiklat: ['Diklat Pengadaan'],
        jenjangSaatIni: 'Administrator',
        eselonSaatIni: 'III',
        tmtJabatan: new Date(2025, 6, 18, 12),
        riwayatJabatan: [riwayat({ jabatanId: null, unitOrganisasiId: null })],
        potkom: 115.1,
        hukumanDisiplin: [],
      },
      { jabatanTargetId: 1, kataKunciRelevansi: ['semua', 'pengadaan'] },
      idIndikator,
      SEKARANG,
    )

    expect(peta[ID_INDIKATOR.potkom]).toBe(115.1)

    const hasil = hitungMatchScore(rubrikJabatanTarget(), peta)
    expect(hasil.skorPotensiKompetensi).toBe(100)
    expect(hasil.perluReview).toBe(true)
    expect(hasil.catatanReview.some((c) => c.alasan === 'NILAI_DI_CLAMP')).toBe(true)
  })

  it('hukuman disiplin aktif menurunkan komponen integritas', () => {
    const peta = petaNilaiIndikator(
      {
        pegawaiId: 12,
        tingkatPendidikan: 'S1_D4',
        bidangStudi: ['Teknik Sipil'],
        riwayatDiklat: [],
        jenjangSaatIni: 'Administrator',
        eselonSaatIni: 'III',
        tmtJabatan: new Date(2025, 1, 10, 12),
        riwayatJabatan: [riwayat({ unitOrganisasiId: 14 })],
        potkom: 82,
        hukumanDisiplin: [{ tingkatHukuman: 'Ringan', statusAktif: true }],
      },
      { jabatanTargetId: 1, kataKunciRelevansi: ['semua', 'pengadaan'] },
      idIndikator,
      SEKARANG,
    )

    const hasil = hitungMatchScore(rubrikJabatanTarget(), peta)
    expect(hasil.skorIntegritasMoralitas).toBe(75)
  })

  it('hukuman disiplin nonaktif TIDAK menurunkan integritas', () => {
    const peta = petaNilaiIndikator(
      {
        pegawaiId: 15,
        tingkatPendidikan: 'S2',
        bidangStudi: ['Teknik Sipil'],
        riwayatDiklat: [],
        jenjangSaatIni: 'Ahli Utama',
        eselonSaatIni: 'NON_ESELON',
        tmtJabatan: new Date(2019, 3, 1, 12),
        riwayatJabatan: [riwayat({ unitOrganisasiId: 5 })],
        potkom: 97,
        hukumanDisiplin: [{ tingkatHukuman: 'Sedang', statusAktif: false }],
      },
      { jabatanTargetId: 3, kataKunciRelevansi: ['teknik', 'konstruksi'] },
      idIndikator,
      SEKARANG,
    )

    const hasil = hitungMatchScore(rubrikJabatanTarget(), peta)
    expect(hasil.skorIntegritasMoralitas).toBe(100)
  })
})
