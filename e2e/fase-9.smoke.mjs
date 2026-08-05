import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

import { AKUN, konteksMasuk } from './_masuk.mjs'

/**
 * Smoke test Fase 9 — API Eksternal `/api/v1` + Klien & Token API.
 *
 * Fase ini mengirim data ASN **ke luar organisasi**. Yang diuji karena kalau
 * salah tidak menimbulkan galat apa pun — balasannya tetap 200, tetap berbentuk
 * JSON yang wajar, dan yang menerimanya tidak punya cara tahu bahwa ia menerima
 * lebih dari haknya:
 *
 *   - `/api/v1` menjawab **401 JSON**, bukan 307 ke `/masuk`. Ini regresi nyata:
 *     `middleware.ts` sempat menjaring `api/`, dan instansi eksternal menerima
 *     HTML halaman login dengan status 200 — pengurai JSON mereka gagal, dan
 *     sebabnya terlihat seperti masalah di pihak mereka;
 *   - **satu pesan 401 untuk semua sebab.** Token asing, token dicabut, dan
 *     token kedaluwarsa harus tidak bisa dibedakan; kalau berbeda, endpoint ini
 *     jadi alat memastikan token mana yang pernah ada;
 *   - **gagal tertutup pada scope.** Klien tanpa scope terbaca mendapat nol
 *     endpoint, bukan semua;
 *   - **penyamaran allowlist, dibuktikan pada payload sungguhan.** Klien tanpa
 *     `data_personal` tidak boleh menerima satu pun NIP 18 digit maupun nama
 *     pegawai — bukan "tidak ada field bernama nip";
 *   - **`id_anonim` tidak bisa disilangkan antar klien.** Pegawai yang sama
 *     harus punya pengenal berbeda di dua klien berbeda, kalau tidak dua
 *     instansi bisa menggabungkan datanya tanpa memegang NIP;
 *   - **siklus utuh kredensial**: terbitkan → pakai → klien dinonaktifkan →
 *     dipulihkan → dicabut → 401. Pencabutan yang tidak benar-benar memutus
 *     akses adalah pencabutan yang cuma terlihat di layar;
 *   - **rate limit dihitung dari tabel**, dan permintaan yang DITOLAK ikut
 *     dihitung — kalau tidak, penolakan jadi cara memanggil gratis;
 *   - plaintext token tampil **tepat sekali** dan tidak pernah masuk DB.
 *
 * Uji ini membuat satu klien API lewat UI, menjalankan seluruh siklusnya, lalu
 * menghapusnya lewat DB — tidak ada tombol hapus klien di UI mana pun, dan uji
 * yang meninggalkan sisa akan menggeser angka setiap kali dijalankan.
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-9.smoke.mjs [folder-screenshot] [base-url]
 */

const BASE = process.argv[3] ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? '.'

/**
 * Token dev. Plaintext-nya SENGAJA ada di repositori (`doc/sql/013`) supaya uji
 * ini bisa memakainya; ketiganya hanya berlaku untuk `pupr_dev` dan wajib
 * dicabut sebelum produksi.
 */
const TOKEN = {
  bkn: 'simt_dev-bkn-hanya-untuk-pupr_dev',
  biroKepeg: 'simt_dev-birokepeg-hanya-untuk-pupr_dev',
  dicabut: 'simt_dev-bkn-lama-sudah-dicabut',
}

const UJI = {
  kode: 'UJIF9',
  nama: 'Instansi Uji Fase 9',
  mou: 'MOU-UJI-F9/2026',
}

/** Sama dengan `BATAS_PERMINTAAN_PER_MENIT` di lib/api/gerbang.ts. */
const BATAS_PERMENIT = 120

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
  ['/admin/api', 'Klien & Token API'],
  ['/admin/api/log', 'Log Aktivitas API'],
  ['/admin/api/dokumentasi', 'Dokumentasi API v1'],
]

// ---------------------------------------------------------------------------
// Permintaan API — polos, tanpa cookie apa pun
// ---------------------------------------------------------------------------
async function panggil(jalur, token, opsi = {}) {
  const headers = { ...(opsi.headers ?? {}) }
  if (token !== null && token !== undefined) headers.Authorization = `Bearer ${token}`
  const resp = await fetch(`${BASE}${jalur}`, { headers, redirect: 'manual' })
  const teks = await resp.text()
  let json = null
  try {
    json = JSON.parse(teks)
  } catch {
    /* biarkan null — pemeriksanya yang memutuskan itu masalah atau bukan */
  }
  return { status: resp.status, headers: resp.headers, teks, json }
}

/** Header Authorization mentah, untuk menguji bentuk yang cacat. */
async function panggilMentah(jalur, header) {
  const resp = await fetch(`${BASE}${jalur}`, {
    headers: header === null ? {} : { Authorization: header },
    redirect: 'manual',
  })
  return { status: resp.status, teks: await resp.text() }
}

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

