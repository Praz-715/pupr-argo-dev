import 'server-only'

import { SUBKUERI_UNIT_TURUNAN, filterSumber, urutAsesmenBerlaku } from './dasar'
import { labelTargetDenganTempat } from '../jenis-jabatan'

import { angka, angkaWajib, kueri, kueriSatu } from '../db'
import type { Peran } from '../peran'
import {
  giliranSiapa,
  periksaKonsistensi,
  type Giliran,
  type StatusApproval,
  type StatusNominasi,
  type StatusPool,
} from '../workflow'

/**
 * Kueri Talent Pool & Workflow Nominasi (Fase 6).
 *
 * Yang menentukan bentuk kueri di sini: **satu baris talent pool tidak bisa
 * dibaca sendirian.** Statusnya hanya bermakna bersama nominasi terakhirnya dan
 * keputusan approval terakhir — jadi ketiganya selalu diambil sekaligus, dan
 * "giliran siapa" diturunkan lewat `lib/workflow.ts`, bukan disimpulkan ulang
 * di tiap halaman.
 */

// ---------------------------------------------------------------------------
// Talent Pool per jabatan target
// ---------------------------------------------------------------------------

export interface BarisPool {
  talentPoolId: number
  pegawaiId: number
  nip: string
  nama: string
  namaJabatan: string | null
  namaUnit: string | null
  jabatanTargetId: number
  namaTarget: string
  ranking: number | null
  status: StatusPool
  catatanReviewer: string | null
  ditetapkanPada: string | null
  namaPenetap: string | null
  /** Skor dari perhitungan terakhir; null bila jabatan target belum dihitung. */
  skorTotal: number | null
  eligible: boolean | null
  /** Konteks kinerja yang wajib berdampingan dengan match score (K-4). */
  kotak9: number | null
  predikatKinerja: string | null
  /** Nominasi terakhir untuk entri pool ini. */
  nominasiId: number | null
  statusNominasi: StatusNominasi | null
  tanggalDiajukan: string | null
  namaUnitPengaju: string | null
  namaPengaju: string | null
  /** Keputusan approval terakhir & tahapnya. */
  approvalTerakhir: StatusApproval | null
  tahapTerakhir: string | null
  catatanApproval: string | null
  tanggalApproval: string | null
  jumlahRencana: number
  /** Turunan `lib/workflow.ts`, bukan kolom. */
  giliran: Giliran
  /** Pesan bila pasangan status pool × nominasi mustahil; normalnya null. */
  peringatanKonsistensi: string | null
}

/**
 * Potongan SQL "nominasi terakhir per entri pool".
 *
 * Satu entri pool bisa punya beberapa nominasi (diajukan, ditolak, diajukan
 * lagi). Yang menentukan keadaan sekarang adalah yang **terakhir**, jadi
 * aturannya dikunci di satu tempat — kalau disalin per halaman, satu halaman bisa
 * memakai nominasi pertama dan menampilkan keadaan yang sudah lewat.
 */
const CTE_NOMINASI_TERAKHIR = `
  nominasi_terakhir AS (
    SELECT * FROM (
      SELECT n.*, ROW_NUMBER() OVER (
        PARTITION BY n.talent_pool_id ORDER BY n.tanggal_diajukan DESC, n.id DESC
      ) AS rn
      FROM nominasi n
    ) x WHERE x.rn = 1
  ),
  approval_terakhir AS (
    SELECT * FROM (
      SELECT a.*, ROW_NUMBER() OVER (
        PARTITION BY a.nominasi_id ORDER BY a.id DESC
      ) AS rn
      FROM approval_log a
    ) y WHERE y.rn = 1
  )
`

const PILIH_POOL = `
  SELECT tp.id AS talent_pool_id, tp.pegawai_id, p.nip, p.nama_lengkap,
         j.nama_jabatan, uo.nama_unit,
         tp.jabatan_target_id, jt.nama_target, tp.ranking, tp.status,
         tp.catatan_reviewer, tp.ditetapkan_pada, penetap.nama AS nama_penetap,
         ms.skor_total, ms.eligible,
         a.kotak_9, a.rating_kinerja,
         n.id AS nominasi_id, n.status AS status_nominasi, n.tanggal_diajukan,
         nu.nama_unit AS nama_unit_pengaju, pengaju.nama AS nama_pengaju,
         al.status AS approval_terakhir, al.tahap AS tahap_terakhir,
         al.catatan AS catatan_approval, al.tanggal_aksi AS tanggal_approval,
         (SELECT COUNT(*) FROM rencana_pengembangan rp WHERE rp.talent_pool_id = tp.id) AS jumlah_rencana
  FROM talent_pool tp
  JOIN pegawai p ON p.id = tp.pegawai_id
  JOIN jabatan_target jt ON jt.id = tp.jabatan_target_id
  LEFT JOIN jabatan j ON j.id = p.jabatan_id
  LEFT JOIN unit_organisasi uo ON uo.id = j.unit_organisasi_id
  LEFT JOIN users penetap ON penetap.id = tp.ditetapkan_oleh
  LEFT JOIN match_score ms ON ms.pegawai_id = tp.pegawai_id
                          AND ms.jabatan_target_id = tp.jabatan_target_id
  LEFT JOIN asesmen_terbaru a ON a.pegawai_id = tp.pegawai_id
  LEFT JOIN nominasi_terakhir n ON n.talent_pool_id = tp.id
  LEFT JOIN unit_organisasi nu ON nu.id = n.diajukan_oleh_unit_id
  LEFT JOIN users pengaju ON pengaju.id = n.diajukan_oleh_user_id
  LEFT JOIN approval_terakhir al ON al.nominasi_id = n.id
`

