import 'server-only'

import { kueri, kueriSatu } from '../db'
import {
  type JenisKategoriDiklat,
  type JenisPenugasan,
  type KategoriDiklat,
  type StatusPemetaan,
} from '../kategori-riwayat'
import { SUBKUERI_UNIT_TURUNAN, filterSumber } from './dasar'

/**
 * Kueri kamus kategori diklat & antrian validasi riwayat (`doc/sql/014`).
 *
 * Berkas ini TIDAK memeriksa wewenang — itu tugas halaman/aksi pemanggilnya.
 * Yang **wajib** dilewatkan pemanggil: `unitWajib`, karena antrian ini dibuka
 * Pengelola Unit dan isinya nama pegawai. Filternya dipasang **di SQL**, sama
 * seperti seluruh pembatasan unit lain di aplikasi ini.
 *
 * Satu hal yang membedakannya dari kueri halaman lain: `pemetaan_diklat` dikunci
 * pada NAMA diklat, bukan pada pegawai. Jadi antriannya **lintas unit dengan
 * sendirinya** — satu nama diklat dipakai pegawai dari banyak unit. Konsekuensinya
 * dituliskan apa adanya, bukan disembunyikan: lihat `ambilAntrianDiklat()`.
 */

/**
 * Ekspansi `pegawai.riwayat_diklat` (JSON) jadi baris, dengan **collation
 * disebut eksplisit**.
 *
 * Tanpa `CHARACTER SET ... COLLATE ...`, kolom hasil `JSON_TABLE` mewarisi
 * **collation KONEKSI**, bukan collation tabelnya. Driver `mysql2` memakai
 * `utf8mb4_unicode_ci` sementara kolomnya `utf8mb4_0900_ai_ci`, sehingga
 * membandingkannya melempar *"Illegal mix of collations"*.
 *
 * Yang membuat jebakan ini mahal: **kuerinya JALAN di `mysql` CLI**, yang
 * memakai collation koneksi berbeda. Jadi "sudah kuuji langsung ke DB, aman"
 * bukan bukti apa pun untuk kueri yang menyentuh keluaran `JSON_TABLE` — dan
 * kekeliruannya baru muncul lewat aplikasi, sebagai halaman yang gagal
 * dirender utuh.
 */
const JSON_TABLE_DIKLAT = `
  JSON_TABLE(p.riwayat_diklat, '$[*]'
    COLUMNS (nama VARCHAR(300) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci PATH '$'))
`

// ---------------------------------------------------------------------------
// Master kategori
// ---------------------------------------------------------------------------

export interface BarisKategoriDiklat extends KategoriDiklat {
  keterangan: string | null
  urutan: number
  aktif: boolean
  namaParent: string | null
  /** Berapa nama diklat sudah dipetakan ke kategori ini. */
  jumlahDipakai: number
}

function petakanKategori(r: Record<string, unknown>): BarisKategoriDiklat {
  return {
    id: Number(r.id),
    kode: String(r.kode),
    nama: String(r.nama),
    jenis: String(r.jenis) as JenisKategoriDiklat,
    parentId: r.parent_id === null ? null : Number(r.parent_id),
    setaraJenjang: (r.setara_jenjang ?? null) as KategoriDiklat['setaraJenjang'],
    // Driver MySQL mengembalikan kolom JSON kadang sebagai string, kadang sebagai
    // nilai terurai, tergantung versi & pengaturan. Menangani cuma salah satunya
    // menghasilkan `polaCocok` yang diam-diam kosong — dan kategori tanpa pola
    // tidak pernah muncul sebagai usulan, tanpa satu pun galat.
    polaCocok: uraiJsonLarik(r.pola_cocok),
    keterangan: r.keterangan === null ? null : String(r.keterangan),
    urutan: Number(r.urutan ?? 0),
    aktif: Number(r.aktif) === 1,
    namaParent: r.nama_parent === null || r.nama_parent === undefined ? null : String(r.nama_parent),
    jumlahDipakai: Number(r.jumlah_dipakai ?? 0),
  }
}

function uraiJsonLarik(nilai: unknown): string[] {
  if (nilai === null || nilai === undefined) return []
  if (Array.isArray(nilai)) return nilai.map((x) => String(x))
  if (typeof nilai === 'string') {
    try {
      const p = JSON.parse(nilai)
      return Array.isArray(p) ? p.map((x) => String(x)) : []
    } catch {
      return []
    }
  }
  return []
}

