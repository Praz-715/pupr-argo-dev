import { describe, expect, it } from 'vitest'

import {
  KATEGORI_INTEGRITAS,
  KATEGORI_LAMA_JABATAN_BERLUBANG,
  KATEGORI_PENDIDIKAN,
  RUBRIK_GENERIK,
  rubrikJabatanTarget,
} from './fixture'
import type { IndikatorNode, KategoriSkor, KomponenNode } from './types'
import { hitungSumbu } from './rubrik'
import { ringkasValidasi, validasiRubrik, type KodeTemuanRubrik } from './validasi'

/**
 * Uji validasi rubrik (editor Fase 5).
 *
 * Diorganisasi menurut **akibat di mesin**, bukan menurut nama fungsi: tiap
 * temuan wajib punya pasangan bukti bahwa tanpa validasi ini mesin memang
 * menghasilkan sesuatu yang salah tapi kelihatan wajar.
 */

function kode(temuan: Array<{ kode: KodeTemuanRubrik }>): KodeTemuanRubrik[] {
  return temuan.map((t) => t.kode)
}

function komponen(ubah: Partial<KomponenNode> = {}): KomponenNode {
  return {
    id: 1,
    sumbu: 'X_POTENSIAL',
    namaKomponen: 'Potensi & Kompetensi',
    bobot: 1,
    urutan: 1,
    indikator: [indikator()],
    ...ubah,
  }
}

function indikator(ubah: Partial<IndikatorNode> = {}): IndikatorNode {
  return {
    id: 10,
    namaIndikator: 'Tingkat Pendidikan Formal',
    bobot: 1,
    modeSkor: 'KATEGORI_TETAP',
    skalaMaks: null,
    urutan: 1,
    kategori: KATEGORI_PENDIDIKAN,
    anak: [],
    ...ubah,
  }
}

function kat(
  nama: string,
  nilaiSkor: number | null,
  urutan: number,
  ambangMin: number | null = null,
  ambangMax: number | null = null,
): KategoriSkor {
  return { namaKategori: nama, nilaiSkor, ambangMin, ambangMax, urutan }
}

describe('rubrik yang dipakai produksi harus lolos', () => {
  it('rubrik jabatan target (65/20/15) bersih', () => {
    const hasil = validasiRubrik(rubrikJabatanTarget(), { untukJabatanTarget: true })
    expect(hasil.temuan).toEqual([])
    expect(hasil.bisaDiaktifkan).toBe(true)
    expect(ringkasValidasi(hasil)).toBe('Rubrik lolos seluruh pemeriksaan.')
  })

  it('rubrik generik Formula A bersih — dua sumbu, masing-masing 100%', () => {
    const hasil = validasiRubrik(RUBRIK_GENERIK)
    expect(hasil.temuan).toEqual([])
  })

  it('rubrik generik TIDAK diperiksa terhadap tiga komponen Formula B', () => {
    // Rubrik generik memang tidak punya komponen Kualifikasi/Integritas.
    // Kalau pemeriksaan Formula B ikut jalan di sini, ia akan memerahi rubrik
    // yang benar — jadi bendera `untukJabatanTarget` bukan kenyamanan.
    const denganPeriksa = validasiRubrik(RUBRIK_GENERIK, { untukJabatanTarget: true })
    expect(kode(denganPeriksa.temuan)).toContain('KOMPONEN_FORMULA_B_HILANG')
    expect(validasiRubrik(RUBRIK_GENERIK).temuan).toEqual([])
  })
})

