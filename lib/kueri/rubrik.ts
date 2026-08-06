import 'server-only'

import { angka, angkaWajib, kueri, kueriSatu } from '../db'
import type { KunciIndikator } from '../penilaian'
import type { ProfilKandidat, RubrikJabatanTarget, SkorTersimpan } from '../skor-massal'
import type {
  IndikatorNode,
  KategoriSkor,
  KomponenNode,
  ModeSkor,
  NilaiMentah,
  Persyaratan,
  Predikat,
  StatusAsesmen,
  Sumbu,
} from '../scoring'
import type { Eselon, JenisSyarat } from '../scoring/eligibility'
import type { TingkatPendidikan } from '../normalisasi'
import { CTE_ASESMEN_TERBARU } from './dasar'

/**
 * Kueri Rule Engine — Jabatan Target & rubrik (Fase 5).
 *
 * Dua jenis pembacaan yang sengaja DIPISAH, karena biayanya beda kelas:
 *
 *   - **Per halaman** (`ambilDaftarJabatanTarget`, `ambilKandidatTersimpan`, …):
 *     agregasi & paginasi di SQL, aman dipakai saat merender (phase.md §3 K-5).
 *   - **Per perhitungan** (`ambilProfilKandidat`): memuat riwayat lengkap SELURUH
 *     pegawai ke memori. Itu memang perlu — match score bergantung pada riwayat
 *     jabatan, pendidikan, dan disiplin tiap orang, dan tidak bisa diagregasi di
 *     SQL. Karena itu ia hanya dipanggil oleh perhitungan ulang & simulasi, tidak
 *     pernah oleh render halaman biasa.
 */

// ---------------------------------------------------------------------------
// Daftar & detail jabatan target
// ---------------------------------------------------------------------------

export type StatusJabatanTarget = 'DRAFT' | 'AKTIF' | 'NONAKTIF'

export interface BarisJabatanTarget {
  id: number
  kodeTarget: string
  namaTarget: string
  deskripsi: string | null
  status: StatusJabatanTarget
  kataKunciRelevansi: string[]
  jumlahAnggota: number
  jumlahKomponen: number
  jumlahIndikator: number
  jumlahPersyaratan: number
  /** Pegawai yang lolos syarat menurut perhitungan terakhir. */
  jumlahEligible: number
  jumlahDinilai: number
  jumlahPool: number
  /** Perhitungan match score terakhir; null = belum pernah dihitung. */
  dihitungPada: string | null
  namaPembuat: string | null
}

export async function ambilDaftarJabatanTarget(): Promise<BarisJabatanTarget[]> {
  const baris = await kueri<Record<string, unknown>>(`
    SELECT t.id, t.kode_target, t.nama_target, t.deskripsi, t.status, t.kata_kunci_relevansi,
           u.nama AS nama_pembuat,
           (SELECT COUNT(*) FROM jabatan_target_anggota a WHERE a.jabatan_target_id = t.id)   AS jumlah_anggota,
           (SELECT COUNT(*) FROM rubrik_komponen k WHERE k.jabatan_target_id = t.id)          AS jumlah_komponen,
           (SELECT COUNT(*) FROM rubrik_indikator i
              JOIN rubrik_komponen k ON k.id = i.rubrik_komponen_id
              WHERE k.jabatan_target_id = t.id)                                              AS jumlah_indikator,
           (SELECT COUNT(*) FROM jabatan_target_persyaratan p WHERE p.jabatan_target_id = t.id) AS jumlah_persyaratan,
           (SELECT COUNT(*) FROM match_score m WHERE m.jabatan_target_id = t.id)             AS jumlah_dinilai,
           (SELECT COUNT(*) FROM match_score m WHERE m.jabatan_target_id = t.id AND m.eligible = 1) AS jumlah_eligible,
           (SELECT COUNT(*) FROM talent_pool tp WHERE tp.jabatan_target_id = t.id)           AS jumlah_pool,
           (SELECT MAX(m.computed_at) FROM match_score m WHERE m.jabatan_target_id = t.id)   AS dihitung_pada
    FROM jabatan_target t
    LEFT JOIN users u ON u.id = t.dibuat_oleh
    ORDER BY FIELD(t.status, 'AKTIF', 'DRAFT', 'NONAKTIF'), t.nama_target
  `)

  return baris.map(petakanBarisTarget)
}

export async function ambilJabatanTarget(id: number): Promise<BarisJabatanTarget | null> {
  const baris = await kueriSatu<Record<string, unknown>>(
    `SELECT t.id, t.kode_target, t.nama_target, t.deskripsi, t.status, t.kata_kunci_relevansi,
            u.nama AS nama_pembuat,
            (SELECT COUNT(*) FROM jabatan_target_anggota a WHERE a.jabatan_target_id = t.id)   AS jumlah_anggota,
            (SELECT COUNT(*) FROM rubrik_komponen k WHERE k.jabatan_target_id = t.id)          AS jumlah_komponen,
            (SELECT COUNT(*) FROM rubrik_indikator i
               JOIN rubrik_komponen k ON k.id = i.rubrik_komponen_id
               WHERE k.jabatan_target_id = t.id)                                              AS jumlah_indikator,
            (SELECT COUNT(*) FROM jabatan_target_persyaratan p WHERE p.jabatan_target_id = t.id) AS jumlah_persyaratan,
            (SELECT COUNT(*) FROM match_score m WHERE m.jabatan_target_id = t.id)             AS jumlah_dinilai,
            (SELECT COUNT(*) FROM match_score m WHERE m.jabatan_target_id = t.id AND m.eligible = 1) AS jumlah_eligible,
            (SELECT COUNT(*) FROM talent_pool tp WHERE tp.jabatan_target_id = t.id)           AS jumlah_pool,
            (SELECT MAX(m.computed_at) FROM match_score m WHERE m.jabatan_target_id = t.id)   AS dihitung_pada
     FROM jabatan_target t
     LEFT JOIN users u ON u.id = t.dibuat_oleh
     WHERE t.id = ?`,
    [id],
  )
  return baris === null ? null : petakanBarisTarget(baris)
}

