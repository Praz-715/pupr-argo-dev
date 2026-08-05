/**
 * Crawler audit: kunjungi seluruh route (+varian query ekstrem) sebagai
 * beberapa peran, catat status HTTP, galat konsol, galat halaman, dan
 * kemunculan error boundary.
 *
 *   node e2e/_audit-crawl.mjs http://localhost:3000 [peran]
 */
import { appendFileSync, writeFileSync } from 'node:fs'

import { chromium } from 'playwright'

import { AKUN, konteksMasuk } from './_masuk.mjs'

const BASE = process.argv[2] || 'http://localhost:3000'
const HANYA = process.argv[3] || null
const LOG = 'e2e/_audit-crawl.log'
const NIP = '196912241998032005'

function tulis(baris) {
  appendFileSync(LOG, baris + '\n')
  console.log(baris)
}

const ROUTES = [
  '/',
  '/talenta',
  `/talenta/${NIP}`,
  '/peta-talenta',
  '/bandingkan',
  '/jabatan-target',
  '/jabatan-target/1',
  '/jabatan-target/1/kandidat',
  '/jabatan-target/1/simulasi',
  '/master/unit',
  '/master/jabatan',
  '/master/jabatan-kosong',
  '/data/kelengkapan',
  '/data/pembersihan',
  '/data/konsolidasi',
  '/master/hukuman-disiplin',
  '/talent-pool',
  '/nominasi',
  '/nominasi/1',
  '/nominasi/6',
  '/rencana-pengembangan',
  '/inbox',
  '/profil',
  '/admin/pengguna',
  '/admin/audit-log',
  '/admin/pengaturan',
  '/lupa-password',
]

// Varian parameter ekstrem — sumber galat runtime paling umum.
const FUZZ = [
  '/talenta?hal=999',
  '/talenta?hal=abc',
  '/talenta?hal=-5',
  '/talenta?hal=0',
  '/talenta?urut=;DROP',
  '/talenta?urut=nama&arah=xxx',
  '/talenta?unit=abc',
  '/talenta?unit=99999',
  '/talenta?kotak=99',
  '/talenta?kotak=abc',
  '/talenta?pendidikan=%00',
  '/talenta?cari=%25%25%25',
  '/talenta/000',
  '/talenta/bukan-nip',
  '/peta-talenta?kotak=abc&hal=xyz',
  '/peta-talenta?tahun=abcd',
  '/peta-talenta?unit=-1',
  '/bandingkan?nip=1,2,3,4,5,6,7',
  '/bandingkan?nip=abc',
  `/bandingkan?nip=${NIP}`,
  '/bandingkan?target=999',
  '/bandingkan?target=abc',
  '/jabatan-target/999',
  '/jabatan-target/abc',
  '/jabatan-target/1/kandidat?hal=999',
  '/jabatan-target/1/kandidat?urut=xxx',
  '/jabatan-target/1/kandidat?rincian=000',
  '/jabatan-target/999/simulasi',
  '/master/unit?hal=abc',
  '/master/jabatan?hal=999&urut=xxx',
  '/master/jabatan-kosong?ambang=abc',
  '/master/jabatan-kosong?ambang=99',
  '/data/kelengkapan?unit=abc',
  '/data/pembersihan?aturan=99',
  '/data/pembersihan?aturan=abc',
  '/talent-pool?target=999',
  '/talent-pool?target=abc',
  '/nominasi?status=NGAWUR',
  '/nominasi?hal=abc',
  '/nominasi/999',
  '/nominasi/abc',
  '/admin/pengguna?hal=abc&peran=999',
  '/admin/audit-log?hal=99999',
  '/admin/audit-log?aksi=NGAWUR&dari=bukan-tanggal&sampai=xx',
  '/rencana-pengembangan?status=NGAWUR',
  '/inbox?tab=ngawur',
]

const PERAN = [
  ['superAdmin', AKUN.superAdmin],
  ['adminTalenta', AKUN.adminTalenta],
  ['pengelolaUnit', AKUN.pengelolaUnit],
  ['pimpinan', AKUN.pimpinan],
  ['viewer', AKUN.viewer],
]

const temuan = []

function catat(peran, url, jenis, pesan) {
  const t = { peran, url, jenis, pesan: String(pesan).replace(/\s+/g, ' ').slice(0, 300) }
  temuan.push(t)
  tulis(`  !! [${jenis}] ${t.pesan}`)
}

async function kunjungi(page, peran, url, sink) {
  sink.length = 0
  let status = null
  const mulai = Date.now()
  try {
    const resp = await page.goto(BASE + url, { waitUntil: 'load', timeout: 90000 })
    status = resp ? resp.status() : null
  } catch (e) {
    catat(peran, url, 'NAVIGASI', e.message)
    return
  }

  // Streaming Suspense: beri jendela singkat supaya widget sempat mendarat,
  // tapi berhenti lebih awal begitu penanda galat muncul.
  await page
    .waitForFunction(
      () => /Halaman gagal dimuat|Application error/i.test(document.body.innerText),
      null,
      { timeout: 2500 },
    )
    .catch(() => {})

  if (status && status >= 500) catat(peran, url, `HTTP ${status}`, 'server error')

  const teks = await page.evaluate(() => document.body.innerText).catch(() => '')
  if (/Halaman gagal dimuat/i.test(teks)) {
    catat(peran, url, 'ERROR BOUNDARY', teks.split('\n').slice(0, 10).join(' | '))
  }
  if (/Application error: a server-side exception/i.test(teks)) {
    catat(peran, url, 'SERVER EXCEPTION', teks.slice(0, 250))
  }

  for (const p of sink) catat(peran, url, p.jenis, p.pesan)
  return Date.now() - mulai
}

writeFileSync(LOG, `crawl ${new Date().toISOString()} ${BASE}\n`)
const browser = await chromium.launch()
try {
  for (const [label, akun] of PERAN) {
    if (HANYA && HANYA !== label) continue
    const ctx = await konteksMasuk(browser, { base: BASE, akun })
    const page = await ctx.newPage()
    const sink = []
    page.on('console', (m) => {
      if (m.type() !== 'error') return
      const t = m.text()
      if (/favicon/i.test(t)) return
      if (/Download the React DevTools/i.test(t)) return
      sink.push({ jenis: 'KONSOL', pesan: t })
    })
    page.on('pageerror', (e) => sink.push({ jenis: 'PAGEERROR', pesan: e.message }))

    const daftar = label === 'superAdmin' ? [...ROUTES, ...FUZZ] : ROUTES
    for (const url of daftar) {
      const ms = await kunjungi(page, label, url, sink)
      tulis(`${label.padEnd(14)} ${String(ms ?? '-').padStart(6)}ms  ${url}`)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}

tulis('\n================ TEMUAN ================')
if (!temuan.length) tulis('Tidak ada temuan.')
for (const t of temuan) tulis(`[${t.jenis}] ${t.peran} ${t.url}\n    ${t.pesan}`)
tulis(`\nTotal temuan: ${temuan.length}`)
