'use client'

import { Search } from 'lucide-react'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { formatAngka } from '@/lib/format'
import { TombolEditor } from './tombol-editor'

const BATAS_AWAL = 8

/**
 * Riwayat diklat/sertifikasi. Sebagian pegawai punya sampai 30 entri, jadi
 * daftar ini dibatasi dulu lalu bisa diperluas, dan diberi pencarian — 30 baris
 * teks panjang yang langsung terbuka akan menenggelamkan bagian lain di profil.
 *
 * Data berasal dari kolom JSON `pegawai.riwayat_diklat` (tidak dinormalisasi,
 * lihat ERD.md §1 poin 6), jadi tidak ada tanggal/lokasi untuk ditampilkan.
 */
export function DaftarDiklat({
  diklat,
  pegawaiId,
}: {
  diklat: string[]
  /** Dibutuhkan tombol ubah per entri. */
  pegawaiId: number
}) {
  const [cari, setCari] = useState('')
  const [semua, setSemua] = useState(false)

  /**
   * Setiap entri membawa **indeks aslinya** di `pegawai.riwayat_diklat`.
   *
   * `simpanDiklat()` menunjuk entri yang diubah lewat indeks larik itu, dan
   * indeks dari `tampil.map((d, i) => …)` adalah posisi di larik yang sudah
   * DIFILTER dan DIPOTONG. Dengan pencarian aktif keduanya berbeda, jadi memakai
   * `i` akan mengubah nama entri yang lain — hasil yang tampak benar (dialognya
   * menampilkan nama yang diklik) sampai halaman dimuat ulang. Mencari ulang
   * dengan `indexOf` juga tidak bisa: nama diklat boleh sama.
   */
  const berindeks = useMemo(() => diklat.map((nama, indeks) => ({ nama, indeks })), [diklat])

  const cocok = useMemo(() => {
    const q = cari.trim().toLowerCase()
    if (q === '') return berindeks
    return berindeks.filter((d) => d.nama.toLowerCase().includes(q))
  }, [cari, berindeks])

  const tampil = semua || cari.trim() !== '' ? cocok : cocok.slice(0, BATAS_AWAL)
  const tersisa = cocok.length - tampil.length

  if (diklat.length === 0) {
    return (
      <p className="mt-3 text-[13px] text-text-muted">
        Belum ada riwayat diklat/sertifikasi tercatat. Indikator Pengembangan Kompetensi akan
        bernilai 50 (tidak memiliki riwayat yang sesuai) selama data ini kosong.
      </p>
    )
  }

  return (
    <div className="mt-3">
      {diklat.length > BATAS_AWAL ? (
        <div className="relative mb-2">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-subtle" />
          <input
            value={cari}
            onChange={(e) => setCari(e.target.value)}
            placeholder={`Cari di ${formatAngka(diklat.length)} riwayat diklat…`}
            aria-label="Cari riwayat diklat"
            className="h-8 w-full rounded-md border border-border bg-surface pl-8 text-[13px] text-text outline-none placeholder:text-text-subtle focus:border-accent"
          />
        </div>
      ) : null}

      {cocok.length === 0 ? (
        <p className="py-3 text-center text-[13px] text-text-muted">
          Tidak ada diklat yang cocok dengan “{cari}”.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {tampil.map((d) => (
            <li
              key={`${d.nama}-${d.indeks}`}
              className="flex items-start gap-2 text-[13px] leading-relaxed"
            >
              <span aria-hidden className="tabular mt-px shrink-0 text-[11px] text-text-subtle">
                {String(d.indeks + 1).padStart(2, '0')}
              </span>
              <span className="min-w-0 flex-1 text-text-muted">{d.nama}</span>
              <span className="shrink-0">
                <TombolEditor
                  jenis="diklat"
                  pegawaiId={pegawaiId}
                  baris={{ indeks: d.indeks, nama: d.nama }}
                />
              </span>
            </li>
          ))}
        </ul>
      )}

      {tersisa > 0 ? (
        <Button
          size="sm"
          variant="halus"
          className="mt-2"
          onClick={() => setSemua(true)}
        >
          Tampilkan {formatAngka(tersisa)} lainnya
        </Button>
      ) : null}
    </div>
  )
}
