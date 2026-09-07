'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { jalankanMutasi } from '../audit'
import { getCurrentUser } from '../auth'
import { eksekusi, kueriSatu } from '../db'
import { ambilEntriPool } from '../kueri/suksesi'
import { kirimSemua, kirimanUntukAksi } from '../notifikasi'
import {
  AKSI,
  giliranSiapa,
  PERAN_WORKFLOW,
  terapkanAksi,
  type AksiWorkflow,
  type StatusPool,
} from '../workflow'
import { PERAN_KELOLA_POOL } from '../peran'
import { gerbangPeran } from './gerbang'
import { pegawaiTerjangkau } from './lingkup-data'
import { berhasil, gagal, galatDariZod, pesanDariGalatDb, type HasilAksi } from './hasil'

/**
 * Mutasi Talent Pool & Workflow Nominasi (Fase 6).
 *
 * **Satu pintu untuk semua transisi status**: `jalankanAksiWorkflow`. Tidak ada
 * server action terpisah untuk "setujui", "tolak", "tetapkan" — karena ketiganya
 * mengubah tiga hal yang sama (status pool, status nominasi, satu baris
 * `approval_log`) dan cuma beda nilainya. Aksi terpisah per keputusan berarti tiga
 * tempat yang bisa lupa memperbarui salah satu dari tiga hal itu, dan keadaan
 * setengah jalan seperti itu tidak menghasilkan galat — hanya halaman yang saling
 * bertentangan (`lib/workflow.ts`).
 *
 * Wewenangnya juga datang dari state machine (`definisi.peranDiizinkan`), bukan
 * ditulis ulang di sini.
 */

const idPositif = z.number().int().positive()

/**
 * Aksi yang diterima jalur tulis — DITURUNKAN dari tabel transisi, bukan diketik ulang.
 *
 * ⚠️ Daftar ini sebelumnya ditulis tangan, dan itu langsung menggigit: dua transisi
 * mundur yang ditambahkan 1 Sep 2026 (`BATALKAN_VERIFIKASI`, `BATALKAN_NOMINASI`,
 * `Detail Revisi PUPR 1_9_2026.pdf` butir 3) masuk ke `lib/workflow.ts` beserta
 * ujinya, tapi TIDAK ke sini. Akibatnya bentuk kegagalan yang paling menipu di
 * aplikasi ini: tombolnya **tergambar** — daftar tombol diturunkan dari
 * `aksiTersedia()`, yang membaca tabel transisi — dialognya terbuka, catatannya
 * bisa diisi, lalu Simpan selalu dijawab *"Aksi tidak dikenali."*. Nol galat, nol
 * uji merah; 573 uji unit tetap hijau karena semuanya menguji `lib/workflow.ts`,
 * yang memang benar.
 *
 * Diturunkan, satu-satunya cara agar kelalaian yang sama tidak bisa terulang:
 * `AKSI` bertipe `Record<AksiWorkflow, …>`, jadi transisi berikutnya otomatis ikut.
 */
const AKSI_SAH = Object.keys(AKSI) as [AksiWorkflow, ...AksiWorkflow[]]

const SkemaAksi = z.object({
  catatan: z.string().trim().max(2000, 'Catatan maksimal 2.000 karakter'),
  /** Wajib untuk AJUKAN: unit mana yang mengusulkan. */
  unitPengajuId: z.number().int().positive().nullable(),
})

export type MasukanAksiWorkflow = z.infer<typeof SkemaAksi>

function segarkan(jabatanTargetId?: number, nominasiId?: number | null): void {
  revalidatePath('/talent-pool')
  revalidatePath('/nominasi')
  revalidatePath('/rencana-pengembangan')
  revalidatePath('/inbox')
  revalidatePath('/')
  if (nominasiId !== null && nominasiId !== undefined) revalidatePath(`/nominasi/${nominasiId}`)
  if (jabatanTargetId !== undefined) {
    revalidatePath(`/jabatan-target/${jabatanTargetId}`)
    revalidatePath(`/jabatan-target/${jabatanTargetId}/kandidat`)
  }
}

