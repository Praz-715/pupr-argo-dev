import { catatEkspor } from '@/lib/audit'
import { getCurrentUser } from '@/lib/auth'
import { headerCsv, namaBerkasCsv, susunCsv, type KolomEkspor } from '@/lib/ekspor'
import { ambilAuditLog, ambilRiwayatPerhitungan } from '@/lib/kueri/admin'
import {
  ambilGapIndikator,
  ambilGapPerJenjang,
  ambilGapPerUnit,
  ambilNominasiRinci,
  ambilRekapPeriode,
  ambilRekapUnit,
  type FilterLaporan,
} from '@/lib/kueri/laporan'
import { lingkupData, tanpaAkses, unitWajib } from '@/lib/lingkup'
import { angkaPositif, tanggalIso } from '@/lib/param'
import { punyaPeran, type Peran } from '@/lib/peran'

/**
 * Unduhan CSV (Fase 8).
 *
 * ## Kenapa Route Handler, bukan server action
 *
 * Server action mengembalikan data ke React, bukan berkas berheader
 * `Content-Disposition` — unduhan memang salah satu dari sedikit hal yang tidak
 * bisa dikerjakan server action (phase.md §5.1 sudah menyebut `api/internal/`
 * untuk itu).
 *
 * ## Kenapa sinkron, menyimpang dari U-10
 *
 * U-10 menetapkan ekspor besar jadi **job asinkron + progress + notifikasi**.
 * Itu ditulis sebelum ada angka. Yang terukur sekarang: seluruh kueri laporan
 * selesai 2–60 ms, dan tabel terbesar di produksi 1.872 pegawai — CSV-nya
 * beberapa ratus kilobyte, selesai dalam satu permintaan tanpa terasa. Membangun
 * antrean job sekarang berarti infrastruktur untuk masalah yang belum ada, dan
 * proyek ini berkali-kali memilih sebaliknya ("skala terukur, bukan diasumsikan").
 *
 * Yang membuat keputusan ini bisa dibalik murah: setiap ekspor **dibatasi `LIMIT`
 * di kuerinya**, jadi tidak ada jalur yang bisa tumbuh tanpa batas diam-diam.
 * Begitu ada jenis ekspor yang benar-benar lambat (PDF seluruh profil, misalnya),
 * job asinkron dipasang untuk jenis itu — bukan untuk semuanya.
 *
 * ## Yang ditegakkan di sini
 *
 * Peran **per jenis ekspor**, dan batas unit lewat `unitWajib` yang sama dengan
 * halamannya. Sebuah endpoint unduhan yang lupa membatasi lingkup adalah cara
 * paling rapi untuk membocorkan seluruh data pegawai kepada Pengelola Unit —
 * halamannya tersaring, berkasnya tidak, dan tidak ada yang akan menyadarinya.
 */

type Jenis =
  | 'gap-indikator'
  | 'gap-unit'
  | 'gap-jenjang'
  | 'nominasi'
  | 'rekap-periode'
  | 'rekap-unit'
  | 'audit-log'
  | 'riwayat-perhitungan'

const PERAN_LAPORAN: readonly Peran[] = ['Super Admin', 'Admin Talenta', 'Pimpinan']
const PERAN_AUDIT: readonly Peran[] = ['Super Admin']

const PERAN_PER_JENIS: Record<Jenis, readonly Peran[]> = {
  'gap-indikator': PERAN_LAPORAN,
  'gap-unit': PERAN_LAPORAN,
  'gap-jenjang': PERAN_LAPORAN,
  nominasi: PERAN_LAPORAN,
  'rekap-periode': PERAN_LAPORAN,
  'rekap-unit': PERAN_LAPORAN,
  'audit-log': PERAN_AUDIT,
  // Laporan sesi perhitungan boleh dibaca peran laporan, BUKAN cuma Super Admin
  // seperti audit log penuh: isinya ringkasan angka per sesi (siapa, kapan,
  // berapa baris, berapa perlu ditinjau) — bukan `data_sebelum`/`data_sesudah`
  // mentah yang bisa memuat nilai kolom apa pun.
  'riwayat-perhitungan': PERAN_LAPORAN,
}

