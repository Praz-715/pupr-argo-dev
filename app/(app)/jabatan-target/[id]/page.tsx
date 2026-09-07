import { ArrowLeft, ListChecks, SlidersHorizontal, Users } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { gayaTombol } from '@/components/ui/button-style'
import { PageHeader, Panel } from '@/components/ui/panel'
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { targetTerjangkau } from '@/lib/aksi/lingkup-data'
import { getCurrentUser } from '@/lib/auth'
import { cn } from '@/lib/cn'
import { formatAngka, formatTanggal, formatTanggalWaktu } from '@/lib/format'
import {
  ambilAnggotaJabatan,
  ambilJabatanTarget,
  ambilPersyaratan,
  ambilOpsiSyaratDiklat,
  ambilPohonRubrik,
  ambilSelisihBidangIlmu,
  ambilSumberDuplikasi,
  cariJabatanUntukTarget,
} from '@/lib/kueri/rubrik'
import { angkaPositif } from '@/lib/param'
import { PERAN_KELOLA_TARGET, PERAN_USUL_TARGET, punyaPeran } from '@/lib/peran'
import { validasiRubrik } from '@/lib/scoring'
import { AksiStatus } from './_komponen/aksi-status'
import { PanelValidasi } from './_komponen/panel-validasi'
import { TabAnggota } from './_komponen/tab-anggota'
import { TabRubrik } from './_komponen/tab-rubrik'
import { PanelSyaratDiklat } from './_komponen/panel-syarat-diklat'
import { TabSyarat } from './_komponen/tab-syarat'

type Params = Promise<{ id: string }>
type Cari = Promise<Record<string, string | undefined>>

/*
  `bolehUsul` (unit ikut) hanya untuk tab Persyaratan & Syarat Diklat — unit tahu
  syarat apa yang dibutuhkan kursinya. Tab Rubrik, Jabatan Asal Kandidat, dan tombol
  status tetap `bolehUbah`: bobot 65/20/15 berlaku se-organisasi dan aktivasi adalah
  titik verifikasinya. Kedua daftar diimpor dari `lib/peran.ts` — sama dengan yang
  dipakai server action untuk menolak.
*/

const TAB = [
  { kunci: 'anggota', label: 'Jabatan Asal Kandidat', ikon: Users },
  { kunci: 'syarat', label: 'Persyaratan', ikon: ListChecks },
  { kunci: 'rubrik', label: 'Rubrik Penilaian', ikon: SlidersHorizontal },
] as const

type KunciTab = (typeof TAB)[number]['kunci']

export async function generateMetadata({ params }: { params: Params }) {
  const { id } = await params
  // Lihat catatan di halaman Kandidat: `generateMetadata` tidak ikut dijaga oleh
  // penjagaan di badan halaman, dan NaN yang lolos jadi galat SQL yang senyap.
  const idTarget = angkaPositif(id)
  const target = idTarget === undefined ? null : await ambilJabatanTarget(idTarget)
  return { title: target === null ? 'Jabatan Target' : target.namaTarget }
}

/**
 * Editor Jabatan Target — tiga tab (PRD §6.5).
 *
 * Tab aktif ada di URL (`?tab=`), bukan di state klien: pengguna sering perlu
 * mengirim tautan ke tab tertentu ("bobotnya di sini yang perlu ditinjau"), dan
 * tombol back harus mengembalikan ke tab sebelumnya, bukan keluar dari halaman.
 *
 * Panel pemeriksaan rubrik tampil di ATAS tab, bukan di dalam tab Rubrik. Alasan:
 * yang memblokir aktivasi bukan hanya rubrik — jabatan anggota yang kosong juga —
 * dan temuan yang hanya terlihat setelah membuka tab tertentu akan terlewat.
 */
