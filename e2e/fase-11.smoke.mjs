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

/*
  DULU di sini ada `SEBARAN_GENERIK` — potret angka Kotak 9 `pupr_dev` yang
  dipaku, untuk membuktikan Fase 11 tidak menggeser tampilan organisasi.

  Dihapus 18 Agu 2026, dan alasannya penting: potret itu **tidak bisa
  membedakan regresi dari perubahan data yang disengaja**. Sejak dicatat,
  populasinya dikurasi (hanya yang ada di eNominasi) lalu ditambah 26 pegawai
  dari Excel Talent Pool ES 2/3 — jadi angkanya WAJIB bergeser, dan langkahnya
  merah tanpa ada yang rusak. Memperbaruinya jadi angka hari ini hanya menunda
  masalah yang sama sampai impor berikutnya, sekaligus mengubah penjaga regresi
  menjadi catatan keadaan data.

  Penggantinya invarian yang tidak bergantung pada isi DB: sebaran generik
  dihitung oleh DUA kueri yang benar-benar berbeda —
  `ambilPetaSebaran()` (halaman Peta Talenta) dan `ambilSebaranKotak9()`
  (widget dashboard) — dan keduanya HARUS sepakat. Itu justru menangkap hal
  yang dikhawatirkan langkah lama (kueri peta bergeser sendiri) tanpa ikut
  merah setiap kali datanya berubah.
*/

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
 * Tunggu sampai DB memenuhi syarat, bukan sampai UI berubah bentuk.
 *
 * Lahir dari kekeliruan nyata di uji ini: tombol simpan memakai `labelPending`,
 * jadi teksnya berubah dari "Simpan …" menjadi "Menyimpan…" **selama** aksinya
 * terbang. Menunggu teks lama lenyap karena itu lolos SEKETIKA — bukan karena
 * pekerjaannya selesai, tapi karena indikator pending-nya sendiri yang
 * mengubahnya — dan pembacaan DB sesudahnya mendahului INSERT. Ini varian
 * jebakan #1 di CLAUDE.md yang bahkan tidak butuh kata yang sudah ada di layar.
 */
