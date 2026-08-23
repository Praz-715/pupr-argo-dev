/**
 * Generator doc/sql/007_recompute.sql
 *
 * Membaca keadaan pupr_dev setelah 001–006, lalu MENGHITUNG ULANG semua nilai
 * turunan memakai `lib/scoring` + `lib/penilaian` + `lib/skor-massal`, dan
 * menuliskannya sebagai SQL. Prinsipnya (phase.md §4): tidak ada angka hasil
 * hitung yang ditulis tangan — kalau ada angka di DB yang tidak bisa dilahirkan
 * ulang oleh kode, salah satunya salah, dan itu harus ketahuan di sini.
 *
 * Yang dihitung ulang:
 *   asesmen_talenta : nilai_kinerja_y, nilai_potensial_x, nilai_talenta,
 *                     kotak_9, nilai_integritas, status_asesmen
 *   match_score     : 3 komponen + total + eligible + catatan + snapshot rubrik
 *   match_score_detail : rincian per indikator & sub-indikator
 *   talent_pool     : match_score_id + ranking
 *
 * SEJAK FASE 5 skrip ini **tidak lagi memuat pipeline-nya sendiri.** Pembacaan
 * rubrik & profil pegawai memakai `lib/kueri/rubrik`, dan perhitungan match
 * score memakai `lib/skor-massal` — modul yang sama dengan yang dipakai tombol
 * Hitung Ulang, halaman Simulasi & Diff, dan halaman Kandidat. Sebelumnya urutan
 * langkahnya hidup di sini saja, sehingga UI harus menuliskannya ulang; dua
 * salinan aturan yang sama akan berselisih tanpa ada yang tahu (CLAUDE.md #1).
 * `npm run verifikasi:skoring` menjaga agar hasilnya tetap sama dengan isi DB.
 *
 * Jalankan (setelah 001–006 tereksekusi):
 *   npm run db:recompute
 */

import { writeFileSync } from 'node:fs'
import { config } from 'dotenv'

// Hanya tipe yang boleh diimpor statis: `lib/db` membangun pool koneksinya saat
// modul dimuat, sedangkan `config()` di bawah baru mengisi env. Impor nilai
// secara statis akan membuat pool lahir tanpa kredensial.
import type { Predikat, StatusAsesmen } from '../lib/scoring/types'

config({ path: '.env.local' })
config({ path: '.env' })

const BERKAS = 'doc/sql/007_recompute.sql'
const SEKARANG = new Date(2026, 6, 30, 12)
const TAHUN_SEKARANG = 2026

const q = (s: string | null): string => (s === null ? 'NULL' : `'${s.replace(/'/g, "''")}'`)
const num = (n: number | null): string => (n === null ? 'NULL' : n.toFixed(2))

