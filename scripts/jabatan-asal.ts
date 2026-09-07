/**
 * Alihkan `jabatan_target_anggota` dari "KURSI YANG DITUJU" menjadi "JABATAN ASAL
 * KANDIDAT", diisi dari syarat `RUMPUN_JABATAN` — lalu buang syaratnya.
 *
 *   npm run jabatan:asal
 *   npm run jabatan:asal -- --tulis
 *
 * Permintaan pemilik proses 1 Sep 2026: *"kalo udah masuk semua jabatan anggota, di
 * persyaratan Rumpun jabatan asal ilangin aja, jadi fungsinya diganti ke jabatan
 * anggota"*.
 *
 * ## Kenapa syarat rumpunnya DIBUANG, bukan dibiarkan berdampingan
 *
 * Keduanya menjawab pertanyaan yang SAMA — jabatan mana yang boleh dinominasikan —
 * dari dua tempat. Dua sumber kebenaran atas satu pertanyaan adalah cacat yang sudah
 * berulang kali menggigit di repo ini, dan bentuknya di sini akan sangat menipu:
 * seseorang menyunting daftar jabatannya, angkanya tidak bergerak karena syarat
 * rumpun yang lebih longgar/ketat masih ikut memutuskan, dan tidak ada galat apa pun.
 *
 * Yang bertahan daftar jabatan KONKRET, sebab itu yang bisa dilihat & disunting per
 * baris. Rumpunnya dipakai sekali untuk mengisinya, lalu selesai.
 *
 * ## Mengosongkan anggota lama aman KARENA kursinya sudah pindah
 *
 * `doc/sql/032` memindahkan kursi ke `jabatan_target.jabatan_id` dan seluruh
 * pembacanya sudah dialihkan. Skrip ini MEMERIKSANYA lagi sebelum menghapus: target
 * yang `jabatan_id`-nya masih NULL dilewati, sebab menghapus anggotanya di sana
 * berarti kehilangan satu-satunya jejak kursi yang ia tuju.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')

async function main() {
  const { kueri, eksekusi } = await import('../lib/db')
  const { kunciRumpunJabatan } = await import('../lib/jenis-jabatan')

  const target = await kueri<{
    id: number
    nama_target: string
    jabatan_id: number | null
    rumpun: string | null
  }>(
    `SELECT t.id, t.nama_target, t.jabatan_id,
            (SELECT s.nilai_minimal FROM jabatan_target_persyaratan s
              WHERE s.jabatan_target_id = t.id AND s.jenis_syarat = 'RUMPUN_JABATAN'
              LIMIT 1) AS rumpun
       FROM jabatan_target t ORDER BY t.id`,
  )
  const semuaJabatan = await kueri<{ id: number; nama_jabatan: string }>(
    `SELECT id, nama_jabatan FROM jabatan WHERE status_jabatan <> 'DIHAPUS'`,
  )

  console.log(`\nmode: ${TULIS ? 'TULIS' : 'kering'} · ${target.length} jabatan target\n`)
  let diisi = 0
  let dilewati = 0

  for (const t of target) {
    const label = `  #${t.id} ${t.nama_target.slice(0, 38).padEnd(40)}`
    if (t.jabatan_id === null) {
      dilewati++
      console.log(`${label} kursinya belum pindah (jabatan_id NULL) → DILEWATI`)
      continue
    }
    if (t.rumpun === null || t.rumpun.trim() === '') {
      dilewati++
      console.log(`${label} tanpa syarat rumpun → daftar dibiarkan kosong`)
      continue
    }

    const kunci = new Set(
      t.rumpun
        .split(',')
        .map((r) => kunciRumpunJabatan(r.trim()))
        .filter((r) => r !== ''),
    )
    const cocok = semuaJabatan.filter((j) => kunci.has(kunciRumpunJabatan(j.nama_jabatan)))
    console.log(`${label} ${t.rumpun} → ${cocok.length} jabatan`)

    if (TULIS) {
      // Anggota lama = kursi, sudah ada di `jabatan_target.jabatan_id`.
      await eksekusi(`DELETE FROM jabatan_target_anggota WHERE jabatan_target_id = ?`, [t.id])
      for (const j of cocok) {
        await eksekusi(
          `INSERT IGNORE INTO jabatan_target_anggota (jabatan_target_id, jabatan_id) VALUES (?, ?)`,
          [t.id, j.id],
        )
      }
      await eksekusi(
        `DELETE FROM jabatan_target_persyaratan
          WHERE jabatan_target_id = ? AND jenis_syarat = 'RUMPUN_JABATAN'`,
        [t.id],
      )
      diisi++
    }
  }

  if (TULIS) {
    const sisa = await kueri<{ n: number }>(
      `SELECT COUNT(*) AS n FROM jabatan_target_persyaratan WHERE jenis_syarat = 'RUMPUN_JABATAN'`,
    )
    console.log(`\n  diisi: ${diisi} · dilewati: ${dilewati}`)
    console.log(`  sisa syarat RUMPUN_JABATAN: ${Number(sisa[0]!.n)} (harus 0)`)
    console.log('\nKelayakan BELUM bergerak — jalankan `npm run hitung:ulang -- --tulis`.\n')
  } else {
    console.log(`\n  akan diisi: ${target.length - dilewati} · dilewati: ${dilewati}`)
    console.log('\nKering — tidak ada yang ditulis. Tambahkan `--tulis`.\n')
  }
  process.exit(0)
}

void main()
