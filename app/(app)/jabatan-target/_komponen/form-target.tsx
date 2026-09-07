'use client'

import { useState, useTransition } from 'react'

import { Bidang, kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { ubahJabatanTarget } from '@/lib/aksi/jabatan-target'
import { cn } from '@/lib/cn'
import type { BarisJabatanTarget } from '@/lib/kueri/rubrik'

/**
 * Form profil jabatan target — **hanya MENGUBAH**, dan identitas saja: kode, nama,
 * deskripsi.
 *
 * ## Pembuatannya tidak lagi di sini (25 Agu 2026)
 *
 * Permintaan pemilik proses: jabatan target baru **dipilih dari master jabatan**,
 * tidak diketik. Jalurnya sekarang `pemilih-jabatan-target.tsx`, yang menurunkan
 * kode & nama dari baris master DAN menautkan jabatan anggotanya sekaligus.
 * Alasan lengkapnya ada di berkas itu.
 *
 * Menyunting target yang SUDAH ada tetap dipertahankan — memperjelas deskripsi atau
 * merapikan nama bukan penambahan, dan tidak bisa melahirkan jabatan target yang
 * tidak menunjuk kursi mana pun.
 *
 * ## Kata kunci relevansi TIDAK disunting di sini
 *
 * Dicabut di Fase 11 no. 3 (U-15). Isinya bukan properti identitas melainkan
 * **deklarasi syarat bidang ilmu**, dan syarat yang sama juga dibaca gerbang
 * kelayakan lewat baris persyaratan `BIDANG_ILMU`. Dua form yang bisa menulis satu
 * deklarasi berarti menyunting nama jabatan target dapat menimpa syaratnya tanpa
 * menyebutnya — dan yang bergeser adalah skor, bukan label. Sekarang satu tempat:
 * tab Persyaratan.
 */
export function FormTarget({
  target,
  onTutup,
}: {
  target: BarisJabatanTarget
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})

  const [kodeTarget, setKodeTarget] = useState(target.kodeTarget)
  const [namaTarget, setNamaTarget] = useState(target.namaTarget)
  const [deskripsi, setDeskripsi] = useState(target.deskripsi ?? '')

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
      const hasil = await ubahJabatanTarget(target.id, masukan)
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
      judul={`Ubah "${target.namaTarget}"`}
      deskripsi="Yang diubah di sini hanya identitas jabatan target. Syarat & rubriknya tidak tersentuh, jadi skor kandidat tidak bergeser."
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
            className={kelasInput(galat.kodeTarget)}
          />
        </Bidang>

        <Bidang label="Nama jabatan target" galat={galat.namaTarget} wajib>
          <input
            value={namaTarget}
            onChange={(e) => setNamaTarget(e.target.value)}
            disabled={pending}
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

        <div className="rounded-md border border-border bg-surface-2 px-3 py-2.5">
          <p className="text-[11px] leading-relaxed text-text-muted">
            Bidang ilmu, pendidikan minimal, pelatihan, pengalaman, dan golongan diatur di{' '}
            <strong className="font-medium text-text">tab Persyaratan</strong> pada editor jabatan
            target — satu tempat untuk seluruh syarat, sehingga gerbang kelayakan dan indikator
            rubrik tidak bisa lagi menyimpan dua daftar yang berbeda.
          </p>
        </div>
      </div>
    </Dialog>
  )
}
