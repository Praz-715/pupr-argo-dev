import { describe, expect, it } from 'vitest'

import { KATEGORI_CATATAN, adalahKategoriCatatan } from './catatan-pegawai'

describe('kode catatan pegawai', () => {
  it('tepat empat kode, sesuai yang diminta pemilik proses', () => {
    expect([...KATEGORI_CATATAN]).toEqual(['HDS', 'HDB', 'TBTL', 'TBS'])
  })

  it('menerima keempatnya', () => {
    for (const k of KATEGORI_CATATAN) expect(adalahKategoriCatatan(k)).toBe(true)
  })

  /*
    KONTROL NEGATIF. Kode di sini masuk ke kolom ENUM; nilai di luar daftar akan
    ditolak MySQL di tengah penyimpanan, jadi penjaganya harus di boundary. Tanpa
    uji ini "semua lulus" bisa berarti fungsinya mengembalikan true untuk apa pun.
  */
  it('menolak yang di luar daftar — termasuk beda besar-kecil huruf', () => {
    for (const k of ['hds', 'HD', 'HDX', '', 'HDS ', 'TBTL2']) {
      expect(adalahKategoriCatatan(k)).toBe(false)
    }
  })
})
