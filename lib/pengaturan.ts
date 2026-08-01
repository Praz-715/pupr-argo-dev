import 'server-only'

import { cache } from 'react'

import { kueri } from './db'
import { MASA_BERLAKU_ASESMEN_TAHUN_DEFAULT } from './scoring/konstanta'

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
  sesiIdleMenit: number
  sesiMaksimalJam: number
  maksGagalMasuk: number
  kunciAkunMenit: number
}

export const PENGATURAN_BAWAAN: Pengaturan = {
  masaBerlakuAsesmenTahun: MASA_BERLAKU_ASESMEN_TAHUN_DEFAULT,
  tahunAsesmenAktif: 2026,
  sesiIdleMenit: 60,
  sesiMaksimalJam: 12,
  maksGagalMasuk: 5,
  kunciAkunMenit: 15,
}

/** Kunci di tabel `pengaturan_sistem` → field di `Pengaturan`. Satu peta, dua arah. */
export const KUNCI_PENGATURAN: Record<string, keyof Pengaturan> = {
  masa_berlaku_asesmen_tahun: 'masaBerlakuAsesmenTahun',
  tahun_asesmen_aktif: 'tahunAsesmenAktif',
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
    // Nilai tak masuk akal di DB (kosong, teks, nol) tidak boleh menggantikan
    // bawaan — parameter yang rusak akan menghasilkan timeout 0 menit, artinya
    // tidak ada yang bisa masuk sama sekali.
    if (Number.isFinite(angka) && angka > 0) hasil[field] = angka
  }
  return hasil
})

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
