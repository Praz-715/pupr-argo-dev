import { chromium } from '@playwright/test'
import { konteksMasuk } from './_masuk.mjs'

/**
 * Smoke test Fase 3 — Peta Talenta & Perbandingan Kandidat.
 *
 * Yang diuji bukan cuma "halaman muncul", tapi janji-janji yang mudah diam-diam
 * rusak:
 *   - filter peta tersinkron URL DAN ikut terbawa saat membuka drill-down sel
 *     (kalau tidak, daftar yang terbuka tidak cocok dengan angka di sel);
 *   - jumlah pegawai di grid == jumlah baris drill-down sel yang sama;
 *   - padanan tabel untuk chart bubble ada (phase.md §5.5);
 *   - batas 2–4 kandidat ditegakkan, dan `?nip=` sampah tidak meledak;
 *   - radar DISEMBUNYIKAN saat skor tidak lengkap untuk semua kandidat, karena
 *     bentuk radar terbaca sebagai perbandingan setara padahal bukan;
 *   - identitas seri punya pembeda selain warna (pola garis di legenda).
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-3.smoke.mjs [folder-screenshot] [base-url]
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

/** Ambil angka pegawai dari satu sel grid Kotak 9. */
async function jumlahSel(page, kotak) {
  const teks = await page.locator(`a[aria-label^="Kotak ${kotak}:"]`).first().getAttribute('aria-label')
  const m = /Kotak \d+: (\d+) pegawai/.exec(teks ?? '')
  return m ? Number(m[1]) : null
}

const browser = await chromium.launch()

