import 'server-only'

import { randomUUID } from 'node:crypto'
import { mkdir, rename, rm, writeFile } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'

/** Maksimum foto asli yang boleh diunggah (sebelum kompresi). */
export const MAKS_FOTO_BYTES = 5 * 1024 * 1024

export class FotoTidakValid extends Error {}

function direktoriFoto(): string {
  const lokasi = process.env.DIR_FOTO_PEGAWAI?.trim() || 'doc/data/foto'
  return isAbsolute(lokasi) ? lokasi : join(/* turbopackIgnore: true */ process.cwd(), lokasi)
}

/**
 * Mengganti foto berdasarkan NIP, bukan mengubah data pegawai.
 * Penyimpanan NIP.png sengaja sesuai prioritas resolver foto lama;
 * hasil olahan berisi JPEG dan MIME selalu dideteksi dari byte oleh pembaca.
 */
export async function simpanFotoPegawai(
  nip: string,
  berkas: Buffer,
): Promise<{ ukuranBita: number }> {
  if (!/^\d{18}$/.test(nip)) throw new FotoTidakValid('NIP tidak valid.')
  if (!berkas.length || berkas.length > MAKS_FOTO_BYTES) {
    throw new FotoTidakValid('Foto harus berukuran maksimal 5 MB.')
  }

  const { default: sharp } = await import('sharp')
  let hasil: Buffer
  try {
    const gambar = sharp(berkas, { limitInputPixels: 20_000_000, failOn: 'error' })
    const metadata = await gambar.metadata()
    if (!['jpeg', 'png', 'webp'].includes(metadata.format ?? '')) {
      throw new FotoTidakValid('Format foto harus JPEG, PNG, atau WebP.')
    }
    hasil = await gambar
      .rotate()
      .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 82, mozjpeg: true })
      .toBuffer()
  } catch (error) {
    if (error instanceof FotoTidakValid) throw error
    throw new FotoTidakValid('Berkas bukan gambar valid atau resolusinya terlalu besar.')
  }

  const folder = direktoriFoto()
  await mkdir(folder, { recursive: true, mode: 0o700 })
  const tujuan = join(folder, nip + '.png')
  const sementara = join(folder, '.' + nip + '.' + randomUUID() + '.tmp')
  try {
    await writeFile(sementara, hasil, { flag: 'wx', mode: 0o600 })
    await rename(sementara, tujuan)
  } finally {
    await rm(sementara, { force: true })
  }

  return { ukuranBita: hasil.byteLength }
}
