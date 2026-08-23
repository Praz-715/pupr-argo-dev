import Link from 'next/link'

import { cn } from '@/lib/cn'
import { TINT_KOTAK_9, warnaKotak9 } from '@/lib/warna-seri'
import { formatAngka, formatPersenNilai } from '@/lib/format'
import {
  BARIS_KOTAK_9,
  DESKRIPSI_KOTAK_9,
  KOLOM_KOTAK_9,
  MATRIKS_KOTAK_9,
  type Kotak9,
} from '@/lib/scoring'

/**
 * Grid 9 Kotak Manajemen Talenta ASN — CSS Grid, bukan library chart.
 * Sembilan sel tidak butuh library; ditulis sendiri hasilnya lebih tajam,
 * ikut design token, dan bisa dirender di server (phase.md §5).
 *
 * Label baris ikut jadi kolom keempat DI DALAM grid yang sama, bukan kolom
 * terpisah di sebelahnya — kalau dipisah, tinggi label tidak akan pernah
 * sejajar dengan tinggi sel karena keduanya dihitung terhadap wadah berbeda.
 *
 * **Warna sel membawa DUA informasi sekaligus, dan keduanya harus tetap terbaca:**
 * HUE = band kualitas kotak (merah kiri-bawah → hijau tua kanan-atas, konvensi
 * 9-box yang diporting dari v1), PEKATNYA = jumlah pegawai **relatif terhadap
 * sel terpadat**, bukan skala absolut. Baris atas grid selalu berat karena
 * predikat "Baik" sudah bernilai 80 dan ambang "Di Atas Ekspektasi" adalah >=80
 * inklusif (phase.md §3 K-2); dengan skala absolut, delapan sel lain akan tampak
 * kosong seragam.
 *
 * Karena warna memuat dua hal, kedua panel pemakainya WAJIB menjelaskan
 * keduanya — kalau tidak, hue-nya jadi informasi tanpa keterangan. Warna band
 * & plafon tint-nya ada di `lib/warna-seri.ts` + token `--k9-*`.
 */

// Urutan baris & kolom diambil dari lib/scoring — bukan didaftar ulang di sini,
// supaya susunan grid tidak bisa berselisih dengan matriks yang dipakai rumus.
const BARIS = BARIS_KOTAK_9
const KOLOM = KOLOM_KOTAK_9

