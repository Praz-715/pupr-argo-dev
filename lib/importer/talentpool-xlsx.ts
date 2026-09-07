/**
 * Berkas Talent Pool (`.xlsx`) → daftar pegawai + riwayatnya. **Murni, bebas DB.**
 *
 * ## Kenapa ada di `lib/`, bukan di skrip
 *
 * Aturan di sini — deteksi header, kolom tunggal vs berulang, pengelompokan baris
 * lanjutan — sebelumnya hanya hidup di `scripts/xlsx-ke-json.py`. Begitu UI juga
 * perlu menerima berkas yang sama, aturannya harus **satu**: dua jalur impor yang
 * membaca satu berkas dengan aturan berbeda akan menghasilkan populasi berbeda,
 * dan bentuk kegagalannya bukan galat melainkan dua angka yang tidak pernah bisa
 * dijelaskan. Karena itu modul ini diuji dengan **membandingkan keluarannya
 * terhadap keluaran ekstraktor Python pada berkas yang sama** — kesetaraannya
 * dibuktikan, bukan diklaim (`lib/importer/talentpool-xlsx.test.ts`).
 *
 * ## Yang SENGAJA tidak diport: dua perbaikan data
 *
 * Ekstraktor Python memuat dua perbaikan yang **divalidasi terhadap data**:
 * memulihkan `UNIT KERJA` dari entri riwayat jabatan pertama (diuji 46/46 pada
 * baris yang unitnya sudah benar), dan mengoreksi blok kolom `M..U` yang tergeser
 * satu kolom pada 6 baris. Keduanya TIDAK diport ke sini, dan itu keputusan:
 *
 *   - perbaikan yang divalidasi terhadap sekumpulan baris tertentu adalah
 *     penilaian manusia atas satu berkas, bukan aturan umum. Menyalinnya ke jalur
 *     unggahan berarti menerapkannya pada berkas yang belum pernah divalidasi;
 *   - dan kalau kedua jalur "memperbaiki" dengan cara yang sedikit berbeda, yang
 *     terjadi tepat hal yang modul ini ada untuk mencegahnya.
 *
 * Jadi modul ini **mendeteksi** keadaan itu dan menandai barisnya `perluTinjau`
 * beserta alasannya. Jalur UI lalu MENOLAK baris tersebut dan menyebut nomornya,
 * sehingga operator tahu berkasnya perlu dibetulkan atau diimpor lewat jalur CLI
 * yang sudah ditinjau — bukan diam-diam masuk dengan unit bernama "13-10-2025".
 */

import { bacaXlsx, hurufKolom, nomorKolom, type Lembar } from './xlsx'

/** Label header (dirapatkan, huruf besar) → nama field. */
const LABEL_TUNGGAL: Record<string, string> = {
  NO: 'no',
  'NAMA LENGKAP': 'nama',
  NIP: 'nip',
  'TMT GOLONGAN': 'tmtGolongan',
  GOLONGAN: 'golongan',
  ESELON: 'eselon',
  'NAMA JABATAN': 'namaJabatan',
  'UNIT KERJA': 'unitKerja',
  'TMT JABATAN': 'tmtJabatan',
  SEKOLAH: 'sekolah',
  'BIDANG STUDI': 'bidangStudi',
  'TINGKAT PENDIDIKAN': 'tingkatPendidikan',
  JURUSAN: 'jurusan',
  'RIWAYAT PENDIDIKAN': 'riwayatPendidikan',
  'JENJANG ASESMEN': 'jenjangAsesmen',
  'TAHUN ASESMEN': 'tahunAsesmen',
  'JENIS ASESMEN': 'jenisAsesmen',
  'STATUS ASESMEN': 'statusAsesmen',
  POTKOM: 'potkom',
  'RATING KINERJA': 'ratingKinerja',
  'KOTAK 9': 'kotak9Sumber',
}

/** Kolom yang BERULANG ke bawah di dalam satu blok pegawai. */
const LABEL_BERULANG: Record<string, string> = {
  'RIWAYAT JABATAN': 'riwayatJabatan',
  'RIWAYAT PELATIHAN': 'riwayatDiklat',
  'TMT DIKLAT': 'tmtDiklat',
  'TMT MASA KERJA 1': 'tmtMulai',
  'MASA KERJA JABATAN PENEMPATAN 1': 'masaKerja',
}

/** Kata pembuka nama unit organisasi — dipakai MEMERIKSA, bukan menebak. */
const KATA_UNIT = /^(Direktorat|Sekretariat|Balai|Subdirektorat|Bagian|Subbagian|Seksi)/i
const ADA_KATA_UNIT = /(Direktorat|Sekretariat|Balai|Subdirektorat|Bagian|Subbagian|Seksi)/i

export interface EntriRiwayatJabatan {
  nama: string
  masaKerja: string
  tmtMulaiSerial: string
  tmtAkhirSerial: string
}

