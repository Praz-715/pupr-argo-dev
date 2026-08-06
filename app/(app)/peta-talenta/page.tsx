import { ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import { Kotak9Grid } from '@/components/charts/kotak9-grid'
import { Badge } from '@/components/ui/badge'
import { CatatanLingkup } from '@/components/ui/catatan-lingkup'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader, PageHeader } from '@/components/ui/panel'
import { ChartSkeleton, Kotak9Skeleton, Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import { formatAngka } from '@/lib/format'
import {
  ambilAnggotaSel,
  ambilOpsiPeta,
  ambilPetaSebaran,
  ambilTitikPeta,
  type FilterPeta as TipeFilterPeta,
  type OpsiJabatanTarget,
} from '@/lib/kueri/peta-talenta'
import { lingkupData, tanpaAkses, unitWajib } from '@/lib/lingkup'
import { angkaPositif, dariDaftar, nomorHalaman } from '@/lib/param'
import { DESKRIPSI_KOTAK_9, kategoriDariKotak9, type Kotak9 } from '@/lib/scoring'
import { DaftarSel } from './_komponen/daftar-sel'
import { FilterPeta } from './_komponen/filter-peta'
import { PemilihTarget } from './_komponen/pemilih-target'
import { TampilanPeta } from './_komponen/tampilan-peta'

export const metadata = { title: 'Peta Talenta' }

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Peta Talenta (PRD §6.3 "Sebaran Kotak 9", diperluas oleh U-1).
 *
 * Grid 3×3 dan bubble berdiri **berdampingan** karena masing-masing menjawab
 * pertanyaan yang tidak bisa dijawab yang lain: grid menjawab "berapa orang di
 * tiap kotak" (dan itu format yang diwajibkan BKN), bubble menjawab "bagaimana
 * sebarannya di dalam kotak" — satu sel bisa memuat orang berpotensial 82 dan 99
 * sekaligus. Grid sendirian selalu tampak berat di baris atas (phase.md §3 K-2).
 *
 * Klik satu sel → daftar pegawainya, **dengan filter yang sedang aktif tetap
 * terbawa**. Itu yang menggantikan rencana *jitter*: sebaran di dalam sel dibaca
 * sebagai daftar bernilai asli, bukan titik yang digeser ke koordinat palsu.
 */
export default async function PetaTalentaPage({ searchParams }: { searchParams: ParamHalaman }) {
  const params = await searchParams
  const lingkup = lingkupData(await getCurrentUser())
  // Batas unit ikut ke seluruh kueri halaman ini — termasuk hitungan sebaran.
  // Kalau hanya daftar drill-down yang dibatasi, angka di grid akan bercerita
  // tentang populasi yang tidak boleh dilihat pemiliknya.
  const filter = { ...bacaFilterPeta(params), unitWajib: unitWajib(lingkup) }
  const kotak = bacaKotak(params.kotak)
  const halaman = nomorHalaman(params.hal)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Peta Talenta"
        deskripsi="Sebaran talenta pada 9 Kotak Manajemen Talenta ASN. Klik satu kotak untuk melihat daftar pegawainya."
      />

      <CatatanLingkup lingkup={lingkup} />

      {tanpaAkses(lingkup) ? null : (
        <Suspense key={JSON.stringify(filter)} fallback={<PetaSkeleton />}>
          <IsiPeta filter={filter} kotak={kotak} halaman={halaman} />
        </Suspense>
      )}
    </div>
  )
}

