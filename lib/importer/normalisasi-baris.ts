import {
  bandingkanKotak9,
  bulatkan2,
  clampSkor,
  evaluasiMasaBerlaku,
  hitungKotak9,
  type AmbangSumbu,
  type StatusAsesmen,
} from '../scoring'
import {
  normalisasiGolongan,
  normalisasiJenisAsesmen,
  parsePendidikan,
  parseTmt,
  terindikasiTeksJabatan,
  type TingkatPendidikan,
} from '../normalisasi'
import { parseNip } from '../nip'
import { buatTemuan, type HasilImpor, type Temuan } from './temuan'

/**
 * Normalisasi baris mentah dari sistem sumber → bentuk yang memenuhi phase.md §2,
 * plus daftar temuannya.
 *
 * Berkas ini **mengorkestrasi**, bukan mengimplementasi ulang: parser golongan,
 * jenis asesmen, TMT, pendidikan, NIP, clamp skor, dan aturan masa berlaku sudah
 * ada masing-masing di `lib/normalisasi.ts`, `lib/nip.ts`, dan `lib/scoring`.
 * Yang ditambahkan di sini hanya dua hal yang belum ada tempatnya:
 *
 *   1. **skala integritas** — mengangkat nilai 1–4 ke 0–100 (§6 no. 3);
 *   2. **pencatatan temuan** — mengubah "ada yang aneh" jadi baris yang bisa
 *      ditindak di Antrian Pembersihan Data.
 *
 * Bebas dependensi DB supaya bisa diuji murni, sama seperti `lib/scoring`.
 */

// ---------------------------------------------------------------------------
// §6.3 · Skala integritas
// ---------------------------------------------------------------------------

/**
 * Rubrik Integritas & Moralitas hidup di 0–100 (phase.md §2.7), tapi sumber
 * pernah mengirim skala kecil 1–4. Keduanya tidak bisa dibedakan dari nilainya
 * saja untuk angka rendah — nilai 3 bisa berarti "3 dari 4" (=50) atau "3 dari
 * 100" (=hampir nol).
 *
 * **Keputusan:** nilai ≤ 4 diperlakukan sebagai skala kecil. Alasannya asimetri
 * risiko, bukan tebakan statistik: rubrik 0–100 hanya mengenal lima nilai
 * (100/75/50/25/0), jadi angka 1–4 **tidak mungkin** valid pada skala besar,
 * sementara pada skala kecil ia justru satu-satunya bentuk yang mungkin.
 */
const AMBANG_SKALA_KECIL = 4
const PETA_SKALA_KECIL: Record<number, number> = { 1: 25, 2: 50, 3: 75, 4: 100 }

export function normalisasiNilaiIntegritas(
  mentah: number | null | undefined,
): HasilImpor<number | null> {
  if (mentah === null || mentah === undefined || Number.isNaN(mentah)) {
    return { nilai: null, temuan: [] }
  }

  if (mentah > 0 && mentah <= AMBANG_SKALA_KECIL) {
    // Nilai pecahan pada skala kecil (mis. 3,5) dibulatkan ke tingkat terdekat
    // yang ada di rubrik — rubriknya diskret, jadi hasil antara tidak bermakna.
    const tingkat = Math.min(4, Math.max(1, Math.round(mentah)))
    const hasil = PETA_SKALA_KECIL[tingkat]!
    return {
      nilai: hasil,
      temuan: [
        buatTemuan(
          'INTEGRITAS_SKALA_KECIL',
          'nilai_integritas',
          mentah,
          hasil,
          `Nilai ${mentah} dibaca sebagai skala 1–4 dan dinaikkan ke ${hasil} pada skala rubrik 0–100.`,
        ),
      ],
    }
  }

  const { skor, diClamp } = clampSkor(mentah)
  return {
    nilai: skor,
    temuan: diClamp
      ? [
          buatTemuan(
            'SKOR_DI_LUAR_RENTANG',
            'nilai_integritas',
            mentah,
            skor,
            `Nilai ${mentah} di luar 0–100, dipotong ke ${skor}.`,
          ),
        ]
      : [],
  }
}

