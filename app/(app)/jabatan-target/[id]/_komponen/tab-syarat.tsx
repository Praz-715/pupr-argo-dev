'use client'

import { ListChecks, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogKonfirmasi } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { useToast } from '@/components/ui/toast'
import { hapusPersyaratan, simpanPersyaratan } from '@/lib/aksi/jabatan-target'
import { cn } from '@/lib/cn'
import type { BarisPersyaratan, SelisihBidangIlmu } from '@/lib/kueri/rubrik'
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
    keterangan:
      'Daftar kata kunci dipisah koma; "semua" berarti semua bidang diperbolehkan. Dipakai gerbang kelayakan DAN indikator rubrik Kesesuaian Bidang Ilmu — satu deklarasi, dua pembaca',
  },
  {
    nilai: 'GOLONGAN_MIN',
    label: 'Golongan minimal',
    contoh: 'III/d',
    keterangan:
      'Golongan PP 11/2017 — I/a sampai IV/e. Syarat KERAS: pegawai di bawahnya dinyatakan tidak lolos, dengan alasan yang disebutkan',
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
  GOLONGAN_MIN: 'Golongan minimal',
  PENGALAMAN_MIN: 'Pengalaman minimal',
  // Tidak pernah disimpan sebagai baris persyaratan — lihat `JENIS_SYARAT_VIRTUAL`.
  // Labelnya tetap ada supaya rincian kelayakan bisa menampilkannya.
  JABATAN_ASAL: 'Jabatan asal kandidat',
  LAINNYA: 'Lainnya',
}

