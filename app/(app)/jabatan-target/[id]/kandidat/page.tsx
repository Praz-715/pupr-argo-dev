import { ArrowLeft, Users } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import { formatNip, formatTanggalWaktu } from '@/lib/format'
import {
  ambilJabatanTarget,
  ambilKandidat,
  ambilPohonRubrik,
  ambilRincianSkor,
} from '@/lib/kueri/rubrik'
import { angkaPositif } from '@/lib/param'
import { punyaPeran } from '@/lib/peran'
import { FilterKandidat } from './_komponen/filter-kandidat'
import { PanelRincian } from './_komponen/panel-rincian'
import { TabelKandidat } from './_komponen/tabel-kandidat'

type Params = Promise<{ id: string }>
type Cari = Promise<Record<string, string | undefined>>

const PERAN_UBAH = ['Super Admin', 'Admin Talenta'] as const
const UKURAN_HALAMAN = 25

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  // `generateMetadata` berjalan TERPISAH dari badan halaman, jadi penjagaan di
  // sana tidak melindunginya. `Number('abc')` = NaN, dan NaN sampai ke MySQL
  // sebagai `Unknown column 'NaN' in 'where clause'`. Galat metadata ditelan
  // Next — halamannya tetap tampil — sehingga ini hanya terlihat di log server.
  const idTarget = angkaPositif(id)
  const target = idTarget === undefined ? null : await ambilJabatanTarget(idTarget)
  return { title: target === null ? 'Kandidat' : `Kandidat — ${target.namaTarget}` }
}

/**
 * Kandidat & Eligibility Check (PRD §6.5).
 *
 * Kolom **Kotak 9 & predikat kinerja tampil sebelum match score**, bukan setelah:
 * match score sama sekali tidak memuat unsur kinerja (ketiga komponennya milik
 * sumbu potensial), jadi peringkat teratas bisa dihuni pegawai berpredikat rendah.
 * Menyandingkannya adalah syarat yang dikunci di phase.md §3 K-4 — bukan pilihan
 * tata letak.
 */
