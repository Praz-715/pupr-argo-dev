import { ArrowLeft, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Suspense } from 'react'

import { TrenKinerja } from '@/components/charts/tren-kinerja'
import { Badge, StatusDot } from '@/components/ui/badge'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ChartSkeleton, ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import {
  formatAngka,
  formatBobot,
  formatDurasiTahun,
  formatNip,
  formatSkor,
  formatSkorRingkas,
  formatTanggal,
  formatTanggalPanjang,
  formatTingkatPendidikan,
  inisial,
  formatTanggalWaktu,
} from '@/lib/format'
import { getCurrentUser } from '@/lib/auth'
import { angkaPositif } from '@/lib/param'
import { punyaPeran } from '@/lib/peran'
import { LABEL_TINGKAT, tingkatKelengkapan } from '@/lib/kelengkapan'
import {
  ambilHukumanDisiplin,
  ambilKelengkapan,
  ambilKinerja,
  ambilMatchScore,
  ambilPengalamanJenjang,
  ambilProfil,
  ambilRiwayatAsesmen,
  ambilRiwayatJabatan,
  ambilRiwayatPendidikan,
  type ProfilPegawai,
} from '@/lib/kueri/pegawai'
import { ambangSumbuDari, ambilPengaturan } from '@/lib/pengaturan'
import { adaFotoPegawai } from '@/lib/foto-pegawai'
import { lingkupData, unitWajib } from '@/lib/lingkup'
import { DESKRIPSI_KOTAK_9, klasifikasiSumbuX, klasifikasiSumbuY } from '@/lib/scoring'
import { DaftarDiklat } from './_komponen/daftar-diklat'
import { ambilPilihanJabatan } from '@/lib/kueri/master'
import { CentangVerifikasiHukdis } from './_komponen/centang-verifikasi-hukdis'
import { KotakCatatan } from './_komponen/kotak-catatan'
import { RincianSkor } from './_komponen/rincian-skor'
import { labelJenjang } from '@/lib/jenjang-asesmen'
import { PilihAsesmenDipakai } from './_komponen/pilih-asesmen-dipakai'
import { TombolEditor } from './_komponen/tombol-editor'

/** Batas unit pengguna yang sedang masuk — dipakai judul halaman & isinya. */
async function batasUnitSaya(): Promise<number | null> {
  return unitWajib(lingkupData(await getCurrentUser()))
}

/**
 * Bolehkah pengguna ini MENYUNTING profil? Harus sama dengan `PERAN_PROFIL` di
 * `lib/aksi/profil.ts`.
 *
 * Tanpa ini, tombol "Ubah" di seluruh bagian profil dirender untuk SEMUA peran —
 * terukur pada audit RBAC 22 Agu 2026: Pimpinan dan Viewer masing-masing melihat
 * **7 tombol** yang, begitu ditekan dan formnya diisi penuh, ditolak server oleh
 * `gerbangPeran(PERAN_PROFIL)`. Itu klik mati (phase.md §5.2): kerja pengguna
 * terbuang dan pesan penolakannya terbaca seperti aplikasi rusak, bukan seperti
 * wewenang yang memang tidak dimiliki.
 *
 * Menariknya berkas ini SUDAH melakukannya dengan benar untuk satu hal —
 * `bolehIsiManual` menggerbangi tombol nilai manual terhadap `PERAN_HITUNG` —
 * jadi yang salah bukan polanya, melainkan bahwa pola itu tidak dipakai untuk
 * `TombolEditor`. `getCurrentUser()` ber-`cache()` per permintaan, jadi
 * memanggilnya di tiap bagian tidak menambah kueri.
 *
 * Gerbang server tetap yang menegakkan; ini hanya supaya yang tampil sama dengan
 * yang bisa dilakukan.
 */
async function bolehUbahProfil(): Promise<boolean> {
  return punyaPeran(await getCurrentUser(), ['Super Admin', 'Admin Talenta', 'Pengelola Unit'])
}

export async function generateMetadata({ params }: { params: Promise<{ nip: string }> }) {
  const { nip } = await params
  const profil = await ambilProfil(nip, await batasUnitSaya())
  return { title: profil ? profil.nama : 'Profil tidak ditemukan' }
}

/**
 * Profil Talenta 360° (PRD §6.3).
 *
 * Setiap bagian berat dibungkus <Suspense> sendiri supaya identitas pegawai
 * langsung tampil dan sisanya mengalir masuk.
 *
 * **Pegawai di luar lingkup unit pengguna berakhir di `notFound()`**, bukan di
 * halaman "akses ditolak". Itu disengaja: halaman yang berkata "orang ini ada
 * tapi Anda tidak boleh melihatnya" tetap mengonfirmasi keberadaannya kepada
 * yang tidak berhak tahu — dan NIP bisa ditebak dari pola tanggal lahir.
 */
