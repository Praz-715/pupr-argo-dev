'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { getCurrentUser } from '../auth'
import { jalankanMutasi } from '../audit'
import { eksekusi, kueri, kueriSatu } from '../db'
import {
  ambilJejakManual,
  ambilNilaiManual,
  ambilProfilKandidat,
  ambilRubrikUntukHitung,
} from '../kueri/rubrik'
import { ambilPengaturan } from '../pengaturan'
import { validasiRubrik } from '../scoring'
import { hitungSkorMassal } from '../skor-massal'
import { tulisHasilSkor } from '../skoring-tulis'
import { gerbangPeran } from './gerbang'
import { berhasil, gagal, galatDariZod, type HasilAksi } from './hasil'

/**
 * Hitung ulang match score satu jabatan target, dan isi nilai manual per
 * indikator.
 *
 * Yang membuat aksi ini berbeda dari mutasi lain di `lib/aksi/*`: ia menulis
 * ratusan sampai puluhan ribu baris. Karena itu tiga hal dijaga eksplisit:
 *
 *   1. **Nilai manual dibaca lebih dulu dan dipasang ulang.** Recompute yang
 *      menimpa `match_score_detail` apa adanya akan menghapus nilai yang diisi
 *      manusia untuk indikator yang belum punya sumber data — pekerjaan orang
 *      hilang tanpa pesan (U-3).
 *   2. **Baris skor diperbarui, bukan dihapus lalu dibuat ulang.**
 *      `talent_pool.match_score_id` menunjuk ke baris ini; menghapusnya membuat
 *      tautan pool jadi NULL walau isinya tidak berubah. Kunci unik
 *      `uk_match_score_pegawai_target` (doc/sql/010) yang membuat upsert ini bisa
 *      diandalkan.
 *   3. **Ranking talent pool ikut dihitung ulang untuk SELURUH anggota pool.**
 *      Memperbarui hanya sebagian menghasilkan nomor peringkat ganda — cacat
 *      yang pernah nyata terjadi di Fase 0.5 (phase.md catatan Fase 0.5 no. 3).
 */

const PERAN_HITUNG = ['Super Admin', 'Admin Talenta'] as const
const idPositif = z.number().int().positive()

export interface RingkasHitungUlang {
  jabatanTargetId: number
  jumlahPegawai: number
  jumlahEligible: number
  jumlahPerluReview: number
  jumlahBarisRincian: number
  jumlahNilaiManualDipertahankan: number
  jumlahAnggotaPoolDiperingkat: number
  durasiMs: number
}

