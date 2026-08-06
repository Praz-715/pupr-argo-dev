import type { Peran } from './peran'

/**
 * SATU sumber struktur navigasi — dipakai bersama oleh sidebar, breadcrumb, dan
 * command palette. Menambah halaman = menambah satu entri di sini, bukan
 * menyunting tiga tempat (CLAUDE.md prinsip #1).
 *
 * Daftarnya mengikuti inventaris halaman doc/PRD.md §6 + usulan phase.md §8.
 * `fase` menandai kapan halaman dibangun; yang `fase > 1` tampil sebagai item
 * nonaktif berlabel fase, supaya struktur aplikasi kelihatan utuh sejak awal
 * tanpa berpura-pura sudah jadi.
 */

export interface ItemNav {
  label: string
  href: string
  /** Nama ikon lucide-react (dipetakan di komponen sidebar). */
  ikon: string
  fase: number
  /** Kosong = semua peran. */
  peran?: readonly Peran[]
  /** Kata kunci tambahan untuk command palette. */
  kataKunci?: string[]
  /**
   * Tidak ditampilkan di sidebar, tapi tetap ada di breadcrumb & command
   * palette. Untuk halaman yang jalan masuknya dari tempat lain (Profil Saya
   * dibuka dari menu pengguna) — didaftarkan di sini supaya breadcrumb-nya
   * tidak kosong dan `Ctrl+K` tetap menemukannya.
   */
  luarSidebar?: boolean
}

export interface GrupNav {
  label: string | null
  item: ItemNav[]
}

