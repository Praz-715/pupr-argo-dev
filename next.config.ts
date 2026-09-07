import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // typedRoutes menyusul begitu halaman-halaman Fase 2+ sudah ada; kalau
  // dinyalakan sekarang, seluruh href yang belum punya route gagal typecheck.
  serverExternalPackages: ['mysql2'],

  /**
   * Batas ukuran body untuk **server action** — dinaikkan dari 1 MB bawaan.
   *
   * ## Kenapa perlu, dan kenapa angkanya sebesar ini
   *
   * Impor pegawai dari `.xlsx` (`imporPegawaiDariXlsx`) menerima berkas Talent
   * Pool. Terukur: `TALENT POOL PENGAWAS#2 fix.xlsx` berukuran **17,13 MB** —
   * bukan karena barisnya banyak (653 baris, 28 kolom) melainkan karena ia
   * membawa **53 foto pegawai tertanam**. Dengan batas bawaan 1 MB, framework
   * menolak permintaannya SEBELUM kode aksi berjalan, sehingga pemeriksaan ukuran
   * dan pesan galat yang informatif di dalam aksi tidak pernah terpakai; yang
   * terlihat pengguna hanyalah tombol yang menggantung. Gejalanya hanya terbaca
   * dari log server (`Body exceeded 1 MB limit`, HTTP 413).
   *
   * ## Harganya, dinyatakan terus terang
   *
   * Body sebesar ini **dibuffer di memori server**, dan pembacaan ZIP-nya
   * (`zlib.inflateRawSync`) **sinkron** — jadi satu unggahan besar menahan event
   * loop selama ia diurai. Itu bisa diterima di sini karena jalur ini: (a) hanya
   * untuk tiga peran (`PERAN_PROFIL`), bukan permukaan publik; (b) dipakai
   * sesekali, bukan per permintaan halaman; dan (c) menolak berkas >20 MB di
   * dalam aksinya sendiri. Kalau nanti ia jadi jalur yang sering dipakai
   * bersamaan, yang benar bukan menaikkan angka ini lagi melainkan memindahkan
   * penguraiannya ke luar siklus permintaan.
   *
   * 25 MB, bukan 20: batas di aksinya 20 MB, dan framework harus mengizinkan
   * SEDIKIT LEBIH agar berkas 20 MB benar-benar sampai ke pemeriksaan itu —
   * pembungkus multipart menambah ukuran. Kalau angka framework disamakan 20 MB,
   * berkas tepat di batas ditolak 413 tanpa pesan yang bisa dibaca pengguna.
   */
  /*
    DUA batas ukuran body, dan yang kedua tidak terlihat sampai yang pertama
    dinaikkan.

    Setelah `serverActions.bodySizeLimit` naik, Next mencatat: *"Request body
    exceeded 10MB for /talenta. **Only the first 10MB will be available** unless
    configured"* — middleware berjalan untuk `/talenta` (server action mem-POST ke
    route halamannya). Untuk berkas 17,13 MB itu berarti body yang **terpotong**,
    dan ZIP yang terpotong bukan "sebagian data" melainkan berkas rusak: `bacaZip`
    tidak menemukan central directory lalu melapor "bukan berkas .xlsx yang sah"
    atas berkas yang sebenarnya sah. Salah satu gejala paling menyesatkan yang bisa
    dihasilkan sebuah batas.
  */
  experimental: {
    serverActions: { bodySizeLimit: '25mb' },
    /**
     * Batas body yang boleh DILIHAT middleware — dinaikkan dari 10 MB bawaan.
     *
     * `proxyClientMaxBodySize`, bukan `middlewareClientMaxBodySize`: yang kedua
     * masih ada tapi sudah **deprecated** di Next 16 (bersama penggantian nama
     * "middleware" → "proxy" yang juga muncul sebagai peringatan saat build), dan
     * ia tidak dikenali di tingkat atas `NextConfig` — memakainya di sana gagal
     * typecheck DAN membuat Next mencetak "Unrecognized key(s)".
     */
    proxyClientMaxBodySize: '25mb',
  },


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
