import { describe, expect, it } from 'vitest'

import {
  normalisasiNamaDiklat,
  penuhiSyaratPelatihan,
  usulkanJenisPenugasan,
  usulkanKategoriDiklat,
  type KategoriDiklat,
} from './kategori-riwayat'

/**
 * Uji diorganisasi menurut **cara usulan bisa menyesatkan**, bukan menurut nama
 * fungsi. Yang dijaga: usulan yang salah harus terlihat sebagai usulan (bisa
 * ditolak pemeriksa), dan tidak boleh ada jalur yang membuat data belum
 * diperiksa terhitung sebagai memenuhi syarat.
 */

const MASTER: KategoriDiklat[] = [
  { id: 1, kode: 'MANAJERIAL', nama: 'Pelatihan Manajerial', jenis: 'MANAJERIAL', parentId: null, setaraJenjang: null, polaCocok: ['kepemimpinan', 'manajerial', 'diklat pim'] },
  { id: 2, kode: 'TEKNIS', nama: 'Pelatihan Teknis', jenis: 'TEKNIS', parentId: null, setaraJenjang: null, polaCocok: ['pelatihan teknis', 'diklat teknis'] },
  { id: 3, kode: 'PIM_III', nama: 'Diklat PIM III', jenis: 'MANAJERIAL', parentId: 1, setaraJenjang: 'III', polaCocok: ['pim iii', 'pim 3', 'kepemimpinan administrator'] },
  { id: 4, kode: 'PIM_IV', nama: 'Diklat PIM IV', jenis: 'MANAJERIAL', parentId: 1, setaraJenjang: 'IV', polaCocok: ['pim iv', 'pim 4', 'kepemimpinan pengawas'] },
  { id: 5, kode: 'PBJ', nama: 'Pengadaan Barang dan Jasa', jenis: 'TEKNIS', parentId: 2, setaraJenjang: null, polaCocok: ['pengadaan barang', 'procurement', 'pbj'] },
  { id: 6, kode: 'HUKUM_KONTRAK', nama: 'Hukum Kontrak', jenis: 'TEKNIS', parentId: 2, setaraJenjang: null, polaCocok: ['hukum kontrak', 'kontrak konstruksi'] },
]

describe('normalisasiNamaDiklat — supaya kamus tidak jadi daftar ejaan', () => {
  it('menyatukan beda huruf besar, spasi rangkap, dan tanda baca', () => {
    const bentuk = ['Diklat PIM IV', 'DIKLAT PIM  IV', 'diklat pim iv.', ' Diklat  PIM IV ']
    const hasil = new Set(bentuk.map(normalisasiNamaDiklat))
    expect(hasil.size).toBe(1)
    expect([...hasil][0]).toBe('diklat pim iv')
  })

  it('memisahkan kata yang tersambung tanda baca, bukan menempelkannya', () => {
    // 'Pengadaan Barang/Jasa' → tanpa ini jadi 'barangjasa' dan pola
    // 'pengadaan barang' tidak akan pernah cocok.
    expect(normalisasiNamaDiklat('Pengadaan Barang/Jasa')).toBe('pengadaan barang jasa')
  })

  it('teks kosong & hanya tanda baca jadi string kosong', () => {
    expect(normalisasiNamaDiklat('   ')).toBe('')
    expect(normalisasiNamaDiklat('--/--')).toBe('')
  })
})

describe('usulkanKategoriDiklat', () => {
  it('mengusulkan turunan, bukan rumpunnya, ketika keduanya cocok', () => {
    // 'Diklat PIM IV' memicu pola rumpun ('diklat pim') DAN turunan ('pim iv').
    // Mengusulkan keduanya hanya menambah pilihan yang selalu kalah.
    const u = usulkanKategoriDiklat('Diklat PIM IV Angkatan 3', MASTER)
    expect(u.map((x) => x.kode)).toEqual(['PIM_IV'])
  })

  it('tetap mengusulkan rumpun bila tidak ada turunan yang cocok', () => {
    const u = usulkanKategoriDiklat('Pelatihan Kepemimpinan Dasar', MASTER)
    expect(u.map((x) => x.kode)).toEqual(['MANAJERIAL'])
  })

  it('mengusulkan LEBIH DARI SATU tanpa memilih sendiri', () => {
    // Memilih otomatis di antara dua yang cocok berarti mesin mengambil
    // keputusan yang justru sedang dipindahkan ke manusia.
    const u = usulkanKategoriDiklat('Diklat Pengadaan Barang/Jasa dan Hukum Kontrak', MASTER)
    expect(u.map((x) => x.kode).sort()).toEqual(['HUKUM_KONTRAK', 'PBJ'])
  })

  it('menyertakan pola pemicu sebagai alasan', () => {
    const u = usulkanKategoriDiklat('Sertifikasi Procurement Dasar', MASTER)
    expect(u).toHaveLength(1)
    expect(u[0]!.alasan).toEqual(['procurement'])
  })

  it('tidak mengusulkan apa pun untuk diklat yang memang di luar kamus', () => {
    // Ini yang membuat "gagal tertutup" bisa terjadi: tanpa usulan, barisnya
    // tetap di antrian sebagai USULAN tanpa kategori dan TIDAK dihitung relevan.
    expect(usulkanKategoriDiklat('Diklat Kearsipan Dasar', MASTER)).toEqual([])
    expect(usulkanKategoriDiklat('', MASTER)).toEqual([])
  })

  it('cocok lintas ejaan angka Romawi vs Arab lewat pola, bukan lewat normalisasi', () => {
    expect(usulkanKategoriDiklat('Diklat PIM 4', MASTER).map((x) => x.kode)).toEqual(['PIM_IV'])
    expect(usulkanKategoriDiklat('Diklat PIM IV', MASTER).map((x) => x.kode)).toEqual(['PIM_IV'])
  })

  it('pola master yang kosong tidak mencocokkan semuanya', () => {
    // Pola '' akan cocok dengan setiap string lewat includes(''), sehingga satu
    // baris master yang polanya dikosongkan dari UI akan diusulkan untuk SELURUH
    // diklat — dan pemeriksa melihat kategori yang sama di 182 baris.
    const rusak: KategoriDiklat[] = [
      { id: 9, kode: 'RUSAK', nama: 'Pola kosong', jenis: 'TEKNIS', parentId: null, setaraJenjang: null, polaCocok: ['', '  '] },
    ]
    expect(usulkanKategoriDiklat('Diklat apa saja', rusak)).toEqual([])
  })
})

