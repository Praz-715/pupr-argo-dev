import { BOBOT_FORMULA_A, MATRIKS_KOTAK_9, SKOR_PREDIKAT } from './konstanta'
import { bulatkan2, clampSkor } from './rubrik'
import type { AmbangSumbu, KategoriSumbuX, KategoriSumbuY, Kotak9, Predikat } from './types'

/**
 * Formula A — Nilai Talenta & pemetaan 9 Kotak Manajemen Talenta ASN.
 * Sumber: doc/KERANGKA TALENT POOL.md §A + Lampiran A & B
 * doc/manajemen talenta 27 juli utk tim SIM.md.
 */

/** Predikat kinerja → skor sumbu Y (100/80/60/40/20). */
export function skorPredikat(predikat: Predikat | string | null | undefined): number | null {
  if (!predikat) return null
  const cocok = (Object.keys(SKOR_PREDIKAT) as Predikat[]).find(
    (p) => p.toLowerCase() === predikat.trim().replace(/\s+/g, ' ').toLowerCase(),
  )
  return cocok ? SKOR_PREDIKAT[cocok] : null
}

/**
 * ## `ambang` WAJIB dikirim — tidak ada nilai bawaan, dan itu disengaja
 *
 * Ambang 80/60 bisa diubah Super Admin lewat `pengaturan_sistem` (butir 7,
 * 18 Agu 2026), jadi fungsi-fungsi di bawah tidak boleh lagi membaca konstanta
 * modul sendiri. Yang menggoda: memberi parameternya nilai bawaan
 * `= AMBANG_SUMBU` supaya pemanggil lama tetap jalan. Itu justru cara paling
 * rapi untuk membuat setengah aplikasi memakai angka DB dan setengahnya memakai
 * angka kode — persis bug yang baru ditemukan di `ukur-hitung-ulang.ts`, yang
 * lupa mengirim `masaBerlakuTahun` sehingga skornya identik sampai dua desimal
 * tapi kelayakannya berbeda, dan tidak ada yang menyadarinya berbulan-bulan.
 *
 * Karena parameternya wajib, jalur yang lupa mengambil pengaturan **gagal
 * kompilasi**, bukan diam-diam berbeda. `AMBANG_SUMBU` tetap ada sebagai nilai
 * BAWAAN yang dipakai `PENGATURAN_BAWAAN` dan uji — satu tempat, bukan dua.
 *
 * `lib/scoring` tetap bebas DB: ia menerima angkanya, tidak mengambilnya.
 */

/**
 * Klasifikasi sumbu Y. Batas bawah INKLUSIF — jadi predikat "Baik" (tepat 80)
 * masuk "Di Atas Ekspektasi" pada ambang bawaan. Itu sifat rubrik sumber, bukan
 * kekeliruan pembulatan (phase.md §3 K-2).
 */
export function klasifikasiSumbuY(nilai: number, ambang: AmbangSumbu): KategoriSumbuY {
  if (nilai >= ambang.atas) return 'Di Atas Ekspektasi'
  if (nilai >= ambang.tengah) return 'Sesuai Ekspektasi'
  return 'Di Bawah Ekspektasi'
}

export function klasifikasiSumbuX(nilai: number, ambang: AmbangSumbu): KategoriSumbuX {
  if (nilai >= ambang.atas) return 'Tinggi'
  if (nilai >= ambang.tengah) return 'Menengah'
  return 'Rendah'
}

/** Nilai Talenta = 50% sumbu Y + 50% sumbu X. */
export function hitungNilaiTalenta(nilaiKinerjaY: number, nilaiPotensialX: number): number {
  const total =
    nilaiKinerjaY * BOBOT_FORMULA_A.kinerja + nilaiPotensialX * BOBOT_FORMULA_A.potensial
  return bulatkan2(clampSkor(total).skor)
}

export interface HasilKotak9 {
  kotak: Kotak9
  kategoriY: KategoriSumbuY
  kategoriX: KategoriSumbuX
  nilaiKinerjaY: number
  nilaiPotensialX: number
  nilaiTalenta: number
}

/**
 * Kotak 9 SELALU hasil hitung dari (Y, X) — bukan kolom yang diisi bebas
 * (phase.md §2.3). Nilai `kotak_9` yang datang dari sistem sumber dipakai
 * sebagai pembanding lewat `bandingkanKotak9()`, bukan sebagai kebenaran.
 */
