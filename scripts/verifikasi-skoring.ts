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

const SEKARANG = new Date(2026, 6, 30, 12)
const TAHUN_SEKARANG = 2026
const MASA_BERLAKU = 3
const TOLERANSI = 0.005 // setengah satuan terkecil DECIMAL(6,2)

async function main() {
  const { ambilProfilKandidat, ambilRubrikUntukHitung, ambilSkorTersimpan } = await import(
    '../lib/kueri/rubrik'
  )
  const { kueri } = await import('../lib/db')
  const { hitungSkorMassal } = await import('../lib/skor-massal')

  const target = await kueri<{ id: number; nama_target: string; status: string }>(
    `SELECT id, nama_target, status FROM jabatan_target ORDER BY id`,
  )

  /**
   * Pasangan (pegawai, jabatan target) yang punya indikator bernilai MANUAL.
   *
   * **Wajib dikecualikan, dan itu bukan pelemahan.** Skrip ini menangkap KODE
   * yang menyimpang: ia menjalankan `lib/skor-massal` lalu membandingkannya
   * dengan isi `match_score`. Nilai manual adalah penyimpangan yang DISENGAJA —
   * manusia memilih kategori rubrik untuk indikator yang datanya belum ada, dan
   * `lib/skoring-tulis.ts` memang mempertahankannya saat Hitung Ulang. Karena
   * `skor-massal` tidak tahu apa-apa soal jejak manual, setiap pemakaian fitur
   * "Isi manual" di profil akan membuat skrip ini merah selamanya — merah yang
   * tidak menunjukkan cacat apa pun, dan justru melatih orang mengabaikannya.
   */
  const manual = new Set(
    (
      await kueri<{ pegawai_id: number; jabatan_target_id: number }>(
        `SELECT DISTINCT ms.pegawai_id, ms.jabatan_target_id
           FROM match_score_detail d
           JOIN match_score ms ON ms.id = d.match_score_id
          WHERE d.sumber_nilai = 'MANUAL'`,
      )
    ).map((r) => `${r.jabatan_target_id}:${r.pegawai_id}`),
  )
  let dilewatiManual = 0
  let dilewatiDraft = 0
  const profil = await ambilProfilKandidat()
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

    const hasil = hitungSkorMassal(siap.rubrik, profil, {
      sekarang: SEKARANG,
      tahunSekarang: TAHUN_SEKARANG,
      masaBerlakuTahun: MASA_BERLAKU,
    })
    const tersimpan = new Map(
      (await ambilSkorTersimpan(Number(t.id))).map((s) => [s.pegawaiId, s]),
    )

    let bedaTarget = 0
    for (const h of hasil.hasil) {
      if (manual.has(`${t.id}:${h.pegawaiId}`)) {
        dilewatiManual++
        continue
      }
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
  // 0–100 langkah 5 (441 pasangan), bukan atas baris yang kebetulan ada di DB.
  const { ekspresiSqlKotak9, hitungKotak9 } = await import('../lib/scoring')
  const kisi = await kueri<{ y: number; x: number; kotak: number }>(
    `WITH RECURSIVE n(v) AS (SELECT 0 UNION ALL SELECT v + 5 FROM n WHERE v < 100)
     SELECT ny.v AS y, nx.v AS x, ${ekspresiSqlKotak9('ny.v', 'nx.v')} AS kotak
     FROM n ny CROSS JOIN n nx`,
  )

  let bedaKisi = 0
  for (const r of kisi) {
    const dariTs = hitungKotak9(Number(r.y), Number(r.x)).kotak
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
