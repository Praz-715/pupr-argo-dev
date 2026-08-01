import { ArrowLeft, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { TrenKinerja } from '@/components/charts/tren-kinerja'
import { LabelFase } from '@/components/layout/tautan-fase'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ChartSkeleton, ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import {
  formatAngka,
  formatBobot,
  formatDurasiTahun,
  formatNip,
  formatSkor,
  formatSkorRingkas,
  formatTanggal,
  formatTanggalPanjang,
  formatTingkatPendidikan,
  inisial,
} from '@/lib/format'
import { getCurrentUser } from '@/lib/auth'
import { LABEL_TINGKAT, tingkatKelengkapan } from '@/lib/kelengkapan'
import {
  ambilHukumanDisiplin,
  ambilKelengkapan,
  ambilKinerja,
  ambilMatchScore,
  ambilProfil,
  ambilRiwayatAsesmen,
  ambilRiwayatJabatan,
  ambilRiwayatPendidikan,
  type ProfilPegawai,
} from '@/lib/kueri/pegawai'
import { lingkupData, unitWajib } from '@/lib/lingkup'
import { DESKRIPSI_KOTAK_9, klasifikasiSumbuX, klasifikasiSumbuY } from '@/lib/scoring'
import { DaftarDiklat } from './_komponen/daftar-diklat'
import { RincianSkor } from './_komponen/rincian-skor'

/** Batas unit pengguna yang sedang masuk — dipakai judul halaman & isinya. */
async function batasUnitSaya(): Promise<number | null> {
  return unitWajib(lingkupData(await getCurrentUser()))
}

export async function generateMetadata({ params }: { params: Promise<{ nip: string }> }) {
  const { nip } = await params
  const profil = await ambilProfil(nip, await batasUnitSaya())
  return { title: profil ? profil.nama : 'Profil tidak ditemukan' }
}

/**
 * Profil Talenta 360° (PRD §6.3).
 *
 * Setiap bagian berat dibungkus <Suspense> sendiri supaya identitas pegawai
 * langsung tampil dan sisanya mengalir masuk.
 *
 * **Pegawai di luar lingkup unit pengguna berakhir di `notFound()`**, bukan di
 * halaman "akses ditolak". Itu disengaja: halaman yang berkata "orang ini ada
 * tapi Anda tidak boleh melihatnya" tetap mengonfirmasi keberadaannya kepada
 * yang tidak berhak tahu — dan NIP bisa ditebak dari pola tanggal lahir.
 */
export default async function ProfilPage({ params }: { params: Promise<{ nip: string }> }) {
  const { nip } = await params
  const profil = await ambilProfil(nip, await batasUnitSaya())
  if (!profil) notFound()

  return (
    <div className="space-y-5">
      <Link
        href="/talenta"
        className="inline-flex items-center gap-1.5 text-[13px] text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        Direktori Pegawai
      </Link>

      <KepalaProfil profil={profil} />

      <Suspense fallback={<PanelMemuat judul="Kelengkapan data" baris={4} />}>
        <BagianKelengkapan profil={profil} />
      </Suspense>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <Suspense fallback={<PanelMemuat judul="Posisi Kotak 9 & riwayat asesmen" baris={4} />}>
          <BagianAsesmen profil={profil} />
        </Suspense>
        <Suspense fallback={<PanelChartMemuat judul="Tren kinerja" />}>
          <BagianKinerja profil={profil} />
        </Suspense>
      </div>

      <Suspense fallback={<PanelMemuat judul="Kecocokan dengan jabatan target" baris={6} />}>
        <BagianMatchScore profil={profil} />
      </Suspense>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        <Suspense fallback={<PanelMemuat judul="Riwayat jabatan" baris={5} />}>
          <BagianRiwayatJabatan profil={profil} />
        </Suspense>
        <div className="space-y-5">
          <Suspense fallback={<PanelMemuat judul="Riwayat pendidikan" baris={3} />}>
            <BagianPendidikan profil={profil} />
          </Suspense>
          <Suspense fallback={<PanelMemuat judul="Riwayat diklat" baris={5} />}>
            <BagianDiklat profil={profil} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<PanelMemuat judul="Integritas & rekam jejak disiplin" baris={2} />}>
        <BagianIntegritas profil={profil} />
      </Suspense>
    </div>
  )
}