export function hitungKotak9(
  nilaiKinerjaY: number,
  nilaiPotensialX: number,
  ambang: AmbangSumbu,
): HasilKotak9 {
  const y = clampSkor(nilaiKinerjaY).skor
  /**
   * **Sumbu X TIDAK diplafon** — keputusan pemilik proses, 18 Agu 2026.
   *
   * X diturunkan dari potkom, dan dua sumber independen (eNominasi & Excel Talent
   * Pool ES 2/3) sama-sama mengirim potkom >100 pada sekitar 40% rekaman.
   * Memotongnya membuat mereka semua menumpuk di X=100 tepat dan kehilangan daya
   * bedanya, sehingga sebaran Kotak 9 menyempit bukan karena orangnya serupa.
   *
   * **Klasifikasinya tidak berubah sama sekali**: ambang teratas `≥80`, dan nilai
   * >100 tetap memenuhinya — jadi `kotak` yang dihasilkan identik dengan versi
   * berplafon, termasuk terhadap `ekspresiSqlKotak9()` yang dijaga
   * `verifikasi:skoring`. Yang berbeda hanya angka X yang DILAPORKAN.
   *
   * `nilaiKinerjaY` tetap diplafon: ia turunan predikat kinerja yang memang
   * berskala 0–100. Dan `nilaiTalenta` di bawah tetap diplafon oleh
   * `hitungNilaiTalenta()` — komposit tanpa plafon berhenti bisa dibandingkan
   * antar pegawai.
   */
  const x = bulatkan2(nilaiPotensialX)
  const kategoriY = klasifikasiSumbuY(y, ambang)
  const kategoriX = klasifikasiSumbuX(x, ambang)

  return {
    kotak: MATRIKS_KOTAK_9[kategoriY][kategoriX],
    kategoriY,
    kategoriX,
    nilaiKinerjaY: bulatkan2(y),
    nilaiPotensialX: bulatkan2(x),
    nilaiTalenta: hitungNilaiTalenta(y, x),
  }
}

/**
 * Ekspresi SQL `CASE` untuk nomor Kotak 9 — **dihasilkan** dari `AMBANG_SUMBU` &
 * `MATRIKS_KOTAK_9`, bukan ditulis ulang.
 *
 * Ada karena dua tuntutan yang bertabrakan. Agregasi peta talenta **wajib di
 * SQL** (`GROUP BY`, phase.md §3 K-5), sementara Kotak 9 per jabatan target
 * **tidak tersimpan di kolom mana pun**: sumbu X-nya `match_score.skor_total`
 * (§2.10), jadi kotaknya lahir saat kueri berjalan. Menulis `CASE`-nya langsung
 * di berkas kueri berarti matriks Lampiran A punya **definisi kedua** yang bisa
 * berselisih dengan `hitungKotak9()` tanpa satu pun uji gagal — larangan
 * CLAUDE.md #2. Emitter ini membuat SQL-nya turunan, bukan salinan.
 *
 * Urutan cabangnya penting dan bukan kebetulan: `CASE` SQL memakai cabang
 * pertama yang cocok, jadi setiap baris matriks diurutkan dari ambang tertinggi
 * ke terendah, dan sel paling bawah-kiri jadi `ELSE`.
 *
 * Kedua argumen **disisipkan apa adanya** ke SQL, jadi hanya boleh diisi nama
 * kolom literal yang ditulis di kode (`a.nilai_kinerja_y`) — tidak pernah nilai
 * dari pengguna. Nilai di DB sudah dijamin 0–100 sejak impor (§2.1), sehingga
 * `clampSkor()` yang ada di `hitungKotak9()` tidak perlu ditirukan di sini.
 */
