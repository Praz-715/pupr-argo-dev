'use client'

import { Badge } from '@/components/ui/badge'
import { DataTable, type KolomTabel } from '@/components/ui/data-table'
import { NoResultState } from '@/components/ui/states'
import { formatAngka, formatNip, formatSkorRingkas } from '@/lib/format'
import type { BarisDirektori } from '@/lib/kueri/pegawai'
import { usePathname, useRouter } from 'next/navigation'

/**
 * Tabel Direktori Pegawai — kolomnya mengikuti mockup #1 "Tabel Utama Talent
 * Pool" di doc/KERANGKA TALENT POOL.md, ditambah kolom turunan yang berguna
 * (usia dari NIP) yang bisa disembunyikan.
 *
 * Catatan penting soal dua kolom yang mudah tertukar:
 *   - **Predikat Kinerja** adalah taksonomi predikat (Sangat Baik…Sangat Kurang),
 *     BUKAN kategori sumbu Kotak 9 (Di Atas/Sesuai/Di Bawah Ekspektasi).
 *     Keduanya tidak pernah digabung dalam satu kolom (phase.md §3 K-3).
 *   - **Nilai Integritas** memakai skala rubrik 0–100 (phase.md §2.7), bukan
 *     skala kecil 1–4 yang pernah dikirim sumber. Skalanya ditulis di subjudul
 *     kolom supaya tidak ada tafsir ganda.
 */
export function TabelDirektori({
  baris,
  total,
  halaman,
  ukuranHalaman,
  adaFilter,
}: {
  baris: BarisDirektori[]
  total: number
  halaman: number
  ukuranHalaman: number
  adaFilter: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()

  const kolom: Array<KolomTabel<BarisDirektori>> = [
    {
      kunci: 'nama',
      judul: 'NIP & Nama Lengkap',
      sticky: true,
      wajib: true,
      lebarMin: '15rem',
      render: (p) => (
        <>
          <span className="block font-medium text-text">{p.nama}</span>
          <span className="tabular block text-[11px] text-text-subtle">{formatNip(p.nip)}</span>
        </>
      ),
    },
    {
      kunci: 'jabatan',
      judul: 'Jabatan',
      lebarMin: '16rem',
      render: (p) => (
        <span className="block max-w-[20rem] truncate text-text-muted" title={p.namaJabatan ?? ''}>
          {p.namaJabatan ?? <span className="text-text-subtle">Belum tertaut jabatan</span>}
        </span>
      ),
    },
    {
      kunci: 'eselon',
      judul: 'Eselon',
      render: (p) =>
        p.eselon === null ? (
          <span className="text-text-subtle">—</span>
        ) : p.eselon === 'NON_ESELON' ? (
          // Tanpa nowrap, "Non-eselon" terpotong jadi dua baris dan tinggi baris
          // tabel ikut naik — merusak densitas yang jadi tujuan halaman ini.
          <span className="whitespace-nowrap text-text-subtle">Non-eselon</span>
        ) : (
          <span className="text-text-muted">{p.eselon}</span>
        ),
    },
    {
      kunci: 'unit',
      judul: 'Unit Organisasi',
      lebarMin: '14rem',
      render: (p) => (
        <span className="block max-w-[18rem] truncate text-text-muted" title={p.namaUnit ?? ''}>
          {p.namaUnit ?? '—'}
        </span>
      ),
    },
    {
      kunci: 'pangkat',
      judul: 'Pangkat',
      lebarMin: '10rem',
      render: (p) => (
        <>
          <span className="block text-text-muted">{p.pangkat}</span>
          <span className="tabular block text-[11px] text-text-subtle">{p.golongan ?? '—'}</span>
        </>
      ),
    },
    {
      kunci: 'jenjang',
      judul: 'Jenjang',
      lebarMin: '9rem',
      render: (p) => <span className="text-text-muted">{p.jenjang ?? '—'}</span>,
    },
    {
      kunci: 'jenisAsesmen',
      judul: 'Jenis Asesmen',
      lebarMin: '9rem',
      render: (p) =>
        p.jenisAsesmen === null ? (
          <span className="text-text-subtle">Belum diases</span>
        ) : (
          <>
            <span className="block text-text-muted">{p.jenisAsesmen}</span>
            <span className="tabular block text-[11px] text-text-subtle">
              {p.tahunAsesmen}
              {p.statusAsesmen && p.statusAsesmen !== 'Berlaku' ? ` · ${p.statusAsesmen}` : ''}
            </span>
          </>
        ),
    },
    {
      kunci: 'potkom',
      judul: 'Potkom',
      subjudul: '0–100',
      rataKanan: true,
      render: (p) =>
        p.potkom === null ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <span className="tabular font-medium text-text">{formatSkorRingkas(p.potkom)}</span>
        ),
    },
    {
      kunci: 'integritas',
      judul: 'Integritas',
      subjudul: '0–100 · rubrik',
      rataKanan: true,
      render: (p) =>
        p.nilaiIntegritas === null ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <span
            className={
              p.nilaiIntegritas < 100
                ? 'tabular font-medium text-warning'
                : 'tabular text-text-muted'
            }
            title={
              p.nilaiIntegritas < 100
                ? 'Di bawah 100 berarti ada hukuman disiplin aktif'
                : undefined
            }
          >
            {formatSkorRingkas(p.nilaiIntegritas)}
          </span>
        ),
    },
    {
      kunci: 'predikat',
      judul: 'Predikat Kinerja',
      lebarMin: '10rem',
      render: (p) =>
        p.predikatKinerja === null ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <span className="text-text-muted">{p.predikatKinerja}</span>
        ),
    },
    {
      kunci: 'kotak9',
      judul: 'Kotak 9',
      rataKanan: true,
      render: (p) =>
        p.kotak9 === null ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <Badge tone={p.kotak9 >= 7 ? 'sukses' : p.kotak9 >= 4 ? 'aksen' : 'peringatan'}>
            {p.kotak9}
          </Badge>
        ),
    },
    {
      kunci: 'talenta',
      judul: 'Usia',
      subjudul: 'dari NIP',
      rataKanan: true,
      bisaDiurutkan: false,
      tersembunyiBawaan: true,
      render: (p) =>
        p.usia === null ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <span className="tabular text-text-muted">{formatAngka(p.usia)}</span>
        ),
    },
  ]

  return (
    <DataTable
      id="direktori-pegawai"
      kolom={kolom}
      baris={baris}
      kunciBaris={(p) => p.pegawaiId}
      tautanBaris={(p) => `/talenta/${p.nip}`}
      total={total}
      halaman={halaman}
      ukuranHalaman={ukuranHalaman}
      kosong={
        adaFilter ? (
          <NoResultState onReset={() => router.push(pathname, { scroll: false })} />
        ) : (
          <div className="rounded-lg border border-dashed border-border px-6 py-12 text-center">
            <p className="text-sm font-medium text-text">Belum ada data pegawai</p>
            <p className="mt-1 text-xs text-text-muted">
              Data pegawai masuk lewat konsolidasi dari eHRM/e-Nominasi.
            </p>
          </div>
        )
      }
    />
  )
}