/**
 * Batas populasi untuk DAFTAR anggota pool.
 *
 * Wajib berpasangan dengan filter pada penghitungnya: tanpa ini header panel
 * menulis "2 anggota" (sudah disaring) sementara tabelnya memajang orang yang
 * tidak ada di Direktori maupun di mana pun lagi di aplikasi. Terukur pada data
 * sekarang — "Agus Purnomo" muncul di tabel padahal bukan bagian dari populasi
 * yang ditampilkan.
 */
const BATAS_POPULASI_POOL = filterSumber('p')

/** CTE asesmen terbaru + nominasi/approval terakhir, siap ditempel di depan SELECT. */
const CTE_SUKSESI = `
  WITH asesmen_terbaru AS (
    SELECT * FROM (
      SELECT a.*, ROW_NUMBER() OVER (
        PARTITION BY a.pegawai_id ORDER BY ${urutAsesmenBerlaku('a')}
      ) AS rn
      FROM asesmen_talenta a
    ) x WHERE x.rn = 1
  ),
  ${CTE_NOMINASI_TERAKHIR}
`

function petakanPool(r: Record<string, unknown>): BarisPool {
  const status = String(r.status) as StatusPool
  const statusNominasi =
    r.status_nominasi === null || r.status_nominasi === undefined
      ? null
      : (String(r.status_nominasi) as StatusNominasi)

  return {
    talentPoolId: Number(r.talent_pool_id),
    pegawaiId: Number(r.pegawai_id),
    nip: String(r.nip),
    nama: String(r.nama_lengkap),
    namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
    namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
    jabatanTargetId: Number(r.jabatan_target_id),
    namaTarget: String(r.nama_target),
    ranking: angka(r.ranking as number),
    status,
    catatanReviewer: r.catatan_reviewer === null ? null : String(r.catatan_reviewer),
    ditetapkanPada: r.ditetapkan_pada === null ? null : String(r.ditetapkan_pada),
    namaPenetap: r.nama_penetap === null ? null : String(r.nama_penetap),
    skorTotal: angka(r.skor_total as string),
    eligible: r.eligible === null || r.eligible === undefined ? null : Number(r.eligible) === 1,
    kotak9: angka(r.kotak_9 as number),
    predikatKinerja: r.rating_kinerja === null ? null : String(r.rating_kinerja),
    nominasiId: angka(r.nominasi_id as number),
    statusNominasi,
    tanggalDiajukan: r.tanggal_diajukan === null ? null : String(r.tanggal_diajukan),
    namaUnitPengaju: r.nama_unit_pengaju === null ? null : String(r.nama_unit_pengaju),
    namaPengaju: r.nama_pengaju === null ? null : String(r.nama_pengaju),
    approvalTerakhir:
      r.approval_terakhir === null ? null : (String(r.approval_terakhir) as StatusApproval),
    tahapTerakhir: r.tahap_terakhir === null ? null : String(r.tahap_terakhir),
    catatanApproval: r.catatan_approval === null ? null : String(r.catatan_approval),
    tanggalApproval: r.tanggal_approval === null ? null : String(r.tanggal_approval),
    jumlahRencana: Number(r.jumlah_rencana ?? 0),
    giliran: giliranSiapa({ statusPool: status, statusNominasi }),
    peringatanKonsistensi: periksaKonsistensi({ statusPool: status, statusNominasi }),
  }
}

export interface FilterPool {
  jabatanTargetId?: number
  status?: StatusPool
  /** Batasi ke unit pengaju tertentu (Pengelola Unit hanya melihat unitnya). */
  unitPengajuId?: number
  cari?: string
}

export async function ambilTalentPool(filter: FilterPool = {}): Promise<BarisPool[]> {
  const syarat: string[] = []
  const params: unknown[] = []

  if (filter.jabatanTargetId !== undefined) {
    syarat.push('tp.jabatan_target_id = ?')
    params.push(filter.jabatanTargetId)
  }
  if (filter.status !== undefined) {
    syarat.push('tp.status = ?')
    params.push(filter.status)
  }
  if (filter.unitPengajuId !== undefined) {
    syarat.push('n.diajukan_oleh_unit_id = ?')
    params.push(filter.unitPengajuId)
  }
  const cari = (filter.cari ?? '').trim()
  if (cari !== '') {
    syarat.push('(p.nama_lengkap LIKE ? OR p.nip LIKE ?)')
    params.push(`%${cari}%`, `%${cari}%`)
  }
  if (BATAS_POPULASI_POOL) syarat.push(BATAS_POPULASI_POOL.replace(/^ AND /, ''))

  const baris = await kueri<Record<string, unknown>>(
    `${CTE_SUKSESI} ${PILIH_POOL}
     ${syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : ''}
     ORDER BY FIELD(tp.status, 'DITETAPKAN', 'DIVERIFIKASI', 'DINOMINASIKAN', 'KANDIDAT', 'DITOLAK'),
              tp.ranking IS NULL, tp.ranking, p.nama_lengkap`,
    params,
  )
  return baris.map(petakanPool)
}

export async function ambilEntriPool(talentPoolId: number): Promise<BarisPool | null> {
  const baris = await kueriSatu<Record<string, unknown>>(
    `${CTE_SUKSESI} ${PILIH_POOL} WHERE tp.id = ? ${BATAS_POPULASI_POOL}`,
    [talentPoolId],
  )
  return baris === null ? null : petakanPool(baris)
}

