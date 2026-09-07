import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * Penjaga STRUKTURAL: setiap server action wajib punya gerbang peran.
 *
 * ## Kenapa uji struktural, bukan uji perilaku
 *
 * Server action tidak punya URL yang bisa diketik — id-nya terenkripsi dan lahir
 * saat build — jadi "coba akses sebagai Viewer" tidak bisa ditulis sebagai uji
 * seperti pada halaman. Risiko nyatanya juga bukan gerbang yang salah, melainkan
 * **aksi baru yang lupa dipasangi gerbang**: ia jalan sempurna di tangan
 * pengembang yang selalu Super Admin, dan baru terlihat ketika seseorang berperan
 * rendah memicunya di produksi.
 *
 * Uji ini membaca berkas `lib/aksi/*.ts` dan menuntut setiap
 * `export async function` memanggil `gerbangPeran(` atau
 * `gerbangPeranDenganPengguna(`. Kasarnya disengaja: ia tidak memeriksa peran
 * MANA yang benar (itu keputusan produk, dan PRD §6 tempatnya), hanya bahwa
 * keputusan itu diambil sama sekali.
 *
 * ## Pengecualian ditulis satu per satu, beserta alasannya
 *
 * Daftar di bawah bukan "yang kebetulan tidak punya gerbang" melainkan yang
 * memang TIDAK BOLEH punya — kalau `masuk()` bergerbang peran, tidak ada yang
 * bisa masuk sama sekali. Menambah nama ke daftar ini harus terasa berat, dan
 * itulah gunanya ia ada di sini alih-alih jadi pengecualian implisit.
 */

const DIR = join(process.cwd(), 'lib/aksi')

/** Aksi yang SENGAJA tanpa gerbang peran, beserta alasannya masing-masing. */
const TANPA_GERBANG: Record<string, string> = {
  // — auth.ts: gerbang peran mustahil di sini —
  masuk: 'Belum ada sesi saat dipanggil; gerbang peran akan mengunci semua orang.',
  keluar: 'Mengakhiri sesi sendiri. Peran apa pun boleh keluar.',
  penggunaSekarang: 'Pembacaan sesi sendiri, bukan mutasi.',
  gantiSandiSaya: 'Mengubah sandi SENDIRI — dijaga dengan verifikasi sandi lama, bukan peran.',
  cabutSesiSaya: 'Mencabut sesi SENDIRI. Membatasinya per peran tidak punya arti.',
  mintaResetSandi:
    'Dipanggil justru oleh yang TIDAK bisa masuk. Dijaga rate-limit & alur verifikasi, bukan peran.',
  // — suksesi.ts: cakupannya diri sendiri, bukan peran —
  tandaiNotifikasiDibaca:
    'Menandai notifikasi MILIK SENDIRI; kuerinya menyaring `user_id` sesi, jadi peran tidak menambah apa pun.',
  tandaiSemuaDibaca: 'Sama seperti di atas — cakupannya notifikasi milik pengguna sesi.',
}

/**
 * Berkas `lib/aksi/` yang BUKAN berkas server action, beserta alasannya.
 *
 * Penanda sebenarnya adalah arahan `'use server'`: tanpanya Next tidak menjadikan
 * ekspornya server action sama sekali, jadi menuntut gerbang peran di sana salah
 * sasaran. Namun menyaring "yang tidak punya `'use server'`" saja berbahaya —
 * berkas aksi SUNGGUHAN yang lupa arahannya akan lolos tanpa suara, dan justru
 * berkas itu yang paling perlu ditemukan. Karena itu daftarnya ditulis eksplisit
 * dan diuji (`daftar bukan-aksi cocok dengan kenyataan` di bawah): berkas baru
 * tanpa `'use server'` membuat uji GAGAL sampai seseorang memutuskan ia memang
 * penolong atau memang aksi yang lupa arahannya.
 */
const BUKAN_AKSI: Record<string, string> = {
  'gerbang.ts': 'Mendefinisikan gerbangnya sendiri.',
  'hasil.ts': 'Hanya bentuk balasan (tipe & pembungkus), tidak menyentuh data.',
  'lingkup-data.ts':
    'Penolong `server-only` untuk penjaga lingkup unit; dipanggil DARI dalam aksi yang sudah bergerbang, bukan dari klien.',
}

