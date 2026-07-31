import { X } from 'lucide-react'
import Link from 'next/link'

import { Kotak9Grid } from '@/components/charts/kotak9-grid'
import { Badge } from '@/components/ui/badge'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Kotak9Skeleton, ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatAngka, formatNip, formatSkorRingkas } from '@/lib/format'
import { ambilAnggotaKotak, ambilSebaranKotak9 } from '@/lib/kueri/dashboard'
import { DESKRIPSI_KOTAK_9, type Kotak9 } from '@/lib/scoring'

/**
 * W2 · Sebaran 9 Kotak Manajemen Talenta ASN.
 *
 * Menyertakan basis data secara eksplisit: berapa pegawai dinilai, berapa yang
 * belum punya asesmen, dan berapa yang asesmennya kedaluwarsa. Tanpa itu,
 * pembaca tidak tahu apakah grid ini mewakili seluruh pegawai atau sebagian.
 */
export async function SebaranKotak9({ kotakAktif }: { kotakAktif: number | null }) {
  const d = await ambilSebaranKotak9()

  if (d.totalDinilai === 0) {
    return (
      <Panel>
        <PanelHeader judul="Sebaran Kotak 9" />
        <EmptyState
          className="mt-4"
          judul="Belum ada pegawai yang diases"
          deskripsi="Peta talenta terbentuk setelah data asesmen dari e-Nominasi masuk. Jalankan konsolidasi data lebih dulu."
        />
      </Panel>
    )
  }

  const dikecualikan: string[] = []
  if (d.tanpaAsesmen > 0) dikecualikan.push(`${formatAngka(d.tanpaAsesmen)} belum diases`)
  if (d.asesmenKedaluwarsa > 0) {
    dikecualikan.push(`${formatAngka(d.asesmenKedaluwarsa)} asesmen kedaluwarsa`)
  }

  return (
    <Panel className="flex flex-col">
      <PanelHeader
        judul="Sebaran Kotak 9"
        deskripsi={
          <>
            {formatAngka(d.totalDinilai)} pegawai · asesmen terbaru per orang
            {d.tahunTerlama && d.tahunTerbaru
              ? ` · tahun ${d.tahunTerlama}–${d.tahunTerbaru}`
              : ''}
            {dikecualikan.length > 0 ? ` · ${dikecualikan.join(', ')}` : ''}
          </>
        }
        aksi={
          <span className="flex shrink-0 items-center gap-2">
            {d.asesmenKedaluwarsa > 0 ? (
              <Badge tone="peringatan" title="Asesmen kedaluwarsa tetap ditampilkan di grid, tapi tidak eligible untuk talent pool">
                {formatAngka(d.asesmenKedaluwarsa)} kedaluwarsa
              </Badge>
            ) : null}
            {/* Widget dashboard tidak punya filter; yang mau menyaring per unit/
                jenjang/tahun perlu tahu bahwa halaman penuhnya ada. */}
            <Link
              href="/peta-talenta"
              className="text-[11px] whitespace-nowrap text-accent hover:underline"
            >
              Peta lengkap
            </Link>
          </span>
        }
      />

      <div className="mt-4">
        <Kotak9Grid perKotak={d.perKotak} total={d.totalDinilai} kotakAktif={kotakAktif} />
      </div>

      <p className="mt-3 border-t border-border pt-3 text-[11px] leading-relaxed text-text-subtle">
        Intensitas warna <strong className="font-medium text-text-muted">relatif</strong>{' '}
        terhadap sel terpadat, bukan skala absolut. Predikat &ldquo;Baik&rdquo; sudah bernilai 80
        dan ambang Di Atas Ekspektasi adalah ≥80, jadi baris teratas memang cenderung berat. Klik
        sel untuk melihat pegawainya.
      </p>
    </Panel>
  )
}