export interface RingkasPool {
  total: number
  perStatus: Array<{ status: StatusPool; jumlah: number }>
  menungguTindakan: number
  tidakKonsisten: number
}

/** Ringkasan per jabatan target — agregasi di SQL, bukan menghitung baris di JS. */
export async function ambilRingkasPool(jabatanTargetId?: number): Promise<RingkasPool> {
  const params: unknown[] = []
  const where = jabatanTargetId === undefined ? '' : 'WHERE tp.jabatan_target_id = ?'
  if (jabatanTargetId !== undefined) params.push(jabatanTargetId)

  const perStatus = await kueri<{ status: string; jumlah: number }>(
    `SELECT tp.status, COUNT(*) AS jumlah FROM talent_pool tp
       JOIN pegawai p_st ON p_st.id = tp.pegawai_id ${where ? where + ` AND 1=1` : 'WHERE 1=1'} ${filterSumber('p_st')}
     GROUP BY tp.status
     ORDER BY FIELD(tp.status, 'DITETAPKAN', 'DIVERIFIKASI', 'DINOMINASIKAN', 'KANDIDAT', 'DITOLAK')`,
    params,
  )

  const daftar = await ambilTalentPool(
    jabatanTargetId === undefined ? {} : { jabatanTargetId },
  )

  return {
    total: perStatus.reduce((n, s) => n + Number(s.jumlah), 0),
    perStatus: perStatus.map((s) => ({ status: String(s.status) as StatusPool, jumlah: Number(s.jumlah) })),
    menungguTindakan: daftar.filter((b) => b.giliran !== 'SELESAI').length,
    tidakKonsisten: daftar.filter((b) => b.peringatanKonsistensi !== null).length,
  }
}

export interface OpsiTargetPool {
  id: number
  nama: string
  jumlahPool: number
  status: string
  /** Anggota yang sedang menunggu tindakan seseorang. */
  jumlahMenunggu: number
}

/**
 * Jabatan target beserta jumlah anggota pool & yang menunggu tindakan.
 *
 * `jumlahMenunggu` dihitung di JS dari `giliranSiapa`, bukan di SQL: menuliskan
 * aturan "giliran siapa" sebagai kondisi SQL berarti definisi kedua yang bisa
 * berselisih dengan `lib/workflow.ts`. Isi `talent_pool` terbatas (segelintir
 * kandidat per jabatan target), jadi memuatnya seluruhnya aman — beda dengan
 * `pegawai` yang berjumlah ribuan.
 */
export async function ambilOpsiTargetPool(): Promise<OpsiTargetPool[]> {
  const [baris, semuaPool] = await Promise.all([
    kueri<Record<string, unknown>>(
      /*
        Unit anggotanya ikut diambil supaya labelnya bisa dibedakan — lima target
        Kepala Balai BP2JK bernama identik, dan yang membedakannya cuma unitnya
        (butir 1 `Detail Revisi PUPR 1_9_2026.pdf`). Dua kolom, bukan satu:
        `jumlah_unit` yang memutuskan apakah satu nama unit boleh disebut, sebab
        target beranggota banyak unit tidak boleh dilabeli salah satunya saja.
      */
      `SELECT jt.id, jt.nama_target, jt.status,
              (SELECT COUNT(*) FROM talent_pool tp
                 JOIN pegawai p_tp ON p_tp.id = tp.pegawai_id
                WHERE tp.jabatan_target_id = jt.id ${filterSumber('p_tp')}) AS jumlah_pool,
              /* Kursi tunggal sejak doc/sql/032 — 1 kalau kursinya sudah ditentukan. */
              (SELECT COUNT(*) FROM jabatan j_k
                WHERE j_k.id = jt.jabatan_id) AS jumlah_unit,
              (SELECT u.nama_unit
                 FROM jabatan j_k
                 JOIN unit_organisasi u ON u.id = j_k.unit_organisasi_id
                WHERE j_k.id = jt.jabatan_id) AS nama_unit
       FROM jabatan_target jt
       ORDER BY FIELD(jt.status, 'AKTIF', 'DRAFT', 'NONAKTIF'), jt.nama_target`,
    ),
    ambilTalentPool(),
  ])

  return baris.map((r) => {
    const id = Number(r.id)
    return {
      id,
      nama: labelTargetDenganTempat(
        String(r.nama_target),
        r.nama_unit === null ? null : String(r.nama_unit),
        Number(r.jumlah_unit ?? 0),
      ),
      jumlahPool: Number(r.jumlah_pool),
      status: String(r.status),
      jumlahMenunggu: semuaPool.filter((p) => p.jabatanTargetId === id && p.giliran !== 'SELESAI')
        .length,
    }
  })
}

/**
 * Kandidat yang lolos syarat tapi BELUM masuk pool — untuk aksi "tambahkan ke pool".
 *
 * Ini yang menghubungkan Fase 5 ke Fase 6: halaman Kandidat menghitung skor,
 * halaman ini yang memutuskan siapa yang masuk daftar suksesi.
 */
export interface KandidatLuarPool {
  pegawaiId: number
  nip: string
  nama: string
  namaJabatan: string | null
  skorTotal: number
  kotak9: number | null
  predikatKinerja: string | null
}

