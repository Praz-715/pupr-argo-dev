import { ShieldAlert } from 'lucide-react'

import { PageHeader } from './panel'

/**
 * Penolakan akses tingkat halaman.
 *
 * Dibuat di Fase 7 karena polanya sudah muncul di lima halaman (Hukuman
 * Disiplin, Perbandingan Kandidat, dan tiga halaman Administrasi) dengan
 * susunan yang sama. Yang berbeda antar halaman hanya **alasannya** — dan
 * alasan itu justru bagian yang paling berharga: tanpa itu pengguna hanya tahu
 * ia ditolak, tidak tahu apakah itu memang seharusnya atau akunnya salah
 * disetel.
 *
 * Komponen ini **tidak** menegakkan apa pun. Penegakannya tetap `punyaPeran()`
 * di server sebelum kueri apa pun dijalankan; ini hanya cara memberitahunya.
 */
export function AksesDitolak({
  judulHalaman,
  deskripsiHalaman,
  alasan,
  peranAnda,
  catatan,
}: {
  judulHalaman: string
  deskripsiHalaman?: string
  /** Kenapa halaman ini dibatasi — bukan "Anda tidak punya akses". */
  alasan: React.ReactNode
  peranAnda: string
  /** Jalan keluar atau padanan yang masih boleh diakses. */
  catatan?: React.ReactNode
}) {
  return (
    <div className="space-y-5">
      <PageHeader judul={judulHalaman} deskripsi={deskripsiHalaman} />
      <div className="rounded-lg border border-danger-border bg-danger-subtle px-4 py-4">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-danger" />
          <div>
            <p className="text-[14px] font-semibold text-text">Akses ditolak</p>
            <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-text-muted">
              {alasan} Peran Anda saat ini —{' '}
              <strong className="font-medium text-text">{peranAnda}</strong> — tidak termasuk.
            </p>
            {catatan ? (
              <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-text-subtle">
                {catatan}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
