/**
 * xlsx → Markdown, tanpa dependensi.
 *
 * Dipakai untuk mengubah kiriman pemangku kepentingan (`doc/doc_tambahan_2/`)
 * menjadi berkas yang bisa dibaca & di-`grep` bersama dokumen lain. **`.xlsx`
 * tetap sumbernya**; keluaran skrip ini transkrip, bukan pengganti.
 *
 * Cara pakai — `.xlsx` adalah ZIP, jadi ekstrak dulu:
 *
 *   unzip -q "doc/doc_tambahan_2/sample(1).xlsx" -d /tmp/x
 *   node scripts/xlsx-ke-md.mjs /tmp/x "doc/doc_tambahan_2/sample(1).md" \
 *     doc/doc_tambahan_2/media.json
 *   cp /tmp/x/xl/media/*.png doc/doc_tambahan_2/media/
 *
 * Argumen ke-3 (`media.json`) **opsional** dan berisi transkripsi gambar
 * tersemat — lihat catatan di bagian Lampiran di bawah.
 *
 * Yang diperhatikan (dan yang membuat konverter naif salah):
 * - `<tag .../>` yang menutup sendiri: `[^>]*` ikut menelan `/`-nya, dan akibatnya
 *   seluruh daftar lembar terbaca kosong **tanpa satu pun galat**;
 * - sharedStrings memuat rich text (`<si><r><t>`) — potongannya harus digabung,
 *   kalau tidak sel jadi terpotong di tengah kata;
 * - tanggal tersimpan sebagai SERIAL, jadi tanpa membaca numFmt di styles.xml
 *   kolom tanggal keluar sebagai "45678";
 * - sel bergabung (mergeCells) menyimpan nilainya HANYA di sel kiri-atas; sisanya
 *   kosong. Untuk tabel berheader bertingkat, itu berarti konteksnya hilang;
 * - baris & kolom bisa MELOMPAT (r="7" setelah r="3"), jadi indeks tidak boleh
 *   diturunkan dari urutan kemunculan;
 * - nilai hasil formula memuat derau IEEE-754 (`60.755499999999998`).
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs'

const DIR = process.argv[2]
const KELUARAN = process.argv[3]
const BERKAS_LAMPIRAN = process.argv[4]

const baca = (p) => readFileSync(`${DIR}/${p}`, 'utf8')

// --- util XML ringan -------------------------------------------------------
function lepasEntitas(s) {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

/**
 * Semua blok `<tag ...>...</tag>` ATAU `<tag .../>` pada satu level teks.
 *
 * Tag yang menutup sendiri dideteksi dari **akhiran** daftar atributnya, bukan
 * dari grup regex terpisah: `[^>]*` ikut menelan `/`, sehingga
 * `<sheet name="x" r:id="rId1"/>` akan terbaca sebagai tag TERBUKA, pencarian
 * `</sheet>` gagal, dan seluruh daftar lembar keluar kosong tanpa satu pun galat.
 * Hampir semua elemen di xlsx (`sheet`, `mergeCell`, `dimension`, `numFmt`,
 * `Relationship`, dan `<c>` tanpa nilai) menutup sendiri, jadi kekeliruan ini
 * menghasilkan berkas kosong yang tampak berhasil.
 *
 * `(?![\\w:-])` mencegah `<sheet>` ikut mencocokkan `<sheetData>`/`<sheetPr>`.
 */
function blok(xml, tag) {
  const out = []
  const re = new RegExp(`<${tag}(?![\\w:-])([^>]*)>`, 'g')
  let m
  while ((m = re.exec(xml)) !== null) {
    const mentah = m[1] ?? ''
    if (mentah.endsWith('/')) {
      out.push({ atribut: mentah.slice(0, -1), isi: '' })
      continue
    }
    const tutup = `</${tag}>`
    const akhir = xml.indexOf(tutup, re.lastIndex)
    if (akhir === -1) break
    out.push({ atribut: mentah, isi: xml.slice(re.lastIndex, akhir) })
    re.lastIndex = akhir + tutup.length
  }
  return out
}

