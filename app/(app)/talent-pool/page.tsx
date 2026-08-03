import { ListOrdered, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import { formatAngka } from '@/lib/format'
import {
  ambilKandidatLuarPool,
  ambilOpsiTargetPool,
  ambilOpsiUnitPengaju,
  ambilRingkasPool,
  ambilTalentPool,
} from '@/lib/kueri/suksesi'
import { angkaPositif } from '@/lib/param'
import { aksiTersedia, LABEL_POOL, type StatusPool } from '@/lib/workflow'
import { PemilihTarget } from './_komponen/pemilih-target'
import { TabelPool } from './_komponen/tabel-pool'
import { TambahKandidat } from './_komponen/tambah-kandidat'

export const metadata = { title: 'Talent Pool' }

type Cari = Promise<Record<string, string | undefined>>

const STATUS_SAH: StatusPool[] = [
  'KANDIDAT',
  'DINOMINASIKAN',
  'DIVERIFIKASI',
  'DITETAPKAN',
  'DITOLAK',
]

/**
 * Talent Pool per Jabatan Target (PRD §6.6).
 *
 * Satu halaman dengan **pemilih jabatan target di URL** (`?target=`), bukan satu
 * route per target: daftar jabatan targetnya sendiri sudah ada di `/jabatan-target`,
 * jadi route indeks kedua hanya akan jadi klik tambahan menuju informasi yang sama.
 *
 * Kolom Kotak 9 & predikat kinerja tetap berdampingan dengan match score (K-4) —
 * ini halaman tempat orang benar-benar diurutkan, jadi justru di sini konteks
 * kinerja paling penting.
 */
export default async function TalentPoolPage({ searchParams }: { searchParams: Cari }) {
  const p = await searchParams
  const pengguna = await getCurrentUser()

  const opsiTarget = await ambilOpsiTargetPool()
  const targetDiminta = angkaPositif(p.target)
  // Tanpa `?target=`, dahulukan jabatan target yang PUNYA pekerjaan menunggu.
  // Mendarat di jabatan target yang antriannya kosong membuat kartu "Menunggu
  // tindakan 0" terbaca sebagai nol secara keseluruhan, padahal itu nol untuk
  // satu jabatan target saja.
  const targetAktif =
    opsiTarget.find((o) => o.id === targetDiminta) ??
    [...opsiTarget].sort((a, b) => b.jumlahMenunggu - a.jumlahMenunggu)[0] ??
    opsiTarget[0]

  const totalMenunggu = opsiTarget.reduce((n, o) => n + o.jumlahMenunggu, 0)

  const status = STATUS_SAH.find((s) => s === p.status)
  const cari = (p.cari ?? '').slice(0, 100)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Talent Pool"
        deskripsi="Daftar suksesi per jabatan target: siapa kandidatnya, sejauh mana ia dalam alur persetujuan, dan siapa yang harus bertindak berikutnya."
      />

      {targetAktif === undefined ? (
        <EmptyState
          judul="Belum ada jabatan target"
          deskripsi="Talent pool dibentuk per jabatan target. Buat jabatan targetnya lebih dulu, hitung skor kandidatnya, lalu masukkan kandidat ke daftar suksesi."
          ikon={<ListOrdered className="size-5" />}
        />
      ) : (
        <>
          <PemilihTarget opsi={opsiTarget} aktifId={targetAktif.id} status={status ?? null} />

          {/* Penyebut lintas jabatan target: angka per jabatan target di bawah
              tidak boleh terbaca sebagai keadaan keseluruhan. */}
          <p className="text-[11px] leading-relaxed text-text-subtle">
            Di seluruh {formatAngka(opsiTarget.length)} jabatan target:{' '}
            <strong className={totalMenunggu > 0 ? 'font-medium text-warning' : 'font-medium text-text'}>
              {formatAngka(totalMenunggu)} kandidat menunggu tindakan
            </strong>
            . Angka pada kartu di bawah hanya untuk jabatan target yang sedang dipilih.{' '}
            <Link href="/nominasi" className="text-accent hover:underline">
              Lihat antrian nominasi
            </Link>
          </p>

          <Suspense
            key={`${targetAktif.id}|${status ?? ''}|${cari}`}
            fallback={<PoolSkeleton />}
          >
            <IsiPool
              jabatanTargetId={targetAktif.id}
              namaTarget={targetAktif.nama}
              status={status}
              cari={cari}
              peran={pengguna?.peran ?? null}
              unitPenggunaId={pengguna?.unitOrganisasiId ?? null}
            />
          </Suspense>
        </>
      )}
    </div>
  )
}

