import 'server-only'

import { eksekusi, kueri } from './db'
import type { Peran } from './peran'
import { PERAN_GILIRAN, type AksiWorkflow, type Giliran } from './workflow'

/**
 * Notifikasi & Inbox Tugas (usulan U-7).
 *
 * PRD memakai notifikasi sebagai widget tapi tidak punya entitasnya. Tanpa ini,
 * alur approval menggantung: unit mengajukan lalu tidak tahu apa-apa sampai
 * seseorang kebetulan membuka halaman.
 *
 * **Disebar per pengguna saat dibuat**, bukan disimpan sebagai satu baris
 * bertujuan peran. Alasannya `dibaca_pada`: satu baris untuk peran yang dipegang
 * tiga orang akan hilang dari dua orang lain begitu satu orang menandainya
 * terbaca (lihat `doc/sql/011`).
 *
 * **Gagal mengirim notifikasi tidak boleh membatalkan transisi workflow** yang
 * sudah berhasil — sama seperti perlakuan jejak audit. Tapi juga tidak senyap.
 */

export type JenisNotifikasi =
  | 'NOMINASI_MASUK'
  | 'NOMINASI_REVISI'
  | 'NOMINASI_DISETUJUI'
  | 'NOMINASI_DITOLAK'
  | 'MENUNGGU_PENETAPAN'
  | 'SUKSESOR_DITETAPKAN'
  | 'PENETAPAN_DIBATALKAN'

export interface IsiNotifikasi {
  jenis: JenisNotifikasi
  judul: string
  pesan: string
  tautan: string | null
  entitas: string | null
  entitasId: number | null
}

/** Kirim ke setiap pemegang peran tertentu. Mengembalikan jumlah baris terkirim. */
export async function kirimKePeran(
  peran: readonly Peran[],
  isi: IsiNotifikasi,
  dibuatOleh: number | null,
): Promise<number> {
  if (peran.length === 0) return 0
  try {
    const penerima = await kueri<{ id: number; nama_role: string }>(
      `SELECT u.id, r.nama_role FROM users u JOIN roles r ON r.id = u.role_id
       WHERE r.nama_role IN (${peran.map(() => '?').join(', ')}) AND u.status_aktif = 1`,
      [...peran],
    )
    let terkirim = 0
    for (const p of penerima) {
      terkirim += await simpanSatu(Number(p.id), String(p.nama_role), isi, dibuatOleh)
    }
    return terkirim
  } catch (e) {
    console.error('[notifikasi] gagal mengirim ke peran', peran, e)
    return 0
  }
}

/** Kirim ke satu pengguna tertentu (mis. pengaju asli sebuah nominasi). */
export async function kirimKePengguna(
  userId: number | null,
  peranTujuan: string | null,
  isi: IsiNotifikasi,
  dibuatOleh: number | null,
): Promise<number> {
  if (userId === null) return 0
  try {
    return await simpanSatu(userId, peranTujuan, isi, dibuatOleh)
  } catch (e) {
    console.error('[notifikasi] gagal mengirim ke pengguna', userId, e)
    return 0
  }
}

