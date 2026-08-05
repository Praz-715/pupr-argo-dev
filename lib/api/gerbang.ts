import 'server-only'

import { createHash } from 'node:crypto'

import { eksekusi, kueriSatu } from '../db'
import { alasanTolak, bacaScope, bolehEndpoint, type EndpointV1, type ScopeAkses } from './scope'
import { bacaHeaderBearer, hashTokenApi } from './token'

/**
 * Gerbang `/api/v1` (Fase 9): autentikasi Bearer → scope → rate limit → jejak.
 *
 * ## Permukaan kedua di atas data yang sama
 *
 * PRD §4.3 poin 6 menetapkannya tegas: `api/v1` dan UI internal adalah **dua
 * permukaan berbeda di atas data yang sama** — yang berbeda hanya lapisan auth &
 * filter scope, bukan kuerinya. Jadi tidak ada kueri baru di Fase 9; endpoint
 * memanggil `lib/kueri/*` yang sama dengan halaman, lalu menyaringnya lewat
 * `lib/api/scope.ts`. Menyalin kuerinya berarti dua definisi populasi yang bisa
 * berselisih, dan instansi eksternal akan menerima angka yang berbeda dari yang
 * dilihat staf DJBK untuk hal yang sama.
 *
 * ## Balasan 401 yang sama untuk semua sebab
 *
 * Token tidak ada, tidak dikenali, dicabut, atau kedaluwarsa → **satu balasan
 * yang sama**. Alasannya identik dengan halaman masuk (Fase 7): balasan yang
 * membedakan "token itu tidak ada" dari "token itu sudah dicabut" mengubah
 * endpoint ini menjadi alat memverifikasi tebakan token. Yang membedakan hanyalah
 * 403 (klien dikenali, tapi scope-nya tidak mencakup) — di sana klien memang perlu
 * tahu apa yang harus diminta ke Super Admin.
 *
 * ## Batas yang jujur: percobaan token asing tidak bisa dicatat di sini
 *
 * `api_activity_log.api_client_id` adalah `NOT NULL`, jadi permintaan dengan token
 * yang **tidak dikenali** tidak punya klien untuk diatribusikan dan tidak bisa
 * masuk tabel itu. Akibatnya "seseorang memindai token secara acak" tidak terlihat
 * di halaman Log Aktivitas API. Menutupnya butuh kolom nullable atau tabel
 * terpisah — keputusan skema, bukan sesuatu yang pantas ditebak di sini. Sampai
 * itu diputuskan, percobaan asing hanya sampai ke log server.
 */

/** Ambang rate limit per klien per menit. */
export const BATAS_PERMINTAAN_PER_MENIT = 120

/**
 * Jeda minimal sebelum `last_used_at` disentuh lagi. Tanpa ini setiap permintaan
 * menulis satu UPDATE — biaya tulis yang tidak menghasilkan informasi baru,
 * karena presisi detik pada "terakhir dipakai" tidak dipakai siapa pun.
 */
const JEDA_SENTUH_DETIK = 60

export interface KlienApi {
  klienId: number
  tokenId: number
  namaInstansi: string
  kodeInstansi: string
  scope: ScopeAkses
}

export type HasilGerbangApi =
  | { ok: true; klien: KlienApi }
  | {
      ok: false
      status: 401 | 403 | 429
      kode: 'TIDAK_TERAUTENTIKASI' | 'SCOPE_TIDAK_MENCAKUP' | 'KLIEN_TIDAK_AKTIF' | 'TERLALU_BANYAK'
      pesan: string
      /** Untuk jejak — null kalau tokennya tidak dikenali sama sekali. */
      klienId: number | null
      tokenId: number | null
    }

const PESAN_401 =
  'Token tidak dikenali, sudah dicabut, atau kedaluwarsa. Hubungi Super Admin SIMT DJBK untuk penerbitan ulang.'

/**
 * Pengenal semu pegawai untuk klien tanpa scope data personal.
 *
 * Di-HMAC dengan `kode_instansi` supaya **tidak bisa dikorelasikan antar klien**:
 * dua instansi yang membandingkan keluaran tidak bisa menyimpulkan bahwa
 * `id_anonim` mereka menunjuk orang yang sama. Tanpa pembeda per klien, pengenal
 * "anonim" justru jadi kunci gabung lintas instansi.
 */
export function pembuatIdAnonim(kodeInstansi: string): (nip: string) => string {
  return (nip: string) =>
    createHash('sha256').update(`${kodeInstansi}:${nip}`).digest('hex').slice(0, 16)
}

