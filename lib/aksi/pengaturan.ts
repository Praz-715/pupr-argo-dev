'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { jalankanMutasi } from '../audit'
import { getCurrentUser } from '../auth'
import { eksekusi, kueri, kueriSatu } from '../db'
import { KUNCI_PENGATURAN } from '../pengaturan'
import { gerbangPeran } from './gerbang'
import { berhasil, gagal, galatDariZod, type HasilAksi } from './hasil'

/**
 * Ubah parameter sistem (PRD §6.10) — hanya Super Admin.
 *
 * **Batas nilainya ditegakkan di server dari kolom `nilai_min`/`nilai_max`**,
 * bukan dari `min`/`max` di `<input>`. Atribut HTML hanya menghalangi jari;
 * parameter yang lolos ke DB dengan nilai 0 akan membuat timeout sesi nol
 * menit — artinya tidak ada yang bisa masuk, termasuk yang mengubahnya.
 *
 * Yang TIDAK diizinkan: menambah kunci baru dari UI. Parameter yang tidak
 * dikenal `lib/pengaturan.ts` tidak dibaca kode mana pun, jadi ia hanya akan
 * jadi baris yang terlihat berpengaruh padahal tidak.
 */

const PERAN_PENGATURAN = ['Super Admin'] as const

const SkemaUbah = z.object({
  kunci: z.string().trim().min(1).max(60),
  nilai: z.string().trim().min(1, 'Nilai wajib diisi').max(255),
})

