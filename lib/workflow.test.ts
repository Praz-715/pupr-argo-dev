import { describe, expect, it } from 'vitest'

import {
  aksiTersedia,
  aksiUntukKeadaan,
  giliranSiapa,
  periksaKonsistensi,
  terapkanAksi,
  timelineTahap,
  TAHAP_PIMPINAN,
  TAHAP_VERIFIKASI,
  type KeadaanWorkflow,
  type StatusApproval,
} from './workflow'

/**
 * Uji state machine workflow (Fase 6).
 *
 * Diorganisasi menurut **alur yang dilalui manusia**, bukan menurut nama fungsi:
 * yang perlu dijamin adalah bahwa satu perjalanan nominasi dari pengajuan sampai
 * penetapan tidak bisa melewati langkah, dan bahwa setiap keadaan di tengah jalan
 * tetap konsisten antara `talent_pool.status` dan `nominasi.status`.
 */

const kandidat: KeadaanWorkflow = { statusPool: 'KANDIDAT', statusNominasi: null }

function label(keadaan: KeadaanWorkflow): string[] {
  return aksiUntukKeadaan(keadaan).map((d) => d.aksi)
}

describe('perjalanan penuh: kandidat → ditetapkan', () => {
  it('setiap langkah memindahkan KEDUA status secara berpasangan', () => {
    // 1. Unit mengajukan
    const ajukan = terapkanAksi('AJUKAN', kandidat, 'Pengelola Unit')
    expect(ajukan.ok).toBe(true)
    if (!ajukan.ok) return
    expect(ajukan.statusPoolBaru).toBe('DINOMINASIKAN')
    expect(ajukan.statusNominasiBaru).toBe('MENUNGGU_VERIFIKASI')
    expect(ajukan.jejak).toEqual({ tahap: TAHAP_VERIFIKASI, status: 'MENUNGGU' })

    const setelahAjukan: KeadaanWorkflow = {
      statusPool: ajukan.statusPoolBaru,
      statusNominasi: ajukan.statusNominasiBaru,
    }
    expect(periksaKonsistensi(setelahAjukan)).toBeNull()

    // 2. Admin Talenta menyetujui verifikasi
    const verifikasi = terapkanAksi('VERIFIKASI_SETUJU', setelahAjukan, 'Admin Talenta')
    expect(verifikasi.ok).toBe(true)
    if (!verifikasi.ok) return
    expect(verifikasi.statusPoolBaru).toBe('DIVERIFIKASI')
    expect(verifikasi.statusNominasiBaru).toBe('DISETUJUI')

    const setelahVerifikasi: KeadaanWorkflow = {
      statusPool: verifikasi.statusPoolBaru,
      statusNominasi: verifikasi.statusNominasiBaru,
    }
    expect(periksaKonsistensi(setelahVerifikasi)).toBeNull()

    // 3. Pimpinan menetapkan
    const tetapkan = terapkanAksi('TETAPKAN', setelahVerifikasi, 'Pimpinan')
    expect(tetapkan.ok).toBe(true)
    if (!tetapkan.ok) return
    expect(tetapkan.statusPoolBaru).toBe('DITETAPKAN')
    expect(tetapkan.jejak).toEqual({ tahap: TAHAP_PIMPINAN, status: 'DISETUJUI' })
    expect(
      periksaKonsistensi({ statusPool: 'DITETAPKAN', statusNominasi: 'DISETUJUI' }),
    ).toBeNull()
  })

  it('langkah tidak bisa dilompati: menetapkan sebelum diverifikasi ditolak', () => {
    const hasil = terapkanAksi('TETAPKAN', kandidat, 'Pimpinan')
    expect(hasil.ok).toBe(false)
    if (hasil.ok) return
    expect(hasil.alasan).toContain('Kandidat')
    expect(hasil.alasan).toContain('tidak berlaku')
  })

  it('penolakan menyebut aksi yang SAH saat ini, bukan cuma "tidak valid"', () => {
    const hasil = terapkanAksi('VERIFIKASI_SETUJU', kandidat, 'Admin Talenta')
    expect(hasil.ok).toBe(false)
    if (hasil.ok) return
    // Dari keadaan KANDIDAT, yang mungkin adalah AJUKAN & TOLAK_KANDIDAT.
    expect(hasil.alasan).toContain('Ajukan nominasi')
    expect(hasil.alasan).toContain('muat ulang')
  })
})

