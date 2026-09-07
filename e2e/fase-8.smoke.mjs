import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'

import { AKUN, konteksMasuk } from './_masuk.mjs'

/**
 * Smoke test Fase 8 — Laporan & Pusat Ekspor.
 *
 * Fase ini punya satu ciri yang membuatnya berbeda dari fase-fase sebelumnya:
 * **hasil kerjanya keluar dari aplikasi.** Begitu CSV-nya terunduh, tidak ada
 * satu pun aturan akses di sini yang masih berlaku atasnya. Jadi yang diuji
 * bukan "tombolnya berfungsi", tapi hal-hal yang kalau salah **tidak
 * menimbulkan galat apa pun** — berkasnya tetap terunduh, tetap terbuka, dan
 * kesalahannya baru terasa di tempat lain:
 *
 *   - unduhan tanpa sesi menjawab **401**, bukan pengalihan ke halaman masuk.
 *     Pengalihan menghasilkan **HTML halaman login bernama `.csv`** yang
 *     terunduh dengan tenang, dan pemiliknya akan menyimpulkan datanya kosong.
 *     Ini regresi nyata yang pernah terjadi: `middleware.ts` sempat menjaring
 *     `api/`;
 *   - **BOM UTF-8** ada di awal berkas. Tanpa itu Excel di Windows membaca CSV
 *     sebagai ANSI dan setiap nama non-ASCII rusak — dilaporkan sebagai
 *     "ekspornya rusak", lalu didiagnosis di tempat yang salah;
 *   - **tidak ada sel yang dieksekusi Excel.** Aplikasi ini mengekspor catatan
 *     teks bebas yang diisi manusia; satu sel berawalan `=` menjadi formula
 *     hidup di berkas yang dibuka staf lain;
 *   - **peran ditegakkan per jenis ekspor**, dan daftar yang tampil di Pusat
 *     Ekspor sama dengan yang benar-benar dilayani route handler-nya. Kartu yang
 *     tampil tapi ditolak, atau lebih buruk — tidak tampil tapi dilayani, tidak
 *     akan terlihat dari layar mana pun;
 *   - **penyaring ikut ke berkas.** Ekspor yang diam-diam memuat seluruh tabel
 *     padahal layarnya tersaring adalah cara paling halus membuat seseorang
 *     mengirimkan data yang tidak ia maksudkan;
 *   - **audit mencatat jenis + jumlah baris, BUKAN isi datanya**;
 *   - ekspor Audit Log tidak membawa kolom `data_sebelum`/`data_sesudah` —
 *     isi perubahan punya aturan akses yang berbeda dari metadatanya;
 *   - parameter URL rusak tidak menjatuhkan halaman (lanjutan bug `lib/param.ts`).
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-8.smoke.mjs [folder-screenshot] [base-url]
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

const RUTE = [
  ['/laporan/gap-analysis', 'Laporan Gap Analysis'],
  ['/laporan/nominasi', 'Laporan Nominasi & Approval'],
  ['/laporan/ekspor', 'Pusat Ekspor'],
]

/** Tujuh jenis ekspor + peran yang route handler-nya benar-benar melayani. */
const JENIS = [
  ['gap-indikator', 'laporan'],
  ['gap-unit', 'laporan'],
  ['gap-jenjang', 'laporan'],
  ['nominasi', 'laporan'],
  ['rekap-periode', 'laporan'],
  ['rekap-unit', 'laporan'],
  ['audit-log', 'superadmin'],
]

/** Karakter yang membuat Excel & LibreOffice menafsirkan sel sebagai formula. */
const PEMBUKA_FORMULA = ['=', '+', '-', '@', '\t', '\r']

// ---------------------------------------------------------------------------
// DB — hanya untuk hal yang tidak punya permukaan UI (jejak audit, nama pembanding)
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

/**
 * Apakah tampilan sedang dibatasi ke pegawai yang ada di API sumber.
 *
 * Dibaca dari `.env.local` dengan cara yang sama seperti kredensial DB — BUKAN
 * dari `process.env`, yang di berkas smoke ini selalu kosong karena tidak ada
 * dotenv yang dijalankan. Versi pertama memeriksa `process.env` dan karena itu
 * selalu menyimpulkan filternya mati: pembandingnya dihitung dari populasi
 * penuh sementara ekspornya tersaring, dan ujinya melaporkan "penyaringnya
 * diabaikan" untuk penyaring yang justru bekerja.
 */
