import { PENANDA_KOMPONEN, SKOR_MAKS, SKOR_MIN } from './konstanta'
import { bulatkan2 } from './rubrik'
import type { IndikatorNode, KategoriSkor, KomponenNode, Sumbu } from './types'

/**
 * Validasi struktur rubrik — dipakai editor rubrik (Fase 5) sebelum aktivasi.
 *
 * Kenapa ini ada di `lib/scoring` dan bukan di form: mesin rubrik
 * (`rubrik.ts`) sengaja **tidak pernah melempar**. Ia selalu mengembalikan
 * angka, dan menandai yang meragukan lewat `perluReview` (phase.md §2.8b).
 * Sifat itu benar untuk perhitungan massal — satu rubrik cacat tidak boleh
 * menjatuhkan 1.872 skor — tapi berarti rubrik yang salah **tetap
 * menghasilkan angka yang kelihatan wajar**. Jadi kesalahannya harus
 * ketahuan di titik lain: saat rubriknya disimpan & diaktifkan.
 *
 * Modul ini memeriksa hal-hal yang di mesin akan berakhir sebagai skor 0
 * senyap, band yang tidak pernah kena, atau bobot yang berbohong soal
 * kontribusinya. Bebas DB supaya bisa diuji murni.
 *
 * GALAT     = memblokir aktivasi; skor akan salah atau menyesatkan.
 * PERINGATAN = boleh diaktifkan, tapi perlu diketahui manusia.
 */

export type TingkatTemuan = 'GALAT' | 'PERINGATAN'

export type KodeTemuanRubrik =
  | 'RUBRIK_KOSONG'
  | 'BOBOT_KOMPONEN_BUKAN_100'
  | 'BOBOT_INDIKATOR_TIDAK_SAMA_KOMPONEN'
  | 'KOMPONEN_TANPA_INDIKATOR'
  | 'KOMPONEN_FORMULA_B_HILANG'
  | 'INDIKATOR_TANPA_KATEGORI'
  | 'BOBOT_ANAK_CAMPUR'
  | 'AGREGATOR_BERKATEGORI'
  | 'KATEGORI_TANPA_NILAI_SKOR'
  | 'NILAI_SKOR_DI_LUAR_RENTANG'
  | 'AMBANG_TERBALIK'
  | 'AMBANG_BERLUBANG'
  | 'AMBANG_TUMPANG_TINDIH'
  | 'AMBANG_CAMPUR'
  | 'AMBANG_BAWAH_TIDAK_MENUTUP'
  | 'AMBANG_ATAS_TIDAK_MENUTUP'
  | 'KATEGORI_NAMA_GANDA'

export interface TemuanRubrik {
  kode: KodeTemuanRubrik
  tingkat: TingkatTemuan
  komponenId: number | null
  indikatorId: number | null
  /** Nama objek yang bermasalah, ditampilkan apa adanya. */
  nama: string
  /** Apa yang salah — beserta angkanya, bukan "tidak valid". */
  pesan: string
  /** Apa yang harus diubah supaya lolos. */
  saran: string
}

export interface HasilValidasiRubrik {
  temuan: TemuanRubrik[]
  jumlahGalat: number
  jumlahPeringatan: number
  /** Rubrik hanya boleh diaktifkan kalau tidak ada GALAT. */
  bisaDiaktifkan: boolean
}

/**
 * Bobot disimpan `DECIMAL(5,4)`, jadi selisih di bawah 0,0001 bukan kesalahan
 * manusia melainkan sisa pembulatan biner (0,65 + 0,20 + 0,15 = 1,0000000000000002).
 */
const TOLERANSI = 0.0001

const persen = (bobot: number): string => `${bulatkan2(bobot * 100)}%`

/** Semua indikator (top-level + sub) dalam satu daftar, untuk pemeriksaan per node. */
function datarkan(indikator: IndikatorNode[]): IndikatorNode[] {
  return indikator.flatMap((i) => [i, ...datarkan(i.anak)])
}

export function validasiRubrik(
  komponen: KomponenNode[],
  opsi: { untukJabatanTarget?: boolean } = {},
): HasilValidasiRubrik {
  const temuan: TemuanRubrik[] = []
  const tambah = (t: TemuanRubrik) => temuan.push(t)

  if (komponen.length === 0) {
    tambah({
      kode: 'RUBRIK_KOSONG',
      tingkat: 'GALAT',
      komponenId: null,
      indikatorId: null,
      nama: 'Rubrik',
      pesan: 'Rubrik belum punya komponen sama sekali, jadi setiap skor akan bernilai 0.',
      saran: 'Tambahkan minimal satu komponen beserta indikatornya.',
    })
    return rangkum(temuan)
  }

  validasiBobotKomponen(komponen, tambah)
  if (opsi.untukJabatanTarget) validasiKomponenFormulaB(komponen, tambah)

  for (const k of komponen) {
    validasiKomponen(k, tambah)
    for (const node of datarkan(k.indikator)) {
      validasiIndikator(node, k, tambah)
    }
  }

  return rangkum(temuan)
}

