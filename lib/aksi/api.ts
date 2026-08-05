'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { buatTokenApi, hashTokenApi } from '../api/token'
import { ENDPOINT_V1 } from '../api/scope'
import { jalankanMutasi } from '../audit'
import { eksekusi, kueriSatu } from '../db'
import { gerbangPeran } from './gerbang'
import { berhasil, gagal, galatDariZod, pesanDariGalatDb, type HasilAksi } from './hasil'

/**
 * Mutasi Integrasi API Eksternal (Fase 9, PRD §6.9). **Super Admin saja.**
 *
 * Dua hal yang membedakan berkas ini dari mutasi lain:
 *
 * 1. **Token plaintext hanya ada sekali, di kembalian fungsi.** Yang masuk DB
 *    adalah hash-nya, dan ia **tidak pernah** disalin ke `audit_log` — token yang
 *    bisa dibaca ulang kapan saja oleh Super Admin dari jejak audit tidak pernah
 *    benar-benar jadi rahasia klien. Aturan yang sama dipakai sandi sementara di
 *    Fase 7.
 * 2. **`scope_akses` divalidasi terhadap daftar endpoint yang benar-benar ada.**
 *    Scope berisi nama endpoint yang salah tulis akan gagal tertutup di runtime
 *    (klien tidak bisa apa-apa) tanpa satu pun pesan — dan yang mengisinya akan
 *    menyimpulkan API-nya rusak, bukan bahwa ia salah mengetik.
 */

const PERAN_API = ['Super Admin'] as const

const idPositif = z.number().int().positive()

const SkemaKlien = z.object({
  namaInstansi: z
    .string()
    .trim()
    .min(3, 'Nama instansi minimal 3 karakter')
    .max(200, 'Nama instansi maksimal 200 karakter'),
  kodeInstansi: z
    .string()
    .trim()
    .min(2, 'Kode instansi minimal 2 karakter')
    .max(40, 'Kode instansi maksimal 40 karakter')
    .regex(/^[A-Za-z0-9._-]+$/, 'Kode hanya boleh huruf, angka, titik, garis, underscore'),
  contactPerson: z.string().trim().max(150).nullable(),
  email: z.string().trim().email('Email tidak valid').max(150).nullable(),
  noMou: z.string().trim().max(100).nullable(),
  status: z.enum(['AKTIF', 'NONAKTIF', 'PENDING']),
  endpoints: z.array(z.enum(ENDPOINT_V1)),
  dataPersonal: z.boolean(),
})

export type MasukanKlienApi = z.infer<typeof SkemaKlien>

/**
 * Dasar hukum wajib ada sebelum klien boleh AKTIF.
 *
 * PRD §7.1 & §7.3 menyandarkan seluruh pembagian data pada MoU/PKS. Klien AKTIF
 * tanpa `no_mou` berarti data ASN mengalir keluar tanpa dasar hukum tercatat — dan
 * itu tidak akan terlihat di halaman mana pun, karena semuanya berfungsi normal.
 * Aturan yang sama berlaku lebih keras untuk `data_personal`.
 */
function periksaDasarHukum(d: MasukanKlienApi): string | null {
  if (d.status !== 'AKTIF') return null
  if (!d.noMou || d.noMou.trim() === '') {
    return 'Klien tidak bisa berstatus AKTIF tanpa nomor MoU/PKS. Dasar hukum berbagi data ASN wajib tercatat (PRD §7.3, UU PDP No. 27/2022).'
  }
  if (d.dataPersonal && d.endpoints.length === 0) {
    return 'Scope "data personal" diberikan tapi tidak ada endpoint yang diizinkan — klien ini tidak akan bisa memanggil apa pun. Pilih endpoint-nya, atau cabut scope data personal.'
  }
  return null
}

function scopeJson(d: MasukanKlienApi): string {
  return JSON.stringify({ endpoints: d.endpoints, data_personal: d.dataPersonal })
}

export async function buatKlienApi(masukan: unknown): Promise<HasilAksi<{ id: number }>> {
  const tolak = await gerbangPeran(PERAN_API)
  if (tolak) return tolak

  const urai = SkemaKlien.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const masalah = periksaDasarHukum(d)
  if (masalah) return gagal(masalah, { noMou: masalah })

  try {
    const hasil = await jalankanMutasi({
      entitas: 'api_client',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_API,
      jalankan: async () => {
        const { insertId } = await eksekusi(
          `INSERT INTO api_client
             (nama_instansi, kode_instansi, contact_person, email, no_mou, status, scope_akses)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            d.namaInstansi,
            d.kodeInstansi,
            d.contactPerson,
            d.email,
            d.noMou,
            d.status,
            scopeJson(d),
          ],
        )
        return { entitasId: insertId, sesudah: { id: insertId, ...d } }
      },
    })
    revalidatePath('/admin/api')
    return berhasil({ id: hasil.entitasId ?? 0 }, `Klien "${d.namaInstansi}" ditambahkan.`)
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Kode instansi "${d.kodeInstansi}"` })
    if (pesan) return gagal(pesan, { kodeInstansi: pesan })
    throw e
  }
}

export async function ubahKlienApi(id: unknown, masukan: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_API)
  if (tolak) return tolak

  const idKlien = idPositif.safeParse(id)
  if (!idKlien.success) return gagal('Klien tidak dikenali.')

  const urai = SkemaKlien.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const masalah = periksaDasarHukum(d)
  if (masalah) return gagal(masalah, { noMou: masalah })

  const lama = await bacaKlien(idKlien.data)
  if (!lama) return gagal('Klien itu tidak ada.')

  try {
    await jalankanMutasi({
      entitas: 'api_client',
      aksi: 'UBAH',
      peranDiizinkan: PERAN_API,
      sebelum: async () => lama,
      jalankan: async () => {
        await eksekusi(
          `UPDATE api_client
              SET nama_instansi = ?, kode_instansi = ?, contact_person = ?, email = ?,
                  no_mou = ?, status = ?, scope_akses = ?
            WHERE id = ?`,
          [
            d.namaInstansi,
            d.kodeInstansi,
            d.contactPerson,
            d.email,
            d.noMou,
            d.status,
            scopeJson(d),
            idKlien.data,
          ],
        )
        return { entitasId: idKlien.data, sesudah: await bacaKlien(idKlien.data) }
      },
    })
    revalidatePath('/admin/api')
    return berhasil(undefined, `Klien "${d.namaInstansi}" diperbarui.`)
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: `Kode instansi "${d.kodeInstansi}"` })
    if (pesan) return gagal(pesan, { kodeInstansi: pesan })
    throw e
  }
}

