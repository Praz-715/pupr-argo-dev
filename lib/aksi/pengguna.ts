'use server'

import { randomInt } from 'node:crypto'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { jalankanMutasi } from '../audit'
import { getCurrentUser } from '../auth'
import { eksekusi, kueriSatu } from '../db'
import { SEMUA_PERAN } from '../peran'
import { hashSandi, periksaKebijakanSandi } from '../sandi'
import { cabutSesiPengguna } from '../sesi'
import { gerbangPeran } from './gerbang'
import { berhasil, gagal, galatDariZod, pesanDariGalatDb, type HasilAksi } from './hasil'

/**
 * Manajemen Pengguna & Peran (PRD §6.10) — hanya Super Admin.
 *
 * Tiga aturan yang mengikat seluruh berkas ini:
 *
 * 1. **Wewenang yang berubah harus memutus sesi yang sedang berjalan.** Peran
 *    dan unit ikut termuat ke dalam sesi saat dibaca; menurunkan peran
 *    seseorang tanpa mencabut sesinya berarti wewenang lamanya masih menempel
 *    sampai ia kebetulan keluar sendiri. Itu bukan penundaan kecil — itu
 *    tepatnya keadaan yang ingin dihentikan orang yang menekan tombolnya.
 * 2. **Sistem tidak boleh bisa mengunci dirinya sendiri.** Super Admin aktif
 *    terakhir tidak bisa dinonaktifkan atau diturunkan perannya, oleh siapa
 *    pun termasuk dirinya sendiri. Tanpa penjaga ini, satu klik yang wajar
 *    membuat Manajemen Pengguna tidak bisa dibuka siapa pun lagi — dan
 *    pemulihannya hanya lewat SQL langsung ke produksi.
 * 3. **Sandi sementara ditampilkan tepat sekali.** Ia tidak disimpan dalam
 *    bentuk terbaca di mana pun, tidak masuk `audit_log`, dan tidak bisa
 *    dilihat ulang. Sandi yang bisa dilihat kapan saja oleh Super Admin adalah
 *    sandi yang tidak pernah benar-benar jadi milik penggunanya.
 */

const PERAN_ADMIN = ['Super Admin'] as const

const SkemaPengguna = z.object({
  nama: z.string().trim().min(3, 'Nama minimal 3 karakter').max(150),
  email: z.email('Format email tidak valid').max(150),
  username: z
    .string()
    .trim()
    .min(3, 'Username minimal 3 karakter')
    .max(60)
    .regex(/^[a-z0-9._-]+$/, 'Username hanya boleh huruf kecil, angka, titik, garis bawah, strip'),
  roleId: z.number().int().positive('Peran wajib dipilih'),
  unitOrganisasiId: z.number().int().positive().nullable(),
})

export type MasukanPengguna = z.infer<typeof SkemaPengguna>

/**
 * Sandi sementara yang bisa didiktekan lewat telepon.
 *
 * Alfabetnya membuang karakter yang tertukar saat dibacakan (`O`/`0`, `l`/`1`,
 * `I`) — sandi sementara yang salah ketik karena ambigu akan menghabiskan
 * percobaan masuk dan berujung akun terkunci. Bentuk `xxxx-xxxx-xx` memenuhi
 * kebijakan (≥10 karakter, dua jenis karakter) dengan sendirinya.
 */
function sandiSementara(): string {
  const alfabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  const ambil = (n: number) =>
    Array.from({ length: n }, () => alfabet[randomInt(alfabet.length)]).join('')
  return `${ambil(4)}-${ambil(4)}-${ambil(2)}`
}

async function bacaPengguna(id: number) {
  return kueriSatu<Record<string, unknown>>(
    `SELECT u.id, u.nama, u.email, u.username, u.role_id, r.nama_role, u.unit_organisasi_id,
            u.status_aktif, u.harus_ganti_sandi
     FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = ?`,
    [id],
  )
}

/**
 * Apakah pengguna ini Super Admin aktif TERAKHIR?
 *
 * Dihitung di SQL setiap kali, bukan di-cache: dua Super Admin yang saling
 * menonaktifkan pada saat yang sama akan sama-sama lolos kalau jawabannya
 * berasal dari pembacaan yang lebih tua.
 */
