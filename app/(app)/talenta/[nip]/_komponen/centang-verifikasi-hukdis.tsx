'use client'

import { ShieldCheck } from 'lucide-react'
import { useState, useTransition } from 'react'

import { useToast } from '@/components/ui/toast'
import { tandaiHukdisDiperiksa } from '@/lib/aksi/profil'
import { formatTanggalWaktu } from '@/lib/format'

/**
 * Ceklis "rekam jejak disiplin sudah diperiksa" (permintaan pemilik proses
 * 25 Agu 2026).
 *
 * ## Yang dinyatakannya, dan yang TIDAK
 *
 * Ia **tidak** menyatakan "pegawai ini bersih" — itu sudah jadi perlakuan bawaan
 * mesin skor (tidak ada catatan → Integritas 100). Yang dinyatakan: seseorang
 * pernah memeriksanya. Sebelum ini "sudah diperiksa, hasilnya bersih" tidak bisa
 * dibedakan dari "belum diperiksa", padahal 15% match score bergantung pada
 * komponen itu.
 *
 * Karena itu labelnya berbunyi **"Sudah diperiksa, tidak ada catatan hukuman
 * disiplin"** dan bukan "Bersih": yang dicentang adalah pemeriksaannya, bukan
 * orangnya.
 *
 * ## Kenapa `<button role="switch">`, bukan `<input type="checkbox">`
 *
 * Mencentangnya **mengirim mutasi**, bukan mengubah nilai form yang nanti disimpan.
 * Checkbox yang menyimpan sendiri saat diklik adalah kontrol yang menipu: ia
 * mengundang orang mencentang beberapa lalu mencari tombol Simpan yang tidak ada.
 * Tombol berkeadaan menyatakan bahwa satu tekan = satu tindakan, dan `aria-checked`
 * tetap membuat keadaannya terbaca pembaca layar.
 *
 * Bisa dibatalkan (tekan lagi) — satu klik keliru tidak boleh jadi pernyataan
 * permanen atas nama seseorang bahwa ia memeriksa sesuatu yang tidak ia periksa.
 */
export function CentangVerifikasiHukdis({
  pegawaiId,
  verifikasi,
}: {
  pegawaiId: number
  verifikasi: { olehNama: string | null; pada: Date | null; catatan: string | null } | null
}) {
  const { tampilkan } = useToast()
  const [pending, mulai] = useTransition()
  /*
    Keadaan ditahan lokal supaya centangnya berpindah SEKETIKA. Tanpa itu ia baru
    bergerak setelah revalidasi halaman selesai, dan jeda pada kontrol biner terbaca
    seperti klik yang tidak tertangkap — lalu orang mengekliknya dua kali, yang di
    sini berarti mencentang lalu membatalkannya.
  */
  const [nyala, setNyala] = useState(verifikasi !== null)

  function alihkan() {
    const target = !nyala
    setNyala(target)
    mulai(async () => {
      const hasil = await tandaiHukdisDiperiksa(pegawaiId, target, null)
      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Disimpan.' })
      } else {
        // Dikembalikan ke keadaan sebenarnya: centang yang bertahan padahal
        // servernya menolak adalah kebohongan yang paling mudah dipercaya.
        setNyala(!target)
        tampilkan({ nada: 'bahaya', judul: 'Gagal menyimpan', keterangan: hasil.pesan })
      }
    })
  }

  return (
    <div className="mt-3 rounded-md border border-border bg-surface-2 px-3 py-2.5">
      <button
        type="button"
        role="switch"
        aria-checked={nyala}
        onClick={alihkan}
        disabled={pending}
        className="flex w-full items-start gap-2.5 text-left disabled:opacity-60"
      >
        <span
          aria-hidden
          className={[
            'mt-px flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
            nyala ? 'border-success bg-success text-white' : 'border-border bg-surface',
          ].join(' ')}
        >
          {nyala ? <ShieldCheck className="size-3" /> : null}
        </span>
        <span className="min-w-0">
          <span className="block text-[12px] font-medium text-text">
            Sudah diperiksa, tidak ada catatan hukuman disiplin
          </span>
          <span className="mt-0.5 block text-[11px] leading-relaxed text-text-subtle">
            {nyala && verifikasi !== null
              ? `Diperiksa ${verifikasi.olehNama ?? 'pengguna yang sudah dihapus'}${
                  verifikasi.pada ? ` · ${formatTanggalWaktu(verifikasi.pada)}` : ''
                }. Tekan untuk melepas tanda ini.`
              : nyala
                ? 'Menyimpan…'
                : 'Selama belum dicentang, skor Integritas tetap 100 — tapi angka itu berdasar ketiadaan catatan, bukan pemeriksaan. Butir kesiapan data "Rekam jejak disiplin terverifikasi" (bobot 3) juga masih kosong.'}
          </span>
          {nyala && verifikasi?.catatan ? (
            <span className="mt-1 block text-[11px] leading-relaxed text-text-muted">
              {verifikasi.catatan}
            </span>
          ) : null}
        </span>
      </button>
    </div>
  )
}
