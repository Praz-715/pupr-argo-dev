/**
 * Hapus jabatan SEED LAMA yang sudah digantikan jabatan resmi — kering bawaan.
 *
 *   npm run bersih:jabatan
 *   npm run bersih:jabatan -- --tulis
 *
 * Ditemukan saat mencocokkan `jabatan` terhadap `Struktur Lengkap DJBK PUPR.pdf`
 * (bagan resmi 2 Sep 2026) atas permintaan pemilik proses: *"bebersih master data
 * lagi biar semua sinkron patokannya dari sini … jangan ada yang redundan lagi
 * pastiin yang aslinya sama tidak gak pecah, sama treenya benerin juga jangan ada
 * yang salah alamat."*
 *
 * Kedelapan baris ini adalah NAMA LAMA yang sudah digantikan nama resmi yang kini
 * TERISI di unit yang sama, atau level jabatan (Seksi) yang menurut bagan tidak
 * pernah ada di sana sama sekali:
 *
 *   Sekretariat Ditjen — 3 Bagian resmi (ES23-048/049/050) sudah TERISI, jadi:
 *     · "Kepala Bagian Keuangan dan Barang Milik Negara" — digantikan "…
 *       Perencanaan, Program dan Keuangan"
 *     · "Kepala Bagian Program dan Evaluasi" — sama
 *     · "Kepala Seksi Perbendaharaan" — bagan: Sekretariat cuma 3 Bagian, TANPA
 *       Seksi di bawahnya
 *   Dit. Pengadaan — 4 Kasubdit resmi sudah TERISI:
 *     · "Kepala Subdirektorat Pengadaan" — nama lama
 *     · "Kepala Seksi Pengadaan" — bagan: Direktorat → Subdit langsung, tanpa Seksi
 *   Dit. Kompetensi — 4 Kasubdit resmi sudah TERISI:
 *     · "Kepala Subdirektorat Standar dan Materi Kompetensi" — digantikan
 *       "… Bakuan Kompetensi"
 *     · "Kepala Seksi Penyusunan Standar Kompetensi" — tanpa Seksi di bagan
 *   Dit. Usaha & Kelembagaan — 4 Kasubdit resmi sudah TERISI:
 *     · "Kepala Seksi Kelembagaan" — tanpa Seksi di bagan
 *
 * ## Kenapa aman
 *
 * Kedelapannya `status_jabatan` bukan DIHAPUS, TAPI **nol penghuni aktif DAN nol
 * riwayat jabatan** — diperiksa ulang DI SQL sesaat sebelum menghapus, bukan
 * dipercaya dari daftar di atas. Satu-satunya dependen adalah
 * `jabatan_target_anggota` (jadi "jabatan asal kandidat" di beberapa jabatan
 * target), dan `ON DELETE CASCADE` di FK itu membuang barisnya otomatis. Karena
 * nol penghuni, tidak ada SATU pun kandidat sungguhan yang eligibility-nya
 * bergeser — barisnya cuma pintu masuk yang tidak pernah bisa dipakai siapa pun.
 *
 * Ini SAMA POLANYA dengan `--hapus-kembar-aman` di `rapikan-unit.ts`: DELETE
 * sungguhan (bukan soft-delete `status_jabatan='DIHAPUS'`), sebab baris ini bukan
 * jabatan yang "sedang kosong" — ia jabatan yang TIDAK PERNAH SEHARUSNYA ada
 * sebagai entitas terpisah.
 *
 * `Sekretariat Lembaga Pengembangan Jasa Konstruksi` SENGAJA TIDAK disentuh
 * skrip ini — riwayat_jabatan Wiworo Setyoningrum (pegawai 237) menyebutnya
 * sebagai unit kerjanya YANG SEKARANG (mulai 2026-01-01, masih berjalan),
 * sehingga ia unit nyata yang kebetulan tidak digambar di bagan ringkas ini,
 * bukan data yang salah.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')

const HAPUS = [
  { id: 26, alasan: 'digantikan "Kepala Bagian Perencanaan, Program dan Keuangan" (TERISI)' },
  { id: 27, alasan: 'digantikan "Kepala Bagian Perencanaan, Program dan Keuangan" (TERISI)' },
  { id: 33, alasan: 'Sekretariat cuma 3 Bagian di bagan resmi, tanpa Seksi' },
  { id: 2, alasan: 'digantikan 4 Kasubdit resmi Dit. Pengadaan (semua TERISI)' },
  { id: 3, alasan: 'Direktorat → Subdit langsung di bagan resmi, tanpa Seksi' },
  { id: 25, alasan: 'digantikan "Kepala Sub Direktorat Bakuan Kompetensi" (TERISI)' },
  { id: 31, alasan: 'tanpa Seksi di bagan resmi Dit. Usaha & Kelembagaan' },
  { id: 32, alasan: 'tanpa Seksi di bagan resmi Dit. Kompetensi' },
] as const

async function main() {
  const { kueriSatu, eksekusi } = await import('../lib/db')

  console.log(`\nmode: ${TULIS ? 'TULIS' : 'kering'}\n`)

  let batal = 0
  for (const h of HAPUS) {
    const r = await kueriSatu<{ nama_jabatan: string; unit: string | null; penghuni: number; riwayat: number; asal: number }>(
      `SELECT j.nama_jabatan, u.nama_unit AS unit,
              (SELECT COUNT(*) FROM pegawai p WHERE p.jabatan_id = j.id AND p.status_aktif = 'AKTIF') AS penghuni,
              (SELECT COUNT(*) FROM riwayat_jabatan rj WHERE rj.jabatan_id = j.id) AS riwayat,
              (SELECT COUNT(*) FROM jabatan_target_anggota a WHERE a.jabatan_id = j.id) AS asal
         FROM jabatan j LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
        WHERE j.id = ?`,
      [h.id],
    )
    if (r === null) {
      console.log(`  #${h.id} sudah tidak ada — dilewati`)
      continue
    }
    const aman = Number(r.penghuni) === 0 && Number(r.riwayat) === 0
    console.log(
      `  #${h.id} "${r.nama_jabatan}" @ ${r.unit} — penghuni ${r.penghuni} · riwayat ${r.riwayat} · jadi asal di ${r.asal} target — ${aman ? 'AMAN' : 'DITAHAN (ada dependen!)'}`,
    )
    console.log(`        alasan: ${h.alasan}`)
    if (!aman) {
      batal++
      continue
    }
    if (TULIS) {
      await eksekusi('DELETE FROM jabatan WHERE id = ?', [h.id])
    }
  }

  console.log(`\n── ${TULIS ? 'DITULIS' : 'kering'} ── ${HAPUS.length - batal} dihapus${batal > 0 ? ` · ${batal} DITAHAN (bukan yang diharapkan — periksa manual)` : ''}`)
  if (!TULIS) console.log('   Tambahkan `--tulis` untuk menerapkan.\n')
  process.exit(batal > 0 ? 1 : 0)
}

void main()