export interface HasilAksiWorkflow {
  statusPoolBaru: StatusPool
  nominasiId: number | null
  jumlahNotifikasi: number
}

export async function jalankanAksiWorkflow(
  talentPoolId: unknown,
  aksi: unknown,
  masukan: unknown,
): Promise<HasilAksi<HasilAksiWorkflow>> {
  const tolak = await gerbangPeran(PERAN_WORKFLOW)
  if (tolak) return tolak

  const idPool = idPositif.safeParse(talentPoolId)
  if (!idPool.success) return gagal('Entri talent pool tidak dikenali.')

  const uraiAksi = z.enum(AKSI_SAH).safeParse(aksi)
  if (!uraiAksi.success) return gagal('Aksi tidak dikenali.')

  const urai = SkemaAksi.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const pengguna = await getCurrentUser()
  const entri = await ambilEntriPool(idPool.data)
  if (entri === null) return gagal('Entri talent pool itu tidak ada. Muat ulang halaman.')

  const hasil = terapkanAksi(
    uraiAksi.data as AksiWorkflow,
    { statusPool: entri.status, statusNominasi: entri.statusNominasi },
    pengguna?.peran ?? null,
  )
  if (!hasil.ok) return gagal(hasil.alasan)

  if (hasil.definisi.butuhCatatan && d.catatan.length < 5) {
    const pesan = `"${hasil.definisi.label}" perlu catatan — keputusan yang mengubah peringkat orang harus bisa ditelusuri alasannya.`
    return gagal(pesan, { catatan: pesan })
  }

  // AJUKAN membuat baris nominasi baru, jadi unit pengajunya wajib jelas.
  const unitPengajuId =
    d.unitPengajuId ?? (pengguna?.unitOrganisasiId ?? null)
  if (uraiAksi.data === 'AJUKAN' && unitPengajuId === null) {
    const pesan =
      'Unit pengaju harus dipilih. Nominasi diajukan atas nama unit, bukan atas nama pribadi.'
    return gagal(pesan, { unitPengajuId: pesan })
  }

  let nominasiId = entri.nominasiId
  let jumlahNotifikasi = 0

  try {
    await jalankanMutasi({
      entitas: 'talent_pool',
      aksi: 'UBAH_STATUS',
      peranDiizinkan: hasil.definisi.peranDiizinkan,
      sebelum: () =>
        kueriSatu(
          `SELECT tp.id, tp.status, tp.ranking, tp.catatan_reviewer,
                  (SELECT n.status FROM nominasi n WHERE n.talent_pool_id = tp.id
                     ORDER BY n.id DESC LIMIT 1) AS status_nominasi
           FROM talent_pool tp WHERE tp.id = ?`,
          [idPool.data],
        ),
      jalankan: async () => {
        // 1. Nominasi: buat baru untuk AJUKAN, perbarui untuk sisanya.
        if (uraiAksi.data === 'AJUKAN') {
          const { insertId } = await eksekusi(
            `INSERT INTO nominasi
               (talent_pool_id, diajukan_oleh_unit_id, diajukan_oleh_user_id, tanggal_diajukan,
                status, catatan)
             VALUES (?, ?, ?, CURDATE(), ?, ?)`,
            [
              idPool.data,
              unitPengajuId,
              pengguna?.id ?? null,
              hasil.statusNominasiBaru,
              d.catatan,
            ],
          )
          nominasiId = insertId
        } else if (hasil.statusNominasiBaru !== null && nominasiId !== null) {
          await eksekusi(`UPDATE nominasi SET status = ? WHERE id = ?`, [
            hasil.statusNominasiBaru,
            nominasiId,
          ])
        }

        // 2. Jejak approval — hanya untuk aksi yang punya tahapnya.
        if (hasil.jejak !== null && nominasiId !== null) {
          await eksekusi(
            `INSERT INTO approval_log (nominasi_id, tahap, status, approver_user_id, catatan)
             VALUES (?, ?, ?, ?, ?)`,
            [
              nominasiId,
              hasil.jejak.tahap,
              hasil.jejak.status,
              // Baris MENUNGGU belum punya approver — yang mengisinya adalah
              // orang yang nanti memutuskan, bukan yang mengajukan.
              hasil.jejak.status === 'MENUNGGU' ? null : (pengguna?.id ?? null),
              d.catatan === '' ? null : d.catatan,
            ],
          )
        }

        // 3. Status pool + jejak penetapan.
        const ditetapkan = hasil.statusPoolBaru === 'DITETAPKAN'
        await eksekusi(
          `UPDATE talent_pool
           SET status = ?,
               catatan_reviewer = ?,
               ditetapkan_pada = ${ditetapkan ? 'CURDATE()' : 'NULL'},
               ditetapkan_oleh = ${ditetapkan ? '?' : 'NULL'}
           WHERE id = ?`,
          ditetapkan
            ? [hasil.statusPoolBaru, catatanBaru(entri.catatanReviewer, hasil.definisi.label, d.catatan), pengguna?.id ?? null, idPool.data]
            : [hasil.statusPoolBaru, catatanBaru(entri.catatanReviewer, hasil.definisi.label, d.catatan), idPool.data],
        )

        return {
          entitasId: idPool.data,
          sesudah: {
            id: idPool.data,
            status: hasil.statusPoolBaru,
            statusNominasi: hasil.statusNominasiBaru,
            aksi: uraiAksi.data,
          },
        }
      },
    })
  } catch (e) {
    const pesan = pesanDariGalatDb(e, {})
    if (pesan) return gagal(pesan)
    throw e
  }

  // 4. Notifikasi — di LUAR mutasi: gagal mengabari tidak boleh membatalkan
  // keputusan yang sudah tercatat (perlakuan yang sama dengan jejak audit).
  const giliranBaru = giliranSiapa({
    statusPool: hasil.statusPoolBaru,
    statusNominasi: hasil.statusNominasiBaru ?? entri.statusNominasi,
  })
  jumlahNotifikasi = await kirimSemua(
    kirimanUntukAksi(uraiAksi.data as AksiWorkflow, giliranBaru, {
      namaKandidat: entri.nama,
      namaTarget: entri.namaTarget,
      namaUnitPengaju: entri.namaUnitPengaju,
      nominasiId,
      talentPoolId: idPool.data,
      jabatanTargetId: entri.jabatanTargetId,
      catatan: d.catatan === '' ? null : d.catatan,
      pelakuId: pengguna?.id ?? null,
      namaPelaku: pengguna?.nama ?? 'Sistem',
      pengajuUserId: entri.nominasiId === null ? (pengguna?.id ?? null) : await cariPengaju(nominasiId),
    }),
    pengguna?.id ?? null,
  )

  segarkan(entri.jabatanTargetId, nominasiId)
  return berhasil(
    { statusPoolBaru: hasil.statusPoolBaru, nominasiId, jumlahNotifikasi },
    `${hasil.definisi.label}: ${entri.nama} sekarang berstatus ${hasil.statusPoolBaru}.` +
      (jumlahNotifikasi > 0 ? ` ${jumlahNotifikasi} notifikasi terkirim.` : ''),
  )
}