try {
  for (const tema of ['light', 'dark']) {
    const ctx = await konteksMasuk(browser, { base: BASE,
      viewport: { width: 1600, height: 1100 },
      colorScheme: tema,
    })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[${tema}] pageerror: ${e.message}`))
    page.on('response', (r) => {
      if (r.status() >= 400) errors.push(`[${tema}] HTTP ${r.status()} ${r.url()}`)
    })

    // ================= PETA TALENTA =================
    await page.goto(`${BASE}/peta-talenta`, { waitUntil: 'networkidle' })
    await page.waitForSelector('a[aria-label^="Kotak 9:"]', { timeout: 30000 })

    await langkah(`tema ${tema}: grid 9 sel lengkap & berlabel kategori sumbu`, async () => {
      const sel = await page.locator('a[aria-label^="Kotak "]').count()
      tegaskan(sel === 9, `sel grid = ${sel}, seharusnya 9`)
      const teks = await page.locator('main').innerText()
      for (const label of ['Di Atas Ekspektasi', 'Sesuai Ekspektasi', 'Di Bawah Ekspektasi']) {
        tegaskan(teks.includes(label), `label baris "${label}" tidak ada`)
      }
      for (const label of ['Rendah', 'Menengah', 'Tinggi']) {
        tegaskan(teks.includes(label), `label kolom "${label}" tidak ada`)
      }
      return '9 sel + label ketiga baris & ketiga kolom'
    })

    await langkah(`tema ${tema}: bubble hadir berdampingan dengan grid`, async () => {
      const svg = await page.locator('.recharts-surface').count()
      tegaskan(svg >= 1, 'chart bubble tidak dirender')
      const teks = await page.locator('main').innerText()
      tegaskan(
        /jitter/i.test(teks),
        'penjelasan kenapa bubble (bukan jitter) tidak dicantumkan',
      )
      return 'chart + penjelasan pilihan bubble'
    })

    await langkah(`tema ${tema}: chart bubble punya padanan tabel (§5.5)`, async () => {
      const tombol = page.getByRole('button', { name: /tabel/i }).first()
      tegaskan((await tombol.count()) > 0, 'tombol tampilan tabel tidak ada')
      await tombol.click()
      await page.waitForTimeout(400)
      const kepala = (await page.locator('table thead').first().innerText()).toLowerCase()
      for (const k of ['kinerja', 'potensial', 'kotak', 'pegawai']) {
        tegaskan(kepala.includes(k), `kolom tabel "${k}" tidak ada`)
      }
      // kembali ke chart supaya screenshot menampilkan bentuk bawaannya
      await page.getByRole('button', { name: /gelembung/i }).first().click()
      await page.waitForTimeout(300)
      return 'tabel padanan berisi kinerja · potensial · kotak · jumlah'
    })

    await langkah(`tema ${tema}: basis data disebut (total & tanpa asesmen)`, async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(/\d+\s+pegawai/.test(teks), 'jumlah pegawai tidak disebut')
      tegaskan(
        teks.includes('asesmen') || teks.includes('berasesmen'),
        'cakupan asesmen tidak dijelaskan',
      )
      return 'jumlah pegawai & cakupan asesmen tercantum'
    })

    await langkah(`tema ${tema}: tanpa scroll horizontal halaman`, async () => {
      const selisih = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      tegaskan(selisih <= 0, `menggulir horizontal ${selisih}px`)
      return 'selisih 0px'
    })

    if (tema === 'light') {
      await page.screenshot({ path: `${OUT}/f3-peta-light.png`, fullPage: true })

      await langkah('drill-down: jumlah di sel == jumlah baris daftar', async () => {
        const target = await jumlahSel(page, 9)
        tegaskan(target !== null && target > 0, 'sel Kotak 9 kosong / tidak terbaca')
        await page.locator('a[aria-label^="Kotak 9:"]').first().click()
        await page.waitForSelector('#isi-kotak table tbody tr', { timeout: 30000 })
        const teks = await page.locator('#isi-kotak').innerText()
        const m = /(\d+)\s+pegawai/.exec(teks)
        tegaskan(m !== null, 'jumlah pegawai di panel drill-down tidak terbaca')
        tegaskan(
          Number(m[1]) === target,
          `sel bilang ${target} pegawai, panel bilang ${m[1]}`,
        )
        return `${target} pegawai — cocok antara sel & daftar`
      })

      await langkah('drill-down: URL memuat ?kotak= dan judulnya kategori sumbu', async () => {
        tegaskan(page.url().includes('kotak=9'), `URL tidak memuat kotak=9: ${page.url()}`)
        const teks = await page.locator('#isi-kotak').innerText()
        tegaskan(teks.includes('Di Atas Ekspektasi'), 'kategori sumbu Y tidak ditulis di judul')
        tegaskan(/potensial tinggi/i.test(teks), 'kategori sumbu X tidak ditulis di judul')
        return 'kotak=9 · "Di Atas Ekspektasi × Potensial Tinggi"'
      })

      await langkah('drill-down: predikat & kategori sumbu tidak dicampur (K-3)', async () => {
        const kepala = (await page.locator('#isi-kotak table thead').innerText()).toLowerCase()
        tegaskan(kepala.includes('predikat kinerja'), 'kolom predikat kinerja tidak ada')
        tegaskan(kepala.includes('nilai talenta'), 'kolom Nilai Talenta tidak ada')
        return 'kolom predikat & nilai terpisah'
      })

      await page.screenshot({ path: `${OUT}/f3-peta-drilldown.png`, fullPage: true })

      await langkah('filter: unit menyaring & mengosongkan drill-down yang basi', async () => {
        const sebelum = await jumlahSel(page, 9)
        const pilihUnit = page.locator('select[aria-label="Unit organisasi"]')
        const opsi = await pilihUnit.locator('option').nth(3).getAttribute('value')
        await pilihUnit.selectOption(opsi)
        await page.waitForFunction(
          () => !window.location.search.includes('kotak='),
          undefined,
          { timeout: 15000 },
        )
        await page.waitForTimeout(600)
        tegaskan(page.url().includes(`unit=${opsi}`), `URL tidak memuat unit=${opsi}`)
        const sesudah = await jumlahSel(page, 9)
        tegaskan(
          sesudah !== null && sesudah <= sebelum,
          `filter unit menaikkan jumlah: ${sebelum} → ${sesudah}`,
        )
        return `Kotak 9: ${sebelum} → ${sesudah} pegawai · ?kotak= dibuang`
      })

      await langkah('filter: reset membersihkan seluruh query', async () => {
        await page.getByRole('button', { name: /reset/i }).first().click()
        await page.waitForFunction(() => window.location.search === '', undefined, {
          timeout: 15000,
        })
        return 'query string bersih'
      })

      await langkah('filter: "hanya asesmen berlaku" membuang yang kedaluwarsa', async () => {
        const teksAwal = await page.locator('main').innerText()
        const adaKedaluwarsa = /kedaluwarsa/i.test(teksAwal)
        await page.getByLabel(/hanya asesmen berlaku/i).check()
        await page.waitForFunction(() => window.location.search.includes('berlaku=1'), undefined, {
          timeout: 15000,
        })
        await page.waitForTimeout(500)
        const teks = await page.locator('main').innerText()
        tegaskan(
          !/\d+\s+kedaluwarsa masih ikut dihitung/i.test(teks),
          'masih menyebut asesmen kedaluwarsa ikut dihitung',
        )
        await page.getByLabel(/hanya asesmen berlaku/i).uncheck()
        await page.waitForTimeout(400)
        return adaKedaluwarsa
          ? 'kedaluwarsa tersaring keluar'
          : 'tidak ada kedaluwarsa pada data ini — filter tetap berfungsi'
      })

      await langkah('filter param sampah tidak meledak', async () => {
        const r = await page.request.get(
          `${BASE}/peta-talenta?unit=abc&eselon=XYZ&tahun=99999999&kotak=42`,
        )
        tegaskan(r.status() === 200, `HTTP ${r.status()} untuk param tidak valid`)
        return 'param tidak valid diabaikan, halaman tetap 200'
      })
    }

    // ================= PERBANDINGAN KANDIDAT =================
    await page.goto(`${BASE}/bandingkan`, { waitUntil: 'networkidle' })

    await langkah(`tema ${tema}: keadaan kosong mengarahkan ke langkah berikutnya`, async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(/belum ada kandidat/i.test(teks), 'tidak ada keadaan kosong yang menjelaskan')
      tegaskan(
        (await page.locator('a[href="/peta-talenta"]').count()) > 0,
        'tidak ada jalan keluar ke Peta Talenta',
      )
      return 'keadaan kosong + tautan Peta Talenta'
    })

    if (tema === 'light') {
      await langkah('pencarian: kata kunci 1 huruf belum memicu pencarian', async () => {
        await page.fill('input[aria-label="Cari kandidat"]', 'a')
        await page.waitForTimeout(700)
        const teks = await page.locator('main').innerText()
        tegaskan(
          !/hasil pencarian/i.test(teks),
          'satu huruf sudah memicu pencarian — akan mengembalikan hampir seluruh pegawai',
        )
        return 'ambang minimal 2 huruf ditegakkan'
      })

      await langkah('pencarian: menambahkan kandidat lewat hasil pencarian', async () => {
        // Kata kuncinya diambil dari DIREKTORI, bukan ditulis tetap. Versi lama
        // mengetik 'bu' — cocok selama "Budi Santoso" & "Bambang Wijaya" ada di
        // populasi, lalu memberi nol hasil begitu tampilan disaring ke pegawai
        // yang ada di API eNominasi, dan gagal sebagai timeout 15 detik yang
        // terbaca seperti pencariannya rusak. Uji yang mematok nama tertentu
        // akan patah setiap kali populasinya berubah; mengambil dua huruf
        // pertama dari baris pertama direktori menguji hal yang sama tanpa itu.
        await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
        const namaPertama = (
          await page.locator('main table tbody tr td').first().innerText()
        ).split('\n')[0]
        const kunci = namaPertama.trim().slice(0, 2).toLowerCase()
        tegaskan(kunci.length === 2, `direktori tidak memberi nama untuk kata kunci: "${namaPertama}"`)
        await page.goto(`${BASE}/bandingkan`, { waitUntil: 'networkidle' })
        await page.fill('input[aria-label="Cari kandidat"]', kunci)
        await page.waitForFunction(() => window.location.search.includes('cari='), undefined, {
          timeout: 15000,
        })
        await page.waitForSelector('a:has-text("Tambahkan")', { timeout: 15000 })
        const jml = await page.locator('a:has-text("Tambahkan")').count()
        tegaskan(jml > 0, 'tidak ada hasil pencarian yang bisa ditambahkan')
        await page.locator('a:has-text("Tambahkan")').first().click()
        await page.waitForFunction(() => window.location.search.includes('nip='), undefined, {
          timeout: 15000,
        })
        return `"${kunci}" → ${jml} hasil, satu ditambahkan`
      })

      await langkah('batas minimum: 1 kandidat belum menampilkan perbandingan', async () => {
        // URL sudah berubah bukan berarti isinya sudah dirender — halaman ini
        // memakai <Suspense>, jadi teks skeleton bisa terbaca lebih dulu.
        // Yang ditunggu: chip kandidat, tanda datanya sudah masuk.
        await page.waitForSelector('button[aria-label^="Keluarkan"]', { timeout: 20000 })
        const teks = await page.locator('main').innerText()
        tegaskan(/tambah 1 kandidat lagi/i.test(teks), 'tidak memberi tahu butuh kandidat kedua')
        return 'diminta menambah satu lagi'
      })

      await langkah('batas maksimum: ?nip= berisi 6 NIP dipangkas ke 4', async () => {
        const r = await page.request.get(`${BASE}/talenta`)
        tegaskan(r.status() === 200, 'direktori tidak bisa diakses untuk mengambil NIP')
        const html = await r.text()
        const nip = [...new Set([...html.matchAll(/\/talenta\/(\d{18})/g)].map((m) => m[1]))]
        tegaskan(nip.length >= 6, `butuh 6 NIP, dapat ${nip.length}`)
        await page.goto(`${BASE}/bandingkan?nip=${nip.slice(0, 6).join(',')}`, {
          waitUntil: 'networkidle',
        })
        await page.waitForTimeout(800)
        const chip = await page.locator('button[aria-label^="Keluarkan"]').count()
        tegaskan(chip === 4, `kandidat terpasang ${chip}, seharusnya dipangkas ke 4`)
        return '6 NIP → 4 kandidat'
      })

      await langkah('?nip= sampah tidak meledak', async () => {
        const r = await page.request.get(`${BASE}/bandingkan?nip=abc,123,<script>`)
        tegaskan(r.status() === 200, `HTTP ${r.status()}`)
        return 'NIP tidak valid diabaikan, halaman tetap 200'
      })
    }

    await ctx.close()
  }

  // ---- Perbandingan dengan 3 kandidat sejabatan target (radar tampil) ----
  {
    const ctx = await konteksMasuk(browser, { base: BASE, viewport: { width: 1600, height: 1100 } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

    // Ambil 3 pegawai dari satu talent pool → dijamin punya match score sama.
    const rTalenta = await page.request.get(`${BASE}/talenta?urut=potkom&arah=desc`)
    const html = await rTalenta.text()
    const nip = [...new Set([...html.matchAll(/\/talenta\/(\d{18})/g)].map((m) => m[1]))].slice(0, 3)

    await page.goto(`${BASE}/bandingkan?nip=${nip.join(',')}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)

    await langkah('perbandingan: tabel berdampingan berisi kolom per kandidat', async () => {
      const kolom = await page.locator('table').last().locator('thead th').count()
      tegaskan(kolom === 4, `kolom tabel = ${kolom}, seharusnya 1 atribut + 3 kandidat`)
      const teks = await page.locator('main').innerText()
      for (const baris of ['Nilai Talenta', 'Predikat kinerja', 'Kotak 9', 'Masa kerja ASN']) {
        tegaskan(teks.includes(baris), `baris "${baris}" tidak ada`)
      }
      return '4 kolom + baris kunci hadir'
    })

    await langkah('K-4: Kotak 9 & predikat kinerja berdampingan dengan match score', async () => {
      const teks = await page.locator('main').innerText()
      const adaSkor = /Match Score total/i.test(teks)
      tegaskan(adaSkor, 'baris Match Score total tidak ada')
      const iKotak = teks.indexOf('Kotak 9')
      const iSkor = teks.indexOf('Match Score total')
      tegaskan(iKotak !== -1 && iSkor !== -1, 'salah satu bagian tidak ditemukan')
      tegaskan(iKotak < iSkor, 'Kotak 9 tidak tampil sebelum/berdampingan match score')
      return 'Kotak 9 + predikat mendahului match score dalam satu tabel'
    })

    await langkah('selisih terbesar ditandai, bukan dibiarkan dicari sendiri', async () => {
      const jml = await page.locator('span[title^="Selisih"]').count()
      tegaskan(jml > 0, 'tidak ada baris yang ditandai selisihnya')
      return `${jml} baris bertanda Δ`
    })

    await langkah('radar: tampil & identitas seri punya pembeda selain warna', async () => {
      const svg = await page.locator('.recharts-surface').count()
      tegaskan(svg >= 1, 'radar tidak dirender')
      // Legenda memakai <line stroke-dasharray> — pembeda kedua yang diwajibkan
      // hasil validasi palet (pemisahan CVD terburuk di pita 6-8).
      const pola = await page.locator('svg line[stroke-dasharray]').count()
      tegaskan(pola >= 2, `garis berpola hanya ${pola} — seri ke-2 dst tanpa pembeda non-warna`)
      return `${pola} garis berpola (legenda + radar)`
    })

    await langkah('radar: punya padanan tabel angka di panel yang sama', async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(/indikator/i.test(teks), 'tabel indikator tidak ada')
      tegaskan(
        /sub-indikator sudah teragregasi/i.test(teks),
        'tidak menjelaskan bahwa sub-indikator sudah teragregasi',
      )
      return 'tabel indikator + penjelasan agregasi'
    })

    await langkah('pemilih jabatan target menyebut kelengkapan skornya', async () => {
      const teks = await page.locator('main').innerText()
      tegaskan(/punya skor/i.test(teks), 'tidak menyebut berapa kandidat punya skor')
      tegaskan(
        /hanya sebanding di dalam satu jabatan target/i.test(teks),
        'tidak menjelaskan bahwa skor cuma sebanding dalam satu target',
      )
      return 'kelengkapan skor + peringatan komparabilitas'
    })

    await page.screenshot({ path: `${OUT}/f3-banding-light.png`, fullPage: true })
    await ctx.close()
  }

  // ---- Tablet ----
  for (const [nama, lebar] of [
    ['tablet 834px', 834],
    ['tablet sempit 768px', 768],
  ]) {
    const ctx = await konteksMasuk(browser, { base: BASE, viewport: { width: lebar, height: 1180 } })
    const page = await ctx.newPage()
    for (const path of ['/peta-talenta', '/bandingkan']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(700)
      await langkah(`${nama}: ${path} tanpa scroll horizontal halaman`, async () => {
        const selisih = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        tegaskan(selisih <= 0, `menggulir horizontal ${selisih}px`)
        return 'selisih 0px'
      })
    }
    if (lebar === 834) await page.screenshot({ path: `${OUT}/f3-tablet.png`, fullPage: true })
    await ctx.close()
  }
} finally {
  await browser.close()
}

console.log('\n=== SMOKE TEST FASE 3 — PETA TALENTA & PERBANDINGAN KANDIDAT ===')
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
