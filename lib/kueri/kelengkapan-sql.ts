import 'server-only'

import { BUTIR_KELENGKAPAN } from '../kelengkapan'

/**
 * Ekspresi SQL untuk skor kelengkapan per pegawai — **dihasilkan** dari
 * `BUTIR_KELENGKAPAN`, bukan ditulis tangan.
 *
 * Kenapa harus SQL sama sekali, padahal sudah ada `hitungKelengkapan()`?
 * Karena rollup per unit butuh rata-rata atas 1.872 pegawai, dan mengambil
 * semua barisnya lalu menjumlah di JavaScript adalah hal yang dilarang K-5.
 *
 * Kenapa dihasilkan, bukan ditulis tangan? Karena bobot butir adalah aturan
 * bisnis. Menuliskannya kedua kali di string SQL berarti begitu satu bobot
 * berubah di `lib/kelengkapan.ts`, badge profil dan rollup unit menampilkan dua
 * angka berbeda untuk hal yang sama — dan tidak ada yang memberi tahu.
 *
 * `SQL_FAKTA` memetakan kunci butir → ekspresi boolean SQL-nya. Kalau ada butir
 * baru di `lib/kelengkapan.ts` tanpa pasangan di sini, `bangunEkspresiKelengkapan`
 * **melempar saat dimuat** — bukan diam-diam menghitung skor yang salah.
 */

/** Ekspresi boolean per butir. Alias tabel yang diasumsikan: `p` = pegawai. */
const SQL_FAKTA: Record<string, string> = {
  // NIP valid diperiksa `lib/nip.ts` (butuh parsing tanggal), jadi di SQL hanya
  // syarat bentuk: 18 digit angka. Perbedaan tafsir ini disebut di UI.
  nipValid: "(p.nip REGEXP '^[0-9]{18}$')",
  jabatanTertaut: '(p.jabatan_id IS NOT NULL)',
  tmtLengkap: '(p.tmt_golongan IS NOT NULL AND p.tmt_jabatan IS NOT NULL)',
  adaAsesmen: 'EXISTS (SELECT 1 FROM asesmen_talenta a WHERE a.pegawai_id = p.id)',
  asesmenBerlaku:
    "EXISTS (SELECT 1 FROM asesmen_talenta a WHERE a.pegawai_id = p.id AND a.status_asesmen = 'Berlaku')",
  adaKinerjaTahunan:
    "EXISTS (SELECT 1 FROM kinerja_periode k WHERE k.pegawai_id = p.id AND k.periode_skp = 'TAHUNAN' AND k.nilai_kinerja IS NOT NULL)",
  kinerjaTriwulanLengkap:
    '((SELECT COUNT(DISTINCT periode_skp) FROM kinerja_periode k WHERE k.pegawai_id = p.id) >= 4)',
  adaPendidikan: 'EXISTS (SELECT 1 FROM riwayat_pendidikan rp WHERE rp.pegawai_id = p.id)',
  pendidikanBertahun:
    '(EXISTS (SELECT 1 FROM riwayat_pendidikan rp WHERE rp.pegawai_id = p.id) AND NOT EXISTS (SELECT 1 FROM riwayat_pendidikan rp WHERE rp.pegawai_id = p.id AND rp.tahun_lulus IS NULL))',
  adaDiklat: '(p.riwayat_diklat IS NOT NULL AND JSON_LENGTH(p.riwayat_diklat) > 0)',
  riwayatJabatanBertanggal:
    '(EXISTS (SELECT 1 FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id) AND NOT EXISTS (SELECT 1 FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id AND rj.tanggal_mulai IS NULL))',
  riwayatJabatanTerpetakan:
    '(EXISTS (SELECT 1 FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id) AND NOT EXISTS (SELECT 1 FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id AND rj.jabatan_id IS NULL))',
  /*
    Terpenuhi oleh DUA jalan, dan yang kedua baru ditambahkan 25 Agu 2026 atas
    permintaan pemilik proses: *"di profil kan ada verifikasi kalo dia gak ada
    hukuman ya itu belum mempengaruhi kesiapan data, masih dianggap blm diisi
    disiplinnya"*.

      1. ada baris `hukuman_disiplin` — rekam jejaknya memang tercatat;
      2. `pegawai.hukdis_diverifikasi_pada` terisi — seseorang sudah MEMERIKSA dan
         menyatakan tidak ada catatan (`doc/sql/020`).

    Tanpa jalan kedua, satu-satunya cara menaikkan skor kesiapan data adalah
    **membuat catatan hukuman** — untuk pegawai yang justru bersih. Itu mendorong
    orang mengarang baris "Tidak Pernah" demi angka, dan angka yang dinaikkan dengan
    cara begitu tidak lagi berarti apa pun. Ceklis verifikasinya ada supaya "sudah
    diperiksa, hasilnya bersih" bisa dinyatakan tanpa memalsukan catatan.
  */
  disiplinTerverifikasi:
    '(EXISTS (SELECT 1 FROM hukuman_disiplin h WHERE h.pegawai_id = p.id)' +
    ' OR p.hukdis_diverifikasi_pada IS NOT NULL)',
}

function bangunEkspresiKelengkapan(): { skor: string; totalBobot: number } {
  const bagian: string[] = []
  let totalBobot = 0

  for (const butir of BUTIR_KELENGKAPAN) {
    const fakta = SQL_FAKTA[butir.kunci]
    if (!fakta) {
      throw new Error(
        `lib/kueri/kelengkapan-sql.ts: butir "${butir.kunci}" ada di BUTIR_KELENGKAPAN tapi tidak punya ekspresi SQL. ` +
          'Tambahkan ke SQL_FAKTA — kalau dibiarkan, rollup per unit menghitung skor yang berbeda dari badge profil.',
      )
    }
    bagian.push(`(${butir.bobot} * IF(${fakta}, 1, 0))`)
    totalBobot += butir.bobot
  }

  return {
    skor: `((${bagian.join(' + ')}) / ${totalBobot} * 100)`,
    totalBobot,
  }
}

const EKSPRESI = bangunEkspresiKelengkapan()

/** Ekspresi SQL skor kelengkapan 0–100 untuk baris `pegawai p`. */
export const SQL_SKOR_KELENGKAPAN = EKSPRESI.skor

/** Total bobot semua butir — dipakai menampilkan penyebutnya di UI. */
export const TOTAL_BOBOT_KELENGKAPAN = EKSPRESI.totalBobot

/** Ekspresi boolean satu butir, untuk kolom "berapa pegawai yang butir X-nya kosong". */
export function sqlFaktaButir(kunci: string): string {
  const fakta = SQL_FAKTA[kunci]
  if (!fakta) throw new Error(`Butir kelengkapan "${kunci}" tidak punya ekspresi SQL.`)
  return fakta
}