async function IsiPool({
  jabatanTargetId,
  namaTarget,
  status,
  cari,
  peran,
  unitPenggunaId,
}: {
  jabatanTargetId: number
  namaTarget: string
  status: StatusPool | undefined
  cari: string
  peran: Parameters<typeof aksiTersedia>[1]
  unitPenggunaId: number | null
}) {
  const [baris, ringkas, opsiUnit, kandidatLuar] = await Promise.all([
    ambilTalentPool({
      jabatanTargetId,
      ...(status === undefined ? {} : { status }),
      ...(cari === '' ? {} : { cari }),
    }),
    ambilRingkasPool(jabatanTargetId),
    ambilOpsiUnitPengaju(),
    ambilKandidatLuarPool(jabatanTargetId),
  ])

  // Aksi dihitung DI SERVER dari state machine, lalu dikirim sebagai data.
  const barisDenganAksi = baris.map((b) => ({
    baris: b,
    opsiAksi: aksiTersedia({ statusPool: b.status, statusNominasi: b.statusNominasi }, peran).map(
      (d) => ({
        aksi: d.aksi,
        label: d.label,
        akibat: d.akibat,
        butuhCatatan: d.butuhCatatan,
        destruktif: d.destruktif,
      }),
    ),
  }))

  const bolehTambah = peran === 'Super Admin' || peran === 'Admin Talenta'

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
            Anggota pool
          </p>
          <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
            {formatAngka(ringkas.total)}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
            {ringkas.perStatus.map((s) => `${LABEL_POOL[s.status]} ${s.jumlah}`).join(' · ')}
          </p>
        </Panel>
        <Panel>
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
            Menunggu tindakan
          </p>
          <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
            {formatAngka(ringkas.menungguTindakan)}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
            {ringkas.menungguTindakan === 0
              ? 'Tidak ada yang tertahan di alur persetujuan.'
              : 'Ada di antrian salah satu pihak — lihat kolom Giliran.'}
          </p>
        </Panel>
        <Panel>
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
            Suksesor ditetapkan
          </p>
          <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
            {formatAngka(
              ringkas.perStatus.find((s) => s.status === 'DITETAPKAN')?.jumlah ?? 0,
            )}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
            <Link href="/rencana-pengembangan" className="text-accent hover:underline">
              Susun rencana pengembangannya
            </Link>
          </p>
        </Panel>
        <Panel>
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
            Kandidat lolos syarat di luar pool
          </p>
          <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
            {formatAngka(kandidatLuar.length)}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
            {kandidatLuar.length === 0
              ? 'Semua kandidat yang lolos syarat sudah masuk daftar.'
              : 'Bisa ditambahkan ke daftar suksesi.'}
          </p>
        </Panel>
      </div>

      {ringkas.tidakKonsisten > 0 ? (
        <div className="flex items-start gap-3 rounded-lg border border-danger-border bg-danger-subtle px-4 py-3">
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-[12px] leading-relaxed text-text-muted">
            <strong className="font-medium text-text">
              {ringkas.tidakKonsisten} entri berstatus tidak mungkin.
            </strong>{' '}
            Pasangan status kandidat × nominasi yang tidak bisa dihasilkan alur mana pun — biasanya
            akibat data yang diubah di luar aplikasi. Barisnya ditandai di tabel beserta
            penjelasannya.
          </p>
        </div>
      ) : null}

      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <PanelHeader
            judul={
              <span className="flex flex-wrap items-center gap-2">
                {namaTarget}
                <Badge tone="netral">{formatAngka(baris.length)} baris</Badge>
              </span>
            }
            deskripsi="Diurutkan menurut tahap suksesi (ditetapkan lebih dulu), lalu peringkat. Kolom Giliran menunjukkan siapa yang harus bertindak berikutnya."
          />
        </div>
        <TabelPool
          baris={barisDenganAksi}
          opsiUnit={opsiUnit}
          unitPenggunaId={unitPenggunaId}
        />
      </Panel>

      {bolehTambah && kandidatLuar.length > 0 ? (
        <TambahKandidat
          jabatanTargetId={jabatanTargetId}
          kandidat={kandidatLuar}
          namaTarget={namaTarget}
        />
      ) : null}

      <p className="text-[11px] leading-relaxed text-text-subtle">
        Match score <strong className="font-medium text-text-muted">tidak</strong> memuat unsur
        kinerja, jadi kolom Kotak 9 &amp; predikat kinerja ditampilkan berdampingan dengan skor —
        peringkat teratas bisa dihuni pegawai berpredikat rendah kalau Potkom-nya tinggi. Peringkat
        pool dihitung ulang setiap kali skor jabatan target dihitung ulang.
      </p>
    </div>
  )
}

function PoolSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Panel key={i}>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-7 w-12" />
            <Skeleton className="mt-2 h-3 w-full" />
          </Panel>
        ))}
      </div>
      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
        </div>
        <TableSkeleton rows={8} cols={['0.4fr', '2fr', '1fr', '0.8fr', '0.8fr', '1.2fr', '1.4fr']} />
      </Panel>
    </div>
  )
}
