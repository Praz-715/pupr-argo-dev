import {
  eselonTertinggi,
  petaNilaiDariKunci,
  totalPengalamanTahun,
  type IndikatorBerkunci,
  type ProfilPenilaian,
} from './penilaian'
import {
  buatSnapshotRubrik,
  evaluasiKelayakan,
  hitungMatchScore,
  hitungRanking,
  ratakanDetail,
  type BarisDetailSkor,
  type KomponenNode,
  type NilaiMentah,
  type Persyaratan,
  type SnapshotRubrik,
  type StatusAsesmen,
} from './scoring'

/**
 * Menjalankan rubrik satu jabatan target terhadap BANYAK pegawai sekaligus.
 *
 * Kenapa modul ini ada: urutan langkahnya (baca rubrik → susun nilai mentah per
 * indikator → hitung match score → periksa kelayakan → ranking) dipakai oleh
 * **empat** pemanggil yang berbeda — generator `007_recompute.sql`, tombol
 * "Hitung Ulang", halaman Simulasi & Diff, dan halaman Kandidat. Sebelum ini
 * urutannya hanya hidup di dalam `scripts/recompute.ts`, sehingga tiga pemanggil
 * lainnya harus menuliskannya ulang — dan tiga salinan aturan bisnis yang sama
 * berarti tiga halaman bisa menampilkan skor berbeda untuk orang yang sama
 * (CLAUDE.md #1 & #2).
 *
 * Bebas DB supaya bisa diuji murni: pemanggil yang menyiapkan datanya.
 */

export interface ProfilKandidat extends ProfilPenilaian {
  nip: string
  nama: string
  /** Asesmen terbaru yang berlaku — dasar kelayakan & pemutus seri ranking. */
  asesmen: {
    tahunAsesmen: number
    statusAsesmen: StatusAsesmen | null
    nilaiKinerjaY: number | null
  } | null
}

export interface RubrikJabatanTarget {
  jabatanTargetId: number
  kataKunciRelevansi: string[]
  komponen: KomponenNode[]
  /** Indikator daun + kunci sumber datanya (`rubrik_indikator.kunci_sistem`). */
  indikatorBerkunci: IndikatorBerkunci[]
  persyaratan: Persyaratan[]
}

export interface OpsiSkorMassal {
  sekarang?: Date
  tahunSekarang?: number
  masaBerlakuTahun?: number
  /**
   * Nilai yang diisi manusia: `pegawaiId → indikatorId → nilai`. Menimpa hasil
   * otomatis dan bertahan melewati perhitungan ulang (U-3).
   */
  nilaiManual?: Record<number, Record<number, NilaiMentah>>
}

export interface HasilSkorKandidat {
  pegawaiId: number
  nip: string
  nama: string
  skorPotensiKompetensi: number
  skorKualifikasiJabatan: number
  skorIntegritasMoralitas: number
  skorTotal: number
  eligible: boolean
  perluVerifikasiManual: boolean
  catatanEligibility: string
  /** Indikator yang nilainya di luar ambang, kosong, atau dipotong. */
  perluReview: boolean
  detail: BarisDetailSkor[]
  nilaiKinerjaY: number | null
  /** Indikator tanpa sumber otomatis yang nilainya belum diisi manusia. */
  indikatorTanpaNilai: number[]
}

export interface HasilSkorMassal {
  jabatanTargetId: number
  hasil: HasilSkorKandidat[]
  /** Dibekukan sekali per perhitungan, bukan per pegawai (U-5). */
  snapshotRubrik: SnapshotRubrik
  jumlahEligible: number
  jumlahPerluReview: number
}

