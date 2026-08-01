import { describe, expect, it } from 'vitest'

import {
  PANJANG_MAKS_SANDI,
  PANJANG_MIN_SANDI,
  cocokkanSandi,
  hashSandi,
  periksaKebijakanSandi,
} from './sandi'

/**
 * Uji diorganisasi menurut **apa yang gagal kalau aturannya tidak ada**, bukan
 * menurut nama fungsi. Kebijakan sandi mudah ditulis dan mudah salah diam-diam;
 * yang berbahaya justru aturan yang kelihatan sepele (batas 72 byte bcrypt).
 */

describe('panjang minimal', () => {
  it('menolak sandi lebih pendek dari ambang & menyebut angkanya', () => {
    const pesan = periksaKebijakanSandi('pendek1')
    expect(pesan).toContain(String(PANJANG_MIN_SANDI))
    expect(pesan).toContain('7')
  })

  it('menerima sandi tepat di ambang', () => {
    expect(periksaKebijakanSandi('a'.repeat(PANJANG_MIN_SANDI - 1) + '1')).toBeNull()
  })
})

describe('batas 72 byte bcrypt', () => {
  /**
   * Ini aturan yang tidak akan ditemukan siapa pun dengan mencoba-coba: bcrypt
   * memotong di 72 byte TANPA memberi tahu, jadi dua sandi panjang yang berbeda
   * di ujungnya akan cocok satu sama lain.
   */
  it('membuktikan bahwa tanpa batas ini dua sandi berbeda akan dianggap sama', async () => {
    const awalan = 'A1'.repeat(36) // tepat 72 byte
    const hash = await hashSandi(awalan + 'ekor-pertama')
    expect(await cocokkanSandi(awalan + 'ekor-yang-sama-sekali-lain', hash)).toBe(true)
  })

  it('menolak sandi melewati 72 byte', () => {
    expect(periksaKebijakanSandi('A1'.repeat(37))).toContain('terlalu panjang')
  })

  it('mengukur BYTE, bukan karakter — huruf multi-byte ikut dihitung', () => {
    // 40 karakter, tapi tiap 'é' dua byte → 80 byte.
    const sandi = 'é'.repeat(39) + '1'
    expect(sandi.length).toBeLessThan(PANJANG_MAKS_SANDI)
    expect(periksaKebijakanSandi(sandi)).toContain('terlalu panjang')
  })
})

describe('sandi yang jadi tebakan pertama', () => {
  it('menolak sandi seed dev supaya tidak ikut ke produksi', () => {
    expect(periksaKebijakanSandi('password123')).toContain('terlalu umum')
  })

  it('tidak peduli besar-kecil huruf', () => {
    expect(periksaKebijakanSandi('PassWord123')).toContain('terlalu umum')
  })
})

describe('sandi yang memuat identitas sendiri', () => {
  it('menolak sandi yang memuat username', () => {
    expect(periksaKebijakanSandi('reza.kurniawan-2026', { username: 'reza.kurniawan' })).toContain(
      'username',
    )
  })

  it('menolak sandi yang memuat bagian lokal email', () => {
    expect(
      periksaKebijakanSandi('martyanti.rbs#77', { email: 'martyanti.rbs@djbk.pu.go.id' }),
    ).toContain('email')
  })

  it('tidak menolak kebetulan pada username sangat pendek', () => {
    // Username 2 huruf akan cocok dengan hampir semua sandi; aturan yang
    // menolaknya membuat pengguna itu praktis tidak bisa punya sandi.
    expect(periksaKebijakanSandi('konstruksi2026', { username: 'ko' })).toBeNull()
  })
})

describe('keragaman karakter', () => {
  it('menolak sandi panjang yang hanya satu jenis karakter', () => {
    expect(periksaKebijakanSandi('aaaaaaaaaaaaaaa')).toContain('dua jenis')
    expect(periksaKebijakanSandi('123456789012345')).toContain('dua jenis')
  })

  it('menerima dua jenis — tidak menuntut empat', () => {
    expect(periksaKebijakanSandi('konstruksi2026')).toBeNull()
    expect(periksaKebijakanSandi('KONSTRUKSI-JAYA')).toBeNull()
  })

  it('menolak sandi yang hanya spasi', () => {
    expect(periksaKebijakanSandi('           ')).toContain('spasi')
  })
})

describe('hash & pencocokan', () => {
  it('hash dari sandi yang sama selalu berbeda (salt), tapi tetap cocok', async () => {
    const a = await hashSandi('konstruksi2026')
    const b = await hashSandi('konstruksi2026')
    expect(a).not.toBe(b)
    expect(await cocokkanSandi('konstruksi2026', a)).toBe(true)
    expect(await cocokkanSandi('konstruksi2026', b)).toBe(true)
  })

  it('sandi salah tidak cocok', async () => {
    const h = await hashSandi('konstruksi2026')
    expect(await cocokkanSandi('konstruksi2025', h)).toBe(false)
  })

  it('hash kosong atau rusak berarti SALAH, bukan melempar', async () => {
    expect(await cocokkanSandi('apa pun', null)).toBe(false)
    expect(await cocokkanSandi('apa pun', '')).toBe(false)
    expect(await cocokkanSandi('apa pun', 'bukan-hash-bcrypt')).toBe(false)
  })

  it('mengenali hash bcrypt lama dari seed dev (varian $2b$)', async () => {
    const seed = '$2b$10$IekKg3EGFAr9xA/2OgJaN.BgBkj56K5Gwhju2FOKvVeM4r8dPrxOq'
    expect(await cocokkanSandi('password123', seed)).toBe(true)
    expect(await cocokkanSandi('password124', seed)).toBe(false)
  })
})
