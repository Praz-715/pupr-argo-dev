/**
 * Ukur dampak peralihan skoring Tahap 2 (`doc/sql/014`–`015`) **sebelum** isi
 * `match_score` ditimpa.
 *
 * Kenapa berkas ini ada: peralihan ini mengganti sumber dua indikator dari
 * pencocokan teks ke kategori tervalidasi, dan selama antriannya belum dikerjakan
 * keduanya bernilai "tidak diketahui" → mesin rubrik memberi skor 0. Besar
 * dampaknya bisa dihitung, jadi tidak ada alasan menebaknya — dan angka yang
 * diperkirakan salah dua kali dalam satu sesi ini sudah cukup jadi peringatan.
 *
 * Yang dibandingkan: isi `match_score` yang TERSIMPAN (dihitung dengan rumus
 * lama) vs hasil `lib/skor-massal` sekarang (rumus baru). Tidak menulis apa pun.
 *
 *   npx tsx --conditions react-server scripts/ukur-dampak-tahap2.ts [--volume]
 */
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

if (process.argv.includes('--volume')) {
  process.env.DATABASE_NAME = `${process.env.DATABASE_NAME}_volume`
}

async function main() {
  const { kueri } = await import('../lib/db')
  const { ambilJejakManual, ambilNilaiManual, ambilProfilKandidat, ambilRubrikUntukHitung } =
    await import('../lib/kueri/rubrik')
  const { hitungSkorMassal } = await import('../lib/skor-massal')
  const { ambilPengaturan } = await import('../lib/pengaturan')

  console.log(`Database: ${process.env.DATABASE_NAME}\n`)

  /*
    Masa berlaku asesmen dibaca dari `pengaturan_sistem`, TIDAK dibiarkan jatuh ke
    bawaan `lib/scoring`. Ini pelanggaran keempat dari kelas kesalahan yang sama di
    proyek ini (`recompute.ts` & `ukur-hitung-ulang.ts` sudah dibetulkan lebih dulu,
    dan `verifikasi:skoring` juga pernah kena) — dan di sini akibatnya paling
    menipu: SKORNYA identik, yang bergeser hanya kolom KELAYAKAN. Terukur saat
    ditemukan: skrip ini melaporkan "lolos syarat 775 → 625", 150 baris yang
    seluruhnya artefak alat ukurnya sendiri, tepat pada laporan yang dipakai
    memutuskan apakah perubahan data boleh ditulis.
  */
  const pengaturan = await ambilPengaturan()
  console.log(`Masa berlaku asesmen (dari pengaturan_sistem): ${pengaturan.masaBerlakuAsesmenTahun} tahun\n`)

  const target = await kueri<{ id: number; nama_target: string }>(
    'SELECT id, nama_target FROM jabatan_target ORDER BY id',
  )
  const profil = await ambilProfilKandidat()

  const tervalidasi = profil.filter((p) => p.kategoriDiklatTervalidasi.length > 0).length
  const riwayatValid = profil.filter((p) =>
    p.riwayatJabatan.some((r) => r.jenisPenugasan !== null),
  ).length
  console.log(
    `Kesiapan data: ${tervalidasi}/${profil.length} pegawai punya kategori diklat tervalidasi · ` +
      `${riwayatValid}/${profil.length} punya riwayat jabatan tervalidasi\n`,
  )

  let totalBaris = 0
  let totalTurun = 0
  let totalNaik = 0
  let totalSama = 0
  let jumlahSelisih = 0
  let selisihTerbesar = 0
  let eligibleSebelum = 0
  let eligibleSesudah = 0

  for (const t of target) {
    const siap = await ambilRubrikUntukHitung(t.id)
    if (siap === null) {
      console.log(`target ${t.id}: rubrik tidak terbaca, dilewati`)
      continue
    }
    const [nilaiManual, jejakManual] = await Promise.all([
      ambilNilaiManual(t.id),
      ambilJejakManual(t.id),
    ])
    void jejakManual

    const baru = hitungSkorMassal(siap.rubrik, profil, {
      nilaiManual,
      masaBerlakuTahun: pengaturan.masaBerlakuAsesmenTahun,
    })
    const lama = new Map(
      (
        await kueri<{ pegawai_id: number; skor_total: string; eligible: number }>(
          'SELECT pegawai_id, skor_total, eligible FROM match_score WHERE jabatan_target_id = ?',
          [t.id],
        )
      ).map((r) => [Number(r.pegawai_id), { skor: Number(r.skor_total), eligible: Number(r.eligible) }]),
    )

    let turun = 0
    let naik = 0
    let sama = 0
    let jml = 0
    let maks = 0
    let elSebelum = 0
    let elSesudah = 0

    for (const h of baru.hasil) {
      const l = lama.get(h.pegawaiId)
      if (l === undefined) continue
      totalBaris += 1
      const d = Number((h.skorTotal - l.skor).toFixed(2))
      if (d < -0.005) turun += 1
      else if (d > 0.005) naik += 1
      else sama += 1
      jml += Math.abs(d)
      if (Math.abs(d) > Math.abs(maks)) maks = d
      if (l.eligible === 1) elSebelum += 1
      if (h.eligible) elSesudah += 1
    }

    totalTurun += turun
    totalNaik += naik
    totalSama += sama
    jumlahSelisih += jml
    if (Math.abs(maks) > Math.abs(selisihTerbesar)) selisihTerbesar = maks
    eligibleSebelum += elSebelum
    eligibleSesudah += elSesudah

    const syarat = siap.rubrik.syaratKategoriDiklat
    console.log(
      `target ${t.id} — ${t.nama_target.slice(0, 46)}\n` +
        `   syarat diklat : ${syarat.length > 0 ? syarat.join(', ') : '(belum ditetapkan)'}\n` +
        `   skor          : ${turun} turun · ${naik} naik · ${sama} sama · ` +
        `selisih terbesar ${maks > 0 ? '+' : ''}${maks.toFixed(2)}\n` +
        `   lolos syarat  : ${elSebelum} → ${elSesudah}`,
    )
  }

  console.log('\n=== RINGKASAN ===')
  console.log(`baris dibandingkan  : ${totalBaris}`)
  console.log(`turun / naik / sama : ${totalTurun} / ${totalNaik} / ${totalSama}`)
  console.log(
    `selisih rata-rata   : ${totalBaris === 0 ? 0 : (jumlahSelisih / totalBaris).toFixed(2)} poin (absolut)`,
  )
  console.log(`selisih terbesar    : ${selisihTerbesar > 0 ? '+' : ''}${selisihTerbesar.toFixed(2)} poin`)
  console.log(`lolos syarat total  : ${eligibleSebelum} → ${eligibleSesudah}`)
  console.log(
    '\nCatatan: selisih ini akibat indikator yang kini bernilai "tidak diketahui" ' +
      '(perlu_review),\nbukan akibat rumus baru yang menghukum. Ia mengecil sendiri ' +
      'seiring antrian validasi\ndikerjakan — dan hilang begitu seluruh nama diklat & ' +
      'riwayat jabatan diputuskan.',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
