'use client'

import { Check, X } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { kelasInput } from '@/components/ui/bidang'
import { useToast } from '@/components/ui/toast'
import { validasiPemetaanDiklat } from '@/lib/aksi/kategori-riwayat'

export interface OpsiKategori {
  id: number
  kode: string
  nama: string
}

/**
 * Satu baris antrian pemetaan diklat.
 *
 * Pemilihnya sudah **terisi usulan** kalau ada — pemeriksa mengoreksi, bukan
 * mengetik dari nol. Tapi menyimpannya tetap tindakan eksplisit: tanpa itu,
 * usulan yang salah akan tersimpan hanya karena barisnya pernah dilihat, dan
 * seluruh guna validasi hilang.
 *
 * Tombol **"Bukan kategori apa pun"** ada terpisah karena itu keputusan yang sah
 * dan sering benar (dari 182 nama diklat nyata, mayoritas memang tidak punya
 * kategori rubrik). Tanpa tombol itu, satu-satunya cara mengeluarkan baris dari
 * antrian adalah memaksakan kategori yang tidak tepat.
 */
export function BarisDiklat({
  id,
  namaMentah,
  kategoriId,
  usulan,
  opsi,
}: {
  id: number
  namaMentah: string
  kategoriId: number | null
  /** Usulan dari kata kunci: kode kategori → alasan (pola yang memicu). */
  usulan: Array<{ kategoriId: number; kode: string; alasan: string[] }>
  opsi: OpsiKategori[]
}) {
  const [pilihan, setPilihan] = useState<string>(
    kategoriId !== null ? String(kategoriId) : usulan.length === 1 ? String(usulan[0]!.kategoriId) : '',
  )
  const [pending, mulai] = useTransition()
  const { tampilkan } = useToast()

  function simpan(kosongkan: boolean) {
    mulai(async () => {
      const hasil = await validasiPemetaanDiklat({
        id,
        kategoriId: kosongkan ? null : pilihan === '' ? null : Number(pilihan),
        catatan: null,
      })
      tampilkan({
        nada: hasil.ok ? 'sukses' : 'bahaya',
        judul: hasil.ok ? (hasil.pesan ?? 'Tersimpan.') : hasil.pesan,
      })
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        className={`${kelasInput()} max-w-[18rem] min-w-[12rem] flex-1`}
        value={pilihan}
        onChange={(e) => setPilihan(e.target.value)}
        aria-label={`Kategori untuk ${namaMentah}`}
      >
        <option value="">— pilih kategori —</option>
        {opsi.map((o) => (
          <option key={o.id} value={o.id}>
            {o.nama}
          </option>
        ))}
      </select>

      <Button
        size="sm"
        onClick={() => simpan(false)}
        pending={pending}
        disabled={pilihan === ''}
        ikon={<Check className="size-3.5" />}
      >
        Simpan
      </Button>
      <Button
        size="sm"
        variant="halus"
        onClick={() => simpan(true)}
        pending={pending}
        ikon={<X className="size-3.5" />}
      >
        Bukan kategori apa pun
      </Button>

      {usulan.length > 0 ? (
        <span className="text-[11px] text-text-subtle">
          usulan:{' '}
          {usulan.map((u) => (
            <code key={u.kode} className="mr-1 text-[11px]">
              {u.kode}
            </code>
          ))}
          <span title={usulan.flatMap((u) => u.alasan).join(', ')}>
            (dari kata kunci {usulan.flatMap((u) => u.alasan).slice(0, 3).join(', ')})
          </span>
        </span>
      ) : (
        <span className="text-[11px] text-text-subtle">tanpa usulan — murni keputusan Anda</span>
      )}
    </div>
  )
}
