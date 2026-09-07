import 'server-only'

import { angka, angkaWajib, kueri, kueriSatu } from '../db'
import type { Kotak9 } from '../scoring'
import { arahBawaanUrut } from '../urut'
import {
  CTE_ASESMEN_TERBARU,
  filterSumber,
  filterSumberPegawaiId,
  filterSumberTanpaAlias,
} from './dasar'

/**
 * Kueri dashboard — SEMUA agregasi dilakukan di SQL (phase.md §3 K-5).
 *
 * Tidak ada `SELECT *` lalu dijumlahkan di JavaScript: dev punya 40 pegawai,
 * produksi 1.872 ASN di 48 unit kerja. Setiap fungsi juga mengembalikan
 * **basis datanya** (total & yang dikecualikan), karena setiap chart wajib
 * menyebutkan cakupan angkanya (phase.md §5.5).
 */

// ---------------------------------------------------------------------------
// W1 · Kartu ringkas
// ---------------------------------------------------------------------------

export interface KartuRingkas {
  pegawaiAktif: number
  pegawaiTotal: number
  jabatanStrategisKosong: number
  jabatanStrategisTotal: number
  kandidatPool: number
  jabatanTargetAktif: number
  nominasiMenunggu: number
  nominasiTotal: number
  /** Nominasi yang sudah LOLOS verifikasi Admin Talenta (`status='DISETUJUI'`). */
  nominasiTerverifikasi: number
  /** Dari yang terverifikasi: sudah ditetapkan Pimpinan (`talent_pool='DITETAPKAN'`). */
  nominasiDitetapkan: number
}

