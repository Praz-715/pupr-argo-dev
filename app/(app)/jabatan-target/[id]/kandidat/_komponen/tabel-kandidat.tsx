'use client'

import { TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import { DataTable, type KolomTabel } from '@/components/ui/data-table'
import { NoResultState } from '@/components/ui/states'
import { formatNip, formatSkor } from '@/lib/format'
import type { BarisKandidat } from '@/lib/kueri/rubrik'

/**
 * Tabel kandidat satu jabatan target.
 *
 * Urutan kolom mengikuti aturan K-4: **Kotak 9 & predikat kinerja lebih dulu,
 * baru match score**. Match score tidak mengandung unsur kinerja sama sekali,
 * jadi menaruhnya sendirian di kolom pertama akan membuat pembaca menyimpulkan
 * peringkat suksesi dari angka yang mengabaikan kinerja.
 */
export function TabelKandidat({
  jabatanTargetId,
  baris,
  total,
  halaman,
  ukuranHalaman,
}: {
  jabatanTargetId: number
  baris: BarisKandidat[]
  total: number
  halaman: number
  ukuranHalaman: number
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const nipTerbuka = (searchParams.get('rincian') ?? '').replace(/\D/g, '')

  /*
    Tautan rinciannya TOGGLE, bukan sekali-arah: menekan "Lihat" pada baris yang
    rinciannya sedang terbuka menutupnya kembali. Tanpa itu satu-satunya cara
    menutup panel adalah tombol silang di panelnya — yang letaknya justru di bawah,
    tempat pengguna baru saja pergi dari sini.

    `#rincian` DILEPAS dari href. Ia tidak pernah bekerja: panelnya dirender server
    di balik `<Suspense>`, jadi saat navigasi terjadi elemen tujuannya belum ada.
    Yang menggulir sekarang panelnya sendiri, tepat ketika ia terpasang (lihat
    `GulirKeSini` di `panel-rincian.tsx`). Menyisakan anchor yang tidak menuju apa
    pun hanya menyesatkan orang berikutnya yang membaca berkas ini.
  */
  function tautanRincian(nip: string): string {
    const params = new URLSearchParams(searchParams.toString())
    if (nip === nipTerbuka) params.delete('rincian')
    else params.set('rincian', nip)
    const q = params.toString()
    return q === '' ? pathname : `${pathname}?${q}`
  }

  const kolom: Array<KolomTabel<BarisKandidat>> = [
    {
      kunci: 'nama',
      judul: 'Kandidat',
      sticky: true,
      wajib: true,
      lebarMin: '15rem',
      render: (b) => (
        <span className="block">
          <span className="block font-medium text-text">{b.nama}</span>
          <span className="tabular block text-[11px] text-text-subtle">{formatNip(b.nip)}</span>
        </span>
      ),
    },
    {
      kunci: 'jabatan',
      judul: 'Jabatan saat ini',
      bisaDiurutkan: false,
      lebarMin: '13rem',
      render: (b) => (
        <span className="block">
          <span className="block text-text-muted">{b.namaJabatan ?? '—'}</span>
          <span className="block text-[11px] text-text-subtle">{b.namaUnit ?? '—'}</span>
        </span>
      ),
    },
    {
      kunci: 'kotak9',
      judul: 'Kotak 9',
      subjudul: 'kinerja × potensial',
      rataKanan: true,
      render: (b) =>
        b.kotak9 === null ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <span className="tabular font-medium text-text">{b.kotak9}</span>
        ),
    },
    {
      kunci: 'predikat',
      judul: 'Predikat kinerja',
      subjudul: 'sumbu Y — tidak masuk match score',
      bisaDiurutkan: false,
      lebarMin: '9rem',
      render: (b) =>
        b.predikatKinerja === null ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <span className="text-text-muted">{b.predikatKinerja}</span>
        ),
    },
    {
      kunci: 'potkom',
      judul: 'Potkom',
      subjudul: 'bobot 65% · 0–100',
      rataKanan: true,
      render: (b) => (
        <span className="tabular text-text-muted">{formatSkor(b.skorPotensiKompetensi)}</span>
      ),
    },
    {
      kunci: 'kualifikasi',
      judul: 'Kualifikasi',
      subjudul: 'bobot 20% · 0–100',
      rataKanan: true,
      bisaDiurutkan: false,
      tersembunyiBawaan: true,
      render: (b) => (
        <span className="tabular text-text-muted">{formatSkor(b.skorKualifikasiJabatan)}</span>
      ),
    },
    {
      kunci: 'integritas',
      judul: 'Integritas',
      subjudul: 'bobot 15% · 0–100',
      rataKanan: true,
      bisaDiurutkan: false,
      tersembunyiBawaan: true,
      render: (b) => (
        <span className="tabular text-text-muted">{formatSkor(b.skorIntegritasMoralitas)}</span>
      ),
    },
    {
      kunci: 'skorTotal',
      judul: 'Match score',
      subjudul: '65/20/15 · 0–100',
      rataKanan: true,
      render: (b) => (
        <span className="tabular font-semibold text-text">{formatSkor(b.skorTotal)}</span>
      ),
    },
    {
      kunci: 'kelayakan',
      judul: 'Kelayakan',
      bisaDiurutkan: false,
      lebarMin: '9rem',
      render: (b) => (
        <span className="flex flex-wrap items-center gap-1">
          {b.eligible ? (
            <Badge tone="sukses">lolos syarat</Badge>
          ) : (
            <Badge tone="netral" title={b.catatanEligibility ?? undefined}>
              tidak lolos
            </Badge>
          )}
          {b.statusPool !== null ? (
            <Badge tone="aksen" title={`Peringkat pool ${b.rankingPool ?? '—'}`}>
              {b.statusPool.toLowerCase()}
            </Badge>
          ) : null}
        </span>
      ),
    },
    {
      kunci: 'rincian',
      judul: 'Rincian',
      bisaDiurutkan: false,
      render: (b) => (
        <span className="flex items-center gap-1.5">
          <Link
            href={tautanRincian(b.nip)}
            scroll={false}
            aria-expanded={b.nip === nipTerbuka}
            className="text-[12px] text-accent hover:underline"
          >
            {b.nip === nipTerbuka ? 'Sembunyikan' : 'Lihat'}
          </Link>
          {b.jumlahPerluReview > 0 ? (
            <span
              title={`${b.jumlahPerluReview} indikator perlu ditinjau`}
              className="flex items-center gap-0.5 text-[11px] text-warning"
            >
              <TriangleAlert className="size-3" />
              {b.jumlahPerluReview}
            </span>
          ) : null}
          {b.jumlahManual > 0 ? (
            <span
              title={`${b.jumlahManual} nilai diisi manusia`}
              className="text-[11px] text-accent"
            >
              {b.jumlahManual}m
            </span>
          ) : null}
        </span>
      ),
    },
  ]

  return (
    <DataTable
      id={`kandidat-${jabatanTargetId}`}
      kolom={kolom}
      baris={baris}
      kunciBaris={(b) => b.nip}
      barisAktif={(b) => b.nip === nipTerbuka}
      /*
        Penanda kuning untuk pegawai berkode catatan (`2 sept- masukan sistem
        informasi.pdf` butir 1). Alasannya dikembalikan sebagai teks, bukan boolean:
        ia jadi `title` barisnya, dan warna sendirian tidak terbaca pembaca layar
        maupun pengguna CVD.
      */
      barisDitandai={(b) =>
        b.catatanKategori === null
          ? null
          : `Catatan: ${b.catatanKategori}${b.catatanKeterangan ? ` — ${b.catatanKeterangan}` : ''}`
      }
      total={total}
      halaman={halaman}
      ukuranHalaman={ukuranHalaman}
      kosong={
        <NoResultState
          className="m-3.5 border-0"
          filterAktif={[
            searchParams.get('cari') ? `Pencarian: ${searchParams.get('cari')}` : null,
            searchParams.get('eligible') === '1' ? 'Hanya lolos syarat' : null,
          ].filter((f): f is string => f !== null)}
        />
      }
    />
  )
}

