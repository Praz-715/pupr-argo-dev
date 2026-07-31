'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/cn'
import { buatUnit, ubahUnit } from '@/lib/aksi/unit-organisasi'
import type { NodeUnit } from '@/lib/kueri/master'

/**
 * Form unit organisasi (buat & ubah dalam satu komponen).
 *
 * **Galat validasi ditampilkan di fieldnya, bukan sebagai toast.** Toast dipakai
 * untuk hasil aksi ("Unit disimpan"); pesan "kode unit minimal 2 karakter" harus
 * berada di sebelah kotak yang salah, dan isian lain tetap utuh supaya pengguna
 * tidak mengetik ulang semuanya (catatan di `components/ui/toast.tsx`).
 */

const JENIS: Array<{ nilai: string; label: string }> = [
  { nilai: 'DITJEN', label: 'Direktorat Jenderal' },
  { nilai: 'SEKRETARIAT', label: 'Sekretariat' },
  { nilai: 'DIREKTORAT', label: 'Direktorat' },
  { nilai: 'BALAI', label: 'Balai' },
  { nilai: 'BP2JK', label: 'BP2JK' },
  { nilai: 'SUBDIT', label: 'Subdirektorat' },
  { nilai: 'BAGIAN', label: 'Bagian' },
  { nilai: 'SEKSI', label: 'Seksi' },
]

export function FormUnit({
  mode,
  unit,
  parentIdAwal,
  opsiInduk,
  onTutup,
}: {
  mode: 'buat' | 'ubah'
  unit: NodeUnit | null
  parentIdAwal: number | null
  opsiInduk: Array<{ id: number; nama: string; kedalaman: number }>
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})

  const [kodeUnit, setKodeUnit] = useState(unit?.kodeUnit ?? '')
  const [namaUnit, setNamaUnit] = useState(unit?.namaUnit ?? '')
  const [parentId, setParentId] = useState<string>(
    String(unit?.parentId ?? parentIdAwal ?? ''),
  )
  const [jenis, setJenis] = useState(unit?.jenis ?? 'BAGIAN')
  const [levelEselon, setLevelEselon] = useState(
    unit?.levelEselon === null || unit?.levelEselon === undefined ? '' : String(unit.levelEselon),
  )

  function simpan() {
    setGalat({})
    const masukan = {
      kodeUnit,
      namaUnit,
      parentId: parentId === '' ? null : Number(parentId),
      jenis,
      levelEselon: levelEselon === '' ? null : Number(levelEselon),
    }

    mulaiTransisi(async () => {
      const hasil =
        mode === 'buat' ? await buatUnit(masukan) : await ubahUnit(unit!.id, masukan)

      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Unit disimpan.' })
        onTutup()
      } else {
        setGalat(hasil.galatField ?? {})
        // Toast hanya kalau galatnya BUKAN per-field — kalau per-field, pesannya
        // sudah tampil di sebelah kotaknya dan toast jadi pengulangan berisik.
        if (!hasil.galatField) {
          tampilkan({ nada: 'bahaya', judul: 'Gagal menyimpan', keterangan: hasil.pesan })
        }
      }
    })
  }

  // Saat mengubah, unit itu sendiri tidak boleh jadi induknya sendiri. Turunannya
  // juga ditolak, tapi itu diperiksa di server — daftar turunan tidak ada di klien.
  const opsiTerpakai = opsiInduk.filter((o) => o.id !== unit?.id)

  return (
    <Dialog
      buka
      onTutup={onTutup}
      judul={mode === 'buat' ? 'Tambah unit organisasi' : `Ubah "${unit?.namaUnit}"`}
      deskripsi={
        mode === 'buat'
          ? 'Unit tanpa induk menjadi akar pohon organisasi.'
          : 'Mengubah induk akan memindahkan seluruh cabang di bawahnya.'
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
        <Bidang label="Kode unit" galat={galat.kodeUnit} wajib>
          <input
            value={kodeUnit}
            onChange={(e) => setKodeUnit(e.target.value)}
            disabled={pending}
            placeholder="mis. SETDITJEN-BKU"
            className={kelasInput(galat.kodeUnit)}
          />
        </Bidang>

        <Bidang label="Nama unit" galat={galat.namaUnit} wajib>
          <input
            value={namaUnit}
            onChange={(e) => setNamaUnit(e.target.value)}
            disabled={pending}
            placeholder="mis. Bagian Kepegawaian dan Umum"
            className={kelasInput(galat.namaUnit)}
          />
        </Bidang>

        <Bidang label="Unit induk" galat={galat.parentId}>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
            disabled={pending}
            className={kelasInput(galat.parentId)}
          >
            <option value="">— Tanpa induk (akar) —</option>
            {opsiTerpakai.map((o) => (
              <option key={o.id} value={String(o.id)}>
                {'  '.repeat(o.kedalaman)}
                {o.nama}
              </option>
            ))}
          </select>
        </Bidang>

        <div className="grid grid-cols-2 gap-3.5">
          <Bidang label="Jenis unit" galat={galat.jenis} wajib>
            <select
              value={jenis}
              onChange={(e) => setJenis(e.target.value)}
              disabled={pending}
              className={kelasInput(galat.jenis)}
            >
              {JENIS.map((j) => (
                <option key={j.nilai} value={j.nilai}>
                  {j.label}
                </option>
              ))}
            </select>
          </Bidang>

          <Bidang label="Level eselon" galat={galat.levelEselon} keterangan="kosongkan bila non-eselon">
            <select
              value={levelEselon}
              onChange={(e) => setLevelEselon(e.target.value)}
              disabled={pending}
              className={kelasInput(galat.levelEselon)}
            >
              <option value="">—</option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={String(n)}>
                  Eselon {n}
                </option>
              ))}
            </select>
          </Bidang>
        </div>
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
      <span className="mb-1 flex items-baseline gap-1.5">
        <span className="text-[12px] font-medium text-text">{label}</span>
        {wajib ? (
          <span aria-hidden className="text-[12px] text-danger">
            *
          </span>
        ) : null}
        {keterangan ? (
          <span className="text-[10px] text-text-subtle">{keterangan}</span>
        ) : null}
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