/*
  `unitWajib` WAJIB, sama seperti kedua kueri kekosongan di `lib/kueri/master.ts`
  dan atas alasan yang sama: sejak 24 Agu 2026 Pengelola Unit boleh menekan
  "Tambahkan ke pool", dan `tambahKePool` menolak pegawai di luar unitnya
  (`pegawaiTerjangkau()`). Daftar yang tidak tersaring akan menawarkan nama-nama
  yang PASTI ditolak — dan karena daftarnya dibatasi 20 teratas per skor, nama dari
  unit sendiri bahkan bisa terdorong keluar oleh nama yang tidak bisa ia pakai.

  Yang dibatasi ORANGNYA, bukan kursinya: unit tetap boleh mengusulkan pegawainya
  untuk jabatan target unit mana pun (lihat `PERAN_KELOLA_POOL` di `lib/peran.ts`).
  Karena itu saringannya di `pegawai`, bukan di jabatan targetnya.

  `null` = lingkup penuh (Super Admin, Admin Talenta). Dibuat wajib supaya pemanggil
  baru jadi galat kompilasi, bukan kebocoran yang diam.
*/
export async function ambilKandidatLuarPool(
  jabatanTargetId: number,
  unitWajib: number | null,
): Promise<{ baris: KandidatLuarPool[]; total: number }> {
  /*
    Disaring lewat `j.unit_organisasi_id` (unit JABATAN pegawai), bukan
    `p.unit_organisasi_id`. Bukan pilihan gaya: `pegawaiTerjangkau()` — yang akan
    MENOLAK di sisi aksi — memakai kolom itu, dan dua definisi "pegawai unit saya"
    yang berbeda akan membuat daftar dan penolakan berselisih untuk orang yang
    kedua kolomnya tidak sama. Pegawai tanpa jabatan tersaring keluar di kedua
    tempat, dengan alasan yang sama.
  */
  const filterUnit = unitWajib === null ? '' : `AND j.unit_organisasi_id IN (${SUBKUERI_UNIT_TURUNAN})`
  const baris = await kueri<Record<string, unknown>>(
    `WITH asesmen_terbaru AS (
       SELECT * FROM (
         SELECT a.*, ROW_NUMBER() OVER (
           PARTITION BY a.pegawai_id ORDER BY ${urutAsesmenBerlaku('a')}
         ) AS rn FROM asesmen_talenta a
       ) x WHERE x.rn = 1
     )
     SELECT ms.pegawai_id, p.nip, p.nama_lengkap, j.nama_jabatan, ms.skor_total,
            a.kotak_9, a.rating_kinerja
     FROM match_score ms
     JOIN pegawai p ON p.id = ms.pegawai_id
     LEFT JOIN jabatan j ON j.id = p.jabatan_id
     LEFT JOIN asesmen_terbaru a ON a.pegawai_id = ms.pegawai_id
     WHERE ms.jabatan_target_id = ? AND ms.eligible = 1
       AND p.status_aktif = 'AKTIF'
       ${BATAS_POPULASI_POOL}
       ${filterUnit}
       AND NOT EXISTS (
         SELECT 1 FROM talent_pool tp
         WHERE tp.jabatan_target_id = ms.jabatan_target_id AND tp.pegawai_id = ms.pegawai_id
       )
     ORDER BY ms.skor_total DESC`,
    unitWajib === null ? [jabatanTargetId] : [jabatanTargetId, unitWajib],
  )

  /*
    ⚠️ TANPA `LIMIT` sejak 2 Sep 2026 — permintaan pemilik proses: *"gausah 20
    teratas deh, semua kandidat aja."*

    Batas 20 sebelumnya bukan cuma memotong daftar, ia membuat JUDULNYA berbohong:
    judul memakai `baris.length`, jadi pada jabatan target #439 ia menulis "(20)"
    sementara yang memenuhi syarat 48. Angka yang terpotong batas tampilan tidak
    bisa dibedakan dari angka yang benar-benar segitu, dan pembacanya menyimpulkan
    hanya 20 orang yang lolos — persis pertanyaan yang diajukan pemilik proses.

    `total` tetap dihitung terpisah walau tidak ada lagi yang memotong: ia yang
    membuat pemotongan diam-diam MUSTAHIL kembali tanpa terlihat. Kalau suatu saat
    daftarnya terlalu panjang untuk dikirim sekaligus (populasi produksi 1.872
    pegawai), jawabannya PAGINASI dengan jumlah total yang tetap disebut — bukan
    `LIMIT` diam yang mengembalikan kekeliruan ini.
  */
  const jml = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n
       FROM match_score ms
       JOIN pegawai p ON p.id = ms.pegawai_id
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
      WHERE ms.jabatan_target_id = ? AND ms.eligible = 1
        AND p.status_aktif = 'AKTIF'
        ${BATAS_POPULASI_POOL}
        ${filterUnit}
        AND NOT EXISTS (
          SELECT 1 FROM talent_pool tp
          WHERE tp.jabatan_target_id = ms.jabatan_target_id AND tp.pegawai_id = ms.pegawai_id
        )`,
    unitWajib === null ? [jabatanTargetId] : [jabatanTargetId, unitWajib],
  )

  const petakan = baris.map((r) => ({
    pegawaiId: Number(r.pegawai_id),
    nip: String(r.nip),
    nama: String(r.nama_lengkap),
    namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
    skorTotal: angkaWajib(r.skor_total as string),
    kotak9: angka(r.kotak_9 as number),
    predikatKinerja: r.rating_kinerja === null ? null : String(r.rating_kinerja),
  }))
  return { baris: petakan, total: Number(jml?.n ?? petakan.length) }
}

// ---------------------------------------------------------------------------
// Nominasi & timeline approval
// ---------------------------------------------------------------------------

export interface BarisNominasi {
  id: number
  talentPoolId: number
  pegawaiId: number
  nip: string
  nama: string
  jabatanTargetId: number
  namaTarget: string
  statusPool: StatusPool
  status: StatusNominasi
  tanggalDiajukan: string
  namaUnitPengaju: string
  namaPengaju: string | null
  catatan: string | null
  skorTotal: number | null
  kotak9: number | null
  predikatKinerja: string | null
  approvalTerakhir: StatusApproval | null
  tahapTerakhir: string | null
  /** Lama menunggu dalam hari sejak keputusan/pengajuan terakhir. */
  lamaMenungguHari: number | null
  giliran: Giliran
}

export interface FilterNominasi {
  giliran?: Giliran
  status?: StatusNominasi
  unitPengajuId?: number
  jabatanTargetId?: number
}

export async function ambilDaftarNominasi(filter: FilterNominasi = {}): Promise<BarisNominasi[]> {
  const syarat: string[] = []
  const params: unknown[] = []

  if (filter.status !== undefined) {
    syarat.push('n.status = ?')
    params.push(filter.status)
  }
  if (filter.unitPengajuId !== undefined) {
    syarat.push('n.diajukan_oleh_unit_id = ?')
    params.push(filter.unitPengajuId)
  }
  if (filter.jabatanTargetId !== undefined) {
    syarat.push('tp.jabatan_target_id = ?')
    params.push(filter.jabatanTargetId)
  }
  // Menutup TIGA halaman sekaligus: /nominasi, /inbox (`ambilTugas` menyaring
  // hasil fungsi ini), dan /nominasi/[id] (`ambilNominasi` mencarinya di sini).
  // Menyaringnya di masing-masing halaman berarti tiga definisi yang harus
  // sepakat — dan yang paling mungkin tertinggal justru inbox, karena ia tidak
  // terlihat seperti daftar pegawai.
  if (BATAS_POPULASI_POOL) syarat.push(BATAS_POPULASI_POOL.replace(/^ AND /, ''))

  const baris = await kueri<Record<string, unknown>>(
    `WITH asesmen_terbaru AS (
       SELECT * FROM (
         SELECT a.*, ROW_NUMBER() OVER (
           PARTITION BY a.pegawai_id ORDER BY ${urutAsesmenBerlaku('a')}
         ) AS rn FROM asesmen_talenta a
       ) x WHERE x.rn = 1
     ),
     approval_terakhir AS (
       SELECT * FROM (
         SELECT a.*, ROW_NUMBER() OVER (PARTITION BY a.nominasi_id ORDER BY a.id DESC) AS rn
         FROM approval_log a
       ) y WHERE y.rn = 1
     )
     SELECT n.id, n.talent_pool_id, tp.pegawai_id, p.nip, p.nama_lengkap,
            tp.jabatan_target_id, jt.nama_target, tp.status AS status_pool,
            n.status, n.tanggal_diajukan, uo.nama_unit AS nama_unit_pengaju,
            pengaju.nama AS nama_pengaju, n.catatan,
            ms.skor_total, a.kotak_9, a.rating_kinerja,
            al.status AS approval_terakhir, al.tahap AS tahap_terakhir,
            DATEDIFF(CURDATE(), COALESCE(DATE(al.tanggal_aksi), n.tanggal_diajukan)) AS lama_hari
     FROM nominasi n
     JOIN talent_pool tp ON tp.id = n.talent_pool_id
     JOIN pegawai p ON p.id = tp.pegawai_id
     JOIN jabatan_target jt ON jt.id = tp.jabatan_target_id
     JOIN unit_organisasi uo ON uo.id = n.diajukan_oleh_unit_id
     LEFT JOIN users pengaju ON pengaju.id = n.diajukan_oleh_user_id
     LEFT JOIN match_score ms ON ms.pegawai_id = tp.pegawai_id
                             AND ms.jabatan_target_id = tp.jabatan_target_id
     LEFT JOIN asesmen_terbaru a ON a.pegawai_id = tp.pegawai_id
     LEFT JOIN approval_terakhir al ON al.nominasi_id = n.id
     ${syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : ''}
     ORDER BY FIELD(n.status, 'MENUNGGU_VERIFIKASI', 'DIAJUKAN', 'DISETUJUI', 'DITOLAK'),
              n.tanggal_diajukan ASC`,
    params,
  )

  const semua = baris.map((r): BarisNominasi => {
    const statusPool = String(r.status_pool) as StatusPool
    const status = String(r.status) as StatusNominasi
    return {
      id: Number(r.id),
      talentPoolId: Number(r.talent_pool_id),
      pegawaiId: Number(r.pegawai_id),
      nip: String(r.nip),
      nama: String(r.nama_lengkap),
      jabatanTargetId: Number(r.jabatan_target_id),
      namaTarget: String(r.nama_target),
      statusPool,
      status,
      tanggalDiajukan: String(r.tanggal_diajukan),
      namaUnitPengaju: String(r.nama_unit_pengaju),
      namaPengaju: r.nama_pengaju === null ? null : String(r.nama_pengaju),
      catatan: r.catatan === null ? null : String(r.catatan),
      skorTotal: angka(r.skor_total as string),
      kotak9: angka(r.kotak_9 as number),
      predikatKinerja: r.rating_kinerja === null ? null : String(r.rating_kinerja),
      approvalTerakhir:
        r.approval_terakhir === null ? null : (String(r.approval_terakhir) as StatusApproval),
      tahapTerakhir: r.tahap_terakhir === null ? null : String(r.tahap_terakhir),
      lamaMenungguHari: angka(r.lama_hari as number),
      giliran: giliranSiapa({ statusPool, statusNominasi: status }),
    }
  })

  // Filter giliran dikerjakan di JS karena ia turunan `lib/workflow.ts`, bukan
  // kolom — menyalin aturannya ke SQL berarti dua definisi "giliran siapa".
  return filter.giliran === undefined
    ? semua
    : semua.filter((b) => b.giliran === filter.giliran)
}

export async function ambilNominasi(id: number): Promise<BarisNominasi | null> {
  const semua = await ambilDaftarNominasi()
  return semua.find((n) => n.id === id) ?? null
}

export interface BarisApproval {
  id: number
  nominasiId: number
  tahap: string
  status: StatusApproval
  namaApprover: string | null
  peranApprover: string | null
  catatan: string | null
  tanggalAksi: string
}

export async function ambilRiwayatApproval(nominasiId: number): Promise<BarisApproval[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT a.id, a.nominasi_id, a.tahap, a.status, u.nama AS nama_approver,
            r.nama_role AS peran_approver, a.catatan, a.tanggal_aksi
     FROM approval_log a
     LEFT JOIN users u ON u.id = a.approver_user_id
     LEFT JOIN roles r ON r.id = u.role_id
     WHERE a.nominasi_id = ?
     ORDER BY a.id`,
    [nominasiId],
  )
  return baris.map((r) => ({
    id: Number(r.id),
    nominasiId: Number(r.nominasi_id),
    tahap: String(r.tahap),
    status: String(r.status) as StatusApproval,
    namaApprover: r.nama_approver === null ? null : String(r.nama_approver),
    peranApprover: r.peran_approver === null ? null : String(r.peran_approver),
    catatan: r.catatan === null ? null : String(r.catatan),
    tanggalAksi: String(r.tanggal_aksi),
  }))
}

