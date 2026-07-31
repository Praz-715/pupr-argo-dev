'use client'

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'

import { formatSkorRingkas } from '@/lib/format'
import { polaGarisSeri, warnaSeri } from '@/lib/warna-seri'

/**
 * Radar perbandingan kandidat per indikator rubrik.
 *
 * **Batasan yang menentukan kapan komponen ini boleh dipakai:** radar hanya sah
 * dalam SATU jabatan target. Bobot dan daftar indikator berbeda antar target,
 * jadi radar lintas-target menggambar sumbu yang bukan hal yang sama sambil
 * tetap terlihat bisa dibandingkan — lebih menyesatkan daripada tidak ada
 * grafik. Halaman pemanggil yang menegakkan aturan itu.
 *
 * **Identitas seri tidak boleh bergantung warna saja.** Palet 4 warna sudah
 * divalidasi untuk semua pasangan, tapi pemisahan terburuknya masih di pita 6-8
 * (deutan ΔE 6,6 di tema gelap). Karena itu tiap seri punya **pola garis
 * berbeda** (utuh, putus-putus, titik, putus-titik) + legenda + padanan tabel
 * angka di halaman yang sama.
 */



export interface SeriKandidat {
  nama: string
  /** Skor per indikator, sejajar dengan urutan `sumbu`. */
  nilai: Array<number | null>
}

export function RadarKandidat({ sumbu, seri }: { sumbu: string[]; seri: SeriKandidat[] }) {
  // Recharts butuh satu baris per sumbu, dengan kolom per kandidat.
  const data = sumbu.map((nama, i) => {
    const baris: Record<string, string | number> = { sumbu: ringkas(nama), penuh: nama }
    seri.forEach((s, j) => {
      const v = s.nilai[i]
      if (v !== null && v !== undefined) baris[`k${j}`] = v
    })
    return baris
  })

  return (
    // Lebar dibatasi: radar yang direntangkan selebar panel membuat poligonnya
    // raksasa tanpa menambah informasi, dan mendorong tabel angkanya terhimpit.
    <div className="mx-auto w-full max-w-[34rem]" style={{ aspectRatio: '1 / 1' }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="70%" margin={{ top: 8, right: 24, bottom: 8, left: 24 }}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis dataKey="sumbu" tick={{ fill: 'var(--text-subtle)', fontSize: 11 }} />
          {/* Domain dipaku 0–100: skala rubrik selalu 0–100 (phase.md §2.1), dan
              radar berdomain otomatis akan membesar-besarkan selisih kecil.
              Angka sumbu radius disembunyikan — di radar ia menumpuk di tengah
              dan sulit dibaca; angka sebenarnya dibaca di tabel sebelahnya. */}
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} tickLine={false} />
          <Tooltip content={<IsiTooltip seri={seri} />} />
          {seri.map((s, j) => (
            <Radar
              key={s.nama}
              name={s.nama}
              dataKey={`k${j}`}
              stroke={warnaSeri(j)}
              strokeWidth={2}
              strokeDasharray={polaGarisSeri(j)}
              // Tanpa isian: tiga-empat poligon berisi saling menimpa jadi massa
              // kelabu dan justru menyembunyikan garis yang mau dibandingkan.
              fill="none"
              isAnimationActive={false}
            />
          ))}
        </RadarChart>
      </ResponsiveContainer>
    </div>
  )
}

/**
 * Legenda dipisah dari chart supaya bisa diletakkan di mana pun oleh halaman,
 * dan supaya polanya (bukan cuma warnanya) ikut ditampilkan.
 */
export function LegendaKandidat({ nama }: { nama: string[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {nama.map((n, j) => (
        <li key={n} className="flex items-center gap-1.5 text-[11px] text-text-muted">
          <svg aria-hidden width="22" height="8" viewBox="0 0 22 8" className="shrink-0">
            <line
              x1="1"
              y1="4"
              x2="21"
              y2="4"
              stroke={warnaSeri(j)}
              strokeWidth="2"
              strokeDasharray={polaGarisSeri(j)}
            />
          </svg>
          {n}
        </li>
      ))}
    </ul>
  )
}

/**
 * Nama sumbu dipendekkan supaya label radar tidak saling tumpang.
 *
 * Pemendekan **manual per nama**, bukan potong-di-karakter-ke-17: memotong
 * mentah menghasilkan "Penilaian Potensi…" dan "Verifikasi Rekam …" yang justru
 * membuang bagian yang membedakannya. Nama penuh tetap ada di tooltip & tabel.
 */
function ringkas(nama: string): string {
  const peta: Record<string, string> = {
    'Penilaian Potensi dan Kompetensi': 'Potkom',
    'Potensi dan Kompetensi': 'Potkom',
    'Tingkat Pendidikan Formal': 'Pendidikan',
    'Kesesuaian Bidang Ilmu': 'Bidang Ilmu',
    'Pengembangan Kompetensi': 'Diklat',
    'Nilai Pengalaman Jabatan': 'Pengalaman',
    'Verifikasi Rekam Jejak Disiplin': 'Integritas',
    'Integritas dan Moralitas': 'Integritas',
  }
  if (peta[nama]) return peta[nama]
  // Fallback: ambil kata terakhir yang bermakna daripada memotong di tengah.
  if (nama.length <= 16) return nama
  const kata = nama.split(' ')
  return kata.length > 2 ? kata.slice(-2).join(' ') : nama.slice(0, 15)
}

function IsiTooltip({
  active,
  payload,
  seri,
}: {
  active?: boolean
  payload?: Array<{ payload: Record<string, string | number> }>
  seri?: SeriKandidat[]
}) {
  const baris = payload?.[0]?.payload
  if (!active || !baris || !seri) return null

  return (
    <div className="max-w-[15rem] rounded-md border border-border bg-surface p-2.5 text-xs shadow-[var(--shadow-overlay)]">
      <p className="font-semibold text-text">{String(baris.penuh)}</p>
      <ul className="mt-1.5 space-y-0.5">
        {seri.map((s, j) => {
          const v = baris[`k${j}`]
          return (
            <li key={s.nama} className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1.5 text-text-muted">
                <svg aria-hidden width="14" height="6" viewBox="0 0 14 6">
                  <line
                    x1="0"
                    y1="3"
                    x2="14"
                    y2="3"
                    stroke={warnaSeri(j)}
                    strokeWidth="2"
                    strokeDasharray={polaGarisSeri(j)}
                  />
                </svg>
                {s.nama}
              </span>
              <span className="tabular font-medium text-text">
                {typeof v === 'number' ? formatSkorRingkas(v) : '—'}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