// ---------------------------------------------------------------------------

function KepalaProfil({ profil }: { profil: ProfilPegawai }) {
  const bio: Array<{ label: string; nilai: string; catatan?: string }> = [
    { label: 'Pangkat / Golongan', nilai: `${profil.pangkat} · ${profil.golongan ?? '—'}`, catatan: profil.tmtGolongan ? `TMT ${formatTanggal(profil.tmtGolongan)}` : undefined },
    { label: 'Jenjang', nilai: profil.jenjang ?? '—', catatan: profil.eselon === 'NON_ESELON' ? 'Non-eselon' : profil.eselon ? `Eselon ${profil.eselon}` : undefined },
    { label: 'Lama menjabat', nilai: formatDurasiTahun(profil.lamaMenjabatTahun), catatan: profil.tmtJabatan ? `TMT ${formatTanggal(profil.tmtJabatan)}` : undefined },
    { label: 'Pendidikan terakhir', nilai: formatTingkatPendidikan(profil.tingkatPendidikan), catatan: profil.bidangStudiTerakhir ?? undefined },
    // ---- Turunan NIP: tidak ada kolomnya di DB (phase.md §3 K-6) ----
    { label: 'Usia', nilai: profil.usia === null ? '—' : `${formatAngka(profil.usia)} tahun`, catatan: profil.tanggalLahir ? formatTanggalPanjang(profil.tanggalLahir) : undefined },
    { label: 'Jenis kelamin', nilai: profil.jenisKelamin === 'L' ? 'Laki-laki' : profil.jenisKelamin === 'P' ? 'Perempuan' : '—', catatan: 'dari NIP' },
    { label: 'Masa kerja ASN', nilai: formatDurasiTahun(profil.masaKerjaTahun), catatan: profil.tmtCpns ? `CPNS ${profil.tmtCpns.bulan}/${profil.tmtCpns.tahun}` : undefined },
    {
      label: 'Batas usia pensiun',
      nilai: `${profil.batasUsiaPensiun} tahun`,
      catatan: profil.tanggalPensiun ? formatTanggal(profil.tanggalPensiun) : undefined,
    },
  ]

  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-sm font-semibold text-accent"
          >
            {inisial(profil.nama)}
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-text">{profil.nama}</h1>
            <p className="tabular mt-0.5 text-[13px] text-text-muted">{formatNip(profil.nip)}</p>
            <p className="mt-1.5 text-sm text-text-muted">
              {profil.namaJabatan ?? 'Belum tertaut ke master jabatan'}
            </p>
            <p className="text-[13px] text-text-subtle">
              {profil.namaUnit ?? '—'}
              {profil.unitInduk ? ` · ${profil.unitInduk}` : ''}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {profil.statusAktif !== 'AKTIF' ? (
            <Badge tone="peringatan">{profil.statusAktif}</Badge>
          ) : (
            <Badge tone="sukses">
              <StatusDot tone="sukses" />
              Aktif
            </Badge>
          )}
          {profil.segeraPensiun ? (
            <Badge tone="peringatan" title="Mencapai batas usia pensiun dalam 2 tahun atau kurang">
              Mendekati BUP
            </Badge>
          ) : null}
          <Badge tone="netral" title={`Data terakhir disinkronkan dari ${profil.sumberSinkron}`}>
            Sumber: {profil.sumberSinkron}
          </Badge>
        </div>
      </div>

      {!profil.nipValid ? (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-warning-border bg-warning-subtle p-2.5">
          <TriangleAlert className="mt-px size-4 shrink-0 text-warning" />
          <p className="text-[11px] leading-relaxed text-text-muted">
            <span className="font-medium text-text">NIP tidak lolos validasi format.</span>{' '}
            {profil.masalahNip.join('; ')}. Usia, jenis kelamin, dan proyeksi pensiun diturunkan
            dari NIP, jadi nilai-nilai itu bisa keliru sampai NIP dibetulkan.
          </p>
        </div>
      ) : null}

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 sm:grid-cols-4">
        {bio.map((b) => (
          <div key={b.label} className="min-w-0">
            <dt className="text-[10px] font-medium tracking-wide text-text-subtle uppercase">
              {b.label}
            </dt>
            <dd className="mt-0.5 truncate text-[13px] font-medium text-text" title={b.nilai}>
              {b.nilai}
            </dd>
            {b.catatan ? (
              <dd className="truncate text-[11px] text-text-subtle" title={b.catatan}>
                {b.catatan}
              </dd>
            ) : null}
          </div>
        ))}
      </dl>
    </Panel>
  )
}

