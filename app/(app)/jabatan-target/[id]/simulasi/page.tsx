import { ArrowLeft, ArrowRight } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { formatAngka, formatSkor, formatTanggalWaktu } from '@/lib/format'
import {
  ambilJabatanTarget,
  ambilNilaiManual,
  ambilProfilKandidat,
  ambilRubrikUntukHitung,
  ambilSkorTersimpan,
} from '@/lib/kueri/rubrik'
import { ambilPengaturan } from '@/lib/pengaturan'
import { validasiRubrik } from '@/lib/scoring'
import { bandingkanSkor, hitungSkorMassal, type BarisDiff } from '@/lib/skor-massal'
import { TabelDiff } from './_komponen/tabel-diff'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  const target = await ambilJabatanTarget(Number(id))
  return { title: target === null ? 'Simulasi' : `Simulasi — ${target.namaTarget}` }
}

/**
 * Simulasi & Diff (usulan U-4).
 *
 * Mengubah bobot rubrik berarti **me-ranking ulang manusia**. Halaman ini
 * menjalankan rubrik yang tersimpan sekarang terhadap seluruh pegawai, lalu
 * membandingkannya dengan skor yang tersimpan di `match_score` — tanpa menulis
 * apa pun. Jadi dampaknya bisa dilihat sebelum Hitung Ulang dijalankan.
 *
 * Dua hal yang jujur disampaikan di halaman, karena kalau tidak, pembaca akan
 * salah menyimpulkan:
 *
 *   1. Rubrik disimpan **langsung** saat disunting (tidak ada salinan draft), jadi
 *      yang dibandingkan adalah "skor tersimpan" vs "hitungan dengan rubrik
 *      sekarang" — bukan "sebelum edit" vs "sesudah edit".
 *   2. Sebagian selisih bisa muncul **karena waktu berjalan**, bukan karena
 *      rubriknya diubah: indikator Lama Jabatan bertambah setiap hari.
 */
export default async function SimulasiPage({ params }: { params: Params }) {
  const { id } = await params
  const idTarget = Number(id)
  if (!Number.isInteger(idTarget) || idTarget <= 0) notFound()

  const target = await ambilJabatanTarget(idTarget)
  if (target === null) notFound()

  return (
    <div className="space-y-5">
      <Link
        href={`/jabatan-target/${idTarget}`}
        className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        Editor {target.namaTarget}
      </Link>

      <PageHeader
        judul="Simulasi & Diff"
        deskripsi="Menjalankan rubrik yang tersimpan sekarang terhadap seluruh pegawai aktif, lalu membandingkan hasilnya dengan skor yang ada di database. Tidak ada yang disimpan dari halaman ini."
        aksi={
          <Badge
            tone={
              target.status === 'AKTIF' ? 'sukses' : target.status === 'DRAFT' ? 'peringatan' : 'netral'
            }
          >
            {target.status}
          </Badge>
        }
      />

      {target.jumlahKomponen === 0 ? (
        <EmptyState
          judul="Rubrik belum disusun"
          deskripsi="Tanpa rubrik, tidak ada yang bisa disimulasikan — setiap skor akan bernilai 0."
        />
      ) : (
        <Suspense fallback={<SimulasiSkeleton />}>
          <IsiSimulasi idTarget={idTarget} dihitungPada={target.dihitungPada} />
        </Suspense>
      )}
    </div>
  )
}