async function superAdminTerakhir(userId: number): Promise<boolean> {
  const r = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id
     WHERE r.nama_role = 'Super Admin' AND u.status_aktif = 1 AND u.id <> ?`,
    [userId],
  )
  const iniSuperAdmin = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM users u JOIN roles r ON r.id = u.role_id
     WHERE u.id = ? AND r.nama_role = 'Super Admin' AND u.status_aktif = 1`,
    [userId],
  )
  return Number(iniSuperAdmin?.n ?? 0) === 1 && Number(r?.n ?? 0) === 0
}

export async function buatPengguna(
  masukan: unknown,
): Promise<HasilAksi<{ id: number; sandiSementara: string }>> {
  const tolak = await gerbangPeran(PERAN_ADMIN)
  if (tolak) return tolak

  const urai = SkemaPengguna.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const peran = await kueriSatu<{ nama_role: string }>('SELECT nama_role FROM roles WHERE id = ?', [
    d.roleId,
  ])
  if (!peran) return gagal('Peran tidak dikenali.', { roleId: 'Peran tidak dikenali.' })

  const pelanggaranUnit = periksaUnitPeran(peran.nama_role, d.unitOrganisasiId)
  if (pelanggaranUnit) return gagal(pelanggaranUnit, { unitOrganisasiId: pelanggaranUnit })

  const sandi = sandiSementara()
  const pelanggaran = periksaKebijakanSandi(sandi, { username: d.username, email: d.email })
  if (pelanggaran) {
    // Praktis tidak mungkin (sandinya dibangkitkan sistem), tapi kalau sampai
    // terjadi ia harus berhenti di sini — bukan menghasilkan akun yang tidak
    // bisa mengganti sandinya sendiri karena sandi barunya ditolak kebijakan.
    return gagal(`Sandi sementara gagal memenuhi kebijakan: ${pelanggaran}`)
  }
  const hash = await hashSandi(sandi)

  try {
    const hasil = await jalankanMutasi({
      entitas: 'users',
      aksi: 'BUAT',
      peranDiizinkan: PERAN_ADMIN,
      jalankan: async () => {
        const { insertId } = await eksekusi(
          `INSERT INTO users
             (nama, email, username, password_hash, harus_ganti_sandi, password_diubah_pada,
              role_id, unit_organisasi_id, status_aktif)
           VALUES (?, ?, ?, ?, 1, NOW(), ?, ?, 1)`,
          [d.nama, d.email, d.username, hash, d.roleId, d.unitOrganisasiId],
        )
        return {
          entitasId: insertId,
          // Sandi TIDAK masuk audit — lihat aturan 3 di kepala berkas.
          sesudah: {
            nama: d.nama,
            email: d.email,
            username: d.username,
            peran: peran.nama_role,
            unit_organisasi_id: d.unitOrganisasiId,
            status_aktif: 1,
            harus_ganti_sandi: 1,
          },
        }
      },
    })

    revalidatePath('/admin/pengguna')
    return berhasil(
      { id: hasil.entitasId ?? 0, sandiSementara: sandi },
      `Pengguna ${d.nama} dibuat.`,
    )
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: 'Username/email' })
    if (pesan) return gagal(pesan)
    throw e
  }
}