export default async function KandidatPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Cari
}) {
  const { id } = await params
  const idTarget = angkaPositif(id)
  if (idTarget === undefined) notFound()

  const [target, pengguna] = await Promise.all([ambilJabatanTarget(idTarget), getCurrentUser()])
  if (target === null) notFound()

  const p = await searchParams
  const filter = {
    hanyaEligible: p.eligible === '1',
    cari: (p.cari ?? '').slice(0, 100),
    urut: (['skorTotal', 'nama', 'kotak9', 'potkom'] as const).find((k) => k === p.urut),
    arah: p.arah === 'asc' ? ('asc' as const) : p.arah === 'desc' ? ('desc' as const) : undefined,
    halaman: Math.max(1, Number(p.hal ?? 1) || 1),
    ukuranHalaman: UKURAN_HALAMAN,
  }
  const rincianNip = (p.rincian ?? '').replace(/\D/g, '').slice(0, 18)
  const bolehUbah = punyaPeran(pengguna, PERAN_UBAH)

  return (
    <div className="space-y-5">
      <Link
        href={`/jabatan-target/${idTarget}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        Editor {target.namaTarget}
      </Link>

      <PageHeader
        judul="Kandidat & Eligibility Check"
        deskripsi={
          <>
            Skor menurut perhitungan terakhir{' '}
            {/* Keduanya `text-kepala-teks` — deskripsi ini di atas pita bergradien
                navy, dan token permukaan terang tidak terbaca di sana (`--text`
                terukur 1,72–2,61:1). Lihat catatan panjangnya di
                `app/(app)/inbox/page.tsx`.

                Cabang "belum pernah dijalankan" kehilangan `text-warning`, dan itu
                disengaja: `--warning` (#95650c) sama tidak terbacanya di atas navy.
                Emas PU bukan penggantinya — ia penanda identitas, dan memakainya
                sebagai warna peringatan membuatnya bertabrakan dengan `--warning`
                yang maknanya sudah tetap (CLAUDE.md §Desain UI/UX). Sinyal
                peringatannya tetap ada dua: kalimatnya menyebutkan keadaannya apa
                adanya, dan Badge status jabatan target ada di sisi kanan pita yang
                sama. */}
            {target.dihitungPada === null ? (
              <strong className="font-medium text-kepala-teks">
                yang belum pernah dijalankan
              </strong>
            ) : (
              <strong className="font-medium text-kepala-teks">
                {formatTanggalWaktu(target.dihitungPada)}
              </strong>
            )}
            . Kandidat yang tidak lolos syarat tetap dihitung skornya sebagai pembanding.
          </>
        }
        aksi={
          <Badge
            tone={target.status === 'AKTIF' ? 'sukses' : target.status === 'DRAFT' ? 'peringatan' : 'netral'}
          >
            {target.status}
          </Badge>
        }
      />

      {target.dihitungPada === null ? (
        <EmptyState
          judul="Belum ada skor untuk jabatan target ini"
          deskripsi="Jalankan Hitung Ulang dari halaman editor. Sebelum itu, daftar kandidat memang kosong — bukan karena tidak ada yang memenuhi syarat, tapi karena belum pernah dinilai."
          ikon={<Users className="size-5" />}
        />
      ) : (
        <>
          <Suspense fallback={<Skeleton className="h-9 w-full max-w-lg rounded-md" />}>
            <FilterKandidat
              total={target.jumlahDinilai}
              jumlahEligible={target.jumlahEligible}
            />
          </Suspense>

          <Suspense
            key={`${filter.cari}|${filter.hanyaEligible}|${filter.urut}|${filter.arah}|${filter.halaman}`}
            fallback={<TabelSkeletonKandidat />}
          >
            <IsiTabel idTarget={idTarget} filter={filter} />
          </Suspense>

          {rincianNip !== '' ? (
            <Suspense key={rincianNip} fallback={<Skeleton className="h-64 w-full rounded-lg" />}>
              <IsiRincian idTarget={idTarget} nip={rincianNip} bolehUbah={bolehUbah} />
            </Suspense>
          ) : null}
        </>
      )}
    </div>
  )
}

async function IsiTabel({
  idTarget,
  filter,
}: {
  idTarget: number
  filter: Parameters<typeof ambilKandidat>[1]
}) {
  const { baris, total } = await ambilKandidat(idTarget, filter)

  return (
    <TabelKandidat
      jabatanTargetId={idTarget}
      baris={baris}
      total={total}
      halaman={filter?.halaman ?? 1}
      ukuranHalaman={UKURAN_HALAMAN}
    />
  )
}

async function IsiRincian({
  idTarget,
  nip,
  bolehUbah,
}: {
  idTarget: number
  nip: string
  bolehUbah: boolean
}) {
  const { baris } = await ambilKandidat(idTarget, { cari: nip, ukuranHalaman: 1 })
  const kandidat = baris[0]

  if (kandidat === undefined) {
    return (
      <Panel id="rincian">
        <PanelHeader
          judul="Rincian perhitungan"
          deskripsi={`Tidak ada baris skor untuk NIP ${formatNip(nip)} pada jabatan target ini.`}
        />
      </Panel>
    )
  }

  const [rincian, komponen] = await Promise.all([
    ambilRincianSkor(idTarget, kandidat.pegawaiId),
    ambilPohonRubrik(idTarget),
  ])

  return (
    <PanelRincian
      jabatanTargetId={idTarget}
      kandidat={kandidat}
      rincian={rincian}
      komponen={komponen}
      bolehUbah={bolehUbah}
    />
  )
}

function TabelSkeletonKandidat() {
  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
      </div>
      <TableSkeleton
        rows={8}
        cols={['0.5fr', '2fr', '1.4fr', '1fr', '1fr', '0.9fr', '0.9fr', '0.9fr', '1fr']}
      />
    </Panel>
  )
}
