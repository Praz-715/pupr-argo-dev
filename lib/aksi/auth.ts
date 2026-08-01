'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'

import { catatPeristiwaAuth } from '../audit'
import { getCurrentUser, RUTE_GANTI_SANDI } from '../auth'
import { eksekusi, kueriSatu } from '../db'
import { ambilPengaturan } from '../pengaturan'
import { cocokkanSandi, hashSandi, periksaKebijakanSandi } from '../sandi'
import { akhiriSesi, bacaSesi, bersihkanSesiMati, buatSesi, cabutSesiPengguna } from '../sesi'
import { berhasil, gagal, galatDariZod, type HasilAksi } from './hasil'

/**
 * Autentikasi: masuk, keluar, ganti sandi, permintaan reset.
 *
 * **Aturan yang mengikat seluruh berkas ini: balasan gagal tidak boleh
 * membedakan sebabnya.** "Akun tidak ditemukan" dan "sandi salah" harus
 * terlihat sama dari luar, kalau tidak formulir masuk berubah jadi alat
 * memeriksa siapa saja yang punya akun di sistem kepegawaian. Itu juga sebabnya
 * `cocokkanSandi()` tetap menghitung hash walau penggunanya tidak ada — supaya
 * lamanya balasan tidak menjawab pertanyaan yang teksnya tolak untuk jawab.
 *
 * Satu pengecualian yang disengaja: akun **terkunci** diberi tahu apa adanya.
 * Keadaan itu hanya tercapai setelah beberapa kali gagal berturut-turut, jadi
 * yang mencapainya sudah tahu akun itu ada; menyembunyikannya cuma membuat
 * pemiliknya yang sah kebingungan kenapa sandinya "tiba-tiba salah".
 */

const PESAN_GAGAL_UMUM = 'Username/email atau sandi tidak cocok.'

const SkemaMasuk = z.object({
  identitas: z.string().trim().min(1, 'Isi username atau email Anda').max(150),
  sandi: z.string().min(1, 'Isi sandi Anda').max(200),
  /** Path internal tujuan setelah masuk. Divalidasi ketat, lihat `tujuanAman()`. */
  next: z.string().max(500).nullable().optional(),
})

/**
 * Baca `FormData` jadi objek biasa.
 *
 * Seluruh aksi di berkas ini menerima `FormData`, bukan objek — karena formnya
 * dipasang sebagai `<form action={...}>`, bukan `onSubmit` yang memanggil aksi
 * lewat `useTransition`. Bedanya nyata dan bukan gaya: form `onSubmit` **tidak
 * berfungsi sebelum React ter-hidrasi**, dan yang terjadi kalau seseorang
 * menekan Enter pada detik-detik itu adalah pengiriman form HTML biasa —
 * artinya GET dengan **sandi terbawa di query string**, lalu tercatat di
 * riwayat peramban dan log server. `<form action={serverAction}>` ditangani
 * Next lewat POST bahkan sebelum hidrasi, jadi celah itu tidak pernah ada.
 */
function dariForm(fd: FormData): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const [k, v] of fd.entries()) if (typeof v === 'string') o[k] = v
  return o
}

/**
 * Cegah open redirect.
 *
 * `?next=` datang dari URL, jadi ia adalah masukan pengguna — dan tujuan
 * pengalihan yang tidak disaring adalah cara klasik memakai domain tepercaya
 * untuk melempar orang ke halaman masuk palsu. Yang diterima hanya path
 * internal: diawali satu garis miring, dan **bukan** `//` (yang oleh browser
 * dibaca sebagai host lain).
 */
function tujuanAman(next: string | null | undefined): string {
  if (!next) return '/'
  if (!next.startsWith('/') || next.startsWith('//')) return '/'
  if (next.startsWith('/masuk') || next.startsWith('/lupa-password')) return '/'
  return next
}

async function ipPemanggil(): Promise<string | null> {
  try {
    const h = await headers()
    const rantai = h.get('x-forwarded-for')
    if (rantai) return rantai.split(',')[0]!.trim().slice(0, 45)
    return h.get('x-real-ip')?.slice(0, 45) ?? null
  } catch {
    return null
  }
}

interface BarisAkun {
  id: number
  nama: string
  username: string
  password_hash: string | null
  status_aktif: number
  harus_ganti_sandi: number
  gagal_masuk_beruntun: number
  terkunci: number
}

