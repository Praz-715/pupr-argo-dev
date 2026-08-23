import 'server-only'

import { angka, angkaWajib, kueri, kueriSatu } from '../db'
import { ambangSumbuDari, ambilPengaturan } from '../pengaturan'
import { BOBOT_FORMULA_A, ekspresiSqlKotak9, type AmbangSumbu, type Kotak9 } from '../scoring'
import { CTE_ASESMEN_TERBARU, SUBKUERI_UNIT_TURUNAN, filterSumber } from './dasar'

/**
 * Kueri Peta Talenta (Fase 3, U-1) — grid 3×3, bubble Kinerja × Potensial, dan
 * drill-down per sel, **semuanya berfilter** unit/eselon/jenjang/tahun.
 *
 * **Ambang Kotak 9 dibaca dari `pengaturan_sistem`** (butir 7, 18 Agu 2026) dan
 * diteruskan ke `ekspresiSqlKotak9()`. Kotak per jabatan target tidak tersimpan
 * di kolom mana pun — ia lahir saat kueri berjalan — jadi kalau kueri ini
 * memakai angka kode sementara `asesmen_talenta.kotak_9` ditulis memakai angka
 * DB, tampilan generik dan tampilan per jabatan target akan memindahkan orang
 * ke kotak berbeda tanpa satu pun galat. `verifikasi:skoring` menjaganya.
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
  /**
   * Jabatan target terpilih (Fase 11, U-13). Kalau diisi, sumbu X memakai
   * **komposit 65/20/15** dari `match_score.skor_total`; kalau tidak, Potkom apa
   * adanya dari e-Nominasi. Keduanya sah dan menjawab pertanyaan berbeda —
   * phase.md §2.10.
   */
  jabatanTargetId?: number
}

/**
 * Dua sumbu X, satu bentuk kueri.
 *
 * Yang berbeda bukan cuma nama kolomnya. Pada tampilan per jabatan target,
 * **`kotak_9` tidak ada di kolom mana pun** dan harus lahir saat kueri berjalan
 * (`ekspresiSqlKotak9`) — begitu juga Nilai Talenta: `a.nilai_talenta` yang
 * tersimpan dihitung dari Potkom, jadi memakainya di tampilan per target akan
 * mencampur dua definisi sumbu X dalam satu baris dan angkanya tidak akan
 * konsisten dengan kotak yang menampungnya.
 *
 * `LEFT JOIN`, bukan `INNER` — dan itu keputusan, bukan kelonggaran. Pegawai yang
 * belum punya `match_score` untuk target itu harus bisa **dihitung sebagai
 * "belum dinilai"**; dengan `INNER JOIN` mereka lenyap dari halaman dan totalnya
 * mengecil tanpa penjelasan, atau lebih buruk, kalau `skor_total` NULL dianggap 0
 * mereka jatuh ke Kotak 1/4 dan terbaca sebagai talenta terburuk (phase.md §3
 * K-7b).
 */
interface SumbuX {
  join: string
  paramJoin: unknown[]
  x: string
  kotak: string
  talenta: string
  /** Menyaring yang belum punya skor keluar dari sel — lihat K-7b. */
  syaratDinilai: string | null
}

function sumbuX(f: FilterPeta, ambang: AmbangSumbu): SumbuX {
  if (f.jabatanTargetId === undefined) {
    return {
      join: '',
      paramJoin: [],
      x: 'a.nilai_potensial_x',
      kotak: 'a.kotak_9',
      talenta: 'a.nilai_talenta',
      syaratDinilai: null,
    }
  }

  const x = 'ms.skor_total'
  return {
    join: 'LEFT JOIN match_score ms ON ms.pegawai_id = p.id AND ms.jabatan_target_id = ?',
    paramJoin: [f.jabatanTargetId],
    x,
    kotak: ekspresiSqlKotak9('a.nilai_kinerja_y', x, ambang),
    // Bobot diambil dari konstanta Formula A, bukan ditulis `0.5` — kalau
    // bobotnya berubah, tidak ada angka 50/50 kedua yang tertinggal di SQL.
    talenta: `(a.nilai_kinerja_y * ${BOBOT_FORMULA_A.kinerja} + ${x} * ${BOBOT_FORMULA_A.potensial})`,
    syaratDinilai: `${x} IS NOT NULL`,
  }
}

