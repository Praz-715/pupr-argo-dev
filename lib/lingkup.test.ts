import { describe, expect, it } from 'vitest'

import { lingkupData, ringkasLingkup, tanpaAkses, unitWajib } from './lingkup'
import { SEMUA_PERAN, type Peran, type PenggunaAktif } from './peran'

function pengguna(peran: Peran, unitOrganisasiId: number | null = 11): PenggunaAktif {
  return {
    id: 3,
    nama: 'Reza Kurniawan',
    username: 'reza.kurniawan',
    email: 'reza.kurniawan@djbk.pu.go.id',
    peran,
    unitOrganisasiId,
    namaUnit: unitOrganisasiId === null ? null : 'BP2JK Wilayah DKI Jakarta',
  }
}

describe('siapa yang dibatasi', () => {
  it('hanya Pengelola Unit yang dibatasi ke unitnya', () => {
    const dibatasi = SEMUA_PERAN.filter((p) => lingkupData(pengguna(p)).jenis === 'UNIT')
    expect(dibatasi).toEqual(['Pengelola Unit'])
  })

  it('peran lain melihat seluruh pegawai walau punya unit', () => {
    for (const p of ['Super Admin', 'Admin Talenta', 'Pimpinan', 'Viewer'] as const) {
      expect(lingkupData(pengguna(p, 6))).toEqual({ jenis: 'SEMUA' })
    }
  })
})

describe('gagal tertutup', () => {
  /**
   * Ini kasus yang menentukan apakah modul ini berguna atau berbahaya.
   * Pengelola Unit tanpa unit adalah data yang tidak lengkap, dan tebakan yang
   * "ramah" — tampilkan semua — persis kebalikan dari yang benar.
   */
  it('Pengelola Unit tanpa unit TIDAK melihat apa-apa', () => {
    const l = lingkupData(pengguna('Pengelola Unit', null))
    expect(l.jenis).toBe('NIHIL')
    expect(tanpaAkses(l)).toBe(true)
    expect(unitWajib(l)).toBeNull()
  })

  it('alasannya menyebutkan apa yang harus dilakukan, bukan sekadar "ditolak"', () => {
    const l = lingkupData(pengguna('Pengelola Unit', null))
    expect(l.jenis === 'NIHIL' && l.alasan).toContain('Super Admin')
  })

  it('tanpa pengguna sama sekali juga NIHIL, bukan SEMUA', () => {
    expect(lingkupData(null).jenis).toBe('NIHIL')
  })
})

describe('unit wajib yang dipakai kueri', () => {
  it('mengembalikan id unit pengguna untuk peran terbatas', () => {
    expect(unitWajib(lingkupData(pengguna('Pengelola Unit', 11)))).toBe(11)
  })

  it('mengembalikan null untuk peran tak terbatas — jadi tidak ada filter tambahan', () => {
    expect(unitWajib(lingkupData(pengguna('Admin Talenta')))).toBeNull()
  })

  /**
   * Filter wajib dipasang BERDAMPINGAN dengan filter pilihan pengguna, bukan
   * menggantikannya. Uji ini mengunci kontraknya: `unitWajib` tidak pernah
   * ikut memutuskan apa yang diminta pengguna, jadi permintaan unit lain
   * menghasilkan irisan kosong — bukan pengalihan diam-diam ke unit sendiri.
   */
  it('tidak mengubah apa pun tentang unit yang DIMINTA pengguna', () => {
    const l = lingkupData(pengguna('Pengelola Unit', 11))
    const diminta = 12
    expect(unitWajib(l)).toBe(11)
    expect(unitWajib(l)).not.toBe(diminta)
  })
})

describe('penjelasan ke pengguna', () => {
  it('daftar yang tersaring selalu punya kalimat penjelas', () => {
    const teks = ringkasLingkup(lingkupData(pengguna('Pengelola Unit', 11)))
    expect(teks).toContain('BP2JK Wilayah DKI Jakarta')
    expect(teks).toContain('unit di bawahnya')
  })

  it('tidak ada kalimat penjelas kalau memang tidak dibatasi', () => {
    expect(ringkasLingkup(lingkupData(pengguna('Pimpinan')))).toBeNull()
    expect(ringkasLingkup(lingkupData(null))).toBeNull()
  })

  it('tetap memberi kalimat walau nama unitnya belum termuat', () => {
    const l = lingkupData({ ...pengguna('Pengelola Unit', 11), namaUnit: null })
    expect(ringkasLingkup(l)).toContain('unit di bawahnya')
  })
})
