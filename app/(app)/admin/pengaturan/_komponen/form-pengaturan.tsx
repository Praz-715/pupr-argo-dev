'use client'

import { Check, RotateCcw } from 'lucide-react'
import { useState, useTransition } from 'react'

import { kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { ubahPengaturan } from '@/lib/aksi/pengaturan'
import { formatTanggalWaktu } from '@/lib/format'
import type { BarisPengaturan } from '@/lib/pengaturan'

/**
 * Satu parameter = satu baris dengan tombol simpannya sendiri.
 *
 * Sengaja bukan satu formulir besar dengan satu tombol "Simpan semua". Setiap
 * parameter di sini punya akibat yang berbeda dan sebagian besar berat —
 * mengubah masa berlaku asesmen menggeser kelayakan seluruh kandidat.
 * Menyimpan enam parameter sekaligus membuat akibatnya menumpuk jadi satu
 * peristiwa yang tidak bisa ditelusuri balik ke penyebabnya.
 */
export function FormPengaturan({ baris }: { baris: BarisPengaturan[] }) {
  return (
    <ul className="divide-y divide-border">
      {baris.map((p) => (
        <li key={p.kunci} className="py-4 first:pt-0 last:pb-0">
          <BarisParameter param={p} />
        </li>
      ))}
    </ul>
  )
}

function BarisParameter({ param }: { param: BarisPengaturan }) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [nilai, setNilai] = useState(param.nilai)
  const [galat, setGalat] = useState<string | null>(null)

  const berubah = nilai !== param.nilai

  function simpan() {
    setGalat(null)
    mulaiTransisi(async () => {
      const hasil = await ubahPengaturan({ kunci: param.kunci, nilai })
      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Tersimpan.' })
      } else {
        setGalat(hasil.galatField?.nilai ?? hasil.pesan)
      }
    })
  }

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 max-w-2xl flex-1">
        <p className="text-[13px] font-medium text-text">{param.label}</p>
        <code className="text-[10px] text-text-subtle">{param.kunci}</code>
        {param.deskripsi ? (
          <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{param.deskripsi}</p>
        ) : null}
        {param.diubahPada ? (
          <p className="mt-1 text-[11px] text-text-subtle">
            Terakhir diubah {formatTanggalWaktu(param.diubahPada)}
            {param.diubahOleh ? ` oleh ${param.diubahOleh}` : ''}
          </p>
        ) : (
          <p className="mt-1 text-[11px] text-text-subtle">Masih nilai bawaan sistem.</p>
        )}
        {galat ? (
          <p role="alert" className="mt-1.5 text-[11px] text-danger">
            {galat}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <input
          type={param.tipe === 'ANGKA' ? 'number' : 'text'}
          value={nilai}
          min={param.nilaiMin ?? undefined}
          max={param.nilaiMax ?? undefined}
          onChange={(e) => setNilai(e.target.value)}
          disabled={pending}
          aria-label={param.label}
          className={`${kelasInput(galat ?? undefined)} w-28 tabular-nums`}
        />
        {berubah ? (
          <>
            <Button
              size="sm"
              onClick={simpan}
              pending={pending}
              labelPending="…"
              ikon={<Check className="size-3.5" />}
            >
              Simpan
            </Button>
            <Button
              variant="halus"
              size="ikon"
              title="Kembalikan"
              disabled={pending}
              onClick={() => {
                setNilai(param.nilai)
                setGalat(null)
              }}
            >
              <RotateCcw className="size-3.5" />
            </Button>
          </>
        ) : null}
      </div>
    </div>
  )
}
