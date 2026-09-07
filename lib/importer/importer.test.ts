import { PARAMETER_SKORING_BAWAAN } from '../scoring'
import { describe, expect, it } from 'vitest'

import {
  DEFINISI_TEMUAN,
  normalisasiAsesmen,
  normalisasiGolonganBerjejak,
  normalisasiJenisAsesmenBerjejak,
  normalisasiNilaiIntegritas,
  normalisasiPegawai,
  normalisasiPendidikan,
  normalisasiSkor,
  normalisasiTanggal,
  perluManusia,
  periksaNip,
  periksaRiwayatJabatan,
  periksaUnitKerja,
  type KodeTemuan,
} from './index'

/**
 * Uji importer diorganisasi menurut **nomor aturan di phase.md §6**, bukan
 * menurut nama fungsi. Alasannya: yang harus dijamin adalah "setiap bentuk yang
 * pernah muncul di data contoh punya perlakuan tertulis" — dan itu daftar di
 * dokumen, bukan daftar di kode.
 */

const kode = (t: { kode: KodeTemuan }[]) => t.map((x) => x.kode)

describe('§6 · setiap aturan punya definisi & nomor yang tertelusur', () => {
  it('nomor aturan tidak ada yang bentrok atau bolong', () => {
    // `aturan: null` = temuan dari sumber di luar §6 (mis. API eNominasi lewat
    // `lib/enom`). Disaring, BUKAN dipaksa punya nomor: memberinya nomor palsu
    // membuat uji kelengkapan ini mengonfirmasi dokumen yang tidak menyebutnya.
    const nomor = Object.values(DEFINISI_TEMUAN)
      .map((d) => d.aturan)
      .filter((n): n is number => n !== null)
    expect(new Set(nomor).size).toBe(nomor.length)
    // §6 no. 8 (kolom arsip kosong) ditangani UI adaptif di Fase 2, bukan importer.
    expect(nomor.sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12])
  })

  it('setiap definisi menjelaskan dampaknya, bukan cuma menamainya', () => {
    for (const d of Object.values(DEFINISI_TEMUAN)) {
      expect(d.dampak.length, `${d.kode} tanpa penjelasan dampak`).toBeGreaterThan(40)
    }
  })
})

describe('§6.1 · skor di luar 0–100 dipotong, bukan dibuang', () => {
  it('115,10 → 100 dan dicatat', () => {
    const h = normalisasiSkor(115.1, 'potkom')
    expect(h.nilai).toBe(100)
    expect(kode(h.temuan)).toEqual(['SKOR_DI_LUAR_RENTANG'])
    expect(h.temuan[0]!.nilaiMentah).toBe('115.1')
  })

  it('nilai negatif → 0', () => {
    expect(normalisasiSkor(-5, 'potkom').nilai).toBe(0)
  })

  it('nilai dalam rentang tidak menghasilkan temuan', () => {
    expect(normalisasiSkor(87.5, 'potkom').temuan).toHaveLength(0)
  })

  it('null tetap null — kosong bukan pelanggaran', () => {
    const h = normalisasiSkor(null, 'potkom')
    expect(h.nilai).toBeNull()
    expect(h.temuan).toHaveLength(0)
  })
})

describe('§6.3 · integritas skala kecil dinaikkan ke 0–100', () => {
  it.each([
    [1, 25],
    [2, 50],
    [3, 75],
    [4, 100],
  ])('nilai %i → %i', (mentah, harap) => {
    const h = normalisasiNilaiIntegritas(mentah)
    expect(h.nilai).toBe(harap)
    expect(kode(h.temuan)).toEqual(['INTEGRITAS_SKALA_KECIL'])
  })

  it('3,5 dibulatkan ke tingkat rubrik terdekat (4 → 100)', () => {
    // Rubriknya diskret; nilai antara tidak punya makna di rubrik itu.
    expect(normalisasiNilaiIntegritas(3.5).nilai).toBe(100)
  })

  it('nilai di atas ambang skala kecil dibiarkan pada skala besar', () => {
    const h = normalisasiNilaiIntegritas(75)
    expect(h.nilai).toBe(75)
    expect(h.temuan).toHaveLength(0)
  })

  it('100 tidak salah dibaca sebagai skala kecil', () => {
    expect(normalisasiNilaiIntegritas(100).nilai).toBe(100)
  })

  it('nilai di luar rentang tetap dipotong', () => {
    const h = normalisasiNilaiIntegritas(140)
    expect(h.nilai).toBe(100)
    expect(kode(h.temuan)).toEqual(['SKOR_DI_LUAR_RENTANG'])
  })
})

