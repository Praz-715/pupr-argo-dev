'use client'

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Columns3 } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'

import { cn } from '@/lib/cn'
import { formatAngka } from '@/lib/format'
import { useLocalStorageBoolean } from '@/lib/hooks'
import { arahBawaanUrut, type ArahUrut } from '@/lib/urut'
import { Button } from './button'

/**
 * Tabel data padat dengan pengurutan, paginasi, dan pemilihan kolom —
 * **seluruhnya digerakkan server lewat query string**.
 *
 * Kenapa bukan TanScape/TanStack Table seperti rencana awal (phase.md §5):
 * TanStack unggul untuk sorting/filtering/paginasi DI KLIEN. Di sini semuanya
 * dikerjakan SQL karena produksi punya 1.872 pegawai (phase.md §3 K-5), sehingga
 * yang tersisa dari TanStack hanya definisi kolom — lapisan tambahan tanpa
 * manfaat. Komponen ini menuliskannya langsung: lebih sedikit kode, lebih
 * sedikit dependensi, dan alurnya sejalan dengan URL sebagai sumber state.
 *
 * Perilaku yang dijaga (phase.md §5.3 & §5.7):
 *   - Saat mengubah urutan/halaman, data lama TETAP TAMPIL dalam keadaan redup
 *     + progress bar; tidak kembali ke skeleton (kedipan kosong terasa lebih
 *     lambat daripada aslinya).
 *   - Header tabel sticky; kolom identitas sticky saat menggulir horizontal.
 *   - Angka `tabular-nums` supaya kolom tidak bergoyang saat diurutkan.
 *   - Seluruh state ada di URL sehingga bisa di-bookmark & tombol back bekerja.
 */

export interface KolomTabel<T> {
  /** Kunci pengurutan yang dikirim ke server; juga dipakai sebagai id kolom. */
  kunci: string
  judul: string
  render: (baris: T) => ReactNode
  /** Keterangan kecil di bawah judul kolom (mis. satuan). */
  subjudul?: string
  rataKanan?: boolean
  bisaDiurutkan?: boolean
  /** Kolom identitas — menempel saat menggulir horizontal. */
  sticky?: boolean
  /** Tidak boleh disembunyikan (mis. kolom identitas). */
  wajib?: boolean
  /** Sembunyikan secara bawaan; pengguna bisa memunculkan. */
  tersembunyiBawaan?: boolean
  lebarMin?: string
}

export interface DataTableProps<T> {
  /** Id unik untuk menyimpan preferensi kolom per tabel. */
  id: string
  kolom: Array<KolomTabel<T>>
  /** Sembunyikan pemilih kolom — alasannya di tempat pemakaiannya di bawah. */
  tanpaPemilihKolom?: boolean
  baris: T[]
  kunciBaris: (baris: T) => string | number
  /** Tautan detail per baris — dipakai untuk prefetch saat hover. */
  tautanBaris?: (baris: T) => string
  total: number
  halaman: number
  ukuranHalaman: number
  /** Nama param URL, supaya dua tabel di satu halaman tidak bertabrakan. */
  paramHalaman?: string
  paramUrut?: string
  paramArah?: string
  kosong?: ReactNode
}

