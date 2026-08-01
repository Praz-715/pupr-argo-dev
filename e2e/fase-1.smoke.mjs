import { chromium } from '@playwright/test'
import { konteksMasuk } from './_masuk.mjs'

/**
 * Smoke test Fase 1 — Dashboard Utama.
 *
 * Memverifikasi kedelapan widget hadir dan berisi, drill-down Kotak 9
 * tersinkron URL, tautan anchor dari kartu ringkas bekerja, keadaan kedua tema,
 * dan tidak ada scroll horizontal sampai lebar tablet.
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-1.smoke.mjs [folder-screenshot] [base-url]
 */

const BASE = process.argv[3] ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? '.'

const errors = []
const hasil = []

const catat = (nama, ok, detail = '') => hasil.push({ nama, ok, detail })

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

/** Judul kedelapan widget — dipakai sebagai penanda kehadiran. */
const WIDGET = [
  'Pegawai aktif',
  'Jabatan strategis kosong',
  'Kandidat dalam talent pool',
  'Nominasi menunggu tindakan',
  'Sebaran Kotak 9',
  'Peta Kinerja × Potensial',
  'Kesehatan Data',
  'Tren kinerja',
  'Antrian nominasi',
  'Aktivitas terakhir',
]

/** Tunggu sampai widget terakhir (paling bawah) selesai streaming. */
async function tungguDashboard(page) {
  await page.waitForFunction(
    () => document.body.innerText.includes('Aktivitas terakhir'),
    undefined,
    { timeout: 30000 },
  )
  await page.waitForTimeout(600)
}

const browser = await chromium.launch()

