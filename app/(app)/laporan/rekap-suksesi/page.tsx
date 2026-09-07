import { Suspense } from 'react'

import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { Badge } from '@/components/ui/badge'
import { CatatanLingkup } from '@/components/ui/catatan-lingkup'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel } from '@/components/ui/panel'
import { TableSkeleton } from '@/components/ui/skeleton'
import { wajibMasuk } from '@/lib/auth'
import { formatNip, formatSkor, formatTanggalWaktu } from '@/lib/format'
import {
  ambilRekapSuksesi,
  JUMLAH_CADANGAN,
  type BarisRekapSuksesi,
  type KandidatRekap,
} from '@/lib/kueri/laporan-suksesi'
import { lingkupData, tanpaAkses, unitWajib } from '@/lib/lingkup'
import { punyaPeran } from '@/lib/peran'
import { LABEL_POOL, type StatusPool } from '@/lib/workflow'
import { KontrolCetak } from './_komponen/kontrol-cetak'

export const metadata = { title: 'Rekap Suksesi (siap cetak)' }

const PERAN_HALAMAN = ['Super Admin', 'Admin Talenta', 'Pimpinan'] as const

/**
 * Rekap Suksesi siap cetak (`2 sept- masukan sistem informasi.pdf` butir 2).
 *
 * Permintaan pemilik proses: *"1 rekapan untuk gabungan jabatan dengan
 * kandidat-kandidat terpilih … siapa calon utama unggulnya dan cadangannya yang
 * mendekati nilai-nilainya"*, sebab *"pimpinan saat rapat biasanya dibawakan bahan
 * print laporan"*.
 *
 * ## Kenapa HALAMAN yang dicetak, bukan berkas PDF yang diunduh
 *
 * Aplikasi ini sudah punya gaya cetaknya sendiri (`@media print` di `globals.css`,
 * diporting dari v1): sidebar & navbar hilang, pita kepala tetap berwarna supaya
 * lembarnya dikenali sebagai dokumen DJBK, dan pembatas tinggi app shell dilepas
 * supaya yang tercetak tidak berhenti di satu layar. Jadi Ctrl+P dari sini
 * menghasilkan berkas yang bisa dibawa rapat **hari ini**, tanpa menambah pustaka
 * PDF ke dalam repositori — keputusan yang sudah tercatat sebagai utang yang
 * ditunda dengan sengaja, dan tetap bisa diambil nanti kalau memang perlu berkas
 * yang dihasilkan server.
 *
 * ## "Jumlah berkasnya mengikuti jumlah isian"
 *
 * Karena itu tidak ada paginasi di sini dan tidak ada `LIMIT`: panjang lembarnya
 * ditentukan datanya — satu blok per jabatan target, masing-masing satu calon utama
 * + cadangan. Blok diberi `break-inside: avoid` supaya satu jabatan target tidak
 * terbelah dua halaman, hal yang membuat lembar rapat sulit dibaca.
 */
