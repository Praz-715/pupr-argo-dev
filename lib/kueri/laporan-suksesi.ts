import 'server-only'

import { angka, angkaWajib, kueri } from '../db'
import { adalahKategoriCatatan, type KategoriCatatan } from '../catatan-pegawai'
import { labelTargetDenganTempat } from '../jenis-jabatan'
import { SUBKUERI_UNIT_TURUNAN } from './dasar'

/**
 * Rekap suksesi siap cetak — satu berkas untuk SEMUA jabatan target.
 *
 * Permintaan pemilik proses 2 Sep 2026 (`2 sept- masukan sistem informasi.pdf`
 * butir 2, diperjelas lewat chat): *"1 rekapan untuk gabungan jabatan dengan
 * kandidat-kandidat terpilih. Misal ada 10 jabatan target, nanti isiannya dari tiap
 * 10 itu ada siapa calon utama unggulnya dan cadangannya yang mendekati
 * nilai-nilainya. Jumlah berkasnya mengikuti jumlah isian masing-masing detail per
 * jabatan target."* Alasannya: *"pimpinan saat rapat biasanya dibawakan bahan print
 * laporan."*
 *
 * ## Bagaimana "calon utama" ditentukan — dan kenapa BUKAN sekadar skor tertinggi
 *
 * Kalau seseorang sudah dimasukkan ke daftar suksesi, keputusan itu **mendahului**
 * angka: pimpinan yang membaca lembar ini perlu melihat orang yang sedang berjalan
 * di alurnya, bukan orang lain yang skornya kebetulan lebih tinggi. Jadi urutannya:
 *
 *   1. anggota talent pool, menurut TAHAP-nya (ditetapkan → diverifikasi →
 *      dinominasikan → kandidat), lalu peringkat pool;
 *   2. kalau pool-nya kosong, kandidat lolos syarat berskor tertinggi.
 *
 * Cabang (2) yang membuat lembar ini tetap berguna sebelum seorang pun dimasukkan
 * ke pool — keadaan data hari ini. Kolom `dariPool` menyatakan mana yang sedang
 * berlaku, supaya pembacanya tidak menyimpulkan seseorang "sudah dicalonkan"
 * padahal ia baru peringkat teratas.
 *
 * ## "Cadangan yang mendekati nilainya"
 *
 * Diambil dari peringkat berikutnya YANG LOLOS SYARAT, dan tiap baris membawa
 * **selisih skornya terhadap calon utama** — itu yang menjawab "mendekati" dengan
 * angka alih-alih dengan urutan. Yang tidak lolos syarat tidak ikut: mencantumkannya
 * sebagai cadangan berarti menawarkan orang yang justru tidak boleh diangkat.
 */

export interface KandidatRekap {
  pegawaiId: number
  nip: string
  nama: string
  namaJabatan: string | null
  namaUnit: string | null
  golongan: string | null
  skorTotal: number
  kotak9: number | null
  predikatKinerja: string | null
  statusPool: string | null
  rankingPool: number | null
  /** Selisih skor terhadap calon utama; 0 untuk calon utamanya sendiri. */
  selisihSkor: number
  catatanKategori: KategoriCatatan | null
}

export interface BarisRekapSuksesi {
  jabatanTargetId: number
  kodeTarget: string
  namaTarget: string
  namaUnit: string | null
  jumlahDinilai: number
  jumlahLolos: number
  jumlahPool: number
  /** `true` = calon utamanya diambil dari daftar suksesi, bukan dari peringkat skor. */
  dariPool: boolean
  calonUtama: KandidatRekap | null
  cadangan: KandidatRekap[]
}

/** Berapa cadangan yang dicetak per jabatan target. */
export const JUMLAH_CADANGAN = 4

