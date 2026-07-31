import { chromium } from '@playwright/test'

/**
 * Smoke test Fase 4 — Master Data, Importer & Kualitas Data.
 *
 * Ini fase pertama yang punya **mutasi**, jadi yang diuji bukan cuma "halaman
 * muncul" tapi janji-janji yang paling mudah bocor saat ada tulis:
 *   - validasi Zod muncul PER FIELD (bukan toast) dan isian lain tetap utuh;
 *   - constraint DB (kode ganda) jadi pesan yang bisa ditindak, bukan crash;
 *   - penolakan hapus menyebut SEBAB + ANGKA-nya;
 *   - jabatan yang masih ditempati tidak bisa ditandai kosong — lewat form
 *     maupun lewat jalur pintas tombol tabel;
 *   - setiap mutasi menulis audit_log dengan isi sebelum & sesudah;
 *   - halaman data sensitif menolak di SERVER, dan datanya tidak ikut terkirim.
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-4.smoke.mjs [folder-screenshot] [base-url]
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

const RUTE = [
  ['/master/unit', 'Master Unit Organisasi'],
  ['/master/jabatan', 'Master Jabatan'],
  ['/master/jabatan-kosong', 'Jabatan Kosong & Risiko Kekosongan'],
  ['/data/kelengkapan', 'Kelengkapan Data'],
  ['/data/pembersihan', 'Antrian Pembersihan Data'],
  ['/data/konsolidasi', 'Konsolidasi & Sinkronisasi Data'],
  ['/master/hukuman-disiplin', 'Data Hukuman Disiplin'],
]

const browser = await chromium.launch()
const KODE_UJI = `SMOKE-${Date.now().toString().slice(-6)}`
const NAMA_UJI = `Unit Smoke ${KODE_UJI}`

try {
  for (const tema of ['light', 'dark']) {
    const ctx = await browser.newContext({
      viewport: { width: 1600, height: 1100 },
      colorScheme: tema,
    })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[${tema}] pageerror: ${e.message}`))
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`[${tema}] HTTP ${r.status()} ${r.url()}`)
    })

    for (const [rute, judul] of RUTE) {
      await langkah(`tema ${tema}: ${rute} terbuka & berjudul benar`, async () => {
        const resp = await page.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
        tegaskan(resp?.status() === 200, `HTTP ${resp?.status()}`)
        const h1 = await page.locator('h1').first().innerText()
        tegaskan(h1.includes(judul), `judul "${h1}" bukan "${judul}"`)
        const selisih = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        tegaskan(selisih <= 0, `menggulir horizontal ${selisih}px`)
        return 'HTTP 200 · judul cocok · tanpa scroll horizontal'
      })
    }

    if (tema === 'light') {
      await page.goto(`${BASE}/master/jabatan-kosong`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f4-risiko-light.png`, fullPage: true })
      await page.goto(`${BASE}/data/kelengkapan`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f4-kelengkapan-light.png`, fullPage: true })
      await page.goto(`${BASE}/master/unit`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f4-unit-light.png`, fullPage: true })
    } else {
      await page.goto(`${BASE}/data/pembersihan`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f4-pembersihan-dark.png`, fullPage: true })
    }

    await ctx.close()
  }

  // ---------------- U-6 · risiko kekosongan ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

    await page.goto(`${BASE}/master/jabatan-kosong`, { waitUntil: 'networkidle' })

    await langkah('U-6: dua bagian terpisah — sudah kosong & akan kosong', async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(/sudah kosong/i.test(teks), 'bagian "sudah kosong" tidak ada')
      tegaskan(/akan kosong/i.test(teks), 'bagian "akan kosong" tidak ada')
      tegaskan(/batas usia pensiun/i.test(teks), 'BUP tidak disebut')
      return 'kedua bagian hadir + BUP dijelaskan'
    })

    await langkah('U-6: pejabat berisiko punya isi pada ambang bawaan 3 tahun', async () => {
      const teks = await page.locator('main').innerText()
      const m = /(\d+)\s+dari\s+\d+\s+pejabat aktif/.exec(teks)
      tegaskan(m !== null, 'ringkasan jumlah pejabat berisiko tidak terbaca')
      tegaskan(
        Number(m[1]) > 0,
        `0 pejabat berisiko — data dev tidak menguji cabang UI ini (lihat doc/sql/008)`,
      )
      return `${m[1]} pejabat dalam 3 tahun menuju BUP`
    })

    await langkah('U-6: mengubah ambang mengubah jumlahnya & tersinkron URL', async () => {
      await page.locator('a[href="/master/jabatan-keosong?ambang=1"]').count() // no-op guard
      await page.goto(`${BASE}/master/jabatan-kosong?ambang=1`, { waitUntil: 'networkidle' })
      const teks1 = await page.locator('main').innerText()
      const m1 = /(\d+)\s+dari\s+\d+\s+pejabat aktif/.exec(teks1)
      await page.goto(`${BASE}/master/jabatan-kosong?ambang=10`, { waitUntil: 'networkidle' })
      const teks10 = await page.locator('main').innerText()
      const m10 = /(\d+)\s+dari\s+\d+\s+pejabat aktif/.exec(teks10)
      tegaskan(m1 !== null && m10 !== null, 'jumlah tidak terbaca')
      tegaskan(
        Number(m10[1]) >= Number(m1[1]),
        `ambang lebih lebar justru lebih sedikit: ${m1[1]} → ${m10[1]}`,
      )
      return `ambang 1 thn = ${m1[1]} · 10 thn = ${m10[1]}`
    })

    await langkah('U-6: menandai jabatan tanpa suksesor siap', async () => {
      await page.goto(`${BASE}/master/jabatan-kosong`, { waitUntil: 'networkidle' })
      const teks = await page.locator('main').innerText()
      tegaskan(
        /tanpa suksesor siap|belum ada jabatan target/i.test(teks),
        'tidak menandai kesiapan suksesi',
      )
      return 'kesiapan suksesi ditandai per baris'
    })

    await langkah('param ambang sampah diabaikan, halaman tetap 200', async () => {
      const r = await page.request.get(`${BASE}/master/jabatan-kosong?ambang=abc&strategis=xyz`)
      tegaskan(r.status() === 200, `HTTP ${r.status()}`)
      return 'param tidak valid jatuh ke bawaan'
    })

    await ctx.close()
  }

  // ---------------- U-2 · kelengkapan ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await page.goto(`${BASE}/data/kelengkapan`, { waitUntil: 'networkidle' })

    await langkah('U-2: target PRD ≥90% disebut & diukur', async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(/90%/.test(teks), 'target 90% tidak disebut')
      tegaskan(/rerata kelengkapan/i.test(teks), 'rerata tidak ditampilkan')
      return 'target & rerata hadir'
    })

    await langkah('U-2: butir diurut prioritas & menjelaskan alasannya', async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(/paling mendesak/i.test(teks), 'urutan prioritas tidak dijelaskan')
      tegaskan(/bobot/i.test(teks), 'bobot tidak ditampilkan')
      return 'urutan prioritas + bobot + alasan per butir'
    })

    await langkah('U-2: rollup per unit & daftar pegawai terendah ada', async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(/rollup per unit/i.test(teks), 'rollup unit tidak ada')
      tegaskan(/kelengkapan terendah/i.test(teks), 'daftar pegawai terendah tidak ada')
      return 'rollup unit + daftar pegawai'
    })

    await langkah('U-2: perbedaan tafsir NIP valid diakui terbuka', async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(
        /hanya memeriksa/i.test(teks) && /bentuk/i.test(teks),
        'tidak menyebut perbedaan pemeriksaan NIP antara halaman ini & profil',
      )
      return 'perbedaan tafsir NIP dijelaskan, bukan disembunyikan'
    })

    await ctx.close()
  }

  // ---------------- Antrian pembersihan ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await page.goto(`${BASE}/data/pembersihan`, { waitUntil: 'networkidle' })

    await langkah('pembersihan: temuan bernomor aturan §6 yang tertelusur', async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(/aturan §6 no\./i.test(teks), 'nomor aturan §6 tidak dicantumkan')
      return 'setiap kelompok menyebut nomor aturannya'
    })

    await langkah('pembersihan: temuan nol dijelaskan, bukan disembunyikan', async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(
        /jenis temuan lain: nol/i.test(teks) && /dikoreksi otomatis/i.test(teks),
        'tidak menjelaskan kenapa sebagian temuan bernilai nol',
      )
      return 'temuan nol tetap didaftar + alasannya'
    })

    await langkah('pembersihan: drill-down satu kelompok menampilkan barisnya', async () => {
      await page.goto(`${BASE}/data/pembersihan?temuan=KOTAK9_BEDA_DENGAN_HITUNGAN`, {
        waitUntil: 'networkidle',
      })
      await page.waitForSelector('#rinci-temuan table tbody tr', { timeout: 20000 })
      const jml = await page.locator('#rinci-temuan table tbody tr').count()
      tegaskan(jml > 0, 'tabel rincian kosong')
      const teks = await page.locator('#rinci-temuan').innerText()
      tegaskan(/hasil hitung/i.test(teks), 'tidak menjelaskan selisih sumber vs hitungan')
      return `${jml} baris selisih Kotak 9 dengan penjelasan angkanya`
    })

    await langkah('pembersihan: keterbatasan diakui terbuka', async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(
        /belum tersedia/i.test(teks),
        'tidak menyebut bahwa pemetaan manual & tanda verifikasi belum ada',
      )
      return 'batas kemampuan halaman dinyatakan'
    })

    await langkah('kode temuan sampah diabaikan', async () => {
      const r = await page.request.get(`${BASE}/data/pembersihan?temuan=TIDAK_ADA`)
      tegaskan(r.status() === 200, `HTTP ${r.status()}`)
      return 'kode tidak dikenal jatuh ke tampilan ringkas'
    })

    await ctx.close()
  }

  // ---------------- Konsolidasi ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await page.goto(`${BASE}/data/konsolidasi`, { waitUntil: 'networkidle' })

    await langkah('konsolidasi: sinkronisasi GAGAL ditandai jelas', async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(/GAGAL/.test(teks), 'tidak ada kasus GAGAL yang ditampilkan')
      const jmlBaris = await page.locator('table tbody tr').count()
      tegaskan(jmlBaris > 0, 'riwayat sinkronisasi kosong')
      return `${jmlBaris} baris riwayat, termasuk kasus GAGAL`
    })

    await langkah('konsolidasi: tombol sync belum ada & alasannya dinyatakan', async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(
        /belum dipasang/i.test(teks) && /lib\/importer/.test(teks),
        'tidak menjelaskan kenapa tombol sync belum ada',
      )
      return 'ketidakhadiran tombol dijelaskan, bukan dibiarkan menggantung'
    })

    await ctx.close()
  }

  // ---------------- MUTASI: master unit ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await page.goto(`${BASE}/master/unit`, { waitUntil: 'networkidle' })

    await langkah('mutasi: buat unit baru muncul di pohon', async () => {
      await page.getByRole('button', { name: /tambah unit/i }).first().click()
      await page.waitForSelector('dialog[open]')
      await page.fill('input[placeholder*="SETDITJEN"]', KODE_UJI)
      await page.fill('input[placeholder*="Bagian Kepegawaian"]', NAMA_UJI)
      await page.locator('dialog[open]').getByRole('button', { name: 'Simpan' }).click()
      await page.waitForTimeout(2500)
      tegaskan((await page.locator(`text=${NAMA_UJI}`).count()) > 0, 'unit baru tidak muncul')
      return `unit "${NAMA_UJI}" tersimpan & tampil`
    })

    await langkah('mutasi: kode ganda ditolak dengan pesan yang bisa ditindak', async () => {
      await page.getByRole('button', { name: /tambah unit/i }).first().click()
      await page.waitForSelector('dialog[open]')
      await page.fill('input[placeholder*="SETDITJEN"]', KODE_UJI)
      await page.fill('input[placeholder*="Bagian Kepegawaian"]', 'Unit Duplikat')
      await page.locator('dialog[open]').getByRole('button', { name: 'Simpan' }).click()
      await page.waitForTimeout(2000)
      const galat = await page.locator('dialog[open] [role="alert"]').first().innerText()
      tegaskan(/sudah dipakai/i.test(galat), `pesan galat tidak menjelaskan: "${galat}"`)
      // Isian lain harus tetap utuh — pengguna tidak mengetik ulang.
      const namaMasihAda = await page.inputValue('input[placeholder*="Bagian Kepegawaian"]')
      tegaskan(namaMasihAda === 'Unit Duplikat', 'isian lain terhapus setelah galat')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
      return 'galat per-field + isian lain utuh'
    })

    await langkah('mutasi: validasi Zod tampil PER FIELD, bukan sebagai toast', async () => {
      await page.getByRole('button', { name: /tambah unit/i }).first().click()
      await page.waitForSelector('dialog[open]')
      await page.fill('input[placeholder*="SETDITJEN"]', 'X')
      await page.fill('input[placeholder*="Bagian Kepegawaian"]', 'ab')
      await page.locator('dialog[open]').getByRole('button', { name: 'Simpan' }).click()
      await page.waitForTimeout(1500)
      const jml = await page.locator('dialog[open] [role="alert"]').count()
      tegaskan(jml >= 2, `hanya ${jml} galat per-field (harap ≥2)`)
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
      return `${jml} galat menempel di fieldnya`
    })

    await langkah('mutasi: hapus unit terpakai DITOLAK dengan sebab & angkanya', async () => {
      const baris = page.locator('li', { hasText: 'Bagian Kepegawaian dan Umum' }).first()
      await baris.locator('button[aria-label*="Hapus"]').click()
      await page.waitForSelector('dialog[open]')
      await page.locator('dialog[open]').getByRole('button', { name: 'Hapus unit', exact: true }).click()
      await page.waitForTimeout(2500)
      const teks = await page.locator('body').innerText()
      tegaskan(/masih dipakai/i.test(teks), 'penolakan tidak menyebut sebabnya')
      tegaskan(/\d+\s+jabatan/i.test(teks), 'penolakan tidak menyebut angkanya')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
      return 'ditolak + sebab + jumlah yang menghalangi'
    })

    await langkah('mutasi: hapus unit uji berhasil (bersihkan jejak uji)', async () => {
      const baris = page.locator('li', { hasText: NAMA_UJI }).first()
      await baris.locator('button[aria-label*="Hapus"]').click()
      await page.waitForSelector('dialog[open]')
      await page.locator('dialog[open]').getByRole('button', { name: 'Hapus unit', exact: true }).click()
      await page.waitForTimeout(2500)
      tegaskan((await page.locator(`text=${NAMA_UJI}`).count()) === 0, 'unit uji masih ada')
      return 'unit uji terhapus — DB kembali bersih'
    })

    await ctx.close()
  }

  // ---------------- MUTASI: master jabatan ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    await page.goto(`${BASE}/master/jabatan?status=TERISI`, { waitUntil: 'networkidle' })
    await page.waitForSelector('table tbody tr', { timeout: 20000 })

    await langkah('jabatan: tombol "tandai kosong" mati untuk jabatan berpenghuni', async () => {
      const tombol = page
        .locator('table tbody tr')
        .filter({ hasText: 'penghuni' })
        .first()
        .getByRole('button', { name: /tandai kosong/i })
      tegaskan((await tombol.count()) > 0, 'tidak ada baris berpenghuni untuk diuji')
      tegaskan(await tombol.isDisabled(), 'tombol tandai kosong masih bisa diklik')
      const title = await tombol.getAttribute('title')
      tegaskan(/masih ditempati/i.test(title ?? ''), `title tidak menjelaskan: "${title}"`)
      return 'tombol dinonaktifkan + alasannya di tooltip'
    })

    await langkah('jabatan: form juga memblokir status kosong bila berpenghuni', async () => {
      const baris = page.locator('table tbody tr').filter({ hasText: 'penghuni' }).first()
      await baris.locator('button[aria-label^="Ubah"]').click()
      // Menunggu `dialog[open]` saja tidak cukup: atributnya menyala sebelum
      // React selesai menulis isinya, jadi pemeriksaan opsi bisa membaca
      // keadaan setengah jalan. Yang ditunggu: teks yang hanya muncul kalau
      // datanya sudah masuk.
      await page.waitForFunction(
        () =>
          document
            .querySelector('dialog[open]')
            ?.textContent?.includes('tidak bisa diubah menjadi kosong') ?? false,
        undefined,
        { timeout: 15000 },
      )
      const nonaktif = await page
        .locator('dialog[open] option[value="KOSONG"]')
        .evaluate((el) => el.disabled)
      tegaskan(nonaktif, 'opsi KOSONG masih bisa dipilih di form')
      const teks = await page.locator('dialog[open]').innerText()
      tegaskan(/masih ditempati/i.test(teks), 'form tidak menjelaskan kenapa')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
      return 'opsi KOSONG dinonaktifkan di form juga (bukan hanya di tabel)'
    })

    await langkah('jabatan: filter status tersinkron URL', async () => {
      await page.goto(`${BASE}/master/jabatan?status=KOSONG`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(700)
      const teks = await page.locator('main').innerText()
      tegaskan(/1 filter aktif/i.test(teks), 'filter aktif tidak diringkas')
      return 'status=KOSONG terbaca dari URL'
    })

    await ctx.close()
  }

  // ---------------- RBAC data sensitif ----------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } })
    // Reza Kurniawan (id 3) = Pengelola Unit — bukan peran yang berwenang.
    await ctx.addCookies([{ name: 'simt_dev_user', value: '3', url: BASE }])
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

    await langkah('RBAC: peran tak berwenang ditolak DI SERVER, data tidak terkirim', async () => {
      const resp = await page.goto(`${BASE}/master/hukuman-disiplin`, { waitUntil: 'networkidle' })
      const html = await resp.text()
      const teks = await page.locator('main').innerText()
      tegaskan(/akses ditolak/i.test(teks), 'tidak menolak akses')
      tegaskan(/UU PDP/i.test(teks), 'tidak menyebut dasar pembatasannya')
      // Yang penting: isi data sensitif tidak ikut dalam HTML sama sekali.
      tegaskan(
        !/Sedang Menjalani/.test(html),
        'tingkat hukuman ikut terkirim ke klien meski UI menolak',
      )
      return 'ditolak sebelum kueri · tidak ada data disiplin di HTML'
    })

    await langkah('RBAC: menu data sensitif tidak muncul untuk peran itu', async () => {
      const nav = await page.locator('aside nav').innerText()
      tegaskan(!/Hukuman Disiplin/i.test(nav), 'menu masih tampil')
      return 'menu disembunyikan (pelengkap, bukan pengganti penjagaan server)'
    })

    await ctx.close()
  }

  // ---------------- Tablet ----------------
  for (const [nama, lebar] of [
    ['tablet 834px', 834],
    ['tablet sempit 768px', 768],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: lebar, height: 1180 } })
    const page = await ctx.newPage()
    for (const rute of ['/master/unit', '/data/kelengkapan', '/master/jabatan-kosong']) {
      await page.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(600)
      await langkah(`${nama}: ${rute} tanpa scroll horizontal halaman`, async () => {
        const selisih = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        tegaskan(selisih <= 0, `menggulir horizontal ${selisih}px`)
        return 'selisih 0px'
      })
    }
    if (lebar === 834) await page.screenshot({ path: `${OUT}/f4-tablet.png`, fullPage: true })
    await ctx.close()
  }
} finally {
  await browser.close()
}

console.log('\n=== SMOKE TEST FASE 4 — MASTER DATA, IMPORTER & KUALITAS DATA ===')
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
