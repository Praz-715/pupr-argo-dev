import 'server-only'

import { MAKS_KANDIDAT } from '../banding'
import { angka, angkaWajib, kueri } from '../db'
import { hitungUsia, parseNip, proyeksiPensiun, selisihTahun, type JenisJabatan } from '../nip'
import { normalisasiGolongan } from '../normalisasi'
import type { Kotak9 } from '../scoring'
import { CTE_ASESMEN_TERBARU, filterSumber } from './dasar'

/**
 * Kueri Perbandingan Kandidat (Fase 3).
 *
 * Dua hal yang membentuk desainnya:
 *
 * 1. **Jumlah kandidat dibatasi 2–4** (PRD §6.3), jadi kueri dibuat berbasis
 *    himpunan (`nip IN (…)`) — satu perjalanan ke DB untuk semua kandidat, bukan
 *    satu kueri per orang. Batasnya ditegakkan di lapisan ini juga, bukan cuma di
 *    UI, supaya `?nip=` berisi 50 NIP tidak menghasilkan kueri raksasa.
 *
 * 2. **Match score hanya sebanding dalam satu jabatan target.** Bobot komponen &
 *    daftar indikator berbeda antar target, jadi membandingkan skor lintas target
 *    berarti membandingkan dua besaran yang berbeda. Karena itu `ambilTargetBersama`
 *    mengembalikan target mana yang **dimiliki semua kandidat** — hanya itu yang
 *    boleh dipakai membandingkan skor.
 */

export interface KandidatBanding {
  pegawaiId: number
  nip: string
  nama: string
  namaJabatan: string | null
  namaUnit: string | null
  eselon: string | null
  jenjang: string | null
  pangkat: string
  golongan: string | null
  /** Turunan NIP (K-6) — tidak ada kolomnya di DB. */
  usia: number | null
  masaKerjaTahun: number | null
  batasUsiaPensiun: number
  tahunKePensiun: number | null
  segeraPensiun: boolean
  /** Asesmen terbaru; null kalau belum pernah diases. */
  tahunAsesmen: number | null
  jenisAsesmen: string | null
  statusAsesmen: string | null
  nilaiKinerjaY: number | null
  predikatKinerja: string | null
  nilaiPotensialX: number | null
  potkom: number | null
  nilaiIntegritas: number | null
  nilaiTalenta: number | null
  kotak9: Kotak9 | null
  pendidikanTertinggi: string | null
  bidangStudi: string | null
  jumlahDiklat: number
  jumlahRiwayatJabatan: number
  tahunMulaiJabatanTerlama: number | null
  hukumanAktifTerberat: string | null
}

/**
 * Ambil kandidat menurut daftar NIP. Urutan hasil mengikuti urutan NIP yang
 * diminta — bukan urutan dari DB — supaya kolom di UI tidak bertukar tempat
 * setiap kali halaman dimuat ulang.
 */
