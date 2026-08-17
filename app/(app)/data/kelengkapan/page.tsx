import Link from 'next/link'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { formatAngka, formatNip, formatPersenNilai } from '@/lib/format'
import { LABEL_TINGKAT, type TingkatKelengkapan } from '@/lib/kelengkapan'
import {
  TOTAL_BOBOT_KELENGKAPAN,
  ambilButirKelengkapan,
  ambilKelengkapanPerUnit,
  ambilPegawaiKelengkapanTerendah,
  ambilRingkasKelengkapan,
} from '@/lib/kueri/kualitas'

export const metadata = { title: 'Kelengkapan Data' }

/** Target kelengkapan data pegawai di PRD §2. */
const TARGET_PERSEN = 90

/**
 * Kelengkapan Data (usulan U-2).
 *
 * PRD §2 menargetkan "kelengkapan data pegawai ≥90%" dan §6.2 menyebut traffic
 * light, tapi tidak ada halaman yang **mendefinisikan** maupun **mengukurnya** —
 * target tanpa alat ukur tidak bisa dikejar. Halaman ini alat ukurnya.
 *
 * Bobot butir datang dari `lib/kelengkapan.ts`, dan ekspresi SQL-nya
 * **dihasilkan** dari daftar bobot yang sama (`lib/kueri/kelengkapan-sql.ts`),
 * sehingga angka di sini tidak mungkin berbeda dari badge di halaman profil.
 */
export default async function KelengkapanPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        judul="Kelengkapan Data"
        deskripsi={`Seberapa siap data pegawai untuk dinilai. Dihitung berbobot menurut dampaknya ke penilaian — bukan menurut jumlah kolom yang terisi. Target PRD: ≥${TARGET_PERSEN}%.`}
      />

      <Suspense fallback={<RingkasSkeleton />}>
        <IsiRingkas />
      </Suspense>

      {/* Tinggi baris DIPATOK. Dengan `items-start`, "Butir yang paling
          mendesak" tumbuh sampai 935px sementara rollup per unit berhenti di
          517px — 418px ruang kosong di bawah kolom kanan, celah terbesar yang
          ditemukan saat menyapu 31 rute (12 Agu 2026). `grid-rows-[minmax(0,1fr)]`
          wajib menyertainya: `h-` sendirian hanya menetapkan tinggi container
          sementara barisnya tetap `auto` dan boleh melebihinya. */}
      <div className="grid gap-4 xl:h-[32rem] xl:grid-cols-2 xl:grid-rows-[minmax(0,1fr)]">
        <Suspense fallback={<TabelSkeleton judul="w-40" baris={8} className="xl:h-full" />}>
          <IsiButir />
        </Suspense>
        <Suspense fallback={<TabelSkeleton judul="w-52" baris={8} className="xl:h-full" />}>
          <IsiPerUnit />
        </Suspense>
      </div>

      <Suspense fallback={<TabelSkeleton judul="w-56" baris={10} />}>
        <IsiPegawai />
      </Suspense>
    </div>
  )
}

async function IsiRingkas() {
  const r = await ambilRingkasKelengkapan()
  const persenTarget = r.totalPegawai === 0 ? 0 : (r.memenuhiTarget / r.totalPegawai) * 100

  const kartu: Array<{ label: string; nilai: string; penyebut: string; tone?: TingkatKelengkapan }> =
    [
      {
        label: 'Rerata kelengkapan',
        nilai: formatPersenNilai(r.rerataSkor),
        penyebut: `${formatAngka(r.totalPegawai)} pegawai aktif · total bobot ${TOTAL_BOBOT_KELENGKAPAN}`,
      },
      {
        label: `Memenuhi target ≥${TARGET_PERSEN}%`,
        nilai: formatAngka(r.memenuhiTarget),
        penyebut: `${formatPersenNilai(persenTarget)} dari ${formatAngka(r.totalPegawai)} pegawai`,
        tone: 'LENGKAP',
      },
      {
        label: 'Perlu dilengkapi',
        nilai: formatAngka(r.perTingkat.CUKUP),
        penyebut: 'skor 70–89% — bisa dinilai, tapi ada input yang bolong',
        tone: 'CUKUP',
      },
      {
        label: 'Kurang',
        nilai: formatAngka(r.perTingkat.KURANG),
        penyebut: 'skor <70% — penilaian jabatan target belum bisa diandalkan',
        tone: 'KURANG',
      },
    ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {kartu.map((k) => (
        <Panel key={k.label}>
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
            {k.label}
          </p>
          <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">{k.nilai}</p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">{k.penyebut}</p>
          {k.tone ? (
            <span className="mt-2 block">
              <Badge
                tone={
                  k.tone === 'LENGKAP' ? 'sukses' : k.tone === 'CUKUP' ? 'aksen' : 'peringatan'
                }
              >
                {LABEL_TINGKAT[k.tone]}
              </Badge>
            </span>
          ) : null}
        </Panel>
      ))}
    </div>
  )
}

