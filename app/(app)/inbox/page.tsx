import { Inbox as InboxIkon } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { formatAngka, formatNip } from '@/lib/format'
import { ambilNotifikasi, ambilTugas, hitungNotifikasiBelumDibaca } from '@/lib/kueri/suksesi'
import { LABEL_GILIRAN } from '@/lib/workflow'
import { DaftarNotifikasi } from './_komponen/daftar-notifikasi'

export const metadata = { title: 'Inbox Tugas' }

/**
 * Inbox Tugas & Notifikasi (usulan U-7).
 *
 * **Tugas dan notifikasi dipisah tegas** karena keduanya berbeda:
 *
 *   - *Tugas* adalah keadaan workflow yang menunggu tindakan pengguna. Ia hilang
 *     hanya kalau pekerjaannya dikerjakan.
 *   - *Notifikasi* adalah kabar. Ia bisa ditandai terbaca tanpa pekerjaannya
 *     selesai.
 *
 * Menggabungkan keduanya jadi satu daftar akan membuat "menandai terbaca" terasa
 * seperti menyelesaikan pekerjaan — dan itu cara paling rapi untuk kehilangan
 * nominasi yang menggantung.
 */
export default async function InboxPage() {
  const pengguna = await getCurrentUser()

  // Praktis tidak tercapai sejak Fase 7 — app shell sudah menuntut sesi lewat
  // `wajibMasuk()`. Dipertahankan sebagai jaring: TypeScript tetap menyatakan
  // `getCurrentUser()` bisa null, dan mengakalinya dengan `!` akan berubah jadi
  // galat runtime kalau suatu saat halaman ini dipakai di luar app shell.
  if (pengguna === null) {
    return (
      <div className="space-y-5">
        <PageHeader judul="Inbox Tugas" />
        <EmptyState
          judul="Sesi Anda sudah berakhir"
          deskripsi="Inbox berisi tugas dan notifikasi milik satu pengguna. Masuk lagi untuk melihat milik Anda."
          ikon={<InboxIkon className="size-5" />}
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Inbox Tugas"
        deskripsi={
          <>
            Yang menunggu tindakan Anda sebagai{' '}
            <strong className="font-medium text-text">{pengguna.peran}</strong>, beserta kabar
            terbaru dari alur nominasi & suksesi.
          </>
        }
      />

      <Suspense fallback={<InboxSkeleton />}>
        <IsiInbox
          userId={pengguna.id}
          peran={pengguna.peran}
          unitId={pengguna.unitOrganisasiId}
          namaPeran={pengguna.peran}
        />
      </Suspense>
    </div>
  )
}

async function IsiInbox({
  userId,
  peran,
  unitId,
  namaPeran,
}: {
  userId: number
  peran: Parameters<typeof ambilTugas>[0]
  unitId: number | null
  namaPeran: string
}) {
  const [tugas, notifikasi, belumDibaca] = await Promise.all([
    ambilTugas(peran, unitId),
    ambilNotifikasi(userId),
    hitungNotifikasiBelumDibaca(userId),
  ])

  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <PanelHeader
            judul={
              <span className="flex items-center gap-2">
                Menunggu tindakan Anda
                <Badge tone={tugas.length > 0 ? 'peringatan' : 'sukses'}>
                  {formatAngka(tugas.length)}
                </Badge>
              </span>
            }
            deskripsi="Keadaan workflow yang menunggu peran Anda. Berbeda dari notifikasi: baris di sini hilang hanya setelah keputusannya diambil, bukan setelah dibaca."
          />
        </div>

        {tugas.length === 0 ? (
          <div className="px-3.5 py-8 text-center">
            <p className="text-[13px] font-medium text-text">Tidak ada tugas menunggu</p>
            <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-text-subtle">
              {namaPeran === 'Viewer'
                ? 'Peran Viewer tidak mengambil keputusan dalam alur nominasi.'
                : 'Semua yang menjadi giliran Anda sudah diputuskan. Antrian bersih.'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {tugas.map((t) => (
              <li key={`${t.giliran}-${t.nominasiId ?? t.talentPoolId}`}>
                <Link
                  href={t.tautan}
                  className="flex items-start justify-between gap-3 px-3.5 py-3 hover:bg-surface-2"
                >
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text">{t.nama}</p>
                    <p className="tabular text-[11px] text-text-subtle">{formatNip(t.nip)}</p>
                    <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                      {t.keterangan} · {t.namaTarget}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Badge tone="netral">{LABEL_GILIRAN[t.giliran]}</Badge>
                    {t.lamaMenungguHari !== null ? (
                      <p
                        className={cn(
                          'tabular mt-1 text-[11px]',
                          t.lamaMenungguHari > 14 ? 'font-medium text-danger' : 'text-text-subtle',
                        )}
                      >
                        {formatAngka(t.lamaMenungguHari)} hari
                      </p>
                    ) : null}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <DaftarNotifikasi notifikasi={notifikasi} belumDibaca={belumDibaca} />
    </div>
  )
}

function InboxSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="mt-2 h-3 w-full max-w-md" />
        </div>
        <div className="p-3.5">
          <ListSkeleton rows={3} />
        </div>
      </Panel>
      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="p-3.5">
          <ListSkeleton rows={4} />
        </div>
      </Panel>
    </div>
  )
}
