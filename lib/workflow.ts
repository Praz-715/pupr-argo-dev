import type { Peran } from './peran'

/**
 * State machine workflow nominasi & talent pool — **satu-satunya** tempat aturan
 * transisi status ditulis (phase.md §7 Fase 6).
 *
 * Kenapa harus satu tempat: yang berubah pada satu keputusan manusia bukan satu
 * kolom, melainkan **tiga** — `talent_pool.status`, `nominasi.status`, dan satu
 * baris `approval_log`. Kalau aturannya ditebar sebagai `if` di komponen, cukup
 * satu jalur yang lupa memperbarui salah satunya untuk membuat kandidat berstatus
 * "Dinominasikan" tanpa nominasi, atau nominasi "Disetujui" yang kandidatnya masih
 * "Kandidat" — dan keadaan seperti itu tidak akan menghasilkan galat apa pun,
 * hanya halaman yang saling bertentangan.
 *
 * Bebas DB supaya bisa diuji murni.
 *
 * ## Dua mesin yang berpasangan
 *
 * `nominasi.status` menjawab **"giliran siapa sekarang"**; `talent_pool.status`
 * menjawab **"sejauh mana kandidat ini dalam alur suksesi"**. Keduanya dipisah
 * karena PRD §5 memang memisahkan tahap 7 (Verifikasi Kepegawaian, aktor Admin
 * Talenta) dari tahap 8 (Talent Pool Final, aktor Pimpinan).
 *
 * ## Kenapa `DIAJUKAN` berarti "dikembalikan untuk revisi"
 *
 * Enum `nominasi.status` tidak punya nilai `REVISI` (yang punya adalah
 * `approval_log.status`). Menambah nilai baru ke enum itu satu pilihan; yang
 * dipakai di sini adalah memberi `DIAJUKAN` makna yang membuatnya berguna:
 * **bola ada di tangan unit pengaju**. Dengan begitu "giliran siapa" bisa dibaca
 * dari `nominasi.status` sendiri, tanpa perlu men-join `approval_log` — dan
 * keadaan yang butuh join untuk diketahui adalah keadaan yang akan salah dibaca
 * di suatu tempat. Alternatifnya (DIAJUKAN = "baru masuk, belum diproses") akan
 * selalu bernilai sama dengan MENUNGGU_VERIFIKASI, karena tidak ada langkah
 * intake di antara keduanya.
 */

export type StatusPool = 'KANDIDAT' | 'DINOMINASIKAN' | 'DIVERIFIKASI' | 'DITETAPKAN' | 'DITOLAK'
export type StatusNominasi =
  | 'DIAJUKAN'
  | 'MENUNGGU_VERIFIKASI'
  | 'DISETUJUI'
  | 'DITOLAK'
  /**
   * Pengajuannya DIBATALKAN, bukan orangnya ditolak (`doc/sql/033`).
   *
   * Dipakai `BATALKAN_NOMINASI`. Sebelum nilai ini ada, aksi itu menutup barisnya
   * dengan `DITOLAK` — satu-satunya nilai yang tersedia — sehingga salah pencet
   * yang sudah dibatalkan tetap meninggalkan catatan bahwa orangnya PERNAH
   * DITOLAK, dan ia muncul di penyaring "Ditolak". Itu kebalikan dari yang diminta
   * butir 3 PDF: *"diatas datanya klir"*.
   */
  | 'DITARIK'
export type StatusApproval = 'MENUNGGU' | 'DISETUJUI' | 'DITOLAK' | 'REVISI'

/** Nama tahap pada `approval_log.tahap` — bukan enum di DB, jadi dikunci di sini. */
export const TAHAP_VERIFIKASI = 'Verifikasi Kepegawaian'
export const TAHAP_PIMPINAN = 'Persetujuan Pimpinan'

export const SEMUA_TAHAP = [TAHAP_VERIFIKASI, TAHAP_PIMPINAN] as const
export type Tahap = (typeof SEMUA_TAHAP)[number]

