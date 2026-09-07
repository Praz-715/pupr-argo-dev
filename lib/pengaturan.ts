import 'server-only'

import { cache } from 'react'

import { kueri } from './db'
import {
  AMBANG_SUMBU,
  BOBOT_FORMULA_A,
  MASA_BERLAKU_ASESMEN_TAHUN_DEFAULT,
  SKOR_PREDIKAT,
} from './scoring/konstanta'
import type { AmbangSumbu, BobotTalenta, ParameterSkoring, SkalaPredikat } from './scoring/types'

/**
 * Parameter sistem yang boleh diubah tanpa deploy (PRD §6.10 & §10.11).
 *
 * **Nilai bawaannya sengaja sama persis dengan konstanta yang sudah dipakai
 * kode sejak Fase 0.** Tabel ini memindahkan tempat menyimpannya, bukan
 * mengubah perilakunya — jadi baris yang hilang, database yang belum
 * dijalankan `012`, atau nilai yang tidak masuk akal semuanya jatuh kembali ke
 * angka yang sudah terbukti, bukan ke nol atau ke error.
 *
 * `lib/scoring` tetap **bebas DB**: ia menerima `masaBerlakuTahun` sebagai
 * argumen, dan pemanggilnya yang mengambil nilainya dari sini. Membalik arah
 * itu (scoring membaca DB) akan membuat rumus tidak bisa diuji murni.
 */

export interface Pengaturan {
  masaBerlakuAsesmenTahun: number
  tahunAsesmenAktif: number
  /** Ambang kategori teratas Kotak 9 (`>= atas`). Lihat `ambangSumbuDari()`. */
  ambangSumbuAtas: number
  /** Ambang kategori tengah Kotak 9 (`>= tengah`). */
  ambangSumbuTengah: number
  /** Skor sumbu Y per predikat kinerja. Lihat `skalaPredikatDari()`. */
  skorPredikatSangatBaik: number
  skorPredikatBaik: number
  skorPredikatButuhPerbaikan: number
  skorPredikatKurang: number
  skorPredikatSangatKurang: number
  /** Bobot Formula A dalam PERSEN bulat (50 = 0,5). Lihat `bobotTalentaDari()`. */
  bobotTalentaKinerja: number
  bobotTalentaPotensial: number
  sesiIdleMenit: number
  sesiMaksimalJam: number
  maksGagalMasuk: number
  kunciAkunMenit: number
}

export const PENGATURAN_BAWAAN: Pengaturan = {
  masaBerlakuAsesmenTahun: MASA_BERLAKU_ASESMEN_TAHUN_DEFAULT,
  tahunAsesmenAktif: 2026,
  ambangSumbuAtas: AMBANG_SUMBU.atas,
  ambangSumbuTengah: AMBANG_SUMBU.tengah,
  skorPredikatSangatBaik: SKOR_PREDIKAT['Sangat Baik'],
  skorPredikatBaik: SKOR_PREDIKAT.Baik,
  skorPredikatButuhPerbaikan: SKOR_PREDIKAT['Butuh Perbaikan'],
  skorPredikatKurang: SKOR_PREDIKAT.Kurang,
  skorPredikatSangatKurang: SKOR_PREDIKAT['Sangat Kurang'],
  bobotTalentaKinerja: BOBOT_FORMULA_A.kinerja * 100,
  bobotTalentaPotensial: BOBOT_FORMULA_A.potensial * 100,
  sesiIdleMenit: 60,
  sesiMaksimalJam: 12,
  maksGagalMasuk: 5,
  kunciAkunMenit: 15,
}

/** Kunci di tabel `pengaturan_sistem` → field di `Pengaturan`. Satu peta, dua arah. */
export const KUNCI_PENGATURAN: Record<string, keyof Pengaturan> = {
  masa_berlaku_asesmen_tahun: 'masaBerlakuAsesmenTahun',
  tahun_asesmen_aktif: 'tahunAsesmenAktif',
  ambang_sumbu_atas: 'ambangSumbuAtas',
  ambang_sumbu_tengah: 'ambangSumbuTengah',
  skor_predikat_sangat_baik: 'skorPredikatSangatBaik',
  skor_predikat_baik: 'skorPredikatBaik',
  skor_predikat_butuh_perbaikan: 'skorPredikatButuhPerbaikan',
  skor_predikat_kurang: 'skorPredikatKurang',
  skor_predikat_sangat_kurang: 'skorPredikatSangatKurang',
  bobot_talenta_kinerja: 'bobotTalentaKinerja',
  bobot_talenta_potensial: 'bobotTalentaPotensial',
  sesi_idle_menit: 'sesiIdleMenit',
  sesi_maksimal_jam: 'sesiMaksimalJam',
  maks_gagal_masuk: 'maksGagalMasuk',
  kunci_akun_menit: 'kunciAkunMenit',
}

