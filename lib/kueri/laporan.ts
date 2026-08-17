import 'server-only'

import { angka, angkaWajib, kueri } from '../db'
import { tanggalIso } from '../param'
import { SUBKUERI_UNIT_TURUNAN, filterSumber, filterSumberPegawaiId } from './dasar'

/**
 * Kueri Laporan (Fase 8): Gap Analysis + Rekap Nominasi & Approval.
 *
 * ## Tidak ada rumus baru di sini
 *
 * Angka laporan **sudah punya sumbernya**: `match_score_detail` menyimpan skor
 * per indikator sejak Fase 5, dan `nominasi` + `approval_log` menyimpan jejak
 * keputusan sejak Fase 6. Yang belum ada cuma **agregasinya**. Jadi berkas ini
 * meng-`GROUP BY` data yang sudah ada — ia tidak menghitung ulang skor, tidak
 * menafsirkan rubrik, dan tidak mendefinisikan ulang populasi. Kalau laporan
 * dan halaman kandidat pernah berselisih angka, itu berarti salah satunya
 * menghitung sendiri, dan itulah yang dilarang (CLAUDE.md #2).
 *
 * Filter unit memakai `SUBKUERI_UNIT_TURUNAN` yang sama dengan direktori & peta
 * talenta — bukan `unit_organisasi_id = ?`. Unit eselon II tanpa turunannya
 * hampir selalu berisi nol pegawai, dan laporan yang menampilkan nol untuk unit
 * yang jelas berisi orang adalah laporan yang berhenti dipercaya.
 *
 * ## Batas yang jujur: gap per PERSYARATAN tidak tersedia
 *
 * PRD §6.8 menyebut "persyaratan jabatan target yang belum terpenuhi". Yang
 * tersimpan di `match_score` hanyalah `eligible` (satu boolean) + teks
 * `catatan_eligibility`; rincian **per persyaratan** tidak pernah dipersistensi —
 * ia dihitung di memori oleh `evaluasiKelayakan()` lalu dibuang. Dua jalan yang
 * ditolak: (a) mengurai teks catatan — rapuh, dan pesan yang berubah sedikit saja
 * membuat angka laporan bergeser tanpa ada yang tahu; (b) memanggil ulang
 * `ambilProfilKandidat()` saat merender laporan — itu pembacaan seluruh riwayat
 * setiap pegawai, dan CLAUDE.md melarangnya di luar Hitung Ulang & Simulasi.
 *
 * Jadi yang dilaporkan adalah gap **per indikator** (tersimpan, tepat, sampai
 * sub-indikator) plus ringkasan kelayakan agregat. Rincian per persyaratan butuh
 * kolom/tabel baru; itu keputusan skema, bukan sesuatu yang pantas ditebak di
 * lapisan laporan.
 */

export interface FilterLaporan {
  jabatanTargetId?: number
  unitId?: number
  /** Batas unit dari peran pengguna (`lib/lingkup.ts`) — bukan pilihan. */
  unitWajib?: number | null
  jenjang?: string
  /** Rentang `tanggal_diajukan` untuk laporan nominasi (YYYY-MM-DD). */
  dari?: string
  sampai?: string
}

/** Ambang "perlu pengembangan" — sama dengan ambang band terbawah sumbu (Lampiran A). */
export const AMBANG_GAP = 60

// ---------------------------------------------------------------------------
// Potongan WHERE yang dipakai bersama
// ---------------------------------------------------------------------------

/**
 * Syarat populasi pegawai yang dinilai. Dipakai kedua laporan supaya keduanya
 * berbicara tentang orang yang sama.
 */
