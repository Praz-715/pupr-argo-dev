import 'server-only'

import { angka, angkaWajib, kueri, kueriSatu } from '../db'
import { hitungUsia, parseNip, proyeksiPensiun, selisihTahun, type JenisJabatan } from '../nip'
import { SUBKUERI_UNIT_TURUNAN, filterSumber } from './dasar'

/**
 * Kueri Master Data (Fase 4): pohon unit organisasi, daftar jabatan, dan
 * halaman Jabatan Kosong & Risiko Kekosongan (U-6).
 */

// ---------------------------------------------------------------------------
// Pohon unit organisasi
// ---------------------------------------------------------------------------

export interface NodeUnit {
  id: number
  kodeUnit: string
  namaUnit: string
  parentId: number | null
  jenis: string
  levelEselon: number | null
  /** Kedalaman di pohon, 0 = akar. Dihitung SQL, bukan ditelusuri di JS. */
  kedalaman: number
  /** Jumlah jabatan yang langsung menempel pada unit ini. */
  jumlahJabatan: number
  /** Pegawai aktif pada unit ini saja (tidak termasuk turunannya). */
  jumlahPegawai: number
  /** Pegawai aktif pada unit ini DAN seluruh turunannya. */
  jumlahPegawaiTermasukTurunan: number
  jumlahAnak: number
}

/**
 * Seluruh pohon unit dalam satu kueri rekursif, sudah terurut secara pre-order
 * sehingga UI cukup merendernya berurutan tanpa membangun pohon di memori.
 *
 * `jalur` (deretan id dari akar) dipakai dua hal: mengurutkan pre-order, dan
 * menghitung pegawai termasuk turunan tanpa perlu subkueri rekursif per baris.
 */
export async function ambilPohonUnit(): Promise<NodeUnit[]> {
  const baris = await kueri<Record<string, unknown>>(`
    WITH RECURSIVE pohon AS (
      SELECT u.id, u.kode_unit, u.nama_unit, u.parent_id, u.jenis, u.level_eselon,
             0 AS kedalaman,
             CAST(LPAD(u.id, 10, '0') AS CHAR(600)) AS jalur
      FROM unit_organisasi u
      WHERE u.parent_id IS NULL
      UNION ALL
      SELECT u.id, u.kode_unit, u.nama_unit, u.parent_id, u.jenis, u.level_eselon,
             p.kedalaman + 1,
             CONCAT(p.jalur, '/', LPAD(u.id, 10, '0'))
      FROM unit_organisasi u
      JOIN pohon p ON u.parent_id = p.id
    )
    SELECT t.id, t.kode_unit, t.nama_unit, t.parent_id, t.jenis, t.level_eselon,
           t.kedalaman,
           (SELECT COUNT(*) FROM jabatan j WHERE j.unit_organisasi_id = t.id
              AND j.status_jabatan <> 'DIHAPUS')                        AS jumlah_jabatan,
           (SELECT COUNT(*) FROM pegawai pg JOIN jabatan j ON j.id = pg.jabatan_id
              WHERE j.unit_organisasi_id = t.id AND pg.status_aktif = 'AKTIF') AS jumlah_pegawai,
           (SELECT COUNT(*) FROM pegawai pg
              JOIN jabatan j ON j.id = pg.jabatan_id
              JOIN pohon t2 ON t2.id = j.unit_organisasi_id
              WHERE pg.status_aktif = 'AKTIF'
                AND (t2.jalur = t.jalur OR t2.jalur LIKE CONCAT(t.jalur, '/%'))) AS pegawai_turunan,
           (SELECT COUNT(*) FROM unit_organisasi c WHERE c.parent_id = t.id) AS jumlah_anak
    FROM pohon t
    ORDER BY t.jalur
  `)

  return baris.map((r) => ({
    id: Number(r.id),
    kodeUnit: String(r.kode_unit),
    namaUnit: String(r.nama_unit),
    parentId: r.parent_id === null ? null : Number(r.parent_id),
    jenis: String(r.jenis),
    levelEselon: angka(r.level_eselon as number),
    kedalaman: Number(r.kedalaman),
    jumlahJabatan: Number(r.jumlah_jabatan),
    jumlahPegawai: Number(r.jumlah_pegawai),
    jumlahPegawaiTermasukTurunan: Number(r.pegawai_turunan),
    jumlahAnak: Number(r.jumlah_anak),
  }))
}