function petakanBarisTarget(r: Record<string, unknown>): BarisJabatanTarget {
  return {
    id: Number(r.id),
    kodeTarget: String(r.kode_target),
    namaTarget: String(r.nama_target),
    deskripsi: r.deskripsi === null ? null : String(r.deskripsi),
    status: String(r.status) as StatusJabatanTarget,
    kataKunciRelevansi: bacaJsonTeks(r.kata_kunci_relevansi),
    jumlahAnggota: Number(r.jumlah_anggota),
    jumlahKomponen: Number(r.jumlah_komponen),
    jumlahIndikator: Number(r.jumlah_indikator),
    jumlahPersyaratan: Number(r.jumlah_persyaratan),
    jumlahEligible: Number(r.jumlah_eligible),
    jumlahDinilai: Number(r.jumlah_dinilai),
    jumlahPool: Number(r.jumlah_pool),
    dihitungPada: r.dihitung_pada === null ? null : String(r.dihitung_pada),
    namaPembuat: r.nama_pembuat === null ? null : String(r.nama_pembuat),
  }
}

/** Kolom JSON MySQL bisa datang sebagai array ATAU string, tergantung driver. */
function bacaJsonTeks(nilai: unknown): string[] {
  if (nilai === null || nilai === undefined) return []
  if (Array.isArray(nilai)) return nilai.map(String)
  if (typeof nilai === 'string') {
    try {
      const urai: unknown = JSON.parse(nilai)
      return Array.isArray(urai) ? urai.map(String) : []
    } catch {
      return []
    }
  }
  return []
}

// ---------------------------------------------------------------------------
// Pohon rubrik
// ---------------------------------------------------------------------------

/** Kategori skor beserta id-nya — editor perlu id untuk menyunting & menghapus. */
export interface KategoriRubrik extends KategoriSkor {
  id: number
}

export interface IndikatorRubrik extends IndikatorNode {
  kunci: KunciIndikator | null
  kebutuhanData: string | null
  sumberData: string | null
  parentIndikatorId: number | null
  kategori: KategoriRubrik[]
  anak: IndikatorRubrik[]
}

export interface KomponenRubrik extends KomponenNode {
  jabatanTargetId: number | null
  indikator: IndikatorRubrik[]
}

/**
 * Rubrik satu jabatan target (atau rubrik generik bila `jabatanTargetId` null).
 *
 * Bentuknya sengaja **superset** dari `KomponenNode`, sehingga hasilnya bisa
 * langsung diberikan ke `validasiRubrik()` dan `hitungSkorMassal()` tanpa
 * konversi — konversi antar bentuk adalah tempat paling gampang menyelipkan
 * tafsiran kedua atas rubrik yang sama.
 */
export async function ambilPohonRubrik(jabatanTargetId: number | null): Promise<KomponenRubrik[]> {
  const [komponenRaw, indikatorRaw, kategoriRaw] = await Promise.all([
    kueri<Record<string, unknown>>(
      `SELECT id, jabatan_target_id, sumbu, nama_komponen, bobot_komponen, urutan
       FROM rubrik_komponen
       WHERE ${jabatanTargetId === null ? 'jabatan_target_id IS NULL' : 'jabatan_target_id = ?'}
       ORDER BY urutan, id`,
      jabatanTargetId === null ? [] : [jabatanTargetId],
    ),
    kueri<Record<string, unknown>>(
      `SELECT i.id, i.rubrik_komponen_id, i.parent_indikator_id, i.nama_indikator, i.kunci_sistem,
              i.bobot_indikator, i.mode_skor, i.kebutuhan_data, i.sumber_data, i.urutan
       FROM rubrik_indikator i
       JOIN rubrik_komponen k ON k.id = i.rubrik_komponen_id
       WHERE ${jabatanTargetId === null ? 'k.jabatan_target_id IS NULL' : 'k.jabatan_target_id = ?'}
       ORDER BY i.urutan, i.id`,
      jabatanTargetId === null ? [] : [jabatanTargetId],
    ),
    kueri<Record<string, unknown>>(
      `SELECT s.id, s.rubrik_indikator_id, s.nama_kategori, s.nilai_skor, s.ambang_min,
              s.ambang_max, s.urutan
       FROM rubrik_kategori_skor s
       JOIN rubrik_indikator i ON i.id = s.rubrik_indikator_id
       JOIN rubrik_komponen k ON k.id = i.rubrik_komponen_id
       WHERE ${jabatanTargetId === null ? 'k.jabatan_target_id IS NULL' : 'k.jabatan_target_id = ?'}
       ORDER BY s.urutan, s.id`,
      jabatanTargetId === null ? [] : [jabatanTargetId],
    ),
  ])

  const kategoriPer = new Map<number, KategoriRubrik[]>()
  for (const k of kategoriRaw) {
    const id = Number(k.rubrik_indikator_id)
    const daftar = kategoriPer.get(id) ?? []
    daftar.push({
      id: Number(k.id),
      namaKategori: String(k.nama_kategori),
      nilaiSkor: angka(k.nilai_skor as string),
      ambangMin: angka(k.ambang_min as string),
      ambangMax: angka(k.ambang_max as string),
      urutan: Number(k.urutan),
    })
    kategoriPer.set(id, daftar)
  }

  function buat(r: Record<string, unknown>, semua: Array<Record<string, unknown>>): IndikatorRubrik {
    const id = Number(r.id)
    return {
      id,
      namaIndikator: String(r.nama_indikator),
      kunci: r.kunci_sistem === null ? null : (String(r.kunci_sistem) as KunciIndikator),
      bobot: angka(r.bobot_indikator as string),
      modeSkor: String(r.mode_skor) as ModeSkor,
      kebutuhanData: r.kebutuhan_data === null ? null : String(r.kebutuhan_data),
      sumberData: r.sumber_data === null ? null : String(r.sumber_data),
      parentIndikatorId: r.parent_indikator_id === null ? null : Number(r.parent_indikator_id),
      urutan: Number(r.urutan),
      kategori: kategoriPer.get(id) ?? [],
      anak: semua
        .filter((a) => a.parent_indikator_id !== null && Number(a.parent_indikator_id) === id)
        .map((a) => buat(a, semua)),
    }
  }

  return komponenRaw.map((k): KomponenRubrik => {
    const milikKomponen = indikatorRaw.filter(
      (i) => Number(i.rubrik_komponen_id) === Number(k.id),
    )
    return {
      id: Number(k.id),
      jabatanTargetId: k.jabatan_target_id === null ? null : Number(k.jabatan_target_id),
      sumbu: String(k.sumbu) as Sumbu,
      namaKomponen: String(k.nama_komponen),
      bobot: angkaWajib(k.bobot_komponen as string),
      urutan: Number(k.urutan),
      indikator: milikKomponen
        .filter((i) => i.parent_indikator_id === null)
        .map((i) => buat(i, milikKomponen)),
    }
  })
}

