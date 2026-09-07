import 'server-only'

import { angka, angkaWajib, kueri, kueriSatu } from '../db'
import { hitungKelengkapan, type HasilKelengkapan } from '../kelengkapan'
import { adalahKategoriCatatan, type KategoriCatatan } from '../catatan-pegawai'
import { bulanKeTahun } from '../masa-kerja'
import { ringkasPengalamanJenjang, type RingkasJenjang } from '../pengalaman-jenjang'
import { adalahKunciIndikator, type KunciIndikator } from '../penilaian'
import { normalisasiGolongan, type TingkatPendidikan } from '../normalisasi'
import { hitungUsia, parseNip, proyeksiPensiun, selisihTahun } from '../nip'
import type { Eselon } from '../scoring/eligibility'
import type { Kotak9 } from '../scoring'
import { arahBawaanUrut } from '../urut'
import {
  CTE_ASESMEN_TERBARU,
  SUBKUERI_UNIT_TURUNAN,
  filterSumber,
  urutAsesmenBerlaku,
} from './dasar'
import { ambilOpsiRumpun, klausaRumpun, type OpsiRumpun } from './rumpun'
import { sqlFaktaButir } from './kelengkapan-sql'

/**
 * Kueri Direktori Pegawai & Profil Talenta.
 *
 * Paginasi, pengurutan, dan penyaringan SEMUANYA di SQL — produksi 1.872 ASN
 * (phase.md §3 K-5). Kolom hasil urut dibatasi daftar putih (bukan interpolasi
 * bebas dari query string) supaya tidak ada celah injeksi lewat `?urut=`.
 */

// ---------------------------------------------------------------------------
// Direktori
// ---------------------------------------------------------------------------

/**
 * Kolom yang boleh dipakai mengurutkan → ekspresi SQL-nya.
 * Arah bawaan tiap kolom ada di `lib/urut.ts` (dipakai bersama header tabel).
 */
const KOLOM_URUT: Record<string, string> = {
  nama: 'p.nama_lengkap',
  nip: 'p.nip',
  jabatan: 'j.nama_jabatan',
  eselon: "FIELD(j.eselon,'I','II','III','IV','NON_ESELON')",
  unit: 'u.nama_unit',
  pangkat: 'p.pangkat',
  golongan: 'p.golongan',
  jenjang: 'j.jenjang',
  jenisAsesmen: 'a.jenis_asesmen',
  potkom: 'a.potkom',
  integritas: 'a.nilai_integritas',
  predikat: "FIELD(a.rating_kinerja,'Sangat Baik','Baik','Butuh Perbaikan','Kurang','Sangat Kurang')",
  kotak9: 'a.kotak_9',
  talenta: 'a.nilai_talenta',
}

export const UKURAN_HALAMAN_DIREKTORI = 25

export interface FilterDirektori {
  cari?: string
  unitId?: number
  /**
   * Satu jabatan tertentu — dipakai tautan dari pohon organisasi
   * (`/master/unit`), yang memajang jumlah penghuni per jabatan.
   *
   * Tidak punya kontrol di toolbar penyaring, dan itu disengaja: ia bukan
   * penyaring yang dipilih orang dari daftar melainkan tujuan sebuah tautan.
   * Tombol Reset melakukan `router.push(pathname)` sehingga membersihkan seluruh
   * parameter termasuk yang ini — tanpa itu, penyaring tanpa kontrol akan jadi
   * keadaan yang tidak bisa dikeluarkan pengguna.
   */
  jabatanId?: number
  /**
   * Batas unit yang WAJIB, dari peran pengguna (`lib/lingkup.ts`) — bukan
   * pilihan yang bisa dihapus dari URL.
   *
   * Dipasang **berdampingan** dengan `unitId`, bukan menggantikannya: dua
   * klausa unit menghasilkan irisan dengan sendirinya, sehingga Pengelola Unit
   * yang mengetik `?unit=` milik unit lain mendapat nol baris — bukan diam-diam
   * dialihkan ke unitnya sendiri, yang akan membuatnya mengira sedang melihat
   * unit yang ia minta.
   */
  unitWajib?: number | null
  eselon?: string
  jenjang?: string
  /**
   * Rumpun jabatan — penyaring KASAR "kepala balai", bukan "kepala balai apa".
   *
   * Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 4):
   * penyaring yang sama tersedia di setiap modul yang memajang kandidat, dan
   * **bawaannya tidak menyaring**. Aturannya di `lib/kueri/rumpun.ts`; rumpun
   * yang tidak dikenali diabaikan, bukan menghasilkan nol baris.
   */
  rumpun?: string
  tingkatPendidikan?: string
  kotak9?: number
  statusAsesmen?: string
  urut?: string
  arah?: 'asc' | 'desc'
  halaman?: number
}

export interface BarisDirektori {
  pegawaiId: number
  nip: string
  nama: string
  namaJabatan: string | null
  eselon: Eselon | null
  namaUnit: string | null
  pangkat: string
  golongan: string | null
  jenjang: string | null
  jenisAsesmen: string | null
  potkom: number | null
  /** Skala 0–100, rubrik Integritas & Moralitas (phase.md §2.7). */
  nilaiIntegritas: number | null
  predikatKinerja: string | null
  kotak9: Kotak9 | null
  tahunAsesmen: number | null
  statusAsesmen: string | null
  usia: number | null
  /**
   * Kode catatan (HDS/HDB/TBTL/TBS) — dipakai MENANDAI barisnya, bukan menilai.
   *
   * `keterangan` ikut supaya penandanya bisa dijawab dari `title` baris tanpa
   * membuka profilnya; warna sendirian tidak terbaca pembaca layar maupun pengguna
   * CVD.
   */
  catatanKategori: KategoriCatatan | null
  catatanKeterangan: string | null
}

