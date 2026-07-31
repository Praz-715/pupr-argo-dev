import { Navbar } from '@/components/layout/navbar'
import { Sidebar } from '@/components/layout/sidebar'
import { ToastProvider } from '@/components/ui/toast'
import { daftarPenggunaDev, getCurrentUser } from '@/lib/auth'
import { navigasiUntuk } from '@/lib/navigasi'

/**
 * App shell full-screen: sidebar kiri persisten + navbar atas + area konten.
 * Hanya area konten yang menggulir — sidebar & navbar tetap di tempat, supaya
 * halaman padat tabel tidak kehilangan navigasi (CLAUDE.md §Desain UI/UX).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [pengguna, penggunaDev] = await Promise.all([getCurrentUser(), daftarPenggunaDev()])
  const navigasi = navigasiUntuk(pengguna?.peran ?? null)

  return (
    // ToastProvider membungkus seluruh shell: hasil aksi (simpan/hapus) bisa
    // muncul dari halaman mana pun, jadi providernya harus di atas semuanya —
    // bukan dipasang per halaman yang kebetulan punya form.
    <ToastProvider>
      <div className="flex h-dvh overflow-hidden bg-surface">
        <Sidebar navigasi={navigasi} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar
            navigasi={navigasi}
            penggunaAktif={pengguna}
            daftarPenggunaDev={penggunaDev}
          />
          <main className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1600px] px-4 py-5 lg:px-6">{children}</div>
          </main>
        </div>
      </div>
    </ToastProvider>
  )
}