export async function ambilKandidat(daftarNip: string[]): Promise<KandidatBanding[]> {
  const nips = [...new Set(daftarNip)].slice(0, MAKS_KANDIDAT)
  if (nips.length === 0) return []

  const isian = nips.map(() => '?').join(',')

  const baris = await kueri<Record<string, unknown>>(
    `${CTE_ASESMEN_TERBARU}
     SELECT p.id, p.nip, p.nama_lengkap, p.pangkat, p.golongan,
            j.nama_jabatan, j.eselon, j.jenjang, j.jenis_jabatan,
            u.nama_unit,
            a.tahun_asesmen, a.jenis_asesmen, a.status_asesmen,
            a.nilai_kinerja_y, a.rating_kinerja, a.nilai_potensial_x,
            a.potkom, a.nilai_integritas, a.nilai_talenta, a.kotak_9,
            (SELECT rp.jenjang_pendidikan FROM riwayat_pendidikan rp
              WHERE rp.pegawai_id = p.id
              ORDER BY FIELD(rp.jenjang_pendidikan,'S3','S2','S1_D4','D3','SLTA'), rp.urutan
              LIMIT 1) AS pendidikan_tertinggi,
            (SELECT rp.bidang_studi FROM riwayat_pendidikan rp
              WHERE rp.pegawai_id = p.id
              ORDER BY FIELD(rp.jenjang_pendidikan,'S3','S2','S1_D4','D3','SLTA'), rp.urutan
              LIMIT 1) AS bidang_studi,
            COALESCE(JSON_LENGTH(p.riwayat_diklat), 0) AS jumlah_diklat,
            (SELECT COUNT(*) FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id) AS jml_riwayat,
            (SELECT YEAR(MIN(rj.tanggal_mulai)) FROM riwayat_jabatan rj
              WHERE rj.pegawai_id = p.id) AS tahun_mulai_terlama,
            (SELECT hd.tingkat_hukuman FROM hukuman_disiplin hd
              WHERE hd.pegawai_id = p.id AND hd.status_aktif = 1
              ORDER BY FIELD(hd.tingkat_hukuman,'Sedang Menjalani','Berat','Sedang','Ringan')
              LIMIT 1) AS hukuman_aktif
     FROM pegawai p
     LEFT JOIN jabatan j ON j.id = p.jabatan_id
     LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     LEFT JOIN asesmen_terbaru a ON a.pegawai_id = p.id
     WHERE p.nip IN (${isian}) ${filterSumber('p')}`,
    nips,
  )

  const sekarang = new Date()

  const petaHasil = new Map<string, KandidatBanding>()
  for (const r of baris) {
    const nip = String(r.nip)
    const terurai = parseNip(nip, sekarang)
    const jenisJabatan =
      r.jenis_jabatan === null ? null : (String(r.jenis_jabatan) as JenisJabatan)
    const jenjang = r.jenjang === null ? null : String(r.jenjang)
    const pensiun = proyeksiPensiun(terurai.tanggalLahir, jenisJabatan, jenjang, sekarang)
    const tmtCpns =
      terurai.tmtCpnsTahun !== null && terurai.tmtCpnsBulan !== null
        ? new Date(terurai.tmtCpnsTahun, terurai.tmtCpnsBulan - 1, 1, 12)
        : null

    petaHasil.set(nip, {
      pegawaiId: Number(r.id),
      nip,
      nama: String(r.nama_lengkap),
      namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
      namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
      eselon: r.eselon === null ? null : String(r.eselon),
      jenjang,
      pangkat: String(r.pangkat),
      golongan: r.golongan === null ? null : normalisasiGolongan(String(r.golongan)),
      usia: hitungUsia(terurai.tanggalLahir, sekarang),
      masaKerjaTahun: selisihTahun(tmtCpns, sekarang),
      batasUsiaPensiun: pensiun.batasUsia,
      tahunKePensiun: pensiun.tahunTersisa,
      segeraPensiun: pensiun.segeraPensiun,
      tahunAsesmen: angka(r.tahun_asesmen as number),
      jenisAsesmen: r.jenis_asesmen === null ? null : String(r.jenis_asesmen),
      statusAsesmen: r.status_asesmen === null ? null : String(r.status_asesmen),
      nilaiKinerjaY: angka(r.nilai_kinerja_y as string),
      predikatKinerja: r.rating_kinerja === null ? null : String(r.rating_kinerja),
      nilaiPotensialX: angka(r.nilai_potensial_x as string),
      potkom: angka(r.potkom as string),
      nilaiIntegritas: angka(r.nilai_integritas as string),
      nilaiTalenta: angka(r.nilai_talenta as string),
      kotak9: r.kotak_9 === null ? null : (Number(r.kotak_9) as Kotak9),
      pendidikanTertinggi:
        r.pendidikan_tertinggi === null ? null : String(r.pendidikan_tertinggi),
      bidangStudi: r.bidang_studi === null ? null : String(r.bidang_studi),
      jumlahDiklat: Number(r.jumlah_diklat ?? 0),
      jumlahRiwayatJabatan: Number(r.jml_riwayat ?? 0),
      tahunMulaiJabatanTerlama: angka(r.tahun_mulai_terlama as number),
      hukumanAktifTerberat: r.hukuman_aktif === null ? null : String(r.hukuman_aktif),
    })
  }

  // Urutan mengikuti permintaan, bukan urutan baris DB.
  return nips.map((n) => petaHasil.get(n)).filter((k): k is KandidatBanding => k !== undefined)
}

