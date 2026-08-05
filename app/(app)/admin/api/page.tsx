import { AlertTriangle, BookOpen, ScrollText } from 'lucide-react'
import Link from 'next/link'
import { Suspense } from 'react'

import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { Badge } from '@/components/ui/badge'
import { gayaTombol } from '@/components/ui/button-style'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { ListSkeleton } from '@/components/ui/skeleton'
import { wajibMasuk } from '@/lib/auth'
import { formatAngka, formatTanggal, formatTanggalWaktu } from '@/lib/format'
import { ambilDaftarKlienApi, ambilDaftarTokenApi } from '@/lib/kueri/api'
import { punyaPeran } from '@/lib/peran'
import { CabutToken, FormKlienApi, TerbitkanToken } from './_komponen/kelola-api'

export const metadata = { title: 'Klien & Token API' }

const PERAN_HALAMAN = ['Super Admin'] as const

/**
 * Manajemen Klien & Token API (PRD §6.9).
 *
 * **Klien dan token disatukan di satu halaman**, menyimpang dari PRD yang
 * mendaftarkannya sebagai dua halaman. Alasannya: token tidak punya arti tanpa
 * kliennya — pertanyaan yang selalu muncul adalah "instansi ini punya token apa
 * saja, dan mana yang masih hidup". Memisahnya berarti setiap pemeriksaan menuntut
 * berpindah halaman lalu mencocokkan sendiri.
 *
 * Yang ditampilkan bersama setiap klien: **pemakaian 7 hari terakhir**. Tanpa itu
 * halaman ini hanya mendaftar siapa yang *boleh*, bukan siapa yang *memakai* — dan
 * kredensial menganggur setahun adalah kredensial yang layak dicabut.
 */