describe('usulkanJenisPenugasan', () => {
  it('mengenali Plt & Plh dalam kedua ejaan', () => {
    expect(usulkanJenisPenugasan('Plt. Kepala Balai').jenis).toBe('PLT')
    expect(usulkanJenisPenugasan('Pelaksana Tugas Kepala Balai').jenis).toBe('PLT')
    expect(usulkanJenisPenugasan('Plh Sekretaris Direktorat').jenis).toBe('PLH')
    expect(usulkanJenisPenugasan('Pelaksana Harian Kasubdit').jenis).toBe('PLH')
  })

  it('jabatan definitif tidak tertangkap sebagai penugasan', () => {
    const u = usulkanJenisPenugasan('Kepala Subdirektorat Sistem Informasi')
    expect(u.jenis).toBe('DEFINITIF')
    expect(u.yakin).toBe(true)
  })

  it('"Pelaksana Tugas Belajar" TIDAK diusulkan sebagai Plt, dan ditandai tidak yakin', () => {
    // Penjagaan antisipatif, BUKAN perbaikan bug teramati: frasa ini nol
    // kejadian di pupr_dev. Kalau ia muncul di data produksi, regex di
    // lib/penilaian.ts akan menaikkan skor Substansi ke 80/100 tanpa satu pun
    // tanda kekeliruan — itu sebabnya penjagaannya tetap ditulis dan diuji.
    const u = usulkanJenisPenugasan('Pelaksana Tugas Belajar S2 Dalam Negeri')
    expect(u.jenis).toBe('DEFINITIF')
    expect(u.yakin).toBe(false)
    expect(u.alasan).toMatch(/tugas belajar/i)
  })

  it('tidak tertangkap oleh kata yang hanya MEMUAT "plt"/"plh"', () => {
    // Batas kata: 'Kompleks' memuat 'pl' tapi bukan Plt; 'Split' memuat 'plt'.
    expect(usulkanJenisPenugasan('Analis Split Kontrak').jenis).toBe('DEFINITIF')
  })

  it('teks kosong tidak melempar', () => {
    expect(usulkanJenisPenugasan('').jenis).toBe('DEFINITIF')
  })
})

describe('penuhiSyaratPelatihan — gagal tertutup', () => {
  it('kurang satu kategori berarti tidak memenuhi, dan menyebut yang kurang', () => {
    const h = penuhiSyaratPelatihan(['PIM_IV'], ['PIM_IV', 'PBJ'])
    expect(h.memenuhi).toBe(false)
    expect(h.kurang).toEqual(['PBJ'])
  })

  it('lengkap berarti memenuhi', () => {
    expect(penuhiSyaratPelatihan(['PIM_IV', 'PBJ', 'HUKUM_KONTRAK'], ['PIM_IV', 'PBJ']).memenuhi).toBe(true)
  })

  it('tanpa kategori tervalidasi sama sekali: TIDAK memenuhi, bukan lolos', () => {
    // Inti "gagal tertutup". Kalau diklat yang belum diperiksa dianggap
    // memenuhi, orang dengan data paling berantakan justru naik peringkat.
    const h = penuhiSyaratPelatihan([], ['PBJ'])
    expect(h.memenuhi).toBe(false)
    expect(h.kurang).toEqual(['PBJ'])
  })

  it('jabatan target tanpa syarat pelatihan ditandai, bukan diakui memenuhi', () => {
    const h = penuhiSyaratPelatihan([], [])
    expect(h.memenuhi).toBe(true)
    expect(h.tanpaSyarat).toBe(true)
  })
})
