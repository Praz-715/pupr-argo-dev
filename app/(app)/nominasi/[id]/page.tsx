import { ArrowLeft, Check, CircleDashed, MessageSquare, X } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { AksiWorkflowTombol } from '@/components/suksesi/aksi-workflow'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton } from '@/components/ui/skeleton'
import { getCurrentUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { formatNip, formatSkor, formatTanggal, formatTanggalWaktu } from '@/lib/format'
import { ambilEntriPool, ambilNominasi, ambilRiwayatApproval } from '@/lib/kueri/suksesi'
import {
  aksiTersedia,
  LABEL_GILIRAN,
  LABEL_NOMINASI,
  LABEL_POOL,
  NADA_POOL,
  timelineTahap,
  type StatusApproval,
} from '@/lib/workflow'

type Params = Promise<{ id: string }>

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  const n = await ambilNominasi(Number(id))
  return { title: n === null ? 'Nominasi' : `Nominasi ${n.nama}` }
}

/**
 * Detail nominasi: timeline persetujuan + form keputusan (PRD §6.6).
 *
 * Timeline menampilkan **tahap yang belum dijalani** juga, bukan hanya yang sudah
 * ada di `approval_log`. Tanpa itu, nominasi yang baru lolos verifikasi akan
 * terlihat seperti sudah tuntas — padahal masih menunggu Pimpinan.
 */
export default async function DetailNominasiPage({ params }: { params: Params }) {
  const { id } = await params
  const idNominasi = Number(id)
  if (!Number.isInteger(idNominasi) || idNominasi <= 0) notFound()

  const nominasi = await ambilNominasi(idNominasi)
  if (nominasi === null) notFound()

  return (
    <div className="space-y-5">
      <Link
        href="/nominasi"
        className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        Antrian nominasi
      </Link>

      <PageHeader
        judul={
          <span className="flex flex-wrap items-center gap-2.5">
            {nominasi.nama}
            <Badge tone={NADA_POOL[nominasi.statusPool]}>{LABEL_POOL[nominasi.statusPool]}</Badge>
          </span>
        }
        deskripsi={
          <>
            <span className="tabular">{formatNip(nominasi.nip)}</span> · dinominasikan untuk{' '}
            <strong className="font-medium text-text">{nominasi.namaTarget}</strong> oleh{' '}
            {nominasi.namaUnitPengaju}
            {nominasi.namaPengaju === null ? '' : ` (${nominasi.namaPengaju})`} pada{' '}
            {formatTanggal(nominasi.tanggalDiajukan)}
          </>
        }
      />

      <Suspense fallback={<Skeleton className="h-32 w-full rounded-lg" />}>
        <IsiDetail idNominasi={idNominasi} talentPoolId={nominasi.talentPoolId} />
      </Suspense>
    </div>
  )
}

