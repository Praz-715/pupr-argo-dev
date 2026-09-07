/**
 * Nama jabatan tidak boleh membawa keterangan dalam tanda kurung.
 *
 *   npm run bersih:nama-kurung
 *   npm run bersih:nama-kurung -- --tulis
 *
 * Permintaan pemilik proses 3 Sep 2026, setelah menunjuk "Pembina Jasa
 * Konstruksi Ahli Muda (Kerja Sama)" sebagai contoh: *"ilangin tanda
 * kurungnya aja"*. Disapu SELURUH 165 nama jabatan (bukan cuma yang
 * ditunjuk) — pelajaran yang sama dengan pembersihan nama wilayah 2 Sep:
 * pemeriksa yang berhenti di satu contoh yang ditunjuk bisa melewatkan
 * yang tidak terpikirkan. Hasilnya cuma DUA baris, dan keduanya diganti
 * di sini:
 *
 *   · #36 "Pembina Jasa Konstruksi Ahli Muda (Kerja Sama)" →
 *     "Pembina Jasa Konstruksi Ahli Muda"
 *   · #37 "Pembina Jasa Konstruksi Ahli Pertama (Standar Kompetensi)" →
 *     "Pembina Jasa Konstruksi Ahli Pertama"
 *
 * Nol tabrakan nama diperiksa lebih dulu — tidak ada baris lain bernama
 * sama di UNIT yang sama sesudah keterangannya dibuang, jadi ini rename
 * murni, bukan penggabungan dua kursi. Keduanya nol penghuni & nol
 * riwayat jabatan, jadi rename tidak menyentuh data karier siapa pun;
 * keduanya juga jadi jabatan asal (8 & 5 jabatan target) — rename tidak
 * mengubah `id`/`jabatan_id`, jadi tautan itu sama sekali tidak tersentuh.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')

const GANTI = [
  { id: 36, dari: 'Pembina Jasa Konstruksi Ahli Muda (Kerja Sama)', ke: 'Pembina Jasa Konstruksi Ahli Muda' },
  {
    id: 37,
    dari: 'Pembina Jasa Konstruksi Ahli Pertama (Standar Kompetensi)',
    ke: 'Pembina Jasa Konstruksi Ahli Pertama',
  },
] as const

async function main() {
  const { kueriSatu, eksekusi } = await import('../lib/db')

  console.log(`\nmode: ${TULIS ? 'TULIS' : 'kering'}\n`)

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