// ---------------------------------------------------------------------------
// §6.1 · Skor umum (potkom, nilai potensial, dsb.)
// ---------------------------------------------------------------------------

/**
 * Potkom apa adanya — hanya dicatat kalau melebihi 100, tidak dipotong.
 *
 * Dipisah dari `normalisasiSkor()` supaya pemotongan tetap berlaku untuk field
 * lain yang memang berskala 0–100. Kalau suatu hari pengelola sumber memastikan
 * skalanya, yang diubah cuma fungsi ini.
 */
export function normalisasiPotkom(mentah: number | null | undefined): HasilImpor<number | null> {
  if (mentah === null || mentah === undefined || Number.isNaN(mentah)) {
    return { nilai: null, temuan: [] }
  }
  const nilai = bulatkan2(mentah)
  return {
    nilai,
    temuan:
      nilai > 100
        ? [
            buatTemuan(
              'POTKOM_DI_ATAS_100',
              'potkom',
              mentah,
              nilai,
              `Potkom ${nilai} melebihi 100 dan DISIMPAN apa adanya — sumbu X ikut melebihi 100. Skala potkom sumber belum dikonfirmasi pengelolanya.`,
            ),
          ]
        : [],
  }
}

export function normalisasiSkor(
  mentah: number | null | undefined,
  field: string,
): HasilImpor<number | null> {
  if (mentah === null || mentah === undefined || Number.isNaN(mentah)) {
    return { nilai: null, temuan: [] }
  }
  const { skor, diClamp } = clampSkor(mentah)
  return {
    nilai: skor,
    temuan: diClamp
      ? [
          buatTemuan(
            'SKOR_DI_LUAR_RENTANG',
            field,
            mentah,
            skor,
            `Nilai ${mentah} di luar 0–100, dipotong ke ${skor}. Nilai mentah tetap disimpan di jejak sinkronisasi.`,
          ),
        ]
      : [],
  }
}

// ---------------------------------------------------------------------------
// §6.4 · Golongan · §6.5 · Jenis asesmen
// ---------------------------------------------------------------------------

export function normalisasiGolonganBerjejak(
  mentah: string | null | undefined,
): HasilImpor<string | null> {
  const hasil = normalisasiGolongan(mentah)
  const berubah = hasil !== null && mentah !== null && mentah !== undefined && hasil !== mentah.trim()
  return {
    nilai: hasil,
    temuan: berubah
      ? [
          buatTemuan(
            'FORMAT_GOLONGAN',
            'golongan',
            mentah,
            hasil,
            `Format "${String(mentah).trim()}" diseragamkan menjadi "${hasil}".`,
          ),
        ]
      : [],
  }
}

export function normalisasiJenisAsesmenBerjejak(
  mentah: string | null | undefined,
): HasilImpor<string | null> {
  const hasil = normalisasiJenisAsesmen(mentah)
  const berubah = hasil !== null && mentah !== null && mentah !== undefined && hasil !== mentah.trim()
  return {
    nilai: hasil,
    temuan: berubah
      ? [
          buatTemuan(
            'ISTILAH_ASESMEN_LAMA',
            'jenis_asesmen',
            mentah,
            hasil,
            `"${String(mentah).trim()}" diseragamkan menjadi "${hasil}".`,
          ),
        ]
      : [],
  }
}

// ---------------------------------------------------------------------------
// §6.6 · Tanggal / TMT
// ---------------------------------------------------------------------------

export function normalisasiTanggal(
  mentah: string | null | undefined,
  field: string,
): HasilImpor<Date | null> {
  const hasil = parseTmt(mentah)
  const adaIsi = mentah !== null && mentah !== undefined && String(mentah).trim() !== ''

  if (hasil.tanggal !== null) return { nilai: hasil.tanggal, temuan: [] }

  return {
    nilai: null,
    temuan: adaIsi
      ? [
          buatTemuan(
            'TANGGAL_TIDAK_TERURAI',
            field,
            mentah,
            null,
            `"${String(mentah).trim()}" tidak cocok dengan format tanggal mana pun yang dikenali. Dibiarkan kosong — tidak diisi tebakan.`,
          ),
        ]
      : [],
  }
}