export type AksiWorkflow =
  | 'AJUKAN'
  | 'AJUKAN_ULANG'
  | 'VERIFIKASI_SETUJU'
  | 'VERIFIKASI_TOLAK'
  | 'MINTA_REVISI'
  | 'TETAPKAN'
  | 'TOLAK_PIMPINAN'
  | 'BATALKAN_PENETAPAN'
  | 'BATALKAN_VERIFIKASI'
  | 'BATALKAN_NOMINASI'
  | 'PULIHKAN_KANDIDAT'

/** Siapa yang harus bertindak berikutnya. */
export type Giliran = 'UNIT' | 'ADMIN_TALENTA' | 'PIMPINAN' | 'SELESAI'

export interface KeadaanWorkflow {
  statusPool: StatusPool
  /** null = kandidat belum pernah dinominasikan. */
  statusNominasi: StatusNominasi | null
}

export interface DefinisiAksi {
  aksi: AksiWorkflow
  label: string
  /** Kalimat yang menjelaskan akibatnya, ditampilkan di dialog konfirmasi. */
  akibat: string
  peranDiizinkan: readonly Peran[]
  /** Keadaan `talent_pool.status` yang boleh menerima aksi ini. */
  poolDari: readonly StatusPool[]
  /** Keadaan `nominasi.status` yang boleh menerima aksi ini; null = belum ada nominasi. */
  nominasiDari: readonly (StatusNominasi | null)[]
  poolKe: StatusPool
  /** null = tidak menyentuh `nominasi` (aksi khusus talent pool). */
  nominasiKe: StatusNominasi | null
  /** Baris `approval_log` yang ditulis; null = tidak ada. */
  jejak: { tahap: Tahap; status: StatusApproval } | null
  /** Aksi yang perlu alasan tertulis. */
  butuhCatatan: boolean
  destruktif: boolean
}

/**
 * Tabel transisi. Setiap baris menyebut **dari mana**, **ke mana**, dan **jejak
 * apa** yang ditinggalkan — sekaligus jadi dokumentasi alurnya.
 */
