import 'server-only'

import { BUTIR_KELENGKAPAN, tingkatKelengkapan, type TingkatKelengkapan } from '../kelengkapan'
import { angka, angkaWajib, kueri, kueriSatu } from '../db'
import { DEFINISI_TEMUAN, type KodeTemuan } from '../importer'
import { SUBKUERI_UNIT_TURUNAN } from './dasar'
import { SQL_SKOR_KELENGKAPAN, TOTAL_BOBOT_KELENGKAPAN, sqlFaktaButir } from './kelengkapan-sql'

/**
 * Kueri Kualitas Data (Fase 4): Kelengkapan Data (U-2), Antrian Pembersihan, dan
 * riwayat sinkronisasi.
 *
 * **Antrian Pembersihan dihitung dari keadaan DB sekarang, bukan dari catatan
 * importer.** Sengaja: temuan yang disimpan akan basi begitu seseorang
 * membetulkan barisnya lewat jalur lain, dan antrian yang menampilkan pekerjaan
 * yang sudah selesai adalah antrian yang berhenti dipercaya. Aturannya tetap
 * satu — `lib/importer` mendefinisikan kodenya & dampaknya, kueri di sini
 * mendeteksi jejaknya di data.
 */

export { TOTAL_BOBOT_KELENGKAPAN }

// ---------------------------------------------------------------------------
// U-2 · Kelengkapan Data
// ---------------------------------------------------------------------------

export interface RingkasKelengkapan {
  totalPegawai: number
  rerataSkor: number
  /** Jumlah pegawai per tingkat (LENGKAP/CUKUP/KURANG). */
  perTingkat: Record<TingkatKelengkapan, number>
  /** Target PRD §2: kelengkapan data pegawai ≥90%. */
  memenuhiTarget: number
}

export async function ambilRingkasKelengkapan(unitId?: number): Promise<RingkasKelengkapan> {
  const { where, params } = filterUnit(unitId)

  const r = await kueriSatu<Record<string, unknown>>(
    `SELECT COUNT(*)                                          AS total,
            AVG(${SQL_SKOR_KELENGKAPAN})                      AS rerata,
            SUM(${SQL_SKOR_KELENGKAPAN} >= 90)                AS lengkap,
            SUM(${SQL_SKOR_KELENGKAPAN} >= 70 AND ${SQL_SKOR_KELENGKAPAN} < 90) AS cukup,
            SUM(${SQL_SKOR_KELENGKAPAN} < 70)                 AS kurang
     FROM pegawai p
     LEFT JOIN jabatan j ON j.id = p.jabatan_id
     ${where}`,
    params,
  )

  const lengkap = Number(r?.lengkap ?? 0)
  return {
    totalPegawai: angkaWajib(r?.total as number),
    rerataSkor: Math.round((angka(r?.rerata as string) ?? 0) * 10) / 10,
    perTingkat: {
      LENGKAP: lengkap,
      CUKUP: Number(r?.cukup ?? 0),
      KURANG: Number(r?.kurang ?? 0),
    },
    memenuhiTarget: lengkap,
  }
}

export interface BarisButirKelengkapan {
  kunci: string
  label: string
  kategori: string
  bobot: number
  alasan: string
  terpenuhi: number
  total: number
  persen: number
}

/**
 * Berapa pegawai yang memenuhi tiap butir — inilah yang menjawab "apa yang harus
 * dikerjakan dulu". Diurutkan menurut **bobot × jumlah yang belum terpenuhi**,
 * bukan menurut persentase: butir berbobot 4 yang bolong pada 10 orang lebih
 * mendesak daripada butir berbobot 1 yang bolong pada 30 orang.
 */
