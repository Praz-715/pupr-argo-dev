/**
 * Satu-satunya sumber format tampilan (id-ID). Jangan bikin formatter lokal
 * di komponen — kalau butuh format baru, tambahkan di sini (CLAUDE.md §1).
 */

const nfAngka = new Intl.NumberFormat('id-ID')
const nfSkor = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const nfSkorRingkas = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})
const nfPersen = new Intl.NumberFormat('id-ID', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
})

/** Bilangan bulat: 1872 → "1.872" */
export function formatAngka(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return nfAngka.format(n)
}

/** Skor 2 desimal: 98.5 → "98,50" */
export function formatSkor(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return nfSkor.format(n)
}

/** Skor ringkas untuk kartu/chart: 98.5 → "98,5" · 100 → "100" */
export function formatSkorRingkas(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return '—'
  return nfSkorRingkas.format(n)
}

/** Rasio 0–1 → persen. 0.625 → "62,5%" */
export function formatPersen(rasio: number | null | undefined): string {
  if (rasio === null || rasio === undefined || Number.isNaN(rasio)) return '—'
  return `${nfPersen.format(rasio * 100)}%`
}

/** Sudah dalam satuan persen (0–100). 62.5 → "62,5%" */
export function formatPersenNilai(nilai: number | null | undefined): string {
  if (nilai === null || nilai === undefined || Number.isNaN(nilai)) return '—'
  return `${nfPersen.format(nilai)}%`
}

/** Bobot rubrik tersimpan 0–1 → tampil sebagai persen bulat. 0.65 → "65%" */
export function formatBobot(bobot: number | null | undefined): string {
  if (bobot === null || bobot === undefined || Number.isNaN(bobot)) return '—'
  return `${nfPersen.format(bobot * 100)}%`
}

const BULAN_PANJANG = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const

const BULAN_SINGKAT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des',
] as const

function keDate(nilai: Date | string | null | undefined): Date | null {
  if (nilai === null || nilai === undefined || nilai === '') return null
  const d = nilai instanceof Date ? nilai : new Date(nilai)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 2025-07-18 → "18 Jul 2025" */
export function formatTanggal(nilai: Date | string | null | undefined): string {
  const d = keDate(nilai)
  if (!d) return '—'
  return `${d.getDate()} ${BULAN_SINGKAT[d.getMonth()]} ${d.getFullYear()}`
}

/** 2025-07-18 → "18 Juli 2025" */
export function formatTanggalPanjang(nilai: Date | string | null | undefined): string {
  const d = keDate(nilai)
  if (!d) return '—'
  return `${d.getDate()} ${BULAN_PANJANG[d.getMonth()]} ${d.getFullYear()}`
}

/** 2026-07-30T14:05 → "30 Jul 2026, 14.05" */
export function formatTanggalWaktu(nilai: Date | string | null | undefined): string {
  const d = keDate(nilai)
  if (!d) return '—'
  const jam = String(d.getHours()).padStart(2, '0')
  const menit = String(d.getMinutes()).padStart(2, '0')
  return `${formatTanggal(d)}, ${jam}.${menit}`
}

/** 2025-07 → "Jul 2025" (untuk TMT yang hanya punya bulan & tahun) */
export function formatBulanTahun(tahun: number, bulan1sd12: number): string {
  const idx = Math.min(Math.max(bulan1sd12, 1), 12) - 1
  return `${BULAN_SINGKAT[idx]} ${tahun}`
}

/** NIP dikelompokkan supaya terbaca: "19780525 199803 2 005" */
export function formatNip(nip: string | null | undefined): string {
  if (!nip) return '—'
  const bersih = nip.replace(/\D/g, '')
  if (bersih.length !== 18) return nip
  return `${bersih.slice(0, 8)} ${bersih.slice(8, 14)} ${bersih.slice(14, 15)} ${bersih.slice(15)}`
}

/** "1,4 tahun" · "8 bulan" — untuk masa jabatan/masa kerja */
export function formatDurasiTahun(tahun: number | null | undefined): string {
  if (tahun === null || tahun === undefined || Number.isNaN(tahun)) return '—'
  if (tahun < 1) {
    const bulan = Math.round(tahun * 12)
    return `${formatAngka(bulan)} bulan`
  }
  return `${nfSkorRingkas.format(tahun)} tahun`
}

/** Durasi milidetik → "142 ms" · "1,4 s" (untuk log aktivitas API) */
export function formatDurasiMs(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—'
  if (ms < 1000) return `${formatAngka(Math.round(ms))} ms`
  return `${nfSkorRingkas.format(ms / 1000)} s`
}

/** ENUM DB (SNAKE_CASE) → label manusia. "MENUNGGU_VERIFIKASI" → "Menunggu Verifikasi" */
export function formatEnum(nilai: string | null | undefined): string {
  if (!nilai) return '—'
  return nilai
    .toLowerCase()
    .split(/[_\s]+/)
    .map((kata) => (kata.length > 0 ? kata[0]!.toUpperCase() + kata.slice(1) : kata))
    .join(' ')
}

/** Jenjang pendidikan ENUM → label. "S1_D4" → "S1/D4" */
export function formatTingkatPendidikan(nilai: string | null | undefined): string {
  if (!nilai) return '—'
  return nilai === 'S1_D4' ? 'S1/D4' : nilai
}

/** Inisial untuk avatar: "Martyanti R.B. Sianturi" → "MS" */
export function inisial(nama: string | null | undefined): string {
  if (!nama) return '?'
  const bagian = nama.trim().split(/\s+/).filter(Boolean)
  if (bagian.length === 0) return '?'
  if (bagian.length === 1) return bagian[0]!.slice(0, 2).toUpperCase()
  return (bagian[0]![0]! + bagian[bagian.length - 1]![0]!).toUpperCase()
}
