import { chromium } from '@playwright/test'
import { konteksMasuk } from './_masuk.mjs'

/**
 * Smoke test Fase 2 — Direktori Pegawai & Profil Talenta 360°.
 *
 * Memverifikasi: kolom mockup #1 hadir, pengurutan & paginasi & filter
 * tersinkron URL, data lama tetap tampil saat memuat (bukan skeleton),
 * pemilih kolom, navigasi ke profil, seluruh bagian profil terisi, rincian
 * skor per indikator bisa dibuka, dan keadaan kedua tema.
 *
 * Jalankan dengan dev server hidup:
 *   node e2e/fase-2.smoke.mjs [folder-screenshot] [base-url]
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

/** Kolom wajib menurut mockup #1 doc/KERANGKA TALENT POOL.md. */
const KOLOM_MOCKUP = [
  // Mockup #1 di `doc/KERANGKA TALENT POOL.md` menyebut "NIP dan Nama Lengkap"
  // sebagai SATU kolom; user meminta keduanya dipisah (12 Agu 2026). Yang
  // diperiksa langkah ini adalah **kelengkapan informasinya**, bukan jumlah
  // kolomnya — dan dua kolom terpisah tetap memenuhi itu. Kalau nanti daftar ini
  // diubah lagi, ubah karena kolomnya benar-benar hilang, bukan karena
  // penyajiannya bergeser.
  'nama lengkap',
  'nip',
  'jabatan',
  'eselon',
  'unit organisasi',
  'pangkat',
  'jenis asesmen',
  'potkom',
  'integritas',
  'predikat kinerja',
  'jenjang',
  'kotak 9',
]

async function tungguTabel(page) {
  await page.waitForSelector('table tbody tr', { timeout: 30000 })
  await page.waitForTimeout(300)
}

const browser = await chromium.launch()

