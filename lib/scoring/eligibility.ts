import { bakukanGolongan, memenuhiGolongan } from '../golongan'
import { URUTAN_PENDIDIKAN, type TingkatPendidikan } from '../normalisasi'
import { asesmenLayakDipakai } from './asesmen'
import type { StatusAsesmen } from './types'

/**
 * Seleksi Kelayakan (Blueprint langkah 3) — cek `jabatan_target_persyaratan`
 * terhadap profil pegawai.
 *
 * KENYATAAN DATA: di data yang ada, hanya `PENDIDIKAN_MIN` punya
 * `nilai_minimal` terstruktur. `BIDANG_ILMU` & `PENGALAMAN_MIN` baru berisi
 * deskripsi untuk dibaca manusia. Jadi syarat tanpa `nilai_minimal` TIDAK
 * dianggap lolos maupun gagal — ditandai **perlu verifikasi manual**, supaya
 * tidak ada kandidat yang tersaring/lolos diam-diam oleh tebakan mesin
 * (phase.md §2, §9 no. 6).
 */

/**
 * Jenis persyaratan yang dikenal mesin kelayakan — **daftar runtime**, dan tipenya
 * diturunkan darinya.
 *
 * ⚠️ Sebelumnya `JenisSyarat` hanya berupa union TIPE, sementara `JENIS_SYARAT` di
 * `lib/aksi/jabatan-target.ts` (yang memvalidasi form) ditulis TANGAN sebagai daftar
 * kedua. Bentuk kegagalannya persis yang sudah menggigit di `AKSI_SAH` hari yang
 * sama: jenis baru muncul di dropdown karena UI membaca tipenya, lalu Simpan ditolak
 * *"Jenis syarat tidak dikenali"* — nol galat kompilasi, nol uji merah, sebab
 * keduanya memang benar sendiri-sendiri.
 *
 * Diturunkan, jadi jenis berikutnya tidak BISA lupa disambungkan.
 */
export const SEMUA_JENIS_SYARAT = [
  'PENDIDIKAN_MIN',
  'BIDANG_ILMU',
  'PENGALAMAN_MIN',
  'GOLONGAN_MIN',
  'LAINNYA',
] as const

/**
 * Gerbang yang TIDAK disimpan sebagai baris persyaratan.
 *
 * `JABATAN_ASAL` diturunkan dari daftar **Jabatan Asal Kandidat** milik jabatan
 * target (tabel `jabatan_target_anggota` sejak `doc/sql/033`), bukan dari
 * `jabatan_target_persyaratan`. Ia tetap muncul sebagai baris rincian kelayakan
 * supaya alasan gugurnya terbaca di tempat yang sama dengan syarat lain — yang
 * berbeda cuma dari mana nilainya datang.
 *
 * Dipisah dari `SEMUA_JENIS_SYARAT` dengan sengaja: daftar itu mengisi enum kolom
 * DB **dan** pilihan di form Persyaratan. Kalau `JABATAN_ASAL` ikut di sana, ia
 * akan ditawarkan sebagai syarat yang bisa diketik manual — dan sejak itu ada DUA
 * tempat yang menjawab "jabatan mana yang boleh dinominasikan", yang pasti
 * berselisih.
 */
export const JENIS_SYARAT_VIRTUAL = ['JABATAN_ASAL'] as const

export type JenisSyarat =
  | (typeof SEMUA_JENIS_SYARAT)[number]
  | (typeof JENIS_SYARAT_VIRTUAL)[number]

export type Eselon = 'I' | 'II' | 'III' | 'IV' | 'NON_ESELON'

const URUTAN_ESELON: Record<Eselon, number> = {
  NON_ESELON: 0,
  IV: 1,
  III: 2,
  II: 3,
  I: 4,
}

export interface Persyaratan {
  id: number
  jenisSyarat: JenisSyarat
  deskripsi: string
  nilaiMinimal: string | null
  /**
   * Lama minimal **pada jenjang** di `nilaiMinimal`, dalam tahun (`doc/sql/019`).
   *
   * Hanya bermakna untuk `PENGALAMAN_MIN` berbentuk eselon: lembar Persyaratan
   * Jabatan menulis "pengawas **paling singkat 3 tahun**", dan jenjang tanpa durasi
   * meloloskan orang yang baru sebulan di jenjang itu. `null` = durasinya tidak
   * dipersyaratkan.
   */
  durasiTahunMin?: number | null
}