export async function ubahPengaturan(masukan: unknown): Promise<HasilAksi<void>> {
  const tolak = await gerbangPeran(PERAN_PENGATURAN)
  if (tolak) return tolak

  const urai = SkemaUbah.safeParse(masukan)
  if (!urai.success) return gagal('Periksa isian yang ditandai.', galatDariZod(urai.error.issues))
  const { kunci, nilai } = urai.data

  if (!(kunci in KUNCI_PENGATURAN)) {
    return gagal(
      `Parameter "${kunci}" tidak dikenali aplikasi, jadi mengubahnya tidak akan berpengaruh apa pun.`,
    )
  }

  const baris = await kueriSatu<{
    nilai: string
    tipe: string
    label: string
    nilai_min: number | null
    nilai_max: number | null
  }>('SELECT nilai, tipe, label, nilai_min, nilai_max FROM pengaturan_sistem WHERE kunci = ?', [
    kunci,
  ])
  if (!baris) return gagal('Parameter tidak ditemukan di database.')

  if (baris.tipe === 'ANGKA') {
    const n = Number(nilai)
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
      return gagal(`${baris.label} harus berupa bilangan bulat.`, { nilai: 'Harus bilangan bulat.' })
    }
    if (baris.nilai_min !== null && n < Number(baris.nilai_min)) {
      return gagal(`${baris.label} minimal ${baris.nilai_min}.`, {
        nilai: `Minimal ${baris.nilai_min}.`,
      })
    }
    if (baris.nilai_max !== null && n > Number(baris.nilai_max)) {
      return gagal(`${baris.label} maksimal ${baris.nilai_max}.`, {
        nilai: `Maksimal ${baris.nilai_max}.`,
      })
    }
  }

  /*
    SYARAT ANTAR-BARIS — diperiksa atas KESELURUHAN himpunan, bukan per pasangan.

    Tiga parameter punya syarat yang tidak bisa dinyatakan `nilai_min`/`nilai_max`,
    sebab yang tidak sah bukan satu angkanya melainkan hubungannya dengan angka
    lain. Versi pertama pemeriksaan ini hanya menangani ambang Kotak 9 dan
    berbentuk peta "pasangan lawan" — bentuk yang tidak bisa tumbuh: skala predikat
    punya LIMA baris yang harus menurun, bukan dua yang saling berlawanan.

    Jadi caranya dibalik: seluruh baris dibaca, perubahan yang diusulkan
    diterapkan DI MEMORI, lalu tiap invarian diuji terhadap keadaan hasilnya.
    Menambah parameter bersyarat berikutnya berarti menambah satu entri di
    `INVARIAN` — bukan menambah cabang di tengah alur.

    Diperiksa di sini — di satu-satunya jalur yang boleh mengubah nilainya —
    bukan di jalur baca. `ambangSumbuDari()` & `skalaPredikatDari()` memang ikut
    berjaga dengan jatuh ke bawaan, tapi itu jaring terakhir untuk baris yang
    diubah lewat SQL langsung; membiarkan UI menyimpan keadaan mustahil lalu
    diam-diam mengabaikannya berarti Super Admin melihat 90 tersimpan sementara
    sistem memakai 80.
  */
  const semua = new Map(
    (
      await kueri<{ kunci: string; nilai: string }>('SELECT kunci, nilai FROM pengaturan_sistem')
    ).map((r) => [r.kunci, Number(r.nilai)]),
  )
  semua.set(kunci, Number(nilai))

  const galatInvarian = periksaInvarian(semua, kunci)
  if (galatInvarian) return gagal(galatInvarian.pesan, { nilai: galatInvarian.field })

  if (baris.nilai === nilai) {
    return berhasil(undefined, 'Nilainya sudah seperti itu — tidak ada yang diubah.')
  }

  const saya = await getCurrentUser()

  await jalankanMutasi({
    entitas: 'pengaturan_sistem',
    aksi: 'UBAH',
    peranDiizinkan: PERAN_PENGATURAN,
    sebelum: async () => ({ kunci, nilai: baris.nilai }),
    jalankan: async () => {
      await eksekusi(
        'UPDATE pengaturan_sistem SET nilai = ?, diubah_oleh = ?, diubah_pada = NOW() WHERE kunci = ?',
        [nilai, saya?.id ?? null, kunci],
      )
      return { entitasId: null, sesudah: { kunci, nilai } }
    },
  })

  revalidatePath('/admin/pengaturan')

  // Masa berlaku asesmen menentukan siapa yang lolos syarat. Angkanya berubah
  // sekarang, tapi isi `match_score` masih hasil hitungan dengan angka lama —
  // dan halaman kandidat membaca dari sana. Dikatakan terus terang di sini,
  // bukan dibiarkan jadi selisih yang ditemukan orang minggu depan.
  const PERLU_HITUNG_ULANG: Record<string, string> = {
    masa_berlaku_asesmen_tahun:
      ' Skor yang tersimpan masih memakai angka lama — jalankan Hitung Ulang di tiap jabatan target agar kelayakan kandidat ikut menyesuaikan.',
    // Ambang menentukan `asesmen_talenta.kotak_9` yang TERSIMPAN. Tampilan per
    // jabatan target menghitung kotaknya di SQL sehingga ikut berubah seketika,
    // sedangkan sebaran organisasi membaca kolom tersimpan — jadi tanpa hitung
    // ulang, dua halaman akan menempatkan orang yang sama di kotak berbeda.
    ambang_sumbu_atas:
      ' Kotak 9 yang tersimpan di data asesmen masih memakai ambang lama. Jalankan Hitung Ulang di tiap jabatan target, dan `npm run db:recompute` untuk menyegarkan kolom kotak_9 — sampai itu dilakukan, sebaran organisasi dan tampilan per jabatan target bisa berbeda.',
    // Skala predikat & bobot Formula A menentukan `nilai_kinerja_y` dan
    // `nilai_talenta` yang TERSIMPAN di `asesmen_talenta`. Sebaran organisasi
    // membacanya dari kolom itu, sementara tampilan per jabatan target
    // menghitungnya di SQL — jadi tanpa hitung ulang, dua halaman akan memberi
    // angka berbeda untuk orang yang sama.
    ...Object.fromEntries(
      [
        'skor_predikat_sangat_baik',
        'skor_predikat_baik',
        'skor_predikat_butuh_perbaikan',
        'skor_predikat_kurang',
        'skor_predikat_sangat_kurang',
      ].map((k) => [
        k,
        ' Nilai kinerja (sumbu Y) yang tersimpan di data asesmen masih memakai skala lama. Jalankan `npm run db:recompute` lalu Hitung Ulang di tiap jabatan target — sampai itu dilakukan, sebaran organisasi memakai angka lama sementara tampilan per jabatan target sudah memakai yang baru.',
      ]),
    ),
    bobot_talenta_kinerja:
      ' Nilai Talenta yang tersimpan masih memakai bobot lama. Jalankan `npm run db:recompute` untuk menyegarkannya.',
    bobot_talenta_potensial:
      ' Nilai Talenta yang tersimpan masih memakai bobot lama. Jalankan `npm run db:recompute` untuk menyegarkannya.',
    ambang_sumbu_tengah:
      ' Kotak 9 yang tersimpan di data asesmen masih memakai ambang lama. Jalankan Hitung Ulang di tiap jabatan target, dan `npm run db:recompute` untuk menyegarkan kolom kotak_9 — sampai itu dilakukan, sebaran organisasi dan tampilan per jabatan target bisa berbeda.',
  }
  const catatan = PERLU_HITUNG_ULANG[kunci] ?? ''

  return berhasil(undefined, `${baris.label} diubah jadi ${nilai}.${catatan}`)
}