// ---------------------------------------------------------------------------
// §6.10 · Riwayat pendidikan sebagai satu teks
// ---------------------------------------------------------------------------

export function normalisasiPendidikan(
  mentah: string | null | undefined,
): HasilImpor<{ jenjang: TingkatPendidikan | null; bidangStudi: string | null }> {
  const hasil = parsePendidikan(mentah)
  const adaIsi = mentah !== null && mentah !== undefined && String(mentah).trim() !== ''

  return {
    nilai: { jenjang: hasil.jenjang, bidangStudi: hasil.bidangStudi },
    temuan:
      hasil.perluReview && adaIsi
        ? [
            buatTemuan(
              'PENDIDIKAN_TIDAK_TERURAI',
              'riwayat_pendidikan',
              mentah,
              hasil.jenjang ?? hasil.bidangStudi,
              hasil.jenjang === null
                ? `Jenjang tidak terbaca dari "${String(mentah).trim()}".`
                : `Jenjang terbaca (${hasil.jenjang}) tapi bidang studinya kosong.`,
            ),
          ]
        : [],
  }
}

// ---------------------------------------------------------------------------
// §6.9 · Unit Kerja yang berisi teks jabatan
// ---------------------------------------------------------------------------

export function periksaUnitKerja(mentah: string | null | undefined): Temuan[] {
  if (!terindikasiTeksJabatan(mentah)) return []
  return [
    buatTemuan(
      'UNIT_BERISI_TEKS_JABATAN',
      'unit_kerja',
      mentah,
      null,
      `"${String(mentah).trim()}" diawali kata yang biasanya menandai jabatan, bukan unit. TIDAK dibetulkan otomatis — pemetaan salah akan memindahkan pegawai ke unit yang bukan tempatnya.`,
    ),
  ]
}

// ---------------------------------------------------------------------------
// §6.11 · NIP
// ---------------------------------------------------------------------------

export function periksaNip(mentah: string | null | undefined, pada = new Date()): Temuan[] {
  const hasil = parseNip(mentah, pada)
  if (hasil.valid) return []
  return [
    buatTemuan(
      'NIP_TIDAK_VALID',
      'nip',
      mentah,
      null,
      hasil.masalah.length > 0
        ? hasil.masalah.join('; ')
        : 'NIP tidak memenuhi format 18 digit ASN.',
    ),
  ]
}

// ---------------------------------------------------------------------------
// §6.7 · Riwayat jabatan belum terstruktur
// ---------------------------------------------------------------------------

export interface RiwayatJabatanMentah {
  urutan: number
  jabatanNamaMentah: string
  jabatanId: number | null
  tanggalMulai: string | null
  tanggalAkhir: string | null
  noSk: string | null
}

export function periksaRiwayatJabatan(r: RiwayatJabatanMentah): Temuan[] {
  const kurang: string[] = []
  if (r.jabatanId === null) kurang.push('belum tertaut jabatan master')
  if (r.tanggalMulai === null) kurang.push('tanpa tanggal mulai')
  if (r.noSk === null || r.noSk.trim() === '') kurang.push('tanpa nomor SK')

  if (kurang.length === 0) return []

  return [
    buatTemuan(
      'RIWAYAT_BELUM_TERSTRUKTUR',
      `riwayat_jabatan[${r.urutan}]`,
      r.jabatanNamaMentah,
      null,
      `${kurang.join(', ')}. ${
        r.tanggalMulai === null
          ? 'Indikator Lama Jabatan tidak bisa dihitung otomatis dan jatuh ke input manual bertanda jejak.'
          : 'Indikator Keragaman & Substansi Riwayat Jabatan bergantung pada tautan ke jabatan master.'
      }`,
    ),
  ]
}

// ---------------------------------------------------------------------------
// §6.2 & §6.12 · Baris asesmen utuh
// ---------------------------------------------------------------------------