export const AKSI: Record<AksiWorkflow, DefinisiAksi> = {
  AJUKAN: {
    aksi: 'AJUKAN',
    label: 'Ajukan nominasi',
    akibat:
      'Kandidat masuk antrian Verifikasi Kepegawaian dan statusnya menjadi Dinominasikan. Unit pengaju tercatat pada nominasi.',
    peranDiizinkan: ['Pengelola Unit', 'Admin Talenta', 'Super Admin'],
    poolDari: ['KANDIDAT'],
    /*
      `DITOLAK` ikut diterima, dan itu MEMPERBAIKI JALAN BUNTU.

      `entri.statusNominasi` adalah status nominasi TERAKHIR (ORDER BY id DESC).
      Sebelum ini `AJUKAN` hanya menerima `null`, sehingga siapa pun yang pernah
      dinominasikan lalu turun lagi — lewat `PULIHKAN_KANDIDAT` atau
      `BATALKAN_NOMINASI` — punya baris nominasi lama yang statusnya bukan null,
      dan tombol Ajukan tidak pernah muncul lagi untuknya. Kandidatnya kembali ke
      pool tapi mentok di sana selamanya, tanpa satu pun pesan yang menjelaskan.

      Baris lamanya TIDAK dihapus: `AJUKAN` membuat baris nominasi BARU, jadi
      riwayat siapa mengajukan & siapa menolak tetap utuh dan yang terbaca sebagai
      "keadaan sekarang" adalah baris terbaru.
    */
    nominasiDari: [null, 'DITOLAK', 'DITARIK'],
    poolKe: 'DINOMINASIKAN',
    nominasiKe: 'MENUNGGU_VERIFIKASI',
    jejak: { tahap: TAHAP_VERIFIKASI, status: 'MENUNGGU' },
    butuhCatatan: true,
    destruktif: false,
  },
  AJUKAN_ULANG: {
    aksi: 'AJUKAN_ULANG',
    label: 'Ajukan ulang setelah revisi',
    akibat:
      'Nominasi kembali ke antrian Verifikasi Kepegawaian. Riwayat permintaan revisi sebelumnya tetap tersimpan.',
    peranDiizinkan: ['Pengelola Unit', 'Admin Talenta', 'Super Admin'],
    poolDari: ['DINOMINASIKAN'],
    nominasiDari: ['DIAJUKAN'],
    poolKe: 'DINOMINASIKAN',
    nominasiKe: 'MENUNGGU_VERIFIKASI',
    jejak: { tahap: TAHAP_VERIFIKASI, status: 'MENUNGGU' },
    butuhCatatan: true,
    destruktif: false,
  },
  VERIFIKASI_SETUJU: {
    aksi: 'VERIFIKASI_SETUJU',
    label: 'Setujui verifikasi',
    akibat:
      'Kandidat menjadi Diverifikasi dan diteruskan ke Persetujuan Pimpinan untuk ditetapkan sebagai suksesor.',
    peranDiizinkan: ['Admin Talenta', 'Super Admin'],
    poolDari: ['DINOMINASIKAN'],
    nominasiDari: ['MENUNGGU_VERIFIKASI'],
    poolKe: 'DIVERIFIKASI',
    nominasiKe: 'DISETUJUI',
    jejak: { tahap: TAHAP_VERIFIKASI, status: 'DISETUJUI' },
    butuhCatatan: false,
    destruktif: false,
  },
  MINTA_REVISI: {
    aksi: 'MINTA_REVISI',
    label: 'Minta revisi',
    akibat:
      'Nominasi dikembalikan ke unit pengaju. Kandidat tetap Dinominasikan, tapi giliran bertindak pindah ke unit.',
    peranDiizinkan: ['Admin Talenta', 'Super Admin'],
    poolDari: ['DINOMINASIKAN'],
    nominasiDari: ['MENUNGGU_VERIFIKASI'],
    poolKe: 'DINOMINASIKAN',
    nominasiKe: 'DIAJUKAN',
    jejak: { tahap: TAHAP_VERIFIKASI, status: 'REVISI' },
    butuhCatatan: true,
    destruktif: false,
  },
  VERIFIKASI_TOLAK: {
    aksi: 'VERIFIKASI_TOLAK',
    label: 'Tolak nominasi',
    akibat:
      'Nominasi ditolak dan kandidat berstatus Ditolak untuk jabatan target ini. Skor & rincian penilaiannya tetap tersimpan.',
    peranDiizinkan: ['Admin Talenta', 'Super Admin'],
    poolDari: ['DINOMINASIKAN'],
    nominasiDari: ['MENUNGGU_VERIFIKASI'],
    poolKe: 'DITOLAK',
    nominasiKe: 'DITOLAK',
    jejak: { tahap: TAHAP_VERIFIKASI, status: 'DITOLAK' },
    butuhCatatan: true,
    destruktif: true,
  },
  TETAPKAN: {
    aksi: 'TETAPKAN',
    label: 'Tetapkan sebagai suksesor',
    akibat:
      'Kandidat menjadi suksesor resmi (Ditetapkan) untuk jabatan target ini, dan bisa diberi rencana pengembangan.',
    peranDiizinkan: ['Pimpinan', 'Super Admin'],
    poolDari: ['DIVERIFIKASI'],
    nominasiDari: ['DISETUJUI'],
    poolKe: 'DITETAPKAN',
    nominasiKe: 'DISETUJUI',
    jejak: { tahap: TAHAP_PIMPINAN, status: 'DISETUJUI' },
    butuhCatatan: false,
    destruktif: false,
  },
  TOLAK_PIMPINAN: {
    aksi: 'TOLAK_PIMPINAN',
    label: 'Tolak di tahap pimpinan',
    akibat:
      'Kandidat yang sudah diverifikasi tetap tidak ditetapkan. Statusnya menjadi Ditolak dan alasannya tercatat di timeline.',
    peranDiizinkan: ['Pimpinan', 'Super Admin'],
    poolDari: ['DIVERIFIKASI'],
    nominasiDari: ['DISETUJUI'],
    poolKe: 'DITOLAK',
    nominasiKe: 'DITOLAK',
    jejak: { tahap: TAHAP_PIMPINAN, status: 'DITOLAK' },
    butuhCatatan: true,
    destruktif: true,
  },
  BATALKAN_PENETAPAN: {
    aksi: 'BATALKAN_PENETAPAN',
    label: 'Batalkan penetapan',
    akibat:
      'Kandidat kembali ke status Diverifikasi. Rencana pengembangan yang sudah dibuat TIDAK dihapus — ia jadi riwayat, dan halaman Rencana Pengembangan akan menandainya sebagai milik kandidat yang penetapannya dibatalkan.',
    peranDiizinkan: ['Pimpinan', 'Super Admin'],
    poolDari: ['DITETAPKAN'],
    nominasiDari: ['DISETUJUI'],
    poolKe: 'DIVERIFIKASI',
    nominasiKe: 'DISETUJUI',
    jejak: { tahap: TAHAP_PIMPINAN, status: 'REVISI' },
    butuhCatatan: true,
    destruktif: true,
  },
  /*
    ── DUA LANGKAH MUNDUR DI TENGAH ────────────────────────────────────────────
    Permintaan pemilik proses (`Detail Revisi PUPR 1_9_2026.pdf`, butir 3):
    *"Mundurin status / pindah data dari atas yang sudah dinominasi/gagal/ditolak
    ke bawah lagi, user ada kemungkinan salah pencet … perlu disediain dia turun
    kebawah ke nominasi lg dan diatas datanya klir."*

    Sebelum ini alur suksesi hanya punya dua langkah mundur, dan keduanya di UJUNG:
    `BATALKAN_PENETAPAN` (dari puncak) dan `PULIHKAN_KANDIDAT` (dari yang ditolak).
    Bagian TENGAHNYA tidak punya jalan turun sama sekali — begitu verifikasi
    disetujui, satu-satunya cara membatalkannya adalah menolak orangnya, yang
    mencatat penolakan yang tidak pernah benar-benar terjadi.
  */
  BATALKAN_VERIFIKASI: {
    aksi: 'BATALKAN_VERIFIKASI',
    label: 'Batalkan hasil verifikasi',
    akibat:
      'Kandidat kembali ke antrian Verifikasi Kepegawaian dan statusnya kembali Dinominasikan. Keputusan verifikasi sebelumnya tetap tercatat di riwayat sebagai jejak, bukan dihapus.',
    peranDiizinkan: ['Admin Talenta', 'Super Admin'],
    poolDari: ['DIVERIFIKASI'],
    nominasiDari: ['DISETUJUI'],
    poolKe: 'DINOMINASIKAN',
    nominasiKe: 'MENUNGGU_VERIFIKASI',
    jejak: { tahap: TAHAP_VERIFIKASI, status: 'REVISI' },
    butuhCatatan: true,
    destruktif: true,
  },
  BATALKAN_NOMINASI: {
    aksi: 'BATALKAN_NOMINASI',
    label: 'Tarik nominasi',
    akibat:
      'Nominasi ditarik dan kandidat kembali berstatus Kandidat di pool, sehingga bisa dinominasikan lagi dari awal. Baris nominasinya ditutup, bukan dihapus — pengajuan berikutnya membuat baris baru dan riwayatnya tetap utuh.',
    peranDiizinkan: ['Pengelola Unit', 'Admin Talenta', 'Super Admin'],
    poolDari: ['DINOMINASIKAN'],
    nominasiDari: ['MENUNGGU_VERIFIKASI', 'DIAJUKAN'],
    poolKe: 'KANDIDAT',
    // DITARIK, bukan DITOLAK — lihat catatan pada `StatusNominasi`.
    nominasiKe: 'DITARIK',
    jejak: { tahap: TAHAP_VERIFIKASI, status: 'REVISI' },
    butuhCatatan: true,
    destruktif: true,
  },
  PULIHKAN_KANDIDAT: {
    aksi: 'PULIHKAN_KANDIDAT',
    label: 'Pulihkan sebagai kandidat',
    akibat:
      'Kandidat kembali berstatus Kandidat sehingga bisa dinominasikan lagi. Riwayat nominasi & penolakan sebelumnya tetap tersimpan sebagai jejak.',
    peranDiizinkan: ['Admin Talenta', 'Super Admin'],
    poolDari: ['DITOLAK'],
    nominasiDari: [null, 'DITOLAK', 'DITARIK', 'DIAJUKAN', 'MENUNGGU_VERIFIKASI', 'DISETUJUI'],
    poolKe: 'KANDIDAT',
    nominasiKe: null,
    jejak: null,
    butuhCatatan: true,
    destruktif: false,
  },
}

