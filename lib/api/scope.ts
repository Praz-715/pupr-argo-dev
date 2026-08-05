/**
 * Penegakan `api_client.scope_akses` (Fase 9) — murni & bebas DB.
 *
 * ## Kenapa ini modul tersendiri
 *
 * PRD §7.3 menyandarkan seluruh kepatuhan UU PDP No. 27/2022 pada satu gagasan:
 * **klien hanya menerima data yang dasar hukumnya mengizinkan.** Aturannya
 * pendek, tapi ia harus sama persis di setiap endpoint — dan aturan pendek yang
 * disalin ke empat endpoint adalah aturan yang akan berbeda di endpoint kelima,
 * tanpa menimbulkan galat apa pun. Yang terjadi cuma satu instansi menerima NIP
 * yang MoU-nya tidak mencakup itu.
 *
 * ## Gagal tertutup, dan itu bukan pilihan gaya
 *
 * `api_client.scope_akses` bertipe JSON dan **boleh NULL**; klien berstatus
 * PENDING di data dev punya `{}`. Tafsiran yang wajar — "belum diatur, ya sudah
 * izinkan saja" — persis kebalikan dari yang benar. Scope yang tidak bisa dibaca,
 * kosong, atau bentuknya tidak dikenali berarti **tidak ada endpoint yang
 * diizinkan**, bukan semuanya.
 *
 * ## Penyamaran dibangun ALLOWLIST, bukan dengan menghapus kolom
 *
 * `samarkanPegawai()` menyusun objek balasan dari daftar field yang diizinkan,
 * bukan menyalin baris lalu `delete baris.nip`. Bedanya baru terasa nanti: begitu
 * seseorang menambah kolom ke kueri (mis. `email` atau `tanggal_lahir`), bentuk
 * blocklist **meneruskannya diam-diam** ke klien tanpa MoU data personal, dan
 * tidak ada uji yang gagal karena tidak ada yang tahu kolom itu ada. Allowlist
 * memaksa penambahan kolom jadi keputusan sadar.
 */

/** Endpoint `/api/v1` yang bisa diberi izin. Nilainya cocok dengan isi seed `scope_akses`. */
export const ENDPOINT_V1 = ['pegawai', 'talent-pool', 'kotak-9-summary'] as const

export type EndpointV1 = (typeof ENDPOINT_V1)[number]

export interface ScopeAkses {
  endpoints: EndpointV1[]
  /** Boleh menerima NIP & nama pegawai. Butuh dasar hukum (MoU/PKS) — PRD §7.1. */
  dataPersonal: boolean
}

/** Scope paling tertutup: tidak ada apa pun yang diizinkan. */
export const SCOPE_NIHIL: ScopeAkses = { endpoints: [], dataPersonal: false }

function adalahEndpoint(nilai: unknown): nilai is EndpointV1 {
  return typeof nilai === 'string' && (ENDPOINT_V1 as readonly string[]).includes(nilai)
}

/**
 * Baca kolom `scope_akses` apa pun bentuknya. Driver MySQL bisa mengembalikan
 * kolom JSON sebagai objek ATAU string, tergantung versi & konfigurasi — jadi
 * keduanya ditangani. Apa pun yang tidak dikenali jatuh ke `SCOPE_NIHIL`.
 */
export function bacaScope(mentah: unknown): ScopeAkses {
  let nilai = mentah
  if (typeof nilai === 'string') {
    try {
      nilai = JSON.parse(nilai)
    } catch {
      return SCOPE_NIHIL
    }
  }
  if (nilai === null || typeof nilai !== 'object' || Array.isArray(nilai)) return SCOPE_NIHIL

  const obj = nilai as Record<string, unknown>
  const daftar = Array.isArray(obj.endpoints) ? obj.endpoints.filter(adalahEndpoint) : []

  return {
    endpoints: [...new Set(daftar)],
    // Hanya `true` yang berarti boleh. `"true"`, `1`, dan `"ya"` sengaja TIDAK
    // diterima: kalau nilainya sempat tersimpan sebagai teks, itu tanda ada
    // jalur tulis yang tidak memvalidasi — dan menerimanya di sini menyembunyikan
    // masalahnya sampai suatu hari ia berarti sebaliknya.
    dataPersonal: obj.data_personal === true,
  }
}

export function bolehEndpoint(scope: ScopeAkses, endpoint: EndpointV1): boolean {
  return scope.endpoints.includes(endpoint)
}

/** Alasan siap-tampil untuk balasan 403 — klien perlu tahu apa yang harus diminta. */
export function alasanTolak(scope: ScopeAkses, endpoint: EndpointV1): string {
  if (scope.endpoints.length === 0) {
    return `Klien Anda belum punya scope akses yang aktif. Hubungi Super Admin SIMT DJBK untuk menetapkan scope sesuai MoU/PKS.`
  }
  return `Endpoint "${endpoint}" tidak termasuk scope akses klien Anda. Yang diizinkan: ${scope.endpoints.join(', ')}.`
}

// ---------------------------------------------------------------------------
// Penyamaran data personal
// ---------------------------------------------------------------------------

/** Bentuk baris pegawai apa adanya dari kueri internal (superset). */
export interface PegawaiUntukApi {
  nip: string
  nama: string
  namaJabatan: string | null
  namaUnit: string | null
  eselon: string | null
  jenjang: string | null
  tingkatPendidikan: string | null
  potkom: number | null
  nilaiIntegritas: number | null
  predikatKinerja: string | null
  kotak9: number | null
}

/**
 * Baris pegawai versi API. `nip` & `nama` **tidak ada** (bukan null) kalau klien
 * tidak punya scope data personal — field yang hilang lebih jujur daripada field
 * bernilai null, yang terbaca sebagai "datanya kosong".
 */
export interface BarisPegawaiApi {
  nip?: string
  nama?: string
  /** Pengenal semu yang stabil, supaya klien tanpa data personal tetap bisa menghitung. */
  id_anonim: string
  jabatan: string | null
  unit_organisasi: string | null
  eselon: string | null
  jenjang: string | null
  tingkat_pendidikan: string | null
  potkom: number | null
  nilai_integritas: number | null
  predikat_kinerja: string | null
  kotak_9: number | null
}

/**
 * Susun baris balasan dari field yang diizinkan.
 *
 * `id_anonim` diturunkan dari NIP lewat hash pendek, bukan NIP-nya sendiri. Ia
 * ada karena klien agregat tetap perlu **membedakan baris** (mis. menghitung
 * sebaran tanpa menggandakan orang) — tapi tidak boleh bisa memulihkan NIP-nya.
 * NIP ASN berformat tanggal lahir + TMT + gender, jadi meneruskannya apa adanya
 * kepada klien tanpa MoU sama dengan meneruskan data pribadi.
 */
export function samarkanPegawai(
  baris: PegawaiUntukApi,
  bolehPersonal: boolean,
  anonim: (nip: string) => string,
): BarisPegawaiApi {
  const dasar: BarisPegawaiApi = {
    id_anonim: anonim(baris.nip),
    jabatan: baris.namaJabatan,
    unit_organisasi: baris.namaUnit,
    eselon: baris.eselon,
    jenjang: baris.jenjang,
    tingkat_pendidikan: baris.tingkatPendidikan,
    potkom: baris.potkom,
    nilai_integritas: baris.nilaiIntegritas,
    predikat_kinerja: baris.predikatKinerja,
    kotak_9: baris.kotak9,
  }
  if (!bolehPersonal) return dasar
  return { nip: baris.nip, nama: baris.nama, ...dasar }
}
