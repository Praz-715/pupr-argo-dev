'use client'

import { RotateCcw, Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Pilih } from '@/components/ui/pilih'
import { Spinner } from '@/components/ui/spinner'
import { formatAngka, formatTingkatPendidikan } from '@/lib/format'
import type { OpsiFilter } from '@/lib/kueri/pegawai'

/**
 * Filter Direktori Pegawai — seluruh state ada di URL (phase.md §5.7), sehingga
 * hasil pencarian bisa di-bookmark dan dikirim ke pimpinan lewat pesan, serta
 * tombol back browser bekerja seperti yang diharapkan.
 *
 * Pencarian di-debounce 300ms dan menampilkan indikator di dalam field; saat
 * memuat, tabel di bawahnya tetap menampilkan data lama dalam keadaan redup
 * (ditangani DataTable) — bukan kembali ke skeleton.
 */

const KOTAK_9 = [9, 8, 7, 6, 5, 4, 3, 2, 1]

const LABEL_ESELON: Record<string, string> = {
  I: 'Eselon I',
  II: 'Eselon II',
  III: 'Eselon III',
  IV: 'Eselon IV',
  NON_ESELON: 'Non-eselon (fungsional)',
}

export function FilterDirektori({ opsi, total }: { opsi: OpsiFilter; total: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  const cariAwal = searchParams.get('cari') ?? ''
  const [cari, setCari] = useState(cariAwal)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Kalau URL berubah dari luar (tombol back, klik sel Kotak 9 di dashboard),
  // field pencarian ikut disesuaikan.
  const [cariUrlTerakhir, setCariUrlTerakhir] = useState(cariAwal)
  if (cariAwal !== cariUrlTerakhir) {
    setCariUrlTerakhir(cariAwal)
    setCari(cariAwal)
  }

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  function terapkan(perubahan: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(perubahan)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    // Setiap perubahan filter mengembalikan ke halaman 1 — kalau tidak, pengguna
    // mendarat di halaman kosong karena hasil barunya lebih sedikit.
    params.delete('hal')
    mulaiTransisi(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function onCariBerubah(nilai: string) {
    setCari(nilai)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => terapkan({ cari: nilai }), 300)
  }

  const filterAktif = ['cari', 'unit', 'eselon', 'jenjang', 'pendidikan', 'kotak', 'statusAsesmen']
    .filter((k) => searchParams.get(k))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {/* Pencarian */}
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-text-subtle" />
          <input
            value={cari}
            onChange={(e) => onCariBerubah(e.target.value)}
            placeholder="Cari nama atau NIP…"
            aria-label="Cari nama atau NIP"
            className="h-8 w-full rounded-md border border-border bg-surface pr-16 pl-8 text-[13px] text-text outline-none placeholder:text-text-subtle focus:border-accent"
          />
          {pending ? (
            <span className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-1 text-[10px] text-text-subtle">
              <Spinner className="size-3" />
              mencari
            </span>
          ) : null}
        </div>

        <Pilih
          label="Unit organisasi"
          nilai={searchParams.get('unit') ?? ''}
          onUbah={(v) => terapkan({ unit: v })}
          opsi={[
            { nilai: '', label: 'Semua unit' },
            ...opsi.unit.map((u) => ({
              nilai: String(u.id),
              // Indentasi mencerminkan hierarki unit (3 level)
              label: `${'  '.repeat(u.level)}${u.nama}`,
            })),
          ]}
          lebar="w-52"
        />

        <Pilih
          label="Eselon"
          nilai={searchParams.get('eselon') ?? ''}
          onUbah={(v) => terapkan({ eselon: v })}
          opsi={[
            { nilai: '', label: 'Semua eselon' },
            ...opsi.eselon.map((e) => ({ nilai: e, label: LABEL_ESELON[e] ?? e })),
          ]}
        />

        <Pilih
          label="Jenjang"
          nilai={searchParams.get('jenjang') ?? ''}
          onUbah={(v) => terapkan({ jenjang: v })}
          opsi={[
            { nilai: '', label: 'Semua jenjang' },
            ...opsi.jenjang.map((j) => ({ nilai: j, label: j })),
          ]}
          lebar="w-40"
        />

        <Pilih
          label="Pendidikan"
          nilai={searchParams.get('pendidikan') ?? ''}
          onUbah={(v) => terapkan({ pendidikan: v })}
          opsi={[
            { nilai: '', label: 'Semua pendidikan' },
            ...opsi.tingkatPendidikan.map((p) => ({
              nilai: p,
              label: formatTingkatPendidikan(p),
            })),
          ]}
        />

        <Pilih
          label="Kotak 9"
          nilai={searchParams.get('kotak') ?? ''}
          onUbah={(v) => terapkan({ kotak: v })}
          opsi={[
            { nilai: '', label: 'Semua kotak' },
            ...KOTAK_9.map((k) => ({ nilai: String(k), label: `Kotak ${k}` })),
          ]}
        />

        <Pilih
          label="Status asesmen"
          nilai={searchParams.get('statusAsesmen') ?? ''}
          onUbah={(v) => terapkan({ statusAsesmen: v })}
          opsi={[
            { nilai: '', label: 'Semua status' },
            { nilai: 'Berlaku', label: 'Berlaku' },
            { nilai: 'Expired', label: 'Kedaluwarsa' },
            { nilai: 'Draft', label: 'Draft' },
            { nilai: 'TANPA_ASESMEN', label: 'Belum diases' },
          ]}
          lebar="w-40"
        />

        {filterAktif.length > 0 ? (
          <Button
            size="sm"
            variant="halus"
            onClick={() => {
              setCari('')
              mulaiTransisi(() => router.push(pathname, { scroll: false }))
            }}
            ikon={<RotateCcw className="size-3.5" />}
          >
            Reset
          </Button>
        ) : null}
      </div>

      <p className="text-[11px] text-text-subtle">
        {filterAktif.length === 0 ? (
          <>Menampilkan seluruh {formatAngka(total)} pegawai.</>
        ) : (
          <>
            {formatAngka(total)} pegawai cocok dengan {filterAktif.length} filter aktif.
          </>
        )}{' '}
        Klik judul kolom untuk mengurutkan. Seluruh filter tersimpan di alamat halaman, jadi
        tautannya bisa dibagikan.
      </p>
    </div>
  )
}