async function IsiSimulasi({
  idTarget,
  dihitungPada,
}: {
  idTarget: number
  dihitungPada: string | null
}) {
  const siap = await ambilRubrikUntukHitung(idTarget)
  if (siap === null) notFound()

  const [profil, tersimpan, nilaiManual, pengaturan] = await Promise.all([
    ambilProfilKandidat(),
    ambilSkorTersimpan(idTarget),
    ambilNilaiManual(idTarget),
    ambilPengaturan(),
  ])

  // Parameter yang sama persis dengan Hitung Ulang (`lib/aksi/skoring.ts`).
  // Kalau salah satunya memakai angka berbeda, halaman ini akan melaporkan
  // "perubahan" yang tidak akan pernah terjadi saat tombolnya benar-benar ditekan.
  const hasil = hitungSkorMassal(siap.rubrik, profil, {
    nilaiManual,
    masaBerlakuTahun: pengaturan.masaBerlakuAsesmenTahun,
  })
  const diff = bandingkanSkor(tersimpan, hasil.hasil)
  const validasi = validasiRubrik(siap.komponen, { untukJabatanTarget: true })

  // Yang ditampilkan: hanya baris yang berubah, diurutkan menurut besarnya
  // guncangan. Menampilkan 40 baris "TETAP" akan menenggelamkan yang penting.
  const berubah = diff.baris
    .filter((b) => b.jenis !== 'TETAP')
    .sort((a, b) => bobotJenis(b) - bobotJenis(a))

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KartuDiff
          label="Baris berubah"
          nilai={`${formatAngka(diff.ringkas.jumlahBerubah)} / ${formatAngka(diff.ringkas.jumlahDibandingkan)}`}
          catatan={
            diff.ringkas.adaPerubahan
              ? 'skor, kelayakan, atau peringkatnya bergeser'
              : 'hitungan sekarang identik dengan yang tersimpan'
          }
          nada={diff.ringkas.adaPerubahan ? 'peringatan' : 'sukses'}
        />
        <KartuDiff
          label="Peringkat bergeser"
          nilai={`↑${formatAngka(diff.ringkas.naik)} ↓${formatAngka(diff.ringkas.turun)}`}
          catatan="di antara kandidat yang lolos syarat"
          nada={diff.ringkas.naik + diff.ringkas.turun > 0 ? 'peringatan' : 'netral'}
        />
        <KartuDiff
          label="Kelayakan berubah"
          nilai={`+${formatAngka(diff.ringkas.masuk)} / −${formatAngka(diff.ringkas.keluar)}`}
          catatan={`lolos syarat: ${formatAngka(diff.ringkas.eligibleSebelum)} → ${formatAngka(diff.ringkas.eligibleSesudah)}`}
          nada={diff.ringkas.keluar > 0 ? 'bahaya' : diff.ringkas.masuk > 0 ? 'peringatan' : 'netral'}
        />
        <KartuDiff
          label="Selisih skor terbesar"
          nilai={formatSkor(diff.ringkas.selisihTerbesar)}
          catatan={
            diff.ringkas.baru > 0
              ? `${formatAngka(diff.ringkas.baru)} pegawai belum pernah dinilai untuk target ini`
              : 'poin, pada skala 0–100'
          }
          nada={diff.ringkas.selisihTerbesar >= 5 ? 'peringatan' : 'netral'}
        />
      </div>

      <Panel>
        <PanelHeader
          judul="Apa yang dibandingkan"
          deskripsi={
            <>
              <strong className="font-medium text-text">Sebelum</strong> = isi{' '}
              <span className="tabular">match_score</span> di database, hasil perhitungan{' '}
              {dihitungPada === null ? 'yang belum pernah dijalankan' : formatTanggalWaktu(dihitungPada)}.{' '}
              <strong className="font-medium text-text">Sesudah</strong> = hitungan baru memakai
              rubrik, persyaratan, dan kata kunci yang tersimpan sekarang.
            </>
          }
        />
        <ul className="mt-3 space-y-1.5 text-[11px] leading-relaxed text-text-subtle">
          <li>
            • Editor rubrik menyimpan langsung ke database (tidak ada salinan draft), jadi ini
            bukan &ldquo;sebelum vs sesudah suntingan&rdquo; melainkan{' '}
            <strong className="font-medium text-text-muted">
              tersimpan vs hasil hitung sekarang
            </strong>
            .
          </li>
          <li>
            • Sebagian selisih bisa muncul karena <strong className="font-medium text-text-muted">waktu berjalan</strong>:
            indikator Lama Jabatan bertambah setiap hari, jadi skor bisa bergerak sedikit walau
            rubriknya tidak disentuh.
          </li>
          <li>
            • Peringkat dihitung di antara kandidat yang lolos syarat pada kedua sisi dengan cara
            yang sama — bukan diambil dari peringkat talent pool, yang hanya mencakup anggota pool.
          </li>
          <li>
            • Nilai yang pernah diisi manusia{' '}
            <strong className="font-medium text-text-muted">ikut dipakai</strong> di sisi
            &ldquo;sesudah&rdquo;, sama seperti saat Hitung Ulang dijalankan.
          </li>
        </ul>
      </Panel>

      {validasi.jumlahGalat > 0 ? (
        <div className="rounded-lg border border-danger-border bg-danger-subtle px-4 py-3">
          <p className="text-[12px] leading-relaxed text-text-muted">
            <strong className="font-medium text-text">
              Rubrik masih punya {validasi.jumlahGalat} galat.
            </strong>{' '}
            Angka di bawah tetap dihitung supaya dampaknya bisa dilihat, tapi belum layak dipakai
            mengambil keputusan penempatan. Perbaiki temuannya di{' '}
            <Link href={`/jabatan-target/${idTarget}?tab=rubrik`} className="text-accent hover:underline">
              tab Rubrik Penilaian
            </Link>
            .
          </p>
        </div>
      ) : null}

      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <PanelHeader
            judul={`Perubahan (${formatAngka(berubah.length)} baris)`}
            deskripsi={
              berubah.length === 0
                ? 'Tidak ada perubahan — hitungan dengan rubrik sekarang menghasilkan angka yang sama dengan yang tersimpan.'
                : 'Diurutkan menurut besarnya dampak: keluar/masuk kelayakan lebih dulu, lalu pergeseran peringkat, lalu perubahan skor saja. Baris yang tidak berubah disembunyikan.'
            }
            aksi={
              <Link
                href={`/jabatan-target/${idTarget}/kandidat`}
                className="flex items-center gap-1 text-[12px] text-accent hover:underline"
              >
                Lihat kandidat
                <ArrowRight className="size-3" />
              </Link>
            }
          />
        </div>

        {berubah.length === 0 ? (
          <p className="px-3.5 py-8 text-center text-[12px] leading-relaxed text-text-subtle">
            {formatAngka(diff.ringkas.jumlahDibandingkan)} baris skor diperiksa, semuanya identik.
            Ini juga berarti pipeline yang dipakai halaman ini melahirkan angka yang sama dengan yang
            tersimpan di database.
          </p>
        ) : (
          <TabelDiff baris={berubah} jabatanTargetId={idTarget} />
        )}
      </Panel>

      <p className="text-[11px] leading-relaxed text-text-subtle">
        Basis data: {formatAngka(profil.length)} pegawai aktif ·{' '}
        {formatAngka(tersimpan.length)} baris skor tersimpan ·{' '}
        {formatAngka(hasil.jumlahPerluReview)} kandidat punya indikator yang perlu ditinjau pada
        hitungan baru. Halaman ini tidak menulis apa pun ke database.
      </p>
    </div>
  )
}

