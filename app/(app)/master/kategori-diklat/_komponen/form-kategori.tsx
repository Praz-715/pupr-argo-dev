'use client'

import { Plus } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Bidang, kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { buatKategoriDiklat, ubahKategoriDiklat } from '@/lib/aksi/kategori-riwayat'
import { JENIS_KATEGORI_DIKLAT } from '@/lib/kategori-riwayat'

export interface NilaiKategori {
  id?: number
  kode: string
  nama: string
  jenis: string
  parentId: number | null
  setaraJenjang: '' | 'II' | 'III' | 'IV'
  polaCocok: string
  keterangan: string
  urutan: number
  aktif: boolean
}

const KOSONG: NilaiKategori = {
  kode: '',
  nama: '',
  jenis: 'TEKNIS',
  parentId: null,
  setaraJenjang: '',
  polaCocok: '',
  keterangan: '',
  urutan: 0,
  aktif: true,
}

/**
 * Form kategori diklat.
 *
 * `polaCocok` disunting sebagai **teks satu-per-baris**, bukan daftar berpil.
 * Pola bisa memuat spasi ("hukum kontrak", "pengadaan barang"), jadi pemisah
 * koma akan memecah pola yang benar jadi dua pola yang tidak pernah cocok — dan
 * kekeliruannya tidak menimbulkan galat, hanya kategori yang berhenti diusulkan.
 */
