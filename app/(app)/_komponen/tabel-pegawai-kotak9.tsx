'use client'

import { Badge } from '@/components/ui/badge'
import { DataTable, type KolomTabel } from '@/components/ui/data-table'
import { formatNip, formatSkor, formatSkorRingkas } from '@/lib/format'
import { bisaUrutKotak9 } from '@/lib/urut'

/**
 * SATU tabel pegawai untuk kedua drill-down Kotak 9 — dashboard & Peta Talenta.
 *
 * ## Kenapa satu komponen, bukan dua yang "disamakan"
 *
 * Sampai 24 Agu 2026 tabel pegawai yang sama tampil dalam TIGA bentuk berbeda:
 * Direktori memakai `DataTable` dengan Nama & NIP dua kolom, Peta Talenta memakai
 * `DataTable` dengan keduanya digabung satu kolom, dan drill-down dashboard memakai
 * `<table>` HTML mentah tanpa paginasi, tanpa pemilih kolom, dan dengan Jabatan &
 * Unit ditumpuk dalam satu sel. Ketiganya menampilkan orang yang sama.
 *
 * Permintaan pemilik proses: *"tabel pegawai yang ada di dashboard, direktori
 * pegawai sama peta talenta samain formatnya ya"*. Menyamakannya dengan menyunting
 * tiga berkas akan bertahan sampai perubahan berikutnya — mereka sudah pernah
 * sama, lalu berbeda lagi. Jadi yang dibuat satu **komponen**, dan tipe barisnya
 * dipakai kedua kueri, sehingga kolom yang berselisih jadi galat kompilasi.
 *
 * Bentuk kolomnya mengikuti Direktori Pegawai, yang sudah jadi acuan sejak revisi
 * `PUR.pdf` 12 Agu 2026: **NIP dan Nama dua kolom terpisah**, Jabatan dan Unit
 * Organisasi juga terpisah. Hanya kolom NAMA yang `sticky` — dua kolom menempel
 * sekaligus memakan hampir separuh lebar layar saat tabel digulir.
 *
 * ## Pengurutan: SEMPAT dimatikan seluruhnya, sekarang hidup
 *
 * Sampai 24 Agu 2026 kesepuluh kolomnya `bisaDiurutkan: false`, dan alasannya sah:
 * kedua kueri mengurutkan TETAP menurut Nilai Talenta menurun, jadi tombol urut
 * hanya akan jadi klik mati (phase.md §5.2). Yang benar bukan memasang tombolnya,
 * melainkan membuat kuerinya benar-benar mengurut — dan itu yang dikerjakan atas
 * permintaan pemilik proses: kedua kueri sekarang menerima `?urut=`/`?arah=` dengan
 * **daftar putih** ekspresi `ORDER BY`.
 *
 * `bisaDiurutkan` diturunkan dari `bisaUrutKotak9()` di `lib/urut.ts`, SATU daftar
 * yang juga dipakai kedua kueri. Kalau daftarnya ditulis ulang di sini, akan ada
 * kolom yang tombolnya tampil tapi tidak mengubah apa pun — kegagalan yang sama
 * yang dulu jadi alasan mematikan tombolnya.
 *
 * `nip` sengaja TIDAK bisa diurutkan: ia identitas, bukan besaran, dan kolom Nama
 * di sebelahnya sudah menjawab pertanyaan yang sama.
 */

/**
 * Bentuk baris yang dipakai KEDUA drill-down.
 *
 * `AnggotaSel` (Peta Talenta) & `AnggotaKotak` (dashboard) dibuat identik dengan
 * ini pada 24 Agu 2026 — termasuk menambahkan `eselon` & `nilaiTalenta` ke kueri
 * dashboard yang sebelumnya tidak mengambilnya.
 */
export interface BarisPegawaiKotak9 {
  pegawaiId: number
  nip: string
  nama: string
  namaJabatan: string | null
  namaUnit: string | null
  eselon: string | null
  nilaiKinerjaY: number
  nilaiPotensialX: number
  nilaiTalenta: number
  predikat: string
  tahunAsesmen: number
  statusAsesmen: string
}

