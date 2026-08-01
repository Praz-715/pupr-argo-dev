import 'server-only'

import { angka, angkaWajib, kueri, kueriSatu } from '../db'
import { hitungKelengkapan, type HasilKelengkapan } from '../kelengkapan'
import { normalisasiGolongan, type TingkatPendidikan } from '../normalisasi'
import { hitungUsia, parseNip, proyeksiPensiun, selisihTahun } from '../nip'
import type { Eselon } from '../scoring/eligibility'
import type { Kotak9 } from '../scoring'
import { arahBawaanUrut } from '../urut'
import { CTE_ASESMEN_TERBARU, SUBKUERI_UNIT_TURUNAN } from './dasar'

/**
 * Kueri Direktori Pegawai & Profil Talenta.
 *
 * Paginasi, pengurutan, dan penyaringan SEMUANYA di SQL — produksi 1.872 ASN
 * (phase.md §3 K-5). Kolom hasil urut dibatasi daftar putih (bukan interpolasi
 * bebas dari query string) supaya tidak ada celah injeksi lewat `?urut=`.
 */

// ---------------------------------------------------------------------------
// Direktori
// ---------------------------------------------------------------------------

/**
 * Kolom yang boleh dipakai mengurutkan → ekspresi SQL-nya.
 * Arah bawaan tiap kolom ada di `lib/urut.ts` (dipakai bersama header tabel).
 */
const KOLOM_URUT: Record<string, string> = {
  nama: 'p.nama_lengkap',
  nip: 'p.nip',
  jabatan: 'j.nama_jabatan',
  eselon: "FIELD(j.eselon,'I','II','III','IV','NON_ESELON')",
  unit: 'u.nama_unit',
  pangkat: 'p.pangkat',
  golongan: 'p.golongan',
  jenjang: 'j.jenjang',
  jenisAsesmen: 'a.jenis_asesmen',
  potkom: 'a.potkom',
  integritas: 'a.nilai_integritas',
  predikat: "FIELD(a.rating_kinerja,'Sangat Baik','Baik','Butuh Perbaikan','Kurang','Sangat Kurang')",
  kotak9: 'a.kotak_9',
  talenta: 'a.nilai_talenta',
}

export const UKURAN_HALAMAN_DIREKTORI = 25

export interface FilterDirektori {
  cari?: string
  unitId?: number
  /**
   * Batas unit yang WAJIB, dari peran pengguna (`lib/lingkup.ts`) — bukan
   * pilihan yang bisa dihapus dari URL.
   *
   * Dipasang **berdampingan** dengan `unitId`, bukan menggantikannya: dua
   * klausa unit menghasilkan irisan dengan sendirinya, sehingga Pengelola Unit
   * yang mengetik `?unit=` milik unit lain mendapat nol baris — bukan diam-diam
   * dialihkan ke unitnya sendiri, yang akan membuatnya mengira sedang melihat
   * unit yang ia minta.
   */
  unitWajib?: number | null
  eselon?: string
  jenjang?: string
  tingkatPendidikan?: string
  kotak9?: number
  statusAsesmen?: string
  urut?: string
  arah?: 'asc' | 'desc'
  halaman?: number
}

export interface BarisDirektori {
  pegawaiId: number
  nip: string
  nama: string
  namaJabatan: string | null
  eselon: Eselon | null
  namaUnit: string | null
  pangkat: string
  golongan: string | null
  jenjang: string | null
  jenisAsesmen: string | null
  potkom: number | null
  /** Skala 0–100, rubrik Integritas & Moralitas (phase.md §2.7). */
  nilaiIntegritas: number | null
  predikatKinerja: string | null
  kotak9: Kotak9 | null
  tahunAsesmen: number | null
  statusAsesmen: string | null
  usia: number | null
}

