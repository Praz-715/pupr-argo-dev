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
    jenis: 'riwayat-perhitungan',
    judul: 'Riwayat perhitungan (sesi validasi)',
    isi: 'Satu baris per Hitung Ulang yang pernah dijalankan: waktu, siapa yang menjalankannya, jabatan target, lalu hasilnya — pegawai dinilai, lolos syarat, perlu ditinjau, nilai manual yang dipertahankan, dan durasinya. Sesi sebelum 12 Agu 2026 hanya mencatat sebagian, dan kolom yang belum ada tampil kosong (bukan nol).',
    peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
    halaman: { href: '/jabatan-target', label: 'Jabatan Target' },
  },
  {
    jenis: 'master-jabatan',
    judul: 'Master jabatan (untuk crosscheck)',
    isi: 'Seluruh jabatan di master: kode, nama, rumpun, unit, jenis (struktural/fungsional), jenjang, eselon, status — plus pemakaiannya: berapa penghuni aktif, apakah sudah jadi kursi jabatan target, berapa kali dipakai sebagai jabatan asal kandidat, dan berapa baris riwayat yang tertaut. Kolom pemakaian itu yang memperlihatkan jabatan mana yang sebenarnya tidak dipakai apa pun.',
    peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
    halaman: { href: '/master/jabatan', label: 'Master Data Jabatan' },
  },
  {
    jenis: 'riwayat-jabatan-mentah',
    judul: 'Riwayat jabatan mentah (lembar pemetaan)',
    isi: 'Setiap nama jabatan yang muncul di riwayat pegawai APA ADANYA dari sumber, dikelompokkan & diurutkan menurut seberapa sering dipakai, lengkap dengan usulan kategori (struktural/fungsional/lainnya) dan jenjangnya. Dua kolom terakhir sengaja kosong — di situ keputusan manusia dituliskan lalu dikembalikan. Inilah yang menghalangi filter per kategori: hanya sebagian kecil baris riwayat yang sudah tertaut ke master.',
    peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
    halaman: { href: '/data/validasi-riwayat', label: 'Validasi Riwayat' },
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
 * ## Format `.xlsx` sungguhan, bukan CSV — dan bukan lewat pustaka pihak ketiga
 *
 * Sampai 2 Sep 2026 yang terpasang CSV. Permintaan pemilik proses: *"yang pusat
 * ekspor kayanya bikin excel aja dah jangan csv."* Alasannya nyata, bukan
 * kosmetik: CSV memaksa semua jadi teks — kolom "Rata-rata Skor" dibuka Excel
 * sebagai teks kiri-rata, bukan angka, sampai pengguna mengubah tipenya sendiri.
 *
 * Ditulis SENDIRI (`lib/ekspor-xlsx.ts` + `lib/zip-tulis.ts`), pola yang sama
 * dengan `lib/importer/xlsx.ts` yang sudah lebih dulu membaca `.xlsx` tanpa
 * dependensi baru: berkas itu cuma ZIP berisi XML, dan Node sudah membawa
 * `zlib.deflateRawSync`. PDF **tetap** belum ada — itu jenis berkas berbeda yang
 * masih menuntut mesin layout sendiri, keputusan terpisah.
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
        deskripsi="Unduh laporan sebagai .xlsx — dibuka langsung oleh Excel & LibreOffice, angka & tanggalnya tetap bertipe. Setiap unduhan tercatat di audit log: jenis, penyaring, dan jumlah baris (isi datanya tidak)."
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
            <strong className="font-medium text-text">PDF</strong> belum ada — beda dari Excel,
            ia menuntut mesin tata letak halaman sendiri (margin, pemenggalan baris antar
            halaman), bukan sekadar format berkas. <strong className="font-medium text-text">
            Rekap Suksesi</strong> sudah bisa dicetak langsung dari halamannya (Ctrl/⌘+P), dengan
            opsi memilih sebagian jabatan target — itu jalan keluar sampai PDF diputuskan.
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
