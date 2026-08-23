import { getCurrentUser } from '@/lib/auth'
import { bacaFotoPegawai } from '@/lib/foto-pegawai'
import { ambilProfil } from '@/lib/kueri/pegawai'
import { lingkupData, unitWajib } from '@/lib/lingkup'

/**
 * `GET /api/internal/foto/<nip>` — foto pegawai, **di belakang sesi**.
 *
 * ## Kenapa ada rute untuk ini
 *
 * Foto wajah adalah data pribadi, jadi berkasnya tidak boleh duduk di `public/`
 * yang dilayani tanpa autentikasi (alasan lengkapnya di `lib/foto-pegawai.ts`).
 * Satu-satunya cara memasang gambar yang tetap berpenjaga adalah rute yang
 * memeriksa sesi lalu mengalirkan bitanya sendiri.
 *
 * ## Penjaganya BUKAN definisi baru
 *
 * Yang berhak melihat foto seseorang adalah yang berhak melihat profilnya —
 * jadi rute ini memanggil `ambilProfil(nip, unitWajib(...))`, fungsi yang sama
 * dengan halaman profil. Menuliskan ulang aturannya di sini ("cek unit
 * pengguna") akan jadi salinan kedua yang berselisih begitu salah satu berubah,
 * dan yang berselisih diam-diam di jalur gambar tidak akan terlihat oleh siapa
 * pun. Sekalian ikut: **saringan populasi** — pegawai yang tidak ada di
 * eNominasi tidak punya profil yang bisa dibuka, jadi fotonya juga tidak keluar.
 *
 * **404 untuk semua penolakan**, bukan 403. Alasannya sama dengan `notFound()`
 * di halaman profil: 403 mengonfirmasi "orang ini ada, Anda cuma tidak boleh
 * melihatnya" kepada yang tidak berhak tahu, sementara NIP bisa ditebak dari
 * pola tanggal lahir. 401 hanya dipakai untuk sesi yang habis, yaitu keadaan
 * yang tidak membocorkan apa pun tentang siapa yang ada di sistem.
 *
 * ## Cache
 *
 * `private` — supaya proxy bersama tidak pernah menyimpan wajah orang, dan
 * jawaban untuk satu pengguna tidak bisa dilayani ke pengguna lain yang lingkup
 * unitnya berbeda. `max-age` pendek dengan `ETag`: fotonya jarang berubah, tapi
 * pencabutan hak akses harus terasa dalam hitungan menit, bukan hari.
 */
export async function GET(
  permintaan: Request,
  { params }: { params: Promise<{ nip: string }> },
) {
  const pengguna = await getCurrentUser()
  if (!pengguna) return new Response('Sesi sudah berakhir.', { status: 401 })

  const { nip } = await params

  const profil = await ambilProfil(nip, unitWajib(lingkupData(pengguna)))
  if (!profil) return new Response('Tidak ditemukan.', { status: 404 })

  const foto = await bacaFotoPegawai(nip)
  if (!foto) return new Response('Tidak ditemukan.', { status: 404 })

  // 304 kalau peramban sudah memegang versi ini — foto profil ikut terender di
  // setiap kunjungan halaman, dan 340 KB per kunjungan tidak perlu diulang.
  if (permintaan.headers.get('if-none-match') === foto.cap) {
    return new Response(null, {
      status: 304,
      headers: { ETag: foto.cap, 'Cache-Control': 'private, max-age=300, must-revalidate' },
    })
  }

  return new Response(new Uint8Array(foto.data), {
    headers: {
      'Content-Type': foto.tipe,
      'Content-Length': String(foto.data.byteLength),
      ETag: foto.cap,
      'Cache-Control': 'private, max-age=300, must-revalidate',
      // Foto ini untuk dilihat di halaman, bukan diunduh sebagai berkas — dan
      // `nosniff` menutup celah kalau suatu hari ada berkas yang lolos
      // pemeriksaan tipe.
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
