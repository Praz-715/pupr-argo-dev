import { tanganiV1 } from '@/lib/api/bungkus'
import { ambilSebaranKotak9 } from '@/lib/kueri/dashboard'
import { DESKRIPSI_KOTAK_9, kategoriDariKotak9, type Kotak9 } from '@/lib/scoring'

/**
 * `GET /api/v1/kotak-9/summary` — statistik agregat sebaran Kotak 9 (PRD §7.2).
 *
 * **Scope paling minimal**, dan sengaja begitu: tidak ada baris per pegawai di
 * sini, jadi tidak ada data pribadi yang bisa bocor bahkan untuk klien tanpa MoU
 * data personal. Ini endpoint yang cocok untuk instansi yang cuma butuh gambaran
 * (BKN di data dev memakainya).
 *
 * Memakai `ambilSebaranKotak9()` yang sama dengan widget dashboard — angka yang
 * dikirim ke BKN tidak mungkin berbeda dari yang dilihat Dirjen di layar.
 *
 * Ketiga penyebut ikut dikirim (`tanpa_asesmen`, `asesmen_kedaluwarsa`,
 * `total_pegawai_aktif`). Mengirim hanya sebarannya membuat pembaca menyimpulkan
 * bahwa itu seluruh populasi — padahal pegawai tanpa asesmen tidak muncul di
 * kotak mana pun, dan tanpa penyebutnya persentase apa pun yang dihitung klien
 * akan salah.
 */
export const GET = tanganiV1('kotak-9-summary', async () => {
  const s = await ambilSebaranKotak9()

  const perKotak = ([9, 8, 7, 6, 5, 4, 3, 2, 1] as Kotak9[]).map((k) => {
    const kategori = kategoriDariKotak9(k)
    const jumlah = s.perKotak.get(k) ?? 0
    return {
      kotak: k,
      jumlah,
      persen: s.totalDinilai === 0 ? 0 : Math.round((jumlah / s.totalDinilai) * 1000) / 10,
      kategori_kinerja: kategori?.y ?? null,
      kategori_potensial: kategori?.x ?? null,
      keterangan: DESKRIPSI_KOTAK_9[k],
    }
  })

  return {
    data: {
      per_kotak: perKotak,
      total_dinilai: s.totalDinilai,
      tanpa_asesmen: s.tanpaAsesmen,
      asesmen_kedaluwarsa: s.asesmenKedaluwarsa,
      total_pegawai_aktif: s.totalDinilai + s.tanpaAsesmen,
      tahun_asesmen_terlama: s.tahunTerlama,
      tahun_asesmen_terbaru: s.tahunTerbaru,
    },
    meta: {
      dasar_perhitungan:
        'Kotak 9 selalu hasil hitung dari (nilai kinerja, nilai potensial) dengan ambang 60/80 — Lampiran A. Nilai kotak_9 dari sistem sumber dipakai hanya sebagai pembanding.',
      catatan_penyebut:
        'total_dinilai TIDAK termasuk pegawai tanpa asesmen. Pakai total_pegawai_aktif sebagai penyebut populasi.',
    },
  }
})