export interface AsesmenMentah {
  tahunAsesmen: number
  jenisAsesmen: string | null
  statusAsesmen: string | null
  nilaiKinerjaY: number
  potkom: number
  nilaiIntegritas: number | null
  /** `kotak_9` yang dikirim sumber — dipakai sebagai pembanding, bukan kebenaran. */
  kotak9Sumber: number | null
}

export interface AsesmenBersih {
  tahunAsesmen: number
  jenisAsesmen: string | null
  statusAsesmen: StatusAsesmen
  nilaiKinerjaY: number
  nilaiPotensialX: number
  potkom: number
  nilaiIntegritas: number | null
  nilaiTalenta: number
  kotak9: number
}

/**
 * Normalisasi satu baris asesmen. Di sini semua aturan §2 bertemu: skor
 * di-clamp, `kotak_9` **dihitung ulang** (nilai sumber cuma pembanding), status
 * masa berlaku dihitung dari aturan 3 tahun, dan integritas dinaikkan skalanya.
 */
export function normalisasiAsesmen(
  m: AsesmenMentah,
  /**
   * `ambang` WAJIB dikirim pemanggil, tidak berbawaan.
   *
   * Fungsi ini menulis `kotak_9` yang TERSIMPAN, jadi ia jalur tulis. Kalau
   * ambangnya boleh dihilangkan, satu pemanggil yang lupa akan menyimpan kotak
   * menurut angka kode sementara halaman membacanya menurut angka
   * `pengaturan_sistem` — dan selisihnya tidak terlihat sebagai galat, hanya
   * sebagai orang yang duduk di kotak yang salah.
   */
  opsi: { tahunSekarang: number; ambang: AmbangSumbu },
): HasilImpor<AsesmenBersih> {
  const temuan: Temuan[] = []

  const kinerja = normalisasiSkor(m.nilaiKinerjaY, 'nilai_kinerja_y')
  /**
   * **Potkom TIDAK dipotong** — keputusan pemilik proses, 18 Agu 2026.
   *
   * Sebelumnya potkom melewati `normalisasiSkor()` yang memotongnya ke 0–100.
   * Terukur pada dua sumber INDEPENDEN: eNominasi (5 dari 10 rekaman >100,
   * sampai 130,73) dan Excel Talent Pool ES 2/3 (10 dari 26, sampai 114,93).
   * Memotongnya membuat sekitar 40% populasi menumpuk di X=100 tepat dan
   * kehilangan seluruh daya bedanya di sumbu X — sebaran Kotak 9 lalu menyempit
   * bukan karena orangnya serupa, melainkan karena angkanya diseragamkan.
   *
   * Yang TIDAK berubah: `nilai_kinerja_y` tetap diplafon (ia turunan predikat,
   * yang memang berskala 0–100), dan `nilai_talenta` tetap diplafon di
   * `hitungNilaiTalenta()` karena ia komposit berskala 0–100. Klasifikasi Kotak 9
   * tidak terpengaruh: ambang teratas `≥80`, dan nilai >100 tetap memenuhinya.
   */
  const potkom = normalisasiPotkom(m.potkom)
  const integritas = normalisasiNilaiIntegritas(m.nilaiIntegritas)
  const jenis = normalisasiJenisAsesmenBerjejak(m.jenisAsesmen)
  temuan.push(...kinerja.temuan, ...potkom.temuan, ...integritas.temuan, ...jenis.temuan)

  // Sumbu X generik = Potkom pada rubrik generik (phase.md §2.2). Nilai potensial
  // tidak diambil dari sumber: kalau sumber mengirimnya, ia hanya boleh jadi
  // pembanding — sama perlakuannya dengan kotak_9.
  const y = kinerja.nilai ?? 0
  const x = potkom.nilai ?? 0
  const hasilKotak = hitungKotak9(y, x, opsi.ambang)

  const banding = bandingkanKotak9(hasilKotak, m.kotak9Sumber)
  if (banding.perluReview) {
    temuan.push(
      buatTemuan(
        'KOTAK9_BEDA_DENGAN_HITUNGAN',
        'kotak_9',
        m.kotak9Sumber,
        hasilKotak.kotak,
        banding.keterangan ?? 'Kotak 9 sumber berbeda dengan hasil hitung.',
      ),
    )
  }

  // Perbandingan status vs umur asesmen sudah jadi urusan `evaluasiMasaBerlaku`
  // (termasuk aturan bahwa "Draft" bukan pernyataan soal umur) — dipakai apa
  // adanya supaya aturan masa berlaku tetap tinggal di satu tempat.
  const statusSumber = (m.statusAsesmen?.trim() ?? null) as StatusAsesmen | null
  const masa = evaluasiMasaBerlaku(m.tahunAsesmen, statusSumber, {
    tahunSekarang: opsi.tahunSekarang,
  })
  const statusHitung: StatusAsesmen = masa.kedaluwarsa ? 'Expired' : 'Berlaku'
  const statusDipakai: StatusAsesmen = statusSumber === 'Draft' ? 'Draft' : statusHitung

  if (masa.bedaDenganSumber) {
    temuan.push(
      buatTemuan(
        'STATUS_ASESMEN_TIDAK_KONSISTEN',
        'status_asesmen',
        statusSumber,
        statusDipakai,
        `${masa.keterangan ?? 'Status sumber tidak sejalan dengan umur asesmen'} — dipakai "${statusHitung}".`,
      ),
    )
  }

  return {
    nilai: {
      tahunAsesmen: m.tahunAsesmen,
      jenisAsesmen: jenis.nilai,
      statusAsesmen: statusDipakai,
      nilaiKinerjaY: hasilKotak.nilaiKinerjaY,
      nilaiPotensialX: hasilKotak.nilaiPotensialX,
      potkom: potkom.nilai ?? 0,
      nilaiIntegritas: integritas.nilai,
      nilaiTalenta: hasilKotak.nilaiTalenta,
      kotak9: hasilKotak.kotak,
    },
    temuan,
  }
}