export async function masuk(
  _sebelumnya: HasilAksi<never> | null,
  formData: FormData,
): Promise<HasilAksi<never>> {
  const urai = SkemaMasuk.safeParse(dariForm(formData))
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const { identitas, sandi } = urai.data
  const p = await ambilPengaturan()

  const akun = await kueriSatu<BarisAkun>(
    `SELECT id, nama, username, password_hash, status_aktif, harus_ganti_sandi,
            gagal_masuk_beruntun,
            (terkunci_sampai IS NOT NULL AND terkunci_sampai > NOW()) AS terkunci
     FROM users
     WHERE username = ? OR email = ?
     LIMIT 1`,
    [identitas, identitas],
  )

  // Hash tetap dihitung walau akunnya tidak ada — lihat catatan di atas berkas.
  const sandiCocok = await cocokkanSandi(sandi, akun?.password_hash ?? null)

  if (!akun) {
    await catatPeristiwaAuth({ userId: null, aksi: 'MASUK_GAGAL', detail: { identitas, sebab: 'akun tidak ada' } })
    return gagal(PESAN_GAGAL_UMUM)
  }

  if (Number(akun.terkunci) === 1) {
    return gagal(
      `Akun terkunci sementara karena terlalu banyak percobaan gagal. Coba lagi dalam ${p.kunciAkunMenit} menit, atau hubungi Super Admin.`,
    )
  }

  if (akun.status_aktif !== 1) {
    // Akun nonaktif diberi pesan umum yang sama: statusnya bukan informasi
    // yang perlu diketahui orang yang belum membuktikan dirinya pemiliknya.
    await catatPeristiwaAuth({ userId: akun.id, aksi: 'MASUK_GAGAL', detail: { sebab: 'akun nonaktif' } })
    return gagal(PESAN_GAGAL_UMUM)
  }

  if (!sandiCocok) {
    const gagalBaru = Number(akun.gagal_masuk_beruntun) + 1
    const perluKunci = gagalBaru >= p.maksGagalMasuk

    await eksekusi(
      `UPDATE users
       SET gagal_masuk_beruntun = ?,
           terkunci_sampai = ${perluKunci ? 'DATE_ADD(NOW(), INTERVAL ? MINUTE)' : 'terkunci_sampai'}
       WHERE id = ?`,
      perluKunci ? [gagalBaru, p.kunciAkunMenit, akun.id] : [gagalBaru, akun.id],
    )

    await catatPeristiwaAuth({
      userId: akun.id,
      aksi: perluKunci ? 'AKUN_TERKUNCI' : 'MASUK_GAGAL',
      detail: { percobaanGagalBeruntun: gagalBaru, ip: await ipPemanggil() },
    })

    if (perluKunci) {
      return gagal(
        `Akun dikunci ${p.kunciAkunMenit} menit setelah ${p.maksGagalMasuk} percobaan gagal. Hubungi Super Admin bila Anda tidak melakukannya.`,
      )
    }
    return gagal(PESAN_GAGAL_UMUM)
  }

  // --- Berhasil ---
  await eksekusi(
    `UPDATE users
     SET last_login_at = NOW(), gagal_masuk_beruntun = 0, terkunci_sampai = NULL
     WHERE id = ?`,
    [akun.id],
  )
  await buatSesi(akun.id)
  await catatPeristiwaAuth({ userId: akun.id, aksi: 'MASUK', detail: { ip: await ipPemanggil() } })

  // Tabel sesi hanya tumbuh; login adalah satu-satunya saat ia pasti tumbuh,
  // jadi sekalian dibersihkan di sini. Kegagalannya tidak boleh menggagalkan
  // login — ini kebersihan, bukan syarat.
  void bersihkanSesiMati().catch(() => {})

  const tujuan =
    Number(akun.harus_ganti_sandi) === 1 ? RUTE_GANTI_SANDI : tujuanAman(urai.data.next)

  redirect(tujuan)
}

export async function keluar(): Promise<void> {
  const sesi = await bacaSesi()
  await akhiriSesi()
  if (sesi) {
    await catatPeristiwaAuth({ userId: sesi.pengguna.id, aksi: 'KELUAR' })
  }
  redirect('/masuk?keluar=1')
}

const SkemaGantiSandi = z
  .object({
    sandiLama: z.string().min(1, 'Isi sandi Anda saat ini').max(200),
    sandiBaru: z.string().min(1, 'Isi sandi baru').max(200),
    konfirmasi: z.string().min(1, 'Ulangi sandi baru').max(200),
    /** '1' = penggantian wajib; setelah berhasil langsung masuk ke aplikasi. */
    wajib: z.string().optional(),
  })
  .refine((d) => d.sandiBaru === d.konfirmasi, {
    path: ['konfirmasi'],
    message: 'Ulangan sandi tidak sama.',
  })
  .refine((d) => d.sandiBaru !== d.sandiLama, {
    path: ['sandiBaru'],
    message: 'Sandi baru harus berbeda dari sandi lama.',
  })

/**
 * Ganti sandi sendiri.
 *
 * Sandi lama tetap diminta walau penggunanya sudah masuk: sesi yang tertinggal
 * terbuka di komputer bersama tidak boleh cukup untuk mengunci pemilik aslinya
 * keluar dari akunnya sendiri.
 */
