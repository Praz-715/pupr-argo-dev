'use client'

import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import type { HasilAksi } from '@/lib/aksi/hasil'
import {
  simpanAsesmen,
  simpanDiklat,
  simpanKinerja,
  simpanPendidikan,
  simpanRiwayatJabatan,
  ubahIdentitas,
} from '@/lib/aksi/profil'
import { EditorBagian, type SpekBidang } from './editor-bagian'

/**
 * Tombol "Tambah"/"Ubah" untuk satu bagian profil.
 *
 * Satu komponen klien dipakai di **enam** bagian, dan pemakaiannya di komponen
 * server selalu satu baris. Yang menentukan bentuk dialognya cuma prop `jenis`;
 * daftar bidang & server action-nya diputuskan di sini, bukan di halaman — jadi
 * `page.tsx` tidak perlu tahu satu pun nama kolom.
 *
 * **Kenapa `baris` bertipe `Record<string, unknown>` yang longgar.** Nilai yang
 * masuk datang dari enam bentuk baris berbeda, dan komponen ini hanya
 * mengubahnya menjadi string untuk `<input>`. Menyempitkannya jadi union enam
 * interface berarti setiap perubahan kolom menyentuh berkas ini juga, tanpa
 * menambah jaminan apa pun: yang benar-benar memvalidasi ada di Zod, di server.
 */

const JENJANG = ['SLTA', 'D3', 'S1_D4', 'S2', 'S3'] as const
const STATUS_AKTIF = ['AKTIF', 'PENSIUN', 'MUTASI_KELUAR', 'NONAKTIF'] as const
const PREDIKAT = ['Sangat Baik', 'Baik', 'Butuh Perbaikan', 'Kurang', 'Sangat Kurang'] as const
const PERIODE = ['TW1', 'TW2', 'TW3', 'TAHUNAN'] as const
const PENUGASAN = ['DEFINITIF', 'PLT', 'PLH'] as const
const STATUS_ASESMEN = ['Berlaku', 'Expired', 'Draft'] as const

const pilihan = (nilai: readonly string[]) =>
  nilai.map((v) => ({ nilai: v, label: v.replace(/_/g, '/') }))

export type JenisEditor =
  | 'identitas'
  | 'pendidikan'
  | 'riwayatJabatan'
  | 'diklat'
  | 'kinerja'
  | 'asesmen'

/** Ubah nilai apa pun dari DB menjadi isi `<input>`. */
function teks(v: unknown): string {
  if (v === null || v === undefined) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  // Kolom `date` datang sebagai 'YYYY-MM-DD' atau ISO penuh; `<input type="date">`
  // hanya menerima yang pertama, dan menolak sisanya dengan diam — bidangnya
  // tampak kosong padahal datanya ada.
  const s = String(v)
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s
}

