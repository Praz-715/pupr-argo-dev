/**
 * Isi `riwayat_jabatan.lama_bulan` dari kolom **MASA KERJA JABATAN PENEMPATAN**
 * berkas Talent Pool.
 *
 *   npm run impor:lama-jabatan             # KERING — melapor, tidak menulis
 *   npm run impor:lama-jabatan -- --tulis  # benar-benar menulis
 *
 * ## Kenapa ada
 *
 * Permintaan pemilik proses 25 Agu 2026: *"pegawai eselon 2 dan 3 lama jabatannya
 * ambil data dari sini soalnya blm masuk ke aplikasi"*. Terukur sebelum skrip ini:
 * 26 pegawai eselon II & III punya **229 riwayat jabatan, nol bertanggal**, sehingga
 * indikator Lama Jabatan jatuh ke `tmt_jabatan` dan ke-26-nya mendapat kategori
 * terendah (skor 60) — bukan karena masa kerjanya pendek, tapi karena datanya tidak
 * pernah masuk.
 *
 * ## Dicocokkan menurut NAMA JABATAN, bukan urutan baris
 *
 * Menyandarkan pada `urutan` akan bekerja hari ini dan patah tanpa suara begitu ada
 * satu baris riwayat yang disunting manual dari UI — dan yang tertulis kemudian
 * adalah durasi milik jabatan **orang yang sama tapi periode lain**, angka yang
 * kelihatan wajar dan tidak bisa ditemukan lagi. Karena itu kuncinya
 * `(pegawai NIP, nama jabatan mentah)` yang dinormalkan spasi & besar-kecilnya.
 *
 * Nama yang muncul **lebih dari sekali** untuk satu pegawai (mis. menjabat posisi
 * yang sama dua periode) tidak bisa diputuskan lewat namanya: sumbernya memberi dua
 * durasi berbeda dan namanya tidak membedakan barisnya. Menebaknya berarti menulis
 * durasi ke periode yang salah.
 *
 * ## Jalan kedua untuk nama ganda: URUTAN yang DIBUKTIKAN dulu, bukan dipercayai
 *
 * Untuk pegawai yang **seluruh urutan nama riwayatnya di DB sama persis dengan
 * urutan di sumbernya** — baris per baris, jumlahnya sama, tidak satu pun beda —
 * baris ke-i memang baris ke-i, termasuk yang namanya kembar. Di situ posisi bukan
 * asumsi lagi melainkan kesimpulan, dan kesimpulan itu **diperiksa per pegawai
 * sesaat sebelum menulis**: satu baris yang disunting manual dari UI membuat
 * urutannya tidak lagi cocok, dan pegawai itu dilewati beserta alasannya.
 *
 * Itu sebabnya penjaganya bukan "urutannya boleh dipercaya" (tidak boleh) melainkan
 * "urutannya bisa dibuktikan untuk pegawai ini". Terukur: menutup **6 baris** milik
 * 3 pegawai yang jalan pertama lewati.
 *
 * ## Yang TIDAK disentuh
 *
 * Baris yang **sudah bertanggal** (berkas Pengawas) dilewati — `nilaiLamaJabatan()`
 * memang mengutamakan tanggal, jadi menulis durasi di sana tidak berpengaruh apa pun
 * sekaligus menambah satu angka yang harus tetap sepakat dengan tanggalnya. Baris yang
 * `lama_bulan`-nya sudah terisi juga dilewati kecuali nilainya berbeda; kalau berbeda
 * ia dilaporkan sebagai selisih, bukan ditimpa diam-diam.
 */

import { config } from 'dotenv'
import { readFileSync } from 'node:fs'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')

/** Berkas hasil ekstraksi. Keduanya dibaca; yang bertanggal dilewati sendiri. */
const BERKAS = ['doc/data/talentpool-es23.json', 'doc/data/talentpool-pengawas.json']

interface BarisRiwayat {
  nama?: string
  masaKerja?: string
}

interface BarisPegawai {
  nip: string
  nama: string
  riwayatJabatan?: BarisRiwayat[]
}

function kunci(nama: string): string {
  return nama.replace(/\s+/g, ' ').trim().toLowerCase()
}

