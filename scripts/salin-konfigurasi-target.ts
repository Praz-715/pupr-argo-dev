/**
 * Salin SELURUH konfigurasi satu jabatan target ke target lain — kering secara bawaan.
 *
 *   npm run salin:target -- --dari 439 --ke 443,444,445
 *   npm run salin:target -- --dari 439 --ke 443,444,445 --tulis
 *
 * Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 2): jabatan
 * target untuk Kepala BP2JK Sumatera Barat / Jawa Barat / Kaltara dan Kasubag Umum
 * & TU Kepulauan Riau / NTT **harus ada dan diaktifkan**. Kelimanya sudah dibuat
 * lewat UI tapi lahir kosong — nol rubrik, nol persyaratan — sehingga aktivasinya
 * ditahan pemeriksa: target tanpa rubrik memberi skor 0 untuk SEMUA orang, dan
 * mengaktifkannya berarti memajang peringkat nol tanpa satu pun tanda.
 *
 * ## "Konfigurasi" itu EMPAT hal, dan tiga di antaranya pernah terlewat
 *
 * Pada 24 Agu 2026 penyalinan rubrik dilakukan tiga kali berturut-turut dan tiga
 * kali kurang: pertama pohon rubriknya saja (kesesuaian bidang ilmu jadi seragam),
 * lalu ditambah kata kunci & syarat diklat (kelayakan tetap meloloskan semua orang),
 * dan yang benar-benar kurang ternyata `jabatan_target_persyaratan`. Yang menemukan-
 * nya bukan tebakan melainkan **enumerasi FK ke `jabatan_target` di
 * `information_schema` lalu membandingkan jumlah baris** antara cetakan dan salinan.
 *
 * Skrip ini menyalin keempatnya sekaligus DAN memakai teknik pemeriksaan yang sama
 * sebagai penjaga akhir — jadi kalau nanti ada tabel kelima, ia akan menyatakannya
 * sendiri alih-alih diam.
 *
 * Pohon rubriknya lewat `salinPohonRubrik()` (`lib/rubrik-salin.ts`), modul yang
 * sama dengan tombol Duplikasi Rubrik di UI. Menyalin logikanya ke sini berarti dua
 * penulis pohon rubrik, dan pohon itu ditulis BERLAPIS (induk dulu supaya anaknya
 * punya `parent_indikator_id`) — urutan yang berbeda menghasilkan bentuk berbeda
 * tanpa satu pun galat.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')
const arg = (nama: string): string | null => {
  const i = process.argv.indexOf(nama)
  return i === -1 ? null : (process.argv[i + 1] ?? null)
}

/** Tabel anak yang ikut disalin. `match_score` & `talent_pool` TIDAK — keduanya hasil, bukan konfigurasi. */
const TABEL_KONFIG = ['jabatan_target_persyaratan', 'jabatan_target_syarat_diklat'] as const

