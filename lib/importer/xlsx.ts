/**
 * Pembaca `.xlsx` minimal — **tanpa dependensi baru.**
 *
 * ## Kenapa ditulis sendiri
 *
 * Keputusan sebelumnya (22 Agu 2026) menolak unggah `.xlsx` di UI dengan alasan
 * yang benar: repo ini tidak punya pembaca xlsx, dan menambahkan satu **demi satu
 * form** berarti memasang parser biner pihak ketiga di jalur unggahan pengguna.
 * Keberatannya bukan pada "membaca xlsx", melainkan pada **dependensi biner yang
 * tidak bisa diaudit di jalur yang menerima berkas dari luar**.
 *
 * Berkas `.xlsx` sendiri hanya **ZIP berisi XML**, dan Node sudah membawa
 * `zlib.inflateRawSync`. Jadi keberatan itu bisa dijawab tanpa dilanggar: kode di
 * bawah ~200 baris, seluruhnya bisa dibaca, dan tidak menambah satu pun paket.
 *
 * ## Batasnya, dinyatakan terus terang
 *
 * Ini BUKAN pembaca xlsx umum. Yang didukung hanya yang benar-benar dipakai
 * berkas Talent Pool: entri ZIP `stored`/`deflate` (bukan ZIP64), `sharedStrings`,
 * sel bertipe shared-string / inline-string / angka, dan `mergeCells`. Yang TIDAK
 * didukung: rumus (nilai TERHITUNG-nya tetap terbaca lewat `<v>`, jadi ini bukan
 * masalah untuk berkas yang disimpan Excel), berkas terenkripsi, dan ZIP64.
 * Semuanya menghasilkan galat yang menyebut sebabnya — bukan hasil separuh.
 */

import { inflateRawSync } from 'node:zlib'

/** Satu lembar kerja: sel diindeks `"<baris>:<kolom>"`, keduanya 1-basis. */
export interface Lembar {
  nama: string
  sel: Map<string, string>
  barisMaks: number
  kolomMaks: number
  /** Rentang `mergeCells` apa adanya, mis. `"I1:J1"`. */
  gabung: string[]
}

export class GalatXlsx extends Error {
  constructor(pesan: string) {
    super(pesan)
    this.name = 'GalatXlsx'
  }
}

// ── ZIP ─────────────────────────────────────────────────────────────────────

/**
 * Isi entri ZIP, dibaca dari *central directory* — bukan dari local header.
 *
 * Local header boleh menuliskan ukuran `0` dan menaruh ukuran sebenarnya di
 * *data descriptor* SESUDAH datanya (bit 3 pada flag). Excel tidak selalu
 * melakukannya, tapi alat lain yang menulis ulang berkasnya bisa — dan kalau
 * ukurannya dibaca dari local header, hasilnya nol bita tanpa satu pun galat.
 * Central directory selalu memuat ukuran yang benar.
 */