function hanyaSumber() {
  const isi = readFileSync('.env.local', 'utf8')
  return /^HANYA_PEGAWAI_SUMBER\s*=\s*"?true"?/m.test(isi)
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

// ---------------------------------------------------------------------------
// CSV — pengurai kecil, supaya pemeriksaan sel tidak dilakukan dengan split(',')
// ---------------------------------------------------------------------------
/**
 * Urai CSV RFC 4180 jadi larik baris × sel.
 *
 * Ditulis sendiri, bukan `split(',')`: setiap kolom teks bebas di aplikasi ini
 * boleh memuat koma dan baris baru, jadi pemisahan naif akan **melaporkan
 * jumlah kolom yang salah** dan pemeriksaan formula di bawah ikut memeriksa
 * potongan yang bukan sel.
 */
function uraiCsv(teks) {
  const isi = teks.startsWith('﻿') ? teks.slice(1) : teks
  const baris = []
  let kolom = []
  let sel = ''
  let dalamKutip = false

  for (let i = 0; i < isi.length; i += 1) {
    const c = isi[i]
    if (dalamKutip) {
      if (c === '"') {
        if (isi[i + 1] === '"') {
          sel += '"'
          i += 1
        } else dalamKutip = false
      } else sel += c
      continue
    }
    if (c === '"') dalamKutip = true
    else if (c === ',') {
      kolom.push(sel)
      sel = ''
    } else if (c === '\n') {
      kolom.push(sel)
      baris.push(kolom)
      kolom = []
      sel = ''
    } else if (c !== '\r') sel += c
  }
  if (sel !== '' || kolom.length > 0) {
    kolom.push(sel)
    baris.push(kolom)
  }
  return baris
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
 * Unduh lewat `ctx.request`, yang berbagi cookie dengan konteks browser-nya.
 *
 * Sengaja **bukan** klik tombol lalu menunggu event `download`: yang perlu
 * diperiksa di sini adalah status, header, dan byte pertama berkasnya — dan
 * unduhan peramban menyembunyikan ketiganya.
 */
async function unduh(ctx, jalur) {
  const resp = await ctx.request.get(`${BASE}${jalur}`)
  return { status: resp.status(), headers: resp.headers(), teks: await resp.text() }
}

try {
  // -------------------------------------------------------------------------
  // 1. Halaman laporan di kedua tema
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
      for (const [rute, judul] of RUTE) {
        await page.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
        const nama = judul.toLowerCase().replace(/[^a-z0-9]+/g, '-')
        await page.screenshot({ path: `${OUT}/f8-${nama}.png`, fullPage: true })
      }
    } else {
      await page.goto(`${BASE}/laporan/gap-analysis`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f8-gap-dark.png`, fullPage: true })
    }
    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 2. Isi halaman: batasnya dinyatakan, chart punya padanan tabel
  // -------------------------------------------------------------------------
  {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin)

    await langkah('gap analysis menyatakan apa yang BELUM tercakup', async () => {
      await page.goto(`${BASE}/laporan/gap-analysis`, { waitUntil: 'networkidle' })
      const teks = await page.locator('main').innerText()
      tegaskan(/Yang belum tercakup laporan ini/i.test(teks), 'batas laporan tidak dinyatakan')
      tegaskan(
        /per persyaratan jabatan target/i.test(teks),
        'tidak menyebut rincian per syarat yang memang belum ada',
      )
      return 'nol yang bukan nol dijelaskan di halamannya, bukan cuma di dokumen'
    })

    await langkah('setiap angka agregat punya padanan tabel yang bisa disalin', async () => {
      // Proksi, bukan bukti mutlak: yang dijaga adalah panel agregat baru tidak
      // lahir sebagai chart tanpa tabel. Chart di aplikasi ini selalu punya
      // padanan tabel (aturan aksesibilitas proyek), jadi jumlah tabel yang
      // jatuh di bawah jumlah panel angka adalah tanda pertama aturan itu
      // dilanggar.
      const jumlah = await page.locator('main table').count()
      tegaskan(jumlah >= 3, `hanya ${jumlah} tabel di Gap Analysis`)
      const tanpaHeader = await page.locator('main table:not(:has(thead th))').count()
      tegaskan(tanpaHeader === 0, `${tanpaHeader} tabel tanpa header kolom`)

      await page.goto(`${BASE}/laporan/nominasi`, { waitUntil: 'networkidle' })
      const jumlahN = await page.locator('main table').count()
      tegaskan(jumlahN >= 3, `hanya ${jumlahN} tabel di Laporan Nominasi`)
      return `${jumlah} tabel (gap) · ${jumlahN} tabel (nominasi), semuanya berheader`
    })

    await langkah('parameter URL rusak tidak menjatuhkan halaman laporan', async () => {
      // Lanjutan bug nyata Fase 7: `Number('abc')` → NaN masuk LIMIT/OFFSET dan
      // MySQL menjawab "Undeclared variable: NaN". Pembacanya sekarang terpusat
      // di `lib/param.ts`; uji ini yang membuktikan halaman Fase 8 memakainya.
      const rusak = [
        '/laporan/gap-analysis?target=abc&unit=-3&jenjang=%3Cscript%3E',
        '/laporan/gap-analysis?target=1e999&unit=NaN',
        '/laporan/nominasi?dari=bukan-tanggal&sampai=2026-13-45',
        '/laporan/nominasi?dari=2026-02-30&target=0',
        '/laporan/nominasi?dari=%27+OR+1%3D1--',
      ]
      for (const jalur of rusak) {
        const resp = await page.goto(`${BASE}${jalur}`, { waitUntil: 'networkidle' })
        tegaskan(resp?.status() === 200, `${jalur} → HTTP ${resp?.status()}`)
        const h1 = await page.locator('h1').first().innerText()
        tegaskan(/^Laporan/.test(h1), `${jalur} tidak merender halamannya (h1="${h1}")`)
      }
      return `${rusak.length} bentuk parameter rusak dijepit di boundary`
    })

    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 3. Daftar kartu di Pusat Ekspor = apa yang benar-benar dilayani
  // -------------------------------------------------------------------------
  /**
   * Yang dijaga langkah ini adalah **aturannya**, bukan jumlah kartunya.
   *
   * Versi lama mematok `7` dan `6`; menambah satu jenis ekspor yang sah
   * (`riwayat-perhitungan`, 12 Agu 2026) membuatnya merah tanpa ada yang rusak —
   * dan angka ajaib itu akan merah lagi setiap kali jenis ekspor bertambah.
   * Aturan yang benar-benar penting: **Audit log hanya untuk Super Admin**, dan
   * selisih antara keduanya TEPAT satu kartu itu. Kalau suatu hari selisihnya
   * jadi dua, berarti ada jenis lain yang tiba-tiba disembunyikan dari Admin
   * Talenta — dan itu memang harus merah.
   */
  await langkah('Pusat Ekspor: Audit log hanya Super Admin, sisanya sama', async () => {
    const hitung = async (akun) => {
      const { ctx, page } = await konteksSebagai(akun)
      try {
        await page.goto(`${BASE}/laporan/ekspor`, { waitUntil: 'networkidle' })
        const teks = await page.locator('main').innerText()
        const n = await page.locator('main a[download]').count()
        return { n, adaAudit: /Audit log/.test(teks) }
      } finally {
        await ctx.close()
      }
    }
    const sa = await hitung(AKUN.superAdmin)
    const at = await hitung(AKUN.adminTalenta)
    tegaskan(sa.n > 0, 'Super Admin tidak melihat satu pun kartu ekspor')
    tegaskan(sa.adaAudit, 'kartu Audit log tidak tampil untuk Super Admin')
    tegaskan(!at.adaAudit, 'kartu Audit log tampil untuk Admin Talenta')
    tegaskan(
      sa.n - at.n === 1,
      `selisih kartu ${sa.n} vs ${at.n} = ${sa.n - at.n}, seharusnya tepat 1 (Audit log)`,
    )
    return `Super Admin ${sa.n} kartu · Admin Talenta ${at.n} · selisihnya cuma Audit log`
  })

  // -------------------------------------------------------------------------
  // 4. RBAC halaman laporan — ditolak SEBELUM kueri
  // -------------------------------------------------------------------------
  let namaNominee = null
  await langkah('siapkan: ambil nama kandidat yang ada di laporan nominasi', async () => {
    namaNominee = await denganDb(async (c) => {
      const [r] = await c.query(
        `SELECT p.nama_lengkap AS nama
           FROM nominasi n
           JOIN talent_pool tp ON tp.id = n.talent_pool_id
           JOIN pegawai p ON p.id = tp.pegawai_id
          WHERE CHAR_LENGTH(p.nama_lengkap) >= 10
          LIMIT 1`,
      )
      return r[0]?.nama ?? null
    })
    tegaskan(namaNominee !== null, 'tidak ada nominasi di DB untuk dipakai pembanding')
    return `"${namaNominee}" dipakai sebagai penanda kebocoran`
  })

  for (const akun of [AKUN.viewer, AKUN.pengelolaUnit]) {
    const { ctx, page } = await konteksSebagai(akun)

    await langkah(`RBAC: ${akun} ditolak di ketiga halaman laporan`, async () => {
      const ditolak = []
      for (const [rute] of RUTE) {
        await page.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
        const teks = await page.locator('main').innerText()
        if (/akses ditolak/i.test(teks)) ditolak.push(rute)
      }
      tegaskan(ditolak.length === 3, `hanya ${ditolak.length}/3 ditolak: ${ditolak.join(', ')}`)
      return `3/3 ditolak — PRD §6.7–6.8 membatasi laporan ke Admin Talenta & Pimpinan`
    })

    await langkah(`RBAC: ${akun} — data laporan tidak ikut terkirim ke HTML`, async () => {
      /*
        Prasyaratnya DIPERIKSA lebih dulu — uji RBAC tidak boleh berteriak palsu.

        Penanda kebocoran di sini adalah nama kandidat nyata dari DB. Ketika
        `nominasi` kosong (24 Agu 2026, sesudah 10 pegawai eNominasi dikeluarkan),
        `namaNominee` bernilai `null`, dan `html.includes(null)` mencari string
        **"null"** — yang muncul di hampir setiap payload React. Hasilnya langkah
        ini melaporkan `nama kandidat "null" ikut terkirim`: sebuah KEGAGALAN RBAC
        yang tidak pernah terjadi.

        Itu jenis kebisingan paling berbahaya di harness keamanan. Uji yang
        berteriak palsu akan diabaikan, dan kebocoran yang sungguhan ikut
        terabaikan bersamanya. Jadi tanpa penanda, langkah ini GAGAL dengan alasan
        yang jujur ("tidak ada data untuk diuji"), bukan menuduh.
      */
      tegaskan(
        typeof namaNominee === 'string' && namaNominee.length >= 4,
        'PRASYARAT TIDAK ADA: butuh satu nominasi di DB sebagai penanda kebocoran. ' +
          'Tabel nominasi kosong, jadi uji ini tidak bisa membuktikan apa pun — ' +
          'ini BUKAN temuan RBAC.',
      )
      const resp = await page.goto(`${BASE}/laporan/nominasi`, { waitUntil: 'networkidle' })
      const html = await resp.text()
      tegaskan(!html.includes(namaNominee), `nama kandidat "${namaNominee}" ikut terkirim`)
      return 'penolakan terjadi sebelum kueri, bukan sesudahnya'
    })

    if (akun === AKUN.viewer) {
      await page.goto(`${BASE}/laporan/gap-analysis`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f8-ditolak.png`, fullPage: true })
    }
    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 5. Gerbang unduhan
  // -------------------------------------------------------------------------
  await langkah('unduhan tanpa sesi: 401, BUKAN halaman login bernama .csv', async () => {
    // Regresi middleware. `matcher` yang menjaring `api/` menghasilkan 307 ke
    // /masuk; peramban mengikutinya dan menyimpan HTML halaman login sebagai
    // berkas .csv — terunduh dengan tenang, tanpa satu pun galat.
    const ctx = await browser.newContext()
    try {
      const r = await unduh(ctx, '/api/internal/ekspor/gap-unit')
      tegaskan(r.status === 401, `HTTP ${r.status}, seharusnya 401`)
      tegaskan(!/<html/i.test(r.teks), 'balasannya HTML, berarti sempat dialihkan ke /masuk')
      tegaskan(
        !(r.headers['content-type'] ?? '').includes('text/html'),
        `content-type=${r.headers['content-type']}`,
      )
      return `401 · ${r.teks.slice(0, 40)}…`
    } finally {
      await ctx.close()
    }
  })

  await langkah('jenis ekspor tidak dikenali → 404, bukan berkas kosong', async () => {
    const { ctx } = await konteksSebagai(AKUN.superAdmin)
    try {
      const r = await unduh(ctx, '/api/internal/ekspor/gap-tidak-ada')
      tegaskan(r.status === 404, `HTTP ${r.status}`)
      tegaskan(!r.teks.startsWith('﻿'), 'justru mengirim CSV untuk jenis yang tidak ada')
      return '404 tanpa berkas'
    } finally {
      await ctx.close()
    }
  })

  await langkah('peran ditegakkan PER JENIS di route handler, bukan cuma di halaman', async () => {
    const cek = async (akun, jenis) => {
      const { ctx } = await konteksSebagai(akun)
      try {
        return (await unduh(ctx, `/api/internal/ekspor/${jenis}`)).status
      } finally {
        await ctx.close()
      }
    }
    const kasus = [
      [AKUN.viewer, 'gap-unit', 403],
      [AKUN.pengelolaUnit, 'nominasi', 403],
      [AKUN.adminTalenta, 'gap-unit', 200],
      [AKUN.adminTalenta, 'audit-log', 403],
      [AKUN.pimpinan, 'rekap-unit', 200],
      [AKUN.pimpinan, 'audit-log', 403],
      [AKUN.superAdmin, 'audit-log', 200],
    ]
    const salah = []
    for (const [akun, jenis, harap] of kasus) {
      const status = await cek(akun, jenis)
      if (status !== harap) salah.push(`${akun} → ${jenis}: ${status} (harap ${harap})`)
    }
    tegaskan(salah.length === 0, salah.join(' · '))
    return `${kasus.length} pasangan peran×jenis sesuai · audit-log hanya Super Admin`
  })

  // -------------------------------------------------------------------------
  // 6. Bentuk berkas — yang baru terlihat setelah dibuka di aplikasi lain
  // -------------------------------------------------------------------------
  {
    const { ctx } = await konteksSebagai(AKUN.superAdmin)

    await langkah('header HTTP: attachment, nama berstempel, no-store', async () => {
      const r = await unduh(ctx, '/api/internal/ekspor/gap-unit')
      tegaskan(r.status === 200, `HTTP ${r.status}`)
      tegaskan(
        (r.headers['content-type'] ?? '').startsWith('text/csv; charset=utf-8'),
        `content-type=${r.headers['content-type']}`,
      )
      const cd = r.headers['content-disposition'] ?? ''
      tegaskan(cd.startsWith('attachment;'), `content-disposition=${cd}`)
      const nama = cd.match(/filename="([^"]+)"/)?.[1] ?? ''
      tegaskan(
        /^simt-gap-unit-\d{8}-\d{4}\.csv$/.test(nama),
        `nama berkas tak berstempel waktu: "${nama}"`,
      )
      // Isinya data pegawai tersaring menurut peran pengunduhnya — ia tidak
      // boleh mengendap di cache bersama mana pun.
      tegaskan(
        /no-store/.test(r.headers['cache-control'] ?? ''),
        `cache-control=${r.headers['cache-control']}`,
      )
      return nama
    })

    await langkah('BOM UTF-8 & CRLF ada di ketujuh jenis ekspor', async () => {
      const tanpaBom = []
      const tanpaCrlf = []
      for (const [jenis] of JENIS) {
        const r = await unduh(ctx, `/api/internal/ekspor/${jenis}`)
        tegaskan(r.status === 200, `${jenis} → HTTP ${r.status}`)
        if (!r.teks.startsWith('﻿')) tanpaBom.push(jenis)
        if (!r.teks.includes('\r\n')) tanpaCrlf.push(jenis)
      }
      tegaskan(tanpaBom.length === 0, `tanpa BOM: ${tanpaBom.join(', ')}`)
      tegaskan(tanpaCrlf.length === 0, `tanpa CRLF: ${tanpaCrlf.join(', ')}`)
      return '7/7 berkas dibaca Excel Windows sebagai UTF-8'
    })

    await langkah('baris header CSV berisi nama kolom manusiawi, bukan nama kolom DB', async () => {
      const r = await unduh(ctx, '/api/internal/ekspor/gap-unit')
      const baris = uraiCsv(r.teks)
      const header = baris[0] ?? []
      const harap = [
        'Unit Organisasi',
        'Jumlah Dinilai',
        'Lolos Syarat',
        'Rata Skor Total',
        'Rata Potkom (65%)',
        'Rata Kualifikasi (20%)',
        'Rata Integritas (15%)',
      ]
      tegaskan(
        header.length === harap.length && harap.every((h, i) => header[i] === h),
        `header: ${JSON.stringify(header)}`,
      )
      // Lebar baris seragam. CSV dengan jumlah sel berbeda per baris tetap
      // terbuka di Excel — kolomnya cuma bergeser, dan pergeseran itu terbaca
      // sebagai angka milik kolom lain.
      const menyimpang = baris.slice(1).filter((b) => b.length !== harap.length).length
      tegaskan(menyimpang === 0, `${menyimpang} baris berjumlah sel berbeda dari headernya`)
      return `${harap.length} kolom · ${baris.length - 1} baris data, lebar seragam`
    })

    await langkah('tidak ada sel yang akan dieksekusi Excel sebagai formula', async () => {
      const temuan = []
      let totalSel = 0
      for (const [jenis] of JENIS) {
        const r = await unduh(ctx, `/api/internal/ekspor/${jenis}`)
        for (const [i, baris] of uraiCsv(r.teks).entries()) {
          for (const [k, sel] of baris.entries()) {
            totalSel += 1
            if (sel !== '' && PEMBUKA_FORMULA.includes(sel[0])) {
              temuan.push(`${jenis} baris ${i} kolom ${k}: ${JSON.stringify(sel.slice(0, 30))}`)
            }
          }
        }
      }
      tegaskan(temuan.length === 0, temuan.slice(0, 3).join(' · '))
      return `${totalSel} sel diperiksa, tidak satu pun berawalan = + - @ tab CR`
    })

    await langkah('ekspor Audit Log TIDAK membawa isi perubahan', async () => {
      // Metadata jejak (siapa, kapan, aksi) dan isi perubahan punya aturan akses
      // berbeda: `data_sebelum`/`data_sesudah` memuat nilai field dari tabel apa
      // pun yang tersentuh. Ikut mengekspornya berarti satu berkas CSV memuat
      // gabungan data yang tidak pernah boleh berada di satu tempat.
      const r = await unduh(ctx, '/api/internal/ekspor/audit-log')
      const header = uraiCsv(r.teks)[0] ?? []
      const bocor = header.filter((h) => /sebelum|sesudah|data_/i.test(h))
      tegaskan(bocor.length === 0, `kolom isi perubahan ikut: ${bocor.join(', ')}`)
      tegaskan(header.includes('Aksi') && header.includes('Pengguna'), `header: ${header.join('|')}`)
      return `${header.length} kolom metadata, tanpa satu pun kolom isi perubahan`
    })

    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 7. Penyaring ikut ke berkas
  // -------------------------------------------------------------------------
  {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin)

    await langkah('penyaring ikut ke berkas, bukan diam-diam diabaikan', async () => {
      const jumlahBaris = async (qs) =>
        uraiCsv((await unduh(ctx, `/api/internal/ekspor/nominasi${qs}`)).teks).length - 1

      const semua = await jumlahBaris('')
      tegaskan(semua > 0, 'ekspor nominasi tanpa penyaring justru kosong')

      // Rentang yang mustahil → hanya baris header. Kalau penyaringnya
      // diabaikan, angkanya akan sama dengan `semua` — dan berkas itu terunduh
      // tanpa keluhan apa pun.
      const mustahil = await jumlahBaris('?dari=2099-01-01&sampai=2099-12-31')
      tegaskan(mustahil === 0, `rentang mustahil tetap memberi ${mustahil} baris`)

      // Hitungan pembandingnya WAJIB memakai populasi yang sama dengan yang
      // diekspor. Versi lama menanyakannya ke DB tanpa batas apa pun, jadi
      // begitu `HANYA_PEGAWAI_SUMBER=true` menyaring ekspornya, ujinya
      // membandingkan 0 baris tersaring dengan 1 baris populasi penuh dan
      // melaporkan "penyaringnya diabaikan" — padahal yang berbeda justru
      // ekspektasinya. Pembanding yang diambil dari sumber berbeda dengan yang
      // diuji akan selalu jadi kegagalan palsu suatu hari.
      const batasPopulasi = hanyaSumber()
          ? `AND EXISTS (SELECT 1 FROM asesmen_talenta a
                          WHERE a.pegawai_id = tp.pegawai_id AND a.sumber_sync = 'eNominasi')`
          : ''
      const target = await denganDb(async (c) => {
        const [r] = await c.query(
          `SELECT tp.jabatan_target_id AS id, COUNT(*) AS n
             FROM nominasi n JOIN talent_pool tp ON tp.id = n.talent_pool_id
            WHERE 1 = 1 ${batasPopulasi}
            GROUP BY tp.jabatan_target_id ORDER BY n ASC LIMIT 1`,
        )
        return r[0] ?? null
      })
      tegaskan(target !== null, 'tidak ada nominasi untuk menguji penyaring target')
      const tersaring = await jumlahBaris(`?target=${target.id}`)
      tegaskan(
        tersaring === Number(target.n),
        `?target=${target.id} memberi ${tersaring} baris, DB bilang ${target.n}`,
      )
      tegaskan(tersaring <= semua, 'hasil tersaring justru lebih banyak dari tanpa saring')
      return `tanpa saring ${semua} · rentang mustahil 0 · ?target=${target.id} ${tersaring}`
    })

    await langkah('tombol di halaman laporan membawa penyaring yang sedang tampil', async () => {
      await page.goto(`${BASE}/laporan/nominasi?dari=2026-01-01&sampai=2026-12-31`, {
        waitUntil: 'networkidle',
      })
      const href = await page.locator('main a[download]').first().getAttribute('href')
      tegaskan(href.includes('dari=2026-01-01'), `href tanpa penyaring: ${href}`)
      tegaskan(href.includes('sampai=2026-12-31'), `href tanpa penyaring: ${href}`)
      // Penyaring yang tidak sah tidak boleh menetes ke href — yang terbawa
      // adalah nilai yang sudah lolos `tanggalIso()`, bukan yang diketik.
      await page.goto(`${BASE}/laporan/nominasi?dari=2026-13-45`, { waitUntil: 'networkidle' })
      const href2 = await page.locator('main a[download]').first().getAttribute('href')
      tegaskan(!href2.includes('2026-13-45'), `tanggal tidak sah ikut ke href: ${href2}`)
      return 'isi berkas = isi layar'
    })

    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 8. Jejak audit: mencatat metadata, bukan isi data
  // -------------------------------------------------------------------------
  {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin)

    await langkah('setiap unduhan tercatat: jenis, penyaring, jumlah baris', async () => {
      const sebelum = await denganDb(async (c) => {
        const [r] = await c.query("SELECT COUNT(*) AS n FROM audit_log WHERE aksi = 'EKSPOR'")
        return Number(r[0].n)
      })

      const r = await unduh(ctx, '/api/internal/ekspor/nominasi?dari=2026-01-01')
      const barisBerkas = uraiCsv(r.teks).length - 1

      const jejak = await denganDb(async (c) => {
        const [b] = await c.query(
          `SELECT data_sesudah, user_id FROM audit_log
            WHERE aksi = 'EKSPOR' ORDER BY id DESC LIMIT 1`,
        )
        const [n] = await c.query("SELECT COUNT(*) AS n FROM audit_log WHERE aksi = 'EKSPOR'")
        return { baris: b[0], jumlah: Number(n[0].n) }
      })

      tegaskan(jejak.jumlah === sebelum + 1, `jumlah jejak ${sebelum} → ${jejak.jumlah}`)
      tegaskan(jejak.baris.user_id !== null, 'unduhan tercatat tanpa pengunduhnya')

      const isi =
        typeof jejak.baris.data_sesudah === 'string'
          ? JSON.parse(jejak.baris.data_sesudah)
          : jejak.baris.data_sesudah
      tegaskan(isi.jenis === 'nominasi', `jenis tercatat "${isi.jenis}"`)
      tegaskan(
        isi.jumlahBaris === barisBerkas,
        `jumlahBaris tercatat ${isi.jumlahBaris}, berkasnya ${barisBerkas} baris`,
      )
      tegaskan(isi.penyaring?.dari === '2026-01-01', `penyaring tercatat ${JSON.stringify(isi.penyaring)}`)
      return `jenis=${isi.jenis} · baris=${isi.jumlahBaris} · penyaring tercatat`
    })

    await langkah('jejak audit TIDAK memuat isi data yang diekspor', async () => {
      // Kalau isi datanya ikut tercatat, `audit_log` berubah jadi salinan kedua
      // seluruh laporan — dengan aturan akses yang berbeda dari sumbernya, dan
      // tanpa satu pun tanda bahwa itu terjadi.
      const isi = await denganDb(async (c) => {
        const [b] = await c.query(
          `SELECT data_sesudah FROM audit_log WHERE aksi = 'EKSPOR' ORDER BY id DESC LIMIT 1`,
        )
        return typeof b[0].data_sesudah === 'string' ? b[0].data_sesudah : JSON.stringify(b[0].data_sesudah)
      })
      tegaskan(!isi.includes(namaNominee), `nama kandidat ikut tercatat di jejak: ${namaNominee}`)
      tegaskan(!/\d{18}/.test(isi), 'ada NIP 18 digit di jejak ekspor')
      tegaskan(isi.length < 500, `jejak ${isi.length} karakter — terlalu besar untuk metadata saja`)
      return `${isi.length} karakter metadata, tanpa NIP & tanpa nama`
    })

    await langkah('unduhan terlihat di Audit Log Viewer sebagai EKSPOR', async () => {
      await page.goto(`${BASE}/admin/audit-log?aksi=EKSPOR`, { waitUntil: 'networkidle' })
      await page.waitForFunction(() => document.body.innerText.includes('EKSPOR'), null, {
        timeout: 20000,
      })
      const teks = await page.locator('main').innerText()
      tegaskan(/baris cocok/.test(teks), 'jumlah baris tidak dilaporkan')
      await page.screenshot({ path: `${OUT}/f8-audit-ekspor.png`, fullPage: true })
      return 'jejak ekspor bisa disaring dari UI, bukan cuma ada di tabel'
    })

    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 9. Tablet
  // -------------------------------------------------------------------------
  for (const lebar of [834, 768]) {
    const { ctx, page } = await konteksSebagai(AKUN.superAdmin, {
      viewport: { width: lebar, height: 1180 },
    })
    await langkah(`tablet ${lebar}px: halaman Fase 8 tanpa scroll horizontal`, async () => {
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
  await browser.close()
}

console.log('=== SMOKE TEST FASE 8 — LAPORAN & PUSAT EKSPOR ===')
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
  '\nCatatan: pembatasan unit (`unitWajib`) pada ekspor TIDAK diuji di sini karena\n' +
    'satu-satunya peran berlingkup unit — Pengelola Unit — tidak berwenang mengunduh\n' +
    'laporan apa pun (PRD §6.7–6.8), jadi cabang itu tidak bisa dieksekusi lewat HTTP.\n' +
    'Ia dipertahankan sebagai pertahanan berlapis: begitu daftar peran laporan berubah,\n' +
    'penyaringnya sudah ada di tempatnya.',
)
process.exit(lulus === hasil.length && errors.length === 0 ? 0 : 1)