describe('bobot komponen per sumbu = 100%', () => {
  it('total 80% ditolak, dan sarannya menyebut kekurangannya', () => {
    const hasil = validasiRubrik([
      komponen({ id: 1, bobot: 0.65 }),
      komponen({ id: 2, namaKomponen: 'Kualifikasi Jabatan', bobot: 0.15, indikator: [indikator({ bobot: 0.15 })] }),
    ])
    const t = hasil.temuan.find((x) => x.kode === 'BOBOT_KOMPONEN_BUKAN_100')
    expect(t?.tingkat).toBe('GALAT')
    expect(t?.pesan).toContain('80%')
    expect(t?.saran).toContain('20%')
  })

  it('total 120% ditolak dengan saran mengurangi', () => {
    const hasil = validasiRubrik([
      komponen({ id: 1, bobot: 0.7 }),
      komponen({ id: 2, namaKomponen: 'Integritas & Moralitas', bobot: 0.5, indikator: [indikator({ bobot: 0.5 })] }),
    ])
    expect(hasil.temuan.find((x) => x.kode === 'BOBOT_KOMPONEN_BUKAN_100')?.saran).toContain('20%')
  })

  it('tiga komponen 33,33% diterima — itu pembagian rata terdekat yang bisa disimpan', () => {
    // Bobot disimpan DECIMAL(5,4), jadi "bagi tiga rata" hanya bisa ditulis
    // 0,3333 dan totalnya 99,99%. Tanpa toleransi, pembagian rata yang sah
    // akan selalu tampil merah dan pengguna tidak punya cara membetulkannya.
    const hasil = validasiRubrik(
      [0.3333, 0.3333, 0.3333].map((bobot, i) =>
        komponen({ id: i + 1, bobot, indikator: [indikator({ id: 10 + i, bobot })] }),
      ),
    )
    expect(kode(hasil.temuan)).not.toContain('BOBOT_KOMPONEN_BUKAN_100')

    // Tapi selisih yang benar-benar salah tulis tetap tertangkap.
    const salah = validasiRubrik([
      komponen({ id: 1, bobot: 0.33, indikator: [indikator({ bobot: 0.33 })] }),
      komponen({ id: 2, bobot: 0.33, indikator: [indikator({ id: 11, bobot: 0.33 })] }),
      komponen({ id: 3, bobot: 0.33, indikator: [indikator({ id: 12, bobot: 0.33 })] }),
    ])
    expect(kode(salah.temuan)).toContain('BOBOT_KOMPONEN_BUKAN_100')
  })

  it('dihitung PER SUMBU, bukan atas seluruh komponen', () => {
    // Y=1,0 dan X=1,0 → total keseluruhan 2,0. Kalau diperiksa sebagai satu
    // himpunan, rubrik dua sumbu yang benar akan selalu gagal.
    const hasil = validasiRubrik([
      komponen({ id: 1, sumbu: 'Y_KINERJA', namaKomponen: 'Kinerja Utama', bobot: 1 }),
      komponen({ id: 2, sumbu: 'X_POTENSIAL', bobot: 1 }),
    ])
    expect(kode(hasil.temuan)).not.toContain('BOBOT_KOMPONEN_BUKAN_100')
  })
})

