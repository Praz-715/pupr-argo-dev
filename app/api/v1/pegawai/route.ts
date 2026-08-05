import { bacaPaginasi, tanganiV1 } from '@/lib/api/bungkus'
import { samarkanPegawai, type BarisPegawaiApi } from '@/lib/api/scope'
import { ambilDirektori, UKURAN_HALAMAN_DIREKTORI } from '@/lib/kueri/pegawai'
import { angkaPositif, dariDaftar } from '@/lib/param'

/**
 * `GET /api/v1/pegawai` — daftar pegawai berpaginasi (PRD §7.2).
 *
 * Memakai `ambilDirektori()` yang **sama** dengan halaman Direktori Pegawai. Yang
 * berbeda hanya dua lapisan di atasnya: gerbang Bearer + scope, dan penyamaran
 * `nip`/`nama` untuk klien tanpa dasar hukum data personal (PRD §7.3).
 *
 * Paginasinya mengikuti ukuran halaman kueri internal (25). Membiarkan klien
 * meminta `per_halaman` sembarang akan berarti dua pemahaman berbeda tentang satu
 * kueri — kueri internal sudah memaku `LIMIT`-nya, jadi yang dilaporkan ke klien
 * adalah ukuran yang benar-benar dipakai, bukan yang ia minta.
 */
const ESELON = ['I', 'II', 'III', 'IV', 'NON_ESELON'] as const

export const GET = tanganiV1<BarisPegawaiApi[]>('pegawai', async (ctx) => {
  const { halaman } = bacaPaginasi(ctx.url)
  const q = (n: string) => ctx.url.searchParams.get(n) ?? undefined

  const hasil = await ambilDirektori({
    halaman,
    unitId: angkaPositif(q('unit')),
    eselon: dariDaftar(q('eselon'), ESELON),
    jenjang: q('jenjang')?.slice(0, 60),
    cari: q('cari')?.slice(0, 100),
  })

  const bolehPersonal = ctx.klien.scope.dataPersonal
  return {
    data: hasil.baris.map((b) =>
      samarkanPegawai(
        {
          nip: b.nip,
          nama: b.nama,
          namaJabatan: b.namaJabatan,
          namaUnit: b.namaUnit,
          eselon: b.eselon,
          jenjang: b.jenjang,
          tingkatPendidikan: null,
          potkom: b.potkom,
          nilaiIntegritas: b.nilaiIntegritas,
          predikatKinerja: b.predikatKinerja,
          kotak9: b.kotak9,
        },
        bolehPersonal,
        ctx.idAnonim,
      ),
    ),
    meta: {
      total: hasil.total,
      halaman: hasil.halaman,
      per_halaman: UKURAN_HALAMAN_DIREKTORI,
      total_halaman: Math.ceil(hasil.total / UKURAN_HALAMAN_DIREKTORI),
    },
  }
})
