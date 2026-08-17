import { z } from 'zod'

/**
 * Bentuk balasan `POST /enom/api/cekdata_bikon` di karir.pu.go.id.
 *
 * Skemanya diturunkan dari balasan NYATA yang diamati, bukan dari dokumen —
 * sampai hari ini belum ada spesifikasi tertulis untuk endpoint ini. Karena itu
 * dua sikap yang disengaja:
 *
 *   1. **Semua angka datang sebagai STRING** (`"3.25"`, `"130.729166925"`,
 *      `"9"`). Itu apa adanya dari sumber; jangan "dirapikan" di skema — kalau
 *      suatu hari sumber mengirim number, `z.coerce` di sini akan menerima
 *      keduanya tanpa ada yang perlu disunting.
 *   2. **`.passthrough()`** — field baru dari sumber TIDAK boleh membuat
 *      seluruh sinkronisasi gagal. Yang kita butuhkan divalidasi ketat;
 *      sisanya dibiarkan lewat.
 */

/** Satu baris asesmen milik satu pegawai. */
export const SkemaRekamanEnom = z
  .object({
    nip: z.string().min(1),
    nama_pegawai: z.string().optional(),
    jenjang: z.string().nullish(),
    jenis_asesmen: z.string().nullish(),
    tahun_asesmen: z.coerce.number().int(),
    nilai_integritas: z.coerce.number().nullish(),
    nilai_potkom: z.coerce.number(),
    tahun_kinerja: z.coerce.number().int().nullish(),
    predikat_kinerja: z.string().nullish(),
    /**
     * Kotak 9 versi sumber. **Pembanding, bukan kebenaran** — `kotak_9` di DB
     * selalu hasil hitung (`doc/sql/009_kolom_pembanding.sql`).
     */
    kotak: z.coerce.number().int().nullish(),
    /** Sumber mencatat IP & waktu pemanggil — lihat catatan privasi di klien.ts. */
    infoip: z.string().nullish(),
    waktu_ambil: z.string().nullish(),
  })
  .passthrough()

export type RekamanEnom = z.infer<typeof SkemaRekamanEnom>

/**
 * Amplop balasan. `status:false` dipakai sumber untuk galat yang tetap
 * berkode HTTP 200 **maupun** 401 — jadi kode HTTP saja tidak cukup untuk
 * menyimpulkan berhasil, dan klien memeriksa keduanya.
 */
export const SkemaBalasanEnom = z.object({
  status: z.boolean(),
  message: z.string().optional(),
  data: z
    .object({
      detail: z.array(SkemaRekamanEnom).default([]),
    })
    .nullish(),
})

export type BalasanEnom = z.infer<typeof SkemaBalasanEnom>
