/**
 * Smoke: setiap penyuntingan manual di halaman PROFIL sampai ke DB **dan** ke
 * perhitungan — bukan cuma ke tampilan.
 *
 * Permintaan pemilik proses 1 Sep 2026: *"pastiin di profil pegawai semua butir
 * revisi udah bisa sinkron ya termasuk saat ubah data manual di profil pegawai"*
 * dan *"pastiin tiap ada write juga pengaruh ke db dan ke perhitungan jangan cuma
 * di ui aja"*.
 *
 * ## Yang diuji, dan kenapa dua-duanya perlu
 *
 * Tiap langkah memeriksa TIGA hal berturut-turut:
 *   1. **kolomnya benar-benar berubah di DB** — bukti write-nya bukan cuma state
 *      di browser;
 *   2. **`match_score.computed_at` MAJU** — bukti perhitungannya ikut berjalan.
 *      Ini penanda yang berlaku untuk semua jalur tanpa harus menebak arah
 *      pergerakan angkanya, dan ia tidak bisa dipalsukan oleh render ulang;
 *   3. **keadaannya dipulihkan**, lalu dibandingkan lagi dengan potret awal.
 *
 * Memeriksa (1) saja melewatkan cacat yang justru paling mahal di sini: data
 * tersimpan sementara `match_score` — kolom TERSIMPAN — tetap memakai nilai lama,
 * sehingga satu halaman memajang dua angka yang bertentangan tanpa satu pun galat.
 * Terukur sebelum perbaikan 1 Sep 2026: 6 dari 7 jalur tulis profil begitu.
 *
 * ## Subjeknya DITURUNKAN dari data, tidak dipaku
 *
 * Konstanta data di harness sudah enam kali meledak di repo ini setelah datanya
 * berubah dengan sengaja. Pegawainya dipilih dari DB: yang punya baris
 * `match_score` (jadi ada yang bisa dihitung ulang) dan punya asesmen.
 *
 * Jalankan dengan server hidup:
 *   node e2e/sinkron-profil.smoke.mjs [folder-screenshot] [base-url]
 */

import { chromium } from '@playwright/test'
import { readFileSync } from 'node:fs'
import mysql from 'mysql2/promise'

import { konteksMasuk } from './_masuk.mjs'

const BASE = process.argv[3] ?? 'http://localhost:3000'

const hasil = []
const errors = []
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

async function db(sql, params = []) {
  const c = await mysql.createConnection(bacaEnv())
  try {
    const [r] = await c.query(sql, params)
    return r
  } finally {
    await c.end()
  }
}

/**
 * Potret perhitungan seorang pegawai.
 *
 * ⚠️ Yang dipakai menandai "hitung ulang SELESAI" adalah **`MIN(computed_at)`**,
 * bukan MAX — dan bedanya menggigit. `hitungUlangSatuPegawai()` menulis jabatan
 * target satu per satu, jadi MAX sudah maju begitu target PERTAMA selesai
 * sementara 12 lainnya masih memegang nilai lama. Versi pertama uji ini memakai
 * MAX, membaca kelayakan di tengah jalan (12 dari 13 baris belum diperbarui), lalu
 * melaporkan "kelayakan tidak turun" atas perhitungan yang sebenarnya berjalan
 * benar — dan sekali lolos secara kebetulan pada jalan sebelumnya, yang jauh lebih
 * berbahaya daripada merah.
 */
async function potretSkor(pegawaiId) {
  const r = await db(
    `SELECT COUNT(*) AS baris,
            MIN(computed_at) AS terlama,
            MAX(computed_at) AS terakhir,
            SUM(eligible = 1) AS lolos,
            ROUND(AVG(skor_total), 4) AS rata
       FROM match_score WHERE pegawai_id = ?`,
    [pegawaiId],
  )
  const ms = (v) => (v === null ? null : new Date(v).getTime())
  return {
    baris: Number(r[0].baris),
    terlama: ms(r[0].terlama),
    terakhir: ms(r[0].terakhir),
    lolos: Number(r[0].lolos ?? 0),
    rata: r[0].rata === null ? null : Number(r[0].rata),
  }
}

/** Seluruh baris skor pegawai ini sudah ditulis ulang sesudah `patokan`. */
function selesaiDihitung(potret, patokan) {
  return potret.terlama !== null && patokan !== null && potret.terlama > patokan
}

