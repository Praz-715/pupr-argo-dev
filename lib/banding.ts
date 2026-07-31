/**
 * Aturan pemilihan kandidat untuk Perbandingan Kandidat — dipakai bersama oleh
 * halaman (server) dan pemilih kandidat (klien), jadi tidak boleh berada di
 * `lib/kueri/*` yang ber-`import 'server-only'`.
 *
 * Batas 2–4 kandidat datang dari PRD §6.3. Ditegakkan di **tiga** tempat dengan
 * satu definisi: UI menonaktifkan penambahan, halaman memangkas isi `?nip=`, dan
 * lapisan kueri memangkas lagi sebelum menyusun `IN (…)` — sehingga `?nip=`
 * berisi 50 NIP tidak pernah sampai jadi kueri raksasa.
 */
export const MIN_KANDIDAT = 2
export const MAKS_KANDIDAT = 4

/**
 * Baca daftar NIP dari query string: dipisah koma, hanya 18 digit, tanpa
 * duplikat, dipangkas ke batas maksimum.
 */
export function bacaDaftarNip(nilai: string | undefined): string[] {
  if (!nilai) return []
  const bersih = nilai
    .split(',')
    .map((s) => s.trim().replace(/\D/g, ''))
    .filter((s) => s.length === 18)
  return [...new Set(bersih)].slice(0, MAKS_KANDIDAT)
}