const atr = (s, nama) => s.match(new RegExp(`${nama}="([^"]*)"`))?.[1]

// --- sharedStrings ---------------------------------------------------------
function bacaSharedStrings() {
  let xml
  try {
    xml = baca('xl/sharedStrings.xml')
  } catch {
    return []
  }
  return blok(xml, 'si').map((si) =>
    // Rich text: gabungkan seluruh <t> di dalam <si>. Untuk si biasa hanya ada satu.
    blok(si.isi, 't')
      .map((t) => lepasEntitas(t.isi))
      .join(''),
  )
}

// --- styles: mana yang format tanggal? ------------------------------------
const NUMFMT_TANGGAL_BAWAAN = new Set([14, 15, 16, 17, 22, 45, 46, 47])

function bacaGayaTanggal() {
  const xml = baca('xl/styles.xml')
  const kustom = new Map()
  for (const f of blok(xml, 'numFmt')) {
    const id = Number(atr(f.atribut, 'numFmtId'))
    const kode = atr(f.atribut, 'formatCode') ?? ''
    // Buang bagian literal dalam kutip supaya "Rp" tidak dibaca sebagai bulan.
    const bersih = kode.replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')
    if (/[dmyhs]/i.test(bersih) && /d|y/i.test(bersih)) kustom.set(id, true)
  }
  const cellXfs = blok(xml, 'cellXfs')[0]?.isi ?? ''
  return blok(cellXfs, 'xf').map((xf) => {
    const id = Number(atr(xf.atribut, 'numFmtId') ?? '0')
    return NUMFMT_TANGGAL_BAWAAN.has(id) || kustom.has(id)
  })
}

/** Serial Excel → ISO. Epoch 1899-12-30 (bug 1900 Excel sudah diperhitungkan). */
function serialKeTanggal(n) {
  const hari = Math.floor(n)
  const ms = Math.round((n - hari) * 86400) * 1000
  const d = new Date(Date.UTC(1899, 11, 30) + hari * 86400000 + ms)
  const iso = d.toISOString()
  return ms === 0 ? iso.slice(0, 10) : iso.slice(0, 16).replace('T', ' ')
}

// --- alamat sel ------------------------------------------------------------
function kolomKeIndeks(huruf) {
  let n = 0
  for (const c of huruf) n = n * 26 + (c.charCodeAt(0) - 64)
  return n - 1
}
function pecahAlamat(ref) {
  const m = ref.match(/^([A-Z]+)(\d+)$/)
  return m ? { kol: kolomKeIndeks(m[1]), baris: Number(m[2]) - 1 } : null
}

