import { URUTAN_PENDIDIKAN, type TingkatPendidikan } from '../normalisasi'
import { asesmenLayakDipakai } from './asesmen'
import type { StatusAsesmen } from './types'

/**
 * Seleksi Kelayakan (Blueprint langkah 3) — cek `jabatan_target_persyaratan`
 * terhadap profil pegawai.
 *
 * KENYATAAN DATA: di data yang ada, hanya `PENDIDIKAN_MIN` punya
 * `nilai_minimal` terstruktur. `BIDANG_ILMU` & `PENGALAMAN_MIN` baru berisi
 * deskripsi untuk dibaca manusia. Jadi syarat tanpa `nilai_minimal` TIDAK
 * dianggap lolos maupun gagal — ditandai **perlu verifikasi manual**, supaya
 * tidak ada kandidat yang tersaring/lolos diam-diam oleh tebakan mesin
 * (phase.md §2, §9 no. 6).
 */

export type JenisSyarat = 'PENDIDIKAN_MIN' | 'BIDANG_ILMU' | 'PENGALAMAN_MIN' | 'LAINNYA'

export type Eselon = 'I' | 'II' | 'III' | 'IV' | 'NON_ESELON'

const URUTAN_ESELON: Record<Eselon, number> = {
  NON_ESELON: 0,
  IV: 1,
  III: 2,
  II: 3,
  I: 4,
}

export interface Persyaratan {
  id: number
  jenisSyarat: JenisSyarat
  deskripsi: string
  nilaiMinimal: string | null
}

export interface ProfilKelayakan {
  tingkatPendidikan: TingkatPendidikan | null
  /** Bidang studi dari seluruh riwayat pendidikan (sudah dinormalisasi). */
  bidangStudi: string[]
  /** Eselon tertinggi yang pernah dijabat (dari riwayat jabatan terpetakan). */
  eselonTertinggi: Eselon | null
  /** Total tahun pengalaman jabatan; null bila data riwayat belum bertanggal. */
  totalPengalamanTahun: number | null
  asesmen: { tahunAsesmen: number; statusAsesmen: StatusAsesmen | null } | null
}

export type StatusSyarat = 'TERPENUHI' | 'TIDAK_TERPENUHI' | 'PERLU_VERIFIKASI_MANUAL'

export interface RincianSyarat {
  persyaratanId: number
  jenisSyarat: JenisSyarat
  deskripsi: string
  status: StatusSyarat
  keterangan: string
}

export interface HasilKelayakan {
  /** false hanya kalau ada syarat yang benar-benar TIDAK terpenuhi. */
  eligible: boolean
  /** true bila masih ada syarat yang belum bisa diperiksa mesin. */
  perluVerifikasiManual: boolean
  rincian: RincianSyarat[]
  /** Ringkasan siap simpan ke `match_score.catatan_eligibility`. */
  catatan: string
}

function cekPendidikan(syarat: Persyaratan, profil: ProfilKelayakan): RincianSyarat {
  const dasar = {
    persyaratanId: syarat.id,
    jenisSyarat: syarat.jenisSyarat,
    deskripsi: syarat.deskripsi,
  }

  const minimal = (syarat.nilaiMinimal ?? '').trim() as TingkatPendidikan
  if (!minimal || !(minimal in URUTAN_PENDIDIKAN)) {
    return {
      ...dasar,
      status: 'PERLU_VERIFIKASI_MANUAL',
      keterangan: 'Syarat pendidikan minimal belum diisi terstruktur pada profil jabatan target',
    }
  }

  if (!profil.tingkatPendidikan) {
    return {
      ...dasar,
      status: 'PERLU_VERIFIKASI_MANUAL',
      keterangan: 'Tingkat pendidikan pegawai belum terdata',
    }
  }

  const punya = URUTAN_PENDIDIKAN[profil.tingkatPendidikan]
  const butuh = URUTAN_PENDIDIKAN[minimal]
  const terpenuhi = punya >= butuh

  return {
    ...dasar,
    status: terpenuhi ? 'TERPENUHI' : 'TIDAK_TERPENUHI',
    keterangan: terpenuhi
      ? `Pendidikan ${profil.tingkatPendidikan} memenuhi syarat minimal ${minimal}`
      : `Pendidikan ${profil.tingkatPendidikan} di bawah syarat minimal ${minimal}`,
  }
}

function cekBidangIlmu(syarat: Persyaratan, profil: ProfilKelayakan): RincianSyarat {
  const dasar = {
    persyaratanId: syarat.id,
    jenisSyarat: syarat.jenisSyarat,
    deskripsi: syarat.deskripsi,
  }

  const daftar = (syarat.nilaiMinimal ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== '')

  if (daftar.length === 0) {
    return {
      ...dasar,
      status: 'PERLU_VERIFIKASI_MANUAL',
      keterangan: 'Daftar bidang ilmu yang diterima belum diisi terstruktur — periksa deskripsi',
    }
  }

  if (daftar.includes('semua')) {
    return { ...dasar, status: 'TERPENUHI', keterangan: 'Semua bidang ilmu diperbolehkan' }
  }

  const dimiliki = profil.bidangStudi.map((b) => b.toLowerCase())
  const cocok = daftar.find((kunci) => dimiliki.some((b) => b.includes(kunci)))

  return {
    ...dasar,
    status: cocok ? 'TERPENUHI' : 'TIDAK_TERPENUHI',
    keterangan: cocok
      ? `Bidang ilmu sesuai (kata kunci "${cocok}")`
      : `Tidak ada riwayat pendidikan pada bidang: ${daftar.join(', ')}`,
  }
}

