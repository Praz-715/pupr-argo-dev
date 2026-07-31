'use client'

import type { ComponentProps, ReactNode } from 'react'
import { useFormStatus } from 'react-dom'

import { cn } from '@/lib/cn'
import { gayaTombol, type VarianTombol } from './button-style'
import { Spinner } from './spinner'

/**
 * Tombol dengan pending state BAWAAN — tidak ada klik mati (phase.md §5.2).
 *
 * Di dalam <form> yang memanggil server action, `useFormStatus` otomatis
 * membuat tombol disabled + spinner tanpa kode tambahan. Untuk aksi non-form,
 * kirim `pending` manual dari `useTransition`.
 */
export interface ButtonProps extends ComponentProps<'button'>, VarianTombol {
  /** Paksa pending dari luar (mis. `useTransition`). */
  pending?: boolean
  /** Label saat pending — beri tahu apa yang sedang terjadi. */
  labelPending?: ReactNode
  ikon?: ReactNode
}

export function Button({
  className,
  variant,
  size,
  pending,
  labelPending,
  ikon,
  children,
  disabled,
  type = 'button',
  ...props
}: ButtonProps) {
  // Otomatis ikut status submit form terdekat (kalau ada).
  const status = useFormStatus()
  const sedangProses = pending ?? (type === 'submit' ? status.pending : false)

  return (
    <button
      type={type}
      disabled={disabled || sedangProses}
      aria-busy={sedangProses || undefined}
      className={cn(gayaTombol({ variant, size }), className)}
      {...props}
    >
      {sedangProses ? <Spinner /> : ikon}
      {sedangProses && labelPending ? labelPending : children}
    </button>
  )
}
