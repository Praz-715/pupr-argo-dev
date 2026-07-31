'use client'

import {
  ChevronDown,
  ChevronUp,
  Copy,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
} from 'lucide-react'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DialogKonfirmasi } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { useToast } from '@/components/ui/toast'
import { duplikasiRubrik } from '@/lib/aksi/jabatan-target'
import { geserUrutan, hapusIndikator, hapusKategori, hapusKomponen } from '@/lib/aksi/rubrik'
import { cn } from '@/lib/cn'
import { formatBobot, formatSkor } from '@/lib/format'
import type { IndikatorRubrik, KategoriRubrik, KomponenRubrik } from '@/lib/kueri/rubrik'
import { SUMBER_KUNCI } from '@/lib/penilaian'
import { FormIndikator, FormKategori, FormKomponen } from './form-rubrik'

/**
 * Tab 3 — Rubrik Penilaian: builder Komponen → Indikator → Sub-indikator →
 * Kategori Skor.
 *
 * Bentuknya pohon, bukan tabel: bobot indikator hanya bermakna **relatif terhadap
 * komponen induknya** (4 indikator @5% itu benar di komponen 20%, salah di
 * komponen 15%), dan sub-indikator sama sekali tidak berbobot. Tabel datar akan
 * menyandingkan angka-angka yang tidak sebanding.
 *
 * Total bobot dihitung ulang di klien dan ditampilkan per komponen & per sumbu,
 * jadi pengguna melihat "95%" saat sedang mengetik — bukan setelah menyimpan lalu
 * menunggu panel pemeriksaan di atas ikut menyegar.
 */