/** Jabatan target lain yang rubriknya bisa disalin — untuk dropdown duplikasi. */
export async function ambilSumberDuplikasi(
  jabatanTargetId: number,
): Promise<Array<{ id: number; nama: string; jumlahKomponen: number }>> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT t.id, t.nama_target,
            (SELECT COUNT(*) FROM rubrik_komponen k WHERE k.jabatan_target_id = t.id) AS n
     FROM jabatan_target t
     WHERE t.id <> ?
     HAVING n > 0
     ORDER BY t.nama_target`,
    [jabatanTargetId],
  )
  return baris.map((r) => ({
    id: Number(r.id),
    nama: String(r.nama_target),
    jumlahKomponen: Number(r.n),
  }))
}

/** Indikator daun beserta kuncinya — masukan `hitungSkorMassal`. */
export function indikatorBerkunciDari(komponen: KomponenRubrik[]): Array<{
  indikatorId: number
  kunci: KunciIndikator | null
}> {
  const hasil: Array<{ indikatorId: number; kunci: KunciIndikator | null }> = []
  function jelajah(node: IndikatorRubrik): void {
    if (node.anak.length === 0) {
      hasil.push({ indikatorId: node.id, kunci: node.kunci })
      return
    }
    for (const a of node.anak) jelajah(a)
  }
  for (const k of komponen) for (const i of k.indikator) jelajah(i)
  return hasil
}

// ---------------------------------------------------------------------------
// Persyaratan & jabatan anggota
// ---------------------------------------------------------------------------

export interface BarisPersyaratan extends Persyaratan {
  jabatanTargetId: number
}

export async function ambilPersyaratan(jabatanTargetId: number): Promise<BarisPersyaratan[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT id, jabatan_target_id, jenis_syarat, deskripsi, nilai_minimal
     FROM jabatan_target_persyaratan
     WHERE jabatan_target_id = ?
     ORDER BY FIELD(jenis_syarat, 'PENDIDIKAN_MIN', 'BIDANG_ILMU', 'PENGALAMAN_MIN', 'LAINNYA'), id`,
    [jabatanTargetId],
  )
  return baris.map((r) => ({
    id: Number(r.id),
    jabatanTargetId: Number(r.jabatan_target_id),
    jenisSyarat: String(r.jenis_syarat) as JenisSyarat,
    deskripsi: String(r.deskripsi),
    nilaiMinimal: r.nilai_minimal === null ? null : String(r.nilai_minimal),
  }))
}

/**
 * Selisih antara **dua penyimpanan lama** untuk satu deklarasi bidang ilmu
 * (Fase 11 no. 3, U-15).
 *
 * Sejak Fase 11 keduanya ditulis bersama oleh `simpanPersyaratan()`, jadi selisih
 * hanya bisa berasal dari **data yang sudah ada sebelum itu** — dan di `pupr_dev`
 * memang ada: target 3 menyimpan 3 kata kunci di gerbang tapi 5 di rubrik, target
 * 1–2 masih menyimpan kata *diklat* (`ppbj`, `kepemimpinan`) di daftar bidang ilmu
 * sebagai sisa sebelum `doc/sql/015`.
 *
 * Selisihnya **ditampilkan, bukan dibetulkan sendiri.** Menyeragamkannya otomatis
 * berarti membuang kata kunci yang sekarang masih menggerakkan skor Kesesuaian
 * Bidang Ilmu — yaitu mengubah skor orang tanpa ada yang memutuskannya. Yang
 * dilakukan halaman: menyatakan bahwa keduanya berbeda, menunjukkan isi
 * masing-masing, dan menyebut bahwa menyimpan akan menyeragamkan (dan menggeser
 * skor). Keputusannya milik manusia.
 */
export interface SelisihBidangIlmu {
  /** Kata kunci yang dipakai GERBANG kelayakan (`persyaratan.nilai_minimal`). */
  gerbang: string[]
  /** Kata kunci yang dipakai indikator RUBRIK (`kata_kunci_relevansi`). */
  rubrik: string[]
  /** Ada di rubrik tapi tidak di gerbang — akan HILANG kalau syaratnya disimpan. */
  hanyaDiRubrik: string[]
  /** Ada di gerbang tapi tidak di rubrik. */
  hanyaDiGerbang: string[]
}