export async function hitungUlangSkor(
  jabatanTargetId: unknown,
): Promise<HasilAksi<RingkasHitungUlang>> {
  const tolak = await gerbangPeran(PERAN_HITUNG)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')

  const mulai = Date.now()
  const siap = await ambilRubrikUntukHitung(idTarget.data)
  if (siap === null) return gagal('Jabatan target itu tidak ada.')
  if (siap.rubrik.komponen.length === 0) {
    return gagal(
      'Jabatan target ini belum punya rubrik, jadi tidak ada yang bisa dihitung. Susun rubriknya lebih dulu di tab Rubrik Penilaian.',
    )
  }

  // Rubrik bercacat TIDAK memblokir perhitungan — draft memang perlu dihitung
  // untuk melihat dampaknya. Tapi jumlah galatnya dilaporkan bersama hasilnya,
  // supaya angka yang keluar tidak dianggap final.
  const validasi = validasiRubrik(siap.komponen, { untukJabatanTarget: true })

  const [profil, nilaiManual, jejakManual, pengaturan] = await Promise.all([
    ambilProfilKandidat(),
    ambilNilaiManual(idTarget.data),
    ambilJejakManual(idTarget.data),
    ambilPengaturan(),
  ])

  if (profil.length === 0) {
    return gagal('Tidak ada pegawai aktif untuk dinilai.')
  }

  // Masa berlaku asesmen datang dari Pengaturan Sistem (Fase 7), bukan lagi
  // konstanta di kode — PRD §10.11 memang menyebutnya parameter sistem.
  // `lib/scoring` tetap bebas DB: nilainya diteruskan sebagai argumen.
  const hasil = hitungSkorMassal(siap.rubrik, profil, {
    nilaiManual,
    masaBerlakuTahun: pengaturan.masaBerlakuAsesmenTahun,
  })
  const snapshot = JSON.stringify(hasil.snapshotRubrik)

  let jumlahBarisRincian = 0
  let jumlahAnggotaPool = 0

  await jalankanMutasi({
    entitas: 'match_score',
    aksi: 'RECOMPUTE',
    peranDiizinkan: PERAN_HITUNG,
    sebelum: () =>
      kueriSatu(
        `SELECT COUNT(*) AS jumlah_baris, MAX(computed_at) AS terakhir,
                SUM(eligible) AS eligible
         FROM match_score WHERE jabatan_target_id = ?`,
        [idTarget.data],
      ),
    jalankan: async () => {
      const ringkasTulis = await tulisHasilSkor(idTarget.data, hasil.hasil, snapshot, jejakManual)
      jumlahBarisRincian = ringkasTulis.jumlahRincian
      jumlahAnggotaPool = ringkasTulis.jumlahAnggotaPool
      return {
        entitasId: idTarget.data,
        sesudah: {
          jumlahBaris: hasil.hasil.length,
          eligible: hasil.jumlahEligible,
          galatRubrik: validasi.jumlahGalat,
        },
      }
    },
  })

  revalidatePath(`/jabatan-target/${idTarget.data}`)
  revalidatePath(`/jabatan-target/${idTarget.data}/kandidat`)
  revalidatePath(`/jabatan-target/${idTarget.data}/simulasi`)
  revalidatePath('/jabatan-target')
  revalidatePath('/talenta')
  revalidatePath('/')

  const ringkas: RingkasHitungUlang = {
    jabatanTargetId: idTarget.data,
    jumlahPegawai: hasil.hasil.length,
    jumlahEligible: hasil.jumlahEligible,
    jumlahPerluReview: hasil.jumlahPerluReview,
    jumlahBarisRincian,
    jumlahNilaiManualDipertahankan: jejakManual.length,
    jumlahAnggotaPoolDiperingkat: jumlahAnggotaPool,
    durasiMs: Date.now() - mulai,
  }

  const catatanGalat =
    validasi.jumlahGalat > 0
      ? ` Perhatian: rubriknya masih punya ${validasi.jumlahGalat} galat, jadi angka ini belum layak dipakai mengambil keputusan.`
      : ''

  return berhasil(
    ringkas,
    `${ringkas.jumlahPegawai} pegawai dinilai · ${ringkas.jumlahEligible} lolos syarat · ` +
      `${ringkas.jumlahBarisRincian} baris rincian.${catatanGalat}`,
  )
}

// ---------------------------------------------------------------------------
// Nilai manual per indikator (U-3)
// ---------------------------------------------------------------------------

const SkemaNilaiManual = z.object({
  nilaiMentah: z
    .string()
    .trim()
    .min(1, 'Nilai tidak boleh kosong')
    .max(255, 'Nilai maksimal 255 karakter'),
  catatan: z
    .string()
    .trim()
    .min(5, 'Catatan wajib diisi — dasar penilaiannya harus bisa ditelusuri')
    .max(1000, 'Catatan maksimal 1.000 karakter'),
})

export type MasukanNilaiManual = z.infer<typeof SkemaNilaiManual>

/**
 * Isi nilai satu indikator secara manual untuk satu pegawai.
 *
 * **Catatan wajib.** Indikator yang diisi manusia adalah tempat penilaian jadi
 * subjektif; tanpa alasan tertulis, angkanya tidak bisa dipertanggungjawabkan —
 * dan §9 no. 6 phase.md memang menuntut jejak siapa yang mengisi.
 *
 * Skornya sendiri **tidak** dihitung di sini: nilai mentah disimpan, lalu
 * perhitungan ulang yang menerjemahkannya lewat rubrik. Menghitung skornya di
 * sini berarti dua tempat menerjemahkan nilai mentah → skor.
 */