async function main() {
  const { kueri } = await import('../lib/db')
  const { ambangSumbuDari, ambilPengaturan } = await import('../lib/pengaturan')

  /**
   * Parameter yang bisa diubah operator DIBACA dari `pengaturan_sistem`, tidak
   * dipaku di berkas ini.
   *
   * Sebelum 18 Agu 2026 di sini ada `const MASA_BERLAKU = 3`, sementara nilai di
   * DB sudah 4 — jadi menjalankan `db:recompute` akan menuliskan status masa
   * berlaku menurut 3 tahun ke `007_recompute.sql`, lalu `verifikasi:skoring`
   * (yang membaca pengaturan) memerahkannya. Skornya identik sampai dua desimal
   * dan hanya kolom kelayakan yang berbeda, jadi gejalanya mudah disalahsangkakan
   * sebagai skor basi. Bug serupa ditemukan di `ukur-hitung-ulang.ts` hari yang
   * sama; keduanya lahir dari kebiasaan yang sama, yaitu menyalin nilai bawaan
   * ke dalam skrip.
   *
   * `ambilPengaturan()` sudah jatuh kembali ke nilai bawaan kalau tabelnya belum
   * ada, jadi ini tetap aman dijalankan pada database yang belum menjalankan 012.
   */
  const pengaturan = await ambilPengaturan()
  const MASA_BERLAKU = pengaturan.masaBerlakuAsesmenTahun
  const AMBANG = ambangSumbuDari(pengaturan)
  console.log(
    `pengaturan: masa berlaku ${MASA_BERLAKU} tahun · ambang ${AMBANG.tengah}/${AMBANG.atas}`,
  )
  const { ambilPohonRubrik, ambilProfilKandidat, ambilRubrikUntukHitung, indikatorBerkunciDari } =
    await import('../lib/kueri/rubrik')
  const { hitungSkorMassal } = await import('../lib/skor-massal')
  const {
    bandingkanKotak9,
    evaluasiMasaBerlaku,
    hitungKotak9,
    hitungRanking,
    hitungSkorIntegritas,
    hitungSumbu,
    skorPredikat,
  } = await import('../lib/scoring')

  // -------------------------------------------------------------------------
  // 1. Rubrik & profil — dibaca lewat lapisan kueri yang sama dengan UI
  // -------------------------------------------------------------------------
  const rubrikGenerik = await ambilPohonRubrik(null)
  const profil = await ambilProfilKandidat()
  const namaPegawai = new Map(profil.map((p) => [p.pegawaiId, p.nama]))

  const asesmenRaw = await kueri<Record<string, unknown>>(
    `SELECT id, pegawai_id, tahun_asesmen, status_asesmen, potkom, rating_kinerja, kotak_9,
            kotak_9_sumber
     FROM asesmen_talenta ORDER BY pegawai_id, tahun_asesmen`,
  )
  const targetRaw = await kueri<{ id: number }>(`SELECT id FROM jabatan_target ORDER BY id`)
  const poolRaw = await kueri<Record<string, unknown>>(
    `SELECT id, pegawai_id, jabatan_target_id, status FROM talent_pool ORDER BY id`,
  )

  const hukumanPer = new Map(profil.map((p) => [p.pegawaiId, p.hukumanDisiplin]))

  // Indikator Potkom pada rubrik generik dicari lewat KUNCI SISTEM, bukan lewat
  // urutan atau nama: sejak Fase 5 nama indikator milik pengguna (doc/sql/010).
  const idPotkomGenerik = indikatorBerkunciDari(
    rubrikGenerik.filter((k) => k.sumbu === 'X_POTENSIAL'),
  ).find((i) => i.kunci === 'POTKOM')?.indikatorId

  // -------------------------------------------------------------------------
  // 2. Hitung ulang asesmen_talenta (Formula A)
  // -------------------------------------------------------------------------
  const baris: string[] = []
  const t = (s = '') => baris.push(s)

  const catatanAsesmen: string[] = []
  const selisihKotak: string[] = []
  const sebaranKotak = new Map<number, number>()
  const updateAsesmen: string[] = []

  /** Asesmen terbaru per pegawai + status hasil hitung (bukan status mentah). */
  const asesmenTerbaru = new Map<
    number,
    { potkom: number; y: number; tahun: number; status: StatusAsesmen }
  >()

  for (const a of asesmenRaw) {
    const pegawaiId = Number(a.pegawai_id)
    const potkom = Number(a.potkom ?? 0)
    const predikat = String(a.rating_kinerja) as Predikat

    const y = skorPredikat(predikat)
    if (y === null) {
      catatanAsesmen.push(`asesmen ${a.id}: predikat "${predikat}" tidak dikenal`)
      continue
    }

    // Sumbu X memakai rubrik GENERIK dari DB — bukan sekadar menyalin potkom,
    // supaya jalur perhitungannya sama dengan Formula A yang dipakai UI.
    const hasilX = hitungSumbu(rubrikGenerik, 'X_POTENSIAL', {
      ...(idPotkomGenerik !== undefined ? { [idPotkomGenerik]: potkom } : {}),
    })

    const kotak = hitungKotak9(y, hasilX.skor, AMBANG)
    const banding = bandingkanKotak9(
      kotak,
      a.kotak_9_sumber === null || a.kotak_9_sumber === undefined
        ? Number(a.kotak_9)
        : Number(a.kotak_9_sumber),
    )
    if (banding.perluReview && banding.keterangan) {
      selisihKotak.push(`  ${namaPegawai.get(pegawaiId)} (asesmen ${a.id}): ${banding.keterangan}`)
    }

    const integritas = hitungSkorIntegritas(hukumanPer.get(pegawaiId) ?? [])
    const masaBerlaku = evaluasiMasaBerlaku(
      Number(a.tahun_asesmen),
      String(a.status_asesmen) as StatusAsesmen,
      { tahunSekarang: TAHUN_SEKARANG, masaBerlakuTahun: MASA_BERLAKU },
    )
    const statusBaru: StatusAsesmen = masaBerlaku.kedaluwarsa ? 'Expired' : 'Berlaku'

    updateAsesmen.push(
      `UPDATE asesmen_talenta SET nilai_kinerja_y = ${num(y)}, nilai_potensial_x = ${num(hasilX.skor)}, ` +
        `nilai_talenta = ${num(kotak.nilaiTalenta)}, kotak_9 = ${kotak.kotak}, ` +
        `nilai_integritas = ${num(integritas.skor)}, status_asesmen = '${statusBaru}', ` +
        `sumber_sync = 'recalculated' WHERE id = ${a.id};`,
    )

    sebaranKotak.set(kotak.kotak, (sebaranKotak.get(kotak.kotak) ?? 0) + 1)

    const sebelumnya = asesmenTerbaru.get(pegawaiId)
    if (!sebelumnya || Number(a.tahun_asesmen) > sebelumnya.tahun) {
      asesmenTerbaru.set(pegawaiId, {
        potkom,
        y,
        tahun: Number(a.tahun_asesmen),
        status: statusBaru,
      })
    }
  }

  // Pakai status & Y HASIL HITUNG untuk kelayakan, bukan kolom mentah: kalau
  // 007 diregenerasi dari DB yang status_asesmen-nya masih belum konsisten
  // (phase.md §4.1), memercayai kolom mentah akan meloloskan asesmen basi.
  const profilTerhitung = profil.map((p) => {
    const a = asesmenTerbaru.get(p.pegawaiId)
    return a === undefined
      ? { ...p, asesmen: null }
      : {
          ...p,
          potkom: a.potkom,
          asesmen: { tahunAsesmen: a.tahun, statusAsesmen: a.status, nilaiKinerjaY: a.y },
        }
  })

  // -------------------------------------------------------------------------
  // 3. Hitung ulang match_score + match_score_detail lewat lib/skor-massal
  // -------------------------------------------------------------------------
  interface HasilSkor {
    pegawaiId: number
    targetId: number
    pk: number
    kj: number
    im: number
    total: number
    eligible: boolean
    catatan: string
    snapshot: string
    detail: Array<{
      rubrikIndikatorId: number
      parentIndikatorId: number | null
      bobot: number | null
      nilaiMentah: number | string | null
      kategoriTerpilih: string | null
      skor: number
      perluReview: boolean
    }>
    y: number
  }

  const hasilSkor: HasilSkor[] = []
  const catatanReviewTotal: string[] = []

  for (const target of targetRaw) {
    const targetId = Number(target.id)
    const siap = await ambilRubrikUntukHitung(targetId)
    if (siap === null || siap.rubrik.komponen.length === 0) continue

    const hasil = hitungSkorMassal(siap.rubrik, profilTerhitung, {
      sekarang: SEKARANG,
      tahunSekarang: TAHUN_SEKARANG,
      masaBerlakuTahun: MASA_BERLAKU,
    })
    const snapshot = JSON.stringify(hasil.snapshotRubrik)

    for (const h of hasil.hasil) {
      if (h.perluReview) {
        catatanReviewTotal.push(`  ${h.nama} x target ${targetId} — ada indikator perlu ditinjau`)
      }
      hasilSkor.push({
        pegawaiId: h.pegawaiId,
        targetId,
        pk: h.skorPotensiKompetensi,
        kj: h.skorKualifikasiJabatan,
        im: h.skorIntegritasMoralitas,
        total: h.skorTotal,
        eligible: h.eligible,
        catatan: h.catatanEligibility,
        snapshot,
        detail: h.detail,
        y: h.nilaiKinerjaY ?? 0,
      })
    }
  }

  // -------------------------------------------------------------------------
  // 4. Susun SQL
  // -------------------------------------------------------------------------
  t('-- =====================================================================')
  t('-- SIMT DJBK - 007 Recompute')
  t('--')
  t('-- DIHASILKAN OLEH scripts/recompute.ts — jangan diedit tangan.')
  t('-- Regenerasi (setelah 001–006 tereksekusi):')
  t('--   npm run db:recompute')
  t('--')
  t('-- Seluruh angka di berkas ini adalah OUTPUT lib/scoring + lib/penilaian +')
  t('-- lib/skor-massal, bukan hitungan manual. Kalau ada nilai di DB yang tidak')
  t('-- bisa dilahirkan ulang oleh kode, selisihnya akan terlihat saat berkas ini')
  t('-- diregenerasi atau saat `npm run verifikasi:skoring` dijalankan.')
  t('--')
  t(`-- Acuan waktu perhitungan : ${SEKARANG.toISOString().slice(0, 10)}`)
  t(`-- Masa berlaku asesmen     : ${MASA_BERLAKU} tahun (phase.md §2.9)`)
  t('-- URUTAN JALANKAN: 001 -> 002 -> 003 -> 004 -> 005 -> 006 -> 007')
  t('-- =====================================================================')
  t()
  t('SET NAMES utf8mb4;')
  t()
  t('-- ---------------------------------------------------------------------')
  t('-- 1. asesmen_talenta: nilai turunan Formula A')
  t('--    nilai_potensial_x dihitung lewat rubrik generik di DB (bukan')
  t('--    menyalin potkom), supaya jalurnya sama dengan yang dipakai UI.')
  t(`--    ${updateAsesmen.length} baris.`)
  t('-- ---------------------------------------------------------------------')
  for (const u of updateAsesmen) t(u)
  t()

  t('-- ---------------------------------------------------------------------')
  t('-- 2. match_score + match_score_detail')
  t(`--    ${hasilSkor.length} baris skor (${targetRaw.length} jabatan target x ${profil.length} pegawai),`)
  t(`--    ${hasilSkor.reduce((n, h) => n + h.detail.length, 0)} baris rincian indikator.`)
  t('--')
  t('--    Dihitung untuk SELURUH pegawai, bukan hanya yang lolos syarat —')
  t('--    kolom `eligible` yang membedakan. Ini mengikuti Garis Besar Proses')
  t('--    Blueprint: seleksi kelayakan dan match scoring adalah dua langkah')
  t('--    terpisah, dan skor kandidat tidak lolos tetap berguna sebagai')
  t('--    pembanding di halaman Kandidat & Eligibility Check.')
  t('-- ---------------------------------------------------------------------')
  t('DELETE FROM match_score_detail;')
  t('DELETE FROM match_score;')
  t('ALTER TABLE match_score AUTO_INCREMENT = 1;')
  t('ALTER TABLE match_score_detail AUTO_INCREMENT = 1;')
  t()

  hasilSkor.forEach((h, i) => {
    const id = i + 1
    t(
      `INSERT INTO match_score (id, pegawai_id, jabatan_target_id, skor_potensi_kompetensi, skor_kualifikasi_jabatan, skor_integritas_moralitas, skor_total, eligible, catatan_eligibility, rubrik_snapshot) VALUES`,
    )
    t(
      `  (${id}, ${h.pegawaiId}, ${h.targetId}, ${num(h.pk)}, ${num(h.kj)}, ${num(h.im)}, ${num(h.total)}, ${h.eligible ? 1 : 0}, ${q(h.catatan)}, ${q(h.snapshot)});`,
    )
    const nilaiDetail = h.detail
      .map(
        (d) =>
          `  (${id}, ${d.rubrikIndikatorId}, ${d.parentIndikatorId ?? 'NULL'}, ${d.bobot === null ? 'NULL' : d.bobot.toFixed(4)}, ${q(d.nilaiMentah === null ? null : String(d.nilaiMentah))}, ${q(d.kategoriTerpilih)}, ${num(d.skor)}, 'OTOMATIS', ${d.perluReview ? 1 : 0})`,
      )
      .join(',\n')
    t(
      `INSERT INTO match_score_detail (match_score_id, rubrik_indikator_id, parent_indikator_id, bobot_indikator, nilai_mentah, kategori_terpilih, skor, sumber_nilai, perlu_review) VALUES`,
    )
    t(nilaiDetail + ';')
    t()
  })

  // -- talent_pool ----------------------------------------------------------
  t('-- ---------------------------------------------------------------------')
  t('-- 3. talent_pool: tautkan ulang ke match_score & hitung ranking')
  t('--')
  t('--    Status workflow entri lama (DITETAPKAN/DIVERIFIKASI/dst) DIPERTAHANKAN')
  t('--    karena ada nominasi & approval_log yang menunjuk ke sana.')
  t('--    Kandidat baru yang lolos syarat ditambahkan berstatus KANDIDAT.')
  t('-- ---------------------------------------------------------------------')
  t('UPDATE talent_pool tp')
  t('JOIN match_score ms ON ms.pegawai_id = tp.pegawai_id AND ms.jabatan_target_id = tp.jabatan_target_id')
  t('SET tp.match_score_id = ms.id;')
  t()

  const eligiblePerTarget = new Map<number, HasilSkor[]>()
  for (const h of hasilSkor) {
    if (!h.eligible) continue
    const daftar = eligiblePerTarget.get(h.targetId) ?? []
    daftar.push(h)
    eligiblePerTarget.set(h.targetId, daftar)
  }

  // Ambil maksimal 8 kandidat teratas per jabatan target supaya talent pool
  // tetap terbaca sebagai daftar suksesor, bukan salinan direktori pegawai.
  const BATAS_POOL = 8
  const ringkasanPool: string[] = []
  const skorPer = new Map<string, HasilSkor>()
  for (const h of hasilSkor) skorPer.set(`${h.pegawaiId}:${h.targetId}`, h)

  for (const target of targetRaw) {
    const targetId = Number(target.id)
    const eligible = eligiblePerTarget.get(targetId) ?? []
    const anggotaLama = poolRaw
      .filter((p) => Number(p.jabatan_target_id) === targetId)
      .map((p) => Number(p.pegawai_id))

    // Kandidat eligible teratas yang belum ada di pool
    const kandidatBaru = hitungRanking(
      eligible.map((h) => ({ pegawaiId: h.pegawaiId, skorTotal: h.total, nilaiKinerjaY: h.y })),
    )
      .filter((k) => !anggotaLama.includes(k.pegawaiId))
      .slice(0, Math.max(0, BATAS_POOL - anggotaLama.length))
      .map((k) => k.pegawaiId)

    // PENTING: ranking dihitung atas SELURUH anggota pool (lama + baru), bukan
    // hanya yang baru dimasukkan. Kalau tidak, anggota lama yang skornya turun
    // di luar batas atas akan mempertahankan ranking basi dari seed — dan itu
    // menghasilkan nomor ranking ganda dalam satu jabatan target.
    const anggotaFinal = [...new Set([...anggotaLama, ...kandidatBaru])]
    const berperingkat = hitungRanking(
      anggotaFinal.map((pegawaiId) => {
        const h = skorPer.get(`${pegawaiId}:${targetId}`)
        return {
          pegawaiId,
          skorTotal: h?.total ?? 0,
          nilaiKinerjaY: h?.y ?? null,
        }
      }),
    )

    ringkasanPool.push(
      `  target ${targetId}: ${eligible.length} eligible, pool ${anggotaLama.length} lama + ${kandidatBaru.length} baru = ${anggotaFinal.length}`,
    )

    t(
      `-- Jabatan target ${targetId}: ${eligible.length} kandidat eligible; pool = ${anggotaLama.length} anggota lama + ${kandidatBaru.length} kandidat baru`,
    )
    for (const pegawaiId of kandidatBaru) {
      t(
        `INSERT INTO talent_pool (pegawai_id, jabatan_target_id, match_score_id, ranking, status) ` +
          `SELECT ${pegawaiId}, ${targetId}, ms.id, 0, 'KANDIDAT' FROM match_score ms ` +
          `WHERE ms.pegawai_id = ${pegawaiId} AND ms.jabatan_target_id = ${targetId};`,
      )
    }
    t(`-- Ranking ulang seluruh ${anggotaFinal.length} anggota pool jabatan target ${targetId}`)
    for (const k of berperingkat) {
      t(
        `UPDATE talent_pool SET ranking = ${k.ranking} WHERE pegawai_id = ${k.pegawaiId} AND jabatan_target_id = ${targetId};`,
      )
    }
    if (eligible.length > anggotaFinal.length) {
      t(
        `-- ${eligible.length - anggotaFinal.length} kandidat eligible lain TIDAK masuk pool (batas ${BATAS_POOL}).`,
      )
      t('-- Skornya tetap tersimpan di match_score dan tampil di halaman Kandidat & Eligibility Check.')
    }
    t()
  }

  t('-- Kandidat yang ternyata tidak lolos syarat namun masih tercatat di pool')
  t('-- lama: statusnya tidak diubah otomatis (keputusan manusia), tapi diberi')
  t('-- catatan supaya muncul di Antrian Pembersihan Data.')
  t("UPDATE talent_pool tp JOIN match_score ms ON ms.id = tp.match_score_id")
  t("SET tp.catatan_reviewer = CONCAT(COALESCE(CONCAT(tp.catatan_reviewer, ' | '), ''), '[recompute] Tidak lolos syarat jabatan target pada perhitungan terakhir')")
  t("WHERE ms.eligible = 0 AND tp.status <> 'DITOLAK'")
  t("  AND (tp.catatan_reviewer IS NULL OR tp.catatan_reviewer NOT LIKE '%[recompute]%');")
  t()

  // -- Nominasi jalur tolak & revisi ----------------------------------------
  t('-- ---------------------------------------------------------------------')
  t('-- 4. Nominasi jalur DITOLAK & REVISI')
  t('--    Seed sebelumnya hanya punya jalur mulus; kedua cabang ini membuat')
  t('--    UI verifikasi & timeline approval teruji seluruhnya.')
  t('-- ---------------------------------------------------------------------')
  t('INSERT INTO nominasi (talent_pool_id, diajukan_oleh_unit_id, diajukan_oleh_user_id, tanggal_diajukan, status, catatan)')
  t('SELECT tp.id, 11, 3, \'2026-05-12\', \'DITOLAK\', \'Diusulkan unit sebagai kandidat Kepala Balai; mohon dipertimbangkan.\'')
  t('FROM talent_pool tp JOIN pegawai p ON p.id = tp.pegawai_id')
  t("WHERE p.nip = '198006202006021003' AND tp.jabatan_target_id = 1")
  t('  AND NOT EXISTS (SELECT 1 FROM nominasi n WHERE n.talent_pool_id = tp.id)')
  t('LIMIT 1;')
  t()
  t('INSERT INTO approval_log (nominasi_id, tahap, status, approver_user_id, catatan, tanggal_aksi)')
  t("SELECT n.id, 'Verifikasi Kepegawaian', 'DITOLAK', 2, 'Terdapat hukuman disiplin ringan yang masih aktif; skor Integritas & Moralitas 75. Diusulkan ditinjau kembali setelah masa berlaku sanksi berakhir.', '2026-05-20 10:15:00'")
  t("FROM nominasi n WHERE n.status = 'DITOLAK'")
  t('  AND NOT EXISTS (SELECT 1 FROM approval_log a WHERE a.nominasi_id = n.id)')
  t('LIMIT 1;')
  t()
  t('INSERT INTO nominasi (talent_pool_id, diajukan_oleh_unit_id, diajukan_oleh_user_id, tanggal_diajukan, status, catatan)')
  t('SELECT tp.id, 12, 4, \'2026-06-02\', \'MENUNGGU_VERIFIKASI\', \'Pengajuan kandidat dari unit; dokumen pendukung menyusul.\'')
  t('FROM talent_pool tp JOIN pegawai p ON p.id = tp.pegawai_id')
  t("WHERE p.nip = '198102142006041002' AND tp.jabatan_target_id = 1")
  t('  AND NOT EXISTS (SELECT 1 FROM nominasi n WHERE n.talent_pool_id = tp.id)')
  t('LIMIT 1;')
  t()
  t('INSERT INTO approval_log (nominasi_id, tahap, status, approver_user_id, catatan, tanggal_aksi)')
  t("SELECT n.id, 'Verifikasi Kepegawaian', 'REVISI', 2, 'Riwayat diklat pengadaan belum terlampir dan tahun lulus S1 belum terisi. Mohon dilengkapi sebelum diverifikasi ulang.', '2026-06-09 14:30:00'")
  t('FROM nominasi n JOIN talent_pool tp ON tp.id = n.talent_pool_id JOIN pegawai p ON p.id = tp.pegawai_id')
  t("WHERE p.nip = '198102142006041002' AND n.status = 'MENUNGGU_VERIFIKASI'")
  t('  AND NOT EXISTS (SELECT 1 FROM approval_log a WHERE a.nominasi_id = n.id)')
  t('LIMIT 1;')
  t()

  writeFileSync(BERKAS, baris.join('\n') + '\n', 'utf8')

  // -------------------------------------------------------------------------
  // 5. Ringkasan untuk manusia
  // -------------------------------------------------------------------------
  console.log(`${BERKAS} ditulis.\n`)
  console.log(`asesmen_talenta       : ${updateAsesmen.length} baris dihitung ulang`)
  console.log(`match_score           : ${hasilSkor.length} baris`)
  console.log(`match_score_detail    : ${hasilSkor.reduce((n, h) => n + h.detail.length, 0)} baris`)
  console.log(`kandidat eligible     :`)
  for (const r of ringkasanPool) console.log(r)

  const sel = [...sebaranKotak.entries()].sort((a, b) => a[0] - b[0])
  console.log(`\nsebaran Kotak 9 (${sel.reduce((n, [, v]) => n + v, 0)} asesmen):`)
  console.log(`  ${sel.map(([k, n]) => `K${k}=${n}`).join('  ')}`)
  const kosong = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((k) => !sebaranKotak.has(k))
  console.log(kosong.length === 0 ? '  kesembilan sel terisi' : `  SEL KOSONG: ${kosong.join(', ')}`)

  if (selisihKotak.length > 0) {
    console.log(`\nselisih kotak_9 vs nilai sumber (${selisihKotak.length}) — masuk Antrian Pembersihan:`)
    for (const s of selisihKotak.slice(0, 8)) console.log(s)
    if (selisihKotak.length > 8) console.log(`  … dan ${selisihKotak.length - 8} lainnya`)
  } else {
    console.log('\nkotak_9: tidak ada selisih terhadap nilai sumber')
  }

  if (catatanAsesmen.length > 0) {
    console.log('\nperingatan:')
    for (const c of catatanAsesmen) console.log(`  ${c}`)
  }

  const review = [...new Set(catatanReviewTotal)]
  console.log(`\nindikator perlu review: ${review.length} kejadian`)
  for (const r of review.slice(0, 10)) console.log(r)
  if (review.length > 10) console.log(`  … dan ${review.length - 10} lainnya`)

  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