export async function ambilKategoriDiklat(
  opsi: { termasukNonaktif?: boolean } = {},
): Promise<BarisKategoriDiklat[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT k.id, k.kode, k.nama, k.jenis, k.parent_id, k.setara_jenjang, k.pola_cocok,
            k.keterangan, k.urutan, k.aktif,
            p.nama AS nama_parent,
            (SELECT COUNT(*) FROM pemetaan_diklat pd WHERE pd.kategori_id = k.id) AS jumlah_dipakai
       FROM master_kategori_riwayat_diklat k
       LEFT JOIN master_kategori_riwayat_diklat p ON p.id = k.parent_id
      WHERE ${opsi.termasukNonaktif ? '1 = 1' : 'k.aktif = 1'}
      ORDER BY COALESCE(p.urutan, k.urutan), k.urutan, k.nama`,
  )
  return baris.map(petakanKategori)
}

/** Bentuk ringkas untuk `usulkanKategoriDiklat()` — hanya yang aktif. */
export async function ambilKategoriUntukUsulan(): Promise<KategoriDiklat[]> {
  return (await ambilKategoriDiklat()).map((k) => ({
    id: k.id,
    kode: k.kode,
    nama: k.nama,
    jenis: k.jenis,
    parentId: k.parentId,
    setaraJenjang: k.setaraJenjang,
    polaCocok: k.polaCocok,
  }))
}

// ---------------------------------------------------------------------------
// Antrian pemetaan diklat
// ---------------------------------------------------------------------------

export interface BarisAntrianDiklat {
  id: number
  namaNormal: string
  namaMentah: string
  kategoriId: number | null
  kodeKategori: string | null
  namaKategori: string | null
  status: StatusPemetaan
  divalidasiOleh: string | null
  divalidasiPada: Date | null
  catatan: string | null
  /** Berapa pegawai memakai nama diklat ini — penentu urutan kerja. */
  jumlahPegawai: number
}

export interface FilterAntrianDiklat {
  status?: StatusPemetaan
  cari?: string
  /** Unit yang WAJIB disaring (lingkup Pengelola Unit). `null` = tanpa batas. */
  unitWajib?: number | null
  halaman?: number
  perHalaman?: number
}

/**
 * Antrian nama diklat yang perlu dikategorikan.
 *
 * `jumlahPegawai` dihitung dari `pegawai.riwayat_diklat` lewat `JSON_TABLE` —
 * **bukan** generator angka. Versi pertama benih tabel ini memakai generator
 * sampai indeks 14 dan kehilangan 68 dari 182 nama karena ada pegawai dengan 30
 * entri; batas yang ditulis sebagai angka akan terlampaui oleh data.
 *
 * **`unitWajib` menyaring penghitung, bukan barisnya.** Ini satu-satunya tempat
 * di aplikasi ini yang begitu, dan alasannya struktural: baris di sini adalah
 * NAMA DIKLAT, yang tidak dimiliki unit mana pun. Pengelola Unit yang memetakan
 * "Diklat PIM IV" ikut memengaruhi pegawai unit lain — itu memang sifat kamus,
 * dan halamannya menyatakannya. Yang tetap dibatasi: berapa pegawai **di
 * unitnya** yang terdampak, sehingga ia bisa mengurutkan pekerjaan menurut
 * dampaknya sendiri tanpa melihat populasi unit lain.
 */
export async function ambilAntrianDiklat(f: FilterAntrianDiklat = {}): Promise<{
  baris: BarisAntrianDiklat[]
  total: number
  halaman: number
  perHalaman: number
}> {
  const syarat: string[] = []
  const params: unknown[] = []

  if (f.status) {
    syarat.push('pd.status = ?')
    params.push(f.status)
  }
  if (f.cari && f.cari.trim() !== '') {
    syarat.push('pd.nama_normal LIKE ?')
    params.push(`%${f.cari.trim().toLowerCase()}%`)
  }
  const where = syarat.length > 0 ? syarat.join(' AND ') : '1 = 1'

  const perHalaman = Math.min(Math.max(f.perHalaman ?? 25, 1), 100)
  const halaman = Math.max(f.halaman ?? 1, 1)

  const hitung = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM pemetaan_diklat pd WHERE ${where}`,
    params,
  )

  // Penghitung pegawai: disaring unit bila diminta.
  const filterUnit =
    f.unitWajib !== null && f.unitWajib !== undefined
      ? `AND j.unit_organisasi_id IN (${SUBKUERI_UNIT_TURUNAN})`
      : ''
  const paramsUnit = f.unitWajib !== null && f.unitWajib !== undefined ? [f.unitWajib] : []

  /**
   * Penghitung pegawai dihitung **satu kali untuk semua nama** lewat `GROUP BY`,
   * bukan sebagai subkueri berkorelasi per baris.
   *
   * Versi pertama memakai subkueri berkorelasi, dan karena `ORDER BY` memakai
   * hasilnya, MySQL harus menghitungnya untuk **seluruh** baris antrian sebelum
   * `LIMIT` — 182 nama × 2.000 pegawai, masing-masing dengan ekspansi JSON.
   * Terukur **5.677 ms** di `pupr_dev_volume` (dan 141 ms di dev 40 pegawai, yang
   * sudah cukup dekat ke ambang untuk jadi peringatan). Bentuk sekarang memindai
   * `pegawai` sekali: 90 ms di volume.
   *
   * Pelajarannya bukan "hindari subkueri", tapi: `ORDER BY` atas kolom terhitung
   * **membatalkan** penghematan `LIMIT`. Selama pengurutannya menurut kolom
   * tersimpan, subkueri per baris hanya berjalan untuk baris yang tampil.
   */
  const baris = await kueri<Record<string, unknown>>(
    `WITH hitung AS (
       SELECT LOWER(TRIM(REGEXP_REPLACE(jt.nama, '[[:space:]]+', ' '))) AS nama_normal,
              COUNT(DISTINCT p.id) AS jumlah_pegawai
         FROM pegawai p
         LEFT JOIN jabatan j ON j.id = p.jabatan_id,
              ${JSON_TABLE_DIKLAT} jt
        WHERE p.riwayat_diklat IS NOT NULL
          AND jt.nama IS NOT NULL
          ${filterUnit}
          ${filterSumber('p')}
        GROUP BY nama_normal
     )
     SELECT pd.id, pd.nama_normal, pd.nama_mentah, pd.kategori_id, pd.status,
            pd.divalidasi_pada, pd.catatan,
            k.kode AS kode_kategori, k.nama AS nama_kategori,
            u.nama AS nama_validator,
            COALESCE(h.jumlah_pegawai, 0) AS jumlah_pegawai
       FROM pemetaan_diklat pd
       LEFT JOIN hitung h ON h.nama_normal = pd.nama_normal
       LEFT JOIN master_kategori_riwayat_diklat k ON k.id = pd.kategori_id
       LEFT JOIN users u ON u.id = pd.divalidasi_oleh
      WHERE ${where}
      ORDER BY jumlah_pegawai DESC, pd.nama_normal ASC
      LIMIT ? OFFSET ?`,
    [...paramsUnit, ...params, perHalaman, (halaman - 1) * perHalaman],
  )

  return {
    baris: baris.map((r) => ({
      id: Number(r.id),
      namaNormal: String(r.nama_normal),
      namaMentah: String(r.nama_mentah),
      kategoriId: r.kategori_id === null ? null : Number(r.kategori_id),
      kodeKategori: r.kode_kategori === null ? null : String(r.kode_kategori),
      namaKategori: r.nama_kategori === null ? null : String(r.nama_kategori),
      status: String(r.status) as StatusPemetaan,
      divalidasiOleh: r.nama_validator === null ? null : String(r.nama_validator),
      divalidasiPada: r.divalidasi_pada === null ? null : new Date(String(r.divalidasi_pada)),
      catatan: r.catatan === null ? null : String(r.catatan),
      jumlahPegawai: Number(r.jumlah_pegawai ?? 0),
    })),
    total: Number(hitung?.n ?? 0),
    halaman,
    perHalaman,
  }
}

