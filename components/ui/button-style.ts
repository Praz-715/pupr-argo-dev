import { cva, type VariantProps } from 'class-variance-authority'

/**
 * Gaya tombol dipisah dari `button.tsx` (yang 'use client') supaya Server
 * Component bisa memakainya untuk elemen non-interaktif seperti `<Link>`,
 * tanpa menarik komponen klien ke server.
 */
export const gayaTombol = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors select-none disabled:pointer-events-none disabled:opacity-55',
  {
    variants: {
      variant: {
        utama: 'bg-accent text-accent-text hover:bg-accent-hover',
        sekunder: 'border border-border bg-surface text-text hover:bg-surface-3',
        halus: 'text-text-muted hover:bg-surface-3 hover:text-text',
        bahaya: 'bg-danger text-white hover:brightness-110',
        garisBahaya: 'border border-danger-border bg-danger-subtle text-danger hover:brightness-105',
      },
      size: {
        sm: 'h-8 px-2.5 text-[13px]',
        md: 'h-9 px-3.5',
        lg: 'h-10 px-4',
        ikon: 'size-8 p-0',
      },
    },
    defaultVariants: { variant: 'sekunder', size: 'md' },
  },
)

export type VarianTombol = VariantProps<typeof gayaTombol>
