import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import { bacaTalentPool } from './talentpool-xlsx'
import { hurufKolom, nomorKolom } from './xlsx'

/**
 * Uji KESETARAAN terhadap ekstraktor Python.
 *
 * `doc/data/talentpool-pengawas.json` adalah keluaran `scripts/xlsx-ke-json.py`
 * atas berkas yang sama — ekstraktor yang sudah dipakai mengimpor ke-53 pegawai
 * ini dan yang perbaikan datanya divalidasi terhadap data (unit 46/46, rentang
 * tanggal 386/386). Uji ini menuntut modul TypeScript menghasilkan hal yang
 * **identik** untuk baris yang bersih, sehingga "satu aturan, dua jalur" bukan
 * klaim melainkan sesuatu yang gagal kalau dilanggar.
 *
 * Berkas sumbernya ada di luar repo (`/home/user1/…`), jadi ujinya DILEWATI —
 * bukan gagal — kalau berkasnya tidak ada. Uji yang merah karena berkas milik
 * satu mesin tidak ada akan diabaikan orang, dan bersamanya uji yang sungguhan.
 */

const SUMBER = '/home/user1/TALENT POOL PENGAWAS#2 fix.xlsx'
const ACUAN = 'doc/data/talentpool-pengawas.json'

function berkasAda(p: string): boolean {
  try {
    readFileSync(p)
    return true
  } catch {
    return false
  }
}

describe('lib/importer/xlsx — utilitas kolom', () => {
  it('menerjemahkan huruf kolom Excel dua arah', () => {
    for (const [huruf, nomor] of [
      ['A', 1],
      ['Z', 26],
      ['AA', 27],
      ['AB', 28],
      ['AZ', 52],
      ['BA', 53],
    ] as const) {
      expect(nomorKolom(huruf)).toBe(nomor)
      expect(hurufKolom(nomor)).toBe(huruf)
    }
  })
})

describe.skipIf(!berkasAda(SUMBER) || !berkasAda(ACUAN))(
  'bacaTalentPool setara dengan scripts/xlsx-ke-json.py',
  () => {
    const hasil = bacaTalentPool(readFileSync(SUMBER))
    const acuan = JSON.parse(readFileSync(ACUAN, 'utf8')) as Array<Record<string, unknown>>
    const acuanPerBaris = new Map(acuan.map((r) => [Number(r.barisExcel), r]))

    it('menemukan jumlah pegawai yang sama', () => {
      expect(hasil.baris.length).toBe(acuan.length)
    })

    it('mengelompokkan baris lanjutan ke pegawai yang benar', () => {
      // Bukan sekadar "jumlahnya sama": nomor baris Excel tiap blok harus sama,
      // sebab di situlah pengelompokannya bisa salah tanpa mengubah jumlah.
      expect(hasil.baris.map((b) => b.barisExcel)).toEqual(acuan.map((r) => Number(r.barisExcel)))
    })

    it('menandai TEPAT baris yang ekstraktor Python perbaiki, tidak lebih & tidak kurang', () => {
      const ditandai = hasil.baris.filter((b) => b.perluTinjau.length > 0).map((b) => b.barisExcel)
      const diperbaikiPython = acuan
        .filter((r) => r.unitKerjaDipulihkan === true || r.blokTergeserDipulihkan === true)
        .map((r) => Number(r.barisExcel))
      expect(ditandai.sort((a, b) => a - b)).toEqual(diperbaikiPython.sort((a, b) => a - b))
    })

    it('menghasilkan field identik untuk baris yang BERSIH', () => {
      const FIELD = [
        'no',
        'nama',
        'nip',
        'tmtGolongan',
        'golongan',
        'eselon',
        'namaJabatan',
        'unitKerja',
        'tmtJabatan',
        'sekolah',
        'bidangStudi',
        'tingkatPendidikan',
        'jurusan',
        'riwayatPendidikan',
        'jenjangAsesmen',
        'tahunAsesmen',
        'jenisAsesmen',
        'statusAsesmen',
        'potkom',
        'ratingKinerja',
        'kotak9Sumber',
      ] as const
      const beda: string[] = []
      let diperiksa = 0
      for (const b of hasil.baris) {
        if (b.perluTinjau.length > 0) continue
        const a = acuanPerBaris.get(b.barisExcel)!
        diperiksa++
        for (const f of FIELD) {
          const kiri = String(b[f] ?? '')
          const kanan = String(a[f] ?? '')
          if (kiri !== kanan) beda.push(`baris ${b.barisExcel} · ${f}: TS "${kiri}" ≠ PY "${kanan}"`)
        }
      }
      expect(diperiksa).toBeGreaterThan(40)
      expect(beda).toEqual([])
    })

    it('menghasilkan riwayat jabatan & diklat identik untuk baris yang BERSIH', () => {
      const beda: string[] = []
      let entriJabatan = 0
      let entriDiklat = 0
      for (const b of hasil.baris) {
        if (b.perluTinjau.length > 0) continue
        const a = acuanPerBaris.get(b.barisExcel)!
        const rjPy = (a.riwayatJabatan ?? []) as Array<Record<string, unknown>>
        const rdPy = (a.riwayatDiklat ?? []) as string[]
        entriJabatan += b.riwayatJabatan.length
        entriDiklat += b.riwayatDiklat.length
        if (b.riwayatJabatan.length !== rjPy.length) {
          beda.push(`baris ${b.barisExcel}: riwayat jabatan ${b.riwayatJabatan.length} ≠ ${rjPy.length}`)
        } else {
          b.riwayatJabatan.forEach((e, i) => {
            const p = rjPy[i]!
            for (const f of ['nama', 'masaKerja', 'tmtMulaiSerial', 'tmtAkhirSerial'] as const) {
              if (String(e[f] ?? '') !== String(p[f] ?? '')) {
                beda.push(`baris ${b.barisExcel} riwayat[${i}].${f}: "${e[f]}" ≠ "${p[f]}"`)
              }
            }
          })
        }
        if (b.riwayatDiklat.join('||') !== rdPy.join('||')) {
          beda.push(`baris ${b.barisExcel}: riwayat diklat berbeda`)
        }
      }
      // Kontrol positif: "nol beda" tidak boleh berarti "nol yang dibandingkan".
      expect(entriJabatan).toBeGreaterThan(300)
      expect(entriDiklat).toBeGreaterThan(100)
      expect(beda).toEqual([])
    })

    it('melaporkan label header yang tidak dikenali alih-alih mengabaikannya', () => {
      expect(Array.isArray(hasil.labelTakDikenal)).toBe(true)
    })
  },
)