export function TabSyarat({
  jabatanTargetId,
  syarat,
  selisihBidangIlmu,
  bolehUbah,
}: {
  jabatanTargetId: number
  syarat: BarisPersyaratan[]
  selisihBidangIlmu: SelisihBidangIlmu | null
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

  // Selisih hanya bisa berasal dari data sebelum Fase 11 — sejak fase itu kedua
  // penyimpanan ditulis bersama. Ditampilkan, TIDAK dibetulkan sendiri: menyamakan
  // otomatis berarti membuang kata kunci yang masih menggerakkan skor, yaitu
  // mengubah skor orang tanpa ada yang memutuskannya.
  const menyimpang =
    selisihBidangIlmu !== null &&
    (selisihBidangIlmu.hanyaDiRubrik.length > 0 || selisihBidangIlmu.hanyaDiGerbang.length > 0)

  return (
    <div className="space-y-4">
      {menyimpang && selisihBidangIlmu !== null ? (
        <Panel>
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
            <div className="min-w-0 space-y-2">
              <p className="text-[13px] font-medium text-text">
                Bidang ilmu tersimpan dua kali dengan isi berbeda
              </p>
              <p className="text-[12px] leading-relaxed text-text-muted">
                Gerbang kelayakan dan indikator rubrik Kesesuaian Bidang Ilmu membaca daftar kata
                kunci yang <strong className="font-medium text-text">tidak sama</strong>. Ini sisa
                keadaan sebelum keduanya disatukan — sejak sekarang menyimpan syarat bidang ilmu
                menulis kedua-duanya, jadi selisih tidak bisa muncul lagi.
              </p>
              <dl className="grid gap-1.5 text-[12px] sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-[11px] text-text-subtle">Dipakai gerbang kelayakan</dt>
                  <dd className="text-text-muted">
                    {selisihBidangIlmu.gerbang.length === 0
                      ? '— belum diisi'
                      : selisihBidangIlmu.gerbang.join(' · ')}
                  </dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[11px] text-text-subtle">Dipakai indikator rubrik</dt>
                  <dd className="text-text-muted">
                    {selisihBidangIlmu.rubrik.length === 0
                      ? '— belum diisi'
                      : selisihBidangIlmu.rubrik.join(' · ')}
                  </dd>
                </div>
              </dl>
              {selisihBidangIlmu.hanyaDiRubrik.length > 0 ? (
                <p className="text-[12px] leading-relaxed text-text-muted">
                  Menyimpan syarat bidang ilmu akan{' '}
                  <strong className="font-medium text-warning">membuang</strong>{' '}
                  {selisihBidangIlmu.hanyaDiRubrik.map((k) => `“${k}”`).join(', ')} dari indikator
                  rubrik. Kata kunci itu sekarang masih menaikkan skor sebagian kandidat, jadi{' '}
                  <strong className="font-medium text-text-muted">skor akan bergeser</strong> —
                  jalankan Simulasi &amp; Diff lebih dulu kalau ingin melihat siapa saja.
                </p>
              ) : null}
            </div>
          </div>
        </Panel>
      ) : null}

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
                      ) : null}
                      {s.durasiTahunMin ? (
                        <Badge tone="peringatan" title="Belum diperiksa mesin — verifikasi manual">
                          <span className="tabular">min. {s.durasiTahunMin} tahun</span>
                        </Badge>
                      ) : null}
                      {!terstruktur ? (
                        <Badge tone="peringatan" title="Tidak menyaring siapa pun">
                          perlu verifikasi manual
                        </Badge>
                      ) : null}
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
  const [durasi, setDurasi] = useState(
    baris?.durasiTahunMin === null || baris?.durasiTahunMin === undefined
      ? ''
      : String(baris.durasiTahunMin),
  )

  const jenisTerpilih = JENIS.find((j) => j.nilai === jenisSyarat)!

  function simpan() {
    setGalat({})
    mulaiTransisi(async () => {
      const hasil = await simpanPersyaratan(jabatanTargetId, baris?.id ?? null, {
        jenisSyarat,
        deskripsi,
        nilaiMinimal: nilaiMinimal.trim() === '' ? null : nilaiMinimal,
        // Durasi hanya dikirim untuk syarat pengalaman. Mengirimnya untuk jenis lain
        // ditolak server — dan itu benar: durasi tanpa jenjang tidak berarti apa pun.
        durasiTahunMin:
          jenisSyarat === 'PENGALAMAN_MIN' && durasi.trim() !== '' ? Number(durasi) : null,
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

        {jenisSyarat === 'PENGALAMAN_MIN' ? (
          <label className="block">
            <span className="mb-1 flex flex-wrap items-baseline gap-1.5">
              <span className="text-[12px] font-medium text-text">Lama minimal (tahun)</span>
              <span className="text-[10px] text-text-subtle">
                opsional — mis. 3 untuk &ldquo;pengawas paling singkat 3 tahun&rdquo;
              </span>
            </span>
            <input
              value={durasi}
              onChange={(e) => setDurasi(e.target.value.replace(/[^0-9]/g, ''))}
              disabled={pending}
              inputMode="numeric"
              placeholder="mis. 3"
              className={cn(
                'tabular h-9 w-full rounded-md border bg-surface px-2.5 text-[13px] text-text outline-none disabled:opacity-60',
                galat.durasiTahunMin ? 'border-danger-border' : 'border-border focus:border-accent',
              )}
            />
            {galat.durasiTahunMin ? (
              <span role="alert" className="mt-1 block text-[11px] leading-relaxed text-danger">
                {galat.durasiTahunMin}
              </span>
            ) : null}
            {durasi.trim() !== '' ? (
              <span className="mt-1 block text-[11px] leading-relaxed text-text-subtle">
                Durasi <strong className="font-medium text-text-muted">belum diperiksa mesin</strong>
                : lama menjabat pada satu jenjang menuntut riwayat jabatan yang sudah dipetakan ke
                master DAN bertanggal, dan baru sebagian kecil data memenuhi keduanya. Kandidat yang
                jenjangnya sudah terpenuhi akan ditandai perlu verifikasi manual beserta angka
                syaratnya — bukan diloloskan diam-diam.
              </span>
            ) : null}
          </label>
        ) : null}

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
