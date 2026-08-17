import 'server-only'

import { SkemaBalasanEnom, type RekamanEnom } from './tipe'

/**
 * Klien API eNominasi (`karir.pu.go.id/enom`) — sumber Penilaian Kinerja &
 * Potensi/Kompetensi.
 *
 * **Status keputusan:** PRD §10 / CLAUDE.md §"Keputusan yang MENUNGGU pemilik
 * proses" nomor 5 masih mempertanyakan sumber mana yang dipakai —
 * `ekinerja.pu.go.id` (dokumen lama) atau `karir.pu.go.id/enom` (`sample(1).md`,
 * 4 lembar). Modul ini **membaca saja** dan tidak pernah menulis ke DB; ia ada
 * supaya keputusan itu bisa diambil dari data nyata, bukan dari dua dokumen yang
 * bertentangan. Jalur tulisnya sengaja belum dibuat.
 *
 * Kredensial WAJIB dari env. Berkas contoh yang beredar (`enom_api_bikon.php`)
 * menuliskan `X-Secret` langsung di kode — jangan diikuti; kunci di dalam kode
 * ikut ke mana pun kodenya pergi.
 *
 * **Setiap panggilan tercatat di sisi eNom**: balasannya sendiri memuat `infoip`
 * dan `waktu_ambil`, jadi jejaknya ada di sana. Pengujian bervolume perlu
 * sepengetahuan pengelola eNom.
 */

const URL_BAWAAN = 'https://karir.pu.go.id/enom/api/cekdata_bikon'

/**
 * NIP per permintaan. **SATU, dan ini bukan sikap hati-hati — ini paksaan.**
 *
 * Parameter `nip` di eNom berbentuk array, tapi sumbernya **hanya memproses
 * elemen PERTAMA** dan mengabaikan sisanya tanpa pesan apa pun. Terukur:
 *
 *   [ADA]            → 1 rekaman
 *   [ADA, tidak-ada] → 1 rekaman        (yang kedua diabaikan)
 *   [tidak-ada, ADA] → 0 rekaman + "data nip tidak ditemukam"   ← ADA hilang
 *   [tidak-ada, ×2, ADA] → 0 rekaman
 *
 * Ini mode kegagalan yang paling berbahaya dari semua yang mungkin: mengirim
 * 50 NIP **berhasil** (HTTP 200, `status:true`) sambil diam-diam hanya
 * menjawab satu. Sinkronisasi 1.872 pegawai dengan batch 50 akan melaporkan
 * "sukses" untuk 38 permintaan sementara 1.834 orang tidak pernah ditanyakan —
 * dan tidak ada satu pun galat yang menandainya.
 *
 * Versi pertama modul ini memakai 50 dan karena itu menyimpulkan "0 dari 44 NIP
 * ada di eNom", padahal yang diperiksa cuma NIP pertama. Kalau suatu hari
 * sumbernya benar-benar mendukung batch, naikkan `ENOM_BATCH` — TAPI buktikan
 * dulu dengan menaruh NIP yang diketahui ADA di posisi TERAKHIR, bukan pertama.
 */
const BATCH_BAWAAN = 1

export type SebabGalatEnom =
  /** Env belum diisi — bukan masalah jaringan, dan pesannya harus beda. */
  | 'konfigurasi'
  /** DNS/TCP/TLS/timeout — sumber tidak terjangkau. */
  | 'jaringan'
  /** X-Secret ditolak. */
  | 'auth'
  /** Terjangkau & terautentikasi, tapi menjawab gagal atau bentuknya asing. */
  | 'balasan'

export class GalatEnom extends Error {
  constructor(
    readonly sebab: SebabGalatEnom,
    pesan: string,
    readonly rinci?: unknown,
  ) {
    super(pesan)
    this.name = 'GalatEnom'
  }
}

interface Konfigurasi {
  url: string
  secret: string
  timeoutMs: number
  batch: number
}

/**
 * Baca konfigurasi dari env. Dipisah dari pemanggilan supaya `uji-enom`
 * bisa melaporkan "env belum diisi" **tanpa** menyentuh jaringan — kegagalan
 * konfigurasi yang menyamar sebagai kegagalan jaringan adalah salah satu cara
 * tercepat menghabiskan waktu saat integrasi baru dipasang.
 */
export function bacaKonfigurasi(): Konfigurasi {
  const secret = process.env.ENOM_SECRET?.trim()
  if (!secret) {
    throw new GalatEnom(
      'konfigurasi',
      'ENOM_SECRET belum diisi. Salin dari .env.example lalu isi di .env.local.',
    )
  }
  return {
    url: process.env.ENOM_URL?.trim() || URL_BAWAAN,
    secret,
    timeoutMs: Number(process.env.ENOM_TIMEOUT_MS) || 30_000,
    batch: Number(process.env.ENOM_BATCH) || BATCH_BAWAAN,
  }
}