describe('jalur revisi', () => {
  const menunggu: KeadaanWorkflow = {
    statusPool: 'DINOMINASIKAN',
    statusNominasi: 'MENUNGGU_VERIFIKASI',
  }

  it('minta revisi mengembalikan giliran ke unit TANPA menurunkan status pool', () => {
    const hasil = terapkanAksi('MINTA_REVISI', menunggu, 'Admin Talenta')
    expect(hasil.ok).toBe(true)
    if (!hasil.ok) return
    // Kandidatnya tetap dinominasikan — yang berubah cuma giliran bertindak.
    expect(hasil.statusPoolBaru).toBe('DINOMINASIKAN')
    expect(hasil.statusNominasiBaru).toBe('DIAJUKAN')
    expect(hasil.jejak).toEqual({ tahap: TAHAP_VERIFIKASI, status: 'REVISI' })
    expect(giliranSiapa({ statusPool: 'DINOMINASIKAN', statusNominasi: 'DIAJUKAN' })).toBe('UNIT')
  })

  it('unit bisa mengajukan ulang, dan itu kembali ke antrian verifikasi', () => {
    const revisi: KeadaanWorkflow = { statusPool: 'DINOMINASIKAN', statusNominasi: 'DIAJUKAN' }
    const hasil = terapkanAksi('AJUKAN_ULANG', revisi, 'Pengelola Unit')
    expect(hasil.ok).toBe(true)
    if (!hasil.ok) return
    expect(hasil.statusNominasiBaru).toBe('MENUNGGU_VERIFIKASI')
    expect(giliranSiapa(revisi)).toBe('UNIT')
  })

  it('AJUKAN (bukan AJUKAN_ULANG) ditolak saat sudah ada nominasi', () => {
    const revisi: KeadaanWorkflow = { statusPool: 'DINOMINASIKAN', statusNominasi: 'DIAJUKAN' }
    expect(terapkanAksi('AJUKAN', revisi, 'Pengelola Unit').ok).toBe(false)
  })
})

describe('wewenang per peran', () => {
  it('Pengelola Unit tidak bisa memverifikasi nominasinya sendiri', () => {
    const menunggu: KeadaanWorkflow = {
      statusPool: 'DINOMINASIKAN',
      statusNominasi: 'MENUNGGU_VERIFIKASI',
    }
    const hasil = terapkanAksi('VERIFIKASI_SETUJU', menunggu, 'Pengelola Unit')
    expect(hasil.ok).toBe(false)
    if (hasil.ok) return
    expect(hasil.alasan).toContain('Admin Talenta')
  })

  it('Admin Talenta tidak bisa menetapkan suksesor — itu wewenang Pimpinan', () => {
    const diverifikasi: KeadaanWorkflow = {
      statusPool: 'DIVERIFIKASI',
      statusNominasi: 'DISETUJUI',
    }
    const hasil = terapkanAksi('TETAPKAN', diverifikasi, 'Admin Talenta')
    expect(hasil.ok).toBe(false)
    if (hasil.ok) return
    expect(hasil.alasan).toContain('Pimpinan')
  })

  it('Viewer tidak punya aksi apa pun', () => {
    expect(aksiTersedia(kandidat, 'Viewer')).toEqual([])
    expect(
      aksiTersedia({ statusPool: 'DIVERIFIKASI', statusNominasi: 'DISETUJUI' }, 'Viewer'),
    ).toEqual([])
  })

  it('peran null (belum login) tidak punya aksi apa pun', () => {
    expect(aksiTersedia(kandidat, null)).toEqual([])
    expect(terapkanAksi('AJUKAN', kandidat, null).ok).toBe(false)
  })

  it('Super Admin bisa menjalankan semua aksi yang sah untuk keadaannya', () => {
    const semua = aksiUntukKeadaan(kandidat)
    const bolehSuperAdmin = aksiTersedia(kandidat, 'Super Admin')
    expect(bolehSuperAdmin).toHaveLength(semua.length)
  })
})

