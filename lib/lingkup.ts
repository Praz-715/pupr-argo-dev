import { PERAN_TERBATAS_UNIT, type PenggunaAktif } from './peran'

/**
 * Pembatasan data per unit organisasi (PRD §3: Pengelola Unit = "data unitnya").
 *
 * **Kenapa ini modul tersendiri dan bukan `if` di tiap halaman.** Aturannya
 * pendek, tapi ia harus sama persis di sembilan halaman, di setiap server
 * action, dan nanti di `api/v1`. Aturan pendek yang disalin sembilan kali
 * adalah aturan yang akan berbeda di tempat kesembilan — dan bedanya tidak
 * menimbulkan galat apa pun, hanya satu halaman yang memperlihatkan pegawai
 * unit lain kepada orang yang tidak berhak melihatnya.
 *
 * Modul ini **murni**: tidak menyentuh DB, tidak `server-only`. Penegakannya
 * di SQL (lihat `lib/kueri/dasar.ts` → `SUBKUERI_UNIT_TURUNAN`); yang ada di
 * sini keputusannya, supaya bisa diuji tanpa database dan dipakai juga oleh
 * komponen klien yang perlu menjelaskan batasannya kepada pengguna.
 */

export type Lingkup =
  /** Boleh melihat seluruh pegawai. */
  | { jenis: 'SEMUA' }
  /** Dibatasi ke satu unit beserta SELURUH TURUNANNYA. */
  | { jenis: 'UNIT'; unitId: number; namaUnit: string | null }
  /** Tidak boleh melihat apa pun, beserta alasannya. */
  | { jenis: 'NIHIL'; alasan: string }

/**
 * Lingkup data seorang pengguna.
 *
 * **Gagal tertutup, bukan gagal terbuka.** Pengelola Unit tanpa unit adalah
 * data yang salah (kolom `users.unit_organisasi_id` boleh NULL untuk pengguna
 * pusat), dan tebakan yang wajar — "ya sudah, tampilkan semua" — persis
 * kebalikan dari yang benar. Ia justru harus tidak melihat apa-apa sampai
 * Super Admin memberinya unit; halaman yang kosong dengan penjelasan akan
 * dilaporkan dalam sehari, kebocoran diam-diam tidak.
 */
export function lingkupData(pengguna: PenggunaAktif | null): Lingkup {
  if (!pengguna) return { jenis: 'NIHIL', alasan: 'Tidak ada pengguna aktif.' }

  if (!PERAN_TERBATAS_UNIT.includes(pengguna.peran)) return { jenis: 'SEMUA' }

  if (pengguna.unitOrganisasiId === null) {
    return {
      jenis: 'NIHIL',
      alasan:
        'Akun Anda berperan Pengelola Unit tetapi belum ditautkan ke unit organisasi mana pun, jadi belum ada data yang boleh ditampilkan. Minta Super Admin menetapkan unit Anda di Manajemen Pengguna.',
    }
  }

  return {
    jenis: 'UNIT',
    unitId: pengguna.unitOrganisasiId,
    namaUnit: pengguna.namaUnit,
  }
}

/**
 * Id unit yang WAJIB disaring, atau `null` kalau tidak ada pembatasan.
 *
 * Dipakai berdampingan dengan filter unit pilihan pengguna, **bukan
 * menggantikannya**: dua filter unit yang dipasang bersamaan menghasilkan
 * irisan dengan sendirinya. Pengelola Unit yang mengetik `?unit=` milik unit
 * lain di URL akan mendapat nol baris — bukan diam-diam dialihkan ke unitnya
 * sendiri, yang akan membuatnya mengira sedang melihat unit yang ia minta.
 */
export function unitWajib(lingkup: Lingkup): number | null {
  return lingkup.jenis === 'UNIT' ? lingkup.unitId : null
}

/** `true` kalau pengguna tidak boleh melihat baris apa pun. */
export function tanpaAkses(lingkup: Lingkup): lingkup is { jenis: 'NIHIL'; alasan: string } {
  return lingkup.jenis === 'NIHIL'
}

/**
 * Kalimat penjelas untuk ditempel di atas daftar yang tersaring.
 *
 * `null` kalau tidak ada pembatasan. Daftar yang disaring diam-diam adalah
 * daftar yang akan dibaca sebagai daftar lengkap — dan seseorang akan
 * menyimpulkan unitnya cuma punya 12 pegawai yang layak.
 */
export function ringkasLingkup(lingkup: Lingkup): string | null {
  if (lingkup.jenis !== 'UNIT') return null
  return lingkup.namaUnit
    ? `Dibatasi ke unit Anda: ${lingkup.namaUnit} (termasuk unit di bawahnya).`
    : 'Dibatasi ke unit Anda dan unit di bawahnya.'
}

/**
 * Boleh mengubah data pegawai di unit tertentu?
 *
 * Dipakai server action yang menyunting data pegawai. Sengaja menerima id unit
 * **efektif** (hasil kueri yang sudah menyertakan turunan), bukan menghitung
 * keturunan di sini — hierarki unit ada di database, dan menyalinnya ke memori
 * berarti punya dua pohon yang bisa berbeda.
 */
export function bolehSentuhUnit(lingkup: Lingkup, unitEfektifTerjangkau: boolean): boolean {
  if (lingkup.jenis === 'SEMUA') return true
  if (lingkup.jenis === 'NIHIL') return false
  return unitEfektifTerjangkau
}
