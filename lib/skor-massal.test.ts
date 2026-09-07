import { describe, expect, it } from 'vitest'

import { ID_INDIKATOR, rubrikJabatanTarget } from './scoring/fixture'
import type { IndikatorBerkunci } from './penilaian'
import {
  bandingkanSkor,
  hitungSkorMassal,
  peringkatEligible,
  type ProfilKandidat,
  type RubrikJabatanTarget,
  type SkorTersimpan,
} from './skor-massal'

const SEKARANG = new Date(2026, 6, 30, 12)
const OPSI = { sekarang: SEKARANG, tahunSekarang: 2026, masaBerlakuTahun: 3 }

const BERKUNCI: IndikatorBerkunci[] = [
  { indikatorId: ID_INDIKATOR.potkom, kunci: 'POTKOM' },
  { indikatorId: ID_INDIKATOR.tingkatPendidikan, kunci: 'TINGKAT_PENDIDIKAN' },
  { indikatorId: ID_INDIKATOR.kesesuaianBidangIlmu, kunci: 'KESESUAIAN_BIDANG_ILMU' },
  { indikatorId: ID_INDIKATOR.pengembanganKompetensi, kunci: 'PENGEMBANGAN_KOMPETENSI' },
  { indikatorId: ID_INDIKATOR.lamaJabatan, kunci: 'LAMA_JABATAN' },
  { indikatorId: ID_INDIKATOR.keragamanJabatan, kunci: 'KERAGAMAN_JABATAN' },
  { indikatorId: ID_INDIKATOR.substansiJabatan, kunci: 'SUBSTANSI_JABATAN' },
  { indikatorId: ID_INDIKATOR.integritas, kunci: 'INTEGRITAS' },
]

function rubrik(ubah: Partial<RubrikJabatanTarget> = {}): RubrikJabatanTarget {
  return {
    jabatanTargetId: 1,
    jabatanAsal: [],
    kataKunciRelevansi: ['pengadaan', 'semua'],
    syaratKategoriDiklat: ['PBJ'],
    komponen: rubrikJabatanTarget(),
    indikatorBerkunci: BERKUNCI,
    persyaratan: [
      { id: 1, jenisSyarat: 'PENDIDIKAN_MIN', deskripsi: 'Minimal S1', nilaiMinimal: 'S1_D4' },
    ],
    ...ubah,
  }
}

function kandidat(ubah: Partial<ProfilKandidat> = {}): ProfilKandidat {
  return {
    pegawaiId: 1,
    nip: '198001012006041001',
    nama: 'Kandidat Satu',
    tingkatPendidikan: 'S2',
    bidangStudi: ['Teknik Sipil'],
    riwayatDiklat: ['Diklat Pengadaan Barang/Jasa'],
    kategoriDiklatTervalidasi: ['PBJ'],
    jenjangSaatIni: 'Administrator',
    namaJabatanSaatIni: null,
    jabatanIdSaatIni: null,
    eselonSaatIni: 'III',
    tmtJabatan: new Date(2019, 0, 1, 12),
    riwayatJabatan: [
      {
        jabatanNamaMentah: 'Kepala Seksi Pengadaan',
        jabatanId: 3,
        jenjang: 'Administrator',
        eselon: 'III',
        unitOrganisasiId: 7,
        tanggalMulai: new Date(2019, 0, 1, 12),
        tanggalAkhir: null,
        jenisPenugasan: 'DEFINITIF',
        lamaBulan: null,
      },
    ],
    potkom: 85,
    hukumanDisiplin: [],
    golongan: 'III/d',
    asesmen: { tahunAsesmen: 2025, statusAsesmen: 'Berlaku', nilaiKinerjaY: 100 },
    ...ubah,
  }
}

