import { describe, expect, it } from 'vitest'

import { bakukanNamaJabatan, jenisJabatan, keteranganTempat, kunciJenisJabatan, labelTargetDenganTempat, rumpunJabatan } from './jenis-jabatan'

describe('jenisJabatan — nama generik untuk daftar pilihan', () => {
  it('cocok dengan lembar Persyaratan Jabatan (sample.xlsx baris 7 & 8)', () => {
    // Ini kontrol yang mengikat aturan ini ke dokumen pemilik proses. Kalau
    // pemangkasannya berubah dan kedua nama ini bergeser, aturannya berhenti
    // sepakat dengan lembar yang jadi acuannya.
    expect(jenisJabatan('Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Aceh')).toBe(
      'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi',
    )
    expect(jenisJabatan('Kepala Sub Bagian Umum dan Tata Usaha')).toBe(
      'Kepala Sub Bagian Umum dan Tata Usaha',
    )
  })

  it('63 kursi balai melipat jadi SATU jenis', () => {
    const contoh = [
      'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Aceh',
      'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera Selatan',
      'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah D.I. Yogyakarta',
    ]
    expect(new Set(contoh.map(kunciJenisJabatan)).size).toBe(1)
  })

  it('ejaan Sub yang berbeda TIDAK jadi dua jenis', () => {
    expect(kunciJenisJabatan('Kepala Subdirektorat Kontrak Kontruksi')).toBe(
      kunciJenisJabatan('Kepala Sub Direktorat Kontrak Kontruksi'),
    )
    expect(kunciJenisJabatan('Kepala Subbagian Tata Usaha')).toBe(
      kunciJenisJabatan('Kepala Sub Bagian Tata Usaha'),
    )
  })

  it('singkatan lembar (Kasubdit/Kasubag) menemukan nama panjang master', () => {
    expect(kunciJenisJabatan('Kasubdit Pengelolaan Katalog Elektronik')).toBe(
      kunciJenisJabatan('Kepala Sub Direktorat Pengelolaan Katalog Elektronik'),
    )
    expect(kunciJenisJabatan('Kasubag Umum dan Tata Usaha')).toBe(
      kunciJenisJabatan('Kepala Sub Bagian Umum dan Tata Usaha'),
    )
  })

  it('"Wilayah" tanpa nama daerah TIDAK dipangkas — itu nama badannya', () => {
    // BJKW = Balai Jasa Konstruksi **Wilayah**. Memangkasnya membuat label
    // kelompok berbeda dari nama jabatan yang ada di dalamnya.
    expect(jenisJabatan('Kepala Balai Jasa Konstruksi Wilayah')).toBe(
      'Kepala Balai Jasa Konstruksi Wilayah',
    )
    // …tapi begitu ada nama daerahnya, ia kembali jadi keterangan tempat.
    expect(jenisJabatan('Kepala Balai Jasa Konstruksi Wilayah VI Makassar')).toBe(
      'Kepala Balai Jasa Konstruksi',
    )
  })

  it('pembeda unit dalam kurung ikut dibuang', () => {
    expect(jenisJabatan('Pembina Jasa Konstruksi Ahli Madya (Kerja Sama)')).toBe(
      'Pembina Jasa Konstruksi Ahli Madya',
    )
  })

  it('TIDAK melipat terlalu jauh — dua Kepala Seksi berbeda tetap berbeda', () => {
    // Melebur keduanya jadi "Kepala Seksi" akan menyatukan dua kursi yang
    // persyaratannya memang berbeda. Ini kontrol negatifnya.
    expect(kunciJenisJabatan('Kepala Seksi Pelaksanaan')).not.toBe(
      kunciJenisJabatan('Kepala Seksi Pengadaan'),
    )
    expect(kunciJenisJabatan('Kepala Sub Direktorat Kontrak Kontruksi')).not.toBe(
      kunciJenisJabatan('Kepala Sub Direktorat Pengelolaan Katalog Elektronik'),
    )
  })

  it('nama tanpa keterangan tempat dikembalikan apa adanya', () => {
    expect(jenisJabatan('Direktur Pengadaan Jasa Konstruksi')).toBe(
      'Direktur Pengadaan Jasa Konstruksi',
    )
  })

  it('tidak pernah mengembalikan string kosong', () => {
    for (const n of ['Wilayah Aceh', '   Wilayah I   ', '(Kerja Sama)']) {
      expect(jenisJabatan(n)).not.toBe('')
    }
  })

  it('keteranganTempat mengambil ekor yang sama dengan yang dibuang jenisJabatan', () => {
    // Satu aturan, dua arah — kalau keduanya berselisih, label kehilangan pembedanya.
    const unit = 'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera Selatan'
    expect(keteranganTempat(unit)).toBe('Wilayah Sumatera Selatan')
    expect(jenisJabatan(unit)).toBe('Balai Pelaksana Pemilihan Jasa Konstruksi')
    // Dijumlahkan kembali harus jadi nama unit utuh — itu yang membuktikan
    // keduanya memotong di titik yang sama, bukan kebetulan cocok.
    expect(`${jenisJabatan(unit)} ${keteranganTempat(unit)}`).toBe(unit)
  })

  it('unit tanpa keterangan tempat → null', () => {
    expect(keteranganTempat('Direktorat Pengadaan Jasa Konstruksi')).toBeNull()
  })

  it('label target membedakan lima Kepala Balai yang bernama sama', () => {
    const nama = 'Kepala Balai Pelaksana Pemilihan Jasa Konstruksi'
    const label = [
      'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera Selatan',
      'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Sumatera Barat',
      'Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Barat',
    ].map((u) => labelTargetDenganTempat(nama, u, 1))
    expect(new Set(label).size).toBe(3)
    expect(label[0]).toBe(`${nama} — Wilayah Sumatera Selatan`)
  })

  it('target beranggota banyak unit TIDAK dilabeli salah satunya', () => {
    // Menyebut unit pertama saja membuat label menyatakan sesuatu yang tidak
    // benar untuk anggota lainnya — lebih buruk daripada tidak menyebut tempat.
    expect(labelTargetDenganTempat('Kepala Balai', 'Balai A Wilayah X', 6)).toBe(
      'Kepala Balai — 6 unit',
    )
    expect(labelTargetDenganTempat('Direktur Pengadaan', null, 0)).toBe('Direktur Pengadaan')
  })

  it('bakukanNamaJabatan merapatkan spasi tanpa mengubah huruf', () => {
    expect(bakukanNamaJabatan('  Kepala   Balai  Jasa Konstruksi ')).toBe(
      'Kepala Balai Jasa Konstruksi',
    )
  })
})