/**
 * Unit yang **tidak terjangkau dari akar mana pun** — punya `parent_id` yang
 * menunjuk baris tidak ada, atau tersangkut siklus.
 *
 * Kueri pohon di atas mulai dari `parent_id IS NULL`, jadi unit yatim TIDAK akan
 * muncul di sana. Kalau tidak dihitung terpisah, unitnya hilang dari halaman
 * master tanpa jejak — dan pegawainya hilang dari setiap agregasi per unit.
 */
export async function ambilUnitYatim(): Promise<NodeUnit[]> {
  const baris = await kueri<Record<string, unknown>>(`
    WITH RECURSIVE pohon AS (
      SELECT id FROM unit_organisasi WHERE parent_id IS NULL
      UNION ALL
      SELECT u.id FROM unit_organisasi u JOIN pohon p ON u.parent_id = p.id
    )
    SELECT u.id, u.kode_unit, u.nama_unit, u.parent_id, u.jenis, u.level_eselon,
           (SELECT COUNT(*) FROM jabatan j WHERE j.unit_organisasi_id = u.id) AS jumlah_jabatan,
           (SELECT COUNT(*) FROM pegawai pg JOIN jabatan j ON j.id = pg.jabatan_id
              WHERE j.unit_organisasi_id = u.id AND pg.status_aktif = 'AKTIF') AS jumlah_pegawai
    FROM unit_organisasi u
    WHERE u.id NOT IN (SELECT id FROM pohon)
    ORDER BY u.nama_unit
  `)

  return baris.map((r) => ({
    id: Number(r.id),
    kodeUnit: String(r.kode_unit),
    namaUnit: String(r.nama_unit),
    parentId: r.parent_id === null ? null : Number(r.parent_id),
    jenis: String(r.jenis),
    levelEselon: angka(r.level_eselon as number),
    kedalaman: 0,
    jumlahJabatan: Number(r.jumlah_jabatan),
    jumlahPegawai: Number(r.jumlah_pegawai),
    jumlahPegawaiTermasukTurunan: Number(r.jumlah_pegawai),
    jumlahAnak: 0,
  }))
}

/** Opsi induk untuk form — dengan kedalaman supaya bisa diindentasi. */
export async function ambilOpsiIndukUnit(): Promise<
  Array<{ id: number; nama: string; kedalaman: number }>
> {
  const baris = await kueri<Record<string, unknown>>(`
    WITH RECURSIVE pohon AS (
      SELECT id, nama_unit, parent_id, 0 AS kedalaman,
             CAST(LPAD(id, 10, '0') AS CHAR(600)) AS jalur
      FROM unit_organisasi WHERE parent_id IS NULL
      UNION ALL
      SELECT u.id, u.nama_unit, u.parent_id, p.kedalaman + 1,
             CONCAT(p.jalur, '/', LPAD(u.id, 10, '0'))
      FROM unit_organisasi u JOIN pohon p ON u.parent_id = p.id
    )
    SELECT id, nama_unit, kedalaman FROM pohon ORDER BY jalur
  `)
  return baris.map((r) => ({
    id: Number(r.id),
    nama: String(r.nama_unit),
    kedalaman: Number(r.kedalaman),
  }))
}

// ---------------------------------------------------------------------------
// Daftar jabatan
// ---------------------------------------------------------------------------

export const UKURAN_HALAMAN_JABATAN = 25

export interface FilterJabatan {
  cari?: string
  unitId?: number
  eselon?: string
  jenisJabatan?: string
  status?: string
  halaman?: number
}

export interface BarisJabatan {
  id: number
  kodeJabatan: string
  namaJabatan: string
  unitOrganisasiId: number
  namaUnit: string
  jenisJabatan: string
  jenjang: string
  eselon: string
  statusJabatan: string
  /** Pegawai aktif yang menempatinya — dipakai memblokir penandaan KOSONG. */
  jumlahPenghuni: number
  /** Apakah jabatan ini sudah jadi anggota jabatan target mana pun. */
  adaJabatanTarget: boolean
}

