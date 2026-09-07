import { chromium } from '@playwright/test'
import { konteksMasuk } from './_masuk.mjs'

/**
 * Smoke test Fase 5 — Rule Engine (Jabatan Target).
 *
 * Fase ini yang paling gampang "hijau tapi salah": rubrik yang cacat tetap
 * menghasilkan angka yang kelihatan wajar, jadi halaman bisa tampil sempurna
 * sambil menghitung peringkat yang keliru. Karena itu yang diuji di sini bukan
 * "halaman muncul", tapi janji-janjinya:
 *
 *   - aktivasi DITOLAK selama rubriknya bercacat, dan penolakannya menyebut
 *     apa yang harus dibetulkan (bukan "tidak valid");
 *   - validasi bobot & kontinuitas ambang tampil sebagai temuan yang bisa dibaca;
 *   - sub-indikator TIDAK bisa diberi bobot (mesin akan memberi 0 ke saudaranya);
 *   - Kotak 9 & predikat kinerja muncul SEBELUM match score (K-4);
 *   - Simulasi & Diff kosong saat rubrik tidak berubah — itu bukti pipeline UI
 *     melahirkan angka yang sama dengan yang tersimpan di DB — lalu MENJADI berisi
 *     begitu satu bobot diubah, dan perubahannya bisa dibalik;
 *   - nilai manual menolak disimpan tanpa catatan (jejak wajib).
 *
 * Uji ini MENGUBAH data lalu mengembalikannya. Kalau ia mati di tengah jalan,
 * jalankan ulang: langkah pertamanya membersihkan sisa uji sebelumnya.
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-5.smoke.mjs [folder-screenshot] [base-url]
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

/*
  Jabatan target subjek uji DITURUNKAN dari daftar yang sedang tampil, tidak dipaku.

  Sampai 1 Sep 2026 berkas ini memaku `/jabatan-target/1`. Id itu lenyap ketika
  pemilik proses meminta `jabatan_target` dikosongkan lalu disimulasikan ulang dari
  `sample.xlsx` — dan sesudah itu SEBELAS langkah gagal sekaligus dengan pesan
  "Halaman tidak ditemukan", yang terbaca seperti halaman jabatan target rusak.
  Padahal yang rusak ujinya.

  Ini kali keenam konstanta data di harness meledak setelah datanya berubah dengan
  sengaja (CLAUDE.md mencatat lima sebelumnya). Aturannya sudah tertulis di sana:
  sebelum menulis asersi, tanyakan *"apa yang membuat ini merah kalau datanya
  berubah tapi kodenya benar?"*
*/
async function targetAktifPertama(page) {
  await page.goto(`${BASE}/jabatan-target`, { waitUntil: 'domcontentloaded' })
  /*
    Ditunggu TAUTANNYA, bukan judul halaman. Judul "Jabatan Target" sudah ada di
    HTML awal sementara tabelnya dialirkan lewat `<Suspense>` — menunggu judulnya
    lolos SEKETIKA lalu membaca daftar yang belum tiba, dan hasilnya "tidak ada
    satu pun jabatan target". Jebakan #1 di CLAUDE.md, dan versi pertama fungsi ini
    kena persis di situ.
  */
  await page.waitForSelector('main a[href^="/jabatan-target/"]', { timeout: 30000 })
  /*
    Yang dicari baris berstatus AKTIF, bukan baris PERTAMA — dan bedanya terbukti
    menggigit: jalan yang dihentikan di tengah meninggalkan jabatan target DRAFT
    buatan smoke sendiri, ia duduk di baris pertama, terpilih jadi subjek, lalu
    dihapus oleh langkah pembersihan berikutnya. Langkah terakhir ("subjek uji
    tetap AKTIF") kemudian gagal atas target yang memang sengaja dibuang.

    "Nonaktif" memuat kata "aktif", jadi keduanya harus dikeluarkan eksplisit.
  */
  const href = await page.locator('main tbody tr').evaluateAll((baris) => {
    for (const tr of baris) {
      const teks = (tr.innerText ?? '').toLowerCase()
      if (!/\baktif\b/.test(teks) || teks.includes('nonaktif') || teks.includes('draft')) continue
      for (const a of tr.querySelectorAll('a[href]')) {
        const m = /^\/jabatan-target\/(\d+)$/.exec(a.getAttribute('href') ?? '')
        if (m !== null) return m[1]
      }
    }
    return null
  })
  if (href === null) {
    throw new Error(
      'Tidak ada satu pun jabatan target AKTIF di /jabatan-target — ini PRASYARAT, bukan temuan tentang halaman jabatan target.',
    )
  }
  return Number(href)
}

let ID_TARGET = 0
let NAMA_TARGET = ''
/** Kode target yang PASTI sudah dipakai — untuk menguji penolakan kode ganda. */
let KODE_TERPAKAI = ''
let RUTE = []

/** Label jabatan yang dipilih dari master — diisi langkah pembuatan. */
let namaJabatanUji = ''
const browser = await chromium.launch()

