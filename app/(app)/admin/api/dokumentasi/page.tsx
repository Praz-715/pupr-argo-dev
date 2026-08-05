import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { Badge } from '@/components/ui/badge'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { BATAS_PERMINTAAN_PER_MENIT } from '@/lib/api/gerbang'
import { ENDPOINT_V1 } from '@/lib/api/scope'
import { wajibMasuk } from '@/lib/auth'
import { punyaPeran } from '@/lib/peran'

export const metadata = { title: 'Dokumentasi API' }

const PERAN_HALAMAN = ['Super Admin', 'Admin Talenta'] as const

interface Endpoint {
  metode: 'GET'
  jalur: string
  scope: (typeof ENDPOINT_V1)[number]
  butuhDataPersonal: boolean
  ringkas: string
  param?: Array<{ nama: string; isi: string }>
}

/**
 * Daftar endpoint. `scope` mengacu ke konstanta yang **sama** dengan yang
 * ditegakkan gerbang — jadi dokumentasi tidak bisa menyebut scope yang tidak ada,
 * dan endpoint baru yang lupa didokumentasikan akan terlihat sebagai `ENDPOINT_V1`
 * yang tidak muncul di tabel ini.
 */
const ENDPOINT: Endpoint[] = [
  {
    metode: 'GET',
    jalur: '/api/v1/kotak-9/summary',
    scope: 'kotak-9-summary',
    butuhDataPersonal: false,
    ringkas:
      'Sebaran agregat 9 Kotak Manajemen Talenta beserta penyebutnya. Tidak ada baris per pegawai, jadi tidak ada data pribadi apa pun.',
  },
  {
    metode: 'GET',
    jalur: '/api/v1/pegawai',
    scope: 'pegawai',
    butuhDataPersonal: false,
    ringkas:
      'Daftar pegawai berpaginasi. Tanpa scope data personal, field nip & nama TIDAK ADA — hanya id_anonim.',
    param: [
      { nama: 'halaman', isi: 'nomor halaman, mulai 1' },
      { nama: 'unit', isi: 'id unit organisasi (termasuk seluruh turunannya)' },
      { nama: 'eselon', isi: 'I · II · III · IV · NON_ESELON' },
      { nama: 'jenjang', isi: 'nama jenjang jabatan' },
      { nama: 'cari', isi: 'potongan nama atau NIP' },
    ],
  },
  {
    metode: 'GET',
    jalur: '/api/v1/pegawai/{nip}',
    scope: 'pegawai',
    butuhDataPersonal: true,
    ringkas:
      'Detail profil satu pegawai. Selalu data pribadi — tidak ada versi tersamarkan, jadi tanpa scope data personal balasannya 403.',
  },
  {
    metode: 'GET',
    jalur: '/api/v1/talent-pool',
    scope: 'talent-pool',
    butuhDataPersonal: false,
    ringkas:
      'Kandidat talent pool per jabatan target beserta peringkat, status workflow, dan giliran berikutnya.',
    param: [
      { nama: 'jabatan_target', isi: 'id jabatan target' },
      { nama: 'status', isi: 'KANDIDAT · DINOMINASIKAN · DIVERIFIKASI · DITETAPKAN · DITOLAK' },
    ],
  },
]

const GALAT = [
  { kode: 401, nama: 'TIDAK_TERAUTENTIKASI', isi: 'Token tidak ada, tidak dikenali, dicabut, atau kedaluwarsa. Balasannya SENGAJA sama untuk keempatnya — balasan yang membedakannya akan menjadikan endpoint ini alat memverifikasi tebakan token.' },
  { kode: 403, nama: 'KLIEN_TIDAK_AKTIF', isi: 'Klien berstatus PENDING atau NONAKTIF.' },
  { kode: 403, nama: 'SCOPE_TIDAK_MENCAKUP', isi: 'Endpoint di luar scope klien, atau detail pegawai diminta tanpa scope data personal. Pesannya menyebut apa yang diizinkan.' },
  { kode: 429, nama: 'TERLALU_BANYAK', isi: `Lebih dari ${BATAS_PERMINTAAN_PER_MENIT} permintaan per menit untuk satu klien.` },
  { kode: 400, nama: 'PERMINTAAN_TIDAK_SAH', isi: 'Parameter tidak memenuhi bentuk yang diminta (mis. NIP bukan 18 digit).' },
  { kode: 404, nama: 'TIDAK_DITEMUKAN', isi: 'Sumber daya tidak ada.' },
  { kode: 500, nama: 'GALAT_INTERNAL', isi: 'Galat di sisi kami. Isi galatnya TIDAK dikirim ke klien — pesan database bisa memuat nama tabel & potongan nilai.' },
]

