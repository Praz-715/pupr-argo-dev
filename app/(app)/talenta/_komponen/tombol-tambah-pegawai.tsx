'use client'

import { FileSpreadsheet, Plus, Upload, UserPlus } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Bidang, kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { imporPegawaiDariXlsx, tambahPegawai, tambahPegawaiMassal } from '@/lib/aksi/profil'
import { cn } from '@/lib/cn'

/**
 * Tambah pegawai — manual satu per satu, atau massal dari tempelan (butir 9).
 *
 * ## Kenapa dua mode dalam SATU dialog
 *
 * Keduanya menjawab pertanyaan yang sama ("pegawai ini belum ada di direktori"),
 * hanya berbeda banyaknya. Dua tombol terpisah di toolbar memaksa pengguna
 * memutuskan jalur sebelum tahu bedanya, dan yang salah pilih harus menutup satu
 * dialog untuk membuka yang lain. Satu dialog dengan dua tab membuat pilihannya
 * bisa diubah tanpa kehilangan apa pun.
 *
 * ## Mode massal tidak menebak apa pun
 *
 * Kolomnya berurutan tetap dan `Kode jabatan` dicocokkan PERSIS — bukan nama
 * jabatan yang dicocokkan samar. Contoh formatnya ditulis di layar, bukan di
 * dokumentasi terpisah: format yang harus dicari di tempat lain akan ditebak.
 */

const JENJANG = [
  { nilai: '', label: '— belum diketahui —' },
  { nilai: 'SLTA', label: 'SLTA' },
  { nilai: 'D3', label: 'D3' },
  { nilai: 'S1_D4', label: 'S1 / D4' },
  { nilai: 'S2', label: 'S2' },
  { nilai: 'S3', label: 'S3' },
]

const CONTOH_MASSAL = `199001012015031001\tBudi Santoso\tIII/c\t2019-04-01\tJAB-KASUBDIT-STANDAR\tS1_D4\tUniversitas Indonesia\tTeknik Sipil
199203152016032002\tSiti Aminah\tIII/b\t2020-10-01\t\tS2\tITB\tManajemen Konstruksi`

type Mode = 'manual' | 'massal' | 'berkas'

export function TombolTambahPegawai({
  opsiJabatan,
}: {
  opsiJabatan: Array<{ id: number; label: string }>
}) {
  const [buka, setBuka] = useState(false)
  return (
    <>
      <Button size="sm" onClick={() => setBuka(true)} ikon={<UserPlus className="size-3.5" />}>
        Tambah pegawai
      </Button>
      {buka ? <DialogTambah opsiJabatan={opsiJabatan} onTutup={() => setBuka(false)} /> : null}
    </>
  )
}

