import { describe, expect, it } from 'vitest'

import {
  bacaScope,
  bolehEndpoint,
  ENDPOINT_V1,
  samarkanPegawai,
  SCOPE_NIHIL,
  type PegawaiUntukApi,
} from './scope'
import { bacaHeaderBearer, buatTokenApi, hashTokenApi, petunjukToken, PREFIKS_TOKEN } from './token'

/**
 * Uji dikelompokkan menurut **cara data bisa bocor ke instansi yang tidak berhak**,
 * bukan menurut nama fungsi — itu yang dijamin PRD §7.3 (UU PDP No. 27/2022).
 */

describe('scope gagal TERTUTUP', () => {
  it('scope yang tidak bisa dibaca berarti tidak ada izin, bukan semua izin', () => {
    for (const buruk of [null, undefined, '', 'bukan json', '[]', '123', 'true', {}, []]) {
      expect(bacaScope(buruk)).toEqual(SCOPE_NIHIL)
    }
  })

  it('klien PENDING dengan scope {} tidak boleh endpoint apa pun', () => {
    const scope = bacaScope({})
    for (const e of ENDPOINT_V1) expect(bolehEndpoint(scope, e)).toBe(false)
  })

  it('data_personal hanya true yang berarti boleh', () => {
    expect(bacaScope({ data_personal: true }).dataPersonal).toBe(true)
    for (const palsu of ['true', 1, 'ya', 'YES', {}, [true]]) {
      expect(bacaScope({ data_personal: palsu }).dataPersonal).toBe(false)
    }
  })

  it('endpoint yang tidak dikenali dibuang, bukan diteruskan', () => {
    const scope = bacaScope({ endpoints: ['pegawai', 'rahasia', 'DROP TABLE', 42] })
    expect(scope.endpoints).toEqual(['pegawai'])
  })

  it('endpoint kembar tidak menggandakan izin', () => {
    expect(bacaScope({ endpoints: ['pegawai', 'pegawai'] }).endpoints).toEqual(['pegawai'])
  })
})

describe('scope dari data dev yang sebenarnya', () => {
  it('BKN: talent-pool & kotak-9, TANPA data personal', () => {
    const scope = bacaScope({ endpoints: ['talent-pool', 'kotak-9-summary'], data_personal: false })
    expect(bolehEndpoint(scope, 'talent-pool')).toBe(true)
    expect(bolehEndpoint(scope, 'pegawai')).toBe(false)
    expect(scope.dataPersonal).toBe(false)
  })

  it('Biro Kepegawaian: bertiga + data personal', () => {
    const scope = bacaScope({
      endpoints: ['pegawai', 'talent-pool', 'kotak-9-summary'],
      data_personal: true,
    })
    expect(scope.endpoints).toHaveLength(3)
    expect(scope.dataPersonal).toBe(true)
  })

  it('kolom JSON yang datang sebagai STRING tetap terbaca', () => {
    const scope = bacaScope('{"endpoints":["pegawai"],"data_personal":true}')
    expect(scope.endpoints).toEqual(['pegawai'])
    expect(scope.dataPersonal).toBe(true)
  })
})

