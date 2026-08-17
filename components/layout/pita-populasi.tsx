import { Users } from 'lucide-react'

import { ringkasPopulasi } from '@/lib/kueri/populasi'
import { formatAngka } from '@/lib/format'

/**
 * Pita pemberitahuan saat tampilan dibatasi ke pegawai yang ada di API sumber.
 *
 * **Kenapa ini wajib ada, bukan hiasan.** Tanpa pita ini, filternya tidak
 * terlihat sama sekali: aplikasi menampilkan 10 pegawai dan kartu KPI menulis
 * "Seluruh pegawai terdata berstatus aktif", sehingga pembaca menyimpulkan
 * populasinya memang 10.
 *
 * Kalimat kedua **berubah** pada 11 Agu 2026. Sebelumnya ia menyebut jabatan,
 * nominasi, dan antrian pembersihan sebagai angka yang TIDAK ikut disaring —
 * lalu ketiganya disaring (permintaan user: seluruh halaman hanya menampilkan
 * pegawai yang ada di API). Kalimat lamanya jadi keliru ke arah sebaliknya, dan
 * pemberitahuan yang salah lebih berbahaya daripada tidak ada pemberitahuan:
 * pembaca yang percaya "nominasi tidak disaring" akan menyimpulkan antriannya
 * memang cuma sekian. **Kalau daftar yang disaring berubah lagi, kalimat ini
 * ikut diubah** — ia satu-satunya tempat aplikasi menjelaskan batas tampilannya.
 *
 * Yang sekarang tetap TIDAK disaring, dan itu disengaja: master data unit &
 * jabatan. Sebuah jabatan eselon I–III ada atau kosong terlepas dari siapa yang
 * sudah diasesmen, jadi menyaringnya berarti mengecilkan struktur organisasi —
 * bukan membatasi populasi pegawai.
 *
 * Mengembalikan `null` kalau filternya mati, jadi tidak ada biaya kueri maupun
 * ruang layar yang terpakai pada mode normal.
 */
export async function PitaPopulasi() {
  const p = await ringkasPopulasi()
  if (!p || p.total <= p.ditampilkan) return null

  const disembunyikan = p.total - p.ditampilkan

  return (
    <div
      role="status"
      className="tanpa-cetak flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-warning-border bg-warning-subtle px-4 py-2 text-[12px] leading-relaxed text-warning"
    >
      <Users aria-hidden className="size-3.5 shrink-0" />
      <span>
        <strong className="font-semibold">Tampilan dibatasi:</strong>{' '}
        {formatAngka(p.ditampilkan)} dari {formatAngka(p.total)} pegawai — hanya yang ada di API
        eNominasi. {formatAngka(disembunyikan)} pegawai lain tetap ada di database, hanya tidak
        ditampilkan.
      </span>
      <span className="text-warning/80">
        Semua angka yang menyebut pegawai sudah ikut disaring. Daftar unit &amp; jabatan{' '}
        <strong>tidak</strong> — jabatan tetap ada terlepas dari siapa yang sudah diasesmen.
      </span>
    </div>
  )
}
