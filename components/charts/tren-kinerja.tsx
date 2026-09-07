'use client'

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { formatAngka, formatSkor } from '@/lib/format'

const LABEL_PERIODE: Record<string, string> = {
  TW1: 'Triwulan I',
  TW2: 'Triwulan II',
  TW3: 'Triwulan III',
  TAHUNAN: 'Akhir Tahun',
}

export interface TitikTrenChart {
  periode: string
  nilaiKinerja: number
  /**
   * `null` = BELUM DIUKUR, dan itu harus tetap null sampai ke grafik.
   *
   * Pemanggil sebelumnya menambal `?? nilaiKinerja` — hasilnya dua garis identik
   * yang terbaca sebagai dua pengukuran berbeda yang saling mengonfirmasi. Sumber
   * Excel Talent Pool hanya memberi predikat kinerja; nilai perilaku tidak ada di
   * situ, jadi menggambarnya berarti mengarang.
   */
  nilaiPerilaku: number | null
  /** Jumlah pegawai di balik angka (dashboard agregat); null untuk 1 pegawai. */
  jumlahPegawai?: number | null
}

/**
 * Tren nilai kinerja & perilaku per periode SKP. Dipakai bersama oleh dashboard
 * (rata-rata seluruh pegawai) dan profil talenta (satu pegawai) — satu komponen,
 * bukan dua salinan (CLAUDE.md prinsip #1).
 *
 * Memakai `kinerja_periode.nilai_kinerja` yang granular (0–100), BUKAN
 * `asesmen_talenta.nilai_kinerja_y` yang hanya punya 5 nilai diskrit — garis
 * tren dari nilai diskrit akan tampak melompat dan menyesatkan (phase.md §3 K-1).
 *
 * Warna dari token `--chart-1`/`--chart-2` yang sudah divalidasi (bukan warna
 * status), dan garis kedua dibuat **putus-putus**: pemisahan biru–hijau bagi
 * penderita tritanopia tergolong rendah, jadi identitas seri tidak boleh
 * bergantung pada warna saja.
 */
export function TrenKinerja({
  titik,
  namaSeriKinerja = 'Nilai kinerja',
  namaSeriPerilaku = 'Nilai perilaku',
}: {
  titik: TitikTrenChart[]
  namaSeriKinerja?: string
  namaSeriPerilaku?: string
}) {
  const data = titik.map((t) => ({ ...t, label: LABEL_PERIODE[t.periode] ?? t.periode }))

  // Zoom ke rentang data + bantalan supaya perubahan beberapa poin terlihat,
  // dijaga agar tidak pernah keluar 0–100.
  // Seri perilaku hanya digambar kalau ADA yang terukur. Kalau seluruhnya null,
  // garis & legendanya dihilangkan — legenda yang menyebut seri kosong membuat
  // pembaca mencari garis yang tidak pernah ada.
  const adaPerilaku = data.some((d) => d.nilaiPerilaku !== null)
  const semua = data.flatMap((d) =>
    d.nilaiPerilaku === null ? [d.nilaiKinerja] : [d.nilaiKinerja, d.nilaiPerilaku],
  )
  const min = Math.max(0, Math.floor(Math.min(...semua) - 4))
  const maks = Math.min(100, Math.ceil(Math.max(...semua) + 4))

  return (
    <div className="w-full" style={{ aspectRatio: '16 / 9' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -8 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
            stroke="var(--border-strong)"
          />
          <YAxis
            domain={[min, maks]}
            tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
            stroke="var(--border-strong)"
            width={42}
          />
          <Tooltip content={<IsiTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            height={24}
            wrapperStyle={{ fontSize: 11, color: 'var(--text-muted)' }}
          />
          <Line
            type="monotone"
            dataKey="nilaiKinerja"
            name={namaSeriKinerja}
            stroke="var(--chart-1)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--chart-1)', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            animationDuration={200}
          />
          {adaPerilaku ? (
          <Line
            type="monotone"
            dataKey="nilaiPerilaku"
            name={namaSeriPerilaku}
            stroke="var(--chart-2)"
            strokeWidth={2}
            strokeDasharray="5 3"
            dot={{ r: 3, fill: 'var(--chart-2)', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            animationDuration={200}
          />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function IsiTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ payload: TitikTrenChart & { label: string } }>
}) {
  const titik = payload?.[0]?.payload
  if (!active || !titik) return null

  return (
    <div className="rounded-md border border-border bg-surface p-2.5 text-xs shadow-[var(--shadow-overlay)]">
      <p className="font-semibold text-text">{titik.label}</p>
      {/* Nilai memakai token teks, bukan warna seri — warna dibawa oleh titik
          kecil di sebelahnya, sesuai aturan "teks tidak pernah berwarna seri". */}
      <p className="tabular mt-1 flex items-center gap-1.5 text-text-muted">
        <span aria-hidden className="size-2 rounded-full bg-chart-1" />
        Kinerja <span className="font-medium text-text">{formatSkor(titik.nilaiKinerja)}</span>
      </p>
      {/* Perilaku yang belum diukur dikatakan APA ADANYA, bukan disembunyikan:
          barisnya yang hilang membuat pembaca mengira tooltipnya rusak. */}
      <p className="tabular flex items-center gap-1.5 text-text-muted">
        <span aria-hidden className="h-0.5 w-2 bg-chart-2" />
        Perilaku{' '}
        {titik.nilaiPerilaku === null ? (
          <span className="text-text-subtle">belum diukur</span>
        ) : (
          <span className="font-medium text-text">{formatSkor(titik.nilaiPerilaku)}</span>
        )}
      </p>
      {titik.jumlahPegawai ? (
        <p className="mt-1.5 border-t border-border pt-1.5 text-text-subtle">
          Rata-rata dari {formatAngka(titik.jumlahPegawai)} pegawai
        </p>
      ) : null}
    </div>
  )
}
