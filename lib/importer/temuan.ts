/**
 * Taksonomi temuan importer — daftar pelanggaran yang boleh ditemukan saat data
 * masuk, beserta cara memperlakukannya.
 *
 * Nomor `aturan` menunjuk langsung ke nomor baris di phase.md §6 supaya jejaknya
 * bisa ditelusuri dua arah: dari kode ke dokumen, dan dari dokumen ke kode.
 *
 * **Prinsip yang mengikat seluruh importer: tidak ada baris yang dibuang.**
 * Sebuah baris yang melanggar aturan tetap masuk DB dalam bentuk yang sudah
 * dikoreksi, dan pelanggarannya dicatat sebagai temuan. Membuang baris berarti
 * kehilangan data pegawai secara diam-diam; menerimanya tanpa catatan berarti
 * kehilangan sinyal bahwa sumbernya perlu dibetulkan.
 */

export type KodeTemuan =
  /** §6.1 — nilai skor di luar 0–100, dipotong ke rentang. */
  | 'SKOR_DI_LUAR_RENTANG'
  /** Potkom di atas 100 — DISIMPAN APA ADANYA, tidak dipotong (keputusan user). */
  | 'POTKOM_DI_ATAS_100'
  /** §6.2 — `kotak_9` sumber berbeda dengan hitungan ambang Lampiran A. */
  | 'KOTAK9_BEDA_DENGAN_HITUNGAN'
  /** Jabatan di master lebih lama daripada riwayat jabatan terbarunya. */
  | 'JABATAN_MASTER_BASI'
  /** §6.3 — nilai integritas datang pada skala kecil (1–4), dinaikkan ke 0–100. */
  | 'INTEGRITAS_SKALA_KECIL'
  /** §6.4 — format golongan campur (`IV.b` vs `III/d`). */
  | 'FORMAT_GOLONGAN'
  /** §6.5 — `jenis_asesmen` beda kapitalisasi atau memakai istilah lama. */
  | 'ISTILAH_ASESMEN_LAMA'
  /** §6.6 — TMT tidak bisa diurai jadi tanggal. */
  | 'TANGGAL_TIDAK_TERURAI'
  /** §6.7 — riwayat jabatan tanpa tanggal / SK / unit terpetakan. */
  | 'RIWAYAT_BELUM_TERSTRUKTUR'
  /** §6.9 — kolom Unit Kerja berisi teks jabatan. */
  | 'UNIT_BERISI_TEKS_JABATAN'
  /** §6.10 — riwayat pendidikan satu teks yang gagal diurai. */
  | 'PENDIDIKAN_TIDAK_TERURAI'
  /** §6.11 — NIP tidak valid. */
  | 'NIP_TIDAK_VALID'
  /** §6.12 — `status_asesmen` tidak sesuai umur asesmennya. */
  | 'STATUS_ASESMEN_TIDAK_KONSISTEN'
  /**
   * Predikat kinerja dari sumber tidak ada di rubrik. Tidak bernomor di
   * phase.md §6: aturannya lahir dari integrasi eNom (`lib/enom`), bukan dari
   * berkas CSV yang jadi dasar §6.
   */
  | 'PREDIKAT_TIDAK_DIKENALI'

/** Seberapa jauh sistem boleh melanjutkan tanpa campur tangan manusia. */
export type TingkatTemuan =
  /** Sudah dikoreksi otomatis dengan aturan tertulis; manusia hanya perlu tahu. */
  | 'DIKOREKSI'
  /** Perlu keputusan manusia — sistem tidak menebak. */
  | 'PERLU_MANUSIA'

export interface DefinisiTemuan {
  kode: KodeTemuan
  /**
   * Nomor aturan di phase.md §6, atau `null` kalau temuan ini TIDAK berasal
   * dari sana. `null`, bukan 0: nol adalah nomor yang menyamar jadi nomor, dan
   * ia akan lolos ke uji kelengkapan §6 seolah-olah aturannya ada di dokumen.
   * Sumber di luar CSV (mis. API eNominasi lewat `lib/enom`) memang tidak punya
   * nomor di §6 — dan itu harus terbaca, bukan disembunyikan.
   */
  aturan: number | null
  label: string
  tingkat: TingkatTemuan
  /** Kenapa ini penting — dipakai UI Antrian Pembersihan, bukan sekadar komentar. */
  dampak: string
}