/** Riwayat keputusan ditumpuk di `catatan_reviewer`, tidak ditimpa. */
function catatanBaru(lama: string | null, label: string, catatan: string): string | null {
  const baris = `[${label}]${catatan === '' ? '' : ` ${catatan}`}`
  const gabung = lama === null || lama.trim() === '' ? baris : `${lama} | ${baris}`
  // Kolom TEXT, tapi tetap dibatasi supaya riwayat panjang tidak menggusur isi awal.
  return gabung.length > 4000 ? gabung.slice(-4000) : gabung
}

async function cariPengaju(nominasiId: number | null): Promise<number | null> {
  if (nominasiId === null) return null
  const r = await kueriSatu<{ diajukan_oleh_user_id: number | null }>(
    `SELECT diajukan_oleh_user_id FROM nominasi WHERE id = ?`,
    [nominasiId],
  )
  return r?.diajukan_oleh_user_id === null || r?.diajukan_oleh_user_id === undefined
    ? null
    : Number(r.diajukan_oleh_user_id)
}

/**
 * Tambahkan kandidat yang lolos syarat ke talent pool.
 *
 * Inilah jembatan dari Fase 5 ke Fase 6: halaman Kandidat menghitung skor,
 * keanggotaan pool adalah **keputusan manusia** tentang siapa yang masuk daftar
 * suksesi. Kandidat yang tidak lolos syarat ditolak di sini, bukan disaring di UI
 * saja — daftar suksesi yang memuat orang tak memenuhi syarat akan dipakai
 * mengambil keputusan penempatan.
 */