export interface ProfilKelayakan {
  tingkatPendidikan: TingkatPendidikan | null
  /** Bidang studi dari seluruh riwayat pendidikan (sudah dinormalisasi). */
  bidangStudi: string[]
  /** Eselon tertinggi yang pernah dijabat (dari riwayat jabatan terpetakan). */
  eselonTertinggi: Eselon | null
  /** Total tahun pengalaman jabatan; null bila data riwayat belum bertanggal. */
  totalPengalamanTahun: number | null
  /**
   * Golongan/pangkat saat ini, apa adanya dari `pegawai.golongan` (mis. `III/d`).
   * `null` = belum terisi, yang berbeda dari golongan terendah.
   */
  golongan: string | null
  /**
   * Id jabatan yang SEDANG dijabat. Dipakai gerbang `JABATAN_ASAL`.
   *
   * `null` = pegawainya belum tertaut jabatan mana pun — yang BERBEDA dari
   * "jabatannya di luar daftar", dan dijawab PERLU_VERIFIKASI_MANUAL, bukan
   * digugurkan.
   */
  jabatanIdSekarang: number | null
  asesmen: { tahunAsesmen: number; statusAsesmen: StatusAsesmen | null } | null
}

/** Satu jabatan asal kandidat; namanya ikut supaya alasan gugurnya bisa dibaca. */
export interface JabatanAsal {
  id: number
  nama: string
}

export type StatusSyarat = 'TERPENUHI' | 'TIDAK_TERPENUHI' | 'PERLU_VERIFIKASI_MANUAL'

export interface RincianSyarat {
  persyaratanId: number
  jenisSyarat: JenisSyarat
  deskripsi: string
  status: StatusSyarat
  keterangan: string
}

export interface HasilKelayakan {
  /** false hanya kalau ada syarat yang benar-benar TIDAK terpenuhi. */
  eligible: boolean
  /** true bila masih ada syarat yang belum bisa diperiksa mesin. */
  perluVerifikasiManual: boolean
  rincian: RincianSyarat[]
  /** Ringkasan siap simpan ke `match_score.catatan_eligibility`. */
  catatan: string
}

function cekPendidikan(syarat: Persyaratan, profil: ProfilKelayakan): RincianSyarat {
  const dasar = {
    persyaratanId: syarat.id,
    jenisSyarat: syarat.jenisSyarat,
    deskripsi: syarat.deskripsi,
  }

  const minimal = (syarat.nilaiMinimal ?? '').trim() as TingkatPendidikan
  if (!minimal || !(minimal in URUTAN_PENDIDIKAN)) {
    return {
      ...dasar,
      status: 'PERLU_VERIFIKASI_MANUAL',
      keterangan: 'Syarat pendidikan minimal belum diisi terstruktur pada profil jabatan target',
    }
  }

  if (!profil.tingkatPendidikan) {
    return {
      ...dasar,
      status: 'PERLU_VERIFIKASI_MANUAL',
      keterangan: 'Tingkat pendidikan pegawai belum terdata',
    }
  }

  const punya = URUTAN_PENDIDIKAN[profil.tingkatPendidikan]
  const butuh = URUTAN_PENDIDIKAN[minimal]
  const terpenuhi = punya >= butuh

  return {
    ...dasar,
    status: terpenuhi ? 'TERPENUHI' : 'TIDAK_TERPENUHI',
    keterangan: terpenuhi
      ? `Pendidikan ${profil.tingkatPendidikan} memenuhi syarat minimal ${minimal}`
      : `Pendidikan ${profil.tingkatPendidikan} di bawah syarat minimal ${minimal}`,
  }
}

function cekBidangIlmu(syarat: Persyaratan, profil: ProfilKelayakan): RincianSyarat {
  const dasar = {
    persyaratanId: syarat.id,
    jenisSyarat: syarat.jenisSyarat,
    deskripsi: syarat.deskripsi,
  }

  const daftar = (syarat.nilaiMinimal ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s !== '')

  if (daftar.length === 0) {
    return {
      ...dasar,
      status: 'PERLU_VERIFIKASI_MANUAL',
      keterangan: 'Daftar bidang ilmu yang diterima belum diisi terstruktur — periksa deskripsi',
    }
  }

  if (daftar.includes('semua')) {
    return { ...dasar, status: 'TERPENUHI', keterangan: 'Semua bidang ilmu diperbolehkan' }
  }

  const dimiliki = profil.bidangStudi.map((b) => b.toLowerCase())
  const cocok = daftar.find((kunci) => dimiliki.some((b) => b.includes(kunci)))

  return {
    ...dasar,
    status: cocok ? 'TERPENUHI' : 'TIDAK_TERPENUHI',
    keterangan: cocok
      ? `Bidang ilmu sesuai (kata kunci "${cocok}")`
      : `Tidak ada riwayat pendidikan pada bidang: ${daftar.join(', ')}`,
  }
}

