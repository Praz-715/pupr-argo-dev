import { CircleAlert, CircleCheck, CircleMinus } from 'lucide-react'
import { Suspense } from 'react'

import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { Skeleton, TableSkeleton } from '@/components/ui/skeleton'
import { formatAngka, formatTanggalWaktu } from '@/lib/format'
import { ambilRiwayatSync, ambilStatusSumber } from '@/lib/kueri/kualitas'

export const metadata = { title: 'Konsolidasi & Sinkronisasi Data' }

/**
 * Konsolidasi & Sinkronisasi Data (PRD §6.7).
 *
 * **Tombol "trigger sync manual" sengaja belum ada di sini.** PRD memintanya,
 * tapi tombol itu hanya bermakna kalau ada yang bisa dipanggil: sumber produksi
 * (eHRM/eNominasi/eKinerja) belum diputuskan mekanismenya — batch berkas atau
 * API/webhook masih pertanyaan terbuka no. 7 di phase.md §9. Memasang tombol yang
 * memanggil importer terhadap sumber yang belum ada berarti membuat kontrol yang
 * pasti gagal, dan itu lebih buruk daripada tidak ada tombol: pengguna akan
 * menyimpulkan sinkronisasinya rusak.
 *
 * Yang bisa dikerjakan sekarang tanpa menebak: menampilkan keadaan tiap sumber
 * dengan jujur, termasuk **kegagalan** — karena sinkronisasi gagal adalah
 * penyebab paling umum angka dashboard terlihat aneh.
 */
export default async function KonsolidasiPage() {
  return (
    <div className="space-y-5">
      <PageHeader
        judul="Konsolidasi & Sinkronisasi Data"
        deskripsi="Keadaan tiap sumber data dan riwayat sinkronisasinya. Sinkronisasi yang gagal ditandai jelas — itu penyebab paling umum angka di dashboard terlihat aneh."
      />

      <Suspense fallback={<SumberSkeleton />}>
        <IsiSumber />
      </Suspense>

      <Suspense fallback={<RiwayatSkeleton />}>
        <IsiRiwayat />
      </Suspense>
    </div>
  )
}