// --- baca satu sheet -------------------------------------------------------
function bacaSheet(berkas, sst, gayaTanggal) {
  const xml = baca(berkas)
  const grid = []
  const setSel = (b, k, v) => {
    while (grid.length <= b) grid.push([])
    const row = grid[b]
    while (row.length <= k) row.push('')
    row[k] = v
  }

  for (const row of blok(xml, 'row')) {
    const nomor = Number(atr(row.atribut, 'r') ?? '0') - 1
    for (const c of blok(row.isi, 'c')) {
      const ref = atr(c.atribut, 'r')
      const pos = ref ? pecahAlamat(ref) : null
      if (!pos) continue
      const tipe = atr(c.atribut, 't') ?? 'n'
      const gaya = Number(atr(c.atribut, 's') ?? '-1')

      let nilai = ''
      if (tipe === 'inlineStr') {
        nilai = blok(c.isi, 't')
          .map((t) => lepasEntitas(t.isi))
          .join('')
      } else {
        const v = blok(c.isi, 'v')[0]
        const mentah = v ? lepasEntitas(v.isi) : ''
        if (mentah === '') nilai = ''
        else if (tipe === 's') nilai = sst[Number(mentah)] ?? ''
        else if (tipe === 'b') nilai = mentah === '1' ? 'ya' : 'tidak'
        else if (tipe === 'e') nilai = mentah // galat Excel (#REF!, #DIV/0!) — tampilkan apa adanya
        else if (tipe === 'str') nilai = mentah
        else {
          const angka = Number(mentah)
          if (gayaTanggal[gaya] === true && Number.isFinite(angka) && angka > 0) {
            nilai = serialKeTanggal(angka)
          } else if (Number.isFinite(angka) && !Number.isInteger(angka)) {
            /**
             * Buang derau IEEE-754 dari nilai hasil formula.
             *
             * Excel menyimpan hasil `65%*93.47` sebagai `60.755499999999998`. Itu
             * angka yang sama, tapi ditampilkan apa adanya ia terbaca seperti
             * presisi yang tidak dimaksudkan siapa pun — dan pembaca yang
             * membandingkannya dengan layar Excel (`60,7555`) akan menyimpulkan
             * konversinya salah. 12 digit signifikan cukup jauh di atas presisi
             * data ini (bobot 2 desimal, skor 2 desimal) sehingga tidak ada nilai
             * asli yang berubah.
             */
            nilai = String(Number(angka.toPrecision(12)))
          } else {
            nilai = mentah
          }
        }
      }
      /**
       * Formula ikut ditampilkan di sebelah nilainya.
       *
       * Untuk berkas ini itu bukan hiasan: lembar `Sample` ada justru untuk
       * **memperagakan cara skor dihitung**, jadi `4.5` sendirian kehilangan
       * inti dokumennya — yang perlu terlihat adalah `4.5 (=5%*L14)`, yaitu
       * bobot 5% dikalikan nilai indikator di kolom L.
       */
      const f = blok(c.isi, 'f')[0]
      const rumus = f && f.isi !== '' ? lepasEntitas(f.isi) : null
      const isiSel = rumus === null ? nilai : `${nilai} (=${rumus})`

      setSel(pos.baris === -1 ? nomor : pos.baris, pos.kol, isiSel)
    }
  }

  /**
   * Sel bergabung: nilainya disalin **ke bawah saja**, tidak ke kanan.
   *
   * Ke bawah berguna: `Parameter = "Nilai Kinerja (Sumbu Y)"` menempel di satu
   * sel yang membentang lima baris, dan pembaca tabel Markdown tidak bisa
   * melihat merge-nya — tanpa disalin, empat baris berikutnya kehilangan
   * konteksnya.
   *
   * Ke kanan justru merusak: judul yang membentang sembilan kolom akan terulang
   * sembilan kali dalam satu baris, dan `Kategori` yang membentang dua kolom jadi
   * `Kategori | Kategori`. Isinya jadi lebih panjang tanpa satu pun informasi
   * tambahan, dan pencarian teks menemukan hantu.
   */
  const gabung = []
  const mc = blok(xml, 'mergeCells')[0]?.isi ?? ''
  for (const m of blok(mc, 'mergeCell')) {
    const ref = atr(m.atribut, 'ref') ?? ''
    const [a, b] = ref.split(':')
    const pa = a ? pecahAlamat(a) : null
    const pb = b ? pecahAlamat(b) : null
    if (!pa || !pb) continue
    gabung.push(ref)
    const asal = grid[pa.baris]?.[pa.kol] ?? ''
    if (asal === '') continue
    for (let r = pa.baris + 1; r <= pb.baris; r += 1) {
      if ((grid[r]?.[pa.kol] ?? '') === '') setSel(r, pa.kol, asal)
    }
  }

  return { grid, gabung, dimensi: atr(blok(xml, 'dimension')[0]?.atribut ?? '', 'ref') ?? '' }
}

// --- Markdown --------------------------------------------------------------
const escMd = (s) => String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>').trim()

