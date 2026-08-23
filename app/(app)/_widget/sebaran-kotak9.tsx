import { ArrowDown, X } from 'lucide-react'
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
  // Asesmen kedaluwarsa SENGAJA tidak disebut di sini: ia sudah punya badge
  // sendiri di kanan judul. Menyebutnya dua kali membuat pembaca mencari
  // perbedaan antara "2 kedaluwarsa" dan "2 asesmen kedaluwarsa" yang tidak ada.

  return (
    <Panel className="flex min-h-0 flex-col">
      <PanelHeader
        judul="Sebaran Kotak 9"
        // Frasa "· asesmen terbaru per orang" DIHAPUS atas permintaan user
        // (18 Agu 2026). Aturannya sendiri tidak hilang — asesmen mana yang
        // berlaku tetap ditentukan `CTE_ASESMEN_TERBARU` di `lib/kueri/dasar.ts`,
        // yang memang satu-satunya tempat aturan itu hidup.
        //
        // Satu string, BUKAN fragment `<>{angka} pegawai …</>`: bentuk fragment
        // terukur menelan spasi setelah `}` dan terender "10pegawai" — kena hari
        // ini di panel Peta, jadi jangan diulang di sini.
        deskripsi={
          `${formatAngka(d.totalDinilai)} pegawai` +
          (d.tahunTerlama && d.tahunTerbaru
            ? ` · tahun ${d.tahunTerlama}–${d.tahunTerbaru}`
            : '') +
          (dikecualikan.length > 0 ? ` · ${dikecualikan.join(', ')}` : '')
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

      {/* PEMBERITAHUAN DRILL-DOWN — memecahkan cacat yang dilaporkan user
          (18 Agu 2026): mengeklik sel memunculkan daftar nama di panel BAWAH, di
          luar layar, sehingga orang yang tidak menggulir menyimpulkan kliknya
          tidak melakukan apa-apa.

          Letaknya DI ATAS grid, bukan di bawahnya, dan itu bukan selera. Versi
          pertama menaruhnya di kaki panel dan terukur mendarat di y=958 — pada
          laptop 900px ia sendiri ada di bawah lipatan, jadi pemberitahuan yang
          mengabarkan sesuatu di luar layar ikut berada di luar layar. Di sini ia
          duduk tepat di bawah judul panel yang barusan diklik, yaitu di tempat
          mata pengguna sudah berada.

          Kenapa pemberitahuan dan bukan sekadar anchor `#anggota-kotak` di tiap
          sel: panel tujuannya dirender di dalam <Suspense> sendiri, jadi saat
          navigasi terjadi elemennya BELUM ADA di DOM dan browser tidak punya apa
          pun untuk digulir — jebakan yang sama dengan `permanentRedirect()` yang
          tersangkut di batas Suspense (CLAUDE.md §Route). Pemberitahuan ini
          dirender bersama gridnya sehingga selalu muncul; tautannya baru dipakai
          setelah manusia membacanya, dan saat itu panelnya sudah tiba.

          Ia HILANG SENDIRI setelah ~7 detik lewat `.pemberitahuan-sekejap`
          (permintaan user: "beberapa detik setelah di klik nanti ngilang").
          Animasinya CSS, bukan timer React — alasan lengkapnya di blok keyframes
          di `app/globals.css`. */}
      {kotakAktif !== null ? (
        <p
          // `key` WAJIB. Tanpa itu, mengeklik sel kedua hanya memperbarui teks
          // elemen yang sama — React tidak melepasnya, animasi CSS tidak pernah
          // mulai ulang, dan pemberitahuan yang sudah memudar tidak muncul lagi
          // meski pengguna baru saja mengeklik. `key` memaksanya dilepas & dibuat
          // ulang, dan animasinya ikut dari nol.
          key={kotakAktif}
          // role="status" supaya pembaca layar mengumumkannya saat ia masuk. Ini
          // penting justru KARENA ia hilang sendiri: pengguna yang tidak melihat
          // layar tidak punya kesempatan kedua membacanya.
          role="status"
          className="pemberitahuan-sekejap mt-3 flex items-center gap-2 rounded-md border border-accent/40 bg-accent/10 px-3 py-2 text-xs leading-snug text-text"
        >
          <ArrowDown aria-hidden className="size-4 shrink-0 text-accent" />
          <span>
            Daftar nama pegawai <strong className="font-semibold">Kotak {kotakAktif}</strong> sudah
            tersedia di bawah.{' '}
            <a href="#anggota-kotak" className="font-medium text-accent underline">
              Lihat daftarnya
            </a>
          </span>
        </p>
      ) : null}

      {/* flex-1 min-h-0: grid menyerap sisa tinggi panel, dan `min-h-0` yang
          membuatnya boleh MENYUSUT — tanpa itu flex item menolak lebih pendek
          dari isinya dan panelnya tetap memanjang. */}
      <div className="mt-4 flex-1 min-h-0">
        <Kotak9Grid
          perKotak={d.perKotak}
          total={d.totalDinilai}
          kotakAktif={kotakAktif}
          isiTinggi
        />
      </div>

      {/* Paragraf keterangan warna DIHAPUS atas permintaan user (18 Agu 2026).
          Keterangannya tidak hilang dari aplikasi: tiap sel membawa maknanya
          sendiri di `title` & `aria-label` (nomor kotak, posisinya pada kedua
          sumbu, plus `DESKRIPSI_KOTAK_9`), jadi hue-nya tetap punya penjelasan
          yang menempel pada objeknya — bukan pada paragraf di kaki panel yang
          bisa ikut terhapus lagi nanti.

          JANGAN dikembalikan sebagai "perbaikan"; ini keputusan user, sama
          seperti pita populasi dan lima widget dashboard yang dilepas. */}
    </Panel>
  )
}

/** Panel drill-down: muncul saat `?kotak=N` ada di URL. */
export async function AnggotaKotak({ kotak }: { kotak: number }) {
  const { daftar, total } = await ambilAnggotaKotak(kotak)
  const valid = kotak >= 1 && kotak <= 9

  return (
    // Tujuan tautan pemberitahuan drill-down di panel Sebaran. `Panel` memasang
    // `scroll-mt-4` sendiri begitu `id` ada, jadi tidak perlu diulang di sini.
    <Panel padat id="anggota-kotak">
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
