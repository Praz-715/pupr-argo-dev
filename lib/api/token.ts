import { createHash, randomBytes } from 'node:crypto'

/**
 * Token API eksternal (Fase 9) — pembuatan, hashing, dan pembacaan header.
 *
 * Murni & bebas DB supaya bisa diuji tanpa database.
 *
 * ## Kenapa SHA-256, bukan bcrypt
 *
 * Alasan yang sama dengan sesi internal (`lib/sesi.ts`): isinya **256 bit acak**,
 * tidak ada yang bisa ditebak dari kamus, jadi fungsi hash lambat hanya menambah
 * biaya tiap permintaan tanpa menambah keamanan. bcrypt melindungi rahasia yang
 * **dipilih manusia**; token ini tidak dipilih siapa pun.
 *
 * ## Kenapa prefiks `sha256:` disimpan bersama hash-nya
 *
 * Supaya algoritmanya bisa diganti tanpa menebak isi kolom lama. Kolom
 * `api_token.token_hash` adalah `varchar(255)`, jadi ada ruangnya, dan baris lama
 * tetap terbaca setelah algoritmanya berpindah. Tanpa penanda, migrasi berikutnya
 * harus menebak — dan menebak salah berarti seluruh klien kehilangan akses
 * serentak.
 *
 * ## Kenapa token berprefiks `simt_`
 *
 * Token yang bocor ke repositori publik atau log hanya bisa dicabut kalau ia bisa
 * **dikenali sebagai token**. Prefiks tetap membuatnya bisa dicari (`grep`,
 * pemindai rahasia, aturan DLP) — praktik yang sama dipakai penerbit token besar.
 * Tanpa itu, 43 karakter base64url tidak bisa dibedakan dari sampah apa pun.
 */

/** Penanda algoritma yang disimpan bersama hash. */
export const PREFIKS_HASH = 'sha256:'

/** Penanda token, ikut terkirim ke klien. Membuat token yang bocor bisa dikenali. */
export const PREFIKS_TOKEN = 'simt_'

/** 32 byte acak = 256 bit. base64url supaya aman dipakai di header & URL. */
const PANJANG_BYTE = 32

/**
 * Terbitkan token baru. Kembaliannya **plaintext** — ia hanya boleh ditampilkan
 * sekali lalu tidak pernah disimpan; yang masuk DB adalah hash-nya.
 */
export function buatTokenApi(): string {
  return PREFIKS_TOKEN + randomBytes(PANJANG_BYTE).toString('base64url')
}

export function hashTokenApi(token: string): string {
  return PREFIKS_HASH + createHash('sha256').update(token).digest('hex')
}

/**
 * Baca token dari header `Authorization`.
 *
 * Sengaja **ketat**: hanya `Bearer <token>` dengan tepat satu spasi pemisah.
 * Penerimaan yang longgar (`bearer`, spasi ganda, tanda kutip) terdengar ramah
 * dan berakibat dua bentuk header yang sama-sama sah — lalu klien menulis
 * integrasi terhadap bentuk yang tidak pernah dijamin dokumen, dan bentuk itu
 * ikut jadi kontrak tanpa pernah diputuskan.
 *
 * Skema `Bearer` **case-insensitive** karena RFC 6750 menetapkannya begitu; yang
 * ketat adalah bentuknya, bukan huruf besar-kecilnya.
 */
export function bacaHeaderBearer(header: string | null | undefined): string | null {
  if (!header) return null
  const cocok = /^Bearer ([\w.~+/-]+=*)$/i.exec(header.trim())
  return cocok ? (cocok[1] ?? null) : null
}

/**
 * Potongan token untuk ditampilkan di UI & log — **bukan** untuk dicocokkan.
 *
 * Menampilkan token utuh di daftar token membuat layar admin jadi tempat
 * pengambilan kredensial: siapa pun yang lewat di belakang, atau tangkapan layar
 * mana pun, cukup untuk memakainya. Yang dibutuhkan pengelola hanyalah cara
 * membedakan satu token dari yang lain.
 */
export function petunjukToken(token: string): string {
  const isi = token.startsWith(PREFIKS_TOKEN) ? token.slice(PREFIKS_TOKEN.length) : token
  return `${PREFIKS_TOKEN}…${isi.slice(-6)}`
}