describe('bobot indikator top-level = bobot komponennya (PRD §6.5)', () => {
  it('4 indikator @5% pada komponen 20% lolos', () => {
    const hasil = validasiRubrik(rubrikJabatanTarget(), { untukJabatanTarget: true })
    expect(kode(hasil.temuan)).not.toContain('BOBOT_INDIKATOR_TIDAK_SAMA_KOMPONEN')
  })

  it('4 indikator @5% pada komponen 25% ditolak, saran menyebut pembagian rata', () => {
    const kualifikasi = rubrikJabatanTarget().find((k) => k.namaKomponen === 'Kualifikasi Jabatan')!
    const hasil = validasiRubrik([{ ...kualifikasi, bobot: 1 }])
    const t = hasil.temuan.find((x) => x.kode === 'BOBOT_INDIKATOR_TIDAK_SAMA_KOMPONEN')
    expect(t?.tingkat).toBe('GALAT')
    expect(t?.pesan).toContain('20%')
    expect(t?.pesan).toContain('100%')
    expect(t?.saran).toContain('25%')
  })

  it('sub-indikator TIDAK ikut dijumlah — bobotnya NULL by design', () => {
    // Kualifikasi Jabatan 20% berisi 4 indikator @5%, salah satunya punya 3
    // sub-indikator tanpa bobot. Kalau sub-indikator ikut dihitung, totalnya
    // tetap 20% tapi jumlah anggotanya salah; kalau sub-indikator dianggap
    // "tanpa bobot di antara yang berbobot", akan muncul BOBOT_ANAK_CAMPUR palsu.
    const hasil = validasiRubrik(rubrikJabatanTarget(), { untukJabatanTarget: true })
    expect(kode(hasil.temuan)).not.toContain('BOBOT_ANAK_CAMPUR')
  })

  it('sub-indikator setengah berbobot ditolak — mesin memberi bobot 0 ke yang null', () => {
    const target = rubrikJabatanTarget()
    const kualifikasi = target.find((k) => k.namaKomponen === 'Kualifikasi Jabatan')!
    const pengalaman = kualifikasi.indikator.find((i) => i.anak.length > 0)!
    const rusak: KomponenNode = {
      ...kualifikasi,
      indikator: kualifikasi.indikator.map((i) =>
        i === pengalaman
          ? { ...i, anak: i.anak.map((a, idx) => (idx === 0 ? { ...a, bobot: 0.5 } : a)) }
          : i,
      ),
    }
    const hasil = validasiRubrik([{ ...rusak, bobot: 0.2 }])
    const t = hasil.temuan.find((x) => x.kode === 'BOBOT_ANAK_CAMPUR')
    expect(t?.tingkat).toBe('GALAT')
    expect(t?.nama).toBe('Nilai Pengalaman Jabatan')
  })
})

describe('komponen & indikator kosong', () => {
  it('rubrik tanpa komponen ditolak', () => {
    const hasil = validasiRubrik([])
    expect(kode(hasil.temuan)).toEqual(['RUBRIK_KOSONG'])
    expect(hasil.bisaDiaktifkan).toBe(false)
  })

  it('komponen tanpa indikator ditolak — mesin memberinya skor 0', () => {
    const kosong = komponen({ indikator: [] })
    expect(kode(validasiRubrik([kosong]).temuan)).toContain('KOMPONEN_TANPA_INDIKATOR')

    // Bukti akibatnya di mesin: skor 0, bukan galat.
    expect(hitungSumbu([kosong], 'X_POTENSIAL', {}).skor).toBe(0)
  })

  it('indikator KATEGORI_TETAP tanpa kategori ditolak; NILAI_LANGSUNG hanya diperingatkan', () => {
    const tetap = validasiRubrik([komponen({ indikator: [indikator({ kategori: [] })] })])
    expect(tetap.temuan.find((t) => t.kode === 'INDIKATOR_TANPA_KATEGORI')?.tingkat).toBe('GALAT')

    const langsung = validasiRubrik([
      komponen({ indikator: [indikator({ kategori: [], modeSkor: 'NILAI_LANGSUNG' })] }),
    ])
    expect(langsung.temuan.find((t) => t.kode === 'INDIKATOR_TANPA_KATEGORI')?.tingkat).toBe(
      'PERINGATAN',
    )
    expect(langsung.bisaDiaktifkan).toBe(true)
  })

  it('node agregator yang juga punya kategori sendiri diperingatkan', () => {
    const agregator = indikator({
      id: 7,
      namaIndikator: 'Nilai Pengalaman Jabatan',
      kategori: KATEGORI_PENDIDIKAN,
      anak: [indikator({ id: 8, bobot: null }), indikator({ id: 9, bobot: null })],
    })
    const hasil = validasiRubrik([komponen({ indikator: [agregator] })])
    const t = hasil.temuan.find((x) => x.kode === 'AGREGATOR_BERKATEGORI')
    expect(t?.tingkat).toBe('PERINGATAN')
    expect(t?.pesan).toContain('diabaikan')
  })
})

