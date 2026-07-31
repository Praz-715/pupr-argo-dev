import { ArrowLeft, ListChecks, SlidersHorizontal, Users } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { gayaTombol } from '@/components/ui/button-style'
import { PageHeader, Panel } from '@/components/ui/panel'
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { formatAngka, formatTanggalWaktu } from '@/lib/format'
import {
  ambilAnggotaJabatan,
  ambilJabatanTarget,
  ambilPersyaratan,
  ambilPohonRubrik,
  ambilSumberDuplikasi,
  cariJabatanUntukTarget,
} from '@/lib/kueri/rubrik'
import { punyaPeran } from '@/lib/peran'
import { validasiRubrik } from '@/lib/scoring'
import { AksiStatus } from './_komponen/aksi-status'
import { PanelValidasi } from './_komponen/panel-validasi'
import { TabAnggota } from './_komponen/tab-anggota'
import { TabRubrik } from './_komponen/tab-rubrik'
import { TabSyarat } from './_komponen/tab-syarat'

type Params = Promise<{ id: string }>
type Cari = Promise<Record<string, string | undefined>>

const PERAN_UBAH = ['Super Admin', 'Admin Talenta'] as const

const TAB = [
  { kunci: 'anggota', label: 'Jabatan Anggota', ikon: Users },
  { kunci: 'syarat', label: 'Persyaratan', ikon: ListChecks },
  { kunci: 'rubrik', label: 'Rubrik Penilaian', ikon: SlidersHorizontal },
] as const

type KunciTab = (typeof TAB)[number]['kunci']

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  const target = await ambilJabatanTarget(Number(id))
  return { title: target === null ? 'Jabatan Target' : target.namaTarget }
}

/**
 * Editor Jabatan Target — tiga tab (PRD §6.5).
 *
 * Tab aktif ada di URL (`?tab=`), bukan di state klien: pengguna sering perlu
 * mengirim tautan ke tab tertentu ("bobotnya di sini yang perlu ditinjau"), dan
 * tombol back harus mengembalikan ke tab sebelumnya, bukan keluar dari halaman.
 *
 * Panel pemeriksaan rubrik tampil di ATAS tab, bukan di dalam tab Rubrik. Alasan:
 * yang memblokir aktivasi bukan hanya rubrik — jabatan anggota yang kosong juga —
 * dan temuan yang hanya terlihat setelah membuka tab tertentu akan terlewat.
 */
