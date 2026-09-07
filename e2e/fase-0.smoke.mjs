import { chromium } from '@playwright/test'
import { hostname, networkInterfaces } from 'node:os'
import { AKUN, konteksMasuk } from './_masuk.mjs'

/**
 * Smoke test Fase 0 — **kerangka aplikasi**, bukan isi halaman.
 *
 * Cakupan: design token kedua tema, app shell (sidebar/navbar/breadcrumb),
 * command palette, menu pengguna & keluar, penyaringan navigasi per peran,
 * state collapse sidebar, dan halaman 404.
 *
 * Isi Dashboard (widget, chart, drill-down) diuji terpisah di
 * `fase-1.smoke.mjs` — berkas ini sengaja tidak mengunci konten halaman supaya
 * tidak ikut merah setiap kali dashboard berkembang.
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-0.smoke.mjs [folder-screenshot] [base-url]
 */

// 3000, sama dengan sembilan berkas smoke lainnya. Sebelumnya 3210 — sisa dari
// server sekali-pakai saat Fase 0 dikerjakan — sehingga `npm run smoke`, yang
// tidak meneruskan base-url ke satu pun berkasnya, selalu berhenti di langkah
// pertama dengan ERR_CONNECTION_REFUSED sebelum berkas lain sempat jalan.
const BASE = process.argv[3] ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? '.'

const errors = []
const hasil = []

function catat(nama, ok, detail = '') {
  hasil.push({ nama, ok, detail })
}

/** Jalankan satu langkah; kegagalan dicatat, tidak menghentikan sisa uji. */
async function langkah(nama, fn) {
  try {
    const detail = await fn()
    catat(nama, true, typeof detail === 'string' ? detail : '')
  } catch (e) {
    catat(nama, false, e.message.split('\n')[0])
  }
}

function tegaskan(kondisi, pesan) {
  if (!kondisi) throw new Error(pesan)
  return pesan
}

const browser = await chromium.launch()