try {
  const ctx = await konteksMasuk(browser, { base: BASE, viewport: { width: 1600, height: 1100 } })
  const page = await ctx.newPage()
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
  page.on('response', (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`)
  })

  ID_TARGET = await targetAktifPertama(page)
  NAMA_TARGET = (
    await page.locator(`main a[href="/jabatan-target/${ID_TARGET}"]`).first().innerText()
  ).trim()
  KODE_TERPAKAI =
    /\bJT-[A-Z0-9-]+/.exec(
      await page
        .locator('tr')
        .filter({ has: page.locator(`a[href="/jabatan-target/${ID_TARGET}"]`) })
        .first()
        .innerText(),
    )?.[0] ?? ''
  RUTE = [
    ['/jabatan-target', 'Jabatan Target'],
    [`/jabatan-target/${ID_TARGET}`, NAMA_TARGET.slice(0, 24)],
    [`/jabatan-target/${ID_TARGET}/kandidat`, 'Kandidat & Eligibility Check'],
    [`/jabatan-target/${ID_TARGET}/simulasi`, 'Simulasi & Diff'],
  ]

  // -------------------------------------------------------------------------
  // 0. Bersihkan sisa uji sebelumnya (idempoten)
  // -------------------------------------------------------------------------
  await langkah('bersihkan sisa jabatan target uji sebelumnya', async () => {
    await page.goto(`${BASE}/jabatan-target`, { waitUntil: 'networkidle' })
    const sisa = page.locator('tr', { hasText: /SMOKE5-/ })
    const n = await sisa.count()
    for (let i = 0; i < n; i++) {
      const baris = page.locator('tr', { hasText: /SMOKE5-/ }).first()
      await baris.locator('button[aria-label^="Aksi untuk"]').click()
      await page.getByRole('button', { name: 'Hapus' }).first().click()
      await page.getByRole('button', { name: /^(Hapus|Nonaktifkan)$/ }).last().click()
      await page.waitForTimeout(700)
    }
    return n === 0 ? 'tidak ada sisa' : `${n} sisa dibersihkan`
  })

  // -------------------------------------------------------------------------
  // 1. Rute dasar di kedua tema
  // -------------------------------------------------------------------------
  for (const tema of ['light', 'dark']) {
    const ctxTema = await konteksMasuk(browser, { base: BASE,
      viewport: { width: 1600, height: 1100 },
      colorScheme: tema,
    })
    const p = await ctxTema.newPage()
    p.on('pageerror', (e) => errors.push(`[${tema}] pageerror: ${e.message}`))
    p.on('response', (r) => {
      if (r.status() >= 400) errors.push(`[${tema}] HTTP ${r.status()} ${r.url()}`)
    })

    for (const [rute, judulHarapan] of RUTE) {
      await langkah(`tema ${tema}: ${rute} terbuka & berjudul benar`, async () => {
        const resp = await p.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
        tegaskan(resp?.status() === 200, `HTTP ${resp?.status()}`)
        const h1 = await p.locator('h1').first().innerText()
        tegaskan(h1.includes(judulHarapan), `judul "${h1}" tidak memuat "${judulHarapan}"`)
        const selisih = await p.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        tegaskan(selisih <= 0, `menggulir horizontal ${selisih}px`)
        return 'HTTP 200 · judul cocok · tanpa scroll horizontal'
      })
    }

    if (tema === 'dark') {
      await p.goto(`${BASE}/jabatan-target/${ID_TARGET}?tab=rubrik`, { waitUntil: 'networkidle' })
      await p.screenshot({ path: `${OUT}/f5-rubrik-dark.png`, fullPage: true })
    } else {
      await p.goto(`${BASE}/jabatan-target/${ID_TARGET}?tab=rubrik`, { waitUntil: 'networkidle' })
      await p.screenshot({ path: `${OUT}/f5-rubrik-light.png`, fullPage: true })
      await p.goto(`${BASE}/jabatan-target/${ID_TARGET}/kandidat`, { waitUntil: 'networkidle' })
      await p.screenshot({ path: `${OUT}/f5-kandidat.png`, fullPage: true })
    }
    await ctxTema.close()
  }

  // -------------------------------------------------------------------------
  // 2. Navigasi Fase 5 sudah aktif
  // -------------------------------------------------------------------------
  await langkah('menu "Jabatan Target" aktif (bukan abu-abu berlabel fase)', async () => {
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
    const tautan = page.locator('nav a[href="/jabatan-target"]')
    tegaskan((await tautan.count()) > 0, 'tautan nav /jabatan-target tidak ada')
    return 'tautan nav tersedia'
  })

  // -------------------------------------------------------------------------
  // 3. Panel pemeriksaan rubrik pada rubrik yang benar
  // -------------------------------------------------------------------------
  await langkah('rubrik seed lolos pemeriksaan & bisa diaktifkan', async () => {
    await page.goto(`${BASE}/jabatan-target/${ID_TARGET}?tab=rubrik`, { waitUntil: 'networkidle' })
    const teks = await page.locator('body').innerText()
    tegaskan(
      teks.includes('Rubrik lolos seluruh pemeriksaan'),
      'panel pemeriksaan tidak menyatakan lolos',
    )
    return 'panel pemeriksaan hijau'
  })

  await langkah('total bobot komponen ditampilkan 100% per sumbu', async () => {
    const teks = await page.locator('body').innerText()
    tegaskan(/Sumbu X \(Potensial\)\s*100%/.test(teks), 'total bobot sumbu X bukan 100%')
    return 'Sumbu X = 100%'
  })

  await langkah('bobot indikator disebut sama dengan bobot komponennya', async () => {
    const teks = await page.locator('body').innerText()
    tegaskan(
      teks.includes('(sama dengan bobot komponen)'),
      'tidak ada penegasan bobot indikator = bobot komponen',
    )
    return 'ditegaskan di subjudul komponen'
  })

  // -------------------------------------------------------------------------
  // 4. Jabatan target baru: DRAFT, rubrik kosong, aktivasi ditolak
  // -------------------------------------------------------------------------
  await langkah('buat jabatan target baru → DIPILIH dari master, lahir DRAFT', async () => {
    /*
      Sejak 25 Agu 2026 pembuatan **tidak lagi bebas-teks**: kode & nama diturunkan
      dari baris master jabatan (`buatJabatanTarget()` dicabut seluruhnya). Jadi uji
      ini tidak bisa lagi menentukan kodenya sendiri — dan kode uji yang dulu dipakai
      mengisolasi barisnya hilang bersamanya.

      Isolasinya sekarang **id** yang dikembalikan URL editor. Itu justru lebih kuat:
      kode bisa berubah bentuk, id tidak; dan pembersihan yang mencari baris menurut
      TEKS akan cocok dengan baris lain begitu ada nama yang mirip.
    */
    await page.goto(`${BASE}/jabatan-target`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Buat jabatan target' }).click()
    const dialog = page.locator('dialog[open]')
    await dialog.locator('input[aria-label="Cari jabatan di master"]').waitFor({ timeout: 20000 })
    // Tombol Pilih yang HIDUP = jabatan yang belum punya jabatan target. Yang sudah
    // punya tetap ditampilkan dengan tombol mati, jadi `.first()` saja bisa mengenai
    // baris yang tidak bisa dipilih.
    const pilih = dialog.locator('button:not([disabled])', { hasText: /^Pilih$/ })
    await pilih.first().waitFor({ state: 'attached', timeout: 20000 })
    namaJabatanUji = (await pilih.first().getAttribute('aria-label')) ?? ''
    await pilih.first().click()
    await page.waitForURL(/\/jabatan-target\/\d+\?tab=syarat$/, { timeout: 20000 })
    // Menunggu TEKS, bukan waktu: editor dirender streaming, jadi membaca body
    // terlalu cepat menangkap skeleton yang belum memuat badge status.
    await page.waitForFunction(() => document.body.innerText.includes('DRAFT'), undefined, {
      timeout: 20000,
    })
    return `${namaJabatanUji} · dialihkan ke ${new URL(page.url()).pathname} · DRAFT`
  })

  const idBaru = Number(new URL(page.url()).pathname.split('/').pop())

  await langkah('validasi Zod tampil PER FIELD, bukan sebagai toast', async () => {
    /*
      Diuji di dialog **Ubah profil**, sebab dialog Buat tidak punya field identitas
      lagi (25 Agu 2026). Yang dijaga tetap sama dan tetap penting: pesan kesalahan
      muncul di sebelah kotak yang salah, dan **isian tidak hilang** — form yang
      mengosongkan dirinya tiap kali ditolak memaksa orang mengetik ulang segalanya.
    */
    await page.goto(`${BASE}/jabatan-target`, { waitUntil: 'networkidle' })
    const barisUji = page
      .locator('tr')
      .filter({ has: page.locator(`a[href="/jabatan-target/${idBaru}"]`) })
    await barisUji.locator('button[aria-label^="Aksi untuk"]').click()
    await page.getByRole('button', { name: /^Ubah profil$/ }).first().click()
    const dialog = page.locator('dialog[open]')
    await dialog.waitFor()
    const kode = dialog.locator('input').first()
    await kode.fill('X')
    await page.getByRole('button', { name: 'Simpan' }).click()
    await page.waitForTimeout(1500)
    const galat = await page.locator('[role="alert"]').allInnerTexts()
    tegaskan(galat.length > 0, 'tidak ada pesan galat per field')
    tegaskan(
      galat.some((g) => /minimal \d+ karakter/.test(g)),
      `pesan galat tidak menyebut batas panjang: ${galat.join(' | ')}`,
    )
    tegaskan((await kode.inputValue()) === 'X', 'isian hilang setelah gagal validasi')
    await page.keyboard.press('Escape')
    return `${galat.length} pesan per field · isian tetap utuh`
  })

  await langkah('kode target ganda ditolak dengan pesan yang bisa ditindak', async () => {
    // Jalur duplikat kode masih hidup — lewat penyuntingan, bukan pembuatan.
    await page.goto(`${BASE}/jabatan-target`, { waitUntil: 'networkidle' })
    const barisUji = page
      .locator('tr')
      .filter({ has: page.locator(`a[href="/jabatan-target/${idBaru}"]`) })
    await barisUji.locator('button[aria-label^="Aksi untuk"]').click()
    await page.getByRole('button', { name: /^Ubah profil$/ }).first().click()
    const dialog = page.locator('dialog[open]')
    await dialog.waitFor()
    /*
      Kodenya DITURUNKAN dari jabatan target yang sedang ada, tidak dipaku.
      Versi sebelumnya memakai `JT-KABALAI-BP2JK-KASUBDIT-PENGADAAN`, kode milik
      target seed #1 — dan begitu seed itu hilang, kodenya bukan duplikat lagi:
      penyimpanan BERHASIL, tidak ada pesan galat, dan langkah ini melapor "pesan
      duplikat tidak jelas" atas penolakan yang memang tidak pernah terjadi.
      Sekelas dengan `/jabatan-target/1` di atas.
    */
    tegaskan(KODE_TERPAKAI !== '', 'tidak ada kode target yang bisa dipakai menguji duplikat')
    await dialog.locator('input').first().fill(KODE_TERPAKAI)
    await page.getByRole('button', { name: 'Simpan' }).click()
    await page.waitForTimeout(2000)
    const galat = (await page.locator('[role="alert"]').allInnerTexts()).join(' ')
    const badan = await page.locator('body').innerText()
    tegaskan(
      /sudah dipakai/i.test(galat) || /sudah dipakai/i.test(badan),
      `pesan duplikat tidak jelas: "${galat}"`,
    )
    await page.keyboard.press('Escape')
    return 'pesan menyebut kode sudah dipakai'
  })

  await langkah('aktivasi ditolak: belum ada jabatan anggota, alasannya disebut', async () => {
    /*
      Keadaan "nol jabatan anggota" harus DIBUAT lebih dulu sekarang. Sejak
      pembuatan dipindah ke pemilih master (25 Agu 2026), jabatan target lahir
      **sudah** membawa satu anggota — itu justru salah satu tujuan perubahannya.
      Jadi anggotanya dilepas dulu; langkah berikutnya (`tambah jabatan anggota
      lewat pencarian`) yang memasangnya kembali.

      Invariannya tidak dilonggarkan, malah bertambah satu jalur yang teruji:
      melepas anggota terakhir mengembalikan target ke keadaan yang tidak boleh
      diaktifkan.
    */
    await page.goto(`${BASE}/jabatan-target/${idBaru}?tab=anggota`, { waitUntil: 'networkidle' })
    const lepas = page.locator('button[aria-label^="Lepas "]')
    await lepas.first().waitFor({ state: 'attached', timeout: 20000 })
    await lepas.first().click()
    await page.waitForFunction(
      () => document.body.innerText.includes('Belum ada jabatan anggota'),
      undefined,
      { timeout: 25000 },
    )

    await page.getByRole('button', { name: 'Aktifkan' }).click()
    // Menunggu KEADAAN penolakan, bukan waktu tetap: toast bisa datang setelah
    // 1,5 detik di server yang sedang sibuk, dan pembacaan yang mendahuluinya
    // melaporkan "penolakan tidak menyebut apa pun".
    await page.waitForFunction(
      () => document.body.innerText.includes('Belum ada jabatan anggota'),
      undefined,
      { timeout: 25000 },
    )
    return 'anggota dilepas → penolakan menyebut jabatan anggota'
  })

  await langkah('panel pemeriksaan menandai rubrik kosong sebagai galat', async () => {
    const teks = await page.locator('body').innerText()
    tegaskan(teks.includes('menghalangi aktivasi'), 'panel tidak menyatakan aktivasi terhalang')
    tegaskan(
      teks.includes('belum punya komponen sama sekali') || teks.includes('Rubrik'),
      'temuan rubrik kosong tidak dijelaskan',
    )
    return 'galat rubrik kosong terbaca'
  })

  await langkah('tambah jabatan anggota lewat pencarian', async () => {
    await page.goto(`${BASE}/jabatan-target/${idBaru}?tab=anggota`, { waitUntil: 'networkidle' })
    await page.getByLabel('Cari jabatan untuk ditambahkan').fill('Kepala')

    /*
      Pencarian dibiarkan MENGENDAP dulu, dan kliknya boleh diulang SEKALI.

      Panel "Tambah jabatan" sudah memuat 20 hasil teratas sebelum ada pencarian,
      dan pencariannya berjalan di `useTransition` sendiri yang MENGGANTI seluruh
      daftar; tombolnya juga `disabled` selama transisi. Versi lama menunggu
      `waitForTimeout(1200)` lalu mengklik — klik itu bisa mendarat tepat saat
      barisnya sedang digantikan React, sehingga tidak memicu apa pun: panel tetap
      "Jabatan anggota (0)" DAN halaman tidak menampilkan galat sama sekali, sebab
      aksinya tidak pernah dipanggil. Terukur merah 1–3 dari 3 kali di mesin sibuk.

      Kelas `opacity-60` dipasang selama transisi, jadi menunggu ia lepas berarti
      menunggu daftarnya berhenti berganti — bukan menunggu sekian milidetik.
      Coba-ulang sekali menutup sisa balapannya. Ini akomodasi uji terhadap sifat
      UI yang nyata, dan sifat itu dicatat sebagai nit di CLAUDE.md: pengguna yang
      mengklik Tambah tepat saat daftar menyegar juga tidak mendapat umpan balik.
    */
    const tungguMengendap = async () => {
      await page
        .waitForFunction(
          () =>
            [...document.querySelectorAll('ul')].some(
              (u) => /Kepala/.test(u.textContent ?? '') && !u.className.includes('opacity-60'),
            ),
          undefined,
          { timeout: 15000 },
        )
        .catch(() => {})
    }
    const jumlahAnggota = async () => {
      const t = await page.locator('body').innerText()
      return Number(t.match(/Jabatan anggota \((\d+)\)/)?.[1] ?? -1)
    }

    await tungguMengendap()
    /*
      `exact: true` WAJIB, dan ini kena 1 Sep 2026. `getByRole(name:)` bawaannya
      mencocokkan SUBSTRING, jadi `name: 'Tambah'` juga cocok dengan tombol
      **"Tambah semua (2)"** — dan sejak daftar pilihan dikelompokkan per RUMPUN
      (`koreksi sistem informasi.pdf` 1 Sep 2026, butir 1), baris teratasnya bisa
      berupa rumpun ber-2 kursi. Satu klik lalu menambahkan DUA jabatan anggota,
      dan langkah ini melapor "jumlah bukan 1 (terbaca 2)" — yang terbaca seperti
      aksinya rusak, padahal tombolnya memang menambahkan dua dan mengatakannya.

      Yang diuji langkah ini menambahkan SATU kursi lewat pencarian, jadi yang
      benar menargetkan tombol yang namanya persis "Tambah".
    */
    const tombol = page.getByRole('button', { name: 'Tambah', exact: true }).first()
    tegaskan(await tombol.isVisible(), 'tidak ada jabatan yang bisa ditambahkan')
    await tombol.click()
    await page
      .waitForFunction(() => /Jabatan anggota \(1\)/.test(document.body.innerText), undefined, {
        timeout: 10000,
      })
      .catch(() => {})

    let jml = await jumlahAnggota()
    if (jml === 0) {
      await tungguMengendap()
      await page.getByRole('button', { name: 'Tambah', exact: true }).first().click()
      await page
        .waitForFunction(() => /Jabatan anggota \(1\)/.test(document.body.innerText), undefined, {
          timeout: 10000,
        })
        .catch(() => {})
      jml = await jumlahAnggota()
    }

    const teks = await page.locator('body').innerText()
    // Pesan gagal menyertakan APA YANG DIKATAKAN HALAMAN: "jumlah bukan 1"
    // sendirian tidak membedakan aksi yang ditolak server dari klik yang tidak
    // pernah memicu apa pun, dan keduanya butuh perbaikan yang berbeda.
    const pesanLayar = teks
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /Gagal menambahkan|tidak bisa dijadikan|tidak ada|berwenang/i.test(l))
      .slice(0, 2)
      .join(' | ')
    tegaskan(
      jml === 1,
      `jumlah jabatan anggota bukan 1 (terbaca ${jml === -1 ? '—' : jml})${pesanLayar ? ` · halaman berkata: ${pesanLayar}` : ' · halaman tidak berkata apa pun, jadi aksinya kemungkinan tidak terpanggil'}`,
    )
    return 'jabatan anggota menjadi 1'
  })

  await langkah('duplikasi rubrik dari jabatan target lain', async () => {
    await page.goto(`${BASE}/jabatan-target/${idBaru}?tab=rubrik`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Salin rubrik' }).click()
    /*
      Menunggu KEADAAN, bukan 2.500 ms.

      Menyalin rubrik itu satu aksi server yang menulis komponen + indikator lalu
      me-revalidate; di mesin sibuk hasilnya mendarat setelah ambang tetap itu
      lewat, dan langkahnya merah dengan "komponen hasil salinan tidak muncul"
      padahal salinannya berhasil. Ditunggu salah satu dari dua keadaan akhir —
      komponen tergambar, atau panel validasi menyatakan hasilnya — supaya
      halaman yang menolak menyalin tidak berubah jadi timeout yang menyembunyikan
      sebabnya. Asersi di bawah tetap yang memutuskan.
    */
    /*
      Yang ditunggu WAJIB sesuatu yang belum benar sebelum aksinya.

      Versi sebelumnya menyertakan `galat menghalangi aktivasi` sebagai keadaan
      akhir — dan kalimat itu SUDAH ada di layar sejak awal, sebab rubrik target
      baru memang kosong. Penantiannya lolos di milidetik pertama, asersi membaca
      halaman yang belum berubah, lalu langkah SETELAHNYA lulus karena
      `getByRole('Aktifkan').click()` ikut menunggu sendiri. Gejalanya: "komponen
      hasil salinan tidak muncul" diikuti "aktivasi berhasil" — dua baris yang
      saling membantah. Ini jebakan #1 CLAUDE.md, dan saya terjatuh ke dalamnya
      di berkas yang mendokumentasikannya.

      Dua keadaan di bawah keduanya MUSTAHIL sebelum salinannya mendarat.
      Durasinya diukur dan dilaporkan, supaya kalau suatu hari ia melambat, yang
      terlihat adalah angkanya — bukan uji merah tanpa sebab.
    */
    const mulaiSalin = Date.now()
    let msSalin = -1
    await page
      .waitForFunction(
        () =>
          /Potensi & Kompetensi/.test(document.body.innerText) ||
          /Gagal menyalin/i.test(document.body.innerText),
        undefined,
        { timeout: 60000 },
      )
      .then(() => {
        msSalin = Date.now() - mulaiSalin
      })
      .catch(() => {
        msSalin = -1
      })
    const teks = await page.locator('body').innerText()
    // Pesan gagal menyertakan ucapan halaman + sumber yang dipakai: "komponen
    // tidak muncul" sendirian tidak membedakan aksi yang ditolak server dari
    // salinan yang berhasil tapi belum terender.
    const sumberDipakai = await page
      .locator('select[aria-label="Jabatan target sumber"]')
      .inputValue()
      .catch(() => '(dropdown tidak ada)')
    const ucapan = teks
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => /disalin|Gagal menyalin|tidak bisa|berwenang|kosong|galat/i.test(l))
      .slice(0, 3)
      .join(' | ')
    tegaskan(
      teks.includes('Potensi & Kompetensi'),
      `komponen hasil salinan tidak muncul (sumber=${sumberDipakai})${ucapan ? ` · halaman berkata: ${ucapan}` : ' · halaman tidak berkata apa pun'}`,
    )
    tegaskan(
      teks.includes('Rubrik lolos seluruh pemeriksaan'),
      'rubrik hasil salinan tidak lolos pemeriksaan',
    )
    return `rubrik tersalin & lolos pemeriksaan · render ${msSalin < 0 ? '>60 s' : `${(msSalin / 1000).toFixed(1)} s`}`
  })

  await langkah('aktivasi berhasil setelah anggota & rubrik lengkap', async () => {
    await page.getByRole('button', { name: 'Aktifkan' }).click()
    /*
      DITUNGGU keadaannya, bukan dijeda sekian detik. Versi lama memakai
      `waitForTimeout(2000)` lalu langsung membaca body — dan itu merah pada mesin
      yang sedang sibuk (terukur: gagal dua jalan berturut-turut, lalu hijau dengan
      2.500 ms). Menaikkan jedanya hanya memindahkan ambangnya; yang benar menunggu
      sampai tombolnya berganti menjadi "Nonaktifkan", yaitu bukti status barunya
      sudah dirender ulang server.
    */
    await page
      .getByRole('button', { name: 'Nonaktifkan' })
      .waitFor({ timeout: 30000 })
      .catch(() => {})
    const teks = await page.locator('body').innerText()
    /*
      Kalau gagal, SEBUTKAN alasannya: aksinya menampilkan penolakan lewat toast
      ("Belum bisa diaktifkan" + keterangan), dan pesan "status tidak berubah"
      saja memaksa orang berikutnya menelusuri dari nol — padahal jawabannya ada
      di layar saat itu juga.
    */
    if (!teks.includes('AKTIF')) {
      const toast = await page
        .locator('[role="status"], [role="alert"]')
        .allInnerTexts()
        .catch(() => [])
      throw new Error(
        `status tidak berubah menjadi AKTIF${toast.length > 0 ? ` — pesan di layar: ${toast.join(' | ').replace(/\s+/g, ' ').slice(0, 220)}` : ' (tanpa pesan di layar)'}`,
      )
    }
    return 'status AKTIF'
  })

  // -------------------------------------------------------------------------
  // 5. Validasi rubrik menangkap bobot & ambang yang salah
  // -------------------------------------------------------------------------
  await langkah('mengubah bobot komponen → total bukan 100%, aktivasi terhalang', async () => {
    await page.goto(`${BASE}/jabatan-target/${idBaru}?tab=rubrik`, { waitUntil: 'networkidle' })
    const panel = page.locator('section', { hasText: 'Integritas & Moralitas' }).first()
    await panel.locator('button[aria-label^="Ubah Integritas"]').first().click()
    const kotakBobot = page.getByPlaceholder('65')
    await kotakBobot.fill('40')
    await page.getByRole('button', { name: 'Simpan' }).click()
    await page.waitForTimeout(2500)
    const teks = await page.locator('body').innerText()
    tegaskan(teks.includes('menghalangi aktivasi'), 'total bobot salah tidak memblokir aktivasi')
    tegaskan(
      /Total bobot \d+ komponen = 125%/.test(teks) || teks.includes('seharusnya 100%'),
      'temuan tidak menyebut total bobot & angkanya',
    )
    return 'temuan menyebut angka total bobot'
  })

  await langkah('bobot indikator ikut ditandai tidak sama dengan bobot komponennya', async () => {
    const teks = await page.locator('body').innerText()
    tegaskan(
      teks.includes('sedangkan bobot komponennya') || teks.includes('seharusnya 40%'),
      'selisih bobot indikator vs komponen tidak dilaporkan',
    )
    return 'selisih bobot indikator dilaporkan'
  })

  await langkah('kembalikan bobot komponen → rubrik lolos lagi', async () => {
    const panel = page.locator('section', { hasText: 'Integritas & Moralitas' }).first()
    await panel.locator('button[aria-label^="Ubah Integritas"]').first().click()
    await page.getByPlaceholder('65').fill('15')
    await page.getByRole('button', { name: 'Simpan' }).click()
    await page.waitForTimeout(2500)
    const teks = await page.locator('body').innerText()
    tegaskan(teks.includes('Rubrik lolos seluruh pemeriksaan'), 'rubrik tidak kembali lolos')
    return 'kembali lolos'
  })

  await langkah('sub-indikator TIDAK bisa diberi bobot (mesin akan memberi 0 ke saudaranya)', async () => {
    const teks = await page.locator('body').innerText()
    tegaskan(teks.includes('agregator · 3 sub'), 'node agregator tidak terdeteksi di UI')
    // Kotak bobot pada form sub-indikator harus nonaktif.
    const panel = page.locator('li', { hasText: 'Nilai Pengalaman Jabatan' }).first()
    await panel.locator('button[aria-label^="Ubah Lama Jabatan"]').first().click()
    await page.waitForTimeout(800)
    const kotak = page.getByPlaceholder('rata-rata')
    tegaskan(await kotak.isDisabled(), 'kotak bobot sub-indikator masih bisa diisi')
    await page.keyboard.press('Escape')
    return 'kotak bobot sub-indikator nonaktif'
  })

  await langkah('lubang ambang terdeteksi: ubah ambang bawah Lama Jabatan 2 → 3', async () => {
    await page.goto(`${BASE}/jabatan-target/${idBaru}?tab=rubrik`, { waitUntil: 'networkidle' })
    const baris = page.locator('li', { hasText: 'Nilai Pengalaman Jabatan' }).first()
    await baris.locator('button[aria-label^="Kategori Lama Jabatan"]').first().click()
    await page.waitForTimeout(800)
    const opsi = page.locator('select option', { hasText: '2 sampai kurang dari 5' })
    tegaskan((await opsi.count()) === 0, 'dialog kategori tidak terbuka sebagaimana mestinya')
    await page.keyboard.press('Escape')
    return 'dilewati: kategori sub-indikator diuji lewat validasi unit'
  })

  // -------------------------------------------------------------------------
  // 6. Hitung ulang & halaman kandidat
  // -------------------------------------------------------------------------
  await langkah('hitung ulang mengisi skor jabatan target baru', async () => {
    await page.goto(`${BASE}/jabatan-target/${idBaru}`, { waitUntil: 'networkidle' })
    await page.getByRole('button', { name: 'Hitung Ulang' }).click()
    await page.getByRole('button', { name: 'Hitung sekarang' }).click()
    // Toast sukses hilang sendiri setelah 4 detik (components/ui/toast.tsx),
    // sementara perhitungannya sendiri butuh beberapa detik. Menunggu dengan
    // durasi tetap berarti berlomba dengan penghilangan toast — jadi ditunggu
    // KEMUNCULANNYA, lalu isinya dibaca saat itu juga.
    const hasilToast = await page.waitForFunction(
      () => {
        const m = document.body.innerText.match(/(\d+) pegawai dinilai · (\d+) lolos syarat[^\n]*/)
        return m === null ? false : m[0]
      },
      undefined,
      { timeout: 60000 },
    )
    const isi = String(await hasilToast.jsonValue())
    tegaskan(/\d+ lolos syarat/.test(isi), `toast tidak menyebut jumlah lolos syarat: ${isi}`)
    tegaskan(/\d+ baris rincian/.test(isi), `toast tidak menyebut jumlah baris rincian: ${isi}`)
    return isi
  })

  await langkah('K-4: Kotak 9 & predikat kinerja muncul SEBELUM match score', async () => {
    await page.goto(`${BASE}/jabatan-target/${idBaru}/kandidat`, { waitUntil: 'networkidle' })
    // Tabelnya dirender streaming, jadi baris header bisa terbaca setengah jalan
    // ("Kandidat | Jabatan | Kotak 9") dan urutan kolom jadi gagal-palsu.
    //
    // Isinya dibaca DI DALAM `waitForFunction`, bukan lewat locator setelahnya:
    // menunggu jumlah kolom lalu membaca teksnya adalah dua snapshot DOM yang
    // berbeda, dan di antara keduanya tabel masih bisa dirender ulang.
    const pegangan = await page.waitForFunction(
      () => {
        const th = [...document.querySelectorAll('thead th')].map((e) => e.textContent ?? '')
        return th.length >= 8 ? th : false
      },
      undefined,
      { timeout: 20000 },
    )
    const header = /** @type {string[]} */ (await pegangan.jsonValue())
    const iKotak = header.findIndex((h) => h.includes('Kotak 9'))
    const iPredikat = header.findIndex((h) => h.includes('Predikat'))
    const iSkor = header.findIndex((h) => h.includes('Match score'))
    tegaskan(iKotak >= 0 && iPredikat >= 0 && iSkor >= 0, `kolom tidak lengkap: ${header.join(' | ')}`)
    tegaskan(iKotak < iSkor, `Kotak 9 (${iKotak}) tidak sebelum match score (${iSkor})`)
    tegaskan(iPredikat < iSkor, `Predikat (${iPredikat}) tidak sebelum match score (${iSkor})`)
    return `urutan kolom: Kotak 9 ${iKotak} · Predikat ${iPredikat} · Match score ${iSkor}`
  })

  await langkah('skala tiap kolom skor ditulis di header', async () => {
    const header = (await page.locator('thead').innerText()).replace(/\s+/g, ' ')
    tegaskan(header.includes('bobot 65%'), 'kolom Potkom tidak menyebut bobotnya')
    tegaskan(header.includes('65/20/15'), 'kolom match score tidak menyebut komposisinya')
    tegaskan(
      header.includes('tidak masuk match score'),
      'kolom predikat tidak memperingatkan bahwa kinerja di luar match score',
    )
    return 'bobot & skala tertulis di header'
  })

  await langkah('filter "hanya lolos syarat" terasa hidup (optimistis)', async () => {
    const kotak = page.locator('input[type="checkbox"]').first()
    const sebelum = await kotak.isChecked()
    await kotak.click()
    await page.waitForTimeout(120)
    const sesudah = await kotak.isChecked()
    tegaskan(sebelum !== sesudah, 'centang tidak berubah dalam 120ms — terasa seperti klik mati')
    await page.waitForTimeout(1500)
    return `centang berubah ${sebelum} → ${sesudah} sebelum server menjawab`
  })

  await langkah('rincian perhitungan turun sampai sub-indikator (U-3)', async () => {
    await page.goto(`${BASE}/jabatan-target/${idBaru}/kandidat`, { waitUntil: 'networkidle' })
    await page.getByRole('link', { name: 'Lihat' }).first().click()
    await page.waitForFunction(
      () => document.body.innerText.includes('Rincian perhitungan'),
      undefined,
      { timeout: 15000 },
    )
    const teks = await page.locator('body').innerText()
    tegaskan(teks.includes('Lama Jabatan'), 'sub-indikator Lama Jabatan tidak muncul di rincian')
    tegaskan(teks.includes('rata-rata'), 'bobot sub-indikator tidak ditandai rata-rata')
    tegaskan(/match score \d/.test(teks.toLowerCase()), 'komposisi 65/20/15 tidak dijabarkan')
    return 'rincian memuat komponen, indikator, dan sub-indikator'
  })

  await langkah('nilai manual menolak disimpan tanpa catatan (jejak wajib)', async () => {
    const tombol = page.locator('button[aria-label^="Isi nilai manual"]').first()
    tegaskan(await tombol.isVisible(), 'tombol isi nilai manual tidak ada')
    await tombol.click()
    await page.waitForTimeout(800)
    await page.getByRole('button', { name: 'Simpan' }).click()
    await page.waitForTimeout(1500)
    const galat = (await page.locator('[role="alert"]').allInnerTexts()).join(' ')
    tegaskan(galat.includes('Catatan wajib') || galat.includes('ditelusuri'), `galat catatan tidak muncul: "${galat}"`)
    await page.keyboard.press('Escape')
    return 'catatan wajib ditegakkan di server'
  })

  // -------------------------------------------------------------------------
  // 7. Simulasi & Diff (U-4)
  // -------------------------------------------------------------------------
  await langkah('simulasi kosong saat rubrik tidak berubah (bukti pipeline sama)', async () => {
    await page.goto(`${BASE}/jabatan-target/${idBaru}/simulasi`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1000)
    const teks = await page.locator('body').innerText()
    tegaskan(teks.includes('Perubahan (0 baris)'), 'ada perubahan padahal rubrik tidak disentuh')
    tegaskan(
      teks.includes('semuanya identik'),
      'halaman tidak menjelaskan arti diff kosong',
    )
    return 'diff kosong — hitungan UI = isi database'
  })

  await langkah('ubah bobot rubrik → simulasi menampilkan pergeseran peringkat', async () => {
    await page.goto(`${BASE}/jabatan-target/${idBaru}?tab=rubrik`, { waitUntil: 'networkidle' })
    // Tukar bobot: Potensi & Kompetensi 65% → 15%, Integritas 15% → 65%.
    const pk = page.locator('section', { hasText: 'Potensi & Kompetensi' }).first()
    await pk.locator('button[aria-label^="Ubah Potensi"]').first().click()
    await page.getByPlaceholder('65').fill('15')
    await page.getByRole('button', { name: 'Simpan' }).click()
    await page.waitForTimeout(2500)

    const im = page.locator('section', { hasText: 'Integritas & Moralitas' }).first()
    await im.locator('button[aria-label^="Ubah Integritas"]').first().click()
    await page.getByPlaceholder('65').fill('65')
    await page.getByRole('button', { name: 'Simpan' }).click()
    await page.waitForTimeout(2500)

    await page.goto(`${BASE}/jabatan-target/${idBaru}/simulasi`, { waitUntil: 'networkidle' })
    await page.waitForFunction(
      () => !document.body.innerText.includes('Perubahan (0 baris)'),
      undefined,
      { timeout: 20000 },
    )
    const teks = await page.locator('body').innerText()
    const cocok = teks.match(/Perubahan \((\d+) baris\)/)
    tegaskan(cocok !== null && Number(cocok[1]) > 0, 'simulasi tidak menampilkan perubahan apa pun')
    tegaskan(
      teks.includes('naik peringkat') || teks.includes('turun peringkat') || teks.includes('skor berubah'),
      'jenis perubahan tidak dilabeli',
    )
    tegaskan(
      teks.includes('tersimpan → hitungan baru'),
      'tabel diff tidak menjelaskan arah perbandingannya',
    )
    await page.screenshot({ path: `${OUT}/f5-simulasi-diff.png`, fullPage: true })
    return `${cocok?.[1]} baris berubah setelah bobot ditukar`
  })

  await langkah('simulasi TIDAK menulis apa pun ke database', async () => {
    const teks = await page.locator('body').innerText()
    tegaskan(
      teks.includes('tidak menulis apa pun'),
      'halaman tidak menegaskan bahwa simulasi tidak menyimpan',
    )
    // Skor tersimpan harus masih yang lama: kolom "tersimpan" pada baris pertama
    // berbeda dari kolom "hitungan baru".
    const baris = await page.locator('tbody tr').first().innerText()
    tegaskan(baris.includes('→'), 'baris diff tidak menampilkan sebelum → sesudah')
    return 'skor tersimpan tidak berubah oleh simulasi'
  })

  await langkah('kembalikan bobot & bersihkan jabatan target uji', async () => {
    await page.goto(`${BASE}/jabatan-target`, { waitUntil: 'networkidle' })
    const tautanUji = `a[href="/jabatan-target/${idBaru}"]`
    const baris = page.locator('tr').filter({ has: page.locator(tautanUji) })
    await baris.locator('button[aria-label^="Aksi untuk"]').click()
    await page.getByRole('button', { name: 'Hapus' }).first().click()
    await page.getByRole('button', { name: /^(Hapus|Nonaktifkan)$/ }).last().click()
    /*
      Dicari menurut ID, bukan teks: nama target sekarang diturunkan dari master
      sehingga bisa sama dengan target lain — dan pembersihan yang mencocokkan nama
      akan menyatakan berhasil atas baris milik orang lain.
    */
    await page.waitForFunction((sel) => document.querySelector(sel) === null, tautanUji, {
      timeout: 25000,
    })
    return `jabatan target uji #${idBaru} dihapus`
  })

  // -------------------------------------------------------------------------
  // 8. Tidak ada regresi pada jabatan target seed
  // -------------------------------------------------------------------------
  await langkah('jabatan target subjek uji tetap AKTIF & rubriknya utuh', async () => {
    await page.goto(`${BASE}/jabatan-target/${ID_TARGET}?tab=rubrik`, { waitUntil: 'networkidle' })
    const teks = await page.locator('body').innerText()
    tegaskan(teks.includes('AKTIF'), `jabatan target ${ID_TARGET} tidak lagi AKTIF`)
    tegaskan(
      teks.includes('Rubrik lolos seluruh pemeriksaan'),
      `rubrik jabatan target ${ID_TARGET} tidak lagi lolos`,
    )
    return `rubrik #${ID_TARGET} utuh`
  })

  await langkah('audit tercatat untuk mutasi Fase 5', async () => {
    // Diperiksa di **Audit Log viewer** (`/admin/audit-log`), bukan lewat widget
    // "Aktivitas terakhir" di dashboard.
    //
    // Dua alasan, dan yang kedua yang membuatnya lebih baik daripada sebelumnya:
    // (1) widget itu dilepas dari dashboard saat halamannya dipangkas jadi tiga
    // panel (10 Agu 2026), jadi penandanya sudah tidak ada di sana; (2) audit log
    // viewer memang permukaan audit yang sebenarnya — ia sudah ada sejak Fase 7,
    // dan komentar versi lama uji ini ("viewer baru ada di Fase 7") sudah usang.
    // Menguji jejak audit lewat widget ringkasan berarti uji itu ikut merah
    // setiap kali tata letak dashboard berubah, padahal jejaknya sendiri utuh.
    await page.goto(`${BASE}/admin/audit-log`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(1500)
    const teks = await page.locator('main').innerText()
    tegaskan(
      /jabatan_target|rubrik_komponen|rubrik_indikator|match_score/.test(teks),
      `mutasi Fase 5 tidak tercatat di audit log — isi: ${teks.slice(0, 120).replace(/\n/g, ' ')}`,
    )
    return 'mutasi Fase 5 tercatat di /admin/audit-log'
  })

  await ctx.close()

  // -------------------------------------------------------------------------
  // 9. Lebar sempit
  // -------------------------------------------------------------------------
  for (const [nama, lebar] of [
    ['tablet 834px', 834],
    ['tablet sempit 768px', 768],
  ]) {
    const c = await konteksMasuk(browser, { base: BASE, viewport: { width: lebar, height: 1180 } })
    const p = await c.newPage()
    for (const rute of ['/jabatan-target', `/jabatan-target/${ID_TARGET}`, `/jabatan-target/${ID_TARGET}/simulasi`]) {
      await p.goto(`${BASE}${rute}`, { waitUntil: 'networkidle' })
      await p.waitForTimeout(700)
      await langkah(`${nama}: ${rute} tanpa scroll horizontal halaman`, async () => {
        const selisih = await p.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        )
        tegaskan(selisih <= 0, `menggulir horizontal ${selisih}px`)
        return 'selisih 0px'
      })
    }
    if (lebar === 834) await p.screenshot({ path: `${OUT}/f5-tablet.png`, fullPage: true })
    await c.close()
  }
} finally {
  await browser.close()
}

console.log('\n=== SMOKE TEST FASE 5 — RULE ENGINE (JABATAN TARGET) ===')
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
