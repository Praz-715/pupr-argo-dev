import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

/**
 * Setiap jalur tulis di halaman PROFIL wajib ikut menyinkronkan skor.
 *
 * Permintaan pemilik proses 1 Sep 2026: *"pastiin di profil pegawai semua butir
 * revisi udah bisa sinkron ya termasuk saat ubah data manual di profil pegawai"*
 * dan *"pastiin tiap ada write juga pengaruh ke db dan ke perhitungan jangan cuma
 * di ui aja"*.
 *
 * ## Kenapa uji STRUKTURAL, bukan uji perilaku
 *
 * Server action tidak punya URL yang bisa dipanggil dari uji unit, dan menjalankan
 * keenamnya lewat browser berarti uji yang butuh DB, sesi, dan build produksi —
 * terlalu mahal untuk dijalankan tiap kali. Yang ingin dijaga di sini juga bukan
 * "hitungannya benar" (itu tugas `verifikasi:skoring`), melainkan **tidak ada
 * jalur tulis yang lupa** — dan kelalaian paling mudah dijaga dengan membaca
 * berkasnya. Alasan yang sama dengan `lib/aksi/gerbang.test.ts`.
 *
 * ## Bentuk kegagalan yang uji ini ada untuk mencegah
 *
 * `match_score` kolom TERSIMPAN. Jalur tulis yang menyimpan tanpa menghitung ulang
 * **tidak menghasilkan galat apa pun**: datanya berubah di layar, skornya tidak,
 * dan satu halaman memajang dua angka yang bertentangan. Terukur sebelum perbaikan:
 * 6 dari 7 aksi profil begitu.
 */

/**
 * Berkas aksi yang menyentuh masukan penilaian. `skoring.ts` ikut sejak 1 Sep 2026:
 * "Isi manual" di halaman profil hidup di sana, bukan di `profil.ts`, jadi penjaga
 * yang hanya membaca `profil.ts` memberi rasa aman yang tidak ia jamin.
 */
const BERKAS = ['lib/aksi/profil.ts', 'lib/aksi/skoring.ts']
const ISI = BERKAS.map((f) => readFileSync(f, 'utf8')).join('\n')

/** Aksi yang boleh TIDAK menyinkronkan skor, beserta alasannya. */
const PENGECUALIAN: Record<string, string> = {
  hitungUlangSkor:
    'Ia SENDIRI yang menghitung ulang — memanggil sinkronkanSkor() dari dalamnya berarti hitung ulang berlapis.',
  tandaiHukdisDiperiksa:
    'Sengaja tidak menggeser skor. Yang dicatat bukan "pegawai ini bersih" — itu sudah jadi perlakuan bawaan mesin skor — melainkan bahwa seseorang pernah MEMERIKSANYA. Kalau verifikasi ikut menggeser skor, angka orang yang belum diperiksa berubah begitu ada yang mencentangnya, dan itu terlihat seperti penilaian ulang padahal tidak ada data baru.',
  simpanCatatanPegawai:
    'Kode catatan (HDS/HDB/TBTL/TBS) BUKAN masukan rubrik. Kejadian yang mungkin diwakilinya sudah punya jalannya sendiri lewat `hukuman_disiplin` → indikator Integritas & Moralitas; kalau kode ini ikut menggeser skor, satu kejadian yang sama terhitung dua kali dan tidak ada halaman yang bisa menjelaskan selisihnya. Ia penanda untuk manusia, bukan angka.',
  tambahPegawai:
    'Pegawai baru belum punya asesmen, riwayat, maupun baris match_score untuk target mana pun, jadi tidak ada yang bisa disinkronkan. Skornya lahir saat Hitung Ulang jabatan targetnya.',
  tambahPegawaiMassal:
    'Sama dengan tambahPegawai, dan menghitung ulang 500 pegawai di dalam satu permintaan yang sedang ditunggu pengguna adalah kelas masalah yang berbeda (job asinkron, U-10).',
  imporPegawaiDariXlsx:
    'Impor massal — alasan yang sama dengan tambahPegawaiMassal. Halamannya menyuruh menjalankan Hitung Ulang sesudahnya.',
}

