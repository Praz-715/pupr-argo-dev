/**
 * Keadaan integrasi tiap sumber data — **fakta KODE, bukan isi tabel.**
 *
 * **Kenapa ini perlu ada.** Halaman Konsolidasi & Sinkronisasi Data meringkas
 * `sync_log`, dan `sync_log` memuat baris benih dev untuk sistem yang belum
 * pernah kita sambungkan. Akibatnya halaman itu memasang centang hijau **SUKSES**
 * untuk eKinerja — padahal tidak ada satu pun klien eKinerja di seluruh kode,
 * jadi tidak mungkin ada sinkronisasi yang pernah berjalan. Dilaporkan user
 * (12 Agu 2026) dengan pertanyaan yang tepat: "eKinerja belum dapet kan, kenapa
 * dia sukses?"
 *
 * Status "pernah sukses" tidak bisa disimpulkan dari data, sebab data benih
 * bentuknya sama persis dengan data sungguhan. Yang membedakan hanya satu hal
 * yang tidak ada di tabel: **apakah jalurnya ada di kode.** Karena itu ia
 * dideklarasikan di sini, satu tempat, dan bukan ditebak dari tanggal atau
 * jumlah baris.
 *
 * **Konsekuensi yang dipakai UI:** untuk sumber tanpa jalur, SELURUH baris
 * `sync_log`-nya adalah data contoh — tidak perlu menebak baris mana yang nyata,
 * karena tidak ada kode yang bisa menulisnya.
 *
 * **Wajib diperbarui begitu sebuah integrasi benar-benar dibuat.** Uji
 * kelengkapan di `sumber-data.test.ts` menjaga setiap nilai enum
 * `sync_log.sumber_sistem` punya entri di sini, tapi tidak ada yang bisa
 * memaksa nilainya jujur selain orang yang menambahkan klien barunya.
 */

/** Nilai enum `sync_log.sumber_sistem` di `doc/sql/001_schema.sql`. */
export const SUMBER_SISTEM = ['eHRM', 'eNominasi', 'eKinerja', 'Manual'] as const

export type SumberSistem = (typeof SUMBER_SISTEM)[number]

export type KeadaanIntegrasi = 'TERINTEGRASI' | 'BELUM_ADA_JALUR'

export interface ProfilSumber {
  keadaan: KeadaanIntegrasi
  /** Di mana jalurnya hidup — atau apa yang belum ada. Tampil di UI. */
  jalur: string
}

const PROFIL: Record<SumberSistem, ProfilSumber> = {
  eNominasi: {
    keadaan: 'TERINTEGRASI',
    jalur: 'lib/enom · npm run sinkron:enom',
  },
  Manual: {
    // Bukan integrasi mesin, tapi jalurnya nyata: orang mengisi lewat UI dan
    // mutasinya berjejak. Menandainya "belum ada jalur" akan salah ke arah
    // sebaliknya — seolah input manual pun tidak berfungsi.
    keadaan: 'TERINTEGRASI',
    jalur: 'diisi manusia lewat aplikasi',
  },
  eHRM: {
    keadaan: 'BELUM_ADA_JALUR',
    jalur: 'belum ada klien di kode',
  },
  eKinerja: {
    keadaan: 'BELUM_ADA_JALUR',
    jalur: 'belum ada klien di kode',
  },
}

/**
 * Profil satu sumber. Sumber yang tidak dikenal dijawab **BELUM_ADA_JALUR** —
 * gagal ke arah yang aman: lebih baik menyatakan "belum ada jalur" untuk sesuatu
 * yang ternyata ada daripada memasang centang sukses untuk yang tidak ada.
 */
export function profilSumber(sumber: string): ProfilSumber {
  return (
    PROFIL[sumber as SumberSistem] ?? {
      keadaan: 'BELUM_ADA_JALUR',
      jalur: 'sumber tidak dikenal',
    }
  )
}

export function sudahTerintegrasi(sumber: string): boolean {
  return profilSumber(sumber).keadaan === 'TERINTEGRASI'
}
