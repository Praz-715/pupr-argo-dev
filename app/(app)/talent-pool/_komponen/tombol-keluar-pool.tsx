'use client'

import { LogOut } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { DialogKonfirmasi } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { keluarkanDariPool } from '@/lib/aksi/suksesi'

/**
 * "Keluarkan dari pool" — MENGELUARKAN, bukan menandai ditolak.
 *
 * Permintaan pemilik proses 2 Sep 2026: *"yang talent pool buat keluarin dari pool
 * pake keluarkan dari pool aja, jadi bukan statusnya ditolak tapi keluar dari pool
 * aja."*
 *
 * Menggantikan aksi `TOLAK_KANDIDAT` yang berlabel sama tapi menyetel status jadi
 * DITOLAK — label dan akibatnya tidak pernah sama, dan yang dibaca pengguna
 * labelnya. Alasan lengkapnya di `keluarkanDariPool()`.
 *
 * TERPISAH dari tombol aksi workflow di sebelahnya karena ia bukan transisi
 * status: ia menghapus barisnya, sesuatu yang state machine memang tidak bisa
 * ungkapkan (`terapkanAksi` mengembalikan status baru, bukan "baris hilang").
 */
export function TombolKeluarPool({
  talentPoolId,
  nama,
  punyaNominasi,
}: {
  talentPoolId: number
  nama: string
  /** Dipakai HANYA untuk memperjelas akibatnya di dialog konfirmasi. */
  punyaNominasi: boolean
}) {
  const [buka, setBuka] = useState(false)
  const [pending, mulai] = useTransition()
  const { tampilkan } = useToast()

  return (
    <>
      <Button
        size="sm"
        variant="halus"
        onClick={() => setBuka(true)}
        ikon={<LogOut className="size-3.5" />}
        title="Keluarkan dari pool — tanpa meninggalkan catatan penolakan"
      >
        Keluarkan dari pool
      </Button>
      <DialogKonfirmasi
        buka={buka}
        onTutup={() => setBuka(false)}
        pending={pending}
        judul={`Keluarkan ${nama} dari pool?`}
        deskripsi={
          'Barisnya dihapus dan ia kembali muncul di daftar kandidat yang lolos syarat — TIDAK ada catatan penolakan yang tertinggal. ' +
          (punyaNominasi
            ? 'Ia pernah dinominasikan, jadi baris nominasi & approval-nya ikut terbuang; riwayat keputusannya tetap tersimpan di jejak audit. '
            : '') +
          'Penghapusannya sendiri tercatat di jejak audit, jadi bisa dibalik.'
        }
        labelKonfirmasi="Keluarkan"
        onKonfirmasi={() =>
          mulai(async () => {
            const hasil = await keluarkanDariPool(talentPoolId)
            setBuka(false)
            tampilkan(
              hasil.ok
                ? { nada: 'sukses', judul: hasil.pesan ?? 'Dikeluarkan dari pool.' }
                : { nada: 'bahaya', judul: 'Tidak bisa dikeluarkan', keterangan: hasil.pesan },
            )
          })
        }
      />
    </>
  )
}
