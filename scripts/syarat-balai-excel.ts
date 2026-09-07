/**
 * Selaraskan jabatan target BP2JK/BJKW dengan `Persyaratan Jabatan Struktural di
 * BP2JK dan BJKW.xlsx` — kering secara bawaan.
 *
 *   npm run syarat:balai
 *   npm run syarat:balai -- --tulis
 *
 * Instruksi pemilik proses 2 Sep 2026: *"ikutin yang ada excel terbaru."*
 *
 * ## Tiga hal yang diselaraskan, dan kenapa
 *
 * 1. **Daftar jabatan asal kandidat** — dibuat SERAGAM untuk seluruh target
 *    berkursi sama. Jabatan asal menjawab "dari kursi mana seseorang boleh
 *    dinominasikan", pertanyaan yang tidak bergantung balai mana; daftar yang beda
 *    antar balai berarti kandidat yang sama diterima di satu tempat dan ditolak di
 *    tempat lain, tanpa satu pun galat.
 *
 * 2. **`PENGALAMAN_MIN` DIHAPUS** untuk kursi yang Excel-nya berbunyi "ATAU".
 *    Excel menulis *"pengalaman pada jabatan pengawas … ATAU jabatan fungsional
 *    (Pembina JK Ahli Madya/Muda atau Pengelola Pengadaan Ahli Muda/Madya)"*,
 *    sementara `evaluasiKelayakan()` meng-AND seluruh baris persyaratan. Jabatan
 *    fungsional ber-eselon NON_ESELON, jadi ia tidak akan pernah lolos
 *    `PENGALAMAN_MIN = IV`: **ATAU-nya berubah jadi DAN**, dan cabang fungsional
 *    mati total. Terukur sebelum perubahan: 11 pegawai gugur di #439 HANYA karena
 *    baris itu.
 *
 *    Yang menggantikannya bukan ketiadaan aturan: **daftar jabatan asal sudah
 *    menyatakan hal yang sama**, dan ia bisa menyatakan ATAU karena bentuknya
 *    memang himpunan. Kalimat Excel-nya sendiri tetap tersimpan sebagai baris
 *    `LAINNYA` — deskriptif, ditandai perlu verifikasi manusia — supaya syarat
 *    durasinya ("paling singkat 3 tahun") tidak hilang dari layar hanya karena
 *    belum bisa ditegakkan otomatis.
 *
 * 3. **Pendidikan & golongan** disamakan dengan Excel.
 *
 * ## Aturan pencocokan DITULIS EKSPLISIT, tidak diturunkan dari teks Excel
 *
 * Kolom Pengalaman Kerja adalah prosa. Menurunkan himpunan jabatan darinya secara
 * otomatis berarti pencocokan samar yang MENULIS — hal yang sudah sekali
 * menempelkan 56 jabatan ke unit yang salah di proyek ini. Jadi aturannya ditulis
 * tangan di bawah, satu per satu, dan JSON hasil ekstraksi dipakai sebagai
 * pembanding: skrip menolak jalan kalau golongan/pendidikan di JSON tidak sama
 * dengan yang dipakai aturan.
 */

import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const TULIS = process.argv.includes('--tulis')

interface Kursi {
  /** Nama jabatan di master yang jadi KURSI-nya. */
  namaKursi: RegExp
  /** Unit tempatnya — membedakan Kasubag BP2JK dari Kasubag BJKW. */
  unit: RegExp
  labelExcel: string
  pendidikanMin: string
  golonganMin: string
  durasiTahun: number
  /** Kalimat Excel apa adanya — disimpan sebagai baris LAINNYA. */
  pengalaman: string
  /** Jabatan asal: dikembalikan `true` untuk kursi master yang boleh jadi asal. */
  asal: (nama: string, jenis: string, eselon: string) => boolean
}

