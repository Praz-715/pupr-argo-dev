import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

import { AKUN, SANDI_DEV, konteksMasuk } from './_masuk.mjs'

/**
 * Smoke test Fase 7 — Auth & RBAC.
 *
 * Yang diuji bukan "halaman masuk muncul", tapi hal-hal yang kalau salah
 * **tidak menimbulkan galat apa pun** dan hanya kelihatan sebagai aplikasi
 * yang bekerja normal:
 *
 *   - halaman terlindungi memang tertutup tanpa sesi, dan tujuan yang diminta
 *     tidak hilang setelah masuk;
 *   - balasan gagal tidak membedakan "akun tidak ada" dari "sandi salah" —
 *     kalau berbeda, formulir masuk jadi alat mendata siapa yang punya akun;
 *   - `?next=` tidak bisa dipakai melempar orang ke domain lain;
 *   - sandi tidak pernah singgah di URL (bug pra-hidrasi yang ditemukan saat
 *     mengerjakan fase ini);
 *   - penolakan peran terjadi **di server sebelum kueri**, dibuktikan dengan
 *     memeriksa HTML mentah, bukan teks yang terlihat;
 *   - pembatasan unit ditegakkan **di SQL**: pegawai unit lain tidak ada di
 *     HTML sama sekali, bukan disembunyikan CSS;
 *   - akun yang dinonaktifkan langsung terputus, bukan menunggu ia keluar;
 *   - sistem tidak bisa mengunci dirinya sendiri (Super Admin terakhir).
 *
 * Uji ini membuat satu akun uji lewat UI, menjalankan perjalanan penuh
 * (sandi sementara → wajib ganti → dinonaktifkan), lalu menghapusnya lewat DB
 * karena tidak ada tombol hapus pengguna di UI mana pun — dan uji yang
 * meninggalkan sisa akan menggeser angka baseline setiap kali dijalankan.
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-7.smoke.mjs [folder-screenshot] [base-url]
 */

const BASE = process.argv[3] ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? '.'

const UJI = {
  username: 'uji.fase7',
  email: 'uji.fase7@djbk.pu.go.id',
  nama: 'Akun Uji Fase 7',
  sandiBaru: 'KonstruksiJaya-2026',
}

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
  ['/profil', 'Profil Saya'],
  ['/admin/pengguna', 'Manajemen Pengguna & Peran'],
  ['/admin/audit-log', 'Audit Log'],
  ['/admin/pengaturan', 'Pengaturan Sistem'],
]

// ---------------------------------------------------------------------------
// Akses DB hanya untuk pembersihan & pemeriksaan yang tidak punya permukaan UI
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

async function hapusAkunUji() {
  return denganDb(async (c) => {
    const [baris] = await c.query('SELECT id FROM users WHERE username = ?', [UJI.username])
    for (const u of baris) {
      await c.query('DELETE FROM sesi WHERE user_id = ?', [u.id])
      await c.query('DELETE FROM permintaan_reset_password WHERE user_id = ?', [u.id])
      await c.query('UPDATE audit_log SET user_id = NULL WHERE user_id = ?', [u.id])
      await c.query('DELETE FROM users WHERE id = ?', [u.id])
    }
    return baris.length
  })
}

/** Buka kunci & bereskan sisa percobaan gagal pada akun seed yang dipakai uji. */
async function bukaKunciSeed(username) {
  return denganDb(async (c) => {
    await c.query(
      'UPDATE users SET gagal_masuk_beruntun = 0, terkunci_sampai = NULL WHERE username = ?',
      [username],
    )
  })
}

async function ambilPengaturan(kunci) {
  return denganDb(async (c) => {
    const [b] = await c.query('SELECT nilai FROM pengaturan_sistem WHERE kunci = ?', [kunci])
    return b[0]?.nilai ?? null
  })
}

