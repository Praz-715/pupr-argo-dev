import { chromium } from '@playwright/test'
import { AKUN, konteksMasuk } from './_masuk.mjs'
import { readFileSync } from 'node:fs'

/**
 * Smoke test Fase 6 — Talent Pool & Workflow Nominasi.
 *
 * Yang diuji bukan "halaman muncul", tapi hal-hal yang kalau salah tidak
 * menimbulkan galat apa pun — hanya keadaan yang saling bertentangan:
 *
 *   - satu keputusan memindahkan DUA status sekaligus (kandidat & nominasi);
 *   - wewenang ditegakkan di server: Pengelola Unit tidak bisa memverifikasi
 *     nominasinya sendiri, Admin Talenta tidak bisa menetapkan suksesor;
 *   - langkah tidak bisa dilompati;
 *   - catatan wajib pada keputusan yang mengubah peringkat orang;
 *   - notifikasi sampai ke giliran BERIKUTNYA, bukan ke yang baru bertindak;
 *   - tugas (keadaan workflow) dan notifikasi (kabar) dipisah di Inbox;
 *   - timeline menampilkan tahap yang BELUM dijalani.
 *
 * Uji ini menjalankan perjalanan penuh KANDIDAT → DITETAPKAN lewat UI dengan
 * BERGANTI PERAN di tengah jalan, lalu mengembalikan keadaan seperti semula.
 * Pembersihannya menyentuh DB langsung karena sisa baris `nominasi`/`approval_log`
 * tidak bisa dihapus dari UI mana pun — dan uji yang meninggalkan sisa akan
 * menggeser angka baseline setiap kali dijalankan.
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-6.smoke.mjs [folder-screenshot] [base-url]
 */

const BASE = process.argv[3] ?? 'http://localhost:3000'
const OUT = process.argv[2] ?? '.'

/**
 * Akun seed per peran. Sejak Fase 7 uji ini **benar-benar masuk** sebagai
 * masing-masing orang — dulu cukup menyetel cookie `simt_dev_user`. Bedanya
 * penting: penegakan wewenang yang diuji di bawah kini berjalan di atas sesi
 * asli, bukan di atas identitas yang bisa dipalsukan dari sisi klien.
 */
const USER = {
  superAdmin: AKUN.superAdmin,
  adminTalenta: AKUN.adminTalenta,
  pengelolaUnit: AKUN.pengelolaUnit,
  pimpinan: AKUN.pimpinan,
  viewer: AKUN.viewer,
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
  ['/talent-pool', 'Talent Pool'],
  ['/nominasi', 'Nominasi'],
  ['/rencana-pengembangan', 'Rencana Suksesi & Pengembangan'],
  ['/inbox', 'Inbox Tugas'],
]

// ---------------------------------------------------------------------------
// Akses DB hanya untuk pembersihan (lihat alasan di kepala berkas)
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

/** Kembalikan satu entri pool ke keadaan KANDIDAT tanpa sisa nominasi. */
async function bersihkan(talentPoolId) {
  return denganDb(async (c) => {
    const [nominasi] = await c.query('SELECT id FROM nominasi WHERE talent_pool_id = ?', [
      talentPoolId,
    ])
    for (const n of nominasi) {
      await c.query('DELETE FROM approval_log WHERE nominasi_id = ?', [n.id])
      await c.query("DELETE FROM notifikasi WHERE entitas = 'nominasi' AND entitas_id = ?", [n.id])
    }
    await c.query('DELETE FROM nominasi WHERE talent_pool_id = ?', [talentPoolId])
    await c.query('DELETE FROM rencana_pengembangan WHERE talent_pool_id = ?', [talentPoolId])
    await c.query("DELETE FROM notifikasi WHERE entitas = 'talent_pool' AND entitas_id = ?", [
      talentPoolId,
    ])
    await c.query(
      "UPDATE talent_pool SET status = 'KANDIDAT', catatan_reviewer = NULL, ditetapkan_pada = NULL, ditetapkan_oleh = NULL WHERE id = ?",
      [talentPoolId],
    )
    return nominasi.length
  })
}