export function ekspresiSqlKotak9(
  kolomY: string,
  kolomX: string,
  ambang: AmbangSumbu,
): string {
  // Angka ambang disisipkan ke SQL, jadi ia WAJIB berupa bilangan — nilainya
  // berasal dari `pengaturan_sistem` yang bisa diubah Super Admin, dan kolom
  // `nilai` di tabel itu bertipe VARCHAR. Tanpa penjagaan ini, satu baris
  // pengaturan yang berisi teks menjadi injeksi SQL lewat pintu belakang
  // administrasi.
  const angka = (n: number, nama: string): number => {
    if (!Number.isFinite(n)) throw new Error(`Ambang ${nama} bukan bilangan: ${String(n)}`)
    return n
  }
  const atas = angka(ambang.atas, 'atas')
  const tengah = angka(ambang.tengah, 'tengah')

  const barisY: Array<[KategoriSumbuY, string | null]> = [
    ['Di Atas Ekspektasi', `${kolomY} >= ${atas}`],
    ['Sesuai Ekspektasi', `${kolomY} >= ${tengah}`],
    ['Di Bawah Ekspektasi', null],
  ]
  const kolomX9: Array<[KategoriSumbuX, string | null]> = [
    ['Tinggi', `${kolomX} >= ${atas}`],
    ['Menengah', `${kolomX} >= ${tengah}`],
    ['Rendah', null],
  ]

  const cabang: string[] = []
  let terbawah: Kotak9 = MATRIKS_KOTAK_9['Di Bawah Ekspektasi']['Rendah']

  for (const [ky, syaratY] of barisY) {
    for (const [kx, syaratX] of kolomX9) {
      const kotak = MATRIKS_KOTAK_9[ky][kx]
      const syarat = [syaratY, syaratX].filter((s): s is string => s !== null)
      if (syarat.length === 0) {
        terbawah = kotak
        continue
      }
      cabang.push(`WHEN ${syarat.join(' AND ')} THEN ${kotak}`)
    }
  }

  return `CASE ${cabang.join(' ')} ELSE ${terbawah} END`
}

export interface PerbandinganKotak9 {
  kotakHitung: Kotak9
  kotakSumber: number | null
  cocok: boolean
  /** true bila ada nilai sumber yang berbeda → masuk Antrian Pembersihan Data. */
  perluReview: boolean
  keterangan: string | null
}

/**
 * Bandingkan hasil hitung dengan nilai `kotak_9` yang datang dari sistem sumber.
 * Selisih TIDAK disembunyikan: baris yang beda ditandai supaya muncul di
 * Antrian Pembersihan Data (phase.md §6 no. 2).
 */
export function bandingkanKotak9(
  hasil: HasilKotak9,
  kotakSumber: number | null | undefined,
): PerbandinganKotak9 {
  if (kotakSumber === null || kotakSumber === undefined) {
    return {
      kotakHitung: hasil.kotak,
      kotakSumber: null,
      cocok: true,
      perluReview: false,
      keterangan: null,
    }
  }

  const cocok = kotakSumber === hasil.kotak
  return {
    kotakHitung: hasil.kotak,
    kotakSumber,
    cocok,
    perluReview: !cocok,
    keterangan: cocok
      ? null
      : `Kotak 9 dari sumber (${kotakSumber}) berbeda dengan hasil hitung (${hasil.kotak}) untuk Y=${hasil.nilaiKinerjaY} · X=${hasil.nilaiPotensialX}`,
  }
}

/** Urutan baris grid dari atas ke bawah (baris 0 = Di Atas Ekspektasi). */
export const BARIS_KOTAK_9: readonly KategoriSumbuY[] = [
  'Di Atas Ekspektasi',
  'Sesuai Ekspektasi',
  'Di Bawah Ekspektasi',
]

/** Urutan kolom grid dari kiri ke kanan. */
export const KOLOM_KOTAK_9: readonly KategoriSumbuX[] = ['Rendah', 'Menengah', 'Tinggi']

/**
 * Kebalikan `MATRIKS_KOTAK_9`: dari nomor kotak → pasangan kategori sumbunya.
 *
 * Dipakai judul drill-down ("Kotak 7 · Di Atas Ekspektasi × Potensial
 * Menengah"). Diturunkan dari matriks yang sama, jadi tidak ada tabel Kotak 9
 * kedua yang bisa berselisih dengan rumusnya.
 */
export function kategoriDariKotak9(
  kotak: number,
): { y: KategoriSumbuY; x: KategoriSumbuX } | null {
  for (const y of BARIS_KOTAK_9) {
    for (const x of KOLOM_KOTAK_9) {
      if (MATRIKS_KOTAK_9[y][x] === kotak) return { y, x }
    }
  }
  return null
}

/** Koordinat sel pada grid 3×3 (baris 0 = Di Atas Ekspektasi). */
export function koordinatKotak9(kotak: Kotak9): { baris: 0 | 1 | 2; kolom: 0 | 1 | 2 } {
  const kategori = kategoriDariKotak9(kotak)
  if (!kategori) return { baris: 2, kolom: 0 }
  return {
    baris: BARIS_KOTAK_9.indexOf(kategori.y) as 0 | 1 | 2,
    kolom: KOLOM_KOTAK_9.indexOf(kategori.x) as 0 | 1 | 2,
  }
}
