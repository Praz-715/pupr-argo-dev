import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { wajibMasuk } from '@/lib/auth'
import { formatAngka, formatTanggal } from '@/lib/format'
import { ambilAuditLog, ambilOpsiAudit } from '@/lib/kueri/admin'
import { angkaPositif, nomorHalaman, tanggalIso } from '@/lib/param'
import { punyaPeran } from '@/lib/peran'
import { FilterAudit } from './_komponen/filter-audit'
import { PaginasiAudit } from './_komponen/paginasi-audit'
import { TabelAudit } from './_komponen/tabel-audit'

export const metadata = { title: 'Audit Log' }

const PERAN_HALAMAN = ['Super Admin'] as const

type ParamHalaman = Promise<Record<string, string | undefined>>

/**
 * Audit Log Viewer (PRD §6.8).
 *
 * `jalankanMutasi()` sudah mengisi tabel ini sejak Fase 4 — yang belum ada
 * sampai sekarang cuma cara membacanya. Jejak audit yang tidak bisa dibaca
 * siapa pun secara praktis sama dengan tidak ada jejak audit; ia hanya
 * memenuhi syarat di atas kertas.
 *
 * Akses BACA ditolak di server: isinya memuat nilai sebelum & sesudah dari
 * SELURUH mutasi, termasuk baris yang aslinya hanya boleh dilihat peran
 * tertentu. (`hukuman_disiplin` sudah menjaga diri dengan tidak menyalin
 * uraian pelanggaran ke audit — lihat `lib/aksi/hukuman-disiplin.ts`.)
 */
export default async function AuditLogPage({ searchParams }: { searchParams: ParamHalaman }) {
  const sesi = await wajibMasuk('/admin/audit-log')

  if (!punyaPeran(sesi.pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Audit Log"
        deskripsiHalaman="Jejak seluruh perubahan data penting."
        peranAnda={sesi.pengguna.peran}
        alasan={
          <>
            Audit log memuat isi sebelum &amp; sesudah dari seluruh mutasi di aplikasi, termasuk
            baris yang aslinya dibatasi peran tertentu, jadi hanya{' '}
            <strong className="font-medium text-text">Super Admin</strong> yang bisa membukanya.
          </>
        }
        catatan="Riwayat perubahan pada satu entitas tertentu tetap bisa dilihat dari halaman entitas itu sendiri, sebatas yang boleh Anda akses."
      />
    )
  }

  const sp = await searchParams

  /**
   * Seluruh param divalidasi di boundary lewat `lib/param` — bukan diteruskan
   * apa adanya. Sebelum ini, `Number(sp.hal)` meneruskan `NaN` ke `OFFSET` dan
   * `sp.dari` meneruskan teks bebas ke pembanding `DATETIME`, sehingga satu
   * karakter salah di URL menjatuhkan halaman dengan galat MySQL.
   *
   * Tanggal yang tidak sah **diabaikan**, bukan ditolak dengan pesan galat:
   * penyaring tanggal bukan bagian identitas halaman, dan URL yang rusak
   * biasanya tautan yang terpotong saat dibagikan. Yang diabaikan tetap
   * terlihat, karena `adaFilter` di bawah dihitung dari nilai yang **lolos**
   * validasi — jadi keadaan kosong menyebut "belum ada jejak", bukan
   * "tidak ada yang cocok dengan filter" yang tidak pernah dipakai.
   */
  const dari = tanggalIso(sp.dari)
  const sampai = tanggalIso(sp.sampai)
  const filter = {
    userId: angkaPositif(sp.pengguna),
    entitas: sp.entitas,
    aksi: sp.aksi,
    dari,
    sampai,
    cari: sp.cari,
    halaman: nomorHalaman(sp.hal),
  }

  const [hasil, opsi] = await Promise.all([ambilAuditLog(filter), ambilOpsiAudit()])

  const adaFilter = Boolean(
    filter.userId || sp.entitas || sp.aksi || dari || sampai || sp.cari,
  )

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Audit Log"
        deskripsi={
          opsi.rentang.paling_lama
            ? `${formatAngka(hasil.total)} baris cocok · seluruh jejak dari ${formatTanggal(opsi.rentang.paling_lama)} sampai ${formatTanggal(opsi.rentang.paling_baru)}. Setiap baris menyimpan isi sebelum & sesudah, jadi pertanyaan "berubah dari apa" bisa dijawab.`
            : 'Belum ada jejak yang tercatat.'
        }
      />

      <Panel>
        <PanelHeader
          judul="Penyaring"
          deskripsi="Pilihan entitas, aksi, dan pengguna diturunkan dari isi tabel — jadi modul baru langsung muncul tanpa menyunting kode."
        />
        <div className="mt-3.5">
          <FilterAudit
            opsi={opsi}
            nilai={{
              // Yang ditampilkan adalah nilai yang LOLOS validasi, bukan isi
              // URL apa adanya — kalau `?dari=` rusak lalu tetap dipantulkan ke
              // input, penyaringnya terlihat aktif padahal kueri mengabaikannya.
              pengguna: filter.userId ? String(filter.userId) : '',
              entitas: sp.entitas ?? '',
              aksi: sp.aksi ?? '',
              dari: dari ?? '',
              sampai: sampai ?? '',
              cari: sp.cari ?? '',
            }}
          />
        </div>
      </Panel>

      {hasil.baris.length === 0 ? (
        <EmptyState
          judul={adaFilter ? 'Tidak ada jejak yang cocok' : 'Belum ada jejak audit'}
          deskripsi={
            adaFilter
              ? 'Longgarkan penyaring — mis. hapus rentang tanggal atau pilih semua entitas.'
              : 'Jejak akan terisi sendiri begitu ada perubahan data. Setiap mutasi lewat satu pintu tulis yang selalu mencatatnya.'
          }
        />
      ) : (
        <div className="space-y-3">
          <TabelAudit baris={hasil.baris} />
          <PaginasiAudit
            halaman={hasil.halaman}
            perHalaman={hasil.perHalaman}
            total={hasil.total}
          />
        </div>
      )}
    </div>
  )
}