/**
 * Dokumentasi API (PRD §6.9).
 *
 * **Internal, bukan portal publik.** PRD menyebut "publik terbatas (butuh
 * kredensial developer)", tapi tidak ada mekanisme kredensial developer yang
 * terpisah dari sesi internal — membangunnya berarti permukaan autentikasi
 * KETIGA (sesi, Bearer, dan sesuatu untuk developer eksternal). Sampai itu
 * diputuskan, halaman ini dibaca Super Admin & Admin Talenta lalu isinya dikirim
 * ke klien lewat kanal yang sudah ada di MoU. Alasan itu ditulis di halaman.
 */
export default async function DokumentasiApiPage() {
  const sesi = await wajibMasuk('/admin/api/dokumentasi')

  if (!punyaPeran(sesi.pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Dokumentasi API"
        deskripsiHalaman="Endpoint /api/v1, autentikasi, scope, dan bentuk galat."
        peranAnda={sesi.pengguna.peran}
        alasan={
          <>
            Dokumentasi ini menyebut struktur data yang bisa ditarik instansi eksternal, jadi
            aksesnya dibatasi ke{' '}
            <strong className="font-medium text-text">Super Admin</strong> dan{' '}
            <strong className="font-medium text-text">Admin Talenta</strong>.
          </>
        }
      />
    )
  }

  return (
    <div className="space-y-5">
      <Link
        href="/admin/api"
        className="inline-flex items-center gap-1.5 text-[12px] text-text-muted hover:text-text"
      >
        <ArrowLeft className="size-3.5" />
        Klien &amp; Token API
      </Link>

      <PageHeader
        judul="Dokumentasi API v1"
        deskripsi="Read-only. Setiap pemanggilan dibatasi scope kliennya dan tercatat di log aktivitas."
      />

      <Panel>
        <PanelHeader judul="Autentikasi" />
        <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
          Sertakan token pada setiap permintaan:
        </p>
        <pre className="mt-2 overflow-x-auto rounded-md border border-border bg-surface-3 px-3 py-2.5 text-[12px] text-text">
          {`curl -H "Authorization: Bearer <token>" \\\n  https://<host>/api/v1/kotak-9/summary`}
        </pre>
        <ul className="mt-3 space-y-1.5 text-[13px] leading-relaxed text-text-muted">
          <li>
            Bentuk header <strong className="font-medium text-text">ketat</strong>:{' '}
            <code className="text-[12px]">Bearer &lt;token&gt;</code> dengan tepat satu spasi. Nama
            skemanya boleh huruf besar-kecil apa saja (RFC 6750), bentuknya tidak.
          </li>
          <li>
            Token diterbitkan Super Admin dari halaman Klien &amp; Token API dan{' '}
            <strong className="font-medium text-text">ditampilkan tepat sekali</strong>. Yang
            tersimpan hanya hash SHA-256-nya — kalau hilang, terbitkan yang baru lalu cabut yang
            lama.
          </li>
          <li>
            Balasan selalu <code className="text-[12px]">application/json</code> berbentuk{' '}
            <code className="text-[12px]">{'{ data, meta }'}</code> saat berhasil, atau{' '}
            <code className="text-[12px]">{'{ error: { kode, pesan } }'}</code> saat gagal.
          </li>
          <li>
            Batas <strong className="font-medium text-text">{BATAS_PERMINTAAN_PER_MENIT} permintaan
            per menit per klien</strong> (bukan per token).
          </li>
        </ul>
      </Panel>

      <Panel>
        <PanelHeader
          judul="Endpoint"
          deskripsi="Scope-nya mengacu ke daftar yang sama dengan yang ditegakkan gerbang — dokumentasi ini tidak bisa menyebut scope yang tidak ada."
        />
        <div className="mt-3 space-y-3">
          {ENDPOINT.map((e) => (
            <div key={e.jalur} className="rounded-lg border border-border px-3 py-2.5">
              <p className="flex flex-wrap items-center gap-2">
                <Badge tone="netral">{e.metode}</Badge>
                <code className="text-[13px] font-medium text-text">{e.jalur}</code>
                <span className="text-[11px] text-text-subtle">
                  scope <code className="text-[11px]">{e.scope}</code>
                </span>
                {e.butuhDataPersonal ? <Badge tone="bahaya">butuh data personal</Badge> : null}
              </p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">{e.ringkas}</p>
              {e.param ? (
                <dl className="mt-2 grid gap-x-4 gap-y-1 text-[12px] sm:grid-cols-2">
                  {e.param.map((p) => (
                    <div key={p.nama} className="flex gap-2">
                      <dt>
                        <code className="text-[11px] text-text">{p.nama}</code>
                      </dt>
                      <dd className="text-text-muted">{p.isi}</dd>
                    </div>
                  ))}
                </dl>
              ) : null}
            </div>
          ))}
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          judul="Penyamaran data personal"
          deskripsi="Aturan yang paling mudah salah dipahami klien."
        />
        <ul className="mt-2 space-y-1.5 text-[13px] leading-relaxed text-text-muted">
          <li>
            Tanpa scope <code className="text-[12px]">data_personal</code>, field{' '}
            <code className="text-[12px]">nip</code> &amp; <code className="text-[12px]">nama</code>{' '}
            <strong className="font-medium text-text">tidak ada</strong> — bukan bernilai{' '}
            <code className="text-[12px]">null</code>. Field yang hilang lebih jujur daripada field
            kosong, yang terbaca sebagai &ldquo;datanya belum ada&rdquo;.
          </li>
          <li>
            Sebagai gantinya ada <code className="text-[12px]">id_anonim</code> yang stabil, supaya
            baris tetap bisa dibedakan saat menghitung. Ia{' '}
            <strong className="font-medium text-text">berbeda antar klien</strong>: dua instansi yang
            membandingkan keluaran tidak bisa menyimpulkan bahwa pengenal mereka menunjuk orang yang
            sama.
          </li>
          <li>
            NIP ASN memuat tanggal lahir, TMT CPNS, dan penanda jenis kelamin. Karena itu ia
            diperlakukan sebagai data pribadi utuh, bukan sekadar nomor.
          </li>
        </ul>
      </Panel>

      <Panel>
        <PanelHeader judul="Bentuk galat" />
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[38rem] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-text-subtle">
                <th className="px-2 py-2 font-medium">HTTP</th>
                <th className="px-2 py-2 font-medium">kode</th>
                <th className="px-2 py-2 font-medium">Kapan</th>
              </tr>
            </thead>
            <tbody>
              {GALAT.map((g) => (
                <tr key={g.nama} className="border-b border-border-subtle last:border-0">
                  <td className="px-2 py-2 tabular-nums text-text">{g.kode}</td>
                  <td className="px-2 py-2">
                    <code className="text-[12px] text-text-muted">{g.nama}</code>
                  </td>
                  <td className="px-2 py-2 leading-relaxed text-text-muted">{g.isi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <PanelHeader judul="Kenapa halaman ini internal, bukan portal publik" />
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-text-muted">
          PRD §6.9 menyebut dokumentasi sebagai &ldquo;publik terbatas (butuh kredensial
          developer)&rdquo;. Kredensial developer yang terpisah dari sesi internal berarti permukaan
          autentikasi <strong className="font-medium text-text">ketiga</strong> — di samping sesi dan
          Bearer token — beserta pendaftaran, pemulihan sandi, dan pencabutannya sendiri. Sampai itu
          diputuskan, isi halaman ini dikirim ke klien lewat kanal yang sudah ada di MoU/PKS. Yang
          hilang karenanya cuma kenyamanan; yang dihindari adalah satu jalur masuk lagi yang harus
          dijaga.
        </p>
      </Panel>
    </div>
  )
}
