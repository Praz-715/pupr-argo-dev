'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { buatJabatan, ubahJabatan } from '@/lib/aksi/jabatan'
import type { BarisJabatan } from '@/lib/kueri/master'

const JENIS_JABATAN = [
  { nilai: 'STRUKTURAL', label: 'Struktural' },
  { nilai: 'FUNGSIONAL_TERTENTU', label: 'Fungsional Tertentu' },
  { nilai: 'FUNGSIONAL_UMUM', label: 'Fungsional Umum' },
]

const ESELON = [
  { nilai: 'I', label: 'Eselon I' },
  { nilai: 'II', label: 'Eselon II' },
  { nilai: 'III', label: 'Eselon III' },
  { nilai: 'IV', label: 'Eselon IV' },
  { nilai: 'NON_ESELON', label: 'Non-eselon' },
]

const STATUS = [
  { nilai: 'TERISI', label: 'Terisi' },
  { nilai: 'KOSONG', label: 'Kosong' },
  { nilai: 'DIHAPUS', label: 'Diarsipkan' },
]

export function FormJabatan({
  jabatan,
  opsiUnit,
  onTutup,
}: {
  /** null = buat baru. */
  jabatan: BarisJabatan | null
  opsiUnit: Array<{ id: number; nama: string; kedalaman: number }>
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})

  const [kodeJabatan, setKode] = useState(jabatan?.kodeJabatan ?? '')
  const [namaJabatan, setNama] = useState(jabatan?.namaJabatan ?? '')
  const [unitId, setUnitId] = useState(String(jabatan?.unitOrganisasiId ?? opsiUnit[0]?.id ?? ''))
  const [jenisJabatan, setJenis] = useState(jabatan?.jenisJabatan ?? 'STRUKTURAL')
  const [jenjang, setJenjang] = useState(jabatan?.jenjang ?? '')
  const [eselon, setEselon] = useState(jabatan?.eselon ?? 'NON_ESELON')
  const [statusJabatan, setStatus] = useState(jabatan?.statusJabatan ?? 'KOSONG')

  const adaPenghuni = (jabatan?.jumlahPenghuni ?? 0) > 0

  function simpan() {
    setGalat({})
    const masukan = {
      kodeJabatan,
      namaJabatan,
      unitOrganisasiId: unitId === '' ? 0 : Number(unitId),
      jenisJabatan,
      jenjang,
      eselon,
      statusJabatan,
    }

    mulaiTransisi(async () => {
      const hasil = jabatan
        ? await ubahJabatan(jabatan.id, masukan)
        : await buatJabatan(masukan)

      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Jabatan disimpan.' })
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
      judul={jabatan ? `Ubah "${jabatan.namaJabatan}"` : 'Tambah jabatan'}
      deskripsi={
        adaPenghuni
          ? `Jabatan ini ditempati ${jabatan!.jumlahPenghuni} pegawai aktif — statusnya tidak bisa diubah menjadi kosong.`
          : 'Status kosong membuat jabatan ini muncul di halaman Risiko Kekosongan dan widget dashboard.'
      }
      lebar="lg"
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
        <div className="grid gap-3.5 sm:grid-cols-[1fr_2fr]">
          <Bidang label="Kode jabatan" galat={galat.kodeJabatan} wajib>
            <input
              value={kodeJabatan}
              onChange={(e) => setKode(e.target.value)}
              disabled={pending}
              placeholder="mis. JAB-KASI-PBJ"
              className={kelasInput(galat.kodeJabatan)}
            />
          </Bidang>
          <Bidang label="Nama jabatan" galat={galat.namaJabatan} wajib>
            <input
              value={namaJabatan}
              onChange={(e) => setNama(e.target.value)}
              disabled={pending}
              placeholder="mis. Kepala Seksi Pengadaan"
              className={kelasInput(galat.namaJabatan)}
            />
          </Bidang>
        </div>

        <Bidang label="Unit organisasi" galat={galat.unitOrganisasiId} wajib>
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            disabled={pending}
            className={kelasInput(galat.unitOrganisasiId)}
          >
            {opsiUnit.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {'  '.repeat(o.kedalaman)}
                {o.nama}
              </option>
            ))}
          </select>
        </Bidang>

        <div className="grid gap-3.5 sm:grid-cols-3">
          <Bidang label="Jenis jabatan" galat={galat.jenisJabatan} wajib>
            <select
              value={jenisJabatan}
              onChange={(e) => setJenis(e.target.value)}
              disabled={pending}
              className={kelasInput(galat.jenisJabatan)}
            >
              {JENIS_JABATAN.map((j) => (
                <option key={j.nilai} value={j.nilai}>
                  {j.label}
                </option>
              ))}
            </select>
          </Bidang>

          <Bidang label="Eselon" galat={galat.eselon} wajib>
            <select
              value={eselon}
              onChange={(e) => setEselon(e.target.value)}
              disabled={pending}
              className={kelasInput(galat.eselon)}
            >
              {ESELON.map((e2) => (
                <option key={e2.nilai} value={e2.nilai}>
                  {e2.label}
                </option>
              ))}
            </select>
          </Bidang>

          <Bidang
            label="Jenjang"
            galat={galat.jenjang}
            wajib
            keterangan="mis. Administrator, Ahli Muda"
          >
            <input
              value={jenjang}
              onChange={(e) => setJenjang(e.target.value)}
              disabled={pending}
              className={kelasInput(galat.jenjang)}
            />
          </Bidang>
        </div>

        <Bidang
          label="Status jabatan"
          galat={galat.statusJabatan}
          wajib
          keterangan={adaPenghuni ? 'kosong tidak tersedia — masih ditempati' : undefined}
        >
          <select
            value={statusJabatan}
            onChange={(e) => setStatus(e.target.value)}
            disabled={pending}
            className={kelasInput(galat.statusJabatan)}
          >
            {STATUS.map((s) => (
              <option
                key={s.nilai}
                value={s.nilai}
                // Opsi yang pasti ditolak server dinonaktifkan di sini juga —
                // membiarkannya bisa dipilih berarti mengundang galat yang sudah
                // pasti terjadi.
                disabled={s.nilai === 'KOSONG' && adaPenghuni}
              >
                {s.label}
                {s.nilai === 'KOSONG' && adaPenghuni ? ' — masih ditempati' : ''}
              </option>
            ))}
          </select>
        </Bidang>
      </div>
    </Dialog>
  )
}

function kelasInput(galat?: string): string {
  return cn(
    'h-9 w-full rounded-md border bg-surface px-2.5 text-[13px] text-text outline-none transition-colors placeholder:text-text-subtle disabled:opacity-60',
    galat ? 'border-danger-border focus:border-danger' : 'border-border focus:border-accent',
  )
}

function Bidang({
  label,
  galat,
  wajib,
  keterangan,
  children,
}: {
  label: string
  galat?: string
  wajib?: boolean
  keterangan?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1 flex flex-wrap items-baseline gap-1.5">
        <span className="text-[12px] font-medium text-text">{label}</span>
        {wajib ? (
          <span aria-hidden className="text-[12px] text-danger">
            *
          </span>
        ) : null}
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
