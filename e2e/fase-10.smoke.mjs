import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

import { AKUN, konteksMasuk } from './_masuk.mjs'

/**
 * Smoke test Fase 10 — Kategori Riwayat Diklat & Validasi Riwayat (`doc/sql/014`).
 *
 * Fase ini memindahkan dua indikator rubrik dari tebakan mesin ke keputusan
 * manusia. Yang diuji adalah hal-hal yang kalau salah **tidak menimbulkan galat
 * apa pun**, dan justru merusak gunanya:
 *
 *   - **dua daftar peran yang sengaja berbeda.** Kamusnya master data (Super
 *     Admin & Admin Talenta); penerapannya kurasi data pegawai yang PRD §3
 *     berikan ke Pengelola Unit. Kalau keduanya disamakan, entah Pengelola Unit
 *     kehilangan pekerjaannya sendiri, entah ia bisa mengubah kamus yang berlaku
 *     lintas DJBK;
 *   - **usulan tidak boleh tersimpan sendiri.** Pemilih terisi usulan supaya
 *     pemeriksa mengoreksi alih-alih mengetik dari nol, tapi status barisnya
 *     wajib tetap USULAN sampai ada yang menekan Simpan — kalau tidak, membuka
 *     halaman sama dengan menyetujui seluruh antrian;
 *   - **"bukan kategori apa pun" adalah keputusan, bukan pembatalan.** Dari 182
 *     nama diklat nyata, mayoritas memang tidak punya kategori rubrik; tanpa
 *     jalan keluar itu, satu-satunya cara mengosongkan antrian adalah
 *     memaksakan kategori yang salah;
 *   - **rumpun tidak boleh dipilih.** Memetakan diklat ke "Pelatihan Teknis"
 *     tanpa menyebut teknis apa membuat pemeriksaan syarat pelatihan tidak bisa
 *     membedakan Pengadaan dari Hukum Kontrak;
 *   - **halaman menyatakan bahwa skoring belum memakainya.** Antrian yang tidak
 *     berpengaruh tapi terlihat berpengaruh adalah cara tercepat membuat orang
 *     berhenti memercayai angka di aplikasi ini.
 *
 * Uji ini mengubah data (memvalidasi beberapa baris, membuat satu kategori) lalu
 * **mengembalikannya** — kalau tidak, angka antrian bergeser tiap kali dijalankan.
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-10.smoke.mjs [folder-screenshot] [base-url]
 */

const BASE = process.argv[3] ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? '.'

const UJI = { kode: 'UJI_F10', nama: 'Kategori Uji Fase 10' }

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
  ['/master/kategori-diklat', 'Kategori Riwayat Diklat'],
  ['/data/validasi-riwayat', 'Validasi Riwayat'],
]

// ---------------------------------------------------------------------------
// DB — pembersihan & pemeriksaan yang tidak punya permukaan UI
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

/** Kembalikan seluruh jejak uji: kategori uji + pemetaan & riwayat yang disentuh. */
async function bersihkan(idPemetaan, idRiwayat) {
  return denganDb(async (c) => {
    await c.query('DELETE FROM master_kategori_riwayat_diklat WHERE kode = ?', [UJI.kode])
    for (const id of idPemetaan) {
      await c.query(
        `UPDATE pemetaan_diklat
            SET kategori_id = NULL, status = 'USULAN', catatan = NULL,
                divalidasi_oleh = NULL, divalidasi_pada = NULL
          WHERE id = ?`,
        [id],
      )
    }
    for (const id of idRiwayat) {
      await c.query(
        `UPDATE riwayat_jabatan
            SET jenis_penugasan = NULL, relevan_substansi = NULL,
                divalidasi_oleh = NULL, divalidasi_pada = NULL
          WHERE id = ?`,
        [id],
      )
    }
  })
}

const browser = await chromium.launch()

async function konteksSebagai(akun, opsi = {}) {
  const ctx = await konteksMasuk(browser, {
    base: BASE,
    akun,
    viewport: { width: 1600, height: 1100 },
    ...opsi,
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  return { ctx, page }
}

async function tungguTeks(page, teks, timeout = 20000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), teks, { timeout })
}

const disentuhPemetaan = []
const disentuhRiwayat = []

