import { cn } from '@/lib/cn'

/**
 * Lambang resmi Kementerian Pekerjaan Umum — monogram "PU".
 *
 * Path & warna diporting dari v1 (`web/app/(app)/Logo.tsx`), yang mengambilnya
 * dari berkas resmi Wikimedia Commons. Digambar sebagai vektor, bukan raster:
 * lambang ini tampil dari 28px (sidebar) sampai 420px (watermark panel masuk),
 * dan versi raster akan pecah di ujung besarnya.
 *
 * **Monogramnya MEMANG mengisi penuh bidangnya (full-bleed) — itu desainnya,
 * bukan path yang terpotong.** Catatan ini ada karena selama satu sesi ia
 * salah dinilai justru begitu: `getBBox()` memberi bbox 25000×25000 di viewBox
 * 25000×25000 (nol ruang kosong), dan itu disimpulkan sebagai tanda satu
 * `<path>` yang terambil dari berkas bermultipath. Alasannya keliru — premisnya
 * "tidak ada lambang resmi tanpa ruang kosong", dan lambang ini justru
 * membantahnya. Yang membuktikan: watermark di foto resmi Kementerian PU
 * memperlihatkan monogram yang sama. **Jangan "perbaiki" viewBox-nya.** Kalau
 * butuh ruang kosong di sekitarnya, beri padding pada wadahnya.
 *
 * `sumber` tetap ada supaya operator bisa menimpanya dengan berkas resmi yang
 * lebih baru (`public/logo-pu.svg`) tanpa menyunting kode — lambang instansi
 * bisa berubah, dan ketika itu terjadi jangan sampai perlu rilis kode.
 *
 * Warnanya hardcoded, dan itu pengecualian sah atas larangan warna hardcoded
 * (CLAUDE.md §Desain UI/UX): `#FCB717` dan `#223468` adalah warna resmi
 * lambang, bukan permukaan yang boleh mengikuti tema. Lambang yang berubah
 * warna menurut preferensi tampilan pengguna bukan lagi lambang yang sama —
 * yang menyesuaikan diri dengan latar adalah PILIHAN VARIAN, bukan nilainya.
 */

const JALUR_PU =
  'M-5.27 16098.87l0 8906.4 1234.81 -1.27c0.3,-470.09 72.67,-878.56 151.02,-1358.94 536.59,-3422.02 4807.04,-5863.69 8703.93,-4208.85 1802.7,765.53 3139.71,2432.12 3420.41,4221.76 79.37,506.02 31.26,859.25 45.12,1347.3l11444.71 0 0 -8274.18 -1376.08 1.42c-69,644.09 -12.16,1000.67 -277.01,1995.14 -612.37,1605.96 -2146.54,2806.04 -4123.41,2974.36 -2884.37,245.59 -5150.72,-1734.96 -5313.67,-4063.29 -63.74,-910.75 -11.8,-3334.53 -11.8,-4409.27l0 -13224.18 -10114.13 0 1.74 1682.09c1458.18,58.7 2499.44,259.38 3617.57,786.31 4446.11,2095.28 5699.69,7125.95 2813.75,10676.01 -1313.62,1615.93 -3378.29,2740.22 -5723.48,2919.5 -860.9,65.82 -3463.28,29.69 -4493.48,29.69z'

/** Warna resmi lambang. Bukan design token — lihat catatan di atas. */
const EMAS_RESMI = '#FCB717'
const NAVY_RESMI = '#223468'

export type VarianLogo = 'kotak' | 'navy' | 'emas' | 'putih'

export function LogoPU({
  sumber = null,
  size = 32,
  varian = 'kotak',
  className,
  /**
   * Lambang biasanya berdampingan dengan teks yang sudah menyebut institusinya.
   * Dalam hal itu ia dekoratif dan JANGAN diberi nama aksesibel — pembaca layar
   * akan mengucapkan institusinya dua kali. Setel `true` hanya ketika lambangnya
   * berdiri sendiri.
   */
  bermakna = false,
}: {
  /** Hasil `logoResmi()`. Kalau ada, berkas itu menimpa lambang bawaan. */
  sumber?: string | null
  size?: number
  /**
   * `kotak` — dasar emas penuh + monogram navy. Satu-satunya varian yang
   *   berkontras di ATAS LATAR APA PUN, jadi ini bawaannya.
   * `navy`  — monogram navy transparan, untuk latar terang.
   * `emas`  — monogram emas transparan, untuk latar navy/gelap.
   * `putih` — monogram putih transparan, untuk di atas foto ber-scrim.
   */
  varian?: VarianLogo
  className?: string
  bermakna?: boolean
}) {
  const aksesibilitas = bermakna
    ? { role: 'img' as const, 'aria-label': 'Lambang Kementerian Pekerjaan Umum' }
    : { 'aria-hidden': true as const }

  if (sumber) {
    return (
      // <img>, bukan next/image: berkasnya SVG (tidak dioptimasi Next), dan
      // komponen ini dipakai di Client Component juga. Berkas resmi TIDAK
      // diwarnai ulang — warnanya bagian dari lambangnya.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={sumber}
        alt={bermakna ? 'Lambang Kementerian Pekerjaan Umum' : ''}
        width={size}
        height={size}
        className={cn('block shrink-0 object-contain', className)}
      />
    )
  }

  const warnaMonogram =
    varian === 'emas' ? EMAS_RESMI : varian === 'putih' ? '#ffffff' : NAVY_RESMI

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 25000 25000"
      className={cn('block shrink-0', className)}
      // Radius mengikuti proporsi, bukan nilai px tetap: satu komponen dipakai
      // dari 28px sampai 420px, dan radius tetap akan terlihat nyaris kotak di
      // ukuran besar sekaligus nyaris bulat di ukuran kecil.
      style={{ borderRadius: varian === 'kotak' ? '18%' : undefined }}
      {...aksesibilitas}
    >
      {varian === 'kotak' ? <rect width="25000" height="25000" fill={EMAS_RESMI} /> : null}
      <path fill={warnaMonogram} d={JALUR_PU} />
    </svg>
  )
}
