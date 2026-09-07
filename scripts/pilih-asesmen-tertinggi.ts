/**
 * Setel ulang asesmen yang DIPAKAI: potkom tertinggi, dahulukan yang masih berlaku.
 *
 *   npm run asesmen:tertinggi
 *   npm run asesmen:tertinggi -- --tulis
 *   npm run asesmen:tertinggi -- --tulis --termasuk-manusia
 *
 * Permintaan pemilik proses 1 Sep 2026: *"bikin defaultnya yang nilainya paling
 * tinggi tapi pastiin ambil yang masih aktif kecuali emang udah gak ada yang aktif."*
 *
 * ## Kenapa mengubah `urutAsesmenBerlaku()` saja TIDAK cukup
 *
 * Aturan urutan itu hanya menentukan pemenang bagi pegawai yang **belum punya baris
 * `asesmen_dipakai`**. Backfill `doc/sql/022` sudah menuliskan pilihan untuk 145
 * pegawai memakai aturan LAMA (tahun terbaru, lalu `id DESC`), jadi tanpa skrip ini
 * aturan barunya tidak menyentuh satu pun data yang ada — dan itu bentuk kegagalan
 * yang paling menipu: kodenya benar, ujinya hijau, angkanya tidak bergerak.
 *
 * ## Pilihan MANUSIA dilindungi secara bawaan
 *
 * `ditetapkan_oleh IS NOT NULL` berarti seorang verifikator memilihnya lewat UI.
 * Menimpanya berarti membuang keputusan orang tanpa jejak. Yang backfill
 * (`ditetapkan_oleh IS NULL`) bukan keputusan siapa-siapa dan bebas disetel ulang.
 *
 * `--termasuk-manusia` melampaui penjaga itu — dipakai 1 Sep 2026 atas permintaan
 * eksplisit pemilik proses ("itu gw yang test ubah"), dan tiap baris yang ditimpa
 * DISEBUTKAN satu per satu supaya keputusan itu terlihat, bukan lewat diam.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')
const TERMASUK_MANUSIA = process.argv.includes('--termasuk-manusia')

async function main() {
  const { kueri, eksekusi } = await import('../lib/db')

  /*
    Pemenang menurut aturan BARU, dihitung di SQL dengan ekspresi yang sama persis
    dengan `urutAsesmenBerlaku()` minus klausa `asesmen_dipakai` — klausa itu justru
    yang sedang disetel ulang, jadi menyertakannya membuat pilihan lama memilih
    dirinya sendiri.
  */
  const baris = await kueri<{
    pegawai_id: number
    nama: string
    lama_id: number | null
    lama_label: string | null
    baru_id: number
    baru_label: string
    oleh: number | null
  }>(
    `WITH peringkat AS (
       SELECT a.id, a.pegawai_id, a.potkom, a.status_asesmen, a.jenjang_asesmen, a.tahun_asesmen,
              ROW_NUMBER() OVER (
                PARTITION BY a.pegawai_id
                ORDER BY (a.status_asesmen <> 'Expired') DESC,
                         a.potkom DESC, a.tahun_asesmen DESC, a.id DESC
              ) AS rn
         FROM asesmen_talenta a
     )
     SELECT p.id AS pegawai_id, p.nama_lengkap AS nama,
            d.asesmen_id AS lama_id, d.ditetapkan_oleh AS oleh,
            CONCAT(COALESCE(al.jenjang_asesmen,'?'), ' ', COALESCE(al.potkom,'-'),
                   IF(al.status_asesmen = 'Expired', ' (Expired)', '')) AS lama_label,
            r.id AS baru_id,
            CONCAT(COALESCE(r.jenjang_asesmen,'?'), ' ', COALESCE(r.potkom,'-'),
                   IF(r.status_asesmen = 'Expired', ' (Expired)', '')) AS baru_label
       FROM peringkat r
       JOIN pegawai p ON p.id = r.pegawai_id
       LEFT JOIN asesmen_dipakai d ON d.pegawai_id = p.id
       LEFT JOIN asesmen_talenta al ON al.id = d.asesmen_id
      WHERE r.rn = 1
      ORDER BY p.nama_lengkap`,
  )

  const berubah = baris.filter((b) => b.lama_id !== b.baru_id)
  const manusia = berubah.filter((b) => b.oleh !== null)
  const dikerjakan = TERMASUK_MANUSIA ? berubah : berubah.filter((b) => b.oleh === null)

  console.log(`\nmode: ${TULIS ? 'TULIS' : 'kering'} · ${baris.length} pegawai berasesmen\n`)
  for (const b of dikerjakan) {
    console.log(
      `  ${b.nama.slice(0, 34).padEnd(36)} ${String(b.lama_label ?? '(belum ada)').padEnd(26)} → ${b.baru_label}` +
        (b.oleh !== null ? '   ⚠ MENIMPA PILIHAN MANUSIA' : ''),
    )
  }

  if (!TERMASUK_MANUSIA && manusia.length > 0) {
    console.log(`\n  ${manusia.length} pilihan MANUSIA dilewati (pakai --termasuk-manusia untuk ikut menyetelnya):`)
    for (const b of manusia) console.log(`    ${b.nama.slice(0, 34)}: tetap ${b.lama_label}`)
  }

  console.log(`\n  ${TULIS ? 'disetel' : 'akan disetel'}: ${dikerjakan.length} · sudah sesuai: ${baris.length - berubah.length}`)

  if (!TULIS) {
    console.log('\nKering — tidak ada yang ditulis. Tambahkan `--tulis`.\n')
    process.exit(0)
  }

  for (const b of dikerjakan) {
    /*
      `asesmen_dipakai` ber-PK `pegawai_id` DAN ber-UNIQUE `asesmen_id`. Upsert biasa
      bisa menabrak yang kedua kalau baris lain sudah memegang asesmen itu, jadi
      barisnya dihapus dulu — bukan `ON DUPLICATE KEY UPDATE`.
    */
    await eksekusi('DELETE FROM asesmen_dipakai WHERE pegawai_id = ?', [b.pegawai_id])
    await eksekusi(
      `INSERT INTO asesmen_dipakai (pegawai_id, asesmen_id, ditetapkan_oleh, catatan)
       VALUES (?, ?, NULL, 'Disetel skrip: potkom tertinggi, dahulukan yang masih berlaku')`,
      [b.pegawai_id, b.baru_id],
    )
  }

  const sisa = await kueri<{ n: number }>(
    `SELECT COUNT(*) AS n FROM asesmen_dipakai d
       JOIN asesmen_talenta a ON a.id = d.asesmen_id
      WHERE a.status_asesmen = 'Expired'
        AND EXISTS (SELECT 1 FROM asesmen_talenta b
                     WHERE b.pegawai_id = d.pegawai_id AND b.status_asesmen <> 'Expired')`,
  )
  console.log(`\n  penjaga: pegawai yang memakai asesmen Expired padahal punya yang berlaku = ${Number(sisa[0]!.n)} (harus 0)`)
  console.log('\nSkor BELUM bergerak — jalankan `npm run hitung:ulang -- --tulis`.\n')
  process.exit(0)
}

void main()
