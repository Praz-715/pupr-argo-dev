/**
 * Serialisasi `.xlsx` untuk Pusat Ekspor — menggantikan CSV.
 *
 * Permintaan pemilik proses 2 Sep 2026: *"yang pusat ekspor kayanya bikin excel
 * aja dah jangan csv."* Alasannya tidak perlu ditebak — CSV kehilangan tipe data
 * (semua jadi teks, tanggal & angka harus ditebak ulang Excel saat dibuka) dan
 * tidak bisa punya lebar kolom/header tebal; `.xlsx` bisa keduanya.
 *
 * ## Kenapa DITULIS SENDIRI, bukan pakai pustaka
 *
 * `.xlsx` cuma ZIP berisi XML, dan `lib/zip-tulis.ts` sudah menuliskannya tanpa
 * dependensi baru — pasangan dari `lib/importer/xlsx.ts` yang membacanya dengan
 * cara yang sama. Cakupannya sengaja sempit: satu lembar, string inline (tanpa
 * `sharedStrings.xml`), header baris pertama ditebalkan, tanpa rumus/gaya lain.
 * Itu semua yang dibutuhkan ekspor tabel — bukan pembuat xlsx umum.
 *
 * ## Proteksi injeksi formula TETAP berlaku, dan levelnya SAMA PENTINGNYA
 *
 * Excel menafsirkan sel yang diawali `=`, `+`, `-`, `@` sebagai formula — pada
 * `.xlsx` maupun `.csv`, tidak berkurang levelnya sama sekali. `lindungiSel()`
 * dari `lib/ekspor.ts` dipakai ulang di sini, BUKAN ditulis kedua kalinya: dua
 * salinan aturan keamanan yang sama adalah cara termudah salah satunya
 * tertinggal saat yang lain diperbarui.
 *
 * ## Tipe data dipertahankan, BEDA dari CSV
 *
 * CSV memaksa semuanya jadi teks (`selCsv` di `lib/ekspor.ts`). Di sini `number`
 * ditulis sebagai sel numerik sungguhan (`<v>123</v>` tanpa `t="inlineStr"`) —
 * supaya kolom seperti "Rata-rata Skor" bisa langsung dijumlah/diurutkan Excel
 * tanpa pengguna mengubah tipe selnya dulu. Tanggal & boolean tetap teks,
 * mengikuti bentuk yang sama dengan CSV (`ya`/`tidak`, `YYYY-MM-DD HH:mm:ss`) —
 * menuliskan tanggal sebagai serial Excel butuh `numFmt` per sel yang tidak
 * sepadan manfaatnya untuk ekspor yang dibaca, bukan dihitung ulang.
 */

import { lindungiSel, type KolomEkspor } from './ekspor'
import { tulisZip } from './zip-tulis'

/**
 * Karakter kontrol (0x00–0x08, 0x0B, 0x0C, 0x0E–0x1F) TIDAK sah di dalam XML 1.0
 * apa pun escaping-nya — bukan cuma soal tanda `&`/`<`. Satu karakter begitu di
 * catatan reviewer yang diketik bebas (mis. tempel dari PDF) sudah cukup membuat
 * Excel menganggap SELURUH berkas rusak saat dibuka, bukan cuma sel itu.
 */
const KARAKTER_KONTROL_TAK_SAH = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g

function escapeXml(teks: string): string {
  return teks
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(KARAKTER_KONTROL_TAK_SAH, '')
}

/** `0`→A, `25`→Z, `26`→AA … — huruf kolom gaya Excel dari indeks 0-basis. */
function hurufKolom(indeks: number): string {
  let n = indeks + 1
  let huruf = ''
  while (n > 0) {
    const sisa = (n - 1) % 26
    huruf = String.fromCharCode(65 + sisa) + huruf
    n = Math.floor((n - 1) / 26)
  }
  return huruf
}