export async function ubahPengguna(id: number, masukan: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_ADMIN)
  if (tolak) return tolak

  const urai = SkemaPengguna.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const lama = await bacaPengguna(id)
  if (!lama) return gagal('Pengguna tidak ditemukan.')

  const peranBaru = await kueriSatu<{ nama_role: string }>(
    'SELECT nama_role FROM roles WHERE id = ?',
    [d.roleId],
  )
  if (!peranBaru) return gagal('Peran tidak dikenali.', { roleId: 'Peran tidak dikenali.' })

  const pelanggaranUnit = periksaUnitPeran(peranBaru.nama_role, d.unitOrganisasiId)
  if (pelanggaranUnit) return gagal(pelanggaranUnit, { unitOrganisasiId: pelanggaranUnit })

  const turunDariSuperAdmin =
    String(lama.nama_role) === 'Super Admin' && peranBaru.nama_role !== 'Super Admin'
  if (turunDariSuperAdmin && (await superAdminTerakhir(id))) {
    return gagal(
      'Ini satu-satunya Super Admin yang aktif. Menurunkan perannya membuat Manajemen Pengguna tidak bisa dibuka siapa pun. Angkat Super Admin lain lebih dulu.',
      { roleId: 'Super Admin aktif terakhir.' },
    )
  }

  const wewenangBerubah =
    Number(lama.role_id) !== d.roleId ||
    (lama.unit_organisasi_id === null ? null : Number(lama.unit_organisasi_id)) !==
      d.unitOrganisasiId

  try {
    await jalankanMutasi({
      entitas: 'users',
      aksi: 'UBAH',
      peranDiizinkan: PERAN_ADMIN,
      sebelum: async () => ringkas(lama),
      jalankan: async () => {
        await eksekusi(
          `UPDATE users SET nama = ?, email = ?, username = ?, role_id = ?, unit_organisasi_id = ?
           WHERE id = ?`,
          [d.nama, d.email, d.username, d.roleId, d.unitOrganisasiId, id],
        )
        return { entitasId: id, sesudah: ringkas(await bacaPengguna(id)) }
      },
    })
  } catch (e) {
    const pesan = pesanDariGalatDb(e, { unik: 'Username/email' })
    if (pesan) return gagal(pesan)
    throw e
  }

  let catatan = ''
  if (wewenangBerubah) {
    const n = await cabutSesiPengguna(id)
    if (n > 0) catatan = ` ${n} sesi aktifnya diputus supaya wewenang lama tidak ikut terbawa.`
  }

  revalidatePath('/admin/pengguna')
  return berhasil(undefined, `Pengguna ${d.nama} diperbarui.${catatan}`)
}

export async function ubahStatusPengguna(id: number, aktif: boolean): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_ADMIN)
  if (tolak) return tolak

  const saya = await getCurrentUser()
  const lama = await bacaPengguna(id)
  if (!lama) return gagal('Pengguna tidak ditemukan.')

  if (!aktif) {
    if (saya?.id === id) {
      return gagal(
        'Anda tidak bisa menonaktifkan akun Anda sendiri — Anda akan langsung terkunci di luar. Minta Super Admin lain melakukannya.',
      )
    }
    if (await superAdminTerakhir(id)) {
      return gagal(
        'Ini satu-satunya Super Admin yang aktif. Menonaktifkannya membuat tidak ada lagi yang bisa mengelola pengguna. Angkat Super Admin lain lebih dulu.',
      )
    }
  }

  await jalankanMutasi({
    entitas: 'users',
    aksi: 'UBAH_STATUS',
    peranDiizinkan: PERAN_ADMIN,
    sebelum: async () => ringkas(lama),
    jalankan: async () => {
      await eksekusi('UPDATE users SET status_aktif = ? WHERE id = ?', [aktif ? 1 : 0, id])
      return { entitasId: id, sesudah: ringkas(await bacaPengguna(id)) }
    },
  })

  // Menonaktifkan akun tanpa memutus sesinya hanya mencegah login BERIKUTNYA.
  // Yang sedang membuka aplikasi saat tombol ditekan tetap bekerja seperti biasa.
  const dicabut = aktif ? 0 : await cabutSesiPengguna(id)

  revalidatePath('/admin/pengguna')
  return berhasil(
    undefined,
    aktif
      ? `${String(lama.nama)} diaktifkan kembali.`
      : `${String(lama.nama)} dinonaktifkan.${dicabut > 0 ? ` ${dicabut} sesi aktif diputus.` : ''}`,
  )
}

/** Atur ulang sandi orang lain. Mengembalikan sandi sementara — satu kali saja. */
export async function resetSandiPengguna(
  id: number,
  permintaanResetId?: number,
): Promise<HasilAksi<{ sandiSementara: string }>> {
  const tolak = await gerbangPeran(PERAN_ADMIN)
  if (tolak) return tolak

  const lama = await bacaPengguna(id)
  if (!lama) return gagal('Pengguna tidak ditemukan.')

  const sandi = sandiSementara()
  const hash = await hashSandi(sandi)

  await jalankanMutasi({
    entitas: 'users',
    aksi: 'UBAH',
    peranDiizinkan: PERAN_ADMIN,
    sebelum: async () => ({ id, sandi_diatur_ulang: false }),
    jalankan: async () => {
      await eksekusi(
        `UPDATE users
         SET password_hash = ?, harus_ganti_sandi = 1, password_diubah_pada = NOW(),
             gagal_masuk_beruntun = 0, terkunci_sampai = NULL
         WHERE id = ?`,
        [hash, id],
      )
      return { entitasId: id, sesudah: { id, sandi_diatur_ulang: true, harus_ganti_sandi: 1 } }
    },
  })

  // Seluruh sesi diputus: sandi lama mungkin dikompromikan, dan itu biasanya
  // justru alasan tombol ini ditekan.
  const dicabut = await cabutSesiPengguna(id)

  if (permintaanResetId) {
    const saya = await getCurrentUser()
    await eksekusi(
      `UPDATE permintaan_reset_password
       SET ditangani_pada = NOW(), ditangani_oleh = ?, catatan = 'Sandi sementara diterbitkan'
       WHERE id = ? AND ditangani_pada IS NULL`,
      [saya?.id ?? null, permintaanResetId],
    )
  }

  revalidatePath('/admin/pengguna')
  return berhasil(
    { sandiSementara: sandi },
    `Sandi ${String(lama.nama)} diatur ulang.${dicabut > 0 ? ` ${dicabut} sesi diputus.` : ''}`,
  )
}

