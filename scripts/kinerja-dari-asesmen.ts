/**
 * Isi `kinerja_periode` periode **TAHUNAN** dari predikat yang sudah ada di
 * `asesmen_talenta` (asalnya kolom `RATING KINERJA` di berkas Excel Talent Pool).
 *
 *   npm run kinerja:tahunan             # KERING — melapor, tidak menulis
 *   npm run kinerja:tahunan -- --tulis  # benar-benar menulis
 *
 * ## Kenapa ada
 *
 * Permintaan pemilik proses 24 Agu 2026: *"tren kinerja gausah pake SKP, langsung
 * aja yang ada di Excel itu taro di kinerja tahunan"*. Sebelumnya
 * `kinerja_periode` KOSONG — 28 barisnya milik 10 pegawai eNominasi yang
 * dikeluarkan, dan kedua berkas Excel tidak pernah mengisinya. Akibatnya panel
 * "Tren kinerja" kosong padahal predikat kinerjanya ada, dan itu terbaca seperti
 * kerusakan.
 *
 * ## Yang JUJUR dan yang TIDAK boleh dikarang
 *
 * `nilai_kinerja` di sini adalah **skor predikat**, bukan nilai SKP terukur:
 * Sangat Baik→100, Baik→80, Butuh Perbaikan→60, Kurang→40, Sangat Kurang→20
 * (`SKOR_PREDIKAT` di `lib/scoring`). Sumbernya memang hanya memberi predikat,
 * bukan angka capaian. Karena itu:
 *
 *   - `nilai_perilaku` dibiarkan **NULL**. Excel tidak memuatnya, dan mengisinya
 *     dengan angka yang sama seperti nilai kinerja akan membuat grafik memajang
 *     dua garis identik yang tampak seolah dua pengukuran berbeda saling
 *     mengonfirmasi.
 *   - `sumber_sync` diberi label **`Excel Talent Pool`**, bukan `eKinerja`.
 *     Menandainya eKinerja akan membuat halaman Konsolidasi Data menyatakan
 *     integrasi yang tidak ada — kekeliruan yang persis pernah terjadi dan
 *     diperbaiki di proyek ini.
 *   - Hanya periode **TAHUNAN** yang dibuat. TW1–TW3 tidak dikarang: satu
 *     predikat setahun tidak bisa dipecah jadi tiga titik triwulan tanpa
 *     menciptakan data yang tidak pernah diukur siapa pun.
 *
 * ## Idempoten
 *
 * Baris dikunci `(pegawai_id, tahun, 'TAHUNAN')`. Yang sudah ada **diperbarui**,
 * bukan ditambah — jadi menjalankannya dua kali menghasilkan keadaan yang sama.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')

interface BarisAsesmen {
  pegawai_id: number
  nama_lengkap: string
  tahun_kinerja: number
  rating_kinerja: string
  nilai_kinerja_y: string
}

async function main() {
  const { kueri, eksekusi } = await import('../lib/db')

  const asesmen = await kueri<BarisAsesmen>(
    `SELECT a.pegawai_id, p.nama_lengkap, a.tahun_kinerja, a.rating_kinerja, a.nilai_kinerja_y
       FROM asesmen_talenta a
       JOIN pegawai p ON p.id = a.pegawai_id
      WHERE a.rating_kinerja IS NOT NULL AND a.tahun_kinerja IS NOT NULL
      ORDER BY p.nama_lengkap`,
  )

  const adaSebelum = await kueri<{ pegawai_id: number; tahun: number }>(
    `SELECT pegawai_id, tahun FROM kinerja_periode WHERE periode_skp = 'TAHUNAN'`,
  )
  const sudahAda = new Set(adaSebelum.map((r) => `${r.pegawai_id}@${r.tahun}`))

  console.log(`\n=== KINERJA TAHUNAN DARI PREDIKAT ASESMEN ${TULIS ? '(MENULIS)' : '(kering)'} ===\n`)
  console.log(`  asesmen berpredikat & bertahun : ${asesmen.length}`)
  console.log(`  baris TAHUNAN yang sudah ada   : ${adaSebelum.length}`)

  const baru = asesmen.filter((a) => !sudahAda.has(`${a.pegawai_id}@${a.tahun_kinerja}`))
  const perbarui = asesmen.length - baru.length
  console.log(`  akan DIBUAT                    : ${baru.length}`)
  console.log(`  akan DIPERBARUI                : ${perbarui}`)

  const perTahun = new Map<number, number>()
  for (const a of asesmen) perTahun.set(a.tahun_kinerja, (perTahun.get(a.tahun_kinerja) ?? 0) + 1)
  console.log('\n  sebaran per tahun kinerja:')
  for (const [t, n] of [...perTahun.entries()].sort((x, y) => y[0] - x[0])) {
    console.log(`     ${t} · ${String(n).padStart(3)} pegawai`)
  }

  const perPredikat = new Map<string, number>()
  for (const a of asesmen) perPredikat.set(a.rating_kinerja, (perPredikat.get(a.rating_kinerja) ?? 0) + 1)
  console.log('\n  sebaran predikat:')
  for (const [p, n] of perPredikat) console.log(`     ${p.padEnd(16)} ${String(n).padStart(3)}`)

  console.log(
    '\n  CATATAN: `nilai_kinerja` = skor predikat (Sangat Baik 100 · Baik 80 · dst),\n' +
      '  BUKAN nilai SKP terukur. `nilai_perilaku` dibiarkan NULL karena sumbernya\n' +
      '  tidak memuatnya. TW1–TW3 TIDAK dibuat — satu predikat setahun tidak bisa\n' +
      '  dipecah jadi tiga titik triwulan tanpa mengarang pengukuran.',
  )

  if (!TULIS) {
    console.log('\n  Kering — tidak ada yang ditulis. Tambahkan `-- --tulis`.\n')
    process.exit(0)
  }

  let ditulis = 0
  for (const a of asesmen) {
    await eksekusi(
      `INSERT INTO kinerja_periode
         (pegawai_id, tahun, periode_skp, nilai_kinerja, nilai_perilaku, predikat, sumber_sync, synced_at)
       VALUES (?, ?, 'TAHUNAN', ?, NULL, ?, 'Excel Talent Pool', NOW())
       ON DUPLICATE KEY UPDATE
         nilai_kinerja = VALUES(nilai_kinerja),
         predikat = VALUES(predikat),
         sumber_sync = VALUES(sumber_sync),
         synced_at = VALUES(synced_at)`,
      [a.pegawai_id, a.tahun_kinerja, a.nilai_kinerja_y, a.rating_kinerja],
    )
    ditulis++
  }

  const sesudah = await kueri<{ n: number }>(
    `SELECT COUNT(*) AS n FROM kinerja_periode WHERE periode_skp = 'TAHUNAN'`,
  )
  console.log(`\n── DITULIS ──`)
  console.log(`  ${ditulis} baris diproses · total baris TAHUNAN sekarang ${sesudah[0]?.n ?? 0}`)
  console.log(
    '\n  Panel "Tren kinerja" sekarang punya SATU titik per tahun (TAHUNAN saja).\n' +
      '  Itu bukan tren dalam arti grafik antar-triwulan — ia perbandingan antar\n' +
      '  TAHUN. Kalau grafik triwulanan yang dibutuhkan, sumbernya harus e-Kinerja.\n',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
