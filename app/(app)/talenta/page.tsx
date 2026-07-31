import { Suspense } from 'react'

import { PageHeader } from '@/components/ui/panel'
import { TableSkeleton } from '@/components/ui/skeleton'
import {
  UKURAN_HALAMAN_DIREKTORI,
  ambilDirektori,
  ambilOpsiFilter,
  type FilterDirektori,
} from '@/lib/kueri/pegawai'
import { FilterDirektori as KontrolFilter } from './_komponen/filter-direktori'
import { TabelDirektori } from './_komponen/tabel-direktori'

export const metadata = { title: 'Direktori Pegawai' }

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Direktori Pegawai (PRD §6.3).
 *
 * Paginasi, pengurutan, dan penyaringan seluruhnya dikerjakan SQL — bukan
 * mengambil semua baris lalu difilter di klien (phase.md §3 K-5). Seluruh state
 * ada di query string sehingga hasil pencarian bisa dibagikan.
 */
export default async function DirektoriPage({ searchParams }: { searchParams: ParamHalaman }) {
  const params = await searchParams
  const filter = bacaFilter(params)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Direktori Pegawai"
        deskripsi="Daftar talenta ASN Direktorat Jenderal Bina Konstruksi. Klik satu baris untuk membuka profil talenta 360°."
      />

      <Suspense key={JSON.stringify(filter)} fallback={<DirektoriSkeleton />}>
        <IsiDirektori filter={filter} />
      </Suspense>
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
  const angkaPositif = (nilai: string | undefined): number | undefined => {
    if (!nilai) return undefined
    const n = Number(nilai)
    return Number.isInteger(n) && n > 0 ? n : undefined
  }

  const kotak = angkaPositif(params.kotak)

  return {
    cari: params.cari?.slice(0, 100),
    unitId: angkaPositif(params.unit),
    eselon: ['I', 'II', 'III', 'IV', 'NON_ESELON'].includes(params.eselon ?? '')
      ? params.eselon
      : undefined,
    jenjang: params.jenjang?.slice(0, 60),
    tingkatPendidikan: ['SLTA', 'D3', 'S1_D4', 'S2', 'S3'].includes(params.pendidikan ?? '')
      ? params.pendidikan
      : undefined,
    kotak9: kotak !== undefined && kotak <= 9 ? kotak : undefined,
    statusAsesmen: ['Berlaku', 'Expired', 'Draft', 'TANPA_ASESMEN'].includes(
      params.statusAsesmen ?? '',
    )
      ? params.statusAsesmen
      : undefined,
    urut: params.urut,
    // Dibiarkan undefined kalau tidak diminta → kueri memakai arah bawaan
    // kolomnya (nama A→Z, skor tertinggi dulu). Memaksa 'desc' di sini membuat
    // direktori terbuka dalam urutan Z→A.
    arah: params.arah === 'asc' ? 'asc' : params.arah === 'desc' ? 'desc' : undefined,
    halaman: angkaPositif(params.hal) ?? 1,
  }
}
