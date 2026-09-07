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

/**
 * NIP contoh DITURUNKAN dari direktori, tidak dipaku.
 *
 * Sebelumnya `const NIP = '196912241998032005'` — dan pegawai itu **sudah tidak
 * ada** sejak populasi dikurasi. Akibatnya baris `/talenta/<nip>` melaporkan
 * "KURANG" untuk kelima peran sekaligus: lima alarm palsu yang justru menutupi
 * temuan RBAC yang sebenarnya, sebab mata langsung terlatih mengabaikan blok
 * merah yang "selalu merah". Konstanta data di harness audit adalah bom waktu.
 */
async function nipContoh(page, base) {
  await page.goto(`${base}/talenta`, { waitUntil: 'load', timeout: 90000 })
  const nip = await page.evaluate(() => {
    const a = [...document.querySelectorAll('table tbody tr td a[href^="/talenta/"]')]
      .map((e) => e.getAttribute('href').split('/').pop())
      .filter((n) => /^\d{18}$/.test(n))
    return a[0] ?? null
  })
  if (nip === null) throw new Error('Tidak ada NIP di direktori — audit tidak bisa menguji /talenta/<nip>')
  return nip
}

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
const halamanUntuk = (NIP) => [
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
  /*
    BARIS `/jabatan-target` KEDUA DIHAPUS.

    URL yang sama terdaftar dua kali dengan harapan peran BERBEDA — `[SA, AT]`
    (§6.5, baris di atas) dan `[SA, AT, PM]` (§6.4, baris ini) — sehingga salah
    satunya DIJAMIN salah apa pun perilaku aplikasinya, dan totalnya selalu
    menghitung satu selisih hantu. Yang dipertahankan §6.5, sebab itu bagian PRD
    yang mengatur halaman Daftar Jabatan Target; §6.4 mengatur Master Data.
    Kalau ternyata Pimpinan memang boleh, yang perlu diubah adalah SATU baris
    §6.5 itu — bukan menambah baris kedua yang bertentangan dengannya.
  */
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
  // NIP diambil sekali sebagai Super Admin (yang pasti melihat seluruh direktori),
  // lalu dipakai untuk semua peran — supaya yang diuji adalah GERBANGNYA, bukan
  // perbedaan NIP yang kebetulan terlihat masing-masing peran.
  const ctxSa = await konteksMasuk(browser, { base: BASE, akun: AKUN.superAdmin })
  const pageSa = await ctxSa.newPage()
  const NIP = await nipContoh(pageSa, BASE)
  await ctxSa.close()
  tulis(`NIP contoh (diturunkan dari direktori): ${NIP}\n`)
  const HALAMAN = halamanUntuk(NIP)

  for (const [peran, akun] of PERAN) {
    const ctx = await konteksMasuk(browser, { base: BASE, akun })
    const page = await ctx.newPage()
    for (const h of HALAMAN) {
      let teks = ''
      try {
        await page.goto(BASE + h.url, { waitUntil: 'networkidle', timeout: 90000 })
        /*
          DITUNGGU sampai isinya BERHENTI BERUBAH, bukan dibaca seketika.

          `waitUntil: 'load'` lalu langsung `innerText` adalah balapan: panel
          "Akses ditolak" pada sebagian halaman dialirkan lewat Suspense, jadi
          audit bisa membacanya sebelum panel itu mendarat — melihat halaman yang
          "tidak menolak" lalu menyimpulkan gerbangnya bocor. Terbukti 22 Agu
          2026: audit melaporkan "LEBIH Pimpinan → /master/hukuman-disiplin",
          padahal pemeriksaan langsung menunjukkan Pimpinan MEMANG ditolak
          (`Akses ditolak` ada, 0 baris tabel, 0 nama orang).

          Arah kesalahannya penting: membaca terlalu cepat membuat audit
          MELEBIHKAN jumlah lubang. Tapi audit yang melaporkan puluhan lubang
          yang sebagiannya palsu tetap berbahaya — daftar yang tidak bisa
          dipercaya berhenti dibaca, dan lubang nyata ikut terkubur di dalamnya.

          Penantiannya generik (panjang teks berhenti bertambah antar dua
          cuplikan) supaya tidak bergantung pada kalimat khas tiap halaman —
          kalimat yang berubah setiap kali salinan UI disunting.
        */
        await page
          .waitForFunction(
            () => {
              const n = document.body.innerText.length
              if (window.__panjangSebelumnya === n) return true
              window.__panjangSebelumnya = n
              return false
            },
            undefined,
            { timeout: 20000, polling: 500 },
          )
          .catch(() => {})
        teks = await page.evaluate(() => document.body.innerText)
      } catch (e) {
        teks = `GALAT: ${e.message}`
      }
      const ditolak = /Akses ditolak/i.test(teks)
      /*
        "tidak ditemukan" TIDAK lagi dianggap penolakan.

        Halaman sah yang sedang kosong berkata "Tidak ada data yang cocok" /
        "tidak ditemukan", dan menyamakannya dengan penolakan akses membuat audit
        menyatakan gerbang bekerja padahal halamannya cuma kosong. Itu arah
        kesalahan yang JAUH lebih berbahaya daripada sebaliknya: lubang nyata
        dilaporkan aman. Yang tetap dihitung penolakan hanya halaman 404 sungguhan.
      */
      const takDitemukan = /Halaman tidak ditemukan|Profil tidak ditemukan/i.test(
        teks.slice(0, 600),
      )
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
