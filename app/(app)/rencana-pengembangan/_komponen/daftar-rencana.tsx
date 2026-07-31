'use client'

import { Pencil, Plus, Sprout, Trash2, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogKonfirmasi } from '@/components/ui/dialog'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { useToast } from '@/components/ui/toast'
import { hapusRencana, simpanRencana } from '@/lib/aksi/suksesi'
import { cn } from '@/lib/cn'
import { formatNip, formatTanggal } from '@/lib/format'
import type { BarisPool, BarisRencana, JenisPengembangan, StatusRencana } from '@/lib/kueri/suksesi'

/**
 * Daftar rencana pengembangan, dikelompokkan per suksesor.
 *
 * Kolom "sisa hari" ditampilkan sebagai angka, bukan hanya tanggal target: yang
 * perlu diketahui adalah apakah tenggatnya sudah lewat, dan itu tidak terbaca dari
 * tanggal tanpa menghitung di kepala.
 */

const JENIS: Array<{ nilai: JenisPengembangan; label: string; keterangan: string }> = [
  { nilai: 'DIKLAT', label: 'Diklat', keterangan: 'Pendidikan & pelatihan formal' },
  { nilai: 'ROTASI', label: 'Rotasi', keterangan: 'Perpindahan penugasan untuk memperluas pengalaman' },
  { nilai: 'MENTORING', label: 'Mentoring', keterangan: 'Pendampingan oleh pejabat lebih senior' },
  { nilai: 'PENUGASAN', label: 'Penugasan', keterangan: 'Penugasan khusus/proyek tertentu' },
]

const NADA_STATUS: Record<StatusRencana, 'netral' | 'aksen' | 'sukses'> = {
  DIRENCANAKAN: 'netral',
  BERJALAN: 'aksen',
  SELESAI: 'sukses',
}

export function DaftarRencana({
  suksesor,
  rencana,
  rencanaYatim,
  poolTerpilih,
  bolehUbah,
}: {
  suksesor: BarisPool[]
  rencana: BarisRencana[]
  rencanaYatim: BarisRencana[]
  poolTerpilih: number | null
  bolehUbah: boolean
}) {
  const [form, setForm] = useState<{
    talentPoolId: number
    nama: string
    rencana: BarisRencana | null
  } | null>(null)
  const [hapus, setHapus] = useState<BarisRencana | null>(null)
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()

  function jalankanHapus() {
    if (hapus === null) return
    mulaiTransisi(async () => {
      const hasil = await hapusRencana(hapus.id)
      setHapus(null)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Dihapus.' }
          : { nada: 'bahaya', judul: 'Tidak bisa dihapus', keterangan: hasil.pesan },
      )
    })
  }

  return (
    <div className={cn('space-y-4', pending && 'opacity-70')}>
      {suksesor.map((s) => {
        const milikDia = rencana.filter((r) => r.talentPoolId === s.talentPoolId)
        const disorot = poolTerpilih === s.talentPoolId

        return (
          <Panel
            key={s.talentPoolId}
            padat
            className={disorot ? 'border-accent-border ring-1 ring-accent-border' : undefined}
          >
            <div className="border-b border-border px-3.5 py-3">
              <PanelHeader
                judul={
                  <span className="flex flex-wrap items-center gap-2">
                    <Link href={`/talenta/${s.nip}`} className="hover:text-accent">
                      {s.nama}
                    </Link>
                    <Badge tone="sukses">Ditetapkan</Badge>
                    <Badge tone="netral">{milikDia.length} rencana</Badge>
                  </span>
                }
                deskripsi={
                  <>
                    <span className="tabular">{formatNip(s.nip)}</span> · suksesor{' '}
                    {s.namaTarget}
                    {s.ditetapkanPada === null
                      ? ''
                      : ` · ditetapkan ${formatTanggal(s.ditetapkanPada)}`}
                  </>
                }
                aksi={
                  bolehUbah ? (
                    <Button
                      size="sm"
                      variant="sekunder"
                      onClick={() =>
                        setForm({ talentPoolId: s.talentPoolId, nama: s.nama, rencana: null })
                      }
                      ikon={<Plus className="size-3.5" />}
                    >
                      Tambah rencana
                    </Button>
                  ) : null
                }
              />
            </div>

            {milikDia.length === 0 ? (
              <p className="px-3.5 py-5 text-center text-[12px] leading-relaxed text-text-subtle">
                Belum ada rencana pengembangan. Suksesor yang sudah ditetapkan tanpa rencana berarti
                penetapannya belum ditindaklanjuti — itu yang membuat suksesi berhenti sebagai daftar
                nama.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {milikDia.map((r) => (
                  <BarisRencanaItem
                    key={r.id}
                    r={r}
                    bolehUbah={bolehUbah}
                    onUbah={() =>
                      setForm({ talentPoolId: s.talentPoolId, nama: s.nama, rencana: r })
                    }
                    onHapus={() => setHapus(r)}
                  />
                ))}
              </ul>
            )}
          </Panel>
        )
      })}

      {rencanaYatim.length > 0 ? (
        <Panel padat>
          <div className="border-b border-warning-border bg-warning-subtle px-3.5 py-3">
            <PanelHeader
              judul={
                <span className="flex items-center gap-2">
                  <TriangleAlert className="size-4 text-warning" />
                  Rencana milik kandidat yang tidak lagi berstatus Ditetapkan
                </span>
              }
              deskripsi="Penetapannya dibatalkan atau statusnya berubah. Rencananya TIDAK dihapus — ia tetap jadi riwayat pengembangan yang sudah berjalan."
            />
          </div>
          <ul className="divide-y divide-border">
            {rencanaYatim.map((r) => (
              <BarisRencanaItem
                key={r.id}
                r={r}
                bolehUbah={bolehUbah}
                tampilkanNama
                onUbah={() =>
                  setForm({ talentPoolId: r.talentPoolId, nama: r.nama, rencana: r })
                }
                onHapus={() => setHapus(r)}
              />
            ))}
          </ul>
        </Panel>
      ) : null}

      {form !== null ? (
        <FormRencana
          talentPoolId={form.talentPoolId}
          nama={form.nama}
          rencana={form.rencana}
          onTutup={() => setForm(null)}
        />
      ) : null}

      <DialogKonfirmasi
        buka={hapus !== null}
        onTutup={() => setHapus(null)}
        onKonfirmasi={jalankanHapus}
        pending={pending}
        destruktif
        judul="Hapus rencana pengembangan ini?"
        deskripsi={
          hapus?.status === 'SELESAI'
            ? 'Rencana yang sudah selesai tidak bisa dihapus — ia rekam jejak pengembangan suksesor.'
            : 'Rencana yang belum selesai bisa dihapus. Riwayat perubahannya tetap tercatat di jejak audit.'
        }
        labelKonfirmasi="Hapus"
      />
    </div>
  )
}

