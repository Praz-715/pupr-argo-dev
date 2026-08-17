'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { Pilih } from '@/components/ui/pilih'
import { cn } from '@/lib/cn'
import type { Peran } from '@/lib/peran'
import {
  LABEL_TAHAP,
  PELAKU_TAHAP,
  TAHAP_NOMINASI,
  type Giliran,
  type TahapNominasi,
} from '@/lib/workflow'

/**
 * Penyaring antrian nominasi — **satu dropdown**, bukan deretan chip.
 *
 * Dua hal berubah pada 12 Agu 2026 atas permintaan user, dan keduanya soal yang
 * sama: kejelasan.
 *
 * 1. **Dari lima chip jadi satu dropdown.** Lima tombol berdampingan membuat
 *    penyaring terlihat seperti navigasi tab, padahal ia satu pilihan tunggal —
 *    dan barisnya ikut memakan ruang di halaman yang isinya tabel lebar.
 * 2. **Kosakatanya SAMA dengan kolom Status di tabel.** Sebelumnya penyaring
 *    berbicara "giliran" ("Menunggu Admin Talenta") sementara tabel berbicara
 *    "status" ("Lolos verifikasi") — dua taksonomi untuk satu kenyataan, jadi
 *    pengguna tidak bisa tahu opsi mana yang memunculkan baris mana. Sekarang
 *    keduanya memakai `TahapNominasi` dari `lib/workflow.ts`, dan tiap opsi
 *    menyebut siapa yang harus bertindak.
 *
 * Opsi "Menunggu saya" tetap didahulukan: pengguna datang ke halaman ini untuk
 * mengerjakan bagiannya, bukan untuk menelusuri seluruh antrian.
 */

/** Tahap yang menunggu tindakan peran tertentu. */
const TAHAP_PERAN: Partial<Record<Peran, TahapNominasi>> = {
  'Admin Talenta': 'VERIFIKASI',
  Pimpinan: 'APPROVAL',
  'Pengelola Unit': 'REVISI',
}

export function FilterNominasi({
  tahap,
  giliran,
  peran,
}: {
  tahap: TahapNominasi | null
  /** Jalur lama `?giliran=` — masih dihormati supaya bookmark tidak mati. */
  giliran: Giliran | null
  peran: Peran | null
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  const tahapSaya = peran === null ? undefined : TAHAP_PERAN[peran]

  function pilih(nilai: string) {
    const params = new URLSearchParams(searchParams.toString())
    // `giliran` selalu dibuang saat memilih: membiarkannya berarti dua penyaring
    // hidup bersamaan di URL, dan yang satu diam-diam menang.
    params.delete('giliran')
    if (nilai === '') params.delete('tahap')
    else params.set('tahap', nilai)
    const q = params.toString()
    mulaiTransisi(() => router.push(q === '' ? pathname : `${pathname}?${q}`, { scroll: false }))
  }

  const opsi = [
    { nilai: '', label: 'Semua tahap' },
    ...(tahapSaya !== undefined
      ? [{ nilai: tahapSaya, label: `Menunggu saya — ${LABEL_TAHAP[tahapSaya]}` }]
      : []),
    ...TAHAP_NOMINASI.filter((t) => t !== tahapSaya).map((t) => ({
      nilai: t,
      label: `${LABEL_TAHAP[t]} · ${PELAKU_TAHAP[t]}`,
    })),
  ]

  return (
    <div className={cn('flex flex-wrap items-center gap-2', pending && 'opacity-60')}>
      <span className="text-[11px] font-medium text-text-subtle">Tahap</span>
      <Pilih
        label="Tahap nominasi"
        nilai={tahap ?? ''}
        onUbah={pilih}
        opsi={opsi}
        lebar="w-[22rem] max-w-full"
      />
      {giliran !== null && tahap === null ? (
        <span className="text-[11px] text-text-subtle">
          Menyaring dengan tautan lama (<code className="text-text-muted">giliran</code>) — pilih
          tahap di atas untuk beralih.
        </span>
      ) : null}
    </div>
  )
}