export function hitungSkorMassal(
  rubrik: RubrikJabatanTarget,
  kandidat: ProfilKandidat[],
  opsi: OpsiSkorMassal = {},
): HasilSkorMassal {
  const sekarang = opsi.sekarang ?? new Date()
  const opsiMasaBerlaku = {
    ...(opsi.tahunSekarang !== undefined ? { tahunSekarang: opsi.tahunSekarang } : {}),
    ...(opsi.masaBerlakuTahun !== undefined ? { masaBerlakuTahun: opsi.masaBerlakuTahun } : {}),
  }

  const target = {
    jabatanTargetId: rubrik.jabatanTargetId,
    kataKunciRelevansi: rubrik.kataKunciRelevansi,
  }

  const hasil = kandidat.map((profil): HasilSkorKandidat => {
    const { peta, tanpaKunci } = petaNilaiDariKunci(
      rubrik.indikatorBerkunci,
      profil,
      target,
      sekarang,
      opsi.nilaiManual?.[profil.pegawaiId] ?? {},
    )

    const skor = hitungMatchScore(rubrik.komponen, peta)

    const kelayakan = evaluasiKelayakan(
      rubrik.persyaratan,
      {
        tingkatPendidikan: profil.tingkatPendidikan,
        bidangStudi: profil.bidangStudi,
        eselonTertinggi: eselonTertinggi(profil.riwayatJabatan) ?? profil.eselonSaatIni,
        totalPengalamanTahun: totalPengalamanTahun(profil.riwayatJabatan, sekarang),
        asesmen: profil.asesmen
          ? {
              tahunAsesmen: profil.asesmen.tahunAsesmen,
              statusAsesmen: profil.asesmen.statusAsesmen,
            }
          : null,
      },
      opsiMasaBerlaku,
    )

    return {
      pegawaiId: profil.pegawaiId,
      nip: profil.nip,
      nama: profil.nama,
      skorPotensiKompetensi: skor.skorPotensiKompetensi,
      skorKualifikasiJabatan: skor.skorKualifikasiJabatan,
      skorIntegritasMoralitas: skor.skorIntegritasMoralitas,
      skorTotal: skor.skorTotal,
      eligible: kelayakan.eligible,
      perluVerifikasiManual: kelayakan.perluVerifikasiManual,
      catatanEligibility: kelayakan.catatan,
      perluReview: skor.perluReview,
      detail: ratakanDetail(skor.detail),
      nilaiKinerjaY: profil.asesmen?.nilaiKinerjaY ?? null,
      indikatorTanpaNilai: tanpaKunci,
    }
  })

  return {
    jabatanTargetId: rubrik.jabatanTargetId,
    hasil,
    snapshotRubrik: buatSnapshotRubrik(rubrik.komponen, sekarang),
    jumlahEligible: hasil.filter((h) => h.eligible).length,
    jumlahPerluReview: hasil.filter((h) => h.perluReview).length,
  }
}

/**
 * Peringkat **di antara kandidat yang lolos syarat**.
 *
 * Bukan peringkat seluruh pegawai: kandidat tidak lolos syarat tetap punya skor
 * (berguna sebagai pembanding, lihat catatan di `007_recompute.sql`), tapi
 * memberinya nomor peringkat akan menyiratkan ia bagian dari daftar suksesi.
 */
export function peringkatEligible<T extends { pegawaiId: number; skorTotal: number; nilaiKinerjaY: number | null; eligible: boolean }>(
  hasil: T[],
): Map<number, number> {
  const berperingkat = hitungRanking(
    hasil
      .filter((h) => h.eligible)
      .map((h) => ({
        pegawaiId: h.pegawaiId,
        skorTotal: h.skorTotal,
        nilaiKinerjaY: h.nilaiKinerjaY,
      })),
  )
  return new Map(berperingkat.map((b) => [b.pegawaiId, b.ranking]))
}

// ---------------------------------------------------------------------------
// Simulasi & Diff (usulan U-4)
// ---------------------------------------------------------------------------

export type JenisPerubahan = 'BARU' | 'MASUK' | 'KELUAR' | 'NAIK' | 'TURUN' | 'SKOR' | 'TETAP'

export interface SkorTersimpan {
  pegawaiId: number
  skorTotal: number
  eligible: boolean
  nilaiKinerjaY: number | null
}

export interface BarisDiff {
  pegawaiId: number
  nip: string
  nama: string
  totalSebelum: number | null
  totalSesudah: number
  selisihTotal: number | null
  eligibleSebelum: boolean | null
  eligibleSesudah: boolean
  rankingSebelum: number | null
  rankingSesudah: number | null
  /** Negatif = naik peringkat (nomor mengecil). */
  geserRanking: number | null
  jenis: JenisPerubahan
}

export interface RingkasDiff {
  jumlahDibandingkan: number
  jumlahBerubah: number
  naik: number
  turun: number
  masuk: number
  keluar: number
  baru: number
  /** Selisih skor absolut terbesar — ukuran "seberapa besar guncangannya". */
  selisihTerbesar: number
  eligibleSebelum: number
  eligibleSesudah: number
  adaPerubahan: boolean
}

export interface HasilDiff {
  baris: BarisDiff[]
  ringkas: RingkasDiff
}

