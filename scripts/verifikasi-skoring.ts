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

/**
 * Waktu acuan perbandingan — **jam NYATA, bukan tanggal yang dipaku.**
 *
 * Versi lama memaku `new Date(2026, 6, 30, 12)` supaya ujinya reproducible. Niatnya
 * benar, akibatnya tidak: skrip ini membandingkan hasil hitung ulang dengan isi
 * `match_score`, dan isi itu dihitung aplikasi memakai jam nyata. Begitu keduanya
 * berbeda tanggal, gerbang kelayakan yang bergantung waktu (masa berlaku asesmen,
 * masa menjabat) menjawab berbeda — dan skrip melaporkannya sebagai "kode
 * menyimpang" padahal yang berbeda cuma pertanyaannya: layak **pada tanggal berapa**.
 *
 * Terukur 18 Agu 2026: Annisa Tasya Azhari di target 200, skor SAMA (69,23 = 69,23)
 * tapi tersimpan `eligible` sementara skrip menghitung `tidak` — selisih 19 hari
 * antara tanggal paku (30 Juli) dan jam nyata (18 Agustus).
 *
 * Reproducibility-nya tidak hilang begitu saja: yang membuat skrip ini bermakna
 * adalah membandingkan DUA IMPLEMENTASI pada masukan yang SAMA, dan itu justru
 * menuntut waktu yang sama dengan yang dipakai penulis barisnya.
 */
const SEKARANG = new Date()
const TAHUN_SEKARANG = SEKARANG.getFullYear()

/**
 * ⚠️ Masa berlaku asesmen dibaca dari **`pengaturan_sistem`**, bukan dikonstanta.
 *
 * Ini penyebab sebenarnya penyimpangan 18 Agu 2026 — bukan tanggal, bukan nilai
 * manual. Skrip memaku 3 tahun sementara pengaturan di DB bernilai **4**, jadi
 * aplikasi menganggap asesmen seseorang masih berlaku dan skrip menganggapnya
 * kedaluwarsa. Skornya identik (69,23) karena masa berlaku tidak mengubah bobot;
 * yang bergeser hanya **kelayakan** — dan itu justru keluaran yang paling
 * menentukan siapa boleh dinominasikan.
 *
 * Pelajarannya berlaku umum untuk skrip pembanding mana pun di repo ini: setiap
 * parameter yang bisa diubah pengguna WAJIB dibaca dari sumbernya, bukan
 * disalin sebagai konstanta. Konstanta yang kebetulan sama dengan default akan
 * terlihat benar sampai seseorang mengubah pengaturannya — lalu skripnya
 * melaporkan "kode menyimpang" untuk kode yang benar.
 */
const TOLERANSI = 0.005 // setengah satuan terkecil DECIMAL(6,2)