describe('nilai skor kategori', () => {
  it('KATEGORI_TETAP tanpa nilai skor ditolak', () => {
    const hasil = validasiRubrik([
      komponen({ indikator: [indikator({ kategori: [kat('Doktor', null, 1), kat('Magister', 90, 2)] })] }),
    ])
    const t = hasil.temuan.find((x) => x.kode === 'KATEGORI_TANPA_NILAI_SKOR')
    expect(t?.tingkat).toBe('GALAT')
    expect(t?.pesan).toContain('Doktor')
  })

  it('NILAI_LANGSUNG tanpa nilai skor TIDAK ditolak — kategorinya cuma label', () => {
    // Ini persis bentuk indikator Potkom di pupr_dev: tiga kategori berambang
    // dengan `nilai_skor` NULL, karena skornya = nilai mentah.
    const hasil = validasiRubrik(rubrikJabatanTarget(), { untukJabatanTarget: true })
    expect(kode(hasil.temuan)).not.toContain('KATEGORI_TANPA_NILAI_SKOR')
  })

  it('nilai skor di luar 0–100 ditolak', () => {
    const hasil = validasiRubrik([
      komponen({ indikator: [indikator({ kategori: [kat('Istimewa', 120, 1), kat('Biasa', 80, 2)] })] }),
    ])
    expect(hasil.temuan.find((x) => x.kode === 'NILAI_SKOR_DI_LUAR_RENTANG')?.pesan).toContain('120')
  })

  it('nama kategori ganda diperingatkan — pencocokan teks selalu ambil yang pertama', () => {
    const hasil = validasiRubrik([
      komponen({
        indikator: [indikator({ kategori: [kat('Baik', 80, 1), kat('  baik ', 60, 2)] })],
      }),
    ])
    expect(hasil.temuan.find((x) => x.kode === 'KATEGORI_NAMA_GANDA')?.tingkat).toBe('PERINGATAN')
  })
})