export async function ambilKartuRingkas(): Promise<KartuRingkas> {
  const baris = await kueriSatu<Record<string, unknown>>(`
    SELECT
      (SELECT COUNT(*) FROM pegawai WHERE status_aktif = 'AKTIF' ${filterSumberTanpaAlias()}) AS pegawai_aktif,
      (SELECT COUNT(*) FROM pegawai WHERE 1=1 ${filterSumberTanpaAlias()})                AS pegawai_total,
      (SELECT COUNT(*) FROM jabatan
        WHERE status_jabatan = 'KOSONG' AND eselon IN ('I','II','III'))                   AS strategis_kosong,
      (SELECT COUNT(*) FROM jabatan WHERE eselon IN ('I','II','III'))                     AS strategis_total,
      (SELECT COUNT(DISTINCT tp.pegawai_id) FROM talent_pool tp
        JOIN pegawai p_tp ON p_tp.id = tp.pegawai_id
        WHERE 1=1 ${filterSumber('p_tp')})                                                AS kandidat_pool,
      (SELECT COUNT(*) FROM jabatan_target WHERE status = 'AKTIF')                        AS target_aktif,
      -- JANGAN memakai backtick di komentar SQL di dalam berkas ini: string
      -- kuerinya template literal JS, jadi satu backtick mengakhirinya dan
      -- galatnya muncul sebagai TS1005 "',' expected" belasan baris jauhnya —
      -- pesan yang tidak menyebut backtick sama sekali. Terjadi 12 Agu 2026.
      --
      -- Kedua penghitung nominasi WAJIB ikut filter populasi, dan sempat tidak.
      -- Akibatnya terlihat langsung oleh user: kartu dashboard menulis 7 sementara
      -- halaman /nominasi menampilkan 3, sebab ambilDaftarNominasi() disaring tapi
      -- hitungan di sini tidak. Dua angka untuk hal yang sama di dua layar, tanpa
      -- apa pun yang menjelaskan selisihnya — dan sejak pita populasi dilepas,
      -- tidak ada lagi yang bisa menjelaskannya.
      --
      -- Pegawainya dijangkau lewat talent_pool, sebab tabel nominasi sendiri
      -- tidak memuat pegawai_id.
      (SELECT COUNT(*) FROM nominasi n_m
         JOIN talent_pool tp_m ON tp_m.id = n_m.talent_pool_id
        WHERE n_m.status IN ('DIAJUKAN','MENUNGGU_VERIFIKASI')
          ${filterSumberPegawaiId('tp_m.pegawai_id')})                                    AS nominasi_menunggu,
      (SELECT COUNT(*) FROM nominasi n_t
         JOIN talent_pool tp_t ON tp_t.id = n_t.talent_pool_id
        WHERE 1=1 ${filterSumberPegawaiId('tp_t.pegawai_id')})                             AS nominasi_total,
      -- "Terverifikasi" = sudah LOLOS verifikasi Admin Talenta, dihitung
      -- KUMULATIF: termasuk yang sesudahnya sudah ditetapkan Pimpinan.
      --
      -- Butir 2 PUR.pdf ditahan lama karena istilahnya ambigu antara nominasi
      -- DISETUJUI dan talent_pool DIVERIFIKASI. Ambiguitasnya larut begitu
      -- dibaca kumulatif: nominasi DISETUJUI (2) = talent_pool DIVERIFIKASI (1)
      -- + DITETAPKAN (1). Dibaca "yang masih berstatus diverifikasi" keduanya
      -- berselisih, dan selisih itulah yang akan jadi dua angka di dua layar.
      --
      -- Dihitung dari sisi nominasi supaya satu kartu ini sekeluarga dengan
      -- kartu "Daftar nominasi" di sebelahnya — dua kartu bertetangga yang
      -- menghitung dari tabel berbeda adalah cara termudah membuat pembaca
      -- menyimpulkan selisih yang tidak ada.
      (SELECT COUNT(*) FROM nominasi n_v
         JOIN talent_pool tp_v ON tp_v.id = n_v.talent_pool_id
        WHERE n_v.status = 'DISETUJUI'
          ${filterSumberPegawaiId('tp_v.pegawai_id')})                                     AS nominasi_terverifikasi,
      (SELECT COUNT(*) FROM nominasi n_d
         JOIN talent_pool tp_d ON tp_d.id = n_d.talent_pool_id
        WHERE n_d.status = 'DISETUJUI' AND tp_d.status = 'DITETAPKAN'
          ${filterSumberPegawaiId('tp_d.pegawai_id')})                                     AS nominasi_ditetapkan
  `)

  return {
    pegawaiAktif: angkaWajib(baris?.pegawai_aktif as number),
    pegawaiTotal: angkaWajib(baris?.pegawai_total as number),
    jabatanStrategisKosong: angkaWajib(baris?.strategis_kosong as number),
    jabatanStrategisTotal: angkaWajib(baris?.strategis_total as number),
    kandidatPool: angkaWajib(baris?.kandidat_pool as number),
    jabatanTargetAktif: angkaWajib(baris?.target_aktif as number),
    nominasiMenunggu: angkaWajib(baris?.nominasi_menunggu as number),
    nominasiTotal: angkaWajib(baris?.nominasi_total as number),
    nominasiTerverifikasi: angkaWajib(baris?.nominasi_terverifikasi as number),
    nominasiDitetapkan: angkaWajib(baris?.nominasi_ditetapkan as number),
  }
}

// ---------------------------------------------------------------------------
// W2 · Sebaran Kotak 9
// ---------------------------------------------------------------------------

export interface SebaranKotak9 {
  perKotak: Map<Kotak9, number>
  totalDinilai: number
  /** Pegawai aktif tanpa data asesmen sama sekali. */
  tanpaAsesmen: number
  /** Pegawai yang asesmen terbarunya sudah kedaluwarsa. */
  asesmenKedaluwarsa: number
  tahunTerlama: number | null
  tahunTerbaru: number | null
}

export async function ambilSebaranKotak9(): Promise<SebaranKotak9> {
  const [sebaran, ringkas] = await Promise.all([
    kueri<{ kotak_9: number; jml: number }>(`
      ${CTE_ASESMEN_TERBARU}
      SELECT kotak_9, COUNT(*) AS jml FROM asesmen_terbaru GROUP BY kotak_9
    `),
    kueriSatu<Record<string, unknown>>(`
      ${CTE_ASESMEN_TERBARU}
      SELECT
        (SELECT COUNT(*) FROM asesmen_terbaru)                                       AS total,
        (SELECT COUNT(*) FROM pegawai p WHERE p.status_aktif = 'AKTIF'
           AND NOT EXISTS (SELECT 1 FROM asesmen_talenta a WHERE a.pegawai_id = p.id)
           ${filterSumber('p')}) AS tanpa_asesmen,
        (SELECT COUNT(*) FROM asesmen_terbaru WHERE status_asesmen = 'Expired')      AS kedaluwarsa,
        (SELECT MIN(tahun_asesmen) FROM asesmen_terbaru)                             AS tahun_min,
        (SELECT MAX(tahun_asesmen) FROM asesmen_terbaru)                             AS tahun_maks
    `),
  ])

  const perKotak = new Map<Kotak9, number>()
  for (const r of sebaran) perKotak.set(Number(r.kotak_9) as Kotak9, Number(r.jml))

  return {
    perKotak,
    totalDinilai: angkaWajib(ringkas?.total as number),
    tanpaAsesmen: angkaWajib(ringkas?.tanpa_asesmen as number),
    asesmenKedaluwarsa: angkaWajib(ringkas?.kedaluwarsa as number),
    tahunTerlama: angka(ringkas?.tahun_min as number),
    tahunTerbaru: angka(ringkas?.tahun_maks as number),
  }
}

