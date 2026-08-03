'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { jalankanMutasi } from '../audit'
import { getCurrentUser } from '../auth'
import { eksekusi, kueriSatu } from '../db'
import { KUNCI_PENGATURAN } from '../pengaturan'
import { gerbangPeran } from './gerbang'
import { berhasil, gagal, galatDariZod, type HasilAksi } from './hasil'

/**
 * Ubah parameter sistem (PRD §6.10) — hanya Super Admin.
 *
 * **Batas nilainya ditegakkan di server dari kolom `nilai_min`/`nilai_max`**,
 * bukan dari `min`/`max` di `<input>`. Atribut HTML hanya menghalangi jari;
 * parameter yang lolos ke DB dengan nilai 0 akan membuat timeout sesi nol
 * menit — artinya tidak ada yang bisa masuk, termasuk yang mengubahnya.
 *
 * Yang TIDAK diizinkan: menambah kunci baru dari UI. Parameter yang tidak
 * dikenal `lib/pengaturan.ts` tidak dibaca kode mana pun, jadi ia hanya akan
 * jadi baris yang terlihat berpengaruh padahal tidak.
 */

const PERAN_PENGATURAN = ['Super Admin'] as const

const SkemaUbah = z.object({
  kunci: z.string().trim().min(1).max(60),
  nilai: z.string().trim().min(1, 'Nilai wajib diisi').max(255),
})

export async function ubahPengaturan(masukan: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_PENGATURAN)
  if (tolak) return tolak

  const urai = SkemaUbah.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const { kunci, nilai } = urai.data

  if (!(kunci in KUNCI_PENGATURAN)) {
    return gagal(
      `Parameter "${kunci}" tidak dikenali aplikasi, jadi mengubahnya tidak akan berpengaruh apa pun.`,
    )
  }

  const baris = await kueriSatu<{
    nilai: string
    tipe: string
    label: string
    nilai_min: number | null
    nilai_max: number | null
  }>('SELECT nilai, tipe, label, nilai_min, nilai_max FROM pengaturan_sistem WHERE kunci = ?', [
    kunci,
  ])
  if (!baris) return gagal('Parameter tidak ditemukan di database.')

  if (baris.tipe === 'ANGKA') {
    const n = Number(nilai)
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return gagal(`${baris.label} harus berupa bilangan bulat.`, { nilai: 'Harus bilangan bulat.' })
    }
    if (baris.nilai_min !== null && n < Number(baris.nilai_min)) {
      return gagal(`${baris.label} minimal ${baris.nilai_min}.`, {
        nilai: `Minimal ${baris.nilai_min}.`,
      })
    }
    if (baris.nilai_max !== null && n > Number(baris.nilai_max)) {
      return gagal(`${baris.label} maksimal ${baris.nilai_max}.`, {
        nilai: `Maksimal ${baris.nilai_max}.`,
      })
    }
  }

  if (baris.nilai === nilai) {
    return berhasil(undefined, 'Nilainya sudah seperti itu — tidak ada yang diubah.')
  }

  const saya = await getCurrentUser()

  await jalankanMutasi({
    entitas: 'pengaturan_sistem',
    aksi: 'UBAH',
    peranDiizinkan: PERAN_PENGATURAN,
    sebelum: async () => ({ kunci, nilai: baris.nilai }),
    jalankan: async () => {
      await eksekusi(
        'UPDATE pengaturan_sistem SET nilai = ?, diubah_oleh = ?, diubah_pada = NOW() WHERE kunci = ?',
        [nilai, saya?.id ?? null, kunci],
      )
      return { entitasId: null, sesudah: { kunci, nilai } }
    },
  })

  revalidatePath('/admin/pengaturan')

  // Masa berlaku asesmen menentukan siapa yang lolos syarat. Angkanya berubah
  // sekarang, tapi isi `match_score` masih hasil hitungan dengan angka lama —
  // dan halaman kandidat membaca dari sana. Dikatakan terus terang di sini,
  // bukan dibiarkan jadi selisih yang ditemukan orang minggu depan.
  const catatan =
    kunci === 'masa_berlaku_asesmen_tahun'
      ? ' Skor yang tersimpan masih memakai angka lama — jalankan Hitung Ulang di tiap jabatan target agar kelayakan kandidat ikut menyesuaikan.'
      : ''

  return berhasil(undefined, `${baris.label} diubah jadi ${nilai}.${catatan}`)
}
