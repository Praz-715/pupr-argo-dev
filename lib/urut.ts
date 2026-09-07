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
const MENURUN = new Set([
  'potkom',
  'integritas',
  'kotak9',
  'talenta',
  'skorTotal',
  // Ditambahkan bersama pengurutan tabel Kotak 9 (24 Agu 2026). Ketiganya skor,
  // jadi yang dicari orang nilai tertinggi. `asesmen` = tahun asesmen: yang
  // dicari yang TERBARU, dan tahun juga angka — jadi menurun.
  'kinerja',
  'potensial',
  'asesmen',
])

/**
 * Kolom tabel Kotak 9 (dashboard & drill-down Peta Talenta) yang bisa diurutkan.
 *
 * ## Kenapa daftarnya di sini, bukan di komponennya
 *
 * Header tabel (klien) memutuskan apakah tombol urut digambar, sementara kueri
 * (server) memutuskan `ORDER BY`-nya. Kalau daftarnya ditulis di dua tempat, akan
 * ada kolom yang tombolnya tampil tapi tidak mengubah apa pun — "klik mati"
 * (phase.md §5.2), yang justru jadi alasan tombol urut dulu DIMATIKAN seluruhnya
 * di tabel ini. Satu daftar membuat keduanya tidak bisa berselisih.
 *
 * Kedua kueri memetakan kunci ini ke ekspresi SQL-nya sendiri: `nilai_potensial_x`
 * & `nilai_talenta` di Peta Talenta adalah alias TERHITUNG yang berubah menurut
 * `?target=`, sementara di dashboard keduanya kolom tersimpan. Yang sama hanya
 * KUNCInya; ekspresinya memang berbeda dan harus berbeda.
 *
 * `jabatan`/`unit`/`eselon` ikut karena pembaca sering mencari "siapa saja dari
 * unit X di kotak ini". `nip` tidak — ia identitas, bukan besaran yang berguna
 * diurutkan, dan kolom nama sudah menjawabnya.
 */
export const KUNCI_URUT_KOTAK9 = [
  'nama',
  'jabatan',
  'unit',
  'eselon',
  'kinerja',
  'predikat',
  'potensial',
  'talenta',
  'asesmen',
] as const

export function bisaUrutKotak9(kunci: string): boolean {
  return (KUNCI_URUT_KOTAK9 as readonly string[]).includes(kunci)
}

export function arahBawaanUrut(kolom: string | null | undefined): ArahUrut {
  return kolom && MENURUN.has(kolom) ? 'desc' : 'asc'
}
