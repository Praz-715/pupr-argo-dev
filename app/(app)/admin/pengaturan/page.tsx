import Link from 'next/link'

import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { wajibMasuk } from '@/lib/auth'
import { ambilBarisPengaturan, type BarisPengaturan } from '@/lib/pengaturan'
import { punyaPeran } from '@/lib/peran'
import { FormPengaturan } from './_komponen/form-pengaturan'

export const metadata = { title: 'Pengaturan Sistem' }

const PERAN_HALAMAN = ['Super Admin'] as const

/**
 * Pengaturan Sistem (PRD §6.10).
 *
 * Isinya parameter yang **memang dipakai kode**, bukan daftar keinginan. Setiap
 * baris di sini punya pembacanya di `lib/pengaturan.ts`; parameter yang
 * tampil tapi tidak dibaca siapa pun lebih buruk daripada tidak ada, karena
 * orang akan mengubahnya lalu heran kenapa tidak terjadi apa-apa.
 *
 * Yang paling berpengaruh — masa berlaku asesmen — dulunya konstanta di kode
 * (`lib/scoring/konstanta.ts`), padahal PRD §10.11 sudah menyebutnya parameter
 * sistem. Fase 7 memindahkannya ke sini tanpa mengubah nilainya.
 */
export default async function PengaturanSistemPage() {
  const sesi = await wajibMasuk('/admin/pengaturan')

  if (!punyaPeran(sesi.pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Pengaturan Sistem"
        deskripsiHalaman="Parameter sistem yang berlaku global."
        peranAnda={sesi.pengguna.peran}
        alasan={
          <>
            Parameter di halaman ini berlaku untuk seluruh pengguna dan sebagian menggeser hasil
            penilaian, jadi hanya <strong className="font-medium text-text">Super Admin</strong>{' '}
            yang bisa mengubahnya.
          </>
        }
        catatan="Nilai yang sedang berlaku tetap terlihat di tempat pemakaiannya — mis. masa berlaku asesmen ditampilkan pada badge status asesmen di profil talenta."
      />
    )
  }

  const baris = await ambilBarisPengaturan()
  const dikelompokkan = new Set([
    ...KELOMPOK_PENILAIAN,
    ...KELOMPOK_SKALA,
    ...KELOMPOK_PREDIKAT,
    ...KELOMPOK_KEAMANAN,
  ])
  const lainnya = baris.filter((b) => !dikelompokkan.has(b.kunci))

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Pengaturan Sistem"
        deskripsi="Parameter yang bisa diubah tanpa deploy. Perubahannya langsung berlaku untuk semua pengguna dan tercatat di audit log."
      />

      <Panel>
        <PanelHeader
          judul="Parameter penilaian"
          deskripsi="Menentukan siapa yang lolos syarat talent pool."
        />
        <div className="mt-3.5">
          <FormPengaturan baris={menurutDaftar(baris, KELOMPOK_PENILAIAN)} />
        </div>
        <p className="mt-4 rounded-md border border-warning-border bg-warning-subtle px-3 py-2.5 text-[12px] leading-relaxed text-text-muted">
          <span className="font-medium text-text">Perubahan di sini tidak retroaktif.</span> Skor
          yang tersimpan di <code className="font-mono text-[11px]">match_score</code> adalah hasil
          hitungan dengan parameter yang berlaku saat itu, dan halaman kandidat membaca dari sana.
          Setelah mengubah masa berlaku asesmen, jalankan{' '}
          <Link
            href="/jabatan-target"
            className="font-medium text-accent underline-offset-2 hover:underline"
          >
            Hitung Ulang
          </Link>{' '}
          di tiap jabatan target agar kelayakan kandidat ikut menyesuaikan.
        </p>
      </Panel>

      <Panel>
        <PanelHeader
          judul="Skala Kotak 9 & Nilai Talenta"
          deskripsi="Ambang klasifikasi kedua sumbu, dan bobot Formula A. Berlaku untuk seluruh organisasi — bukan per jabatan target."
        />
        <div className="mt-3.5">
          <FormPengaturan baris={menurutDaftar(baris, KELOMPOK_SKALA)} />
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-text-muted">
          Batas bawah <span className="font-medium text-text">inklusif</span>: nilai tepat sama
          dengan ambang sudah masuk kategori itu. Ambang atas harus lebih besar daripada ambang
          tengah — kalau tidak, kategori tengah jadi wilayah kosong dan setiap pegawai jatuh ke
          kategori teratas atau terbawah. Kedua bobot harus berjumlah tepat 100%.
        </p>
      </Panel>

      <Panel>
        <PanelHeader
          judul="Skor predikat kinerja (sumbu Y)"
          deskripsi="Predikat yang dikirim sumber diterjemahkan ke nilai sumbu Y memakai skala ini."
        />
        <div className="mt-3.5">
          <FormPengaturan baris={menurutDaftar(baris, KELOMPOK_PREDIKAT)} />
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-text-muted">
          Urutannya <span className="font-medium text-text">wajib menurun</span> dari atas ke bawah;
          dua predikat bernilai sama boleh. Daftar predikatnya sendiri tidak bisa ditambah dari sini
          — namanya datang dari sistem sumber (e-Kinerja / berkas Talent Pool), jadi predikat keenam
          yang dibuat di halaman ini tidak akan pernah dikirim siapa pun.
        </p>
      </Panel>

      {/*
        Batas antara halaman INI dan editor rubrik, ditulis di layar bukan di
        dokumentasi — sebab pertanyaan "di mana saya mengubah 65/20/15" akan
        muncul persis di halaman ini, dan yang tidak menemukannya di sini akan
        menyimpulkan angkanya tidak bisa diubah tanpa deploy.
      */}
      <Panel>
        <PanelHeader
          judul="Yang diubah di tempat lain, bukan di sini"
          deskripsi="Sebagian besar angka penilaian memang bisa diubah dari UI — tapi tempatnya per jabatan target."
        />
        <div className="mt-3.5 space-y-2.5 text-[12px] leading-relaxed text-text-muted">
          <p>
            Bobot komponen <span className="tabular font-medium text-text">0,65 / 0,20 / 0,15</span>,
            bobot tiap indikator, skor tiap kategori (Doktor 100 … SLTA 60, hukuman disiplin
            100/75/50/25/0, keragaman &amp; substansi riwayat jabatan), dan ambang potkom{' '}
            <span className="tabular font-medium text-text">≥80 / ≥68 / &lt;68</span> semuanya
            tersimpan sebagai{' '}
            <span className="font-medium text-text">rubrik per jabatan target</span> dan diubah lewat{' '}
            <Link
              href="/jabatan-target"
              className="font-medium text-accent underline-offset-2 hover:underline"
            >
              editor rubrik
            </Link>
            .
          </p>
          <p>
            Angka-angka itu <span className="font-medium text-text">sengaja tidak</span> disalin ke
            halaman ini. Dua tempat menyimpan satu angka berarti keduanya harus sepakat, dan bentuk
            kegagalannya bukan pesan galat melainkan dua halaman yang memberi skor berbeda untuk
            orang yang sama. Yang ada di halaman ini hanya parameter yang berlaku{' '}
            <span className="font-medium text-text">lintas jabatan target</span>.
          </p>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          judul="Keamanan & sesi"
          deskripsi="Berlaku pada sesi yang DIBUAT setelah perubahan — sesi yang sedang berjalan tetap memakai tenggat lamanya."
        />
        <div className="mt-3.5">
          <FormPengaturan baris={menurutDaftar(baris, KELOMPOK_KEAMANAN)} />
        </div>
      </Panel>

      {/* Penadah. Parameter yang ditambahkan ke DB tapi belum ditempatkan ke
          kelompok mana pun muncul di sini alih-alih hilang tanpa jejak —
          halaman yang diam-diam menyembunyikan parameter lebih berbahaya
          daripada halaman yang tampak belum rapi. */}
      {lainnya.length > 0 ? (
        <Panel>
          <PanelHeader
            judul="Belum dikelompokkan"
            deskripsi="Parameter ini ada di database tapi belum ditempatkan ke kelompok mana pun di halaman. Tetap bisa diubah."
          />
          <div className="mt-3.5">
            <FormPengaturan baris={lainnya} />
          </div>
        </Panel>
      ) : null}
    </div>
  )
}