describe('§6.4 · format golongan diseragamkan', () => {
  it('"IV.b" → "IV/b" dan dicatat', () => {
    const h = normalisasiGolonganBerjejak('IV.b')
    expect(h.nilai).toBe('IV/b')
    expect(kode(h.temuan)).toEqual(['FORMAT_GOLONGAN'])
  })

  it('yang sudah benar tidak menghasilkan temuan', () => {
    const h = normalisasiGolonganBerjejak('III/d')
    expect(h.nilai).toBe('III/d')
    expect(h.temuan).toHaveLength(0)
  })
})

describe('§6.5 · istilah jenis asesmen', () => {
  it('"JPT Pertama" → "JPT Pratama" dan dicatat', () => {
    const h = normalisasiJenisAsesmenBerjejak('JPT Pertama')
    expect(h.nilai).toBe('JPT Pratama')
    expect(kode(h.temuan)).toEqual(['ISTILAH_ASESMEN_LAMA'])
  })

  it('"PENGAWAS" → "Pengawas"', () => {
    expect(normalisasiJenisAsesmenBerjejak('PENGAWAS').nilai).toBe('Pengawas')
  })
})

describe('§6.6 · tanggal gagal urai TIDAK diisi tebakan', () => {
  it('"01 April 2024/ Pembina Tk.I" terurai', () => {
    const h = normalisasiTanggal('01 April 2024/ Pembina Tk.I', 'tmt_golongan')
    expect(h.nilai?.getFullYear()).toBe(2024)
    expect(h.nilai?.getMonth()).toBe(3)
    expect(h.temuan).toHaveLength(0)
  })

  it('"1-Apr-23" terurai ke 2023', () => {
    expect(normalisasiTanggal('1-Apr-23', 'tmt_jabatan').nilai?.getFullYear()).toBe(2023)
  })

  it('teks tak dikenal → null + temuan, bukan tanggal palsu', () => {
    const h = normalisasiTanggal('menunggu SK', 'tmt_jabatan')
    expect(h.nilai).toBeNull()
    expect(kode(h.temuan)).toEqual(['TANGGAL_TIDAK_TERURAI'])
  })

  it('kosong bukan pelanggaran', () => {
    expect(normalisasiTanggal(null, 'tmt_jabatan').temuan).toHaveLength(0)
    expect(normalisasiTanggal('   ', 'tmt_jabatan').temuan).toHaveLength(0)
  })
})

describe('§6.7 · riwayat jabatan belum terstruktur', () => {
  const dasar = {
    urutan: 1,
    jabatanNamaMentah: 'Kepala Seksi Pengadaan',
    jabatanId: 10,
    tanggalMulai: '2020-01-01',
    tanggalAkhir: null,
    noSk: 'SK-1/2020',
  }

  it('lengkap → tanpa temuan', () => {
    expect(periksaRiwayatJabatan(dasar)).toHaveLength(0)
  })

  it('tanpa tanggal mulai → menyebut dampaknya ke Lama Jabatan', () => {
    const t = periksaRiwayatJabatan({ ...dasar, tanggalMulai: null })
    expect(kode(t)).toEqual(['RIWAYAT_BELUM_TERSTRUKTUR'])
    expect(t[0]!.keterangan).toContain('Lama Jabatan')
  })

  it('tanpa tautan jabatan master → menyebut Keragaman & Substansi', () => {
    const t = periksaRiwayatJabatan({ ...dasar, jabatanId: null })
    expect(t[0]!.keterangan).toMatch(/Keragaman/)
  })

  it('beberapa kekurangan digabung jadi satu temuan, bukan tiga', () => {
    const t = periksaRiwayatJabatan({ ...dasar, jabatanId: null, tanggalMulai: null, noSk: null })
    expect(t).toHaveLength(1)
    expect(t[0]!.keterangan).toContain('belum tertaut jabatan master')
    expect(t[0]!.keterangan).toContain('tanpa nomor SK')
  })
})

