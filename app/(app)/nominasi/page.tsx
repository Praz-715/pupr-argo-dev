import { FileCheck2 } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { formatAngka, formatNip, formatSkor, formatTanggal } from '@/lib/format'
import { ambilDaftarNominasi } from '@/lib/kueri/suksesi'
import {
  LABEL_GILIRAN,
  LABEL_TAHAP,
  TAHAP_NOMINASI,
  tahapNominasi,
  type Giliran,
  type TahapNominasi,
} from '@/lib/workflow'
import { FilterNominasi } from './_komponen/filter-nominasi'

export const metadata = { title: 'Nominasi' }

type Cari = Promise<Record<string, string | undefined>>

const GILIRAN_SAH: Giliran[] = ['UNIT', 'ADMIN_TALENTA', 'PIMPINAN', 'SELESAI']

/**
 * Nada lencana per tahap — kelimanya BERBEDA, tidak ada dua tahap sewarna.
 *
 * Sebelumnya nada dipetakan dari `nominasi.status`, yang hanya punya empat nilai
 * dan menyatukan "menunggu approval" dengan "sudah ditetapkan" ke satu hijau.
 * Warna tetap bukan satu-satunya pembeda: labelnya sendiri sudah menyebut
 * tahapnya, dan kolom Giliran di sebelahnya menyebut pelakunya.
 */
const NADA_TAHAP: Record<TahapNominasi, 'netral' | 'aksen' | 'sukses' | 'peringatan' | 'bahaya'> = {
  REVISI: 'peringatan',
  VERIFIKASI: 'aksen',
  APPROVAL: 'netral',
  DITETAPKAN: 'sukses',
  // Netral, BUKAN 'bahaya'. Ditarik berarti pengajuannya dibatalkan — bukan
  // orangnya gagal; mewarnainya merah membuatnya terbaca sebagai penolakan,
  // yang persis dihindari `doc/sql/033`.
  DITARIK: 'netral',
  DITOLAK: 'bahaya',
}

/**
 * Antrian Nominasi (PRD §6.6 "Verifikasi Nominasi" + "Riwayat/Log Approval").
 *
 * Satu antrian untuk semua peran, disaring menurut **giliran** — bukan satu
 * halaman per peran. Alasannya: yang membedakan pekerjaan Admin Talenta dan
 * Pimpinan bukan daftar nominasinya, melainkan tahap mana yang menunggu mereka.
 * Dua halaman berisi baris yang sama dengan tombol berbeda akan mengundang
 * pertanyaan "kok nominasi X tidak ada di halaman saya".
 *
 * **Lama menunggu ditampilkan dalam hari** karena target proyek memangkas waktu
 * layanan ≥30% (PRD §2) — itu tidak terpantau kalau yang tampil hanya tanggal.
 */
export default async function NominasiPage({ searchParams }: { searchParams: Cari }) {
  const p = await searchParams
  const pengguna = await getCurrentUser()
  // Penyaring pindah dari `?giliran=` ke `?tahap=` — satu kosakata dengan kolom
  // Status. `?giliran=` masih diterima supaya tautan/bookmark lama tidak mati.
  const tahap = TAHAP_NOMINASI.find((t) => t === p.tahap)
  const giliran = GILIRAN_SAH.find((g) => g === p.giliran)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Nominasi"
        deskripsi="Pengajuan kandidat dari unit beserta tahap persetujuannya. Kolom Giliran menunjukkan siapa yang harus bertindak, dan lama menunggu dihitung sejak keputusan terakhir."
      />

      <FilterNominasi
        tahap={tahap ?? null}
        giliran={giliran ?? null}
        peran={pengguna?.peran ?? null}
      />

      <Suspense key={tahap ?? giliran ?? 'semua'} fallback={<NominasiSkeleton />}>
        <IsiNominasi
          tahap={tahap}
          giliran={giliran}
          unitPenggunaId={
            pengguna?.peran === 'Pengelola Unit' ? (pengguna.unitOrganisasiId ?? null) : null
          }
        />
      </Suspense>
    </div>
  )
}