export const NAVIGASI: GrupNav[] = [
  {
    label: null,
    item: [
      {
        label: 'Dashboard',
        href: '/',
        ikon: 'LayoutDashboard',
        fase: 1,
        kataKunci: ['beranda', 'ringkasan', 'kotak 9'],
      },
      {
        label: 'Inbox Tugas',
        href: '/inbox',
        ikon: 'Inbox',
        fase: 6,
        kataKunci: ['notifikasi', 'tugas', 'menunggu', 'antrian saya'],
      },
    ],
  },
  {
    label: 'Talenta',
    item: [
      {
        label: 'Direktori Pegawai',
        href: '/talenta',
        ikon: 'Users',
        fase: 2,
        kataKunci: ['pegawai', 'asn', 'nip', 'profil'],
      },
      {
        label: 'Peta Talenta',
        href: '/peta-talenta',
        ikon: 'Grid3x3',
        fase: 3,
        kataKunci: ['kotak 9', 'sebaran', '9 box', 'scatter'],
      },
      {
        label: 'Perbandingan Kandidat',
        href: '/bandingkan',
        ikon: 'GitCompareArrows',
        fase: 3,
        peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
        kataKunci: ['banding', 'compare'],
      },
    ],
  },
  {
    label: 'Suksesi',
    item: [
      {
        label: 'Jabatan Target',
        href: '/jabatan-target',
        ikon: 'Target',
        fase: 5,
        peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
        kataKunci: ['rubrik', 'rule engine', 'bobot', 'match score'],
      },
      {
        label: 'Talent Pool',
        href: '/talent-pool',
        ikon: 'ListOrdered',
        fase: 6,
        kataKunci: ['kandidat', 'ranking', 'suksesor'],
      },
      {
        label: 'Nominasi',
        href: '/nominasi',
        ikon: 'FileCheck2',
        fase: 6,
        kataKunci: ['pengajuan', 'verifikasi', 'approval', 'persetujuan'],
      },
      {
        label: 'Rencana Pengembangan',
        href: '/rencana-pengembangan',
        ikon: 'Sprout',
        fase: 6,
        peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
        kataKunci: ['diklat', 'rotasi', 'mentoring', 'suksesi'],
      },
    ],
  },
  {
    label: 'Data & Kualitas',
    item: [
      {
        label: 'Konsolidasi Data',
        href: '/data/konsolidasi',
        ikon: 'RefreshCw',
        fase: 4,
        peran: ['Super Admin'],
        kataKunci: ['sync', 'sinkronisasi', 'ehrm', 'enominasi', 'ekinerja', 'impor'],
      },
      {
        label: 'Antrian Pembersihan',
        href: '/data/pembersihan',
        ikon: 'ListChecks',
        fase: 4,
        peran: ['Super Admin', 'Admin Talenta'],
        kataKunci: ['anomali', 'validasi', 'normalisasi', 'cleansing'],
      },
      {
        label: 'Validasi Riwayat',
        href: '/data/validasi-riwayat',
        ikon: 'BadgeCheck',
        fase: 10,
        // Termasuk Pengelola Unit — PRD §3: "Input/validasi riwayat data pegawai
        // unitnya". Ini satu-satunya halaman Data & Kualitas yang dibukanya.
        peran: ['Super Admin', 'Admin Talenta', 'Pengelola Unit'],
        kataKunci: ['diklat', 'kategori', 'plt', 'plh', 'penugasan', 'pemetaan', 'kamus'],
      },
      {
        label: 'Kelengkapan Data',
        href: '/data/kelengkapan',
        ikon: 'Gauge',
        fase: 4,
        peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
        kataKunci: ['skor', 'akurasi', 'kesehatan data'],
      },
    ],
  },
  {
    label: 'Master Data',
    item: [
      {
        label: 'Unit Organisasi',
        href: '/master/unit',
        ikon: 'Building2',
        fase: 4,
        peran: ['Super Admin'],
        kataKunci: ['balai', 'direktorat', 'bp2jk', 'hierarki'],
      },
      {
        label: 'Jabatan',
        href: '/master/jabatan',
        ikon: 'Briefcase',
        fase: 4,
        peran: ['Super Admin', 'Admin Talenta'],
        kataKunci: ['posisi', 'eselon', 'jenjang'],
      },
      {
        label: 'Jabatan Kosong & Risiko',
        href: '/master/jabatan-kosong',
        ikon: 'TriangleAlert',
        fase: 4,
        peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
        kataKunci: ['lowong', 'bup', 'pensiun', 'kekosongan'],
      },
      {
        label: 'Kategori Riwayat Diklat',
        href: '/master/kategori-diklat',
        ikon: 'GraduationCap',
        fase: 10,
        peran: ['Super Admin', 'Admin Talenta'],
        kataKunci: ['diklat', 'pelatihan', 'pim', 'manajerial', 'teknis', 'kamus', 'kategori'],
      },
      {
        label: 'Hukuman Disiplin',
        href: '/master/hukuman-disiplin',
        ikon: 'ShieldAlert',
        fase: 4,
        peran: ['Super Admin', 'Admin Talenta'],
        kataKunci: ['integritas', 'sanksi', 'rekam jejak'],
      },
    ],
  },
  {
    label: 'Laporan',
    item: [
      {
        label: 'Gap Analysis',
        href: '/laporan/gap-analysis',
        ikon: 'ChartNoAxesCombined',
        fase: 8,
        peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
        kataKunci: ['kesenjangan', 'kompetensi'],
      },
      {
        label: 'Nominasi & Approval',
        href: '/laporan/nominasi',
        ikon: 'FileText',
        fase: 8,
        peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
      },
      {
        label: 'Pusat Ekspor',
        href: '/laporan/ekspor',
        ikon: 'Download',
        fase: 8,
        peran: ['Super Admin', 'Admin Talenta', 'Pimpinan'],
        kataKunci: ['pdf', 'excel', 'unduh'],
      },
    ],
  },
  {
    label: 'Administrasi',
    item: [
      {
        label: 'Pengguna & Peran',
        href: '/admin/pengguna',
        ikon: 'UserCog',
        fase: 7,
        peran: ['Super Admin'],
        kataKunci: ['user', 'role', 'akses'],
      },
      {
        label: 'Klien & Token API',
        href: '/admin/api',
        ikon: 'KeyRound',
        fase: 9,
        peran: ['Super Admin'],
        kataKunci: ['bearer', 'instansi', 'bkn', 'mou', 'scope', 'api'],
      },
      {
        label: 'Log Aktivitas API',
        href: '/admin/api/log',
        ikon: 'Activity',
        fase: 9,
        peran: ['Super Admin'],
        luarSidebar: true,
        kataKunci: ['api', 'rate limit', 'anomali', '401', '403', '429'],
      },
      {
        label: 'Dokumentasi API',
        href: '/admin/api/dokumentasi',
        ikon: 'BookOpen',
        fase: 9,
        peran: ['Super Admin', 'Admin Talenta'],
        luarSidebar: true,
        kataKunci: ['api', 'endpoint', 'bearer', 'scope', 'openapi'],
      },
      {
        label: 'Audit Log',
        href: '/admin/audit-log',
        ikon: 'ScrollText',
        fase: 7,
        peran: ['Super Admin'],
        kataKunci: ['jejak', 'perubahan', 'histori'],
      },
      {
        label: 'Pengaturan Sistem',
        href: '/admin/pengaturan',
        ikon: 'Settings',
        fase: 7,
        peran: ['Super Admin'],
        kataKunci: ['parameter', 'masa berlaku asesmen', 'tahun aktif'],
      },
    ],
  },
  {
    label: 'Akun',
    item: [
      {
        label: 'Profil Saya',
        href: '/profil',
        ikon: 'UserRound',
        fase: 7,
        luarSidebar: true,
        kataKunci: ['akun', 'sandi', 'ganti password', 'sesi', 'perangkat', 'keluar'],
      },
    ],
  },
]

