import { revalidatePath } from 'next/cache'

import { jalankanMutasi } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'
import { pegawaiTerjangkau } from '@/lib/aksi/lingkup-data'
import { adaFotoPegawai } from '@/lib/foto-pegawai'
import { FotoTidakValid, MAKS_FOTO_BYTES, simpanFotoPegawai } from '@/lib/foto-pegawai-upload'
import { ambilProfil } from '@/lib/kueri/pegawai'
import { lingkupData, unitWajib } from '@/lib/lingkup'
import { punyaPeran } from '@/lib/peran'

const PERAN_EDITOR = ['Super Admin', 'Admin Talenta', 'Pengelola Unit'] as const

function jawab(pesan: string, status: number) {
  return Response.json({ ok: false, pesan }, { status, headers: { 'Cache-Control': 'no-store' } })
}

/** POST /api/internal/foto/[nip]/unggah: foto privat, role + unit dijaga di server. */
export async function POST(request: Request, { params }: { params: Promise<{ nip: string }> }) {
  const pengguna = await getCurrentUser()
  if (!pengguna) return jawab('Sesi telah berakhir. Masuk lagi.', 401)
  if (!punyaPeran(pengguna, PERAN_EDITOR)) return jawab('Anda tidak berwenang mengganti foto.', 403)

  // Upload menggunakan sesi cookie: blok request lintas-origin (CSRF).
  const origin = request.headers.get('origin')
  const host = request.headers.get('host')
  if (!origin || !host || (() => {
    try { return new URL(origin).host !== host } catch { return true }
  })()) return jawab('Asal permintaan tidak valid.', 403)

  const { nip } = await params
  if (!/^\d{18}$/.test(nip)) return jawab('Pegawai tidak ditemukan.', 404)
  const profil = await ambilProfil(nip, unitWajib(lingkupData(pengguna)))
  if (!profil) return jawab('Pegawai tidak ditemukan.', 404)
  if (!(await pegawaiTerjangkau(profil.pegawaiId))) {
    return jawab('Pegawai tidak ditemukan.', 404)
  }

  const ukuranRequest = Number(request.headers.get('content-length'))
  if (Number.isFinite(ukuranRequest) && ukuranRequest > MAKS_FOTO_BYTES + 1024 * 100) {
    return jawab('Foto maksimal 5 MB.', 413)
  }

  let berkas: FormDataEntryValue | null
  try {
    const data = await request.formData()
    berkas = data.get('foto')
  } catch {
    return jawab('Form unggahan tidak valid.', 400)
  }
  if (!(berkas instanceof File) || !berkas.size) return jawab('Pilih foto terlebih dahulu.', 400)
  if (berkas.size > MAKS_FOTO_BYTES) return jawab('Foto maksimal 5 MB.', 413)
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(berkas.type)) {
    return jawab('Gunakan foto JPEG, PNG, atau WebP.', 415)
  }

  try {
    const buffer = Buffer.from(await berkas.arrayBuffer())
    const diganti = await jalankanMutasi<{ nip: string; adaFoto: boolean; ukuranBita?: number }>({
      entitas: 'foto_pegawai',
      aksi: 'UBAH',
      peranDiizinkan: PERAN_EDITOR,
      sebelum: async () => ({ nip, adaFoto: await adaFotoPegawai(nip) }),
      jalankan: async () => {
        const disimpan = await simpanFotoPegawai(nip, buffer)
        return {
          entitasId: profil.pegawaiId,
          sesudah: { nip, adaFoto: true, ukuranBita: disimpan.ukuranBita },
        }
      },
    })
    revalidatePath('/talenta/' + nip)
    return Response.json({ ok: true, pesan: 'Foto pegawai berhasil diperbarui.', ukuranBita: diganti.sesudah?.ukuranBita }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof FotoTidakValid) return jawab(error.message, 400)
    console.error('Gagal menyimpan foto pegawai:', error)
    return jawab('Foto tidak dapat disimpan. Hubungi administrator.', 500)
  }
}