export function DataTable<T>({
  id,
  kolom,
  tanpaPemilihKolom,
  baris,
  kunciBaris,
  tautanBaris,
  total,
  halaman,
  ukuranHalaman,
  paramHalaman = 'hal',
  paramUrut = 'urut',
  paramArah = 'arah',
  kosong,
}: DataTableProps<T>) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  const urutAktif = searchParams.get(paramUrut)
  const arahParam = searchParams.get(paramArah)
  // Tanpa `?arah=` di URL, panah harus menunjukkan arah bawaan kolom yang
  // sedang aktif — kalau dipaksa 'desc', panah berbohong pada kunjungan pertama.
  // Arah bawaannya diambil dari `lib/urut.ts`, sumber yang sama dengan kueri.
  const arahAktif: ArahUrut =
    arahParam === 'asc' || arahParam === 'desc' ? arahParam : arahBawaanUrut(urutAktif)

  const [kolomTersembunyi, setKolomTersembunyi] = useState<Set<string>>(
    () => new Set(kolom.filter((k) => k.tersembunyiBawaan).map((k) => k.kunci)),
  )
  const kolomTampil = kolom.filter((k) => !kolomTersembunyi.has(k.kunci))

  function ubahParam(perubahan: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [k, v] of Object.entries(perubahan)) {
      if (v === null) params.delete(k)
      else params.set(k, v)
    }
    mulaiTransisi(() => {
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    })
  }

  function urutkan(kunci: string) {
    // Kolom baru → mulai dari arah bawaannya. Kolom yang sama → balik arah.
    const arahBaru =
      urutAktif === kunci ? (arahAktif === 'asc' ? 'desc' : 'asc') : arahBawaanUrut(kunci)
    // Mengubah urutan selalu kembali ke halaman 1 — kalau tidak, pengguna
    // mendarat di halaman 7 dari pengurutan yang berbeda dan bingung.
    ubahParam({ [paramUrut]: kunci, [paramArah]: arahBaru, [paramHalaman]: null })
  }

  const halamanTerakhir = Math.max(1, Math.ceil(total / ukuranHalaman))
  const dariBaris = total === 0 ? 0 : (halaman - 1) * ukuranHalaman + 1
  const sampaiBaris = Math.min(total, halaman * ukuranHalaman)

  if (total === 0 && kosong) {
    return <>{kosong}</>
  }

  return (
    <div className="overflow-hidden rounded-lg border border-border">
      {/* Bilah alat: ringkasan + pemilih kolom */}
      <div className="flex items-center justify-between gap-3 border-b border-border bg-surface-2 px-3 py-2">
        <p className="tabular text-[11px] text-text-subtle">
          Menampilkan {formatAngka(dariBaris)}–{formatAngka(sampaiBaris)} dari{' '}
          {formatAngka(total)} baris
        </p>
        {/* Bisa dimatikan per tabel. Di Direktori Pegawai ia dilepas atas
            permintaan user (12 Agu 2026): pemilih kolom duduk berdampingan
            dengan teks "Menampilkan 1–10 dari 10 baris", dan keduanya memajang
            pasangan angka berbentuk sama ("10/11" vs "1–10 dari 10") yang
            sebenarnya menghitung hal berbeda — kolom vs baris. Tabel lain
            (Kandidat, Master Jabatan, drill-down Peta Talenta) tetap
            memakainya. */}
        {tanpaPemilihKolom ? null : (
          <PemilihKolom
            id={id}
            kolom={kolom}
            tersembunyi={kolomTersembunyi}
            setTersembunyi={setKolomTersembunyi}
          />
        )}
      </div>

      {/* Progress tipis saat memuat urutan/halaman baru — data lama tetap tampil */}
      <div className="relative">
        {pending ? (
          <div
            aria-hidden
            className="absolute inset-x-0 top-0 z-20 h-0.5 overflow-hidden bg-accent-subtle"
          >
            <div className="h-full w-1/3 animate-[geser_1s_ease-in-out_infinite] bg-accent" />
          </div>
        ) : null}

        <div className={cn('overflow-x-auto transition-opacity', pending && 'opacity-55')}>
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-surface-2">
              <tr className="border-b border-border">
                {kolomTampil.map((k) => {
                  const aktif = urutAktif === k.kunci
                  return (
                    <th
                      key={k.kunci}
                      scope="col"
                      style={k.lebarMin ? { minWidth: k.lebarMin } : undefined}
                      className={cn(
                        'px-3 py-2 text-left text-[11px] font-medium tracking-wide text-text-subtle uppercase',
                        k.rataKanan && 'text-right',
                        k.sticky && 'sticky left-0 z-10 bg-surface-2',
                      )}
                    >
                      {k.bisaDiurutkan === false ? (
                        <span>{k.judul}</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => urutkan(k.kunci)}
                          disabled={pending}
                          className={cn(
                            'inline-flex items-center gap-1 transition-colors hover:text-text disabled:opacity-60',
                            k.rataKanan && 'flex-row-reverse',
                            aktif && 'text-text',
                          )}
                          title={`Urutkan menurut ${k.judul}`}
                        >
                          {k.judul}
                          {aktif ? (
                            arahAktif === 'desc' ? (
                              <ArrowDown className="size-3" />
                            ) : (
                              <ArrowUp className="size-3" />
                            )
                          ) : (
                            <ArrowUpDown className="size-3 opacity-40" />
                          )}
                        </button>
                      )}
                      {k.subjudul ? (
                        <span className="mt-0.5 block text-[9px] font-normal normal-case text-text-subtle">
                          {k.subjudul}
                        </span>
                      ) : null}
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {baris.map((b) => {
                const href = tautanBaris?.(b)
                return (
                  <tr
                    key={kunciBaris(b)}
                    className="group border-b border-border last:border-b-0 hover:bg-surface-2"
                  >
                    {kolomTampil.map((k, i) => (
                      <td
                        key={k.kunci}
                        className={cn(
                          'px-3 py-2 align-middle',
                          k.rataKanan && 'text-right',
                          k.sticky && 'sticky left-0 bg-surface group-hover:bg-surface-2',
                        )}
                      >
                        {/* Kolom pertama membawa tautan detail + prefetch on hover */}
                        {i === 0 && href ? (
                          <Link href={href} className="block hover:text-accent">
                            {k.render(b)}
                          </Link>
                        ) : (
                          k.render(b)
                        )}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paginasi */}
      {halamanTerakhir > 1 ? (
        <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-2 px-3 py-2">
          <Button
            size="sm"
            variant="sekunder"
            disabled={halaman <= 1}
            pending={false}
            onClick={() => ubahParam({ [paramHalaman]: String(halaman - 1) })}
            ikon={<ChevronLeft className="size-3.5" />}
          >
            Sebelumnya
          </Button>
          <p className="tabular text-[11px] text-text-subtle">
            Halaman {formatAngka(halaman)} dari {formatAngka(halamanTerakhir)}
          </p>
          <Button
            size="sm"
            variant="sekunder"
            disabled={halaman >= halamanTerakhir}
            pending={false}
            onClick={() => ubahParam({ [paramHalaman]: String(halaman + 1) })}
          >
            Berikutnya
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function PemilihKolom<T>({
  id,
  kolom,
  tersembunyi,
  setTersembunyi,
}: {
  id: string
  kolom: Array<KolomTabel<T>>
  tersembunyi: Set<string>
  setTersembunyi: (s: Set<string>) => void
}) {
  const [buka, setBuka] = useLocalStorageBoolean(`simt-kolom-buka-${id}`)
  const wadah = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!buka) return
    function onKlikLuar(e: MouseEvent) {
      if (wadah.current && !wadah.current.contains(e.target as Node)) setBuka(false)
    }
    document.addEventListener('mousedown', onKlikLuar)
    return () => document.removeEventListener('mousedown', onKlikLuar)
  }, [buka, setBuka])

  const bisaDiatur = kolom.filter((k) => !k.wajib)
  if (bisaDiatur.length === 0) return null

  return (
    <div ref={wadah} className="relative">
      <button
        type="button"
        onClick={() => setBuka(!buka)}
        aria-expanded={buka}
        className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface px-2 text-[11px] text-text-muted transition-colors hover:text-text"
      >
        <Columns3 className="size-3.5" />
        Kolom
        {tersembunyi.size > 0 ? (
          <span className="tabular rounded bg-surface-3 px-1 text-[10px]">
            {bisaDiatur.length - tersembunyi.size}/{bisaDiatur.length}
          </span>
        ) : null}
      </button>

      {buka ? (
        <div className="absolute right-0 z-30 mt-1 w-60 overflow-hidden rounded-lg border border-border bg-surface p-1.5 shadow-[var(--shadow-overlay)]">
          <p className="px-2 py-1 text-[10px] font-medium tracking-wide text-text-subtle uppercase">
            Tampilkan kolom
          </p>
          {bisaDiatur.map((k) => {
            const tampil = !tersembunyi.has(k.kunci)
            return (
              <label
                key={k.kunci}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] text-text-muted hover:bg-surface-3"
              >
                <input
                  type="checkbox"
                  checked={tampil}
                  onChange={() => {
                    const baru = new Set(tersembunyi)
                    if (tampil) baru.add(k.kunci)
                    else baru.delete(k.kunci)
                    setTersembunyi(baru)
                  }}
                  className="size-3.5 accent-[var(--accent)]"
                />
                <span className="min-w-0 flex-1 truncate">{k.judul}</span>
              </label>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
