import { describe, expect, it } from 'vitest'

import { batasUsiaPensiun, hitungUsia, parseNip, proyeksiPensiun, selisihTahun } from './nip'

/** 16 NIP nyata dari pupr_dev — semuanya harus terparse (phase.md §3 K-6). */
const NIP_DEV: Array<{ nip: string; nama: string; lahir: string; jk: 'L' | 'P'; cpns: string }> = [
  { nip: '197805251998032005', nama: 'Rus', lahir: '1978-05-25', jk: 'P', cpns: '1998-03' },
  { nip: '197907292005021003', nama: 'Irwan', lahir: '1979-07-29', jk: 'L', cpns: '2005-02' },
  { nip: '198405202009121008', nama: 'Yatno', lahir: '1984-05-20', jk: 'L', cpns: '2009-12' },
  { nip: '197906192010121002', nama: 'Iwan', lahir: '1979-06-19', jk: 'L', cpns: '2010-12' },
  { nip: '198503192010121008', nama: 'Mardi', lahir: '1985-03-19', jk: 'L', cpns: '2010-12' },
  { nip: '198901292010121003', nama: 'Rahmat', lahir: '1989-01-29', jk: 'L', cpns: '2010-12' },
  { nip: '198508032008012001', nama: 'Tasya', lahir: '1985-08-03', jk: 'P', cpns: '2008-01' },
  { nip: '198506022008122001', nama: 'Tina', lahir: '1985-06-02', jk: 'P', cpns: '2008-12' },
  { nip: '198707012010122006', nama: 'Rachma', lahir: '1987-07-01', jk: 'P', cpns: '2010-12' },
  { nip: '197211081996031001', nama: 'Budi Santoso', lahir: '1972-11-08', jk: 'L', cpns: '1996-03' },
  { nip: '198503122010012002', nama: 'Siti Rahayu', lahir: '1985-03-12', jk: 'P', cpns: '2010-01' },
  { nip: '198006202006021003', nama: 'Ahmad Fauzi', lahir: '1980-06-20', jk: 'L', cpns: '2006-02' },
  { nip: '199009152015012004', nama: 'Dewi Anggraini', lahir: '1990-09-15', jk: 'P', cpns: '2015-01' },
  { nip: '199602282020011005', nama: 'Rizky Pratama', lahir: '1996-02-28', jk: 'L', cpns: '2020-01' },
  { nip: '196804041993032006', nama: 'Yuliana Wijaya', lahir: '1968-04-04', jk: 'P', cpns: '1993-03' },
  { nip: '198807192012021007', nama: 'Hendra Gunawan', lahir: '1988-07-19', jk: 'L', cpns: '2012-02' },
]

const HARI_INI = new Date(2026, 6, 30, 12, 0, 0) // 30 Juli 2026

describe('parseNip — data dev', () => {
  it('mengurai ke-16 NIP di pupr_dev tanpa satu pun gagal', () => {
    const gagal = NIP_DEV.filter((p) => !parseNip(p.nip, HARI_INI).valid)
    expect(gagal.map((g) => g.nama)).toEqual([])
  })

  it.each(NIP_DEV)('$nama: $nip', ({ nip, lahir, jk, cpns }) => {
    const hasil = parseNip(nip, HARI_INI)
    expect(hasil.valid).toBe(true)

    const [th, bl, hr] = lahir.split('-').map(Number)
    expect(hasil.tanggalLahir?.getFullYear()).toBe(th)
    expect(hasil.tanggalLahir?.getMonth()).toBe(bl! - 1)
    expect(hasil.tanggalLahir?.getDate()).toBe(hr)

    const [thCpns, blCpns] = cpns.split('-').map(Number)
    expect(hasil.tmtCpnsTahun).toBe(thCpns)
    expect(hasil.tmtCpnsBulan).toBe(blCpns)

    expect(hasil.jenisKelamin).toBe(jk)
  })

  it('komposisi gender data dev: 9 L / 7 P', () => {
    const jk = NIP_DEV.map((p) => parseNip(p.nip, HARI_INI).jenisKelamin)
    expect(jk.filter((x) => x === 'L')).toHaveLength(9)
    expect(jk.filter((x) => x === 'P')).toHaveLength(7)
  })
})

describe('parseNip — NIP tidak valid ditolak dengan alasan', () => {
  it('kosong', () => {
    expect(parseNip('').masalah).toContain('NIP kosong')
    expect(parseNip(null).valid).toBe(false)
  })

  it('panjang salah', () => {
    const hasil = parseNip('19780525199803200', HARI_INI) // 17 digit
    expect(hasil.valid).toBe(false)
    expect(hasil.masalah[0]).toContain('17 digit')
  })

  it('mengandung non-angka', () => {
    expect(parseNip('19780525 199803 2 005', HARI_INI).valid).toBe(false)
  })

  it('tanggal lahir tidak masuk akal (31 Februari)', () => {
    const hasil = parseNip('197802311998032005', HARI_INI)
    expect(hasil.valid).toBe(false)
    expect(hasil.masalah.some((m) => m.includes('Tanggal lahir tidak valid'))).toBe(true)
  })

  it('bulan lahir 00', () => {
    expect(parseNip('197800251998032005', HARI_INI).valid).toBe(false)
  })

  it('digit jenis kelamin tak dikenal', () => {
    const hasil = parseNip('197805251998039005', HARI_INI)
    expect(hasil.valid).toBe(false)
    expect(hasil.jenisKelamin).toBeNull()
    expect(hasil.masalah.some((m) => m.includes('jenis kelamin'))).toBe(true)
  })

  it('TMT CPNS di masa depan', () => {
    const hasil = parseNip('197805252099032005', HARI_INI)
    expect(hasil.valid).toBe(false)
    expect(hasil.masalah.some((m) => m.includes('masa depan'))).toBe(true)
  })

  it('bulan TMT CPNS tidak valid', () => {
    expect(parseNip('197805251998132005', HARI_INI).valid).toBe(false)
  })

  it('TMT CPNS kurang dari 17 tahun setelah lahir', () => {
    const hasil = parseNip('197805251990032005', HARI_INI)
    expect(hasil.valid).toBe(false)
    expect(hasil.masalah.some((m) => m.includes('17 tahun'))).toBe(true)
  })

  it('tetap mengembalikan bagian yang berhasil diurai meski ada masalah', () => {
    const hasil = parseNip('197805251998039005', HARI_INI)
    expect(hasil.tanggalLahir).not.toBeNull()
    expect(hasil.tmtCpnsTahun).toBe(1998)
  })
})

