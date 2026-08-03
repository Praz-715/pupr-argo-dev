import 'server-only'

import { getCurrentUser } from '../auth'
import { punyaPeran, type Peran, type PenggunaAktif } from '../peran'
import { gagal, type HasilAksi } from './hasil'

/**
 * Gerbang peran yang **tidak melempar** — pasangan `assertPeran()` untuk dipakai
 * sebagai **baris pertama** server action.
 *
 * ## Kenapa ini ada
 *
 * `jalankanMutasi()` sudah memeriksa peran, dan `lib/audit.ts` menuliskan
 * aturannya sendiri dengan tegas:
 *
 * > "Urutannya penting: periksa peran dulu, baru baca keadaan sebelum, baru
 * >  tulis. Membaca dulu berarti pengguna tanpa wewenang tetap bisa memancing
 * >  isi baris lewat pesan error."
 *
 * Masalahnya, pemeriksaan itu terjadi **di dalam** `jalankanMutasi()`, sedangkan
 * hampir semua aksi perlu membaca keadaan lebih dulu untuk menyusun penolakan
 * yang berguna ("masih ditempati 3 pegawai aktif"). Kode di atas pemanggilan
 * `jalankanMutasi()` karena itu berjalan **sebelum** peran diperiksa, dan
 * balasannya berbeda-beda tergantung isi database — yang berarti siapa pun yang
 * punya sesi bisa membedakan "baris itu ada" dari "Anda tidak berhak", lalu
 * memakai bedanya untuk mencacah. Beberapa penolakan bahkan menyebut **nama
 * pegawai** dan hitungan.
 *
 * Gerbang ini menutupnya tanpa mengorbankan kualitas pesan penolakan: yang
 * dipindah ke depan cuma pemeriksaan perannya, bukan pembacaannya.
 *
 * ## Kenapa mengembalikan nilai, bukan melempar
 *
 * Kontrak server action di sini adalah **tidak melempar untuk kesalahan yang
 * wajar** (`lib/aksi/hasil.ts`) — melempar mengganti seluruh halaman lewat error
 * boundary, padahal yang dibutuhkan cuma satu pesan. Wewenang kurang termasuk
 * kesalahan wajar: ia terjadi setiap kali seseorang membuka tautan yang dikirim
 * rekannya yang berperan lain.
 *
 * ## Pemakaian
 *
 * ```ts
 * const tolak = await gerbangPeran(PERAN_MASTER_JABATAN)
 * if (tolak) return tolak
 * ```
 *
 * `null` berarti lolos. Bentuk ini dipilih supaya penambahannya **dua baris di
 * atas kode yang sudah ada**, tanpa mengubah alur di bawahnya — 20-an aksi yang
 * disunting sekaligus punya peluang lebih kecil untuk salah kalau perubahannya
 * seragam dan sesempit mungkin.
 *
 * Daftar peran WAJIB memakai konstanta yang sama dengan yang diteruskan ke
 * `peranDiizinkan` pada `jalankanMutasi()` di bawahnya. Kalau keduanya berselisih,
 * `jalankanMutasi()` tetap jadi penegak terakhir — gerbang ini mempercepat
 * penolakan, ia bukan pengganti.
 */
export async function gerbangPeran(
  diizinkan: readonly Peran[],
): Promise<HasilAksi<never> | null> {
  const pengguna = await getCurrentUser()

  if (!pengguna) {
    return gagal('Sesi Anda sudah berakhir. Masuk lagi lalu ulangi.')
  }
  if (!punyaPeran(pengguna, diizinkan)) {
    return gagal(
      `Peran Anda (${pengguna.peran}) tidak berwenang melakukan ini. Dibutuhkan salah satu: ${diizinkan.join(', ')}.`,
    )
  }
  return null
}

/**
 * Varian yang sekalian mengembalikan penggunanya, untuk aksi yang memang
 * membutuhkannya (mis. memeriksa "apakah ini akun saya sendiri").
 *
 * Menghindari `getCurrentUser()` dipanggil dua kali — `bacaSesi()` memang
 * ber-`cache()` per permintaan, jadi biayanya nol, tapi dua pemanggilan untuk
 * satu pertanyaan membuat pembacanya ragu apakah keduanya bisa berbeda.
 */
export async function gerbangPenggunaPeran(
  diizinkan: readonly Peran[],
): Promise<{ tolak: HasilAksi<never>; pengguna: null } | { tolak: null; pengguna: PenggunaAktif }> {
  const pengguna = await getCurrentUser()

  if (!pengguna) {
    return { tolak: gagal('Sesi Anda sudah berakhir. Masuk lagi lalu ulangi.'), pengguna: null }
  }
  if (!punyaPeran(pengguna, diizinkan)) {
    return {
      tolak: gagal(
        `Peran Anda (${pengguna.peran}) tidak berwenang melakukan ini. Dibutuhkan salah satu: ${diizinkan.join(', ')}.`,
      ),
      pengguna: null,
    }
  }
  return { tolak: null, pengguna }
}