function BarisRencanaItem({
  r,
  bolehUbah,
  tampilkanNama = false,
  onUbah,
  onHapus,
}: {
  r: BarisRencana
  bolehUbah: boolean
  tampilkanNama?: boolean
  onUbah: () => void
  onHapus: () => void
}) {
  const terlewat = r.status !== 'SELESAI' && r.sisaHari !== null && r.sisaHari < 0

  return (
    <li className="flex items-start justify-between gap-3 px-3.5 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="aksen">{JENIS.find((j) => j.nilai === r.jenisPengembangan)?.label}</Badge>
          <Badge tone={NADA_STATUS[r.status]}>{r.status.toLowerCase()}</Badge>
          {tampilkanNama ? (
            <span className="text-[12px] font-medium text-text">{r.nama}</span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[12px] leading-relaxed text-text-muted">{r.deskripsi}</p>
        <p className="mt-1 text-[11px] text-text-subtle">
          {r.targetSelesai === null ? (
            'Tanpa target tanggal'
          ) : (
            <>
              Target {formatTanggal(r.targetSelesai)}
              {r.status === 'SELESAI' ? null : (
                <span className={terlewat ? 'ml-1.5 font-medium text-danger' : 'ml-1.5 text-text-muted'}>
                  {terlewat
                    ? `terlewat ${Math.abs(r.sisaHari ?? 0)} hari`
                    : `${r.sisaHari} hari lagi`}
                </span>
              )}
            </>
          )}
          {r.namaPembuat === null ? '' : ` · dibuat ${r.namaPembuat}`}
        </p>
      </div>

      {bolehUbah ? (
        <div className="flex shrink-0 gap-1">
          <Button
            size="ikon"
            variant="halus"
            onClick={onUbah}
            aria-label={`Ubah rencana ${r.jenisPengembangan}`}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            size="ikon"
            variant="halus"
            onClick={onHapus}
            aria-label={`Hapus rencana ${r.jenisPengembangan}`}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </li>
  )
}

function FormRencana({
  talentPoolId,
  nama,
  rencana,
  onTutup,
}: {
  talentPoolId: number
  nama: string
  rencana: BarisRencana | null
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})

  const [jenis, setJenis] = useState<JenisPengembangan>(rencana?.jenisPengembangan ?? 'DIKLAT')
  const [deskripsi, setDeskripsi] = useState(rencana?.deskripsi ?? '')
  const [targetSelesai, setTargetSelesai] = useState(rencana?.targetSelesai?.slice(0, 10) ?? '')
  const [status, setStatus] = useState<StatusRencana>(rencana?.status ?? 'DIRENCANAKAN')

  function simpan() {
    setGalat({})
    mulaiTransisi(async () => {
      const hasil = await simpanRencana(talentPoolId, rencana?.id ?? null, {
        jenisPengembangan: jenis,
        deskripsi,
        targetSelesai: targetSelesai === '' ? null : targetSelesai,
        status,
      })
      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Disimpan.' })
        onTutup()
      } else {
        setGalat(hasil.galatField ?? {})
        if (!hasil.galatField) {
          tampilkan({ nada: 'bahaya', judul: 'Gagal menyimpan', keterangan: hasil.pesan })
        }
      }
    })
  }

  const jenisTerpilih = JENIS.find((j) => j.nilai === jenis)!

  return (
    <Dialog
      buka
      onTutup={onTutup}
      judul={rencana === null ? `Tambah rencana — ${nama}` : `Ubah rencana — ${nama}`}
      deskripsi="Rencana yang spesifik bisa ditindak dan diperiksa progresnya; rencana yang umum hanya jadi catatan."
      aksi={
        <>
          <Button variant="sekunder" size="sm" onClick={onTutup} disabled={pending}>
            Batal
          </Button>
          <Button size="sm" onClick={simpan} pending={pending} labelPending="Menyimpan…">
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <label className="block">
          <span className="mb-1 flex flex-wrap items-baseline gap-1.5">
            <span className="text-[12px] font-medium text-text">Jenis pengembangan</span>
            <span className="text-[10px] text-text-subtle">{jenisTerpilih.keterangan}</span>
          </span>
          <select
            value={jenis}
            onChange={(e) => setJenis(e.target.value as JenisPengembangan)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-[13px] text-text outline-none focus:border-accent disabled:opacity-60"
          >
            {JENIS.map((j) => (
              <option key={j.nilai} value={j.nilai}>
                {j.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 flex items-baseline gap-1.5">
            <span className="text-[12px] font-medium text-text">Deskripsi</span>
            <span aria-hidden className="text-[12px] text-danger">
              *
            </span>
          </span>
          <textarea
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            disabled={pending}
            rows={3}
            placeholder="mis. Diklat Kepemimpinan Nasional Tingkat II angkatan 2027 di LAN"
            className={cn(
              'w-full rounded-md border bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-text outline-none disabled:opacity-60',
              galat.deskripsi ? 'border-danger-border' : 'border-border focus:border-accent',
            )}
          />
          {galat.deskripsi ? (
            <span role="alert" className="mt-1 block text-[11px] leading-relaxed text-danger">
              {galat.deskripsi}
            </span>
          ) : null}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 flex flex-wrap items-baseline gap-1.5">
              <span className="text-[12px] font-medium text-text">Target selesai</span>
              <span className="text-[10px] text-text-subtle">opsional</span>
            </span>
            <input
              type="date"
              value={targetSelesai}
              onChange={(e) => setTargetSelesai(e.target.value)}
              disabled={pending}
              className={cn(
                'tabular h-9 w-full rounded-md border bg-surface px-2.5 text-[13px] text-text outline-none disabled:opacity-60',
                galat.targetSelesai ? 'border-danger-border' : 'border-border focus:border-accent',
              )}
            />
            {galat.targetSelesai ? (
              <span role="alert" className="mt-1 block text-[11px] text-danger">
                {galat.targetSelesai}
              </span>
            ) : null}
          </label>

          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-text">Status progres</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusRencana)}
              disabled={pending}
              className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-[13px] text-text outline-none focus:border-accent disabled:opacity-60"
            >
              <option value="DIRENCANAKAN">Direncanakan</option>
              <option value="BERJALAN">Berjalan</option>
              <option value="SELESAI">Selesai</option>
            </select>
          </label>
        </div>

        {status === 'SELESAI' ? (
          <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5">
            <p className="text-[11px] leading-relaxed text-text-muted">
              Rencana berstatus <strong className="font-medium text-text">Selesai</strong> tidak bisa
              dihapus — ia menjadi rekam jejak pengembangan suksesor. Kalau isinya keliru, betulkan
              deskripsinya.
            </p>
          </div>
        ) : null}

        <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-text-subtle">
          <Sprout className="mt-0.5 size-3.5 shrink-0" />
          Rencana hanya bisa dibuat untuk suksesor berstatus Ditetapkan. Kalau penetapannya nanti
          dibatalkan, rencana ini tetap tersimpan sebagai riwayat.
        </p>
      </div>
    </Dialog>
  )
}
