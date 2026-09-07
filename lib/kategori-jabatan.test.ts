import { describe, expect, it } from 'vitest'

import { usulkanKategoriJabatan } from './kategori-jabatan'

/*
  Kasus-kasus di bawah diambil dari DATA NYATA `pupr_dev_v2`, bukan dikarang:
  kelima baris riwayat Maul Hasworo (pegawai 116) adalah contoh yang pemilik
  proses sebut sendiri di PDF 2 Sep 2026 butir 3 — 0,89 tahun terbaca padahal
  pengalaman Pengawas-nya hampir 10 tahun.
*/
describe('usulkanKategoriJabatan — kasus Maul (PDF 2 Sep 2026 butir 3)', () => {
  it('Kepala Subbagian … → Pengawas (eselon IV)', () => {
    const u = usulkanKategoriJabatan(
      'Kepala Subbagian Umum dan Tata Usaha, Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Aceh',
    )
    expect(u.kategori).toBe('STRUKTURAL')
    expect(u.jenjang).toBe('Pengawas')
    expect(u.eselon).toBe('IV')
    expect(u.penugasan).toBe('DEFINITIF')
  })

  it('"Kasi …" — singkatan yang TIDAK ada di master mana pun — tetap Pengawas', () => {
    for (const nama of [
      'Kasi Pencegahan dan Peningkatan Kualitas Dinas Perumahan Rakyat',
      'Kasi Pemeliharaan Jalan dan Jembatan Dinas Pekerjaan Umum',
    ]) {
      const u = usulkanKategoriJabatan(nama)
      expect(u.kategori).toBe('STRUKTURAL')
      expect(u.jenjang).toBe('Pengawas')
    }
  })

  it('PLH dipisahkan, bukan dibuang — jenjangnya tetap terbaca', () => {
    const u = usulkanKategoriJabatan(
      'PLH. Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Aceh',
    )
    expect(u.penugasan).toBe('PLH')
    expect(u.jenjang).toBe('Administrator')
  })

  it('jabatan pelaksana TIDAK ditebak jadi jenjang struktural', () => {
    const u = usulkanKategoriJabatan(
      'Penyusun Monev Dan Pelaporan Subdirektorat Kepatuhan Intern',
    )
    expect(u.kategori).toBe('LAINNYA')
    expect(u.jenjang).toBeNull()
  })
})

describe('usulkanKategoriJabatan — jenjang sesuai daftar pemilik proses', () => {
  it.each([
    ['Kepala Sub Bagian Tata Usaha', 'Pengawas', 'IV'],
    ['Kepala Sub Bagian Umum dan Tata Usaha', 'Pengawas', 'IV'],
    ['Kepala Seksi Pelaksanaan', 'Pengawas', 'IV'],
    ['Kepala Bagian Keuangan', 'Administrator', 'III'],
    ['Kepala Sub Direktorat Kontrak Kontruksi', 'Administrator', 'III'],
    ['Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Aceh', 'Administrator', 'III'],
    ['Direktur Pengadaan Jasa Konstruksi', 'JPT Pratama', 'II'],
    ['Sekretaris Direktorat Jenderal Bina Konstruksi', 'JPT Pratama', 'II'],
  ])('%s → %s', (nama, jenjang, eselon) => {
    const u = usulkanKategoriJabatan(nama)
    expect(u.kategori).toBe('STRUKTURAL')
    expect(u.jenjang).toBe(jenjang)
    expect(u.eselon).toBe(eselon)
  })
})

describe('usulkanKategoriJabatan — fungsional', () => {
  it.each([
    'Pembina Jasa Konstruksi Ahli Madya',
    'Pembina Jasa Konstruksi Ahli Muda (Kerja Sama)',
    'Pengelola Pengadaan Barang/Jasa Ahli Muda',
    'Pranata Komputer Ahli Muda',
  ])('%s → FUNGSIONAL', (nama) => {
    const u = usulkanKategoriJabatan(nama)
    expect(u.kategori).toBe('FUNGSIONAL')
    expect(u.jenjang).toBeNull()
  })
})

/*
  KONTROL NEGATIF. Tanpa ini, "semua kasus lulus" bisa berarti fungsinya
  mengembalikan STRUKTURAL untuk apa pun — dan itulah bentuk kegagalan yang
  paling berbahaya di sini, sebab ia MENAMBAH masa kerja pada jenjang yang tidak
  pernah dijabat orangnya.
*/
describe('yang tidak dikenali tetap tidak dikenali', () => {
  it.each([
    'Staf Subdirektorat Kelembagaan',
    'Pengadministrasi Umum',
    'Bendahara Pengeluaran',
    '',
  ])('%s → LAINNYA tanpa jenjang', (nama) => {
    const u = usulkanKategoriJabatan(nama)
    expect(u.kategori).toBe('LAINNYA')
    expect(u.jenjang).toBeNull()
    expect(u.eselon).toBeNull()
  })
})