/**
 * Gabungan seluruh peran yang bisa menjalankan aksi workflow apa pun.
 *
 * **Diturunkan** dari tabel transisi, bukan ditulis ulang — menambah aksi baru
 * dengan peran baru tidak boleh menuntut seseorang ingat memperbarui daftar
 * kedua. Dipakai sebagai gerbang kasar di `jalankanAksiWorkflow()`: peran yang
 * tidak ada di sini tidak akan pernah lolos aksi mana pun, jadi ia tidak perlu
 * sampai membaca entri pool-nya lebih dulu. Penegakan yang sebenarnya tetap
 * per-aksi lewat `terapkanAksi()`.
 */
export const PERAN_WORKFLOW: readonly Peran[] = [
  ...new Set(Object.values(AKSI).flatMap((d) => d.peranDiizinkan)),
]

/** Semua aksi yang sah untuk satu keadaan — tanpa memandang peran. */
export function aksiUntukKeadaan(keadaan: KeadaanWorkflow): DefinisiAksi[] {
  return Object.values(AKSI).filter(
    (d) =>
      d.poolDari.includes(keadaan.statusPool) && d.nominasiDari.includes(keadaan.statusNominasi),
  )
}

/** Aksi yang sah untuk satu keadaan DAN boleh dijalankan peran tertentu. */
export function aksiTersedia(keadaan: KeadaanWorkflow, peran: Peran | null): DefinisiAksi[] {
  if (peran === null) return []
  return aksiUntukKeadaan(keadaan).filter((d) => d.peranDiizinkan.includes(peran))
}

