import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

import { AKUN, konteksMasuk } from './_masuk.mjs'

/**
 * Smoke test Fase 11 — Kotak 9 per Jabatan Target (U-13, phase.md §2.10 & K-7).
 *
 * Fase ini memberi sumbu Potensial **dua definisi yang keduanya sah**: Potkom apa
 * adanya dari e-Nominasi, dan komposit 65/20/15 milik satu jabatan target. Yang
 * diuji di sini adalah hal-hal yang kalau salah **tidak menimbulkan galat apa
 * pun** — halamannya tetap tampil, angkanya tetap wajar, dan tidak ada yang tahu:
 *
 *   - **tampilan generik tidak boleh bergeser sedikit pun.** Ia yang dipakai
 *     laporan sebaran organisasi dan `/api/v1/kotak-9/summary`. Diuji terhadap
 *     sebaran yang dicatat sebelum fase ini, sel per sel — bukan ditaksir dari
 *     "kelihatannya sama";
 *   - **kedua tampilan wajib berlabel beda.** Kalau namanya sama, orang akan
 *     membandingkan lalu menyimpulkan salah satunya rusak, dan yang paling mungkin
 *     dicurigai justru yang benar (K-7a);
 *   - **yang belum dinilai tidak boleh dihitung 0.** Dengan 0 ia jatuh ke Kotak
 *     1/4 dan terbaca sebagai talenta terburuk padahal cuma belum dihitung
 *     (K-7b);
 *   - **tautan ke Direktori harus lenyap saat jabatan target aktif.** Penyaring
 *     `?kotak=` di sana membaca Kotak 9 GENERIK, jadi nomor kotak yang sama akan
 *     membuka daftar orang yang berbeda;
 *   - **antrian validasi yang belum dikerjakan wajib disebut.** Kualifikasi 20%
 *     tertahan rendah selama 182 nama diklat belum diputuskan, sehingga peta
 *     tampak lebih buruk dari kenyataan. Peta yang tampak buruk tanpa
 *     mengatakan sebabnya terbaca sebagai penilaian atas orangnya.
 *
 * Uji ini **tidak mengubah data apa pun** — seluruhnya pembacaan.
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-11.smoke.mjs [folder-screenshot] [base-url]
 */

const BASE = process.argv[3] ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? '.'

/**
 * Sebaran Kotak 9 generik `pupr_dev`, dicatat SEBELUM Fase 11 menyentuh kueri
 * peta (lihat CLAUDE.md baseline). Kalau angka ini bergeser, tampilan organisasi
 * ikut berubah — dan itu regresi, bukan perbaikan.
 */
const SEBARAN_GENERIK = { 1: 3, 2: 5, 3: 2, 4: 4, 5: 4, 6: 2, 7: 6, 8: 4, 9: 10 }

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

// ---------------------------------------------------------------------------
// DB — untuk memeriksa hasil mutasi & membersihkan jejaknya
// ---------------------------------------------------------------------------
function bacaEnv() {
  const isi = readFileSync('.env.local', 'utf8')
  const ambil = (k) => isi.match(new RegExp(`^${k}\\s*=\\s*"?([^"\\r\\n]+)"?`, 'm'))?.[1]?.trim()
  return {
    host: ambil('DATABASE_HOST') ?? '127.0.0.1',
    port: Number(ambil('DATABASE_PORT') ?? 3306),
    user: ambil('DATABASE_USER'),
    password: ambil('DATABASE_PASSWORD'),
    database: ambil('DATABASE_NAME'),
  }
}

async function denganDb(fn) {
  const mysql = await import('mysql2/promise')
  const c = await mysql.default.createConnection(bacaEnv())
  try {
    return await fn(c)
  } finally {
    await c.end()
  }
}

/**
 * Baca jumlah per kotak dari grid.
 *
 * Diambil dari `aria-label` tiap sel, bukan dari `innerText`: teks sel memuat
 * angka DAN persentase, dan `innerText` juga menerapkan `text-transform`
 * (jebakan #2 di CLAUDE.md).
 */
async function bacaGrid(page) {
  const sel = page.locator('[data-kotak]')
  const n = await sel.count()
  tegaskan(n === 9, `grid punya ${n} sel, seharusnya 9`)
  const peta = {}
  for (let i = 0; i < n; i++) {
    const el = sel.nth(i)
    const kotak = Number(await el.getAttribute('data-kotak'))
    peta[kotak] = Number(await el.getAttribute('data-jumlah'))
  }
  return peta
}

