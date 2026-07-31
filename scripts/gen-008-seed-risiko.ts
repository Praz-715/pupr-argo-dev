/**
 * Hasilkan `doc/sql/008_seed_risiko_kekosongan.sql`.
 *
 * **Kenapa berkas ini ada.** Halaman "Jabatan Kosong & Risiko Kekosongan" (U-6)
 * menampilkan pejabat yang akan mengosongkan jabatannya karena mendekati Batas
 * Usia Pensiun. Setelah halamannya dibangun, ternyata **tidak ada satu pun**
 * pegawai di data dev yang berada dalam 3 tahun menuju BUP — pejabat tertua
 * masih 6,3 tahun lagi. Akibatnya seluruh cabang UI halaman itu (daftar terisi,
 * penanda "tanpa suksesor siap", pengelompokan mendesak) tidak pernah teruji.
 *
 * Sesuai hierarki kebenaran phase.md §1, data dev adalah dummy yang kita
 * kendalikan dan tugasnya **cukup beragam untuk menguji semua cabang logika &
 * semua keadaan UI**. Jadi yang dibetulkan datanya, bukan halamannya.
 *
 * Yang diubah hanya bagian **tanggal lahir** pada NIP beberapa pejabat — digit
 * TMT CPNS, jenis kelamin, dan nomor urut dipertahankan supaya masa kerja &
 * gender mereka tidak berubah. NIP-nya dihitung di sini (bukan ditulis tangan)
 * supaya usia hasilnya tepat sesuai target dan bisa dilahirkan ulang.
 *
 * Jalankan: npx tsx scripts/gen-008-seed-risiko.ts
 */
import { writeFileSync } from 'node:fs'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

/** Acuan "hari ini" dipaku supaya berkas hasilnya deterministik. */
const ACUAN = new Date(2026, 6, 31, 12, 0, 0)

/**
 * Target: berapa tahun lagi menuju BUP. Dipilih menyebar supaya halaman punya
 * kasus "sangat mendesak" (<1 thn), "mendesak" (1–2 thn), dan "perlu disiapkan"
 * (2–3 thn) sekaligus.
 */
const TARGET: Array<{ nip: string; nama: string; bup: number; sisaTahun: number }> = [
  // Eselon II struktural → BUP 60
  { nip: '197211081996031001', nama: 'Budi Santoso', bup: 60, sisaTahun: 0.6 },
  // Eselon III struktural → BUP 58
  { nip: '197805251998032005', nama: 'Rus', bup: 58, sisaTahun: 1.4 },
  { nip: '197806232003122002', nama: 'Ika Puspita', bup: 58, sisaTahun: 2.3 },
  { nip: '197906192010121002', nama: 'Iwan', bup: 58, sisaTahun: 2.9 },
]

function tanggalLahirUntuk(bup: number, sisaTahun: number): Date {
  // Pensiun pada ulang tahun ke-`bup`. Kalau sisa `sisaTahun` dari ACUAN, maka
  // tanggal pensiun = ACUAN + sisaTahun, dan tanggal lahir = pensiun - bup.
  const hariPerTahun = 365.25
  const pensiun = new Date(ACUAN.getTime() + sisaTahun * hariPerTahun * 86_400_000)
  return new Date(pensiun.getFullYear() - bup, pensiun.getMonth(), pensiun.getDate(), 12)
}

const pad = (n: number, l = 2) => String(n).padStart(l, '0')

const baris: string[] = []
const ringkasan: string[] = []

for (const t of TARGET) {
  const lahir = tanggalLahirUntuk(t.bup, t.sisaTahun)
  const bagianLahir = `${lahir.getFullYear()}${pad(lahir.getMonth() + 1)}${pad(lahir.getDate())}`
  const sisaNip = t.nip.slice(8) // YYYYMM TMT CPNS + S + NNN, dipertahankan
  const nipBaru = `${bagianLahir}${sisaNip}`

  if (nipBaru.length !== 18) {
    throw new Error(`NIP hasil hitung untuk ${t.nama} bukan 18 digit: ${nipBaru}`)
  }

  // TMT CPNS harus tetap SETELAH tanggal lahir — kalau tanggal lahir digeser
  // terlalu jauh ke depan, NIP-nya jadi tidak masuk akal dan justru masuk
  // Antrian Pembersihan sebagai NIP tidak valid.
  const tmtTahun = Number(sisaNip.slice(0, 4))
  if (tmtTahun <= lahir.getFullYear() + 17) {
    throw new Error(
      `${t.nama}: TMT CPNS ${tmtTahun} terlalu dekat dengan tahun lahir ${lahir.getFullYear()}`,
    )
  }

  const usia = ACUAN.getFullYear() - lahir.getFullYear() -
    (ACUAN.getMonth() < lahir.getMonth() ||
    (ACUAN.getMonth() === lahir.getMonth() && ACUAN.getDate() < lahir.getDate())
      ? 1
      : 0)

  baris.push(
    `-- ${t.nama}: lahir ${bagianLahir} → usia ${usia} thn, BUP ${t.bup}, sisa ~${t.sisaTahun} thn`,
  )
  baris.push(`UPDATE pegawai SET nip = '${nipBaru}' WHERE nip = '${t.nip}';`)
  baris.push('')

  ringkasan.push(
    `--   ${t.nama.padEnd(18)} ${t.nip} → ${nipBaru}  (usia ${usia}, BUP ${t.bup}, sisa ~${t.sisaTahun} thn)`,
  )
}

const isi = `-- 008_seed_risiko_kekosongan.sql — DIHASILKAN PROGRAM, jangan disunting tangan
-- Sumber: scripts/gen-008-seed-risiko.ts  ·  acuan tanggal: 2026-07-31
--
-- Tujuan: memberi data dev beberapa pejabat yang mendekati Batas Usia Pensiun,
-- supaya halaman "Jabatan Kosong & Risiko Kekosongan" (U-6) punya isi dan semua
-- cabang UI-nya teruji. Sebelum berkas ini, pejabat terdekat BUP masih 6,3 tahun
-- lagi sehingga halaman itu selalu kosong pada ambang 3 tahun.
--
-- Yang diubah HANYA delapan digit pertama NIP (tanggal lahir). Digit TMT CPNS,
-- jenis kelamin, dan nomor urut dipertahankan supaya masa kerja & komposisi
-- gender tidak ikut bergeser.
--
-- Perubahan:
${ringkasan.join('\n')}

${baris.join('\n')}
-- Pemeriksaan: keempat NIP baru harus tetap 18 digit & unik.
SELECT COUNT(*) AS nip_18_digit FROM pegawai WHERE nip REGEXP '^[0-9]{18}$';
SELECT COUNT(*) AS total_pegawai, COUNT(DISTINCT nip) AS nip_unik FROM pegawai;
`

const tujuan = 'doc/sql/008_seed_risiko_kekosongan.sql'
writeFileSync(tujuan, isi, 'utf8')
console.log(`Ditulis: ${tujuan}`)
console.log(ringkasan.join('\n'))
