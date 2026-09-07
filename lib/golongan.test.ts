import { describe, expect, it } from 'vitest'

import {
  URUTAN_GOLONGAN,
  bakukanGolongan,
  kunciGolongan,
  memenuhiGolongan,
  peringkatGolongan,
} from './golongan'

/**
 * Golongan dipakai gerbang kelayakan sebagai syarat KERAS (PP 11/2017), jadi
 * kekeliruan di sini tidak muncul sebagai galat — ia muncul sebagai kandidat yang
 * hilang dari daftar. Yang diuji: urutannya, normalisasi penulisannya, dan
 * pembedaan "tidak dikenali" dari "terendah".
 */
describe('golongan PNS', () => {
  it('urutannya lengkap dan monoton naik', () => {
    expect(URUTAN_GOLONGAN).toHaveLength(17) // I/a–I/d, II/a–II/d, III/a–III/d, IV/a–IV/e
    const peringkat = URUTAN_GOLONGAN.map((g) => peringkatGolongan(g)!)
    for (let i = 1; i < peringkat.length; i++) {
      expect(peringkat[i]!).toBeGreaterThan(peringkat[i - 1]!)
    }
  })

  it('IV/e tertinggi, I/a terendah', () => {
    expect(memenuhiGolongan('IV/e', 'I/a')).toBe(true)
    expect(memenuhiGolongan('I/a', 'IV/e')).toBe(false)
  })

  it('menormalkan garis miring, spasi, titik, dan besar-kecil huruf', () => {
    for (const bentuk of ['III/d', 'IIId', 'III d', 'iii/D', 'III.d', 'III-d']) {
      expect(kunciGolongan(bentuk)).toBe('IIID')
      expect(bakukanGolongan(bentuk)).toBe('III/d')
    }
  })

  it('lembar Excel ("IVb") dan basis data ("IV/b") dianggap sama', () => {
    // Selisih penulisan inilah yang akan menggugurkan orang yang memenuhi syarat
    // kalau perbandingannya dilakukan apa adanya.
    expect(memenuhiGolongan('IV/b', 'IVb')).toBe(true)
    expect(memenuhiGolongan('IVb', 'IV/b')).toBe(true)
  })

  it('sama dengan syarat = memenuhi (batas bawah inklusif)', () => {
    expect(memenuhiGolongan('III/d', 'III/d')).toBe(true)
  })

  it('yang tidak dikenali menghasilkan null, BUKAN nol', () => {
    // Nol berarti golongan terendah; null berarti tidak diketahui. Menyamakan
    // keduanya membuat golongan kosong dibaca sebagai I/a lalu digugurkan.
    expect(peringkatGolongan(null)).toBeNull()
    expect(peringkatGolongan('')).toBeNull()
    expect(peringkatGolongan('   ')).toBeNull()
    expect(peringkatGolongan('V/a')).toBeNull()
    expect(peringkatGolongan('Pembina Utama')).toBeNull()
    expect(peringkatGolongan('I/a')).toBe(0)
  })

  it('perbandingan dengan nilai tak dikenali mengembalikan null, bukan false', () => {
    expect(memenuhiGolongan(null, 'III/d')).toBeNull()
    expect(memenuhiGolongan('III/d', null)).toBeNull()
    expect(memenuhiGolongan('bukan golongan', 'III/d')).toBeNull()
  })
})
