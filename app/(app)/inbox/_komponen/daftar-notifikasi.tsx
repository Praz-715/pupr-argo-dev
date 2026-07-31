'use client'

import { BellOff, CheckCheck } from 'lucide-react'
import Link from 'next/link'
import { useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { useToast } from '@/components/ui/toast'
import { tandaiNotifikasiDibaca, tandaiSemuaDibaca } from '@/lib/aksi/suksesi'
import { cn } from '@/lib/cn'
import { formatAngka, formatTanggalWaktu } from '@/lib/format'
import type { BarisNotifikasi } from '@/lib/kueri/suksesi'

/**
 * Daftar notifikasi dengan penanda terbaca.
 *
 * Notifikasi yang belum dibaca tampil lebih dulu dan ditandai; yang sudah dibaca
 * **tidak dihapus** dari daftar. Menyembunyikannya akan menghilangkan satu-satunya
 * jejak "saya sudah diberi tahu soal ini" yang bisa ditunjukkan pengguna.
 */

const LABEL_JENIS: Record<string, string> = {
  NOMINASI_MASUK: 'Nominasi masuk',
  NOMINASI_REVISI: 'Perlu revisi',
  NOMINASI_DISETUJUI: 'Lolos verifikasi',
  NOMINASI_DITOLAK: 'Ditolak',
  MENUNGGU_PENETAPAN: 'Menunggu penetapan',
  SUKSESOR_DITETAPKAN: 'Suksesor ditetapkan',
  PENETAPAN_DIBATALKAN: 'Penetapan dibatalkan',
}

const NADA_JENIS: Record<string, 'netral' | 'aksen' | 'sukses' | 'peringatan' | 'bahaya'> = {
  NOMINASI_MASUK: 'aksen',
  NOMINASI_REVISI: 'peringatan',
  NOMINASI_DISETUJUI: 'sukses',
  NOMINASI_DITOLAK: 'bahaya',
  MENUNGGU_PENETAPAN: 'peringatan',
  SUKSESOR_DITETAPKAN: 'sukses',
  PENETAPAN_DIBATALKAN: 'bahaya',
}

export function DaftarNotifikasi({
  notifikasi,
  belumDibaca,
}: {
  notifikasi: BarisNotifikasi[]
  belumDibaca: number
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()

  function tandaiSatu(id: number) {
    mulaiTransisi(async () => {
      await tandaiNotifikasiDibaca(id)
    })
  }

  function tandaiSemua() {
    mulaiTransisi(async () => {
      const hasil = await tandaiSemuaDibaca()
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Ditandai terbaca.' }
          : { nada: 'bahaya', judul: 'Gagal', keterangan: hasil.pesan },
      )
    })
  }

  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <PanelHeader
          judul={
            <span className="flex items-center gap-2">
              Notifikasi
              {belumDibaca > 0 ? (
                <Badge tone="aksen">{formatAngka(belumDibaca)} baru</Badge>
              ) : null}
            </span>
          }
          deskripsi="Kabar dari alur nominasi. Menandai terbaca TIDAK menyelesaikan tugasnya — pekerjaan yang menunggu ada di panel sebelah."
          aksi={
            belumDibaca > 0 ? (
              <Button
                size="sm"
                variant="sekunder"
                onClick={tandaiSemua}
                pending={pending}
                labelPending="Menandai…"
                ikon={<CheckCheck className="size-3.5" />}
              >
                Tandai semua
              </Button>
            ) : null
          }
        />
      </div>

      {notifikasi.length === 0 ? (
        <div className="px-3.5 py-8 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-surface-3 text-text-subtle">
            <BellOff className="size-5" />
          </div>
          <p className="text-[13px] font-medium text-text">Belum ada notifikasi</p>
          <p className="mx-auto mt-1 max-w-sm text-[12px] leading-relaxed text-text-subtle">
            Notifikasi muncul saat ada nominasi baru, keputusan verifikasi, atau penetapan suksesor
            yang melibatkan peran Anda.
          </p>
        </div>
      ) : (
        <ul className={cn('divide-y divide-border', pending && 'opacity-70')}>
          {notifikasi.map((n) => {
            const baru = n.dibacaPada === null
            const isi = (
              <>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={NADA_JENIS[n.jenis] ?? 'netral'}>
                      {LABEL_JENIS[n.jenis] ?? n.jenis}
                    </Badge>
                    {baru ? (
                      <span
                        aria-label="Belum dibaca"
                        className="size-1.5 rounded-full bg-accent"
                      />
                    ) : null}
                  </span>
                  <span className="tabular shrink-0 text-[10px] text-text-subtle">
                    {formatTanggalWaktu(n.createdAt)}
                  </span>
                </div>
                <p className={cn('mt-1 text-[12px]', baru ? 'font-medium text-text' : 'text-text-muted')}>
                  {n.judul}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-text-subtle">{n.pesan}</p>
                {n.peranTujuan !== null ? (
                  <p className="mt-1 text-[10px] text-text-subtle">
                    Diterima sebagai {n.peranTujuan}
                    {n.namaPembuat === null ? '' : ` · dari ${n.namaPembuat}`}
                  </p>
                ) : null}
              </>
            )

            return (
              <li key={n.id} className={cn('px-3.5 py-3', baru && 'bg-accent-subtle/30')}>
                {n.tautan === null ? (
                  <div>{isi}</div>
                ) : (
                  <Link
                    href={n.tautan}
                    onClick={() => {
                      if (baru) tandaiSatu(n.id)
                    }}
                    className="block"
                  >
                    {isi}
                  </Link>
                )}
                {baru ? (
                  <Button
                    size="sm"
                    variant="halus"
                    className="mt-1.5 text-[11px]"
                    onClick={() => tandaiSatu(n.id)}
                    pending={pending}
                  >
                    Tandai terbaca
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
