'use client'

import { Plus, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { buatJabatanTarget, ubahJabatanTarget } from '@/lib/aksi/jabatan-target'
import { cn } from '@/lib/cn'
import type { BarisJabatanTarget } from '@/lib/kueri/rubrik'

/**
 * Form profil jabatan target (buat & ubah).
 *
 * Kata kunci relevansi diberi porsi besar karena dampaknya tidak kelihatan dari
 * namanya: dua indikator (Kesesuaian Bidang Ilmu & Pengembangan Kompetensi)
 * bernilai 100 bila ada kata kunci yang cocok dan **50 bila tidak** — jadi
 * jabatan target tanpa kata kunci menghukum setiap kandidat pada dua indikator
 * sekaligus, tanpa pesan apa pun di skornya (U-12).
 */
export function TombolBuatTarget() {
  const [buka, setBuka] = useState(false)
  return (
    <>
      <Button size="sm" variant="utama" onClick={() => setBuka(true)} ikon={<Plus className="size-4" />}>
        Buat jabatan target
      </Button>
      {buka ? <FormTarget mode="buat" target={null} onTutup={() => setBuka(false)} /> : null}
    </>
  )
}

export function FormTarget({
  mode,
  target,
  onTutup,
}: {
  mode: 'buat' | 'ubah'
  target: BarisJabatanTarget | null
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const router = useRouter()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})

  const [kodeTarget, setKodeTarget] = useState(target?.kodeTarget ?? '')
  const [namaTarget, setNamaTarget] = useState(target?.namaTarget ?? '')
  const [deskripsi, setDeskripsi] = useState(target?.deskripsi ?? '')
  const [kataKunci, setKataKunci] = useState<string[]>(target?.kataKunciRelevansi ?? [])
  const [kunciBaru, setKunciBaru] = useState('')

  function tambahKunci() {
    const bersih = kunciBaru.trim().toLowerCase()
    if (bersih === '') return
    if (kataKunci.some((k) => k.toLowerCase() === bersih)) {
      setKunciBaru('')
      return
    }
    setKataKunci([...kataKunci, bersih])
    setKunciBaru('')
  }

  function simpan() {
    setGalat({})
    const masukan = {
      kodeTarget,
      namaTarget,
      deskripsi: deskripsi.trim() === '' ? null : deskripsi,
      kataKunciRelevansi: kataKunci,
    }

    function tanganiGagal(pesan: string, galatField?: Record<string, string>) {
      setGalat(galatField ?? {})
      // Toast hanya untuk galat NON-field: kalau pesannya sudah tampil di sebelah
      // kotak yang salah, toast jadi pengulangan berisik.
      if (!galatField) tampilkan({ nada: 'bahaya', judul: 'Gagal menyimpan', keterangan: pesan })
    }

    mulaiTransisi(async () => {
      if (mode === 'buat') {
        const hasil = await buatJabatanTarget(masukan)
        if (!hasil.ok) return tanganiGagal(hasil.pesan, hasil.galatField)
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Disimpan.' })
        onTutup()
        // Langsung ke editornya: jabatan target baru belum bisa apa-apa sebelum
        // punya jabatan anggota & rubrik, jadi menutup dialog lalu meninggalkan
        // pengguna di daftar berarti menyembunyikan langkah berikutnya.
        if (hasil.data.id > 0) router.push(`/jabatan-target/${hasil.data.id}`)
        return
      }

      const hasil = await ubahJabatanTarget(target!.id, masukan)
      if (!hasil.ok) return tanganiGagal(hasil.pesan, hasil.galatField)
      tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Disimpan.' })
      onTutup()
    })
  }

  return (
    <Dialog
      buka
      onTutup={onTutup}
      lebar="lg"
      judul={mode === 'buat' ? 'Buat jabatan target' : `Ubah "${target?.namaTarget}"`}
      deskripsi={
        mode === 'buat'
          ? 'Jabatan target baru selalu lahir sebagai draft — ia belum bisa menilai siapa pun sebelum punya jabatan anggota dan rubrik yang lolos pemeriksaan.'
          : 'Mengubah kata kunci relevansi mengubah skor dua indikator; jalankan Hitung Ulang setelah menyimpan.'
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
        <Bidang label="Kode target" galat={galat.kodeTarget} wajib>
          <input
            value={kodeTarget}
            onChange={(e) => setKodeTarget(e.target.value)}
            disabled={pending}
            placeholder="mis. JT-KABALAI-BJKW"
            className={kelasInput(galat.kodeTarget)}
          />
        </Bidang>

        <Bidang label="Nama jabatan target" galat={galat.namaTarget} wajib>
          <input
            value={namaTarget}
            onChange={(e) => setNamaTarget(e.target.value)}
            disabled={pending}
            placeholder="mis. Kepala Balai Jasa Konstruksi Wilayah"
            className={kelasInput(galat.namaTarget)}
          />
        </Bidang>

        <Bidang
          label="Deskripsi"
          galat={galat.deskripsi}
          keterangan="opsional — konteks untuk pembaca, tidak dipakai perhitungan"
        >
          <textarea
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            disabled={pending}
            rows={3}
            className={cn(kelasInput(galat.deskripsi), 'h-auto py-2 leading-relaxed')}
          />
        </Bidang>

        <Bidang
          label="Kata kunci relevansi"
          galat={galat.kataKunciRelevansi}
          keterangan="dipakai indikator Kesesuaian Bidang Ilmu & Pengembangan Kompetensi"
        >
          <div className="flex gap-2">
            <input
              value={kunciBaru}
              onChange={(e) => setKunciBaru(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  tambahKunci()
                }
              }}
              disabled={pending}
              placeholder="mis. pengadaan, teknik sipil, semua"
              className={kelasInput(galat.kataKunciRelevansi)}
            />
            <Button size="sm" variant="sekunder" onClick={tambahKunci} disabled={pending}>
              Tambah
            </Button>
          </div>
          {kataKunci.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {kataKunci.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 rounded-full border border-accent-border bg-accent-subtle px-2 py-0.5 text-[11px] text-accent"
                >
                  {k}
                  <button
                    type="button"
                    onClick={() => setKataKunci(kataKunci.filter((x) => x !== k))}
                    disabled={pending}
                    aria-label={`Hapus kata kunci ${k}`}
                    className="hover:text-text"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
        </Bidang>

        <div className="rounded-md border border-warning-border bg-warning-subtle px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-text-muted">
            {kataKunci.length === 0 ? (
              <>
                <strong className="font-medium text-text">Tanpa kata kunci</strong>, indikator
                Kesesuaian Bidang Ilmu dan Pengembangan Kompetensi akan bernilai{' '}
                <strong className="font-medium text-text">50 untuk semua kandidat</strong> — tidak
                membedakan siapa pun, tapi juga menahan skor mereka.
              </>
            ) : (
              <>
                Kata kunci <strong className="font-medium text-text">&quot;semua&quot;</strong>{' '}
                membebaskan syarat bidang ilmu formal, tapi{' '}
                <strong className="font-medium text-text">tidak</strong> berlaku untuk indikator
                diklat — kelonggaran jurusan bukan pembebasan syarat pengembangan kompetensi.
              </>
            )}
          </p>
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