describe('hitungSkorMassal', () => {
  it('menghitung 3 komponen + total untuk setiap kandidat sekaligus', () => {
    const hasil = hitungSkorMassal(rubrik(), [kandidat(), kandidat({ pegawaiId: 2, potkom: 60 })], OPSI)

    expect(hasil.hasil).toHaveLength(2)
    const [satu, dua] = hasil.hasil
    expect(satu!.skorPotensiKompetensi).toBe(85)
    expect(dua!.skorPotensiKompetensi).toBe(60)
    // 65/20/15 — total harus di antara komponen terendah & tertinggi.
    expect(satu!.skorTotal).toBeGreaterThan(dua!.skorTotal)
    expect(hasil.jumlahEligible).toBe(2)
  })

  it('membekukan snapshot rubrik SEKALI, bukan per pegawai', () => {
    const hasil = hitungSkorMassal(rubrik(), [kandidat(), kandidat({ pegawaiId: 2 })], OPSI)
    expect(hasil.snapshotRubrik.komponen).toHaveLength(3)
    expect(hasil.snapshotRubrik.dihitungPada).toBe(SEKARANG.toISOString())
  })

  it('kandidat tak lolos syarat tetap dapat skor — hanya penanda eligible yang beda', () => {
    const hasil = hitungSkorMassal(rubrik(), [kandidat({ tingkatPendidikan: 'SLTA' })], OPSI)
    const satu = hasil.hasil[0]!
    expect(satu.eligible).toBe(false)
    expect(satu.skorTotal).toBeGreaterThan(0)
    expect(satu.catatanEligibility).toContain('SLTA')
  })

  it('asesmen kedaluwarsa membatalkan kelayakan (phase.md §2.9)', () => {
    const hasil = hitungSkorMassal(
      rubrik(),
      [kandidat({ asesmen: { tahunAsesmen: 2020, statusAsesmen: 'Berlaku', nilaiKinerjaY: 100 } })],
      OPSI,
    )
    expect(hasil.hasil[0]!.eligible).toBe(false)
    expect(hasil.hasil[0]!.catatanEligibility).toContain('kedaluwarsa')
  })

  it('rincian per indikator ikut keluar, sampai sub-indikator (U-3)', () => {
    const detail = hitungSkorMassal(rubrik(), [kandidat()], OPSI).hasil[0]!.detail
    // 6 indikator top-level (Potkom · Pendidikan · Bidang Ilmu · Pengembangan ·
    // Nilai Pengalaman Jabatan · Integritas) + 3 sub-indikator = 9 baris,
    // sama dengan 1.080 / 120 baris match_score_detail di pupr_dev.
    expect(detail).toHaveLength(9)
    expect(detail.filter((d) => d.parentIndikatorId !== null)).toHaveLength(3)
  })
})

describe('indikator tanpa sumber otomatis', () => {
  it('dilaporkan, bukan dihitung 0 diam-diam', () => {
    const tanpaKunci = BERKUNCI.map((b) =>
      b.indikatorId === ID_INDIKATOR.substansiJabatan ? { ...b, kunci: null } : b,
    )
    const hasil = hitungSkorMassal(rubrik({ indikatorBerkunci: tanpaKunci }), [kandidat()], OPSI)
    const satu = hasil.hasil[0]!

    expect(satu.indikatorTanpaNilai).toEqual([ID_INDIKATOR.substansiJabatan])
    // Nilainya kosong → mesin menandainya perlu ditinjau, bukan menganggapnya 0 sah.
    expect(satu.perluReview).toBe(true)
  })

  it('nilai manual mengisinya dan bertahan melewati perhitungan', () => {
    const tanpaKunci = BERKUNCI.map((b) =>
      b.indikatorId === ID_INDIKATOR.substansiJabatan ? { ...b, kunci: null } : b,
    )
    const hasil = hitungSkorMassal(rubrik({ indikatorBerkunci: tanpaKunci }), [kandidat()], {
      ...OPSI,
      nilaiManual: { 1: { [ID_INDIKATOR.substansiJabatan]: 'Plt pada jenjang jabatan yang setara' } },
    })
    const baris = hasil.hasil[0]!.detail.find(
      (d) => d.rubrikIndikatorId === ID_INDIKATOR.substansiJabatan,
    )
    expect(baris?.skor).toBe(80)
    expect(hasil.hasil[0]!.perluReview).toBe(false)
  })

  it('nilai manual menimpa nilai otomatis', () => {
    const hasil = hitungSkorMassal(rubrik(), [kandidat()], {
      ...OPSI,
      nilaiManual: { 1: { [ID_INDIKATOR.potkom]: 40 } },
    })
    expect(hasil.hasil[0]!.skorPotensiKompetensi).toBe(40)
  })
})

