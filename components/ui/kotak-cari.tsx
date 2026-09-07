'use client'

import { Search, X } from 'lucide-react'
import { useRef, useState } from 'react'

import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/cn'

/**
 * Kotak pencarian yang menjalankan pencariannya saat **Enter**, bukan per huruf.
 *
 * Permintaan pemilik proses 2 Sep 2026: *"buat semua search yang ada di web trigger
 * enter semua ya, gausah langsung cari per huruf."* Sebelumnya tiap kotak memakai
 * debounce ~300 ms, jadi mengetik "ahmad" berarti beberapa kali navigasi — tiap
 * satunya kueri ke server dan satu render ulang — dan hasilnya berganti-ganti di
 * bawah jari saat katanya belum selesai diketik.
 *
 * ## Kenapa satu komponen, bukan disunting di sepuluh berkas
 *
 * Kotak pencarian tersebar di sebelas halaman dan semuanya menyalin bentuk yang
 * sama (ikon kaca, debounce, penanda "mencari"). Disunting satu per satu, yang
 * berikutnya ditambahkan akan menyalin bentuk LAMA — dan perilaku pencarian jadi
 * berbeda antar halaman tanpa ada yang menyadarinya. Aturan yang sama dengan
 * `Bidang` & `AksesDitolak` yang diangkat ke sini di Fase 7.
 *
 * ## Bentuknya `<form>`, bukan `onKeyDown === 'Enter'`
 *
 * Dengan form, Enter datang gratis dari peramban, ikon kacanya jadi tombol submit
 * yang benar-benar berfungsi, dan wilayahnya diumumkan sebagai pencarian
 * (`role="search"`). Menangkap tombolnya sendiri berarti menulis ulang perilaku
 * baku, dan biasanya kurang satu jalur — mis. Enter dari papan ketik layar ponsel.
 *
 * ## Tombol bersihkan WAJIB ada
 *
 * Selama pencariannya jalan per huruf, mengosongkan kotak sudah cukup untuk
 * mengembalikan daftarnya. Sejak ia menunggu Enter, kotak yang dikosongkan tanpa
 * Enter meninggalkan hasil lama di layar sementara kotaknya sudah kosong — dua hal
 * yang bertentangan dalam satu tampilan. Esc melakukan hal yang sama.
 *
 * ## Jangan dipakai untuk penyaring KLIEN yang instan
 *
 * Command palette (Ctrl/⌘+K) sengaja TIDAK memakai komponen ini: di sana Enter
 * sudah berarti "buka item yang sedang disorot", dan menyaring per huruf memang
 * seluruh gunanya.
 */
export function KotakCari({
  nilaiAwal,
  onCari,
  placeholder = 'Cari…',
  label,
  pending = false,
  className,
  autoFocus = false,
  disabled = false,
}: {
  /** Nilai dari sumber kebenarannya (URL / props). Perubahan dari luar ikut masuk. */
  nilaiAwal: string
  onCari: (nilai: string) => void
  placeholder?: string
  /** `aria-label` — wajib, sebab kotak ini tidak punya `<label>` yang terlihat. */
  label: string
  pending?: boolean
  className?: string
  autoFocus?: boolean
  disabled?: boolean
}) {
  const kotak = useRef<HTMLInputElement | null>(null)
  const [nilai, setNilai] = useState(nilaiAwal)

  /*
    Terkendali, dan ikut ketika URL berubah dari LUAR — tombol back, tautan dari
    halaman lain yang membawa `?cari=`, atau tombol Reset penyaring.
    Disinkronkan lewat state "terakhir dilihat", BUKAN `useEffect` (lint repo ini
    menolak `setState` di dalam effect) dan BUKAN menulis `ref.current` saat render
    (`react-hooks/refs` menolaknya, dan benar: itu mutasi DOM di luar commit).

    Terkendali di sini tidak mahal: yang dibayar tiap ketikan cuma render komponen
    kecil ini. Yang dulu mahal — dan yang pemilik proses keluhkan — adalah
    NAVIGASI per ketikan, dan itu sekarang hanya terjadi saat Enter.

    Sengaja BUKAN `key={nilaiAwal}` pada inputnya: itu me-remount elemennya tiap
    kali pencarian selesai, dan fokus melompat ke `<body>` — terukur di halaman
    Rencana Pengembangan sebelum diperbaiki.
  */
  const [awalTerakhir, setAwalTerakhir] = useState(nilaiAwal)
  if (nilaiAwal !== awalTerakhir) {
    setAwalTerakhir(nilaiAwal)
    setNilai(nilaiAwal)
  }

  function bersihkan() {
    setNilai('')
    kotak.current?.focus()
    onCari('')
  }

  return (
    <form
      role="search"
      className={cn('relative', className)}
      onSubmit={(e) => {
        e.preventDefault()
        onCari(nilai.trim())
      }}
    >
      {/*
        Nama tombol ini SENGAJA berbeda dari `label` kotaknya. Sempat sama, dan
        akibatnya dua elemen dalam satu form punya nama aksesibel identik: pembaca
        layar mengumumkan keduanya sebagai hal yang sama, dan `getByLabel()` di
        harness mendarat di TOMBOLNYA — sehingga uji "mengetik tidak memicu
        pencarian" lulus tanpa pernah mengetik apa pun. Hijau yang tidak berarti
        apa-apa, ditemukan 2 Sep 2026.
      */}
      <button
        type="submit"
        aria-label="Jalankan pencarian"
        title="Cari (Enter)"
        disabled={disabled}
        className="absolute top-1/2 left-1 -translate-y-1/2 rounded p-1.5 text-text-subtle hover:text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      >
        <Search className="size-3.5" />
      </button>
      <input
        ref={kotak}
        value={nilai}
        onChange={(e) => setNilai(e.target.value)}
        type="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        disabled={disabled}
        onKeyDown={(e) => {
          if (e.key === 'Escape') bersihkan()
        }}
        placeholder={placeholder}
        aria-label={`${label} — tekan Enter untuk mencari`}
        className="h-8 w-full rounded-md border border-border bg-surface pr-20 pl-8 text-[13px] text-text outline-none placeholder:text-text-subtle focus:border-accent disabled:opacity-60"
      />
      <span className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
        {pending ? (
          <span className="flex items-center gap-1 text-[10px] text-text-subtle">
            <Spinner className="size-3" />
            mencari
          </span>
        ) : nilai !== '' || nilaiAwal !== '' ? (
          <button
            type="button"
            onClick={bersihkan}
            aria-label="Bersihkan pencarian"
            title="Bersihkan pencarian (Esc)"
            className="rounded p-1 text-text-subtle hover:text-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          >
            <X className="size-3.5" />
          </button>
        ) : null}
      </span>
    </form>
  )
}
