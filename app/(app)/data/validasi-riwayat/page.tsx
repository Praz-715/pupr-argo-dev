import { Suspense } from 'react'

import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { Badge } from '@/components/ui/badge'
import { CatatanLingkup } from '@/components/ui/catatan-lingkup'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { wajibMasuk } from '@/lib/auth'
import { formatAngka, formatTanggal } from '@/lib/format'
import { usulkanJenisPenugasan, usulkanKategoriDiklat, STATUS_PEMETAAN } from '@/lib/kategori-riwayat'
import {
  ambilAntrianDiklat,
  ambilAntrianJabatan,
  ambilKategoriUntukUsulan,
  ambilRingkasValidasiRiwayat,
} from '@/lib/kueri/kategori-riwayat'
import { lingkupData, tanpaAkses, unitWajib } from '@/lib/lingkup'
import { dariDaftar, nomorHalaman } from '@/lib/param'
import { punyaPeran } from '@/lib/peran'
import { BarisDiklat } from './_komponen/baris-diklat'
import { BarisJabatan } from './_komponen/baris-jabatan'

export const metadata = { title: 'Validasi Riwayat' }

/**
 * Termasuk **Pengelola Unit**, dan itu bukan pelonggaran: PRD §3 menetapkan
 * perannya sebagai *"Input/validasi riwayat data pegawai unitnya"*. Kalau
 * dibatasi ke Super Admin, satu akun jadi leher botol untuk 1.872 pegawai.
 */
const PERAN_HALAMAN = ['Super Admin', 'Admin Talenta', 'Pengelola Unit'] as const

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Validasi Riwayat Pegawai (`doc/sql/014`).
 *
 * Memindahkan dua indikator rubrik dari tebakan mesin ke keputusan manusia:
 * kategori diklat (Pengembangan Kompetensi) dan jenis penugasan Plt/Plh
 * (Substansi Riwayat Jabatan).
 *
 * **Skoring belum memakai hasil validasi ini.** `lib/penilaian.ts` masih
 * mencocokkan kata kunci, jadi memvalidasi di sini belum menggeser satu angka
 * pun. Itu disengaja — peralihannya mengubah SELURUH match score dan menuntut
 * Hitung Ulang — dan halaman ini mengatakannya apa adanya, karena antrian yang
 * tidak berpengaruh tapi terlihat berpengaruh adalah cara tercepat membuat orang
 * berhenti memercayai angka di aplikasi ini.
 */
export default async function ValidasiRiwayatPage({
  searchParams,
}: {
  searchParams: ParamHalaman
}) {
  const sesi = await wajibMasuk('/data/validasi-riwayat')

  if (!punyaPeran(sesi.pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Validasi Riwayat"
        deskripsiHalaman="Kategorikan riwayat diklat & pastikan jenis penugasan Plt/Plh."
        peranAnda={sesi.pengguna.peran}
        alasan={
          <>
            Antrian ini memuat nama pegawai beserta riwayatnya, dan hasilnya nanti ikut menentukan
            skor. Aksesnya dibatasi ke{' '}
            <strong className="font-medium text-text">Pengelola Unit</strong> (data unitnya sendiri),{' '}
            <strong className="font-medium text-text">Admin Talenta</strong>, dan{' '}
            <strong className="font-medium text-text">Super Admin</strong>.
          </>
        }
      />
    )
  }

  const lingkup = lingkupData(sesi.pengguna)
  if (tanpaAkses(lingkup)) {
    return (
      <div className="space-y-5">
        <PageHeader judul="Validasi Riwayat" />
        <CatatanLingkup lingkup={lingkup} />
      </div>
    )
  }

  const p = await searchParams
  const status = dariDaftar(p.status, STATUS_PEMETAAN) ?? 'USULAN'
  const cari = p.cari?.slice(0, 100) ?? ''
  const halaman = nomorHalaman(p.hal)
  const unit = unitWajib(lingkup)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Validasi Riwayat"
        deskripsi="Kategori diklat & jenis penugasan Plt/Plh sebelumnya disimpulkan dari teks bebas. Di sini pencocokan itu turun jadi USULAN yang Anda konfirmasi, dan jejak siapa/kapan tersimpan."
      />

      <CatatanLingkup lingkup={lingkup} />

      <div className="rounded-lg border border-warning-border bg-warning-subtle px-3.5 py-3">
        <p className="max-w-3xl text-[12px] leading-relaxed text-text-muted">
          <strong className="font-medium text-text">
            Hasil validasi di sini belum dipakai perhitungan skor.
          </strong>{' '}
          Rubrik masih memakai pencocokan kata kunci seperti sebelumnya, jadi memvalidasi belum
          menggeser satu angka pun. Peralihannya dilakukan sekali, terpisah, karena ia mengubah
          seluruh <em>match score</em> dan menuntut Hitung Ulang. Pekerjaan Anda di sini{' '}
          <strong className="font-medium text-text">tidak hilang</strong> — ia justru yang dipakai
          begitu peralihannya dijalankan.
        </p>
      </div>

      <Suspense fallback={<RingkasSkeleton />}>
        <IsiRingkas unitWajib={unit} />
      </Suspense>

      <Suspense
        key={`d|${status}|${cari}|${halaman}`}
        fallback={<TableSkeleton rows={8} cols={['2.4fr', '0.6fr', '2fr']} />}
      >
        <IsiDiklat status={status} cari={cari} halaman={halaman} unitWajib={unit} />
      </Suspense>

      <Suspense fallback={<TableSkeleton rows={6} cols={['1.6fr', '2.4fr', '1.6fr']} />}>
        <IsiJabatan unitWajib={unit} />
      </Suspense>
    </div>
  )
}

