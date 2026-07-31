import Link from 'next/link'
import { Suspense } from 'react'

import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import { formatAngka } from '@/lib/format'
import { ambilDaftarJabatanTarget } from '@/lib/kueri/rubrik'
import { punyaPeran } from '@/lib/peran'
import { TabelTarget } from './_komponen/tabel-target'
import { TombolBuatTarget } from './_komponen/form-target'

export const metadata = { title: 'Jabatan Target' }

const PERAN_UBAH = ['Super Admin', 'Admin Talenta'] as const

/**
 * Daftar Jabatan Target (PRD §6.5).
 *
 * Kolom yang dipilih bukan sekadar isi tabel: ia menjawab "apakah jabatan target
 * ini siap dipakai?". Jumlah anggota, indikator, dan persyaratan adalah tiga hal
 * yang harus ada sebelum rubrik bisa diaktifkan, dan kapan skornya terakhir
 * dihitung menentukan apakah angka di halaman kandidat masih bisa dipercaya.
 */
export default async function JabatanTargetPage() {
  const pengguna = await getCurrentUser()
  const bolehUbah = punyaPeran(pengguna, PERAN_UBAH)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Jabatan Target"
        deskripsi="Profil jabatan yang menjadi sasaran suksesi: jabatan anggotanya, syarat minimalnya, dan rubrik penilaian yang dipakai menghitung match score kandidat."
        aksi={bolehUbah ? <TombolBuatTarget /> : null}
      />

      <Suspense fallback={<DaftarSkeleton />}>
        <IsiDaftar bolehUbah={bolehUbah} />
      </Suspense>
    </div>
  )
}

async function IsiDaftar({ bolehUbah }: { bolehUbah: boolean }) {
  const baris = await ambilDaftarJabatanTarget()

  const aktif = baris.filter((b) => b.status === 'AKTIF')
  const draft = baris.filter((b) => b.status === 'DRAFT')
  const belumDihitung = baris.filter((b) => b.dihitungPada === null)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">Aktif</p>
          <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
            {formatAngka(aktif.length)}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
            dari {formatAngka(baris.length)} jabatan target · hanya yang aktif dipakai menilai
            kandidat
          </p>
        </Panel>
        <Panel>
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">Draft</p>
          <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
            {formatAngka(draft.length)}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
            {draft.length === 0
              ? 'Tidak ada rubrik yang sedang disusun.'
              : 'Rubriknya belum lolos pemeriksaan atau belum punya jabatan anggota.'}
          </p>
        </Panel>
        <Panel>
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
            Belum pernah dihitung
          </p>
          <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
            {formatAngka(belumDihitung.length)}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
            {belumDihitung.length === 0
              ? 'Semua jabatan target sudah punya skor kandidat.'
              : 'Tanpa perhitungan, halaman kandidatnya kosong walau rubriknya sudah benar.'}
          </p>
        </Panel>
      </div>

      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <PanelHeader
            judul="Daftar jabatan target"
            deskripsi="Urutan: aktif dulu, lalu draft, lalu nonaktif. Klik namanya untuk membuka editor 3 tab."
          />
        </div>
        <TabelTarget baris={baris} bolehUbah={bolehUbah} />
      </Panel>

      <p className="text-[11px] leading-relaxed text-text-subtle">
        Match score sengaja <strong className="font-medium text-text-muted">tidak</strong> memuat
        unsur kinerja — ketiga komponennya (Potensi &amp; Kompetensi, Kualifikasi Jabatan, Integritas
        &amp; Moralitas) semuanya milik sumbu potensial. Karena itu halaman kandidat menampilkan
        Kotak 9 dan predikat kinerja berdampingan dengan skornya.{' '}
        <Link href="/peta-talenta" className="text-accent hover:underline">
          Lihat Peta Talenta
        </Link>{' '}
        untuk konteks kinerjanya.
      </p>
    </div>
  )
}

function DaftarSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Panel key={i}>
            <Skeleton className="h-3 w-24" />
            <Skeleton className="mt-2 h-7 w-12" />
            <Skeleton className="mt-2 h-3 w-full" />
          </Panel>
        ))}
      </div>
      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-2 h-3 w-full max-w-xl" />
        </div>
        <TableSkeleton rows={4} cols={['2.4fr', '1fr', '0.8fr', '0.8fr', '1fr', '1.2fr']} />
      </Panel>
    </div>
  )
}
