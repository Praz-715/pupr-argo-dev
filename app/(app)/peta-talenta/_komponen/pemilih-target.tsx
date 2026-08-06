'use client'

import { Info } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Pilih } from '@/components/ui/pilih'
import { Spinner } from '@/components/ui/spinner'
import { formatAngka } from '@/lib/format'
import type { OpsiJabatanTarget } from '@/lib/kueri/peta-talenta'

/**
 * Pemilih jabatan target (Fase 11, U-13).
 *
 * Sengaja **dipisah dari baris filter** dan diberi bingkainya sendiri. Filter
 * mempersempit populasi; pemilih ini mengubah **definisi sumbu X** — dari Potkom
 * apa adanya (e-Nominasi) menjadi komposit 65/20/15 milik jabatan itu (phase.md
 * §2.10). Menaruhnya di antara "Unit organisasi" dan "Eselon" akan membuatnya
 * terbaca sebagai "Kotak 9 dengan satu filter lagi", padahal 26% pegawai
 * berpindah kolom karenanya (K-7a).
 *
 * Angka `perluReview` & `belumDinilai` ikut ditampilkan di sini, bukan
 * disembunyikan di catatan kaki: selama antrian validasi riwayat belum
 * dikerjakan, Kualifikasi 20% tertahan rendah dan petanya tampak lebih buruk
 * dari kenyataan. Peta yang tampak buruk tanpa mengatakan sebabnya terbaca
 * sebagai penilaian atas orangnya.
 */
export function PemilihTarget({
  daftar,
  terpilih,
  belumDinilai,
}: {
  daftar: OpsiJabatanTarget[]
  terpilih: OpsiJabatanTarget | null
  belumDinilai: number
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, mulaiTransisi] = useTransition()

  function pilih(nilai: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (nilai === '') params.delete('target')
    else params.set('target', nilai)
    // Sel yang terbuka milik sumbu X yang lama — nomor kotaknya bisa berarti
    // orang yang berbeda setelah sumbunya berganti.
    params.delete('kotak')
    params.delete('hal')
    const qs = params.toString()
    mulaiTransisi(() => router.push(qs === '' ? pathname : `${pathname}?${qs}`, { scroll: false }))
  }

  const aktif = terpilih !== null

  return (
    <div
      className={`rounded-lg border p-3 transition-colors ${
        aktif ? 'border-accent-border bg-accent-subtle' : 'border-border'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Pilih
          label="Dasar sumbu Potensial"
          nilai={searchParams.get('target') ?? ''}
          onUbah={pilih}
          opsi={[
            { nilai: '', label: 'Sebaran organisasi — Potkom e-Nominasi' },
            ...daftar.map((t) => ({ nilai: String(t.id), label: `Kesiapan: ${t.nama}` })),
          ]}
          lebar="w-[26rem]"
        />
        {aktif ? <Badge tone="aksen">Kesiapan per jabatan</Badge> : <Badge>Organisasi</Badge>}
        {pending ? (
          <span className="flex items-center gap-1.5 text-[11px] text-text-subtle">
            <Spinner className="size-3" />
            memuat
          </span>
        ) : null}
      </div>

      <p className="mt-2 flex gap-1.5 text-[11px] leading-relaxed text-text-subtle">
        <Info className="mt-px size-3.5 shrink-0" />
        {aktif ? (
          <span>
            Sumbu Potensial memakai <strong className="font-medium text-text-muted">match score</strong>{' '}
            jabatan ini — 65% Potensi &amp; Kompetensi + 20% Kualifikasi Jabatan + 15% Integritas.
            Kualifikasi menilai pendidikan, bidang ilmu, diklat, dan pengalaman{' '}
            <em>terhadap jabatan ini</em>, jadi orang yang sama bisa menempati kotak berbeda untuk
            jabatan berbeda. Sumbu Kinerja tidak berubah.
          </span>
        ) : (
          <span>
            Sumbu Potensial memakai{' '}
            <strong className="font-medium text-text-muted">nilai Potkom apa adanya</strong> dari
            e-Nominasi — tidak terikat jabatan mana pun. Ini angka yang dipakai laporan sebaran
            talenta organisasi. Pilih satu jabatan target untuk melihat kesiapan terhadap jabatan
            itu.
          </span>
        )}
      </p>

      {aktif ? (
        <p className="mt-2 border-t border-accent-border pt-2 text-[11px] leading-relaxed text-text-subtle">
          <span className="tabular">{formatAngka(terpilih.dinilai)}</span> pegawai punya skor untuk
          jabatan ini.
          {terpilih.perluReview > 0 ? (
            <>
              {' '}
              <strong className="font-medium text-warning">
                <span className="tabular">{formatAngka(terpilih.perluReview)}</span> di antaranya
                memuat indikator yang belum diperiksa manusia
              </strong>{' '}
              — selama itu belum dikerjakan, Kualifikasi tertahan rendah dan posisi di peta ini{' '}
              <strong className="font-medium text-text-muted">
                lebih rendah dari yang sebenarnya
              </strong>
              .{' '}
              <Link href="/data/validasi-riwayat" className="text-accent hover:underline">
                Buka Validasi Riwayat Pegawai
              </Link>{' '}
              untuk mengerjakannya.
            </>
          ) : null}
          {belumDinilai > 0 ? (
            <>
              {' '}
              <span className="tabular">{formatAngka(belumDinilai)}</span> pegawai cocok dengan
              filter tapi <strong className="font-medium text-text-muted">belum dinilai</strong>{' '}
              untuk jabatan ini, jadi tidak ditempatkan di kotak mana pun — bukan berarti nilainya
              nol. Jalankan Hitung Ulang dari Editor Jabatan Target.
            </>
          ) : null}
          {terpilih.dinilai === 0 ? (
            <>
              {' '}
              Belum ada satu pun skor untuk jabatan target ini — jalankan{' '}
              <strong className="font-medium text-text-muted">Hitung Ulang</strong> dari Editor
              Jabatan Target lebih dulu.
            </>
          ) : null}
        </p>
      ) : null}
    </div>
  )
}
