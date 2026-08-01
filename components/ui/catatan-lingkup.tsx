import { Building2, ShieldAlert } from 'lucide-react'

import { ringkasLingkup, type Lingkup } from '@/lib/lingkup'

/**
 * Penjelas pembatasan data per unit, satu komponen untuk semua halaman.
 *
 * **Daftar yang disaring diam-diam adalah daftar yang akan dibaca sebagai
 * daftar lengkap.** Seorang Pengelola Unit yang melihat 12 pegawai tanpa
 * keterangan apa pun akan menyimpulkan DJBK punya 12 pegawai yang layak
 * dipertimbangkan — dan kesimpulan itu tidak akan pernah terkoreksi karena
 * tidak ada yang terlihat salah.
 *
 * Merender tiga keadaan dari satu masukan supaya halaman tidak perlu
 * bercabang sendiri: tidak dibatasi (tidak ada apa-apa), dibatasi (pita
 * keterangan), dan tidak boleh melihat apa pun (kotak penjelasan + jalan
 * keluar).
 */
export function CatatanLingkup({ lingkup }: { lingkup: Lingkup }) {
  if (lingkup.jenis === 'NIHIL') {
    return (
      <div className="rounded-lg border border-warning-border bg-warning-subtle px-4 py-3.5">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-4.5 shrink-0 text-warning" />
          <div>
            <p className="text-[13px] font-semibold text-text">Tidak ada data yang bisa ditampilkan</p>
            <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-text-muted">
              {lingkup.alasan}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const teks = ringkasLingkup(lingkup)
  if (!teks) return null

  return (
    <p className="flex items-center gap-2 rounded-md border border-border bg-surface-inset px-3 py-2 text-[12px] text-text-muted">
      <Building2 className="size-3.5 shrink-0 text-text-subtle" />
      {teks}
    </p>
  )
}
