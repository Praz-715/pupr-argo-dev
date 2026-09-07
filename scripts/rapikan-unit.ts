/**
 * Periksa & rapikan POHON `unit_organisasi` terhadap `Nama Jabatan Struktural.xlsx`.
 *
 *   npm run rapikan:unit                    # KERING — melapor, tidak menulis
 *   npm run rapikan:unit -- --pindahkan     # + rencana pemindahan induk
 *   npm run rapikan:unit -- --pindahkan --tulis
 *   npm run rapikan:unit -- --samakan-acuan --tulis   # pohon = TEPAT 49 unit acuan
 *
 * ## Kenapa ada, dan kenapa terpisah dari `rapikan-jabatan.ts`
 *
 * `rapikan:jabatan` menjawab "apakah 123 jabatan acuan ada di unit yang benar".
 * Itu bisa **seluruhnya hijau** sementara pohonnya sendiri kacau: jabatan menempel
 * pada unit yang benar, tapi unit itu menggantung di bawah induk yang salah.
 * Terukur pada 24 Agu 2026 — `rapikan:jabatan` melaporkan 123/123 sementara
 * `Direktorat Kompetensi dan Produktivitas Tenaga Kerja Konstruksi` (nama versi
 * acuan, 6 pegawai) **tidak punya satu pun anak**, dan kedua Subdirektorat-nya
 * menggantung di bawah `Direktorat Bina Kompetensi dan Produktivitas Konstruksi`
 * — nama lama yang tidak ada di acuan dan tidak punya pegawai.
 *
 * Akibatnya bukan kosmetik. `SUBKUERI_UNIT_TURUNAN` di `lib/kueri/dasar.ts`
 * rekursif, jadi **menyaring menurut unit ikut membawa seluruh turunannya** —
 * induk yang salah berarti penyaring unit, lingkup Pengelola Unit, dan daftar
 * kandidat menghitung populasi yang salah, tanpa satu pun galat.
 *
 * ## Kenapa pemindahannya DAFTAR EKSPLISIT, bukan diturunkan otomatis
 *
 * Berkas acuan memberi `(nama jabatan, unit kerja, eselon)`. Ia **tidak menyatakan
 * hubungan induk-anak antar unit** sama sekali. Jadi apa pun yang diturunkan dari
 * sana adalah inferensi saya, bukan isi dokumen — dan inferensi yang menulis
 * `parent_id` harus terlihat satu per satu supaya bisa dibantah. Menurunkannya
 * otomatis dari kemiripan nama adalah kesalahan yang baru saja terjadi di proyek
 * ini: `samaUnit()` dengan irisan 85% menyamakan seluruh 34 BP2JK dan menempelkan
 * 56 jabatan ke unit yang salah tanpa satu pun galat.
 */

import { config } from 'dotenv'
import { readFileSync } from 'node:fs'

import { kunciUnit } from './rapikan-jabatan-alias'


config({ path: '.env.local' })
config({ path: '.env' })

const ACUAN = 'doc/data/jabatan-struktural.json'
const TULIS = process.argv.includes('--tulis')
const PINDAHKAN = process.argv.includes('--pindahkan')
const SAMAKAN = process.argv.includes('--samakan-acuan')
const HAPUS_KEMBAR = process.argv.includes('--hapus-kembar-aman')
const RAPIKAN_PARKIR = process.argv.includes('--rapikan-terparkir')
const GABUNG_KEMBAR = process.argv.includes('--gabungkan-kembar')

interface Acuan {
  namaJabatan: string
  unitKerja: string
  eselon: string
}

interface BarisUnit {
  id: number
  kode_unit: string
  nama_unit: string
  parent_id: number | null
  jenis: string
  level_eselon: number | null
  jab: number
  peg: number
}

const norm = (s: string): string =>
  (s || '')
    .toLowerCase()
    .replace(/\bsub\s+direktorat\b/g, 'subdirektorat')
    .replace(/\bsub\s+bagian\b/g, 'subbagian')
    .replace(/kontruksi/g, 'konstruksi')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()

/** Ejaan berbeda yang MEMANG unit yang sama — daftar tertutup, diperiksa manusia. */

/**
 * Pemindahan induk yang diusulkan, DENGAN alasan tiap barisnya.
 *
 * Kunci & nilai memakai `kode_unit`, bukan nama: kode itu stabil sementara nama
 * unit justru hal yang sedang dirapikan. Baris yang kode-nya tidak ditemukan
 * DILEWATI dan dilaporkan — bukan diam-diam diabaikan.
 */
/**
 * Jabatan yang terparkir di AKAR dan ke mana ia semestinya — daftar eksplisit.
 *
 * Sama seperti `PINDAH` untuk unit: berkas acuan tidak menyatakan ini, jadi apa
 * pun di bawah adalah inferensi dan harus bisa dibantah satu per satu.
 *
 * Yang TIDAK ada di daftar ini, dan sengaja: ketiga jabatan fungsional
 * `Pembina Jasa Konstruksi` (Ahli Madya · Ahli Muda Kerja Sama · Ahli Utama) yang
 * juga menempel di akar. Jabatan FUNGSIONAL di tingkat Ditjen adalah keadaan yang
 * wajar — ia tidak melekat pada satu Direktorat — jadi memindahkannya ke
 * Direktorat mana pun berarti menebak. Yang jelas salah hanya jabatan STRUKTURAL
 * milik sebuah Balai yang tampil sebagai milik Ditjen.
 */
const PINDAH_JABATAN: Array<{ kode: string; keUnit: string; alasan: string }> = [
  {
    kode: 'JAB-KABALAI-BJKW-MDN',
    keUnit: 'BALAI-ACEH',
    alasan:
      'jabatan STRUKTURAL Kepala Balai tidak mungkin milik Ditjen. Ia terparkir di akar karena unit "Balai Jasa Konstruksi Wilayah I Medan" dihapus saat pohon disamakan dengan daftar acuan, dan leluhur acuan terdekatnya DJBK sendiri. Acuan menyebut Wilayah I sebagai ACEH, jadi Medan nama lama balai yang sama. TIDAK dihapus: ia anggota jabatan target 176 yang dibuat manusia.',
  },
]

/**
 * Jabatan terparkir yang NOL PENGIKAT dan tidak punya rumah yang jelas → dihapus.
 *
 * Dipisah dari `PINDAH_JABATAN` supaya penghapusan tidak pernah jadi efek samping
 * pemindahan: keduanya diputuskan per baris, dengan alasannya masing-masing.
 */
const HAPUS_JABATAN: Array<{ kode: string; alasan: string }> = [
  {
    kode: 'JAB-KASUBBAG-TU-MDN',
    alasan:
      'Kasubbag TU milik balai Medan yang unitnya sudah tidak ada. Acuan tidak memuatnya, BALAI-ACEH sudah punya Kasubbag TU sendiri, dan baris ini nol penghuni · nol anggota jabatan target · nol riwayat jabatan.',
  },
]

const PINDAH: Array<{ anak: string; indukBaru: string; alasan: string }> = [
  {
    anak: 'SUBDIT-STANDAR',
    indukBaru: 'DIT-KOMPETENSI-PRODUKTIVITAS',
    alasan:
      'induknya sekarang DIT-BINKOMPROD, nama lama yang tidak ada di acuan & tanpa pegawai. ' +
      'Acuan memuat "Kepala Sub Direktorat Bakuan Kompetensi" dkk di bawah Direktorat Kompetensi ' +
      'dan Produktivitas Tenaga Kerja Konstruksi, jadi di situlah subdirektorat kompetensi berada.',
  },
  {
    anak: 'SUBDIT-PENERAPAN-KOMP',
    indukBaru: 'DIT-KOMPETENSI-PRODUKTIVITAS',
    alasan:
      'sama seperti SUBDIT-STANDAR. Acuan bahkan menyebut namanya hampir persis: ' +
      '"Kepala Sub Direktorat Penerapan Kompetensi Tenaga Kerja Konstruksi".',
  },
  {
    anak: 'SUBDIT-KELEMBAGAAN',
    indukBaru: 'DIT-USAHA-KELEMBAGAAN',
    alasan:
      'induknya sekarang DIT-KSP yang tidak ada di acuan. Acuan memuat "Kepala Sub Direktorat ' +
      'Kelembagaan" di bawah Direktorat Usaha dan Kelembagaan Jasa Konstruksi.',
  },
]