/** Buka kunci akun yang terkena penghambat tebak-sandi. */
export async function bukaKunciPengguna(id: number): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_ADMIN)
  if (tolak) return tolak

  const lama = await bacaPengguna(id)
  if (!lama) return gagal('Pengguna tidak ditemukan.')

  await jalankanMutasi({
    entitas: 'users',
    aksi: 'UBAH_STATUS',
    peranDiizinkan: PERAN_ADMIN,
    sebelum: async () => ({ id, terkunci: true }),
    jalankan: async () => {
      await eksekusi(
        'UPDATE users SET gagal_masuk_beruntun = 0, terkunci_sampai = NULL WHERE id = ?',
        [id],
      )
      return { entitasId: id, sesudah: { id, terkunci: false } }
    },
  })

  revalidatePath('/admin/pengguna')
  return berhasil(undefined, `Kunci akun ${String(lama.nama)} dibuka.`)
}

/** Tandai permintaan reset sudah ditangani di luar aplikasi (mis. ditelepon langsung). */
export async function tandaiResetDitangani(
  permintaanId: number,
  catatan: string,
): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_ADMIN)
  if (tolak) return tolak

  const saya = await getCurrentUser()
  if (!saya || saya.peran !== 'Super Admin') return gagal('Hanya Super Admin.')
  if (catatan.trim().length < 3) {
    return gagal('Tulis bagaimana permintaan ini ditangani.', {
      catatan: 'Minimal 3 karakter.',
    })
  }

  const { affectedRows } = await eksekusi(
    `UPDATE permintaan_reset_password
     SET ditangani_pada = NOW(), ditangani_oleh = ?, catatan = ?
     WHERE id = ? AND ditangani_pada IS NULL`,
    [saya.id, catatan.trim().slice(0, 255), permintaanId],
  )
  if (affectedRows === 0) return gagal('Permintaan itu sudah ditangani.')

  revalidatePath('/admin/pengguna')
  return berhasil(undefined, 'Permintaan ditandai selesai.')
}

/**
 * Peran yang datanya dibatasi per unit WAJIB punya unit.
 *
 * Tanpa aturan ini, `lingkupData()` akan mengembalikan NIHIL dan penggunanya
 * melihat aplikasi yang kosong sama sekali tanpa tahu sebabnya. Ditangkap di
 * sini, saat akunnya dibuat, bukan nanti saat pemiliknya kebingungan.
 */
function periksaUnitPeran(namaPeran: string, unitId: number | null): string | null {
  if (namaPeran === 'Pengelola Unit' && unitId === null) {
    return 'Pengelola Unit wajib ditautkan ke satu unit organisasi — tanpa itu ia tidak akan melihat data apa pun.'
  }
  if (!(SEMUA_PERAN as readonly string[]).includes(namaPeran)) {
    return `Peran "${namaPeran}" ada di database tapi tidak dikenali aplikasi. Perbaiki tabel roles lebih dulu.`
  }
  return null
}

/** Bentuk ringkas untuk `audit_log` — tanpa `password_hash`, apa pun yang terjadi. */
function ringkas(r: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!r) return null
  return {
    id: r.id,
    nama: r.nama,
    email: r.email,
    username: r.username,
    peran: r.nama_role,
    unit_organisasi_id: r.unit_organisasi_id,
    status_aktif: r.status_aktif,
    harus_ganti_sandi: r.harus_ganti_sandi,
  }
}
