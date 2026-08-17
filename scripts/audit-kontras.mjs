/**
 * Audit kontras seluruh pasangan warna teks×latar di kedua tema.
 *
 * Nilainya DIBACA dari `app/globals.css`, tidak ditulis ulang di sini — versi
 * pertama audit ini menyalin nilainya, dan salinan yang mengaudit dirinya
 * sendiri hanya membuktikan bahwa dua daftar itu identik. Kalau token diganti
 * dan skrip ini tidak, ia harus GAGAL, bukan tetap hijau.
 *
 * Lahir saat memporting identitas visual v1 (navy + emas PU) ke v2. Portingnya
 * memunculkan empat belas pasangan di bawah ambang, dan tiga di antaranya
 * SUDAH ADA di v1 — paling parah teks deskripsi di ujung teal pita kepala
 * (3,59:1), yang tidak pernah ketahuan karena v1 tidak pernah mengukurnya.
 * Warna bermerek adalah tempat kontras paling mudah jebol: latar navy/gradien
 * tidak punya satu nilai, jadi "sudah kulihat dan terbaca" hanya berlaku untuk
 * titik gradien yang kebetulan dilihat.
 *
 *   node scripts/audit-kontras.mjs
 *
 * Ambang: 4,5:1 teks biasa · 3:1 objek grafis non-teks (WCAG 2.1 AA).
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const AKAR = join(dirname(fileURLToPath(import.meta.url)), '..')
const css = readFileSync(join(AKAR, 'app/globals.css'), 'utf8')

/**
 * Plafon tint sel Kotak 9 dibaca dari `lib/warna-seri.ts`, tidak disalin —
 * angka yang disalin akan tetap hijau di sini sementara komponennya memakai
 * nilai lain, dan justru itu bentuk kegagalan yang paling mahal.
 */
const warnaSeriTs = readFileSync(join(AKAR, 'lib/warna-seri.ts'), 'utf8')
const TINT_KOTAK_9 = Object.fromEntries(
  [...warnaSeriTs.matchAll(/(dasar|rentang|kosong):\s*([\d.]+)/g)].map((m) => [m[1], Number(m[2])]),
)
if (!TINT_KOTAK_9.dasar || !TINT_KOTAK_9.rentang) {
  throw new Error('Gagal membaca TINT_KOTAK_9 dari lib/warna-seri.ts')
}

// ── Baca token ────────────────────────────────────────────────────────────────

/** Ambil isi satu blok deklarasi (`:root {…}` / `.dark {…}`) sebagai peta token. */
function blok(pemilih) {
  const i = css.indexOf(`${pemilih} {`)
  if (i < 0) throw new Error(`Blok ${pemilih} tidak ditemukan di globals.css`)
  // Batasnya deklarasi berikutnya di tingkat atas, bukan `}` pertama: blok ini
  // memuat komentar yang bisa berisi kurung kurawal.
  const akhir = css.indexOf('\n}', i)
  const isi = css.slice(i, akhir)
  const peta = {}
  for (const m of isi.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) peta[m[1]] = m[2].trim()
  return peta
}

/** Nilai token yang mungkin menunjuk token lain (`var(--x)`), ditelusuri. */
function nilai(peta, nama, dasar) {
  let v = peta[nama] ?? dasar?.[nama]
  for (let i = 0; i < 8 && v?.startsWith('var('); i++) {
    const ref = v.slice(4, v.indexOf(')')).trim()
    v = peta[ref] ?? dasar?.[ref]
  }
  if (!v) throw new Error(`Token ${nama} tidak ada`)
  return v
}

