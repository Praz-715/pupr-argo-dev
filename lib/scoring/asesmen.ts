import { MASA_BERLAKU_ASESMEN_TAHUN_DEFAULT } from './konstanta'
import type { StatusAsesmen } from './types'

/**
 * Masa berlaku asesmen (phase.md §2.9).
 *
 * Blueprint menandai "Status Asesmen Valid & Masa Berlaku" 🟡 — belum ada
 * aturannya. Jadi `isExpired` dihitung TURUNAN dari umur asesmen, dan kolom
 * `status_asesmen` dari sumber dipakai sebagai pembanding. Masa berlakunya
 * parameter, bukan konstanta tersebar.
 */

export interface HasilMasaBerlaku {
  kedaluwarsa: boolean
  umurTahun: number
  tahunKedaluwarsa: number
  statusSumber: StatusAsesmen | null
  /** true bila status dari sumber tidak sejalan dengan hitungan umur. */
  bedaDenganSumber: boolean
  keterangan: string | null
}

export function evaluasiMasaBerlaku(
  tahunAsesmen: number,
  statusSumber: StatusAsesmen | null | undefined,
  opsi: { tahunSekarang?: number; masaBerlakuTahun?: number } = {},
): HasilMasaBerlaku {
  const tahunSekarang = opsi.tahunSekarang ?? new Date().getFullYear()
  const masaBerlaku = opsi.masaBerlakuTahun ?? MASA_BERLAKU_ASESMEN_TAHUN_DEFAULT

  const umurTahun = tahunSekarang - tahunAsesmen
  const kedaluwarsa = umurTahun > masaBerlaku
  const tahunKedaluwarsa = tahunAsesmen + masaBerlaku

  const status = statusSumber ?? null
  // Status "Draft" bukan soal umur, jadi tidak dibandingkan.
  const sumberBilangExpired = status === 'Expired'
  const bedaDenganSumber =
    status !== null && status !== 'Draft' && sumberBilangExpired !== kedaluwarsa

  return {
    kedaluwarsa,
    umurTahun,
    tahunKedaluwarsa,
    statusSumber: status,
    bedaDenganSumber,
    keterangan: bedaDenganSumber
      ? `Status sumber "${status}" tidak sejalan dengan umur asesmen (${umurTahun} tahun, masa berlaku ${masaBerlaku} tahun)`
      : null,
  }
}

/** Asesmen layak dipakai untuk penilaian talent pool? */
export function asesmenLayakDipakai(
  tahunAsesmen: number,
  statusSumber: StatusAsesmen | null | undefined,
  opsi: { tahunSekarang?: number; masaBerlakuTahun?: number } = {},
): boolean {
  if (statusSumber === 'Draft') return false
  return !evaluasiMasaBerlaku(tahunAsesmen, statusSumber, opsi).kedaluwarsa
}