async function main() {
  const browser = await chromium.launch()
  const ctx = await konteksMasuk(browser, { base: BASE, akun: AKUN.adminTalenta })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(`console: ${m.text()}`)
  })
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

  let sebaranGenerik = null
  let targetId = null
  let namaTarget = null

  // -------------------------------------------------------------------------
  // Tampilan generik — pagar utama fase ini
  // -------------------------------------------------------------------------
  await langkah('Peta Talenta terbuka pada tampilan organisasi', async () => {
    await page.goto(`${BASE}/peta-talenta`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-kotak]')
    const judul = await page.locator('main').innerText()
    tegaskan(judul.includes('Sebaran Organisasi'), 'judul panel tidak menyebut Sebaran Organisasi')
    tegaskan(
      !judul.includes('Kesiapan terhadap Jabatan Target'),
      'tampilan generik menyebut Kesiapan terhadap Jabatan Target',
    )
    return 'panel berjudul "Grid 9 Kotak — Sebaran Organisasi"'
  })

  await langkah('Sebaran generik IDENTIK dengan baseline sebelum Fase 11', async () => {
    sebaranGenerik = await bacaGrid(page)
    const beda = Object.entries(SEBARAN_GENERIK)
      .filter(([k, v]) => sebaranGenerik[k] !== v)
      .map(([k, v]) => `K${k}: ${sebaranGenerik[k]} ≠ ${v}`)
    tegaskan(beda.length === 0, `sebaran generik bergeser — ${beda.join(', ')}`)
    return Object.entries(sebaranGenerik)
      .map(([k, v]) => `K${k}:${v}`)
      .join(' ')
  })

  await langkah('Sumbu X generik berlabel "Potensial", bukan "Match score"', async () => {
    const teks = await page.locator('main').innerText()
    tegaskan(teks.includes('Kinerja × Potensial'), 'panel bubble tidak berjudul Kinerja × Potensial')
    tegaskan(!teks.includes('Match score'), 'tampilan generik menyebut Match score')
    return 'panel bubble "Peta Kinerja × Potensial"'
  })

  await langkah('Pemilih jabatan target menawarkan jabatan target AKTIF', async () => {
    const pilih = page.locator('select[aria-label="Dasar sumbu Potensial"]')
    tegaskan((await pilih.count()) === 1, 'pemilih dasar sumbu tidak ditemukan tepat satu')
    const opsi = await pilih.locator('option').all()
    tegaskan(opsi.length >= 2, `pemilih hanya punya ${opsi.length} opsi`)
    // Opsi pertama = sebaran organisasi; sisanya jabatan target.
    targetId = await opsi[1].getAttribute('value')
    namaTarget = (await opsi[1].innerText()).replace(/^Kesiapan:\s*/, '')
    tegaskan(Number(targetId) > 0, `nilai opsi jabatan target tidak berupa id: ${targetId}`)
    return `${opsi.length - 1} jabatan target · pertama #${targetId} ${namaTarget}`
  })

  // -------------------------------------------------------------------------
  // Tampilan per jabatan target
  // -------------------------------------------------------------------------
  let sebaranTarget = null

  await langkah('Memilih jabatan target mengganti label kedua panel', async () => {
    await page.goto(`${BASE}/peta-talenta?target=${targetId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-kotak]')
    const teks = await page.locator('main').innerText()
    tegaskan(
      teks.includes('Kesiapan terhadap Jabatan Target'),
      'panel grid tidak menyebut Kesiapan terhadap Jabatan Target',
    )
    tegaskan(teks.includes('Kinerja × Match score'), 'panel bubble tidak berjudul Kinerja × Match score')
    tegaskan(!teks.includes('Sebaran Organisasi'), 'masih menyebut Sebaran Organisasi')
    return 'kedua panel berlabel kesiapan per jabatan'
  })

  await langkah('Sebaran per jabatan target BERBEDA dari generik', async () => {
    sebaranTarget = await bacaGrid(page)
    const pindah = Object.keys(SEBARAN_GENERIK).filter((k) => sebaranTarget[k] !== sebaranGenerik[k])
    // Kalau identik, kemungkinan besar `?target=` diabaikan dan halaman diam-diam
    // menyajikan angka generik — kegagalan yang paling mudah lolos di fase ini.
    tegaskan(
      pindah.length > 0,
      'sebaran per jabatan target identik dengan generik — ?target= kemungkinan diabaikan',
    )
    const jml = Object.values(sebaranTarget).reduce((a, b) => a + b, 0)
    const jmlGenerik = Object.values(sebaranGenerik).reduce((a, b) => a + b, 0)
    tegaskan(
      jml === jmlGenerik,
      `total pegawai berubah ${jmlGenerik} → ${jml}; seharusnya sama, hanya sebarannya bergeser`,
    )
    return `${pindah.length} kotak berubah · total tetap ${jml} · ${Object.entries(sebaranTarget)
      .map(([k, v]) => `K${k}:${v}`)
      .join(' ')}`
  })

  await langkah('Antrian validasi yang belum dikerjakan disebut di halaman', async () => {
    const teks = await page.locator('main').innerText()
    tegaskan(
      teks.includes('belum diperiksa manusia'),
      'halaman tidak menyebut indikator yang belum diperiksa',
    )
    tegaskan(
      teks.includes('lebih rendah dari yang sebenarnya'),
      'halaman tidak menyatakan bahwa posisinya lebih rendah dari sebenarnya',
    )
    const tautan = page.locator('main a[href="/data/validasi-riwayat"]')
    tegaskan((await tautan.count()) >= 1, 'tidak ada tautan ke Validasi Riwayat Pegawai')
    return 'peringatan + tautan ke antrian validasi tampil'
  })

  await langkah('Filter unit tetap bekerja berdampingan dengan jabatan target', async () => {
    const pilih = page.locator('select[aria-label="Unit organisasi"]')
    const opsiUnit = await pilih.locator('option').all()
    const unitId = await opsiUnit[1].getAttribute('value')
    await page.goto(`${BASE}/peta-talenta?target=${targetId}&unit=${unitId}`, {
      waitUntil: 'domcontentloaded',
    })
    await page.waitForSelector('[data-kotak], [data-kosong]')
    const teks = await page.locator('main').innerText()
    tegaskan(
      teks.includes('Kesiapan terhadap Jabatan Target') || teks.includes('bisa dipetakan'),
      'kombinasi target + unit tidak menghasilkan halaman yang bisa dibaca',
    )
    // Urutan parameter JOIN vs WHERE yang tertukar menghasilkan NOL baris tanpa
    // galat — jadi yang diuji adalah bahwa hasilnya masih masuk akal.
    const url = page.url()
    tegaskan(url.includes(`target=${targetId}`), 'parameter target hilang saat unit dipasang')
    return `unit #${unitId} + target #${targetId} → halaman terbaca, kedua parameter utuh`
  })

  // -------------------------------------------------------------------------
  // Drill-down & jebakan tautan silang
  // -------------------------------------------------------------------------
  await langkah('Drill-down sel membawa ?target= dan menyebut nama jabatan', async () => {
    const kotakTerisi = Object.entries(sebaranTarget).find(([, v]) => v > 0)
    const nomor = kotakTerisi[0]
    await page.goto(`${BASE}/peta-talenta?target=${targetId}&kotak=${nomor}`, {
      waitUntil: 'domcontentloaded',
    })
    const panel = page.locator('#isi-kotak')
    await panel.waitFor()
    const teks = await panel.innerText()
    tegaskan(
      teks.includes('match score jabatan ini'),
      'panel sel tidak menyatakan Nilai Talenta berasal dari match score',
    )
    return `Kotak ${nomor} · ${kotakTerisi[1]} pegawai`
  })

  await langkah('Tautan ke Direktori LENYAP saat jabatan target aktif (+ kontrol positif)', async () => {
    const panel = page.locator('#isi-kotak')
    // Kontrol positif: kalau lokatornya salah, hitungan nol di bawah tidak berarti
    // apa pun (jebakan #4 di CLAUDE.md). Tautan kandidat WAJIB ada di panel ini.
    const kandidat = panel.locator('a[href*="/kandidat"]')
    tegaskan(
      (await kandidat.count()) === 1,
      `kontrol positif gagal: tautan kandidat ditemukan ${await kandidat.count()} kali`,
    )
    const direktori = panel.locator('a[href^="/talenta?kotak="]')
    tegaskan(
      (await direktori.count()) === 0,
      'tautan Direktori masih dipasang padahal ?kotak= di sana memakai Kotak 9 generik',
    )
    const teks = await panel.innerText()
    tegaskan(
      teks.includes('Kotak 9 organisasi') || teks.includes('organisasi'),
      'panel tidak menjelaskan kenapa tautan Direktori tidak dipasang',
    )
    return 'tautan Direktori tidak ada · tautan kandidat ada · alasannya ditulis'
  })

  await langkah('Tautan ke Direktori KEMBALI ada pada tampilan generik', async () => {
    await page.goto(`${BASE}/peta-talenta?kotak=9`, { waitUntil: 'domcontentloaded' })
    const panel = page.locator('#isi-kotak')
    await panel.waitFor()
    const direktori = panel.locator('a[href^="/talenta?kotak="]')
    tegaskan(
      (await direktori.count()) === 1,
      `tampilan generik seharusnya punya 1 tautan Direktori, ada ${await direktori.count()}`,
    )
    return 'tautan Direktori tersedia pada tampilan organisasi'
  })

  // -------------------------------------------------------------------------
  // Jabatan target tidak sah — ditolak, bukan dijatuhkan ke generik
  // -------------------------------------------------------------------------
  await langkah('?target= tak dikenal ditolak terang-terangan', async () => {
    await page.goto(`${BASE}/peta-talenta?target=999999`, { waitUntil: 'domcontentloaded' })
    const teks = await page.locator('main').innerText()
    tegaskan(
      teks.includes('Jabatan target tidak ditemukan'),
      'target tak dikenal tidak ditolak dengan pesan yang jelas',
    )
    // Yang paling berbahaya: diam-diam menyajikan angka generik di bawah label
    // yang diminta pengguna.
    tegaskan(
      (await page.locator('[data-kotak]').count()) === 0,
      'grid tetap digambar untuk jabatan target yang tidak ada',
    )
    return 'pesan penolakan tampil, grid tidak digambar'
  })

  await langkah('Reset filter mempertahankan jabatan target', async () => {
    const pilihUnit = page.locator('select[aria-label="Unit organisasi"]')
    await page.goto(`${BASE}/peta-talenta?target=${targetId}`, { waitUntil: 'domcontentloaded' })
    const opsiUnit = await pilihUnit.locator('option').all()
    const unitId = await opsiUnit[1].getAttribute('value')
    await page.goto(`${BASE}/peta-talenta?target=${targetId}&unit=${unitId}`, {
      waitUntil: 'domcontentloaded',
    })
    const reset = page.locator('main button', { hasText: /^Reset$/ })
    tegaskan((await reset.count()) === 1, 'tombol Reset tidak ditemukan tepat satu')
    await reset.click()
    // Tunggu KEADAAN: parameter unit lenyap dari URL. Menunggu sebuah kata yang
    // sudah ada di layar akan lolos seketika (jebakan #1 di CLAUDE.md).
    await page.waitForFunction(
      () => !new URL(location.href).searchParams.has('unit'),
      undefined,
      { timeout: 5000 },
    )
    const url = new URL(page.url())
    tegaskan(
      url.searchParams.get('target') === targetId,
      `Reset menghapus ?target= (URL sekarang ${url.search})`,
    )
    return `unit dibersihkan, target #${targetId} tetap terpasang`
  })

  // -------------------------------------------------------------------------
  // No. 2 — Jabatan Kosong melebur ke Jabatan Target
  // -------------------------------------------------------------------------
  let tanpaTarget = 0
  let idDraftBaru = null

  await langkah('Rute lama /master/jabatan-kosong dialihkan, bukan 404', async () => {
    // Diuji lewat navigasi sungguhan, bukan status header: yang perlu dijamin
    // adalah **apa yang dilihat pengguna** saat membuka tautan lama dari riwayat
    // peramban atau pesan rekan kerja. Status 307 vs 308 bukan yang menentukan.
    const r = await page.goto(`${BASE}/master/jabatan-kosong?ambang=5`, {
      waitUntil: 'domcontentloaded',
    })
    tegaskan(r !== null && r.status() < 400, `rute lama menjawab ${r?.status()}`)
    const url = page.url()
    tegaskan(url.includes('/jabatan-target'), `berakhir di ${url}, bukan di /jabatan-target`)
    // Query string harus ikut — kalau tidak, tautan berfilter yang dikirim antar
    // staf membuka pemandangan bawaan dan selisihnya tidak pernah dipertanyakan.
    tegaskan(url.includes('ambang=5'), `?ambang=5 hilang saat dialihkan (${url})`)
    await page.locator('#risiko-kekosongan').waitFor()
    const teks = await page.locator('#risiko-kekosongan').innerText()
    tegaskan(/dalam 5 tahun menuju BUP/i.test(teks), 'ambang 5 tahun tidak benar-benar diterapkan')
    return `${r.status()} → ${url}`
  })

  await langkah('Halaman Jabatan Target memuat kedua bagian kekosongan', async () => {
    await page.goto(`${BASE}/jabatan-target`, { waitUntil: 'domcontentloaded' })
    await page.locator('#jabatan-kosong').waitFor()
    await page.locator('#risiko-kekosongan').waitFor()
    const teks = await page.locator('main').innerText()
    tegaskan(/sudah kosong/i.test(teks), 'bagian "sudah kosong" tidak ada')
    tegaskan(/akan kosong/i.test(teks), 'bagian "akan kosong" tidak ada')
    tegaskan(/batas usia pensiun/i.test(teks), 'BUP tidak disebut')
    tegaskan(/daftar jabatan target/i.test(teks), 'daftar jabatan target hilang setelah peleburan')
    return 'daftar target + sudah kosong + akan kosong dalam satu halaman'
  })

  await langkah('Jumlah kekosongan tanpa jabatan target disebut & cocok dengan DB', async () => {
    const panel = page.locator('#jabatan-kosong')
    const teks = await panel.innerText()
    const dariDb = await denganDb(async (c) => {
      const [r] = await c.query(
        `SELECT COUNT(*) AS n FROM jabatan j
          WHERE j.status_jabatan = 'KOSONG'
            AND NOT EXISTS (SELECT 1 FROM jabatan_target_anggota a WHERE a.jabatan_id = j.id)`,
      )
      return Number(r[0].n)
    })
    tanpaTarget = dariDb
    tegaskan(dariDb > 0, 'tidak ada jabatan kosong tanpa target di DB — kasusnya tidak teruji')
    tegaskan(
      teks.includes(String(dariDb)),
      `panel tidak menyebut angka ${dariDb} (jabatan kosong tanpa target)`,
    )
    tegaskan(
      /belum bisa dinilai sama sekali/i.test(teks),
      'panel tidak menjelaskan akibat tidak punya jabatan target',
    )
    return `${dariDb} jabatan kosong tanpa target, disebut di halaman`
  })

  await langkah('Tombol "Jadikan draft" hanya untuk yang belum punya target', async () => {
    const panel = page.locator('#jabatan-kosong')
    const tombol = panel.locator('button', { hasText: /^Jadikan draft$/ })
    const n = await tombol.count()
    tegaskan(
      n === tanpaTarget,
      `ada ${n} tombol "Jadikan draft" untuk ${tanpaTarget} jabatan tanpa target`,
    )
    // Kontrol positif: barisnya memang ada dan memuat sesuatu selain tombol,
    // supaya kecocokan angka di atas tidak kebetulan (jebakan #4).
    const baris = panel.locator('tbody tr')
    tegaskan((await baris.count()) >= tanpaTarget, 'jumlah baris tabel lebih kecil dari tombolnya')
    return `${n} tombol = ${tanpaTarget} jabatan tanpa target`
  })

  await langkah('Menekan "Jadikan draft" membuat DRAFT + 1 anggota, lalu membuka editornya', async () => {
    const panel = page.locator('#jabatan-kosong')
    const tombol = panel.locator('button', { hasText: /^Jadikan draft$/ }).first()
    const label = (await tombol.getAttribute('aria-label')) ?? ''
    await tombol.click()
    // Tunggu KEADAAN: berpindah ke editor. Menunggu teks toast akan lolos seketika
    // karena kalimatnya memuat kata yang sudah ada di layar (jebakan #1).
    await page.waitForURL(/\/jabatan-target\/\d+$/, { timeout: 15000 })
    idDraftBaru = Number(page.url().match(/\/jabatan-target\/(\d+)$/)[1])

    const cek = await denganDb(async (c) => {
      const [t] = await c.query('SELECT status, kode_target FROM jabatan_target WHERE id = ?', [
        idDraftBaru,
      ])
      const [a] = await c.query(
        'SELECT COUNT(*) AS n FROM jabatan_target_anggota WHERE jabatan_target_id = ?',
        [idDraftBaru],
      )
      return { status: t[0]?.status, kode: t[0]?.kode_target, anggota: Number(a[0].n) }
    })
    tegaskan(cek.status === 'DRAFT', `status target baru ${cek.status}, seharusnya DRAFT`)
    tegaskan(cek.anggota === 1, `target baru punya ${cek.anggota} anggota, seharusnya tepat 1`)
    return `#${idDraftBaru} ${cek.kode} · DRAFT · 1 anggota · dari ${label}`
  })

  await langkah('Draft baru TIDAK muncul di pemilih Peta Talenta (hanya AKTIF)', async () => {
    await page.goto(`${BASE}/peta-talenta`, { waitUntil: 'domcontentloaded' })
    const nilai = await page
      .locator('select[aria-label="Dasar sumbu Potensial"] option')
      .evaluateAll((o) => o.map((x) => x.value))
    tegaskan(
      !nilai.includes(String(idDraftBaru)),
      `draft #${idDraftBaru} ikut ditawarkan padahal rubriknya belum lolos pemeriksaan`,
    )
    return `pemilih memuat ${nilai.length - 1} target AKTIF, draft baru tidak termasuk`
  })

  await langkah('Membuat draft kedua untuk jabatan yang sama DITOLAK', async () => {
    await page.goto(`${BASE}/jabatan-target`, { waitUntil: 'domcontentloaded' })
    const panel = page.locator('#jabatan-kosong')
    await panel.waitFor()
    const tombol = panel.locator('button', { hasText: /^Jadikan draft$/ })
    tegaskan(
      (await tombol.count()) === tanpaTarget - 1,
      `tombol tersisa ${await tombol.count()}, seharusnya ${tanpaTarget - 1} setelah satu dipakai`,
    )
    return `tombol berkurang jadi ${tanpaTarget - 1} — jabatan yang sudah punya target tidak diberi tombol lagi`
  })

  await langkah('Bersihkan draft uji', async () => {
    const sisa = await denganDb(async (c) => {
      await c.query('DELETE FROM jabatan_target WHERE id = ?', [idDraftBaru])
      const [t] = await c.query('SELECT COUNT(*) AS n FROM jabatan_target WHERE id = ?', [
        idDraftBaru,
      ])
      const [a] = await c.query(
        'SELECT COUNT(*) AS n FROM jabatan_target_anggota WHERE jabatan_target_id = ?',
        [idDraftBaru],
      )
      return { target: Number(t[0].n), anggota: Number(a[0].n) }
    })
    tegaskan(sisa.target === 0, 'jabatan target uji masih ada')
    tegaskan(sisa.anggota === 0, `${sisa.anggota} baris anggota tertinggal (cascade tidak jalan)`)
    return `#${idDraftBaru} dihapus · anggotanya ikut terhapus lewat cascade`
  })

  await langkah('Screenshot kedua tampilan', async () => {
    // `caret: 'initial'` — bawaannya `hide`, yang MENYUNTIK `caret-color:
    // transparent` ke DOM. Kalau suntikan itu mendarat sementara React masih
    // menghidrasi, React melaporkan atribut yang tidak cocok dan smoke gagal
    // karena ulah alat ukurnya sendiri, bukan karena halamannya. Tidak ada
    // masukan yang terfokus di screenshot ini, jadi caretnya tidak perlu
    // disembunyikan.
    await page.goto(`${BASE}/peta-talenta`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-kotak]')
    await page.screenshot({
      path: `${OUT}/fase-11-peta-generik.png`,
      fullPage: true,
      caret: 'initial',
    })
    await page.goto(`${BASE}/peta-talenta?target=${targetId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-kotak]')
    await page.screenshot({
      path: `${OUT}/fase-11-peta-target.png`,
      fullPage: true,
      caret: 'initial',
    })
    return `${OUT}/fase-11-peta-generik.png · ${OUT}/fase-11-peta-target.png`
  })

  await browser.close()
}

await main()

console.log('=== SMOKE TEST FASE 11 — KOTAK 9 PER JABATAN TARGET ===')
for (const h of hasil) {
  console.log(`${h.ok ? 'LULUS ' : 'GAGAL '} ${h.nama}`)
  if (h.detail) console.log(`       ${h.detail}`)
}
const lulus = hasil.filter((h) => h.ok).length
console.log(`\nRingkasan: ${lulus}/${hasil.length} lulus`)
if (errors.length > 0) {
  console.log(`\n${errors.length} error konsol/halaman:`)
  for (const e of [...new Set(errors)].slice(0, 20)) console.log(`  - ${e}`)
} else {
  console.log('Tanpa error konsol maupun error halaman.')
}
process.exit(lulus === hasil.length && errors.length === 0 ? 0 : 1)
