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
import { lingkupData, tanpaAkses, unitWajib } from '@/lib/lingkup'
import { angkaPositif } from '@/lib/param'
import { PERAN_KELOLA_POOL } from '@/lib/peran'
import { aksiTersedia, type StatusPool } from '@/lib/workflow'
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
  /*
    Tanpa `?target=`, dahulukan jabatan target yang PUNYA pekerjaan menunggu.
    Mendarat di jabatan target yang antriannya kosong membuat kartu "Menunggu
    tindakan 0" terbaca sebagai nol secara keseluruhan, padahal itu nol untuk satu
    jabatan target saja.

    Penyeimbang kedua — jumlah entri pool — ditambahkan 24 Agu 2026. Sejak 41
    jabatan target per balai dibuat, SEMUA target punya `jumlahMenunggu` 0, jadi
    urutan bergantung sepenuhnya pada urutan kueri: halaman mendarat di target
    berpool KOSONG (#2), memajang tabel nihil, dan terbaca seperti talent pool yang
    tidak berisi apa-apa. Hanya 2 dari 72 target punya entri pool, jadi peluang
    mendarat di yang kosong nyaris pasti.
  */
  const targetAktif =
    opsiTarget.find((o) => o.id === targetDiminta) ??
    [...opsiTarget].sort(
      (a, b) => b.jumlahMenunggu - a.jumlahMenunggu || b.jumlahPool - a.jumlahPool,
    )[0] ??
    opsiTarget[0]

  const totalMenunggu = opsiTarget.reduce((n, o) => n + o.jumlahMenunggu, 0)

  const status = STATUS_SAH.find((s) => s === p.status)
  const cari = (p.cari ?? '').slice(0, 100)

  /*
    Lingkup unit penonton. Yang dibatasi di sini hanya DAFTAR CALON KANDIDAT — nama
    yang bisa ditambahkan ke pool — sebab `tambahKePool` menolak pegawai di luar
    unit penggunanya. Isi pool yang sudah ada TIDAK dibatasi: unit perlu melihat
    seluruh peringkat untuk tahu posisi kandidatnya, dan nominasi memang lintas
    unit.
  */
  const lingkup = lingkupData(pengguna)
  const batasUnit = tanpaAkses(lingkup) ? -1 : unitWajib(lingkup)

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
              unitWajibLingkup={batasUnit}
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
  unitWajibLingkup,
}: {
  jabatanTargetId: number
  namaTarget: string
  status: StatusPool | undefined
  cari: string
  peran: Parameters<typeof aksiTersedia>[1]
  unitPenggunaId: number | null
  /**
   * Batas unit untuk daftar CALON kandidat: `null` = lingkup penuh, `-1` = tidak
   * ada akses sama sekali (Pengelola Unit tanpa unit — FK-nya `ON DELETE SET NULL`,
   * jadi keadaan ini nyata). `-1` dipilih alih-alih membuang komponennya karena isi
   * pool tetap boleh dibaca; yang harus kosong hanya daftar tawarannya, dan id unit
   * negatif tidak akan pernah cocok.
   */
  unitWajibLingkup: number | null
}) {
  const [baris, ringkas, opsiUnit, kandidatLuar] = await Promise.all([
    ambilTalentPool({
      jabatanTargetId,
      ...(status === undefined ? {} : { status }),
      ...(cari === '' ? {} : { cari }),
    }),
    ambilRingkasPool(jabatanTargetId),
    ambilOpsiUnitPengaju(),
    ambilKandidatLuarPool(jabatanTargetId, unitWajibLingkup),
  ])

  /*
    Daftarnya `PERAN_KELOLA_POOL` di `lib/peran.ts` — satu daftar dengan yang dipakai
    `tambahKePool` untuk menolak. Pengelola Unit ikut sejak 24 Agu 2026; batas
    lingkupnya ditegakkan di dalam SQL (`pegawaiTerjangkau()`), bukan di sini.
  */
  const bolehTambah = peran !== null && PERAN_KELOLA_POOL.includes(peran)

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
    /*
      Boleh dikeluarkan kecuali sudah DITETAPKAN — syarat yang SAMA dengan yang
      ditegakkan `keluarkanDariPool()`. Menggambar tombolnya di baris yang pasti
      ditolak server berarti klik mati (phase.md §5.2); menyalin syaratnya ke sini
      bukan duplikasi aturan melainkan cerminnya, dan servernya tetap penegak
      terakhir.
    */
    bolehKeluar: bolehTambah && b.status !== 'DITETAPKAN',
  }))


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
          {/* Keempat sub-keterangan kartu DIHAPUS atas permintaan user
              (12 Agu 2026). Rinciannya tetap terbaca di kolom Status & Giliran
              tabel di bawah — yang hilang cuma pengulangannya di kartu. */}
        </Panel>
        <Panel>
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
            Menunggu tindakan
          </p>
          <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
            {formatAngka(ringkas.menungguTindakan)}
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
        </Panel>
        <Panel>
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
            Kandidat lolos syarat di luar pool
          </p>
          <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
            {formatAngka(kandidatLuar.total)}
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
          jabatanTargetId={jabatanTargetId}
          />
      </Panel>

      {bolehTambah && kandidatLuar.baris.length > 0 ? (
        <TambahKandidat
          jabatanTargetId={jabatanTargetId}
          kandidat={kandidatLuar.baris}
          totalKandidat={kandidatLuar.total}
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