try {
  for (const tema of ['light', 'dark']) {
    const ctx = await konteksMasuk(browser, { base: BASE,
      viewport: { width: 1440, height: 900 },
      colorScheme: tema,
    })
    const page = await ctx.newPage()
    page.on('response', (r) => {
      // /halaman-ngawur memang sengaja diminta untuk menguji halaman 404.
      if (r.status() >= 400 && !r.url().includes('/halaman-ngawur')) {
        errors.push(`[${tema}] HTTP ${r.status()} ${r.url()}`)
      }
    })
    page.on('pageerror', (e) => errors.push(`[${tema}] pageerror: ${e.message}`))

    await page.goto(BASE, { waitUntil: 'networkidle' })
    // Konten mengalir masuk lewat <Suspense> — tunggu widget terakhir, bukan
    // cuma networkidle, karena shell sudah terkirim sebelum kueri selesai.
    await page
      .waitForFunction(() => document.body.innerText.includes('Aktivitas terakhir'), undefined, {
        timeout: 25000,
      })
      .catch(() => {})

    await langkah(`tema ${tema}: class html & token warna terpasang`, async () => {
      const kelasHtml = (await page.getAttribute('html', 'class')) ?? ''
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      const fg = await page.evaluate(() => getComputedStyle(document.body).color)
      const gelap = kelasHtml.includes('dark')
      tegaskan(tema === 'dark' ? gelap : !gelap, `class="${kelasHtml}"`)
      tegaskan(bg !== 'rgba(0, 0, 0, 0)', 'background body transparan — token tidak terpasang')
      return `class="${kelasHtml}" bg=${bg} text=${fg}`
    })

    await langkah(`tema ${tema}: app shell (sidebar + breadcrumb) hadir`, async () => {
      const sidebar = await page.locator('aside nav[aria-label="Navigasi utama"]').count()
      const breadcrumb = await page.locator('nav[aria-label="Breadcrumb"]').count()
      tegaskan(sidebar === 1 && breadcrumb === 1, `sidebar=${sidebar} breadcrumb=${breadcrumb}`)
      return `sidebar=${sidebar} breadcrumb=${breadcrumb}`
    })

    await langkah(`tema ${tema}: shell merender halaman berisi data DB`, async () => {
      // Sengaja tidak mengunci teks tertentu — isi dashboard diuji di
      // fase-1.smoke.mjs. Di sini cukup dipastikan shell tidak kosong dan
      // benar-benar menampilkan angka dari database.
      const teks = await page.locator('main').innerText()
      tegaskan(teks.length > 200, `konten main terlalu pendek (${teks.length} karakter)`)
      tegaskan(/\d/.test(teks), 'tidak ada angka sama sekali di konten')
      return `${teks.length} karakter konten terender`
    })

    await langkah(`tema ${tema}: tanpa scroll horizontal`, async () => {
      const selisih = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      tegaskan(selisih <= 0, `body menggulir horizontal ${selisih}px`)
      return 'selisih 0px'
    })

    await page.screenshot({ path: `${OUT}/shell-${tema}.png`, fullPage: true })

    if (tema === 'light') {
      await langkah('command palette: Ctrl+K + pencarian kata kunci', async () => {
        await page.keyboard.press('Control+k')
        await page.waitForSelector('[role="dialog"][aria-label="Pencarian cepat"]', {
          timeout: 4000,
        })
        await page.fill('input[aria-label="Kata kunci pencarian"]', 'kotak')
        await page.waitForTimeout(200)
        const isi = await page.locator('[role="dialog"]').innerText()
        // "kotak 9" adalah kata kunci Peta Talenta, bukan bagian dari labelnya
        tegaskan(isi.includes('Peta Talenta'), `hasil: ${isi.replace(/\n/g, ' | ')}`)
        await page.screenshot({ path: `${OUT}/command-palette.png` })
        await page.keyboard.press('Escape')
        return 'cari "kotak" → menemukan Peta Talenta lewat kata kunci'
      })

      await langkah('menu pengguna: identitas & peran terbaca tanpa mengklik', async () => {
        const tombol = page.locator('header button[aria-haspopup="menu"]').last()
        const label = await tombol.innerText()
        tegaskan(/Admin Sistem/.test(label), `tombol menu tidak menyebut nama: "${label}"`)
        tegaskan(/Super Admin/.test(label), `peran tidak tampil di tombol: "${label}"`)
        await tombol.click()
        await page.waitForSelector('[role="menu"]', { timeout: 4000 })
        const isi = await page.locator('[role="menu"]').innerText()
        tegaskan(/Profil Saya/.test(isi), 'menu tidak punya tautan Profil Saya')
        tegaskan(/Keluar/.test(isi), 'menu tidak punya tombol Keluar')
        await page.screenshot({ path: `${OUT}/menu-pengguna.png` })
        await page.keyboard.press('Escape')
        return 'nama + peran di tombol · Profil Saya & Keluar di menu'
      })

      await langkah('RBAC: navigasi Pengelola Unit lebih sempit daripada Super Admin', async () => {
        const ITEM_NAV = 'aside nav a, aside nav span[aria-disabled]'
        const superAdmin = await page.locator(ITEM_NAV).count()
        tegaskan(superAdmin > 15, `Super Admin hanya melihat ${superAdmin} item nav`)

        // Konteks TERPISAH yang benar-benar masuk sebagai Reza. Sejak Fase 7
        // tidak ada lagi cara berpindah identitas tanpa sandi — dan itu justru
        // yang diuji di sini: penyempitan menu berasal dari sesi, bukan dari
        // nilai yang bisa disetel dari sisi klien.
        const ctxUnit = await konteksMasuk(browser, {
          base: BASE,
          akun: AKUN.pengelolaUnit,
          viewport: { width: 1440, height: 900 },
        })
        const pageUnit = await ctxUnit.newPage()
        await pageUnit.goto(BASE, { waitUntil: 'networkidle' })
        const unit = await pageUnit.locator(ITEM_NAV).count()
        const labelUnit = await pageUnit
          .locator('header button[aria-haspopup="menu"]')
          .last()
          .innerText()
        await pageUnit.screenshot({ path: `${OUT}/shell-pengelola-unit.png`, fullPage: true })
        await ctxUnit.close()

        tegaskan(/Pengelola Unit/.test(labelUnit), `peran tidak sesuai: "${labelUnit}"`)
        tegaskan(unit < superAdmin, `item nav ${superAdmin} → ${unit} (harus berkurang)`)
        return `Super Admin ${superAdmin} item · Pengelola Unit ${unit} item`
      })

      await langkah('keluar: sesi berakhir & halaman terlindungi memantulkan ke /masuk', async () => {
        const ctxKeluar = await konteksMasuk(browser, { base: BASE, akun: AKUN.viewer })
        const p = await ctxKeluar.newPage()
        await p.goto(BASE, { waitUntil: 'networkidle' })
        await p.locator('header button[aria-haspopup="menu"]').last().click()
        await p.waitForSelector('[role="menu"]', { timeout: 4000 })
        await p.click('[role="menu"] button:has-text("Keluar")')
        await p.waitForFunction(() => location.pathname.startsWith('/masuk'), null, {
          timeout: 15000,
        })

        // Bukti sesinya benar-benar dicabut, bukan cuma dialihkan sekali:
        // membuka halaman dalam aplikasi lagi harus tetap memantul.
        await p.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
        const jalur = new URL(p.url()).pathname
        await ctxKeluar.close()
        tegaskan(jalur.startsWith('/masuk'), `setelah keluar masih bisa membuka ${jalur}`)
        return 'keluar → /masuk · kunjungan berikutnya tetap dipantulkan'
      })

      await langkah('sidebar: collapse bertahan setelah reload', async () => {
        await page.click('button[title="Tutup sidebar"]')
        await page.waitForTimeout(400)
        const ciut = await page.locator('aside').evaluate((el) => el.clientWidth)
        tegaskan(ciut < 80, `lebar setelah diciutkan ${ciut}px`)

        await page.reload({ waitUntil: 'networkidle' })
        const setelahReload = await page.locator('aside').evaluate((el) => el.clientWidth)
        tegaskan(setelahReload < 80, `lebar setelah reload ${setelahReload}px — tidak bertahan`)

        await page.click('button[title="Buka sidebar"]')
        await page.waitForTimeout(400)
        const luas = await page.locator('aside').evaluate((el) => el.clientWidth)
        tegaskan(luas > 200, `lebar setelah diperluas ${luas}px`)
        return `${luas}px → ciut ${ciut}px → reload tetap ${setelahReload}px → perluas ${luas}px`
      })

      await langkah('halaman 404 punya jalan keluar', async () => {
        await page.goto(`${BASE}/halaman-ngawur`, { waitUntil: 'networkidle' })
        const teks = await page.locator('body').innerText()
        tegaskan(teks.includes('tidak ditemukan'), 'pesan 404 tidak ada')
        tegaskan(teks.includes('Kembali ke Dashboard'), 'tidak ada tautan kembali')
        return 'pesan 404 + tautan kembali ke Dashboard'
      })
    }

    await ctx.close()
  }

  // Pimpinan sering akses lewat tablet (PRD §8)
  const ctxTablet = await konteksMasuk(browser, { base: BASE, viewport: { width: 834, height: 1112 } })
  const pageTablet = await ctxTablet.newPage()
  await pageTablet.goto(BASE, { waitUntil: 'networkidle' })
  await langkah('tablet 834px: tanpa scroll horizontal', async () => {
    const selisih = await pageTablet.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    tegaskan(selisih <= 0, `menggulir horizontal ${selisih}px`)
    return 'selisih 0px'
  })
  await pageTablet.screenshot({ path: `${OUT}/shell-tablet.png`, fullPage: true })
  await ctxTablet.close()

  const ctxGrup = await konteksMasuk(browser, {
    base: BASE,
    viewport: { width: 1440, height: 1000 },
  })
  await langkah('sidebar: grup bisa diciutkan & grup halaman aktif tetap terlihat', async () => {
    const pageGrup = await ctxGrup.newPage()
    await pageGrup.goto(BASE, { waitUntil: 'networkidle' })
    await pageGrup.waitForTimeout(800)

    const tinggiAwal = await pageGrup
      .locator('aside nav')
      .evaluate((e) => e.scrollHeight)

    // Ciutkan semua grup yang boleh diciutkan.
    const tombol = await pageGrup.locator('aside nav button:not([disabled])').all()
    tegaskan(tombol.length >= 3, `hanya ${tombol.length} grup bisa diciutkan`)
    for (const t of tombol) await t.click()
    await pageGrup.waitForTimeout(400)

    const tinggiCiut = await pageGrup.locator('aside nav').evaluate((e) => e.scrollHeight)
    tegaskan(tinggiCiut < tinggiAwal, `daftar tidak memendek (${tinggiAwal} → ${tinggiCiut})`)

    // Bertahan setelah reload.
    await pageGrup.reload({ waitUntil: 'networkidle' })
    await pageGrup.waitForTimeout(800)
    const tinggiSetelahReload = await pageGrup
      .locator('aside nav')
      .evaluate((e) => e.scrollHeight)
    tegaskan(
      tinggiSetelahReload === tinggiCiut,
      `pilihan tidak bertahan (${tinggiCiut} → ${tinggiSetelahReload})`,
    )

    // **Invarian yang paling penting.** Masuk ke halaman di dalam grup yang baru
    // saja diciutkan: item aktifnya WAJIB terlihat. Kalau tidak, sidebar tidak
    // menunjukkan di mana pengguna berada, dan gejalanya terbaca sebagai "menu
    // saya hilang" — bukan sebagai "grupnya tertutup".
    await pageGrup.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
    await pageGrup.waitForTimeout(800)
    const aktif = pageGrup.locator('aside nav a[aria-current="page"]')
    tegaskan((await aktif.count()) === 1, 'tidak ada satu pun item nav bertanda halaman aktif')
    tegaskan(await aktif.isVisible(), 'item nav halaman aktif tersembunyi di grup yang diciutkan')

    const hasil = `daftar ${tinggiAwal}px → ${tinggiCiut}px · bertahan reload · item aktif "${(await aktif.innerText()).trim()}" terlihat`
    await pageGrup.close()
    return hasil
  })
  await ctxGrup.close()

  // ── aset dev lintas-origin ───────────────────────────────────────────────
  // `next dev` menolak permintaan `/_next/*` dari origin yang tidak terdaftar
  // di `allowedDevOrigins` dengan **403**, sementara render servernya tetap
  // jalan. Akibatnya aplikasi yang dibuka lewat alamat selain `localhost`
  // (IP LAN, Tailscale, nama host, port forwarding VS Code — yaitu cara paling
  // wajar bekerja lewat Remote SSH) mengirim HTML yang lengkap tanpa satu pun
  // chunk React. Halamannya tampak sempurna dan SETIAP kontrol mati.
  //
  // Diuji lewat header `Origin`, bukan dengan benar-benar membuka alamat lain:
  // gerbangnya memutuskan berdasarkan `Origin`, jadi itulah yang perlu dijaga.
  //
  // Yang ditegaskan: **setiap alamat yang bisa dipakai menghubungi mesin ini**
  // harus lolos — bukan "semua origin lolos". Meloloskan origin sembarang justru
  // menghapus gunanya `allowedDevOrigins`, yang memang ada untuk mencegah situs
  // lain membaca aset dev. Alamatnya dibaca dari antarmuka jaringan supaya uji
  // ini ikut menemukan alamat baru (Tailscale, subnet lain) tanpa disunting.
  await langkah('aset dev bisa dimuat dari semua alamat mesin ini', async () => {
    const halaman = await fetch(`${BASE}/masuk`).then((r) => r.text())
    const chunk = halaman.match(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/)?.[1]
    tegaskan(Boolean(chunk), 'tidak menemukan satu pun chunk JS di halaman masuk')

    const port = new URL(BASE).port || '3000'
    const alamat = ['localhost', hostname()]
    for (const daftar of Object.values(networkInterfaces())) {
      for (const n of daftar ?? []) {
        // IPv6 dilewati: Next mencocokkan Origin sebagai string, dan bentuk
        // berkurung `[::1]` tidak pernah muncul di daftar ini.
        if (n.family === 'IPv4') alamat.push(n.address)
      }
    }

    const ditolak = []
    for (const a of [...new Set(alamat)]) {
      const r = await fetch(`${BASE}${chunk}`, { headers: { Origin: `http://${a}:${port}` } })
      if (r.status !== 200) ditolak.push(`${a} (HTTP ${r.status})`)
    }

    tegaskan(
      ditolak.length === 0,
      `chunk ditolak untuk ${ditolak.join(', ')} — tambahkan ke allowedDevOrigins ` +
        'di next.config.ts, kalau tidak aplikasi MATI TOTAL saat dibuka lewat alamat itu ' +
        '(HTML lengkap, nol chunk React, nol pesan galat)',
    )
    return `${new Set(alamat).size} alamat lolos: ${[...new Set(alamat)].join(' · ')}`
  })

  // ── localStorage diblokir ────────────────────────────────────────────────
  // Bukan kasus pinggiran: `window.localStorage` MELEMPAR (bukan
  // mengembalikan null) ketika site data diblokir, di sebagian mode privat,
  // di bawah kebijakan enterprise, dan di dalam iframe/webview yang partisi
  // penyimpanannya dimatikan — termasuk Simple Browser milik VS Code, yang
  // dipakai untuk membuka port yang diteruskan.
  //
  // Lemparannya terjadi di dalam `getSnapshot` milik `useSyncExternalStore`,
  // artinya SAAT RENDER, sehingga yang gagal adalah hidrasi — bukan satu
  // tombol. Halamannya tetap tampak sempurna (HTML-nya dari server) sementara
  // SELURUH kontrol mati tanpa pesan galat apa pun. Ditambah class tema yang
  // dipasang inline script next-themes sebelum React, gejalanya terbaca
  // sebagai "tema mentok di gelap" — dan mengirim diagnosis ke arah CSS,
  // yang tidak ada hubungannya.
  //
  // Karena itu ujinya di sini dan bukan di uji unit: yang perlu dijaga bukan
  // "hook mengembalikan nilai bawaan", tapi "aplikasinya masih bisa diklik".
  const ctxTanpaSimpanan = await konteksMasuk(browser, {
    base: BASE,
    viewport: { width: 1440, height: 900 },
  })
  await ctxTanpaSimpanan.addInitScript(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('Access is denied for this document.', 'SecurityError')
      },
    })
  })
  const pageTS = await ctxTanpaSimpanan.newPage()
  const galatTS = []
  pageTS.on('pageerror', (e) => galatTS.push(e.message))
  await pageTS.goto(BASE, { waitUntil: 'networkidle' })
  await pageTS.waitForTimeout(1200)

  await langkah('localStorage diblokir: aplikasi tetap terhidrasi & bisa diklik', async () => {
    tegaskan(galatTS.length === 0, `error halaman: ${galatTS[0]}`)

    // Pengalih tema harus benar-benar mengubah class di <html>.
    const temaAwal = await pageTS.getAttribute('html', 'class')
    const tujuan = temaAwal?.includes('dark') ? 'Tema Terang' : 'Tema Gelap'
    await pageTS.click(`header [role="radiogroup"] button[title="${tujuan}"]`)
    await pageTS.waitForTimeout(400)
    const temaBaru = await pageTS.getAttribute('html', 'class')
    tegaskan(temaBaru !== temaAwal, `tema mentok di "${temaAwal}" — hidrasi mati`)

    // Command palette & menu pengguna: keduanya state React murni.
    await pageTS.keyboard.press('Control+k')
    await pageTS.waitForSelector('dialog[open], [role="dialog"]', { timeout: 4000 })
    await pageTS.keyboard.press('Escape')

    await pageTS.locator('header button[aria-haspopup="menu"]').last().click()
    await pageTS.waitForSelector('[role="menu"]', { timeout: 4000 })
    await pageTS.keyboard.press('Escape')

    // Tutup sidebar: satu-satunya kontrol yang memang MEMBACA localStorage.
    const lebarAwal = await pageTS.locator('aside').evaluate((e) => e.getBoundingClientRect().width)
    await pageTS.locator('aside button[title]').first().click()
    await pageTS.waitForTimeout(400)
    const lebarCiut = await pageTS.locator('aside').evaluate((e) => e.getBoundingClientRect().width)
    tegaskan(lebarCiut < lebarAwal, `sidebar tidak menciut (${lebarAwal}px → ${lebarCiut}px)`)

    return `tema ${temaAwal} → ${temaBaru} · palette & menu terbuka · sidebar ${Math.round(lebarAwal)}px → ${Math.round(lebarCiut)}px`
  })
  await ctxTanpaSimpanan.close()
} finally {
  await browser.close()
}

console.log('\n=== SMOKE TEST FASE 0 ===')
for (const h of hasil) {
  console.log(`${h.ok ? 'LULUS' : 'GAGAL'}  ${h.nama}`)
  if (h.detail) console.log(`       ${h.detail}`)
}

const gagal = hasil.filter((h) => !h.ok)
console.log(`\nRingkasan: ${hasil.length - gagal.length}/${hasil.length} lulus`)

if (errors.length > 0) {
  console.log('\nError konsol/halaman:')
  for (const e of [...new Set(errors)]) console.log(`  - ${e}`)
} else {
  console.log('Tanpa error konsol maupun error halaman.')
}

process.exit(gagal.length > 0 || errors.length > 0 ? 1 : 0)
