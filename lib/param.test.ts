import { describe, expect, it } from 'vitest'

import { angkaPositif, dariDaftar, nomorHalaman, tanggalIso } from './param'

/**
 * Uji diorganisasi menurut **cara masuknya nilai rusak**, bukan menurut nama
 * fungsi: yang dijamin di sini adalah tidak ada bentuk query string yang bisa
 * lolos jadi `NaN`/`Infinity`/tanggal palsu ke lapisan SQL.
 */

describe('angkaPositif', () => {
  it('menerima bilangan bulat positif', () => {
    expect(angkaPositif('1')).toBe(1)
    expect(angkaPositif('42')).toBe(42)
    expect(angkaPositif('99999')).toBe(99999)
  })

  it('menolak yang bukan angka', () => {
    for (const buruk of ['abc', ';DROP', '%00', 'null', 'NaN', 'Infinity', '1abc', '']) {
      expect(angkaPositif(buruk)).toBeUndefined()
    }
  })

  it('menolak nol, negatif, dan pecahan', () => {
    expect(angkaPositif('0')).toBeUndefined()
    expect(angkaPositif('-5')).toBeUndefined()
    expect(angkaPositif('1.5')).toBeUndefined()
  })

  it('menolak yang di luar bilangan bulat aman', () => {
    // `1e309` menjadi Infinity, dan Infinity lolos `> 0` — di SQL ia jadi
    // `Undeclared variable: Infinity`, bukan angka.
    expect(angkaPositif('1e309')).toBeUndefined()
    expect(angkaPositif('9007199254740993')).toBeUndefined()
  })

  it('menganggap kosong sebagai tidak ada penyaring', () => {
    expect(angkaPositif(undefined)).toBeUndefined()
    expect(angkaPositif(null)).toBeUndefined()
  })
})

describe('nomorHalaman', () => {
  it('meneruskan halaman yang sah', () => {
    expect(nomorHalaman('3')).toBe(3)
    expect(nomorHalaman('99999')).toBe(99999)
  })

  it('SELALU mengembalikan angka — nilai rusak jatuh ke halaman 1', () => {
    for (const buruk of ['abc', '-5', '0', '1.5', '1e309', '', undefined, null]) {
      const h = nomorHalaman(buruk)
      expect(Number.isSafeInteger(h)).toBe(true)
      expect(h).toBe(1)
    }
  })

  it('hasilnya aman dipakai menghitung OFFSET', () => {
    for (const masukan of ['abc', '0', '-9', '1e309', undefined]) {
      const offset = (nomorHalaman(masukan) - 1) * 25
      expect(Number.isSafeInteger(offset)).toBe(true)
      expect(offset).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('tanggalIso', () => {
  it('menerima tanggal yang ada di kalender', () => {
    expect(tanggalIso('2026-01-01')).toBe('2026-01-01')
    expect(tanggalIso('2026-07-31')).toBe('2026-07-31')
    expect(tanggalIso('2024-02-29')).toBe('2024-02-29') // kabisat
  })

  it('menolak bentuk yang bukan YYYY-MM-DD', () => {
    for (const buruk of ['bukan-tanggal', 'xx', '31-07-2026', '2026/07/31', '2026-7-1', '']) {
      expect(tanggalIso(buruk)).toBeUndefined()
    }
  })

  it('menolak tanggal yang bentuknya benar tapi tidak ada', () => {
    expect(tanggalIso('2026-13-45')).toBeUndefined()
    expect(tanggalIso('2026-00-10')).toBeUndefined()
    expect(tanggalIso('2026-02-30')).toBeUndefined()
    expect(tanggalIso('2026-04-31')).toBeUndefined()
    expect(tanggalIso('2025-02-29')).toBeUndefined() // bukan kabisat
  })

  it('tidak menggeser hari karena zona waktu', () => {
    // Nilai keluar harus IDENTIK dengan yang masuk — kalau lewat Date lokal,
    // tanggal 1 bisa keluar sebagai tanggal 31 bulan sebelumnya.
    for (const t of ['2026-01-01', '2026-12-31', '2026-06-30']) {
      expect(tanggalIso(t)).toBe(t)
    }
  })
})

describe('dariDaftar', () => {
  const ESELON = ['I', 'II', 'III', 'IV', 'NON_ESELON'] as const

  it('meneruskan nilai yang ada di daftar', () => {
    expect(dariDaftar('III', ESELON)).toBe('III')
    expect(dariDaftar('NON_ESELON', ESELON)).toBe('NON_ESELON')
  })

  it('menolak yang di luar daftar, termasuk beda huruf besar-kecil', () => {
    expect(dariDaftar('iii', ESELON)).toBeUndefined()
    expect(dariDaftar('V', ESELON)).toBeUndefined()
    expect(dariDaftar('%00', ESELON)).toBeUndefined()
    expect(dariDaftar('', ESELON)).toBeUndefined()
    expect(dariDaftar(undefined, ESELON)).toBeUndefined()
  })
})
