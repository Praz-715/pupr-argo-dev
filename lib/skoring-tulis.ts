import 'server-only'

import { eksekusi, kueri } from './db'
import { hitungRanking } from './scoring'
import type { HasilSkorKandidat } from './skor-massal'

/**
 * Menuliskan hasil perhitungan ke `match_score`, `match_score_detail`, dan
 * peringkat `talent_pool`.
 *
 * Dipisah dari server action (`lib/aksi/skoring.ts`) karena dua alasan yang
 * berbeda sifatnya:
 *
 *   - Server action mengurus **siapa yang boleh** & jejak audit; modul ini
 *     mengurus **apa yang ditulis**. Mencampur keduanya membuat jalur tulis
 *     hanya bisa dijalankan lewat permintaan HTTP.
 *   - Jalur ini yang paling berat di aplikasi (ribuan baris per pemanggilan),
 *     jadi ia harus bisa **diukur** di skala produksi tanpa browser —
 *     `npm run ukur:hitung-ulang` memanggilnya langsung (phase.md §3 K-5:
 *     skala diukur, bukan diasumsikan).
 */

/**
 * Ukuran batch, dipilih dari hasil pengukuran (`npm run ukur:hitung-ulang`).
 *
 * Versi pertama modul ini menulis **per pegawai**: satu upsert + satu SELECT id +
 * satu DELETE + satu INSERT. Di 40 pegawai itu 1,4 detik — terasa cepat. Di 1.960
 * pegawai ternyata **48 detik**, dan seluruhnya di jalur tulis: bacaan &
 * perhitungannya hanya 116 ms. Penyebabnya bukan MySQL-nya lambat, tapi ~8.000
 * perjalanan bolak-balik yang tiap satuannya kecil.
 *
 * Karena itu semuanya di-batch. Batasnya bukan angka bulat asal: 300 baris skor
 * × 9 parameter dan 400 baris rincian × 11 parameter masih jauh di bawah batas
 * paket & jumlah placeholder MySQL, sementara sudah cukup besar untuk membuat
 * jumlah round-trip turun dua orde.
 */
const BATCH_SKOR = 300
const BATCH_RINCIAN = 400
const BATCH_HAPUS = 500

export interface JejakManualTulis {
  pegawaiId: number
  rubrikIndikatorId: number
  catatan: string | null
  diisiOleh: number | null
}

export interface RingkasTulis {
  jumlahSkor: number
  jumlahRincian: number
  jumlahAnggotaPool: number
}

function potong<T>(daftar: T[], ukuran: number): T[][] {
  const hasil: T[][] = []
  for (let i = 0; i < daftar.length; i += ukuran) hasil.push(daftar.slice(i, i + ukuran))
  return hasil
}

export async function tulisHasilSkor(
  jabatanTargetId: number,
  hasil: HasilSkorKandidat[],
  snapshotRubrik: string,
  jejakManual: JejakManualTulis[],
): Promise<RingkasTulis> {
  if (hasil.length === 0) {
    return { jumlahSkor: 0, jumlahRincian: 0, jumlahAnggotaPool: 0 }
  }

  await upsertSkor(jabatanTargetId, hasil, snapshotRubrik)
  const idPerPegawai = await petakanIdSkor(jabatanTargetId)
  const jumlahRincian = await tulisRincian(hasil, idPerPegawai, jejakManual)
  const jumlahAnggotaPool = await peringkatUlangPool(jabatanTargetId)

  return { jumlahSkor: hasil.length, jumlahRincian, jumlahAnggotaPool }
}

/**
 * Upsert seluruh baris `match_score` dalam beberapa perintah besar.
 *
 * Diperbarui, bukan dihapus lalu dibuat ulang: `talent_pool.match_score_id`
 * menunjuk ke baris ini, dan menghapusnya membuat tautan pool jadi NULL walau
 * isinya tidak berubah. Kunci unik `uk_match_score_pegawai_target`
 * (doc/sql/010) yang membuat upsert ini bisa diandalkan.
 */
async function upsertSkor(
  jabatanTargetId: number,
  hasil: HasilSkorKandidat[],
  snapshot: string,
): Promise<void> {
  for (const batch of potong(hasil, BATCH_SKOR)) {
    const params = batch.flatMap((h) => [
      h.pegawaiId,
      jabatanTargetId,
      h.skorPotensiKompetensi,
      h.skorKualifikasiJabatan,
      h.skorIntegritasMoralitas,
      h.skorTotal,
      h.eligible ? 1 : 0,
      h.catatanEligibility,
      snapshot,
    ])
    await eksekusi(
      `INSERT INTO match_score
         (pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan,
          skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot,
          computed_at)
       VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())').join(', ')}
       ON DUPLICATE KEY UPDATE
         skor_potensi_kompetensi = VALUES(skor_potensi_kompetensi),
         skor_kualifikasi_jabatan = VALUES(skor_kualifikasi_jabatan),
         skor_integritas_moralitas = VALUES(skor_integritas_moralitas),
         skor_total = VALUES(skor_total),
         eligible = VALUES(eligible),
         catatan_eligibility = VALUES(catatan_eligibility),
         rubrik_snapshot = VALUES(rubrik_snapshot),
         computed_at = NOW()`,
      params,
    )
  }
}