export function TombolEditor({
  jenis,
  pegawaiId,
  baris = null,
  pilihanJabatan = [],
  label,
}: {
  jenis: JenisEditor
  pegawaiId: number
  /** Baris yang diubah; `null` = tambah baru. */
  baris?: Record<string, unknown> | null
  /** Hanya untuk `identitas` & `riwayatJabatan`. */
  pilihanJabatan?: ReadonlyArray<{ id: number; label: string }>
  /** Teks tombol; bawaannya "Ubah"/"Tambah" menurut ada tidaknya `baris`. */
  label?: string
}) {
  const [buka, setBuka] = useState(false)
  const menambah = baris === null

  const opsiJabatan = pilihanJabatan.map((j) => ({ nilai: String(j.id), label: j.label }))

  const spek: Record<JenisEditor, { judul: string; deskripsi?: string; bidang: SpekBidang[] }> = {
    identitas: {
      judul: 'Ubah identitas & pendidikan terakhir',
      deskripsi:
        'NIP tidak bisa diubah di sini — tanggal lahir, usia, masa kerja, dan proyeksi pensiun semuanya diturunkan darinya.',
      bidang: [
        { jenis: 'teks', kunci: 'namaLengkap', label: 'Nama lengkap', wajib: true },
        { jenis: 'teks', kunci: 'golongan', label: 'Golongan', wajib: true, petunjuk: 'mis. III/c' },
        { jenis: 'teks', kunci: 'pangkat', label: 'Pangkat', wajib: true },
        { jenis: 'tanggal', kunci: 'tmtGolongan', label: 'TMT golongan' },
        { jenis: 'tanggal', kunci: 'tmtJabatan', label: 'TMT jabatan' },
        {
          jenis: 'pilih',
          kunci: 'jabatanId',
          label: 'Jabatan',
          opsi: opsiJabatan,
          bolehKosong: true,
          angka: true,
        },
        {
          jenis: 'pilih',
          kunci: 'tingkatPendidikan',
          label: 'Tingkat pendidikan',
          wajib: true,
          opsi: pilihan(JENJANG),
        },
        { jenis: 'teks', kunci: 'sekolahTerakhir', label: 'Sekolah/universitas terakhir' },
        { jenis: 'teks', kunci: 'bidangStudiTerakhir', label: 'Bidang studi terakhir' },
        {
          jenis: 'pilih',
          kunci: 'statusAktif',
          label: 'Status kepegawaian',
          wajib: true,
          opsi: pilihan(STATUS_AKTIF),
        },
      ],
    },
    pendidikan: {
      judul: menambah ? 'Tambah riwayat pendidikan' : 'Ubah riwayat pendidikan',
      bidang: [
        {
          jenis: 'pilih',
          kunci: 'jenjangPendidikan',
          label: 'Jenjang',
          wajib: true,
          opsi: pilihan(JENJANG),
        },
        { jenis: 'teks', kunci: 'bidangStudi', label: 'Bidang studi', wajib: true },
        { jenis: 'teks', kunci: 'namaSekolah', label: 'Nama sekolah/universitas' },
        { jenis: 'angka', kunci: 'tahunLulus', label: 'Tahun lulus' },
        { jenis: 'teks', kunci: 'noPertekBkn', label: 'No. pertek BKN' },
      ],
    },
    riwayatJabatan: {
      judul: menambah ? 'Tambah riwayat jabatan' : 'Ubah riwayat jabatan',
      deskripsi:
        'Menautkan ke jabatan master membuat baris ini terhitung dalam indikator Substansi Riwayat Jabatan.',
      bidang: [
        { jenis: 'teks', kunci: 'jabatanNamaMentah', label: 'Nama jabatan', wajib: true },
        {
          jenis: 'pilih',
          kunci: 'jabatanId',
          label: 'Tautkan ke jabatan master',
          opsi: opsiJabatan,
          bolehKosong: true,
          angka: true,
        },
        {
          jenis: 'pilih',
          kunci: 'jenisPenugasan',
          label: 'Jenis penugasan',
          opsi: pilihan(PENUGASAN),
          bolehKosong: true,
        },
        { jenis: 'teks', kunci: 'unitKerjaMentah', label: 'Unit kerja' },
        { jenis: 'tanggal', kunci: 'tanggalMulai', label: 'Tanggal mulai' },
        { jenis: 'tanggal', kunci: 'tanggalAkhir', label: 'Tanggal akhir' },
        { jenis: 'teks', kunci: 'noSk', label: 'Nomor SK' },
      ],
    },
    diklat: {
      judul: menambah ? 'Tambah riwayat diklat' : 'Ubah nama diklat',
      deskripsi:
        'Agar ikut dihitung dalam skor, kategori diklat ini perlu dipetakan di Validasi Riwayat.',
      bidang: [{ jenis: 'teks', kunci: 'nama', label: 'Nama diklat/sertifikasi', wajib: true }],
    },
    kinerja: {
      judul: menambah ? 'Tambah penilaian kinerja' : 'Ubah penilaian kinerja',
      bidang: [
        { jenis: 'angka', kunci: 'tahun', label: 'Tahun', wajib: true },
        { jenis: 'pilih', kunci: 'periodeSkp', label: 'Periode SKP', wajib: true, opsi: pilihan(PERIODE) },
        { jenis: 'angka', kunci: 'nilaiKinerja', label: 'Nilai kinerja', langkah: '0.01' },
        { jenis: 'angka', kunci: 'nilaiPerilaku', label: 'Nilai perilaku', langkah: '0.01' },
        { jenis: 'pilih', kunci: 'predikat', label: 'Predikat', wajib: true, opsi: pilihan(PREDIKAT) },
      ],
    },
    asesmen: {
      judul: menambah ? 'Tambah hasil asesmen' : 'Ubah hasil asesmen',
      deskripsi:
        'Kotak 9, nilai potensial, dan nilai talenta DIHITUNG dari isian ini — tidak diketik. Match score perlu Hitung Ulang setelahnya.',
      bidang: [
        { jenis: 'angka', kunci: 'tahunAsesmen', label: 'Tahun asesmen', wajib: true },
        { jenis: 'teks', kunci: 'jenisAsesmen', label: 'Jenis asesmen', wajib: true },
        {
          jenis: 'pilih',
          kunci: 'statusAsesmen',
          label: 'Status',
          wajib: true,
          opsi: pilihan(STATUS_ASESMEN),
        },
        {
          jenis: 'angka',
          kunci: 'nilaiKinerjaY',
          label: 'Nilai kinerja (Y)',
          wajib: true,
          langkah: '0.01',
        },
        {
          jenis: 'angka',
          kunci: 'potkom',
          label: 'Potkom',
          wajib: true,
          langkah: '0.01',
          petunjuk: 'sumbu X dihitung dari sini',
        },
        { jenis: 'angka', kunci: 'nilaiIntegritas', label: 'Nilai integritas', langkah: '0.01' },
        { jenis: 'angka', kunci: 'tahunKinerja', label: 'Tahun kinerja' },
        {
          jenis: 'pilih',
          kunci: 'ratingKinerja',
          label: 'Predikat kinerja',
          wajib: true,
          opsi: pilihan(PREDIKAT),
        },
      ],
    },
  }

  const aksi: Record<JenisEditor, (m: unknown) => Promise<HasilAksi<unknown>>> = {
    identitas: ubahIdentitas,
    pendidikan: simpanPendidikan,
    riwayatJabatan: simpanRiwayatJabatan,
    diklat: simpanDiklat,
    kinerja: simpanKinerja,
    asesmen: simpanAsesmen,
  }

  const s = spek[jenis]
  const awal = Object.fromEntries(s.bidang.map((b) => [b.kunci, teks(baris?.[b.kunci])]))

  // `id` hanya dikirim untuk lima bagian ber-baris; identitas memakai
  // `pegawaiId` sebagai kuncinya, dan diklat memakai `indeks` di dalam larik JSON.
  const tetap: Record<string, unknown> =
    jenis === 'identitas'
      ? { pegawaiId }
      : jenis === 'diklat'
        ? { pegawaiId, indeks: baris === null ? null : Number(baris.indeks) }
        : { pegawaiId, id: baris === null ? null : Number(baris.id) }

  return (
    <>
      <Button variant="halus" size="sm" onClick={() => setBuka(true)}>
        {menambah ? <Plus className="size-3.5" /> : <Pencil className="size-3.5" />}
        {label ?? (menambah ? 'Tambah' : 'Ubah')}
      </Button>
      {buka ? (
        <EditorBagian
          judul={s.judul}
          deskripsi={s.deskripsi}
          bidang={s.bidang}
          awal={awal}
          tetap={tetap}
          simpan={aksi[jenis]}
          onTutup={() => setBuka(false)}
        />
      ) : null}
    </>
  )
}