export async function tambahKePool(
  jabatanTargetId: unknown,
  pegawaiId: unknown,
): Promise<HasilAksi<{ talentPoolId: number }>> {
  const tolak = await gerbangPeran(PERAN_KELOLA_POOL)
  if (tolak) return tolak

  const idTarget = idPositif.safeParse(jabatanTargetId)
  const idPegawai = idPositif.safeParse(pegawaiId)
  if (!idTarget.success || !idPegawai.success) return gagal('Pilihan kandidat tidak dikenali.')

  /*
    Pengelola Unit hanya boleh mengusulkan pegawai DI UNITNYA.

    Diperiksa sebelum apa pun dibaca soal skornya: kalau pemeriksaannya ditaruh
    sesudah, pesan galat "belum punya skor" vs "tidak lolos syarat" jadi cara
    menebak isi unit lain — pegawai yang tidak terjangkau pun akan memberi jawaban
    yang berbeda-beda menurut keadaan datanya.

    Super Admin & Admin Talenta lolos sendiri: `unitWajib()` untuk mereka `null`.
  */
  if ((await pegawaiTerjangkau(idPegawai.data)) === null) {
    return gagal(
      'Pegawai itu tidak ada atau di luar lingkup unit Anda. Anda hanya bisa mengusulkan pegawai unit sendiri.',
    )
  }

  const skor = await kueriSatu<{ id: number; eligible: number; skor_total: string; nama: string }>(
    `SELECT ms.id, ms.eligible, ms.skor_total, p.nama_lengkap AS nama
     FROM match_score ms JOIN pegawai p ON p.id = ms.pegawai_id
     WHERE ms.jabatan_target_id = ? AND ms.pegawai_id = ?`,
    [idTarget.data, idPegawai.data],
  )
  if (skor === null) {
    return gagal(
      'Pegawai ini belum punya skor untuk jabatan target tersebut. Jalankan Hitung Ulang di editor jabatan target lebih dulu.',
    )
  }
  if (Number(skor.eligible) !== 1) {
    return gagal(
      `${skor.nama} tidak lolos syarat minimal jabatan target ini, jadi tidak bisa dimasukkan ke daftar suksesi. Periksa alasannya di halaman Kandidat.`,
    )
  }

  try {
    const hasil = await jalankanMutasi({
      entitas: 'talent_pool',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_KELOLA_POOL,
      jalankan: async () => {
        const { insertId } = await eksekusi(
          `INSERT INTO talent_pool (pegawai_id, jabatan_target_id, match_score_id, status)
           VALUES (?, ?, ?, 'KANDIDAT')`,
          [idPegawai.data, idTarget.data, Number(skor.id)],
        )
        // Peringkat dihitung ulang bersama seluruh anggota pool, bukan ditebak
        // dari skor sendiri — kalau tidak, dua orang bisa berbagi nomor.
        await eksekusi(
          `UPDATE talent_pool tp
           JOIN (
             SELECT tp2.id,
                    ROW_NUMBER() OVER (ORDER BY ms.skor_total DESC, tp2.id) AS urut
             FROM talent_pool tp2
             LEFT JOIN match_score ms ON ms.pegawai_id = tp2.pegawai_id
                                     AND ms.jabatan_target_id = tp2.jabatan_target_id
             WHERE tp2.jabatan_target_id = ?
           ) AS r ON r.id = tp.id
           SET tp.ranking = r.urut
           WHERE tp.jabatan_target_id = ?`,
          [idTarget.data, idTarget.data],
        )
        return { entitasId: insertId, sesudah: { id: insertId, pegawaiId: idPegawai.data } }
      },
    })

    segarkan(idTarget.data)
    return berhasil(
      { talentPoolId: hasil.entitasId ?? 0 },
      `${skor.nama} masuk daftar suksesi dengan skor ${Number(skor.skor_total).toFixed(2)}. Peringkat seluruh anggota pool dihitung ulang.`,
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `${skor.nama} pada jabatan target ini` })
    if (pesan) return gagal(pesan)
    throw e
  }
}

