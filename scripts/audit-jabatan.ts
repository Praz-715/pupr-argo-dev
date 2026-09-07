/**
 * Audit redundansi master jabatan — BACA SAJA, tidak pernah menulis.
 *
 *   npx tsx --conditions react-server scripts/audit-jabatan.ts
 *
 * Dijalankan setelah `cari-jabatan-kembar.ts --tulis` melaporkan 0 sisa, atas
 * pertanyaan pemilik proses: *"cek lagi semua master jabatan ada yang redundan lagi
 * gak"*. Satu aturan hanya bisa menjawab satu bentuk redundansi, dan "0 menurut
 * aturan A" bukan berarti "tidak ada yang redundan" — jadi di sini ada TUJUH
 * pemeriksaan yang saling melengkapi.
 *
 * ## Semuanya aturan HIMPUNAN, tidak satu pun ambang persen
 *
 * Ambang kemiripan persen sudah tiga kali menghasilkan daftar yang tidak bisa
 * dipakai di repo ini (`samaUnit()` 85% menempelkan 56 jabatan ke unit yang keliru;
 * pemeriksa nama unit 85% berteriak 108 kali; pemeriksa "jabatan >1 pada eselon
 * sama" berteriak 32 kali). Daftar yang sebagian besarnya normal akan berhenti
 * dibaca, dan temuan sungguhan ikut terabaikan bersamanya.
 *
 * ## Kenapa read-only
 *
 * Tiap temuan di bawah punya obat yang BERBEDA — gabungkan, ganti nama, pindahkan
 * unit, atau biarkan. Skrip yang menebak obatnya akan salah pada bentuk yang tidak
 * ia rancang untuk tangani. Yang ini melaporkan; penindakannya lewat
 * `cari-jabatan-kembar.ts`, `rapikan:jabatan`, atau keputusan pemilik proses.
 */

import { readFileSync } from 'node:fs'

import { config } from 'dotenv'
import mysql from 'mysql2/promise'

config({ path: '.env.local' })
config({ path: '.env' })

interface Baris {
  id: number
  kode_jabatan: string
  nama_jabatan: string
  eselon: string | null
  status_jabatan: string
  unit_id: number
  kode_unit: string
  nama_unit: string
  penghuni: number
  anggota: number
  riwayat: number
}

const rapat = (t: string) => t.replace(/\s+/g, ' ').trim().toLowerCase()