describe('§6.9 · Unit Kerja berisi teks jabatan — dideteksi, TIDAK dibetulkan', () => {
  it('mendeteksi kasus "Kepala Balai ..."', () => {
    const t = periksaUnitKerja('Kepala Balai Pelaksana Pemilihan Jasa Konstruksi')
    expect(kode(t)).toEqual(['UNIT_BERISI_TEKS_JABATAN'])
    expect(t[0]!.nilaiDipakai).toBeNull()
  })

  it('unit yang wajar tidak ditandai', () => {
    expect(periksaUnitKerja('Direktorat Pengadaan Jasa Konstruksi')).toHaveLength(0)
  })

  it('temuannya menuntut manusia, bukan koreksi otomatis', () => {
    const t = periksaUnitKerja('Kepala Seksi Pengadaan')
    expect(perluManusia(t)).toHaveLength(1)
  })
})

describe('§6.10 · riwayat pendidikan satu teks', () => {
  it('"S2 SISTEM DAN TEKNIK TRANSPORTASI" terurai penuh', () => {
    const h = normalisasiPendidikan('S2 SISTEM DAN TEKNIK TRANSPORTASI')
    expect(h.nilai.jenjang).toBe('S2')
    expect(h.nilai.bidangStudi).toBe('Sistem dan Teknik Transportasi')
    expect(h.temuan).toHaveLength(0)
  })

  it('teks tanpa jenjang ditandai', () => {
    const h = normalisasiPendidikan('Manajemen Konstruksi')
    expect(h.nilai.jenjang).toBeNull()
    expect(kode(h.temuan)).toEqual(['PENDIDIKAN_TIDAK_TERURAI'])
  })

  it('jenjang ada tapi bidang kosong tetap ditandai', () => {
    const h = normalisasiPendidikan('S1')
    expect(h.nilai.jenjang).toBe('S1_D4')
    expect(h.temuan[0]!.keterangan).toContain('bidang studinya kosong')
  })

  it('kosong bukan pelanggaran', () => {
    expect(normalisasiPendidikan(null).temuan).toHaveLength(0)
  })
})

describe('§6.11 · NIP tidak valid', () => {
  it('NIP dev yang benar lolos', () => {
    expect(periksaNip('199308232017122011')).toHaveLength(0)
  })

  it('panjang salah ditolak dengan alasan', () => {
    const t = periksaNip('1993082320171220')
    expect(kode(t)).toEqual(['NIP_TIDAK_VALID'])
    expect(t[0]!.keterangan.length).toBeGreaterThan(5)
  })

  it('digit jenis kelamin di luar {1,2} ditolak', () => {
    expect(periksaNip('199308232017123011')).toHaveLength(1)
  })

  it('kosong ditolak — NIP adalah kunci identitas', () => {
    expect(periksaNip(null)).toHaveLength(1)
  })
})

