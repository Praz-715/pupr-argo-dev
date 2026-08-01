'use client'

import { Eye, EyeOff, LogIn, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useActionState, useState } from 'react'

import { Bidang, kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { masuk } from '@/lib/aksi/auth'

/**
 * Formulir masuk.
 *
 * Dipasang sebagai `<form action={...}>`, **bukan** `onSubmit` yang memanggil
 * server action lewat `useTransition`. Bedanya bukan gaya: form `onSubmit`
 * tidak berfungsi sebelum React ter-hidrasi, dan yang terjadi kalau seseorang
 * menekan Enter pada detik-detik itu adalah pengiriman form HTML biasa — GET
 * dengan sandi terbawa di query string, lalu mengendap di riwayat peramban dan
 * log server. Bentuk ini ditangani Next lewat POST bahkan sebelum hidrasi.
 *
 * Aksinya **mengalihkan halaman** saat berhasil, jadi keadaan "sukses" tidak
 * pernah kembali ke sini — yang kembali hanya kegagalan.
 */
export function FormMasuk({ next, baruKeluar }: { next: string | null; baruKeluar: boolean }) {
  const [hasil, aksi, pending] = useActionState(masuk, null)
  const [lihatSandi, setLihatSandi] = useState(false)

  const galat = hasil && !hasil.ok ? (hasil.galatField ?? {}) : {}
  const pesan = hasil && !hasil.ok ? hasil.pesan : null

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-overlay)]">
      <h1 className="text-[17px] font-semibold tracking-tight text-text">Masuk</h1>
      <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
        Gunakan akun kepegawaian internal Anda.
      </p>

      {baruKeluar && !hasil ? (
        <p className="mt-4 rounded-md border border-border bg-surface-inset px-3 py-2 text-[12px] leading-relaxed text-text-muted">
          Anda sudah keluar. Sesi di perangkat ini sudah diakhiri.
        </p>
      ) : null}

      {pesan ? (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-md border border-danger-border bg-danger-subtle px-3 py-2.5"
        >
          <TriangleAlert className="mt-px size-4 shrink-0 text-danger" />
          <p className="text-[12px] leading-relaxed text-text">{pesan}</p>
        </div>
      ) : null}

      <form action={aksi} className="mt-5 space-y-3.5">
        {next ? <input type="hidden" name="next" value={next} /> : null}

        <Bidang label="Username atau email" galat={galat.identitas} wajib>
          <input
            name="identitas"
            autoComplete="username"
            autoFocus
            required
            disabled={pending}
            className={kelasInput(galat.identitas)}
            placeholder="mis. martyanti.rbs"
          />
        </Bidang>

        <Bidang label="Sandi" galat={galat.sandi} wajib>
          <span className="relative block">
            <input
              name="sandi"
              type={lihatSandi ? 'text' : 'password'}
              autoComplete="current-password"
              required
              disabled={pending}
              className={`${kelasInput(galat.sandi)} pr-9`}
            />
            <button
              type="button"
              onClick={() => setLihatSandi((s) => !s)}
              aria-label={lihatSandi ? 'Sembunyikan sandi' : 'Tampilkan sandi'}
              className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center text-text-subtle transition-colors hover:text-text"
            >
              {lihatSandi ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </span>
        </Bidang>

        <Button
          type="submit"
          className="w-full"
          labelPending="Memeriksa…"
          ikon={<LogIn className="size-4" />}
        >
          Masuk
        </Button>
      </form>

      <p className="mt-4 border-t border-border pt-4 text-[12px] text-text-muted">
        Lupa sandi?{' '}
        <Link
          href="/lupa-password"
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          Ajukan pengaturan ulang
        </Link>
      </p>
    </div>
  )
}