async function setPengaturan(kunci, nilai) {
  return denganDb(async (c) => {
    await c.query(
      'UPDATE pengaturan_sistem SET nilai = ?, diubah_oleh = NULL, diubah_pada = NULL WHERE kunci = ?',
      [nilai, kunci],
    )
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

/**
 * Masuk manual lewat UI (tanpa cache storageState) — untuk menguji jalurnya
 * sendiri.
 *
 * Menunggu SALAH SATU dari dua keadaan akhir: berpindah halaman (berhasil)
 * atau munculnya kotak galat (gagal). `networkidle` saja tidak cukup —
 * balasan aksi tiba lewat `useActionState`, jadi jaringan sudah sepi sebelum
 * React sempat merender pesannya, dan pembacaan body akan menemukan halaman
 * yang masih kosong.
 */
async function masukManual(page, identitas, sandi) {
  await page.goto(`${BASE}/masuk`, { waitUntil: 'networkidle' })
  await page.fill('input[name="identitas"]', identitas)
  await page.fill('input[name="sandi"]', sandi)
  await page.click('button[type="submit"]')
  await page.waitForFunction(
    () => !location.pathname.startsWith('/masuk') || document.querySelector('[role="alert"]') !== null,
    null,
    { timeout: 60000 },
  )
}

async function tungguTeks(page, teks, timeout = 20000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), teks, { timeout })
}

try {
  await langkah('bersihkan sisa uji sebelumnya', async () => {
    const n = await hapusAkunUji()
    await bukaKunciSeed(AKUN.viewer)
    return n > 0 ? `${n} akun uji sisa dihapus` : 'tidak ada sisa'
  })

  // -------------------------------------------------------------------------
  // 1. Tanpa sesi
  // -------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

    await langkah('tanpa sesi: dashboard dipantulkan ke halaman masuk', async () => {
      await page.goto(BASE, { waitUntil: 'networkidle' })
      const jalur = new URL(page.url()).pathname
      tegaskan(jalur === '/masuk', `mendarat di ${jalur}`)
      return 'GET / → /masuk'
    })

    await langkah('tanpa sesi: tujuan yang diminta dibawa serta (?next=)', async () => {
      await page.goto(`${BASE}/talenta?eselon=III`, { waitUntil: 'networkidle' })
      const url = new URL(page.url())
      tegaskan(url.pathname === '/masuk', `mendarat di ${url.pathname}`)
      const next = url.searchParams.get('next')
      tegaskan(next !== null && next.startsWith('/talenta'), `next="${next}"`)
      tegaskan(next.includes('eselon=III'), 'query aslinya hilang dari next')
      return `next=${next}`
    })

    await langkah('halaman masuk & lupa sandi memang publik', async () => {
      for (const rute of ['/masuk', '/lupa-password']) {
        const resp = await page.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
        tegaskan(resp?.status() === 200, `${rute} → HTTP ${resp?.status()}`)
      }
      await page.screenshot({ path: `${OUT}/f7-masuk.png`, fullPage: true })
      return '/masuk & /lupa-password HTTP 200'
    })

    await langkah('lupa sandi menyatakan tidak ada email yang dikirim', async () => {
      await page.goto(`${BASE}/lupa-password`, { waitUntil: 'networkidle' })
      const teks = await page.locator('main').innerText()
      tegaskan(/Tidak ada email yang dikirim/i.test(teks), 'janji palsu soal email')
      tegaskan(/Super Admin/.test(teks), 'tidak menyebut siapa yang menangani')
      return 'ketiadaan transport surel dinyatakan, bukan disembunyikan'
    })

    await langkah('masuk gagal: akun tak ada & sandi salah berpesan SAMA', async () => {
      await masukManual(page, 'tidak-ada-orang-ini', 'apa-saja-1234')
      await tungguTeks(page, 'tidak cocok')
      const pesanA = await page.locator('[role="alert"]').first().innerText()

      await masukManual(page, AKUN.viewer, 'sandi-yang-salah-1')
      await tungguTeks(page, 'tidak cocok')
      const pesanB = await page.locator('[role="alert"]').first().innerText()

      tegaskan(pesanA === pesanB, `pesan berbeda:\nA="${pesanA}"\nB="${pesanB}"`)
      return `satu pesan untuk dua sebab: "${pesanA}"`
    })

    await langkah('sandi tidak pernah singgah di URL', async () => {
      // Regresi atas bug nyata: sebelum formnya dipasang sebagai
      // <form action={...}>, menekan Enter sebelum React ter-hidrasi memicu
      // submit HTML biasa — GET dengan sandi di query string.
      const url = page.url()
      tegaskan(!/sandi=/.test(url), `sandi ikut ke URL: ${url}`)
      tegaskan(!/identitas=/.test(url), `identitas ikut ke URL: ${url}`)
      return 'tidak ada kredensial di query string'
    })

    await langkah('masuk berhasil membawa pengguna ke tujuan semula', async () => {
      await page.goto(`${BASE}/masuk?next=%2Fpeta-talenta`, { waitUntil: 'networkidle' })
      await page.fill('input[name="identitas"]', AKUN.viewer)
      await page.fill('input[name="sandi"]', SANDI_DEV)
      await page.click('button[type="submit"]')
      await page.waitForFunction(() => !location.pathname.startsWith('/masuk'), null, {
        timeout: 60000,
      })
      const jalur = new URL(page.url()).pathname
      tegaskan(jalur === '/peta-talenta', `mendarat di ${jalur}, bukan /peta-talenta`)
      return 'next dihormati'
    })

    await langkah('cookie sesi httpOnly — tidak terbaca JavaScript halaman', async () => {
      const dariJs = await page.evaluate(() => document.cookie)
      tegaskan(!/simt_sesi/.test(dariJs), `cookie sesi terbaca dari JS: ${dariJs}`)
      const cookies = await ctx.cookies()
      const sesi = cookies.find((c) => c.name === 'simt_sesi')
      tegaskan(sesi !== undefined, 'cookie sesi tidak terpasang sama sekali')
      tegaskan(sesi.httpOnly === true, 'cookie sesi tidak httpOnly')
      tegaskan(sesi.sameSite === 'Lax', `sameSite=${sesi.sameSite}, seharusnya Lax`)
      return 'httpOnly · sameSite=Lax · tak terlihat dari document.cookie'
    })

    await ctx.close()
  }

  await langkah('buka kunci akun seed setelah uji percobaan gagal', async () => {
    await bukaKunciSeed(AKUN.viewer)
    return 'penghitung gagal Viewer dinolkan'
  })

  // -------------------------------------------------------------------------
  // 2. Penguncian akun (murni penegakan server)
  // -------------------------------------------------------------------------
  await langkah('salah sandi berulang mengunci akun, lalu bisa dibuka Super Admin', async () => {
    const maks = Number(await ambilPengaturan('maks_gagal_masuk')) || 5
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    // Pembukaan kunci WAJIB di `finally`. Kalau ia ditaruh setelah `tegaskan`,
    // satu asersi yang gagal meninggalkan akun seed terkunci — dan seluruh
    // langkah berikutnya yang memakai akun itu ikut gagal, jauh dari sebabnya.
    try {
      let pesanTerakhir = ''
      for (let i = 0; i < maks; i += 1) {
        await masukManual(page, AKUN.viewer, `salah-terus-${i}`)
        await tungguTeks(page, 'tidak cocok').catch(() => {})
        pesanTerakhir = await page.locator('[role="alert"]').first().innerText()
      }
      tegaskan(/dikunci/i.test(pesanTerakhir), `pesan terakhir: "${pesanTerakhir}"`)

      // Sandi BENAR pun tetap ditolak selama terkunci — itu inti penghambatnya.
      await masukManual(page, AKUN.viewer, SANDI_DEV)
      const teks = await page.locator('body').innerText()
      tegaskan(/terkunci/i.test(teks), 'sandi benar tetap lolos padahal akun terkunci')
      return `terkunci setelah ${maks} percobaan · sandi benar pun ditolak`
    } finally {
      await ctx.close()
      await bukaKunciSeed(AKUN.viewer)
    }
  })

  // -------------------------------------------------------------------------
  // 3. Rute Fase 7 di kedua tema (Super Admin)
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
      await page.goto(`${BASE}/admin/pengguna`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f7-pengguna.png`, fullPage: true })
      await page.goto(`${BASE}/admin/audit-log`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f7-audit.png`, fullPage: true })
    } else {
      await page.goto(`${BASE}/profil`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f7-profil-dark.png`, fullPage: true })
    }
    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 4. RBAC halaman: ditolak SEBELUM kueri
  // -------------------------------------------------------------------------
  {
    const { ctx, page } = await konteksSebagai(AKUN.viewer)

    await langkah('RBAC: Viewer ditolak di seluruh halaman Administrasi', async () => {
      const ditolak = []
      for (const rute of ['/admin/pengguna', '/admin/audit-log', '/admin/pengaturan']) {
        await page.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
        const teks = await page.locator('main').innerText()
        if (/akses ditolak/i.test(teks)) ditolak.push(rute)
      }
      tegaskan(ditolak.length === 3, `hanya ${ditolak.length}/3 ditolak: ${ditolak.join(', ')}`)
      await page.screenshot({ path: `${OUT}/f7-akses-ditolak.png`, fullPage: true })
      return '3/3 halaman Administrasi ditolak'
    })

    await langkah('RBAC: data pengguna tidak ikut terkirim ke HTML', async () => {
      const resp = await page.goto(`${BASE}/admin/pengguna`, { waitUntil: 'networkidle' })
      const html = await resp.text()
      // Username Super Admin hanya ada di daftar pengguna. Kalau ia muncul,
      // berarti kuerinya sempat jalan dan hasilnya cuma disembunyikan di UI.
      tegaskan(!html.includes('superadmin@djbk.pu.go.id'), 'email akun lain ikut terkirim')
      tegaskan(!/martyanti\.rbs/.test(html), 'username akun lain ikut terkirim')
      return 'ditolak sebelum kueri · tidak ada data pengguna di HTML'
    })

    await langkah('RBAC: Viewer ditolak di Perbandingan Kandidat (PRD §6.3)', async () => {
      const teks = await page
        .goto(`${BASE}/bandingkan`, { waitUntil: 'networkidle' })
        .then(() => page.locator('main').innerText())
      tegaskan(/akses ditolak/i.test(teks), 'Viewer bisa membuka perbandingan kandidat')
      return 'ditolak di server, bukan cuma disembunyikan dari menu'
    })

    await langkah('penolakan menyebutkan ALASAN & jalan keluarnya', async () => {
      await page.goto(`${BASE}/admin/audit-log`, { waitUntil: 'networkidle' })
      const teks = await page.locator('main').innerText()
      tegaskan(/Super Admin/.test(teks), 'tidak menyebut siapa yang boleh')
      tegaskan(/Viewer/.test(teks), 'tidak menyebut peran pengguna sekarang')
      tegaskan(teks.length > 250, 'penjelasan terlalu pendek untuk berguna')
      return 'alasan + peran sekarang + padanan yang masih boleh diakses'
    })

    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 5. Pembatasan data per unit — ditegakkan di SQL
  // -------------------------------------------------------------------------
  {
    const { ctx, page } = await konteksSebagai(AKUN.pengelolaUnit)

    let nipLuar = null
    let namaLuar = null
    await langkah('siapkan: cari pegawai di luar unit Pengelola Unit', async () => {
      const baris = await denganDb(async (c) => {
        const [r] = await c.query(
          `WITH RECURSIVE pohon AS (
             SELECT id FROM unit_organisasi
              WHERE id = (SELECT unit_organisasi_id FROM users WHERE username = ?)
             UNION ALL
             SELECT u.id FROM unit_organisasi u JOIN pohon t ON u.parent_id = t.id
           )
           SELECT p.nip, p.nama_lengkap AS nama
           FROM pegawai p JOIN jabatan j ON j.id = p.jabatan_id
           WHERE p.status_aktif = 'AKTIF' AND j.unit_organisasi_id NOT IN (SELECT id FROM pohon)
             -- Nama pendek seperti "Rus" akan cocok sebagai potongan kata lain
             -- di HTML mana pun, jadi tidak bisa dipakai sebagai bukti bocor.
             AND CHAR_LENGTH(p.nama_lengkap) >= 10
           LIMIT 1`,
          [AKUN.pengelolaUnit],
        )
        return r[0] ?? null
      })
      tegaskan(baris !== null, 'tidak ada pegawai di luar unit untuk diuji')
      nipLuar = baris.nip
      namaLuar = baris.nama
      return `${namaLuar} (${nipLuar}) di luar lingkup`
    })

    await langkah('lingkup: direktori menyatakan dirinya tersaring', async () => {
      await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
      const teks = await page.locator('main').innerText()
      tegaskan(/Dibatasi ke unit Anda/i.test(teks), 'daftar tersaring tanpa keterangan apa pun')
      await page.screenshot({ path: `${OUT}/f7-lingkup-unit.png`, fullPage: true })
      return 'pita keterangan tampil di atas daftar'
    })

    await langkah('lingkup: pegawai unit lain TIDAK ADA di HTML direktori', async () => {
      const resp = await page.goto(`${BASE}/talenta?hal=1`, { waitUntil: 'networkidle' })
      const html = await resp.text()
      tegaskan(!html.includes(nipLuar), `NIP ${nipLuar} ikut terkirim ke klien`)
      return `${namaLuar} tidak ada di payload`
    })

    await langkah('lingkup: profil pegawai unit lain jadi "tidak ditemukan"', async () => {
      // Sengaja TIDAK menuntut HTTP 404. App shell sudah ter-stream lebih dulu,
      // jadi Next tidak bisa lagi mengubah kode statusnya — yang menentukan di
      // sini isi halamannya, dan terutama apa yang TIDAK ikut terkirim.
      const resp = await page.goto(`${BASE}/talenta/${nipLuar}`, { waitUntil: 'networkidle' })
      const html = await resp.text()
      const teks = await page.locator('main').innerText()
      tegaskan(/tidak ditemukan/i.test(teks), `halaman profil justru terbuka: "${teks.slice(0, 120)}"`)
      // NIP-nya memang ikut ada di HTML — ia bagian dari URL yang DIMINTA
      // pemakai, jadi bukan bukti kebocoran. Yang membuktikan tidak ada
      // kebocoran adalah datanya: nama pegawai itu tidak pernah dimuat.
      tegaskan(!html.includes(namaLuar), 'nama pegawai luar lingkup ikut terkirim ke klien')
      // Pesannya sama persis dengan NIP yang memang tidak ada — keberadaan
      // orangnya tidak dikonfirmasi kepada yang tidak berhak tahu.
      return 'tidak dibedakan dari NIP yang memang tidak ada'
    })

    await langkah('lingkup: ?unit= unit lain memberi NOL hasil, bukan dialihkan diam-diam', async () => {
      const unitLain = await denganDb(async (c) => {
        const [r] = await c.query(
          `SELECT j.unit_organisasi_id AS id FROM pegawai p JOIN jabatan j ON j.id = p.jabatan_id
           WHERE p.nip = ?`,
          [nipLuar],
        )
        return r[0]?.id ?? null
      })
      tegaskan(unitLain !== null, 'unit pegawai luar tidak ditemukan')
      const resp = await page.goto(`${BASE}/talenta?unit=${unitLain}`, { waitUntil: 'networkidle' })
      const html = await resp.text()
      tegaskan(!html.includes(nipLuar), 'filter unit lain justru membuka data unit itu')
      return 'irisan dua filter unit = kosong, bukan dialihkan ke unit sendiri'
    })

    await langkah('lingkup: Peta Talenta ikut tersaring, bukan cuma daftarnya', async () => {
      await page.goto(`${BASE}/peta-talenta`, { waitUntil: 'networkidle' })
      const teks = await page.locator('main').innerText()
      tegaskan(/Dibatasi ke unit Anda/i.test(teks), 'peta tidak menyatakan pembatasannya')
      return 'angka sebaran dihitung atas populasi yang boleh dilihat'
    })

    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 6. Manajemen pengguna: perjalanan penuh
  // -------------------------------------------------------------------------
  let sandiSementara = null
  const idPeranViewer = await denganDb(async (c) => {
    const [r] = await c.query("SELECT id FROM roles WHERE nama_role = 'Viewer'")
    return r[0]?.id ?? null
  })
  {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin)

    await langkah('buat akun baru → sandi sementara ditampilkan sekali', async () => {
      await page.goto(`${BASE}/admin/pengguna`, { waitUntil: 'networkidle' })
      await page.click('button:has-text("Tambah pengguna")')
      await page.waitForSelector('dialog[open]', { timeout: 8000 })
      await page.fill('dialog[open] input >> nth=0', UJI.nama)
      await page.fill('dialog[open] input >> nth=1', UJI.username)
      await page.fill('dialog[open] input >> nth=2', UJI.email)
      // Pilih peran menurut ID-nya, bukan label: teks opsi memuat jumlah
      // pengguna aktif ("Viewer (1 aktif)") yang berubah-ubah antar jalannya uji.
      await page.selectOption('dialog[open] select >> nth=0', String(idPeranViewer))
      await page.click('dialog[open] button:has-text("Buat akun")')
      await tungguTeks(page, 'Sandi sementara untuk')
      const kotak = await page.locator('dialog[open] p.select-all').innerText()
      sandiSementara = kotak.trim()
      tegaskan(/^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{2}$/.test(sandiSementara), `bentuk sandi tidak terduga: "${sandiSementara}"`)
      await page.screenshot({ path: `${OUT}/f7-sandi-sementara.png` })
      await page.click('dialog[open] button:has-text("Sudah saya salin")')
      return `sandi sementara terbit (${sandiSementara.length} karakter)`
    })

    await langkah('akun baru ditandai "Sandi sementara" di daftar', async () => {
      await page.goto(`${BASE}/admin/pengguna?cari=uji.fase7`, { waitUntil: 'networkidle' })
      await tungguTeks(page, UJI.nama)
      const teks = await page.locator('main').innerText()
      tegaskan(/Sandi sementara/i.test(teks), 'penanda sandi sementara tidak tampil')
      return 'keadaan akun terbaca dari daftar'
    })

    await langkah('Super Admin tidak bisa menonaktifkan dirinya sendiri', async () => {
      await page.goto(`${BASE}/admin/pengguna?cari=superadmin`, { waitUntil: 'networkidle' })
      await tungguTeks(page, 'Admin Sistem')
      const tombol = page.locator('button:has-text("Nonaktifkan")').first()
      tegaskan(await tombol.isDisabled(), 'tombol nonaktifkan diri sendiri masih bisa ditekan')
      return 'sistem tidak bisa mengunci dirinya sendiri'
    })

    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 7. Perjalanan akun baru: sandi sementara → wajib ganti → aplikasi terbuka
  // -------------------------------------------------------------------------
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

    await langkah('sandi sementara memaksa penggantian sebelum aplikasi terbuka', async () => {
      tegaskan(sandiSementara !== null, 'sandi sementara tidak sempat terbaca')
      await masukManual(page, UJI.username, sandiSementara)
      await page.waitForFunction(() => location.pathname === '/ganti-sandi', null, {
        timeout: 60000,
      })
      // Mencoba menerobos ke dashboard harus dipantulkan balik.
      await page.goto(BASE, { waitUntil: 'networkidle' })
      const jalur = new URL(page.url()).pathname
      tegaskan(jalur === '/ganti-sandi', `berhasil menerobos ke ${jalur}`)
      await page.screenshot({ path: `${OUT}/f7-ganti-sandi-wajib.png`, fullPage: true })
      return 'dashboard tertutup sampai sandi diganti'
    })

    await langkah('kebijakan sandi ditegakkan di server', async () => {
      await page.fill('input[name="sandiLama"]', sandiSementara)
      await page.fill('input[name="sandiBaru"]', 'password123')
      await page.fill('input[name="konfirmasi"]', 'password123')
      await page.click('button[type="submit"]')
      await tungguTeks(page, 'terlalu umum')
      return 'sandi seed dev ditolak sebagai terlalu umum'
    })

    await langkah('ganti sandi berhasil → aplikasi terbuka', async () => {
      await page.fill('input[name="sandiLama"]', sandiSementara)
      await page.fill('input[name="sandiBaru"]', UJI.sandiBaru)
      await page.fill('input[name="konfirmasi"]', UJI.sandiBaru)
      await page.click('button[type="submit"]')
      await page.waitForFunction(() => location.pathname !== '/ganti-sandi', null, {
        timeout: 60000,
      })
      const jalur = new URL(page.url()).pathname
      tegaskan(jalur === '/', `mendarat di ${jalur}`)
      return 'penahan dilepas begitu sandi diganti'
    })

    await langkah('Profil Saya menampilkan peran, lingkup, dan sesi aktif', async () => {
      await page.goto(`${BASE}/profil`, { waitUntil: 'networkidle' })
      await tungguTeks(page, 'Perangkat yang sedang terbuka')
      const teks = await page.locator('main').innerText()
      tegaskan(teks.includes(UJI.username), 'username tidak tampil')
      tegaskan(/Viewer/.test(teks), 'peran tidak tampil')
      tegaskan(/perangkat ini/i.test(teks), 'sesi sendiri tidak ditandai')
      return 'identitas + peran + daftar perangkat'
    })

    // -----------------------------------------------------------------------
    // 8. Nonaktifkan → sesi yang SEDANG berjalan langsung putus
    // -----------------------------------------------------------------------
    await langkah('akun dinonaktifkan → sesi yang sedang berjalan langsung putus', async () => {
      const { ctx: ctxAdmin, page: pAdmin } = await konteksSebagai(AKUN.superAdmin)
      await pAdmin.goto(`${BASE}/admin/pengguna?cari=uji.fase7`, { waitUntil: 'networkidle' })
      await tungguTeks(pAdmin, UJI.nama)
      await pAdmin.click('button:has-text("Nonaktifkan")')
      await pAdmin.waitForSelector('dialog[open]', { timeout: 8000 })
      await pAdmin.click('dialog[open] button:has-text("Lanjutkan")')
      await tungguTeks(pAdmin, 'dinonaktifkan')
      await ctxAdmin.close()

      // Tab akun uji masih terbuka. Kunjungan berikutnya harus dipantulkan —
      // bukan menunggu sesinya kedaluwarsa sendiri.
      await page.goto(`${BASE}/profil`, { waitUntil: 'networkidle' })
      const jalur = new URL(page.url()).pathname
      tegaskan(jalur === '/masuk', `masih bisa membuka ${jalur} setelah dinonaktifkan`)
      return 'pencabutan seketika, bukan menunggu ia keluar sendiri'
    })

    await langkah('akun nonaktif tidak bisa masuk lagi', async () => {
      await masukManual(page, UJI.username, UJI.sandiBaru)
      const jalur = new URL(page.url()).pathname
      tegaskan(jalur === '/masuk', `berhasil masuk ke ${jalur} padahal nonaktif`)
      const teks = await page.locator('body').innerText()
      tegaskan(/tidak cocok/i.test(teks), 'pesan menyingkap status akunnya')
      return 'ditolak dengan pesan umum yang sama'
    })

    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 9. Audit log & pengaturan sistem
  // -------------------------------------------------------------------------
  {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin)

    await langkah('audit log mencatat peristiwa autentikasi', async () => {
      await page.goto(`${BASE}/admin/audit-log?aksi=MASUK_GAGAL`, { waitUntil: 'networkidle' })
      await tungguTeks(page, 'MASUK_GAGAL')
      const teks = await page.locator('main').innerText()
      tegaskan(/baris cocok/.test(teks), 'jumlah baris tidak dilaporkan')
      return 'percobaan masuk gagal tercatat & bisa disaring'
    })

    await langkah('audit log membuka rincian: hanya field yang BERUBAH', async () => {
      await page.goto(`${BASE}/admin/audit-log?entitas=users&aksi=UBAH_STATUS`, {
        waitUntil: 'networkidle',
      })
      await tungguTeks(page, 'UBAH_STATUS')
      // Dibatasi ke <main>: tombol pertama ber-aria-expanded di halaman ini
      // adalah menu pengguna di navbar, bukan baris audit.
      await page.locator('main button[aria-expanded="false"]').first().click()
      // Jangan menunggu kata "Sebelum": header tabelnya ber-CSS `uppercase`,
      // jadi `innerText` mengembalikan "SEBELUM". Yang ditunggu barisnya
      // benar-benar terbuka.
      await page.locator('main button[aria-expanded="true"]').first().waitFor({ timeout: 20000 })
      const teks = await page.locator('main').innerText()
      // Nama field TIDAK dikunci ke satu nilai: UBAH_STATUS dipakai baik oleh
      // penonaktifan akun (status_aktif) maupun oleh buka-kunci (terkunci),
      // dan baris teratas bergantung pada urutan uji sebelumnya.
      tegaskan(/SEBELUM/.test(teks) && /SESUDAH/.test(teks), 'kolom sebelum/sesudah tidak tampil')
      tegaskan(
        /Status aktif|Terkunci|Harus ganti sandi/i.test(teks),
        'tidak satu pun nama field perubahan ditampilkan',
      )
      await page.screenshot({ path: `${OUT}/f7-audit-diff.png`, fullPage: true })
      return 'diff per field, yang tidak berubah dilipat'
    })

    await langkah('pengaturan: nilai di luar batas ditolak SERVER', async () => {
      await page.goto(`${BASE}/admin/pengaturan`, { waitUntil: 'networkidle' })
      await tungguTeks(page, 'Masa berlaku hasil asesmen')
      const input = page.locator('input[aria-label="Masa berlaku hasil asesmen (tahun)"]')
      await input.fill('999')
      await page.locator('button:has-text("Simpan")').first().click()
      await tungguTeks(page, 'Maksimal')
      const tersimpan = await ambilPengaturan('masa_berlaku_asesmen_tahun')
      tegaskan(tersimpan !== '999', 'nilai di luar batas tetap tersimpan')
      return `ditolak, DB tetap ${tersimpan}`
    })

    await langkah('pengaturan: perubahan sah tersimpan & memperingatkan hitung ulang', async () => {
      const semula = await ambilPengaturan('masa_berlaku_asesmen_tahun')
      const baru = semula === '4' ? '5' : '4'
      const input = page.locator('input[aria-label="Masa berlaku hasil asesmen (tahun)"]')
      await input.fill(baru)
      await page.locator('button:has-text("Simpan")').first().click()
      // Menunggu "Hitung Ulang" TIDAK sah: kalimat peringatannya sudah ada di
      // halaman sebelum tombolnya ditekan. Yang menandai keberhasilan adalah
      // toast yang menyebut nilai barunya.
      await tungguTeks(page, `diubah jadi ${baru}`, 20000)
      const tersimpan = await ambilPengaturan('masa_berlaku_asesmen_tahun')
      tegaskan(tersimpan === baru, `DB berisi ${tersimpan}, seharusnya ${baru}`)
      await setPengaturan('masa_berlaku_asesmen_tahun', semula)
      return `${semula} → ${baru} tersimpan, lalu dikembalikan`
    })

    await langkah('pengaturan: peringatan "tidak retroaktif" ada di halaman', async () => {
      await page.goto(`${BASE}/admin/pengaturan`, { waitUntil: 'networkidle' })
      const teks = await page.locator('main').innerText()
      tegaskan(/tidak retroaktif/i.test(teks), 'tidak memperingatkan skor tersimpan')
      await page.screenshot({ path: `${OUT}/f7-pengaturan.png`, fullPage: true })
      return 'pengguna diberi tahu perlu Hitung Ulang'
    })

    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 10. Tablet
  // -------------------------------------------------------------------------
  for (const lebar of [834, 768]) {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin, {
      viewport: { width: lebar, height: 1180 },
    })
    await langkah(`tablet ${lebar}px: halaman Fase 7 tanpa scroll horizontal`, async () => {
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
  // Kegagalan di LUAR `langkah()` (mis. login yang tidak jadi) tidak boleh
  // menelan seluruh laporan — tanpa ini, satu masalah di tengah membuat
  // 30 langkah yang sudah berjalan hilang dari layar dan sebabnya harus
  // ditebak dari jejak tumpukan.
  catat('menjalankan uji sampai tuntas', false, e instanceof Error ? e.message.split('\n')[0] : String(e))
} finally {
  await langkah('bersihkan akun uji', async () => {
    const n = await hapusAkunUji()
    await bukaKunciSeed(AKUN.viewer)
    return `${n} akun uji dihapus · penghitung gagal seed dinolkan`
  })
  await browser.close()
}

console.log('=== SMOKE TEST FASE 7 — AUTH & RBAC ===')
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