/** Susun klausa WHERE + parameternya dari filter. */
function bangunFilter(f: FilterDirektori): { where: string; params: unknown[] } {
  const syarat: string[] = []
  const params: unknown[] = []

  if (f.cari && f.cari.trim() !== '') {
    // Cari di nama ATAU NIP. NIP dibersihkan dari spasi supaya "19780525 1998"
    // tetap cocok dengan NIP tersimpan.
    const q = `%${f.cari.trim()}%`
    syarat.push('(p.nama_lengkap LIKE ? OR p.nip LIKE ?)')
    params.push(q, q.replace(/\s/g, ''))
  }
  if (f.unitId !== undefined) {
    // Termasuk seluruh unit di bawahnya, berapa pun kedalamannya. Versi
    // sebelumnya menuliskan tiga level secara manual — begitu ada unit di level
    // keempat, pegawainya diam-diam hilang dari hasil filter.
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
  if (f.tingkatPendidikan) {
    syarat.push('p.tingkat_pendidikan = ?')
    params.push(f.tingkatPendidikan)
  }
  if (f.kotak9 !== undefined) {
    syarat.push('a.kotak_9 = ?')
    params.push(f.kotak9)
  }
  if (f.statusAsesmen) {
    if (f.statusAsesmen === 'TANPA_ASESMEN') syarat.push('a.id IS NULL')
    else {
      syarat.push('a.status_asesmen = ?')
      params.push(f.statusAsesmen)
    }
  }

  return { where: syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : '', params }
}

export async function ambilDirektori(f: FilterDirektori): Promise<{
  baris: BarisDirektori[]
  total: number
  halaman: number
  ukuranHalaman: number
}> {
  const { where, params } = bangunFilter(f)

  const kunciUrut = f.urut && KOLOM_URUT[f.urut] ? f.urut : 'nama'
  const kolomUrut = KOLOM_URUT[kunciUrut]!
  // Tanpa `?arah=` eksplisit, pakai arah bawaan kolomnya (lib/urut.ts).
  const arah = (f.arah ?? arahBawaanUrut(kunciUrut)) === 'asc' ? 'ASC' : 'DESC'
  const halaman = Math.max(1, f.halaman ?? 1)
  const offset = (halaman - 1) * UKURAN_HALAMAN_DIREKTORI

  const dasar = `
    ${CTE_ASESMEN_TERBARU}
    SELECT p.id, p.nip, p.nama_lengkap, p.golongan, p.pangkat,
           j.nama_jabatan, j.eselon, j.jenjang, u.nama_unit,
           a.jenis_asesmen, a.potkom, a.nilai_integritas, a.rating_kinerja,
           a.kotak_9, a.tahun_asesmen, a.status_asesmen, a.id AS asesmen_id
    FROM pegawai p
    LEFT JOIN jabatan j ON j.id = p.jabatan_id
    LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
    LEFT JOIN asesmen_terbaru a ON a.pegawai_id = p.id
    ${where}
  `

  const [baris, hitung] = await Promise.all([
    kueri<Record<string, unknown>>(
      // NULL selalu di belakang supaya pegawai tanpa asesmen tidak menyumbat
      // halaman pertama saat mengurutkan berdasarkan skor.
      `${dasar} ORDER BY (${kolomUrut} IS NULL), ${kolomUrut} ${arah}, p.nama_lengkap ASC
       LIMIT ? OFFSET ?`,
      [...params, UKURAN_HALAMAN_DIREKTORI, offset],
    ),
    kueriSatu<{ n: number }>(
      `${CTE_ASESMEN_TERBARU}
       SELECT COUNT(*) AS n
       FROM pegawai p
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
       LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
       LEFT JOIN asesmen_terbaru a ON a.pegawai_id = p.id
       ${where}`,
      params,
    ),
  ])

  const sekarang = new Date()

  return {
    baris: baris.map((r) => {
      const nip = String(r.nip)
      const terurai = parseNip(nip, sekarang)
      return {
        pegawaiId: Number(r.id),
        nip,
        nama: String(r.nama_lengkap),
        namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
        eselon: r.eselon === null ? null : (String(r.eselon) as Eselon),
        namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
        pangkat: String(r.pangkat),
        golongan: normalisasiGolongan(r.golongan as string),
        jenjang: r.jenjang === null ? null : String(r.jenjang),
        jenisAsesmen: r.jenis_asesmen === null ? null : String(r.jenis_asesmen),
        potkom: angka(r.potkom as string),
        nilaiIntegritas: angka(r.nilai_integritas as string),
        predikatKinerja: r.rating_kinerja === null ? null : String(r.rating_kinerja),
        kotak9: r.kotak_9 === null ? null : (Number(r.kotak_9) as Kotak9),
        tahunAsesmen: angka(r.tahun_asesmen as number),
        statusAsesmen: r.status_asesmen === null ? null : String(r.status_asesmen),
        usia: hitungUsia(terurai.tanggalLahir, sekarang),
      }
    }),
    total: angkaWajib(hitung?.n),
    halaman,
    ukuranHalaman: UKURAN_HALAMAN_DIREKTORI,
  }
}

/** Opsi isi dropdown filter — diambil dari data yang benar-benar ada. */
export interface OpsiFilter {
  unit: Array<{ id: number; nama: string; level: number }>
  eselon: string[]
  jenjang: string[]
  tingkatPendidikan: string[]
}

export async function ambilOpsiFilter(): Promise<OpsiFilter> {
  const [unit, eselon, jenjang, pendidikan] = await Promise.all([
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
       ORDER BY FIELD(j.eselon,'I','II','III','IV','NON_ESELON')`,
    ),
    kueri<{ jenjang: string }>(
      `SELECT DISTINCT j.jenjang FROM jabatan j JOIN pegawai p ON p.jabatan_id = j.id
       ORDER BY j.jenjang`,
    ),
    kueri<{ tingkat_pendidikan: string }>(
      `SELECT DISTINCT tingkat_pendidikan FROM pegawai
       ORDER BY FIELD(tingkat_pendidikan,'S3','S2','S1_D4','D3','SLTA')`,
    ),
  ])

  return {
    unit: unit.map((u) => ({
      id: Number(u.id),
      nama: String(u.nama_unit),
      level: Number(u.level),
    })),
    eselon: eselon.map((e) => String(e.eselon)),
    jenjang: jenjang.map((j) => String(j.jenjang)),
    tingkatPendidikan: pendidikan.map((p) => String(p.tingkat_pendidikan)),
  }
}

// ---------------------------------------------------------------------------
// Profil Talenta 360°
// ---------------------------------------------------------------------------

export interface ProfilPegawai {
  pegawaiId: number
  nip: string
  nama: string
  golongan: string | null
  pangkat: string
  tmtGolongan: string | null
  tmtJabatan: string | null
  namaJabatan: string | null
  jenisJabatan: 'STRUKTURAL' | 'FUNGSIONAL_TERTENTU' | 'FUNGSIONAL_UMUM' | null
  jenjang: string | null
  eselon: Eselon | null
  namaUnit: string | null
  unitInduk: string | null
  sekolahTerakhir: string | null
  bidangStudiTerakhir: string | null
  tingkatPendidikan: TingkatPendidikan
  statusAktif: string
  sumberSinkron: string
  riwayatDiklat: string[]
  /** Turunan dari NIP — tidak ada kolomnya di DB (phase.md §3 K-6). */
  tanggalLahir: Date | null
  usia: number | null
  jenisKelamin: 'L' | 'P' | null
  tmtCpns: { tahun: number; bulan: number } | null
  masaKerjaTahun: number | null
  nipValid: boolean
  masalahNip: string[]
  batasUsiaPensiun: number
  tanggalPensiun: Date | null
  tahunKePensiun: number | null
  segeraPensiun: boolean
  lamaMenjabatTahun: number | null
}

/**
 * Profil satu pegawai.
 *
 * `unitWajib` menegakkan pembatasan data per unit **di dalam kueri**, bukan
 * dengan memeriksa hasilnya setelah terambil. Bedanya bukan gaya: memeriksa
 * setelahnya berarti barisnya sempat ada di memori proses, dan cara paling
 * mudah agar ia bocor adalah seseorang menambahkan satu `console.log` atau
 * satu prop ke komponen. Yang tidak pernah terbaca tidak bisa bocor.
 *
 * Pegawai di luar lingkup mengembalikan `null` — halaman memperlakukannya
 * sama dengan NIP yang tidak ada. Itu disengaja: pesan "ada tapi Anda tidak
 * boleh" mengonfirmasi keberadaan orangnya kepada yang tidak berhak tahu.
 */
export async function ambilProfil(
  nip: string,
  unitWajib?: number | null,
): Promise<ProfilPegawai | null> {
  const batasUnit =
    unitWajib !== undefined && unitWajib !== null
      ? ` AND u.id IN (${SUBKUERI_UNIT_TURUNAN})`
      : ''
  const r = await kueriSatu<Record<string, unknown>>(
    `SELECT p.*, j.nama_jabatan, j.jenis_jabatan, j.jenjang, j.eselon,
            u.nama_unit, ui.nama_unit AS unit_induk
     FROM pegawai p
     LEFT JOIN jabatan j ON j.id = p.jabatan_id
     LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     LEFT JOIN unit_organisasi ui ON ui.id = u.parent_id
     WHERE p.nip = ?${batasUnit}`,
    batasUnit === '' ? [nip] : [nip, unitWajib],
  )
  if (!r) return null

  const sekarang = new Date()
  const terurai = parseNip(String(r.nip), sekarang)
  const jenisJabatan = r.jenis_jabatan === null ? null : (String(r.jenis_jabatan) as ProfilPegawai['jenisJabatan'])
  const jenjang = r.jenjang === null ? null : String(r.jenjang)
  const pensiun = proyeksiPensiun(terurai.tanggalLahir, jenisJabatan, jenjang, sekarang)

  const diklatMentah = r.riwayat_diklat
  const riwayatDiklat: string[] = Array.isArray(diklatMentah)
    ? diklatMentah.map(String)
    : typeof diklatMentah === 'string'
      ? (JSON.parse(diklatMentah) as string[])
      : []

  const tmtJabatan = r.tmt_jabatan ? new Date(String(r.tmt_jabatan)) : null
  const tmtCpns =
    terurai.tmtCpnsTahun !== null && terurai.tmtCpnsBulan !== null
      ? { tahun: terurai.tmtCpnsTahun, bulan: terurai.tmtCpnsBulan }
      : null

  return {
    pegawaiId: Number(r.id),
    nip: String(r.nip),
    nama: String(r.nama_lengkap),
    golongan: normalisasiGolongan(r.golongan as string),
    pangkat: String(r.pangkat),
    tmtGolongan: r.tmt_golongan ? String(r.tmt_golongan) : null,
    tmtJabatan: r.tmt_jabatan ? String(r.tmt_jabatan) : null,
    namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
    jenisJabatan,
    jenjang,
    eselon: r.eselon === null ? null : (String(r.eselon) as Eselon),
    namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
    unitInduk: r.unit_induk === null ? null : String(r.unit_induk),
    sekolahTerakhir: r.sekolah_terakhir === null ? null : String(r.sekolah_terakhir),
    bidangStudiTerakhir:
      r.bidang_studi_terakhir === null ? null : String(r.bidang_studi_terakhir),
    tingkatPendidikan: String(r.tingkat_pendidikan) as TingkatPendidikan,
    statusAktif: String(r.status_aktif),
    sumberSinkron: String(r.sumber_sinkron),
    riwayatDiklat,
    tanggalLahir: terurai.tanggalLahir,
    usia: hitungUsia(terurai.tanggalLahir, sekarang),
    jenisKelamin: terurai.jenisKelamin,
    tmtCpns,
    masaKerjaTahun:
      tmtCpns === null
        ? null
        : selisihTahun(new Date(tmtCpns.tahun, tmtCpns.bulan - 1, 1, 12), sekarang),
    nipValid: terurai.valid,
    masalahNip: terurai.masalah,
    batasUsiaPensiun: pensiun.batasUsia,
    tanggalPensiun: pensiun.tanggalPensiun,
    tahunKePensiun: pensiun.tahunTersisa,
    segeraPensiun: pensiun.segeraPensiun,
    lamaMenjabatTahun: selisihTahun(tmtJabatan, sekarang),
  }
}

export interface RiwayatJabatanProfil {
  urutan: number
  namaMentah: string
  terpetakan: boolean
  namaJabatan: string | null
  jenjang: string | null
  eselon: string | null
  namaUnit: string | null
  tanggalMulai: string | null
  tanggalAkhir: string | null
  lamaTahun: number | null
  noSk: string | null
  /** Penugasan non-definitif (Plt/Plh) — input sub-indikator Substansi. */
  nonDefinitif: 'Plt' | 'Plh' | null
}

export async function ambilRiwayatJabatan(pegawaiId: number): Promise<RiwayatJabatanProfil[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT r.urutan, r.jabatan_nama_mentah, r.jabatan_id, r.tanggal_mulai, r.tanggal_akhir,
            r.no_sk, j.nama_jabatan, j.jenjang, j.eselon, u.nama_unit
     FROM riwayat_jabatan r
     LEFT JOIN jabatan j ON j.id = r.jabatan_id
     LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     WHERE r.pegawai_id = ?
     ORDER BY r.urutan`,
    [pegawaiId],
  )

  const sekarang = new Date()
  return baris.map((r) => {
    const teks = String(r.jabatan_nama_mentah)
    const mulai = r.tanggal_mulai ? new Date(String(r.tanggal_mulai)) : null
    const akhir = r.tanggal_akhir ? new Date(String(r.tanggal_akhir)) : null
    return {
      urutan: Number(r.urutan),
      namaMentah: teks,
      terpetakan: r.jabatan_id !== null,
      namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
      jenjang: r.jenjang === null ? null : String(r.jenjang),
      eselon: r.eselon === null ? null : String(r.eselon),
      namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
      tanggalMulai: r.tanggal_mulai ? String(r.tanggal_mulai) : null,
      tanggalAkhir: r.tanggal_akhir ? String(r.tanggal_akhir) : null,
      lamaTahun: selisihTahun(mulai, akhir ?? sekarang),
      noSk: r.no_sk === null ? null : String(r.no_sk),
      nonDefinitif: /\b(plt|pelaksana tugas)\b/i.test(teks)
        ? 'Plt'
        : /\b(plh|pelaksana harian)\b/i.test(teks)
          ? 'Plh'
          : null,
    }
  })
}

export interface RiwayatPendidikanProfil {
  urutan: number
  jenjang: string
  bidangStudi: string
  namaSekolah: string | null
  tahunLulus: number | null
  urlIjazah: string | null
  urlTranskrip: string | null
  noPertekBkn: string | null
}

export async function ambilRiwayatPendidikan(
  pegawaiId: number,
): Promise<RiwayatPendidikanProfil[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT urutan, jenjang_pendidikan, bidang_studi, nama_sekolah, tahun_lulus,
            url_ijazah, url_transkrip, no_pertek_bkn
     FROM riwayat_pendidikan WHERE pegawai_id = ?
     ORDER BY FIELD(jenjang_pendidikan,'S3','S2','S1_D4','D3','SLTA'), urutan`,
    [pegawaiId],
  )

  return baris.map((r) => ({
    urutan: Number(r.urutan),
    jenjang: String(r.jenjang_pendidikan),
    bidangStudi: String(r.bidang_studi),
    namaSekolah: r.nama_sekolah === null ? null : String(r.nama_sekolah),
    tahunLulus: angka(r.tahun_lulus as number),
    urlIjazah: r.url_ijazah === null ? null : String(r.url_ijazah),
    urlTranskrip: r.url_transkrip === null ? null : String(r.url_transkrip),
    noPertekBkn: r.no_pertek_bkn === null ? null : String(r.no_pertek_bkn),
  }))
}

export interface AsesmenProfil {
  tahunAsesmen: number
  jenisAsesmen: string
  statusAsesmen: string
  nilaiKinerjaY: number
  nilaiPotensialX: number
  potkom: number
  nilaiIntegritas: number | null
  nilaiTalenta: number
  kotak9: Kotak9
  predikatKinerja: string
}

export async function ambilRiwayatAsesmen(pegawaiId: number): Promise<AsesmenProfil[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT tahun_asesmen, jenis_asesmen, status_asesmen, nilai_kinerja_y, nilai_potensial_x,
            potkom, nilai_integritas, nilai_talenta, kotak_9, rating_kinerja
     FROM asesmen_talenta WHERE pegawai_id = ?
     ORDER BY tahun_asesmen DESC`,
    [pegawaiId],
  )

  return baris.map((r) => ({
    tahunAsesmen: Number(r.tahun_asesmen),
    jenisAsesmen: String(r.jenis_asesmen),
    statusAsesmen: String(r.status_asesmen),
    nilaiKinerjaY: angkaWajib(r.nilai_kinerja_y as string),
    nilaiPotensialX: angkaWajib(r.nilai_potensial_x as string),
    potkom: angkaWajib(r.potkom as string),
    nilaiIntegritas: angka(r.nilai_integritas as string),
    nilaiTalenta: angkaWajib(r.nilai_talenta as string),
    kotak9: Number(r.kotak_9) as Kotak9,
    predikatKinerja: String(r.rating_kinerja),
  }))
}

export interface KinerjaProfil {
  tahun: number
  periode: string
  nilaiKinerja: number | null
  nilaiPerilaku: number | null
  predikat: string
}

export async function ambilKinerja(pegawaiId: number): Promise<KinerjaProfil[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT tahun, periode_skp, nilai_kinerja, nilai_perilaku, predikat
     FROM kinerja_periode WHERE pegawai_id = ?
     ORDER BY tahun DESC, FIELD(periode_skp,'TW1','TW2','TW3','TAHUNAN')`,
    [pegawaiId],
  )
  return baris.map((r) => ({
    tahun: Number(r.tahun),
    periode: String(r.periode_skp),
    nilaiKinerja: angka(r.nilai_kinerja as string),
    nilaiPerilaku: angka(r.nilai_perilaku as string),
    predikat: String(r.predikat),
  }))
}

export interface HukumanProfil {
  tingkatHukuman: string
  tanggalSk: string | null
  noSk: string | null
  keterangan: string | null
  statusAktif: boolean
}

export async function ambilHukumanDisiplin(pegawaiId: number): Promise<HukumanProfil[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT tingkat_hukuman, tanggal_sk, no_sk, keterangan, status_aktif
     FROM hukuman_disiplin WHERE pegawai_id = ?
     ORDER BY status_aktif DESC, tanggal_sk DESC`,
    [pegawaiId],
  )
  return baris.map((r) => ({
    tingkatHukuman: String(r.tingkat_hukuman),
    tanggalSk: r.tanggal_sk ? String(r.tanggal_sk) : null,
    noSk: r.no_sk === null ? null : String(r.no_sk),
    keterangan: r.keterangan === null ? null : String(r.keterangan),
    statusAktif: Number(r.status_aktif) === 1,
  }))
}

