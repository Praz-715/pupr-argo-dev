/**
 * Keluarkan jabatan target DRAFT — supaya pengguna membuat sendiri saat butuh.
 *
 *   npm run keluarkan:draft              # KERING — melapor, tidak menghapus
 *   npm run keluarkan:draft -- --tulis   # benar-benar menghapus
 *
 * ## Permintaan pemilik proses 25 Agu 2026
 *
 * *"jabatan target yang draft2 itu takeout dulu juga dah jadi biar user aja yang
 * buka jabatan target baru kalo dibutuhkan"*. Sesudah delapan jabatan lembar
 * Persyaratan Jabatan diaktifkan, 63 draft sisanya hanya membuat daftar panjang yang
 * tidak dipakai memutuskan apa pun — dan **mereka aktif menyesatkan**: skornya tidak
 * pernah dihitung ulang, jadi angkanya bisa lebih tinggi sekaligus lebih basi
 * daripada target aktif, lalu duduk di puncak panel Kecocokan yang mengurutkan skor
 * menurun.
 *
 * ## Ia SEKALIGUS membereskan kesalahan saya sendiri: 420 kandidat talent pool
 *
 * Saat memperbarui skor 25 Agu 2026 pukul 19.32 saya menjalankan
 * `doc/sql/007_recompute.sql`, dan berkas itu **bukan alat pembaruan skor** — ia
 * generator SEED, dan di dalamnya ada **420 `INSERT INTO talent_pool`** (delapan
 * kandidat teratas per jabatan target). Akibatnya `talent_pool` melonjak **4 → 424**:
 * ratusan orang tampak sudah dimasukkan ke daftar suksesi padahal tidak ada manusia
 * yang memutuskannya. Itu data karangan di tabel yang paling tidak boleh dikarang.
 *
 * Yang benar untuk memperbarui skor adalah `npm run hitung:ulang` (atau tombol
 * Hitung Ulang di UI); `db:recompute` hanya untuk **melahirkan ulang berkas seed**.
 *
 * ## Cara memisahkan yang karangan dari yang sungguhan
 *
 * Bukan menurut waktu (mudah salah kalau skripnya dijalankan lagi nanti), melainkan
 * menurut **jejak audit**: entri pool yang dibuat orang lewat UI selalu punya baris
 * `audit_log` ber-`aksi='BUAT'`, sementara yang disisipkan berkas SQL tidak punya
 * satu pun. Ditambah penjaga kedua: yang punya **nominasi** tidak pernah disentuh,
 * apa pun jejak auditnya — di sana ada keputusan manusia yang tercatat.
 *
 * ## Yang TIDAK dihapus
 *
 *   - jabatan target **AKTIF** (8) dan **NONAKTIF** (4) — yang nonaktif memegang
 *     riwayat nominasi & penetapan;
 *   - draft yang (setelah pembersihan pool di atas) **masih** punya entri pool atau
 *     nominasi — ia dilaporkan dan dilewati, sebab di situ ada jejak keputusan;
 *   - draft yang **dibuat manusia** menurut `audit_log` (IP publik, bukan `::1`).
 *     Dua di antaranya ada — #176 & #199 — dan keduanya sudah pernah salah kuhapus
 *     lalu dipulihkan pada 18 Agu 2026. Penjaganya ada di sini supaya tidak terulang.
 *
 * `match_score` & `match_score_detail` milik draft yang dihapus ikut lewat CASCADE.
 * Keduanya **turunan** — bisa dilahirkan ulang `npm run hitung:ulang` — jadi tidak
 * dicadangkan. Definisi drafnya (baris `jabatan_target`, anggota, persyaratan, syarat
 * diklat) **dicadangkan** ke `doc/sql/cadangan-draft-target-<tanggal>.sql`: kecil,
 * dan tanpa itu penghapusan ini tidak bisa dibatalkan.
 */

import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')
const BERKAS_CADANGAN = `doc/sql/cadangan-draft-target-${new Date().toISOString().slice(0, 10)}.sql`

