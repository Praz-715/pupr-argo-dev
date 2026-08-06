'use client'

import { FilePlus2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { buatTargetDariJabatan } from '@/lib/aksi/jabatan-target'

/**
 * "Jadikan draft jabatan target" — satu klik dari baris jabatan kosong (U-14).
 *
 * Tanpa dialog konfirmasi, dan itu disengaja: yang dibuat berstatus **DRAFT**,
 * yang menurut definisinya belum menilai siapa pun dan belum tampil di pemilih
 * Peta Talenta. Meminta konfirmasi untuk tindakan yang tidak berakibat apa-apa
 * melatih pengguna menekan "Ya" tanpa membaca — lalu konfirmasi yang benar-benar
 * penting ikut dilewati.
 *
 * Berhasil → langsung ke editornya. Membuat draft lalu meninggalkan pengguna di
 * daftar kekosongan berarti ia harus mencari sendiri draft yang baru saja ia
 * buat, dan pekerjaan sebenarnya (persyaratan + rubrik) belum dimulai.
 */
export function TombolJadikanDraft({
  jabatanId,
  namaJabatan,
}: {
  jabatanId: number
  namaJabatan: string
}) {
  const router = useRouter()
  const { tampilkan } = useToast()
  const [pending, mulai] = useTransition()

  return (
    <Button
      size="sm"
      variant="halus"
      pending={pending}
      ikon={<FilePlus2 className="size-3.5" />}
      onClick={() =>
        mulai(async () => {
          const hasil = await buatTargetDariJabatan(jabatanId)
          if (hasil.ok) {
            tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Draft jabatan target dibuat.' })
            router.push(`/jabatan-target/${hasil.data.id}`)
          } else {
            tampilkan({ nada: 'bahaya', judul: hasil.pesan ?? 'Gagal membuat draft.' })
          }
        })
      }
      aria-label={`Jadikan "${namaJabatan}" draft jabatan target`}
    >
      Jadikan draft
    </Button>
  )
}