export const JENIS_EKSPOR = Object.keys(PERAN_PER_JENIS) as Jenis[]

function adalahJenis(nilai: string): nilai is Jenis {
  return (JENIS_EKSPOR as string[]).includes(nilai)
}

export async function GET(
  permintaan: Request,
  { params }: { params: Promise<{ jenis: string }> },
) {
  const { jenis } = await params
  if (!adalahJenis(jenis)) {
    return new Response('Jenis ekspor tidak dikenali.', { status: 404 })
  }

  // 401, bukan pengalihan: yang memanggil ini adalah unduhan, dan mengalihkannya
  // ke halaman masuk menghasilkan berkas HTML bernama .csv.
  const pengguna = await getCurrentUser()
  if (!pengguna) return new Response('Sesi sudah berakhir.', { status: 401 })

  if (!punyaPeran(pengguna, PERAN_PER_JENIS[jenis])) {
    return new Response('Peran Anda tidak berwenang mengunduh laporan ini.', { status: 403 })
  }

  const lingkup = lingkupData(pengguna)
  if (tanpaAkses(lingkup)) {
    return new Response('Akun Anda belum ditautkan ke unit organisasi mana pun.', { status: 403 })
  }

  const url = new URL(permintaan.url)
  const q = (k: string) => url.searchParams.get(k) ?? undefined
  const filter: FilterLaporan = {
    jabatanTargetId: angkaPositif(q('target')),
    unitId: angkaPositif(q('unit')),
    unitWajib: unitWajib(lingkup),
    jenjang: q('jenjang')?.slice(0, 60),
    dari: tanggalIso(q('dari')),
    sampai: tanggalIso(q('sampai')),
  }

  const { csv, jumlah } = await susun(jenis, filter, q('cari'))

  await catatEkspor({
    userId: pengguna.id,
    jenis,
    penyaring: {
      target: filter.jabatanTargetId ?? null,
      unit: filter.unitId ?? null,
      unitWajib: filter.unitWajib ?? null,
      jenjang: filter.jenjang ?? null,
      dari: filter.dari ?? null,
      sampai: filter.sampai ?? null,
    },
    jumlahBaris: jumlah,
  })

  return new Response(csv, { headers: headerCsv(namaBerkasCsv(jenis, new Date())) })
}

