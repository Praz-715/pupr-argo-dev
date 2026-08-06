import { ArrowRight, TriangleAlert } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { formatAngka, formatNip, formatSkorRingkas } from '@/lib/format'
import { ambilJabatanKosongRinci, ambilPejabatBerisiko } from '@/lib/kueri/master'
import { TombolJadikanDraft } from './tombol-jadikan-draft'

/**
 * Jabatan Kosong & Risiko Kekosongan — **dipindahkan** dari `/master/jabatan-kosong`
 * ke halaman Jabatan Target (Fase 11 no. 2, U-14).
 *
 * Alasannya bukan penghematan halaman. Begitu Peta Talenta bisa disaring per
 * jabatan target, kekosongan **tanpa** jabatan target berubah dari catatan jadi
 * penghalang: di `pupr_dev` ada 6 jabatan KOSONG tapi hanya 2 yang punya rubrik,
 * jadi empat sisanya tidak bisa dinilai sama sekali. Menaruh daftarnya di halaman
 * yang sama dengan tempat rubrik dibuat mengubahnya jadi **antrean kerja dengan
 * tombolnya sendiri**, alih-alih dua halaman yang harus dicocokkan sendiri oleh
 * pembacanya.
 *
 * Peran nav kedua halaman **sudah identik** (Super Admin · Admin Talenta ·
 * Pimpinan), jadi peleburan ini tidak menggeser siapa boleh melihat apa. Itu
 * diperiksa lebih dulu, bukan diasumsikan.
 */

