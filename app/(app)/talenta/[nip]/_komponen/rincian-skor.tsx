'use client'

import { ChevronDown, TriangleAlert } from 'lucide-react'
import { useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'
import { formatBobot, formatSkor } from '@/lib/format'
import type { RincianIndikator } from '@/lib/kueri/pegawai'
import { SATUAN_MENTAH } from '@/lib/penilaian'
import type { RingkasJenjang } from '@/lib/pengalaman-jenjang'
import { PilihLamaJabatan } from './pilih-lama-jabatan'
import { TombolNilaiManual } from './tombol-nilai-manual'

/**
 * Rincian match score sampai indikator & sub-indikator (usulan U-3 phase.md §8).
 *
 * Ini yang membuat pertanyaan "kenapa pegawai yang sama dapat skor berbeda antar
 * jabatan target?" bisa dijawab dari UI. Tanpa tabel ini, `match_score` hanya
 * memberi tiga angka agregat dan skornya jadi kotak hitam — bertentangan dengan
 * tujuan proyek yang menuntut penilaian transparan & akuntabel.
 *
 * Kolom `sumberNilai` dibedakan karena sebagian indikator (Lama/Keragaman/
 * Substansi Jabatan) datanya belum tentu lengkap di sistem sumber, sehingga
 * nilainya bisa berasal dari input manusia — dan itu harus terlihat.
 */
export function RincianSkor({
  rincian,
  pegawaiId,
  jabatanTargetId,
  bolehIsiManual,
  pengalaman,
}: {
  rincian: RincianIndikator[]
  pegawaiId: number
  jabatanTargetId: number
  /**
   * Lama pengalaman per jenjang, dari riwayat jabatannya — dipakai pemilih
   * "Isi manual: Lama Jabatan" (`2 sept- masukan sistem informasi.pdf` butir 3).
   * Dibaca SEKALI di halaman lalu diteruskan ke seluruh jabatan target: isinya
   * sama untuk semuanya, jadi membacanya per baris berarti 13 kali kueri yang
   * sama.
   */
  pengalaman: RingkasJenjang[]
  /**
   * Hanya Super Admin & Admin Talenta yang boleh mengisi nilai manual
   * (`PERAN_HITUNG`). Diputuskan di server dan diteruskan sebagai prop, bukan
   * dibiarkan aksinya menolak: tombol yang selalu ada tapi selalu gagal terbaca
   * sebagai fitur rusak, bukan sebagai wewenang yang tidak dimiliki.
   */
  bolehIsiManual: boolean
}) {
  const [buka, setBuka] = useState(false)

  if (rincian.length === 0) {
    return (
      <p className="mt-3 border-t border-border pt-3 text-[11px] text-text-subtle">
        Rincian per indikator belum tersedia — skor ini dihitung sebelum tabel rincian ada.
        Jalankan perhitungan ulang untuk mengisinya.
      </p>
    )
  }

  /**
   * Indikator INDUK = namanya muncul sebagai `indukNama` baris lain.
   *
   * "Nilai Pengalaman Jabatan" adalah **agregator murni**: nilainya rata-rata
   * dari Lama · Keragaman · Substansi Jabatan, bukan sesuatu yang punya nilai
   * mentah atau kategori rubriknya sendiri. Karena itu ketiga hal berikut
   * disembunyikan untuk baris seperti ini: nilai mentah, kategori terpilih, dan
   * tombol Isi manual. Yang ditampilkan cuma bobotnya (5%).
   *
   * Kenapa bukan sekadar kosmetik: menyediakan tombol Isi manual di sini berarti
   * mengizinkan seseorang menimpa hasil agregasi tanpa menyentuh satu pun
   * sub-indikatornya — angka induk lalu tidak lagi sama dengan rata-rata anaknya,
   * dan tidak ada satu pun halaman yang bisa menjelaskan selisihnya. Aturan yang
   * sama sudah berlaku di `lib/kueri/laporan.ts`, yang hanya menghitung indikator
   * DAUN supaya anak-anaknya tidak terhitung dua kali.
   */
  const namaInduk = new Set(
    rincian.map((r) => r.indukNama).filter((n): n is string => n !== null),
  )

  /**
   * Kolom "Nilai mentah" menampilkan **angkanya**, bukan kalimat kategorinya.
   *
   * Untuk indikator berkategori bernama, `nilai_mentah` yang tersimpan memang
   * nama kategorinya — `simpanNilaiManual()` menuntut nilainya sama persis dengan
   * salah satu nama itu. Menampilkannya apa adanya berarti satu sel memuat
   * kalimat 70 karakter ("Memiliki pengalaman jabatan lintas Unit Organisasi/di
   * luar Bina Konstruksi") yang mendorong lima kolom lain keluar layar, padahal
   * kalimat itu sudah tampil utuh di kolom "Kategori terpilih" di sebelahnya.
   *
   * Kalau namanya tidak bisa dicocokkan ke kategori mana pun (mis. rubriknya
   * disunting setelah nilainya disimpan), teksnya **tetap ditampilkan** — bukan
   * diganti tanda hubung. Menyembunyikan nilai yang tidak dikenali akan membuat
   * baris itu tampak belum diisi, dan orang akan mengisinya ulang.
   */
  const samakan = (t: string) => t.trim().replace(/\s+/g, ' ').toLowerCase()

  function nilaiMentahTampil(r: RincianIndikator): { teks: string; judul: string } {
    if (r.nilaiMentah === null) return { teks: '—', judul: '' }
    const mentah = r.nilaiMentah.trim()
    const angka = Number(mentah)
    if (mentah !== '' && !Number.isNaN(angka)) {
      /*
        Satuan ikut ditulis kalau indikatornya punya (lihat `SATUAN_MENTAH`).
        Tanpa itu "0,89" duduk sebaris dengan "95,49" (skor Potkom) dan "100"
        (nilai kategori) — tiga besaran berbeda yang berbentuk sama persis.
      */
      const satuan = r.kunciSistem === null ? undefined : SATUAN_MENTAH[r.kunciSistem]
      if (satuan) {
        return {
          teks: `${formatSkor(angka)} ${satuan.satuan}`,
          judul: satuan.jelaskan(angka),
        }
      }
      return { teks: formatSkor(angka), judul: mentah }
    }

    const cocok = r.kategori.find((k) => samakan(k.nama) === samakan(mentah))
    return cocok?.nilai !== null && cocok?.nilai !== undefined
      ? { teks: formatSkor(cocok.nilai), judul: `${mentah} → ${cocok.nilai}` }
      : { teks: mentah, judul: mentah }
  }

  const perluReview = rincian.filter((r) => r.perluReview)
  const manual = rincian.filter((r) => r.sumberNilai === 'MANUAL')

  return (
    <div className="mt-3 border-t border-border pt-3">
      <button
        type="button"
        onClick={() => setBuka(!buka)}
        aria-expanded={buka}
        className="flex w-full items-center gap-2 text-[11px] font-medium text-accent hover:underline"
      >
        <ChevronDown className={cn('size-3.5 transition-transform', buka && 'rotate-180')} />
        {buka ? 'Sembunyikan' : 'Lihat'} rincian perhitungan ({rincian.length} indikator)
        {perluReview.length > 0 ? (
          <Badge tone="peringatan" className="ml-1">
            {perluReview.length} perlu ditinjau
          </Badge>
        ) : null}
        {manual.length > 0 ? (
          <Badge tone="aksen" className="ml-1">
            {manual.length} nilai manual
          </Badge>
        ) : null}
      </button>

      {buka ? (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[38rem] text-[12px]">
            <thead>
              <tr className="border-b border-border text-left text-[10px] tracking-wide text-text-subtle uppercase">
                <th className="py-1.5 pr-3 font-medium">Indikator</th>
                <th className="px-3 py-1.5 text-right font-medium">Bobot</th>
                <th className="px-3 py-1.5 font-medium">Nilai mentah</th>
                <th className="px-3 py-1.5 font-medium">Kategori terpilih</th>
                <th className="px-3 py-1.5 text-right font-medium">Skor</th>
                {bolehIsiManual ? (
                  <th className="py-1.5 pl-3 text-right font-medium">
                    <span className="sr-only">Isi manual</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {rincian.map((r, i) => {
                const sub = r.indukNama !== null
                const agregator = !sub && namaInduk.has(r.namaIndikator)
                return (
                  <tr key={`${r.namaIndikator}-${i}`} className="border-b border-border last:border-b-0">
                    <td className={cn('py-1.5 pr-3', sub && 'pl-4')}>
                      <span className="flex items-center gap-1.5">
                        {sub ? (
                          <span aria-hidden className="text-text-subtle">
                            └
                          </span>
                        ) : null}
                        <span className={sub ? 'text-text-muted' : 'font-medium text-text'}>
                          {r.namaIndikator}
                        </span>
                        {agregator ? (
                          <span
                            className="text-[10px] text-text-subtle"
                            title="Nilainya rata-rata dari sub-indikator di bawahnya, jadi ia tidak punya nilai mentah maupun kategori rubrik sendiri"
                          >
                            (rata-rata sub-indikator)
                          </span>
                        ) : null}
                        {r.perluReview ? (
                          <span title="Nilai di luar ambang, kosong, atau dipotong — perlu ditinjau manusia">
                            <TriangleAlert className="size-3 shrink-0 text-warning" />
                          </span>
                        ) : null}
                        {r.sumberNilai === 'MANUAL' ? (
                          <Badge tone="aksen" title="Diisi manusia, bukan hasil hitung otomatis">
                            manual
                          </Badge>
                        ) : r.kunciSistem === 'LAMA_JABATAN' ? (
                          /*
                            Permintaan pemilik proses 2 Sep 2026: baris ini butuh
                            peringatan verifikasi tersendiri. Alasannya kasus Maul
                            yang nyata — nilai otomatisnya jatuh ke `tmt_jabatan`
                            (tanggal SK terakhir) begitu riwayatnya belum terpetakan
                            ke master, dan itu diam-diam salah (0,89 tahun padahal
                            9,17). Ditampilkan untuk SEMUA baris Lama Jabatan
                            otomatis, bukan hanya yang `perluReview` — mesin rubrik
                            tidak tahu sumbernya `tmt_jabatan` atau riwayat asli,
                            jadi ia tidak bisa membedakan "benar" dari "kebetulan
                            masuk akal". Hilang begitu nilainya MANUAL — pilihan
                            manusia tidak perlu diverifikasi ulang oleh dirinya
                            sendiri.
                          */
                          <Badge
                            tone="peringatan"
                            title="Dihitung otomatis dari riwayat jabatan — kalau riwayatnya belum lengkap di sistem, angka ini bisa jatuh ke tanggal SK terakhir dan meleset jauh. Cek lewat 'Isi manual' di sebelah kanan."
                          >
                            perlu verifikasi
                          </Badge>
                        ) : null}
                      </span>
                    </td>
                    <td className="tabular px-3 py-1.5 text-right text-text-subtle">
                      {r.bobot === null ? (
                        <span title="Sub-indikator digabung ke induknya lewat rata-rata">
                          rata-rata
                        </span>
                      ) : (
                        formatBobot(r.bobot)
                      )}
                    </td>
                    {/* Induk: kedua sel dibiarkan KOSONG, bukan "—". Tanda hubung
                        menyatakan "ada tempatnya tapi datanya belum ada", padahal
                        di sini tempatnya memang tidak ada. */}
                    <td className="tabular px-3 py-1.5 text-text-muted">
                      {agregator ? (
                        ''
                      ) : (
                        <span title={nilaiMentahTampil(r).judul}>{nilaiMentahTampil(r).teks}</span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-text-subtle">
                      {agregator ? null : (
                        <span
                          className="block max-w-[16rem] break-words"
                          title={r.kategoriTerpilih ?? ''}
                        >
                          {r.kategoriTerpilih ?? '—'}
                        </span>
                      )}
                    </td>
                    <td className="tabular px-3 py-1.5 text-right font-medium text-text">
                      {formatSkor(r.skor)}
                    </td>
                    {bolehIsiManual ? (
                      <td className="py-1.5 pl-3 text-right whitespace-nowrap">
                        {agregator ? null : r.kunciSistem === 'LAMA_JABATAN' ? (
                          /*
                            Lama Jabatan punya dialognya sendiri: yang dipilih
                            bukan kategori rubrik (ambangnya angka, bukan nama)
                            melainkan JENJANG mana yang dipakai, dan tiap pilihan
                            perlu membawa angkanya beserta riwayat yang
                            membentuknya. Permintaan pemilik proses 2 Sep 2026.
                          */
                          <PilihLamaJabatan
                            namaIndikator={r.namaIndikator}
                            nilaiSekarang={r.nilaiMentah}
                            pegawaiId={pegawaiId}
                            jabatanTargetId={jabatanTargetId}
                            rubrikIndikatorId={r.rubrikIndikatorId}
                            pengalaman={pengalaman}
                          />
                        ) : (
                          <TombolNilaiManual
                            rincian={r}
                            pegawaiId={pegawaiId}
                            jabatanTargetId={jabatanTargetId}
                          />
                        )}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
            </tbody>
          </table>

          <p className="mt-2 text-[11px] leading-relaxed text-text-subtle">
            Sub-indikator (baris berindentasi) digabung ke indikator induknya lewat rata-rata; nilai
            indikator lalu dikalikan bobotnya untuk membentuk skor komponen. Indikator bertanda{' '}
            <TriangleAlert className="inline size-3 text-warning" /> berarti nilainya di luar
            rentang rubrik, kosong, atau dipotong ke 0–100 — perlu ditinjau manusia.
          </p>

          {bolehIsiManual ? (
            <p className="mt-1.5 text-[11px] leading-relaxed text-text-subtle">
              <strong className="font-medium text-text-muted">Isi manual</strong> memilih kategori
              dari rubrik jabatan target ini — dipakai ketika data sumbernya belum ada. Nilainya
              tersimpan beserta alasan &amp; siapa yang mengisinya, lalu{' '}
              <strong className="font-medium text-text-muted">langsung dihitung</strong>: skor
              indikator, skor total, dan peringkat talent pool ikut diperbarui saat itu.
              Perhitungan ulang berikutnya tidak menghapusnya.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