async function IsiPeta({
  filter,
  kotak,
  halaman,
}: {
  filter: TipeFilterPeta
  kotak: number | null
  halaman: number
}) {
  const [sebaran, opsi, peta] = await Promise.all([
    ambilPetaSebaran(filter),
    ambilOpsiPeta(),
    ambilTitikPeta(filter),
  ])

  const terpilih =
    filter.jabatanTargetId === undefined
      ? null
      : (opsi.jabatanTarget.find((t) => t.id === filter.jabatanTargetId) ?? null)

  // `?target=` menunjuk jabatan target yang tidak ada atau tidak AKTIF. Ditolak
  // terang-terangan, bukan dijatuhkan kembali ke sebaran organisasi: kalau
  // dijatuhkan, halaman akan memajang label "Organisasi" di atas angka yang
  // dimintanya per jabatan — atau sebaliknya — dan tidak ada cara pengguna
  // menyadarinya.
  if (filter.jabatanTargetId !== undefined && terpilih === null) {
    return (
      <div className="space-y-4">
        <PemilihTarget daftar={opsi.jabatanTarget} terpilih={null} belumDinilai={0} />
        <EmptyState
          judul="Jabatan target tidak ditemukan"
          deskripsi="Alamat ini menunjuk jabatan target yang tidak ada atau sudah tidak berstatus AKTIF. Pilih jabatan target lain, atau kembali ke sebaran organisasi."
        />
      </div>
    )
  }

  // Nama sumbu X ikut berubah — dua angka berbeda tidak boleh tampil dengan nama
  // yang sama (phase.md §3 K-7a).
  const labelX = terpilih === null ? 'Potensial' : 'Match score'

  // Query string filter dipertahankan saat menautkan sel, supaya daftar yang
  // terbuka cocok dengan angka pada sel yang baru diklik. `target` ikut, kalau
  // tidak nomor kotak pada tautan akan dibaca dengan sumbu X yang lain.
  const qsFilter = new URLSearchParams()
  if (filter.unitId !== undefined) qsFilter.set('unit', String(filter.unitId))
  if (filter.eselon) qsFilter.set('eselon', filter.eselon)
  if (filter.jenjang) qsFilter.set('jenjang', filter.jenjang)
  if (filter.tahun !== undefined) qsFilter.set('tahun', String(filter.tahun))
  if (filter.hanyaBerlaku) qsFilter.set('berlaku', '1')
  if (filter.jabatanTargetId !== undefined) qsFilter.set('target', String(filter.jabatanTargetId))

  // Hash `#isi-kotak` + gulirKeSel: hasil drill-down ada di bawah dua panel, jadi
  // tanpa menggulir ke sana mengklik sel terasa tidak melakukan apa pun.
  const hrefSel = (k: Kotak9) => {
    const p = new URLSearchParams(qsFilter)
    p.set('kotak', String(k))
    return `/peta-talenta?${p.toString()}#isi-kotak`
  }

  const kepala = (
    <>
      <PemilihTarget
        daftar={opsi.jabatanTarget}
        terpilih={terpilih}
        belumDinilai={sebaran.belumDinilaiTarget}
      />
      <FilterPeta
        opsi={opsi}
        totalDinilai={sebaran.totalDinilai}
        tanpaAsesmen={sebaran.tanpaAsesmen}
      />
    </>
  )

  if (sebaran.totalDinilai === 0) {
    // Tiga sebab kosong yang berbeda, dan membedakannya penting: filter terlalu
    // sempit, belum ada asesmen, atau jabatan targetnya belum dihitung. Kalau
    // ketiganya diberi kalimat yang sama, yang ketiga akan disalahartikan sebagai
    // "tidak ada kandidat" padahal Hitung Ulang belum pernah dijalankan.
    return (
      <div className="space-y-4">
        {kepala}
        <EmptyState
          judul="Tidak ada pegawai yang bisa dipetakan"
          deskripsi={
            terpilih !== null && sebaran.belumDinilaiTarget > 0
              ? `${formatAngka(sebaran.belumDinilaiTarget)} pegawai cocok dengan filter ini tapi belum punya match score untuk jabatan target tersebut. Jalankan Hitung Ulang dari Editor Jabatan Target — angka nol di sini berarti belum dihitung, bukan tidak memenuhi syarat.`
              : sebaran.tanpaAsesmen > 0
                ? `${formatAngka(sebaran.tanpaAsesmen)} pegawai cocok dengan filter ini tapi belum punya asesmen, jadi belum bisa ditempatkan di Kotak 9 mana pun.`
                : 'Peta terbentuk dari nilai kinerja & potensial pada asesmen terbaru tiap pegawai. Longgarkan filter untuk melihat data.'
          }
        />
      </div>
    )
  }

  const terpadat = peta.titik.reduce((a, b) => (b.jumlah > a.jumlah ? b : a), peta.titik[0]!)

  return (
    <div className="space-y-4">
      {kepala}

      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            judul={
              terpilih === null
                ? 'Grid 9 Kotak — Sebaran Organisasi'
                : 'Grid 9 Kotak — Kesiapan terhadap Jabatan Target'
            }
            deskripsi={
              <>
                {formatAngka(sebaran.totalDinilai)} pegawai berasesmen
                {sebaran.tahunTerlama !== null && sebaran.tahunTerbaru !== null
                  ? ` · asesmen terbaru ${sebaran.tahunTerlama}–${sebaran.tahunTerbaru}`
                  : ''}
                {sebaran.kedaluwarsa > 0
                  ? ` · ${formatAngka(sebaran.kedaluwarsa)} kedaluwarsa masih ikut dihitung`
                  : ''}
              </>
            }
          />
          <div className="mt-3">
            <Kotak9Grid
              perKotak={sebaran.perKotak}
              total={sebaran.totalDinilai}
              kotakAktif={kotak}
              hrefSel={hrefSel}
              gulirKeSel
              labelX={labelX}
            />
          </div>
          <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-text-subtle">
            Intensitas warna <strong className="font-medium text-text-muted">relatif</strong>{' '}
            terhadap sel terpadat, bukan skala absolut. Baris atas hampir selalu berat karena
            predikat &quot;Baik&quot; sudah bernilai 80 dan ambang &quot;Di Atas Ekspektasi&quot;
            adalah ≥80 inklusif — itu sifat rubrik, bukan keunggulan organisasi.
          </p>
        </Panel>

        <Panel>
          <PanelHeader
            judul={`Peta Kinerja × ${labelX}`}
            deskripsi={
              <>
                {formatAngka(peta.totalPegawai)} pegawai jadi {formatAngka(peta.titik.length)} titik
                · ukuran gelembung = jumlah pegawai · titik terpadat{' '}
                {formatAngka(terpadat.jumlah)} pegawai di Kinerja {terpadat.y} × {labelX}{' '}
                {terpadat.x}
              </>
            }
          />
          <div className="mt-3">
            <TampilanPeta titik={peta.titik} labelX={labelX} />
          </div>
          <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-text-subtle">
            Sumbu Kinerja hanya punya lima nilai yang mungkin (100/80/60/40/20) karena diturunkan
            dari predikat, sehingga pegawai bertumpuk. Digambar sebagai gelembung — bukan titik
            ber-<em>jitter</em> — supaya posisi tiap orang tetap nilai sebenarnya.
          </p>
        </Panel>
      </div>

      {kotak !== null ? (
        <Suspense
          key={`${kotak}-${halaman}-${qsFilter.toString()}`}
          fallback={<SelSkeleton />}
        >
          <IsiSel
            kotak={kotak}
            filter={filter}
            halaman={halaman}
            qsFilter={qsFilter.toString()}
            labelX={labelX}
            target={terpilih}
          />
        </Suspense>
      ) : (
        <Panel>
          <p className="text-[13px] text-text-muted">
            Klik salah satu kotak di grid untuk melihat daftar pegawai di dalamnya — lengkap dengan
            nilai kinerja, potensial, dan Nilai Talenta masing-masing.
          </p>
        </Panel>
      )}
    </div>
  )
}

