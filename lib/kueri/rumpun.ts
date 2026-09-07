import 'server-only'

import { cache } from 'react'

import { kueri } from '../db'
import { URUTAN_ESELON, peringkatEselon } from '../eselon'
import { kunciRumpunJabatan, rumpunJabatan } from '../jenis-jabatan'
import { SUBKUERI_UNIT_TURUNAN, filterSumber } from './dasar'

/**
 * Penyaring RUMPUN jabatan — "kepala balai", bukan "kepala balai apa".
 *
 * Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 4):
 * *"filter ini harus jadi filterasi awal data ke kandidat di modul manapun.
 * Defaultnya ada semua tapi ada infonya filtrasi umum."*
 *
 * ## Kenapa aturannya tetap di TypeScript, dan SQL cuma menerima daftar
 *
 * `rumpunJabatan()` (`lib/jenis-jabatan.ts`) meratakan ejaan, membuang keterangan
 * tempat, lalu mencocokkan frasa depan dari daftar terurut. Menuliskannya ulang
 * sebagai `nama_jabatan LIKE 'Kepala Sub Direktorat%'` di setiap kueri berarti
 * **dua aturan atas satu pertanyaan**, dan yang kedua akan meleset justru pada
 * penulisan yang tidak lazim — "Kepala Subdirektorat Pengadaan" tidak cocok
 * dengan pola mana pun, jadi ia lenyap dari daftar tanpa satu pun galat. Itu
 * bentuk kegagalan yang sama dengan `samaUnit()` 85% yang pernah menempelkan 56
 * jabatan ke unit yang salah.
 *
 * Jadi rumpunnya dihitung SEKALI di TypeScript atas daftar nama jabatan, dan yang
 * masuk ke SQL hanya `nama_jabatan IN (…)`. Yang dikirim NAMA, bukan id: daftar
 * nama itu **belasan** (65 nama berbeda di master sekarang) sementara idnya
 * ratusan, dan `IN` berisi ratusan angka akan tumbuh bersama master.
 *
 * ## Bawaannya TIDAK menyaring
 *
 * `rumpun` yang kosong atau tidak dikenali mengembalikan klausa kosong — bukan
 * himpunan kosong. Penyaring yang bawaannya membuang baris membuat halaman
 * tampak rusak bagi orang yang tidak pernah memilih apa pun, dan itu persis yang
 * diminta dihindari ("defaultnya ada semua").
 */

export interface OpsiRumpun {
  /** Kunci untuk URL — `rumpunJabatan()` yang dilumatkan huruf besar-kecilnya. */
  kunci: string
  /** Label siap tampil, mis. "Kepala Balai". */
  label: string
  /** Berapa PEGAWAI aktif yang jabatannya masuk rumpun ini. */
  jumlahPegawai: number
  /** Berapa kursi (baris `jabatan`) di dalamnya. */
  jumlahJabatan: number
}

/**
 * Peta rumpun → nama jabatan, dibaca sekali per permintaan.
 *
 * `cache()` bukan penghematan mikro: penyaring ini dipasang di beberapa panel
 * pada halaman yang sama, dan tanpa itu tiap panel menembakkan kueri master
 * jabatan sendiri-sendiri. Pola yang sama dengan `bacaSesi()`.
 */
const petaRumpun = cache(async (): Promise<Map<string, { label: string; nama: string[] }>> => {
  const baris = await kueri<{ nama_jabatan: string }>(
    `SELECT DISTINCT nama_jabatan FROM jabatan WHERE status_jabatan <> 'DIHAPUS'`,
  )
  const peta = new Map<string, { label: string; nama: string[] }>()
  for (const b of baris) {
    const kunci = kunciRumpunJabatan(b.nama_jabatan)
    const ada = peta.get(kunci)
    if (ada) ada.nama.push(b.nama_jabatan)
    else peta.set(kunci, { label: rumpunJabatan(b.nama_jabatan), nama: [b.nama_jabatan] })
  }
  return peta
})

/**
 * Klausa `AND …` untuk menyaring menurut rumpun, atau string kosong.
 *
 * Dipakai bersama `params.push(...hasil.params)` di posisi yang sama.
 *
 * ⚠️ Kalau kueri pemanggilnya punya `OR` di klausa yang sama, **kurung dulu
 * cabang OR-nya**. `A OR B AND rumpun` mengikat sebagai `A OR (B AND rumpun)`,
 * jadi penyaringnya hanya berlaku untuk cabang kanan dan lolos tanpa galat —
 * kelas kesalahan yang sudah pernah kena 8 kueri sekaligus di repo ini.
 */
export interface KlausaRumpun {
  sql: string
  params: string[]
}

export async function klausaRumpun(
  kolomNamaJabatan: string,
  rumpun: string | null | undefined,
): Promise<KlausaRumpun> {
  if (!rumpun || rumpun.trim() === '') return { sql: '', params: [] }
  const peta = await petaRumpun()
  const isi = peta.get(rumpun.trim().toLowerCase())
  // Rumpun tak dikenal TIDAK menyaring. Ia hanya bisa datang dari URL yang
  // diketik atau di-bookmark sebelum master berubah, dan menjawabnya dengan nol
  // baris terbaca sebagai halaman rusak — bukan sebagai "pilihannya sudah tidak ada".
  if (isi === undefined || isi.nama.length === 0) return { sql: '', params: [] }
  const tanda = isi.nama.map(() => '?').join(', ')
  return { sql: ` AND ${kolomNamaJabatan} IN (${tanda})`, params: isi.nama }
}

