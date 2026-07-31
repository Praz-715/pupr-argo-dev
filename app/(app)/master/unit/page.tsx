import { TriangleAlert } from 'lucide-react'
import { Suspense } from 'react'

import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'
import { formatAngka } from '@/lib/format'
import { ambilOpsiIndukUnit, ambilPohonUnit, ambilUnitYatim } from '@/lib/kueri/master'
import { PohonUnit } from './_komponen/pohon-unit'

export const metadata = { title: 'Master Unit Organisasi' }

/**
 * Master Unit Organisasi (PRD §6.4) — hanya Super Admin.
 *
 * Wewenangnya ditegakkan di **server action**, bukan dengan menyembunyikan menu:
 * item navigasi memang hilang untuk peran lain, tapi `buatUnit`/`ubahUnit`/
 * `hapusUnit` masing-masing memeriksa perannya sendiri (phase.md §5.6). Halaman
 * ini tetap bisa dibaca peran lain kalau URL-nya ditebak — yang tidak bisa adalah
 * mengubah apa pun.
 */
export default async function MasterUnitPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        judul="Master Unit Organisasi"
        deskripsi="Hierarki unit kerja & UPT. Filter unit di seluruh aplikasi mengikuti pohon ini — termasuk seluruh unit di bawahnya."
      />

      <Suspense fallback={<PohonSkeleton />}>
        <IsiPohon />
      </Suspense>
    </div>
  )
}

async function IsiPohon() {
  const [node, opsiInduk, yatim] = await Promise.all([
    ambilPohonUnit(),
    ambilOpsiIndukUnit(),
    ambilUnitYatim(),
  ])

  return (
    <div className="space-y-4">
      {/* Unit yatim ditampilkan TERPISAH dan di atas: ia tidak muncul di pohon
          (kueri pohon mulai dari akar), jadi tanpa panel ini unitnya hilang dari
          halaman tanpa jejak — beserta pegawainya. */}
      {yatim.length > 0 ? (
        <div className="rounded-lg border border-warning-border bg-warning-subtle px-3.5 py-3">
          <div className="flex items-start gap-2.5">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-text">
                {formatAngka(yatim.length)} unit tidak terjangkau dari akar pohon
              </p>
              <p className="mt-0.5 text-[12px] leading-relaxed text-text-muted">
                Induknya menunjuk unit yang tidak ada, atau tersangkut siklus. Unit ini{' '}
                <strong className="font-medium">tidak muncul di pohon di bawah</strong> dan
                pegawainya tidak ikut terhitung pada agregasi per unit mana pun. Betulkan induknya.
              </p>
              <ul className="mt-2 space-y-1">
                {yatim.map((y) => (
                  <li key={y.id} className="text-[12px] text-text-muted">
                    <span className="font-medium text-text">{y.namaUnit}</span>
                    <span className="tabular text-text-subtle">
                      {' '}
                      · {y.kodeUnit} · induk #{y.parentId ?? '—'} · {formatAngka(y.jumlahPegawai)}{' '}
                      pegawai
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      ) : null}

      <Panel padat>
        <PohonUnit node={node} opsiInduk={opsiInduk} />
      </Panel>

      <Panel>
        <PanelHeader
          judul="Aturan yang ditegakkan saat menyimpan"
          deskripsi="Diperiksa di server, jadi berlaku juga kalau server action dipanggil langsung."
        />
        <ul className="mt-2.5 space-y-1.5 text-[12px] leading-relaxed text-text-muted">
          <li>
            <strong className="font-medium text-text">Induk tidak boleh turunan sendiri.</strong>{' '}
            Menyetel induk ke salah satu unit di bawahnya akan melepaskan cabang itu dari pohon —
            unitnya masih ada di tabel tapi tidak pernah muncul di tampilan mana pun, dan filter unit
            hierarkis akan berputar tanpa henti.
          </li>
          <li>
            <strong className="font-medium text-text">Kode unit unik.</strong> Kode ganda membuat
            pemetaan dari sistem sumber menempel ke unit yang salah.
          </li>
          <li>
            <strong className="font-medium text-text">
              Tidak bisa dihapus kalau masih dipakai.
            </strong>{' '}
            Unit yang masih punya turunan atau jabatan akan ditolak, dengan jumlahnya disebut supaya
            jelas apa yang harus dibereskan lebih dulu.
          </li>
          <li>
            Setiap perubahan tercatat otomatis di <code className="font-mono text-[11px]">audit_log</code>{' '}
            beserta isi sebelum &amp; sesudahnya.
          </li>
        </ul>
      </Panel>
    </div>
  )
}

function PohonSkeleton() {
  return (
    <Panel padat>
      <div className="flex items-center justify-between border-b border-border px-3.5 py-3">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-8 w-28" />
      </div>
      {/* Indentasi skeleton meniru kedalaman pohon supaya tidak ada pergeseran
          tata letak begitu data masuk (phase.md §5.3). */}
      {['ml-0', 'ml-5', 'ml-10', 'ml-10', 'ml-5', 'ml-10', 'ml-10', 'ml-0', 'ml-5', 'ml-10'].map(
        (indent, i) => (
          <div key={i} className="flex items-center gap-2 border-b border-border px-3.5 py-2.5">
            <Skeleton className={`h-4 flex-1 ${indent}`} />
            <Skeleton className="h-3 w-32" />
          </div>
        ),
      )}
    </Panel>
  )
}
