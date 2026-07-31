'use client'

import { ListChecks, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogKonfirmasi } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { useToast } from '@/components/ui/toast'
import { hapusPersyaratan, simpanPersyaratan } from '@/lib/aksi/jabatan-target'
import { cn } from '@/lib/cn'
import type { BarisPersyaratan } from '@/lib/kueri/rubrik'
import type { JenisSyarat } from '@/lib/scoring/eligibility'

/**
 * Tab 2 — Persyaratan (syarat minimal kelayakan).
 *
 * Yang paling penting disampaikan di sini: syarat **tanpa `nilai minimal`
 * terstruktur tidak menyaring siapa pun**. Mesin kelayakan menandainya
 * "perlu verifikasi manual" — bukan lolos, bukan gagal — supaya tidak ada
 * kandidat yang tersaring atau diloloskan oleh tebakan mesin. Kalau itu tidak
 * ditulis di UI, pengguna akan menyangka syarat deskriptifnya sudah bekerja.
 */

const JENIS: Array<{ nilai: JenisSyarat; label: string; contoh: string; keterangan: string }> = [
  {
    nilai: 'PENDIDIKAN_MIN',
    label: 'Pendidikan minimal',
    contoh: 'S1_D4',
    keterangan: 'Isi salah satu: SLTA · D3 · S1_D4 · S2 · S3',
  },
  {
    nilai: 'BIDANG_ILMU',
    label: 'Bidang ilmu',
    contoh: 'teknik, sipil, konstruksi',
    keterangan: 'Daftar kata kunci dipisah koma; "semua" berarti semua bidang diperbolehkan',
  },
  {
    nilai: 'PENGALAMAN_MIN',
    label: 'Pengalaman minimal',
    contoh: 'III',
    keterangan: 'Eselon (I · II · III · IV · NON_ESELON) atau jumlah tahun berupa angka',
  },
  {
    nilai: 'LAINNYA',
    label: 'Lainnya',
    contoh: '',
    keterangan: 'Selalu perlu penilaian manusia — mesin tidak memeriksanya',
  },
]

const LABEL_JENIS: Record<JenisSyarat, string> = {
  PENDIDIKAN_MIN: 'Pendidikan minimal',
  BIDANG_ILMU: 'Bidang ilmu',
  PENGALAMAN_MIN: 'Pengalaman minimal',
  LAINNYA: 'Lainnya',
}

