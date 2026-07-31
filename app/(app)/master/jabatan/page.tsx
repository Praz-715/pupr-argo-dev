import { Suspense } from 'react'

import { PageHeader } from '@/components/ui/panel'
import { TableSkeleton } from '@/components/ui/skeleton'
import {
  UKURAN_HALAMAN_JABATAN,
  ambilDaftarJabatan,
  ambilOpsiIndukUnit,
  ambilOpsiJabatan,
  type FilterJabatan,
} from '@/lib/kueri/master'
import { FilterMasterJabatan } from './_komponen/filter-jabatan'
import { TabelJabatan } from './_komponen/tabel-jabatan'

export const metadata = { title: 'Master Jabatan' }

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Master Jabatan (PRD §6.4) — Super Admin & Admin Talenta.
 *
 * Aturan penting yang ditegakkan server action: jabatan yang masih ditempati
 * pegawai aktif **tidak bisa** ditandai kosong. Widget dashboard dan halaman
 * Risiko Kekosongan keduanya membaca `status_jabatan`; kalau kolom itu boleh
 * berbohong, kedua halaman itu ikut berbohong.
 */
export default async function MasterJabatanPage({ searchParams }: { searchParams: ParamHalaman }) {
  const params = await searchParams
  const filter = bacaFilter(params)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Master Jabatan"
        deskripsi="Daftar jabatan definitif beserta unit, jenjang, dan status keterisiannya. Status kosong di sini yang mengisi halaman Risiko Kekosongan."
      />

      <Suspense key={JSON.stringify(filter)} fallback={<JabatanSkeleton />}>
        <IsiJabatan filter={filter} />
      </Suspense>
    </div>
  )
}

async function IsiJabatan({ filter }: { filter: FilterJabatan }) {
  const [hasil, opsi, opsiUnit] = await Promise.all([
    ambilDaftarJabatan(filter),
    ambilOpsiJabatan(),
    ambilOpsiIndukUnit(),
  ])

  const adaFilter = Boolean(
    filter.cari || filter.unitId || filter.eselon || filter.jenisJabatan || filter.status,
  )

  return (
    <div className="space-y-4">
      <FilterMasterJabatan opsi={opsi} opsiUnit={opsiUnit} total={hasil.total} />
      <TabelJabatan
        baris={hasil.baris}
        total={hasil.total}
        halaman={hasil.halaman}
        ukuranHalaman={hasil.ukuranHalaman}
        adaFilter={adaFilter}
        opsiUnit={opsiUnit}
      />
    </div>
  )
}

function bacaFilter(params: Record<string, string | undefined>): FilterJabatan {
  const angkaPositif = (n: string | undefined): number | undefined => {
    if (!n) return undefined
    const v = Number(n)
    return Number.isInteger(v) && v > 0 ? v : undefined
  }

  return {
    cari: params.cari?.slice(0, 100),
    unitId: angkaPositif(params.unit),
    eselon: ['I', 'II', 'III', 'IV', 'NON_ESELON'].includes(params.eselon ?? '')
      ? params.eselon
      : undefined,
    jenisJabatan: ['STRUKTURAL', 'FUNGSIONAL_TERTENTU', 'FUNGSIONAL_UMUM'].includes(
      params.jenis ?? '',
    )
      ? params.jenis
      : undefined,
    status: ['TERISI', 'KOSONG', 'DIHAPUS'].includes(params.status ?? '')
      ? params.status
      : undefined,
    halaman: angkaPositif(params.hal) ?? 1,
  }
}

function JabatanSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-8" />
      <TableSkeleton
        rows={UKURAN_HALAMAN_JABATAN}
        cols={['2.2fr', '2fr', '0.6fr', '1.2fr', '1.2fr', '0.9fr', '0.8fr', '1.4fr']}
      />
    </div>
  )
}