describe('rumpun jabatan — frasa depan (Detail Revisi PUPR butir 4)', () => {
  it('"kepala balai" menjaring SEMUA kepala balai, apa pun nama balainya', () => {
    // Persis yang diminta: dua nama badan yang berbeda (BP2JK & BJKW) satu rumpun.
    expect(rumpunJabatan('Kepala Balai Pelaksana Pemilihan Jasa Konstruksi')).toBe('Kepala Balai')
    expect(rumpunJabatan('Kepala Balai Jasa Konstruksi Wilayah')).toBe('Kepala Balai')
    expect(rumpunJabatan('Kepala Balai Pelaksana Pemilihan Jasa Konstruksi Wilayah Jawa Barat')).toBe(
      'Kepala Balai',
    )
  })

  it('frasa terpanjang menang — bukan "Kepala" untuk semuanya', () => {
    // Kontrol atas cacat urutan daftar: kalau `Kepala` diperiksa lebih dulu,
    // 111 dari 211 baris master melebur jadi satu rumpun tanpa daya beda.
    expect(rumpunJabatan('Kepala Sub Direktorat Bakuan Kompetensi')).toBe('Kepala Sub Direktorat')
    expect(rumpunJabatan('Kepala Sub Bagian Umum dan Tata Usaha')).toBe('Kepala Sub Bagian')
    expect(rumpunJabatan('Kepala Bagian Kepegawaian dan Umum')).toBe('Kepala Bagian')
    expect(rumpunJabatan('Kepala Seksi Pelaksanaan')).toBe('Kepala Seksi')
  })

  it('ejaan rapat ikut terbaca, sebab bakunya dijalankan lebih dulu', () => {
    expect(rumpunJabatan('Kepala Subdirektorat Pengadaan')).toBe('Kepala Sub Direktorat')
    expect(rumpunJabatan('Kasubag Umum dan Tata Usaha')).toBe('Kepala Sub Bagian')
  })

  it('fungsional: jenjangnya dibuang, bidangnya yang jadi rumpun', () => {
    expect(rumpunJabatan('Pembina Jasa Konstruksi Ahli Madya')).toBe('Pembina Jasa Konstruksi')
    expect(rumpunJabatan('Pembina Jasa Konstruksi Ahli Muda (Kerja Sama)')).toBe(
      'Pembina Jasa Konstruksi',
    )
    expect(rumpunJabatan('Pengelola Pengadaan Barang/Jasa Ahli Pertama')).toBe(
      'Pengelola Pengadaan Barang/Jasa',
    )
  })

  it('Direktur Jenderal TIDAK dilebur ke Direktur', () => {
    expect(rumpunJabatan('Direktur Jenderal Bina Konstruksi')).toBe('Direktur Jenderal')
    expect(rumpunJabatan('Direktur Pengadaan Jasa Konstruksi')).toBe('Direktur')
  })

  it('rumpun LEBIH KASAR daripada jenis, dan keduanya tetap ada', () => {
    // Kalau suatu saat `rumpunJabatan` dipakai menggantikan `jenisJabatan`,
    // "Kepala Seksi Pengadaan" & "Kepala Seksi Perbendaharaan" jadi satu kursi.
    expect(jenisJabatan('Kepala Seksi Pengadaan')).toBe('Kepala Seksi Pengadaan')
    expect(rumpunJabatan('Kepala Seksi Pengadaan')).toBe('Kepala Seksi')
    expect(rumpunJabatan('Kepala Seksi Perbendaharaan')).toBe('Kepala Seksi')
  })

  it('nama yang tidak berumpun dikenal dikembalikan apa adanya', () => {
    expect(rumpunJabatan('Pengadministrasi Umum')).toBe('Pengadministrasi Umum')
  })
})
