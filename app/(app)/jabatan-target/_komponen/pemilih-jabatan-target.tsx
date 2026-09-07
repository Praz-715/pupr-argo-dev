'use client'

import { Building2, Plus, TriangleAlert } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { KotakCari } from '@/components/ui/kotak-cari'
import { useToast } from '@/components/ui/toast'
import { buatTargetDariJabatan, cariJabatanMaster } from '@/lib/aksi/jabatan-target'
import { cn } from '@/lib/cn'
import type { JabatanAnggota } from '@/lib/kueri/rubrik'

/**
 * "Buat jabatan target" — **memilih dari master jabatan**, tidak lagi mengetik
 * kode & nama sendiri (permintaan pemilik proses 25 Agu 2026).
 *
 * ## Kenapa formulir bebasnya dicabut
 *
 * Tiga akibat yang semuanya sudah terjadi di data dev, dan tak satu pun muncul
 * sebagai galat:
 *
 *   1. **Nama tidak sama dengan master.** "Kepala Subdirektorat Sistem Pengadaan"
 *      vs "Kepala Sub Direktorat Sistem Pengadaan Jasa Konstruksi" — satu kursi,
 *      dua sebutan, dan tidak ada yang bisa menyatukannya kembali tanpa membaca
 *      keduanya satu per satu.
 *   2. **Kode bentrok atau terpotong.** `kode_target` `varchar(40)`; singkatan dari
 *      nama panjang memotong tanpa peringatan, dan dua nama berbeda bisa
 *      menghasilkan singkatan sama.
 *   3. **Jabatan target tanpa jabatan anggota.** Mengetik identitas tidak menautkan
 *      kursi apa pun; penautannya langkah terpisah di tab Jabatan Anggota. Kalau
 *      terlewat, jabatan targetnya tidak menunjuk posisi mana pun — dan itu yang
 *      terjadi pada 26 dari 31 target lama.
 *
 * Memilih dari master menutup ketiganya sekaligus: nama & kode diturunkan dari
 * baris master, dan jabatan anggotanya terisi dalam mutasi yang sama.
 *
 * ## Yang sudah punya jabatan target tetap ditampilkan
 *
 * Barisnya tampil dengan keterangan target pemiliknya dan tombolnya dimatikan.
 * Menyembunyikannya akan membuat pengguna mencari nama yang jelas ada di master,
 * tidak menemukannya, lalu menyimpulkan pencariannya rusak — padahal jawabannya
 * "sudah ada yang punya".
 */
export function TombolBuatTarget() {
  const [buka, setBuka] = useState(false)
  return (
    <>
      <Button
        size="sm"
        variant="utama"
        onClick={() => setBuka(true)}
        ikon={<Plus className="size-4" />}
      >
        Buat jabatan target
      </Button>
      {buka ? <DialogPilihJabatan onTutup={() => setBuka(false)} /> : null}
    </>
  )
}

