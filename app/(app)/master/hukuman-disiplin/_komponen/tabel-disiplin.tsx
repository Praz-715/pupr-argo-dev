'use client'

import { Pencil, Plus, PowerOff, RotateCcw, Search } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DialogKonfirmasi } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Pilih } from '@/components/ui/pilih'
import { Spinner } from '@/components/ui/spinner'
import { useToast } from '@/components/ui/toast'
import { formatNip, formatTanggal } from '@/lib/format'
import { nonaktifkanHukuman } from '@/lib/aksi/hukuman-disiplin'
import type { BarisDisiplin } from '@/lib/kueri/disiplin'
import { FormDisiplin } from './form-disiplin'

const TINGKAT = ['Sedang Menjalani', 'Berat', 'Sedang', 'Ringan', 'Tidak Pernah']

export function TabelDisiplin({
  baris,
  opsiPegawai,
}: {
  baris: BarisDisiplin[]
  opsiPegawai: Array<{ id: number; label: string }>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()

  const cariAwal = searchParams.get('cari') ?? ''
  const [cari, setCari] = useState(cariAwal)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [cariUrlTerakhir, setCariUrlTerakhir] = useState(cariAwal)
  if (cariAwal !== cariUrlTerakhir) {
    setCariUrlTerakhir(cariAwal)
    setCari(cariAwal)
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const [form, setForm] = useState<{ catatan: BarisDisiplin | null } | null>(null)
  const [akanNonaktif, setAkanNonaktif] = useState<BarisDisiplin | null>(null)

  function terapkan(perubahan: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(perubahan)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    mulaiTransisi(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  function konfirmasiNonaktif() {
    if (!akanNonaktif) return
    const c = akanNonaktif
    mulaiTransisi(async () => {
      const hasil = await nonaktifkanHukuman(c.id)
      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Catatan dinonaktifkan.' })
        setAkanNonaktif(null)
      } else {
        tampilkan({ nada: 'bahaya', judul: 'Gagal menonaktifkan', keterangan: hasil.pesan })
      }
    })
  }

  const adaFilter = ['cari', 'tingkat', 'aktif'].some((k) => searchParams.get(k))

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3.5 py-3">
        <div className="relative min-w-52 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-subtle" />
          <input
            value={cari}
            onChange={(e) => {
              setCari(e.target.value)
              if (timer.current) clearTimeout(timer.current)
              timer.current = setTimeout(() => terapkan({ cari: e.target.value }), 300)
            }}
            placeholder="Cari nama, NIP, atau nomor SK…"
            aria-label="Cari catatan disiplin"
            className="h-8 w-full rounded-md border border-border bg-surface pr-16 pl-8 text-[13px] text-text outline-none placeholder:text-text-subtle focus:border-accent"
          />
          {pending ? (
            <span className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1 text-[10px] text-text-subtle">
              <Spinner className="size-3" />
              mencari
            </span>
          ) : null}
        </div>

        <Pilih
          label="Tingkat hukuman"
          nilai={searchParams.get('tingkat') ?? ''}
          onUbah={(v) => terapkan({ tingkat: v })}
          opsi={[
            { nilai: '', label: 'Semua tingkat' },
            ...TINGKAT.map((t) => ({ nilai: t, label: t })),
          ]}
          lebar="w-44"
        />

        <label className="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 text-[13px] text-text-muted transition-colors hover:border-border-strong has-checked:border-accent-border has-checked:bg-accent-subtle has-checked:text-text">
          <input
            type="checkbox"
            checked={searchParams.get('aktif') === '1'}
            onChange={(e) => terapkan({ aktif: e.target.checked ? '1' : null })}
            className="size-3.5 accent-[var(--accent)]"
          />
          Hanya catatan aktif
        </label>

        {adaFilter ? (
          <Button
            size="sm"
            variant="halus"
            onClick={() => {
              setCari('')
              mulaiTransisi(() => router.push(pathname, { scroll: false }))
            }}
            ikon={<RotateCcw className="size-3.5" />}
          >
            Reset
          </Button>
        ) : null}

        <Button
          size="sm"
          onClick={() => setForm({ catatan: null })}
          ikon={<Plus className="size-3.5" />}
        >
          Tambah catatan
        </Button>
      </div>

      {baris.length === 0 ? (
        <div className="p-4">
          <EmptyState
            judul={adaFilter ? 'Tidak ada catatan yang cocok' : 'Belum ada catatan disiplin'}
            deskripsi={
              adaFilter
                ? 'Longgarkan filter untuk melihat catatan lain.'
                : 'Semua pegawai saat ini diperlakukan sebagai skor integritas 100. Itu asumsi — bukan hasil verifikasi rekam jejak.'
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-text-subtle uppercase">
                <th className="px-3 py-2">Pegawai</th>
                <th className="px-3 py-2">Tingkat</th>
                <th className="px-3 py-2 text-right">Skor integritas</th>
                <th className="px-3 py-2">SK</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Keterangan</th>
                <th className="px-3 py-2 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((c) => (
                <tr
                  key={c.id}
                  className={
                    c.statusAktif
                      ? 'border-b border-border last:border-b-0'
                      : 'border-b border-border opacity-60 last:border-b-0'
                  }
                >
                  <td className="px-3 py-2">
                    <Link
                      href={`/talenta/${c.nip}`}
                      className="block font-medium text-text hover:text-accent hover:underline"
                    >
                      {c.nama}
                    </Link>
                    <span className="tabular block text-[11px] text-text-subtle">
                      {formatNip(c.nip)}
                    </span>
                    {c.namaUnit ? (
                      <span className="block max-w-[14rem] truncate text-[11px] text-text-subtle">
                        {c.namaUnit}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      tone={
                        c.tingkatHukuman === 'Tidak Pernah'
                          ? 'sukses'
                          : c.tingkatHukuman === 'Ringan'
                            ? 'peringatan'
                            : 'bahaya'
                      }
                    >
                      {c.tingkatHukuman}
                    </Badge>
                  </td>
                  <td className="tabular px-3 py-2 text-right font-medium text-text">
                    {c.statusAktif ? (
                      c.skorIntegritas
                    ) : (
                      <span className="text-text-subtle" title="Catatan nonaktif tidak menurunkan skor">
                        —
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    <span className="block">{c.noSk ?? '—'}</span>
                    <span className="tabular block text-[11px] text-text-subtle">
                      {c.tanggalSk === null ? 'tanpa tanggal' : formatTanggal(c.tanggalSk)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={c.statusAktif ? 'aksen' : 'netral'}>
                      {c.statusAktif ? 'Aktif' : 'Tidak aktif'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className="block max-w-[18rem] truncate text-text-muted"
                      title={c.keterangan ?? ''}
                    >
                      {c.keterangan ?? '—'}
                    </span>
                    {c.diinputOleh ? (
                      <span className="block text-[11px] text-text-subtle">
                        diinput {c.diinputOleh}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => setForm({ catatan: c })}
                        title={`Ubah catatan ${c.nama}`}
                        aria-label={`Ubah catatan ${c.nama}`}
                        className="rounded p-1.5 text-text-subtle transition-colors hover:bg-surface-3 hover:text-accent"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      {c.statusAktif ? (
                        <button
                          type="button"
                          onClick={() => setAkanNonaktif(c)}
                          title="Nonaktifkan catatan"
                          aria-label={`Nonaktifkan catatan ${c.nama}`}
                          className="rounded p-1.5 text-text-subtle transition-colors hover:bg-surface-3 hover:text-danger"
                        >
                          <PowerOff className="size-3.5" />
                        </button>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-border px-3.5 py-3 text-[11px] leading-relaxed text-text-subtle">
        Catatan <strong className="font-medium text-text-muted">tidak pernah dihapus</strong>, hanya
        dinonaktifkan. Ia dasar skor integritas yang sudah dipakai menghitung match score — menghapus
        barisnya membuat skor lama tidak bisa dipertanggungjawabkan lagi.
      </p>

      {form !== null ? (
        <FormDisiplin
          catatan={form.catatan}
          opsiPegawai={opsiPegawai}
          onTutup={() => setForm(null)}
        />
      ) : null}

      <DialogKonfirmasi
        buka={akanNonaktif !== null}
        onTutup={() => setAkanNonaktif(null)}
        onKonfirmasi={konfirmasiNonaktif}
        judul={`Nonaktifkan catatan ${akanNonaktif?.tingkatHukuman ?? ''}?`}
        deskripsi={
          akanNonaktif
            ? `Catatan untuk ${akanNonaktif.nama} tidak akan lagi menurunkan skor integritasnya, tapi barisnya tetap ada sebagai jejak. Skor integritas akan dihitung ulang dari catatan aktif yang tersisa.`
            : undefined
        }
        labelKonfirmasi="Nonaktifkan"
        labelPending="Memproses…"
        pending={pending}
        destruktif
      />
    </div>
  )
}