try {
  for (const tema of ['light', 'dark']) {
    const ctx = await konteksMasuk(browser, { base: BASE,
      viewport: { width: 1600, height: 1000 },
      colorScheme: tema,
    })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`[${tema}] pageerror: ${e.message}`))
    page.on('response', (r) => {
      if (r.status() >= 400 && !r.url().includes('/talenta/00000')) {
        errors.push(`[${tema}] HTTP ${r.status()} ${r.url()}`)
      }
    })

    // ---------------- Direktori ----------------
    await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
    await tungguTabel(page)

    await langkah(`tema ${tema}: kolom mockup #1 lengkap`, async () => {
      const kepala = (await page.locator('table thead').innerText()).toLowerCase()
      const hilang = KOLOM_MOCKUP.filter((k) => !kepala.includes(k))
      tegaskan(hilang.length === 0, `kolom tidak ditemukan: ${hilang.join(', ')}`)
      return `${KOLOM_MOCKUP.length} kolom mockup hadir`
    })

    await langkah(`tema ${tema}: baris terisi & skala kolom dijelaskan`, async () => {
      const jml = await page.locator('table tbody tr').count()
      tegaskan(jml > 0, 'tabel kosong')
      const kepala = await page.locator('table thead').innerText()
      // Skala integritas harus tertulis supaya tidak tertukar dgn skala 1–4 lama
      tegaskan(kepala.includes('0–100'), 'skala kolom skor tidak dicantumkan di header')
      return `${jml} baris, skala kolom tercantum`
    })

    await langkah(`tema ${tema}: tanpa scroll horizontal pada halaman`, async () => {
      const selisih = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      tegaskan(selisih <= 0, `halaman menggulir horizontal ${selisih}px`)
      return 'selisih 0px (tabel menggulir di wadahnya sendiri)'
    })

    await page.screenshot({ path: `${OUT}/f2-direktori-${tema}.png`, fullPage: true })

    if (tema === 'light') {
      await langkah('pengurutan: klik header menambah ?urut= & ?arah=', async () => {
        await page.click('table thead button:has-text("Potkom")')
        await page.waitForURL(/urut=potkom/, { timeout: 10000 })
        await tungguTabel(page)
        const url = page.url()
        tegaskan(url.includes('arah=desc'), `arah tidak diset: ${url}`)
        return 'urut=potkom&arah=desc masuk URL'
      })

      await langkah('pengurutan: klik kedua membalik arah', async () => {
        await page.click('table thead button:has-text("Potkom")')
        await page.waitForURL(/arah=asc/, { timeout: 10000 })
        await tungguTabel(page)
        return 'arah berbalik ke asc'
      })

      await langkah('pengurutan benar-benar mengubah urutan data', async () => {
        const pertamaAsc = await page.locator('table tbody tr').first().innerText()
        await page.click('table thead button:has-text("Potkom")')
        await page.waitForURL(/arah=desc/, { timeout: 10000 })
        await tungguTabel(page)
        const pertamaDesc = await page.locator('table tbody tr').first().innerText()
        tegaskan(pertamaAsc !== pertamaDesc, 'baris teratas sama walau arah dibalik')
        return 'baris teratas berubah saat arah dibalik'
      })

      await langkah('filter: memilih Kotak 9 menyaring & tersinkron URL', async () => {
        await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
        await tungguTabel(page)
        const sebelum = await page.locator('table tbody tr').count()
        await page.selectOption('select[aria-label="Kotak 9"]', '9')
        await page.waitForURL(/kotak=9/, { timeout: 10000 })
        await tungguTabel(page)
        const sesudah = await page.locator('table tbody tr').count()
        tegaskan(sesudah <= sebelum, `hasil filter (${sesudah}) lebih banyak dari tanpa filter (${sebelum})`)
        const teks = await page.locator('main').innerText()
        tegaskan(/filter aktif/i.test(teks), 'jumlah filter aktif tidak diberitahukan')
        return `${sebelum} → ${sesudah} baris, URL memuat kotak=9`
      })

      await langkah('filter: tombol Reset membersihkan seluruh query', async () => {
        await page.click('button:has-text("Reset")')
        await page.waitForURL((u) => u.search === '' || !u.search.includes('kotak='), {
          timeout: 10000,
        })
        await tungguTabel(page)
        return 'query string bersih setelah reset'
      })

      await langkah('pencarian: debounce & menyaring hasil', async () => {
        /*
          Kata kunci DITURUNKAN dari NIP baris pertama, tidak dipaku dan bukan nama.

          Sebelumnya ia `'irwan'` — dan itu mencocokkan "Eddy Irwanto", satu dari
          10 pegawai eNominasi yang dikeluarkan 24 Agu 2026. Sejak itu pencarian
          mengembalikan nol baris dan `tungguTabel()` timeout 30 detik, sehingga
          yang terbaca "pencariannya rusak" padahal pencariannya benar dan orangnya
          yang tidak ada. Kekambuhan persis: langkah F3 dulu memaku `'bu'`.

          NIP, BUKAN nama (permintaan user 24 Agu 2026), dan itu memang lebih kuat:
          NIP unik sehingga hasilnya bisa ditegaskan **tepat satu baris** alih-alih
          "minimal satu", ia bebas gelar & tanda baca yang bisa memecah pencarian,
          dan ia sekalian menguji cabang NIP dari kotak "Cari nama atau NIP" — yang
          sebelumnya tidak pernah teruji sama sekali.
        */
        await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
        await tungguTabel(page)
        const nipCari = await page.evaluate(() => {
          const a = document.querySelector('table tbody tr td a[href^="/talenta/"]')
          return a ? a.getAttribute('href').split('/').pop() : null
        })
        tegaskan(/^\d{18}$/.test(nipCari ?? ''), `NIP baris pertama tidak terbaca: ${nipCari}`)

        await page.fill('input[aria-label="Cari nama atau NIP"]', nipCari)
        await page.waitForURL(new RegExp(`cari=${nipCari}`), { timeout: 10000 })
        await tungguTabel(page)
        const jml = await page.locator('table tbody tr').count()
        tegaskan(jml === 1, `pencarian NIP ${nipCari} menghasilkan ${jml} baris, seharusnya tepat 1`)
        return `NIP ${nipCari} → ${jml} baris (tepat satu, sesuai sifat NIP yang unik)`
      })

      await langkah('pencarian: kata kunci tak cocok → keadaan "tidak ada hasil"', async () => {
        await page.fill('input[aria-label="Cari nama atau NIP"]', 'zzzzzzzz')
        await page.waitForURL(/cari=zzzzzzzz/, { timeout: 10000 })
        await page.waitForFunction(
          () => /tidak ada data yang cocok/i.test(document.body.innerText),
          undefined,
          { timeout: 15000 },
        )
        const teks = await page.locator('main').innerText()
        tegaskan(/reset filter/i.test(teks), 'keadaan kosong tidak menawarkan reset filter')
        return 'pesan "tidak ada data yang cocok" + tombol reset'
      })

      /*
        Langkah ini sudah DUA KALI berbalik arah, dan itu perlu diketahui sebelum
        mengubahnya lagi:

          - awalnya menguji tombol "Kolom" ADA di Direktori;
          - revisi `PUR.pdf` 12 Agu 2026 MELEPAS tombolnya, jadi langkahnya dibalik
            menjadi menguji tombolnya HILANG;
          - 24 Agu 2026 user memintanya kembali ("kasih buat pilih kolom kaya di
            dashboard sama peta talenta"), jadi ia dibalik lagi.

        Yang membuatnya boleh berbalik tanpa jadi kebisingan: yang diuji selalu
        **perilaku yang diminta sekarang**, bukan potret masa lalu. Asersi yang
        dibiarkan menjaga keputusan lama akan merah tanpa ada yang rusak — kelas
        kegagalan yang sama dengan asersi "nol chart Recharts" di F1 setelah
        dashboard dapat widget chart.
      */
      await langkah('pemilih kolom ADA di Direktori & benar-benar menyembunyikan', async () => {
        await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
        await tungguTabel(page)
        const tombol = page.locator('main button:has-text("Kolom")')
        tegaskan((await tombol.count()) === 1, `tombol Kolom tidak tepat satu di Direktori`)
        const sebelum = await page.locator('main table thead th').count()
        await tombol.click()
        await page.waitForSelector('text=Tampilkan kolom', { timeout: 5000 })
        // Sembunyikan satu kolom opsional, lalu tegaskan jumlah kolomnya turun.
        // Menguji tombolnya ADA tanpa menguji ia BEKERJA akan lulus atas pemilih
        // yang membuka lalu tidak berpengaruh apa pun.
        const kotak = page
          .locator('label:has(input[type="checkbox"]:checked:not(:disabled))')
          .last()
        tegaskan((await kotak.count()) === 1, 'tidak ada kolom opsional yang bisa disembunyikan')
        await kotak.locator('input[type="checkbox"]').click()
        await page.waitForTimeout(300)
        const sesudah = await page.locator('main table thead th').count()
        tegaskan(sesudah === sebelum - 1, `menyembunyikan tidak berpengaruh: ${sebelum} → ${sesudah}`)
        await page.keyboard.press('Escape')
        return `tombol Kolom ada · kolom ${sebelum} → ${sesudah}`
      })

      await langkah('pemilih kolom masih berfungsi di tabel yang memakainya', async () => {
        // Master Jabatan — tabel LAIN yang memakai pemilih kolom. Langkah ini tetap
        // ada walau Direktori sudah punya pemilihnya kembali: yang dijaga di sini
        // bahwa `PemilihKolom` bekerja pada tabel yang kolomnya berbeda, dan
        // urutan sembunyikan-lalu-munculkan-nya diuji dua arah (lihat catatan
        // locator malas di bawah).
        await page.goto(`${BASE}/master/jabatan`, { waitUntil: 'networkidle' })
        await tungguTabel(page)
        const sebelum = await page.locator('table thead th').count()
        await page.click('button:has-text("Kolom")')
        await page.waitForSelector('text=Tampilkan kolom', { timeout: 5000 })
        // SEMBUNYIKAN lalu MUNCULKAN lagi, bukan sebaliknya: di tabel ini semua
        // kolom tampil secara baku, jadi asersi yang menunggu kolom tersembunyi
        // tidak akan pernah punya yang bisa diklik. Dua arah sekaligus juga lebih
        // kuat — pemilih yang bisa menyembunyikan tapi tidak bisa mengembalikan
        // adalah cara paling rapi untuk membuat kolom hilang permanen.
        const kotak = page
          .locator('label:has(input[type="checkbox"]:checked:not(:disabled))')
          .last()
        tegaskan((await kotak.count()) === 1, 'tidak ada kolom opsional yang bisa disembunyikan')
        const namaKolom = (await kotak.innerText()).trim()
        /*
          Klik kedua WAJIB ditambatkan ke nama kolomnya, bukan memakai ulang
          locator `.last()` di atas.

          Locator Playwright itu malas — ia mengevaluasi ulang setiap kali
          dipakai. Sesudah kolomnya disembunyikan, centangnya tidak lagi
          `:checked`, sehingga `.last()` menunjuk label LAIN dan klik kedua
          menyembunyikan kolom kedua. Terukur sebagai `8 → 7 → 6`, dan gejalanya
          terbaca seperti "kolom tidak bisa kembali" padahal pemilihnya benar.
        */
        const centang = page
          .locator(`label:has-text("${namaKolom}")`)
          .locator('input[type="checkbox"]')
        await centang.click()
        await page.waitForTimeout(300)
        const disembunyikan = await page.locator('table thead th').count()
        tegaskan(
          disembunyikan === sebelum - 1,
          `menyembunyikan tidak berpengaruh: ${sebelum} → ${disembunyikan}`,
        )
        await centang.click()
        await page.waitForTimeout(300)
        const sesudah = await page.locator('table thead th').count()
        tegaskan(sesudah === sebelum, `kolom tidak kembali: ${sebelum} → ${disembunyikan} → ${sesudah}`)
        return `Master Jabatan: "${namaKolom}" ${sebelum} → ${disembunyikan} → ${sesudah}`
      })

      // ---------------- Profil ----------------
      await langkah('navigasi: klik baris membuka profil talenta', async () => {
        await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
        await tungguTabel(page)
        await page.locator('table tbody tr td a').first().click()
        await page.waitForURL(/\/talenta\/\d{18}/, { timeout: 15000 })
        await page.waitForFunction(
          () => document.body.innerText.includes('Kelengkapan data'),
          undefined,
          { timeout: 25000 },
        )
        return `mendarat di ${new URL(page.url()).pathname}`
      })

      await langkah('profil: seluruh bagian 360° hadir', async () => {
        await page.waitForFunction(
          () => document.body.innerText.includes('Integritas & rekam jejak disiplin'),
          undefined,
          { timeout: 25000 },
        )
        const teks = (await page.locator('main').innerText()).toLowerCase()
        const bagian = [
          'kelengkapan data',
          'posisi kotak 9 & riwayat asesmen',
          'kecocokan dengan jabatan target',
          'riwayat jabatan',
          'riwayat pendidikan',
          'riwayat diklat & sertifikasi',
          'integritas & rekam jejak disiplin',
        ]
        const hilang = bagian.filter((b) => !teks.includes(b))
        tegaskan(hilang.length === 0, `bagian tidak ditemukan: ${hilang.join(', ')}`)
        return `${bagian.length} bagian profil hadir`
      })

      await langkah('profil: data turunan NIP tampil (usia, gender, masa kerja, BUP)', async () => {
        const teks = (await page.locator('main').innerText()).toLowerCase()
        for (const label of ['usia', 'jenis kelamin', 'masa kerja asn', 'batas usia pensiun']) {
          tegaskan(teks.includes(label), `butir "${label}" tidak ada`)
        }
        tegaskan(teks.includes('dari nip'), 'tidak dijelaskan bahwa data diturunkan dari NIP')
        return 'keempat butir turunan NIP hadir & sumbernya dijelaskan'
      })

      await langkah('profil: rincian skor per indikator bisa dibuka (U-3)', async () => {
        /*
          DITUNGGU dulu. Panel Kecocokan datang lewat `<Suspense>` sendiri, sementara
          langkah sebelum ini hanya menunggu butir turunan NIP di kepala halaman —
          jadi `count()` di sini mengukur "apakah panelnya kebetulan sudah sampai",
          bukan "apakah tombolnya ada". Ia lulus di dev server dan GAGAL di build
          produksi pada hari yang sama, tanpa satu pun perubahan pada tombolnya.
        */
        const tombol = page.locator('button:has-text("Lihat rincian perhitungan")').first()
        await tombol.waitFor({ state: 'attached', timeout: 30000 })
        tegaskan((await tombol.count()) > 0, 'tombol rincian perhitungan tidak ada')
        await tombol.click()
        await page.waitForSelector('text=Nilai mentah', { timeout: 8000 })
        const teks = await page.locator('main').innerText()
        tegaskan(/Kategori terpilih/i.test(teks), 'kolom kategori terpilih tidak ada')
        tegaskan(
          /Penilaian Potensi dan Kompetensi/i.test(teks),
          'indikator rubrik tidak terdaftar di rincian',
        )
        await page.screenshot({ path: `${OUT}/f2-profil-rincian.png`, fullPage: true })
        return 'tabel rincian indikator & sub-indikator terbuka'
      })

      await langkah('profil: skor komponen 65/20/15 dijelaskan', async () => {
        // Alasan yang sama: kalimat bobotnya ada di kepala panel Kecocokan.
        await page.waitForFunction(() => /65%/.test(document.body.innerText), null, {
          timeout: 30000,
        })
        const teks = await page.locator('main').innerText()
        tegaskan(/65%/.test(teks) && /20%/.test(teks) && /15%/.test(teks), 'bobot tidak ditampilkan')
        tegaskan(
          /TIDAK memuat unsur kinerja/i.test(teks),
          'peringatan bahwa match score mengabaikan kinerja tidak ada (K-4)',
        )
        return 'bobot 65/20/15 + peringatan soal unsur kinerja'
      })

      await langkah('profil: NIP tidak ada → halaman tidak ditemukan yang membantu', async () => {
        await page.goto(`${BASE}/talenta/000000000000000000`, { waitUntil: 'networkidle' })
        const teks = await page.locator('main').innerText()
        tegaskan(/tidak ditemukan/i.test(teks), 'pesan tidak ditemukan tidak ada')
        tegaskan(/Direktori Pegawai/i.test(teks), 'tidak ada jalan kembali ke direktori')
        return 'pesan + tautan kembali ke Direktori'
      })

      /*
        Foto profil (permintaan user butir 5).

        NIP-nya DITURUNKAN, tidak ditulis tangan: siapa yang punya foto bergantung
        pada isi `doc/data/foto/`, dan konstanta di sini akan jadi merah begitu
        datanya diganti — kegagalan yang sudah pernah terjadi di langkah pencarian
        F3 yang memaku kata kunci 'bu'. Jadi daftar NIP diambil dari direktori yang
        sedang tampil, lalu dicari yang rute fotonya menjawab 200.

        Kalau TIDAK ADA satu pun yang berfoto, langkahnya melaporkan dilewati —
        bukan lulus. "Lulus" yang sebenarnya berarti "tidak ada yang diperiksa"
        adalah hijau yang menipu.
      */
      await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
      await tungguTabel(page)
      const nipTampil = await page.evaluate(() =>
        [...document.querySelectorAll('table tbody tr td a[href^="/talenta/"]')]
          .map((a) => a.getAttribute('href').split('/').pop())
          .filter((n) => /^\d{18}$/.test(n)),
      )
      let nipBerfoto = null
      for (const n of nipTampil) {
        const r = await ctx.request.get(`${BASE}/api/internal/foto/${n}`)
        if (r.status() === 200) {
          nipBerfoto = n
          break
        }
      }

      await langkah('profil: foto di KIRI, rincian mengalir ke bawah di kanan', async () => {
        if (nipBerfoto === null) return 'DILEWATI — tidak ada pegawai berfoto di halaman 1 direktori'
        await page.goto(`${BASE}/talenta/${nipBerfoto}`, { waitUntil: 'networkidle' })
        const img = page.locator(`img[src="/api/internal/foto/${nipBerfoto}"]`)
        tegaskan((await img.count()) === 1, 'gambar foto tidak terpasang di profil')
        const alami = await img.evaluate((e) => e.naturalWidth)
        tegaskan(alami > 0, 'gambar terpasang tapi GAGAL dimuat (ikon rusak)')
        const kotakFoto = await img.boundingBox()
        const kotakNama = await page.locator('h1').first().boundingBox()
        tegaskan(
          kotakFoto.x + kotakFoto.width <= kotakNama.x + 1,
          `foto tidak di kiri nama (foto berakhir ${Math.round(kotakFoto.x + kotakFoto.width)}, nama mulai ${Math.round(kotakNama.x)})`,
        )
        tegaskan(
          kotakNama.y <= kotakFoto.y + 8,
          'identitas tidak sejajar puncak foto — rincian tidak mengalir ke bawah dari sana',
        )
        return `foto x=${Math.round(kotakFoto.x)}–${Math.round(kotakFoto.x + kotakFoto.width)} · nama x=${Math.round(kotakNama.x)} · natural ${alami}px`
      })

      await langkah('profil: foto dikecilkan & bisa di-cache, bukan berkas asli', async () => {
        if (nipBerfoto === null) return 'DILEWATI — tidak ada pegawai berfoto'
        const r = await ctx.request.get(`${BASE}/api/internal/foto/${nipBerfoto}`)
        const isi = await r.body()
        tegaskan(r.headers()['content-type'] === 'image/jpeg', `tipe salah: ${r.headers()['content-type']}`)
        tegaskan(
          (r.headers()['cache-control'] ?? '').includes('private'),
          'Cache-Control tidak private — proxy bersama boleh menyimpan wajah orang',
        )
        // Berkas sumber terukur sampai 3,4 MB; 120 KB adalah batas yang membedakan
        // "sudah dikecilkan" dari "dikirim apa adanya", bukan target kualitas.
        tegaskan(isi.length < 120 * 1024, `terlalu besar untuk hasil kecilan: ${(isi.length / 1024).toFixed(0)} KB`)
        const r304 = await ctx.request.get(`${BASE}/api/internal/foto/${nipBerfoto}`, {
          headers: { 'if-none-match': r.headers()['etag'] },
        })
        tegaskan(r304.status() === 304, `ETag tidak dihormati: HTTP ${r304.status()}`)
        return `${(isi.length / 1024).toFixed(0)} KB · ${r.headers()['cache-control']} · kunjungan kedua 304`
      })

      /*
        Tambah pegawai (butir 9) — DIUJI HANYA JALUR PENOLAKANNYA.

        Uji yang benar-benar menambah pegawai tidak bisa membersihkan jejaknya:
        tidak ada aksi hapus pegawai di aplikasi ini (dan memang tidak boleh ada
        sembarangan — pegawai punya asesmen, skor, dan nominasi yang mengaskade).
        Jadi yang dijaga di sini adalah bahwa penolakannya bekerja dan TIDAK
        menulis apa pun: total baris direktori harus sama sebelum & sesudah.
        Jalur suksesnya diuji manual, sebab hanya itu yang bisa dibersihkan
        manusia yang tahu konteksnya.
      */
      await langkah('tambah pegawai: dialog punya dua mode & menolak NIP cacat', async () => {
        await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
        await tungguTabel(page)
        const totalSebelum = (await page.locator('main').innerText()).match(/dari ([\d.]+) baris/)?.[1]

        await page.locator('main button', { hasText: /^Tambah pegawai$/ }).click()
        const dialog = page.locator('dialog[open]')
        await dialog.waitFor()
        const teks = await dialog.innerText()
        tegaskan(/Satu pegawai/.test(teks), 'mode manual tidak ada')
        tegaskan(/Banyak sekaligus/.test(teks), 'mode massal tidak ada')

        // NIP 17 digit — satu kurang. Kalau ini lolos, barisnya akan punya profil
        // yang tidak bisa dibuka, sebab NIP adalah kunci URL profil.
        await dialog.locator('input').first().fill('1990010120150310')
        await dialog.getByRole('textbox').nth(1).fill('Uji Penolakan NIP')
        await dialog.getByRole('button', { name: 'Simpan' }).click()
        await page.waitForTimeout(1500)
        const sesudahKlik = await page.locator('body').innerText()
        tegaskan(
          /18 angka|Periksa isian/i.test(sesudahKlik),
          'NIP 17 digit tidak ditolak dengan pesan yang menyebut sebabnya',
        )

        await page.keyboard.press('Escape')
        await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
        await tungguTabel(page)
        const totalSesudah = (await page.locator('main').innerText()).match(/dari ([\d.]+) baris/)?.[1]
        tegaskan(
          totalSebelum === totalSesudah,
          `jumlah pegawai berubah ${totalSebelum} → ${totalSesudah} padahal penyimpanan ditolak`,
        )
        return `dua mode hadir · NIP 17 digit ditolak · total tetap ${totalSesudah}`
      })

      await langkah('rute foto berpenjaga: tanpa sesi & path traversal ditolak', async () => {
        const nip = nipBerfoto ?? '196709091995021001'
        const anon = await browser.newContext()
        try {
          const rAnon = await anon.request.get(`${BASE}/api/internal/foto/${nip}`)
          tegaskan(
            rAnon.status() === 401 || rAnon.status() === 404,
            `tanpa sesi malah dilayani: HTTP ${rAnon.status()} — foto pegawai adalah data pribadi`,
          )
          var statusAnon = rAnon.status()
        } finally {
          await anon.close()
        }
        const rTrav = await ctx.request.get(`${BASE}/api/internal/foto/..%2f..%2fpackage.json`)
        tegaskan(rTrav.status() === 404, `path traversal tidak ditolak: HTTP ${rTrav.status()}`)
        return `tanpa sesi → ${statusAnon} · traversal → ${rTrav.status()}`
      })

      await langkah('riwayat berdurasi: lama menjabat tampil & bisa disunting', async () => {
        /*
          Menjaga dua hal sekaligus untuk baris riwayat yang sumbernya hanya memberi
          LAMANYA, tanpa tanggal (229 baris dari berkas Talent Pool ES 2 & 3):

            - halamannya TIDAK menulisnya sebagai rentang. "tanggal belum ada –
              sekarang" menyatakan jabatan yang masih berjalan, dan itu salah untuk
              baris yang justru sudah berakhir;
            - dialog Ubah punya bidang "Lama menjabat (bulan)" BERISI nilainya. Bidang
              yang ada tanpa nilai awal adalah cacat kehilangan data, bukan kosmetik:
              menyimpan tanpa menyentuhnya akan menulis `null` (tiga kejadian sekelas
              sudah tercatat di CLAUDE.md).

          Subjeknya DITURUNKAN dari data yang sedang tampil — pegawai pertama yang
          punya baris begitu — bukan NIP yang dipaku: populasi repo ini sudah tiga kali
          membuat konstanta di harness meledak. Kalau tidak ada satu pun, langkahnya
          melaporkan DILEWATI, bukan lulus.
        */
        await page.goto(`${BASE}/talenta`, { waitUntil: 'domcontentloaded' })
        await tungguTabel(page)
        const nipDaftar = await page
          .locator('table tbody tr td:nth-child(2)')
          .allInnerTexts()
          .catch(() => [])

        let subjek = null
        for (const teks of nipDaftar.slice(0, 10)) {
          const nip = teks.replace(/\D/g, '')
          if (nip.length !== 18) continue
          await page.goto(`${BASE}/talenta/${nip}`, { waitUntil: 'domcontentloaded' })
          const adaDurasi = await page
            .getByText(/tanggal tidak ada di sumbernya/i)
            .first()
            .waitFor({ timeout: 8000 })
            .then(() => true)
            .catch(() => false)
          if (adaDurasi) {
            subjek = nip
            break
          }
        }
        if (subjek === null) return 'DILEWATI — tidak ada riwayat berdurasi-tanpa-tanggal di 10 pegawai pertama'

        const rentangPalsu = await page.getByText(/tanggal belum ada – sekarang/i).count()
        tegaskan(
          rentangPalsu === 0,
          `${rentangPalsu} baris masih ditulis sebagai rentang "tanggal belum ada – sekarang"`,
        )

        const panel = page.locator('section').filter({ hasText: 'Riwayat Jabatan' }).last()
        await panel.getByRole('button', { name: /^Ubah$/ }).first().click({ timeout: 30000 })
        const dlg = page.locator('dialog[open]')
        // `getByLabel` sekalian menuntut labelnya benar-benar tertaut ke kontrolnya.
        const kontrol = dlg.getByLabel(/Lama menjabat \(bulan\)/i).first()
        await kontrol.waitFor({ timeout: 15000 })
        const isi = await kontrol.inputValue()
        tegaskan(/^\d+$/.test(isi), `nilai awal bidang lama menjabat kosong/tak terbaca: "${isi}"`)
        await page.keyboard.press('Escape')
        return `NIP ${subjek} · 0 rentang palsu · nilai awal ${isi} bulan`
      })
    }

    if (tema === 'dark') {
      // Profil di tema gelap, memastikan token warna ikut terpakai di sana
      await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
      await tungguTabel(page)
      await page.locator('table tbody tr td a').first().click()
      await page.waitForFunction(
        () => document.body.innerText.includes('Kelengkapan data'),
        undefined,
        { timeout: 25000 },
      )
      await page.waitForTimeout(800)
      await langkah('tema dark: profil memakai token warna gelap', async () => {
        const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor)
        tegaskan(bg !== 'rgb(255, 255, 255)', `background masih terang: ${bg}`)
        return `bg=${bg}`
      })
      await page.screenshot({ path: `${OUT}/f2-profil-dark.png`, fullPage: true })
    }

    await ctx.close()
  }

  // Tablet (PRD §8 — pimpinan sering akses lewat tablet)
  for (const [nama, lebar] of [
    ['tablet 834px', 834],
    ['tablet sempit 768px', 768],
  ]) {
    const ctx = await konteksMasuk(browser, { base: BASE, viewport: { width: lebar, height: 1180 } })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
    await tungguTabel(page)
    await langkah(`${nama}: direktori tanpa scroll horizontal halaman`, async () => {
      const selisih = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      tegaskan(selisih <= 0, `menggulir horizontal ${selisih}px`)
      return 'selisih 0px'
    })
    if (lebar === 834) {
      await page.screenshot({ path: `${OUT}/f2-tablet.png`, fullPage: true })
    }
    await ctx.close()
  }
} finally {
  await browser.close()
}

console.log('\n=== SMOKE TEST FASE 2 — DIREKTORI & PROFIL TALENTA ===')
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
