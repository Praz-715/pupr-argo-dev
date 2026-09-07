'use client'

import { Pencil, TriangleAlert, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Fragment, useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { GulirKeSini } from '@/components/ui/gulir-ke-sini'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { useToast } from '@/components/ui/toast'
import { simpanNilaiManual } from '@/lib/aksi/skoring'
import { cn } from '@/lib/cn'
import { formatBobot, formatNip, formatSkor } from '@/lib/format'
import { SATUAN_MENTAH } from '@/lib/penilaian'
import type {
  BarisKandidat,
  BarisRincianSkor,
  IndikatorRubrik,
  KomponenRubrik,
} from '@/lib/kueri/rubrik'

/**
 * Rincian Perhitungan Skor satu kandidat (usulan U-3).
 *
 * Yang membuat panel ini perlu ada: `match_score` hanya menyimpan tiga agregat +
 * total, sehingga pertanyaan "kenapa orang yang sama dapat 75,83 di satu jabatan
 * target tapi 88,33 di target lain?" tidak bisa dijawab dari UI — padahal
 * indikator Kesesuaian Bidang Ilmu & Pengembangan Kompetensi memang bernilai beda
 * per target. Tanpa tabel ini, skornya kotak hitam.
 *
 * Kolom `sumberNilai` dibedakan tegas: indikator yang datanya belum ada di sistem
 * sumber diisi manusia, dan itu **harus terlihat** beserta siapa yang mengisinya.
 */
export function PanelRincian({
  jabatanTargetId,
  kandidat,
  rincian,
  komponen,
  bolehUbah,
}: {
  jabatanTargetId: number
  kandidat: BarisKandidat
  rincian: BarisRincianSkor[]
  komponen: KomponenRubrik[]
  bolehUbah: boolean
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [formManual, setFormManual] = useState<BarisRincianSkor | null>(null)

  function tutup() {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('rincian')
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const perluReview = rincian.filter((r) => r.perluReview)
  const manual = rincian.filter((r) => r.sumberNilai === 'MANUAL')

  // Kelompokkan per komponen supaya bobot indikator terbaca relatif terhadap
  // komponennya — 5% itu benar di komponen 20%, menyesatkan kalau ditampilkan
  // sebagai satu daftar datar.
  const perKomponen = new Map<string, BarisRincianSkor[]>()
  for (const r of rincian) {
    perKomponen.set(r.namaKomponen, [...(perKomponen.get(r.namaKomponen) ?? []), r])
  }

  /*
    Baris INDUK — indikator yang punya sub-indikator. Nilainya rata-rata anaknya,
    jadi ia memang tidak punya sumber data sendiri, dan lencana "tanpa sumber
    otomatis" di sana menyatakan kekurangan yang sebenarnya bukan kekurangan.
  */
  const punyaAnak = new Set(
    rincian.map((r) => r.parentIndikatorId).filter((id): id is number => id !== null),
  )

  const semuaIndikator = new Map<number, IndikatorRubrik>()
  for (const k of komponen) {
    for (const i of k.indikator) {
      semuaIndikator.set(i.id, i)
      for (const a of i.anak) semuaIndikator.set(a.id, a)
    }
  }

  return (
    <Panel padat id="rincian">
      <GulirKeSini kunci={kandidat.nip} id="rincian" />
      <div className="border-b border-border px-3.5 py-3">
        <PanelHeader
          judul={
            <span className="flex flex-wrap items-center gap-2">
              Rincian perhitungan — {kandidat.nama}
              {kandidat.eligible ? (
                <Badge tone="sukses">lolos syarat</Badge>
              ) : (
                <Badge tone="netral">tidak lolos syarat</Badge>
              )}
            </span>
          }
          deskripsi={
            <>
              <span className="tabular">{formatNip(kandidat.nip)}</span> ·{' '}
              {kandidat.namaJabatan ?? 'tanpa jabatan'} · match score{' '}
              <strong className="font-medium text-text">{formatSkor(kandidat.skorTotal)}</strong> ={' '}
              {formatSkor(kandidat.skorPotensiKompetensi)}×65% +{' '}
              {formatSkor(kandidat.skorKualifikasiJabatan)}×20% +{' '}
              {formatSkor(kandidat.skorIntegritasMoralitas)}×15%
            </>
          }
          aksi={
            <>
              <Link
                href={`/talenta/${kandidat.nip}`}
                className="text-[12px] text-accent hover:underline"
              >
                Profil 360°
              </Link>
              <Button size="ikon" variant="halus" onClick={tutup} aria-label="Tutup rincian">
                <X className="size-4" />
              </Button>
            </>
          }
        />
      </div>

      {!kandidat.eligible && kandidat.catatanEligibility !== null ? (
        <div className="border-b border-border bg-warning-subtle px-3.5 py-2.5">
          <p className="text-[11px] leading-relaxed text-text-muted">
            <strong className="font-medium text-text">Kelayakan:</strong>{' '}
            {kandidat.catatanEligibility}
          </p>
        </div>
      ) : null}

      {rincian.length === 0 ? (
        <p className="px-3.5 py-6 text-center text-[12px] leading-relaxed text-text-subtle">
          Rincian per indikator belum tersedia — skor ini dihitung sebelum tabel rincian ada.
          Jalankan Hitung Ulang untuk mengisinya.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] border-collapse text-[12px]">
            <thead className="bg-surface-2">
              <tr className="border-b border-border text-left text-[10px] tracking-wide text-text-subtle uppercase">
                <th className="px-3.5 py-2 font-medium">Indikator</th>
                <th className="px-3 py-2 text-right font-medium">Bobot</th>
                <th className="px-3 py-2 font-medium">Nilai mentah</th>
                <th className="px-3 py-2 font-medium">Kategori terpilih</th>
                <th className="px-3 py-2 text-right font-medium">Skor</th>
                <th className="px-3.5 py-2 font-medium">Sumber</th>
              </tr>
            </thead>
            <tbody>
              {[...perKomponen.entries()].map(([namaKomponen, baris]) => (
                // Fragment berkunci: tanpa `key` di sini React memperingatkan
                // walaupun tiap <tr> di dalamnya sudah punya kunci sendiri.
                <Fragment key={namaKomponen}>
                  <tr className="border-b border-border bg-surface-2">
                    <td colSpan={6} className="px-3.5 py-1.5">
                      <span className="text-[11px] font-medium text-text">{namaKomponen}</span>
                      <span className="tabular ml-2 text-[10px] text-text-subtle">
                        bobot komponen {formatBobot(baris[0]?.bobotKomponen ?? 0)}
                      </span>
                    </td>
                  </tr>
                  {baris.map((r) => {
                    const sub = r.parentIndikatorId !== null
                    return (
                      <tr
                        key={`${namaKomponen}-${r.rubrikIndikatorId}`}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className={cn('px-3.5 py-2', sub && 'pl-8')}>
                          <span className="flex flex-wrap items-center gap-1.5">
                            {sub ? (
                              <span aria-hidden className="text-text-subtle">
                                └
                              </span>
                            ) : null}
                            <span className={sub ? 'text-text-muted' : 'font-medium text-text'}>
                              {r.namaIndikator}
                            </span>
                            {r.perluReview ? (
                              <span title="Nilai kosong, di luar ambang, atau dipotong — perlu ditinjau manusia">
                                <TriangleAlert className="size-3 shrink-0 text-warning" />
                              </span>
                            ) : null}
                            {/*
                              Dulu berbunyi "manual" — kata yang di halaman profil
                              berarti "diisi manusia", sementara di sini artinya
                              "tidak punya sumber data otomatis". Dua arti untuk
                              satu kata pada tabel yang sama isinya, dan kolom
                              Sumber di kanan sudah memakai kata itu dalam arti
                              yang pertama.
                            */}
                            {r.kunci === null && !punyaAnak.has(r.rubrikIndikatorId) ? (
                              <Badge
                                tone="peringatan"
                                title="Indikator ini tidak punya sumber data otomatis — nilainya harus diisi manusia"
                              >
                                tanpa sumber otomatis
                              </Badge>
                            ) : r.kunci === 'LAMA_JABATAN' && r.sumberNilai !== 'MANUAL' ? (
                              /*
                                Sama dengan yang di halaman profil (`rincian-skor.tsx`)
                                — kasus Maul, riwayat belum terpetakan → jatuh ke
                                `tmt_jabatan` → meleset diam-diam. Ditampilkan untuk
                                SEMUA baris Lama Jabatan otomatis, bukan hanya yang
                                `perluReview`.
                              */
                              <Badge
                                tone="peringatan"
                                title="Dihitung otomatis dari riwayat jabatan — kalau riwayatnya belum lengkap di sistem, angka ini bisa jatuh ke tanggal SK terakhir dan meleset jauh. Verifikasi lewat profil pegawainya."
                              >
                                perlu verifikasi
                              </Badge>
                            ) : null}
                          </span>
                        </td>
                        <td className="tabular px-3 py-2 text-right text-text-subtle">
                          {r.bobot === null ? (
                            <span title="Sub-indikator: dirata-rata ke induknya">rata-rata</span>
                          ) : (
                            formatBobot(r.bobot)
                          )}
                        </td>
                        <td className="tabular px-3 py-2 text-text-muted">
                          {(() => {
                            if (r.nilaiMentah === null) return '—'
                            const n = Number(r.nilaiMentah)
                            const satuan = r.kunci === null ? undefined : SATUAN_MENTAH[r.kunci]
                            if (satuan === undefined || r.nilaiMentah.trim() === '' || Number.isNaN(n))
                              return r.nilaiMentah
                            return (
                              <span title={satuan.jelaskan(n)}>
                                {formatSkor(n)} {satuan.satuan}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="px-3 py-2 text-text-subtle">
                          <span
                            className="block max-w-[18rem] break-words"
                            title={r.kategoriTerpilih ?? ''}
                          >
                            {r.kategoriTerpilih ?? '—'}
                          </span>
                        </td>
                        <td className="tabular px-3 py-2 text-right font-medium text-text">
                          {formatSkor(r.skor)}
                        </td>
                        <td className="px-3.5 py-2">
                          <span className="flex items-center gap-1.5">
                            {r.sumberNilai === 'MANUAL' ? (
                              <Badge
                                tone="aksen"
                                title={
                                  [r.namaPengisi ? `Diisi ${r.namaPengisi}` : null, r.catatan]
                                    .filter(Boolean)
                                    .join(' — ') || 'Diisi manusia'
                                }
                              >
                                manusia
                              </Badge>
                            ) : (
                              <span className="text-[11px] text-text-subtle">otomatis</span>
                            )}
                            {bolehUbah && r.parentIndikatorId !== null ? null : null}
                            {bolehUbah && semuaIndikator.get(r.rubrikIndikatorId) !== undefined ? (
                              <Button
                                size="ikon"
                                variant="halus"
                                onClick={() => setFormManual(r)}
                                aria-label={`Isi nilai manual ${r.namaIndikator}`}
                                title="Isi nilai manual"
                              >
                                <Pencil className="size-3" />
                              </Button>
                            ) : null}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="space-y-1.5 border-t border-border px-3.5 py-3">
        {perluReview.length > 0 ? (
          <p className="text-[11px] leading-relaxed text-warning">
            {perluReview.length} indikator perlu ditinjau:{' '}
            {perluReview.map((r) => r.namaIndikator).join(' · ')}. Nilainya tetap ikut dihitung
            memakai kategori terdekat, jadi skornya bisa terlihat wajar padahal dasarnya belum tentu.
          </p>
        ) : null}
        {manual.length > 0 ? (
          <p className="text-[11px] leading-relaxed text-text-subtle">
            {manual.length} nilai diisi manusia dan{' '}
            <strong className="font-medium text-text-muted">dipertahankan</strong> saat Hitung Ulang
            dijalankan.
          </p>
        ) : null}
        <p className="text-[11px] leading-relaxed text-text-subtle">
          Sub-indikator (baris berindentasi) digabung ke induknya lewat rata-rata; nilai indikator
          lalu dikalikan bobotnya untuk membentuk skor komponen.
        </p>
      </div>

      {formManual !== null ? (
        <FormNilaiManual
          jabatanTargetId={jabatanTargetId}
          pegawaiId={kandidat.pegawaiId}
          namaKandidat={kandidat.nama}
          baris={formManual}
          indikator={semuaIndikator.get(formManual.rubrikIndikatorId) ?? null}
          onTutup={() => setFormManual(null)}
        />
      ) : null}
    </Panel>
  )
}

function FormNilaiManual({
  jabatanTargetId,
  pegawaiId,
  namaKandidat,
  baris,
  indikator,
  onTutup,
}: {
  jabatanTargetId: number
  pegawaiId: number
  namaKandidat: string
  baris: BarisRincianSkor
  indikator: IndikatorRubrik | null
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})
  const [nilaiMentah, setNilaiMentah] = useState(baris.nilaiMentah ?? '')
  const [catatan, setCatatan] = useState(baris.catatan ?? '')

  const berambang = (indikator?.kategori ?? []).some(
    (k) => k.ambangMin !== null || k.ambangMax !== null,
  )
  const langsung = indikator?.modeSkor === 'NILAI_LANGSUNG'

  function simpan() {
    setGalat({})
    mulaiTransisi(async () => {
      const hasil = await simpanNilaiManual(jabatanTargetId, pegawaiId, baris.rubrikIndikatorId, {
        nilaiMentah,
        catatan,
      })
      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Disimpan.' })
        onTutup()
      } else {
        setGalat(hasil.galatField ?? {})
        if (!hasil.galatField) {
          tampilkan({ nada: 'bahaya', judul: 'Gagal menyimpan', keterangan: hasil.pesan })
        }
      }
    })
  }

  return (
    <Dialog
      buka
      onTutup={onTutup}
      judul={`Nilai manual — ${baris.namaIndikator}`}
      deskripsi={`Untuk ${namaKandidat}. Nilai yang diisi di sini menimpa hasil otomatis dan bertahan saat Hitung Ulang dijalankan.`}
      aksi={
        <>
          <Button variant="sekunder" size="sm" onClick={onTutup} disabled={pending}>
            Batal
          </Button>
          <Button size="sm" onClick={simpan} pending={pending} labelPending="Menyimpan…">
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <label className="block">
          <span className="mb-1 flex flex-wrap items-baseline gap-1.5">
            <span className="text-[12px] font-medium text-text">Nilai mentah</span>
            <span className="text-[10px] text-text-subtle">
              {langsung || berambang ? 'berupa angka' : 'harus sama dengan salah satu kategori'}
            </span>
          </span>
          {langsung || berambang ? (
            <input
              value={nilaiMentah}
              onChange={(e) => setNilaiMentah(e.target.value)}
              disabled={pending}
              inputMode="decimal"
              className={cn(
                'tabular h-9 w-full rounded-md border bg-surface px-2.5 text-[13px] text-text outline-none disabled:opacity-60',
                galat.nilaiMentah ? 'border-danger-border' : 'border-border focus:border-accent',
              )}
            />
          ) : (
            <select
              value={nilaiMentah}
              onChange={(e) => setNilaiMentah(e.target.value)}
              disabled={pending}
              className={cn(
                'h-9 w-full rounded-md border bg-surface px-2.5 text-[13px] text-text outline-none disabled:opacity-60',
                galat.nilaiMentah ? 'border-danger-border' : 'border-border focus:border-accent',
              )}
            >
              <option value="">— pilih kategori —</option>
              {(indikator?.kategori ?? []).map((k) => (
                <option key={k.id} value={k.namaKategori}>
                  {k.namaKategori} ({k.nilaiSkor === null ? '—' : formatSkor(k.nilaiSkor)})
                </option>
              ))}
            </select>
          )}
          {galat.nilaiMentah ? (
            <span role="alert" className="mt-1 block text-[11px] leading-relaxed text-danger">
              {galat.nilaiMentah}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1 flex items-baseline gap-1.5">
            <span className="text-[12px] font-medium text-text">Catatan</span>
            <span aria-hidden className="text-[12px] text-danger">
              *
            </span>
            <span className="text-[10px] text-text-subtle">dasar penilaiannya</span>
          </span>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            disabled={pending}
            rows={3}
            placeholder="mis. SK Plt. Kepala Balai nomor … tanggal …, berkas fisik ada di berkas kepegawaian"
            className={cn(
              'w-full rounded-md border bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-text outline-none disabled:opacity-60',
              galat.catatan ? 'border-danger-border' : 'border-border focus:border-accent',
            )}
          />
          {galat.catatan ? (
            <span role="alert" className="mt-1 block text-[11px] leading-relaxed text-danger">
              {galat.catatan}
            </span>
          ) : null}
        </label>

        <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-text-muted">
            Catatan wajib karena indikator yang diisi manusia adalah tempat penilaian menjadi
            subjektif — tanpa alasan tertulis, angkanya tidak bisa dipertanggungjawabkan. Nama
            pengisi ikut dicatat.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