describe('penyamaran data personal', () => {
  const baris: PegawaiUntukApi = {
    nip: '196912241998032005',
    nama: 'Budi Santoso',
    namaJabatan: 'Kepala Balai',
    namaUnit: 'BP2JK DKI',
    eselon: 'III',
    jenjang: 'Administrator',
    tingkatPendidikan: 'S2',
    potkom: 85.5,
    nilaiIntegritas: 100,
    predikatKinerja: 'Baik',
    kotak9: 9,
  }
  const anonim = (nip: string) => `anon-${nip.slice(-4)}`

  it('tanpa scope personal: nip & nama TIDAK ADA sebagai field', () => {
    const hasil = samarkanPegawai(baris, false, anonim)
    expect('nip' in hasil).toBe(false)
    expect('nama' in hasil).toBe(false)
    expect(JSON.stringify(hasil)).not.toContain('196912241998032005')
    expect(JSON.stringify(hasil)).not.toContain('Budi')
  })

  it('tanpa scope personal: data penilaian tetap dikirim', () => {
    const hasil = samarkanPegawai(baris, false, anonim)
    expect(hasil.potkom).toBe(85.5)
    expect(hasil.kotak_9).toBe(9)
    expect(hasil.unit_organisasi).toBe('BP2JK DKI')
  })

  it('id_anonim ada di kedua mode supaya klien tetap bisa membedakan baris', () => {
    expect(samarkanPegawai(baris, false, anonim).id_anonim).toBe('anon-2005')
    expect(samarkanPegawai(baris, true, anonim).id_anonim).toBe('anon-2005')
  })

  it('dengan scope personal: nip & nama dikirim', () => {
    const hasil = samarkanPegawai(baris, true, anonim)
    expect(hasil.nip).toBe('196912241998032005')
    expect(hasil.nama).toBe('Budi Santoso')
  })

  it('ALLOWLIST: kolom baru pada baris sumber tidak menetes ke balasan', () => {
    // Inilah bedanya allowlist vs `delete baris.nip` — kolom yang ditambahkan ke
    // kueri nanti tidak boleh ikut terkirim hanya karena tidak ada yang ingat.
    const denganKolomBaru = { ...baris, email: 'budi@pu.go.id', tanggalLahir: '1969-12-24' }
    const hasil = samarkanPegawai(denganKolomBaru as PegawaiUntukApi, false, anonim)
    expect(JSON.stringify(hasil)).not.toContain('budi@pu.go.id')
    expect(JSON.stringify(hasil)).not.toContain('1969-12-24')
  })
})

describe('token', () => {
  it('token baru berprefiks & cukup panjang untuk 256 bit', () => {
    const t = buatTokenApi()
    expect(t.startsWith(PREFIKS_TOKEN)).toBe(true)
    expect(t.length).toBeGreaterThanOrEqual(PREFIKS_TOKEN.length + 43)
  })

  it('dua token tidak pernah sama', () => {
    const banyak = new Set(Array.from({ length: 200 }, () => buatTokenApi()))
    expect(banyak.size).toBe(200)
  })

  it('hash berprefiks algoritma & stabil', () => {
    const t = 'simt_contoh'
    expect(hashTokenApi(t)).toBe(hashTokenApi(t))
    expect(hashTokenApi(t).startsWith('sha256:')).toBe(true)
    expect(hashTokenApi(t)).toHaveLength('sha256:'.length + 64)
  })

  it('hash tidak memuat plaintext-nya', () => {
    const t = buatTokenApi()
    expect(hashTokenApi(t)).not.toContain(t.slice(PREFIKS_TOKEN.length))
  })

  it('petunjuk token tidak cukup untuk dipakai', () => {
    const t = buatTokenApi()
    const p = petunjukToken(t)
    expect(p.length).toBeLessThan(20)
    expect(t).not.toBe(p)
    expect(t.endsWith(p.slice(-6))).toBe(true)
  })
})

describe('header Bearer', () => {
  it('menerima bentuk yang sah, case-insensitive skemanya (RFC 6750)', () => {
    expect(bacaHeaderBearer('Bearer simt_abc123')).toBe('simt_abc123')
    expect(bacaHeaderBearer('bearer simt_abc123')).toBe('simt_abc123')
    expect(bacaHeaderBearer('  Bearer simt_abc123  ')).toBe('simt_abc123')
  })

  it('menolak bentuk yang tidak dijamin dokumen', () => {
    for (const buruk of [
      null,
      undefined,
      '',
      'simt_abc123',
      'Basic simt_abc123',
      'Bearer',
      'Bearer  spasi_ganda',
      'Bearer "berkutip"',
      'Bearer a b',
    ]) {
      expect(bacaHeaderBearer(buruk)).toBeNull()
    }
  })
})