/**
 * Pengelompokan tampilan. Sisanya ditangkap panel "Belum dikelompokkan" di atas.
 *
 * **Urutan di dalam tiap daftar dipakai apa adanya**, bukan diurutkan menurut
 * kunci. `ambilBarisPengaturan()` mengurutkan `ORDER BY kunci`, dan untuk skala
 * predikat itu menghasilkan urutan alfabetis — Baik, Butuh Perbaikan, Kurang,
 * Sangat Baik, Sangat Kurang. Skala yang WAJIB menurun tapi dipajang teracak
 * mengundang pengguna melanggar syaratnya, lalu penolakannya terbaca seperti
 * kesalahan aplikasi. Karena itu `menurutDaftar()` di bawah.
 */
const KELOMPOK_PENILAIAN = ['masa_berlaku_asesmen_tahun', 'tahun_asesmen_aktif']
const KELOMPOK_SKALA = [
  'ambang_sumbu_atas',
  'ambang_sumbu_tengah',
  'bobot_talenta_kinerja',
  'bobot_talenta_potensial',
]
const KELOMPOK_PREDIKAT = [
  'skor_predikat_sangat_baik',
  'skor_predikat_baik',
  'skor_predikat_butuh_perbaikan',
  'skor_predikat_kurang',
  'skor_predikat_sangat_kurang',
]
const KELOMPOK_KEAMANAN = [
  'sesi_idle_menit',
  'sesi_maksimal_jam',
  'maks_gagal_masuk',
  'kunci_akun_menit',
]

/** Baris yang kuncinya ada di `daftar`, DALAM urutan daftar itu. */
function menurutDaftar(baris: BarisPengaturan[], daftar: string[]): BarisPengaturan[] {
  return daftar
    .map((k) => baris.find((b) => b.kunci === k))
    .filter((b): b is BarisPengaturan => !!b)
}
