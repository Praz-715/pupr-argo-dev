/**
 * Ukur waktu setiap kueri halaman. Ambang: <150 ms per kueri (phase.md §7 DoD Fase 1).
 *
 * Mencakup seluruh halaman Fase 1–9 — halaman baru wajib ikut diukur, bukan
 * diasumsikan cepat karena kelihatannya sederhana. Dua kueri yang paling perlu
 * diawasi karena biayanya TIDAK tumbuh mengikuti jumlah pegawai saja:
 * `gapIndikator` (pegawai × indikator rubrik) dan `aktivitasApi`/`auditLog`
 * (tabel yang hanya bertambah dan tidak pernah dipangkas).
 *
 *   npm run ukur:kueri          -> terhadap pupr_dev (40 pegawai)
 *   npm run ukur:kueri:volume   -> terhadap pupr_dev_volume (~2.000 pegawai)
 *
 * Flag `--volume` dipakai alih-alih variabel lingkungan karena npm script di
 * Windows tidak mendukung sintaks `VAR=nilai perintah`.
 */
import { config } from 'dotenv'
config({ path: '.env.local' })
config({ path: '.env' })

const MODE_VOLUME = process.argv.includes('--volume')
if (MODE_VOLUME) {
  // Harus diset SEBELUM lib/db diimpor — pool dibuat saat modul dimuat.
  process.env.DATABASE_NAME = 'pupr_dev_volume'
}

/**
 * Ambang bawaan: 150 ms, dari DoD Fase 1 (phase.md §7).
 *
 * Angka itu lahir untuk **widget dashboard** — kueri di jalur first paint, yang
 * penundaannya langsung terasa sebagai halaman lambat.
 */
const AMBANG_MS = 150

/**
 * Ambang untuk **agregat laporan**: 500 ms.
 *
 * Bukan pelonggaran supaya jadi hijau — kelasnya memang berbeda, dan
 * memberlakukan ambang widget dashboard di sini adalah salah kelas:
 *
 * 1. Setiap panel laporan dirender **di dalam `<Suspense>` dengan skeleton**, jadi
 *    ia tidak menahan first paint. Halamannya tampil, penyaringnya bisa dipakai,
 *    dan panelnya menyusul.
 * 2. Ia dibuka **sengaja, sesekali** oleh Admin Talenta/Pimpinan yang memang
 *    sedang menganalisis — bukan tiap kali seseorang membuka aplikasi.
 * 3. Biayanya **linear terhadap jumlah baris rincian** (52.920 baris pada 2.000
 *    pegawai × 3 jabatan target, terukur 241–275 ms). Yang perlu diawasi bukan
 *    angka absolutnya, tapi kalau ia berhenti linear.
 *
 * 500 ms adalah titik di mana skeleton mulai terasa seperti macet, bukan seperti
 * memuat. Kalau tembus, yang dilakukan **bukan** menaikkan angkanya lagi: pilihan
 * yang tersisa adalah menyaring ke satu jabatan target sebagai bawaan halaman,
 * atau tabel agregat terpelihara.
 */
const AMBANG_LAPORAN_MS = 500

const waktu: Array<{ nama: string; ms: number; ambang: number }> = []

async function ukur<T>(nama: string, fn: () => Promise<T>, ambang = AMBANG_MS): Promise<T> {
  const mulai = performance.now()
  const hasil = await fn()
  waktu.push({ nama, ms: Math.round(performance.now() - mulai), ambang })
  return hasil
}

/** Agregat laporan — ambangnya sendiri, alasannya di atas. */
const ukurLaporan = <T>(nama: string, fn: () => Promise<T>) =>
  ukur(nama, fn, AMBANG_LAPORAN_MS)