export default async function ProfilPage({
  params,
  searchParams,
}: {
  params: Promise<{ nip: string }>
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const { nip } = await params
  const profil = await ambilProfil(nip, await batasUnitSaya())
  if (!profil) notFound()

  /*
    Konteks jabatan target — dibawa tautan dari Talent Pool & Nominasi
    (`?target=`). Permintaan pemilik proses 25 Agu 2026: profil yang dibuka dari
    bagian Suksesi cukup menampilkan jabatan target yang orang itu dinominasikan
    padanya, bukan seluruh target yang pernah menghitungnya.

    `?semuaTarget=1` membuka kembali daftar penuhnya. Menyaring TANPA jalan kembali
    berarti menghilangkan informasi: satu orang bisa jadi kandidat beberapa kursi,
    dan itu justru yang perlu terlihat saat menimbang penetapan.
  */
  const p = await searchParams
  const targetKonteks = angkaPositif(p.target)
  const semuaTarget = p.semuaTarget === '1'

  return (
    <div className="space-y-5">
      <Link
        href="/talenta"
        className="inline-flex items-center gap-1.5 text-[13px] text-text-muted transition-colors hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        Direktori Pegawai
      </Link>

      <KepalaProfil profil={profil} />

      <Suspense fallback={<PanelMemuat judul="Kelengkapan data" baris={4} />}>
        <BagianKelengkapan profil={profil} />
      </Suspense>

      {/* Tinggi baris DIPATOK, isi panel bergulir di dalamnya.
          `items-start` yang dulu dipakai membuat tiap panel mengambil tinggi
          alaminya, jadi panel yang isinya sedikit meninggalkan lubang kosong
          sebesar selisihnya — persis keluhan user (11 Agu 2026). Dua hal yang
          wajib ada dan mudah terlewat: `grid-rows-[minmax(0,1fr)]` (tanpa itu
          `h-` cuma menetapkan tinggi container sementara barisnya tetap `auto`
          dan boleh melebihinya) dan `min-h-0` di panelnya (flex item menolak
          lebih pendek dari isinya, sehingga `overflow-y-auto` tak pernah aktif).
          Hanya di `xl`: di layar sempit panel-panel ini bertumpuk satu kolom,
          dan memaksa tinggi di sana menghasilkan gulir bersarang. */}
      {/*
        Tinggi panel dipatok DAN dibatasi tinggi layar: `min(27rem, 58dvh)`.

        Patokan `rem`-nya yang membuat panel bersebelahan sejajar (alasan aslinya,
        12 Agu 2026) — itu tidak berubah di layar normal, sebab 27rem = 432px masih
        lebih kecil dari 58dvh pada jendela ≥745px.

        Yang ditambahkan batas atasnya. Breakpoint `xl` menilai LEBAR, jadi pada
        jendela lebar-tapi-pendek (mis. 1920×570) panel 36rem = 576px lebih tinggi
        daripada seluruh area isinya: halaman jadi ±5 layar dan tiap panel punya
        gulirannya sendiri di dalam halaman yang juga menggulir. Dilaporkan pemilik
        proses 26 Agu 2026 sebagai *"scroll downnya kelebihan jadi luber"*.
      */}
      <div className="grid gap-5 xl:h-[min(27rem,58dvh)] xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] xl:grid-rows-[minmax(0,1fr)]">
        <Suspense
          fallback={
            <PanelMemuat judul="Posisi Kotak 9 & riwayat asesmen" baris={4} className="xl:h-full" />
          }
        >
          <BagianAsesmen profil={profil} />
        </Suspense>
        <Suspense fallback={<PanelChartMemuat judul="Tren kinerja" className="xl:h-full" />}>
          <BagianKinerja profil={profil} />
        </Suspense>
      </div>

      <Suspense fallback={<PanelMemuat judul="Kecocokan dengan jabatan target" baris={6} />}>
        <BagianMatchScore
          profil={profil}
          targetKonteks={semuaTarget ? undefined : targetKonteks}
          semuaTarget={semuaTarget}
        />
      </Suspense>

      <div className="grid gap-5 xl:h-[min(36rem,72dvh)] xl:grid-cols-2 xl:grid-rows-[minmax(0,1fr)]">
        <Suspense
          fallback={<PanelMemuat judul="Riwayat jabatan" baris={5} className="xl:h-full" />}
        >
          <BagianRiwayatJabatan profil={profil} />
        </Suspense>
        {/* Kolom kanan memuat DUA panel, jadi ia membagi tinggi barisnya sendiri:
            `flex-col` + tiap panel `flex-1 min-h-0`. Dengan `space-y-5` biasa,
            keduanya kembali mengambil tinggi alaminya dan lubangnya pindah ke
            bawah panel yang lebih pendek. */}
        <div className="flex min-h-0 flex-col gap-5">
          <Suspense
            fallback={
              <PanelMemuat judul="Riwayat pendidikan" baris={3} className="xl:min-h-0 xl:flex-1" />
            }
          >
            <BagianPendidikan profil={profil} />
          </Suspense>
          <Suspense
            fallback={
              <PanelMemuat judul="Riwayat diklat" baris={5} className="xl:min-h-0 xl:flex-1" />
            }
          >
            <BagianDiklat profil={profil} />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={<PanelMemuat judul="Integritas & rekam jejak disiplin" baris={2} />}>
        <BagianIntegritas profil={profil} />
      </Suspense>
    </div>
  )
}

// ---------------------------------------------------------------------------

async function KepalaProfil({ profil }: { profil: ProfilPegawai }) {
  // Daftar jabatan diambil di sini, bukan diteruskan dari halaman: kepala profil
  // adalah satu-satunya pemakainya di luar riwayat jabatan, dan meneruskannya
  // lewat props berarti halaman ikut membayar kuerinya walau dialognya tidak
  // pernah dibuka.
  const [pilihanJabatan, punyaFoto] = await Promise.all([
    ambilPilihanJabatan(),
    adaFotoPegawai(profil.nip),
  ])
  const bolehUbah = await bolehUbahProfil()
  const bio: Array<{ label: string; nilai: string; catatan?: string }> = [
    {
      label: 'Pangkat / Golongan',
      nilai: `${profil.pangkat} · ${profil.golongan ?? '—'}`,
      catatan: profil.tmtGolongan ? `TMT ${formatTanggal(profil.tmtGolongan)}` : undefined,
    },
    {
      label: 'Jenjang',
      nilai: profil.jenjang ?? '—',
      catatan:
        profil.eselon === 'NON_ESELON'
          ? 'Non-eselon'
          : profil.eselon
            ? `Eselon ${profil.eselon}`
            : undefined,
    },
    {
      label: 'Lama menjabat',
      nilai: formatDurasiTahun(profil.lamaMenjabatTahun),
      catatan: profil.tmtJabatan ? `TMT ${formatTanggal(profil.tmtJabatan)}` : undefined,
    },
    {
      label: 'Pendidikan terakhir',
      nilai: formatTingkatPendidikan(profil.tingkatPendidikan),
      catatan: profil.bidangStudiTerakhir ?? undefined,
    },
    // ---- Turunan NIP: tidak ada kolomnya di DB (phase.md §3 K-6) ----
    {
      label: 'Usia',
      nilai: profil.usia === null ? '—' : `${formatAngka(profil.usia)} tahun`,
      catatan: profil.tanggalLahir ? formatTanggalPanjang(profil.tanggalLahir) : undefined,
    },
    {
      label: 'Jenis kelamin',
      nilai:
        profil.jenisKelamin === 'L' ? 'Laki-laki' : profil.jenisKelamin === 'P' ? 'Perempuan' : '—',
      catatan: 'dari NIP',
    },
    {
      label: 'Masa kerja ASN',
      nilai: formatDurasiTahun(profil.masaKerjaTahun),
      catatan: profil.tmtCpns ? `CPNS ${profil.tmtCpns.bulan}/${profil.tmtCpns.tahun}` : undefined,
    },
    {
      label: 'Batas usia pensiun',
      nilai: `${profil.batasUsiaPensiun} tahun`,
      catatan: profil.tanggalPensiun ? formatTanggal(profil.tanggalPensiun) : undefined,
    },
  ]

  return (
    <Panel>
      {/*
        Foto KIRI, rincian mengalir ke bawah di KANAN — permintaan user butir 5
        ("kiri foto/wajahnya, kanan itu detail ke bawah, sama kaya format eHRM").

        Kotaknya BERUKURAN TETAP dan `object-cover`, bukan mengikuti gambarnya.
        Terukur: 26 foto sumber berdimensi 232×347 sampai 4016×5354 dengan rasio
        0,67–1,00 — membiarkan tiap gambar menentukan tingginya sendiri membuat
        seluruh baris identitas bergeser dari satu pegawai ke pegawai lain, dan
        halaman ini justru sedang dibaca berurutan orang per orang. `object-top`
        karena yang terpotong harus bagian bawah: wajah ada di atas.
      */}
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="shrink-0">
          {punyaFoto ? (
            /*
              `<img>`, BUKAN `next/image`. Pengoptimal Next mengambil gambarnya
              lewat permintaan HTTP-nya sendiri dari sisi server, tanpa membawa
              cookie sesi — dan rute foto ini berpenjaga sesi, jadi yang didapat
              pengoptimal adalah 401 dan yang tampil di halaman adalah gambar
              rusak. Gambar berpenjaga memang salah satu hal yang tidak bisa
              lewat `next/image`.
            */
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`/api/internal/foto/${profil.nip}`}
              alt={`Foto ${profil.nama}`}
              width={148}
              height={198}
              className="h-[12.375rem] w-[9.25rem] rounded-lg border border-border bg-surface-2 object-cover object-top"
            />
          ) : (
            <div
              className="flex h-[12.375rem] w-[9.25rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-2"
              title="Belum ada foto untuk pegawai ini"
            >
              <span
                aria-hidden
                className="flex size-14 items-center justify-center rounded-full bg-accent-subtle text-lg font-semibold text-accent"
              >
                {inisial(profil.nama)}
              </span>
              <span className="text-[11px] text-text-subtle">Belum ada foto</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight text-text">{profil.nama}</h1>
              <p className="tabular mt-0.5 text-[13px] text-text-muted">{formatNip(profil.nip)}</p>
              <p className="mt-1.5 text-sm text-text-muted">
                {profil.namaJabatan ?? 'Belum tertaut ke master jabatan'}
              </p>
              <p className="text-[13px] text-text-subtle">
                {profil.namaUnit ?? '—'}
                {profil.unitInduk ? ` · ${profil.unitInduk}` : ''}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {profil.statusAktif !== 'AKTIF' ? (
                <Badge tone="peringatan">{profil.statusAktif}</Badge>
              ) : (
                <Badge tone="sukses">
                  <StatusDot tone="sukses" />
                  Aktif
                </Badge>
              )}
              {profil.segeraPensiun ? (
                <Badge
                  tone="peringatan"
                  title="Mencapai batas usia pensiun dalam 2 tahun atau kurang"
                >
                  Mendekati BUP
                </Badge>
              ) : null}
              <Badge
                tone="netral"
                title={`Data terakhir disinkronkan dari ${profil.sumberSinkron}`}
              >
                Sumber: {profil.sumberSinkron}
              </Badge>
              {/* Ditaruh berdampingan dengan lencana "Sumber", bukan di dekat nama:
              menyimpan lewat dialog ini mengubah `sumber_sinkron` menjadi
              `manual`, dan itu yang paling perlu terlihat sebelum orang
              menyuntingnya — nilai yang diisi tangan tidak akan tertimpa
              sinkronisasi berikutnya tanpa disadari. */}
              <TombolEditor
                  jenis="identitas"
                  pegawaiId={profil.pegawaiId}
                  pilihanJabatan={pilihanJabatan}
                  label="Ubah data"
                  baris={{
                    namaLengkap: profil.nama,
                    golongan: profil.golongan,
                    pangkat: profil.pangkat,
                    tmtGolongan: profil.tmtGolongan,
                    tmtJabatan: profil.tmtJabatan,
                    jabatanId: profil.jabatanId,
                    tingkatPendidikan: profil.tingkatPendidikan,
                    sekolahTerakhir: profil.sekolahTerakhir,
                    bidangStudiTerakhir: profil.bidangStudiTerakhir,
                    statusAktif: profil.statusAktif,
                  }}
                boleh={bolehUbah}
/>
            </div>
          </div>

          {!profil.nipValid ? (
            <div className="mt-4 flex items-start gap-2 rounded-md border border-warning-border bg-warning-subtle p-2.5">
              <TriangleAlert className="mt-px size-4 shrink-0 text-warning" />
              <p className="text-[11px] leading-relaxed text-text-muted">
                <span className="font-medium text-text">NIP tidak lolos validasi format.</span>{' '}
                {profil.masalahNip.join('; ')}. Usia, jenis kelamin, dan proyeksi pensiun diturunkan
                dari NIP, jadi nilai-nilai itu bisa keliru sampai NIP dibetulkan.
              </p>
            </div>
          ) : null}

          {/*
            Tiga kolom, bukan empat: kolom ini sekarang menyisihkan 9,25rem untuk
            foto, dan mempertahankan empat kolom membuat "Pangkat / Golongan"
            terpotong di laptop 1280px. Delapan butir bio jadi 3+3+2 — mengalir
            ke bawah, bentuk yang diminta.
          */}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-4 lg:grid-cols-3">
            {bio.map((b) => (
              <div key={b.label} className="min-w-0">
                <dt className="text-[10px] font-medium tracking-wide text-text-subtle uppercase">
                  {b.label}
                </dt>
                <dd className="mt-0.5 text-[13px] font-medium text-text break-words" title={b.nilai}>
                  {b.nilai}
                </dd>
                {b.catatan ? (
                  <dd className="text-[11px] text-text-subtle break-words" title={b.catatan}>
                    {b.catatan}
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        </div>
      </div>
    </Panel>
  )
}

async function BagianKelengkapan({ profil }: { profil: ProfilPegawai }) {
  const k = await ambilKelengkapan(profil.pegawaiId, profil.nipValid)
  const tingkat = tingkatKelengkapan(k.persen)
  const nada = tingkat === 'LENGKAP' ? 'sukses' : tingkat === 'CUKUP' ? 'peringatan' : 'bahaya'

  return (
    <Panel>
      <PanelHeader
        judul="Kelengkapan data"
        deskripsi="Dihitung berbobot menurut dampaknya ke penilaian — data yang jadi input rubrik berbobot lebih besar daripada data administratif."
        aksi={
          <Badge tone={nada}>
            <StatusDot tone={nada} />
            {formatSkorRingkas(k.persen)}% · {LABEL_TINGKAT[tingkat]}
          </Badge>
        }
      />

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3">
        <div
          className={
            nada === 'sukses'
              ? 'h-full bg-success'
              : nada === 'peringatan'
                ? 'h-full bg-warning'
                : 'h-full bg-danger'
          }
          style={{ width: `${Math.max(2, k.persen)}%` }}
        />
      </div>

      {k.belum.length === 0 ? (
        <p className="mt-3 text-[13px] text-success">Seluruh butir data sudah lengkap.</p>
      ) : (
        <>
          <p className="mt-3 text-[11px] text-text-subtle">
            {formatAngka(k.belum.length)} butir belum terpenuhi
            {k.prioritas ? ` · prioritas: ${k.prioritas.label}` : ''}
          </p>
          <ul className="mt-2 space-y-1.5">
            {k.belum.map((b) => (
              <li key={b.kunci} className="flex items-start gap-2 text-[12px]">
                <StatusDot tone="peringatan" className="mt-1.5" />
                <span className="min-w-0">
                  <span className="font-medium text-text">{b.label}</span>
                  <span className="text-text-subtle"> — {b.alasan}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  )
}

async function BagianAsesmen({ profil }: { profil: ProfilPegawai }) {
  const bolehUbah = await bolehUbahProfil()
  const ambang = ambangSumbuDari(await ambilPengaturan())
  const asesmen = await ambilRiwayatAsesmen(profil.pegawaiId)
  const terbaru = asesmen[0]

  return (
    <Panel padat className="flex flex-col xl:h-full xl:min-h-0">
      <div className="shrink-0 border-b border-border p-4">
        <PanelHeader
          judul="Posisi Kotak 9 & riwayat asesmen"
          /*
            Deskripsi WAJIB menyebut asal predikatnya.

            Ada DUA "kinerja" di halaman ini, dari dua tabel berbeda: predikat di
            tabel ini datang dari rekaman ASESMEN (`asesmen_talenta.rating_kinerja`,
            kolom RATING KINERJA di berkas sumber) dan itulah yang menurunkan sumbu
            Y Kotak 9 — sementara panel "Tren kinerja" di sebelah membaca
            `kinerja_periode`, rekap SKP triwulanan dari e-Kinerja.
            
            Keduanya bisa berbeda keadaannya: per 24 Agu 2026 predikat terisi
            79/79 sementara `kinerja_periode` KOSONG, sehingga pembaca melihat
            "Predikat: Sangat Baik" di sini dan "belum ada data" di sebelahnya —
            dan wajar menyimpulkan ada yang rusak. Panel Tren kinerja sudah
            menyebut sumbernya ("nilai granular dari e-Kinerja"); yang ini belum,
            jadi penjelasannya sepihak. Ini aturan K-7a: dua angka berbeda tidak
            boleh tampil dengan nama yang sama tanpa penanda asalnya.
          */
          deskripsi={
            asesmen.length === 0
              ? undefined
              : `${formatAngka(asesmen.length)} asesmen tercatat · posisi terbaru dari tahun ${terbaru!.tahunAsesmen} · predikat di sini dari rekaman asesmen (dasar sumbu Y Kotak 9), bukan dari rekap SKP triwulanan e-Kinerja`
          }
          aksi={<TombolEditor jenis="asesmen" pegawaiId={profil.pegawaiId} boleh={bolehUbah} />}
        />
      </div>

      <div className="min-h-0 flex-1 xl:overflow-y-auto">
        {!terbaru ? (
          <p className="p-6 text-center text-[13px] text-text-muted">
            Belum ada asesmen talenta. Tanpa asesmen, pegawai ini tidak punya posisi di Kotak 9 dan
            tidak bisa dinilai untuk jabatan target.
          </p>
        ) : (
          <>
            <div className="flex items-start gap-4 border-b border-border p-4">
              <span
                aria-hidden
                className="tabular flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-accent-subtle text-accent"
              >
                <span className="text-[9px] font-medium tracking-wide uppercase">Kotak</span>
                <span className="text-xl leading-none font-semibold">{terbaru.kotak9}</span>
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-text">
                  {klasifikasiSumbuY(terbaru.nilaiKinerjaY, ambang)} × Potensial{' '}
                  {klasifikasiSumbuX(terbaru.nilaiPotensialX, ambang)}
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-text-subtle">
                  {DESKRIPSI_KOTAK_9[terbaru.kotak9]}
                </p>
                <p className="tabular mt-1.5 text-[11px] text-text-muted">
                  Kinerja {formatSkorRingkas(terbaru.nilaiKinerjaY)} · Potensial{' '}
                  {formatSkorRingkas(terbaru.nilaiPotensialX)} · Nilai Talenta{' '}
                  <span className="font-medium text-text">{formatSkor(terbaru.nilaiTalenta)}</span>
                </p>
              </div>
            </div>

            {/* `relative` — lihat catatan panjang di tabel-target.tsx: header
                kolom aksi memuat `sr-only` yang `absolute`, dan tanpa containing
                block di dalam kontainer gulir ini, luberannya pindah ke
                scrollWidth halaman. Diperbaiki di sini sekalian, sebelum ia
                muncul sebagai gulir horizontal di lebar sempit. */}
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[34rem] text-[12px]">
                <thead>
                  <tr className="border-b border-border text-left text-[10px] tracking-wide text-text-subtle uppercase">
                    <th className="px-4 py-1.5 font-medium">Tahun</th>
                    <th className="px-4 py-1.5 font-medium">Jenis</th>
                    <th className="px-4 py-1.5 font-medium">Jenjang</th>
                    <th className="px-4 py-1.5 text-right font-medium">Potkom</th>
                    <th className="px-4 py-1.5 font-medium">Dipakai</th>
                    <th className="px-4 py-1.5 text-right font-medium">Kinerja</th>
                    <th className="px-4 py-1.5 text-right font-medium">Potensial</th>
                    <th className="px-4 py-1.5 text-right font-medium">Kotak</th>
                    <th className="px-4 py-1.5 font-medium">Status</th>
                    <th className="px-4 py-1.5 text-right font-medium">
                      <span className="sr-only">Aksi</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {asesmen.map((a) => (
                    <tr key={a.id} className="border-b border-border last:border-b-0">
                      <td className="tabular px-4 py-1.5 font-medium text-text">
                        {a.tahunAsesmen}
                      </td>
                      <td className="px-4 py-1.5 text-text-muted">{a.jenisAsesmen}</td>
                      <td className="px-4 py-1.5 text-text-muted">
                        {/* Kosong untuk baris yang masuk sebelum doc/sql/022 —
                          "tidak tercatat", bukan "tidak berjenjang". */}
                        {a.jenjangAsesmen === null ? (
                          <span className="text-text-subtle">tidak tercatat</span>
                        ) : (
                          labelJenjang(a.jenjangAsesmen)
                        )}
                      </td>
                      <td className="tabular px-4 py-1.5 text-right text-text-muted">
                        {formatSkorRingkas(a.potkom)}
                      </td>
                      <td className="px-4 py-1.5">
                        <PilihAsesmenDipakai
                          pegawaiId={profil.pegawaiId}
                          asesmenId={a.id}
                          dipakai={a.dipakai}
                          label={`${a.jenjangAsesmen ?? a.jenisAsesmen} ${a.tahunAsesmen}`}
                          boleh={bolehUbah}
                        />
                      </td>
                      <td className="tabular px-4 py-1.5 text-right">
                        <span className="block text-text-muted">
                          {formatSkorRingkas(a.nilaiKinerjaY)}
                        </span>
                        {/* Predikat & kategori sumbu adalah dua taksonomi berbeda (K-3) */}
                        <span className="block text-[10px] text-text-subtle">
                          {a.predikatKinerja}
                        </span>
                      </td>
                      <td className="tabular px-4 py-1.5 text-right text-text-muted">
                        {formatSkorRingkas(a.nilaiPotensialX)}
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        <Badge
                          tone={a.kotak9 >= 7 ? 'sukses' : a.kotak9 >= 4 ? 'aksen' : 'peringatan'}
                        >
                          {a.kotak9}
                        </Badge>
                      </td>
                      <td className="px-4 py-1.5">
                        {a.statusAsesmen === 'Berlaku' ? (
                          <span className="text-text-subtle">Berlaku</span>
                        ) : (
                          <Badge tone="peringatan">{a.statusAsesmen}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-1.5 text-right">
                        {/* `predikatKinerja` → `ratingKinerja`: nama kolom DB-nya
                          `rating_kinerja`, dan antarmuka profil menamainya lain.
                          Salah satu dari keduanya harus diterjemahkan di sini. */}
                        <TombolEditor
                            jenis="asesmen"
                            pegawaiId={profil.pegawaiId}
                            baris={{
                              id: a.id,
                              tahunAsesmen: a.tahunAsesmen,
                              jenisAsesmen: a.jenisAsesmen,
                              // WAJIB ada di sini. Bidang form tanpa nilai awal dari
                              // kueri bacanya akan tersimpan NULL begitu barisnya
                              // disunting untuk alasan lain — kelas cacat yang sudah
                              // tiga kali terjadi di editor profil (CLAUDE.md).
                              jenjangAsesmen: a.jenjangAsesmen ?? '',
                              statusAsesmen: a.statusAsesmen,
                              nilaiKinerjaY: a.nilaiKinerjaY,
                              potkom: a.potkom,
                              nilaiIntegritas: a.nilaiIntegritas,
                              tahunKinerja: a.tahunKinerja,
                              ratingKinerja: a.predikatKinerja,
                            }}
                          boleh={bolehUbah}
/>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Panel>
  )
}

async function BagianKinerja({ profil }: { profil: ProfilPegawai }) {
  const bolehUbah = await bolehUbahProfil()
  const kinerja = await ambilKinerja(profil.pegawaiId)

  if (kinerja.length === 0) {
    return (
      <Panel className="flex flex-col xl:h-full xl:min-h-0">
        <PanelHeader
          judul="Tren kinerja"
          aksi={<TombolEditor jenis="kinerja" pegawaiId={profil.pegawaiId} boleh={bolehUbah} />}
        />
        <p className="mt-3 text-[13px] text-text-muted">
          Belum ada rekap kinerja periodik dari e-Kinerja.
        </p>
      </Panel>
    )
  }

  const tahunTerbaru = Math.max(...kinerja.map((k) => k.tahun))
  const tahunIni = kinerja
    .filter((k) => k.tahun === tahunTerbaru && k.nilaiKinerja !== null)
    .map((k) => ({
      periode: k.periode,
      nilaiKinerja: k.nilaiKinerja!,
      // JANGAN menambal dengan nilai kinerja. `null` di sini berarti perilaku
      // belum diukur, dan grafik sudah tahu cara menampilkannya begitu —
      // menambalnya menghasilkan dua garis identik yang terbaca sebagai dua
      // pengukuran berbeda yang saling mengonfirmasi.
      nilaiPerilaku: k.nilaiPerilaku,
    }))
    .sort(
      (a, b) =>
        ['TW1', 'TW2', 'TW3', 'TAHUNAN'].indexOf(a.periode) -
        ['TW1', 'TW2', 'TW3', 'TAHUNAN'].indexOf(b.periode),
    )

  return (
    <Panel className="flex flex-col xl:h-full xl:min-h-0">
      <div className="shrink-0">
        <PanelHeader
          judul={`Tren kinerja ${tahunTerbaru}`}
          /*
            Deskripsi mengikuti SUMBER DATANYA, tidak dipaku.

            Kalimat lama selalu berkata "nilai granular dari e-Kinerja". Sejak
            baris TAHUNAN diisi dari predikat Excel (24 Agu 2026) itu tidak benar:
            angkanya skor predikat (Sangat Baik 100 · Baik 80), bukan pengukuran
            granular, dan sumbernya bukan e-Kinerja. Deskripsi yang salah menyebut
            sumber lebih berbahaya daripada tidak menyebut apa pun — ia membuat
            pembaca percaya integrasi yang belum ada.
          */
          deskripsi={
            kinerja.some((k) => k.sumberSync.toLowerCase().includes('kinerja'))
              ? `${formatAngka(tahunIni.length)} periode SKP tercatat · nilai granular dari e-Kinerja, bukan skor sumbu Kotak 9`
              : `${formatAngka(tahunIni.length)} periode tercatat · nilai = skor predikat dari rekaman asesmen (Sangat Baik 100 · Baik 80), bukan nilai SKP terukur dari e-Kinerja`
          }
          aksi={<TombolEditor jenis="kinerja" pegawaiId={profil.pegawaiId} boleh={bolehUbah} />}
        />
      </div>

      <div className="min-h-0 flex-1 xl:overflow-y-auto">
        {tahunIni.length < 2 ? (
          <p className="mt-3 text-[13px] text-text-muted">
            Hanya {formatAngka(tahunIni.length)} periode tercatat pada {tahunTerbaru} — belum cukup
            untuk menggambar tren. Nilai:{' '}
            {tahunIni.map((t) => `${t.periode} ${formatSkor(t.nilaiKinerja)}`).join(' · ') || '—'}
          </p>
        ) : (
          <div className="mt-2">
            <TrenKinerja titik={tahunIni} />
          </div>
        )}

        {/* Daftar periode: SELURUH tahun, bukan cuma yang digambar chart.
          Tanpa ini, periode tahun lama tidak punya satu pun jalan untuk
          disunting — dan penolakan "periode ini sudah terisi, ubah baris itu"
          dari `simpanKinerja` jadi jalan buntu. */}
        <ul className="mt-3 divide-y divide-border border-t border-border">
          {kinerja.map((k) => (
            <li key={k.id} className="flex items-center justify-between gap-3 py-1.5">
              <span className="tabular min-w-0 text-[12px] text-text-muted">
                <span className="font-medium text-text">
                  {k.periode} {k.tahun}
                </span>
                {' · '}
                {k.nilaiKinerja === null ? 'nilai belum diisi' : formatSkor(k.nilaiKinerja)}
                {' · '}
                {k.predikat}
              </span>
              <TombolEditor
                  jenis="kinerja"
                  pegawaiId={profil.pegawaiId}
                  baris={{
                    id: k.id,
                    tahun: k.tahun,
                    periodeSkp: k.periode,
                    nilaiKinerja: k.nilaiKinerja,
                    nilaiPerilaku: k.nilaiPerilaku,
                    predikat: k.predikat,
                  }}
                boleh={bolehUbah}
/>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  )
}

async function BagianMatchScore({
  profil,
  targetKonteks,
  semuaTarget,
}: {
  profil: ProfilPegawai
  /** Kalau ada, hanya jabatan target ini yang ditampilkan. */
  targetKonteks: number | undefined
  /** `?semuaTarget=1` — buka juga jabatan target draft & nonaktif. */
  semuaTarget: boolean
}) {
  const [semua, pengguna, pengalaman] = await Promise.all([
    ambilMatchScore(profil.pegawaiId),
    getCurrentUser(),
    /*
      Dibaca SEKALI untuk seluruh jabatan target: lama pengalaman per jenjang milik
      seorang pegawai sama untuk semua target, jadi membacanya per baris berarti 13
      kali kueri yang isinya identik.
    */
    ambilPengalamanJenjang(profil.pegawaiId),
  ])

  /*
    Disaring di sini, BUKAN di kuerinya. Alasannya butir kedua: panel harus bisa
    mengatakan "ada N jabatan target lain" — dan itu tidak mungkin diketahui kalau
    yang lain tidak pernah diambil. Biayanya nol dalam praktik: satu pegawai
    dihitung untuk paling banyak beberapa puluh target, bukan ribuan.

    Konteks yang TIDAK ADA di daftar (mis. skornya belum dihitung) tidak
    menghasilkan panel kosong: `terpilih` jatuh kembali ke seluruh daftar, dan
    keterangannya menyebutkan bahwa targetnya belum punya baris skor.
  */
  const konteksAda =
    targetKonteks !== undefined && semua.some((s) => s.jabatanTargetId === targetKonteks)

  /*
    Bawaan panel: **hanya jabatan target AKTIF**.

    Ini bukan kerapian, ia membetulkan salah baca yang benar-benar terjadi dua kali
    pada 25 Agu 2026. Panelnya mengurutkan skor MENURUN, sementara target DRAFT &
    NONAKTIF **tidak pernah dihitung ulang** — jadi baris yang paling BASI justru
    paling TINGGI dan duduk di puncak. Terukur pada satu pegawai berhukuman disiplin
    Berat: 45 baris draft memajang Integritas 100 (skor 96,67) di atas 8 baris aktif
    yang sudah benar memajang 25 (skor 85,42). Yang dibaca pemilik proses adalah
    baris teratas, dan kesimpulannya "hukuman disiplinnya tidak berpengaruh" —
    padahal yang ia lihat skor untuk kursi yang tidak dipakai menilai siapa pun.

    Lencana "Draft — tidak dipakai peringkat" saja tidak cukup: ia menjelaskan baris
    yang sudah dibaca, tapi tidak menghentikan angka yang salah dari duduk di paling
    atas.

    `?semuaTarget=1` tetap membuka semuanya — informasinya tidak dihilangkan, hanya
    tidak lagi memimpin. Kalau TIDAK ADA baris aktif, seluruh daftar ditampilkan:
    panel kosong akan terbaca sebagai "belum pernah dihitung", yang beda artinya.
  */
  const aktifSaja = semua.filter((s) => s.statusTarget === 'AKTIF')
  const daftar = konteksAda
    ? semua.filter((s) => s.jabatanTargetId === targetKonteks)
    : semuaTarget || aktifSaja.length === 0
      ? semua
      : aktifSaja
  const disembunyikan = semua.length - daftar.length
  // Sama dengan `PERAN_HITUNG` di `lib/aksi/skoring.ts` — aksinya tetap penegak
  // terakhirnya; ini hanya menyembunyikan tombol yang pasti akan ditolak.
  const bolehIsiManual = punyaPeran(pengguna, ['Super Admin', 'Admin Talenta'])

  return (
    <Panel padat className="flex flex-col xl:h-[min(32rem,64dvh)] xl:min-h-0">
      <div className="shrink-0 border-b border-border p-4">
        <PanelHeader
          judul={
            konteksAda
              ? `Kecocokan dengan ${daftar[0]?.namaTarget ?? 'jabatan target'}`
              : 'Kecocokan dengan jabatan target'
          }
          deskripsi="Formula B: 65% Potensi & Kompetensi + 20% Kualifikasi Jabatan + 15% Integritas & Moralitas. Ketiganya komponen sumbu Potensial — skor ini TIDAK memuat unsur kinerja, jadi baca berdampingan dengan Kotak 9 di atas."
        />
        {/*
          Penyaringan konteks WAJIB dinyatakan, beserta jalan kembalinya. Daftar yang
          disaring diam-diam adalah daftar yang akan dibaca sebagai daftar lengkap —
          dan di sini kesimpulan salahnya berbahaya: "orang ini hanya kandidat satu
          kursi" bisa jadi dasar keputusan penetapan.
        */}
        {disembunyikan > 0 ? (
          <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
            {/*
              Tidak lagi menyebut "dari Suksesi": konteks `?target=` sekarang juga
              datang dari drill-down **Peta Talenta** per jabatan target (25 Agu
              2026). Keterangan yang menyebut asal yang salah membuat pembacanya
              mencari-cari halaman yang tidak ia buka.
            */}
            {konteksAda
              ? 'Dibuka dengan konteks satu jabatan target, jadi hanya itu yang ditampilkan.'
              : `Hanya jabatan target AKTIF yang ditampilkan. ${formatAngka(disembunyikan)} target draft/nonaktif disembunyikan — skornya tidak dihitung ulang, jadi angkanya bisa lebih tinggi sekaligus lebih basi.`}{' '}
            <Link
              href={`/talenta/${profil.nip}?semuaTarget=1`}
              className="text-accent hover:underline"
            >
              Tampilkan semua {formatAngka(semua.length)} jabatan target
            </Link>
          </p>
        ) : null}
      </div>

      {/* Panel ini paling panjang di halaman (terukur 794px dengan 3 jabatan
          target, dan tumbuh tiap target baru) — satu-satunya panel selebar
          halaman yang benar-benar perlu dipatok. Kelengkapan Data & Integritas
          dibiarkan setinggi isinya: keduanya di bawah 200px, jadi mematoknya
          justru MENAMBAH ruang kosong, kebalikan dari yang diminta. */}
      <div className="min-h-0 flex-1 xl:overflow-y-auto">
        {daftar.length === 0 ? (
          <p className="p-6 text-center text-[13px] text-text-muted">
            Belum ada perhitungan kecocokan. Skor terbentuk setelah pegawai dinilai terhadap suatu
            jabatan target.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {daftar.map((s) => (
              <li key={s.jabatanTargetId} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-text">{s.namaTarget}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-text-subtle">
                      {s.eligible ? (
                        <Badge tone="sukses">Lolos syarat</Badge>
                      ) : (
                        <Badge tone="bahaya">Tidak lolos syarat</Badge>
                      )}
                      {/*
                        Status jabatan targetnya ditandai untuk yang BUKAN aktif.
                        Panel ini mengurutkan menurut skor menurun, sementara draft &
                        nonaktif tidak pernah dihitung ulang — jadi barisnya bisa
                        memajang angka LEBIH TINGGI yang justru lebih basi, dan duduk
                        di puncak daftar. Terukur pada satu pegawai: draft 96,67 di
                        atas aktif 85,42, dan yang 96,67 itu dihitung sebelum catatan
                        disiplinnya masuk. Tanpa penanda ini, angka teratas dibaca
                        sebagai skor yang berlaku.
                      */}
                      {s.statusTarget !== 'AKTIF' ? (
                        <Badge
                          tone="peringatan"
                          title="Jabatan target ini tidak aktif, jadi skornya tidak dihitung ulang dan tidak dipakai peringkat talent pool."
                        >
                          {s.statusTarget === 'DRAFT' ? 'Draft' : 'Nonaktif'} — tidak dipakai
                          peringkat
                        </Badge>
                      ) : null}
                      {s.statusTalentPool ? (
                        <Badge tone="aksen">
                          Talent pool: {s.statusTalentPool}
                          {s.ranking ? ` · peringkat ${s.ranking}` : ''}
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  <span className="tabular shrink-0 text-right">
                    <span className="block text-xl leading-none font-semibold text-text">
                      {formatSkor(s.skorTotal)}
                    </span>
                    <span className="text-[10px] text-text-subtle">skor total</span>
                  </span>
                </div>

                {/*
                  Penanda skor BASI terhadap rekam jejak disiplin. Tanpa ini, satu
                  halaman memajang "1 hukuman aktif · Berat" di panel Integritas dan
                  "Verifikasi Rekam Jejak Disiplin 100 · Tidak Pernah" di sini —
                  bertentangan, tanpa satu pun keterangan. Dilaporkan pemilik proses
                  25 Agu 2026, dan kesimpulan wajarnya "fiturnya tidak berfungsi".

                  Yang benar bukan menyembunyikan angkanya (ia memang angka yang
                  dipakai peringkat sekarang), melainkan menyatakan bahwa ia belum
                  memperhitungkan catatan terbaru — dan menyebut tindakan yang
                  membereskannya.
                */}
                {s.disiplinLebihBaru ? (
                  <p className="mt-2 flex items-start gap-1.5 rounded-md border border-warning-border bg-warning-subtle px-2.5 py-2 text-[11px] leading-relaxed text-text-muted">
                    <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" />
                    <span>
                      <strong className="font-medium text-text">
                        Skor ini dihitung sebelum catatan disiplin terbaru
                      </strong>{' '}
                      — komponen Integritas &amp; Moralitas di baris ini belum
                      memperhitungkannya. Jalankan{' '}
                      <Link
                        href={`/jabatan-target/${s.jabatanTargetId}`}
                        className="text-accent hover:underline"
                      >
                        Hitung Ulang
                      </Link>{' '}
                      pada jabatan target itu.
                    </span>
                  </p>
                ) : null}

                {s.catatanEligibility ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-text-subtle">
                    {s.catatanEligibility}
                  </p>
                ) : null}

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <Komponen
                    label="Potensi & Kompetensi"
                    bobot={0.65}
                    skor={s.skorPotensiKompetensi}
                  />
                  <Komponen
                    label="Kualifikasi Jabatan"
                    bobot={0.2}
                    skor={s.skorKualifikasiJabatan}
                  />
                  <Komponen
                    label="Integritas & Moralitas"
                    bobot={0.15}
                    skor={s.skorIntegritasMoralitas}
                  />
                </div>

                <RincianSkor
                  rincian={s.rincian}
                  pegawaiId={profil.pegawaiId}
                  jabatanTargetId={s.jabatanTargetId}
                  bolehIsiManual={bolehIsiManual}
                  pengalaman={pengalaman}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  )
}

function Komponen({ label, bobot, skor }: { label: string; bobot: number; skor: number }) {
  return (
    <div className="rounded-md border border-border bg-surface-2 p-2.5">
      <p className="flex items-center justify-between text-[10px] text-text-subtle">
        <span className="min-w-0 break-words">{label}</span>
        <span className="tabular ml-1 shrink-0">{formatBobot(bobot)}</span>
      </p>
      <p className="tabular mt-1 text-sm font-semibold text-text">{formatSkor(skor)}</p>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
        <div className="h-full bg-accent" style={{ width: `${Math.max(2, skor)}%` }} />
      </div>
    </div>
  )
}

async function BagianRiwayatJabatan({ profil }: { profil: ProfilPegawai }) {
  const bolehUbah = await bolehUbahProfil()
  const [riwayat, pilihanJabatan] = await Promise.all([
    ambilRiwayatJabatan(profil.pegawaiId),
    ambilPilihanJabatan(),
  ])
  const belumTerpetakan = riwayat.filter((r) => !r.terpetakan).length

  return (
    <Panel className="flex flex-col xl:h-full xl:min-h-0">
      <div className="shrink-0">
        <PanelHeader
          judul="Riwayat jabatan"
          deskripsi={
            riwayat.length === 0
              ? undefined
              : `${formatAngka(riwayat.length)} riwayat${belumTerpetakan > 0 ? ` · ${formatAngka(belumTerpetakan)} belum terpetakan ke master jabatan DJBK` : ''}`
          }
          aksi={
            <>
              {riwayat.some((r) => r.nonDefinitif) ? (
                <Badge
                  tone="aksen"
                  title="Penugasan Plt/Plh menjadi input sub-indikator Substansi Riwayat Jabatan"
                >
                  Ada penugasan Plt/Plh
                </Badge>
              ) : null}
              <TombolEditor
                  jenis="riwayatJabatan"
                  pegawaiId={profil.pegawaiId}
                  pilihanJabatan={pilihanJabatan}
                boleh={bolehUbah}
/>
            </>
          }
        />
      </div>

      <div className="min-h-0 flex-1 xl:overflow-y-auto">
        {riwayat.length === 0 ? (
          <p className="mt-3 text-[13px] text-text-muted">Belum ada riwayat jabatan tercatat.</p>
        ) : (
          <ol className="mt-4 space-y-0">
            {riwayat.map((r, i) => (
              <li key={r.urutan} className="relative flex gap-3 pb-4 last:pb-0">
                {/* Garis timeline */}
                {i < riwayat.length - 1 ? (
                  <span aria-hidden className="absolute top-3 left-[5px] h-full w-px bg-border" />
                ) : null}
                <span
                  aria-hidden
                  className={
                    i === 0
                      ? 'relative mt-1.5 size-2.5 shrink-0 rounded-full bg-accent ring-2 ring-accent-subtle'
                      : 'relative mt-1.5 size-2.5 shrink-0 rounded-full bg-border-strong'
                  }
                />
                <div className="min-w-0 flex-1">
                  <span className="float-right ml-2">
                    <TombolEditor
                        jenis="riwayatJabatan"
                        pegawaiId={profil.pegawaiId}
                        pilihanJabatan={pilihanJabatan}
                        baris={{
                          id: r.id,
                          jabatanNamaMentah: r.namaMentah,
                          jabatanId: r.jabatanId,
                          jenisPenugasan: r.jenisPenugasan,
                          unitKerjaMentah: r.unitKerjaMentah,
                          tanggalMulai: r.tanggalMulai,
                          tanggalAkhir: r.tanggalAkhir,
                          lamaBulan: r.lamaBulan,
                          noSk: r.noSk,
                        }}
                      boleh={bolehUbah}
/>
                  </span>
                  <p className="text-[13px] leading-snug font-medium text-text">
                    {r.namaJabatan ?? r.namaMentah}
                    {r.nonDefinitif ? (
                      <Badge tone="aksen" className="ml-1.5">
                        {r.nonDefinitif}
                      </Badge>
                    ) : null}
                  </p>
                  {r.namaJabatan && r.namaMentah !== r.namaJabatan ? (
                    <p className="mt-0.5 text-[11px] text-text-subtle">
                      Teks sumber: {r.namaMentah}
                    </p>
                  ) : null}
                  {/*
                    Baris berdurasi-tanpa-tanggal TIDAK ditulis sebagai rentang.
                    "tanggal belum ada – sekarang" menyatakan jabatan yang masih
                    berjalan, dan itu salah untuk 229 baris riwayat yang sumbernya
                    (berkas Talent Pool ES 2 & 3) memang hanya memberi lamanya.
                  */}
                  <p className="tabular mt-0.5 text-[11px] text-text-subtle">
                    {r.sumberLama === 'DURASI' ? (
                      <>
                        Lama {formatDurasiTahun(r.lamaTahun)}
                        <span className="text-text-muted"> · tanggal tidak ada di sumbernya</span>
                      </>
                    ) : (
                      <>
                        {r.tanggalMulai ? formatTanggal(r.tanggalMulai) : 'tanggal belum ada'}
                        {' – '}
                        {r.tanggalAkhir ? formatTanggal(r.tanggalAkhir) : 'sekarang'}
                        {r.lamaTahun !== null ? ` · ${formatDurasiTahun(r.lamaTahun)}` : ''}
                      </>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-subtle">
                    {r.namaUnit ?? (r.terpetakan ? '—' : 'Di luar master jabatan DJBK')}
                    {r.eselon && r.eselon !== 'NON_ESELON' ? ` · Eselon ${r.eselon}` : ''}
                    {r.noSk ? ` · ${r.noSk}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </Panel>
  )
}

async function BagianPendidikan({ profil }: { profil: ProfilPegawai }) {
  const bolehUbah = await bolehUbahProfil()
  const riwayat = await ambilRiwayatPendidikan(profil.pegawaiId)

  // Kolom arsip disembunyikan kalau SELURUH baris kosong — menampilkan tiga
  // kolom berisi tanda hubung tidak memberi informasi apa pun (phase.md §6 no. 8).
  const adaIjazah = riwayat.some((r) => r.urlIjazah !== null)
  const adaTranskrip = riwayat.some((r) => r.urlTranskrip !== null)
  const adaPertek = riwayat.some((r) => r.noPertekBkn !== null)
  const kolomDisembunyikan = [
    !adaIjazah && 'ijazah',
    !adaTranskrip && 'transkrip',
    !adaPertek && 'pertek BKN',
  ].filter(Boolean) as string[]

  return (
    <Panel className="flex flex-col xl:min-h-0 xl:flex-1">
      <div className="shrink-0">
        <PanelHeader
          judul="Riwayat pendidikan"
          deskripsi={
            riwayat.length === 0 ? undefined : `${formatAngka(riwayat.length)} jenjang tercatat`
          }
          aksi={<TombolEditor jenis="pendidikan" pegawaiId={profil.pegawaiId} boleh={bolehUbah} />}
        />
      </div>

      <div className="min-h-0 flex-1 xl:overflow-y-auto">
        {riwayat.length === 0 ? (
          <p className="mt-3 text-[13px] text-text-muted">
            Belum ada riwayat pendidikan. Indikator Tingkat Pendidikan Formal & Kesesuaian Bidang
            Ilmu tidak bisa dihitung tanpa data ini.
          </p>
        ) : (
          <>
            <ul className="mt-3 divide-y divide-border">
              {riwayat.map((r) => (
                <li key={`${r.jenjang}-${r.urutan}`} className="py-2.5 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-text">
                        {formatTingkatPendidikan(r.jenjang)} · {r.bidangStudi}
                      </p>
                      <p className="mt-0.5 text-[11px] text-text-subtle">
                        {r.namaSekolah ?? 'Nama sekolah belum terisi'}
                        {r.tahunLulus ? ` · lulus ${r.tahunLulus}` : ' · tahun lulus belum terisi'}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1">
                      {/* Pemetaan kunci antarmuka → kunci formulir ditulis EKSPLISIT.
                        Meneruskan `r` apa adanya akan diam-diam gagal: antarmukanya
                        memakai `jenjang` sementara formulirnya `jenjangPendidikan`,
                        jadi pemilihnya terbuka pada pilihan pertama dan menyimpan
                        akan MENGUBAH jenjang yang tidak disentuh siapa pun. */}
                      <TombolEditor
                          jenis="pendidikan"
                          pegawaiId={profil.pegawaiId}
                          baris={{
                            id: r.id,
                            jenjangPendidikan: r.jenjang,
                            bidangStudi: r.bidangStudi,
                            namaSekolah: r.namaSekolah,
                            tahunLulus: r.tahunLulus,
                            noPertekBkn: r.noPertekBkn,
                          }}
                        boleh={bolehUbah}
/>
                      {adaIjazah ? (
                        r.urlIjazah ? (
                          <Badge tone="sukses">Ijazah</Badge>
                        ) : (
                          <Badge tone="netral">Ijazah belum ada</Badge>
                        )
                      ) : null}
                      {adaPertek && r.noPertekBkn ? (
                        <Badge tone="aksen" title={r.noPertekBkn}>
                          Pertek BKN
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {kolomDisembunyikan.length > 0 ? (
              <p className="mt-3 border-t border-border pt-3 text-[11px] text-text-subtle">
                Kolom {kolomDisembunyikan.join(', ')} disembunyikan karena belum ada satu pun data
                arsipnya. Unggah arsip dilakukan dari halaman Master Data
              </p>
            ) : null}
          </>
        )}
      </div>
    </Panel>
  )
}

async function BagianDiklat({ profil }: { profil: ProfilPegawai }) {
  const bolehUbah = await bolehUbahProfil()
  return (
    <Panel className="flex flex-col xl:min-h-0 xl:flex-1">
      <div className="shrink-0">
        <PanelHeader
          judul="Riwayat diklat & sertifikasi"
          deskripsi={
            profil.riwayatDiklat.length === 0
              ? undefined
              : // Sengaja TIDAK lagi menulis "input indikator Pengembangan Kompetensi":
                // sejak doc/sql/014-015 yang menjadi input adalah KATEGORI hasil
                // validasi, bukan daftar nama ini. Label lama akan membuat orang
                // menyimpulkan skornya sudah terhitung padahal diklatnya belum
                // dikategorikan — dan itu justru keadaan yang paling sering terjadi.
                `${formatAngka(profil.riwayatDiklat.length)} entri dari eHRM · indikator Pengembangan Kompetensi memakai kategori hasil validasi, bukan daftar ini`
          }
          aksi={<TombolEditor jenis="diklat" pegawaiId={profil.pegawaiId} boleh={bolehUbah} />}
        />
      </div>
      <div className="min-h-0 flex-1 xl:overflow-y-auto">
        <DaftarDiklat
          diklat={profil.riwayatDiklat}
          pegawaiId={profil.pegawaiId}
          bolehUbah={bolehUbah}
        />
      </div>
    </Panel>
  )
}

async function BagianIntegritas({ profil }: { profil: ProfilPegawai }) {
  const [hukuman, bolehUbah] = await Promise.all([
    ambilHukumanDisiplin(profil.pegawaiId),
    bolehUbahProfil(),
  ])
  const aktif = hukuman.filter((h) => h.statusAktif && h.tingkatHukuman !== 'Tidak Pernah')
  const nonaktif = hukuman.filter((h) => !h.statusAktif && h.tingkatHukuman !== 'Tidak Pernah')
  const diverifikasi = profil.hukdisVerifikasi !== null

  return (
    <Panel>
      <PanelHeader
        judul="Integritas & rekam jejak disiplin"
        deskripsi="Data sensitif — akses dibatasi peran tertentu (UU PDP No. 27/2022). Hanya riwayat berstatus aktif yang menurunkan skor Integritas & Moralitas."
        aksi={
          aktif.length > 0 ? (
            <Badge tone="bahaya">{formatAngka(aktif.length)} hukuman aktif</Badge>
          ) : hukuman.length > 0 ? (
            <Badge tone="sukses">Tidak ada hukuman aktif</Badge>
          ) : diverifikasi ? (
            <Badge tone="sukses">Diperiksa · tanpa catatan</Badge>
          ) : (
            <Badge>Tanpa catatan</Badge>
          )
        }
      />

      {hukuman.length === 0 ? (
        /*
          Keadaan bawaan NETRAL, bukan kotak peringatan (permintaan pemilik proses
          25 Agu 2026). Sebelumnya setiap pegawai tanpa catatan tampil seperti
          datanya bermasalah — padahal bagi mayoritas yang memang tidak pernah
          dijatuhi hukuman itu keadaan yang benar, dan peringatan yang muncul di
          hampir semua profil berhenti dibaca.

          Yang membedakan "belum diperiksa" dari "diperiksa, hasilnya bersih"
          sekarang ceklisnya, bukan warna kotaknya.
        */
        <div className="mt-3">
          <p className="text-[12px] leading-relaxed text-text-muted">
            <strong className="font-medium text-text">Tanpa catatan hukuman disiplin.</strong> Skor
            Integritas &amp; Moralitas dihitung 100 untuk keadaan ini.{' '}
            {/*
              Dua jalan melengkapi butir kesiapan datanya, dan keduanya disebut di
              sini (permintaan pemilik proses 25 Agu 2026). Kalau hanya ceklisnya
              yang disebut, orang yang MEMANG punya catatan akan mencentangnya
              alih-alih mencatat hukumannya — dan itu justru menghapus informasi
              yang paling perlu ada.
            */}
            Kalau pegawai ini sebenarnya <strong className="font-medium text-text">punya</strong>{' '}
            hukuman disiplin, catat di{' '}
            <Link href="/master/hukuman-disiplin" className="text-accent hover:underline">
              Master Data › Hukuman Disiplin
            </Link>{' '}
            — jangan dicentang di bawah.
          </p>
          {bolehUbah ? (
            <CentangVerifikasiHukdis
              pegawaiId={profil.pegawaiId}
              verifikasi={profil.hukdisVerifikasi}
            />
          ) : diverifikasi ? (
            <p className="mt-2 text-[11px] leading-relaxed text-text-subtle">
              Sudah diperiksa{' '}
              {profil.hukdisVerifikasi?.olehNama ?? 'pengguna yang sudah dihapus'}
              {profil.hukdisVerifikasi?.pada
                ? ` · ${formatTanggalWaktu(profil.hukdisVerifikasi.pada)}`
                : ''}
              .
            </p>
          ) : (
            <p className="mt-2 text-[11px] leading-relaxed text-text-subtle">
              Belum ada yang menandainya sudah diperiksa.
            </p>
          )}
        </div>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {[...aktif, ...nonaktif].map((h, i) => (
            <li key={i} className="py-2.5 first:pt-0 last:pb-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-text">
                    Hukuman disiplin {h.tingkatHukuman}
                  </p>
                  <p className="mt-0.5 text-[11px] text-text-subtle">
                    {h.tanggalSk ? formatTanggal(h.tanggalSk) : 'tanggal SK belum ada'}
                    {h.noSk ? ` · ${h.noSk}` : ''}
                  </p>
                  {h.keterangan ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
                      {h.keterangan}
                    </p>
                  ) : null}
                </div>
                <Badge tone={h.statusAktif ? 'bahaya' : 'netral'}>
                  {h.statusAktif ? 'Aktif' : 'Sudah tidak berlaku'}
                </Badge>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/*
        Kotak CATATAN (`2 sept- masukan sistem informasi.pdf` butir 1) duduk di
        panel INI, bukan panel sendiri — pemilik proses menggambarnya "di dekat
        integritas/moralitas", dan panel terpisah untuk satu kode akan menambah
        satu kotak setinggi judulnya sendiri di halaman yang sudah padat.

        Ia dirender di LUAR percabangan di atas supaya muncul baik untuk pegawai
        yang punya catatan hukuman maupun yang tidak: kodenya tidak menggambarkan
        hukuman disiplin saja, dan menyembunyikannya pada salah satu cabang berarti
        sebagian pegawai tidak bisa diberi catatan sama sekali.
      */}
      <KotakCatatan
        pegawaiId={profil.pegawaiId}
        nama={profil.nama}
        catatan={profil.catatan}
        bolehUbah={bolehUbah}
      />
    </Panel>
  )
}

// ---------------------------------------------------------------------------

function PanelMemuat({
  judul,
  baris,
  className,
}: {
  judul: string
  baris: number
  className?: string
}) {
  return (
    <Panel className={className}>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="mt-2 h-3 w-full max-w-lg" />
      <div className="mt-4">
        <ListSkeleton rows={baris} />
      </div>
      <span className="sr-only">Memuat {judul}</span>
    </Panel>
  )
}

function PanelChartMemuat({ judul, className }: { judul: string; className?: string }) {
  return (
    <Panel className={className}>
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-2 h-3 w-full max-w-md" />
      <div className="mt-3">
        <ChartSkeleton ratio="16 / 9" />
      </div>
      <span className="sr-only">Memuat {judul}</span>
    </Panel>
  )
}
