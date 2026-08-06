import { Suspense } from 'react'

import { AksesDitolak } from '@/components/ui/akses-ditolak'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader, Panel, PanelHeader } from '@/components/ui/panel'
import { TableSkeleton } from '@/components/ui/skeleton'
import { wajibMasuk } from '@/lib/auth'
import { formatAngka } from '@/lib/format'
import { ambilKategoriDiklat } from '@/lib/kueri/kategori-riwayat'
import { punyaPeran } from '@/lib/peran'
import { FormKategoriDiklat } from './_komponen/form-kategori'

export const metadata = { title: 'Kategori Riwayat Diklat' }

const PERAN_HALAMAN = ['Super Admin', 'Admin Talenta'] as const

/**
 * Master Kategori Riwayat Diklat (`doc/sql/014`).
 *
 * Isinya diturunkan dari `doc/doc_tambahan_2/sample(1).md` lembar 6 "Persyaratan
 * Jabatan" + PP 11/2017. Yang membuat halaman ini ada — bukan sekadar konstanta
 * di kode — adalah kata kunci pengusulnya: daftar kata kunci yang hidup di kode
 * akan menua tanpa ada yang berani menyentuhnya, sementara daftar yang bisa
 * disunting Admin Talenta ikut tumbuh bersama data.
 *
 * **Halaman ini mendefinisikan kategori, bukan menerapkannya.** Penerapan ada di
 * `/data/validasi-riwayat` dengan daftar peran yang berbeda (termasuk Pengelola
 * Unit, PRD §3).
 */
