import { describe, expect, it } from 'vitest'

import { lindungiSel } from './ekspor'

/**
 * `selCsv`/`susunCsv`/`namaBerkasCsv`/`headerCsv` dihapus 2 Sep 2026 saat Pusat
 * Ekspor beralih ke `.xlsx` (`lib/ekspor-xlsx.ts`) — lihat docblock di sana untuk
 * uji round-trip penggantinya. `lindungiSel()` tetap diuji di sini karena masih
 * dipakai kedua serialisasi.
 */
describe('injeksi formula', () => {
  it('menetralkan seluruh karakter pembuka formula', () => {
    for (const pembuka of ['=', '+', '-', '@', '\t', '\r']) {
      expect(lindungiSel(`${pembuka}CMD()`)).toBe(`'${pembuka}CMD()`)
    }
  })

  it('membiarkan teks biasa apa adanya', () => {
    expect(lindungiSel('Budi Santoso')).toBe('Budi Santoso')
    expect(lindungiSel('196912241998032005')).toBe('196912241998032005')
    expect(lindungiSel('')).toBe('')
  })

  it('angka negatif ikut dinetralkan — menebak maksud sel lebih berisiko', () => {
    expect(lindungiSel('-12')).toBe("'-12")
  })
})