/**
 * KODE sebuah aksi — komentarnya dibuang lebih dulu.
 *
 * Tanpa pembuangan itu, penjaga ini menghukum dokumentasi: sebuah aksi yang
 * dikecualikan lalu MENJELASKAN kenapa ("kenapa TIDAK memanggil `sinkronkanSkor()`")
 * langsung terbaca seperti aksi yang memanggilnya, dan ujinya merah atas kode yang
 * benar. Kena persis begitu saat `simpanCatatanPegawai` ditambahkan 2 Sep 2026.
 *
 * Yang dibuang komentar blok & baris; string tidak — tidak ada aksi di sini yang
 * menuliskan nama fungsi ini di dalam string, dan pembuang yang terlalu pintar
 * justru bisa memakan kodenya sendiri.
 */
function badanAksi(nama: string): string {
  const awal = ISI.indexOf(`export async function ${nama}(`)
  if (awal === -1) throw new Error(`aksi ${nama} tidak ada di lib/aksi/profil.ts`)
  const berikut = ISI.indexOf('\nexport async function ', awal + 1)
  return tanpaKomentar(ISI.slice(awal, berikut === -1 ? ISI.length : berikut))
}

function tanpaKomentar(kode: string): string {
  return kode.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
}

const SEMUA_AKSI = [...ISI.matchAll(/^export async function (\w+)\(/gm)].map((m) => m[1]!)

describe('sinkronisasi skor pada jalur tulis profil', () => {
  it('menemukan aksinya — kalau nol, ujinya yang rusak, bukan kodenya', () => {
    // Kontrol positif. Tanpa ini, regex yang meleset menghasilkan "semua lolos"
    // atas himpunan kosong — hijau yang tidak berarti apa-apa.
    expect(SEMUA_AKSI.length).toBeGreaterThanOrEqual(10)
  })

  it('setiap aksi menyinkronkan skor ATAU terdaftar sebagai pengecualian', () => {
    const lalai = SEMUA_AKSI.filter(
      (nama) =>
        PENGECUALIAN[nama] === undefined &&
        !/sinkronkanSkor\(|hitungUlangSatuPegawai\(|hitungUlangSkor\(/.test(badanAksi(nama)),
    )
    expect(lalai).toEqual([])
  })

  it('tiap pengecualian benar-benar ada, dan alasannya ditulis', () => {
    // Pengecualian yang aksinya sudah tidak ada berarti daftar ini melapuk diam-diam
    // dan suatu saat akan memaafkan aksi baru yang kebetulan senama.
    for (const [nama, alasan] of Object.entries(PENGECUALIAN)) {
      expect(SEMUA_AKSI, `pengecualian "${nama}" tidak menunjuk aksi mana pun`).toContain(nama)
      expect(alasan.length, `alasan untuk "${nama}" terlalu pendek`).toBeGreaterThan(60)
    }
  })

  it('pembuang komentar bekerja — kontrol positif', () => {
    /*
      Kalau `tanpaKomentar()` berhenti bekerja, penjaga di bawah kembali membaca
      komentar sebagai kode dan setiap aksi yang MENJELASKAN pengecualiannya jadi
      merah. Yang diuji di sini bentuknya, bukan salah satu aksi tertentu.
    */
    expect(tanpaKomentar('a /* sinkronkanSkor( */ b')).not.toContain('sinkronkanSkor(')
    expect(tanpaKomentar('a // sinkronkanSkor(\nb')).not.toContain('sinkronkanSkor(')
    expect(tanpaKomentar('await sinkronkanSkor(id)')).toContain('sinkronkanSkor(')
  })

  it('pengecualian tidak boleh dipakai untuk aksi yang JUSTRU menyinkronkan', () => {
    // Kalau sebuah aksi dikecualikan tapi ternyata memanggilnya, salah satu dari
    // keduanya salah — dan yang paling mungkin daftarnya, yang lalu memaafkan
    // aksi lain yang benar-benar lalai.
    const kontradiksi = Object.keys(PENGECUALIAN)
      // `hitungUlangSkor` memanggil dirinya sendiri lewat rekursi nama, jadi ia
      // selalu "cocok" — dikecualikan dari pemeriksaan kontradiksi ini.
      .filter((nama) => nama !== 'hitungUlangSkor')
      .filter((nama) => /sinkronkanSkor\(|hitungUlangSatuPegawai\(/.test(badanAksi(nama)))
    expect(kontradiksi).toEqual([])
  })

  it('helper-nya menelan galat, jadi hitung ulang yang gagal tidak membatalkan simpan', () => {
    const helper = ISI.slice(ISI.indexOf('async function sinkronkanSkor'))
    expect(helper.slice(0, 600)).toMatch(/try\s*\{[\s\S]*\}\s*catch/)
  })
})
