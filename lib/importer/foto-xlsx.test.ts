import { readFileSync } from 'node:fs'
import { describe,expect,it } from 'vitest'
import { bacaTalentPool } from './talentpool-xlsx'
import { ekstrakFotoTalentPool } from './foto-xlsx'

describe('Foto embedded Talent Pool',()=>{
 const file=readFileSync('test/fixtures/import-legacy-foto-mini.xlsx')
 const rows=bacaTalentPool(file).baris
 const media=ekstrakFotoTalentPool(file,rows)
 it('maps column D anchors to employee NIP (rather than image filename)',()=>{
  expect(rows).toHaveLength(2)
  expect(media.foto).toHaveLength(2)
  expect(media.foto.map(f=>f.nip)).toEqual(['198001012005011001','198601012011011002'])
  expect(media.foto.map(f=>f.barisExcel)).toEqual([2,4])
  expect(media.foto[0]!.buffer.subarray(0,4).toString('hex')).toBe('89504e47')
 })
 it('does not require cell D text',()=>{
  expect(rows[0]!.nip).toBe(media.foto[0]!.nip)
 })
 it('returns no media when the workbook has no drawing',()=>{
  const bare=readFileSync('test/fixtures/import-legacy-mini.xlsx')
  expect(ekstrakFotoTalentPool(bare,bacaTalentPool(bare).baris).foto).toHaveLength(0)
 })
})
