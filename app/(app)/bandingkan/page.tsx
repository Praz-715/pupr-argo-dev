import { Plus, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { ChartSkeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import { MAKS_KANDIDAT, MIN_KANDIDAT, bacaDaftarNip } from '@/lib/banding'
import { formatNip } from '@/lib/format'
import {
  ambilKandidat,
  ambilSkorBanding,
  ambilTargetBanding,
  cariKandidat,
  type KandidatBanding,
} from '@/lib/kueri/perbandingan'
import { angkaPositif } from '@/lib/param'
import { punyaPeran } from '@/lib/peran'
import { PanelRadar } from './_komponen/panel-radar'
import { PemilihKandidat } from './_komponen/pemilih-kandidat'
import { TabelBanding } from './_komponen/tabel-banding'

export const metadata = { title: 'Perbandingan Kandidat' }

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Perbandingan Kandidat (PRD §6.3).
 *
 * Dua aturan yang membentuk halaman ini, keduanya soal **apa yang tidak boleh
 * disajikan**:
 *
 * 1. **Skor hanya sebanding dalam satu jabatan target.** Bobot & daftar indikator
 *    berbeda per target, jadi ada pemilih jabatan target dan skornya cuma tampil
 *    untuk target itu. Radar bahkan **disembunyikan** kalau ada kandidat yang
 *    tidak punya skor di target terpilih — bentuk radar terlihat bisa dibandingkan
 *    walaupun sumbunya bukan hal yang sama, jadi peringatan teks saja tidak cukup.
 * 2. **K-4:** Match Score tidak memuat unsur kinerja sama sekali. Kotak 9 &
 *    predikat kinerja karena itu tampil berdampingan dengan skor, bukan di
 *    halaman lain.
 */
/**
 * PRD §6.3 membatasi halaman ini ke Admin Talenta & Pimpinan (plus Super
 * Admin). Sampai Fase 6 pembatasannya hanya menyembunyikan item menu; sejak
 * ada auth asli, URL yang bisa ditebak harus ditolak di server juga —
 * halaman ini menyandingkan rekam jejak beberapa pegawai sekaligus.
 */
const PERAN_HALAMAN = ['Super Admin', 'Admin Talenta', 'Pimpinan'] as const

export default async function BandingkanPage({ searchParams }: { searchParams: ParamHalaman }) {
  const pengguna = await getCurrentUser()
  if (!pengguna || !punyaPeran(pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Perbandingan Kandidat"
        deskripsiHalaman="Bandingkan beberapa pegawai berdampingan."
        peranAnda={pengguna?.peran ?? 'tanpa peran'}
        alasan="Halaman ini menyandingkan nilai asesmen, match score, dan rekam jejak beberapa pegawai sekaligus, jadi hanya peran yang memang memutuskan penempatan yang bisa membukanya (PRD §6.3)."
        catatan="Profil masing-masing pegawai tetap bisa dibuka satu per satu dari Direktori Pegawai, sebatas lingkup unit Anda."
      />
    )
  }

  const params = await searchParams
  const daftarNip = bacaDaftarNip(params.nip)
  const cari = params.cari?.slice(0, 100) ?? ''
  const targetId = angkaPositif(params.target) ?? null

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Perbandingan Kandidat"
        deskripsi={`Bandingkan ${MIN_KANDIDAT}–${MAKS_KANDIDAT} pegawai berdampingan: posisi Kotak 9, nilai asesmen, match score per jabatan target, dan rekam jejaknya.`}
      />

      <Suspense
        key={`${daftarNip.join(',')}|${cari}|${targetId}`}
        fallback={<BandingSkeleton />}
      >
        <IsiBanding daftarNip={daftarNip} cari={cari} targetId={targetId} />
      </Suspense>
    </div>
  )
}

async function IsiBanding({
  daftarNip,
  cari,
  targetId,
}: {
  daftarNip: string[]
  cari: string
  targetId: number | null
}) {
  const [kandidat, hasilCari] = await Promise.all([
    ambilKandidat(daftarNip),
    cari.trim().length >= 2 ? cariKandidat(cari) : Promise.resolve([]),
  ])

  const nipTerpilih = new Set(kandidat.map((k) => k.nip))
  const target = kandidat.length > 0 ? await ambilTargetBanding(kandidat.map((k) => k.pegawaiId)) : []

  // Target bawaan: yang dimiliki SEMUA kandidat & skornya paling tinggi
  // frekuensinya. Kalau tidak ada yang dimiliki semua, biarkan kosong daripada
  // menampilkan perbandingan yang timpang tanpa diminta.
  const sebanding = target.filter((t) => t.jumlahPunyaSkor === kandidat.length)
  const targetDipakai =
    targetId !== null
      ? (target.find((t) => t.jabatanTargetId === targetId) ?? null)
      : (sebanding[0] ?? null)

  const skor =
    targetDipakai !== null && kandidat.length > 0
      ? await ambilSkorBanding(
          kandidat.map((k) => k.pegawaiId),
          targetDipakai.jabatanTargetId,
        )
      : null

  const timpang =
    targetDipakai !== null && targetDipakai.jumlahPunyaSkor < kandidat.length

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader
          judul="Kandidat yang dibandingkan"
          deskripsi={
            kandidat.length === 0
              ? `Cari nama atau NIP, lalu tambahkan ${MIN_KANDIDAT}–${MAKS_KANDIDAT} orang.`
              : `${kandidat.length} dari maksimum ${MAKS_KANDIDAT} kandidat terpilih. Daftar ini tersimpan di alamat halaman, jadi bisa dibagikan.`
          }
        />
        <div className="mt-3">
          <PemilihKandidat terpilih={kandidat.map((k) => ({ nip: k.nip, nama: k.nama }))} />
        </div>

        {cari.trim().length >= 2 ? (
          <HasilPencarian
            hasil={hasilCari}
            nipTerpilih={nipTerpilih}
            daftarNip={daftarNip}
            penuh={kandidat.length >= MAKS_KANDIDAT}
            targetId={targetId}
          />
        ) : null}
      </Panel>

      {kandidat.length < MIN_KANDIDAT ? (
        <EmptyState
          judul={
            kandidat.length === 0
              ? 'Belum ada kandidat dipilih'
              : `Tambah ${MIN_KANDIDAT - kandidat.length} kandidat lagi`
          }
          deskripsi={
            kandidat.length === 0
              ? 'Perbandingan butuh minimal dua orang. Cari lewat kotak di atas, atau buka Peta Talenta untuk melihat siapa yang berada di kotak yang sama.'
              : 'Perbandingan mulai ditampilkan setelah ada dua kandidat.'
          }
          aksi={
            <Link
              href="/peta-talenta"
              className="text-[13px] text-accent hover:underline"
            >
              Buka Peta Talenta
            </Link>
          }
        />
      ) : (
        <>
          <Panel>
            <PanelHeader
              judul="Jabatan target pembanding"
              deskripsi="Match score hanya sebanding di dalam satu jabatan target — bobot komponen & daftar indikatornya berbeda antar target."
            />
            <div className="mt-3">
              {target.length === 0 ? (
                <p className="text-[13px] text-text-muted">
                  Tidak ada kandidat terpilih yang punya match score, jadi tidak ada yang bisa
                  dibandingkan pada tingkat skor. Perbandingan di bawah tetap menampilkan asesmen
                  dan rekam jejaknya.
                </p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {target.map((t) => {
                    const aktif = t.jabatanTargetId === targetDipakai?.jabatanTargetId
                    const lengkap = t.jumlahPunyaSkor === kandidat.length
                    const qs = new URLSearchParams()
                    if (daftarNip.length > 0) qs.set('nip', daftarNip.join(','))
                    qs.set('target', String(t.jabatanTargetId))
                    return (
                      <li key={t.jabatanTargetId}>
                        <Link
                          href={`/bandingkan?${qs.toString()}`}
                          scroll={false}
                          aria-current={aktif ? 'true' : undefined}
                          className={
                            aktif
                              ? 'flex items-center gap-2 rounded-md border border-accent bg-accent-subtle px-2.5 py-1.5 text-[12px] font-medium text-text'
                              : 'flex items-center gap-2 rounded-md border border-border px-2.5 py-1.5 text-[12px] text-text-muted transition-colors hover:border-border-strong hover:text-text'
                          }
                        >
                          {t.namaTarget}
                          <Badge tone={lengkap ? 'sukses' : 'peringatan'}>
                            {t.jumlahPunyaSkor}/{kandidat.length} punya skor
                          </Badge>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </Panel>

          {timpang ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-warning-border bg-warning-subtle px-3.5 py-3">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="text-[12px] leading-relaxed text-text-muted">
                <p className="font-medium text-text">
                  Skor pada jabatan target ini tidak lengkap untuk semua kandidat.
                </p>
                <p className="mt-0.5">
                  Hanya {targetDipakai?.jumlahPunyaSkor} dari {kandidat.length} kandidat punya match
                  score di sini. Sel yang kosong berarti <strong>belum dihitung</strong>, bukan
                  bernilai rendah — dan <strong>radar disembunyikan</strong> karena bentuknya akan
                  terbaca sebagai perbandingan yang setara padahal bukan.
                </p>
              </div>
            </div>
          ) : null}

          {skor !== null && !timpang ? (
            <PanelRadarWrapper kandidat={kandidat} skor={skor} namaTarget={targetDipakai!.namaTarget} />
          ) : null}

          <Panel padat>
            <div className="border-b border-border px-3.5 py-3">
              <PanelHeader
                judul="Perbandingan rinci"
                deskripsi={
                  <>
                    Baris = atribut, kolom = kandidat. Nilai tertinggi tiap baris dicetak tebal;
                    baris dengan selisih ≥10 poin ditandai <span className="tabular">Δ</span>.
                  </>
                }
              />
            </div>
            <TabelBanding
              kandidat={kandidat}
              skor={skor}
              namaTarget={targetDipakai?.namaTarget ?? null}
            />
          </Panel>
        </>
      )}
    </div>
  )
}

/**
 * Radar dipisah ke pembungkus supaya perhitungan sumbunya (irisan indikator yang
 * dimiliki SEMUA kandidat) terjadi di server, bukan di klien.
 */
function PanelRadarWrapper({
  kandidat,
  skor,
  namaTarget,
}: {
  kandidat: KandidatBanding[]
  skor: NonNullable<Awaited<ReturnType<typeof ambilSkorBanding>>>
  namaTarget: string
}) {
  // Sumbu = indikator tingkat atas yang dipunyai kandidat pertama, disaring ke
  // yang dimiliki semua kandidat. Indikator yang hanya ada di sebagian kandidat
  // akan membuat poligonnya bolong dan terbaca sebagai nilai nol.
  const pertama = skor.get(kandidat[0]!.pegawaiId)
  if (!pertama || pertama.indikator.length < 3) return null

  const sumbu = pertama.indikator
    .map((i) => i.namaIndikator)
    .filter((nama) =>
      kandidat.every((k) => skor.get(k.pegawaiId)?.indikator.some((i) => i.namaIndikator === nama)),
    )

  if (sumbu.length < 3) return null

  const seri = kandidat.map((k) => ({
    nama: k.nama,
    nilai: sumbu.map(
      (nama) =>
        skor.get(k.pegawaiId)?.indikator.find((i) => i.namaIndikator === nama)?.skor ?? null,
    ),
  }))

  const adaManual = kandidat.some((k) =>
    skor.get(k.pegawaiId)?.indikator.some((i) => i.sumberNilai === 'MANUAL'),
  )
  const adaReview = kandidat.some((k) =>
    skor.get(k.pegawaiId)?.indikator.some((i) => i.perluReview),
  )

  return (
    <PanelRadar
      sumbu={sumbu}
      seri={seri}
      namaTarget={namaTarget}
      adaManual={adaManual}
      adaReview={adaReview}
    />
  )
}

function HasilPencarian({
  hasil,
  nipTerpilih,
  daftarNip,
  penuh,
  targetId,
}: {
  hasil: Awaited<ReturnType<typeof cariKandidat>>
  nipTerpilih: Set<string>
  daftarNip: string[]
  penuh: boolean
  targetId: number | null
}) {
  if (hasil.length === 0) {
    return (
      <p className="mt-3 border-t border-border pt-3 text-[12px] text-text-subtle">
        Tidak ada pegawai yang cocok dengan pencarian itu.
      </p>
    )
  }

  return (
    <div className="mt-3 border-t border-border pt-3">
      <p className="mb-2 text-[11px] text-text-subtle">
        {hasil.length} hasil pencarian
        {penuh ? ' — keluarkan satu kandidat dulu untuk menambah yang lain' : ''}
      </p>
      <ul className="space-y-1">
        {hasil.map((h) => {
          const sudah = nipTerpilih.has(h.nip)
          const qs = new URLSearchParams()
          qs.set('nip', [...daftarNip, h.nip].join(','))
          if (targetId !== null) qs.set('target', String(targetId))

          return (
            <li key={h.nip}>
              <div className="flex items-center justify-between gap-3 rounded-md border border-border px-2.5 py-1.5">
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-text break-words">
                    {h.nama}
                    {h.kotak9 !== null ? (
                      <span className="ml-1.5 text-[11px] font-normal text-text-subtle">
                        Kotak {h.kotak9}
                      </span>
                    ) : null}
                  </span>
                  <span className="block text-[11px] text-text-subtle break-words">
                    <span className="tabular">{formatNip(h.nip)}</span>
                    {h.namaJabatan ? ` · ${h.namaJabatan}` : ''}
                  </span>
                </span>

                {sudah ? (
                  <span className="shrink-0 text-[11px] text-text-subtle">Sudah dipilih</span>
                ) : penuh ? (
                  <span className="shrink-0 text-[11px] text-text-subtle">Kuota penuh</span>
                ) : (
                  <Link
                    href={`/bandingkan?${qs.toString()}`}
                    scroll={false}
                    className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-accent transition-colors hover:border-accent hover:bg-accent-subtle"
                  >
                    <Plus className="size-3" />
                    Tambahkan
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function BandingSkeleton() {
  return (
    <div className="space-y-4">
      <Panel>
        <Skeleton className="h-4 w-52" />
        <Skeleton className="mt-2 h-3 w-full max-w-lg" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 flex-1" />
        </div>
      </Panel>
      <Panel>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-2 h-3 w-full max-w-xl" />
        <div className="mt-3 flex gap-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-56" />
        </div>
      </Panel>
      <Panel>
        <Skeleton className="h-4 w-40" />
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_18rem]">
          <ChartSkeleton ratio="4 / 3" />
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      </Panel>
      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <Skeleton className="h-4 w-40" />
        </div>
        <TableSkeleton rows={14} cols={['1.6fr', '1fr', '1fr', '1fr']} />
      </Panel>
    </div>
  )
}
