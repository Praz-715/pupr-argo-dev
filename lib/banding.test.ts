import { describe, expect, it } from 'vitest'

import { MAKS_KANDIDAT, MIN_KANDIDAT, bacaDaftarNip } from './banding'
import { arahBawaanUrut } from './urut'

/**
 * `bacaDaftarNip` adalah batas kepercayaan: isinya datang dari query string yang
 * bisa ditulis siapa saja. Yang diuji di sini bukan format keluarannya, tapi
 * bahwa **tidak ada masukan yang bisa lolos** menjadi daftar besar atau berisi
 * NIP tidak valid.
 */
describe('bacaDaftarNip — validasi ?nip= di boundary', () => {
  const A = '199308232017122011'
  const B = '197211081996031001'
  const C = '198405202009121008'
  const D = '197907292005021003'
  const E = '198512142010011013'

  it('kosong / tidak ada → daftar kosong', () => {
    expect(bacaDaftarNip(undefined)).toEqual([])
    expect(bacaDaftarNip('')).toEqual([])
    expect(bacaDaftarNip(',,,')).toEqual([])
  })

  it('membaca beberapa NIP dan mempertahankan urutannya', () => {
    expect(bacaDaftarNip(`${A},${B}`)).toEqual([A, B])
  })

  it('membuang spasi dan pemisah non-digit di dalam NIP', () => {
    expect(bacaDaftarNip(`19930823 201712 2 011 , ${B}`)).toEqual([A, B])
  })

  it('menolak yang panjangnya bukan 18 digit', () => {
    expect(bacaDaftarNip(`123, ${A}, 1993082320171220119999`)).toEqual([A])
  })

  it('menghapus duplikat', () => {
    expect(bacaDaftarNip(`${A},${A},${B}`)).toEqual([A, B])
  })

  it(`memangkas ke maksimum ${MAKS_KANDIDAT} kandidat`, () => {
    const hasil = bacaDaftarNip([A, B, C, D, E].join(','))
    expect(hasil).toHaveLength(MAKS_KANDIDAT)
    expect(hasil).toEqual([A, B, C, D])
  })

  it('batas minimum lebih kecil dari maksimum (sanity)', () => {
    expect(MIN_KANDIDAT).toBeLessThan(MAKS_KANDIDAT)
  })

  it('menolak injeksi lewat isi parameter', () => {
    expect(bacaDaftarNip("1' OR '1'='1")).toEqual([])
    expect(bacaDaftarNip('<script>alert(1)</script>')).toEqual([])
  })
})

/**
 * Arah urut bawaan dipakai DUA lapisan: kueri SQL (server) dan panah di header
 * tabel (klien). Uji ini yang menjaga keduanya tetap membaca sumber yang sama —
 * kalau nilainya berbeda, data terurut satu arah sementara panahnya menunjuk
 * arah lain, dan tidak ada yang menyadarinya.
 */
describe('arahBawaanUrut — arah pertama tiap kolom', () => {
  it.each(['nama', 'nip', 'jabatan', 'unit', 'pangkat', 'jenjang', 'predikat'])(
    'kolom teks "%s" naik (A→Z)',
    (kolom) => {
      expect(arahBawaanUrut(kolom)).toBe('asc')
    },
  )

  it.each(['potkom', 'integritas', 'kotak9', 'talenta', 'skorTotal'])(
    'kolom skor "%s" menurun (tertinggi dulu)',
    (kolom) => {
      expect(arahBawaanUrut(kolom)).toBe('desc')
    },
  )

  it('ranking naik — peringkat 1 adalah yang teratas, bukan terbawah', () => {
    expect(arahBawaanUrut('ranking')).toBe('asc')
  })

  it('kolom tak dikenal / kosong jatuh ke naik', () => {
    expect(arahBawaanUrut(undefined)).toBe('asc')
    expect(arahBawaanUrut(null)).toBe('asc')
    expect(arahBawaanUrut('kolom-yang-tidak-ada')).toBe('asc')
  })
})
