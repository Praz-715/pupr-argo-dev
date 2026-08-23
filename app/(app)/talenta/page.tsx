import { Suspense } from 'react'

import { CatatanLingkup } from '@/components/ui/catatan-lingkup'
import { PageHeader } from '@/components/ui/panel'
import { TableSkeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import {
  UKURAN_HALAMAN_DIREKTORI,
  ambilDirektori,
  ambilOpsiFilter,
  type FilterDirektori,
} from '@/lib/kueri/pegawai'
import { lingkupData, tanpaAkses, unitWajib } from '@/lib/lingkup'
import { angkaPositif, dariDaftar, nomorHalaman } from '@/lib/param'
import { ambilPilihanJabatan } from '@/lib/kueri/master'
import { punyaPeran } from '@/lib/peran'
import { FilterDirektori as KontrolFilter } from './_komponen/filter-direktori'
import { TombolTambahPegawai } from './_komponen/tombol-tambah-pegawai'
import { TabelDirektori } from './_komponen/tabel-direktori'

export const metadata = { title: 'Direktori Pegawai' }

type ParamHalaman = Promise<Record<string, string | undefined>>

/** Nilai yang diterima dari query string — cocok dengan ENUM-nya di DB. */
const ESELON = ['I', 'II', 'III', 'IV', 'NON_ESELON'] as const
const TINGKAT_PENDIDIKAN = ['SLTA', 'D3', 'S1_D4', 'S2', 'S3'] as const
const STATUS_ASESMEN = ['Berlaku', 'Expired', 'Draft', 'TANPA_ASESMEN'] as const

/**
 * Direktori Pegawai (PRD §6.3).
 *
 * Paginasi, pengurutan, dan penyaringan seluruhnya dikerjakan SQL — bukan
 * mengambil semua baris lalu difilter di klien (phase.md §3 K-5). Seluruh state
 * ada di query string sehingga hasil pencarian bisa dibagikan.
 */
export default async function DirektoriPage({ searchParams }: { searchParams: ParamHalaman }) {
  const params = await searchParams
  const lingkup = lingkupData(await getCurrentUser())

  // Batas unit ditempelkan ke filter DI SERVER, jadi ia ikut ke SQL dan tidak
  // bisa dihapus dari URL. Filter unit pilihan pengguna tetap dikirim apa
  // adanya — keduanya beririsan dengan sendirinya (lihat `lib/lingkup.ts`).
  const filter = { ...bacaFilter(params), unitWajib: unitWajib(lingkup) }

  const pengguna = await getCurrentUser()
  const bolehTambah = punyaPeran(pengguna, ['Super Admin', 'Admin Talenta', 'Pengelola Unit'])
  // Daftar jabatan hanya diambil kalau tombolnya memang tampil — halaman ini
  // dibuka jauh lebih sering oleh peran yang tidak boleh menambah pegawai, dan
  // mereka tidak perlu ikut membayar kuerinya.
  const opsiJabatan = bolehTambah ? await ambilPilihanJabatan() : []

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Direktori Pegawai"
        deskripsi="Daftar talenta ASN Direktorat Jenderal Bina Konstruksi. Klik satu baris untuk membuka profil talenta 360°."
        /*
          Tombol tambah hanya untuk peran yang boleh menulis pegawai (butir 9).
          Perannya sama dengan `PERAN_PROFIL` di `lib/aksi/profil.ts` — kalau
          tombolnya tampil untuk peran lain, satu-satunya yang mereka dapat
          adalah dialog yang ditolak server setelah semua isian diketik.
        */
        aksi={bolehTambah ? <TombolTambahPegawai opsiJabatan={opsiJabatan} /> : null}
      />

      <CatatanLingkup lingkup={lingkup} />

      {tanpaAkses(lingkup) ? null : (
        <Suspense key={JSON.stringify(filter)} fallback={<DirektoriSkeleton />}>
          <IsiDirektori filter={filter} />
        </Suspense>
      )}
    </div>
  )
}

async function IsiDirektori({ filter }: { filter: FilterDirektori }) {
  const [hasil, opsi] = await Promise.all([ambilDirektori(filter), ambilOpsiFilter()])

  const adaFilter = Boolean(
    filter.cari ||
      filter.unitId ||
      filter.eselon ||
      filter.jenjang ||
      filter.tingkatPendidikan ||
      filter.kotak9 ||
      filter.statusAsesmen,
  )

  return (
    <div className="space-y-4">
      <KontrolFilter opsi={opsi} total={hasil.total} />
      <TabelDirektori
        baris={hasil.baris}
        total={hasil.total}
        halaman={hasil.halaman}
        ukuranHalaman={hasil.ukuranHalaman}
        adaFilter={adaFilter}
      />
    </div>
  )
}

function DirektoriSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8" />
      <TableSkeleton
        rows={UKURAN_HALAMAN_DIREKTORI}
        cols={['2fr', '2.5fr', '0.7fr', '2fr', '1.2fr', '1.2fr', '1.2fr', '0.8fr', '0.8fr', '1.2fr', '0.6fr']}
      />
    </div>
  )
}

/** Validasi seluruh param di boundary — jangan percaya isi query string. */
function bacaFilter(params: Record<string, string | undefined>): FilterDirektori {
  const kotak = angkaPositif(params.kotak)

  return {
    cari: params.cari?.slice(0, 100),
    unitId: angkaPositif(params.unit),
    eselon: dariDaftar(params.eselon, ESELON),
    jenjang: params.jenjang?.slice(0, 60),
    tingkatPendidikan: dariDaftar(params.pendidikan, TINGKAT_PENDIDIKAN),
    kotak9: kotak !== undefined && kotak <= 9 ? kotak : undefined,
    statusAsesmen: dariDaftar(params.statusAsesmen, STATUS_ASESMEN),
    urut: params.urut,
    // Dibiarkan undefined kalau tidak diminta → kueri memakai arah bawaan
    // kolomnya (nama A→Z, skor tertinggi dulu). Memaksa 'desc' di sini membuat
    // direktori terbuka dalam urutan Z→A.
    arah: dariDaftar(params.arah, ['asc', 'desc'] as const),
    halaman: nomorHalaman(params.hal),
  }
}
