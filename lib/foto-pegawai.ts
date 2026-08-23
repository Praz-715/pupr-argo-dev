import 'server-only'

import { readFile, stat } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { cache } from 'react'

/**
 * Foto pegawai — **data pribadi, jadi TIDAK dilayani sebagai aset statis.**
 *
 * Ini modul kembar `lib/aset-publik.ts`, dan bedanya justru intinya. Lambang
 * kementerian dan foto latar halaman masuk boleh duduk di `public/` karena
 * memang untuk dilihat siapa saja. Foto wajah pegawai tidak: apa pun di
 * `public/` dilayani **tanpa autentikasi sama sekali**, sehingga menaruh 26 foto
 * kepegawaian di sana sama dengan menerbitkannya ke siapa pun yang menebak
 * alamatnya — dan alamatnya bukan tebakan sulit kalau namanya `<nip>.png`,
 * karena NIP bocor di banyak dokumen. Itu pemrosesan data pribadi tanpa dasar
 * (UU PDP No. 27/2022), bukan sekadar kelalaian rapi-rapi.
 *
 * Karena itu berkasnya hidup di direktori yang **tidak** dilayani web server,
 * dan satu-satunya jalan keluarnya adalah `app/api/internal/foto/[nip]` yang
 * memakai aturan keterjangkauan yang SAMA dengan halaman profil.
 *
 * ## Kenapa dari berkas, bukan kolom di `pegawai`
 *
 * Tabel `pegawai` tidak punya kolom foto, dan tidak ditambahi satu di sini.
 * Sumber fotonya adalah berkas Excel kepegawaian yang direvisi berkali-kali;
 * menyimpannya sebagai BLOB berarti setiap revisi jadi migrasi data, sementara
 * sebagai berkas ia cukup ditimpa. Penautannya lewat NIP — kunci alami yang
 * sudah dipakai seluruh aplikasi — jadi tidak ada tabel pemetaan yang bisa
 * berselisih dengan isi direktori.
 *
 * ## Direktorinya bisa dipindah operator
 *
 * `DIR_FOTO_PEGAWAI` (absolut, atau relatif terhadap `process.cwd()`). Bawaannya
 * `doc/data/foto` — tempat `scripts/xlsx-ke-json.py` menaruh hasil ekstraksi,
 * jadi prototipe ini jalan tanpa konfigurasi. **Di produksi arahkan ke luar
 * repositori**: direktori di dalam repo ikut tersalin setiap kali kode di-deploy
 * atau di-clone, dan foto kepegawaian tidak boleh ikut menyebar begitu.
 */

const DIR_BAWAAN = 'doc/data/foto'

function direktori(): string {
  const dari = process.env.DIR_FOTO_PEGAWAI?.trim()
  if (!dari) return join(process.cwd(), DIR_BAWAAN)
  return isAbsolute(dari) ? dari : join(process.cwd(), dari)
}

/**
 * Ekstensi yang dicoba, berurutan.
 *
 * `.png` lebih dulu **bukan** karena PNG lebih disukai, tapi karena berkas hasil
 * ekstraksi sekarang bernama `.png` padahal isinya JPEG — media di dalam `.xlsx`
 * tidak menyimpan tipenya di nama, dan ekstraktornya menamai semuanya `.png`.
 * Karena itu nama berkas TIDAK dipakai untuk menentukan `Content-Type`; lihat
 * `tipeDariIsi()`. Yang penting di sini hanya menemukan berkasnya.
 */
const EKSTENSI = ['.png', '.jpg', '.jpeg', '.webp'] as const

/**
 * NIP hanya boleh 18 digit — ini penjaga path traversal, bukan validasi bisnis.
 *
 * Nilainya masuk langsung ke nama berkas, jadi tanpa penjagaan ini `..%2f..%2f`
 * di URL menjadi pembaca berkas sembarang di server. Regex yang mengizinkan
 * HANYA digit membuat seluruh kelas serangan itu tidak mungkin, tanpa perlu
 * menormalkan path dan berharap normalisasinya benar. Kebetulan `parseNip()`
 * memakai bentuk yang sama, tapi jangan digantikan olehnya: yang satu soal
 * kebenaran data, yang ini soal keamanan berkas, dan keduanya bisa berubah
 * dengan alasan berbeda.
 */
const NIP_BERKAS = /^\d{18}$/

/**
 * Tipe MIME dibaca dari **isi** berkas, bukan ekstensinya.
 *
 * Berkas hasil ekstraksi bernama `.png` tapi berisi JPEG. Menyajikan JPEG
 * dengan `Content-Type: image/png` membuat sebagian peramban menolak
 * merendernya, dan gejalanya (ikon rusak di satu peramban, normal di lain)
 * menyesatkan. Delapan bita pertama sudah cukup membedakan keempat format.
 */
function tipeDariIsi(b: Buffer): string | null {
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    return 'image/png'
  }
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (
    b.length >= 12 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp'
  }
  // Bukan gambar yang dikenali → JANGAN tebak. Menyajikan berkas tak dikenal
  // dengan tipe karangan berarti menyerahkan penafsirannya ke peramban, dan
  // direktori ini diisi manusia lewat berkas — bukan hanya oleh skrip.
  return null
}