/**
 * Golongan minimal — syarat KERAS PP 11/2017, jadi ia benar-benar menggugurkan.
 *
 * Keputusan pemilik proses 25 Agu 2026: *"menggugurkan"*, dengan catatan
 * penolakannya selalu menyebut alasannya — supaya tidak ada kandidat yang hilang
 * dari daftar tanpa keterangan.
 *
 * Tiga keadaan, tiga perlakuan berbeda, dan pembedaannya yang penting:
 *   - golongan pegawai **kosong / tak dikenali** → perlu verifikasi manual, BUKAN
 *     gugur. Data yang belum ada bukan bukti bahwa syaratnya tidak dipenuhi.
 *   - syarat **tak dikenali** → perlu verifikasi manual, dan keterangannya menyebut
 *     tulisan yang tidak dikenali itu supaya bisa dibetulkan di tab Persyaratan.
 *   - keduanya dikenali → dibandingkan, dan hasilnya mengikat.
 */
/**
 * Kandidat harus SEDANG menjabat salah satu **Jabatan Asal Kandidat** jabatan target.
 *
 * Permintaan pemilik proses 1 Sep 2026: *"si jabatan anggota itu mending buat pilih
 * jabatan yang bisa dinominasikan aja"*, lalu — sesudah daftarnya terisi — *"kalo
 * udah masuk semua jabatan anggota, di persyaratan Rumpun jabatan asal ilangin aja,
 * jadi fungsinya diganti ke jabatan anggota"*.
 *
 * ## Satu gerbang, bukan dua
 *
 * Versi sebelumnya (1 Sep 2026, beberapa jam lebih awal) menyimpan aturannya sebagai
 * syarat `RUMPUN_JABATAN` berisi daftar rumpun. Begitu daftar jabatan konkretnya ada,
 * keduanya menjawab pertanyaan yang SAMA dari dua tempat — dan dua sumber kebenaran
 * atas satu pertanyaan adalah cacat yang sudah berulang kali menggigit di repo ini.
 * Yang bertahan daftar konkretnya, sebab itu yang bisa dilihat & disunting per
 * jabatan; rumpun tinggal dipakai untuk MENGISINYA sekali.
 *
 * ## Daftar kosong = tidak menyaring
 *
 * Draft baru lahir tanpa daftar (permintaan pemilik proses: *"defaultnya kosong"*).
 * Gerbang yang menggugurkan semua orang selama daftarnya belum diisi akan membuat
 * setiap draft baru tampak rusak. Karena itu pemanggilnya tidak menyertakan rincian
 * ini sama sekali ketika daftarnya kosong — bukan meloloskannya diam-diam.
 */
function cekJabatanAsal(
  jabatanAsal: JabatanAsal[],
  profil: ProfilKelayakan,
): RincianSyarat {
  const dasar = {
    // Bukan baris `jabatan_target_persyaratan`, jadi tidak punya id di sana.
    persyaratanId: 0,
    jenisSyarat: 'JABATAN_ASAL' as const,
    deskripsi: 'Jabatan asal kandidat',
  }

  // Belum tertaut jabatan ≠ jabatannya di luar daftar. Menggugurkan yang pertama
  // berarti menghukum ketiadaan data, bukan ketidaksesuaian — aturan yang sama
  // dengan golongan kosong (PP 11/2017, `doc/sql/019`).
  if (profil.jabatanIdSekarang === null) {
    return {
      ...dasar,
      status: 'PERLU_VERIFIKASI_MANUAL',
      keterangan: `Jabatan pegawai belum terisi (${jabatanAsal.length} jabatan asal disyaratkan)`,
    }
  }

  const cocok = jabatanAsal.find((j) => j.id === profil.jabatanIdSekarang)
  return {
    ...dasar,
    status: cocok ? 'TERPENUHI' : 'TIDAK_TERPENUHI',
    keterangan: cocok
      ? `Sedang menjabat "${cocok.nama}", termasuk jabatan asal kandidat`
      : `Jabatan sekarang bukan salah satu dari ${jabatanAsal.length} jabatan asal kandidat`,
  }
}

