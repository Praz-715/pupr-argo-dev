import {
  JENJANG_STRUKTURAL,
  usulkanKategoriJabatan,
  type JenjangStruktural,
} from './kategori-jabatan'
import { selisihTahun } from './nip'

/**
 * Total lama pengalaman seseorang PER JENJANG, dijumlahkan dari riwayat jabatannya.
 *
 * Permintaan pemilik proses (`2 sept- masukan sistem informasi.pdf`, butir 3):
 * *"Agar dibuatkan dalam penilaian isi manual ini adalah pilihan dan VERIFIKATOR
 * tinggal pilih mana yang akan digunakan: Lama Pengalaman pada jenjang Jabatan
 * Pengawas … Administrator … Pimpinan Tinggi Pratama/Eselon II."*
 *
 * ## Kenapa dihitung di sini, bukan di `nilaiLamaJabatan()`
 *
 * `nilaiLamaJabatan()` (lib/penilaian.ts) menjawab pertanyaan yang berbeda: *"berapa
 * lama orang ini pada jenjang jabatannya SEKARANG"*, dan ia hanya boleh memakai
 * sumber yang bisa dipertanggungjawabkan — riwayat yang sudah dipetakan ke master.
 * Modul ini menjawab *"pilihan apa saja yang bisa diambil verifikator"*, dan
 * karenanya boleh memakai **usulan** klasifikasi atas teks bebas: hasilnya tidak
 * pernah menjadi skor dengan sendirinya, ia baru berlaku setelah seorang manusia
 * memilihnya dan menuliskan alasannya.
 *
 * Pemisahan itu yang membuat pencocokan samar aman di sini — batas yang sama yang
 * dipegang `lib/kategori-riwayat.ts` untuk diklat: **mengusulkan boleh, menulis
 * tidak.**
 *
 * ## PLT/PLH dipisah, tidak dijumlahkan diam-diam
 *
 * Penugasan sementara bukan masa jabatan definitif. Ia tetap DIHITUNG dan
 * ditampilkan sebagai angka tersendiri supaya verifikator bisa memutuskan —
 * membuangnya berarti menyembunyikan sesuatu yang mungkin memang relevan, dan
 * menjumlahkannya diam-diam berarti menaikkan masa kerja seseorang atas dasar
 * penugasan yang bisa cuma sebulan.
 */

export interface BarisRiwayatJenjang {
  namaMentah: string
  namaUnit: string | null
  tanggalMulai: Date | null
  tanggalAkhir: Date | null
  lamaBulan: number | null
}

export interface RincianBarisJenjang {
  namaMentah: string
  namaUnit: string | null
  tahun: number
  /** `null` = dihitung dari `lamaBulan`, bukan dari rentang tanggal. */
  tanggalMulai: Date | null
  tanggalAkhir: Date | null
  penugasan: 'DEFINITIF' | 'PLT' | 'PLH'
}

export interface RingkasJenjang {
  jenjang: JenjangStruktural
  eselon: 'II' | 'III' | 'IV'
  /** Total tahun dari baris DEFINITIF saja. */
  totalTahun: number
  /** Total tahun dari baris PLT/PLH pada jenjang ini — dipajang terpisah. */
  totalTahunSementara: number
  baris: RincianBarisJenjang[]
}

/** Lama satu baris riwayat dalam tahun. Tanggal lebih dipercaya daripada durasi. */
function lamaTahun(b: BarisRiwayatJenjang, sekarang: Date): number {
  if (b.tanggalMulai !== null) {
    const akhir = b.tanggalAkhir ?? sekarang
    return selisihTahun(b.tanggalMulai, akhir) ?? 0
  }
  return b.lamaBulan === null ? 0 : b.lamaBulan / 12
}

const bulat2 = (n: number) => Math.round(n * 100) / 100

/**
 * Kembalikan KETIGA jenjang selalu — termasuk yang totalnya nol.
 *
 * Menyembunyikan jenjang tanpa riwayat akan membuat daftar pilihannya berubah
 * bentuk dari pegawai ke pegawai, dan verifikator tidak bisa membedakan "tidak ada
 * pengalaman di jenjang itu" dari "pilihannya belum dimuat". Angka nol menyatakan
 * yang pertama; ketiadaan baris tidak menyatakan apa pun.
 */
export function ringkasPengalamanJenjang(
  riwayat: BarisRiwayatJenjang[],
  sekarang: Date = new Date(),
): RingkasJenjang[] {
  const peta = new Map<JenjangStruktural, RingkasJenjang>()
  for (const j of JENJANG_STRUKTURAL) {
    peta.set(j.jenjang, {
      jenjang: j.jenjang,
      eselon: j.eselon,
      totalTahun: 0,
      totalTahunSementara: 0,
      baris: [],
    })
  }

  for (const b of riwayat) {
    const u = usulkanKategoriJabatan(b.namaMentah)
    if (u.jenjang === null) continue
    const ringkas = peta.get(u.jenjang)
    if (ringkas === undefined) continue

    const tahun = bulat2(lamaTahun(b, sekarang))
    if (u.penugasan === 'DEFINITIF') ringkas.totalTahun += tahun
    else ringkas.totalTahunSementara += tahun

    ringkas.baris.push({
      namaMentah: b.namaMentah,
      namaUnit: b.namaUnit,
      tahun,
      tanggalMulai: b.tanggalMulai,
      tanggalAkhir: b.tanggalAkhir,
      penugasan: u.penugasan,
    })
  }

  return [...peta.values()].map((r) => ({
    ...r,
    totalTahun: bulat2(r.totalTahun),
    totalTahunSementara: bulat2(r.totalTahunSementara),
    // Yang terlama dulu — verifikator membaca daftar ini untuk memilih, dan baris
    // terpanjang hampir selalu yang menentukan angkanya.
    baris: r.baris.sort((a, b2) => b2.tahun - a.tahun),
  }))
}