export default async function HalamanRekapSuksesi() {
  const sesi = await wajibMasuk('/laporan/rekap-suksesi')

  if (!punyaPeran(sesi.pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Rekap Suksesi"
        deskripsiHalaman="Satu lembar siap cetak: calon utama & cadangan tiap jabatan target."
        peranAnda={sesi.pengguna.peran}
        alasan={
          <>
            Lembar ini menyandingkan nama pegawai dengan skor dan peringkatnya untuk{' '}
            seluruh jabatan target sekaligus, jadi aksesnya dibatasi ke{' '}
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
        <PageHeader judul="Rekap Suksesi" />
        <CatatanLingkup lingkup={lingkup} />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Rekap Suksesi"
        deskripsi={`Satu lembar untuk seluruh jabatan target aktif: calon utama beserta ${JUMLAH_CADANGAN} cadangan terdekat. Tekan Ctrl/⌘+P untuk mencetak — sidebar, navigasi, dan tombol tidak ikut tercetak.`}
      />
      <CatatanLingkup lingkup={lingkup} />
      <Suspense fallback={<TableSkeleton rows={8} />}>
        <Isi unitWajibId={unitWajib(lingkup)} />
      </Suspense>
    </div>
  )
}

async function Isi({ unitWajibId }: { unitWajibId: number | null }) {
  const baris = await ambilRekapSuksesi(unitWajibId)
  const berisi = baris.filter((b) => b.calonUtama !== null)

  if (baris.length === 0) {
    return (
      <EmptyState
        judul="Belum ada jabatan target aktif"
        deskripsi="Rekap ini hanya memuat jabatan target berstatus AKTIF — draft tidak pernah dihitung, jadi angkanya tidak bisa dipakai memutuskan."
      />
    )
  }

  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-[13px] leading-relaxed text-text-muted">
            <strong className="font-medium text-text">{berisi.length}</strong> jabatan target
            berisi calon
            {berisi.length !== baris.length ? (
              <>
                {' '}
                · <strong className="font-medium text-text">{baris.length - berisi.length}</strong>{' '}
                belum ada kandidat yang lolos syarat
              </>
            ) : null}
          </p>
          <p className="text-[11px] text-text-subtle">
            Dicetak dari data per {formatTanggalWaktu(new Date())}
          </p>
        </div>
      </Panel>

      <KontrolCetak
        target={baris.map((b) => ({ id: b.jabatanTargetId, kode: b.kodeTarget, nama: b.namaTarget }))}
      >
        {baris.map((b, i) => (
          <BlokTarget key={b.jabatanTargetId} b={b} nomor={i + 1} />
        ))}
      </KontrolCetak>
    </div>
  )
}

function BlokTarget({ b, nomor }: { b: BarisRekapSuksesi; nomor: number }) {
  return (
    /*
      `break-inside-avoid` bukan kerapian: tanpa itu satu jabatan target bisa
      terbelah dua halaman, dan pembaca lembar rapat kehilangan hubungan antara
      judul jabatannya dan daftar calonnya.
    */
    <Panel className="break-inside-avoid">
      <div className="flex flex-wrap items-start justify-between gap-2 border-b border-border pb-2.5">
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-text">
            {nomor}. {b.namaTarget}
          </h2>
          <p className="mt-0.5 text-[11px] leading-relaxed text-text-subtle">
            {b.kodeTarget}
            {b.namaUnit === null ? '' : ` · ${b.namaUnit}`} · {b.jumlahLolos} dari {b.jumlahDinilai}{' '}
            pegawai lolos syarat
          </p>
        </div>
        {/*
          Lencana ini yang mencegah salah baca paling mungkin di lembar rapat:
          "calon utama" yang belum pernah dimasukkan ke daftar suksesi hanyalah
          peringkat teratas, dan tanpa penanda ia terbaca seperti orang yang sudah
          dicalonkan seseorang.
        */}
        <Badge tone={b.dariPool ? 'sukses' : 'netral'}>
          {b.dariPool ? `Dari daftar suksesi (${b.jumlahPool})` : 'Peringkat skor — belum ada pool'}
        </Badge>
      </div>

      {b.calonUtama === null ? (
        <p className="mt-3 text-[12px] leading-relaxed text-text-subtle">
          Belum ada kandidat yang lolos syarat untuk jabatan target ini.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[44rem] border-collapse text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] tracking-wide text-text-subtle uppercase">
                <th className="py-1.5 pr-3 font-medium">Peran</th>
                <th className="px-3 py-1.5 font-medium">Nama &amp; NIP</th>
                <th className="px-3 py-1.5 font-medium">Jabatan sekarang</th>
                <th className="px-3 py-1.5 text-right font-medium">Gol.</th>
                <th className="px-3 py-1.5 text-right font-medium">Kotak 9</th>
                <th className="px-3 py-1.5 text-right font-medium">Match score</th>
                <th className="px-3 py-1.5 text-right font-medium">Selisih</th>
              </tr>
            </thead>
            <tbody>
              <BarisCalon k={b.calonUtama} utama />
              {b.cadangan.map((k) => (
                <BarisCalon key={k.pegawaiId} k={k} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}

function BarisCalon({ k, utama = false }: { k: KandidatRekap; utama?: boolean }) {
  return (
    <tr className="border-b border-border last:border-b-0 align-top">
      <td className="py-2 pr-3 whitespace-nowrap">
        {utama ? (
          <Badge tone="aksen">Calon utama</Badge>
        ) : (
          <span className="text-[11px] text-text-subtle">Cadangan</span>
        )}
      </td>
      <td className="px-3 py-2">
        <p className="font-medium text-text">{k.nama}</p>
        <p className="tabular mt-0.5 text-[11px] text-text-subtle">{formatNip(k.nip)}</p>
        <span className="mt-1 flex flex-wrap gap-1.5">
          {k.statusPool !== null ? (
            <Badge tone="netral">{LABEL_POOL[k.statusPool as StatusPool] ?? k.statusPool}</Badge>
          ) : null}
          {/*
            Kode catatan ikut tercetak — inilah gunanya penanda itu (butir 1):
            yang membaca lembar rapat harus melihatnya tanpa membuka aplikasi.
          */}
          {k.catatanKategori !== null ? (
            <Badge tone="peringatan">{k.catatanKategori}</Badge>
          ) : null}
        </span>
      </td>
      <td className="px-3 py-2 text-text-muted">
        <p>{k.namaJabatan ?? '—'}</p>
        {k.namaUnit === null ? null : (
          <p className="mt-0.5 text-[11px] text-text-subtle">{k.namaUnit}</p>
        )}
      </td>
      <td className="tabular px-3 py-2 text-right text-text-muted">{k.golongan ?? '—'}</td>
      <td className="tabular px-3 py-2 text-right text-text-muted">
        {k.kotak9 ?? '—'}
        {k.predikatKinerja === null ? null : (
          <span className="block text-[11px] text-text-subtle">{k.predikatKinerja}</span>
        )}
      </td>
      <td className="tabular px-3 py-2 text-right font-medium text-text">
        {formatSkor(k.skorTotal)}
      </td>
      <td className="tabular px-3 py-2 text-right text-text-subtle">
        {utama ? '—' : `−${formatSkor(k.selisihSkor)}`}
      </td>
    </tr>
  )
}
