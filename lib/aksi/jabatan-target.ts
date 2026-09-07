'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { jalankanMutasi } from '../audit'
import { eksekusi, kueri, kueriSatu } from '../db'
import { halanganAktivasi } from '../aktivasi-target'
import { SEMUA_JENIS_SYARAT } from '../scoring/eligibility'
import { rumpunSatuTingkatDiBawah } from '../kueri/rumpun'
import { ambilPohonRubrik, cariJabatanUntukTargetBaru, type JabatanAnggota } from '../kueri/rubrik'
import { beritahuTargetAktif, beritahuUsulanTarget } from '../notifikasi'
import { getCurrentUser } from '../auth'
import { bakukanGolongan } from '../golongan'
import { lingkupData, tanpaAkses, unitWajib } from '../lingkup'
import { PERAN_KELOLA_TARGET, PERAN_USUL_TARGET } from '../peran'
import { salinPohonRubrik } from '../rubrik-salin'
import { gerbangPeran } from './gerbang'
import { jabatanTerjangkau, targetTerjangkau } from './lingkup-data'
import { berhasil, gagal, galatDariZod, pesanDariGalatDb, type HasilAksi } from './hasil'

/**
 * Mutasi Jabatan Target (PRD §6.5). Admin Talenta & Super Admin.
 *
 * Aturan yang ditegakkan di sini, bukan di form:
 *   - **Aktivasi menuntut rubrik yang lolos validasi.** Rubrik aktif dipakai
 *     menilai orang; mengaktifkan rubrik bercacat berarti menghasilkan peringkat
 *     yang salah tanpa ada tanda apa pun di angkanya (`lib/scoring/validasi.ts`).
 *   - **Jabatan target yang skornya sudah dipakai talent pool tidak dihapus,
 *     tapi dinonaktifkan** — sama seperti perlakuan jabatan & catatan disiplin di
 *     Fase 4. Menghapusnya akan meruntuhkan nominasi & approval yang menunjuk ke
 *     entri pool-nya lewat `ON DELETE CASCADE`.
 */

/*
  Daftar perannya ada di `lib/peran.ts` (`PERAN_KELOLA_TARGET` &
  `PERAN_USUL_TARGET`) supaya halaman yang menggambar tombolnya memakai daftar yang
  SAMA, bukan salinan. Ringkasnya: unit mengusulkan (draft + persyaratan), Admin
  Talenta memutuskan (rubrik + aktivasi). Alasan lengkapnya di modul itu.
*/

const SkemaTarget = z.object({
  kodeTarget: z
    .string()
    .trim()
    .min(3, 'Kode target minimal 3 karakter')
    .max(40, 'Kode target maksimal 40 karakter')
    .regex(/^[A-Za-z0-9._/-]+$/, 'Kode target hanya boleh huruf, angka, titik, garis, dan garis miring'),
  namaTarget: z
    .string()
    .trim()
    .min(5, 'Nama jabatan target minimal 5 karakter')
    .max(250, 'Nama jabatan target maksimal 250 karakter'),
  deskripsi: z.string().trim().max(2000, 'Deskripsi maksimal 2.000 karakter').nullable(),
})

export type MasukanTarget = z.infer<typeof SkemaTarget>

const idPositif = z.number().int().positive()

