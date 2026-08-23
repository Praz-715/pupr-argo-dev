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

/**
 * Penanda kehadiran isi dashboard.
 *
 * Dashboard dipangkas atas permintaan user (10 Agu 2026) menjadi tiga panel:
 * empat KPI, Sebaran Kotak 9 + drill-down, dan Jabatan Strategis Kosong.
 * Lima widget PRD §6.2 lain (Peta Kinerja × Potensial, Kesehatan Data, Tren
 * Kinerja, Antrian Nominasi, Aktivitas Terakhir) dilepas dari halaman ini —
 * komponennya masih utuh di `_widget/`, jadi kalau dipasang kembali, tambahkan
 * lagi namanya di sini.
 */
const WIDGET = [
  'Pegawai aktif',
  'Jabatan strategis kosong',
  'Kandidat dalam talent pool',
  'Daftar nominasi',
  'Sebaran Kotak 9',
  'Peta Kinerja × Potensial',
]

/**
 * Tunggu sampai panel terakhir selesai streaming.
 *
 * Penandanya **Jabatan strategis kosong**, panel paling bawah sekarang. Dulu
 * "Aktivitas terakhir" — dan penanda yang menunggu widget yang sudah tidak ada
 * akan timeout 30 detik pada SETIAP langkah, lalu gagal dengan pesan yang
 * seolah-olah soal widget lain.
 */
async function tungguDashboard(page) {
  await page.waitForFunction(
    () => document.body.innerText.toLowerCase().includes('peta kinerja'),
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

    await langkah(`tema ${tema}: ketiga panel dashboard hadir & berisi`, async () => {
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

    /**
     * Kotak 9 wajib CSS Grid, bukan chart — dan pemeriksaannya **dilingkupi ke
     * panelnya**, bukan ke seluruh dashboard.
     *
     * Versi sebelumnya menuntut NOL `recharts-surface` di `main`, yang benar
     * hanya selama dashboard tidak memuat satu pun widget chart. Begitu user
     * meminta Peta Kinerja × Potensial dipasang di sini (12 Agu 2026) — dan itu
     * memang scatter Recharts — asersi itu jadi merah tanpa ada yang rusak.
     * Yang sebenarnya dijaga langkah ini: grid Kotak 9 digambar sebagai sel yang
     * bisa diklik, BUKAN sebagai SVG. Jadi yang diperiksa isi panelnya sendiri.
     */
    await langkah(`tema ${tema}: grid Kotak 9 tergambar sebagai sel, bukan chart`, async () => {
      const sel = await page.locator('a[aria-label^="Kotak "]').count()
      tegaskan(sel === 9, `grid punya ${sel} sel, seharusnya 9`)
      const panelKotak9 = page.locator('main section').filter({ hasText: 'Sebaran Kotak 9' }).last()
      const chart = await panelKotak9.locator('svg.recharts-surface').count()
      tegaskan(chart === 0, `panel Kotak 9 memuat ${chart} chart Recharts, seharusnya CSS Grid`)
      return '9 sel CSS Grid · panel Kotak 9 bebas Recharts'
    })

    await langkah(`tema ${tema}: grid Kotak 9 menyebut basis datanya`, async () => {
      // Dua hal yang dijaga langkah ini, dan keduanya PINDAH TEMPAT pada
      // 18 Agu 2026 ketika user meminta empat kalimat keterangan dihapus:
      //
      //   1. **basis data** — dulu berbunyi "N pegawai · asesmen terbaru per
      //      orang" di deskripsi panel. Frasa "asesmen terbaru per orang" dihapus;
      //      jumlah pegawainya tetap ada, dan itulah basis yang sebenarnya
      //      dijaga. Diperiksa pada `<p>` deskripsi panel — BUKAN pada seluruh
      //      `main`, karena tiap sel grid juga memuat kata "pegawai" sehingga
      //      regex selebar itu akan lulus meski deskripsinya lenyap sama sekali.
      //
      //   2. **arti warna** — dulu paragraf "band kualitas" di kaki panel, kini
      //      melekat di `title` tiap sel. Asersinya diarahkan ke tempat barunya,
      //      BUKAN dilonggarkan: melonggarkannya berarti sel boleh kehilangan
      //      penjelasannya sama sekali nanti tanpa satu pun uji yang merah.
      const panel = page.locator('main section').filter({ hasText: 'Sebaran Kotak 9' }).last()
      const deskripsi = (await panel.locator('header p').first().innerText()).trim()
      tegaskan(
        /^\d[\d.,]* pegawai\b/.test(deskripsi),
        `deskripsi panel tidak menyebut basis datanya: "${deskripsi}"`,
      )

      const judulSel = await page.locator('a[aria-label^="Kotak "]').first().getAttribute('title')
      tegaskan(
        judulSel !== null && /Kotak \d+ · .+ × .+/.test(judulSel),
        `title sel tidak menyebut posisi kotak pada kedua sumbu: ${judulSel}`,
      )
      tegaskan(
        judulSel.split('\n').filter((b) => b.trim() !== '').length >= 2,
        'title sel tidak memuat deskripsi maknanya, cuma koordinat',
      )
      return `basis data "${deskripsi}" · tiap sel membawa keterangannya di title`
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
        // Panel Jabatan Kosong tidak lagi di dashboard, jadi kartunya menaut
        // KELUAR halaman. Yang diuji sekarang: tautannya menuju halaman+anchor
        // yang benar, dan panel tujuannya benar-benar ada di sana — bukan cuma
        // hrefnya terisi. Anchor di dalam halaman yang tinggal satu (Kotak 9)
        // diuji lewat langkah drill-down.
        const anchor = page.locator('a[href="/jabatan-target#jabatan-kosong"]').first()
        tegaskan((await anchor.count()) > 0, 'tautan ke /jabatan-target#jabatan-kosong tidak ada')
        await anchor.click()
        await page.waitForURL(/\/jabatan-target/, { timeout: 30000 })
        await page.waitForTimeout(1500)
        const terlihat = await page.locator('#jabatan-kosong').first().isVisible()
        tegaskan(terlihat, 'panel Jabatan Kosong tidak ditemukan di halaman tujuan')
        return 'kartu → /jabatan-target#jabatan-kosong, panelnya ada'
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
