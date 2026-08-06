'use client'

import { RotateCcw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Pilih } from '@/components/ui/pilih'
import { Spinner } from '@/components/ui/spinner'
import { formatAngka } from '@/lib/format'
import type { OpsiPeta } from '@/lib/kueri/peta-talenta'

const LABEL_ESELON: Record<string, string> = {
  I: 'Eselon I',
  II: 'Eselon II',
  III: 'Eselon III',
  IV: 'Eselon IV',
  NON_ESELON: 'Non-eselon (fungsional)',
}

/**
 * Filter Peta Talenta — seluruh state di URL (phase.md §5.7).
 *
 * Mengubah filter **menghapus `?kotak=`**: drill-down sel 7 dari data seluruh
 * organisasi tidak berlaku lagi begitu filternya dipersempit ke satu unit, dan
 * membiarkannya akan menampilkan daftar yang tidak cocok dengan grid di atasnya.
 */
export function FilterPeta({
  opsi,
  totalDinilai,
  tanpaAsesmen,
}: {
  opsi: OpsiPeta
  totalDinilai: number
  tanpaAsesmen: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  function terapkan(perubahan: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(perubahan)) {
      if (v === null || v === '') params.delete(k)
      else params.set(k, v)
    }
    params.delete('kotak')
    params.delete('hal')
    mulaiTransisi(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }))
  }

  const kunciFilter = ['unit', 'eselon', 'jenjang', 'tahun', 'berlaku']
  const filterAktif = kunciFilter.filter((k) => searchParams.get(k))

  // Checkbox ditampilkan optimistis: kalau nilainya dibaca langsung dari URL,
  // kotaknya baru tercentang setelah server menjawab — klik terasa mati padahal
  // permintaannya sedang jalan (phase.md §5.2). `<select>` tidak butuh ini karena
  // browser sudah menampilkan pilihan barunya sendiri.
  const berlakuUrl = searchParams.get('berlaku') === '1'
  const [hanyaBerlaku, setHanyaBerlaku] = useState(berlakuUrl)
  const [berlakuUrlTerakhir, setBerlakuUrlTerakhir] = useState(berlakuUrl)
  if (berlakuUrl !== berlakuUrlTerakhir) {
    setBerlakuUrlTerakhir(berlakuUrl)
    setHanyaBerlaku(berlakuUrl)
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pilih
          label="Unit organisasi"
          nilai={searchParams.get('unit') ?? ''}
          onUbah={(v) => terapkan({ unit: v })}
          opsi={[
            { nilai: '', label: 'Semua unit' },
            ...opsi.unit.map((u) => ({
              nilai: String(u.id),
              label: `${'  '.repeat(u.level)}${u.nama}`,
            })),
          ]}
          lebar="w-56"
        />

        <Pilih
          label="Eselon"
          nilai={searchParams.get('eselon') ?? ''}
          onUbah={(v) => terapkan({ eselon: v })}
          opsi={[
            { nilai: '', label: 'Semua eselon' },
            ...opsi.eselon.map((e) => ({ nilai: e, label: LABEL_ESELON[e] ?? e })),
          ]}
          lebar="w-44"
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
          label="Tahun asesmen terbaru"
          nilai={searchParams.get('tahun') ?? ''}
          onUbah={(v) => terapkan({ tahun: v })}
          opsi={[
            { nilai: '', label: 'Semua tahun' },
            ...opsi.tahun.map((t) => ({ nilai: String(t), label: `Asesmen ${t}` })),
          ]}
          lebar="w-40"
        />

        <label className="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 text-[13px] text-text-muted transition-colors hover:border-border-strong has-checked:border-accent-border has-checked:bg-accent-subtle has-checked:text-text">
          <input
            type="checkbox"
            checked={hanyaBerlaku}
            onChange={(e) => {
              setHanyaBerlaku(e.target.checked)
              terapkan({ berlaku: e.target.checked ? '1' : null })
            }}
            className="size-3.5 accent-[var(--accent)]"
          />
          Hanya asesmen berlaku
        </label>

        {pending ? (
          <span className="flex items-center gap-1.5 text-[11px] text-text-subtle">
            <Spinner className="size-3" />
            memuat
          </span>
        ) : null}

        {filterAktif.length > 0 ? (
          <Button
            size="sm"
            variant="halus"
            onClick={() => {
              // Reset membersihkan FILTER, bukan mengganti dasar sumbu. `?target=`
              // sengaja dipertahankan: kalau ikut terhapus, pengguna terlempar
              // kembali ke sebaran organisasi tanpa memintanya, dan angka di grid
              // berubah karena alasan yang tidak ia lakukan.
              const params = new URLSearchParams()
              const target = searchParams.get('target')
              if (target !== null && target !== '') params.set('target', target)
              const qs = params.toString()
              mulaiTransisi(() =>
                router.push(qs === '' ? pathname : `${pathname}?${qs}`, { scroll: false }),
              )
            }}
            ikon={<RotateCcw className="size-3.5" />}
          >
            Reset
          </Button>
        ) : null}
      </div>

      <p className="text-[11px] leading-relaxed text-text-subtle">
        Peta ini memuat <span className="tabular">{formatAngka(totalDinilai)}</span> pegawai
        {filterAktif.length > 0 ? ` yang cocok dengan ${filterAktif.length} filter aktif` : ''}.
        {tanpaAsesmen > 0 ? (
          <>
            {' '}
            <span className="tabular">{formatAngka(tanpaAsesmen)}</span> pegawai aktif{' '}
            <strong className="font-medium text-text-muted">tidak masuk peta</strong> karena belum
            punya asesmen — mereka tidak bisa ditempatkan di Kotak 9 mana pun, jadi jangan dibaca
            sebagai &quot;nilainya rendah&quot;.
          </>
        ) : null}{' '}
        Filter tersimpan di alamat halaman, jadi tautannya bisa dibagikan.
      </p>
    </div>
  )
}