export async function ambilSelisihBidangIlmu(
  jabatanTargetId: number,
): Promise<SelisihBidangIlmu | null> {
  const r = await kueriSatu<{ kata_kunci: unknown; nilai_minimal: string | null }>(
    `SELECT t.kata_kunci_relevansi AS kata_kunci,
            (SELECT p.nilai_minimal FROM jabatan_target_persyaratan p
              WHERE p.jabatan_target_id = t.id AND p.jenis_syarat = 'BIDANG_ILMU' LIMIT 1)
              AS nilai_minimal
       FROM jabatan_target t WHERE t.id = ?`,
    [jabatanTargetId],
  )
  if (r === null) return null

  const bersih = (v: string) => v.trim().toLowerCase()
  const rubrik = (Array.isArray(r.kata_kunci) ? (r.kata_kunci as unknown[]) : [])
    .map((v) => bersih(String(v)))
    .filter((v) => v !== '')
  const gerbang = (r.nilai_minimal ?? '')
    .split(',')
    .map(bersih)
    .filter((v) => v !== '')

  // Tidak ada satu pun yang terisi → belum dideklarasikan, bukan menyimpang.
  if (rubrik.length === 0 && gerbang.length === 0) return null

  return {
    gerbang,
    rubrik,
    hanyaDiRubrik: rubrik.filter((k) => !gerbang.includes(k)),
    hanyaDiGerbang: gerbang.filter((k) => !rubrik.includes(k)),
  }
}

export interface JabatanAnggota {
  id: number
  kodeJabatan: string
  namaJabatan: string
  namaUnit: string
  eselon: string | null
  jenjang: string | null
  statusJabatan: string
  jumlahPenghuni: number
  /** Jabatan target lain yang juga memuat jabatan ini. */
  targetLain: string | null
}