/** Definisi kolom per jenis — satu tempat, supaya header CSV tidak lahir ad-hoc. */
async function susun(
  jenis: Jenis,
  filter: FilterLaporan,
  cari: string | undefined,
): Promise<{ csv: string; jumlah: number }> {
  switch (jenis) {
    case 'gap-indikator': {
      const baris = await ambilGapIndikator(filter)
      const kolom: Array<KolomEkspor<(typeof baris)[number]>> = [
        { kunci: 'target', judul: 'Jabatan Target', nilai: (b) => b.namaTarget },
        { kunci: 'komponen', judul: 'Komponen', nilai: (b) => b.namaKomponen },
        { kunci: 'indikator', judul: 'Indikator', nilai: (b) => b.namaIndikator },
        { kunci: 'bobot', judul: 'Bobot', nilai: (b) => b.bobot },
        { kunci: 'dinilai', judul: 'Jumlah Dinilai', nilai: (b) => b.jumlahDinilai },
        { kunci: 'rata', judul: 'Rata-rata Skor', nilai: (b) => b.rataSkor },
        { kunci: 'terendah', judul: 'Skor Terendah', nilai: (b) => b.skorTerendah },
        { kunci: 'dibawah', judul: 'Di Bawah Ambang', nilai: (b) => b.jumlahDiBawahAmbang },
        { kunci: 'manual', judul: 'Nilai Manual', nilai: (b) => b.jumlahManual },
        { kunci: 'review', judul: 'Perlu Review', nilai: (b) => b.jumlahPerluReview },
      ]
      return { csv: susunCsv(kolom, baris), jumlah: baris.length }
    }

    case 'gap-unit':
    case 'gap-jenjang': {
      const baris =
        jenis === 'gap-unit' ? await ambilGapPerUnit(filter) : await ambilGapPerJenjang(filter)
      const kolom: Array<KolomEkspor<(typeof baris)[number]>> = [
        {
          kunci: 'label',
          judul: jenis === 'gap-unit' ? 'Unit Organisasi' : 'Jenjang',
          nilai: (b) => b.label,
        },
        { kunci: 'dinilai', judul: 'Jumlah Dinilai', nilai: (b) => b.jumlahDinilai },
        { kunci: 'eligible', judul: 'Lolos Syarat', nilai: (b) => b.jumlahEligible },
        { kunci: 'total', judul: 'Rata Skor Total', nilai: (b) => b.rataSkorTotal },
        { kunci: 'pk', judul: 'Rata Potkom (65%)', nilai: (b) => b.rataPotensiKompetensi },
        { kunci: 'kj', judul: 'Rata Kualifikasi (20%)', nilai: (b) => b.rataKualifikasi },
        { kunci: 'im', judul: 'Rata Integritas (15%)', nilai: (b) => b.rataIntegritas },
      ]
      return { csv: susunCsv(kolom, baris), jumlah: baris.length }
    }

    case 'nominasi': {
      const baris = await ambilNominasiRinci(filter, 5000)
      const kolom: Array<KolomEkspor<(typeof baris)[number]>> = [
        { kunci: 'id', judul: 'ID Nominasi', nilai: (b) => b.nominasiId },
        { kunci: 'nip', judul: 'NIP', nilai: (b) => b.nip },
        { kunci: 'nama', judul: 'Nama', nilai: (b) => b.nama },
        { kunci: 'target', judul: 'Jabatan Target', nilai: (b) => b.namaTarget },
        { kunci: 'unit', judul: 'Unit Pengaju', nilai: (b) => b.namaUnitPengaju },
        { kunci: 'diajukan', judul: 'Tanggal Diajukan', nilai: (b) => b.tanggalDiajukan },
        { kunci: 'status', judul: 'Status Nominasi', nilai: (b) => b.status },
        { kunci: 'pool', judul: 'Status Kandidat', nilai: (b) => b.statusPool },
        { kunci: 'selesai', judul: 'Selesai Pada', nilai: (b) => b.selesaiPada },
        { kunci: 'hari', judul: 'Hari Proses', nilai: (b) => b.hariProses },
        { kunci: 'tahap', judul: 'Jumlah Tahap', nilai: (b) => b.jumlahTahap },
      ]
      return { csv: susunCsv(kolom, baris), jumlah: baris.length }
    }

    case 'rekap-periode': {
      const baris = await ambilRekapPeriode(filter)
      const kolom: Array<KolomEkspor<(typeof baris)[number]>> = [
        { kunci: 'periode', judul: 'Periode', nilai: (b) => b.periode },
        { kunci: 'jumlah', judul: 'Jumlah Nominasi', nilai: (b) => b.jumlah },
        { kunci: 'disetujui', judul: 'Disetujui', nilai: (b) => b.disetujui },
        { kunci: 'ditolak', judul: 'Ditolak', nilai: (b) => b.ditolak },
        { kunci: 'berjalan', judul: 'Masih Berjalan', nilai: (b) => b.berjalan },
        { kunci: 'hari', judul: 'Rata Hari Proses', nilai: (b) => b.rataHariProses },
      ]
      return { csv: susunCsv(kolom, baris), jumlah: baris.length }
    }

    case 'rekap-unit': {
      const baris = await ambilRekapUnit(filter)
      const kolom: Array<KolomEkspor<(typeof baris)[number]>> = [
        { kunci: 'unit', judul: 'Unit Pengaju', nilai: (b) => b.namaUnit },
        { kunci: 'jumlah', judul: 'Jumlah Nominasi', nilai: (b) => b.jumlah },
        { kunci: 'disetujui', judul: 'Disetujui', nilai: (b) => b.disetujui },
        { kunci: 'ditolak', judul: 'Ditolak', nilai: (b) => b.ditolak },
        { kunci: 'berjalan', judul: 'Masih Berjalan', nilai: (b) => b.berjalan },
        { kunci: 'hari', judul: 'Rata Hari Proses', nilai: (b) => b.rataHariProses },
      ]
      return { csv: susunCsv(kolom, baris), jumlah: baris.length }
    }

    case 'audit-log': {
      // Memakai kueri yang SAMA dengan Audit Log Viewer, cuma `perHalaman` beda —
      // CLAUDE.md sudah menyebut ini sebagai jalur yang tinggal disambung.
      const hasil = await ambilAuditLog({
        dari: filter.dari,
        sampai: filter.sampai,
        cari,
        halaman: 1,
        perHalaman: 100,
      })
      const kolom: Array<KolomEkspor<(typeof hasil.baris)[number]>> = [
        { kunci: 'id', judul: 'ID', nilai: (b) => b.id },
        { kunci: 'waktu', judul: 'Waktu', nilai: (b) => b.createdAt },
        { kunci: 'pengguna', judul: 'Pengguna', nilai: (b) => b.namaPengguna },
        { kunci: 'peran', judul: 'Peran', nilai: (b) => b.peranPengguna },
        { kunci: 'aksi', judul: 'Aksi', nilai: (b) => b.aksi },
        { kunci: 'entitas', judul: 'Entitas', nilai: (b) => b.entitas },
        { kunci: 'entitasId', judul: 'ID Entitas', nilai: (b) => b.entitasId },
        { kunci: 'ip', judul: 'IP', nilai: (b) => b.ipAddress },
      ]
      return { csv: susunCsv(kolom, hasil.baris), jumlah: hasil.baris.length }
    }

    case 'riwayat-perhitungan': {
      const baris = await ambilRiwayatPerhitungan({
        dari: filter.dari,
        sampai: filter.sampai,
        jabatanTargetId: filter.jabatanTargetId,
        batas: 1000,
      })
      const kolom: Array<KolomEkspor<(typeof baris)[number]>> = [
        { kunci: 'waktu', judul: 'Waktu', nilai: (b) => b.waktu },
        { kunci: 'pengguna', judul: 'Dijalankan oleh', nilai: (b) => b.namaPengguna },
        { kunci: 'peran', judul: 'Peran', nilai: (b) => b.peranPengguna },
        { kunci: 'kodeTarget', judul: 'Kode Jabatan Target', nilai: (b) => b.kodeTarget },
        { kunci: 'namaTarget', judul: 'Jabatan Target', nilai: (b) => b.namaTarget },
        { kunci: 'sebelumBaris', judul: 'Baris Skor Sebelum', nilai: (b) => b.sebelumBaris },
        { kunci: 'sebelumEligible', judul: 'Eligible Sebelum', nilai: (b) => b.sebelumEligible },
        { kunci: 'jumlahBaris', judul: 'Pegawai Dinilai', nilai: (b) => b.jumlahBaris },
        { kunci: 'eligible', judul: 'Lolos Syarat', nilai: (b) => b.eligible },
        { kunci: 'perluReview', judul: 'Perlu Ditinjau', nilai: (b) => b.perluReview },
        { kunci: 'barisRincian', judul: 'Baris Rincian Indikator', nilai: (b) => b.barisRincian },
        {
          kunci: 'manual',
          judul: 'Nilai Manual Dipertahankan',
          nilai: (b) => b.nilaiManualDipertahankan,
        },
        {
          kunci: 'pool',
          judul: 'Anggota Pool Diperingkat',
          nilai: (b) => b.anggotaPoolDiperingkat,
        },
        { kunci: 'galatRubrik', judul: 'Galat Rubrik', nilai: (b) => b.galatRubrik },
        { kunci: 'durasiMs', judul: 'Durasi (ms)', nilai: (b) => b.durasiMs },
        { kunci: 'auditId', judul: 'ID Audit', nilai: (b) => b.auditId },
      ]
      return { csv: susunCsv(kolom, baris), jumlah: baris.length }
    }
  }
}