// ---------------------------------------------------------------------------
// Jabatan target yang boleh dipakai membandingkan skor
// ---------------------------------------------------------------------------

export interface TargetBanding {
  jabatanTargetId: number
  kodeTarget: string
  namaTarget: string
  /** Berapa dari kandidat terpilih yang punya match score untuk target ini. */
  jumlahPunyaSkor: number
}

/**
 * Daftar jabatan target beserta berapa kandidat yang punya skornya.
 *
 * UI memakai `jumlahPunyaSkor` untuk membedakan target yang **sebanding** (semua
 * kandidat punya skor) dari yang timpang — membandingkan skor ketika sebagian
 * kandidat tidak punya nilainya sama sekali hanya akan terbaca sebagai "yang
 * kosong itu jelek".
 */
export async function ambilTargetBanding(pegawaiIds: number[]): Promise<TargetBanding[]> {
  if (pegawaiIds.length === 0) return []
  const isian = pegawaiIds.map(() => '?').join(',')

  const baris = await kueri<Record<string, unknown>>(
    `SELECT jt.id, jt.kode_target, jt.nama_target,
            COUNT(DISTINCT ms.pegawai_id) AS jml
     FROM jabatan_target jt
     JOIN match_score ms ON ms.jabatan_target_id = jt.id AND ms.pegawai_id IN (${isian})
     GROUP BY jt.id, jt.kode_target, jt.nama_target
     ORDER BY jml DESC, jt.nama_target`,
    pegawaiIds,
  )

  return baris.map((r) => ({
    jabatanTargetId: Number(r.id),
    kodeTarget: String(r.kode_target),
    namaTarget: String(r.nama_target),
    jumlahPunyaSkor: Number(r.jml),
  }))
}

// ---------------------------------------------------------------------------
// Skor & rincian indikator untuk satu jabatan target
// ---------------------------------------------------------------------------

export interface SkorBandingIndikator {
  namaIndikator: string
  bobot: number | null
  skor: number
  perluReview: boolean
  sumberNilai: string
}

export interface SkorBanding {
  pegawaiId: number
  skorPotensiKompetensi: number
  skorKualifikasiJabatan: number
  skorIntegritasMoralitas: number
  skorTotal: number
  eligible: boolean
  catatanEligibility: string | null
  statusTalentPool: string | null
  ranking: number | null
  /** Hanya indikator tingkat atas (sub-indikator sudah teragregasi ke induknya). */
  indikator: SkorBandingIndikator[]
}

