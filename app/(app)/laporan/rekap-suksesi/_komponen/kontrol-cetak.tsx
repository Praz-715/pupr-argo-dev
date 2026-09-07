'use client'

import { Printer } from 'lucide-react'
import { Children, useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { cn } from '@/lib/cn'

/**
 * Kontrol cetak untuk Rekap Suksesi — pilih SEMUA jabatan target atau tertentu
 * saja (boleh lebih dari satu), lalu tombol Cetak yang sungguhan.
 *
 * Permintaan pemilik proses 2 Sep 2026: *"rapat suksesi jangan ctrl print, bikin
 * aja ui buat printnya, kasih opsi buat print semua jabatan target atau jabatan
 * target tertentu aja, bisa multi ya."* Sebelumnya halaman ini cuma mengandalkan
 * Ctrl/⌘+P peramban tanpa cara memilih SEBAGIAN — pimpinan yang hanya butuh
 * membawa 3 dari 13 jabatan target ke rapat harus mencetak semuanya lalu
 * menyortir kertasnya sendiri.
 *
 * ## Kenapa BLOKNYA tetap dirender semua, bukan dihapus dari DOM
 *
 * Menghapus blok yang tidak dipilih dari DOM berarti membangun ulang state
 * checkbox setiap kali dicentang/dilepas — dan untuk 13 jabatan target itu murah,
 * tapi alasan sebenarnya adalah **konsistensi**: layar tetap menampilkan seluruh
 * rekap (untuk dibaca/di-scroll biasa), dan yang berubah cuma APA YANG IKUT
 * TERCETAK. Dua kebutuhan yang berbeda — "saya ingin melihat semuanya sekarang"
 * vs "saya ingin membawa sebagian ke rapat" — tidak boleh saling menimpa.
 *
 * ## Kenapa `.tanpa-cetak`, bukan class baru
 *
 * `globals.css` sudah punya konvensi `display:none` KHUSUS `@media print` lewat
 * `.tanpa-cetak` — dipakai untuk toolbar & tombol yang memang tidak boleh pernah
 * tercetak. Efeknya PERSIS yang dibutuhkan di sini untuk blok yang tidak
 * dicentang: tersembunyi hanya saat mencetak, tetap terlihat di layar. Menambah
 * class CSS kedua untuk efek yang identik berarti dua aturan yang bisa berselisih
 * kalau salah satunya diubah nanti.
 *
 * ## `children` sebagai SLOT, bukan render prop
 *
 * `BlokTarget` tetap Server Component (ia membaca `formatSkor`, dsb — tidak perlu
 * jadi client). Diteruskan sebagai `children` dari `page.tsx` (Server Component)
 * ke sini; React mengizinkan itu karena Client Component tidak pernah RENDER
 * ULANG anak Server Component-nya, cuma memutuskan DI MANA ia dipasang. Urutan
 * `target` (metadata untuk checkbox) HARUS sama dengan urutan `children` — itulah
 * yang menghubungkan checkbox ke-i dengan bloknya.
 */
export function KontrolCetak({
  target,
  children,
}: {
  target: Array<{ id: number; kode: string; nama: string }>
  children: ReactNode
}) {
  const [mode, setMode] = useState<'semua' | 'tertentu'>('semua')
  const [dipilih, setDipilih] = useState<Set<number>>(() => new Set(target.map((t) => t.id)))

  const daftarAnak = Children.toArray(children)

  function alihkan(id: number) {
    setDipilih((lama) => {
      const baru = new Set(lama)
      if (baru.has(id)) baru.delete(id)
      else baru.add(id)
      return baru
    })
  }

  const jumlahTercetak = mode === 'semua' ? target.length : dipilih.size

  return (
    <>
      <Panel className="tanpa-cetak">
        <PanelHeader
          judul="Cetak"
          deskripsi="Pilih yang mau dibawa ke rapat. Halaman ini tetap menampilkan semuanya untuk dibaca — yang dipilih di sini hanya menentukan apa yang ikut tercetak."
        />
        <div className="mt-3 flex flex-wrap items-start gap-4">
          <div className="flex shrink-0 flex-col gap-1.5">
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text">
              <input
                type="radio"
                name="mode-cetak"
                checked={mode === 'semua'}
                onChange={() => setMode('semua')}
              />
              Semua jabatan target ({target.length})
            </label>
            <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text">
              <input
                type="radio"
                name="mode-cetak"
                checked={mode === 'tertentu'}
                onChange={() => setMode('tertentu')}
              />
              Jabatan target tertentu
            </label>
          </div>

          {mode === 'tertentu' ? (
            <div className="min-w-0 flex-1 rounded-md border border-border bg-surface-inset p-2.5">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <span className="text-[11px] text-text-subtle">
                  {dipilih.size} dari {target.length} dipilih
                </span>
                <span className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setDipilih(new Set(target.map((t) => t.id)))}
                    className="text-accent hover:underline"
                  >
                    Pilih semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setDipilih(new Set())}
                    className="text-accent hover:underline"
                  >
                    Kosongkan
                  </button>
                </span>
              </div>
              <ul className="max-h-48 space-y-1 overflow-y-auto">
                {target.map((t) => (
                  <li key={t.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-0.5 text-[12.5px] text-text hover:bg-surface-2">
                      <input
                        type="checkbox"
                        checked={dipilih.has(t.id)}
                        onChange={() => alihkan(t.id)}
                        className="mt-0.5"
                      />
                      <span>
                        {t.nama}
                        <span className="tabular ml-1.5 text-text-subtle">{t.kode}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <Button
              onClick={() => window.print()}
              disabled={jumlahTercetak === 0}
              ikon={<Printer className="size-3.5" />}
            >
              Cetak
            </Button>
            {jumlahTercetak === 0 ? (
              <Badge tone="peringatan">Pilih minimal satu jabatan target dulu</Badge>
            ) : (
              <span className="text-[11px] text-text-subtle">
                {jumlahTercetak} jabatan target akan tercetak
              </span>
            )}
          </div>
        </div>
      </Panel>

      {daftarAnak.map((anak, i) => {
        const t = target[i]
        const disembunyikan = t !== undefined && mode === 'tertentu' && !dipilih.has(t.id)
        return (
          <div key={t?.id ?? i} className={cn(disembunyikan && 'tanpa-cetak')}>
            {anak}
          </div>
        )
      })}
    </>
  )
}
