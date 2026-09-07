import { PARAMETER_SKORING_BAWAAN } from '../scoring'
import { describe, expect, it } from 'vitest'

import { petakanRekaman, petakanSemua } from './pemetaan'
import { SkemaBalasanEnom, SkemaRekamanEnom } from './tipe'

/**
 * Uji pemetaan eNom — murni, tanpa jaringan.
 *
 * Bahannya adalah **balasan nyata** yang tercatat saat integrasi ini dipasang,
 * bukan contoh karangan. Itu penting: seluruh keanehan yang diuji di sini
 * (angka sebagai string, potkom di atas 100, integritas skala 1–4, predikat
 * HURUF BESAR) ditemukan dari sumbernya, dan uji yang memakai data karangan
 * akan lulus tanpa pernah menyentuh satu pun di antaranya.
 */

/** Balasan sungguhan dari `POST /enom/api/cekdata_bikon`, disalin apa adanya. */
const REKAMAN_NYATA = {
  nip: '198411242010121003',
  nama_pegawai: 'Ade Dian Sumeri, S.H.',
  jenjang: 'PENGAWAS',
  jenis_asesmen: 'PENGAWAS',
  tahun_asesmen: '2026',
  nilai_integritas: '3.25',
  nilai_potkom: '130.729166925',
  tahun_kinerja: '2025',
  predikat_kinerja: 'SANGAT BAIK',
  kotak: '9',
  infoip: '36.69.155.201',
  waktu_ambil: '10-08-2026 11:15:05',
}

const OPSI = { tahunSekarang: 2026, ...PARAMETER_SKORING_BAWAAN }

describe('SkemaRekamanEnom', () => {
  it('menerima angka yang datang sebagai string', () => {
    const r = SkemaRekamanEnom.parse(REKAMAN_NYATA)
    expect(r.tahun_asesmen).toBe(2026)
    expect(r.nilai_potkom).toBeCloseTo(130.729166925)
    expect(r.kotak).toBe(9)
  })

  it('meloloskan field yang belum dikenal, bukan menolak seluruh balasan', () => {
    // Sumber tidak berdokumen; field baru tidak boleh mematikan sinkronisasi.
    const r = SkemaRekamanEnom.parse({ ...REKAMAN_NYATA, kolom_baru_dari_sumber: 'x' })
    expect(r.nip).toBe(REKAMAN_NYATA.nip)
  })

  it('membedakan amplop sukses dari amplop gagal', () => {
    expect(
      SkemaBalasanEnom.parse({ status: false, message: 'Unauthorized: Invalid X-Secret' }).status,
    ).toBe(false)
  })
})

describe('petakanRekaman', () => {
  it('menurunkan sumbu Y dari predikat HURUF BESAR', () => {
    const { hasil } = petakanRekaman(SkemaRekamanEnom.parse(REKAMAN_NYATA), OPSI)
    expect(hasil?.asesmen.nilaiKinerjaY).toBe(100)
  })

  it('MENYIMPAN potkom di atas 100 apa adanya dan mencatatnya sebagai temuan', () => {
    // 130,73 menandakan skala eNom berbeda dari 0–100. Sampai 18 Agu 2026 nilai
    // itu DIPOTONG ke 100; pemilik proses memutuskan sebaliknya — disimpan apa
    // adanya, karena memotongnya membuat separuh populasi menumpuk di X=100 dan
    // kehilangan daya bedanya. Temuannya tetap ada supaya pertanyaan skalanya
    // tidak hilang, hanya kodenya berubah.
    const { hasil, temuan } = petakanRekaman(SkemaRekamanEnom.parse(REKAMAN_NYATA), OPSI)
    expect(hasil?.asesmen.nilaiPotensialX).toBeGreaterThan(100)
    expect(hasil?.asesmen.potkom).toBeGreaterThan(100)
    expect(temuan.map((t) => t.kode)).toContain('POTKOM_DI_ATAS_100')
    expect(temuan.map((t) => t.kode)).not.toContain('SKOR_DI_LUAR_RENTANG')
  })

  it('menaikkan integritas skala 1–4 ke skala rubrik', () => {
    const { hasil } = petakanRekaman(SkemaRekamanEnom.parse(REKAMAN_NYATA), OPSI)
    expect(hasil?.asesmen.nilaiIntegritas).toBe(75)
  })

  it('MENGHITUNG ULANG kotak 9 dan menyimpan nilai sumber terpisah', () => {
    const { hasil } = petakanRekaman(SkemaRekamanEnom.parse(REKAMAN_NYATA), OPSI)
    expect(hasil?.asesmen.kotak9).toBe(9)
    expect(hasil?.kotak9Sumber).toBe(9)
  })

  it('menandai selisih ketika kotak sumber berbeda dari hasil hitung', () => {
    // Y=100 (Sangat Baik) & X=40 → kotak hitung 3; sumber mengaku 9.
    const { hasil, temuan } = petakanRekaman(
      SkemaRekamanEnom.parse({ ...REKAMAN_NYATA, nilai_potkom: '40', kotak: '9' }),
      OPSI,
    )
    expect(hasil?.asesmen.kotak9).not.toBe(9)
    expect(temuan.map((t) => t.kode)).toContain('KOTAK9_BEDA_DENGAN_HITUNGAN')
  })

  it('MELEWATI baris yang predikatnya tidak dikenali, tidak menebaknya', () => {
    const { hasil, temuan } = petakanRekaman(
      SkemaRekamanEnom.parse({ ...REKAMAN_NYATA, predikat_kinerja: 'ISTIMEWA' }),
      OPSI,
    )
    expect(hasil).toBeNull()
    expect(temuan.map((t) => t.kode)).toContain('PREDIKAT_TIDAK_DIKENALI')
  })

  it('tidak mengarang status "Berlaku" untuk asesmen lama', () => {
    // eNom tidak mengirim status; aturan masa berlaku 3 tahun yang menentukan.
    const { hasil } = petakanRekaman(
      SkemaRekamanEnom.parse({ ...REKAMAN_NYATA, tahun_asesmen: '2015' }),
      OPSI,
    )
    expect(hasil?.asesmen.statusAsesmen).toBe('Expired')
  })
})

describe('petakanSemua', () => {
  it('meneruskan baris yang baik walau ada baris yang dilewati', () => {
    const { hasil, temuan } = petakanSemua(
      [
        SkemaRekamanEnom.parse(REKAMAN_NYATA),
        SkemaRekamanEnom.parse({ ...REKAMAN_NYATA, nip: '2', predikat_kinerja: '' }),
      ],
      OPSI,
    )
    expect(hasil).toHaveLength(1)
    expect(temuan.map((t) => t.kode)).toContain('PREDIKAT_TIDAK_DIKENALI')
  })
})
