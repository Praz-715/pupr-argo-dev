import { readFileSync } from 'node:fs'

import { chromium } from '@playwright/test'
import { AKUN, konteksMasuk, SANDI_DEV, sandiUntuk } from './_masuk.mjs'

/**
 * Smoke test ALUR USULAN JABATAN TARGET — lintas tiga peran.
 *
 * Permintaan pemilik proses 24 Agu 2026: *"kalo misalkan kosong user tinggal
 * mengajukan aja jabatannya apa dan persyaratannya apa aja"*, lalu *"rapihin yok
 * biar flownya jalan dengan benar"*.
 *
 * ## Kenapa uji ini ada, dan kenapa lintas peran
 *
 * Alurnya dibagi: **unit mengusulkan** (draft + persyaratan), **Admin Talenta
 * memutuskan** (rubrik + aktivasi). Pembagian seperti itu punya satu bentuk
 * kegagalan khas yang TIDAK pernah muncul sebagai galat — dan sudah dua kali
 * terjadi di proyek ini:
 *
 *   - izin di server dibuka, tapi tombolnya masih tersembunyi → kemampuannya ada,
 *     tidak ada yang tahu;
 *   - tombolnya tampil, tapi server menolak → pengguna mengisi form lalu ditolak.
 *
 * Keduanya hanya bisa ditangkap dengan **benar-benar masuk sebagai perannya** dan
 * mengikuti alurnya sampai selesai. Uji per-halaman tidak akan pernah melihatnya:
 * tiap halaman tampil sempurna sendiri-sendiri.
 *
 * Yang diperiksa:
 *   1. Pengelola Unit punya jalan menuju halaman (entri nav-nya ada);
 *   2. daftar kekosongannya TERSARING lingkup unit — dibandingkan dengan yang
 *      dilihat Super Admin pada halaman yang sama;
 *   3. ia bisa membuat draft, dan pesan suksesnya menyebut Admin Talenta (bukan
 *      menyuruhnya mengerjakan rubrik yang tombolnya tidak ia miliki);
 *   4. ia mendarat di tab Persyaratan dan bisa menyunting di sana;
 *   5. tab Rubrik & tombol aktivasi TIDAK tersedia untuknya;
 *   6. Admin Talenta menerima notifikasi usulan itu di Inbox;
 *   7. Admin Talenta bisa menyalin rubrik lalu MENGAKTIFKAN;
 *   8. pengusulnya menerima notifikasi bahwa targetnya sudah aktif.
 *
 * Uji ini MENGUBAH data lalu mengembalikannya (draft + notifikasinya dihapus di
 * langkah terakhir). Kalau mati di tengah, jalankan ulang: langkah pertamanya
 * membersihkan sisa uji sebelumnya.
 *
 * Jalankan dengan server hidup:
 *   node e2e/usulan-target.smoke.mjs [folder-screenshot] [base-url]
 */

const BASE = process.argv[3] ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? '.'

/**
 * Akun Pengelola Unit yang dipakai sebagai PENGUSUL.
 *
 * `test_pengelola_unit` ditautkan ke unit akar (Direktorat Jenderal Bina
 * Konstruksi), jadi lingkupnya mencakup seluruh pohon — dan hanya karena itu ia
 * punya kursi kosong tanpa jabatan target untuk diusulkan. Akun seed
 * `reza.kurniawan` tidak punya satu pun, jadi alurnya tidak bisa dijalankan
 * sampai selesai dengannya.
 *
 * Justru karena itu keduanya dipakai untuk hal berbeda: pengusulnya
 * `test_pengelola_unit`, sedangkan bukti bahwa penyaringan lingkup BEKERJA diambil
 * dari `reza.kurniawan` — yang daftarnya harus jauh lebih pendek daripada milik
 * Super Admin pada halaman yang sama.
 */
const PENGUSUL = AKUN.pengelolaUnitAkar
const PENYARING = AKUN.pengelolaUnit

