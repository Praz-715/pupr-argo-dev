import { Suspense } from 'react'

import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { Badge } from '@/components/ui/badge'
import { CatatanLingkup } from '@/components/ui/catatan-lingkup'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { wajibMasuk } from '@/lib/auth'
import { formatAngka, formatBobot, formatPersenNilai, formatSkor } from '@/lib/format'
import {
  AMBANG_GAP,
  ambilGapIndikator,
  ambilGapPerJenjang,
  ambilGapPerUnit,
  ambilOpsiLaporan,
  ambilRingkasGap,
  type BarisGapKelompok,
  type FilterLaporan,
} from '@/lib/kueri/laporan'
import { lingkupData, ringkasLingkup, tanpaAkses, unitWajib } from '@/lib/lingkup'
import { angkaPositif } from '@/lib/param'
import { punyaPeran } from '@/lib/peran'
import { FilterLaporanGap } from './_komponen/filter-gap'
import { TombolEkspor } from '../_komponen/tombol-ekspor'

export const metadata = { title: 'Laporan Gap Analysis' }

const PERAN_HALAMAN = ['Super Admin', 'Admin Talenta', 'Pimpinan'] as const

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Laporan Gap Analysis (PRD §6.8).
 *
 * Menjawab satu pertanyaan: **kompetensi apa yang paling perlu dikembangkan, dan
 * di mana.** Sumbernya `match_score_detail` — skor per indikator yang sudah
 * tersimpan sejak Fase 5, bukan hitungan baru. Kalau angka di sini pernah berbeda
 * dari halaman Kandidat, berarti salah satunya menghitung sendiri.
 *
 * **Yang sengaja TIDAK ada di sini: rincian per persyaratan jabatan target.**
 * PRD menyebutnya, tapi `match_score` hanya menyimpan `eligible` (satu boolean)
 * + teks catatan; hasil per persyaratan dihitung di memori lalu dibuang. Mengurai
 * teks catatan akan membuat angka laporan bergeser setiap kali pesannya
 * disunting — laporan yang begitu lebih buruk daripada laporan yang mengakui
 * batasnya. Alasan itu ditulis di halaman, bukan cuma di dokumen.
 */
export default async function GapAnalysisPage({ searchParams }: { searchParams: ParamHalaman }) {
  const sesi = await wajibMasuk('/laporan/gap-analysis')

  if (!punyaPeran(sesi.pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Laporan Gap Analysis"
        deskripsiHalaman="Kebutuhan pengembangan kompetensi per indikator, unit, dan jenjang."
        peranAnda={sesi.pengguna.peran}
        alasan={
          <>
            Laporan ini menyandingkan skor seluruh pegawai yang dinilai pada setiap indikator
            rubrik, jadi aksesnya dibatasi ke{' '}
            <strong className="font-medium text-text">Admin Talenta</strong> dan{' '}
            <strong className="font-medium text-text">Pimpinan</strong>.
          </>
        }
        catatan="Skor per pegawai tetap bisa dilihat di halaman Profil Talenta, sebatas yang boleh Anda akses."
      />
    )
  }

  const lingkup = lingkupData(sesi.pengguna)
  if (tanpaAkses(lingkup)) {
    return (
      <div className="space-y-5">
        <PageHeader judul="Laporan Gap Analysis" />
        <CatatanLingkup lingkup={lingkup} />
      </div>
    )
  }

  const p = await searchParams
  const opsi = await ambilOpsiLaporan()
  const filter: FilterLaporan = {
    jabatanTargetId: angkaPositif(p.target),
    unitId: angkaPositif(p.unit),
    unitWajib: unitWajib(lingkup),
    jenjang: opsi.jenjang.find((j) => j === p.jenjang),
  }
  const kunci = `${filter.jabatanTargetId ?? ''}|${filter.unitId ?? ''}|${filter.jenjang ?? ''}`

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Laporan Gap Analysis"
        deskripsi={`Indikator dengan rata-rata terendah lebih dulu — itu yang paling perlu diintervensi. Ambang "perlu pengembangan": skor di bawah ${AMBANG_GAP}.`}
        aksi={<TombolEkspor jenis="gap-indikator" params={{ target: p.target, unit: p.unit, jenjang: p.jenjang }} />}
      />

      <CatatanLingkup lingkup={lingkup} />

      <Panel>
        <PanelHeader
          judul="Penyaring"
          deskripsi="Pilihan jabatan target, unit, dan jenjang diturunkan dari isi tabel — bukan daftar tetap."
        />
        <div className="mt-3.5">
          <FilterLaporanGap
            opsi={opsi}
            nilai={{ target: p.target ?? '', unit: p.unit ?? '', jenjang: p.jenjang ?? '' }}
          />
        </div>
      </Panel>

      <Suspense key={`r|${kunci}`} fallback={<RingkasSkeleton />}>
        <IsiRingkas filter={filter} />
      </Suspense>

      <Suspense key={`i|${kunci}`} fallback={<TabelSkeleton baris={10} />}>
        <IsiIndikator filter={filter} lingkupTeks={ringkasLingkup(lingkup)} />
      </Suspense>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Suspense key={`u|${kunci}`} fallback={<TabelSkeleton baris={8} />}>
          <IsiKelompok filter={filter} jenis="unit" />
        </Suspense>
        <Suspense key={`j|${kunci}`} fallback={<TabelSkeleton baris={8} />}>
          <IsiKelompok filter={filter} jenis="jenjang" />
        </Suspense>
      </div>

      <Panel>
        <PanelHeader
          judul="Yang belum tercakup laporan ini"
          deskripsi="Ditulis di sini supaya tidak disimpulkan sebagai nol."
        />
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-text-muted">
          <strong className="font-medium text-text">Rincian per persyaratan jabatan target</strong>{' '}
          (mis. &ldquo;berapa kandidat gagal syarat pendidikan minimal&rdquo;) belum bisa
          ditampilkan. Yang tersimpan di <code className="text-[12px]">match_score</code> hanyalah
          satu penanda lolos/tidak beserta catatan berbentuk teks; hasil pemeriksaan{' '}
          <em>per syarat</em> dihitung saat penilaian lalu dibuang. Menghitungnya dari teks catatan
          akan membuat angka laporan bergeser setiap kali kalimatnya disunting, dan menghitungnya
          ulang di sini menuntut pembacaan seluruh riwayat setiap pegawai — yang memang hanya boleh
          dilakukan Hitung Ulang &amp; Simulasi. Menampilkannya perlu tambahan kolom/tabel, jadi itu
          keputusan skema.
        </p>
      </Panel>
    </div>
  )
}