// ---------------------------------------------------------------------------
// Baris pegawai utuh
// ---------------------------------------------------------------------------

export interface PegawaiMentah {
  nip: string | null
  namaLengkap: string
  golongan: string | null
  pangkat: string | null
  tmtGolongan: string | null
  tmtJabatan: string | null
  unitKerjaMentah: string | null
  pendidikanMentah: string | null
}

export interface PegawaiBersih {
  nip: string | null
  namaLengkap: string
  golongan: string | null
  pangkat: string | null
  tmtGolongan: Date | null
  tmtJabatan: Date | null
  tingkatPendidikan: TingkatPendidikan | null
  bidangStudi: string | null
}

export function normalisasiPegawai(
  m: PegawaiMentah,
  pada = new Date(),
): HasilImpor<PegawaiBersih> {
  const golongan = normalisasiGolonganBerjejak(m.golongan)
  const tmtGolongan = normalisasiTanggal(m.tmtGolongan, 'tmt_golongan')
  const tmtJabatan = normalisasiTanggal(m.tmtJabatan, 'tmt_jabatan')
  const pendidikan = normalisasiPendidikan(m.pendidikanMentah)

  return {
    nilai: {
      nip: m.nip === null ? null : m.nip.replace(/\D/g, ''),
      namaLengkap: m.namaLengkap.trim().replace(/\s+/g, ' '),
      golongan: golongan.nilai,
      pangkat: m.pangkat === null ? null : m.pangkat.trim().replace(/\s+/g, ' '),
      tmtGolongan: tmtGolongan.nilai,
      tmtJabatan: tmtJabatan.nilai,
      tingkatPendidikan: pendidikan.nilai.jenjang,
      bidangStudi: pendidikan.nilai.bidangStudi,
    },
    temuan: [
      ...periksaNip(m.nip, pada),
      ...golongan.temuan,
      ...tmtGolongan.temuan,
      ...tmtJabatan.temuan,
      ...pendidikan.temuan,
      ...periksaUnitKerja(m.unitKerjaMentah),
    ],
  }
}
