import 'server-only'

import { angka, angkaWajib, kueri, kueriSatu } from '../db'
import type { Kotak9 } from '../scoring'
import { CTE_ASESMEN_TERBARU, SUBKUERI_UNIT_TURUNAN } from './dasar'

/**
 * Kueri Peta Talenta (Fase 3, U-1) — grid 3×3, bubble Kinerja × Potensial, dan
 * drill-down per sel, **semuanya berfilter** unit/eselon/jenjang/tahun.
 *
 * Bedanya dengan `lib/kueri/dashboard.ts`: di dashboard ketiga angka itu tanpa
 * filter (ringkasan organisasi), di sini pengguna menyaringnya. Agregasinya
 * tetap di SQL — jumlah baris yang keluar dibatasi bentuknya (9 sel; bubble
 * maksimum 5 nilai Y × 101 nilai X), jadi payload tidak tumbuh mengikuti jumlah
 * pegawai (phase.md §7 Fase 1, catatan skala terukur).
 *
 * Satu keputusan yang perlu ditulis: **tahun asesmen menyaring, bukan memilih
 * ulang.** Filter tahun dipasang pada asesmen terbaru tiap pegawai, jadi
 * "tahun 2024" berarti *pegawai yang asesmen terbarunya tahun 2024* — bukan
 * "asesmen tahun 2024 milik siapa pun". Kalau tidak begitu, seorang pegawai
 * bisa muncul di dua tahun sekaligus dan totalnya melebihi jumlah pegawai.
 */

export interface FilterPeta {
  unitId?: number
  /**
   * Batas unit WAJIB dari peran pengguna (`lib/lingkup.ts`), dipasang
   * berdampingan dengan `unitId` sehingga hasilnya irisan. Alasan lengkapnya
   * ada di `FilterDirektori.unitWajib`.
   */
  unitWajib?: number | null
  eselon?: string
  jenjang?: string
  tahun?: number
  /** Hanya asesmen yang masih berlaku (buang yang kedaluwarsa). */
  hanyaBerlaku?: boolean
}

