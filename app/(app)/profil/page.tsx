import { Building2, Clock, Mail, ShieldCheck, UserRound } from 'lucide-react'

import { FormGantiSandi } from '@/components/auth/form-ganti-sandi'
import { Badge } from '@/components/ui/badge'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { wajibMasuk } from '@/lib/auth'
import { kueriSatu } from '@/lib/db'
import { formatTanggalWaktu } from '@/lib/format'
import { lingkupData, ringkasLingkup } from '@/lib/lingkup'
import { DESKRIPSI_PERAN } from '@/lib/peran'
import { daftarSesiAktif } from '@/lib/sesi'
import { DaftarSesi } from './_komponen/daftar-sesi'

export const metadata = { title: 'Profil Saya' }

/**
 * Profil Saya (PRD §6.1).
 *
 * Isinya tiga hal yang hanya bisa dijawab dari sini: **siapa saya di mata
 * sistem** (peran & unit — penentu apa yang terlihat di seluruh aplikasi),
 * **sandi saya**, dan **di mana saja akun saya sedang terbuka**.
 *
 * Nama, email, dan unit sengaja **tidak bisa diubah sendiri**. Ketiganya
 * menentukan lingkup data (`lib/lingkup.ts`) dan jadi identitas di `audit_log`;
 * membiarkan pemiliknya menggeser sendiri berarti jejak audit bisa diarahkan.
 * Perubahannya lewat Super Admin, dan itu ditulis di halaman — bukan dibiarkan
 * jadi field yang tampak bisa diklik tapi ternyata mati.
 */
export default async function ProfilPage() {
  const sesi = await wajibMasuk('/profil')
  const { pengguna } = sesi

  const [akun, sesiAktif] = await Promise.all([
    kueriSatu<{ last_login_at: string | null; password_diubah_pada: string | null }>(
      'SELECT last_login_at, password_diubah_pada FROM users WHERE id = ?',
      [pengguna.id],
    ),
    daftarSesiAktif(pengguna.id, sesi.sesiId),
  ])

  const lingkup = lingkupData(pengguna)
  const catatanLingkup = ringkasLingkup(lingkup)

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Profil Saya"
        deskripsi="Identitas akun, sandi, dan perangkat tempat akun ini sedang terbuka."
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
        <div className="space-y-4">
          <Panel>
            <PanelHeader
              judul="Identitas akun"
              deskripsi="Diubah oleh Super Admin lewat Manajemen Pengguna — bukan dari sini, karena peran & unit menentukan data apa yang boleh Anda lihat."
            />
            <dl className="mt-3.5 grid gap-3 sm:grid-cols-2">
              <Baris ikon={<UserRound className="size-4" />} label="Nama" nilai={pengguna.nama} />
              <Baris
                ikon={<UserRound className="size-4" />}
                label="Username"
                nilai={pengguna.username}
                mono
              />
              <Baris ikon={<Mail className="size-4" />} label="Email" nilai={pengguna.email} />
              <Baris
                ikon={<Building2 className="size-4" />}
                label="Unit organisasi"
                nilai={pengguna.namaUnit ?? '— tidak ditautkan ke unit (akses pusat) —'}
              />
            </dl>

            <div className="mt-4 rounded-md border border-border bg-surface-inset px-3 py-2.5">
              <p className="flex items-start gap-2 text-[12px] leading-relaxed text-text-muted">
                <ShieldCheck className="mt-px size-4 shrink-0 text-text-subtle" />
                <span>
                  <Badge tone="aksen">{pengguna.peran}</Badge>{' '}
                  <span className="ml-0.5">{DESKRIPSI_PERAN[pengguna.peran]}</span>
                  {catatanLingkup ? (
                    <span className="mt-1.5 block font-medium text-text">{catatanLingkup}</span>
                  ) : null}
                </span>
              </p>
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              judul="Perangkat yang sedang terbuka"
              deskripsi={
                sesiAktif.length === 1
                  ? 'Hanya perangkat ini.'
                  : `${sesiAktif.length} sesi aktif. Akhiri yang tidak Anda kenali, lalu ganti sandi.`
              }
            />
            <div className="mt-3.5">
              <DaftarSesi sesi={sesiAktif} />
            </div>
          </Panel>
        </div>

        <div className="space-y-4">
          <Panel>
            <PanelHeader judul="Ganti sandi" />
            <div className="mt-3.5">
              <FormGantiSandi username={pengguna.username} />
            </div>
          </Panel>

          <Panel>
            <PanelHeader judul="Riwayat akun" />
            <dl className="mt-3.5 space-y-3">
              <Baris
                ikon={<Clock className="size-4" />}
                label="Masuk terakhir"
                nilai={akun?.last_login_at ? formatTanggalWaktu(akun.last_login_at) : '—'}
              />
              <Baris
                ikon={<Clock className="size-4" />}
                label="Sandi terakhir diubah"
                nilai={
                  akun?.password_diubah_pada ? formatTanggalWaktu(akun.password_diubah_pada) : '—'
                }
              />
              <Baris
                ikon={<Clock className="size-4" />}
                label="Sesi ini berakhir"
                nilai={formatTanggalWaktu(sesi.kedaluwarsaPada)}
              />
            </dl>
          </Panel>
        </div>
      </div>
    </div>
  )
}

function Baris({
  ikon,
  label,
  nilai,
  mono,
}: {
  ikon: React.ReactNode
  label: string
  nilai: string
  mono?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span aria-hidden className="mt-0.5 shrink-0 text-text-subtle">
        {ikon}
      </span>
      <span className="min-w-0">
        <dt className="text-[11px] uppercase tracking-wide text-text-subtle">{label}</dt>
        <dd className={`text-[13px] text-text ${mono ? 'font-mono' : ''}`}>{nilai}</dd>
      </span>
    </div>
  )
}
