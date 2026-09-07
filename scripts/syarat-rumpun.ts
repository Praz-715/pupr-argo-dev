/**
 * Pasang syarat RUMPUN JABATAN ASAL pada jabatan target yang SUDAH ADA — kering
 * secara bawaan.
 *
 *   npm run syarat:rumpun
 *   npm run syarat:rumpun -- --tulis
 *
 * `buatTargetDariJabatan()` sudah memasangnya untuk target BARU. Ke-13 target yang
 * lahir sebelum 1 Sep 2026 tidak punya barisnya, jadi tanpa skrip ini fiturnya
 * tidak menyaring apa pun pada data yang benar-benar dipakai.
 *
 * ## Ia MENGUKUR dulu, dan itu wajib
 *
 * Syarat ini MENGGUGURKAN (pilihan pemilik proses), jadi memasangnya mengubah siapa
 * yang boleh dinominasikan. CLAUDE.md menuntut dampaknya diukur sebelum ditulis —
 * dan di sini pengukurannya bisa dilakukan tepat, bukan ditaksir: menambah satu
 * syarat hanya bisa MENGURANGI yang lolos, jadi proyeksinya = berapa dari yang
 * lolos sekarang jabatannya masuk rumpun yang disyaratkan.
 *
 * ## Yang TIDAK disentuh
 *
 * Target yang sudah punya baris `RUMPUN_JABATAN` dilewati — menimpanya berarti
 * membuang daftar yang mungkin sudah disetel manusia, tanpa jejak. Target yang
 * jabatan anggotanya tidak punya tingkat di bawahnya (fungsional / eselon tak
 * dikenali) juga dilewati: syarat berisi kosong membuat SEMUA kandidat
 * PERLU_VERIFIKASI_MANUAL, jauh lebih buruk daripada tidak ada syaratnya.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')
const SEMUA_STATUS = process.argv.includes('--semua-status')

async function main() {
  const { kueri, eksekusi } = await import('../lib/db')
  const { rumpunSatuTingkatDiBawah } = await import('../lib/kueri/rumpun')
  const { kunciRumpunJabatan } = await import('../lib/jenis-jabatan')

  const target = await kueri<{ id: number; nama_target: string; status: string }>(
    `SELECT id, nama_target, status FROM jabatan_target
      WHERE ${SEMUA_STATUS ? '1 = 1' : "status = 'AKTIF'"} ORDER BY id`,
  )

  console.log(`\nmode: ${TULIS ? 'TULIS' : 'kering'} · ${target.length} jabatan target\n`)
  let dipasang = 0
  let dilewati = 0

  for (const t of target) {
    const sudah = await kueri<{ n: number }>(
      `SELECT COUNT(*) AS n FROM jabatan_target_persyaratan
        WHERE jabatan_target_id = ? AND jenis_syarat = 'RUMPUN_JABATAN'`,
      [t.id],
    )
    const label = `  #${t.id} ${t.nama_target.slice(0, 40).padEnd(42)}`
    if (Number(sudah[0]!.n) > 0) {
      dilewati++
      console.log(`${label} sudah punya syarat rumpun → dilewati`)
      continue
    }

    // Eselon anggotanya. Target beranggota banyak eselon dilewati: "satu tingkat
    // di bawah" tidak punya jawaban tunggal di sana, dan memilih salah satunya
    // berarti menggugurkan kandidat sah dari arm yang lain.
    const eselon = await kueri<{ eselon: string | null }>(
      `SELECT DISTINCT j.eselon FROM jabatan_target_anggota a
         JOIN jabatan j ON j.id = a.jabatan_id
        WHERE a.jabatan_target_id = ?`,
      [t.id],
    )
    if (eselon.length !== 1) {
      dilewati++
      console.log(`${label} ${eselon.length} eselon berbeda di anggotanya → dilewati`)
      continue
    }

    const pengumpan = await rumpunSatuTingkatDiBawah(eselon[0]!.eselon)
    if (pengumpan.length === 0) {
      dilewati++
      console.log(`${label} eselon ${eselon[0]!.eselon ?? '-'} tidak punya tingkat di bawahnya → dilewati`)
      continue
    }

    // Proyeksi: berapa dari yang LOLOS SEKARANG akan tetap lolos. Menambah syarat
    // hanya bisa mengurangi, jadi ini angka pasti, bukan taksiran.
    const kandidat = await kueri<{ nama_jabatan: string | null }>(
      `SELECT j.nama_jabatan FROM match_score m
         JOIN pegawai p ON p.id = m.pegawai_id
         LEFT JOIN jabatan j ON j.id = p.jabatan_id
        WHERE m.jabatan_target_id = ? AND m.eligible = 1`,
      [t.id],
    )
    const kunci = new Set(pengumpan.map(kunciRumpunJabatan))
    const tetap = kandidat.filter(
      (k) => k.nama_jabatan !== null && kunci.has(kunciRumpunJabatan(k.nama_jabatan)),
    ).length
    const tanpaJabatan = kandidat.filter((k) => k.nama_jabatan === null).length

    console.log(
      `${label} eselon ${(eselon[0]!.eselon ?? '-').padEnd(3)} → ${pengumpan.join(', ')}`,
    )
    console.log(
      `${' '.repeat(48)}lolos ${kandidat.length} → ${tetap}` +
        (tanpaJabatan > 0 ? ` (+${tanpaJabatan} tanpa jabatan → perlu verifikasi manual)` : ''),
    )

    if (TULIS) {
      await eksekusi(
        `INSERT INTO jabatan_target_persyaratan (jabatan_target_id, jenis_syarat, deskripsi, nilai_minimal)
         VALUES (?, 'RUMPUN_JABATAN', ?, ?)`,
        [
          t.id,
          `Kandidat sedang menjabat pada rumpun satu tingkat di bawah eselon ${eselon[0]!.eselon ?? '-'}. Ubah kalau jalur pengisiannya berbeda; isi "semua" untuk tidak menyaring.`,
          pengumpan.join(', '),
        ],
      )
      dipasang++
    }
  }

  console.log(`\n  ${TULIS ? 'dipasang' : 'akan dipasang'}: ${TULIS ? dipasang : target.length - dilewati} · dilewati: ${dilewati}`)
  if (!TULIS) console.log('\nKering — tidak ada yang ditulis. Tambahkan `--tulis`.\n')
  else console.log('\nSkor & kelayakan BELUM bergerak — jalankan `npm run hitung:ulang -- --tulis`.\n')
  process.exit(0)
}

void main()
