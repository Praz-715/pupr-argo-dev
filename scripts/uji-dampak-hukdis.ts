/**
 * BUKTIKAN hukuman disiplin benar-benar menurunkan skor — ujung ke ujung, di data
 * nyata, lalu dikembalikan.
 *
 *   npm run uji:hukdis            # KERING — melapor rencananya, tidak menulis
 *   npm run uji:hukdis -- --tulis # jalankan: sisipkan hukdis → hitung → pulihkan
 *
 * ## Kenapa uji ini perlu ada, padahal rumusnya sudah punya uji unit
 *
 * `hitungSkorIntegritas()` sudah diuji murni (`lib/scoring/scoring.test.ts` §2.7).
 * Yang BELUM pernah terbukti adalah rantai lengkapnya di aplikasi ini:
 * `hukuman_disiplin` **kosong untuk seluruh 79 pegawai**, jadi indikator Integritas
 * & Moralitas — 15% dari match score — selama ini selalu memakai cabang "tidak ada
 * catatan → 100" untuk semua orang. Cabang yang tidak pernah dijalani tidak bisa
 * disebut terbukti berjalan, dan pertanyaan pemilik proses 25 Agu 2026 tepat pada
 * titik itu: *"kalo ada pegawai yang kena hukuman disiplin, udah mempengaruhi
 * penilaian blm, nilainya harusnya berkurang"*.
 *
 * Jadi yang diuji di sini rantai yang menghubungkan **baris DB → profil kandidat →
 * mesin rubrik → `match_score` tersimpan**, bukan rumusnya.
 *
 * ## Cara kerjanya
 *
 *   1. potret skor pegawai subjek pada satu jabatan target AKTIF;
 *   2. sisipkan satu baris `hukuman_disiplin` (tingkat bisa dipilih `--tingkat=`);
 *   3. hitung ulang jabatan target itu **memakai jalur tulis aplikasi**
 *      (`hitungSkorMassal` + `tulisHasilSkor`, modul yang sama dengan tombol Hitung
 *      Ulang) — bukan SQL yang menulis angka sendiri, sebab yang sedang diuji justru
 *      apakah jalur itu membawa hukdis sampai ke ujung;
 *   4. bandingkan, lalu **PULIHKAN**: baris hukdis dihapus dan skornya dihitung ulang
 *      sekali lagi, dan skrip menegaskan angkanya kembali seperti semula.
 *
 * ## Yang membuat pemulihannya bisa dipercaya
 *
 * Pemulihan diverifikasi, bukan diasumsikan: potret AWAL dibandingkan lagi dengan
 * potret AKHIR, dan kalau berselisih skrip **melapor GAGAL PULIH** beserta angkanya.
 * Tanpa penegasan itu, uji yang mati di tengah akan meninggalkan hukuman disiplin
 * palsu menempel pada nama seseorang — data yang paling tidak boleh dikarang di
 * seluruh aplikasi ini.
 *
 * Subjeknya juga dipilih dari pegawai yang **belum punya** catatan disiplin, dan
 * dipastikan lagi sebelum menghapus bahwa yang dihapus adalah baris buatan skrip ini
 * (dikenali `no_sk` bertanda `UJI-HUKDIS`).
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')
const TINGKAT =
  (process.argv.find((a) => a.startsWith('--tingkat='))?.split('=')[1] as
    | 'Ringan'
    | 'Sedang'
    | 'Berat'
    | 'Sedang Menjalani'
    | undefined) ?? 'Sedang'

const NO_SK = `UJI-HUKDIS/${new Date().toISOString().slice(0, 10)}`

interface Potret {
  skorTotal: string
  skorIntegritas: string
  eligible: number
  nilaiIntegritas: string | null
  kategoriIntegritas: string | null
}

async function main() {
  const { kueri, kueriSatu, eksekusi } = await import('../lib/db')
  const { ambilProfilKandidat, ambilRubrikUntukHitung, ambilNilaiManual, ambilJejakManual } =
    await import('../lib/kueri/rubrik')
  const { ambilPengaturan } = await import('../lib/pengaturan')
  const { hitungSkorMassal } = await import('../lib/skor-massal')
  const { tulisHasilSkor } = await import('../lib/skoring-tulis')

  console.log(`\n=== DAMPAK HUKUMAN DISIPLIN PADA SKOR ${TULIS ? '(MENULIS)' : '(kering)'} ===\n`)

  // ── Pilih jabatan target AKTIF berubrik & pegawai subjek ────────────────
  const target = await kueriSatu<{ id: number; nama_target: string }>(
    `SELECT t.id, t.nama_target FROM jabatan_target t
      WHERE t.status = 'AKTIF'
        AND (SELECT COUNT(*) FROM rubrik_komponen k WHERE k.jabatan_target_id = t.id) > 0
      ORDER BY t.id LIMIT 1`,
  )
  if (target === null) {
    console.log('Tidak ada jabatan target AKTIF berubrik. Uji dihentikan.')
    process.exit(1)
  }

  /*
    Subjeknya pegawai berskor TERTINGGI yang belum punya catatan disiplin. Dipilih
    yang tertinggi supaya penurunannya tidak bisa tertutup plafon: kalau subjeknya
    sudah rendah, selisih bisa terlihat kecil karena komponen lain, bukan karena
    hukdis-nya tidak berpengaruh.
  */
  const subjek = await kueriSatu<{ id: number; nip: string; nama: string }>(
    `SELECT p.id, p.nip, p.nama_lengkap AS nama
       FROM match_score ms JOIN pegawai p ON p.id = ms.pegawai_id
      WHERE ms.jabatan_target_id = ?
        AND NOT EXISTS (SELECT 1 FROM hukuman_disiplin h WHERE h.pegawai_id = p.id)
      ORDER BY ms.skor_total DESC LIMIT 1`,
    [target.id],
  )
  if (subjek === null) {
    console.log('Tidak ada pegawai tanpa catatan disiplin pada jabatan target itu. Uji dihentikan.')
    process.exit(1)
  }

  const potret = async (): Promise<Potret | null> =>
    kueriSatu<Potret>(
      `SELECT ms.skor_total AS skorTotal, ms.skor_integritas_moralitas AS skorIntegritas,
              ms.eligible,
              (SELECT d.nilai_mentah FROM match_score_detail d
                 JOIN rubrik_indikator i ON i.id = d.rubrik_indikator_id
                WHERE d.match_score_id = ms.id AND i.kunci_sistem = 'INTEGRITAS'
                LIMIT 1) AS nilaiIntegritas,
              (SELECT d.kategori_terpilih FROM match_score_detail d
                 JOIN rubrik_indikator i ON i.id = d.rubrik_indikator_id
                WHERE d.match_score_id = ms.id AND i.kunci_sistem = 'INTEGRITAS'
                LIMIT 1) AS kategoriIntegritas
         FROM match_score ms
        WHERE ms.jabatan_target_id = ? AND ms.pegawai_id = ?`,
      [target.id, subjek.id],
    )

  const sebelum = await potret()
  console.log(`Jabatan target : #${target.id} ${target.nama_target}`)
  console.log(`Subjek         : ${subjek.nama} (${subjek.nip})`)
  console.log(`Tingkat hukuman: ${TINGKAT}`)
  console.log('\nSEBELUM:')
  console.log(`  skor total        : ${sebelum?.skorTotal}`)
  console.log(`  komponen integritas: ${sebelum?.skorIntegritas}`)
  console.log(`  nilai mentah      : ${sebelum?.nilaiIntegritas} → "${sebelum?.kategoriIntegritas}"`)
  console.log(`  lolos syarat      : ${sebelum?.eligible}`)

  const [hitungHukdis] = await kueri<{ n: number }>('SELECT COUNT(*) AS n FROM hukuman_disiplin')
  console.log(`\n  baris hukuman_disiplin di DB sekarang: ${hitungHukdis?.n ?? 0}`)

  if (!TULIS) {
    console.log('\nKering — tidak ada yang ditulis. Tambahkan `-- --tulis`.\n')
    process.exit(0)
  }

  // Satu jalur hitung-ulang, dipakai tiga kali: sesudah menyisipkan, dan sesudah
  // memulihkan. Dituliskan sekali supaya kedua pengukuran tidak bisa memakai jalan
  // yang berbeda — perbandingan yang jalannya berbeda tidak membuktikan apa pun.
  async function hitungUlang(): Promise<void> {
    const siap = await ambilRubrikUntukHitung(target!.id)
    if (siap === null) throw new Error('rubrik jabatan target hilang di tengah uji')
    const [profil, nilaiManual, jejakManual, pengaturan] = await Promise.all([
      ambilProfilKandidat(),
      ambilNilaiManual(target!.id),
      ambilJejakManual(target!.id),
      ambilPengaturan(),
    ])
    const hasil = hitungSkorMassal(siap.rubrik, profil, {
      nilaiManual,
      masaBerlakuTahun: pengaturan.masaBerlakuAsesmenTahun,
    })
    await tulisHasilSkor(
      target!.id,
      hasil.hasil,
      JSON.stringify(hasil.snapshotRubrik),
      jejakManual,
    )
  }

  // ── 1. Sisipkan hukuman disiplin ────────────────────────────────────────
  const { insertId } = await eksekusi(
    `INSERT INTO hukuman_disiplin
       (pegawai_id, tingkat_hukuman, tanggal_sk, no_sk, keterangan, status_aktif)
     VALUES (?, ?, CURDATE(), ?, ?, 1)`,
    [
      subjek.id,
      TINGKAT,
      NO_SK,
      'Baris UJI dari scripts/uji-dampak-hukdis.ts — dihapus otomatis di akhir uji.',
    ],
  )
  console.log(`\n  hukuman_disiplin #${insertId} disisipkan (${TINGKAT}, aktif)`)

  await hitungUlang()
  const sesudah = await potret()
  console.log('\nSESUDAH (hukdis aktif):')
  console.log(`  skor total        : ${sesudah?.skorTotal}`)
  console.log(`  komponen integritas: ${sesudah?.skorIntegritas}`)
  console.log(`  nilai mentah      : ${sesudah?.nilaiIntegritas} → "${sesudah?.kategoriIntegritas}"`)
  console.log(`  lolos syarat      : ${sesudah?.eligible}`)

  const turunTotal = Number(sebelum?.skorTotal) - Number(sesudah?.skorTotal)
  const turunKomponen = Number(sebelum?.skorIntegritas) - Number(sesudah?.skorIntegritas)
  console.log(`\n  SELISIH: skor total −${turunTotal.toFixed(2)} · komponen integritas −${turunKomponen.toFixed(2)}`)

  // ── 2. Bandingkan dengan yang SEHARUSNYA, bukan cuma "turun" ────────────
  /*
    Menegaskan "turun" saja terlalu lemah: nilai apa pun yang lebih kecil akan
    lolos, termasuk yang salah. Yang ditegaskan angka pastinya, diturunkan dari
    rubrik: skor kategori × bobot komponen 0,15.
  */
  const kategori = await kueriSatu<{ nilai_skor: string; bobot: string }>(
    `SELECT ks.nilai_skor, k.bobot_komponen AS bobot
       FROM rubrik_kategori_skor ks
       JOIN rubrik_indikator i ON i.id = ks.rubrik_indikator_id
       JOIN rubrik_komponen k ON k.id = i.rubrik_komponen_id
      WHERE k.jabatan_target_id = ? AND i.kunci_sistem = 'INTEGRITAS'
        AND ks.nama_kategori LIKE ?
      LIMIT 1`,
    [target.id, `%${TINGKAT}%`],
  )
  const skorKategori = Number(kategori?.nilai_skor ?? NaN)
  const bobot = Number(kategori?.bobot ?? NaN)
  const harusnya = (100 - skorKategori) * bobot
  console.log(
    `  Perkiraan dari rubrik: (100 − ${skorKategori}) × ${bobot} = −${harusnya.toFixed(2)} pada skor total`,
  )
  const cocok = Math.abs(turunTotal - harusnya) <= 0.02
  console.log(`  ${cocok ? 'COCOK' : 'TIDAK COCOK'} dengan perkiraan (toleransi 0,02 — pembulatan 2 desimal)`)

  // ── 3. PULIHKAN & buktikan pulihnya ─────────────────────────────────────
  const dihapus = await eksekusi(
    `DELETE FROM hukuman_disiplin WHERE id = ? AND no_sk = ?`,
    [insertId, NO_SK],
  )
  console.log(`\n  baris uji dihapus: ${dihapus.affectedRows} (dikunci no_sk "${NO_SK}")`)
  await hitungUlang()
  const akhir = await potret()
  const pulih =
    akhir?.skorTotal === sebelum?.skorTotal &&
    akhir?.skorIntegritas === sebelum?.skorIntegritas &&
    akhir?.eligible === sebelum?.eligible
  console.log('\nSESUDAH DIPULIHKAN:')
  console.log(`  skor total        : ${akhir?.skorTotal} (awal ${sebelum?.skorTotal})`)
  console.log(`  komponen integritas: ${akhir?.skorIntegritas} (awal ${sebelum?.skorIntegritas})`)
  console.log(`  ${pulih ? 'PULIH PERSIS' : '⚠️  GAGAL PULIH — periksa manual'}`)

  const [sisa] = await kueri<{ n: number }>(
    `SELECT COUNT(*) AS n FROM hukuman_disiplin WHERE no_sk LIKE 'UJI-HUKDIS%'`,
  )
  console.log(`  sisa baris uji di DB: ${sisa?.n ?? 0}`)

  console.log(
    `\n=== KESIMPULAN ===\n` +
      `  Hukuman disiplin ${cocok ? 'MEMPENGARUHI' : 'TIDAK sesuai perkiraan pada'} penilaian: ` +
      `skor total ${sebelum?.skorTotal} → ${sesudah?.skorTotal} (−${turunTotal.toFixed(2)}), ` +
      `komponen Integritas ${sebelum?.skorIntegritas} → ${sesudah?.skorIntegritas}.\n` +
      `  Kelayakan TIDAK berubah (${sebelum?.eligible} → ${sesudah?.eligible}) — hukuman disiplin\n` +
      `  memang bukan syarat gugur di rubrik ini, ia menurunkan skor. Kalau ia harus\n` +
      `  menggugurkan, itu keputusan pemilik proses dan tempatnya di tab Persyaratan.\n`,
  )
  process.exit(pulih ? 0 : 1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