export interface RincianIndikator {
  namaIndikator: string
  indukNama: string | null
  bobot: number | null
  nilaiMentah: string | null
  kategoriTerpilih: string | null
  skor: number
  perluReview: boolean
  sumberNilai: string
}

export interface MatchScoreProfil {
  jabatanTargetId: number
  kodeTarget: string
  namaTarget: string
  skorPotensiKompetensi: number
  skorKualifikasiJabatan: number
  skorIntegritasMoralitas: number
  skorTotal: number
  eligible: boolean
  catatanEligibility: string | null
  statusTalentPool: string | null
  ranking: number | null
  rincian: RincianIndikator[]
}

/**
 * Match score pegawai terhadap semua jabatan target, lengkap dengan rincian per
 * indikator (usulan U-3) — inilah yang membuat pertanyaan "kenapa skornya beda
 * antar jabatan target?" bisa dijawab dari UI.
 */
export async function ambilMatchScore(pegawaiId: number): Promise<MatchScoreProfil[]> {
  const [skor, rincian] = await Promise.all([
    kueri<Record<string, unknown>>(
      `SELECT ms.id, ms.jabatan_target_id, jt.kode_target, jt.nama_target,
              ms.skor_potensi_kompetensi, ms.skor_kualifikasi_jabatan,
              ms.skor_integritas_moralitas, ms.skor_total, ms.eligible,
              ms.catatan_eligibility, tp.status AS status_pool, tp.ranking
       FROM match_score ms
       JOIN jabatan_target jt ON jt.id = ms.jabatan_target_id
       LEFT JOIN talent_pool tp ON tp.pegawai_id = ms.pegawai_id
                               AND tp.jabatan_target_id = ms.jabatan_target_id
       WHERE ms.pegawai_id = ?
       ORDER BY ms.skor_total DESC`,
      [pegawaiId],
    ),
    kueri<Record<string, unknown>>(
      `SELECT ms.jabatan_target_id, i.nama_indikator, ind.nama_indikator AS induk_nama,
              d.bobot_indikator, d.nilai_mentah, d.kategori_terpilih, d.skor,
              d.perlu_review, d.sumber_nilai, d.id
       FROM match_score_detail d
       JOIN match_score ms ON ms.id = d.match_score_id
       JOIN rubrik_indikator i ON i.id = d.rubrik_indikator_id
       LEFT JOIN rubrik_indikator ind ON ind.id = d.parent_indikator_id
       WHERE ms.pegawai_id = ?
       ORDER BY d.id`,
      [pegawaiId],
    ),
  ])

  const perTarget = new Map<number, RincianIndikator[]>()
  for (const r of rincian) {
    const id = Number(r.jabatan_target_id)
    const daftar = perTarget.get(id) ?? []
    daftar.push({
      namaIndikator: String(r.nama_indikator),
      indukNama: r.induk_nama === null ? null : String(r.induk_nama),
      bobot: angka(r.bobot_indikator as string),
      nilaiMentah: r.nilai_mentah === null ? null : String(r.nilai_mentah),
      kategoriTerpilih: r.kategori_terpilih === null ? null : String(r.kategori_terpilih),
      skor: angkaWajib(r.skor as string),
      perluReview: Number(r.perlu_review) === 1,
      sumberNilai: String(r.sumber_nilai),
    })
    perTarget.set(id, daftar)
  }

  return skor.map((r) => ({
    jabatanTargetId: Number(r.jabatan_target_id),
    kodeTarget: String(r.kode_target),
    namaTarget: String(r.nama_target),
    skorPotensiKompetensi: angkaWajib(r.skor_potensi_kompetensi as string),
    skorKualifikasiJabatan: angkaWajib(r.skor_kualifikasi_jabatan as string),
    skorIntegritasMoralitas: angkaWajib(r.skor_integritas_moralitas as string),
    skorTotal: angkaWajib(r.skor_total as string),
    eligible: Number(r.eligible) === 1,
    catatanEligibility: r.catatan_eligibility === null ? null : String(r.catatan_eligibility),
    statusTalentPool: r.status_pool === null ? null : String(r.status_pool),
    ranking: angka(r.ranking as number),
    rincian: perTarget.get(Number(r.jabatan_target_id)) ?? [],
  }))
}

