import { writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import type { KolomEkspor } from './ekspor'
import { namaBerkasXlsx, susunXlsx } from './ekspor-xlsx'
import { bacaXlsx } from './importer/xlsx'

interface Baris {
  nama: string
  skor: number
  catatan: string | null
  tanggal: Date
  lolos: boolean
}

const KOLOM: Array<KolomEkspor<Baris>> = [
  { kunci: 'nama', judul: 'Nama', nilai: (b) => b.nama },
  { kunci: 'skor', judul: 'Skor', nilai: (b) => b.skor },
  { kunci: 'catatan', judul: 'Catatan', nilai: (b) => b.catatan },
  { kunci: 'tanggal', judul: 'Tanggal', nilai: (b) => b.tanggal },
  { kunci: 'lolos', judul: 'Lolos', nilai: (b) => b.lolos },
]

const BARIS: Baris[] = [
  { nama: 'Ahmad Fauzi', skor: 87.5, catatan: 'baik', tanggal: new Date('2026-09-02T10:30:00Z'), lolos: true },
  { nama: 'Siti, S.T.', skor: 60, catatan: null, tanggal: new Date('2026-09-01T00:00:00Z'), lolos: false },
  // baris yang MEMANG dirancang untuk mencoba menembus proteksi & escaping
  { nama: '=cmd|"/c calc"!A1', skor: 0, catatan: 'ada "kutip" & <tag> serta ampersand', tanggal: new Date(), lolos: true },
]

/*
  Round-trip lewat PEMBACA `.xlsx` yang sudah ada di repo (`lib/importer/xlsx.ts`)
  — bukan asersi atas string XML mentah. Kalau penulis & pembaca berselisih soal
  bentuk ZIP/XML, uji atas XML mentah bisa lulus sementara berkasnya tetap tidak
  bisa dibuka aplikasi lain (atau, di sini, oleh pembaca kita sendiri).
*/
describe('susunXlsx — round-trip lewat bacaXlsx()', () => {
  const buf = susunXlsx(KOLOM, BARIS)
  const lembar = bacaXlsx(buf)

  it('header baris pertama sesuai judul kolom', () => {
    expect(lembar.sel.get('1:1')).toBe('Nama')
    expect(lembar.sel.get('1:2')).toBe('Skor')
  })

  it('nilai teks & angka terbaca kembali', () => {
    expect(lembar.sel.get('2:1')).toBe('Ahmad Fauzi')
    expect(lembar.sel.get('2:2')).toBe('87.5')
  })

  it('nilai null/kosong tidak menghasilkan sel (bukan "null" atau "undefined")', () => {
    expect(lembar.sel.has('3:3')).toBe(false)
  })

  it('boolean ditulis sebagai teks ya/tidak, konsisten dengan CSV', () => {
    expect(lembar.sel.get('2:5')).toBe('ya')
    expect(lembar.sel.get('3:5')).toBe('tidak')
  })

  it('tanggal ditulis sebagai teks, bukan serial Excel', () => {
    expect(lembar.sel.get('2:4')).toBe('2026-09-02 10:30:00')
  })

  it('injeksi formula DINETRALKAN — sel diawali kutip, bukan "="', () => {
    const sel = lembar.sel.get('4:1')
    expect(sel).toBeDefined()
    expect(sel!.startsWith('=')).toBe(false)
    expect(sel).toContain('cmd')
  })

  it('kutip ganda, tag, dan ampersand di catatan bertahan utuh sesudah round-trip', () => {
    expect(lembar.sel.get('4:3')).toBe('ada "kutip" & <tag> serta ampersand')
  })

  it('bisa disimpan sebagai berkas .xlsx yang valid (dibaca ulang dari disk)', () => {
    const path = '/tmp/claude-1000/-home-user1/0b9e2451-5230-471d-96ba-4574681fcb99/scratchpad/uji-ekspor.xlsx'
    writeFileSync(path, buf)
    const ulang = bacaXlsx(buf)
    expect(ulang.sel.get('1:1')).toBe('Nama')
  })
})

describe('namaBerkasXlsx', () => {
  it('berakhiran .xlsx, bukan .csv', () => {
    expect(namaBerkasXlsx('gap-indikator', new Date('2026-09-02T10:30:00'))).toMatch(/\.xlsx$/)
  })
})