/*
  Uji ini butuh sandi akun demo di `.env.local` (`SANDI_SMOKE_TEST_DEMO`). Tanpa itu
  ia BERHENTI dengan pesan yang jelas alih-alih mencoba masuk dan gagal: tiap
  percobaan yang salah menaikkan `gagal_masuk_beruntun`, dan pada percobaan kelima
  akunnya terkunci 15 menit oleh uji otomatis sendiri — kekeliruan yang sudah
  pernah terjadi di harness ini (lihat `e2e/_masuk.mjs`).
*/
if (!sandiUntuk(PENGUSUL) || sandiUntuk(PENGUSUL) === SANDI_DEV) {
  console.log(
    'DILEWATI: `SANDI_SMOKE_TEST_DEMO` tidak ada di .env.local, jadi akun demo\n' +
      `${PENGUSUL} tidak bisa dipakai masuk. Setel variabel itu lalu jalankan ulang.`,
  )
  process.exit(0)
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

// ---------------------------------------------------------------------------
// DB — memeriksa hasil mutasi & membersihkan jejaknya
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

/** Tunggu sampai DB memenuhi syarat, bukan sampai UI berubah bentuk (jebakan #1). */
async function tungguDb(fn, pesan, batasMs = 20000) {
  const mulai = Number(process.hrtime.bigint() / 1000000n)
  for (;;) {
    const h = await denganDb(fn)
    if (h !== null && h !== undefined && h !== false) return h
    if (Number(process.hrtime.bigint() / 1000000n) - mulai > batasMs) {
      throw new Error(`${pesan} (menunggu ${batasMs} ms)`)
    }
    await new Promise((r) => setTimeout(r, 300))
  }
}

let idDraft = null
let namaDraft = null

const browser = await chromium.launch()

try {
  // -------------------------------------------------------------------------
  // 0. Bersihkan sisa uji sebelumnya
  // -------------------------------------------------------------------------
  await langkah('bersihkan sisa draft uji sebelumnya', async () => {
    const n = await denganDb(async (c) => {
      const [baris] = await c.query(
        `SELECT id FROM jabatan_target WHERE deskripsi LIKE '%[SMOKE-USULAN]%'`,
      )
      for (const b of baris) {
        await c.query(`DELETE FROM notifikasi WHERE entitas='jabatan_target' AND entitas_id=?`, [
          b.id,
        ])
        await c.query('DELETE FROM jabatan_target WHERE id = ?', [b.id])
      }
      return baris.length
    })
    return n === 0 ? 'tidak ada sisa' : `${n} sisa dibersihkan`
  })

  // -------------------------------------------------------------------------
  // 1. Pengelola Unit punya JALAN menuju halamannya
  // -------------------------------------------------------------------------
  const ctxUnit = await konteksMasuk(browser, {
    base: BASE,
    akun: PENGUSUL,
    viewport: { width: 1600, height: 1100 },
  })
  const pageUnit = await ctxUnit.newPage()
  pageUnit.on('pageerror', (e) => errors.push(`[unit] pageerror: ${e.message}`))
  pageUnit.on('response', (r) => {
    if (r.status() >= 400) errors.push(`[unit] HTTP ${r.status()} ${r.url()}`)
  })

  await langkah('Pengelola Unit: entri nav "Jabatan Target" ADA', async () => {
    await pageUnit.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    const tautan = pageUnit.locator('nav a[href="/jabatan-target"]')
    tegaskan(
      (await tautan.count()) > 0,
      'tautan nav /jabatan-target tidak ada — kemampuan mengusulkan tidak punya pintu masuk',
    )
    return 'tautan nav tersedia'
  })

  // -------------------------------------------------------------------------
  // 2. Daftar kekosongan TERSARING lingkup
  // -------------------------------------------------------------------------
  await langkah('daftar kekosongan Pengelola Unit lebih pendek daripada Super Admin', async () => {
    const hitungBaris = async (akun) => {
      const c = await konteksMasuk(browser, { base: BASE, akun, viewport: { width: 1600, height: 1100 } })
      const p = await c.newPage()
      await p.goto(`${BASE}/jabatan-target`, { waitUntil: 'networkidle' })
      const n = await p.locator('#jabatan-kosong tbody tr').count()
      const teks = await p.locator('body').innerText()
      await c.close()
      return { n, teks }
    }
    const sa = await hitungBaris(AKUN.superAdmin)
    const pu = await hitungBaris(PENYARING)
    tegaskan(sa.n > 0, 'Super Admin tidak melihat satu pun jabatan kosong (kontrol positif gagal)')
    tegaskan(
      pu.n < sa.n,
      `Pengelola Unit melihat ${pu.n} baris, Super Admin ${sa.n} — daftarnya tidak tersaring lingkup`,
    )
    tegaskan(
      pu.teks.includes('Dibatasi ke unit Anda'),
      'daftar tersaring tanpa keterangan pembatasnya — akan dibaca sebagai daftar lengkap',
    )
    return `Super Admin ${sa.n} baris · Pengelola Unit ${pu.n} baris · keterangan lingkup tampil`
  })

  // -------------------------------------------------------------------------
  // 3. Mengusulkan: draft dibuat, pesannya menyebut Admin Talenta
  // -------------------------------------------------------------------------
  await langkah('Pengelola Unit menekan "Jadikan draft" → DRAFT + 1 anggota', async () => {
    await pageUnit.goto(`${BASE}/jabatan-target`, { waitUntil: 'networkidle' })
    const tombol = pageUnit
      .locator('#jabatan-kosong button', { hasText: /^Jadikan draft$/ })
      .first()
    tegaskan(
      (await tombol.count()) > 0,
      'tidak ada tombol "Jadikan draft" — izin sudah dibuka tapi tombolnya masih tersembunyi',
    )
    await tombol.click()
    // Tunggu KEADAAN (URL editor), bukan teks toast: kalimat toast memuat kata
    // yang sudah ada di layar (jebakan #1).
    await pageUnit.waitForURL(/\/jabatan-target\/\d+\?tab=syarat$/, { timeout: 20000 })
    idDraft = Number(pageUnit.url().match(/\/jabatan-target\/(\d+)/)[1])

    const cek = await denganDb(async (c) => {
      const [[t]] = [
        await c.query('SELECT status, nama_target FROM jabatan_target WHERE id = ?', [idDraft]),
      ]
      const [[a]] = [
        await c.query(
          'SELECT COUNT(*) AS n FROM jabatan_target_anggota WHERE jabatan_target_id = ?',
          [idDraft],
        ),
      ]
      return { status: t[0]?.status, nama: t[0]?.nama_target, anggota: Number(a[0]?.n) }
    })
    namaDraft = cek.nama
    tegaskan(cek.status === 'DRAFT', `status "${cek.status}", bukan DRAFT`)
    tegaskan(cek.anggota === 1, `${cek.anggota} jabatan anggota, seharusnya 1`)

    // Tandai supaya langkah pembersih bisa menemukannya lagi kalau uji ini mati.
    await denganDb((c) =>
      c.query(
        `UPDATE jabatan_target SET deskripsi = CONCAT(COALESCE(deskripsi,''), ' [SMOKE-USULAN]') WHERE id = ?`,
        [idDraft],
      ),
    )
    return `#${idDraft} "${namaDraft}" · DRAFT · 1 anggota`
  })

  await langkah('mendarat di tab Persyaratan dan bisa menyuntingnya', async () => {
    /*
      Yang dicari kendali TULIS yang khas tab ini — "Tambah persyaratan" / "Tambah
      syarat pertama" — bukan sembarang `input`/`select`: halaman ini juga memuat
      kotak pencarian dan pemilih, jadi "ada input" akan hijau bahkan pada tampilan
      yang sepenuhnya baca-saja (jebakan #4, kontrol yang tidak membuktikan apa pun).
    */
    const tambah = pageUnit.locator('button', {
      hasText: /^(Tambah persyaratan|Tambah syarat pertama)$/,
    })
    /*
      DITUNGGU dulu, bukan langsung dihitung: isi tab ini datang lewat `<Suspense>`,
      jadi `count()` seketika sesudah `waitForURL` membaca kerangkanya dan
      melaporkan "tanpa tombol tambah" — kegagalan yang menuduh izin peran padahal
      halamannya cuma belum tiba. Terbukti berpindah-pindah: langkah ini merah
      sekali lalu hijau pada jalan berikutnya tanpa satu baris kode pun berubah
      (jebakan #1 CLAUDE.md, dan ini kali kesekian).

      Menunggunya TIDAK melonggarkan asersinya: kalau tombolnya memang tidak ada,
      penantian ini habis waktu dan `count()` di bawahnya tetap 0 — pesan
      kegagalannya sama, hanya tidak lagi palsu.
    */
    await tambah.first().waitFor({ state: 'attached', timeout: 20000 }).catch(() => {})
    tegaskan(
      (await tambah.count()) > 0,
      'tab Persyaratan tanpa tombol tambah — pengusul tidak bisa mengisi apa pun',
    )
    const diklat = pageUnit.locator('button', { hasText: /^Simpan syarat diklat$/ })
    await pageUnit.screenshot({ path: `${OUT}/usulan-syarat-unit.png`, fullPage: true })
    return `tombol tambah persyaratan ada${(await diklat.count()) > 0 ? ' · panel syarat diklat bisa disimpan' : ''}`
  })

  await langkah('Pimpinan melihat tab Persyaratan TANPA kendali tulis (kontrol negatif)', async () => {
    /*
      Pembanding yang membuat langkah di atas berarti. Tanpa ini, "ada tombol
      Tambah" bisa saja benar untuk SEMUA peran — dan uji yang lulus untuk semua
      orang tidak menguji izin apa pun.
    */
    const c = await konteksMasuk(browser, { base: BASE, akun: AKUN.pimpinan })
    const p = await c.newPage()
    await p.goto(`${BASE}/jabatan-target/${idDraft}?tab=syarat`, { waitUntil: 'networkidle' })
    const n = await p
      .locator('button', { hasText: /^(Tambah persyaratan|Tambah syarat pertama)$/ })
      .count()
    const adaTeks = (await p.locator('body').innerText()).includes('Persyaratan')
    await c.close()
    tegaskan(adaTeks, 'Pimpinan tidak bisa membuka tab Persyaratan sama sekali')
    tegaskan(n === 0, `Pimpinan melihat ${n} tombol tambah persyaratan — seharusnya baca-saja`)
    return 'tab terbuka, tanpa tombol tambah'
  })

  await langkah('Rubrik & aktivasi TIDAK tersedia untuk Pengelola Unit', async () => {
    await pageUnit.goto(`${BASE}/jabatan-target/${idDraft}?tab=rubrik`, {
      waitUntil: 'networkidle',
    })
    const aktifkan = pageUnit.locator('button', { hasText: /^Aktifkan$/ })
    tegaskan(
      (await aktifkan.count()) === 0,
      'tombol Aktifkan tampil untuk Pengelola Unit — aktivasi adalah titik verifikasi Admin Talenta',
    )
    const salin = pageUnit.locator('button', { hasText: /Salin rubrik/ })
    tegaskan((await salin.count()) === 0, 'tombol "Salin rubrik" tampil untuk Pengelola Unit')
    return 'tanpa tombol Aktifkan & tanpa "Salin rubrik"'
  })

  // -------------------------------------------------------------------------
  // 4. Serah-terima ke Admin Talenta
  // -------------------------------------------------------------------------
  await langkah('Admin Talenta menerima notifikasi usulan di Inbox', async () => {
    const ada = await tungguDb(
      async (c) => {
        const [r] = await c.query(
          `SELECT n.id, n.judul FROM notifikasi n
             JOIN users u ON u.id = n.user_id
             JOIN roles r ON r.id = u.role_id
            WHERE n.jenis = 'TARGET_DIUSULKAN' AND n.entitas_id = ? AND r.nama_role = 'Admin Talenta'`,
          [idDraft],
        )
        return r.length > 0 ? r : null
      },
      'notifikasi TARGET_DIUSULKAN tidak pernah sampai ke Admin Talenta',
    )

    const c = await konteksMasuk(browser, { base: BASE, akun: AKUN.adminTalenta })
    const p = await c.newPage()
    await p.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' })
    const teks = await p.locator('body').innerText()
    await p.screenshot({ path: `${OUT}/usulan-inbox-at.png`, fullPage: true })
    await c.close()
    tegaskan(
      teks.includes('Usulan jabatan target'),
      'Inbox Admin Talenta tidak memuat label "Usulan jabatan target" — jenisnya belum dikenali halaman',
    )
    return `${ada.length} notifikasi · label tampil di Inbox`
  })

  // -------------------------------------------------------------------------
  // 5. Admin Talenta memutuskan: salin rubrik → aktifkan
  // -------------------------------------------------------------------------
  const ctxAt = await konteksMasuk(browser, {
    base: BASE,
    akun: AKUN.adminTalenta,
    viewport: { width: 1600, height: 1100 },
  })
  const pageAt = await ctxAt.newPage()
  pageAt.on('pageerror', (e) => errors.push(`[AT] pageerror: ${e.message}`))

  await langkah('Admin Talenta menyalin rubrik ke draft usulan', async () => {
    await pageAt.goto(`${BASE}/jabatan-target/${idDraft}?tab=rubrik`, { waitUntil: 'networkidle' })

    /*
      "Salin rubrik" adalah tombol AKSI, bukan pembuka dialog: pemilih sumbernya
      berdiri di sebelahnya dan sudah terisi pilihan pertama. Versi pertama uji ini
      salah menganggapnya dialog, lalu `selectOption` menunggu 30 detik pada
      `select` yang keliru — sementara penyalinannya sendiri sudah berhasil dengan
      sumber bawaan. Gejalanya menyesatkan: langkah ini merah, langkah aktivasi di
      bawahnya hijau, padahal aktivasi mustahil tanpa rubrik.
    */
    const pilih = pageAt.locator('select[aria-label="Jabatan target sumber"]')
    tegaskan((await pilih.count()) > 0, 'pemilih jabatan target sumber tidak ada')
    const sumber = await pilih.inputValue()
    tegaskan(sumber !== '' && sumber !== String(idDraft), `sumber tidak sah: "${sumber}"`)

    await pageAt.locator('button', { hasText: /^Salin rubrik$/ }).first().click()
    const jml = await tungguDb(
      async (c) => {
        const [r] = await c.query(
          `SELECT COUNT(*) AS n FROM rubrik_komponen WHERE jabatan_target_id = ?`,
          [idDraft],
        )
        return Number(r[0].n) > 0 ? Number(r[0].n) : null
      },
      'rubrik tidak pernah tersalin ke draft',
    )
    return `${jml} komponen tersalin dari jabatan target #${sumber}`
  })

  await langkah('Admin Talenta MENGAKTIFKAN draft usulan', async () => {
    await pageAt.goto(`${BASE}/jabatan-target/${idDraft}?tab=rubrik`, { waitUntil: 'networkidle' })
    const tombol = pageAt.locator('button', { hasText: /^Aktifkan$/ }).first()
    tegaskan((await tombol.count()) > 0, 'tombol Aktifkan tidak tersedia untuk Admin Talenta')
    await tombol.click()
    // Beberapa aksi status memakai dialog konfirmasi; tekan kalau muncul.
    const konfirmasi = pageAt.locator('dialog button, [role="dialog"] button').filter({
      hasText: /^Aktifkan$/,
    })
    if ((await konfirmasi.count()) > 0) await konfirmasi.last().click()

    const status = await tungguDb(
      async (c) => {
        const [r] = await c.query('SELECT status FROM jabatan_target WHERE id = ?', [idDraft])
        return r[0]?.status === 'AKTIF' ? 'AKTIF' : null
      },
      'status tidak pernah menjadi AKTIF',
    )
    await pageAt.screenshot({ path: `${OUT}/usulan-aktif-at.png`, fullPage: true })
    return `status ${status}`
  })

  // -------------------------------------------------------------------------
  // 6. Serah-terima balik ke pengusul
  // -------------------------------------------------------------------------
  await langkah('pengusul menerima notifikasi "Jabatan target aktif"', async () => {
    const baris = await tungguDb(
      async (c) => {
        const [r] = await c.query(
          `SELECT n.id, u.username FROM notifikasi n JOIN users u ON u.id = n.user_id
            WHERE n.jenis = 'TARGET_DIAKTIFKAN' AND n.entitas_id = ?`,
          [idDraft],
        )
        return r.length > 0 ? r : null
      },
      'notifikasi TARGET_DIAKTIFKAN tidak pernah dikirim ke pengusulnya',
    )
    tegaskan(
      baris.some((b) => b.username === PENGUSUL),
      `notifikasi terkirim ke ${baris.map((b) => b.username).join(', ')} — bukan ke pengusulnya`,
    )

    await pageUnit.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' })
    const teks = await pageUnit.locator('body').innerText()
    await pageUnit.screenshot({ path: `${OUT}/usulan-inbox-unit.png`, fullPage: true })
    tegaskan(
      teks.includes('Jabatan target aktif'),
      'Inbox pengusul tidak memuat label "Jabatan target aktif"',
    )
    return `terkirim ke ${PENGUSUL} · label tampil di Inbox`
  })

  // -------------------------------------------------------------------------
  // 7. Bersihkan
  // -------------------------------------------------------------------------
  await langkah('bersihkan draft uji beserta notifikasinya', async () => {
    const sisa = await denganDb(async (c) => {
      await c.query(`DELETE FROM notifikasi WHERE entitas='jabatan_target' AND entitas_id=?`, [
        idDraft,
      ])
      await c.query('DELETE FROM jabatan_target WHERE id = ?', [idDraft])
      const [t] = await c.query('SELECT COUNT(*) AS n FROM jabatan_target WHERE id = ?', [idDraft])
      const [a] = await c.query(
        'SELECT COUNT(*) AS n FROM jabatan_target_anggota WHERE jabatan_target_id = ?',
        [idDraft],
      )
      return { target: Number(t[0].n), anggota: Number(a[0].n) }
    })
    tegaskan(sisa.target === 0, 'jabatan target uji masih ada')
    tegaskan(sisa.anggota === 0, 'anggota jabatan target uji masih ada (cascade tidak jalan)')
    return `#${idDraft} dihapus · anggota & notifikasinya ikut bersih`
  })
} finally {
  await browser.close()
}

console.log('\n=== SMOKE TEST ALUR USULAN JABATAN TARGET (lintas peran) ===')
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