/** Unit yang boleh dipakai sebagai pengaju — dipakai form nominasi. */
export async function ambilOpsiUnitPengaju(): Promise<Array<{ id: number; nama: string }>> {
  const baris = await kueri<{ id: number; nama_unit: string }>(
    `SELECT id, nama_unit FROM unit_organisasi ORDER BY nama_unit`,
  )
  return baris.map((r) => ({ id: Number(r.id), nama: String(r.nama_unit) }))
}

// ---------------------------------------------------------------------------
// Rencana pengembangan
// ---------------------------------------------------------------------------

export type StatusRencana = 'DIRENCANAKAN' | 'BERJALAN' | 'SELESAI'
export type JenisPengembangan = 'DIKLAT' | 'ROTASI' | 'MENTORING' | 'PENUGASAN'

export interface BarisRencana {
  id: number
  pegawaiId: number
  /**
   * Konteks suksesi, kalau ada. `null` sejak `doc/sql/029` = rencana umum yang
   * tidak terikat pencalonan jabatan target mana pun.
   */
  talentPoolId: number | null
  nama: string
  nip: string
  namaTarget: string | null
  jabatanTargetId: number | null
  statusPool: StatusPool | null
  /** Suksesor yang rencananya dicontoh, kalau baris ini salinan. */
  dicontohDari: { pegawaiId: number; nama: string } | null
  jenisPengembangan: JenisPengembangan
  deskripsi: string
  targetSelesai: string | null
  status: StatusRencana
  namaPembuat: string | null
  createdAt: string
  /** Negatif = sudah terlewat. null = tanpa target tanggal. */
  sisaHari: number | null
}

