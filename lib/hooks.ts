'use client'

import { useCallback, useSyncExternalStore } from 'react'

/**
 * Hook berbagi untuk state yang sumbernya di LUAR React (localStorage,
 * status hidrasi). Memakai `useSyncExternalStore` — bukan `useEffect` +
 * `setState`, yang memicu cascading render dan dilarang React 19.
 */

const EVENT_PENYIMPANAN = 'simt-local-storage'

function langgananPenyimpanan(onPerubahan: () => void): () => void {
  // 'storage' hanya menyala untuk tab LAIN, jadi perubahan di tab ini
  // disiarkan lewat event kustom.
  window.addEventListener('storage', onPerubahan)
  window.addEventListener(EVENT_PENYIMPANAN, onPerubahan)
  return () => {
    window.removeEventListener('storage', onPerubahan)
    window.removeEventListener(EVENT_PENYIMPANAN, onPerubahan)
  }
}

/** Boolean yang tersimpan di localStorage & tersinkron antar tab. */
export function useLocalStorageBoolean(
  kunci: string,
  bawaan = false,
): readonly [boolean, (nilai: boolean) => void] {
  const nilai = useSyncExternalStore(
    langgananPenyimpanan,
    () => window.localStorage.getItem(kunci) === '1',
    () => bawaan,
  )

  const set = useCallback(
    (baru: boolean) => {
      window.localStorage.setItem(kunci, baru ? '1' : '0')
      window.dispatchEvent(new Event(EVENT_PENYIMPANAN))
    },
    [kunci],
  )

  return [nilai, set] as const
}

const langgananKosong = () => () => {}

/**
 * false saat render server & hidrasi pertama, true sesudahnya.
 * Untuk menunda hal yang cuma diketahui klien (tema aktif, animasi) tanpa
 * memicu ketidakcocokan hidrasi.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    langgananKosong,
    () => true,
    () => false,
  )
}