export interface BarisTalentPool {
  barisExcel: number
  no: string
  nama: string
  nip: string
  tmtGolongan: string
  golongan: string
  eselon: string
  namaJabatan: string
  unitKerja: string
  tmtJabatan: string
  sekolah: string
  bidangStudi: string
  tingkatPendidikan: string
  jurusan: string
  riwayatPendidikan: string
  jenjangAsesmen: string
  tahunAsesmen: string
  jenisAsesmen: string
  statusAsesmen: string
  potkom: string
  ratingKinerja: string
  kotak9Sumber: string
  tmtDiklat: string
  riwayatJabatan: EntriRiwayatJabatan[]
  riwayatDiklat: string[]
  /** Alasan baris ini perlu ditinjau manusia. Kosong = bersih. */
  perluTinjau: string[]
}

export interface HasilBacaTalentPool {
  baris: BarisTalentPool[]
  /** Label header yang tidak dikenali — dilaporkan, bukan diabaikan diam-diam. */
  labelTakDikenal: string[]
  /** Nomor baris Excel pertama yang memuat data. */
  barisDataPertama: number
}

const rapatkan = (t: string) => t.replace(/\s+/g, ' ').trim().toUpperCase()

/**
 * Header dicari di tiga baris pertama dan hanya diterima kalau **minimal 8 label
 * dikenali**.
 *
 * Ambang itu bukan kehati-hatian berlebihan: satu sel berisi kata "NIP" di tengah
 * data tidak boleh diperlakukan sebagai header, sebab akibatnya SELURUH berkas
 * dibaca dengan pergeseran kolom yang salah — dan hasilnya tetap "masuk akal"
 * sehingga tidak ada yang gagal.
 */
function petaKolom(l: Lembar): {
  tunggal: Map<number, string>
  berulang: Map<number, string>
  barisData: number
  takDikenal: string[]
} {
  for (const n of [1, 2, 3]) {
    const label = new Map<number, string>()
    for (let k = 1; k <= l.kolomMaks; k++) {
      const v = l.sel.get(`${n}:${k}`)
      if (v !== undefined) label.set(k, rapatkan(v))
    }
    const tunggal = new Map<number, string>()
    const berulang = new Map<number, string>()
    for (const [k, v] of label) {
      if (LABEL_TUNGGAL[v]) tunggal.set(k, LABEL_TUNGGAL[v]!)
      else if (LABEL_BERULANG[v]) berulang.set(k, LABEL_BERULANG[v]!)
    }
    if (tunggal.size < 8) continue

    /*
      Kolom masa kerja yang HEADER-nya membentang (merged).

      Di berkas ES 2 & 3, header `RIWAYAT JABATAN` merged melintasi I:J, sehingga
      kolom J — yang berisi masa kerja setiap entri riwayat — tidak punya label
      sendiri. Pemetaan berbasis nama tidak bisa menemukannya, dan akibatnya
      `masaKerja` sunyi jadi kosong untuk 229 baris riwayat: bukan galat, bukan
      peringatan, cuma field yang hilang.

      Aturannya eksplisit: kolom PERSIS DI KANAN `RIWAYAT JABATAN` yang TIDAK
      berlabel adalah kolom masa kerja. Di berkas Pengawas kolom itu berlabel
      (`TMT MASA KERJA 1`), jadi aturan ini tidak menyentuhnya.
    */
    const kJab = [...berulang.entries()].find(([, v]) => v === 'riwayatJabatan')?.[0]
    if (kJab !== undefined && ![...berulang.values()].includes('masaKerja')) {
      if (!label.has(kJab + 1)) berulang.set(kJab + 1, 'masaKerja')
    }

    const dikenal = new Set([...Object.keys(LABEL_TUNGGAL), ...Object.keys(LABEL_BERULANG)])
    const takDikenal = [...new Set([...label.values()].filter((v) => !dikenal.has(v)))].sort()
    return { tunggal, berulang, barisData: n + 1, takDikenal }
  }
  throw new Error(
    'Header tidak dikenali. Berkas harus memuat baris judul kolom (NO, NAMA LENGKAP, NIP, …) ' +
      'di salah satu dari tiga baris pertama — minimal 8 judul yang dikenali.',
  )
}