async function IsiRingkas({ unitWajib: unit }: { unitWajib: number | null }) {
  const r = await ambilRingkasValidasiRiwayat(unit)

  const kartu = [
    {
      label: 'Nama diklat belum dikategorikan',
      nilai: r.diklatUsulan,
      catatan: `dari ${formatAngka(r.diklatTotal)} nama · ${formatAngka(r.diklatTervalidasi)} tervalidasi, ${formatAngka(r.diklatDitolak)} tanpa kategori`,
    },
    {
      label: 'Riwayat jabatan belum dipastikan',
      nilai: r.jabatanBelumValid,
      catatan: `dari ${formatAngka(r.jabatanTotal)} baris riwayat jabatan`,
    },
    {
      label: 'Pegawai sudah diperiksa',
      nilai: r.pegawaiSudahDiperiksa,
      catatan: `dari ${formatAngka(r.pegawaiTotal)} pegawai aktif dalam lingkup Anda`,
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {kartu.map((k) => (
        <Panel key={k.label}>
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
            {k.label}
          </p>
          <p className="tabular mt-1.5 text-2xl leading-none font-semibold text-text">
            {formatAngka(k.nilai)}
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">{k.catatan}</p>
        </Panel>
      ))}
    </div>
  )
}

async function IsiDiklat({
  status,
  cari,
  halaman,
  unitWajib: unit,
}: {
  status: (typeof STATUS_PEMETAAN)[number]
  cari: string
  halaman: number
  unitWajib: number | null
}) {
  const [hasil, master] = await Promise.all([
    ambilAntrianDiklat({ status, cari, unitWajib: unit, halaman, perHalaman: 25 }),
    ambilKategoriUntukUsulan(),
  ])

  /**
   * Hanya kategori BERINDUK yang bisa dipilih — rumpun tidak.
   *
   * Memetakan diklat ke "Pelatihan Teknis" tanpa menyebut teknis apa membuat
   * pemeriksaan syarat pelatihan tidak bisa membedakan Pengadaan dari Hukum
   * Kontrak, padahal keduanya syarat terpisah di `sample(1).md` lembar 6.
   *
   * Aturannya `parentId === null`, **bukan** "punya turunan". Versi pertama
   * memakai yang kedua, dan akibatnya `FUNGSIONAL` — rumpun yang belum punya
   * turunan — ikut bisa dipilih. Itu bukan pilihan yang lebih longgar, itu
   * pilihan yang tidak bisa dipakai memeriksa syarat apa pun. Rumpun tanpa
   * turunan ditandai di halaman Kategori Riwayat Diklat supaya Admin Talenta
   * melihat bahwa ia perlu diisi, bukan diam-diam dipakai sebagai daun.
   */
  const opsi = master
    .filter((m) => m.parentId !== null)
    .map((m) => ({ id: m.id, kode: m.kode, nama: m.nama }))

  const totalHalaman = Math.max(1, Math.ceil(hasil.total / hasil.perHalaman))

  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <PanelHeader
          judul="Antrian nama diklat"
          deskripsi={`${formatAngka(hasil.total)} nama berstatus ${status} · halaman ${hasil.halaman} dari ${formatAngka(totalHalaman)}. Diurutkan menurut jumlah pegawai yang memakainya, supaya yang berdampak paling luas dikerjakan lebih dulu.`}
        />
        <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-text-subtle">
          Satu keputusan berlaku untuk <strong className="font-medium text-text">semua pegawai</strong>{' '}
          yang punya nama diklat itu — termasuk di luar unit Anda, karena nama diklat tidak dimiliki
          unit mana pun. Angka &ldquo;dipakai&rdquo; di kanan hanya menghitung pegawai dalam lingkup
          Anda, supaya urutan kerjanya mengikuti dampak yang Anda lihat.
        </p>
      </div>

      {hasil.baris.length === 0 ? (
        <div className="px-3.5 py-6">
          <EmptyState
            judul={status === 'USULAN' ? 'Antrian bersih' : 'Tidak ada yang cocok'}
            deskripsi={
              status === 'USULAN'
                ? 'Setiap nama diklat sudah punya keputusan — dikategorikan atau ditandai tanpa kategori.'
                : 'Ubah penyaring status untuk melihat baris lain.'
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-wide text-text-subtle uppercase">
                <th className="px-3.5 py-2 font-medium">Nama diklat</th>
                <th className="px-2 py-2 text-right font-medium">Dipakai</th>
                <th className="px-2 py-2 font-medium">Kategori</th>
              </tr>
            </thead>
            <tbody>
              {hasil.baris.map((b) => {
                const usulan = usulkanKategoriDiklat(b.namaMentah, master)
                return (
                  <tr key={b.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-3.5 py-3 align-top">
                      <span className="block max-w-[34rem] leading-relaxed text-text">
                        {b.namaMentah}
                      </span>
                      {b.status !== 'USULAN' ? (
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-text-subtle">
                          <Badge tone={b.status === 'TERVALIDASI' ? 'sukses' : 'netral'}>
                            {b.status.toLowerCase()}
                          </Badge>
                          {b.divalidasiOleh ? `oleh ${b.divalidasiOleh}` : null}
                          {b.divalidasiPada ? `· ${formatTanggal(b.divalidasiPada)}` : null}
                        </span>
                      ) : null}
                    </td>
                    <td className="tabular px-2 py-3 text-right align-top text-text-muted">
                      {formatAngka(b.jumlahPegawai)}
                    </td>
                    <td className="px-2 py-3 align-top">
                      <BarisDiklat
                        id={b.id}
                        namaMentah={b.namaMentah}
                        kategoriId={b.kategoriId}
                        usulan={usulan}
                        opsi={opsi}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

async function IsiJabatan({ unitWajib: unit }: { unitWajib: number | null }) {
  const baris = await ambilAntrianJabatan({ unitWajib: unit, batas: 100 })

  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <PanelHeader
          judul="Antrian riwayat jabatan"
          deskripsi="Jenis penugasan (Definitif / Plt / Plh) menentukan skor Substansi Riwayat Jabatan. Usulan datang dari teks jabatannya, tapi tidak pernah tersimpan tanpa Anda tetapkan."
        />
      </div>

      {baris.length === 0 ? (
        <div className="px-3.5 py-6">
          <EmptyState
            judul="Semua riwayat jabatan sudah dipastikan"
            deskripsi="Tidak ada baris yang jenis penugasannya masih kosong dalam lingkup Anda."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-wide text-text-subtle uppercase">
                <th className="px-3.5 py-2 font-medium">Pegawai</th>
                <th className="px-2 py-2 font-medium">Jabatan (teks asli)</th>
                <th className="px-2 py-2 font-medium">Jenis penugasan</th>
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => {
                const u = usulkanJenisPenugasan(b.jabatanNamaMentah)
                return (
                  <tr key={b.id} className="border-b border-border-subtle last:border-0">
                    <td className="px-3.5 py-3 align-top">
                      <span className="block text-text">{b.namaPegawai}</span>
                      <span className="tabular mt-0.5 block text-[11px] text-text-subtle">
                        {b.nip}
                      </span>
                      {b.namaUnit ? (
                        <span className="mt-0.5 block text-[11px] text-text-subtle">
                          {b.namaUnit}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 align-top">
                      <span className="block max-w-[30rem] leading-relaxed text-text-muted">
                        {b.jabatanNamaMentah}
                      </span>
                      {b.tanggalMulai ? (
                        <span className="tabular mt-0.5 block text-[11px] text-text-subtle">
                          {formatTanggal(b.tanggalMulai)}
                          {b.tanggalAkhir ? ` – ${formatTanggal(b.tanggalAkhir)}` : ' – sekarang'}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-3 align-top">
                      <BarisJabatan
                        id={b.id}
                        usulan={u.jenis}
                        alasanUsulan={u.alasan}
                        yakin={u.yakin}
                        nilaiSekarang={b.jenisPenugasan}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function RingkasSkeleton() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <Panel key={i}>
          <Skeleton className="h-3 w-32" />
          <Skeleton className="mt-2 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-full" />
        </Panel>
      ))}
    </div>
  )
}