const KURSI: Kursi[] = [
  {
    namaKursi: /^Kepala Balai Pelaksana Pemilihan Jasa Konstruksi/i,
    unit: /Balai Pelaksana Pemilihan/i,
    labelExcel: 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi',
    pendidikanMin: 'S1_D4',
    golonganMin: 'III/d',
    durasiTahun: 3,
    pengalaman:
      'Memiliki pengalaman pada jabatan pengawas (kepala subbagian umum dan tata usaha/tata usaha/kepala seksi) paling singkat 3 tahun ATAU jabatan fungsional (Pembina Jasa Konstruksi Ahli Madya/Muda atau Pengelola Pengadaan Barang dan Jasa Ahli Muda/Madya) yang setingkat dengan jabatan pengawas sesuai dengan bidang tugas jabatan yang akan diduduki.',
    /*
      Eselon IV = ketiga nama yang Excel sebut. Diperiksa: SELURUH jabatan eselon IV
      di master ini memang Kepala Sub Bagian Umum & TU (41), Kepala Sub Bagian Tata
      Usaha (7), atau Kepala Seksi (11) — jadi "eselon IV" dan daftar Excel-nya
      menghasilkan himpunan yang sama, dan memakai eselon membuatnya tidak patah
      pada penulisan nama yang tak lazim.
    */
    asal: (nama, _jenis, eselon) =>
      eselon === 'IV' ||
      /^Pembina Jasa Konstruksi Ahli (Madya|Muda)/i.test(nama) ||
      /^Pengelola Pengadaan Barang\/Jasa Ahli (Muda|Madya)/i.test(nama),
  },
  {
    namaKursi: /^Kepala Sub ?Bagian Umum dan Tata Usaha/i,
    unit: /Balai Pelaksana Pemilihan/i,
    labelExcel: 'Kepala Sub Bagian Umum dan Tata Usaha (BP2JK)',
    pendidikanMin: 'S1_D4',
    golonganMin: 'III/b',
    durasiTahun: 4,
    pengalaman:
      'Memiliki pengalaman dalam jabatan pelaksana paling singkat 4 tahun ATAU jabatan fungsional yang setingkat dengan jabatan pelaksana sesuai dengan bidang tugas jabatan yang akan diduduki (Pembina Jasa Konstruksi Ahli Muda/Pertama atau Pengelola Pengadaan Barang dan Jasa Ahli Muda/Pertama). Jabatan pelaksana = semua jabatan selain struktural dan fungsional berjenjang.',
    /*
      "Jabatan pelaksana" menurut keterangan Excel = semua jabatan selain struktural
      dan fungsional berjenjang. Di master ini yang memenuhi definisi itu persis
      `jenis_jabatan = FUNGSIONAL_UMUM`.
    */
    asal: (nama, jenis, eselon) =>
      (eselon === 'NON_ESELON' && jenis === 'FUNGSIONAL_UMUM') ||
      /^Pembina Jasa Konstruksi Ahli (Muda|Pertama)/i.test(nama) ||
      /^Pengelola Pengadaan Barang\/Jasa Ahli (Muda|Pertama)/i.test(nama),
  },
]

