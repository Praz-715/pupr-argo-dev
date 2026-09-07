/**
 * Aturan penamaan & klasifikasi unit organisasi — **satu definisi**, dipakai
 * `impor-talentpool.ts` dan `rapikan-jabatan.ts`.
 *
 * ## Kenapa berkas terpisah
 *
 * Kedua skrip itu membuat baris `unit_organisasi` dari nama unit yang datang
 * dari berkas sumber. Waktu aturannya masih hidup di importir saja, skrip kedua
 * menulis versi seadanya: kode unitnya `LPJK-<nomor urut jabatan>` — nomor yang
 * tidak punya hubungan apa pun dengan unitnya, dan berubah kalau urutan
 * barisnya bergeser — sementara `jenis` & `level_eselon` dipaku
 * `'SEKRETARIAT', 2`, yang kebetulan benar untuk satu unit yang dibuatnya dan
 * salah untuk unit berikutnya. Dua penulis dengan aturan berbeda atas tabel
 * yang sama adalah cacat yang sudah pernah terjadi di proyek ini (40 Balai
 * masuk sebagai DIREKTORAT eselon 2, sehingga pohon organisasi menyatakan DJBK
 * punya 40 direktorat baru).
 */

/** Perataan teks untuk pembandingan & penurunan kode. */
export const samakan = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Nama unit → (awalan kode, `jenis`, `level_eselon`).
 *
 * Enum `unit_organisasi.jenis` sudah memuat BALAI & BP2JK, jadi tidak ada yang
 * perlu ditambah di skema.
 */
export function klasifikasiUnit(nama: string): {
  kodeAwal: string
  jenis: string
  level: number | null
} {
  const n = nama.toLowerCase()
  if (n.includes('balai pelaksana pemilihan')) return { kodeAwal: 'BP2JK', jenis: 'BP2JK', level: 3 }
  if (n.startsWith('balai')) return { kodeAwal: 'BALAI', jenis: 'BALAI', level: 3 }
  if (n.startsWith('sekretariat')) return { kodeAwal: 'SET', jenis: 'SEKRETARIAT', level: 2 }
  if (n.startsWith('subdirektorat')) return { kodeAwal: 'SUBDIT', jenis: 'SUBDIT', level: 3 }
  if (n.startsWith('bagian')) return { kodeAwal: 'BAG', jenis: 'BAGIAN', level: 3 }
  if (n.startsWith('subbagian') || n.startsWith('seksi'))
    return { kodeAwal: 'SEKSI', jenis: 'SEKSI', level: 4 }
  return { kodeAwal: 'DIT', jenis: 'DIREKTORAT', level: 2 }
}

const KATA_UMUM = new Set([
  'balai', 'pelaksana', 'pemilihan', 'jasa', 'konstruksi', 'wilayah', 'direktorat',
  'sekretariat', 'jenderal', 'bina', 'subdirektorat', 'bagian', 'subbagian', 'seksi', 'dan',
])

/**
 * Kode unit yang PASTI unik, dan pembedanya diambil dari EKOR nama.
 *
 * Versi pertama mengambil kata ke-2 & ke-3 (`slice(1, 3)`) — cocok untuk
 * Direktorat, yang pembedanya di depan ("Direktorat **Kepatuhan Intern**"), tapi
 * gagal total untuk Balai, yang pembedanya justru di belakang: "Balai Jasa
 * Konstruksi Wilayah **I Aceh**" dan "… Wilayah **II Palembang**" dua-duanya
 * menghasilkan `BALAI-JASA-KONSTRUKSI`. Yang menyelamatkan bukan pemeriksaan
 * saya melainkan `uk_unit_kode` + transaksinya: rollback, nol baris berubah.
 *
 * Sekarang kata umum dibuang, lalu diambil kata-kata TERAKHIR sebagai pembeda,
 * dan keunikannya DITEGAKKAN terhadap kode yang sudah terpakai — bukan
 * diharapkan.
 */
export function kodeUnitUnik(nama: string, terpakai: Set<string>): string {
  const { kodeAwal } = klasifikasiUnit(nama)
  const kata = samakan(nama)
    .split(' ')
    .filter((w) => w.length > 1 && !KATA_UMUM.has(w))
  // Ekor, bukan kepala: itu bagian yang membedakan satu Balai dari Balai lain.
  const inti = kata.slice(-3).join('-').toUpperCase().replace(/[^A-Z0-9-]/g, '')
  const dasar = `${kodeAwal}-${inti}`.slice(0, 30).replace(/-+$/, '')
  if (!terpakai.has(dasar)) {
    terpakai.add(dasar)
    return dasar
  }
  for (let i = 2; i < 100; i++) {
    const alt = `${dasar.slice(0, 30 - String(i).length - 1)}-${i}`
    if (!terpakai.has(alt)) {
      terpakai.add(alt)
      return alt
    }
  }
  throw new Error(`Tidak bisa membuat kode unit unik untuk "${nama}"`)
}