export async function ambilAnggotaJabatan(jabatanTargetId: number): Promise<JabatanAnggota[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT j.id, j.kode_jabatan, j.nama_jabatan, u.nama_unit, j.eselon, j.jenjang,
            j.status_jabatan,
            (SELECT COUNT(*) FROM pegawai p WHERE p.jabatan_id = j.id AND p.status_aktif = 'AKTIF') AS penghuni,
            (SELECT GROUP_CONCAT(t2.nama_target SEPARATOR ' · ')
               FROM jabatan_target_anggota a2
               JOIN jabatan_target t2 ON t2.id = a2.jabatan_target_id
               WHERE a2.jabatan_id = j.id AND a2.jabatan_target_id <> ?)                   AS target_lain
     FROM jabatan_target_anggota a
     JOIN jabatan j ON j.id = a.jabatan_id
     JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     WHERE a.jabatan_target_id = ?
     ORDER BY j.eselon IS NULL, j.eselon, j.nama_jabatan`,
    [jabatanTargetId, jabatanTargetId],
  )
  return baris.map(petakanJabatanAnggota)
}

/**
 * Jabatan yang BELUM jadi anggota target ini, untuk dipilih di tab Jabatan Anggota.
 * Dibatasi & bisa dicari karena master jabatan punya 47 baris di dev dan akan
 * jauh lebih banyak di produksi.
 */
export async function cariJabatanUntukTarget(
  jabatanTargetId: number,
  cari: string,
  batas = 20,
): Promise<JabatanAnggota[]> {
  const pola = `%${cari.trim()}%`
  const baris = await kueri<Record<string, unknown>>(
    `SELECT j.id, j.kode_jabatan, j.nama_jabatan, u.nama_unit, j.eselon, j.jenjang,
            j.status_jabatan,
            (SELECT COUNT(*) FROM pegawai p WHERE p.jabatan_id = j.id AND p.status_aktif = 'AKTIF') AS penghuni,
            (SELECT GROUP_CONCAT(t2.nama_target SEPARATOR ' · ')
               FROM jabatan_target_anggota a2
               JOIN jabatan_target t2 ON t2.id = a2.jabatan_target_id
               WHERE a2.jabatan_id = j.id)                                                 AS target_lain
     FROM jabatan j
     JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     WHERE j.status_jabatan <> 'DIHAPUS'
       AND NOT EXISTS (
         SELECT 1 FROM jabatan_target_anggota a
         WHERE a.jabatan_target_id = ? AND a.jabatan_id = j.id
       )
       AND (? = '' OR j.nama_jabatan LIKE ? OR j.kode_jabatan LIKE ? OR u.nama_unit LIKE ?)
     ORDER BY j.eselon IS NULL, j.eselon, j.nama_jabatan
     LIMIT ?`,
    [jabatanTargetId, cari.trim(), pola, pola, pola, batas],
  )
  return baris.map(petakanJabatanAnggota)
}

function petakanJabatanAnggota(r: Record<string, unknown>): JabatanAnggota {
  return {
    id: Number(r.id),
    kodeJabatan: String(r.kode_jabatan),
    namaJabatan: String(r.nama_jabatan),
    namaUnit: String(r.nama_unit),
    eselon: r.eselon === null ? null : String(r.eselon),
    jenjang: r.jenjang === null ? null : String(r.jenjang),
    statusJabatan: String(r.status_jabatan),
    jumlahPenghuni: Number(r.penghuni),
    targetLain: r.target_lain === null ? null : String(r.target_lain),
  }
}

// ---------------------------------------------------------------------------
// Kandidat & skor tersimpan (dibaca per halaman)
// ---------------------------------------------------------------------------

export interface BarisKandidat {
  matchScoreId: number
  pegawaiId: number
  nip: string
  nama: string
  namaJabatan: string | null
  namaUnit: string | null
  eselon: string | null
  skorPotensiKompetensi: number
  skorKualifikasiJabatan: number
  skorIntegritasMoralitas: number
  skorTotal: number
  eligible: boolean
  catatanEligibility: string | null
  computedAt: string
  /** Konteks kinerja yang wajib berdampingan dengan match score (K-4). */
  kotak9: number | null
  predikatKinerja: string | null
  nilaiKinerjaY: number | null
  tahunAsesmen: number | null
  statusAsesmen: string | null
  statusPool: string | null
  rankingPool: number | null
  jumlahPerluReview: number
  jumlahManual: number
}

export interface FilterKandidat {
  hanyaEligible?: boolean
  cari?: string
  urut?: 'skorTotal' | 'nama' | 'kotak9' | 'potkom'
  arah?: 'asc' | 'desc'
  halaman?: number
  ukuranHalaman?: number
}

const KOLOM_URUT_KANDIDAT: Record<string, string> = {
  skorTotal: 'm.skor_total',
  nama: 'p.nama_lengkap',
  kotak9: 'a.kotak_9',
  potkom: 'm.skor_potensi_kompetensi',
}

/**
 * Kandidat satu jabatan target menurut perhitungan TERAKHIR yang tersimpan.
 *
 * Sengaja membaca `match_score`, bukan menghitung ulang saat render: halaman ini
 * dibuka jauh lebih sering daripada rubriknya berubah, dan menghitung 1.872
 * pegawai per kunjungan berarti halaman yang lambat tanpa alasan. Kapan angkanya
 * dihitung ditampilkan di UI supaya pengguna tahu ia melihat keadaan kapan.
 */
export async function ambilKandidat(
  jabatanTargetId: number,
  filter: FilterKandidat = {},
): Promise<{ baris: BarisKandidat[]; total: number }> {
  const ukuran = filter.ukuranHalaman ?? 25
  const halaman = Math.max(1, filter.halaman ?? 1)
  const cari = (filter.cari ?? '').trim()
  const pola = `%${cari}%`

  // Kolom pengurutan lewat DAFTAR PUTIH — nilai dari URL tidak pernah
  // diinterpolasi ke SQL (aturan lib/kueri di CLAUDE.md).
  const kolom = KOLOM_URUT_KANDIDAT[filter.urut ?? 'skorTotal'] ?? 'm.skor_total'
  const arah = filter.arah === 'asc' ? 'ASC' : 'DESC'

  const syarat = [
    'm.jabatan_target_id = ?',
    filter.hanyaEligible ? 'm.eligible = 1' : null,
    cari === '' ? null : '(p.nama_lengkap LIKE ? OR p.nip LIKE ?)',
  ].filter((s): s is string => s !== null)

  const params: unknown[] = [jabatanTargetId]
  if (cari !== '') params.push(pola, pola)

  const where = syarat.join(' AND ')

  const [baris, total] = await Promise.all([
    kueri<Record<string, unknown>>(
      `${CTE_ASESMEN_TERBARU}
       SELECT m.id AS match_score_id, m.pegawai_id, p.nip, p.nama_lengkap,
              j.nama_jabatan, u.nama_unit, j.eselon,
              m.skor_potensi_kompetensi, m.skor_kualifikasi_jabatan,
              m.skor_integritas_moralitas, m.skor_total, m.eligible,
              m.catatan_eligibility, m.computed_at,
              a.kotak_9, a.rating_kinerja, a.nilai_kinerja_y, a.tahun_asesmen, a.status_asesmen,
              tp.status AS status_pool, tp.ranking AS ranking_pool,
              (SELECT COUNT(*) FROM match_score_detail d
                 WHERE d.match_score_id = m.id AND d.perlu_review = 1)          AS perlu_review,
              (SELECT COUNT(*) FROM match_score_detail d
                 WHERE d.match_score_id = m.id AND d.sumber_nilai = 'MANUAL')   AS manual
       FROM match_score m
       JOIN pegawai p ON p.id = m.pegawai_id
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
       LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
       LEFT JOIN asesmen_terbaru a ON a.pegawai_id = m.pegawai_id
       LEFT JOIN talent_pool tp ON tp.pegawai_id = m.pegawai_id
                               AND tp.jabatan_target_id = m.jabatan_target_id
       WHERE ${where}
       ORDER BY ${kolom} ${arah}, p.nama_lengkap ASC
       LIMIT ? OFFSET ?`,
      [...params, ukuran, (halaman - 1) * ukuran],
    ),
    kueriSatu<{ n: number }>(
      `SELECT COUNT(*) AS n
       FROM match_score m
       JOIN pegawai p ON p.id = m.pegawai_id
       WHERE ${where}`,
      params,
    ),
  ])

  return {
    baris: baris.map((r) => ({
      matchScoreId: Number(r.match_score_id),
      pegawaiId: Number(r.pegawai_id),
      nip: String(r.nip),
      nama: String(r.nama_lengkap),
      namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
      namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
      eselon: r.eselon === null ? null : String(r.eselon),
      skorPotensiKompetensi: angkaWajib(r.skor_potensi_kompetensi as string),
      skorKualifikasiJabatan: angkaWajib(r.skor_kualifikasi_jabatan as string),
      skorIntegritasMoralitas: angkaWajib(r.skor_integritas_moralitas as string),
      skorTotal: angkaWajib(r.skor_total as string),
      eligible: Number(r.eligible) === 1,
      catatanEligibility: r.catatan_eligibility === null ? null : String(r.catatan_eligibility),
      computedAt: String(r.computed_at),
      kotak9: angka(r.kotak_9 as number),
      predikatKinerja: r.rating_kinerja === null ? null : String(r.rating_kinerja),
      nilaiKinerjaY: angka(r.nilai_kinerja_y as string),
      tahunAsesmen: angka(r.tahun_asesmen as number),
      statusAsesmen: r.status_asesmen === null ? null : String(r.status_asesmen),
      statusPool: r.status_pool === null ? null : String(r.status_pool),
      rankingPool: angka(r.ranking_pool as number),
      jumlahPerluReview: Number(r.perlu_review),
      jumlahManual: Number(r.manual),
    })),
    total: Number(total?.n ?? 0),
  }
}

/** Baseline diff: skor tersimpan seluruh pegawai untuk satu jabatan target. */
export async function ambilSkorTersimpan(jabatanTargetId: number): Promise<SkorTersimpan[]> {
  const baris = await kueri<Record<string, unknown>>(
    `${CTE_ASESMEN_TERBARU}
     SELECT m.pegawai_id, m.skor_total, m.eligible, a.nilai_kinerja_y
     FROM match_score m
     LEFT JOIN asesmen_terbaru a ON a.pegawai_id = m.pegawai_id
     WHERE m.jabatan_target_id = ?`,
    [jabatanTargetId],
  )
  return baris.map((r) => ({
    pegawaiId: Number(r.pegawai_id),
    skorTotal: angkaWajib(r.skor_total as string),
    eligible: Number(r.eligible) === 1,
    nilaiKinerjaY: angka(r.nilai_kinerja_y as string),
  }))
}

export interface BarisRincianSkor {
  rubrikIndikatorId: number
  namaIndikator: string
  parentIndikatorId: number | null
  indukNama: string | null
  namaKomponen: string
  bobotKomponen: number
  bobot: number | null
  nilaiMentah: string | null
  kategoriTerpilih: string | null
  skor: number
  sumberNilai: 'OTOMATIS' | 'MANUAL'
  perluReview: boolean
  catatan: string | null
  namaPengisi: string | null
  kunci: KunciIndikator | null
}

/** Rincian perhitungan satu pegawai × satu jabatan target (U-3). */
export async function ambilRincianSkor(
  jabatanTargetId: number,
  pegawaiId: number,
): Promise<BarisRincianSkor[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT d.rubrik_indikator_id, i.nama_indikator, i.kunci_sistem, d.parent_indikator_id,
            ind.nama_indikator AS induk_nama, k.nama_komponen, k.bobot_komponen,
            d.bobot_indikator, d.nilai_mentah, d.kategori_terpilih, d.skor,
            d.sumber_nilai, d.perlu_review, d.catatan, u.nama AS nama_pengisi,
            k.urutan AS urutan_komponen, i.urutan AS urutan_indikator
     FROM match_score_detail d
     JOIN match_score m ON m.id = d.match_score_id
     JOIN rubrik_indikator i ON i.id = d.rubrik_indikator_id
     JOIN rubrik_komponen k ON k.id = i.rubrik_komponen_id
     LEFT JOIN rubrik_indikator ind ON ind.id = d.parent_indikator_id
     LEFT JOIN users u ON u.id = d.diisi_oleh
     WHERE m.jabatan_target_id = ? AND m.pegawai_id = ?
     ORDER BY urutan_komponen, COALESCE(d.parent_indikator_id, d.rubrik_indikator_id),
              d.parent_indikator_id IS NOT NULL, urutan_indikator`,
    [jabatanTargetId, pegawaiId],
  )

  return baris.map((r) => ({
    rubrikIndikatorId: Number(r.rubrik_indikator_id),
    namaIndikator: String(r.nama_indikator),
    parentIndikatorId: r.parent_indikator_id === null ? null : Number(r.parent_indikator_id),
    indukNama: r.induk_nama === null ? null : String(r.induk_nama),
    namaKomponen: String(r.nama_komponen),
    bobotKomponen: angkaWajib(r.bobot_komponen as string),
    bobot: angka(r.bobot_indikator as string),
    nilaiMentah: r.nilai_mentah === null ? null : String(r.nilai_mentah),
    kategoriTerpilih: r.kategori_terpilih === null ? null : String(r.kategori_terpilih),
    skor: angkaWajib(r.skor as string),
    sumberNilai: String(r.sumber_nilai) === 'MANUAL' ? 'MANUAL' : 'OTOMATIS',
    perluReview: Number(r.perlu_review) === 1,
    catatan: r.catatan === null ? null : String(r.catatan),
    namaPengisi: r.nama_pengisi === null ? null : String(r.nama_pengisi),
    kunci: r.kunci_sistem === null ? null : (String(r.kunci_sistem) as KunciIndikator),
  }))
}

