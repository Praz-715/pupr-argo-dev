import { FileSpreadsheet } from 'lucide-react'
import Link from 'next/link'

import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { CatatanLingkup } from '@/components/ui/catatan-lingkup'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { wajibMasuk } from '@/lib/auth'
import { lingkupData, ringkasLingkup, tanpaAkses } from '@/lib/lingkup'
import { punyaPeran, type Peran } from '@/lib/peran'
import { TombolEkspor } from '../_komponen/tombol-ekspor'

export const metadata = { title: 'Pusat Ekspor' }

const PERAN_HALAMAN = ['Super Admin', 'Admin Talenta', 'Pimpinan'] as const

interface JenisEkspor {
  jenis: string
  judul: string
  isi: string
  peran: readonly Peran[]
  /** Halaman yang punya penyaringnya — ekspor bersyarat dimulai dari sana. */
  halaman?: { href: string; label: string }
}

/**
 * Daftar jenis ekspor. Peran per jenis **sama** dengan yang ditegakkan route
 * handler-nya — daftar di sini hanya menentukan apa yang tampil; penolakan yang
 * sebenarnya ada di `app/api/internal/ekspor/[jenis]/route.ts`.
 */
const DAFTAR: JenisEkspor[] = [
  {
    jenis: 'gap-indikator',
    judul: 'Gap per indikator',
    isi: 'Rata-rata, skor terendah, dan jumlah pegawai di bawah ambang untuk setiap indikator rubrik, per jabatan target.',
    peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
    halaman: { href: '/laporan/gap-analysis', label: 'Laporan Gap Analysis' },
  },
  {
    jenis: 'gap-unit',
    judul: 'Gap per unit organisasi',
    isi: 'Rollup skor 65/20/15 dan rasio kelayakan per unit tempat pegawai bertugas.',
    peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
    halaman: { href: '/laporan/gap-analysis', label: 'Laporan Gap Analysis' },
  },
  {
    jenis: 'gap-jenjang',
    judul: 'Gap per jenjang jabatan',
    isi: 'Rollup yang sama, dilihat menurut jenjang alih-alih unit.',
    peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
    halaman: { href: '/laporan/gap-analysis', label: 'Laporan Gap Analysis' },
  },
  {
    jenis: 'nominasi',
    judul: 'Nominasi rinci',
    isi: 'Satu baris per nominasi: kandidat, jabatan target, unit pengaju, tanggal, status, dan hari proses. Sampai 5.000 baris.',
    peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
    halaman: { href: '/laporan/nominasi', label: 'Laporan Nominasi & Approval' },
  },
  {
    jenis: 'rekap-periode',
    judul: 'Rekap nominasi per periode',
    isi: 'Jumlah dan rata-rata hari proses per bulan pengajuan.',
    peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
    halaman: { href: '/laporan/nominasi', label: 'Laporan Nominasi & Approval' },
  },
  {
    jenis: 'rekap-unit',
    judul: 'Rekap nominasi per unit pengaju',
    isi: 'Jumlah, keputusan, dan rata-rata hari proses per unit yang mengusulkan.',
    peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
    halaman: { href: '/laporan/nominasi', label: 'Laporan Nominasi & Approval' },
  },
  {
    jenis: 'audit-log',
    judul: 'Audit log',
    isi: '100 baris jejak audit terbaru: siapa, kapan, aksi, entitas. Isi perubahan sengaja TIDAK diekspor — nilai sebelum/sesudah memuat data yang aturan aksesnya berbeda.',
    peran: ['Super Admin'],
    halaman: { href: '/admin/audit-log', label: 'Audit Log Viewer' },
  },
]

/**
 * Pusat Ekspor (PRD §6.8).
 *
 * ## Kenapa CSV saja, dan kenapa itu bukan kekurangan
 *
 * PRD menyebut PDF/Excel. Yang terpasang: **CSV**, yang dibuka Excel & LibreOffice
 * apa adanya, tanpa satu pun dependensi baru. Excel asli (`.xlsx`) dan PDF menuntut
 * pustaka tambahan — itu keputusan yang pantas diambil sadar, bukan diselipkan.
 *
 * ## Kenapa sinkron, menyimpang dari U-10
 *
 * U-10 menetapkan ekspor besar jadi job asinkron berprogres. Itu ditulis sebelum
 * ada angka. Yang terukur: kueri laporan 2–60 ms, dan tabel terbesar di produksi
 * 1.872 pegawai. Setiap ekspor dibatasi `LIMIT` di kuerinya, jadi tidak ada jalur
 * yang bisa tumbuh tanpa batas. Antrean job dipasang kalau ada jenis yang
 * benar-benar lambat — untuk jenis itu, bukan untuk semuanya.
 *
 * ## Ekspor mengikuti penyaring, dan itu sebabnya halaman ini bukan satu-satunya jalan
 *
 * Tombol di sini mengunduh **tanpa penyaring**. Untuk ekspor bersyarat, jalannya
 * dari halaman laporannya — di sana penyaring yang aktif ikut terbawa ke berkas,
 * sehingga isi berkas sama dengan isi layar. Ekspor yang diam-diam memuat seluruh
 * tabel padahal layarnya tersaring adalah cara paling halus membuat seseorang
 * mengirimkan data yang tidak ia maksudkan.
 */