function syaratFilter(f: FilterPeta): { syarat: string[]; params: unknown[] } {
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

  // Sudah terikat lewat `JOIN pegawai` dari `asesmen_terbaru`, jadi di sini
  // filternya redundan SELAMA seluruh asesmen berasal dari eNom. Ditambahkan
  // tetap, supaya definisi populasinya satu dan tidak bergantung pada keadaan
  // data yang kebetulan seragam hari ini.
  const batas = filterSumber('p')
  if (batas) syarat.push(batas.replace(/^ AND /, ''))

  return { syarat, params }
}

/** FROM+JOIN dasar; `sumbuX().join` ditempelkan sesudahnya bila ada. */
const DARI_ASESMEN = `
  FROM asesmen_terbaru a
  JOIN pegawai p ON p.id = a.pegawai_id
  LEFT JOIN jabatan j ON j.id = p.jabatan_id
  LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
`

interface BentukKueri {
  dari: string
  where: string
  params: unknown[]
  sx: SumbuX
}

/**
 * Susun FROM+JOIN+WHERE sekaligus supaya **urutan parameternya tidak bisa
 * tertukar**. Parameter `JOIN` muncul lebih dulu di teks SQL, jadi ia harus lebih
 * dulu juga di array — kalau tertukar, MySQL menerima id jabatan target sebagai
 * id unit dan hasilnya nol baris **tanpa galat apa pun**, yang di halaman terbaca
 * sebagai "tidak ada pegawai di jabatan target ini".
 */
function bangunKueriPeta(f: FilterPeta, ambang: AmbangSumbu): BentukKueri {
  const sx = sumbuX(f, ambang)
  const { syarat, params } = syaratFilter(f)
  if (sx.syaratDinilai !== null) syarat.push(sx.syaratDinilai)

  return {
    dari: `${DARI_ASESMEN} ${sx.join}`,
    where: syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : '',
    params: [...sx.paramJoin, ...params],
    sx,
  }
}

// ---------------------------------------------------------------------------
// Grid 3×3 + basis data
// ---------------------------------------------------------------------------

export interface PetaSebaran {
  perKotak: Map<Kotak9, number>
  totalDinilai: number
  /** Pegawai aktif tanpa asesmen sama sekali — di luar peta, wajib disebut. */
  tanpaAsesmen: number
  /**
   * Punya asesmen (jadi ia **seharusnya** ada di peta) tapi belum punya
   * `match_score` untuk jabatan target terpilih. Selalu 0 pada tampilan generik.
   * Wajib disebut di halaman — lihat K-7b.
   */
  belumDinilaiTarget: number
  /** Termasuk dalam peta tapi asesmennya kedaluwarsa (kalau tidak difilter). */
  kedaluwarsa: number
  tahunTerlama: number | null
  tahunTerbaru: number | null
}

export async function ambilPetaSebaran(f: FilterPeta): Promise<PetaSebaran> {
  const { dari, where, params, sx } = bangunKueriPeta(f, ambangSumbuDari(await ambilPengaturan()))

  const [sebaran, ringkas, tanpa, belum] = await Promise.all([
    kueri<{ kotak: number; jml: number }>(
      // Alias `kotak` (bukan `kotak_9`) supaya `GROUP BY` tidak pernah bisa
      // dibaca sebagai kolom tabel pada tampilan generik.
      `${CTE_ASESMEN_TERBARU}
       SELECT ${sx.kotak} AS kotak, COUNT(*) AS jml ${dari} ${where}
       GROUP BY kotak`,
      params,
    ),
    kueriSatu<Record<string, unknown>>(
      `${CTE_ASESMEN_TERBARU}
       SELECT COUNT(*) AS total,
              SUM(a.status_asesmen = 'Expired') AS kedaluwarsa,
              MIN(a.tahun_asesmen) AS tahun_min,
              MAX(a.tahun_asesmen) AS tahun_maks
       ${dari} ${where}`,
      params,
    ),
    // Pegawai tanpa asesmen tidak punya baris `a`, jadi dihitung terpisah dengan
    // filter yang sama minus syarat yang menyentuh kolom asesmen.
    hitungTanpaAsesmen(f),
    hitungBelumDinilaiTarget(f),
  ])

  const perKotak = new Map<Kotak9, number>()
  for (const r of sebaran) perKotak.set(Number(r.kotak) as Kotak9, Number(r.jml))

  return {
    perKotak,
    totalDinilai: angkaWajib(ringkas?.total as number),
    kedaluwarsa: Number(ringkas?.kedaluwarsa ?? 0),
    tahunTerlama: angka(ringkas?.tahun_min as number),
    tahunTerbaru: angka(ringkas?.tahun_maks as number),
    tanpaAsesmen: tanpa,
    belumDinilaiTarget: belum,
  }
}

