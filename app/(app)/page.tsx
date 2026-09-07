import { Suspense } from 'react'

import { PageHeader } from '@/components/ui/panel'
import { InfoRumpun } from './_komponen/info-rumpun'
import { PetaSebaran, PetaSebaranSkeleton } from './_widget/peta-sebaran'
import { KartuRingkas, KartuRingkasSkeleton } from './_widget/kartu-ringkas'
import { dariDaftar, nomorHalaman } from '@/lib/param'
import {
  AnggotaKotak,
  AnggotaKotakSkeleton,
  SebaranKotak9,
  SebaranKotak9Skeleton,
} from './_widget/sebaran-kotak9'

export const metadata = { title: 'Dashboard' }

/**
 * Dashboard Utama.
 *
 * **Dipangkas atas permintaan user (10 Agu 2026) menjadi tiga hal saja:** empat
 * KPI, Sebaran Kotak 9 beserta drill-down pegawainya, dan Jabatan Strategis
 * Kosong. **Ini menyimpang dari PRD §6.2 yang mendaftarkan delapan widget
 * (W1–W8)** — penyimpangan yang disengaja, bukan pekerjaan yang belum selesai.
 *
 * Yang dilepas dari halaman ini (W3 Peta Kinerja × Potensial, W4 Kesehatan Data,
 * W6 Antrian Nominasi, W7 Tren Kinerja, W8 Aktivitas Terakhir) **tidak dihapus
 * dari kode**: komponennya utuh di `_widget/` dan tinggal dipasang kembali kalau
 * keputusannya berubah. Menghapusnya berarti membuang pekerjaan yang sudah lolos
 * uji hanya untuk merapikan satu berkas.
 *
 * Konsekuensi yang harus diikuti kalau daftar ini diubah lagi:
 *   - `loading.tsx` menyusun skeleton dengan tata letak yang SAMA — ubah dua-duanya,
 *     kalau tidak ada layout shift saat konten masuk (phase.md §5.3).
 *   - Kartu KPI menaut ke anchor **di halaman ini**. Widget yang dilepas berarti
 *     anchornya lenyap dan tautannya jadi klik mati (phase.md §5.2) — kartu
 *     Nominasi karena itu sekarang menaut ke `/nominasi`, bukan ke `#antrian-nominasi`.
 *   - `e2e/fase-1.smoke.mjs` menguji kehadiran widget per nama.
 *
 * Setiap widget tetap dibungkus <Suspense> SENDIRI: shell (sidebar, navbar,
 * judul) langsung terkirim, lalu tiap panel mengalir masuk begitu kuerinya
 * selesai. Semua agregasi dikerjakan di SQL — lihat lib/kueri/dashboard.ts.
 */
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    kotak?: string
    halKotak?: string
    urutKotak?: string
    arahKotak?: string
  }>
}) {
  const params = await searchParams
  const kotakDipilih = bacaKotak(params.kotak)
  // Paginasi drill-down. `halKotak`, bukan `hal`: URL ini sudah membawa `?kotak=`
  // dan `hal` adalah nama bawaan DataTable yang dipakai tabel lain di halaman lain.
  const halKotak = nomorHalaman(params.halKotak)
  // Nama sendiri (`urutKotak`/`arahKotak`), bukan `urut`/`arah` bawaan DataTable —
  // alasan yang sama dengan `halKotak`. Nilainya TIDAK divalidasi di sini: kuerinya
  // memakai daftar putih dan jatuh ke `talenta` untuk kunci yang tak dikenal, jadi
  // memvalidasinya dua kali berarti dua tempat yang harus sepakat.
  const urutKotak = params.urutKotak ?? null
  const arahKotak = dariDaftar(params.arahKotak, ['asc', 'desc'] as const) ?? null

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Dashboard Talenta"
        deskripsi="Ringkasan kondisi talenta ASN Direktorat Jenderal Bina Konstruksi — sebaran Kotak 9 dan jabatan strategis yang kosong."
      />

      {/*
        Keterangan penyaring rumpun jabatan (`Detail Revisi PUPR 1_9_2026.pdf`,
        butir 4). Ber-`Suspense` sendiri: ia butuh satu kueri master jabatan, dan
        menaruhnya di badan halaman berarti seluruh dashboard menunggunya.
        Fallback-nya `null` — pita setinggi 32px yang muncul belakangan tidak
        menggeser apa pun yang sedang dibaca, sementara skeleton di posisi itu
        justru menarik mata ke keterangan yang paling tidak mendesak di halaman.
      */}
      <Suspense fallback={null}>
        <InfoRumpun />
      </Suspense>

      {/* W1 */}
      <Suspense fallback={<KartuRingkasSkeleton />}>
        <KartuRingkas />
      </Suspense>

      {/* W2 + W3 — Sebaran Kotak 9 menjawab "berapa orang di tiap kotak",
          Peta Kinerja × Potensial menyebar orangnya pada dua sumbu yang membentuk
          kotak itu. Panel Jabatan Strategis Kosong DILEPAS dari sini (permintaan
          user, 12 Agu 2026) dan digantikan Peta — komponennya utuh di
          `_widget/jabatan-kosong.tsx`, dan isinya tetap terjangkau di
          `/jabatan-target#jabatan-kosong`.

          Karena anchornya lenyap dari halaman ini, kartu KPI "Jabatan strategis
          kosong" DIALIHKAN ke `/jabatan-target#jabatan-kosong`. Tanpa itu ia jadi
          klik mati — kegagalan yang sama pernah terjadi saat widget Antrian
          Nominasi dilepas.

          Tinggi baris DITETAPKAN di xl, dan kedua panel meregang mengisinya —
          bukan `items-start` yang membiarkan tiap panel setinggi isinya sendiri.
          Sebelumnya grid Kotak 9 memakai sel ber-rasio 4:3 sehingga panelnya
          jauh lebih tinggi daripada Jabatan Kosong, dan barisnya timpang.
          Di bawah xl keduanya menumpuk, jadi tingginya dibiarkan otomatis —
          tinggi tetap pada layar sempit akan memaksa gulir di dalam gulir.

          39rem diambil dari tinggi ALAMI panel Jabatan Kosong pada isi sekarang
          (6 jabatan), supaya keenamnya terlihat tanpa digulir sementara Kotak 9
          menyusut menyamainya. Pada 32rem keduanya juga sejajar, tapi daftar yang
          sudah ada pun ikut tergulir — memendekkan lebih jauh berarti
          menyembunyikan data yang tadinya terlihat.

          `grid-rows-[minmax(0,1fr)]` WAJIB, bukan hiasan: `h-[39rem]` sendirian
          hanya menetapkan tinggi CONTAINER, sementara barisnya tetap `auto` dan
          boleh melebihinya. Versi pertama perbaikan ini memakai `h-` saja —
          terukur, panel tumbuh 613px → 2.062px begitu daftarnya diisi 24 baris,
          dan `overflow-y-auto` di dalamnya tidak pernah aktif.

          `xl:grid-cols-2` — kedua panel SAMA LEBAR, seperti di halaman Peta
          Talenta yang memakai grid dua kolom yang sama.

          ## Riwayat rasio ini, supaya tidak diubah bolak-balik lagi

          Pernah `6fr : 5fr` (Kotak 9 lebih lebar) sebagai keputusan user 18 Agu
          2026, sesudah `1fr : 1fr` dicoba lalu dikembalikan pada hari yang sama.
          Alasannya waktu itu: Kotak 9 adalah isi utama halaman, Peta cuma
          pendamping. **Dikembalikan ke sama lebar pada 24 Agu 2026** atas
          permintaan user: *"ukuran Sebaran Kotak 9 dan Peta Kinerja × Potensial
          di dashboard samain kaya di peta talenta biar sama ukurannya kiri
          kanan"* — halaman Peta Talenta memajang pasangan panel yang sama
          persis dengan `xl:grid-cols-2`, dan dua halaman yang memajang pasangan
          panel yang sama dengan proporsi berbeda terbaca seperti salah satunya
          belum selesai. **Ini keputusan user yang paling baru; jangan
          mengembalikan `6fr : 5fr` sebagai "perbaikan".**

          `grid-cols-2` di Tailwind sudah `repeat(2, minmax(0, 1fr))`, jadi batas
          bawah nol yang dulu ditulis eksplisit (`minmax(0,6fr)`) tetap ada —
          itu yang membuat panel boleh MENYUSUT; tanpanya isi panel menolak lebih
          sempit dari lebar alaminya lalu gridnya meluber.

          Sel Kotak 9 tetap KOTAK pada rasio apa pun — bentuknya ditentukan
          `aspect-square` di `kotak9-grid.tsx`, bukan oleh lebar panelnya. */}
      <div className="grid gap-5 xl:h-[39rem] xl:grid-cols-2 xl:grid-rows-[minmax(0,1fr)]">
        <Suspense fallback={<SebaranKotak9Skeleton />}>
          <SebaranKotak9 kotakAktif={kotakDipilih} />
        </Suspense>
        <Suspense fallback={<PetaSebaranSkeleton />}>
          <PetaSebaran />
        </Suspense>
      </div>

      {/* W2b — drill-down, hanya saat ?kotak=N ada di URL. Lebar penuh: isinya
          tabel pegawai, dan memaksanya ke separuh kolom membuat kolom NIP &
          jabatan terpotong padahal ruangnya ada. */}
      {kotakDipilih !== null ? (
        <Suspense
          key={`${kotakDipilih}-${halKotak}-${urutKotak}-${arahKotak}`}
          fallback={<AnggotaKotakSkeleton />}
        >
          <AnggotaKotak
            kotak={kotakDipilih}
            halaman={halKotak}
            urut={urutKotak}
            arah={arahKotak}
          />
        </Suspense>
      ) : null}
    </div>
  )
}

/** Validasi param URL di boundary — jangan percaya isi query string. */
function bacaKotak(nilai: string | undefined): number | null {
  if (!nilai) return null
  const n = Number(nilai)
  if (!Number.isInteger(n) || n < 1 || n > 9) return null
  return n
}
