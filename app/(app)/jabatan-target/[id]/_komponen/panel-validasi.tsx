import { CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react'

import { cn } from '@/lib/cn'
import type { HasilValidasiRubrik } from '@/lib/scoring'

/**
 * Hasil pemeriksaan rubrik. Server Component — murni tampilan, tidak perlu
 * mengirim JavaScript apa pun (CLAUDE.md #4).
 *
 * Setiap temuan menampilkan **pesan + saran**, bukan kode galat. Rubrik yang
 * salah tetap menghasilkan angka yang kelihatan wajar (mesin rubrik sengaja tidak
 * melempar), jadi satu-satunya cara pengguna tahu ada yang salah adalah panel ini
 * — dan panel yang cuma berbunyi "tidak valid" memaksa orang menebak.
 */
export function PanelValidasi({
  hasil,
  jumlahAnggota,
}: {
  hasil: HasilValidasiRubrik
  jumlahAnggota: number
}) {
  const bisaAktif = hasil.bisaDiaktifkan && jumlahAnggota > 0

  if (hasil.temuan.length === 0 && jumlahAnggota > 0) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-success-border bg-success-subtle px-4 py-3">
        <CircleCheck className="mt-0.5 size-4 shrink-0 text-success" />
        <div>
          <p className="text-[13px] font-medium text-text">Rubrik lolos seluruh pemeriksaan</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
            Bobot komponen berjumlah 100%, bobot indikator sama dengan bobot komponennya, dan setiap
            rentang ambang kontinu — tidak ada nilai pegawai yang akan jatuh ke kategori terdekat.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-lg border',
        hasil.jumlahGalat > 0 || jumlahAnggota === 0
          ? 'border-danger-border bg-danger-subtle'
          : 'border-warning-border bg-warning-subtle',
      )}
    >
      <div className="flex items-start gap-3 px-4 py-3">
        {hasil.jumlahGalat > 0 || jumlahAnggota === 0 ? (
          <CircleAlert className="mt-0.5 size-4 shrink-0 text-danger" />
        ) : (
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
        )}
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-text">
            {hasil.jumlahGalat > 0
              ? `${hasil.jumlahGalat} galat menghalangi aktivasi`
              : jumlahAnggota === 0
                ? 'Belum ada jabatan anggota'
                : `${hasil.jumlahPeringatan} peringatan`}
            {hasil.jumlahGalat > 0 && hasil.jumlahPeringatan > 0
              ? ` · ${hasil.jumlahPeringatan} peringatan`
              : ''}
          </p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
            {bisaAktif
              ? 'Peringatan tidak memblokir aktivasi, tapi perlu diketahui: perhitungannya tetap jalan dengan tafsiran yang dijelaskan di bawah.'
              : 'Selama masih ada galat, rubrik ini tetap bisa disimpan & dihitung — tapi tidak bisa diaktifkan, karena skornya akan salah tanpa tanda apa pun di angkanya.'}
          </p>
        </div>
      </div>

      <ul className="divide-y divide-border border-t border-border bg-surface">
        {jumlahAnggota === 0 ? (
          <li className="flex items-start gap-2.5 px-4 py-2.5">
            <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase bg-danger-subtle text-danger">
              galat
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-text">Jabatan anggota</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
                Jabatan target ini belum menunjuk posisi mana pun, jadi kandidatnya tidak punya
                sasaran.{' '}
                <span className="text-text-subtle">
                  Tambahkan minimal satu jabatan di tab Jabatan Anggota.
                </span>
              </p>
            </div>
          </li>
        ) : null}

        {hasil.temuan.map((t, i) => (
          <li key={`${t.kode}-${t.indikatorId ?? t.komponenId ?? i}`} className="flex items-start gap-2.5 px-4 py-2.5">
            <span
              className={cn(
                'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase',
                t.tingkat === 'GALAT'
                  ? 'bg-danger-subtle text-danger'
                  : 'bg-warning-subtle text-warning',
              )}
            >
              {t.tingkat === 'GALAT' ? 'galat' : 'perhatian'}
            </span>
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-text">{t.nama}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-text-muted">
                {t.pesan} <span className="text-text-subtle">{t.saran}</span>
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