/**
 * Kebalikan `syaratDinilai`: pegawai yang cocok seluruh filter dan **punya**
 * asesmen, tapi `match_score` untuk target terpilih belum ada.
 *
 * Dihitung dengan filter yang sama persis supaya angkanya bisa dijumlahkan
 * dengan `totalDinilai` — kalau filternya berbeda sedikit saja, halaman akan
 * memajang dua angka yang tidak menjumlah dan pembacanya tidak tahu mana yang
 * salah.
 */
async function hitungBelumDinilaiTarget(f: FilterPeta): Promise<number> {
  if (f.jabatanTargetId === undefined) return 0

  const sx = sumbuX(f, ambangSumbuDari(await ambilPengaturan()))
  const { syarat, params } = syaratFilter(f)
  syarat.push(`${sx.x} IS NULL`)

  const r = await kueriSatu<{ n: number }>(
    `${CTE_ASESMEN_TERBARU}
     SELECT COUNT(*) AS n ${DARI_ASESMEN} ${sx.join}
     WHERE ${syarat.join(' AND ')}`,
    [...sx.paramJoin, ...params],
  )
  return angkaWajib(r?.n)
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
  const { dari, where, params, sx } = bangunKueriPeta(f, ambangSumbuDari(await ambilPengaturan()))

  const baris = await kueri<Record<string, unknown>>(
    `${CTE_ASESMEN_TERBARU}
     SELECT a.nilai_kinerja_y AS y,
            ROUND(${sx.x}, 0) AS x,
            ${sx.kotak} AS kotak,
            COUNT(*) AS jml,
            SUBSTRING_INDEX(
              GROUP_CONCAT(p.nama_lengkap ORDER BY p.nama_lengkap SEPARATOR '||'), '||', 5
            ) AS contoh
     ${dari} ${where}
     GROUP BY y, x, kotak
     ORDER BY y, x`,
    params,
  )

  const titik = baris.map((r) => ({
    y: angkaWajib(r.y as string),
    x: angkaWajib(r.x as string),
    jumlah: Number(r.jml),
    kotak: Number(r.kotak) as Kotak9,
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
  const { dari, where, params, sx } = bangunKueriPeta(f, ambangSumbuDari(await ambilPengaturan()))
  const gabung = where === '' ? `WHERE ${sx.kotak} = ?` : `${where} AND ${sx.kotak} = ?`
  const hal = Math.max(1, halaman)
  const offset = (hal - 1) * UKURAN_HALAMAN_SEL

  const [daftar, hitung] = await Promise.all([
    kueri<Record<string, unknown>>(
      `${CTE_ASESMEN_TERBARU}
       SELECT p.id, p.nip, p.nama_lengkap, j.nama_jabatan, j.eselon, u.nama_unit,
              a.nilai_kinerja_y, ${sx.x} AS nilai_potensial_x, ${sx.talenta} AS nilai_talenta,
              a.rating_kinerja, a.tahun_asesmen, a.status_asesmen
       ${dari} ${gabung}
       ORDER BY nilai_talenta DESC, p.nama_lengkap
       LIMIT ? OFFSET ?`,
      [...params, kotak, UKURAN_HALAMAN_SEL, offset],
    ),
    kueriSatu<{ n: number }>(
      `${CTE_ASESMEN_TERBARU} SELECT COUNT(*) AS n ${dari} ${gabung}`,
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

/**
 * Satu baris dropdown jabatan target, **beserta angka kejujurannya**.
 *
 * `dinilai` & `perluReview` ikut diambil di sini, bukan dihitung belakangan,
 * karena keduanya menentukan apakah angka di peta layak dipercaya: sumbu X per
 * target adalah komposit yang memuat Kualifikasi 20%, dan Kualifikasi ikut turun
 * selama antrian validasi riwayat belum dikerjakan. Halaman **wajib**
 * menyebutnya — peta yang tampak buruk karena datanya belum diperiksa, tanpa
 * mengatakannya, terbaca sebagai penilaian atas orangnya (phase.md Fase 11).
 */
export interface OpsiJabatanTarget {
  id: number
  kode: string
  nama: string
  /** Berapa pegawai punya baris `match_score` untuk target ini. */
  dinilai: number
  /** Dari yang dinilai, berapa yang skornya memuat indikator ber-`perlu_review`. */
  perluReview: number
}

export interface OpsiPeta {
  unit: Array<{ id: number; nama: string; level: number }>
  eselon: string[]
  jenjang: string[]
  tahun: number[]
  jabatanTarget: OpsiJabatanTarget[]
}

export async function ambilOpsiPeta(): Promise<OpsiPeta> {
  const [unit, eselon, jenjang, tahun, target] = await Promise.all([
    kueri<Record<string, unknown>>(
      `SELECT u.id, u.nama_unit,
              CASE WHEN u.parent_id IS NULL THEN 0
                   WHEN (SELECT p2.parent_id FROM unit_organisasi p2 WHERE p2.id = u.parent_id) IS NULL THEN 1
                   ELSE 2 END AS level
       FROM unit_organisasi u
       WHERE EXISTS (
         SELECT 1 FROM jabatan j JOIN pegawai p ON p.jabatan_id = j.id
         WHERE j.unit_organisasi_id = u.id ${filterSumber('p')}
       )
       ORDER BY level, u.nama_unit`,
    ),
    kueri<{ eselon: string }>(
      `SELECT DISTINCT j.eselon FROM jabatan j JOIN pegawai p ON p.jabatan_id = j.id
       WHERE j.eselon IS NOT NULL ${filterSumber('p')}
       ORDER BY FIELD(j.eselon,'I','II','III','IV','NON_ESELON')`,
    ),
    kueri<{ jenjang: string }>(
      `SELECT DISTINCT j.jenjang FROM jabatan j JOIN pegawai p ON p.jabatan_id = j.id
       WHERE j.jenjang IS NOT NULL ${filterSumber('p')} ORDER BY j.jenjang`,
    ),
    kueri<{ tahun: number }>(
      // Ikut disaring lewat pegawai, bukan dibaca dari asesmen_talenta apa adanya:
      // tahun yang hanya dimiliki pegawai tersembunyi akan menghasilkan peta kosong.
      `SELECT DISTINCT a.tahun_asesmen AS tahun FROM asesmen_talenta a
         JOIN pegawai p ON p.id = a.pegawai_id
        WHERE 1=1 ${filterSumber('p')} ORDER BY tahun DESC`,
    ),
    // Hanya jabatan target AKTIF. Yang DRAFT belum tentu rubriknya lolos
    // pemeriksaan, jadi menawarkannya di sini berarti memajang peta yang
    // dihitung dari aturan yang belum disetujui. Target AKTIF tanpa skor tetap
    // ditawarkan — halaman menyuruh menjalankan Hitung Ulang, bukan
    // menyembunyikannya sampai pengguna bertanya-tanya di mana targetnya.
    kueri<Record<string, unknown>>(
      `SELECT t.id, t.kode_target, t.nama_target,
              COUNT(m.id) AS dinilai,
              COALESCE(SUM(EXISTS(
                SELECT 1 FROM match_score_detail d
                WHERE d.match_score_id = m.id AND d.perlu_review = 1
              )), 0) AS perlu_review
       FROM jabatan_target t
       LEFT JOIN match_score m ON m.jabatan_target_id = t.id
       WHERE t.status = 'AKTIF'
       GROUP BY t.id, t.kode_target, t.nama_target
       ORDER BY t.nama_target`,
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
    jabatanTarget: target.map((r) => ({
      id: Number(r.id),
      kode: String(r.kode_target),
      nama: String(r.nama_target),
      dinilai: Number(r.dinilai),
      perluReview: Number(r.perlu_review),
    })),
  }
}
