'use client'

import { ChevronRight, Pencil, Plus, Trash2, Users } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DialogKonfirmasi } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { formatAngka } from '@/lib/format'
import { hapusUnit } from '@/lib/aksi/unit-organisasi'
import type { NodeUnit } from '@/lib/kueri/master'
import { FormUnit } from './form-unit'

/**
 * Pohon unit organisasi.
 *
 * Data datang sudah **terurut pre-order dengan kedalaman** dari SQL, jadi
 * komponen ini tidak membangun pohon di memori — hanya menyembunyikan baris yang
 * induknya sedang terlipat. Membangun pohon di klien akan memaksa mengambil
 * seluruh tabel; produksi punya 48 unit sekarang tapi tidak ada jaminan itu
 * tetap kecil.
 */
export function PohonUnit({
  node,
  opsiInduk,
}: {
  node: NodeUnit[]
  opsiInduk: Array<{ id: number; nama: string; kedalaman: number }>
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()

  // Terlipat, bukan terbuka: pohon organisasi 3 level muat di satu layar, dan
  // membuka semuanya lebih berguna daripada memaksa mengklik untuk melihat isi.
  const [terlipat, setTerlipat] = useState<Set<number>>(new Set())
  const [formUntuk, setFormUntuk] = useState<
    { mode: 'buat'; parentId: number | null } | { mode: 'ubah'; unit: NodeUnit } | null
  >(null)
  const [akanHapus, setAkanHapus] = useState<NodeUnit | null>(null)

  function toggle(id: number) {
    setTerlipat((s) => {
      const baru = new Set(s)
      if (baru.has(id)) baru.delete(id)
      else baru.add(id)
      return baru
    })
  }

  /** Baris disembunyikan kalau ada leluhurnya yang terlipat. */
  const tampil = node.filter((n) => !leluhurTerlipat(n, node, terlipat))

  function konfirmasiHapus() {
    if (!akanHapus) return
    const unit = akanHapus
    mulaiTransisi(async () => {
      const hasil = await hapusUnit(unit.id)
      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Unit dihapus.' })
        setAkanHapus(null)
      } else {
        // Dialog dibiarkan terbuka: pesannya menjelaskan apa yang harus
        // dibereskan dulu, dan menutupnya akan menyembunyikan penjelasan itu.
        tampilkan({ nada: 'bahaya', judul: 'Unit tidak bisa dihapus', keterangan: hasil.pesan })
      }
    })
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3.5 py-3">
        <p className="text-[11px] text-text-subtle">
          {formatAngka(node.length)} unit · klik tanda panah untuk melipat cabang
        </p>
        <Button
          size="sm"
          onClick={() => setFormUntuk({ mode: 'buat', parentId: null })}
          ikon={<Plus className="size-3.5" />}
        >
          Tambah unit
        </Button>
      </div>

      <ul>
        {tampil.map((n) => {
          const punyaAnak = n.jumlahAnak > 0
          const lipat = terlipat.has(n.id)
          return (
            <li
              key={n.id}
              className="flex flex-wrap items-center gap-2 border-b border-border px-3.5 py-2 last:border-b-0 hover:bg-surface-2"
            >
              <span
                className="flex min-w-0 flex-1 items-center gap-1.5"
                style={{ paddingLeft: `${n.kedalaman * 1.25}rem` }}
              >
                {punyaAnak ? (
                  <button
                    type="button"
                    onClick={() => toggle(n.id)}
                    aria-expanded={!lipat}
                    aria-label={`${lipat ? 'Buka' : 'Lipat'} ${n.namaUnit}`}
                    className="shrink-0 rounded p-0.5 text-text-subtle transition-colors hover:bg-surface-3 hover:text-text"
                  >
                    <ChevronRight className={cn('size-3.5 transition-transform', !lipat && 'rotate-90')} />
                  </button>
                ) : (
                  <span aria-hidden className="size-[1.125rem] shrink-0" />
                )}

                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-text">
                    {n.namaUnit}
                  </span>
                  <span className="tabular block text-[11px] text-text-subtle">
                    {n.kodeUnit} · {n.jenis}
                    {n.levelEselon !== null ? ` · eselon ${n.levelEselon}` : ''}
                  </span>
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-3 text-[11px] text-text-subtle">
                <span className="tabular" title="Jabatan yang menempel langsung pada unit ini">
                  {formatAngka(n.jumlahJabatan)} jabatan
                </span>
                {/* Jumlah pegawai MENAUT ke Direktori Pegawai yang sudah
                    tersaring ke unit ini (permintaan user, 12 Agu 2026 —
                    sebelumnya hanya angka mati).

                    Tautannya memakai `?unit=` yang di direktori disaring dengan
                    `SUBKUERI_UNIT_TURUNAN`, jadi yang terbuka adalah unit ini
                    **beserta seluruh turunannya**. Karena itu angka yang
                    dijanjikan tautan ini adalah `jumlahPegawaiTermasukTurunan`,
                    bukan `jumlahPegawai`: menautkan angka unit-ini-saja ke
                    halaman yang menampilkan turunannya juga akan membuat
                    hitungannya tidak cocok begitu diklik — kelas kesalahan yang
                    sama dengan kartu dashboard yang menyebut 7 sementara
                    halamannya menampilkan 3. Keduanya tetap ditampilkan supaya
                    perbedaannya terbaca sebelum diklik. */}
                <Link
                  href={`/talenta?unit=${n.id}`}
                  className="tabular inline-flex items-center gap-1 rounded px-1 text-text-muted hover:bg-surface-3 hover:text-accent"
                  title={`Buka Direktori Pegawai untuk ${n.namaUnit} beserta seluruh unit turunannya (${formatAngka(n.jumlahPegawaiTermasukTurunan)} pegawai aktif)`}
                >
                  <Users aria-hidden className="size-3" />
                  {formatAngka(n.jumlahPegawai)}
                  {n.jumlahPegawaiTermasukTurunan !== n.jumlahPegawai ? (
                    <span className="text-text-subtle">
                      ({formatAngka(n.jumlahPegawaiTermasukTurunan)} total)
                    </span>
                  ) : null}
                  pegawai
                </Link>
                {punyaAnak && lipat ? (
                  <Badge tone="netral">{formatAngka(n.jumlahAnak)} anak disembunyikan</Badge>
                ) : null}
              </span>

              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => setFormUntuk({ mode: 'buat', parentId: n.id })}
                  title={`Tambah unit di bawah ${n.namaUnit}`}
                  aria-label={`Tambah unit di bawah ${n.namaUnit}`}
                  className="rounded p-1.5 text-text-subtle transition-colors hover:bg-surface-3 hover:text-accent"
                >
                  <Plus className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setFormUntuk({ mode: 'ubah', unit: n })}
                  title={`Ubah ${n.namaUnit}`}
                  aria-label={`Ubah ${n.namaUnit}`}
                  className="rounded p-1.5 text-text-subtle transition-colors hover:bg-surface-3 hover:text-accent"
                >
                  <Pencil className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setAkanHapus(n)}
                  title={`Hapus ${n.namaUnit}`}
                  aria-label={`Hapus ${n.namaUnit}`}
                  className="rounded p-1.5 text-text-subtle transition-colors hover:bg-surface-3 hover:text-danger"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </li>
          )
        })}
      </ul>

      {formUntuk !== null ? (
        <FormUnit
          mode={formUntuk.mode}
          unit={formUntuk.mode === 'ubah' ? formUntuk.unit : null}
          parentIdAwal={formUntuk.mode === 'buat' ? formUntuk.parentId : null}
          opsiInduk={opsiInduk}
          onTutup={() => setFormUntuk(null)}
        />
      ) : null}

      <DialogKonfirmasi
        buka={akanHapus !== null}
        onTutup={() => setAkanHapus(null)}
        onKonfirmasi={konfirmasiHapus}
        judul={`Hapus unit "${akanHapus?.namaUnit ?? ''}"?`}
        deskripsi={
          akanHapus
            ? `Unit ini punya ${formatAngka(akanHapus.jumlahAnak)} unit di bawahnya dan ${formatAngka(akanHapus.jumlahJabatan)} jabatan. Penghapusan akan ditolak kalau salah satunya masih ada.`
            : undefined
        }
        labelKonfirmasi="Hapus unit"
        labelPending="Menghapus…"
        pending={pending}
        destruktif
      />
    </div>
  )
}

/** Apakah salah satu leluhur baris ini sedang terlipat? */
function leluhurTerlipat(n: NodeUnit, semua: NodeUnit[], terlipat: Set<number>): boolean {
  let kini = n.parentId
  while (kini !== null) {
    if (terlipat.has(kini)) return true
    kini = semua.find((x) => x.id === kini)?.parentId ?? null
  }
  return false
}
