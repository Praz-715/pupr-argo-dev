import type { Metadata, Viewport } from 'next'

import { ThemeProvider } from '@/components/layout/theme-provider'
import { ToastProvider } from '@/components/ui/toast'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'SIMT DJBK — Sistem Informasi Manajemen Talenta',
    template: '%s · SIMT DJBK',
  },
  description:
    'Dashboard Talenta Terintegrasi Direktorat Jenderal Bina Konstruksi — pemetaan talenta, talent pool, dan rencana suksesi ASN.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning wajib: next-themes menempel class tema di <html>
    // sebelum React hydrate, supaya tidak ada kedipan tema saat reload.
    <html lang="id" suppressHydrationWarning>
      <body>
        {/* ToastProvider di akar, bukan di app shell: sejak Fase 7 ada halaman
            di luar app shell (masuk, ganti sandi wajib) yang juga perlu
            memberi umpan balik. Dua provider di dua grup route berarti dua
            antrean toast yang bisa saling menimpa saat pengguna berpindah. */}
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
