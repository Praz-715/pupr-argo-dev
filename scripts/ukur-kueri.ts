/**
 * Ukur waktu setiap kueri halaman. Ambang: <150 ms per kueri (phase.md §7 DoD Fase 1).
 *
 * Mencakup dashboard (Fase 1), direktori & profil (Fase 2), serta peta talenta &
 * perbandingan kandidat (Fase 3) — halaman baru wajib ikut diukur, bukan
 * diasumsikan cepat karena kelihatannya sederhana.
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

const waktu: Array<{ nama: string; ms: number }> = []

async function ukur<T>(nama: string, fn: () => Promise<T>): Promise<T> {
  const mulai = performance.now()
  const hasil = await fn()
  waktu.push({ nama, ms: Math.round(performance.now() - mulai) })
  return hasil
}

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
  'profilKandidat      :',
  `${profilSemua.length} pegawai dalam ${msProfil} ms (di luar ambang halaman — hanya dipakai Hitung Ulang & Simulasi)`,
)
console.log('peta sebaran        :', `dinilai ${petaSebaran.totalDinilai} | tanpa asesmen ${petaSebaran.tanpaAsesmen} | kedaluwarsa ${petaSebaran.kedaluwarsa}`)
console.log('peta titik          :', `${petaTitik.titik.length} titik untuk ${petaTitik.totalPegawai} pegawai`)
console.log('anggota sel 9       :', `${sel.total} pegawai, ${sel.daftar.length} ditampilkan`)
console.log('kandidat banding    :', `${kandidat.length} orang, ${targetBanding.length} jabatan target punya skor`)

console.log('\n=== WAKTU KUERI (ambang 150 ms) ===')
let lambat = 0
for (const w of waktu) {
  const lolos = w.ms < 150
  if (!lolos) lambat += 1
  console.log(`${lolos ? 'ok    ' : 'LAMBAT'}  ${w.nama.padEnd(20)} ${w.ms} ms`)
}
const total = waktu.reduce((n, w) => n + w.ms, 0)
console.log(`\nTotal ${total} ms untuk ${waktu.length} kueri; ${lambat} melewati ambang.`)
process.exit(lambat > 0 ? 1 : 0)
}

main().catch((e) => { console.error(e); process.exit(1) })
