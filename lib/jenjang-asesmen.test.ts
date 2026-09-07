import { describe, expect, it } from 'vitest'

import { JENJANG_ASESMEN, kelompokJenjang, labelJenjang } from './jenjang-asesmen'

describe('jenjang asesmen — tiga kelompok (koreksi sistem informasi.pdf butir 2)', () => {
  it('ketiga kelompok yang diminta PDF semuanya terwakili', () => {
    const ada = new Set(JENJANG_ASESMEN.map((j) => j.kelompok))
    expect([...ada].sort()).toEqual(['Administrator', 'Fungsional', 'Pengawas'])
  })

  it('jenjang yang BENAR-BENAR ada di data terpetakan', () => {
    // Keempat ini terukur di `SELECT DISTINCT jenjang_asesmen` sesudah impor 2026.
    expect(kelompokJenjang('ADMINISTRATOR')).toBe('Administrator')
    expect(kelompokJenjang('PENGAWAS')).toBe('Pengawas')
    expect(kelompokJenjang('AHLI MADYA')).toBe('Fungsional')
    expect(kelompokJenjang('AHLI MUDA')).toBe('Fungsional')
  })

  it('besar-kecil huruf & spasi tidak membuatnya gagal', () => {
    expect(kelompokJenjang('  ahli madya ')).toBe('Fungsional')
  })

  it('jenjang tak dikenal → null, BUKAN ditebak sebagai fungsional', () => {
    // Kontrol negatif: aturan berpola "apa pun yang diawali AHLI" akan lulus di
    // sini secara keliru. `null` berarti "belum diputuskan", dan pemanggilnya
    // menampilkan jenjangnya apa adanya alih-alih salah mengelompokkan.
    expect(kelompokJenjang('JPT PRATAMA')).toBeNull()
    expect(kelompokJenjang('')).toBeNull()
    expect(kelompokJenjang(null)).toBeNull()
  })

  it('label menyebut kelompoknya hanya kalau menambah informasi', () => {
    expect(labelJenjang('AHLI MADYA')).toBe('Ahli Madya (Fungsional)')
    // "Administrator (Administrator)" cuma kebisingan.
    expect(labelJenjang('ADMINISTRATOR')).toBe('Administrator')
    expect(labelJenjang('PENGAWAS')).toBe('Pengawas')
  })

  it('kosong dinyatakan "tidak tercatat", bukan string kosong', () => {
    expect(labelJenjang(null)).toBe('tidak tercatat')
    expect(labelJenjang('')).toBe('tidak tercatat')
  })
})