/**
 * Rencana pengembangan — sejak `doc/sql/029`, berpusat pada PEGAWAI.
 *
 * Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 5): rencana
 * boleh dibuat untuk siapa pun, tidak hanya yang sudah masuk talent pool.
 *
 * ## `JOIN pegawai` lewat `rp.pegawai_id`, dan `talent_pool` jadi LEFT JOIN
 *
 * Versi sebelumnya mengambil orangnya LEWAT `talent_pool` (`JOIN talent_pool …
 * JOIN pegawai ON p.id = tp.pegawai_id`) — jadi rencana tanpa konteks suksesi
 * tidak akan pernah punya baris untuk di-JOIN dan **lenyap dari halaman tanpa
 * satu pun galat**. Itu bentuk kegagalan yang paling mahal di sini: barisnya
 * tersimpan, tombolnya bekerja, dan yang hilang cuma tampilannya.
 *
 * `opsi.hanyaSuksesor` / `hanyaUmum` memisahkan keduanya untuk halaman yang
 * memajangnya dalam dua bagian — dipisah di SQL, bukan dengan `.filter()` di
 * TypeScript, supaya penghitung tiap bagian tidak bisa memakai aturan yang
 * berbeda dari daftarnya.
 */
export async function ambilRencanaPengembangan(opsi: {
  talentPoolId?: number
  pegawaiId?: number
  jabatanTargetId?: number
  status?: StatusRencana
  /** Hanya rencana yang terikat sebuah entri talent pool. */
  hanyaSuksesor?: boolean
  /** Hanya rencana yang TIDAK terikat entri talent pool mana pun. */
  hanyaUmum?: boolean
} = {}): Promise<BarisRencana[]> {
  const syarat: string[] = []
  const params: unknown[] = []
  if (opsi.talentPoolId !== undefined) {
    syarat.push('rp.talent_pool_id = ?')
    params.push(opsi.talentPoolId)
  }
  if (opsi.pegawaiId !== undefined) {
    syarat.push('rp.pegawai_id = ?')
    params.push(opsi.pegawaiId)
  }
  if (opsi.jabatanTargetId !== undefined) {
    syarat.push('tp.jabatan_target_id = ?')
    params.push(opsi.jabatanTargetId)
  }
  if (opsi.status !== undefined) {
    syarat.push('rp.status = ?')
    params.push(opsi.status)
  }
  if (opsi.hanyaSuksesor) syarat.push('rp.talent_pool_id IS NOT NULL')
  if (opsi.hanyaUmum) syarat.push('rp.talent_pool_id IS NULL')
  if (BATAS_POPULASI_POOL) syarat.push(BATAS_POPULASI_POOL.replace(/^ AND /, ''))

  const baris = await kueri<Record<string, unknown>>(
    `SELECT rp.id, rp.pegawai_id, rp.talent_pool_id, p.nama_lengkap, p.nip,
            jt.nama_target, tp.jabatan_target_id, tp.status AS status_pool,
            rp.dicontoh_dari_pegawai_id, pc.nama_lengkap AS nama_dicontoh,
            rp.jenis_pengembangan, rp.deskripsi, rp.target_selesai, rp.status,
            u.nama AS nama_pembuat, rp.created_at,
            DATEDIFF(rp.target_selesai, CURDATE()) AS sisa_hari
     FROM rencana_pengembangan rp
     JOIN pegawai p ON p.id = rp.pegawai_id
     LEFT JOIN talent_pool tp ON tp.id = rp.talent_pool_id
     LEFT JOIN jabatan_target jt ON jt.id = tp.jabatan_target_id
     LEFT JOIN pegawai pc ON pc.id = rp.dicontoh_dari_pegawai_id
     LEFT JOIN users u ON u.id = rp.dibuat_oleh
     ${syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : ''}
     ORDER BY FIELD(rp.status, 'BERJALAN', 'DIRENCANAKAN', 'SELESAI'),
              rp.target_selesai IS NULL, rp.target_selesai, rp.id`,
    params,
  )

  return baris.map((r) => ({
    id: Number(r.id),
    pegawaiId: Number(r.pegawai_id),
    talentPoolId: r.talent_pool_id === null ? null : Number(r.talent_pool_id),
    nama: String(r.nama_lengkap),
    nip: String(r.nip),
    namaTarget: r.nama_target === null ? null : String(r.nama_target),
    jabatanTargetId: r.jabatan_target_id === null ? null : Number(r.jabatan_target_id),
    statusPool: r.status_pool === null ? null : (String(r.status_pool) as StatusPool),
    dicontohDari:
      r.dicontoh_dari_pegawai_id === null
        ? null
        : {
            pegawaiId: Number(r.dicontoh_dari_pegawai_id),
            nama: String(r.nama_dicontoh),
          },
    jenisPengembangan: String(r.jenis_pengembangan) as JenisPengembangan,
    deskripsi: String(r.deskripsi),
    targetSelesai: r.target_selesai === null ? null : String(r.target_selesai),
    status: String(r.status) as StatusRencana,
    namaPembuat: r.nama_pembuat === null ? null : String(r.nama_pembuat),
    createdAt: String(r.created_at),
    sisaHari: angka(r.sisa_hari as number),
  }))
}