describe('peringkatEligible', () => {
  it('hanya memberi nomor peringkat kepada yang lolos syarat', () => {
    const hasil = hitungSkorMassal(
      rubrik(),
      [
        kandidat({ pegawaiId: 1, potkom: 90 }),
        kandidat({ pegawaiId: 2, potkom: 70 }),
        kandidat({ pegawaiId: 3, potkom: 95, tingkatPendidikan: 'SLTA' }),
      ],
      OPSI,
    ).hasil

    const peringkat = peringkatEligible(hasil)
    expect(peringkat.get(1)).toBe(1)
    expect(peringkat.get(2)).toBe(2)
    // Skornya tertinggi, tapi tidak lolos syarat → tidak diberi peringkat.
    expect(peringkat.has(3)).toBe(false)
  })

  it('seri diputus oleh nilai kinerja (K-4), bukan oleh id', () => {
    const hasil = hitungSkorMassal(
      rubrik(),
      [
        kandidat({ pegawaiId: 1, asesmen: { tahunAsesmen: 2025, statusAsesmen: 'Berlaku', nilaiKinerjaY: 60 } }),
        kandidat({ pegawaiId: 2, asesmen: { tahunAsesmen: 2025, statusAsesmen: 'Berlaku', nilaiKinerjaY: 100 } }),
      ],
      OPSI,
    ).hasil

    expect(hasil[0]!.skorTotal).toBe(hasil[1]!.skorTotal)
    const peringkat = peringkatEligible(hasil)
    expect(peringkat.get(2)).toBe(1)
    expect(peringkat.get(1)).toBe(2)
  })
})