describe('aksi yang tersedia per keadaan', () => {
  it('KANDIDAT: ajukan atau keluarkan dari pool', () => {
    expect(label(kandidat).sort()).toEqual(['AJUKAN', 'TOLAK_KANDIDAT'])
  })

  it('menunggu verifikasi: setuju / revisi / tolak', () => {
    expect(
      label({ statusPool: 'DINOMINASIKAN', statusNominasi: 'MENUNGGU_VERIFIKASI' }).sort(),
    ).toEqual(['MINTA_REVISI', 'VERIFIKASI_SETUJU', 'VERIFIKASI_TOLAK'])
  })

  it('diverifikasi: tetapkan atau tolak di tahap pimpinan', () => {
    expect(label({ statusPool: 'DIVERIFIKASI', statusNominasi: 'DISETUJUI' }).sort()).toEqual([
      'TETAPKAN',
      'TOLAK_PIMPINAN',
    ])
  })

  it('ditetapkan: hanya bisa dibatalkan', () => {
    expect(label({ statusPool: 'DITETAPKAN', statusNominasi: 'DISETUJUI' })).toEqual([
      'BATALKAN_PENETAPAN',
    ])
  })

  it('ditolak: hanya bisa dipulihkan', () => {
    expect(label({ statusPool: 'DITOLAK', statusNominasi: 'DITOLAK' })).toEqual([
      'PULIHKAN_KANDIDAT',
    ])
  })

  it('setiap aksi destruktif menuntut catatan', () => {
    for (const d of Object.values(
      Object.fromEntries(aksiUntukKeadaan(kandidat).map((a) => [a.aksi, a])),
    )) {
      if (d.destruktif) expect(d.butuhCatatan).toBe(true)
    }
  })
})

describe('giliranSiapa — dasar Inbox Tugas (U-7)', () => {
  it('dibaca dari nominasi, tanpa perlu melihat approval_log', () => {
    expect(giliranSiapa({ statusPool: 'DINOMINASIKAN', statusNominasi: 'DIAJUKAN' })).toBe('UNIT')
    expect(
      giliranSiapa({ statusPool: 'DINOMINASIKAN', statusNominasi: 'MENUNGGU_VERIFIKASI' }),
    ).toBe('ADMIN_TALENTA')
    expect(giliranSiapa({ statusPool: 'DIVERIFIKASI', statusNominasi: 'DISETUJUI' })).toBe(
      'PIMPINAN',
    )
  })

  it('DISETUJUI bermakna dua hal berbeda tergantung status pool', () => {
    // Lolos verifikasi → menunggu Pimpinan.
    expect(giliranSiapa({ statusPool: 'DIVERIFIKASI', statusNominasi: 'DISETUJUI' })).toBe(
      'PIMPINAN',
    )
    // Sudah ditetapkan → tidak menunggu siapa pun.
    expect(giliranSiapa({ statusPool: 'DITETAPKAN', statusNominasi: 'DISETUJUI' })).toBe('SELESAI')
  })

  it('kandidat tanpa nominasi & yang ditolak tidak menunggu siapa pun', () => {
    expect(giliranSiapa(kandidat)).toBe('SELESAI')
    expect(giliranSiapa({ statusPool: 'DITOLAK', statusNominasi: 'DITOLAK' })).toBe('SELESAI')
  })
})

