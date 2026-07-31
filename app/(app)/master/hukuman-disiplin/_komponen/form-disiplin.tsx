'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { buatHukuman, ubahHukuman } from '@/lib/aksi/hukuman-disiplin'
import type { BarisDisiplin } from '@/lib/kueri/disiplin'
import { SKOR_INTEGRITAS, type TingkatHukuman } from '@/lib/scoring'

const TINGKAT: TingkatHukuman[] = [
  'Tidak Pernah',
  'Ringan',
  'Sedang',
  'Berat',
  'Sedang Menjalani',
]

export function FormDisiplin({
  catatan,
  opsiPegawai,
  onTutup,
}: {
  catatan: BarisDisiplin | null
  opsiPegawai: Array<{ id: number; label: string }>
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})

  const [pegawaiId, setPegawaiId] = useState(String(catatan?.pegawaiId ?? ''))
  const [tingkat, setTingkat] = useState<TingkatHukuman>(catatan?.tingkatHukuman ?? 'Ringan')
  const [tanggalSk, setTanggalSk] = useState(
    catatan?.tanggalSk ? isoTanggal(catatan.tanggalSk) : '',
  )
  const [noSk, setNoSk] = useState(catatan?.noSk ?? '')
  const [keterangan, setKeterangan] = useState(catatan?.keterangan ?? '')
  const [statusAktif, setStatusAktif] = useState(catatan?.statusAktif ?? true)

  function simpan() {
    setGalat({})
    const masukan = {
      pegawaiId: pegawaiId === '' ? 0 : Number(pegawaiId),
      tingkatHukuman: tingkat,
      tanggalSk: tanggalSk === '' ? null : tanggalSk,
      noSk: noSk.trim() === '' ? null : noSk,
      keterangan: keterangan.trim() === '' ? null : keterangan,
      statusAktif,
    }

    mulaiTransisi(async () => {
      const hasil = catatan
        ? await ubahHukuman(catatan.id, masukan)
        : await buatHukuman(masukan)

      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Catatan disimpan.' })
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
      judul={catatan ? `Ubah catatan ${catatan.nama}` : 'Tambah catatan hukuman disiplin'}
      deskripsi="Skor integritas pegawai mengikuti tingkat TERBERAT yang berstatus aktif — bukan yang terbaru."
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
        <Bidang label="Pegawai" galat={galat.pegawaiId} wajib>
          <select
            value={pegawaiId}
            onChange={(e) => setPegawaiId(e.target.value)}
            // Pegawai tidak boleh dipindah saat mengubah: itu bukan koreksi
            // catatan, itu catatan yang berbeda. Buat catatan baru, nonaktifkan
            // yang salah — supaya jejak keduanya tetap ada.
            disabled={pending || catatan !== null}
            className={kelasInput(galat.pegawaiId)}
          >
            <option value="">— Pilih pegawai —</option>
            {opsiPegawai.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {o.label}
              </option>
            ))}
          </select>
          {catatan !== null ? (
            <span className="mt-1 block text-[11px] text-text-subtle">
              Pegawai tidak bisa dipindah. Kalau catatan menempel pada orang yang salah, nonaktifkan
              yang ini lalu buat catatan baru.
            </span>
          ) : null}
        </Bidang>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Bidang
            label="Tingkat hukuman"
            galat={galat.tingkatHukuman}
            wajib
            keterangan={`skor integritas → ${SKOR_INTEGRITAS[tingkat]}`}
          >
            <select
              value={tingkat}
              onChange={(e) => setTingkat(e.target.value as TingkatHukuman)}
              disabled={pending}
              className={kelasInput(galat.tingkatHukuman)}
            >
              {TINGKAT.map((t) => (
                <option key={t} value={t}>
                  {t} — skor {SKOR_INTEGRITAS[t]}
                </option>
              ))}
            </select>
          </Bidang>

          <Bidang label="Status catatan" wajib>
            <select
              value={statusAktif ? '1' : '0'}
              onChange={(e) => setStatusAktif(e.target.value === '1')}
              disabled={pending}
              className={kelasInput()}
            >
              <option value="1">Aktif — menurunkan skor integritas</option>
              <option value="0">Tidak aktif — tidak menurunkan skor</option>
            </select>
          </Bidang>
        </div>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Bidang label="Nomor SK" galat={galat.noSk}>
            <input
              value={noSk}
              onChange={(e) => setNoSk(e.target.value)}
              disabled={pending}
              placeholder="mis. SK-HD/2024/017"
              className={kelasInput(galat.noSk)}
            />
          </Bidang>
          <Bidang label="Tanggal SK" galat={galat.tanggalSk}>
            <input
              type="date"
              value={tanggalSk}
              onChange={(e) => setTanggalSk(e.target.value)}
              disabled={pending}
              className={kelasInput(galat.tanggalSk)}
            />
          </Bidang>
        </div>

        <Bidang
          label="Keterangan"
          galat={galat.keterangan}
          keterangan="tidak disalin ke jejak audit"
        >
          <textarea
            value={keterangan}
            onChange={(e) => setKeterangan(e.target.value)}
            disabled={pending}
            rows={3}
            placeholder="Uraian singkat dasar hukuman."
            className={cn(
              'w-full rounded-md border bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-text outline-none transition-colors placeholder:text-text-subtle disabled:opacity-60',
              galat.keterangan
                ? 'border-danger-border focus:border-danger'
                : 'border-border focus:border-accent',
            )}
          />
        </Bidang>
      </div>
    </Dialog>
  )
}

function isoTanggal(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
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