async function main() {
  const { kueri, eksekusi } = await import('../lib/db')
  const { readFileSync } = await import('node:fs')

  // Penjaga: aturan di atas harus cocok dengan hasil ekstraksi Excel-nya.
  const excel = JSON.parse(
    readFileSync('doc/data/persyaratan-balai.json', 'utf8'),
  ) as Array<{ namaJabatan: string; tempat: string; pendidikanMin: string; golonganMin: string }>
  for (const k of KURSI) {
    const cocok = excel.find(
      (e) => k.namaKursi.test(e.namaJabatan.trim()) && k.unit.test(e.tempat ?? ''),
    )
    if (cocok === undefined) {
      console.error(`BERHENTI: "${k.labelExcel}" tidak ada di doc/data/persyaratan-balai.json`)
      process.exit(1)
    }
    const pendExcel = cocok.pendidikanMin === 'S2' ? 'S2' : 'S1_D4'
    if (pendExcel !== k.pendidikanMin || cocok.golonganMin !== k.golonganMin) {
      console.error(
        `BERHENTI: aturan "${k.labelExcel}" (${k.pendidikanMin} · ${k.golonganMin}) berselisih dengan Excel (${pendExcel} · ${cocok.golonganMin}). Excel mungkin sudah direvisi — perbarui aturannya, jangan dilewati.`,
      )
      process.exit(1)
    }
  }

  const master = await kueri<{ id: number; nama_jabatan: string; jenis_jabatan: string; eselon: string }>(
    `SELECT id, nama_jabatan, jenis_jabatan, eselon FROM jabatan WHERE status_jabatan <> 'DIHAPUS'`,
  )

  console.log(`\nmode: ${TULIS ? 'TULIS' : 'kering'}\n`)
  let totalUbah = 0

  for (const k of KURSI) {
    const target = (
      await kueri<{ id: number; nama_target: string; nama_kursi: string | null; nama_unit: string | null; status: string }>(
        `SELECT t.id, t.nama_target, j.nama_jabatan AS nama_kursi, u.nama_unit, t.status
           FROM jabatan_target t
           LEFT JOIN jabatan j ON j.id = t.jabatan_id
           LEFT JOIN unit_organisasi u ON u.id = j.unit_organisasi_id`,
      )
    ).filter((t) => k.namaKursi.test(t.nama_kursi ?? '') && k.unit.test(t.nama_unit ?? ''))

    const asalSeharusnya = master.filter((m) => k.asal(m.nama_jabatan, m.jenis_jabatan, m.eselon))
    console.log(`=== ${k.labelExcel} — ${target.length} jabatan target · ${asalSeharusnya.length} kursi asal menurut Excel`)
    if (target.length === 0) {
      console.log('    (belum ada jabatan target untuk kursi ini — persyaratannya belum bisa dipasang)\n')
      continue
    }

    for (const t of target) {
      const ada = new Set(
        (
          await kueri<{ jabatan_id: number }>(
            `SELECT jabatan_id FROM jabatan_target_anggota WHERE jabatan_target_id = ?`,
            [t.id],
          )
        ).map((r) => Number(r.jabatan_id)),
      )
      const idSeharusnya = new Set(asalSeharusnya.map((m) => m.id))
      const tambah = asalSeharusnya.filter((m) => !ada.has(m.id))
      const buang = [...ada].filter((id) => !idSeharusnya.has(id))

      const syarat = await kueri<{ id: number; jenis_syarat: string; nilai_minimal: string | null }>(
        `SELECT id, jenis_syarat, nilai_minimal FROM jabatan_target_persyaratan WHERE jabatan_target_id = ?`,
        [t.id],
      )
      const pengalamanEselon = syarat.filter((s) => s.jenis_syarat === 'PENGALAMAN_MIN')
      const adaLainnya = syarat.some((s) => s.jenis_syarat === 'LAINNYA')
      const gol = syarat.find((s) => s.jenis_syarat === 'GOLONGAN_MIN')
      const pend = syarat.find((s) => s.jenis_syarat === 'PENDIDIKAN_MIN')

      const rencana = [
        tambah.length > 0 ? `+${tambah.length} asal` : null,
        buang.length > 0 ? `−${buang.length} asal` : null,
        pengalamanEselon.length > 0 ? `hapus PENGALAMAN_MIN=${pengalamanEselon[0]?.nilai_minimal}` : null,
        adaLainnya ? null : 'tambah LAINNYA (kalimat Excel)',
        gol?.nilai_minimal === k.golonganMin ? null : `GOLONGAN_MIN → ${k.golonganMin}`,
        pend?.nilai_minimal === k.pendidikanMin ? null : `PENDIDIKAN_MIN → ${k.pendidikanMin}`,
      ].filter(Boolean)

      console.log(
        `  #${t.id} ${(t.nama_unit ?? '-').slice(0, 44).padEnd(46)} ${ada.size} asal → ${asalSeharusnya.length}` +
          (rencana.length === 0 ? '  · sudah sesuai' : `  · ${rencana.join(' · ')}`),
      )
      if (buang.length > 0) {
        const nama = new Map<string, number>()
        for (const id of buang) {
          const m = master.find((x) => x.id === id)
          if (m) nama.set(m.nama_jabatan, (nama.get(m.nama_jabatan) ?? 0) + 1)
        }
        for (const [n, c] of [...nama.entries()].sort((a, b) => b[1] - a[1])) {
          console.log(`        −${String(c).padStart(2)} ${n}`)
        }
      }
      if (rencana.length === 0) continue
      totalUbah++
      if (!TULIS) continue

      if (tambah.length > 0) {
        await eksekusi(
          `INSERT IGNORE INTO jabatan_target_anggota (jabatan_target_id, jabatan_id) VALUES ${tambah.map(() => '(?,?)').join(',')}`,
          tambah.flatMap((m) => [t.id, m.id]),
        )
      }
      if (buang.length > 0) {
        await eksekusi(
          `DELETE FROM jabatan_target_anggota WHERE jabatan_target_id = ? AND jabatan_id IN (?)`,
          [t.id, buang],
        )
      }
      for (const s of pengalamanEselon) {
        await eksekusi(`DELETE FROM jabatan_target_persyaratan WHERE id = ?`, [s.id])
      }
      if (!adaLainnya) {
        await eksekusi(
          `INSERT INTO jabatan_target_persyaratan (jabatan_target_id, jenis_syarat, deskripsi, nilai_minimal, durasi_tahun_min)
           VALUES (?, 'LAINNYA', ?, NULL, ?)`,
          [t.id, k.pengalaman, k.durasiTahun],
        )
      }
      if (gol !== undefined && gol.nilai_minimal !== k.golonganMin) {
        await eksekusi(`UPDATE jabatan_target_persyaratan SET nilai_minimal = ? WHERE id = ?`, [k.golonganMin, gol.id])
      }
      if (pend !== undefined && pend.nilai_minimal !== k.pendidikanMin) {
        await eksekusi(`UPDATE jabatan_target_persyaratan SET nilai_minimal = ? WHERE id = ?`, [k.pendidikanMin, pend.id])
      }
    }
    console.log('')
  }

  console.log(`── ${TULIS ? 'DITULIS' : 'kering'} ── ${totalUbah} jabatan target ${TULIS ? 'diubah' : 'akan diubah'}`)
  if (!TULIS) console.log('   Tambahkan `--tulis` untuk menerapkan.\n')
  else console.log('   WAJIB berikutnya: `npm run hitung:ulang -- --tulis` — kelayakan tidak berubah sampai dihitung ulang.\n')
  process.exit(0)
}

void main()