// ---------------------------------------------------------------------------
// Antrian riwayat jabatan
// ---------------------------------------------------------------------------

export interface BarisAntrianJabatan {
  id: number
  pegawaiId: number
  nip: string
  namaPegawai: string
  namaUnit: string | null
  jabatanNamaMentah: string
  jenisPenugasan: JenisPenugasan | null
  tanggalMulai: Date | null
  tanggalAkhir: Date | null
  divalidasiOleh: string | null
}

export async function ambilAntrianJabatan(
  f: { unitWajib?: number | null; hanyaBelumValid?: boolean; batas?: number } = {},
): Promise<BarisAntrianJabatan[]> {
  const syarat: string[] = []
  const params: unknown[] = []

  if (f.hanyaBelumValid !== false) syarat.push('rj.jenis_penugasan IS NULL')
  const batasPopulasi = filterSumber('p')
  if (batasPopulasi) syarat.push(batasPopulasi.replace(/^ AND /, ''))
  if (f.unitWajib !== null && f.unitWajib !== undefined) {
    syarat.push(`j.unit_organisasi_id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(f.unitWajib)
  }
  const where = syarat.length > 0 ? syarat.join(' AND ') : '1 = 1'

  const baris = await kueri<Record<string, unknown>>(
    `SELECT rj.id, rj.pegawai_id, p.nip, p.nama_lengkap, uo.nama_unit,
            rj.jabatan_nama_mentah, rj.jenis_penugasan, rj.tanggal_mulai, rj.tanggal_akhir,
            v.nama AS nama_validator
       FROM riwayat_jabatan rj
       JOIN pegawai p ON p.id = rj.pegawai_id
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
       LEFT JOIN unit_organisasi uo ON uo.id = j.unit_organisasi_id
       LEFT JOIN users v ON v.id = rj.divalidasi_oleh
      WHERE ${where}
      ORDER BY p.nama_lengkap, rj.urutan
      LIMIT ?`,
    [...params, Math.min(Math.max(f.batas ?? 200, 1), 1000)],
  )

  return baris.map((r) => ({
    id: Number(r.id),
    pegawaiId: Number(r.pegawai_id),
    nip: String(r.nip),
    namaPegawai: String(r.nama_lengkap),
    namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
    jabatanNamaMentah: String(r.jabatan_nama_mentah),
    jenisPenugasan: r.jenis_penugasan === null ? null : (String(r.jenis_penugasan) as JenisPenugasan),
    tanggalMulai: r.tanggal_mulai === null ? null : new Date(String(r.tanggal_mulai)),
    tanggalAkhir: r.tanggal_akhir === null ? null : new Date(String(r.tanggal_akhir)),
    divalidasiOleh: r.nama_validator === null ? null : String(r.nama_validator),
  }))
}

// ---------------------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------------------

export interface RingkasValidasiRiwayat {
  diklatTotal: number
  diklatUsulan: number
  diklatTervalidasi: number
  diklatDitolak: number
  jabatanTotal: number
  jabatanBelumValid: number
  pegawaiTotal: number
  pegawaiSudahDiperiksa: number
}

export async function ambilRingkasValidasiRiwayat(
  unitWajib?: number | null,
): Promise<RingkasValidasiRiwayat> {
  const batasUnit =
    unitWajib !== null && unitWajib !== undefined
      ? `AND j.unit_organisasi_id IN (${SUBKUERI_UNIT_TURUNAN})`
      : ''
  const p = unitWajib !== null && unitWajib !== undefined ? [unitWajib] : []

  const diklat = await kueriSatu<Record<string, unknown>>(
    `SELECT COUNT(*) AS total,
            SUM(status = 'USULAN') AS usulan,
            SUM(status = 'TERVALIDASI') AS tervalidasi,
            SUM(status = 'DITOLAK') AS ditolak
       FROM pemetaan_diklat`,
  )

  // Dua penghitung berikut memakai lingkup unit: keduanya tentang PEGAWAI.
  const jabatan = await kueriSatu<Record<string, unknown>>(
    `SELECT COUNT(*) AS total, SUM(rj.jenis_penugasan IS NULL) AS belum
       FROM riwayat_jabatan rj
       JOIN pegawai p ON p.id = rj.pegawai_id
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
      WHERE 1 = 1 ${batasUnit} ${filterSumber('p')}`,
    p,
  )

  const pegawai = await kueriSatu<Record<string, unknown>>(
    `SELECT COUNT(*) AS total, SUM(p.riwayat_divalidasi_pada IS NOT NULL) AS diperiksa
       FROM pegawai p
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
      WHERE p.status_aktif = 'AKTIF' ${batasUnit} ${filterSumber('p')}`,
    p,
  )

  return {
    diklatTotal: Number(diklat?.total ?? 0),
    diklatUsulan: Number(diklat?.usulan ?? 0),
    diklatTervalidasi: Number(diklat?.tervalidasi ?? 0),
    diklatDitolak: Number(diklat?.ditolak ?? 0),
    jabatanTotal: Number(jabatan?.total ?? 0),
    jabatanBelumValid: Number(jabatan?.belum ?? 0),
    pegawaiTotal: Number(pegawai?.total ?? 0),
    pegawaiSudahDiperiksa: Number(pegawai?.diperiksa ?? 0),
  }
}
