/**
 * Audit gerbang BACA per halaman terhadap kolom "Role" di doc/PRD.md §6.
 *
 * Bukan menguji menu — menu yang disembunyikan tidak menghalangi siapa pun
 * mengetik URL-nya. Yang diperiksa: apakah halaman menolak DI SERVER.
 *
 *   node e2e/_audit-rbac.mjs http://localhost:3000
 */
import { appendFileSync, writeFileSync } from 'node:fs'

import { chromium } from 'playwright'

import { AKUN, konteksMasuk } from './_masuk.mjs'

const BASE = process.argv[2] || 'http://localhost:3000'
const LOG = 'e2e/_audit-rbac.log'
const NIP = '196912241998032005'

function tulis(b) {
  appendFileSync(LOG, b + '\n')
  console.log(b)
}

const SA = 'Super Admin'
const AT = 'Admin Talenta'
const PU = 'Pengelola Unit'
const PM = 'Pimpinan'
const VW = 'Viewer'

/** Role yang menurut PRD §6 boleh MEMBACA halaman ini. */
const HALAMAN = [
  { url: '/', prd: [SA, AT, PU, PM, VW], ref: '§6.2 Semua' },
  { url: '/talenta', prd: [SA, AT, PU, PM, VW], ref: '§6.3' },
  { url: `/talenta/${NIP}`, prd: [SA, AT, PU, PM, VW], ref: '§6.3 (PU: unit sendiri)' },
  { url: '/peta-talenta', prd: [SA, AT, PM, VW], ref: '§6.3 — tanpa Pengelola Unit' },
  { url: '/bandingkan', prd: [SA, AT, PM], ref: '§6.3' },
  { url: '/jabatan-target', prd: [SA, AT], ref: '§6.5 Daftar Jabatan Target' },
  { url: '/jabatan-target/1', prd: [SA, AT], ref: '§6.5 Editor' },
  { url: '/jabatan-target/1/simulasi', prd: [SA, AT], ref: '§6.5 Simulasi & Diff' },
  { url: '/jabatan-target/1/kandidat', prd: [SA, AT, PM], ref: '§6.5 Kandidat' },
  { url: '/master/unit', prd: [SA], ref: '§6.4' },
  { url: '/master/jabatan', prd: [SA, AT], ref: '§6.4' },
  { url: '/jabatan-target', prd: [SA, AT, PM], ref: '§6.4' },
  { url: '/master/hukuman-disiplin', prd: [SA, AT], ref: '§6.4 (UU PDP)' },
  { url: '/talent-pool', prd: [SA, AT, PU, PM], ref: '§6.6' },
  { url: '/nominasi', prd: [SA, AT, PU, PM], ref: '§6.6 antrian + timeline' },
  { url: '/rencana-pengembangan', prd: [SA, AT, PM], ref: '§6.6' },
  { url: '/inbox', prd: [SA, AT, PU, PM, VW], ref: '§6.6 semua peran internal' },
  { url: '/profil', prd: [SA, AT, PU, PM, VW], ref: '§6.1' },
  { url: '/data/konsolidasi', prd: [SA], ref: '§6.7' },
  { url: '/data/pembersihan', prd: [SA, AT], ref: '§6.7' },
  { url: '/data/kelengkapan', prd: [SA, AT, PM], ref: '§6.7' },
  { url: '/admin/pengguna', prd: [SA], ref: '§6.10' },
  { url: '/admin/audit-log', prd: [SA], ref: '§6.8' },
  { url: '/admin/pengaturan', prd: [SA], ref: '§6.10' },
]

const PERAN = [
  [SA, AKUN.superAdmin],
  [AT, AKUN.adminTalenta],
  [PU, AKUN.pengelolaUnit],
  [PM, AKUN.pimpinan],
  [VW, AKUN.viewer],
]

writeFileSync(LOG, `rbac ${new Date().toISOString()} ${BASE}\n`)
const browser = await chromium.launch()
const hasil = []
try {
  for (const [peran, akun] of PERAN) {
    const ctx = await konteksMasuk(browser, { base: BASE, akun })
    const page = await ctx.newPage()
    for (const h of HALAMAN) {
      let teks = ''
      try {
        await page.goto(BASE + h.url, { waitUntil: 'load', timeout: 90000 })
        teks = await page.evaluate(() => document.body.innerText)
      } catch (e) {
        teks = `GALAT: ${e.message}`
      }
      const ditolak = /Akses ditolak/i.test(teks)
      const takDitemukan = /tidak ditemukan|404/i.test(teks.slice(0, 600))
      const bolehPrd = h.prd.includes(peran)
      const terbaca = !ditolak && !takDitemukan
      const status = terbaca === bolehPrd ? 'OK ' : terbaca ? 'LEBIH' : 'KURANG'
      hasil.push({ peran, url: h.url, ref: h.ref, bolehPrd, terbaca, status })
      tulis(`${status}  ${peran.padEnd(15)} ${h.url.padEnd(34)} prd=${bolehPrd ? 'boleh' : 'tolak'} nyata=${terbaca ? 'terbaca' : 'ditolak'}`)
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}

tulis('\n============ SELISIH TERHADAP PRD §6 ============')
const selisih = hasil.filter((h) => h.status !== 'OK ')
if (!selisih.length) tulis('Tidak ada selisih.')
for (const s of selisih) {
  tulis(
    `${s.status} ${s.peran} → ${s.url}  (PRD ${s.ref}: ${s.bolehPrd ? 'boleh baca' : 'TIDAK terdaftar'}; kenyataan: ${s.terbaca ? 'bisa baca' : 'ditolak'})`,
  )
}
tulis(`\nTotal selisih: ${selisih.length} dari ${hasil.length} kombinasi`)
