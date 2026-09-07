import {
  TabelPegawaiKotak9,
  type BarisPegawaiKotak9,
} from '@/app/(app)/_komponen/tabel-pegawai-kotak9'
import type { AnggotaSel } from '@/lib/kueri/peta-talenta'

/**
 * Isi satu sel Kotak 9 — inilah pengganti *jitter*.
 *
 * Sebaran di dalam satu sel dibaca sebagai daftar bernilai asli (Kinerja,
 * Potensial, Nilai Talenta apa adanya), bukan sebagai titik yang digeser ke
 * koordinat bukan miliknya (phase.md §7 Fase 3).
 *
 * Tabelnya sendiri ada di `TabelPegawaiKotak9`, dipakai bersama drill-down
 * dashboard (24 Agu 2026) — alasan lengkapnya di docblock komponen itu. Berkas ini
 * tinggal pembungkus supaya pemanggilnya di `peta-talenta/page.tsx` tidak berubah
 * dan nama panelnya tetap terbaca dari halamannya.
 *
 * `AnggotaSel` sengaja **tidak** di-alias ke `BarisPegawaiKotak9`: pemeriksaan
 * struktural di baris `daftar` di bawah yang menegakkan keduanya tetap identik,
 * dan kalau salah satu kueri kehilangan satu field, yang muncul galat kompilasi di
 * sini — bukan kolom kosong di layar.
 */
export function DaftarSel({
  daftar,
  total,
  halaman,
  ukuranHalaman,
  labelX = 'Potensial',
  jabatanTargetId,
}: {
  daftar: AnggotaSel[]
  total: number
  halaman: number
  ukuranHalaman: number
  /** Nama sumbu X yang sedang dipakai — lihat catatan di `TampilanPeta`. */
  labelX?: string
  /** `?target=` yang sedang aktif — diteruskan ke tautan profil. */
  jabatanTargetId?: number | null
}) {
  const baris: BarisPegawaiKotak9[] = daftar
  return (
    <TabelPegawaiKotak9
      id="anggota-sel-kotak9"
      daftar={baris}
      total={total}
      halaman={halaman}
      ukuranHalaman={ukuranHalaman}
      labelX={labelX}
      jabatanTargetId={jabatanTargetId}
    />
  )
}
