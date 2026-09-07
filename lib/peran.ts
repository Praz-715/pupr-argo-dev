/**
 * Peran pengguna internal — cocok persis dengan `roles.nama_role` di DB dan
 * tabel peran di doc/PRD.md §3.
 *
 * Modul ini BEBAS dependensi server supaya aman diimpor komponen klien.
 * Logika sesi ada di `lib/auth.ts` (server-only).
 */

export const SEMUA_PERAN = [
  'Super Admin',
  'Admin Talenta',
  'Pengelola Unit',
  'Pimpinan',
  'Viewer',
] as const

export type Peran = (typeof SEMUA_PERAN)[number]

export interface PenggunaAktif {
  id: number
  nama: string
  username: string
  email: string
  peran: Peran
  unitOrganisasiId: number | null
  namaUnit: string | null
}

export const DESKRIPSI_PERAN: Record<Peran, string> = {
  'Super Admin': 'Tim IT DJBK — kelola pengguna, master data, klien & token API, audit log',
  'Admin Talenta': 'Bagian Kepegawaian & Umum — rubrik, talent pool, verifikasi nominasi, laporan',
  'Pengelola Unit': 'Staf kepegawaian unit — input & validasi data unitnya, ajukan nominasi',
  Pimpinan: 'Dirjen, Sesditjen, Para Direktur — dashboard, profil talenta, persetujuan akhir',
  Viewer: 'Pembina kebijakan — akses baca terbatas ke dashboard & laporan',
}

/** Peran yang datanya dibatasi ke unit sendiri (dipakai penuh di Fase 7). */
export const PERAN_TERBATAS_UNIT: readonly Peran[] = ['Pengelola Unit']

/*
  ── Daftar peran per KEMAMPUAN ────────────────────────────────────────────────

  Kenapa di sini dan bukan di masing-masing berkas aksi: daftar yang sama harus
  dipakai DUA tempat — server action (yang menolak) dan halaman (yang menggambar
  tombolnya). Selama keduanya menyalin daftar sendiri-sendiri, keduanya bisa
  berselisih, dan selisihnya tidak pernah muncul sebagai galat:

    - halaman lebih longgar → pengguna mengisi form, menekan Simpan, ditolak;
    - halaman lebih ketat  → kemampuannya ada tapi tombolnya tersembunyi, jadi
      tidak ada yang tahu ia ada.

  Keduanya sudah pernah terjadi di proyek ini — yang kedua persis yang membuat
  alur usulan suksesi pincang sampai 24 Agu 2026. Berkas aksi berarahan
  `'use server'` tidak boleh mengekspor konstanta (Next hanya mengizinkan fungsi
  async), jadi halaman tidak bisa mengimpornya dari sana; modul ini bebas
  dependensi server, jadi keduanya bisa mengimpor dari SATU tempat.

  Pembagiannya mengikuti siapa yang tahu apa — bukan siapa yang lebih senior:
  UNIT mengusulkan (kursi mana yang kosong, syarat apa yang dibutuhkan, siapa
  kandidatnya), ADMIN TALENTA memutuskan (rubrik penilaian & aktivasi).
*/

/**
 * MEMUTUSKAN jabatan target: rubrik, aktivasi, jabatan anggota, hapus.
 *
 * Rubrik tidak dibuka untuk unit karena bobot 65/20/15 berlaku se-organisasi —
 * kalau tiap unit menyetel bobotnya sendiri, peringkat antar unit tidak lagi bisa
 * dibandingkan padahal seluruh Peta Talenta memajangnya bersebelahan. Aktivasi
 * ditahan karena itu titik verifikasinya: draft tidak ikut dihitung.
 */
export const PERAN_KELOLA_TARGET: readonly Peran[] = ['Super Admin', 'Admin Talenta']

/**
 * MENGUSULKAN jabatan target: menjadikan kursi kosong sebagai draft, lalu mengisi
 * persyaratannya (pendidikan, bidang ilmu, pengalaman, diklat).
 *
 * Permintaan pemilik proses 24 Agu 2026: *"kalo misalkan kosong user tinggal
 * mengajukan aja jabatannya apa dan persyaratannya apa aja"*. Yang membuat ini
 * aman tanpa kolom status baru: DRAFT **sudah** inert — tidak dihitung, tidak
 * muncul di pemilih Peta Talenta. Jadi "usulan unit" = draft berisi persyaratan,
 * "verifikasi" = Admin Talenta meninjau lalu mengaktifkan.
 *
 * Lingkup unit Pengelola Unit ditegakkan `jabatanTerjangkau()` /
 * `targetTerjangkau()` DI DALAM SQL — bukan dengan menyembunyikan tombol.
 */
export const PERAN_USUL_TARGET: readonly Peran[] = [
  'Super Admin',
  'Admin Talenta',
  'Pengelola Unit',
]

/**
 * Memasukkan kandidat ke TALENT POOL.
 *
 * Bukan seluruh isi pool: rencana pengembangan punya daftarnya sendiri
 * (`PERAN_RENCANA` di `lib/aksi/suksesi.ts` — Pimpinan ikut, Pengelola Unit tidak),
 * dan itu tidak disatukan ke sini karena keduanya memang bukan kemampuan yang sama.
 *
 * Pengelola Unit ikut karena aksi `AJUKAN` sudah mengizinkannya sejak awal, tapi
 * menuntut kandidatnya sudah ada di pool — sehingga unit hanya bisa meneruskan yang
 * disiapkan orang lain. Itu bukan alur usulan, itu alur persetujuan yang
 * pengusulnya tidak bisa mengusulkan.
 *
 * Yang dibatasi lingkup adalah ORANGNYA (`pegawaiTerjangkau()`), bukan kursinya:
 * suksesi memang sering memindahkan orang antar unit, dan `nominasi` mencatat unit
 * pengaju secara terpisah.
 */
export const PERAN_KELOLA_POOL: readonly Peran[] = [
  'Super Admin',
  'Admin Talenta',
  'Pengelola Unit',
]

export function punyaPeran(
  pengguna: PenggunaAktif | null,
  diizinkan: readonly Peran[],
): boolean {
  if (!pengguna) return false
  return diizinkan.includes(pengguna.peran)
}

export function adalahPeranValid(nilai: string): nilai is Peran {
  return (SEMUA_PERAN as readonly string[]).includes(nilai)
}
