'use client'

import { useState, useTransition } from 'react'

import { kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { tetapkanJenisPenugasan } from '@/lib/aksi/kategori-riwayat'
import { JENIS_PENUGASAN, type JenisPenugasan } from '@/lib/kategori-riwayat'

/**
 * Satu baris antrian riwayat jabatan.
 *
 * Usulannya diisi dari teks jabatan (Plt/Plh), **tapi tidak pernah tersimpan
 * sendiri**. Kolom `riwayat_jabatan.jenis_penugasan` sengaja hanya berisi
 * keputusan: kalau usulan ikut ditulis ke sana, tidak ada lagi cara membedakan
 * "mesin menebak Plt" dari "manusia memastikan Plt".
 */
export function BarisJabatan({
  id,
  usulan,
  alasanUsulan,
  yakin,
  nilaiSekarang,
}: {
  id: number
  usulan: JenisPenugasan
  alasanUsulan: string
  yakin: boolean
  nilaiSekarang: JenisPenugasan | null
}) {
  const [jenis, setJenis] = useState<JenisPenugasan>(nilaiSekarang ?? usulan)
  const [pending, mulai] = useTransition()
  const { tampilkan } = useToast()

  function simpan() {
    mulai(async () => {
      const hasil = await tetapkanJenisPenugasan({ id, jenis, relevanSubstansi: null })
      tampilkan({
        nada: hasil.ok ? 'sukses' : 'bahaya',
        judul: hasil.ok ? (hasil.pesan ?? 'Tersimpan.') : hasil.pesan,
      })
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={`${kelasInput()} w-auto min-w-[9rem]`}
        value={jenis}
        onChange={(e) => setJenis(e.target.value as JenisPenugasan)}
        aria-label="Jenis penugasan"
      >
        {JENIS_PENUGASAN.map((j) => (
          <option key={j} value={j}>
            {j}
          </option>
        ))}
      </select>
      <Button size="sm" onClick={simpan} pending={pending}>
        Tetapkan
      </Button>
      <span
        className={`text-[11px] ${yakin ? 'text-text-subtle' : 'text-warning'}`}
        title={alasanUsulan}
      >
        {yakin ? `usulan: ${usulan}` : `perlu diperiksa — ${alasanUsulan}`}
      </span>
    </div>
  )
}