export default async function EditorJabatanTargetPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: Cari
}) {
  const { id } = await params
  const idTarget = angkaPositif(id)
  if (idTarget === undefined) notFound()

  const [target, pengguna] = await Promise.all([ambilJabatanTarget(idTarget), getCurrentUser()])
  if (target === null) notFound()

  const p = await searchParams
  const tab: KunciTab = TAB.some((t) => t.kunci === p.tab) ? (p.tab as KunciTab) : 'rubrik'
  const bolehUbah = punyaPeran(pengguna, PERAN_KELOLA_TARGET)
  /*
    Perannya SAJA tidak cukup: Pengelola Unit hanya boleh mengisi persyaratan target
    yang salah satu jabatan anggotanya ada di unitnya. Predikatnya diambil dari
    `targetTerjangkau()` — fungsi yang SAMA dengan yang dipakai
    `simpanPersyaratan`/`simpanSyaratDiklat` untuk menolak, jadi form yang tampil dan
    aksi yang menerima tidak bisa berselisih. Untuk peran berlingkup penuh ia selalu
    mengembalikan barisnya, jadi tidak ada biaya perilaku bagi Admin Talenta.
  */
  const bolehUsul =
    punyaPeran(pengguna, PERAN_USUL_TARGET) && (await targetTerjangkau(idTarget)) !== null
  const cariJabatan = (p.cariJabatan ?? '').slice(0, 80)
  // Rumpun jabatan (`Detail Revisi PUPR 1_9_2026.pdf`, butir 4); kosong = tidak menyaring.
  const rumpunJabatanTerpilih = (p.rumpun ?? '').slice(0, 80).toLowerCase()
  // Daftar jabatan anggota bawaannya disaring ke jenjang target ini; ini jalan
  // keluarnya untuk target yang memang lintas jenjang (lihat cariJabatanUntukTarget).
  const semuaJenjang = p.semuaJenjang === '1'

  return (
    <div className="space-y-5">
      <Link
        href="/jabatan-target"
        className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        Semua jabatan target
      </Link>

      <PageHeader
        judul={
          <span className="flex flex-wrap items-center gap-2.5">
            {target.namaTarget}
            <Badge
              tone={
                target.status === 'AKTIF'
                  ? 'sukses'
                  : target.status === 'DRAFT'
                    ? 'peringatan'
                    : 'netral'
              }
            >
              {target.status}
            </Badge>
          </span>
        }
        deskripsi={
          <>
            <span className="tabular">{target.kodeTarget}</span>
            {target.deskripsi ? ` · ${target.deskripsi}` : ''}
          </>
        }
        aksi={
          <>
            <Link
              href={`/jabatan-target/${idTarget}/simulasi`}
              className={cn(gayaTombol({ variant: 'sekunder', size: 'sm' }))}
            >
              Simulasi &amp; Diff
            </Link>
            <Link
              href={`/jabatan-target/${idTarget}/kandidat`}
              className={cn(gayaTombol({ variant: 'sekunder', size: 'sm' }))}
            >
              Kandidat ({formatAngka(target.jumlahEligible)})
            </Link>
            {bolehUbah ? <AksiStatus target={target} /> : null}
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <RingkasKecil
          label="Jabatan asal kandidat"
          nilai={formatAngka(target.jumlahAnggota)}
          catatan={target.jumlahAnggota === 0 ? 'wajib minimal 1 untuk aktivasi' : 'posisi yang dituju'}
          peringatan={target.jumlahAnggota === 0}
        />
        <RingkasKecil
          label="Persyaratan"
          nilai={formatAngka(target.jumlahPersyaratan)}
          catatan={
            target.jumlahPersyaratan === 0
              ? 'tanpa syarat, semua pegawai lolos'
              : 'penyaring kelayakan kandidat'
          }
          peringatan={target.jumlahPersyaratan === 0}
        />
        <RingkasKecil
          label="Rubrik"
          nilai={`${formatAngka(target.jumlahKomponen)} · ${formatAngka(target.jumlahIndikator)}`}
          catatan="komponen · indikator"
          peringatan={target.jumlahKomponen === 0}
        />
        <RingkasKecil
          label="Skor terakhir dihitung"
          /*
            `formatTanggal()`, BUKAN `formatTanggalWaktu().slice(0, 10)`. Potongan
            10 karakter itu mengandaikan tanggal berlebar tetap seperti ISO
            (`2026-08-26`), sementara formatnya berbulan singkat berbahasa
            Indonesia — jadi "26 Agu 2026, 17.30" terpotong jadi **"26 Agu 202"**,
            tahun yang salah dan terbaca seperti angka rusak. Panjangnya berubah
            menurut nama bulan (3–4 huruf) dan tanggalnya (1–2 angka), jadi tidak
            ada satu pun angka potong yang benar untuk semua tanggal.
          */
          nilai={target.dihitungPada === null ? 'belum' : formatTanggal(target.dihitungPada)}
          // Jam-nya pindah ke tooltip, tidak dibuang: penanda "skor ini dihitung
          // sebelum catatan disiplin terbaru" membandingkan sampai ke menitnya,
          // dan pada hari perhitungan ulang, tanggal saja tidak bisa membedakannya.
          judul={
            target.dihitungPada === null
              ? undefined
              : `Dihitung ${formatTanggalWaktu(target.dihitungPada)}`
          }
          catatan={
            target.dihitungPada === null
              ? 'halaman kandidat masih kosong'
              : `${formatAngka(target.jumlahEligible)} dari ${formatAngka(target.jumlahDinilai)} lolos syarat`
          }
          peringatan={target.dihitungPada === null}
        />
      </div>

      <Suspense fallback={<Skeleton className="h-24 w-full rounded-lg" />}>
        <IsiValidasi idTarget={idTarget} jumlahAnggota={target.jumlahAnggota} />
      </Suspense>

      {/* Navigasi tab — tautan biasa, supaya bisa dibagikan & tombol back bekerja */}
      <div className="flex flex-wrap gap-1 border-b border-border">
        {TAB.map((t) => {
          const aktif = t.kunci === tab
          const Ikon = t.ikon
          return (
            <Link
              key={t.kunci}
              href={`/jabatan-target/${idTarget}?tab=${t.kunci}`}
              scroll={false}
              className={cn(
                '-mb-px flex items-center gap-2 border-b-2 px-3 py-2 text-[13px] transition-colors',
                aktif
                  ? 'border-accent font-medium text-text'
                  : 'border-transparent text-text-muted hover:text-text',
              )}
            >
              <Ikon className="size-3.5" />
              {t.label}
            </Link>
          )
        })}
      </div>

      <Suspense
        key={`${tab}|${cariJabatan}|${rumpunJabatanTerpilih}|${semuaJenjang}`}
        fallback={<ListSkeleton rows={5} />}
      >
        {tab === 'anggota' ? (
          <IsiTabAnggota
            idTarget={idTarget}
            bolehUbah={bolehUbah}
            cariJabatan={cariJabatan}
            rumpun={rumpunJabatanTerpilih}
            semuaJenjang={semuaJenjang}
          />
        ) : tab === 'syarat' ? (
          <IsiTabSyarat idTarget={idTarget} bolehUbah={bolehUsul} />
        ) : (
          <IsiTabRubrik idTarget={idTarget} bolehUbah={bolehUbah} />
        )}
      </Suspense>
    </div>
  )
}

function RingkasKecil({
  label,
  nilai,
  catatan,
  peringatan,
  judul,
}: {
  label: string
  nilai: string
  catatan: string
  peringatan?: boolean
  /** Tooltip pada angkanya — untuk keterangan yang lebih presisi dari yang tampil. */
  judul?: string
}) {
  return (
    <Panel>
      <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">{label}</p>
      <p className="tabular mt-1.5 text-lg leading-none font-semibold text-text" title={judul}>
        {nilai}
      </p>
      <p
        className={cn(
          'mt-1.5 text-[11px] leading-relaxed',
          peringatan ? 'text-warning' : 'text-text-subtle',
        )}
      >
        {catatan}
      </p>
    </Panel>
  )
}

async function IsiValidasi({
  idTarget,
  jumlahAnggota,
}: {
  idTarget: number
  jumlahAnggota: number
}) {
  const komponen = await ambilPohonRubrik(idTarget)
  const hasil = validasiRubrik(komponen, { untukJabatanTarget: true })
  return <PanelValidasi hasil={hasil} jumlahAnggota={jumlahAnggota} />
}

async function IsiTabAnggota({
  idTarget,
  bolehUbah,
  cariJabatan,
  rumpun,
  semuaJenjang,
}: {
  idTarget: number
  bolehUbah: boolean
  cariJabatan: string
  rumpun: string
  semuaJenjang: boolean
}) {
  const [anggota, tersedia] = await Promise.all([
    ambilAnggotaJabatan(idTarget),
    // Batas dinaikkan dari 20 karena daftarnya kini DIKELOMPOKKAN: dengan 20,
    // kelompok berisi 63 kursi balai akan tampil sebagai "20 jabatan" — angka yang
    // salah, dan tombol "Tambah semua" yang menambahkan sebagian tanpa mengatakannya.
    cariJabatanUntukTarget(idTarget, cariJabatan, 400, semuaJenjang),
  ])
  return (
    <TabAnggota
      jabatanTargetId={idTarget}
      anggota={anggota}
      tersedia={tersedia}
      cari={cariJabatan}
      rumpun={rumpun}
      semuaJenjang={semuaJenjang}
      bolehUbah={bolehUbah}
    />
  )
}

async function IsiTabSyarat({ idTarget, bolehUbah }: { idTarget: number; bolehUbah: boolean }) {
  const [syarat, selisih, opsiDiklat] = await Promise.all([
    ambilPersyaratan(idTarget),
    ambilSelisihBidangIlmu(idTarget),
    ambilOpsiSyaratDiklat(idTarget),
  ])
  return (
    <>
      <TabSyarat
        jabatanTargetId={idTarget}
        syarat={syarat}
        selisihBidangIlmu={selisih}
        bolehUbah={bolehUbah}
      />
      {/*
        Syarat pelatihan panel tersendiri, bukan baris di daftar persyaratan:
        bentuknya relasi ke kamus kategori (banyak pilihan bercentang), bukan satu
        `nilai_minimal` bebas. Memaksanya jadi baris teks berarti pengguna mengetik
        kode kategori dari hafalan.
      */}
      <div className="mt-4">
        <PanelSyaratDiklat
          jabatanTargetId={idTarget}
          opsi={opsiDiklat}
          bolehUbah={bolehUbah}
        />
      </div>
    </>
  )
}

async function IsiTabRubrik({ idTarget, bolehUbah }: { idTarget: number; bolehUbah: boolean }) {
  const [komponen, sumber] = await Promise.all([
    ambilPohonRubrik(idTarget),
    ambilSumberDuplikasi(idTarget),
  ])
  return (
    <TabRubrik
      jabatanTargetId={idTarget}
      komponen={komponen}
      sumberDuplikasi={sumber}
      bolehUbah={bolehUbah}
    />
  )
}