async function IsiRingkas({ filter }: { filter: FilterLaporan }) {
  const r = await ambilRingkasGap(filter)
  const persenEligible = r.jumlahDinilai === 0 ? 0 : (r.jumlahEligible / r.jumlahDinilai) * 100

  const kartu = [
    {
      label: 'Penilaian tercakup',
      nilai: formatAngka(r.jumlahDinilai),
      penyebut: `${formatAngka(r.jumlahJabatanTarget)} jabatan target · satu baris = satu pegawai × satu target`,
    },
    {
      label: 'Lolos syarat',
      nilai: formatAngka(r.jumlahEligible),
      penyebut: `${formatPersenNilai(persenEligible)} dari penilaian yang tercakup`,
    },
    {
      label: `Skor indikator di bawah ${AMBANG_GAP}`,
      nilai: formatAngka(r.jumlahIndikatorDiBawahAmbang),
      penyebut: 'jumlah sel indikator, bukan jumlah pegawai — satu orang bisa punya beberapa',
    },
    {
      label: 'Nilai diisi manusia',
      nilai: formatAngka(r.jumlahNilaiManual),
      penyebut: 'indikator tanpa sumber otomatis; angkanya sebaik penilaian pengisinya',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kartu.map((k) => (
        <Panel key={k.label}>
          <p className="text-[11px] font-medium uppercase tracking-wide text-text-subtle">
            {k.label}
          </p>
          <p className="mt-1 text-2xl font-semibold tabular-nums text-text">{k.nilai}</p>
          <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{k.penyebut}</p>
        </Panel>
      ))}
    </div>
  )
}