export interface BarisPengaturan {
  kunci: string
  nilai: string
  tipe: 'ANGKA' | 'TEKS' | 'BOOLEAN'
  label: string
  deskripsi: string | null
  nilaiMin: number | null
  nilaiMax: number | null
  diubahOleh: string | null
  diubahPada: Date | null
}

/**
 * Nilai efektif seluruh parameter. Di-`cache()` per permintaan: halaman yang
 * membutuhkannya di tiga tempat tidak boleh jadi tiga kueri.
 *
 * Tidak dilempar kalau tabelnya belum ada. Basis data yang belum menjalankan
 * `012` masih menjalankan Fase 0–6 dengan benar memakai nilai bawaan; membuat
 * seluruh aplikasi mati karena satu tabel parameter belum dibuat adalah
 * kegagalan yang jauh lebih besar daripada yang dicegahnya.
 */
export const ambilPengaturan = cache(async (): Promise<Pengaturan> => {
  const hasil = { ...PENGATURAN_BAWAAN }
  let baris: Array<{ kunci: string; nilai: string; tipe: string }>
  try {
    baris = await kueri<{ kunci: string; nilai: string; tipe: string }>(
      'SELECT kunci, nilai, tipe FROM pengaturan_sistem',
    )
  } catch {
    return hasil
  }

  for (const b of baris) {
    const field = KUNCI_PENGATURAN[b.kunci]
    if (!field) continue
    const angka = Number(b.nilai)
    if (!Number.isFinite(angka)) continue
    // Nilai tak masuk akal di DB (kosong, teks, nol) tidak boleh menggantikan
    // bawaan — parameter yang rusak akan menghasilkan timeout 0 menit, artinya
    // tidak ada yang bisa masuk sama sekali.
    //
    // **NOL SAH untuk skor predikat**, dan hanya untuk itu. "Sangat Kurang → 0"
    // adalah pengaturan yang wajar diminta, sementara sesi 0 menit atau bobot 0%
    // pada KEDUA sumbu adalah keadaan yang membuat aplikasinya tidak bisa
    // dipakai. Kalau pengecualian ini tidak ada, nilai 0 yang disimpan pengguna
    // akan diam-diam terbaca sebagai 20 — pengaturan yang menampilkan satu angka
    // dan memakai angka lain.
    const nolBoleh = BOLEH_NOL.has(b.kunci)
    if (angka > 0 || (nolBoleh && angka === 0)) hasil[field] = angka
  }
  return hasil
})

/** Kunci yang nilai 0-nya SAH — lihat alasannya di `ambilPengaturan()`. */
const BOLEH_NOL = new Set([
  'skor_predikat_sangat_baik',
  'skor_predikat_baik',
  'skor_predikat_butuh_perbaikan',
  'skor_predikat_kurang',
  'skor_predikat_sangat_kurang',
  'bobot_talenta_kinerja',
  'bobot_talenta_potensial',
])

/**
 * Bentuk ambang yang diterima `lib/scoring` — dua field pipih jadi satu objek.
 *
 * Ada supaya pemanggil tidak menyusunnya sendiri di enam tempat: `{ atas: p.x,
 * tengah: p.y }` yang ditulis ulang berkali-kali adalah tempat tertukarnya dua
 * angka yang sama tipenya, dan tertukar di satu tempat saja sudah membuat satu
 * halaman mengklasifikasikan orang secara berbeda dari halaman lain.
 *
 * **Urutan terbalik dijaga di sini juga.** Kalau `atas <= tengah`, kategori
 * tengah jadi wilayah kosong (`CASE` memakai cabang pertama yang cocok) dan
 * setiap pegawai jatuh ke teratas atau terbawah. Aksi `ubahPengaturan` sudah
 * menolaknya, tapi baris DB bisa juga diubah lewat SQL langsung — jadi jalur
 * baca ikut jatuh kembali ke bawaan alih-alih menyebarkan keadaan mustahil.
 */
export function ambangSumbuDari(p: Pengaturan): AmbangSumbu {
  if (!(p.ambangSumbuAtas > p.ambangSumbuTengah)) return AMBANG_SUMBU
  return { atas: p.ambangSumbuAtas, tengah: p.ambangSumbuTengah }
}

