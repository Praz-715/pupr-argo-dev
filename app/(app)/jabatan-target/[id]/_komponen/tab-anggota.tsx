'use client'

import { Building2, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { KotakCari } from '@/components/ui/kotak-cari'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { useToast } from '@/components/ui/toast'
import {
  hapusAnggotaJabatan,
  hapusAnggotaSekaligus,
  tambahAnggotaJabatan,
  tambahAnggotaSekaligus,
} from '@/lib/aksi/jabatan-target'
import { cn } from '@/lib/cn'
import { formatAngka } from '@/lib/format'
import { jenisJabatan, kunciJenisJabatan, kunciRumpunJabatan, rumpunJabatan } from '@/lib/jenis-jabatan'
import type { JabatanAnggota } from '@/lib/kueri/rubrik'

/** Satu JENIS jabatan beserta kursi-kursinya (nama sama, unit berbeda). */
interface KelompokJenis {
  kunci: string
  jenis: string
  eselon: string
  anggota: JabatanAnggota[]
  /** Berapa di antaranya kursinya SENDIRI sudah jadi jabatan target. */
  jumlahTerpakai: number
}

/** Satu baris daftar pilihan: satu RUMPUN ("Kepala Balai") beserta jenis di dalamnya. */
interface KelompokRumpun {
  kunci: string
  rumpun: string
  jenis: KelompokJenis[]
  jumlahTerpakai: number
}

const jumlahKursi = (r: KelompokRumpun) => r.jenis.reduce((n, g) => n + g.anggota.length, 0)

/** Eselon yang terwakili sebuah rumpun — satu nilai kalau seragam, rentang kalau tidak. */
function labelEselon(r: KelompokRumpun): string {
  const set = [...new Set(r.jenis.map((g) => g.eselon))]
  return set.length === 1 ? set[0]! : `${set.length} jenjang`
}

/**
 * Tab 1 — Jabatan Asal Kandidat: jabatan mana saja yang pejabatnya boleh
 * dinominasikan untuk kursi ini.
 *
 * ⚠️ ARTINYA BERUBAH 1 Sep 2026, dan namanya ikut diganti supaya tidak ada yang
 * membacanya dengan arti lama. Sampai hari itu tab ini berisi "kursi yang dituju"
 * — dan kursinya sekarang tinggal di `jabatan_target.jabatan_id` (`doc/sql/032`),
 * satu FK tunggal, sebab satu jabatan target memang selalu menunjuk satu kursi
 * (terukur: 14 dari 14). `jabatan_target_anggota` yang jadi bebas dipakai untuk hal
 * yang MEMANG banyak: daftar jabatan asal.
 *
 * Daftar ini **menggugurkan**: kandidat yang jabatannya sekarang tidak ada di sini
 * dinyatakan tidak lolos syarat. Daftar KOSONG = tidak menyaring, dan itu bawaan
 * draft baru — gerbang yang menggugurkan semua orang selama daftarnya belum diisi
 * membuat setiap draft baru tampak rusak.
 *
 * Pencarian jabatan tersedia lewat **URL** (`?cariJabatan=`), bukan filter di
 * klien: master jabatan punya 47 baris di dev dan akan jauh lebih banyak di
 * produksi, jadi mengirim seluruh daftar ke browser hanya untuk difilter di sana
 * adalah pola yang akan menggigit belakangan (phase.md §3 K-5).
 */
export function TabAnggota({
  jabatanTargetId,
  anggota,
  tersedia,
  cari,
  rumpun,
  semuaJenjang,
  bolehUbah,
}: {
  jabatanTargetId: number
  anggota: JabatanAnggota[]
  tersedia: JabatanAnggota[]
  cari: string
  /** Kunci rumpun terpilih; string kosong = tidak menyaring (bawaan). */
  rumpun: string
  semuaJenjang: boolean
  bolehUbah: boolean
}) {
  const { tampilkan } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()
  const [mencari, transisiCari] = useTransition()

  const [teks, setTeks] = useState(cari)
  const [dibuka, setDibuka] = useState<Set<string>>(() => new Set())
  /** Kelompok daftar TERPASANG yang sedang dibuka — terpisah dari `dibuka`. */
  const [dibukaTerpasang, setDibukaTerpasang] = useState<Set<string>>(() => new Set())
  const [cariTerpasang, setCariTerpasang] = useState('')

  // Kalau URL berubah dari luar (tombol back), field ikut disesuaikan.
  const [cariTerakhir, setCariTerakhir] = useState(cari)
  if (cari !== cariTerakhir) {
    setCariTerakhir(cari)
    setTeks(cari)
  }

  /*
    Daftar pilihan dikelompokkan menurut JENIS jabatan, bukan per kursi.

    Permintaan pemilik proses 31 Agu 2026: daftarnya *"masih terlalu spesifik …
    bikin lebih general aja jabatan apa aja yang bisa dinominasikan"*. Terukur di
    master: 63 baris "Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah …"
    dan 41 "Kepala Sub Bagian Umum dan Tata Usaha" — bagi pembacanya itu DUA
    jabatan, bukan 104.

    Dikelompokkan di KLIEN, bukan di SQL, dan itu pilihan sadar: aturannya
    (`lib/jenis-jabatan.ts`) dipakai juga oleh uji unit dan bisa berubah, dan
    menuliskannya dua kali — sekali TypeScript, sekali SQL — berarti dua aturan
    yang bisa berselisih tanpa ada yang gagal. Barisnya sudah tersaring jenjang &
    pencarian lebih dulu, jadi yang dikelompokkan puluhan baris, bukan tabel penuh.

    Kursi yang sudah jadi anggota target LAIN tidak disembunyikan — ia dihitung
    dan disebut, alasan yang sama dengan `cariJabatanUntukTargetBaru()`:
    menyembunyikannya membuat orang mencari nama yang jelas ada di master lalu
    menyimpulkan pencariannya rusak.
  */
  /*
    Penyaring RUMPUN (`Detail Revisi PUPR 1_9_2026.pdf`, butir 4): satu pilihan
    "Kepala Balai" menjaring seluruh kepala balai, apa pun nama balainya.

    Ia menyaring, ia TIDAK mengganti pengelompokan. Dikelompokkan per rumpun,
    "Kepala Seksi Pengadaan" dan "Kepala Seksi Perbendaharaan" akan duduk dalam
    satu baris ber-tombol "Tambah semua" — dua kursi yang persyaratannya memang
    berbeda, ditambahkan sekaligus dengan satu klik. Pelipatan kasar aman untuk
    MENYARING dan tidak aman untuk MENYATUKAN; itu perbedaan yang sama yang
    dijaga `jenisJabatan()` vs `rumpunJabatan()` di `lib/jenis-jabatan.ts`.

    Disaring di klien karena barisnya sudah di sini (tersaring jenjang & pencarian
    di server lebih dulu), dan karena aturannya TypeScript — menuliskannya lagi
    sebagai pola SQL berarti dua aturan yang bisa berselisih.
  */
  const opsiRumpun = (() => {
    const peta = new Map<string, { kunci: string; label: string; jumlah: number }>()
    for (const j of tersedia) {
      const kunci = kunciRumpunJabatan(j.namaJabatan)
      const ada = peta.get(kunci)
      if (ada) ada.jumlah++
      else peta.set(kunci, { kunci, label: rumpunJabatan(j.namaJabatan), jumlah: 1 })
    }
    return [...peta.values()].sort((a, b) => b.jumlah - a.jumlah || a.label.localeCompare(b.label))
  })()

  const tersaring =
    rumpun === '' ? tersedia : tersedia.filter((j) => kunciRumpunJabatan(j.namaJabatan) === rumpun)

  /*
    Daftar TERPASANG dikelompokkan & bisa dicari juga (permintaan pemilik proses
    1 Sep 2026: *"bikin parent child kaya di tambah jabatan biar gak panjang banget
    sama bisa di search juga"*). Terukur: 59–67 kursi per jabatan target, dan
    sebagai daftar datar ia satu-satunya bagian halaman yang harus digulir puluhan
    layar.

    Pencariannya di KLIEN, tidak lewat URL seperti panel sebelahnya: barisnya sudah
    ada di sini seluruhnya (bukan 20 teratas dari server), jadi mengirim ulang ke
    server hanya menambah bolak-balik untuk data yang sudah dipegang browser.
  */
  const terpasangTersaring =
    cariTerpasang.trim() === ''
      ? anggota
      : anggota.filter((j) =>
          `${j.namaJabatan} ${j.namaUnit} ${j.kodeJabatan}`
            .toLowerCase()
            .includes(cariTerpasang.trim().toLowerCase()),
        )

  const kelompokTerpasang: KelompokRumpun[] = (() => {
    const peta = new Map<string, KelompokRumpun>()
    for (const j of terpasangTersaring) {
      const kunciR = kunciRumpunJabatan(j.namaJabatan)
      let r = peta.get(kunciR)
      if (!r) {
        r = { kunci: kunciR, rumpun: rumpunJabatan(j.namaJabatan), jenis: [], jumlahTerpakai: 0 }
        peta.set(kunciR, r)
      }
      const kunciJ = kunciJenisJabatan(j.namaJabatan)
      let g = r.jenis.find((x) => x.kunci === kunciJ)
      if (!g) {
        g = {
          kunci: kunciJ,
          jenis: jenisJabatan(j.namaJabatan),
          eselon: j.eselon ? `Eselon ${j.eselon}` : 'Non-eselon',
          anggota: [],
          jumlahTerpakai: 0,
        }
        r.jenis.push(g)
      }
      g.anggota.push(j)
    }
    for (const r of peta.values()) r.jenis.sort((a, b) => a.jenis.localeCompare(b.jenis))
    return [...peta.values()].sort(
      (a, b) => jumlahKursi(b) - jumlahKursi(a) || a.rumpun.localeCompare(b.rumpun),
    )
  })()

  /*
    Dikelompokkan per RUMPUN (`koreksi sistem informasi.pdf` 1 Sep 2026, butir 1):
    daftarnya harus berbunyi *"Kepala Balai · Kepala Bagian · Kepala Sub Direktorat ·
    Kepala Sub Bagian · Kepala Seksi"*, bukan satu baris per nama jabatan lengkap.

    ## "Tambah semua" ada di SETIAP rumpun — pembatasannya dicabut 1 Sep 2026

    Versi sebelumnya menyembunyikan tombol itu untuk rumpun bercabang, dengan
    alasan yang benar SELAMA daftar ini berarti "kursi yang dituju": satu klik yang
    memasukkan Kepala Seksi Pengadaan DAN Perbendaharaan berarti satu jabatan
    target diam-diam mewakili dua kursi sekaligus.

    Sejak daftar ini berarti **jabatan asal kandidat**, bahaya itu tidak ada lagi —
    "kandidat boleh datang dari Kepala Seksi mana pun" justru hal yang wajar
    diinginkan, dan tidak menggabungkan kursi apa pun. Yang tertinggal hanya
    ketidakkonsistenan yang tidak bisa dijelaskan ke pengguna, dan pemilik proses
    menanyakannya: *"kenapa ada yang tambah semua ada yang gaada"*.

    Contoh yang membuatnya paling jelas: rumpun "Analis Sumber Daya Manusia
    Aparatur" berisi tiga jenis — Ahli Madya, Ahli Muda, Ahli Pertama. Itu satu
    pekerjaan pada tiga jenjang, bukan tiga kursi yang persyaratannya berbeda.

    Pembagian `lib/jenis-jabatan.ts` tetap berlaku dan tetap dipakai: rumpun untuk
    MENGELOMPOKKAN & MENYARING, jenis untuk membedakan kursi di dalamnya — yang
    berubah cuma bahwa mengelompokkan tidak lagi berarti melarang.
  */
  const kelompok: KelompokRumpun[] = (() => {
    const peta = new Map<string, KelompokRumpun>()
    for (const j of tersaring) {
      const kunciR = kunciRumpunJabatan(j.namaJabatan)
      let r = peta.get(kunciR)
      if (!r) {
        r = { kunci: kunciR, rumpun: rumpunJabatan(j.namaJabatan), jenis: [], jumlahTerpakai: 0 }
        peta.set(kunciR, r)
      }
      const kunciJ = kunciJenisJabatan(j.namaJabatan)
      let g = r.jenis.find((x) => x.kunci === kunciJ)
      if (!g) {
        g = {
          kunci: kunciJ,
          jenis: jenisJabatan(j.namaJabatan),
          eselon: j.eselon ? `Eselon ${j.eselon}` : 'Non-eselon',
          anggota: [],
          jumlahTerpakai: 0,
        }
        r.jenis.push(g)
      }
      g.anggota.push(j)
      if (j.targetLain) {
        g.jumlahTerpakai++
        r.jumlahTerpakai++
      }
    }
    for (const r of peta.values()) r.jenis.sort((a, b) => a.jenis.localeCompare(b.jenis))
    return [...peta.values()].sort(
      (a, b) => jumlahKursi(b) - jumlahKursi(a) || a.rumpun.localeCompare(b.rumpun),
    )
  })()

  function terapkanRumpun(nilai: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'anggota')
    if (nilai === '') params.delete('rumpun')
    else params.set('rumpun', nilai)
    transisiCari(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  function terapkanCari(nilai: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'anggota')
    if (nilai.trim() === '') params.delete('cariJabatan')
    else params.set('cariJabatan', nilai)
    transisiCari(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  function tambah(jabatan: JabatanAnggota) {
    mulaiTransisi(async () => {
      const hasil = await tambahAnggotaJabatan(jabatanTargetId, jabatan.id)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Ditambahkan.' }
          : { nada: 'bahaya', judul: 'Gagal menambahkan', keterangan: hasil.pesan },
      )
    })
  }

  function tambahSemua(g: KelompokJenis) {
    mulaiTransisi(async () => {
      const hasil = await tambahAnggotaSekaligus(
        jabatanTargetId,
        g.anggota.map((j) => j.id),
      )
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Ditambahkan.' }
          : { nada: 'bahaya', judul: 'Gagal menambahkan', keterangan: hasil.pesan },
      )
    })
  }

  /**
   * Seluruh kursi di dalam satu RUMPUN, lintas jenis.
   *
   * Idnya dikumpulkan dari yang sedang tampil, bukan dari nama rumpunnya — server
   * yang memuai sendiri "semua Kepala Seksi" bisa menyentuh baris yang tidak pernah
   * dilihat penggunanya kalau master berubah sejak halaman dirender. Alasan yang
   * sama sudah ditulis di `tambahAnggotaSekaligus()`.
   */
  const idRumpun = (r: KelompokRumpun) => r.jenis.flatMap((g) => g.anggota.map((j) => j.id))

  function tambahSemuaRumpun(r: KelompokRumpun) {
    mulaiTransisi(async () => {
      const hasil = await tambahAnggotaSekaligus(jabatanTargetId, idRumpun(r))
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Ditambahkan.' }
          : { nada: 'bahaya', judul: 'Gagal menambahkan', keterangan: hasil.pesan },
      )
    })
  }

  function lepasSemuaRumpun(r: KelompokRumpun) {
    mulaiTransisi(async () => {
      const hasil = await hapusAnggotaSekaligus(jabatanTargetId, idRumpun(r))
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Dilepas.' }
          : { nada: 'bahaya', judul: 'Gagal melepas', keterangan: hasil.pesan },
      )
    })
  }

  function lepasSemua(g: KelompokJenis) {
    mulaiTransisi(async () => {
      const hasil = await hapusAnggotaSekaligus(
        jabatanTargetId,
        g.anggota.map((j) => j.id),
      )
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Dilepas.' }
          : { nada: 'bahaya', judul: 'Gagal melepas', keterangan: hasil.pesan },
      )
    })
  }

  function lepas(jabatan: JabatanAnggota) {
    mulaiTransisi(async () => {
      const hasil = await hapusAnggotaJabatan(jabatanTargetId, jabatan.id)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Dilepas.' }
          : { nada: 'bahaya', judul: 'Gagal melepas', keterangan: hasil.pesan },
      )
    })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <PanelHeader
            judul={`Jabatan asal kandidat (${formatAngka(anggota.length)})`}
            deskripsi="Jabatan yang pejabatnya boleh dinominasikan untuk kursi ini. Kandidat di luar daftar dinyatakan tidak lolos syarat. Daftar kosong = tidak menyaring."
          />
        </div>

        {anggota.length === 0 ? (
          <EmptyState
            className="m-3.5 border-0"
            judul="Belum ada jabatan asal kandidat"
            deskripsi="Selama kosong, SEMUA pegawai yang memenuhi persyaratan lain ikut jadi kandidat. Isi daftarnya untuk membatasi dari jabatan mana saja seseorang boleh dinominasikan."
            ikon={<Building2 className="size-5" />}
          />
        ) : (
          <>
            <div className="border-b border-border px-3.5 py-2.5">
              <KotakCari
                nilaiAwal={cariTerpasang}
                onCari={setCariTerpasang}
                placeholder="Cari di daftar ini — nama jabatan, kode, atau unit…"
                label="Cari jabatan asal kandidat yang sudah terpasang"
              />
              {cariTerpasang.trim() !== '' ? (
                <p className="mt-1.5 text-[11px] text-text-subtle">
                  {formatAngka(terpasangTersaring.length)} dari {formatAngka(anggota.length)} kursi
                  cocok
                </p>
              ) : null}
            </div>

            {terpasangTersaring.length === 0 ? (
              <p className="px-3.5 py-6 text-center text-[12px] leading-relaxed text-text-subtle">
                Tidak ada jabatan terpasang yang cocok dengan &quot;{cariTerpasang}&quot;.
              </p>
            ) : (
              <ul className={cn('divide-y divide-border', pending && 'opacity-60')}>
                {kelompokTerpasang.map((r) => {
                  const terbuka = dibukaTerpasang.has(r.kunci)
                  const kursi = jumlahKursi(r)
                  const satuJenis = r.jenis.length === 1
                  const tunggal = satuJenis && r.jenis[0]!.anggota.length === 1

                  return (
                    <li key={r.kunci} className="px-3.5 py-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] text-text">{r.rumpun}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-text-subtle">
                            {labelEselon(r)}
                            {' · '}
                            {tunggal
                              ? r.jenis[0]!.anggota[0]!.namaUnit
                              : satuJenis
                                ? `${formatAngka(kursi)} kursi di unit berbeda`
                                : `${formatAngka(kursi)} kursi · ${r.jenis.length} jenis jabatan`}
                          </p>
                          {tunggal ? null : (
                            <button
                              type="button"
                              onClick={() =>
                                setDibukaTerpasang((lama) => {
                                  const baru = new Set(lama)
                                  if (baru.has(r.kunci)) baru.delete(r.kunci)
                                  else baru.add(r.kunci)
                                  return baru
                                })
                              }
                              className="mt-1 text-[11px] text-accent underline-offset-2 hover:underline"
                            >
                              {terbuka ? '− Sembunyikan daftarnya' : '+ Lihat & lepas satu per satu'}
                            </button>
                          )}
                        </div>
                        {bolehUbah ? (
                          <Button
                            size="sm"
                            variant="halus"
                            onClick={() =>
                              tunggal ? lepas(r.jenis[0]!.anggota[0]!) : lepasSemuaRumpun(r)
                            }
                            pending={pending}
                            ikon={<Trash2 className="size-3.5" />}
                          >
                            {tunggal ? 'Lepas' : `Lepas semua (${formatAngka(kursi)})`}
                          </Button>
                        ) : null}
                      </div>

                      {terbuka ? (
                        <ul className="mt-2 space-y-2 border-l border-border pl-3">
                          {r.jenis.map((g) => (
                            <li key={g.kunci}>
                              {satuJenis ? null : (
                                <div className="flex items-start justify-between gap-3 py-0.5">
                                  <p className="text-[12px] font-medium text-text">
                                    {g.jenis}
                                    <span className="ml-1.5 font-normal text-text-subtle">
                                      {g.eselon} · {formatAngka(g.anggota.length)} kursi
                                    </span>
                                  </p>
                                  {bolehUbah && g.anggota.length > 1 ? (
                                    <Button
                                      size="sm"
                                      variant="halus"
                                      onClick={() => lepasSemua(g)}
                                      pending={pending}
                                      ikon={<Trash2 className="size-3.5" />}
                                    >
                                      Lepas semua ({formatAngka(g.anggota.length)})
                                    </Button>
                                  ) : null}
                                </div>
                              )}
                              <ul className={satuJenis ? 'space-y-1' : 'mt-1 space-y-1 pl-2'}>
                                {g.anggota.map((j) => (
                                  <li
                                    key={j.id}
                                    className="flex items-start justify-between gap-3 py-0.5"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-[12px] text-text-muted">{j.namaUnit}</p>
                                      <p className="text-[10px] leading-relaxed text-text-subtle">
                                        {j.statusJabatan === 'KOSONG'
                                          ? 'kursi kosong'
                                          : `${formatAngka(j.jumlahPenghuni)} penghuni`}
                                        {j.targetLain ? ` · kursinya jadi jabatan target` : ''}
                                      </p>
                                    </div>
                                    {bolehUbah ? (
                                      <Button
                                        size="ikon"
                                        variant="halus"
                                        onClick={() => lepas(j)}
                                        pending={pending}
                                        aria-label={`Lepas ${j.namaJabatan} — ${j.namaUnit}`}
                                        title="Lepas dari daftar jabatan asal kandidat"
                                      >
                                        <Trash2 className="size-3.5" />
                                      </Button>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </Panel>

      <Panel padat>
        <div className="space-y-2.5 border-b border-border px-3.5 py-3">
          <PanelHeader
            judul="Tambah jabatan"
            deskripsi={
              (semuaJenjang
                ? 'Menampilkan SELURUH jenjang. '
                : // Kalimatnya harus menyebut aturan yang BERLAKU. Sampai 1 Sep 2026
                  // ia berbunyi "sejenjang" — benar ketika saringannya menuntut eselon
                  // PERSIS sama, dan diam-diam salah sejak dilonggarkan jadi
                  // arahnya (2 Sep 2026: setingkat atau di BAWAH kursi — lihat cariJabatanUntukTarget).
                  // Keterangan yang menyebut aturan lama lebih buruk daripada tidak
                  // ada: pembacanya menyimpulkan daftarnya kurang, lalu mencari
                  // jabatan yang memang sengaja tidak ditawarkan.
                  'Hanya jabatan yang setingkat atau di bawah kursi yang dituju — dari sanalah kandidat naik. ') +
              `Dikelompokkan per rumpun jabatan — ${kelompok.length} rumpun, ${tersaring.length} kursi` +
              (rumpun === '' ? '. ' : ` dari ${tersedia.length}. `) +
              'Buka kelompoknya untuk memilih unit tertentu.'
            }
          />
          {/*
            Jalan kembali WAJIB ada, dan sengaja tidak disembunyikan: daftar yang
            disaring diam-diam akan dibaca sebagai daftar lengkap, lalu jabatan
            yang memang sengaja lintas jenjang tampak "tidak ada di master".
            Pola yang sama dengan `?semuaTarget=1` di panel Kecocokan.
          */}
          <button
            type="button"
            onClick={() => {
              const q = new URLSearchParams(searchParams.toString())
              if (semuaJenjang) q.delete('semuaJenjang')
              else q.set('semuaJenjang', '1')
              transisiCari(() => router.replace(`${pathname}?${q.toString()}`, { scroll: false }))
            }}
            className="text-[11px] text-accent underline-offset-2 hover:underline"
          >
            {semuaJenjang
              ? 'Batasi ke jenjang target ini'
              : 'Tampilkan semua jenjang (termasuk di luar jenjang target ini)'}
          </button>
          {opsiRumpun.length > 1 ? (
            <select
              value={rumpun}
              onChange={(e) => terapkanRumpun(e.target.value)}
              aria-label="Saring menurut rumpun jabatan"
              className="h-8 w-full rounded-md border border-border bg-surface px-2 text-[13px] text-text outline-none focus:border-accent"
            >
              <option value="">Semua rumpun jabatan ({tersedia.length} kursi)</option>
              {opsiRumpun.map((r) => (
                <option key={r.kunci} value={r.kunci}>
                  {r.label} ({r.jumlah})
                </option>
              ))}
            </select>
          ) : null}
          <KotakCari
            nilaiAwal={teks}
            onCari={(q: string) => {
              setTeks(q)
              terapkanCari(q)
            }}
            pending={mencari}
            placeholder="Cari nama jabatan, kode, atau unit…"
            label="Cari jabatan untuk ditambahkan"
          />
        </div>

        {tersaring.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[12px] leading-relaxed text-text-subtle">
            {cari === ''
              ? 'Semua jabatan sudah menjadi anggota jabatan target ini.'
              : `Tidak ada jabatan yang cocok dengan "${cari}" dan belum menjadi anggota.`}
            {rumpun === ''
              ? null
              : ' Daftar ini juga dibatasi satu rumpun jabatan — pilih "Semua rumpun jabatan" di atas.'}
            {semuaJenjang ? null : ' Daftar ini dibatasi ke jenjang target — coba "Tampilkan semua jenjang" di atas.'}
          </p>
        ) : (
          <ul className={cn('divide-y divide-border', pending && 'opacity-60')}>
            {kelompok.map((r) => {
              const terbuka = dibuka.has(r.kunci)
              const kursi = jumlahKursi(r)
              const satuJenis = r.jenis.length === 1
              const tunggal = satuJenis && r.jenis[0]!.anggota.length === 1

              return (
                <li key={r.kunci} className="px-3.5 py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] text-text">{r.rumpun}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-text-subtle">
                        {labelEselon(r)}
                        {' · '}
                        {tunggal
                          ? r.jenis[0]!.anggota[0]!.namaUnit
                          : satuJenis
                            ? `${kursi} jabatan di unit berbeda`
                            : `${kursi} kursi · ${r.jenis.length} jenis jabatan`}
                      </p>
                      {tunggal ? null : (
                        <button
                          type="button"
                          onClick={() =>
                            setDibuka((lama) => {
                              const baru = new Set(lama)
                              if (baru.has(r.kunci)) baru.delete(r.kunci)
                              else baru.add(r.kunci)
                              return baru
                            })
                          }
                          className="mt-1 text-[11px] text-accent underline-offset-2 hover:underline"
                        >
                          {terbuka ? '− Sembunyikan daftarnya' : '+ Lihat & pilih satu per satu'}
                        </button>
                      )}
                      {r.jumlahTerpakai > 0 ? (
                        <p className="mt-1 flex items-start gap-1 text-[10px] leading-relaxed text-warning">
                          <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                          {r.jumlahTerpakai === kursi
                            ? 'Semua kursinya sudah jadi jabatan target sendiri'
                            : `${r.jumlahTerpakai} di antaranya kursinya sudah jadi jabatan target sendiri`}
                        </p>
                      ) : null}
                    </div>
                    {bolehUbah ? (
                      <Button
                        size="sm"
                        variant="sekunder"
                        onClick={() =>
                          tunggal ? tambah(r.jenis[0]!.anggota[0]!) : tambahSemuaRumpun(r)
                        }
                        pending={pending}
                        ikon={<Plus className="size-3.5" />}
                      >
                        {tunggal ? 'Tambah' : `Tambah semua (${kursi})`}
                      </Button>
                    ) : null}
                  </div>

                  {terbuka ? (
                    <ul className="mt-2 space-y-2 border-l border-border pl-3">
                      {r.jenis.map((g) => (
                        <li key={g.kunci}>
                          {/*
                            Nama jabatan LENGKAP disebut di sini walau rumpunnya
                            sudah tertulis di atas: di dalam rumpun bercabang,
                            nama itulah yang membedakan kursinya, dan tanpa itu
                            baris-barisnya cuma daftar unit tanpa penjelasan
                            kursi mana yang dipilih.
                          */}
                          {satuJenis ? null : (
                            <div className="flex items-start justify-between gap-3 py-0.5">
                              <p className="text-[12px] font-medium text-text">
                                {g.jenis}
                                <span className="ml-1.5 font-normal text-text-subtle">
                                  {g.eselon} · {g.anggota.length} kursi
                                </span>
                              </p>
                              {bolehUbah && g.anggota.length > 1 ? (
                                <Button
                                  size="sm"
                                  variant="sekunder"
                                  onClick={() => tambahSemua(g)}
                                  pending={pending}
                                  ikon={<Plus className="size-3.5" />}
                                >
                                  Tambah semua ({g.anggota.length})
                                </Button>
                              ) : null}
                            </div>
                          )}
                          <ul className={satuJenis ? 'space-y-1' : 'mt-1 space-y-1 pl-2'}>
                            {g.anggota.map((j) => (
                              <li
                                key={j.id}
                                className="flex items-start justify-between gap-3 py-0.5"
                              >
                                <div className="min-w-0">
                                  <p className="text-[12px] text-text-muted">{j.namaUnit}</p>
                                  {j.targetLain ? (
                                    <p className="text-[10px] leading-relaxed text-warning">
                                      Kursinya jadi jabatan target: {j.targetLain}
                                    </p>
                                  ) : null}
                                </div>
                                {bolehUbah ? (
                                  <Button
                                    size="sm"
                                    variant="sekunder"
                                    onClick={() => tambah(j)}
                                    pending={pending}
                                    ikon={<Plus className="size-3.5" />}
                                  >
                                    Tambah
                                  </Button>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>
    </div>
  )
}