export interface PegawaiRencana {
  pegawaiId: number
  nip: string
  nama: string
  namaJabatan: string | null
  namaUnit: string | null
  jumlahRencana: number
  /** Sudah jadi suksesor DITETAPKAN di jabatan target mana pun. */
  sudahSuksesor: boolean
}

/**
 * Cari pegawai untuk diberi rencana pengembangan umum.
 *
 * Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 5): bagian
 * bawah halaman untuk **semua pegawai**, bukan hanya suksesor.
 *
 * Dirender di server dari `?cariPegawai=`, sama dengan pencarian di halaman
 * Bandingkan — bukan panggilan fetch dari klien. Konsistensinya bukan selera:
 * seluruh state halaman di aplikasi ini ada di URL, dan permukaan API baru berarti
 * satu lagi yang harus digerbangi sendiri.
 *
 * `unitWajib` WAJIB, bukan berbawaan `null`. `simpanRencana()` akan MENOLAK pegawai
 * di luar lingkup lewat `pegawaiTerjangkau()`, jadi daftar yang tidak tersaring
 * menawarkan nama yang pasti ditolak — pola "halaman lebih longgar daripada
 * aksinya" yang sudah tercatat berulang di CLAUDE.md. Disaring lewat
 * `j.unit_organisasi_id` karena itu kolom yang dipakai penolaknya; memakai
 * `p.unit_organisasi_id` akan berselisih untuk orang yang kedua kolomnya berbeda.
 */
export async function cariPegawaiUntukRencana(
  q: string,
  unitWajib: number | null,
  batas = 12,
): Promise<PegawaiRencana[]> {
  const teks = q.trim()
  if (teks.length < 2) return []
  const pola = `%${teks}%`
  const batasUnit =
    unitWajib === null ? '' : ` AND j.unit_organisasi_id IN (${SUBKUERI_UNIT_TURUNAN})`
  const params: unknown[] = [pola, pola.replace(/\s/g, '')]
  if (unitWajib !== null) params.push(unitWajib)
  params.push(batas)

  const baris = await kueri<Record<string, unknown>>(
    `SELECT p.id, p.nip, p.nama_lengkap, j.nama_jabatan, u.nama_unit,
            (SELECT COUNT(*) FROM rencana_pengembangan rp WHERE rp.pegawai_id = p.id) AS jumlah_rencana,
            EXISTS (SELECT 1 FROM talent_pool tp
                     WHERE tp.pegawai_id = p.id AND tp.status = 'DITETAPKAN') AS sudah_suksesor
       FROM pegawai p
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
       LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
      WHERE (p.nama_lengkap LIKE ? OR p.nip LIKE ?)
        AND p.status_aktif = 'AKTIF'
        ${BATAS_POPULASI_POOL}
        ${batasUnit}
      ORDER BY p.nama_lengkap
      LIMIT ?`,
    params,
  )

  return baris.map((r) => ({
    pegawaiId: Number(r.id),
    nip: String(r.nip),
    nama: String(r.nama_lengkap),
    namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
    namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
    jumlahRencana: Number(r.jumlah_rencana),
    sudahSuksesor: Number(r.sudah_suksesor) === 1,
  }))
}