async function bacaTarget(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, kode_target, nama_target, deskripsi, status, kata_kunci_relevansi
     FROM jabatan_target WHERE id = ?`,
    [id],
  )
}

function segarkan(id?: number): void {
  revalidatePath('/jabatan-target')
  if (id !== undefined) {
    revalidatePath(`/jabatan-target/${id}`)
    revalidatePath(`/jabatan-target/${id}/kandidat`)
    revalidatePath(`/jabatan-target/${id}/simulasi`)
  }
}

/*
  `buatJabatanTarget()` — pembuatan bebas-teks (kode & nama diketik) — DICABUT
  25 Agu 2026 atas permintaan pemilik proses: *"jabatan target itu kalo mau nambah
  jangan freetext tapi ambil dari master jabatan unit organisasi aja"*.

  Dicabut, bukan disembunyikan dari UI. Server action yang tidak dipakai halaman
  mana pun tetap dapat dipanggil, dan yang tersisa akan menjadi satu-satunya jalan
  membuat jabatan target yang namanya tidak sama dengan master serta tidak menunjuk
  kursi apa pun — persis tiga akibat yang pencabutan ini hendak menutup (lihat
  `app/(app)/jabatan-target/_komponen/pemilih-jabatan-target.tsx`).

  Satu-satunya jalan membuat sekarang: `buatTargetDariJabatan()` di bawah, yang
  menurunkan kode & nama dari master DAN menautkan jabatan anggotanya dalam mutasi
  yang sama. Menyunting nama/deskripsi target yang SUDAH ada tetap ada
  (`ubahJabatanTarget()`) — itu bukan penambahan.
*/

/**
 * Buat jabatan target DRAFT dari sebuah jabatan kosong (Fase 11 no. 2, U-14).
 *
 * Lahir dari lubang yang baru terlihat setelah Peta Talenta bisa disaring per
 * jabatan target: `pupr_dev` punya **6 jabatan KOSONG tapi hanya 2** yang jadi
 * anggota sebuah target, sehingga empat sisanya tidak bisa dinilai sama sekali —
 * dan tidak ada satu tempat pun yang menyatakan itu sebagai pekerjaan.
 *
 * Tidak menambah kolom apa pun: hasilnya satu baris `jabatan_target` berstatus
 * DRAFT + satu `jabatan_target_anggota`. Relasi "target ini lahir dari jabatan
 * itu" sudah terwakili oleh keanggotaannya, jadi kolom asal-usul akan jadi
 * definisi kedua yang bisa berselisih.
 *
 * Kode & nama diturunkan dari jabatannya, bukan diminta ke pengguna: satu klik
 * dari daftar kekosongan gunanya justru menghilangkan langkah mengisi form.
 * Keduanya tetap bisa disunting sesudahnya dari Editor Jabatan Target — DRAFT
 * memang untuk itu.
 */
/**
 * Cari master jabatan untuk pemilih "Buat jabatan target".
 *
 * ## Kenapa pencariannya server action, bukan `?cari=` di URL
 *
 * Pemilihnya hidup di dalam dialog. Menggeser pencarian ke URL berarti dialognya
 * juga harus dikendalikan URL supaya tidak tertutup tiap kali daftarnya disaring —
 * dua keadaan yang harus dijaga sinkron demi satu kotak pencarian. Tab Jabatan
 * Anggota memang memakai `?cariJabatan=`, dan itu tetap benar di sana: ia bagian
 * halaman, bukan dialog.
 *
 * Ia BACAAN, tapi tetap bergerbang peran: daftar master jabatan lengkap beserta
 * jumlah penghuninya bukan sesuatu yang perlu dijawab ke sembarang sesi. Gerbangnya
 * sama dengan yang membuat targetnya (`PERAN_USUL_TARGET`) — kalau seseorang tidak
 * boleh membuat, tidak ada gunanya ia mencari.
 *
 * Lingkup unit ditegakkan di dalam SQL, bukan dengan menyembunyikan tombol: hasil
 * yang tidak tersaring akan menawarkan kursi yang `jabatanTerjangkau()` pasti tolak.
 */
export async function cariJabatanMaster(cari: unknown): Promise<HasilAksi<JabatanAnggota[]>> {
  const tolak = await gerbangPeran(PERAN_USUL_TARGET)
  if (tolak) return tolak

  const teks = typeof cari === 'string' ? cari : ''
  const lingkup = lingkupData(await getCurrentUser())
  // Gagal TERTUTUP: Pengelola Unit tanpa unit tidak mendapat daftar apa pun,
  // bukan daftar seluruh organisasi.
  if (tanpaAkses(lingkup)) return berhasil([])
  return berhasil(await cariJabatanUntukTargetBaru(teks, unitWajib(lingkup)))
}

export async function buatTargetDariJabatan(
  jabatanId: unknown,
): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_USUL_TARGET)
  if (tolak) return tolak

  const idJabatan = idPositif.safeParse(jabatanId)
  if (!idJabatan.success) return gagal('Pilihan jabatan tidak dikenali.')

  const jabatan = await kueriSatu<{
    kode_jabatan: string
    nama_jabatan: string
    eselon: string | null
    status_jabatan: string
    nama_unit: string | null
    nama_target_ada: string | null
  }>(
    `SELECT j.kode_jabatan, j.nama_jabatan, j.eselon, j.status_jabatan, u.nama_unit,
            /*
              "Kursi ini sudah punya jabatan target atau belum" — dibaca dari kolom
              jabatan_target.jabatan_id sejak doc/sql/032. Lewat tabel anggota,
              jawabannya jadi "kursi ini termasuk jabatan ASAL sebuah target", hal
              yang sama sekali berbeda: setiap Kepala Seksi akan dinyatakan sudah
              jadi jabatan target dan pembuatan draft barunya ditolak.

              (Tanpa backtick — ini di dalam template literal; satu backtick di
              komentar SQL mengakhiri stringnya dan galatnya muncul belasan baris
              dari penyebabnya. Tercatat di CLAUDE.md, dan tetap kena.)
            */
            (SELECT t.nama_target FROM jabatan_target t
              WHERE t.jabatan_id = j.id LIMIT 1) AS nama_target_ada
       FROM jabatan j
       LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
      WHERE j.id = ?`,
    [idJabatan.data],
  )
  if (jabatan === null) return gagal('Jabatan itu tidak ada. Muat ulang halaman lalu coba lagi.')
  /*
    Pengelola Unit hanya boleh mengusulkan kursi DI UNITNYA.

    Tanpa ini ia bisa membuat draft untuk jabatan unit lain — dan sesudah dibuat ia
    tidak akan bisa membukanya lagi (halaman menyaring per unit), sehingga barisnya
    jadi draft hantu: ada di DB, tak terjangkau pembuatnya, tak diketahui unit yang
    sebenarnya memilikinya. Kelas kegagalan yang sama sudah dicatat di
    `jabatanTerjangkau()`.

    Super Admin & Admin Talenta lolos sendiri: `unitWajib()` untuk mereka `null`,
    jadi penjaganya tidak membatasi apa pun.
  */
  if ((await jabatanTerjangkau(idJabatan.data)) === null) {
    return gagal(
      'Jabatan itu tidak ada atau di luar lingkup unit Anda. Anda hanya bisa mengusulkan kursi di unit sendiri.',
    )
  }

  if (jabatan.status_jabatan === 'DIHAPUS') {
    return gagal(`"${jabatan.nama_jabatan}" sudah diarsipkan di master jabatan.`)
  }
  // Ditolak walaupun tombolnya memang hanya tampil untuk jabatan tanpa target —
  // halaman bisa basi, dan membuat target kedua untuk jabatan yang sama berarti
  // dua rubrik menilai orang untuk posisi yang sama tanpa ada yang tahu mana
  // yang berlaku.
  if (jabatan.nama_target_ada !== null) {
    return gagal(
      `"${jabatan.nama_jabatan}" sudah termasuk jabatan target "${jabatan.nama_target_ada}". Sunting yang itu alih-alih membuat draft kedua.`,
    )
  }

  const kodeTarget = `JT-${jabatan.kode_jabatan}`.slice(0, 40)
  const namaTarget = jabatan.nama_jabatan.slice(0, 250)

  try {
    const hasil = await jalankanMutasi({
      entitas: 'jabatan_target',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_USUL_TARGET,
      jalankan: async () => {
        const { insertId } = await eksekusi(
          `INSERT INTO jabatan_target (kode_target, nama_target, deskripsi, kata_kunci_relevansi, status)
           VALUES (?, ?, ?, JSON_ARRAY(), 'DRAFT')`,
          [
            kodeTarget,
            namaTarget,
            `Dibuat dari jabatan kosong ${jabatan.kode_jabatan}. Lengkapi persyaratan & rubrik sebelum diaktifkan.`,
          ],
        )
        /*
          Kursinya ditulis ke kolom jabatan_id, BUKAN ke tabel anggota.

          Sampai doc/sql/032 keduanya satu hal, jadi barisnya disisipkan ke tabel
          anggota. Sejak tabel itu berarti "jabatan asal kandidat", menyisipkannya
          berarti draft baru lahir dengan SATU jabatan asal — yaitu kursi yang justru
          kosong — sehingga gerbangnya menggugurkan semua orang. Pemilik proses
          meminta bawaannya KOSONG (tidak menyaring).
        */
        await eksekusi(`UPDATE jabatan_target SET jabatan_id = ? WHERE id = ?`, [
          idJabatan.data,
          insertId,
        ])

        /*
          Syarat RUMPUN JABATAN ASAL, diisi dari jabatan anggotanya (pilihan pemilik
          proses 1 Sep 2026: *"filtering kandidat dari jabatan anggota itu juga"*,
          dengan bawaan **satu tingkat di bawah**).

          Nilainya DITULIS ke barisnya, bukan dibaca hidup — kalau aturannya
          dihitung ulang tiap kali skor dievaluasi, menambah satu jabatan anggota
          akan diam-diam mengubah siapa yang lolos tanpa ada yang memutuskannya.
          Sebagai baris syarat ia terlihat, bisa disunting, dan tercatat di audit.

          Kalau tidak ada tingkat di bawahnya (jabatan fungsional / eselon tak
          dikenali), barisnya TIDAK dibuat sama sekali. Menulis syarat berisi kosong
          jauh lebih buruk daripada tidak menulisnya: `RUMPUN_JABATAN` tanpa nilai
          membuat SEMUA kandidat berstatus PERLU_VERIFIKASI_MANUAL.
        */
        const pengumpan = await rumpunSatuTingkatDiBawah(jabatan.eselon)
        if (pengumpan.length > 0) {
          await eksekusi(
            `INSERT INTO jabatan_target_persyaratan (jabatan_target_id, jenis_syarat, deskripsi, nilai_minimal)
             VALUES (?, 'RUMPUN_JABATAN', ?, ?)`,
            [
              insertId,
              `Kandidat sedang menjabat pada rumpun satu tingkat di bawah ${jabatan.nama_jabatan} (eselon ${jabatan.eselon ?? '-'}). Ubah kalau jalur pengisiannya berbeda; isi "semua" untuk tidak menyaring.`,
              pengumpan.join(', '),
            ],
          )
        }

        return {
          entitasId: insertId,
          sesudah: {
            id: insertId,
            kodeTarget,
            namaTarget,
            status: 'DRAFT',
            dariJabatanId: idJabatan.data,
          },
        }
      },
    })
    segarkan(hasil.entitasId ?? undefined)
    revalidatePath('/jabatan-target')

    /*
      Serah-terima ke yang memutuskan. Tanpa kabar ini, draft usulan unit hanya
      menunggu di daftar Jabatan Target sampai ada yang kebetulan membukanya —
      antrean yang tidak ditonton siapa pun. Pelakunya dikecualikan supaya Admin
      Talenta yang membuat draft sendiri tidak mengabari dirinya.

      Sengaja SESUDAH mutasi berhasil dan tidak dibungkus `try` yang membatalkan:
      kabar yang gagal terkirim tidak boleh menghapus usulan yang sudah tersimpan.
    */
    const pengguna = await getCurrentUser()
    await beritahuUsulanTarget({
      jabatanTargetId: hasil.entitasId ?? 0,
      namaTarget,
      namaJabatan: jabatan.nama_jabatan,
      namaUnit: jabatan.nama_unit,
      namaPengusul: pengguna?.nama ?? 'Seorang pengguna',
      pelakuId: pengguna?.id ?? null,
    })

    /*
      Pesan sukses mengikuti apa yang BOLEH dilakukan pembacanya. Mengatakan
      "lengkapi rubriknya lalu aktifkan" kepada Pengelola Unit menyuruhnya
      mengerjakan dua hal yang tombolnya tidak akan pernah ia lihat — dan itu
      terbaca sebagai aplikasi yang rusak, bukan sebagai izin yang memang dibatasi.
    */
    const bolehMemutuskan = pengguna !== null && PERAN_KELOLA_TARGET.includes(pengguna.peran)
    return berhasil(
      { id: hasil.entitasId ?? 0 },
      bolehMemutuskan
        ? `Draft jabatan target "${namaTarget}" dibuat. Lengkapi persyaratan & rubriknya, lalu aktifkan.`
        : `Usulan jabatan target "${namaTarget}" dibuat sebagai draft. Lengkapi persyaratannya — Admin Talenta akan menyusun rubrik penilaian lalu mengaktifkannya.`,
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Kode target "${kodeTarget}"` })
    if (pesan) return gagal(pesan)
    throw e
  }
}