export async function PanelJabatanKosong({
  hanyaStrategis,
  bolehUbah,
}: {
  hanyaStrategis: boolean
  bolehUbah: boolean
}) {
  const { daftar, total, tanpaTarget } = await ambilJabatanKosongRinci(hanyaStrategis)

  return (
    <Panel padat id="jabatan-kosong">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3.5 py-3">
        <PanelHeader
          judul="Sudah kosong"
          deskripsi={
            total === 0
              ? 'Tidak ada jabatan berstatus kosong.'
              : `${formatAngka(total)} jabatan${hanyaStrategis ? ' strategis (eselon I–III)' : ''} · ${formatAngka(tanpaTarget)} belum punya jabatan target`
          }
        />
        <Link
          href={hanyaStrategis ? '/jabatan-target#jabatan-kosong' : '/jabatan-target?strategis=1#jabatan-kosong'}
          scroll={false}
          className="text-[11px] whitespace-nowrap text-accent hover:underline"
        >
          {hanyaStrategis ? 'Tampilkan semua eselon' : 'Hanya eselon I–III'}
        </Link>
      </div>

      {tanpaTarget > 0 ? (
        <p className="border-b border-border bg-warning-subtle px-3.5 py-2.5 text-[12px] leading-relaxed text-text-muted">
          <strong className="font-medium text-warning">
            {formatAngka(tanpaTarget)} dari {formatAngka(total)} jabatan kosong belum punya jabatan
            target
          </strong>{' '}
          — kandidatnya belum bisa dinilai sama sekali, dan jabatan itu tidak muncul di pemilih Peta
          Talenta. {bolehUbah ? 'Tekan “Jadikan draft” pada barisnya untuk mulai.' : null}
        </p>
      ) : null}

      {total === 0 ? (
        <div className="p-4">
          <EmptyState
            judul="Tidak ada jabatan kosong"
            deskripsi="Seluruh jabatan berstatus terisi. Bagian di bawah menunjukkan yang akan kosong."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-text-subtle uppercase">
                <th className="px-3 py-2">Jabatan</th>
                <th className="px-3 py-2">Unit Organisasi</th>
                <th className="px-3 py-2">Eselon</th>
                <th className="px-3 py-2">Kesiapan suksesi</th>
                <th className="px-3 py-2 text-right">Kandidat pool</th>
                <th className="px-3 py-2 text-right">Siap</th>
                {bolehUbah ? <th className="px-3 py-2 text-right">Aksi</th> : null}
              </tr>
            </thead>
            <tbody>
              {daftar.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="block font-medium text-text">{d.namaJabatan}</span>
                    <span className="tabular block text-[11px] text-text-subtle">
                      {d.kodeJabatan} · {d.jenjang}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-muted">{d.namaUnit}</td>
                  <td className="px-3 py-2 text-text-muted">
                    {d.eselon === 'NON_ESELON' ? (
                      <span className="whitespace-nowrap text-text-subtle">Non-eselon</span>
                    ) : (
                      d.eselon
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {!d.adaJabatanTarget ? (
                      <span className="flex items-start gap-1.5">
                        <Badge tone="peringatan">Belum ada jabatan target</Badge>
                      </span>
                    ) : d.jumlahKandidatSiap > 0 ? (
                      <Badge tone="sukses">Ada suksesor siap</Badge>
                    ) : (
                      <Badge tone="aksen">Target ada, suksesor belum</Badge>
                    )}
                  </td>
                  <td className="tabular px-3 py-2 text-right text-text-muted">
                    {formatAngka(d.jumlahKandidatPool)}
                  </td>
                  <td className="tabular px-3 py-2 text-right font-medium text-text">
                    {formatAngka(d.jumlahKandidatSiap)}
                  </td>
                  {bolehUbah ? (
                    <td className="px-3 py-2 text-right">
                      {/*
                        Tombol hanya untuk yang BELUM punya target. Yang sudah punya
                        tidak diberi tombol "buat lagi": dua rubrik untuk posisi yang
                        sama berarti dua skor untuk orang yang sama tanpa ada yang
                        tahu mana yang berlaku. Server menolaknya juga — halaman bisa
                        basi.
                      */}
                      {!d.adaJabatanTarget ? (
                        <TombolJadikanDraft jabatanId={d.id} namaJabatan={d.namaJabatan} />
                      ) : (
                        <span className="text-[11px] text-text-subtle">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-border px-3.5 py-3 text-[11px] leading-relaxed text-text-subtle">
        Diurutkan dengan <strong className="font-medium text-text-muted">yang belum punya jabatan
        target di atas</strong>: tanpa profil target, kandidatnya belum bisa dinilai sama sekali —
        itu kekosongan yang paling jauh dari terisi, bukan sekadar yang paling tinggi eselonnya.
      </p>
    </Panel>
  )
}

export async function PanelRisikoKekosongan({ ambang }: { ambang: number }) {
  const { daftar, totalDiperiksa, nipTidakTerbaca } = await ambilPejabatBerisiko(ambang)

  return (
    <Panel padat id="risiko-kekosongan">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3.5 py-3">
        <PanelHeader
          judul="Akan kosong — pejabat mendekati Batas Usia Pensiun"
          deskripsi={
            <>
              {formatAngka(daftar.length)} dari {formatAngka(totalDiperiksa)} pejabat aktif berada
              dalam {ambang} tahun menuju BUP · usia & BUP diturunkan dari NIP, bukan kolom
              tersendiri
              {nipTidakTerbaca > 0
                ? ` · ${formatAngka(nipTidakTerbaca)} dikecualikan karena NIP-nya tidak terbaca`
                : ''}
            </>
          }
        />
        <span className="flex shrink-0 items-center gap-1 text-[11px]">
          {[1, 3, 5, 10].map((n) => (
            <Link
              key={n}
              href={`/jabatan-target?ambang=${n}#risiko-kekosongan`}
              scroll={false}
              className={
                n === ambang
                  ? 'rounded border border-accent bg-accent-subtle px-1.5 py-0.5 font-medium text-text'
                  : 'rounded border border-border px-1.5 py-0.5 text-text-muted hover:border-border-strong hover:text-text'
              }
            >
              {n} thn
            </Link>
          ))}
        </span>
      </div>

      {daftar.length === 0 ? (
        <div className="p-4">
          <EmptyState
            judul={`Tidak ada pejabat dalam ${ambang} tahun menuju BUP`}
            deskripsi="Perlebar jangka waktu di atas untuk melihat yang lebih jauh. Angka ini dihitung dari tanggal lahir di NIP terhadap batas usia pensiun jenis jabatannya (58/60/65)."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-text-subtle uppercase">
                <th className="px-3 py-2">Pejabat</th>
                <th className="px-3 py-2">Jabatan &amp; unit</th>
                <th className="px-3 py-2 text-right">Usia</th>
                <th className="px-3 py-2 text-right">BUP</th>
                <th className="px-3 py-2 text-right">Sisa</th>
                <th className="px-3 py-2 text-right">Lama menjabat</th>
                <th className="px-3 py-2">Kesiapan suksesi</th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((d) => {
                const mendesak = (d.tahunKePensiun ?? 99) <= 1
                return (
                  <tr key={d.pegawaiId} className="border-b border-border last:border-b-0">
                    <td className="px-3 py-2">
                      <Link
                        href={`/talenta/${d.nip}`}
                        className="block font-medium text-text hover:text-accent hover:underline"
                      >
                        {d.nama}
                      </Link>
                      <span className="tabular block text-[11px] text-text-subtle">
                        {formatNip(d.nip)}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span className="block max-w-[20rem] truncate text-text-muted" title={d.namaJabatan}>
                        {d.namaJabatan}
                      </span>
                      <span className="block max-w-[20rem] truncate text-[11px] text-text-subtle" title={d.namaUnit}>
                        {d.eselon === 'NON_ESELON' ? 'Non-eselon' : `Eselon ${d.eselon}`} ·{' '}
                        {d.namaUnit}
                      </span>
                    </td>
                    <td className="tabular px-3 py-2 text-right text-text-muted">
                      {formatAngka(d.usia)}
                    </td>
                    <td className="tabular px-3 py-2 text-right text-text-subtle">
                      {d.batasUsiaPensiun}
                    </td>
                    <td
                      className={
                        mendesak
                          ? 'tabular px-3 py-2 text-right font-semibold text-warning'
                          : 'tabular px-3 py-2 text-right font-medium text-text'
                      }
                    >
                      {formatSkorRingkas(d.tahunKePensiun)} thn
                    </td>
                    <td className="tabular px-3 py-2 text-right text-text-muted">
                      {d.lamaMenjabatTahun === null
                        ? '—'
                        : `${formatSkorRingkas(d.lamaMenjabatTahun)} thn`}
                    </td>
                    <td className="px-3 py-2">
                      {!d.adaJabatanTarget ? (
                        <span className="flex items-center gap-1.5">
                          <TriangleAlert className="size-3.5 shrink-0 text-warning" />
                          <span className="text-[12px] text-text-muted">
                            Belum ada jabatan target
                          </span>
                        </span>
                      ) : d.jumlahKandidatSiap > 0 ? (
                        <Badge tone="sukses">
                          {formatAngka(d.jumlahKandidatSiap)} suksesor siap
                        </Badge>
                      ) : (
                        <Badge tone="peringatan">Tanpa suksesor siap</Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-3.5 py-3">
        <p className="max-w-3xl text-[11px] leading-relaxed text-text-subtle">
          Sisa masa jabatan dihitung dari tanggal lahir pada NIP terhadap batas usia pensiun jenis
          jabatannya. Angka ini <strong className="font-medium text-text-muted">turunan</strong>,
          tidak disimpan sebagai kolom — jadi otomatis ikut betul kalau NIP dibetulkan, dan otomatis
          hilang kalau NIP-nya tidak valid.
        </p>
        <Link
          href="/bandingkan"
          className="flex shrink-0 items-center gap-1 text-[11px] text-accent hover:underline"
        >
          Bandingkan calon suksesor
          <ArrowRight className="size-3" />
        </Link>
      </div>
    </Panel>
  )
}

export function KosongSkeleton() {
  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="mt-2 h-3 w-full max-w-md" />
      </div>
      <TableSkeleton rows={6} cols={['2fr', '2fr', '0.6fr', '1.4fr', '0.8fr', '0.5fr', '0.9fr']} />
    </Panel>
  )
}

export function RisikoSkeleton() {
  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="mt-2 h-3 w-full max-w-xl" />
      </div>
      <TableSkeleton rows={4} cols={['1.6fr', '2fr', '0.5fr', '0.5fr', '0.6fr', '0.8fr', '1.2fr']} />
    </Panel>
  )
}

/** Ambang tahun menuju BUP dari `?ambang=`; divalidasi di boundary. */
export function bacaAmbang(nilai: string | undefined): number {
  const n = Number(nilai)
  return Number.isInteger(n) && n >= 1 && n <= 20 ? n : 3
}