/**
 * Nilai yang pernah diisi manusia, per pegawai per indikator.
 *
 * Dipakai perhitungan ulang supaya nilai manual **bertahan**. Tanpa ini,
 * recompute akan menimpanya dengan hasil otomatis (atau dengan kosong, untuk
 * indikator yang memang tidak punya sumber) — menghapus pekerjaan orang tanpa
 * pesan apa pun.
 */
export async function ambilNilaiManual(
  jabatanTargetId: number,
): Promise<Record<number, Record<number, NilaiMentah>>> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT m.pegawai_id, d.rubrik_indikator_id, d.nilai_mentah, d.catatan, d.diisi_oleh
     FROM match_score_detail d
     JOIN match_score m ON m.id = d.match_score_id
     WHERE m.jabatan_target_id = ? AND d.sumber_nilai = 'MANUAL' AND d.nilai_mentah IS NOT NULL`,
    [jabatanTargetId],
  )

  const peta: Record<number, Record<number, NilaiMentah>> = {}
  for (const r of baris) {
    const pegawaiId = Number(r.pegawai_id)
    const indikatorId = Number(r.rubrik_indikator_id)
    const mentah = String(r.nilai_mentah)
    const sebagaiAngka = Number(mentah)
    peta[pegawaiId] ??= {}
    peta[pegawaiId]![indikatorId] =
      mentah.trim() !== '' && !Number.isNaN(sebagaiAngka) ? sebagaiAngka : mentah
  }
  return peta
}

/** Jejak nilai manual (siapa & catatannya) supaya tidak hilang saat ditulis ulang. */
export interface JejakManual {
  pegawaiId: number
  rubrikIndikatorId: number
  catatan: string | null
  diisiOleh: number | null
}

export async function ambilJejakManual(jabatanTargetId: number): Promise<JejakManual[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT m.pegawai_id, d.rubrik_indikator_id, d.catatan, d.diisi_oleh
     FROM match_score_detail d
     JOIN match_score m ON m.id = d.match_score_id
     WHERE m.jabatan_target_id = ? AND d.sumber_nilai = 'MANUAL'`,
    [jabatanTargetId],
  )
  return baris.map((r) => ({
    pegawaiId: Number(r.pegawai_id),
    rubrikIndikatorId: Number(r.rubrik_indikator_id),
    catatan: r.catatan === null ? null : String(r.catatan),
    diisiOleh: r.diisi_oleh === null ? null : Number(r.diisi_oleh),
  }))
}