function rangkum(temuan: TemuanRubrik[]): HasilValidasiRubrik {
  const jumlahGalat = temuan.filter((t) => t.tingkat === 'GALAT').length
  return {
    temuan,
    jumlahGalat,
    jumlahPeringatan: temuan.length - jumlahGalat,
    bisaDiaktifkan: jumlahGalat === 0,
  }
}

/**
 * Total bobot komponen per sumbu harus 100% (PRD §6.5).
 *
 * Mesin memakai Σ(skor×bobot)/Σ(bobot), jadi total 80% **tidak** membuat skor
 * mengecil — ia menormalkan diri. Justru itu bahayanya: rubrik yang bobotnya
 * jumlahnya 80% tetap menghasilkan angka wajar, sementara label "20%" di UI
 * berbohong soal kontribusi tiap komponen. Diperiksa per sumbu karena satu
 * rubrik bisa memuat sumbu Y (kinerja) dan X (potensial) sekaligus.
 */
function validasiBobotKomponen(komponen: KomponenNode[], tambah: (t: TemuanRubrik) => void): void {
  const perSumbu = new Map<Sumbu, KomponenNode[]>()
  for (const k of komponen) {
    perSumbu.set(k.sumbu, [...(perSumbu.get(k.sumbu) ?? []), k])
  }

  for (const [sumbu, daftar] of perSumbu) {
    const total = daftar.reduce((n, k) => n + k.bobot, 0)
    if (Math.abs(total - 1) > TOLERANSI) {
      tambah({
        kode: 'BOBOT_KOMPONEN_BUKAN_100',
        tingkat: 'GALAT',
        komponenId: null,
        indikatorId: null,
        nama: sumbu === 'X_POTENSIAL' ? 'Sumbu X (Potensial)' : 'Sumbu Y (Kinerja)',
        pesan: `Total bobot ${daftar.length} komponen = ${persen(total)}, seharusnya 100%.`,
        saran:
          total > 1
            ? `Kurangi ${persen(total - 1)} dari salah satu komponen.`
            : `Tambahkan ${persen(1 - total)} ke salah satu komponen.`,
      })
    }
  }
}

/**
 * Formula B mencari tiga komponennya **berdasarkan nama** (`PENANDA_KOMPONEN`).
 * Kalau salah satu tidak ada, `hitungMatchScore` mengembalikan 0 untuk komponen
 * itu — skor total tetap keluar, hanya kehilangan 65%/20%/15% bagiannya tanpa
 * pesan apa pun di UI. Karena itu diperiksa di sini, bukan dibiarkan muncul
 * sebagai skor rendah yang misterius.
 */
function validasiKomponenFormulaB(
  komponen: KomponenNode[],
  tambah: (t: TemuanRubrik) => void,
): void {
  const wajib: Array<[string, string]> = [
    [PENANDA_KOMPONEN.potensiKompetensi, 'Potensi & Kompetensi (65%)'],
    [PENANDA_KOMPONEN.kualifikasiJabatan, 'Kualifikasi Jabatan (20%)'],
    [PENANDA_KOMPONEN.integritasMoralitas, 'Integritas & Moralitas (15%)'],
  ]

  for (const [penanda, label] of wajib) {
    const ada = komponen.some((k) => k.namaKomponen.toLowerCase().includes(penanda))
    if (!ada) {
      tambah({
        kode: 'KOMPONEN_FORMULA_B_HILANG',
        tingkat: 'GALAT',
        komponenId: null,
        indikatorId: null,
        nama: label,
        pesan: `Tidak ada komponen yang namanya memuat "${penanda}", sehingga bagian ini dihitung 0 pada match score.`,
        saran: `Beri nama komponennya sehingga memuat kata "${penanda}".`,
      })
    }
  }
}