function fileTs(): string[] {
  return readdirSync(DIR).filter((f) => f.endsWith('.ts') && !f.endsWith('.test.ts'))
}

function fileAksi(): string[] {
  return fileTs().filter((f) => !(f in BUKAN_AKSI))
}

interface Aksi {
  nama: string
  berkas: string
  bergerbang: boolean
}

function aksiDalam(berkas: string): Aksi[] {
  const isi = readFileSync(join(DIR, berkas), 'utf8')
  // Dipotong per `export async function`; badan tiap aksi = sampai export berikutnya.
  const bagian = isi.split(/^export async function /m)
  return bagian.slice(1).map((b) => {
    const nama = b.slice(0, b.indexOf('(')).trim()
    const badan = b.split(/^export /m)[0] ?? b
    return { nama, berkas, bergerbang: /gerbangPeran(DenganPengguna)?\(/.test(badan) }
  })
}

describe('gerbang peran server action', () => {
  const semua = fileAksi().flatMap(aksiDalam)

  it('daftar bukan-aksi cocok dengan kenyataan', () => {
    // Arah 1: setiap berkas yang dikecualikan memang tidak berarahan `'use server'`.
    // Kalau ia justru berarahan, ia aksi sungguhan dan tidak boleh lolos pemeriksaan.
    for (const f of Object.keys(BUKAN_AKSI)) {
      expect(fileTs(), `${f} terdaftar di BUKAN_AKSI tapi berkasnya tidak ada lagi`).toContain(f)
      expect(
        readFileSync(join(DIR, f), 'utf8').includes("'use server'"),
        `${f} ternyata berarahan 'use server' — ia aksi sungguhan, keluarkan dari BUKAN_AKSI`,
      ).toBe(false)
    }
    // Arah 2: tidak ada berkas TANPA `'use server'` yang belum diputuskan. Ini yang
    // menangkap berkas aksi baru yang lupa arahannya — bukan penolong, tapi aksi rusak.
    const tanpaArahan = fileTs().filter(
      (f) => !readFileSync(join(DIR, f), 'utf8').includes("'use server'"),
    )
    expect(
      tanpaArahan.filter((f) => !(f in BUKAN_AKSI)),
      "berkas lib/aksi tanpa arahan 'use server' — kalau ia penolong, daftarkan di BUKAN_AKSI; kalau ia aksi, tambahkan arahannya",
    ).toEqual([])
  })

  it('menemukan aksi untuk diperiksa (kontrol positif)', () => {
    // Tanpa ini, regex yang rusak akan membuat seluruh uji "lulus" atas nol aksi.
    expect(semua.length).toBeGreaterThan(30)
  })

  it('setiap server action memanggil gerbangPeran, kecuali yang terdaftar', () => {
    const bolong = semua.filter((a) => !a.bergerbang && !(a.nama in TANPA_GERBANG))
    expect(
      bolong.map((a) => `${a.berkas}:${a.nama}`),
      'aksi tanpa gerbang peran — tambahkan gerbangPeran(), atau daftarkan di TANPA_GERBANG beserta alasannya',
    ).toEqual([])
  })

  it('daftar pengecualian tidak memuat nama yang sudah tidak ada', () => {
    // Pengecualian basi membuat aksi baru bernama sama lolos tanpa disadari.
    const nama = new Set(semua.map((a) => a.nama))
    const basi = Object.keys(TANPA_GERBANG).filter((n) => !nama.has(n))
    expect(basi, 'pengecualian menunjuk aksi yang sudah tidak ada').toEqual([])
  })

  it('aksi tulis pegawai yang baru ikut bergerbang', () => {
    // Kontrol khusus: dua aksi ini ditambahkan 22 Agu 2026 (butir 9) dan menulis
    // ke tabel `pegawai`. Disebut namanya supaya kalau suatu hari gerbangnya
    // dilepas "sementara", yang merah adalah uji dengan nama yang jelas.
    for (const n of ['tambahPegawai', 'tambahPegawaiMassal']) {
      const a = semua.find((x) => x.nama === n)
      expect(a, `${n} tidak ditemukan di lib/aksi`).toBeDefined()
      expect(a!.bergerbang, `${n} tanpa gerbang peran`).toBe(true)
    }
  })
})
