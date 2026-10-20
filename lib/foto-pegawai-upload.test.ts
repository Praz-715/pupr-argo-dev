import { describe, expect, it, vi } from 'vitest'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import sharp from 'sharp'

vi.mock('server-only', () => ({}))
import { FotoTidakValid, simpanFotoPegawai } from './foto-pegawai-upload'

const nip = '199001012020011001'

describe('upload foto pegawai', () => {
  it('menolak NIP dan berkas yang tidak valid', async () => {
    const image = await sharp({ create: { width: 16, height: 16, channels: 3, background: 'white' } }).png().toBuffer()
    await expect(simpanFotoPegawai('invalid', image)).rejects.toBeInstanceOf(FotoTidakValid)
    await expect(simpanFotoPegawai(nip, Buffer.from('invalid-image'))).rejects.toBeInstanceOf(FotoTidakValid)
  })
  it('menyimpan dan mengganti gambar menjadi JPEG', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'foto-test-'))
    process.env.DIR_FOTO_PEGAWAI = dir
    try {
      const a = await sharp({ create: { width: 40, height: 50, channels: 3, background: 'red' } }).png().toBuffer()
      const b = await sharp({ create: { width: 60, height: 70, channels: 3, background: 'blue' } }).webp().toBuffer()
      await simpanFotoPegawai(nip, a)
      await simpanFotoPegawai(nip, b)
      const stored = await readFile(join(dir, nip + '.png'))
      const meta = await sharp(stored).metadata()
      expect(meta.format).toBe('jpeg')
      expect(meta.width).toBe(60)
      expect(meta.height).toBe(70)
    } finally {
      delete process.env.DIR_FOTO_PEGAWAI
      await rm(dir, { recursive: true, force: true })
    }
  })
})
