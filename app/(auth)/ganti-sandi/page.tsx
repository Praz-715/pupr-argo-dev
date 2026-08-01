import { KeyRound } from 'lucide-react'
import { redirect } from 'next/navigation'

import { FormGantiSandi } from '@/components/auth/form-ganti-sandi'
import { wajibMasuk } from '@/lib/auth'

export const metadata = { title: 'Ganti Sandi' }

/**
 * Ganti sandi WAJIB — sandi akun ini terakhir diatur orang lain.
 *
 * Berada di grup `(auth)`, bukan di app shell, dan itu disengaja: selama sandi
 * yang berlaku masih diketahui Super Admin, apa pun yang dilakukan akun ini
 * tidak bisa dipertanggungjawabkan sebagai perbuatan pemiliknya. Jadi jalan
 * keluarnya cuma dua — mengganti sandi, atau keluar — dan navigasi yang
 * lengkap hanya akan menyarankan jalan ketiga yang tidak ada.
 */
export default async function GantiSandiPage() {
  const sesi = await wajibMasuk('/ganti-sandi')

  // Sudah tidak wajib (mis. halaman ini dibuka manual) → tidak perlu ditahan.
  if (!sesi.harusGantiSandi) redirect('/profil')

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-overlay)]">
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning-subtle"
        >
          <KeyRound className="size-4.5 text-warning" />
        </span>
        <div className="min-w-0">
          <h1 className="text-[16px] font-semibold tracking-tight text-text">
            Ganti sandi Anda dulu
          </h1>
          <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
            Sandi yang Anda pakai sekarang dibuatkan Super Admin, jadi bukan hanya Anda yang
            mengetahuinya. Selama belum diganti, tindakan atas nama akun ini belum bisa dianggap
            perbuatan Anda — karena itu aplikasi belum bisa dibuka.
          </p>
        </div>
      </div>

      <div className="mt-5 border-t border-border pt-5">
        <FormGantiSandi username={sesi.pengguna.username} wajib />
      </div>

      <p className="mt-4 border-t border-border pt-4 text-[12px] text-text-muted">
        Masuk sebagai <span className="font-medium text-text">{sesi.pengguna.nama}</span> (
        {sesi.pengguna.username}). Bukan Anda?{' '}
        <a href="/masuk?keluar=1" className="font-medium text-accent underline-offset-2 hover:underline">
          Keluar
        </a>
      </p>
    </div>
  )
}