export async function ubahJabatanTarget(
  id: unknown,
  masukan: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_KELOLA_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(id)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')

  const urai = SkemaTarget.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  try {
    await jalankanMutasi({
      entitas: 'jabatan_target',
      aksi: 'UBAH',
      peranDiizinkan: PERAN_KELOLA_TARGET,
      sebelum: () => bacaTarget(idTarget.data),
      jalankan: async () => {
        // `kata_kunci_relevansi` SENGAJA tidak ada di sini — satu-satunya jalur
        // tulisnya adalah syarat BIDANG_ILMU di tab Persyaratan (Fase 11 no. 3).
        // Selama form ini juga bisa menulisnya, menyunting profil akan menimpa
        // deklarasi syarat tanpa menyebutnya, dan skor bergeser karena tindakan
        // yang kelihatannya cuma mengganti nama.
        await eksekusi(
          `UPDATE jabatan_target SET kode_target = ?, nama_target = ?, deskripsi = ? WHERE id = ?`,
          [d.kodeTarget, d.namaTarget, d.deskripsi, idTarget.data],
        )
        return { entitasId: idTarget.data, sesudah: { id: idTarget.data, ...d } }
      },
    })
    segarkan(idTarget.data)
    return berhasil(
      undefined,
      'Profil jabatan target disimpan. Bidang ilmu & syarat lain diubah dari tab Persyaratan.',
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Kode target "${d.kodeTarget}"` })
    if (pesan) return gagal(pesan, { kodeTarget: pesan })
    throw e
  }
}

/**
 * Ubah status jabatan target.
 *
 * Aktivasi diperiksa lebih dulu terhadap validasi rubrik & kelengkapan anggota.
 * Penolakannya menyebut **temuan pertamanya beserta angkanya**, bukan "rubrik
 * tidak valid" — pengguna harus tahu apa yang mesti dibetulkan tanpa menebak.
 */
export async function ubahStatusJabatanTarget(
  id: unknown,
  status: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_KELOLA_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(id)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')

  const uraiStatus = z.enum(['DRAFT', 'AKTIF', 'NONAKTIF']).safeParse(status)
  if (!uraiStatus.success) return gagal('Status tidak dikenali.')
  const statusBaru = uraiStatus.data

  if (statusBaru === 'AKTIF') {
    const halangan = await halanganAktivasi(idTarget.data)
    if (halangan !== null) return gagal(halangan)
  }

  await jalankanMutasi({
    entitas: 'jabatan_target',
    aksi: 'UBAH_STATUS',
    peranDiizinkan: PERAN_KELOLA_TARGET,
    sebelum: () => bacaTarget(idTarget.data),
    jalankan: async () => {
      await eksekusi(`UPDATE jabatan_target SET status = ? WHERE id = ?`, [
        statusBaru,
        idTarget.data,
      ])
      return { entitasId: idTarget.data, sesudah: { id: idTarget.data, status: statusBaru } }
    },
  })

  segarkan(idTarget.data)

  /*
    Serah-terima balik: pengusulnya perlu tahu targetnya sudah aktif, sebab justru
    sesudah itu ia bisa melanjutkan (skor terhitung → kandidat bisa dimasukkan ke
    talent pool). Tanpa kabar ini ia harus menebak kapan harus kembali memeriksa.

    Pengusulnya diambil dari JEJAK AUDIT, bukan dari kolom `dibuat_oleh` — kolom itu
    tidak ada di `jabatan_target`, dan menambahkannya sekarang berarti kolom kosong
    untuk seluruh baris yang sudah ada. `audit_log` sudah memuat jawabannya untuk
    target yang dibuat lewat UI, dan `null` untuk yang dibuat skrip seed — yang
    memang tidak punya pengusul, jadi tidak ada yang perlu dikabari.

    Hanya saat AKTIF, dan hanya kalau pengusulnya BUKAN pelakunya sendiri.
  */
  if (statusBaru === 'AKTIF') {
    const pengguna = await getCurrentUser()
    const pengusul = await kueriSatu<{ user_id: number | null }>(
      `SELECT user_id FROM audit_log
        WHERE entitas = 'jabatan_target' AND entitas_id = ? AND aksi = 'BUAT'
        ORDER BY id ASC LIMIT 1`,
      [idTarget.data],
    )
    const idPengusul = pengusul?.user_id === null ? null : Number(pengusul?.user_id)
    if (idPengusul !== null && idPengusul !== undefined && idPengusul !== pengguna?.id) {
      const target = await kueriSatu<{ nama_target: string }>(
        `SELECT nama_target FROM jabatan_target WHERE id = ?`,
        [idTarget.data],
      )
      await beritahuTargetAktif({
        jabatanTargetId: idTarget.data,
        namaTarget: target?.nama_target ?? 'Jabatan target',
        pengusulUserId: idPengusul,
        namaPelaku: pengguna?.nama ?? 'Admin Talenta',
        pelakuId: pengguna?.id ?? null,
      })
    }
  }

  const pesan =
    statusBaru === 'AKTIF'
      ? 'Jabatan target diaktifkan. Rubriknya lolos seluruh pemeriksaan.'
      : statusBaru === 'NONAKTIF'
        ? 'Jabatan target dinonaktifkan. Skor & talent pool yang sudah ada tetap tersimpan.'
        : 'Jabatan target dikembalikan ke draft.'
  return berhasil(undefined, pesan)
}

/**
 * Hapus jabatan target; diarsipkan (NONAKTIF) kalau skornya sudah dipakai.
 *
 * `talent_pool` menunjuk jabatan target dengan `ON DELETE CASCADE`, dan
 * `nominasi` menunjuk `talent_pool` dengan cascade juga — jadi menghapus satu
 * jabatan target bisa menghapus rantai nominasi & approval tanpa peringatan.
 */
export async function hapusJabatanTarget(id: unknown): Promise<HasilAksi<{ diarsipkan: boolean }>> {
  const tolak = await gerbangPeran(PERAN_KELOLA_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(id)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')

  const pakai = await kueriSatu<{ pool: number; skor: number; nominasi: number }>(
    `SELECT
       (SELECT COUNT(*) FROM talent_pool WHERE jabatan_target_id = ?) AS pool,
       (SELECT COUNT(*) FROM match_score WHERE jabatan_target_id = ?) AS skor,
       (SELECT COUNT(*) FROM nominasi n JOIN talent_pool tp ON tp.id = n.talent_pool_id
          WHERE tp.jabatan_target_id = ?) AS nominasi`,
    [idTarget.data, idTarget.data, idTarget.data],
  )
  const pool = Number(pakai?.pool ?? 0)
  const skor = Number(pakai?.skor ?? 0)
  const nominasi = Number(pakai?.nominasi ?? 0)

  const arsipkan = pool > 0 || nominasi > 0

  await jalankanMutasi({
    entitas: 'jabatan_target',
    aksi: arsipkan ? 'UBAH_STATUS' : 'HAPUS',
    peranDiizinkan: PERAN_KELOLA_TARGET,
    sebelum: () => bacaTarget(idTarget.data),
    jalankan: async () => {
      if (arsipkan) {
        await eksekusi(`UPDATE jabatan_target SET status = 'NONAKTIF' WHERE id = ?`, [idTarget.data])
      } else {
        /*
          Notifikasinya ikut dihapus, dan ini harus DISENGAJA: `notifikasi.entitas_id`
          bukan foreign key, jadi tidak ada cascade yang mengurusnya. Tanpa ini,
          menghapus jabatan target meninggalkan kabar "Usulan jabatan target" di Inbox
          orang lain yang menaut ke halaman yang sudah tidak ada — dan proyek ini sudah
          punya 21 notifikasi yatim dari seed, jadi setiap tambahan menenggelamkan yang
          asli. Terukur: 4 baris yatim lahir dari satu jalan smoke sebelum ini dipasang.

          Dilakukan SEBELUM barisnya dihapus supaya keduanya dalam satu mutasi yang
          sama; kalau dibalik, kegagalan di tengah meninggalkan notifikasi tanpa
          targetnya — keadaan yang justru sedang dihapuskan.
        */
        await eksekusi(
          `DELETE FROM notifikasi WHERE entitas = 'jabatan_target' AND entitas_id = ?`,
          [idTarget.data],
        )
        await eksekusi(`DELETE FROM jabatan_target WHERE id = ?`, [idTarget.data])
      }
      return {
        entitasId: idTarget.data,
        sesudah: arsipkan ? { id: idTarget.data, status: 'NONAKTIF' } : null,
      }
    },
  })

  segarkan(idTarget.data)
  return berhasil(
    { diarsipkan: arsipkan },
    arsipkan
      ? `Dinonaktifkan, bukan dihapus: masih dipakai ${pool} entri talent pool${nominasi > 0 ? ` dan ${nominasi} nominasi` : ''}. Menghapusnya akan ikut menghapus riwayat nominasi & persetujuannya.`
      : `Jabatan target dihapus${skor > 0 ? ` beserta ${skor} baris skor yang belum dipakai pool` : ''}.`,
  )
}

// ---------------------------------------------------------------------------
// Tab 1 — Jabatan Anggota
// ---------------------------------------------------------------------------

export async function tambahAnggotaJabatan(
  jabatanTargetId: unknown,
  jabatanId: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_KELOLA_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  const idJabatan = idPositif.safeParse(jabatanId)
  if (!idTarget.success || !idJabatan.success) return gagal('Pilihan jabatan tidak dikenali.')

  const jabatan = await kueriSatu<{ nama_jabatan: string; status_jabatan: string }>(
    `SELECT nama_jabatan, status_jabatan FROM jabatan WHERE id = ?`,
    [idJabatan.data],
  )
  if (jabatan === null) return gagal('Jabatan itu tidak ada. Muat ulang halaman lalu coba lagi.')
  if (jabatan.status_jabatan === 'DIHAPUS') {
    return gagal(
      `"${jabatan.nama_jabatan}" sudah diarsipkan di master jabatan, jadi tidak bisa dijadikan jabatan target.`,
    )
  }

  try {
    await jalankanMutasi({
      entitas: 'jabatan_target_anggota',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_KELOLA_TARGET,
      jalankan: async () => {
        await eksekusi(
          `INSERT INTO jabatan_target_anggota (jabatan_target_id, jabatan_id) VALUES (?, ?)`,
          [idTarget.data, idJabatan.data],
        )
        return {
          entitasId: idTarget.data,
          sesudah: { jabatanTargetId: idTarget.data, jabatanId: idJabatan.data },
        }
      },
    })
    segarkan(idTarget.data)
    return berhasil(undefined, `"${jabatan.nama_jabatan}" ditambahkan sebagai jabatan anggota.`)
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Jabatan "${jabatan.nama_jabatan}"` })
    if (pesan) return gagal(pesan)
    throw e
  }
}

