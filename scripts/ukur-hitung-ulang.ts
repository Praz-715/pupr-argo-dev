/**
 * Ukur jalur TULIS "Hitung Ulang" — bagian terberat di aplikasi.
 *
 * Kueri baca sudah diukur `ukur-kueri.ts` (ambang 150 ms/kueri). Yang belum:
 * satu kali Hitung Ulang menulis satu baris `match_score` + sembilan baris
 * `match_score_detail` **per pegawai**. Di dev itu 40 pegawai; di produksi 1.872
 * (phase.md §3 K-5). Angka itu harus diukur, bukan diasumsikan — dan kalau
 * ternyata terlalu lama, itu argumen untuk job asinkron berprogres (U-10),
 * bukan sesuatu yang ditemukan pengguna sebagai halaman yang menggantung.
 *
 * Jalankan:
 *   npm run ukur:hitung-ulang            (pupr_dev, ~40 pegawai)
 *   npm run ukur:hitung-ulang -- --volume (pupr_dev_volume, ~2.000 pegawai)
 *
 * CATATAN: skrip ini MENULIS ke database yang dituju. Pada `--volume` itu tidak
 * masalah (database sekali pakai, dibangun ulang `npm run db:volume`). Pada
 * pupr_dev, isinya ditulis ulang dengan nilai yang sama seperti yang dihasilkan
 * `lib/skor-massal` — sama dengan menekan tombol Hitung Ulang di UI.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const volume = process.argv.includes('--volume')
if (volume) process.env.DATABASE_NAME = `${process.env.DATABASE_NAME}_volume`

async function main() {
  const { ambilJejakManual, ambilNilaiManual, ambilProfilKandidat, ambilRubrikUntukHitung } =
    await import('../lib/kueri/rubrik')
  const { kueri } = await import('../lib/db')
  const { hitungSkorMassal } = await import('../lib/skor-massal')
  const { tulisHasilSkor } = await import('../lib/skoring-tulis')
  const { ambilPengaturan } = await import('../lib/pengaturan')

  /**
   * `masaBerlakuTahun` WAJIB dibaca dari `pengaturan_sistem`, bukan dibiarkan
   * jatuh ke baku kode.
   *
   * Skrip ini menulis `match_score` lewat `tulisHasilSkor` — jalur tulis yang
   * sama dengan tombol Hitung Ulang. Tombol itu mengirim
   * `pengaturan.masaBerlakuAsesmenTahun`. Kalau skrip ini tidak, keduanya
   * menghasilkan eligibilitas yang berbeda dari data yang sama, dan yang
   * menang hanyalah yang jalan terakhir. Gejalanya menipu: skornya identik
   * sampai dua desimal, hanya kolom eligible yang berbeda, sehingga mudah
   * disalahsangkakan sebagai skor basi. `npm run verifikasi:skoring` membaca
   * pengaturan yang sama dan akan memerahkan selisih ini.
   */
  const pengaturan = await ambilPengaturan()
  const opsiUmum = { masaBerlakuTahun: pengaturan.masaBerlakuAsesmenTahun }
  console.log(`masa berlaku asesmen: ${opsiUmum.masaBerlakuTahun} tahun (pengaturan_sistem)\n`)

  console.log(`Database: ${process.env.DATABASE_NAME}\n`)

  /**
   * `--semua` menghitung SELURUH jabatan target, bukan yang pertama saja.
   *
   * Bukan untuk mengukur Hitung Ulang (tombolnya memang per jabatan target, dan
   * itulah yang diukur mode biasa), tapi untuk membuat `pupr_dev_volume`
   * **representatif** sebelum `ukur:kueri:volume` dijalankan. `seed-volume.ts`
   * menulis `match_score` lewat SQL tapi TIDAK bisa menulis
   * `match_score_detail` — rincian per indikator lahir dari mesin rubrik, bukan
   * dari ekspresi SQL. Akibatnya DB volume hanya punya rincian untuk jabatan
   * target yang pernah dihitung; kalau cuma satu dari tiga, kueri Gap Analysis
   * memindai sepertiga baris yang seharusnya dan hasil ukurnya **melegakan
   * secara keliru**.
   */
  const semua = process.argv.includes('--semua')
  const target = await kueri<{ id: number; nama_target: string }>(
    `SELECT id, nama_target FROM jabatan_target ORDER BY id${semua ? '' : ' LIMIT 1'}`,
  )
  if (target.length === 0) {
    console.error('Tidak ada jabatan target.')
    process.exit(1)
  }

  if (semua) {
    let totalRincian = 0
    for (const t of target) {
      const mulai = Date.now()
      const siapT = await ambilRubrikUntukHitung(t.id)
      if (siapT === null) {
        console.log(`target ${t.id} — rubrik tidak terbaca, dilewati`)
        continue
      }
      /**
       * Target BER-RUBRIK KOSONG dilewati — meniru penolakan `hitungUlangSkor()`.
       *
       * Aksi Hitung Ulang di UI menolak target tanpa komponen dengan alasan yang
       * benar: mesin rubrik sengaja tidak melempar, jadi rubrik kosong
       * menghasilkan **skor 0 untuk setiap pegawai** — dan halaman kandidat lalu
       * memajang "35 dari 36 lolos syarat" di atas kolom skor yang seluruhnya
       * 0,00. Itu bukan "belum dihitung", itu "sudah dihitung dan semuanya nol",
       * dua keadaan yang sangat berbeda artinya bagi yang membacanya.
       *
       * Skrip ini sempat TIDAK menirunya, dan akibatnya terukur: sesudah 25
       * jabatan target DRAFT dibuat dari struktur Excel, satu jalan `--semua`
       * menulis **936 baris skor nol** ke 26 target tanpa rubrik. Dua jalur tulis
       * dengan aturan berbeda untuk hal yang sama — larangan CLAUDE.md #1, dan
       * jalur yang tidak lewat UI-lah yang melanggarnya.
       */
      if (siapT.rubrik.komponen.length === 0) {
        console.log(
          `target ${String(t.id).padStart(3)} — rubrik belum punya komponen, DILEWATI ` +
            `(menghitungnya hanya akan menulis skor 0 untuk semua pegawai)  ${t.nama_target.slice(0, 40)}`,
        )
        continue
      }
      const [profilT, manualT, jejakT] = await Promise.all([
        ambilProfilKandidat(),
        ambilNilaiManual(t.id),
        ambilJejakManual(t.id),
      ])
      const hasilT = hitungSkorMassal(siapT.rubrik, profilT, { ...opsiUmum, nilaiManual: manualT })
      const ringkasT = await tulisHasilSkor(
        t.id,
        hasilT.hasil,
        JSON.stringify(hasilT.snapshotRubrik),
        jejakT,
      )
      totalRincian += ringkasT.jumlahRincian
      console.log(
        `target ${String(t.id).padStart(3)} — ${hasilT.hasil.length} pegawai, ` +
          `${ringkasT.jumlahRincian} baris rincian, ${((Date.now() - mulai) / 1000).toFixed(1)} s  ` +
          `${t.nama_target.slice(0, 50)}`,
      )
    }
    console.log(
      `\n${target.length} jabatan target dihitung · ${totalRincian} baris rincian total.\n` +
        `Sekarang \`ukur:kueri:volume\` mengukur beban Gap Analysis yang sebenarnya.`,
    )
    process.exit(0)
  }

  const idTarget = Number(target[0]!.id)

  const t0 = Date.now()
  const siap = await ambilRubrikUntukHitung(idTarget)
  if (siap === null) {
    console.error('Rubrik tidak terbaca.')
    process.exit(1)
  }
  const msRubrik = Date.now() - t0

  const t1 = Date.now()
  const [profil, nilaiManual, jejakManual] = await Promise.all([
    ambilProfilKandidat(),
    ambilNilaiManual(idTarget),
    ambilJejakManual(idTarget),
  ])
  const msProfil = Date.now() - t1

  const t2 = Date.now()
  const hasil = hitungSkorMassal(siap.rubrik, profil, { ...opsiUmum, nilaiManual })
  const msHitung = Date.now() - t2

  const t3 = Date.now()
  const ringkas = await tulisHasilSkor(
    idTarget,
    hasil.hasil,
    JSON.stringify(hasil.snapshotRubrik),
    jejakManual,
  )
  const msTulis = Date.now() - t3

  const total = Date.now() - t0

  console.log(`jabatan target      : ${idTarget} — ${target[0]?.nama_target}`)
  console.log(`pegawai dinilai     : ${hasil.hasil.length} (${hasil.jumlahEligible} lolos syarat)`)
  console.log(`baris rincian       : ${ringkas.jumlahRincian}`)
  console.log(`anggota pool        : ${ringkas.jumlahAnggotaPool} diperingkat ulang\n`)

  console.log('=== WAKTU ===')
  console.log(`baca rubrik         ${String(msRubrik).padStart(6)} ms`)
  console.log(`baca profil pegawai ${String(msProfil).padStart(6)} ms`)
  console.log(`hitung (murni CPU)  ${String(msHitung).padStart(6)} ms`)
  console.log(`tulis ke database   ${String(msTulis).padStart(6)} ms`)
  console.log(`TOTAL               ${String(total).padStart(6)} ms`)

  const perPegawai = hasil.hasil.length === 0 ? 0 : total / hasil.hasil.length
  console.log(`\nper pegawai         ${perPegawai.toFixed(2)} ms`)
  console.log(
    `proyeksi 1.872 ASN  ${((perPegawai * 1872) / 1000).toFixed(1)} s untuk satu jabatan target`,
  )

  // Ambang pilihan: 30 detik. Di atas itu, satu permintaan HTTP sinkron mulai
  // terasa seperti halaman menggantung dan pantas dijadikan job asinkron (U-10).
  const AMBANG_MS = 30_000
  if (total > AMBANG_MS) {
    console.error(
      `\nLAMBAT: ${(total / 1000).toFixed(1)} s melewati ambang ${AMBANG_MS / 1000} s — ` +
        `perhitungan sinkron sudah tidak layak, pindahkan ke job berprogres (U-10).`,
    )
    process.exit(1)
  }
  console.log(`\nok: di bawah ambang ${AMBANG_MS / 1000} s untuk satu jabatan target.`)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