export const DEFINISI_TEMUAN: Record<KodeTemuan, DefinisiTemuan> = {
  PREDIKAT_TIDAK_DIKENALI: {
    kode: 'PREDIKAT_TIDAK_DIKENALI',
    // Tidak ada di penomoran phase.md §6 — lahir dari integrasi eNom.
    aturan: null,
    label: 'Predikat kinerja tidak dikenali',
    tingkat: 'PERLU_MANUSIA',
    dampak:
      'Barisnya DILEWATI, bukan ditebak. Predikat adalah satu-satunya sumber sumbu Y — menurunkannya dari nilai lain akan menghasilkan Kotak 9 yang tampak wajar dan salah, dan angka yang salah tapi wajar jauh lebih sulit ketahuan daripada baris yang hilang.',
  },
  SKOR_DI_LUAR_RENTANG: {
    kode: 'SKOR_DI_LUAR_RENTANG',
    aturan: 1,
    label: 'Skor di luar rentang 0–100',
    tingkat: 'DIKOREKSI',
    dampak:
      'Nilai dipotong ke 0–100. Nilai mentahnya disimpan di jejak sinkronisasi supaya bisa ditelusuri kalau sumbernya membetulkan diri.',
  },
  POTKOM_DI_ATAS_100: {
    kode: 'POTKOM_DI_ATAS_100',
    // Bukan aturan bernomor di phase.md §6 — ia keputusan pemilik proses
    // (18 Agu 2026) yang MEMBATALKAN pemotongan untuk potkom saja.
    aturan: null,
    label: 'Potkom di atas 100 (disimpan apa adanya)',
    tingkat: 'PERLU_MANUSIA',
    dampak:
      'Nilai TIDAK dipotong — disimpan sesuai sumbernya, dan sumbu X ikut melebihi 100. Diputuskan user setelah dua sumber independen (eNominasi & Excel Talent Pool ES 2/3) sama-sama mengirim potkom >100 pada sekitar 40% rekaman: memotongnya membuat separuh populasi menumpuk di X=100 dan kehilangan seluruh daya bedanya. Klasifikasi Kotak 9 tidak terpengaruh (ambang teratas ≥80, dan >100 tetap ≥80), tapi `nilai_talenta` TETAP diplafon 100 karena ia komposit berskala 0–100.',
  },
  JABATAN_MASTER_BASI: {
    kode: 'JABATAN_MASTER_BASI',
    // Bukan aturan bernomor phase.md §6 — ia tidak lahir saat impor melainkan dari
    // perbandingan dua kolom yang sama-sama sudah tersimpan.
    aturan: null,
    label: 'Jabatan di master lebih lama daripada riwayat jabatan terbarunya',
    tingkat: 'PERLU_MANUSIA',
    dampak:
      'Kolom pegawai.jabatan_id adalah satu-satunya sumber "jabatan sekarang" untuk gerbang JABATAN ASAL KANDIDAT — kalau ia basi, pegawainya dinilai memakai jabatan yang sudah bukan miliknya, dan itu tidak menghasilkan galat apa pun. Terukur 1 Sep 2026: satu pegawai punya riwayat mulai 1 Agu 2026 pada jabatan fungsional sementara master masih mencatatnya Kepala Sub Bagian, sehingga ia lolos syarat di 8 jabatan target sebagai "Kepala Sub Bagian". TIDAK dibetulkan otomatis: riwayatnya teks bebas yang belum dipetakan ke master, dan menimpanya dari sana berarti menebak — apalagi baris PLT/PLH yang memang bukan jabatan definitif. Perbaikannya lewat Ubah identitas di profil pegawainya.',
  },
  KOTAK9_BEDA_DENGAN_HITUNGAN: {
    kode: 'KOTAK9_BEDA_DENGAN_HITUNGAN',
    aturan: 2,
    label: 'Kotak 9 sumber berbeda dengan hasil hitung',
    tingkat: 'PERLU_MANUSIA',
    dampak:
      'Sistem memakai hasil hitung dari (Kinerja, Potensial). Selisih ini berarti sumbernya memakai ambang lain atau nilainya berubah setelah kotak dihitung — perlu dipastikan mana yang benar.',
  },
  INTEGRITAS_SKALA_KECIL: {
    kode: 'INTEGRITAS_SKALA_KECIL',
    aturan: 3,
    label: 'Nilai integritas berskala kecil',
    tingkat: 'DIKOREKSI',
    dampak:
      'Dinaikkan ke skala 0–100 sesuai rubrik Integritas & Moralitas. Kalau dibiarkan, nilai 3 akan terbaca sebagai "hampir nol" dan match score jatuh drastis.',
  },
  FORMAT_GOLONGAN: {
    kode: 'FORMAT_GOLONGAN',
    aturan: 4,
    label: 'Format golongan tidak seragam',
    tingkat: 'DIKOREKSI',
    dampak:
      'Diseragamkan ke notasi garis miring (IV/b). Format campur membuat pengelompokan & filter golongan memecah orang yang sebenarnya segolongan.',
  },
  ISTILAH_ASESMEN_LAMA: {
    kode: 'ISTILAH_ASESMEN_LAMA',
    aturan: 5,
    label: 'Istilah/kapitalisasi jenis asesmen tidak baku',
    tingkat: 'DIKOREKSI',
    dampak:
      'Diseragamkan ke Title Case dan istilah terkini (JPT Pratama). Tanpa itu, satu jenjang yang sama muncul sebagai beberapa kategori berbeda di filter.',
  },
  TANGGAL_TIDAK_TERURAI: {
    kode: 'TANGGAL_TIDAK_TERURAI',
    aturan: 6,
    label: 'Tanggal tidak bisa diurai',
    tingkat: 'PERLU_MANUSIA',
    dampak:
      'Tanggal dibiarkan kosong dan barisnya ditandai — TIDAK diisi tebakan. Indikator Lama Jabatan bergantung pada tanggal ini, jadi tebakan akan langsung memalsukan skor.',
  },
  RIWAYAT_BELUM_TERSTRUKTUR: {
    kode: 'RIWAYAT_BELUM_TERSTRUKTUR',
    aturan: 7,
    label: 'Riwayat jabatan belum terstruktur',
    tingkat: 'PERLU_MANUSIA',
    dampak:
      'Diterima apa adanya dan ditandai. Indikator yang bergantung padanya (Lama, Keragaman, Substansi Jabatan) jatuh ke penilaian manual bertanda jejak, bukan dianggap nol.',
  },
  UNIT_BERISI_TEKS_JABATAN: {
    kode: 'UNIT_BERISI_TEKS_JABATAN',
    aturan: 9,
    label: 'Kolom Unit Kerja berisi teks jabatan',
    tingkat: 'PERLU_MANUSIA',
    dampak:
      'TIDAK dibetulkan otomatis — hanya heuristik yang mendeteksinya, dan salah tebak akan memindahkan pegawai ke unit yang bukan tempatnya. Perlu verifikasi manusia.',
  },
  PENDIDIKAN_TIDAK_TERURAI: {
    kode: 'PENDIDIKAN_TIDAK_TERURAI',
    aturan: 10,
    label: 'Riwayat pendidikan tidak bisa diurai',
    tingkat: 'PERLU_MANUSIA',
    dampak:
      'Jenjang dan/atau bidang studi tidak terbaca dari teks gabungan. Indikator Tingkat Pendidikan & Kesesuaian Bidang Ilmu tidak bisa dihitung otomatis sampai dipetakan.',
  },
  NIP_TIDAK_VALID: {
    kode: 'NIP_TIDAK_VALID',
    aturan: 11,
    label: 'NIP tidak valid',
    tingkat: 'PERLU_MANUSIA',
    dampak:
      'NIP adalah kunci identitas sekaligus sumber usia, jenis kelamin, masa kerja, dan proyeksi pensiun. NIP salah berarti kelima turunan itu salah — dan pegawai bisa terhitung dua kali.',
  },
  STATUS_ASESMEN_TIDAK_KONSISTEN: {
    kode: 'STATUS_ASESMEN_TIDAK_KONSISTEN',
    aturan: 12,
    label: 'Status asesmen tidak sesuai umurnya',
    tingkat: 'DIKOREKSI',
    dampak:
      'Status dihitung ulang dari aturan masa berlaku 3 tahun. Kolom mentah tidak dipercaya sendirian karena asesmen kedaluwarsa yang berstatus "Berlaku" akan lolos jadi kandidat talent pool.',
  },
}