function cekGolongan(syarat: Persyaratan, profil: ProfilKelayakan): RincianSyarat {
  const dasar = {
    persyaratanId: syarat.id,
    jenisSyarat: syarat.jenisSyarat,
    deskripsi: syarat.deskripsi,
  }

  const minimal = bakukanGolongan(syarat.nilaiMinimal)
  if (minimal === null) {
    return {
      ...dasar,
      status: 'PERLU_VERIFIKASI_MANUAL',
      keterangan:
        (syarat.nilaiMinimal ?? '').trim() === ''
          ? 'Syarat golongan belum diisi terstruktur — periksa deskripsi'
          : `Golongan minimal "${syarat.nilaiMinimal}" tidak dikenali`,
    }
  }

  const punya = bakukanGolongan(profil.golongan)
  if (punya === null) {
    return {
      ...dasar,
      status: 'PERLU_VERIFIKASI_MANUAL',
      keterangan: `Golongan pegawai belum terisi (syarat minimal ${minimal})`,
    }
  }

  const cukup = memenuhiGolongan(punya, minimal)
  return {
    ...dasar,
    status: cukup ? 'TERPENUHI' : 'TIDAK_TERPENUHI',
    keterangan: cukup
      ? `Golongan ${punya} memenuhi syarat minimal ${minimal}`
      : `Golongan ${punya} di bawah syarat minimal ${minimal}`,
  }
}

function cekPengalaman(syarat: Persyaratan, profil: ProfilKelayakan): RincianSyarat {
  const dasar = {
    persyaratanId: syarat.id,
    jenisSyarat: syarat.jenisSyarat,
    deskripsi: syarat.deskripsi,
  }

  const minimal = (syarat.nilaiMinimal ?? '').trim()
  if (minimal === '') {
    return {
      ...dasar,
      status: 'PERLU_VERIFIKASI_MANUAL',
      keterangan: 'Syarat pengalaman belum diisi terstruktur — periksa deskripsi',
    }
  }

  // Bentuk 1: eselon minimal ("III", "IV")
  const sebagaiEselon = minimal.toUpperCase() as Eselon
  if (sebagaiEselon in URUTAN_ESELON) {
    if (!profil.eselonTertinggi) {
      return {
        ...dasar,
        status: 'PERLU_VERIFIKASI_MANUAL',
        keterangan: 'Riwayat jabatan pegawai belum terpetakan ke master jabatan',
      }
    }
    const terpenuhi = URUTAN_ESELON[profil.eselonTertinggi] >= URUTAN_ESELON[sebagaiEselon]
    if (!terpenuhi) {
      return {
        ...dasar,
        status: 'TIDAK_TERPENUHI',
        keterangan: `Eselon tertinggi ${profil.eselonTertinggi} di bawah syarat minimal ${sebagaiEselon}`,
      }
    }

    /*
      Jenjangnya terpenuhi. Kalau syaratnya juga menyebut DURASI ("paling singkat 3
      tahun"), jenjang saja belum menjawabnya — dan kita belum bisa menjawabnya
      sendiri: lama menjabat PADA JENJANG ITU menuntut riwayat jabatan yang
      terpetakan ke master DAN bertanggal, dan di data nyata baru 5% memenuhi
      keduanya. `totalPengalamanTahun` tidak bisa dipakai sebagai gantinya: ia total
      SELURUH jabatan, jadi memakainya akan meloloskan orang yang lama bekerja tapi
      baru sebentar di jenjang yang dipersyaratkan — tepat kekeliruan yang syarat
      durasi ini ada untuk mencegah.

      Jadi statusnya PERLU_VERIFIKASI_MANUAL, dengan keterangan yang menyebut angka
      syaratnya supaya pemeriksanya tahu apa yang harus dicek. Menyatakan TERPENUHI
      di sini akan menyembunyikan syarat yang belum pernah diperiksa siapa pun.
    */
    const durasi = syarat.durasiTahunMin ?? null
    if (durasi !== null && durasi > 0) {
      return {
        ...dasar,
        status: 'PERLU_VERIFIKASI_MANUAL',
        keterangan: `Pernah menjabat eselon ${profil.eselonTertinggi} (syarat minimal ${sebagaiEselon}), tapi LAMA menjabatnya belum bisa dihitung otomatis — periksa manual: minimal ${durasi} tahun`,
      }
    }

    return {
      ...dasar,
      status: 'TERPENUHI',
      keterangan: `Pernah menjabat eselon ${profil.eselonTertinggi} (syarat minimal ${sebagaiEselon})`,
    }
  }

  // Bentuk 2: jumlah tahun minimal
  const tahunMinimal = Number(minimal)
  if (!Number.isNaN(tahunMinimal)) {
    if (profil.totalPengalamanTahun === null) {
      return {
        ...dasar,
        status: 'PERLU_VERIFIKASI_MANUAL',
        keterangan: 'Riwayat jabatan belum bertanggal, lama pengalaman tidak bisa dihitung',
      }
    }
    const terpenuhi = profil.totalPengalamanTahun >= tahunMinimal
    return {
      ...dasar,
      status: terpenuhi ? 'TERPENUHI' : 'TIDAK_TERPENUHI',
      keterangan: `Pengalaman ${profil.totalPengalamanTahun.toFixed(1)} tahun vs syarat minimal ${tahunMinimal} tahun`,
    }
  }

  return {
    ...dasar,
    status: 'PERLU_VERIFIKASI_MANUAL',
    keterangan: `Format syarat pengalaman "${minimal}" tidak dikenali`,
  }
}

