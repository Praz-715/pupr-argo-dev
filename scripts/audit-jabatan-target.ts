/**
 * Audit KONSISTENSI konfigurasi jabatan target — kering, tidak pernah menulis.
 *
 *   npm run audit:target
 *
 * Lahir dari pertanyaan pemilik proses 2 Sep 2026 sambil menunjuk tiga baris
 * "Kepala Sub Bagian Umum dan Tata Usaha" di tiga balai: *"kok beda-beda"* —
 * 42/32/40 jabatan asal dan 26/15/15 lolos, padahal kursinya sama dan
 * persyaratannya identik.
 *
 * Dua cacat yang ditemukan di situ, dan keduanya diam:
 *
 *   1. **Daftar jabatan asalnya memang tidak seragam.** Jabatan asal menjawab
 *      "dari kursi mana seseorang boleh dinominasikan" — pertanyaan yang tidak
 *      bergantung pada balai mana. Dua target berkursi sama yang daftarnya beda
 *      berarti kandidat yang sama diterima di satu balai dan ditolak di balai
 *      lain, tanpa satu pun galat.
 *   2. **Angka "lolos"-nya BASI.** Menambah/mengurangi jabatan asal mengubah
 *      kelayakan tapi tidak memicu hitung ulang, jadi kolom di halaman daftar
 *      memajang hasil perhitungan SEBELUM daftarnya berubah. Terukur: #442
 *      menampilkan 15 padahal daftarnya sudah setara #440 yang menampilkan 26;
 *      sesudah dihitung ulang, keduanya 26.
 *
 * Cacat kedua sekelas dengan penanda "skor ini dihitung sebelum catatan disiplin
 * terbaru" (25 Agu 2026) — bedanya di sana penandanya sudah ada di UI, di sini
 * belum. Skrip ini yang menutupinya sampai penandanya dipasang.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

interface BarisTarget {
  id: number
  nama_target: string
  status: string
  nama_kursi: string | null
  nama_unit: string | null
}

async function main() {
  const { kueri } = await import('../lib/db')

  const target = await kueri<BarisTarget>(
    `SELECT t.id, t.nama_target, t.status, j.nama_jabatan AS nama_kursi, u.nama_unit
       FROM jabatan_target t
       LEFT JOIN jabatan j ON j.id = t.jabatan_id
       LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
      ORDER BY t.id`,
  )

  const asal = new Map<number, Set<string>>()
  for (const r of await kueri<{ jabatan_target_id: number; nama_jabatan: string }>(
    `SELECT a.jabatan_target_id, j.nama_jabatan
       FROM jabatan_target_anggota a JOIN jabatan j ON j.id = a.jabatan_id`,
  )) {
    const s = asal.get(Number(r.jabatan_target_id)) ?? new Set<string>()
    // Dikunci NAMA jabatan, bukan id: kursi yang sama di balai berbeda punya id
    // berbeda, dan yang dibandingkan di sini "jabatan apa", bukan "kursi mana".
    s.add(String(r.nama_jabatan))
    asal.set(Number(r.jabatan_target_id), s)
  }

  const syarat = new Map<number, string>()
  for (const r of await kueri<{ jabatan_target_id: number; ringkas: string }>(
    `SELECT jabatan_target_id,
            GROUP_CONCAT(CONCAT(jenis_syarat, '=', IFNULL(nilai_minimal, ''))
                         ORDER BY jenis_syarat, nilai_minimal SEPARATOR ' · ') AS ringkas
       FROM jabatan_target_persyaratan GROUP BY jabatan_target_id`,
  )) {
    syarat.set(Number(r.jabatan_target_id), String(r.ringkas))
  }

  const skor = new Map<number, { dinilai: number; lolos: number; dihitung: string | null }>()
  for (const r of await kueri<Record<string, unknown>>(
    `SELECT jabatan_target_id, COUNT(*) AS dinilai, SUM(eligible) AS lolos,
            MIN(computed_at) AS dihitung
       FROM match_score GROUP BY jabatan_target_id`,
  )) {
    skor.set(Number(r.jabatan_target_id), {
      dinilai: Number(r.dinilai),
      lolos: Number(r.lolos ?? 0),
      dihitung: r.dihitung === null ? null : String(r.dihitung),
    })
  }

  /*
    Kapan konfigurasi target terakhir disentuh. `jabatan_target_anggota` &
    `jabatan_target_persyaratan` tidak punya kolom waktu, jadi satu-satunya sumber
    adalah jejak audit — dan `entitas_id` di sana memang berisi id jabatan
    targetnya, bukan id barisnya.
  */
  const disentuh = new Map<number, string>()
  for (const r of await kueri<{ entitas_id: number; terakhir: string }>(
    `SELECT entitas_id, MAX(created_at) AS terakhir
       FROM audit_log
      WHERE entitas IN ('jabatan_target_anggota','jabatan_target_persyaratan','jabatan_target_syarat_diklat')
        AND entitas_id IS NOT NULL
      GROUP BY entitas_id`,
  )) {
    disentuh.set(Number(r.entitas_id), String(r.terakhir))
  }

  // ---------------------------------------------------------------- A. seragam?
  console.log('\n=== A. Jabatan target berkursi SAMA yang konfigurasinya BEDA ===\n')
  const perKursi = new Map<string, BarisTarget[]>()
  for (const t of target) {
    const kunci = (t.nama_kursi ?? t.nama_target).trim().toLowerCase()
    perKursi.set(kunci, [...(perKursi.get(kunci) ?? []), t])
  }

  let jumlahMenyimpang = 0
  for (const [, anggota] of perKursi) {
    if (anggota.length < 2) continue
    const tanda = (t: BarisTarget) =>
      `${[...(asal.get(t.id) ?? [])].sort().join('|')}##${syarat.get(t.id) ?? ''}`
    const unik = new Set(anggota.map(tanda))
    if (unik.size === 1) continue

    jumlahMenyimpang++
    console.log(`  ${anggota[0]?.nama_kursi ?? anggota[0]?.nama_target} — ${anggota.length} jabatan target:`)
    for (const t of anggota) {
      const s = skor.get(t.id)
      console.log(
        `    #${t.id} ${(t.nama_unit ?? '-').slice(0, 48).padEnd(50)} ${String((asal.get(t.id) ?? new Set()).size).padStart(3)} asal · ` +
          `${s ? `${s.lolos}/${s.dinilai} lolos` : 'belum dihitung'} · ${t.status}`,
      )
    }
    // Selisih daftar asalnya, disebut satu per satu — "beda" tanpa menyebut apa
    // yang beda memaksa orang berikutnya mengulang penelusuran yang sama.
    const semuaAsal = new Set<string>()
    for (const t of anggota) for (const n of asal.get(t.id) ?? []) semuaAsal.add(n)
    for (const n of [...semuaAsal].sort()) {
      const punya = anggota.filter((t) => asal.get(t.id)?.has(n))
      if (punya.length === anggota.length) continue
      console.log(
        `      · "${n}" hanya di ${punya.map((t) => `#${t.id}`).join(', ')} ` +
          `(tidak di ${anggota.filter((t) => !asal.get(t.id)?.has(n)).map((t) => `#${t.id}`).join(', ')})`,
      )
    }
    const syaratUnik = new Set(anggota.map((t) => syarat.get(t.id) ?? ''))
    if (syaratUnik.size > 1) {
      console.log('      ⚠ PERSYARATANNYA juga beda:')
      for (const t of anggota) console.log(`        #${t.id}: ${syarat.get(t.id) ?? '(kosong)'}`)
    }
    console.log('')
  }
  if (jumlahMenyimpang === 0) console.log('  (tidak ada — semua kursi yang sama berkonfigurasi sama)\n')

  // ------------------------------------------------------------------ B. basi?
  console.log('=== B. Skor BASI — konfigurasi berubah setelah terakhir dihitung ===\n')
  let jumlahBasi = 0
  for (const t of target) {
    const s = skor.get(t.id)
    const ubah = disentuh.get(t.id)
    if (s === undefined || s.dihitung === null || ubah === undefined) continue
    if (ubah <= s.dihitung) continue
    jumlahBasi++
    console.log(
      `  #${t.id} ${t.nama_target.slice(0, 44).padEnd(46)} ${t.status.padEnd(8)} ` +
        `dihitung ${s.dihitung} · konfigurasi diubah ${ubah} → ${s.lolos}/${s.dinilai} lolos TIDAK bisa dipercaya`,
    )
  }
  if (jumlahBasi === 0) console.log('  (tidak ada — semua skor dihitung setelah perubahan konfigurasi terakhir)')

  console.log(`\n── ringkas ── kursi tak seragam: ${jumlahMenyimpang} · skor basi: ${jumlahBasi}\n`)
  process.exit(0)
}

void main()