function syaratPopulasi(f: FilterLaporan): { sql: string; params: unknown[] } {
  const syarat: string[] = ["p.status_aktif = 'AKTIF'"]
  const params: unknown[] = []

  if (f.jabatanTargetId) {
    syarat.push('m.jabatan_target_id = ?')
    params.push(f.jabatanTargetId)
  }
  // Dua klausa unit dipasang BERDAMPINGAN, bukan saling menimpa: irisannya
  // terbentuk sendiri, sehingga `?unit=` milik unit lain memberi nol baris
  // alih-alih diam-diam dialihkan ke unit sendiri.
  if (f.unitId) {
    syarat.push(`jb.unit_organisasi_id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(f.unitId)
  }
  if (f.unitWajib !== null && f.unitWajib !== undefined) {
    syarat.push(`jb.unit_organisasi_id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(f.unitWajib)
  }
  if (f.jenjang) {
    syarat.push('jb.jenjang = ?')
    params.push(f.jenjang)
  }
  // Opsi penyaring laporan ini SUDAH disaring ke populasi yang ditampilkan
  // (`ambilOpsiLaporan`), jadi barisnya harus ikut — kalau tidak, penyaringnya
  // menawarkan 11 pilihan dari 10 pegawai sementara angka yang dilaporkan
  // dihitung dari 43. Dua skala dalam satu halaman, dan yang salah justru yang
  // dipakai mengambil keputusan pengembangan.
  const batasPopulasi = filterSumber('p')
  if (batasPopulasi) syarat.push(batasPopulasi.replace(/^ AND /, ''))

  return { sql: syarat.join(' AND '), params }
}

// ---------------------------------------------------------------------------
// Gap Analysis
// ---------------------------------------------------------------------------

export interface BarisGapIndikator {
  jabatanTargetId: number
  namaTarget: string
  komponenId: number
  namaKomponen: string
  indikatorId: number
  namaIndikator: string
  /** null untuk sub-indikator (bobotnya sama rata by design). */
  bobot: number | null
  jumlahDinilai: number
  rataSkor: number
  skorTerendah: number
  /** Berapa pegawai yang skornya di bawah AMBANG_GAP pada indikator ini. */
  jumlahDiBawahAmbang: number
  jumlahManual: number
  jumlahPerluReview: number
}

/**
 * Gap per indikator: **inti laporan ini**.
 *
 * Hanya indikator DAUN yang dihitung (yang tidak punya anak). Node induk seperti
 * "Nilai Pengalaman Jabatan" adalah agregator murni — memasukkannya berarti
 * menghitung anak-anaknya dua kali dan menampilkan "kebutuhan pengembangan" untuk
 * sesuatu yang tidak bisa dilatih secara langsung.
 *
 * Diurutkan dari rata-rata terendah: yang paling perlu diintervensi lebih dulu,
 * bukan menurut abjad.
 */
export async function ambilGapIndikator(f: FilterLaporan = {}): Promise<BarisGapIndikator[]> {
  const { sql: where, params } = syaratPopulasi(f)

  const baris = await kueri<Record<string, unknown>>(
    `SELECT t.id   AS jabatan_target_id,
            t.nama_target,
            k.id   AS komponen_id,
            k.nama_komponen,
            i.id   AS indikator_id,
            i.nama_indikator,
            i.bobot_indikator,
            COUNT(*)                                                   AS jumlah_dinilai,
            ROUND(AVG(d.skor), 2)                                      AS rata_skor,
            MIN(d.skor)                                                AS skor_terendah,
            SUM(CASE WHEN d.skor < ? THEN 1 ELSE 0 END)                AS jumlah_di_bawah,
            SUM(CASE WHEN d.sumber_nilai = 'MANUAL' THEN 1 ELSE 0 END) AS jumlah_manual,
            SUM(CASE WHEN d.perlu_review = 1 THEN 1 ELSE 0 END)        AS jumlah_review
       FROM match_score_detail d
       JOIN match_score m   ON m.id = d.match_score_id
       JOIN rubrik_indikator i ON i.id = d.rubrik_indikator_id
       JOIN rubrik_komponen k  ON k.id = i.rubrik_komponen_id
       JOIN jabatan_target t   ON t.id = m.jabatan_target_id
       JOIN pegawai p          ON p.id = m.pegawai_id
       LEFT JOIN jabatan jb    ON jb.id = p.jabatan_id
      WHERE ${where}
        AND NOT EXISTS (SELECT 1 FROM rubrik_indikator c WHERE c.parent_indikator_id = i.id)
      GROUP BY t.id, t.nama_target, k.id, k.nama_komponen, i.id, i.nama_indikator, i.bobot_indikator
      ORDER BY rata_skor ASC, t.nama_target ASC`,
    [AMBANG_GAP, ...params],
  )

  return baris.map((r) => ({
    jabatanTargetId: angkaWajib(r.jabatan_target_id as number),
    namaTarget: String(r.nama_target),
    komponenId: angkaWajib(r.komponen_id as number),
    namaKomponen: String(r.nama_komponen),
    indikatorId: angkaWajib(r.indikator_id as number),
    namaIndikator: String(r.nama_indikator),
    bobot: angka(r.bobot_indikator as string | null),
    jumlahDinilai: angkaWajib(r.jumlah_dinilai as number),
    rataSkor: angkaWajib(r.rata_skor as string),
    skorTerendah: angkaWajib(r.skor_terendah as string),
    jumlahDiBawahAmbang: angkaWajib(r.jumlah_di_bawah as number),
    jumlahManual: angkaWajib(r.jumlah_manual as number),
    jumlahPerluReview: angkaWajib(r.jumlah_review as number),
  }))
}

export interface BarisGapKelompok {
  /** Nama unit atau jenjang, tergantung fungsi yang memanggil. */
  label: string
  jumlahDinilai: number
  jumlahEligible: number
  rataSkorTotal: number
  rataPotensiKompetensi: number
  rataKualifikasi: number
  rataIntegritas: number
}

function petakanKelompok(r: Record<string, unknown>): BarisGapKelompok {
  return {
    label: r.label === null ? '(tanpa keterangan)' : String(r.label),
    jumlahDinilai: angkaWajib(r.jumlah_dinilai as number),
    jumlahEligible: angkaWajib(r.jumlah_eligible as number),
    rataSkorTotal: angkaWajib(r.rata_total as string),
    rataPotensiKompetensi: angkaWajib(r.rata_pk as string),
    rataKualifikasi: angkaWajib(r.rata_kj as string),
    rataIntegritas: angkaWajib(r.rata_im as string),
  }
}

const KOLOM_AGREGAT_SKOR = `
  COUNT(*)                                        AS jumlah_dinilai,
  SUM(CASE WHEN m.eligible = 1 THEN 1 ELSE 0 END) AS jumlah_eligible,
  ROUND(AVG(m.skor_total), 2)                     AS rata_total,
  ROUND(AVG(m.skor_potensi_kompetensi), 2)        AS rata_pk,
  ROUND(AVG(m.skor_kualifikasi_jabatan), 2)       AS rata_kj,
  ROUND(AVG(m.skor_integritas_moralitas), 2)      AS rata_im
`

/** Rollup per unit organisasi tempat pegawai bertugas sekarang. */
export async function ambilGapPerUnit(f: FilterLaporan = {}): Promise<BarisGapKelompok[]> {
  const { sql: where, params } = syaratPopulasi(f)
  const baris = await kueri<Record<string, unknown>>(
    `SELECT u.nama_unit AS label, ${KOLOM_AGREGAT_SKOR}
       FROM match_score m
       JOIN pegawai p        ON p.id = m.pegawai_id
       LEFT JOIN jabatan jb  ON jb.id = p.jabatan_id
       LEFT JOIN unit_organisasi u ON u.id = jb.unit_organisasi_id
      WHERE ${where}
      GROUP BY u.id, u.nama_unit
      ORDER BY rata_total ASC`,
    params,
  )
  return baris.map(petakanKelompok)
}

/** Rollup per jenjang jabatan — sisi lain dari pertanyaan yang sama (PRD §6.8). */
export async function ambilGapPerJenjang(f: FilterLaporan = {}): Promise<BarisGapKelompok[]> {
  const { sql: where, params } = syaratPopulasi(f)
  const baris = await kueri<Record<string, unknown>>(
    `SELECT jb.jenjang AS label, ${KOLOM_AGREGAT_SKOR}
       FROM match_score m
       JOIN pegawai p       ON p.id = m.pegawai_id
       LEFT JOIN jabatan jb ON jb.id = p.jabatan_id
      WHERE ${where}
      GROUP BY jb.jenjang
      ORDER BY rata_total ASC`,
    params,
  )
  return baris.map(petakanKelompok)
}

export interface RingkasGap {
  jumlahJabatanTarget: number
  jumlahDinilai: number
  jumlahEligible: number
  jumlahIndikatorDiBawahAmbang: number
  jumlahNilaiManual: number
}

/** Angka pembuka halaman — supaya tiap tabel punya penyebutnya. */
export async function ambilRingkasGap(f: FilterLaporan = {}): Promise<RingkasGap> {
  const { sql: where, params } = syaratPopulasi(f)

  const [skor] = await kueri<Record<string, unknown>>(
    `SELECT COUNT(DISTINCT m.jabatan_target_id) AS jt,
            COUNT(*) AS dinilai,
            SUM(CASE WHEN m.eligible = 1 THEN 1 ELSE 0 END) AS eligible
       FROM match_score m
       JOIN pegawai p       ON p.id = m.pegawai_id
       LEFT JOIN jabatan jb ON jb.id = p.jabatan_id
      WHERE ${where}`,
    params,
  )

  const [detail] = await kueri<Record<string, unknown>>(
    `SELECT SUM(CASE WHEN d.skor < ? THEN 1 ELSE 0 END) AS di_bawah,
            SUM(CASE WHEN d.sumber_nilai = 'MANUAL' THEN 1 ELSE 0 END) AS manual
       FROM match_score_detail d
       JOIN match_score m ON m.id = d.match_score_id
       JOIN rubrik_indikator i ON i.id = d.rubrik_indikator_id
       JOIN pegawai p       ON p.id = m.pegawai_id
       LEFT JOIN jabatan jb ON jb.id = p.jabatan_id
      WHERE ${where}
        AND NOT EXISTS (SELECT 1 FROM rubrik_indikator c WHERE c.parent_indikator_id = i.id)`,
    [AMBANG_GAP, ...params],
  )

  return {
    jumlahJabatanTarget: angkaWajib(skor?.jt as number),
    jumlahDinilai: angkaWajib(skor?.dinilai as number),
    jumlahEligible: angkaWajib(skor?.eligible as number),
    jumlahIndikatorDiBawahAmbang: angkaWajib(detail?.di_bawah as number),
    jumlahNilaiManual: angkaWajib(detail?.manual as number),
  }
}

// ---------------------------------------------------------------------------
// Rekap Nominasi & Approval
// ---------------------------------------------------------------------------

/**
 * Waktu proses satu nominasi, dalam hari.
 *
 * Diukur dari `tanggal_diajukan` sampai keputusan **terminal** (DISETUJUI atau
 * DITOLAK di tahap mana pun). Nominasi yang masih berjalan diukur sampai hari ini
 * dan ditandai belum selesai — kalau yang berjalan dibuang dari rata-rata, angka
 * "waktu layanan" justru membaik setiap kali ada berkas yang menggantung lama,
 * dan itu kebalikan dari yang dipantau PRD §2.
 */
const CTE_WAKTU_PROSES = `
  WITH keputusan AS (
    SELECT a.nominasi_id, MAX(a.tanggal_aksi) AS selesai_pada
      FROM approval_log a
     WHERE a.status IN ('DISETUJUI', 'DITOLAK')
     GROUP BY a.nominasi_id
  )
`

function syaratNominasi(f: FilterLaporan): { sql: string; params: unknown[] } {
  const syarat: string[] = ['1 = 1']
  const params: unknown[] = []

  const dari = tanggalIso(f.dari)
  const sampai = tanggalIso(f.sampai)
  if (dari) {
    syarat.push('n.tanggal_diajukan >= ?')
    params.push(dari)
  }
  if (sampai) {
    syarat.push('n.tanggal_diajukan <= ?')
    params.push(sampai)
  }
  if (f.jabatanTargetId) {
    syarat.push('tp.jabatan_target_id = ?')
    params.push(f.jabatanTargetId)
  }
  if (f.unitId) {
    syarat.push(`n.diajukan_oleh_unit_id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(f.unitId)
  }
  if (f.unitWajib !== null && f.unitWajib !== undefined) {
    syarat.push(`n.diajukan_oleh_unit_id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(f.unitWajib)
  }

  const batasPopulasi = filterSumberPegawaiId('tp.pegawai_id')
  if (batasPopulasi) syarat.push(batasPopulasi.replace(/^ AND /, ''))

  return { sql: syarat.join(' AND '), params }
}

export interface BarisRekapPeriode {
  /** `YYYY-MM`. */
  periode: string
  jumlah: number
  disetujui: number
  ditolak: number
  berjalan: number
  rataHariProses: number | null
}

export async function ambilRekapPeriode(f: FilterLaporan = {}): Promise<BarisRekapPeriode[]> {
  const { sql: where, params } = syaratNominasi(f)
  const baris = await kueri<Record<string, unknown>>(
    `${CTE_WAKTU_PROSES}
     SELECT DATE_FORMAT(n.tanggal_diajukan, '%Y-%m') AS periode,
            COUNT(*) AS jumlah,
            SUM(CASE WHEN n.status = 'DISETUJUI' THEN 1 ELSE 0 END) AS disetujui,
            SUM(CASE WHEN n.status = 'DITOLAK'   THEN 1 ELSE 0 END) AS ditolak,
            SUM(CASE WHEN n.status IN ('DIAJUKAN','MENUNGGU_VERIFIKASI') THEN 1 ELSE 0 END) AS berjalan,
            ROUND(AVG(DATEDIFF(COALESCE(k.selesai_pada, NOW()), n.tanggal_diajukan)), 1) AS rata_hari
       FROM nominasi n
       JOIN talent_pool tp ON tp.id = n.talent_pool_id
       LEFT JOIN keputusan k ON k.nominasi_id = n.id
      WHERE ${where}
      GROUP BY periode
      ORDER BY periode DESC`,
    params,
  )
  return baris.map((r) => ({
    periode: String(r.periode),
    jumlah: angkaWajib(r.jumlah as number),
    disetujui: angkaWajib(r.disetujui as number),
    ditolak: angkaWajib(r.ditolak as number),
    berjalan: angkaWajib(r.berjalan as number),
    rataHariProses: angka(r.rata_hari as string | null),
  }))
}

export interface BarisRekapUnit {
  unitId: number | null
  namaUnit: string
  jumlah: number
  disetujui: number
  ditolak: number
  berjalan: number
  rataHariProses: number | null
}

export async function ambilRekapUnit(f: FilterLaporan = {}): Promise<BarisRekapUnit[]> {
  const { sql: where, params } = syaratNominasi(f)
  const baris = await kueri<Record<string, unknown>>(
    `${CTE_WAKTU_PROSES}
     SELECT u.id AS unit_id, u.nama_unit,
            COUNT(*) AS jumlah,
            SUM(CASE WHEN n.status = 'DISETUJUI' THEN 1 ELSE 0 END) AS disetujui,
            SUM(CASE WHEN n.status = 'DITOLAK'   THEN 1 ELSE 0 END) AS ditolak,
            SUM(CASE WHEN n.status IN ('DIAJUKAN','MENUNGGU_VERIFIKASI') THEN 1 ELSE 0 END) AS berjalan,
            ROUND(AVG(DATEDIFF(COALESCE(k.selesai_pada, NOW()), n.tanggal_diajukan)), 1) AS rata_hari
       FROM nominasi n
       JOIN talent_pool tp ON tp.id = n.talent_pool_id
       LEFT JOIN keputusan k ON k.nominasi_id = n.id
       LEFT JOIN unit_organisasi u ON u.id = n.diajukan_oleh_unit_id
      WHERE ${where}
      GROUP BY u.id, u.nama_unit
      ORDER BY jumlah DESC, u.nama_unit ASC`,
    params,
  )
  return baris.map((r) => ({
    unitId: angka(r.unit_id as number | null),
    namaUnit: r.nama_unit === null ? '(unit tidak tercatat)' : String(r.nama_unit),
    jumlah: angkaWajib(r.jumlah as number),
    disetujui: angkaWajib(r.disetujui as number),
    ditolak: angkaWajib(r.ditolak as number),
    berjalan: angkaWajib(r.berjalan as number),
    rataHariProses: angka(r.rata_hari as string | null),
  }))
}

export interface BarisRekapTahap {
  tahap: string
  jumlahKeputusan: number
  disetujui: number
  ditolak: number
  revisi: number
  menunggu: number
}

/** Sebaran keputusan per tahap — memperlihatkan di tahap mana berkas tertahan. */
export async function ambilRekapTahap(f: FilterLaporan = {}): Promise<BarisRekapTahap[]> {
  const { sql: where, params } = syaratNominasi(f)
  const baris = await kueri<Record<string, unknown>>(
    `SELECT a.tahap,
            COUNT(*) AS jumlah,
            SUM(CASE WHEN a.status = 'DISETUJUI' THEN 1 ELSE 0 END) AS disetujui,
            SUM(CASE WHEN a.status = 'DITOLAK'   THEN 1 ELSE 0 END) AS ditolak,
            SUM(CASE WHEN a.status = 'REVISI'    THEN 1 ELSE 0 END) AS revisi,
            SUM(CASE WHEN a.status = 'MENUNGGU'  THEN 1 ELSE 0 END) AS menunggu
       FROM approval_log a
       JOIN nominasi n ON n.id = a.nominasi_id
       JOIN talent_pool tp ON tp.id = n.talent_pool_id
      WHERE ${where}
      GROUP BY a.tahap
      ORDER BY a.tahap ASC`,
    params,
  )
  return baris.map((r) => ({
    tahap: String(r.tahap),
    jumlahKeputusan: angkaWajib(r.jumlah as number),
    disetujui: angkaWajib(r.disetujui as number),
    ditolak: angkaWajib(r.ditolak as number),
    revisi: angkaWajib(r.revisi as number),
    menunggu: angkaWajib(r.menunggu as number),
  }))
}

export interface BarisNominasiLaporan {
  nominasiId: number
  nip: string
  nama: string
  namaTarget: string
  namaUnitPengaju: string
  tanggalDiajukan: string
  status: string
  statusPool: string
  selesaiPada: string | null
  hariProses: number | null
  jumlahTahap: number
}

/** Baris rinci — isi tabel laporan sekaligus sumber ekspor CSV-nya. */
export async function ambilNominasiRinci(
  f: FilterLaporan = {},
  batas = 500,
): Promise<BarisNominasiLaporan[]> {
  const { sql: where, params } = syaratNominasi(f)
  const baris = await kueri<Record<string, unknown>>(
    `${CTE_WAKTU_PROSES}
     SELECT n.id AS nominasi_id, p.nip, p.nama_lengkap, t.nama_target,
            u.nama_unit, n.tanggal_diajukan, n.status, tp.status AS status_pool,
            k.selesai_pada,
            DATEDIFF(COALESCE(k.selesai_pada, NOW()), n.tanggal_diajukan) AS hari_proses,
            (SELECT COUNT(*) FROM approval_log al WHERE al.nominasi_id = n.id) AS jumlah_tahap
       FROM nominasi n
       JOIN talent_pool tp ON tp.id = n.talent_pool_id
       JOIN pegawai p      ON p.id = tp.pegawai_id
       JOIN jabatan_target t ON t.id = tp.jabatan_target_id
       LEFT JOIN keputusan k ON k.nominasi_id = n.id
       LEFT JOIN unit_organisasi u ON u.id = n.diajukan_oleh_unit_id
      WHERE ${where}
      ORDER BY n.tanggal_diajukan DESC, n.id DESC
      LIMIT ?`,
    [...params, Math.min(Math.max(batas, 1), 5000)],
  )
  return baris.map((r) => ({
    nominasiId: angkaWajib(r.nominasi_id as number),
    nip: String(r.nip),
    nama: String(r.nama_lengkap),
    namaTarget: String(r.nama_target),
    namaUnitPengaju: r.nama_unit === null ? '(unit tidak tercatat)' : String(r.nama_unit),
    tanggalDiajukan: String(r.tanggal_diajukan).slice(0, 10),
    status: String(r.status),
    statusPool: String(r.status_pool),
    selesaiPada: r.selesai_pada === null ? null : String(r.selesai_pada).slice(0, 10),
    hariProses: angka(r.hari_proses as number | null),
    jumlahTahap: angkaWajib(r.jumlah_tahap as number),
  }))
}

// ---------------------------------------------------------------------------
// Opsi penyaring
// ---------------------------------------------------------------------------

export interface OpsiLaporan {
  jabatanTarget: Array<{ id: number; nama: string }>
  unit: Array<{ id: number; nama: string }>
  jenjang: string[]
  /** Rentang tanggal nominasi yang benar-benar ada di data. */
  rentang: { paling_lama: string | null; paling_baru: string | null }
}

/**
 * Pilihan penyaring diturunkan dari **isi tabel**, bukan daftar tetap — jabatan
 * target & unit bertambah dari UI, dan daftar yang ditulis tangan akan
 * ketinggalan tanpa ada yang menyadarinya.
 */
export async function ambilOpsiLaporan(): Promise<OpsiLaporan> {
  const [target, unit, jenjang, rentang] = await Promise.all([
    kueri<Record<string, unknown>>(
      // Hanya jabatan target yang BENAR-BENAR punya rincian skor pada populasi
      // yang ditampilkan. Daftar seluruh jabatan_target memuat yang DRAFT/belum
      // dihitung, dan memilihnya menghasilkan laporan kosong — penyaring yang
      // menawarkan pilihan yang pasti nol terbaca seperti laporannya rusak.
      `SELECT DISTINCT t.id, t.nama_target
         FROM jabatan_target t
         JOIN match_score m ON m.jabatan_target_id = t.id
         JOIN match_score_detail d ON d.match_score_id = m.id
         JOIN pegawai p ON p.id = m.pegawai_id
        WHERE 1=1 ${filterSumber('p')}
        ORDER BY t.nama_target ASC`,
    ),
    kueri<Record<string, unknown>>(
      // Diturunkan dari PEGAWAI yang ada, bukan dari tabel jabatan. Versi
      // sebelumnya memuat setiap unit yang punya kursi — termasuk yang tidak
      // berpegawai — sehingga penyaringnya menawarkan unit yang pasti menjawab
      // nol baris laporan.
      `SELECT DISTINCT u.id, u.nama_unit
         FROM unit_organisasi u
         JOIN jabatan j ON j.unit_organisasi_id = u.id
         JOIN pegawai p ON p.jabatan_id = j.id
        WHERE 1=1 ${filterSumber('p')}
        ORDER BY u.nama_unit ASC`,
    ),
    kueri<Record<string, unknown>>(
      `SELECT DISTINCT j.jenjang FROM jabatan j
         JOIN pegawai p ON p.jabatan_id = j.id
        WHERE j.jenjang IS NOT NULL AND j.jenjang <> '' ${filterSumber('p')}
        ORDER BY j.jenjang ASC`,
    ),
    kueri<Record<string, unknown>>(
      `SELECT MIN(n.tanggal_diajukan) AS paling_lama, MAX(n.tanggal_diajukan) AS paling_baru
         FROM nominasi n
         JOIN talent_pool tp ON tp.id = n.talent_pool_id
        WHERE 1 = 1 ${filterSumberPegawaiId('tp.pegawai_id')}`,
    ),
  ])

  return {
    jabatanTarget: target.map((r) => ({
      id: angkaWajib(r.id as number),
      nama: String(r.nama_target),
    })),
    unit: unit.map((r) => ({ id: angkaWajib(r.id as number), nama: String(r.nama_unit) })),
    jenjang: jenjang.map((r) => String(r.jenjang)),
    rentang: {
      paling_lama:
        rentang[0]?.paling_lama === null || rentang[0]?.paling_lama === undefined
          ? null
          : String(rentang[0].paling_lama).slice(0, 10),
      paling_baru:
        rentang[0]?.paling_baru === null || rentang[0]?.paling_baru === undefined
          ? null
          : String(rentang[0].paling_baru).slice(0, 10),
    },
  }
}
