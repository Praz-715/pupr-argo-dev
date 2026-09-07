/**
 * Generator doc/sql/006_seed_perluasan.sql
 *
 * Menghasilkan seed perluasan data dev secara DETERMINISTIK (tanpa
 * Math.random, tanpa Date.now) supaya menjalankan 001->007 dari database
 * kosong selalu menghasilkan keadaan yang identik — salah satu DoD Fase 0.5.
 *
 * Jalankan: npx tsx scripts/gen-006-seed-perluasan.ts
 */

import { writeFileSync } from 'node:fs'

import { parseNip } from '../lib/nip'
import { evaluasiMasaBerlaku } from '../lib/scoring/asesmen'
import { SKOR_PREDIKAT } from '../lib/scoring/konstanta'
import { hitungKotak9 } from '../lib/scoring/kotak9'
// Seed dasar SENGAJA memakai ambang bawaan, bukan `pengaturan_sistem`: berkas
// SQL ini adalah titik awal database, jadi ia tidak boleh bergantung pada isi
// tabel yang baru dibuat olehnya sendiri.
import { AMBANG_SUMBU, PARAMETER_SKORING_BAWAAN } from '../lib/scoring/konstanta'
import type { Predikat } from '../lib/scoring/types'

const TAHUN_SEKARANG = 2026
const MASA_BERLAKU = 3

/**
 * Kotak 9 & status asesmen untuk baris seed dihitung oleh lib/scoring, BUKAN
 * ditulis tangan. Alasannya bukan sekadar kerapian: kalau baris seed diisi
 * angka placeholder, laporan "selisih kotak_9 vs sumber" di 007 jadi penuh
 * selisih palsu, dan sinyal Antrian Pembersihan Data kehilangan artinya.
 * Dengan cara ini, satu-satunya selisih yang tersisa adalah selisih NYATA dari
 * data contoh e-Nominasi (kasus Tasya & Tina).
 */
const kotakSeed = (predikat: Predikat, potkom: number): number =>
  hitungKotak9(SKOR_PREDIKAT[predikat], potkom, AMBANG_SUMBU, PARAMETER_SKORING_BAWAAN.bobotTalenta)
    .kotak

const statusSeed = (tahunAsesmen: number): 'Berlaku' | 'Expired' =>
  evaluasiMasaBerlaku(tahunAsesmen, null, {
    tahunSekarang: TAHUN_SEKARANG,
    masaBerlakuTahun: MASA_BERLAKU,
  }).kedaluwarsa
    ? 'Expired'
    : 'Berlaku'

const BERKAS = 'doc/sql/006_seed_perluasan.sql'

// ID awal melanjutkan seed 002 & 003
const ID_UNIT_AWAL = 18
const ID_JABATAN_AWAL = 17
const ID_PEGAWAI_AWAL = 17

// ---------------------------------------------------------------------------
// Unit organisasi tambahan
// ---------------------------------------------------------------------------

type JenisUnit =
  | 'DITJEN' | 'SEKRETARIAT' | 'DIREKTORAT' | 'BALAI' | 'BP2JK' | 'SUBDIT' | 'BAGIAN' | 'SEKSI'

interface UnitBaru {
  kode: string
  nama: string
  parentId: number
  jenis: JenisUnit
  eselon: number | null
}