async function IsiDetail({
  idNominasi,
  talentPoolId,
}: {
  idNominasi: number
  talentPoolId: number
}) {
  const [nominasi, riwayat, entri, pengguna] = await Promise.all([
    ambilNominasi(idNominasi),
    ambilRiwayatApproval(idNominasi),
    ambilEntriPool(talentPoolId),
    getCurrentUser(),
  ])
  if (nominasi === null || entri === null) notFound()

  const langkah = timelineTahap(riwayat.map((r) => ({ tahap: r.tahap, status: r.status })))
  const opsiAksi = aksiTersedia(
    { statusPool: entri.status, statusNominasi: entri.statusNominasi },
    pengguna?.peran ?? null,
  ).map((d) => ({
    aksi: d.aksi,
    label: d.label,
    akibat: d.akibat,
    butuhCatatan: d.butuhCatatan,
    destruktif: d.destruktif,
  }))

  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-4">
        {/* Keputusan */}
        <Panel>
          <PanelHeader
            judul="Keputusan"
            deskripsi={
              nominasi.giliran === 'SELESAI'
                ? 'Alur nominasi ini sudah selesai — tidak menunggu siapa pun.'
                : `Sekarang menunggu ${LABEL_GILIRAN[nominasi.giliran]}.`
            }
          />
          <div className="mt-3">
            {opsiAksi.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-text-subtle">
                {nominasi.giliran === 'SELESAI'
                  ? 'Tidak ada keputusan yang perlu diambil.'
                  : `Peran Anda (${pengguna?.peran ?? 'tanpa peran'}) bukan yang ditunggu pada tahap ini. Yang menunggu: ${LABEL_GILIRAN[nominasi.giliran]}.`}
              </p>
            ) : (
              <AksiWorkflowTombol
                talentPoolId={talentPoolId}
                namaKandidat={nominasi.nama}
                opsi={opsiAksi}
                ukuran="md"
              />
            )}
          </div>
        </Panel>

        {/* Timeline */}
        <Panel>
          <PanelHeader
            judul="Timeline persetujuan"
            deskripsi="Kedua tahap selalu ditampilkan, termasuk yang belum dijalani — supaya tidak ada yang menyimpulkan alurnya sudah tuntas padahal masih ada langkah di depan."
          />
          <ol className="mt-3 space-y-3">
            {langkah.map((l) => {
              const jejakTahap = riwayat.filter((r) => r.tahap === l.tahap)
              return (
                <li key={l.tahap} className="flex gap-3">
                  <span
                    className={cn(
                      'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border',
                      l.status === 'DISETUJUI'
                        ? 'border-success-border bg-success-subtle text-success'
                        : l.status === 'DITOLAK'
                          ? 'border-danger-border bg-danger-subtle text-danger'
                          : l.status === 'REVISI'
                            ? 'border-warning-border bg-warning-subtle text-warning'
                            : 'border-border bg-surface-2 text-text-subtle',
                    )}
                  >
                    {l.status === 'DISETUJUI' ? (
                      <Check className="size-3.5" />
                    ) : l.status === 'DITOLAK' ? (
                      <X className="size-3.5" />
                    ) : l.status === 'REVISI' ? (
                      <MessageSquare className="size-3" />
                    ) : (
                      <CircleDashed className="size-3.5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1 border-b border-border pb-3 last:border-b-0">
                    <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-text">
                      {l.tahap}
                      <span className="text-[11px] font-normal text-text-subtle">
                        {l.keterangan}
                      </span>
                    </p>
                    {jejakTahap.length === 0 ? (
                      <p className="mt-0.5 text-[11px] leading-relaxed text-text-subtle">
                        Tahap ini akan aktif setelah tahap sebelumnya disetujui.
                      </p>
                    ) : (
                      <ul className="mt-1.5 space-y-1.5">
                        {jejakTahap.map((r) => (
                          <li key={r.id} className="text-[11px] leading-relaxed">
                            <span className="flex flex-wrap items-baseline gap-1.5">
                              <Badge tone={NADA_APPROVAL[r.status]}>{r.status}</Badge>
                              <span className="text-text-muted">
                                {r.namaApprover ?? 'belum ada penindak'}
                                {r.peranApprover === null ? '' : ` · ${r.peranApprover}`}
                              </span>
                              <span className="tabular text-text-subtle">
                                {formatTanggalWaktu(r.tanggalAksi)}
                              </span>
                            </span>
                            {r.catatan !== null ? (
                              <span className="mt-0.5 block text-text-muted">{r.catatan}</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        </Panel>
      </div>

      {/* Konteks kandidat */}
      <div className="space-y-4">
        <Panel>
          <PanelHeader
            judul="Konteks kandidat"
            deskripsi="Match score tidak memuat unsur kinerja, jadi Kotak 9 & predikat ditampilkan berdampingan."
          />
          <dl className="mt-3 space-y-2.5 text-[12px]">
            <Baris label="Match score">
              <span className="tabular font-semibold text-text">
                {nominasi.skorTotal === null ? '—' : formatSkor(nominasi.skorTotal)}
              </span>
            </Baris>
            <Baris label="Kotak 9">
              <span className="tabular text-text">{nominasi.kotak9 ?? '—'}</span>
            </Baris>
            <Baris label="Predikat kinerja">
              <span className="text-text-muted">{nominasi.predikatKinerja ?? '—'}</span>
            </Baris>
            <Baris label="Peringkat di pool">
              <span className="tabular text-text">{entri.ranking ?? '—'}</span>
            </Baris>
            <Baris label="Status nominasi">
              <span className="text-text-muted">{LABEL_NOMINASI[nominasi.status]}</span>
            </Baris>
            <Baris label="Lama menunggu">
              <span className="tabular text-text">
                {nominasi.giliran === 'SELESAI'
                  ? '—'
                  : `${nominasi.lamaMenungguHari ?? 0} hari`}
              </span>
            </Baris>
          </dl>

          <div className="mt-3 flex flex-wrap gap-2 border-t border-border pt-3 text-[12px]">
            <Link href={`/talenta/${nominasi.nip}`} className="text-accent hover:underline">
              Profil 360°
            </Link>
            <span className="text-text-subtle">·</span>
            <Link
              href={`/jabatan-target/${nominasi.jabatanTargetId}/kandidat?cari=${nominasi.nip}&rincian=${nominasi.nip}#rincian`}
              className="text-accent hover:underline"
            >
              Rincian perhitungan skor
            </Link>
            <span className="text-text-subtle">·</span>
            <Link
              href={`/talent-pool?target=${nominasi.jabatanTargetId}`}
              className="text-accent hover:underline"
            >
              Talent pool
            </Link>
          </div>
        </Panel>

        {nominasi.catatan !== null ? (
          <Panel>
            <PanelHeader judul="Catatan pengaju" />
            <p className="mt-2 text-[12px] leading-relaxed text-text-muted">{nominasi.catatan}</p>
          </Panel>
        ) : null}

        {entri.catatanReviewer !== null ? (
          <Panel>
            <PanelHeader
              judul="Riwayat catatan pada entri pool"
              deskripsi="Ditumpuk, tidak ditimpa — tiap keputusan menambah satu baris."
            />
            <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
              {entri.catatanReviewer}
            </p>
          </Panel>
        ) : null}
      </div>
    </div>
  )
}

const NADA_APPROVAL: Record<StatusApproval, 'netral' | 'sukses' | 'bahaya' | 'peringatan'> = {
  MENUNGGU: 'netral',
  DISETUJUI: 'sukses',
  DITOLAK: 'bahaya',
  REVISI: 'peringatan',
}

function Baris({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-text-subtle">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}