export async function ambilRekapSuksesi(
  unitWajibId: number | null,
  opsi: { hanyaAktif?: boolean } = {},
): Promise<BarisRekapSuksesi[]> {
  const hanyaAktif = opsi.hanyaAktif ?? true

  const target = await kueri<Record<string, unknown>>(
    `SELECT t.id, t.kode_target, t.nama_target, t.status, u.nama_unit,
            (SELECT COUNT(*) FROM match_score m WHERE m.jabatan_target_id = t.id) AS dinilai,
            (SELECT COUNT(*) FROM match_score m
              WHERE m.jabatan_target_id = t.id AND m.eligible = 1) AS lolos,
            (SELECT COUNT(*) FROM talent_pool tp WHERE tp.jabatan_target_id = t.id) AS pool
       FROM jabatan_target t
       LEFT JOIN jabatan j ON j.id = t.jabatan_id
       LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
      WHERE 1 = 1
        ${hanyaAktif ? "AND t.status = 'AKTIF'" : ''}
      ORDER BY u.nama_unit, t.nama_target`,
  )
  if (target.length === 0) return []

  const idTarget = target.map((t) => Number(t.id))

  /*
    Satu kueri untuk SELURUH kandidat semua jabatan target, lalu dikelompokkan di
    TypeScript — bukan satu kueri per target. Dengan 13 target aktif, versi
    per-target berarti 13 kali pembacaan tabel skor beserta join asesmen &
    talent_pool-nya, dan halaman ini dibuka untuk dicetak (semua target sekaligus),
    bukan satu per satu.

    `LIMIT` sengaja TIDAK dipasang di SQL: yang menentukan berapa baris terpakai
    adalah aturan pemilihan di bawah (pool lebih dulu), dan memotong di SQL menurut
    skor bisa membuang anggota pool berskor rendah — yaitu justru baris yang paling
    harus muncul.
  */
  const kandidat = await kueri<Record<string, unknown>>(
    `SELECT m.jabatan_target_id, m.pegawai_id, m.skor_total, m.eligible,
            p.nip, p.nama_lengkap, p.golongan, p.catatan_kategori,
            j.nama_jabatan, u.nama_unit,
            a.kotak_9, a.rating_kinerja,
            tp.status AS status_pool, tp.ranking AS ranking_pool
       FROM match_score m
       JOIN pegawai p ON p.id = m.pegawai_id
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
       LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
       LEFT JOIN asesmen_dipakai ad ON ad.pegawai_id = p.id
       LEFT JOIN asesmen_talenta a ON a.id = ad.asesmen_id
       LEFT JOIN talent_pool tp ON tp.pegawai_id = m.pegawai_id
                               AND tp.jabatan_target_id = m.jabatan_target_id
      WHERE m.jabatan_target_id IN (?)
        AND p.status_aktif = 'AKTIF'
        ${unitWajibId === null ? '' : `AND j.unit_organisasi_id IN (${SUBKUERI_UNIT_TURUNAN})`}
      ORDER BY m.jabatan_target_id, m.skor_total DESC, p.nama_lengkap`,
    unitWajibId === null ? [idTarget] : [idTarget, unitWajibId],
  )

  /** Tahap suksesi — makin besar makin jauh berjalan. Dipakai memilih calon utama. */
  const TAHAP: Record<string, number> = {
    DITETAPKAN: 4,
    DIVERIFIKASI: 3,
    DINOMINASIKAN: 2,
    KANDIDAT: 1,
  }

  const perTarget = new Map<number, Record<string, unknown>[]>()
  for (const k of kandidat) {
    const id = Number(k.jabatan_target_id)
    perTarget.set(id, [...(perTarget.get(id) ?? []), k])
  }

  return target.map((t) => {
    const id = Number(t.id)
    const semua = perTarget.get(id) ?? []

    const anggotaPool = semua
      .filter((k) => k.status_pool !== null && String(k.status_pool) !== 'DITOLAK')
      .sort(
        (a, b) =>
          (TAHAP[String(b.status_pool)] ?? 0) - (TAHAP[String(a.status_pool)] ?? 0) ||
          (Number(a.ranking_pool ?? 999) - Number(b.ranking_pool ?? 999)) ||
          Number(b.skor_total) - Number(a.skor_total),
      )

    const lolos = semua.filter((k) => Number(k.eligible) === 1)
    const dariPool = anggotaPool.length > 0
    const urutan = dariPool
      ? [...anggotaPool, ...lolos.filter((k) => !anggotaPool.includes(k))]
      : lolos

    const utamaMentah = urutan[0] ?? null
    const skorUtama = utamaMentah === null ? 0 : Number(utamaMentah.skor_total)

    const petakan = (k: Record<string, unknown>): KandidatRekap => ({
      pegawaiId: Number(k.pegawai_id),
      nip: String(k.nip),
      nama: String(k.nama_lengkap),
      namaJabatan: k.nama_jabatan === null ? null : String(k.nama_jabatan),
      namaUnit: k.nama_unit === null ? null : String(k.nama_unit),
      golongan: k.golongan === null ? null : String(k.golongan),
      skorTotal: angkaWajib(k.skor_total as string),
      kotak9: angka(k.kotak_9 as number),
      predikatKinerja: k.rating_kinerja === null ? null : String(k.rating_kinerja),
      statusPool: k.status_pool === null ? null : String(k.status_pool),
      rankingPool: angka(k.ranking_pool as number),
      selisihSkor: Math.round((skorUtama - Number(k.skor_total)) * 100) / 100,
      catatanKategori:
        k.catatan_kategori !== null && adalahKategoriCatatan(String(k.catatan_kategori))
          ? (String(k.catatan_kategori) as KategoriCatatan)
          : null,
    })

    return {
      jabatanTargetId: id,
      kodeTarget: String(t.kode_target),
      namaTarget: labelTargetDenganTempat(
        String(t.nama_target),
        t.nama_unit === null ? null : String(t.nama_unit),
      ),
      namaUnit: t.nama_unit === null ? null : String(t.nama_unit),
      jumlahDinilai: Number(t.dinilai),
      jumlahLolos: Number(t.lolos),
      jumlahPool: Number(t.pool),
      dariPool,
      calonUtama: utamaMentah === null ? null : petakan(utamaMentah),
      cadangan: urutan.slice(1, 1 + JUMLAH_CADANGAN).map(petakan),
    }
  })
}