/**
 * Lepaskan SEMUA jabatan sejenis sekaligus dari daftar jabatan asal kandidat.
 *
 * Cermin `tambahAnggotaSekaligus()`, dan ada karena alasan yang sama: sejak
 * daftarnya berisi puluhan kursi (59–67 per jabatan target), melepasnya satu per
 * satu berarti menekan tombol 59 kali dan 59 permintaan.
 *
 * ## Id eksplisit, bukan nama jenisnya
 *
 * Alasan yang sama dengan penambahannya — dan di sini taruhannya lebih tinggi,
 * sebab ini menghapus. Server yang memuai sendiri "semua Kepala Balai" bisa
 * membuang baris yang tidak pernah dilihat penggunanya kalau daftarnya berubah
 * sejak halaman dirender.
 *
 * ## Boleh mengosongkan daftar sampai NOL, dan itu disengaja
 *
 * Daftar kosong berarti "tidak menyaring" — keadaan sah yang jadi bawaan draft
 * baru. Menolak penghapusan terakhir (seperti yang dilakukan `hapusAnggotaJabatan`
 * selama daftar ini masih berarti KURSI) sekarang justru salah: ia akan mengunci
 * jabatan target pada saringan yang tidak bisa dilepas pemiliknya.
 */
export async function hapusAnggotaSekaligus(
  jabatanTargetId: unknown,
  jabatanIds: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_KELOLA_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')

  const uraiIds = z.array(idPositif).min(1).max(200).safeParse(jabatanIds)
  if (!uraiIds.success) return gagal('Daftar jabatan tidak dikenali atau terlalu panjang.')
  const ids = [...new Set(uraiIds.data)]

  const sebelum = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM jabatan_target_anggota WHERE jabatan_target_id = ?`,
    [idTarget.data],
  )

  await jalankanMutasi({
    entitas: 'jabatan_target_anggota',
    aksi: 'HAPUS',
    peranDiizinkan: PERAN_KELOLA_TARGET,
    sebelum: () =>
      kueri(
        `SELECT jabatan_target_id, jabatan_id FROM jabatan_target_anggota
          WHERE jabatan_target_id = ? AND jabatan_id IN (?)`,
        [idTarget.data, ids],
      ),
    jalankan: async () => {
      await eksekusi(
        `DELETE FROM jabatan_target_anggota WHERE jabatan_target_id = ? AND jabatan_id IN (?)`,
        [idTarget.data, ids],
      )
      return { entitasId: idTarget.data, sesudah: null }
    },
  })

  const sesudah = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM jabatan_target_anggota WHERE jabatan_target_id = ?`,
    [idTarget.data],
  )
  const keluar = Number(sebelum?.n ?? 0) - Number(sesudah?.n ?? 0)

  segarkan(idTarget.data)
  return berhasil(
    undefined,
    Number(sesudah?.n ?? 0) === 0
      ? `${keluar} jabatan dilepas. Daftar kosong — jabatan target ini tidak lagi menyaring kandidat menurut jabatan asalnya.`
      : `${keluar} jabatan dilepas, tersisa ${Number(sesudah?.n ?? 0)}.`,
  )
}

