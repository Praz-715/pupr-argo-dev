import { NextResponse, type NextRequest } from 'next/server'

/**
 * Gerbang cepat, **bukan** otoritas.
 *
 * Middleware berjalan di runtime edge dan tidak bisa menyentuh MySQL, jadi ia
 * tidak mungkin tahu apakah sebuah sesi masih hidup, sudah dicabut, atau
 * pemiliknya sudah dinonaktifkan. Yang bisa ia lakukan cuma satu: melihat ada
 * tidaknya cookie. Itu berguna — permintaan tanpa cookie sama sekali (tautan
 * yang dibagikan, tab lama, bot) dialihkan tanpa merender apa pun — tapi
 * **tidak boleh dianggap sebagai penjagaan**.
 *
 * Penjagaan yang sebenarnya ada di dua tempat yang memang bisa membaca DB:
 *
 *   1. `app/(app)/layout.tsx` memanggil `wajibMasuk()` sebelum halaman apa pun
 *      dirender — di sinilah sesi divalidasi.
 *   2. `assertPeran()` / `jalankanMutasi()` di setiap server action — di
 *      sinilah wewenang ditegakkan, dan ia tidak peduli middleware berkata apa.
 *
 * Menaruh RBAC di middleware akan terasa rapi dan salah: cookie yang ada tapi
 * sudah dicabut akan lolos, dan peran tidak tersimpan di cookie sama sekali.
 */

const COOKIE_SESI = 'simt_sesi'

/** Halaman yang memang harus bisa dibuka tanpa sesi. */
const RUTE_PUBLIK = ['/masuk', '/lupa-password']

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl
  const punyaCookie = req.cookies.has(COOKIE_SESI)
  const publik = RUTE_PUBLIK.some((r) => pathname === r || pathname.startsWith(`${r}/`))

  if (publik) {
    /**
     * **Halaman masuk TIDAK dipantulkan dari sini, walau cookie-nya ada.**
     *
     * Versi pertama melakukannya ("sudah punya cookie → antar ke dashboard")
     * dan itu lingkaran tak berujung untuk kasus yang justru paling sering
     * terjadi: cookie masih ada tapi sesinya sudah mati — kedaluwarsa, dicabut,
     * atau akunnya dinonaktifkan Super Admin. Alurnya: `/profil` → layout
     * menolak → `/masuk` → middleware melihat cookie → `/` → layout menolak →
     * `/masuk` → … sampai peramban menyerah dengan ERR_TOO_MANY_REDIRECTS.
     *
     * Middleware tidak bisa membedakan cookie yang hidup dari yang mati (tidak
     * ada akses DB di edge), jadi ia tidak boleh mengambil keputusan yang
     * bergantung pada beda itu. Pemantulannya dilakukan halaman `/masuk`
     * sendiri, yang memang memeriksa sesinya ke database.
     */
    return NextResponse.next()
  }

  if (!punyaCookie) {
    const url = new URL('/masuk', req.url)
    const tujuan = `${pathname}${search}`
    if (tujuan !== '/') url.searchParams.set('next', tujuan)
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  /**
   * Aset statis & berkas Next dilewati di sini, bukan dengan `if` di dalam
   * fungsi: middleware yang jalan untuk setiap potongan JavaScript adalah
   * biaya yang dibayar ribuan kali per halaman.
   *
   * **`api/` juga dilewati, dan itu bukan kelonggaran.** Gerbang di berkas ini
   * memeriksa **cookie sesi** — mekanisme yang sama sekali tidak dipakai kedua
   * permukaan `api/`:
   *
   *   - `api/v1/*` diautentikasi **Bearer token** (Fase 9). Mengalihkannya ke
   *     `/masuk` membuat instansi eksternal menerima **307 + HTML halaman login**
   *     alih-alih 401 JSON — klien akan menyimpulkan endpoint-nya pindah, bukan
   *     bahwa tokennya salah. Ini benar-benar terjadi saat Fase 9 pertama diuji.
   *   - `api/internal/*` dipakai peramban yang memang bawa cookie, tapi
   *     balasannya **berkas unduhan**. Sesi yang kedaluwarsa di tengah jalan akan
   *     menghasilkan berkas HTML bernama `.csv` — bentuk kegagalan yang paling
   *     membingungkan yang bisa dipilih.
   *
   * Keduanya menegakkan aksesnya sendiri di route handler (`getCurrentUser()` →
   * 401 untuk internal, `gerbangApi()` → 401/403 untuk v1), jadi melewatkannya di
   * sini tidak melonggarkan apa pun — ia memindahkan penolakan ke lapisan yang
   * bisa membalas dalam bentuk yang dimengerti pemanggilnya.
   */
  matcher: [
    '/((?!api/|_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|svg|webp|ico)$).*)',
  ],
}