export async function ambilButirKelengkapan(unitId?: number): Promise<BarisButirKelengkapan[]> {
  const { where, params } = filterUnit(unitId)

  const pilih = BUTIR_KELENGKAPAN.map(
    (b, i) => `SUM(IF(${sqlFaktaButir(b.kunci)}, 1, 0)) AS b${i}`,
  ).join(',\n            ')

  const r = await kueriSatu<Record<string, unknown>>(
    `SELECT COUNT(*) AS total,
            ${pilih}
     FROM pegawai p
     LEFT JOIN jabatan j ON j.id = p.jabatan_id
     ${where}`,
    params,
  )

  const total = angkaWajib(r?.total as number)

  return BUTIR_KELENGKAPAN.map((b, i) => {
    const terpenuhi = Number(r?.[`b${i}`] ?? 0)
    return {
      kunci: b.kunci,
      label: b.label,
      kategori: b.kategori,
      bobot: b.bobot,
      alasan: b.alasan,
      terpenuhi,
      total,
      persen: total === 0 ? 0 : Math.round((terpenuhi / total) * 1000) / 10,
    }
  }).sort((a, b) => b.bobot * (b.total - b.terpenuhi) - a.bobot * (a.total - a.terpenuhi))
}

export interface BarisUnitKelengkapan {
  unitId: number
  namaUnit: string
  jumlahPegawai: number
  rerataSkor: number
  tingkat: TingkatKelengkapan
  jumlahKurang: number
}

/** Rollup per unit — agregasi di SQL, bobotnya dari `lib/kelengkapan`. */
export async function ambilKelengkapanPerUnit(): Promise<BarisUnitKelengkapan[]> {
  const baris = await kueri<Record<string, unknown>>(`
    SELECT u.id, u.nama_unit,
           COUNT(*)                              AS jumlah,
           AVG(${SQL_SKOR_KELENGKAPAN})          AS rerata,
           SUM(${SQL_SKOR_KELENGKAPAN} < 70)     AS kurang
    FROM pegawai p
    JOIN jabatan j ON j.id = p.jabatan_id
    JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
    WHERE p.status_aktif = 'AKTIF'
    GROUP BY u.id, u.nama_unit
    ORDER BY rerata ASC, jumlah DESC
  `)

  return baris.map((r) => {
    const rerata = Math.round((angka(r.rerata as string) ?? 0) * 10) / 10
    return {
      unitId: Number(r.id),
      namaUnit: String(r.nama_unit),
      jumlahPegawai: Number(r.jumlah),
      rerataSkor: rerata,
      tingkat: tingkatKelengkapan(rerata),
      jumlahKurang: Number(r.kurang),
    }
  })
}

export interface BarisPegawaiKelengkapan {
  pegawaiId: number
  nip: string
  nama: string
  namaUnit: string | null
  skor: number
  tingkat: TingkatKelengkapan
}

/** Pegawai dengan kelengkapan terendah — daftar kerja, jadi dibatasi. */
export async function ambilPegawaiKelengkapanTerendah(
  unitId?: number,
  batas = 15,
): Promise<BarisPegawaiKelengkapan[]> {
  const { where, params } = filterUnit(unitId)

  const baris = await kueri<Record<string, unknown>>(
    `SELECT p.id, p.nip, p.nama_lengkap, u.nama_unit,
            ${SQL_SKOR_KELENGKAPAN} AS skor
     FROM pegawai p
     LEFT JOIN jabatan j ON j.id = p.jabatan_id
     LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     ${where}
     ORDER BY skor ASC, p.nama_lengkap
     LIMIT ?`,
    [...params, batas],
  )

  return baris.map((r) => {
    const skor = Math.round((angka(r.skor as string) ?? 0) * 10) / 10
    return {
      pegawaiId: Number(r.id),
      nip: String(r.nip),
      nama: String(r.nama_lengkap),
      namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
      skor,
      tingkat: tingkatKelengkapan(skor),
    }
  })
}