export async function ambilDaftarJabatan(f: FilterJabatan): Promise<{
  baris: BarisJabatan[]
  total: number
  halaman: number
  ukuranHalaman: number
}> {
  const syarat: string[] = []
  const params: unknown[] = []

  if (f.cari && f.cari.trim() !== '') {
    const q = `%${f.cari.trim()}%`
    syarat.push('(j.nama_jabatan LIKE ? OR j.kode_jabatan LIKE ?)')
    params.push(q, q)
  }
  if (f.unitId !== undefined) {
    syarat.push(`j.unit_organisasi_id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(f.unitId)
  }
  if (f.eselon) {
    syarat.push('j.eselon = ?')
    params.push(f.eselon)
  }
  if (f.jenisJabatan) {
    syarat.push('j.jenis_jabatan = ?')
    params.push(f.jenisJabatan)
  }
  if (f.status) {
    syarat.push('j.status_jabatan = ?')
    params.push(f.status)
  }

  const where = syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : ''
  const halaman = Math.max(1, f.halaman ?? 1)
  const offset = (halaman - 1) * UKURAN_HALAMAN_JABATAN

  const [baris, hitung] = await Promise.all([
    kueri<Record<string, unknown>>(
      `SELECT j.id, j.kode_jabatan, j.nama_jabatan, j.unit_organisasi_id, u.nama_unit,
              j.jenis_jabatan, j.jenjang, j.eselon, j.status_jabatan,
              (SELECT COUNT(*) FROM pegawai p WHERE p.jabatan_id = j.id
                 AND p.status_aktif = 'AKTIF')                              AS penghuni,
              EXISTS (SELECT 1 FROM jabatan_target_anggota a
                        WHERE a.jabatan_id = j.id)                          AS ada_target
       FROM jabatan j
       JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
       ${where}
       ORDER BY FIELD(j.eselon,'I','II','III','IV','NON_ESELON'), j.nama_jabatan
       LIMIT ? OFFSET ?`,
      [...params, UKURAN_HALAMAN_JABATAN, offset],
    ),
    kueriSatu<{ n: number }>(
      `SELECT COUNT(*) AS n FROM jabatan j
       JOIN unit_organisasi u ON u.id = j.unit_organisasi_id ${where}`,
      params,
    ),
  ])

  return {
    baris: baris.map((r) => ({
      id: Number(r.id),
      kodeJabatan: String(r.kode_jabatan),
      namaJabatan: String(r.nama_jabatan),
      unitOrganisasiId: Number(r.unit_organisasi_id),
      namaUnit: String(r.nama_unit),
      jenisJabatan: String(r.jenis_jabatan),
      jenjang: String(r.jenjang),
      eselon: String(r.eselon),
      statusJabatan: String(r.status_jabatan),
      jumlahPenghuni: Number(r.penghuni),
      adaJabatanTarget: Number(r.ada_target) === 1,
    })),
    total: angkaWajib(hitung?.n),
    halaman,
    ukuranHalaman: UKURAN_HALAMAN_JABATAN,
  }
}

/** Opsi filter untuk halaman jabatan. */
export async function ambilOpsiJabatan(): Promise<{
  eselon: string[]
  jenisJabatan: string[]
  jenjang: string[]
}> {
  const [eselon, jenis, jenjang] = await Promise.all([
    kueri<{ eselon: string }>(
      `SELECT DISTINCT eselon FROM jabatan ORDER BY FIELD(eselon,'I','II','III','IV','NON_ESELON')`,
    ),
    kueri<{ jenis_jabatan: string }>(`SELECT DISTINCT jenis_jabatan FROM jabatan ORDER BY 1`),
    kueri<{ jenjang: string }>(`SELECT DISTINCT jenjang FROM jabatan ORDER BY 1`),
  ])
  return {
    eselon: eselon.map((r) => String(r.eselon)),
    jenisJabatan: jenis.map((r) => String(r.jenis_jabatan)),
    jenjang: jenjang.map((r) => String(r.jenjang)),
  }
}

/**
 * Daftar jabatan untuk **pemilih di formulir** — id + label saja.
 *
 * Terpisah dari `ambilOpsiJabatan()`, yang mengembalikan nilai DISTINCT untuk
 * penyaring (eselon · jenis · jenjang) dan tidak memuat id sama sekali. Dua
 * kebutuhan yang kebetulan bernama mirip; menggabungkannya berarti pemilih
 * jabatan mengirim seluruh baris jabatan ke klien padahal yang dipakai cuma dua
 * kolom.
 *
 * Sengaja TIDAK ikut filter populasi: jabatan ada terlepas dari siapa yang
 * menempatinya, dan formulir riwayat jabatan justru sering perlu menunjuk
 * jabatan yang sedang kosong.
 */
export async function ambilPilihanJabatan(): Promise<Array<{ id: number; label: string }>> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT j.id, j.nama_jabatan, u.nama_unit
       FROM jabatan j
       LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
      ORDER BY j.nama_jabatan`,
  )
  return baris.map((r) => ({
    id: Number(r.id),
    label: r.nama_unit === null ? String(r.nama_jabatan) : `${String(r.nama_jabatan)} — ${String(r.nama_unit)}`,
  }))
}

// ---------------------------------------------------------------------------
// U-6 · Jabatan Kosong & Risiko Kekosongan
// ---------------------------------------------------------------------------

export interface JabatanKosongRinci {
  id: number
  kodeJabatan: string
  namaJabatan: string
  namaUnit: string
  eselon: string
  jenjang: string
  adaJabatanTarget: boolean
  jumlahKandidatPool: number
  jumlahKandidatSiap: number
}

/**
 * Jabatan yang **sudah** kosong, diurutkan dengan yang paling menganggur di atas:
 * belum punya jabatan target dulu, karena tanpa profil target kandidatnya belum
 * bisa dinilai sama sekali — itu kekosongan yang paling jauh dari terisi.
 */
export async function ambilJabatanKosongRinci(hanyaStrategis = false): Promise<{
  daftar: JabatanKosongRinci[]
  total: number
  tanpaTarget: number
}> {
  const filterEselon = hanyaStrategis ? "AND j.eselon IN ('I','II','III')" : ''

  const daftar = await kueri<Record<string, unknown>>(`
    SELECT j.id, j.kode_jabatan, j.nama_jabatan, u.nama_unit, j.eselon, j.jenjang,
           EXISTS (SELECT 1 FROM jabatan_target_anggota a WHERE a.jabatan_id = j.id) AS ada_target,
           (SELECT COUNT(*) FROM talent_pool tp
              JOIN jabatan_target_anggota a ON a.jabatan_target_id = tp.jabatan_target_id
              WHERE a.jabatan_id = j.id)                                     AS kandidat_pool,
           (SELECT COUNT(*) FROM talent_pool tp
              JOIN jabatan_target_anggota a ON a.jabatan_target_id = tp.jabatan_target_id
              WHERE a.jabatan_id = j.id AND tp.status IN ('DITETAPKAN','DIVERIFIKASI')) AS kandidat_siap
    FROM jabatan j
    JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
    WHERE j.status_jabatan = 'KOSONG' ${filterEselon}
    ORDER BY ada_target ASC,
             FIELD(j.eselon,'I','II','III','IV','NON_ESELON'),
             j.nama_jabatan
  `)

  const petakan = (r: Record<string, unknown>): JabatanKosongRinci => ({
    id: Number(r.id),
    kodeJabatan: String(r.kode_jabatan),
    namaJabatan: String(r.nama_jabatan),
    namaUnit: String(r.nama_unit),
    eselon: String(r.eselon),
    jenjang: String(r.jenjang),
    adaJabatanTarget: Number(r.ada_target) === 1,
    jumlahKandidatPool: Number(r.kandidat_pool),
    jumlahKandidatSiap: Number(r.kandidat_siap),
  })

  const hasil = daftar.map(petakan)
  return {
    daftar: hasil,
    total: hasil.length,
    tanpaTarget: hasil.filter((d) => !d.adaJabatanTarget).length,
  }
}

export interface PejabatBerisiko {
  pegawaiId: number
  nip: string
  nama: string
  namaJabatan: string
  namaUnit: string
  eselon: string
  jenjang: string
  jenisJabatan: string
  usia: number | null
  batasUsiaPensiun: number
  tahunKePensiun: number | null
  lamaMenjabatTahun: number | null
  adaJabatanTarget: boolean
  jumlahKandidatSiap: number
}

/**
 * Pejabat yang **akan** mengosongkan jabatannya — inilah bagian U-6 yang tidak
 * tercakup PRD (Lampiran B langkah 2 meminta jabatan *berisiko* kosong, bukan
 * yang sudah kosong).
 *
 * Semua bahannya sudah ada di NIP (phase.md §3 K-6), jadi tidak butuh kolom baru
 * dan tidak menunggu data baru: tanggal lahir dari NIP → usia → proyeksi BUP per
 * jenis jabatan (58/60/65). Yang diambil SQL hanya baris & angka pendampingnya;
 * proyeksi pensiunnya dihitung `lib/nip.ts` supaya aturan BUP tetap satu tempat.
 */
export async function ambilPejabatBerisiko(ambangTahun = 3): Promise<{
  daftar: PejabatBerisiko[]
  totalDiperiksa: number
  nipTidakTerbaca: number
}> {
  const baris = await kueri<Record<string, unknown>>(`
    SELECT p.id, p.nip, p.nama_lengkap, p.tmt_jabatan,
           j.id AS jabatan_id, j.nama_jabatan, j.eselon, j.jenjang, j.jenis_jabatan,
           u.nama_unit,
           EXISTS (SELECT 1 FROM jabatan_target_anggota a WHERE a.jabatan_id = j.id) AS ada_target,
           (SELECT COUNT(*) FROM talent_pool tp
              JOIN jabatan_target_anggota a ON a.jabatan_target_id = tp.jabatan_target_id
              WHERE a.jabatan_id = j.id AND tp.status IN ('DITETAPKAN','DIVERIFIKASI')) AS kandidat_siap
    FROM pegawai p
    JOIN jabatan j ON j.id = p.jabatan_id
    JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
    WHERE p.status_aktif = 'AKTIF' AND j.status_jabatan = 'TERISI'
      ${filterSumber('p')}
  `)

  const sekarang = new Date()
  let nipTidakTerbaca = 0
  const daftar: PejabatBerisiko[] = []

  for (const r of baris) {
    const nip = String(r.nip)
    const terurai = parseNip(nip, sekarang)
    if (terurai.tanggalLahir === null) {
      nipTidakTerbaca += 1
      continue
    }

    const jenisJabatan = String(r.jenis_jabatan) as JenisJabatan
    const jenjang = String(r.jenjang)
    const pensiun = proyeksiPensiun(terurai.tanggalLahir, jenisJabatan, jenjang, sekarang)
    if (pensiun.tahunTersisa === null || pensiun.tahunTersisa > ambangTahun) continue

    const tmtJabatan = r.tmt_jabatan ? new Date(String(r.tmt_jabatan)) : null

    daftar.push({
      pegawaiId: Number(r.id),
      nip,
      nama: String(r.nama_lengkap),
      namaJabatan: String(r.nama_jabatan),
      namaUnit: String(r.nama_unit),
      eselon: String(r.eselon),
      jenjang,
      jenisJabatan,
      usia: hitungUsia(terurai.tanggalLahir, sekarang),
      batasUsiaPensiun: pensiun.batasUsia,
      tahunKePensiun: pensiun.tahunTersisa,
      lamaMenjabatTahun: selisihTahun(tmtJabatan, sekarang),
      adaJabatanTarget: Number(r.ada_target) === 1,
      jumlahKandidatSiap: Number(r.kandidat_siap),
    })
  }

  // Paling mendesak di atas: paling dekat pensiun, lalu eselon tertinggi.
  const urutEselon = ['I', 'II', 'III', 'IV', 'NON_ESELON']
  daftar.sort(
    (a, b) =>
      (a.tahunKePensiun ?? 99) - (b.tahunKePensiun ?? 99) ||
      urutEselon.indexOf(a.eselon) - urutEselon.indexOf(b.eselon),
  )

  return { daftar, totalDiperiksa: baris.length, nipTidakTerbaca }
}