export interface HasilTransisi {
  ok: true
  definisi: DefinisiAksi
  statusPoolBaru: StatusPool
  /** null = kolom `nominasi.status` tidak disentuh. */
  statusNominasiBaru: StatusNominasi | null
  jejak: { tahap: Tahap; status: StatusApproval } | null
}

export interface GagalTransisi {
  ok: false
  /** Alasan yang bisa ditampilkan apa adanya ke pengguna. */
  alasan: string
}

/**
 * Terapkan satu aksi ke satu keadaan.
 *
 * Penolakannya menjelaskan **keadaan sekarang dan aksi yang sah saat ini**, bukan
 * "transisi tidak valid": penyebab paling umum adalah dua orang membuka halaman
 * yang sama lalu salah satu bertindak lebih dulu, dan pengguna kedua perlu tahu
 * apa yang sudah berubah — bukan cuma bahwa kliknya gagal.
 */
export function terapkanAksi(
  aksi: AksiWorkflow,
  keadaan: KeadaanWorkflow,
  peran: Peran | null,
): HasilTransisi | GagalTransisi {
  const definisi = AKSI[aksi]
  if (definisi === undefined) return { ok: false, alasan: 'Aksi tidak dikenali.' }

  if (peran === null || !definisi.peranDiizinkan.includes(peran)) {
    return {
      ok: false,
      alasan: `Aksi "${definisi.label}" hanya bisa dijalankan oleh ${definisi.peranDiizinkan.join(' atau ')}.`,
    }
  }

  const cocokPool = definisi.poolDari.includes(keadaan.statusPool)
  const cocokNominasi = definisi.nominasiDari.includes(keadaan.statusNominasi)

  if (!cocokPool || !cocokNominasi) {
    const sah = aksiUntukKeadaan(keadaan)
    const daftar =
      sah.length === 0
        ? 'Tidak ada aksi yang mungkin dari keadaan ini.'
        : `Yang mungkin sekarang: ${sah.map((d) => d.label).join(' · ')}.`
    return {
      ok: false,
      alasan: `Kandidat ini berstatus ${labelPool(keadaan.statusPool)}${
        keadaan.statusNominasi === null
          ? ' tanpa nominasi aktif'
          : ` dengan nominasi ${labelNominasi(keadaan.statusNominasi)}`
      }, jadi "${definisi.label}" tidak berlaku. ${daftar} Kemungkinan besar keadaannya sudah berubah oleh orang lain — muat ulang halaman.`,
    }
  }

  return {
    ok: true,
    definisi,
    statusPoolBaru: definisi.poolKe,
    statusNominasiBaru: definisi.nominasiKe,
    jejak: definisi.jejak,
  }
}

