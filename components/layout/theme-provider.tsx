'use client'

import { ThemeProvider as NextThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'

/**
 * Tema terang & gelap wajib sejak awal (CLAUDE.md). Strategi `class` supaya
 * cocok dengan `@custom-variant dark` di globals.css; `disableTransitionOnChange`
 * mencegah seluruh halaman ikut beranimasi saat tema ditukar.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      storageKey="simt-tema"
    >
      {children}
    </NextThemeProvider>
  )
}