describe('bandingkanSkor — Simulasi & Diff (U-4)', () => {
  const orang = [
    kandidat({ pegawaiId: 1, nama: 'Satu', potkom: 90 }),
    kandidat({ pegawaiId: 2, nama: 'Dua', potkom: 80 }),
    kandidat({ pegawaiId: 3, nama: 'Tiga', potkom: 70 }),
  ]

  function tersimpan(hasil: ReturnType<typeof hitungSkorMassal>['hasil']): SkorTersimpan[] {
    // Meniru pembacaan dari DB: DECIMAL(6,2), jadi dibulatkan 2 desimal.
    return hasil.map((h) => ({
      pegawaiId: h.pegawaiId,
      skorTotal: Math.round(h.skorTotal * 100) / 100,
      eligible: h.eligible,
      nilaiKinerjaY: h.nilaiKinerjaY,
    }))
  }

  it('rubrik yang TIDAK diubah menghasilkan diff kosong', () => {
    // Ini sekaligus bukti bahwa pipeline yang dipakai UI menghasilkan angka yang
    // sama dengan yang tersimpan — kalau tidak, diff akan penuh tanpa ada yang
    // menyunting rubrik apa pun.
    const awal = hitungSkorMassal(rubrik(), orang, OPSI)
    const diff = bandingkanSkor(tersimpan(awal.hasil), awal.hasil)

    expect(diff.ringkas.adaPerubahan).toBe(false)
    expect(diff.ringkas.jumlahBerubah).toBe(0)
    expect(diff.ringkas.selisihTerbesar).toBe(0)
    expect(diff.baris.every((b) => b.jenis === 'TETAP')).toBe(true)
  })

  it('membalik bobot komponen menggeser peringkat, dan geserannya terhitung', () => {
    const awal = hitungSkorMassal(rubrik(), orang, OPSI)

    // Integritas 65% & Potkom 15% — orang dengan Potkom rendah jadi setara.
    const dibalik = rubrikJabatanTarget().map((k) =>
      k.namaKomponen === 'Potensi & Kompetensi'
        ? { ...k, bobot: 0.15, indikator: k.indikator.map((i) => ({ ...i, bobot: 0.15 })) }
        : k.namaKomponen === 'Integritas & Moralitas'
          ? { ...k, bobot: 0.65, indikator: k.indikator.map((i) => ({ ...i, bobot: 0.65 })) }
          : k,
    )
    const baru = hitungSkorMassal(rubrik({ komponen: dibalik }), orang, OPSI)
    const diff = bandingkanSkor(tersimpan(awal.hasil), baru.hasil)

    expect(diff.ringkas.adaPerubahan).toBe(true)
    expect(diff.ringkas.selisihTerbesar).toBeGreaterThan(0)
    // Semua orang skornya berubah; ketiganya tetap eligible.
    expect(diff.baris.every((b) => b.jenis !== 'KELUAR')).toBe(true)
    expect(diff.ringkas.eligibleSesudah).toBe(3)
  })

  it('kandidat yang belum pernah dihitung ditandai BARU, bukan naik/turun', () => {
    const awal = hitungSkorMassal(rubrik(), orang.slice(0, 2), OPSI)
    const baru = hitungSkorMassal(rubrik(), orang, OPSI)
    const diff = bandingkanSkor(tersimpan(awal.hasil), baru.hasil)

    const tiga = diff.baris.find((b) => b.pegawaiId === 3)!
    expect(tiga.jenis).toBe('BARU')
    expect(tiga.totalSebelum).toBeNull()
    expect(tiga.selisihTotal).toBeNull()
    expect(diff.ringkas.baru).toBe(1)
  })

  it('perubahan kelayakan ditandai MASUK / KELUAR, bukan hanya pergeseran skor', () => {
    const awal = hitungSkorMassal(rubrik(), orang, OPSI)
    const ketat = rubrik({
      persyaratan: [
        { id: 1, jenisSyarat: 'PENDIDIKAN_MIN', deskripsi: 'Minimal S3', nilaiMinimal: 'S3' },
      ],
    })
    const baru = hitungSkorMassal(ketat, orang, OPSI)
    const diff = bandingkanSkor(tersimpan(awal.hasil), baru.hasil)

    expect(diff.ringkas.keluar).toBe(3)
    expect(diff.ringkas.eligibleSesudah).toBe(0)

    // Arah sebaliknya.
    const balik = bandingkanSkor(tersimpan(baru.hasil), awal.hasil)
    expect(balik.ringkas.masuk).toBe(3)
  })

  it('naik peringkat bernilai negatif, turun positif', () => {
    const awal = hitungSkorMassal(rubrik(), orang, OPSI)
    // Potkom dibalik: yang tadinya teratas jadi terbawah.
    const orangBaru = [
      kandidat({ pegawaiId: 1, nama: 'Satu', potkom: 70 }),
      kandidat({ pegawaiId: 2, nama: 'Dua', potkom: 80 }),
      kandidat({ pegawaiId: 3, nama: 'Tiga', potkom: 90 }),
    ]
    const baru = hitungSkorMassal(rubrik(), orangBaru, OPSI)
    const diff = bandingkanSkor(tersimpan(awal.hasil), baru.hasil)

    expect(diff.baris.find((b) => b.pegawaiId === 3)!.geserRanking).toBe(-2)
    expect(diff.baris.find((b) => b.pegawaiId === 3)!.jenis).toBe('NAIK')
    expect(diff.baris.find((b) => b.pegawaiId === 1)!.geserRanking).toBe(2)
    expect(diff.baris.find((b) => b.pegawaiId === 1)!.jenis).toBe('TURUN')
    expect(diff.ringkas.naik).toBe(1)
    expect(diff.ringkas.turun).toBe(1)
  })

  it('skor berubah tapi peringkat tetap ditandai SKOR', () => {
    const awal = hitungSkorMassal(rubrik(), orang, OPSI)
    // Naikkan semua Potkom 2 poin — urutan tidak berubah.
    const naikSemua = orang.map((o) => ({ ...o, potkom: (o.potkom ?? 0) + 2 }))
    const baru = hitungSkorMassal(rubrik(), naikSemua, OPSI)
    const diff = bandingkanSkor(tersimpan(awal.hasil), baru.hasil)

    expect(diff.baris.every((b) => b.jenis === 'SKOR')).toBe(true)
    expect(diff.ringkas.naik).toBe(0)
    expect(diff.ringkas.turun).toBe(0)
    expect(diff.ringkas.jumlahBerubah).toBe(3)
  })
})
