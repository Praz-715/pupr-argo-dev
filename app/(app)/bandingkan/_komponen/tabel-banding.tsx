import Link from 'next/link'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import {
  formatAngka,
  formatNip,
  formatSkor,
  formatSkorRingkas,
  formatTingkatPendidikan,
} from '@/lib/format'
import type { KandidatBanding, SkorBanding } from '@/lib/kueri/perbandingan'
import { DESKRIPSI_KOTAK_9, kategoriDariKotak9, type Kotak9 } from '@/lib/scoring'
import type { TingkatPendidikan } from '@/lib/normalisasi'
import { warnaSeri } from '@/lib/warna-seri'

/**
 * Tabel perbandingan sisi-berdampingan: **baris = atribut, kolom = kandidat**.
 *
 * Orientasi itu dipilih supaya membandingkan satu atribut antar orang cukup
 * dengan membaca satu baris — arah baca yang paling sering dipakai. Kalau kolom
 * jadi atribut, mata harus melompat antar baris untuk hal yang sama.
 *
 * Tiga aturan yang ditegakkan di sini:
 *
 * - **K-4:** Kotak 9 + predikat kinerja tampil berdampingan dengan match score,
 *   karena Formula B (65/20/15) tidak memuat unsur kinerja sama sekali. Ranking
 *   berdasarkan match score tanpa konteks kinerja tidak boleh disajikan sendiri.
 * - **K-3:** predikat kinerja & kategori sumbu tidak pernah digabung satu baris.
 * - **Selisih terbesar ditandai**, bukan dibiarkan dicari sendiri — itu yang
 *   biasanya jadi alasan keputusan.
 */

interface BarisNilai {
  label: string
  /** Keterangan kecil di bawah label (skala, bobot, sumber). */
  keterangan?: string
  /** Nilai numerik per kandidat; null = tidak ada data. */
  nilai: Array<number | null>
  /** Format tampilan. */
  format?: (n: number) => string
  /** Arah "lebih baik": naik = besar lebih baik. */
  lebihBaik?: 'naik' | 'turun' | 'tidak'
  penting?: boolean
}

