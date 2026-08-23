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
 * Tinggi kartu SERAGAM (`h-40` + label diklem 2 baris) karena kelimanya berdiri
 * berdampingan: label yang panjangnya berbeda membuat baris konteks tiap kartu
 * berhenti di ketinggian berbeda, dan mata membacanya sebagai empat kartu yang
 * tidak sejajar. Hint tetap menyisakan tingginya walau kosong — alasan yang
 * sama dengan `min-height: 1.4em` di v1.
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
        'relative flex h-40 flex-col overflow-hidden rounded-lg border border-border bg-surface py-4 pr-4 pl-5 shadow-kartu',
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

      {/* line-clamp-2 + flex-1: label memakai maksimal dua baris lalu mendorong
          hint ke dasar kartu, jadi baris hint keempat kartu selalu sejajar. */}
      <div className="mt-2.5 flex flex-1 items-start gap-1.5">
        <span className="line-clamp-2 text-[13px] leading-snug font-semibold text-text">
          {label}
        </span>
      </div>

      <div className="mt-2 min-h-[2.4em] border-t border-dashed border-border pt-2">
        <p className="text-[11px] leading-relaxed text-text-subtle">{konteks}</p>
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
    <Link href={tautan.href} className="group block focus-visible:outline-offset-4">
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
        // h-40 menyamai tinggi kartu jadinya — tanpa itu kartunya melompat
        // tingginya begitu data masuk (phase.md §5.3: skeleton meniru bentuk akhir).
        <CardSkeleton key={i} className="h-40" />
      ))}
    </div>
  )
}