/** Daftar pegawai pada satu sel Kotak 9 — untuk drill-down `?kotak=N`. */
/**
 * Satu baris drill-down Kotak 9 di dashboard.
 *
 * Bentuknya **sengaja identik** dengan `AnggotaSel` di `lib/kueri/peta-talenta.ts`
 * — `eselon` & `nilaiTalenta` ditambahkan 24 Agu 2026 justru untuk menyamakannya.
 * Keduanya dipajang komponen tabel yang SAMA (`TabelPegawaiKotak9`), jadi tipe yang
 * berselisih akan langsung jadi galat kompilasi alih-alih dua tabel yang perlahan
 * berbeda kolomnya — dan itu tepat yang sudah terjadi: tabel pegawai yang sama
 * tampil dalam tiga bentuk di tiga halaman sampai pemilik proses memintanya
 * disamakan.
 */
export interface AnggotaKotak {
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

/** Baris per halaman drill-down dashboard. Lebih kecil dari Peta Talenta (20): panelnya di bawah grid, bukan halaman sendiri. */
export const UKURAN_HALAMAN_KOTAK = 12

/**
 * Kunci kolom → ekspresi `ORDER BY`. Daftar PUTIH: `?urut=` datang dari URL, jadi
 * ia tidak boleh pernah menyentuh SQL secara langsung.
 *
 * Kuncinya sama dengan `KUNCI_URUT_KOTAK9` di `lib/urut.ts` — di situ daftar
 * kolom yang boleh diurutkan, di sini ekspresinya. Drill-down Peta Talenta punya
 * peta serupa dengan ekspresi BERBEDA (di sana sumbu X & Nilai Talenta adalah
 * alias terhitung yang berubah menurut `?target=`).
 */
const URUT_ANGGOTA: Record<string, string> = {
  nama: 'p.nama_lengkap',
  jabatan: 'j.nama_jabatan',
  unit: 'u.nama_unit',
  eselon: "FIELD(j.eselon,'I','II','III','IV','NON_ESELON')",
  kinerja: 'a.nilai_kinerja_y',
  predikat: "FIELD(a.rating_kinerja,'Sangat Baik','Baik','Butuh Perbaikan','Kurang','Sangat Kurang')",
  potensial: 'a.nilai_potensial_x',
  talenta: 'a.nilai_talenta',
  asesmen: 'a.tahun_asesmen',
}

export async function ambilAnggotaKotak(
  kotak: number,
  halaman = 1,
  urut?: string | null,
  arah?: 'asc' | 'desc' | null,
): Promise<{ daftar: AnggotaKotak[]; total: number }> {
  // Berpaginasi, bukan dipotong 12 lalu selesai. Versi lama hanya `LIMIT 12`
  // sementara judul panelnya menyebut TOTAL sesungguhnya — jadi "Pegawai di
  // Kotak 9 · 32 orang" di atas daftar berisi 12, tanpa apa pun yang menjelaskan
  // ke-20 sisanya. Sekarang tabelnya memakai `DataTable` yang sama dengan Peta
  // Talenta, dan paginasinya benar-benar bisa membuka sisanya.
  const lompat = (Math.max(1, halaman) - 1) * UKURAN_HALAMAN_KOTAK
  const kunci = urut && URUT_ANGGOTA[urut] ? urut : 'talenta'
  const kolomUrut = URUT_ANGGOTA[kunci]!
  const arahSql = (arah ?? arahBawaanUrut(kunci)) === 'asc' ? 'ASC' : 'DESC'
  const [daftar, hitung] = await Promise.all([
    kueri<Record<string, unknown>>(
      `${CTE_ASESMEN_TERBARU}
       SELECT p.id, p.nip, p.nama_lengkap, j.nama_jabatan, j.eselon, u.nama_unit,
              a.nilai_kinerja_y, a.nilai_potensial_x, a.nilai_talenta, a.rating_kinerja,
              a.tahun_asesmen, a.status_asesmen
       FROM asesmen_terbaru a
       JOIN pegawai p ON p.id = a.pegawai_id
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
       LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
       WHERE a.kotak_9 = ?
       -- p.nama_lengkap sebagai pemecah seri WAJIB, bukan kerapian: tanpa urutan
       -- yang deterministik, dua baris berskor sama bisa bertukar posisi antar
       -- permintaan, dan dengan LIMIT/OFFSET itu berarti baris yang sama muncul
       -- dua kali di halaman berbeda sementara baris lain tidak pernah muncul.
       ORDER BY ${kolomUrut} ${arahSql}, p.nama_lengkap
       LIMIT ? OFFSET ?`,
      [kotak, UKURAN_HALAMAN_KOTAK, lompat],
    ),
    kueriSatu<{ n: number }>(
      `${CTE_ASESMEN_TERBARU} SELECT COUNT(*) AS n FROM asesmen_terbaru WHERE kotak_9 = ?`,
      [kotak],
    ),
  ])

  return {
    daftar: daftar.map((r) => ({
      pegawaiId: Number(r.id),
      nip: String(r.nip),
      nama: String(r.nama_lengkap),
      namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
      eselon: r.eselon === null ? null : String(r.eselon),
      namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
      nilaiKinerjaY: angkaWajib(r.nilai_kinerja_y as string),
      nilaiPotensialX: angkaWajib(r.nilai_potensial_x as string),
      nilaiTalenta: angkaWajib(r.nilai_talenta as string),
      predikat: String(r.rating_kinerja),
      tahunAsesmen: Number(r.tahun_asesmen),
      statusAsesmen: String(r.status_asesmen),
    })),
    total: angkaWajib(hitung?.n),
  }
}

// ---------------------------------------------------------------------------
// W3 · Peta sebaran Kinerja × Potensial (bubble)
// ---------------------------------------------------------------------------

export interface TitikTalenta {
  y: number
  x: number
  jumlah: number
  kotak: Kotak9
  /** Sampai 5 nama untuk tooltip. */
  contohNama: string[]
}

/**
 * Diagregasi ke (Y, X dibulatkan) + jumlah, lalu digambar sebagai **bubble**.
 *
 * Ini menggantikan rencana awal "scatter berjitter" (phase.md §3 K-1). Jitter
 * memindahkan titik ke koordinat yang bukan nilainya — pada data padat itu
 * berarti menampilkan posisi palsu. Bubble menampilkan angka sebenarnya, dan
 * ukurannya tetap terbaca di 1.872 pegawai maupun 40.
 */
export async function ambilTitikTalenta(): Promise<{
  titik: TitikTalenta[]
  totalPegawai: number
}> {
  const baris = await kueri<Record<string, unknown>>(`
    ${CTE_ASESMEN_TERBARU}
    SELECT a.nilai_kinerja_y AS y,
           ROUND(a.nilai_potensial_x, 0) AS x,
           a.kotak_9,
           COUNT(*) AS jml,
           SUBSTRING_INDEX(GROUP_CONCAT(p.nama_lengkap ORDER BY p.nama_lengkap SEPARATOR '||'), '||', 5) AS contoh
    FROM asesmen_terbaru a
    JOIN pegawai p ON p.id = a.pegawai_id
    GROUP BY a.nilai_kinerja_y, ROUND(a.nilai_potensial_x, 0), a.kotak_9
    ORDER BY y, x
  `)

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
// W4 · Kesehatan Data (tabel Status Readiness Blueprint sebagai widget hidup)
// ---------------------------------------------------------------------------

export type StatusKesehatan = 'SIAP' | 'SEBAGIAN' | 'BELUM'

export interface BarisKesehatan {
  item: string
  /** Status yang ditulis Blueprint §3 — untuk dibandingkan dengan kenyataan. */
  statusBlueprint: 'SIAP' | 'SEBAGIAN' | 'BELUM'
  persen: number
  terpenuhi: number
  total: number
  keterangan: string
}

function status(persen: number): StatusKesehatan {
  if (persen >= 90) return 'SIAP'
  if (persen >= 60) return 'SEBAGIAN'
  return 'BELUM'
}

export function statusKesehatan(persen: number): StatusKesehatan {
  return status(persen)
}

export async function ambilKesehatanData(): Promise<{
  baris: BarisKesehatan[]
  rerata: number
}> {
  const r = await kueriSatu<Record<string, unknown>>(`
    ${CTE_ASESMEN_TERBARU}
    SELECT
      (SELECT COUNT(*) FROM pegawai)                                                  AS pegawai_total,
      (SELECT COUNT(*) FROM pegawai
        WHERE CHAR_LENGTH(nip) = 18 AND nama_lengkap <> '' AND golongan <> ''
          AND tmt_golongan IS NOT NULL AND jabatan_id IS NOT NULL)                    AS identitas_ok,
      (SELECT COUNT(DISTINCT pegawai_id) FROM asesmen_talenta)                         AS asesmen_ok,
      (SELECT COUNT(*) FROM pegawai p WHERE EXISTS (
         SELECT 1 FROM riwayat_pendidikan rp
         WHERE rp.pegawai_id = p.id AND rp.tahun_lulus IS NOT NULL))                   AS pendidikan_ok,
      (SELECT COUNT(*) FROM pegawai
        WHERE riwayat_diklat IS NOT NULL AND JSON_LENGTH(riwayat_diklat) > 0)          AS diklat_ok,
      (SELECT COUNT(DISTINCT pegawai_id) FROM kinerja_periode
        WHERE periode_skp = 'TAHUNAN' AND nilai_kinerja IS NOT NULL)                   AS kinerja_ok,
      (SELECT COUNT(*) FROM asesmen_terbaru WHERE status_asesmen = 'Berlaku')          AS asesmen_valid,
      (SELECT COUNT(*) FROM riwayat_jabatan)                                           AS riwayat_total,
      (SELECT COUNT(*) FROM riwayat_jabatan
        WHERE jabatan_id IS NOT NULL AND tanggal_mulai IS NOT NULL)                    AS riwayat_ok,
      (SELECT COUNT(*) FROM jabatan)                                                   AS jabatan_total,
      (SELECT COUNT(*) FROM jabatan WHERE kode_jabatan <> '' AND unit_organisasi_id IS NOT NULL) AS jabatan_ok,
      (SELECT COUNT(*) FROM jabatan_target)                                            AS target_total,
      (SELECT COUNT(DISTINCT t.id) FROM jabatan_target t
        WHERE EXISTS (SELECT 1 FROM jabatan_target_persyaratan s WHERE s.jabatan_target_id = t.id)
          AND EXISTS (SELECT 1 FROM rubrik_komponen k WHERE k.jabatan_target_id = t.id)) AS target_ok,
      (SELECT COUNT(DISTINCT pegawai_id) FROM hukuman_disiplin)                         AS disiplin_ok,
      (SELECT COUNT(DISTINCT tp.jabatan_target_id) FROM nominasi n
        JOIN talent_pool tp ON tp.id = n.talent_pool_id)                                AS workflow_ok
  `)

  const n = (k: string): number => angkaWajib(r?.[k] as number)
  const pegawai = Math.max(1, n('pegawai_total'))
  const riwayat = Math.max(1, n('riwayat_total'))
  const jabatan = Math.max(1, n('jabatan_total'))
  const target = Math.max(1, n('target_total'))

  const persen = (bagian: number, total: number): number =>
    Math.round((bagian / Math.max(1, total)) * 1000) / 10

  const baris: BarisKesehatan[] = [
    {
      item: 'Identitas Pegawai',
      statusBlueprint: 'SIAP',
      terpenuhi: n('identitas_ok'),
      total: pegawai,
      persen: persen(n('identitas_ok'), pegawai),
      keterangan: 'NIP 18 digit, nama, golongan, TMT, dan jabatan terisi',
    },
    {
      item: 'Hasil Asesmen & Kotak 9',
      statusBlueprint: 'SIAP',
      terpenuhi: n('asesmen_ok'),
      total: pegawai,
      persen: persen(n('asesmen_ok'), pegawai),
      keterangan: 'Punya minimal satu baris asesmen talenta',
    },
    {
      item: 'Riwayat Pendidikan',
      statusBlueprint: 'SIAP',
      terpenuhi: n('pendidikan_ok'),
      total: pegawai,
      persen: persen(n('pendidikan_ok'), pegawai),
      keterangan: 'Punya riwayat pendidikan dengan tahun lulus terisi',
    },
    {
      item: 'Riwayat Diklat / Sertifikasi',
      statusBlueprint: 'SIAP',
      terpenuhi: n('diklat_ok'),
      total: pegawai,
      persen: persen(n('diklat_ok'), pegawai),
      keterangan: 'Kolom riwayat_diklat tidak kosong',
    },
    {
      item: 'Rating Kinerja Numerik',
      statusBlueprint: 'SEBAGIAN',
      terpenuhi: n('kinerja_ok'),
      total: pegawai,
      persen: persen(n('kinerja_ok'), pegawai),
      keterangan: 'Punya nilai kinerja tahunan numerik, bukan hanya predikat',
    },
    {
      item: 'Status Asesmen Valid & Masa Berlaku',
      statusBlueprint: 'SEBAGIAN',
      terpenuhi: n('asesmen_valid'),
      total: pegawai,
      persen: persen(n('asesmen_valid'), pegawai),
      keterangan: 'Asesmen terbaru masih berlaku (masa berlaku 3 tahun)',
    },
    {
      item: 'Riwayat Jabatan Terstruktur',
      statusBlueprint: 'SEBAGIAN',
      terpenuhi: n('riwayat_ok'),
      total: riwayat,
      persen: persen(n('riwayat_ok'), riwayat),
      keterangan: 'Baris riwayat sudah terpetakan ke master jabatan DAN bertanggal',
    },
    {
      item: 'Kode Jabatan & Kode Unit',
      statusBlueprint: 'BELUM',
      terpenuhi: n('jabatan_ok'),
      total: jabatan,
      persen: persen(n('jabatan_ok'), jabatan),
      keterangan: 'Jabatan punya kode dan tertaut ke unit organisasi',
    },
    {
      item: 'Master Jabatan Target & Persyaratan',
      statusBlueprint: 'BELUM',
      terpenuhi: n('target_ok'),
      total: target,
      persen: persen(n('target_ok'), target),
      keterangan: 'Jabatan target punya persyaratan dan rubrik penilaian',
    },
    {
      item: 'Data Hukuman Disiplin Resmi',
      statusBlueprint: 'BELUM',
      terpenuhi: n('disiplin_ok'),
      total: pegawai,
      persen: persen(n('disiplin_ok'), pegawai),
      keterangan:
        'Punya rekam jejak disiplin yang terverifikasi. Yang belum ada catatannya diperlakukan sebagai "tidak pernah dihukum" (skor 100) — itu ASUMSI, bukan fakta terverifikasi',
    },
    {
      item: 'Workflow Nominasi & Approval',
      statusBlueprint: 'BELUM',
      terpenuhi: n('workflow_ok'),
      total: target,
      persen: persen(n('workflow_ok'), target),
      keterangan: 'Jabatan target sudah pernah melalui proses nominasi',
    },
  ]

  const rerata =
    Math.round((baris.reduce((s, b) => s + b.persen, 0) / baris.length) * 10) / 10

  return { baris, rerata }
}

// ---------------------------------------------------------------------------
// W5 · Jabatan strategis kosong
// ---------------------------------------------------------------------------

export interface JabatanKosong {
  id: number
  namaJabatan: string
  namaUnit: string | null
  eselon: string
  jenjang: string
  punyaJabatanTarget: boolean
  kandidatSiap: number
  suksesorDitetapkan: number
}

export async function ambilJabatanKosong(batas = 8): Promise<{
  daftar: JabatanKosong[]
  total: number
  tanpaTarget: number
}> {
  const [daftar, ringkas] = await Promise.all([
    kueri<Record<string, unknown>>(
      `SELECT j.id, j.nama_jabatan, j.eselon, j.jenjang, u.nama_unit,
              (SELECT COUNT(*) FROM jabatan_target t_k WHERE t_k.jabatan_id = j.id) AS jml_target,
              (SELECT COUNT(*) FROM jabatan_target t_k
                 JOIN talent_pool tp ON tp.jabatan_target_id = t_k.id
                 JOIN match_score ms ON ms.id = tp.match_score_id
                WHERE t_k.jabatan_id = j.id AND ms.eligible = 1)                        AS kandidat_siap,
              (SELECT COUNT(*) FROM jabatan_target t_k
                 JOIN talent_pool tp ON tp.jabatan_target_id = t_k.id
                WHERE t_k.jabatan_id = j.id AND tp.status = 'DITETAPKAN')               AS suksesor
       FROM jabatan j
       LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
       WHERE j.status_jabatan = 'KOSONG' AND j.eselon IN ('I','II','III')
       ORDER BY FIELD(j.eselon,'I','II','III'), jml_target ASC, j.nama_jabatan
       LIMIT ?`,
      [batas],
    ),
    kueriSatu<Record<string, unknown>>(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN NOT EXISTS (
          SELECT 1 FROM jabatan_target t_k WHERE t_k.jabatan_id = j.id
        ) THEN 1 ELSE 0 END) AS tanpa_target
      FROM jabatan j
      WHERE j.status_jabatan = 'KOSONG' AND j.eselon IN ('I','II','III')
    `),
  ])

  return {
    daftar: daftar.map((r) => ({
      id: Number(r.id),
      namaJabatan: String(r.nama_jabatan),
      namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
      eselon: String(r.eselon),
      jenjang: String(r.jenjang),
      punyaJabatanTarget: Number(r.jml_target) > 0,
      kandidatSiap: Number(r.kandidat_siap),
      suksesorDitetapkan: Number(r.suksesor),
    })),
    total: angkaWajib(ringkas?.total as number),
    tanpaTarget: angkaWajib(ringkas?.tanpa_target as number),
  }
}

// ---------------------------------------------------------------------------
// W6 · Antrian nominasi & approval
// ---------------------------------------------------------------------------

export interface AntrianNominasi {
  id: number
  nama: string
  namaTarget: string
  namaUnitPengaju: string | null
  status: string
  tanggalDiajukan: string
  hariMenunggu: number
  tahapTerakhir: string | null
  statusTahapTerakhir: string | null
  skorTotal: number | null
}

export async function ambilAntrianNominasi(batas = 8): Promise<{
  daftar: AntrianNominasi[]
  perStatus: Map<string, number>
}> {
  const [daftar, perStatusRaw] = await Promise.all([
    kueri<Record<string, unknown>>(
      `SELECT n.id, n.status, n.tanggal_diajukan,
              DATEDIFF(CURDATE(), n.tanggal_diajukan) AS hari,
              p.nama_lengkap, jt.nama_target, u.nama_unit, ms.skor_total,
              (SELECT al.tahap FROM approval_log al
                WHERE al.nominasi_id = n.id ORDER BY al.tanggal_aksi DESC, al.id DESC LIMIT 1) AS tahap,
              (SELECT al.status FROM approval_log al
                WHERE al.nominasi_id = n.id ORDER BY al.tanggal_aksi DESC, al.id DESC LIMIT 1) AS tahap_status
       FROM nominasi n
       JOIN talent_pool tp ON tp.id = n.talent_pool_id
       JOIN pegawai p ON p.id = tp.pegawai_id
       JOIN jabatan_target jt ON jt.id = tp.jabatan_target_id
       LEFT JOIN unit_organisasi u ON u.id = n.diajukan_oleh_unit_id
       LEFT JOIN match_score ms ON ms.id = tp.match_score_id
       ORDER BY FIELD(n.status,'MENUNGGU_VERIFIKASI','DIAJUKAN','DITOLAK','DISETUJUI'),
                n.tanggal_diajukan
       LIMIT ?`,
      [batas],
    ),
    kueri<{ status: string; jml: number }>(
      `SELECT status, COUNT(*) AS jml FROM nominasi GROUP BY status`,
    ),
  ])

  const perStatus = new Map<string, number>()
  for (const r of perStatusRaw) perStatus.set(String(r.status), Number(r.jml))

  return {
    daftar: daftar.map((r) => ({
      id: Number(r.id),
      nama: String(r.nama_lengkap),
      namaTarget: String(r.nama_target),
      namaUnitPengaju: r.nama_unit === null ? null : String(r.nama_unit),
      status: String(r.status),
      tanggalDiajukan: String(r.tanggal_diajukan),
      hariMenunggu: Number(r.hari ?? 0),
      tahapTerakhir: r.tahap === null ? null : String(r.tahap),
      statusTahapTerakhir: r.tahap_status === null ? null : String(r.tahap_status),
      skorTotal: angka(r.skor_total as string),
    })),
    perStatus,
  }
}

// ---------------------------------------------------------------------------
// W7 · Tren kinerja per triwulan
// ---------------------------------------------------------------------------

export interface TitikTren {
  periode: string
  rerataKinerja: number
  rerataPerilaku: number
  jumlahPegawai: number
}

export async function ambilTrenKinerja(): Promise<{
  titik: TitikTren[]
  tahun: number | null
  cakupanPegawai: number
  totalPegawai: number
}> {
  const tahunBaris = await kueriSatu<{ tahun: number }>(
    `SELECT MAX(tahun) AS tahun FROM kinerja_periode`,
  )
  const tahun = angka(tahunBaris?.tahun)
  if (tahun === null) {
    return { titik: [], tahun: null, cakupanPegawai: 0, totalPegawai: 0 }
  }

  const [titikRaw, ringkas] = await Promise.all([
    kueri<Record<string, unknown>>(
      `SELECT periode_skp,
              ROUND(AVG(nilai_kinerja), 2) AS rerata_kinerja,
              ROUND(AVG(nilai_perilaku), 2) AS rerata_perilaku,
              COUNT(DISTINCT pegawai_id) AS jml
       FROM kinerja_periode
       WHERE tahun = ?
       GROUP BY periode_skp
       ORDER BY FIELD(periode_skp,'TW1','TW2','TW3','TAHUNAN')`,
      [tahun],
    ),
    kueriSatu<Record<string, unknown>>(
      `SELECT (SELECT COUNT(DISTINCT pegawai_id) FROM kinerja_periode WHERE tahun = ?) AS cakupan,
              (SELECT COUNT(*) FROM pegawai) AS total`,
      [tahun],
    ),
  ])

  return {
    titik: titikRaw.map((r) => ({
      periode: String(r.periode_skp),
      rerataKinerja: angkaWajib(r.rerata_kinerja as string),
      rerataPerilaku: angkaWajib(r.rerata_perilaku as string),
      jumlahPegawai: Number(r.jml),
    })),
    tahun,
    cakupanPegawai: angkaWajib(ringkas?.cakupan as number),
    totalPegawai: angkaWajib(ringkas?.total as number),
  }
}

// ---------------------------------------------------------------------------
// W8 · Aktivitas terakhir
// ---------------------------------------------------------------------------

export interface Aktivitas {
  jenis: 'AUDIT' | 'SYNC'
  waktu: string
  judul: string
  keterangan: string | null
  aktor: string | null
  status: string | null
}

export async function ambilAktivitasTerakhir(batas = 8): Promise<Aktivitas[]> {
  const baris = await kueri<Record<string, unknown>>(
    `(SELECT 'AUDIT' AS jenis, al.created_at AS waktu,
             CONCAT(al.aksi, ' ', al.entitas) AS judul,
             CONCAT('ID entitas ', COALESCE(al.entitas_id, '-')) AS keterangan,
             u.nama AS aktor, NULL AS status
      FROM audit_log al LEFT JOIN users u ON u.id = al.user_id)
     UNION ALL
     (SELECT 'SYNC', sl.mulai_pada,
             CONCAT('Sinkronisasi ', sl.sumber_sistem),
             CONCAT(sl.jenis_data, ' — ', COALESCE(sl.jumlah_baris, 0), ' baris'),
             COALESCE(u2.nama, 'Terjadwal'), sl.status
      FROM sync_log sl LEFT JOIN users u2 ON u2.id = sl.dijalankan_oleh)
     ORDER BY waktu DESC
     LIMIT ?`,
    [batas],
  )

  return baris.map((r) => ({
    jenis: String(r.jenis) as 'AUDIT' | 'SYNC',
    waktu: String(r.waktu),
    judul: String(r.judul),
    keterangan: r.keterangan === null ? null : String(r.keterangan),
    aktor: r.aktor === null ? null : String(r.aktor),
    status: r.status === null ? null : String(r.status),
  }))
}
