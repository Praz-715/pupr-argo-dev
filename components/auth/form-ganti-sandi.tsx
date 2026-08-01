'use client'

import { KeyRound, TriangleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useActionState, useEffect, useRef } from 'react'

import { Bidang, kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { gantiSandiSaya } from '@/lib/aksi/auth'
import { PANJANG_MIN_SANDI } from '@/lib/sandi'

/**
 * Satu formulir ganti sandi, dipakai di DUA tempat: Profil Saya (sukarela) dan
 * halaman ganti sandi wajib setelah sandi diatur Super Admin.
 *
 * Keduanya menjalankan aturan yang sama persis, jadi menyalin komponennya
 * berarti dua daftar syarat sandi yang bisa berbeda — dan yang akan berbeda
 * adalah yang jarang dilihat, yaitu jalur wajib. Yang berbeda cuma bingkainya:
 * mode `wajib` mengirim penanda supaya server langsung mengalihkan ke aplikasi
 * setelah berhasil, karena halaman penahannya sudah tidak punya alasan ada.
 *
 * `<form action={...}>`, bukan `onSubmit` — alasan lengkapnya sama dengan
 * formulir masuk: sebelum hidrasi, `onSubmit` berarti sandi terkirim lewat GET.
 */
export function FormGantiSandi({
  username,
  wajib = false,
}: {
  username: string
  wajib?: boolean
}) {
  const router = useRouter()
  const { tampilkan } = useToast()
  const [hasil, aksi, pending] = useActionState(gantiSandiSaya, null)
  const formRef = useRef<HTMLFormElement>(null)
  const terakhirDitangani = useRef<unknown>(null)

  // Umpan balik sukses ditangani di sini, bukan di dalam aksi: server action
  // tidak bisa memunculkan toast, dan mode wajib sudah dialihkan server
  // sehingga cabang ini hanya berjalan untuk penggantian sukarela.
  useEffect(() => {
    if (!hasil || hasil === terakhirDitangani.current) return
    terakhirDitangani.current = hasil
    if (hasil.ok) {
      formRef.current?.reset()
      tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Sandi diperbarui.' })
      router.refresh()
    }
  }, [hasil, router, tampilkan])

  const galat = hasil && !hasil.ok ? (hasil.galatField ?? {}) : {}
  const pesan = hasil && !hasil.ok && !hasil.galatField ? hasil.pesan : null

  return (
    <form ref={formRef} action={aksi} className="space-y-3.5">
      {wajib ? <input type="hidden" name="wajib" value="1" /> : null}

      {pesan ? (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-md border border-danger-border bg-danger-subtle px-3 py-2.5"
        >
          <TriangleAlert className="mt-px size-4 shrink-0 text-danger" />
          <p className="text-[12px] leading-relaxed text-text">{pesan}</p>
        </div>
      ) : null}

      {/* Username tersembunyi tapi ADA di DOM: tanpa itu pengelola sandi
          browser tidak tahu akun mana yang sedang diubah, lalu menyimpan
          sandi barunya sebagai entri terpisah tanpa nama. */}
      <input type="text" name="username" value={username} autoComplete="username" readOnly hidden />

      <Bidang label="Sandi saat ini" galat={galat.sandiLama} wajib>
        <input
          name="sandiLama"
          type="password"
          autoComplete="current-password"
          autoFocus={wajib}
          required
          disabled={pending}
          className={kelasInput(galat.sandiLama)}
        />
      </Bidang>

      <Bidang
        label="Sandi baru"
        galat={galat.sandiBaru}
        wajib
        keterangan={`minimal ${PANJANG_MIN_SANDI} karakter, dua jenis karakter`}
      >
        <input
          name="sandiBaru"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
          className={kelasInput(galat.sandiBaru)}
        />
      </Bidang>

      <Bidang label="Ulangi sandi baru" galat={galat.konfirmasi} wajib>
        <input
          name="konfirmasi"
          type="password"
          autoComplete="new-password"
          required
          disabled={pending}
          className={kelasInput(galat.konfirmasi)}
        />
      </Bidang>

      <p className="text-[11px] leading-relaxed text-text-subtle">
        Sesi Anda di perangkat lain akan diakhiri setelah sandi berubah. Sesi di perangkat ini tetap
        berjalan.
      </p>

      <Button
        type="submit"
        className={wajib ? 'w-full' : undefined}
        labelPending="Menyimpan…"
        ikon={<KeyRound className="size-4" />}
      >
        Simpan sandi baru
      </Button>
    </form>
  )
}