/**
 * Bandingkan skor tersimpan (keadaan sekarang di DB) dengan hasil hitung rubrik
 * yang sedang disunting.
 *
 * Mengubah bobot berarti me-ranking ulang manusia, jadi dampaknya harus terlihat
 * sebelum aktivasi (phase.md §7 Fase 5). Efek sampingnya berguna: kalau rubriknya
 * TIDAK diubah, diff wajib kosong — itu bukti bahwa pipeline yang dipakai UI
 * menghasilkan angka yang sama dengan yang tersimpan di DB.
 *
 * Peringkat kedua sisi dihitung dengan fungsi yang sama (`peringkatEligible`),
 * bukan dibaca dari `talent_pool` — peringkat pool hanya mencakup anggota pool,
 * sehingga membandingkannya dengan peringkat seluruh kandidat akan menyatakan
 * "turun 5 peringkat" untuk orang yang sebenarnya tidak bergerak.
 */
export function bandingkanSkor(
  sebelum: SkorTersimpan[],
  sesudah: HasilSkorKandidat[],
): HasilDiff {
  const petaSebelum = new Map(sebelum.map((s) => [s.pegawaiId, s]))
  const rankingSebelum = peringkatEligible(sebelum)
  const rankingSesudah = peringkatEligible(sesudah)

  const baris = sesudah.map((s): BarisDiff => {
    const lama = petaSebelum.get(s.pegawaiId) ?? null
    const rLama = rankingSebelum.get(s.pegawaiId) ?? null
    const rBaru = rankingSesudah.get(s.pegawaiId) ?? null
    const selisih = lama === null ? null : bulatkanSelisih(s.skorTotal - lama.skorTotal)
    const geser = rLama === null || rBaru === null ? null : rBaru - rLama

    return {
      pegawaiId: s.pegawaiId,
      nip: s.nip,
      nama: s.nama,
      totalSebelum: lama?.skorTotal ?? null,
      totalSesudah: s.skorTotal,
      selisihTotal: selisih,
      eligibleSebelum: lama?.eligible ?? null,
      eligibleSesudah: s.eligible,
      rankingSebelum: rLama,
      rankingSesudah: rBaru,
      geserRanking: geser,
      jenis: tentukanJenis(lama, s, geser, selisih),
    }
  })

  const naik = baris.filter((b) => b.jenis === 'NAIK').length
  const turun = baris.filter((b) => b.jenis === 'TURUN').length
  const masuk = baris.filter((b) => b.jenis === 'MASUK').length
  const keluar = baris.filter((b) => b.jenis === 'KELUAR').length
  const baru = baris.filter((b) => b.jenis === 'BARU').length
  const berubah = baris.filter((b) => b.jenis !== 'TETAP').length

  return {
    baris,
    ringkas: {
      jumlahDibandingkan: baris.length,
      jumlahBerubah: berubah,
      naik,
      turun,
      masuk,
      keluar,
      baru,
      selisihTerbesar: baris.reduce(
        (maks, b) => Math.max(maks, Math.abs(b.selisihTotal ?? 0)),
        0,
      ),
      eligibleSebelum: sebelum.filter((s) => s.eligible).length,
      eligibleSesudah: sesudah.filter((s) => s.eligible).length,
      adaPerubahan: berubah > 0,
    },
  }
}

/**
 * Selisih dibulatkan 2 desimal SEBELUM dibandingkan dengan nol.
 *
 * Skor tersimpan datang dari `DECIMAL(6,2)` sementara hasil hitung masih pecahan
 * biner, jadi tanpa pembulatan ini setiap pegawai akan tampil "berubah" oleh
 * selisih sebesar 1e-14 — dan diff yang selalu penuh adalah diff yang tidak
 * dibaca siapa pun.
 */
function bulatkanSelisih(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function tentukanJenis(
  lama: SkorTersimpan | null,
  baru: HasilSkorKandidat,
  geser: number | null,
  selisih: number | null,
): JenisPerubahan {
  if (lama === null) return 'BARU'
  if (!lama.eligible && baru.eligible) return 'MASUK'
  if (lama.eligible && !baru.eligible) return 'KELUAR'
  if (geser !== null && geser < 0) return 'NAIK'
  if (geser !== null && geser > 0) return 'TURUN'
  if (selisih !== null && selisih !== 0) return 'SKOR'
  return 'TETAP'
}