function DialogPilihJabatan({ onTutup }: { onTutup: () => void }) {
  const { tampilkan } = useToast()
  const router = useRouter()
  const [teks, setTeks] = useState('')
  const [hasil, setHasil] = useState<JabatanAnggota[] | null>(null)
  const [mencari, transisiCari] = useTransition()
  const [membuat, transisiBuat] = useTransition()

  function jalankan(kata: string) {
    setTeks(kata)
    transisiCari(async () => {
      const r = await cariJabatanMaster(kata)
      setHasil(r.ok ? r.data : [])
      if (!r.ok) tampilkan({ nada: 'bahaya', judul: 'Gagal mencari', keterangan: r.pesan })
    })
  }

  /*
    Muatan pertama dilepas SEKALI saat dialog terbuka, dengan kata kunci kosong —
    daftar kosong yang menunggu kata kunci tidak memberi tahu bahwa yang dicari
    adalah jabatan. Sesudah itu pencarian hanya berjalan saat ENTER (permintaan
    pemilik proses 2 Sep 2026); debounce 300 ms yang dulu ada di sini dilepas.

    Ditulis sebagai render-time guard, bukan `useEffect`: lint repo ini menolak
    `setState` di dalam effect, dan `transisiCari` di sini menyetel `hasil`.
  */
  const [sudahMuat, setSudahMuat] = useState(false)
  if (!sudahMuat) {
    setSudahMuat(true)
    jalankan('')
  }

  function pilih(j: JabatanAnggota) {
    transisiBuat(async () => {
      const r = await buatTargetDariJabatan(j.id)
      if (!r.ok) {
        tampilkan({ nada: 'bahaya', judul: 'Gagal membuat', keterangan: r.pesan })
        return
      }
      tampilkan({ nada: 'sukses', judul: r.pesan ?? 'Draft jabatan target dibuat.' })
      onTutup()
      // Mendarat di tab Persyaratan — langkah pertama alurnya, dan satu-satunya
      // tab yang pengusul berperan Pengelola Unit bisa sentuh.
      if (r.data.id > 0) router.push(`/jabatan-target/${r.data.id}?tab=syarat`)
    })
  }

  return (
    <Dialog
      buka
      onTutup={onTutup}
      lebar="lg"
      judul="Buat jabatan target"
      deskripsi="Pilih jabatan dari master. Kode, nama, dan jabatan anggotanya diturunkan dari baris master — jabatan target baru selalu lahir sebagai draft dan belum menilai siapa pun sampai rubriknya lolos pemeriksaan."
      aksi={
        <Button variant="sekunder" size="sm" onClick={onTutup} disabled={membuat}>
          Tutup
        </Button>
      }
    >
      <div className="space-y-3">
        <KotakCari
          nilaiAwal={teks}
          onCari={jalankan}
          disabled={membuat}
          autoFocus
          pending={mencari}
          placeholder="Cari nama jabatan, kode, atau unit organisasi…"
          label="Cari jabatan di master"
        />

        <div
          className={cn(
            'max-h-[26rem] overflow-y-auto rounded-md border border-border',
            (mencari || membuat) && 'opacity-60',
          )}
        >
          {hasil === null ? (
            <p className="p-4 text-center text-[12px] text-text-muted">Memuat daftar jabatan…</p>
          ) : hasil.length === 0 ? (
            <EmptyState
              className="m-3 border-0"
              judul="Tidak ada jabatan yang cocok"
              deskripsi={
                teks.trim() === ''
                  ? 'Master jabatan dalam lingkup Anda kosong. Tambahkan jabatannya lebih dulu di Master Data › Jabatan.'
                  : `Tidak ada jabatan bernama, berkode, atau berunit yang memuat "${teks.trim()}".`
              }
              ikon={<Building2 className="size-5" />}
            />
          ) : (
            <ul className="divide-y divide-border">
              {hasil.map((j) => {
                const sudahDipakai = j.targetLain !== null
                return (
                  <li key={j.id} className="flex items-start justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-text">{j.namaJabatan}</p>
                      <p className="mt-0.5 text-[11px] text-text-subtle">{j.namaUnit}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {j.eselon ? <Badge>Eselon {j.eselon}</Badge> : null}
                        <Badge tone={j.statusJabatan === 'KOSONG' ? 'peringatan' : 'netral'}>
                          {j.statusJabatan === 'KOSONG' ? 'Kosong' : 'Terisi'}
                        </Badge>
                        <span className="text-text-subtle">{j.kodeJabatan}</span>
                      </p>
                      {sudahDipakai ? (
                        <p className="mt-1.5 flex items-start gap-1.5 text-[11px] leading-relaxed text-text-muted">
                          <TriangleAlert className="mt-px size-3.5 shrink-0 text-warning" />
                          <span>
                            Sudah termasuk jabatan target{' '}
                            <strong className="font-medium text-text">{j.targetLain}</strong> —
                            sunting yang itu alih-alih membuat yang kedua untuk kursi yang sama.
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="halus"
                      disabled={sudahDipakai || membuat}
                      onClick={() => pilih(j)}
                      aria-label={`Jadikan "${j.namaJabatan}" jabatan target`}
                    >
                      Pilih
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-text-subtle">
          Daftar dibatasi 25 baris teratas: yang <strong className="font-medium">belum punya</strong>{' '}
          jabatan target lebih dulu, lalu yang kursinya kosong. Persempit dengan kata kunci kalau
          yang Anda cari belum terlihat.
        </p>
      </div>
    </Dialog>
  )
}
