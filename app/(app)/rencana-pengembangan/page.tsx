import { Sprout } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel } from '@/components/ui/panel'
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import { formatAngka } from '@/lib/format'
import { ambilRencanaPengembangan, ambilSuksesorDitetapkan } from '@/lib/kueri/suksesi'
import { punyaPeran } from '@/lib/peran'
import { DaftarRencana } from './_komponen/daftar-rencana'

export const metadata = { title: 'Rencana Pengembangan' }

type Cari = Promise<Record<string, string | undefined>>

const PERAN_UBAH = ['Super Admin', 'Admin Talenta', 'Pimpinan'] as const

/**
 * Rencana Suksesi & Pengembangan (PRD §6.6, tahap 9 alur proses).
 *
 * Dikelompokkan **per suksesor**, bukan sebagai satu daftar rencana datar: yang
 * ditanyakan pimpinan adalah "apa rencana untuk orang ini", dan satu suksesor bisa
 * punya beberapa rencana yang hanya bermakna bersama-sama.
 *
 * Rencana hanya bisa dibuat untuk kandidat berstatus DITETAPKAN — menjanjikan
 * pengembangan kepada orang yang belum diputuskan akan menimbulkan harapan yang
 * belum tentu ditepati. Tapi rencana yang sudah ada **tidak** dihapus kalau
 * penetapannya dibatalkan; ia jadi riwayat, dan halaman ini menandainya.
 */
export default async function RencanaPengembanganPage({ searchParams }: { searchParams: Cari }) {
  const p = await searchParams
  const pengguna = await getCurrentUser()
  const poolTerpilih = Number(p.pool ?? 0) || null
  const bolehUbah = punyaPeran(pengguna, PERAN_UBAH)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Rencana Suksesi & Pengembangan"
        deskripsi="Rencana diklat, rotasi, mentoring, atau penugasan untuk suksesor yang sudah ditetapkan — beserta target waktu dan progresnya."
      />

      <Suspense fallback={<RencanaSkeleton />}>
        <IsiRencana poolTerpilih={poolTerpilih} bolehUbah={bolehUbah} />
      </Suspense>
    </div>
  )
}

async function IsiRencana({
  poolTerpilih,
  bolehUbah,
}: {
  poolTerpilih: number | null
  bolehUbah: boolean
}) {
  const [suksesor, semuaRencana] = await Promise.all([
    ambilSuksesorDitetapkan(),
    ambilRencanaPengembangan(),
  ])

  // Rencana milik entri pool yang penetapannya dibatalkan tetap ada — kelompokkan
  // terpisah supaya tidak hilang dari pandangan tanpa penjelasan.
  const idSuksesor = new Set(suksesor.map((s) => s.talentPoolId))
  const rencanaYatim = semuaRencana.filter((r) => !idSuksesor.has(r.talentPoolId))

  const berjalan = semuaRencana.filter((r) => r.status === 'BERJALAN').length
  const selesai = semuaRencana.filter((r) => r.status === 'SELESAI').length
  const terlewat = semuaRencana.filter(
    (r) => r.status !== 'SELESAI' && r.sisaHari !== null && r.sisaHari < 0,
  ).length

  if (suksesor.length === 0 && rencanaYatim.length === 0) {
    return (
      <EmptyState
        judul="Belum ada suksesor yang ditetapkan"
        deskripsi="Rencana pengembangan disusun untuk kandidat yang sudah ditetapkan sebagai suksesor. Selesaikan alur nominasi & penetapannya lebih dulu di Talent Pool."
        ikon={<Sprout className="size-5" />}
        aksi={
          <Link href="/talent-pool" className="text-[13px] text-accent hover:underline">
            Buka Talent Pool
          </Link>
        }
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KartuKecil
          label="Suksesor ditetapkan"
          nilai={formatAngka(suksesor.length)}
          catatan="sasaran rencana pengembangan"
        />
        <KartuKecil
          label="Rencana berjalan"
          nilai={formatAngka(berjalan)}
          catatan={`dari ${formatAngka(semuaRencana.length)} rencana`}
        />
        <KartuKecil
          label="Selesai"
          nilai={formatAngka(selesai)}
          catatan="tidak bisa dihapus — jadi rekam jejak"
        />
        <KartuKecil
          label="Target terlewat"
          nilai={formatAngka(terlewat)}
          catatan={terlewat === 0 ? 'semua masih dalam tenggat' : 'perlu ditindaklanjuti'}
          peringatan={terlewat > 0}
        />
      </div>

      <DaftarRencana
        suksesor={suksesor}
        rencana={semuaRencana}
        rencanaYatim={rencanaYatim}
        poolTerpilih={poolTerpilih}
        bolehUbah={bolehUbah}
      />
    </div>
  )
}

function KartuKecil({
  label,
  nilai,
  catatan,
  peringatan,
}: {
  label: string
  nilai: string
  catatan: string
  peringatan?: boolean
}) {
  return (
    <Panel>
      <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">{label}</p>
      <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">{nilai}</p>
      <p
        className={`mt-1.5 text-[11px] leading-relaxed ${peringatan === true ? 'text-warning' : 'text-text-subtle'}`}
      >
        {catatan}
      </p>
    </Panel>
  )
}

function RencanaSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Panel key={i}>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-7 w-10" />
            <Skeleton className="mt-2 h-3 w-full" />
          </Panel>
        ))}
      </div>
      <ListSkeleton rows={4} />
    </div>
  )
}