/** Satu permintaan HTTP. Tidak memotong batch — itu tugas `ambilAsesmen`. */
async function panggil(nip: readonly string[], cfg: Konfigurasi): Promise<RekamanEnom[]> {
  // AbortSignal, bukan mengandalkan timeout bawaan: `fetch` Node tidak punya
  // batas waktu total, jadi sumber yang menerima koneksi lalu diam akan
  // menggantung permintaan selamanya — dan di jalur sinkronisasi itu berarti
  // job yang tidak pernah selesai tanpa satu pun galat.
  const batal = AbortSignal.timeout(cfg.timeoutMs)

  let res: Response
  try {
    res = await fetch(cfg.url, {
      method: 'POST',
      headers: {
        'X-Secret': cfg.secret,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nip }),
      signal: batal,
      cache: 'no-store',
    })
  } catch (e) {
    throw new GalatEnom(
      'jaringan',
      `Tidak bisa menghubungi eNom (${cfg.url}): ${e instanceof Error ? e.message : String(e)}`,
      e,
    )
  }

  const teks = await res.text()

  if (res.status === 401 || res.status === 403) {
    throw new GalatEnom('auth', `X-Secret ditolak eNom (HTTP ${res.status}): ${teks.slice(0, 200)}`)
  }

  let mentah: unknown
  try {
    mentah = JSON.parse(teks)
  } catch {
    // Bukan JSON hampir selalu berarti halaman HTML — portal error, WAF, atau
    // captive portal. Potongan teksnya jauh lebih berguna daripada pesan parser.
    throw new GalatEnom(
      'balasan',
      `Balasan eNom bukan JSON (HTTP ${res.status}): ${teks.slice(0, 200)}`,
    )
  }

  const hasil = SkemaBalasanEnom.safeParse(mentah)
  if (!hasil.success) {
    throw new GalatEnom('balasan', 'Bentuk balasan eNom tidak dikenali.', hasil.error.issues)
  }

  // `status:false` bisa datang dengan HTTP 200 — memeriksa kode HTTP saja akan
  // memperlakukan penolakan sebagai keberhasilan berisi nol baris.
  if (!hasil.data.status) {
    const pesan = hasil.data.message ?? 'tanpa pesan'

    // "data nip tidak ditemukam" (typo milik sumber) BUKAN kegagalan — itu
    // hasil KOSONG. Diuji: `[nip_ada, nip_tidak_ada]` tetap menjawab
    // `status:true` berisi yang ada; pesan ini hanya muncul ketika TIDAK SATU
    // PUN NIP ditemukan. Memperlakukannya sebagai galat berarti sinkronisasi
    // 2.000 pegawai berhenti hanya karena satu batch kebetulan berisi orang
    // yang semuanya belum diasesmen — kejadian yang wajar, bukan kerusakan.
    if (/tidak ditemuka[nm]/i.test(pesan)) return []

    const sebab: SebabGalatEnom = /unauthor|secret|token/i.test(pesan) ? 'auth' : 'balasan'
    throw new GalatEnom(sebab, `eNom menolak permintaan: ${pesan}`)
  }

  // Sumber memulangkan HANYA NIP yang ketemu — tanpa penanda apa pun untuk yang
  // tidak ketemu. Jadi "siapa yang tidak ada di eNom" harus disimpulkan pemanggil
  // dengan membandingkan daftar yang diminta vs yang dijawab; jangan berharap
  // ada baris kosong atau field status per-NIP.
  return hasil.data.data?.detail ?? []
}

/**
 * Ambil asesmen untuk sekumpulan NIP — **satu permintaan HTTP per NIP**, karena
 * sumbernya hanya memproses NIP pertama (lihat `BATCH_BAWAAN`).
 *
 * Konsekuensi yang harus disadari sebelum menjalankannya untuk seluruh
 * populasi: 1.872 pegawai = 1.872 permintaan. Pada ~250 ms/permintaan itu
 * sekitar **8 menit** berurutan, dan **setiap permintaan tercatat di sisi
 * eNom**. Jadi sinkronisasi penuh adalah pekerjaan yang perlu disepakati dengan
 * pengelolanya, bukan sesuatu yang dijalankan sambil lalu. Untuk mempercepatnya
 * jangan menaikkan batch (tidak berpengaruh) — yang bisa dinaikkan hanya
 * paralelisme, dan itu keputusan beban di sisi mereka.
 *
 * Kegagalan satu NIP TIDAK membatalkan sisanya: yang batal hanya NIP itu,
 * supaya 1.872 NIP tidak hangus karena satu yang bermasalah.
 */
export async function ambilAsesmen(
  nip: readonly string[],
  opsi: { konfigurasi?: Konfigurasi } = {},
): Promise<{ rekaman: RekamanEnom[]; gagal: { nip: string[]; galat: GalatEnom }[] }> {
  const cfg = opsi.konfigurasi ?? bacaKonfigurasi()
  const unik = [...new Set(nip.map((n) => n.trim()).filter(Boolean))]

  const rekaman: RekamanEnom[] = []
  const gagal: { nip: string[]; galat: GalatEnom }[] = []

  for (let i = 0; i < unik.length; i += cfg.batch) {
    const potong = unik.slice(i, i + cfg.batch)
    try {
      rekaman.push(...(await panggil(potong, cfg)))
    } catch (e) {
      if (!(e instanceof GalatEnom)) throw e
      // Galat auth & konfigurasi berlaku untuk SEMUA batch — meneruskan sisanya
      // hanya menghasilkan ratusan kegagalan identik dan membanjiri log eNom.
      if (e.sebab === 'auth' || e.sebab === 'konfigurasi') throw e
      gagal.push({ nip: potong, galat: e })
    }
  }

  return { rekaman, gagal }
}