/** Susun klausa WHERE + parameternya dari filter. */
function bangunFilter(
  f: FilterDirektori,
  rumpun: { sql: string; params: string[] },
): { where: string; params: unknown[] } {
  const syarat: string[] = []
  const params: unknown[] = []

  // Diselesaikan pemanggilnya (butuh kueri master jabatan), disisipkan di sini
  // supaya daftar dan penghitung halamannya tidak bisa memakai penyaring berbeda.
  if (rumpun.sql !== '') {
    syarat.push(rumpun.sql.replace(/^ AND /, ''))
    params.push(...rumpun.params)
  }

  if (f.cari && f.cari.trim() !== '') {
    // Cari di nama ATAU NIP. NIP dibersihkan dari spasi supaya "19780525 1998"
    // tetap cocok dengan NIP tersimpan.
    const q = `%${f.cari.trim()}%`
    syarat.push('(p.nama_lengkap LIKE ? OR p.nip LIKE ?)')
    params.push(q, q.replace(/\s/g, ''))
  }
  if (f.unitId !== undefined) {
    // Termasuk seluruh unit di bawahnya, berapa pun kedalamannya. Versi
    // sebelumnya menuliskan tiga level secara manual — begitu ada unit di level
    // keempat, pegawainya diam-diam hilang dari hasil filter.
    syarat.push(`u.id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(f.unitId)
  }
  if (f.unitWajib !== undefined && f.unitWajib !== null) {
    syarat.push(`u.id IN (${SUBKUERI_UNIT_TURUNAN})`)
    params.push(f.unitWajib)
  }
  if (f.jabatanId !== undefined) {
    syarat.push('j.id = ?')
    params.push(f.jabatanId)
  }
  if (f.eselon) {
    syarat.push('j.eselon = ?')
    params.push(f.eselon)
  }
  if (f.jenjang) {
    syarat.push('j.jenjang = ?')
    params.push(f.jenjang)
  }
  if (f.tingkatPendidikan) {
    syarat.push('p.tingkat_pendidikan = ?')
    params.push(f.tingkatPendidikan)
  }
  if (f.kotak9 !== undefined) {
    syarat.push('a.kotak_9 = ?')
    params.push(f.kotak9)
  }
  if (f.statusAsesmen) {
    if (f.statusAsesmen === 'TANPA_ASESMEN') syarat.push('a.id IS NULL')
    else {
      syarat.push('a.status_asesmen = ?')
      params.push(f.statusAsesmen)
    }
  }

  // Batas populasi eksperimen (lihat filterSumber di ./dasar). Ditaruh DI SINI,
  // di pembangun `where`, supaya daftar direktori dan penghitung halamannya tidak
  // bisa memakai populasi berbeda — keduanya memakai `where` yang sama.
  const batas = filterSumber('p')
  if (batas) syarat.push(batas.replace(/^ AND /, ''))

  return { where: syarat.length > 0 ? `WHERE ${syarat.join(' AND ')}` : '', params }
}

export async function ambilDirektori(f: FilterDirektori): Promise<{
  baris: BarisDirektori[]
  total: number
  halaman: number
  ukuranHalaman: number
}> {
  const { where, params } = bangunFilter(f, await klausaRumpun('j.nama_jabatan', f.rumpun))

  const kunciUrut = f.urut && KOLOM_URUT[f.urut] ? f.urut : 'nama'
  const kolomUrut = KOLOM_URUT[kunciUrut]!
  // Tanpa `?arah=` eksplisit, pakai arah bawaan kolomnya (lib/urut.ts).
  const arah = (f.arah ?? arahBawaanUrut(kunciUrut)) === 'asc' ? 'ASC' : 'DESC'
  const halaman = Math.max(1, f.halaman ?? 1)
  const offset = (halaman - 1) * UKURAN_HALAMAN_DIREKTORI

  const dasar = `
    ${CTE_ASESMEN_TERBARU}
    SELECT p.id, p.nip, p.nama_lengkap, p.golongan, p.pangkat,
           j.nama_jabatan, j.eselon, j.jenjang, u.nama_unit,
           a.jenis_asesmen, a.potkom, a.nilai_integritas, a.rating_kinerja,
           a.kotak_9, a.tahun_asesmen, a.status_asesmen, a.id AS asesmen_id,
           p.catatan_kategori, p.catatan_keterangan
    FROM pegawai p
    LEFT JOIN jabatan j ON j.id = p.jabatan_id
    LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
    LEFT JOIN asesmen_terbaru a ON a.pegawai_id = p.id
    ${where}
  `

  const [baris, hitung] = await Promise.all([
    kueri<Record<string, unknown>>(
      // NULL selalu di belakang supaya pegawai tanpa asesmen tidak menyumbat
      // halaman pertama saat mengurutkan berdasarkan skor.
      `${dasar} ORDER BY (${kolomUrut} IS NULL), ${kolomUrut} ${arah}, p.nama_lengkap ASC
       LIMIT ? OFFSET ?`,
      [...params, UKURAN_HALAMAN_DIREKTORI, offset],
    ),
    kueriSatu<{ n: number }>(
      `${CTE_ASESMEN_TERBARU}
       SELECT COUNT(*) AS n
       FROM pegawai p
       LEFT JOIN jabatan j ON j.id = p.jabatan_id
       LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
       LEFT JOIN asesmen_terbaru a ON a.pegawai_id = p.id
       ${where}`,
      params,
    ),
  ])

  const sekarang = new Date()

  return {
    baris: baris.map((r) => {
      const nip = String(r.nip)
      const terurai = parseNip(nip, sekarang)
      return {
        pegawaiId: Number(r.id),
        nip,
        nama: String(r.nama_lengkap),
        namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
        eselon: r.eselon === null ? null : (String(r.eselon) as Eselon),
        namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
        pangkat: String(r.pangkat),
        golongan: normalisasiGolongan(r.golongan as string),
        jenjang: r.jenjang === null ? null : String(r.jenjang),
        jenisAsesmen: r.jenis_asesmen === null ? null : String(r.jenis_asesmen),
        potkom: angka(r.potkom as string),
        nilaiIntegritas: angka(r.nilai_integritas as string),
        predikatKinerja: r.rating_kinerja === null ? null : String(r.rating_kinerja),
        kotak9: r.kotak_9 === null ? null : (Number(r.kotak_9) as Kotak9),
        tahunAsesmen: angka(r.tahun_asesmen as number),
        statusAsesmen: r.status_asesmen === null ? null : String(r.status_asesmen),
        usia: hitungUsia(terurai.tanggalLahir, sekarang),
        catatanKategori:
          r.catatan_kategori !== null && adalahKategoriCatatan(String(r.catatan_kategori))
            ? (String(r.catatan_kategori) as KategoriCatatan)
            : null,
        catatanKeterangan:
          r.catatan_keterangan === null ? null : String(r.catatan_keterangan),
      }
    }),
    total: angkaWajib(hitung?.n),
    halaman,
    ukuranHalaman: UKURAN_HALAMAN_DIREKTORI,
  }
}

/**
 * Opsi isi dropdown filter — diturunkan dari data yang benar-benar ada, **dan
 * dari populasi yang benar-benar DITAMPILKAN.**
 *
 * Keduanya perlu. Menurunkannya dari data saja sudah menghindari daftar tetap
 * yang memuat unit tanpa pegawai, tapi begitu tampilan disaring
 * (`HANYA_PEGAWAI_SUMBER`), opsi yang lahir dari populasi penuh menghasilkan
 * pilihan yang menjawab nol baris — terukur: 21 unit terdaftar sementara hanya
 * 3 yang punya pegawai yang ditampilkan, dan memilih yang pertama memberi tabel
 * kosong tanpa penjelasan. Itu klik mati yang dilarang phase.md §5.2, dan
 * bentuknya paling menyesatkan: filternya seolah rusak, padahal datanya memang
 * tidak ada.
 */
export interface OpsiFilter {
  unit: Array<{ id: number; nama: string; level: number }>
  eselon: string[]
  jenjang: string[]
  tingkatPendidikan: string[]
  /**
   * Nomor kotak yang BENAR-BENAR terisi, urut menurun.
   *
   * Sebelumnya daftar tetap 1–9 di komponen filternya. Pada data sekarang hanya
   * Kotak 7 & 9 berisi, jadi tujuh opsi lain menjawab nol baris — terukur, dan
   * satu-satunya opsi mati yang tersisa setelah opsi lain dibuat dinamis.
   */
  kotak9: number[]
  /**
   * Status asesmen yang benar-benar ada pada populasi yang ditampilkan.
   * `TANPA_ASESMEN` ikut ditawarkan HANYA kalau memang ada yang belum diases —
   * di bawah filter populasi jumlahnya nol, jadi menawarkannya berarti opsi yang
   * pasti menjawab nol baris.
   */
  statusAsesmen: string[]
  /**
   * Rumpun jabatan (`Detail Revisi PUPR 1_9_2026.pdf`, butir 4) — penyaring kasar
   * yang bawaannya TIDAK menyaring. Aturannya di `lib/kueri/rumpun.ts`.
   */
  rumpun: OpsiRumpun[]
}

export async function ambilOpsiFilter(): Promise<OpsiFilter> {
  const [unit, eselon, jenjang, pendidikan, kotak, status, rumpun] = await Promise.all([
    kueri<Record<string, unknown>>(
      `SELECT u.id, u.nama_unit,
              CASE WHEN u.parent_id IS NULL THEN 0
                   WHEN (SELECT p2.parent_id FROM unit_organisasi p2 WHERE p2.id = u.parent_id) IS NULL THEN 1
                   ELSE 2 END AS level
       FROM unit_organisasi u
       WHERE EXISTS (
         SELECT 1 FROM jabatan j JOIN pegawai p ON p.jabatan_id = j.id
         WHERE j.unit_organisasi_id = u.id ${filterSumber('p')}
       )
       ORDER BY level, u.nama_unit`,
    ),
    kueri<{ eselon: string }>(
      `SELECT DISTINCT j.eselon FROM jabatan j JOIN pegawai p ON p.jabatan_id = j.id
       WHERE 1=1 ${filterSumber('p')}
       ORDER BY FIELD(j.eselon,'I','II','III','IV','NON_ESELON')`,
    ),
    kueri<{ jenjang: string }>(
      `SELECT DISTINCT j.jenjang FROM jabatan j JOIN pegawai p ON p.jabatan_id = j.id
       WHERE 1=1 ${filterSumber('p')}
       ORDER BY j.jenjang`,
    ),
    kueri<{ tingkat_pendidikan: string }>(
      `SELECT DISTINCT p.tingkat_pendidikan FROM pegawai p
       WHERE 1=1 ${filterSumber('p')}
       ORDER BY FIELD(p.tingkat_pendidikan,'S3','S2','S1_D4','D3','SLTA')`,
    ),
    kueri<{ kotak_9: number }>(
      `${CTE_ASESMEN_TERBARU}
       SELECT DISTINCT a.kotak_9 FROM asesmen_terbaru a
         JOIN pegawai p ON p.id = a.pegawai_id
        WHERE 1=1 ${filterSumber('p')}
        ORDER BY a.kotak_9 DESC`,
    ),
    kueri<{ status: string }>(
      `${CTE_ASESMEN_TERBARU}
       SELECT DISTINCT a.status_asesmen AS status FROM asesmen_terbaru a
         JOIN pegawai p ON p.id = a.pegawai_id
        WHERE 1=1 ${filterSumber('p')}
       UNION
       SELECT 'TANPA_ASESMEN' FROM pegawai p
        WHERE NOT EXISTS (SELECT 1 FROM asesmen_talenta a2 WHERE a2.pegawai_id = p.id)
          ${filterSumber('p')}
        LIMIT 5`,
    ),
    ambilOpsiRumpun(null),
  ])

  return {
    unit: unit.map((u) => ({
      id: Number(u.id),
      nama: String(u.nama_unit),
      level: Number(u.level),
    })),
    eselon: eselon.map((e) => String(e.eselon)),
    jenjang: jenjang.map((j) => String(j.jenjang)),
    tingkatPendidikan: pendidikan.map((p) => String(p.tingkat_pendidikan)),
    kotak9: kotak.map((k) => Number(k.kotak_9)),
    statusAsesmen: status.map((r) => String(r.status)),
    rumpun,
  }
}

// ---------------------------------------------------------------------------
// Profil Talenta 360°
// ---------------------------------------------------------------------------

export interface ProfilPegawai {
  pegawaiId: number
  nip: string
  nama: string
  golongan: string | null
  pangkat: string
  tmtGolongan: string | null
  tmtJabatan: string | null
  namaJabatan: string | null
  /**
   * Id jabatan master. Dibutuhkan **formulir ubah identitas** untuk memilih
   * nilai yang sedang berlaku. Tanpa kolom ini pemilihnya terbuka dalam keadaan
   * "tidak diisi", dan menyimpan tanpa menyentuhnya akan **mengosongkan
   * `jabatan_id`** pegawai itu — kehilangan data yang tidak memunculkan galat
   * apa pun, dan baru terlihat sebagai jabatan yang mendadak hilang dari
   * direktori.
   */
  jabatanId: number | null
  jenisJabatan: 'STRUKTURAL' | 'FUNGSIONAL_TERTENTU' | 'FUNGSIONAL_UMUM' | null
  jenjang: string | null
  eselon: Eselon | null
  namaUnit: string | null
  unitInduk: string | null
  sekolahTerakhir: string | null
  bidangStudiTerakhir: string | null
  tingkatPendidikan: TingkatPendidikan
  statusAktif: string
  sumberSinkron: string
  riwayatDiklat: string[]
  /** Turunan dari NIP — tidak ada kolomnya di DB (phase.md §3 K-6). */
  tanggalLahir: Date | null
  usia: number | null
  jenisKelamin: 'L' | 'P' | null
  tmtCpns: { tahun: number; bulan: number } | null
  masaKerjaTahun: number | null
  nipValid: boolean
  masalahNip: string[]
  batasUsiaPensiun: number
  tanggalPensiun: Date | null
  tahunKePensiun: number | null
  segeraPensiun: boolean
  lamaMenjabatTahun: number | null
  /**
   * Jejak pemeriksaan rekam jejak disiplin (`doc/sql/020`). `null` = **belum pernah
   * diperiksa**, yang berbeda dari "diperiksa dan hasilnya bersih".
   *
   * Pembedaan itu seluruh gunanya kolom ini: mesin skor sudah memberi 100 untuk
   * ketiadaan catatan, jadi tanpa jejak ini profil tidak bisa menyatakan apakah
   * angka itu pernah diperiksa siapa pun — padahal 15% match score bergantung
   * padanya.
   */
  hukdisVerifikasi: { olehNama: string | null; pada: Date | null; catatan: string | null } | null

  /**
   * Kotak CATATAN berkategori (`2 sept- masukan sistem informasi.pdf` butir 1).
   *
   * Terpisah dari `hukdisVerifikasi` walau keduanya duduk di panel yang sama:
   * yang satu menyatakan sebuah pemeriksaan pernah dilakukan, yang ini menandai
   * sesuatu yang perlu dilihat lagi. Digabung, mengisi salah satunya akan terbaca
   * seperti menjawab yang lain.
   */
  catatan: {
    kategori: KategoriCatatan
    keterangan: string | null
    olehNama: string | null
    pada: Date | null
  } | null
}

/**
 * Profil satu pegawai.
 *
 * `unitWajib` menegakkan pembatasan data per unit **di dalam kueri**, bukan
 * dengan memeriksa hasilnya setelah terambil. Bedanya bukan gaya: memeriksa
 * setelahnya berarti barisnya sempat ada di memori proses, dan cara paling
 * mudah agar ia bocor adalah seseorang menambahkan satu `console.log` atau
 * satu prop ke komponen. Yang tidak pernah terbaca tidak bisa bocor.
 *
 * Pegawai di luar lingkup mengembalikan `null` — halaman memperlakukannya
 * sama dengan NIP yang tidak ada. Itu disengaja: pesan "ada tapi Anda tidak
 * boleh" mengonfirmasi keberadaan orangnya kepada yang tidak berhak tahu.
 */
/**
 * Profil satu pegawai. Ikut filter populasi, dan pegawai di luarnya dijawab
 * **`null`** — sama dengan pegawai yang tidak ada, bukan "akses ditolak".
 *
 * Alasannya: daftar pegawai sudah disaring, jadi tanpa ini satu-satunya cara
 * masuk ke 33 profil yang lain tetap terbuka lewat mengetikkan NIP di URL —
 * dan halaman itu memuat data ASN paling lengkap di aplikasi ini. Pola jawaban
 * "tidak ada" mengikuti pembatasan unit di Fase 7: pesan yang membedakan "orang
 * itu ada tapi Anda tidak boleh melihatnya" dari "orang itu tidak ada" membuat
 * URL bisa dipakai menebak keberadaan orang.
 */
export async function ambilProfil(
  nip: string,
  unitWajib?: number | null,
): Promise<ProfilPegawai | null> {
  const batasUnit =
    unitWajib !== undefined && unitWajib !== null
      ? ` AND u.id IN (${SUBKUERI_UNIT_TURUNAN})`
      : ''
  const r = await kueriSatu<Record<string, unknown>>(
    `SELECT p.*, j.nama_jabatan, j.jenis_jabatan, j.jenjang, j.eselon,
            u.nama_unit, ui.nama_unit AS unit_induk,
            vhd.nama AS hukdis_verifikator, vct.nama AS catatan_penulis
     FROM pegawai p
     LEFT JOIN jabatan j ON j.id = p.jabatan_id
     LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     LEFT JOIN unit_organisasi ui ON ui.id = u.parent_id
     LEFT JOIN users vhd ON vhd.id = p.hukdis_diverifikasi_oleh
     LEFT JOIN users vct ON vct.id = p.catatan_oleh
     WHERE p.nip = ?${batasUnit}${filterSumber('p')}`,
    batasUnit === '' ? [nip] : [nip, unitWajib],
  )
  if (!r) return null

  const sekarang = new Date()
  const terurai = parseNip(String(r.nip), sekarang)
  const jenisJabatan = r.jenis_jabatan === null ? null : (String(r.jenis_jabatan) as ProfilPegawai['jenisJabatan'])
  const jenjang = r.jenjang === null ? null : String(r.jenjang)
  const pensiun = proyeksiPensiun(terurai.tanggalLahir, jenisJabatan, jenjang, sekarang)

  const diklatMentah = r.riwayat_diklat
  const riwayatDiklat: string[] = Array.isArray(diklatMentah)
    ? diklatMentah.map(String)
    : typeof diklatMentah === 'string'
      ? (JSON.parse(diklatMentah) as string[])
      : []

  const tmtJabatan = r.tmt_jabatan ? new Date(String(r.tmt_jabatan)) : null
  const tmtCpns =
    terurai.tmtCpnsTahun !== null && terurai.tmtCpnsBulan !== null
      ? { tahun: terurai.tmtCpnsTahun, bulan: terurai.tmtCpnsBulan }
      : null

  return {
    pegawaiId: Number(r.id),
    nip: String(r.nip),
    nama: String(r.nama_lengkap),
    golongan: normalisasiGolongan(r.golongan as string),
    pangkat: String(r.pangkat),
    tmtGolongan: r.tmt_golongan ? String(r.tmt_golongan) : null,
    tmtJabatan: r.tmt_jabatan ? String(r.tmt_jabatan) : null,
    namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
    jabatanId: r.jabatan_id === null || r.jabatan_id === undefined ? null : Number(r.jabatan_id),
    jenisJabatan,
    jenjang,
    eselon: r.eselon === null ? null : (String(r.eselon) as Eselon),
    namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
    unitInduk: r.unit_induk === null ? null : String(r.unit_induk),
    sekolahTerakhir: r.sekolah_terakhir === null ? null : String(r.sekolah_terakhir),
    bidangStudiTerakhir:
      r.bidang_studi_terakhir === null ? null : String(r.bidang_studi_terakhir),
    tingkatPendidikan: String(r.tingkat_pendidikan) as TingkatPendidikan,
    statusAktif: String(r.status_aktif),
    sumberSinkron: String(r.sumber_sinkron),
    riwayatDiklat,
    tanggalLahir: terurai.tanggalLahir,
    usia: hitungUsia(terurai.tanggalLahir, sekarang),
    jenisKelamin: terurai.jenisKelamin,
    tmtCpns,
    masaKerjaTahun:
      tmtCpns === null
        ? null
        : selisihTahun(new Date(tmtCpns.tahun, tmtCpns.bulan - 1, 1, 12), sekarang),
    nipValid: terurai.valid,
    masalahNip: terurai.masalah,
    batasUsiaPensiun: pensiun.batasUsia,
    tanggalPensiun: pensiun.tanggalPensiun,
    tahunKePensiun: pensiun.tahunTersisa,
    segeraPensiun: pensiun.segeraPensiun,
    lamaMenjabatTahun: selisihTahun(tmtJabatan, sekarang),
    /*
      `pada` yang jadi penanda "sudah diperiksa", bukan `oleh`: FK-nya
      `ON DELETE SET NULL`, jadi pengguna yang dihapus akan mengosongkan `oleh`
      sementara pemeriksaannya memang pernah terjadi. Membaca `oleh` sebagai
      penanda berarti verifikasi hilang begitu akun pemeriksanya ditutup.
    */
    hukdisVerifikasi:
      r.hukdis_diverifikasi_pada === null || r.hukdis_diverifikasi_pada === undefined
        ? null
        : {
            olehNama: r.hukdis_verifikator === null ? null : String(r.hukdis_verifikator),
            pada: new Date(String(r.hukdis_diverifikasi_pada)),
            catatan:
              r.hukdis_catatan_verifikasi === null ? null : String(r.hukdis_catatan_verifikasi),
          },

    /*
      Penandanya `catatan_kategori`, BUKAN `catatan_pada` seperti pada verifikasi
      hukdis — dan bedanya beralasan: di sana yang dicatat peristiwa "pernah
      diperiksa" sehingga waktunya yang menentukan, di sini yang dicatat KODENYA.
      Kode kosong berarti tidak ada catatan, apa pun isi kolom waktunya.
    */
    catatan:
      r.catatan_kategori === null ||
      r.catatan_kategori === undefined ||
      !adalahKategoriCatatan(String(r.catatan_kategori))
        ? null
        : {
            kategori: String(r.catatan_kategori) as KategoriCatatan,
            keterangan: r.catatan_keterangan === null ? null : String(r.catatan_keterangan),
            olehNama: r.catatan_penulis === null ? null : String(r.catatan_penulis),
            pada: r.catatan_pada === null ? null : new Date(String(r.catatan_pada)),
          },
  }
}

export interface RiwayatJabatanProfil {
  /**
   * Kunci baris — dipakai tombol "Ubah" di profil untuk menunjuk baris mana yang
   * disunting. Tanpa ini formulirnya hanya bisa MENAMBAH.
   */
  id: number
  urutan: number
  namaMentah: string
  terpetakan: boolean
  /** Nilai KOLOM `jabatan_id`/`jenis_penugasan`/`unit_kerja_mentah` apa adanya —
   *  dibutuhkan formulir ubah supaya membuka dialog tidak mengosongkan ketiganya.
   *  `nonDefinitif` di bawah BUKAN penggantinya: ia hasil pembacaan teks jabatan
   *  ("Plt. Kepala …"), bukan isi kolomnya. */
  jabatanId: number | null
  jenisPenugasan: 'DEFINITIF' | 'PLT' | 'PLH' | null
  unitKerjaMentah: string | null
  namaJabatan: string | null
  jenjang: string | null
  eselon: string | null
  namaUnit: string | null
  tanggalMulai: string | null
  tanggalAkhir: string | null
  lamaTahun: number | null
  /**
   * Isi kolom `lama_bulan` APA ADANYA — nilai awal bidang "Lama menjabat (bulan)"
   * di dialog ubah. `lamaTahun` bukan penggantinya: ia sudah dibulatkan ke tahun
   * dan bisa berasal dari tanggal, jadi memakainya sebagai nilai awal akan
   * menuliskan ulang durasi yang tidak pernah diisi siapa pun.
   */
  lamaBulan: number | null
  /**
   * Dari mana `lamaTahun` datang. Dibedakan supaya profil tidak memajang angka
   * turunan tanggal dan angka isian sumber sebagai hal yang sama: yang pertama
   * bisa diperiksa terhadap SK-nya, yang kedua hanya bisa dipercayai.
   *
   * `null` = lamanya tidak diketahui.
   */
  sumberLama: 'TANGGAL' | 'DURASI' | null
  noSk: string | null
  /** Penugasan non-definitif (Plt/Plh) — input sub-indikator Substansi. */
  nonDefinitif: 'Plt' | 'Plh' | null
}

export async function ambilRiwayatJabatan(pegawaiId: number): Promise<RiwayatJabatanProfil[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT r.id, r.urutan, r.jabatan_nama_mentah, r.jabatan_id, r.jenis_penugasan,
            r.unit_kerja_mentah, r.tanggal_mulai, r.tanggal_akhir, r.lama_bulan,
            r.no_sk, j.nama_jabatan, j.jenjang, j.eselon, u.nama_unit
     FROM riwayat_jabatan r
     LEFT JOIN jabatan j ON j.id = r.jabatan_id
     LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
     WHERE r.pegawai_id = ?
     ORDER BY r.urutan`,
    [pegawaiId],
  )

  const sekarang = new Date()
  return baris.map((r) => {
    const teks = String(r.jabatan_nama_mentah)
    const mulai = r.tanggal_mulai ? new Date(String(r.tanggal_mulai)) : null
    const akhir = r.tanggal_akhir ? new Date(String(r.tanggal_akhir)) : null
    return {
      id: Number(r.id),
      urutan: Number(r.urutan),
      jabatanId: r.jabatan_id === null ? null : Number(r.jabatan_id),
      jenisPenugasan:
        r.jenis_penugasan === null
          ? null
          : (String(r.jenis_penugasan) as 'DEFINITIF' | 'PLT' | 'PLH'),
      unitKerjaMentah: r.unit_kerja_mentah === null ? null : String(r.unit_kerja_mentah),
      namaMentah: teks,
      terpetakan: r.jabatan_id !== null,
      namaJabatan: r.nama_jabatan === null ? null : String(r.nama_jabatan),
      jenjang: r.jenjang === null ? null : String(r.jenjang),
      eselon: r.eselon === null ? null : String(r.eselon),
      namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
      tanggalMulai: r.tanggal_mulai ? String(r.tanggal_mulai) : null,
      tanggalAkhir: r.tanggal_akhir ? String(r.tanggal_akhir) : null,
      /*
        Tanggal lebih dulu, durasi sebagai cadangan — urutan yang sama dengan
        `nilaiLamaJabatan()`. Terbalik, profil dan skor bisa menyebut lama yang
        berbeda untuk baris yang sama, dan selisihnya tidak akan pernah dijelaskan
        halaman mana pun (terukur ada: sumber menyebut 2 tahun 7 bulan sementara
        tanggalnya menyiratkan 1,1 tahun).
      */
      lamaBulan: r.lama_bulan === null ? null : Number(r.lama_bulan),
      lamaTahun: selisihTahun(mulai, akhir ?? sekarang) ?? bulanKeTahun(r.lama_bulan as number | null),
      sumberLama:
        selisihTahun(mulai, akhir ?? sekarang) !== null
          ? 'TANGGAL'
          : r.lama_bulan === null
            ? null
            : 'DURASI',
      noSk: r.no_sk === null ? null : String(r.no_sk),
      nonDefinitif: /\b(plt|pelaksana tugas)\b/i.test(teks)
        ? 'Plt'
        : /\b(plh|pelaksana harian)\b/i.test(teks)
          ? 'Plh'
          : null,
    }
  })
}

export interface RiwayatPendidikanProfil {
  /**
   * Kunci baris — dipakai tombol "Ubah" di profil untuk menunjuk baris mana yang
   * disunting. Tanpa ini formulirnya hanya bisa MENAMBAH.
   */
  id: number
  urutan: number
  jenjang: string
  bidangStudi: string
  namaSekolah: string | null
  tahunLulus: number | null
  urlIjazah: string | null
  urlTranskrip: string | null
  noPertekBkn: string | null
}

export async function ambilRiwayatPendidikan(
  pegawaiId: number,
): Promise<RiwayatPendidikanProfil[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT id, urutan, jenjang_pendidikan, bidang_studi, nama_sekolah, tahun_lulus,
            url_ijazah, url_transkrip, no_pertek_bkn
     FROM riwayat_pendidikan WHERE pegawai_id = ?
     ORDER BY FIELD(jenjang_pendidikan,'S3','S2','S1_D4','D3','SLTA'), urutan`,
    [pegawaiId],
  )

  return baris.map((r) => ({
    id: Number(r.id),
    urutan: Number(r.urutan),
    jenjang: String(r.jenjang_pendidikan),
    bidangStudi: String(r.bidang_studi),
    namaSekolah: r.nama_sekolah === null ? null : String(r.nama_sekolah),
    tahunLulus: angka(r.tahun_lulus as number),
    urlIjazah: r.url_ijazah === null ? null : String(r.url_ijazah),
    urlTranskrip: r.url_transkrip === null ? null : String(r.url_transkrip),
    noPertekBkn: r.no_pertek_bkn === null ? null : String(r.no_pertek_bkn),
  }))
}

export interface AsesmenProfil {
  /**
   * Kunci baris — dipakai tombol "Ubah" di profil untuk menunjuk baris mana yang
   * disunting. Tanpa ini formulirnya hanya bisa MENAMBAH.
   */
  id: number
  tahunAsesmen: number
  jenisAsesmen: string
  /**
   * Jenjang tempat asesmen ini dinilai (doc/sql/022). `null` untuk baris yang
   * masuk sebelum kolomnya ada — bukan "tidak berjenjang", melainkan tidak
   * tercatat, dan UI menuliskannya begitu.
   */
  jenjangAsesmen: string | null
  /** Baris inilah yang dipakai menilai pegawai ini (`asesmen_dipakai`). */
  dipakai: boolean
  statusAsesmen: string
  nilaiKinerjaY: number
  nilaiPotensialX: number
  potkom: number
  nilaiIntegritas: number | null
  /** Tahun kinerja yang dirujuk asesmen ini — dibutuhkan formulir ubah. */
  tahunKinerja: number | null
  nilaiTalenta: number
  kotak9: Kotak9
  predikatKinerja: string
}

export async function ambilRiwayatAsesmen(pegawaiId: number): Promise<AsesmenProfil[]> {
  const baris = await kueri<Record<string, unknown>>(
    /*
      Diurutkan dengan aturan yang SAMA dengan `urutAsesmenBerlaku()`, jadi baris
      yang benar-benar dipakai selalu di puncak. `terbaru = asesmen[0]` di
      halaman profil bergantung pada itu: kalau daftarnya diurut berbeda, ringkasan
      di kepala panel akan menyebut asesmen yang BUKAN yang dipakai menilai — dua
      angka berbeda di satu halaman, tanpa ada yang menjelaskan selisihnya.
    */
    `SELECT a.id, a.tahun_asesmen, a.jenis_asesmen, a.jenjang_asesmen, a.status_asesmen,
            a.nilai_kinerja_y, a.nilai_potensial_x, a.potkom, a.nilai_integritas,
            a.nilai_talenta, a.kotak_9, a.tahun_kinerja, a.rating_kinerja,
            EXISTS (SELECT 1 FROM asesmen_dipakai d WHERE d.asesmen_id = a.id) AS dipakai
     FROM asesmen_talenta a WHERE a.pegawai_id = ?
     ORDER BY ${urutAsesmenBerlaku('a')}`,
    [pegawaiId],
  )

  return baris.map((r) => ({
    id: Number(r.id),
    tahunAsesmen: Number(r.tahun_asesmen),
    jenisAsesmen: String(r.jenis_asesmen),
    jenjangAsesmen: r.jenjang_asesmen === null ? null : String(r.jenjang_asesmen),
    dipakai: Number(r.dipakai) === 1,
    statusAsesmen: String(r.status_asesmen),
    nilaiKinerjaY: angkaWajib(r.nilai_kinerja_y as string),
    nilaiPotensialX: angkaWajib(r.nilai_potensial_x as string),
    potkom: angkaWajib(r.potkom as string),
    nilaiIntegritas: angka(r.nilai_integritas as string),
    tahunKinerja: angka(r.tahun_kinerja as number),
    nilaiTalenta: angkaWajib(r.nilai_talenta as string),
    kotak9: Number(r.kotak_9) as Kotak9,
    predikatKinerja: String(r.rating_kinerja),
  }))
}

export interface KinerjaProfil {
  /**
   * Kunci baris — dipakai tombol "Ubah" di profil untuk menunjuk baris mana yang
   * disunting. Tanpa ini formulirnya hanya bisa MENAMBAH.
   */
  id: number
  tahun: number
  periode: string
  nilaiKinerja: number | null
  nilaiPerilaku: number | null
  predikat: string
  /**
   * Asal baris ini — dipakai panel profil untuk MENYEBUT sumbernya dengan benar.
   *
   * Sebelumnya panel itu memaku kalimat "nilai granular dari e-Kinerja". Sejak
   * baris TAHUNAN diisi dari predikat Excel (24 Agu 2026) kalimat itu jadi tidak
   * benar: angkanya skor predikat, bukan pengukuran granular, dan sumbernya
   * bukan e-Kinerja. Deskripsi yang salah menyebut sumber lebih berbahaya
   * daripada tidak menyebut apa pun — ia membuat orang percaya integrasi yang
   * belum ada.
   */
  sumberSync: string
}

export async function ambilKinerja(pegawaiId: number): Promise<KinerjaProfil[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT id, tahun, periode_skp, nilai_kinerja, nilai_perilaku, predikat, sumber_sync
     FROM kinerja_periode WHERE pegawai_id = ?
     ORDER BY tahun DESC, FIELD(periode_skp,'TW1','TW2','TW3','TAHUNAN')`,
    [pegawaiId],
  )
  return baris.map((r) => ({
    id: Number(r.id),
    tahun: Number(r.tahun),
    periode: String(r.periode_skp),
    nilaiKinerja: angka(r.nilai_kinerja as string),
    nilaiPerilaku: angka(r.nilai_perilaku as string),
    predikat: String(r.predikat),
    sumberSync: String(r.sumber_sync ?? ''),
  }))
}

