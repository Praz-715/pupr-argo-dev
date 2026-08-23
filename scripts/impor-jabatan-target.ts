/**
 * Jadikan jabatan ES 2 & 3 dari Excel sebagai JABATAN TARGET (butir 9 daftar
 * Penyesuaian: "tambahin jabatan2 yg di excel dimasukin ke jabatan target").
 *
 *   npm run impor:jabatan-target            # KERING — melapor, tidak menulis
 *   npm run impor:jabatan-target -- --tulis # benar-benar menulis
 *
 * Kering secara bawaan, sama seperti `sinkron:enom`. Skrip yang langsung menulis
 * pada jalan pertama membuat orang membacanya sesudah, bukan sebelum.
 *
 * ## Yang dilakukan
 *
 * Untuk setiap `nama_jabatan` di `doc/data/talentpool-es23.json`: cari jabatan
 * di master, lalu buat satu `jabatan_target` berstatus **DRAFT** + satu baris
 * `jabatan_target_anggota` yang menautkannya.
 *
 * ## Kenapa DRAFT, bukan AKTIF
 *
 * Jabatan target tanpa rubrik menghasilkan skor **0 untuk semua orang** — mesin
 * rubrik sengaja tidak melempar (lihat `lib/scoring`), jadi target aktif tanpa
 * komponen akan memajang peringkat yang seluruhnya nol tanpa satu pun tanda
 * bahwa angkanya belum berarti. DRAFT membuatnya tidak ikut dihitung dan tidak
 * muncul di pemilih Peta Talenta sampai rubriknya disusun. Aktivasi tetap lewat
 * UI, yang sudah memeriksa kelengkapan rubrik sebelum mengizinkannya.
 *
 * ## Kenapa jabatan yang SUDAH jadi anggota target dilewati
 *
 * Satu jabatan boleh menjadi anggota beberapa jabatan target (PRIMARY KEY-nya
 * `(jabatan_target_id, jabatan_id)`), jadi DB tidak akan menolak duplikat. Yang
 * menolak harus skrip ini: dua jabatan target untuk satu jabatan yang sama
 * berarti dua daftar kandidat yang bersaing untuk satu kursi, dan tidak ada di
 * UI yang menjelaskan mana yang dipakai. `jabatan_target` id 199 (`DPJK`) adalah
 * contoh nyatanya — ia menduplikasi nama target id 2 dan sudah membuat halaman
 * Bandingkan memajang dua baris beridentitas sama.
 *
 * ## Kenapa `kode_target` diturunkan dari `kode_jabatan`
 *
 * `JT-` + `kode_jabatan` (mis. `JT-JAB-ES23-048`) — pendek, unik dengan
 * sendirinya karena `kode_jabatan` unik, dan bisa dilacak balik ke asalnya.
 * Menyingkat dari NAMA jabatan seperti seed lama (`JT-KABALAI-BP2JK-...`) sudah
 * terbukti bertabrakan: dua nama panjang berbeda bisa menghasilkan singkatan
 * sama, dan `varchar(40)` memotongnya tanpa peringatan.
 */

import { config } from 'dotenv'
import { readFileSync } from 'node:fs'

config({ path: '.env.local' })
config({ path: '.env' })

const BERKAS = 'doc/data/talentpool-es23.json'
const TULIS = process.argv.includes('--tulis')

interface BarisExcel {
  nama: string
  namaJabatan: string
  unitKerja: string
  eselon: string
}

interface Rencana {
  jabatanId: number
  kodeJabatan: string
  namaJabatan: string
  namaUnit: string
  kodeTarget: string
}