// ---------------------------------------------------------------------------
// Rencana pengembangan
// ---------------------------------------------------------------------------

const SkemaRencana = z.object({
  jenisPengembangan: z.enum(['DIKLAT', 'ROTASI', 'MENTORING', 'PENUGASAN']),
  deskripsi: z
    .string()
    .trim()
    .min(10, 'Deskripsi minimal 10 karakter — rencana yang tidak spesifik tidak bisa ditindak')
    .max(2000, 'Deskripsi maksimal 2.000 karakter'),
  targetSelesai: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Format tanggal harus YYYY-MM-DD')
    .nullable(),
  status: z.enum(['DIRENCANAKAN', 'BERJALAN', 'SELESAI']),
})

export type MasukanRencana = z.infer<typeof SkemaRencana>

const PERAN_RENCANA = ['Super Admin', 'Admin Talenta', 'Pimpinan'] as const

/*
  Peran yang boleh memasukkan kandidat ke pool: `PERAN_KELOLA_POOL` di
  `lib/peran.ts` — satu daftar, dipakai bersama halaman Talent Pool yang menggambar
  tombolnya. Pengelola Unit ikut sejak 24 Agu 2026; alasan & batas lingkupnya ada di
  modul itu.
*/


/**
 * Sasaran sebuah rencana pengembangan.
 *
 * Dua bentuk yang saling menggantikan, bukan dua kolom yang harus diisi keduanya:
 * `talentPoolId` untuk rencana yang lahir dari pencalonan sebuah jabatan target,
 * `pegawaiId` untuk rencana umum yang tidak terikat kursi mana pun.
 */
export interface SasaranRencana {
  talentPoolId?: number | null
  pegawaiId?: number | null
  /** Suksesor yang rencananya dijadikan contoh; hanya dipakai saat membuat baru. */
  dicontohDariPegawaiId?: number | null
}

/**
 * KELUARKAN seseorang dari talent pool — hapus barisnya, bukan tandai ditolak.
 *
 * Permintaan pemilik proses 2 Sep 2026, dua kali dan makin tegas: *"kalo udah
 * dimasukin pool punya opsi dikeluarin lagi, soalnya takut user salah pencet"*,
 * lalu *"yang talent pool buat keluarin dari pool pake keluarkan dari pool aja,
 * jadi bukan statusnya ditolak tapi keluar dari pool aja."*
 *
 * ## Ini MENGGANTIKAN aksi `TOLAK_KANDIDAT`, yang dihapus dari state machine
 *
 * Aksi itu berlabel "Keluarkan dari pool" tapi yang dilakukannya menyetel status
 * jadi **DITOLAK** — keputusan TENTANG ORANGNYA, dan ia mengendap: namanya tetap
 * di daftar dengan lencana Ditolak, masuk laporan, dan terbaca lagi bertahun
 * kemudian saat ia dicalonkan di kursi lain. Label dan akibatnya tidak pernah
 * sama, dan yang dibaca pengguna labelnya.
 *
 * Penolakan yang sungguhan tetap ada dan tidak disentuh: `VERIFIKASI_TOLAK` dan
 * `TOLAK_PIMPINAN` — keduanya keputusan seseorang atas sebuah nominasi, dan
 * memang layak mengendap.
 *
 * ## Barisnya DIHAPUS, dan riwayatnya tetap ada di jejak audit
 *
 * `nominasi` menunjuk `talent_pool` dengan `ON DELETE CASCADE`, jadi mengeluarkan
 * orang yang pernah dinominasikan ikut membuang baris nominasi & approval-nya.
 * Yang TIDAK ikut hilang: `audit_log`, yang merekam tiap transisi beserta
 * `data_sebelum` — jadi "siapa memutuskan apa" tetap bisa ditelusuri, dan
 * penghapusannya sendiri bisa dibalik.
 *
 * Karena itu jumlah nominasi yang ikut terbuang DISEBUTKAN di pesan
 * konfirmasinya, bukan dihapus diam-diam.
 */
