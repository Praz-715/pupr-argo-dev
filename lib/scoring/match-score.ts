import { PENANDA_KOMPONEN } from './konstanta'
import { bulatkan2, hitungSumbu } from './rubrik'
import type {
  CatatanReview,
  HasilIndikator,
  HasilKomponen,
  HasilSumbu,
  KomponenNode,
  NilaiMentah,
  PetaNilai,
} from './types'

/**
 * Formula B — Match Score pegawai × jabatan target.
 * 65% Potensi & Kompetensi + 20% Kualifikasi Jabatan + 15% Integritas & Moralitas
 *
 * CATATAN PENTING (phase.md §3 K-4): ketiga komponen ini semuanya milik SUMBU X.
 * Match Score secara matematis identik dengan Nilai Potensial versi rubrik
 * jabatan target — unsur kinerja (sumbu Y) tidak masuk sama sekali. Karena itu
 * UI wajib menampilkan Kotak 9 / predikat kinerja berdampingan dengan skor ini.
 */

export interface HasilMatchScore {
  skorPotensiKompetensi: number
  skorKualifikasiJabatan: number
  skorIntegritasMoralitas: number
  /** Nilai untuk `match_score.skor_total`. */
  skorTotal: number
  /** Pohon lengkap untuk `match_score_detail` & halaman Rincian Perhitungan. */
  detail: HasilSumbu
  catatanReview: CatatanReview[]
  perluReview: boolean
}

function cariKomponen(hasil: HasilKomponen[], penanda: string): HasilKomponen | undefined {
  return hasil.find((k) => k.namaKomponen.toLowerCase().includes(penanda))
}

export function hitungMatchScore(komponenTarget: KomponenNode[], nilai: PetaNilai): HasilMatchScore {
  const sumbuX = hitungSumbu(komponenTarget, 'X_POTENSIAL', nilai)

  const pk = cariKomponen(sumbuX.komponen, PENANDA_KOMPONEN.potensiKompetensi)
  const kj = cariKomponen(sumbuX.komponen, PENANDA_KOMPONEN.kualifikasiJabatan)
  const im = cariKomponen(sumbuX.komponen, PENANDA_KOMPONEN.integritasMoralitas)

  const catatanReview = [...sumbuX.catatanReview]
  for (const [penanda, komponen] of [
    ['Potensi & Kompetensi', pk],
    ['Kualifikasi Jabatan', kj],
    ['Integritas & Moralitas', im],
  ] as const) {
    if (!komponen) {
      catatanReview.push({
        indikatorId: null,
        namaIndikator: penanda,
        alasan: 'RUBRIK_KOSONG',
        keterangan: `Komponen "${penanda}" tidak ditemukan pada rubrik jabatan target ini`,
      })
    }
  }

  return {
    skorPotensiKompetensi: pk?.skor ?? 0,
    skorKualifikasiJabatan: kj?.skor ?? 0,
    skorIntegritasMoralitas: im?.skor ?? 0,
    skorTotal: sumbuX.skor,
    detail: sumbuX,
    catatanReview,
    perluReview: catatanReview.length > 0,
  }
}

export interface BarisDetailSkor {
  rubrikIndikatorId: number
  namaIndikator: string
  /** null untuk indikator top-level. */
  parentIndikatorId: number | null
  bobot: number | null
  nilaiMentah: NilaiMentah | null
  kategoriTerpilih: string | null
  skor: number
  perluReview: boolean
  kedalaman: number
}

/**
 * Ratakan pohon hasil menjadi baris-baris siap simpan ke `match_score_detail`
 * (usulan U-3) — inilah yang membuat skor bisa ditelusuri sampai indikator,
 * bukan cuma 3 angka agregat.
 */
export function ratakanDetail(detail: HasilSumbu): BarisDetailSkor[] {
  const baris: BarisDetailSkor[] = []

  function jelajah(node: HasilIndikator, parentId: number | null, kedalaman: number): void {
    baris.push({
      rubrikIndikatorId: node.indikatorId,
      namaIndikator: node.namaIndikator,
      parentIndikatorId: parentId,
      bobot: node.bobot,
      nilaiMentah: node.nilaiMentah,
      kategoriTerpilih: node.kategoriTerpilih,
      skor: node.skor,
      perluReview: node.perluReview,
      kedalaman,
    })
    for (const anak of node.anak) {
      jelajah(anak, node.indikatorId, kedalaman + 1)
    }
  }

  for (const komponen of detail.komponen) {
    for (const indikator of komponen.indikator) {
      jelajah(indikator, null, 0)
    }
  }

  return baris
}

/**
 * Snapshot bobot rubrik saat skor dihitung (usulan U-5).
 *
 * Tanpa ini, skor talent pool yang sudah DITETAPKAN tidak bisa direproduksi
 * setelah bobot rubrik diubah dari UI.
 */
export interface SnapshotRubrik {
  komponen: Array<{
    id: number
    nama: string
    sumbu: string
    bobot: number
    indikator: Array<{ id: number; nama: string; bobot: number | null; modeSkor: string }>
  }>
  dihitungPada: string
}

export function buatSnapshotRubrik(
  komponenTarget: KomponenNode[],
  dihitungPada: Date = new Date(),
): SnapshotRubrik {
  return {
    komponen: komponenTarget.map((k) => ({
      id: k.id,
      nama: k.namaKomponen,
      sumbu: k.sumbu,
      bobot: k.bobot,
      indikator: k.indikator.flatMap((i) => [
        { id: i.id, nama: i.namaIndikator, bobot: i.bobot, modeSkor: i.modeSkor },
        ...i.anak.map((a) => ({
          id: a.id,
          nama: a.namaIndikator,
          bobot: a.bobot,
          modeSkor: a.modeSkor,
        })),
      ]),
    })),
    dihitungPada: dihitungPada.toISOString(),
  }
}

/**
 * Ranking talent pool. Urutan: skor total menurun; kalau seri, yang nilai
 * kinerja (sumbu Y) lebih tinggi menang — supaya seri tidak diputus oleh
 * urutan `id` yang tidak bermakna, dan kinerja tetap punya peran (K-4).
 */
export interface KandidatRanking {
  pegawaiId: number
  skorTotal: number
  nilaiKinerjaY: number | null
}

export function hitungRanking<T extends KandidatRanking>(kandidat: T[]): Array<T & { ranking: number }> {
  return [...kandidat]
    .sort((a, b) => {
      if (b.skorTotal !== a.skorTotal) return b.skorTotal - a.skorTotal
      const ya = a.nilaiKinerjaY ?? -1
      const yb = b.nilaiKinerjaY ?? -1
      if (yb !== ya) return yb - ya
      return a.pegawaiId - b.pegawaiId
    })
    .map((k, i) => ({ ...k, ranking: i + 1 }))
}

/** Total tertimbang siap tampil, dibulatkan 2 desimal. */
export function totalTertimbang(
  bagian: Array<{ skor: number; bobot: number }>,
): number {
  const total = bagian.reduce((jml, b) => jml + b.skor * b.bobot, 0)
  return bulatkan2(total)
}
