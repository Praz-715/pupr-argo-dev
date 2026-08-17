import { describe, expect, it } from 'vitest'

import { profilSumber, SUMBER_SISTEM, sudahTerintegrasi } from './sumber-data'

describe('sumber-data', () => {
  it('setiap nilai enum sync_log.sumber_sistem punya profilnya', () => {
    // Uji KELENGKAPAN: sumber baru di skema tanpa entri di sini akan tampil
    // sebagai "belum tersambung" di UI — aman, tapi salah kalau klien-nya
    // sebenarnya sudah dibuat. Uji ini yang memaksa keduanya ditambah bersamaan.
    for (const s of SUMBER_SISTEM) {
      const p = profilSumber(s)
      expect(p.jalur.trim(), `${s} tanpa keterangan jalur`).not.toBe('')
      expect(['TERINTEGRASI', 'BELUM_ADA_JALUR']).toContain(p.keadaan)
    }
  })

  it('hanya eNominasi & Manual yang terintegrasi hari ini', () => {
    // Mengunci keadaan NYATA 12 Agu 2026: satu-satunya klien HTTP di kode adalah
    // lib/enom. Kalau uji ini merah karena eHRM/eKinerja diubah jadi
    // TERINTEGRASI, pastikan klien-nya benar-benar ada — bukan sekadar supaya
    // halaman Konsolidasi terlihat hijau.
    expect(SUMBER_SISTEM.filter(sudahTerintegrasi).sort()).toEqual(['Manual', 'eNominasi'])
  })

  it('sumber tak dikenal gagal ke arah aman', () => {
    expect(profilSumber('eSesuatu').keadaan).toBe('BELUM_ADA_JALUR')
  })
})