describe('kontinuitas ambang (phase.md §2.8b)', () => {
  it('Lama Jabatan versi doc apa adanya berlubang di dua tempat', () => {
    const hasil = validasiRubrik([
      komponen({ indikator: [indikator({ kategori: KATEGORI_LAMA_JABATAN_BERLUBANG })] }),
    ])
    const lubang = hasil.temuan.filter((t) => t.kode === 'AMBANG_BERLUBANG')
    expect(lubang).toHaveLength(2)
    expect(lubang.map((l) => l.pesan).join(' ')).toContain('4')
    expect(lubang.map((l) => l.pesan).join(' ')).toContain('5')
    expect(hasil.bisaDiaktifkan).toBe(false)
  })

  it('versi yang sudah dirapikan (§2.8a) lolos', () => {
    const hasil = validasiRubrik(rubrikJabatanTarget({ lamaJabatanKontinu: true }), {
      untukJabatanTarget: true,
    })
    expect(kode(hasil.temuan)).not.toContain('AMBANG_BERLUBANG')
  })

  it('lubang yang ditemukan validasi = nilai yang di mesin jatuh ke fallback', () => {
    // Bukti bahwa temuannya bukan formalitas: 4,1 tahun berada tepat di lubang
    // (4,5) dan mesin menandainya perluReview sambil memakai kategori di bawahnya.
    const berlubang = komponen({
      indikator: [indikator({ id: 8, kategori: KATEGORI_LAMA_JABATAN_BERLUBANG })],
    })
    expect(kode(validasiRubrik([berlubang]).temuan)).toContain('AMBANG_BERLUBANG')

    const hasil = hitungSumbu([berlubang], 'X_POTENSIAL', { 8: 4.1 })
    expect(hasil.perluReview).toBe(true)
    expect(hasil.catatanReview.some((c) => c.alasan === 'DI_LUAR_AMBANG')).toBe(true)
  })

  it('batas bawah yang tidak menutup ditolak', () => {
    const hasil = validasiRubrik([
      komponen({
        indikator: [
          indikator({
            kategori: [kat('Tinggi', 100, 1, 80, null), kat('Menengah', 80, 2, 60, 80)],
          }),
        ],
      }),
    ])
    const t = hasil.temuan.find((x) => x.kode === 'AMBANG_BAWAH_TIDAK_MENUTUP')
    expect(t?.tingkat).toBe('GALAT')
    expect(t?.pesan).toContain('60')
  })

  it('batas atas yang berhenti sebelum 100 ditolak', () => {
    const hasil = validasiRubrik([
      komponen({
        indikator: [
          indikator({
            kategori: [kat('Tinggi', 100, 1, 80, 90), kat('Rendah', 60, 2, null, 80)],
          }),
        ],
      }),
    ])
    expect(hasil.temuan.find((x) => x.kode === 'AMBANG_ATAS_TIDAK_MENUTUP')?.pesan).toContain('90')
  })

  it('ambang atas yang lebih rendah dari ambang bawah ditolak', () => {
    const hasil = validasiRubrik([
      komponen({
        indikator: [
          indikator({ kategori: [kat('Aneh', 100, 1, 80, 40), kat('Sisa', 60, 2, null, 80)] }),
        ],
      }),
    ])
    expect(hasil.temuan.find((x) => x.kode === 'AMBANG_TERBALIK')?.tingkat).toBe('GALAT')
  })

  it('tumpang-tindih hanya diperingatkan — mesin memutuskannya dengan band tertinggi', () => {
    const rubrik = komponen({
      indikator: [
        indikator({
          id: 8,
          modeSkor: 'KATEGORI_TETAP',
          kategori: [kat('Tinggi', 100, 1, 70, null), kat('Rendah', 60, 2, null, 90)],
        }),
      ],
    })
    const hasil = validasiRubrik([rubrik])
    expect(hasil.temuan.find((x) => x.kode === 'AMBANG_TUMPANG_TINDIH')?.tingkat).toBe('PERINGATAN')
    expect(hasil.bisaDiaktifkan).toBe(true)

    // Nilai 80 masuk dua band; mesin memilih yang tertinggi tanpa menandai review.
    const dihitung = hitungSumbu([rubrik], 'X_POTENSIAL', { 8: 80 })
    expect(dihitung.skor).toBe(100)
    expect(dihitung.perluReview).toBe(false)
  })

  it('batas yang bersentuhan (max = min berikutnya) bukan tumpang-tindih', () => {
    // Konvensi doc: "≥60–<80" disimpan sebagai ambang_max = 80. Kalau sentuhan
    // dianggap tumpang-tindih, setiap rubrik di sistem ini akan tampil kuning.
    const hasil = validasiRubrik([
      komponen({
        indikator: [
          indikator({
            kategori: [
              kat('Tinggi', 100, 1, 80, null),
              kat('Menengah', 80, 2, 60, 80),
              kat('Rendah', 60, 3, null, 60),
            ],
          }),
        ],
      }),
    ])
    expect(hasil.temuan).toEqual([])
  })

  it('kategori berlabel teks tanpa ambang tidak diperiksa kontinuitasnya', () => {
    const hasil = validasiRubrik([
      komponen({ indikator: [indikator({ kategori: KATEGORI_INTEGRITAS })] }),
    ])
    expect(hasil.temuan).toEqual([])
  })

  it('campuran berambang & tanpa ambang diperingatkan', () => {
    const hasil = validasiRubrik([
      komponen({
        indikator: [
          indikator({
            kategori: [
              kat('Tinggi', 100, 1, 80, null),
              kat('Rendah', 60, 2, null, 80),
              kat('Tidak terdata', 0, 3),
            ],
          }),
        ],
      }),
    ])
    expect(hasil.temuan.find((x) => x.kode === 'AMBANG_CAMPUR')?.tingkat).toBe('PERINGATAN')
  })
})

describe('ringkasan', () => {
  it('menyebut jumlah galat & peringatan', () => {
    const hasil = validasiRubrik([komponen({ bobot: 0.5, indikator: [] })])
    expect(hasil.jumlahGalat).toBeGreaterThan(0)
    expect(ringkasValidasi(hasil)).toContain('galat')
  })
})