/** Satu sel: numerik sungguhan untuk `number`, selebihnya teks (dilindungi dari injeksi formula). */
function selXml(ref: string, nilai: unknown, tebal: boolean): string {
  if (nilai === null || nilai === undefined || nilai === '') return ''
  const gaya = tebal ? ' s="1"' : ''

  if (typeof nilai === 'number' && Number.isFinite(nilai)) {
    return `<c r="${ref}"${gaya}><v>${nilai}</v></c>`
  }

  const teks =
    nilai instanceof Date
      ? nilai.toISOString().slice(0, 19).replace('T', ' ')
      : typeof nilai === 'boolean'
        ? nilai
          ? 'ya'
          : 'tidak'
        : String(nilai)

  const aman = escapeXml(lindungiSel(teks))
  const pertahankanSpasi = /^\s|\s$/.test(teks) ? ' xml:space="preserve"' : ''
  return `<c r="${ref}" t="inlineStr"${gaya}><is><t${pertahankanSpasi}>${aman}</t></is></c>`
}

function barisXml(nomor: number, nilai: unknown[], tebal: boolean): string {
  const sel = nilai.map((v, i) => selXml(`${hurufKolom(i)}${nomor}`, v, tebal)).join('')
  return `<row r="${nomor}">${sel}</row>`
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`

const RELS_RAIZ = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`

const WORKBOOK = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Data" sheetId="1" r:id="rId1"/></sheets></workbook>`

const WORKBOOK_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`

/** Dua gaya sel: `s="0"` biasa, `s="1"` tebal untuk baris header. */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`

/**
 * Susun `.xlsx` lengkap sebagai `Buffer` — pasangan `susunCsv` di `lib/ekspor.ts`,
 * antarmuka kolomnya SAMA (`KolomEkspor<T>`) supaya route handler cukup memilih
 * salah satu, bukan menulis dua definisi kolom.
 *
 * Lebar kolom dipatok dari panjang JUDULNYA (bukan isinya): menghitung lebar dari
 * seluruh baris berarti memindai ulang data yang sudah dipindai `nilai()`, dan
 * lembar kerja yang dibuka orang tetap bisa diperlebar sendiri dalam satu klik —
 * beda dengan kolom terpotong yang membuat orang mengira datanya hilang.
 */
export function susunXlsx<T>(kolom: Array<KolomEkspor<T>>, baris: T[]): Buffer {
  const lebarKolom = kolom
    .map((k, i) => `<col min="${i + 1}" max="${i + 1}" width="${Math.min(Math.max(k.judul.length + 4, 10), 42)}" customWidth="1"/>`)
    .join('')

  const semuaBaris = [
    barisXml(1, kolom.map((k) => k.judul), true),
    ...baris.map((b, i) => barisXml(i + 2, kolom.map((k) => k.nilai(b)), false)),
  ].join('')

  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${lebarKolom}</cols><sheetData>${semuaBaris}</sheetData></worksheet>`

  return tulisZip([
    { nama: '[Content_Types].xml', isi: Buffer.from(CONTENT_TYPES, 'utf8') },
    { nama: '_rels/.rels', isi: Buffer.from(RELS_RAIZ, 'utf8') },
    { nama: 'xl/workbook.xml', isi: Buffer.from(WORKBOOK, 'utf8') },
    { nama: 'xl/_rels/workbook.xml.rels', isi: Buffer.from(WORKBOOK_RELS, 'utf8') },
    { nama: 'xl/styles.xml', isi: Buffer.from(STYLES, 'utf8') },
    { nama: 'xl/worksheets/sheet1.xml', isi: Buffer.from(sheet, 'utf8') },
  ])
}

/** Nama berkas unduhan: `simt-<jenis>-<stempel>.xlsx`. Pola sama dengan `namaBerkasCsv`. */
export function namaBerkasXlsx(jenis: string, pada: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  const stempel = `${pada.getFullYear()}${p(pada.getMonth() + 1)}${p(pada.getDate())}-${p(pada.getHours())}${p(pada.getMinutes())}`
  const bersih = jenis.replace(/[^a-z0-9-]/gi, '-').toLowerCase()
  return `simt-${bersih}-${stempel}.xlsx`
}

export function headerXlsx(namaBerkas: string): Record<string, string> {
  return {
    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'Content-Disposition': `attachment; filename="${namaBerkas}"`,
    'Cache-Control': 'no-store, max-age=0',
  }
}
