import 'server-only'

import {
  catatAktivitasApi,
  gerbangApi,
  ipPermintaan,
  pembuatIdAnonim,
  type KlienApi,
} from './gerbang'
import type { EndpointV1 } from './scope'

/**
 * Pembungkus route `/api/v1` — satu tempat yang menjamin **setiap** endpoint
 * melewati gerbang dan **setiap** permintaan tercatat.
 *
 * Kenapa pembungkus, bukan memanggil `gerbangApi()` di tiap handler: endpoint
 * kelima yang lupa memanggilnya tidak akan menghasilkan galat apa pun — ia hanya
 * melayani data tanpa memeriksa scope, dan tidak meninggalkan jejak. Bentuk yang
 * bisa dilupakan adalah bentuk yang akan dilupakan. Di sini handler-nya bahkan
 * tidak menerima `Request` mentah untuk auth; ia menerima klien yang **sudah**
 * terverifikasi.
 *
 * Bentuk balasan galat juga diseragamkan di sini. Klien eksternal menulis
 * penanganan galat terhadap bentuk yang ia lihat pertama kali; kalau tiap endpoint
 * mengarang bentuknya sendiri, bentuk itu ikut jadi kontrak tanpa pernah
 * diputuskan.
 */

/**
 * Galat yang **sengaja** dilempar handler untuk membalas selain 200.
 *
 * Dilempar, bukan di-`return`: handler mengembalikan `BalasanApi` yang bentuknya
 * sudah dipatok, dan menambahkan varian galat ke tipe itu memaksa setiap endpoint
 * lain memikirkan cabang yang tidak pernah mereka pakai. Yang penting, galat
 * bertipe ini **tetap tercatat** di `api_activity_log` dengan status yang benar —
 * berbeda dari galat tak terduga yang jadi 500.
 */
export class GalatApi extends Error {
  constructor(
    readonly status: 400 | 403 | 404,
    readonly kode: string,
    pesan: string,
  ) {
    super(pesan)
  }
}

export class GalatPermintaan extends GalatApi {
  constructor(pesan: string) {
    super(400, 'PERMINTAAN_TIDAK_SAH', pesan)
  }
}

export class GalatTidakAda extends GalatApi {
  constructor(pesan: string) {
    super(404, 'TIDAK_DITEMUKAN', pesan)
  }
}

export class GalatScopePersonal extends GalatApi {
  constructor() {
    super(
      403,
      'SCOPE_TIDAK_MENCAKUP',
      'Detail profil satu pegawai selalu merupakan data pribadi, jadi endpoint ini menuntut scope "data_personal" — tidak ada versi tersamarkan. Ajukan penyesuaian MoU/PKS ke Super Admin SIMT DJBK.',
    )
  }
}

export interface KonteksApi {
  klien: KlienApi
  /** Pengenal semu per klien — sudah ber-HMAC `kode_instansi`. */
  idAnonim: (nip: string) => string
  url: URL
}

/** Balasan sukses dibungkus konsisten: `data` + `meta`. */
export interface BalasanApi<T> {
  data: T
  meta: Record<string, unknown>
}

function json(isi: unknown, status: number, tambahan?: Record<string, string>): Response {
  return new Response(JSON.stringify(isi, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Balasan API memuat data pegawai yang tersaring menurut scope klien —
      // ia tidak boleh mengendap di cache bersama mana pun.
      'Cache-Control': 'no-store',
      ...tambahan,
    },
  })
}

export function tanganiV1<T>(
  endpoint: EndpointV1,
  handler: (ctx: KonteksApi) => Promise<BalasanApi<T>>,
) {
  return async function GET(permintaan: Request): Promise<Response> {
    const mulai = Date.now()
    const url = new URL(permintaan.url)
    const jalur = url.pathname
    const ip = ipPermintaan(permintaan)

    const gerbang = await gerbangApi(permintaan, endpoint)

    if (!gerbang.ok) {
      // Klien yang tidak dikenali sama sekali tidak bisa dicatat di
      // `api_activity_log` (kolomnya NOT NULL) — lihat catatan di `gerbang.ts`.
      if (gerbang.klienId !== null) {
        await catatAktivitasApi({
          klienId: gerbang.klienId,
          tokenId: gerbang.tokenId,
          endpoint: jalur,
          method: permintaan.method,
          responseCode: gerbang.status,
          responseTimeMs: Date.now() - mulai,
          ip,
        })
      } else {
        console.warn(`[api] token tidak dikenali pada ${jalur} dari ${ip ?? 'ip tak diketahui'}`)
      }

      return json(
        { error: { kode: gerbang.kode, pesan: gerbang.pesan } },
        gerbang.status,
        gerbang.status === 401 ? { 'WWW-Authenticate': 'Bearer' } : undefined,
      )
    }

    const { klien } = gerbang
    try {
      const hasil = await handler({
        klien,
        idAnonim: pembuatIdAnonim(klien.kodeInstansi),
        url,
      })

      const balasan = json(
        {
          data: hasil.data,
          meta: {
            ...hasil.meta,
            klien: klien.kodeInstansi,
            data_personal: klien.scope.dataPersonal,
            diambil_pada: new Date().toISOString(),
          },
        },
        200,
      )

      await catatAktivitasApi({
        klienId: klien.klienId,
        tokenId: klien.tokenId,
        endpoint: jalur,
        method: permintaan.method,
        responseCode: 200,
        responseTimeMs: Date.now() - mulai,
        ip,
      })
      return balasan
    } catch (e) {
      // Galat yang SENGAJA dilempar handler (400/403/404) dibalas apa adanya —
      // pesannya ditulis untuk klien eksternal dan memang perlu sampai.
      if (e instanceof GalatApi) {
        await catatAktivitasApi({
          klienId: klien.klienId,
          tokenId: klien.tokenId,
          endpoint: jalur,
          method: permintaan.method,
          responseCode: e.status,
          responseTimeMs: Date.now() - mulai,
          ip,
        })
        return json({ error: { kode: e.kode, pesan: e.message } }, e.status)
      }

      // Galat TAK TERDUGA tetap dicatat & dibalas dalam bentuk yang sama, tapi
      // isinya TIDAK dibocorkan ke klien eksternal — pesan MySQL bisa memuat
      // nama tabel, kolom, dan potongan nilai.
      console.error(`[api] galat pada ${jalur} untuk klien ${klien.kodeInstansi}:`, e)
      await catatAktivitasApi({
        klienId: klien.klienId,
        tokenId: klien.tokenId,
        endpoint: jalur,
        method: permintaan.method,
        responseCode: 500,
        responseTimeMs: Date.now() - mulai,
        ip,
      })
      return json(
        { error: { kode: 'GALAT_INTERNAL', pesan: 'Terjadi galat internal. Coba lagi nanti.' } },
        500,
      )
    }
  }
}

/** Paginasi seragam untuk endpoint daftar. */
export function bacaPaginasi(url: URL, maks = 100): { halaman: number; perHalaman: number } {
  const angka = (nama: string, bawaan: number) => {
    const n = Number(url.searchParams.get(nama))
    return Number.isSafeInteger(n) && n > 0 ? n : bawaan
  }
  return {
    halaman: angka('halaman', 1),
    perHalaman: Math.min(angka('per_halaman', 25), maks),
  }
}
