import { Filter } from 'lucide-react'
import Link from 'next/link'

import { ambilOpsiRumpun } from '@/lib/kueri/rumpun'

/**
 * Keterangan bahwa penyaring rumpun jabatan ADA — di halaman depan.
 *
 * Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 4):
 * *"Defaultnya ada semua tapi ada infonya filtrasi umum."*
 *
 * Dua tuntutan yang terbaca bertentangan, dan keduanya benar sekaligus: penyaring
 * itu **ada di setiap modul berkandidat** tapi **bawaannya tidak menyaring
 * apa pun**. Penyaring yang bawaannya membuang baris membuat halaman tampak rusak
 * bagi orang yang belum memilih apa pun — tapi penyaring yang bawaannya diam juga
 * tidak akan pernah ditemukan. Keterangan inilah yang menutup selisih itu: ia
 * mengumumkan penyaringnya sekali, di tempat orang mulai bekerja, alih-alih
 * menyalakannya diam-diam di sembilan halaman.
 *
 * Angkanya DITURUNKAN dari master, bukan ditulis: kalimat yang menyebut "10
 * rumpun" akan berbohong pada perubahan master berikutnya, dan kebohongan kecil
 * di halaman depan lebih mahal daripada kalimat yang lebih hambar.
 */
export async function InfoRumpun() {
  const rumpun = await ambilOpsiRumpun(null)
  // Di bawah dua rumpun, penyaringnya tidak menyaring apa pun yang berarti dan
  // keterangannya cuma kebisingan.
  if (rumpun.length < 2) return null

  const teratas = rumpun.slice(0, 3).map((r) => r.label)

  return (
    <p className="flex flex-wrap items-start gap-x-2 gap-y-1 rounded-md border border-border bg-surface-inset px-3 py-2 text-[11px] leading-relaxed text-text-muted">
      <Filter className="mt-0.5 size-3.5 shrink-0 text-text-subtle" aria-hidden />
      <span>
        Daftar kandidat di seluruh modul bisa disaring menurut{' '}
        <strong className="font-medium text-text">rumpun jabatan</strong> — {teratas.join(', ')},
        dan {rumpun.length - teratas.length} lainnya. Bawaannya menampilkan semua; penyaringnya ada
        di{' '}
        <Link href="/talenta" className="text-accent underline-offset-2 hover:underline">
          Direktori Pegawai
        </Link>
        ,{' '}
        <Link href="/peta-talenta" className="text-accent underline-offset-2 hover:underline">
          Peta Talenta
        </Link>
        , dan halaman Kandidat tiap jabatan target.
      </span>
    </p>
  )
}
