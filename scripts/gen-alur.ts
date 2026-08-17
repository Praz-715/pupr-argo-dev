/**
 * Hasilkan `doc/ALUR.md` — peta alur pengguna, DITURUNKAN DARI KODE.
 *
 *   npm run doc:alur
 *
 * Tabel transisi nominasi & daftar menu per peran **tidak ditulis tangan**: ia
 * dibaca dari `lib/workflow.ts`, `lib/peran.ts`, dan `lib/navigasi.ts`. Alasannya
 * sama dengan `doc/sql/007_recompute.sql` di project ini — dokumen yang menyalin
 * isi kode akan berselisih dengannya dalam beberapa minggu, dan pembaca tidak
 * punya cara tahu mana yang benar. Kalau alurnya berubah, jalankan ulang.
 */

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { AKSI, LABEL_NOMINASI, LABEL_POOL, PERAN_GILIRAN } from '../lib/workflow'
import { DESKRIPSI_PERAN, SEMUA_PERAN } from '../lib/peran'
import { NAVIGASI, navigasiUntuk } from '../lib/navigasi'

const AKAR = join(import.meta.dirname ?? '.', '..')

function tabelPeran(): string {
  const b = ['| Peran | Cakupan | Jumlah menu |', '|---|---|---|']
  for (const p of SEMUA_PERAN) {
    const n = navigasiUntuk(p).reduce((t, g) => t + g.item.length, 0)
    b.push(`| **${p}** | ${DESKRIPSI_PERAN[p]} | ${n} |`)
  }
  return b.join('\n')
}

function tabelTransisi(): string {
  const b = [
    '| Aksi | Siapa | Status pool | Status nominasi | Jejak | Perlu alasan |',
    '|---|---|---|---|---|---|',
  ]
  for (const a of Object.values(AKSI)) {
    const dariPool = a.poolDari.map((s) => LABEL_POOL[s]).join(' / ')
    const dariNom = a.nominasiDari
      .map((s) => (s === null ? '_(belum ada)_' : LABEL_NOMINASI[s]))
      .join(' / ')
    const keNom = a.nominasiKe === null ? '_(tidak disentuh)_' : LABEL_NOMINASI[a.nominasiKe]
    b.push(
      `| ${a.destruktif ? '⚠️ ' : ''}**${a.label}** | ${a.peranDiizinkan.join(', ')} ` +
        `| ${dariPool} → **${LABEL_POOL[a.poolKe]}** | ${dariNom} → **${keNom}** ` +
        `| ${a.jejak ? `${a.jejak.tahap} · ${a.jejak.status}` : '—'} | ${a.butuhCatatan ? 'ya' : 'tidak'} |`,
    )
  }
  return b.join('\n')
}

function tabelGiliran(): string {
  const b = ['| Giliran | Peran yang harus bertindak |', '|---|---|']
  for (const [g, peran] of Object.entries(PERAN_GILIRAN)) {
    b.push(`| \`${g}\` | ${peran.length ? peran.join(', ') : '_alur selesai_'} |`)
  }
  return b.join('\n')
}

function tabelMenu(): string {
  const b = ['| Grup | Halaman | Rute | Fase |', '|---|---|---|---|']
  for (const g of NAVIGASI) {
    for (const [i, it] of g.item.entries()) {
      b.push(
        `| ${i === 0 ? (g.label ?? '_(tanpa grup)_') : ''} | ${it.label} | \`${it.href}\` | ${it.fase} |`,
      )
    }
  }
  return b.join('\n')
}