export async function gerbangApi(
  permintaan: Request,
  endpoint: EndpointV1,
): Promise<HasilGerbangApi> {
  const token = bacaHeaderBearer(permintaan.headers.get('authorization'))
  if (!token) {
    return {
      ok: false,
      status: 401,
      kode: 'TIDAK_TERAUTENTIKASI',
      pesan: PESAN_401,
      klienId: null,
      tokenId: null,
    }
  }

  // Satu kueri: token + klien + status keduanya. Tenggat diperiksa DI DALAM SQL
  // yang sama supaya jam yang menilai kedaluwarsa adalah jam yang sama dengan
  // yang menuliskannya (pelajaran `lib/sesi.ts`: dua jam berbeda beberapa detik
  // menghasilkan token yang kadang hidup kadang mati tanpa pola).
  const baris = await kueriSatu<Record<string, unknown>>(
    `SELECT t.id AS token_id, t.status AS status_token,
            (t.expired_at IS NOT NULL AND t.expired_at <= NOW()) AS kedaluwarsa,
            (t.last_used_at IS NULL OR t.last_used_at < DATE_SUB(NOW(), INTERVAL ? SECOND)) AS perlu_sentuh,
            c.id AS klien_id, c.nama_instansi, c.kode_instansi, c.status AS status_klien,
            c.scope_akses
       FROM api_token t
       JOIN api_client c ON c.id = t.api_client_id
      WHERE t.token_hash = ?
      LIMIT 1`,
    [JEDA_SENTUH_DETIK, hashTokenApi(token)],
  )

  if (
    baris === null ||
    String(baris.status_token) !== 'AKTIF' ||
    Number(baris.kedaluwarsa) === 1
  ) {
    return {
      ok: false,
      status: 401,
      kode: 'TIDAK_TERAUTENTIKASI',
      pesan: PESAN_401,
      // Token dikenali tapi mati tetap dicatat: pemakaian token yang sudah
      // dicabut adalah tanda integrasi lama yang belum diperbarui — atau
      // kredensial yang bocor dan masih dicoba.
      klienId: baris === null ? null : Number(baris.klien_id),
      tokenId: baris === null ? null : Number(baris.token_id),
    }
  }

  const klienId = Number(baris.klien_id)
  const tokenId = Number(baris.token_id)
  const kodeInstansi = String(baris.kode_instansi)

  if (String(baris.status_klien) !== 'AKTIF') {
    return {
      ok: false,
      status: 403,
      kode: 'KLIEN_TIDAK_AKTIF',
      pesan: `Klien "${kodeInstansi}" berstatus ${String(baris.status_klien)}. Akses API hanya terbuka untuk klien berstatus AKTIF dengan dasar hukum (MoU/PKS) yang tercatat.`,
      klienId,
      tokenId,
    }
  }

  const scope = bacaScope(baris.scope_akses)
  if (!bolehEndpoint(scope, endpoint)) {
    return {
      ok: false,
      status: 403,
      kode: 'SCOPE_TIDAK_MENCAKUP',
      pesan: alasanTolak(scope, endpoint),
      klienId,
      tokenId,
    }
  }

  const dipakai = await hitungPermintaanSemenit(klienId)
  if (dipakai >= BATAS_PERMINTAAN_PER_MENIT) {
    return {
      ok: false,
      status: 429,
      kode: 'TERLALU_BANYAK',
      pesan: `Batas ${BATAS_PERMINTAAN_PER_MENIT} permintaan per menit terlampaui. Coba lagi sebentar lagi.`,
      klienId,
      tokenId,
    }
  }

  if (Number(baris.perlu_sentuh) === 1) {
    await eksekusi('UPDATE api_token SET last_used_at = NOW() WHERE id = ?', [tokenId])
  }

  return {
    ok: true,
    klien: {
      klienId,
      tokenId,
      namaInstansi: String(baris.nama_instansi),
      kodeInstansi,
      scope,
    },
  }
}

/**
 * Rate limit dihitung dari `api_activity_log`, **bukan** dari penghitung di memori.
 *
 * Alasannya sama dengan penghambat tebak-sandi di Fase 7 yang ditaruh di baris
 * pengguna: Next.js bisa berjalan lebih dari satu instans, dan penghitung
 * per-proses berarti batasnya terkalikan jumlah instans tanpa ada yang
 * menyadarinya. Tabel jejaknya sudah ada, sudah ditulis setiap permintaan, dan
 * sudah punya indeks `(api_client_id, created_at)` — jadi ini tidak menambah
 * tabel maupun kueri yang mahal.
 */
async function hitungPermintaanSemenit(klienId: number): Promise<number> {
  const r = await kueriSatu<{ n: number }>(
    `SELECT COUNT(*) AS n FROM api_activity_log
      WHERE api_client_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 MINUTE)`,
    [klienId],
  )
  return Number(r?.n ?? 0)
}

/**
 * Catat setiap permintaan — berhasil maupun ditolak.
 *
 * Gagal menulis jejak **tidak boleh** menjatuhkan balasan yang sudah benar
 * (perlakuan yang sama dengan `audit_log`), tapi juga tidak boleh senyap.
 */
export async function catatAktivitasApi(a: {
  klienId: number
  tokenId: number | null
  endpoint: string
  method: string
  responseCode: number
  responseTimeMs: number
  ip: string | null
}): Promise<void> {
  try {
    await eksekusi(
      `INSERT INTO api_activity_log
         (api_client_id, api_token_id, endpoint, method, response_code, response_time_ms, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        a.klienId,
        a.tokenId,
        a.endpoint.slice(0, 200),
        a.method.slice(0, 10),
        a.responseCode,
        a.responseTimeMs,
        a.ip?.slice(0, 45) ?? null,
      ],
    )
  } catch (e) {
    console.error(
      `[api] GAGAL mencatat aktivitas klien ${a.klienId} pada ${a.endpoint} (${a.responseCode}):`,
      e,
    )
  }
}

/** IP pemanggil. Di belakang proxy `x-forwarded-for` berisi rantai; ambil yang pertama. */
export function ipPermintaan(permintaan: Request): string | null {
  const rantai = permintaan.headers.get('x-forwarded-for')
  if (rantai) return rantai.split(',')[0]!.trim().slice(0, 45)
  return permintaan.headers.get('x-real-ip')?.slice(0, 45) ?? null
}
