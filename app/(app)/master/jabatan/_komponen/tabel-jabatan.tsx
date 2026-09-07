'use client'

import { Pencil, Plus, Trash2 } from 'lucide-react'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DataTable, type KolomTabel } from '@/components/ui/data-table'
import { DialogKonfirmasi } from '@/components/ui/dialog'
import { NoResultState } from '@/components/ui/states'
import { useToast } from '@/components/ui/toast'
import { formatAngka } from '@/lib/format'
import { hapusJabatan, ubahStatusJabatan } from '@/lib/aksi/jabatan'
import type { BarisJabatan } from '@/lib/kueri/master'
import { FormJabatan } from './form-jabatan'

const LABEL_STATUS: Record<string, string> = {
  TERISI: 'Terisi',
  KOSONG: 'Kosong',
  DIHAPUS: 'Diarsipkan',
}

export function TabelJabatan({
  baris,
  total,
  halaman,
  ukuranHalaman,
  adaFilter,
  opsiUnit,
}: {
  baris: BarisJabatan[]
  total: number
  halaman: number
  ukuranHalaman: number
  adaFilter: boolean
  opsiUnit: Array<{ id: number; nama: string; kedalaman: number }>
}) {
  const router = useRouter()
  const pathname = usePathname()
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()

  const [form, setForm] = useState<{ jabatan: BarisJabatan | null } | null>(null)
  const [akanHapus, setAkanHapus] = useState<BarisJabatan | null>(null)

  function tandaiKosong(j: BarisJabatan) {
    mulaiTransisi(async () => {
      const hasil = await ubahStatusJabatan(j.id, j.statusJabatan === 'KOSONG' ? 'TERISI' : 'KOSONG')
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Status diubah.' }
          : { nada: 'bahaya', judul: 'Status tidak bisa diubah', keterangan: hasil.pesan },
      )
    })
  }

  function konfirmasiHapus() {
    if (!akanHapus) return
    const j = akanHapus
    mulaiTransisi(async () => {
      const hasil = await hapusJabatan(j.id)
      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Jabatan dihapus.' })
        setAkanHapus(null)
      } else {
        tampilkan({ nada: 'bahaya', judul: 'Tidak bisa dihapus', keterangan: hasil.pesan })
      }
    })
  }

  const kolom: Array<KolomTabel<BarisJabatan>> = [
    {
      kunci: 'nama',
      judul: 'Kode & Nama Jabatan',
      sticky: true,
      wajib: true,
      bisaDiurutkan: false,
      lebarMin: '17rem',
      render: (j) => (
        <>
          <span className="block font-medium text-text">{j.namaJabatan}</span>
          <span className="tabular block text-[11px] text-text-subtle">{j.kodeJabatan}</span>
        </>
      ),
    },
    {
      kunci: 'unit',
      judul: 'Unit Organisasi',
      bisaDiurutkan: false,
      lebarMin: '15rem',
      render: (j) => (
        <span className="block max-w-[18rem] text-text-muted break-words" title={j.namaUnit}>
          {j.namaUnit}
        </span>
      ),
    },
    {
      kunci: 'eselon',
      judul: 'Eselon',
      bisaDiurutkan: false,
      render: (j) =>
        j.eselon === 'NON_ESELON' ? (
          <span className="whitespace-nowrap text-text-subtle">Non-eselon</span>
        ) : (
          <span className="text-text-muted">{j.eselon}</span>
        ),
    },
    {
      kunci: 'jenjang',
      judul: 'Jenjang',
      bisaDiurutkan: false,
      lebarMin: '9rem',
      render: (j) => <span className="text-text-muted">{j.jenjang}</span>,
    },
    {
      kunci: 'jenis',
      judul: 'Jenis',
      bisaDiurutkan: false,
      lebarMin: '9rem',
      render: (j) => (
        <span className="text-text-muted">
          {j.jenisJabatan === 'STRUKTURAL'
            ? 'Struktural'
            : j.jenisJabatan === 'FUNGSIONAL_TERTENTU'
              ? 'Fungsional Tertentu'
              : 'Fungsional Umum'}
        </span>
      ),
    },
    {
      kunci: 'status',
      judul: 'Status',
      bisaDiurutkan: false,
      render: (j) => (
        <span className="flex flex-col items-start gap-1">
          <Badge
            tone={
              j.statusJabatan === 'TERISI'
                ? 'sukses'
                : j.statusJabatan === 'KOSONG'
                  ? 'peringatan'
                  : 'netral'
            }
          >
            {LABEL_STATUS[j.statusJabatan] ?? j.statusJabatan}
          </Badge>
          {j.jumlahPenghuni > 0 ? (
            <span className="tabular text-[10px] text-text-subtle">
              {formatAngka(j.jumlahPenghuni)} penghuni
            </span>
          ) : null}
        </span>
      ),
    },
    {
      kunci: 'target',
      judul: 'Jabatan target',
      bisaDiurutkan: false,
      render: (j) =>
        j.adaJabatanTarget ? (
          <Badge tone="aksen">Ada</Badge>
        ) : (
          <span className="text-text-subtle">Belum</span>
        ),
    },
    {
      kunci: 'aksi',
      judul: 'Aksi',
      bisaDiurutkan: false,
      wajib: true,
      rataKanan: true,
      lebarMin: '10rem',
      render: (j) => (
        <span className="flex items-center justify-end gap-1">
          <button
            type="button"
            onClick={() => tandaiKosong(j)}
            disabled={pending || (j.statusJabatan !== 'KOSONG' && j.jumlahPenghuni > 0)}
            title={
              j.jumlahPenghuni > 0 && j.statusJabatan !== 'KOSONG'
                ? `Masih ditempati ${j.jumlahPenghuni} pegawai aktif`
                : j.statusJabatan === 'KOSONG'
                  ? 'Tandai terisi'
                  : 'Tandai kosong'
            }
            className="rounded border border-border px-1.5 py-0.5 text-[10px] text-text-muted transition-colors hover:border-border-strong hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
          >
            {j.statusJabatan === 'KOSONG' ? 'Tandai terisi' : 'Tandai kosong'}
          </button>
          <button
            type="button"
            onClick={() => setForm({ jabatan: j })}
            title={`Ubah ${j.namaJabatan}`}
            aria-label={`Ubah ${j.namaJabatan}`}
            className="rounded p-1.5 text-text-subtle transition-colors hover:bg-surface-3 hover:text-accent"
          >
            <Pencil className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setAkanHapus(j)}
            title={`Hapus ${j.namaJabatan}`}
            aria-label={`Hapus ${j.namaJabatan}`}
            className="rounded p-1.5 text-text-subtle transition-colors hover:bg-surface-3 hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </span>
      ),
    },
  ]

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button size="sm" onClick={() => setForm({ jabatan: null })} ikon={<Plus className="size-3.5" />}>
          Tambah jabatan
        </Button>
      </div>

      <DataTable
        id="master-jabatan"
        kolom={kolom}
        baris={baris}
        kunciBaris={(j) => j.id}
        total={total}
        halaman={halaman}
        ukuranHalaman={ukuranHalaman}
        kosong={
          adaFilter ? (
            <NoResultState onReset={() => router.push(pathname, { scroll: false })} />
          ) : (
            <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
              <p className="text-sm font-medium text-text">Belum ada jabatan</p>
              <p className="mt-1 text-xs text-text-muted">
                Tambahkan jabatan supaya pegawai bisa ditautkan dan agregasi per unit punya isi.
              </p>
            </div>
          )
        }
      />

      {form !== null ? (
        <FormJabatan jabatan={form.jabatan} opsiUnit={opsiUnit} onTutup={() => setForm(null)} />
      ) : null}

      <DialogKonfirmasi
        buka={akanHapus !== null}
        onTutup={() => setAkanHapus(null)}
        onKonfirmasi={konfirmasiHapus}
        judul={`Hapus jabatan "${akanHapus?.namaJabatan ?? ''}"?`}
        deskripsi="Kalau jabatan ini masih tersangkut riwayat jabatan pegawai atau keanggotaan jabatan target, ia akan DIARSIPKAN (status Diarsipkan) alih-alih dihapus — supaya jejak karier pegawai tidak bolong."
        labelKonfirmasi="Hapus jabatan"
        labelPending="Memproses…"
        pending={pending}
        destruktif
      />
    </>
  )
}