/**
 * Giliran siapa sekarang — dasar Inbox Tugas (U-7).
 *
 * Dibaca dari kedua status karena `DISETUJUI` bermakna dua hal berbeda tergantung
 * sudah ditetapkan atau belum: nominasi yang lolos verifikasi menunggu Pimpinan,
 * sedangkan yang sudah ditetapkan sudah tidak menunggu siapa pun.
 */
export function giliranSiapa(keadaan: KeadaanWorkflow): Giliran {
  if (keadaan.statusPool === 'DITOLAK') return 'SELESAI'
  if (keadaan.statusPool === 'DITETAPKAN') return 'SELESAI'
  switch (keadaan.statusNominasi) {
    case 'DIAJUKAN':
      return 'UNIT'
    case 'MENUNGGU_VERIFIKASI':
      return 'ADMIN_TALENTA'
    case 'DISETUJUI':
      return 'PIMPINAN'
    case 'DITOLAK':
      return 'SELESAI'
    /*
      DITARIK bukan keadaan akhir. Pengajuannya dibatalkan tapi orangnya kembali
      jadi kandidat dan BISA diajukan lagi — jadi yang menunggu tindakan adalah
      unit pengaju, sama dengan nominasi yang dikembalikan untuk revisi.

      Jatuh ke `SELESAI` lewat `default` membuat kolom Giliran berbunyi "Tidak
      menunggu siapa pun" untuk orang yang justru sedang menunggu diajukan ulang —
      dan itu menyembunyikan pekerjaan yang belum selesai, kebalikan dari yang
      diminta butir 3 PDF.
    */
    case 'DITARIK':
      return 'UNIT'
    default:
      return 'SELESAI'
  }
}

export const LABEL_GILIRAN: Record<Giliran, string> = {
  UNIT: 'Unit pengaju',
  ADMIN_TALENTA: 'Admin Talenta',
  PIMPINAN: 'Pimpinan',
  SELESAI: 'Tidak menunggu siapa pun',
}

/** Peran yang menangani satu giliran — dipakai menujukan notifikasi. */
export const PERAN_GILIRAN: Record<Giliran, readonly Peran[]> = {
  UNIT: ['Pengelola Unit'],
  ADMIN_TALENTA: ['Admin Talenta'],
  PIMPINAN: ['Pimpinan'],
  SELESAI: [],
}

export const LABEL_POOL: Record<StatusPool, string> = {
  KANDIDAT: 'Kandidat',
  DINOMINASIKAN: 'Dinominasikan',
  DIVERIFIKASI: 'Diverifikasi',
  DITETAPKAN: 'Ditetapkan',
  DITOLAK: 'Ditolak',
}

export const LABEL_NOMINASI: Record<StatusNominasi, string> = {
  DIAJUKAN: 'Dikembalikan untuk revisi',
  MENUNGGU_VERIFIKASI: 'Menunggu verifikasi',
  DISETUJUI: 'Lolos verifikasi',
  DITOLAK: 'Ditolak',
  DITARIK: 'Ditarik kembali',
}