async function IsiSel({
  kotak,
  filter,
  halaman,
  qsFilter,
  labelX,
  target,
}: {
  kotak: number
  filter: TipeFilterPeta
  halaman: number
  qsFilter: string
  labelX: string
  target: OpsiJabatanTarget | null
}) {
  const hasil = await ambilAnggotaSel(kotak, filter, halaman)
  const kategori = kategoriDariKotak9(kotak)

  return (
    <Panel id="isi-kotak">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PanelHeader
          judul={
            <span className="flex flex-wrap items-center gap-2">
              Kotak {kotak}
              {kategori ? (
                <Badge tone="aksen">
                  {kategori.y} × {labelX} {kategori.x}
                </Badge>
              ) : null}
              {target !== null ? <Badge>{target.nama}</Badge> : null}
            </span>
          }
          deskripsi={
            <>
              {formatAngka(hasil.total)} pegawai · diurutkan menurut Nilai Talenta (tertinggi dulu)
              {target !== null
                ? ' · Nilai Talenta dihitung dari match score jabatan ini, bukan dari Potkom'
                : ''}
            </>
          }
        />
        <Link
          href={qsFilter === '' ? '/peta-talenta' : `/peta-talenta?${qsFilter}`}
          scroll={false}
          className="text-[11px] text-accent hover:underline"
        >
          Tutup daftar
        </Link>
      </div>

      <p className="mt-2 text-[12px] leading-relaxed text-text-muted">
        {DESKRIPSI_KOTAK_9[kotak as Kotak9]}
      </p>

      <div className="mt-3">
        {hasil.total === 0 ? (
          <EmptyState
            judul="Tidak ada pegawai di kotak ini"
            deskripsi="Dengan filter yang sedang aktif, kotak ini kosong. Longgarkan filter atau pilih kotak lain."
          />
        ) : (
          <DaftarSel
            daftar={hasil.daftar}
            total={hasil.total}
            halaman={hasil.halaman}
            ukuranHalaman={hasil.ukuranHalaman}
            labelX={labelX}
          />
        )}
      </div>

      {/*
        Tautan ke Direktori hanya dipasang pada tampilan organisasi. Penyaring
        `?kotak=` di sana membaca kolom `asesmen_talenta.kotak_9` — Kotak 9
        GENERIK — sehingga pada tampilan per jabatan target ia akan membuka daftar
        orang yang berbeda dengan nomor kotak yang sama. Itu jenis kesalahan yang
        tidak pernah terlihat sebagai galat: dua halaman memajang "Kotak 7" dengan
        isi berbeda, dan yang membacanya menyimpulkan salah satunya rusak.
      */}
      <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-3 text-[11px] text-text-subtle">
        {target === null ? (
          <>
            Butuh menyaring lebih jauh atau mengurutkan menurut kolom lain?
            <Link
              href={`/talenta?kotak=${kotak}`}
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              Buka di Direktori Pegawai
              <ArrowRight className="size-3" />
            </Link>
          </>
        ) : (
          <>
            Direktori Pegawai menyaring menurut Kotak 9{' '}
            <strong className="font-medium text-text-muted">organisasi</strong>, bukan kesiapan per
            jabatan — jadi tautannya tidak dipasang di sini supaya nomor kotak yang sama tidak
            membuka daftar yang berbeda.
            <Link
              href={`/jabatan-target/${target.id}/kandidat`}
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              Buka daftar kandidat jabatan ini
              <ArrowRight className="size-3" />
            </Link>
          </>
        )}
      </p>
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Skeleton — meniru bentuk akhir supaya tidak ada layout shift (phase.md §5.3)
// ---------------------------------------------------------------------------

function PetaSkeleton() {
  return (
    <div className="space-y-4">
      {/*
        Kunci pakai indeks, bukan nama kelasnya: lebarnya berulang (`w-40` dan
        `w-44` masing-masing dua kali), jadi kelas sebagai kunci menghasilkan
        duplikat yang diperingatkan React dan bisa membuat satu skeleton hilang.
      */}
      <div className="flex flex-wrap gap-2">
        {['w-[26rem]', 'w-56', 'w-44', 'w-40', 'w-40', 'w-44'].map((w, i) => (
          <Skeleton key={i} className={`h-8 ${w}`} />
        ))}
      </div>
      <Skeleton className="h-3 w-full max-w-2xl" />
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Panel>
          <Skeleton className="h-4 w-28" />
          <Skeleton className="mt-2 h-3 w-full max-w-sm" />
          <div className="mt-3">
            <Kotak9Skeleton />
          </div>
        </Panel>
        <Panel>
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-2 h-3 w-full max-w-sm" />
          <div className="mt-3">
            <ChartSkeleton ratio="16 / 10" />
          </div>
        </Panel>
      </div>
    </div>
  )
}

function SelSkeleton() {
  return (
    <Panel>
      <Skeleton className="h-4 w-52" />
      <Skeleton className="mt-2 h-3 w-full max-w-md" />
      <div className="mt-3">
        <TableSkeleton
          rows={8}
          cols={['2fr', '2.5fr', '2fr', '0.7fr', '0.8fr', '1.2fr', '0.8fr', '1fr', '0.8fr']}
        />
      </div>
    </Panel>
  )
}

// ---------------------------------------------------------------------------
// Validasi param di boundary — jangan percaya isi query string
// ---------------------------------------------------------------------------

const ESELON = ['I', 'II', 'III', 'IV', 'NON_ESELON'] as const

function bacaFilterPeta(params: Record<string, string | undefined>): TipeFilterPeta {
  const tahun = angkaPositif(params.tahun)

  return {
    unitId: angkaPositif(params.unit),
    eselon: dariDaftar(params.eselon, ESELON),
    jenjang: params.jenjang?.slice(0, 60),
    // Rentang tahun dibatasi supaya `?tahun=99999999` tidak dikirim ke SQL.
    tahun: tahun !== undefined && tahun >= 1990 && tahun <= 2100 ? tahun : undefined,
    hanyaBerlaku: params.berlaku === '1',
    // `?target=` yang tidak ada di daftar jabatan target AKTIF tetap lolos ke
    // kueri, dan itu benar: hasilnya nol baris + seluruh pegawai masuk "belum
    // dinilai", bukan galat. Yang tidak boleh adalah diam-diam jatuh kembali ke
    // sebaran organisasi — pengguna akan membaca angka generik sebagai angka
    // jabatan yang ia minta.
    jabatanTargetId: angkaPositif(params.target),
  }
}

function bacaKotak(nilai: string | undefined): number | null {
  const n = angkaPositif(nilai)
  return n !== undefined && n <= 9 ? n : null
}
