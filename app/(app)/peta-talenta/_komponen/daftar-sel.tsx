'use client'

import { Badge } from '@/components/ui/badge'
import { DataTable, type KolomTabel } from '@/components/ui/data-table'
import { formatNip, formatSkor, formatSkorRingkas } from '@/lib/format'
import type { AnggotaSel } from '@/lib/kueri/peta-talenta'

/**
 * Isi satu sel Kotak 9 — inilah pengganti *jitter*.
 *
 * Sebaran di dalam satu sel dibaca sebagai daftar bernilai asli (Kinerja,
 * Potensial, Nilai Talenta apa adanya), bukan sebagai titik yang digeser ke
 * koordinat bukan miliknya (phase.md §7 Fase 3).
 *
 * Seluruh kolom **tidak bisa diurutkan** dengan sengaja: kuerinya mengurutkan
 * tetap menurut Nilai Talenta menurun. Menampilkan tombol urut yang tidak
 * mengubah apa pun berarti membuat klik mati (phase.md §5.2), jadi urutannya
 * dijelaskan di deskripsi panel dan tombolnya tidak dipasang.
 */
export function DaftarSel({
  daftar,
  total,
  halaman,
  ukuranHalaman,
}: {
  daftar: AnggotaSel[]
  total: number
  halaman: number
  ukuranHalaman: number
}) {
  const kolom: Array<KolomTabel<AnggotaSel>> = [
    {
      kunci: 'nama',
      judul: 'NIP & Nama Lengkap',
      sticky: true,
      wajib: true,
      bisaDiurutkan: false,
      lebarMin: '14rem',
      render: (a) => (
        <>
          <span className="block font-medium text-text">{a.nama}</span>
          <span className="tabular block text-[11px] text-text-subtle">{formatNip(a.nip)}</span>
        </>
      ),
    },
    {
      kunci: 'jabatan',
      judul: 'Jabatan',
      bisaDiurutkan: false,
      lebarMin: '15rem',
      render: (a) => (
        <span className="block max-w-[20rem] truncate text-text-muted" title={a.namaJabatan ?? ''}>
          {a.namaJabatan ?? <span className="text-text-subtle">Belum tertaut jabatan</span>}
        </span>
      ),
    },
    {
      kunci: 'unit',
      judul: 'Unit Organisasi',
      bisaDiurutkan: false,
      lebarMin: '14rem',
      render: (a) => (
        <span className="block max-w-[18rem] truncate text-text-muted" title={a.namaUnit ?? ''}>
          {a.namaUnit ?? '—'}
        </span>
      ),
    },
    {
      kunci: 'eselon',
      judul: 'Eselon',
      bisaDiurutkan: false,
      render: (a) =>
        a.eselon === null ? (
          <span className="text-text-subtle">—</span>
        ) : a.eselon === 'NON_ESELON' ? (
          <span className="whitespace-nowrap text-text-subtle">Non-eselon</span>
        ) : (
          <span className="text-text-muted">{a.eselon}</span>
        ),
    },
    {
      kunci: 'kinerja',
      judul: 'Kinerja',
      subjudul: 'sumbu Y · 0–100',
      rataKanan: true,
      bisaDiurutkan: false,
      render: (a) => (
        <span className="tabular font-medium text-text">{formatSkorRingkas(a.nilaiKinerjaY)}</span>
      ),
    },
    {
      kunci: 'predikat',
      judul: 'Predikat Kinerja',
      bisaDiurutkan: false,
      lebarMin: '9rem',
      // K-3: predikat dan kategori sumbu adalah dua taksonomi berbeda dan tidak
      // pernah digabung — "Butuh Perbaikan" justru berkategori "Sesuai Ekspektasi".
      render: (a) => <span className="text-text-muted">{a.predikat}</span>,
    },
    {
      kunci: 'potensial',
      judul: 'Potensial',
      subjudul: 'sumbu X · 0–100',
      rataKanan: true,
      bisaDiurutkan: false,
      render: (a) => (
        <span className="tabular font-medium text-text">{formatSkorRingkas(a.nilaiPotensialX)}</span>
      ),
    },
    {
      kunci: 'talenta',
      judul: 'Nilai Talenta',
      subjudul: '50% Y + 50% X',
      rataKanan: true,
      bisaDiurutkan: false,
      render: (a) => (
        <span className="tabular font-semibold text-text">{formatSkor(a.nilaiTalenta)}</span>
      ),
    },
    {
      kunci: 'asesmen',
      judul: 'Asesmen',
      bisaDiurutkan: false,
      render: (a) => (
        <>
          <span className="tabular block text-text-muted">{a.tahunAsesmen}</span>
          {a.statusAsesmen !== 'Berlaku' ? (
            <Badge tone="peringatan" title="Asesmen kedaluwarsa — tidak eligible untuk talent pool">
              {a.statusAsesmen === 'Expired' ? 'Kedaluwarsa' : a.statusAsesmen}
            </Badge>
          ) : null}
        </>
      ),
    },
  ]

  return (
    <DataTable
      id="anggota-sel-kotak9"
      kolom={kolom}
      baris={daftar}
      kunciBaris={(a) => a.pegawaiId}
      tautanBaris={(a) => `/talenta/${a.nip}`}
      total={total}
      halaman={halaman}
      ukuranHalaman={ukuranHalaman}
    />
  )
}
