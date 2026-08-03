import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { wajibMasuk } from '@/lib/auth'
import {
  ambilDaftarPengguna,
  ambilOpsiPeran,
  ambilOpsiUnitRingkas,
  ambilPermintaanReset,
} from '@/lib/kueri/admin'
import { angkaPositif } from '@/lib/param'
import { punyaPeran } from '@/lib/peran'
import { AntrianReset } from './_komponen/antrian-reset'
import { FilterPengguna } from './_komponen/filter-pengguna'
import { TabelPengguna } from './_komponen/tabel-pengguna'

export const metadata = { title: 'Manajemen Pengguna & Peran' }

const PERAN_HALAMAN = ['Super Admin'] as const

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Manajemen Pengguna & Peran (PRD §6.10).
 *
 * **Akses BACA ditolak di server**, mengikuti pola halaman Hukuman Disiplin:
 * daftar pengguna memuat email, unit, dan pola aktivitas seluruh staf, dan
 * menyembunyikan menunya saja tidak cukup karena URL bisa ditebak.
 */
export default async function ManajemenPenggunaPage({
  searchParams,
}: {
  searchParams: ParamHalaman
}) {
  const sesi = await wajibMasuk('/admin/pengguna')

  if (!punyaPeran(sesi.pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Manajemen Pengguna & Peran"
        deskripsiHalaman="Kelola akun internal, peran, dan lingkup unitnya."
        peranAnda={sesi.pengguna.peran}
        alasan={
          <>
            Halaman ini menentukan siapa yang boleh melakukan apa di seluruh aplikasi, jadi hanya{' '}
            <strong className="font-medium text-text">Super Admin</strong> yang bisa membukanya.
          </>
        }
        catatan="Untuk mengubah peran atau unit akun Anda sendiri, hubungi Super Admin — data itu menentukan apa yang Anda lihat, jadi tidak bisa diubah sendiri."
      />
    )
  }

  const sp = await searchParams
  const [daftar, opsiPeran, opsiUnit, permintaan] = await Promise.all([
    ambilDaftarPengguna({
      cari: sp.cari,
      roleId: angkaPositif(sp.peran),
      status: sp.status === 'aktif' || sp.status === 'nonaktif' ? sp.status : undefined,
    }),
    ambilOpsiPeran(),
    ambilOpsiUnitRingkas(),
    ambilPermintaanReset(),
  ])

  const aktif = daftar.filter((u) => u.statusAktif).length
  const sesiHidup = daftar.reduce((n, u) => n + u.sesiAktif, 0)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Manajemen Pengguna & Peran"
        deskripsi={`${aktif} akun aktif dari ${daftar.length} terdaftar · ${sesiHidup} sesi sedang berjalan. Peran menentukan menu yang terlihat DAN aksi yang diizinkan di server — keduanya dari satu sumber.`}
      />

      {permintaan.length > 0 ? (
        <Panel>
          <PanelHeader
            judul={`${permintaan.length} permintaan lupa sandi menunggu`}
            deskripsi="Belum ada transport surel, jadi tidak ada tautan reset otomatis. Terbitkan sandi sementara lalu serahkan lewat jalur kepegawaian."
          />
          <div className="mt-3.5">
            <AntrianReset permintaan={permintaan} />
          </div>
        </Panel>
      ) : null}

      <Panel>
        <PanelHeader
          judul="Akun internal"
          deskripsi="Menonaktifkan akun atau mengubah perannya langsung memutus sesi yang sedang berjalan — bukan menunggu pemiliknya keluar sendiri."
        />
        <div className="mt-3.5 space-y-3.5">
          <FilterPengguna
            opsiPeran={opsiPeran}
            cari={sp.cari ?? ''}
            roleId={sp.peran ?? ''}
            status={sp.status ?? ''}
          />
          <TabelPengguna
            daftar={daftar}
            opsiPeran={opsiPeran}
            opsiUnit={opsiUnit}
            idSaya={sesi.pengguna.id}
          />
        </div>
      </Panel>
    </div>
  )
}
