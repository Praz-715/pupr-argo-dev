'use client'

import { RotateCcw } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { KotakCari } from '@/components/ui/kotak-cari'
import { Pilih } from '@/components/ui/pilih'
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


const LABEL_ESELON: Record<string, string> = {
  I: 'Eselon I',
  II: 'Eselon II',
  III: 'Eselon III',
  IV: 'Eselon IV',
  NON_ESELON: 'Non-eselon (fungsional)',
}

/**
 * Kelas yang membuat dropdown penyaring **menyusut & berbagi lebar sisa** di
 * layar lebar, supaya keenamnya + kotak pencarian + tombol Reset muat dalam
 * SATU baris (permintaan user, 12 Agu 2026 — sebelumnya "Semua status" turun ke
 * baris kedua).
 *
 * Kenapa perlu `xl:shrink`: `Pilih` memasang `shrink-0` pada dirinya, jadi lebar
 * tetapnya tidak bisa ditawar. Totalnya 60rem untuk enam dropdown, dan itu
 * melewati ruang yang tersisa setelah sidebar 240px — jadi barisnya membungkus
 * bukan karena salah tata letak, melainkan karena tidak ada yang boleh mengecil.
 * Varian `xl:` menang karena media query-nya lahir belakangan di CSS.
 *
 * Di bawah `xl` sengaja dibiarkan MEMBUNGKUS: memaksa satu baris di layar sempit
 * membuat keenam dropdown menyusut sampai labelnya tidak terbaca.
 */
const LEBAR_RINGKAS = 'xl:w-auto xl:min-w-0 xl:flex-1 xl:shrink'

export function FilterDirektori({ opsi, total }: { opsi: OpsiFilter; total: number }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  const cariAwal = searchParams.get('cari') ?? ''

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

  const filterAktif = ['cari', 'unit', 'eselon', 'jenjang', 'pendidikan', 'kotak', 'statusAsesmen']
    .filter((k) => searchParams.get(k))

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 xl:flex-nowrap">
        {/* Pencarian — dijalankan saat Enter, bukan per huruf (2 Sep 2026). */}
        <KotakCari
          nilaiAwal={cariAwal}
          onCari={(q: string) => terapkan({ cari: q })}
          placeholder="Cari nama atau NIP…"
          label="Cari nama atau NIP"
          pending={pending}
          className="min-w-56 flex-1 xl:min-w-44"
        />

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
          lebar={`w-52 ${LEBAR_RINGKAS}`}
        />

        {/*
          Rumpun jabatan (`Detail Revisi PUPR 1_9_2026.pdf`, butir 4) — penyaring
          KASAR: satu pilihan "Kepala Balai" menjaring seluruh kepala balai, apa
          pun nama balainya. Ia sengaja duduk SEBELUM Eselon: rumpun adalah
          pertanyaan "jabatan apa", dan itu yang orang tanyakan lebih dulu.

          Bawaannya "Semua rumpun" — tidak menyaring apa pun.
        */}
        <Pilih
          label="Rumpun jabatan"
          nilai={searchParams.get('rumpun') ?? ''}
          onUbah={(v) => terapkan({ rumpun: v })}
          opsi={[
            { nilai: '', label: 'Semua rumpun jabatan' },
            ...opsi.rumpun.map((r) => ({
              nilai: r.kunci,
              label: `${r.label} (${r.jumlahPegawai})`,
            })),
          ]}
          lebar={`w-52 ${LEBAR_RINGKAS}`}
        />

        <Pilih
          label="Eselon"
          nilai={searchParams.get('eselon') ?? ''}
          onUbah={(v) => terapkan({ eselon: v })}
          opsi={[
            { nilai: '', label: 'Semua eselon' },
            ...opsi.eselon.map((e) => ({ nilai: e, label: LABEL_ESELON[e] ?? e })),
          ]}
          lebar={`w-36 ${LEBAR_RINGKAS}`}
        />

        <Pilih
          label="Jenjang"
          nilai={searchParams.get('jenjang') ?? ''}
          onUbah={(v) => terapkan({ jenjang: v })}
          opsi={[
            { nilai: '', label: 'Semua jenjang' },
            ...opsi.jenjang.map((j) => ({ nilai: j, label: j })),
          ]}
          lebar={`w-40 ${LEBAR_RINGKAS}`}
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
          lebar={`w-36 ${LEBAR_RINGKAS}`}
        />

        <Pilih
          label="Kotak 9"
          nilai={searchParams.get('kotak') ?? ''}
          onUbah={(v) => terapkan({ kotak: v })}
          opsi={[
            { nilai: '', label: 'Semua kotak' },
            ...opsi.kotak9.map((k) => ({ nilai: String(k), label: `Kotak ${k}` })),
          ]}
          lebar={`w-36 ${LEBAR_RINGKAS}`}
        />

        <Pilih
          label="Status asesmen"
          nilai={searchParams.get('statusAsesmen') ?? ''}
          onUbah={(v) => terapkan({ statusAsesmen: v })}
          // Diturunkan dari data, bukan daftar tetap keempat status: di bawah
          // filter populasi tidak ada yang Draft maupun belum diases, jadi dua
          // opsi itu pasti menjawab nol baris.
          opsi={[
            { nilai: '', label: 'Semua status' },
            ...opsi.statusAsesmen.map((s) => ({
              nilai: s,
              label:
                s === 'Expired'
                  ? 'Kedaluwarsa'
                  : s === 'TANPA_ASESMEN'
                    ? 'Belum diases'
                    : s,
            })),
          ]}
          lebar={`w-40 ${LEBAR_RINGKAS}`}
        />

        {filterAktif.length > 0 ? (
          <Button
            size="sm"
            variant="halus"
            /*
              Kotak pencariannya ikut kosong dengan sendirinya: `KotakCari`
              menyesuaikan isinya ketika `nilaiAwal` (dari URL) berubah, dan Reset
              membuang seluruh param. Sebelum kotaknya diangkat jadi komponen, di
              sini harus ada `setCari('')` yang mudah tertinggal saat ada penyaring
              baru ditambahkan.
            */
            onClick={() => mulaiTransisi(() => router.push(pathname, { scroll: false }))}
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
