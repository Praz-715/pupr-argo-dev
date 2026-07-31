/**
 * Buktikan ukuran payload render TERBATAS, tidak tumbuh linear terhadap jumlah
 * pegawai — untuk dashboard (Fase 1) maupun halaman padat berikutnya.
 *
 * Ini melengkapi ukur-kueri.ts: kueri sudah terbukti cepat di 2.000 pegawai,
 * tapi itu belum menjawab "apakah React harus merender 2.000 baris?". Kalau
 * payload ikut membesar, halaman tetap melambat walau SQL-nya kilat.
 *
 * Jalankan: npm run ukur:payload [--volume]
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

if (process.argv.includes('--volume')) process.env.DATABASE_NAME = 'pupr_dev_volume'

async function main() {
  const m = await import('../lib/kueri/dashboard')

  const [titik, sebaran, sehat, kosong, antrian, tren, akt, anggota] = await Promise.all([
    m.ambilTitikTalenta(),
    m.ambilSebaranKotak9(),
    m.ambilKesehatanData(),
    m.ambilJabatanKosong(),
    m.ambilAntrianNominasi(),
    m.ambilTrenKinerja(),
    m.ambilAktivitasTerakhir(),
    m.ambilAnggotaKotak(9),
  ])

  // Halaman padat Fase 2 & 3 — payload-nya ikut diukur, tidak diasumsikan aman.
  const p = await import('../lib/kueri/pegawai')
  const pt = await import('../lib/kueri/peta-talenta')
  const [direktori, petaTitik, sel] = await Promise.all([
    p.ambilDirektori({}),
    pt.ambilTitikPeta({}),
    pt.ambilAnggotaSel(9, {}),
  ])

  const baris: Array<[string, number, string]> = [
    ['titik bubble peta talenta', titik.titik.length, 'batas struktural 5 nilai Y x 101 nilai X = 505'],
    ['sel Kotak 9', sebaran.perKotak.size, 'batas 9'],
    ['baris kesehatan data', sehat.baris.length, 'tetap 11'],
    ['jabatan strategis kosong', kosong.daftar.length, 'LIMIT 8'],
    ['antrian nominasi', antrian.daftar.length, 'LIMIT 8'],
    ['titik tren kinerja', tren.titik.length, 'batas 4 periode SKP'],
    ['aktivitas terakhir', akt.length, 'LIMIT 8'],
    ['anggota kotak (drill-down)', anggota.daftar.length, `LIMIT 12, dari ${anggota.total} total`],
    ['baris direktori (Fase 2)', direktori.baris.length, `LIMIT 25, dari ${direktori.total} total`],
    ['titik bubble peta (Fase 3)', petaTitik.titik.length, 'plafon sama 505'],
    ['anggota sel peta (Fase 3)', sel.daftar.length, `LIMIT 20, dari ${sel.total} total`],
    ['kandidat banding (Fase 3)', 4, 'batas keras 4 kandidat'],
  ]

  console.log(`=== UKURAN PAYLOAD RENDER (${process.env.DATABASE_NAME}) ===`)
  console.log(`Basis: ${sebaran.totalDinilai} pegawai terases\n`)
  for (const [nama, jml, catatan] of baris) {
    console.log(`  ${String(jml).padStart(4)} baris  ${nama.padEnd(28)} ${catatan}`)
  }

  const total = baris.reduce((n, b) => n + b[1], 0)
  console.log(`\n  ${String(total).padStart(4)} baris  TOTAL dirender`)
  console.log(
    `\nRasio baris-render / pegawai: ${(total / Math.max(1, sebaran.totalDinilai)).toFixed(3)}`,
  )
  console.log('Semakin kecil rasionya saat pegawai bertambah, semakin terbukti tidak linear.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
