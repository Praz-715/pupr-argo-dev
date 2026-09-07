/**
 * Alias NAMA JABATAN — satu definisi, dipakai `rapikan-jabatan.ts` dan
 * `rapikan-unit.ts`.
 *
 * Berkas terpisah karena `rapikan-jabatan.ts` adalah skrip yang menjalankan
 * `main()` saat diimpor; mengambil satu fungsi darinya berarti menjalankan
 * seluruh skripnya. Alasan yang sama dengan `_unit-organisasi.ts`.
 *
 * Isinya satu entri, dan konteks lengkapnya ada di `rapikan-jabatan.ts`: daftar
 * acuan menuliskan "Direktur Kompetensi dan Produktivitas **Konstruksi** Tenaga
 * Kerja Konstruksi" — kata "Konstruksi" dua kali — sementara master memakai nama
 * tanpa pengulangan. Keduanya kursi yang sama; tanpa alias ini penjaga kesesuaian
 * menahan penghapusan duplikatnya, dan dengan menghapusnya tanpa alias kesesuaian
 * turun 123/123 → 122/123.
 *
 * Dipakai HANYA untuk membandingkan. Yang tersimpan tetap ejaan master.
 */

const norm = (s: string): string =>
  (s || '')
    .toLowerCase()
    .replace(/\bsub\s+direktorat\b/g, 'subdirektorat')
    .replace(/\bsub\s+bagian\b/g, 'subbagian')
    .replace(/\bsub\s+bidang\b/g, 'subbidang')
    .replace(/\bjf\b/g, 'jabatan fungsional')
    .replace(/kontruksi/g, 'konstruksi')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

const ALIAS = new Map<string, string>([
  [
    norm('Direktur Kompetensi dan Produktivitas Konstruksi Tenaga Kerja Konstruksi'),
    norm('Direktur Kompetensi dan Produktivitas Tenaga Kerja Konstruksi'),
  ],
  /*
    Kepala BJKW. Acuan menulis "Jasa Konstruksi" TIGA KALI (baris 37, 40, 43, 46, 49,
    52, 55 kolom C `Nama Jabatan Struktural.xlsx` — diverifikasi ke XML mentahnya,
    bukan salah ekstraksi). Master memakai nama generik, sejajar dengan 34 kepala
    BP2JK yang juga bernama satu nama dan dibedakan unitnya (doc/sql/027).

    Ini BUKAN gelar kepala BP2JK: "Kepala Balai Pelaksana Pemilihan Jasa Konstruksi"
    milik BP2JK (34 unit, 2 kursi), sementara BJKW badan lain (7 unit, 3 kursi).
    Ditanyakan pemilik proses 31 Agu 2026 dan diperiksa ke sumbernya sebelum dijawab.
  */
  [
    norm('Kepala Balai Jasa Konstruksi Pelaksana Pemilihan Jasa Konstruksi Jasa Konstruksi'),
    norm('Kepala Balai Jasa Konstruksi Wilayah'),
  ],
])

export function kunciJabatan(s: string | null): string {
  const n = norm(s ?? '')
  return ALIAS.get(n) ?? n
}

/**
 * Alias NAMA UNIT — salah ketik yang sama, di kolom yang berbeda.
 *
 * Daftar acuan menulis "Direktorat Kompetensi dan Produktivitas **Konstruksi**
 * Tenaga Kerja Konstruksi" untuk UNIT-nya juga, sementara master memakai nama tanpa
 * pengulangan. Tanpa alias ini, pemeriksaan kesesuaian melaporkan **6 pasangan
 * "hilang"** yang sebenarnya ada — dan angka 117/123 itu terbaca sebagai regresi
 * yang lalu dikejar ke arah yang salah (terjadi 31 Agu 2026).
 *
 * Diangkat ke sini 31 Agu 2026: sebelumnya ia disalin di `rapikan-jabatan.ts` DAN
 * `rapikan-unit.ts`, dan salinan ketiga hampir lahir di `audit-jabatan.ts`. Tiga
 * definisi atas "unit mana yang dianggap sama" adalah tiga jawaban yang bisa
 * berselisih — persis alasan berkas ini ada.
 */
const ALIAS_UNIT = new Map<string, string>([
  [
    norm('Direktorat Kompetensi dan Produktivitas Konstruksi Tenaga Kerja Konstruksi'),
    norm('Direktorat Kompetensi dan Produktivitas Tenaga Kerja Konstruksi'),
  ],
])

export function kunciUnit(s: string | null): string {
  const n = norm(s ?? '')
  return ALIAS_UNIT.get(n) ?? n
}

/**
 * Alias PASANGAN (nama jabatan, unit).
 *
 * Kosong sejak 31 Agu 2026, dan sengaja DIPERTAHANKAN sebagai mekanisme: ia ada
 * untuk salah ketik yang pemetaannya satu-ke-BANYAK, yaitu keadaan yang tidak bisa
 * dijawab alias nama-saja.
 *
 * Kasus yang melahirkannya: daftar acuan menamai kepala ketujuh BJKW dengan SATU
 * nama yang sama — "Kepala Balai Jasa Konstruksi Pelaksana Pemilihan Jasa Konstruksi
 * Jasa Konstruksi", "Jasa Konstruksi" tiga kali, dan itu memang ada di sel aslinya
 * (baris 37, 40, 43, 46, 49, 52, 55 kolom C) — sementara master saat itu menamai
 * ketujuhnya BERBEDA-BEDA menurut wilayahnya. Satu nama acuan → tujuh nama master,
 * jadi hanya kunci (nama, unit) yang bisa memetakannya tanpa mengarang.
 *
 * `doc/sql/027` menghapus kebutuhan itu: ketujuh kepala BJKW kini bernama sama
 * ("Kepala Balai Jasa Konstruksi"), mengikuti pola 34 BP2JK. Pemetaannya kembali
 * satu-ke-satu, jadi ia pindah ke `ALIAS` nama-saja di atas — lebih sedikit yang
 * bisa melapuk, dan tidak ada lagi daftar tujuh nama unit yang harus ikut diperbarui
 * kalau ada balai bertambah.
 */
const ALIAS_PASANGAN = new Map<string, string>()

/**
 * Kunci pembanding pasangan (jabatan, unit) — pakai INI, bukan
 * `kunciJabatan(n) + kunciUnit(u)` dirangkai sendiri, supaya alias pasangan ikut
 * berlaku di setiap pemeriksa kesesuaian.
 */
export function kunciPasangan(nama: string | null, unit: string | null): string {
  const u = kunciUnit(unit)
  const langsung = `${norm(nama ?? '')}@@${u}`
  const nj = ALIAS_PASANGAN.get(langsung) ?? kunciJabatan(nama)
  return `${nj}@@${u}`
}
