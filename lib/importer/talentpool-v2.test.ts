import { readFileSync } from 'node:fs'
import { describe,expect,it } from 'vitest'
import { bacaTalentPool } from './talentpool-xlsx'

describe('SIMT Import Center — Excel legacy 30 kolom',()=>{
  const hasil=bacaTalentPool(readFileSync('test/fixtures/import-legacy-mini.xlsx'))
  it('mengelompokkan banyak baris dalam blok pegawai',()=>{
    expect(hasil.baris).toHaveLength(2)
    expect(hasil.baris.map(x=>x.nip)).toEqual(['198001012005011001','198601012011011002'])
  })
  it('mengambil riwayat jabatan, tanggal dan pelatihan',()=>{
    const a=hasil.baris[0]!
    expect(a.riwayatJabatan).toHaveLength(2)
    expect(a.riwayatJabatan[0]!.tmtMulaiSerial).toBe('46247')
    expect(a.riwayatDiklat).toHaveLength(2)
  })
  it('menangkap asesmen di BARIS LANJUTAN, termasuk nilai bermasalah',()=>{
    const a=hasil.baris[0]!
    expect(a.asesmen).toHaveLength(2)
    expect(a.asesmen[1]!.jenjang).toBe('ADMINISTRATOR')
    expect(a.asesmen[1]!.potkom).toBe('101.88')
    expect(a.asesmen[1]!.tahun).toBe('')
  })
  it('tidak mengubah nilai sumber atau mencampur pegawai',()=>{
    expect(hasil.baris[1]!.asesmen).toHaveLength(0)
    expect(hasil.baris[0]!.riwayatPendidikan).toContain('SLTP')
  })
})