/** Suksesor yang sudah ditetapkan — sasaran rencana pengembangan. */
export async function ambilSuksesorDitetapkan(): Promise<BarisPool[]> {
  return ambilTalentPool({ status: 'DITETAPKAN' })
}

// ---------------------------------------------------------------------------
// Notifikasi & Inbox Tugas (U-7)
// ---------------------------------------------------------------------------

export interface BarisNotifikasi {
  id: number
  jenis: string
  judul: string
  pesan: string
  tautan: string | null
  peranTujuan: string | null
  entitas: string | null
  entitasId: number | null
  dibacaPada: string | null
  namaPembuat: string | null
  createdAt: string
}

export async function ambilNotifikasi(
  userId: number,
  opsi: { hanyaBelumDibaca?: boolean; batas?: number } = {},
): Promise<BarisNotifikasi[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT n.id, n.jenis, n.judul, n.pesan, n.tautan, n.peran_tujuan, n.entitas,
            n.entitas_id, n.dibaca_pada, u.nama AS nama_pembuat, n.created_at
     FROM notifikasi n
     LEFT JOIN users u ON u.id = n.dibuat_oleh
     WHERE n.user_id = ?
       ${opsi.hanyaBelumDibaca === true ? 'AND n.dibaca_pada IS NULL' : ''}
     ORDER BY n.dibaca_pada IS NOT NULL, n.created_at DESC, n.id DESC
     LIMIT ?`,
    [userId, opsi.batas ?? 50],
  )
  return baris.map((r) => ({
    id: Number(r.id),
    jenis: String(r.jenis),
    judul: String(r.judul),
    pesan: String(r.pesan),
    tautan: r.tautan === null ? null : String(r.tautan),
    peranTujuan: r.peran_tujuan === null ? null : String(r.peran_tujuan),
    entitas: r.entitas === null ? null : String(r.entitas),
    entitasId: angka(r.entitas_id as number),
    dibacaPada: r.dibaca_pada === null ? null : String(r.dibaca_pada),
    namaPembuat: r.nama_pembuat === null ? null : String(r.nama_pembuat),
    createdAt: String(r.created_at),
  }))
}

export async function hitungNotifikasiBelumDibaca(userId: number): Promise<number> {
  const r = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM notifikasi WHERE user_id = ? AND dibaca_pada IS NULL`,
    [userId],
  )
  return Number(r?.n ?? 0)
}

/**
 * Tugas yang menunggu pengguna ini — inti Inbox (U-7).
 *
 * Bukan sama dengan notifikasi: notifikasi adalah **kabar** (bisa sudah dibaca
 * tapi pekerjaannya belum dikerjakan), tugas adalah **keadaan workflow** yang
 * menunggu tindakan. Keduanya ditampilkan berdampingan justru karena bedanya itu.
 */
export interface Tugas {
  giliran: Giliran
  nominasiId: number | null
  talentPoolId: number
  nama: string
  nip: string
  namaTarget: string
  tautan: string
  keterangan: string
  lamaMenungguHari: number | null
}

export async function ambilTugas(
  peran: Peran | null,
  unitId: number | null,
): Promise<Tugas[]> {
  if (peran === null) return []

  const giliranSaya: Giliran[] =
    peran === 'Super Admin'
      ? ['UNIT', 'ADMIN_TALENTA', 'PIMPINAN']
      : peran === 'Admin Talenta'
        ? ['ADMIN_TALENTA']
        : peran === 'Pimpinan'
          ? ['PIMPINAN']
          : peran === 'Pengelola Unit'
            ? ['UNIT']
            : []

  if (giliranSaya.length === 0) return []

  const semua = await ambilDaftarNominasi(
    // Pengelola Unit hanya melihat nominasi unitnya sendiri (pembatasan data
    // per unit yang jadi janji Fase 7 sudah ditegakkan di sini untuk daftar ini).
    peran === 'Pengelola Unit' && unitId !== null ? { unitPengajuId: unitId } : {},
  )

  const tugas: Tugas[] = semua
    .filter((n) => giliranSaya.includes(n.giliran))
    .map((n) => ({
      giliran: n.giliran,
      nominasiId: n.id,
      talentPoolId: n.talentPoolId,
      nama: n.nama,
      nip: n.nip,
      namaTarget: n.namaTarget,
      tautan: `/nominasi/${n.id}`,
      keterangan:
        n.giliran === 'ADMIN_TALENTA'
          ? 'Menunggu Verifikasi Kepegawaian'
          : n.giliran === 'PIMPINAN'
            ? 'Menunggu penetapan sebagai suksesor'
            : 'Dikembalikan untuk revisi — perlu diajukan ulang',
      lamaMenungguHari: n.lamaMenungguHari,
    }))

  return tugas.sort((a, b) => (b.lamaMenungguHari ?? 0) - (a.lamaMenungguHari ?? 0))
}
