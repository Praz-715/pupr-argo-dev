import Link from 'next/link'

import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { wajibMasuk } from '@/lib/auth'
import { ambilBarisPengaturan } from '@/lib/pengaturan'
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
  const lainnya = baris.filter(
    (b) => !KELOMPOK_PENILAIAN.includes(b.kunci) && !KELOMPOK_KEAMANAN.includes(b.kunci),
  )

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
          <FormPengaturan baris={baris.filter((b) => KELOMPOK_PENILAIAN.includes(b.kunci))} />
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
          judul="Keamanan & sesi"
          deskripsi="Berlaku pada sesi yang DIBUAT setelah perubahan — sesi yang sedang berjalan tetap memakai tenggat lamanya."
        />
        <div className="mt-3.5">
          <FormPengaturan baris={baris.filter((b) => KELOMPOK_KEAMANAN.includes(b.kunci))} />
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

/** Pengelompokan tampilan. Sisanya ditangkap panel "Belum dikelompokkan" di atas. */
const KELOMPOK_PENILAIAN = ['masa_berlaku_asesmen_tahun', 'tahun_asesmen_aktif']
const KELOMPOK_KEAMANAN = [
  'sesi_idle_menit',
  'sesi_maksimal_jam',
  'maks_gagal_masuk',
  'kunci_akun_menit',
]