function bacaZip(buf: Buffer): Map<string, Buffer> {
  const isi = new Map<string, Buffer>()

  // EOCD dicari dari BELAKANG: komentar arsip boleh memuat bita apa pun,
  // termasuk yang menyerupai tanda tangan lain.
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 65_557; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new GalatXlsx('Bukan berkas .xlsx yang sah: penanda akhir arsip ZIP tidak ditemukan.')

  const jumlah = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  if (p === 0xffffffff) throw new GalatXlsx('Arsip ZIP64 belum didukung. Simpan ulang berkasnya dari Excel.')

  for (let n = 0; n < jumlah; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) {
      throw new GalatXlsx(`Struktur ZIP rusak pada entri ke-${n + 1}.`)
    }
    const metode = buf.readUInt16LE(p + 10)
    const ukuranTerkompresi = buf.readUInt32LE(p + 20)
    const panjangNama = buf.readUInt16LE(p + 28)
    const panjangExtra = buf.readUInt16LE(p + 30)
    const panjangKomentar = buf.readUInt16LE(p + 32)
    const offsetLokal = buf.readUInt32LE(p + 42)
    const nama = buf.subarray(p + 46, p + 46 + panjangNama).toString('utf8')
    p += 46 + panjangNama + panjangExtra + panjangKomentar

    // Hanya entri yang kita butuhkan yang di-inflate — berkas Talent Pool
    // membawa 53 PNG, dan meng-inflate semuanya untuk membaca satu sheet
    // membuang belasan MB memori tanpa satu pun pemakai.
    if (!/^xl\/(workbook\.xml|sharedStrings\.xml|worksheets\/.+\.xml)$/.test(nama)) continue

    if (buf.readUInt32LE(offsetLokal) !== 0x04034b50) {
      throw new GalatXlsx(`Header lokal entri "${nama}" tidak sah.`)
    }
    const mulai =
      offsetLokal + 30 + buf.readUInt16LE(offsetLokal + 26) + buf.readUInt16LE(offsetLokal + 28)
    const mentah = buf.subarray(mulai, mulai + ukuranTerkompresi)
    if (metode === 0) isi.set(nama, Buffer.from(mentah))
    else if (metode === 8) isi.set(nama, inflateRawSync(mentah))
    else throw new GalatXlsx(`Entri "${nama}" memakai kompresi ${metode} yang belum didukung.`)
  }
  return isi
}

// ── XML ─────────────────────────────────────────────────────────────────────

const ENTITAS: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
}

/**
 * Normalisasi akhir-baris yang DIWAJIBKAN spesifikasi XML: `\r\n` dan `\r` → `\n`.
 *
 * Parser XML sungguhan melakukan ini sebelum menyerahkan teksnya, jadi
 * `ElementTree` di ekstraktor Python sudah menormalkannya. Pembaca berbasis regex
 * di berkas ini tidak — dan tanpa baris ini, sel bermultibaris (mis. `RIWAYAT
 * PENDIDIKAN`, tiga baris) menghasilkan string yang **terlihat sama** tapi tidak
 * sama, sehingga uji kesetaraannya merah dengan diff yang tidak bisa dibaca mata.
 * Persis itu yang terjadi 24 Agu 2026.
 */
function normalkanBaris(s: string): string {
  return s.replace(/\r\n?/g, '\n')
}

function lepasEntitas(s: string): string {
  return normalkanBaris(s).replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (utuh, isi: string) => {
    if (isi.startsWith('#x') || isi.startsWith('#X')) return String.fromCodePoint(parseInt(isi.slice(2), 16))
    if (isi.startsWith('#')) return String.fromCodePoint(Number(isi.slice(1)))
    return ENTITAS[isi] ?? utuh
  })
}

/**
 * Gabungan seluruh `<t>` di dalam satu `<si>` / `<is>`.
 *
 * Teks bergaya campuran dipecah Excel jadi beberapa `<r><t>`, jadi mengambil
 * `<t>` PERTAMA saja akan memotong nama orang di tengah — kegagalan yang tidak
 * menghasilkan galat, hanya nama yang salah.
 */
function teksGabungan(blok: string): string {
  const bagian = blok.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g) ?? []
  return bagian
    .map((b) => lepasEntitas(b.replace(/^<t(?:\s[^>]*)?>/, '').replace(/<\/t>$/, '')))
    .join('')
}

function bacaSharedStrings(xml: string | undefined): string[] {
  if (!xml) return []
  const hasil: string[] = []
  const re = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) hasil.push(m[1] === undefined ? '' : teksGabungan(m[1]))
  return hasil
}