function validasiKomponen(k: KomponenNode, tambah: (t: TemuanRubrik) => void): void {
  if (k.indikator.length === 0) {
    tambah({
      kode: 'KOMPONEN_TANPA_INDIKATOR',
      tingkat: 'GALAT',
      komponenId: k.id,
      indikatorId: null,
      nama: k.namaKomponen,
      pesan: 'Komponen belum punya indikator, jadi skornya selalu 0.',
      saran: 'Tambahkan indikator, atau hapus komponen ini dan bagikan bobotnya ke komponen lain.',
    })
    return
  }

  // Bobot indikator top-level dalam satu komponen harus = bobot komponennya.
  // Sub-indikator DIKECUALIKAN: bobotnya NULL by design (phase.md §2.5).
  const berbobot = k.indikator.filter((i) => i.bobot !== null)
  if (berbobot.length > 0) {
    const total = berbobot.reduce((n, i) => n + (i.bobot ?? 0), 0)
    if (Math.abs(total - k.bobot) > TOLERANSI) {
      tambah({
        kode: 'BOBOT_INDIKATOR_TIDAK_SAMA_KOMPONEN',
        tingkat: 'GALAT',
        komponenId: k.id,
        indikatorId: null,
        nama: k.namaKomponen,
        pesan: `Total bobot ${berbobot.length} indikator = ${persen(total)}, sedangkan bobot komponennya ${persen(k.bobot)}.`,
        saran: `Samakan totalnya dengan ${persen(k.bobot)} — mis. ${persen(k.bobot / berbobot.length)} per indikator kalau dibagi rata.`,
      })
    }
  }

  const tanpaBobot = k.indikator.filter((i) => i.bobot === null)
  if (tanpaBobot.length > 0 && berbobot.length > 0) {
    tambah({
      kode: 'BOBOT_ANAK_CAMPUR',
      tingkat: 'GALAT',
      komponenId: k.id,
      indikatorId: tanpaBobot[0]!.id,
      nama: k.namaKomponen,
      pesan: `${tanpaBobot.length} indikator top-level tidak berbobot sementara ${berbobot.length} lainnya berbobot; yang tidak berbobot akan dihitung dengan bobot 0.`,
      saran: 'Beri bobot pada semua indikator top-level, atau kosongkan semuanya agar dirata-rata.',
    })
  }
}

function validasiIndikator(
  node: IndikatorNode,
  komponen: KomponenNode,
  tambah: (t: TemuanRubrik) => void,
): void {
  const dasar = { komponenId: komponen.id, indikatorId: node.id, nama: node.namaIndikator }

  // ---- node agregator (punya anak) --------------------------------------
  if (node.anak.length > 0) {
    if (node.kategori.length > 0) {
      tambah({
        ...dasar,
        kode: 'AGREGATOR_BERKATEGORI',
        tingkat: 'PERINGATAN',
        pesan: `Indikator ini punya ${node.anak.length} sub-indikator sekaligus ${node.kategori.length} kategori skor sendiri; kategorinya diabaikan karena nilainya dirata-rata dari sub-indikator.`,
        saran: 'Hapus kategori skornya supaya rubrik tidak menjanjikan penilaian yang tidak dipakai.',
      })
    }

    const anakBerbobot = node.anak.filter((a) => a.bobot !== null)
    if (anakBerbobot.length > 0 && anakBerbobot.length < node.anak.length) {
      tambah({
        ...dasar,
        kode: 'BOBOT_ANAK_CAMPUR',
        tingkat: 'GALAT',
        pesan: `${node.anak.length - anakBerbobot.length} dari ${node.anak.length} sub-indikator tidak berbobot sementara sisanya berbobot; yang tidak berbobot dihitung dengan bobot 0.`,
        saran:
          'Kosongkan bobot seluruh sub-indikator (dirata-rata, sesuai phase.md §2.5) atau beri bobot semuanya.',
      })
    }
    return
  }

  // ---- node daun --------------------------------------------------------
  if (node.kategori.length === 0) {
    tambah({
      ...dasar,
      kode: 'INDIKATOR_TANPA_KATEGORI',
      tingkat: node.modeSkor === 'NILAI_LANGSUNG' ? 'PERINGATAN' : 'GALAT',
      pesan:
        node.modeSkor === 'NILAI_LANGSUNG'
          ? 'Indikator tanpa kategori skor: nilainya tetap terhitung (mode nilai langsung), tapi tidak punya label klasifikasi untuk ditampilkan.'
          : 'Indikator tanpa kategori skor pada mode kategori tetap: skornya selalu 0.',
      saran: 'Tambahkan kategori skor beserta ambang atau nilai skornya.',
    })
    return
  }

  validasiNamaKategori(node, dasar, tambah)
  validasiNilaiSkor(node, dasar, tambah)
  validasiAmbang(node, dasar, tambah)
}

