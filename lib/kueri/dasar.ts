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
