import 'server-only'

import { getCurrentUser } from '../auth'
import { kueriSatu } from '../db'
import { lingkupData, tanpaAkses, unitWajib } from '../lingkup'

/**
 * Penjaga lingkup unit untuk jalur TULIS — satu definisi, dipakai beberapa berkas
 * `lib/aksi/`.
 *
 * ## Kenapa berkas sendiri
 *
 * Keduanya semula privat di `lib/aksi/profil.ts`. Begitu `jabatan-target.ts` dan
 * `suksesi.ts` juga perlu membatasi Pengelola Unit (24 Agu 2026), pilihannya
 * menyalin atau mengangkat. Menyalin adalah cara paling rapi membuat tiga jalur
 * tulis punya definisi "unit saya" yang berbeda — dan bentuk kegagalannya bukan
 * galat melainkan satu jalur yang membiarkan unit lain lewat.
 *
 * ## Ditegakkan DI DALAM SQL, bukan di JavaScript
 *
 * Barisnya tidak pernah terambil kalau di luar lingkup, jadi ia tidak bisa bocor
 * lewat log, pesan galat, atau prop komponen. Alasan yang sama dengan `unitWajib`
 * di `lib/kueri`.
 *
 * ## `null` berarti DUA hal sekaligus, dan itu disengaja
 *
 * "Tidak ada" dan "di luar lingkup Anda" dijawab sama. Membedakannya membuat
 * jawaban aksi jadi cara menebak isi unit lain — pola yang sama dengan
 * `/talenta/{nip}` di Fase 7 dan rute foto pegawai.
 */

/** Subkueri unit + seluruh turunannya. Rekursif: kedalaman berapa pun ikut. */
const TURUNAN = `
  WITH RECURSIVE turunan (id) AS (
    SELECT id FROM unit_organisasi WHERE id = ?
    UNION ALL
    SELECT u.id FROM unit_organisasi u JOIN turunan t ON u.parent_id = t.id
  )
  SELECT id FROM turunan`

/** Pegawainya ada DAN terjangkau lingkup unit pengguna. */
export async function pegawaiTerjangkau(
  pegawaiId: number,
): Promise<{ id: number; nip: string; nama: string } | null> {
  const lingkup = lingkupData(await getCurrentUser())
  if (tanpaAkses(lingkup)) return null
  const unit = unitWajib(lingkup)
  const batas = unit === null ? '' : ` AND j.unit_organisasi_id IN (${TURUNAN})`
  return kueriSatu<{ id: number; nip: string; nama: string }>(
    `SELECT p.id, p.nip, p.nama_lengkap AS nama
       FROM pegawai p
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
      WHERE p.id = ?${batas}`,
    unit === null ? [pegawaiId] : [pegawaiId, unit],
  )
}

/** Jabatannya ada DAN berada di dalam lingkup unit pengguna. */
export async function jabatanTerjangkau(jabatanId: number): Promise<{ id: number } | null> {
  const lingkup = lingkupData(await getCurrentUser())
  if (tanpaAkses(lingkup)) return null
  const batas = unitWajib(lingkup)
  if (batas === null || batas === undefined) {
    return kueriSatu<{ id: number }>('SELECT id FROM jabatan WHERE id = ?', [jabatanId])
  }
  return kueriSatu<{ id: number }>(
    `SELECT j.id FROM jabatan j
      WHERE j.id = ? AND j.unit_organisasi_id IN (${TURUNAN})`,
    [jabatanId, batas],
  )
}

/**
 * Jabatan target terjangkau kalau **salah satu jabatan anggotanya** ada di dalam
 * lingkup unit pengguna.
 *
 * "Salah satu", bukan "semuanya": satu jabatan target bisa mewakili kursi yang
 * sama di beberapa balai (mis. target generik BP2JK memuat 6 jabatan di 6 unit).
 * Menuntut SELURUH anggotanya di dalam lingkup berarti Pengelola Unit tidak bisa
 * menyentuh target yang justru memuat kursinya sendiri.
 *
 * Target **tanpa anggota** dijawab `null` untuk pengguna berlingkup — tidak ada
 * dasar menyatakan ia milik unit mana pun, dan menebaknya berarti membiarkan
 * seorang Pengelola Unit menyunting target yang bukan urusannya.
 */
export async function targetTerjangkau(idTarget: number): Promise<{ id: number } | null> {
  const lingkup = lingkupData(await getCurrentUser())
  if (tanpaAkses(lingkup)) return null
  const batas = unitWajib(lingkup)
  if (batas === null || batas === undefined) {
    return kueriSatu<{ id: number }>('SELECT id FROM jabatan_target WHERE id = ?', [idTarget])
  }
  return kueriSatu<{ id: number }>(
    `SELECT jt.id FROM jabatan_target jt
      WHERE jt.id = ?
        /*
          Lingkupnya diukur dari KURSI yang dituju (kolom jt.jabatan_id, doc/sql/032),
          bukan dari daftar jabatan asal kandidat.

          Lewat tabel anggota — yang sejak 1 Sep 2026 berisi jabatan asal yang
          tersebar se-Indonesia — seorang Pengelola Unit akan bisa menyunting setiap
          jabatan target yang KEBETULAN menerima kandidat dari unitnya, termasuk
          kursi di direktorat lain. Itu pelebaran akses yang tidak menghasilkan galat
          apa pun; ia hanya membuat gerbangnya berhenti menjaga.
        */
        AND EXISTS (
          SELECT 1 FROM jabatan j
           WHERE j.id = jt.jabatan_id
             AND j.unit_organisasi_id IN (${TURUNAN})
        )`,
    [idTarget, batas],
  )
}