async function IsiSumber() {
  const sumber = await ambilStatusSumber()

  if (sumber.length === 0) {
    return (
      <EmptyState
        judul="Belum ada riwayat sinkronisasi"
        deskripsi="Tabel sync_log masih kosong. Riwayat akan terisi begitu proses impor pertama dijalankan."
      />
    )
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {sumber.map((s) => {
        /**
         * Sumber tanpa jalur sinkronisasi di kode TIDAK boleh memajang status
         * sukses. Sebelumnya eKinerja tampil bercentang hijau "SUKSES" — angka itu
         * benar sebagai isi `sync_log`, tapi barisnya benih dev, dan tidak ada satu
         * pun klien eKinerja yang bisa menuliskannya. Yang terbaca pengguna:
         * integrasinya jalan. Dilaporkan user 12 Agu 2026.
         *
         * Karena itu untuk sumber BELUM_ADA_JALUR: ikon status dinetralkan, lencana
         * statusnya diganti keterangan bahwa riwayatnya data contoh, dan angka
         * sukses/gagalnya tetap ditampilkan — tapi di bawah label yang menyatakan
         * asalnya.
         */
        const belum = s.keadaan === 'BELUM_ADA_JALUR'
        return (
        <Panel key={s.sumber}>
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-text">{s.sumber}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-text-subtle">
                {s.jenisData.join(' · ') || 'Tanpa keterangan jenis data'}
              </p>
            </div>
            {belum ? (
              <Badge tone="netral" title="Belum ada klien untuk sumber ini di kode aplikasi">
                Belum tersambung
              </Badge>
            ) : (
              <IkonStatus status={s.terakhirStatus} />
            )}
          </div>

          <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-[11px]">
            <div className="flex justify-between gap-2">
              <dt className="text-text-subtle">Jalur sinkronisasi</dt>
              <dd className="max-w-[60%] text-right text-text-muted">{s.jalur}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-subtle">Status terakhir</dt>
              <dd>
                {belum ? (
                  <span className="text-warning">belum pernah disinkronkan</span>
                ) : s.terakhirStatus === null ? (
                  <span className="text-text-subtle">—</span>
                ) : (
                  <Badge tone={toneStatus(s.terakhirStatus)}>{s.terakhirStatus}</Badge>
                )}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              {/* Untuk sumber yang belum tersambung, "Terakhir dijalankan"
                  menegaskan ada proses yang pernah berjalan — bertentangan dengan
                  baris di atasnya yang menyatakan belum pernah disinkronkan.
                  Labelnya diubah, tanggalnya tetap ditampilkan karena ia jejak
                  benih yang berguna saat menelusuri asal angkanya. */}
              <dt className="text-text-subtle">
                {belum ? 'Baris contoh terakhir' : 'Terakhir dijalankan'}
              </dt>
              <dd className="tabular text-right text-text-muted">
                {s.terakhirMulai === null ? '—' : formatTanggalWaktu(s.terakhirMulai)}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-subtle">
                {belum ? 'Baris contoh' : 'Total baris masuk'}
              </dt>
              <dd className="tabular text-text-muted">{formatAngka(s.totalBaris)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-text-subtle">
                {belum ? 'Riwayat contoh (S/S/G)' : 'Sukses / sebagian / gagal'}
              </dt>
              <dd className="tabular text-text-muted">
                {s.jumlahSukses} / {s.jumlahSebagian} /{' '}
                <span className={s.jumlahGagal > 0 ? 'font-medium text-danger' : ''}>
                  {s.jumlahGagal}
                </span>
              </dd>
            </div>
            {belum ? (
              <p className="border-t border-border pt-1.5 text-[10px] leading-relaxed text-text-subtle">
                Riwayat di atas adalah <strong className="font-medium">data contoh</strong> dari
                benih dev — dipakai menguji tampilan halaman ini. Belum ada sinkronisasi nyata dari{' '}
                {s.sumber}.
              </p>
            ) : null}
          </dl>
        </Panel>
        )
      })}
    </div>
  )
}

async function IsiRiwayat() {
  const riwayat = await ambilRiwayatSync(20)

  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <PanelHeader
          judul="Riwayat sinkronisasi"
          deskripsi={`${formatAngka(riwayat.length)} percobaan terakhir. Durasi ditampilkan karena sinkronisasi yang tiba-tiba jauh lebih cepat dari biasanya biasanya berarti ia berhenti di tengah, bukan bekerja lebih baik.`}
        />
      </div>

      {riwayat.length === 0 ? (
        <div className="p-4">
          <EmptyState judul="Belum ada riwayat" deskripsi="Tabel sync_log masih kosong." />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13px]">
            <thead className="bg-surface-2">
              <tr className="border-b border-border text-left text-[11px] font-medium tracking-wide text-text-subtle uppercase">
                <th className="px-3 py-2">Sumber &amp; jenis data</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Baris</th>
                <th className="px-3 py-2">Mulai</th>
                <th className="px-3 py-2 text-right">Durasi</th>
                <th className="px-3 py-2">Dijalankan oleh</th>
              </tr>
            </thead>
            <tbody>
              {riwayat.map((r) => (
                <tr
                  key={r.id}
                  className={
                    r.status === 'GAGAL'
                      ? 'border-b border-border bg-danger-subtle/40 last:border-b-0'
                      : 'border-b border-border last:border-b-0'
                  }
                >
                  <td className="px-3 py-2">
                    <span className="block font-medium text-text">{r.sumber}</span>
                    <span className="block max-w-[18rem] truncate text-[11px] text-text-subtle">
                      {r.jenisData}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <Badge tone={toneStatus(r.status)}>{r.status}</Badge>
                    {r.catatanError ? (
                      <span className="mt-1 block max-w-[22rem] text-[11px] leading-relaxed text-danger">
                        {r.catatanError}
                      </span>
                    ) : null}
                  </td>
                  <td className="tabular px-3 py-2 text-right text-text-muted">
                    {r.jumlahBaris === null ? '—' : formatAngka(r.jumlahBaris)}
                  </td>
                  <td className="tabular px-3 py-2 text-text-muted">
                    {formatTanggalWaktu(r.mulaiPada)}
                  </td>
                  <td className="tabular px-3 py-2 text-right text-text-muted">
                    {r.durasiDetik === null ? (
                      <span className="text-text-subtle" title="Belum selesai">
                        berjalan
                      </span>
                    ) : (
                      `${formatAngka(r.durasiDetik)} s`
                    )}
                  </td>
                  <td className="px-3 py-2 text-text-muted">{r.dijalankanOleh ?? 'Sistem'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="border-t border-border px-3.5 py-3 text-[11px] leading-relaxed text-text-subtle">
        <strong className="font-medium text-text-muted">Tombol sinkronisasi manual belum
        dipasang.</strong> Mekanisme sumber produksi (batch berkas atau API/webhook dari
        eHRM/eNominasi/eKinerja) masih pertanyaan terbuka, dan tombol yang memanggil sumber yang
        belum ada hanya akan selalu gagal — itu membuat pengguna menyimpulkan sinkronisasinya rusak.
        Aturan normalisasinya sendiri sudah siap & teruji di <code className="font-mono text-[10px]">lib/importer</code>.
      </p>
    </Panel>
  )
}

function toneStatus(status: string): 'sukses' | 'peringatan' | 'bahaya' | 'netral' {
  if (status === 'SUKSES') return 'sukses'
  if (status === 'SEBAGIAN') return 'peringatan'
  if (status === 'GAGAL') return 'bahaya'
  return 'netral'
}

function IkonStatus({ status }: { status: string | null }) {
  if (status === 'SUKSES') return <CircleCheck className="size-4 shrink-0 text-success" />
  if (status === 'GAGAL') return <CircleAlert className="size-4 shrink-0 text-danger" />
  if (status === 'SEBAGIAN') return <CircleAlert className="size-4 shrink-0 text-warning" />
  return <CircleMinus className="size-4 shrink-0 text-text-subtle" />
}

function SumberSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {[1, 2, 3, 4].map((i) => (
        <Panel key={i}>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-3 w-full" />
          <div className="mt-3 space-y-2 border-t border-border pt-3">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
        </Panel>
      ))}
    </div>
  )
}

function RiwayatSkeleton() {
  return (
    <Panel padat>
      <div className="border-b border-border px-3.5 py-3">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
      </div>
      <TableSkeleton rows={8} cols={['1.6fr', '1.4fr', '0.6fr', '1.2fr', '0.6fr', '1fr']} />
    </Panel>
  )
}