/**
 * Tunggu sampai DB memenuhi syarat, bukan sampai UI berubah bentuk.
 *
 * Tombol simpan memakai `labelPending`, jadi menunggu teks lamanya lenyap lolos
 * SEKETIKA — bukan karena pekerjaannya selesai, tapi karena indikator pending-nya
 * sendiri yang mengubahnya (varian jebakan #1 di CLAUDE.md).
 */
async function tungguDb(fn, pesan, batasMs = 25000) {
  const mulai = Date.now()
  for (;;) {
    const h = await fn()
    if (h !== null && h !== undefined && h !== false) return h
    if (Date.now() - mulai > batasMs) throw new Error(`${pesan} (menunggu ${batasMs} ms)`)
    await new Promise((r) => setTimeout(r, 300))
  }
}

/**
 * Buka ulang halaman profil sampai isinya benar-benar tergambar.
 *
 * Dipanggil SEBELUM tiap interaksi dialog, dan itu bukan kehati-hatian berlebih:
 * menyimpan lewat server action memicu `revalidatePath` + refresh router, dan
 * selama transisi itu tombolnya `disabled`. Mengkliknya saat itu membuat Playwright
 * menunggu sampai batas waktunya — gejalanya seluruh langkah HABIS WAKTU, bukan
 * gagal asersi, sehingga terbaca seperti halaman yang menggantung. Terukur: tanpa
 * ini, 2 dari 5 jalan berakhir begitu.
 */