type Dasar = { komponenId: number; indikatorId: number; nama: string }

function validasiNamaKategori(
  node: IndikatorNode,
  dasar: Dasar,
  tambah: (t: TemuanRubrik) => void,
): void {
  const terlihat = new Set<string>()
  for (const k of node.kategori) {
    const kunci = k.namaKategori.trim().replace(/\s+/g, ' ').toLowerCase()
    if (terlihat.has(kunci)) {
      tambah({
        ...dasar,
        kode: 'KATEGORI_NAMA_GANDA',
        tingkat: 'PERINGATAN',
        pesan: `Kategori "${k.namaKategori}" muncul lebih dari sekali; saat nilai datang sebagai teks, yang terpakai selalu yang pertama.`,
        saran: 'Bedakan namanya atau hapus salah satu.',
      })
    }
    terlihat.add(kunci)
  }
}

function validasiNilaiSkor(
  node: IndikatorNode,
  dasar: Dasar,
  tambah: (t: TemuanRubrik) => void,
): void {
  // Mode NILAI_LANGSUNG memang tidak memakai `nilaiSkor` — kategorinya cuma label.
  if (node.modeSkor === 'NILAI_LANGSUNG') return

  const kosong = node.kategori.filter((k) => k.nilaiSkor === null)
  if (kosong.length > 0) {
    tambah({
      ...dasar,
      kode: 'KATEGORI_TANPA_NILAI_SKOR',
      tingkat: 'GALAT',
      pesan: `${kosong.length} kategori belum punya nilai skor (mis. "${kosong[0]!.namaKategori}"); nilainya akan dihitung 0.`,
      saran: 'Isi nilai skor 0–100 untuk setiap kategori pada mode kategori tetap.',
    })
  }

  const luar = node.kategori.filter(
    (k) => k.nilaiSkor !== null && (k.nilaiSkor < SKOR_MIN || k.nilaiSkor > SKOR_MAKS),
  )
  if (luar.length > 0) {
    tambah({
      ...dasar,
      kode: 'NILAI_SKOR_DI_LUAR_RENTANG',
      tingkat: 'GALAT',
      pesan: `${luar.length} kategori punya nilai skor di luar ${SKOR_MIN}–${SKOR_MAKS} (mis. ${luar[0]!.nilaiSkor}); nilainya akan dipotong.`,
      saran: `Ubah nilai skornya ke dalam rentang ${SKOR_MIN}–${SKOR_MAKS}.`,
    })
  }
}

/**
 * Kontinuitas & tumpang-tindih ambang (phase.md §2.8b).
 *
 * Mesin menyelesaikan tumpang-tindih dengan aturan "band tertinggi yang berlaku
 * menang" dan mengisi lubang dengan "kategori terdekat di bawah + perluReview".
 * Keduanya jaring pengaman, bukan izin: lubang berarti seorang pegawai diberi
 * kategori yang bukan miliknya, dan itu harus dibetulkan di rubriknya.
 */