async function IsiIndikator({
  filter,
  lingkupTeks,
}: {
  filter: FilterLaporan
  lingkupTeks: string | null
}) {
  const baris = await ambilGapIndikator(filter)

  if (baris.length === 0) {
    return (
      <Panel>
        <PanelHeader judul="Gap per indikator" />
        <EmptyState
          judul="Belum ada skor yang bisa dianalisis"
          deskripsi="Gap dihitung dari rincian skor per indikator. Jalankan Hitung Ulang pada jabatan target lebih dulu — tanpa itu tidak ada rincian yang tersimpan."
        />
      </Panel>
    )
  }

  return (
    <Panel>
      <PanelHeader
        judul="Gap per indikator"
        deskripsi={`${formatAngka(baris.length)} indikator daun, diurutkan dari rata-rata terendah. Indikator induk (agregator) tidak dihitung — memasukkannya berarti menghitung anaknya dua kali.${lingkupTeks ? ` ${lingkupTeks}` : ''}`}
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[56rem] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-subtle">
              <th className="px-2 py-2 font-medium">Jabatan target</th>
              <th className="px-2 py-2 font-medium">Komponen</th>
              <th className="px-2 py-2 font-medium">Indikator</th>
              <th className="px-2 py-2 text-right font-medium">Bobot</th>
              <th className="px-2 py-2 text-right font-medium">Rata-rata</th>
              <th className="px-2 py-2 text-right font-medium">Terendah</th>
              <th className="px-2 py-2 text-right font-medium">
                Di bawah {AMBANG_GAP}
              </th>
              <th className="px-2 py-2 text-right font-medium">Manual</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => {
              const persen = b.jumlahDinilai === 0 ? 0 : (b.jumlahDiBawahAmbang / b.jumlahDinilai) * 100
              return (
                <tr
                  key={`${b.jabatanTargetId}-${b.indikatorId}`}
                  className="border-b border-border-subtle last:border-0"
                >
                  <td className="px-2 py-2 text-text-muted">{b.namaTarget}</td>
                  <td className="px-2 py-2 text-text-muted">{b.namaKomponen}</td>
                  <td className="px-2 py-2 font-medium text-text">{b.namaIndikator}</td>
                  <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                    {b.bobot === null ? 'sama rata' : formatBobot(b.bobot)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    <Badge tone={b.rataSkor < AMBANG_GAP ? 'bahaya' : b.rataSkor < 80 ? 'peringatan' : 'sukses'}>
                      {formatSkor(b.rataSkor)}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                    {formatSkor(b.skorTerendah)}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-text">
                    {formatAngka(b.jumlahDiBawahAmbang)}
                    <span className="ml-1 text-[11px] text-text-subtle">
                      ({formatPersenNilai(persen)})
                    </span>
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                    {b.jumlahManual === 0 ? '—' : formatAngka(b.jumlahManual)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

async function IsiKelompok({
  filter,
  jenis,
}: {
  filter: FilterLaporan
  jenis: 'unit' | 'jenjang'
}) {
  const baris: BarisGapKelompok[] =
    jenis === 'unit' ? await ambilGapPerUnit(filter) : await ambilGapPerJenjang(filter)

  const judul = jenis === 'unit' ? 'Rollup per unit organisasi' : 'Rollup per jenjang jabatan'
  const kolom = jenis === 'unit' ? 'Unit' : 'Jenjang'

  if (baris.length === 0) {
    return (
      <Panel>
        <PanelHeader judul={judul} />
        <EmptyState judul="Belum ada data" deskripsi="Tidak ada penilaian yang cocok dengan penyaring." />
      </Panel>
    )
  }

  return (
    <Panel>
      <PanelHeader
        judul={judul}
        deskripsi="Diurutkan dari rata-rata skor total terendah. 65/20/15 ditampilkan terpisah supaya terlihat komponen mana yang menarik rata-ratanya ke bawah."
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-subtle">
              <th className="px-2 py-2 font-medium">{kolom}</th>
              <th className="px-2 py-2 text-right font-medium">Dinilai</th>
              <th className="px-2 py-2 text-right font-medium">Lolos</th>
              <th className="px-2 py-2 text-right font-medium">Total</th>
              <th className="px-2 py-2 text-right font-medium">Potkom</th>
              <th className="px-2 py-2 text-right font-medium">Kualif.</th>
              <th className="px-2 py-2 text-right font-medium">Integr.</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.label} className="border-b border-border-subtle last:border-0">
                <td className="px-2 py-2 font-medium text-text">{b.label}</td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                  {formatAngka(b.jumlahDinilai)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                  {formatAngka(b.jumlahEligible)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums font-medium text-text">
                  {formatSkor(b.rataSkorTotal)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                  {formatSkor(b.rataPotensiKompetensi)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                  {formatSkor(b.rataKualifikasi)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                  {formatSkor(b.rataIntegritas)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

function RingkasSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[0, 1, 2, 3].map((i) => (
        <Panel key={i}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-full" />
        </Panel>
      ))}
    </div>
  )
}

function TabelSkeleton({ baris }: { baris: number }) {
  return (
    <Panel>
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-2 h-3 w-72" />
      <div className="mt-3">
        <TableSkeleton rows={baris} cols={['2fr', '1.5fr', '2fr', '1fr', '1fr', '1fr', '1fr', '1fr']} />
      </div>
    </Panel>
  )
}