/** Baca berkas Talent Pool. `buf` = isi `.xlsx` apa adanya. */
export function bacaTalentPool(buf: Buffer): HasilBacaTalentPool {
  const l = bacaXlsx(buf)
  const { tunggal, berulang, barisData, takDikenal } = petaKolom(l)

  // field → kolom, sebab satu field bisa tidak ada di berkas tertentu.
  const kolomUntuk = new Map<string, number>()
  for (const [k, v] of berulang) kolomUntuk.set(v, k)
  const kNo = [...tunggal.entries()].find(([, v]) => v === 'no')?.[0] ?? 1

  /*
    Awal blok = baris yang kolom NO-nya berisi ANGKA BULAT.

    Inilah yang membuat berkas ini bisa dibaca sama sekali: ia bukan satu baris per
    pegawai. Terukur pada `TALENT POOL PENGAWAS#2 fix.xlsx`: 653 baris berisi, hanya
    53 ber-NIP; 600 sisanya baris LANJUTAN yang memuat riwayat jabatan/pelatihan
    milik pegawai di atasnya. Menempelkannya sebagai baris pegawai akan menghasilkan
    600 baris tanpa NIP.
  */
  const awal: number[] = []
  for (let n = barisData; n <= l.barisMaks; n++) {
    const v = l.sel.get(`${n}:${kNo}`)
    if (v !== undefined && /^\d+$/.test(v)) awal.push(n)
  }

  const baris: BarisTalentPool[] = []
  for (let i = 0; i < awal.length; i++) {
    const n = awal[i]!
    const akhir = i + 1 < awal.length ? awal[i + 1]! - 1 : l.barisMaks
    const ambil = (kolom: number | undefined, r = n) =>
      kolom === undefined ? '' : (l.sel.get(`${r}:${kolom}`) ?? '')

    const rec: Record<string, unknown> = { barisExcel: n }
    for (const [k, field] of tunggal) rec[field] = ambil(k)
    for (const field of Object.values(LABEL_TUNGGAL)) if (rec[field] === undefined) rec[field] = ''

    const kJab = kolomUntuk.get('riwayatJabatan')
    const kMasa = kolomUntuk.get('masaKerja')
    const kMulai = kolomUntuk.get('tmtMulai')
    const riwayatJabatan: EntriRiwayatJabatan[] = []
    if (kJab !== undefined) {
      for (let m = n; m <= akhir; m++) {
        const nama = l.sel.get(`${m}:${kJab}`)
        if (!nama) continue
        riwayatJabatan.push({
          nama,
          masaKerja: ambil(kMasa, m),
          // Serial Excel apa adanya (mis. 45940), bukan tanggal terbaca —
          // penerjemahannya tugas importir supaya modul ini tetap pemindah
          // tanpa tafsir.
          tmtMulaiSerial: ambil(kMulai, m),
          // Kolom TEPAT SETELAH kolom mulai adalah tanggal AKHIR. Headernya di
          // berkas Pengawas cuma "1" sehingga tidak bisa dipetakan lewat nama —
          // tapi ia bukan dugaan: selisih (akhir − mulai) dicocokkan dengan kolom
          // durasi "MASA KERJA JABATAN PENEMPATAN" dan cocok 386 dari 386 entri.
          tmtAkhirSerial: kMulai === undefined ? '' : ambil(kMulai + 1, m),
        })
      }
    }

    const kDiklat = kolomUntuk.get('riwayatDiklat')
    const riwayatDiklat: string[] = []
    if (kDiklat !== undefined) {
      for (let m = n; m <= akhir; m++) {
        const v = l.sel.get(`${m}:${kDiklat}`)
        if (v) riwayatDiklat.push(v)
      }
    }
    const kTmtDiklat = kolomUntuk.get('tmtDiklat')
    if (kTmtDiklat !== undefined) rec.tmtDiklat = ambil(kTmtDiklat)
    if (rec.tmtDiklat === undefined) rec.tmtDiklat = ''

    // ── Deteksi, BUKAN perbaikan ────────────────────────────────────────────
    const perluTinjau: string[] = []
    const unit = String(rec.unitKerja ?? '')
    if (unit !== '' && !ADA_KATA_UNIT.test(unit)) {
      perluTinjau.push(
        `kolom UNIT KERJA berisi "${unit}" yang bukan nama unit — selnya kemungkinan tergeser`,
      )
    }
    if (unit === '') {
      perluTinjau.push('kolom UNIT KERJA kosong — seluruh blok kolom sesudahnya kemungkinan tergeser')
    }
    const jenjang = rapatkan(String(rec.tingkatPendidikan ?? ''))
    if (jenjang !== '' && !['SD', 'SLTP', 'SLTA', 'D3', 'D4', 'S1', 'S2', 'S3', 'S1/D4'].includes(jenjang)) {
      perluTinjau.push(`TINGKAT PENDIDIKAN "${rec.tingkatPendidikan}" bukan jenjang yang dikenali`)
    }

    baris.push({ ...(rec as unknown as BarisTalentPool), riwayatJabatan, riwayatDiklat, perluTinjau })
  }

  return { baris, labelTakDikenal: takDikenal, barisDataPertama: barisData }
}

/** Dipakai uji kesetaraan & pesan galat — huruf kolom dari nomornya. */
export { hurufKolom, nomorKolom }
export const KATA_PEMBUKA_UNIT = KATA_UNIT
