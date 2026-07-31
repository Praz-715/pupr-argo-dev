import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/** Gabung class Tailwind dengan resolusi konflik. Dipakai semua komponen. */
export function cn(...kelas: ClassValue[]): string {
  return twMerge(clsx(kelas))
}