async function tungguDb(fn, pesan, batasMs = 15000) {
  const mulai = Number(process.hrtime.bigint() / 1000000n)
  for (;;) {
    const hasil = await denganDb(fn)
    if (hasil !== null && hasil !== undefined && hasil !== false) return hasil
    if (Number(process.hrtime.bigint() / 1000000n) - mulai > batasMs) {
      throw new Error(`${pesan} (menunggu ${batasMs} ms)`)
    }
    await new Promise((r) => setTimeout(r, 250))
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
  /** Jabatan target yang belum punya syarat pelatihan — diturunkan, tidak dipaku. */
  let ID_TANPA_DIKLAT = 0

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

  await langkah('Sebaran generik SAMA dengan grid Kotak 9 dashboard (dua kueri)', async () => {
    sebaranGenerik = await bacaGrid(page)
    const total = Object.values(sebaranGenerik).reduce((a, b) => a + b, 0)
    // "Sepakat" atas dua grid kosong bukan bukti apa pun.
    tegaskan(total > 0, 'sebaran generik kosong — tidak ada yang bisa dibandingkan')

    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-kotak]')
    const dashboard = await bacaGrid(page)
    const beda = Object.keys(sebaranGenerik)
      .filter((k) => sebaranGenerik[k] !== dashboard[k])
      .map((k) => `K${k}: peta ${sebaranGenerik[k]} ≠ dashboard ${dashboard[k]}`)
    tegaskan(
      beda.length === 0,
      `dua kueri sebaran generik berselisih — ${beda.join(', ')}`,
    )

    await page.goto(`${BASE}/peta-talenta`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-kotak]')
    return `${total} pegawai · sepakat di 9 kotak · ${Object.entries(sebaranGenerik)
      .map(([k, v]) => `K${k}:${v}`)
      .join(' ')}`
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

  await langkah('Sebaran per jabatan target benar-benar memakai ?target=', async () => {
    sebaranTarget = await bacaGrid(page)

    /*
      Yang dijaga: `?target=` tidak diabaikan diam-diam.

      Dulu ini diuji dengan menuntut JUMLAH per kotak berbeda dari generik. Itu
      probe yang salah, dan sekarang terbukti: populasi `pupr_dev_v2` cukup
      homogen sehingga sumbu potkom dan sumbu match score menempatkan orang yang
      sama di kotak yang sama — 32 di K9, 4 di K7 pada keduanya. Langkahnya merah
      padahal `?target=` dihormati sepenuhnya.

      Penggantinya membandingkan NILAI sumbu X, bukan hitungan kotak: buka
      drill-down kotak terpadat pada kedua tampilan lalu bandingkan kolom
      sumbu X-nya. Generik memakai potkom, per jabatan target memakai match
      score — kalau `?target=` diabaikan, kedua daftar akan berisi angka yang
      sama persis. Ini menangkap parameter yang diabaikan bahkan ketika
      sebarannya kebetulan identik.
    */
    const kotakTerpadat = Object.entries(sebaranTarget).sort((a, b) => b[1] - a[1])[0][0]
    const bacaKolomX = async (url) => {
      await page.goto(url, { waitUntil: 'networkidle' })
      return page.evaluate(() => {
        const th = [...document.querySelectorAll('table thead th')].map((e) => e.innerText)
        const i = th.findIndex((t) => /potensial|match score/i.test(t))
        if (i < 0) return null
        return [...document.querySelectorAll('table tbody tr')]
          .map((tr) => tr.children[i]?.innerText.trim())
          .filter(Boolean)
      })
    }
    const xGenerik = await bacaKolomX(`${BASE}/peta-talenta?kotak=${kotakTerpadat}`)
    const xTarget = await bacaKolomX(`${BASE}/peta-talenta?kotak=${kotakTerpadat}&target=${targetId}`)
    tegaskan(xGenerik !== null && xGenerik.length > 0, 'kolom sumbu X tidak ditemukan di drill-down generik')
    tegaskan(xTarget !== null && xTarget.length > 0, 'kolom sumbu X tidak ditemukan di drill-down per jabatan target')
    tegaskan(
      xGenerik.join('|') !== xTarget.join('|'),
      `nilai sumbu X identik di kedua tampilan — ?target= kemungkinan diabaikan (${xGenerik.slice(0, 3).join(', ')})`,
    )

    await page.goto(`${BASE}/peta-talenta?target=${targetId}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('[data-kotak]')
    const jml = Object.values(sebaranTarget).reduce((a, b) => a + b, 0)
    const jmlGenerik = Object.values(sebaranGenerik).reduce((a, b) => a + b, 0)
    tegaskan(
      jml === jmlGenerik,
      `total pegawai berubah ${jmlGenerik} → ${jml}; seharusnya sama, hanya sebarannya bergeser`,
    )
    return `sumbu X berbeda di K${kotakTerpadat} · total tetap ${jml} · ${Object.entries(sebaranTarget)
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
    /*
      DITUNGGU secara eksplisit, tidak dibaca seketika.

      `domcontentloaded` bisa tiba saat `loading.tsx` masih terpasang, sehingga
      `main` yang dibaca adalah skeleton dan asersinya merah tanpa ada yang
      rusak — terbukti: pesan penolakannya HADIR pada pemeriksaan langsung, baik
      dengan `domcontentloaded` maupun `networkidle`, tapi langkah ini tetap
      merah kadang-kadang di rangkaian penuh saat mesinnya sedang sibuk.

      Yang ditunggu adalah SALAH SATU dari dua keadaan akhir yang mungkin —
      pesan penolakan, atau grid yang tergambar. Menunggu hanya pesannya akan
      berubah jadi timeout 30 detik ketika halaman justru salah menggambar grid,
      dan timeout menyembunyikan penyebabnya; dengan menunggu keduanya, asersi
      di bawah tetap yang memutuskan lulus atau gagal.
    */
    await page
      .waitForFunction(
        () =>
          document.body.innerText.includes('Jabatan target tidak ditemukan') ||
          document.querySelector('[data-kotak]') !== null,
        undefined,
        { timeout: 20000 },
      )
      .catch(() => {})
    const teks = await page.locator('main').innerText()
    tegaskan(
      teks.includes('Jabatan target tidak ditemukan'),
      `target tak dikenal tidak ditolak dengan pesan yang jelas — isi: ${teks
        .slice(0, 120)
        .replace(/\n/g, ' ')}`,
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
    // Tombol Reset hanya muncul saat ada filter aktif, dan toolbarnya ikut
    // dialirkan lewat Suspense — jadi `count()` seketika setelah
    // `domcontentloaded` bisa membaca 0 padahal tombolnya menyusul beberapa
    // milidetik kemudian. Ditunggu keberadaannya, lalu jumlahnya tetap
    // ditegaskan tepat satu (dua tombol Reset berarti toolbar terender ganda).
    await reset.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => {})
    tegaskan((await reset.count()) === 1, `tombol Reset tidak ditemukan tepat satu (${await reset.count()})`)
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
    //
    // Tujuannya `?tab=syarat` sejak 24 Agu 2026 — persyaratan adalah langkah
    // pertama alur, dan pengusul berperan Pengelola Unit tidak bisa menyunting tab
    // Rubrik. Pola URL-nya karena itu tidak lagi berakhir pada angka.
    await page.waitForURL(/\/jabatan-target\/\d+\?tab=syarat$/, { timeout: 15000 })
    idDraftBaru = Number(page.url().match(/\/jabatan-target\/(\d+)/)[1])

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
      /*
        Notifikasinya ikut dihapus, dan itu harus DISENGAJA: `notifikasi.entitas_id`
        bukan foreign key, jadi menghapus jabatan targetnya meninggalkan kabar
        "Usulan jabatan target" yang menaut ke halaman yang sudah tidak ada.
        Terukur: tiga jalan uji ini meninggalkan tiga baris yatim sebelum diperbaiki
        (24 Agu 2026) — dan proyek ini sudah punya 21 notifikasi yatim dari seed,
        jadi menambah lebih banyak berarti menenggelamkan yang asli.

        Yang menerimanya bukan pelakunya: `kirimKePeran()` mengecualikan pelaku, dan
        uji ini masuk sebagai Admin Talenta — jadi kabarnya jatuh ke Admin Talenta
        LAIN. Menghapus per `entitas_id` menjangkau keduanya; menghapus per pengguna
        yang sedang masuk tidak akan menyentuh satu pun.
      */
      await c.query(`DELETE FROM notifikasi WHERE entitas = 'jabatan_target' AND entitas_id = ?`, [
        idDraftBaru,
      ])
      const [t] = await c.query('SELECT COUNT(*) AS n FROM jabatan_target WHERE id = ?', [
        idDraftBaru,
      ])
      const [a] = await c.query(
        'SELECT COUNT(*) AS n FROM jabatan_target_anggota WHERE jabatan_target_id = ?',
        [idDraftBaru],
      )
      const [nf] = await c.query(
        `SELECT COUNT(*) AS n FROM notifikasi WHERE entitas = 'jabatan_target' AND entitas_id = ?`,
        [idDraftBaru],
      )
      return { target: Number(t[0].n), anggota: Number(a[0].n), notifikasi: Number(nf[0].n) }
    })
    tegaskan(sisa.target === 0, 'jabatan target uji masih ada')
    tegaskan(sisa.anggota === 0, `${sisa.anggota} baris anggota tertinggal (cascade tidak jalan)`)
    tegaskan(sisa.notifikasi === 0, `${sisa.notifikasi} notifikasi yatim tertinggal`)
    return `#${idDraftBaru} dihapus · anggota lewat cascade · notifikasinya ikut dibersihkan`
  })

  // -------------------------------------------------------------------------
  // No. 3 — satu tempat mendeklarasikan bidang ilmu
  // -------------------------------------------------------------------------
  await langkah('"Buat jabatan target" MEMILIH dari master, bukan mengetik', async () => {
    /*
      Permintaan pemilik proses 25 Agu 2026: penambahan jabatan target diambil dari
      master jabatan, tidak diketik bebas. Yang dijaga di sini bukan tampilan
      dialognya melainkan ketiadaan jalur bebas-teks: begitu kotak "Kode target"
      kembali muncul di dialog PEMBUATAN, nama jabatan target bisa berbeda dari
      master lagi dan targetnya bisa lahir tanpa menunjuk kursi mana pun.
    */
    await page.goto(`${BASE}/jabatan-target`, { waitUntil: 'domcontentloaded' })
    await page.locator('main button', { hasText: /^Buat jabatan target$/ }).click()
    const dialog = page.locator('dialog[open]')
    await dialog.waitFor()
    const pencarian = dialog.locator('input[aria-label="Cari jabatan di master"]')
    await pencarian.waitFor({ state: 'visible', timeout: 15000 })

    // Kontrol positif: daftarnya benar-benar terisi dari master, bukan kosong.
    const tombolPilih = dialog.locator('button', { hasText: /^Pilih$/ })
    await tombolPilih.first().waitFor({ state: 'attached', timeout: 20000 })
    const jml = await tombolPilih.count()

    const teks = await dialog.innerText()
    tegaskan(
      !/Kode target/i.test(teks),
      'dialog pembuatan masih memuat "Kode target" — jalur bebas-teks hidup lagi',
    )
    tegaskan(/master/i.test(teks), 'dialog tidak menyatakan bahwa jabatannya diambil dari master')

    // Pencariannya benar-benar menyaring, bukan hiasan.
    await pencarian.fill('zzz-tidak-mungkin-ada')
    await page.waitForFunction(
      () =>
        document.querySelector('dialog[open]')?.innerText.includes('Tidak ada jabatan yang cocok') ??
        false,
      null,
      { timeout: 15000 },
    )
    await page.keyboard.press('Escape')
    return `${jml} jabatan master ditawarkan · tanpa kotak kode/nama · pencarian menyaring`
  })

  await langkah('Form UBAH profil tetap tanpa kata kunci relevansi', async () => {
    // Invarian Fase 11 no. 3 pindah ke dialog UBAH, sebab dialog BUAT tidak lagi
    // punya field identitas sama sekali. Yang dijaga sama: satu deklarasi syarat
    // bidang ilmu, satu tempat menulisnya (tab Persyaratan).
    await page.goto(`${BASE}/jabatan-target`, { waitUntil: 'networkidle' })
    await page.locator('button[aria-label^="Aksi untuk"]').first().click()
    await page.getByRole('button', { name: /^Ubah profil$/ }).first().click()
    const dialog = page.locator('dialog[open]')
    await dialog.waitFor()
    const teks = await dialog.innerText()
    tegaskan(/Kode target/i.test(teks), 'kontrol positif gagal — dialog ubah tidak memuat Kode target')
    tegaskan(/Nama jabatan target/i.test(teks), 'dialog ubah tidak memuat Nama jabatan target')
    tegaskan(
      !/Kata kunci relevansi/i.test(teks),
      'form profil masih menyunting kata kunci relevansi — jalur tulis kedua masih hidup',
    )
    tegaskan(
      /tab Persyaratan/i.test(teks),
      'dialog tidak memberi tahu di mana syarat sekarang diatur',
    )
    await page.keyboard.press('Escape')
    return 'identitas saja + menunjuk ke tab Persyaratan'
  })

  let selisihAwal = null

  await langkah('Tab Persyaratan menandai bidang ilmu yang tersimpan dua kali beda isi', async () => {
    selisihAwal = await denganDb(async (c) => {
      const [r] = await c.query(
        `SELECT t.id, t.kata_kunci_relevansi AS rubrik,
                (SELECT p.nilai_minimal FROM jabatan_target_persyaratan p
                  WHERE p.jabatan_target_id=t.id AND p.jenis_syarat='BIDANG_ILMU' LIMIT 1) AS gerbang
           FROM jabatan_target t ORDER BY t.id`,
      )
      return r.map((x) => ({
        id: Number(x.id),
        rubrik: (typeof x.rubrik === 'string' ? JSON.parse(x.rubrik) : x.rubrik) ?? [],
        gerbang: (x.gerbang ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
      }))
    })
    const menyimpang = selisihAwal.find(
      (t) => t.rubrik.some((k) => !t.gerbang.includes(k)) || t.gerbang.some((k) => !t.rubrik.includes(k)),
    )
    tegaskan(menyimpang !== undefined, 'tidak ada target yang menyimpang — kasusnya tidak teruji')

    await page.goto(`${BASE}/jabatan-target/${menyimpang.id}?tab=syarat`, {
      waitUntil: 'domcontentloaded',
    })
    /*
      Isi tab ini dialirkan lewat Suspense, jadi `domcontentloaded` bisa tiba
      saat yang terpasang masih skeleton — dan asersi di bawah lalu merah 2 dari
      3 kali di mesin yang sibuk, padahal datanya benar menyimpang (target #1:
      rubrik 3 kata kunci vs gerbang 1) dan halamannya benar menandainya.
      Ditunggu sampai penanda selisih ATAU label versi gerbang muncul; asersi di
      bawah tetap yang memutuskan, bukan penantian ini.
    */
    await page
      .waitForFunction(
        () =>
          /tersimpan dua kali dengan isi berbeda|Dipakai gerbang kelayakan/i.test(
            document.body.innerText,
          ),
        undefined,
        { timeout: 20000 },
      )
      .catch(() => {})
    const teks = await page.locator('main').innerText()
    tegaskan(
      /tersimpan dua kali dengan isi berbeda/i.test(teks),
      `tab Persyaratan tidak menandai selisihnya — isi: ${teks.slice(0, 140).replace(/\n/g, ' ')}`,
    )
    tegaskan(/Dipakai gerbang kelayakan/i.test(teks), 'isi versi gerbang tidak ditampilkan')
    tegaskan(/Dipakai indikator rubrik/i.test(teks), 'isi versi rubrik tidak ditampilkan')
    // Yang paling penting: halaman menyatakan bahwa menyimpan MENGGESER SKOR.
    tegaskan(
      /skor akan bergeser/i.test(teks),
      'halaman tidak memperingatkan bahwa menyeragamkan menggeser skor',
    )
    return `target #${menyimpang.id}: gerbang [${menyimpang.gerbang.join(' ')}] vs rubrik [${menyimpang.rubrik.join(' ')}]`
  })

  await langkah('Menyimpan syarat bidang ilmu menulis KEDUA penyimpanan sekaligus', async () => {
    // Dipakai target 1 (gerbang & rubrik sudah sama-sama memuat "semua"), jadi
    // menulis ulang tidak menggeser skor siapa pun — yang diuji jalur tulisnya,
    // bukan dampaknya.
    const target = selisihAwal[0]
    const semula = await denganDb(async (c) => {
      const [r] = await c.query(
        `SELECT p.id, p.nilai_minimal, p.deskripsi,
                (SELECT t.kata_kunci_relevansi FROM jabatan_target t WHERE t.id=p.jabatan_target_id) AS rubrik
           FROM jabatan_target_persyaratan p
          WHERE p.jabatan_target_id=? AND p.jenis_syarat='BIDANG_ILMU' LIMIT 1`,
        [target.id],
      )
      return r[0]
    })
    tegaskan(semula !== undefined, `target #${target.id} tidak punya syarat BIDANG_ILMU`)

    await page.goto(`${BASE}/jabatan-target/${target.id}?tab=syarat`, {
      waitUntil: 'domcontentloaded',
    })
    // Tombolnya ikon tanpa teks — dicari lewat `aria-label`, yang memang ada
    // untuk aksesibilitas. `hasText: /Ubah/` tidak akan pernah cocok.
    const tombolUbah = page.locator('button[aria-label="Ubah syarat Bidang ilmu"]')
    tegaskan(
      (await tombolUbah.count()) === 1,
      `tombol ubah syarat bidang ilmu cocok ${await tombolUbah.count()} elemen`,
    )
    await tombolUbah.click()
    const dialog = page.locator('dialog[open]')
    await dialog.waitFor()
    const input = dialog.locator('input').last()
    await input.fill('semua, ujif11')
    await dialog.locator('button', { hasText: /^Simpan$/ }).click()
    // Tunggu KEADAAN: dialog tertutup. Menunggu kata "semua" akan lolos seketika.
    await dialog.waitFor({ state: 'detached', timeout: 15000 })

    const sesudah = await denganDb(async (c) => {
      const [r] = await c.query(
        `SELECT p.nilai_minimal,
                (SELECT t.kata_kunci_relevansi FROM jabatan_target t WHERE t.id=p.jabatan_target_id) AS rubrik
           FROM jabatan_target_persyaratan p WHERE p.id=?`,
        [semula.id],
      )
      const x = r[0]
      return {
        gerbang: x.nilai_minimal,
        rubrik: typeof x.rubrik === 'string' ? JSON.parse(x.rubrik) : x.rubrik,
      }
    })
    tegaskan(
      (sesudah.gerbang ?? '').includes('ujif11'),
      `gerbang tidak ikut tertulis: ${sesudah.gerbang}`,
    )
    tegaskan(
      Array.isArray(sesudah.rubrik) && sesudah.rubrik.includes('ujif11'),
      `rubrik TIDAK ikut tertulis: ${JSON.stringify(sesudah.rubrik)} — jalur tulisnya belum menyatu`,
    )

    // Pulihkan keduanya ke keadaan semula.
    await denganDb(async (c) => {
      await c.query(`UPDATE jabatan_target_persyaratan SET nilai_minimal=? WHERE id=?`, [
        semula.nilai_minimal,
        semula.id,
      ])
      await c.query(`UPDATE jabatan_target SET kata_kunci_relevansi=? WHERE id=?`, [
        typeof semula.rubrik === 'string' ? semula.rubrik : JSON.stringify(semula.rubrik),
        target.id,
      ])
    })
    return `satu simpan → gerbang "${sesudah.gerbang}" + rubrik ${JSON.stringify(sesudah.rubrik)} · dipulihkan`
  })

  // -------------------------------------------------------------------------
  // No. 3 lanjutan — syarat pelatihan punya UI (sebelumnya SQL-only)
  // -------------------------------------------------------------------------
  await langkah('Panel syarat pelatihan tampil & rumpun TIDAK bisa dicentang', async () => {
    /*
      Subjeknya DITURUNKAN: jabatan target mana pun yang belum punya syarat
      pelatihan. Sampai 1 Sep 2026 berkas ini memaku `/jabatan-target/3` (BJKW,
      yang memang sengaja dibiarkan tanpa syarat karena lembar 6 `sample.xlsx`
      tidak memuat BJKW). Id itu lenyap saat `jabatan_target` dikosongkan lalu
      disimulasikan ulang, dan dua langkah di sini gagal dengan `locator timeout`
      — yang terbaca seperti panel syarat pelatihan yang rusak.

      Yang dijaga bukan target nomor 3, melainkan invariannya: rumpun tampil
      sebagai JUDUL kelompok dan tidak bisa dicentang. Target mana pun yang masih
      kosong bisa menjawabnya.
    */
    ID_TANPA_DIKLAT = await denganDb(async (c) => {
      const [r] = await c.query(
        `SELECT t.id FROM jabatan_target t
          WHERE NOT EXISTS (
            SELECT 1 FROM jabatan_target_syarat_diklat s WHERE s.jabatan_target_id = t.id
          )
          ORDER BY t.id LIMIT 1`,
      )
      return r.length === 0 ? 0 : Number(r[0].id)
    })
    tegaskan(
      ID_TANPA_DIKLAT !== 0,
      'tidak ada jabatan target tanpa syarat pelatihan — ini PRASYARAT, bukan temuan tentang panel syarat pelatihan',
    )
    await page.goto(`${BASE}/jabatan-target/${ID_TANPA_DIKLAT}?tab=syarat`, {
      waitUntil: 'domcontentloaded',
    })
    const panel = page.locator('main section').filter({ hasText: 'Syarat pelatihan' })
    /*
      DITUNGGU dulu, baru dihitung. `count()` tidak menunggu apa pun, dan isi tab ini
      datang lewat `<Suspense>` — jadi menghitung tepat sesudah `domcontentloaded`
      berarti mengukur kapan servernya kebetulan selesai, bukan apakah panelnya ada.
      Gejalanya "cocok 0 elemen" dan terbaca seperti panel yang hilang; yang
      sebenarnya berubah cuma satu kueri tambahan di badan halaman.
    */
    await panel.first().waitFor({ state: 'attached', timeout: 20000 })
    tegaskan((await panel.count()) === 1, `panel syarat pelatihan cocok ${await panel.count()} elemen`)
    const teks = await panel.innerText()

    const kotak = panel.locator('input[type="checkbox"]')
    const jml = await kotak.count()
    const dariDb = await denganDb(async (c) => {
      const [r] = await c.query(
        `SELECT COUNT(*) AS n FROM master_kategori_riwayat_diklat WHERE parent_id IS NOT NULL AND aktif = 1`,
      )
      const [g] = await c.query(
        `SELECT COUNT(*) AS n FROM master_kategori_riwayat_diklat WHERE parent_id IS NULL`,
      )
      return { turunan: Number(r[0].n), rumpun: Number(g[0].n) }
    })
    tegaskan(
      jml === dariDb.turunan,
      `${jml} kotak centang untuk ${dariDb.turunan} kategori turunan aktif`,
    )
    tegaskan(dariDb.rumpun > 0, 'tidak ada rumpun di DB — kasusnya tidak teruji')
    // Rumpun tampil sebagai JUDUL kelompok, bukan sebagai pilihan.
    tegaskan(/Pelatihan Manajerial/i.test(teks), 'rumpun tidak dipakai sebagai judul kelompok')
    tegaskan(
      /tidak diketahui/i.test(teks),
      'panel tidak menyatakan bahwa kosong berarti tidak diketahui',
    )
    tegaskan(
      /melonggarkan/i.test(teks),
      'panel tidak menjelaskan bahwa menambah kategori melonggarkan syarat',
    )
    return `${jml} kotak centang = ${dariDb.turunan} turunan aktif · ${dariDb.rumpun} rumpun jadi judul, bukan pilihan`
  })

  await langkah('Menyimpan syarat pelatihan menulis tabelnya, lalu dipulihkan', async () => {
    const semula = await denganDb(async (c) => {
      const [r] = await c.query(
        `SELECT kategori_id FROM jabatan_target_syarat_diklat WHERE jabatan_target_id = ?
          ORDER BY kategori_id`,
        [ID_TANPA_DIKLAT],
      )
      return r.map((x) => Number(x.kategori_id))
    })
    tegaskan(
      semula.length === 0,
      `target ${ID_TANPA_DIKLAT} seharusnya tanpa syarat diklat, ada ${semula.length}`,
    )

    const panel = page.locator('main section').filter({ hasText: 'Syarat pelatihan' })
    await panel.locator('input[type="checkbox"]').first().check()
    await panel.locator('button', { hasText: /^Simpan syarat pelatihan$/ }).click()

    // Ditunggu di DB, BUKAN di UI — lihat catatan pada `tungguDb()`.
    const sesudah = await tungguDb(async (c) => {
      const [r] = await c.query(
        `SELECT s.kategori_id, s.wajib, k.parent_id
           FROM jabatan_target_syarat_diklat s
           JOIN master_kategori_riwayat_diklat k ON k.id = s.kategori_id
          WHERE s.jabatan_target_id = ?`,
        [ID_TANPA_DIKLAT],
      )
      if (r.length === 0) return false
      return r.map((x) => ({
        id: Number(x.kategori_id),
        wajib: Number(x.wajib),
        rumpun: x.parent_id === null,
      }))
    }, 'syarat pelatihan tidak tersimpan')
    tegaskan(sesudah.length === 1, `tersimpan ${sesudah.length} baris, seharusnya 1`)
    tegaskan(!sesudah[0].rumpun, 'yang tersimpan justru rumpun')

    await denganDb(async (c) => {
      await c.query('DELETE FROM jabatan_target_syarat_diklat WHERE jabatan_target_id = ?', [
        ID_TANPA_DIKLAT,
      ])
      const [r] = await c.query(
        'SELECT COUNT(*) AS n FROM jabatan_target_syarat_diklat WHERE jabatan_target_id = ?',
        [ID_TANPA_DIKLAT],
      )
      tegaskan(Number(r[0].n) === 0, 'syarat uji tidak berhasil dibersihkan')
    })
    return `1 kategori tersimpan (wajib=${sesudah[0].wajib}, bukan rumpun) · dipulihkan ke kosong`
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