/** Urutan dampak: kelayakan berubah paling penting, lalu peringkat, lalu skor. */
function bobotJenis(b: BarisDiff): number {
  const dasar =
    b.jenis === 'KELUAR'
      ? 4000
      : b.jenis === 'MASUK'
        ? 3000
        : b.jenis === 'BARU'
          ? 2000
          : b.jenis === 'NAIK' || b.jenis === 'TURUN'
            ? 1000
            : 0
  return dasar + Math.abs(b.geserRanking ?? 0) * 10 + Math.abs(b.selisihTotal ?? 0)
}

function KartuDiff({
  label,
  nilai,
  catatan,
  nada,
}: {
  label: string
  nilai: string
  catatan: string
  nada: 'sukses' | 'peringatan' | 'bahaya' | 'netral'
}) {
  const warna = {
    sukses: 'text-success',
    peringatan: 'text-warning',
    bahaya: 'text-danger',
    netral: 'text-text-subtle',
  }[nada]

  return (
    <Panel>
      <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">{label}</p>
      <p className="tabular mt-1.5 text-xl leading-none font-semibold text-text">{nilai}</p>
      <p className={`mt-1.5 text-[11px] leading-relaxed ${warna}`}>{catatan}</p>
    </Panel>
  )
}

function SimulasiSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Panel key={i}>
            <Skeleton className="h-3 w-28" />
            <Skeleton className="mt-2 h-6 w-20" />
            <Skeleton className="mt-2 h-3 w-full" />
          </Panel>
        ))}
      </div>
      <Panel>
        <Skeleton className="h-4 w-40" />
        <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
        <Skeleton className="mt-3 h-3 w-full" />
        <Skeleton className="mt-1.5 h-3 w-4/5" />
      </Panel>
      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
        </div>
        <TableSkeleton rows={6} cols={['1.8fr', '1fr', '1fr', '1fr', '1fr', '1.2fr']} />
      </Panel>
    </div>
  )
}
