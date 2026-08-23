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

  /*
    Ambang Kotak 9 punya SYARAT ANTAR-BARIS, bukan cuma min/max sendiri.

    `atas` harus di atas `tengah`. Kalau tidak, kategori tengah jadi wilayah
    kosong — `CASE` SQL dan `klasifikasiSumbuX/Y()` sama-sama memakai cabang
    pertama yang cocok, jadi begitu `tengah >= atas` tidak akan ada satu pun
    pegawai yang bisa masuk kategori tengah, dan seluruh kolom tengah Kotak 9
    mengosong. Batas per baris tidak bisa menangkap ini: 60 dan 80 dua-duanya sah
    sendiri-sendiri, yang tidak sah adalah pasangannya.

    Diperiksa di sini — di satu-satunya jalur yang boleh mengubah nilainya —
    bukan di jalur baca. `ambangSumbuDari()` memang ikut berjaga dengan jatuh ke
    bawaan, tapi itu jaring terakhir untuk baris yang diubah lewat SQL langsung;
    membiarkan UI menyimpan pasangan mustahil lalu diam-diam mengabaikannya
    berarti Super Admin melihat 90 tersimpan sementara sistem memakai 80.
  */
  const PASANGAN_AMBANG: Record<string, { lawan: string; harus: 'lebih' | 'kurang' }> = {
    ambang_sumbu_atas: { lawan: 'ambang_sumbu_tengah', harus: 'lebih' },
    ambang_sumbu_tengah: { lawan: 'ambang_sumbu_atas', harus: 'kurang' },
  }
  const pasangan = PASANGAN_AMBANG[kunci]
  if (pasangan) {
    const lawan = await kueriSatu<{ nilai: string }>(
      'SELECT nilai FROM pengaturan_sistem WHERE kunci = ?',
      [pasangan.lawan],
    )
    const nilaiLawan = Number(lawan?.nilai)
    const n = Number(nilai)
    if (Number.isFinite(nilaiLawan)) {
      const sah = pasangan.harus === 'lebih' ? n > nilaiLawan : n < nilaiLawan
      if (!sah) {
        const arah = pasangan.harus === 'lebih' ? 'lebih besar' : 'lebih kecil'
        return gagal(
          `${baris.label} harus ${arah} daripada ambang pasangannya (sekarang ${nilaiLawan}). ` +
            'Kalau ambang atas tidak lebih tinggi daripada ambang tengah, kategori tengah ' +
            'Kotak 9 jadi kosong dan setiap pegawai jatuh ke kategori teratas atau terbawah.',
          { nilai: `Harus ${arah} dari ${nilaiLawan}.` },
        )
      }
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
  const PERLU_HITUNG_ULANG: Record<string, string> = {
    masa_berlaku_asesmen_tahun:
      ' Skor yang tersimpan masih memakai angka lama — jalankan Hitung Ulang di tiap jabatan target agar kelayakan kandidat ikut menyesuaikan.',
    // Ambang menentukan `asesmen_talenta.kotak_9` yang TERSIMPAN. Tampilan per
    // jabatan target menghitung kotaknya di SQL sehingga ikut berubah seketika,
    // sedangkan sebaran organisasi membaca kolom tersimpan — jadi tanpa hitung
    // ulang, dua halaman akan menempatkan orang yang sama di kotak berbeda.
    ambang_sumbu_atas:
      ' Kotak 9 yang tersimpan di data asesmen masih memakai ambang lama. Jalankan Hitung Ulang di tiap jabatan target, dan `npm run db:recompute` untuk menyegarkan kolom kotak_9 — sampai itu dilakukan, sebaran organisasi dan tampilan per jabatan target bisa berbeda.',
    ambang_sumbu_tengah:
      ' Kotak 9 yang tersimpan di data asesmen masih memakai ambang lama. Jalankan Hitung Ulang di tiap jabatan target, dan `npm run db:recompute` untuk menyegarkan kolom kotak_9 — sampai itu dilakukan, sebaran organisasi dan tampilan per jabatan target bisa berbeda.',
  }
  const catatan = PERLU_HITUNG_ULANG[kunci] ?? ''

  return berhasil(undefined, `${baris.label} diubah jadi ${nilai}.${catatan}`)
}
