import {
  ArrowDown,
  ArrowRight,
  BadgeCheck,
  Briefcase,
  FileCheck2,
  Target,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { CardSkeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/cn'
import { ambilKartuRingkas } from '@/lib/kueri/dashboard'
import { formatAngka, formatPersenNilai } from '@/lib/format'

/**
 * W1 · Lima angka yang paling sering ditanya pimpinan.
 *
 * Setiap kartu menyertakan **konteks pembanding** (mis. "6 dari 19 jabatan
 * strategis"), karena angka telanjang tanpa penyebut tidak bisa dinilai
 * besar-kecilnya. Kartu bernilai nol tetap bermakna, bukan menampilkan "0"
 * saja (phase.md §7 DoD Fase 1).
 */
export async function KartuRingkas() {
  const d = await ambilKartuRingkas()

  const persenKosong =
    d.jabatanStrategisTotal > 0
      ? (d.jabatanStrategisKosong / d.jabatanStrategisTotal) * 100
      : 0

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <Kartu
        ikon={<Users className="size-5" />}
        label="Pegawai aktif"
        nilai={d.pegawaiAktif}
        nada="biru"
        konteks={
          // "Seluruh pegawai terdata" adalah klaim tentang SELURUH organisasi, dan
          // itu tidak lagi benar begitu tampilan disaring (10 dari 43). Kalimatnya
          // dibatasi ke apa yang benar-benar dihitung kartu ini.
          d.pegawaiAktif === d.pegawaiTotal
            ? 'Semua yang dihitung di sini berstatus aktif'
            : `dari ${formatAngka(d.pegawaiTotal)} pegawai terdata`
        }
        tautan={{ href: '/talenta', label: 'Buka Direktori Pegawai' }}
      />

      <Kartu
        ikon={<Briefcase className="size-5" />}
        label="Jabatan strategis kosong"
        nilai={d.jabatanStrategisKosong}
        nada={d.jabatanStrategisKosong > 0 ? 'amber' : 'hijau'}
        konteks={
          d.jabatanStrategisKosong === 0
            ? 'Semua jabatan eselon I–III terisi'
            : `${formatPersenNilai(persenKosong)} dari ${formatAngka(d.jabatanStrategisTotal)} jabatan eselon I–III`
        }
        // `/jabatan-target#jabatan-kosong`, BUKAN `#jabatan-kosong`: panelnya
        // sudah tidak ada di dashboard sejak digantikan Peta Kinerja × Potensial.
        tautan={{ href: '/jabatan-target#jabatan-kosong', label: 'Lihat daftar' }}
      />

      <Kartu
        ikon={<Target className="size-5" />}
        label="Kandidat dalam talent pool"
        nilai={d.kandidatPool}
        nada="teal"
        konteks={
          d.jabatanTargetAktif === 0
            ? 'Belum ada jabatan target aktif'
            : `tersebar di ${formatAngka(d.jabatanTargetAktif)} jabatan target aktif`
        }
        // Kartu ini sempat jadi satu-satunya dari empat yang TIDAK bisa diklik —
        // sisa dari pemangkasan dashboard, yang melepas widget Antrian Nominasi
        // dan bersamanya anchor yang dulu ditunjuk kartu-kartu ini. Kartu yang
        // terangkat saat hover tapi tidak menuju ke mana pun terbaca sebagai
        // tautan rusak, bukan sebagai kartu yang memang bukan tautan.
        tautan={{ href: '/talent-pool', label: 'Buka Talent Pool' }}
      />

      <Kartu
        ikon={<FileCheck2 className="size-5" />}
        // Dinamai "Daftar nominasi" (permintaan user, 12 Agu 2026), jadi ANGKANYA
        // ikut berubah: yang dipajang sekarang seluruh nominasi tercatat, bukan
        // subset yang menunggu tindakan. Kartu yang menaut ke daftar penuh sambil
        // memajang angka sebagian membuat pembaca menghitung selisih yang tidak
        // pernah dijelaskan. Yang menunggu tindakan turun ke baris konteks supaya
        // informasinya tidak hilang.
        label="Daftar nominasi"
        nilai={d.nominasiTotal}
        nada={d.nominasiMenunggu > 0 ? 'violet' : 'slate'}
        konteks={
          d.nominasiMenunggu === 0
            ? 'Tidak ada yang menunggu tindakan — antrian bersih'
            : `${formatAngka(d.nominasiMenunggu)} menunggu tindakan`
        }
        // `/nominasi`, BUKAN `#antrian-nominasi`. Widget Antrian Nominasi
        // dilepas dari dashboard, jadi anchornya sudah tidak ada di halaman ini
        // dan tautannya akan jadi klik mati yang tidak menggerakkan apa pun
        // (phase.md §5.2) — gejala yang terbaca sebagai "tautannya rusak".
        tautan={{ href: '/nominasi', label: 'Buka Nominasi & Approval' }}
      />

      <Kartu
        ikon={<BadgeCheck className="size-5" />}
        /*
          Butir 2 PUR.pdf, ditahan sampai istilahnya jelas.

          Alasan aslinya — "biar tidak digabung dengan tab nominasi menunggu
          tindakan" — dijawab dengan memisahkan TAHAPnya: kartu sebelah memajang
          seluruh nominasi dengan "menunggu tindakan" sebagai konteks, kartu ini
          memajang yang sudah LEWAT verifikasi. Keduanya dihitung dari tabel
          `nominasi` yang sama, jadi angkanya bisa dijumlahkan tanpa selisih yang
          tak terjelaskan — dua kartu bertetangga yang menghitung dari tabel
          berbeda adalah cara termudah membuat pembaca menyimpulkan selisih yang
          sebenarnya tidak ada.

          Konteksnya memecah angkanya lagi jadi "sudah ditetapkan" vs "menunggu
          Pimpinan", sebab "terverifikasi" sendirian tidak menjawab apakah masih
          ada yang perlu ditindak — dan itu justru pertanyaan yang dibawa
          pimpinan ke dashboard ini.
        */
        label="Terverifikasi"
        nilai={d.nominasiTerverifikasi}
        nada={d.nominasiTerverifikasi > d.nominasiDitetapkan ? 'violet' : 'teal'}
        konteks={
          d.nominasiTerverifikasi === 0
            ? 'Belum ada nominasi yang lolos verifikasi'
            : d.nominasiTerverifikasi === d.nominasiDitetapkan
              ? 'seluruhnya sudah ditetapkan Pimpinan'
              : `${formatAngka(d.nominasiDitetapkan)} ditetapkan · ${formatAngka(
                  d.nominasiTerverifikasi - d.nominasiDitetapkan,
                )} menunggu Pimpinan`
        }
        tautan={{ href: '/nominasi?tahap=APPROVAL', label: 'Lihat yang menunggu approval' }}
      />
    </div>
  )
}

/**
 * Nada warna kartu — palet KATEGORIKAL, bukan status. "amber" di sini tidak
 * berarti waspada dan "hijau" tidak berarti aman; nada dipilih supaya empat
 * angka yang berdampingan bisa dibedakan sekilas. Karena itu makna angkanya
 * tetap dijelaskan lewat teks konteks, tidak lewat warnanya.
 *
 * Nilainya didefinisikan di `globals.css` (`.nada-*`) supaya tiap nada punya
 * pasangan tema gelap — versi v1 memakai `style` inline dan karena itu tidak
 * bisa punya pasangan gelap sama sekali.
 */
const KELAS_NADA = {
  biru: 'nada-biru',
  hijau: 'nada-hijau',
  amber: 'nada-amber',
  merah: 'nada-merah',
  violet: 'nada-violet',
  teal: 'nada-teal',
  slate: 'nada-slate',
} as const

type Nada = keyof typeof KELAS_NADA

/**
 * Bentuk kartunya diporting dari v1 `StatCard`: bar warna di tepi kiri, angka
 * besar + chip ikon sebaris, label, lalu baris hint di bawah garis putus-putus.
 *
 * Tinggi kartu SERAGAM, tapi lewat **grid**, bukan lewat `h-40` yang dipatok.
 *
 * ## Kenapa patokan tingginya dilepas (24 Agu 2026)
 *
 * Versi sebelumnya `h-40` (160px) + `overflow-hidden`. Itu bekerja selama grid
 * KPI-nya 4 kolom: baris konteks muat satu baris. Begitu kartunya jadi LIMA
 * (butir 2 `PUR.pdf`), tiap kartu menyempit, konteksnya membungkus jadi dua baris
 * — mis. "70,8% dari 89 jabatan eselon I–III" — dan isinya melewati 160px. Karena
 * `overflow-hidden`, yang terjadi bukan kartu memanjang melainkan **baris terakhir
 * terpotong**: tautan "Buka Direktori Pegawai" & "Buka Nominasi & Approval"
 * terpangkas separuh. Dilaporkan pemilik proses lewat tangkapan layar.
 *
 * Patokan itu ternyata **tidak pernah dibutuhkan**: CSS Grid sudah membuat seluruh
 * item satu baris setinggi item tertinggi (`align-items: stretch` bawaannya), dan
 * `flex-1` pada blok label sudah mendorong hint ke dasar kartu. Jadi kesejajaran
 * yang jadi alasan `h-40` didapat gratis — yang ditambahkan `h-40` cuma plafon yang
 * memotong.
 *
 * Sekarang `h-full min-h-40`: `h-full` mengisi tinggi yang sudah disamakan grid
 * (grid item-nya `<Link>`, jadi tanpa `h-full` kartunya berhenti di tinggi isinya
 * sendiri dan yang tersamakan hanya pembungkusnya), `min-h-40` mempertahankan
 * proporsi kartu saat isinya pendek. **Jangan mengembalikan tinggi tetap** — teks
 * konteks lahir dari data (persentase, jumlah, nama tahap) dan panjangnya berubah
 * bersama datanya, jadi angka tetap apa pun akan terpotong lagi suatu hari.
 */
function Kartu({
  ikon,
  label,
  nilai,
  konteks,
  nada = 'biru',
  tautan,
}: {
  ikon: ReactNode
  label: string
  nilai: number
  konteks: string
  nada?: Nada
  tautan?: { href: string; label: string }
}) {
  const isi = (
    <div
      className={cn(
        KELAS_NADA[nada],
        'relative flex h-full min-h-40 flex-col overflow-hidden rounded-lg border border-border bg-surface py-4 pr-4 pl-5 shadow-kartu',
        // Angkat hanya kalau kartunya benar-benar bisa diklik.
        tautan ? 'kartu-naik' : '',
      )}
    >
      <span aria-hidden className="sc-bar absolute inset-y-0 left-0 w-1.5" />

      <div className="flex items-start justify-between gap-3">
        <p className="sc-fg tabular text-[2.125rem] leading-none font-bold">
          {formatAngka(nilai)}
        </p>
        <span
          aria-hidden
          className="sc-chip flex size-11 shrink-0 items-center justify-center rounded-xl border"
        >
          {ikon}
        </span>
      </div>

      {/*
        Isi kartu dirata ATAS, bukan blok konteks yang ditambatkan ke bawah
        (permintaan user 24 Agu 2026: *"penjelasan di atas tautan gak rapih,
        ratainnya keatas aja"*).

        Versi sebelumnya memberi `flex-1` pada blok LABEL, yang mendorong blok
        konteks ke dasar kartu. Selama semua kartu punya konteks sepanjang sama itu
        terlihat rapi; begitu panjangnya berbeda — "Semua yang dihitung di sini
        berstatus aktif" dua baris vs "tersebar di 4 jabatan target aktif" satu
        baris — blok yang lebih tinggi tumbuh KE ATAS, sehingga garis putus-putus
        dan awal teks konteks tiap kartu berhenti di ketinggian berbeda. Yang
        terbaca: lima kartu yang tidak sejajar.

        Sekarang tidak ada `flex-1` di mana pun, jadi isinya mengalir dari atas dan
        sisa ruang jatuh ke bawah. Supaya baris tautan tetap sejajar juga, LABEL dan
        KONTEKS masing-masing mencadangkan tinggi dua baris (`min-h-*`): teks yang
        hanya satu baris menyisakan baris kedua kosong alih-alih menggeser apa pun
        di bawahnya. Ruang kosong itu harga kesejajaran, dan itu pilihan yang
        disengaja — kartu KPI dibaca dengan disapu mata, bukan dibaca satu-satu.

        Angka `min-h`-nya **kelipatan tinggi baris, bukan taksiran**: label memakai
        `leading-snug` (1,375) → dua baris = `2.75em`, konteks memakai
        `leading-relaxed` (1,625) → dua baris = `3.25em`. Percobaan pertama memakai
        `2.6em`/`2.9em` yang dikira "cukup"; terukur, keduanya lebih PENDEK dari dua
        baris sesungguhnya, jadi kartu yang teksnya benar-benar dua baris menggeser
        isinya 2–4px dan kesejajarannya gagal justru pada lebar tempat teks mulai
        membungkus (1280 & 1366px). Kalau `leading-*` di sini diubah, kedua angka ini
        ikut diubah.
      */}
      <div className="mt-2.5 flex items-start gap-1.5">
        {/*
          `min-h`, TANPA `line-clamp`: label yang kebetulan tiga baris dulu terpotong
          diam-diam di baris kedua (permintaan pemilik proses 26 Agu 2026 — jangan ada
          teks yang terpotong). Kesejajaran yang jadi alasan clamp itu tidak hilang:
          `min-h` tetap mencadangkan dua baris, dan CSS Grid sudah menyamakan tinggi
          seluruh kartu pada barisnya, jadi kartu yang labelnya lebih panjang
          meninggikan barisnya alih-alih menyembunyikan kata.
        */}
        <span className="min-h-[2.75em] text-[13px] leading-snug font-semibold break-words text-text">
          {label}
        </span>
      </div>

      <div className="mt-2 border-t border-dashed border-border pt-2">
        <p className="min-h-[3.25em] text-[11px] leading-relaxed text-text-subtle">{konteks}</p>
        {tautan ? (
          <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-accent group-hover:underline">
            {tautan.label}
            {tautan.href.startsWith('#') ? (
              <ArrowDown className="size-3" />
            ) : (
              <ArrowRight className="size-3" />
            )}
          </span>
        ) : null}
      </div>
    </div>
  )

  // Seluruh kartu jadi target klik, bukan cuma tautan kecil di dasarnya —
  // kartu yang terangkat saat hover tapi hanya bisa diklik di satu baris teks
  // adalah cara tercepat membuat orang mengira tautannya rusak.
  return tautan ? (
    // `h-full` supaya grid item ini benar-benar diregangkan ke tinggi baris, dan
    // kartu di dalamnya (`h-full`) ikut mengisinya. Tanpa itu `<Link>` setinggi
    // isinya sendiri dan kartu-kartu jadi tidak sejajar lagi.
    <Link href={tautan.href} className="group block h-full focus-visible:outline-offset-4">
      {isi}
    </Link>
  ) : (
    isi
  )
}

export function KartuRingkasSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      {/* LIMA, sejumlah kartu jadinya. Skeleton yang jumlahnya beda dari isi
          akhirnya membuat barisnya melompat justru pada momen yang seharusnya
          ia tenangkan. */}
      {Array.from({ length: 5 }).map((_, i) => (
        /*
          `h-52` (208px) — skeleton meniru bentuk AKHIR (phase.md §5.3). Kartu jadinya
          TERUKUR **201px pada 1440–1920px dan 215px pada 1280–1366px** (di lebar
          sempit teks konteks membungkus), jadi 208px adalah nilai tunggal terdekat ke
          keduanya: selisihnya ±7px, cukup kecil untuk tidak terbaca sebagai lompatan.

          Tinggi kartu tidak lagi dipatok, jadi tidak ada satu angka yang cocok di
          semua lebar. Kalau jumlah kartu atau panjang teks konteksnya berubah, UKUR
          ulang kartu jadinya lalu setel angka ini — jangan menebaknya. Skeleton yang
          lebih pendek dari isi jadinya membuat baris melompat justru pada momen yang
          seharusnya ia tenangkan.
        */
        <CardSkeleton key={i} className="h-52" />
      ))}
    </div>
  )
}
