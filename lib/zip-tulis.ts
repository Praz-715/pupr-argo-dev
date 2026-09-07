/**
 * Penulis ZIP minimal — **tanpa dependensi baru**, pasangan tulis dari
 * `lib/importer/xlsx.ts` yang membaca ZIP dengan cara yang sama.
 *
 * `.xlsx` hanyalah ZIP berisi XML, dan Node sudah membawa `zlib.deflateRawSync`
 * — jadi menulisnya tidak menuntut pustaka pihak ketiga, sama seperti
 * membacanya. CRC-32 dihitung manual (tabel standar) karena Node tidak
 * mengekspornya sebagai fungsi publik di versi yang dipakai proyek ini.
 *
 * Cakupannya sengaja sempit: entri kecil (`Buffer` utuh di memori, bukan
 * streaming), selalu DEFLATE, bukan ZIP64. Itu cukup untuk seluruh ekspor
 * aplikasi ini — dibatasi `LIMIT` di kuerinya, beberapa ratus kilobyte.
 */

import { deflateRawSync } from 'node:zlib'

const TABEL_CRC32 = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = TABEL_CRC32[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Tanggal/waktu format DOS dipakai header ZIP — presisi 2 detik, itu wajar. */
function tanggalDos(d: Date): { waktu: number; tanggal: number } {
  const waktu = (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2)
  const tanggal = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate()
  return { waktu, tanggal }
}

export interface EntriZip {
  nama: string
  isi: Buffer
}

/** Susun arsip ZIP dari entri-entri kecil: local header + data per entri, lalu central directory + EOCD. */
export function tulisZip(entri: EntriZip[]): Buffer {
  const sekarang = tanggalDos(new Date())
  const potonganLokal: Buffer[] = []
  const potonganSentral: Buffer[] = []
  let offset = 0

  for (const e of entri) {
    const nama = Buffer.from(e.nama, 'utf8')
    const terkompresi = deflateRawSync(e.isi)
    const crc = crc32(e.isi)

    const lokal = Buffer.alloc(30)
    lokal.writeUInt32LE(0x04034b50, 0)
    lokal.writeUInt16LE(20, 4) // versi dibutuhkan
    lokal.writeUInt16LE(0, 6) // flag
    lokal.writeUInt16LE(8, 8) // metode: deflate
    lokal.writeUInt16LE(sekarang.waktu, 10)
    lokal.writeUInt16LE(sekarang.tanggal, 12)
    lokal.writeUInt32LE(crc, 14)
    lokal.writeUInt32LE(terkompresi.length, 18)
    lokal.writeUInt32LE(e.isi.length, 22)
    lokal.writeUInt16LE(nama.length, 26)
    lokal.writeUInt16LE(0, 28) // extra field length

    potonganLokal.push(lokal, nama, terkompresi)

    const sentral = Buffer.alloc(46)
    sentral.writeUInt32LE(0x02014b50, 0)
    sentral.writeUInt16LE(20, 4) // versi pembuat
    sentral.writeUInt16LE(20, 6) // versi dibutuhkan
    sentral.writeUInt16LE(0, 8) // flag
    sentral.writeUInt16LE(8, 10) // metode
    sentral.writeUInt16LE(sekarang.waktu, 12)
    sentral.writeUInt16LE(sekarang.tanggal, 14)
    sentral.writeUInt32LE(crc, 16)
    sentral.writeUInt32LE(terkompresi.length, 20)
    sentral.writeUInt32LE(e.isi.length, 24)
    sentral.writeUInt16LE(nama.length, 28)
    sentral.writeUInt16LE(0, 30) // extra
    sentral.writeUInt16LE(0, 32) // komentar
    sentral.writeUInt16LE(0, 34) // nomor disk
    sentral.writeUInt16LE(0, 36) // atribut internal
    sentral.writeUInt32LE(0, 38) // atribut eksternal
    sentral.writeUInt32LE(offset, 42) // offset local header

    potonganSentral.push(sentral, nama)

    offset += lokal.length + nama.length + terkompresi.length
  }

  const offsetSentral = offset
  const ukuranSentral = potonganSentral.reduce((n, b) => n + b.length, 0)

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(0, 4)
  eocd.writeUInt16LE(0, 6)
  eocd.writeUInt16LE(entri.length, 8)
  eocd.writeUInt16LE(entri.length, 10)
  eocd.writeUInt32LE(ukuranSentral, 12)
  eocd.writeUInt32LE(offsetSentral, 16)
  eocd.writeUInt16LE(0, 20)

  return Buffer.concat([...potonganLokal, ...potonganSentral, eocd])
}