async function bukaProfil(page, nip) {
  await page.goto(`${BASE}/talenta/${nip}`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(
    () => (document.querySelector('main')?.innerText ?? '').includes('Kelengkapan data'),
    null,
    { timeout: 45000 },
  )
  // Tabel asesmen & panel Kecocokan dialirkan lewat `<Suspense>`; tombol Ubah-nya
  // baru ada sesudah itu.
  await page.waitForSelector('main button:has-text("Ubah data")', { timeout: 45000 })
}

const browser = await chromium.launch()

try {
  const ctx = await konteksMasuk(browser, { base: BASE, viewport: { width: 1600, height: 1100 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))

  // ---------------------------------------------------------------------------
  // Subjek: diturunkan dari DB, tidak dipaku
  // ---------------------------------------------------------------------------
  const subjek = (
    await db(
      `SELECT p.id, p.nip, p.nama_lengkap, p.golongan
         FROM pegawai p
        WHERE p.status_aktif = 'AKTIF'
          /*
            WAJIB sudah lolos di suatu tempat. Langkah golongan membuktikan
            kelayakannya TURUN saat golongan diturunkan ke I/a — dan "turun" tidak
            bisa dibuktikan pada subjek yang lolosnya sudah nol. Terukur sesudah
            gerbang JABATAN_ASAL dipasang: 46 dari 146 pegawai tidak lolos di target
            mana pun, jadi memilih subjek menurut urutan id akan sering mendapat
            salah satunya dan langkahnya merah tanpa ada yang rusak.
          */
          AND EXISTS (SELECT 1 FROM match_score m WHERE m.pegawai_id = p.id AND m.eligible = 1)
          AND EXISTS (SELECT 1 FROM asesmen_talenta a WHERE a.pegawai_id = p.id)
          AND p.golongan IS NOT NULL AND p.golongan <> ''
        ORDER BY p.id LIMIT 1`,
    )
  )[0]

  if (subjek === undefined) {
    catat(
      'PRASYARAT: ada pegawai ber-match_score & ber-asesmen',
      false,
      'tidak ada — ini PRASYARAT, bukan temuan tentang sinkronisasi',
    )
  } else {
    const awal = await potretSkor(subjek.id)

    await langkah('subjek uji punya skor tersimpan untuk beberapa jabatan target', async () => {
      tegaskan(awal.baris > 0, `subjek tidak punya baris match_score`)
      return `${subjek.nama_lengkap} (${subjek.golongan}) · ${awal.baris} baris skor · ${awal.lolos} lolos`
    })

    await bukaProfil(page, subjek.nip)

    // -------------------------------------------------------------------------
    // 1. Identitas — golongan menggerakkan KELAYAKAN, bukan skornya
    // -------------------------------------------------------------------------
    await langkah('ubah golongan di profil → DB berubah & kelayakan dihitung ulang', async () => {
      const semula = subjek.golongan
      const bukaIdentitas = page.locator('main button').filter({ hasText: /^Ubah data$/ }).first()
      const dlg = page.locator('dialog[open]')

      async function setGolongan(nilai) {
        await bukaProfil(page, subjek.nip)
        await bukaIdentitas.click()
        await dlg.waitFor({ timeout: 15000 })
        await dlg.getByLabel(/^Golongan/i).fill(nilai)
        await dlg.getByRole('button', { name: /^Simpan$/ }).click()
      }

      let sesudah
      try {
        // I/a pasti di bawah syarat GOLONGAN_MIN mana pun yang dipakai target
        // aktif (III/b & III/d), jadi kelayakannya WAJIB turun. Memakai golongan
        // yang kebetulan masih lolos akan menghasilkan langkah yang hijau tanpa
        // membuktikan apa pun.
        await setGolongan('I/a')
        sesudah = await tungguDb(async () => {
          const g = (await db('SELECT golongan FROM pegawai WHERE id = ?', [subjek.id]))[0].golongan
          if (g !== 'I/a') return false
          const s = await potretSkor(subjek.id)
          return selesaiDihitung(s, awal.terakhir) ? s : false
        }, 'golongan tersimpan tapi match_score TIDAK dihitung ulang')

        tegaskan(
          sesudah.lolos < awal.lolos,
          `kelayakan tidak turun: ${awal.lolos} → ${sesudah.lolos} (golongan I/a seharusnya gugur)`,
        )
      } finally {
        /*
          Pemulihan di `finally`, bukan sesudah asersinya. Versi pertama menaruhnya
          setelah `tegaskan()` — dan ketika asersinya gagal, golongan subjek
          TERTINGGAL di I/a beserta kelayakan 0 di seluruh 13 jabatan target. Uji
          yang merusak data saat gagal jauh lebih mahal daripada uji yang gagal.
        */
        await setGolongan(semula)
        await tungguDb(async () => {
          const g = (await db('SELECT golongan FROM pegawai WHERE id = ?', [subjek.id]))[0].golongan
          if (g !== semula) return false
          const s = await potretSkor(subjek.id)
          return s.lolos === awal.lolos ? s : false
        }, 'kelayakan tidak pulih setelah golongan dikembalikan')
      }

      return `lolos ${awal.lolos} → ${sesudah.lolos} → ${awal.lolos} · seluruh 13 baris dihitung ulang`
    })

    // -------------------------------------------------------------------------
    // 2. Asesmen — potkom menggerakkan SKORNYA
    // -------------------------------------------------------------------------
    await langkah('ubah potkom di profil → DB berubah & skor dihitung ulang', async () => {
      const brs = (
        await db(
          `SELECT a.id, a.potkom FROM asesmen_dipakai d
             JOIN asesmen_talenta a ON a.id = d.asesmen_id
            WHERE d.pegawai_id = ?`,
          [subjek.id],
        )
      )[0]
      tegaskan(brs !== undefined, 'subjek tidak punya asesmen yang dipakai — prasyarat')
      const semula = Number(brs.potkom)
      const baru = semula > 60 ? 45 : 120
      const sebelum = await potretSkor(subjek.id)

      const bukaAsesmen = page
        .locator('main table')
        .filter({ hasText: 'Potkom' })
        .locator('button')
        .filter({ hasText: /^Ubah$/ })
        .first()
      const dlg = page.locator('dialog[open]')

      async function setPotkom(nilai) {
        await bukaProfil(page, subjek.nip)
        await bukaAsesmen.click()
        await dlg.waitFor({ timeout: 15000 })
        await dlg.getByLabel(/^Potkom/i).first().fill(String(nilai))
        await dlg.getByRole('button', { name: /^Simpan$/ }).click()
      }

      let sesudah
      try {
        await setPotkom(baru)
        sesudah = await tungguDb(async () => {
          const p = Number(
            (await db('SELECT potkom FROM asesmen_talenta WHERE id = ?', [brs.id]))[0].potkom,
          )
          if (Math.abs(p - baru) > 0.01) return false
          const s = await potretSkor(subjek.id)
          return selesaiDihitung(s, sebelum.terakhir) ? s : false
        }, 'potkom tersimpan tapi match_score TIDAK dihitung ulang')

        tegaskan(
          sesudah.rata !== sebelum.rata,
          `rata skor tidak bergerak: ${sebelum.rata} → ${sesudah.rata}`,
        )
      } finally {
        await setPotkom(semula)
        await tungguDb(async () => {
          const s = await potretSkor(subjek.id)
          return s.rata === sebelum.rata ? s : false
        }, 'skor tidak pulih setelah potkom dikembalikan')
      }

      return `rata ${sebelum.rata} → ${sesudah.rata} → ${sebelum.rata} (potkom ${semula} → ${baru} → ${semula})`
    })

    // -------------------------------------------------------------------------
    // 3. "Isi manual" — nilai indikator yang diketik verifikator
    // -------------------------------------------------------------------------
    await langkah('isi manual indikator → DB berubah & skor dihitung ulang', async () => {
      /*
        Jalur tulis yang BERBEDA dari keenam editor profil: ia hidup di
        `lib/aksi/skoring.ts` (`simpanNilaiManual`), menulis ke
        `match_score_detail.sumber_nilai='MANUAL'`, dan merantai `hitungUlangSkor()`
        — hitung ulang SELURUH jabatan target, bukan satu pegawai. Diuji terpisah
        karena penjaga struktural yang hanya membaca `profil.ts` tidak menjangkaunya.
      */
      const sebelum = await potretSkor(subjek.id)
      const manualAwal = Number(
        (
          await db(
            `SELECT COUNT(*) AS n FROM match_score_detail d
               JOIN match_score m ON m.id = d.match_score_id
              WHERE m.pegawai_id = ? AND d.sumber_nilai = 'MANUAL'`,
            [subjek.id],
          )
        )[0].n,
      )
      await bukaProfil(page, subjek.nip)

      /*
        Tombol "Isi manual" ada DI DALAM panel rincian per jabatan target, yang
        bawaannya terlipat. Mencarinya tanpa membuka panelnya menghasilkan "tidak
        ada tombol" — yang terbaca seperti fiturnya hilang, padahal cuma belum
        digambar. Panel rincian pertama dibuka lebih dulu.
      */
      /*
        DITUNGGU, bukan dihitung. Panel "Kecocokan dengan jabatan target" dialirkan
        lewat `<Suspense>`, dan `count()` tidak menunggu apa pun — dipanggil tepat
        sesudah halaman siap, ia menjawab 0 dan langkah ini melapor "tidak ada
        tombol Isi manual" atas panel yang cuma belum tiba. Jebakan #1 CLAUDE.md,
        kali kesekian.
      */
      await page
        .waitForSelector('main button:has-text("Lihat rincian perhitungan")', { timeout: 45000 })
        .catch(() => {})
      const buka = page.locator('main button').filter({ hasText: /Lihat rincian perhitungan/ })
      if ((await buka.count()) > 0) {
        await buka.first().click()
        await page
          .locator('main button')
          .filter({ hasText: /^Isi manual$/ })
          .first()
          .waitFor({ state: 'attached', timeout: 20000 })
          .catch(() => {})
      }

      const tombol = page.locator('main button').filter({ hasText: /^Isi manual$/ })
      if ((await tombol.count()) === 0) {
        // Tombolnya hanya untuk PERAN_HITUNG dan hanya pada indikator yang boleh
        // diisi manusia. Kalau tidak ada, ini PRASYARAT — bukan temuan.
        throw new Error(
          'tidak ada tombol "Isi manual" di profil ini — PRASYARAT, bukan temuan tentang jalur tulisnya',
        )
      }
      await tombol.first().click()
      const dlg = page.locator('dialog[open]')
      await dlg.waitFor({ timeout: 15000 })

      /*
        Kedua isian dialog ini `<input>`, BUKAN `<textarea>` — "Alasan & bukti"
        bertipe `teks` di `tombol-nilai-manual.tsx`. Versi pertama langkah ini
        mencari textarea dan habis waktu 30 detik, yang terbaca seperti dialognya
        tidak terbuka. Ditargetkan lewat LABEL supaya ia ikut kalau bentuk
        kontrolnya berubah.
      */
      await dlg.getByLabel(/Alasan & bukti/i).fill('Uji sinkronisasi jalur tulis — dikembalikan otomatis.')
      const pilih = dlg.locator('select')
      if ((await pilih.count()) > 0) {
        const opsi = await pilih
          .first()
          .locator('option')
          .evaluateAll((os) => os.map((o) => o.value).filter((v) => v !== ''))
        await pilih.first().selectOption(opsi[opsi.length - 1])
      } else {
        await dlg.getByLabel(/Nilai mentah/i).fill('75')
      }
      await dlg.locator('button').filter({ hasText: /^Simpan nilai manual$/ }).last().click()

      const sesudah = await tungguDb(async () => {
        const r = await db(
          `SELECT COUNT(*) AS n FROM match_score_detail d
             JOIN match_score m ON m.id = d.match_score_id
            WHERE m.pegawai_id = ? AND d.sumber_nilai = 'MANUAL'`,
          [subjek.id],
        )
        if (Number(r[0].n) <= manualAwal) return false
        /*
          MAX, bukan MIN — dan bedanya penting. `simpanNilaiManual()` merantai
          `hitungUlangSkor(jabatanTargetId)`: SATU jabatan target, bukan semua.
          (Ia memang menghitung ulang seluruh POPULASI target itu, sebab peringkat
          pool lahir dari membandingkan semua kandidat.) Jadi menuntut MIN maju —
          benar untuk jalur profil yang menyentuh semua target satu pegawai — akan
          selalu habis waktu di sini, atas perhitungan yang sebenarnya berjalan.
        */
        const s = await potretSkor(subjek.id)
        return s.terakhir !== null && sebelum.terakhir !== null && s.terakhir > sebelum.terakhir
          ? { s, manual: Number(r[0].n) }
          : false
      }, 'nilai manual tersimpan tapi match_score TIDAK dihitung ulang')

      tegaskan(
        sesudah.s.rata !== sebelum.rata,
        `rata skor tidak bergerak: ${sebelum.rata} → ${sesudah.s.rata}`,
      )

      /*
        Pemulihan: baris MANUAL yang baru dibuang, lalu perhitungan dipicu ulang
        lewat jalur yang SUDAH terbukti di langkah 1 — menyimpan identitas dengan
        golongan yang sama memanggil `sinkronkanSkor()` dan menulis ulang seluruh
        baris skor pegawai ini. Memakai jalur aplikasi, bukan menambal angkanya
        langsung di DB: yang ditambal tangan tidak membuktikan apa pun tentang
        keadaan yang ditinggalkan uji ini.
      */
      await db(
        `DELETE d FROM match_score_detail d
           JOIN match_score m ON m.id = d.match_score_id
          WHERE m.pegawai_id = ? AND d.sumber_nilai = 'MANUAL'`,
        [subjek.id],
      )
      await bukaProfil(page, subjek.nip)
      await page.locator('main button').filter({ hasText: /^Ubah data$/ }).first().click()
      const dlgPulih = page.locator('dialog[open]')
      await dlgPulih.waitFor({ timeout: 15000 })
      await dlgPulih.getByLabel(/^Golongan/i).fill(subjek.golongan)
      await dlgPulih.getByRole('button', { name: /^Simpan$/ }).click()
      await tungguDb(async () => {
        const s = await potretSkor(subjek.id)
        return s.rata === sebelum.rata ? s : false
      }, 'skor tidak pulih setelah nilai manual dibuang')

      return `${sesudah.manual} baris MANUAL di DB · rata ${sebelum.rata} → ${sesudah.s.rata} → ${sebelum.rata}`
    })

    // -------------------------------------------------------------------------
    // 4. Keadaan akhir HARUS identik dengan potret awal
    // -------------------------------------------------------------------------
    await langkah('keadaan data pulih seperti sebelum uji', async () => {
      const akhir = await potretSkor(subjek.id)
      tegaskan(akhir.baris === awal.baris, `jumlah baris skor bergeser ${awal.baris} → ${akhir.baris}`)
      tegaskan(akhir.lolos === awal.lolos, `kelayakan bergeser ${awal.lolos} → ${akhir.lolos}`)
      tegaskan(akhir.rata === awal.rata, `rata skor bergeser ${awal.rata} → ${akhir.rata}`)
      const g = (await db('SELECT golongan FROM pegawai WHERE id = ?', [subjek.id]))[0].golongan
      tegaskan(g === subjek.golongan, `golongan tidak pulih: ${g}`)
      return `baris ${akhir.baris} · lolos ${akhir.lolos} · rata ${akhir.rata} — identik`
    })
  }
} finally {
  await browser.close()
}

const lulus = hasil.filter((h) => h.ok).length
for (const h of hasil) {
  console.log(`${h.ok ? 'LULUS ' : 'GAGAL '} ${h.nama}`)
  if (h.detail) console.log(`       ${h.detail}`)
}
console.log(`\nRingkasan: ${lulus}/${hasil.length} lulus`)
console.log(errors.length === 0 ? 'Tanpa error halaman.' : `Error halaman:\n${errors.join('\n')}`)