async function BagianKelengkapan({ profil }: { profil: ProfilPegawai }) {
  const k = await ambilKelengkapan(profil.pegawaiId, profil.nipValid)
  const tingkat = tingkatKelengkapan(k.persen)
  const nada = tingkat === 'LENGKAP' ? 'sukses' : tingkat === 'CUKUP' ? 'peringatan' : 'bahaya'

  return (
    <Panel>
      <PanelHeader
        judul="Kelengkapan data"
        deskripsi="Dihitung berbobot menurut dampaknya ke penilaian — data yang jadi input rubrik berbobot lebih besar daripada data administratif."
        aksi={
          <Badge tone={nada}>
            <StatusDot tone={nada} />
            {formatSkorRingkas(k.persen)}% · {LABEL_TINGKAT[tingkat]}
          </Badge>
        }
      />

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={
            nada === 'sukses' ? 'h-full bg-success' : nada === 'peringatan' ? 'h-full bg-warning' : 'h-full bg-danger'
          }
          style={{ width: `${Math.max(2, k.persen)}%` }}
        />
      </div>

      {k.belum.length === 0 ? (
        <p className="mt-3 text-[13px] text-success">Seluruh butir data sudah lengkap.</p>
      ) : (
        <>
          <p className="mt-3 text-[11px] text-text-subtle">
            {formatAngka(k.belum.length)} butir belum terpenuhi
            {k.prioritas ? ` · prioritas: ${k.prioritas.label}` : ''}
          </p>
          <ul className="mt-2 space-y-1.5">
            {k.belum.map((b) => (
              <li key={b.kunci} className="flex items-start gap-2 text-[12px]">
                <StatusDot tone="peringatan" className="mt-1.5" />
                <span className="min-w-0">
                  <span className="font-medium text-text">{b.label}</span>
                  <span className="text-text-subtle"> — {b.alasan}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

async function BagianAsesmen({ profil }: { profil: ProfilPegawai }) {
  const asesmen = await ambilRiwayatAsesmen(profil.pegawaiId)
  const terbaru = asesmen[0]

  return (
    <Panel padat>
      <div className="border-b border-border p-4">
        <PanelHeader
          judul="Posisi Kotak 9 & riwayat asesmen"
          deskripsi={
            asesmen.length === 0
              ? undefined
              : `${formatAngka(asesmen.length)} asesmen tercatat · posisi terbaru dari tahun ${terbaru!.tahunAsesmen}`
          }
        />
      </div>

      {!terbaru ? (
        <p className="p-6 text-center text-[13px] text-text-muted">
          Belum ada asesmen talenta. Tanpa asesmen, pegawai ini tidak punya posisi di Kotak 9 dan
          tidak bisa dinilai untuk jabatan target.
        </p>
      ) : (
        <>
          <div className="flex items-start gap-4 border-b border-border p-4">
            <span
              aria-hidden
              className="tabular flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-accent-subtle text-accent"
            >
              <span className="text-[9px] font-medium tracking-wide uppercase">Kotak</span>
              <span className="text-xl leading-none font-semibold">{terbaru.kotak9}</span>
            </span>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-text">
                {klasifikasiSumbuY(terbaru.nilaiKinerjaY)} × Potensial{' '}
                {klasifikasiSumbuX(terbaru.nilaiPotensialX)}
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-text-subtle">
                {DESKRIPSI_KOTAK_9[terbaru.kotak9]}
              </p>
              <p className="tabular mt-1.5 text-[11px] text-text-muted">
                Kinerja {formatSkorRingkas(terbaru.nilaiKinerjaY)} · Potensial{' '}
                {formatSkorRingkas(terbaru.nilaiPotensialX)} · Nilai Talenta{' '}
                <span className="font-medium text-text">{formatSkor(terbaru.nilaiTalenta)}</span>
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[34rem] text-[12px]">
              <thead>
                <tr className="border-b border-border text-left text-[10px] tracking-wide text-text-subtle uppercase">
                  <th className="px-4 py-1.5 font-medium">Tahun</th>
                  <th className="px-4 py-1.5 font-medium">Jenis</th>
                  <th className="px-4 py-1.5 text-right font-medium">Kinerja</th>
                  <th className="px-4 py-1.5 text-right font-medium">Potensial</th>
                  <th className="px-4 py-1.5 text-right font-medium">Kotak</th>
                  <th className="px-4 py-1.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {asesmen.map((a) => (
                  <tr key={a.tahunAsesmen} className="border-b border-border last:border-b-0">
                    <td className="tabular px-4 py-1.5 font-medium text-text">{a.tahunAsesmen}</td>
                    <td className="px-4 py-1.5 text-text-muted">{a.jenisAsesmen}</td>
                    <td className="tabular px-4 py-1.5 text-right">
                      <span className="block text-text-muted">
                        {formatSkorRingkas(a.nilaiKinerjaY)}
                      </span>
                      {/* Predikat & kategori sumbu adalah dua taksonomi berbeda (K-3) */}
                      <span className="block text-[10px] text-text-subtle">
                        {a.predikatKinerja}
                      </span>
                    </td>
                    <td className="tabular px-4 py-1.5 text-right text-text-muted">
                      {formatSkorRingkas(a.nilaiPotensialX)}
                    </td>
                    <td className="px-4 py-1.5 text-right">
                      <Badge tone={a.kotak9 >= 7 ? 'sukses' : a.kotak9 >= 4 ? 'aksen' : 'peringatan'}>
                        {a.kotak9}
                      </Badge>
                    </td>
                    <td className="px-4 py-1.5">
                      {a.statusAsesmen === 'Berlaku' ? (
                        <span className="text-text-subtle">Berlaku</span>
                      ) : (
                        <Badge tone="peringatan">{a.statusAsesmen}</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  )
}

async function BagianKinerja({ profil }: { profil: ProfilPegawai }) {
  const kinerja = await ambilKinerja(profil.pegawaiId)

  if (kinerja.length === 0) {
    return (
      <Panel>
        <PanelHeader judul="Tren kinerja" />
        <p className="mt-3 text-[13px] text-text-muted">
          Belum ada rekap kinerja periodik dari e-Kinerja.
        </p>
      </Panel>
    )
  }

  const tahunTerbaru = Math.max(...kinerja.map((k) => k.tahun))
  const tahunIni = kinerja
    .filter((k) => k.tahun === tahunTerbaru && k.nilaiKinerja !== null)
    .map((k) => ({
      periode: k.periode,
      nilaiKinerja: k.nilaiKinerja!,
      nilaiPerilaku: k.nilaiPerilaku ?? k.nilaiKinerja!,
    }))
    .sort(
      (a, b) =>
        ['TW1', 'TW2', 'TW3', 'TAHUNAN'].indexOf(a.periode) -
        ['TW1', 'TW2', 'TW3', 'TAHUNAN'].indexOf(b.periode),
    )

  return (
    <Panel>
      <PanelHeader
        judul={`Tren kinerja ${tahunTerbaru}`}
        deskripsi={`${formatAngka(tahunIni.length)} periode SKP tercatat · nilai granular dari e-Kinerja, bukan skor sumbu Kotak 9`}
      />
      {tahunIni.length < 2 ? (
        <p className="mt-3 text-[13px] text-text-muted">
          Hanya {formatAngka(tahunIni.length)} periode tercatat pada {tahunTerbaru} — belum cukup
          untuk menggambar tren. Nilai:{' '}
          {tahunIni.map((t) => `${t.periode} ${formatSkor(t.nilaiKinerja)}`).join(' · ') || '—'}
        </p>
      ) : (
        <div className="mt-2">
          <TrenKinerja titik={tahunIni} />
        </div>
      )}
    </Panel>
  )
}

async function BagianMatchScore({ profil }: { profil: ProfilPegawai }) {
  const daftar = await ambilMatchScore(profil.pegawaiId)

  return (
    <Panel padat>
      <div className="border-b border-border p-4">
        <PanelHeader
          judul="Kecocokan dengan jabatan target"
          deskripsi="Formula B: 65% Potensi & Kompetensi + 20% Kualifikasi Jabatan + 15% Integritas & Moralitas. Ketiganya komponen sumbu Potensial — skor ini TIDAK memuat unsur kinerja, jadi baca berdampingan dengan Kotak 9 di atas."
        />
      </div>

      {daftar.length === 0 ? (
        <p className="p-6 text-center text-[13px] text-text-muted">
          Belum ada perhitungan kecocokan. Skor terbentuk setelah pegawai dinilai terhadap suatu
          jabatan target.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {daftar.map((s) => (
            <li key={s.jabatanTargetId} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-text">{s.namaTarget}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-text-subtle">
                    {s.eligible ? (
                      <Badge tone="sukses">Lolos syarat</Badge>
                    ) : (
                      <Badge tone="bahaya">Tidak lolos syarat</Badge>
                    )}
                    {s.statusTalentPool ? (
                      <Badge tone="aksen">
                        Talent pool: {s.statusTalentPool}
                        {s.ranking ? ` · peringkat ${s.ranking}` : ''}
                      </Badge>
                    ) : null}
                  </p>
                </div>
                <span className="tabular shrink-0 text-right">
                  <span className="block text-xl leading-none font-semibold text-text">
                    {formatSkor(s.skorTotal)}
                  </span>
                  <span className="text-[10px] text-text-subtle">skor total</span>
                </span>
              </div>

              {s.catatanEligibility ? (
                <p className="mt-2 text-[11px] leading-relaxed text-text-subtle">
                  {s.catatanEligibility}
                </p>
              ) : null}

              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                <Komponen label="Potensi & Kompetensi" bobot={0.65} skor={s.skorPotensiKompetensi} />
                <Komponen label="Kualifikasi Jabatan" bobot={0.2} skor={s.skorKualifikasiJabatan} />
                <Komponen
                  label="Integritas & Moralitas"
                  bobot={0.15}
                  skor={s.skorIntegritasMoralitas}
                />
              </div>

              <RincianSkor rincian={s.rincian} />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

function Komponen({ label, bobot, skor }: { label: string; bobot: number; skor: number }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-2.5">
      <p className="flex items-center justify-between text-[10px] text-text-subtle">
        <span className="min-w-0 truncate">{label}</span>
        <span className="tabular ml-1 shrink-0">{formatBobot(bobot)}</span>
      </p>
      <p className="tabular mt-1 text-sm font-semibold text-text">{formatSkor(skor)}</p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full bg-accent" style={{ width: `${Math.max(2, skor)}%` }} />
      </div>
    </div>
  )
}

async function BagianRiwayatJabatan({ profil }: { profil: ProfilPegawai }) {
  const riwayat = await ambilRiwayatJabatan(profil.pegawaiId)
  const belumTerpetakan = riwayat.filter((r) => !r.terpetakan).length

  return (
    <Panel>
      <PanelHeader
        judul="Riwayat jabatan"
        deskripsi={
          riwayat.length === 0
            ? undefined
            : `${formatAngka(riwayat.length)} riwayat${belumTerpetakan > 0 ? ` · ${formatAngka(belumTerpetakan)} belum terpetakan ke master jabatan DJBK` : ''}`
        }
        aksi={
          riwayat.some((r) => r.nonDefinitif) ? (
            <Badge tone="aksen" title="Penugasan Plt/Plh menjadi input sub-indikator Substansi Riwayat Jabatan">
              Ada penugasan Plt/Plh
            </Badge>
          ) : null
        }
      />

      {riwayat.length === 0 ? (
        <p className="mt-3 text-[13px] text-text-muted">Belum ada riwayat jabatan tercatat.</p>
      ) : (
        <ol className="mt-4 space-y-0">
          {riwayat.map((r, i) => (
            <li key={r.urutan} className="relative flex gap-3 pb-4 last:pb-0">
              {/* Garis timeline */}
              {i < riwayat.length - 1 ? (
                <span aria-hidden className="absolute top-3 left-[5px] h-full w-px bg-border" />
              ) : null}
              <span
                aria-hidden
                className={
                  i === 0
                    ? 'relative mt-1.5 size-2.5 shrink-0 rounded-full bg-accent ring-2 ring-accent-subtle'
                    : 'relative mt-1.5 size-2.5 shrink-0 rounded-full bg-border-strong'
                }
              />
              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug font-medium text-text">
                  {r.namaJabatan ?? r.namaMentah}
                  {r.nonDefinitif ? (
                    <Badge tone="aksen" className="ml-1.5">
                      {r.nonDefinitif}
                    </Badge>
                  ) : null}
                </p>
                {r.namaJabatan && r.namaMentah !== r.namaJabatan ? (
                  <p className="mt-0.5 text-[11px] text-text-subtle">Teks sumber: {r.namaMentah}</p>
                ) : null}
                <p className="tabular mt-0.5 text-[11px] text-text-subtle">
                  {r.tanggalMulai ? formatTanggal(r.tanggalMulai) : 'tanggal belum ada'}
                  {' – '}
                  {r.tanggalAkhir ? formatTanggal(r.tanggalAkhir) : 'sekarang'}
                  {r.lamaTahun !== null ? ` · ${formatDurasiTahun(r.lamaTahun)}` : ''}
                </p>
                <p className="mt-0.5 text-[11px] text-text-subtle">
                  {r.namaUnit ?? (r.terpetakan ? '—' : 'Di luar master jabatan DJBK')}
                  {r.eselon && r.eselon !== 'NON_ESELON' ? ` · Eselon ${r.eselon}` : ''}
                  {r.noSk ? ` · ${r.noSk}` : ''}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  )
}

async function BagianPendidikan({ profil }: { profil: ProfilPegawai }) {
  const riwayat = await ambilRiwayatPendidikan(profil.pegawaiId)

  // Kolom arsip disembunyikan kalau SELURUH baris kosong — menampilkan tiga
  // kolom berisi tanda hubung tidak memberi informasi apa pun (phase.md §6 no. 8).
  const adaIjazah = riwayat.some((r) => r.urlIjazah !== null)
  const adaTranskrip = riwayat.some((r) => r.urlTranskrip !== null)
  const adaPertek = riwayat.some((r) => r.noPertekBkn !== null)
  const kolomDisembunyikan = [
    !adaIjazah && 'ijazah',
    !adaTranskrip && 'transkrip',
    !adaPertek && 'pertek BKN',
  ].filter(Boolean) as string[]

  return (
    <Panel>
      <PanelHeader
        judul="Riwayat pendidikan"
        deskripsi={
          riwayat.length === 0 ? undefined : `${formatAngka(riwayat.length)} jenjang tercatat`
        }
      />

      {riwayat.length === 0 ? (
        <p className="mt-3 text-[13px] text-text-muted">
          Belum ada riwayat pendidikan. Indikator Tingkat Pendidikan Formal & Kesesuaian Bidang Ilmu
          tidak bisa dihitung tanpa data ini.
        </p>
      ) : (
        <>
          <ul className="mt-3 divide-y divide-border">
            {riwayat.map((r) => (
              <li key={`${r.jenjang}-${r.urutan}`} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text">
                      {formatTingkatPendidikan(r.jenjang)} · {r.bidangStudi}
                    </p>
                    <p className="mt-0.5 text-[11px] text-text-subtle">
                      {r.namaSekolah ?? 'Nama sekolah belum terisi'}
                      {r.tahunLulus ? ` · lulus ${r.tahunLulus}` : ' · tahun lulus belum terisi'}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {adaIjazah ? (
                      r.urlIjazah ? (
                        <Badge tone="sukses">Ijazah</Badge>
                      ) : (
                        <Badge tone="netral">Ijazah belum ada</Badge>
                      )
                    ) : null}
                    {adaPertek && r.noPertekBkn ? (
                      <Badge tone="aksen" title={r.noPertekBkn}>
                        Pertek BKN
                      </Badge>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {kolomDisembunyikan.length > 0 ? (
            <p className="mt-3 border-t border-border pt-3 text-[11px] text-text-subtle">
              Kolom {kolomDisembunyikan.join(', ')} disembunyikan karena belum ada satu pun data
              arsipnya. Unggah arsip dilakukan dari halaman Master Data
              <LabelFase fase={4} />
            </p>
          ) : null}
        </>
      )}
    </Panel>
  )
}

async function BagianDiklat({ profil }: { profil: ProfilPegawai }) {
  return (
    <Panel>
      <PanelHeader
        judul="Riwayat diklat & sertifikasi"
        deskripsi={
          profil.riwayatDiklat.length === 0
            ? undefined
            : `${formatAngka(profil.riwayatDiklat.length)} entri dari eHRM · input indikator Pengembangan Kompetensi`
        }
      />
      <DaftarDiklat diklat={profil.riwayatDiklat} />
    </Panel>
  )
}

async function BagianIntegritas({ profil }: { profil: ProfilPegawai }) {
  const hukuman = await ambilHukumanDisiplin(profil.pegawaiId)
  const aktif = hukuman.filter((h) => h.statusAktif && h.tingkatHukuman !== 'Tidak Pernah')
  const nonaktif = hukuman.filter((h) => !h.statusAktif && h.tingkatHukuman !== 'Tidak Pernah')

  return (
    <Panel>
      <PanelHeader
        judul="Integritas & rekam jejak disiplin"
        deskripsi="Data sensitif — akses dibatasi peran tertentu (UU PDP No. 27/2022). Hanya riwayat berstatus aktif yang menurunkan skor Integritas & Moralitas."
        aksi={
          aktif.length > 0 ? (
            <Badge tone="bahaya">{formatAngka(aktif.length)} hukuman aktif</Badge>
          ) : hukuman.length > 0 ? (
            <Badge tone="sukses">Tidak ada hukuman aktif</Badge>
          ) : (
            <Badge tone="peringatan">Belum diverifikasi</Badge>
          )
        }
      />

      {hukuman.length === 0 ? (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-warning-border bg-warning-subtle p-2.5">
          <TriangleAlert className="mt-px size-4 shrink-0 text-warning" />
          <p className="text-[11px] leading-relaxed text-text-muted">
            <span className="font-medium text-text">Belum ada catatan rekam jejak disiplin.</span>{' '}
            Sistem memperlakukan ketiadaan catatan sebagai &ldquo;tidak pernah dijatuhi hukuman
            disiplin&rdquo; (skor 100) — itu <strong className="font-medium">asumsi</strong>, bukan
            fakta yang sudah diverifikasi. Verifikasi manual dilakukan di halaman Data Hukuman
            Disiplin
            <LabelFase fase={4} />
          </p>
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {[...aktif, ...nonaktif].map((h, i) => (
            <li key={i} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-text">
                    Hukuman disiplin {h.tingkatHukuman}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-subtle">
                    {h.tanggalSk ? formatTanggal(h.tanggalSk) : 'tanggal SK belum ada'}
                    {h.noSk ? ` · ${h.noSk}` : ''}
                  </p>
                  {h.keterangan ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                      {h.keterangan}
                    </p>
                  ) : null}
                </div>
                <Badge tone={h.statusAktif ? 'bahaya' : 'netral'}>
                  {h.statusAktif ? 'Aktif' : 'Sudah tidak berlaku'}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

// ---------------------------------------------------------------------------

function PanelMemuat({ judul, baris }: { judul: string; baris: number }) {
  return (
    <Panel>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-2 h-3 w-full max-w-lg" />
      <div className="mt-4">
        <ListSkeleton rows={baris} />
      </div>
      <span className="sr-only">Memuat {judul}</span>
    </Panel>
  )
}

function PanelChartMemuat({ judul }: { judul: string }) {
  return (
    <Panel>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-full max-w-md" />
      <div className="mt-3">
        <ChartSkeleton ratio="16 / 9" />
      </div>
      <span className="sr-only">Memuat {judul}</span>
    </Panel>
  )
}
