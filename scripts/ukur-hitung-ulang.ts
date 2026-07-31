/**
 * Ukur jalur TULIS "Hitung Ulang" — bagian terberat di aplikasi.
 *
 * Kueri baca sudah diukur `ukur-kueri.ts` (ambang 150 ms/kueri). Yang belum:
 * satu kali Hitung Ulang menulis satu baris `match_score` + sembilan baris
 * `match_score_detail` **per pegawai**. Di dev itu 40 pegawai; di produksi 1.872
 * (phase.md §3 K-5). Angka itu harus diukur, bukan diasumsikan — dan kalau
 * ternyata terlalu lama, itu argumen untuk job asinkron berprogres (U-10),
 * bukan sesuatu yang ditemukan pengguna sebagai halaman yang menggantung.
 *
 * Jalankan:
 *   npm run ukur:hitung-ulang            (pupr_dev, ~40 pegawai)
 *   npm run ukur:hitung-ulang -- --volume (pupr_dev_volume, ~2.000 pegawai)
 *
 * CATATAN: skrip ini MENULIS ke database yang dituju. Pada `--volume` itu tidak
 * masalah (database sekali pakai, dibangun ulang `npm run db:volume`). Pada
 * pupr_dev, isinya ditulis ulang dengan nilai yang sama seperti yang dihasilkan
 * `lib/skor-massal` — sama dengan menekan tombol Hitung Ulang di UI.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const volume = process.argv.includes('--volume')
if (volume) process.env.DATABASE_NAME = `${process.env.DATABASE_NAME}_volume`

async function main() {
  const { ambilJejakManual, ambilNilaiManual, ambilProfilKandidat, ambilRubrikUntukHitung } =
    await import('../lib/kueri/rubrik')
  const { kueri } = await import('../lib/db')
  const { hitungSkorMassal } = await import('../lib/skor-massal')
  const { tulisHasilSkor } = await import('../lib/skoring-tulis')

  console.log(`Database: ${process.env.DATABASE_NAME}\n`)

  const target = await kueri<{ id: number; nama_target: string }>(
    `SELECT id, nama_target FROM jabatan_target ORDER BY id LIMIT 1`,
  )
  const idTarget = Number(target[0]?.id ?? 0)
  if (idTarget === 0) {
    console.error('Tidak ada jabatan target.')
    process.exit(1)
  }

  const t0 = Date.now()
  const siap = await ambilRubrikUntukHitung(idTarget)
  if (siap === null) {
    console.error('Rubrik tidak terbaca.')
    process.exit(1)
  }
  const msRubrik = Date.now() - t0

  const t1 = Date.now()
  const [profil, nilaiManual, jejakManual] = await Promise.all([
    ambilProfilKandidat(),
    ambilNilaiManual(idTarget),
    ambilJejakManual(idTarget),
  ])
  const msProfil = Date.now() - t1

  const t2 = Date.now()
  const hasil = hitungSkorMassal(siap.rubrik, profil, { nilaiManual })
  const msHitung = Date.now() - t2

  const t3 = Date.now()
  const ringkas = await tulisHasilSkor(
    idTarget,
    hasil.hasil,
    JSON.stringify(hasil.snapshotRubrik),
    jejakManual,
  )
  const msTulis = Date.now() - t3

  const total = Date.now() - t0

  console.log(`jabatan target      : ${idTarget} — ${target[0]?.nama_target}`)
  console.log(`pegawai dinilai     : ${hasil.hasil.length} (${hasil.jumlahEligible} lolos syarat)`)
  console.log(`baris rincian       : ${ringkas.jumlahRincian}`)
  console.log(`anggota pool        : ${ringkas.jumlahAnggotaPool} diperingkat ulang\n`)

  console.log('=== WAKTU ===')
  console.log(`baca rubrik         ${String(msRubrik).padStart(6)} ms`)
  console.log(`baca profil pegawai ${String(msProfil).padStart(6)} ms`)
  console.log(`hitung (murni CPU)  ${String(msHitung).padStart(6)} ms`)
  console.log(`tulis ke database   ${String(msTulis).padStart(6)} ms`)
  console.log(`TOTAL               ${String(total).padStart(6)} ms`)

  const perPegawai = hasil.hasil.length === 0 ? 0 : total / hasil.hasil.length
  console.log(`\nper pegawai         ${perPegawai.toFixed(2)} ms`)
  console.log(
    `proyeksi 1.872 ASN  ${((perPegawai * 1872) / 1000).toFixed(1)} s untuk satu jabatan target`,
  )

  // Ambang pilihan: 30 detik. Di atas itu, satu permintaan HTTP sinkron mulai
  // terasa seperti halaman menggantung dan pantas dijadikan job asinkron (U-10).
  const AMBANG_MS = 30_000
  if (total > AMBANG_MS) {
    console.error(
      `\nLAMBAT: ${(total / 1000).toFixed(1)} s melewati ambang ${AMBANG_MS / 1000} s — ` +
        `perhitungan sinkron sudah tidak layak, pindahkan ke job berprogres (U-10).`,
    )
    process.exit(1)
  }
  console.log(`\nok: di bawah ambang ${AMBANG_MS / 1000} s untuk satu jabatan target.`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