function validasiAmbang(
  node: IndikatorNode,
  dasar: Dasar,
  tambah: (t: TemuanRubrik) => void,
): void {
  const berambang = node.kategori.filter((k) => k.ambangMin !== null || k.ambangMax !== null)
  if (berambang.length === 0) return // rubrik berbasis label teks — tidak ada rentang untuk diperiksa

  const tanpaAmbang = node.kategori.length - berambang.length
  if (tanpaAmbang > 0) {
    tambah({
      ...dasar,
      kode: 'AMBANG_CAMPUR',
      tingkat: 'PERINGATAN',
      pesan: `${tanpaAmbang} kategori tidak punya ambang sementara ${berambang.length} lainnya punya; kategori tanpa ambang cocok dengan nilai apa pun dan dipakai paling akhir.`,
      saran: 'Beri ambang pada semua kategori, atau hapus yang tanpa ambang.',
    })
  }

  for (const k of berambang) {
    if (k.ambangMin !== null && k.ambangMax !== null && k.ambangMin > k.ambangMax) {
      tambah({
        ...dasar,
        kode: 'AMBANG_TERBALIK',
        tingkat: 'GALAT',
        pesan: `Kategori "${k.namaKategori}" punya ambang bawah ${k.ambangMin} lebih besar daripada ambang atas ${k.ambangMax}, jadi tidak pernah cocok dengan nilai apa pun.`,
        saran: 'Tukar kedua nilainya.',
      })
    }
  }

  // Urut menurun menurut ambang bawah — sama seperti yang dipakai mesin saat
  // mencocokkan, supaya yang diperiksa di sini benar-benar urutan yang berlaku.
  const urut = [...berambang].sort(
    (a, b) => (b.ambangMin ?? Number.NEGATIVE_INFINITY) - (a.ambangMin ?? Number.NEGATIVE_INFINITY),
  )

  for (let i = 0; i < urut.length - 1; i++) {
    const atas = urut[i]!
    const bawah = urut[i + 1]!
    if (atas.ambangMin === null) continue // band tanpa batas bawah menampung semuanya

    if (bawah.ambangMax === null) {
      tambah({
        ...dasar,
        kode: 'AMBANG_TUMPANG_TINDIH',
        tingkat: 'PERINGATAN',
        pesan: `"${bawah.namaKategori}" tidak punya ambang atas sehingga menutupi rentang "${atas.namaKategori}" (mulai ${atas.ambangMin}); yang dipakai adalah band tertinggi.`,
        saran: `Beri ambang atas ${atas.ambangMin} pada "${bawah.namaKategori}".`,
      })
      continue
    }

    if (bawah.ambangMax < atas.ambangMin) {
      tambah({
        ...dasar,
        kode: 'AMBANG_BERLUBANG',
        tingkat: 'GALAT',
        pesan: `Nilai di antara ${bawah.ambangMax} dan ${atas.ambangMin} tidak masuk kategori mana pun (celah antara "${bawah.namaKategori}" dan "${atas.namaKategori}").`,
        saran: `Naikkan ambang atas "${bawah.namaKategori}" ke ${atas.ambangMin}, atau turunkan ambang bawah "${atas.namaKategori}" ke ${bawah.ambangMax}.`,
      })
    } else if (bawah.ambangMax > atas.ambangMin) {
      tambah({
        ...dasar,
        kode: 'AMBANG_TUMPANG_TINDIH',
        tingkat: 'PERINGATAN',
        pesan: `Rentang ${atas.ambangMin}–${bawah.ambangMax} masuk dua kategori sekaligus ("${bawah.namaKategori}" dan "${atas.namaKategori}"); yang dipakai adalah band tertinggi.`,
        saran: `Turunkan ambang atas "${bawah.namaKategori}" menjadi ${atas.ambangMin}.`,
      })
    }
  }

  const terbawah = urut[urut.length - 1]!
  if (terbawah.ambangMin !== null && terbawah.ambangMin > SKOR_MIN) {
    tambah({
      ...dasar,
      kode: 'AMBANG_BAWAH_TIDAK_MENUTUP',
      tingkat: 'GALAT',
      pesan: `Nilai di bawah ${terbawah.ambangMin} tidak masuk kategori mana pun — kategori terendah "${terbawah.namaKategori}" mulai dari ${terbawah.ambangMin}.`,
      saran: `Kosongkan ambang bawah "${terbawah.namaKategori}" supaya menampung nilai serendah apa pun.`,
    })
  }

  const teratas = urut[0]!
  if (teratas.ambangMax !== null && teratas.ambangMax < SKOR_MAKS) {
    tambah({
      ...dasar,
      kode: 'AMBANG_ATAS_TIDAK_MENUTUP',
      tingkat: 'GALAT',
      pesan: `Nilai di atas ${teratas.ambangMax} tidak masuk kategori mana pun — kategori tertinggi "${teratas.namaKategori}" berhenti di ${teratas.ambangMax}.`,
      saran: `Kosongkan ambang atas "${teratas.namaKategori}" supaya menampung nilai setinggi apa pun.`,
    })
  }
}

/** Ringkasan satu baris untuk badge & toast. */
export function ringkasValidasi(hasil: HasilValidasiRubrik): string {
  if (hasil.temuan.length === 0) return 'Rubrik lolos seluruh pemeriksaan.'
  const bagian: string[] = []
  if (hasil.jumlahGalat > 0) bagian.push(`${hasil.jumlahGalat} galat`)
  if (hasil.jumlahPeringatan > 0) bagian.push(`${hasil.jumlahPeringatan} peringatan`)
  return bagian.join(' · ')
}

/**
 * Apakah dua kategori skor identik? Dipakai membandingkan rubrik lama vs baru
 * pada Simulasi & Diff, supaya "yang berubah" bukan sekadar dugaan.
 */
export function kategoriSama(a: KategoriSkor, b: KategoriSkor): boolean {
  return (
    a.namaKategori === b.namaKategori &&
    a.nilaiSkor === b.nilaiSkor &&
    a.ambangMin === b.ambangMin &&
    a.ambangMax === b.ambangMax
  )
}
