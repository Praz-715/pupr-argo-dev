import bcrypt from 'bcryptjs'

/**
 * Hash & pemeriksaan sandi, plus kebijakan sandi.
 *
 * Modul ini **bebas DB dan bebas Next** supaya bisa diuji murni — kebijakan
 * sandi adalah aturan yang mudah salah dan mahal kalau salah, jadi ia harus
 * bisa diuji tanpa menyalakan apa pun.
 *
 * bcrypt dipakai (bukan SHA-256 seperti token sesi) karena sandi **bisa
 * ditebak**: ia pendek, dipilih manusia, dan sering dipakai ulang. Fungsi yang
 * sengaja lambat adalah satu-satunya pertahanan setelah isi tabel bocor.
 * Kebalikannya berlaku untuk token sesi — lihat catatan di `doc/sql/012`.
 */

/**
 * bcrypt hanya memakai **72 byte pertama**; sisanya diabaikan tanpa peringatan.
 * Artinya dua sandi yang berbeda setelah karakter ke-72 akan lolos sebagai
 * sandi yang sama. Bukan celah besar (siapa yang memakai sandi 80 karakter),
 * tapi ia diam — jadi ditolak di depan, bukan dibiarkan lewat.
 */
export const PANJANG_MAKS_SANDI = 72

/**
 * Panjang minimal. Mengikuti arah NIST SP 800-63B: panjang lebih menentukan
 * daripada campuran karakter, dan aturan "wajib ada simbol" justru mendorong
 * pola yang seragam (`Password1!`). Yang ditegakkan di sini panjangnya, plus
 * penolakan atas sandi yang jelas-jelas tebakan pertama.
 */
export const PANJANG_MIN_SANDI = 10

/**
 * Daftar pendek, sengaja tidak panjang. Blocklist besar (jutaan entri) adalah
 * pekerjaan layanan tersendiri; yang ini hanya menangkap tebakan pertama —
 * termasuk `password123` yang jadi sandi akun seed dev, supaya ia tidak pernah
 * ikut ke produksi lewat "sudah jalan di dev".
 */
const SANDI_TERLARANG = new Set([
  'password',
  'password1',
  'password12',
  'password123',
  'passw0rd123',
  'qwerty12345',
  'admin12345',
  'administrator',
  '1234567890',
  '12345678901',
  'iloveyou123',
  'rahasia123',
  'sandi12345',
  'djbk123456',
  'pupr123456',
])

export interface KonteksSandi {
  username?: string
  email?: string
  nama?: string
}

/**
 * Periksa kebijakan. Mengembalikan pesan galat atau `null` kalau lolos.
 *
 * Pesannya ditulis untuk dibaca pengguna, bukan kode galat — form sandi adalah
 * tempat orang paling sering menyerah kalau tidak diberi tahu apa yang kurang.
 */
export function periksaKebijakanSandi(sandi: string, konteks: KonteksSandi = {}): string | null {
  if (sandi.length < PANJANG_MIN_SANDI) {
    return `Sandi minimal ${PANJANG_MIN_SANDI} karakter (sekarang ${sandi.length}).`
  }

  // Diukur dalam BYTE, bukan karakter: satu emoji atau huruf beraksen memakan
  // lebih dari satu byte, jadi sandi 40 karakter bisa saja melewati 72 byte.
  const byte = new TextEncoder().encode(sandi).length
  if (byte > PANJANG_MAKS_SANDI) {
    return `Sandi terlalu panjang (${byte} byte, maksimal ${PANJANG_MAKS_SANDI}). Karakter setelah batas itu diabaikan oleh algoritma hash, jadi tidak menambah keamanan.`
  }

  if (sandi.trim().length === 0) {
    return 'Sandi tidak boleh hanya berisi spasi.'
  }

  if (SANDI_TERLARANG.has(sandi.toLowerCase())) {
    return 'Sandi ini terlalu umum dan ada di daftar tebakan pertama. Pilih yang lain.'
  }

  const kecil = sandi.toLowerCase()
  const username = konteks.username?.toLowerCase().trim()
  const lokalEmail = konteks.email?.toLowerCase().split('@')[0]?.trim()

  if (username && username.length >= 3 && kecil.includes(username)) {
    return 'Sandi tidak boleh memuat username Anda.'
  }
  if (lokalEmail && lokalEmail.length >= 3 && kecil.includes(lokalEmail)) {
    return 'Sandi tidak boleh memuat alamat email Anda.'
  }

  // Satu jenis karakter saja (semua huruf / semua angka) membuat panjang jadi
  // tidak berarti banyak: "aaaaaaaaaaaa" lolos ambang panjang tapi tidak
  // menambah apa pun. Yang diminta cuma dua jenis, bukan empat.
  const jenis = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter((r) => r.test(sandi)).length
  if (jenis < 2) {
    return 'Gabungkan minimal dua jenis karakter (huruf, angka, atau simbol).'
  }

  return null
}

/** Biaya bcrypt. 10 = ±60 ms di server biasa — cukup lambat untuk penyerang, tidak terasa saat login. */
const BIAYA_BCRYPT = 10

export async function hashSandi(sandi: string): Promise<string> {
  return bcrypt.hash(sandi, BIAYA_BCRYPT)
}

/**
 * Periksa sandi terhadap hash. **Tidak pernah melempar** — hash yang rusak atau
 * kosong di DB harus berarti "sandi salah", bukan halaman error yang memberi
 * tahu penyerang bahwa akun itu istimewa.
 */
export async function cocokkanSandi(sandi: string, hash: string | null): Promise<boolean> {
  if (!hash) {
    // Tetap bakar waktu yang mirip supaya "akun tidak ada" dan "sandi salah"
    // tidak bisa dibedakan dari lamanya balasan.
    await bcrypt.hash(sandi, BIAYA_BCRYPT)
    return false
  }
  try {
    return await bcrypt.compare(sandi, hash)
  } catch {
    return false
  }
}
