'use client'

import { useEffect, useRef } from 'react'

/**
 * Gulirkan panel yang memuat komponen ini ke dalam pandangan begitu ia muncul.
 *
 * ## Kenapa DI DALAM panelnya, bukan di tombol yang membukanya
 *
 * Pola yang dipakai di sini: tautan pemicunya `scroll={false}` (supaya halaman
 * tidak melompat ke atas tiap kali daftarnya disaring), dan `#anchor` di URL tidak
 * menolong — panelnya dirender server di balik `<Suspense>`, jadi **saat navigasi
 * terjadi elemennya belum ada di DOM** dan peramban tidak punya apa pun untuk
 * dituju. Itu jebakan #1 di CLAUDE.md: menunggu sesuatu yang belum ada.
 *
 * Menaruhnya di dalam panel membalik urutannya — efeknya berjalan tepat ketika
 * panelnya benar-benar terpasang.
 *
 * ## `kunci` menentukan KAPAN ia mengulang
 *
 * Ganti `kunci` (mis. NIP kandidat, kode temuan) dan panel akan digulirkan lagi
 * walau komponennya tidak dipasang ulang. Tanpa itu, membuka rincian kedua dari
 * daftar yang sama tidak menggulir ke mana pun dan terbaca seperti klik yang tidak
 * tertangkap.
 *
 * ## Yang digulirkan
 *
 * Bawaannya **induk langsung** komponen ini — jadi taruh ia sebagai anak pertama
 * panelnya. Kalau panelnya membungkus lebih dalam, sebutkan `id` panelnya supaya
 * yang dituju kotak panel utuh, bukan bagian dalamnya (yang membuat judul panel
 * berhenti di atas layar).
 *
 * `prefers-reduced-motion` dihormati: bagi yang mematikan animasi, lompat langsung
 * lebih baik daripada gerakan yang tidak mereka minta.
 *
 * Catatan: yang menggulir di aplikasi ini `<main>`, bukan window (app shell
 * `h-dvh` + `overflow-hidden`). `scrollIntoView` menangani wadah gulir bersarang
 * sendiri — tapi kalau mengukurnya di uji, baca `main.scrollTop`, bukan
 * `window.scrollY` yang selalu 0.
 */
export function GulirKeSini({ kunci, id }: { kunci: string; id?: string }) {
  const jangkar = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const sendiri = jangkar.current
    if (!sendiri) return
    const sasaran =
      (id ? sendiri.closest(`#${CSS.escape(id)}`) : null) ?? sendiri.parentElement ?? sendiri
    const kurangiGerak = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    sasaran.scrollIntoView({ behavior: kurangiGerak ? 'auto' : 'smooth', block: 'start' })
  }, [kunci, id])

  // `hidden` + `aria-hidden`: ia jangkar posisi, bukan isi. Tanpa `aria-hidden`
  // pembaca layar mengumumkan elemen kosong di awal tiap panel.
  return <span ref={jangkar} aria-hidden className="hidden" />
}
