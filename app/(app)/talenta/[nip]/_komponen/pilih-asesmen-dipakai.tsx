'use client'

import { Check } from 'lucide-react'
import { useTransition } from 'react'

import { useToast } from '@/components/ui/toast'
import { pilihAsesmenDipakai } from '@/lib/aksi/profil'
import { cn } from '@/lib/cn'

/**
 * Pilih asesmen mana yang dipakai menilai pegawai ini (butir 2
 * `koreksi sistem informasi.pdf`).
 *
 * ## Kenapa kontrol ini perlu ada sama sekali
 *
 * Satu pegawai bisa diases pada beberapa JENJANG sekaligus, dan sumbernya memang
 * begitu: terukur 31 dari 32 pegawai di `Database Talenta Fungsional#binaka.xlsx`
 * punya dua nilai Potkom — satu di jenjang fungsionalnya, satu di jenjang
 * struktural. Keduanya sah, dan **hanya manusia yang bisa memutuskan mana yang
 * relevan** untuk penilaian yang sedang berjalan.
 *
 * Sebelum kontrol ini ada, pemenangnya ditentukan `id DESC` di
 * `urutAsesmenBerlaku()` — yaitu urutan impor. Itu bukan keputusan, itu kebetulan,
 * dan ia tidak pernah muncul sebagai galat.
 *
 * ## `role="radio"`, bukan checkbox
 *
 * Pilihannya **saling meniadakan**: `asesmen_dipakai` ber-PRIMARY KEY `pegawai_id`,
 * jadi satu pegawai paling banyak punya satu. Checkbox mengundang orang mencentang
 * dua lalu bingung kenapa yang pertama lepas sendiri.
 *
 * Baris yang sedang dipakai TIDAK bisa diklik untuk melepas dirinya sendiri —
 * "tidak ada asesmen yang dipakai" bukan keadaan yang berguna; ia hanya
 * mengembalikan pemilihan sewenang-wenang yang kontrol ini ada untuk mengakhiri.
 * Menggantinya dilakukan dengan memilih yang lain.
 */
export function PilihAsesmenDipakai({
  pegawaiId,
  asesmenId,
  dipakai,
  label,
  boleh,
}: {
  pegawaiId: number
  asesmenId: number
  dipakai: boolean
  /** Disebut di pesan sukses & label aksesibilitas — mis. "ADMINISTRATOR 2024". */
  label: string
  boleh: boolean
}) {
  const { tampilkan } = useToast()
  const [pending, mulai] = useTransition()

  if (!boleh) {
    return dipakai ? (
      <span className="inline-flex items-center gap-1 text-[11px] text-accent">
        <Check className="size-3.5" aria-hidden />
        Dipakai
      </span>
    ) : (
      <span className="text-[11px] text-text-subtle">—</span>
    )
  }

  return (
    <button
      type="button"
      role="radio"
      aria-checked={dipakai}
      aria-label={`Pakai asesmen ${label} untuk menilai pegawai ini`}
      disabled={pending || dipakai}
      onClick={() =>
        mulai(async () => {
          const hasil = await pilihAsesmenDipakai(pegawaiId, asesmenId)
          if (hasil.ok) {
            tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Pilihan diperbarui.' })
          } else {
            tampilkan({ nada: 'bahaya', judul: 'Gagal menyimpan', keterangan: hasil.pesan })
          }
        })
      }
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] transition-colors',
        dipakai
          ? 'cursor-default border-accent-border bg-accent-subtle text-text'
          : 'border-border bg-surface text-text-muted hover:border-accent hover:text-text',
        pending && 'opacity-60',
      )}
    >
      <Check className={cn('size-3.5', dipakai ? 'text-accent' : 'text-text-subtle')} aria-hidden />
      {dipakai ? 'Dipakai' : pending ? 'Menyimpan…' : 'Pakai ini'}
    </button>
  )
}