describe('periksaKonsistensi', () => {
  it('menangkap status pool yang tidak mungkin tanpa nominasi', () => {
    const pesan = periksaKonsistensi({ statusPool: 'DIVERIFIKASI', statusNominasi: null })
    expect(pesan).toContain('tidak ada nominasi')
  })

  it('menangkap nominasi ditolak tapi pool masih dinominasikan', () => {
    const pesan = periksaKonsistensi({ statusPool: 'DINOMINASIKAN', statusNominasi: 'DITOLAK' })
    expect(pesan).toContain('seharusnya')
    expect(pesan).toContain('Ditolak')
  })

  it('menangkap kasus nyata di data dev: nominasi ditolak tapi pool masih Kandidat diizinkan', () => {
    // KANDIDAT + nominasi DITOLAK sah: kandidat dipulihkan setelah penolakan,
    // dan riwayat nominasinya memang tetap tersimpan sebagai jejak.
    expect(periksaKonsistensi({ statusPool: 'KANDIDAT', statusNominasi: 'DITOLAK' })).toBeNull()
  })

  it('menangkap nominasi menunggu verifikasi tapi pool masih Kandidat', () => {
    const pesan = periksaKonsistensi({
      statusPool: 'KANDIDAT',
      statusNominasi: 'MENUNGGU_VERIFIKASI',
    })
    expect(pesan).toContain('Dinominasikan')
  })

  it('seluruh keadaan yang dihasilkan mesin ini konsisten', () => {
    // Jelajahi semua transisi dari semua keadaan awal yang sah, lalu pastikan
    // TIDAK ADA yang menghasilkan pasangan status yang tidak konsisten.
    const awal: KeadaanWorkflow[] = [
      kandidat,
      { statusPool: 'DINOMINASIKAN', statusNominasi: 'MENUNGGU_VERIFIKASI' },
      { statusPool: 'DINOMINASIKAN', statusNominasi: 'DIAJUKAN' },
      { statusPool: 'DIVERIFIKASI', statusNominasi: 'DISETUJUI' },
      { statusPool: 'DITETAPKAN', statusNominasi: 'DISETUJUI' },
      { statusPool: 'DITOLAK', statusNominasi: 'DITOLAK' },
    ]

    for (const keadaan of awal) {
      for (const d of aksiUntukKeadaan(keadaan)) {
        const hasil = terapkanAksi(d.aksi, keadaan, 'Super Admin')
        expect(hasil.ok).toBe(true)
        if (!hasil.ok) continue
        const berikutnya: KeadaanWorkflow = {
          statusPool: hasil.statusPoolBaru,
          // null = kolom nominasi tidak disentuh, jadi nilainya tetap.
          statusNominasi:
            hasil.statusNominasiBaru === null ? keadaan.statusNominasi : hasil.statusNominasiBaru,
        }
        expect(periksaKonsistensi(berikutnya), `${d.aksi} dari ${keadaan.statusPool}`).toBeNull()
      }
    }
  })
})

describe('timelineTahap', () => {
  it('tahap yang belum dijalani tetap ditampilkan', () => {
    const t = timelineTahap([{ tahap: TAHAP_VERIFIKASI, status: 'DISETUJUI' }])
    expect(t).toHaveLength(2)
    expect(t[0]).toEqual({
      tahap: TAHAP_VERIFIKASI,
      status: 'DISETUJUI',
      keterangan: 'Disetujui',
    })
    expect(t[1]?.status).toBe('BELUM')
    expect(t[1]?.keterangan).toBe('Belum dijalani')
  })

  it('satu tahap yang dilalui dua kali menampilkan keputusan TERAKHIR', () => {
    const jejak: Array<{ tahap: string; status: StatusApproval }> = [
      { tahap: TAHAP_VERIFIKASI, status: 'REVISI' },
      { tahap: TAHAP_VERIFIKASI, status: 'MENUNGGU' },
      { tahap: TAHAP_VERIFIKASI, status: 'DISETUJUI' },
    ]
    expect(timelineTahap(jejak)[0]?.status).toBe('DISETUJUI')
  })

  it('tahap yang tidak dikenal diabaikan, tidak menjatuhkan timeline', () => {
    const t = timelineTahap([{ tahap: 'Tahap Karangan', status: 'DISETUJUI' }])
    expect(t.every((l) => l.status === 'BELUM')).toBe(true)
  })
})