export async function simpanNilaiManual(
  jabatanTargetId: unknown,
  pegawaiId: unknown,
  rubrikIndikatorId: unknown,
  masukan: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_HITUNG)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  const idPegawai = idPositif.safeParse(pegawaiId)
  const idIndikator = idPositif.safeParse(rubrikIndikatorId)
  if (!idTarget.success || !idPegawai.success || !idIndikator.success) {
    return gagal('Permintaan tidak dikenali.')
  }

  const urai = SkemaNilaiManual.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const pengguna = await getCurrentUser()

  const konteks = await kueriSatu<{
    match_score_id: number
    nama_indikator: string
    mode_skor: string
    punya_kategori: number
  }>(
    `SELECT m.id AS match_score_id, i.nama_indikator, i.mode_skor,
            (SELECT COUNT(*) FROM rubrik_kategori_skor s WHERE s.rubrik_indikator_id = i.id) AS punya_kategori
     FROM match_score m
     JOIN rubrik_indikator i ON i.id = ?
     JOIN rubrik_komponen k ON k.id = i.rubrik_komponen_id
     WHERE m.jabatan_target_id = ? AND m.pegawai_id = ? AND k.jabatan_target_id = ?`,
    [idIndikator.data, idTarget.data, idPegawai.data, idTarget.data],
  )
  if (konteks === null) {
    return gagal(
      'Belum ada baris skor untuk pegawai ini pada jabatan target ini. Jalankan Hitung Ulang lebih dulu.',
    )
  }

  // Nilai harus bisa dicocokkan rubrik. Kalau tidak, mesin akan memakai
  // "kategori terdekat di bawah" dan menandainya perlu ditinjau — yaitu nilai
  // manual yang justru menambah temuan, bukan menyelesaikannya.
  const galatBentuk = await periksaBentukNilai(idIndikator.data, konteks.mode_skor, d.nilaiMentah)
  if (galatBentuk !== null) return gagal(galatBentuk, { nilaiMentah: galatBentuk })

  await jalankanMutasi({
    entitas: 'match_score_detail',
    aksi: 'UBAH',
    peranDiizinkan: PERAN_HITUNG,
    sebelum: () =>
      kueriSatu(
        `SELECT nilai_mentah, kategori_terpilih, skor, sumber_nilai, catatan, diisi_oleh
         FROM match_score_detail WHERE match_score_id = ? AND rubrik_indikator_id = ?`,
        [konteks.match_score_id, idIndikator.data],
      ),
    jalankan: async () => {
      await eksekusi(
        `UPDATE match_score_detail
         SET nilai_mentah = ?, sumber_nilai = 'MANUAL', catatan = ?, diisi_oleh = ?
         WHERE match_score_id = ? AND rubrik_indikator_id = ?`,
        [
          d.nilaiMentah,
          d.catatan,
          pengguna?.id ?? null,
          konteks.match_score_id,
          idIndikator.data,
        ],
      )
      return {
        entitasId: konteks.match_score_id,
        sesudah: {
          rubrikIndikatorId: idIndikator.data,
          nilaiMentah: d.nilaiMentah,
          sumberNilai: 'MANUAL',
        },
      }
    },
  })

  /**
   * Langsung hitung ulang, supaya skornya keluar seketika.
   *
   * Sebelumnya aksi ini berhenti setelah menyimpan nilai mentah dan menyuruh
   * pengguna menjalankan Hitung Ulang sendiri. Yang terjadi di layar: nilai
   * mentahnya muncul, `kategori_terpilih` tetap kosong, dan **skornya tetap
   * 0,00** — terbaca sebagai simpan yang gagal separuh, bukan sebagai dua langkah
   * yang memang terpisah.
   *
   * **Yang dihitung ulang adalah SELURUH jabatan target, bukan satu pegawai, dan
   * itu bukan kemalasan.** Peringkat di talent pool ditentukan dengan
   * membandingkan skor seluruh kandidat; memperbarui satu baris saja akan
   * meninggalkan `talent_pool.ranking` yang basi tanpa satu pun galat — dan
   * peringkat yang salah justru lebih berbahaya daripada skor yang belum
   * diperbarui, karena ia terlihat wajar. Biayanya terukur: ~195 ms di dev,
   * 2,5–4,4 detik pada 1.960 pegawai (`ukur:hitung-ulang`).
   *
   * Kalau perhitungannya gagal, nilai mentahnya TETAP tersimpan — dan pesannya
   * mengatakan apa adanya alih-alih membiarkan orang menyangka simpanannya batal.
   */
  const ulang = await hitungUlangSkor(idTarget.data)

  const sesudah = await kueriSatu<{ skor: string; kategori: string | null }>(
    `SELECT d.skor, d.kategori_terpilih AS kategori
       FROM match_score_detail d
      WHERE d.match_score_id = ? AND d.rubrik_indikator_id = ?`,
    [konteks.match_score_id, idIndikator.data],
  )

  revalidatePath(`/jabatan-target/${idTarget.data}/kandidat`)
  // Profil pegawai menampilkan rincian indikator yang baru berubah. Tanpa ini,
  // tabelnya tetap memperlihatkan skor lama sampai halamannya dimuat ulang —
  // gejala yang persis sama dengan "skornya tidak keluar".
  const pegawai = await kueriSatu<{ nip: string }>(`SELECT nip FROM pegawai WHERE id = ?`, [
    idPegawai.data,
  ])
  if (pegawai) revalidatePath(`/talenta/${pegawai.nip}`)

  if (!ulang.ok) {
    return berhasil(
      undefined,
      `Nilai manual untuk "${konteks.nama_indikator}" tersimpan, tapi perhitungan ulangnya gagal: ${ulang.pesan} Jalankan Hitung Ulang dari halaman jabatan target.`,
    )
  }

  const skorBaru = sesudah === null ? null : Number(sesudah.skor)
  return berhasil(
    undefined,
    skorBaru === null
      ? `Nilai manual untuk "${konteks.nama_indikator}" disimpan & dihitung ulang.`
      : `"${konteks.nama_indikator}" → skor ${skorBaru.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` +
          `${sesudah?.kategori ? ` (${sesudah.kategori})` : ''}. Skor total & peringkat pool ikut diperbarui.`,
  )
}

