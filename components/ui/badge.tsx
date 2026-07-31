import { cva, type VariantProps } from 'class-variance-authority'
import type { ReactNode } from 'react'

import { cn } from '@/lib/cn'

const gayaBadge = cva(
  'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap',
  {
    variants: {
      tone: {
        netral: 'border-neutral-border bg-neutral-subtle text-text-muted',
        aksen: 'border-accent-border bg-accent-subtle text-accent',
        sukses: 'border-success-border bg-success-subtle text-success',
        peringatan: 'border-warning-border bg-warning-subtle text-warning',
        bahaya: 'border-danger-border bg-danger-subtle text-danger',
      },
    },
    defaultVariants: { tone: 'netral' },
  },
)

export interface BadgeProps extends VariantProps<typeof gayaBadge> {
  children: ReactNode
  className?: string
  title?: string
}

export function Badge({ tone, children, className, title }: BadgeProps) {
  return (
    <span title={title} className={cn(gayaBadge({ tone }), className)}>
      {children}
    </span>
  )
}

/** Titik status kecil — untuk traffic light kesehatan data. */
export function StatusDot({
  tone = 'netral',
  className,
}: {
  tone?: 'netral' | 'sukses' | 'peringatan' | 'bahaya'
  className?: string
}) {
  const warna = {
    netral: 'bg-neutral',
    sukses: 'bg-success',
    peringatan: 'bg-warning',
    bahaya: 'bg-danger',
  }[tone]

  return <span aria-hidden className={cn('inline-block size-2 shrink-0 rounded-full', warna, className)} />
}