export async function keluarkanDariPool(talentPoolId: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_KELOLA_POOL)
  if (tolak) return tolak

  const idPool = idPositif.safeParse(talentPoolId)
  if (!idPool.success) return gagal('Entri talent pool tidak dikenali.')

  const entri = await ambilEntriPool(idPool.data)
  if (entri === null) return gagal('Entri talent pool itu tidak ada.')

  /*
    Suksesor yang SUDAH DITETAPKAN tidak boleh dikeluarkan begitu saja — itu
    membatalkan keputusan Pimpinan lewat pintu belakang, tanpa melewati
    `BATALKAN_PENETAPAN` yang menuntut catatan dan mencatat pembatalannya.
  */
  if (entri.status === 'DITETAPKAN') {
    return gagal(
      `${entri.nama} sudah ditetapkan sebagai suksesor. Batalkan penetapannya dulu lewat aksi pada barisnya, baru keluarkan dari pool.`,
    )
  }

  const nom = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM nominasi WHERE talent_pool_id = ?`,
    [idPool.data],
  )
  const jumlahNominasi = Number(nom?.n ?? 0)

  await jalankanMutasi({
    entitas: 'talent_pool',
    aksi: 'HAPUS',
    peranDiizinkan: PERAN_KELOLA_POOL,
    sebelum: () => kueriSatu(`SELECT * FROM talent_pool WHERE id = ?`, [idPool.data]),
    jalankan: async () => {
      await eksekusi(`DELETE FROM talent_pool WHERE id = ?`, [idPool.data])
      return { entitasId: idPool.data, sesudah: null }
    },
  })

  segarkan(entri.jabatanTargetId)
  return berhasil(
    undefined,
    `${entri.nama} dikeluarkan dari pool — tanpa catatan penolakan, dan ia kembali muncul di daftar kandidat yang lolos syarat.` +
      (jumlahNominasi > 0
        ? ` ${jumlahNominasi} baris nominasi ikut terbuang; riwayat keputusannya tetap ada di jejak audit.`
        : ''),
  )
}

/**
 * Simpan rencana pengembangan — untuk suksesor ATAU untuk pegawai mana pun.
 *
 * Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 5): pegawai
 * di luar talent pool juga harus bisa diberi rekomendasi pengembangan. Sampai
 * `doc/sql/029`, yang mengunci bukan halaman ini melainkan skemanya —
 * `talent_pool_id` NOT NULL, jadi 142 dari 146 pegawai tidak punya tempat untuk
 * menyimpan satu baris rencana pun.
 *
 * ## Gerbang "harus DITETAPKAN" TETAP berlaku untuk jalur pool, dan hanya di situ
 *
 * Aturannya (PRD §6.6) menjawab pertanyaan yang spesifik: jangan menjanjikan
 * pengembangan untuk sebuah KURSI kepada orang yang pencalonannya belum diputuskan.
 * Rencana umum tidak menjanjikan kursi apa pun, jadi aturan itu tidak berlaku di
 * sana — dan menerapkannya juga akan mengembalikan kuncian yang justru sedang
 * dibuka. Yang membedakan keduanya bukan longgar-ketat melainkan **apa yang
 * dijanjikan**.
 *
 * Jalur pegawai dibatasi `pegawaiTerjangkau()`, penjaga lingkup unit yang sama
 * dengan seluruh jalur tulis profil — Pengelola Unit tidak bisa menyusun rencana
 * untuk pegawai unit lain, dan yang di luar lingkup dijawab "tidak ada", bukan
 * "akses ditolak".
 */
export async function simpanRencana(
  sasaran: SasaranRencana,
  rencanaId: unknown,
  masukan: unknown,
): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_RENCANA)
  if (tolak) return tolak

  const idRencana = rencanaId === null ? null : idPositif.safeParse(rencanaId)
  if (idRencana !== null && !idRencana.success) return gagal('Rencana tidak dikenali.')

  const urai = SkemaRencana.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const idPool = sasaran?.talentPoolId == null ? null : idPositif.safeParse(sasaran.talentPoolId)
  if (idPool !== null && !idPool.success) return gagal('Entri talent pool tidak dikenali.')

  let pegawaiId: number
  let jabatanTargetId: number | null = null

  if (idPool !== null) {
    const entri = await ambilEntriPool(idPool.data)
    if (entri === null) return gagal('Entri talent pool itu tidak ada.')
    // Rencana pengembangan untuk sebuah KURSI hanya bermakna bagi suksesor yang
    // sudah ditetapkan (PRD §6.6). Membuatnya untuk kandidat biasa akan
    // menjanjikan pengembangan kepada orang yang belum diputuskan.
    if (idRencana === null && entri.status !== 'DITETAPKAN') {
      return gagal(
        `Rencana pengembangan untuk jabatan target hanya bisa dibuat untuk suksesor yang sudah DITETAPKAN. ${entri.nama} berstatus ${entri.status}. Rencana pengembangan umum tetap bisa dibuat dari daftar semua pegawai.`,
      )
    }
    pegawaiId = entri.pegawaiId
    jabatanTargetId = entri.jabatanTargetId
  } else {
    const idPegawai = sasaran?.pegawaiId == null ? null : idPositif.safeParse(sasaran.pegawaiId)
    if (idPegawai === null || !idPegawai.success) {
      return gagal('Rencana ini belum punya pemilik — pilih pegawainya lebih dulu.')
    }
    const orang = await pegawaiTerjangkau(idPegawai.data)
    if (orang === null) return gagal('Pegawai itu tidak ada.')
    pegawaiId = orang.id
  }

  const idContoh =
    sasaran?.dicontohDariPegawaiId == null
      ? null
      : idPositif.safeParse(sasaran.dicontohDariPegawaiId)
  if (idContoh !== null && !idContoh.success) return gagal('Suksesor contoh tidak dikenali.')

  const pengguna = await getCurrentUser()

  const hasil = await jalankanMutasi({
    entitas: 'rencana_pengembangan',
    aksi: idRencana === null ? 'BUAT' : 'UBAH',
    peranDiizinkan: PERAN_RENCANA,
    sebelum:
      idRencana === null
        ? undefined
        : () =>
            kueriSatu(
              `SELECT id, jenis_pengembangan, deskripsi, target_selesai, status
               FROM rencana_pengembangan WHERE id = ?`,
              [idRencana.data],
            ),
    jalankan: async () => {
      if (idRencana === null) {
        const { insertId } = await eksekusi(
          `INSERT INTO rencana_pengembangan
             (pegawai_id, talent_pool_id, dicontoh_dari_pegawai_id,
              jenis_pengembangan, deskripsi, target_selesai, status, dibuat_oleh)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            pegawaiId,
            idPool === null ? null : idPool.data,
            idContoh === null ? null : idContoh.data,
            d.jenisPengembangan,
            d.deskripsi,
            d.targetSelesai,
            d.status,
            pengguna?.id ?? null,
          ],
        )
        return { entitasId: insertId, sesudah: { id: insertId, ...d } }
      }
      /*
        Dikunci `id` + `pegawai_id`, bukan `id` + `talent_pool_id`. Sejak
        `doc/sql/029` kolom pool boleh NULL, dan `talent_pool_id = NULL` tidak
        pernah cocok dengan apa pun di SQL — `UPDATE` untuk rencana umum akan
        menyentuh NOL baris, melapor berhasil, dan tidak mengubah apa-apa.
      */
      await eksekusi(
        `UPDATE rencana_pengembangan
         SET jenis_pengembangan = ?, deskripsi = ?, target_selesai = ?, status = ?
         WHERE id = ? AND pegawai_id = ?`,
        [
          d.jenisPengembangan,
          d.deskripsi,
          d.targetSelesai,
          d.status,
          idRencana.data,
          pegawaiId,
        ],
      )
      return { entitasId: idRencana.data, sesudah: { id: idRencana.data, ...d } }
    },
  })

  if (jabatanTargetId !== null) segarkan(jabatanTargetId)
  revalidatePath('/rencana-pengembangan')
  return berhasil({ id: hasil.entitasId ?? 0 }, `Rencana ${d.jenisPengembangan.toLowerCase()} disimpan.`)
}

