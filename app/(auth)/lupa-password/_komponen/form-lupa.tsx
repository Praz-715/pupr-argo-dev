'use client'

import { CheckCircle2, Send, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useActionState } from 'react'

import { Bidang, kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { mintaResetSandi } from '@/lib/aksi/auth'

/**
 * Formulir Lupa Password.
 *
 * **Halaman ini tidak mengirim email, dan ia mengatakannya.** Belum ada
 * transport surel yang diputuskan (lihat `doc/sql/012_auth.sql`), jadi janji
 * "cek kotak masuk Anda" akan membuat orang menunggu sesuatu yang tidak akan
 * datang — dan mereka tidak akan melapor, karena mengira itu salahnya sendiri.
 *
 * Balasan sukses **selalu sama**, terdaftar atau tidak: pesan yang membedakan
 * keduanya mengubah halaman ini jadi alat mendata siapa saja yang punya akun.
 */
export function FormLupa() {
  const [hasil, aksi, pending] = useActionState(mintaResetSandi, null)

  if (hasil?.ok) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-overlay)]">
        <div className="flex items-start gap-2.5">
          <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" />
          <div>
            <h1 className="text-[15px] font-semibold text-text">Permintaan tercatat</h1>
            <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{hasil.data.pesan}</p>
          </div>
        </div>
        <Link
          href="/masuk"
          className="mt-5 block w-full rounded-md border border-border bg-surface px-3 py-2 text-center text-[13px] font-medium text-text transition-colors hover:bg-surface-3"
        >
          Kembali ke halaman masuk
        </Link>
      </div>
    )
  }

  const galat = hasil && !hasil.ok ? (hasil.galatField ?? {}) : {}
  const pesan = hasil && !hasil.ok && !hasil.galatField ? hasil.pesan : null

  return (
    <div className="rounded-xl border border-border bg-surface p-6 shadow-[var(--shadow-overlay)]">
      <h1 className="text-[17px] font-semibold tracking-tight text-text">Lupa sandi</h1>
      <p className="mt-1 text-[13px] leading-relaxed text-text-muted">
        Isi email akun Anda. Permintaan diteruskan ke Super Admin untuk diatur ulang.
      </p>

      <div className="mt-4 rounded-md border border-border bg-surface-inset px-3 py-2.5">
        <p className="text-[12px] leading-relaxed text-text-muted">
          <span className="font-medium text-text">Tidak ada email yang dikirim.</span> Sistem belum
          terhubung ke layanan surel, jadi tidak ada tautan reset otomatis. Super Admin akan
          mengatur ulang sandi Anda dan menyerahkan sandi sementara lewat jalur kepegawaian — dan
          Anda akan diminta menggantinya saat masuk.
        </p>
      </div>

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
        <Bidang label="Email akun" galat={galat.email} wajib>
          <input
            name="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            disabled={pending}
            className={kelasInput(galat.email)}
            placeholder="nama.anda@djbk.pu.go.id"
          />
        </Bidang>

        <Button
          type="submit"
          className="w-full"
          labelPending="Mengirim…"
          ikon={<Send className="size-4" />}
        >
          Ajukan pengaturan ulang
        </Button>
      </form>

      <p className="mt-4 border-t border-border pt-4 text-[12px] text-text-muted">
        Ingat sandinya?{' '}
        <Link href="/masuk" className="font-medium text-accent underline-offset-2 hover:underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </div>
  )
}