/**
 * **Tahap nominasi** — satu keadaan yang menjawab "di mana berkas ini sekarang",
 * dipakai BERSAMA oleh kolom Status di tabel dan penyaring halaman Nominasi.
 *
 * **Kenapa ini perlu ada, bukan memakai `LABEL_NOMINASI` saja.** `nominasi.status`
 * tidak cukup menentukan apa yang dilihat pengguna: `DISETUJUI` berarti "sudah
 * lolos verifikasi Admin Talenta" — tapi selama suksesornya belum ditetapkan, yang
 * sebenarnya terjadi adalah **menunggu approval Pimpinan**, dan setelah ditetapkan
 * status barisnya tetap `DISETUJUI`. Satu status, dua keadaan yang sangat berbeda.
 * Label lamanya menulis "Lolos verifikasi" untuk keduanya, sehingga baris yang
 * masih menunggu tampak sudah beres (dilaporkan user, 12 Agu 2026).
 *
 * Karena itu tahap diturunkan dari **status nominasi + status pool**, sumber yang
 * sama dengan `giliranSiapa()`, dan tidak ditulis ulang di komponen. Kelimanya
 * **saling meniadakan dan menutup semua kemungkinan** — tidak ada baris yang bisa
 * jatuh ke dua tahap atau ke tidak satu pun.
 */
export type TahapNominasi =
  | 'REVISI'
  | 'VERIFIKASI'
  | 'APPROVAL'
  | 'DITETAPKAN'
  | 'DITARIK'
  | 'DITOLAK'

/** Urutan alur, dipakai apa adanya sebagai urutan opsi penyaring. */
export const TAHAP_NOMINASI: TahapNominasi[] = [
  'REVISI',
  'VERIFIKASI',
  'APPROVAL',
  'DITETAPKAN',
  'DITARIK',
  'DITOLAK',
]

export const LABEL_TAHAP: Record<TahapNominasi, string> = {
  REVISI: 'Dikembalikan untuk revisi',
  VERIFIKASI: 'Menunggu verifikasi kepegawaian',
  APPROVAL: 'Menunggu approval Pimpinan',
  DITETAPKAN: 'Ditetapkan sebagai suksesor',
  DITARIK: 'Ditarik kembali',
  DITOLAK: 'Ditolak',
}

/** Siapa yang harus bertindak pada tahap ini — untuk keterangan penyaring. */
export const PELAKU_TAHAP: Record<TahapNominasi, string> = {
  REVISI: 'unit pengaju',
  VERIFIKASI: 'Admin Talenta',
  APPROVAL: 'Pimpinan',
  DITETAPKAN: 'selesai — tidak menunggu siapa pun',
  // Bukan keadaan akhir: orangnya kembali jadi kandidat dan bisa diajukan lagi,
  // jadi yang harus bertindak adalah unit pengaju — sama dengan REVISI.
  DITARIK: 'unit pengaju',
  DITOLAK: 'selesai — tidak menunggu siapa pun',
}

export function tahapNominasi(keadaan: {
  statusNominasi: StatusNominasi
  statusPool: StatusPool
}): TahapNominasi {
  // Keadaan AKHIR diperiksa lebih dulu: begitu suksesornya ditetapkan atau
  // pengajuannya ditolak, tahapnya tidak lagi ditentukan status nominasinya.
  if (keadaan.statusNominasi === 'DITOLAK' || keadaan.statusPool === 'DITOLAK') return 'DITOLAK'
  if (keadaan.statusPool === 'DITETAPKAN') return 'DITETAPKAN'
  /*
    Nominasi yang DITARIK bukan keadaan akhir: orangnya kembali jadi kandidat biasa
    dan bisa diajukan lagi. Tahapnya karena itu ditentukan status POOL-nya, bukan
    baris nominasi yang sudah ditutup — memasukkannya ke 'DITOLAK' akan membuat
    salah pencet yang sudah dibatalkan tetap tampil di penyaring Ditolak, yaitu
    persis yang butir 3 PDF minta dibersihkan.
  */
  if (keadaan.statusNominasi === 'DITARIK') return 'DITARIK'
  switch (keadaan.statusNominasi) {
    case 'DIAJUKAN':
      return 'REVISI'
    case 'MENUNGGU_VERIFIKASI':
      return 'VERIFIKASI'
    case 'DISETUJUI':
      return 'APPROVAL'
  }
}