function tabelMd(grid) {
  // Buang kolom & baris yang seluruhnya kosong DI UJUNG, bukan di tengah —
  // membuang yang di tengah akan menggeser kolom dan merusak keselarasan.
  const lebar = Math.max(0, ...grid.map((r) => r.length))
  const kolomIsi = []
  for (let k = 0; k < lebar; k += 1) {
    if (grid.some((r) => (r[k] ?? '') !== '')) kolomIsi.push(k)
  }
  if (kolomIsi.length === 0) return ['_(lembar kosong)_']
  const kMin = kolomIsi[0]
  const kMax = kolomIsi[kolomIsi.length - 1]

  let bMax = -1
  for (let b = 0; b < grid.length; b += 1) {
    if ((grid[b] ?? []).some((v) => v !== '')) bMax = b
  }
  if (bMax < 0) return ['_(lembar kosong)_']

  /**
   * Header tabel = **label kolom Excel**, dan setiap baris lembar tetap jadi
   * baris data, didahului nomor barisnya.
   *
   * Bukan "baris pertama jadi header": ketujuh lembar di berkas ini berawal
   * dengan baris judul, lalu baris `JABATAN TARGET : …`, dan header sebenarnya
   * baru di baris 3. Memakai baris pertama sebagai header akan **menamai seluruh
   * kolom dengan judul dokumen** — tabel yang terlihat rapi tapi setiap kolomnya
   * salah label. Karena ini transkrip dokumen sumber, yang dibutuhkan
   * keterlacakan: `B7` di berkas ini menunjuk sel yang sama di `.xlsx`-nya.
   */
  const kolomExcel = Array.from({ length: kMax - kMin + 1 }, (_, i) => {
    let n = kMin + i + 1
    let s = ''
    while (n > 0) {
      const sisa = (n - 1) % 26
      s = String.fromCharCode(65 + sisa) + s
      n = Math.floor((n - 1) / 26)
    }
    return s
  })

  const out = [
    `| # | ${kolomExcel.join(' | ')} |`,
    `|---|${kolomExcel.map(() => '---').join('|')}|`,
  ]
  for (let b = 0; b <= bMax; b += 1) {
    const r = grid[b] ?? []
    const sel = Array.from({ length: kMax - kMin + 1 }, (_, i) => escMd(r[kMin + i] ?? ''))
    // Baris yang seluruhnya kosong dilewati — di lembar ini ada belasan, dan
    // menuliskannya hanya memanjangkan tabel tanpa isi.
    if (sel.every((v) => v === '')) continue
    out.push(`| ${b + 1} | ${sel.join(' | ')} |`)
  }
  return out
}

// --- main ------------------------------------------------------------------
const sst = bacaSharedStrings()
const gayaTanggal = bacaGayaTanggal()

const wb = baca('xl/workbook.xml')
const rels = baca('xl/_rels/workbook.xml.rels')
const petaRel = new Map()
for (const r of blok(rels, 'Relationship')) {
  const id = atr(r.atribut, 'Id')
  const target = atr(r.atribut, 'Target')
  if (id && target) petaRel.set(id, target)
}

const daftarSheet = blok(blok(wb, 'sheets')[0].isi, 'sheet').map((s) => ({
  nama: lepasEntitas(atr(s.atribut, 'name') ?? ''),
  rid: atr(s.atribut, 'r:id') ?? '',
}))

const core = baca('docProps/core.xml')
const ambilCore = (t) => core.match(new RegExp(`<${t}[^>]*>([^<]*)</${t}>`))?.[1] ?? '?'

const gambar = readdirSync(`${DIR}/xl/media`).sort()

/**
 * Lembar mana yang punya gambar tersemat.
 *
 * Gambar TIDAK punya alamat sel dalam arti biasa — ia mengapung di atas lembar
 * lewat `drawing*.xml`. Tanpa dicatat per lembar, pembaca berkas Markdown ini
 * tidak punya cara tahu bahwa lembar itu memuat bukti visual selain angka.
 */
