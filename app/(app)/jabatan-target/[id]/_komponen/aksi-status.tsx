'use client'

import { Calculator, Play, Power } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { DialogKonfirmasi } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { ubahStatusJabatanTarget } from '@/lib/aksi/jabatan-target'
import { hitungUlangSkor } from '@/lib/aksi/skoring'
import { formatAngka, formatDurasiMs } from '@/lib/format'
import type { BarisJabatanTarget } from '@/lib/kueri/rubrik'

/**
 * Tombol aktivasi & Hitung Ulang.
 *
 * Hitung Ulang **selalu** lewat dialog konfirmasi walaupun bukan aksi destruktif:
 * ia menulis ulang skor & peringkat seluruh pegawai untuk jabatan target ini,
 * dan peringkat yang bergeser adalah urutan manusia dalam daftar suksesi. Dialognya
 * menyebutkan itu, lalu mengarahkan ke Simulasi & Diff kalau pengguna mau melihat
 * dampaknya lebih dulu.
 */
export function AksiStatus({ target }: { target: BarisJabatanTarget }) {
  const { tampilkan } = useToast()
  const [pendingStatus, transisiStatus] = useTransition()
  const [pendingHitung, transisiHitung] = useTransition()
  const [konfirmasiHitung, setKonfirmasiHitung] = useState(false)

  function ubahStatus(status: 'AKTIF' | 'NONAKTIF') {
    transisiStatus(async () => {
      const hasil = await ubahStatusJabatanTarget(target.id, status)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Status diperbarui.' }
          : {
              nada: 'bahaya',
              judul: status === 'AKTIF' ? 'Belum bisa diaktifkan' : 'Gagal mengubah status',
              keterangan: hasil.pesan,
            },
      )
    })
  }

  function hitungUlang() {
    transisiHitung(async () => {
      const hasil = await hitungUlangSkor(target.id)
      setKonfirmasiHitung(false)
      if (hasil.ok) {
        const r = hasil.data
        tampilkan({
          nada: 'sukses',
          judul: `Selesai dalam ${formatDurasiMs(r.durasiMs)}`,
          keterangan: hasil.pesan,
        })
      } else {
        tampilkan({ nada: 'bahaya', judul: 'Gagal menghitung', keterangan: hasil.pesan })
      }
    })
  }

  return (
    <>
      <Button
        size="sm"
        variant="sekunder"
        onClick={() => setKonfirmasiHitung(true)}
        pending={pendingHitung}
        labelPending="Menghitung…"
        ikon={<Calculator className="size-3.5" />}
      >
        Hitung Ulang
      </Button>

      {target.status === 'AKTIF' ? (
        <Button
          size="sm"
          variant="sekunder"
          onClick={() => ubahStatus('NONAKTIF')}
          pending={pendingStatus}
          labelPending="Menonaktifkan…"
          ikon={<Power className="size-3.5" />}
        >
          Nonaktifkan
        </Button>
      ) : (
        <Button
          size="sm"
          variant="utama"
          onClick={() => ubahStatus('AKTIF')}
          pending={pendingStatus}
          labelPending="Mengaktifkan…"
          ikon={<Play className="size-3.5" />}
        >
          Aktifkan
        </Button>
      )}

      <DialogKonfirmasi
        buka={konfirmasiHitung}
        onTutup={() => setKonfirmasiHitung(false)}
        onKonfirmasi={hitungUlang}
        pending={pendingHitung}
        judul="Hitung ulang skor jabatan target ini?"
        deskripsi={
          `Seluruh pegawai aktif dinilai ulang dengan rubrik & persyaratan yang tersimpan sekarang, ` +
          `lalu ${formatAngka(target.jumlahPool)} anggota talent pool diperingkat ulang. ` +
          `Nilai yang pernah diisi manual dipertahankan. ` +
          `Kalau ingin melihat dampaknya lebih dulu, buka Simulasi & Diff — di sana perubahan peringkat ditampilkan tanpa menyimpan apa pun.`
        }
        labelKonfirmasi="Hitung sekarang"
        labelPending="Menghitung…"
      />
    </>
  )
}
