import { describe, expect, it } from 'vitest'

import { diffAudit, labelField, nilaiSama, tampilNilai } from './diff-audit'

/**
 * Uji dikelompokkan menurut **cara riwayat audit bisa berbohong**, bukan
 * menurut nama fungsi. Perubahan palsu sama merusaknya dengan perubahan yang
 * hilang: keduanya membuat riwayatnya berhenti dipercaya.
 */

describe('perubahan palsu karena beda tipe dari driver', () => {
  /**
   * MySQL mengembalikan TINYINT(1) sebagai angka, sedangkan kolom JSON
   * menyimpan apa yang ditulis JavaScript. Satu baris bisa mencatat
   * `status_aktif: 1` dan berikutnya `true` tanpa ada yang berubah.
   */
  it('1 dan true bukan perubahan', () => {
    const d = diffAudit({ status_aktif: 1 }, { status_aktif: true })
    expect(d.berubah).toHaveLength(0)
    expect(d.tetap).toHaveLength(1)
  })

  it('0 dan false bukan perubahan', () => {
    expect(diffAudit({ aktif: 0 }, { aktif: false }).berubah).toHaveLength(0)
  })

  it('"10" dan 10 bukan perubahan', () => {
    expect(nilaiSama('10', 10)).toBe(true)
    expect(diffAudit({ role_id: '10' }, { role_id: 10 }).berubah).toHaveLength(0)
  })

  it('null dan undefined bukan perubahan', () => {
    expect(nilaiSama(null, undefined)).toBe(true)
  })

  it('tapi 0 dan null TETAP perubahan — keduanya nilai yang berbeda', () => {
    expect(nilaiSama(0, null)).toBe(false)
    expect(diffAudit({ n: 0 }, { n: null }).berubah).toHaveLength(1)
  })

  it('teks bukan angka tidak diperlakukan sebagai angka', () => {
    expect(nilaiSama('Ringan', 'Sedang')).toBe(false)
    expect(nilaiSama('', 0)).toBe(false)
  })
})

describe('perubahan yang benar-benar terjadi', () => {
  it('menangkap nilai yang berubah dan menyisihkan yang tetap', () => {
    const d = diffAudit(
      { id: 3, nama: 'Reza', role_id: 3, unit_organisasi_id: 11 },
      { id: 3, nama: 'Reza', role_id: 2, unit_organisasi_id: 11 },
    )
    expect(d.berubah.map((b) => b.field)).toEqual(['role_id'])
    expect(d.berubah[0]).toMatchObject({ sebelum: 3, sesudah: 2, jenis: 'DIUBAH' })
    expect(d.tetap.map((b) => b.field)).toEqual(['id', 'nama', 'unit_organisasi_id'])
  })

  it('field yang hanya ada di salah satu sisi ditandai ditambah/dihapus', () => {
    const d = diffAudit({ a: 1 }, { a: 1, b: 2 })
    expect(d.berubah).toEqual([{ field: 'b', sebelum: undefined, sesudah: 2, jenis: 'DITAMBAH' }])
  })

  it('objek bersarang dibandingkan menurut isinya', () => {
    expect(nilaiSama({ x: [1, 2] }, { x: [1, 2] })).toBe(true)
    expect(nilaiSama({ x: [1, 2] }, { x: [2, 1] })).toBe(false)
  })

  it('urut abjad supaya dua baris audit bisa dibaca berdampingan', () => {
    const d = diffAudit({ z: 1, a: 1, m: 1 }, { z: 2, a: 2, m: 2 })
    expect(d.berubah.map((b) => b.field)).toEqual(['a', 'm', 'z'])
  })
})

describe('mutasi satu sisi (BUAT & HAPUS)', () => {
  /**
   * Kasus yang paling mudah salah: kalau satu sisi null diperlakukan sebagai
   * "tidak ada yang berubah", maka pembuatan dan penghapusan — dua mutasi
   * terbesar — justru tampil paling kosong.
   */
  it('BUAT: seluruh field dilaporkan sebagai ditambah', () => {
    const d = diffAudit(null, { nama: 'Baru', role_id: 5 })
    expect(d.satuSisi).toBe(true)
    expect(d.berubah).toHaveLength(2)
    expect(d.berubah.every((b) => b.jenis === 'DITAMBAH')).toBe(true)
    expect(d.berubah.every((b) => b.sebelum === null)).toBe(true)
  })

  it('HAPUS: seluruh field dilaporkan sebagai dihapus', () => {
    const d = diffAudit({ nama: 'Lama' }, null)
    expect(d.satuSisi).toBe(true)
    expect(d.berubah).toEqual([
      { field: 'nama', sebelum: 'Lama', sesudah: null, jenis: 'DIHAPUS' },
    ])
  })

  it('kedua sisi kosong tidak menghasilkan apa-apa, dan tidak melempar', () => {
    expect(diffAudit(null, null)).toEqual({ berubah: [], tetap: [], satuSisi: true })
  })

  it('nilai skalar (bukan objek) diperlakukan sebagai satu sisi, tidak dibaca sebagai field', () => {
    expect(diffAudit('teks', 42).satuSisi).toBe(true)
  })
})

describe('penyajian', () => {
  it('null jadi em dash, bukan tulisan "null"', () => {
    expect(tampilNilai(null)).toBe('—')
    expect(tampilNilai(undefined)).toBe('—')
  })

  it('teks kosong dibedakan dari null', () => {
    expect(tampilNilai('')).toBe('(kosong)')
    expect(tampilNilai('   ')).toBe('(kosong)')
  })

  it('boolean jadi kata, bukan true/false', () => {
    expect(tampilNilai(true)).toBe('ya')
    expect(tampilNilai(false)).toBe('tidak')
  })

  it('nama kolom snake_case jadi terbaca', () => {
    expect(labelField('unit_organisasi_id')).toBe('Unit organisasi id')
    expect(labelField('nama')).toBe('Nama')
  })
})