async function IsiButir() {
  const butir = await ambilButirKelengkapan()

  return (
    <Panel padat className="flex flex-col xl:h-full xl:min-h-0">
      <div className="shrink-0 border-b border-border px-3.5 py-3">
        <PanelHeader
          judul="Butir yang paling mendesak"
          deskripsi="Diurutkan menurut bobot × jumlah pegawai yang belum memenuhinya — bukan menurut persentase, supaya butir berbobot besar tidak tertutup butir remeh yang kebetulan lebih banyak bolongnya."
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-surface-2">
            <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-text-subtle uppercase">
              <th className="px-3 py-2">Butir</th>
              <th className="px-3 py-2 text-right">Bobot</th>
              <th className="px-3 py-2 text-right">Terpenuhi</th>
              <th className="px-3 py-2 text-right">%</th>
            </tr>
          </thead>
          <tbody>
            {butir.map((b) => {
              const belum = b.total - b.terpenuhi
              return (
                <tr key={b.kunci} className="border-b border-border last:border-b-0">
                  <td className="px-3 py-2">
                    <span className="block font-medium text-text">{b.label}</span>
                    <span className="block max-w-[26rem] text-[11px] leading-relaxed text-text-subtle">
                      {b.alasan}
                    </span>
                  </td>
                  <td className="tabular px-3 py-2 text-right text-text-subtle">{b.bobot}</td>
                  <td className="tabular px-3 py-2 text-right text-text-muted">
                    {formatAngka(b.terpenuhi)}/{formatAngka(b.total)}
                    {belum > 0 ? (
                      <span className="block text-[11px] text-warning">−{formatAngka(belum)}</span>
                    ) : null}
                  </td>
                  <td
                    className={
                      b.persen >= TARGET_PERSEN
                        ? 'tabular px-3 py-2 text-right font-medium text-success'
                        : 'tabular px-3 py-2 text-right font-medium text-text'
                    }
                  >
                    {formatPersenNilai(b.persen)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

async function IsiPerUnit() {
  const unit = await ambilKelengkapanPerUnit()

  return (
    <Panel padat className="flex flex-col xl:h-full xl:min-h-0">
      <div className="shrink-0 border-b border-border px-3.5 py-3">
        <PanelHeader
          judul="Rollup per unit organisasi"
          deskripsi={`${formatAngka(unit.length)} unit yang punya pegawai aktif, unit dengan rerata terendah di atas. Agregasi dikerjakan SQL.`}
        />
      </div>
      {/* `max-h` dipertahankan untuk layar sempit — di sana barisnya tidak
          dipatok grid, jadi tabel 21 unit akan memanjangkan halaman. Di `xl`
          patokannya dari baris grid, jadi `max-h` dilepas supaya tidak ada dua
          batas yang bersaing. */}
      <div className="min-h-0 max-h-[28rem] flex-1 overflow-auto xl:max-h-none">
        <table className="w-full border-collapse text-[13px]">
          <thead className="sticky top-0 z-10 bg-surface-2">
            <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-text-subtle uppercase">
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2 text-right">Pegawai</th>
              <th className="px-3 py-2 text-right">Rerata</th>
              <th className="px-3 py-2">Tingkat</th>
            </tr>
          </thead>
          <tbody>
            {unit.map((u) => (
              <tr key={u.unitId} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2">
                  <Link
                    href={`/talenta?unit=${u.unitId}`}
                    className="block max-w-[20rem] truncate text-text hover:text-accent hover:underline"
                    title={u.namaUnit}
                  >
                    {u.namaUnit}
                  </Link>
                  {u.jumlahKurang > 0 ? (
                    <span className="text-[11px] text-warning">
                      {formatAngka(u.jumlahKurang)} pegawai berskor &lt;70%
                    </span>
                  ) : null}
                </td>
                <td className="tabular px-3 py-2 text-right text-text-muted">
                  {formatAngka(u.jumlahPegawai)}
                </td>
                <td className="tabular px-3 py-2 text-right font-medium text-text">
                  {formatPersenNilai(u.rerataSkor)}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    tone={
                      u.tingkat === 'LENGKAP'
                        ? 'sukses'
                        : u.tingkat === 'CUKUP'
                          ? 'aksen'
                          : 'peringatan'
                    }
                  >
                    {LABEL_TINGKAT[u.tingkat]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}

async function IsiPegawai() {
  const daftar = await ambilPegawaiKelengkapanTerendah(undefined, 15)

  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <PanelHeader
          judul="Pegawai dengan kelengkapan terendah"
          deskripsi="Daftar kerja — 15 teratas. Buka profilnya untuk melihat butir mana yang bolong beserta akibatnya ke penilaian."
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead className="bg-surface-2">
            <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-text-subtle uppercase">
              <th className="px-3 py-2">NIP &amp; Nama</th>
              <th className="px-3 py-2">Unit Organisasi</th>
              <th className="px-3 py-2 text-right">Skor</th>
              <th className="px-3 py-2">Tingkat</th>
            </tr>
          </thead>
          <tbody>
            {daftar.map((p) => (
              <tr key={p.pegawaiId} className="border-b border-border last:border-b-0">
                <td className="px-3 py-2">
                  <Link
                    href={`/talenta/${p.nip}`}
                    className="block font-medium text-text hover:text-accent hover:underline"
                  >
                    {p.nama}
                  </Link>
                  <span className="tabular block text-[11px] text-text-subtle">
                    {formatNip(p.nip)}
                  </span>
                </td>
                <td className="px-3 py-2 text-text-muted">{p.namaUnit ?? '—'}</td>
                <td className="tabular px-3 py-2 text-right font-medium text-text">
                  {formatPersenNilai(p.skor)}
                </td>
                <td className="px-3 py-2">
                  <Badge
                    tone={
                      p.tingkat === 'LENGKAP'
                        ? 'sukses'
                        : p.tingkat === 'CUKUP'
                          ? 'aksen'
                          : 'peringatan'
                    }
                  >
                    {LABEL_TINGKAT[p.tingkat]}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="border-t border-border px-3.5 py-3 text-[11px] leading-relaxed text-text-subtle">
        Satu perbedaan tafsir yang perlu diketahui: pemeriksaan &quot;NIP valid&quot; di halaman ini
        hanya memeriksa <strong className="font-medium text-text-muted">bentuknya</strong> (18 digit
        angka), sedangkan badge di halaman profil memakai pemeriksaan penuh — termasuk tanggal lahir
        yang masuk akal dan TMT CPNS tidak di masa depan. Untuk NIP yang bentuknya benar tapi isinya
        tidak masuk akal, skor di sini bisa sedikit lebih tinggi.
      </p>
    </Panel>
  )
}

function RingkasSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Panel key={i}>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-2 h-7 w-20" />
          <Skeleton className="mt-2 h-3 w-full" />
        </Panel>
      ))}
    </div>
  )
}

function TabelSkeleton({
  judul,
  baris,
  className,
}: {
  judul: string
  baris: number
  className?: string
}) {
  return (
    <Panel padat className={className}>
      <div className="border-b border-border px-3.5 py-3">
        <Skeleton className={`h-4 ${judul}`} />
        <Skeleton className="mt-2 h-3 w-full max-w-md" />
      </div>
      <TableSkeleton rows={baris} cols={['2.4fr', '0.6fr', '0.8fr', '0.7fr']} />
    </Panel>
  )
}