async function hapusKlienUji() {
  return denganDb(async (c) => {
    const [klien] = await c.query('SELECT id FROM api_client WHERE kode_instansi = ?', [UJI.kode])
    for (const k of klien) {
      await c.query('DELETE FROM api_activity_log WHERE api_client_id = ?', [k.id])
      await c.query('DELETE FROM api_token WHERE api_client_id = ?', [k.id])
      await c.query('DELETE FROM api_client WHERE id = ?', [k.id])
    }
    return klien.length
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

/**
 * Panel klien uji — `<section>` yang dirender `Panel`.
 *
 * **Jumlahnya ditegaskan tepat satu.** Versi pertama uji ini memakai
 * `locator('section, div').filter({hasText: kode}).last()`, yang cocok dengan
 * puluhan div bersarang; `.last()` mengembalikan yang terdalam — yang memang
 * tidak memuat tombol apa pun. Akibatnya langkah "PENDING belum bisa
 * diterbitkan token" LULUS karena tombolnya tidak ditemukan, bukan karena
 * tombolnya tidak ada. Lokator yang salah harus gagal keras, bukan lulus semu.
 */
async function panelKlien(page) {
  const panel = page.locator('main section').filter({ hasText: UJI.kode })
  const n = await panel.count()
  tegaskan(n === 1, `panel klien uji cocok ${n} elemen, seharusnya tepat 1`)
  return panel
}

async function ubahStatusKlien(page, status) {
  await page.goto(`${BASE}/admin/api`, { waitUntil: 'networkidle' })
  await tungguTeks(page, UJI.kode)
  const panel = await panelKlien(page)
  await panel.locator('button', { hasText: /^Ubah$/ }).first().click()
  await page.waitForSelector('dialog[open]', { timeout: 8000 })
  await page.selectOption('dialog[open] select >> nth=0', status)
  await page.click('dialog[open] button:has-text("Simpan")')
  await page.waitForSelector('dialog[open]', { state: 'detached', timeout: 20000 })
}

async function idKlienUji() {
  return denganDb(async (c) => {
    const [r] = await c.query('SELECT id FROM api_client WHERE kode_instansi = ?', [UJI.kode])
    return r[0]?.id ?? null
  })
}

try {
  await langkah('bersihkan sisa uji sebelumnya', async () => {
    const n = await hapusKlienUji()
    return n > 0 ? `${n} klien uji sisa dihapus` : 'tidak ada sisa'
  })

  // -------------------------------------------------------------------------
  // 1. Halaman Fase 9 di kedua tema
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
        const nama = rute.replace(/^\/admin\//, '').replace(/\//g, '-')
        await page.screenshot({ path: `${OUT}/f9-${nama}.png`, fullPage: true })
      }
    } else {
      await page.goto(`${BASE}/admin/api`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f9-api-dark.png`, fullPage: true })
    }
    await ctx.close()
  }

  await langkah('breadcrumb halaman anak tidak mengaku sebagai induknya', async () => {
    // Regresi `itemDariPath()`: versi lama mengembalikan kecocokan PERTAMA, jadi
    // `/admin/api/log` mengaku "Klien & Token API" karena awalannya cocok — dan
    // jejak kembali ke halaman induk ikut hilang.
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin)
    try {
      await page.goto(`${BASE}/admin/api/log`, { waitUntil: 'networkidle' })
      const h1 = await page.locator('h1').first().innerText()
      tegaskan(h1.includes('Log Aktivitas API'), `h1="${h1}"`)
      await page.goto(`${BASE}/admin/api/dokumentasi`, { waitUntil: 'networkidle' })
      const h2 = await page.locator('h1').first().innerText()
      tegaskan(h2.includes('Dokumentasi API'), `h1="${h2}"`)
      return 'yang paling spesifik menang, bukan yang pertama cocok'
    } finally {
      await ctx.close()
    }
  })

  // -------------------------------------------------------------------------
  // 2. RBAC halaman
  // -------------------------------------------------------------------------
  await langkah('RBAC: hanya Super Admin yang bisa membuka Klien & Log Aktivitas', async () => {
    const salah = []
    for (const akun of [AKUN.adminTalenta, AKUN.pengelolaUnit, AKUN.viewer, AKUN.pimpinan]) {
      const { ctx, page } = await konteksSebagai(akun)
      try {
        for (const rute of ['/admin/api', '/admin/api/log']) {
          await page.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
          const teks = await page.locator('main').innerText()
          if (!/akses ditolak/i.test(teks)) salah.push(`${akun} bisa membuka ${rute}`)
        }
      } finally {
        await ctx.close()
      }
    }
    tegaskan(salah.length === 0, salah.join(' · '))
    return '4 peran non-Super-Admin ditolak di kedua halaman kredensial'
  })

  await langkah('RBAC: Dokumentasi terbuka untuk Admin Talenta, tertutup untuk Viewer', async () => {
    // Sengaja berbeda dari dua halaman lainnya: dokumentasi tidak memuat
    // kredensial maupun pola pemakaian, dan Admin Talenta-lah yang menjawab
    // pertanyaan instansi tentang isi field.
    const cek = async (akun) => {
      const { ctx, page } = await konteksSebagai(akun)
      try {
        await page.goto(`${BASE}/admin/api/dokumentasi`, { waitUntil: 'networkidle' })
        return /akses ditolak/i.test(await page.locator('main').innerText())
      } finally {
        await ctx.close()
      }
    }
    tegaskan(!(await cek(AKUN.adminTalenta)), 'Admin Talenta justru ditolak di Dokumentasi')
    tegaskan(await cek(AKUN.viewer), 'Viewer bisa membuka Dokumentasi')
    return 'gerbangnya per halaman, bukan per folder'
  })

  await langkah('RBAC: petunjuk token & kode klien tidak ikut terkirim ke HTML', async () => {
    const { ctx, page } = await konteksSebagai(AKUN.viewer)
    try {
      const resp = await page.goto(`${BASE}/admin/api`, { waitUntil: 'networkidle' })
      const html = await resp.text()
      tegaskan(!/BIROKEPEG-PU/.test(html), 'kode klien ikut terkirim')
      tegaskan(!/simt_…/.test(html), 'petunjuk token ikut terkirim')
      tegaskan(!/sha256:/.test(html), 'hash token ikut terkirim')
      return 'ditolak sebelum kueri'
    } finally {
      await ctx.close()
    }
  })

  // -------------------------------------------------------------------------
  // 3. Gerbang /api/v1 — bukan permukaan bersesi
  // -------------------------------------------------------------------------
  await langkah('tanpa token: 401 JSON, BUKAN pengalihan ke /masuk', async () => {
    const r = await panggil('/api/v1/kotak-9/summary', null)
    tegaskan(r.status === 401, `HTTP ${r.status}`)
    tegaskan(r.json !== null, `balasan bukan JSON: ${r.teks.slice(0, 80)}`)
    tegaskan(
      (r.headers.get('content-type') ?? '').includes('application/json'),
      `content-type=${r.headers.get('content-type')}`,
    )
    tegaskan(r.headers.get('www-authenticate') === 'Bearer', 'tanpa header WWW-Authenticate')
    tegaskan(r.headers.get('location') === null, 'justru mengalihkan')
    tegaskan(!/<html/i.test(r.teks), 'balasannya HTML halaman login')
    return `401 · kode=${r.json.error.kode}`
  })

  await langkah('/api/v1 tidak menyentuh sesi: tanpa Set-Cookie, tanpa cache', async () => {
    const r = await panggil('/api/v1/kotak-9/summary', TOKEN.bkn)
    tegaskan(r.status === 200, `HTTP ${r.status}`)
    tegaskan(r.headers.get('set-cookie') === null, 'balasan API memasang cookie')
    tegaskan(
      (r.headers.get('cache-control') ?? '').includes('no-store'),
      `cache-control=${r.headers.get('cache-control')}`,
    )
    return 'permukaan Bearter murni · no-store'
  })

  await langkah('header Authorization cacat ditolak 401, tidak diterima sebagian', async () => {
    const bentuk = [
      [null, 'tanpa header'],
      ['', 'header kosong'],
      ['Bearer', 'Bearer tanpa token'],
      ['Bearer ', 'Bearer spasi saja'],
      [`Basic ${TOKEN.bkn}`, 'skema Basic'],
      [`Token ${TOKEN.bkn}`, 'skema Token'],
      [`Bearer ${TOKEN.bkn} ekstra`, 'dua ruas'],
      [`Bearer  ${TOKEN.bkn}`, 'spasi ganda'],
    ]
    const lolos = []
    for (const [header, nama] of bentuk) {
      const r = await panggilMentah('/api/v1/kotak-9/summary', header)
      if (r.status !== 401) lolos.push(`${nama} → ${r.status}`)
    }
    tegaskan(lolos.length === 0, lolos.join(' · '))
    // Huruf skema TIDAK case-sensitive (RFC 7235) — ini harus tetap jalan.
    const kecil = await panggilMentah('/api/v1/kotak-9/summary', `bearer ${TOKEN.bkn}`)
    tegaskan(kecil.status === 200, `"bearer" huruf kecil ditolak: ${kecil.status}`)
    return `${bentuk.length} bentuk cacat ditolak · "bearer" huruf kecil tetap diterima`
  })

  await langkah('token asing, dicabut, & kedaluwarsa berpesan SAMA', async () => {
    const asing = await panggil('/api/v1/kotak-9/summary', 'simt_token-yang-tidak-pernah-ada')
    const mati = await panggil('/api/v1/kotak-9/summary', TOKEN.dicabut)
    tegaskan(asing.status === 401 && mati.status === 401, `${asing.status} vs ${mati.status}`)
    tegaskan(
      asing.json.error.pesan === mati.json.error.pesan,
      `pesan berbeda:\nA=${asing.json.error.pesan}\nB=${mati.json.error.pesan}`,
    )
    tegaskan(
      asing.json.error.kode === mati.json.error.kode,
      `kode berbeda: ${asing.json.error.kode} vs ${mati.json.error.kode}`,
    )
    // Pesannya tidak boleh menyebut sebab spesifik — itu yang membedakannya.
    tegaskan(
      !/kedaluwarsa saja|khusus token ini/i.test(asing.json.error.pesan),
      'pesan menyingkap sebab',
    )
    return `satu pesan untuk tiga sebab · kode=${asing.json.error.kode}`
  })

  // -------------------------------------------------------------------------
  // 4. Scope endpoint — gagal tertutup
  // -------------------------------------------------------------------------
  await langkah('scope endpoint ditegakkan per klien & menyebut yang diizinkan', async () => {
    const luar = await panggil('/api/v1/pegawai', TOKEN.bkn)
    tegaskan(luar.status === 403, `HTTP ${luar.status}`)
    tegaskan(luar.json.error.kode === 'SCOPE_TIDAK_MENCAKUP', `kode=${luar.json.error.kode}`)
    // Penolakan yang tidak menyebut apa yang boleh akan berubah jadi tiket.
    tegaskan(/Yang diizinkan:/.test(luar.json.error.pesan), 'tidak menyebut endpoint yang boleh')
    tegaskan(/talent-pool/.test(luar.json.error.pesan), 'daftar yang diizinkan tidak masuk akal')

    const dalam = await panggil('/api/v1/talent-pool', TOKEN.bkn)
    tegaskan(dalam.status === 200, `talent-pool untuk BKN → ${dalam.status}`)

    const kepeg = await panggil('/api/v1/pegawai?per_halaman=2', TOKEN.biroKepeg)
    tegaskan(kepeg.status === 200, `pegawai untuk Biro Kepeg → ${kepeg.status}`)
    return 'BKN: 2 endpoint · Biro Kepeg: 3 endpoint'
  })

  await langkah('bentuk NIP diperiksa sebelum kueri, & 404 tidak sama dengan 400', async () => {
    const cacat = await panggil('/api/v1/pegawai/abc', TOKEN.biroKepeg)
    tegaskan(cacat.status === 400, `NIP cacat → ${cacat.status}`)
    tegaskan(cacat.json.error.kode === 'PERMINTAAN_TIDAK_SAH', `kode=${cacat.json.error.kode}`)
    const tidakAda = await panggil('/api/v1/pegawai/199901019999019999', TOKEN.biroKepeg)
    tegaskan(tidakAda.status === 404, `NIP tak ada → ${tidakAda.status}`)
    tegaskan(tidakAda.json.error.kode === 'TIDAK_DITEMUKAN', `kode=${tidakAda.json.error.kode}`)
    return '400 untuk bentuk salah · 404 untuk tidak ada'
  })

  // -------------------------------------------------------------------------
  // 5. Minimalisasi data — dibuktikan pada payload sungguhan
  // -------------------------------------------------------------------------
  let namaPegawai = []
  await langkah('siapkan: daftar nama pegawai untuk memeriksa kebocoran', async () => {
    namaPegawai = await denganDb(async (c) => {
      const [r] = await c.query(
        `SELECT nama_lengkap AS nama FROM pegawai WHERE CHAR_LENGTH(nama_lengkap) >= 10`,
      )
      return r.map((x) => x.nama)
    })
    tegaskan(namaPegawai.length > 0, 'tidak ada nama pegawai untuk dipakai pembanding')
    return `${namaPegawai.length} nama dipakai sebagai penanda kebocoran`
  })

  await langkah('klien tanpa data_personal: nol NIP & nol nama di payload', async () => {
    for (const jalur of ['/api/v1/talent-pool', '/api/v1/kotak-9/summary']) {
      const r = await panggil(jalur, TOKEN.bkn)
      tegaskan(r.status === 200, `${jalur} → ${r.status}`)
      // Bukan "tidak ada field bernama nip" — yang diperiksa adalah tidak ada
      // 18 digit berurutan di SELURUH badan balasan. Penyamaran blocklist akan
      // lolos pemeriksaan field, tapi tidak lolos yang ini begitu kolom baru
      // ditambahkan ke kuerinya.
      const nip = r.teks.match(/\d{18}/)
      tegaskan(nip === null, `${jalur} memuat NIP 18 digit: ${nip?.[0]}`)
      const bocor = namaPegawai.filter((n) => r.teks.includes(n))
      tegaskan(bocor.length === 0, `${jalur} memuat nama: ${bocor.slice(0, 3).join(', ')}`)
      tegaskan(r.json.meta.data_personal === false, 'meta mengaku punya data personal')
    }
    const tp = await panggil('/api/v1/talent-pool', TOKEN.bkn)
    tegaskan(tp.json.data.length > 0, 'talent-pool kosong, jadi tidak membuktikan apa pun')
    tegaskan(
      tp.json.data.every((b) => typeof b.id_anonim === 'string' && b.id_anonim.length >= 12),
      'ada baris tanpa id_anonim — barisnya jadi tak bisa diacu sama sekali',
    )
    tegaskan(
      tp.json.data.every((b) => b.nip === undefined && b.nama === undefined),
      'field nip/nama ikut terkirim',
    )
    return `${tp.json.data.length} baris talent-pool tanpa satu pun NIP/nama`
  })

  await langkah('catatan reviewer tidak pernah keluar lewat API mana pun', async () => {
    // Isinya alasan keputusan atas nama orang, ditulis untuk pembaca internal.
    // Tidak ada scope yang mencakupnya — jadi ia tidak boleh muncul walau klien
    // punya izin data personal.
    for (const token of [TOKEN.bkn, TOKEN.biroKepeg]) {
      const r = await panggil('/api/v1/talent-pool', token)
      tegaskan(r.status === 200, `HTTP ${r.status}`)
      tegaskan(!/catatan_reviewer|catatanReviewer/.test(r.teks), 'catatan reviewer ikut terkirim')
    }
    return 'tidak ada di kedua klien, termasuk yang berizin data personal'
  })

  await langkah('detail pegawai: turunan NIP tidak ikut walau klien berizin', async () => {
    const daftar = await panggil('/api/v1/pegawai?per_halaman=1', TOKEN.biroKepeg)
    const nip = daftar.json.data[0]?.nip
    tegaskan(typeof nip === 'string' && nip.length === 18, `NIP tidak terbaca: ${nip}`)
    const r = await panggil(`/api/v1/pegawai/${nip}`, TOKEN.biroKepeg)
    tegaskan(r.status === 200, `HTTP ${r.status}`)
    const terlarang = ['tanggal_lahir', 'jenis_kelamin', 'usia', 'pensiun', 'bup', 'diklat']
    const ada = terlarang.filter((k) => Object.keys(r.json.data).some((f) => f.includes(k)))
    tegaskan(ada.length === 0, `field turunan NIP ikut: ${ada.join(', ')}`)
    tegaskan(
      /catatan_minimalisasi/.test(r.teks),
      'tidak menyatakan apa yang sengaja tidak disertakan',
    )
    return `${Object.keys(r.json.data).length} field, tanpa turunan NIP · alasannya ikut di meta`
  })

  await langkah('id_anonim: tetap untuk klien yang sama, BERBEDA antar klien', async () => {
    const kunci = (b) => `${b.jabatan_target_id}|${b.peringkat}`
    const ambil = async (token) => {
      const r = await panggil('/api/v1/talent-pool', token)
      tegaskan(r.status === 200, `HTTP ${r.status}`)
      return new Map(r.json.data.map((b) => [kunci(b), b.id_anonim]))
    }

    const a1 = await ambil(TOKEN.bkn)
    const a2 = await ambil(TOKEN.bkn)
    tegaskan(a1.size > 0, 'talent-pool kosong')
    const tidakStabil = [...a1.keys()].filter((k) => a1.get(k) !== a2.get(k))
    tegaskan(tidakStabil.length === 0, `${tidakStabil.length} id_anonim berubah antar pemanggilan`)

    const b1 = await ambil(TOKEN.biroKepeg)
    const bersama = [...a1.keys()].filter((k) => b1.has(k))
    tegaskan(bersama.length > 0, 'tidak ada baris yang sama di kedua klien untuk dibandingkan')
    const sama = bersama.filter((k) => a1.get(k) === b1.get(k))
    tegaskan(
      sama.length === 0,
      `${sama.length}/${bersama.length} id_anonim IDENTIK antar klien — dua instansi bisa menyilangkan datanya`,
    )
    return `${bersama.length} baris bersama, semuanya berpengenal berbeda per klien`
  })

  // -------------------------------------------------------------------------
  // 6. Siklus utuh kredensial lewat UI
  // -------------------------------------------------------------------------
  let tokenUji = null
  {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin)

    await langkah('klien AKTIF tanpa nomor MoU DITOLAK (dasar hukum wajib)', async () => {
      await page.goto(`${BASE}/admin/api`, { waitUntil: 'networkidle' })
      await page.click('button:has-text("Tambah klien")')
      await page.waitForSelector('dialog[open]', { timeout: 8000 })
      await page.fill('dialog[open] input >> nth=0', UJI.nama)
      await page.fill('dialog[open] input >> nth=1', UJI.kode)
      await page.selectOption('dialog[open] select >> nth=0', 'AKTIF')
      await page.click('dialog[open] button:has-text("Simpan")')
      await tungguTeks(page, 'tanpa nomor MoU')
      const teks = await page.locator('dialog[open]').innerText()
      tegaskan(/UU PDP/.test(teks), 'penolakan tidak menyebut dasar hukumnya')
      return 'AKTIF tanpa MoU ditolak di server, dengan alasan'
    })

    await langkah('klien dibuat PENDING → belum bisa diterbitkan token', async () => {
      // Dialognya masih terbuka dari langkah sebelumnya.
      await page.fill('dialog[open] input >> nth=4', UJI.mou)
      await page.selectOption('dialog[open] select >> nth=0', 'PENDING')
      // Scope: hanya kotak-9-summary, tanpa data personal.
      await page.check('dialog[open] input[type="checkbox"] >> nth=2')
      await page.click('dialog[open] button:has-text("Simpan")')
      await page.waitForSelector('dialog[open]', { state: 'detached', timeout: 20000 })

      await page.goto(`${BASE}/admin/api`, { waitUntil: 'networkidle' })
      await tungguTeks(page, UJI.kode)
      const panel = await panelKlien(page)
      tegaskan(/PENDING/.test(await panel.innerText()), 'klien uji tidak berstatus PENDING')
      const adaTombol = await panel.locator('button', { hasText: /Terbitkan token/ }).count()
      tegaskan(adaTombol === 0, 'tombol terbitkan token muncul untuk klien PENDING')
      // Pembanding positif: tombol Ubah MEMANG ada di panel itu, jadi hitungan
      // nol di atas benar-benar berarti "tidak ada", bukan "lokatornya salah".
      const adaUbah = await panel.locator('button', { hasText: /^Ubah$/ }).count()
      tegaskan(adaUbah === 1, `tombol Ubah ditemukan ${adaUbah}× — lokator panel meleset`)
      return 'PENDING = tidak ada jalan menerbitkan kredensial'
    })

    await langkah('klien dinaikkan ke AKTIF → token bisa diterbitkan', async () => {
      await ubahStatusKlien(page, 'AKTIF')
      await page.goto(`${BASE}/admin/api`, { waitUntil: 'networkidle' })
      await tungguTeks(page, UJI.kode)
      const panel = await panelKlien(page)
      const n = await panel.locator('button', { hasText: /Terbitkan token/ }).count()
      tegaskan(n === 1, `tombol terbitkan token ditemukan ${n}× setelah AKTIF`)
      return 'status AKTIF tersimpan · tombol penerbitan muncul'
    })

    await langkah('token diterbitkan: plaintext tampil TEPAT SEKALI', async () => {
      const panel = await panelKlien(page)
      await panel.locator('button', { hasText: /Terbitkan token/ }).first().click()
      await page.waitForSelector('dialog[open]', { timeout: 8000 })
      await page.fill('dialog[open] input >> nth=0', 'Token smoke Fase 9')
      await page.click('dialog[open] button:has-text("Terbitkan")')
      await tungguTeks(page, 'tidak bisa ditampilkan lagi')
      tokenUji = (await page.locator('dialog[open] code').innerText()).trim()
      tegaskan(/^simt_[A-Za-z0-9_-]{40,}$/.test(tokenUji), `bentuk token tak terduga: ${tokenUji}`)
      await page.screenshot({ path: `${OUT}/f9-token-terbit.png` })

      await page.click('dialog[open] button:has-text("Saya sudah menyalinnya")')
      await page.waitForSelector('dialog[open]', { state: 'detached', timeout: 10000 })
      // Setelah dialog tertutup, plaintext-nya tidak boleh ada lagi di HALAMAN —
      // termasuk tidak di payload RSC yang masih menempel di dokumen.
      const html = await page.content()
      tegaskan(!html.includes(tokenUji), 'plaintext token masih ada di halaman setelah ditutup')
      return `${tokenUji.length} karakter, ditampilkan sekali`
    })

    await langkah('DB menyimpan hash SHA-256, bukan plaintext', async () => {
      tegaskan(tokenUji !== null, 'token belum terbit, langkah ini tidak menguji apa pun')
      const baris = await denganDb(async (c) => {
        const [r] = await c.query(
          `SELECT t.token_hash AS h FROM api_token t
             JOIN api_client c ON c.id = t.api_client_id
            WHERE c.kode_instansi = ? ORDER BY t.id DESC LIMIT 1`,
          [UJI.kode],
        )
        return r[0] ?? null
      })
      tegaskan(baris !== null, 'token tidak tersimpan')
      tegaskan(/^sha256:[0-9a-f]{64}$/.test(baris.h), `bentuk hash salah: ${baris.h}`)
      tegaskan(!baris.h.includes(tokenUji.slice(6)), 'plaintext ikut tersimpan di kolom hash')

      // Bukti tambahan: plaintext-nya tidak ada di kolom mana pun di tabel itu.
      const jejak = await denganDb(async (c) => {
        const [r] = await c.query(
          `SELECT COUNT(*) AS n FROM api_token
            WHERE label LIKE ? OR token_hash LIKE ?`,
          [`%${tokenUji}%`, `%${tokenUji}%`],
        )
        return Number(r[0].n)
      })
      tegaskan(jejak === 0, 'plaintext token ditemukan di tabel api_token')
      return 'sha256:<64 hex> · plaintext tidak ada di DB'
    })

    await langkah('token baru langsung dilayani, sebatas scope-nya', async () => {
      tegaskan(tokenUji !== null, 'token belum terbit, langkah ini tidak menguji apa pun')
      const dalam = await panggil('/api/v1/kotak-9/summary', tokenUji)
      tegaskan(dalam.status === 200, `dalam scope → ${dalam.status}`)
      tegaskan(dalam.json.meta.klien === UJI.kode, `meta.klien=${dalam.json.meta.klien}`)
      tegaskan(dalam.json.meta.data_personal === false, 'klien uji mengaku berizin data personal')

      const luar = await panggil('/api/v1/talent-pool', tokenUji)
      tegaskan(luar.status === 403, `luar scope → ${luar.status}`)
      tegaskan(luar.json.error.kode === 'SCOPE_TIDAK_MENCAKUP', `kode=${luar.json.error.kode}`)
      return '200 di dalam scope · 403 di luar, dari token yang sama'
    })

    await langkah('klien dinonaktifkan → tokennya berhenti berlaku (403), lalu pulih', async () => {
      tegaskan(tokenUji !== null, 'token belum terbit, langkah ini tidak menguji apa pun')
      await ubahStatusKlien(page, 'NONAKTIF')
      const mati = await panggil('/api/v1/kotak-9/summary', tokenUji)
      tegaskan(mati.status === 403, `klien NONAKTIF → ${mati.status}`)
      tegaskan(mati.json.error.kode === 'KLIEN_TIDAK_AKTIF', `kode=${mati.json.error.kode}`)

      await ubahStatusKlien(page, 'AKTIF')
      const hidup = await panggil('/api/v1/kotak-9/summary', tokenUji)
      tegaskan(hidup.status === 200, `klien AKTIF kembali → ${hidup.status}`)
      return 'status klien menutup akses tanpa perlu mencabut tokennya'
    })

    await langkah('rate limit: permintaan yang DITOLAK ikut menghabiskan kuota', async () => {
      tegaskan(tokenUji !== null, 'token belum terbit, langkah ini tidak menguji apa pun')
      // Ini yang membuat batasnya tidak bisa dilewati: kalau penolakan gratis,
      // pemanggil bisa memeriksa scope/keberadaan ribuan kali per menit tanpa
      // menyentuh kuota. Dipakai di sini juga karena panggilan di luar scope
      // ditolak SEBELUM kueri data — 120 permintaan jadi murah.
      const terpakai = async () =>
        denganDb(async (c) => {
          const [r] = await c.query(
            `SELECT COUNT(*) AS n FROM api_activity_log l
               JOIN api_client c2 ON c2.id = l.api_client_id
              WHERE c2.kode_instansi = ? AND l.created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
            [UJI.kode],
          )
          return Number(r[0].n)
        })

      const awal = await terpakai()
      const sisa = BATAS_PERMENIT - awal
      tegaskan(sisa > 0, `kuota sudah habis sebelum diuji (terpakai ${awal})`)
      for (let i = 0; i < sisa; i += 1) {
        // Berurutan, bukan paralel: batas dibaca dari tabel, dan permintaan
        // serentak bisa membacanya sebelum satu pun tercatat — itu bawaan
        // desainnya, bukan hal yang boleh membuat uji ini berkedip.
        await panggil('/api/v1/talent-pool', tokenUji)
      }
      const kena = await panggil('/api/v1/kotak-9/summary', tokenUji)
      tegaskan(kena.status === 429, `permintaan ke-${BATAS_PERMENIT + 1} → ${kena.status}`)
      tegaskan(kena.json.error.kode === 'TERLALU_BANYAK', `kode=${kena.json.error.kode}`)
      tegaskan(
        new RegExp(String(BATAS_PERMENIT)).test(kena.json.error.pesan),
        'pesan tidak menyebut batasnya',
      )
      return `${sisa} penolakan menghabiskan kuota · yang ke-${BATAS_PERMENIT + 1} jadi 429`
    })

    await langkah('token dicabut → pemakaian berikutnya 401, barisnya tetap ada', async () => {
      tegaskan(tokenUji !== null, 'token belum terbit, langkah ini tidak menguji apa pun')
      await page.goto(`${BASE}/admin/api`, { waitUntil: 'networkidle' })
      await tungguTeks(page, 'Token smoke Fase 9')
      // Berjangkar `/^Cabut$/`: `hasText: 'Cabut'` juga cocok dengan tombol
      // "Cabut token" milik DialogKonfirmasi yang dirender sebagai saudaranya.
      const baris = page.locator('tr').filter({ hasText: 'Token smoke Fase 9' })
      const nBaris = await baris.count()
      tegaskan(nBaris === 1, `baris token cocok ${nBaris} elemen, seharusnya tepat 1`)
      await baris.locator('button', { hasText: /^Cabut$/ }).click()
      await page.waitForSelector('dialog[open]', { timeout: 8000 })
      await page.click('dialog[open] button:has-text("Cabut token")')
      // Menunggu dialognya TERTUTUP, bukan menunggu kata "dicabut" — kata itu
      // sudah ada di kalimat akibat di dalam dialognya, jadi penantiannya lolos
      // seketika dan POST server action yang masih terbang ikut terpotong.
      await page.waitForSelector('dialog[open]', { state: 'detached', timeout: 20000 })

      const keadaan = await denganDb(async (c) => {
        const [r] = await c.query(
          `SELECT t.status AS s FROM api_token t JOIN api_client c ON c.id = t.api_client_id
            WHERE c.kode_instansi = ? ORDER BY t.id DESC LIMIT 1`,
          [UJI.kode],
        )
        return r[0]?.s ?? null
      })
      tegaskan(keadaan === 'DICABUT', `status token di DB: ${keadaan}`)

      const r = await panggil('/api/v1/kotak-9/summary', tokenUji)
      tegaskan(r.status === 401, `token dicabut → ${r.status}`)
      // Pesannya sama dengan token asing: pencabutan tidak dikonfirmasi kepada
      // pemegang token.
      tegaskan(r.json.error.kode === 'TIDAK_TERAUTENTIKASI', `kode=${r.json.error.kode}`)
      return 'akses terputus seketika · baris token tetap jadi jejak'
    })

    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 7. Log aktivitas & dokumentasi
  // -------------------------------------------------------------------------
  {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin)

    const klienId = await idKlienUji()

    await langkah('log aktivitas mencatat panggilan uji, berhasil maupun ditolak', async () => {
      // Disaring per klien DAN per endpoint. Tanpa itu 120 baris dari uji rate
      // limit mendorong panggilan 200 keluar dari halaman pertama, dan uji ini
      // akan gagal karena paginasi — bukan karena ada yang tidak tercatat.
      tegaskan(klienId !== null, 'klien uji tidak ditemukan di DB')

      await page.goto(
        `${BASE}/admin/api/log?klien=${klienId}&endpoint=%2Fapi%2Fv1%2Fkotak-9%2Fsummary`,
        { waitUntil: 'networkidle' },
      )
      await tungguTeks(page, UJI.kode)
      const kotak9 = await page.locator('main').innerText()
      for (const kode of ['200', '403', '429', '401']) {
        tegaskan(
          new RegExp(`\\b${kode}\\b`).test(kotak9),
          `status ${kode} tidak muncul untuk /kotak-9/summary`,
        )
      }
      tegaskan(/ms/.test(kotak9), 'waktu respons tidak ditampilkan')
      tegaskan(/Token smoke Fase 9/.test(kotak9), 'label token tidak ditampilkan di barisnya')

      await page.goto(
        `${BASE}/admin/api/log?klien=${klienId}&endpoint=%2Fapi%2Fv1%2Ftalent-pool`,
        { waitUntil: 'networkidle' },
      )
      await tungguTeks(page, UJI.kode)
      const tp = await page.locator('main').innerText()
      tegaskan(/\b403\b/.test(tp), 'penolakan scope tidak tercatat untuk /talent-pool')
      await page.screenshot({ path: `${OUT}/f9-log.png`, fullPage: true })
      return 'kotak-9: 200 · 403 · 429 · 401 — talent-pool: 403'
    })

    await langkah('log menampilkan LABEL token, bukan tokennya maupun hash-nya', async () => {
      tegaskan(tokenUji !== null, 'token belum terbit, langkah ini tidak menguji apa pun')
      const resp = await page.goto(`${BASE}/admin/api/log?klien=${klienId}`, {
        waitUntil: 'networkidle',
      })
      const html = await resp.text()
      tegaskan(!html.includes(tokenUji), 'plaintext token muncul di log aktivitas')
      tegaskan(!/sha256:[0-9a-f]{64}/.test(html), 'hash token ikut terkirim ke klien')
      tegaskan(html.includes('Token smoke Fase 9'), 'label token tidak terkirim sama sekali')
      return 'token tidak bisa dipulihkan dari halaman log; labelnya yang membedakan'
    })

    await langkah('log menyatakan batasnya: percobaan token asing tidak tercatat', async () => {
      // Kolom `api_activity_log.api_client_id` NOT NULL, jadi permintaan
      // bertoken asing tidak punya klien untuk diatribusikan. Halaman ini harus
      // mengatakan itu apa adanya — kalau tidak, "tidak ada 401 di log" akan
      // dibaca sebagai "tidak ada yang mencoba".
      const teks = await page.locator('main').innerText()
      tegaskan(
        /tidak dikenali|tidak tercatat|asing/i.test(teks),
        'halaman tidak menyebutkan percobaan token asing yang tak tercatat',
      )
      return 'lubang jejaknya dinyatakan, bukan disembunyikan'
    })

    await langkah('log: parameter URL rusak tidak menjatuhkan halaman', async () => {
      for (const qs of [
        '?hal=abc',
        '?hal=-5&klien=NaN',
        '?dari=2026-13-45&sampai=bukan-tanggal',
        '?golongan=tidak-ada-golongan-ini',
      ]) {
        const resp = await page.goto(`${BASE}/admin/api/log${qs}`, { waitUntil: 'networkidle' })
        tegaskan(resp?.status() === 200, `${qs} → HTTP ${resp?.status()}`)
        const h1 = await page.locator('h1').first().innerText()
        tegaskan(/Log Aktivitas API/.test(h1), `${qs} tidak merender halamannya`)
      }
      return '4 bentuk parameter rusak dijepit lib/param.ts'
    })

    await langkah('dokumentasi memuat ketiga endpoint, galat, & batas kuota', async () => {
      await page.goto(`${BASE}/admin/api/dokumentasi`, { waitUntil: 'networkidle' })
      const teks = await page.locator('main').innerText()
      for (const e of ['/api/v1/pegawai', '/api/v1/talent-pool', '/api/v1/kotak-9/summary']) {
        tegaskan(teks.includes(e), `endpoint ${e} tidak terdokumentasi`)
      }
      for (const kode of ['401', '403', '429']) {
        tegaskan(new RegExp(`\\b${kode}\\b`).test(teks), `galat ${kode} tidak dijelaskan`)
      }
      tegaskan(
        new RegExp(String(BATAS_PERMENIT)).test(teks),
        `batas ${BATAS_PERMENIT}/menit tidak disebut`,
      )
      tegaskan(/Bearer/.test(teks), 'cara autentikasi tidak dijelaskan')
      tegaskan(/data_personal/.test(teks), 'penyamaran data personal tidak dijelaskan')
      await page.screenshot({ path: `${OUT}/f9-dokumentasi.png`, fullPage: true })
      return 'daftar endpoint diturunkan dari konstanta yang sama dengan gerbangnya'
    })

    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 8. Tablet
  // -------------------------------------------------------------------------
  for (const lebar of [834, 768]) {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin, {
      viewport: { width: lebar, height: 1180 },
    })
    await langkah(`tablet ${lebar}px: halaman Fase 9 tanpa scroll horizontal`, async () => {
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
  await langkah('bersihkan klien & token uji', async () => {
    const n = await hapusKlienUji()
    return `${n} klien uji dihapus beserta token & jejak aktivitasnya`
  })
  await browser.close()
}

console.log('=== SMOKE TEST FASE 9 — API EKSTERNAL /api/v1 ===')
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
console.log(
  '\nCatatan: cabang `GalatScopePersonal` di /api/v1/pegawai/{nip} TIDAK dieksekusi\n' +
    'uji ini. Ia hanya tercapai oleh klien yang scope endpoint-nya MEMUAT "pegawai"\n' +
    'tetapi `data_personal`-nya false; kedua klien dev tidak berbentuk begitu (BKN\n' +
    'tertolak lebih dulu oleh gerbang endpoint). Menguji cabang itu perlu klien dev\n' +
    'keempat — keputusan data seed, bukan pekerjaan uji.',
)
process.exit(lulus === hasil.length && errors.length === 0 ? 0 : 1)