export async function hapusRencana(rencanaId: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_RENCANA)
  if (tolak) return tolak

  const idRencana = idPositif.safeParse(rencanaId)
  if (!idRencana.success) return gagal('Rencana tidak dikenali.')

  const isi = await kueriSatu<{ status: string; jenis_pengembangan: string }>(
    `SELECT status, jenis_pengembangan FROM rencana_pengembangan WHERE id = ?`,
    [idRencana.data],
  )
  if (isi === null) return gagal('Rencana itu tidak ada.')
  if (isi.status === 'SELESAI') {
    return gagal(
      'Rencana yang sudah SELESAI tidak dihapus — ia jadi rekam jejak pengembangan suksesor. Kalau isinya salah, betulkan deskripsinya.',
    )
  }

  await jalankanMutasi({
    entitas: 'rencana_pengembangan',
    aksi: 'HAPUS',
    peranDiizinkan: PERAN_RENCANA,
    sebelum: () =>
      kueriSatu(
        `SELECT id, talent_pool_id, jenis_pengembangan, deskripsi, status
         FROM rencana_pengembangan WHERE id = ?`,
        [idRencana.data],
      ),
    jalankan: async () => {
      await eksekusi(`DELETE FROM rencana_pengembangan WHERE id = ?`, [idRencana.data])
      return { entitasId: idRencana.data, sesudah: null }
    },
  })

  segarkan()
  return berhasil(undefined, 'Rencana dihapus.')
}