function gambarSheet(berkasSheet) {
  const nama = berkasSheet.replace(/^worksheets\//, '')
  let rels
  try {
    rels = baca(`xl/worksheets/_rels/${nama}.rels`)
  } catch {
    return []
  }
  const drawing = blok(rels, 'Relationship')
    .map((r) => atr(r.atribut, 'Target') ?? '')
    .find((t) => t.includes('drawing'))
  if (!drawing) return []
  const namaDrawing = drawing.replace(/^\.\.\//, '').replace('drawings/', '')
  try {
    const dr = baca(`xl/drawings/_rels/${namaDrawing}.rels`)
    return [
      ...new Set(
        blok(dr, 'Relationship')
          .map((r) => (atr(r.atribut, 'Target') ?? '').match(/image\d+\.\w+/)?.[0] ?? '')
          .filter(Boolean),
      ),
    ].sort()
  } catch {
    return []
  }
}


const md = []
md.push('# sample(1).xlsx — konversi Markdown')
md.push('')
md.push(
  '> Dihasilkan program dari `doc/doc_tambahan_2/sample(1).xlsx`. **Berkas `.xlsx` tetap sumbernya**;',
  '> berkas ini untuk dibaca & dicari, bukan untuk disunting.',
)
md.push('')
md.push(`- **Pembuat:** ${ambilCore('dc:creator')}`)
md.push(`- **Dibuat:** ${ambilCore('dcterms:created').slice(0, 10)}`)
md.push(`- **Terakhir diubah:** ${ambilCore('dcterms:modified').slice(0, 10)}`)
md.push(`- **Lembar:** ${daftarSheet.length}`)
md.push(
  `- **Gambar tersemat:** ${gambar.length}, diekstrak ke \`media/\` dan ditranskripsi di [Lampiran](#lampiran--gambar-tersemat)`,
)
md.push('')
md.push('**Cara membaca tabel di bawah:**')
md.push('')
md.push(
  '- Kolom `#` adalah **nomor baris di Excel**, dan judul kolom adalah **label kolom Excel** —',
  '  jadi `B7` di sini menunjuk sel yang sama di berkas aslinya. Baris pertama tiap lembar',
  '  adalah **judul**, bukan header: header sebenarnya ada di **baris 3**.',
  '- Nilai sel bergabung disalin **ke bawah** (supaya `Parameter` tetap terbaca di setiap baris',
  '  yang dicakupnya) tapi **tidak ke kanan** (judul yang membentang sembilan kolom akan terulang',
  '  sembilan kali tanpa menambah informasi).',
  '- Baris yang seluruhnya kosong dilewati; nomor `#` yang melompat berarti baris kosong di aslinya.',
  '- Angka ditampilkan **apa adanya seperti tersimpan** — bobot `0.65` di Excel tampil `0.65`,',
  '  bukan `65%` seperti yang mungkin terlihat di layar karena format sel.',
  '- Sel berformula tampil sebagai `nilai (=rumus)`, mis. `4.5 (=5%*L14)`. Itu penting untuk',
  '  lembar `Sample`, yang justru ada untuk memperagakan cara skornya dihitung.',
)
md.push('')
md.push('## Daftar isi')
md.push('')
daftarSheet.forEach((s, i) => {
  const anchor = s.nama.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-')
  md.push(`${i + 1}. [${s.nama}](#${i + 1}-${anchor})`)
})
md.push('')

const ringkas = []
for (const [i, s] of daftarSheet.entries()) {
  const target = petaRel.get(s.rid)
  if (!target) continue
  const { grid, gabung, dimensi } = bacaSheet(`xl/${target}`, sst, gayaTanggal)
  const barisIsi = grid.filter((r) => r.some((v) => v !== '')).length
  const gbr = gambarSheet(target)
  ringkas.push({ nama: s.nama, barisIsi, dimensi, gabung: gabung.length, gambar: gbr.length })

  md.push(`## ${i + 1}. ${s.nama}`)
  md.push('')
  const catatan = [
    `Rentang \`${dimensi}\``,
    `${barisIsi} baris berisi`,
    gabung.length > 0 ? `${gabung.length} rentang sel bergabung (disalin ke bawah)` : null,
    gbr.length > 0 ? `${gbr.length} gambar mengapung (lihat Lampiran)` : null,
  ].filter(Boolean)
  md.push(`_${catatan.join(' · ')}._`)
  md.push('')
  md.push(...tabelMd(grid))
  md.push('')
}

md.push('---')
md.push('')
md.push('## Ringkasan lembar')
md.push('')
md.push('| # | Lembar | Rentang | Baris berisi | Sel bergabung | Gambar |')
md.push('|---|---|---|---|---|---|')
ringkas.forEach((r, i) => {
  md.push(
    `| ${i + 1} | ${escMd(r.nama)} | \`${r.dimensi}\` | ${r.barisIsi} | ${r.gabung} | ${r.gambar} |`,
  )
})
md.push('')

// ---------------------------------------------------------------------------
// Lampiran gambar
// ---------------------------------------------------------------------------
/**
 * Transkripsi gambar dibaca dari **berkas terpisah**, bukan ditanam di skrip.
 *
 * Alasannya: nama gambar di dalam xlsx selalu `image1.png`, `image2.png`, …
 * berapa pun jumlah workbook-nya. Transkripsi yang ditanam di sini akan **cocok
 * secara nama tapi salah secara isi** begitu skrip ini dijalankan pada kiriman
 * berikutnya — dan hasilnya berkas Markdown yang dengan yakin menjelaskan gambar
 * yang bukan itu. Tanpa berkas pendamping, gambar tetap ditautkan tapi TIDAK
 * dijelaskan, dan itu keadaan yang jujur.
 *
 * Bentuk berkasnya: `[{ "berkas": "image1.png", "layar": "...", "kolom": "..." }]`,
 * plus `"pengantar"` opsional berupa larik baris teks.
 */
let lampiran = { pengantar: [], gambar: [] }
if (BERKAS_LAMPIRAN) {
  const isi = JSON.parse(readFileSync(BERKAS_LAMPIRAN, 'utf8'))
  lampiran = Array.isArray(isi) ? { pengantar: [], gambar: isi } : isi
}

if (gambar.length > 0) {
  md.push('---')
  md.push('')
  md.push('## Lampiran — gambar tersemat')
  md.push('')
  if (lampiran.gambar.length > 0) {
    md.push(
      '> **Transkripsi di bagian ini TIDAK dihasilkan program.** Sisa berkas ini hasil parsing',
      '> XML; keterangan gambar di bawah dihasilkan dengan **membacanya**, lalu disimpan di',
      `> \`${BERKAS_LAMPIRAN.split(/[\\/]/).pop()}\`. Kalau ada keraguan, buka PNG-nya di \`media/\`.`,
    )
    md.push('')
  }
  if ((lampiran.pengantar ?? []).length > 0) {
    md.push(...lampiran.pengantar)
    md.push('')
  }

  for (const berkas of gambar) {
    const l = lampiran.gambar.find((x) => x.berkas === berkas)
    md.push(`### ${berkas}${l ? ` — ${l.layar}` : ''}`)
    md.push('')
    md.push(`![${l?.layar ?? berkas}](media/${berkas})`)
    md.push('')
    if (l) md.push(`**Kolom:** ${l.kolom}`, '')
    else md.push('_Belum ditranskripsi._', '')
  }
}

writeFileSync(KELUARAN, md.join('\n'), 'utf8')
console.log(`ditulis: ${KELUARAN}`)
for (const r of ringkas) {
  console.log(`  ${r.nama.padEnd(32)} ${String(r.barisIsi).padStart(4)} baris  ${r.dimensi}`)
}