/** Satu syarat antar-baris beserta kalimat penolakannya. */
interface Invarian {
  /** Kunci yang perubahannya bisa melanggar syarat ini. */
  kunci: string[]
  /** `true` = keadaan sah. */
  sah: (v: (kunci: string) => number) => boolean
  pesan: string
  field: string
}

/**
 * Skala predikat WAJIB menurun.
 *
 * Skala yang memberi "Kurang" lebih tinggi daripada "Baik" membuat sumbu Y
 * memeringkat orang secara terbalik, dan itu tidak akan pernah muncul sebagai
 * galat — hanya sebagai Kotak 9 yang terlihat aneh. Yang dituntut hanya
 * TIDAK-MENAIK (`>=`), bukan menurun tegas: dua predikat bernilai sama adalah
 * keputusan kebijakan yang sah ("Kurang dan Sangat Kurang sama-sama 0").
 */
const URUT_PREDIKAT = [
  'skor_predikat_sangat_baik',
  'skor_predikat_baik',
  'skor_predikat_butuh_perbaikan',
  'skor_predikat_kurang',
  'skor_predikat_sangat_kurang',
] as const

const INVARIAN: Invarian[] = [
  {
    kunci: ['ambang_sumbu_atas', 'ambang_sumbu_tengah'],
    sah: (v) => v('ambang_sumbu_atas') > v('ambang_sumbu_tengah'),
    pesan:
      'Ambang atas harus lebih besar daripada ambang tengah. Kalau tidak, kategori tengah ' +
      'Kotak 9 jadi wilayah kosong — CASE di SQL dan klasifikasiSumbuX/Y() sama-sama memakai ' +
      'cabang pertama yang cocok — sehingga setiap pegawai jatuh ke kategori teratas atau terbawah.',
    field: 'Periksa pasangannya.',
  },
  {
    kunci: [...URUT_PREDIKAT],
    sah: (v) => URUT_PREDIKAT.every((k, i) => i === 0 || v(URUT_PREDIKAT[i - 1]!) >= v(k)),
    pesan:
      'Skor predikat harus menurun dari Sangat Baik ke Sangat Kurang. Skala yang naik-turun ' +
      'membuat sumbu Y memeringkat pegawai secara terbalik, dan itu tidak menghasilkan galat ' +
      'apa pun — hanya Kotak 9 yang salah tanpa ada yang bisa menjelaskan sebabnya.',
    field: 'Harus <= skor predikat di atasnya dan >= yang di bawahnya.',
  },
  {
    kunci: ['bobot_talenta_kinerja', 'bobot_talenta_potensial'],
    sah: (v) => v('bobot_talenta_kinerja') + v('bobot_talenta_potensial') === 100,
    pesan:
      'Bobot sumbu Y dan sumbu X harus berjumlah tepat 100%. Jumlah lain membuat Nilai Talenta ' +
      'bukan lagi rata-rata berbobot kedua sumbu: di bawah 100 setiap orang tertekan ke bawah, ' +
      'di atas 100 semuanya menumpuk di plafon dan kehilangan daya bedanya.',
    field: 'Jumlah kedua bobot harus 100.',
  },
]

function periksaInvarian(
  semua: Map<string, number>,
  kunciDiubah: string,
): { pesan: string; field: string } | null {
  const v = (k: string) => semua.get(k) ?? NaN
  for (const inv of INVARIAN) {
    if (!inv.kunci.includes(kunciDiubah)) continue
    // Baris yang belum ada di DB (migrasi belum dijalankan) menghasilkan NaN,
    // dan NaN membuat setiap perbandingan false — yang akan menolak perubahan
    // yang sah. Invarian yang datanya belum lengkap DILEWATI, bukan dianggap
    // dilanggar: menolak dengan alasan yang tidak bisa dipenuhi lebih buruk
    // daripada tidak memeriksa.
    if (inv.kunci.some((k) => !Number.isFinite(v(k)))) continue
    if (!inv.sah(v)) return { pesan: inv.pesan, field: inv.field }
  }
  return null
}
