import { AKUN, konteksMasuk } from './_masuk.mjs'
import { chromium } from 'playwright'

/**
 * Sapu SELURUH halaman dan laporkan setiap teks yang TERPOTONG di layar.
 *
 * Tiga bentuk pemotongan yang dicari, semuanya diukur dari DOM yang sudah
 * dirender — bukan dari grep kelas Tailwind, sebab `truncate` yang wadahnya
 * cukup lebar tidak memotong apa pun, dan sebaliknya elemen tanpa `truncate`
 * tetap bisa terpotong oleh `overflow: hidden` induknya:
 *
 *   - ELIPSIS  : `text-overflow: ellipsis` DAN isinya memang lebih lebar
 *   - KLIP     : isinya lebih lebar/tinggi dari kotaknya sementara overflow-nya
 *                hidden/clip (terpotong TANPA "…", yang lebih buruk lagi)
 *   - CLAMP    : `-webkit-line-clamp` yang benar-benar memotong baris
 *
 * ## Cara memakai
 *
 *   npm run audit:terpotong -- http://localhost:5000 1440
 *
 * Butuh server hidup + sesi (ia masuk sendiri sebagai Super Admin). Jalankan di
 * beberapa lebar — pemotongan lahir dari lebar, jadi "bersih di 1440" tidak berarti
 * apa-apa untuk 1024. Terukur saat dibuat: 64 temuan di 1440px · 69 di 1280 · 203 di
 * 1024, seluruhnya elipsis pada nama jabatan/unit, jejak breadcrumb, label sidebar,
 * dan alamat IP di Audit Log.
 *
 * `sr-only` DIKECUALIKAN: ia memang dipotong 1×1px, dan tanpa pengecualian itu ia 97
 * dari 161 "temuan" — daftar yang sebagian besarnya bukan cacat akan berhenti dibaca.
 * Kalau suatu saat hasilnya 0 dan Anda ragu alatnya masih bekerja, matikan baris
 * pengecualian itu sementara: ia harus kembali melaporkan ~97 KLIP.
 */
const BASE = process.argv[2] ?? 'http://localhost:5000'
const LEBAR = process.argv[3] ? Number(process.argv[3]) : 1440

const RUTE = [
  '/', '/talenta', '/peta-talenta', '/bandingkan',
  '/jabatan-target', '/jabatan-target/386', '/jabatan-target/386?tab=syarat',
  '/jabatan-target/386?tab=rubrik', '/jabatan-target/386/kandidat', '/jabatan-target/386/simulasi',
  '/master/unit', '/master/jabatan', '/master/kategori-diklat', '/master/hukuman-disiplin',
  '/data/kelengkapan', '/data/pembersihan', '/data/konsolidasi', '/data/validasi-riwayat',
  '/talent-pool', '/nominasi', '/rencana-pengembangan', '/inbox', '/profil',
  '/admin/pengguna', '/admin/audit-log', '/admin/pengaturan',
  '/admin/api', '/admin/api/log', '/admin/api/dokumentasi',
  '/laporan/gap-analysis', '/laporan/nominasi', '/laporan/ekspor',
]

const browser = await chromium.launch()
const ctx = await konteksMasuk(browser, { base: BASE, akun: AKUN.superAdmin, viewport: { width: LEBAR, height: 1000 } })
const page = await ctx.newPage()

const PEMERIKSA = () => {
  const hasil = []
  const els = document.querySelectorAll('main *, header *, aside *')
  for (const el of els) {
    const teks = (el.textContent ?? '').trim()
    if (teks === '') continue
    // Hanya daun teks: elemen pembungkus akan melaporkan hal yang sama dua kali.
    if (el.children.length > 0 && [...el.children].some((c) => (c.textContent ?? '').trim() !== '')) continue
    const g = getComputedStyle(el)
    if (g.display === 'none' || g.visibility === 'hidden' || el.getClientRects().length === 0) continue
    /*
      `sr-only` MEMANG terpotong — begitulah cara ia disembunyikan dari layar
      sambil tetap terbaca pembaca layar (1×1px + overflow hidden). Tanpa
      pengecualian ini ia 97 dari 161 "temuan", dan daftar yang sebagian besarnya
      bukan cacat akan berhenti dibaca.
    */
    if (el.closest('.sr-only') !== null) continue

    const lebarLebih = el.scrollWidth - el.clientWidth > 1
    const tinggiLebih = el.scrollHeight - el.clientHeight > 1
    const sembunyiX = g.overflowX === 'hidden' || g.overflowX === 'clip'
    const sembunyiY = g.overflowY === 'hidden' || g.overflowY === 'clip'

    let jenis = null
    if (g.textOverflow === 'ellipsis' && lebarLebih) jenis = 'ELIPSIS'
    else if (g.webkitLineClamp && g.webkitLineClamp !== 'none' && tinggiLebih) jenis = 'CLAMP'
    else if ((lebarLebih && sembunyiX) || (tinggiLebih && sembunyiY)) jenis = 'KLIP'
    if (jenis === null) continue

    hasil.push({
      jenis,
      teks: teks.slice(0, 70),
      tag: el.tagName.toLowerCase(),
      kelas: (typeof el.className === 'string' ? el.className : '').slice(0, 90),
      lebar: `${el.clientWidth}/${el.scrollWidth}`,
    })
  }
  return hasil
}

let total = 0
const perJenis = {}
for (const rute of RUTE) {
  try {
    await page.goto(`${BASE}${rute}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    // Isi <Suspense> perlu ditunggu; tanpa ini yang terukur skeleton.
    await page.waitForFunction(() => document.body.innerText.length > 1200, undefined, { timeout: 30_000 }).catch(() => {})
    await page.waitForTimeout(1200)
    const temuan = await page.evaluate(PEMERIKSA)
    if (temuan.length > 0) {
      console.log(`\n── ${rute} · ${temuan.length} temuan`)
      for (const t of temuan.slice(0, 8)) {
        console.log(`   [${t.jenis}] ${t.lebar}px "${t.teks}"`)
        console.log(`             ${t.tag}.${t.kelas}`)
      }
      if (temuan.length > 8) console.log(`   … +${temuan.length - 8} lagi`)
    }
    total += temuan.length
    for (const t of temuan) perJenis[t.jenis] = (perJenis[t.jenis] ?? 0) + 1
  } catch (e) {
    console.log(`\n!! ${rute}: ${String(e).split('\n')[0]}`)
  }
}
console.log(`\n=== TOTAL teks terpotong di ${LEBAR}px: ${total} ===`)
console.log(Object.entries(perJenis).map(([k, v]) => `${k}=${v}`).join(' · ') || '(bersih)')
await browser.close()