const md = `# ALUR.md — Peta Alur Pengguna SIMT DJBK

> **Dokumen ini DIHASILKAN PROGRAM.** Tabel peran, transisi nominasi, giliran,
> dan daftar menu dibaca langsung dari \`lib/peran.ts\`, \`lib/workflow.ts\`, dan
> \`lib/navigasi.ts\`. Jangan disunting tangan — jalankan \`npm run doc:alur\`.
> Yang ditulis manusia hanya narasi di antara tabel.

## 1. Siapa memakai aplikasi ini

${tabelPeran()}

Jumlah menu berbeda karena navigasi disaring per peran (\`navigasiUntuk()\`), dan
penyaringan itu **bukan** satu-satunya penjagaan: setiap halaman punya gerbang
bacanya sendiri, dan setiap mutasi diperiksa lagi di server action. Menyembunyikan
menu hanya merapikan tampilan.

## 2. Alur masuk

1. \`/masuk\` — username/email + sandi. Balasan gagal **sama untuk semua sebab**
   (akun tidak ada, sandi salah, akun nonaktif) supaya tidak bisa dipakai
   menebak akun mana yang ada.
2. Sandi yang dibuatkan Super Admin memaksa \`/ganti-sandi\` sebelum aplikasi
   terbuka.
3. Lupa sandi → \`/lupa-password\` mengarahkan ke Super Admin. **Belum ada
   pengiriman surel**, dan halamannya menyatakan itu apa adanya alih-alih
   menjanjikan email yang tidak akan datang.
4. Sesi punya dua tenggat: kedaluwarsa absolut dan idle. Keduanya diperiksa di
   dalam SQL yang sama dengan pengambilan penggunanya.

## 3. Alur utama, dari data mentah sampai suksesor

\`\`\`
  Data sumber (eNominasi / impor)
        │
        ▼
  [Kualitas]  Konsolidasi → Antrian Pembersihan → Validasi Riwayat → Kelengkapan
        │      menormalisasi & MENCATAT temuan; tidak pernah menebak diam-diam
        ▼
  [Penilaian] Jabatan Target → rubrik (komponen/indikator/kategori) → Hitung Ulang
        │      menghasilkan match_score + rincian per indikator
        ▼
  [Pemetaan]  Kotak 9 · Peta Talenta · Perbandingan Kandidat · Gap Analysis
        │
        ▼
  [Suksesi]   Kandidat & Eligibility → Talent Pool → Nominasi → Penetapan
        │
        ▼
  Rencana Pengembangan  ·  Laporan & Ekspor  ·  API eksternal /api/v1
\`\`\`

Dua aturan yang berlaku di seluruh alur:

- **Kotak 9 SELALU hasil hitung** dari (Kinerja, Potensial). Nilai \`kotak_9\` yang
  datang dari sistem sumber disimpan terpisah sebagai pembanding kualitas data,
  tidak pernah dipakai perhitungan.
- **Skor tidak pernah menyaring kelayakan.** Gerbang syarat (\`eligible\`) dan skor
  adalah dua hal berbeda; kandidat yang tidak lolos syarat tetap dihitung skornya
  sebagai pembanding.

## 4. Alur nominasi — tabel transisi

Satu keputusan manusia mengubah **tiga** hal sekaligus: status talent pool, status
nominasi, dan satu baris \`approval_log\`. Ketiganya ditulis dalam satu transaksi
lewat \`lib/workflow.ts\`; tidak ada halaman yang boleh menuliskan transisinya
sendiri.

${tabelTransisi()}

### Giliran bertindak

${tabelGiliran()}

"Giliran siapa" **diturunkan** dari status pool + status nominasi (\`giliranSiapa()\`),
tidak disimpan sebagai kolom. Menyimpannya berarti dua sumber kebenaran yang bisa
berselisih tanpa ketahuan.

## 5. Inbox Tugas

Setiap peran melihat pekerjaan yang menunggu **dirinya**, diturunkan dari giliran
di atas — bukan daftar notifikasi yang perlu dibaca manual. Notifikasi disebar
per pengguna saat aksi workflow terjadi.

## 6. Seluruh halaman

${tabelMenu()}

Halaman ber-\`luarSidebar\` (mis. Profil Saya) tetap ada di breadcrumb dan command
palette, tapi tidak di sidebar — jalan masuknya lewat menu pengguna di navbar.

## 7. Di mana tiap alur diuji

| Berkas smoke | Yang dijaga |
|---|---|
| \`fase-0\` | App shell, tema, command palette, menu pengguna, RBAC navigasi, collapse sidebar & grup, localStorage diblokir, aset dev lintas-origin |
| \`fase-1\` | Dashboard: KPI, Kotak 9 + drill-down, jabatan kosong |
| \`fase-2\` | Direktori & profil talenta 360° |
| \`fase-3\` | Peta Talenta & Perbandingan Kandidat |
| \`fase-4\` | Master data, importer, kualitas data |
| \`fase-5\` | Rule engine: jabatan target, editor rubrik, simulasi & diff |
| \`fase-6\` | Talent pool & **seluruh alur nominasi** sampai penetapan + Inbox |
| \`fase-7\` | Auth & RBAC: sesi asli, manajemen pengguna, audit log, pengaturan |
| \`fase-8\` | Laporan & ekspor CSV |
| \`fase-9\` | API eksternal \`/api/v1\`: Bearer, scope, rate limit, jejak |
| \`fase-10\` | Kategori riwayat diklat & validasi riwayat |
| \`fase-11\` | Kotak 9 per jabatan target, syarat pelatihan, risiko kekosongan |

Jalankan satu per satu (\`node e2e/fase-N.smoke.mjs .next/smoke\`), **bukan**
\`npm run smoke\`: skrip gabungan memakai \`&&\` sehingga satu kegagalan
menghentikan sisanya.
`

writeFileSync(join(AKAR, 'doc/ALUR.md'), md)
console.log(`doc/ALUR.md ditulis — ${md.length} karakter`)
