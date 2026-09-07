import 'server-only'

import { kueri } from './db'
import {
  ambilJejakManual,
  ambilNilaiManual,
  ambilProfilKandidat,
  ambilRubrikUntukHitung,
} from './kueri/rubrik'
import { ambilPengaturan } from './pengaturan'
import { hitungSkorMassal } from './skor-massal'
import { tulisHasilSkor } from './skoring-tulis'

/**
 * Hitung ulang skor **satu pegawai** pada seluruh jabatan target AKTIF.
 *
 * ## Kenapa ada
 *
 * Permintaan pemilik proses 25 Agu 2026: *"kalo gw ubah lagi hukuman disiplinnya gak
 * langsung berubah di kecocokannya"* — skor harus bergerak seketika, tanpa menekan
 * Hitung Ulang di tiap jabatan target.
 *
 * `match_score` kolom TERSIMPAN, jadi satu-satunya cara memenuhinya adalah
 * menghitung ulang di dalam permintaan yang sama. Menghitung ulang SELURUH populasi
 * di situ tidak mungkin — terukur 1–5 detik per jabatan target × 8 target aktif.
 * Tapi yang berubah hanya data satu orang, jadi yang perlu dihitung ulang juga hanya
 * baris orang itu.
 *
 * ## Kenapa ini aman dilakukan sebagian
 *
 * Dua hal yang diperiksa lebih dulu di `lib/skoring-tulis.ts`, bukan diasumsikan:
 *
 *   - `upsertSkor()` **meng-upsert** (kunci unik `(pegawai_id, jabatan_target_id)`),
 *     jadi baris pegawai lain tidak tersentuh;
 *   - `tulisRincian()` menghapus `match_score_detail` **hanya** untuk
 *     `match_score_id` yang ikut dikirim — bukan untuk seluruh jabatan targetnya.
 *
 * Kalau salah satu dari dua sifat itu berubah, fungsi ini akan menghapus rincian
 * orang lain tanpa satu pun galat. Itu sebabnya keduanya ditulis di sini.
 *
 * ## Peringkat pool IKUT diperbarui, dan itu memang perlu
 *
 * `tulisHasilSkor()` memanggil `peringkatUlangPool()` per jabatan target — skor satu
 * orang berubah berarti urutan pool bisa berubah, dan peringkat yang tidak ikut
 * diperbarui adalah peringkat yang salah tanpa ada yang menyadarinya (cacat yang
 * pernah nyata terjadi di Fase 0.5).
 *
 * ## Cakupannya: setiap jabatan target yang SUDAH punya baris skor
 *
 * Versi pertama fungsi ini hanya menyentuh yang AKTIF — dengan alasan biaya, sebab
 * draft & nonaktif memang tidak dipakai memutuskan. Itu **keliru, dan penjaga yang
 * menangkapnya `npm run verifikasi:skoring`**: ia membandingkan SELURUH isi
 * `match_score`, jadi baris non-aktif yang tidak ikut disegarkan langsung menyimpang
 * — terukur tepat 11,25 poin (efek hukuman Berat) pada tiga jabatan target, dan
 * penjaganya merah atas keadaan yang bukan cacat kode. Penjaga yang merah karena
 * hal yang wajar akan berhenti dibaca.
 *
 * Biayanya juga tidak sebesar yang saya kira: **~100 ms per jabatan target**, jadi 12
 * target ≈ 1,2 detik — masih di dalam satu penyimpanan yang ditunggu pengguna.
 *
 * Yang TIDAK dihitung: target tanpa rubrik (tidak ada yang bisa dihitung) dan target
 * yang belum pernah punya baris skor sama sekali (tidak ada yang bisa menyimpang).
 *
 * Ia juga tidak mencatat jejak `RECOMPUTE` sendiri: pemanggilnya adalah aksi yang
 * sudah melewati `jalankanMutasi()` atas perubahan yang MEMICUNYA (mis. catatan
 * disiplin), jadi jejaknya sudah ada dan menambah satu lagi hanya menggandakan
 * peristiwa yang sama.
 */
export interface RingkasHitungSatu {
  jumlahTarget: number
  jumlahBaris: number
  durasiMs: number
}

export async function hitungUlangSatuPegawai(pegawaiId: number): Promise<RingkasHitungSatu> {
  const mulai = Date.now()

  const target = await kueri<{ id: number }>(
    `SELECT t.id FROM jabatan_target t
      WHERE (SELECT COUNT(*) FROM rubrik_komponen k WHERE k.jabatan_target_id = t.id) > 0
        AND (SELECT COUNT(*) FROM match_score m WHERE m.jabatan_target_id = t.id) > 0
      ORDER BY (t.status = 'AKTIF') DESC, t.id`,
  )
  if (target.length === 0) return { jumlahTarget: 0, jumlahBaris: 0, durasiMs: Date.now() - mulai }

  const [profil, pengaturan] = await Promise.all([
    ambilProfilKandidat(pegawaiId),
    ambilPengaturan(),
  ])
  // Pegawai tidak aktif / tidak ada: tidak ada yang bisa dihitung, dan itu bukan
  // galat — mis. catatan disiplin milik pegawai yang statusnya baru diubah.
  if (profil.length === 0) return { jumlahTarget: 0, jumlahBaris: 0, durasiMs: Date.now() - mulai }

  let jumlahBaris = 0
  for (const t of target) {
    const siap = await ambilRubrikUntukHitung(t.id)
    if (siap === null || siap.rubrik.komponen.length === 0) continue

    /*
      Nilai manual & jejaknya diambil per jabatan target lalu DISARING ke pegawai
      ini. Kalau jejak orang lain ikut dikirim, `tulisRincian()` akan menandai
      baris yang tidak ia tulis sebagai MANUAL — sumber nilai yang berbohong, dan
      itu kolom yang dipakai membedakan angka mesin dari angka manusia.
    */
    const [nilaiManual, jejakManual] = await Promise.all([
      ambilNilaiManual(t.id),
      ambilJejakManual(t.id),
    ])
    // `nilaiManual` berbentuk peta berkunci pegawai, jadi disaring dengan memilih
    // satu kuncinya — bukan `.filter()`. Peta kosong tetap dikirim (bukan
    // `undefined`) supaya jalurnya sama dengan Hitung Ulang penuh.
    const manualPegawai = nilaiManual[pegawaiId]
    const hasil = hitungSkorMassal(siap.rubrik, profil, {
      nilaiManual: manualPegawai === undefined ? {} : { [pegawaiId]: manualPegawai },
      masaBerlakuTahun: pengaturan.masaBerlakuAsesmenTahun,
    })
    await tulisHasilSkor(
      t.id,
      hasil.hasil,
      JSON.stringify(hasil.snapshotRubrik),
      jejakManual.filter((j) => j.pegawaiId === pegawaiId),
    )
    jumlahBaris += hasil.hasil.length
  }

  return { jumlahTarget: target.length, jumlahBaris, durasiMs: Date.now() - mulai }
}
