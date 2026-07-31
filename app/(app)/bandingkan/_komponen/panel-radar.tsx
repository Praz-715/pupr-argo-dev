import { LegendaKandidat, RadarKandidat, type SeriKandidat } from '@/components/charts/radar-kandidat'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { formatSkorRingkas } from '@/lib/format'

/**
 * Panel radar + legenda + tabel angkanya.
 *
 * Tabel di sebelah radar bukan pelengkap: phase.md §5.5 mewajibkan setiap chart
 * punya padanan tabel, dan di sini ia juga jadi **pembeda kedua** yang
 * diwajibkan hasil validasi palet — pemisahan CVD terburuk palet 4 warna berada
 * di pita 6–8, jadi identitas seri tidak boleh bergantung warna saja.
 */
export function PanelRadar({
  sumbu,
  seri,
  namaTarget,
  adaManual,
  adaReview,
}: {
  sumbu: string[]
  seri: SeriKandidat[]
  namaTarget: string
  adaManual: boolean
  adaReview: boolean
}) {
  return (
    <Panel>
      <PanelHeader
        judul="Profil indikator per kandidat"
        deskripsi={
          <>
            {sumbu.length} indikator tingkat atas pada rubrik <strong>{namaTarget}</strong> · skala
            0–100 · sub-indikator sudah teragregasi ke induknya
          </>
        }
      />

      <div className="mt-3 grid items-start gap-5 lg:grid-cols-2">
        <div>
          <RadarKandidat sumbu={sumbu} seri={seri} />
          <div className="mt-2">
            <LegendaKandidat nama={seri.map((s) => s.nama)} />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] tracking-wide text-text-subtle uppercase">
                <th className="py-1.5 pr-3 font-medium">Indikator</th>
                {seri.map((s) => (
                  <th key={s.nama} className="px-2 py-1.5 text-right font-medium">
                    <span className="block max-w-[6rem] truncate" title={s.nama}>
                      {s.nama}
                    </span>
                  </th>
                ))}
                <th className="py-1.5 pl-2 text-right font-medium">Δ</th>
              </tr>
            </thead>
            <tbody>
              {sumbu.map((nama, i) => {
                const nilai = seri.map((s) => s.nilai[i] ?? null)
                const ada = nilai.filter((v): v is number => v !== null)
                const maks = ada.length > 0 ? Math.max(...ada) : null
                const rentang = ada.length > 1 ? Math.max(...ada) - Math.min(...ada) : 0

                return (
                  <tr key={nama} className="border-b border-border last:border-b-0">
                    <td className="py-1.5 pr-3 text-text-muted">{nama}</td>
                    {nilai.map((v, j) => (
                      <td
                        key={j}
                        className={
                          v !== null && v === maks && ada.length > 1
                            ? 'tabular px-2 py-1.5 text-right font-semibold text-text'
                            : 'tabular px-2 py-1.5 text-right text-text-muted'
                        }
                      >
                        {v === null ? '—' : formatSkorRingkas(v)}
                      </td>
                    ))}
                    <td
                      className={
                        rentang >= 10
                          ? 'tabular py-1.5 pl-2 text-right font-medium text-warning'
                          : 'tabular py-1.5 pl-2 text-right text-text-subtle'
                      }
                    >
                      {rentang === 0 ? '—' : formatSkorRingkas(rentang)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {adaManual || adaReview ? (
            <p className="mt-2 text-[11px] leading-relaxed text-text-subtle">
              {adaManual
                ? 'Sebagian nilai indikator diisi manusia (bukan hasil hitung otomatis). '
                : ''}
              {adaReview
                ? 'Sebagian nilai berada di luar rentang rubrik, kosong, atau dipotong ke 0–100 sehingga perlu ditinjau. '
                : ''}
              Rinciannya ada di halaman profil masing-masing kandidat.
            </p>
          ) : null}
        </div>
      </div>
    </Panel>
  )
}