export default async function KategoriDiklatPage() {
  const sesi = await wajibMasuk('/master/kategori-diklat')

  if (!punyaPeran(sesi.pengguna, PERAN_HALAMAN)) {
    return (
      <AksesDitolak
        judulHalaman="Kategori Riwayat Diklat"
        deskripsiHalaman="Kamus kategori pelatihan yang dipakai menilai Pengembangan Kompetensi."
        peranAnda={sesi.pengguna.peran}
        alasan={
          <>
            Kamus ini menentukan diklat mana yang dianggap relevan untuk sebuah jabatan target, jadi
            ia memengaruhi skor seluruh pegawai. Perubahannya dibatasi ke{' '}
            <strong className="font-medium text-text">Admin Talenta</strong> dan{' '}
            <strong className="font-medium text-text">Super Admin</strong>.
          </>
        }
        catatan="Menerapkan kategori ke diklat pegawai ada di halaman Validasi Riwayat, yang terbuka juga untuk Pengelola Unit."
      />
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        judul="Kategori Riwayat Diklat"
        deskripsi="Kamus kategori pelatihan (Manajerial / Teknis / Fungsional), diturunkan dari Persyaratan Jabatan PP 11/2017. Kata kunci di sini hanya MENGUSULKAN kategori — keputusannya dikonfirmasi manusia di Validasi Riwayat."
      />

      <Suspense fallback={<TableSkeleton rows={8} cols={['2fr', '1fr', '1fr', '2fr', '0.8fr']} />}>
        <IsiKategori />
      </Suspense>
    </div>
  )
}

async function IsiKategori() {
  const baris = await ambilKategoriDiklat({ termasukNonaktif: true })

  if (baris.length === 0) {
    return (
      <EmptyState
        judul="Belum ada kategori"
        deskripsi="Tanpa kategori, seluruh nama diklat di antrian validasi tidak punya pilihan apa pun."
      />
    )
  }

  const rumpun = baris.filter((k) => k.parentId === null)
  const tanpaPola = baris.filter((k) => k.aktif && k.polaCocok.length === 0)
  // Rumpun tidak bisa dipilih saat memetakan diklat (memetakan ke "Pelatihan
  // Teknis" tanpa menyebut teknis apa membuat syarat pelatihan tak terperiksa).
  // Rumpun tanpa turunan karena itu **tidak bisa dipakai sama sekali** — keadaan
  // yang tidak menimbulkan galat, hanya kategori yang tak pernah terpakai.
  const idBerinduk = new Set(baris.filter((k) => k.parentId !== null).map((k) => k.parentId!))
  const rumpunKosong = rumpun.filter((k) => k.aktif && !idBerinduk.has(k.id))

  return (
    <div className="space-y-4">
      <Panel padat>
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-3.5 py-3">
          <PanelHeader
            judul={`${baris.length} kategori · ${rumpun.length} rumpun`}
            deskripsi="Diurutkan menurut rumpunnya. Kolom terakhir: berapa nama diklat yang sudah dipetakan ke kategori ini."
          />
          <FormKategoriDiklat
            label="Tambah kategori"
            indukTersedia={rumpun.map((r) => ({ id: r.id, nama: r.nama }))}
          />
        </div>

        {tanpaPola.length > 0 ? (
          <p className="border-b border-border-subtle px-3.5 py-2.5 text-[12px] text-warning">
            {tanpaPola.length} kategori aktif tanpa kata kunci pengusul (
            {tanpaPola.map((k) => k.kode).join(', ')}) — kategorinya tetap bisa dipilih manual, tapi
            tidak akan pernah muncul sebagai usulan.
          </p>
        ) : null}

        {rumpunKosong.length > 0 ? (
          <p className="border-b border-border-subtle px-3.5 py-2.5 text-[12px] text-warning">
            {rumpunKosong.length} rumpun aktif belum punya turunan (
            {rumpunKosong.map((k) => k.kode).join(', ')}) — <strong>belum bisa dipakai</strong>.
            Rumpun tidak bisa dipilih saat memetakan diklat, karena memetakan ke &ldquo;Pelatihan
            Teknis&rdquo; tanpa menyebut teknis apa membuat syarat pelatihan tidak bisa diperiksa.
            Tambahkan minimal satu kategori di bawahnya.
          </p>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-[13px]">
            <thead>
              <tr className="border-b border-border text-left text-[11px] tracking-wide text-text-subtle uppercase">
                <th className="px-3.5 py-2 font-medium">Kategori</th>
                <th className="px-2 py-2 font-medium">Jenis</th>
                <th className="px-2 py-2 font-medium">Setara jenjang</th>
                <th className="px-2 py-2 font-medium">Kata kunci pengusul</th>
                <th className="px-2 py-2 text-right font-medium">Dipakai</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {baris.map((k) => (
                <tr key={k.id} className="border-b border-border-subtle last:border-0">
                  <td className="px-3.5 py-2.5">
                    <span className={k.parentId !== null ? 'pl-4' : ''}>
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium text-text">{k.nama}</span>
                        <code className="text-[11px] text-text-subtle">{k.kode}</code>
                        {k.aktif ? null : <Badge tone="netral">nonaktif</Badge>}
                        {k.parentId === null ? <Badge tone="netral">rumpun</Badge> : null}
                      </span>
                      {k.keterangan ? (
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-text-subtle">
                          {k.keterangan}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-text-muted">{k.jenis.replace('_', ' ')}</td>
                  <td className="px-2 py-2.5 text-text-muted">
                    {k.setaraJenjang ?? <span className="text-text-subtle">—</span>}
                  </td>
                  <td className="px-2 py-2.5">
                    {k.polaCocok.length === 0 ? (
                      <span className="text-text-subtle">—</span>
                    ) : (
                      <span className="flex flex-wrap gap-1">
                        {k.polaCocok.map((p) => (
                          <code
                            key={p}
                            className="rounded border border-border bg-surface-3 px-1.5 py-0.5 text-[11px] text-text-muted"
                          >
                            {p}
                          </code>
                        ))}
                      </span>
                    )}
                  </td>
                  <td className="tabular px-2 py-2.5 text-right text-text">
                    {formatAngka(k.jumlahDipakai)}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <FormKategoriDiklat
                      label="Ubah"
                      indukTersedia={rumpun.map((r) => ({ id: r.id, nama: r.nama }))}
                      awal={{
                        id: k.id,
                        kode: k.kode,
                        nama: k.nama,
                        jenis: k.jenis,
                        parentId: k.parentId,
                        setaraJenjang: k.setaraJenjang ?? '',
                        polaCocok: k.polaCocok.join('\n'),
                        keterangan: k.keterangan ?? '',
                        urutan: k.urutan,
                        aktif: k.aktif,
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          judul="Kenapa tidak ada tombol hapus"
          deskripsi="Ditulis di sini supaya tidak dikira kelupaan."
        />
        <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-text-muted">
          Kategori yang sudah dipakai adalah dasar skor Pengembangan Kompetensi yang mungkin sudah
          ikut menentukan peringkat kandidat. Menghapusnya membuat skor lama tidak bisa
          dipertanggungjawabkan lagi (&ldquo;kenapa nilainya 100 padahal kategorinya tidak ada?&rdquo;).
          Yang tersedia: <strong className="font-medium text-text">nonaktifkan</strong> — pemetaan
          lama tetap utuh, tapi kategorinya tidak bisa dipilih untuk pemetaan baru. Pola yang sama
          dipakai Data Hukuman Disiplin.
        </p>
      </Panel>
    </div>
  )
}
