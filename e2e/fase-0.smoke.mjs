import { chromium } from '@playwright/test'

/**
 * Smoke test Fase 0 — **kerangka aplikasi**, bukan isi halaman.
 *
 * Cakupan: design token kedua tema, app shell (sidebar/navbar/breadcrumb),
 * command palette, dev role switcher, penyaringan navigasi per peran, state
 * collapse sidebar, dan halaman 404.
 *
 * Isi Dashboard (widget, chart, drill-down) diuji terpisah di
 * `fase-1.smoke.mjs` — berkas ini sengaja tidak mengunci konten halaman supaya
 * tidak ikut merah setiap kali dashboard berkembang.
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-0.smoke.mjs [folder-screenshot] [base-url]
 */

const BASE = process.argv[3] ?? 'http://localhost:3210'
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
    const ctx = await browser.newContext({
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

      await langkah('dev role switcher: memuat 8 akun seed', async () => {
        await page.click('button[title*="Pengalih peran"]')
        await page.waitForSelector('[role="menu"]', { timeout: 4000 })
        const jumlah = await page.locator('[role="menuitemradio"]').count()
        tegaskan(jumlah === 8, `jumlah akun = ${jumlah}, seharusnya 8`)
        await page.screenshot({ path: `${OUT}/role-switcher.png` })
        return `${jumlah} akun seed tampil`
      })

      await langkah('RBAC: navigasi menyusut untuk Pengelola Unit', async () => {
        const ITEM_NAV = 'aside nav a, aside nav span[aria-disabled]'
        const sebelum = await page.locator(ITEM_NAV).count()
        await page.click('[role="menuitemradio"]:has-text("Reza Kurniawan")')
        // Tunggu tombol pengalih peran sendiri yang berubah label. Menunggu teks
        // "Pengelola Unit" muncul di halaman lolos seketika karena menu yang
        // sedang terbuka memang mendaftar peran tiap akun — bukan bukti bahwa
        // penggantiannya sudah selesai.
        await page.waitForFunction(
          () =>
            document
              .querySelector('button[title*="Pengalih peran"]')
              ?.innerText.includes('Reza Kurniawan') ?? false,
          undefined,
          { timeout: 15000 },
        )
        // Sidebar dirender ulang oleh server (revalidatePath), jadi jumlahnya
        // menyusut beberapa saat setelah label tombol berubah.
        await page
          .waitForFunction(
            ([sel, awal]) => document.querySelectorAll(sel).length < awal,
            [ITEM_NAV, sebelum],
            { timeout: 15000 },
          )
          .catch(() => {})
        const sesudah = await page.locator(ITEM_NAV).count()
        tegaskan(sesudah < sebelum, `item nav ${sebelum} → ${sesudah} (harus berkurang)`)
        await page.screenshot({ path: `${OUT}/shell-pengelola-unit.png`, fullPage: true })
        return `item nav ${sebelum} → ${sesudah}`
      })

      await langkah('dev role switcher: kembali ke Super Admin', async () => {
        await page.click('button[title*="Pengalih peran"]')
        await page.waitForSelector('[role="menu"]', { timeout: 4000 })
        await page.click('[role="menuitemradio"]:has-text("Admin Sistem")')
        await page.waitForFunction(
          () =>
            document
              .querySelector('button[title*="Pengalih peran"]')
              ?.innerText.includes('Admin Sistem') ?? false,
          undefined,
          { timeout: 15000 },
        )
        await page
          .waitForFunction(
            () =>
              document.querySelectorAll('aside nav a, aside nav span[aria-disabled]').length > 15,
            undefined,
            { timeout: 15000 },
          )
          .catch(() => {})
        const jumlah = await page.locator('aside nav a, aside nav span[aria-disabled]').count()
        tegaskan(jumlah > 15, `Super Admin seharusnya melihat semua menu, dapat ${jumlah}`)
        return `${jumlah} item nav untuk Super Admin`
      })

      await langkah('sidebar: collapse bertahan setelah reload', async () => {
        await page.click('button[title="Ciutkan sidebar"]')
        await page.waitForTimeout(400)
        const ciut = await page.locator('aside').evaluate((el) => el.clientWidth)
        tegaskan(ciut < 80, `lebar setelah diciutkan ${ciut}px`)

        await page.reload({ waitUntil: 'networkidle' })
        const setelahReload = await page.locator('aside').evaluate((el) => el.clientWidth)
        tegaskan(setelahReload < 80, `lebar setelah reload ${setelahReload}px — tidak bertahan`)

        await page.click('button[title="Perluas sidebar"]')
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
  const ctxTablet = await browser.newContext({ viewport: { width: 834, height: 1112 } })
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