export function evaluasiKelayakan(
  persyaratan: Persyaratan[],
  profil: ProfilKelayakan,
  opsi: {
    tahunSekarang?: number
    masaBerlakuTahun?: number
    /**
     * Jabatan asal kandidat milik jabatan target (`jabatan_target_anggota`).
     * Kosong / tidak diisi = gerbang ini TIDAK dipasang sama sekali.
     */
    jabatanAsal?: JabatanAsal[]
  } = {},
): HasilKelayakan {
  const rincian: RincianSyarat[] = persyaratan.map((syarat) => {
    switch (syarat.jenisSyarat) {
      case 'PENDIDIKAN_MIN':
        return cekPendidikan(syarat, profil)
      case 'BIDANG_ILMU':
        return cekBidangIlmu(syarat, profil)
      case 'PENGALAMAN_MIN':
        return cekPengalaman(syarat, profil)
      case 'GOLONGAN_MIN':
        return cekGolongan(syarat, profil)
      default:
        return {
          persyaratanId: syarat.id,
          jenisSyarat: syarat.jenisSyarat,
          deskripsi: syarat.deskripsi,
          status: 'PERLU_VERIFIKASI_MANUAL' as StatusSyarat,
          keterangan: 'Syarat bebas (LAINNYA) — perlu penilaian manusia',
        }
    }
  })

  /*
    Gerbang JABATAN ASAL ditempelkan SESUDAH persyaratan, bukan dicampur ke
    dalamnya: sumbernya tabel yang berbeda, dan menaruhnya di `persyaratan` akan
    menuntut baris palsu ber-id yang tidak ada di `jabatan_target_persyaratan`.
    Daftar kosong berarti gerbangnya tidak ada — bukan gerbang yang meloloskan
    semua, sebab yang kedua tetap memajang baris rincian yang tidak menjelaskan apa pun.
  */
  if (opsi.jabatanAsal !== undefined && opsi.jabatanAsal.length > 0) {
    rincian.push(cekJabatanAsal(opsi.jabatanAsal, profil))
  }

  // Asesmen kedaluwarsa membatalkan kelayakan (phase.md §2.9).
  if (!profil.asesmen) {
    rincian.push({
      persyaratanId: 0,
      jenisSyarat: 'LAINNYA',
      deskripsi: 'Asesmen talenta yang berlaku',
      status: 'TIDAK_TERPENUHI',
      keterangan: 'Pegawai belum punya data asesmen talenta',
    })
  } else {
    const layak = asesmenLayakDipakai(
      profil.asesmen.tahunAsesmen,
      profil.asesmen.statusAsesmen,
      opsi,
    )
    rincian.push({
      persyaratanId: 0,
      jenisSyarat: 'LAINNYA',
      deskripsi: 'Asesmen talenta yang berlaku',
      status: layak ? 'TERPENUHI' : 'TIDAK_TERPENUHI',
      keterangan: layak
        ? `Asesmen tahun ${profil.asesmen.tahunAsesmen} masih berlaku`
        : `Asesmen tahun ${profil.asesmen.tahunAsesmen} sudah kedaluwarsa atau berstatus draft`,
    })
  }

  const gagal = rincian.filter((r) => r.status === 'TIDAK_TERPENUHI')
  const manual = rincian.filter((r) => r.status === 'PERLU_VERIFIKASI_MANUAL')

  const catatan =
    gagal.length > 0
      ? `Tidak memenuhi ${gagal.length} syarat: ${gagal.map((r) => r.keterangan).join('; ')}`
      : manual.length > 0
        ? `Memenuhi semua syarat yang bisa diperiksa otomatis; ${manual.length} syarat perlu verifikasi manual`
        : 'Memenuhi seluruh persyaratan jabatan target'

  return {
    eligible: gagal.length === 0,
    perluVerifikasiManual: manual.length > 0,
    rincian,
    catatan,
  }
}