const UNIT: UnitBaru[] = [
  { kode: 'BP2JK-JABAR', nama: 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Barat', parentId: 1, jenis: 'BP2JK', eselon: 3 },
  { kode: 'BP2JK-JATIM', nama: 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Timur', parentId: 1, jenis: 'BP2JK', eselon: 3 },
  { kode: 'BP2JK-SULSEL', nama: 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sulawesi Selatan', parentId: 1, jenis: 'BP2JK', eselon: 3 },
  { kode: 'BP2JK-KALTIM', nama: 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Kalimantan Timur', parentId: 1, jenis: 'BP2JK', eselon: 3 },
  { kode: 'BP2JK-PAPUA', nama: 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Papua', parentId: 1, jenis: 'BP2JK', eselon: 3 },
  { kode: 'BJKW-MDN', nama: 'Balai Jasa Konstruksi Wilayah I Medan', parentId: 1, jenis: 'BALAI', eselon: 3 },
  { kode: 'BJKW-BJM', nama: 'Balai Jasa Konstruksi Wilayah V Banjarmasin', parentId: 1, jenis: 'BALAI', eselon: 3 },
  { kode: 'SUBDIT-KELEMBAGAAN', nama: 'Subdirektorat Kelembagaan dan Sumber Daya Konstruksi', parentId: 4, jenis: 'SUBDIT', eselon: 3 },
  { kode: 'SUBDIT-STANDAR', nama: 'Subdirektorat Standar dan Materi Kompetensi', parentId: 5, jenis: 'SUBDIT', eselon: 3 },
  { kode: 'BAG-KEUANGAN', nama: 'Bagian Keuangan dan Barang Milik Negara', parentId: 2, jenis: 'BAGIAN', eselon: 3 },
  { kode: 'BAG-PROGRAM', nama: 'Bagian Program dan Evaluasi', parentId: 2, jenis: 'BAGIAN', eselon: 3 },
]

const idUnit = (kode: string): number => {
  const i = UNIT.findIndex((u) => u.kode === kode)
  if (i < 0) throw new Error(`Unit ${kode} tidak ada`)
  return ID_UNIT_AWAL + i
}

// ---------------------------------------------------------------------------
// Jabatan tambahan
// ---------------------------------------------------------------------------

type JenisJabatan = 'STRUKTURAL' | 'FUNGSIONAL_TERTENTU' | 'FUNGSIONAL_UMUM'
type Eselon = 'I' | 'II' | 'III' | 'IV' | 'NON_ESELON'

interface JabatanBaru {
  kode: string
  nama: string
  unitId: number
  jenis: JenisJabatan
  jenjang: string
  eselon: Eselon
  status: 'TERISI' | 'KOSONG'
}

const JABATAN: JabatanBaru[] = [
  // Kepala balai (Administrator, eselon III)
  { kode: 'JAB-KABALAI-BP2JK-JABAR', nama: 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Barat', unitId: idUnit('BP2JK-JABAR'), jenis: 'STRUKTURAL', jenjang: 'Administrator', eselon: 'III', status: 'TERISI' },
  { kode: 'JAB-KABALAI-BP2JK-JATIM', nama: 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Timur', unitId: idUnit('BP2JK-JATIM'), jenis: 'STRUKTURAL', jenjang: 'Administrator', eselon: 'III', status: 'TERISI' },
  { kode: 'JAB-KABALAI-BP2JK-SULSEL', nama: 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sulawesi Selatan', unitId: idUnit('BP2JK-SULSEL'), jenis: 'STRUKTURAL', jenjang: 'Administrator', eselon: 'III', status: 'KOSONG' },
  { kode: 'JAB-KABALAI-BP2JK-KALTIM', nama: 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Kalimantan Timur', unitId: idUnit('BP2JK-KALTIM'), jenis: 'STRUKTURAL', jenjang: 'Administrator', eselon: 'III', status: 'TERISI' },
  { kode: 'JAB-KABALAI-BP2JK-PAPUA', nama: 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Papua', unitId: idUnit('BP2JK-PAPUA'), jenis: 'STRUKTURAL', jenjang: 'Administrator', eselon: 'III', status: 'KOSONG' },
  { kode: 'JAB-KABALAI-BJKW-MDN', nama: 'Kepala Balai Jasa Konstruksi Wilayah I Medan', unitId: idUnit('BJKW-MDN'), jenis: 'STRUKTURAL', jenjang: 'Administrator', eselon: 'III', status: 'TERISI' },
  { kode: 'JAB-KABALAI-BJKW-BJM', nama: 'Kepala Balai Jasa Konstruksi Wilayah V Banjarmasin', unitId: idUnit('BJKW-BJM'), jenis: 'STRUKTURAL', jenjang: 'Administrator', eselon: 'III', status: 'KOSONG' },
  // Kasubdit & Kabag (Administrator, eselon III)
  { kode: 'JAB-KASUBDIT-KELEMBAGAAN', nama: 'Kepala Subdirektorat Kelembagaan dan Sumber Daya Konstruksi', unitId: idUnit('SUBDIT-KELEMBAGAAN'), jenis: 'STRUKTURAL', jenjang: 'Administrator', eselon: 'III', status: 'TERISI' },
  { kode: 'JAB-KASUBDIT-STANDAR', nama: 'Kepala Subdirektorat Standar dan Materi Kompetensi', unitId: idUnit('SUBDIT-STANDAR'), jenis: 'STRUKTURAL', jenjang: 'Administrator', eselon: 'III', status: 'KOSONG' },
  { kode: 'JAB-KABAG-KEUANGAN', nama: 'Kepala Bagian Keuangan dan Barang Milik Negara', unitId: idUnit('BAG-KEUANGAN'), jenis: 'STRUKTURAL', jenjang: 'Administrator', eselon: 'III', status: 'TERISI' },
  { kode: 'JAB-KABAG-PROGRAM', nama: 'Kepala Bagian Program dan Evaluasi', unitId: idUnit('BAG-PROGRAM'), jenis: 'STRUKTURAL', jenjang: 'Administrator', eselon: 'III', status: 'TERISI' },
  // Pengawas (eselon IV)
  { kode: 'JAB-KASUBBAG-TU-JABAR', nama: 'Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Barat', unitId: idUnit('BP2JK-JABAR'), jenis: 'STRUKTURAL', jenjang: 'Pengawas', eselon: 'IV', status: 'TERISI' },
  { kode: 'JAB-KASUBBAG-TU-JATIM', nama: 'Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Timur', unitId: idUnit('BP2JK-JATIM'), jenis: 'STRUKTURAL', jenjang: 'Pengawas', eselon: 'IV', status: 'TERISI' },
  { kode: 'JAB-KASUBBAG-TU-MDN', nama: 'Kepala Subbagian Umum dan Tata Usaha BJKW Wilayah I Medan', unitId: idUnit('BJKW-MDN'), jenis: 'STRUKTURAL', jenjang: 'Pengawas', eselon: 'IV', status: 'TERISI' },
  { kode: 'JAB-KASI-KELEMBAGAAN', nama: 'Kepala Seksi Kelembagaan', unitId: idUnit('SUBDIT-KELEMBAGAAN'), jenis: 'STRUKTURAL', jenjang: 'Pengawas', eselon: 'IV', status: 'TERISI' },
  { kode: 'JAB-KASI-STANDAR', nama: 'Kepala Seksi Penyusunan Standar Kompetensi', unitId: idUnit('SUBDIT-STANDAR'), jenis: 'STRUKTURAL', jenjang: 'Pengawas', eselon: 'IV', status: 'TERISI' },
  { kode: 'JAB-KASI-KEUANGAN', nama: 'Kepala Seksi Perbendaharaan', unitId: idUnit('BAG-KEUANGAN'), jenis: 'STRUKTURAL', jenjang: 'Pengawas', eselon: 'IV', status: 'TERISI' },
  // Fungsional tertentu
  { kode: 'JAB-PJK-MADYA-KSP', nama: 'Pembina Jasa Konstruksi Ahli Madya', unitId: 4, jenis: 'FUNGSIONAL_TERTENTU', jenjang: 'Ahli Madya', eselon: 'NON_ESELON', status: 'TERISI' },
  { kode: 'JAB-PJK-MADYA-BINKOM', nama: 'Pembina Jasa Konstruksi Ahli Madya (Bina Kompetensi)', unitId: 5, jenis: 'FUNGSIONAL_TERTENTU', jenjang: 'Ahli Madya', eselon: 'NON_ESELON', status: 'TERISI' },
  { kode: 'JAB-PJK-MUDA-KSP', nama: 'Pembina Jasa Konstruksi Ahli Muda (Kerja Sama)', unitId: 4, jenis: 'FUNGSIONAL_TERTENTU', jenjang: 'Ahli Muda', eselon: 'NON_ESELON', status: 'TERISI' },
  { kode: 'JAB-PJK-PERTAMA-STANDAR', nama: 'Pembina Jasa Konstruksi Ahli Pertama (Standar Kompetensi)', unitId: idUnit('SUBDIT-STANDAR'), jenis: 'FUNGSIONAL_TERTENTU', jenjang: 'Ahli Pertama', eselon: 'NON_ESELON', status: 'TERISI' },
  { kode: 'JAB-PPBJ-MADYA', nama: 'Pengelola Pengadaan Barang/Jasa Ahli Madya', unitId: 7, jenis: 'FUNGSIONAL_TERTENTU', jenjang: 'Ahli Madya', eselon: 'NON_ESELON', status: 'TERISI' },
  { kode: 'JAB-PPBJ-MUDA', nama: 'Pengelola Pengadaan Barang/Jasa Ahli Muda', unitId: 7, jenis: 'FUNGSIONAL_TERTENTU', jenjang: 'Ahli Muda', eselon: 'NON_ESELON', status: 'TERISI' },
  { kode: 'JAB-PPBJ-MUDA-JABAR', nama: 'Pengelola Pengadaan Barang/Jasa Ahli Muda BP2JK Jawa Barat', unitId: idUnit('BP2JK-JABAR'), jenis: 'FUNGSIONAL_TERTENTU', jenjang: 'Ahli Muda', eselon: 'NON_ESELON', status: 'TERISI' },
  { kode: 'JAB-ANALIS-SDM-PERTAMA', nama: 'Analis Sumber Daya Manusia Aparatur Ahli Pertama', unitId: 6, jenis: 'FUNGSIONAL_TERTENTU', jenjang: 'Ahli Pertama', eselon: 'NON_ESELON', status: 'TERISI' },
  { kode: 'JAB-PERENCANA-MUDA', nama: 'Perencana Ahli Muda', unitId: idUnit('BAG-PROGRAM'), jenis: 'FUNGSIONAL_TERTENTU', jenjang: 'Ahli Muda', eselon: 'NON_ESELON', status: 'TERISI' },
  { kode: 'JAB-ANALIS-KEUANGAN-MUDA', nama: 'Analis Pengelolaan Keuangan APBN Ahli Muda', unitId: idUnit('BAG-KEUANGAN'), jenis: 'FUNGSIONAL_TERTENTU', jenjang: 'Ahli Muda', eselon: 'NON_ESELON', status: 'TERISI' },
  { kode: 'JAB-PRANATA-KOMPUTER-MUDA', nama: 'Pranata Komputer Ahli Muda', unitId: 6, jenis: 'FUNGSIONAL_TERTENTU', jenjang: 'Ahli Muda', eselon: 'NON_ESELON', status: 'TERISI' },
  { kode: 'JAB-ARSIPARIS-PERTAMA', nama: 'Arsiparis Ahli Pertama', unitId: 6, jenis: 'FUNGSIONAL_TERTENTU', jenjang: 'Ahli Pertama', eselon: 'NON_ESELON', status: 'TERISI' },
  // Fungsional umum
  { kode: 'JAB-PENGADMIN-UMUM-JATIM', nama: 'Pengadministrasi Umum BP2JK Wilayah Jawa Timur', unitId: idUnit('BP2JK-JATIM'), jenis: 'FUNGSIONAL_UMUM', jenjang: 'Pelaksana', eselon: 'NON_ESELON', status: 'TERISI' },
  { kode: 'JAB-PENGOLAH-DATA-SULSEL', nama: 'Pengolah Data dan Informasi BP2JK Wilayah Sulawesi Selatan', unitId: idUnit('BP2JK-SULSEL'), jenis: 'FUNGSIONAL_UMUM', jenjang: 'Pelaksana', eselon: 'NON_ESELON', status: 'TERISI' },
]

const idJabatan = (kode: string): number => {
  const i = JABATAN.findIndex((j) => j.kode === kode)
  if (i < 0) throw new Error(`Jabatan ${kode} tidak ada`)
  return ID_JABATAN_AWAL + i
}

// ---------------------------------------------------------------------------
// Pegawai tambahan — dirancang mengisi KESEMBILAN sel Kotak 9
//
// Sel yang sudah terisi oleh 16 pegawai lama: 9 (10 org), 7 (5 org), 2 (1 org).
// 24 pegawai di bawah mengisi sisanya. `kotakTarget` dipakai sebagai uji
// mandiri: generator menghitung ulang kotaknya dari (predikat, potkom) dan
// gagal kalau tidak cocok — jadi tabel ini tidak bisa "bohong".
// ---------------------------------------------------------------------------

type TingkatPendidikan = 'SLTA' | 'D3' | 'S1_D4' | 'S2' | 'S3'

interface PegawaiBaru {
  nama: string
  nip: string
  golongan: string
  pangkat: string
  pendidikan: TingkatPendidikan
  sekolah: string
  bidangStudi: string
  jabatanKode: string
  tmtGolongan: string
  tmtJabatan: string
  diklat: string[]
  predikat: Predikat
  potkom: number
  tahunAsesmen: number
  jenisAsesmen: string
  kotakTarget: number
  /** Riwayat jabatan: [teks, kodeJabatanMaster|null, tanggalMulai, tanggalAkhir|null] */
  riwayat: Array<[string, string | null, string, string | null]>
  pendidikanRiwayat: Array<[TingkatPendidikan, string, string, number | null, boolean]>
}

const PEGAWAI: PegawaiBaru[] = [
  // ---- Kotak 8: Sesuai Ekspektasi (Butuh Perbaikan = 60) x Potensial Tinggi ----
  {
    nama: 'Agus Purnomo', nip: '198102142006041002', golongan: 'IV/a', pangkat: 'Pembina',
    pendidikan: 'S2', sekolah: 'Institut Teknologi Bandung', bidangStudi: 'Teknik Sipil',
    jabatanKode: 'JAB-KABALAI-BP2JK-JABAR', tmtGolongan: '2021-04-01', tmtJabatan: '2022-03-01',
    diklat: ['Diklat Kepemimpinan Administrator', 'Sertifikasi Pengadaan Barang/Jasa Tingkat Lanjut', 'Diklat Manajemen Konstruksi'],
    predikat: 'Butuh Perbaikan', potkom: 85.0, tahunAsesmen: 2025, jenisAsesmen: 'Administrator', kotakTarget: 8,
    riwayat: [
      ['Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Barat', 'JAB-KABALAI-BP2JK-JABAR', '2022-03-01', null],
      ['Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Barat', 'JAB-KASUBBAG-TU-JABAR', '2017-05-01', '2022-03-01'],
      ['Staf Teknis Dinas Pekerjaan Umum Provinsi Jawa Barat', null, '2010-01-01', '2017-05-01'],
    ],
    pendidikanRiwayat: [['S2', 'Institut Teknologi Bandung', 'Teknik Sipil', 2015, true], ['S1_D4', 'Universitas Diponegoro', 'Teknik Sipil', 2005, false]],
  },
  {
    nama: 'Ratna Dewi Sari', nip: '198407252009122003', golongan: 'III/d', pangkat: 'Penata Tingkat I',
    pendidikan: 'S2', sekolah: 'Universitas Gadjah Mada', bidangStudi: 'Manajemen Konstruksi',
    jabatanKode: 'JAB-PPBJ-MADYA', tmtGolongan: '2020-10-01', tmtJabatan: '2021-06-01',
    diklat: ['Sertifikasi Pengelola Pengadaan Barang/Jasa Ahli Madya', 'Diklat Kontrak Konstruksi'],
    predikat: 'Butuh Perbaikan', potkom: 88.0, tahunAsesmen: 2025, jenisAsesmen: 'JFT Madya', kotakTarget: 8,
    riwayat: [
      ['Pengelola Pengadaan Barang/Jasa Ahli Madya, Subdirektorat Pengadaan', 'JAB-PPBJ-MADYA', '2021-06-01', null],
      ['Pengelola Pengadaan Barang/Jasa Ahli Muda, Subdirektorat Pengadaan', 'JAB-PPBJ-MUDA', '2016-04-01', '2021-06-01'],
    ],
    pendidikanRiwayat: [['S2', 'Universitas Gadjah Mada', 'Manajemen Konstruksi', 2016, true], ['S1_D4', 'Universitas Sebelas Maret', 'Teknik Sipil', 2008, true]],
  },
  {
    nama: 'Bambang Wijaya', nip: '197911032005021004', golongan: 'IV/a', pangkat: 'Pembina',
    pendidikan: 'S1_D4', sekolah: 'Universitas Brawijaya', bidangStudi: 'Teknik Sipil',
    jabatanKode: 'JAB-KABALAI-BP2JK-JATIM', tmtGolongan: '2020-04-01', tmtJabatan: '2020-09-01',
    diklat: ['Diklat Kepemimpinan Administrator', 'Sertifikasi Pengadaan Barang/Jasa'],
    predikat: 'Butuh Perbaikan', potkom: 82.0, tahunAsesmen: 2024, jenisAsesmen: 'Administrator', kotakTarget: 8,
    riwayat: [
      ['Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Timur', 'JAB-KABALAI-BP2JK-JATIM', '2020-09-01', null],
      ['Plt Kepala Balai Jasa Konstruksi Wilayah V Banjarmasin', 'JAB-KABALAI-BJKW-BJM', '2019-02-01', '2020-09-01'],
      ['Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Timur', 'JAB-KASUBBAG-TU-JATIM', '2014-07-01', '2019-02-01'],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Brawijaya', 'Teknik Sipil', 2003, true]],
  },
  {
    nama: 'Nur Aini Fitri', nip: '198606192010122004', golongan: 'III/d', pangkat: 'Penata Tingkat I',
    pendidikan: 'S2', sekolah: 'Universitas Indonesia', bidangStudi: 'Administrasi Publik',
    jabatanKode: 'JAB-PJK-MADYA-BINKOM', tmtGolongan: '2021-04-01', tmtJabatan: '2022-01-03',
    diklat: ['Diklat Pembinaan Kompetensi Konstruksi', 'Sertifikasi Asesor Kompetensi', 'Diklat Pengadaan Barang/Jasa'],
    predikat: 'Butuh Perbaikan', potkom: 91.0, tahunAsesmen: 2026, jenisAsesmen: 'JFT Madya', kotakTarget: 8,
    riwayat: [
      ['Pembina Jasa Konstruksi Ahli Madya, Direktorat Bina Kompetensi dan Produktivitas Konstruksi', 'JAB-PJK-MADYA-BINKOM', '2022-01-03', null],
      ['Pembina Jasa Konstruksi Ahli Muda, Subdirektorat Standar dan Materi Kompetensi', 'JAB-PJK-PERTAMA-STANDAR', '2016-02-01', '2022-01-03'],
    ],
    pendidikanRiwayat: [['S2', 'Universitas Indonesia', 'Administrasi Publik', 2018, true], ['S1_D4', 'Universitas Negeri Yogyakarta', 'Pendidikan Teknik Bangunan', 2008, false]],
  },

  // ---- Kotak 7: Di Atas Ekspektasi x Potensial Menengah ----
  {
    nama: 'Teguh Wibowo', nip: '198209152008011003', golongan: 'III/d', pangkat: 'Penata Tingkat I',
    pendidikan: 'S1_D4', sekolah: 'Universitas Hasanuddin', bidangStudi: 'Teknik Sipil',
    jabatanKode: 'JAB-KABALAI-BP2JK-KALTIM', tmtGolongan: '2020-10-01', tmtJabatan: '2023-02-01',
    diklat: ['Diklat Kepemimpinan Pengawas', 'Sertifikasi Pengadaan Barang/Jasa'],
    predikat: 'Baik', potkom: 74.0, tahunAsesmen: 2025, jenisAsesmen: 'Administrator', kotakTarget: 7,
    riwayat: [
      ['Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Kalimantan Timur', 'JAB-KABALAI-BP2JK-KALTIM', '2023-02-01', null],
      ['Kepala Seksi Perbendaharaan, Bagian Keuangan dan Barang Milik Negara', 'JAB-KASI-KEUANGAN', '2018-03-01', '2023-02-01'],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Hasanuddin', 'Teknik Sipil', 2006, true]],
  },

  // ---- Kotak 6: Di Bawah Ekspektasi x Potensial Tinggi ----
  {
    nama: 'Lestari Handayani', nip: '198812052012122002', golongan: 'III/c', pangkat: 'Penata',
    pendidikan: 'S2', sekolah: 'Institut Teknologi Sepuluh Nopember', bidangStudi: 'Manajemen Proyek Konstruksi',
    jabatanKode: 'JAB-PPBJ-MUDA', tmtGolongan: '2022-04-01', tmtJabatan: '2023-08-01',
    diklat: ['Sertifikasi Pengelola Pengadaan Barang/Jasa Ahli Muda', 'Diklat Manajemen Risiko Konstruksi'],
    predikat: 'Kurang', potkom: 86.0, tahunAsesmen: 2025, jenisAsesmen: 'JFT Muda', kotakTarget: 6,
    riwayat: [
      ['Pengelola Pengadaan Barang/Jasa Ahli Muda, Subdirektorat Pengadaan', 'JAB-PPBJ-MUDA', '2023-08-01', null],
      ['Pengelola Pengadaan Barang/Jasa Ahli Pertama, Subdirektorat Pengadaan', null, '2018-01-02', '2023-08-01'],
    ],
    pendidikanRiwayat: [['S2', 'Institut Teknologi Sepuluh Nopember', 'Manajemen Proyek Konstruksi', 2019, true], ['S1_D4', 'Universitas Airlangga', 'Teknik Sipil', 2011, false]],
  },
  {
    nama: 'Joko Susilo', nip: '198503282011011005', golongan: 'III/c', pangkat: 'Penata',
    pendidikan: 'S1_D4', sekolah: 'Universitas Sriwijaya', bidangStudi: 'Teknik Sipil',
    jabatanKode: 'JAB-PJK-MUDA-KSP', tmtGolongan: '2021-10-01', tmtJabatan: '2022-05-02',
    diklat: ['Diklat Pemberdayaan Jasa Konstruksi'],
    predikat: 'Kurang', potkom: 83.0, tahunAsesmen: 2024, jenisAsesmen: 'JFT Muda', kotakTarget: 6,
    riwayat: [
      ['Pembina Jasa Konstruksi Ahli Muda, Direktorat Kerja Sama dan Pemberdayaan', 'JAB-PJK-MUDA-KSP', '2022-05-02', null],
      ['Pembina Jasa Konstruksi Ahli Pertama, Direktorat Kerja Sama dan Pemberdayaan', null, '2017-03-01', '2022-05-02'],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Sriwijaya', 'Teknik Sipil', 2009, false]],
  },

  // ---- Kotak 5: Sesuai Ekspektasi x Potensial Menengah ----
  {
    nama: 'Maya Kusumawati', nip: '198710142012122005', golongan: 'III/c', pangkat: 'Penata',
    pendidikan: 'S1_D4', sekolah: 'Universitas Padjadjaran', bidangStudi: 'Ilmu Administrasi Negara',
    jabatanKode: 'JAB-ANALIS-SDM-PERTAMA', tmtGolongan: '2022-04-01', tmtJabatan: '2023-01-02',
    diklat: ['Diklat Manajemen Kepegawaian'],
    predikat: 'Butuh Perbaikan', potkom: 72.0, tahunAsesmen: 2025, jenisAsesmen: 'JFT Pertama', kotakTarget: 5,
    riwayat: [
      ['Analis Sumber Daya Manusia Aparatur Ahli Pertama, Bagian Kepegawaian dan Umum', 'JAB-ANALIS-SDM-PERTAMA', '2023-01-02', null],
      ['Pengadministrasi Kepegawaian, Bagian Kepegawaian dan Umum', null, '2016-05-01', '2023-01-02'],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Padjadjaran', 'Ilmu Administrasi Negara', 2010, true]],
  },
  {
    nama: 'Andi Setiawan', nip: '198611232010121006', golongan: 'III/c', pangkat: 'Penata',
    pendidikan: 'S1_D4', sekolah: 'Universitas Tadulako', bidangStudi: 'Teknik Sipil',
    jabatanKode: 'JAB-KASI-KELEMBAGAAN', tmtGolongan: '2021-10-01', tmtJabatan: '2022-08-01',
    diklat: ['Diklat Kepemimpinan Pengawas', 'Diklat Kelembagaan Konstruksi'],
    predikat: 'Butuh Perbaikan', potkom: 68.0, tahunAsesmen: 2024, jenisAsesmen: 'Pengawas', kotakTarget: 5,
    riwayat: [
      ['Kepala Seksi Kelembagaan, Subdirektorat Kelembagaan dan Sumber Daya Konstruksi', 'JAB-KASI-KELEMBAGAAN', '2022-08-01', null],
      ['Plh Kepala Seksi Penyusunan Standar Kompetensi', 'JAB-KASI-STANDAR', '2021-02-01', '2022-08-01'],
      ['Pengolah Data Direktorat Kerja Sama dan Pemberdayaan', null, '2015-01-05', '2021-02-01'],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Tadulako', 'Teknik Sipil', 2009, false]],
  },
  {
    nama: 'Sri Wahyuni', nip: '198305172009122006', golongan: 'III/d', pangkat: 'Penata Tingkat I',
    pendidikan: 'S2', sekolah: 'Universitas Diponegoro', bidangStudi: 'Manajemen Keuangan',
    jabatanKode: 'JAB-ANALIS-KEUANGAN-MUDA', tmtGolongan: '2020-10-01', tmtJabatan: '2021-04-01',
    diklat: ['Diklat Pengelolaan Keuangan Negara', 'Diklat Bendahara Pengeluaran'],
    predikat: 'Butuh Perbaikan', potkom: 76.0, tahunAsesmen: 2025, jenisAsesmen: 'JFT Muda', kotakTarget: 5,
    riwayat: [
      ['Analis Pengelolaan Keuangan APBN Ahli Muda, Bagian Keuangan dan Barang Milik Negara', 'JAB-ANALIS-KEUANGAN-MUDA', '2021-04-01', null],
      ['Bendahara Pengeluaran Sekretariat Direktorat Jenderal Bina Konstruksi', null, '2014-02-01', '2021-04-01'],
    ],
    pendidikanRiwayat: [['S2', 'Universitas Diponegoro', 'Manajemen Keuangan', 2017, true], ['S1_D4', 'Universitas Jenderal Soedirman', 'Akuntansi', 2007, true]],
  },
  {
    nama: 'Dedi Kurniadi', nip: '199003082015011007', golongan: 'III/b', pangkat: 'Penata Muda Tingkat I',
    pendidikan: 'S1_D4', sekolah: 'Universitas Lampung', bidangStudi: 'Teknik Informatika',
    jabatanKode: 'JAB-PRANATA-KOMPUTER-MUDA', tmtGolongan: '2022-04-01', tmtJabatan: '2024-01-02',
    diklat: ['Diklat Tata Kelola Teknologi Informasi'],
    predikat: 'Butuh Perbaikan', potkom: 63.0, tahunAsesmen: 2026, jenisAsesmen: 'JFT Muda', kotakTarget: 5,
    riwayat: [
      ['Pranata Komputer Ahli Muda, Bagian Kepegawaian dan Umum', 'JAB-PRANATA-KOMPUTER-MUDA', '2024-01-02', null],
      ['Pranata Komputer Ahli Pertama, Bagian Kepegawaian dan Umum', null, '2019-03-01', '2024-01-02'],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Lampung', 'Teknik Informatika', 2013, false]],
  },

  // ---- Kotak 4: Di Atas Ekspektasi x Potensial Rendah ----
  {
    nama: 'Ika Puspita', nip: '197806232003122002', golongan: 'IV/a', pangkat: 'Pembina',
    pendidikan: 'S2', sekolah: 'Universitas Negeri Semarang', bidangStudi: 'Manajemen Pendidikan',
    jabatanKode: 'JAB-KABAG-PROGRAM', tmtGolongan: '2019-04-01', tmtJabatan: '2020-02-03',
    diklat: ['Diklat Kepemimpinan Administrator', 'Diklat Perencanaan Program'],
    predikat: 'Sangat Baik', potkom: 55.0, tahunAsesmen: 2025, jenisAsesmen: 'Administrator', kotakTarget: 4,
    riwayat: [
      ['Kepala Bagian Program dan Evaluasi, Sekretariat Direktorat Jenderal Bina Konstruksi', 'JAB-KABAG-PROGRAM', '2020-02-03', null],
      ['Kepala Seksi Perbendaharaan, Bagian Keuangan dan Barang Milik Negara', 'JAB-KASI-KEUANGAN', '2013-06-01', '2020-02-03'],
    ],
    pendidikanRiwayat: [['S2', 'Universitas Negeri Semarang', 'Manajemen Pendidikan', 2012, true], ['S1_D4', 'Universitas Negeri Semarang', 'Pendidikan Ekonomi', 2001, false]],
  },
  {
    nama: 'Fajar Nugroho', nip: '198901172014021008', golongan: 'III/b', pangkat: 'Penata Muda Tingkat I',
    pendidikan: 'S1_D4', sekolah: 'Politeknik Negeri Jakarta', bidangStudi: 'Teknik Konstruksi Sipil',
    jabatanKode: 'JAB-PJK-PERTAMA-STANDAR', tmtGolongan: '2022-04-01', tmtJabatan: '2023-05-02',
    diklat: ['Diklat Dasar Jabatan Fungsional Pembina Jasa Konstruksi'],
    predikat: 'Baik', potkom: 48.0, tahunAsesmen: 2025, jenisAsesmen: 'JFT Pertama', kotakTarget: 4,
    riwayat: [
      ['Pembina Jasa Konstruksi Ahli Pertama, Subdirektorat Standar dan Materi Kompetensi', 'JAB-PJK-PERTAMA-STANDAR', '2023-05-02', null],
      ['Pengolah Data dan Informasi, Direktorat Bina Kompetensi dan Produktivitas Konstruksi', null, '2018-02-01', '2023-05-02'],
    ],
    pendidikanRiwayat: [['S1_D4', 'Politeknik Negeri Jakarta', 'Teknik Konstruksi Sipil', 2012, false]],
  },
  {
    nama: 'Wulan Sari Utami', nip: '198002112004122003', golongan: 'IV/a', pangkat: 'Pembina',
    pendidikan: 'S2', sekolah: 'Universitas Gadjah Mada', bidangStudi: 'Ilmu Hukum',
    jabatanKode: 'JAB-KABAG-KEUANGAN', tmtGolongan: '2019-10-01', tmtJabatan: '2021-01-04',
    diklat: ['Diklat Kepemimpinan Administrator', 'Diklat Hukum Kontrak Pemerintah'],
    predikat: 'Sangat Baik', potkom: 52.0, tahunAsesmen: 2024, jenisAsesmen: 'Administrator', kotakTarget: 4,
    riwayat: [
      ['Kepala Bagian Keuangan dan Barang Milik Negara, Sekretariat Direktorat Jenderal Bina Konstruksi', 'JAB-KABAG-KEUANGAN', '2021-01-04', null],
      ['Kepala Bagian Hukum dan Kepatuhan, Sekretariat Jenderal Kementerian PUPR', null, '2015-08-01', '2021-01-04'],
    ],
    pendidikanRiwayat: [['S2', 'Universitas Gadjah Mada', 'Ilmu Hukum', 2011, true], ['S1_D4', 'Universitas Gadjah Mada', 'Ilmu Hukum', 2002, true]],
  },
  {
    nama: 'Herman Saputra', nip: '198404092009011009', golongan: 'III/d', pangkat: 'Penata Tingkat I',
    pendidikan: 'S1_D4', sekolah: 'Universitas Sumatera Utara', bidangStudi: 'Teknik Sipil',
    jabatanKode: 'JAB-KABALAI-BJKW-MDN', tmtGolongan: '2020-04-01', tmtJabatan: '2023-09-01',
    diklat: ['Diklat Kepemimpinan Pengawas'],
    predikat: 'Baik', potkom: 57.0, tahunAsesmen: 2025, jenisAsesmen: 'Administrator', kotakTarget: 4,
    riwayat: [
      ['Kepala Balai Jasa Konstruksi Wilayah I Medan', 'JAB-KABALAI-BJKW-MDN', '2023-09-01', null],
      ['Kepala Subbagian Umum dan Tata Usaha BJKW Wilayah I Medan', 'JAB-KASUBBAG-TU-MDN', '2017-04-01', '2023-09-01'],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Sumatera Utara', 'Teknik Sipil', 2007, false]],
  },

  // ---- Kotak 3: Di Bawah Ekspektasi x Potensial Menengah ----
  {
    nama: 'Rina Marlina', nip: '199105292015122008', golongan: 'III/b', pangkat: 'Penata Muda Tingkat I',
    pendidikan: 'S1_D4', sekolah: 'Universitas Andalas', bidangStudi: 'Teknik Lingkungan',
    jabatanKode: 'JAB-PPBJ-MUDA-JABAR', tmtGolongan: '2022-10-01', tmtJabatan: '2024-03-01',
    diklat: ['Sertifikasi Pengadaan Barang/Jasa Tingkat Dasar'],
    predikat: 'Kurang', potkom: 66.0, tahunAsesmen: 2025, jenisAsesmen: 'JFT Muda', kotakTarget: 3,
    riwayat: [
      ['Pengelola Pengadaan Barang/Jasa Ahli Muda BP2JK Jawa Barat', 'JAB-PPBJ-MUDA-JABAR', '2024-03-01', null],
      ['Pengadministrasi Umum BP2JK Wilayah Jawa Barat', null, '2019-02-01', '2024-03-01'],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Andalas', 'Teknik Lingkungan', 2014, false]],
  },
  {
    nama: 'Slamet Riyadi', nip: '198707142012021010', golongan: 'III/b', pangkat: 'Penata Muda Tingkat I',
    pendidikan: 'D3', sekolah: 'Politeknik Negeri Semarang', bidangStudi: 'Teknik Sipil',
    jabatanKode: 'JAB-PENGADMIN-UMUM-JATIM', tmtGolongan: '2022-04-01', tmtJabatan: '2022-04-01',
    diklat: [],
    predikat: 'Sangat Kurang', potkom: 71.0, tahunAsesmen: 2024, jenisAsesmen: 'Pelaksana', kotakTarget: 3,
    riwayat: [
      ['Pengadministrasi Umum BP2JK Wilayah Jawa Timur', 'JAB-PENGADMIN-UMUM-JATIM', '2022-04-01', null],
    ],
    pendidikanRiwayat: [['D3', 'Politeknik Negeri Semarang', 'Teknik Sipil', 2010, false]],
  },

  // ---- Kotak 2: Sesuai Ekspektasi x Potensial Rendah ----
  {
    nama: 'Diah Permatasari', nip: '198909022014122009', golongan: 'III/b', pangkat: 'Penata Muda Tingkat I',
    pendidikan: 'S1_D4', sekolah: 'Universitas Negeri Malang', bidangStudi: 'Pendidikan Teknik Bangunan',
    jabatanKode: 'JAB-KASUBBAG-TU-JATIM', tmtGolongan: '2022-10-01', tmtJabatan: '2023-06-01',
    diklat: ['Diklat Kearsipan Dasar'],
    predikat: 'Butuh Perbaikan', potkom: 54.0, tahunAsesmen: 2025, jenisAsesmen: 'Pengawas', kotakTarget: 2,
    riwayat: [
      ['Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Timur', 'JAB-KASUBBAG-TU-JATIM', '2023-06-01', null],
      ['Pengadministrasi Umum BP2JK Wilayah Jawa Timur', null, '2018-05-01', '2023-06-01'],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Negeri Malang', 'Pendidikan Teknik Bangunan', 2013, false]],
  },
  {
    nama: 'Gunawan Hidayat', nip: '198205062006041011', golongan: 'III/d', pangkat: 'Penata Tingkat I',
    pendidikan: 'S1_D4', sekolah: 'Universitas Mulawarman', bidangStudi: 'Teknik Sipil',
    jabatanKode: 'JAB-KASUBBAG-TU-JABAR', tmtGolongan: '2020-10-01', tmtJabatan: '2022-03-01',
    diklat: ['Diklat Kepemimpinan Pengawas'],
    predikat: 'Butuh Perbaikan', potkom: 47.0, tahunAsesmen: 2024, jenisAsesmen: 'Pengawas', kotakTarget: 2,
    riwayat: [
      ['Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Barat', 'JAB-KASUBBAG-TU-JABAR', '2022-03-01', null],
      ['Pengolah Data dan Informasi BP2JK Wilayah Kalimantan Timur', null, '2013-01-02', '2022-03-01'],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Mulawarman', 'Teknik Sipil', 2005, false]],
  },
  {
    nama: 'Novi Anggraeni', nip: '199206112016122010', golongan: 'III/a', pangkat: 'Penata Muda',
    pendidikan: 'S1_D4', sekolah: 'Universitas Negeri Makassar', bidangStudi: 'Administrasi Perkantoran',
    jabatanKode: 'JAB-PENGOLAH-DATA-SULSEL', tmtGolongan: '2020-04-01', tmtJabatan: '2020-04-01',
    diklat: ['Diklat Dasar Pengelolaan Data'],
    predikat: 'Butuh Perbaikan', potkom: 58.0, tahunAsesmen: 2025, jenisAsesmen: 'Pelaksana', kotakTarget: 2,
    riwayat: [
      ['Pengolah Data dan Informasi BP2JK Wilayah Sulawesi Selatan', 'JAB-PENGOLAH-DATA-SULSEL', '2020-04-01', null],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Negeri Makassar', 'Administrasi Perkantoran', 2015, false]],
  },
  {
    nama: 'Eko Prasetyo', nip: '198611052011011012', golongan: 'III/c', pangkat: 'Penata',
    pendidikan: 'S1_D4', sekolah: 'Universitas Jember', bidangStudi: 'Ekonomi Pembangunan',
    jabatanKode: 'JAB-PERENCANA-MUDA', tmtGolongan: '2021-10-01', tmtJabatan: '2022-11-01',
    diklat: ['Diklat Perencanaan dan Penganggaran'],
    predikat: 'Butuh Perbaikan', potkom: 51.0, tahunAsesmen: 2026, jenisAsesmen: 'JFT Muda', kotakTarget: 2,
    riwayat: [
      ['Perencana Ahli Muda, Bagian Program dan Evaluasi', 'JAB-PERENCANA-MUDA', '2022-11-01', null],
      ['Perencana Ahli Pertama, Bagian Program dan Evaluasi', null, '2017-01-03', '2022-11-01'],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Jember', 'Ekonomi Pembangunan', 2010, true]],
  },

  // ---- Kotak 1: Di Bawah Ekspektasi x Potensial Rendah ----
  {
    nama: 'Yuni Astuti', nip: '199308232017122011', golongan: 'III/a', pangkat: 'Penata Muda',
    pendidikan: 'S1_D4', sekolah: 'Universitas Negeri Surabaya', bidangStudi: 'Manajemen',
    jabatanKode: 'JAB-ARSIPARIS-PERTAMA', tmtGolongan: '2021-04-01', tmtJabatan: '2021-04-01',
    diklat: [],
    predikat: 'Kurang', potkom: 44.0, tahunAsesmen: 2025, jenisAsesmen: 'JFT Pertama', kotakTarget: 1,
    riwayat: [
      ['Arsiparis Ahli Pertama, Bagian Kepegawaian dan Umum', 'JAB-ARSIPARIS-PERTAMA', '2021-04-01', null],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Negeri Surabaya', 'Manajemen', 2016, false]],
  },
  {
    nama: 'Rudi Hartono', nip: '198512142010011013', golongan: 'III/b', pangkat: 'Penata Muda Tingkat I',
    pendidikan: 'SLTA', sekolah: 'SMK Negeri 2 Palembang', bidangStudi: 'Teknik Bangunan',
    jabatanKode: 'JAB-KASI-STANDAR', tmtGolongan: '2021-04-01', tmtJabatan: '2024-06-03',
    diklat: [],
    predikat: 'Sangat Kurang', potkom: 38.0, tahunAsesmen: 2024, jenisAsesmen: 'Pengawas', kotakTarget: 1,
    riwayat: [
      ['Kepala Seksi Penyusunan Standar Kompetensi, Subdirektorat Standar dan Materi Kompetensi', 'JAB-KASI-STANDAR', '2024-06-03', null],
      ['Pengadministrasi Umum Direktorat Bina Kompetensi dan Produktivitas Konstruksi', null, '2014-01-02', '2024-06-03'],
    ],
    pendidikanRiwayat: [['SLTA', 'SMK Negeri 2 Palembang', 'Teknik Bangunan', 2004, false]],
  },
  {
    nama: 'Citra Ayu Lestari', nip: '199410072018122012', golongan: 'III/a', pangkat: 'Penata Muda',
    pendidikan: 'S1_D4', sekolah: 'Universitas Udayana', bidangStudi: 'Teknik Sipil',
    jabatanKode: 'JAB-PJK-MADYA-KSP', tmtGolongan: '2022-04-01', tmtJabatan: '2025-01-02',
    diklat: ['Diklat Dasar Jabatan Fungsional Pembina Jasa Konstruksi'],
    predikat: 'Kurang', potkom: 56.0, tahunAsesmen: 2026, jenisAsesmen: 'JFT Madya', kotakTarget: 1,
    riwayat: [
      ['Pembina Jasa Konstruksi Ahli Madya, Direktorat Kerja Sama dan Pemberdayaan', 'JAB-PJK-MADYA-KSP', '2025-01-02', null],
    ],
    pendidikanRiwayat: [['S1_D4', 'Universitas Udayana', 'Teknik Sipil', 2017, false]],
  },
]

/**
 * Asesmen tahun-tahun sebelumnya untuk sebagian pegawai (lama & baru), supaya
 * halaman "histori Kotak 9 per tahun" punya isi dan filter tahun asesmen tidak
 * memecah data jadi satu orang per tahun.
 */
const ASESMEN_TAMBAHAN: Array<{
  nip: string
  tahun: number
  jenis: string
  predikat: Predikat
  potkom: number
}> = [
  { nip: '197907292005021003', tahun: 2021, jenis: 'Administrator', predikat: 'Baik', potkom: 88.4 },   // Irwan
  { nip: '198405202009121008', tahun: 2023, jenis: 'Pengawas', predikat: 'Baik', potkom: 91.2 },        // Yatno
  { nip: '198503122010012002', tahun: 2022, jenis: 'Pengawas', predikat: 'Baik', potkom: 79.5 },        // Siti Rahayu
  { nip: '198006202006021003', tahun: 2022, jenis: 'Pengawas', predikat: 'Butuh Perbaikan', potkom: 74.0 }, // Ahmad Fauzi
  { nip: '198102142006041002', tahun: 2022, jenis: 'Pengawas', predikat: 'Baik', potkom: 80.0 },        // Agus Purnomo
  { nip: '198407252009122003', tahun: 2022, jenis: 'JFT Muda', predikat: 'Sangat Baik', potkom: 83.1 }, // Ratna Dewi Sari
]

// ---------------------------------------------------------------------------
// Uji mandiri generator — gagal keras kalau data tidak konsisten
// ---------------------------------------------------------------------------

const masalah: string[] = []
const nipTerlihat = new Set<string>()
const HARI_INI = new Date(2026, 6, 30, 12)

for (const p of PEGAWAI) {
  const nip = parseNip(p.nip, HARI_INI)
  if (!nip.valid) masalah.push(`${p.nama}: NIP tidak valid — ${nip.masalah.join('; ')}`)
  if (nipTerlihat.has(p.nip)) masalah.push(`${p.nama}: NIP duplikat ${p.nip}`)
  nipTerlihat.add(p.nip)

  const y = SKOR_PREDIKAT[p.predikat]
  const kotak = hitungKotak9(y, p.potkom, AMBANG_SUMBU, PARAMETER_SKORING_BAWAAN.bobotTalenta).kotak
  if (kotak !== p.kotakTarget) {
    masalah.push(
      `${p.nama}: predikat ${p.predikat} (Y=${y}) + potkom ${p.potkom} menghasilkan kotak ${kotak}, bukan ${p.kotakTarget}`,
    )
  }
  if (p.potkom < 0 || p.potkom > 100) masalah.push(`${p.nama}: potkom ${p.potkom} di luar 0–100`)
  if (p.riwayat.length === 0) masalah.push(`${p.nama}: tidak punya riwayat jabatan`)
  if (p.riwayat[0]![3] !== null) masalah.push(`${p.nama}: riwayat urutan 1 harus tanggal_akhir NULL`)
}

if (masalah.length > 0) {
  console.error('Generator dihentikan — data tidak konsisten:')
  for (const m of masalah) console.error(`  - ${m}`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Penyusun SQL
// ---------------------------------------------------------------------------

const q = (s: string | null): string => (s === null ? 'NULL' : `'${s.replace(/'/g, "''")}'`)

const NILAI_KINERJA: Record<Predikat, [number, number, number, number]> = {
  'Sangat Baik': [92, 94, 96, 97],
  Baik: [80, 82, 83, 85],
  'Butuh Perbaikan': [68, 70, 72, 74],
  Kurang: [52, 54, 55, 57],
  'Sangat Kurang': [38, 40, 41, 42],
}

const baris: string[] = []
const t = (s = '') => baris.push(s)

t('-- =====================================================================')
t('-- SIMT DJBK - 006 Seed Perluasan Data Dev')
t('--')
t('-- DIHASILKAN OLEH scripts/gen-006-seed-perluasan.ts — jangan diedit tangan.')
t('-- Regenerasi: npx tsx scripts/gen-006-seed-perluasan.ts')
t('--')
t('-- Tujuan (phase.md §4.2–4.3): membuat data dev cukup beragam untuk menguji')
t('-- SEMUA cabang logika & keadaan UI:')
t(`--   * pegawai 16 -> ${16 + PEGAWAI.length}, unit 17 -> ${17 + UNIT.length}, jabatan 16 -> ${16 + JABATAN.length}`)
t('--   * KESEMBILAN sel Kotak 9 terisi (sebelumnya hanya 3 sel)')
t('--   * riwayat jabatan BERTANGGAL -> indikator Lama Jabatan bisa otomatis')
t('--   * ada Plt & Plh -> sub-indikator Substansi Riwayat Jabatan teruji')
t('--   * kelima kategori hukuman disiplin terpakai')
t('--   * nominasi mencakup jalur DISETUJUI, DITOLAK, dan REVISI')
t('--   * log API punya kasus 401/403/429')
t('--')
t('-- URUTAN JALANKAN: 001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007')
t('-- =====================================================================')
t()
t('SET NAMES utf8mb4;')
t()

// -- Unit organisasi ---------------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 1. Unit organisasi tambahan')
t('-- ---------------------------------------------------------------------')
t('INSERT INTO unit_organisasi (id, kode_unit, nama_unit, parent_id, jenis, level_eselon) VALUES')
t(
  UNIT.map(
    (u, i) =>
      `  (${ID_UNIT_AWAL + i}, ${q(u.kode)}, ${q(u.nama)}, ${u.parentId}, '${u.jenis}', ${u.eselon ?? 'NULL'})`,
  ).join(',\n') + ';',
)
t()

// -- Jabatan ----------------------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 2. Jabatan tambahan')
t(`--    ${JABATAN.filter((j) => j.status === 'KOSONG').length} di antaranya berstatus KOSONG supaya widget`)
t('--    "Jabatan Kosong & Risiko Kekosongan" punya isi yang berarti')
t('-- ---------------------------------------------------------------------')
t(
  'INSERT INTO jabatan (id, kode_jabatan, nama_jabatan, unit_organisasi_id, jenis_jabatan, jenjang, eselon, status_jabatan) VALUES',
)
t(
  JABATAN.map(
    (j, i) =>
      `  (${ID_JABATAN_AWAL + i}, ${q(j.kode)}, ${q(j.nama)}, ${j.unitId}, '${j.jenis}', ${q(j.jenjang)}, '${j.eselon}', '${j.status}')`,
  ).join(',\n') + ';',
)
t()

// -- Pegawai ----------------------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 3. Pegawai tambahan')
t('--    NIP disusun valid (tanggal lahir + TMT CPNS + digit jenis kelamin)')
t('--    dan sudah diuji oleh lib/nip.ts di dalam generator.')
t('-- ---------------------------------------------------------------------')
t(
  'INSERT INTO pegawai (id, nip, nama_lengkap, golongan, tmt_golongan, pangkat, jabatan_id, tmt_jabatan, sekolah_terakhir, bidang_studi_terakhir, tingkat_pendidikan, status_aktif, sumber_sinkron, last_synced_at, riwayat_diklat) VALUES',
)
t(
  PEGAWAI.map((p, i) => {
    const id = ID_PEGAWAI_AWAL + i
    const diklat = JSON.stringify(p.diklat).replace(/'/g, "''")
    return `  (${id}, ${q(p.nip)}, ${q(p.nama)}, ${q(p.golongan)}, ${q(p.tmtGolongan)}, ${q(p.pangkat)}, ${idJabatan(p.jabatanKode)}, ${q(p.tmtJabatan)}, ${q(p.sekolah)}, ${q(p.bidangStudi)}, '${p.pendidikan}', 'AKTIF', 'eHRM', '2026-07-20 08:04:00', '${diklat}')`
  }).join(',\n') + ';',
)
t()

// -- Riwayat jabatan --------------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 4. Riwayat jabatan pegawai baru — BERTANGGAL')
t('--    jabatan_id NULL = jabatan di luar master DJBK (dipakai indikator')
t('--    Keragaman Riwayat Jabatan, lihat lib/penilaian.ts)')
t('-- ---------------------------------------------------------------------')
const barisRiwayat: string[] = []
PEGAWAI.forEach((p, i) => {
  const pegawaiId = ID_PEGAWAI_AWAL + i
  p.riwayat.forEach(([teks, kode, mulai, akhir], k) => {
    const jabatanId = kode === null ? 'NULL' : String(idJabatan(kode))
    const noSk = `SK-${mulai.slice(0, 4)}/DJBK/${String(pegawaiId).padStart(3, '0')}-${k + 1}`
    barisRiwayat.push(
      `  (${pegawaiId}, ${k + 1}, ${q(teks)}, ${jabatanId}, ${q(mulai)}, ${akhir === null ? 'NULL' : q(akhir)}, ${q(noSk)})`,
    )
  })
})
t(
  'INSERT INTO riwayat_jabatan (pegawai_id, urutan, jabatan_nama_mentah, jabatan_id, tanggal_mulai, tanggal_akhir, no_sk) VALUES',
)
t(barisRiwayat.join(',\n') + ';')
t()

// -- Riwayat pendidikan ----------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 5. Riwayat pendidikan pegawai baru')
t('--    Arsip (ijazah/pertek BKN) sengaja hanya terisi SEBAGIAN supaya UI')
t('--    teruji di dua keadaan: ada arsip dan belum ada arsip.')
t('-- ---------------------------------------------------------------------')
const barisPendidikan: string[] = []
PEGAWAI.forEach((p, i) => {
  const pegawaiId = ID_PEGAWAI_AWAL + i
  p.pendidikanRiwayat.forEach(([jenjang, sekolah, bidang, tahun, adaArsip], k) => {
    const ijazah = adaArsip ? q(`/arsip/ijazah/${p.nip}-${k + 1}.pdf`) : 'NULL'
    const transkrip = adaArsip ? q(`/arsip/transkrip/${p.nip}-${k + 1}.pdf`) : 'NULL'
    const pertek = adaArsip ? q(`PERTEK/BKN/${tahun ?? 2020}/${String(pegawaiId).padStart(4, '0')}`) : 'NULL'
    barisPendidikan.push(
      `  (${pegawaiId}, ${k + 1}, '${jenjang}', ${q(bidang)}, ${q(sekolah)}, ${tahun ?? 'NULL'}, ${ijazah}, ${transkrip}, ${pertek})`,
    )
  })
})
t(
  'INSERT INTO riwayat_pendidikan (pegawai_id, urutan, jenjang_pendidikan, bidang_studi, nama_sekolah, tahun_lulus, url_ijazah, url_transkrip, no_pertek_bkn) VALUES',
)
t(barisPendidikan.join(',\n') + ';')
t()

// -- Kinerja periode -------------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 6. Kinerja per triwulan pegawai baru (TW1..TAHUNAN lengkap)')
t('--    Nilai numerik dibuat konsisten dengan predikatnya. Untuk grafik tren')
t('--    dipakai kolom nilai_kinerja ini (granular), BUKAN nilai_kinerja_y')
t('--    yang hanya punya 5 nilai diskrit (phase.md §3 K-1).')
t('-- ---------------------------------------------------------------------')
const barisKinerja: string[] = []
PEGAWAI.forEach((p, i) => {
  const pegawaiId = ID_PEGAWAI_AWAL + i
  const nilai = NILAI_KINERJA[p.predikat]
  const periode = ['TW1', 'TW2', 'TW3', 'TAHUNAN'] as const
  periode.forEach((per, k) => {
    barisKinerja.push(
      `  (${pegawaiId}, 2025, '${per}', ${nilai[k]!.toFixed(2)}, ${(nilai[k]! + 1).toFixed(2)}, ${q(p.predikat)}, 'eKinerja', '2026-01-15 09:00:00')`,
    )
  })
})
t(
  "INSERT INTO kinerja_periode (pegawai_id, tahun, periode_skp, nilai_kinerja, nilai_perilaku, predikat, sumber_sync, synced_at) VALUES",
)
t(barisKinerja.join(',\n') + ';')
t()

// -- Asesmen talenta -------------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 7. Asesmen talenta pegawai baru')
t('--    kotak_9 & status_asesmen DIHITUNG lib/scoring di dalam generator —')
t('--    bukan placeholder — supaya laporan "selisih kotak_9 vs sumber" di 007')
t('--    hanya menunjukkan selisih NYATA (kasus Tasya & Tina dari data contoh),')
t('--    bukan selisih palsu buatan seed sendiri.')
t('--    nilai_kinerja_y / nilai_potensial_x / nilai_talenta / nilai_integritas')
t('--    diisi 0 dulu (kolomnya NOT NULL) dan dihitung ulang di 007.')
t('-- ---------------------------------------------------------------------')
t(
  'INSERT INTO asesmen_talenta (pegawai_id, tahun_asesmen, jenis_asesmen, status_asesmen, nilai_kinerja_y, nilai_potensial_x, potkom, nilai_integritas, nilai_talenta, kotak_9, tahun_kinerja, rating_kinerja, sumber_sync) VALUES',
)
t(
  PEGAWAI.map((p, i) => {
    const pegawaiId = ID_PEGAWAI_AWAL + i
    return `  (${pegawaiId}, ${p.tahunAsesmen}, ${q(p.jenisAsesmen)}, '${statusSeed(p.tahunAsesmen)}', 0, 0, ${p.potkom.toFixed(2)}, 0, 0, ${kotakSeed(p.predikat, p.potkom)}, 2025, ${q(p.predikat)}, 'eNominasi')`
  }).join(',\n') + ';',
)
t()

// -- Backfill data lama ----------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 8. Lengkapi data 16 pegawai lama')
t('-- ---------------------------------------------------------------------')
t()
t('-- 8a. Riwayat jabatan lama belum punya tanggal sama sekali (35/35 NULL),')
t('--     sehingga indikator Lama Jabatan tidak bisa dihitung. Tanggal di')
t('--     bawah SINTETIS: urutan 1 = jabatan sekarang (mulai = tmt_jabatan),')
t('--     urutan berikutnya blok 3 tahun ke belakang.')
t('UPDATE riwayat_jabatan r JOIN pegawai p ON p.id = r.pegawai_id')
t('SET r.tanggal_mulai = p.tmt_jabatan, r.tanggal_akhir = NULL')
t(`WHERE r.urutan = 1 AND r.pegawai_id < ${ID_PEGAWAI_AWAL} AND r.tanggal_mulai IS NULL;`)
t()
t('UPDATE riwayat_jabatan r JOIN pegawai p ON p.id = r.pegawai_id')
t('SET r.tanggal_mulai = DATE_SUB(p.tmt_jabatan, INTERVAL ((r.urutan - 1) * 3) YEAR),')
t('    r.tanggal_akhir = DATE_SUB(p.tmt_jabatan, INTERVAL ((r.urutan - 2) * 3) YEAR)')
t(`WHERE r.urutan > 1 AND r.pegawai_id < ${ID_PEGAWAI_AWAL} AND r.tanggal_mulai IS NULL;`)
t()
t('UPDATE riwayat_jabatan')
t("SET no_sk = CONCAT('SK-', YEAR(tanggal_mulai), '/DJBK/', LPAD(id, 4, '0'))")
t('WHERE no_sk IS NULL AND tanggal_mulai IS NOT NULL;')
t()
t('-- 8b. Petakan riwayat lama ke master jabatan yang baru tersedia, supaya')
t('--     indikator Keragaman Riwayat Jabatan tidak salah membaca "belum')
t('--     terpetakan" sebagai "pengalaman di luar DJBK".')
t('UPDATE riwayat_jabatan SET jabatan_id = (SELECT id FROM jabatan WHERE kode_jabatan = \'JAB-KABALAI-BP2JK-JABAR\')')
t("WHERE jabatan_id IS NULL AND jabatan_nama_mentah LIKE '%Pemilihan Jasa Konstruksi Wilayah Jawa Barat%';")
t()
t('UPDATE riwayat_jabatan SET jabatan_id = (SELECT id FROM jabatan WHERE kode_jabatan = \'JAB-KABALAI-BJKW-SBY\')')
t("WHERE jabatan_id IS NULL AND jabatan_nama_mentah LIKE '%Balai Jasa Konstruksi Wilayah IV Surabaya%';")
t()
t('UPDATE riwayat_jabatan SET jabatan_id = (SELECT id FROM jabatan WHERE kode_jabatan = \'JAB-KASUBBAG-TU-MALUT\')')
t("WHERE jabatan_id IS NULL AND jabatan_nama_mentah LIKE '%Subbagian Umum dan Tata Usaha%';")
t()
t('-- 8c. Triwulan yang belum ada untuk pegawai lama (banyak yang hanya punya')
t('--     TAHUNAN), supaya grafik tren kinerja tidak bolong.')
t('INSERT INTO kinerja_periode (pegawai_id, tahun, periode_skp, nilai_kinerja, nilai_perilaku, predikat, sumber_sync, synced_at)')
t('SELECT k.pegawai_id, k.tahun, p.periode,')
t('       ROUND(k.nilai_kinerja - p.selisih, 2), ROUND(k.nilai_perilaku - p.selisih, 2),')
t("       k.predikat, 'eKinerja', '2026-01-15 09:00:00'")
t('FROM kinerja_periode k')
t("JOIN (SELECT 'TW1' AS periode, 4 AS selisih UNION ALL SELECT 'TW2', 3 UNION ALL SELECT 'TW3', 1) p")
t("WHERE k.periode_skp = 'TAHUNAN'")
t(`  AND k.pegawai_id < ${ID_PEGAWAI_AWAL}`)
t('  AND NOT EXISTS (')
t('    SELECT 1 FROM kinerja_periode x')
t('    WHERE x.pegawai_id = k.pegawai_id AND x.tahun = k.tahun AND x.periode_skp = p.periode')
t('  );')
t()

// -- Hukuman disiplin ------------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 9. Hukuman disiplin — melengkapi kelima kategori rubrik §B.3')
t('--    Sebelumnya hanya ada Ringan (aktif) & Sedang (nonaktif).')
t('-- ---------------------------------------------------------------------')
t('INSERT INTO hukuman_disiplin (pegawai_id, tingkat_hukuman, tanggal_sk, no_sk, keterangan, status_aktif, input_by) VALUES')
t(
  [
    `  ((SELECT id FROM pegawai WHERE nip = '198512142010011013'), 'Berat', '2024-02-19', 'SK-HD/DJBK/2024/007', 'Pelanggaran ketentuan disiplin berat, penurunan jabatan setingkat lebih rendah selama 12 bulan', 1, 2)`,
    `  ((SELECT id FROM pegawai WHERE nip = '198707142012021010'), 'Sedang Menjalani', '2026-03-02', 'SK-HD/DJBK/2026/002', 'Sedang menjalani hukuman disiplin sedang, pemotongan tukin 25% selama 6 bulan', 1, 2)`,
    `  ((SELECT id FROM pegawai WHERE nip = '198503282011011005'), 'Ringan', '2025-09-11', 'SK-HD/DJBK/2025/014', 'Teguran tertulis atas keterlambatan penyampaian laporan kinerja triwulan', 1, 2)`,
    `  ((SELECT id FROM pegawai WHERE nip = '198205062006041011'), 'Sedang', '2019-06-04', 'SK-HD/DJBK/2019/003', 'Pelanggaran administrasi pengadaan, sanksi telah selesai dijalani', 0, 2)`,
  ].join(',\n') + ';',
)
t()

// -- Asesmen tahun tambahan ------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 10. Asesmen tahun sebelumnya untuk beberapa pegawai')
t('--     Supaya halaman "histori Kotak 9 per tahun" punya isi dan filter')
t('--     tahun asesmen tidak memecah data jadi satu orang per tahun.')
t('--     kotak_9 & status_asesmen dihitung lib/scoring di generator; nilai')
t('--     turunan lain tetap dihitung ulang di 007.')
t('-- ---------------------------------------------------------------------')
t(
  'INSERT INTO asesmen_talenta (pegawai_id, tahun_asesmen, jenis_asesmen, status_asesmen, nilai_kinerja_y, nilai_potensial_x, potkom, nilai_integritas, nilai_talenta, kotak_9, tahun_kinerja, rating_kinerja, sumber_sync) VALUES',
)
t(
  ASESMEN_TAMBAHAN.map(
    (a) =>
      `  ((SELECT id FROM pegawai WHERE nip = '${a.nip}'), ${a.tahun}, ${q(a.jenis)}, '${statusSeed(a.tahun)}', 0, 0, ${a.potkom.toFixed(2)}, 0, 0, ${kotakSeed(a.predikat, a.potkom)}, ${a.tahun}, ${q(a.predikat)}, 'eNominasi')`,
  ).join(',\n') + ';',
)
t()

// -- Nominasi jalur tolak & revisi ----------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 11. Nominasi jalur DITOLAK & REVISI')
t('--     Seed sebelumnya hanya punya jalur mulus, sehingga cabang UI')
t('--     penolakan/revisi tidak pernah teruji.')
t('--     talent_pool untuk kandidat ini dibuat di 007 (butuh match_score).')
t('-- ---------------------------------------------------------------------')
t()

// -- Log aktivitas API ----------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 12. Log aktivitas API dengan kasus anomali (401/403/429)')
t('--     Supaya halaman Log Aktivitas API punya yang perlu dideteksi.')
t('-- ---------------------------------------------------------------------')
t('INSERT INTO api_activity_log (api_client_id, api_token_id, endpoint, method, response_code, response_time_ms, ip_address, created_at) VALUES')
t(
  [
    `  (1, 1, '/api/v1/talent-pool', 'GET', 200, 142, '10.10.4.21', '2026-07-28 08:14:02')`,
    `  (1, 1, '/api/v1/pegawai', 'GET', 403, 18, '10.10.4.21', '2026-07-28 08:15:40')`,
    `  (1, 1, '/api/v1/kotak-9/summary', 'GET', 200, 96, '10.10.4.21', '2026-07-28 08:16:11')`,
    `  (2, 2, '/api/v1/pegawai', 'GET', 200, 318, '10.20.9.8', '2026-07-28 10:02:55')`,
    `  (2, 2, '/api/v1/pegawai/197805251998032005', 'GET', 200, 88, '10.20.9.8', '2026-07-28 10:03:20')`,
    `  (3, 3, '/api/v1/talent-pool', 'GET', 401, 9, '10.30.1.77', '2026-07-29 14:44:03')`,
    `  (3, 3, '/api/v1/talent-pool', 'GET', 401, 7, '10.30.1.77', '2026-07-29 14:44:09')`,
    `  (3, 3, '/api/v1/talent-pool', 'GET', 429, 5, '10.30.1.77', '2026-07-29 14:44:12')`,
    `  (1, 1, '/api/v1/talent-pool', 'GET', 429, 6, '10.10.4.21', '2026-07-29 16:20:44')`,
    `  (1, 1, '/api/v1/kotak-9/summary', 'GET', 500, 1204, '10.10.4.21', '2026-07-30 07:05:31')`,
  ].join(',\n') + ';',
)
t()

// -- Sync log -------------------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 13. Riwayat sinkronisasi tambahan (termasuk yang GAGAL)')
t('-- ---------------------------------------------------------------------')
t('INSERT INTO sync_log (sumber_sistem, jenis_data, status, jumlah_baris, mulai_pada, selesai_pada, catatan_error, dijalankan_oleh) VALUES')
t(
  [
    `  ('eHRM', 'Data biografis & riwayat pegawai', 'SUKSES', ${16 + PEGAWAI.length}, '2026-07-28 02:00:00', '2026-07-28 02:06:18', NULL, NULL)`,
    `  ('eNominasi', 'Hasil asesmen & Kotak 9', 'SEBAGIAN', 46, '2026-07-28 02:07:00', '2026-07-28 02:09:44', '6 baris ditolak: potkom di luar rentang 0-100 dan kotak_9 tidak sesuai hasil hitung — masuk Antrian Pembersihan Data', NULL)`,
    `  ('eKinerja', 'Rekap kinerja triwulan', 'SUKSES', 156, '2026-07-28 02:10:00', '2026-07-28 02:14:02', NULL, NULL)`,
    `  ('eHRM', 'Data biografis & riwayat pegawai', 'GAGAL', 0, '2026-07-29 02:00:00', '2026-07-29 02:00:37', 'Koneksi ke endpoint eHRM timeout setelah 30s (ETIMEDOUT)', NULL)`,
    `  ('Manual', 'Input data hukuman disiplin', 'SUKSES', 4, '2026-07-29 11:20:00', '2026-07-29 11:31:00', NULL, 2)`,
  ].join(',\n') + ';',
)
t()

// -- AUTO_INCREMENT -------------------------------------------------------
t('-- ---------------------------------------------------------------------')
t('-- 14. Setel ulang AUTO_INCREMENT')
t('-- ---------------------------------------------------------------------')
t(`ALTER TABLE unit_organisasi AUTO_INCREMENT = ${ID_UNIT_AWAL + UNIT.length};`)
t(`ALTER TABLE jabatan         AUTO_INCREMENT = ${ID_JABATAN_AWAL + JABATAN.length};`)
t(`ALTER TABLE pegawai         AUTO_INCREMENT = ${ID_PEGAWAI_AWAL + PEGAWAI.length};`)
t()

writeFileSync(BERKAS, baris.join('\n') + '\n', 'utf8')

// Ringkasan sebaran untuk dibaca manusia
const sebaran = new Map<number, number>()
for (const p of PEGAWAI) sebaran.set(p.kotakTarget, (sebaran.get(p.kotakTarget) ?? 0) + 1)

console.log(`${BERKAS} ditulis.`)
console.log(`  unit    : +${UNIT.length}  -> ${17 + UNIT.length}`)
console.log(`  jabatan : +${JABATAN.length}  -> ${16 + JABATAN.length} (${JABATAN.filter((j) => j.status === 'KOSONG').length} baru berstatus KOSONG)`)
console.log(`  pegawai : +${PEGAWAI.length} -> ${16 + PEGAWAI.length}`)
console.log(`  riwayat jabatan   : +${barisRiwayat.length}`)
console.log(`  riwayat pendidikan: +${barisPendidikan.length}`)
console.log(`  kinerja periode   : +${barisKinerja.length}`)
console.log(
  `  sebaran kotak pegawai baru: ${[...sebaran.entries()].sort((a, b) => a[0] - b[0]).map(([k, n]) => `K${k}=${n}`).join(' ')}`,
)