export function TabSyarat({
  jabatanTargetId,
  syarat,
  bolehUbah,
}: {
  jabatanTargetId: number
  syarat: BarisPersyaratan[]
  bolehUbah: boolean
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [form, setForm] = useState<{ mode: 'buat' | 'ubah'; baris: BarisPersyaratan | null } | null>(
    null,
  )
  const [hapus, setHapus] = useState<BarisPersyaratan | null>(null)

  function jalankanHapus() {
    if (hapus === null) return
    mulaiTransisi(async () => {
      const hasil = await hapusPersyaratan(jabatanTargetId, hapus.id)
      setHapus(null)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Dihapus.' }
          : { nada: 'bahaya', judul: 'Gagal menghapus', keterangan: hasil.pesan },
      )
    })
  }

  const tanpaNilai = syarat.filter((s) => (s.nilaiMinimal ?? '').trim() === '')

  return (
    <div className="space-y-4">
      <Panel padat>
        <div className="border-b border-border px-3.5 py-3">
          <PanelHeader
            judul="Syarat minimal kelayakan"
            deskripsi="Diperiksa sebelum match score dipakai: kandidat yang tidak memenuhi tetap dihitung skornya, tapi ditandai tidak lolos syarat."
            aksi={
              bolehUbah ? (
                <Button
                  size="sm"
                  variant="sekunder"
                  onClick={() => setForm({ mode: 'buat', baris: null })}
                  ikon={<Plus className="size-3.5" />}
                >
                  Tambah syarat
                </Button>
              ) : null
            }
          />
        </div>

        {syarat.length === 0 ? (
          <EmptyState
            className="m-3.5 border-0"
            judul="Belum ada persyaratan"
            deskripsi="Tanpa syarat apa pun, seluruh pegawai dianggap lolos dan daftar kandidat menjadi salinan direktori pegawai."
            ikon={<ListChecks className="size-5" />}
            aksi={
              bolehUbah ? (
                <Button size="sm" onClick={() => setForm({ mode: 'buat', baris: null })}>
                  Tambah syarat pertama
                </Button>
              ) : null
            }
          />
        ) : (
          <ul className={cn('divide-y divide-border', pending && 'opacity-60')}>
            {syarat.map((s) => {
              const terstruktur = (s.nilaiMinimal ?? '').trim() !== ''
              return (
                <li key={s.id} className="flex items-start justify-between gap-3 px-3.5 py-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-medium text-text">
                        {LABEL_JENIS[s.jenisSyarat]}
                      </span>
                      {terstruktur ? (
                        <Badge tone="aksen" title="Bisa diperiksa otomatis">
                          <span className="tabular">{s.nilaiMinimal}</span>
                        </Badge>
                      ) : (
                        <Badge tone="peringatan" title="Tidak menyaring siapa pun">
                          perlu verifikasi manual
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-text-muted">{s.deskripsi}</p>
                    {!terstruktur ? (
                      <p className="mt-1 text-[11px] leading-relaxed text-text-subtle">
                        Karena nilai minimalnya kosong, syarat ini{' '}
                        <strong className="font-medium text-text-muted">tidak menyaring</strong>{' '}
                        kandidat — setiap orang ditandai perlu diperiksa manusia pada syarat ini.
                      </p>
                    ) : null}
                  </div>
                  {bolehUbah ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="ikon"
                        variant="halus"
                        onClick={() => setForm({ mode: 'ubah', baris: s })}
                        aria-label={`Ubah syarat ${LABEL_JENIS[s.jenisSyarat]}`}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button
                        size="ikon"
                        variant="halus"
                        onClick={() => setHapus(s)}
                        aria-label={`Hapus syarat ${LABEL_JENIS[s.jenisSyarat]}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      {syarat.length > 0 ? (
        <p className="text-[11px] leading-relaxed text-text-subtle">
          {tanpaNilai.length === 0
            ? 'Seluruh syarat punya nilai minimal terstruktur, jadi kelayakan bisa diputuskan mesin sepenuhnya.'
            : `${tanpaNilai.length} dari ${syarat.length} syarat belum punya nilai minimal terstruktur — kandidat akan selalu ditandai "perlu verifikasi manual" pada syarat itu. Asesmen talenta yang berlaku selalu ikut diperiksa sebagai syarat tambahan, walau tidak terdaftar di sini.`}
        </p>
      ) : null}

      {form !== null ? (
        <FormSyarat
          jabatanTargetId={jabatanTargetId}
          mode={form.mode}
          baris={form.baris}
          onTutup={() => setForm(null)}
        />
      ) : null}

      <DialogKonfirmasi
        buka={hapus !== null}
        onTutup={() => setHapus(null)}
        onKonfirmasi={jalankanHapus}
        pending={pending}
        destruktif
        judul="Hapus persyaratan ini?"
        deskripsi="Kandidat yang tadinya tersaring olehnya akan lolos setelah skor dihitung ulang."
        labelKonfirmasi="Hapus"
      />
    </div>
  )
}

function FormSyarat({
  jabatanTargetId,
  mode,
  baris,
  onTutup,
}: {
  jabatanTargetId: number
  mode: 'buat' | 'ubah'
  baris: BarisPersyaratan | null
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})

  const [jenisSyarat, setJenisSyarat] = useState<JenisSyarat>(baris?.jenisSyarat ?? 'PENDIDIKAN_MIN')
  const [deskripsi, setDeskripsi] = useState(baris?.deskripsi ?? '')
  const [nilaiMinimal, setNilaiMinimal] = useState(baris?.nilaiMinimal ?? '')

  const jenisTerpilih = JENIS.find((j) => j.nilai === jenisSyarat)!

  function simpan() {
    setGalat({})
    mulaiTransisi(async () => {
      const hasil = await simpanPersyaratan(jabatanTargetId, baris?.id ?? null, {
        jenisSyarat,
        deskripsi,
        nilaiMinimal: nilaiMinimal.trim() === '' ? null : nilaiMinimal,
      })
      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Disimpan.' })
        onTutup()
      } else {
        setGalat(hasil.galatField ?? {})
        if (!hasil.galatField) {
          tampilkan({ nada: 'bahaya', judul: 'Gagal menyimpan', keterangan: hasil.pesan })
        }
      }
    })
  }

  return (
    <Dialog
      buka
      onTutup={onTutup}
      judul={mode === 'buat' ? 'Tambah persyaratan' : 'Ubah persyaratan'}
      deskripsi="Nilai minimal yang terstruktur membuat syarat ini bisa diperiksa mesin; dibiarkan kosong, ia hanya jadi catatan untuk manusia."
      aksi={
        <>
          <Button variant="sekunder" size="sm" onClick={onTutup} disabled={pending}>
            Batal
          </Button>
          <Button size="sm" onClick={simpan} pending={pending} labelPending="Menyimpan…">
            Simpan
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <label className="block">
          <span className="mb-1 block text-[12px] font-medium text-text">Jenis syarat</span>
          <select
            value={jenisSyarat}
            onChange={(e) => setJenisSyarat(e.target.value as JenisSyarat)}
            disabled={pending}
            className="h-9 w-full rounded-md border border-border bg-surface px-2.5 text-[13px] text-text outline-none focus:border-accent disabled:opacity-60"
          >
            {JENIS.map((j) => (
              <option key={j.nilai} value={j.nilai}>
                {j.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 flex items-baseline gap-1.5">
            <span className="text-[12px] font-medium text-text">Deskripsi</span>
            <span aria-hidden className="text-[12px] text-danger">
              *
            </span>
            <span className="text-[10px] text-text-subtle">yang dibaca manusia</span>
          </span>
          <textarea
            value={deskripsi}
            onChange={(e) => setDeskripsi(e.target.value)}
            disabled={pending}
            rows={2}
            placeholder="mis. Pendidikan minimal S1/DIV pada bidang teknik"
            className={cn(
              'w-full rounded-md border bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-text outline-none disabled:opacity-60',
              galat.deskripsi ? 'border-danger-border' : 'border-border focus:border-accent',
            )}
          />
          {galat.deskripsi ? (
            <span role="alert" className="mt-1 block text-[11px] text-danger">
              {galat.deskripsi}
            </span>
          ) : null}
        </label>

        <label className="block">
          <span className="mb-1 flex flex-wrap items-baseline gap-1.5">
            <span className="text-[12px] font-medium text-text">Nilai minimal</span>
            <span className="text-[10px] text-text-subtle">{jenisTerpilih.keterangan}</span>
          </span>
          <input
            value={nilaiMinimal}
            onChange={(e) => setNilaiMinimal(e.target.value)}
            disabled={pending || jenisSyarat === 'LAINNYA'}
            placeholder={jenisTerpilih.contoh || 'tidak dipakai untuk jenis ini'}
            className={cn(
              'tabular h-9 w-full rounded-md border bg-surface px-2.5 text-[13px] text-text outline-none disabled:opacity-60',
              galat.nilaiMinimal ? 'border-danger-border' : 'border-border focus:border-accent',
            )}
          />
          {galat.nilaiMinimal ? (
            <span role="alert" className="mt-1 block text-[11px] leading-relaxed text-danger">
              {galat.nilaiMinimal}
            </span>
          ) : null}
        </label>

        {nilaiMinimal.trim() === '' && jenisSyarat !== 'LAINNYA' ? (
          <div className="rounded-md border border-warning-border bg-warning-subtle px-3 py-2.5">
            <p className="text-[11px] leading-relaxed text-text-muted">
              Tanpa nilai minimal, syarat ini{' '}
              <strong className="font-medium text-text">tidak menyaring kandidat</strong>. Setiap
              orang akan ditandai &quot;perlu verifikasi manual&quot; — sengaja begitu, supaya tidak
              ada yang tersaring oleh tebakan mesin.
            </p>
          </div>
        ) : null}
      </div>
    </Dialog>
  )
}
