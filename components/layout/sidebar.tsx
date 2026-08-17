'use client'

import { ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { LogoPU } from '@/components/ui/logo-pu'
import { cn } from '@/lib/cn'
import { useHydrated, useLocalStorageBoolean, useLocalStorageSet } from '@/lib/hooks'
import { itemTersedia, navigasiSidebar, type GrupNav } from '@/lib/navigasi'
import { IkonNav } from './ikon-nav'

const KUNCI_SIMPAN = 'simt-sidebar-collapsed'
const KUNCI_GRUP = 'simt-sidebar-grup-ciut'

export function Sidebar({
  navigasi: navigasiPenuh,
  logo,
}: {
  navigasi: GrupNav[]
  /** Hasil `logoResmi()` — diteruskan layout karena komponen ini klien. */
  logo: string | null
}) {
  const pathname = usePathname()
  // Profil Saya & sejenisnya tetap ada di breadcrumb dan command palette, tapi
  // tidak di sini — jalan masuknya lewat menu pengguna di navbar.
  const navigasi = navigasiSidebar(navigasiPenuh)
  // Pilihan collapse bertahan antar kunjungan & tersinkron antar tab.
  const [ciut, setCiut] = useLocalStorageBoolean(KUNCI_SIMPAN)
  // Grup mana yang sedang diciutkan. Bertahan antar kunjungan & antar tab.
  const [ciutGrup, alihGrup] = useLocalStorageSet(KUNCI_GRUP)
  const siap = useHydrated()

  return (
    // Tepi kanan emas PU (v1 `border-right: 3px solid var(--pu-gold)`) adalah
    // satu-satunya garis emas setebal itu di seluruh aplikasi — ia yang membuat
    // layar ini langsung terbaca sebagai milik Kementerian PU.
    <aside
      className={cn(
        'tanpa-cetak permukaan-sidebar flex h-full shrink-0 flex-col border-r-[3px] border-emas',
        ciut ? 'w-14' : 'w-60',
        siap ? 'transition-[width] duration-150' : '',
      )}
    >
      <div
        className={cn(
          'flex h-14 shrink-0 items-center border-b border-sidebar-garis',
          ciut ? 'justify-center px-0' : 'gap-2.5 px-3',
        )}
      >
        {/* Varian `kotak`: dasar emas penuh, satu-satunya yang berkontras di
            atas gradien navy sidebar. Dekoratif — teks "SIMT DJBK" di sebelahnya
            sudah menyebut institusinya, jadi tanpa aria-label supaya pembaca
            layar tidak mengucapkannya dua kali. */}
        <LogoPU sumber={logo} size={28} varian="kotak" />
        {!ciut ? (
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[13px] font-semibold text-sidebar-teks-kuat">
              SIMT DJBK
            </span>
            <span className="block truncate text-[10px] text-sidebar-teks-samar">
              Manajemen Talenta
            </span>
          </span>
        ) : null}
      </div>

      {/* Baris tetap untuk tombol ciutkan — ditaruh di ATAS (konvensi Notion/
          VS Code) dan tingginya sama di kedua state, jadi daftar menu tidak
          bergeser saat sidebar dibuka-tutup. */}
      <div className="shrink-0 border-b border-sidebar-garis p-2">
        <button
          type="button"
          onClick={() => setCiut(!ciut)}
          title={ciut ? 'Perluas sidebar' : 'Ciutkan sidebar'}
          className={cn(
            'flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] text-sidebar-teks-samar transition-colors hover:bg-sidebar-hover hover:text-sidebar-teks-kuat',
            ciut && 'justify-center px-0',
          )}
        >
          {ciut ? (
            <PanelLeftOpen className="size-4 shrink-0" />
          ) : (
            <PanelLeftClose className="size-4 shrink-0" />
          )}
          {!ciut ? <span>Ciutkan</span> : null}
        </button>
      </div>

      <nav
        aria-label="Navigasi utama"
        className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-3"
      >
        {navigasi.map((grup, i) => {
          const idGrup = `nav-grup-${i}`
          const punyaAktif = grup.item.some((it) =>
            it.href === '/' ? pathname === '/' : pathname.startsWith(it.href),
          )
          // Grup yang memuat halaman yang sedang dibuka SELALU terbuka, apa pun
          // yang tersimpan. Tanpa aturan ini, seseorang yang menciutkan sebuah
          // grup lalu masuk ke salah satu halamannya akan melihat sidebar yang
          // tidak menunjukkan di mana ia berada — dan itu membuat orang mengira
          // menunya hilang, bukan mengira grupnya tertutup.
          const terbuka = !grup.label || ciut || punyaAktif || !ciutGrup.has(grup.label)

          return (
            <div key={grup.label ?? `grup-${i}`}>
              {grup.label && !ciut ? (
                <button
                  type="button"
                  onClick={() => alihGrup(grup.label!)}
                  aria-expanded={terbuka}
                  aria-controls={idGrup}
                  // Grup aktif tidak bisa ditutup, jadi tombolnya dimatikan —
                  // tombol yang bisa diklik tapi tidak melakukan apa pun lebih
                  // membingungkan daripada tombol yang jelas sedang tidak aktif.
                  disabled={punyaAktif}
                  title={
                    punyaAktif
                      ? `${grup.label} — berisi halaman yang sedang dibuka`
                      : terbuka
                        ? `Ciutkan ${grup.label}`
                        : `Buka ${grup.label}`
                  }
                  className={cn(
                    'mb-1 flex w-full items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold tracking-wider text-sidebar-teks-samar uppercase transition-colors',
                    punyaAktif
                      ? 'cursor-default'
                      : 'hover:bg-sidebar-hover hover:text-sidebar-teks-kuat',
                  )}
                >
                  <ChevronRight
                    aria-hidden
                    className={cn(
                      'size-3 shrink-0 transition-transform',
                      terbuka && 'rotate-90',
                      punyaAktif && 'opacity-40',
                    )}
                  />
                  <span className="min-w-0 flex-1 truncate text-left">{grup.label}</span>
                  {/* Jumlah item yang tersembunyi — supaya grup yang tertutup
                      tetap menyatakan ada apa di dalamnya, bukan cuma lenyap. */}
                  {!terbuka ? (
                    <span className="tabular shrink-0 rounded bg-sidebar-lencana-bg px-1 text-[9px] font-medium">
                      {grup.item.length}
                    </span>
                  ) : null}
                </button>
              ) : null}
              {grup.label && ciut ? (
                <div className="mx-2 mb-2 border-t border-sidebar-garis" />
              ) : null}

              <ul id={idGrup} hidden={!terbuka} className="space-y-0.5">
              {grup.item.map((item) => {
                const tersedia = itemTersedia(item)
                const aktif =
                  item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)

                const isi = (
                  <>
                    <IkonNav nama={item.ikon} className="size-4 shrink-0" />
                    {!ciut ? (
                      <>
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        {/* "Segera", bukan "F6". Nomor fase adalah penanda rencana
                            pengembangan internal — bagi staf kepegawaian ia tidak
                            berarti apa pun, dan lebih buruk: ia terbaca seperti kode
                            yang seharusnya mereka pahami. */}
                        {!tersedia ? (
                          <span className="shrink-0 rounded bg-sidebar-lencana-bg px-1 py-px text-[9px] font-medium text-sidebar-teks-samar">
                            Segera
                          </span>
                        ) : null}
                      </>
                    ) : null}
                  </>
                )

                const kelasDasar = cn(
                  'relative flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px]',
                  ciut && 'justify-center px-0',
                )

                // Strip emas di tepi kiri pil aktif (v1 `.nav-link.active::before`).
                // Pembeda KEDUA di samping warna: pil aktif dibedakan lewat
                // latar terang + tebal huruf + strip ini, jadi menu yang sedang
                // dibuka tetap terbaca tanpa mengandalkan persepsi warna.
                const kelasAktif = cn(
                  'bg-sidebar-aktif-bg font-semibold text-sidebar-aktif-teks shadow-[0_2px_8px_rgb(0_0_0/0.18)]',
                  'before:absolute before:top-1/2 before:left-0 before:h-4 before:w-1',
                  'before:-translate-y-1/2 before:rounded-full before:bg-emas',
                )

                return (
                  <li key={item.href}>
                    {tersedia ? (
                      <Link
                        href={item.href}
                        title={ciut ? item.label : undefined}
                        aria-current={aktif ? 'page' : undefined}
                        className={cn(
                          kelasDasar,
                          'transition-colors',
                          aktif
                            ? kelasAktif
                            : 'text-sidebar-teks hover:bg-sidebar-hover hover:text-sidebar-teks-kuat',
                        )}
                      >
                        {isi}
                      </Link>
                    ) : (
                      <span
                        title={
                          ciut
                            ? `${item.label} — belum tersedia`
                            : 'Belum tersedia'
                        }
                        aria-disabled
                        className={cn(
                          kelasDasar,
                          'cursor-not-allowed text-sidebar-teks-samar opacity-70',
                        )}
                      >
                        {isi}
                      </span>
                    )}
                  </li>
                )
                })}
              </ul>
            </div>
          )
        })}
      </nav>

      {/* Ruang bawah sengaja dibiarkan kosong: di dev, indikator Next.js muncul
          di pojok kiri-bawah dan akan menutupi kontrol apa pun yang ditaruh di
          sini. */}
    </aside>
  )
}
