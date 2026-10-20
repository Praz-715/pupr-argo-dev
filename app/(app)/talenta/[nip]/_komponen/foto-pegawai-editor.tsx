'use client'

import { Camera, LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? ''
const MAKS_FOTO = 5 * 1024 * 1024

/** Render foto dan editor dalam satu komponen agar cache URL berubah setelah unggah. */
export function FotoPegawaiEditor({
  nip,
  nama,
  inisial,
  punyaFoto,
  boleh,
}: {
  nip: string
  nama: string
  inisial: string
  punyaFoto: boolean
  boleh: boolean
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [adaFoto, setAdaFoto] = useState(punyaFoto)
  const [file, setFile] = useState<File | null>(null)
  const [versi, setVersi] = useState(0)
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState('')
  const [galat, setGalat] = useState(false)

  async function unggah() {
    if (!file || sibuk) return
    if (file.size > MAKS_FOTO) {
      setGalat(true)
      setPesan('Foto maksimal 5 MB.')
      return
    }
    setSibuk(true)
    setPesan('')
    try {
      const data = new FormData()
      data.set('foto', file)
      const response = await fetch(BASE_PATH + '/api/internal/foto/' + nip + '/unggah', {
        method: 'POST',
        body: data,
        credentials: 'same-origin',
      })
      const hasil = (await response.json()) as { ok: boolean; pesan?: string }
      if (!response.ok || !hasil.ok) throw new Error(hasil.pesan || 'Gagal mengunggah foto.')
      setAdaFoto(true)
      setVersi(Date.now())
      setFile(null)
      if (input.current) input.current.value = ''
      setGalat(false)
      setPesan('Foto berhasil diperbarui.')
      router.refresh()
    } catch (error) {
      setGalat(true)
      setPesan(error instanceof Error ? error.message : 'Unggahan gagal. Coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div className="w-[9.25rem] space-y-2">
      {adaFoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={BASE_PATH + '/api/internal/foto/' + nip + (versi ? '?v=' + versi : '')}
          alt={'Foto ' + nama}
          width={148}
          height={198}
          className="h-[12.375rem] w-[9.25rem] rounded-lg border border-border bg-surface-2 object-cover object-top"
        />
      ) : (
        <div className="flex h-[12.375rem] w-[9.25rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-2">
          <span aria-hidden className="flex size-14 items-center justify-center rounded-full bg-accent-subtle text-lg font-semibold text-accent">
            {inisial}
          </span>
          <span className="text-[11px] text-text-subtle">Belum ada foto</span>
        </div>
      )}
      {boleh ? (
        <div className="space-y-1.5">
          <input
            ref={input}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label={'Pilih foto ' + nama}
            className="block w-full text-[11px] text-text-muted file:mr-1 file:rounded file:border-0 file:bg-accent-subtle file:px-1.5 file:py-1 file:text-[11px] file:text-accent"
            disabled={sibuk}
            onChange={(e) => {
              setFile(e.target.files?.[0] ?? null)
              setPesan('')
            }}
          />
          <button
            type="button"
            onClick={unggah}
            disabled={!file || sibuk}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs font-medium text-text transition-colors hover:bg-surface-inset disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sibuk ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : <Camera aria-hidden className="size-3.5" />}
            {sibuk ? 'Menyimpan…' : 'Simpan foto'}
          </button>
          <p className="text-[10px] text-text-subtle">JPG, PNG, WebP · maks. 5 MB</p>
        </div>
      ) : null}
      {pesan ? (
        <p role="status" className={'text-[11px] ' + (galat ? 'text-danger' : 'text-success')}>
          {pesan}
        </p>
      ) : null}
    </div>
  )
}