async function pilihKandidatUji() {
  return denganDb(async (c) => {
    const [baris] = await c.query(
      `SELECT tp.id, tp.jabatan_target_id, p.nama_lengkap AS nama, p.nip
       FROM talent_pool tp JOIN pegawai p ON p.id = tp.pegawai_id
       LEFT JOIN nominasi n ON n.talent_pool_id = tp.id
       WHERE tp.status = 'KANDIDAT' AND n.id IS NULL
       ORDER BY tp.jabatan_target_id, tp.ranking DESC LIMIT 1`,
    )
    return baris[0] ?? null
  })
}

const browser = await chromium.launch()

/** Konteks browser yang sudah masuk sebagai akun tertentu. */
async function konteksSebagai(akun, opsi = {}) {
  const ctx = await konteksMasuk(browser, {
    base: BASE,
    akun,
    viewport: { width: 1600, height: 1100 },
    ...opsi,
  })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`)
  })
  return { ctx, page }
}

/** Tunggu teks muncul — halaman dirender streaming, jadi jangan baca terlalu cepat. */
async function tungguTeks(page, teks, timeout = 20000) {
  await page.waitForFunction(
    (t) => document.body.innerText.includes(t),
    teks,
    { timeout },
  )
}

/**
 * Jalankan satu aksi workflow sampai mutasinya BENAR-BENAR selesai.
 *
 * **Kenapa helper ini ada.** Versi sebelumnya menekan tombol lalu menunggu
 * sebuah kata muncul — dan kata itu ternyata sudah ada di kalimat akibat pada
 * dialog yang baru saja terbuka ("Kandidat menjadi *Diverifikasi* dan
 * diteruskan ke Persetujuan Pimpinan"). Penantiannya lolos seketika, uji
 * melanjutkan ke `ctx.close()`, dan **konteks yang ditutup membatalkan POST
 * server action yang masih terbang**. Hasilnya: langkahnya HIJAU, mutasinya
 * tidak pernah terjadi, dan langkah berikutnya gagal di tempat yang tidak ada
 * hubungannya. Dua kali kami mengejar sebabnya ke tempat yang salah.
 *
 * Penanda yang dipakai sekarang adalah **tertutupnya dialog**: `onTutup()`
 * hanya dipanggil pada cabang berhasil, jadi dialog yang menutup berarti
 * server sudah membalas ok — bukan berarti sebuah kata kebetulan terbaca.
 */
async function jalankanAksi(page, label, catatan) {
  await page.getByRole('button', { name: label }).first().click()
  await page.waitForSelector('dialog[open]', { state: 'visible', timeout: 10000 })
  if (catatan !== undefined) await page.locator('dialog[open] textarea').fill(catatan)
  await page.getByRole('button', { name: label }).last().click()
  await page.waitForSelector('dialog[open]', { state: 'hidden', timeout: 25000 })
}

const kandidat = await pilihKandidatUji()

/**
 * Prasyarat yang hilang harus DILAPORKAN, bukan meruntuhkan harness.
 *
 * Seluruh bagian "perjalanan penuh lintas peran" butuh satu entri `talent_pool`
 * berstatus KANDIDAT tanpa nominasi. Ketika 10 pegawai eNominasi dikeluarkan
 * (24 Agu 2026), `talent_pool` jadi KOSONG — dan fase ini mati dengan
 * `TypeError: Cannot read properties of null (reading 'nama')` **tanpa satu pun
 * baris ringkasan**, sebab `kandidat.nama` dipakai di LABEL langkah, yang
 * dievaluasi sebelum `langkah()` dipanggil sehingga tidak tertangkap try/catch-nya.
 *
 * Uji yang runtuh tanpa laporan lebih buruk daripada uji yang gagal: yang gagal
 * memberi tahu apa yang kurang, yang runtuh hanya memberi jejak tumpukan yang
 * tidak menyebut sebabnya. `NAMA_KANDIDAT` menjaga label tetap bisa dirender, dan
 * `butuhKandidat()` membuat tiap langkah yang bergantung padanya gagal dengan
 * alasan yang bisa ditindak.
 */
const NAMA_KANDIDAT = kandidat?.nama ?? '(tidak ada kandidat di talent pool)'
function butuhKandidat() {
  tegaskan(
    kandidat !== null,
    'PRASYARAT TIDAK ADA: butuh satu entri talent_pool berstatus KANDIDAT tanpa nominasi. ' +
      'Talent pool sedang kosong — isi dulu dari halaman Kandidat (Tambah ke talent pool), ' +
      'atau pulihkan data demo dari doc/sql/cadangan-sebelum-hapus-enom-24agu.sql.',
  )
}

try {
  // -------------------------------------------------------------------------
  // 0. Bersihkan sisa uji sebelumnya (idempoten)
  // -------------------------------------------------------------------------
  await langkah('bersihkan sisa uji sebelumnya', async () => {
    tegaskan(kandidat !== null, 'tidak ada kandidat berstatus KANDIDAT tanpa nominasi untuk diuji')
    const dihapus = await bersihkan(kandidat.id)
    return `entri pool ${kandidat.id} (${kandidat.nama}) siap · ${dihapus} nominasi sisa dihapus`
  })

  // -------------------------------------------------------------------------
  // 1. Rute dasar di kedua tema
  // -------------------------------------------------------------------------
  for (const tema of ['light', 'dark']) {
    const { ctx, page } = await konteksSebagai(USER.superAdmin, { colorScheme: tema })
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
      await page.goto(`${BASE}/talent-pool`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f6-talent-pool.png`, fullPage: true })
      await page.goto(`${BASE}/nominasi/1`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f6-timeline.png`, fullPage: true })
    } else {
      await page.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' })
      await page.screenshot({ path: `${OUT}/f6-inbox-dark.png`, fullPage: true })
    }
    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 2. Halaman Talent Pool: penyebut lintas jabatan target & kolom K-4
  // -------------------------------------------------------------------------
  {
    const { ctx, page } = await konteksSebagai(USER.adminTalenta)

    await langkah('menu Fase 6 aktif (Talent Pool · Nominasi · Inbox)', async () => {
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
      for (const href of ['/talent-pool', '/nominasi', '/inbox']) {
        tegaskan(
          (await page.locator(`nav a[href="${href}"]`).count()) > 0,
          `tautan nav ${href} tidak ada`,
        )
      }
      return '3 tautan nav Fase 6 tersedia'
    })

    await langkah('angka per jabatan target diberi penyebut lintas target', async () => {
      await page.goto(`${BASE}/talent-pool`, { waitUntil: 'networkidle' })
      await tungguTeks(page, 'kandidat menunggu tindakan')
      const teks = await page.locator('body').innerText()
      tegaskan(
        /Di seluruh \d+ jabatan target: \d+ kandidat menunggu tindakan/.test(teks),
        'tidak ada penyebut lintas jabatan target',
      )
      tegaskan(
        teks.includes('hanya untuk jabatan target yang sedang dipilih'),
        'tidak dijelaskan bahwa kartu di bawah hanya untuk target terpilih',
      )
      return teks.match(/Di seluruh \d+ jabatan target: \d+ kandidat menunggu tindakan/)?.[0] ?? ''
    })

    await langkah('K-4: Kotak 9 & predikat kinerja SEBELUM match score', async () => {
      // Penjaga "tabel sudah termuat" menyebut KOLOM yang diperiksa, bukan
      // jumlahnya. Versi lama menunggu `th.length >= 8`; begitu kolom peringkat
      // "#" dilepas (jumlahnya jadi 7) penantian itu tidak pernah terpenuhi dan
      // gagal sebagai timeout 20 detik — seolah tabelnya tidak pernah muncul,
      // padahal cuma satu kolom lebih sedikit. Angka ajaib begitu akan patah
      // lagi setiap kali kolom ditambah atau dikurangi.
      const pegangan = await page.waitForFunction(
        () => {
          const th = [...document.querySelectorAll('thead th')].map((e) => e.textContent ?? '')
          const ada = (n) => th.some((h) => h.includes(n))
          return ada('Kotak 9') && ada('Predikat') && ada('Match score') && ada('Giliran')
            ? th
            : false
        },
        undefined,
        { timeout: 20000 },
      )
      const header = await pegangan.jsonValue()
      const iKotak = header.findIndex((h) => h.includes('Kotak 9'))
      const iPredikat = header.findIndex((h) => h.includes('Predikat'))
      const iSkor = header.findIndex((h) => h.includes('Match score'))
      const iGiliran = header.findIndex((h) => h.includes('Giliran'))
      tegaskan(iKotak >= 0 && iPredikat >= 0 && iSkor >= 0, `kolom kurang: ${header.join(' | ')}`)
      tegaskan(iKotak < iSkor && iPredikat < iSkor, 'konteks kinerja tidak mendahului match score')
      tegaskan(iGiliran >= 0, 'kolom Giliran tidak ada')
      return `Kotak 9 ${iKotak} · Predikat ${iPredikat} · Match score ${iSkor} · Giliran ${iGiliran}`
    })

    await langkah('tidak ada entri berstatus mustahil di data dev', async () => {
      const teks = await page.locator('body').innerText()
      tegaskan(
        !teks.includes('entri berstatus tidak mungkin'),
        'ada pasangan status pool × nominasi yang mustahil',
      )
      return 'pasangan status konsisten'
    })

    await ctx.close()
  }

  // -------------------------------------------------------------------------
  // 3. Wewenang ditegakkan di SERVER, bukan cuma disembunyikan
  // -------------------------------------------------------------------------
  await langkah('Admin Talenta TIDAK punya tombol "Tetapkan sebagai suksesor"', async () => {
    const { ctx, page } = await konteksSebagai(USER.adminTalenta)
    await page.goto(`${BASE}/talent-pool?target=1`, { waitUntil: 'networkidle' })
    await tungguTeks(page, 'kandidat menunggu tindakan')
    const teks = await page.locator('body').innerText()
    // Ada kandidat DIVERIFIKASI di target 1; yang boleh menetapkan hanya Pimpinan.
    tegaskan(teks.includes('Diverifikasi'), 'tidak ada kandidat Diverifikasi untuk diuji')
    tegaskan(
      !teks.includes('Tetapkan sebagai suksesor'),
      'Admin Talenta melihat tombol penetapan padahal itu wewenang Pimpinan',
    )
    await ctx.close()
    return 'tombol penetapan tidak tampil untuk Admin Talenta'
  })

  await langkah('tombol penetapan mengikuti STATUS entri, bukan sekadar peran', async () => {
    /*
      Versi lama langkah ini menembak `?target=1` lalu menunggu teks "Tetapkan
      sebagai suksesor" — benar selama data demo memuat satu entri DIVERIFIKASI di
      target 1. Sejak 10 pegawai eNominasi dikeluarkan (24 Agu 2026), seluruh isi
      pool berstatus KANDIDAT, jadi langkah itu menunggu 20 detik lalu gagal atas
      sesuatu yang memang TIDAK BOLEH ada — tombol penetapan pada entri yang belum
      diverifikasi.

      Sekarang subjeknya diambil dari DB, dan yang diuji dua arah:
        - ada entri DIVERIFIKASI → tombolnya HARUS tampil untuk Pimpinan;
        - tidak ada             → tombolnya HARUS TIDAK tampil pada entri KANDIDAT.
      Arah kedua bukan pelarian dari uji: ia justru penjaga yang lebih ketat, sebab
      tombol penetapan yang muncul terlalu awal melompati verifikasi kepegawaian.
      Sisi positifnya tetap dijalani "perjalanan penuh lintas peran" di bawah, yang
      membuat entri DIVERIFIKASI-nya sendiri lalu menetapkannya sebagai suksesor.
    */
    const subjek = await denganDb(async (c) => {
      const [r] = await c.query(
        `SELECT tp.jabatan_target_id AS target, p.nama_lengkap AS nama, tp.status
           FROM talent_pool tp JOIN pegawai p ON p.id = tp.pegawai_id
          ORDER BY FIELD(tp.status,'DIVERIFIKASI','KANDIDAT','DITETAPKAN'), tp.id
          LIMIT 1`,
      )
      return r[0] ?? null
    })
    tegaskan(subjek !== null, 'talent pool kosong — tidak ada entri untuk diuji')

    const { ctx, page } = await konteksSebagai(USER.pimpinan)
    await page.goto(`${BASE}/talent-pool?target=${subjek.target}`, { waitUntil: 'networkidle' })
    await tungguTeks(page, subjek.nama)
    const baris = await page.locator('tr', { hasText: subjek.nama }).first().innerText()
    await ctx.close()

    const adaTombol = baris.includes('Tetapkan sebagai suksesor')
    if (subjek.status === 'DIVERIFIKASI') {
      tegaskan(adaTombol, `entri DIVERIFIKASI ${subjek.nama} tanpa tombol penetapan`)
      return `entri DIVERIFIKASI → tombol penetapan tampil untuk Pimpinan`
    }
    tegaskan(
      !adaTombol,
      `entri berstatus ${subjek.status} sudah menawarkan penetapan — melompati verifikasi`,
    )
    return `entri ${subjek.status} → penetapan belum ditawarkan (benar); sisi positifnya diuji perjalanan penuh di bawah`
  })

  await langkah('Viewer tidak punya aksi apa pun', async () => {
    const { ctx, page } = await konteksSebagai(USER.viewer)
    await page.goto(`${BASE}/talent-pool?target=1`, { waitUntil: 'networkidle' })
    await tungguTeks(page, 'kandidat menunggu tindakan')
    const teks = await page.locator('body').innerText()
    for (const label of ['Ajukan nominasi', 'Setujui verifikasi', 'Tetapkan sebagai suksesor']) {
      tegaskan(!teks.includes(label), `Viewer melihat tombol "${label}"`)
    }
    await ctx.close()
    return 'tanpa tombol aksi'
  })

  // -------------------------------------------------------------------------
  // 4. Perjalanan penuh lintas peran
  // -------------------------------------------------------------------------
  let nominasiUrl = null

  await langkah(`Pengelola Unit mengajukan nominasi ${NAMA_KANDIDAT}`, async () => {
    butuhKandidat()
    const { ctx, page } = await konteksSebagai(USER.pengelolaUnit)
    await page.goto(`${BASE}/talent-pool?target=${kandidat.jabatan_target_id}`, {
      waitUntil: 'networkidle',
    })
    await tungguTeks(page, kandidat.nama)

    const baris = page.locator('tr', { hasText: kandidat.nama })
    await baris.getByRole('button', { name: 'Ajukan nominasi' }).click()
    await page.waitForSelector('dialog[open]', { state: 'visible', timeout: 10000 })

    // Catatan wajib: coba simpan tanpa catatan lebih dulu.
    await page.getByRole('button', { name: 'Ajukan nominasi' }).last().click()
    await page.waitForTimeout(1200)
    const galat = (await page.locator('[role="alert"]').allInnerTexts()).join(' ')
    tegaskan(
      galat.includes('perlu catatan') || galat.includes('ditelusuri'),
      `catatan wajib tidak ditegakkan: "${galat}"`,
    )

    await page
      .locator('dialog[open] textarea')
      .fill('Kandidat diusulkan unit; dokumen pendukung lengkap. (uji smoke Fase 6)')
    await page.getByRole('button', { name: 'Ajukan nominasi' }).last().click()
    // Dialog menutup hanya kalau server membalas ok. Menunggu kata
    // "Dinominasikan" TIDAK sah: itu salah satu label penyaring status yang
    // memang selalu ada di halaman ini.
    await page.waitForSelector('dialog[open]', { state: 'hidden', timeout: 25000 })
    await page.waitForFunction(
      (nama) => {
        const tr = [...document.querySelectorAll('tr')].find((r) => r.innerText.includes(nama))
        return tr !== undefined && !tr.innerText.includes('Ajukan nominasi')
      },
      kandidat.nama,
      { timeout: 25000 },
    )
    await ctx.close()
    return 'nominasi diajukan; catatan wajib ditegakkan lebih dulu'
  })

  await langkah('notifikasi sampai ke ADMIN TALENTA (giliran berikutnya)', async () => {
    const { ctx, page } = await konteksSebagai(USER.adminTalenta)
    await page.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' })
    await tungguTeks(page, kandidat.nama, 25000)
    const teks = await page.locator('body').innerText()
    tegaskan(teks.includes('Nominasi masuk'), 'notifikasi jenis "Nominasi masuk" tidak ada')
    tegaskan(
      teks.includes('Menunggu Verifikasi Kepegawaian'),
      'tugas tidak menyebut tahap yang menunggu',
    )
    await ctx.close()
    return 'notifikasi & tugas muncul di inbox Admin Talenta'
  })

  await langkah('tugas dan notifikasi DIPISAH di inbox', async () => {
    const { ctx, page } = await konteksSebagai(USER.adminTalenta)
    await page.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' })
    await tungguTeks(page, 'Menunggu tindakan Anda')
    const teks = await page.locator('body').innerText()
    tegaskan(
      teks.includes('Menunggu tindakan Anda') && teks.includes('Notifikasi'),
      'dua panel tidak keduanya ada',
    )
    tegaskan(
      teks.includes('Menandai terbaca TIDAK menyelesaikan tugasnya'),
      'beda tugas vs notifikasi tidak dijelaskan',
    )
    await ctx.close()
    return 'dua panel terpisah dengan penjelasan bedanya'
  })

  await langkah('Pengelola Unit TIDAK bisa memverifikasi nominasinya sendiri', async () => {
    const { ctx, page } = await konteksSebagai(USER.pengelolaUnit)
    // `?tahap=`, bukan `?giliran=`: penyaringnya pindah ke kosakata tahap
    // (12 Agu 2026). Param lama masih dihormati halaman supaya bookmark tidak
    // mati, tapi uji harus menembak permukaan yang sekarang.
    await page.goto(`${BASE}/nominasi?tahap=VERIFIKASI`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const teks = await page.locator('body').innerText()
    tegaskan(
      !teks.includes('Setujui verifikasi'),
      'Pengelola Unit melihat tombol verifikasi',
    )
    await ctx.close()
    return 'tanpa tombol verifikasi'
  })

  await langkah('Admin Talenta menyetujui verifikasi', async () => {
    const { ctx, page } = await konteksSebagai(USER.adminTalenta)
    await page.goto(`${BASE}/nominasi`, { waitUntil: 'networkidle' })
    await tungguTeks(page, kandidat.nama, 25000)
    await page.locator('tr', { hasText: kandidat.nama }).locator('a').first().click()
    await page.waitForURL(/\/nominasi\/\d+$/, { timeout: 15000 })
    nominasiUrl = page.url()

    await tungguTeks(page, 'Timeline persetujuan')
    const sebelum = await page.locator('body').innerText()
    tegaskan(
      sebelum.includes('Belum dijalani'),
      'timeline tidak menampilkan tahap yang belum dijalani',
    )
    tegaskan(
      sebelum.includes('Persetujuan Pimpinan'),
      'tahap Persetujuan Pimpinan tidak ditampilkan',
    )

    // Menunggu kata "Diverifikasi" TIDAK sah: kalimat akibat di dialog memuatnya,
    // jadi penantiannya lolos sebelum aksinya jalan — lalu ctx.close() membunuh
    // POST-nya. Lihat catatan pada jalankanAksi().
    await jalankanAksi(page, 'Setujui verifikasi')
    await tungguTeks(page, 'Persetujuan Pimpinan', 25000)
    await ctx.close()
    return 'nominasi lolos verifikasi; timeline memuat tahap yang belum dijalani'
  })

  await langkah('notifikasi berpindah ke PIMPINAN, bukan tetap di Admin Talenta', async () => {
    const { ctx, page } = await konteksSebagai(USER.pimpinan)
    await page.goto(`${BASE}/inbox`, { waitUntil: 'networkidle' })
    await tungguTeks(page, kandidat.nama, 25000)
    const teks = await page.locator('body').innerText()
    tegaskan(
      teks.includes('Menunggu penetapan') || teks.includes('Menunggu penetapan sebagai suksesor'),
      'Pimpinan tidak mendapat kabar/tugas penetapan',
    )
    await ctx.close()
    return 'giliran & kabar pindah ke Pimpinan'
  })

  await langkah('Pimpinan menetapkan sebagai suksesor', async () => {
    const { ctx, page } = await konteksSebagai(USER.pimpinan)
    await page.goto(nominasiUrl, { waitUntil: 'networkidle' })
    await tungguTeks(page, 'Tetapkan sebagai suksesor')
    // Penanda keadaan baru: munculnya aksi yang HANYA ada di status DITETAPKAN.
    await jalankanAksi(page, 'Tetapkan sebagai suksesor')
    await tungguTeks(page, 'Batalkan penetapan', 25000)
    const teks = await page.locator('body').innerText()
    tegaskan(
      teks.includes('Tidak menunggu siapa pun') || teks.includes('sudah selesai'),
      'alur tidak dinyatakan selesai setelah penetapan',
    )
    await ctx.close()
    return 'kandidat ditetapkan; alur dinyatakan selesai'
  })

  // -------------------------------------------------------------------------
  // 5. Rencana pengembangan hanya untuk yang DITETAPKAN
  // -------------------------------------------------------------------------
  await langkah('suksesor baru muncul di Rencana Pengembangan', async () => {
    const { ctx, page } = await konteksSebagai(USER.adminTalenta)
    await page.goto(`${BASE}/rencana-pengembangan`, { waitUntil: 'networkidle' })
    await tungguTeks(page, kandidat.nama, 25000)
    const teks = await page.locator('body').innerText()
    tegaskan(
      teks.includes('Belum ada rencana pengembangan'),
      'suksesor tanpa rencana tidak dijelaskan akibatnya',
    )
    await ctx.close()
    return 'suksesor tampil dengan penjelasan keadaan kosongnya'
  })

  await langkah('tambah rencana pengembangan & tolak deskripsi terlalu pendek', async () => {
    const { ctx, page } = await konteksSebagai(USER.adminTalenta)
    await page.goto(`${BASE}/rencana-pengembangan`, { waitUntil: 'networkidle' })
    await tungguTeks(page, kandidat.nama, 25000)

    const panel = page.locator('section', { hasText: kandidat.nama }).first()
    await panel.getByRole('button', { name: 'Tambah rencana' }).click()
    await page.waitForSelector('dialog[open]', { state: 'visible', timeout: 10000 })

    await page.locator('textarea').fill('pendek')
    await page.getByRole('button', { name: 'Simpan' }).click()
    await page.waitForTimeout(1200)
    const galat = (await page.locator('[role="alert"]').allInnerTexts()).join(' ')
    tegaskan(galat.includes('minimal 10 karakter'), `validasi deskripsi tidak muncul: "${galat}"`)

    await page
      .locator('dialog[open] textarea')
      .fill('Diklat Kepemimpinan Nasional Tingkat II — uji smoke Fase 6')
    await page.getByRole('button', { name: 'Simpan' }).click()
    // Menunggu kata "Diklat" TIDAK sah: itu salah satu label pilihan jenis
    // pengembangan di dalam dialog yang masih terbuka.
    await page.waitForSelector('dialog[open]', { state: 'hidden', timeout: 25000 })
    await tungguTeks(page, 'Kepemimpinan Nasional Tingkat II', 25000)
    await ctx.close()
    return 'rencana tersimpan; deskripsi pendek ditolak per-field'
  })

  // -------------------------------------------------------------------------
  // 6. Pulangkan keadaan lewat UI (menguji tiga transisi balik)
  // -------------------------------------------------------------------------
  await langkah('Pimpinan membatalkan penetapan → kembali Diverifikasi', async () => {
    const { ctx, page } = await konteksSebagai(USER.pimpinan)
    await page.goto(nominasiUrl, { waitUntil: 'networkidle' })
    await tungguTeks(page, 'Batalkan penetapan')
    await jalankanAksi(page, 'Batalkan penetapan', 'Pembersihan uji smoke Fase 6.')
    await tungguTeks(page, 'Tetapkan sebagai suksesor', 25000)
    await ctx.close()
    return 'penetapan dibatalkan'
  })

  await langkah('rencana pengembangan TIDAK hilang setelah penetapan dibatalkan', async () => {
    const { ctx, page } = await konteksSebagai(USER.adminTalenta)
    await page.goto(`${BASE}/rencana-pengembangan`, { waitUntil: 'networkidle' })
    await tungguTeks(page, 'tidak lagi berstatus Ditetapkan', 25000)
    const teks = await page.locator('body').innerText()
    tegaskan(teks.includes(kandidat.nama), 'rencana milik kandidat itu hilang dari halaman')
    tegaskan(
      teks.includes('TIDAK dihapus') || teks.includes('riwayat pengembangan'),
      'tidak dijelaskan bahwa rencananya dipertahankan',
    )
    await ctx.close()
    return 'rencana tetap tampil di kelompok terpisah beserta penjelasannya'
  })

  await langkah('Pimpinan menolak di tahap pimpinan → Ditolak', async () => {
    const { ctx, page } = await konteksSebagai(USER.pimpinan)
    await page.goto(nominasiUrl, { waitUntil: 'networkidle' })
    await tungguTeks(page, 'Tolak di tahap pimpinan')
    await jalankanAksi(page, 'Tolak di tahap pimpinan', 'Pembersihan uji smoke Fase 6.')
    // Penanda keadaan baru: TOMBOL penolakan lenyap karena tidak ada lagi yang
    // bisa ditolak. Yang dicari harus tombolnya, bukan teksnya — timeline
    // mencatat keputusan itu dengan label yang sama persis, jadi kalimatnya
    // justru baru muncul setelah aksinya berhasil.
    await page
      .getByRole('button', { name: 'Tolak di tahap pimpinan' })
      .waitFor({ state: 'detached', timeout: 25000 })
    await ctx.close()
    return 'ditolak di tahap pimpinan'
  })

  await langkah('Admin Talenta memulihkan kandidat → kembali Kandidat', async () => {
    const { ctx, page } = await konteksSebagai(USER.adminTalenta)
    await page.goto(`${BASE}/talent-pool?target=${kandidat.jabatan_target_id}&status=DITOLAK`, {
      waitUntil: 'networkidle',
    })
    await tungguTeks(page, 'Pulihkan sebagai kandidat', 25000)
    await jalankanAksi(page, 'Pulihkan sebagai kandidat', 'Pembersihan uji smoke Fase 6.')
    await ctx.close()
    return 'kandidat dipulihkan'
  })

  await langkah('timeline memuat SELURUH riwayat, termasuk yang dibatalkan', async () => {
    const { ctx, page } = await konteksSebagai(USER.superAdmin)
    await page.goto(nominasiUrl, { waitUntil: 'networkidle' })
    await tungguTeks(page, 'Timeline persetujuan')
    const teks = await page.locator('body').innerText()
    for (const jejak of ['MENUNGGU', 'DISETUJUI', 'REVISI', 'DITOLAK']) {
      tegaskan(teks.includes(jejak), `jejak ${jejak} tidak tampil di timeline`)
    }
    await page.screenshot({ path: `${OUT}/f6-timeline-penuh.png`, fullPage: true })
    await ctx.close()
    return 'keempat jenis keputusan tampil sebagai jejak'
  })

  // -------------------------------------------------------------------------
  // 7. Bersihkan sisa & pastikan keadaan awal pulih
  // -------------------------------------------------------------------------
  await langkah('keadaan data dev pulih seperti sebelum uji', async () => {
    await bersihkan(kandidat.id)
    const sisa = await denganDb(async (c) => {
      const [pool] = await c.query('SELECT status FROM talent_pool WHERE id = ?', [kandidat.id])
      const [nominasi] = await c.query(
        'SELECT COUNT(*) AS n FROM nominasi WHERE talent_pool_id = ?',
        [kandidat.id],
      )
      const [rencana] = await c.query(
        'SELECT COUNT(*) AS n FROM rencana_pengembangan WHERE talent_pool_id = ?',
        [kandidat.id],
      )
      return {
        status: pool[0]?.status,
        nominasi: Number(nominasi[0].n),
        rencana: Number(rencana[0].n),
      }
    })
    tegaskan(sisa.status === 'KANDIDAT', `status pool ${sisa.status}, seharusnya KANDIDAT`)
    tegaskan(sisa.nominasi === 0, `${sisa.nominasi} nominasi sisa`)
    tegaskan(sisa.rencana === 0, `${sisa.rencana} rencana sisa`)
    return 'status KANDIDAT · tanpa sisa nominasi & rencana'
  })

  // -------------------------------------------------------------------------
  // 8. Lebar sempit
  // -------------------------------------------------------------------------
  for (const [nama, lebar] of [
    ['tablet 834px', 834],
    ['tablet sempit 768px', 768],
  ]) {
    const { ctx, page } = await konteksSebagai(USER.superAdmin, {
      viewport: { width: lebar, height: 1180 },
    })
    for (const rute of ['/talent-pool', '/nominasi', '/inbox', '/rencana-pengembangan']) {
      await page.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(700)
      await langkah(`${nama}: ${rute} tanpa scroll horizontal halaman`, async () => {
        const selisih = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        tegaskan(selisih <= 0, `menggulir horizontal ${selisih}px`)
        return 'selisih 0px'
      })
    }
    if (lebar === 834) await page.screenshot({ path: `${OUT}/f6-tablet.png`, fullPage: true })
    await ctx.close()
  }
} finally {
  await browser.close()
}

console.log('\n=== SMOKE TEST FASE 6 — TALENT POOL & WORKFLOW NOMINASI ===')
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