export function FormKategoriDiklat({
  awal,
  label,
  indukTersedia,
}: {
  awal?: NilaiKategori
  label: string
  indukTersedia: Array<{ id: number; nama: string }>
}) {
  const [buka, setBuka] = useState(false)
  const [nilai, setNilai] = useState<NilaiKategori>(awal ?? KOSONG)
  const [galat, setGalat] = useState<Record<string, string>>({})
  const [pending, mulai] = useTransition()
  const { tampilkan } = useToast()

  function simpan() {
    setGalat({})
    mulai(async () => {
      const masukan = {
        kode: nilai.kode.trim().toUpperCase(),
        nama: nilai.nama,
        jenis: nilai.jenis,
        parentId: nilai.parentId,
        setaraJenjang: nilai.setaraJenjang === '' ? null : nilai.setaraJenjang,
        polaCocok: nilai.polaCocok
          .split('\n')
          .map((p) => p.trim())
          .filter((p) => p !== ''),
        keterangan: nilai.keterangan.trim() === '' ? null : nilai.keterangan.trim(),
        urutan: Number(nilai.urutan) || 0,
        aktif: nilai.aktif,
      }
      const hasil =
        awal?.id === undefined
          ? await buatKategoriDiklat(masukan)
          : await ubahKategoriDiklat(awal.id, masukan)

      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Tersimpan.' })
        setBuka(false)
        if (awal?.id === undefined) setNilai(KOSONG)
      } else {
        setGalat(hasil.galatField ?? {})
        tampilkan({ nada: 'bahaya', judul: hasil.pesan })
      }
    })
  }

  return (
    <>
      <Button
        size="sm"
        variant={awal ? 'halus' : 'utama'}
        onClick={() => setBuka(true)}
        ikon={awal ? undefined : <Plus className="size-3.5" />}
      >
        {label}
      </Button>

      <Dialog
        buka={buka}
        onTutup={() => setBuka(false)}
        judul={awal ? `Ubah kategori ${awal.kode}` : 'Tambah kategori diklat'}
        deskripsi="Kata kunci di bawah hanya MENGUSULKAN kategori; keputusan tetap dikonfirmasi manusia di halaman Validasi Riwayat."
        lebar="lg"
        aksi={
          <>
            <Button variant="halus" size="sm" onClick={() => setBuka(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={simpan} pending={pending}>
              Simpan
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Bidang
            label="Kode"
            wajib
            galat={galat.kode}
            keterangan="Pengenal stabil, huruf besar. Nama boleh diubah kapan saja; kode dipakai memeriksa syarat pelatihan."
          >
            <input
              className={kelasInput(galat.kode)}
              value={nilai.kode}
              onChange={(e) => setNilai({ ...nilai, kode: e.target.value.toUpperCase() })}
              placeholder="mis. PIM_IV"
            />
          </Bidang>
          <Bidang label="Nama" wajib galat={galat.nama}>
            <input
              className={kelasInput(galat.nama)}
              value={nilai.nama}
              onChange={(e) => setNilai({ ...nilai, nama: e.target.value })}
            />
          </Bidang>
          <Bidang label="Jenis kompetensi" galat={galat.jenis} keterangan="PP 11/2017 Ps. 203.">
            <select
              className={kelasInput(galat.jenis)}
              value={nilai.jenis}
              onChange={(e) => setNilai({ ...nilai, jenis: e.target.value })}
            >
              {JENIS_KATEGORI_DIKLAT.map((j) => (
                <option key={j} value={j}>
                  {j.replace('_', ' ')}
                </option>
              ))}
            </select>
          </Bidang>
          <Bidang
            label="Induk"
            galat={galat.parentId}
            keterangan="Kosongkan untuk kategori rumpun."
          >
            <select
              className={kelasInput(galat.parentId)}
              value={nilai.parentId === null ? '' : String(nilai.parentId)}
              onChange={(e) =>
                setNilai({ ...nilai, parentId: e.target.value === '' ? null : Number(e.target.value) })
              }
            >
              <option value="">— rumpun (tanpa induk) —</option>
              {indukTersedia
                .filter((i) => i.id !== awal?.id)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nama}
                  </option>
                ))}
            </select>
          </Bidang>
          <Bidang
            label="Setara jenjang"
            galat={galat.setaraJenjang}
            keterangan="Eselon yang disyaratkan diklat ini. PIM III → II, PIM IV → III/IV."
          >
            <select
              className={kelasInput(galat.setaraJenjang)}
              value={nilai.setaraJenjang}
              onChange={(e) =>
                setNilai({ ...nilai, setaraJenjang: e.target.value as NilaiKategori['setaraJenjang'] })
              }
            >
              <option value="">— tidak terkait jenjang —</option>
              <option value="II">II</option>
              <option value="III">III</option>
              <option value="IV">IV</option>
            </select>
          </Bidang>
          <Bidang label="Urutan tampil" galat={galat.urutan}>
            <input
              type="number"
              min={0}
              className={kelasInput(galat.urutan)}
              value={nilai.urutan}
              onChange={(e) => setNilai({ ...nilai, urutan: Number(e.target.value) })}
            />
          </Bidang>
        </div>

        <div className="mt-4 space-y-3">
          <Bidang
            label="Kata kunci pengusul"
            galat={galat.polaCocok}
            keterangan="Satu per baris, bukan dipisah koma — pola boleh memuat spasi. Dicocokkan sebagai potongan teks pada nama diklat yang sudah dinormalisasi (huruf kecil, tanpa tanda baca)."
          >
            <textarea
              rows={5}
              className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] text-text outline-none transition-colors placeholder:text-text-subtle focus:border-accent"
              value={nilai.polaCocok}
              onChange={(e) => setNilai({ ...nilai, polaCocok: e.target.value })}
              placeholder={'pim iv\npim 4\nkepemimpinan pengawas'}
            />
          </Bidang>
          <Bidang label="Keterangan" galat={galat.keterangan}>
            <input
              className={kelasInput(galat.keterangan)}
              value={nilai.keterangan}
              onChange={(e) => setNilai({ ...nilai, keterangan: e.target.value })}
              placeholder="mis. Syarat Kasubdit / Kepala Balai — sample(1).md lembar 6"
            />
          </Bidang>
          <label className="flex items-center gap-2 text-[13px] text-text">
            <input
              type="checkbox"
              checked={nilai.aktif}
              onChange={(e) => setNilai({ ...nilai, aktif: e.target.checked })}
            />
            Aktif — kategori nonaktif tetap terpasang di pemetaan lama, tapi tidak bisa dipilih lagi
          </label>
        </div>
      </Dialog>
    </>
  )
}