async function main() {
  const { kueri, eksekusi } = await import('../lib/db')
  const { uraiMasaKerjaBulan } = await import('../lib/masa-kerja')

  console.log(`\n=== LAMA JABATAN DARI EXCEL → riwayat_jabatan.lama_bulan ${TULIS ? '(MENULIS)' : '(kering)'} ===\n`)

  // ── Sumber: durasi per (nip, nama jabatan) ──────────────────────────────
  const durasi = new Map<string, number>()
  const ganda = new Set<string>()
  /**
   * Urutan baris sumber per NIP: `[nama dinormalkan, bulan | null]`. Dipakai jalan
   * kedua (nama ganda) — dan disimpan sebagai LARIK, bukan peta, sebab yang perlu
   * dibandingkan justru urutannya.
   */
  const urutSumber = new Map<string, Array<{ nama: string; bulan: number | null }>>()
  let barisSumber = 0
  let takTerbaca = 0

  for (const berkas of BERKAS) {
    let isi: BarisPegawai[]
    try {
      isi = JSON.parse(readFileSync(berkas, 'utf8')) as BarisPegawai[]
    } catch {
      console.log(`  ! ${berkas} tidak bisa dibaca — dilewati`)
      continue
    }
    let n = 0
    for (const p of isi) {
      for (const r of p.riwayatJabatan ?? []) {
        if (!r.nama) continue
        barisSumber++
        n++
        const bulan = uraiMasaKerjaBulan(r.masaKerja)
        /*
          Baris yang durasinya tak terbaca TETAP masuk `urutSumber` (bernilai
          `null`). Kalau ia dibuang, larik sumbernya jadi lebih pendek daripada
          barisnya di DB dan perbandingan urutan gagal untuk pegawai yang datanya
          sebenarnya utuh — lalu jalan kedua menolak pegawai yang justru bisa
          diselesaikan.
        */
        if (!urutSumber.has(p.nip)) urutSumber.set(p.nip, [])
        urutSumber.get(p.nip)!.push({ nama: kunci(r.nama), bulan })
        if (bulan === null) {
          takTerbaca++
          continue
        }
        const k = `${p.nip}|${kunci(r.nama)}`
        if (durasi.has(k) && durasi.get(k) !== bulan) ganda.add(k)
        durasi.set(k, bulan)
      }
    }
    console.log(`  ${berkas}: ${isi.length} pegawai · ${n} baris riwayat`)
  }
  console.log(
    `\n  baris sumber: ${barisSumber} · durasi terbaca: ${durasi.size} · tak terbaca: ${takTerbaca}` +
      (ganda.size > 0 ? ` · nama ganda berdurasi beda: ${ganda.size} (DILEWATI)` : ''),
  )

  // ── Sasaran: riwayat TANPA tanggal ──────────────────────────────────────
  const baris = await kueri<{
    id: number
    nip: string
    nama_pegawai: string
    nama_jabatan: string
    lama_bulan: number | null
    eselon: string | null
  }>(
    `SELECT r.id, p.nip, p.nama_lengkap AS nama_pegawai, r.jabatan_nama_mentah AS nama_jabatan,
            r.lama_bulan, j.eselon
       FROM riwayat_jabatan r
       JOIN pegawai p ON p.id = r.pegawai_id
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
      WHERE r.tanggal_mulai IS NULL
      ORDER BY p.nip, r.urutan`,
  )
  console.log(`  riwayat TANPA tanggal di DB: ${baris.length}`)

  const rencana: Array<{ id: number; bulan: number; label: string }> = []
  const takKetemu: string[] = []
  const selisih: string[] = []
  let sudahSama = 0

  /** NIP yang punya baris bernama ganda — bahan jalan kedua di bawah. */
  const perluUrutan = new Set<string>()

  for (const b of baris) {
    const k = `${b.nip}|${kunci(b.nama_jabatan)}`
    if (ganda.has(k)) {
      perluUrutan.add(b.nip)
      continue
    }
    const bulan = durasi.get(k)
    if (bulan === undefined) {
      takKetemu.push(`${b.nama_pegawai} — "${b.nama_jabatan}"`)
      continue
    }
    if (b.lama_bulan !== null) {
      if (Number(b.lama_bulan) === bulan) sudahSama++
      else selisih.push(`${b.nama_pegawai} — "${b.nama_jabatan}": DB ${b.lama_bulan} vs Excel ${bulan}`)
      continue
    }
    rencana.push({ id: Number(b.id), bulan, label: `${b.nama_pegawai} — ${b.nama_jabatan}` })
  }

  // ── Jalan kedua: nama ganda, diselesaikan lewat URUTAN yang dibuktikan ──
  const urutanCocok: string[] = []
  const urutanTidakCocok: string[] = []
  for (const nip of perluUrutan) {
    const sumber = urutSumber.get(nip) ?? []
    const db = await kueri<{
      id: number
      urutan: number
      nama_jabatan: string
      lama_bulan: number | null
      bertanggal: number
      nama_pegawai: string
    }>(
      `SELECT r.id, r.urutan, r.jabatan_nama_mentah AS nama_jabatan, r.lama_bulan,
              (r.tanggal_mulai IS NOT NULL) AS bertanggal, p.nama_lengkap AS nama_pegawai
         FROM riwayat_jabatan r JOIN pegawai p ON p.id = r.pegawai_id
        WHERE p.nip = ? ORDER BY r.urutan`,
      [nip],
    )
    const nama = db[0]?.nama_pegawai ?? nip

    /*
      Syaratnya SELURUH urutan cocok, bukan hanya baris yang mau diisi: kalau ada
      satu baris yang disunting/ditambah dari UI, posisi baris SESUDAHNYA bergeser
      — dan pergeseran itu tidak terlihat dari baris yang sedang diperiksa.
    */
    const cocok =
      db.length === sumber.length &&
      db.every((d, i) => kunci(d.nama_jabatan) === sumber[i]!.nama)
    if (!cocok) {
      urutanTidakCocok.push(
        `${nama}: urutan riwayat DB (${db.length} baris) tidak cocok dengan sumber (${sumber.length}) — dilewati`,
      )
      continue
    }

    for (const [i, d] of db.entries()) {
      if (d.bertanggal === 1 || d.lama_bulan !== null) continue
      const bulan = sumber[i]!.bulan
      if (bulan === null) continue
      rencana.push({
        id: Number(d.id),
        bulan,
        label: `${nama} — ${d.nama_jabatan} (urutan ${d.urutan}, lewat urutan terbukti)`,
      })
      urutanCocok.push(`${nama} urutan ${d.urutan} → ${bulan} bulan`)
    }
  }

  console.log(`\n  akan DIISI      : ${rencana.length}`)
  if (perluUrutan.size > 0) {
    console.log(
      `  nama ganda      : ${perluUrutan.size} pegawai · ${urutanCocok.length} baris diselesaikan lewat urutan terbukti`,
    )
    for (const u of urutanCocok) console.log(`     · ${u}`)
    for (const u of urutanTidakCocok) console.log(`     ! ${u}`)
  }
  console.log(`  sudah sama      : ${sudahSama}`)
  console.log(`  tidak ketemu    : ${takKetemu.length}`)
  if (selisih.length > 0) {
    console.log(`  SELISIH (tidak ditimpa): ${selisih.length}`)
    for (const s of selisih.slice(0, 5)) console.log(`     · ${s}`)
  }
  if (takKetemu.length > 0) {
    for (const t of takKetemu.slice(0, 5)) console.log(`     · tidak ketemu: ${t}`)
    if (takKetemu.length > 5) console.log(`     … +${takKetemu.length - 5} lagi`)
  }

  // Sebaran durasinya, supaya angka yang akan masuk bisa dinilai kewajarannya
  // SEBELUM ditulis — bukan sesudah skor bergeser.
  if (rencana.length > 0) {
    const tahun = rencana.map((r) => r.bulan / 12)
    const urut = [...tahun].sort((a, b) => a - b)
    const p = (q: number) => urut[Math.floor((urut.length - 1) * q)]!.toFixed(1)
    console.log(
      `\n  sebaran lama jabatan yang akan masuk (tahun): min ${p(0)} · median ${p(0.5)} · maks ${p(1)}`,
    )
    console.log(`  ≥5 tahun: ${tahun.filter((t) => t >= 5).length} · 2–5 tahun: ${tahun.filter((t) => t >= 2 && t < 5).length} · <2 tahun: ${tahun.filter((t) => t < 2).length}`)
  }

  if (!TULIS) {
    console.log('\nKering — tidak ada yang ditulis. Tambahkan `-- --tulis`.\n')
    process.exit(0)
  }
  if (rencana.length === 0) {
    console.log('\nTidak ada yang perlu diisi.\n')
    process.exit(0)
  }

  for (const r of rencana) {
    await eksekusi(`UPDATE riwayat_jabatan SET lama_bulan = ? WHERE id = ?`, [r.bulan, r.id])
  }
  const [sesudah] = await kueri<{ n: number }>(
    'SELECT COUNT(*) AS n FROM riwayat_jabatan WHERE lama_bulan IS NOT NULL',
  )
  console.log(`\n── DITULIS ──`)
  console.log(`  ${rencana.length} baris diisi · total berdurasi sekarang: ${sesudah?.n ?? 0}`)
  console.log(
    '\n  LANGKAH BERIKUTNYA: `npm run hitung:ulang -- --tulis --semua-status`.\n' +
      '  Indikator Lama Jabatan ikut berubah, dan `match_score` kolom TERSIMPAN.\n',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
