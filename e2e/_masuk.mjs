import { readFileSync } from 'node:fs'

/**
 * Helper masuk untuk seluruh smoke test.
 *
 * Sampai Fase 6, uji berpindah peran dengan menyetel cookie `simt_dev_user`.
 * Fase 7 menghapus jalur itu — kalau ada cara berpindah identitas tanpa sandi
 * yang masih hidup di produksi, seluruh Fase 7 tidak ada artinya. Jadi uji
 * sekarang **benar-benar masuk**, yang sekaligus berarti setiap kali smoke
 * dijalankan, jalur autentikasinya ikut teruji.
 *
 * Supaya itu tidak berarti satu login per konteks (smoke Fase 4 saja membuat
 * delapan konteks), hasil login disimpan sebagai `storageState` lalu dipakai
 * ulang. Satu login per pengguna per proses.
 */

/** Username akun seed (lihat doc/sql/002_seed.sql). */
export const AKUN = {
  superAdmin: 'superadmin',
  adminTalenta: 'martyanti.rbs',
  pengelolaUnit: 'reza.kurniawan',
  pengelolaUnitLain: 'farid.hidayat',
  pimpinan: 'dirjen',
  viewer: 'reviewer.bpsdm',
}

/** Sandi seed dev. Ditolak kebijakan sandi kalau ada yang mencoba memakainya lagi. */
export const SANDI_DEV = 'password123'

/**
 * Sandi per akun — sebagian akun TIDAK lagi memakai sandi seed.
 *
 * Operator mengganti sandi `superadmin` 21 Agu 2026 (terbaca di
 * `users.password_diubah_pada`), dan sejak itu seluruh harness gagal login
 * dengan gejala yang menyesatkan: `page.waitForFunction` timeout 60 detik di
 * `stateUntuk()`, tanpa satu pun pesan yang menyebut sandi. Yang sebenarnya
 * terjadi jauh lebih buruk daripada uji merah — tiap percobaan menaikkan
 * `gagal_masuk_beruntun`, dan pada percobaan kelima **akun operator terkunci 15
 * menit** oleh uji otomatis.
 *
 * Sandinya dibaca dari `.env.local` (`SANDI_SMOKE_SUPERADMIN`), BUKAN dipaku di
 * berkas ini: berkas ini di-commit, `.env.local` tidak (`.gitignore: .env*.local`).
 * Kalau variabelnya tidak ada, harness jatuh ke sandi seed dan akan gagal —
 * itu disengaja, sebab menebak-nebak sandi adalah yang mengunci akun tadi.
 */
function sandiDariEnv(kunci) {
  try {
    const isi = readFileSync('.env.local', 'utf8')
    return isi.match(new RegExp(`^${kunci}\\s*=\\s*"?([^"\\r\\n]+)"?`, 'm'))?.[1]?.trim()
  } catch {
    return undefined
  }
}

const SANDI_KHUSUS = {
  superadmin: sandiDariEnv('SANDI_SMOKE_SUPERADMIN'),
}

export function sandiUntuk(username) {
  return SANDI_KHUSUS[username] ?? SANDI_DEV
}

const cache = new Map()

/** Masuk lewat UI lalu kembalikan storageState-nya. Di-cache per username. */
export async function stateUntuk(browser, username, base) {
  const kunci = `${base}|${username}`
  if (cache.has(kunci)) return cache.get(kunci)

  const ctx = await browser.newContext()
  const page = await ctx.newPage()
  try {
    await page.goto(`${base}/masuk`, { waitUntil: 'domcontentloaded' })
    await page.fill('input[name="identitas"]', username)
    await page.fill('input[name="sandi"]', sandiUntuk(username))
    await page.click('button[type="submit"]')

    // Tunggu sampai BUKAN di halaman masuk lagi. Menunggu selector dashboard
    // akan gagal untuk peran yang mendarat di tempat berbeda.
    //
    // Tenggatnya longgar (60 detik) karena login yang pertama di dev server
    // yang baru hidup harus menunggu Next mengompilasi halaman TUJUAN, bukan
    // cuma memproses sandinya — dan dashboard adalah halaman terberat di
    // aplikasi. Tenggat 15 detik gagal di sini bukan karena ada yang rusak.
    await page.waitForFunction(() => !location.pathname.startsWith('/masuk'), null, {
      timeout: 60000,
    })

    const state = await ctx.storageState()
    cache.set(kunci, state)
    return state
  } finally {
    await ctx.close()
  }
}

/**
 * Konteks browser yang sudah masuk. Pengganti langsung `browser.newContext()`.
 *
 *   const ctx = await konteksMasuk(browser, { base: BASE, viewport: {...} })
 *   const ctx = await konteksMasuk(browser, { base: BASE, akun: AKUN.pimpinan })
 */
export async function konteksMasuk(browser, { base, akun = AKUN.superAdmin, ...opsi } = {}) {
  const storageState = await stateUntuk(browser, akun, base)
  return browser.newContext({ ...opsi, storageState })
}