/** Panel drill-down: muncul saat `?kotak=N` ada di URL. */
export async function AnggotaKotak({ kotak }: { kotak: number }) {
  const { daftar, total } = await ambilAnggotaKotak(kotak)
  const valid = kotak >= 1 && kotak <= 9

  return (
    <Panel padat>
      <div className="flex items-start justify-between gap-4 border-b border-border p-4">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-text">
            Pegawai di Kotak {kotak}
            <span className="tabular ml-2 font-normal text-text-subtle">
              {formatAngka(total)} orang
            </span>
          </h2>
          {valid ? (
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-text-subtle">
              {DESKRIPSI_KOTAK_9[kotak as Kotak9]}
            </p>
          ) : null}
        </div>
        <Link
          href="/"
          scroll={false}
          aria-label="Tutup daftar pegawai"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-text-subtle transition-colors hover:bg-surface-3 hover:text-text"
        >
          <X className="size-4" />
        </Link>
      </div>

      {daftar.length === 0 ? (
        <p className="p-6 text-center text-[13px] text-text-muted">
          Tidak ada pegawai di kotak ini.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-wide text-text-subtle uppercase">
                <th className="px-4 py-2 font-medium">Nama & NIP</th>
                <th className="px-4 py-2 font-medium">Jabatan</th>
                <th className="px-4 py-2 text-right font-medium">Kinerja</th>
                <th className="px-4 py-2 text-right font-medium">Potensial</th>
                <th className="px-4 py-2 font-medium">Asesmen</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((p) => (
                <tr
                  key={p.pegawaiId}
                  className="border-b border-border last:border-b-0 hover:bg-surface-2"
                >
                  <td className="px-4 py-2.5">
                    <Link href={`/talenta/${p.nip}`} className="block hover:text-accent">
                      <span className="block font-medium text-text">{p.nama}</span>
                      <span className="tabular block text-[11px] text-text-subtle">
                        {formatNip(p.nip)}
                      </span>
                    </Link>
                  </td>
                  <td className="max-w-[18rem] px-4 py-2.5 text-text-muted">
                    <span className="block truncate" title={p.namaJabatan ?? undefined}>
                      {p.namaJabatan ?? '—'}
                    </span>
                    <span className="block truncate text-[11px] text-text-subtle">
                      {p.namaUnit ?? '—'}
                    </span>
                  </td>
                  <td className="tabular px-4 py-2.5 text-right">
                    <span className="block font-medium text-text">
                      {formatSkorRingkas(p.nilaiKinerjaY)}
                    </span>
                    {/* Predikat & kategori sumbu adalah DUA taksonomi berbeda —
                        jangan dicampur dalam satu kolom (phase.md §3 K-3) */}
                    <span className="block text-[11px] text-text-subtle">{p.predikat}</span>
                  </td>
                  <td className="tabular px-4 py-2.5 text-right font-medium text-text">
                    {formatSkorRingkas(p.nilaiPotensialX)}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="tabular block text-text-muted">{p.tahunAsesmen}</span>
                    {p.statusAsesmen !== 'Berlaku' ? (
                      <Badge tone="peringatan" className="mt-0.5">
                        {p.statusAsesmen}
                      </Badge>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-border px-4 py-2.5 text-[11px] text-text-subtle">
        {total > daftar.length
          ? `Menampilkan ${formatAngka(daftar.length)} dari ${formatAngka(total)} pegawai, diurutkan dari nilai potensial tertinggi. `
          : 'Diurutkan dari nilai potensial tertinggi. '}
        <Link href={`/talenta?kotak=${kotak}`} className="text-accent hover:underline">
          Buka {formatAngka(total)} pegawai ini di Direktori
        </Link>{' '}
        untuk memfilter & mengurutkan lebih lanjut.
      </p>
    </Panel>
  )
}

export function SebaranKotak9Skeleton() {
  return (
    <Panel>
      <Skeleton className="h-4 w-36" />
      <Skeleton className="mt-2 h-3 w-full max-w-md" />
      <div className="mt-4">
        <Kotak9Skeleton />
      </div>
    </Panel>
  )
}

export function AnggotaKotakSkeleton() {
  return (
    <Panel>
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-2 h-3 w-full max-w-xl" />
      <div className="mt-4">
        <ListSkeleton rows={6} />
      </div>
    </Panel>
  )
}