describe('§6.2 & §6.12 · baris asesmen utuh', () => {
  const dasar = {
    tahunAsesmen: 2025,
    jenisAsesmen: 'Pengawas',
    statusAsesmen: 'Berlaku',
    nilaiKinerjaY: 80,
    potkom: 90,
    nilaiIntegritas: 100,
    kotak9Sumber: 9,
  }

  it('kotak_9 dihitung ulang; sumber yang cocok tidak menimbulkan temuan', () => {
    const h = normalisasiAsesmen(dasar, { tahunSekarang: 2026, ...PARAMETER_SKORING_BAWAAN })
    expect(h.nilai.kotak9).toBe(9)
    expect(h.temuan).toHaveLength(0)
  })

  it('kotak_9 sumber yang beda ditandai, dan hasil hitung yang dipakai', () => {
    const h = normalisasiAsesmen({ ...dasar, kotak9Sumber: 4 }, { tahunSekarang: 2026, ...PARAMETER_SKORING_BAWAAN })
    expect(h.nilai.kotak9).toBe(9)
    expect(kode(h.temuan)).toEqual(['KOTAK9_BEDA_DENGAN_HITUNGAN'])
    expect(perluManusia(h.temuan)).toHaveLength(1)
  })

  it('kasus nyata Tasya/Tina: Y=100 X=69,58 → hitung 7, sumber bilang 4', () => {
    const h = normalisasiAsesmen(
      { ...dasar, nilaiKinerjaY: 100, potkom: 69.58, kotak9Sumber: 4 },
      { tahunSekarang: 2026, ...PARAMETER_SKORING_BAWAAN },
    )
    expect(h.nilai.kotak9).toBe(7)
    expect(kode(h.temuan)).toContain('KOTAK9_BEDA_DENGAN_HITUNGAN')
  })

  it('asesmen tua berstatus "Berlaku" dikoreksi jadi Expired', () => {
    const h = normalisasiAsesmen(
      { ...dasar, tahunAsesmen: 2021, statusAsesmen: 'Berlaku', kotak9Sumber: 9 },
      { tahunSekarang: 2026, ...PARAMETER_SKORING_BAWAAN },
    )
    expect(h.nilai.statusAsesmen).toBe('Expired')
    expect(kode(h.temuan)).toContain('STATUS_ASESMEN_TIDAK_KONSISTEN')
  })

  it('asesmen baru berstatus "Expired" juga dikoreksi (arah sebaliknya)', () => {
    const h = normalisasiAsesmen(
      { ...dasar, tahunAsesmen: 2026, statusAsesmen: 'Expired' },
      { tahunSekarang: 2026, ...PARAMETER_SKORING_BAWAAN },
    )
    expect(h.nilai.statusAsesmen).toBe('Berlaku')
    expect(kode(h.temuan)).toContain('STATUS_ASESMEN_TIDAK_KONSISTEN')
  })

  it('status "Draft" dipertahankan & bukan ketidakkonsistenan', () => {
    const h = normalisasiAsesmen({ ...dasar, statusAsesmen: 'Draft' }, { tahunSekarang: 2026, ...PARAMETER_SKORING_BAWAAN })
    expect(h.nilai.statusAsesmen).toBe('Draft')
    expect(kode(h.temuan)).not.toContain('STATUS_ASESMEN_TIDAK_KONSISTEN')
  })

  it('potkom >100 disimpan apa adanya; integritas skala kecil tetap dinaikkan', () => {
    // Potkom TIDAK lagi dipotong (keputusan pemilik proses 18 Agu 2026), tapi
    // penskalaan integritas 1–4 → 0–100 tetap berlaku: keduanya keputusan
    // terpisah, dan yang dibatalkan hanya pemotongan potkom.
    const h = normalisasiAsesmen(
      { ...dasar, potkom: 115.1, nilaiIntegritas: 3, kotak9Sumber: null },
      { tahunSekarang: 2026, ...PARAMETER_SKORING_BAWAAN },
    )
    expect(h.nilai.potkom).toBe(115.1)
    expect(h.nilai.nilaiPotensialX).toBe(115.1)
    expect(h.nilai.nilaiIntegritas).toBe(75)
    expect(kode(h.temuan).sort()).toEqual(['INTEGRITAS_SKALA_KECIL', 'POTKOM_DI_ATAS_100'])
  })

  it('nilai_talenta TETAP diplafon 100 walau potkom melebihinya', () => {
    // Yang dibatalkan hanya pemotongan potkom. `nilai_talenta` komposit berskala
    // 0–100, jadi 50%·100 + 50%·115,1 = 107,55 tetap diplafon — kalau tidak,
    // "nilai talenta" berhenti punya skala yang bisa dibandingkan antar pegawai.
    const h = normalisasiAsesmen(
      { ...dasar, nilaiKinerjaY: 100, potkom: 115.1, kotak9Sumber: null },
      { tahunSekarang: 2026, ...PARAMETER_SKORING_BAWAAN },
    )
    expect(h.nilai.nilaiTalenta).toBe(100)
    expect(h.nilai.kotak9).toBe(9)
  })

  it('nilai potensial diturunkan dari potkom, tidak dari kolom sumber', () => {
    const h = normalisasiAsesmen({ ...dasar, potkom: 77 }, { tahunSekarang: 2026, ...PARAMETER_SKORING_BAWAAN })
    expect(h.nilai.nilaiPotensialX).toBe(77)
    expect(h.nilai.nilaiTalenta).toBe(78.5) // 50% x 80 + 50% x 77
  })

  it('kotak_9 sumber kosong bukan pelanggaran', () => {
    const h = normalisasiAsesmen({ ...dasar, kotak9Sumber: null }, { tahunSekarang: 2026, ...PARAMETER_SKORING_BAWAAN })
    expect(h.temuan).toHaveLength(0)
  })
})