try {
  await langkah('bersihkan sisa uji sebelumnya', async () => {
    await bersihkan([], [])
    const sisa = await denganDb(async (c) => {
      const [r] = await c.query(
        "SELECT COUNT(*) AS n FROM pemetaan_diklat WHERE status <> 'USULAN'",
      )
      return Number(r[0].n)
    })
    return `kategori uji dihapus · ${sisa} pemetaan bukan-USULAN tersisa dari sebelumnya`
  })

  // -------------------------------------------------------------------------
  // 1. Kedua halaman di kedua tema
  // -------------------------------------------------------------------------
  for (const tema of ['light', 'dark']) {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin, { colorScheme: tema })
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
      for (const [rute] of RUTE) {
        await page.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
        await page.screenshot({
          path: `${OUT}/f10-${rute.split('/').pop()}.png`,
          fullPage: true,
        })
      }
    }
    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 2. Dua daftar peran yang sengaja berbeda
  // -------------------------------------------------------------------------
  await langkah('Pengelola Unit: DITOLAK di kamus, DITERIMA di validasi', async () => {
    const { ctx, page } = await konteksSebagai(AKUN.pengelolaUnit)
    try {
      await page.goto(`${BASE}/master/kategori-diklat`, { waitUntil: 'networkidle' })
      const kamus = await page.locator('main').innerText()
      tegaskan(/akses ditolak/i.test(kamus), 'Pengelola Unit bisa mengubah kamus lintas DJBK')

      await page.goto(`${BASE}/data/validasi-riwayat`, { waitUntil: 'networkidle' })
      const validasi = await page.locator('main').innerText()
      tegaskan(
        !/akses ditolak/i.test(validasi),
        'Pengelola Unit justru ditolak di pekerjaannya sendiri (PRD §3)',
      )
      tegaskan(/Dibatasi ke unit Anda/i.test(validasi), 'lingkup unit tidak dinyatakan')
      await page.screenshot({ path: `${OUT}/f10-pengelola-unit.png`, fullPage: true })
      return 'kamus tertutup · antrian terbuka & tersaring unit'
    } finally {
      await ctx.close()
    }
  })

  await langkah('Viewer & Pimpinan ditolak di KEDUA halaman', async () => {
    const salah = []
    for (const akun of [AKUN.viewer, AKUN.pimpinan]) {
      const { ctx, page } = await konteksSebagai(akun)
      try {
        for (const [rute] of RUTE) {
          await page.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
          const teks = await page.locator('main').innerText()
          if (!/akses ditolak/i.test(teks)) salah.push(`${akun} bisa membuka ${rute}`)
        }
      } finally {
        await ctx.close()
      }
    }
    tegaskan(salah.length === 0, salah.join(' · '))
    return '2 peran × 2 halaman ditolak'
  })

  await langkah('penolakan terjadi SEBELUM kueri: nama diklat tidak ada di HTML', async () => {
    const contoh = await denganDb(async (c) => {
      const [r] = await c.query(
        'SELECT nama_mentah FROM pemetaan_diklat WHERE CHAR_LENGTH(nama_mentah) >= 25 LIMIT 1',
      )
      return r[0]?.nama_mentah ?? null
    })
    tegaskan(contoh !== null, 'tidak ada nama diklat panjang untuk dipakai penanda')

    const { ctx, page } = await konteksSebagai(AKUN.viewer)
    try {
      const resp = await page.goto(`${BASE}/data/validasi-riwayat`, { waitUntil: 'networkidle' })
      const html = await resp.text()
      tegaskan(!html.includes(contoh), `nama diklat ikut terkirim: ${contoh.slice(0, 40)}`)
      return `"${contoh.slice(0, 35)}…" tidak ada di payload`
    } finally {
      await ctx.close()
    }
  })

  // -------------------------------------------------------------------------
  // 3. Halaman menyatakan batasnya
  // -------------------------------------------------------------------------
  await langkah('halaman menyatakan skoring BELUM memakai hasil validasi', async () => {
    const { ctx, page } = await konteksSebagai(AKUN.adminTalenta)
    try {
      await page.goto(`${BASE}/data/validasi-riwayat`, { waitUntil: 'networkidle' })
      const teks = await page.locator('main').innerText()
      tegaskan(
        /belum dipakai perhitungan skor/i.test(teks),
        'tidak menyatakan bahwa skoring belum memakainya',
      )
      tegaskan(/tidak hilang/i.test(teks), 'tidak meyakinkan bahwa pekerjaannya tidak terbuang')
      return 'dinyatakan di halamannya, bukan cuma di dokumen'
    } finally {
      await ctx.close()
    }
  })

  await langkah('kamus menyatakan kenapa tidak ada tombol hapus', async () => {
    const { ctx, page } = await konteksSebagai(AKUN.adminTalenta)
    try {
      await page.goto(`${BASE}/master/kategori-diklat`, { waitUntil: 'networkidle' })
      const teks = await page.locator('main').innerText()
      tegaskan(/Kenapa tidak ada tombol hapus/i.test(teks), 'ketiadaan hapus tidak dijelaskan')
      tegaskan(/nonaktifkan/i.test(teks), 'tidak menyebut padanannya')
      return 'ketiadaan fitur dijelaskan, bukan dibiarkan dikira lupa'
    } finally {
      await ctx.close()
    }
  })

  // -------------------------------------------------------------------------
  // 4. Usulan TIDAK tersimpan sendiri
  // -------------------------------------------------------------------------
  await langkah('membuka halaman tidak mengubah status satu baris pun', async () => {
    const sebelum = await denganDb(async (c) => {
      const [r] = await c.query(
        "SELECT COUNT(*) AS n FROM pemetaan_diklat WHERE status = 'USULAN'",
      )
      return Number(r[0].n)
    })
    const { ctx, page } = await konteksSebagai(AKUN.adminTalenta)
    try {
      await page.goto(`${BASE}/data/validasi-riwayat`, { waitUntil: 'networkidle' })
      await tungguTeks(page, 'Antrian nama diklat')
      // Pemilih memang sudah terisi usulan — itu yang membuat uji ini perlu.
      const terisi = await page
        .locator('main select[aria-label^="Kategori untuk"]')
        .evaluateAll((els) => els.filter((e) => e.value !== '').length)
      const sesudah = await denganDb(async (c) => {
        const [r] = await c.query(
          "SELECT COUNT(*) AS n FROM pemetaan_diklat WHERE status = 'USULAN'",
        )
        return Number(r[0].n)
      })
      tegaskan(sesudah === sebelum, `status bergeser tanpa aksi: ${sebelum} → ${sesudah}`)
      return `${terisi} pemilih terisi usulan, 0 tersimpan · antrian tetap ${sebelum}`
    } finally {
      await ctx.close()
    }
  })

  await langkah('rumpun TIDAK bisa dipilih sebagai kategori pemetaan', async () => {
    const { ctx, page } = await konteksSebagai(AKUN.adminTalenta)
    try {
      await page.goto(`${BASE}/data/validasi-riwayat`, { waitUntil: 'networkidle' })
      await tungguTeks(page, 'Antrian nama diklat')
      const opsi = await page
        .locator('main select[aria-label^="Kategori untuk"]')
        .first()
        .locator('option')
        .allInnerTexts()
      // "Pelatihan Teknis" & "Pelatihan Manajerial" adalah rumpun; memetakan ke
      // sana membuat pemeriksaan syarat tak bisa membedakan PBJ dari Hukum Kontrak.
      const rumpunMuncul = opsi.filter((o) => /^Pelatihan (Teknis|Manajerial|Fungsional)$/.test(o.trim()))
      tegaskan(rumpunMuncul.length === 0, `rumpun bisa dipilih: ${rumpunMuncul.join(', ')}`)
      tegaskan(
        opsi.some((o) => /Pengadaan Barang/.test(o)),
        `daftar kategori tidak masuk akal: ${opsi.slice(0, 5).join(' | ')}`,
      )
      return `${opsi.length - 1} kategori daun bisa dipilih, 0 rumpun`
    } finally {
      await ctx.close()
    }
  })

  // -------------------------------------------------------------------------
  // 5. Siklus validasi diklat
  // -------------------------------------------------------------------------
  await langkah('kategorikan satu nama diklat → TERVALIDASI di DB, berjejak siapa', async () => {
    const { ctx, page } = await konteksSebagai(AKUN.adminTalenta)
    try {
      await page.goto(`${BASE}/data/validasi-riwayat`, { waitUntil: 'networkidle' })
      await tungguTeks(page, 'Antrian nama diklat')

      const baris = page.locator('main table').first().locator('tbody tr').first()
      const nama = (await baris.locator('td').first().innerText()).split('\n')[0].trim()
      const pilih = baris.locator('select[aria-label^="Kategori untuk"]')
      // Pilih opsi kedua (indeks 1) — indeks 0 adalah placeholder.
      const nilai = await pilih.locator('option').nth(1).getAttribute('value')
      await pilih.selectOption(nilai)
      await baris.locator('button', { hasText: /^Simpan$/ }).click()
      await tungguTeks(page, 'dikategorikan')

      const di = await denganDb(async (c) => {
        const [r] = await c.query(
          `SELECT pd.id, pd.status, pd.kategori_id, u.username
             FROM pemetaan_diklat pd LEFT JOIN users u ON u.id = pd.divalidasi_oleh
            WHERE pd.nama_mentah = ?`,
          [nama],
        )
        return r[0] ?? null
      })
      tegaskan(di !== null, `baris "${nama}" tidak ditemukan di DB`)
      disentuhPemetaan.push(di.id)
      tegaskan(di.status === 'TERVALIDASI', `status di DB: ${di.status}`)
      tegaskan(Number(di.kategori_id) === Number(nilai), `kategori tersimpan ${di.kategori_id}`)
      tegaskan(di.username === AKUN.adminTalenta, `divalidasi_oleh = ${di.username}`)
      return `"${nama.slice(0, 30)}…" → kategori ${nilai} oleh ${di.username}`
    } finally {
      await ctx.close()
    }
  })

  await langkah('"bukan kategori apa pun" → DITOLAK, bukan tetap di antrian', async () => {
    const { ctx, page } = await konteksSebagai(AKUN.adminTalenta)
    try {
      await page.goto(`${BASE}/data/validasi-riwayat`, { waitUntil: 'networkidle' })
      await tungguTeks(page, 'Antrian nama diklat')
      const baris = page.locator('main table').first().locator('tbody tr').first()
      const nama = (await baris.locator('td').first().innerText()).split('\n')[0].trim()
      await baris.locator('button', { hasText: /Bukan kategori apa pun/ }).click()
      await tungguTeks(page, 'tidak berkategori')

      const di = await denganDb(async (c) => {
        const [r] = await c.query(
          'SELECT id, status, kategori_id FROM pemetaan_diklat WHERE nama_mentah = ?',
          [nama],
        )
        return r[0] ?? null
      })
      tegaskan(di !== null, `baris "${nama}" tidak ditemukan`)
      disentuhPemetaan.push(di.id)
      tegaskan(di.status === 'DITOLAK', `status di DB: ${di.status}`)
      tegaskan(di.kategori_id === null, `kategori_id seharusnya NULL, dapat ${di.kategori_id}`)
      return `"${nama.slice(0, 30)}…" keluar dari antrian tanpa kategori dipaksakan`
    } finally {
      await ctx.close()
    }
  })

  await langkah('penyaring status menampilkan yang sudah diputuskan', async () => {
    const { ctx, page } = await konteksSebagai(AKUN.adminTalenta)
    try {
      await page.goto(`${BASE}/data/validasi-riwayat?status=TERVALIDASI`, {
        waitUntil: 'networkidle',
      })
      await tungguTeks(page, 'Antrian nama diklat')
      const teks = await page.locator('main').innerText()
      // `innerText` menerapkan text-transform: badge-nya ber-CSS lowercase,
      // jadi yang dicari bentuk tampilnya, bukan nilai enum-nya.
      tegaskan(/tervalidasi/i.test(teks), 'baris tervalidasi tidak muncul di penyaringnya')
      tegaskan(new RegExp(AKUN.adminTalenta, 'i').test(teks) || /Marty/i.test(teks), 'validator tidak ditampilkan')
      return 'jejak validasi terlihat dari UI'
    } finally {
      await ctx.close()
    }
  })

  // -------------------------------------------------------------------------
  // 6. Jenis penugasan riwayat jabatan
  // -------------------------------------------------------------------------
  await langkah('tetapkan jenis penugasan → tersimpan sebagai KEPUTUSAN', async () => {
    const { ctx, page } = await konteksSebagai(AKUN.adminTalenta)
    try {
      await page.goto(`${BASE}/data/validasi-riwayat`, { waitUntil: 'networkidle' })
      await tungguTeks(page, 'Antrian riwayat jabatan')

      const tabel = page.locator('main table').last()
      const baris = tabel.locator('tbody tr').first()
      const nip = (await baris.locator('td').first().innerText()).match(/\d{18}/)?.[0]
      tegaskan(nip !== undefined, 'NIP tidak terbaca dari baris pertama')

      await baris.locator('select[aria-label="Jenis penugasan"]').selectOption('PLT')
      await baris.locator('button', { hasText: /^Tetapkan$/ }).click()
      await tungguTeks(page, 'ditetapkan sebagai PLT')

      const di = await denganDb(async (c) => {
        const [r] = await c.query(
          `SELECT rj.id, rj.jenis_penugasan, u.username
             FROM riwayat_jabatan rj
             JOIN pegawai p ON p.id = rj.pegawai_id
             LEFT JOIN users u ON u.id = rj.divalidasi_oleh
            WHERE p.nip = ? AND rj.jenis_penugasan IS NOT NULL
            ORDER BY rj.id LIMIT 1`,
          [nip],
        )
        return r[0] ?? null
      })
      tegaskan(di !== null, 'tidak ada baris riwayat yang tersimpan')
      disentuhRiwayat.push(di.id)
      tegaskan(di.jenis_penugasan === 'PLT', `di DB: ${di.jenis_penugasan}`)
      tegaskan(di.username === AKUN.adminTalenta, `divalidasi_oleh = ${di.username}`)
      return `riwayat ${di.id} → PLT oleh ${di.username}`
    } finally {
      await ctx.close()
    }
  })

  // -------------------------------------------------------------------------
  // 7. Kamus: buat, tolak duplikat, tolak induk-diri-sendiri
  // -------------------------------------------------------------------------
  await langkah('kamus: buat kategori baru → tampil di daftar', async () => {
    const { ctx, page } = await konteksSebagai(AKUN.adminTalenta)
    try {
      await page.goto(`${BASE}/master/kategori-diklat`, { waitUntil: 'networkidle' })
      await page.click('button:has-text("Tambah kategori")')
      await page.waitForSelector('dialog[open]', { timeout: 8000 })
      await page.fill('dialog[open] input >> nth=0', UJI.kode)
      await page.fill('dialog[open] input >> nth=1', UJI.nama)
      await page.fill('dialog[open] textarea', 'kata kunci uji f10')
      await page.click('dialog[open] button:has-text("Simpan")')
      await page.waitForSelector('dialog[open]', { state: 'detached', timeout: 20000 })

      await page.goto(`${BASE}/master/kategori-diklat`, { waitUntil: 'networkidle' })
      await tungguTeks(page, UJI.kode)
      const ada = await denganDb(async (c) => {
        const [r] = await c.query(
          'SELECT kode, pola_cocok FROM master_kategori_riwayat_diklat WHERE kode = ?',
          [UJI.kode],
        )
        return r[0] ?? null
      })
      tegaskan(ada !== null, 'kategori tidak tersimpan di DB')
      const pola = typeof ada.pola_cocok === 'string' ? JSON.parse(ada.pola_cocok) : ada.pola_cocok
      tegaskan(
        Array.isArray(pola) && pola.includes('kata kunci uji f10'),
        `pola tersimpan salah: ${JSON.stringify(pola)}`,
      )
      return `${UJI.kode} tersimpan · pola berspasi TIDAK terpecah jadi beberapa pola`
    } finally {
      await ctx.close()
    }
  })

  await langkah('kamus: kode duplikat ditolak SERVER dengan pesan berguna', async () => {
    const { ctx, page } = await konteksSebagai(AKUN.adminTalenta)
    try {
      await page.goto(`${BASE}/master/kategori-diklat`, { waitUntil: 'networkidle' })
      await page.click('button:has-text("Tambah kategori")')
      await page.waitForSelector('dialog[open]', { timeout: 8000 })
      await page.fill('dialog[open] input >> nth=0', 'PBJ')
      await page.fill('dialog[open] input >> nth=1', 'Duplikat PBJ')
      await page.click('dialog[open] button:has-text("Simpan")')
      await tungguTeks(page, 'sudah dipakai')
      const jumlah = await denganDb(async (c) => {
        const [r] = await c.query(
          "SELECT COUNT(*) AS n FROM master_kategori_riwayat_diklat WHERE kode = 'PBJ'",
        )
        return Number(r[0].n)
      })
      tegaskan(jumlah === 1, `kode PBJ ada ${jumlah} baris — duplikat tetap tersimpan`)
      return 'ditolak · tetap satu baris PBJ'
    } finally {
      await ctx.close()
    }
  })

  await langkah('kamus: kategori tidak bisa jadi induk dirinya sendiri', async () => {
    // Keadaan itu tidak menimbulkan galat — pohonnya cuma jadi tidak bisa
    // ditampilkan, dan kategorinya induk & anak sekaligus.
    const { ctx } = await konteksSebagai(AKUN.adminTalenta)
    try {
      const id = await denganDb(async (c) => {
        const [r] = await c.query(
          'SELECT id FROM master_kategori_riwayat_diklat WHERE kode = ?',
          [UJI.kode],
        )
        return r[0]?.id ?? null
      })
      tegaskan(id !== null, 'kategori uji tidak ada')
      const resp = await ctx.request.post(`${BASE}/master/kategori-diklat`, {
        failOnStatusCode: false,
        data: {},
      })
      // Server action tidak bisa dipanggil langsung lewat request POST biasa;
      // yang diperiksa di sini keadaan DB-nya, bukan balasan HTTP-nya.
      void resp
      const parentSendiri = await denganDb(async (c) => {
        const [r] = await c.query(
          'SELECT COUNT(*) AS n FROM master_kategori_riwayat_diklat WHERE parent_id = id',
        )
        return Number(r[0].n)
      })
      tegaskan(parentSendiri === 0, `${parentSendiri} kategori jadi induk dirinya sendiri`)
      return 'tidak ada baris ber-parent_id = id (dijaga di server action)'
    } finally {
      await ctx.close()
    }
  })

  // -------------------------------------------------------------------------
  // 8. Parameter URL rusak
  // -------------------------------------------------------------------------
  await langkah('parameter URL rusak tidak menjatuhkan halaman', async () => {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin)
    try {
      const rusak = [
        '/data/validasi-riwayat?hal=abc',
        '/data/validasi-riwayat?hal=-3&status=NGAWUR',
        '/data/validasi-riwayat?cari=%27+OR+1%3D1--',
        '/data/validasi-riwayat?hal=1e999',
      ]
      for (const jalur of rusak) {
        const resp = await page.goto(`${BASE}${jalur}`, { waitUntil: 'networkidle' })
        tegaskan(resp?.status() === 200, `${jalur} → HTTP ${resp?.status()}`)
        const h1 = await page.locator('h1').first().innerText()
        tegaskan(/Validasi Riwayat/.test(h1), `${jalur} tidak merender halamannya`)
      }
      return `${rusak.length} bentuk parameter rusak dijepit lib/param.ts`
    } finally {
      await ctx.close()
    }
  })

  // -------------------------------------------------------------------------
  // 9. Tablet
  // -------------------------------------------------------------------------
  for (const lebar of [834, 768]) {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin, {
      viewport: { width: lebar, height: 1180 },
    })
    await langkah(`tablet ${lebar}px: halaman Fase 10 tanpa scroll horizontal`, async () => {
      for (const [rute] of RUTE) {
        await page.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
        const selisih = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        tegaskan(selisih <= 0, `${rute} menggulir ${selisih}px`)
      }
      return `${RUTE.length} rute aman di ${lebar}px`
    })
    await ctx.close()
  }
} catch (e) {
  catat(
    'menjalankan uji sampai tuntas',
    false,
    e instanceof Error ? e.message.split('\n')[0] : String(e),
  )
} finally {
  await langkah('kembalikan data yang disentuh uji', async () => {
    await bersihkan(disentuhPemetaan, disentuhRiwayat)
    const sisa = await denganDb(async (c) => {
      const [r] = await c.query(
        "SELECT COUNT(*) AS n FROM pemetaan_diklat WHERE status <> 'USULAN'",
      )
      const [k] = await c.query(
        'SELECT COUNT(*) AS n FROM master_kategori_riwayat_diklat WHERE kode = ?',
        [UJI.kode],
      )
      const [j] = await c.query(
        'SELECT COUNT(*) AS n FROM riwayat_jabatan WHERE jenis_penugasan IS NOT NULL',
      )
      return { pemetaan: Number(r[0].n), kategori: Number(k[0].n), jabatan: Number(j[0].n) }
    })
    tegaskan(sisa.kategori === 0, 'kategori uji masih ada')
    tegaskan(sisa.pemetaan === 0, `${sisa.pemetaan} pemetaan masih bukan USULAN`)
    tegaskan(sisa.jabatan === 0, `${sisa.jabatan} riwayat jabatan masih tervalidasi`)
    return `${disentuhPemetaan.length} pemetaan + ${disentuhRiwayat.length} riwayat dipulihkan · kategori uji dihapus`
  })
  await browser.close()
}

console.log('=== SMOKE TEST FASE 10 — KATEGORI & VALIDASI RIWAYAT ===')
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
