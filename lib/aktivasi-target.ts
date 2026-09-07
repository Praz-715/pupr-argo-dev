import 'server-only'

import { kueriSatu } from './db'
import { ambilPohonRubrik } from './kueri/rubrik'
import { validasiRubrik } from './scoring'

/**
 * Boleh tidaknya sebuah jabatan target diaktifkan — satu definisi, dua pemanggil.
 *
 * ## Kenapa dipisah dari server action
 *
 * `ubahStatusJabatanTarget()` di `lib/aksi/jabatan-target.ts` bergerbang
 * `gerbangPeran()` dan menulis jejak lewat `jalankanMutasi()`; keduanya menuntut
 * pengguna yang sudah masuk, jadi skrip tidak bisa memanggilnya. Alasan yang sama
 * dengan `lib/rubrik-salin.ts`.
 *
 * Dan menyalin aturannya ke dalam skrip adalah jawaban yang salah, sebab yang
 * dijaga di sini bukan kerapian melainkan **arti status AKTIF**: target AKTIF
 * ikut dihitung, muncul di pemilih Peta Talenta, dan peringkatnya dipakai
 * memutuskan orang. Target tanpa anggota tidak menunjuk kursi mana pun, dan
 * rubrik bercacat tetap menghasilkan angka yang wajar — `lib/scoring` sengaja
 * tidak melempar. Jadi jalur yang memakai gerbang lebih longgar tidak gagal, ia
 * hanya memajang peringkat yang salah tanpa satu pun tanda.
 *
 * Mengembalikan `null` kalau boleh, atau kalimat yang bisa dibaca pengguna.
 */
export async function halanganAktivasi(jabatanTargetId: number): Promise<string | null> {
  const [komponen, hitung] = await Promise.all([
    ambilPohonRubrik(jabatanTargetId),
    /*
      Kursinya dibaca dari `jabatan_target.jabatan_id` sejak `doc/sql/032`, BUKAN
      dari `jabatan_target_anggota` — tabel itu sekarang berisi daftar jabatan yang
      boleh DINOMINASIKAN, hal yang sama sekali berbeda. Kalau gerbang ini tetap
      menghitung anggota, target yang kursinya jelas tapi daftar sumbernya masih
      kosong (bawaan draft baru) akan ditolak aktivasi dengan alasan yang salah.
    */
    kueriSatu<{ kursi: number; syarat: number }>(
      `SELECT
         (SELECT COUNT(*) FROM jabatan_target WHERE id = ? AND jabatan_id IS NOT NULL) AS kursi,
         (SELECT COUNT(*) FROM jabatan_target_persyaratan WHERE jabatan_target_id = ?) AS syarat`,
      [jabatanTargetId, jabatanTargetId],
    ),
  ])

  if (Number(hitung?.kursi ?? 0) === 0) {
    return 'Jabatan target ini belum menunjuk kursi mana pun di master jabatan. Buat ulang dari halaman Jabatan Target dengan memilih jabatannya, atau hubungi Admin Talenta.'
  }

  const hasil = validasiRubrik(komponen, { untukJabatanTarget: true })
  if (!hasil.bisaDiaktifkan) {
    const pertama = hasil.temuan.find((t) => t.tingkat === 'GALAT')
    return `Rubrik masih punya ${hasil.jumlahGalat} galat sehingga skornya akan salah. Yang pertama: ${pertama?.nama} — ${pertama?.pesan} ${pertama?.saran}`
  }

  return null
}
