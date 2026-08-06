'use client'

import { GraduationCap, Info } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { useToast } from '@/components/ui/toast'
import { simpanSyaratDiklat } from '@/lib/aksi/jabatan-target'
import type { OpsiSyaratDiklat } from '@/lib/kueri/rubrik'

/**
 * Syarat pelatihan jabatan target — bagian lembar 6 yang sebelumnya **hanya bisa
 * diubah lewat SQL** (Fase 11 no. 3 lanjutan, U-15).
 *
 * Tiga hal yang wajib dinyatakan di layar, karena semuanya tidak bisa ditebak
 * dari kontrolnya:
 *
 *  1. **Kosong ≠ gagal.** Jabatan target tanpa syarat pelatihan membuat indikator
 *     Pengembangan Kompetensi bernilai *tidak diketahui* dan ditandai
 *     `perlu_review` — bukan 50, bukan 0. Itu keadaan sah (Ka Balai BJKW memang
 *     tidak ada di lembar 6), jadi panel ini tidak boleh terlihat seperti
 *     kesalahan yang harus diisi buru-buru.
 *  2. **Rumpun tidak ditawarkan.** Menuntut "Pelatihan Teknis" tanpa menyebut
 *     teknis apa membuat syaratnya tidak bisa diperiksa. Dikelompokkan *menurut*
 *     rumpun, tapi yang bisa dicentang hanya turunannya.
 *  3. **Yang dihitung adalah "punya minimal satu yang cocok".** Indikatornya cuma
 *     punya dua kategori skor (punya → 100, tidak → 50), jadi menambah kategori
 *     ke-empat **melonggarkan** syarat, bukan mengetatkannya — kebalikan dari
 *     dugaan wajar. Kolom `wajib` di skema belum dipakai perhitungan, jadi tidak
 *     ada penanda wajib/opsional di sini: kontrol tanpa akibat lebih buruk
 *     daripada kontrol yang tidak ada.
 */
export function PanelSyaratDiklat({
  jabatanTargetId,
  opsi,
  bolehUbah,
}: {
  jabatanTargetId: number
  opsi: OpsiSyaratDiklat[]
  bolehUbah: boolean
}) {
  const { tampilkan } = useToast()
  const [pending, mulai] = useTransition()
  const [dipilih, setDipilih] = useState<number[]>(
    opsi.filter((o) => o.dipilih).map((o) => o.id),
  )

  const semula = opsi.filter((o) => o.dipilih).map((o) => o.id)
  const berubah =
    dipilih.length !== semula.length || dipilih.some((id) => !semula.includes(id))

  const rumpun: Array<{ nama: string; isi: OpsiSyaratDiklat[] }> = []
  for (const o of opsi) {
    const ada = rumpun.find((r) => r.nama === o.namaRumpun)
    if (ada) ada.isi.push(o)
    else rumpun.push({ nama: o.namaRumpun, isi: [o] })
  }

  function simpan() {
    mulai(async () => {
      const hasil = await simpanSyaratDiklat(jabatanTargetId, dipilih)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Disimpan.' }
          : { nada: 'bahaya', judul: 'Gagal menyimpan', keterangan: hasil.pesan },
      )
    })
  }

  return (
    <Panel padat>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3.5 py-3">
        <PanelHeader
          judul={
            <span className="flex flex-wrap items-center gap-2">
              Syarat pelatihan
              {dipilih.length === 0 ? (
                <Badge>Tidak diketahui</Badge>
              ) : (
                <Badge tone="aksen">{dipilih.length} kategori</Badge>
              )}
            </span>
          }
          deskripsi="Dipakai indikator rubrik Pengembangan Kompetensi (5%) — dibandingkan dengan kategori diklat pegawai yang sudah divalidasi manusia."
        />
        {bolehUbah && berubah ? (
          <Button size="sm" onClick={simpan} pending={pending} labelPending="Menyimpan…">
            Simpan syarat pelatihan
          </Button>
        ) : null}
      </div>

      <div className="space-y-3 px-3.5 py-3">
        {rumpun.map((r) => (
          <div key={r.nama}>
            <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
              {r.nama}
            </p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {r.isi.map((o) => {
                const aktif = dipilih.includes(o.id)
                return (
                  <label
                    key={o.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-2.5 py-1.5 text-[12px] transition-colors ${
                      aktif
                        ? 'border-accent-border bg-accent-subtle text-text'
                        : 'border-border text-text-muted hover:border-border-strong'
                    } ${bolehUbah ? '' : 'pointer-events-none opacity-70'}`}
                  >
                    <input
                      type="checkbox"
                      checked={aktif}
                      disabled={!bolehUbah || pending}
                      onChange={(e) =>
                        setDipilih(
                          e.target.checked
                            ? [...dipilih, o.id]
                            : dipilih.filter((x) => x !== o.id),
                        )
                      }
                      className="size-3.5 accent-[var(--accent)]"
                    />
                    <span>{o.nama}</span>
                    {o.setaraJenjang !== null ? (
                      <span className="text-[10px] text-text-subtle">
                        setara eselon {o.setaraJenjang}
                      </span>
                    ) : null}
                    {!o.aktif ? <Badge tone="peringatan">nonaktif</Badge> : null}
                  </label>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-2 border-t border-border px-3.5 py-3 text-[11px] leading-relaxed text-text-subtle">
        <p className="flex gap-1.5">
          <Info className="mt-px size-3.5 shrink-0" />
          <span>
            Indikatornya menilai <strong className="font-medium text-text-muted">punya minimal
            satu yang cocok</strong> (punya → 100, tidak → 50). Jadi menambah kategori{' '}
            <strong className="font-medium text-text-muted">melonggarkan</strong> syarat, bukan
            mengetatkannya. Rumpun tidak bisa dicentang — syarat yang berbunyi &quot;Pelatihan
            Teknis&quot; tanpa menyebut teknis apa tidak bisa diperiksa.
          </span>
        </p>
        {dipilih.length === 0 ? (
          <p className="flex gap-1.5">
            <GraduationCap className="mt-px size-3.5 shrink-0" />
            <span>
              Tanpa syarat pelatihan, indikator ini bernilai{' '}
              <strong className="font-medium text-text-muted">tidak diketahui</strong> dan ditandai
              perlu ditinjau — <strong className="font-medium text-text-muted">bukan gagal</strong>.
              Itu keadaan sah untuk jabatan yang persyaratannya belum ada di dokumen sumber; jangan
              diisi karangan supaya panel ini tampak lengkap.
            </span>
          </p>
        ) : (
          <p>
            Skor kandidat baru berubah setelah{' '}
            <strong className="font-medium text-text-muted">Hitung Ulang</strong> dijalankan. Yang
            dibandingkan adalah kategori diklat yang{' '}
            <Link href="/data/validasi-riwayat" className="text-accent hover:underline">
              sudah divalidasi manusia
            </Link>{' '}
            — diklat yang belum divalidasi tidak dianggap dimiliki.
          </p>
        )}
      </div>
    </Panel>
  )
}
