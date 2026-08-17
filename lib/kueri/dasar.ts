import 'server-only'

/**
 * Potongan SQL yang dipakai lintas berkas kueri.
 *
 * Isinya bukan sekadar kenyamanan menulis: **"asesmen mana yang dianggap
 * berlaku untuk seorang pegawai"** adalah aturan bisnis. Kalau definisinya
 * disalin ke tiap berkas, satu perubahan (mis. aturan pemecah seri) membuat
 * dashboard, direktori, dan peta talenta menghitung populasi yang berbeda tanpa
 * ada yang menyadarinya — persis larangan di CLAUDE.md #1 & #2.
 */

/**
 * Asesmen terbaru per pegawai.
 *
 * `ROW_NUMBER` (bukan `MAX(tahun)` + JOIN) supaya pegawai dengan dua asesmen
 * pada tahun yang sama tidak terhitung ganda; `id DESC` jadi pemecah serinya —
 * baris yang dimasukkan terakhir dianggap paling mutakhir.
 */
export const CTE_ASESMEN_TERBARU = `
  WITH asesmen_terbaru AS (
    SELECT * FROM (
      SELECT a.*, ROW_NUMBER() OVER (
        PARTITION BY a.pegawai_id ORDER BY a.tahun_asesmen DESC, a.id DESC
      ) AS rn
      FROM asesmen_talenta a
    ) x WHERE x.rn = 1
  )
`

/**
 * Sub-kueri unit organisasi beserta seluruh turunannya (rekursif).
 *
 * Filter unit harus **mencakup unit di bawahnya**: memilih "Direktorat Bina
 * Kompetensi" tanpa menyertakan subdirektoratnya akan menampilkan hampir nol
 * pegawai, karena pegawai bergantung pada unit terdalam. Parameternya satu:
 * id unit akar.
 */
export const SUBKUERI_UNIT_TURUNAN = `
  SELECT id FROM (
    WITH RECURSIVE pohon AS (
      SELECT id FROM unit_organisasi WHERE id = ?
      UNION ALL
      SELECT u.id FROM unit_organisasi u JOIN pohon t ON u.parent_id = t.id
    )
    SELECT id FROM pohon
  ) AS turunan
`

/**
 * Batasi populasi ke pegawai yang **ada di sistem sumber (eNominasi)**.
 *
 * Dinyalakan lewat `HANYA_PEGAWAI_SUMBER=true` di env. Bawaannya MATI, dan itu
 * disengaja: ini saklar untuk melihat aplikasi berjalan atas data sumber saja,
 * bukan perilaku produksi. Mematikannya cukup menghapus satu baris env — tidak
 * perlu menyentuh kode, dan tidak ada baris DB yang pernah dihapus.
 *
 * **"Ada di sumber" = punya baris `asesmen_talenta` ber-`sumber_sync='eNominasi'`.**
 * Bukan `sumber_sinkron` di tabel `pegawai`: kolom itu menyatakan dari mana
 * BIODATA-nya datang, sedangkan yang ditanyakan di sini adalah "apakah orang ini
 * dijawab oleh API asesmen" — dan eNom hanya memuat pegawai yang sudah punya
 * rekaman asesmen di sana.
 *
 * Kenapa satu konstanta dan bukan klausa yang ditulis ulang per berkas: definisi
 * populasi yang tersebar membuat dashboard, direktori, dan peta talenta
 * menghitung angka berbeda tanpa ada yang menyadarinya — larangan yang sama
 * dengan `CTE_ASESMEN_TERBARU` di atas.
 *
 * Pemakaian: sisipkan setelah klausa WHERE yang sudah ada, dengan alias tabel
 * `pegawai` sebagai argumen.
 *
 *     `SELECT ... FROM pegawai p WHERE p.status_aktif='AKTIF' ${filterSumber('p')}`
 */
export const HANYA_SUMBER = process.env.HANYA_PEGAWAI_SUMBER === 'true'

export function filterSumber(aliasPegawai: string): string {
  return filterSumberPegawaiId(`${aliasPegawai}.id`)
}

/**
 * Varian untuk kueri yang memegang **kolom `pegawai_id`** tapi tidak punya
 * tabel `pegawai` di scope-nya — mis. agregat `FROM hukuman_disiplin` atau
 * `FROM riwayat_jabatan`. Tanpa ini, menyaringnya menuntut JOIN `pegawai` yang
 * ditambahkan hanya demi filternya; JOIN begitu mengubah rencana kueri dan bisa
 * melipatgandakan baris kalau relasinya bukan 1:1 — dua efek samping yang tidak
 * ada hubungannya dengan yang sedang dibatasi.
 *
 * Ketiga varian di berkas ini adalah **satu definisi populasi** yang sama; yang
 * berbeda cuma cara menyebut pegawainya. Jangan menulis `EXISTS`-nya langsung
 * di kueri — begitu ia ada di dua tempat, "siapa yang ditampilkan" punya dua
 * jawaban dan halaman mulai berselisih tanpa ada yang gagal.
 */
export function filterSumberPegawaiId(kolomPegawaiId: string): string {
  if (!HANYA_SUMBER) return ''
  return ` AND EXISTS (
    SELECT 1 FROM asesmen_talenta _fs
    WHERE _fs.pegawai_id = ${kolomPegawaiId} AND _fs.sumber_sync = 'eNominasi'
  )`
}

/**
 * Varian untuk sub-kueri yang memakai `FROM pegawai` TANPA alias.
 * Dipisah supaya pemanggil tidak menebak-nebak alias yang tidak ada.
 */
export function filterSumberTanpaAlias(): string {
  return HANYA_SUMBER
    ? ` AND EXISTS (
    SELECT 1 FROM asesmen_talenta _fs
    WHERE _fs.pegawai_id = pegawai.id AND _fs.sumber_sync = 'eNominasi'
  )`
    : ''
}
