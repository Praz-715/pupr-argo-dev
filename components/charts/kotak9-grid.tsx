import Link from 'next/link'

import { cn } from '@/lib/cn'
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
 * Intensitas warna **relatif terhadap sel terpadat**, bukan skala absolut:
 * baris atas grid selalu berat karena predikat "Baik" sudah bernilai 80 dan
 * ambang "Di Atas Ekspektasi" adalah >=80 inklusif (phase.md §3 K-2). Dengan
 * skala absolut, delapan sel lain akan tampak kosong seragam.
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
}) {
  const maksimum = Math.max(1, ...[...perKotak.values()])

  return (
    <div className="flex gap-2">
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

      <div className="grid min-w-0 flex-1 grid-cols-[repeat(3,minmax(0,1fr))_5.5rem] gap-1.5">
        {BARIS.map((baris) => (
          <div key={baris} className="col-span-4 grid grid-cols-subgrid gap-1.5">
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
                  aria-label={`Kotak ${kotak}: ${jumlah} pegawai — ${baris} × potensial ${kolom}`}
                  title={`Kotak ${kotak} · ${baris} × Potensial ${kolom}\n${DESKRIPSI_KOTAK_9[kotak]}`}
                  className={cn(
                    'relative flex aspect-4/3 flex-col justify-between overflow-hidden rounded-md border p-2 transition-colors',
                    aktif
                      ? 'border-accent ring-1 ring-accent'
                      : 'border-border hover:border-border-strong',
                    jumlah === 0 && 'pointer-events-none opacity-60',
                  )}
                >
                  {/* Lapisan intensitas: opacity relatif terhadap sel terpadat */}
                  <span
                    aria-hidden
                    className="absolute inset-0 bg-accent"
                    style={{ opacity: jumlah === 0 ? 0.02 : 0.06 + rasio * 0.34 }}
                  />
                  <span className="relative flex items-center justify-between gap-1">
                    <span className="text-[10px] font-semibold text-text-subtle">
                      Kotak {kotak}
                    </span>
                    {jumlah > 0 ? (
                      <span className="tabular text-[10px] text-text-subtle">
                        {formatPersenNilai((jumlah / Math.max(1, total)) * 100)}
                      </span>
                    ) : null}
                  </span>
                  <span className="tabular relative text-2xl leading-none font-semibold text-text">
                    {formatAngka(jumlah)}
                    <span className="ml-1 text-[10px] font-normal text-text-subtle">pegawai</span>
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