function cekPengalaman(syarat: Persyaratan, profil: ProfilKelayakan): RincianSyarat {
  const dasar = {
    persyaratanId: syarat.id,
    jenisSyarat: syarat.jenisSyarat,
    deskripsi: syarat.deskripsi,
  }

  const minimal = (syarat.nilaiMinimal ?? '').trim()
  if (minimal === '') {
    return {
      ...dasar,
      status: 'PERLU_VERIFIKASI_MANUAL',
      keterangan: 'Syarat pengalaman belum diisi terstruktur — periksa deskripsi',
    }
  }

  // Bentuk 1: eselon minimal ("III", "IV")
  const sebagaiEselon = minimal.toUpperCase() as Eselon
  if (sebagaiEselon in URUTAN_ESELON) {
    if (!profil.eselonTertinggi) {
      return {
        ...dasar,
        status: 'PERLU_VERIFIKASI_MANUAL',
        keterangan: 'Riwayat jabatan pegawai belum terpetakan ke master jabatan',
      }
    }
    const terpenuhi = URUTAN_ESELON[profil.eselonTertinggi] >= URUTAN_ESELON[sebagaiEselon]
    return {
      ...dasar,
      status: terpenuhi ? 'TERPENUHI' : 'TIDAK_TERPENUHI',
      keterangan: terpenuhi
        ? `Pernah menjabat eselon ${profil.eselonTertinggi} (syarat minimal ${sebagaiEselon})`
        : `Eselon tertinggi ${profil.eselonTertinggi} di bawah syarat minimal ${sebagaiEselon}`,
    }
  }

  // Bentuk 2: jumlah tahun minimal
  const tahunMinimal = Number(minimal)
  if (!Number.isNaN(tahunMinimal)) {
    if (profil.totalPengalamanTahun === null) {
      return {
        ...dasar,
        status: 'PERLU_VERIFIKASI_MANUAL',
        keterangan: 'Riwayat jabatan belum bertanggal, lama pengalaman tidak bisa dihitung',
      }
    }
    const terpenuhi = profil.totalPengalamanTahun >= tahunMinimal
    return {
      ...dasar,
      status: terpenuhi ? 'TERPENUHI' : 'TIDAK_TERPENUHI',
      keterangan: `Pengalaman ${profil.totalPengalamanTahun.toFixed(1)} tahun vs syarat minimal ${tahunMinimal} tahun`,
    }
  }

  return {
    ...dasar,
    status: 'PERLU_VERIFIKASI_MANUAL',
    keterangan: `Format syarat pengalaman "${minimal}" tidak dikenali`,
  }
}

export function evaluasiKelayakan(
  persyaratan: Persyaratan[],
  profil: ProfilKelayakan,
  opsi: { tahunSekarang?: number; masaBerlakuTahun?: number } = {},
): HasilKelayakan {
  const rincian: RincianSyarat[] = persyaratan.map((syarat) => {
    switch (syarat.jenisSyarat) {
      case 'PENDIDIKAN_MIN':
        return cekPendidikan(syarat, profil)
      case 'BIDANG_ILMU':
        return cekBidangIlmu(syarat, profil)
      case 'PENGALAMAN_MIN':
        return cekPengalaman(syarat, profil)
      default:
        return {
          persyaratanId: syarat.id,
          jenisSyarat: syarat.jenisSyarat,
          deskripsi: syarat.deskripsi,
          status: 'PERLU_VERIFIKASI_MANUAL' as StatusSyarat,
          keterangan: 'Syarat bebas (LAINNYA) — perlu penilaian manusia',
        }
    }
  })

  // Asesmen kedaluwarsa membatalkan kelayakan (phase.md §2.9).
  if (!profil.asesmen) {
    rincian.push({
      persyaratanId: 0,
      jenisSyarat: 'LAINNYA',
      deskripsi: 'Asesmen talenta yang berlaku',
      status: 'TIDAK_TERPENUHI',
      keterangan: 'Pegawai belum punya data asesmen talenta',
    })
  } else {
    const layak = asesmenLayakDipakai(
      profil.asesmen.tahunAsesmen,
      profil.asesmen.statusAsesmen,
      opsi,
    )
    rincian.push({
      persyaratanId: 0,
      jenisSyarat: 'LAINNYA',
      deskripsi: 'Asesmen talenta yang berlaku',
      status: layak ? 'TERPENUHI' : 'TIDAK_TERPENUHI',
      keterangan: layak
        ? `Asesmen tahun ${profil.asesmen.tahunAsesmen} masih berlaku`
        : `Asesmen tahun ${profil.asesmen.tahunAsesmen} sudah kedaluwarsa atau berstatus draft`,
    })
  }

  const gagal = rincian.filter((r) => r.status === 'TIDAK_TERPENUHI')
  const manual = rincian.filter((r) => r.status === 'PERLU_VERIFIKASI_MANUAL')

  const catatan =
    gagal.length > 0
      ? `Tidak memenuhi ${gagal.length} syarat: ${gagal.map((r) => r.keterangan).join('; ')}`
      : manual.length > 0
        ? `Memenuhi semua syarat yang bisa diperiksa otomatis; ${manual.length} syarat perlu verifikasi manual`
        : 'Memenuhi seluruh persyaratan jabatan target'

  return {
    eligible: gagal.length === 0,
    perluVerifikasiManual: manual.length > 0,
    rincian,
    catatan,
  }
}