/** Kelengkapan data satu pegawai — fakta dikumpulkan SQL, penilaian di lib/kelengkapan. */
export async function ambilKelengkapan(
  pegawaiId: number,
  nipValid: boolean,
): Promise<HasilKelengkapan> {
  const r = await kueriSatu<Record<string, unknown>>(
    `SELECT
       p.jabatan_id IS NOT NULL                                        AS jabatan_tertaut,
       (p.tmt_golongan IS NOT NULL AND p.tmt_jabatan IS NOT NULL)      AS tmt_lengkap,
       EXISTS (SELECT 1 FROM asesmen_talenta a WHERE a.pegawai_id = p.id) AS ada_asesmen,
       EXISTS (SELECT 1 FROM asesmen_talenta a WHERE a.pegawai_id = p.id
                 AND a.status_asesmen = 'Berlaku')                     AS asesmen_berlaku,
       EXISTS (SELECT 1 FROM kinerja_periode k WHERE k.pegawai_id = p.id
                 AND k.periode_skp = 'TAHUNAN' AND k.nilai_kinerja IS NOT NULL) AS ada_kinerja,
       (SELECT COUNT(DISTINCT periode_skp) FROM kinerja_periode k
          WHERE k.pegawai_id = p.id) >= 4                              AS kinerja_lengkap,
       EXISTS (SELECT 1 FROM riwayat_pendidikan rp WHERE rp.pegawai_id = p.id) AS ada_pendidikan,
       NOT EXISTS (SELECT 1 FROM riwayat_pendidikan rp WHERE rp.pegawai_id = p.id
                     AND rp.tahun_lulus IS NULL)                       AS pendidikan_bertahun,
       (p.riwayat_diklat IS NOT NULL AND JSON_LENGTH(p.riwayat_diklat) > 0) AS ada_diklat,
       (EXISTS (SELECT 1 FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id
                           AND rj.tanggal_mulai IS NULL))              AS riwayat_bertanggal,
       (EXISTS (SELECT 1 FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id
                           AND rj.jabatan_id IS NULL))                 AS riwayat_terpetakan,
       EXISTS (SELECT 1 FROM hukuman_disiplin h WHERE h.pegawai_id = p.id) AS disiplin_ada
     FROM pegawai p WHERE p.id = ?`,
    [pegawaiId],
  )

  const b = (k: string): boolean => Number(r?.[k] ?? 0) === 1

  return hitungKelengkapan({
    nipValid,
    jabatanTertaut: b('jabatan_tertaut'),
    tmtLengkap: b('tmt_lengkap'),
    adaAsesmen: b('ada_asesmen'),
    asesmenBerlaku: b('asesmen_berlaku'),
    adaKinerjaTahunan: b('ada_kinerja'),
    kinerjaTriwulanLengkap: b('kinerja_lengkap'),
    adaPendidikan: b('ada_pendidikan'),
    pendidikanBertahun: b('pendidikan_bertahun'),
    adaDiklat: b('ada_diklat'),
    riwayatJabatanBertanggal: b('riwayat_bertanggal'),
    riwayatJabatanTerpetakan: b('riwayat_terpetakan'),
    disiplinTerverifikasi: b('disiplin_ada'),
  })
}