// ---------------------------------------------------------------------------
// Profil kandidat untuk perhitungan (BUKAN untuk render halaman)
// ---------------------------------------------------------------------------

/**
 * Riwayat lengkap seluruh pegawai aktif, siap dimasukkan ke `hitungSkorMassal`.
 *
 * Enam kueri, lalu dirakit di memori. Agregasi SQL tidak bisa dipakai di sini:
 * yang dibutuhkan bukan angka ringkasan, melainkan **daftar riwayat** tiap orang
 * (jabatan, pendidikan, disiplin) karena rubriknya menilai isi riwayat itu.
 * Karena itu fungsi ini hanya dipanggil perhitungan ulang & simulasi — bukan
 * saat merender halaman (phase.md §3 K-5).
 */
export async function ambilProfilKandidat(): Promise<ProfilKandidat[]> {
  const [pegawaiRaw, pendidikanRaw, riwayatRaw, hukumanRaw, kategoriRaw, asesmenRaw] =
    await Promise.all([
    kueri<Record<string, unknown>>(
      `SELECT p.id, p.nip, p.nama_lengkap, p.tingkat_pendidikan, p.bidang_studi_terakhir,
              p.riwayat_diklat, p.tmt_jabatan, j.jenjang, j.eselon
       FROM pegawai p
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
       WHERE p.status_aktif = 'AKTIF'
       ORDER BY p.id`,
    ),
    kueri<Record<string, unknown>>(`SELECT pegawai_id, bidang_studi FROM riwayat_pendidikan`),
    kueri<Record<string, unknown>>(
      `SELECT r.pegawai_id, r.jabatan_nama_mentah, r.jabatan_id, r.tanggal_mulai, r.tanggal_akhir,
              r.jenis_penugasan,
              j.jenjang, j.eselon, j.unit_organisasi_id
       FROM riwayat_jabatan r
       LEFT JOIN jabatan j ON j.id = r.jabatan_id
       ORDER BY r.pegawai_id, r.urutan`,
    ),
    kueri<Record<string, unknown>>(
      `SELECT pegawai_id, tingkat_hukuman, status_aktif FROM hukuman_disiplin`,
    ),
    /**
     * Kategori diklat TERVALIDASI per pegawai (`doc/sql/014`).
     *
     * Satu kueri untuk seluruh pegawai, bukan per pegawai: jalur ini dipanggil
     * Hitung Ulang untuk 1.960 orang sekaligus, dan satu kueri per orang di situ
     * adalah 1.960 perjalanan ke DB. Collation `JSON_TABLE` disebut eksplisit —
     * tanpa itu perbandingannya melempar "Illegal mix of collations" **lewat
     * driver aplikasi** meski lolos di `mysql` CLI.
     */
    kueri<Record<string, unknown>>(
      `SELECT DISTINCT p.id AS pegawai_id, k.kode
         FROM pegawai p,
              JSON_TABLE(p.riwayat_diklat, '$[*]'
                COLUMNS (nama VARCHAR(300) CHARACTER SET utf8mb4
                         COLLATE utf8mb4_0900_ai_ci PATH '$')) jt
         JOIN pemetaan_diklat pd
           ON pd.nama_normal = LOWER(TRIM(REGEXP_REPLACE(jt.nama, '[[:space:]]+', ' ')))
         JOIN master_kategori_riwayat_diklat k ON k.id = pd.kategori_id
        WHERE p.riwayat_diklat IS NOT NULL
          AND pd.status = 'TERVALIDASI'
          AND k.aktif = 1`,
    ),
    kueri<Record<string, unknown>>(
      `${CTE_ASESMEN_TERBARU}
       SELECT pegawai_id, tahun_asesmen, status_asesmen, potkom, rating_kinerja, nilai_kinerja_y
       FROM asesmen_terbaru`,
    ),
  ])

  const bidangPer = new Map<number, string[]>()
  for (const r of pendidikanRaw) {
    if (r.bidang_studi === null) continue
    const id = Number(r.pegawai_id)
    bidangPer.set(id, [...(bidangPer.get(id) ?? []), String(r.bidang_studi)])
  }

  const riwayatPer = new Map<number, ProfilKandidat['riwayatJabatan']>()
  for (const r of riwayatRaw) {
    const id = Number(r.pegawai_id)
    riwayatPer.set(id, [
      ...(riwayatPer.get(id) ?? []),
      {
        jabatanNamaMentah: String(r.jabatan_nama_mentah),
        jabatanId: r.jabatan_id === null ? null : Number(r.jabatan_id),
        jenjang: r.jenjang === null ? null : String(r.jenjang),
        eselon: r.eselon === null ? null : (String(r.eselon) as Eselon),
        unitOrganisasiId: r.unit_organisasi_id === null ? null : Number(r.unit_organisasi_id),
        tanggalMulai: tanggal(r.tanggal_mulai),
        tanggalAkhir: tanggal(r.tanggal_akhir),
        jenisPenugasan:
          r.jenis_penugasan === null
            ? null
            : (String(r.jenis_penugasan) as 'DEFINITIF' | 'PLT' | 'PLH'),
      },
    ])
  }

  const hukumanPer = new Map<number, ProfilKandidat['hukumanDisiplin']>()
  for (const r of hukumanRaw) {
    const id = Number(r.pegawai_id)
    hukumanPer.set(id, [
      ...(hukumanPer.get(id) ?? []),
      {
        tingkatHukuman: String(r.tingkat_hukuman) as ProfilKandidat['hukumanDisiplin'][number]['tingkatHukuman'],
        statusAktif: Number(r.status_aktif) === 1,
      },
    ])
  }

  const kategoriPer = new Map<number, string[]>()
  for (const r of kategoriRaw) {
    const id = Number(r.pegawai_id)
    kategoriPer.set(id, [...(kategoriPer.get(id) ?? []), String(r.kode)])
  }

  const asesmenPer = new Map<number, ProfilKandidat['asesmen'] & { potkom: number | null; predikat: Predikat | null }>()
  for (const r of asesmenRaw) {
    asesmenPer.set(Number(r.pegawai_id), {
      tahunAsesmen: Number(r.tahun_asesmen),
      statusAsesmen: r.status_asesmen === null ? null : (String(r.status_asesmen) as StatusAsesmen),
      nilaiKinerjaY: angka(r.nilai_kinerja_y as string),
      potkom: angka(r.potkom as string),
      predikat: r.rating_kinerja === null ? null : (String(r.rating_kinerja) as Predikat),
    })
  }

  return pegawaiRaw.map((p): ProfilKandidat => {
    const pegawaiId = Number(p.id)
    const asesmen = asesmenPer.get(pegawaiId) ?? null
    const bidang = [...(bidangPer.get(pegawaiId) ?? [])]
    if (p.bidang_studi_terakhir !== null) bidang.push(String(p.bidang_studi_terakhir))

    return {
      pegawaiId,
      nip: String(p.nip),
      nama: String(p.nama_lengkap),
      tingkatPendidikan:
        p.tingkat_pendidikan === null ? null : (String(p.tingkat_pendidikan) as TingkatPendidikan),
      bidangStudi: bidang,
      riwayatDiklat: bacaJsonTeks(p.riwayat_diklat),
      kategoriDiklatTervalidasi: kategoriPer.get(pegawaiId) ?? [],
      jenjangSaatIni: p.jenjang === null ? null : String(p.jenjang),
      eselonSaatIni: p.eselon === null ? null : (String(p.eselon) as Eselon),
      tmtJabatan: tanggal(p.tmt_jabatan),
      riwayatJabatan: riwayatPer.get(pegawaiId) ?? [],
      potkom: asesmen?.potkom ?? null,
      hukumanDisiplin: hukumanPer.get(pegawaiId) ?? [],
      predikatKinerja: asesmen?.predikat ?? null,
      asesmen: asesmen
        ? {
            tahunAsesmen: asesmen.tahunAsesmen,
            statusAsesmen: asesmen.statusAsesmen,
            nilaiKinerjaY: asesmen.nilaiKinerjaY,
          }
        : null,
    }
  })
}