/** Label siap tampil sebuah kunci rumpun, atau `null` kalau tidak dikenal. */
export async function labelRumpun(rumpun: string | null | undefined): Promise<string | null> {
  if (!rumpun || rumpun.trim() === '') return null
  return (await petaRumpun()).get(rumpun.trim().toLowerCase())?.label ?? null
}

/**
 * Opsi penyaring, **diturunkan dari populasi yang ditampilkan**.
 *
 * Aturan yang sudah berlaku di seluruh penyaring aplikasi ini: opsi yang
 * menjawab nol baris terbaca sebagai "penyaringnya rusak", bukan sebagai
 * "datanya memang tidak ada". Jadi rumpun yang tidak punya satu pun pegawai aktif
 * di dalam lingkup pembacanya tidak ditawarkan.
 */
export async function ambilOpsiRumpun(unitWajib: number | null): Promise<OpsiRumpun[]> {
  const params: unknown[] = []
  let batas = ''
  if (unitWajib !== null) {
    batas = ` AND j.unit_organisasi_id IN (${SUBKUERI_UNIT_TURUNAN})`
    params.push(unitWajib)
  }
  const baris = await kueri<{ nama_jabatan: string; pegawai: number; kursi: number }>(
    `SELECT j.nama_jabatan,
            COUNT(DISTINCT p.id) AS pegawai,
            COUNT(DISTINCT j.id) AS kursi
       FROM jabatan j
       LEFT JOIN pegawai p
              ON p.jabatan_id = j.id AND p.status_aktif = 'AKTIF' ${filterSumber('p')}
      WHERE j.status_jabatan <> 'DIHAPUS' ${batas}
      GROUP BY j.nama_jabatan`,
    params,
  )

  const peta = new Map<string, OpsiRumpun>()
  for (const b of baris) {
    const kunci = kunciRumpunJabatan(b.nama_jabatan)
    const ada = peta.get(kunci)
    if (ada) {
      ada.jumlahPegawai += Number(b.pegawai)
      ada.jumlahJabatan += Number(b.kursi)
    } else {
      peta.set(kunci, {
        kunci,
        label: rumpunJabatan(b.nama_jabatan),
        jumlahPegawai: Number(b.pegawai),
        jumlahJabatan: Number(b.kursi),
      })
    }
  }
  return [...peta.values()]
    .filter((o) => o.jumlahPegawai > 0)
    .sort((a, b) => b.jumlahPegawai - a.jumlahPegawai || a.label.localeCompare(b.label))
}

/**
 * Rumpun jabatan satu tingkat DI BAWAH sebuah eselon — calon "pengumpan" promosi.
 *
 * Dipakai sebagai **isi bawaan** syarat `RUMPUN_JABATAN` saat jabatan target dibuat
 * (pilihan pemilik proses 1 Sep 2026). Untuk target eselon III, ia menghasilkan
 * rumpun eselon IV yang benar-benar ada di master — mis. `Kepala Sub Bagian` &
 * `Kepala Seksi`.
 *
 * ## Diturunkan dari MASTER, bukan dari peta yang ditulis tangan
 *
 * "Eselon III diisi dari Kepala Seksi & Kepala Sub Bagian" benar hari ini dan akan
 * diam-diam salah pada rumpun berikutnya yang belum terdaftar. Yang dibaca di sini
 * rumpun apa saja yang NYATA ada pada eselon itu, jadi ia ikut bergerak bersama
 * master tanpa seorang pun harus ingat memperbaruinya.
 *
 * ## Hasilnya DITULIS ke baris syarat, tidak dibaca hidup
 *
 * Pemanggilnya menyimpan hasil ini sebagai `nilai_minimal` sebuah persyaratan, lalu
 * berhenti memanggilnya. Kalau aturannya dihitung ulang setiap kali skor
 * dievaluasi, menambah satu jabatan anggota — atau satu jabatan baru di master —
 * akan diam-diam mengubah SIAPA YANG LOLOS, tanpa ada yang memutuskannya dan tanpa
 * jejak. Sebagai baris syarat, ia terlihat di tab Persyaratan, bisa disunting, dan
 * tercatat di `audit_log` seperti syarat lain.
 *
 * Larik kosong = tidak ada tingkat di bawahnya (`NON_ESELON`) atau eselon itu tidak
 * dikenali. Pemanggilnya TIDAK boleh menuliskan syarat kosong: syarat
 * `RUMPUN_JABATAN` tanpa nilai membuat semua orang PERLU_VERIFIKASI_MANUAL.
 */
export async function rumpunSatuTingkatDiBawah(eselon: string | null): Promise<string[]> {
  const peringkat = peringkatEselon(eselon)
  if (peringkat === null || peringkat <= 0) return []
  const dibawah = (Object.keys(URUTAN_ESELON) as Array<keyof typeof URUTAN_ESELON>).find(
    (e) => URUTAN_ESELON[e] === peringkat - 1,
  )
  if (dibawah === undefined) return []

  const baris = await kueri<{ nama_jabatan: string }>(
    `SELECT DISTINCT nama_jabatan FROM jabatan
      WHERE status_jabatan <> 'DIHAPUS' AND eselon = ?`,
    [dibawah],
  )
  const set = new Map<string, string>()
  for (const b of baris) set.set(kunciRumpunJabatan(b.nama_jabatan), rumpunJabatan(b.nama_jabatan))
  return [...set.values()].sort((a, b) => a.localeCompare(b))
}
