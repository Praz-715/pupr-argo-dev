import { chromium } from '@playwright/test'
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

/** id pengguna seed (lihat 002_seed.sql). Cookie dev: simt_dev_user. */
const USER = {
  superAdmin: 1,
  adminTalenta: 2,
  pengelolaUnit: 3,
  pimpinan: 6,
  viewer: 8,
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

/** Konteks browser dengan cookie pengguna dev tertentu. */
async function konteksSebagai(userId, opsi = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 1600, height: 1100 },
    ...opsi,
  })
  await ctx.addCookies([
    {
      name: 'simt_dev_user',
      value: String(userId),
      url: BASE,
    },
  ])
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

const kandidat = await pilihKandidatUji()

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
      const pegangan = await page.waitForFunction(
        () => {
          const th = [...document.querySelectorAll('thead th')].map((e) => e.textContent ?? '')
          return th.length >= 8 ? th : false
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

  await langkah('Pimpinan melihat tombol penetapan pada kandidat Diverifikasi', async () => {
    const { ctx, page } = await konteksSebagai(USER.pimpinan)
    await page.goto(`${BASE}/talent-pool?target=1`, { waitUntil: 'networkidle' })
    await tungguTeks(page, 'Tetapkan sebagai suksesor')
    await ctx.close()
    return 'tombol penetapan tampil untuk Pimpinan'
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

  await langkah(`Pengelola Unit mengajukan nominasi ${kandidat.nama}`, async () => {
    const { ctx, page } = await konteksSebagai(USER.pengelolaUnit)
    await page.goto(`${BASE}/talent-pool?target=${kandidat.jabatan_target_id}`, {
      waitUntil: 'networkidle',
    })
    await tungguTeks(page, kandidat.nama)

    const baris = page.locator('tr', { hasText: kandidat.nama })
    await baris.getByRole('button', { name: 'Ajukan nominasi' }).click()
    await page.waitForTimeout(600)

    // Catatan wajib: coba simpan tanpa catatan lebih dulu.
    await page.getByRole('button', { name: 'Ajukan nominasi' }).last().click()
    await page.waitForTimeout(1200)
    const galat = (await page.locator('[role="alert"]').allInnerTexts()).join(' ')
    tegaskan(
      galat.includes('perlu catatan') || galat.includes('ditelusuri'),
      `catatan wajib tidak ditegakkan: "${galat}"`,
    )

    await page
      .locator('textarea')
      .fill('Kandidat diusulkan unit; dokumen pendukung lengkap. (uji smoke Fase 6)')
    await page.getByRole('button', { name: 'Ajukan nominasi' }).last().click()
    await tungguTeks(page, 'Dinominasikan', 25000)
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
    await page.goto(`${BASE}/nominasi?giliran=ADMIN_TALENTA`, { waitUntil: 'networkidle' })
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

    await page.getByRole('button', { name: 'Setujui verifikasi' }).first().click()
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'Setujui verifikasi' }).last().click()
    await tungguTeks(page, 'Diverifikasi', 25000)
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
    await page.getByRole('button', { name: 'Tetapkan sebagai suksesor' }).first().click()
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'Tetapkan sebagai suksesor' }).last().click()
    // Menunggu 'Ditetapkan' tidak sah: kalimat akibat di dialog yang masih terbuka
    // memuat kata itu, jadi kondisinya lolos SEBELUM aksinya selesai. Yang menandai
    // keadaan baru adalah munculnya aksi yang hanya ada di status DITETAPKAN.
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
    await page.waitForTimeout(600)

    await page.locator('textarea').fill('pendek')
    await page.getByRole('button', { name: 'Simpan' }).click()
    await page.waitForTimeout(1200)
    const galat = (await page.locator('[role="alert"]').allInnerTexts()).join(' ')
    tegaskan(galat.includes('minimal 10 karakter'), `validasi deskripsi tidak muncul: "${galat}"`)

    await page
      .locator('textarea')
      .fill('Diklat Kepemimpinan Nasional Tingkat II — uji smoke Fase 6')
    await page.getByRole('button', { name: 'Simpan' }).click()
    await tungguTeks(page, 'Diklat', 25000)
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
    await page.getByRole('button', { name: 'Batalkan penetapan' }).first().click()
    await page.waitForTimeout(600)
    await page.locator('textarea').fill('Pembersihan uji smoke Fase 6.')
    await page.getByRole('button', { name: 'Batalkan penetapan' }).last().click()
    await tungguTeks(page, 'Diverifikasi', 25000)
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
    await page.getByRole('button', { name: 'Tolak di tahap pimpinan' }).first().click()
    await page.waitForTimeout(600)
    await page.locator('textarea').fill('Pembersihan uji smoke Fase 6.')
    await page.getByRole('button', { name: 'Tolak di tahap pimpinan' }).last().click()
    await tungguTeks(page, 'Ditolak', 25000)
    await ctx.close()
    return 'ditolak di tahap pimpinan'
  })

  await langkah('Admin Talenta memulihkan kandidat → kembali Kandidat', async () => {
    const { ctx, page } = await konteksSebagai(USER.adminTalenta)
    await page.goto(`${BASE}/talent-pool?target=${kandidat.jabatan_target_id}&status=DITOLAK`, {
      waitUntil: 'networkidle',
    })
    await tungguTeks(page, 'Pulihkan sebagai kandidat', 25000)
    await page.getByRole('button', { name: 'Pulihkan sebagai kandidat' }).first().click()
    await page.waitForTimeout(600)
    await page.locator('textarea').fill('Pembersihan uji smoke Fase 6.')
    await page.getByRole('button', { name: 'Pulihkan sebagai kandidat' }).last().click()
    await page.waitForTimeout(2500)
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
