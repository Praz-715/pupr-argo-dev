import { ShieldAlert } from 'lucide-react'
import { Suspense } from 'react'

import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import { formatAngka } from '@/lib/format'
import { ambilOpsiPegawai, ambilRingkasDisiplin, ambilDaftarDisiplin } from '@/lib/kueri/disiplin'
import { punyaPeran } from '@/lib/peran'
import { TabelDisiplin } from './_komponen/tabel-disiplin'

export const metadata = { title: 'Data Hukuman Disiplin' }

const PERAN_DISIPLIN = ['Super Admin', 'Admin Talenta'] as const

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Data Hukuman Disiplin (PRD §6.4) — data ASN paling sensitif di aplikasi.
 *
 * **Halaman ini satu-satunya yang menjaga akses BACA, bukan hanya tulis.**
 * Di master unit & jabatan, membaca daftar tidak merugikan siapa pun, jadi
 * penjagaan cukup di server action. Di sini pembacaannya sendiri yang sensitif:
 * rekam jejak disiplin adalah data pribadi yang aksesnya dibatasi (PRD §7.3,
 * UU PDP No. 27/2022). Menyembunyikan menu saja tidak cukup — URL bisa ditebak,
 * jadi penolakannya terjadi di server sebelum kueri apa pun dijalankan.
 */
export default async function HukumanDisiplinPage({ searchParams }: { searchParams: ParamHalaman }) {
  const pengguna = await getCurrentUser()

  // Penolakan SEBELUM kueri — bukan setelah data diambil lalu disembunyikan
  // di UI. Data yang sudah terkirim ke klien tidak bisa ditarik kembali.
  if (!pengguna || !punyaPeran(pengguna, PERAN_DISIPLIN)) {
    return (
      <div className="space-y-5">
        <PageHeader
          judul="Data Hukuman Disiplin"
          deskripsi="Rekam jejak disiplin pegawai — akses dibatasi."
        />
        <div className="rounded-lg border border-danger-border bg-danger-subtle px-4 py-4">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" />
            <div>
              <p className="text-[14px] font-semibold text-text">Akses ditolak</p>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-text-muted">
                Rekam jejak hukuman disiplin adalah data pribadi ASN yang aksesnya dibatasi peran
                tertentu (UU PDP No. 27/2022). Peran Anda saat ini —{' '}
                <strong className="font-medium text-text">{pengguna?.peran ?? 'tanpa peran'}</strong>{' '}
                — tidak termasuk.
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-text-subtle">
                Nilai integritas yang dihitung dari catatan ini tetap terlihat di profil talenta
                sebagai <strong className="font-medium text-text-muted">angka</strong>, tanpa uraian
                pelanggarannya. Hubungi Admin Talenta bila perlu memeriksa dasarnya.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const params = await searchParams
  const cari = params.cari?.slice(0, 100) ?? ''
  const tingkat = ['Tidak Pernah', 'Ringan', 'Sedang', 'Berat', 'Sedang Menjalani'].includes(
    params.tingkat ?? '',
  )
    ? params.tingkat
    : undefined
  const hanyaAktif = params.aktif === '1'

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Data Hukuman Disiplin"
        deskripsi="Input manual karena belum ada sumber sistem resmi. Tingkat terberat yang berstatus aktif menentukan skor integritas pegawai pada rubrik Integritas & Moralitas."
      />

      <div className="flex items-start gap-2.5 rounded-lg border border-warning-border bg-warning-subtle px-3.5 py-3">
        <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        <p className="max-w-3xl text-[12px] leading-relaxed text-text-muted">
          <strong className="font-medium text-text">Data pribadi ASN.</strong> Halaman ini dibatasi
          peran Admin Talenta &amp; Super Admin. Setiap perubahan tercatat di jejak audit; isi kolom
          keterangan <strong className="font-medium text-text">tidak</strong> ikut disalin ke jejak
          audit supaya uraian pelanggaran tidak menyebar ke tabel dengan aturan akses berbeda.
        </p>
      </div>

      <Suspense fallback={<RingkasSkeleton />}>
        <IsiRingkas />
      </Suspense>

      <Suspense
        key={`${cari}|${tingkat}|${hanyaAktif}`}
        fallback={<TabelSkeletonDisiplin />}
      >
        <IsiTabel cari={cari} tingkat={tingkat} hanyaAktif={hanyaAktif} />
      </Suspense>
    </div>
  )
}

async function IsiRingkas() {
  const r = await ambilRingkasDisiplin()

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <Panel>
        <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
          Catatan aktif
        </p>
        <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
          {formatAngka(r.catatanAktif)}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
          dari {formatAngka(r.totalCatatan)} catatan · hanya yang aktif menurunkan skor integritas
        </p>
      </Panel>
      <Panel>
        <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
          Pegawai terdampak
        </p>
        <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
          {formatAngka(r.pegawaiTerdampak)}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
          pegawai punya minimal satu catatan (aktif maupun tidak)
        </p>
      </Panel>
      <Panel>
        <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
          Tanpa catatan
        </p>
        <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
          {formatAngka(r.tanpaCatatan)}
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-warning">
          Diperlakukan sebagai skor integritas 100 — itu <strong>asumsi</strong>, bukan fakta
          terverifikasi.
        </p>
      </Panel>
      <Panel>
        <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
          Sebaran tingkat
        </p>
        <ul className="mt-2 space-y-1">
          {r.perTingkat.map((t) => (
            <li key={t.tingkat} className="flex items-center justify-between gap-2 text-[11px]">
              <span className="text-text-muted">{t.tingkat}</span>
              <span className="tabular text-text">
                {formatAngka(t.aktif)}
                <span className="text-text-subtle"> / {formatAngka(t.jumlah)}</span>
              </span>
            </li>
          ))}
          {r.perTingkat.length === 0 ? (
            <li className="text-[11px] text-text-subtle">Belum ada catatan.</li>
          ) : null}
        </ul>
      </Panel>
    </div>
  )
}

async function IsiTabel({
  cari,
  tingkat,
  hanyaAktif,
}: {
  cari: string
  tingkat: string | undefined
  hanyaAktif: boolean
}) {
  const [baris, opsiPegawai] = await Promise.all([
    ambilDaftarDisiplin({ cari, tingkat, hanyaAktif }),
    ambilOpsiPegawai(),
  ])

  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <PanelHeader
          judul="Catatan hukuman disiplin"
          deskripsi="Diurutkan: catatan aktif dulu, lalu tingkat terberat. Skor integritas mengikuti tingkat TERBERAT yang berstatus aktif — bukan yang terbaru."
        />
      </div>
      <TabelDisiplin baris={baris} opsiPegawai={opsiPegawai} />
    </Panel>
  )
}

function RingkasSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Panel key={i}>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-full" />
        </Panel>
      ))}
    </div>
  )
}

function TabelSkeletonDisiplin() {
  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <Skeleton className="h-4 w-52" />
        <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
      </div>
      <TableSkeleton rows={6} cols={['2fr', '1.6fr', '1.2fr', '1.4fr', '0.8fr', '1.2fr']} />
    </Panel>
  )
}
