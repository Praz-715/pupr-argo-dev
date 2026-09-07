'use client'

import { ChevronDown, ChevronRight } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { diffAudit, labelField, tampilNilai } from '@/lib/diff-audit'
import { formatTanggalWaktu } from '@/lib/format'
import type { BarisAuditTampil } from '@/lib/kueri/admin'

/**
 * Daftar audit + panel perubahan per baris.
 *
 * Rincian **tidak** dimuat lewat permintaan terpisah: isinya sudah ikut di
 * baris yang sama (kolom JSON `data_sebelum`/`data_sesudah`), jadi memuatnya
 * ulang saat dibuka hanya menambah tunggu untuk data yang sudah ada di layar.
 *
 * Bukan `<table>`: tiap baris bisa mekar jadi panel selebar penuh, dan baris
 * tabel yang isinya `colspan` penuh tidak pernah sejajar lagi dengan header di
 * atasnya. Satu `grid-template` yang sama dipakai header dan tiap baris, jadi
 * kolomnya benar-benar segaris.
 */
const KOLOM =
  'grid grid-cols-[2rem_10rem_minmax(8rem,1fr)_7.5rem_minmax(8rem,1fr)_minmax(8rem,1.2fr)_6.5rem]'

export function TabelAudit({ baris }: { baris: BarisAuditTampil[] }) {
  const [terbuka, setTerbuka] = useState<Set<number>>(new Set())

  function toggle(id: number) {
    setTerbuka((s) => {
      const baru = new Set(s)
      if (baru.has(id)) baru.delete(id)
      else baru.add(id)
      return baru
    })
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <div className="min-w-[60rem]">
        <div
          role="row"
          className={cn(
            KOLOM,
            'border-b border-border bg-surface-2 text-[11px] font-medium uppercase tracking-wide text-text-subtle',
          )}
        >
          <span className="px-2 py-2" />
          <span className="px-3 py-2">Waktu</span>
          <span className="px-3 py-2">Pelaku</span>
          <span className="px-3 py-2">Aksi</span>
          <span className="px-3 py-2">Entitas</span>
          <span className="px-3 py-2">Perubahan</span>
          <span className="px-3 py-2">IP</span>
        </div>

        {baris.map((b) => {
          const d = diffAudit(b.dataSebelum, b.dataSesudah)
          const buka = terbuka.has(b.id)
          return (
            <div key={b.id} className="border-b border-border last:border-0">
              <button
                type="button"
                onClick={() => toggle(b.id)}
                aria-expanded={buka}
                className={cn(
                  KOLOM,
                  'w-full items-start text-left text-[13px] transition-colors hover:bg-surface-2',
                  buka && 'bg-surface-2/60',
                )}
              >
                <span className="flex justify-center px-2 py-2.5 text-text-subtle">
                  {buka ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                </span>
                <span className="px-3 py-2.5 tabular-nums text-text-muted">
                  {formatTanggalWaktu(b.createdAt)}
                </span>
                <span className="min-w-0 px-3 py-2.5">
                  <span className="block break-words text-text">
                    {b.namaPengguna ?? <span className="text-text-subtle">sistem</span>}
                  </span>
                  {b.peranPengguna ? (
                    <span className="block break-words text-[11px] text-text-subtle">
                      {b.peranPengguna}
                    </span>
                  ) : null}
                </span>
                <span className="px-3 py-2.5">
                  <Badge tone={nadaAksi(b.aksi)}>{b.aksi}</Badge>
                </span>
                <span className="min-w-0 px-3 py-2.5 font-mono text-[12px] break-all text-text-muted">
                  {b.entitas}
                  {b.entitasId !== null ? `#${b.entitasId}` : ''}
                </span>
                <span className="min-w-0 px-3 py-2.5 text-[12px] break-words text-text-muted">
                  {ringkasPerubahan(
                    d.berubah.map((x) => x.field),
                    d.satuSisi,
                  )}
                </span>
                <span className="px-3 py-2.5 font-mono text-[11px] break-all text-text-subtle">
                  {b.ipAddress ?? '—'}
                </span>
              </button>

              {buka ? (
                <div className="border-t border-border bg-surface-2/30 px-4 py-3">
                  {d.berubah.length === 0 ? (
                    <p className="text-[12px] leading-relaxed text-text-muted">
                      Tidak ada field yang nilainya berubah. Barisnya tetap tercatat karena ada
                      perintah tulis yang benar-benar dijalankan — mis. menyimpan formulir tanpa
                      mengubah apa pun.
                    </p>
                  ) : (
                    <table className="w-full border-collapse text-[12px]">
                      <thead>
                        <tr className="text-left text-[10px] uppercase tracking-wide text-text-subtle">
                          <th className="w-1/4 pb-1.5 pr-3 font-medium">Field</th>
                          <th className="w-[37.5%] pb-1.5 pr-3 font-medium">Sebelum</th>
                          <th className="w-[37.5%] pb-1.5 font-medium">Sesudah</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.berubah.map((p) => (
                          <tr key={p.field} className="border-t border-border/60 align-top">
                            <td className="py-1.5 pr-3 text-text-muted">{labelField(p.field)}</td>
                            <td className="py-1.5 pr-3">
                              <span className="break-all rounded bg-danger-subtle px-1.5 py-0.5 text-danger">
                                {tampilNilai(p.sebelum)}
                              </span>
                            </td>
                            <td className="py-1.5">
                              <span className="break-all rounded bg-success-subtle px-1.5 py-0.5 text-success">
                                {tampilNilai(p.sesudah)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {d.tetap.length > 0 ? (
                    <details className="mt-2.5">
                      <summary className="cursor-pointer text-[11px] text-text-subtle hover:text-text">
                        {d.tetap.length} field lain tidak berubah
                      </summary>
                      <p className="mt-1.5 break-all font-mono text-[11px] leading-relaxed text-text-subtle">
                        {d.tetap.map((t) => `${t.field}=${tampilNilai(t.sesudah)}`).join(' · ')}
                      </p>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function ringkasPerubahan(field: string[], satuSisi: boolean): string {
  if (field.length === 0) return '—'
  if (satuSisi) return `${field.length} field`
  if (field.length <= 3) return field.join(', ')
  return `${field.slice(0, 2).join(', ')} +${field.length - 2} lainnya`
}

/**
 * Nada badge per aksi. Peristiwa autentikasi yang GAGAL diberi nada bahaya —
 * itu satu-satunya baris di audit log yang bisa menandakan serangan, jadi ia
 * harus terlihat saat halaman dipindai sekilas, bukan setelah dibaca satu-satu.
 */
function nadaAksi(aksi: string): 'netral' | 'aksen' | 'sukses' | 'peringatan' | 'bahaya' {
  if (aksi === 'MASUK_GAGAL' || aksi === 'AKUN_TERKUNCI' || aksi === 'HAPUS') return 'bahaya'
  if (aksi === 'BUAT' || aksi === 'MASUK') return 'sukses'
  if (aksi === 'RESET_DIMINTA' || aksi === 'SANDI_DIGANTI' || aksi === 'UBAH_STATUS')
    return 'peringatan'
  if (aksi === 'RECOMPUTE' || aksi === 'IMPOR') return 'aksen'
  return 'netral'
}
