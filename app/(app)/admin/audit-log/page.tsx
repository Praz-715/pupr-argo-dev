import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { wajibMasuk } from '@/lib/auth'
import { formatAngka, formatTanggal } from '@/lib/format'
import { ambilAuditLog, ambilOpsiAudit } from '@/lib/kueri/admin'
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
  const filter = {
    userId: sp.pengguna ? Number(sp.pengguna) : undefined,
    entitas: sp.entitas,
    aksi: sp.aksi,
    dari: sp.dari,
    sampai: sp.sampai,
    cari: sp.cari,
    halaman: sp.hal ? Number(sp.hal) : 1,
  }

  const [hasil, opsi] = await Promise.all([ambilAuditLog(filter), ambilOpsiAudit()])

  const adaFilter = Boolean(
    sp.pengguna || sp.entitas || sp.aksi || sp.dari || sp.sampai || sp.cari,
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
              pengguna: sp.pengguna ?? '',
              entitas: sp.entitas ?? '',
              aksi: sp.aksi ?? '',
              dari: sp.dari ?? '',
              sampai: sp.sampai ?? '',
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
