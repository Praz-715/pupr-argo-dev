'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'

/**
 * Hook berbagi untuk state yang sumbernya di LUAR React (localStorage,
 * status hidrasi). Memakai `useSyncExternalStore` — bukan `useEffect` +
 * `setState`, yang memicu cascading render dan dilarang React 19.
 */

const EVENT_PENYIMPANAN = 'simt-local-storage'

/**
 * `localStorage` TIDAK selalu tersedia, dan aksesnya tidak selalu gagal dengan
 * mengembalikan null — **ia melempar**. `window.localStorage` melempar
 * `SecurityError` ketika site data diblokir, di sebagian mode privat, di bawah
 * kebijakan enterprise, dan di dalam iframe/webview yang partisi penyimpanannya
 * dimatikan (termasuk Simple Browser milik VS Code, yang dipakai untuk membuka
 * port yang diteruskan). `setItem` juga melempar `QuotaExceededError`.
 *
 * Kenapa ini penting jauh melampaui satu tombol: pembacaannya terjadi di dalam
 * `getSnapshot` milik `useSyncExternalStore`, yaitu **saat render**. Lemparan di
 * sana bukan cuma menggagalkan komponennya — ia menggagalkan HIDRASI, dan
 * halaman yang gagal terhidrasi tetap tampak sempurna karena HTML-nya sudah
 * dikirim server. Akibatnya SELURUH kontrol interaktif mati sekaligus tanpa
 * satu pun pesan galat di layar: pengalih tema, command palette, menu pengguna,
 * ciutkan sidebar. Dan karena class tema dipasang oleh inline script
 * next-themes yang berjalan SEBELUM React, temanya terkunci di nilai terakhir
 * yang sempat terpasang — gejalanya terbaca sebagai "tema mentok di gelap",
 * yang menuntun diagnosis ke arah yang salah sama sekali.
 *
 * Karena itu penyimpanannya gagal DIAM tapi APLIKASINYA tetap hidup: preferensi
 * tidak bertahan antar kunjungan, dan itu jauh lebih baik daripada aplikasi
 * yang sepenuhnya tidak bisa diklik.
 */
function bacaPenyimpanan(kunci: string): string | null {
  try {
    return window.localStorage.getItem(kunci)
  } catch {
    return null
  }
}

function tulisPenyimpanan(kunci: string, nilai: string): void {
  try {
    window.localStorage.setItem(kunci, nilai)
  } catch {
    // Diabaikan dengan sengaja — lihat catatan di atas.
  }
}

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

/**
 * Boolean yang tersimpan di localStorage & tersinkron antar tab.
 *
 * Saat penyimpanan tidak tersedia, nilainya jatuh ke `bawaan` dan perubahan
 * hanya berlaku selama sesi — tombolnya tetap bekerja.
 */
export function useLocalStorageBoolean(
  kunci: string,
  bawaan = false,
): readonly [boolean, (nilai: boolean) => void] {
  // Cadangan dalam memori: tanpa ini, klik pada tombol yang penyimpanannya
  // diblokir tidak mengubah apa pun, sebab getSnapshot selalu membaca null.
  // Yang terlihat pengguna: tombolnya mati. Sama buruknya dengan bug aslinya.
  const nilai = useSyncExternalStore(
    langgananPenyimpanan,
    () => {
      const tersimpan = bacaPenyimpanan(kunci)
      if (tersimpan !== null) return tersimpan === '1'
      return cadangan.get(kunci) ?? bawaan
    },
    () => bawaan,
  )

  const set = useCallback(
    (baru: boolean) => {
      cadangan.set(kunci, baru)
      tulisPenyimpanan(kunci, baru ? '1' : '0')
      window.dispatchEvent(new Event(EVENT_PENYIMPANAN))
    },
    [kunci],
  )

  return [nilai, set] as const
}

/** Nilai per-kunci untuk sesi ini saja, dipakai kalau localStorage diblokir. */
const cadangan = new Map<string, boolean>()

/** Cadangan dalam memori untuk himpunan string (lihat `useLocalStorageSet`). */
const cadanganSet = new Map<string, string>()

/**
 * Himpunan string yang tersimpan di localStorage & tersinkron antar tab.
 *
 * Dipakai untuk "grup sidebar mana yang sedang diciutkan". **Sengaja SATU kunci
 * berisi himpunan, bukan satu kunci boolean per grup**: jumlah grup berbeda
 * menurut peran pengguna, dan memanggil `useLocalStorageBoolean` di dalam
 * `map()` atas daftar yang panjangnya bisa berubah melanggar rules-of-hooks —
 * React mencocokkan hook menurut URUTAN pemanggilan, sehingga Viewer (grup lebih
 * sedikit) dan Super Admin akan memetakan state ke grup yang berbeda.
 *
 * `getSnapshot` mengembalikan **string mentahnya**, bukan `Set` yang baru
 * dibuat. Itu wajib: `useSyncExternalStore` membandingkan hasil snapshot dengan
 * `Object.is`, jadi mengembalikan objek baru setiap kali membuat React
 * menganggap store berubah terus dan render menjadi tak berhenti. Pemanggil
 * yang mengubahnya jadi `Set` lewat `useMemo`.
 */
export function useLocalStorageSet(
  kunci: string,
): readonly [ReadonlySet<string>, (nilai: string) => void] {
  const mentah = useSyncExternalStore(
    langgananPenyimpanan,
    () => bacaPenyimpanan(kunci) ?? cadanganSet.get(kunci) ?? '',
    () => '',
  )

  const himpunan = useMemo(() => {
    if (!mentah) return new Set<string>()
    try {
      const urai: unknown = JSON.parse(mentah)
      return new Set(Array.isArray(urai) ? urai.map(String) : [])
    } catch {
      // Isi rusak (disunting tangan, atau format lama) diperlakukan sebagai
      // kosong, bukan dilempar: preferensi tampilan tidak boleh mematikan
      // navigasi. Penulisan berikutnya menimpanya dengan bentuk yang benar.
      return new Set<string>()
    }
  }, [mentah])

  const alih = useCallback(
    (nilai: string) => {
      const baru = new Set(himpunan)
      if (baru.has(nilai)) baru.delete(nilai)
      else baru.add(nilai)
      const teks = JSON.stringify([...baru])
      cadanganSet.set(kunci, teks)
      tulisPenyimpanan(kunci, teks)
      window.dispatchEvent(new Event(EVENT_PENYIMPANAN))
    },
    [himpunan, kunci],
  )

  return [himpunan, alih] as const
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