/** Apakah nilai mentah ini bisa dicocokkan ke rubrik indikatornya? */
async function periksaBentukNilai(
  rubrikIndikatorId: number,
  modeSkor: string,
  nilai: string,
): Promise<string | null> {
  const angka = Number(nilai)
  const berupaAngka = nilai.trim() !== '' && !Number.isNaN(angka)

  if (modeSkor === 'NILAI_LANGSUNG') {
    if (!berupaAngka) return 'Indikator bermode nilai langsung, jadi isinya harus berupa angka.'
    if (angka < 0 || angka > 100) return 'Nilai harus berada di rentang 0–100.'
    return null
  }

  const kategori = await kueri<{ nama_kategori: string; ambang_min: string | null }>(
    `SELECT nama_kategori, ambang_min FROM rubrik_kategori_skor
     WHERE rubrik_indikator_id = ? ORDER BY urutan, id`,
    [rubrikIndikatorId],
  )
  if (kategori.length === 0) {
    return 'Indikator ini belum punya kategori skor, jadi nilai apa pun akan bernilai 0. Tambahkan kategorinya lebih dulu.'
  }

  const berambang = kategori.some((k) => k.ambang_min !== null)
  if (berambang) {
    if (!berupaAngka) {
      return 'Kategori indikator ini memakai ambang angka, jadi isinya harus berupa angka.'
    }
    return null
  }

  const samakan = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase()
  const cocok = kategori.some((k) => samakan(k.nama_kategori) === samakan(nilai))
  if (!cocok) {
    const daftar = kategori.map((k) => `"${k.nama_kategori}"`).join(' · ')
    return `Nilai harus sama dengan salah satu nama kategori: ${daftar}`
  }
  return null
}