function bangunFilterPeta(f: FilterPeta): { where: string; params: unknown[] } {
  const syarat: string[] = []
  const params: unknown[] = []

  if (f.unitId !== undefined) {
    syarat.push(`u.id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(f.unitId)
  }
  if (f.unitWajib !== undefined && f.unitWajib !== null) {
    syarat.push(`u.id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(f.unitWajib)
  }
  if (f.eselon) {
    syarat.push('j.eselon = ?')
    params.push(f.eselon)
  }
  if (f.jenjang) {
    syarat.push('j.jenjang = ?')
    params.push(f.jenjang)
  }
  if (f.tahun !== undefined) {
    syarat.push('a.tahun_asesmen = ?')
    params.push(f.tahun)
  }
  if (f.hanyaBerlaku) {
    syarat.push("a.status_asesmen <> 'Expired'")
  }

  return { where: syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : '', params }
}

/** FROM+JOIN yang sama dipakai ketiga kueri di berkas ini. */
const DARI_ASESMEN = `
  FROM asesmen_terbaru a
  JOIN pegawai p ON p.id = a.pegawai_id
  LEFT JOIN jabatan j ON j.id = p.jabatan_id
  LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
`

// ---------------------------------------------------------------------------
// Grid 3×3 + basis data
// ---------------------------------------------------------------------------

export interface PetaSebaran {
  perKotak: Map<Kotak9, number>
  totalDinilai: number
  /** Pegawai aktif tanpa asesmen sama sekali — di luar peta, wajib disebut. */
  tanpaAsesmen: number
  /** Termasuk dalam peta tapi asesmennya kedaluwarsa (kalau tidak difilter). */
  kedaluwarsa: number
  tahunTerlama: number | null
  tahunTerbaru: number | null
}

export async function ambilPetaSebaran(f: FilterPeta): Promise<PetaSebaran> {
  const { where, params } = bangunFilterPeta(f)

  const [sebaran, ringkas, tanpa] = await Promise.all([
    kueri<{ kotak_9: number; jml: number }>(
      `${CTE_ASESMEN_TERBARU}
       SELECT a.kotak_9, COUNT(*) AS jml ${DARI_ASESMEN} ${where}
       GROUP BY a.kotak_9`,
      params,
    ),
    kueriSatu<Record<string, unknown>>(
      `${CTE_ASESMEN_TERBARU}
       SELECT COUNT(*) AS total,
              SUM(a.status_asesmen = 'Expired') AS kedaluwarsa,
              MIN(a.tahun_asesmen) AS tahun_min,
              MAX(a.tahun_asesmen) AS tahun_maks
       ${DARI_ASESMEN} ${where}`,
      params,
    ),
    // Pegawai tanpa asesmen tidak punya baris `a`, jadi dihitung terpisah dengan
    // filter yang sama minus syarat yang menyentuh kolom asesmen.
    hitungTanpaAsesmen(f),
  ])

  const perKotak = new Map<Kotak9, number>()
  for (const r of sebaran) perKotak.set(Number(r.kotak_9) as Kotak9, Number(r.jml))

  return {
    perKotak,
    totalDinilai: angkaWajib(ringkas?.total as number),
    kedaluwarsa: Number(ringkas?.kedaluwarsa ?? 0),
    tahunTerlama: angka(ringkas?.tahun_min as number),
    tahunTerbaru: angka(ringkas?.tahun_maks as number),
    tanpaAsesmen: tanpa,
  }
}

async function hitungTanpaAsesmen(f: FilterPeta): Promise<number> {
  const syarat: string[] = ["p.status_aktif = 'AKTIF'"]
  const params: unknown[] = []

  if (f.unitId !== undefined) {
    syarat.push(`u.id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(f.unitId)
  }
  if (f.unitWajib !== undefined && f.unitWajib !== null) {
    syarat.push(`u.id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(f.unitWajib)
  }
  if (f.eselon) {
    syarat.push('j.eselon = ?')
    params.push(f.eselon)
  }
  if (f.jenjang) {
    syarat.push('j.jenjang = ?')
    params.push(f.jenjang)
  }

  const r = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n
     FROM pegawai p
     LEFT JOIN jabatan j ON j.id = p.jabatan_id
     LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     WHERE ${syarat.join(' AND ')}
       AND NOT EXISTS (SELECT 1 FROM asesmen_talenta x WHERE x.pegawai_id = p.id)`,
    params,
  )
  return angkaWajib(r?.n)
}

// ---------------------------------------------------------------------------
// Bubble Kinerja × Potensial
// ---------------------------------------------------------------------------

export interface TitikPeta {
  y: number
  x: number
  jumlah: number
  kotak: Kotak9
  contohNama: string[]
}

export async function ambilTitikPeta(f: FilterPeta): Promise<{
  titik: TitikPeta[]
  totalPegawai: number
}> {
  const { where, params } = bangunFilterPeta(f)

  const baris = await kueri<Record<string, unknown>>(
    `${CTE_ASESMEN_TERBARU}
     SELECT a.nilai_kinerja_y AS y,
            ROUND(a.nilai_potensial_x, 0) AS x,
            a.kotak_9,
            COUNT(*) AS jml,
            SUBSTRING_INDEX(
              GROUP_CONCAT(p.nama_lengkap ORDER BY p.nama_lengkap SEPARATOR '||'), '||', 5
            ) AS contoh
     ${DARI_ASESMEN} ${where}
     GROUP BY a.nilai_kinerja_y, ROUND(a.nilai_potensial_x, 0), a.kotak_9
     ORDER BY y, x`,
    params,
  )

  const titik = baris.map((r) => ({
    y: angkaWajib(r.y as string),
    x: angkaWajib(r.x as string),
    jumlah: Number(r.jml),
    kotak: Number(r.kotak_9) as Kotak9,
    contohNama: String(r.contoh ?? '')
      .split('||')
      .filter((s) => s !== ''),
  }))

  return { titik, totalPegawai: titik.reduce((n, t) => n + t.jumlah, 0) }
}

// ---------------------------------------------------------------------------
// Drill-down per sel
// ---------------------------------------------------------------------------

export interface AnggotaSel {
  pegawaiId: number
  nip: string
  nama: string
  namaJabatan: string | null
  namaUnit: string | null
  eselon: string | null
  nilaiKinerjaY: number
  nilaiPotensialX: number
  nilaiTalenta: number
  predikat: string
  tahunAsesmen: number
  statusAsesmen: string
}

export const UKURAN_HALAMAN_SEL = 20

/**
 * Isi satu sel Kotak 9 — inilah pengganti *jitter*: sebaran **di dalam** sel
 * dibaca sebagai daftar bernilai asli, bukan sebagai titik yang digeser ke
 * koordinat yang bukan miliknya (phase.md §7 Fase 3).
 */
export async function ambilAnggotaSel(
  kotak: number,
  f: FilterPeta,
  halaman = 1,
): Promise<{ daftar: AnggotaSel[]; total: number; halaman: number; ukuranHalaman: number }> {
  const { where, params } = bangunFilterPeta(f)
  const gabung = where === '' ? 'WHERE a.kotak_9 = ?' : `${where} AND a.kotak_9 = ?`
  const hal = Math.max(1, halaman)
  const offset = (hal - 1) * UKURAN_HALAMAN_SEL

  const [daftar, hitung] = await Promise.all([
    kueri<Record<string, unknown>>(
      `${CTE_ASESMEN_TERBARU}
       SELECT p.id, p.nip, p.nama_lengkap, j.nama_jabatan, j.eselon, u.nama_unit,
              a.nilai_kinerja_y, a.nilai_potensial_x, a.nilai_talenta,
              a.rating_kinerja, a.tahun_asesmen, a.status_asesmen
       ${DARI_ASESMEN} ${gabung}
       ORDER BY a.nilai_talenta DESC, p.nama_lengkap
       LIMIT ? OFFSET ?`,
      [...params, kotak, UKURAN_HALAMAN_SEL, offset],
    ),
    kueriSatu<{ n: number }>(
      `${CTE_ASESMEN_TERBARU} SELECT COUNT(*) AS n ${DARI_ASESMEN} ${gabung}`,
      [...params, kotak],
    ),
  ])

  return {
    daftar: daftar.map((r) => ({
      pegawaiId: Number(r.id),
      nip: String(r.nip),
      nama: String(r.nama_lengkap),
      namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
      namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
      eselon: r.eselon === null ? null : String(r.eselon),
      nilaiKinerjaY: angkaWajib(r.nilai_kinerja_y as string),
      nilaiPotensialX: angkaWajib(r.nilai_potensial_x as string),
      nilaiTalenta: angkaWajib(r.nilai_talenta as string),
      predikat: String(r.rating_kinerja),
      tahunAsesmen: Number(r.tahun_asesmen),
      statusAsesmen: String(r.status_asesmen),
    })),
    total: angkaWajib(hitung?.n),
    halaman: hal,
    ukuranHalaman: UKURAN_HALAMAN_SEL,
  }
}

// ---------------------------------------------------------------------------
// Opsi filter & konsistensi label
// ---------------------------------------------------------------------------

export interface OpsiPeta {
  unit: Array<{ id: number; nama: string; level: number }>
  eselon: string[]
  jenjang: string[]
  tahun: number[]
}

export async function ambilOpsiPeta(): Promise<OpsiPeta> {
  const [unit, eselon, jenjang, tahun] = await Promise.all([
    kueri<Record<string, unknown>>(
      `SELECT u.id, u.nama_unit,
              CASE WHEN u.parent_id IS NULL THEN 0
                   WHEN (SELECT p2.parent_id FROM unit_organisasi p2 WHERE p2.id = u.parent_id) IS NULL THEN 1
                   ELSE 2 END AS level
       FROM unit_organisasi u
       WHERE EXISTS (
         SELECT 1 FROM jabatan j JOIN pegawai p ON p.jabatan_id = j.id
         WHERE j.unit_organisasi_id = u.id
       )
       ORDER BY level, u.nama_unit`,
    ),
    kueri<{ eselon: string }>(
      `SELECT DISTINCT j.eselon FROM jabatan j JOIN pegawai p ON p.jabatan_id = j.id
       WHERE j.eselon IS NOT NULL
       ORDER BY FIELD(j.eselon,'I','II','III','IV','NON_ESELON')`,
    ),
    kueri<{ jenjang: string }>(
      `SELECT DISTINCT j.jenjang FROM jabatan j JOIN pegawai p ON p.jabatan_id = j.id
       WHERE j.jenjang IS NOT NULL ORDER BY j.jenjang`,
    ),
    kueri<{ tahun: number }>(
      `SELECT DISTINCT tahun_asesmen AS tahun FROM asesmen_talenta ORDER BY tahun DESC`,
    ),
  ])

  return {
    unit: unit.map((r) => ({
      id: Number(r.id),
      nama: String(r.nama_unit),
      level: Number(r.level),
    })),
    eselon: eselon.map((r) => String(r.eselon)),
    jenjang: jenjang.map((r) => String(r.jenjang)),
    tahun: tahun.map((r) => Number(r.tahun)),
  }
}