/** Fase yang halamannya sudah dibangun. Naikkan seiring fase selesai. */
export const FASE_TERSEDIA = 10

export function itemTersedia(item: ItemNav): boolean {
  return item.fase <= FASE_TERSEDIA
}

export function bolehLihat(item: ItemNav, peran: Peran | null): boolean {
  if (!item.peran) return true
  if (!peran) return false
  return item.peran.includes(peran)
}

/**
 * Navigasi yang sudah disaring menurut peran pengguna.
 *
 * Menyertakan item `luarSidebar` — komponen yang merender sidebar-lah yang
 * membuangnya (lihat `components/layout/sidebar.tsx`). Kalau disaring di sini,
 * command palette & breadcrumb ikut kehilangan halamannya.
 */
export function navigasiUntuk(peran: Peran | null): GrupNav[] {
  return NAVIGASI.map((grup) => ({
    ...grup,
    item: grup.item.filter((item) => bolehLihat(item, peran)),
  })).filter((grup) => grup.item.length > 0)
}

/** Navigasi untuk sidebar: tanpa item yang jalan masuknya dari tempat lain. */
export function navigasiSidebar(navigasi: GrupNav[]): GrupNav[] {
  return navigasi
    .map((grup) => ({ ...grup, item: grup.item.filter((i) => !i.luarSidebar) }))
    .filter((grup) => grup.item.length > 0)
}

export function semuaItem(): ItemNav[] {
  return NAVIGASI.flatMap((grup) => grup.item)
}

/**
 * Cari item nav untuk satu pathname — dipakai breadcrumb & judul halaman.
 *
 * Yang **paling spesifik menang**, bukan yang pertama ditemukan. Versi lama
 * mengembalikan kecocokan pertama, sehingga `/admin/api/log` mengaku sebagai
 * "Klien & Token API" — sebab `/admin/api` terdaftar lebih dulu dan awalannya
 * cocok. Breadcrumb yang menyebut halaman lain bukan cuma salah label: jejak
 * kembali ke halaman induknya ikut hilang, dan pengguna kehilangan cara pulang.
 *
 * Kekeliruan yang sama sudah pernah terjadi di `/talenta/{nip}` (Fase 2). Waktu
 * itu diperbaiki dengan menambahkan entri khusus; sekarang perbaikannya di
 * pencariannya sendiri, jadi setiap route bersarang berikutnya ikut benar tanpa
 * ada yang perlu ingat.
 */
export function itemDariPath(pathname: string): { grup: GrupNav; item: ItemNav } | null {
  let terbaik: { grup: GrupNav; item: ItemNav } | null = null

  for (const grup of NAVIGASI) {
    for (const item of grup.item) {
      const cocok = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
      if (!cocok) continue
      if (terbaik === null || item.href.length > terbaik.item.href.length) {
        terbaik = { grup, item }
      }
    }
  }
  return terbaik
}
