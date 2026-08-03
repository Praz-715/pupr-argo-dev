import { Suspense } from 'react'

import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { Badge } from '@/components/ui/badge'
import { CatatanLingkup } from '@/components/ui/catatan-lingkup'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { wajibMasuk } from '@/lib/auth'
import { formatAngka, formatBulanTahun, formatNip, formatTanggal } from '@/lib/format'
import {
  ambilNominasiRinci,
  ambilOpsiLaporan,
  ambilRekapPeriode,
  ambilRekapTahap,
  ambilRekapUnit,
  type FilterLaporan,
} from '@/lib/kueri/laporan'
import { lingkupData, tanpaAkses, unitWajib } from '@/lib/lingkup'
import { angkaPositif, tanggalIso } from '@/lib/param'
import { punyaPeran } from '@/lib/peran'
import { LABEL_NOMINASI, LABEL_POOL, NADA_POOL, type StatusNominasi, type StatusPool } from '@/lib/workflow'
import { TombolEkspor } from '../_komponen/tombol-ekspor'
import { FilterLaporanNominasi } from './_komponen/filter-nominasi-laporan'

export const metadata = { title: 'Laporan Nominasi & Approval' }

const PERAN_HALAMAN = ['Super Admin', 'Admin Talenta', 'Pimpinan'] as const

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Laporan Nominasi & Approval (PRD §6.8).
 *
 * Angka utamanya **waktu proses dalam hari**, bukan jumlah nominasi: PRD §2
 * menargetkan "waktu proses layanan kepegawaian berkurang ≥30%", dan target itu
 * tidak bisa dikejar tanpa alat ukurnya.
 *
 * Satu keputusan pengukuran yang menentukan apakah angkanya berguna: **nominasi
 * yang masih berjalan ikut dihitung**, diukur sampai hari ini. Kalau yang berjalan
 * dibuang dari rata-rata, angka "waktu layanan" justru **membaik** setiap kali ada
 * berkas yang menggantung lama — karena yang lama belum masuk hitungan sampai ia
 * selesai. Itu kebalikan dari yang dipantau.
 */
export default async function LaporanNominasiPage({
  searchParams,
}: {
  searchParams: ParamHalaman
}) {
  const sesi = await wajibMasuk('/laporan/nominasi')

  if (!punyaPeran(sesi.pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Laporan Nominasi & Approval"
        deskripsiHalaman="Rekap nominasi per periode, unit pengaju, dan tahap persetujuan."
        peranAnda={sesi.pengguna.peran}
        alasan={
          <>
            Laporan ini memuat rekap keputusan atas nama pegawai lintas unit, jadi aksesnya
            dibatasi ke <strong className="font-medium text-text">Admin Talenta</strong> dan{' '}
            <strong className="font-medium text-text">Pimpinan</strong>.
          </>
        }
        catatan="Nominasi yang menunggu tindakan Anda tetap ada di Inbox Tugas."
      />
    )
  }

  const lingkup = lingkupData(sesi.pengguna)
  if (tanpaAkses(lingkup)) {
    return (
      <div className="space-y-5">
        <PageHeader judul="Laporan Nominasi & Approval" />
        <CatatanLingkup lingkup={lingkup} />
      </div>
    )
  }

  const p = await searchParams
  const opsi = await ambilOpsiLaporan()
  const dari = tanggalIso(p.dari)
  const sampai = tanggalIso(p.sampai)
  const filter: FilterLaporan = {
    jabatanTargetId: angkaPositif(p.target),
    unitId: angkaPositif(p.unit),
    unitWajib: unitWajib(lingkup),
    dari,
    sampai,
  }
  const kunci = `${filter.jabatanTargetId ?? ''}|${filter.unitId ?? ''}|${dari ?? ''}|${sampai ?? ''}`

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Laporan Nominasi & Approval"
        deskripsi="Waktu proses diukur dari tanggal diajukan sampai keputusan terminal. Nominasi yang masih berjalan ikut dihitung sampai hari ini — kalau tidak, rata-ratanya justru membaik setiap kali ada berkas yang menggantung."
        aksi={
          <TombolEkspor
            jenis="nominasi"
            params={{ target: p.target, unit: p.unit, dari, sampai }}
            label="Unduh rinci (CSV)"
          />
        }
      />

      <CatatanLingkup lingkup={lingkup} />

      <Panel>
        <PanelHeader
          judul="Penyaring"
          deskripsi={
            opsi.rentang.paling_lama
              ? `Nominasi yang tercatat: ${formatTanggal(opsi.rentang.paling_lama)} – ${formatTanggal(opsi.rentang.paling_baru)}.`
              : 'Belum ada nominasi yang tercatat.'
          }
        />
        <div className="mt-3.5">
          <FilterLaporanNominasi
            opsi={opsi}
            nilai={{
              target: p.target ?? '',
              unit: p.unit ?? '',
              dari: dari ?? '',
              sampai: sampai ?? '',
            }}
          />
        </div>
      </Panel>

      <Suspense key={`p|${kunci}`} fallback={<TabelSkeleton baris={6} kolom={6} />}>
        <IsiPeriode filter={filter} params={p} />
      </Suspense>

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Suspense key={`u|${kunci}`} fallback={<TabelSkeleton baris={6} kolom={6} />}>
          <IsiUnit filter={filter} params={p} />
        </Suspense>
        <Suspense key={`t|${kunci}`} fallback={<TabelSkeleton baris={3} kolom={6} />}>
          <IsiTahap filter={filter} />
        </Suspense>
      </div>

      <Suspense key={`d|${kunci}`} fallback={<TabelSkeleton baris={10} kolom={8} />}>
        <IsiRinci filter={filter} />
      </Suspense>
    </div>
  )
}