export const labelPool = (s: StatusPool): string => LABEL_POOL[s]
export const labelNominasi = (s: StatusNominasi): string => LABEL_NOMINASI[s]

/** Nada badge per status — dipakai bersama oleh beberapa halaman. */
export const NADA_POOL: Record<StatusPool, 'netral' | 'aksen' | 'sukses' | 'peringatan' | 'bahaya'> =
  {
    KANDIDAT: 'netral',
    DINOMINASIKAN: 'aksen',
    DIVERIFIKASI: 'peringatan',
    DITETAPKAN: 'sukses',
    DITOLAK: 'bahaya',
  }

/**
 * Urutan tahap yang sudah/belum dilalui satu nominasi — untuk timeline approval.
 *
 * Tahap yang belum punya baris `approval_log` tetap ditampilkan sebagai
 * "belum dijalani", supaya pembaca tahu masih ada langkah di depan, bukan
 * menyimpulkan alurnya sudah selesai.
 */
export interface LangkahTimeline {
  tahap: Tahap
  status: StatusApproval | 'BELUM'
  keterangan: string
}

export function timelineTahap(
  jejak: Array<{ tahap: string; status: StatusApproval }>,
): LangkahTimeline[] {
  return SEMUA_TAHAP.map((tahap) => {
    // Baris terakhir per tahap yang menang: satu tahap bisa dilalui dua kali
    // (mis. diminta revisi lalu diajukan ulang).
    const terakhir = [...jejak].reverse().find((j) => j.tahap === tahap)
    if (terakhir === undefined) {
      return { tahap, status: 'BELUM' as const, keterangan: 'Belum dijalani' }
    }
    return {
      tahap,
      status: terakhir.status,
      keterangan: {
        MENUNGGU: 'Menunggu keputusan',
        DISETUJUI: 'Disetujui',
        DITOLAK: 'Ditolak',
        REVISI: 'Diminta revisi',
      }[terakhir.status],
    }
  })
}

/**
 * Apakah keadaan pool & nominasi ini saling konsisten?
 *
 * Dipakai `scripts/verifikasi-data.ts` dan halaman Talent Pool. Keadaan tidak
 * konsisten tidak menimbulkan galat apa pun — ia hanya membuat dua halaman
 * bercerita berbeda tentang orang yang sama, jadi harus ada yang memeriksanya.
 */
export function periksaKonsistensi(keadaan: KeadaanWorkflow): string | null {
  const { statusPool, statusNominasi } = keadaan

  if (statusNominasi === null) {
    return statusPool === 'DINOMINASIKAN' || statusPool === 'DIVERIFIKASI' || statusPool === 'DITETAPKAN'
      ? `Status pool ${labelPool(statusPool)} tapi tidak ada nominasi yang menautkannya.`
      : null
  }

  const diharapkan: Record<StatusNominasi, StatusPool[]> = {
    DIAJUKAN: ['DINOMINASIKAN'],
    MENUNGGU_VERIFIKASI: ['DINOMINASIKAN'],
    DISETUJUI: ['DIVERIFIKASI', 'DITETAPKAN'],
    DITOLAK: ['DITOLAK', 'KANDIDAT'],
    // Ditarik → orangnya kembali jadi kandidat. 'DITOLAK' ikut sah karena ia bisa
    // dikeluarkan dari pool sesudahnya tanpa mengajukan ulang.
    DITARIK: ['KANDIDAT', 'DITOLAK'],
  }

  const sah = diharapkan[statusNominasi]
  if (!sah.includes(statusPool)) {
    return `Nominasi ${labelNominasi(statusNominasi)} seharusnya berpasangan dengan status pool ${sah
      .map(labelPool)
      .join(' atau ')}, bukan ${labelPool(statusPool)}.`
  }
  return null
}
