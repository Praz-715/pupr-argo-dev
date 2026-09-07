import 'server-only'

import { kueri } from '../db'
import { usulkanKategoriJabatan } from '../kategori-jabatan'
import { rumpunJabatan } from '../jenis-jabatan'

/**
 * Ekspor DATA MASTER untuk di-crosscheck di luar aplikasi.
 *
 * Permintaan pemilik proses 2 Sep 2026: *"kita export data master kita buat
 * crosscheck data jabfung jabatan struktural dll buat di mapping jadi filter"*,
 * *"sembari nunggu mappingan excel dari mereka"*.
 *
 * ## Kenapa DUA berkas, bukan satu
 *
 * Yang perlu dicocokkan ada di dua tempat yang bentuknya berbeda:
 *
 *   1. **`jabatan`** — 175 baris master yang rapi, sudah punya `jenis_jabatan` &
 *      `eselon`. Yang dibutuhkan di sini cuma memajangnya beserta pemakaiannya,
 *      supaya kelihatan mana yang sebenarnya tidak dipakai apa pun.
 *   2. **`riwayat_jabatan.jabatan_nama_mentah`** — 1.257 nama BEBAS dari sumber,
 *      dan **hanya 36 dari 1.405 barisnya yang terpetakan ke master**. Inilah yang
 *      sebenarnya menghalangi filter per kategori: selama sebuah baris riwayat
 *      tidak punya kategori, ia tidak bisa disaring maupun dijumlahkan per jenjang.
 *
 * Digabung jadi satu berkas, kedua daftar itu akan berbagi kolom yang artinya
 * berbeda ("nama" master vs "nama" mentah) dan yang mengerjakan pemetaannya harus
 * memilah barisnya sendiri lebih dulu.
 *
 * ## Kolom `usulan_*` adalah USULAN, dan berkasnya mengatakan itu
 *
 * Diisi `usulkanKategoriJabatan()` — pencocokan pola atas teks bebas. Ia ada
 * supaya yang memetakan tidak mulai dari 1.257 baris kosong, **bukan** supaya
 * hasilnya dipakai apa adanya. Kolom `keputusan_kategori` & `keputusan_jenjang`
 * sengaja dikirim KOSONG: itu kolom yang diisi manusia lalu dikembalikan.
 */

export interface BarisMasterJabatan {
  kodeJabatan: string
  namaJabatan: string
  rumpun: string
  namaUnit: string | null
  jenisJabatan: string
  jenjang: string | null
  eselon: string
  statusJabatan: string
  jumlahPenghuni: number
  namaPegawai: string | null
  jadiKursiTarget: number
  jadiJabatanAsal: number
  jumlahRiwayatTertaut: number
}

export async function ambilMasterJabatan(): Promise<BarisMasterJabatan[]> {
  /*
    Kelima kolom turunan (empat penghitung + nama pegawai) ditulis sebagai
    subkueri berkorelasi, bukan JOIN: satu jabatan bisa punya banyak penghuni DAN
    banyak keanggotaan target sekaligus, dan JOIN keduanya melipatgandakan
    barisnya sehingga tiap penghitung menghitung hasil kali — salah tanpa satu pun
    galat. Nama pegawainya dirangkai `GROUP_CONCAT` atas alasan yang sama: kalau
    suatu saat sebuah jabatan punya lebih dari satu penghuni aktif, JOIN biasa
    akan melipatgandakan baris jabatannya. Bebannya tidak jadi soal di sini:
    175 baris master, sekali unduh.
  */
  const baris = await kueri<Record<string, unknown>>(
    `SELECT j.kode_jabatan, j.nama_jabatan, j.jenis_jabatan, j.jenjang, j.eselon,
            j.status_jabatan, u.nama_unit,
            (SELECT COUNT(*) FROM pegawai p
              WHERE p.jabatan_id = j.id AND p.status_aktif = 'AKTIF') AS penghuni,
            (SELECT GROUP_CONCAT(p.nama_lengkap ORDER BY p.nama_lengkap SEPARATOR '; ')
               FROM pegawai p
              WHERE p.jabatan_id = j.id AND p.status_aktif = 'AKTIF') AS nama_pegawai,
            (SELECT COUNT(*) FROM jabatan_target t WHERE t.jabatan_id = j.id) AS kursi_target,
            (SELECT COUNT(*) FROM jabatan_target_anggota a WHERE a.jabatan_id = j.id) AS jabatan_asal,
            (SELECT COUNT(*) FROM riwayat_jabatan r WHERE r.jabatan_id = j.id) AS riwayat
       FROM jabatan j
       LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
      ORDER BY FIELD(j.eselon,'I','II','III','IV','NON_ESELON'), u.nama_unit, j.nama_jabatan`,
  )

  return baris.map((r) => ({
    kodeJabatan: String(r.kode_jabatan),
    namaJabatan: String(r.nama_jabatan),
    rumpun: rumpunJabatan(String(r.nama_jabatan)),
    namaUnit: r.nama_unit === null ? null : String(r.nama_unit),
    jenisJabatan: String(r.jenis_jabatan),
    jenjang: r.jenjang === null ? null : String(r.jenjang),
    eselon: String(r.eselon),
    statusJabatan: String(r.status_jabatan),
    jumlahPenghuni: Number(r.penghuni),
    namaPegawai: r.nama_pegawai === null ? null : String(r.nama_pegawai),
    jadiKursiTarget: Number(r.kursi_target),
    jadiJabatanAsal: Number(r.jabatan_asal),
    jumlahRiwayatTertaut: Number(r.riwayat),
  }))
}

export interface BarisRiwayatMentah {
  namaMentah: string
  jumlahBaris: number
  jumlahPegawai: number
  jumlahTerpetakan: number
  namaMasterTertaut: string | null
  usulanKategori: string
  usulanJenjang: string | null
  usulanEselon: string | null
  usulanPenugasan: string
  rumpun: string
  contohPegawai: string
}

export async function ambilRiwayatMentah(): Promise<BarisRiwayatMentah[]> {
  const baris = await kueri<Record<string, unknown>>(
    `SELECT r.jabatan_nama_mentah,
            COUNT(*) AS baris,
            COUNT(DISTINCT r.pegawai_id) AS pegawai,
            SUM(r.jabatan_id IS NOT NULL) AS terpetakan,
            MAX(j.nama_jabatan) AS nama_master,
            MIN(p.nama_lengkap) AS contoh
       FROM riwayat_jabatan r
       LEFT JOIN jabatan j ON j.id = r.jabatan_id
       JOIN pegawai p ON p.id = r.pegawai_id
      GROUP BY r.jabatan_nama_mentah
      ORDER BY baris DESC, r.jabatan_nama_mentah`,
  )

  return baris.map((r) => {
    const nama = String(r.jabatan_nama_mentah)
    const u = usulkanKategoriJabatan(nama)
    return {
      namaMentah: nama,
      jumlahBaris: Number(r.baris),
      jumlahPegawai: Number(r.pegawai),
      jumlahTerpetakan: Number(r.terpetakan),
      namaMasterTertaut: r.nama_master === null ? null : String(r.nama_master),
      usulanKategori: u.kategori,
      usulanJenjang: u.jenjang,
      usulanEselon: u.eselon,
      usulanPenugasan: u.penugasan,
      rumpun: u.rumpun,
      contohPegawai: String(r.contoh),
    }
  })
}