async function simpanSatu(
  userId: number,
  peranTujuan: string | null,
  isi: IsiNotifikasi,
  dibuatOleh: number | null,
): Promise<number> {
  const { affectedRows } = await eksekusi(
    `INSERT INTO notifikasi
       (user_id, peran_tujuan, jenis, judul, pesan, tautan, entitas, entitas_id, dibuat_oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      peranTujuan,
      isi.jenis,
      isi.judul.slice(0, 200),
      isi.pesan,
      isi.tautan,
      isi.entitas,
      isi.entitasId,
      dibuatOleh,
    ],
  )
  return affectedRows
}

export interface KonteksNotifikasi {
  namaKandidat: string
  namaTarget: string
  namaUnitPengaju: string | null
  nominasiId: number | null
  talentPoolId: number
  jabatanTargetId: number
  catatan: string | null
  /** Pengguna yang melakukan aksinya. */
  pelakuId: number | null
  namaPelaku: string
  /** Pengaju asli nominasi — sasaran kabar hasil verifikasi. */
  pengajuUserId: number | null
}

interface Kiriman {
  /** Ditujukan ke pemegang peran ini. */
  peran: readonly Peran[]
  /** Atau ke satu pengguna tertentu. */
  userId: number | null
  isi: IsiNotifikasi
}

/**
 * Siapa yang perlu dikabari setelah satu aksi workflow, dan apa isinya.
 *
 * Aturannya satu kalimat: **kabari giliran berikutnya, dan kabari yang gilirannya
 * baru saja lewat**. Yang pertama supaya pekerjaan tidak menganggur; yang kedua
 * supaya pengaju tahu hasilnya tanpa harus menanyakan.
 *
 * Peran tujuan diambil dari `PERAN_GILIRAN` di `lib/workflow.ts` — bukan ditulis
 * ulang di sini, supaya menambah tahap approval tidak perlu menyunting dua tempat.
 */
export function kirimanUntukAksi(
  aksi: AksiWorkflow,
  giliranBaru: Giliran,
  k: KonteksNotifikasi,
): Kiriman[] {
  const tautanNominasi = k.nominasiId === null ? null : `/nominasi/${k.nominasiId}`
  const tautanPool = `/talent-pool?target=${k.jabatanTargetId}`
  const dasar = { entitas: 'talent_pool', entitasId: k.talentPoolId }

  switch (aksi) {
    case 'AJUKAN':
    case 'AJUKAN_ULANG':
      return [
        {
          peran: PERAN_GILIRAN[giliranBaru],
          userId: null,
          isi: {
            ...dasar,
            jenis: 'NOMINASI_MASUK',
            judul: `Nominasi menunggu verifikasi: ${k.namaKandidat}`,
            pesan:
              `${k.namaUnitPengaju ?? 'Sebuah unit'} mengajukan ${k.namaKandidat} untuk ${k.namaTarget}.` +
              (aksi === 'AJUKAN_ULANG' ? ' Ini pengajuan ulang setelah revisi.' : '') +
              (k.catatan === null ? '' : ` Catatan pengaju: ${k.catatan}`),
            tautan: tautanNominasi,
            entitas: 'nominasi',
            entitasId: k.nominasiId,
          },
        },
      ]

    case 'MINTA_REVISI':
      return [
        {
          peran: [],
          userId: k.pengajuUserId,
          isi: {
            ...dasar,
            jenis: 'NOMINASI_REVISI',
            judul: `Nominasi perlu direvisi: ${k.namaKandidat}`,
            pesan: `${k.namaPelaku} meminta revisi. ${k.catatan ?? ''}`.trim(),
            tautan: tautanNominasi,
            entitas: 'nominasi',
            entitasId: k.nominasiId,
          },
        },
      ]

    case 'VERIFIKASI_SETUJU':
      return [
        {
          peran: PERAN_GILIRAN.PIMPINAN,
          userId: null,
          isi: {
            ...dasar,
            jenis: 'MENUNGGU_PENETAPAN',
            judul: `Menunggu penetapan: ${k.namaKandidat}`,
            pesan: `${k.namaKandidat} lolos Verifikasi Kepegawaian untuk ${k.namaTarget} dan menunggu keputusan penetapan sebagai suksesor.`,
            tautan: tautanPool,
          },
        },
        {
          peran: [],
          userId: k.pengajuUserId,
          isi: {
            ...dasar,
            jenis: 'NOMINASI_DISETUJUI',
            judul: `Nominasi lolos verifikasi: ${k.namaKandidat}`,
            pesan: `Nominasi ${k.namaKandidat} untuk ${k.namaTarget} lolos Verifikasi Kepegawaian dan diteruskan ke Pimpinan.`,
            tautan: tautanNominasi,
            entitas: 'nominasi',
            entitasId: k.nominasiId,
          },
        },
      ]

    case 'VERIFIKASI_TOLAK':
    case 'TOLAK_PIMPINAN':
      return [
        {
          peran: [],
          userId: k.pengajuUserId,
          isi: {
            ...dasar,
            jenis: 'NOMINASI_DITOLAK',
            judul: `Nominasi ditolak: ${k.namaKandidat}`,
            pesan:
              `Nominasi ${k.namaKandidat} untuk ${k.namaTarget} ditolak pada tahap ` +
              `${aksi === 'VERIFIKASI_TOLAK' ? 'Verifikasi Kepegawaian' : 'Persetujuan Pimpinan'}. ` +
              `Alasan: ${k.catatan ?? 'tidak dicantumkan'}`,
            tautan: tautanNominasi,
            entitas: 'nominasi',
            entitasId: k.nominasiId,
          },
        },
      ]

    case 'TETAPKAN':
      return [
        {
          peran: ['Admin Talenta'],
          userId: null,
          isi: {
            ...dasar,
            jenis: 'SUKSESOR_DITETAPKAN',
            judul: `Suksesor ditetapkan: ${k.namaKandidat}`,
            pesan: `${k.namaKandidat} ditetapkan sebagai suksesor ${k.namaTarget} oleh ${k.namaPelaku}. Rencana pengembangannya bisa disusun sekarang.`,
            tautan: `/rencana-pengembangan?pool=${k.talentPoolId}`,
          },
        },
        {
          peran: [],
          userId: k.pengajuUserId,
          isi: {
            ...dasar,
            jenis: 'SUKSESOR_DITETAPKAN',
            judul: `Kandidat unit Anda ditetapkan: ${k.namaKandidat}`,
            pesan: `${k.namaKandidat} ditetapkan sebagai suksesor ${k.namaTarget}.`,
            tautan: tautanPool,
          },
        },
      ]

    case 'BATALKAN_PENETAPAN':
      return [
        {
          peran: ['Admin Talenta'],
          userId: null,
          isi: {
            ...dasar,
            jenis: 'PENETAPAN_DIBATALKAN',
            judul: `Penetapan dibatalkan: ${k.namaKandidat}`,
            pesan: `${k.namaPelaku} membatalkan penetapan ${k.namaKandidat} sebagai suksesor ${k.namaTarget}. Alasan: ${k.catatan ?? 'tidak dicantumkan'}. Rencana pengembangan yang sudah ada tidak dihapus.`,
            tautan: tautanPool,
          },
        },
      ]

    // Aksi khusus talent pool tidak melibatkan pihak lain yang perlu dikabari.
    case 'TOLAK_KANDIDAT':
    case 'PULIHKAN_KANDIDAT':
      return []
  }
}

export async function kirimSemua(
  kiriman: Kiriman[],
  dibuatOleh: number | null,
): Promise<number> {
  let total = 0
  for (const k of kiriman) {
    total +=
      k.userId !== null
        ? await kirimKePengguna(k.userId, k.isi.jenis === 'NOMINASI_MASUK' ? null : 'Pengelola Unit', k.isi, dibuatOleh)
        : await kirimKePeran(k.peran, k.isi, dibuatOleh)
  }
  return total
}