async function main() {
  const { jenisJabatan, kunciJenisJabatan, bakukanNamaJabatan } = await import(
    '../lib/jenis-jabatan'
  )

  const db = await mysql.createConnection({
    host: process.env.DATABASE_HOST ?? '127.0.0.1',
    port: Number(process.env.DATABASE_PORT ?? 3306),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  })

  const [rows] = await db.query<mysql.RowDataPacket[]>(`
    SELECT j.id, j.kode_jabatan, j.nama_jabatan, j.eselon, j.status_jabatan,
           u.id AS unit_id, u.kode_unit, u.nama_unit,
           (SELECT COUNT(*) FROM pegawai p WHERE p.jabatan_id = j.id AND p.status_aktif = 'AKTIF') AS penghuni,
           (SELECT COUNT(*) FROM jabatan_target_anggota a WHERE a.jabatan_id = j.id) AS anggota,
           (SELECT COUNT(*) FROM riwayat_jabatan r WHERE r.jabatan_id = j.id) AS riwayat
      FROM jabatan j
      JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     WHERE j.status_jabatan <> 'DIHAPUS'`)
  const semua = rows as unknown as Baris[]

  const tanda = (r: Baris) =>
    `${r.kode_jabatan} [es ${r.eselon ?? '-'}] peg=${r.penghuni} tgt=${r.anggota} riw=${r.riwayat}`

  console.log(`\ndatabase: ${process.env.DATABASE_NAME} · jabatan aktif: ${semua.length}\n`)
  let totalTemuan = 0
  function lapor(judul: string, temuan: string[][]) {
    totalTemuan += temuan.length
    console.log(`${temuan.length === 0 ? '  OK ' : '  !! '}${judul}: ${temuan.length}`)
    for (const blok of temuan.slice(0, 12)) for (const b of blok) console.log(`        ${b}`)
    if (temuan.length > 12) console.log(`        … dan ${temuan.length - 12} lagi`)
  }

  // ── 1. Nama IDENTIK persis di unit yang sama ───────────────────────────────
  {
    const per = new Map<string, Baris[]>()
    for (const r of semua) {
      const k = `${r.unit_id}|${rapat(r.nama_jabatan)}`
      per.set(k, [...(per.get(k) ?? []), r])
    }
    lapor(
      'nama IDENTIK di unit yang sama',
      [...per.values()]
        .filter((g) => g.length > 1)
        .map((g) => [`${g[0]!.nama_unit} · "${g[0]!.nama_jabatan}"`, ...g.map((r) => `  ${tanda(r)}`)]),
    )
  }

  // ── 2. Jenis sama di unit yang sama (aturan `cari-jabatan-kembar`) ─────────
  {
    const per = new Map<string, Baris[]>()
    for (const r of semua) {
      const k = `${r.unit_id}|${kunciJenisJabatan(r.nama_jabatan)}`
      per.set(k, [...(per.get(k) ?? []), r])
    }
    lapor(
      'JENIS sama di unit yang sama',
      [...per.values()]
        .filter((g) => g.length > 1)
        .map((g) => [
          `${g[0]!.nama_unit} · jenis "${jenisJabatan(g[0]!.nama_jabatan)}"`,
          ...g.map((r) => `  ${tanda(r)} "${r.nama_jabatan}"`),
        ]),
    )
  }

  /*
    ── 3. Nama saling TERKANDUNG di unit yang sama ─────────────────────────────
    Aturan yang menemukan 14 pasangan pada 24 Agu 2026, dan yang menangkap bentuk
    yang lolos dari aturan (2): nama yang satu adalah awalan/sisipan nama yang lain
    TANPA jenisnya sama — mis. "Kepala Subdirektorat Pengadaan" di dalam "Kepala Sub
    Direktorat Sistem Pengadaan Jasa Konstruksi". `jenisJabatan()` tidak melipat
    keduanya (dan memang tidak boleh: itu dua kursi berbeda kalau sumbernya bilang
    begitu), jadi hanya aturan terkandung yang bisa memunculkannya untuk ditinjau.
  */
  {
    const perUnit = new Map<number, Baris[]>()
    for (const r of semua) perUnit.set(r.unit_id, [...(perUnit.get(r.unit_id) ?? []), r])
    const temuan: string[][] = []
    for (const g of perUnit.values()) {
      for (let i = 0; i < g.length; i++)
        for (let k = i + 1; k < g.length; k++) {
          const a = rapat(bakukanNamaJabatan(g[i]!.nama_jabatan))
          const b = rapat(bakukanNamaJabatan(g[k]!.nama_jabatan))
          if (a === b) continue // sudah dilaporkan pemeriksaan 1
          if (a.includes(b) || b.includes(a)) {
            temuan.push([
              `${g[i]!.nama_unit}`,
              `  ${tanda(g[i]!)} "${g[i]!.nama_jabatan}"`,
              `  ${tanda(g[k]!)} "${g[k]!.nama_jabatan}"`,
            ])
          }
        }
    }
    lapor('nama saling TERKANDUNG di unit yang sama', temuan)
  }

  // ── 4. Jenis sama, eselon sama, tapi UNITNYA berbeda-beda ─────────────────
  //
  // Ini NORMAL untuk kursi yang memang ada di tiap balai (63 Kepala Balai), jadi
  // yang dilaporkan hanya yang jumlahnya KECIL (2–3): pola "satu kursi tersebar di
  // beberapa unit" yang kecil biasanya berarti unitnya yang kembar, bukan kursinya.
  {
    const per = new Map<string, Baris[]>()
    for (const r of semua) {
      const k = `${kunciJenisJabatan(r.nama_jabatan)}|${r.eselon ?? '-'}`
      per.set(k, [...(per.get(k) ?? []), r])
    }
    const temuan = [...per.values()]
      .filter((g) => g.length >= 2 && g.length <= 3 && new Set(g.map((r) => r.unit_id)).size === g.length)
      .map((g) => [
        `jenis "${jenisJabatan(g[0]!.nama_jabatan)}" [es ${g[0]!.eselon ?? '-'}] di ${g.length} unit:`,
        ...g.map((r) => `  ${r.kode_unit.padEnd(28)} ${tanda(r)}`),
      ])
    lapor('jenis+eselon sama tersebar di 2–3 unit (periksa apakah unitnya kembar)', temuan)
  }

  /*
    ── 4b. LEBIH DARI SATU KEPALA di satu unit ────────────────────────────────
    Aturan (2) dan (3) sama-sama buta terhadap bentuk ini, dan itu terbukti mahal:
    ketujuh unit BJKW ternyata punya DUA Kepala Balai —

      "Kepala Balai Jasa Konstruksi Wilayah I Aceh"                       (terisi)
      "Kepala Balai Jasa Konstruksi Pelaksana Pemilihan Jasa Konstruksi Jasa Konstruksi"

    Yang kedua nama versi daftar acuan, dan "Jasa Konstruksi" memang tertulis TIGA
    KALI di sumbernya (diverifikasi ke XML mentahnya 24 Agu 2026, bukan salah
    ekstraksi). Tidak ada yang mengandung yang lain, dan `jenisJabatan()` tidak
    melipatnya karena tak ada kata "Wilayah" di yang kedua.

    Aturannya bukan kemiripan nama melainkan INVARIAN ORGANISASI: sebuah unit punya
    tepat satu kepala, dan kepala itu jabatan yang eselonnya = `level_eselon` unitnya.
    Percobaan sebelumnya memakai "tiga kata pertama sama" dan menghasilkan 24 temuan
    yang 17 di antaranya sah (empat Subdirektorat berbeda di satu Direktorat, tiga
    jenjang Ahli di satu Sekretariat) — daftar yang sebagian besarnya normal akan
    berhenti dibaca, dan tujuh temuan sungguhannya ikut terkubur.

    Jabatan FUNGSIONAL tidak pernah masuk sini: ia tidak punya eselon, jadi tidak
    pernah cocok dengan `level_eselon` unit mana pun.
  */
  {
    const ROMAWI: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }
    const [unitRows] = await db.query<mysql.RowDataPacket[]>(
      'SELECT id, level_eselon FROM unit_organisasi',
    )
    const levelUnit = new Map(
      (unitRows as Array<{ id: number; level_eselon: number | null }>).map((u) => [
        u.id,
        u.level_eselon,
      ]),
    )
    const per = new Map<number, Baris[]>()
    for (const r of semua) {
      const es = r.eselon === null ? null : ROMAWI[r.eselon]
      if (es === undefined || es === null) continue
      if (levelUnit.get(r.unit_id) !== es) continue
      per.set(r.unit_id, [...(per.get(r.unit_id) ?? []), r])
    }
    lapor(
      'LEBIH DARI SATU kepala di satu unit (eselon jabatan = eselon unitnya)',
      [...per.values()]
        .filter((g) => g.length > 1)
        .map((g) => [
          `${g[0]!.nama_unit} [unit eselon ${levelUnit.get(g[0]!.unit_id)}]`,
          ...g.map((r) => `  ${tanda(r)} "${r.nama_jabatan}"`),
        ]),
    )
  }

  // ── 5. Jabatan STRUKTURAL yang menempel langsung di unit AKAR ─────────────
  {
    const [akar] = await db.query<mysql.RowDataPacket[]>(
      'SELECT id, nama_unit FROM unit_organisasi WHERE parent_id IS NULL',
    )
    const idAkar = new Set((akar as Array<{ id: number }>).map((a) => a.id))
    // Eselon I DIKECUALIKAN: Direktur Jenderal memang berkantor di unit akar, jadi
    // melaporkannya adalah temuan palsu yang akan menutupi temuan sungguhan.
    // Yang jelas salah hanya jabatan eselon II ke bawah yang menggantung di Ditjen.
    const temuan = semua
      .filter(
        (r) =>
          idAkar.has(r.unit_id) &&
          r.eselon !== null &&
          r.eselon !== 'NON_ESELON' &&
          r.eselon !== 'I',
      )
      .map((r) => [`${r.nama_unit} ← ${tanda(r)} "${r.nama_jabatan}"`])
    lapor('jabatan STRUKTURAL terparkir di unit akar', temuan)
  }

  // ── 6. Jabatan yang tidak dirujuk apa pun DAN tidak ada di daftar acuan ────
  {
    const acuan = JSON.parse(readFileSync('doc/data/jabatan-struktural.json', 'utf8')) as Array<{
      namaJabatan: string
      unitKerja: string
    }>
    const kunciAcuan = new Set(acuan.map((a) => `${rapat(a.namaJabatan)}|${rapat(a.unitKerja)}`))
    const temuan = semua
      .filter(
        (r) =>
          Number(r.penghuni) === 0 &&
          Number(r.anggota) === 0 &&
          Number(r.riwayat) === 0 &&
          !kunciAcuan.has(`${rapat(r.nama_jabatan)}|${rapat(r.nama_unit)}`),
      )
      .map((r) => [`${r.kode_jabatan.padEnd(24)} ${r.nama_unit.slice(0, 40)} · "${r.nama_jabatan}"`])
    lapor('nol pengikat DAN tidak ada di daftar acuan (kandidat arsip)', temuan)
  }

  // ── 7. Kesesuaian daftar acuan, dengan ALIAS unit yang sudah diketahui ────
  //
  // Daftar resmi menulis "…Produktivitas KONSTRUKSI Tenaga Kerja Konstruksi" —
  // "Konstruksi" dua kali, salah ketik di sumbernya. Tanpa alias ini, pemeriksaan
  // melaporkan 6 pasangan "hilang" yang sebenarnya ada, dan angka 117/123 itu
  // terbaca sebagai regresi.
  {
    // `kunciJabatan`/`kunciUnit` dari modul alias bersama — JANGAN menulis
    // normalisasi sendiri di sini; ia sudah punya dua salinan sebelum ini dan
    // "unit mana yang dianggap sama" harus punya satu jawaban.
    const { kunciPasangan } = await import('./rapikan-jabatan-alias')
    const acuan = JSON.parse(readFileSync('doc/data/jabatan-struktural.json', 'utf8')) as Array<{
      namaJabatan: string
      unitKerja: string
    }>
    const master = new Set(semua.map((r) => kunciPasangan(r.nama_jabatan, r.nama_unit)))
    const hilang = acuan.filter((a) => !master.has(kunciPasangan(a.namaJabatan, a.unitKerja)))
    console.log(
      `\n  kesesuaian daftar acuan: ${acuan.length - hilang.length}/${acuan.length}${hilang.length ? ' — HILANG:' : ''}`,
    )
    for (const h of hilang) console.log(`        ${h.namaJabatan} @ ${h.unitKerja}`)
    totalTemuan += hilang.length
  }

  console.log(`\ntotal temuan yang perlu ditinjau: ${totalTemuan}\n`)
  await db.end()
}

void main()