/** Seluruh baris beserta metadata tampilan — hanya untuk halaman Pengaturan Sistem. */
export async function ambilBarisPengaturan(): Promise<BarisPengaturan[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT p.kunci, p.nilai, p.tipe, p.label, p.deskripsi, p.nilai_min, p.nilai_max,
            u.nama AS diubah_oleh, p.diubah_pada
     FROM pengaturan_sistem p
     LEFT JOIN users u ON u.id = p.diubah_oleh
     ORDER BY p.kunci`,
  )
  return baris.map((r) => ({
    kunci: String(r.kunci),
    nilai: String(r.nilai),
    tipe: String(r.tipe) as BarisPengaturan['tipe'],
    label: String(r.label),
    deskripsi: r.deskripsi === null ? null : String(r.deskripsi),
    nilaiMin: r.nilai_min === null ? null : Number(r.nilai_min),
    nilaiMax: r.nilai_max === null ? null : Number(r.nilai_max),
    diubahOleh: r.diubah_oleh === null ? null : String(r.diubah_oleh),
    diubahPada: r.diubah_pada === null ? null : new Date(String(r.diubah_pada)),
  }))
}

/**
 * Skala predikat efektif.
 *
 * **Urutan menurun ditegakkan di sini juga**, bukan hanya di aksi: skala yang
 * memberi "Kurang" lebih tinggi daripada "Baik" membuat sumbu Y memeringkat
 * orang secara terbalik, dan itu tidak akan pernah muncul sebagai galat — hanya
 * sebagai Kotak 9 yang terlihat aneh. Baris DB masih bisa diubah lewat SQL
 * langsung, jadi jalur baca ikut berjaga (pola yang sama dengan
 * `ambangSumbuDari`).
 */
export function skalaPredikatDari(p: Pengaturan): SkalaPredikat {
  const s: SkalaPredikat = {
    'Sangat Baik': p.skorPredikatSangatBaik,
    Baik: p.skorPredikatBaik,
    'Butuh Perbaikan': p.skorPredikatButuhPerbaikan,
    Kurang: p.skorPredikatKurang,
    'Sangat Kurang': p.skorPredikatSangatKurang,
  }
  const urut = [
    s['Sangat Baik'],
    s.Baik,
    s['Butuh Perbaikan'],
    s.Kurang,
    s['Sangat Kurang'],
  ]
  const menurun = urut.every((v, i) => i === 0 || urut[i - 1]! >= v)
  const wajar = urut.every((v) => Number.isFinite(v) && v >= 0 && v <= 100)
  return menurun && wajar ? s : SKOR_PREDIKAT
}

/**
 * Bobot Formula A efektif — persen bulat di DB → fraksi.
 *
 * Kalau jumlahnya bukan 100, ia **dinormalisasi**, tidak ditolak: pengguna yang
 * baru mengubah satu dari dua kolom lewat SQL langsung sudah punya keadaan
 * 60+50, dan menolaknya berarti jatuh ke 50/50 — yaitu MENGABAIKAN kedua angka
 * yang ia tulis. Menormalisasi tetap menghormati perbandingannya. Yang benar-
 * benar tidak bisa diselamatkan hanya jumlah nol; itu jatuh ke bawaan.
 */
export function bobotTalentaDari(p: Pengaturan): BobotTalenta {
  const k = Number(p.bobotTalentaKinerja)
  const x = Number(p.bobotTalentaPotensial)
  if (!Number.isFinite(k) || !Number.isFinite(x) || k < 0 || x < 0) return BOBOT_FORMULA_A
  const jumlah = k + x
  if (jumlah <= 0) return BOBOT_FORMULA_A
  return { kinerja: k / jumlah, potensial: x / jumlah }
}

/**
 * Ketiga parameter skoring sebagai satu objek — bentuk yang diterima
 * `lib/scoring` & `lib/importer`.
 *
 * Ada supaya pemanggil tidak menyusunnya sendiri di belasan tempat, alasan yang
 * sama dengan `ambangSumbuDari()`: objek yang dirakit ulang berkali-kali adalah
 * tempat satu field-nya tertinggal, dan yang tertinggal tidak menghasilkan galat
 * — hanya satu halaman yang berhitung berbeda dari halaman lain.
 */
export function parameterSkoringDari(p: Pengaturan): ParameterSkoring {
  return {
    ambang: ambangSumbuDari(p),
    skalaPredikat: skalaPredikatDari(p),
    bobotTalenta: bobotTalentaDari(p),
  }
}
