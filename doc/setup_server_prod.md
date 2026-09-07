# Setup Server Produksi — SIMT DJBK

**Target:** Ubuntu Server 24.04 LTS (Noble Numbat) · MySQL native (tanpa Docker) · satu server

| | |
|---|---|
| **Versi dokumen** | 1.0 · 23 Agustus 2026 |
| **Aplikasi** | SIMT DJBK — Next.js 16.2.12 + React 19 + MySQL 8 |
| **Lingkup** | Penyiapan server dari kosong sampai aplikasi jalan di belakang HTTPS |
| **Di luar lingkup** | **Skema & isi database produksi** — ditangani sendiri oleh tim. Dokumen ini hanya menyebut *apa yang aplikasi harapkan* dari database (Lampiran B) |

> **Angka-angka di dokumen ini diukur, bukan dikira.** Versi paket diverifikasi terhadap repositori APT Ubuntu 24.04 yang sama, dan waktu serta memori build diukur dengan menjalankan `next build` pada repositori ini.

---

## Daftar Isi

- [0. Ringkasan urutan kerja](#0-ringkasan-urutan-kerja)
- [1. Spesifikasi server](#1-spesifikasi-server)
- [2. Langkah 1 — Dasar sistem operasi](#2-langkah-1--dasar-sistem-operasi)
- [3. Langkah 2 — Node.js 22 LTS](#3-langkah-2--nodejs-22-lts)
- [4. Langkah 3 — MySQL 8.0](#4-langkah-3--mysql-80)
- [5. Langkah 4 — Kode aplikasi & dependensi](#5-langkah-4--kode-aplikasi--dependensi)
- [6. Langkah 5 — Berkas environment](#6-langkah-5--berkas-environment)
- [7. Langkah 6 — Build](#7-langkah-6--build)
- [8. Langkah 7 — Layanan systemd](#8-langkah-7--layanan-systemd)
- [9. Langkah 8 — Nginx & HTTPS](#9-langkah-8--nginx--https)
- [10. Langkah 9 — Verifikasi](#10-langkah-9--verifikasi)
- [11. Langkah 10 — Pengerasan sebelum go-live](#11-langkah-10--pengerasan-sebelum-go-live)
- [12. Operasional](#12-operasional)
- [13. Troubleshooting server baru](#13-troubleshooting-server-baru)
- [Lampiran A — Daftar environment lengkap](#lampiran-a--daftar-environment-lengkap)
- [Lampiran B — Yang aplikasi harapkan dari database](#lampiran-b--yang-aplikasi-harapkan-dari-database)

---

## 0. Ringkasan urutan kerja

Urutannya **tidak boleh ditukar**. Alasan paling penting: `next build` **gagal kalau database belum terjangkau dan belum berisi skema** — sudah dibuktikan, lihat [Langkah 6](#7-langkah-6--build).

```
1. Dasar OS         → update · timezone · swap · user aplikasi · firewall
2. Node.js 22 LTS   → JANGAN pakai paket bawaan Ubuntu (Node 18, terlalu tua)
3. MySQL 8.0        → install · harden · konfigurasi · buat database & user
   ├─ (tim DB)      → pasang skema & master data          ← di luar dokumen ini
4. Kode aplikasi    → clone · npm ci
5. Environment      → .env.production
6. Build            → npm run build   (DB harus sudah hidup + berskema)
7. systemd          → simt.service
8. Nginx + HTTPS    → reverse proxy · sertifikat
9. Verifikasi       → 8 pemeriksaan yang bisa dijalankan
10. Pengerasan      → 4 butir yang tidak akan ditemukan uji mana pun
```

---

## 1. Spesifikasi server

| Sumber daya | Minimum | Disarankan | Dasarnya |
|---|---|---|---|
| **CPU** | 2 vCPU | 4 vCPU | `next build` memakai 3 worker paralel |
| **RAM** | **4 GB** | **8 GB** | Build terukur: puncak RSS proses induk **±1 GB** dengan 3 worker paralel, ditambah MySQL. Di bawah 4 GB, kegagalan build akan **menyerupai bug kode** — worker dibunuh OS dan pesannya menyesatkan |
| **Disk** | 20 GB | 40 GB | `node_modules` **843 MB** · kode + dokumen **111 MB** · keluaran build · basis data · cadangan |
| **Swap** | 2 GB | 4 GB | Jaring pengaman saat build. Lihat [2.3](#23-swap) |
| **Jaringan** | port 80 & 443 dari jaringan pengguna · port 22 dari jaringan admin | | MySQL **tidak** dibuka ke jaringan |

Aplikasi dan database di **satu server** adalah rancangan yang diasumsikan dokumen ini. Kalau database dipisah, yang berubah hanya `DATABASE_HOST`, `bind-address`, dan grant `'simt_app'@'<ip-app>'` — plus TLS antar keduanya.

---

## 2. Langkah 1 — Dasar sistem operasi

### 2.1 Pembaruan & paket dasar

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ca-certificates gnupg ufw build-essential python3
```

`build-essential` dan `python3` bukan hiasan — keduanya jadi jaring-jaring kalau ada dependensi yang harus dikompilasi dari sumber di server ini.

### 2.2 Zona waktu

```bash
sudo timedatectl set-timezone Asia/Jakarta
timedatectl   # pastikan "Time zone: Asia/Jakarta (WIB, +0700)"
```

> **Kenapa ini penting dan sering terlewat.** Kumpulan koneksi aplikasi memakai `timezone: 'local'` dengan tanggal dibaca sebagai teks, sementara batas waktu sesi dihitung **di dalam SQL** memakai jam MySQL. Kalau zona waktu OS dan MySQL berbeda, tanggal yang tampil bergeser dan sesi bisa berakhir pada waktu yang tidak diduga. Set keduanya sama — MySQL diatur di [4.4](#44-konfigurasi-mysql).

### 2.3 Swap

Server cloud sering lahir tanpa swap. Build butuh lonjakan memori sesaat; swap membuat lonjakan itu tidak berujung *out-of-memory*.

```bash
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
free -h   # kolom Swap harus terisi
```

### 2.4 User aplikasi

Aplikasi **tidak boleh** berjalan sebagai `root`.

```bash
sudo adduser --system --group --home /srv/simt --shell /usr/sbin/nologin simt
sudo mkdir -p /srv/simt /var/lib/simt/foto
sudo chown -R simt:simt /srv/simt /var/lib/simt
```

`/var/lib/simt/foto` adalah tempat **foto pegawai** — sengaja **di luar direktori aplikasi**. Alasannya di [Lampiran A](#lampiran-a--daftar-environment-lengkap).

### 2.5 Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp          # batasi ke jaringan admin bila memungkinkan:
                               # sudo ufw allow from 10.0.0.0/8 to any port 22 proto tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

**Port 3306 dan 3000 tidak pernah dibuka.** MySQL hanya diakses dari `127.0.0.1`, dan port 3000 hanya dari Nginx di mesin yang sama.

### 2.6 Pembaruan keamanan otomatis

```bash
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

---

## 3. Langkah 2 — Node.js 22 LTS

> ⚠️ **Jangan `sudo apt install nodejs`.** Paket bawaan Ubuntu 24.04 adalah **Node 18.19.1** — diverifikasi langsung terhadap repositori `noble/universe`. Next.js 16.2.12 menuntut **Node ≥ 20.9.0** (`engines.node`), jadi paket bawaan akan gagal, dan gagalnya tidak selalu langsung terbaca sebagai "versi Node salah".

Pasang dari NodeSource:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs

node -v    # harus v22.x
npm -v
```

**Pin versinya** supaya `apt upgrade` tidak memindahkan Node besar-besaran tanpa direncanakan:

```bash
sudo apt-mark hold nodejs
```

> Alternatif `nvm` **tidak disarankan di server**: `nvm` dipasang per pengguna dan tidak terjangkau oleh unit systemd yang berjalan sebagai `simt` dengan shell `nologin`.

---

## 4. Langkah 3 — MySQL 8.0

### 4.1 Install

```bash
apt policy mysql-server     # verifikasi kandidatnya 8.0.x — di Ubuntu 24.04: 8.0.46
sudo apt install -y mysql-server
sudo systemctl enable --now mysql
mysql --version             # pastikan "mysql  Ver 8.0.xx", BUKAN mariadb
```

> ⚠️ **MariaDB tidak bisa dipakai, dan ini bukan soal selera.** Skema aplikasi memakai collation `utf8mb4_0900_ai_ci` pada **26 tabel** — collation itu **tidak ada di MariaDB**. Selain itu kueri aplikasi memakai `JSON_TABLE`, `WITH RECURSIVE`, dan `ROW_NUMBER()`. Kalau `mysql --version` menyebut MariaDB, hentikan dan pasang MySQL yang benar.

### 4.2 Pengerasan awal

```bash
sudo mysql_secure_installation
```

Jawaban yang disarankan: pasang komponen kekuatan sandi → **y** · hapus pengguna anonim → **y** · larang login root dari jarak jauh → **y** · hapus database `test` → **y** · muat ulang tabel hak akses → **y**.

Di Ubuntu, `root` MySQL memakai autentikasi soket (`sudo mysql`), bukan sandi. Biarkan begitu — itu lebih aman daripada root bersandi.

### 4.3 Database & pengguna

Jalankan `sudo mysql`, lalu:

```sql
CREATE DATABASE simt_djbk
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

-- Pengguna APLIKASI: hanya DML, tanpa hak DDL.
-- Diverifikasi dari kode: aplikasi tidak pernah menjalankan CREATE/ALTER/DROP/
-- TRUNCATE/LOCK TABLES/CREATE TEMPORARY maupun transaksi eksplisit.
CREATE USER 'simt_app'@'127.0.0.1'
  IDENTIFIED BY 'GANTI-sandi-acak-panjang';
GRANT SELECT, INSERT, UPDATE, DELETE ON simt_djbk.* TO 'simt_app'@'127.0.0.1';

-- Pengguna MIGRASI: dipakai sesekali saat memasang/mengubah skema, lalu ditutup.
CREATE USER 'simt_ddl'@'127.0.0.1'
  IDENTIFIED BY 'GANTI-sandi-acak-lain';
GRANT ALL PRIVILEGES ON simt_djbk.* TO 'simt_ddl'@'127.0.0.1';

FLUSH PRIVILEGES;
```

Bangkitkan sandinya, jangan dikarang:

```bash
openssl rand -base64 32
```

> **Kenapa hak aplikasi dibatasi DML.** Kalau suatu hari ada celah injeksi SQL di satu tempat, batas ini menentukan apakah akibatnya "baris terbaca" atau "seluruh tabel hilang". Pemisahannya gratis dan hanya menambah satu langkah saat migrasi.

### 4.4 Konfigurasi MySQL

Buat berkas tambahan, **jangan** menyunting `mysqld.cnf` bawaan — berkas bawaan bisa ditimpa saat paket diperbarui.

```bash
sudo tee /etc/mysql/mysql.conf.d/99-simt.cnf >/dev/null <<'EOF'
[mysqld]
# --- Jaringan: aplikasi dan DB satu server, jangan dibuka sama sekali ---
bind-address            = 127.0.0.1
mysqlx                  = 0

# --- Karakter & collation: WAJIB sama dengan skema aplikasi ---
character-set-server    = utf8mb4
collation-server        = utf8mb4_0900_ai_ci

# --- Zona waktu: harus sama dengan OS (Asia/Jakarta) ---
# Offset numerik dipakai agar tidak bergantung pada tabel zona waktu MySQL.
default-time-zone       = '+07:00'

# --- Koneksi: kumpulan koneksi aplikasi = 10 per proses Node ---
max_connections         = 100

# --- Sesuaikan dengan RAM: ±50-60% RAM untuk server khusus DB;
#     untuk server bersama (app + DB) di 8 GB, 2 GB memadai ---
innodb_buffer_pool_size = 2G

# --- Log kueri lambat: alat pertama saat halaman terasa berat ---
slow_query_log          = 1
slow_query_log_file     = /var/log/mysql/slow.log
long_query_time         = 1
EOF

sudo systemctl restart mysql
```

Verifikasi hasilnya benar-benar terpasang:

```bash
sudo mysql -e "SELECT @@version, @@character_set_server, @@collation_server, @@global.time_zone, @@max_connections;"
```

### 4.5 Serahkan ke tim DB

Sampai di sini server sudah punya MySQL 8.0 yang siap, database `simt_djbk` kosong, dan dua pengguna. **Pemasangan skema dan master data dilakukan tim DB** — persyaratan yang harus dipenuhinya ada di [Lampiran B](#lampiran-b--yang-aplikasi-harapkan-dari-database).

Aplikasi **belum bisa di-build** sebelum skemanya terpasang. Itu bukan pilihan urutan; lihat [Langkah 6](#7-langkah-6--build).

---

## 5. Langkah 4 — Kode aplikasi & dependensi

```bash
sudo -u simt git clone <URL-REPOSITORI> /srv/simt/app
cd /srv/simt/app
sudo -u simt npm ci
```

> **Pakai `npm ci`, bukan `npm install`.** `npm ci` memasang persis apa yang tertulis di `package-lock.json`; `npm install` boleh menaikkan versi minor dan membuat server berbeda dari yang diuji.
>
> **Jangan `npm ci --omit=dev`.** Build membutuhkan `devDependencies` (TypeScript, Tailwind, PostCSS). Pemangkasan dependensi build hanya boleh dilakukan **setelah** build selesai — dan karena `output: 'standalone'` tidak diaktifkan di aplikasi ini, `next start` tetap butuh `node_modules` saat berjalan, jadi lebih aman **tidak** memangkasnya sama sekali.

Ukuran yang perlu diketahui: `node_modules` **843 MB**, kode + dokumen **111 MB** (68 MB di antaranya berkas dokumen `doc/`, tidak diperlukan saat aplikasi berjalan).

---

## 6. Langkah 5 — Berkas environment

```bash
sudo -u simt tee /srv/simt/app/.env.production >/dev/null <<'EOF'
# ── Basis data ────────────────────────────────────────────────────────────
DATABASE_HOST=127.0.0.1
DATABASE_PORT=3306
DATABASE_USER=simt_app
DATABASE_PASSWORD=GANTI-sandi-yang-dibuat-di-langkah-4.3
DATABASE_NAME=simt_djbk

# ── Mode ──────────────────────────────────────────────────────────────────
# Ini yang menyalakan cookie sesi ber-atribut Secure. Jangan diubah.
NODE_ENV=production

# ── Foto pegawai ──────────────────────────────────────────────────────────
# WAJIB di luar direktori aplikasi. Lihat Lampiran A.
DIR_FOTO_PEGAWAI=/var/lib/simt/foto

# ── API eNominasi ─────────────────────────────────────────────────────────
# Isi bila integrasi eNominasi dipakai; kosongkan bila belum.
ENOM_SECRET=
EOF

sudo chmod 600 /srv/simt/app/.env.production
sudo chown simt:simt /srv/simt/app/.env.production
```

**Tiga variabel yang HARUS TIDAK ADA di berkas ini:**

| Variabel | Akibat kalau ikut terbawa |
|---|---|
| `SESI_COOKIE_SECURE=false` | Cookie sesi melintas **tanpa proteksi HTTPS**. Ini pelemahan yang sengaja dibuat untuk pratinjau lokal saja |
| `HANYA_PEGAWAI_SUMBER` | Menyembunyikan sebagian pegawai dari **seluruh** halaman **tanpa penanda apa pun di layar** — pembaca akan menyimpulkan itulah seluruh populasi DJBK |
| `NEXT_PUBLIC_DEV_ROLE_SWITCH` | Sudah kode mati (nol pembaca di seluruh repositori). Hapus supaya tidak menyesatkan pembaca berkas env berikutnya |

Periksa tidak ada yang tersisa:

```bash
grep -nE 'SESI_COOKIE_SECURE|HANYA_PEGAWAI_SUMBER|DEV_ROLE_SWITCH' /srv/simt/app/.env.production \
  && echo "!! ADA YANG HARUS DIHAPUS" || echo "OK — bersih"
```

Daftar lengkap variabel yang dibaca kode ada di [Lampiran A](#lampiran-a--daftar-environment-lengkap).

---

## 7. Langkah 6 — Build

> ⚠️ **Database harus sudah hidup DAN berisi skema sebelum langkah ini.** Ini dibuktikan, bukan diduga: `next build` dijalankan dengan alamat database sengaja dibuat tak terjangkau, dan hasilnya **gagal**:
>
> ```
> Error occurred prerendering page "/master/unit"
> Error: connect ETIMEDOUT
> Export encountered an error on /(app)/master/unit/page, exiting the build.
> ```
>
> Penyebabnya: sebagian halaman dicoba di-*prerender* saat build, dan halaman-halaman itu menyentuh basis data. Konsekuensi praktisnya — **pipeline CI/CD juga butuh akses ke basis data berskema**, bukan hanya server produksinya.

```bash
cd /srv/simt/app
sudo -u simt npm run build
```

**Build yang sehat, terukur di repositori ini:**

| Ukuran | Nilai |
|---|---|
| Route yang dihasilkan | **43** |
| Waktu | **±50 detik** (4 vCPU) |
| Puncak memori proses induk | **±1 GB**, dengan 3 worker paralel |
| Kode keluar | **0** |
| Halaman statis | 3 (`/_not-found`, `/icon.svg`, `/lupa-password`) — sisanya dirender saat diminta |

Peringatan yang **wajar muncul** dan bukan kegagalan:

- `The "middleware" file convention is deprecated. Please use "proxy" instead.` — utang teknis untuk kenaikan Next berikutnya, tidak menghalangi apa pun sekarang.
- `Encountered unexpected file in NFT list` pada `lib/foto-pegawai.ts` — berkas itu membaca direktori foto saat berjalan, jadi Next tidak bisa melacak dependensinya secara statis. Tidak berpengaruh karena `output: 'standalone'` tidak dipakai.

---

## 8. Langkah 7 — Layanan systemd

```bash
sudo tee /etc/systemd/system/simt.service >/dev/null <<'EOF'
[Unit]
Description=SIMT DJBK — Sistem Informasi Manajemen Talenta
Documentation=file:///srv/simt/app/doc/setup_server_prod.md
After=network-online.target mysql.service
Wants=network-online.target
Requires=mysql.service

[Service]
Type=simple
User=simt
Group=simt
WorkingDirectory=/srv/simt/app
EnvironmentFile=/srv/simt/app/.env.production
Environment=PORT=3000
Environment=HOSTNAME=127.0.0.1
ExecStart=/usr/bin/node node_modules/next/dist/bin/next start -p 3000 -H 127.0.0.1
Restart=always
RestartSec=5

# Pengerasan proses
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/srv/simt/app/.next /var/lib/simt
ProtectKernelTunables=true
ProtectKernelModules=true
ProtectControlGroups=true
RestrictSUIDSGID=true
LockPersonality=true

# Log ke journald
StandardOutput=journal
StandardError=journal
SyslogIdentifier=simt

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now simt
sudo systemctl status simt --no-pager
```

Beberapa keputusan di unit ini yang sengaja:

| Baris | Alasan |
|---|---|
| `-H 127.0.0.1` | Aplikasi **hanya** mendengarkan localhost. Satu-satunya jalan masuk dari luar adalah Nginx, jadi port 3000 tidak bisa diakses langsung walau firewall salah konfigurasi |
| `Requires=mysql.service` | Aplikasi membangun kumpulan koneksi saat modul dimuat — tanpa MySQL, ia gagal saat start |
| `ExecStart` memakai jalur biner langsung | `npx`/`npm run` menambah proses pembungkus yang membuat `systemctl stop` dan pelaporan status jadi tidak akurat. Jalurnya diverifikasi ada: `node_modules/next/dist/bin/next` |
| `ReadWritePaths` | Next menulis cache ke `.next`, dan foto pegawai dibaca dari `/var/lib/simt`. Sisa sistem berkas hanya-baca bagi proses ini |

Batasi ukuran log supaya disk tidak habis diam-diam:

```bash
sudo mkdir -p /etc/systemd/journald.conf.d
sudo tee /etc/systemd/journald.conf.d/99-simt.conf >/dev/null <<'EOF'
[Journal]
SystemMaxUse=2G
MaxRetentionSec=90day
EOF
sudo systemctl restart systemd-journald
```

---

## 9. Langkah 8 — Nginx & HTTPS

> ⚠️ **HTTPS bukan opsional untuk aplikasi ini.** Cookie sesi dipasang ber-atribut `Secure` begitu `NODE_ENV=production`, dan peramban **menolak menyimpan** cookie `Secure` yang datang lewat HTTP polos. `localhost` dikecualikan sebagai *secure context*, **alamat IP tidak**. Gejalanya kalau dilanggar: *"sandinya benar tapi tidak bisa masuk"*, berulang, **tanpa satu pun pesan galat**.

### 9.1 Nginx

```bash
sudo apt install -y nginx
sudo rm -f /etc/nginx/sites-enabled/default

sudo tee /etc/nginx/sites-available/simt >/dev/null <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name simt.example.go.id;   # GANTI

    # Biarkan certbot memakai jalur ini, sisanya dialihkan ke HTTPS
    location /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 301 https://$host$request_uri; }
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name simt.example.go.id;   # GANTI

    # Diisi certbot di langkah 9.2
    # ssl_certificate     /etc/letsencrypt/live/simt.example.go.id/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/simt.example.go.id/privkey.pem;

    # Ekspor CSV & unggahan bisa besar
    client_max_body_size 25m;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options    "nosniff" always;
    add_header Referrer-Policy           "strict-origin-when-cross-origin" always;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # WAJIB — tanpa dua baris IP di bawah, kolom IP di Audit Log kosong,
        # dan itu justru kolom yang membedakan aktivitas manusia dari otomatis.
        proxy_set_header X-Real-IP         $remote_addr;
        proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;

        proxy_set_header Host              $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade           $http_upgrade;
        proxy_set_header Connection        "upgrade";

        proxy_read_timeout 120s;   # Hitung Ulang pada populasi besar butuh waktu
    }

    # Aset statis Next boleh di-cache lama karena namanya ber-hash
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_cache_valid 200 1y;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/simt /etc/nginx/sites-enabled/simt
sudo nginx -t && sudo systemctl reload nginx
```

### 9.2 Sertifikat

**Kalau domainnya dapat dijangkau dari internet:**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d simt.example.go.id
sudo systemctl status certbot.timer   # perpanjangan otomatis
```

**Kalau intranet (tidak terjangkau Let's Encrypt):** minta sertifikat dari CA internal Kementerian, lalu tunjuk berkasnya di `ssl_certificate` / `ssl_certificate_key`. Sertifikat *self-signed* bisa dipakai untuk uji coba, tetapi peramban akan menampilkan peringatan — dan pengguna yang membiasakan diri menekan "lanjutkan saja" adalah masalah keamanan tersendiri, jadi jangan dibiarkan sampai go-live.

`proxy_read_timeout 120s` disengaja: **Hitung Ulang** menilai seluruh pegawai aktif terhadap satu jabatan target, dan pada populasi produksi itu butuh waktu lebih lama daripada 60 detik bawaan Nginx.

---

## 10. Langkah 9 — Verifikasi

Jalankan berurutan. Semuanya harus hijau sebelum aplikasi diserahkan.

```bash
# 1. Versi runtime
node -v                                    # v22.x
mysql --version                            # 8.0.x, bukan mariadb

# 2. Zona waktu OS dan MySQL sama
timedatectl | grep 'Time zone'
sudo mysql -e "SELECT @@global.time_zone, NOW();"

# 3. Collation database benar
sudo mysql -e "SELECT @@character_set_server, @@collation_server;"
# harus: utf8mb4 | utf8mb4_0900_ai_ci

# 4. Aplikasi dapat menyambung DB dengan user aplikasi
mysql -h 127.0.0.1 -u simt_app -p simt_djbk -e "SELECT COUNT(*) AS jml_peran FROM roles;"

# 5. Layanan hidup
systemctl is-active simt mysql nginx
sudo journalctl -u simt -n 30 --no-pager   # tidak boleh ada galat berulang

# 6. Aplikasi menjawab di localhost
curl -s -o /dev/null -w 'halaman masuk: %{http_code}\n' http://127.0.0.1:3000/masuk
# 200

# 7. Halaman terlindungi memantulkan ke halaman masuk
curl -s -o /dev/null -w 'tanpa sesi: %{http_code} -> %{redirect_url}\n' http://127.0.0.1:3000/talenta
# 307 -> .../masuk?next=%2Ftalenta

# 8. HTTPS bekerja dan port aplikasi TIDAK terbuka dari luar
curl -sI https://simt.example.go.id/masuk | head -1     # HTTP/2 200
ss -ltnp | grep -E ':3000|:3306'                        # keduanya harus 127.0.0.1
```

### Verifikasi terakhir: benar-benar masuk

Buka `https://<domain>/masuk` dari **komputer pengguna**, bukan dari server.

Bila halaman terbuka lengkap tetapi **tidak ada yang bisa diklik** — pengalih tema, menu pengguna, pencarian mati semua sekaligus, dan tema terkunci di mode gelap — itu **bukan** masalah CSS. Itu React klien yang tidak hidup. Periksa tab Network peramban: satu balasan `403` pada `/_next/*` adalah seluruh jawabannya, dan penyebabnya konfigurasi Nginx atau alamat yang dipakai, bukan kode aplikasi.

---

## 11. Langkah 10 — Pengerasan sebelum go-live

Empat butir berikut **tidak akan ditemukan oleh uji apa pun**. Semuanya harus dikerjakan lewat antarmuka aplikasi setelah bisa masuk.

| # | Tindakan | Di mana |
|---|---|---|
| 1 | **Atur ulang sandi seluruh akun**, lalu nonaktifkan akun uji coba. Sandi contoh di data pembangunan adalah `password123` dan sudah masuk daftar sandi terlarang aplikasi — tetapi akun yang membawanya tetap harus dibereskan | Administrasi › **Pengguna & Peran** |
| 2 | **Cabut seluruh token API contoh**, lalu terbitkan yang baru per instansi yang benar-benar punya MoU/PKS. Token contoh di repositori **plaintext-nya publik** karena ikut tersimpan di berkas SQL | Administrasi › **Klien & Token API** |
| 3 | **Pastikan HTTPS aktif** dan `SESI_COOKIE_SECURE` tidak ada di berkas environment | server |
| 4 | **Periksa ulang parameter sistem** — masa berlaku asesmen, ambang Kotak 9, tenggat sesi, batas percobaan masuk. Nilai bawaan berasal dari lingkungan pembangunan | Administrasi › **Pengaturan Sistem** |

Setelah butir 4, jalankan **Hitung Ulang** pada setiap jabatan target — perubahan parameter **tidak berlaku surut** terhadap skor yang sudah tersimpan.

---

## 12. Operasional

### 12.1 Deploy versi baru

```bash
cd /srv/simt/app
sudo -u simt git pull
sudo -u simt npm ci
sudo -u simt npm run build      # DB harus hidup
sudo systemctl restart simt
sudo journalctl -u simt -n 20 --no-pager
```

**Ada jeda tidak-tersedia** selama `restart` (beberapa detik). Untuk nol-jeda, dibutuhkan dua instance di port berbeda dengan Nginx `upstream` yang dialihkan setelah instance baru siap — di luar lingkup dokumen ini.

> ⚠️ **Jangan menjalankan `npm run build` sambil versi lama masih melayani dari direktori yang sama.** `next build` dan proses `next start` yang berjalan menulis serta membaca folder keluaran yang sama, dan tumpang-tindihnya menghasilkan gejala yang sangat menyesatkan: **sebagian route mendadak 404 sementara sisanya sehat**. Kalau ini terjadi: `systemctl stop simt` → `rm -rf .next` → build ulang → `systemctl start simt`.

### 12.2 Kembali ke versi sebelumnya

```bash
cd /srv/simt/app
sudo -u simt git log --oneline -5
sudo -u simt git checkout <commit-sebelumnya>
sudo -u simt npm ci && sudo -u simt npm run build
sudo systemctl restart simt
```

Perubahan skema database **tidak** ikut kembali dengan cara ini — itu urusan tim DB, dan karena itu setiap perubahan skema perlu jalur mundurnya sendiri.

### 12.3 Log

```bash
sudo journalctl -u simt -f                 # aplikasi, langsung
sudo journalctl -u simt --since '1 hour ago' -p err
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/mysql/slow.log       # kueri > 1 detik
```

### 12.4 Cadangan

Belum ada apa pun soal ini di repositori — **wajib disiapkan sebelum go-live.**

```bash
sudo mkdir -p /var/backups/simt && sudo chmod 700 /var/backups/simt

sudo tee /usr/local/bin/simt-backup >/dev/null <<'EOF'
#!/bin/bash
set -euo pipefail
TS=$(date +%F-%H%M)
OUT=/var/backups/simt
mysqldump --defaults-file=/root/.my.cnf \
  --single-transaction --routines --triggers --events \
  simt_djbk | gzip > "$OUT/simt_djbk-$TS.sql.gz"
tar czf "$OUT/foto-$TS.tar.gz" -C /var/lib/simt foto
find "$OUT" -type f -mtime +30 -delete
EOF
sudo chmod 700 /usr/local/bin/simt-backup
```

Simpan kredensial dump di `/root/.my.cnf` (`chmod 600`) supaya sandi tidak muncul di daftar proses, lalu jadwalkan:

```bash
sudo systemd-run --on-calendar='daily' --unit=simt-backup /usr/local/bin/simt-backup
# atau: sudo crontab -e  →  15 2 * * * /usr/local/bin/simt-backup
```

**Cadangan yang belum pernah dipulihkan bukan cadangan.** Uji restore ke database terpisah minimal sekali sebelum go-live.

### 12.5 Yang akan tumbuh terus dan perlu diperhatikan

| Tabel | Sifatnya |
|---|---|
| `audit_log` | Satu baris per mutasi **dan** per peristiwa masuk/keluar. Tidak pernah dipangkas aplikasi — butuh kebijakan retensi |
| `api_activity_log` | Satu baris per permintaan API eksternal. Sama, tidak pernah dipangkas |
| `sesi` | Bertambah setiap login; dibersihkan secara oportunistik saat login berikutnya |

Pantau ukurannya berkala:

```bash
sudo mysql -e "
SELECT table_name, table_rows, ROUND((data_length+index_length)/1024/1024,1) AS mb
FROM information_schema.tables
WHERE table_schema='simt_djbk' ORDER BY (data_length+index_length) DESC LIMIT 10;"
```

---

## 13. Troubleshooting server baru

| Gejala | Penyebab paling sering | Tindakan |
|---|---|---|
| `next build` gagal, pesan menyebut `ETIMEDOUT` / `ECONNREFUSED` | Database belum hidup atau skemanya belum terpasang | Pasang skema lebih dulu — build memang membutuhkannya |
| `next build` gagal dengan *"Worker exited unexpectedly"* atau jejak tumpukan V8 | **Kehabisan memori**, bukan bug kode | Tambah RAM/swap, lalu build ulang. Periksa `free -h` sebelum menyalahkan kode |
| `systemctl start simt` gagal, log menyebut `DATABASE_NAME belum diset` | `EnvironmentFile` tidak terbaca | Periksa jalur, kepemilikan (`simt:simt`), dan izin (`600`) `.env.production` |
| Bisa masuk dari server (`curl` 200) tapi tidak dari peramban | Belum HTTPS, atau diakses lewat alamat IP | Selesaikan sertifikat. Cookie `Secure` tidak akan tersimpan lewat HTTP polos, dan IP tidak dianggap *secure context* |
| Halaman tampil sempurna tetapi tidak ada yang bisa diklik; tema terkunci gelap | Chunk JavaScript gagal dimuat (biasanya `403`/`404` pada `/_next/*`) | Periksa tab Network. Ini masalah proxy/alamat, bukan CSS |
| Kolom IP di Audit Log kosong | Nginx tidak meneruskan `X-Real-IP` / `X-Forwarded-For` | Lihat [9.1](#91-nginx) |
| *"Illegal mix of collations"* pada halaman tertentu | Collation koneksi berbeda dari collation tabel | Pastikan `collation-server = utf8mb4_0900_ai_ci`. **Kesalahan ini lolos saat diuji lewat klien `mysql` di terminal tetapi jatuh lewat aplikasi** — jadi "sudah kuuji langsung ke DB, aman" bukan bukti apa pun di sini |
| Sebagian route mendadak 404, sisanya sehat | Folder keluaran build ditulis dua proses sekaligus | `systemctl stop simt` → `rm -rf .next` → build ulang → start |
| Tanggal di layar bergeser beberapa jam | Zona waktu OS dan MySQL berbeda | Lihat [2.2](#22-zona-waktu) dan [4.4](#44-konfigurasi-mysql) |
| Halaman terasa berat setelah data produksi masuk | Indeks belum ditinjau terhadap rencana kueri nyata | Mulai dari `/var/log/mysql/slow.log`. Indeks yang disebut spesifikasi produk **belum pernah ditinjau terhadap `EXPLAIN`** — ini utang yang diketahui |

---

## Lampiran A — Daftar environment lengkap

Hasil pemeriksaan seluruh `app/`, `lib/`, `scripts/`, `middleware.ts`, dan `next.config.ts`. **Hanya variabel di tabel ini yang benar-benar dibaca kode** — selain ini tidak berpengaruh apa pun.

| Variabel | Wajib | Nilai produksi | Catatan |
|---|:--:|---|---|
| `DATABASE_HOST` | ✓ | `127.0.0.1` | |
| `DATABASE_PORT` | ✓ | `3306` | |
| `DATABASE_USER` | ✓ | `simt_app` | hanya perlu hak DML |
| `DATABASE_PASSWORD` | ✓ | sandi acak | |
| `DATABASE_NAME` | ✓ | `simt_djbk` | aplikasi **berhenti dengan pesan jelas** kalau ini kosong |
| `NODE_ENV` | ✓ | `production` | menyalakan cookie `Secure` |
| `DIR_FOTO_PEGAWAI` | ✓ | `/var/lib/simt/foto` | lihat catatan di bawah |
| `ENOM_SECRET` | — | dari pengelola eNominasi | kosongkan bila integrasi belum dipakai |
| `ENOM_URL` | — | — | ada bawaan di kode |
| `ENOM_TIMEOUT_MS` | — | — | ada bawaan di kode |
| `ENOM_BATCH` | — | — | ada bawaan di kode |
| `NEXT_DIST_DIR` | — | jangan diset | hanya untuk build pratinjau berdampingan |
| `SESI_COOKIE_SECURE` | ✗ | **jangan diset** | `false` melemahkan cookie sesi |
| `HANYA_PEGAWAI_SUMBER` | ✗ | **jangan diset** | menyembunyikan sebagian pegawai tanpa penanda di layar |
| `VERBOSE` | — | — | hanya untuk skrip pengukuran |

> **Kenapa `DIR_FOTO_PEGAWAI` wajib di luar direktori aplikasi.** Foto wajah adalah data pribadi yang dilindungi UU No. 27 Tahun 2022. Apa pun yang diletakkan di folder aset publik aplikasi dilayani **tanpa autentikasi**, dan nama berkas berpola `<nip>.png` bukan tebakan yang sulit. Dengan variabel ini, satu-satunya jalan keluar foto adalah rute internal yang memeriksa sesi dan lingkup unit pengguna.

Aplikasi memuat berkas environment lewat `EnvironmentFile` di unit systemd. Next juga membaca `.env.production` di direktori kerja; keduanya menunjuk berkas yang sama, jadi tidak ada dua sumber yang bisa berselisih.

---

## Lampiran B — Yang aplikasi harapkan dari database

Pemasangan skema di luar lingkup dokumen ini. Berikut **kontrak minimum** yang harus dipenuhi agar aplikasi berjalan.

### Wajib

| Syarat | Nilai | Kalau dilanggar |
|---|---|---|
| Mesin basis data | **MySQL 8.0+** | `utf8mb4_0900_ai_ci`, `JSON_TABLE`, `WITH RECURSIVE`, dan `ROW_NUMBER()` tidak semuanya tersedia di luar MySQL 8. **MariaDB tidak bisa** |
| Charset & collation database | `utf8mb4` / `utf8mb4_0900_ai_ci` | nama non-ASCII rusak; kueri kamus diklat gagal dengan *"Illegal mix of collations"* |
| Mesin tabel | InnoDB | kunci asing dan penghapusan berantai dipakai di banyak tempat |
| `sql_mode` | biarkan bawaan MySQL 8 | melonggarkan `STRICT_TRANS_TABLES` membuat data cacat masuk diam-diam |
| Hak pengguna aplikasi | `SELECT, INSERT, UPDATE, DELETE` | aplikasi tidak pernah menjalankan DDL, `TRUNCATE`, `LOCK TABLES`, `CREATE TEMPORARY`, maupun transaksi eksplisit — diverifikasi dari kode |

### Data yang harus ada sejak awal

| Tabel | Isi minimum | Kalau kosong |
|---|---|---|
| `roles` | **5 baris**: `Super Admin`, `Admin Talenta`, `Pengelola Unit`, `Pimpinan`, `Viewer` — nama harus **sama persis** | tidak ada akun yang bisa dibuat; peran tidak dikenali |
| `users` | minimal **satu** akun Super Admin aktif ber-sandi hash bcrypt | tidak ada yang bisa masuk. Aplikasi juga menolak menonaktifkan Super Admin aktif terakhir — jadi jangan sampai hanya ada satu untuk selamanya |
| `unit_organisasi` | struktur DJBK | penyaring unit kosong; lingkup Pengelola Unit tidak bisa ditetapkan |
| `jabatan` | daftar jabatan | jabatan target tidak bisa menunjuk posisi mana pun |
| `pengaturan_sistem` | baris parameter | **boleh kosong** — aplikasi jatuh ke nilai bawaan yang sudah terbukti, bukan ke nol atau ke galat |
| `master_kategori_riwayat_diklat` | kamus kategori | Validasi Riwayat tidak punya pilihan; indikator Pengembangan Kompetensi tidak bisa dinilai |

### Yang TIDAK boleh masuk produksi

| Isi | Alasan |
|---|---|
| Akun contoh ber-sandi `password123` | sandi tersebut ada di berkas yang di-*commit* |
| Tiga token API contoh | plaintext-nya tersimpan di repositori, jadi bersifat publik |
| Pegawai, asesmen, skor, nominasi, dan rencana pengembangan dari lingkungan pembangunan | data dummy; skornya akan terbaca sebagai penilaian sungguhan |

### Sesudah data pegawai masuk

Jalankan **Hitung Ulang** pada setiap jabatan target dari antarmuka aplikasi. Skor, kelayakan, dan peringkat talent pool **tidak** dihitung otomatis ketika data berubah — perhitungan adalah tindakan yang disengaja, bukan efek samping.

---

*Dokumen ini disusun 23 Agustus 2026 terhadap Ubuntu 24.04.4 LTS. Versi paket (`nodejs` 18.19.1 di repositori bawaan, `mysql-server` 8.0.46 di `noble-updates`) diverifikasi langsung; bila berbeda saat Anda memasangnya, percayai keluaran `apt policy` dan bukan angka di sini.*