/** `"AA"` → 27. */
export function nomorKolom(huruf: string): number {
  let n = 0
  for (const ch of huruf.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n
}

/** 27 → `"AA"`. */
export function hurufKolom(nomor: number): string {
  let n = nomor
  let hasil = ''
  while (n > 0) {
    const sisa = (n - 1) % 26
    hasil = String.fromCharCode(65 + sisa) + hasil
    n = Math.floor((n - 1) / 26)
  }
  return hasil
}

function bacaLembar(xml: string, nama: string, teksBersama: string[]): Lembar {
  const sel = new Map<string, string>()
  let barisMaks = 0
  let kolomMaks = 0

  const reBaris = /<row[^>]*\sr="(\d+)"[^>]*>([\s\S]*?)<\/row>/g
  let mb: RegExpExecArray | null
  while ((mb = reBaris.exec(xml)) !== null) {
    const baris = Number(mb[1])
    const reSel = /<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let mc: RegExpExecArray | null
    while ((mc = reSel.exec(mb[2]!)) !== null) {
      const atr = mc[1]!
      const dalam = mc[2] ?? ''
      // `(?:^|\s)` — BUKAN `\s` saja. `<c\s` di regex sel sudah memakan spasi
      // pembukanya, jadi `atr` dimulai langsung dengan `r="A1"`. Menuntut spasi di
      // depan membuat NOL sel terbaca, dan gejalanya "header tidak dikenali" —
      // jauh dari penyebabnya.
      const ref = /(?:^|\s)r="([A-Z]+)\d+"/.exec(atr)
      if (!ref) continue
      const kolom = nomorKolom(ref[1]!)
      const tipe = /(?:^|\s)t="([^"]+)"/.exec(atr)?.[1]
      let nilai = ''
      if (tipe === 'inlineStr') {
        nilai = teksGabungan(dalam)
      } else {
        const v = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(dalam)?.[1]
        if (v !== undefined) {
          nilai = tipe === 's' ? (teksBersama[Number(lepasEntitas(v))] ?? '') : lepasEntitas(v)
        }
      }
      /*
        Normalisasi PERSIS seperti ekstraktor Python: TAB → spasi, lalu pangkas
        ujungnya. Spasi ganda di TENGAH dan baris baru di dalam sel DIPERTAHANKAN.

        Versi pertama merapatkan semua spasi (`/\s+/g → ' '`), yang terlihat lebih
        bersih tapi membuat keluaran kedua jalur BERBEDA — tertangkap uji
        kesetaraan: nama riwayat jabatan "Tata Usaha  ," (dua spasi) jadi satu
        spasi, dan `riwayatPendidikan` yang di berkasnya berupa tiga baris jadi satu
        baris panjang. Modul ini pemindah tanpa tafsir; merapikan teks adalah tugas
        importir, dan merapikannya DI SINI berarti dua jalur impor menyimpan string
        yang berbeda untuk sel yang sama.
      */
      nilai = nilai.replace(/\t/g, ' ').trim()
      if (nilai === '') continue
      sel.set(`${baris}:${kolom}`, nilai)
      if (baris > barisMaks) barisMaks = baris
      if (kolom > kolomMaks) kolomMaks = kolom
    }
  }

  const gabung = [...(xml.match(/<mergeCell\s+ref="([^"]+)"/g) ?? [])].map(
    (m) => /ref="([^"]+)"/.exec(m)![1]!,
  )
  return { nama, sel, barisMaks, kolomMaks, gabung }
}

/** Baca lembar PERTAMA dari sebuah `.xlsx`. */
export function bacaXlsx(buf: Buffer): Lembar {
  const isi = bacaZip(buf)
  const teksBersama = bacaSharedStrings(isi.get('xl/sharedStrings.xml')?.toString('utf8'))
  const namaLembar = isi.get('xl/worksheets/sheet1.xml')
    ? 'xl/worksheets/sheet1.xml'
    : [...isi.keys()].find((k) => k.startsWith('xl/worksheets/'))
  if (!namaLembar) throw new GalatXlsx('Berkas tidak memuat satu pun lembar kerja.')
  const wb = isi.get('xl/workbook.xml')?.toString('utf8') ?? ''
  const judul = /<sheet[^>]*\sname="([^"]*)"/.exec(wb)?.[1]
  return bacaLembar(isi.get(namaLembar)!.toString('utf8'), judul ? lepasEntitas(judul) : namaLembar, teksBersama)
}