async function main() {
  const { kueri, eksekusi } = await import('../lib/db')

  const mentah = JSON.parse(readFileSync(BERKAS, 'utf8')) as BarisExcel[]
  const namaJabatanExcel = [
    ...new Set(mentah.map((r) => r.namaJabatan?.trim()).filter((n): n is string => Boolean(n))),
  ]
  console.log(`\n=== JABATAN EXCEL → JABATAN TARGET ${TULIS ? '(MENULIS)' : '(kering)'} ===\n`)
  console.log(`nama jabatan unik di ${BERKAS}: ${namaJabatanExcel.length}`)

  const jabatan = await kueri<{
    id: number
    kode_jabatan: string
    nama_jabatan: string
    nama_unit: string
    sudah_target: number
  }>(
    `SELECT j.id, j.kode_jabatan, j.nama_jabatan, u.nama_unit,
            (SELECT COUNT(*) FROM jabatan_target_anggota a WHERE a.jabatan_id = j.id) AS sudah_target
       FROM jabatan j
       JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
      WHERE j.nama_jabatan IN (${namaJabatanExcel.map(() => '?').join(',')})`,
    namaJabatanExcel,
  )

  const perNama = new Map(jabatan.map((j) => [j.nama_jabatan, j]))
  const tidakAdaDiMaster = namaJabatanExcel.filter((n) => !perNama.has(n))
  const sudahJadiTarget = jabatan.filter((j) => Number(j.sudah_target) > 0)

  const kodeTargetTerpakai = new Set(
    (await kueri<{ kode_target: string }>(`SELECT kode_target FROM jabatan_target`)).map(
      (r) => r.kode_target,
    ),
  )

  const rencana: Rencana[] = []
  const bentrokKode: string[] = []
  for (const j of jabatan) {
    if (Number(j.sudah_target) > 0) continue
    const kode = `JT-${j.kode_jabatan}`
    if (kode.length > 40) {
      bentrokKode.push(`${kode} (${kode.length} karakter, batas 40)`)
      continue
    }
    if (kodeTargetTerpakai.has(kode)) {
      bentrokKode.push(`${kode} sudah dipakai jabatan target lain`)
      continue
    }
    kodeTargetTerpakai.add(kode)
    rencana.push({
      jabatanId: Number(j.id),
      kodeJabatan: j.kode_jabatan,
      namaJabatan: j.nama_jabatan,
      namaUnit: j.nama_unit,
      kodeTarget: kode,
    })
  }

  // ---- Laporan SEBELUM menulis apa pun ----
  if (tidakAdaDiMaster.length > 0) {
    console.log(`\nTIDAK ada di master jabatan (${tidakAdaDiMaster.length}) — dilewati:`)
    for (const n of tidakAdaDiMaster) console.log(`  · ${n}`)
    console.log(
      '  Jalankan `npm run impor:talentpool -- --tulis` lebih dulu supaya jabatannya dibuat.',
    )
  }
  if (sudahJadiTarget.length > 0) {
    console.log(`\nSUDAH jadi anggota jabatan target (${sudahJadiTarget.length}) — dilewati:`)
    for (const j of sudahJadiTarget) console.log(`  · ${j.nama_jabatan}`)
  }
  if (bentrokKode.length > 0) {
    console.log(`\nKODE bentrok/terlalu panjang (${bentrokKode.length}) — dilewati:`)
    for (const b of bentrokKode) console.log(`  · ${b}`)
  }

  console.log(`\nAKAN dibuat: ${rencana.length} jabatan target DRAFT`)
  for (const r of rencana) {
    console.log(`  ${r.kodeTarget.padEnd(18)} ${r.namaJabatan}  [${r.namaUnit}]`)
  }

  if (!TULIS) {
    console.log(
      `\nKering — tidak ada yang ditulis. Tambahkan \`-- --tulis\` untuk membuat ${rencana.length} jabatan target.`,
    )
    process.exit(0)
  }
  if (rencana.length === 0) {
    console.log('\nTidak ada yang perlu dibuat.')
    process.exit(0)
  }

  const DESKRIPSI =
    'Dibuat dari struktur organisasi berkas Excel Talent Pool ES 2 & 3. ' +
    'Lengkapi persyaratan & rubrik sebelum diaktifkan — target tanpa rubrik menghasilkan skor 0 untuk semua kandidat.'

  let dibuat = 0
  for (const r of rencana) {
    const hasil = await eksekusi(
      `INSERT INTO jabatan_target (kode_target, nama_target, deskripsi, kata_kunci_relevansi, status)
       VALUES (?, ?, ?, CAST('[]' AS JSON), 'DRAFT')`,
      [r.kodeTarget, r.namaJabatan, DESKRIPSI],
    )
    const idTarget = Number(hasil.insertId)
    await eksekusi(
      `INSERT INTO jabatan_target_anggota (jabatan_target_id, jabatan_id) VALUES (?, ?)`,
      [idTarget, r.jabatanId],
    )
    dibuat++
    console.log(`  dibuat #${idTarget} ${r.kodeTarget} — ${r.namaJabatan}`)
  }

  console.log(`\n${dibuat} jabatan target DRAFT dibuat, masing-masing dengan 1 jabatan anggota.`)
  console.log(
    'Langkah berikutnya ada di UI, bukan di skrip ini: susun rubrik (atau "Salin rubrik" dari\n' +
      'target yang sudah jadi), isi persyaratan, lalu Aktifkan. Selama DRAFT, target ini tidak\n' +
      'ikut dihitung dan tidak muncul di pemilih Peta Talenta.',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