export interface HukumanProfil {
  tingkatHukuman: string
  tanggalSk: string | null
  noSk: string | null
  keterangan: string | null
  statusAktif: boolean
}

export async function ambilHukumanDisiplin(pegawaiId: number): Promise<HukumanProfil[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT tingkat_hukuman, tanggal_sk, no_sk, keterangan, status_aktif
     FROM hukuman_disiplin WHERE pegawai_id = ?
     ORDER BY status_aktif DESC, tanggal_sk DESC`,
    [pegawaiId],
  )
  return baris.map((r) => ({
    tingkatHukuman: String(r.tingkat_hukuman),
    tanggalSk: r.tanggal_sk ? String(r.tanggal_sk) : null,
    noSk: r.no_sk === null ? null : String(r.no_sk),
    keterangan: r.keterangan === null ? null : String(r.keterangan),
    statusAktif: Number(r.status_aktif) === 1,
  }))
}

/** Satu pilihan rubrik: nama kategori + nilainya (mis. "…lintas Unit Organisasi" → 100). */
export interface KategoriRubrik {
  nama: string
  nilai: number | null
  /** Terisi kalau kategorinya memakai AMBANG angka, bukan nama (mis. Potkom). */
  ambangMin: number | null
}

export interface RincianIndikator {
  /** Dibutuhkan untuk menyimpan nilai manual indikator ini. */
  rubrikIndikatorId: number
  modeSkor: 'KATEGORI_TETAP' | 'NILAI_LANGSUNG'
  /**
   * Kategori rubrik indikator ini, apa adanya dari `rubrik_kategori_skor`.
   *
   * Diambil dari DB, **bukan** ditulis ulang dari `doc/KERANGKA TALENT POOL.md`.
   * Rubrik bisa disunting pengguna lewat editor rubrik; daftar yang di-hardcode
   * akan menawarkan pilihan yang tidak lagi ada di rubriknya, dan `simpanNilaiManual`
   * menolaknya karena nilai manual WAJIB sama dengan salah satu nama kategori.
   */
  kategori: KategoriRubrik[]
  namaIndikator: string
  /**
   * Sumber data otomatis indikator ini (`rubrik_indikator.kunci_sistem`).
   *
   * Dipakai tampilan untuk memberi SATUAN pada nilai mentah — "0,89" tidak berarti
   * apa-apa sampai ia dibaca sebagai "0,89 tahun" (lihat `SATUAN_MENTAH`). `null`
   * berarti indikatornya memang tidak punya sumber otomatis.
   */
  kunciSistem: KunciIndikator | null
  indukNama: string | null
  bobot: number | null
  nilaiMentah: string | null
  kategoriTerpilih: string | null
  skor: number
  perluReview: boolean
  sumberNilai: string
}

export interface MatchScoreProfil {
  jabatanTargetId: number
  kodeTarget: string
  namaTarget: string
  skorPotensiKompetensi: number
  skorKualifikasiJabatan: number
  skorIntegritasMoralitas: number
  skorTotal: number
  eligible: boolean
  catatanEligibility: string | null
  statusTalentPool: string | null
  ranking: number | null
  rincian: RincianIndikator[]
  /**
   * `true` bila skor ini dihitung **sebelum** perubahan terakhir pada rekam jejak
   * disiplin pegawainya — jadi angka Integritas & Moralitas di baris ini BELUM
   * memperhitungkannya.
   *
   * ## Kenapa penanda ini perlu ada
   *
   * `match_score` kolom TERSIMPAN; ia hanya berubah saat Hitung Ulang dijalankan.
   * Akibatnya profil bisa memajang dua panel yang saling bertentangan di satu
   * halaman: "1 hukuman aktif · Berat" di panel Integritas, dan "Verifikasi Rekam
   * Jejak Disiplin 100 · Tidak Pernah" di panel Kecocokan. Itu benar-benar terjadi
   * 25 Agu 2026 dan dilaporkan pemilik proses sebagai "nilai disiplinnya masih 100"
   * — kesimpulan wajarnya "fiturnya tidak berfungsi", padahal yang kurang cuma satu
   * kali hitung ulang.
   *
   * ## Kenapa dibandingkan dengan `audit_log`, bukan `hukuman_disiplin.created_at`
   *
   * Tabel itu tidak punya `updated_at`, jadi menonaktifkan catatan (yang justru
   * menaikkan skor kembali) tidak menggeser `created_at` sama sekali — penanda yang
   * membacanya akan bilang "sudah mutakhir" atas skor yang masih memakai hukuman
   * yang sudah dicabut. `audit_log` mencatat BUAT, UBAH, dan UBAH_STATUS-nya
   * berikut waktunya, jadi ia satu-satunya sumber yang tahu kapan terakhir kali
   * rekam jejak itu berubah.
   */
  disiplinLebihBaru: boolean
  /**
   * Status jabatan targetnya (`AKTIF` · `DRAFT` · `NONAKTIF`).
   *
   * Wajib ditampilkan, dan alasannya bukan kelengkapan: panel ini mengurutkan
   * menurut skor MENURUN, sementara target DRAFT & NONAKTIF **tidak pernah dihitung
   * ulang**. Jadi baris yang skornya paling basi justru cenderung paling TINGGI dan
   * duduk di puncak daftar — terukur pada satu pegawai: 96,67 (draft, dihitung
   * sebelum catatan disiplinnya masuk) di atas 85,42 (aktif, sudah
   * memperhitungkannya). Tanpa penanda status, angka teratas itu dibaca sebagai
   * skor yang berlaku.
   */
  statusTarget: string
}

/**
 * Match score pegawai terhadap semua jabatan target, lengkap dengan rincian per
 * indikator (usulan U-3) — inilah yang membuat pertanyaan "kenapa skornya beda
 * antar jabatan target?" bisa dijawab dari UI.
 */
export async function ambilMatchScore(pegawaiId: number): Promise<MatchScoreProfil[]> {
  const [skor, rincian, kategori] = await Promise.all([
    kueri<Record<string, unknown>>(
      `WITH ubahan_disiplin AS (
         /*
           Kapan rekam jejak disiplin pegawai ini terakhir berubah — mencakup baris
           yang dibuat DAN status yang dialihkan. Diambil dari dua sisi lalu
           di-GREATEST: created_at barisnya sendiri (untuk baris yang jejak
           auditnya belum ada, mis. hasil seed) dan waktu jejak audit terakhir yang
           menyentuh baris itu.
         */
         SELECT GREATEST(
                  COALESCE(MAX(h.created_at), '1000-01-01'),
                  COALESCE((SELECT MAX(a.created_at) FROM audit_log a
                             WHERE a.entitas = 'hukuman_disiplin'
                               AND a.entitas_id IN (SELECT id FROM hukuman_disiplin
                                                     WHERE pegawai_id = ?)), '1000-01-01')
                ) AS terakhir,
                COUNT(*) AS jumlah
           FROM hukuman_disiplin h
          WHERE h.pegawai_id = ?
       )
       SELECT ms.id, ms.jabatan_target_id, jt.kode_target, jt.nama_target, jt.status,
              ms.skor_potensi_kompetensi, ms.skor_kualifikasi_jabatan,
              ms.skor_integritas_moralitas, ms.skor_total, ms.eligible,
              ms.catatan_eligibility, tp.status AS status_pool, tp.ranking,
              /*
                Hanya untuk jabatan target AKTIF. Draft & nonaktif memang tidak
                pernah dihitung ulang — mereka inert, tidak masuk peringkat, tidak
                muncul di pemilih Peta Talenta — jadi menandainya "perlu Hitung
                Ulang" memunculkan puluhan peringatan atas baris yang tidak dipakai
                memutuskan apa pun. Terukur pada satu pegawai: 8 baris aktif vs 45
                baris draft/nonaktif. Peringatan yang muncul di 45 dari 53 baris
                akan berhenti dibaca, dan yang 8 itu ikut terabaikan bersamanya.
              */
              (ud.jumlah > 0 AND jt.status = 'AKTIF' AND ms.computed_at < ud.terakhir)
                AS disiplin_lebih_baru
       FROM match_score ms
       JOIN jabatan_target jt ON jt.id = ms.jabatan_target_id
       CROSS JOIN ubahan_disiplin ud
       LEFT JOIN talent_pool tp ON tp.pegawai_id = ms.pegawai_id
                               AND tp.jabatan_target_id = ms.jabatan_target_id
       WHERE ms.pegawai_id = ?
       ORDER BY ms.skor_total DESC`,
      [pegawaiId, pegawaiId, pegawaiId],
    ),
    kueri<Record<string, unknown>>(
      `SELECT ms.jabatan_target_id, i.nama_indikator, ind.nama_indikator AS induk_nama,
              d.bobot_indikator, d.nilai_mentah, d.kategori_terpilih, d.skor,
              d.perlu_review, d.sumber_nilai, d.id,
              d.rubrik_indikator_id, i.mode_skor, i.kunci_sistem
       FROM match_score_detail d
       JOIN match_score ms ON ms.id = d.match_score_id
       JOIN rubrik_indikator i ON i.id = d.rubrik_indikator_id
       LEFT JOIN rubrik_indikator ind ON ind.id = d.parent_indikator_id
       WHERE ms.pegawai_id = ?
       ORDER BY d.id`,
      [pegawaiId],
    ),
    // Kategori rubrik untuk SETIAP indikator yang muncul di rincian pegawai ini.
    // Satu kueri untuk semuanya, bukan satu per indikator: sembilan indikator ×
    // tiga jabatan target = 27 kueri kalau dilakukan per baris.
    kueri<Record<string, unknown>>(
      `SELECT s.rubrik_indikator_id, s.nama_kategori, s.nilai_skor, s.ambang_min
         FROM rubrik_kategori_skor s
        WHERE s.rubrik_indikator_id IN (
          SELECT d.rubrik_indikator_id
            FROM match_score_detail d
            JOIN match_score ms ON ms.id = d.match_score_id
           WHERE ms.pegawai_id = ?
        )
        ORDER BY s.rubrik_indikator_id, s.urutan, s.id`,
      [pegawaiId],
    ),
  ])

  const kategoriPerIndikator = new Map<number, KategoriRubrik[]>()
  for (const k of kategori) {
    const id = Number(k.rubrik_indikator_id)
    const daftar = kategoriPerIndikator.get(id) ?? []
    daftar.push({
      nama: String(k.nama_kategori),
      nilai: angka(k.nilai_skor as string),
      ambangMin: angka(k.ambang_min as string),
    })
    kategoriPerIndikator.set(id, daftar)
  }

  const perTarget = new Map<number, RincianIndikator[]>()
  for (const r of rincian) {
    const id = Number(r.jabatan_target_id)
    const daftar = perTarget.get(id) ?? []
    const idIndikator = Number(r.rubrik_indikator_id)
    daftar.push({
      rubrikIndikatorId: idIndikator,
      modeSkor: String(r.mode_skor) === 'NILAI_LANGSUNG' ? 'NILAI_LANGSUNG' : 'KATEGORI_TETAP',
      kategori: kategoriPerIndikator.get(idIndikator) ?? [],
      namaIndikator: String(r.nama_indikator),
      kunciSistem:
        r.kunci_sistem === null || !adalahKunciIndikator(String(r.kunci_sistem))
          ? null
          : (String(r.kunci_sistem) as KunciIndikator),
      indukNama: r.induk_nama === null ? null : String(r.induk_nama),
      bobot: angka(r.bobot_indikator as string),
      nilaiMentah: r.nilai_mentah === null ? null : String(r.nilai_mentah),
      kategoriTerpilih: r.kategori_terpilih === null ? null : String(r.kategori_terpilih),
      skor: angkaWajib(r.skor as string),
      perluReview: Number(r.perlu_review) === 1,
      sumberNilai: String(r.sumber_nilai),
    })
    perTarget.set(id, daftar)
  }

  return skor.map((r) => ({
    jabatanTargetId: Number(r.jabatan_target_id),
    kodeTarget: String(r.kode_target),
    namaTarget: String(r.nama_target),
    skorPotensiKompetensi: angkaWajib(r.skor_potensi_kompetensi as string),
    skorKualifikasiJabatan: angkaWajib(r.skor_kualifikasi_jabatan as string),
    skorIntegritasMoralitas: angkaWajib(r.skor_integritas_moralitas as string),
    skorTotal: angkaWajib(r.skor_total as string),
    eligible: Number(r.eligible) === 1,
    catatanEligibility: r.catatan_eligibility === null ? null : String(r.catatan_eligibility),
    statusTalentPool: r.status_pool === null ? null : String(r.status_pool),
    ranking: angka(r.ranking as number),
    rincian: perTarget.get(Number(r.jabatan_target_id)) ?? [],
    disiplinLebihBaru: Number(r.disiplin_lebih_baru ?? 0) === 1,
    statusTarget: String(r.status ?? 'DRAFT'),
  }))
}

/** Kelengkapan data satu pegawai — fakta dikumpulkan SQL, penilaian di lib/kelengkapan. */
export async function ambilKelengkapan(
  pegawaiId: number,
  nipValid: boolean,
): Promise<HasilKelengkapan> {
  const r = await kueriSatu<Record<string, unknown>>(
    `SELECT
       p.jabatan_id IS NOT NULL                                        AS jabatan_tertaut,
       (p.tmt_golongan IS NOT NULL AND p.tmt_jabatan IS NOT NULL)      AS tmt_lengkap,
       EXISTS (SELECT 1 FROM asesmen_talenta a WHERE a.pegawai_id = p.id) AS ada_asesmen,
       EXISTS (SELECT 1 FROM asesmen_talenta a WHERE a.pegawai_id = p.id
                 AND a.status_asesmen = 'Berlaku')                     AS asesmen_berlaku,
       EXISTS (SELECT 1 FROM kinerja_periode k WHERE k.pegawai_id = p.id
                 AND k.periode_skp = 'TAHUNAN' AND k.nilai_kinerja IS NOT NULL) AS ada_kinerja,
       (SELECT COUNT(DISTINCT periode_skp) FROM kinerja_periode k
          WHERE k.pegawai_id = p.id) >= 4                              AS kinerja_lengkap,
       EXISTS (SELECT 1 FROM riwayat_pendidikan rp WHERE rp.pegawai_id = p.id) AS ada_pendidikan,
       NOT EXISTS (SELECT 1 FROM riwayat_pendidikan rp WHERE rp.pegawai_id = p.id
                     AND rp.tahun_lulus IS NULL)                       AS pendidikan_bertahun,
       (p.riwayat_diklat IS NOT NULL AND JSON_LENGTH(p.riwayat_diklat) > 0) AS ada_diklat,
       (EXISTS (SELECT 1 FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id
                           AND rj.tanggal_mulai IS NULL))              AS riwayat_bertanggal,
       (EXISTS (SELECT 1 FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM riwayat_jabatan rj WHERE rj.pegawai_id = p.id
                           AND rj.jabatan_id IS NULL))                 AS riwayat_terpetakan,
       /*
         Ekspresinya DIIMPOR, tidak disalin. Sebelum ini berkas ini menuliskan
         EXISTS(... hukuman_disiplin ...) sendiri sementara definisi resminya ada di
         lib/kueri/kelengkapan-sql.ts -- dua salinan atas satu aturan, dan begitu
         salah satunya berubah (persis yang terjadi 25 Agu 2026 saat ceklis
         verifikasi ikut dihitung) badge di profil dan rollup per unit menyatakan
         angka berbeda untuk orang yang sama, tanpa satu pun galat.

         (Tanpa backtick: ini komentar SQL DI DALAM template literal — backtick di
         sini mengakhiri stringnya, dan galatnya muncul belasan baris jauhnya.
         Jebakan yang sudah tercatat di CLAUDE.md dan kena tiga kali hari ini.)
       */
       ${sqlFaktaButir('disiplinTerverifikasi')} AS disiplin_ada
     FROM pegawai p WHERE p.id = ?`,
    [pegawaiId],
  )

  const b = (k: string): boolean => Number(r?.[k] ?? 0) === 1

  return hitungKelengkapan({
    nipValid,
    jabatanTertaut: b('jabatan_tertaut'),
    tmtLengkap: b('tmt_lengkap'),
    adaAsesmen: b('ada_asesmen'),
    asesmenBerlaku: b('asesmen_berlaku'),
    adaKinerjaTahunan: b('ada_kinerja'),
    kinerjaTriwulanLengkap: b('kinerja_lengkap'),
    adaPendidikan: b('ada_pendidikan'),
    pendidikanBertahun: b('pendidikan_bertahun'),
    adaDiklat: b('ada_diklat'),
    riwayatJabatanBertanggal: b('riwayat_bertanggal'),
    riwayatJabatanTerpetakan: b('riwayat_terpetakan'),
    disiplinTerverifikasi: b('disiplin_ada'),
  })
}

/**
 * Ringkasan lama pengalaman per JENJANG untuk pemilih "Isi manual: Lama Jabatan".
 *
 * Permintaan pemilik proses (`2 sept- masukan sistem informasi.pdf`, butir 3):
 * verifikator memilih jenjang mana yang dipakai, bukan mengetik angkanya.
 *
 * Dibaca dari `riwayat_jabatan` APA ADANYA — termasuk baris yang belum dipetakan
 * ke master, yang di data nyata adalah **1.369 dari 1.405 baris**. Justru baris
 * itulah yang selama ini hilang dari perhitungan: `nilaiLamaJabatan()` hanya
 * memakai baris yang jenjangnya sudah diketahui, sehingga hampir semua orang
 * jatuh ke `tmt_jabatan`. Penjumlahan & klasifikasinya di `lib/pengalaman-jenjang.ts`
 * (murni & teruji); di sini hanya pembacaannya.
 */
export async function ambilPengalamanJenjang(pegawaiId: number): Promise<RingkasJenjang[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT jabatan_nama_mentah, unit_kerja_mentah, tanggal_mulai, tanggal_akhir, lama_bulan
       FROM riwayat_jabatan
      WHERE pegawai_id = ?
      ORDER BY urutan`,
    [pegawaiId],
  )
  return ringkasPengalamanJenjang(
    baris.map((r) => ({
      namaMentah: String(r.jabatan_nama_mentah),
      namaUnit: r.unit_kerja_mentah === null ? null : String(r.unit_kerja_mentah),
      tanggalMulai: r.tanggal_mulai === null ? null : new Date(String(r.tanggal_mulai)),
      tanggalAkhir: r.tanggal_akhir === null ? null : new Date(String(r.tanggal_akhir)),
      lamaBulan: r.lama_bulan === null ? null : Number(r.lama_bulan),
    })),
  )
}