async function cariBerkas(nip: string): Promise<string | null> {
  const dir = direktori()
  for (const ext of EKSTENSI) {
    const jalur = join(dir, `${nip}${ext}`)
    try {
      const s = await stat(jalur)
      if (s.isFile()) return jalur
    } catch {
      // Tidak ada / tidak terbaca — coba ekstensi berikutnya. Kesalahan izin
      // direktori sengaja tidak dibedakan dari "tidak ada": keduanya berarti
      // aplikasi tidak punya foto untuk ditampilkan, dan cabang yang berbeda
      // hanya akan jadi cabang yang tidak pernah diuji.
    }
  }
  return null
}

/**
 * Apakah pegawai ini punya foto? Dipakai server component untuk MEMILIH
 * komposisi (foto vs inisial) sebelum HTML-nya dikirim.
 *
 * Sengaja tidak membaca isi berkasnya — hanya `stat`. Halaman profil cuma perlu
 * tahu ada/tidak; membaca 340 KB untuk pertanyaan boolean berarti setiap
 * kunjungan profil menyalin foto ke memori dua kali (sekali di sini, sekali di
 * rute yang benar-benar menyajikannya).
 *
 * `cache()` karena satu render bisa menanyakannya lebih dari sekali.
 */
export const adaFotoPegawai = cache(async (nip: string): Promise<boolean> => {
  if (!NIP_BERKAS.test(nip)) return false
  return (await cariBerkas(nip)) !== null
})

export interface FotoPegawai {
  data: Buffer
  tipe: string
  /** Untuk `ETag` — ukuran + mtime + bentuk hasil olahan, bukan hash isi. */
  cap: string
}

/**
 * Lebar maksimum yang disajikan.
 *
 * Kotak foto di halaman profil 148px; 480 memberi ruang untuk layar 2–3× tanpa
 * tampak lunak. **Ini bukan optimasi spekulatif** — berkas sumbernya terukur
 * sampai **4016×5354 (3,4 MB)** karena diambil dari kamera ponsel lalu
 * ditempelkan ke Excel. Mengirimnya apa adanya berarti 3,4 MB per kunjungan
 * profil untuk kotak 148px; setelah dikecilkan, **19 KB dalam 218 ms**. Di
 * localhost bedanya tak terasa, di jaringan kantor pemerintah ia beda antara
 * halaman yang muncul dan halaman yang dianggap rusak.
 */
const LEBAR_SAJI = 480

/**
 * Hasil olahan disimpan di memori proses, berkunci cap berkas.
 *
 * Tanpa ini setiap kunjungan profil membayar 218 ms CPU untuk gambar yang tidak
 * berubah. Kuncinya memuat mtime+ukuran, jadi menimpa berkasnya di disk otomatis
 * membatalkan entri lamanya — tidak ada cara untuk menyajikan foto basi setelah
 * operator memperbaruinya.
 *
 * Batas 64 entri: populasi nyata 1.872 pegawai, dan cache tanpa batas di proses
 * yang hidup berminggu-minggu adalah kebocoran memori yang tumbuh persis
 * sebanyak orang yang profilnya pernah dibuka. Yang tertua dibuang lebih dulu
 * (`Map` mempertahankan urutan penyisipan).
 */
const CACHE_MAKS = 64
const cacheOlah = new Map<string, FotoPegawai>()

function simpanCache(kunci: string, nilai: FotoPegawai): FotoPegawai {
  if (cacheOlah.size >= CACHE_MAKS) {
    const tertua = cacheOlah.keys().next()
    if (!tertua.done) cacheOlah.delete(tertua.value)
  }
  cacheOlah.set(kunci, nilai)
  return nilai
}

/**
 * Baca fotonya, sudah dikecilkan & siap disajikan. `null` = tidak ada, NIP tidak
 * berbentuk, atau isinya bukan gambar yang dikenali.
 *
 * Keluarannya **selalu JPEG**, apa pun format sumbernya: satu tipe keluaran
 * berarti `Content-Type` tidak lagi bergantung pada isi direktori, dan foto
 * wajah tidak punya area transparan yang perlu dipertahankan PNG. Orientasi
 * diputar menurut EXIF (`rotate()` tanpa argumen) — foto dari ponsel menyimpan
 * potretnya sebagai lanskap + penanda putar, dan tanpa ini sebagian wajah
 * tampil miring 90°.
 */
export async function bacaFotoPegawai(nip: string): Promise<FotoPegawai | null> {
  if (!NIP_BERKAS.test(nip)) return null
  const jalur = await cariBerkas(nip)
  if (jalur === null) return null

  const s = await stat(jalur)
  const cap = `"${s.size.toString(16)}-${s.mtimeMs.toString(16)}-w${LEBAR_SAJI}"`
  const tersimpan = cacheOlah.get(cap)
  if (tersimpan) return tersimpan

  const mentah = await readFile(jalur)
  // Tipe sumber tetap diperiksa SEBELUM diserahkan ke sharp: sharp akan menolak
  // berkas asing dengan galat, dan galat itu jadi 500 di rute — sementara yang
  // benar adalah 404, karena "berkas ini bukan gambar" secara efektif berarti
  // tidak ada foto untuk ditampilkan.
  if (tipeDariIsi(mentah) === null) return null

  const { default: sharp } = await import('sharp')
  const data = await sharp(mentah)
    .rotate()
    .resize({ width: LEBAR_SAJI, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer()

  return simpanCache(cap, { data, tipe: 'image/jpeg', cap })
}
