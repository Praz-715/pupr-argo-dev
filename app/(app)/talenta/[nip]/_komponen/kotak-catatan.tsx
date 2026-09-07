'use client'

import { NotebookPen, X } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { Button } from '@/components/ui/button'
import { Bidang, kelasInput } from '@/components/ui/bidang'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { simpanCatatanPegawai } from '@/lib/aksi/profil'
import {
  KATEGORI_CATATAN,
  MAKS_KETERANGAN_CATATAN,
  type KategoriCatatan,
} from '@/lib/catatan-pegawai'
import { formatTanggalWaktu } from '@/lib/format'

/**
 * Kotak **Catatan** di panel Integritas & rekam jejak disiplin.
 *
 * Permintaan pemilik proses 2 Sep 2026: *"tambahan kotak judulnya catatan untuk
 * diisi keterangan kategori inisial: HDS, HDB, TBTL, TBS"*, ditegaskan susulan
 * *"biarin aja singkatan, yang penting user bisa milih pilihan itu."*
 *
 * ## Kenapa kode dipajang BESAR dan keterangannya di bawahnya
 *
 * Kodenya yang dicari orang — ia pula yang muncul sebagai penanda kuning di
 * direktori & daftar kandidat, jadi bentuknya di sini harus sama dengan bentuknya
 * di sana. Keterangan boleh kosong; kode tidak.
 *
 * ## Yang SENGAJA tidak dilakukan
 *
 * Tidak ada tooltip kepanjangan, dan itu keputusan pemilik proses — sistem memang
 * tidak tahu artinya. Konsekuensinya ditulis di `lib/catatan-pegawai.ts`: kode ini
 * tidak menggeser skor, tidak menggugurkan kelayakan, dan urutannya di pemilih
 * bukan urutan bobot.
 */
export function KotakCatatan({
  pegawaiId,
  nama,
  catatan,
  bolehUbah,
}: {
  pegawaiId: number
  nama: string
  catatan: {
    kategori: KategoriCatatan
    keterangan: string | null
    olehNama: string | null
    pada: Date | null
  } | null
  bolehUbah: boolean
}) {
  const { tampilkan } = useToast()
  const [buka, setBuka] = useState(false)
  const [pending, mulai] = useTransition()
  const [kategori, setKategori] = useState<string>(catatan?.kategori ?? '')
  const [keterangan, setKeterangan] = useState(catatan?.keterangan ?? '')
  const [galat, setGalat] = useState<string | null>(null)

  function simpan(kategoriBaru: string | null) {
    setGalat(null)
    mulai(async () => {
      const hasil = await simpanCatatanPegawai(
        pegawaiId,
        kategoriBaru,
        kategoriBaru === null ? null : keterangan,
      )
      if (!hasil.ok) {
        setGalat(hasil.pesan ?? 'Gagal menyimpan.')
        return
      }
      setBuka(false)
      tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Disimpan.' })
    })
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface-inset px-3 py-2.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-medium tracking-wide text-text-subtle uppercase">
            Catatan
          </p>
          {catatan === null ? (
            <p className="mt-1 text-[12px] leading-relaxed text-text-subtle">
              Belum ada catatan. Kode yang tersedia: {KATEGORI_CATATAN.join(' · ')}.
            </p>
          ) : (
            <>
              <span className="mt-1 inline-flex items-center gap-2">
                <Badge tone="peringatan">{catatan.kategori}</Badge>
                {catatan.keterangan ? (
                  <span className="text-[12px] leading-relaxed text-text">
                    {catatan.keterangan}
                  </span>
                ) : null}
              </span>
              <p className="mt-1 text-[11px] leading-relaxed text-text-subtle">
                Ditulis {catatan.olehNama ?? 'pengguna yang sudah dihapus'}
                {catatan.pada === null ? '' : ` · ${formatTanggalWaktu(catatan.pada)}`} · namanya
                ditandai di direktori pegawai &amp; daftar kandidat
              </p>
            </>
          )}
        </div>

        {bolehUbah ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <Button
              size="sm"
              variant="sekunder"
              onClick={() => setBuka(true)}
              ikon={<NotebookPen className="size-3.5" />}
            >
              {catatan === null ? 'Isi catatan' : 'Ubah'}
            </Button>
            {catatan !== null ? (
              <Button
                size="ikon"
                variant="halus"
                onClick={() => simpan(null)}
                disabled={pending}
                aria-label="Hapus catatan"
                title="Hapus catatan — penandanya ikut hilang"
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
          </span>
        ) : null}
      </div>

      <Dialog
        buka={buka}
        onTutup={() => setBuka(false)}
        judul={`Catatan untuk ${nama}`}
        deskripsi="Pilih kodenya, lalu isi keterangannya bila perlu. Kode ini TIDAK mengubah skor maupun kelayakan — ia penanda supaya barisnya kelihatan di direktori pegawai & daftar kandidat."
      >
        <div className="space-y-3">
          <Bidang label="Kode" wajib>
            {/*
              Opsi bernilai '' WAJIB ada walau bidangnya wajib diisi: tanpa itu
              `<select value="">` tidak menemukan option yang cocok dan peramban
              menampilkan opsi PERTAMA sementara state React-nya masih kosong —
              layar memperlihatkan "HDS" seolah sudah terpilih, lalu Simpan
              ditolak tanpa ada yang bisa ditebak penggunanya. Jebakan yang sudah
              tercatat di CLAUDE.md dan pernah dilaporkan pemilik proses.
            */}
            <select
              value={kategori}
              onChange={(e) => setKategori(e.target.value)}
              className={kelasInput()}
            >
              <option value="" disabled>
                — pilih —
              </option>
              {KATEGORI_CATATAN.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </Bidang>

          <Bidang
            label="Keterangan"
            keterangan={`Opsional · maksimal ${MAKS_KETERANGAN_CATATAN} karakter`}
          >
            <textarea
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              rows={3}
              maxLength={MAKS_KETERANGAN_CATATAN}
              /* `kelasInput()` memaku `h-9` — benar untuk input satu baris, dan
                 memotong textarea jadi setinggi satu baris. Tingginya ditimpa di
                 sini, bukan dengan varian baru di `kelasInput()`: satu-satunya
                 pemakai textarea di aplikasi ini adalah kotak ini. */
              className={cn(kelasInput(), 'h-auto py-2 leading-relaxed')}
            />
          </Bidang>

          {galat !== null ? (
            <p role="alert" className="text-[12px] text-danger">
              {galat}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="halus" onClick={() => setBuka(false)} disabled={pending}>
              Batal
            </Button>
            <Button
              onClick={() => (kategori === '' ? setGalat('Pilih kodenya dulu.') : simpan(kategori))}
              pending={pending}
            >
              Simpan catatan
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  )
}
