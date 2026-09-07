import { describe, expect, it } from 'vitest'

import { peringkatEselon, setingkatAtauDiAtas, sqlPeringkatEselon } from './eselon'

describe('peringkat eselon', () => {
  it('I paling tinggi, NON_ESELON paling bawah', () => {
    const p = (e: string) => peringkatEselon(e)!
    expect(p('I')).toBeGreaterThan(p('II'))
    expect(p('II')).toBeGreaterThan(p('III'))
    expect(p('III')).toBeGreaterThan(p('IV'))
    expect(p('IV')).toBeGreaterThan(p('NON_ESELON'))
  })

  it('NON_ESELON adalah tingkatan, kolom kosong BUKAN', () => {
    // Kontrol atas kekeliruan yang paling mudah terjadi di sini: memakai 0 untuk
    // keduanya membuat jabatan tanpa eselon ikut lolos setiap perbandingan.
    expect(peringkatEselon('NON_ESELON')).toBe(0)
    expect(peringkatEselon(null)).toBeNull()
    expect(peringkatEselon('')).toBeNull()
    expect(peringkatEselon('V')).toBeNull()
  })
})

describe('setingkat atau di atasnya (Detail Revisi PUPR butir 4)', () => {
  it('yang setingkat lolos', () => {
    expect(setingkatAtauDiAtas('III', 'III')).toBe(true)
  })

  it('yang DI ATAS lolos — ini yang aturan lama tolak', () => {
    // `jj.eselon <=> j.eselon` menolak keduanya; itu yang sedang dilonggarkan.
    expect(setingkatAtauDiAtas('II', 'III')).toBe(true)
    expect(setingkatAtauDiAtas('I', 'IV')).toBe(true)
  })

  it('yang DI BAWAH tetap ditolak', () => {
    expect(setingkatAtauDiAtas('IV', 'III')).toBe(false)
    expect(setingkatAtauDiAtas('NON_ESELON', 'IV')).toBe(false)
  })

  it('eselon tak diketahui tidak pernah lolos, di sisi mana pun', () => {
    expect(setingkatAtauDiAtas(null, 'III')).toBe(false)
    expect(setingkatAtauDiAtas('III', null)).toBe(false)
  })
})

describe('ekspresi SQL peringkat eselon', () => {
  it('daftarnya MENAIK, jadi perbandingan `>=` searah dengan peringkatEselon()', () => {
    // Kalau daftarnya menurun, `>=` di SQL berarti "setingkat atau DI BAWAH" —
    // kebalikan persis dari yang diminta, dan tanpa satu pun galat.
    expect(sqlPeringkatEselon('j.eselon')).toBe(
      "FIELD(j.eselon, 'NON_ESELON', 'IV', 'III', 'II', 'I')",
    )
  })
})