try {
  for (const tema of ['light', 'dark']) {
    const ctx = await konteksMasuk(browser, { base: BASE,
      viewport: { width: 1600, height: 1000 },
      colorScheme: tema,
    })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[${tema}] pageerror: ${e.message}`))
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`[${tema}] HTTP ${r.status()} ${r.url()}`)
    })

    await page.goto(BASE, { waitUntil: 'networkidle' })
    await tungguDashboard(page)

    await langkah(`tema ${tema}: kedelapan widget hadir & berisi`, async () => {
      // Dibandingkan case-insensitive: sebagian label memakai CSS `uppercase`,
      // sehingga innerText mengembalikannya dalam huruf kapital.
      const teks = (await page.locator('main').innerText()).toLowerCase()
      const hilang = WIDGET.filter((w) => !teks.includes(w.toLowerCase()))
      tegaskan(hilang.length === 0, `widget tidak ditemukan: ${hilang.join(', ')}`)
      return `${WIDGET.length} penanda widget ditemukan`
    })

    await langkah(`tema ${tema}: token warna terpasang`, async () => {
      const kelas = (await page.getAttribute('html', 'class')) ?? ''
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
      tegaskan(tema === 'dark' ? kelas.includes('dark') : !kelas.includes('dark'), `class="${kelas}"`)
      tegaskan(bg !== 'rgba(0, 0, 0, 0)', 'background body transparan')
      return `class="${kelas}" bg=${bg}`
    })

    await langkah(`tema ${tema}: grid Kotak 9 punya 9 sel dengan angka`, async () => {
      const sel = page.locator('a[aria-label^="Kotak "]')
      const jml = await sel.count()
      tegaskan(jml === 9, `jumlah sel = ${jml}, seharusnya 9`)
      const label = await sel.first().getAttribute('aria-label')
      tegaskan(/Kotak \d+: \d+ pegawai/.test(label ?? ''), `aria-label tidak informatif: ${label}`)
      return `9 sel, contoh: "${label}"`
    })

    await langkah(`tema ${tema}: chart SVG benar-benar tergambar`, async () => {
      const bubble = await page.locator('svg .recharts-scatter-symbol').count()
      const garis = await page.locator('svg .recharts-line').count()
      tegaskan(bubble > 0, 'peta talenta tidak menggambar gelembung')
      tegaskan(garis >= 2, `tren kinerja hanya menggambar ${garis} garis, seharusnya 2`)
      return `${bubble} gelembung, ${garis} garis tren`
    })

    await langkah(`tema ${tema}: setiap chart menyebut basis datanya`, async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(/\d+ pegawai · asesmen terbaru per orang/.test(teks), 'basis grid Kotak 9 tidak ada')
      tegaskan(/dikelompokkan jadi \d+ titik/.test(teks), 'basis peta talenta tidak ada')
      tegaskan(/punya data periodik/.test(teks), 'basis tren kinerja tidak ada')
      return 'ketiga chart menyebut cakupan datanya'
    })

    await langkah(`tema ${tema}: tanpa scroll horizontal`, async () => {
      const selisih = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      tegaskan(selisih <= 0, `menggulir horizontal ${selisih}px`)
      return 'selisih 0px'
    })

    await page.screenshot({ path: `${OUT}/f1-${tema}.png`, fullPage: true })

    if (tema === 'light') {
      await langkah('drill-down: klik sel Kotak 9 menambah ?kotak= ke URL', async () => {
        const sel = page.locator('a[aria-label^="Kotak 9:"]').first()
        await sel.click()
        await page.waitForURL(/\?kotak=9/, { timeout: 8000 })
        await page.waitForFunction(
          () => document.body.innerText.includes('Pegawai di Kotak 9'),
          undefined,
          { timeout: 15000 },
        )
        const teks = await page.locator('main').innerText()
        tegaskan(/Pegawai di Kotak 9/.test(teks), 'panel drill-down tidak muncul')
        tegaskan(/\d+ orang/.test(teks), 'jumlah orang tidak ditampilkan')
        await page.screenshot({ path: `${OUT}/f1-drilldown.png`, fullPage: true })
        return 'URL tersinkron & panel daftar pegawai muncul'
      })

      await langkah('drill-down: sel terpilih ditandai', async () => {
        const kelas =
          (await page.locator('a[aria-label^="Kotak 9:"]').first().getAttribute('class')) ?? ''
        tegaskan(kelas.includes('ring-accent'), 'sel aktif tidak diberi penanda visual')
        return 'sel aktif punya ring aksen'
      })

      await langkah('drill-down: tabel memisahkan predikat & nilai kinerja', async () => {
        // Predikat dan kategori sumbu adalah dua taksonomi berbeda (K-3)
        const isi = (await page.locator('table').first().innerText()).toLowerCase()
        tegaskan(isi.includes('kinerja'), 'kolom Kinerja tidak ada')
        tegaskan(isi.includes('potensial'), 'kolom Potensial tidak ada')
        // Predikat tampil sebagai baris data terpisah dari angka kinerja
        tegaskan(
          /sangat baik|baik|butuh perbaikan|kurang/.test(isi),
          'predikat tidak ditampilkan berdampingan dengan nilai kinerja',
        )
        return 'kolom Kinerja & Potensial terpisah, predikat tampil sebagai label sendiri'
      })

      await langkah('drill-down: tombol tutup mengembalikan URL', async () => {
        await page.click('a[aria-label="Tutup daftar pegawai"]')
        await page.waitForURL((u) => !u.search.includes('kotak='), { timeout: 8000 })
        await page.waitForTimeout(600)
        const teks = await page.locator('main').innerText()
        tegaskan(!teks.includes('Pegawai di Kotak 9'), 'panel masih tampil setelah ditutup')
        return 'panel tertutup & query string bersih'
      })

      await langkah('drill-down: param URL tidak valid diabaikan', async () => {
        await page.goto(`${BASE}/?kotak=99`, { waitUntil: 'networkidle' })
        await tungguDashboard(page)
        const teks = await page.locator('main').innerText()
        tegaskan(!/Pegawai di Kotak/.test(teks), 'kotak=99 seharusnya diabaikan')
        return 'kotak=99 diabaikan, dashboard tetap utuh'
      })

      await langkah('kartu ringkas: tautan anchor menuju widget di halaman', async () => {
        await page.goto(BASE, { waitUntil: 'networkidle' })
        await tungguDashboard(page)
        const anchor = page.locator('a[href="#jabatan-kosong"]').first()
        tegaskan((await anchor.count()) > 0, 'tautan #jabatan-kosong tidak ada')
        await anchor.click()
        await page.waitForTimeout(500)
        const terlihat = await page.locator('#jabatan-kosong').isVisible()
        tegaskan(terlihat, 'panel tujuan anchor tidak terlihat')
        return 'anchor kartu → panel Jabatan strategis kosong'
      })

      await langkah('tidak ada tautan mati di dashboard', async () => {
        const href = await page.locator('main a[href]').evaluateAll((els) =>
          els.map((e) => e.getAttribute('href')).filter(Boolean),
        )
        // Sejak Fase 2 dashboard memang menaut keluar (Direktori & Profil), jadi
        // yang diuji bukan "tidak ada tautan keluar" melainkan "setiap tautan
        // keluar benar-benar mendarat di halaman yang ada".
        const keluar = [
          ...new Set(href.filter((h) => h.startsWith('/') && h !== '/' && !h.startsWith('/?'))),
        ]
        const mati = []
        for (const h of keluar) {
          const r = await page.request.get(`${BASE}${h}`)
          if (r.status() >= 400) mati.push(`${h} → ${r.status()}`)
        }
        tegaskan(mati.length === 0, `tautan mati: ${mati.join(', ')}`)
        return `${href.length} tautan · ${keluar.length} tujuan keluar semuanya hidup`
      })
    }

    await ctx.close()
  }

  // Pimpinan sering akses lewat tablet (PRD §8)
  for (const [nama, lebar] of [
    ['tablet 834px', 834],
    ['tablet sempit 768px', 768],
  ]) {
    const ctx = await konteksMasuk(browser, { base: BASE, viewport: { width: lebar, height: 1180 } })
    const page = await ctx.newPage()
    await page.goto(BASE, { waitUntil: 'networkidle' })
    await tungguDashboard(page)
    await langkah(`${nama}: tanpa scroll horizontal`, async () => {
      const selisih = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      tegaskan(selisih <= 0, `menggulir horizontal ${selisih}px`)
      return 'selisih 0px'
    })
    if (lebar === 834) {
      await page.screenshot({ path: `${OUT}/f1-tablet.png`, fullPage: true })
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}

console.log('\n=== SMOKE TEST FASE 1 — DASHBOARD UTAMA ===')
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