export function TabRubrik({
  jabatanTargetId,
  komponen,
  sumberDuplikasi,
  bolehUbah,
}: {
  jabatanTargetId: number
  komponen: KomponenRubrik[]
  sumberDuplikasi: Array<{ id: number; nama: string; jumlahKomponen: number }>
  bolehUbah: boolean
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()

  const [formKomponen, setFormKomponen] = useState<KomponenRubrik | null | 'baru'>(null)
  const [formIndikator, setFormIndikator] = useState<{
    komponenId: number
    indikator: IndikatorRubrik | null
    parent: IndikatorRubrik | null
    urutanBaru: number
  } | null>(null)
  const [formKategori, setFormKategori] = useState<{
    indikator: IndikatorRubrik
    kategori: KategoriRubrik | null
    urutanBaru: number
  } | null>(null)
  const [hapus, setHapus] = useState<
    | { jenis: 'KOMPONEN'; id: number; nama: string; keterangan: string }
    | { jenis: 'INDIKATOR'; id: number; nama: string; keterangan: string }
    | { jenis: 'KATEGORI'; id: number; nama: string; keterangan: string }
    | null
  >(null)

  const totalPerSumbu = new Map<string, number>()
  for (const k of komponen) {
    totalPerSumbu.set(k.sumbu, (totalPerSumbu.get(k.sumbu) ?? 0) + k.bobot)
  }

  function jalankanHapus() {
    if (hapus === null) return
    mulaiTransisi(async () => {
      const hasil =
        hapus.jenis === 'KOMPONEN'
          ? await hapusKomponen(jabatanTargetId, hapus.id)
          : hapus.jenis === 'INDIKATOR'
            ? await hapusIndikator(jabatanTargetId, hapus.id)
            : await hapusKategori(jabatanTargetId, hapus.id)
      setHapus(null)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Dihapus.' }
          : { nada: 'bahaya', judul: 'Gagal menghapus', keterangan: hasil.pesan },
      )
    })
  }

  function geser(jenis: 'KOMPONEN' | 'INDIKATOR' | 'KATEGORI', id: number, arah: 'NAIK' | 'TURUN') {
    mulaiTransisi(async () => {
      const hasil = await geserUrutan(jabatanTargetId, jenis, id, arah)
      if (!hasil.ok) {
        tampilkan({ nada: 'bahaya', judul: 'Gagal mengurutkan', keterangan: hasil.pesan })
      }
    })
  }

  if (komponen.length === 0) {
    return (
      <div className="space-y-4">
        <EmptyState
          judul="Rubrik belum disusun"
          deskripsi="Tanpa rubrik, match score setiap kandidat bernilai 0. Susun dari nol, atau salin dari jabatan target lain yang rubriknya sudah lolos pemeriksaan."
          ikon={<SlidersHorizontal className="size-5" />}
          aksi={
            bolehUbah ? (
              <Button size="sm" onClick={() => setFormKomponen('baru')} ikon={<Plus className="size-4" />}>
                Tambah komponen pertama
              </Button>
            ) : null
          }
        />

        {bolehUbah && sumberDuplikasi.length > 0 ? (
          <PanelDuplikasi
            jabatanTargetId={jabatanTargetId}
            sumber={sumberDuplikasi}
            pending={pending}
          />
        ) : null}

        {formKomponen !== null ? (
          <FormKomponen
            jabatanTargetId={jabatanTargetId}
            komponen={null}
            urutanBaru={1}
            onTutup={() => setFormKomponen(null)}
          />
        ) : null}
      </div>
    )
  }

  return (
    <div className={cn('space-y-4', pending && 'opacity-70')}>
      {/* Ringkasan bobot per sumbu — dihitung ulang di klien */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2 px-3.5 py-2.5">
        {[...totalPerSumbu.entries()].map(([sumbu, total]) => {
          const pas = Math.abs(total - 1) <= 0.0001
          return (
            <span key={sumbu} className="flex items-center gap-1.5 text-[12px]">
              <span className="text-text-subtle">
                {sumbu === 'X_POTENSIAL' ? 'Sumbu X (Potensial)' : 'Sumbu Y (Kinerja)'}
              </span>
              <span
                className={cn(
                  'tabular font-medium',
                  pas ? 'text-success' : 'text-danger',
                )}
              >
                {formatBobot(total)}
              </span>
              {!pas ? <TriangleAlert className="size-3 text-danger" /> : null}
            </span>
          )
        })}
        <span className="ml-auto text-[11px] text-text-subtle">
          Total bobot komponen per sumbu harus 100%
        </span>
        {bolehUbah ? (
          <Button
            size="sm"
            variant="sekunder"
            onClick={() => setFormKomponen('baru')}
            ikon={<Plus className="size-3.5" />}
          >
            Komponen
          </Button>
        ) : null}
      </div>

      {komponen.map((k) => {
        const totalIndikator = k.indikator.reduce((n, i) => n + (i.bobot ?? 0), 0)
        const bobotPas = Math.abs(totalIndikator - k.bobot) <= 0.0001

        return (
          <Panel key={k.id} padat>
            <div className="border-b border-border px-3.5 py-3">
              <PanelHeader
                judul={
                  <span className="flex flex-wrap items-center gap-2">
                    {k.namaKomponen}
                    <Badge tone="aksen">
                      <span className="tabular">{formatBobot(k.bobot)}</span>
                    </Badge>
                    {k.sumbu === 'Y_KINERJA' ? <Badge tone="netral">sumbu Y</Badge> : null}
                  </span>
                }
                deskripsi={
                  <span className={bobotPas ? undefined : 'text-danger'}>
                    {k.indikator.length} indikator · total bobot {formatBobot(totalIndikator)}
                    {bobotPas
                      ? ' (sama dengan bobot komponen)'
                      : ` — seharusnya ${formatBobot(k.bobot)}`}
                  </span>
                }
                aksi={
                  bolehUbah ? (
                    <>
                      <Button
                        size="ikon"
                        variant="halus"
                        onClick={() => geser('KOMPONEN', k.id, 'NAIK')}
                        aria-label={`Naikkan urutan ${k.namaKomponen}`}
                      >
                        <ChevronUp className="size-3.5" />
                      </Button>
                      <Button
                        size="ikon"
                        variant="halus"
                        onClick={() => geser('KOMPONEN', k.id, 'TURUN')}
                        aria-label={`Turunkan urutan ${k.namaKomponen}`}
                      >
                        <ChevronDown className="size-3.5" />
                      </Button>
                      <Button
                        size="ikon"
                        variant="halus"
                        onClick={() => setFormKomponen(k)}
                        aria-label={`Ubah ${k.namaKomponen}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="ikon"
                        variant="halus"
                        onClick={() =>
                          setHapus({
                            jenis: 'KOMPONEN',
                            id: k.id,
                            nama: k.namaKomponen,
                            keterangan: `${k.indikator.length} indikator beserta kategori skornya ikut terhapus, begitu juga baris rincian skor yang menunjuk indikator itu.`,
                          })
                        }
                        aria-label={`Hapus ${k.namaKomponen}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </>
                  ) : null
                }
              />
            </div>

            {k.indikator.length === 0 ? (
              <div className="px-3.5 py-4">
                <p className="text-[12px] text-warning">
                  Komponen ini belum punya indikator, jadi skornya selalu 0.
                </p>
                {bolehUbah ? (
                  <Button
                    size="sm"
                    variant="sekunder"
                    className="mt-2"
                    onClick={() =>
                      setFormIndikator({
                        komponenId: k.id,
                        indikator: null,
                        parent: null,
                        urutanBaru: 1,
                      })
                    }
                    ikon={<Plus className="size-3.5" />}
                  >
                    Tambah indikator
                  </Button>
                ) : null}
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {k.indikator.map((i) => (
                  <BarisIndikator
                    key={i.id}
                    komponen={k}
                    indikator={i}
                    bolehUbah={bolehUbah}
                    onUbah={() =>
                      setFormIndikator({
                        komponenId: k.id,
                        indikator: i,
                        parent: null,
                        urutanBaru: i.urutan,
                      })
                    }
                    onTambahSub={() =>
                      setFormIndikator({
                        komponenId: k.id,
                        indikator: null,
                        parent: i,
                        urutanBaru: i.anak.length + 1,
                      })
                    }
                    onUbahSub={(anak) =>
                      setFormIndikator({
                        komponenId: k.id,
                        indikator: anak,
                        parent: i,
                        urutanBaru: anak.urutan,
                      })
                    }
                    onTambahKategori={(node) =>
                      setFormKategori({
                        indikator: node,
                        kategori: null,
                        urutanBaru: node.kategori.length + 1,
                      })
                    }
                    onUbahKategori={(node, s) =>
                      setFormKategori({ indikator: node, kategori: s, urutanBaru: s.urutan })
                    }
                    onHapus={setHapus}
                    onGeser={geser}
                  />
                ))}
              </ul>
            )}

            {bolehUbah && k.indikator.length > 0 ? (
              <div className="border-t border-border px-3.5 py-2.5">
                <Button
                  size="sm"
                  variant="halus"
                  onClick={() =>
                    setFormIndikator({
                      komponenId: k.id,
                      indikator: null,
                      parent: null,
                      urutanBaru: k.indikator.length + 1,
                    })
                  }
                  ikon={<Plus className="size-3.5" />}
                >
                  Tambah indikator di komponen ini
                </Button>
              </div>
            ) : null}
          </Panel>
        )
      })}

      {formKomponen !== null ? (
        <FormKomponen
          jabatanTargetId={jabatanTargetId}
          komponen={formKomponen === 'baru' ? null : formKomponen}
          urutanBaru={komponen.length + 1}
          onTutup={() => setFormKomponen(null)}
        />
      ) : null}

      {formIndikator !== null ? (
        <FormIndikator
          jabatanTargetId={jabatanTargetId}
          komponenId={formIndikator.komponenId}
          indikator={formIndikator.indikator}
          parentIndikator={formIndikator.parent}
          urutanBaru={formIndikator.urutanBaru}
          onTutup={() => setFormIndikator(null)}
        />
      ) : null}

      {formKategori !== null ? (
        <FormKategori
          jabatanTargetId={jabatanTargetId}
          indikator={formKategori.indikator}
          kategori={formKategori.kategori}
          urutanBaru={formKategori.urutanBaru}
          onTutup={() => setFormKategori(null)}
        />
      ) : null}

      <DialogKonfirmasi
        buka={hapus !== null}
        onTutup={() => setHapus(null)}
        onKonfirmasi={jalankanHapus}
        pending={pending}
        destruktif
        judul={hapus === null ? '' : `Hapus "${hapus.nama}"?`}
        deskripsi={hapus?.keterangan}
        labelKonfirmasi="Hapus"
      />
    </div>
  )
}

type PenandaHapus =
  | { jenis: 'KOMPONEN'; id: number; nama: string; keterangan: string }
  | { jenis: 'INDIKATOR'; id: number; nama: string; keterangan: string }
  | { jenis: 'KATEGORI'; id: number; nama: string; keterangan: string }

function BarisIndikator({
  komponen,
  indikator,
  bolehUbah,
  onUbah,
  onTambahSub,
  onUbahSub,
  onTambahKategori,
  onUbahKategori,
  onHapus,
  onGeser,
}: {
  komponen: KomponenRubrik
  indikator: IndikatorRubrik
  bolehUbah: boolean
  onUbah: () => void
  onTambahSub: () => void
  onUbahSub: (anak: IndikatorRubrik) => void
  onTambahKategori: (node: IndikatorRubrik) => void
  onUbahKategori: (node: IndikatorRubrik, kategori: KategoriRubrik) => void
  onHapus: (p: PenandaHapus) => void
  onGeser: (jenis: 'KOMPONEN' | 'INDIKATOR' | 'KATEGORI', id: number, arah: 'NAIK' | 'TURUN') => void
}) {
  const [buka, setBuka] = useState(false)
  const agregator = indikator.anak.length > 0

  return (
    <li className="px-3.5 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px] font-medium text-text">{indikator.namaIndikator}</span>
            {indikator.bobot === null ? (
              <Badge tone="netral" title="Sub-indikator: dirata-rata ke induknya">
                rata-rata
              </Badge>
            ) : (
              <Badge tone="aksen">
                <span className="tabular">{formatBobot(indikator.bobot)}</span>
              </Badge>
            )}
            {agregator ? (
              <Badge tone="netral" title="Nilainya rata-rata sub-indikatornya">
                agregator · {indikator.anak.length} sub
              </Badge>
            ) : null}
            {indikator.modeSkor === 'NILAI_LANGSUNG' ? (
              <Badge tone="netral">nilai langsung</Badge>
            ) : null}
            {indikator.kunci === null && !agregator ? (
              <Badge tone="peringatan" title="Nilainya harus diisi manusia per pegawai">
                manual
              </Badge>
            ) : null}
          </div>

          <p className="mt-1 text-[11px] leading-relaxed text-text-subtle">
            {agregator ? (
              <>Nilainya rata-rata dari {indikator.anak.length} sub-indikator di bawahnya.</>
            ) : indikator.kunci === null ? (
              <>Tanpa sumber otomatis — nilainya diisi manusia dari halaman Kandidat.</>
            ) : (
              <>
                Sumber: <span className="tabular">{SUMBER_KUNCI[indikator.kunci].asal}</span>
              </>
            )}
            {!agregator ? (
              <>
                {' · '}
                {indikator.kategori.length === 0 ? (
                  <span className="text-warning">belum ada kategori skor</span>
                ) : (
                  `${indikator.kategori.length} kategori skor`
                )}
              </>
            ) : null}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!agregator || indikator.kategori.length > 0 ? (
            <Button
              size="sm"
              variant="halus"
              onClick={() => setBuka(!buka)}
              aria-expanded={buka}
              className="text-[11px]"
            >
              {buka ? 'Sembunyikan' : 'Kategori'}
            </Button>
          ) : null}
          {bolehUbah ? (
            <>
              <Button
                size="ikon"
                variant="halus"
                onClick={() => onGeser('INDIKATOR', indikator.id, 'NAIK')}
                aria-label={`Naikkan urutan ${indikator.namaIndikator}`}
              >
                <ChevronUp className="size-3.5" />
              </Button>
              <Button
                size="ikon"
                variant="halus"
                onClick={() => onGeser('INDIKATOR', indikator.id, 'TURUN')}
                aria-label={`Turunkan urutan ${indikator.namaIndikator}`}
              >
                <ChevronDown className="size-3.5" />
              </Button>
              <Button
                size="ikon"
                variant="halus"
                onClick={onUbah}
                aria-label={`Ubah ${indikator.namaIndikator}`}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                size="ikon"
                variant="halus"
                onClick={() =>
                  onHapus({
                    jenis: 'INDIKATOR',
                    id: indikator.id,
                    nama: indikator.namaIndikator,
                    keterangan: agregator
                      ? `${indikator.anak.length} sub-indikator di bawahnya ikut terhapus. Sisa bobot komponen "${komponen.namaKomponen}" perlu dirapikan setelahnya.`
                      : `Kategori skornya ikut terhapus. Sisa bobot komponen "${komponen.namaKomponen}" perlu dirapikan setelahnya.`,
                  })
                }
                aria-label={`Hapus ${indikator.namaIndikator}`}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Kategori skor */}
      {buka ? (
        <div className="mt-2.5 rounded-md border border-border bg-surface-2 p-2.5">
          {indikator.kategori.length === 0 ? (
            <p className="text-[11px] text-text-subtle">
              Belum ada kategori skor.{' '}
              {indikator.modeSkor === 'KATEGORI_TETAP'
                ? 'Pada mode kategori tetap, itu berarti skornya selalu 0.'
                : 'Pada mode nilai langsung, skornya tetap terhitung tapi tanpa label klasifikasi.'}
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="text-left text-[10px] tracking-wide text-text-subtle uppercase">
                  <th className="pb-1.5 pr-2 font-medium">Kategori</th>
                  <th className="px-2 pb-1.5 text-right font-medium">Skor</th>
                  <th className="px-2 pb-1.5 text-right font-medium">Ambang</th>
                  {bolehUbah ? <th className="pb-1.5 pl-2" /> : null}
                </tr>
              </thead>
              <tbody>
                {indikator.kategori.map((s) => (
                  <tr key={s.id} className="border-t border-border">
                    <td className="py-1.5 pr-2 text-text-muted">{s.namaKategori}</td>
                    <td className="tabular px-2 py-1.5 text-right text-text">
                      {s.nilaiSkor === null ? (
                        <span className="text-text-subtle" title="Mode nilai langsung: skor = nilai mentah">
                          —
                        </span>
                      ) : (
                        formatSkor(s.nilaiSkor)
                      )}
                    </td>
                    <td className="tabular px-2 py-1.5 text-right text-text-subtle">
                      {s.ambangMin === null && s.ambangMax === null
                        ? 'label'
                        : `${s.ambangMin ?? '−∞'} … ${s.ambangMax ?? '∞'}`}
                    </td>
                    {bolehUbah ? (
                      <td className="py-1 pl-2">
                        <div className="flex justify-end gap-0.5">
                          <Button
                            size="ikon"
                            variant="halus"
                            onClick={() => onGeser('KATEGORI', s.id, 'NAIK')}
                            aria-label={`Naikkan urutan ${s.namaKategori}`}
                          >
                            <ChevronUp className="size-3" />
                          </Button>
                          <Button
                            size="ikon"
                            variant="halus"
                            onClick={() => onUbahKategori(indikator, s)}
                            aria-label={`Ubah ${s.namaKategori}`}
                          >
                            <Pencil className="size-3" />
                          </Button>
                          <Button
                            size="ikon"
                            variant="halus"
                            onClick={() =>
                              onHapus({
                                jenis: 'KATEGORI',
                                id: s.id,
                                nama: s.namaKategori,
                                keterangan:
                                  indikator.kategori.length === 1
                                    ? 'Ini kategori terakhir pada indikator itu — setelah dihapus, skornya akan 0 sampai kategori baru ditambahkan.'
                                    : 'Nilai yang tadinya masuk kategori ini akan jatuh ke kategori terdekat di bawah dan ditandai perlu ditinjau.',
                              })
                            }
                            aria-label={`Hapus ${s.namaKategori}`}
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        </div>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {bolehUbah ? (
            <Button
              size="sm"
              variant="halus"
              className="mt-2"
              onClick={() => onTambahKategori(indikator)}
              ikon={<Plus className="size-3.5" />}
            >
              Tambah kategori
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Sub-indikator */}
      {indikator.anak.length > 0 ? (
        <ul className="mt-2.5 space-y-1.5 border-l-2 border-border pl-3">
          {indikator.anak.map((anak) => (
            <li key={anak.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[12px] text-text-muted">{anak.namaIndikator}</span>
                <span className="mt-0.5 block text-[10px] text-text-subtle">
                  {anak.kunci === null ? (
                    <span className="text-warning">tanpa sumber otomatis</span>
                  ) : (
                    SUMBER_KUNCI[anak.kunci].label
                  )}
                  {' · '}
                  {anak.kategori.length === 0 ? (
                    <span className="text-warning">belum ada kategori</span>
                  ) : (
                    `${anak.kategori.length} kategori`
                  )}
                </span>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  size="ikon"
                  variant="halus"
                  onClick={() => onTambahKategori(anak)}
                  aria-label={`Kategori ${anak.namaIndikator}`}
                  title="Kelola kategori skor"
                >
                  <SlidersHorizontal className="size-3" />
                </Button>
                {bolehUbah ? (
                  <>
                    <Button
                      size="ikon"
                      variant="halus"
                      onClick={() => onUbahSub(anak)}
                      aria-label={`Ubah ${anak.namaIndikator}`}
                    >
                      <Pencil className="size-3" />
                    </Button>
                    <Button
                      size="ikon"
                      variant="halus"
                      onClick={() =>
                        onHapus({
                          jenis: 'INDIKATOR',
                          id: anak.id,
                          nama: anak.namaIndikator,
                          keterangan: `Sub-indikator ini dirata-rata ke "${indikator.namaIndikator}"; setelah dihapus, rata-ratanya dihitung dari ${indikator.anak.length - 1} sub-indikator yang tersisa.`,
                        })
                      }
                      aria-label={`Hapus ${anak.namaIndikator}`}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      {bolehUbah && !agregator && indikator.kategori.length === 0 ? null : null}

      {bolehUbah ? (
        <Button
          size="sm"
          variant="halus"
          className="mt-2 text-[11px]"
          onClick={onTambahSub}
          ikon={<Plus className="size-3" />}
        >
          {agregator ? 'Tambah sub-indikator' : 'Jadikan agregator (tambah sub-indikator)'}
        </Button>
      ) : null}
    </li>
  )
}

function PanelDuplikasi({
  jabatanTargetId,
  sumber,
  pending,
}: {
  jabatanTargetId: number
  sumber: Array<{ id: number; nama: string; jumlahKomponen: number }>
  pending: boolean
}) {
  const { tampilkan } = useToast()
  const [dari, setDari] = useState(String(sumber[0]?.id ?? ''))
  const [menyalin, mulaiTransisi] = useTransition()

  function salin() {
    mulaiTransisi(async () => {
      const hasil = await duplikasiRubrik(jabatanTargetId, Number(dari))
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Rubrik disalin.' }
          : { nada: 'bahaya', judul: 'Gagal menyalin', keterangan: hasil.pesan },
      )
    })
  }

  return (
    <Panel>
      <PanelHeader
        judul="Salin rubrik dari jabatan target lain"
        deskripsi="Menyusun rubrik 65/20/15 dari nol berarti mengetik 9 indikator dan puluhan ambang; menyalin dari rubrik yang sudah lolos pemeriksaan jauh lebih kecil risikonya."
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={dari}
          onChange={(e) => setDari(e.target.value)}
          disabled={pending || menyalin}
          aria-label="Jabatan target sumber"
          className="h-9 min-w-64 rounded-md border border-border bg-surface px-2.5 text-[13px] text-text outline-none focus:border-accent disabled:opacity-60"
        >
          {sumber.map((s) => (
            <option key={s.id} value={String(s.id)}>
              {s.nama} ({s.jumlahKomponen} komponen)
            </option>
          ))}
        </select>
        <Button
          size="sm"
          variant="sekunder"
          onClick={salin}
          pending={menyalin}
          labelPending="Menyalin…"
          ikon={<Copy className="size-3.5" />}
        >
          Salin rubrik
        </Button>
      </div>
    </Panel>
  )
}