describe('usia & masa kerja', () => {
  it('menghitung usia dengan benar termasuk ulang tahun yang belum lewat', () => {
    const lahirSudahUlangTahun = new Date(1968, 3, 4, 12) // 4 Apr 1968
    expect(hitungUsia(lahirSudahUlangTahun, HARI_INI)).toBe(58)

    const lahirBelumUlangTahun = new Date(1968, 11, 4, 12) // 4 Des 1968
    expect(hitungUsia(lahirBelumUlangTahun, HARI_INI)).toBe(57)

    // tepat hari ulang tahun
    expect(hitungUsia(new Date(1968, 6, 30, 12), HARI_INI)).toBe(58)
  })

  it('usia null bila tanggal lahir tidak diketahui', () => {
    expect(hitungUsia(null, HARI_INI)).toBeNull()
  })

  it('selisih tahun desimal untuk lama jabatan', () => {
    const tmt = new Date(2022, 5, 1, 12) // 1 Jun 2022
    const lama = selisihTahun(tmt, HARI_INI)
    expect(lama).toBeGreaterThan(4)
    expect(lama).toBeLessThan(4.2)
  })

  it('tanggal di masa depan menghasilkan 0, bukan negatif', () => {
    expect(selisihTahun(new Date(2030, 0, 1, 12), HARI_INI)).toBe(0)
  })
})

describe('batas usia pensiun', () => {
  it('JF Ahli Utama → 65', () => {
    expect(batasUsiaPensiun('FUNGSIONAL_TERTENTU', 'Ahli Utama')).toBe(65)
  })

  it('JF Ahli Madya → 60', () => {
    expect(batasUsiaPensiun('FUNGSIONAL_TERTENTU', 'Ahli Madya')).toBe(60)
  })

  it('JF lainnya → 58', () => {
    expect(batasUsiaPensiun('FUNGSIONAL_TERTENTU', 'Ahli Muda')).toBe(58)
    expect(batasUsiaPensiun('FUNGSIONAL_TERTENTU', 'Ahli Pertama')).toBe(58)
  })

  it('JPT → 60', () => {
    expect(batasUsiaPensiun('STRUKTURAL', 'JPT Pratama')).toBe(60)
  })

  it('Administrator & Pengawas → 58', () => {
    expect(batasUsiaPensiun('STRUKTURAL', 'Administrator')).toBe(58)
    expect(batasUsiaPensiun('STRUKTURAL', 'Pengawas')).toBe(58)
  })

  it('jenjang tak dikenal jatuh ke 58 (paling konservatif)', () => {
    expect(batasUsiaPensiun(null, null)).toBe(58)
  })
})

describe('proyeksi pensiun (bahan halaman Risiko Kekosongan)', () => {
  it('Yuliana Wijaya (1968, Ahli Utama) pensiun 2033, belum mendesak', () => {
    const { tanggalLahir } = parseNip('196804041993032006', HARI_INI)
    const hasil = proyeksiPensiun(tanggalLahir, 'FUNGSIONAL_TERTENTU', 'Ahli Utama', HARI_INI)

    expect(hasil.batasUsia).toBe(65)
    expect(hasil.tanggalPensiun?.getFullYear()).toBe(2033)
    expect(hasil.segeraPensiun).toBe(false)
  })

  it('pegawai yang sama sebagai Administrator sudah melewati BUP', () => {
    const { tanggalLahir } = parseNip('196804041993032006', HARI_INI)
    const hasil = proyeksiPensiun(tanggalLahir, 'STRUKTURAL', 'Administrator', HARI_INI)

    expect(hasil.batasUsia).toBe(58)
    expect(hasil.tahunTersisa!).toBeLessThan(0)
    expect(hasil.segeraPensiun).toBe(true)
  })

  it('pensiun jatuh di akhir bulan ulang tahun', () => {
    const hasil = proyeksiPensiun(new Date(1968, 3, 4, 12), 'STRUKTURAL', 'Administrator', HARI_INI)
    expect(hasil.tanggalPensiun?.getMonth()).toBe(3) // April
    expect(hasil.tanggalPensiun?.getDate()).toBe(30) // akhir April
  })

  it('menandai pegawai yang pensiun dalam 2 tahun', () => {
    const lahir = new Date(HARI_INI.getFullYear() - 57, HARI_INI.getMonth(), 15, 12)
    const hasil = proyeksiPensiun(lahir, 'STRUKTURAL', 'Administrator', HARI_INI)
    expect(hasil.segeraPensiun).toBe(true)
  })

  it('tanpa tanggal lahir tetap mengembalikan batas usia', () => {
    const hasil = proyeksiPensiun(null, 'STRUKTURAL', 'Administrator', HARI_INI)
    expect(hasil.batasUsia).toBe(58)
    expect(hasil.tanggalPensiun).toBeNull()
    expect(hasil.segeraPensiun).toBe(false)
  })
})