function DialogTambah({
  opsiJabatan,
  onTutup,
}: {
  opsiJabatan: Array<{ id: number; label: string }>
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [mode, setMode] = useState<Mode>('manual')
  const [galat, setGalat] = useState<Record<string, string>>({})

  // Manual
  const [nip, setNip] = useState('')
  const [nama, setNama] = useState('')
  const [golongan, setGolongan] = useState('')
  const [pangkat, setPangkat] = useState('')
  const [tmtGolongan, setTmtGolongan] = useState('')
  const [tmtJabatan, setTmtJabatan] = useState('')
  const [jabatanId, setJabatanId] = useState('')
  const [jenjang, setJenjang] = useState('')
  const [sekolah, setSekolah] = useState('')
  const [bidangStudi, setBidangStudi] = useState('')

  // Massal
  const [teks, setTeks] = useState('')

  // Berkas .xlsx
  const [berkas, setBerkas] = useState<File | null>(null)
  const [perbarui, setPerbarui] = useState(true)
  const [lewati, setLewati] = useState(false)
  const jumlahBaris = teks.split(/\r?\n/).filter((b) => b.trim() !== '').length

  function simpan() {
    setGalat({})
    mulaiTransisi(async () => {
      const hasil =
        mode === 'manual'
          ? await tambahPegawai({
              nip,
              namaLengkap: nama,
              golongan,
              pangkat,
              tmtGolongan,
              tmtJabatan,
              jabatanId: jabatanId === '' ? null : Number(jabatanId),
              sekolahTerakhir: sekolah,
              bidangStudiTerakhir: bidangStudi,
              tingkatPendidikan: jenjang === '' ? null : jenjang,
              statusAktif: 'AKTIF',
            })
          : mode === 'massal'
            ? await tambahPegawaiMassal({ teks })
            : await (async () => {
                if (berkas === null) {
                  return { ok: false as const, pesan: 'Pilih dulu berkas .xlsx-nya.' }
                }
                // `FormData`, bukan objek biasa: server action menerima berkas
                // sebagai `File`, dan itu satu-satunya bentuk yang tidak memuat
                // seluruh isi berkas ke memori klien sebagai string base64.
                const fd = new FormData()
                fd.set('berkas', berkas)
                fd.set('perbarui', perbarui ? 'true' : 'false')
                fd.set('lewati', lewati ? 'true' : 'false')
                return imporPegawaiDariXlsx(fd)
              })()

      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Tersimpan.' })
        onTutup()
        return
      }
      setGalat(hasil.galatField ?? {})
      // Pesan mode massal memuat daftar baris bermasalah, jadi ia ditaruh di
      // `keterangan` toast yang bisa panjang — bukan di satu field form, sebab
      // yang salah bukan satu isian melainkan barisnya.
      tampilkan({ nada: 'bahaya', judul: 'Gagal menyimpan', keterangan: hasil.pesan })
    })
  }

  return (
    <Dialog
      buka
      onTutup={onTutup}
      judul="Tambah pegawai"
      deskripsi="Pegawai baru belum punya asesmen, jadi ia belum muncul di Kotak 9 maupun match score sampai asesmennya diisi dari profilnya."
      lebar="lg"
      aksi={
        <>
          <Button variant="sekunder" size="sm" onClick={onTutup} disabled={pending}>
            Batal
          </Button>
          <Button
            size="sm"
            onClick={simpan}
            pending={pending}
            labelPending="Menyimpan…"
            disabled={
              (mode === 'massal' && jumlahBaris === 0) || (mode === 'berkas' && berkas === null)
            }
          >
            {mode === 'manual'
              ? 'Simpan'
              : mode === 'massal'
                ? `Simpan ${jumlahBaris} baris`
                : 'Impor dari berkas'}
          </Button>
        </>
      }
    >
      <div
        role="group"
        aria-label="Cara menambahkan"
        className="mb-4 inline-flex overflow-hidden rounded-md border border-border"
      >
        {(
          [
            ['manual', 'Satu pegawai', <Plus key="i" className="size-3.5" />],
            ['massal', 'Banyak sekaligus', <Upload key="i" className="size-3.5" />],
            ['berkas', 'Unggah Excel', <FileSpreadsheet key="i" className="size-3.5" />],
          ] as const
        ).map(([nilai, label, ikon]) => (
          <button
            key={nilai}
            type="button"
            onClick={() => setMode(nilai)}
            disabled={pending}
            aria-pressed={mode === nilai}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] transition-colors',
              mode === nilai
                ? 'bg-accent-subtle font-medium text-accent'
                : 'text-text-muted hover:bg-surface-2',
            )}
          >
            {ikon}
            {label}
          </button>
        ))}
      </div>

      {mode === 'manual' ? (
        <div className="space-y-3.5">
          <div className="grid gap-3.5 sm:grid-cols-[1.2fr_2fr]">
            <Bidang label="NIP" galat={galat.nip} wajib>
              <input
                value={nip}
                onChange={(e) => setNip(e.target.value)}
                disabled={pending}
                inputMode="numeric"
                placeholder="18 angka"
                className={cn(kelasInput(galat.nip), 'tabular')}
              />
            </Bidang>
            <Bidang label="Nama lengkap" galat={galat.namaLengkap} wajib>
              <input
                value={nama}
                onChange={(e) => setNama(e.target.value)}
                disabled={pending}
                placeholder="beserta gelar, seperti tertulis di SK"
                className={kelasInput(galat.namaLengkap)}
              />
            </Bidang>
          </div>

          <Bidang
            label="Jabatan"
            galat={galat.jabatanId}
            keterangan="Boleh dikosongkan — tapi selama kosong, pegawai ini tidak muncul pada penyaring unit."
          >
            <select
              value={jabatanId}
              onChange={(e) => setJabatanId(e.target.value)}
              disabled={pending}
              className={kelasInput(galat.jabatanId)}
            >
              <option value="">— belum tertaut jabatan —</option>
              {opsiJabatan.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.label}
                </option>
              ))}
            </select>
          </Bidang>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <Bidang label="Golongan" galat={galat.golongan}>
              <input
                value={golongan}
                onChange={(e) => setGolongan(e.target.value)}
                disabled={pending}
                placeholder="mis. III/c"
                className={kelasInput(galat.golongan)}
              />
            </Bidang>
            <Bidang label="Pangkat" galat={galat.pangkat}>
              <input
                value={pangkat}
                onChange={(e) => setPangkat(e.target.value)}
                disabled={pending}
                placeholder="mis. Penata"
                className={kelasInput(galat.pangkat)}
              />
            </Bidang>
            <Bidang label="TMT golongan" galat={galat.tmtGolongan}>
              <input
                type="date"
                value={tmtGolongan}
                onChange={(e) => setTmtGolongan(e.target.value)}
                disabled={pending}
                className={kelasInput(galat.tmtGolongan)}
              />
            </Bidang>
            <Bidang label="TMT jabatan" galat={galat.tmtJabatan}>
              <input
                type="date"
                value={tmtJabatan}
                onChange={(e) => setTmtJabatan(e.target.value)}
                disabled={pending}
                className={kelasInput(galat.tmtJabatan)}
              />
            </Bidang>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-[1fr_1.4fr_1.4fr]">
            <Bidang label="Pendidikan" galat={galat.tingkatPendidikan}>
              <select
                value={jenjang}
                onChange={(e) => setJenjang(e.target.value)}
                disabled={pending}
                className={kelasInput(galat.tingkatPendidikan)}
              >
                {JENJANG.map((j) => (
                  <option key={j.nilai} value={j.nilai}>
                    {j.label}
                  </option>
                ))}
              </select>
            </Bidang>
            <Bidang label="Sekolah terakhir" galat={galat.sekolahTerakhir}>
              <input
                value={sekolah}
                onChange={(e) => setSekolah(e.target.value)}
                disabled={pending}
                className={kelasInput(galat.sekolahTerakhir)}
              />
            </Bidang>
            <Bidang label="Bidang studi" galat={galat.bidangStudiTerakhir}>
              <input
                value={bidangStudi}
                onChange={(e) => setBidangStudi(e.target.value)}
                disabled={pending}
                className={kelasInput(galat.bidangStudiTerakhir)}
              />
            </Bidang>
          </div>
        </div>
      ) : mode === 'massal' ? (
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <p className="text-[12px] font-medium text-text">
              Satu pegawai per baris, kolom dipisah TAB
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
              Salin langsung blok sel dari Excel — pemisahnya sudah TAB. Urutan kolom:
            </p>
            <p className="tabular mt-1.5 text-[11px] leading-relaxed text-text-subtle">
              NIP · Nama · Golongan · TMT&nbsp;Golongan · Kode&nbsp;Jabatan · Jenjang · Sekolah ·
              Bidang&nbsp;Studi
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
              Hanya <span className="font-medium text-text">NIP</span> dan{' '}
              <span className="font-medium text-text">Nama</span> yang wajib. Jenjang memakai kode{' '}
              <span className="tabular">SLTA / D3 / S1_D4 / S2 / S3</span>. Kode jabatan dicocokkan
              persis dengan master jabatan — kalau ada satu yang tidak dikenali,{' '}
              <span className="font-medium text-text">tidak ada baris yang disimpan</span>.
            </p>
          </div>

          <Bidang
            label="Tempelkan di sini"
            galat={galat.teks}
            keterangan={
              jumlahBaris === 0
                ? `Maksimal 500 baris sekali tempel.`
                : `${jumlahBaris} baris terbaca · maksimal 500 sekali tempel`
            }
            wajib
          >
            <textarea
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              disabled={pending}
              rows={9}
              spellCheck={false}
              placeholder={CONTOH_MASSAL}
              className={cn(kelasInput(galat.teks), 'tabular resize-y font-mono text-[11px]')}
            />
          </Bidang>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-border bg-surface-2 p-3">
            <p className="text-[12px] font-medium text-text">
              Berkas Talent Pool (.xlsx) — satu blok per pegawai
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-text-muted">
              Template yang dipakai punya baris LANJUTAN: satu pegawai memakai beberapa baris untuk
              riwayat jabatan &amp; pelatihannya, dan hanya baris pertamanya yang berisi NIP. Jalur
              ini membaca pengelompokan itu, jadi berkasnya bisa diunggah apa adanya — tidak perlu
              dirapikan jadi satu baris per orang.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
              Judul kolom dibaca dari <span className="font-medium text-text">namanya</span>, bukan
              posisinya, jadi urutan kolom boleh berbeda. Jabatan dicocokkan dari pasangan{' '}
              <span className="font-medium text-text">nama jabatan + unit kerja</span> — keduanya
              harus sudah ada di Master Jabatan.
            </p>
          </div>

          <Bidang
            label="Berkas .xlsx"
            galat={galat.berkas}
            keterangan="Maksimal 20 MB. Berkas .xls lama dan .csv belum didukung."
            wajib
          >
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              disabled={pending}
              onChange={(e) => setBerkas(e.target.files?.[0] ?? null)}
              className={cn(
                kelasInput(galat.berkas),
                'cursor-pointer py-1.5 file:mr-3 file:cursor-pointer file:rounded file:border-0 file:bg-surface-3 file:px-2.5 file:py-1 file:text-[11px] file:font-medium file:text-text',
              )}
            />
          </Bidang>

          {berkas !== null ? (
            <p className="tabular text-[11px] text-text-subtle">
              {berkas.name} · {(berkas.size / 1024 / 1024).toFixed(2)} MB
            </p>
          ) : null}

          <label className="flex items-start gap-2 rounded-md border border-border p-2.5">
            <input
              type="checkbox"
              checked={perbarui}
              onChange={(e) => setPerbarui(e.target.checked)}
              disabled={pending}
              className="mt-0.5 size-3.5 shrink-0 accent-[var(--accent)]"
            />
            <span className="text-[11px] leading-relaxed text-text-muted">
              <span className="font-medium text-text">
                Perbarui pegawai yang NIP-nya sudah ada
              </span>
              . Sel yang <span className="font-medium text-text">kosong</span> di berkas tidak akan
              mengosongkan data yang sudah tersimpan — hanya kolom yang benar-benar berisi yang
              diperbarui. Kalau tidak dicentang, NIP yang sudah ada membuat seluruh impor ditolak.
            </span>
          </label>

          <label className="flex items-start gap-2 rounded-md border border-border p-2.5">
            <input
              type="checkbox"
              checked={lewati}
              onChange={(e) => setLewati(e.target.checked)}
              disabled={pending}
              className="mt-0.5 size-3.5 shrink-0 accent-[var(--accent)]"
            />
            <span className="text-[11px] leading-relaxed text-text-muted">
              <span className="font-medium text-text">Lewati baris yang perlu ditinjau</span>, impor
              sisanya. Tanpa ini, satu baris yang selnya tergeser membuat SELURUH berkas ditolak.
              Baris yang dilewati disebutkan satu per satu di pesan hasil beserta sebabnya —{' '}
              <span className="font-medium text-text">tidak</span> diperbaiki diam-diam. Galat lain
              (NIP cacat, tanggal tak terbaca, jabatan tidak ada di master) tetap membatalkan
              seluruh impor.
            </span>
          </label>

          <p className="rounded-md border border-warning-border bg-warning-subtle px-3 py-2.5 text-[11px] leading-relaxed text-text-muted">
            <span className="font-medium text-text">Yang diimpor hanya identitas pegawai</span> —
            NIP, nama, golongan, TMT golongan, jabatan, dan pendidikan terakhir. Asesmen (potkom,
            rating kinerja, Kotak 9), riwayat jabatan, riwayat diklat, dan foto{' '}
            <span className="font-medium text-text">tidak ikut</span>; untuk berkas lengkap pakai{' '}
            <span className="tabular">npm run impor:talentpool</span>, yang juga membuat unit &amp;
            jabatan yang belum ada.
          </p>
        </div>
      )}
    </Dialog>
  )
}
