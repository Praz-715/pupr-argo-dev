'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { simpanKategori, simpanKomponen, simpanIndikator } from '@/lib/aksi/rubrik'
import { cn } from '@/lib/cn'
import type { IndikatorRubrik, KategoriRubrik, KomponenRubrik } from '@/lib/kueri/rubrik'
import { KUNCI_INDIKATOR, SUMBER_KUNCI, type KunciIndikator } from '@/lib/penilaian'

/**
 * Tiga form builder rubrik: Komponen · Indikator/Sub-indikator · Kategori Skor.
 *
 * **Bobot diketik dalam persen, disimpan sebagai rasio.** Rubrik di dokumen
 * ditulis "65%", "5%", jadi memaksa pengguna mengetik 0,65 adalah sumber salah
 * ketik yang menghasilkan rubrik sah tapi salah (bobot 0,65% tetap tersimpan
 * tanpa keluhan). Konversinya terjadi di satu tempat: di sini, saat kirim.
 */

const kelasInput = (galat?: string): string =>
  cn(
    'h-9 w-full rounded-md border bg-surface px-2.5 text-[13px] text-text outline-none transition-colors placeholder:text-text-subtle disabled:opacity-60',
    galat ? 'border-danger-border focus:border-danger' : 'border-border focus:border-accent',
  )

function Bidang({
  label,
  galat,
  keterangan,
  children,
}: {
  label: string
  galat?: string
  keterangan?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 flex flex-wrap items-baseline gap-1.5">
        <span className="text-[12px] font-medium text-text">{label}</span>
        {keterangan ? <span className="text-[10px] text-text-subtle">{keterangan}</span> : null}
      </span>
      {children}
      {galat ? (
        <span role="alert" className="mt-1 block text-[11px] leading-relaxed text-danger">
          {galat}
        </span>
      ) : null}
    </label>
  )
}

/** Persen (UI) → rasio (DB). Dibulatkan ke 4 desimal, sesuai DECIMAL(5,4). */
function keRasio(persen: string): number | null {
  const n = Number(persen)
  if (persen.trim() === '' || Number.isNaN(n)) return null
  return Math.round((n / 100) * 10000) / 10000
}

const kePersen = (rasio: number | null): string =>
  rasio === null ? '' : String(Math.round(rasio * 10000) / 100)

// ---------------------------------------------------------------------------