function kutip(nilai: unknown): string {
  if (nilai === null || nilai === undefined) return 'NULL'
  if (typeof nilai === 'number') return String(nilai)
  if (nilai instanceof Date) return `'${nilai.toISOString().slice(0, 19).replace('T', ' ')}'`
  return `'${String(nilai).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

async function main() {
  const { kueri, eksekusi } = await import('../lib/db')

  console.log(`\n=== KELUARKAN JABATAN TARGET DRAFT ${TULIS ? '(MENULIS)' : '(kering)'} ===\n`)

  // ── 1. Kandidat pool hasil seed (kesalahan 19.32) ───────────────────────
  const poolSeed = await kueri<{ n: number }>(
    `SELECT COUNT(*) AS n FROM talent_pool tp
      WHERE NOT EXISTS (SELECT 1 FROM audit_log a
                         WHERE a.entitas = 'talent_pool' AND a.entitas_id = tp.id AND a.aksi = 'BUAT')
        AND NOT EXISTS (SELECT 1 FROM nominasi n WHERE n.talent_pool_id = tp.id)`,
  )
  const [poolTotal] = await kueri<{ n: number }>('SELECT COUNT(*) AS n FROM talent_pool')
  console.log('TALENT POOL')
  console.log(`  total sekarang                        : ${poolTotal?.n ?? 0}`)
  console.log(`  tanpa jejak audit & tanpa nominasi    : ${poolSeed[0]?.n ?? 0}  ← akan DIHAPUS`)
  console.log(
    `  sisa (dibuat orang / bernominasi)     : ${Number(poolTotal?.n ?? 0) - Number(poolSeed[0]?.n ?? 0)}`,
  )

  // ── 2. Draft yang boleh & tidak boleh dikeluarkan ───────────────────────
  const draft = await kueri<{
    id: number
    kode_target: string
    nama_target: string
    pool: number
    nominasi: number
    skor: number
    dibuat_orang: number
  }>(
    `SELECT t.id, t.kode_target, t.nama_target,
            (SELECT COUNT(*) FROM talent_pool tp WHERE tp.jabatan_target_id = t.id
               AND (EXISTS (SELECT 1 FROM audit_log a WHERE a.entitas='talent_pool'
                             AND a.entitas_id = tp.id AND a.aksi='BUAT')
                    OR EXISTS (SELECT 1 FROM nominasi n WHERE n.talent_pool_id = tp.id))) AS pool,
            (SELECT COUNT(*) FROM nominasi n JOIN talent_pool tp2 ON tp2.id = n.talent_pool_id
              WHERE tp2.jabatan_target_id = t.id)                                          AS nominasi,
            (SELECT COUNT(*) FROM match_score m WHERE m.jabatan_target_id = t.id)          AS skor,
            (SELECT COUNT(*) FROM audit_log a
              WHERE a.entitas = 'jabatan_target' AND a.entitas_id = t.id AND a.aksi = 'BUAT'
                AND a.ip_address NOT IN ('::1', '127.0.0.1'))                              AS dibuat_orang
       FROM jabatan_target t
      WHERE t.status = 'DRAFT'
      ORDER BY t.id`,
  )

  const ditahan = draft.filter(
    (d) => Number(d.pool) > 0 || Number(d.nominasi) > 0 || Number(d.dibuat_orang) > 0,
  )
  const dikeluarkan = draft.filter((d) => !ditahan.includes(d))

  console.log(`\nJABATAN TARGET DRAFT: ${draft.length}`)
  console.log(`  akan DIKELUARKAN : ${dikeluarkan.length}`)
  console.log(`  DITAHAN          : ${ditahan.length}`)
  for (const d of ditahan) {
    const sebab = [
      Number(d.dibuat_orang) > 0 ? 'dibuat manusia (jejak audit IP publik)' : null,
      Number(d.pool) > 0 ? `${d.pool} entri pool sungguhan` : null,
      Number(d.nominasi) > 0 ? `${d.nominasi} nominasi` : null,
    ]
      .filter(Boolean)
      .join(' · ')
    console.log(`     #${d.id} ${d.nama_target} — ${sebab}`)
  }
  const skorIkut = dikeluarkan.reduce((n, d) => n + Number(d.skor), 0)
  console.log(`\n  baris match_score yang ikut terhapus (CASCADE): ${skorIkut}`)

  const lain = await kueri<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM jabatan_target WHERE status <> 'DRAFT' GROUP BY status`,
  )
  console.log(`  tidak disentuh: ${lain.map((l) => `${l.status} ${l.n}`).join(' · ')}`)

  if (!TULIS) {
    console.log('\nKering — tidak ada yang dihapus. Tambahkan `-- --tulis`.\n')
    process.exit(0)
  }
  if (dikeluarkan.length === 0 && Number(poolSeed[0]?.n ?? 0) === 0) {
    console.log('\nTidak ada yang perlu dikeluarkan.\n')
    process.exit(0)
  }

  // ── 3. Cadangkan definisi draft yang akan dihapus ───────────────────────
  const id = dikeluarkan.map((d) => d.id)
  if (id.length > 0) {
    const tanda = id.map(() => '?').join(',')
    const baris = {
      jabatan_target: await kueri<Record<string, unknown>>(
        `SELECT * FROM jabatan_target WHERE id IN (${tanda})`, id),
      jabatan_target_anggota: await kueri<Record<string, unknown>>(
        `SELECT * FROM jabatan_target_anggota WHERE jabatan_target_id IN (${tanda})`, id),
      jabatan_target_persyaratan: await kueri<Record<string, unknown>>(
        `SELECT * FROM jabatan_target_persyaratan WHERE jabatan_target_id IN (${tanda})`, id),
      jabatan_target_syarat_diklat: await kueri<Record<string, unknown>>(
        `SELECT * FROM jabatan_target_syarat_diklat WHERE jabatan_target_id IN (${tanda})`, id),
      rubrik_komponen: await kueri<Record<string, unknown>>(
        `SELECT * FROM rubrik_komponen WHERE jabatan_target_id IN (${tanda})`, id),
    }
    const sql: string[] = [
      `-- Cadangan DEFINISI ${id.length} jabatan target DRAFT sebelum dikeluarkan`,
      `-- Dibuat scripts/keluarkan-draft-target.ts. Rubrik indikator & kategori TIDAK`,
      `-- ikut: keduanya bergantung pada id komponen yang berubah saat dipulihkan.`,
      `-- match_score & match_score_detail juga tidak — keduanya turunan, lahirkan`,
      `-- ulang dengan \`npm run hitung:ulang\`.`,
      'SET FOREIGN_KEY_CHECKS = 0;',
    ]
    for (const [tabel, isi] of Object.entries(baris)) {
      sql.push(`-- ${tabel}: ${isi.length} baris`)
      for (const r of isi) {
        const kolom = Object.keys(r)
        sql.push(
          `INSERT INTO \`${tabel}\` (${kolom.map((k) => `\`${k}\``).join(', ')}) VALUES (${kolom
            .map((k) => kutip(r[k]))
            .join(', ')});`,
        )
      }
    }
    sql.push('SET FOREIGN_KEY_CHECKS = 1;')
    writeFileSync(BERKAS_CADANGAN, sql.join('\n') + '\n', 'utf8')
    console.log(`\n  cadangan definisi ditulis: ${BERKAS_CADANGAN} (${sql.length} baris)`)
  }

  // ── 4. Hapus kandidat pool hasil seed ───────────────────────────────────
  const hapusPool = await eksekusi(
    `DELETE FROM talent_pool
      WHERE NOT EXISTS (SELECT 1 FROM audit_log a
                         WHERE a.entitas = 'talent_pool' AND a.entitas_id = talent_pool.id
                           AND a.aksi = 'BUAT')
        AND NOT EXISTS (SELECT 1 FROM nominasi n WHERE n.talent_pool_id = talent_pool.id)`,
  )
  console.log(`\n── MENGHAPUS ──`)
  console.log(`  ${hapusPool.affectedRows} entri talent pool hasil seed dihapus`)

  // ── 5. Hapus draftnya ───────────────────────────────────────────────────
  if (id.length > 0) {
    const hapus = await eksekusi(
      `DELETE FROM jabatan_target WHERE id IN (${id.map(() => '?').join(',')})`,
      id,
    )
    console.log(`  ${hapus.affectedRows} jabatan target DRAFT dihapus (beserta skornya lewat cascade)`)
  }

  // ── 6. Verifikasi ───────────────────────────────────────────────────────
  const [sesudahTarget] = await kueri<{ n: number }>('SELECT COUNT(*) AS n FROM jabatan_target')
  const perStatus = await kueri<{ status: string; n: number }>(
    'SELECT status, COUNT(*) AS n FROM jabatan_target GROUP BY status',
  )
  const [sesudahPool] = await kueri<{ n: number }>('SELECT COUNT(*) AS n FROM talent_pool')
  const [sesudahSkor] = await kueri<{ n: number }>('SELECT COUNT(*) AS n FROM match_score')
  const [yatimPool] = await kueri<{ n: number }>(
    `SELECT COUNT(*) AS n FROM talent_pool tp
      WHERE NOT EXISTS (SELECT 1 FROM jabatan_target t WHERE t.id = tp.jabatan_target_id)`,
  )
  const [nominasiUtuh] = await kueri<{ n: number }>('SELECT COUNT(*) AS n FROM nominasi')

  console.log('\n── SESUDAH ──')
  console.log(`  jabatan_target : ${sesudahTarget?.n} (${perStatus.map((p) => `${p.status} ${p.n}`).join(' · ')})`)
  console.log(`  talent_pool    : ${sesudahPool?.n}`)
  console.log(`  match_score    : ${sesudahSkor?.n}`)
  console.log(`  nominasi       : ${nominasiUtuh?.n} (harus tetap utuh)`)
  console.log(`  pool menggantung tanpa target: ${yatimPool?.n} (harus 0)`)
  console.log(
    `\n  Memulihkan draftnya: \`npm run db:sql ${BERKAS_CADANGAN}\` lalu \`npm run hitung:ulang -- --tulis\`.\n`,
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
