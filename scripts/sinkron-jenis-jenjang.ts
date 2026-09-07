/**
 * Sinkronkan `jenis_jabatan` & `jenjang` yang berselisih dengan namanya sendiri —
 * kering bawaan.
 *
 *   npm run bersih:jenjang
 *   npm run bersih:jenjang -- --tulis
 *
 * Permintaan pemilik proses 2 Sep 2026, sambil membandingkan master terhadap
 * `Struktur Lengkap DJBK PUPR.pdf`: *"nama kode unor jenis jenjang semuanya coba
 * lu sinkronin lagi."* `nama_jabatan`, `kode_jabatan`, dan `unit_organisasi_id`
 * SUDAH diperiksa bersih (nol duplikat kode, nol duplikat (nama,unit), nol
 * jabatan kembar — lihat `cari-jabatan-kembar.ts` & `bersih:jabatan`). Yang
 * tersisa dua kelompok, keduanya salah TANPA satu pun galat karena `jenjang`
 * kolom teks bebas, bukan enum yang bisa menolak nilai salah:
 *
 * ## A · `jenjang = 'III.a'` (3 baris) — kode eselon mentah, bukan nomenklatur ASN
 *
 * Sama persis kelas cacat yang diperbaiki 24 Agu 2026 untuk 78 baris lain
 * ("III.a" → "Administrator" dst) — 3 baris ini lolos saat itu karena lahir dari
 * batch impor BELAKANGAN (`JAB-KAB26-*`, "Kepala Balai Jasa Konstruksi Wilayah"
 * di Palembang/Jakarta/Jayapura). Empat saudaranya di unit BJKW lain (kode
 * `JAB-KABALAI-BJKW-*`) sudah benar "Administrator" — dibandingkan di sini
 * sebagai bukti bukan tebakan.
 *
 * ## B · `jenis_jabatan = 'STRUKTURAL'` + `jenjang = ''` pada nama ber-akhiran
 *     "Ahli Madya/Muda/Pertama/Utama" (23 baris, semua `JAB-FUNG26-*`)
 *
 * Nama jabatannya sendiri sudah menyebut jenjang fungsionalnya ("Pembina Jasa
 * Konstruksi Ahli Madya", dst) — kontradiksi dengan `jenis_jabatan=STRUKTURAL`
 * yang tertulis di kolom sebelahnya. **Bukan duplikat**: diperiksa, tidak ada
 * baris lain di unit yang sama dengan nama yang sama, dan seluruh 23 baris
 * berpenghuni (32 pegawai total) — jadi ini pegawai fungsional sungguhan yang
 * kartu profilnya menyebut jenisnya salah, bukan kursi kosong yang bisa dihapus.
 *
 * Jenjangnya DITURUNKAN dari akhiran namanya sendiri — bukan ditebak dari daftar
 * terpisah yang bisa berselisih dengan apa yang sungguhan tertulis di kolom nama.
 *
 * ## Kenapa UPDATE metadata, bukan hapus-buat-ulang
 *
 * Baris-barisnya SAH — pemiliknya nyata dan riwayatnya melekat di `jabatan_id`
 * yang sama. Menghapus-lalu-membuat-ulang (pola `rapikan-jabatan.ts` untuk kasus
 * lain) berarti memutus tautan `pegawai.jabatan_id` & `riwayat_jabatan.jabatan_id`
 * tanpa alasan — di sini yang salah cuma dua kolom metadata, jadi UPDATE tepat
 * sasaran.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')

function jenjangFungsionalDariNama(nama: string): string | null {
  const m = /\b(Ahli\s+(Utama|Madya|Muda|Pertama)|Penyelia|Mahir|Terampil|Pemula)\b/i.exec(nama)
  return m === null ? null : m[0].replace(/\s+/g, ' ')
}

async function main() {
  const { kueri, kueriSatu, eksekusi } = await import('../lib/db')

  console.log(`\nmode: ${TULIS ? 'TULIS' : 'kering'}\n`)

  // --- A: jenjang kode mentah pada eselon III/IV ---
  console.log('=== A. jenjang berkode eselon mentah (harus nomenklatur ASN) ===')
  const PETA: Record<string, string> = { 'II.a': 'JPT Pratama', 'III.a': 'Administrator', 'IV.a': 'Pengawas' }
  const mentah = await kueri<{ id: number; nama_jabatan: string; jenjang: string; eselon: string }>(
    `SELECT id, nama_jabatan, jenjang, eselon FROM jabatan
      WHERE jenjang IN ('II.a','III.a','IV.a') AND status_jabatan <> 'DIHAPUS'`,
  )
  for (const j of mentah) {
    const benar = PETA[j.jenjang]
    console.log(`  #${j.id} "${j.nama_jabatan}" (${j.eselon}): "${j.jenjang}" → "${benar}"`)
    if (TULIS) await eksekusi('UPDATE jabatan SET jenjang = ? WHERE id = ?', [benar, j.id])
  }
  if (mentah.length === 0) console.log('  (tidak ada)')

  // --- B: STRUKTURAL yang namanya sendiri menyebut jenjang fungsional ---
  console.log('\n=== B. jenis_jabatan STRUKTURAL padahal nama menyebut jenjang fungsional ===')
  const salahJenis = await kueri<{ id: number; nama_jabatan: string; jenis_jabatan: string }>(
    `SELECT id, nama_jabatan, jenis_jabatan FROM jabatan
      WHERE jenis_jabatan = 'STRUKTURAL' AND eselon = 'NON_ESELON' AND status_jabatan <> 'DIHAPUS'`,
  )
  let batalB = 0
  for (const j of salahJenis) {
    const jenjang = jenjangFungsionalDariNama(j.nama_jabatan)
    if (jenjang === null) {
      console.log(`  #${j.id} "${j.nama_jabatan}" — TIDAK bisa diturunkan jenjangnya dari namanya, DILEWATI`)
      batalB++
      continue
    }
    const dep = await kueriSatu<{ penghuni: number }>(
      `SELECT COUNT(*) AS penghuni FROM pegawai WHERE jabatan_id = ? AND status_aktif = 'AKTIF'`,
      [j.id],
    )
    console.log(
      `  #${j.id} "${j.nama_jabatan}" — STRUKTURAL/'' → FUNGSIONAL_TERTENTU/'${jenjang}' (${dep?.penghuni ?? 0} penghuni)`,
    )
    if (TULIS) {
      await eksekusi(
        `UPDATE jabatan SET jenis_jabatan = 'FUNGSIONAL_TERTENTU', jenjang = ? WHERE id = ?`,
        [jenjang, j.id],
      )
    }
  }
  if (salahJenis.length === 0) console.log('  (tidak ada)')

  console.log(
    `\n── ${TULIS ? 'DITULIS' : 'kering'} ── A: ${mentah.length} · B: ${salahJenis.length - batalB} disinkronkan${batalB > 0 ? ` · ${batalB} dilewati` : ''}`,
  )
  if (!TULIS) console.log('   Tambahkan `--tulis` untuk menerapkan.\n')
  process.exit(0)
}

void main()
