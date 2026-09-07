import { describe, expect, it } from 'vitest'

import { ringkasPengalamanJenjang, type BarisRiwayatJenjang } from './pengalaman-jenjang'

const SEKARANG = new Date('2026-09-02')
const d = (s: string) => new Date(s)

/*
  Kasus Maul Hasworo (pegawai 116) — persis kelima baris riwayatnya di
  `pupr_dev_v2`, dan persis contoh yang pemilik proses pakai di PDF 2 Sep 2026:
  "terbaca masa kerja kurang dari 2 tahun padahal pengalaman dia di jabatan
  pengawas (kasubag TU dan kepala Seksi) sudah hampir 10 tahun".
*/
const RIWAYAT_MAUL: BarisRiwayatJenjang[] = [
  {
    namaMentah: 'Kepala Subbagian Umum dan Tata Usaha, Balai Pelaksana Pemilihan Jasa Konstruksi',
    namaUnit: null,
    tanggalMulai: d('2023-02-13'),
    tanggalAkhir: null,
    lamaBulan: null,
  },
  {
    namaMentah: 'PLH. Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Aceh',
    namaUnit: null,
    tanggalMulai: d('2026-07-07'),
    tanggalAkhir: d('2026-08-07'),
    lamaBulan: null,
  },
  {
    namaMentah: 'Penyusun Monev Dan Pelaporan Subdirektorat Kepatuhan Intern',
    namaUnit: null,
    tanggalMulai: d('2021-04-01'),
    tanggalAkhir: d('2023-02-12'),
    lamaBulan: null,
  },
  {
    namaMentah: 'Kasi Pencegahan dan Peningkatan Kualitas Dinas Perumahan Rakyat',
    namaUnit: null,
    tanggalMulai: d('2017-01-11'),
    tanggalAkhir: d('2021-03-31'),
    lamaBulan: null,
  },
  {
    namaMentah: 'Kasi Pemeliharaan Jalan dan Jembatan Dinas Pekerjaan Umum',
    namaUnit: null,
    tanggalMulai: d('2015-08-18'),
    tanggalAkhir: d('2017-01-10'),
    lamaBulan: null,
  },
]

describe('ringkasPengalamanJenjang — kasus Maul (PDF 2 Sep 2026 butir 3)', () => {
  const hasil = ringkasPengalamanJenjang(RIWAYAT_MAUL, SEKARANG)
  const pengawas = hasil.find((h) => h.jenjang === 'Pengawas')!
  const administrator = hasil.find((h) => h.jenjang === 'Administrator')!

  it('Pengawas ≈ 9,2 tahun — bukan 0,89 dari tmt_jabatan', () => {
    // 3,55 (Kasubbag, masih berjalan) + 4,22 (Kasi Pencegahan) + 1,40 (Kasi Pemeliharaan)
    expect(pengawas.totalTahun).toBeGreaterThan(9)
    expect(pengawas.totalTahun).toBeLessThan(9.5)
  })

  it('angkanya melewati ambang ≥5 tahun, jadi kategorinya yang tertinggi', () => {
    // Ini yang sebenarnya diminta: "Harusnya nilai 100."
    expect(pengawas.totalTahun).toBeGreaterThanOrEqual(5)
  })

  it('tiga baris Pengawas terhitung, jabatan pelaksana TIDAK ikut', () => {
    expect(pengawas.baris).toHaveLength(3)
    expect(pengawas.baris.map((b) => b.namaMentah).join(' ')).not.toMatch(/Penyusun Monev/)
  })

  it('PLH dipisah — tidak menambah masa definitif Administrator', () => {
    expect(administrator.totalTahun).toBe(0)
    expect(administrator.totalTahunSementara).toBeGreaterThan(0)
    expect(administrator.baris[0]?.penugasan).toBe('PLH')
  })

  it('ketiga jenjang selalu dikembalikan, termasuk yang nol', () => {
    expect(hasil.map((h) => h.jenjang)).toEqual(['JPT Pratama', 'Administrator', 'Pengawas'])
  })
})

describe('sumber lama tiap baris', () => {
  it('memakai `lamaBulan` ketika tanggalnya tidak ada', () => {
    const h = ringkasPengalamanJenjang(
      [
        {
          namaMentah: 'Kepala Sub Direktorat Kontrak Kontruksi',
          namaUnit: null,
          tanggalMulai: null,
          tanggalAkhir: null,
          lamaBulan: 30,
        },
      ],
      SEKARANG,
    )
    expect(h.find((x) => x.jenjang === 'Administrator')!.totalTahun).toBe(2.5)
  })

  /*
    KONTROL NEGATIF. Tanpa ini, "totalnya masuk akal" bisa berarti fungsinya
    memasukkan APA SAJA ke salah satu jenjang — kegagalan yang paling berbahaya di
    sini, sebab ia menaikkan masa kerja pada jenjang yang tidak pernah dijabat.
  */
  it('baris yang tidak terklasifikasi tidak masuk jenjang mana pun', () => {
    const h = ringkasPengalamanJenjang(
      [
        {
          namaMentah: 'Pejabat Pembuat Komitmen Pembinaan Manajemen II',
          namaUnit: null,
          tanggalMulai: d('2010-01-01'),
          tanggalAkhir: d('2020-01-01'),
          lamaBulan: null,
        },
      ],
      SEKARANG,
    )
    expect(h.every((x) => x.totalTahun === 0 && x.baris.length === 0)).toBe(true)
  })
})
