import { ArrowRight } from 'lucide-react'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Panel, PanelHeader } from '@/components/ui/panel'
import { ListSkeleton, Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { formatAngka } from '@/lib/format'
import { ambilJabatanKosong } from '@/lib/kueri/dashboard'

/**
 * W5 · Jabatan strategis (eselon I–III) yang kosong.
 *
 * Yang paling penting di sini bukan daftar kosongnya, tapi **mana yang belum
 * punya jabatan target** — jabatan kosong tanpa profil jabatan target berarti
 * belum ada kandidat yang bisa dinilai sama sekali. Itu yang diurutkan ke atas.
 */
export async function JabatanKosong() {
  // 20, bukan bawaan 8: sejak daftarnya bergulir di dalam panel bertinggi tetap,
  // menambah baris tidak lagi memanjangkan halaman — jadi batas kecil hanya
  // menyembunyikan data tanpa manfaat. Footer tetap menyatakan kalau terpotong.
  const { daftar, total } = await ambilJabatanKosong(20)

  if (total === 0) {
    return (
      <Panel id="jabatan-kosong">
        <PanelHeader judul="Jabatan strategis kosong" />
        <EmptyState
          className="mt-4"
          judul="Semua jabatan strategis terisi"
          deskripsi="Tidak ada jabatan eselon I–III berstatus kosong saat ini."
        />
        {/* Keadaan kosong TETAP diberi jalan keluar. "Semua terisi hari ini"
            bukan berarti tidak ada yang akan kosong tahun depan — dan proyeksi
            itu ada di halaman yang sama. Keadaan kosong tanpa langkah berikutnya
            adalah tempat orang berhenti. */}
        <p className="mt-3 text-center text-[11px]">
          <Link
            href="/jabatan-target#risiko-kekosongan"
            className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
          >
            Lihat proyeksi risiko kekosongan
            <ArrowRight aria-hidden className="size-3" />
          </Link>
        </p>
      </Panel>
    )
  }

  return (
    <Panel id="jabatan-kosong" padat className="flex min-h-0 flex-col scroll-mt-20">
      <div className="shrink-0 border-b border-border p-4">
        <PanelHeader
          judul="Jabatan strategis kosong"
          deskripsi={`${formatAngka(total)} jabatan eselon I–III berstatus kosong. Yang belum punya profil jabatan target ditampilkan lebih dulu.`}
        />
      </div>

      {/* Daftar bergulir DI DALAM panel, bukan memanjangkan panelnya.
          `min-h-0` wajib: tanpa itu flex item tidak boleh lebih pendek dari
          isinya, `overflow-y-auto` tidak pernah aktif, dan panelnya tetap
          tumbuh setiap ada jabatan kosong baru — persis yang dihindari. */}
      <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
        {daftar.map((j) => (
          <li key={j.id} className="flex items-start gap-3 px-4 py-3">
            <span className="tabular mt-0.5 w-8 shrink-0 rounded bg-surface-3 py-0.5 text-center text-[10px] font-semibold text-text-muted">
              {j.eselon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium text-text">{j.namaJabatan}</span>
              <span className="block text-[11px] text-text-subtle break-words">
                {j.namaUnit ?? 'Unit belum tertaut'} · {j.jenjang}
              </span>
            </span>
            <span className="shrink-0 text-right">
              {!j.punyaJabatanTarget ? (
                <Badge tone="bahaya">Belum ada jabatan target</Badge>
              ) : j.suksesorDitetapkan > 0 ? (
                <Badge tone="sukses">
                  {formatAngka(j.suksesorDitetapkan)} suksesor ditetapkan
                </Badge>
              ) : j.kandidatSiap > 0 ? (
                <Badge tone="aksen">{formatAngka(j.kandidatSiap)} kandidat siap</Badge>
              ) : (
                <Badge tone="peringatan">Belum ada kandidat lolos syarat</Badge>
              )}
            </span>
          </li>
        ))}
      </ul>

      {/* Dulu KALIMAT, sekarang TAUTAN. Dua hal yang salah dengan versi lama:
          ia menyuruh pengguna pergi ke suatu halaman tanpa membawanya ke sana —
          jalan buntu yang paling menjengkelkan justru karena ia tahu jawabannya —
          dan nama yang disebutnya, "halaman Jabatan Kosong & Risiko", **sudah
          tidak ada** sejak Fase 11 meleburkan `/master/jabatan-kosong` ke
          `/jabatan-target`. Menyebut halaman yang tidak ada membuat orang mencari
          di sidebar dan menyimpulkan menunya hilang.

          Anchor `#jabatan-kosong` penting: `/jabatan-target` dibuka dengan daftar
          jabatan targetnya lebih dulu, jadi tanpa anchor pengguna mendarat di
          panel yang bukan yang diklik. Panel tujuannya sudah punya `scroll-mt`. */}
      <div className="shrink-0 border-t border-border px-4 py-2.5 text-[11px] text-text-subtle">
        {total > daftar.length
          ? `Menampilkan ${formatAngka(daftar.length)} dari ${formatAngka(total)} jabatan. `
          : ''}
        <Link
          href="/jabatan-target#jabatan-kosong"
          className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
        >
          Lihat selengkapnya beserta proyeksi risiko kekosongan
          <ArrowRight aria-hidden className="size-3" />
        </Link>
      </div>
    </Panel>
  )
}

export function JabatanKosongSkeleton() {
  return (
    <Panel>
      <Skeleton className="h-4 w-44" />
      <Skeleton className="mt-2 h-3 w-full max-w-md" />
      <div className="mt-4">
        <ListSkeleton rows={5} />
      </div>
    </Panel>
  )
}
