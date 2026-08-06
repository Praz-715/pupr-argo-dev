'use client'

import { Plus } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Bidang, kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { buatJabatanTarget, ubahJabatanTarget } from '@/lib/aksi/jabatan-target'
import { cn } from '@/lib/cn'
import type { BarisJabatanTarget } from '@/lib/kueri/rubrik'

/**
 * Form profil jabatan target (buat & ubah) — **identitas saja**: kode, nama,
 * deskripsi.
 *
 * Kata kunci relevansi dulu disunting di sini, dan itu dicabut di Fase 11 no. 3
 * (U-15). Isinya bukan properti identitas melainkan **deklarasi syarat bidang
 * ilmu**, dan syarat yang sama juga dibaca gerbang kelayakan lewat baris
 * persyaratan `BIDANG_ILMU`. Dua form yang bisa menulis satu deklarasi berarti
 * menyunting nama jabatan target dapat menimpa syaratnya tanpa menyebutnya — dan
 * yang bergeser adalah skor, bukan label. Sekarang satu tempat: tab Persyaratan.
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

  function simpan() {
    setGalat({})
    const masukan = {
      kodeTarget,
      namaTarget,
      deskripsi: deskripsi.trim() === '' ? null : deskripsi,
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
          : 'Yang diubah di sini hanya identitas jabatan target. Syarat & rubriknya tidak tersentuh, jadi skor kandidat tidak bergeser.'
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

        {/*
          Kata kunci relevansi TIDAK lagi disunting di sini (Fase 11 no. 3).
          Isinya adalah deklarasi syarat bidang ilmu, dan syarat itu punya satu
          tempat: tab Persyaratan. Selama form profil juga bisa menulisnya,
          mengganti nama jabatan target bisa menimpa syaratnya tanpa menyebutnya —
          dan skor bergeser karena tindakan yang kelihatannya cuma menyunting label.
        */}
        <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-text-muted">
            Bidang ilmu, pendidikan minimal, pelatihan, dan pengalaman diatur di{' '}
            <strong className="font-medium text-text">tab Persyaratan</strong> pada editor jabatan
            target — satu tempat untuk seluruh syarat, sehingga gerbang kelayakan dan indikator
            rubrik tidak bisa lagi menyimpan dua daftar yang berbeda.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