export default async function EditorJabatanTargetPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Cari
}) {
  const { id } = await params
  const idTarget = Number(id)
  if (!Number.isInteger(idTarget) || idTarget <= 0) notFound()

  const [target, pengguna] = await Promise.all([ambilJabatanTarget(idTarget), getCurrentUser()])
  if (target === null) notFound()

  const p = await searchParams
  const tab: KunciTab = TAB.some((t) => t.kunci === p.tab) ? (p.tab as KunciTab) : 'rubrik'
  const bolehUbah = punyaPeran(pengguna, PERAN_UBAH)
  const cariJabatan = (p.cariJabatan ?? '').slice(0, 80)

  return (
    <div className="space-y-5">
      <Link
        href="/jabatan-target"
        className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        Semua jabatan target
      </Link>

      <PageHeader
        judul={
          <span className="flex flex-wrap items-center gap-2.5">
            {target.namaTarget}
            <Badge
              tone={
                target.status === 'AKTIF'
                  ? 'sukses'
                  : target.status === 'DRAFT'
                    ? 'peringatan'
                    : 'netral'
              }
            >
              {target.status}
            </Badge>
          </span>
        }
        deskripsi={
          <>
            <span className="tabular">{target.kodeTarget}</span>
            {target.deskripsi ? ` · ${target.deskripsi}` : ''}
          </>
        }
        aksi={
          <>
            <Link
              href={`/jabatan-target/${idTarget}/simulasi`}
              className={cn(gayaTombol({ variant: 'sekunder', size: 'sm' }))}
            >
              Simulasi &amp; Diff
            </Link>
            <Link
              href={`/jabatan-target/${idTarget}/kandidat`}
              className={cn(gayaTombol({ variant: 'sekunder', size: 'sm' }))}
            >
              Kandidat ({formatAngka(target.jumlahEligible)})
            </Link>
            {bolehUbah ? <AksiStatus target={target} /> : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <RingkasKecil
          label="Jabatan anggota"
          nilai={formatAngka(target.jumlahAnggota)}
          catatan={target.jumlahAnggota === 0 ? 'wajib minimal 1 untuk aktivasi' : 'posisi yang dituju'}
          peringatan={target.jumlahAnggota === 0}
        />
        <RingkasKecil
          label="Persyaratan"
          nilai={formatAngka(target.jumlahPersyaratan)}
          catatan={
            target.jumlahPersyaratan === 0
              ? 'tanpa syarat, semua pegawai lolos'
              : 'penyaring kelayakan kandidat'
          }
          peringatan={target.jumlahPersyaratan === 0}
        />
        <RingkasKecil
          label="Rubrik"
          nilai={`${formatAngka(target.jumlahKomponen)} · ${formatAngka(target.jumlahIndikator)}`}
          catatan="komponen · indikator"
          peringatan={target.jumlahKomponen === 0}
        />
        <RingkasKecil
          label="Skor terakhir dihitung"
          nilai={
            target.dihitungPada === null ? 'belum' : formatTanggalWaktu(target.dihitungPada).slice(0, 10)
          }
          catatan={
            target.dihitungPada === null
              ? 'halaman kandidat masih kosong'
              : `${formatAngka(target.jumlahEligible)} dari ${formatAngka(target.jumlahDinilai)} lolos syarat`
          }
          peringatan={target.dihitungPada === null}
        />
      </div>

      <Suspense fallback={<Skeleton className="h-24 w-full rounded-lg" />}>
        <IsiValidasi idTarget={idTarget} jumlahAnggota={target.jumlahAnggota} />
      </Suspense>

      {/* Navigasi tab — tautan biasa, supaya bisa dibagikan & tombol back bekerja */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TAB.map((t) => {
          const aktif = t.kunci === tab
          const Ikon = t.ikon
          return (
            <Link
              key={t.kunci}
              href={`/jabatan-target/${idTarget}?tab=${t.kunci}`}
              scroll={false}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-[13px] transition-colors',
                aktif
                  ? 'border-accent font-medium text-text'
                  : 'border-transparent text-text-muted hover:text-text',
              )}
            >
              <Ikon className="size-3.5" />
              {t.label}
            </Link>
          )
        })}
      </div>

      <Suspense key={`${tab}|${cariJabatan}`} fallback={<ListSkeleton rows={5} />}>
        {tab === 'anggota' ? (
          <IsiTabAnggota idTarget={idTarget} bolehUbah={bolehUbah} cariJabatan={cariJabatan} />
        ) : tab === 'syarat' ? (
          <IsiTabSyarat idTarget={idTarget} bolehUbah={bolehUbah} />
        ) : (
          <IsiTabRubrik idTarget={idTarget} bolehUbah={bolehUbah} />
        )}
      </Suspense>
    </div>
  )
}

function RingkasKecil({
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
      <p className="tabular mt-1.5 text-lg leading-none font-semibold text-text">{nilai}</p>
      <p
        className={cn(
          'mt-1.5 text-[11px] leading-relaxed',
          peringatan ? 'text-warning' : 'text-text-subtle',
        )}
      >
        {catatan}
      </p>
    </Panel>
  )
}

async function IsiValidasi({
  idTarget,
  jumlahAnggota,
}: {
  idTarget: number
  jumlahAnggota: number
}) {
  const komponen = await ambilPohonRubrik(idTarget)
  const hasil = validasiRubrik(komponen, { untukJabatanTarget: true })
  return <PanelValidasi hasil={hasil} jumlahAnggota={jumlahAnggota} />
}

async function IsiTabAnggota({
  idTarget,
  bolehUbah,
  cariJabatan,
}: {
  idTarget: number
  bolehUbah: boolean
  cariJabatan: string
}) {
  const [anggota, tersedia] = await Promise.all([
    ambilAnggotaJabatan(idTarget),
    cariJabatanUntukTarget(idTarget, cariJabatan),
  ])
  return (
    <TabAnggota
      jabatanTargetId={idTarget}
      anggota={anggota}
      tersedia={tersedia}
      cari={cariJabatan}
      bolehUbah={bolehUbah}
    />
  )
}

async function IsiTabSyarat({ idTarget, bolehUbah }: { idTarget: number; bolehUbah: boolean }) {
  const syarat = await ambilPersyaratan(idTarget)
  return <TabSyarat jabatanTargetId={idTarget} syarat={syarat} bolehUbah={bolehUbah} />
}

async function IsiTabRubrik({ idTarget, bolehUbah }: { idTarget: number; bolehUbah: boolean }) {
  const [komponen, sumber] = await Promise.all([
    ambilPohonRubrik(idTarget),
    ambilSumberDuplikasi(idTarget),
  ])
  return (
    <TabRubrik
      jabatanTargetId={idTarget}
      komponen={komponen}
      sumberDuplikasi={sumber}
      bolehUbah={bolehUbah}
    />
  )
}