function tanggal(nilai: unknown): Date | null {
  if (nilai === null || nilai === undefined || nilai === '') return null
  const d = nilai instanceof Date ? nilai : new Date(String(nilai))
  return Number.isNaN(d.getTime()) ? null : d
}

/**
 * Rakit seluruh masukan `hitungSkorMassal` untuk satu jabatan target.
 *
 * Satu pintu untuk perhitungan ulang & simulasi, supaya keduanya pasti memakai
 * rubrik, persyaratan, dan kata kunci yang sama.
 */
/**
 * Kode kategori diklat yang relevan untuk sebuah jabatan target (`doc/sql/015`).
 *
 * Hanya kategori **aktif** yang ikut. Kategori yang dinonaktifkan tetap tercatat
 * sebagai syarat (barisnya tidak dihapus, supaya jejak "dulu ini disyaratkan"
 * bertahan), tapi tidak boleh lagi menentukan skor — kalau ikut, sebuah kategori
 * yang sudah diputuskan tidak dipakai masih menaikkan nilai orang.
 */
export async function ambilSyaratKategoriDiklat(jabatanTargetId: number): Promise<string[]> {
  const baris = await kueri<{ kode: string }>(
    `SELECT k.kode
       FROM jabatan_target_syarat_diklat s
       JOIN master_kategori_riwayat_diklat k ON k.id = s.kategori_id
      WHERE s.jabatan_target_id = ? AND k.aktif = 1
      ORDER BY k.kode`,
    [jabatanTargetId],
  )
  return baris.map((b) => b.kode)
}

export async function ambilRubrikUntukHitung(
  jabatanTargetId: number,
): Promise<{ rubrik: RubrikJabatanTarget; komponen: KomponenRubrik[] } | null> {
  const [target, komponen, persyaratan] = await Promise.all([
    ambilJabatanTarget(jabatanTargetId),
    ambilPohonRubrik(jabatanTargetId),
    ambilPersyaratan(jabatanTargetId),
  ])
  if (target === null) return null

  return {
    komponen,
    rubrik: {
      jabatanTargetId,
      kataKunciRelevansi: target.kataKunciRelevansi,
      syaratKategoriDiklat: await ambilSyaratKategoriDiklat(jabatanTargetId),
      komponen,
      indikatorBerkunci: indikatorBerkunciDari(komponen),
      persyaratan: persyaratan.map((p) => ({
        id: p.id,
        jenisSyarat: p.jenisSyarat,
        deskripsi: p.deskripsi,
        nilaiMinimal: p.nilaiMinimal,
      })),
    },
  }
}