describe('baris pegawai utuh', () => {
  it('baris bersih tidak menghasilkan temuan apa pun', () => {
    const h = normalisasiPegawai(
      {
        nip: '199308232017122011',
        namaLengkap: 'Yuni Astuti',
        golongan: 'III/a',
        pangkat: 'Penata Muda',
        tmtGolongan: '2021-04-01',
        tmtJabatan: '2021-04-01',
        unitKerjaMentah: 'Bagian Kepegawaian dan Umum',
        pendidikanMentah: 'S1 MANAJEMEN',
      },
      new Date(2026, 6, 31),
    )
    expect(h.temuan).toHaveLength(0)
    expect(h.nilai.golongan).toBe('III/a')
    expect(h.nilai.tingkatPendidikan).toBe('S1_D4')
  })

  it('baris paling kotor: lima temuan sekaligus, barisnya tetap diterima', () => {
    const h = normalisasiPegawai(
      {
        nip: '123',
        namaLengkap: '  Irwan   Setiawan ',
        golongan: 'IV.b',
        pangkat: 'Pembina Tk. I',
        tmtGolongan: 'menunggu SK',
        tmtJabatan: null,
        unitKerjaMentah: 'Kepala Balai Jasa Konstruksi Wilayah VI',
        pendidikanMentah: 'Teknik Sipil',
      },
      new Date(2026, 6, 31),
    )

    expect(kode(h.temuan).sort()).toEqual([
      'FORMAT_GOLONGAN',
      'NIP_TIDAK_VALID',
      'PENDIDIKAN_TIDAK_TERURAI',
      'TANGGAL_TIDAK_TERURAI',
      'UNIT_BERISI_TEKS_JABATAN',
    ])
    // Barisnya tetap ada, dengan bagian yang bisa dikoreksi sudah dikoreksi.
    expect(h.nilai.namaLengkap).toBe('Irwan Setiawan')
    expect(h.nilai.golongan).toBe('IV/b')
    expect(h.nilai.tmtGolongan).toBeNull()
  })

  it('memisahkan yang perlu manusia dari yang sudah dikoreksi', () => {
    const h = normalisasiPegawai(
      {
        nip: '199308232017122011',
        namaLengkap: 'Contoh',
        golongan: 'IV.b',
        pangkat: 'Pembina',
        tmtGolongan: '2020-01-01',
        tmtJabatan: null,
        unitKerjaMentah: 'Kepala Seksi Pengadaan',
        pendidikanMentah: 'S2 TEKNIK SIPIL',
      },
      new Date(2026, 6, 31),
    )
    // Golongan sudah dikoreksi otomatis; unit berisi teks jabatan tidak.
    expect(kode(h.temuan).sort()).toEqual(['FORMAT_GOLONGAN', 'UNIT_BERISI_TEKS_JABATAN'])
    expect(kode(perluManusia(h.temuan))).toEqual(['UNIT_BERISI_TEKS_JABATAN'])
  })
})