/**
 * `pegawai_id → match_score.id` dalam SATU kueri.
 *
 * `insertId` dari upsert tidak bisa dipakai: MySQL mengembalikan id baris
 * pertama saja, dan 0 bila tidak ada baris baru. Membaca ulang per pegawai juga
 * bukan pilihan — itu penyebab lambatnya versi pertama.
 */
async function petakanIdSkor(jabatanTargetId: number): Promise<Map<number, number>> {
  const baris = await kueri<{ id: number; pegawai_id: number }>(
    `SELECT id, pegawai_id FROM match_score WHERE jabatan_target_id = ?`,
    [jabatanTargetId],
  )
  return new Map(baris.map((r) => [Number(r.pegawai_id), Number(r.id)]))
}

/**
 * Tulis ulang `match_score_detail` untuk seluruh pegawai yang baru dihitung.
 *
 * Penghapusannya dibatasi pada id yang memang akan ditulis ulang — bukan seluruh
 * rincian jabatan target ini. Kalau seluruhnya dihapus, baris skor milik pegawai
 * yang sudah tidak aktif (jadi tidak ikut dihitung) akan kehilangan rinciannya
 * dan halamannya berbunyi "rincian belum tersedia" tanpa sebab yang jelas.
 *
 * Indikator yang punya jejak manual dipulihkan sebagai MANUAL beserta siapa yang
 * mengisinya — nilainya sendiri sudah masuk perhitungan lewat `nilaiManual`.
 */
async function tulisRincian(
  hasil: HasilSkorKandidat[],
  idPerPegawai: Map<number, number>,
  jejakManual: JejakManualTulis[],
): Promise<number> {
  const petaJejak = new Map(jejakManual.map((j) => [`${j.pegawaiId}:${j.rubrikIndikatorId}`, j]))

  const idSkor = hasil
    .map((h) => idPerPegawai.get(h.pegawaiId))
    .filter((id): id is number => id !== undefined)

  for (const batch of potong(idSkor, BATCH_HAPUS)) {
    await eksekusi(
      `DELETE FROM match_score_detail WHERE match_score_id IN (${batch.map(() => '?').join(', ')})`,
      batch,
    )
  }

  const baris: unknown[][] = []
  for (const h of hasil) {
    const matchScoreId = idPerPegawai.get(h.pegawaiId)
    if (matchScoreId === undefined) continue
    for (const d of h.detail) {
      const jejak = petaJejak.get(`${h.pegawaiId}:${d.rubrikIndikatorId}`)
      baris.push([
        matchScoreId,
        d.rubrikIndikatorId,
        d.parentIndikatorId,
        d.bobot,
        d.nilaiMentah === null ? null : String(d.nilaiMentah),
        d.kategoriTerpilih,
        d.skor,
        jejak === undefined ? 'OTOMATIS' : 'MANUAL',
        d.perluReview ? 1 : 0,
        jejak?.catatan ?? null,
        jejak?.diisiOleh ?? null,
      ])
    }
  }

  for (const batch of potong(baris, BATCH_RINCIAN)) {
    await eksekusi(
      `INSERT INTO match_score_detail
         (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator,
          nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review, catatan, diisi_oleh)
       VALUES ${batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      batch.flat(),
    )
  }

  return baris.length
}

/**
 * Peringkat ulang SELURUH anggota talent pool satu jabatan target.
 *
 * Bukan hanya yang skornya berubah: anggota yang skornya turun tetap harus
 * bergeser, dan memperbarui sebagian menghasilkan dua orang di peringkat yang
 * sama tanpa ada yang menyadarinya (cacat yang pernah nyata terjadi di Fase 0.5).
 */
async function peringkatUlangPool(jabatanTargetId: number): Promise<number> {
  const anggota = await kueri<Record<string, unknown>>(
    `SELECT tp.pegawai_id, m.skor_total, a.nilai_kinerja_y
     FROM talent_pool tp
     LEFT JOIN match_score m ON m.pegawai_id = tp.pegawai_id
                            AND m.jabatan_target_id = tp.jabatan_target_id
     LEFT JOIN (
       SELECT pegawai_id, nilai_kinerja_y FROM (
         SELECT pegawai_id, nilai_kinerja_y,
                ROW_NUMBER() OVER (PARTITION BY pegawai_id ORDER BY tahun_asesmen DESC, id DESC) AS rn
         FROM asesmen_talenta
       ) x WHERE x.rn = 1
     ) a ON a.pegawai_id = tp.pegawai_id
     WHERE tp.jabatan_target_id = ?`,
    [jabatanTargetId],
  )
  if (anggota.length === 0) return 0

  const berperingkat = hitungRanking(
    anggota.map((r) => ({
      pegawaiId: Number(r.pegawai_id),
      skorTotal: Number(r.skor_total ?? 0),
      nilaiKinerjaY: r.nilai_kinerja_y === null ? null : Number(r.nilai_kinerja_y),
    })),
  )

  for (const k of berperingkat) {
    await eksekusi(
      `UPDATE talent_pool SET ranking = ?, match_score_id = (
         SELECT m.id FROM match_score m
         WHERE m.pegawai_id = ? AND m.jabatan_target_id = ?
       ) WHERE pegawai_id = ? AND jabatan_target_id = ?`,
      [k.ranking, k.pegawaiId, jabatanTargetId, k.pegawaiId, jabatanTargetId],
    )
  }

  return berperingkat.length
}
