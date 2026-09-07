/**
 * Hitung Ulang match score dari baris perintah — jalur tulis yang SAMA dengan
 * tombol Hitung Ulang di UI.
 *
 *   npm run hitung:ulang                      # KERING — melapor apa yang akan dihitung
 *   npm run hitung:ulang -- --tulis           # hitung SELURUH jabatan target AKTIF
 *   npm run hitung:ulang -- --tulis --target=386
 *
 * ## Kenapa ada, padahal sudah ada tombolnya di UI dan `db:recompute`
 *
 * `match_score` kolom **TERSIMPAN**: ia hanya berubah saat Hitung Ulang dijalankan.
 * Jadi setiap perubahan data yang menjadi masukan rubrik — catatan disiplin baru,
 * riwayat diklat divalidasi, persyaratan diubah — meninggalkan skor lama di layar
 * sampai seseorang menghitung ulang. Dengan 8 jabatan target aktif, itu 8 klik yang
 * mudah terlewat satu, dan yang terlewat tidak memberi tanda apa pun.
 *
 * Dua jalan yang sudah ada tidak menutupi kebutuhan ini:
 *
 *   - **tombol di UI** menghitung SATU jabatan target per klik dan butuh sesi;
 *   - **`npm run db:recompute`** tidak menghitung apa pun — ia menulis ulang berkas
 *     `doc/sql/007_recompute.sql` (10 MB) yang lalu harus dieksekusi terpisah. Itu
 *     alat untuk membuat seed reproducible, bukan untuk memperbarui skor.
 *
 * Skrip ini memakai modul yang sama dengan aksinya (`hitungSkorMassal` +
 * `tulisHasilSkor`), jadi tidak ada jalur tulis ketiga yang bisa berselisih. Yang
 * TIDAK ia miliki hanya gerbang peran & jejak audit `RECOMPUTE` — keduanya milik
 * server action, dan itulah sebabnya skrip ini alat operator, bukan pengganti
 * tombolnya.
 *
 * ## Yang dilaporkannya, dan kenapa itu penting
 *
 * Untuk tiap jabatan target: jumlah baris, yang lolos syarat, yang perlu ditinjau,
 * dan **selisih skor terhadap yang tersimpan sebelumnya**. Angka terakhir itu yang
 * menjawab "apakah perubahan data tadi benar-benar berpengaruh" — tanpa itu,
 * perhitungan yang berhasil dan perhitungan yang tidak mengubah apa pun terlihat
 * sama.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')
const SATU = Number(process.argv.find((a) => a.startsWith('--target='))?.split('=')[1] ?? NaN)
/**
 * Ikut menghitung jabatan target DRAFT & NONAKTIF yang sudah punya baris skor.
 *
 * Bawaannya hanya AKTIF — itu yang dipakai memutuskan. Tapi skor TERSIMPAN pada
 * target non-aktif tetap dibandingkan `npm run verifikasi:skoring`, jadi
 * membiarkannya basi membuat pemeriksaan itu merah **permanen** atas keadaan yang
 * memang bukan cacat kode. Penjaga yang selalu merah berhenti dibaca, dan temuan
 * sungguhan ikut terabaikan bersamanya.
 */
const SEMUA_STATUS = process.argv.includes('--semua-status')

