'use client'

import { Building2, Plus, Search, Trash2, TriangleAlert } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { useToast } from '@/components/ui/toast'
import { hapusAnggotaJabatan, tambahAnggotaJabatan } from '@/lib/aksi/jabatan-target'
import { cn } from '@/lib/cn'
import { formatAngka } from '@/lib/format'
import type { JabatanAnggota } from '@/lib/kueri/rubrik'

/**
 * Tab 1 — Jabatan Anggota: jabatan definitif mana yang termasuk target ini.
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
  bolehUbah,
}: {
  jabatanTargetId: number
  anggota: JabatanAnggota[]
  tersedia: JabatanAnggota[]
  cari: string
  bolehUbah: boolean
}) {
  const { tampilkan } = useToast()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()
  const [mencari, transisiCari] = useTransition()

  const [teks, setTeks] = useState(cari)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Kalau URL berubah dari luar (tombol back), field ikut disesuaikan.
  const [cariTerakhir, setCariTerakhir] = useState(cari)
  if (cari !== cariTerakhir) {
    setCariTerakhir(cari)
    setTeks(cari)
  }

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  function terapkanCari(nilai: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'anggota')
    if (nilai.trim() === '') params.delete('cariJabatan')
    else params.set('cariJabatan', nilai)
    transisiCari(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  function onCariBerubah(nilai: string) {
    setTeks(nilai)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => terapkanCari(nilai), 300)
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
            judul={`Jabatan anggota (${formatAngka(anggota.length)})`}
            deskripsi="Posisi yang dituju oleh jabatan target ini. Satu jabatan boleh menjadi anggota beberapa jabatan target."
          />
        </div>

        {anggota.length === 0 ? (
          <EmptyState
            className="m-3.5 border-0"
            judul="Belum ada jabatan anggota"
            deskripsi="Selama kosong, jabatan target ini tidak menunjuk posisi mana pun — dan rubriknya tidak bisa diaktifkan."
            ikon={<Building2 className="size-5" />}
          />
        ) : (
          <ul className={cn('divide-y divide-border', pending && 'opacity-60')}>
            {anggota.map((j) => (
              <li key={j.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] font-medium text-text">{j.namaJabatan}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-text-subtle">
                    {j.namaUnit}
                    {j.eselon ? ` · Eselon ${j.eselon}` : ''}
                    {j.jenjang ? ` · ${j.jenjang}` : ''}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {j.statusJabatan === 'KOSONG' ? (
                      <Badge tone="peringatan">kosong</Badge>
                    ) : (
                      <Badge tone="netral">{formatAngka(j.jumlahPenghuni)} penghuni</Badge>
                    )}
                    {j.targetLain ? (
                      <span
                        className="text-[10px] text-text-subtle"
                        title={`Juga anggota: ${j.targetLain}`}
                      >
                        juga di target lain
                      </span>
                    ) : null}
                  </div>
                </div>
                {bolehUbah ? (
                  <Button
                    size="ikon"
                    variant="halus"
                    onClick={() => lepas(j)}
                    pending={pending}
                    aria-label={`Lepas ${j.namaJabatan}`}
                    title="Lepas dari jabatan target ini"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel padat>
        <div className="space-y-2.5 border-b border-border px-3.5 py-3">
          <PanelHeader
            judul="Tambah jabatan"
            deskripsi="Daftar dibatasi 20 hasil teratas — gunakan pencarian untuk mempersempit."
          />
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-subtle" />
            <input
              value={teks}
              onChange={(e) => onCariBerubah(e.target.value)}
              placeholder="Cari nama jabatan, kode, atau unit…"
              aria-label="Cari jabatan untuk ditambahkan"
              className="h-8 w-full rounded-md border border-border bg-surface pr-16 pl-8 text-[13px] text-text outline-none focus:border-accent"
            />
            {mencari ? (
              <span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-text-subtle">
                mencari…
              </span>
            ) : null}
          </div>
        </div>

        {tersedia.length === 0 ? (
          <p className="px-3.5 py-6 text-center text-[12px] leading-relaxed text-text-subtle">
            {cari === ''
              ? 'Semua jabatan sudah menjadi anggota jabatan target ini.'
              : `Tidak ada jabatan yang cocok dengan "${cari}" dan belum menjadi anggota.`}
          </p>
        ) : (
          <ul className={cn('divide-y divide-border', pending && 'opacity-60')}>
            {tersedia.map((j) => (
              <li key={j.id} className="flex items-start justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="text-[13px] text-text">{j.namaJabatan}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-text-subtle">
                    {j.namaUnit}
                    {j.eselon ? ` · Eselon ${j.eselon}` : ''}
                  </p>
                  {j.targetLain ? (
                    <p className="mt-1 flex items-start gap-1 text-[10px] leading-relaxed text-warning">
                      <TriangleAlert className="mt-0.5 size-3 shrink-0" />
                      Sudah jadi anggota: {j.targetLain}
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
        )}
      </Panel>
    </div>
  )
}
