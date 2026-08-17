import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // typedRoutes menyusul begitu halaman-halaman Fase 2+ sudah ada; kalau
  // dinyalakan sekarang, seluruh href yang belum punya route gagal typecheck.
  serverExternalPackages: ['mysql2'],

  /**
   * Folder keluaran build, bisa ditimpa lewat `NEXT_DIST_DIR`.
   *
   * **Ini yang membuat build pratinjau tidak merusak dev server.** `next build`
   * dan `next dev` sama-sama menulis ke `.next`, dan menjalankan keduanya di
   * direktori yang sama membuat route bersarang mendadak 404 — sudah terjadi di
   * project ini dan tercatat di CLAUDE.md. Sebelumnya obatnya "jangan build
   * sambil dev hidup", yaitu aturan yang harus diingat manusia; dengan ini
   * keduanya bisa hidup bersamaan karena artefaknya tidak pernah bertemu.
   *
   * Dipakai berpasangan — `build` dan `start` HARUS memakai nilai yang sama,
   * kalau tidak `next start` mencari manifest di folder yang salah dan gagal
   * dengan pesan yang menyesatkan ("could not find a production build"). Karena
   * itu keduanya dibungkus skrip npm, bukan diserahkan ke hafalan.
   */
  distDir: process.env.NEXT_DIST_DIR || '.next',

  /**
   * Alamat yang boleh memuat aset dev server selain `localhost`.
   *
   * **Tanpa ini, membuka aplikasi lewat alamat apa pun selain `localhost`
   * menghasilkan aplikasi yang tampak sempurna tapi mati total.** Next 16
   * menolak permintaan `/_next/*` lintas-origin dengan **403**, sementara render
   * servernya jalan normal — jadi HTML-nya lengkap dan tidak ada pesan galat di
   * layar, tapi tidak satu pun chunk React termuat. Akibatnya SETIAP kontrol
   * interaktif mati sekaligus: pengalih tema, command palette, menu pengguna,
   * ciutkan sidebar.
   *
   * Gejala yang paling menyesatkan: temanya **terkunci di gelap**. Class tema
   * dipasang inline script next-themes yang ikut terkirim di dalam HTML, jadi ia
   * sempat terpasang dari preferensi sistem — lalu tidak ada React yang bisa
   * mengubahnya lagi. Terbaca sebagai bug tema/CSS, padahal tidak menyentuh
   * stylesheet sama sekali.
   *
   * Mesin ini punya banyak alamat sekaligus (LAN, Tailscale, nama host), dan
   * pengembangan lewat VS Code Remote SSH biasanya TIDAK memakai `localhost`.
   * Karena itu daftarnya berupa pola, bukan satu IP: IP LAN berubah mengikuti
   * DHCP, dan mengunci satu nilai berarti bug ini kembali sendiri suatu hari.
   *
   * Hanya berpengaruh di `next dev` — produksi tidak memakai daftar ini.
   */
  allowedDevOrigins: [
    'localhost',
    '127.0.0.1',
    'pupr-argo-dev',
    '192.168.*.*', // LAN
    '100.*.*.*', // Tailscale
    '172.17.*.*', // bridge docker
    '*.devtunnels.ms', // port forwarding VS Code
    '*.github.dev', // Codespaces
  ],

  /**
   * Rute yang pindah tempat.
   *
   * Ditaruh di sini, **bukan** sebagai halaman yang memanggil
   * `permanentRedirect()`. Versi halaman sudah dicoba dan **tersangkut di batas
   * `<Suspense>`**: penggunanya melihat skeleton yang tidak pernah selesai, yang
   * lebih buruk daripada 404 karena tidak menyatakan apa pun dan tidak bisa
   * dilaporkan sebagai galat. `redirects()` diselesaikan **sebelum** render
   * dimulai, jadi tidak ada yang bisa tersangkut, dan berlaku untuk semua metode
   * HTTP sekaligus.
   *
   * `permanent: true` (308) karena kepindahannya memang tetap. Query string ikut
   * terbawa sendiri; fragment (`#jabatan-kosong`) **tidak** bisa dikirim server —
   * ia milik peramban — jadi tidak dijanjikan di sini.
   */
  async redirects() {
    return [
      {
        // Jabatan Kosong & Risiko Kekosongan melebur ke Jabatan Target di Fase 11
        // (U-14). Alamat lamanya hidup sejak Fase 4 dan sudah mengendap di riwayat
        // peramban, tab yang dibiarkan terbuka, serta tautan antar staf.
        source: '/master/jabatan-kosong',
        destination: '/jabatan-target',
        permanent: true,
      },
    ]
  },
}

export default nextConfig