async function main() {
  const { kueri, kueriSatu } = await import('../lib/db')
  const { ambilProfilKandidat, ambilRubrikUntukHitung, ambilNilaiManual, ambilJejakManual } =
    await import('../lib/kueri/rubrik')
  const { ambilPengaturan } = await import('../lib/pengaturan')
  const { hitungSkorMassal } = await import('../lib/skor-massal')
  const { tulisHasilSkor } = await import('../lib/skoring-tulis')

  const target = Number.isNaN(SATU)
    ? await kueri<{ id: number; nama_target: string }>(
        `SELECT t.id, t.nama_target FROM jabatan_target t
          WHERE ${SEMUA_STATUS ? '1 = 1' : "t.status = 'AKTIF'"}
            AND (SELECT COUNT(*) FROM rubrik_komponen k WHERE k.jabatan_target_id = t.id) > 0
            ${SEMUA_STATUS ? 'AND (SELECT COUNT(*) FROM match_score m WHERE m.jabatan_target_id = t.id) > 0' : ''}
          ORDER BY t.id`,
      )
    : await kueri<{ id: number; nama_target: string }>(
        `SELECT id, nama_target FROM jabatan_target WHERE id = ?`,
        [SATU],
      )

  console.log(`\n=== HITUNG ULANG MATCH SCORE ${TULIS ? '(MENULIS)' : '(kering)'} ===\n`)
  console.log(
    Number.isNaN(SATU)
      ? `Jabatan target ${SEMUA_STATUS ? 'BERUBRIK & sudah punya skor (semua status)' : 'AKTIF berubrik'}: ${target.length}`
      : `Satu jabatan target: #${SATU}`,
  )
  for (const t of target) console.log(`  #${t.id} ${t.nama_target}`)

  if (target.length === 0) {
    console.log('\nTidak ada yang bisa dihitung.\n')
    process.exit(0)
  }
  if (!TULIS) {
    console.log('\nKering — tidak ada yang ditulis. Tambahkan `-- --tulis`.\n')
    process.exit(0)
  }

  /*
    Profil kandidat dibaca SEKALI untuk semua jabatan target, bukan sekali per
    target: ia memuat riwayat lengkap seluruh pegawai aktif (kueri terberat di
    aplikasi ini), dan isinya tidak bergantung pada jabatan targetnya. Delapan
    target berarti delapan kali pembacaan itu kalau ditaruh di dalam loop.
  */
  const [profil, pengaturan] = await Promise.all([ambilProfilKandidat(), ambilPengaturan()])
  console.log(`\nprofil kandidat dibaca sekali: ${profil.length} pegawai aktif`)

  console.log('\n── HASIL ──')
  for (const t of target) {
    const mulai = Date.now()
    const siap = await ambilRubrikUntukHitung(t.id)
    if (siap === null || siap.rubrik.komponen.length === 0) {
      console.log(`  #${t.id} ${t.nama_target}: DILEWATI — belum punya rubrik`)
      continue
    }

    // Potret sebelum, supaya selisihnya bisa dilaporkan. "Berhasil menghitung"
    // tanpa selisih tidak menjawab apakah perubahan datanya berpengaruh.
    const sebelum = await kueriSatu<{ rata: string | null; eligible: number }>(
      `SELECT AVG(skor_total) AS rata, SUM(eligible) AS eligible
         FROM match_score WHERE jabatan_target_id = ?`,
      [t.id],
    )

    const [nilaiManual, jejakManual] = await Promise.all([
      ambilNilaiManual(t.id),
      ambilJejakManual(t.id),
    ])
    const hasil = hitungSkorMassal(siap.rubrik, profil, {
      nilaiManual,
      masaBerlakuTahun: pengaturan.masaBerlakuAsesmenTahun,
    })
    const tulis = await tulisHasilSkor(
      t.id,
      hasil.hasil,
      JSON.stringify(hasil.snapshotRubrik),
      jejakManual,
    )

    const sesudah = await kueriSatu<{ rata: string | null; eligible: number }>(
      `SELECT AVG(skor_total) AS rata, SUM(eligible) AS eligible
         FROM match_score WHERE jabatan_target_id = ?`,
      [t.id],
    )
    const rataSebelum = Number(sebelum?.rata ?? 0)
    const rataSesudah = Number(sesudah?.rata ?? 0)
    const selisih = rataSesudah - rataSebelum
    console.log(
      `  #${t.id} ${t.nama_target}: ${hasil.hasil.length} baris · ${hasil.jumlahEligible} lolos ` +
        `(sebelumnya ${sebelum?.eligible ?? 0}) · ${hasil.jumlahPerluReview} perlu ditinjau · ` +
        `${tulis.jumlahRincian} rincian · rata skor ${rataSebelum.toFixed(2)} → ${rataSesudah.toFixed(2)} ` +
        `(${selisih >= 0 ? '+' : ''}${selisih.toFixed(2)}) · ${Date.now() - mulai} ms`,
    )
  }

  console.log(
    '\n  CATATAN: skrip ini tidak mencatat jejak `RECOMPUTE` di audit_log — itu milik\n' +
      '  server action di UI. Untuk perhitungan yang harus bisa dipertanggungjawabkan\n' +
      '  (mis. sebelum penetapan suksesor), pakai tombol Hitung Ulang di halaman\n' +
      '  jabatan targetnya supaya pelakunya tercatat.\n',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
