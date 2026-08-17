'use client'

import { useState, useTransition } from 'react'

import { Bidang, kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import type { HasilAksi } from '@/lib/aksi/hasil'

/**
 * Dialog isian **deklaratif** untuk seluruh bagian profil pegawai.
 *
 * **Kenapa satu komponen, bukan enam form.** Profil punya enam permukaan tulis
 * (identitas · pendidikan · riwayat jabatan · diklat · kinerja · asesmen). Form
 * di aplikasi ini sudah pernah disalin ke lima berkas dengan isi yang praktis
 * sama — itu sebabnya `Bidang` diangkat ke `components/ui` di Fase 7. Menambah
 * enam salinan lagi berarti enam tempat yang bisa lupa memasang `role="alert"`,
 * lupa menampilkan pending state, atau menangani galat per-field dengan cara
 * yang berbeda. Di sini yang berbeda antar bagian hanya **daftar bidangnya** dan
 * **server action mana yang dipanggil**; sisanya satu implementasi.
 *
 * Yang TIDAK dilakukan komponen ini: memvalidasi. Batas panjang, rentang angka,
 * dan format tanggal semuanya ditegakkan Zod di server (`lib/aksi/profil.ts`).
 * Memvalidasi di sini juga berarti dua aturan yang harus sepakat, dan yang di
 * klien bisa dilewati siapa pun — jadi ia hanya menambah tempat untuk salah,
 * bukan menambah keamanan. `type="number"`/`type="date"` dipakai murni sebagai
 * bantuan pengetikan.
 */

export type SpekBidang =
  | {
      jenis: 'teks' | 'tanggal' | 'angka'
      kunci: string
      label: string
      wajib?: boolean
      petunjuk?: string
      /** Diteruskan ke `<input type="number">`; mis. `'0.01'` untuk nilai berdesimal. */
      langkah?: string
    }
  | {
      jenis: 'pilih'
      kunci: string
      label: string
      wajib?: boolean
      petunjuk?: string
      opsi: ReadonlyArray<{ nilai: string; label: string }>
      /** Izinkan "— tidak diisi —" sebagai pilihan sah (mengirim `null`). */
      bolehKosong?: boolean
      /**
       * Kirim sebagai NOMOR, bukan string. Wajib untuk pemilih ber-id (mis.
       * `jabatanId`): tanpa ini nilainya sampai ke Zod sebagai `"7"` dan ditolak
       * dengan "expected number" — pesan yang tidak menunjuk isian mana pun,
       * padahal pengguna sudah memilih dengan benar.
       */
      angka?: boolean
    }

export function EditorBagian({
  judul,
  deskripsi,
  bidang,
  awal,
  tetap,
  labelSimpan = 'Simpan',
  simpan,
  onTutup,
}: {
  judul: string
  deskripsi?: string
  bidang: readonly SpekBidang[]
  /** Nilai awal per kunci, sebagai STRING — sama seperti isi `<input>`. */
  awal: Record<string, string>
  /** Nilai yang ikut dikirim tapi tidak ditampilkan, mis. `pegawaiId` & `id`. */
  tetap: Record<string, unknown>
  labelSimpan?: string
  simpan: (masukan: unknown) => Promise<HasilAksi<unknown>>
  onTutup: () => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})
  const [nilai, setNilai] = useState<Record<string, string>>(() =>
    Object.fromEntries(bidang.map((b) => [b.kunci, awal[b.kunci] ?? ''])),
  )

  function kirim() {
    setGalat({})

    const muatan: Record<string, unknown> = { ...tetap }
    for (const b of bidang) {
      const mentah = (nilai[b.kunci] ?? '').trim()

      if (b.jenis === 'angka' || (b.jenis === 'pilih' && b.angka)) {
        // `''` → null, BUKAN 0. Angka nol adalah nilai yang bermakna (nilai
        // kinerja 0 berbeda dari "belum diisi"), jadi mengubah kosong menjadi 0
        // akan menyimpan data yang tidak pernah dimasukkan siapa pun.
        muatan[b.kunci] = mentah === '' ? null : Number(mentah)
      } else if (b.wajib) {
        // Bidang wajib dikirim apa adanya supaya pesan galatnya datang dari Zod
        // (mis. "Nama minimal 3 karakter"), bukan dari `null` yang menghasilkan
        // "expected string" — pesan yang tidak memberi tahu apa pun ke pengguna.
        muatan[b.kunci] = mentah
      } else {
        muatan[b.kunci] = mentah === '' ? null : mentah
      }
    }

    mulaiTransisi(async () => {
      const hasil = await simpan(muatan)
      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Tersimpan.' })
        onTutup()
      } else {
        setGalat(hasil.galatField ?? {})
        // Galat per-field sudah tampil di sebelah isiannya; toast tambahan hanya
        // mengulanginya. Toast dipakai justru untuk galat yang TIDAK punya
        // field — kalau tidak, penolakan seperti "sesi berakhir" tidak terlihat
        // sama sekali.
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
      judul={judul}
      deskripsi={deskripsi}
      lebar="lg"
      aksi={
        <>
          <Button variant="halus" onClick={onTutup} disabled={pending}>
            Batal
          </Button>
          <Button onClick={kirim} pending={pending}>
            {labelSimpan}
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {bidang.map((b) => (
          <Bidang
            key={b.kunci}
            label={b.label}
            wajib={b.wajib}
            keterangan={b.petunjuk}
            galat={galat[b.kunci]}
          >
            {b.jenis === 'pilih' ? (
              <select
                value={nilai[b.kunci] ?? ''}
                onChange={(e) => setNilai((v) => ({ ...v, [b.kunci]: e.target.value }))}
                className={kelasInput(galat[b.kunci])}
              >
                {/**
                 * Pemilih WAJIB tetap punya opsi berlabel, bernilai `''`.
                 *
                 * Tanpa itu `<select value="">` tidak menemukan `<option>` yang
                 * cocok, dan browser menampilkan **opsi pertama** sementara
                 * state-nya masih kosong. Untuk Pengembangan Kompetensi opsi
                 * pertama itu bernilai **100**: layar memperlihatkan nilai
                 * tertinggi seolah sudah terpilih, lalu Simpan ditolak "tidak
                 * boleh kosong" — dan pengguna tidak punya cara menebak apa yang
                 * salah, karena pilihannya jelas terlihat di sana.
                 *
                 * Kenapa placeholder, BUKAN menjadikan opsi pertama default:
                 * indikator ini menentukan skor, dan opsi pertama di rubrik
                 * selalu yang bernilai paling tinggi. Default seperti itu berarti
                 * nilai maksimum bisa tersimpan tanpa seseorang pernah memutuskan
                 * apa pun — cukup menekan Simpan. `disabled` supaya ia tidak bisa
                 * dipilih balik setelah pengguna memilih.
                 */}
                {b.bolehKosong ? (
                  <option value="">— tidak diisi —</option>
                ) : (
                  <option value="" disabled>
                    — pilih —
                  </option>
                )}
                {b.opsi.map((o) => (
                  <option key={o.nilai} value={o.nilai}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={b.jenis === 'tanggal' ? 'date' : b.jenis === 'angka' ? 'number' : 'text'}
                step={b.jenis === 'angka' ? (b.langkah ?? '1') : undefined}
                value={nilai[b.kunci] ?? ''}
                onChange={(e) => setNilai((v) => ({ ...v, [b.kunci]: e.target.value }))}
                className={kelasInput(galat[b.kunci])}
              />
            )}
          </Bidang>
        ))}
      </div>
    </Dialog>
  )
}