// ---------------------------------------------------------------------------
// Notifikasi
// ---------------------------------------------------------------------------

export async function tandaiNotifikasiDibaca(id: unknown): Promise<HasilAksi<void>> {
  const idNotif = idPositif.safeParse(id)
  if (!idNotif.success) return gagal('Notifikasi tidak dikenali.')

  const pengguna = await getCurrentUser()
  if (pengguna === null) return gagal('Perlu masuk sebagai pengguna.')

  // Dibatasi ke notifikasi milik pengguna sendiri — tanpa itu, id dari klien
  // bisa dipakai menandai kotak masuk orang lain.
  await eksekusi(
    `UPDATE notifikasi SET dibaca_pada = NOW() WHERE id = ? AND user_id = ? AND dibaca_pada IS NULL`,
    [idNotif.data, pengguna.id],
  )
  revalidatePath('/inbox')
  revalidatePath('/')
  return berhasil(undefined)
}

export async function tandaiSemuaDibaca(): Promise<HasilAksi<{ jumlah: number }>> {
  const pengguna = await getCurrentUser()
  if (pengguna === null) return gagal('Perlu masuk sebagai pengguna.')

  const { affectedRows } = await eksekusi(
    `UPDATE notifikasi SET dibaca_pada = NOW() WHERE user_id = ? AND dibaca_pada IS NULL`,
    [pengguna.id],
  )
  revalidatePath('/inbox')
  revalidatePath('/')
  return berhasil(
    { jumlah: affectedRows },
    affectedRows === 0 ? 'Tidak ada notifikasi baru.' : `${affectedRows} notifikasi ditandai terbaca.`,
  )
}
