/**
 * Silang-uji: apakah `lib/skor-massal` masih melahirkan angka yang tersimpan di
 * `match_score`?
 *
 * Isi `match_score` di pupr_dev dihasilkan `007_recompute.sql`, yang dulu
 * memuat urutan langkah perhitungannya SENDIRI di dalam scripts/recompute.ts.
 * Fase 5 mengangkat urutan itu ke `lib/skor-massal.ts` supaya dipakai bersama
 * oleh tombol Hitung Ulang, halaman Simulasi, dan generator SQL. Skrip ini
 * memastikan pengangkatan itu **tidak mengubah hasil**: 120 baris skor harus
 * sama sampai 2 desimal.
 *
 * Beda dari `verifikasi-data.ts` (SQL murni, menguji isi DB terhadap rumus):
 * yang ini menguji KODE terhadap isi DB. Keduanya perlu — satu menangkap data
 * yang menyimpang, satu menangkap kode yang menyimpang.
 *
 * Acuan waktu dikunci ke tanggal yang dipakai saat 007 dibuat. Itu bukan
 * kosmetik: indikator Lama Jabatan bertambah seiring waktu, jadi menghitung
 * dengan "hari ini" akan menghasilkan selisih yang benar tapi tidak
 * membuktikan apa pun tentang refactornya.
 *
 * Jalankan: npm run verifikasi:skoring
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const SEKARANG = new Date(2026, 6, 30, 12)
const TAHUN_SEKARANG = 2026
const MASA_BERLAKU = 3
const TOLERANSI = 0.005 // setengah satuan terkecil DECIMAL(6,2)

async function main() {
  const { ambilProfilKandidat, ambilRubrikUntukHitung, ambilSkorTersimpan } = await import(
    '../lib/kueri/rubrik'
  )
  const { kueri } = await import('../lib/db')
  const { hitungSkorMassal } = await import('../lib/skor-massal')

  const target = await kueri<{ id: number; nama_target: string }>(
    `SELECT id, nama_target FROM jabatan_target ORDER BY id`,
  )
  const profil = await ambilProfilKandidat()
  console.log(`${profil.length} pegawai aktif · ${target.length} jabatan target\n`)

  let diperiksa = 0
  let menyimpang = 0
  const contoh: string[] = []

  for (const t of target) {
    const siap = await ambilRubrikUntukHitung(Number(t.id))
    if (siap === null) continue

    const hasil = hitungSkorMassal(siap.rubrik, profil, {
      sekarang: SEKARANG,
      tahunSekarang: TAHUN_SEKARANG,
      masaBerlakuTahun: MASA_BERLAKU,
    })
    const tersimpan = new Map(
      (await ambilSkorTersimpan(Number(t.id))).map((s) => [s.pegawaiId, s]),
    )

    let bedaTarget = 0
    for (const h of hasil.hasil) {
      const lama = tersimpan.get(h.pegawaiId)
      if (lama === undefined) {
        contoh.push(`  target ${t.id} pegawai ${h.pegawaiId}: tidak ada baris match_score`)
        menyimpang++
        continue
      }
      diperiksa++
      const bedaSkor = Math.abs(lama.skorTotal - h.skorTotal)
      const bedaEligible = lama.eligible !== h.eligible
      if (bedaSkor > TOLERANSI || bedaEligible) {
        menyimpang++
        bedaTarget++
        if (contoh.length < 10) {
          contoh.push(
            `  target ${t.id} · ${h.nama}: tersimpan ${lama.skorTotal.toFixed(2)}/${lama.eligible ? 'eligible' : 'tidak'} ` +
              `vs hitung ${h.skorTotal.toFixed(2)}/${h.eligible ? 'eligible' : 'tidak'}`,
          )
        }
      }
    }

    console.log(
      `target ${t.id} — ${String(t.nama_target).slice(0, 52)}: ` +
        `${hasil.hasil.length} dihitung · ${hasil.jumlahEligible} eligible · ` +
        `${bedaTarget === 0 ? 'cocok' : `${bedaTarget} MENYIMPANG`}`,
    )
  }

  console.log(`\n${diperiksa} baris skor diperiksa · ${menyimpang} menyimpang`)
  if (contoh.length > 0) {
    console.log('\ncontoh selisih:')
    for (const c of contoh) console.log(c)
  }

  if (menyimpang > 0) {
    console.error(
      '\nGAGAL: hasil lib/skor-massal berbeda dari isi match_score. Salah satunya salah —\n' +
        'periksa perubahan terakhir di lib/scoring, lib/penilaian, atau lib/skor-massal.',
    )
    process.exit(1)
  }
  console.log('\nOK: lib/skor-massal melahirkan ulang seluruh isi match_score.')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