export default async function PusatEksporPage() {
  const sesi = await wajibMasuk('/laporan/ekspor')

  if (!punyaPeran(sesi.pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Pusat Ekspor"
        deskripsiHalaman="Unduh laporan sebagai berkas."
        peranAnda={sesi.pengguna.peran}
        alasan={
          <>
            Ekspor mengeluarkan data pegawai dari batas aplikasi — setelah berkasnya terunduh,
            tidak ada aturan akses di sini yang masih berlaku atasnya. Karena itu dibatasi ke{' '}
            <strong className="font-medium text-text">Admin Talenta</strong> dan{' '}
            <strong className="font-medium text-text">Pimpinan</strong>.
          </>
        }
      />
    )
  }

  const lingkup = lingkupData(sesi.pengguna)
  if (tanpaAkses(lingkup)) {
    return (
      <div className="space-y-5">
        <PageHeader judul="Pusat Ekspor" />
        <CatatanLingkup lingkup={lingkup} />
      </div>
    )
  }

  const tersedia = DAFTAR.filter((d) => punyaPeran(sesi.pengguna, d.peran))
  const batasUnit = ringkasLingkup(lingkup)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Pusat Ekspor"
        deskripsi="Unduh laporan sebagai CSV — dibuka langsung oleh Excel & LibreOffice. Setiap unduhan tercatat di audit log: jenis, penyaring, dan jumlah baris (isi datanya tidak)."
      />

      <CatatanLingkup lingkup={lingkup} />

      {batasUnit ? (
        <p className="text-[13px] text-text-muted">
          Berkas yang Anda unduh ikut dibatasi lingkup unit Anda — sama dengan yang tampil di
          layar, bukan seluruh tabel.
        </p>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {tersedia.map((d) => (
          <Panel key={d.jenis}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-[14px] font-semibold text-text">
                  <FileSpreadsheet className="size-4 shrink-0 text-text-subtle" />
                  {d.judul}
                </p>
                <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{d.isi}</p>
                {d.halaman ? (
                  <p className="mt-2 text-[12px] text-text-subtle">
                    Perlu penyaring?{' '}
                    <Link href={d.halaman.href} className="text-accent hover:underline">
                      {d.halaman.label}
                    </Link>{' '}
                    membawa penyaring yang aktif ke berkasnya.
                  </p>
                ) : null}
              </div>
              <TombolEkspor jenis={d.jenis} params={{}} label="Unduh" />
            </div>
          </Panel>
        ))}
      </div>

      <Panel>
        <PanelHeader
          judul="Format lain & ekspor besar"
          deskripsi="Ditulis di sini supaya tidak dikira sedang dikerjakan."
        />
        <ul className="mt-2 space-y-2 text-[13px] leading-relaxed text-text-muted">
          <li>
            <strong className="font-medium text-text">Excel (.xlsx) &amp; PDF</strong> belum ada.
            Keduanya menuntut pustaka tambahan; CSV memenuhi kebutuhan menyalin angka tanpa
            menambah dependensi apa pun. Menambahkannya adalah keputusan, bukan pekerjaan sisa.
          </li>
          <li>
            <strong className="font-medium text-text">Ekspor gambar chart</strong> belum ada. Warna
            seri datang dari CSS variable, jadi men-serialisasi SVG apa adanya menghasilkan gambar
            tanpa warna — perlu menyuntikkan nilai warna yang sudah dihitung, bukan menyalin{' '}
            <code className="text-[12px]">var(--chart-1)</code>. Setiap chart sudah punya padanan
            tabel yang bisa disalin.
          </li>
          <li>
            <strong className="font-medium text-text">Job asinkron berprogres</strong> belum
            dipasang. Kueri laporan selesai dalam puluhan milidetik dan tiap ekspor dibatasi{' '}
            <code className="text-[12px]">LIMIT</code>, jadi belum ada ekspor yang cukup lambat
            untuk membutuhkannya.
          </li>
        </ul>
      </Panel>
    </div>
  )
}
