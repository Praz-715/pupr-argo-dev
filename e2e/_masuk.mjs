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
    await page.fill('input[name="sandi"]', SANDI_DEV)
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