export function FormKomponen({
  jabatanTargetId,
  komponen,
  urutanBaru,
  onTutup,
}: {
  jabatanTargetId: number
  komponen: KomponenRubrik | null
  urutanBaru: number
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})

  const [sumbu, setSumbu] = useState(komponen?.sumbu ?? 'X_POTENSIAL')
  const [namaKomponen, setNamaKomponen] = useState(komponen?.namaKomponen ?? '')
  const [bobot, setBobot] = useState(kePersen(komponen?.bobot ?? null))
  const [urutan, setUrutan] = useState(String(komponen?.urutan ?? urutanBaru))

  function simpan() {
    setGalat({})
    mulaiTransisi(async () => {
      const hasil = await simpanKomponen(jabatanTargetId, komponen?.id ?? null, {
        sumbu,
        namaKomponen,
        bobot: keRasio(bobot) ?? 0,
        urutan: Number(urutan) || 1,
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
      judul={komponen === null ? 'Tambah komponen' : `Ubah "${komponen.namaKomponen}"`}
      deskripsi="Formula B mencari tiga komponennya dari NAMA: harus memuat kata “potensi”, “kualifikasi”, dan “integritas”. Komponen yang namanya tidak dikenali akan dihitung 0 pada match score."
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
        <Bidang label="Nama komponen" galat={galat.namaKomponen}>
          <input
            value={namaKomponen}
            onChange={(e) => setNamaKomponen(e.target.value)}
            disabled={pending}
            placeholder="mis. Potensi & Kompetensi"
            className={kelasInput(galat.namaKomponen)}
          />
        </Bidang>

        <div className="grid grid-cols-3 gap-3">
          <Bidang label="Sumbu" galat={galat.sumbu}>
            <select
              value={sumbu}
              onChange={(e) => setSumbu(e.target.value as KomponenRubrik['sumbu'])}
              disabled={pending}
              className={kelasInput(galat.sumbu)}
            >
              <option value="X_POTENSIAL">X — Potensial</option>
              <option value="Y_KINERJA">Y — Kinerja</option>
            </select>
          </Bidang>

          <Bidang label="Bobot (%)" galat={galat.bobot}>
            <input
              value={bobot}
              onChange={(e) => setBobot(e.target.value)}
              disabled={pending}
              inputMode="decimal"
              placeholder="65"
              className={cn(kelasInput(galat.bobot), 'tabular')}
            />
          </Bidang>

          <Bidang label="Urutan" galat={galat.urutan}>
            <input
              value={urutan}
              onChange={(e) => setUrutan(e.target.value)}
              disabled={pending}
              inputMode="numeric"
              className={cn(kelasInput(galat.urutan), 'tabular')}
            />
          </Bidang>
        </div>

        <p className="text-[11px] leading-relaxed text-text-subtle">
          Total bobot seluruh komponen dalam satu sumbu harus 100%. Rubrik jabatan target biasanya
          tidak punya komponen sumbu Y sama sekali — match score memang tidak mengandung unsur
          kinerja.
        </p>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------

export function FormIndikator({
  jabatanTargetId,
  komponenId,
  indikator,
  parentIndikator,
  urutanBaru,
  onTutup,
}: {
  jabatanTargetId: number
  komponenId: number
  indikator: IndikatorRubrik | null
  /** Terisi = sedang menambah/menyunting SUB-indikator. */
  parentIndikator: IndikatorRubrik | null
  urutanBaru: number
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})

  const sub = parentIndikator !== null
  const [namaIndikator, setNamaIndikator] = useState(indikator?.namaIndikator ?? '')
  const [kunci, setKunci] = useState<string>(indikator?.kunci ?? '')
  const [bobot, setBobot] = useState(kePersen(indikator?.bobot ?? null))
  const [modeSkor, setModeSkor] = useState(indikator?.modeSkor ?? 'KATEGORI_TETAP')
  const [kebutuhanData, setKebutuhanData] = useState(indikator?.kebutuhanData ?? '')
  const [sumberData, setSumberData] = useState(indikator?.sumberData ?? '')
  const [urutan, setUrutan] = useState(String(indikator?.urutan ?? urutanBaru))

  function simpan() {
    setGalat({})
    mulaiTransisi(async () => {
      const hasil = await simpanIndikator(
        jabatanTargetId,
        komponenId,
        indikator?.id ?? null,
        parentIndikator?.id ?? null,
        {
          namaIndikator,
          kunci: kunci === '' ? null : (kunci as KunciIndikator),
          bobot: sub ? null : keRasio(bobot),
          modeSkor,
          kebutuhanData: kebutuhanData.trim() === '' ? null : kebutuhanData,
          sumberData: sumberData.trim() === '' ? null : sumberData,
          urutan: Number(urutan) || 1,
        },
      )
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
      lebar="lg"
      judul={
        indikator === null
          ? sub
            ? `Tambah sub-indikator di bawah "${parentIndikator.namaIndikator}"`
            : 'Tambah indikator'
          : `Ubah "${indikator.namaIndikator}"`
      }
      deskripsi={
        sub
          ? 'Sub-indikator tidak berbobot: nilainya dirata-rata ke indikator induknya.'
          : 'Bobot seluruh indikator dalam satu komponen harus sama dengan bobot komponennya.'
      }
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
        <Bidang label="Nama indikator" galat={galat.namaIndikator}>
          <input
            value={namaIndikator}
            onChange={(e) => setNamaIndikator(e.target.value)}
            disabled={pending}
            placeholder="mis. Tingkat Pendidikan Formal"
            className={kelasInput(galat.namaIndikator)}
          />
        </Bidang>

        <Bidang
          label="Sumber data"
          galat={galat.kunci}
          keterangan="menentukan dari mana nilai mentahnya diambil"
        >
          <select
            value={kunci}
            onChange={(e) => setKunci(e.target.value)}
            disabled={pending}
            className={kelasInput(galat.kunci)}
          >
            <option value="">— Tanpa sumber otomatis (diisi manual) —</option>
            {KUNCI_INDIKATOR.map((k) => (
              <option key={k} value={k}>
                {SUMBER_KUNCI[k].label}
              </option>
            ))}
          </select>
        </Bidang>

        <div
          className={cn(
            'rounded-md border px-3 py-2.5',
            kunci === ''
              ? 'border-warning-border bg-warning-subtle'
              : 'border-border bg-surface-2',
          )}
        >
          <p className="text-[11px] leading-relaxed text-text-muted">
            {kunci === '' ? (
              <>
                <strong className="font-medium text-text">Tanpa sumber otomatis</strong>, nilai
                indikator ini harus diisi manusia per pegawai dari halaman Kandidat — sampai diisi,
                skornya 0 dan barisnya ditandai perlu ditinjau. Nama indikator bebas diubah tanpa
                memengaruhi perhitungan; yang menentukan adalah pilihan sumber data di atas.
              </>
            ) : (
              <>
                Diambil dari{' '}
                <span className="tabular text-text">{SUMBER_KUNCI[kunci as KunciIndikator].asal}</span>
              </>
            )}
          </p>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Bidang
            label="Bobot (%)"
            galat={galat.bobot}
            keterangan={sub ? 'tidak berlaku' : undefined}
          >
            <input
              value={sub ? '' : bobot}
              onChange={(e) => setBobot(e.target.value)}
              disabled={pending || sub}
              inputMode="decimal"
              placeholder={sub ? 'rata-rata' : '5'}
              className={cn(kelasInput(galat.bobot), 'tabular')}
            />
          </Bidang>

          <Bidang label="Mode skor" galat={galat.modeSkor}>
            <select
              value={modeSkor}
              onChange={(e) => setModeSkor(e.target.value as IndikatorRubrik['modeSkor'])}
              disabled={pending}
              className={kelasInput(galat.modeSkor)}
            >
              <option value="KATEGORI_TETAP">Kategori tetap</option>
              <option value="NILAI_LANGSUNG">Nilai langsung</option>
            </select>
          </Bidang>

          <Bidang label="Urutan" galat={galat.urutan}>
            <input
              value={urutan}
              onChange={(e) => setUrutan(e.target.value)}
              disabled={pending}
              inputMode="numeric"
              className={cn(kelasInput(galat.urutan), 'tabular')}
            />
          </Bidang>
        </div>

        <p className="text-[11px] leading-relaxed text-text-subtle">
          <strong className="font-medium text-text-muted">Kategori tetap</strong>: nilai mentah
          dicocokkan ke kategori, lalu skornya diambil dari kategori itu.{' '}
          <strong className="font-medium text-text-muted">Nilai langsung</strong>: nilai mentah
          dipakai apa adanya sebagai skor, kategori hanya jadi label klasifikasi (dipakai Potkom).
        </p>

        <Bidang
          label="Kebutuhan data"
          galat={galat.kebutuhanData}
          keterangan="opsional — catatan untuk tim data"
        >
          <textarea
            value={kebutuhanData}
            onChange={(e) => setKebutuhanData(e.target.value)}
            disabled={pending}
            rows={2}
            className={cn(kelasInput(galat.kebutuhanData), 'h-auto py-2 leading-relaxed')}
          />
        </Bidang>

        <Bidang label="Sistem sumber" galat={galat.sumberData} keterangan="opsional">
          <input
            value={sumberData}
            onChange={(e) => setSumberData(e.target.value)}
            disabled={pending}
            placeholder="mis. ehrm.pu.go.id/layanan-kepegawaian"
            className={kelasInput(galat.sumberData)}
          />
        </Bidang>
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------

export function FormKategori({
  jabatanTargetId,
  indikator,
  kategori,
  urutanBaru,
  onTutup,
}: {
  jabatanTargetId: number
  indikator: IndikatorRubrik
  kategori: KategoriRubrik | null
  urutanBaru: number
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})

  const [namaKategori, setNamaKategori] = useState(kategori?.namaKategori ?? '')
  const [nilaiSkor, setNilaiSkor] = useState(
    kategori?.nilaiSkor === null || kategori?.nilaiSkor === undefined
      ? ''
      : String(kategori.nilaiSkor),
  )
  const [ambangMin, setAmbangMin] = useState(
    kategori?.ambangMin === null || kategori?.ambangMin === undefined ? '' : String(kategori.ambangMin),
  )
  const [ambangMax, setAmbangMax] = useState(
    kategori?.ambangMax === null || kategori?.ambangMax === undefined ? '' : String(kategori.ambangMax),
  )
  const [urutan, setUrutan] = useState(String(kategori?.urutan ?? urutanBaru))

  const angkaAtauNull = (t: string): number | null => {
    if (t.trim() === '') return null
    const n = Number(t)
    return Number.isNaN(n) ? null : n
  }

  function simpan() {
    setGalat({})
    mulaiTransisi(async () => {
      const hasil = await simpanKategori(jabatanTargetId, indikator.id, kategori?.id ?? null, {
        namaKategori,
        nilaiSkor: angkaAtauNull(nilaiSkor),
        ambangMin: angkaAtauNull(ambangMin),
        ambangMax: angkaAtauNull(ambangMax),
        urutan: Number(urutan) || 1,
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

  const langsung = indikator.modeSkor === 'NILAI_LANGSUNG'

  return (
    <Dialog
      buka
      onTutup={onTutup}
      judul={kategori === null ? 'Tambah kategori skor' : `Ubah "${kategori.namaKategori}"`}
      deskripsi={`Indikator "${indikator.namaIndikator}" · mode ${langsung ? 'nilai langsung' : 'kategori tetap'}`}
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
        <Bidang label="Nama kategori" galat={galat.namaKategori}>
          <input
            value={namaKategori}
            onChange={(e) => setNamaKategori(e.target.value)}
            disabled={pending}
            placeholder="mis. Memiliki masa kerja 5 tahun ke atas"
            className={kelasInput(galat.namaKategori)}
          />
        </Bidang>

        <div className="grid grid-cols-2 gap-3">
          <Bidang
            label="Nilai skor"
            galat={galat.nilaiSkor}
            keterangan={langsung ? 'tidak dipakai — skor = nilai mentah' : '0–100, wajib'}
          >
            <input
              value={nilaiSkor}
              onChange={(e) => setNilaiSkor(e.target.value)}
              disabled={pending || langsung}
              inputMode="decimal"
              placeholder={langsung ? '—' : '100'}
              className={cn(kelasInput(galat.nilaiSkor), 'tabular')}
            />
          </Bidang>

          <Bidang label="Urutan" galat={galat.urutan}>
            <input
              value={urutan}
              onChange={(e) => setUrutan(e.target.value)}
              disabled={pending}
              inputMode="numeric"
              className={cn(kelasInput(galat.urutan), 'tabular')}
            />
          </Bidang>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Bidang label="Ambang bawah" galat={galat.ambangMin} keterangan="kosong = tanpa batas">
            <input
              value={ambangMin}
              onChange={(e) => setAmbangMin(e.target.value)}
              disabled={pending}
              inputMode="decimal"
              placeholder="80"
              className={cn(kelasInput(galat.ambangMin), 'tabular')}
            />
          </Bidang>

          <Bidang label="Ambang atas" galat={galat.ambangMax} keterangan="kosong = tanpa batas">
            <input
              value={ambangMax}
              onChange={(e) => setAmbangMax(e.target.value)}
              disabled={pending}
              inputMode="decimal"
              placeholder="kosong"
              className={cn(kelasInput(galat.ambangMax), 'tabular')}
            />
          </Bidang>
        </div>

        <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-text-muted">
            Ambang ditulis <strong className="font-medium text-text">inklusif di bawah,
            eksklusif di atas</strong>: rentang &ldquo;≥60 sampai &lt;80&rdquo; diisi bawah 60 dan
            atas 80. Kategori tertinggi dikosongkan ambang atasnya, kategori terendah dikosongkan
            ambang bawahnya — kalau tidak, nilai di luar rentang akan jatuh ke kategori terdekat dan
            ditandai perlu ditinjau.
          </p>
        </div>

        {langsung ? (
          <p className="text-[11px] leading-relaxed text-text-subtle">
            Pada mode nilai langsung, kategori hanya memberi label pada rentang nilai (mis. Potkom
            ≥80 = &ldquo;Memenuhi Syarat&rdquo;). Skornya tetap nilai mentahnya.
          </p>
        ) : null}
      </div>
    </Dialog>
  )
}
