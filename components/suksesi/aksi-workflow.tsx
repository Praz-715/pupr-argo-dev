'use client'

import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { jalankanAksiWorkflow } from '@/lib/aksi/suksesi'
import { cn } from '@/lib/cn'
import type { AksiWorkflow as KodeAksi } from '@/lib/workflow'

/**
 * Tombol aksi workflow + dialog konfirmasinya.
 *
 * Daftar aksinya **dihitung di server** dari state machine (`aksiTersedia`) lalu
 * dikirim ke sini sebagai data — bukan disusun ulang di klien. Kalau klien
 * menyusunnya sendiri, ia akan menampilkan tombol yang server tolak (atau
 * menyembunyikan yang sebenarnya boleh), dan keduanya sama membingungkannya.
 *
 * Setiap dialog menampilkan **akibat** aksinya, bukan cuma "Anda yakin?".
 * Yang berubah di sini adalah urutan orang dalam daftar suksesi; pengguna berhak
 * tahu apa yang terjadi sebelum menekan.
 */

export interface OpsiAksi {
  aksi: KodeAksi
  label: string
  akibat: string
  butuhCatatan: boolean
  destruktif: boolean
}

export function AksiWorkflowTombol({
  talentPoolId,
  namaKandidat,
  opsi,
  opsiUnit,
  unitBawaanId,
  ukuran = 'sm',
  ringkas = false,
}: {
  talentPoolId: number
  namaKandidat: string
  opsi: OpsiAksi[]
  /** Untuk aksi AJUKAN: unit mana yang mengusulkan. */
  opsiUnit?: Array<{ id: number; nama: string }>
  unitBawaanId?: number | null
  ukuran?: 'sm' | 'md'
  /** Tampilkan hanya aksi pertama sebagai tombol utama, sisanya di dalam dialog. */
  ringkas?: boolean
}) {
  const [dipilih, setDipilih] = useState<OpsiAksi | null>(null)

  if (opsi.length === 0) return null

  const tampil = ringkas ? opsi.slice(0, 1) : opsi

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {tampil.map((o, i) => (
          <Button
            key={o.aksi}
            size={ukuran}
            variant={o.destruktif ? 'garisBahaya' : i === 0 ? 'utama' : 'sekunder'}
            onClick={() => setDipilih(o)}
          >
            {o.label}
          </Button>
        ))}
        {ringkas && opsi.length > 1 ? (
          <span className="text-[11px] text-text-subtle">+{opsi.length - 1} aksi lain</span>
        ) : null}
      </div>

      {dipilih !== null ? (
        <DialogAksi
          talentPoolId={talentPoolId}
          namaKandidat={namaKandidat}
          opsi={dipilih}
          opsiUnit={opsiUnit}
          unitBawaanId={unitBawaanId}
          onTutup={() => setDipilih(null)}
        />
      ) : null}
    </>
  )
}

function DialogAksi({
  talentPoolId,
  namaKandidat,
  opsi,
  opsiUnit,
  unitBawaanId,
  onTutup,
}: {
  talentPoolId: number
  namaKandidat: string
  opsi: OpsiAksi
  opsiUnit?: Array<{ id: number; nama: string }>
  unitBawaanId?: number | null
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})
  const [catatan, setCatatan] = useState('')
  const [unitId, setUnitId] = useState(String(unitBawaanId ?? opsiUnit?.[0]?.id ?? ''))

  const butuhUnit = opsi.aksi === 'AJUKAN' && opsiUnit !== undefined && opsiUnit.length > 0

  function jalankan() {
    setGalat({})
    mulaiTransisi(async () => {
      const hasil = await jalankanAksiWorkflow(talentPoolId, opsi.aksi, {
        catatan,
        unitPengajuId: butuhUnit && unitId !== '' ? Number(unitId) : null,
      })
      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Berhasil.' })
        onTutup()
      } else {
        setGalat(hasil.galatField ?? {})
        if (!hasil.galatField) {
          tampilkan({ nada: 'bahaya', judul: `Gagal: ${opsi.label}`, keterangan: hasil.pesan })
        }
      }
    })
  }

  return (
    <Dialog
      buka
      onTutup={onTutup}
      judul={`${opsi.label} — ${namaKandidat}`}
      deskripsi={opsi.akibat}
      aksi={
        <>
          <Button variant="sekunder" size="sm" onClick={onTutup} disabled={pending}>
            Batal
          </Button>
          <Button
            size="sm"
            variant={opsi.destruktif ? 'bahaya' : 'utama'}
            onClick={jalankan}
            pending={pending}
            labelPending="Memproses…"
          >
            {opsi.label}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        {butuhUnit ? (
          <label className="block">
            <span className="mb-1 flex items-baseline gap-1.5">
              <span className="text-[12px] font-medium text-text">Unit pengaju</span>
              <span className="text-[10px] text-text-subtle">
                nominasi diajukan atas nama unit, bukan pribadi
              </span>
            </span>
            <select
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
              disabled={pending}
              className={cn(
                'h-9 w-full rounded-md border bg-surface px-2.5 text-[13px] text-text outline-none disabled:opacity-60',
                galat.unitPengajuId ? 'border-danger-border' : 'border-border focus:border-accent',
              )}
            >
              {opsiUnit?.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.nama}
                </option>
              ))}
            </select>
            {galat.unitPengajuId ? (
              <span role="alert" className="mt-1 block text-[11px] leading-relaxed text-danger">
                {galat.unitPengajuId}
              </span>
            ) : null}
          </label>
        ) : null}

        <label className="block">
          <span className="mb-1 flex flex-wrap items-baseline gap-1.5">
            <span className="text-[12px] font-medium text-text">Catatan</span>
            {opsi.butuhCatatan ? (
              <span aria-hidden className="text-[12px] text-danger">
                *
              </span>
            ) : (
              <span className="text-[10px] text-text-subtle">opsional</span>
            )}
            <span className="text-[10px] text-text-subtle">
              tercatat di timeline approval &amp; jejak audit
            </span>
          </span>
          <textarea
            value={catatan}
            onChange={(e) => setCatatan(e.target.value)}
            disabled={pending}
            rows={3}
            placeholder={
              opsi.butuhCatatan
                ? 'mis. Dokumen pendukung lengkap; pengalaman jabatan memenuhi syarat.'
                : ''
            }
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
            Setiap keputusan mengubah <strong className="font-medium text-text">dua status
            sekaligus</strong> (kandidat & nominasi) dan menulis satu baris timeline. Pihak yang
            gilirannya berikutnya otomatis mendapat notifikasi.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