export default async function KlienTokenApiPage() {
  const sesi = await wajibMasuk('/admin/api')

  if (!punyaPeran(sesi.pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Klien & Token API"
        deskripsiHalaman="Instansi eksternal yang boleh menarik data lewat /api/v1."
        peranAnda={sesi.pengguna.peran}
        alasan={
          <>
            Halaman ini menerbitkan kredensial yang membuat data ASN mengalir keluar dari
            aplikasi, jadi hanya{' '}
            <strong className="font-medium text-text">Super Admin</strong> yang bisa membukanya.
          </>
        }
        catatan="Pemakaian API oleh instansi yang sudah terdaftar bisa dilihat di Log Aktivitas API."
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Klien & Token API"
        deskripsi="Setiap klien hanya menerima data yang scope-nya izinkan, dan setiap pemanggilan tercatat. Token disimpan sebagai hash — plaintext-nya ditampilkan tepat sekali saat diterbitkan."
        aksi={
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/api/dokumentasi" className={gayaTombol({ variant: 'halus', size: 'sm' })}>
              <BookOpen className="size-3.5" />
              Dokumentasi
            </Link>
            <Link href="/admin/api/log" className={gayaTombol({ variant: 'sekunder', size: 'sm' })}>
              <ScrollText className="size-3.5" />
              Log aktivitas
            </Link>
            <FormKlienApi label="Tambah klien" />
          </div>
        }
      />

      <Suspense fallback={<ListSkeleton rows={3} />}>
        <IsiKlien />
      </Suspense>
    </div>
  )
}

async function IsiKlien() {
  const [klien, token] = await Promise.all([ambilDaftarKlienApi(), ambilDaftarTokenApi()])

  if (klien.length === 0) {
    return (
      <EmptyState
        judul="Belum ada klien API terdaftar"
        deskripsi="Klien adalah instansi yang boleh menarik data lewat /api/v1. Setiap klien butuh nomor MoU/PKS sebelum bisa berstatus AKTIF."
      />
    )
  }

  return (
    <div className="space-y-4">
      {klien.map((k) => {
        const tokenKlien = token.filter((t) => t.apiClientId === k.id)
        return (
          <Panel key={k.id}>
            <PanelHeader
              judul={
                <span className="flex flex-wrap items-center gap-2">
                  {k.namaInstansi}
                  <code className="text-[12px] text-text-subtle">{k.kodeInstansi}</code>
                  <Badge
                    tone={
                      k.status === 'AKTIF' ? 'sukses' : k.status === 'PENDING' ? 'peringatan' : 'netral'
                    }
                  >
                    {k.status}
                  </Badge>
                  {k.scope.dataPersonal ? <Badge tone="bahaya">data personal</Badge> : null}
                </span>
              }
              deskripsi={[
                k.noMou ? `MoU ${k.noMou}` : 'tanpa nomor MoU',
                k.contactPerson ?? null,
                k.email ?? null,
              ]
                .filter(Boolean)
                .join(' · ')}
              aksi={
                <div className="flex flex-wrap gap-2">
                  <FormKlienApi
                    label="Ubah"
                    awal={{
                      id: k.id,
                      namaInstansi: k.namaInstansi,
                      kodeInstansi: k.kodeInstansi,
                      contactPerson: k.contactPerson ?? '',
                      email: k.email ?? '',
                      noMou: k.noMou ?? '',
                      status: k.status,
                      endpoints: k.scope.endpoints,
                      dataPersonal: k.scope.dataPersonal,
                    }}
                  />
                  {k.status === 'AKTIF' ? (
                    <TerbitkanToken apiClientId={k.id} kodeInstansi={k.kodeInstansi} />
                  ) : null}
                </div>
              }
            />

            {k.status === 'AKTIF' && !k.noMou ? (
              <p className="mt-2 flex items-start gap-1.5 text-[12px] text-danger">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Klien AKTIF tanpa nomor MoU/PKS — dasar hukum berbagi data ASN tidak tercatat.
              </p>
            ) : null}

            {k.scopeTidakTerbaca ? (
              <p className="mt-2 flex items-start gap-1.5 text-[12px] text-warning">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                Kolom scope ada isinya tapi bentuknya tidak dikenali, jadi diperlakukan sebagai
                tanpa izin. Simpan ulang lewat tombol Ubah untuk membetulkannya.
              </p>
            ) : null}

            <dl className="mt-3 grid gap-3 text-[12px] sm:grid-cols-4">
              <Ringkas label="Endpoint diizinkan">
                {k.scope.endpoints.length === 0 ? (
                  <span className="text-text-subtle">tidak ada</span>
                ) : (
                  <span className="text-text">{k.scope.endpoints.join(', ')}</span>
                )}
              </Ringkas>
              <Ringkas label="Token aktif">
                <span className="tabular-nums text-text">
                  {formatAngka(k.jumlahTokenAktif)}
                  <span className="text-text-subtle"> / {formatAngka(k.jumlahTokenTotal)}</span>
                </span>
              </Ringkas>
              <Ringkas label="Permintaan 7 hari">
                <span className="tabular-nums text-text">{formatAngka(k.permintaan7Hari)}</span>
                {k.permintaanDitolak7Hari > 0 ? (
                  <span className="text-warning"> · {formatAngka(k.permintaanDitolak7Hari)} ditolak</span>
                ) : null}
              </Ringkas>
              <Ringkas label="Terakhir dipakai">
                <span className="text-text">
                  {k.terakhirDipakai ? formatTanggalWaktu(k.terakhirDipakai) : 'belum pernah'}
                </span>
              </Ringkas>
            </dl>

            {tokenKlien.length === 0 ? (
              <p className="mt-3 text-[12px] text-text-subtle">
                Belum ada token. Klien tidak bisa memanggil apa pun sampai satu token diterbitkan.
              </p>
            ) : (
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[38rem] text-[13px]">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-subtle">
                      <th className="px-2 py-1.5 font-medium">Label</th>
                      <th className="px-2 py-1.5 font-medium">Status</th>
                      <th className="px-2 py-1.5 font-medium">Berlaku sampai</th>
                      <th className="px-2 py-1.5 font-medium">Terakhir dipakai</th>
                      <th className="px-2 py-1.5 font-medium">Diterbitkan</th>
                      <th className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {tokenKlien.map((t) => (
                      <tr key={t.id} className="border-b border-border-subtle last:border-0">
                        <td className="px-2 py-1.5 text-text">{t.label ?? `token #${t.id}`}</td>
                        <td className="px-2 py-1.5">
                          {t.status === 'DICABUT' ? (
                            <Badge tone="netral">dicabut</Badge>
                          ) : t.kedaluwarsa ? (
                            <Badge tone="peringatan">kedaluwarsa</Badge>
                          ) : (
                            <Badge tone="sukses">aktif</Badge>
                          )}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-text-muted">
                          {t.expiredAt ? formatTanggal(t.expiredAt) : 'tanpa tenggat'}
                        </td>
                        <td className="px-2 py-1.5 tabular-nums text-text-muted">
                          {t.lastUsedAt ? formatTanggalWaktu(t.lastUsedAt) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-text-muted">
                          {formatTanggal(t.createdAt)}
                          {t.namaPenerbit ? ` · ${t.namaPenerbit}` : ''}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          {t.status === 'AKTIF' ? (
                            <CabutToken id={t.id} label={t.label ?? `token #${t.id}`} />
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )
      })}
    </div>
  )
}

function Ringkas({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-text-subtle">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}