async function IsiNominasi({
  tahap,
  giliran,
  unitPenggunaId,
}: {
  tahap: TahapNominasi | undefined
  giliran: Giliran | undefined
  unitPenggunaId: number | null
}) {
  const semua = await ambilDaftarNominasi(
    unitPenggunaId === null ? {} : { unitPengajuId: unitPenggunaId },
  )
  // Disaring menurut TAHAP bila ada; `giliran` hanya jalur lama. Tahap dihitung
  // dengan fungsi yang sama yang dipakai kolom Status, jadi jumlah baris selalu
  // cocok dengan yang tertulis di lencananya — tidak mungkin lagi opsi penyaring
  // dan label baris berselisih.
  const baris =
    tahap !== undefined
      ? semua.filter(
          (n) => tahapNominasi({ statusNominasi: n.status, statusPool: n.statusPool }) === tahap,
        )
      : giliran === undefined
        ? semua
        : semua.filter((n) => n.giliran === giliran)

  const perGiliran = GILIRAN_SAH.map((g) => ({
    giliran: g,
    jumlah: semua.filter((n) => n.giliran === g).length,
  }))
  const terlamaMenunggu = semua
    .filter((n) => n.giliran !== 'SELESAI')
    .reduce((maks, n) => Math.max(maks, n.lamaMenungguHari ?? 0), 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Panel>
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
            Total nominasi
          </p>
          <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
            {formatAngka(semua.length)}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
            {unitPenggunaId === null ? 'seluruh unit' : 'diajukan oleh unit Anda'}
          </p>
        </Panel>
        {(['ADMIN_TALENTA', 'PIMPINAN', 'UNIT'] as const).map((g) => {
          const jumlah = perGiliran.find((x) => x.giliran === g)?.jumlah ?? 0
          return (
            <Panel key={g}>
              <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
                Menunggu {LABEL_GILIRAN[g]}
              </p>
              <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
                {formatAngka(jumlah)}
              </p>
              <p
                className={cn(
                  'mt-1.5 text-[11px] leading-relaxed',
                  jumlah > 0 ? 'text-warning' : 'text-text-subtle',
                )}
              >
                {jumlah === 0
                  ? 'Antrian bersih.'
                  : g === 'UNIT'
                    ? 'Dikembalikan untuk revisi.'
                    : 'Perlu keputusan.'}
              </p>
            </Panel>
          )
        })}
      </div>

      {terlamaMenunggu > 0 ? (
        <p className="text-[11px] leading-relaxed text-text-subtle">
          Yang paling lama tertahan: <strong className="font-medium text-warning">{terlamaMenunggu} hari</strong>{' '}
          sejak keputusan terakhir. Waktu layanan adalah metrik proyek (PRD §2), jadi angka ini
          ditampilkan sebagai hari, bukan sebagai tanggal.
        </p>
      ) : null}

      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <PanelHeader
            judul={`Daftar nominasi (${formatAngka(baris.length)})`}
            deskripsi="Diurutkan: yang menunggu verifikasi lebih dulu, lalu yang dikembalikan untuk revisi, lalu yang sudah selesai. Klik baris untuk melihat timeline persetujuannya."
          />
        </div>

        {baris.length === 0 ? (
          <EmptyState
            className="m-3.5 border-0"
            judul={
              giliran === undefined
                ? 'Belum ada nominasi'
                : `Tidak ada nominasi yang menunggu ${LABEL_GILIRAN[giliran]}`
            }
            deskripsi={
              giliran === undefined
                ? 'Nominasi diajukan dari halaman Talent Pool: pilih kandidat yang lolos syarat, lalu ajukan atas nama unit.'
                : 'Antrian untuk tahap ini bersih. Lepas filter untuk melihat nominasi lain.'
            }
            ikon={<FileCheck2 className="size-5" />}
            aksi={
              giliran === undefined ? (
                <Link href="/talent-pool" className="text-[13px] text-accent hover:underline">
                  Buka Talent Pool
                </Link>
              ) : null
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[58rem] border-collapse text-[13px]">
              <thead className="bg-surface-2">
                <tr className="border-b border-border text-left text-[11px] tracking-wide text-text-subtle uppercase">
                  <th className="px-3.5 py-2 font-medium">Kandidat</th>
                  <th className="px-3 py-2 font-medium">Jabatan target</th>
                  <th className="px-3 py-2 font-medium">Unit pengaju</th>
                  <th className="px-3 py-2 text-right font-medium">Kotak 9</th>
                  <th className="px-3 py-2 text-right font-medium">Match score</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Giliran</th>
                  <th className="px-3.5 py-2 text-right font-medium">
                    Menunggu
                    <span className="mt-0.5 block text-[9px] font-normal normal-case">hari</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {baris.map((n) => (
                  <tr
                    key={n.id}
                    className="border-b border-border last:border-b-0 hover:bg-surface-2"
                  >
                    <td className="px-3.5 py-2.5">
                      <Link
                        href={`/nominasi/${n.id}`}
                        className="block font-medium text-text hover:text-accent"
                      >
                        {n.nama}
                      </Link>
                      <span className="tabular block text-[11px] text-text-subtle">
                        {formatNip(n.nip)}
                      </span>
                    </td>
                    {/*
                      Nama jabatan target & unit MEMBUNGKUS, tidak lagi dipotong
                      (permintaan pemilik proses 25 Agu 2026: *"jabatannya jangan sampe
                      kepotong gitu"*).

                      `truncate` di sini menyembunyikan justru bagian yang membedakan:
                      "Kepala Balai Jasa Konstruksi Wilayah V Ban…" — yang terpotong
                      adalah NAMA WILAYAHNYA, satu-satunya hal yang membedakan satu
                      balai dari sepuluh balai lain di daftar yang sama. Tooltip tidak
                      menutupi itu: ia menuntut arahkan-dan-tunggu per baris, dan tidak
                      ada sama sekali di layar sentuh.

                      Lebar maksimalnya DIPERTAHANKAN supaya kolom ini tidak menelan
                      lebar tabel; yang berubah hanya luberannya jadi baris kedua. Baris
                      tabel ini memang sudah bertinggi variabel (nama kandidat bergelar
                      panjang sudah memakai tiga baris), jadi tidak ada tata letak yang
                      dipatok oleh tinggi barisnya.
                    */}
                    <td className="px-3 py-2.5 text-text-muted">
                      <span className="block max-w-[16rem] leading-snug break-words">
                        {n.namaTarget}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-[11px] text-text-subtle">
                      <span className="block max-w-[14rem] leading-snug break-words">
                        {n.namaUnitPengaju}
                      </span>
                      {n.namaPengaju !== null ? <span className="block">{n.namaPengaju}</span> : null}
                    </td>
                    <td className="tabular px-3 py-2.5 text-right text-text">{n.kotak9 ?? '—'}</td>
                    <td className="tabular px-3 py-2.5 text-right font-medium text-text">
                      {n.skorTotal === null ? '—' : formatSkor(n.skorTotal)}
                    </td>
                    <td className="px-3 py-2.5">
                      {(() => {
                        // "Lolos verifikasi" dulu tampil untuk baris yang masih
                        // menunggu Pimpinan — terbaca sudah beres padahal belum.
                        const t = tahapNominasi({
                          statusNominasi: n.status,
                          statusPool: n.statusPool,
                        })
                        return <Badge tone={NADA_TAHAP[t]}>{LABEL_TAHAP[t]}</Badge>
                      })()}
                      <span className="mt-0.5 block text-[10px] text-text-subtle">
                        diajukan {formatTanggal(n.tanggalDiajukan)}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span
                        className={cn(
                          'text-[11px]',
                          n.giliran === 'SELESAI' ? 'text-text-subtle' : 'font-medium text-text',
                        )}
                      >
                        {LABEL_GILIRAN[n.giliran]}
                      </span>
                      {n.tahapTerakhir !== null ? (
                        <span className="mt-0.5 block text-[10px] text-text-subtle">
                          {n.tahapTerakhir}
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular px-3.5 py-2.5 text-right">
                      {n.giliran === 'SELESAI' ? (
                        <span className="text-text-subtle">—</span>
                      ) : (
                        <span
                          className={cn(
                            'font-medium',
                            (n.lamaMenungguHari ?? 0) > 14 ? 'text-danger' : 'text-text',
                          )}
                        >
                          {formatAngka(n.lamaMenungguHari ?? 0)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}

function NominasiSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Panel key={i}>
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-2 h-7 w-10" />
            <Skeleton className="mt-2 h-3 w-full" />
          </Panel>
        ))}
      </div>
      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
        </div>
        <TableSkeleton rows={6} cols={['1.8fr', '1.6fr', '1.4fr', '0.6fr', '0.8fr', '1.2fr', '1fr', '0.6fr']} />
      </Panel>
    </div>
  )
}