function filterUnit(unitId?: number): { where: string; params: unknown[] } {
  const syarat = ["p.status_aktif = 'AKTIF'"]
  const params: unknown[] = []
  if (unitId !== undefined) {
    syarat.push(`j.unit_organisasi_id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(unitId)
  }
  return { where: `WHERE ${syarat.join(' AND ')}`, params }
}

// ---------------------------------------------------------------------------
// Antrian Pembersihan Data
// ---------------------------------------------------------------------------

export interface KelompokTemuan {
  kode: KodeTemuan
  aturan: number
  label: string
  tingkat: string
  dampak: string
  jumlah: number
}

export interface BarisTemuanData {
  kode: KodeTemuan
  entitas: string
  entitasId: number
  /** Identitas yang bisa dibaca manusia (nama pegawai / nama jabatan). */
  subjek: string
  nip: string | null
  keterangan: string
}

/**
 * Hitung jumlah temuan per kode dari keadaan DB sekarang.
 *
 * Kode yang tidak bisa dideteksi ulang dari DB (mis. format golongan yang sudah
 * dikoreksi importer) memang bernilai 0 di sini — itu benar: temuannya sudah
 * tidak ada lagi di data. Yang tampil di antrian hanyalah pekerjaan yang **masih
 * perlu dikerjakan**.
 */
export async function ambilRingkasTemuan(): Promise<KelompokTemuan[]> {
  const r = await kueriSatu<Record<string, unknown>>(`
    SELECT
      (SELECT COUNT(*) FROM pegawai WHERE nip NOT REGEXP '^[0-9]{18}$')            AS nip_tidak_valid,
      (SELECT COUNT(*) FROM riwayat_jabatan
         WHERE jabatan_id IS NULL OR tanggal_mulai IS NULL OR no_sk IS NULL
            OR TRIM(COALESCE(no_sk,'')) = '')                                      AS riwayat_belum,
      (SELECT COUNT(*) FROM riwayat_pendidikan
         WHERE jenjang_pendidikan IS NULL OR bidang_studi IS NULL
            OR TRIM(bidang_studi) = '')                                            AS pendidikan_belum,
      (SELECT COUNT(*) FROM pegawai
         WHERE tmt_golongan IS NULL OR tmt_jabatan IS NULL)                        AS tanggal_kosong,
      (SELECT COUNT(*) FROM asesmen_talenta a
         WHERE a.kotak_9_sumber IS NOT NULL AND a.kotak_9_sumber <> a.kotak_9)     AS kotak9_beda,
      (SELECT COUNT(*) FROM pegawai p
         WHERE p.jabatan_id IS NULL)                                               AS tanpa_jabatan
  `)

  const jumlah: Partial<Record<KodeTemuan, number>> = {
    NIP_TIDAK_VALID: Number(r?.nip_tidak_valid ?? 0),
    RIWAYAT_BELUM_TERSTRUKTUR: Number(r?.riwayat_belum ?? 0),
    PENDIDIKAN_TIDAK_TERURAI: Number(r?.pendidikan_belum ?? 0),
    TANGGAL_TIDAK_TERURAI: Number(r?.tanggal_kosong ?? 0),
    KOTAK9_BEDA_DENGAN_HITUNGAN: Number(r?.kotak9_beda ?? 0),
  }

  return Object.values(DEFINISI_TEMUAN)
    .map((d) => ({
      kode: d.kode,
      aturan: d.aturan,
      label: d.label,
      tingkat: d.tingkat,
      dampak: d.dampak,
      jumlah: jumlah[d.kode] ?? 0,
    }))
    .sort((a, b) => b.jumlah - a.jumlah || a.aturan - b.aturan)
}

/** Baris temuan untuk satu kode — daftar kerja, jadi dibatasi. */
export async function ambilTemuanRinci(
  kode: KodeTemuan,
  batas = 50,
): Promise<BarisTemuanData[]> {
  switch (kode) {
    case 'NIP_TIDAK_VALID': {
      const baris = await kueri<Record<string, unknown>>(
        `SELECT id, nip, nama_lengkap FROM pegawai
         WHERE nip NOT REGEXP '^[0-9]{18}$' ORDER BY nama_lengkap LIMIT ?`,
        [batas],
      )
      return baris.map((r) => ({
        kode,
        entitas: 'pegawai',
        entitasId: Number(r.id),
        subjek: String(r.nama_lengkap),
        nip: String(r.nip),
        keterangan: `NIP "${String(r.nip)}" bukan 18 digit angka.`,
      }))
    }

    case 'RIWAYAT_BELUM_TERSTRUKTUR': {
      const baris = await kueri<Record<string, unknown>>(
        `SELECT rj.id, rj.pegawai_id, rj.jabatan_nama_mentah, rj.jabatan_id,
                rj.tanggal_mulai, rj.no_sk, p.nama_lengkap, p.nip
         FROM riwayat_jabatan rj
         JOIN pegawai p ON p.id = rj.pegawai_id
         WHERE rj.jabatan_id IS NULL OR rj.tanggal_mulai IS NULL
            OR rj.no_sk IS NULL OR TRIM(COALESCE(rj.no_sk,'')) = ''
         ORDER BY p.nama_lengkap, rj.urutan LIMIT ?`,
        [batas],
      )
      return baris.map((r) => {
        const kurang = [
          r.jabatan_id === null ? 'belum tertaut jabatan master' : null,
          r.tanggal_mulai === null ? 'tanpa tanggal mulai' : null,
          r.no_sk === null || String(r.no_sk).trim() === '' ? 'tanpa nomor SK' : null,
        ].filter(Boolean)
        return {
          kode,
          entitas: 'riwayat_jabatan',
          entitasId: Number(r.id),
          subjek: `${String(r.nama_lengkap)} — ${String(r.jabatan_nama_mentah)}`,
          nip: String(r.nip),
          keterangan: kurang.join(', '),
        }
      })
    }

    case 'PENDIDIKAN_TIDAK_TERURAI': {
      const baris = await kueri<Record<string, unknown>>(
        `SELECT rp.id, rp.jenjang_pendidikan, rp.bidang_studi, p.nama_lengkap, p.nip
         FROM riwayat_pendidikan rp
         JOIN pegawai p ON p.id = rp.pegawai_id
         WHERE rp.jenjang_pendidikan IS NULL OR rp.bidang_studi IS NULL
            OR TRIM(rp.bidang_studi) = ''
         ORDER BY p.nama_lengkap LIMIT ?`,
        [batas],
      )
      return baris.map((r) => ({
        kode,
        entitas: 'riwayat_pendidikan',
        entitasId: Number(r.id),
        subjek: String(r.nama_lengkap),
        nip: String(r.nip),
        keterangan:
          r.jenjang_pendidikan === null
            ? 'Jenjang pendidikan kosong.'
            : 'Bidang studi kosong — indikator Kesesuaian Bidang Ilmu tidak bisa dihitung.',
      }))
    }

    case 'TANGGAL_TIDAK_TERURAI': {
      const baris = await kueri<Record<string, unknown>>(
        `SELECT id, nip, nama_lengkap, tmt_golongan, tmt_jabatan FROM pegawai
         WHERE tmt_golongan IS NULL OR tmt_jabatan IS NULL
         ORDER BY nama_lengkap LIMIT ?`,
        [batas],
      )
      return baris.map((r) => ({
        kode,
        entitas: 'pegawai',
        entitasId: Number(r.id),
        subjek: String(r.nama_lengkap),
        nip: String(r.nip),
        keterangan: [
          r.tmt_golongan === null ? 'TMT golongan kosong' : null,
          r.tmt_jabatan === null ? 'TMT jabatan kosong' : null,
        ]
          .filter(Boolean)
          .join(', '),
      }))
    }

    case 'KOTAK9_BEDA_DENGAN_HITUNGAN': {
      const baris = await kueri<Record<string, unknown>>(
        `SELECT a.id, a.tahun_asesmen, a.kotak_9, a.kotak_9_sumber,
                a.nilai_kinerja_y, a.nilai_potensial_x, p.nama_lengkap, p.nip
         FROM asesmen_talenta a
         JOIN pegawai p ON p.id = a.pegawai_id
         WHERE a.kotak_9_sumber IS NOT NULL AND a.kotak_9_sumber <> a.kotak_9
         ORDER BY p.nama_lengkap LIMIT ?`,
        [batas],
      )
      return baris.map((r) => ({
        kode,
        entitas: 'asesmen_talenta',
        entitasId: Number(r.id),
        subjek: `${String(r.nama_lengkap)} — asesmen ${String(r.tahun_asesmen)}`,
        nip: String(r.nip),
        keterangan: `Sumber mengirim Kotak ${String(r.kotak_9_sumber)}, hasil hitung dari Kinerja ${String(r.nilai_kinerja_y)} × Potensial ${String(r.nilai_potensial_x)} adalah Kotak ${String(r.kotak_9)}.`,
      }))
    }

    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// Konsolidasi & Sinkronisasi
// ---------------------------------------------------------------------------

export interface StatusSumber {
  sumber: string
  jenisData: string[]
  terakhirMulai: Date | null
  terakhirSelesai: Date | null
  terakhirStatus: string | null
  totalBaris: number
  jumlahSukses: number
  jumlahGagal: number
  jumlahSebagian: number
}

export async function ambilStatusSumber(): Promise<StatusSumber[]> {
  const baris = await kueri<Record<string, unknown>>(`
    SELECT s.sumber_sistem,
           GROUP_CONCAT(DISTINCT s.jenis_data ORDER BY s.jenis_data SEPARATOR '||') AS jenis,
           MAX(s.mulai_pada)                       AS terakhir_mulai,
           SUM(COALESCE(s.jumlah_baris, 0))        AS total_baris,
           SUM(s.status = 'SUKSES')                AS sukses,
           SUM(s.status = 'GAGAL')                 AS gagal,
           SUM(s.status = 'SEBAGIAN')              AS sebagian
    FROM sync_log s
    GROUP BY s.sumber_sistem
    ORDER BY terakhir_mulai DESC
  `)

  // Status & waktu selesai diambil dari baris TERAKHIR per sumber, bukan agregat —
  // "status terakhir" adalah pertanyaan tentang satu baris tertentu.
  const terakhir = await kueri<Record<string, unknown>>(`
    SELECT s.sumber_sistem, s.status, s.selesai_pada
    FROM sync_log s
    JOIN (SELECT sumber_sistem, MAX(id) AS id FROM sync_log GROUP BY sumber_sistem) t
      ON t.id = s.id
  `)
  const petaTerakhir = new Map(
    terakhir.map((r) => [
      String(r.sumber_sistem),
      {
        status: String(r.status),
        selesai: r.selesai_pada === null ? null : new Date(String(r.selesai_pada)),
      },
    ]),
  )

  return baris.map((r) => {
    const sumber = String(r.sumber_sistem)
    const t = petaTerakhir.get(sumber)
    return {
      sumber,
      jenisData: String(r.jenis ?? '')
        .split('||')
        .filter((s) => s !== ''),
      terakhirMulai: r.terakhir_mulai === null ? null : new Date(String(r.terakhir_mulai)),
      terakhirSelesai: t?.selesai ?? null,
      terakhirStatus: t?.status ?? null,
      totalBaris: Number(r.total_baris ?? 0),
      jumlahSukses: Number(r.sukses ?? 0),
      jumlahGagal: Number(r.gagal ?? 0),
      jumlahSebagian: Number(r.sebagian ?? 0),
    }
  })
}

export interface BarisSyncLog {
  id: number
  sumber: string
  jenisData: string
  status: string
  jumlahBaris: number | null
  mulaiPada: Date
  selesaiPada: Date | null
  catatanError: string | null
  dijalankanOleh: string | null
  /** Durasi detik; null kalau belum selesai. */
  durasiDetik: number | null
}

export async function ambilRiwayatSync(batas = 20): Promise<BarisSyncLog[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT s.id, s.sumber_sistem, s.jenis_data, s.status, s.jumlah_baris,
            s.mulai_pada, s.selesai_pada, s.catatan_error, u.nama AS nama_pengguna,
            TIMESTAMPDIFF(SECOND, s.mulai_pada, s.selesai_pada) AS durasi
     FROM sync_log s
     LEFT JOIN users u ON u.id = s.dijalankan_oleh
     ORDER BY s.id DESC LIMIT ?`,
    [batas],
  )

  return baris.map((r) => ({
    id: Number(r.id),
    sumber: String(r.sumber_sistem),
    jenisData: String(r.jenis_data),
    status: String(r.status),
    jumlahBaris: angka(r.jumlah_baris as number),
    mulaiPada: new Date(String(r.mulai_pada)),
    selesaiPada: r.selesai_pada === null ? null : new Date(String(r.selesai_pada)),
    catatanError: r.catatan_error === null ? null : String(r.catatan_error),
    dijalankanOleh: r.nama_pengguna === null ? null : String(r.nama_pengguna),
    durasiDetik: angka(r.durasi as number),
  }))
}