/**
 * Tambahkan SEMUA jabatan sejenis sekaligus (mis. 63 kursi Kepala Balai).
 *
 * Permintaan pemilik proses 31 Agu 2026: daftar pilihan dibuat lebih general —
 * "jabatan apa saja yang bisa dinominasikan", bukan 63 baris balai satu per satu.
 * Begitu daftarnya berkelompok, menambahkan kelompok harus jadi satu tindakan;
 * kalau tidak, pengguna menekan tombol 63 kali dan tiap tekan satu permintaan.
 *
 * ## Id yang dikirim klien, BUKAN nama jenisnya
 *
 * Menerima nama jenis lalu memuainya sendiri di server terlihat lebih rapi, tapi
 * artinya server menambahkan baris yang **tidak pernah dilihat** penggunanya —
 * daftar bisa saja sudah berubah sejak halaman dirender. Dengan id eksplisit, yang
 * ditambahkan tepat yang tampil di layar saat ia menekan tombol.
 *
 * ## Satu transaksi, dan yang sudah ada DILEWATI bukan menggagalkan
 *
 * `jabatan_target_anggota` berkunci (target, jabatan), jadi INSERT biasa akan
 * gagal di tengah begitu satu jabatan sudah jadi anggota — dan yang terjadi bukan
 * "sebagian masuk" melainkan seluruh batch batal karena alasan yang sama sekali
 * tidak penting. `INSERT IGNORE` melewatinya; jumlah yang benar-benar masuk
 * dilaporkan apa adanya supaya "ditambahkan 40 dari 63" tidak terbaca sebagai 63.
 */
export async function tambahAnggotaSekaligus(
  jabatanTargetId: unknown,
  jabatanIds: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_KELOLA_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')

  // Batas 200 bukan angka bulat yang dikarang: kelompok terbesar di master
  // sekarang 63 kursi, jadi 200 memberi ruang tumbuh sambil tetap menolak
  // kiriman yang jelas bukan berasal dari daftar di layar.
  const uraiIds = z.array(idPositif).min(1).max(200).safeParse(jabatanIds)
  if (!uraiIds.success) return gagal('Daftar jabatan tidak dikenali atau terlalu panjang.')
  const ids = [...new Set(uraiIds.data)]

  const sah = await kueri<{ id: number }>(
    `SELECT id FROM jabatan WHERE id IN (?) AND status_jabatan <> 'DIHAPUS'`,
    [ids],
  )
  if (sah.length === 0) {
    return gagal('Tidak ada jabatan yang bisa ditambahkan. Muat ulang halaman lalu coba lagi.')
  }

  const sebelum = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM jabatan_target_anggota WHERE jabatan_target_id = ?`,
    [idTarget.data],
  )

  await jalankanMutasi({
    entitas: 'jabatan_target_anggota',
    aksi: 'BUAT',
    peranDiizinkan: PERAN_KELOLA_TARGET,
    jalankan: async () => {
      await eksekusi(
        `INSERT IGNORE INTO jabatan_target_anggota (jabatan_target_id, jabatan_id)
         VALUES ${sah.map(() => '(?, ?)').join(', ')}`,
        sah.flatMap((j) => [idTarget.data, j.id]),
      )
      return {
        entitasId: idTarget.data,
        sesudah: { jabatanTargetId: idTarget.data, jabatanId: sah.map((j) => j.id) },
      }
    },
  })

  const sesudah = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM jabatan_target_anggota WHERE jabatan_target_id = ?`,
    [idTarget.data],
  )
  const masuk = Number(sesudah?.n ?? 0) - Number(sebelum?.n ?? 0)

  segarkan(idTarget.data)
  return berhasil(
    undefined,
    masuk === sah.length
      ? `${masuk} jabatan ditambahkan sebagai anggota.`
      : `${masuk} jabatan ditambahkan · ${sah.length - masuk} sudah jadi anggota sebelumnya.`,
  )
}

