import { cva, type VariantProps } from 'class-variance-authority'

/**
 * Gaya tombol dipisah dari `button.tsx` (yang 'use client') supaya Server
 * Component bisa memakainya untuk elemen non-interaktif seperti `<Link>`,
 * tanpa menarik komponen klien ke server.
 */
/**
 * Umpan balik TEKAN — ditambahkan 18 Agu 2026 atas permintaan user ("biar gak
 * double klik").
 *
 * Perlu diketahui apa yang sebenarnya ia selesaikan, supaya tidak dianggap
 * pengaman yang bukan tugasnya: pencegahan double-klik yang SUNGGUHAN sudah ada
 * di `button.tsx` — `disabled={disabled || sedangProses}` plus spinner dan
 * `aria-busy`, otomatis lewat `useFormStatus` untuk tombol submit. Yang belum
 * ada adalah umpan balik pada **detik pertama** klik: sebelum ini tombol tidak
 * bergerak sama sekali saat ditekan, jadi pada aksi yang responsnya tidak
 * seketika tidak ada apa pun yang menyatakan "kliknya masuk". Itu yang membuat
 * orang mengklik lagi.
 *
 * `translate-y-px`, bukan `scale`: menskalakan tombol ikut menskalakan
 * hurufnya dan teks jadi buram di tengah animasi. Dorongan 1px juga konsisten
 * dengan kosakata yang sudah dipakai sistem ini — kartu & sel Kotak 9 TERANGKAT
 * saat hover (`hover:-translate-y-0.5`), jadi tombol TERTEKAN saat diklik
 * melengkapi arah yang sama.
 *
 * `motion-safe:` wajib. Gerak kecil begini tidak berbahaya untuk sebagian besar
 * orang, tapi aturan repo ini sudah menghormati `prefers-reduced-motion` di tiga
 * tempat lain di `globals.css`, dan pengecualian yang tidak ada alasannya akan
 * jadi celah pertama saat aturan itu diaudit.
 *
 * ⚠️ Transisinya menyebut **`translate`**, BUKAN `transform`, dan itu bukan
 * gaya penulisan — di Tailwind v4 `translate-y-*` menyetel properti CSS
 * `translate` yang berdiri sendiri, bukan `transform`. Versi pertama perubahan
 * ini menulis `transition-[…,transform]`; terukur, `translate` berubah dari
 * `none` ke `0px 1px` saat ditekan sementara `transform` tetap `none` sepanjang
 * waktu, sehingga dorongannya terjadi SEKETIKA tanpa peluruhan — terbaca sebagai
 * kedutan, bukan tekanan. Kesalahan ini tidak menghasilkan galat apa pun dan
 * tidak terlihat dari membaca kode; ia hanya ketahuan dengan menahan tombol mouse
 * lalu mengukur kedua properti itu.
 *
 * `transform` tetap disertakan untuk utility lain yang masih memakainya.
 */
export const gayaTombol = cva(
  'inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium whitespace-nowrap transition-[color,background-color,border-color,translate,transform] duration-150 select-none motion-safe:active:translate-y-px disabled:pointer-events-none disabled:opacity-55',
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
