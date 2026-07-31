/**
 * Bentuk balikan seragam untuk semua server action.
 *
 * Server action **tidak melempar** untuk kesalahan yang wajar terjadi (validasi
 * gagal, wewenang kurang, data dipakai baris lain). Melempar akan memicu error
 * boundary dan mengganti seluruh halaman — padahal yang dibutuhkan pengguna
 * hanyalah pesan di sebelah field yang salah, dengan isian yang lain tetap utuh.
 *
 * Yang tetap dilempar: hal yang memang tidak seharusnya terjadi (koneksi DB
 * putus) — itu memang urusan error boundary.
 */
export type HasilAksi<T = void> =
  | { ok: true; data: T; pesan?: string }
  | { ok: false; pesan: string; galatField?: Record<string, string> }

export function berhasil<T>(data: T, pesan?: string): HasilAksi<T> {
  return { ok: true, data, pesan }
}

export function gagal(pesan: string, galatField?: Record<string, string>): HasilAksi<never> {
  return { ok: false, pesan, galatField }
}

/**
 * Ubah error Zod jadi peta pesan per field.
 * Hanya pesan pertama per field yang dipakai — menumpuk beberapa pesan pada satu
 * field membuat form berisik tanpa membantu.
 */
export function galatDariZod(
  issues: Array<{ path: Array<string | number | symbol>; message: string }>,
): Record<string, string> {
  const peta: Record<string, string> = {}
  for (const i of issues) {
    const kunci = i.path.map(String).join('.') || '_'
    if (!(kunci in peta)) peta[kunci] = i.message
  }
  return peta
}

/** Pesan ramah untuk pelanggaran constraint MySQL yang bisa ditebak sebabnya. */
export function pesanDariGalatDb(e: unknown, konteks: { unik?: string }): string | null {
  const kode = (e as { code?: string } | null)?.code
  if (kode === 'ER_DUP_ENTRY') {
    return konteks.unik
      ? `${konteks.unik} itu sudah dipakai baris lain. Pakai nilai yang berbeda.`
      : 'Nilainya sudah dipakai baris lain.'
  }
  if (kode === 'ER_ROW_IS_REFERENCED_2') {
    return 'Data ini masih dipakai baris lain, jadi tidak bisa dihapus. Lepaskan keterkaitannya lebih dulu.'
  }
  if (kode === 'ER_NO_REFERENCED_ROW_2') {
    return 'Ada acuan ke data yang tidak ada. Muat ulang halaman lalu coba lagi.'
  }
  return null
}