export function TabelPegawaiKotak9({
  id,
  daftar,
  total,
  halaman,
  ukuranHalaman,
  paramHalaman,
  paramUrut,
  paramArah,
  labelX = 'Potensial',
  jabatanTargetId,
}: {
  /** Id penyimpan preferensi kolom — beda per halaman supaya tidak saling menimpa. */
  id: string
  daftar: BarisPegawaiKotak9[]
  total: number
  halaman: number
  ukuranHalaman: number
  /**
   * Nama param paginasi. Dashboard memakai nama SENDIRI (`halKotak`) karena
   * halamannya juga membawa `?kotak=`; memakai `hal` di sana akan bertabrakan
   * dengan tabel lain kalau nanti ada dua di satu halaman.
   */
  paramHalaman?: string
  /**
   * Nama param pengurutan. Dashboard memakai nama SENDIRI (`urutKotak`/`arahKotak`)
   * dengan alasan yang sama seperti `halKotak`: URL-nya sudah membawa `?kotak=`, dan
   * memakai nama bawaan `urut`/`arah` mengunci nama itu untuk tabel ini saja.
   */
  paramUrut?: string
  paramArah?: string
  /**
   * Jabatan target yang sedang dilihat — dibawa ke profil sebagai `?target=`.
   *
   * Permintaan pemilik proses 25 Agu 2026: *"di page peta talenta juga sistemnya
   * sama kaya talent pool ya profilnya buat yang kesiapan per jabatan,
   * kecocokannya cuma tampilin sesuai jabatan targetnya"*. Saat Peta Talenta
   * disaring `?target=`, sumbu X-nya **adalah** match score jabatan itu — jadi
   * profil yang dibuka dari sana memang sedang membicarakan satu kursi, dan panel
   * Kecocokan yang memajang seluruh jabatan target membuat pembacanya mencari
   * sendiri baris mana yang tadi ia klik.
   *
   * `undefined`/`null` = tanpa konteks (drill-down dashboard & Peta Talenta
   * generik), dan tautannya tetap `/talenta/<nip>` seperti semula.
   */
  jabatanTargetId?: number | null
  /** Nama sumbu X yang sedang dipakai — di Peta Talenta bisa jadi match score. */
  labelX?: string
}) {
  const kolom: Array<KolomTabel<BarisPegawaiKotak9>> = [
    {
      kunci: 'nama',
      /*
        Nama & NIP DUA KOLOM, sama seperti Direktori Pegawai dan tabel Talent Pool.

        Sebelumnya satu kolom "NIP & Nama Lengkap" dengan NIP sebagai baris kecil di
        bawah nama. Revisi `PUR.pdf` sudah memecahnya di Direktori dan Talent Pool
        (12 Agu 2026), tapi kedua drill-down Kotak 9 tertinggal — jadi tabel pegawai
        yang sama tampil dalam tiga bentuk berbeda di tiga halaman. Permintaan
        pemilik proses 24 Agu 2026: *"tabel pegawai yang ada di dashboard, direktori
        pegawai sama peta talenta samain formatnya ya"*.

        Hanya kolom NAMA yang `sticky` — dua kolom menempel sekaligus memakan hampir
        separuh lebar layar saat tabel digulir, alasan yang sama dengan Direktori.
      */
      judul: 'Nama Lengkap',
      sticky: true,
      wajib: true,
      bisaDiurutkan: bisaUrutKotak9('nama'),
      lebarMin: '14rem',
      /*
        TIDAK ada `<Link>` di sini — dan itu disengaja.

        Nama SUDAH menaut ke profil: `DataTable` membungkus kolom PERTAMA dengan
        `<Link href={tautanBaris(baris)}>`, dan `tautanBaris` di bawah sudah
        mengembalikan `/talenta/<nip>` sejak awal.

        24 Agu 2026 saya menambahkan `<Link>` kedua di sini karena mencari
        `<Link>` di berkas ini dan tidak menemukannya, lalu menyimpulkan namanya
        tidak bisa diklik — tanpa memeriksa `DataTable`. Akibatnya `<a>` bersarang
        di dalam `<a>`: HTML tak sah, parser peramban menata ulang DOM-nya, dan
        React gagal hidrasi dengan error #418 HANYA di halaman ini. Tautannya
        tetap "bekerja", jadi gejalanya cuma galat konsol yang mudah diabaikan.

        Kalau suatu hari kolom pertama perlu tautan BERBEDA dari tautan baris,
        yang diubah `tautanBaris` — bukan menambah pembungkus di dalamnya.
      */
      render: (a) => <span className="block font-medium text-text">{a.nama}</span>,
    },
    {
      kunci: 'nip',
      judul: 'NIP',
      bisaDiurutkan: bisaUrutKotak9('nip'),
      lebarMin: '11rem',
      render: (a) => (
        <span className="tabular block whitespace-nowrap text-text-muted">{formatNip(a.nip)}</span>
      ),
    },
    {
      kunci: 'jabatan',
      judul: 'Jabatan',
      bisaDiurutkan: bisaUrutKotak9('jabatan'),
      lebarMin: '15rem',
      render: (a) => (
        <span className="block max-w-[20rem] text-text-muted break-words" title={a.namaJabatan ?? ''}>
          {a.namaJabatan ?? <span className="text-text-subtle">Belum tertaut jabatan</span>}
        </span>
      ),
    },
    {
      kunci: 'unit',
      judul: 'Unit Organisasi',
      bisaDiurutkan: bisaUrutKotak9('unit'),
      lebarMin: '14rem',
      render: (a) => (
        <span className="block max-w-[18rem] text-text-muted break-words" title={a.namaUnit ?? ''}>
          {a.namaUnit ?? '—'}
        </span>
      ),
    },
    {
      kunci: 'eselon',
      judul: 'Eselon',
      bisaDiurutkan: bisaUrutKotak9('eselon'),
      render: (a) =>
        a.eselon === null ? (
          <span className="text-text-subtle">—</span>
        ) : a.eselon === 'NON_ESELON' ? (
          <span className="whitespace-nowrap text-text-subtle">Non-eselon</span>
        ) : (
          <span className="text-text-muted">{a.eselon}</span>
        ),
    },
    {
      kunci: 'kinerja',
      judul: 'Kinerja',
      subjudul: 'sumbu Y · 0–100',
      rataKanan: true,
      bisaDiurutkan: bisaUrutKotak9('kinerja'),
      render: (a) => (
        <span className="tabular font-medium text-text">{formatSkorRingkas(a.nilaiKinerjaY)}</span>
      ),
    },
    {
      kunci: 'predikat',
      judul: 'Predikat Kinerja',
      // Asalnya disebut supaya tidak tertukar dengan rekap SKP triwulanan
      // e-Kinerja, yang bisa kosong saat kolom ini terisi.
      subjudul: 'dari rekaman asesmen',
      bisaDiurutkan: bisaUrutKotak9('predikat'),
      lebarMin: '9rem',
      // K-3: predikat dan kategori sumbu adalah dua taksonomi berbeda dan tidak
      // pernah digabung — "Butuh Perbaikan" justru berkategori "Sesuai Ekspektasi".
      render: (a) => <span className="text-text-muted">{a.predikat}</span>,
    },
    {
      kunci: 'potensial',
      judul: labelX,
      // Sumbu X bisa >100 (potkom tidak diplafon); sumbu Y tidak, karena ia
      // turunan predikat yang berskala tetap — jadi hanya X yang kehilangan
      // batasnya di subjudul.
      subjudul: 'sumbu X',
      rataKanan: true,
      bisaDiurutkan: bisaUrutKotak9('potensial'),
      render: (a) => (
        <span className="tabular font-medium text-text">{formatSkorRingkas(a.nilaiPotensialX)}</span>
      ),
    },
    {
      kunci: 'talenta',
      judul: 'Nilai Talenta',
      subjudul: '50% Y + 50% X',
      rataKanan: true,
      bisaDiurutkan: bisaUrutKotak9('talenta'),
      render: (a) => (
        <span className="tabular font-semibold text-text">{formatSkor(a.nilaiTalenta)}</span>
      ),
    },
    {
      kunci: 'asesmen',
      judul: 'Asesmen',
      bisaDiurutkan: bisaUrutKotak9('asesmen'),
      render: (a) => (
        <>
          <span className="tabular block text-text-muted">{a.tahunAsesmen}</span>
          {a.statusAsesmen !== 'Berlaku' ? (
            <Badge tone="peringatan" title="Asesmen kedaluwarsa — tidak eligible untuk talent pool">
              {a.statusAsesmen === 'Expired' ? 'Kedaluwarsa' : a.statusAsesmen}
            </Badge>
          ) : null}
        </>
      ),
    },
  ]

  return (
    <DataTable
      id={id}
      kolom={kolom}
      baris={daftar}
      kunciBaris={(a) => a.pegawaiId}
      tautanBaris={(a) =>
        jabatanTargetId === undefined || jabatanTargetId === null
          ? `/talenta/${a.nip}`
          : `/talenta/${a.nip}?target=${jabatanTargetId}`
      }
      total={total}
      halaman={halaman}
      ukuranHalaman={ukuranHalaman}
      paramHalaman={paramHalaman}
      paramUrut={paramUrut}
      paramArah={paramArah}
    />
  )
}
