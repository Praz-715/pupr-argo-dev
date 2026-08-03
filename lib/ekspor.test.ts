import { describe, expect, it } from 'vitest'

import { BOM_UTF8, lindungiSel, namaBerkasCsv, selCsv, susunCsv } from './ekspor'

/**
 * Uji dikelompokkan menurut **cara berkasnya rusak di tangan orang lain**, bukan
 * menurut nama fungsi — ketiga kelompok pertama adalah hal yang baru terlihat
 * setelah CSV-nya dibuka di Excel, jauh dari aplikasi ini.
 */

describe('injeksi formula', () => {
  it('menetralkan seluruh karakter pembuka formula', () => {
    for (const pembuka of ['=', '+', '-', '@', '\t', '\r']) {
      expect(lindungiSel(`${pembuka}CMD()`)).toBe(`'${pembuka}CMD()`)
    }
  })

  it('menetralkan kasus nyata: catatan reviewer berisi formula', () => {
    const sel = selCsv('=HYPERLINK("http://jahat.example","klik")')
    expect(sel.startsWith('"\'=')).toBe(true)
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

describe('pengutipan RFC 4180', () => {
  it('mengutip sel berisi koma, kutip, atau baris baru', () => {
    expect(selCsv('Ditolak, alasannya jelas')).toBe('"Ditolak, alasannya jelas"')
    expect(selCsv('sebut "ini"')).toBe('"sebut ""ini"""')
    expect(selCsv('baris satu\nbaris dua')).toBe('"baris satu\nbaris dua"')
  })

  it('mengutip titik koma juga — Excel lokal id memakainya sebagai pemisah', () => {
    expect(selCsv('a;b')).toBe('"a;b"')
  })

  it('tidak mengutip yang tidak perlu', () => {
    expect(selCsv('Administrator')).toBe('Administrator')
  })
})

describe('nilai bukan teks', () => {
  it('null & undefined jadi sel kosong, bukan tulisan "null"', () => {
    expect(selCsv(null)).toBe('')
    expect(selCsv(undefined)).toBe('')
  })

  it('boolean jadi ya/tidak, bukan true/false', () => {
    expect(selCsv(true)).toBe('ya')
    expect(selCsv(false)).toBe('tidak')
  })

  it('angka nol tetap 0, bukan kosong', () => {
    expect(selCsv(0)).toBe('0')
  })

  it('Date jadi waktu yang bisa diurut', () => {
    expect(selCsv(new Date('2026-07-31T04:05:06Z'))).toBe('2026-07-31 04:05:06')
  })
})

describe('susunCsv', () => {
  interface Baris {
    nama: string
    skor: number | null
  }
  const kolom = [
    { kunci: 'nama', judul: 'Nama', nilai: (b: Baris) => b.nama },
    { kunci: 'skor', judul: 'Skor', nilai: (b: Baris) => b.skor },
  ]

  it('memulai dengan BOM supaya Excel Windows tidak salah encoding', () => {
    expect(susunCsv(kolom, []).startsWith(BOM_UTF8)).toBe(true)
  })

  it('memakai CRLF dan tetap menulis header walau tanpa baris', () => {
    expect(susunCsv(kolom, [])).toBe(`${BOM_UTF8}Nama,Skor\r\n`)
  })

  it('menyusun baris berurutan sesuai definisi kolom', () => {
    const csv = susunCsv(kolom, [
      { nama: 'Agus', skor: 88.5 },
      { nama: 'Budi, S.T.', skor: null },
    ])
    expect(csv).toBe(`${BOM_UTF8}Nama,Skor\r\nAgus,88.5\r\n"Budi, S.T.",\r\n`)
  })
})

describe('namaBerkasCsv', () => {
  it('menyertakan stempel waktu supaya unduhan berulang tidak saling menimpa', () => {
    const nama = namaBerkasCsv('gap-indikator', new Date(2026, 6, 31, 9, 5))
    expect(nama).toBe('simt-gap-indikator-20260731-0905.csv')
  })

  it('membersihkan karakter yang tidak sah untuk nama berkas', () => {
    expect(namaBerkasCsv('Gap/Indikator Utama', new Date(2026, 0, 2, 3, 4))).toBe(
      'simt-gap-indikator-utama-20260102-0304.csv',
    )
  })
})