export interface Temuan {
  kode: KodeTemuan
  /** Kolom/field sumber yang bermasalah. */
  field: string
  /** Nilai mentah sebelum koreksi — jejak yang wajib disimpan. */
  nilaiMentah: string | null
  /** Nilai yang dipakai sistem setelah koreksi; null kalau tidak dikoreksi. */
  nilaiDipakai: string | null
  /** Penjelasan spesifik untuk baris ini (bukan penjelasan umum kodenya). */
  keterangan: string
}

export function buatTemuan(
  kode: KodeTemuan,
  field: string,
  nilaiMentah: unknown,
  nilaiDipakai: unknown,
  keterangan: string,
): Temuan {
  return {
    kode,
    field,
    nilaiMentah: nilaiMentah === null || nilaiMentah === undefined ? null : String(nilaiMentah),
    nilaiDipakai:
      nilaiDipakai === null || nilaiDipakai === undefined ? null : String(nilaiDipakai),
    keterangan,
  }
}

export function tingkatTemuan(kode: KodeTemuan): TingkatTemuan {
  return DEFINISI_TEMUAN[kode].tingkat
}

/** Temuan yang menuntut keputusan manusia — inilah isi Antrian Pembersihan Data. */
export function perluManusia(temuan: Temuan[]): Temuan[] {
  return temuan.filter((t) => tingkatTemuan(t.kode) === 'PERLU_MANUSIA')
}

/**
 * Hasil normalisasi satu baris: nilai yang dipakai + temuannya.
 * Tidak ada varian "gagal" — importer tidak pernah menolak baris (lihat catatan
 * di kepala berkas).
 */
export interface HasilImpor<T> {
  nilai: T
  temuan: Temuan[]
}
