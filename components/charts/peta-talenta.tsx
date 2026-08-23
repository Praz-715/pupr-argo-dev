'use client'

import {
  CartesianGrid,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'

import { formatAngka, formatSkorRingkas } from '@/lib/format'
import { klasifikasiSumbuX, klasifikasiSumbuY, type AmbangSumbu } from '@/lib/scoring'

/**
 * Peta sebaran Kinerja (Y) × Potensial (X) sebagai **bubble**.
 *
 * Kenapa bubble dan bukan scatter berjitter (rencana awal phase.md §3 K-1):
 * sumbu Y hanya punya 5 nilai diskrit (100/80/60/40/20), jadi titik pegawai
 * bertumpuk. Jitter mengatasinya dengan MEMINDAHKAN titik ke koordinat yang
 * bukan nilainya — pada halaman keputusan pimpinan, itu berarti menampilkan
 * posisi palsu. Bubble menampilkan angka sebenarnya (ukuran = jumlah pegawai),
 * tetap terbaca dari 40 sampai 1.872 pegawai, dan agregasinya dikerjakan SQL.
 *
 * Warna diambil dari CSS variable supaya satu definisi berlaku di kedua tema.
 */

/**
 * Bentuk data yang dibutuhkan chart ini — didefinisikan **di sini**, bukan
 * diimpor dari salah satu berkas kueri. Dashboard (tanpa filter) dan halaman
 * Peta Talenta (berfilter) sama-sama memenuhi bentuk ini, jadi chart tidak
 * bergantung pada modul kueri mana pun.
 */
export interface TitikBubble {
  y: number
  x: number
  jumlah: number
  kotak: number
  contohNama: string[]
}

interface TitikChart {
  x: number
  y: number
  z: number
  kotak: number
  nama: string[]
}

/**
 * `ambang` diterima sebagai PROP, tidak diimpor dari konstanta.
 *
 * Komponen ini `'use client'`, jadi ia tidak boleh membaca `pengaturan_sistem`
 * sendiri. Sejak ambang 80/60 bisa diubah Super Admin (butir 7), garis bantu dan
 * kuadran di chart ini WAJIB memakai angka yang sama dengan yang dipakai
 * menghitung kotaknya — kalau tidak, garisnya akan digambar di 80 sementara
 * orang dikelompokkan menurut 75, dan pembaca melihat titik di sisi garis yang
 * salah tanpa penjelasan apa pun.
 */
export function PetaTalenta({ titik, ambang }: { titik: TitikBubble[]; ambang: AmbangSumbu }) {
  const data: TitikChart[] = titik.map((t) => ({
    x: t.x,
    y: t.y,
    z: t.jumlah,
    kotak: t.kotak,
    nama: t.contohNama,
  }))

  const maksJumlah = Math.max(1, ...titik.map((t) => t.jumlah))
  // Sumbu selalu memuat 0–100; kalau ada nilai lolos di luar itu, jangan dipotong
  // (pertahanan berlapis — phase.md §5.5).
  const maksX = Math.max(100, ...titik.map((t) => t.x))
  /**
   * Kalau sumbu memang melewati 100, BERI tanda angkanya.
   *
   * Sejak potkom tidak lagi diplafon, nilai potensial di atas 100 itu nyata.
   * Domain-nya sudah ikut melebar, tapi tick yang berhenti di 100 membuat titik
   * di kanan label terakhir terlihat seperti salah gambar — pembaca tidak punya
   * cara tahu bahwa sumbunya memang sampai 115. Tick tambahannya dibulatkan ke
   * atas ke kelipatan 5 supaya tidak menempel pada tick 100.
   */
  const tickX =
    maksX > 100 ? [0, 20, 40, 60, 80, 100, Math.ceil(maksX / 5) * 5] : [0, 20, 40, 60, 80, 100]

  return (
    <div className="w-full" style={{ aspectRatio: '16 / 10' }}>
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 8, right: 12, bottom: 26, left: 4 }}>
          {/* Kuadran kanan-atas = wilayah "siap untuk peran strategis" (Kotak 9) */}
          <ReferenceArea
            x1={ambang.atas}
            x2={maksX}
            y1={ambang.atas}
            y2={105}
            fill="var(--accent)"
            fillOpacity={0.05}
            stroke="none"
          />
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />

          <XAxis
            type="number"
            dataKey="x"
            name="Nilai Potensial"
            domain={[0, maksX]}
            ticks={tickX}
            tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
            stroke="var(--border-strong)"
            label={{
              value: 'Nilai Potensial (Sumbu X)',
              position: 'insideBottom',
              offset: -14,
              fill: 'var(--text-subtle)',
              fontSize: 11,
            }}
          />
          <YAxis
            type="number"
            dataKey="y"
            name="Nilai Kinerja"
            domain={[0, 105]}
            // Sumbu Y hanya punya 5 nilai yang mungkin — tampilkan tepat itu,
            // jangan tick otomatis yang mengesankan skala kontinu.
            ticks={[20, 40, 60, 80, 100]}
            tick={{ fill: 'var(--text-subtle)', fontSize: 11 }}
            stroke="var(--border-strong)"
            width={34}
          />
          <ZAxis type="number" dataKey="z" range={[70, Math.min(900, 140 + maksJumlah * 90)]} />

          <ReferenceLine
            x={ambang.tengah}
            stroke="var(--border-strong)"
            strokeDasharray="4 4"
          />
          <ReferenceLine
            x={ambang.atas}
            stroke="var(--border-strong)"
            strokeDasharray="4 4"
          />
          <ReferenceLine
            y={ambang.tengah}
            stroke="var(--border-strong)"
            strokeDasharray="4 4"
          />
          <ReferenceLine
            y={ambang.atas}
            stroke="var(--border-strong)"
            strokeDasharray="4 4"
          />

          <Tooltip content={<IsiTooltip ambang={ambang} />} />
          <Scatter
            data={data}
            fill="var(--accent)"
            fillOpacity={0.55}
            stroke="var(--accent)"
            strokeWidth={1}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  )
}

function IsiTooltip({
  active,
  payload,
  ambang,
}: {
  active?: boolean
  payload?: Array<{ payload: TitikChart }>
  /* Recharts menyalin prop apa pun yang dipasang di elemen `content` ke
     komponennya, jadi ambang bisa dititipkan lewat situ — dan harus, karena
     tooltip menyebut kategori sumbu yang wajib memakai ambang yang sama dengan
     garis bantunya. */
  ambang: AmbangSumbu
}) {
  const titik = payload?.[0]?.payload
  if (!active || !titik) return null

  return (
    <div className="max-w-[16rem] rounded-md border border-border bg-surface p-2.5 text-xs shadow-[var(--shadow-overlay)]">
      <p className="font-semibold text-text">
        Kotak {titik.kotak} · {formatAngka(titik.z)} pegawai
      </p>
      <p className="tabular mt-1 text-text-muted">
        Kinerja {formatSkorRingkas(titik.y)} ({klasifikasiSumbuY(titik.y, ambang)})
      </p>
      <p className="tabular text-text-muted">
        Potensial {formatSkorRingkas(titik.x)} ({klasifikasiSumbuX(titik.x, ambang)})
      </p>
      {titik.nama.length > 0 ? (
        <p className="mt-1.5 border-t border-border pt-1.5 leading-relaxed text-text-subtle">
          {titik.nama.join(', ')}
          {titik.z > titik.nama.length ? ` +${titik.z - titik.nama.length} lainnya` : ''}
        </p>
      ) : null}
    </div>
  )
}
