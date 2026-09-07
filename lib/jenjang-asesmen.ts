/**
 * Jenjang asesmen — nilai mentah dari sumber, dan tiga kelompok untuk dibaca.
 *
 * Permintaan pemilik proses (`koreksi sistem informasi.pdf`, butir 2): *"Nilai mentah
 * Potkom agar ditambahkan 3 jenis jenjang asesmen: Asesmen fungsional, Asesmen
 * Pengawas, Asesmen Administrator."*
 *
 * ## Kolomnya menyimpan yang SPESIFIK, tampilannya yang mengelompokkan
 *
 * `asesmen_talenta.jenjang_asesmen` menyimpan nilai apa adanya dari sumber
 * (ADMINISTRATOR, PENGAWAS, AHLI MADYA, AHLI MUDA, …). Peleburannya jadi tiga
 * kelompok ada di sini, satu tempat.
 *
 * Melebur di kolom akan membuang beda **AHLI MUDA vs AHLI MADYA** yang ada di
 * sumbernya dan tidak bisa dikembalikan — dan itu beda yang berarti: keduanya jenjang
 * fungsional yang berbeda, dengan potkom yang berbeda pula. Terukur di berkas
 * `Database Talenta Fungsional#binaka.xlsx`: 12 baris AHLI MADYA, 19 AHLI MUDA.
 *
 * ## Kenapa daftarnya eksplisit, bukan pola
 *
 * "Apa pun yang diawali AHLI berarti fungsional" akan benar hari ini dan diam-diam
 * salah pada jenjang berikutnya yang penamaannya tidak mengikuti pola itu. Daftar
 * yang eksplisit gagal dengan cara yang terlihat: jenjang tak dikenal mengembalikan
 * `null`, dan pemanggilnya menampilkannya apa adanya alih-alih salah mengelompokkan.
 */

/** Tiga kelompok yang diminta PDF, apa adanya. */
export const KELOMPOK_JENJANG = ['Fungsional', 'Pengawas', 'Administrator'] as const

export type KelompokJenjang = (typeof KELOMPOK_JENJANG)[number]

/**
 * Jenjang yang dikenal, beserta kelompoknya.
 *
 * Keempat yang pertama terbukti ada di data (`SELECT DISTINCT jenjang_asesmen`);
 * AHLI PERTAMA & AHLI UTAMA ditambahkan karena keduanya jenjang fungsional resmi yang
 * sudah muncul di kolom `jenis_asesmen` — jadi ia akan datang cepat atau lambat, dan
 * menunggunya muncul lebih dulu berarti satu impor yang mengelompokkannya sebagai
 * "tidak dikenal".
 */
export const JENJANG_ASESMEN: Array<{ nilai: string; kelompok: KelompokJenjang }> = [
  { nilai: 'ADMINISTRATOR', kelompok: 'Administrator' },
  { nilai: 'PENGAWAS', kelompok: 'Pengawas' },
  { nilai: 'AHLI UTAMA', kelompok: 'Fungsional' },
  { nilai: 'AHLI MADYA', kelompok: 'Fungsional' },
  { nilai: 'AHLI MUDA', kelompok: 'Fungsional' },
  { nilai: 'AHLI PERTAMA', kelompok: 'Fungsional' },
]

const PETA = new Map(JENJANG_ASESMEN.map((j) => [j.nilai.toUpperCase(), j.kelompok]))

/**
 * Kelompok sebuah jenjang, atau `null` kalau tidak dikenal.
 *
 * `null` **bukan** "bukan fungsional" — ia "belum diputuskan", dan pemanggilnya harus
 * menampilkan jenjangnya apa adanya, bukan menebak. Baris lama yang masuk sebelum
 * `doc/sql/022` juga `null` di kolomnya, dan itu berarti "tidak tercatat".
 */
export function kelompokJenjang(jenjang: string | null | undefined): KelompokJenjang | null {
  if (!jenjang) return null
  return PETA.get(jenjang.trim().toUpperCase()) ?? null
}

/**
 * Label siap tampil: "Ahli Madya (Fungsional)", "Administrator".
 *
 * Kelompok hanya disebut kalau ia menambah informasi — menulis
 * "Administrator (Administrator)" cuma kebisingan.
 */
export function labelJenjang(jenjang: string | null | undefined): string {
  if (!jenjang) return 'tidak tercatat'
  const rapi = jenjang
    .trim()
    .toLowerCase()
    .replace(/\b\p{L}/gu, (c) => c.toUpperCase())
  const k = kelompokJenjang(jenjang)
  return k === null || k.toLowerCase() === jenjang.trim().toLowerCase() ? rapi : `${rapi} (${k})`
}