async function IsiPeriode({
  filter,
  params,
}: {
  filter: FilterLaporan
  params: Record<string, string | undefined>
}) {
  const baris = await ambilRekapPeriode(filter)

  if (baris.length === 0) {
    return (
      <Panel>
        <PanelHeader judul="Rekap per periode" />
        <EmptyState
          judul="Belum ada nominasi pada rentang ini"
          deskripsi="Longgarkan rentang tanggal, atau periksa apakah nominasi memang sudah pernah diajukan."
        />
      </Panel>
    )
  }

  const total = baris.reduce((n, b) => n + b.jumlah, 0)
  const berjalan = baris.reduce((n, b) => n + b.berjalan, 0)

  return (
    <Panel>
      <PanelHeader
        judul="Rekap per periode"
        deskripsi={`${formatAngka(total)} nominasi · ${formatAngka(berjalan)} masih berjalan. Dikelompokkan menurut bulan pengajuan, terbaru dulu.`}
        aksi={
          <TombolEkspor
            jenis="rekap-periode"
            params={{ target: params.target, unit: params.unit, dari: params.dari, sampai: params.sampai }}
            label="CSV"
          />
        }
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[36rem] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-subtle">
              <th className="px-2 py-2 font-medium">Periode</th>
              <th className="px-2 py-2 text-right font-medium">Jumlah</th>
              <th className="px-2 py-2 text-right font-medium">Disetujui</th>
              <th className="px-2 py-2 text-right font-medium">Ditolak</th>
              <th className="px-2 py-2 text-right font-medium">Berjalan</th>
              <th className="px-2 py-2 text-right font-medium">Rata hari proses</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.periode} className="border-b border-border-subtle last:border-0">
                <td className="px-2 py-2 font-medium text-text">{labelPeriode(b.periode)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-text">{formatAngka(b.jumlah)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                  {formatAngka(b.disetujui)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                  {formatAngka(b.ditolak)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                  {b.berjalan === 0 ? '—' : formatAngka(b.berjalan)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {b.rataHariProses === null ? (
                    '—'
                  ) : (
                    <Badge tone={b.rataHariProses > 30 ? 'peringatan' : 'sukses'}>
                      {formatAngka(b.rataHariProses)} hari
                    </Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

async function IsiUnit({
  filter,
  params,
}: {
  filter: FilterLaporan
  params: Record<string, string | undefined>
}) {
  const baris = await ambilRekapUnit(filter)

  if (baris.length === 0) {
    return (
      <Panel>
        <PanelHeader judul="Rekap per unit pengaju" />
        <EmptyState judul="Belum ada data" deskripsi="Tidak ada nominasi yang cocok dengan penyaring." />
      </Panel>
    )
  }

  return (
    <Panel>
      <PanelHeader
        judul="Rekap per unit pengaju"
        deskripsi="Nominasi diajukan atas nama unit, bukan pribadi — jadi ini yang memperlihatkan unit mana yang aktif mengusulkan."
        aksi={
          <TombolEkspor
            jenis="rekap-unit"
            params={{ target: params.target, unit: params.unit, dari: params.dari, sampai: params.sampai }}
            label="CSV"
          />
        }
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[32rem] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-subtle">
              <th className="px-2 py-2 font-medium">Unit pengaju</th>
              <th className="px-2 py-2 text-right font-medium">Jumlah</th>
              <th className="px-2 py-2 text-right font-medium">Setuju</th>
              <th className="px-2 py-2 text-right font-medium">Tolak</th>
              <th className="px-2 py-2 text-right font-medium">Jalan</th>
              <th className="px-2 py-2 text-right font-medium">Rata hari</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={`${b.unitId ?? 'x'}`} className="border-b border-border-subtle last:border-0">
                <td className="px-2 py-2 font-medium text-text">{b.namaUnit}</td>
                <td className="px-2 py-2 text-right tabular-nums text-text">{formatAngka(b.jumlah)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">{formatAngka(b.disetujui)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">{formatAngka(b.ditolak)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                  {b.berjalan === 0 ? '—' : formatAngka(b.berjalan)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">
                  {b.rataHariProses === null ? '—' : formatAngka(b.rataHariProses)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

async function IsiTahap({ filter }: { filter: FilterLaporan }) {
  const baris = await ambilRekapTahap(filter)

  if (baris.length === 0) {
    return (
      <Panel>
        <PanelHeader judul="Sebaran keputusan per tahap" />
        <EmptyState judul="Belum ada jejak approval" deskripsi="Tahap tercatat begitu ada keputusan pertama." />
      </Panel>
    )
  }

  return (
    <Panel>
      <PanelHeader
        judul="Sebaran keputusan per tahap"
        deskripsi="Memperlihatkan di tahap mana berkas tertahan. Baris MENUNGGU adalah pekerjaan yang belum diputuskan siapa pun."
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[30rem] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-subtle">
              <th className="px-2 py-2 font-medium">Tahap</th>
              <th className="px-2 py-2 text-right font-medium">Keputusan</th>
              <th className="px-2 py-2 text-right font-medium">Setuju</th>
              <th className="px-2 py-2 text-right font-medium">Tolak</th>
              <th className="px-2 py-2 text-right font-medium">Revisi</th>
              <th className="px-2 py-2 text-right font-medium">Menunggu</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.tahap} className="border-b border-border-subtle last:border-0">
                <td className="px-2 py-2 font-medium text-text">{b.tahap}</td>
                <td className="px-2 py-2 text-right tabular-nums text-text">
                  {formatAngka(b.jumlahKeputusan)}
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">{formatAngka(b.disetujui)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">{formatAngka(b.ditolak)}</td>
                <td className="px-2 py-2 text-right tabular-nums text-text-muted">{formatAngka(b.revisi)}</td>
                <td className="px-2 py-2 text-right tabular-nums">
                  {b.menunggu === 0 ? (
                    <span className="text-text-muted">—</span>
                  ) : (
                    <Badge tone="peringatan">{formatAngka(b.menunggu)}</Badge>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

async function IsiRinci({ filter }: { filter: FilterLaporan }) {
  const baris = await ambilNominasiRinci(filter, 200)

  if (baris.length === 0) {
    return (
      <Panel>
        <PanelHeader judul="Daftar nominasi" />
        <EmptyState judul="Belum ada nominasi" deskripsi="Tidak ada baris yang cocok dengan penyaring." />
      </Panel>
    )
  }

  return (
    <Panel>
      <PanelHeader
        judul="Daftar nominasi"
        deskripsi={`${formatAngka(baris.length)} baris teratas (maksimal 200 di layar). Unduhan CSV memuat sampai 5.000 baris.`}
      />
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[62rem] text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-subtle">
              <th className="px-2 py-2 font-medium">NIP &amp; Nama</th>
              <th className="px-2 py-2 font-medium">Jabatan target</th>
              <th className="px-2 py-2 font-medium">Unit pengaju</th>
              <th className="px-2 py-2 font-medium">Diajukan</th>
              <th className="px-2 py-2 font-medium">Status nominasi</th>
              <th className="px-2 py-2 font-medium">Status kandidat</th>
              <th className="px-2 py-2 text-right font-medium">Hari proses</th>
            </tr>
          </thead>
          <tbody>
            {baris.map((b) => (
              <tr key={b.nominasiId} className="border-b border-border-subtle last:border-0">
                <td className="px-2 py-2">
                  <span className="block font-medium text-text">{b.nama}</span>
                  <span className="block text-[11px] tabular-nums text-text-subtle">
                    {formatNip(b.nip)}
                  </span>
                </td>
                <td className="px-2 py-2 text-text-muted">{b.namaTarget}</td>
                <td className="px-2 py-2 text-text-muted">{b.namaUnitPengaju}</td>
                <td className="px-2 py-2 tabular-nums text-text-muted">
                  {formatTanggal(b.tanggalDiajukan)}
                </td>
                <td className="px-2 py-2 text-text-muted">
                  {LABEL_NOMINASI[b.status as StatusNominasi] ?? b.status}
                </td>
                <td className="px-2 py-2">
                  <Badge tone={nadaPool(b.statusPool)}>
                    {LABEL_POOL[b.statusPool as StatusPool] ?? b.statusPool}
                  </Badge>
                </td>
                <td className="px-2 py-2 text-right tabular-nums text-text">
                  {b.hariProses === null ? '—' : formatAngka(b.hariProses)}
                  {b.selesaiPada === null ? (
                    <span className="ml-1 text-[11px] text-text-subtle">berjalan</span>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

/** `YYYY-MM` dari SQL → "Jul 2026", lewat formatter terpusat. */
function labelPeriode(periode: string): string {
  const [tahun, bulan] = periode.split('-')
  const t = Number(tahun)
  const b = Number(bulan)
  return Number.isInteger(t) && Number.isInteger(b) ? formatBulanTahun(t, b) : periode
}

/** Nada badge diambil dari state machine, bukan dipetakan ulang di sini. */
function nadaPool(status: string): 'netral' | 'sukses' | 'peringatan' | 'bahaya' {
  const nada = NADA_POOL[status as StatusPool]
  return nada === 'aksen' || nada === undefined ? 'netral' : nada
}

function TabelSkeleton({ baris, kolom }: { baris: number; kolom: number }) {
  return (
    <Panel>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-2 h-3 w-80" />
      <div className="mt-3">
        <TableSkeleton rows={baris} cols={Array.from({ length: kolom }, () => '1fr')} />
      </div>
    </Panel>
  )
}
