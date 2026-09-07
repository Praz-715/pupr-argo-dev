import { X } from 'lucide-react'
import Link from 'next/link'

import { TabelPegawaiKotak9 } from '@/app/(app)/_komponen/tabel-pegawai-kotak9'
import { Kotak9Grid } from '@/components/charts/kotak9-grid'
import { Badge } from '@/components/ui/badge'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { Kotak9Skeleton, ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatAngka } from '@/lib/format'
import {
  ambilAnggotaKotak,
  ambilSebaranKotak9,
  UKURAN_HALAMAN_KOTAK,
} from '@/lib/kueri/dashboard'
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
      {/*
        Pemberitahuan "Daftar nama pegawai Kotak N sudah tersedia di bawah"
        DILEPAS atas permintaan pemilik proses (24 Agu 2026: *"ilangin pop up ini di
        dashboard ilangin aja"*).

        Yang perlu diketahui kalau nanti ada yang berpikir mengembalikannya:
        pemberitahuan ini ada untuk menjelaskan bahwa hasil klik muncul di panel LAIN
        di bawah grid, bukan di tempat yang diklik. Fungsi itu tidak hilang — panel
        drill-down membawa judulnya sendiri ("Pegawai di Kotak N · M orang") beserta
        tombol tutup, dan grid menandai sel yang sedang aktif dengan ring aksen
        (dijaga langkah smoke `drill-down: sel terpilih ditandai`). Jadi keadaannya
        tetap terbaca, hanya tanpa pita yang muncul lalu memudar.

        JANGAN dikembalikan sebagai "perbaikan" — ini keputusan user, sekelas dengan
        pita populasi, lima widget dashboard, dan paragraf keterangan warna Kotak 9.
      */}

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
export async function AnggotaKotak({
  kotak,
  halaman = 1,
  urut,
  arah,
}: {
  kotak: number
  halaman?: number
  urut?: string | null
  arah?: 'asc' | 'desc' | null
}) {
  const { daftar, total } = await ambilAnggotaKotak(kotak, halaman, urut, arah)
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
        /*
          Tabel yang SAMA dengan drill-down Peta Talenta (24 Agu 2026, permintaan
          pemilik proses). Sebelumnya di sini ada `<table>` HTML mentah dengan
          kolom sendiri — Nama & NIP digabung satu sel, Jabatan & Unit ditumpuk,
          tanpa Eselon, tanpa Nilai Talenta, tanpa paginasi, tanpa pemilih kolom.
          Kolomnya mustahil tetap sama dengan dua tabel lain kalau ditulis
          terpisah, dan memang sudah berbeda.

          Paginasinya memakai `halKotak`, bukan `hal`: URL dashboard sudah membawa
          `?kotak=` dan bisa membawa param tabel lain nanti.
        */
        <TabelPegawaiKotak9
          id="anggota-kotak9-dashboard"
          daftar={daftar}
          total={total}
          halaman={halaman}
          ukuranHalaman={UKURAN_HALAMAN_KOTAK}
          paramHalaman="halKotak"
          paramUrut="urutKotak"
          paramArah="arahKotak"
        />
      )}
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