async function main() {
  const { kueri, kueriSatu, eksekusi } = await import('../lib/db')
  const { salinPohonRubrik } = await import('../lib/rubrik-salin')

  const dari = Number(arg('--dari'))
  const ke = (arg('--ke') ?? '').split(',').map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0)
  if (!Number.isInteger(dari) || dari <= 0 || ke.length === 0) {
    console.error('pakai: --dari <id> --ke <id,id,...> [--tulis]')
    process.exit(1)
  }

  const sumber = await kueriSatu<{ id: number; nama_target: string; kata_kunci_relevansi: unknown }>(
    'SELECT id, nama_target, kata_kunci_relevansi FROM jabatan_target WHERE id = ?',
    [dari],
  )
  if (sumber === null) {
    console.error(`jabatan target #${dari} tidak ada`)
    process.exit(1)
  }

  /** Hitungan per tabel anak — dipakai sebelum & sesudah, itu yang membuktikan setara. */
  async function bentuk(id: number) {
    const n: Record<string, number> = {}
    for (const t of TABEL_KONFIG) {
      const r = await kueriSatu<{ n: number }>(
        `SELECT COUNT(*) AS n FROM \`${t}\` WHERE jabatan_target_id = ?`, [id],
      )
      n[t] = Number(r?.n ?? 0)
    }
    const k = await kueriSatu<{ n: number }>(
      'SELECT COUNT(*) AS n FROM rubrik_komponen WHERE jabatan_target_id = ?', [id],
    )
    const i = await kueriSatu<{ n: number }>(
      `SELECT COUNT(*) AS n FROM rubrik_indikator i
         JOIN rubrik_komponen p ON p.id = i.rubrik_komponen_id
        WHERE p.jabatan_target_id = ?`, [id],
    )
    n['rubrik_komponen'] = Number(k?.n ?? 0)
    n['rubrik_indikator'] = Number(i?.n ?? 0)
    return n
  }

  const bentukSumber = await bentuk(dari)
  console.log(`\nmode   : ${TULIS ? 'TULIS' : 'kering'}`)
  console.log(`sumber : #${dari} ${sumber.nama_target}`)
  console.log(`         ${Object.entries(bentukSumber).map(([k, v]) => `${k}=${v}`).join(' · ')}`)
  console.log(`         kata_kunci_relevansi = ${JSON.stringify(sumber.kata_kunci_relevansi)}\n`)

  const tujuan = await kueri<{ id: number; nama_target: string; status: string }>(
    'SELECT id, nama_target, status FROM jabatan_target WHERE id IN (?) ORDER BY id', [ke],
  )
  for (const t of tujuan) {
    const b = await bentuk(t.id)
    const kosong = Object.values(b).every((v) => v === 0)
    console.log(
      `  #${t.id} ${t.nama_target.slice(0, 46).padEnd(48)} ${t.status.padEnd(8)} ${
        kosong ? 'kosong → akan disalin' : `SUDAH BERISI (${Object.entries(b).filter(([, v]) => v > 0).map(([k, v]) => `${k}=${v}`).join(' ')}) → DILEWATI`
      }`,
    )
  }

  if (!TULIS) {
    console.log('\nKering — tidak ada yang ditulis. Tambahkan `--tulis`.\n')
    process.exit(0)
  }

  let disalin = 0
  for (const t of tujuan) {
    const b = await bentuk(t.id)
    // Menimpa konfigurasi yang sudah ada berarti membuang bobot yang mungkin sudah
    // disetel manusia, tanpa jejak. Yang berisi dilewati, bukan ditimpa.
    if (!Object.values(b).every((v) => v === 0)) continue

    // Disalin DI DALAM SQL, tidak lewat bolak-balik JS: `kata_kunci_relevansi`
    // kolom JSON, dan driver mengembalikannya sudah terurai jadi array. Dikirim
    // balik lewat `?`, mysql2 merangkai array jadi daftar berkoma — `'semua'` —
    // yang bukan teks JSON yang sah, dan MySQL menolaknya.
    await eksekusi(
      `UPDATE jabatan_target t JOIN jabatan_target s ON s.id = ?
          SET t.kata_kunci_relevansi = s.kata_kunci_relevansi
        WHERE t.id = ?`,
      [dari, t.id],
    )
    for (const tabel of TABEL_KONFIG) {
      const kolom = await kueri<{ COLUMN_NAME: string }>(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS
          WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME NOT IN ('id')`,
        [tabel],
      )
      const nama = kolom.map((k) => k.COLUMN_NAME)
      const pilih = nama.map((k) => (k === 'jabatan_target_id' ? '?' : `\`${k}\``)).join(', ')
      await eksekusi(
        `INSERT INTO \`${tabel}\` (${nama.map((k) => `\`${k}\``).join(', ')})
         SELECT ${pilih} FROM \`${tabel}\` WHERE jabatan_target_id = ?`,
        [t.id, dari],
      )
    }
    const h = await salinPohonRubrik(t.id, dari)
    disalin++
    console.log(`  #${t.id} disalin · rubrik ${h.jumlahIndikator} indikator · ${h.jumlahKategori} kategori`)
  }

  console.log(`\n── DITULIS ── ${disalin} target\n`)
  console.log('penjaga akhir — bentuk tujuan harus SETARA sumbernya:')
  let menyimpang = 0
  for (const t of tujuan) {
    const b = await bentuk(t.id)
    const sama = Object.keys(bentukSumber).every((k) => b[k] === bentukSumber[k])
    if (!sama) menyimpang++
    console.log(
      `  #${t.id} ${sama ? 'SETARA' : 'MENYIMPANG'} · ${Object.entries(b).map(([k, v]) => `${k}=${v}`).join(' · ')}`,
    )
  }
  console.log(`\n  menyimpang: ${menyimpang}`)
  process.exit(menyimpang === 0 ? 0 : 1)
}

void main()