async function bacaKlien(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT id, nama_instansi, kode_instansi, contact_person, email, no_mou, status, scope_akses
       FROM api_client WHERE id = ?`,
    [id],
  )
}

const SkemaToken = z.object({
  apiClientId: idPositif,
  label: z
    .string()
    .trim()
    .min(3, 'Label minimal 3 karakter — ia satu-satunya cara membedakan token')
    .max(100, 'Label maksimal 100 karakter'),
  /** Kosong = tanpa tenggat. */
  expiredAt: z.string().trim().nullable(),
})

/**
 * Terbitkan token baru. Plaintext-nya **hanya** ada di kembalian ini.
 *
 * Tidak ada jalur untuk melihatnya lagi — bukan karena belum dibuat, tapi karena
 * tidak boleh ada. Yang tersimpan adalah SHA-256-nya, dan `audit_log` hanya
 * mencatat bahwa token diterbitkan beserta labelnya.
 */
export async function terbitkanTokenApi(
  masukan: unknown,
): Promise<HasilAksi<{ id: number; token: string }>> {
  const tolak = await gerbangPeran(PERAN_API)
  if (tolak) return tolak

  const urai = SkemaToken.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const klien = await kueriSatu<{ nama_instansi: string; status: string; no_mou: string | null }>(
    'SELECT nama_instansi, status, no_mou FROM api_client WHERE id = ?',
    [d.apiClientId],
  )
  if (!klien) return gagal('Klien itu tidak ada.')
  if (String(klien.status) !== 'AKTIF') {
    return gagal(
      `Klien "${String(klien.nama_instansi)}" berstatus ${String(klien.status)}. Token hanya diterbitkan untuk klien AKTIF — token yang terbit lebih dulu akan hidup sebelum dasar hukumnya selesai.`,
    )
  }

  const token = buatTokenApi()
  let idBaru = 0

  await jalankanMutasi({
    entitas: 'api_token',
    aksi: 'BUAT',
    peranDiizinkan: PERAN_API,
    jalankan: async () => {
      const { insertId } = await eksekusi(
        `INSERT INTO api_token (api_client_id, token_hash, label, expired_at, status, created_by)
         VALUES (?, ?, ?, ?, 'AKTIF', ?)`,
        [
          d.apiClientId,
          hashTokenApi(token),
          d.label,
          d.expiredAt === null || d.expiredAt === '' ? null : `${d.expiredAt} 23:59:59`,
          null,
        ],
      )
      idBaru = insertId
      // `sesudah` sengaja TIDAK memuat token maupun hash-nya.
      return {
        entitasId: insertId,
        sesudah: {
          id: insertId,
          apiClientId: d.apiClientId,
          label: d.label,
          expiredAt: d.expiredAt,
        },
      }
    },
  })

  revalidatePath('/admin/api')
  return berhasil(
    { id: idBaru, token },
    'Token diterbitkan. Salin sekarang — ia tidak bisa ditampilkan lagi.',
  )
}

/**
 * Cabut token. **Tidak dihapus** — barisnya jadi jejak siapa pernah punya akses
 * apa, dan `api_activity_log` menunjuk ke sini lewat `api_token_id`.
 */
export async function cabutTokenApi(id: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_API)
  if (tolak) return tolak

  const idToken = idPositif.safeParse(id)
  if (!idToken.success) return gagal('Token tidak dikenali.')

  const lama = await kueriSatu<Record<string, unknown>>(
    `SELECT t.id, t.label, t.status, c.kode_instansi
       FROM api_token t JOIN api_client c ON c.id = t.api_client_id
      WHERE t.id = ?`,
    [idToken.data],
  )
  if (!lama) return gagal('Token itu tidak ada.')
  if (String(lama.status) === 'DICABUT') return gagal('Token itu sudah dicabut.')

  await jalankanMutasi({
    entitas: 'api_token',
    aksi: 'UBAH_STATUS',
    peranDiizinkan: PERAN_API,
    sebelum: async () => lama,
    jalankan: async () => {
      await eksekusi("UPDATE api_token SET status = 'DICABUT' WHERE id = ?", [idToken.data])
      return { entitasId: idToken.data, sesudah: { id: idToken.data, status: 'DICABUT' } }
    },
  })

  revalidatePath('/admin/api')
  return berhasil(
    undefined,
    `Token "${String(lama.label ?? idToken.data)}" dicabut. Pemakaian berikutnya langsung ditolak.`,
  )
}
