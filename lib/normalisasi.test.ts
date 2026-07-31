import { describe, expect, it } from 'vitest'

import {
  normalisasiGolongan,
  normalisasiJenisAsesmen,
  parsePendidikan,
  parseTmt,
  terindikasiTeksJabatan,
} from './normalisasi'

describe('normalisasi golongan (phase.md §6 no. 4)', () => {
  it('menyeragamkan format titik & garis miring', () => {
    // dua format yang sama-sama hidup di data dev
    expect(normalisasiGolongan('IV.b')).toBe('IV/b')
    expect(normalisasiGolongan('IV/b')).toBe('IV/b')
    expect(normalisasiGolongan('III/d')).toBe('III/d')
    expect(normalisasiGolongan('III.d')).toBe('III/d')
  })

  it('toleran spasi & kapitalisasi', () => {
    expect(normalisasiGolongan(' iv . A ')).toBe('IV/a')
    expect(normalisasiGolongan('IV a')).toBe('IV/a')
  })

  it('menghasilkan bucket yang SAMA untuk kedua format', () => {
    expect(normalisasiGolongan('IV.a')).toBe(normalisasiGolongan('IV/a'))
  })

  it('nilai kosong → null', () => {
    expect(normalisasiGolongan(null)).toBeNull()
    expect(normalisasiGolongan('  ')).toBeNull()
  })
})

describe('normalisasi jenis asesmen (phase.md §6 no. 5)', () => {
  it('menyeragamkan kapitalisasi — PENGAWAS dan Pengawas jadi satu bucket', () => {
    expect(normalisasiJenisAsesmen('PENGAWAS')).toBe('Pengawas')
    expect(normalisasiJenisAsesmen('Pengawas')).toBe('Pengawas')
    expect(normalisasiJenisAsesmen('PENGAWAS')).toBe(normalisasiJenisAsesmen('Pengawas'))
  })

  it('memetakan istilah lama ke istilah terkini', () => {
    expect(normalisasiJenisAsesmen('JPT Pertama')).toBe('JPT Pratama')
    expect(normalisasiJenisAsesmen('JPT Pratama')).toBe('JPT Pratama')
  })

  it('mempertahankan jenjang JFT', () => {
    expect(normalisasiJenisAsesmen('JFT Muda')).toBe('JFT Muda')
    expect(normalisasiJenisAsesmen('jft utama')).toBe('JFT Utama')
  })

  it('nilai tak dikenal tetap dikembalikan dalam Title Case', () => {
    expect(normalisasiJenisAsesmen('ASESMEN KHUSUS')).toBe('Asesmen Khusus')
  })
})

describe('parsePendidikan (phase.md §6 no. 10)', () => {
  it('memisahkan jenjang & bidang studi', () => {
    expect(parsePendidikan('S2 SISTEM DAN TEKNIK TRANSPORTASI')).toEqual({
      jenjang: 'S2',
      bidangStudi: 'Sistem dan Teknik Transportasi',
      perluReview: false,
    })
  })

  it('menangani berbagai penulisan jenjang', () => {
    expect(parsePendidikan('DIII TEKNIK SIPIL').jenjang).toBe('D3')
    expect(parsePendidikan('S1 FIS ADMINISTRASI').jenjang).toBe('S1_D4')
    expect(parsePendidikan('D-IV TEKNIK').jenjang).toBe('S1_D4')
    expect(parsePendidikan('S3 MANAJEMEN').jenjang).toBe('S3')
    expect(parsePendidikan('SMA IPA').jenjang).toBe('SLTA')
  })

  it('jenjang tanpa bidang studi ditandai perlu review', () => {
    expect(parsePendidikan('S2')).toMatchObject({ jenjang: 'S2', perluReview: true })
  })

  it('teks tanpa jenjang ditandai perlu review, bukan dibuang', () => {
    const hasil = parsePendidikan('UNIV OF ROORKEE BID WATER RESOURCES')
    expect(hasil.jenjang).toBeNull()
    expect(hasil.perluReview).toBe(true)
    expect(hasil.bidangStudi).not.toBeNull()
  })

  it('nilai kosong ditandai perlu review', () => {
    expect(parsePendidikan(null).perluReview).toBe(true)
  })
})

describe('parseTmt — format campur dari sumber (phase.md §6 no. 6)', () => {
  it('tanggal panjang Indonesia', () => {
    const hasil = parseTmt('01 Agustus 2025')
    expect(hasil.tanggal?.getFullYear()).toBe(2025)
    expect(hasil.tanggal?.getMonth()).toBe(7)
    expect(hasil.tanggal?.getDate()).toBe(1)
    expect(hasil.perluReview).toBe(false)
  })

  it('tanggal panjang dengan pangkat ikut tertempel', () => {
    const hasil = parseTmt('01 April 2024/ Pembina Tk.I')
    expect(hasil.tanggal?.getFullYear()).toBe(2024)
    expect(hasil.tanggal?.getMonth()).toBe(3)
    expect(hasil.sisaTeks).toBe('Pembina Tk.I')
    expect(hasil.perluReview).toBe(false)
  })

  it('short date dua digit tahun', () => {
    const hasil = parseTmt('1-Apr-23')
    expect(hasil.tanggal?.getFullYear()).toBe(2023)
    expect(hasil.tanggal?.getMonth()).toBe(3)
  })

  it('format ISO', () => {
    expect(parseTmt('2025-07-18').tanggal?.getDate()).toBe(18)
  })

  it('format dd/mm/yyyy', () => {
    const hasil = parseTmt('18/07/2025')
    expect(hasil.tanggal?.getMonth()).toBe(6)
    expect(hasil.tanggal?.getDate()).toBe(18)
  })

  it('yang gagal diparse ditandai perlu review, TIDAK jadi null senyap', () => {
    const hasil = parseTmt('kira-kira tahun 2020')
    expect(hasil.tanggal).toBeNull()
    expect(hasil.perluReview).toBe(true)
    expect(hasil.sisaTeks).toBe('kira-kira tahun 2020')
  })

  it('tanggal tidak masuk akal ditolak', () => {
    expect(parseTmt('31 Februari 2025').tanggal).toBeNull()
    expect(parseTmt('31 Februari 2025').perluReview).toBe(true)
  })

  it('nilai kosong ditandai', () => {
    expect(parseTmt('').perluReview).toBe(true)
    expect(parseTmt(null).perluReview).toBe(true)
  })
})

describe('deteksi anomali Unit Kerja (phase.md §6 no. 9)', () => {
  it('menandai kolom Unit Kerja yang isinya teks jabatan (kasus Irwan)', () => {
    expect(
      terindikasiTeksJabatan('Kepala Seksi Pemantauan dan Evaluasi, Subdirektorat Pemberdayaan'),
    ).toBe(true)
    expect(terindikasiTeksJabatan('Direktur Pengadaan Jasa Konstruksi')).toBe(true)
  })

  it('tidak menandai nama unit kerja yang wajar', () => {
    expect(terindikasiTeksJabatan('Bagian Kepegawaian dan Umum')).toBe(false)
    expect(terindikasiTeksJabatan('Subdirektorat Pengadaan')).toBe(false)
    expect(terindikasiTeksJabatan('Balai Jasa Konstruksi Wilayah VI Makassar')).toBe(false)
  })

  it('nilai kosong bukan anomali', () => {
    expect(terindikasiTeksJabatan(null)).toBe(false)
  })
})
