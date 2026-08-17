import { PanelMerek } from '@/components/layout/panel-merek'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { LogoPU } from '@/components/ui/logo-pu'
import { logoResmi } from '@/lib/aset-publik'

/**
 * Shell halaman autentikasi: tanpa sidebar, tanpa navbar, tanpa breadcrumb.
 *
 * Sengaja bukan app shell yang dikosongkan. Halaman masuk yang memperlihatkan
 * kerangka navigasi memberi kesan aplikasinya sudah terbuka, dan menu yang
 * terlihat tapi tidak bisa diklik adalah cara paling cepat membuat orang
 * mengira aplikasinya rusak, bukan mengira dirinya belum masuk.
 *
 * Sejak identitas PUPR masuk, layarnya terbagi dua: panel bermerek (tempat foto
 * pegawai) di kiri, kolom formulir di kanan. Panelnya lenyap di bawah `lg` —
 * di layar sempit ia hanya akan mendorong formulir ke paruh bawah dan menuntut
 * orang menggulir hanya untuk masuk.
 *
 * Pengalih tema tetap ada: preferensi tema tersimpan per perangkat, dan
 * seseorang yang memakai tema gelap tidak boleh disilaukan lebih dulu sebelum
 * boleh mengubahnya.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const logo = logoResmi()

  return (
    <div className="flex min-h-dvh">
      <PanelMerek />

      <div className="flex min-w-0 flex-1 flex-col border-t-[3px] border-emas bg-kanvas lg:border-t-0">
        <header className="flex h-14 shrink-0 items-center justify-between px-4">
          {/* Lambang + nama institusi hanya di kolom ini saat panel kiri
              disembunyikan — kalau keduanya tampil, institusinya tertulis dua
              kali berdampingan di layar lebar. */}
          <span className="flex items-center gap-2.5 lg:invisible">
            <LogoPU sumber={logo} size={28} varian="kotak" bermakna />
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold text-text">SIMT DJBK</span>
              <span className="block text-[10px] text-text-subtle">Manajemen Talenta</span>
            </span>
          </span>
          <ThemeToggle />
        </header>

        <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
          <div className="w-full max-w-[26rem]">{children}</div>
        </main>

        <footer className="shrink-0 px-4 pb-5 text-center">
          {/* Kalimat kepatuhan hidup DI SINI saja, di segala lebar layar.
              Sebelumnya ia juga ada di dasar panel bermerek, dan di sana ia
              tertutup separuh oleh indikator dev Next.js di sudut kiri-bawah —
              sudut yang di project ini sudah berstatus area terlarang. */}
          <p className="text-[11px] leading-relaxed text-text-subtle">
            Direktorat Jenderal Bina Konstruksi · Kementerian Pekerjaan Umum
            <br />
            Aplikasi internal. Data pegawai di dalamnya termasuk data pribadi yang dilindungi UU No.
            27/2022.
          </p>
        </footer>
      </div>
    </div>
  )
}
