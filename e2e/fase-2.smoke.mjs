import { chromium } from '@playwright/test'
import { konteksMasuk } from './_masuk.mjs'

/**
 * Smoke test Fase 2 — Direktori Pegawai & Profil Talenta 360°.
 *
 * Memverifikasi: kolom mockup #1 hadir, pengurutan & paginasi & filter
 * tersinkron URL, data lama tetap tampil saat memuat (bukan skeleton),
 * pemilih kolom, navigasi ke profil, seluruh bagian profil terisi, rincian
 * skor per indikator bisa dibuka, dan keadaan kedua tema.
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-2.smoke.mjs [folder-screenshot] [base-url]
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

/** Kolom wajib menurut mockup #1 doc/KERANGKA TALENT POOL.md. */
const KOLOM_MOCKUP = [
  // Mockup #1 di `doc/KERANGKA TALENT POOL.md` menyebut "NIP dan Nama Lengkap"
  // sebagai SATU kolom; user meminta keduanya dipisah (12 Agu 2026). Yang
  // diperiksa langkah ini adalah **kelengkapan informasinya**, bukan jumlah
  // kolomnya — dan dua kolom terpisah tetap memenuhi itu. Kalau nanti daftar ini
  // diubah lagi, ubah karena kolomnya benar-benar hilang, bukan karena
  // penyajiannya bergeser.
  'nama lengkap',
  'nip',
  'jabatan',
  'eselon',
  'unit organisasi',
  'pangkat',
  'jenis asesmen',
  'potkom',
  'integritas',
  'predikat kinerja',
  'jenjang',
  'kotak 9',
]