export async function ambilSkorBanding(
  pegawaiIds: number[],
  jabatanTargetId: number,
): Promise<Map<number, SkorBanding>> {
  const hasil = new Map<number, SkorBanding>()
  if (pegawaiIds.length === 0) return hasil

  const isian = pegawaiIds.map(() => '?').join(',')

  const [skor, rincian] = await Promise.all([
    kueri<Record<string, unknown>>(
      `SELECT ms.pegawai_id, ms.skor_potensi_kompetensi, ms.skor_kualifikasi_jabatan,
              ms.skor_integritas_moralitas, ms.skor_total, ms.eligible,
              ms.catatan_eligibility, tp.status AS status_pool, tp.ranking
       FROM match_score ms
       LEFT JOIN talent_pool tp ON tp.pegawai_id = ms.pegawai_id
                               AND tp.jabatan_target_id = ms.jabatan_target_id
       WHERE ms.jabatan_target_id = ? AND ms.pegawai_id IN (${isian})`,
      [jabatanTargetId, ...pegawaiIds],
    ),
    // Hanya indikator tingkat atas: sub-indikator (punya parent) sudah masuk
    // hitungan induknya, jadi memasukkannya ke radar akan menghitung ganda.
    kueri<Record<string, unknown>>(
      `SELECT ms.pegawai_id, i.nama_indikator, d.bobot_indikator, d.skor,
              d.perlu_review, d.sumber_nilai, d.id
       FROM match_score_detail d
       JOIN match_score ms ON ms.id = d.match_score_id
       JOIN rubrik_indikator i ON i.id = d.rubrik_indikator_id
       WHERE ms.jabatan_target_id = ? AND ms.pegawai_id IN (${isian})
         AND d.parent_indikator_id IS NULL
       ORDER BY d.id`,
      [jabatanTargetId, ...pegawaiIds],
    ),
  ])

  const perPegawai = new Map<number, SkorBandingIndikator[]>()
  for (const r of rincian) {
    const id = Number(r.pegawai_id)
    const daftar = perPegawai.get(id) ?? []
    daftar.push({
      namaIndikator: String(r.nama_indikator),
      bobot: angka(r.bobot_indikator as string),
      skor: angkaWajib(r.skor as string),
      perluReview: Number(r.perlu_review) === 1,
      sumberNilai: String(r.sumber_nilai),
    })
    perPegawai.set(id, daftar)
  }

  for (const r of skor) {
    const id = Number(r.pegawai_id)
    hasil.set(id, {
      pegawaiId: id,
      skorPotensiKompetensi: angkaWajib(r.skor_potensi_kompetensi as string),
      skorKualifikasiJabatan: angkaWajib(r.skor_kualifikasi_jabatan as string),
      skorIntegritasMoralitas: angkaWajib(r.skor_integritas_moralitas as string),
      skorTotal: angkaWajib(r.skor_total as string),
      eligible: Number(r.eligible) === 1,
      catatanEligibility: r.catatan_eligibility === null ? null : String(r.catatan_eligibility),
      statusTalentPool: r.status_pool === null ? null : String(r.status_pool),
      ranking: angka(r.ranking as number),
      indikator: perPegawai.get(id) ?? [],
    })
  }

  return hasil
}

// ---------------------------------------------------------------------------
// Pencarian kandidat untuk pemilih
// ---------------------------------------------------------------------------

export interface HasilCari {
  nip: string
  nama: string
  namaJabatan: string | null
  namaUnit: string | null
  kotak9: Kotak9 | null
}

/**
 * Pencarian kandidat — dirender di server dari `?cari=`, bukan lewat panggilan
 * fetch dari klien. Alasannya konsistensi: seluruh state halaman lain di aplikasi
 * ini ada di URL, dan cara ini tidak menambah permukaan API baru yang perlu
 * diamankan sendiri.
 */
export async function cariKandidat(q: string, batas = 8): Promise<HasilCari[]> {
  const pola = `%${q.trim()}%`
  const baris = await kueri<Record<string, unknown>>(
    `${CTE_ASESMEN_TERBARU}
     SELECT p.nip, p.nama_lengkap, j.nama_jabatan, u.nama_unit, a.kotak_9
     FROM pegawai p
     LEFT JOIN jabatan j ON j.id = p.jabatan_id
     LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     LEFT JOIN asesmen_terbaru a ON a.pegawai_id = p.id
     WHERE (p.nama_lengkap LIKE ? OR p.nip LIKE ?) ${filterSumber('p')}
     ORDER BY p.nama_lengkap
     LIMIT ?`,
    [pola, pola.replace(/\s/g, ''), batas],
  )

  return baris.map((r) => ({
    nip: String(r.nip),
    nama: String(r.nama_lengkap),
    namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
    namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
    kotak9: r.kotak_9 === null ? null : (Number(r.kotak_9) as Kotak9),
  }))
}
