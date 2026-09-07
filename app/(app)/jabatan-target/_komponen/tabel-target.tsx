'use client'

import { Copy, MoreHorizontal, Pencil, Play, Power, Trash2, Users } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState, useTransition } from 'react'
import { createPortal } from 'react-dom'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DialogKonfirmasi } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/ui/toast'
import {
  hapusJabatanTarget,
  ubahStatusJabatanTarget,
} from '@/lib/aksi/jabatan-target'
import { cn } from '@/lib/cn'
import { formatAngka, formatTanggalWaktu } from '@/lib/format'
import type { BarisJabatanTarget, StatusJabatanTarget } from '@/lib/kueri/rubrik'
import { FormTarget } from './form-target'

/**
 * Tabel jabatan target dengan aksi statusnya.
 *
 * Tabelnya ditulis langsung, bukan lewat `DataTable`: jumlah jabatan target
 * dihitung belasan (satu per jabatan strategis), jadi paginasi & pengurutan
 * server tidak diperlukan, sementara yang dibutuhkan justru satu baris ringkasan
 * kesiapan per entri — bentuk yang tidak muat di kolom generik.
 */
export function TabelTarget({
  baris,
  bolehUbah,
}: {
  baris: BarisJabatanTarget[]
  bolehUbah: boolean
}) {
  if (baris.length === 0) {
    return (
      <EmptyState
        className="m-3.5 border-0"
        judul="Belum ada jabatan target"
        deskripsi="Jabatan target adalah profil jabatan yang jadi sasaran suksesi. Tanpa itu, kandidat tidak bisa dinilai karena tidak ada rubrik yang membandingkannya."
        ikon={<Users className="size-5" />}
      />
    )
  }

  return (
    /*
      `relative` WAJIB di kontainer gulir ini, bukan hiasan.

      Header kolom aksi memuat span `sr-only`, dan `sr-only` itu
      `position: absolute`. Elemen absolut mencari containing block pada leluhur
      ber-`position` TERDEKAT — kalau di dalam kontainer gulir tidak ada satu
      pun, ia melompati kontainer itu dan memakai containing block awal,
      sehingga luberannya masuk ke `scrollWidth` HALAMAN alih-alih ke area gulir
      tabelnya sendiri.

      Terukur di `/jabatan-target` pada 768px: halaman menggulir horizontal 11px,
      dan satu-satunya elemen di tepi 779px itu span "Aksi" — bukan tabelnya,
      yang luberannya sudah tertampung benar. Gejalanya menyesatkan karena yang
      tampak bergeser adalah tabel, sementara penyebabnya elemen selebar 1px yang
      tidak terlihat sama sekali.
    */
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-[13px]">
        <thead className="bg-surface-2">
          <tr className="border-b border-border text-left text-[11px] tracking-wide text-text-subtle uppercase">
            <th className="px-3.5 py-2 font-medium">Jabatan target</th>
            <th className="px-3 py-2 font-medium">Unit organisasi</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 text-right font-medium">Jabatan asal</th>
            <th className="px-3 py-2 text-right font-medium">
              Rubrik
              <span className="mt-0.5 block text-[9px] font-normal normal-case">
                komponen · indikator
              </span>
            </th>
            <th className="px-3 py-2 text-right font-medium">
              Kandidat
              <span className="mt-0.5 block text-[9px] font-normal normal-case">
                lolos syarat / dinilai
              </span>
            </th>
            <th className="px-3 py-2 font-medium">Dihitung terakhir</th>
            <th className="px-3.5 py-2 font-medium">
              <span className="sr-only">Aksi</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {baris.map((b) => (
            <BarisTarget key={b.id} target={b} bolehUbah={bolehUbah} semua={baris} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

const TONE_STATUS: Record<StatusJabatanTarget, 'sukses' | 'peringatan' | 'netral'> = {
  AKTIF: 'sukses',
  DRAFT: 'peringatan',
  NONAKTIF: 'netral',
}

function BarisTarget({
  target,
  bolehUbah,
  semua,
}: {
  target: BarisJabatanTarget
  bolehUbah: boolean
  semua: BarisJabatanTarget[]
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [menu, setMenu] = useState(false)
  const [gayaMenu, setGayaMenu] = useState<{ top?: number; bottom?: number; right: number } | null>(null)
  const [formBuka, setFormBuka] = useState(false)
  const [konfirmasiHapus, setKonfirmasiHapus] = useState(false)

  /*
    Menu titik-tiga baris yang dekat DASAR tabel terpotong: `<div
    className="relative overflow-x-auto">` yang membungkus tabel memaksa
    `overflow-y` jadi `auto` juga (aturan CSS: overflow-x non-`visible`
    menyeret overflow-y ikut non-`visible`), dan tingginya dipatok isi tabel
    apa adanya — jadi menu `position: absolute` yang menjorok ke bawah baris
    terakhir kepotong di situ, tanpa gulir yang bisa memunculkannya lagi.

    Diperbaiki dengan PORTAL ke `document.body` + `position: fixed`, pola
    yang sama dengan `components/ui/dialog.tsx`: elemen `fixed` tidak
    diklip oleh overflow ancestor mana pun (selama tidak ada ancestor
    ber-`transform`/`opacity<1`/`filter` di antaranya), dan posisinya
    dihitung dari `getBoundingClientRect()` tombolnya saat menu dibuka —
    bukan lagi bergantung pada containing block yang bisa mengklipnya.
  */
  useEffect(() => {
    if (!menu) return
    const tutup = () => setMenu(false)
    // capture: true supaya gulir di DALAM `<main>` (bukan window) ikut tertangkap.
    window.addEventListener('scroll', tutup, true)
    window.addEventListener('resize', tutup)
    return () => {
      window.removeEventListener('scroll', tutup, true)
      window.removeEventListener('resize', tutup)
    }
  }, [menu])

  function bukaMenu(e: React.MouseEvent<HTMLButtonElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    // Perkiraan tinggi panel (4 item + keterangan + pemisah) — kalau ruang di
    // bawah tidak cukup, ditaruh DI ATAS tombol alih-alih terpotong bawah layar.
    const TINGGI_PERKIRAAN = 260
    const ataskan = window.innerHeight - r.bottom < TINGGI_PERKIRAAN && r.top > TINGGI_PERKIRAAN
    setGayaMenu(
      ataskan
        ? { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right }
        : { top: r.bottom + 4, right: window.innerWidth - r.right },
    )
    setMenu(true)
  }

  function ubahStatus(status: StatusJabatanTarget) {
    setMenu(false)
    mulaiTransisi(async () => {
      const hasil = await ubahStatusJabatanTarget(target.id, status)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Status diperbarui.' }
          : { nada: 'bahaya', judul: 'Tidak bisa diaktifkan', keterangan: hasil.pesan },
      )
    })
  }

  function hapus() {
    mulaiTransisi(async () => {
      const hasil = await hapusJabatanTarget(target.id)
      setKonfirmasiHapus(false)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Dihapus.' }
          : { nada: 'bahaya', judul: 'Gagal menghapus', keterangan: hasil.pesan },
      )
    })
  }

  const siap =
    // "Siap diaktifkan" sekarang bergantung KURSI-nya, bukan daftar jabatan asal —
    // daftar itu boleh kosong (= tidak menyaring) dan tetap layak aktif.
    target.jumlahUnit > 0 && target.jumlahKomponen > 0 && target.jumlahPersyaratan > 0

  return (
    <tr className={cn('border-b border-border last:border-b-0 hover:bg-surface-2', pending && 'opacity-60')}>
      <td className="px-3.5 py-2.5">
        <Link
          href={`/jabatan-target/${target.id}`}
          className="block font-medium text-text hover:text-accent"
        >
          {target.namaTarget}
        </Link>
        <span className="tabular mt-0.5 block text-[11px] text-text-subtle">
          {target.kodeTarget}
          {target.kataKunciRelevansi.length === 0 ? (
            <span className="ml-2 text-warning">tanpa kata kunci relevansi</span>
          ) : null}
        </span>
      </td>

      {/*
        Unit organisasi — permintaan pemilik proses 1 Sep 2026: *"di table itu
        kasih unornya jangan jabatannya doang"*. Sesudah nama jabatan
        digenerikkan, EMPAT baris "Kepala Balai Pelaksana Pemilihan Jasa
        Konstruksi" berbunyi identik dan yang membedakannya cuma kode target —
        pengenal internal yang tidak berarti apa-apa bagi pembacanya.

        Kolom SENDIRI, bukan ditempel ke nama jabatan seperti di dropdown: di
        `<select>` satu baris nama gabungan akan terpotong justru pada
        pembedanya, sementara di tabel kolom terpisah bisa diurutkan sendiri dan
        tidak memaksa nama jabatannya membungkus.
      */}
      <td className="px-3 py-2.5 text-[12px] text-text-muted">
        {target.namaUnit !== null ? (
          <span className="break-words">{target.namaUnit}</span>
        ) : target.jumlahUnit > 1 ? (
          <span title="Kursinya menunjuk lebih dari satu unit — tidak ada satu unit yang mewakilinya">
            {formatAngka(target.jumlahUnit)} unit
          </span>
        ) : (
          <span className="text-warning" title="Kursinya belum ditentukan, jadi target ini tidak menunjuk unit mana pun">
            belum ada
          </span>
        )}
      </td>

      <td className="px-3 py-2.5">
        <Badge tone={TONE_STATUS[target.status]}>{target.status}</Badge>
      </td>

      <td className="tabular px-3 py-2.5 text-right">
        {target.jumlahAnggota === 0 ? (
          <span className="text-warning" title="Daftar jabatan asal kosong — semua pegawai yang memenuhi syarat lain ikut jadi kandidat">
            0
          </span>
        ) : (
          formatAngka(target.jumlahAnggota)
        )}
      </td>

      <td className="tabular px-3 py-2.5 text-right text-text-muted">
        {target.jumlahKomponen === 0 ? (
          <span className="text-warning">belum ada</span>
        ) : (
          <>
            {formatAngka(target.jumlahKomponen)}
            <span className="text-text-subtle"> · {formatAngka(target.jumlahIndikator)}</span>
          </>
        )}
      </td>

      <td className="tabular px-3 py-2.5 text-right">
        {target.jumlahDinilai === 0 ? (
          <span className="text-text-subtle">—</span>
        ) : (
          <Link
            href={`/jabatan-target/${target.id}/kandidat`}
            className="text-text hover:text-accent"
          >
            {formatAngka(target.jumlahEligible)}
            <span className="text-text-subtle"> / {formatAngka(target.jumlahDinilai)}</span>
          </Link>
        )}
      </td>

      <td className="px-3 py-2.5 text-[11px] text-text-muted">
        {target.dihitungPada === null ? (
          <span className="text-warning">belum pernah</span>
        ) : (
          formatTanggalWaktu(target.dihitungPada)
        )}
      </td>

      <td className="px-3.5 py-2.5">
        {bolehUbah ? (
          <div className="flex justify-end">
            <Button
              size="ikon"
              variant="halus"
              onClick={(e) => (menu ? setMenu(false) : bukaMenu(e))}
              pending={pending}
              aria-expanded={menu}
              aria-label={`Aksi untuk ${target.namaTarget}`}
            >
              <MoreHorizontal className="size-4" />
            </Button>

            {menu && gayaMenu
              ? createPortal(
                  <>
                    <button
                      type="button"
                      aria-hidden
                      tabIndex={-1}
                      onClick={() => setMenu(false)}
                      className="fixed inset-0 z-20 cursor-default"
                    />
                    <div
                      style={gayaMenu}
                      className="fixed z-30 w-56 overflow-hidden rounded-lg border border-border bg-surface p-1 shadow-[var(--shadow-overlay)]"
                    >
                      <ItemMenu
                        ikon={<Pencil className="size-3.5" />}
                        onClick={() => {
                          setMenu(false)
                          setFormBuka(true)
                        }}
                      >
                        {/*
                          Label tidak lagi menyebut "kata kunci": form itu berhenti
                          menyuntingnya di Fase 11 no. 3, dan menu yang menjanjikan
                          kendali yang sudah tidak ada membuat orang mencarinya di
                          dialog lalu menyimpulkan dialognya rusak.
                        */}
                        Ubah profil
                      </ItemMenu>

                      {target.status !== 'AKTIF' ? (
                        <ItemMenu
                          ikon={<Play className="size-3.5" />}
                          onClick={() => ubahStatus('AKTIF')}
                          keterangan={
                            siap
                              ? 'Rubrik diperiksa dulu sebelum aktif'
                              : 'Belum lengkap — akan ditolak beserta alasannya'
                          }
                        >
                          Aktifkan
                        </ItemMenu>
                      ) : (
                        <ItemMenu
                          ikon={<Power className="size-3.5" />}
                          onClick={() => ubahStatus('NONAKTIF')}
                          keterangan="Skor & talent pool tetap tersimpan"
                        >
                          Nonaktifkan
                        </ItemMenu>
                      )}

                      <ItemMenu
                        ikon={<Copy className="size-3.5" />}
                        href={`/jabatan-target/${target.id}?tab=rubrik`}
                        onClick={() => setMenu(false)}
                        keterangan={
                          target.jumlahKomponen > 0
                            ? 'Rubrik sudah ada — duplikasi hanya untuk rubrik kosong'
                            : `Salin dari ${semua.filter((s) => s.id !== target.id && s.jumlahKomponen > 0).length} rubrik lain`
                        }
                      >
                        Duplikasi rubrik
                      </ItemMenu>

                      <div className="my-1 border-t border-border" />

                      <ItemMenu
                        ikon={<Trash2 className="size-3.5" />}
                        destruktif
                        onClick={() => {
                          setMenu(false)
                          setKonfirmasiHapus(true)
                        }}
                      >
                        Hapus
                      </ItemMenu>
                    </div>
                  </>,
                  document.body,
                )
              : null}
          </div>
        ) : null}

        {formBuka ? (
          <FormTarget target={target} onTutup={() => setFormBuka(false)} />
        ) : null}

        <DialogKonfirmasi
          buka={konfirmasiHapus}
          onTutup={() => setKonfirmasiHapus(false)}
          onKonfirmasi={hapus}
          pending={pending}
          destruktif
          judul={`Hapus "${target.namaTarget}"?`}
          deskripsi={
            target.jumlahPool > 0
              ? `Jabatan target ini punya ${target.jumlahPool} entri talent pool, jadi ia akan DINONAKTIFKAN, bukan dihapus — menghapusnya ikut menghapus riwayat nominasi & persetujuannya.`
              : `${target.jumlahDinilai} baris skor dan seluruh rubriknya akan hilang. Belum ada entri talent pool yang menunjuk ke sini.`
          }
          labelKonfirmasi={target.jumlahPool > 0 ? 'Nonaktifkan' : 'Hapus'}
          labelPending="Memproses…"
        />
      </td>
    </tr>
  )
}

function ItemMenu({
  ikon,
  children,
  keterangan,
  onClick,
  href,
  destruktif,
}: {
  ikon: React.ReactNode
  children: React.ReactNode
  keterangan?: string
  onClick?: () => void
  href?: string
  destruktif?: boolean
}) {
  const kelas = cn(
    'flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-[12px] transition-colors',
    destruktif ? 'text-danger hover:bg-danger-subtle' : 'text-text-muted hover:bg-surface-3 hover:text-text',
  )

  const isi = (
    <>
      <span className="mt-0.5 shrink-0">{ikon}</span>
      <span className="min-w-0">
        <span className="block">{children}</span>
        {keterangan ? (
          <span className="mt-0.5 block text-[10px] leading-relaxed text-text-subtle">
            {keterangan}
          </span>
        ) : null}
      </span>
    </>
  )

  if (href !== undefined) {
    return (
      <Link href={href} onClick={onClick} className={kelas}>
        {isi}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} className={kelas}>
      {isi}
    </button>
  )
}