export function TabelBanding({
  kandidat,
  skor,
  namaTarget,
}: {
  kandidat: KandidatBanding[]
  skor: Map<number, SkorBanding> | null
  namaTarget: string | null
}) {
  const n = kandidat.length

  const barisSkor: BarisNilai[] = skor
    ? [
        {
          label: 'Match Score total',
          keterangan: namaTarget ? `terhadap ${namaTarget}` : undefined,
          nilai: kandidat.map((k) => skor.get(k.pegawaiId)?.skorTotal ?? null),
          format: formatSkor,
          lebihBaik: 'naik',
          penting: true,
        },
        {
          label: 'Potensi & Kompetensi',
          keterangan: 'bobot 65%',
          nilai: kandidat.map((k) => skor.get(k.pegawaiId)?.skorPotensiKompetensi ?? null),
          format: formatSkorRingkas,
          lebihBaik: 'naik',
        },
        {
          label: 'Kualifikasi Jabatan',
          keterangan: 'bobot 20%',
          nilai: kandidat.map((k) => skor.get(k.pegawaiId)?.skorKualifikasiJabatan ?? null),
          format: formatSkorRingkas,
          lebihBaik: 'naik',
        },
        {
          label: 'Integritas & Moralitas',
          keterangan: 'bobot 15%',
          nilai: kandidat.map((k) => skor.get(k.pegawaiId)?.skorIntegritasMoralitas ?? null),
          format: formatSkorRingkas,
          lebihBaik: 'naik',
        },
      ]
    : []

  const barisAsesmen: BarisNilai[] = [
    {
      label: 'Nilai Kinerja (sumbu Y)',
      keterangan: 'turunan predikat · 5 nilai diskrit',
      nilai: kandidat.map((k) => k.nilaiKinerjaY),
      format: formatSkorRingkas,
      lebihBaik: 'naik',
    },
    {
      label: 'Nilai Potensial (sumbu X)',
      keterangan: 'rubrik generik · 0–100',
      nilai: kandidat.map((k) => k.nilaiPotensialX),
      format: formatSkorRingkas,
      lebihBaik: 'naik',
    },
    {
      label: 'Nilai Talenta',
      keterangan: '50% Y + 50% X',
      nilai: kandidat.map((k) => k.nilaiTalenta),
      format: formatSkor,
      lebihBaik: 'naik',
      penting: true,
    },
    {
      label: 'Potkom',
      keterangan: 'asesmen jabatan saat ini · 0–100',
      nilai: kandidat.map((k) => k.potkom),
      format: formatSkorRingkas,
      lebihBaik: 'naik',
    },
    {
      label: 'Nilai Integritas',
      keterangan: 'rubrik rekam jejak disiplin · 0–100',
      nilai: kandidat.map((k) => k.nilaiIntegritas),
      format: formatSkorRingkas,
      lebihBaik: 'naik',
    },
  ]

  const barisPengalaman: BarisNilai[] = [
    {
      label: 'Masa kerja ASN',
      keterangan: 'turunan NIP · tahun',
      nilai: kandidat.map((k) => k.masaKerjaTahun),
      format: (v) => `${formatSkorRingkas(v)} thn`,
      lebihBaik: 'naik',
    },
    {
      label: 'Jumlah riwayat jabatan',
      nilai: kandidat.map((k) => k.jumlahRiwayatJabatan),
      format: formatAngka,
      lebihBaik: 'naik',
    },
    {
      label: 'Jumlah diklat tercatat',
      keterangan: 'input indikator Pengembangan Kompetensi',
      nilai: kandidat.map((k) => k.jumlahDiklat),
      format: formatAngka,
      lebihBaik: 'naik',
    },
    {
      label: 'Usia',
      keterangan: 'turunan NIP · tahun',
      nilai: kandidat.map((k) => k.usia),
      format: (v) => `${formatAngka(v)} thn`,
      lebihBaik: 'tidak',
    },
    {
      label: 'Sisa masa jabatan ke BUP',
      keterangan: 'proyeksi dari NIP · tahun',
      nilai: kandidat.map((k) => k.tahunKePensiun),
      format: (v) => `${formatSkorRingkas(v)} thn`,
      lebihBaik: 'tidak',
    },
  ]

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <caption className="sr-only">
          Perbandingan {n} kandidat: baris berisi atribut, kolom berisi kandidat.
        </caption>
        <thead className="sticky top-0 z-10 bg-surface-2">
          <tr className="border-b border-border">
            <th
              scope="col"
              className="sticky left-0 z-10 min-w-[13rem] bg-surface-2 px-3 py-2 text-left text-[11px] font-medium tracking-wide text-text-subtle uppercase"
            >
              Atribut
            </th>
            {kandidat.map((k, j) => (
              <th
                key={k.nip}
                scope="col"
                className="min-w-[11rem] px-3 py-2 text-left align-top"
              >
                <span className="flex items-start gap-2">
                  {/* Titik warna menyamakan identitas kolom dengan seri radar */}
                  <span
                    aria-hidden
                    className="mt-1 size-2.5 shrink-0 rounded-full"
                    style={{ background: warnaSeri(j) }}
                  />
                  <span className="min-w-0">
                    <Link
                      href={`/talenta/${k.nip}`}
                      className="block truncate font-semibold text-text hover:text-accent hover:underline"
                    >
                      {k.nama}
                    </Link>
                    <span className="tabular block text-[10px] font-normal text-text-subtle">
                      {formatNip(k.nip)}
                    </span>
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          <Judul kolom={n + 1} teks="Identitas & posisi" />
          <BarisTeks
            label="Jabatan"
            isi={kandidat.map((k) => k.namaJabatan ?? '—')}
          />
          <BarisTeks label="Unit organisasi" isi={kandidat.map((k) => k.namaUnit ?? '—')} />
          <BarisTeks
            label="Eselon / jenjang"
            isi={kandidat.map((k) =>
              [k.eselon === 'NON_ESELON' ? 'Non-eselon' : k.eselon, k.jenjang]
                .filter(Boolean)
                .join(' · '),
            )}
          />
          <BarisTeks
            label="Pangkat / golongan"
            isi={kandidat.map((k) => `${k.pangkat}${k.golongan ? ` · ${k.golongan}` : ''}`)}
          />
          <BarisTeks
            label="Pendidikan tertinggi"
            isi={kandidat.map((k) =>
              k.pendidikanTertinggi === null
                ? '—'
                : `${formatTingkatPendidikan(k.pendidikanTertinggi as TingkatPendidikan)}${
                    k.bidangStudi ? ` · ${k.bidangStudi}` : ''
                  }`,
            )}
          />

          {/* K-4: posisi Kotak 9 & predikat kinerja SELALU berdampingan dengan
              match score, karena Formula B tidak memuat unsur kinerja. */}
          <Judul kolom={n + 1} teks="Posisi Kotak 9 & kinerja" />
          <tr className="border-b border-border">
            <Th>Kotak 9</Th>
            {kandidat.map((k) => (
              <td key={k.nip} className="px-3 py-2 align-top">
                {k.kotak9 === null ? (
                  <span className="text-text-subtle">Belum diases</span>
                ) : (
                  <span className="flex flex-col items-start gap-1">
                    <Badge
                      tone={k.kotak9 >= 7 ? 'sukses' : k.kotak9 >= 4 ? 'aksen' : 'peringatan'}
                      title={DESKRIPSI_KOTAK_9[k.kotak9 as Kotak9]}
                    >
                      Kotak {k.kotak9}
                    </Badge>
                    {/* Kategori sumbunya ditulis, bukan cuma nomornya: tanpa itu
                        baris ini berbunyi "Kotak 9 → Kotak 9" dan pembaca tidak
                        bisa tahu apakah yang tampil label atau nilainya. */}
                    {(() => {
                      const kat = kategoriDariKotak9(k.kotak9)
                      return kat ? (
                        <span className="text-[11px] leading-tight text-text-subtle">
                          {kat.y} · potensial {kat.x}
                        </span>
                      ) : null
                    })()}
                  </span>
                )}
              </td>
            ))}
          </tr>
          <BarisTeks
            label="Predikat kinerja"
            keterangan="taksonomi predikat, bukan kategori sumbu"
            isi={kandidat.map((k) => k.predikatKinerja ?? '—')}
          />
          <BarisTeks
            label="Asesmen terbaru"
            isi={kandidat.map((k) =>
              k.tahunAsesmen === null
                ? 'Belum ada'
                : `${k.tahunAsesmen} · ${k.jenisAsesmen ?? '—'}${
                    k.statusAsesmen && k.statusAsesmen !== 'Berlaku'
                      ? ` (${k.statusAsesmen === 'Expired' ? 'kedaluwarsa' : k.statusAsesmen})`
                      : ''
                  }`,
            )}
          />
          {barisAsesmen.map((b) => (
            <BarisAngka key={b.label} baris={b} />
          ))}

          {skor ? (
            <>
              <Judul
                kolom={n + 1}
                teks={`Match score · ${namaTarget ?? 'jabatan target terpilih'}`}
              />
              {barisSkor.map((b) => (
                <BarisAngka key={b.label} baris={b} />
              ))}
              <tr className="border-b border-border">
                <Th>Status eligibility</Th>
                {kandidat.map((k) => {
                  const s = skor.get(k.pegawaiId)
                  return (
                    <td key={k.nip} className="px-3 py-2 align-top">
                      {s === undefined ? (
                        <span className="text-text-subtle">Tidak ada skor</span>
                      ) : (
                        <span className="flex flex-col items-start gap-1">
                          <Badge tone={s.eligible ? 'sukses' : 'peringatan'}>
                            {s.eligible ? 'Memenuhi syarat' : 'Belum memenuhi'}
                          </Badge>
                          {s.catatanEligibility ? (
                            <span className="text-[11px] leading-relaxed text-text-subtle">
                              {s.catatanEligibility}
                            </span>
                          ) : null}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
              <tr className="border-b border-border">
                <Th>Talent pool</Th>
                {kandidat.map((k) => {
                  const s = skor.get(k.pegawaiId)
                  return (
                    <td key={k.nip} className="px-3 py-2 align-top">
                      {s?.statusTalentPool ? (
                        <span className="text-text-muted">
                          {s.statusTalentPool}
                          {s.ranking !== null ? (
                            <span className="tabular text-text-subtle">
                              {' '}
                              · peringkat {s.ranking}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-text-subtle">Belum masuk pool</span>
                      )}
                    </td>
                  )
                })}
              </tr>
            </>
          ) : null}

          <Judul kolom={n + 1} teks="Pengalaman & rekam jejak" />
          {barisPengalaman.map((b) => (
            <BarisAngka key={b.label} baris={b} />
          ))}
          <tr>
            <Th>Hukuman disiplin aktif</Th>
            {kandidat.map((k) => (
              <td key={k.nip} className="px-3 py-2 align-top">
                {k.hukumanAktifTerberat === null ? (
                  <span
                    className="text-text-subtle"
                    title="Tidak ada catatan aktif. Sistem memperlakukannya sebagai skor integritas 100 — itu asumsi, bukan fakta terverifikasi."
                  >
                    Tidak ada catatan
                  </span>
                ) : (
                  <Badge tone="peringatan">{k.hukumanAktifTerberat}</Badge>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

function Th({ children, keterangan }: { children: ReactNode; keterangan?: string }) {
  return (
    <th
      scope="row"
      className="sticky left-0 z-10 bg-surface px-3 py-2 text-left align-top font-normal"
    >
      <span className="block text-text-muted">{children}</span>
      {keterangan ? (
        <span className="block text-[10px] leading-tight text-text-subtle">{keterangan}</span>
      ) : null}
    </th>
  )
}

function Judul({ kolom, teks }: { kolom: number; teks: string }) {
  return (
    <tr className="border-y border-border bg-surface-inset">
      <td
        colSpan={kolom}
        className="sticky left-0 px-3 py-1.5 text-[10px] font-semibold tracking-wider text-text-subtle uppercase"
      >
        {teks}
      </td>
    </tr>
  )
}

function BarisTeks({
  label,
  keterangan,
  isi,
}: {
  label: string
  keterangan?: string
  isi: string[]
}) {
  return (
    <tr className="border-b border-border">
      <Th keterangan={keterangan}>{label}</Th>
      {isi.map((v, j) => (
        <td key={j} className="px-3 py-2 align-top text-text">
          {v === '' ? <span className="text-text-subtle">—</span> : v}
        </td>
      ))}
    </tr>
  )
}

/**
 * Baris angka dengan penanda nilai terbaik & **selisih terbesar**.
 *
 * Selisih dihitung dari nilai yang ada saja (null diabaikan) — kalau tidak,
 * kandidat tanpa data akan tampak seperti nilai 0 dan selisihnya jadi palsu.
 */
function BarisAngka({ baris }: { baris: BarisNilai }) {
  const ada = baris.nilai.filter((v): v is number => v !== null)
  const maks = ada.length > 0 ? Math.max(...ada) : null
  const min = ada.length > 0 ? Math.min(...ada) : null
  const rentang = maks !== null && min !== null ? maks - min : 0
  const fmt = baris.format ?? formatSkorRingkas
  const arah = baris.lebihBaik ?? 'naik'
  const terbaik = arah === 'naik' ? maks : arah === 'turun' ? min : null

  // Ambang 10 poin: selisih di bawah itu jarang jadi alasan keputusan, dan
  // menandai semua baris membuat penandaannya kehilangan arti.
  const selisihBerarti = ada.length > 1 && rentang >= 10

  return (
    <tr className={cn('border-b border-border', baris.penting && 'bg-surface-2/60')}>
      <Th keterangan={baris.keterangan}>
        <span className={cn(baris.penting && 'font-medium text-text')}>{baris.label}</span>
        {selisihBerarti ? (
          <span
            className="tabular ml-1.5 rounded bg-warning-subtle px-1 py-px text-[10px] font-medium text-warning"
            title={`Selisih ${fmt(rentang)} antara kandidat tertinggi dan terendah pada baris ini`}
          >
            Δ {fmt(rentang)}
          </span>
        ) : null}
      </Th>
      {baris.nilai.map((v, j) => (
        <td key={j} className="px-3 py-2 align-top">
          {v === null ? (
            <span className="text-text-subtle">—</span>
          ) : (
            <span
              className={cn(
                'tabular',
                terbaik !== null && v === terbaik && ada.length > 1
                  ? 'font-semibold text-text'
                  : 'text-text-muted',
              )}
              title={
                terbaik !== null && v === terbaik && ada.length > 1
                  ? 'Nilai tertinggi pada baris ini'
                  : undefined
              }
            >
              {fmt(v)}
            </span>
          )}
        </td>
      ))}
    </tr>
  )
}
