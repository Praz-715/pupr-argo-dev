/**
 * Arah pengurutan bawaan per kolom — SATU sumber untuk lapisan kueri (server)
 * dan header tabel (klien).
 *
 * Kenapa berkas sendiri: ekspresi SQL kolomnya ada di `lib/kueri/pegawai.ts`
 * yang ber-`import 'server-only'`, jadi komponen tabel tidak bisa mengimpornya.
 * Kalau arah bawaan ditulis ulang di komponen, panah di header dan urutan data
 * yang dikirim server bisa berbeda tanpa ada yang menyadarinya (CLAUDE.md #1:
 * jangan ada dua versi logika yang sama).
 *
 * Aturannya: teks dibaca alfabetis (A→Z), skor & peringkat dibaca dari yang
 * tertinggi. Kolom yang tidak terdaftar di sini bawaannya `asc`.
 */
export type ArahUrut = 'asc' | 'desc'

/**
 * Kolom yang bawaannya menurun karena yang dicari orang adalah nilai tertinggi.
 * `ranking` justru TIDAK di sini — peringkat 1 adalah yang teratas, jadi naik.
 */
const MENURUN = new Set(['potkom', 'integritas', 'kotak9', 'talenta', 'skorTotal'])

export function arahBawaanUrut(kolom: string | null | undefined): ArahUrut {
  return kolom && MENURUN.has(kolom) ? 'desc' : 'asc'
}