export async function gantiSandiSaya(
  _sebelumnya: HasilAksi<{ pesan: string }> | null,
  formData: FormData,
): Promise<HasilAksi<{ pesan: string }>> {
  const sesi = await bacaSesi()
  if (!sesi) return gagal('Sesi Anda sudah berakhir. Masuk lagi lalu ulangi.')

  const urai = SkemaGantiSandi.safeParse(dariForm(formData))
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const d = urai.data

  const akun = await kueriSatu<{ password_hash: string | null }>(
    'SELECT password_hash FROM users WHERE id = ?',
    [sesi.pengguna.id],
  )
  if (!(await cocokkanSandi(d.sandiLama, akun?.password_hash ?? null))) {
    return gagal('Sandi saat ini tidak cocok.', { sandiLama: 'Sandi saat ini tidak cocok.' })
  }

  const pelanggaran = periksaKebijakanSandi(d.sandiBaru, {
    username: sesi.pengguna.username,
    email: sesi.pengguna.email,
    nama: sesi.pengguna.nama,
  })
  if (pelanggaran) return gagal(pelanggaran, { sandiBaru: pelanggaran })

  await eksekusi(
    `UPDATE users
     SET password_hash = ?, harus_ganti_sandi = 0, password_diubah_pada = NOW()
     WHERE id = ?`,
    [await hashSandi(d.sandiBaru), sesi.pengguna.id],
  )

  // Sesi lain dicabut, sesi ini tidak. Kalau sandi diganti karena diduga
  // bocor, membiarkan sesi lama hidup membuat penggantiannya percuma —
  // dan memutus sesi yang sedang dipakai untuk menggantinya cuma membuat
  // pengguna mengira gagal.
  const dicabut = await cabutSesiPengguna(sesi.pengguna.id, sesi.sesiId)
  await catatPeristiwaAuth({
    userId: sesi.pengguna.id,
    aksi: 'SANDI_DIGANTI',
    detail: { sesiLainDicabut: dicabut, olehDiriSendiri: true },
  })

  revalidatePath('/profil')

  // Penggantian WAJIB: begitu selesai, penahannya tidak berlaku lagi — antar
  // langsung ke aplikasi. Kalau tidak, penggunanya tinggal di halaman yang
  // baru saja berhenti punya alasan untuk ada.
  if (d.wajib === '1') redirect('/')

  return berhasil(
    { pesan: 'Sandi diperbarui.' },
    dicabut > 0
      ? `Sandi diperbarui. ${dicabut} sesi lain di perangkat berbeda ikut diakhiri.`
      : 'Sandi diperbarui.',
  )
}

const SkemaLupa = z.object({
  email: z.email('Format email tidak valid').max(150),
})

/**
 * Permintaan Lupa Password.
 *
 * Belum ada transport surel yang diputuskan (PRD §4.3 tidak menyebut layanan
 * surel apa pun), jadi permintaan ini **dicatat** untuk ditangani Super Admin,
 * bukan dikirimkan sebagai tautan reset. Halamannya mengatakan itu apa adanya
 * — lihat alasan lengkap di `doc/sql/012_auth.sql`.
 *
 * Balasannya selalu sama, ada tidaknya akunnya.
 */
export async function mintaResetSandi(
  _sebelumnya: HasilAksi<{ pesan: string }> | null,
  formData: FormData,
): Promise<HasilAksi<{ pesan: string }>> {
  const urai = SkemaLupa.safeParse(dariForm(formData))
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const email = urai.data.email.trim().toLowerCase()

  const akun = await kueriSatu<{ id: number }>('SELECT id FROM users WHERE email = ? LIMIT 1', [
    email,
  ])

  await eksekusi(
    'INSERT INTO permintaan_reset_password (email, user_id, ip_address) VALUES (?, ?, ?)',
    [email, akun?.id ?? null, await ipPemanggil()],
  )
  await catatPeristiwaAuth({
    userId: akun?.id ?? null,
    aksi: 'RESET_DIMINTA',
    detail: { email, akunDitemukan: Boolean(akun) },
  })

  return berhasil({
    pesan:
      'Permintaan Anda tercatat. Super Admin akan mengatur ulang sandi dan menghubungi Anda lewat jalur kepegawaian — tidak ada tautan yang dikirim lewat email.',
  })
}

/** Cabut satu sesi milik sendiri dari Profil Saya (mis. laptop yang tertinggal). */
export async function cabutSesiSaya(sesiId: number): Promise<HasilAksi<void>> {
  const sesi = await bacaSesi()
  if (!sesi) return gagal('Sesi Anda sudah berakhir.')
  if (!Number.isInteger(sesiId) || sesiId <= 0) return gagal('Sesi tidak dikenali.')
  if (sesiId === sesi.sesiId) {
    return gagal('Itu sesi yang sedang Anda pakai. Gunakan tombol Keluar.')
  }

  // `user_id` ikut disaring: tanpa itu, id sesi yang ditebak akan mengakhiri
  // sesi orang lain.
  const { affectedRows } = await eksekusi(
    `UPDATE sesi SET dicabut_pada = NOW()
     WHERE id = ? AND user_id = ? AND dicabut_pada IS NULL`,
    [sesiId, sesi.pengguna.id],
  )
  if (affectedRows === 0) return gagal('Sesi itu sudah tidak aktif.')

  revalidatePath('/profil')
  return berhasil(undefined, 'Sesi diakhiri.')
}

/** Dipakai app shell untuk memastikan identitas tersedia — tidak melempar. */
export async function penggunaSekarang() {
  return getCurrentUser()
}