async function main() {
const m = await import('../lib/kueri/dashboard')

const kartu = await ukur('kartuRingkas', m.ambilKartuRingkas)
const sebaran = await ukur('sebaranKotak9', m.ambilSebaranKotak9)
const titik = await ukur('titikTalenta', m.ambilTitikTalenta)
const sehat = await ukur('kesehatanData', m.ambilKesehatanData)
const kosong = await ukur('jabatanKosong', () => m.ambilJabatanKosong())
const antrian = await ukur('antrianNominasi', () => m.ambilAntrianNominasi())
const tren = await ukur('trenKinerja', m.ambilTrenKinerja)
const aktivitas = await ukur('aktivitasTerakhir', () => m.ambilAktivitasTerakhir())
const anggota = await ukur('anggotaKotak(9)', () => m.ambilAnggotaKotak(9))

console.log(`=== ISI DATA (${process.env.DATABASE_NAME}) ===`)
console.log('kartu ringkas       :', JSON.stringify(kartu))
console.log(
  'sebaran Kotak 9     :',
  [...sebaran.perKotak.entries()].sort((a, b) => b[0] - a[0]).map(([k, v]) => `K${k}=${v}`).join(' '),
  `| dinilai ${sebaran.totalDinilai} | tanpa asesmen ${sebaran.tanpaAsesmen} | kedaluwarsa ${sebaran.asesmenKedaluwarsa} | tahun ${sebaran.tahunTerlama}-${sebaran.tahunTerbaru}`,
)
console.log('titik bubble        :', `${titik.titik.length} titik untuk ${titik.totalPegawai} pegawai`)
console.log('kesehatan data      :', `rerata ${sehat.rerata}%`)
for (const b of sehat.baris) {
  console.log(`   ${String(b.persen).padStart(5)}%  ${b.item} (${b.terpenuhi}/${b.total})`)
}
console.log('jabatan kosong      :', `${kosong.total} strategis kosong, ${kosong.tanpaTarget} belum punya jabatan target`)
console.log('antrian nominasi    :', [...antrian.perStatus.entries()].map(([k, v]) => `${k}=${v}`).join(' '))
console.log('tren kinerja        :', `${tren.tahun}: ` + tren.titik.map((t) => `${t.periode}=${t.rerataKinerja}`).join(' '), `| cakupan ${tren.cakupanPegawai}/${tren.totalPegawai}`)
console.log('aktivitas terakhir  :', `${aktivitas.length} baris, terbaru "${aktivitas[0]?.judul ?? '-'}"`)
console.log('anggota kotak 9     :', `${anggota.total} pegawai, ${anggota.daftar.length} ditampilkan`)

// ---- Fase 2: direktori & profil ----
const p = await import('../lib/kueri/pegawai')
const direktori = await ukur('direktori(hal 1)', () => p.ambilDirektori({}))
await ukur('direktori(urut skor)', () => p.ambilDirektori({ urut: 'potkom' }))
await ukur('opsiFilter', p.ambilOpsiFilter)
const nipContoh = direktori.baris[0]?.nip
if (nipContoh) {
  const profil = await ukur('profil(1 pegawai)', () => p.ambilProfil(nipContoh))
  if (profil) {
    await ukur('matchScore(1 pegawai)', () => p.ambilMatchScore(profil.pegawaiId))
  }
}

// ---- Fase 3: peta talenta & perbandingan ----
const pt = await import('../lib/kueri/peta-talenta')
const petaSebaran = await ukur('petaSebaran(tanpa filter)', () => pt.ambilPetaSebaran({}))
await ukur('petaSebaran(berfilter)', () => pt.ambilPetaSebaran({ eselon: 'III' }))
const petaTitik = await ukur('petaTitik', () => pt.ambilTitikPeta({}))
const sel = await ukur('anggotaSel(9)', () => pt.ambilAnggotaSel(9, {}))
await ukur('opsiPeta', pt.ambilOpsiPeta)

const pb = await import('../lib/kueri/perbandingan')
const nip4 = direktori.baris.slice(0, 4).map((b) => b.nip)
const kandidat = await ukur('kandidat(4 orang)', () => pb.ambilKandidat(nip4))
const idKandidat = kandidat.map((k) => k.pegawaiId)
const targetBanding = await ukur('targetBanding', () => pb.ambilTargetBanding(idKandidat))
if (targetBanding[0]) {
  await ukur('skorBanding(4 orang)', () =>
    pb.ambilSkorBanding(idKandidat, targetBanding[0]!.jabatanTargetId),
  )
}
await ukur('cariKandidat', () => pb.cariKandidat('bu'))

// -- Fase 5: Rule Engine ---------------------------------------------------
const rb = await import('../lib/kueri/rubrik')
const daftarTarget = await ukur('daftarJabatanTarget', rb.ambilDaftarJabatanTarget)
const idTarget = daftarTarget[0]?.id ?? 1
await ukur('jabatanTarget(1)', () => rb.ambilJabatanTarget(idTarget))
const pohon = await ukur('pohonRubrik', () => rb.ambilPohonRubrik(idTarget))
await ukur('persyaratan', () => rb.ambilPersyaratan(idTarget))
await ukur('anggotaJabatan', () => rb.ambilAnggotaJabatan(idTarget))
await ukur('cariJabatanTarget', () => rb.cariJabatanUntukTarget(idTarget, 'kepala'))
const kandidatTarget = await ukur('kandidat(hal 1)', () => rb.ambilKandidat(idTarget, {}))
await ukur('kandidat(eligible)', () => rb.ambilKandidat(idTarget, { hanyaEligible: true }))
await ukur('skorTersimpan', () => rb.ambilSkorTersimpan(idTarget))
await ukur('nilaiManual', () => rb.ambilNilaiManual(idTarget))
if (kandidatTarget.baris[0]) {
  await ukur('rincianSkor(1 pegawai)', () =>
    rb.ambilRincianSkor(idTarget, kandidatTarget.baris[0]!.pegawaiId),
  )
}

// -- Fase 6: Talent Pool & Workflow Nominasi -------------------------------
const sk = await import('../lib/kueri/suksesi')
const opsiPool = await ukur('opsiTargetPool', sk.ambilOpsiTargetPool)
const pool = await ukur('talentPool(1 target)', () =>
  sk.ambilTalentPool({ jabatanTargetId: idTarget }),
)
await ukur('ringkasPool', () => sk.ambilRingkasPool(idTarget))
await ukur('kandidatLuarPool', () => sk.ambilKandidatLuarPool(idTarget))
const nominasi = await ukur('daftarNominasi', () => sk.ambilDaftarNominasi())
if (nominasi[0]) {
  await ukur('riwayatApproval(1)', () => sk.ambilRiwayatApproval(nominasi[0]!.id))
}
await ukur('rencanaPengembangan', () => sk.ambilRencanaPengembangan())
await ukur('suksesorDitetapkan', sk.ambilSuksesorDitetapkan)
await ukur('notifikasi(1 user)', () => sk.ambilNotifikasi(2))
await ukur('tugas(Admin Talenta)', () => sk.ambilTugas('Admin Talenta', null))

// -- Fase 7: Auth & RBAC ---------------------------------------------------
// Ambangnya sama dengan halaman lain. Yang paling perlu diawasi di sini
// `auditLog`: `audit_log` satu-satunya tabel yang hanya bertambah dan tidak
// pernah dipangkas, jadi kueri yang cepat hari ini belum tentu cepat sebulan lagi.
const ad = await import('../lib/kueri/admin')
const pg = await import('../lib/pengaturan')
await ukur('pengaturanSistem', pg.ambilPengaturan)
await ukur('barisPengaturan', pg.ambilBarisPengaturan)
const daftarPengguna = await ukur('daftarPengguna', () => ad.ambilDaftarPengguna())
await ukur('daftarPengguna(cari)', () => ad.ambilDaftarPengguna({ cari: 'a' }))
await ukur('opsiPeran', ad.ambilOpsiPeran)
await ukur('opsiUnitRingkas', ad.ambilOpsiUnitRingkas)
await ukur('permintaanReset', ad.ambilPermintaanReset)
const audit = await ukur('auditLog(hal 1)', () => ad.ambilAuditLog({}))
await ukur('auditLog(berfilter)', () => ad.ambilAuditLog({ entitas: 'users', cari: 'nama' }))
await ukur('opsiAudit', ad.ambilOpsiAudit)

// -- Fase 8: Laporan -------------------------------------------------------
// Seluruhnya agregat `GROUP BY` atas `match_score_detail` & `nominasi`. Yang
// paling perlu diawasi `gapIndikator`: ia menggabungkan setiap baris rincian
// skor dengan pohon rubriknya lalu menyaring indikator daun lewat `NOT EXISTS`,
// jadi biayanya tumbuh mengikuti jumlah pegawai DIKALI jumlah indikator — bukan
// mengikuti jumlah pegawai saja seperti kueri halaman lain.
const lp = await import('../lib/kueri/laporan')

/**
 * Bentuk beban yang sedang diukur `gapIndikator` — dilaporkan, bukan diasumsikan.
 *
 * Lahir dari salah baca yang nyata: `pupr_dev_volume` sempat hanya punya rincian
 * untuk **satu** dari tiga jabatan target (2,94 rincian/skor, bukan 9 seperti
 * `pupr_dev`), sebab `seed-volume.ts` menulis `match_score` lewat SQL tapi
 * rincian per indikator hanya lahir dari mesin rubrik. Kuerinya lalu terukur
 * 117 ms — di bawah ambang — padahal ia memindai sepertiga baris yang seharusnya.
 * Angka yang melegakan secara keliru lebih berbahaya daripada tidak ada angka,
 * jadi ukurannya sekarang menyebutkan sendiri kalau bebannya tidak representatif.
 */
const { kueri: kueriMentah } = await import('../lib/db')
const bentukGap = await (async () => {
  const r = await kueriMentah<{ skor: number; detail: number; target_berskor: number; target: number }>(
    `SELECT (SELECT COUNT(*) FROM match_score) AS skor,
            (SELECT COUNT(*) FROM match_score_detail) AS detail,
            (SELECT COUNT(DISTINCT m.jabatan_target_id) FROM match_score m
              JOIN match_score_detail d ON d.match_score_id = m.id) AS target_berskor,
            (SELECT COUNT(*) FROM jabatan_target) AS target`,
  )
  const b = r[0]!
  const perSkor = b.skor === 0 ? 0 : Number((b.detail / b.skor).toFixed(2))
  const ringkas = `${b.detail} baris rincian atas ${b.skor} skor (${perSkor}/skor) · ${b.target_berskor}/${b.target} jabatan target punya rincian`
  const peringatan =
    b.target_berskor < b.target
      ? `⚠ BEBAN TIDAK REPRESENTATIF: ${b.target - b.target_berskor} jabatan target belum punya rincian, jadi waktu gapIndikator di bawah ini LEBIH RINGAN dari produksi. Jalankan \`npm run ukur:hitung-ulang:volume:semua\` lebih dulu.`
      : null
  return { ringkas, peringatan }
})()

const opsiLaporan = await ukur('opsiLaporan', lp.ambilOpsiLaporan)
const gapIndikator = await ukurLaporan('gapIndikator', () => lp.ambilGapIndikator())
await ukurLaporan('gapIndikator(1 target)', () =>
  lp.ambilGapIndikator({ jabatanTargetId: idTarget }),
)
await ukurLaporan('gapPerUnit', () => lp.ambilGapPerUnit())
await ukurLaporan('gapPerJenjang', () => lp.ambilGapPerJenjang())
await ukurLaporan('ringkasGap', () => lp.ambilRingkasGap())
await ukurLaporan('rekapPeriode', () => lp.ambilRekapPeriode())
await ukurLaporan('rekapUnit', () => lp.ambilRekapUnit())
await ukurLaporan('rekapTahap', () => lp.ambilRekapTahap())
// Batas yang sama dengan yang dipakai ekspor CSV — bukan batas halaman (500).
// Ekspor adalah pemanggil terberat kueri ini, jadi itu yang perlu diukur.
const nominasiRinci = await ukurLaporan('nominasiRinci(ekspor)', () =>
  lp.ambilNominasiRinci({}, 5000),
)

// -- Fase 9: Klien, token & log aktivitas API ------------------------------
// `aktivitasApi` sekelas `auditLog`: tabelnya hanya bertambah dan tidak pernah
// dipangkas, dan setiap permintaan /api/v1 menambah satu baris. Kalau ada satu
// kueri di daftar ini yang akan melambat seiring waktu, ini dia.
const ap = await import('../lib/kueri/api')
const klienApi = await ukur('daftarKlienApi', ap.ambilDaftarKlienApi)
await ukur('daftarTokenApi', () => ap.ambilDaftarTokenApi())
const aktivitasApi = await ukur('aktivitasApi(hal 1)', () => ap.ambilAktivitasApi({}))
await ukur('aktivitasApi(ditolak)', () => ap.ambilAktivitasApi({ golongan: 'ditolak' }))
await ukur('ringkasAktivitasApi', ap.ambilRingkasAktivitasApi)

/**
 * Pembacaan profil untuk PERHITUNGAN, bukan untuk render halaman.
 *
 * Ambangnya sengaja dibedakan: fungsi ini memuat riwayat lengkap seluruh pegawai
 * (yang tidak bisa diagregasi di SQL karena rubriknya menilai isi riwayatnya),
 * jadi ia memang lebih berat daripada kueri halaman — dan itu tidak masalah
 * selama ia hanya dipanggil oleh Hitung Ulang & Simulasi.
 */
const t0Profil = Date.now()
const profilSemua = await rb.ambilProfilKandidat()
const msProfil = Date.now() - t0Profil

console.log('direktori           :', `${direktori.total} pegawai, ${direktori.baris.length} baris/halaman`)
console.log('rubrik              :', `${pohon.length} komponen, ${daftarTarget.length} jabatan target`)
console.log(
  'talent pool         :',
  `${pool.length} anggota di target ${idTarget}, ${opsiPool.reduce((n, o) => n + o.jumlahMenunggu, 0)} menunggu tindakan lintas target, ${nominasi.length} nominasi`,
)
console.log('kandidat target     :', `${kandidatTarget.total} dinilai, ${kandidatTarget.baris.length} baris/halaman`)
console.log(
  'administrasi        :',
  `${daftarPengguna.length} pengguna, ${audit.total} baris audit (${audit.baris.length}/halaman)`,
)
console.log(
  'profilKandidat      :',
  `${profilSemua.length} pegawai dalam ${msProfil} ms (di luar ambang halaman — hanya dipakai Hitung Ulang & Simulasi)`,
)
console.log('peta sebaran        :', `dinilai ${petaSebaran.totalDinilai} | tanpa asesmen ${petaSebaran.tanpaAsesmen} | kedaluwarsa ${petaSebaran.kedaluwarsa}`)
console.log('peta titik          :', `${petaTitik.titik.length} titik untuk ${petaTitik.totalPegawai} pegawai`)
console.log('anggota sel 9       :', `${sel.total} pegawai, ${sel.daftar.length} ditampilkan`)
console.log('kandidat banding    :', `${kandidat.length} orang, ${targetBanding.length} jabatan target punya skor`)
console.log(
  'laporan             :',
  `${gapIndikator.length} baris gap indikator, ${nominasiRinci.length} nominasi rinci, opsi: ${opsiLaporan.jabatanTarget.length} target / ${opsiLaporan.unit.length} unit / ${opsiLaporan.jenjang.length} jenjang`,
)
console.log('gap analysis        :', bentukGap.ringkas)
if (bentukGap.peringatan !== null) console.log('                     ', bentukGap.peringatan)
console.log(
  'integrasi API       :',
  `${klienApi.length} klien, ${aktivitasApi.total} baris aktivitas (${aktivitasApi.baris.length}/halaman)`,
)

console.log(
  `\n=== WAKTU KUERI (ambang ${AMBANG_MS} ms · agregat laporan ${AMBANG_LAPORAN_MS} ms) ===`,
)
let lambat = 0
for (const w of waktu) {
  const lolos = w.ms < w.ambang
  if (!lolos) lambat += 1
  // Ambangnya ikut dicetak untuk baris yang bukan bawaan, supaya "ok" pada 254 ms
  // tidak terbaca seperti ambangnya diam-diam dilonggarkan untuk semua.
  const catatan = w.ambang === AMBANG_MS ? '' : `  (ambang ${w.ambang} ms)`
  console.log(`${lolos ? 'ok    ' : 'LAMBAT'}  ${w.nama.padEnd(22)} ${w.ms} ms${catatan}`)
}
const total = waktu.reduce((n, w) => n + w.ms, 0)
console.log(`\nTotal ${total} ms untuk ${waktu.length} kueri; ${lambat} melewati ambang.`)
process.exit(lambat > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