/** Titik-titik warna sebuah `linear-gradient(...)` — tiap stop diaudit sendiri. */
function stopGradien(nilaiGradien) {
  return [...nilaiGradien.matchAll(/#[0-9a-f]{6}\b/gi)].map((m) => m[0])
}

/** Nilai `--sc-*` satu nada kartu KPI, dari class `.nada-x` / `.dark .nada-x`. */
function nada(pemilih) {
  const i = css.indexOf(`${pemilih} {`)
  if (i < 0) throw new Error(`Nada ${pemilih} tidak ditemukan`)
  const isi = css.slice(i, css.indexOf('}', i))
  const peta = {}
  for (const m of isi.matchAll(/(--sc-[\w-]+):\s*([^;]+);/g)) peta[m[1]] = m[2].trim()
  return peta
}

// ── Kontras ───────────────────────────────────────────────────────────────────

function keRgb(h) {
  let s = h.replace('#', '')
  if (s.length === 3)
    s = [...s].map((c) => c + c).join('')
  return [0, 2, 4].map((i) => parseInt(s.slice(i, i + 2), 16) / 255)
}

const linear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)

function luminansi(h) {
  const [r, g, b] = keRgb(h).map(linear)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function kontras(a, b) {
  const [terang, gelap] = [luminansi(a), luminansi(b)].sort((x, y) => y - x)
  return (terang + 0.05) / (gelap + 0.05)
}

/**
 * Komposit putih semi-transparan di atas latar. Wajib: latar tombol & badge di
 * dalam pita kepala adalah `rgb(255 255 255 / .12)`, dan mengaudit nilai
 * transparan itu apa adanya akan mengukur kontras terhadap putih pekat —
 * padahal yang dilihat mata adalah hasil campurannya dengan gradien di baliknya.
 */
function komposit(alpha, latar, depan = '#ffffff') {
  const d = keRgb(depan)
  return (
    '#' +
    keRgb(latar)
      .map((v, i) => Math.round((v * (1 - alpha) + d[i] * alpha) * 255).toString(16).padStart(2, '0'))
      .join('')
  )
}

// ── Jalankan ──────────────────────────────────────────────────────────────────

const terang = blok(':root')
const gelap = blok('.dark')
const NADA = ['biru', 'hijau', 'amber', 'merah', 'violet', 'teal', 'slate']

let gagal = 0
let total = 0

function cek(label, fg, bg, ambang) {
  total++
  const r = kontras(fg, bg)
  const lolos = r >= ambang
  if (!lolos) gagal++
  if (!lolos || process.env.VERBOSE)
    console.log(
      `  ${lolos ? 'ok   ' : 'GAGAL'} ${r.toFixed(2).padStart(5)} / ${ambang}  ${label}`,
    )
}

for (const [namaTema, t, gelapkah] of [
  ['TEMA TERANG', terang, false],
  ['TEMA GELAP', gelap, true],
]) {
  console.log(`\n═══ ${namaTema} ═══`)
  const v = (n) => nilai(t, n, terang)
  const n = (kunci) => nada(gelapkah ? `.dark .nada-${kunci}` : `.nada-${kunci}`)

  const permukaan = [
    ['surface', v('--surface')],
    ['surface-2', v('--surface-2')],
    ['surface-3', v('--surface-3')],
    ['surface-inset', v('--surface-inset')],
    ['kanvas', v('--kanvas')],
  ]

  // Teks bodi di setiap permukaan. Ketiga tingkat teks memuat informasi, jadi
  // ketiganya 4,5:1 — termasuk `text-subtle` yang dipakai baris konteks kartu.
  for (const [namaBg, bg] of permukaan) {
    for (const tingkat of ['--text', '--text-muted', '--text-subtle']) {
      cek(`${tingkat} di ${namaBg}`, v(tingkat), bg, 4.5)
    }
    cek(`--accent (tautan) di ${namaBg}`, v('--accent'), bg, 4.5)
    for (const status of ['--success', '--warning', '--danger', '--neutral']) {
      cek(`${status} di ${namaBg}`, v(status), bg, 4.5)
    }
  }

  // Teks status di atas latar subtle-nya sendiri (badge).
  for (const s of ['success', 'warning', 'danger', 'neutral']) {
    cek(`--${s} di --${s}-subtle (badge)`, v(`--${s}`), v(`--${s}-subtle`), 4.5)
  }

  // Sidebar: gradien, jadi tiap stop diperiksa — bukan cuma satu warna rata.
  for (const stop of stopGradien(v('--sidebar-gradien'))) {
    cek(`--sidebar-teks di stop ${stop}`, v('--sidebar-teks'), stop, 4.5)
    cek(`--sidebar-teks-kuat di stop ${stop}`, v('--sidebar-teks-kuat'), stop, 4.5)
    cek(`--sidebar-teks-samar di stop ${stop}`, v('--sidebar-teks-samar'), stop, 4.5)
    cek(`--emas (garis 3px, grafis) di stop ${stop}`, v('--emas'), stop, 3)
  }
  cek('--sidebar-aktif-teks di --sidebar-aktif-bg', v('--sidebar-aktif-teks'), v('--sidebar-aktif-bg'), 4.5)
  cek('--merek-900 di --emas (tanda "MT")', v('--merek-900'), v('--emas'), 4.5)

  // Pita kepala halaman + aksi di dalamnya (token ditimpa `.pita-kepala-aksi`).
  for (const stop of stopGradien(v('--kepala-gradien'))) {
    cek(`--kepala-teks di stop ${stop}`, v('--kepala-teks'), stop, 4.5)
    cek(`--kepala-teks-samar di stop ${stop}`, v('--kepala-teks-samar'), stop, 4.5)
    cek(`aksi: tombol sekunder (putih di putih-12%) @${stop}`, v('--kepala-teks'), komposit(0.12, stop), 4.5)
    cek(`aksi: badge netral (putih di putih-14%) @${stop}`, v('--kepala-teks'), komposit(0.14, stop), 4.5)
    cek(`aksi: tombol utama (navy di emas) @${stop}`, v('--merek-900'), v('--emas'), 4.5)
  }

  // Kartu KPI: angka besar di surface, ikon di dalam chip berwarnanya.
  for (const kunci of NADA) {
    const sc = n(kunci)
    cek(`nada ${kunci}: angka (--sc-fg) di surface`, sc['--sc-fg'], v('--surface'), 4.5)
    cek(`nada ${kunci}: ikon di chip (grafis)`, sc['--sc-fg'], sc['--sc-soft'], 3)
    cek(`nada ${kunci}: bar tepi vs surface (grafis)`, sc['--sc-bar'], v('--surface'), 3)
  }

  // Band Kotak 9. Dua hal diperiksa, dan yang KEDUA yang paling mudah jebol:
  //   1. warna band vs surface >=3:1 — ia dipakai sebagai GARIS sel, objek grafis;
  //   2. `--text` di atas latar sel pada TINT TERPEKAT >=4,5:1.
  // Nomor 2 memakai plafon tint yang benar-benar dipakai komponen, dibaca dari
  // `lib/warna-seri.ts`. Jadi menaikkan plafon di sana tanpa mengubah warnanya
  // akan membuat audit ini MERAH — bukan lolos diam-diam. Itu justru gunanya:
  // v1 memakai teks putih di atas kuning & hijau muda (1,74–2,28:1) karena tidak
  // ada yang pernah mengukurnya.
  const plafonTint = TINT_KOTAK_9.dasar + TINT_KOTAK_9.rentang
  for (let i = 1; i <= 5; i++) {
    const band = v(`--k9-${i}`)
    cek(`--k9-${i} vs surface (garis sel, grafis)`, band, v('--surface'), 3)
    cek(
      `--text di sel k9-${i} pada tint ${Math.round(plafonTint * 100)}%`,
      v('--text'),
      komposit(plafonTint, v('--surface'), band),
      4.5,
    )
  }

  // Seri chart: objek grafis, 3:1 vs permukaan tempat chart digambar.
  for (let i = 1; i <= 4; i++) {
    cek(`--chart-${i} vs surface (grafis)`, v(`--chart-${i}`), v('--surface'), 3)
  }

  // Kartu harus terpisah dari kanvas TANPA mengandalkan border 1px saja.
  cek('surface vs kanvas (pemisahan permukaan)', v('--surface'), v('--kanvas'), 1.1)
}

console.log(
  `\n${gagal === 0 ? `SEMUA LOLOS — ${total} pasangan diperiksa` : `${gagal} dari ${total} pasangan GAGAL`}`,
)
process.exit(gagal === 0 ? 0 : 1)
