import 'server-only'

import { eksekusi } from './db'
import { ambilPohonRubrik } from './kueri/rubrik'

/**
 * Salin pohon rubrik (komponen → indikator → sub-indikator → kategori) dari satu
 * jabatan target ke jabatan target lain.
 *
 * ## Kenapa dipisah dari server action
 *
 * `duplikasiRubrik()` di `lib/aksi/jabatan-target.ts` bergerbang `gerbangPeran()`
 * dan menulis jejak lewat `jalankanMutasi()` — keduanya menuntut **pengguna yang
 * sudah masuk**. Skrip tidak punya sesi, jadi jalur skrip tidak bisa memanggilnya.
 *
 * Menyalin logikanya ke dalam skrip adalah jawaban yang salah: pohon rubrik ditulis
 * berlapis (induk lebih dulu supaya anaknya punya `parent_indikator_id`), dan dua
 * penulis dengan urutan berbeda menghasilkan rubrik yang **bentuknya** berbeda
 * tanpa satu pun galat — sub-indikator yang kehilangan induknya tetap menghasilkan
 * angka, hanya angka yang salah (`lib/scoring` sengaja tidak melempar).
 *
 * Jadi intinya diangkat ke sini, dan **kedua** pemanggil memakainya: server action
 * (yang menambahkan gerbang peran + jejak audit di atasnya) dan skrip. Pola yang
 * sama dengan `lib/skoring-tulis.ts`, yang dipisah supaya jalur tulisnya bisa
 * diukur tanpa browser.
 */

export interface HasilSalinRubrik {
  jumlahKomponen: number
  jumlahIndikator: number
  jumlahKategori: number
}

async function salinIndikator(
  komponenId: number,
  parentId: number | null,
  node: {
    namaIndikator: string
    kunci: string | null
    bobot: number | null
    modeSkor: string
    /**
     * Skala nilai mentah (doc/sql/023). WAJIB ikut disalin — tanpa ini rubrik
     * salinan menilai Potkom pada skala 0–100 sementara aslinya 0–150, jadi
     * setiap orang ber-potkom di atas 100 kembali berbagi satu skor 100,00.
     * Tidak ada galat; hanya peringkat yang diam-diam kehilangan daya bedanya.
     */
    skalaMaks: number | null
    kebutuhanData: string | null
    sumberData: string | null
    urutan: number
    kategori: Array<{
      namaKategori: string
      nilaiSkor: number | null
      ambangMin: number | null
      ambangMax: number | null
      urutan: number
    }>
  },
): Promise<number> {
  const { insertId } = await eksekusi(
    `INSERT INTO rubrik_indikator
       (rubrik_komponen_id, parent_indikator_id, nama_indikator, kunci_sistem, bobot_indikator,
        mode_skor, skala_maks, kebutuhan_data, sumber_data, urutan)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      komponenId,
      parentId,
      node.namaIndikator,
      node.kunci,
      node.bobot,
      node.modeSkor,
      node.skalaMaks,
      node.kebutuhanData,
      node.sumberData,
      node.urutan,
    ],
  )

  if (node.kategori.length > 0) {
    await eksekusi(
      `INSERT INTO rubrik_kategori_skor
         (rubrik_indikator_id, nama_kategori, nilai_skor, ambang_min, ambang_max, urutan)
       VALUES ${node.kategori.map(() => '(?, ?, ?, ?, ?, ?)').join(', ')}`,
      node.kategori.flatMap((s) => [
        insertId,
        s.namaKategori,
        s.nilaiSkor,
        s.ambangMin,
        s.ambangMax,
        s.urutan,
      ]),
    )
  }
  return insertId
}

/**
 * Tulis salinan rubrik. **Tidak** memeriksa peran dan **tidak** menulis audit —
 * itu tugas pemanggilnya; server action menambahkannya, skrip mencatat jejaknya
 * sendiri.
 *
 * Pemanggil WAJIB memastikan rubrik tujuan masih kosong. Menimpa rubrik yang sudah
 * dipakai menghitung berarti membuang bobot yang mungkin sudah disetel tanpa jejak.
 */
export async function salinPohonRubrik(
  idTujuan: number,
  idSumber: number,
): Promise<HasilSalinRubrik> {
  const sumber = await ambilPohonRubrik(idSumber)
  let jumlahIndikator = 0
  let jumlahKategori = 0

  for (const k of sumber) {
    const { insertId: komponenId } = await eksekusi(
      `INSERT INTO rubrik_komponen (jabatan_target_id, sumbu, nama_komponen, bobot_komponen, urutan)
       VALUES (?, ?, ?, ?, ?)`,
      [idTujuan, k.sumbu, k.namaKomponen, k.bobot, k.urutan],
    )
    // Sub-indikator butuh id induknya, jadi induk ditulis lebih dulu lalu anaknya
    // menyusul — bukan satu INSERT berisi seluruh pohon.
    for (const i of k.indikator) {
      const indukId = await salinIndikator(komponenId, null, i)
      jumlahIndikator++
      jumlahKategori += i.kategori.length
      for (const anak of i.anak) {
        await salinIndikator(komponenId, indukId, anak)
        jumlahIndikator++
        jumlahKategori += anak.kategori.length
      }
    }
  }

  return { jumlahKomponen: sumber.length, jumlahIndikator, jumlahKategori }
}