export async function hapusAnggotaJabatan(
  jabatanTargetId: unknown,
  jabatanId: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_KELOLA_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  const idJabatan = idPositif.safeParse(jabatanId)
  if (!idTarget.success || !idJabatan.success) return gagal('Pilihan jabatan tidak dikenali.')

  const sisa = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM jabatan_target_anggota WHERE jabatan_target_id = ?`,
    [idTarget.data],
  )
  const status = await kueriSatu<{ status: string }>(
    `SELECT status FROM jabatan_target WHERE id = ?`,
    [idTarget.data],
  )
  // Jabatan target AKTIF tanpa anggota tidak menunjuk posisi apa pun, padahal
  // skornya tetap muncul di talent pool. Dihalangi di sini, bukan dibiarkan
  // lalu ditemukan sebagai daftar kandidat untuk jabatan yang tidak ada.
  if (Number(sisa?.n ?? 0) <= 1 && status?.status === 'AKTIF') {
    return gagal(
      'Ini satu-satunya jabatan anggota dan jabatan targetnya sedang AKTIF. Tambahkan jabatan lain lebih dulu, atau nonaktifkan jabatan targetnya.',
    )
  }

  await jalankanMutasi({
    entitas: 'jabatan_target_anggota',
    aksi: 'HAPUS',
    peranDiizinkan: PERAN_KELOLA_TARGET,
    sebelum: () =>
      kueriSatu(
        `SELECT jabatan_target_id, jabatan_id FROM jabatan_target_anggota
         WHERE jabatan_target_id = ? AND jabatan_id = ?`,
        [idTarget.data, idJabatan.data],
      ),
    jalankan: async () => {
      await eksekusi(
        `DELETE FROM jabatan_target_anggota WHERE jabatan_target_id = ? AND jabatan_id = ?`,
        [idTarget.data, idJabatan.data],
      )
      return { entitasId: idTarget.data, sesudah: null }
    },
  })

  segarkan(idTarget.data)
  return berhasil(undefined, 'Jabatan anggota dilepas.')
}

// ---------------------------------------------------------------------------
// Tab 2 — Persyaratan
// ---------------------------------------------------------------------------

// DITURUNKAN dari mesin kelayakan, tidak diketik ulang — lihat catatan pada
// `SEMUA_JENIS_SYARAT` di `lib/scoring/eligibility.ts`.
const JENIS_SYARAT = SEMUA_JENIS_SYARAT

const SkemaSyarat = z.object({
  jenisSyarat: z.enum(JENIS_SYARAT),
  deskripsi: z
    .string()
    .trim()
    .min(5, 'Deskripsi syarat minimal 5 karakter')
    .max(1000, 'Deskripsi syarat maksimal 1.000 karakter'),
  /**
   * Bentuk `nilaiMinimal` menentukan apakah syaratnya bisa diperiksa mesin.
   * Kosong = sah, tapi kandidat akan ditandai PERLU_VERIFIKASI_MANUAL — bukan
   * lolos, bukan gagal (`lib/scoring/eligibility.ts`).
   */
  nilaiMinimal: z.string().trim().max(60, 'Nilai minimal maksimal 60 karakter').nullable(),
  /**
   * Lama minimal pada jenjang yang dipersyaratkan, dalam TAHUN (`doc/sql/019`).
   *
   * Hanya bermakna untuk `PENGALAMAN_MIN` berbentuk eselon — lembar Persyaratan
   * Jabatan menulis "pengawas paling singkat 3 tahun". Dibatasi 60 tahun: masa
   * kerja PNS tidak mungkin melampauinya, dan batas atas menahan salah ketik
   * (mis. 30 menjadi 300) yang akan menggugurkan semua orang.
   */
  durasiTahunMin: z
    .number()
    .int('Durasi harus bilangan bulat tahun')
    .min(1, 'Durasi minimal 1 tahun')
    .max(60, 'Durasi maksimal 60 tahun')
    .nullable()
    .optional(),
})

export type MasukanSyarat = z.infer<typeof SkemaSyarat>

const TINGKAT_PENDIDIKAN = ['SLTA', 'D3', 'S1_D4', 'S2', 'S3'] as const

/** Bentuk `nilaiMinimal` yang bisa dibaca mesin, per jenis syarat. */
function periksaNilaiMinimal(d: MasukanSyarat): string | null {
  const nilai = (d.nilaiMinimal ?? '').trim()
  if (nilai === '') return null

  if (d.jenisSyarat === 'PENDIDIKAN_MIN' && !TINGKAT_PENDIDIKAN.includes(nilai as never)) {
    return `Untuk pendidikan minimal, isi salah satu: ${TINGKAT_PENDIDIKAN.join(' · ')}. Nilai lain tidak bisa diperiksa otomatis.`
  }
  if (d.jenisSyarat === 'PENGALAMAN_MIN') {
    const eselon = ['I', 'II', 'III', 'IV', 'NON_ESELON']
    if (!eselon.includes(nilai.toUpperCase()) && Number.isNaN(Number(nilai))) {
      return `Untuk pengalaman minimal, isi eselon (${eselon.join(' · ')}) atau jumlah tahun berupa angka.`
    }
    /*
      Durasi hanya bermakna berdampingan dengan JENJANG. Kalau `nilaiMinimal`-nya
      sendiri sudah berupa angka tahun, mengisi durasi berarti dua angka tahun untuk
      satu syarat — dan tidak ada di UI maupun mesin yang menjelaskan mana yang
      berlaku. Ditolak di sini, bukan dibiarkan lalu diabaikan diam-diam.
    */
    if ((d.durasiTahunMin ?? null) !== null && !Number.isNaN(Number(nilai))) {
      return 'Durasi tidak bisa dipakai bersama nilai minimal berupa angka tahun. Isi jenjangnya (mis. IV) lalu durasinya, atau jumlah tahun saja.'
    }
  }
  if (d.jenisSyarat === 'GOLONGAN_MIN' && bakukanGolongan(nilai) === null) {
    return `Golongan "${nilai}" tidak dikenali. Isi seperti III/d atau IV/b (I/a sampai IV/e).`
  }
  if (d.jenisSyarat !== 'PENGALAMAN_MIN' && (d.durasiTahunMin ?? null) !== null) {
    return 'Durasi hanya berlaku untuk syarat pengalaman.'
  }
  return null
}

/**
 * Pecah daftar bidang ilmu dari satu teks berkoma.
 *
 * Satu definisi untuk dua penyimpanan — lihat catatan di `simpanPersyaratan()`.
 * Dinormalisasi (trim, huruf kecil, buang duplikat) supaya `"Teknik, teknik "`
 * tidak tersimpan sebagai dua kata kunci yang mesin anggap berbeda.
 */
function pecahBidangIlmu(nilai: string): string[] {
  const hasil: string[] = []
  for (const bagian of nilai.split(',')) {
    const k = bagian.trim().toLowerCase()
    if (k !== '' && !hasil.includes(k)) hasil.push(k)
  }
  return hasil
}

/**
 * Simpan satu persyaratan jabatan target.
 *
 * **Untuk `BIDANG_ILMU`, aksi ini juga menulis `jabatan_target.kata_kunci_relevansi`
 * — dan itu inti Fase 11 no. 3 (U-15).**
 *
 * Sebelum ini, "bidang ilmu apa yang dianggap sesuai" dideklarasikan di **dua**
 * tempat dengan dua jalur tulis: baris persyaratan `BIDANG_ILMU` (dibaca gerbang
 * kelayakan, `lib/scoring/eligibility.ts`) dan kolom `kata_kunci_relevansi`
 * (dibaca indikator rubrik Kesesuaian Bidang Ilmu, `lib/penilaian.ts`). Keduanya
 * menyimpan **informasi yang sama** — daftar kata kunci, dengan `"semua"`
 * bermakna sama di keduanya — hanya berbeda format.
 *
 * Akibatnya sudah terjadi, bukan diperkirakan: di `pupr_dev` target 3 menyimpan
 * 3 kata kunci di gerbang tapi **5** di rubrik, dan target 1–2 masih menyimpan
 * kata *diklat* (`ppbj`, `kepemimpinan`) di daftar bidang ilmu — sisa sebelum
 * `doc/sql/015` memindahkan syarat diklat ke tabelnya sendiri. Dua jalur tulis
 * berarti menyunting salah satunya menggeser skor **atau** kelayakan, tapi tidak
 * pernah keduanya, dan tidak ada apa pun yang menunjukkan mana yang tertinggal.
 *
 * Yang **tidak** dilebur: fungsinya. Gerbang menjawab "lolos syarat atau tidak",
 * rubrik menjawab "berapa poin" — dan pemisahan itu memikul beban nyata berupa
 * **inversi**: di dev ada kandidat yang tidak lolos syarat tapi skornya di atas
 * kandidat yang lolos (Yuliana Wijaya 90,88, eselon tertinggi NON_ESELON). Kalau
 * syarat dilebur jadi indikator rubrik, ketidaklolosan akan menekan skornya
 * sendiri dan inversi seperti itu tidak mungkin lagi ada — dijaga dua pemeriksaan
 * di `scripts/verifikasi-data.ts`.
 */
export async function simpanPersyaratan(
  jabatanTargetId: unknown,
  persyaratanId: unknown,
  masukan: unknown,
): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_USUL_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')
  const idSyarat = persyaratanId === null ? null : idPositif.safeParse(persyaratanId)
  if (idSyarat !== null && !idSyarat.success) return gagal('Persyaratan tidak dikenali.')

  /*
    Pengelola Unit hanya boleh menyentuh target yang memuat kursi UNITNYA —
    diperiksa `targetTerjangkau()` di dalam SQL, bukan dengan menyembunyikan tab.

    Rubrik penilaian TIDAK ikut dibuka: ia formula 65/20/15 yang berlaku
    se-organisasi, bukan per unit. Dua unit yang menyetel bobot berbeda untuk kursi
    setara membuat skor lintas unit berhenti bisa dibandingkan — padahal
    perbandingan itu seluruh gunanya Peta Talenta.
  */
  if ((await targetTerjangkau(idTarget.data)) === null) {
    return gagal('Jabatan target itu tidak ada atau di luar lingkup unit Anda.')
  }

  const urai = SkemaSyarat.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const galatNilai = periksaNilaiMinimal(d)
  if (galatNilai !== null) return gagal(galatNilai, { nilaiMinimal: galatNilai })

  // Satu daftar, dua penyimpanan. Diturunkan di sini — bukan di dua pemanggil —
  // supaya tidak mungkin ada jalur yang menulis salah satunya saja.
  const bidangIlmu = d.jenisSyarat === 'BIDANG_ILMU' ? pecahBidangIlmu(d.nilaiMinimal ?? '') : null

  const hasil = await jalankanMutasi({
    entitas: 'jabatan_target_persyaratan',
    aksi: idSyarat === null ? 'BUAT' : 'UBAH',
    peranDiizinkan: PERAN_USUL_TARGET,
    sebelum:
      idSyarat === null
        ? undefined
        : () =>
            kueriSatu(
              `SELECT p.id, p.jenis_syarat, p.deskripsi, p.nilai_minimal, p.durasi_tahun_min,
                      (SELECT t.kata_kunci_relevansi FROM jabatan_target t WHERE t.id = p.jabatan_target_id)
                        AS kata_kunci_relevansi
                 FROM jabatan_target_persyaratan p WHERE p.id = ?`,
              [idSyarat.data],
            ),
    jalankan: async () => {
      // Ditulis di dalam mutasi yang sama, bukan sesudahnya: kalau yang kedua
      // gagal sementara yang pertama sudah masuk, kedua penyimpanan berselisih —
      // keadaan yang justru sedang dihapuskan oleh aksi ini.
      if (bidangIlmu !== null) {
        await eksekusi(`UPDATE jabatan_target SET kata_kunci_relevansi = ? WHERE id = ?`, [
          JSON.stringify(bidangIlmu),
          idTarget.data,
        ])
      }

      if (idSyarat === null) {
        const { insertId } = await eksekusi(
          `INSERT INTO jabatan_target_persyaratan
             (jabatan_target_id, jenis_syarat, deskripsi, nilai_minimal, durasi_tahun_min)
           VALUES (?, ?, ?, ?, ?)`,
          [
            idTarget.data,
            d.jenisSyarat,
            d.deskripsi,
            d.nilaiMinimal || null,
            d.durasiTahunMin ?? null,
          ],
        )
        return { entitasId: insertId, sesudah: { id: insertId, ...d, kataKunciRelevansi: bidangIlmu } }
      }
      await eksekusi(
        `UPDATE jabatan_target_persyaratan
            SET jenis_syarat = ?, deskripsi = ?, nilai_minimal = ?, durasi_tahun_min = ?
          WHERE id = ? AND jabatan_target_id = ?`,
        [
          d.jenisSyarat,
          d.deskripsi,
          d.nilaiMinimal || null,
          // Ditulis apa adanya, termasuk NULL: kalau jenisnya diubah dari
          // pengalaman ke yang lain, durasi lama HARUS ikut hilang — kalau tidak,
          // ia menempel pada syarat yang tidak memakainya dan muncul kembali begitu
          // jenisnya dikembalikan.
          d.durasiTahunMin ?? null,
          idSyarat.data,
          idTarget.data,
        ],
      )
      return {
        entitasId: idSyarat.data,
        sesudah: { id: idSyarat.data, ...d, kataKunciRelevansi: bidangIlmu },
      }
    },
  })

  segarkan(idTarget.data)
  return berhasil(
    { id: hasil.entitasId ?? 0 },
    bidangIlmu === null
      ? 'Persyaratan disimpan. Kelayakan kandidat berubah setelah skor dihitung ulang.'
      : `Bidang ilmu disimpan untuk gerbang kelayakan DAN indikator rubrik (${bidangIlmu.length} kata kunci). Jalankan Hitung Ulang agar skornya ikut.`,
  )
}

/**
 * Simpan syarat pelatihan jabatan target (Fase 11 no. 3 lanjutan, U-15).
 *
 * Sebelum ini `jabatan_target_syarat_diklat` **hanya bisa diubah lewat SQL** —
 * satu-satunya bagian lembar 6 tanpa permukaan UI, padahal ia menentukan indikator
 * Pengembangan Kompetensi (5%) untuk seluruh kandidat. Sekarang ia dideklarasikan
 * dari tab yang sama dengan pendidikan, bidang ilmu, dan pengalaman.
 *
 * Ditulis sebagai **ganti seluruhnya** (hapus lalu isi ulang), bukan tambah/kurang
 * per baris: yang dinyatakan pengguna adalah "inilah daftar syaratnya", dan daftar
 * yang disusun dari beberapa mutasi terpisah bisa berhenti di tengah — meninggalkan
 * syarat separuh yang tetap dipakai menghitung skor.
 *
 * **Rumpun ditolak di server, bukan cuma tidak ditawarkan di UI.** Menuntut
 * "Pelatihan Teknis" tanpa menyebut teknis apa membuat `penuhiSyaratPelatihan()`
 * tidak bisa membedakan Pengadaan dari Hukum Kontrak, dan indikatornya berhenti
 * bermakna. Halaman bisa basi; gerbangnya tidak boleh.
 */
export async function simpanSyaratDiklat(
  jabatanTargetId: unknown,
  kategoriIds: unknown,
): Promise<HasilAksi<{ jumlah: number }>> {
  const tolak = await gerbangPeran(PERAN_USUL_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  if (!idTarget.success) return gagal('Jabatan target tidak dikenali.')

  /*
    Pengelola Unit hanya boleh menyentuh target yang memuat kursi UNITNYA —
    diperiksa `targetTerjangkau()` di dalam SQL, bukan dengan menyembunyikan tab.

    Rubrik penilaian TIDAK ikut dibuka: ia formula 65/20/15 yang berlaku
    se-organisasi, bukan per unit. Dua unit yang menyetel bobot berbeda untuk kursi
    setara membuat skor lintas unit berhenti bisa dibandingkan — padahal
    perbandingan itu seluruh gunanya Peta Talenta.
  */
  if ((await targetTerjangkau(idTarget.data)) === null) {
    return gagal('Jabatan target itu tidak ada atau di luar lingkup unit Anda.')
  }

  const uraiId = z.array(idPositif).max(50, 'Terlalu banyak kategori').safeParse(kategoriIds)
  if (!uraiId.success) return gagal('Pilihan kategori pelatihan tidak dikenali.')
  const diminta = [...new Set(uraiId.data)]

  if (diminta.length > 0) {
    const sah = await kueri<{ id: number; kode: string; nama: string; parent_id: number | null }>(
      `SELECT id, kode, nama, parent_id FROM master_kategori_riwayat_diklat
        WHERE id IN (${diminta.map(() => '?').join(',')})`,
      diminta,
    )
    if (sah.length !== diminta.length) {
      return gagal('Ada kategori pelatihan yang sudah tidak ada. Muat ulang halaman lalu coba lagi.')
    }
    const rumpun = sah.filter((k) => k.parent_id === null)
    if (rumpun.length > 0) {
      return gagal(
        `${rumpun.map((k) => `"${k.nama}"`).join(', ')} adalah rumpun, bukan kategori yang bisa disyaratkan — pilih turunannya (mis. PIM IV, Pengadaan Barang dan Jasa) supaya syaratnya bisa diperiksa.`,
      )
    }
  }

  await jalankanMutasi({
    entitas: 'jabatan_target_syarat_diklat',
    aksi: 'UBAH',
    peranDiizinkan: PERAN_USUL_TARGET,
    sebelum: async (): Promise<Record<string, unknown>> => {
      const baris = await kueri<{ kode: string }>(
        `SELECT k.kode FROM jabatan_target_syarat_diklat s
           JOIN master_kategori_riwayat_diklat k ON k.id = s.kategori_id
          WHERE s.jabatan_target_id = ? ORDER BY k.kode`,
        [idTarget.data],
      )
      return { kategori: baris.map((r) => r.kode) }
    },
    jalankan: async () => {
      await eksekusi(`DELETE FROM jabatan_target_syarat_diklat WHERE jabatan_target_id = ?`, [
        idTarget.data,
      ])
      for (const id of diminta) {
        // `wajib` selalu 1: kolomnya ada di skema tapi BELUM dipakai perhitungan
        // (ERD §3.2) — indikator Pengembangan Kompetensi hanya punya dua kategori
        // skor, jadi tidak ada tempat membedakan "punya 1 dari 3" dari "punya 3
        // dari 3". Menawarkan penanda wajib/opsional di UI berarti kontrol yang
        // tidak berakibat apa pun.
        await eksekusi(
          `INSERT INTO jabatan_target_syarat_diklat (jabatan_target_id, kategori_id, wajib)
           VALUES (?, ?, 1)`,
          [idTarget.data, id],
        )
      }
      return { entitasId: idTarget.data, sesudah: { jumlah: diminta.length, kategoriIds: diminta } }
    },
  })

  segarkan(idTarget.data)
  return berhasil(
    { jumlah: diminta.length },
    diminta.length === 0
      ? 'Syarat pelatihan dikosongkan. Indikator Pengembangan Kompetensi jadi "tidak diketahui" — bukan gagal. Jalankan Hitung Ulang agar skornya ikut.'
      : `${diminta.length} kategori pelatihan disimpan. Jalankan Hitung Ulang agar skor Pengembangan Kompetensi ikut berubah.`,
  )
}

export async function hapusPersyaratan(
  jabatanTargetId: unknown,
  persyaratanId: unknown,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_USUL_TARGET)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  const idSyarat = idPositif.safeParse(persyaratanId)
  if (!idTarget.success || !idSyarat.success) return gagal('Persyaratan tidak dikenali.')

  /*
    Pengelola Unit hanya boleh menyentuh target yang memuat kursi UNITNYA —
    diperiksa `targetTerjangkau()` di dalam SQL, bukan dengan menyembunyikan tab.

    Rubrik penilaian TIDAK ikut dibuka: ia formula 65/20/15 yang berlaku
    se-organisasi, bukan per unit. Dua unit yang menyetel bobot berbeda untuk kursi
    setara membuat skor lintas unit berhenti bisa dibandingkan — padahal
    perbandingan itu seluruh gunanya Peta Talenta.
  */
  if ((await targetTerjangkau(idTarget.data)) === null) {
    return gagal('Jabatan target itu tidak ada atau di luar lingkup unit Anda.')
  }

  const lama = await kueriSatu<{ jenis_syarat: string }>(
    `SELECT jenis_syarat FROM jabatan_target_persyaratan WHERE id = ? AND jabatan_target_id = ?`,
    [idSyarat.data, idTarget.data],
  )
  if (lama === null) return gagal('Persyaratan itu sudah tidak ada. Muat ulang halaman.')

  await jalankanMutasi({
    entitas: 'jabatan_target_persyaratan',
    aksi: 'HAPUS',
    peranDiizinkan: PERAN_USUL_TARGET,
    sebelum: () =>
      kueriSatu(
        `SELECT id, jenis_syarat, deskripsi, nilai_minimal FROM jabatan_target_persyaratan WHERE id = ?`,
        [idSyarat.data],
      ),
    jalankan: async () => {
      await eksekusi(
        `DELETE FROM jabatan_target_persyaratan WHERE id = ? AND jabatan_target_id = ?`,
        [idSyarat.data, idTarget.data],
      )
      // Menghapus syarat BIDANG_ILMU ikut mengosongkan `kata_kunci_relevansi`.
      // Tanpa ini, gerbang berhenti memeriksa bidang ilmu sementara indikator
      // rubrik **tetap** menilainya dari kata kunci yang tidak lagi punya pemilik
      // — kata kunci yatim yang masih menggerakkan skor dan tidak tampil di layar
      // mana pun.
      if (lama.jenis_syarat === 'BIDANG_ILMU') {
        await eksekusi(
          `UPDATE jabatan_target SET kata_kunci_relevansi = JSON_ARRAY() WHERE id = ?`,
          [idTarget.data],
        )
      }
      return { entitasId: idSyarat.data, sesudah: null }
    },
  })

  segarkan(idTarget.data)
  return berhasil(
    undefined,
    'Persyaratan dihapus. Kandidat yang tadinya tersaring olehnya akan lolos setelah skor dihitung ulang.',
  )
}

// ---------------------------------------------------------------------------
// Duplikasi rubrik dari jabatan target lain
// ---------------------------------------------------------------------------

/**
 * Salin seluruh rubrik (komponen → indikator → sub-indikator → kategori) dari
 * jabatan target lain.
 *
 * Ini bukan kemudahan belaka: menyusun rubrik 65/20/15 dari nol berarti mengetik
 * 9 indikator dan 30-an kategori skor beserta ambangnya, dan setiap salah ketik
 * ambang menghasilkan rubrik yang tetap memberi angka (lihat `validasi.ts`).
 * Menyalin dari rubrik yang sudah lolos validasi jauh lebih kecil risikonya.
 *
 * Rubrik tujuan harus KOSONG — menimpa rubrik yang sudah dipakai menghitung
 * berarti membuang bobot yang mungkin sudah disetel, tanpa jejak.
 */
export async function duplikasiRubrik(
  jabatanTargetId: unknown,
  dariJabatanTargetId: unknown,
): Promise<HasilAksi<{ jumlahKomponen: number; jumlahIndikator: number; jumlahKategori: number }>> {
  const tolak = await gerbangPeran(PERAN_KELOLA_TARGET)
  if (tolak) return tolak

  const idTujuan = idPositif.safeParse(jabatanTargetId)
  const idSumber = idPositif.safeParse(dariJabatanTargetId)
  if (!idTujuan.success || !idSumber.success) return gagal('Jabatan target tidak dikenali.')
  if (idTujuan.data === idSumber.data) return gagal('Sumber dan tujuan tidak boleh sama.')

  const adaKomponen = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM rubrik_komponen WHERE jabatan_target_id = ?`,
    [idTujuan.data],
  )
  if (Number(adaKomponen?.n ?? 0) > 0) {
    return gagal(
      `Jabatan target ini sudah punya ${adaKomponen?.n} komponen rubrik. Hapus komponennya lebih dulu bila memang mau diganti — menyalin ke atas rubrik yang sudah ada akan membuang bobot yang sudah disetel.`,
    )
  }

  const sumber = await ambilPohonRubrik(idSumber.data)
  if (sumber.length === 0) return gagal('Jabatan target sumber belum punya rubrik untuk disalin.')

  let hasil = { jumlahKomponen: 0, jumlahIndikator: 0, jumlahKategori: 0 }

  await jalankanMutasi({
    entitas: 'rubrik_komponen',
    aksi: 'BUAT',
    peranDiizinkan: PERAN_KELOLA_TARGET,
    jalankan: async () => {
      // Penyalinnya di `lib/rubrik-salin.ts` — dipakai bersama skrip
      // `jabatan-target-balai.ts`, yang tidak punya sesi sehingga tidak bisa
      // memanggil aksi ini. Dua penulis pohon rubrik dengan urutan berbeda
      // menghasilkan bentuk yang berbeda tanpa satu pun galat.
      hasil = await salinPohonRubrik(idTujuan.data, idSumber.data)
      return {
        entitasId: idTujuan.data,
        sesudah: { disalinDari: idSumber.data, jumlahKomponen: hasil.jumlahKomponen },
      }
    },
  })

  segarkan(idTujuan.data)
  return berhasil(
    hasil,
    `Rubrik disalin: ${hasil.jumlahKomponen} komponen · ${hasil.jumlahIndikator} indikator · ${hasil.jumlahKategori} kategori skor.`,
  )
}