export function Kotak9Grid({
  perKotak,
  total,
  kotakAktif,
  hrefSel = (kotak) => `/?kotak=${kotak}`,
  gulirKeSel = false,
  labelX = 'Potensial',
  isiTinggi = false,
}: {
  perKotak: Map<Kotak9, number>
  total: number
  /** Sel yang sedang dipilih untuk drill-down. */
  kotakAktif?: number | null
  /**
   * Tujuan tautan tiap sel. Bawaannya drill-down dashboard; halaman Peta Talenta
   * mengirim versi yang **mempertahankan filter aktif**, karena membuka sel tanpa
   * membawa filternya akan menampilkan daftar yang tidak cocok dengan angka di
   * sel yang baru saja diklik.
   */
  hrefSel?: (kotak: Kotak9) => string
  /**
   * Izinkan halaman menggulir ke tujuan tautan. Wajib `true` kalau hasil
   * drill-down muncul di luar layar: tanpa itu, mengklik sel tidak menggerakkan
   * apa pun dan terasa seperti tombol mati (phase.md §5.2). Di dashboard hasilnya
   * tampil di panel yang sama, jadi bawaannya tidak menggulir.
   */
  gulirKeSel?: boolean
  /**
   * Nama sumbu X pada `aria-label` & `title` tiap sel. Sejak Fase 11 sumbu itu
   * punya dua definisi (phase.md §2.10), dan label yang tetap berbunyi
   * "Potensial" pada kedua tampilan menyesatkan justru **pengguna pembaca layar**
   * — satu-satunya yang tidak bisa melihat judul panel di atas grid untuk
   * mengoreksinya sendiri.
   */
  labelX?: string
  /**
   * `true` = grid MENGISI tinggi wadahnya, `false` = tiap sel memakai rasio 4:3
   * dan tingginya yang menentukan tinggi panel.
   *
   * Dua mode ini bukan preferensi. Di dashboard, grid ini berdampingan dengan
   * panel lain di satu baris, dan sel ber-rasio-tetap membuat panelnya jauh
   * lebih tinggi daripada pasangannya — barisnya jadi timpang. Di halaman Peta
   * Talenta ia berdiri sendiri tanpa tinggi yang mengikat, dan di sana rasio
   * tetaplah yang benar: tanpa itu, sel ikut memanjang mengikuti isi halaman.
   */
  isiTinggi?: boolean
}) {
  const maksimum = Math.max(1, ...[...perKotak.values()])

  return (
    <div className={cn('flex gap-2', isiTinggi && 'h-full min-h-0')}>
      {/* Label sumbu Y, di luar grid supaya tidak ikut menyempitkan sel */}
      <div
        aria-hidden
        className="flex w-4 shrink-0 items-center justify-center"
        title="Sumbu Y — Nilai Kinerja"
      >
        <span className="rotate-180 text-[10px] font-medium tracking-wider text-text-subtle uppercase [writing-mode:vertical-rl]">
          Kinerja
        </span>
      </div>

      <div
        className={cn(
          'grid min-w-0 flex-1 grid-cols-[repeat(3,minmax(0,1fr))_5.5rem] gap-1.5',
          // `minmax(0,1fr)` bukan `1fr`: tanpa batas bawah nol, isi sel menolak
          // menyusut dan gridnya meluber.
          //
          // SEL DIBUAT KOTAK (permintaan user, 18 Agu 2026: "malah persegi
          // panjang"). Sebelumnya baris grid meregang mengisi tinggi panel
          // (`grid-rows-[repeat(3,minmax(0,1fr))]` + `h-full`), sehingga tinggi sel
          // terpaku ~160px sementara lebarnya ikut lebar jendela — terukur, bentuk
          // selnya berayun **0,76 di 1366px → 1,26 di 1920px**. Sembilan sel yang
          // berubah bentuk mengikuti lebar jendela tidak terbaca sebagai grid kotak.
          //
          // Sekarang arahnya dibalik: LEBAR menentukan tinggi lewat `aspect-square`
          // di selnya, jadi tinggi baris lahir dari isinya dan `h-full`/`grid-rows`
          // justru harus DILEPAS — keduanya akan mematok tinggi baris lagi dan
          // membatalkan rasionya.
          //
          // `max-w` memplafon ukuran selnya, dan itu wajib: tanpa plafon, di panel
          // lebar sel ikut membesar sampai 3× tingginya melewati tinggi panel yang
          // dipatok 39rem — terukur ~647px terpakai dari 533px tersedia di 1920px.
          // 36,5rem menjaga sel ≤159px, jadi 3 baris + label = 521px, masih di dalam
          // 533px. Sisa lebar jatuh sebagai margin (`mx-auto`), bukan luberan.
          //
          // Arah sebaliknya sudah dicoba dan GAGAL: kolom `auto` dengan lebar
          // mengikuti tinggi baris membuat total 586px sementara gridnya 559px,
          // dan label baris tercetak DI ATAS sel kolom ketiga. Jangan diulang.
          // `content-start` WAJIB, dan ini yang paling mudah terlewat. Grid ini
          // `flex-1` di dalam wadah `h-full`, jadi tingginya definit (533px)
          // sementara barisnya sekarang `auto`. Dengan `align-content` berperilaku
          // *stretch*, sisa ruang DIBAGI RATA ke kelima baris — terukur ~22px per
          // baris, sehingga pembungkus baris jadi 144px padahal selnya 122px, dan
          // jarak antar baris terlihat 28px sementara antar kolom 6px. Selnya
          // sendiri tetap kotak; yang timpang justru ruang di antaranya, dan itu
          // terbaca sebagai grid yang tidak rapi.
          isiTinggi && 'mx-auto w-full max-w-[36.5rem] content-start',
        )}
      >
        {BARIS.map((baris) => (
          <div
            key={baris}
            className={cn('col-span-4 grid grid-cols-subgrid gap-1.5', isiTinggi && 'min-h-0')}
          >
            {KOLOM.map((kolom) => {
              const kotak = MATRIKS_KOTAK_9[baris][kolom]
              const jumlah = perKotak.get(kotak) ?? 0
              const rasio = jumlah / maksimum
              const aktif = kotakAktif === kotak

              return (
                <Link
                  key={kolom}
                  href={hrefSel(kotak)}
                  scroll={gulirKeSel}
                  data-kotak={kotak}
                  data-jumlah={jumlah}
                  aria-label={`Kotak ${kotak}: ${jumlah} pegawai — ${baris} × ${labelX} ${kolom}`}
                  title={`Kotak ${kotak} · ${baris} × ${labelX} ${kolom}\n${DESKRIPSI_KOTAK_9[kotak]}`}
                  // Garis sel memakai warna band (bukan --border) supaya sel
                  // KOSONG pun tetap menyatakan band-nya — tanpa itu, grid yang
                  // sebagian besar nol kembali jadi kotak abu-abu seragam.
                  style={{ borderColor: aktif ? undefined : warnaKotak9(kotak) }}
                  className={cn(
                    // `translate` DISEBUT DULUAN, dan itu perbaikan bug — bukan
                    // penulisan ulang yang setara. Di Tailwind v4,
                    // `hover:-translate-y-0.5` di bawah menyetel properti CSS
                    // `translate` yang berdiri sendiri, BUKAN `transform`. Daftar
                    // lamanya cuma `[transform,box-shadow]`, jadi angkat 2px-nya
                    // melompat seketika: terukur, `translate` langsung `0px -2px`
                    // pada sampel pertama tanpa satu pun nilai di tengah.
                    // Bandingkan tombol yang sudah benar — ia meluruh
                    // 0 → 0,46 → 0,92 → 1px.
                    'relative flex flex-col justify-between overflow-hidden rounded-md border p-2 transition-[translate,box-shadow,transform]',
                    // `aspect-square`: tinggi sel lahir dari lebar kolomnya, jadi
                    // selnya kotak di lebar jendela mana pun. TANPA `h-full` —
                    // itu akan meregangkannya kembali mengikuti tinggi baris dan
                    // membatalkan rasionya.
                    isiTinggi ? 'aspect-square' : 'aspect-4/3',
                    aktif
                      ? 'border-accent ring-1 ring-accent'
                      : 'hover:-translate-y-0.5 hover:shadow-kartu-naik',
                    jumlah === 0 && 'pointer-events-none opacity-70',
                  )}
                >
                  {/* Latar = warna BAND (kualitas), opacity = KEPADATAN.
                      Dua informasi di satu lapisan, dan keduanya masih terbaca:
                      hue menjawab "kotak ini artinya apa", pekatnya menjawab
                      "berapa orang di sini".

                      Plafon 45% bukan angka selera — di atas 51% `--text` di sel
                      terpadat turun di bawah 4,5:1 (tema gelap yang mengikat,
                      karena di sana tint MENERANGKAN latar). Kalau mau dinaikkan,
                      jalankan `npm run audit:kontras` dulu. */}
                  <span
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      backgroundColor: warnaKotak9(kotak),
                      opacity:
                        jumlah === 0
                          ? TINT_KOTAK_9.kosong
                          : TINT_KOTAK_9.dasar + rasio * TINT_KOTAK_9.rentang,
                    }}
                  />
                  <span className="relative flex items-center justify-between gap-1">
                    {/* `text-text`, bukan `text-text-subtle`: di atas tint band
                        terpekat, muted hanya mencapai 2,7–3,2:1. Terukur. */}
                    <span className="text-[10px] font-semibold text-text">Kotak {kotak}</span>
                    {jumlah > 0 ? (
                      <span className="tabular text-[10px] text-text">
                        {formatPersenNilai((jumlah / Math.max(1, total)) * 100)}
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular relative text-2xl leading-none font-semibold text-text">
                    {formatAngka(jumlah)}
                    <span className="ml-1 text-[10px] font-normal text-text">pegawai</span>
                  </span>
                </Link>
              )
            })}

            {/* Label baris — sel keempat pada baris grid yang sama */}
            <span className="flex items-center text-[10px] leading-tight text-text-subtle">
              {baris}
            </span>
          </div>
        ))}

        {/* Label kolom + judul sumbu X */}
        {KOLOM.map((k) => (
          <span key={k} className="text-center text-[10px] text-text-subtle">
            {k}
          </span>
        ))}
        <span />
        <span className="col-span-3 text-center text-[10px] font-medium tracking-wider text-text-subtle uppercase">
          Potensial
        </span>
      </div>
    </div>
  )
}
