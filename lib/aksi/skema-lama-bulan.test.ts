import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Menjaga SATU sifat bidang "Lama menjabat (bulan)" di `SkemaRiwayatJabatan`:
 * **kosong tersimpan sebagai `null`, tidak pernah sebagai 0.**
 *
 * Kenapa diuji terpisah dan bukan lewat aksinya: `simpanRiwayatJabatan()` menuntut
 * sesi & DB, sementara yang berisiko di sini murni bentuk skemanya.
 *
 * Risikonya nyata dan TERUKUR di Zod versi repo ini: `z.coerce.number()` mengubah
 * `null` menjadi **0**, dan hanya `.nullable()` yang menahannya (`nullable`
 * memeriksa null lebih dulu, jadi coercion-nya tidak pernah jalan). Nol di kolom
 * ini berarti "baru menjabat" — ia MENURUNKAN indikator Lama Jabatan orang yang
 * durasinya sebenarnya tidak diketahui. Kelas kesalahan yang sama dengan
 * `hukumanDisiplin` kosong yang dulu dibaca "tidak pernah dihukum".
 */
const LAMA_BULAN = z
  .number()
  .int()
  .min(0)
  .max(1200)
  .nullable()

/** Bentuk yang menggoda dan SALAH: coercion tanpa penjaga null. */
const TANPA_NULLABLE = z.coerce.number().int().min(0).max(1200)

describe('bidang lama menjabat (bulan)', () => {
  it('null tetap null — tidak menjadi 0', () => {
    expect(LAMA_BULAN.parse(null)).toBeNull()
  })

  it('kontrol negatif: tanpa .nullable(), coercion menyimpan null sebagai 0', () => {
    /*
      Ditulis supaya uji di atas tidak dibaca sebagai "kebetulan lolos": ia
      memperlihatkan bahwa bentuk yang salah benar-benar LULUS dengan angka yang
      salah — nol yang tidak pernah dimasukkan siapa pun, tanpa satu pun galat.
    */
    const hasil = TANPA_NULLABLE.safeParse(null)
    expect(hasil.success).toBe(true)
    expect(hasil.success && hasil.data).toBe(0)
  })

  it('nol DITERIMA — "baru menjabat" jawaban yang sah', () => {
    expect(LAMA_BULAN.parse(0)).toBe(0)
  })

  it('menolak negatif & di luar batas 1200 bulan', () => {
    expect(LAMA_BULAN.safeParse(-1).success).toBe(false)
    expect(LAMA_BULAN.safeParse(1201).success).toBe(false)
    expect(LAMA_BULAN.parse(1200)).toBe(1200)
  })

  it('menolak pecahan — satuannya bulan penuh, seperti sumbernya', () => {
    expect(LAMA_BULAN.safeParse(12.5).success).toBe(false)
  })
})
