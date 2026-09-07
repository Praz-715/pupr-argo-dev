/**
 * Nama jabatan tidak boleh menyebut WILAYAH — unitnya sudah bilang itu.
 *
 *   npm run bersih:nama-wilayah
 *   npm run bersih:nama-wilayah -- --tulis
 *
 * Permintaan pemilik proses 2 Sep 2026: *"di jabatan gausah ada wilayahnya tapi
 * pastiin selalu nempel sama unit organisasinya."* Menyebut nama daerah di
 * `nama_jabatan` itu REDUNDAN dengan `unit_organisasi_id` — kolom itu sudah
 * menyatakan wilayah mana, dan menuliskannya dua kali di dua kolom berbeda
 * membuka jalan keduanya berselisih suatu hari (unit dipindah, nama lupa ikut).
 *
 * ## Diperiksa dulu, dan hasilnya sudah bersih untuk keluarga terbesar
 *
 * "Kepala Balai Pelaksana Pemilihan Jasa Konstruksi" (34 baris) dan "Kepala Sub
 * Bagian Umum dan Tata Usaha" (41 baris) — dua keluarga TERBESAR yang tadinya
 * dicurigai — **sudah generik**, tanpa satu pun baris menyebut nama daerah.
 *
 * ## A · 2 baris adalah TWIN kosong dari jabatan generik yang sudah TERISI — DIHAPUS
 *
 *   · "Kepala Subbagian Tata Usaha BP2JK Wilayah Jawa Barat" (nol penghuni, nol
 *     riwayat) — unit yang sama SUDAH punya "Kepala Sub Bagian Umum dan Tata
 *     Usaha" TERISI. Menghapus salah satu berarti menggabungkan, bukan
 *     mengosongkan kursi — kursi generiknya sudah ada dan terisi.
 *   · "… Wilayah Jawa Timur" — sama persis.
 *
 * ## B · 3 baris DIGANTI NAMANYA (bukan dihapus) — tidak ada kembarannya
 *
 *   · "Pengadministrasi Umum BP2JK Wilayah Jawa Timur" → "Pengadministrasi Umum"
 *   · "Pengolah Data dan Informasi BP2JK Wilayah Sulawesi Selatan" →
 *     "Pengolah Data dan Informasi"
 *   · "Pengelola Pengadaan Barang/Jasa Ahli Muda BP2JK Jawa Barat" →
 *     "Pengelola Pengadaan Barang/Jasa Ahli Muda" (ditemukan 3 Sep 2026 —
 *     pemeriksaan pertama memakai kata kunci "Wilayah" saja dan melewatkan
 *     bentuk "BP2JK <daerah>" tanpa kata itu; jalan kedua menyapu SELURUH 165
 *     nama jabatan terhadap daftar provinsi/kota, bukan hanya keluarga yang
 *     dicurigai manual — pelajaran yang sama dengan `samaUnit()` 85%: pemeriksa
 *     yang dilingkupi tebakan manusia tentang "yang mana yang perlu diperiksa"
 *     bisa melewatkan yang tidak terpikirkan)
 *
 *   `unit_organisasi_id`-nya SAMA SEKALI TIDAK disentuh — permintaannya eksplisit
 *   "pastiin selalu nempel sama unit organisasinya", dan mengganti nama tidak
 *   punya alasan apa pun untuk menyentuh kolom itu. Ketiganya nol penghuni & nol
 *   riwayat, jadi rename tidak menyentuh data karier siapa pun; id 40 juga jadi
 *   jabatan asal 8 jabatan target — rename tidak mengubah `jabatan_id` FK-nya,
 *   jadi kedelapan tautan itu tidak tersentuh sama sekali.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')

const HAPUS = [
  { id: 28, sebab: 'twin kosong — "Kepala Sub Bagian Umum dan Tata Usaha" di unit yang sama sudah TERISI' },
  { id: 29, sebab: 'twin kosong — sama' },
] as const

const GANTI = [
  { id: 46, dari: 'Pengadministrasi Umum BP2JK Wilayah Jawa Timur', ke: 'Pengadministrasi Umum' },
  { id: 47, dari: 'Pengolah Data dan Informasi BP2JK Wilayah Sulawesi Selatan', ke: 'Pengolah Data dan Informasi' },
  {
    id: 40,
    dari: 'Pengelola Pengadaan Barang/Jasa Ahli Muda BP2JK Jawa Barat',
    ke: 'Pengelola Pengadaan Barang/Jasa Ahli Muda',
  },
] as const

async function main() {
  const { kueriSatu, eksekusi } = await import('../lib/db')

  console.log(`\nmode: ${TULIS ? 'TULIS' : 'kering'}\n`)

  console.log('=== A. dihapus (twin kosong) ===')
  for (const h of HAPUS) {
    const r = await kueriSatu<{ nama_jabatan: string; unit: string; penghuni: number; riwayat: number }>(
      `SELECT j.nama_jabatan, u.nama_unit AS unit,
              (SELECT COUNT(*) FROM pegawai p WHERE p.jabatan_id = j.id AND p.status_aktif = 'AKTIF') AS penghuni,
              (SELECT COUNT(*) FROM riwayat_jabatan rj WHERE rj.jabatan_id = j.id) AS riwayat
         FROM jabatan j LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
        WHERE j.id = ?`,
      [h.id],
    )
    if (r === null) {
      console.log(`  #${h.id} sudah tidak ada — dilewati`)
      continue
    }
    const aman = Number(r.penghuni) === 0 && Number(r.riwayat) === 0
    console.log(`  #${h.id} "${r.nama_jabatan}" @ ${r.unit} — ${aman ? 'AMAN' : 'DITAHAN, ada dependen!'} (${h.sebab})`)
    if (aman && TULIS) await eksekusi('DELETE FROM jabatan WHERE id = ?', [h.id])
  }

  console.log('\n=== B. diganti nama (unit TIDAK disentuh) ===')
  for (const g of GANTI) {
    const r = await kueriSatu<{ nama_jabatan: string }>('SELECT nama_jabatan FROM jabatan WHERE id = ?', [g.id])
    if (r === null) {
      console.log(`  #${g.id} sudah tidak ada — dilewati`)
      continue
    }
    if (r.nama_jabatan !== g.dari) {
      console.log(`  #${g.id} nama sekarang "${r.nama_jabatan}" ≠ perkiraan "${g.dari}" — DILEWATI, periksa manual`)
      continue
    }
    console.log(`  #${g.id} "${g.dari}" → "${g.ke}"`)
    if (TULIS) await eksekusi('UPDATE jabatan SET nama_jabatan = ? WHERE id = ?', [g.ke, g.id])
  }

  console.log(`\n── ${TULIS ? 'DITULIS' : 'kering'} ──`)
  if (!TULIS) console.log('   Tambahkan `--tulis` untuk menerapkan.\n')
  process.exit(0)
}

void main()
