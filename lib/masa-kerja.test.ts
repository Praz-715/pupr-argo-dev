import { describe, expect, it } from 'vitest'

import { bulanKeTahun, uraiMasaKerjaBulan } from './masa-kerja'

/**
 * Bentuk-bentuk di bawah BUKAN karangan: semuanya diambil dari nilai nyata kolom
 * "MASA KERJA JABATAN PENEMPATAN" di `DATA TALENT POOL ES 2 & 3 LENGKAP.xlsx`.
 * Menguji bentuk yang tidak ada di sumbernya akan memberi rasa aman yang salah.
 */
describe('urai masa kerja jabatan', () => {
  it('membaca bentuk "N Tahun N Bulan"', () => {
    expect(uraiMasaKerjaBulan('2 Tahun 7 Bulan')).toBe(31)
    expect(uraiMasaKerjaBulan('1 Tahun 2 Bulan')).toBe(14)
    expect(uraiMasaKerjaBulan('0 Tahun 0 Bulan')).toBe(0)
  })

  it('membaca yang hanya bulan, termasuk huruf kecil', () => {
    expect(uraiMasaKerjaBulan('2 bulan')).toBe(2)
    expect(uraiMasaKerjaBulan('0 Tahun 10 Bulan')).toBe(10)
    expect(uraiMasaKerjaBulan('11 Bulan')).toBe(11)
  })

  it('membaca yang hanya tahun', () => {
    expect(uraiMasaKerjaBulan('1 Tahun')).toBe(12)
    expect(uraiMasaKerjaBulan('13 tahun')).toBe(156)
  })

  it('MEMBUANG komponen hari, tidak membulatkannya', () => {
    // Ambang kategorinya tahunan, jadi hari tidak pernah mengubah kategori —
    // sementara membulatkan ke atas menambah bulan yang tidak ada di sumbernya.
    expect(uraiMasaKerjaBulan('0 Tahun 0 Bulan 11 Hari')).toBe(0)
    expect(uraiMasaKerjaBulan('0 Tahun 11 Bulan 30 Hari')).toBe(11)
    expect(uraiMasaKerjaBulan('2 Tahun 3 Bulan 15 Hari')).toBe(27)
  })

  it('kosong / tak terbaca → null, BUKAN nol', () => {
    // Nol berarti "baru menjabat"; null berarti "sumbernya tidak memberi tahu".
    // Menyamakannya membuat baris yang belum diisi ikut menurunkan skor.
    for (const v of ['', '   ', null, undefined, '-', 'belum ada', 'Hari']) {
      expect(uraiMasaKerjaBulan(v as string)).toBeNull()
    }
  })

  it('angka yang mustahil ditolak', () => {
    // 200 tahun pada SATU jabatan berarti kolomnya bukan masa kerja — lebih baik
    // "tidak diketahui" daripada angka yang akan meloloskan siapa pun.
    expect(uraiMasaKerjaBulan('200 Tahun')).toBeNull()
    expect(uraiMasaKerjaBulan('100 Tahun 1 Bulan')).toBeNull()
    expect(uraiMasaKerjaBulan('99 Tahun')).toBe(1188)
  })

  it('bulan → tahun desimal', () => {
    expect(bulanKeTahun(31)).toBe(2.58)
    expect(bulanKeTahun(12)).toBe(1)
    expect(bulanKeTahun(0)).toBe(0)
    expect(bulanKeTahun(null)).toBeNull()
  })
})