async function main() {
  const { ambilPengaturan } = await import('../lib/pengaturan')
  const { ambilNilaiManual, ambilProfilKandidat, ambilRubrikUntukHitung, ambilSkorTersimpan } =
    await import(
    '../lib/kueri/rubrik'
  )
  const { kueri } = await import('../lib/db')
  const { hitungSkorMassal } = await import('../lib/skor-massal')

  const target = await kueri<{ id: number; nama_target: string; status: string }>(
    `SELECT id, nama_target, status FROM jabatan_target ORDER BY id`,
  )

  const dilewatiManual = 0
  let dilewatiDraft = 0
  const profil = await ambilProfilKandidat()
  const pengaturan = await ambilPengaturan()
  console.log(`${profil.length} pegawai aktif · ${target.length} jabatan target\n`)

  let diperiksa = 0
  let menyimpang = 0
  const contoh: string[] = []

  for (const t of target) {
    // Jabatan target DRAFT belum tentu pernah di-Hitung Ulang, dan itu keadaan
    // yang SAH — Hitung Ulang adalah tindakan sadar, bukan otomatis saat target
    // dibuat. Membandingkannya menghasilkan satu "tidak ada baris match_score"
    // per pegawai (43 di dev), yang menenggelamkan penyimpangan sungguhan di
    // antara puluhan baris derau.
    if (String(t.status) === 'DRAFT') {
      const adaSkor = (await ambilSkorTersimpan(Number(t.id))).length
      if (adaSkor === 0) {
        dilewatiDraft++
        console.log(`target ${t.id} — ${t.nama_target}: DRAFT & belum dihitung · dilewati`)
        continue
      }
    }

    const siap = await ambilRubrikUntukHitung(Number(t.id))
    if (siap === null) continue

    /**
     * `nilaiManual` WAJIB diteruskan, sama seperti yang dilakukan aplikasi.
     *
     * Tanpa itu skrip menghitung tanpa nilai yang diisi manusia, lalu setiap
     * indikator manual muncul sebagai penyimpangan. Dulu ditangani dengan
     * MELEWATI pasangan ber-nilai-manual — aman, tapi berarti pegawai yang paling
     * perlu diperiksa justru yang tidak pernah diperiksa. Sekarang masukannya
     * disamakan, jadi cakupannya kembali penuh.
     */
    const nilaiManual = await ambilNilaiManual(Number(t.id))
    const hasil = hitungSkorMassal(siap.rubrik, profil, {
      nilaiManual,
      sekarang: SEKARANG,
      tahunSekarang: TAHUN_SEKARANG,
      masaBerlakuTahun: pengaturan.masaBerlakuAsesmenTahun,
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

  // -------------------------------------------------------------------------
  // Ekspresi SQL Kotak 9 vs hitungKotak9() — pengaman Fase 11
  // -------------------------------------------------------------------------
  // Peta Talenta per jabatan target menghitung kotaknya **di SQL**: sumbu X-nya
  // `match_score.skor_total`, yang tidak tersimpan sebagai kotak di kolom mana
  // pun. Jadi ada dua jalur yang wajib selalu sepakat — `ekspresiSqlKotak9()`
  // yang dijalankan MySQL, dan `hitungKotak9()` di TypeScript.
  //
  // Keduanya memang turun dari `MATRIKS_KOTAK_9` yang sama, tapi itu tidak
  // menjamin **urutan cabang `CASE`**-nya benar: `CASE` memakai cabang pertama
  // yang cocok, sehingga satu baris tertukar hanya salah di sekitar ambang — 60
  // dan 80 — yaitu justru tempat yang paling jarang diperiksa orang dan paling
  // sering menentukan kotak seseorang. Karena itu diuji **exhaustif** atas kisi
  // langkah 5, bukan atas baris yang kebetulan ada di DB.
  //
  // Kisinya sengaja MELEWATI 100 (sumbu X sampai 130). Sejak potkom tidak lagi
  // diplafon (`hitungKotak9()`, 18 Agu 2026), sumbu X yang nyata di DB memang
  // bisa >100 — dan kisi yang berhenti di 100 akan menyatakan "setara" atas
  // rentang yang sudah bukan seluruh rentangnya lagi. Sumbu Y tetap 0–100 karena
  // ia turunan predikat kinerja yang berskala tetap; menguji Y=130 berarti
  // menguji keadaan yang tidak bisa terjadi.
  const { ekspresiSqlKotak9, hitungKotak9 } = await import('../lib/scoring')
  const { ambangSumbuDari } = await import('../lib/pengaturan')

  /**
   * Ambang dibaca dari `pengaturan_sistem` — dan justru itu yang membuat langkah
   * ini jadi penjaga butir 7.
   *
   * Ambang 80/60 kini bisa diubah Super Admin. Kalau ada satu jalur yang masih
   * memakai angka kode sementara yang lain memakai angka DB, `kotak_9` yang
   * TERSIMPAN tidak akan lagi bisa dilahirkan ulang dari pengaturan yang berlaku
   * — dan itu muncul di sini sebagai baris menyimpang, bukan sebagai keluhan
   * pengguna berbulan-bulan kemudian.
   */
  const ambang = ambangSumbuDari(pengaturan)
  console.log(`ambang sumbu dipakai: tengah ${ambang.tengah} · atas ${ambang.atas}`)
  const kisi = await kueri<{ y: number; x: number; kotak: number }>(
    `WITH RECURSIVE ny(v) AS (SELECT 0 UNION ALL SELECT v + 5 FROM ny WHERE v < 100),
                    nx(v) AS (SELECT 0 UNION ALL SELECT v + 5 FROM nx WHERE v < 130)
     SELECT ny.v AS y, nx.v AS x, ${ekspresiSqlKotak9('ny.v', 'nx.v', ambang)} AS kotak
     FROM ny CROSS JOIN nx`,
  )

  let bedaKisi = 0
  for (const r of kisi) {
    const dariTs = hitungKotak9(Number(r.y), Number(r.x), ambang).kotak
    if (Number(r.kotak) !== dariTs) {
      bedaKisi++
      if (contoh.length < 10) {
        contoh.push(`  kisi Y=${r.y} X=${r.x}: SQL memberi ${r.kotak}, hitungKotak9 memberi ${dariTs}`)
      }
    }
  }
  menyimpang += bedaKisi
  console.log(
    `\nekspresi SQL Kotak 9 — ${kisi.length} pasangan (Y,X) diperiksa: ` +
      `${bedaKisi === 0 ? 'setara dengan hitungKotak9()' : `${bedaKisi} MENYIMPANG`}`,
  )

  console.log(`\n${diperiksa} baris skor diperiksa · ${menyimpang} menyimpang`)
  // Yang dilewati DILAPORKAN, tidak disembunyikan: "0 menyimpang" yang
  // sebenarnya berarti "semuanya dilewati" adalah hijau yang menipu.
  if (dilewatiManual > 0 || dilewatiDraft > 0) {
    console.log(
      `dilewati dengan sengaja: ${dilewatiManual} baris bernilai MANUAL · ` +
        `${dilewatiDraft} jabatan target DRAFT yang belum dihitung`,
    )
  }
  if (contoh.length > 0) {
    console.log('\ncontoh selisih:')
    for (const c of contoh) console.log(c)
  }

  if (menyimpang > 0) {
    console.error(
      '\nGAGAL: hasil lib/skor-massal berbeda dari isi match_score, atau ekspresi SQL Kotak 9\n' +
        'berbeda dari hitungKotak9(). Salah satunya salah — periksa perubahan terakhir di\n' +
        'lib/scoring, lib/penilaian, atau lib/skor-massal.',
    )
    process.exit(1)
  }
  console.log(
    '\nOK: lib/skor-massal melahirkan ulang seluruh isi match_score, dan ekspresi SQL\n' +
      'Kotak 9 setara dengan hitungKotak9() pada seluruh kisi ambang.',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
