'use client'

import { Copy, MoreHorizontal, Pencil, Play, Power, Trash2, Users } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DialogKonfirmasi } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/ui/toast'
import {
  hapusJabatanTarget,
  ubahStatusJabatanTarget,
} from '@/lib/aksi/jabatan-target'
import { cn } from '@/lib/cn'
import { formatAngka, formatTanggalWaktu } from '@/lib/format'
import type { BarisJabatanTarget, StatusJabatanTarget } from '@/lib/kueri/rubrik'
import { FormTarget } from './form-target'

/**
 * Tabel jabatan target dengan aksi statusnya.
 *
 * Tabelnya ditulis langsung, bukan lewat `DataTable`: jumlah jabatan target
 * dihitung belasan (satu per jabatan strategis), jadi paginasi & pengurutan
 * server tidak diperlukan, sementara yang dibutuhkan justru satu baris ringkasan
 * kesiapan per entri — bentuk yang tidak muat di kolom generik.
 */
export function TabelTarget({
  baris,
  bolehUbah,
}: {
  baris: BarisJabatanTarget[]
  bolehUbah: boolean
}) {
  if (baris.length === 0) {
    return (
      <EmptyState
        className="m-3.5 border-0"
        judul="Belum ada jabatan target"
        deskripsi="Jabatan target adalah profil jabatan yang jadi sasaran suksesi. Tanpa itu, kandidat tidak bisa dinilai karena tidak ada rubrik yang membandingkannya."
        ikon={<Users className="size-5" />}
      />
    )
  }

  return (
    /*
      `relative` WAJIB di kontainer gulir ini, bukan hiasan.

      Header kolom aksi memuat span `sr-only`, dan `sr-only` itu
      `position: absolute`. Elemen absolut mencari containing block pada leluhur
      ber-`position` TERDEKAT — kalau di dalam kontainer gulir tidak ada satu
      pun, ia melompati kontainer itu dan memakai containing block awal,
      sehingga luberannya masuk ke `scrollWidth` HALAMAN alih-alih ke area gulir
      tabelnya sendiri.

      Terukur di `/jabatan-target` pada 768px: halaman menggulir horizontal 11px,
      dan satu-satunya elemen di tepi 779px itu span "Aksi" — bukan tabelnya,
      yang luberannya sudah tertampung benar. Gejalanya menyesatkan karena yang
      tampak bergeser adalah tabel, sementara penyebabnya elemen selebar 1px yang
      tidak terlihat sama sekali.
    */
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead className="bg-surface-2">
          <tr className="border-b border-border text-left text-[11px] tracking-wide text-text-subtle uppercase">
            <th className="px-3.5 py-2 font-medium">Jabatan target</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Anggota</th>
            <th className="px-3 py-2 text-right font-medium">
              Rubrik
              <span className="mt-0.5 block text-[9px] font-normal normal-case">
                komponen · indikator
              </span>
            </th>
            <th className="px-3 py-2 text-right font-medium">
              Kandidat
              <span className="mt-0.5 block text-[9px] font-normal normal-case">
                lolos syarat / dinilai
              </span>
            </th>
            <th className="px-3 py-2 font-medium">Dihitung terakhir</th>
            <th className="px-3.5 py-2 font-medium">
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <BarisTarget key={b.id} target={b} bolehUbah={bolehUbah} semua={baris} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TONE_STATUS: Record<StatusJabatanTarget, 'sukses' | 'peringatan' | 'netral'> = {
  AKTIF: 'sukses',
  DRAFT: 'peringatan',
  NONAKTIF: 'netral',
}

function BarisTarget({
  target,
  bolehUbah,
  semua,
}: {
  target: BarisJabatanTarget
  bolehUbah: boolean
  semua: BarisJabatanTarget[]
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [menu, setMenu] = useState(false)
  const [formBuka, setFormBuka] = useState(false)
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false)

  function ubahStatus(status: StatusJabatanTarget) {
    setMenu(false)
    mulaiTransisi(async () => {
      const hasil = await ubahStatusJabatanTarget(target.id, status)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Status diperbarui.' }
          : { nada: 'bahaya', judul: 'Tidak bisa diaktifkan', keterangan: hasil.pesan },
      )
    })
  }

  function hapus() {
    mulaiTransisi(async () => {
      const hasil = await hapusJabatanTarget(target.id)
      setKonfirmasiHapus(false)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Dihapus.' }
          : { nada: 'bahaya', judul: 'Gagal menghapus', keterangan: hasil.pesan },
      )
    })
  }

  const siap =
    target.jumlahAnggota > 0 && target.jumlahKomponen > 0 && target.jumlahPersyaratan > 0

  return (
    <tr className={cn('border-b border-border last:border-b-0 hover:bg-surface-2', pending && 'opacity-60')}>
      <td className="px-3.5 py-2.5">
        <Link
          href={`/jabatan-target/${target.id}`}
          className="block font-medium text-text hover:text-accent"
        >
          {target.namaTarget}
        </Link>
        <span className="tabular mt-0.5 block text-[11px] text-text-subtle">
          {target.kodeTarget}
          {target.kataKunciRelevansi.length === 0 ? (
            <span className="ml-2 text-warning">tanpa kata kunci relevansi</span>
          ) : null}
        </span>
      </td>

      <td className="px-3 py-2.5">
        <Badge tone={TONE_STATUS[target.status]}>{target.status}</Badge>
      </td>

      <td className="tabular px-3 py-2.5 text-right">
        {target.jumlahAnggota === 0 ? (
          <span className="text-warning" title="Tanpa jabatan anggota, target ini tidak menunjuk posisi mana pun">
            0
          </span>
        ) : (
          formatAngka(target.jumlahAnggota)
        )}
      </td>

      <td className="tabular px-3 py-2.5 text-right text-text-muted">
        {target.jumlahKomponen === 0 ? (
          <span className="text-warning">belum ada</span>
        ) : (
          <>
            {formatAngka(target.jumlahKomponen)}
            <span className="text-text-subtle"> · {formatAngka(target.jumlahIndikator)}</span>
          </>
        )}
      </td>

      <td className="tabular px-3 py-2.5 text-right">
        {target.jumlahDinilai === 0 ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <Link
            href={`/jabatan-target/${target.id}/kandidat`}
            className="text-text hover:text-accent"
          >
            {formatAngka(target.jumlahEligible)}
            <span className="text-text-subtle"> / {formatAngka(target.jumlahDinilai)}</span>
          </Link>
        )}
      </td>

      <td className="px-3 py-2.5 text-[11px] text-text-muted">
        {target.dihitungPada === null ? (
          <span className="text-warning">belum pernah</span>
        ) : (
          formatTanggalWaktu(target.dihitungPada)
        )}
      </td>

      <td className="px-3.5 py-2.5">
        {bolehUbah ? (
          <div className="relative flex justify-end">
            <Button
              size="ikon"
              variant="halus"
              onClick={() => setMenu(!menu)}
              pending={pending}
              aria-expanded={menu}
              aria-label={`Aksi untuk ${target.namaTarget}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>

            {menu ? (
              <>
                <button
                  type="button"
                  aria-hidden
                  tabIndex={-1}
                  onClick={() => setMenu(false)}
                  className="fixed inset-0 z-20 cursor-default"
                />
                <div className="absolute top-8 right-0 z-30 w-56 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow-overlay)]">
                  <ItemMenu
                    ikon={<Pencil className="size-3.5" />}
                    onClick={() => {
                      setMenu(false)
                      setFormBuka(true)
                    }}
                  >
                    Ubah profil &amp; kata kunci
                  </ItemMenu>

                  {target.status !== 'AKTIF' ? (
                    <ItemMenu
                      ikon={<Play className="size-3.5" />}
                      onClick={() => ubahStatus('AKTIF')}
                      keterangan={
                        siap
                          ? 'Rubrik diperiksa dulu sebelum aktif'
                          : 'Belum lengkap — akan ditolak beserta alasannya'
                      }
                    >
                      Aktifkan
                    </ItemMenu>
                  ) : (
                    <ItemMenu
                      ikon={<Power className="size-3.5" />}
                      onClick={() => ubahStatus('NONAKTIF')}
                      keterangan="Skor & talent pool tetap tersimpan"
                    >
                      Nonaktifkan
                    </ItemMenu>
                  )}

                  <ItemMenu
                    ikon={<Copy className="size-3.5" />}
                    href={`/jabatan-target/${target.id}?tab=rubrik`}
                    onClick={() => setMenu(false)}
                    keterangan={
                      target.jumlahKomponen > 0
                        ? 'Rubrik sudah ada — duplikasi hanya untuk rubrik kosong'
                        : `Salin dari ${semua.filter((s) => s.id !== target.id && s.jumlahKomponen > 0).length} rubrik lain`
                    }
                  >
                    Duplikasi rubrik
                  </ItemMenu>

                  <div className="my-1 border-t border-border" />

                  <ItemMenu
                    ikon={<Trash2 className="size-3.5" />}
                    destruktif
                    onClick={() => {
                      setMenu(false)
                      setKonfirmasiHapus(true)
                    }}
                  >
                    Hapus
                  </ItemMenu>
                </div>
              </>
            ) : null}
          </div>
        ) : null}

        {formBuka ? (
          <FormTarget mode="ubah" target={target} onTutup={() => setFormBuka(false)} />
        ) : null}

        <DialogKonfirmasi
          buka={konfirmasiHapus}
          onTutup={() => setKonfirmasiHapus(false)}
          onKonfirmasi={hapus}
          pending={pending}
          destruktif
          judul={`Hapus "${target.namaTarget}"?`}
          deskripsi={
            target.jumlahPool > 0
              ? `Jabatan target ini punya ${target.jumlahPool} entri talent pool, jadi ia akan DINONAKTIFKAN, bukan dihapus — menghapusnya ikut menghapus riwayat nominasi & persetujuannya.`
              : `${target.jumlahDinilai} baris skor dan seluruh rubriknya akan hilang. Belum ada entri talent pool yang menunjuk ke sini.`
          }
          labelKonfirmasi={target.jumlahPool > 0 ? 'Nonaktifkan' : 'Hapus'}
          labelPending="Memproses…"
        />
      </td>
    </tr>
  )
}

function ItemMenu({
  ikon,
  children,
  keterangan,
  onClick,
  href,
  destruktif,
}: {
  ikon: React.ReactNode
  children: React.ReactNode
  keterangan?: string
  onClick?: () => void
  href?: string
  destruktif?: boolean
}) {
  const kelas = cn(
    'flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors',
    destruktif ? 'text-danger hover:bg-danger-subtle' : 'text-text-muted hover:bg-surface-3 hover:text-text',
  )

  const isi = (
    <>
      <span className="mt-0.5 shrink-0">{ikon}</span>
      <span className="min-w-0">
        <span className="block">{children}</span>
        {keterangan ? (
          <span className="mt-0.5 block text-[10px] leading-relaxed text-text-subtle">
            {keterangan}
          </span>
        ) : null}
      </span>
    </>
  )

  if (href !== undefined) {
    return (
      <Link href={href} onClick={onClick} className={kelas}>
        {isi}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={kelas}>
      {isi}
    </button>
  )
}