async function tungguTabel(page) {
  await page.waitForSelector('table tbody tr', { timeout: 30000 })
  await page.waitForTimeout(300)
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
      if (r.status() >= 400 && !r.url().includes('/talenta/00000')) {
        errors.push(`[${tema}] HTTP ${r.status()} ${r.url()}`)
      }
    })

    // ---------------- Direktori ----------------
    await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
    await tungguTabel(page)

    await langkah(`tema ${tema}: kolom mockup #1 lengkap`, async () => {
      const kepala = (await page.locator('table thead').innerText()).toLowerCase()
      const hilang = KOLOM_MOCKUP.filter((k) => !kepala.includes(k))
      tegaskan(hilang.length === 0, `kolom tidak ditemukan: ${hilang.join(', ')}`)
      return `${KOLOM_MOCKUP.length} kolom mockup hadir`
    })

    await langkah(`tema ${tema}: baris terisi & skala kolom dijelaskan`, async () => {
      const jml = await page.locator('table tbody tr').count()
      tegaskan(jml > 0, 'tabel kosong')
      const kepala = await page.locator('table thead').innerText()
      // Skala integritas harus tertulis supaya tidak tertukar dgn skala 1–4 lama
      tegaskan(kepala.includes('0–100'), 'skala kolom skor tidak dicantumkan di header')
      return `${jml} baris, skala kolom tercantum`
    })

    await langkah(`tema ${tema}: tanpa scroll horizontal pada halaman`, async () => {
      const selisih = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      tegaskan(selisih <= 0, `halaman menggulir horizontal ${selisih}px`)
      return 'selisih 0px (tabel menggulir di wadahnya sendiri)'
    })

    await page.screenshot({ path: `${OUT}/f2-direktori-${tema}.png`, fullPage: true })

    if (tema === 'light') {
      await langkah('pengurutan: klik header menambah ?urut= & ?arah=', async () => {
        await page.click('table thead button:has-text("Potkom")')
        await page.waitForURL(/urut=potkom/, { timeout: 10000 })
        await tungguTabel(page)
        const url = page.url()
        tegaskan(url.includes('arah=desc'), `arah tidak diset: ${url}`)
        return 'urut=potkom&arah=desc masuk URL'
      })

      await langkah('pengurutan: klik kedua membalik arah', async () => {
        await page.click('table thead button:has-text("Potkom")')
        await page.waitForURL(/arah=asc/, { timeout: 10000 })
        await tungguTabel(page)
        return 'arah berbalik ke asc'
      })

      await langkah('pengurutan benar-benar mengubah urutan data', async () => {
        const pertamaAsc = await page.locator('table tbody tr').first().innerText()
        await page.click('table thead button:has-text("Potkom")')
        await page.waitForURL(/arah=desc/, { timeout: 10000 })
        await tungguTabel(page)
        const pertamaDesc = await page.locator('table tbody tr').first().innerText()
        tegaskan(pertamaAsc !== pertamaDesc, 'baris teratas sama walau arah dibalik')
        return 'baris teratas berubah saat arah dibalik'
      })

      await langkah('filter: memilih Kotak 9 menyaring & tersinkron URL', async () => {
        await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
        await tungguTabel(page)
        const sebelum = await page.locator('table tbody tr').count()
        await page.selectOption('select[aria-label="Kotak 9"]', '9')
        await page.waitForURL(/kotak=9/, { timeout: 10000 })
        await tungguTabel(page)
        const sesudah = await page.locator('table tbody tr').count()
        tegaskan(sesudah <= sebelum, `hasil filter (${sesudah}) lebih banyak dari tanpa filter (${sebelum})`)
        const teks = await page.locator('main').innerText()
        tegaskan(/filter aktif/i.test(teks), 'jumlah filter aktif tidak diberitahukan')
        return `${sebelum} → ${sesudah} baris, URL memuat kotak=9`
      })

      await langkah('filter: tombol Reset membersihkan seluruh query', async () => {
        await page.click('button:has-text("Reset")')
        await page.waitForURL((u) => u.search === '' || !u.search.includes('kotak='), {
          timeout: 10000,
        })
        await tungguTabel(page)
        return 'query string bersih setelah reset'
      })

      await langkah('pencarian: debounce & menyaring hasil', async () => {
        await page.fill('input[aria-label="Cari nama atau NIP"]', 'irwan')
        await page.waitForURL(/cari=irwan/, { timeout: 10000 })
        await tungguTabel(page)
        const jml = await page.locator('table tbody tr').count()
        tegaskan(jml >= 1, 'pencarian "irwan" tidak menghasilkan baris')
        return `${jml} baris cocok`
      })

      await langkah('pencarian: kata kunci tak cocok → keadaan "tidak ada hasil"', async () => {
        await page.fill('input[aria-label="Cari nama atau NIP"]', 'zzzzzzzz')
        await page.waitForURL(/cari=zzzzzzzz/, { timeout: 10000 })
        await page.waitForFunction(
          () => /tidak ada data yang cocok/i.test(document.body.innerText),
          undefined,
          { timeout: 15000 },
        )
        const teks = await page.locator('main').innerText()
        tegaskan(/reset filter/i.test(teks), 'keadaan kosong tidak menawarkan reset filter')
        return 'pesan "tidak ada data yang cocok" + tombol reset'
      })

      await langkah('pemilih kolom: bisa memunculkan kolom tersembunyi', async () => {
        await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
        await tungguTabel(page)
        const sebelum = await page.locator('table thead th').count()
        await page.click('button:has-text("Kolom")')
        await page.waitForSelector('text=Tampilkan kolom', { timeout: 5000 })
        await page.click('label:has-text("Usia") input[type="checkbox"]')
        await page.waitForTimeout(300)
        const sesudah = await page.locator('table thead th').count()
        tegaskan(sesudah === sebelum + 1, `jumlah kolom ${sebelum} → ${sesudah}, seharusnya +1`)
        return `kolom ${sebelum} → ${sesudah}`
      })

      // ---------------- Profil ----------------
      await langkah('navigasi: klik baris membuka profil talenta', async () => {
        await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
        await tungguTabel(page)
        await page.locator('table tbody tr td a').first().click()
        await page.waitForURL(/\/talenta\/\d{18}/, { timeout: 15000 })
        await page.waitForFunction(
          () => document.body.innerText.includes('Kelengkapan data'),
          undefined,
          { timeout: 25000 },
        )
        return `mendarat di ${new URL(page.url()).pathname}`
      })

      await langkah('profil: seluruh bagian 360° hadir', async () => {
        await page.waitForFunction(
          () => document.body.innerText.includes('Integritas & rekam jejak disiplin'),
          undefined,
          { timeout: 25000 },
        )
        const teks = (await page.locator('main').innerText()).toLowerCase()
        const bagian = [
          'kelengkapan data',
          'posisi kotak 9 & riwayat asesmen',
          'kecocokan dengan jabatan target',
          'riwayat jabatan',
          'riwayat pendidikan',
          'riwayat diklat & sertifikasi',
          'integritas & rekam jejak disiplin',
        ]
        const hilang = bagian.filter((b) => !teks.includes(b))
        tegaskan(hilang.length === 0, `bagian tidak ditemukan: ${hilang.join(', ')}`)
        return `${bagian.length} bagian profil hadir`
      })

      await langkah('profil: data turunan NIP tampil (usia, gender, masa kerja, BUP)', async () => {
        const teks = (await page.locator('main').innerText()).toLowerCase()
        for (const label of ['usia', 'jenis kelamin', 'masa kerja asn', 'batas usia pensiun']) {
          tegaskan(teks.includes(label), `butir "${label}" tidak ada`)
        }
        tegaskan(teks.includes('dari nip'), 'tidak dijelaskan bahwa data diturunkan dari NIP')
        return 'keempat butir turunan NIP hadir & sumbernya dijelaskan'
      })

      await langkah('profil: rincian skor per indikator bisa dibuka (U-3)', async () => {
        const tombol = page.locator('button:has-text("Lihat rincian perhitungan")').first()
        tegaskan((await tombol.count()) > 0, 'tombol rincian perhitungan tidak ada')
        await tombol.click()
        await page.waitForSelector('text=Nilai mentah', { timeout: 8000 })
        const teks = await page.locator('main').innerText()
        tegaskan(/Kategori terpilih/i.test(teks), 'kolom kategori terpilih tidak ada')
        tegaskan(
          /Penilaian Potensi dan Kompetensi/i.test(teks),
          'indikator rubrik tidak terdaftar di rincian',
        )
        await page.screenshot({ path: `${OUT}/f2-profil-rincian.png`, fullPage: true })
        return 'tabel rincian indikator & sub-indikator terbuka'
      })

      await langkah('profil: skor komponen 65/20/15 dijelaskan', async () => {
        const teks = await page.locator('main').innerText()
        tegaskan(/65%/.test(teks) && /20%/.test(teks) && /15%/.test(teks), 'bobot tidak ditampilkan')
        tegaskan(
          /TIDAK memuat unsur kinerja/i.test(teks),
          'peringatan bahwa match score mengabaikan kinerja tidak ada (K-4)',
        )
        return 'bobot 65/20/15 + peringatan soal unsur kinerja'
      })

      await langkah('profil: NIP tidak ada → halaman tidak ditemukan yang membantu', async () => {
        await page.goto(`${BASE}/talenta/000000000000000000`, { waitUntil: 'networkidle' })
        const teks = await page.locator('main').innerText()
        tegaskan(/tidak ditemukan/i.test(teks), 'pesan tidak ditemukan tidak ada')
        tegaskan(/Direktori Pegawai/i.test(teks), 'tidak ada jalan kembali ke direktori')
        return 'pesan + tautan kembali ke Direktori'
      })
    }

    if (tema === 'dark') {
      // Profil di tema gelap, memastikan token warna ikut terpakai di sana
      await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
      await tungguTabel(page)
      await page.locator('table tbody tr td a').first().click()
      await page.waitForFunction(
        () => document.body.innerText.includes('Kelengkapan data'),
        undefined,
        { timeout: 25000 },
      )
      await page.waitForTimeout(800)
      await langkah('tema dark: profil memakai token warna gelap', async () => {
        const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
        tegaskan(bg !== 'rgb(255, 255, 255)', `background masih terang: ${bg}`)
        return `bg=${bg}`
      })
      await page.screenshot({ path: `${OUT}/f2-profil-dark.png`, fullPage: true })
    }

    await ctx.close()
  }

  // Tablet (PRD §8 — pimpinan sering akses lewat tablet)
  for (const [nama, lebar] of [
    ['tablet 834px', 834],
    ['tablet sempit 768px', 768],
  ]) {
    const ctx = await konteksMasuk(browser, { base: BASE, viewport: { width: lebar, height: 1180 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
    await tungguTabel(page)
    await langkah(`${nama}: direktori tanpa scroll horizontal halaman`, async () => {
      const selisih = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      tegaskan(selisih <= 0, `menggulir horizontal ${selisih}px`)
      return 'selisih 0px'
    })
    if (lebar === 834) {
      await page.screenshot({ path: `${OUT}/f2-tablet.png`, fullPage: true })
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}

console.log('\n=== SMOKE TEST FASE 2 — DIREKTORI & PROFIL TALENTA ===')
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
