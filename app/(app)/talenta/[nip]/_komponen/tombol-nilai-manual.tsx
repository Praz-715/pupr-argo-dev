'use client'

import { PencilLine } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { simpanNilaiManual } from '@/lib/aksi/skoring'
import type { RincianIndikator } from '@/lib/kueri/pegawai'
import { EditorBagian, type SpekBidang } from './editor-bagian'

/**
 * Isi nilai satu indikator secara manual, dengan **memilih kategori rubriknya**.
 *
 * **Kenapa memilih, bukan mengetik.** `simpanNilaiManual()` menolak nilai yang
 * tidak sama dengan salah satu nama kategori indikatornya — persis, setelah
 * dinormalkan spasi & huruf besar-kecil. Jadi kolom teks bebas di sini berarti
 * pengguna harus mengetik ulang kalimat sepanjang "Memiliki pengalaman jabatan
 * lintas Unit Organisasi/di luar Bina Konstruksi" tanpa salah satu huruf pun,
 * dan setiap salah ketik terbaca sebagai penolakan yang tidak jelas sebabnya.
 * Pilihannya diambil dari `rubrik_kategori_skor` di DB, jadi ia mengikuti rubrik
 * yang sedang berlaku — termasuk kalau pengguna menyuntingnya lewat editor rubrik.
 *
 * **Dua bentuk masukan, ditentukan rubriknya sendiri:**
 * - Kategori bernama (Tingkat Pendidikan, Keragaman Jabatan, Integritas, …) →
 *   **pemilih**, dengan nilainya ditampilkan di sebelah namanya seperti di
 *   `doc/KERANGKA TALENT POOL.md`.
 * - Kategori berambang angka (Potkom) atau indikator `NILAI_LANGSUNG` → **isian
 *   angka**, sebab yang dimasukkan adalah nilai mentahnya, bukan pilihan.
 *
 * Nilainya dikirim sebagai STRING, dan penerjemahan teks → skor tetap hanya
 * terjadi di satu tempat: rubrik. Yang berubah (11 Agu 2026, permintaan user)
 * adalah **kapan** itu dijalankan — `simpanNilaiManual()` sekarang merantai
 * Hitung Ulang sendiri, jadi skornya keluar seketika dan pesan suksesnya
 * menyebutkan angka jadinya. Sebelumnya pengguna melihat nilai mentahnya masuk
 * sementara skornya tetap 0,00, yang terbaca seperti simpan yang gagal separuh.
 */
export function TombolNilaiManual({
  rincian,
  pegawaiId,
  jabatanTargetId,
}: {
  rincian: RincianIndikator
  pegawaiId: number
  jabatanTargetId: number
}) {
  const [buka, setBuka] = useState(false)

  // Kategori berambang tidak bisa dipilih menurut namanya: yang menentukan
  // kategorinya adalah angkanya (Potkom ≥ 80 → "Memenuhi Syarat"), jadi yang
  // diminta tetap angka itu.
  const berambang = rincian.kategori.some((k) => k.ambangMin !== null)
  const bisaDipilih =
    rincian.modeSkor === 'KATEGORI_TETAP' && rincian.kategori.length > 0 && !berambang

  const bidang: SpekBidang[] = [
    bisaDipilih
      ? {
          jenis: 'pilih',
          kunci: 'nilaiMentah',
          label: 'Kategori rubrik',
          wajib: true,
          petunjuk: 'nilai mengikuti kategori yang dipilih',
          opsi: rincian.kategori.map((k) => ({
            nilai: k.nama,
            label: k.nilai === null ? k.nama : `${k.nama} — ${k.nilai}`,
          })),
        }
      : {
          // `teks`, bukan `angka`: `SkemaNilaiManual` menerima string, dan
          // `EditorBagian` mengirim `angka` sebagai Number — yang akan ditolak
          // Zod dengan "expected string", galat yang tidak menunjuk isian mana pun.
          jenis: 'teks',
          kunci: 'nilaiMentah',
          label: 'Nilai mentah',
          wajib: true,
          petunjuk: berambang ? 'angka — kategori ditentukan ambangnya' : 'angka 0–100',
        },
    {
      // Label lama "Dasar penilaian" tidak menjelaskan dirinya — pengguna
      // menanyakan maksudnya. Isinya adalah ALASAN & BUKTI kenapa kategori itu
      // yang dipilih, dan ia tersimpan bersama nama pengisinya. Wajib, karena
      // nilai manual adalah satu-satunya tempat penilaian jadi subjektif: tanpa
      // alasan tertulis, angkanya tidak bisa dipertanggungjawabkan ketika
      // keputusan suksesinya dipersoalkan (phase.md §9 no. 6).
      jenis: 'teks',
      kunci: 'catatan',
      label: 'Alasan & bukti',
      wajib: true,
      petunjuk: 'dokumen/SK yang jadi dasarnya — tersimpan bersama nama Anda',
    },
  ]

  return (
    <>
      <Button variant="halus" size="sm" onClick={() => setBuka(true)}>
        <PencilLine className="size-3.5" />
        Isi manual
      </Button>
      {buka ? (
        <EditorBagian
          judul={`Isi manual: ${rincian.namaIndikator}`}
          deskripsi={
            bisaDipilih
              ? 'Pilih kategori yang sesuai dengan berkas pegawai. Skor indikator langsung mengikuti nilai kategorinya, dan skor total serta peringkat pool ikut dihitung ulang.'
              : 'Masukkan nilai mentahnya. Kategori & skornya ditentukan rubrik, dihitung langsung setelah disimpan.'
          }
          bidang={bidang}
          awal={{
            nilaiMentah: rincian.nilaiMentah ?? '',
            catatan: '',
          }}
          tetap={{}}
          labelSimpan="Simpan nilai manual"
          simpan={(m) => simpanNilaiManual(jabatanTargetId, pegawaiId, rincian.rubrikIndikatorId, m)}
          onTutup={() => setBuka(false)}
        />
      ) : null}
    </>
  )
}
