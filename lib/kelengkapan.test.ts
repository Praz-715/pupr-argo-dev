import { describe, expect, it } from 'vitest'

import {
  BUTIR_KELENGKAPAN,
  hitungKelengkapan,
  tingkatKelengkapan,
  type FaktaKelengkapan,
} from './kelengkapan'

const semuaTerpenuhi = (): FaktaKelengkapan =>
  Object.fromEntries(BUTIR_KELENGKAPAN.map((b) => [b.kunci, true]))

describe('definisi butir kelengkapan', () => {
  it('setiap butir punya kunci unik', () => {
    const kunci = BUTIR_KELENGKAPAN.map((b) => b.kunci)
    expect(new Set(kunci).size).toBe(kunci.length)
  })

  it('setiap butir punya bobot positif dan alasan yang dijelaskan', () => {
    for (const b of BUTIR_KELENGKAPAN) {
      expect(b.bobot).toBeGreaterThan(0)
      expect(b.alasan.length).toBeGreaterThan(20)
    }
  })

  it('butir yang jadi input rubrik berbobot lebih besar daripada butir administratif', () => {
    const cari = (k: string) => BUTIR_KELENGKAPAN.find((b) => b.kunci === k)!
    // Asesmen adalah gerbang seluruh penilaian; tahun lulus hanya administratif
    expect(cari('adaAsesmen').bobot).toBeGreaterThan(cari('pendidikanBertahun').bobot)
    expect(cari('riwayatJabatanBertanggal').bobot).toBeGreaterThan(
      cari('kinerjaTriwulanLengkap').bobot,
    )
  })
})

describe('hitungKelengkapan', () => {
  it('semua terpenuhi → 100%', () => {
    const h = hitungKelengkapan(semuaTerpenuhi())
    expect(h.persen).toBe(100)
    expect(h.belum).toHaveLength(0)
    expect(h.prioritas).toBeNull()
  })

  it('tidak ada yang terpenuhi → 0%', () => {
    const h = hitungKelengkapan({})
    expect(h.persen).toBe(0)
    expect(h.terpenuhi).toHaveLength(0)
    expect(h.belum).toHaveLength(BUTIR_KELENGKAPAN.length)
  })

  it('fakta yang tidak disebut dianggap belum terpenuhi (bukan lolos diam-diam)', () => {
    const h = hitungKelengkapan({ nipValid: true })
    expect(h.persen).toBeGreaterThan(0)
    expect(h.persen).toBeLessThan(100)
    expect(h.belum.length).toBe(BUTIR_KELENGKAPAN.length - 1)
  })

  it('nilai selain true tidak dihitung terpenuhi', () => {
    // Menjaga dari `undefined`/`null` yang lolos karena truthiness
    const h = hitungKelengkapan({ nipValid: false })
    expect(h.terpenuhi).toHaveLength(0)
  })

  it('prioritas = butir belum terpenuhi dengan bobot tertinggi', () => {
    const fakta = semuaTerpenuhi()
    fakta.adaAsesmen = false // bobot 4, tertinggi
    fakta.pendidikanBertahun = false // bobot 1
    const h = hitungKelengkapan(fakta)
    expect(h.prioritas?.kunci).toBe('adaAsesmen')
  })

  it('bobot terpenuhi + bobot belum = total bobot', () => {
    const fakta = semuaTerpenuhi()
    fakta.adaDiklat = false
    const h = hitungKelengkapan(fakta)
    const bobotBelum = h.belum.reduce((n, b) => n + b.bobot, 0)
    expect(h.bobotTerpenuhi + bobotBelum).toBe(h.bobotTotal)
  })

  it('persen dibulatkan satu desimal', () => {
    const fakta = semuaTerpenuhi()
    fakta.adaDiklat = false
    const h = hitungKelengkapan(fakta)
    expect(h.persen).toBe(Math.round(h.persen * 10) / 10)
  })
})

describe('tingkatKelengkapan — ambang sama dengan widget Kesehatan Data', () => {
  it.each([
    [100, 'LENGKAP'],
    [90, 'LENGKAP'],
    [89.9, 'CUKUP'],
    [60, 'CUKUP'],
    [59.9, 'KURANG'],
    [0, 'KURANG'],
  ] as const)('%s%% → %s', (persen, harapan) => {
    expect(tingkatKelengkapan(persen)).toBe(harapan)
  })
})
