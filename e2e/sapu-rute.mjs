/**
 * Sapu SETIAP rute aplikasi dan laporkan yang gagal render.
 *
 * Permintaan pemilik proses 1 Sep 2026, sesudah `/jabatan-target` jatuh dengan
 * "Halaman gagal dimuat": *"cek lagi semua page atau fitur ada yang kasus kaya gitu
 * gak"*.
 *
 * ## Kenapa uji ini ADA, padahal typecheck & 582 uji unit hijau
 *
 * Kueri hidup di dalam **template literal**. TypeScript tidak melihat ke dalamnya,
 * jadi alias SQL yang salah — `a.jabatan_id` yang JOIN-nya sudah diganti — lolos
 * seluruh pemeriksaan statis dan baru meledak saat halamannya dibuka. Uji unit juga
 * tidak menjangkaunya: `lib/scoring` sengaja bebas DB, jadi yang diuji rumusnya,
 * bukan SQL-nya.
 *
 * Satu-satunya cara menemukan kelas galat itu adalah MEMBUKA halamannya. Berkas ini
 * membuka semuanya, dan sengaja murah supaya bisa dijalankan tiap kali kueri
 * disentuh — tanpa mengklik apa pun, tanpa menulis apa pun.
 *
 * Jalankan dengan server hidup:
 *   node e2e/sapu-rute.mjs [folder-screenshot] [base-url]
 */

import { chromium } from '@playwright/test'

import { konteksMasuk } from './_masuk.mjs'

const BASE = process.argv[3] ?? 'http://localhost:3000'

/**
 * Rute berparameter memakai id/nip yang DITURUNKAN dari DB saat berjalan — id yang
 * dipaku sudah enam kali meledak di repo ini setelah datanya berubah.
 */
const RUTE_STATIS = [
  '/',
  '/talenta',
  '/peta-talenta',
  '/bandingkan',
  '/jabatan-target',
  '/talent-pool',
  '/nominasi',
  '/rencana-pengembangan',
  '/inbox',
  '/profil',
  '/master/unit',
  '/master/jabatan',
  '/master/hukuman-disiplin',
  '/master/kategori-diklat',
  '/data/kelengkapan',
  '/data/pembersihan',
  '/data/konsolidasi',
  '/data/validasi-riwayat',
  '/admin/pengguna',
  '/admin/audit-log',
  '/admin/pengaturan',
  '/admin/api',
  '/admin/api/log',
  '/admin/api/dokumentasi',
  '/laporan/gap-analysis',
  '/laporan/nominasi',
  '/laporan/ekspor',
]

const hasil = []

const browser = await chromium.launch()
try {
  const ctx = await konteksMasuk(browser, { base: BASE, viewport: { width: 1600, height: 1100 } })
  const page = await ctx.newPage()

  // Rute berparameter: ambil subjek nyata dari halaman daftarnya sendiri.
  await page.goto(`${BASE}/jabatan-target`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('main a[href^="/jabatan-target/"]', { timeout: 45000 }).catch(() => {})
  const idTarget = await page
    .locator('main a[href^="/jabatan-target/"]')
    .evaluateAll((as) => {
      for (const a of as) {
        const m = /^\/jabatan-target\/(\d+)$/.exec(a.getAttribute('href') ?? '')
        if (m !== null) return m[1]
      }
      return null
    })

  await page.goto(`${BASE}/talenta`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('main a[href^="/talenta/"]', { timeout: 45000 }).catch(() => {})
  const nip = await page
    .locator('main a[href^="/talenta/"]')
    .first()
    .getAttribute('href')
    .then((h) => (h ?? '').split('/').pop())
    .catch(() => null)

  const rute = [
    ...RUTE_STATIS,
    // Varian berparameter halaman yang paling banyak menyentuh SQL.
    ...(idTarget === null
      ? []
      : [
          `/jabatan-target/${idTarget}`,
          `/jabatan-target/${idTarget}?tab=anggota`,
          `/jabatan-target/${idTarget}?tab=syarat`,
          `/jabatan-target/${idTarget}?tab=rubrik`,
          `/jabatan-target/${idTarget}/kandidat`,
          `/jabatan-target/${idTarget}/simulasi`,
          `/peta-talenta?target=${idTarget}`,
          `/talent-pool?target=${idTarget}`,
        ]),
    ...(nip == null ? [] : [`/talenta/${nip}`, `/talenta/${nip}?semuaTarget=1`]),
    // Penyaring yang menyentuh kueri berbeda.
    '/talenta?rumpun=kepala%20balai',
    '/peta-talenta?rumpun=kepala%20sub%20bagian',
    '/jabatan-target#jabatan-kosong',
  ]

  for (const r of rute) {
    const galat = []
    page.removeAllListeners('pageerror')
    page.on('pageerror', (e) => galat.push(e.message))

    const resp = await page.goto(BASE + r, { waitUntil: 'domcontentloaded' }).catch(() => null)
    /*
      Ditunggu sampai isinya BENAR-BENAR tergambar, bukan sampai `domcontentloaded`:
      panel dialirkan lewat `<Suspense>`, dan galat kueri muncul saat panelnya
      dirender — jauh sesudah HTML pertama terkirim. Memeriksa terlalu cepat
      menghasilkan "semua hijau" atas halaman yang belum tentu selesai.
    */
    await page
      .waitForFunction(
        () => {
          const t = document.querySelector('main')?.innerText ?? ''
          return t.length > 120 || /gagal dimuat|tidak ditemukan|Akses ditolak/i.test(t)
        },
        null,
        { timeout: 30000 },
      )
      .catch(() => {})
    await page.waitForTimeout(700)

    const teks = await page.locator('main').innerText().catch(() => '')
    const status = resp === null ? 0 : resp.status()
    const jatuh = /Halaman gagal dimuat|Server Components render|Application error/i.test(teks)

    hasil.push({
      rute: r,
      status,
      jatuh,
      galat: galat.slice(0, 1).join(' | '),
      ok: status < 400 && !jatuh,
    })
  }
} finally {
  await browser.close()
}

const gagal = hasil.filter((h) => !h.ok)
for (const h of hasil) {
  console.log(`${h.ok ? 'OK    ' : 'JATUH '} ${String(h.status).padEnd(4)} ${h.rute}`)
  if (!h.ok && h.galat) console.log(`         ${h.galat.slice(0, 160)}`)
}
console.log(`\nRingkasan: ${hasil.length - gagal.length}/${hasil.length} rute sehat`)
if (gagal.length > 0) {
  console.log('JATUH:')
  for (const h of gagal) console.log(`  ${h.rute}`)
}