async function main() {
  const { kueri, eksekusi } = await import('../lib/db')
  const ref = JSON.parse(readFileSync(ACUAN, 'utf8')) as Acuan[]
  const unitRef = new Set([...new Set(ref.map((r) => r.unitKerja))].map(kunciUnit))

  const u = await kueri<BarisUnit>(
    `SELECT o.id, o.kode_unit, o.nama_unit, o.parent_id, o.jenis, o.level_eselon,
            (SELECT COUNT(*) FROM jabatan j WHERE j.unit_organisasi_id = o.id) AS jab,
            (SELECT COUNT(*) FROM pegawai p JOIN jabatan j ON j.id = p.jabatan_id
              WHERE j.unit_organisasi_id = o.id AND p.status_aktif = 'AKTIF')     AS peg
       FROM unit_organisasi o ORDER BY o.id`,
  )
  const byId = new Map(u.map((x) => [x.id, x]))
  const byKode = new Map(u.map((x) => [x.kode_unit, x]))
  const anak = new Map<number | null, BarisUnit[]>()
  for (const x of u) {
    if (!anak.has(x.parent_id)) anak.set(x.parent_id, [])
    anak.get(x.parent_id)!.push(x)
  }

  console.log(`\n=== POHON UNIT ORGANISASI ${TULIS ? '(MENULIS)' : '(kering)'} ===\n`)
  console.log(`  acuan  : ${ACUAN} · ${unitRef.size} unit`)
  console.log(`  master : ${u.length} unit\n`)

  // ── 1. Keutuhan pohon ──────────────────────────────────────────────────────
  const akar = anak.get(null) ?? []
  const gantung = u.filter((x) => x.parent_id !== null && !byId.has(x.parent_id))
  const dalam = new Map<number, number>()
  for (const x of u) {
    let d = 0
    let cur: number | null = x.id
    const lihat = new Set<number>()
    while (cur !== null && !lihat.has(cur)) {
      lihat.add(cur)
      cur = byId.get(cur)?.parent_id ?? null
      d++
    }
    dalam.set(x.id, cur !== null ? -1 : d)
  }
  const siklus = [...dalam.entries()].filter(([, d]) => d === -1)
  console.log('── KEUTUHAN')
  console.log(`  akar (parent NULL) : ${akar.length}${akar.length === 1 ? ' ✓' : '  ← harus 1'}`)
  for (const a of akar) console.log(`     ${a.kode_unit} — ${a.nama_unit}`)
  console.log(`  parent menggantung : ${gantung.length}${gantung.length === 0 ? ' ✓' : ''}`)
  for (const g of gantung) console.log(`     ✗ ${g.nama_unit} → parent ${g.parent_id}`)
  console.log(`  siklus             : ${siklus.length}${siklus.length === 0 ? ' ✓' : ''}`)
  for (const [id] of siklus) console.log(`     ✗ ${byId.get(id)?.nama_unit}`)

  // ── 2. Acuan vs master ─────────────────────────────────────────────────────
  const adaDiMaster = new Set(u.map((x) => kunciUnit(x.nama_unit)))
  const refHilang = [...unitRef].filter((k) => !adaDiMaster.has(k))
  const luarAcuan = u.filter((x) => !unitRef.has(kunciUnit(x.nama_unit)))
  console.log(`\n── ACUAN vs MASTER`)
  console.log(`  unit acuan tidak ada di master : ${refHilang.length}${refHilang.length === 0 ? ' ✓' : ''}`)
  for (const k of refHilang) console.log(`     ✗ ${k}`)
  console.log(`  unit master DI LUAR acuan      : ${luarAcuan.length}`)
  for (const x of luarAcuan) {
    console.log(
      `     · ${x.nama_unit}  (${x.kode_unit} · ${x.jenis} · jab ${x.jab} · peg ${x.peg})` +
        `${x.peg === 0 && x.jab === 0 ? '   ← kosong sama sekali' : ''}`,
    )
  }
  console.log(
    '     TIDAK dihapus skrip ini. Sebagian memang struktur DJBK yang daftar ini tidak\n' +
      '     memuat (mis. Subdirektorat & Bagian, yang di acuan muncul sebagai JABATAN,\n' +
      '     bukan unit). Menghapus unit mengaskade ke jabatan lalu ke match_score.',
  )

  // ── 3. Induk yang mencurigakan ─────────────────────────────────────────────
  console.log(`\n── INDUK MENCURIGAKAN`)
  const curiga = u.filter((x) => {
    if (x.parent_id === null) return false
    const p = byId.get(x.parent_id)
    if (!p) return false
    // Anak dari unit yang TIDAK ada di acuan, padahal anaknya sendiri berisi.
    return !unitRef.has(kunciUnit(p.nama_unit)) && x.jab > 0
  })
  console.log(`  unit BERISI yang induknya di luar acuan : ${curiga.length}`)
  for (const x of curiga) {
    console.log(`     ✗ ${x.nama_unit} (jab ${x.jab})\n          induk: ${byId.get(x.parent_id!)?.nama_unit}`)
  }
  const yatimAcuan = u.filter(
    (x) => unitRef.has(kunciUnit(x.nama_unit)) && (anak.get(x.id) ?? []).length === 0 && x.jenis === 'DIREKTORAT',
  )
  console.log(`  Direktorat versi acuan TANPA anak      : ${yatimAcuan.length}`)
  for (const x of yatimAcuan) console.log(`     · ${x.nama_unit} (peg ${x.peg})`)

  // ── 3b. REDUNDANSI & jabatan terparkir di akar ─────────────────────────────
  //
  // Ditambahkan 24 Agu 2026 setelah user melaporkan "ada yang redundan, sama
  // treenya ada yang blm pas". Temuan-temuan di bawah sebelumnya hanya terlihat
  // kalau seseorang membaca pohonnya baris per baris — sekarang ia satu perintah.
  console.log(`\n── JABATAN TERPARKIR DI AKAR`)
  const akarUnit = akar[0]
  if (akarUnit) {
    /*
      Jabatan di unit AKAR yang eselonnya BUKAN I (atau fungsional) hampir selalu
      salah tempat: akar adalah Ditjen, dan satu-satunya jabatan struktural yang
      memang miliknya adalah Direktur Jenderal.

      Ini terjadi karena `--samakan-acuan` memindahkan jabatan dari unit non-acuan
      ke leluhur acuan terdekat, dan untuk unit yang induknya langsung DJBK
      (mis. `DIT-KSP`, `BJKW-MDN`) leluhur itu ya DJBK sendiri. Jadi
      "Kepala Balai Jasa Konstruksi Wilayah I Medan" kini tampil sebagai jabatan
      milik Direktorat Jenderal — bukan galat, tapi jelas salah dibaca.
    */
    const parkir = await kueri<{
      kode_jabatan: string
      nama_jabatan: string
      eselon: string
      peg: number
      riw: number
      tgt: number
    }>(
      `SELECT j.kode_jabatan, j.nama_jabatan, j.eselon,
              (SELECT COUNT(*) FROM pegawai p WHERE p.jabatan_id = j.id)                 AS peg,
              (SELECT COUNT(*) FROM riwayat_jabatan r WHERE r.jabatan_id = j.id)          AS riw,
              (SELECT COUNT(*) FROM jabatan_target_anggota a WHERE a.jabatan_id = j.id)   AS tgt
         FROM jabatan j
        WHERE j.unit_organisasi_id = ? AND j.eselon <> 'I'
        ORDER BY FIELD(j.eselon,'II','III','IV','NON_ESELON'), j.nama_jabatan`,
      [akarUnit.id],
    )
    console.log(`  ${parkir.length} jabatan bukan-eselon-I menempel di ${akarUnit.nama_unit}`)
    for (const j of parkir) {
      const ikat = [j.peg > 0 ? `${j.peg} penghuni` : '', j.riw > 0 ? `${j.riw} riwayat` : '', j.tgt > 0 ? `${j.tgt} anggota target` : '']
        .filter(Boolean)
        .join(' · ')
      console.log(`     [${j.eselon}] ${j.nama_jabatan.slice(0, 54)} <${j.kode_jabatan}>${ikat ? ` — ${ikat}` : ' — tanpa pengikat'}`)
    }
    if (parkir.length > 0) {
      console.log(
        '     TIDAK dipindah otomatis: tujuan yang benar bergantung Direktorat mana yang\n' +
          '     mewarisi fungsinya, dan itu tidak ada di berkas acuan. Yang berpengikat\n' +
          '     (penghuni/riwayat/anggota target) juga tidak boleh dihapus begitu saja.',
      )
    }
  }

  /*
    Redundansi dideteksi sebagai HIMPUNAN BAGIAN, bukan ambang kemiripan persen.

    Versi pertama memakai irisan kata ≥85% dan melaporkan **108 pasangan** — di
    antaranya "Wilayah Maluku Utara" vs "Wilayah Sumatera Utara", yang beda satu
    kata dan sama sekali bukan duplikat. Itu kebisingan, dan penjaga yang berteriak
    108 kali akan diabaikan; lalu redundansi sungguhan ikut terabaikan bersamanya
    (pelajaran yang sama dengan `_audit-rbac.mjs`).

    Kemiripan tinggi antar-Balai adalah SIFAT datanya — 34 BP2JK memang berbagi
    enam kata dari tujuh. Yang benar-benar mencurigakan adalah ketika nama satu
    unit merupakan **himpunan bagian sejati** dari nama unit lain: "…Wilayah
    Maluku" di dalam "…Wilayah Maluku Utara" bisa jadi dua unit sah, tapi ia juga
    bentuk yang paling mungkin lahir dari satu unit yang diketik dua kali dengan
    kelengkapan berbeda. Itu daftar pendek yang layak dibaca manusia.
  */
  console.log(`\n── NAMA UNIT YANG SALING TERKANDUNG (kandidat redundansi)`)
  const kataNama = (t: string) =>
    new Set(norm(t).split(' ').filter((w) => w.length > 2 && !['dan', 'yang'].includes(w)))
  const mirip: string[] = []
  for (let i = 0; i < u.length; i++) {
    for (let j = i + 1; j < u.length; j++) {
      const A = kataNama(u[i]!.nama_unit)
      const B = kataNama(u[j]!.nama_unit)
      const aDalamB = [...A].every((w) => B.has(w))
      const bDalamA = [...B].every((w) => A.has(w))
      if (!aDalamB && !bDalamA) continue
      const [kecil, besar] = aDalamB ? [u[i]!, u[j]!] : [u[j]!, u[i]!]
      mirip.push(
        `"${kecil.nama_unit}" <${kecil.kode_unit}> jab ${kecil.jab} peg ${kecil.peg}\n` +
          `         seluruh katanya ada di "${besar.nama_unit}" <${besar.kode_unit}> jab ${besar.jab} peg ${besar.peg}`,
      )
    }
  }
  console.log(`  ${mirip.length} pasangan`)
  for (const m of mirip) console.log(`     ${m}`)
  if (mirip.length > 0) {
    console.log(
      '     Belum tentu duplikat — periksa manusia. Yang dilaporkan hanya bentuk yang\n' +
        '     paling mungkin lahir dari satu unit yang diketik dua kali.',
    )
  }

  /*
    JABATAN GANDA di satu unit — di sinilah redundansi sebenarnya berada.

    Pemeriksaan nama UNIT di atas menghasilkan nol duplikat sejati; yang benar-benar
    kembar adalah JABATAN. Dua sumber menamai kursi yang sama dengan cara berbeda:
    impor Excel memakai nama berimbuhan wilayah ("Kepala Balai Pelaksana Pemilihan
    Jasa Konstruksi Wilayah Sumatera Selatan") sementara daftar struktural resmi
    memakai nama pendek ("Kepala Balai Pelaksana Pemilihan Jasa Konstruksi"). Karena
    NAMANYA berbeda, pemeriksaan pasangan (nama, unit) melaporkan nol tumpang-tindih
    — padahal satu unit jadi punya dua Kepala Balai.

    Dilaporkan, tidak dibereskan: menggabungkan dua jabatan berarti mengalihkan
    pegawai, riwayat, dan anggota jabatan target lalu menghapus satu, dan memilih
    nama mana yang resmi adalah keputusan pemilik proses.
  */
  console.log(`\n── JABATAN KEMBAR DALAM SATU UNIT (nama saling terkandung)`)
  /*
    Dideteksi sebagai HIMPUNAN BAGIAN, bukan "lebih dari satu jabatan pada eselon
    yang sama" — dan itu koreksi atas percobaan pertama.

    Versi pertama melaporkan tiap (unit, eselon) yang punya >1 jabatan, dan
    menghasilkan 32 temuan yang sebagian besar NORMAL: satu Direktorat memang punya
    empat Subdirektorat, semuanya eselon III. Yang benar-benar kembar hanya pasangan
    yang salah satu namanya termuat seluruhnya di nama yang lain — mis. "Kepala
    Balai Pelaksana Pemilihan Jasa Konstruksi" di dalam "…Wilayah Sumatera Selatan",
    atau "Kepala Sub Direktorat Kelembagaan" di dalam "Kepala Subdirektorat
    Kelembagaan dan Sumber Daya Konstruksi".

    Ini KETIGA kalinya di sesi yang sama ambang-kemiripan-persen harus diganti
    aturan himpunan: `samaUnit()` 85% menempelkan 56 jabatan ke unit salah,
    pemeriksa nama unit 85% berteriak 108 kali, dan yang ini 32 kali. Polanya
    layak diingat: **kemiripan persen cocok untuk MENGUSULKAN, tidak untuk
    MELAPORKAN temuan yang harus ditindak** — daftar temuan yang sebagian besarnya
    normal akan berhenti dibaca.
  */
  const semuaJab = await kueri<{
    unit_id: number
    nama_unit: string
    kode_jabatan: string
    nama_jabatan: string
    eselon: string
    peg: number
    tgt: number
    riw: number
  }>(
    `SELECT j.unit_organisasi_id AS unit_id, u.nama_unit, j.kode_jabatan, j.nama_jabatan, j.eselon,
            (SELECT COUNT(*) FROM pegawai p WHERE p.jabatan_id = j.id)               AS peg,
            (SELECT COUNT(*) FROM jabatan_target_anggota a WHERE a.jabatan_id = j.id) AS tgt,
            (SELECT COUNT(*) FROM riwayat_jabatan r WHERE r.jabatan_id = j.id)        AS riw
       FROM jabatan j
       JOIN unit_organisasi u ON u.id = j.unit_organisasi_id
      WHERE j.status_jabatan <> 'DIHAPUS'`,
  )
  /*
    Fungsional (NON_ESELON) IKUT diperiksa.

    Versi pertama mengecualikannya, dan karena itu melewatkan pasangan yang nyata:
    "Pembina Jasa Konstruksi Ahli Madya" dan "Pembina Jasa Konstruksi Ahli Madya
    (Bina Kompetensi)" duduk di unit yang sama dengan nama yang satu termuat di
    yang lain. Pengecualian itu masuk akal untuk pemeriksa "lebih dari satu jabatan
    pada eselon sama" (satu unit memang punya banyak fungsional), tapi aturan
    HIMPUNAN tidak punya masalah itu — ia hanya menyoroti nama yang saling
    terkandung.
  */
  const jabPerUnit = new Map<number, typeof semuaJab>()
  for (const j of semuaJab) {
    if (!jabPerUnit.has(j.unit_id)) jabPerUnit.set(j.unit_id, [])
    jabPerUnit.get(j.unit_id)!.push(j)
  }
  const kataJab = (t: string) =>
    new Set(norm(t).split(' ').filter((w) => w.length > 2 && !['dan', 'yang'].includes(w)))
  const kembar: string[] = []
  for (const daftar of jabPerUnit.values()) {
    for (let a = 0; a < daftar.length; a++) {
      for (let b = a + 1; b < daftar.length; b++) {
        const A = kataJab(daftar[a]!.nama_jabatan)
        const B = kataJab(daftar[b]!.nama_jabatan)
        const aDalamB = [...A].every((w) => B.has(w))
        const bDalamA = [...B].every((w) => A.has(w))
        if (!aDalamB && !bDalamA) continue
        const [kecil, besar] = aDalamB ? [daftar[a]!, daftar[b]!] : [daftar[b]!, daftar[a]!]
        const ikat = (x: (typeof semuaJab)[number]) =>
          [x.peg > 0 ? `${x.peg} penghuni` : '', x.tgt > 0 ? `${x.tgt} target` : '', x.riw > 0 ? `${x.riw} riwayat` : '']
            .filter(Boolean)
            .join(' · ') || 'tanpa pengikat'
        kembar.push(
          `${kecil.nama_unit.slice(0, 46)}\n` +
            `          "${kecil.nama_jabatan.slice(0, 62)}" <${kecil.kode_jabatan}> — ${ikat(kecil)}\n` +
            `          "${besar.nama_jabatan.slice(0, 62)}" <${besar.kode_jabatan}> — ${ikat(besar)}`,
        )
      }
    }
  }
  console.log(`  ${kembar.length} pasangan`)
  for (const k of kembar.slice(0, 8)) console.log(`     ${k}`)
  if (kembar.length > 8) console.log(`     … dan ${kembar.length - 8} lainnya`)
  if (kembar.length > 0) {
    console.log(
      '     Pasangan yang KEDUA sisinya berpengikat tidak bisa dibereskan skrip ini:\n' +
        '     menggabungkannya berarti mengalihkan pegawai/riwayat/anggota target lalu\n' +
        '     menghapus satu, dan memilih nama mana yang resmi keputusan pemilik proses.',
    )
  }

  /*
    `--hapus-kembar-aman` — hanya sisi yang NOL PENGIKAT dari pasangan kembar.

    Syaratnya tiga, dan ketiganya diperiksa di SQL bukan dipercayai: (a) ia bagian
    pasangan yang namanya saling terkandung di unit yang sama, (b) nol penghuni,
    nol anggota jabatan target, nol riwayat jabatan, dan (c) sisi PASANGANNYA masih
    ada sesudahnya — supaya kursinya tidak ikut hilang, hanya salinannya.

    Yang kedua sisinya berpengikat TIDAK disentuh. Itu 12 pasangan Kepala Balai,
    yang masing-masing sisinya kini jadi anggota jabatan target berbeda (satu di
    target generik, satu di target per-balai) — menghapus salah satunya melubangi
    salah satu daftar kandidat.
  */
  let kembarDihapus = 0
  if (HAPUS_KEMBAR) {
    const amanHapus: Array<{ kode: string; nama: string; unit: string }> = []
    for (const daftar of jabPerUnit.values()) {
      for (let a2 = 0; a2 < daftar.length; a2++) {
        for (let b2 = a2 + 1; b2 < daftar.length; b2++) {
          const A = kataJab(daftar[a2]!.nama_jabatan)
          const B = kataJab(daftar[b2]!.nama_jabatan)
          const aDalamB = [...A].every((w) => B.has(w))
          const bDalamA = [...B].every((w) => A.has(w))
          if (!aDalamB && !bDalamA) continue
          const [x, y] = aDalamB ? [daftar[a2]!, daftar[b2]!] : [daftar[b2]!, daftar[a2]!]
          // Yang dihapus hanya yang nol pengikat, dan pasangannya harus BERPENGIKAT
          // atau setidaknya tetap ada — jadi kursinya tidak lenyap.
          const nol = (z: typeof x) => Number(z.peg) + Number(z.tgt) + Number(z.riw) === 0
          if (nol(x) && !nol(y)) amanHapus.push({ kode: x.kode_jabatan, nama: x.nama_jabatan, unit: x.nama_unit })
          else if (nol(y) && !nol(x)) amanHapus.push({ kode: y.kode_jabatan, nama: y.nama_jabatan, unit: y.nama_unit })
        }
      }
    }
    /*
      PENJAGA: jangan hapus jabatan yang MASIH DIBUTUHKAN daftar acuan.

      Dua tujuan bisa bertabrakan di sini — "master tidak punya duplikat" dan
      "master memuat seluruh 123 pasangan acuan" — dan tabrakannya nyata: acuan
      menuliskan "Direktur Kompetensi dan Produktivitas **Konstruksi** Tenaga Kerja
      Konstruksi" (kata "Konstruksi" dua kali) sementara master memakai nama yang
      benar tanpa pengulangan. Keduanya kursi yang sama, tapi bagi pemeriksa
      pasangan mereka nama berbeda — jadi menghapus salinan acuan menurunkan
      kesesuaian dari 123/123 ke 122/123.

      Terukur: 6 dari 7 kandidat aman, 1 (`JAB-STR-003`) tertahan penjaga ini.
      Obatnya BUKAN menghapusnya diam-diam melainkan menambah alias nama jabatan
      di `rapikan-jabatan.ts` — keputusan yang harus terlihat, bukan efek samping
      pembersihan.
    */
    // Alias nama jabatan diimpor dari `rapikan-jabatan.ts` — SATU definisi. Kalau
    // ditulis ulang di sini, penjaga ini dan pemeriksa 123/123 bisa berselisih
    // tentang jabatan mana yang "diminta acuan".
    const { kunciJabatan } = await import('./rapikan-jabatan-alias')
    const refPasangan = new Map<string, number>()
    for (const r of ref) {
      const k = `${kunciJabatan(r.namaJabatan)}@@${kunciUnit(r.unitKerja)}`
      refPasangan.set(k, (refPasangan.get(k) ?? 0) + 1)
    }
    const punyaMasterKini = new Map<string, number>()
    for (const j of semuaJab) {
      const k = `${kunciJabatan(j.nama_jabatan)}@@${kunciUnit(j.nama_unit)}`
      punyaMasterKini.set(k, (punyaMasterKini.get(k) ?? 0) + 1)
    }
    const tertahanAcuan: string[] = []
    const bolehHapus = amanHapus.filter((z) => {
      const j = semuaJab.find((x) => x.kode_jabatan === z.kode)!
      const k = `${kunciJabatan(j.nama_jabatan)}@@${kunciUnit(j.nama_unit)}`
      const diminta = refPasangan.get(k) ?? 0
      if (diminta === 0) return true
      const sisa = (punyaMasterKini.get(k) ?? 0) - 1
      if (sisa >= diminta) return true
      tertahanAcuan.push(
        `${z.kode} — daftar acuan masih meminta "${j.nama_jabatan.slice(0, 46)}" di unit ini (sisa ${sisa} < ${diminta})`,
      )
      return false
    })
    const unik = [...new Map(bolehHapus.map((z) => [z.kode, z])).values()]
    if (tertahanAcuan.length > 0) {
      console.log(`\n     DITAHAN penjaga kesesuaian acuan: ${tertahanAcuan.length}`)
      for (const t of tertahanAcuan) console.log(`        · ${t}`)
      console.log(
        '        Obatnya menambah alias NAMA JABATAN di rapikan-jabatan.ts, bukan\n' +
          '        menghapusnya — supaya kesesuaian tetap 123/123 sekaligus duplikatnya hilang.',
      )
    }
    console.log(`\n── --hapus-kembar-aman: ${unik.length} jabatan nol-pengikat`)
    for (const z of unik) console.log(`     ${z.kode.padEnd(26)} "${z.nama.slice(0, 50)}" @ ${z.unit.slice(0, 34)}`)
    if (unik.length > 0 && TULIS) {
      for (const z of unik) {
        // Diperiksa ULANG di SQL sesaat sebelum menghapus — daftarnya dibaca di awal
        // dan sesuatu bisa berubah di antaranya.
        const [cek] = await kueri<{ n: number }>(
          `SELECT (SELECT COUNT(*) FROM pegawai p JOIN jabatan j ON j.id = p.jabatan_id WHERE j.kode_jabatan = ?)
                + (SELECT COUNT(*) FROM jabatan_target_anggota a JOIN jabatan j ON j.id = a.jabatan_id WHERE j.kode_jabatan = ?)
                + (SELECT COUNT(*) FROM riwayat_jabatan r JOIN jabatan j ON j.id = r.jabatan_id WHERE j.kode_jabatan = ?) AS n`,
          [z.kode, z.kode, z.kode],
        )
        if (Number(cek?.n ?? 1) > 0) {
          console.log(`     DITAHAN ${z.kode} — ternyata punya ${cek?.n} pengikat`)
          continue
        }
        await eksekusi('DELETE FROM jabatan WHERE kode_jabatan = ?', [z.kode])
        kembarDihapus++
      }
      console.log(`     ${kembarDihapus} dihapus`)
    } else if (unik.length > 0) {
      console.log('     Kering — tambahkan `--tulis` untuk benar-benar menghapus.')
    }
  }

  let jabDipindah = 0
  let jabDihapus = 0
  if (RAPIKAN_PARKIR) {
    console.log(`\n── --rapikan-terparkir`)
    for (const r of PINDAH_JABATAN) {
      const tujuan = byKode.get(r.keUnit)
      const [j] = await kueri<{ id: number; nama_jabatan: string; unit_organisasi_id: number }>(
        'SELECT id, nama_jabatan, unit_organisasi_id FROM jabatan WHERE kode_jabatan = ?',
        [r.kode],
      )
      if (!j) { console.log(`     dilewati ${r.kode} — tidak ada di master`); continue }
      if (!tujuan) { console.log(`     dilewati ${r.kode} — unit tujuan ${r.keUnit} tidak ada`); continue }
      if (Number(j.unit_organisasi_id) === tujuan.id) { console.log(`     dilewati ${r.kode} — sudah di ${r.keUnit}`); continue }
      console.log(`     PINDAH ${r.kode} "${j.nama_jabatan.slice(0, 44)}" → ${tujuan.nama_unit}`)
      console.log(`        sebab: ${r.alasan.slice(0, 150)}`)
      if (TULIS) {
        await eksekusi('UPDATE jabatan SET unit_organisasi_id = ? WHERE id = ?', [tujuan.id, j.id])
        jabDipindah++
      }
    }
    for (const r of HAPUS_JABATAN) {
      // Nol pengikat diperiksa di SQL, bukan dipercayai dari daftar di atas.
      const [cek] = await kueri<{ ada: number; n: number }>(
        `SELECT (SELECT COUNT(*) FROM jabatan WHERE kode_jabatan = ?) AS ada,
                (SELECT COUNT(*) FROM pegawai p JOIN jabatan j ON j.id = p.jabatan_id WHERE j.kode_jabatan = ?)
              + (SELECT COUNT(*) FROM jabatan_target_anggota a JOIN jabatan j ON j.id = a.jabatan_id WHERE j.kode_jabatan = ?)
              + (SELECT COUNT(*) FROM riwayat_jabatan rj JOIN jabatan j ON j.id = rj.jabatan_id WHERE j.kode_jabatan = ?) AS n`,
        [r.kode, r.kode, r.kode, r.kode],
      )
      if (Number(cek?.ada ?? 0) === 0) { console.log(`     dilewati ${r.kode} — tidak ada di master`); continue }
      if (Number(cek?.n ?? 1) > 0) {
        console.log(`     DITAHAN ${r.kode} — punya ${cek?.n} pengikat, tidak lagi aman dihapus`)
        continue
      }
      console.log(`     HAPUS ${r.kode} — ${r.alasan.slice(0, 120)}`)
      if (TULIS) {
        await eksekusi('DELETE FROM jabatan WHERE kode_jabatan = ?', [r.kode])
        jabDihapus++
      }
    }
    if (!TULIS) console.log('     Kering — tambahkan `--tulis` untuk menerapkan.')
    else console.log(`     ${jabDipindah} dipindah · ${jabDihapus} dihapus`)
  }

  /*
    `--gabungkan-kembar` — MENGGABUNGKAN pasangan kembar, bukan menghapus salah satu.

    Pasangan yang kedua sisinya berpengikat tidak bisa dihapus (`--hapus-kembar-aman`
    menahannya), tapi ia BISA digabung: dependennya dialihkan ke jabatan yang
    bertahan, lalu yang kalah dihapus. Bedanya penting — menghapus melubangi
    jabatan target yang memuatnya, menggabungkan tidak.

    ## Syarat kelayakan, dan kenapa seketat ini

    Hanya pasangan yang:
      1. kedua sisinya **nol penghuni DAN nol riwayat jabatan** — kalau ada riwayat,
         menggabungkan berarti menulis ulang sejarah karier seseorang, dan itu bukan
         kerapian melainkan perubahan data;
      2. **tepat satu** sisinya memenuhi pasangan acuan — itu yang jadi PEMENANG,
         sehingga kesesuaian 123/123 terjaga dengan sendirinya. Kalau keduanya
         memenuhi acuan, atau tidak satu pun, tidak ada dasar objektif memilih dan
         pasangannya dilewati.

    Terukur pada 24 Agu 2026: 5 dari 7 pasangan lolos syarat (kelimanya Kepala Balai
    BP2JK). Dua yang dilewati adalah `Kepala Subdirektorat Pengadaan` — placeholder
    seed yang jadi HIMPUNAN BAGIAN dari DUA Subdirektorat sungguhan sekaligus, jadi
    tidak ada satu pemenang; ia juga satu-satunya yang mewakili arm "Kasubdit Dit
    Pengadaan" di jabatan target generik #1, sehingga menghapusnya melubangi arm itu.

    ## Keanggotaan jabatan target dialihkan, tidak dibuang

    Kunci utama `jabatan_target_anggota` adalah (target, jabatan), jadi mengalihkan
    bisa bertabrakan kalau pemenang SUDAH jadi anggota target yang sama. Ditangani
    eksplisit: kalau sudah anggota → baris yang kalah dibuang (dedup); kalau belum →
    `jabatan_id`-nya diarahkan ke pemenang. Tanpa cabang itu, `UPDATE` gagal dengan
    galat kunci ganda di tengah transaksi.
  */
  let digabung = 0
  if (GABUNG_KEMBAR) {
    const { kunciJabatan: kj } = await import('./rapikan-jabatan-alias')
    const refPair = new Set(ref.map((r) => `${kj(r.namaJabatan)}@@${kunciUnit(r.unitKerja)}`))
    const isAcuan = (x: (typeof semuaJab)[number]) =>
      refPair.has(`${kj(x.nama_jabatan)}@@${kunciUnit(x.nama_unit)}`)

    console.log(`\n── --gabungkan-kembar`)
    const dilewatiGabung: string[] = []
    for (const daftar of jabPerUnit.values()) {
      for (let a2 = 0; a2 < daftar.length; a2++) {
        for (let b2 = a2 + 1; b2 < daftar.length; b2++) {
          const x = daftar[a2]!
          const y = daftar[b2]!
          const A = kataJab(x.nama_jabatan)
          const B = kataJab(y.nama_jabatan)
          if (![...A].every((w) => B.has(w)) && ![...B].every((w) => A.has(w))) continue

          const berjejak = (z: typeof x) => Number(z.peg) > 0 || Number(z.riw) > 0
          if (berjejak(x) || berjejak(y)) {
            dilewatiGabung.push(
              `${x.kode_jabatan} + ${y.kode_jabatan} — ada penghuni/riwayat, menggabungkan berarti menulis ulang sejarah karier`,
            )
            continue
          }
          const acuanX = isAcuan(x)
          const acuanY = isAcuan(y)
          if (acuanX === acuanY) {
            dilewatiGabung.push(
              `${x.kode_jabatan} + ${y.kode_jabatan} — ${acuanX ? 'KEDUANYA' : 'tidak satu pun'} memenuhi pasangan acuan, tidak ada dasar memilih pemenang`,
            )
            continue
          }
          const menang = acuanX ? x : y
          const kalah = acuanX ? y : x

          console.log(`     ${kalah.kode_jabatan} → ${menang.kode_jabatan}   @ ${menang.nama_unit.slice(0, 40)}`)
          console.log(`        bertahan : "${menang.nama_jabatan.slice(0, 60)}" (memenuhi acuan)`)
          console.log(`        dilebur  : "${kalah.nama_jabatan.slice(0, 60)}"`)
          if (!TULIS) continue

          const [idM] = await kueri<{ id: number }>('SELECT id FROM jabatan WHERE kode_jabatan = ?', [menang.kode_jabatan])
          const [idK] = await kueri<{ id: number }>('SELECT id FROM jabatan WHERE kode_jabatan = ?', [kalah.kode_jabatan])
          if (!idM || !idK) { console.log('        dilewati — salah satu sudah tidak ada'); continue }

          const anggota = await kueri<{ jabatan_target_id: number }>(
            'SELECT jabatan_target_id FROM jabatan_target_anggota WHERE jabatan_id = ?',
            [idK.id],
          )
          for (const ag of anggota) {
            const [sudah] = await kueri<{ n: number }>(
              'SELECT COUNT(*) AS n FROM jabatan_target_anggota WHERE jabatan_target_id = ? AND jabatan_id = ?',
              [ag.jabatan_target_id, idM.id],
            )
            if (Number(sudah?.n ?? 0) > 0) {
              await eksekusi(
                'DELETE FROM jabatan_target_anggota WHERE jabatan_target_id = ? AND jabatan_id = ?',
                [ag.jabatan_target_id, idK.id],
              )
              console.log(`        target #${ag.jabatan_target_id}: pemenang sudah anggota → baris kalah dibuang`)
            } else {
              await eksekusi(
                'UPDATE jabatan_target_anggota SET jabatan_id = ? WHERE jabatan_target_id = ? AND jabatan_id = ?',
                [idM.id, ag.jabatan_target_id, idK.id],
              )
              console.log(`        target #${ag.jabatan_target_id}: keanggotaan dialihkan ke pemenang`)
            }
          }
          await eksekusi('DELETE FROM jabatan WHERE id = ?', [idK.id])
          digabung++
        }
      }
    }
    for (const d of dilewatiGabung) console.log(`     dilewati: ${d}`)
    if (!TULIS) console.log('     Kering — tambahkan `--tulis` untuk menerapkan.')
    else console.log(`     ${digabung} pasangan digabung`)
  }

  console.log(`\n── KONSISTENSI kode_unit per jenis`)
  const polaPerJenis = new Map<string, Set<string>>()
  for (const x of u) {
    const pola = x.kode_unit.replace(/[A-Z0-9]+$/, '#').replace(/-[A-Z0-9]+(-[A-Z0-9]+)*$/, '-#')
    if (!polaPerJenis.has(x.jenis)) polaPerJenis.set(x.jenis, new Set())
    polaPerJenis.get(x.jenis)!.add(pola)
  }
  for (const [j, pola] of polaPerJenis) {
    console.log(`  ${j.padEnd(12)} ${pola.size} pola: ${[...pola].join(' · ')}`)
  }
  /*
    Hanya DILAPORKAN, tidak ditawarkan untuk distandarkan — dan itu kesimpulan
    yang berubah setelah diukur.

    Mode `--standarkan-kode` sempat ditulis: ia menurunkan kode "ideal" dari nama
    unit memakai `kodeUnitUnik()` yang sama dengan importir. Hasilnya justru LEBIH
    BURUK untuk kode yang dipilih manusia: `SET-DJBK` → `SET`, `BP2JK-DIY` →
    `BP2JK-YOGYAKARTA` (kehilangan "D.I."), `BJKW-MKS` → `BALAI-VI-MAKASSAR`. Jadi
    ketidakseragamannya kosmetik dan menyeragamkannya menukar singkatan yang enak
    dibaca dengan yang mekanis.

    `kode_unit` juga TIDAK dirujuk literal oleh kode aplikasi mana pun kecuali
    `'DJBK'` — diperiksa, dan yang dipaku di skrip & uji semuanya `kode_jabatan`.
    Jadi ia tidak punya konsekuensi fungsional, hanya tampilan di Master Unit.
    Mengubah 13 kode demi keseragaman berarti mengubah data yang dilihat orang
    tanpa memperbaiki apa pun.
  */
  console.log(
    '  Ketidakseragaman ini KOSMETIK dan sengaja tidak diseragamkan: kode "ideal"\n' +
      '  hasil turunan nama justru lebih buruk (SET-DJBK → SET, BP2JK-DIY kehilangan\n' +
      '  "D.I."), dan kode_unit tidak dirujuk literal kode mana pun selain DJBK.',
  )

  console.log(`\n── BENTUK POHON`)
  const anakAkar = (anak.get(akarUnit?.id ?? -1) ?? []).length
  console.log(`  anak langsung akar : ${anakAkar} dari ${u.length - 1} unit non-akar`)
  if (anakAkar === u.length - 1) {
    console.log(
      '     Pohonnya RATA — seluruh unit jadi anak langsung Ditjen. Itu akibat langsung\n' +
        '     `--samakan-acuan`: berkas acuan memuat 49 unit tanpa menyatakan hubungan\n' +
        '     induk-anak, jadi lapisan Subdirektorat/Bagian ikut terhapus. Kalau struktur\n' +
        '     yang diinginkan berlapis (mis. BP2JK di bawah Direktorat Pengadaan), itu\n' +
        '     keputusan pemilik proses — tidak bisa diturunkan dari berkas acuan.',
    )
  }

  // ── 4. level_eselon vs kedalaman ───────────────────────────────────────────
  const eselonAneh = u.filter((x) => {
    const d = dalam.get(x.id)!
    return d > 0 && x.level_eselon !== null && x.level_eselon !== d
  })
  console.log(`\n── level_eselon vs kedalaman: ${eselonAneh.length} tidak sejalan`)
  for (const x of eselonAneh.slice(0, 12))
    console.log(`     · ${x.nama_unit} — es${x.level_eselon}, kedalaman ${dalam.get(x.id)}`)
  if (eselonAneh.length > 12) console.log(`     … dan ${eselonAneh.length - 12} lainnya`)
  console.log(
    '     Ini WAJAR untuk Balai & BP2JK: keduanya UPT eselon 3 yang bergantung langsung\n' +
      '     pada Ditjen, jadi kedalamannya 2 sementara eselonnya 3. Yang perlu diperiksa\n' +
      '     hanya kalau sebuah Subdirektorat/Bagian muncul di kedalaman 2.',
  )

  // ── 5. Rencana pemindahan ──────────────────────────────────────────────────
  const rencana: Array<{ anak: BarisUnit; indukBaru: BarisUnit; alasan: string }> = []
  const dilewati: string[] = []
  for (const p of PINDAH) {
    const a = byKode.get(p.anak)
    const b = byKode.get(p.indukBaru)
    if (!a) { dilewati.push(`${p.anak} — kode unit anak tidak ada di master`); continue }
    if (!b) { dilewati.push(`${p.indukBaru} — kode unit induk baru tidak ada di master`); continue }
    if (a.parent_id === b.id) { dilewati.push(`${p.anak} — induknya sudah ${p.indukBaru}`); continue }
    // Jangan membuat siklus: induk baru tidak boleh keturunan si anak.
    let cur: number | null = b.id
    let lingkar = false
    const lihat = new Set<number>()
    while (cur !== null && !lihat.has(cur)) {
      if (cur === a.id) { lingkar = true; break }
      lihat.add(cur)
      cur = byId.get(cur)?.parent_id ?? null
    }
    if (lingkar) { dilewati.push(`${p.anak} → ${p.indukBaru} DITOLAK: akan membuat siklus`); continue }
    rencana.push({ anak: a, indukBaru: b, alasan: p.alasan })
  }

  console.log(`\n── RENCANA PEMINDAHAN INDUK: ${rencana.length}${PINDAHKAN ? '' : '  (butuh --pindahkan)'}`)
  for (const r of rencana) {
    console.log(`     ${r.anak.nama_unit}  (peg ${r.anak.peg})`)
    console.log(`        dari : ${byId.get(r.anak.parent_id!)?.nama_unit ?? '(akar)'}`)
    console.log(`        ke   : ${r.indukBaru.nama_unit}`)
    console.log(`        sebab: ${r.alasan}`)
  }
  for (const d of dilewati) console.log(`     · dilewati: ${d}`)
  const bergeser = rencana.filter((r) => r.anak.peg > 0)
  if (bergeser.length > 0) {
    console.log(
      `\n     ⚠ ${bergeser.length} unit yang dipindah PUNYA PEGAWAI. Karena SUBKUERI_UNIT_TURUNAN\n` +
        '       rekursif, penyaring unit & lingkup Pengelola Unit akan ikut berubah.',
    )
  } else if (rencana.length > 0) {
    console.log('\n     Semua unit yang dipindah NOL pegawai aktif → populasi tiap penyaring tidak bergeser.')
  }

  /*
    `--samakan-acuan` membuat pohon berisi TEPAT unit yang ada di berkas acuan.

    Permintaan pemilik proses 24 Agu 2026: *"tree nya samain kaya yang ada di excel
    aja"*. Di berkas resmi, Subdirektorat & Bagian muncul sebagai **JABATAN** di
    bawah Direktorat/Sekretariat — bukan sebagai unit sendiri. DB memakai kedua
    model sekaligus, dan itulah yang membuat pohonnya terbaca tidak konsisten:
    sebagian Subdirektorat punya simpul sendiri, sebagian lain hanya jabatan.

    ## Aturannya DITURUNKAN, bukan ditebak

    Tiap jabatan di unit non-acuan dipindahkan ke **leluhur terdekat yang ADA di
    acuan** — rantai `parent_id` sudah menyatakan tujuannya, jadi tidak ada
    kemiripan nama yang perlu ditafsirkan. Sesudah unitnya kosong ia dihapus,
    dari yang TERDALAM lebih dulu supaya tidak pernah ada anak yang kehilangan
    induk di tengah jalan.

    ## Empat pengaman, dan tiga di antaranya lahir dari kejadian nyata

    1. **Bentrok nama diperiksa lebih dulu.** Kalau unit tujuan sudah punya jabatan
       senama, itu bukan pemindahan melainkan penggabungan — dan penggabungan yang
       tidak disadari menumpuk jabatan, persis bug `samaUnit()` 85%. Kalau ada satu
       saja, SELURUH langkah dibatalkan; menggabungkan menuntut keputusan tentang
       baris mana yang bertahan dan ke mana dependennya dialihkan.
    2. **`users.unit_organisasi_id` ikut dialihkan.** FK-nya `ON DELETE SET NULL`,
       jadi menghapus unit akan MENGOSONGKAN lingkup pengguna tanpa jejak — dan
       `lib/lingkup.ts` gagal-tertutup, sehingga Pengelola Unit tanpa unit tidak
       melihat apa pun. Terukur: `martyanti.rbs` berlingkup `BAG-KEPEG`.
    3. **Unit hanya dihapus kalau benar-benar kosong** — 0 jabatan, 0 anak, 0
       pengguna — diperiksa ulang SESUDAH pemindahan, bukan diasumsikan.
    4. **Dependen jabatan tidak disentuh sama sekali.** `pegawai.jabatan_id`,
       `jabatan_target_anggota`, dan `riwayat_jabatan` menunjuk JABATAN, bukan unit,
       jadi memindahkan jabatan mempertahankan semuanya. Itu sebabnya jalur ini
       memindahkan jabatan alih-alih menghapusnya.
  */
  if (SAMAKAN) {
    const jab = await kueri<{
      id: number
      kode_jabatan: string
      nama_jabatan: string
      unit_organisasi_id: number
    }>('SELECT id, kode_jabatan, nama_jabatan, unit_organisasi_id FROM jabatan')
    const jabPerUnit = new Map<number, typeof jab>()
    for (const j of jab) {
      if (!jabPerUnit.has(j.unit_organisasi_id)) jabPerUnit.set(j.unit_organisasi_id, [])
      jabPerUnit.get(j.unit_organisasi_id)!.push(j)
    }
    const pengguna = await kueri<{ id: number; username: string; unit_organisasi_id: number }>(
      'SELECT id, username, unit_organisasi_id FROM users WHERE unit_organisasi_id IS NOT NULL',
    )

    const leluhurAcuan = (x: BarisUnit): BarisUnit | null => {
      let cur = x.parent_id
      while (cur !== null) {
        const par = byId.get(cur)
        if (!par) return null
        if (unitRef.has(kunciUnit(par.nama_unit))) return par
        cur = par.parent_id
      }
      return null
    }

    const pindahJab: Array<{ id: number; kode: string; nama: string; dari: BarisUnit; ke: BarisUnit }> = []
    const pindahUser: Array<{ id: number; username: string; dari: BarisUnit; ke: BarisUnit }> = []
    const bentrok: string[] = []
    const yatim: string[] = []

    for (const x of luarAcuan) {
      const t = leluhurAcuan(x)
      if (!t) {
        yatim.push(`${x.kode_unit} — tidak punya leluhur yang ada di acuan`)
        continue
      }
      for (const j of jabPerUnit.get(x.id) ?? []) {
        const senama = (jabPerUnit.get(t.id) ?? []).filter(
          (k) => norm(k.nama_jabatan) === norm(j.nama_jabatan),
        )
        if (senama.length > 0) {
          bentrok.push(
            `${j.nama_jabatan} <${j.kode_jabatan}> dari ${x.kode_unit} → ${t.kode_unit}, ` +
              `sudah ada di sana: ${senama.map((a) => a.kode_jabatan).join(', ')}`,
          )
          continue
        }
        pindahJab.push({ id: j.id, kode: j.kode_jabatan, nama: j.nama_jabatan, dari: x, ke: t })
      }
      for (const g of pengguna.filter((g) => g.unit_organisasi_id === x.id)) {
        pindahUser.push({ id: g.id, username: g.username, dari: x, ke: t })
      }
    }

    console.log(`\n── --samakan-acuan: POHON = TEPAT ${unitRef.size} UNIT ACUAN`)
    console.log(`  unit non-acuan yang akan dihapus : ${luarAcuan.length - yatim.length}`)
    console.log(`  jabatan dipindah ke leluhur acuan: ${pindahJab.length}`)
    console.log(`  lingkup pengguna dialihkan       : ${pindahUser.length}`)
    for (const g of pindahUser)
      console.log(`     · ${g.username}: ${g.dari.nama_unit} → ${g.ke.nama_unit}`)
    console.log(`  BENTROK nama (menggagalkan)      : ${bentrok.length}`)
    for (const b of bentrok) console.log(`     ✗ ${b}`)
    console.log(`  tanpa leluhur acuan (dilewati)   : ${yatim.length}`)
    for (const y of yatim) console.log(`     · ${y}`)

    const perTujuan = new Map<string, number>()
    for (const j of pindahJab) perTujuan.set(j.ke.nama_unit, (perTujuan.get(j.ke.nama_unit) ?? 0) + 1)
    console.log('  sebaran jabatan yang dipindah:')
    for (const [k, n] of [...perTujuan.entries()].sort((a, b) => b[1] - a[1]))
      console.log(`     ${String(n).padStart(3)} → ${k}`)

    if (bentrok.length > 0) {
      console.log(
        '\n  DIBATALKAN: ada bentrok nama. Menggabungkan dua jabatan senama menuntut\n' +
          '  keputusan baris mana yang bertahan dan ke mana pegawai/anggota target/riwayatnya\n' +
          '  dialihkan — itu bukan keputusan skrip.\n',
      )
      process.exit(1)
    }
    if (!TULIS) {
      console.log('\n  Kering — tidak ada yang ditulis. Tambahkan `--tulis`.\n')
      process.exit(0)
    }

    for (const j of pindahJab) {
      await eksekusi('UPDATE jabatan SET unit_organisasi_id = ? WHERE id = ?', [j.ke.id, j.id])
    }
    for (const g of pindahUser) {
      await eksekusi('UPDATE users SET unit_organisasi_id = ? WHERE id = ?', [g.ke.id, g.id])
    }

    // Hapus TERDALAM lebih dulu: unit yang masih punya anak tidak boleh hilang.
    const urutHapus = luarAcuan
      .filter((x) => !yatim.some((y) => y.startsWith(x.kode_unit)))
      .sort((a, b) => (dalam.get(b.id) ?? 0) - (dalam.get(a.id) ?? 0))
    let unitDihapus = 0
    const ditahan: string[] = []
    for (const x of urutHapus) {
      const [sisa] = await kueri<{ jab: number; anak: number; usr: number }>(
        `SELECT (SELECT COUNT(*) FROM jabatan WHERE unit_organisasi_id = ?)        AS jab,
                (SELECT COUNT(*) FROM unit_organisasi WHERE parent_id = ?)          AS anak,
                (SELECT COUNT(*) FROM users WHERE unit_organisasi_id = ?)           AS usr`,
        [x.id, x.id, x.id],
      )
      if (!sisa || Number(sisa.jab) + Number(sisa.anak) + Number(sisa.usr) > 0) {
        ditahan.push(
          `${x.kode_unit} — masih ada ${sisa?.jab ?? '?'} jabatan · ${sisa?.anak ?? '?'} anak · ${sisa?.usr ?? '?'} pengguna`,
        )
        continue
      }
      await eksekusi('DELETE FROM unit_organisasi WHERE id = ?', [x.id])
      unitDihapus++
    }

    await eksekusi(
      `INSERT INTO audit_log (user_id, aksi, entitas, entitas_id, data_sebelum, data_sesudah, ip_address, created_at)
       VALUES (1, 'UBAH_MASSAL', 'unit_organisasi', NULL, CAST(? AS JSON), CAST(? AS JSON), '::1', NOW())`,
      [
        JSON.stringify({
          unitDihapus: urutHapus.map((x) => ({ kode: x.kode_unit, nama: x.nama_unit, parent: x.parent_id })),
          jabatanDipindah: pindahJab.map((j) => ({ kode: j.kode, dari: j.dari.kode_unit, ke: j.ke.kode_unit })),
          penggunaDialihkan: pindahUser.map((g) => ({ username: g.username, ke: g.ke.kode_unit })),
        }),
        JSON.stringify({
          acuan: 'Nama Jabatan Struktural.xlsx',
          catatan:
            'Pohon unit disamakan dengan berkas acuan: jabatan di unit non-acuan dipindah ke leluhur acuan terdekat, lalu unitnya dihapus. Dependen jabatan (pegawai, anggota jabatan target, riwayat) tidak disentuh — semuanya menunjuk jabatan, bukan unit.',
        }),
      ],
    )

    console.log(`\n── DITULIS`)
    console.log(`  ${pindahJab.length} jabatan dipindah · ${pindahUser.length} lingkup pengguna dialihkan`)
    console.log(`  ${unitDihapus} unit non-acuan dihapus`)
    for (const t of ditahan) console.log(`     DITAHAN: ${t}`)

    const [cek] = await kueri<{ unit: number; peg: number; bertaut: number; anggota: number }>(
      `SELECT (SELECT COUNT(*) FROM unit_organisasi) unit,
              (SELECT COUNT(*) FROM pegawai) peg,
              (SELECT COUNT(*) FROM pegawai WHERE jabatan_id IS NOT NULL) bertaut,
              (SELECT COUNT(*) FROM jabatan_target_anggota) anggota`,
    )
    const sisaLuar = (
      await kueri<{ nama_unit: string }>('SELECT nama_unit FROM unit_organisasi')
    ).filter((x) => !unitRef.has(kunciUnit(x.nama_unit)))
    console.log(`\n── PERIKSA ULANG SESUDAH MENULIS`)
    console.log(`  unit sekarang            : ${cek?.unit}  (acuan ${unitRef.size})`)
    console.log(`  masih di luar acuan      : ${sisaLuar.length}${sisaLuar.length === 0 ? ' ✓' : ''}`)
    for (const x of sisaLuar) console.log(`     · ${x.nama_unit}`)
    console.log(`  pegawai / bertaut jabatan: ${cek?.peg} / ${cek?.bertaut}`)
    console.log(`  anggota jabatan target   : ${cek?.anggota}`)
    console.log(
      '\n  Jalankan `npm run rapikan:jabatan` untuk memastikan 123 pasangan acuan masih utuh.\n',
    )
    process.exit(0)
  }

  if (!TULIS || !PINDAHKAN || rencana.length === 0) {
    console.log(
      `\n  ${!PINDAHKAN ? 'Tambahkan `-- --pindahkan --tulis` untuk menerapkan.' : TULIS ? 'Tidak ada yang perlu dipindah.' : 'Kering — tidak ada yang ditulis. Tambahkan `--tulis`.'}\n`,
    )
    process.exit(0)
  }

  for (const r of rencana) {
    await eksekusi('UPDATE unit_organisasi SET parent_id = ? WHERE id = ?', [
      r.indukBaru.id,
      r.anak.id,
    ])
  }
  /*
    Jejak audit ditulis lewat SQL, BUKAN `jalankanMutasi()`.

    `jalankanMutasi()` menuntut pengguna yang sudah masuk (ia memeriksa peran di
    dalam dirinya) dan `AksiAudit` tidak memuat `UBAH_MASSAL`. Skrip tidak punya
    sesi. Pola yang sama sudah dipakai `rapikan-jabatan.ts`, dan menyamakannya
    penting: dua cara berbeda menulis jejak untuk pekerjaan yang sejenis berarti
    `grep 'jalankanMutasi\|audit_log'` berhenti menemukan seluruh jalur tulis.

    `ip_address` diisi `::1` dengan sengaja — itu penanda yang membedakan perbuatan
    skrip dari perbuatan manusia, heuristik yang sudah sekali menyelamatkan
    `jabatan_target` 176 dari penghapusan yang keliru.
  */
  await eksekusi(
    `INSERT INTO audit_log (user_id, aksi, entitas, entitas_id, data_sebelum, data_sesudah, ip_address, created_at)
     VALUES (1, 'UBAH_MASSAL', 'unit_organisasi', NULL, CAST(? AS JSON), CAST(? AS JSON), '::1', NOW())`,
    [
      JSON.stringify({
        pindah: rencana.map((r) => ({
          kode: r.anak.kode_unit,
          parentLama: r.anak.parent_id,
          parentBaru: r.indukBaru.id,
        })),
      }),
      JSON.stringify({
        acuan: 'Nama Jabatan Struktural.xlsx',
        dipindah: rencana.length,
        catatan:
          'Induk unit diselaraskan dengan daftar jabatan struktural resmi. Hubungan induk-anak TIDAK ada di berkas acuan — ia daftar eksplisit PINDAH di scripts/rapikan-unit.ts.',
      }),
    ],
  )

  // ── 6. Periksa ulang SESUDAH menulis ───────────────────────────────────────
  const lagi = await kueri<{ id: number; nama_unit: string; parent_id: number | null }>(
    'SELECT id, nama_unit, parent_id FROM unit_organisasi',
  )
  const idx = new Map(lagi.map((x) => [x.id, x]))
  let akarLagi = 0
  let siklusLagi = 0
  for (const x of lagi) {
    let cur: number | null = x.id
    const lihat = new Set<number>()
    while (cur !== null && !lihat.has(cur)) {
      lihat.add(cur)
      cur = idx.get(cur)?.parent_id ?? null
    }
    if (cur !== null) siklusLagi++
    if (x.parent_id === null) akarLagi++
  }
  console.log(`\n── DITULIS`)
  console.log(`  ${rencana.length} unit dipindah induknya`)
  console.log(`\n── PERIKSA ULANG SESUDAH MENULIS`)
  console.log(`  akar   : ${akarLagi}${akarLagi === 1 ? ' ✓' : '  ← RUSAK'}`)
  console.log(`  siklus : ${siklusLagi}${siklusLagi === 0 ? ' ✓' : '  ← RUSAK'}`)
  console.log(
    '\n  Penyaring unit membaca pohon ini lewat SUBKUERI_UNIT_TURUNAN yang rekursif,\n' +
      '  jadi tidak ada yang perlu dihitung ulang — perubahannya berlaku seketika.\n',
  )
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
