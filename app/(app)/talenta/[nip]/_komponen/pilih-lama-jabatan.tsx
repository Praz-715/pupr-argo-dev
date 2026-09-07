'use client'

import { PencilLine } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Bidang, kelasInput } from '@/components/ui/bidang'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { simpanNilaiManual } from '@/lib/aksi/skoring'
import { formatSkor, formatTanggal } from '@/lib/format'
import type { RingkasJenjang } from '@/lib/pengalaman-jenjang'

/**
 * "Isi manual: Lama Jabatan" sebagai **PILIHAN jenjang**, bukan isian angka.
 *
 * Permintaan pemilik proses (`2 sept- masukan sistem informasi.pdf`, butir 3):
 * *"Agar dibuatkan dalam penilaian isi manual ini adalah pilihan dan VERIFIKATOR
 * tinggal pilih mana yang akan digunakan: Lama Pengalaman pada jenjang Jabatan
 * Pengawas … Administrator … Pimpinan Tinggi Pratama/Eselon II."*
 *
 * Contohnya yang ia sebut: Maul terbaca **0,89 tahun** (dari `tmt_jabatan`)
 * padahal pengalaman Pengawas-nya **9,17 tahun** — tiga baris riwayat yang belum
 * dipetakan ke master sehingga tidak pernah ikut dihitung.
 *
 * ## Kenapa dialog SENDIRI, bukan `EditorBagian` seperti indikator lain
 *
 * Yang dipilih di sini bukan salah satu kategori rubrik (ambangnya angka, bukan
 * nama), melainkan **jenjang mana yang dipakai** — dan tiap pilihan perlu membawa
 * angkanya, jumlah barisnya, serta daftar riwayat yang membentuknya. Sebuah
 * `<select>` satu baris tidak bisa memperlihatkan itu, padahal justru itu yang
 * membuat verifikator bisa memutuskan alih-alih menebak.
 *
 * ## Yang tersimpan tetap ANGKA
 *
 * Rubrik Lama Jabatan berambang (≥5 → 100 · ≥2 → 80 · <2 → 60), jadi nilai
 * mentahnya harus angka tahun. Nama jenjang yang dipilih masuk ke **catatan**,
 * bukan ke nilainya — kalau ia ikut jadi nilai, `simpanNilaiManual()` akan menolak
 * (nilainya tidak sama dengan kategori mana pun) dan penolakannya tidak akan bisa
 * ditebak penggunanya.
 *
 * ## Boleh memilih LEBIH DARI SATU jenjang
 *
 * Permintaan susulan pemilik proses 2 Sep 2026: *"bisa multi juga ya, kecuali yang
 * pilih angka sendiri."* Masuk akal dan memang keadaan yang wajar — seseorang yang
 * pernah Kepala Seksi lalu Kepala Bagian punya masa pada DUA jenjang, dan yang
 * relevan bagi jabatan target tertentu bisa gabungan keduanya. Angkanya dijumlahkan.
 *
 * "Isi angka sendiri" tetap EKSKLUSIF, dan itu bukan pengecualian sewenang-wenang:
 * angka yang diketik manusia sudah menyatakan totalnya sendiri. Menjumlahkannya
 * dengan jenjang yang dicentang berarti menghitung sebagian masa kerja dua kali,
 * dan tidak ada di layar yang bisa memberi tahu bahwa itu terjadi.
 *
 * ## PLT/PLH tidak ikut angka pilihan
 *
 * Ditampilkan terpisah supaya terlihat, tapi tidak dijumlahkan ke masa definitif:
 * menjumlahkannya diam-diam berarti menaikkan masa kerja seseorang atas dasar
 * penugasan yang bisa cuma sebulan. Kalau verifikator memang menghendakinya, ia
 * bisa memakai isian angka bebas di bawah dan menuliskan alasannya.
 */
export function PilihLamaJabatan({
  namaIndikator,
  nilaiSekarang,
  pegawaiId,
  jabatanTargetId,
  rubrikIndikatorId,
  pengalaman,
}: {
  namaIndikator: string
  nilaiSekarang: string | null
  pegawaiId: number
  jabatanTargetId: number
  rubrikIndikatorId: number
  pengalaman: RingkasJenjang[]
}) {
  const { tampilkan } = useToast()
  const [buka, setBuka] = useState(false)
  const [pending, mulai] = useTransition()
  /*
    Himpunan jenjang yang dicentang. `manual` disimpan terpisah alih-alih jadi
    anggota himpunan yang sama supaya sifat EKSKLUSIF-nya ditegakkan oleh bentuk
    datanya, bukan oleh pemeriksaan yang bisa terlewat di salah satu jalur.
  */
  const [dipilih, setDipilih] = useState<Set<string>>(() => new Set())
  const [manual, setManual] = useState(false)
  const [angkaLain, setAngkaLain] = useState('')
  const [catatan, setCatatan] = useState('')
  const [galat, setGalat] = useState<string | null>(null)
  const [rinci, setRinci] = useState<string | null>(null)

  const terpilih = pengalaman.filter((p) => dipilih.has(p.jenjang))
  const totalPilihan = Math.round(terpilih.reduce((n, p) => n + p.totalTahun, 0) * 100) / 100

  function alihkanJenjang(jenjang: string) {
    setManual(false)
    setDipilih((lama) => {
      const baru = new Set(lama)
      if (baru.has(jenjang)) baru.delete(jenjang)
      else baru.add(jenjang)
      return baru
    })
  }

  function pilihManual() {
    // Mengosongkan centangnya, bukan sekadar mengabaikannya: centang yang tetap
    // menyala sementara angkanya tidak dipakai adalah layar yang berbohong.
    setDipilih(new Set())
    setManual(true)
  }

  function simpan() {
    setGalat(null)
    const nilai = manual ? angkaLain.trim() : terpilih.length === 0 ? '' : String(totalPilihan)
    if (nilai === '') {
      setGalat('Pilih minimal satu jenjang, atau isi angka sendiri.')
      return
    }
    if (catatan.trim().length < 5) {
      setGalat('Alasan & bukti wajib diisi (minimal 5 karakter).')
      return
    }
    const rincianPilihan = terpilih
      .map(
        (p) =>
          `${p.jenjang} (Eselon ${p.eselon}) ${formatSkor(p.totalTahun)} th dari ${p.baris.filter((b) => b.penugasan === 'DEFINITIF').length} riwayat`,
      )
      .join(' + ')
    const alasan =
      terpilih.length === 0
        ? catatan.trim()
        : `Lama Pengalaman pada jenjang: ${rincianPilihan}${terpilih.length > 1 ? ` = ${formatSkor(totalPilihan)} th` : ''}. ${catatan.trim()}`

    mulai(async () => {
      const hasil = await simpanNilaiManual(jabatanTargetId, pegawaiId, rubrikIndikatorId, {
        nilaiMentah: nilai,
        catatan: alasan,
      })
      if (!hasil.ok) {
        setGalat(hasil.pesan ?? 'Gagal menyimpan.')
        return
      }
      setBuka(false)
      tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Nilai manual disimpan.' })
    })
  }

  return (
    <>
      <Button variant="halus" size="sm" onClick={() => setBuka(true)}>
        <PencilLine className="size-3.5" />
        Isi manual
      </Button>

      {buka ? (
        <Dialog
          buka
          onTutup={() => setBuka(false)}
          judul={`Isi manual: ${namaIndikator}`}
          deskripsi="Centang jenjang mana yang dipakai — boleh lebih dari satu, angkanya dijumlahkan. Semuanya dihitung dari riwayat jabatan pegawai ini; buka rinciannya untuk melihat baris mana saja yang terhitung."
        >
          <div className="space-y-3">
            <ul className="space-y-2">
              {pengalaman.map((p) => {
                const definitif = p.baris.filter((b) => b.penugasan === 'DEFINITIF')
                const tercentang = dipilih.has(p.jenjang)
                return (
                  <li
                    key={p.jenjang}
                    className={
                      tercentang
                        ? 'rounded-lg border border-accent bg-accent-subtle px-3 py-2.5'
                        : 'rounded-lg border border-border px-3 py-2.5'
                    }
                  >
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={tercentang}
                        onChange={() => alihkanJenjang(p.jenjang)}
                        className="mt-1"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline gap-2">
                          <span className="text-[13px] font-medium text-text">
                            Lama Pengalaman pada jenjang {p.jenjang}
                          </span>
                          <Badge tone="netral">Eselon {p.eselon}</Badge>
                        </span>
                        <span className="mt-0.5 block text-[12px] text-text-muted">
                          <strong className="tabular font-medium text-text">
                            {formatSkor(p.totalTahun)} tahun
                          </strong>{' '}
                          dari {definitif.length} riwayat jabatan
                          {p.totalTahunSementara > 0 ? (
                            <>
                              {' '}
                              · <span className="text-text-subtle">
                                {formatSkor(p.totalTahunSementara)} tahun PLT/PLH tidak ikut
                                dijumlahkan
                              </span>
                            </>
                          ) : null}
                        </span>
                      </span>
                    </label>

                    {p.baris.length > 0 ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setRinci(rinci === p.jenjang ? null : p.jenjang)}
                          className="mt-1.5 ml-6 text-[11px] text-accent hover:underline"
                        >
                          {rinci === p.jenjang ? 'Sembunyikan' : 'Lihat'} {p.baris.length} riwayat
                          yang terhitung
                        </button>
                        {rinci === p.jenjang ? (
                          <ul className="mt-1.5 ml-6 space-y-1 border-l border-border pl-3">
                            {p.baris.map((b, i) => (
                              <li key={i} className="text-[11px] leading-relaxed text-text-subtle">
                                <span className="tabular text-text-muted">
                                  {formatSkor(b.tahun)} th
                                </span>{' '}
                                · {b.namaMentah}
                                {b.penugasan === 'DEFINITIF' ? null : (
                                  <> · <Badge tone="peringatan">{b.penugasan}</Badge></>
                                )}
                                {b.tanggalMulai === null ? (
                                  <> · dari kolom lama menjabat (tanggal tidak ada di sumber)</>
                                ) : (
                                  <>
                                    {' '}
                                    · {formatTanggal(b.tanggalMulai)} –{' '}
                                    {b.tanggalAkhir === null
                                      ? 'sekarang'
                                      : formatTanggal(b.tanggalAkhir)}
                                  </>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    ) : (
                      <p className="mt-1.5 ml-6 text-[11px] text-text-subtle">
                        Tidak ada riwayat jabatan pada jenjang ini.
                      </p>
                    )}
                  </li>
                )
              })}

              {/*
                Jalan keluar yang WAJIB ada: klasifikasi di atas adalah usulan atas
                teks bebas, jadi ia bisa melewatkan baris yang penulisannya tak lazim.
                Tanpa opsi ini, verifikator yang memegang SK di tangannya tidak punya
                cara memasukkan angka yang ia tahu benar.
              */}
              <li
                className={
                  manual
                    ? 'rounded-lg border border-accent bg-accent-subtle px-3 py-2.5'
                    : 'rounded-lg border border-border px-3 py-2.5'
                }
              >
                <label className="flex cursor-pointer items-start gap-2.5">
                  {/*
                    Tetap `radio`, dan sengaja beda dari yang di atas: bentuk
                    kontrolnya yang memberi tahu bahwa opsi ini tidak bisa
                    digabung. Checkbox di sini akan mengundang orang mencentangnya
                    bersama jenjang lalu bertanya kenapa angkanya tidak dijumlahkan.
                  */}
                  <input
                    type="radio"
                    name="lama-jabatan-angka-sendiri"
                    checked={manual}
                    onChange={pilihManual}
                    className="mt-1"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="text-[13px] font-medium text-text">Isi angka sendiri</span>
                    <span className="mt-0.5 block text-[12px] text-text-muted">
                      Kalau riwayatnya belum lengkap di sistem dan Anda memegang dasarnya.
                    </span>
                  </span>
                </label>
                {manual ? (
                  <div className="mt-2 ml-6">
                    <Bidang label="Lama menjabat (tahun)" wajib>
                      <input
                        value={angkaLain}
                        onChange={(e) => setAngkaLain(e.target.value)}
                        inputMode="decimal"
                        placeholder="mis. 9,17 ditulis 9.17"
                        className={kelasInput()}
                      />
                    </Bidang>
                  </div>
                ) : null}
              </li>
            </ul>

            <Bidang
              label="Alasan & bukti"
              wajib
              keterangan="dokumen/SK yang jadi dasarnya — tersimpan bersama nama Anda"
            >
              <textarea
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                rows={2}
                className={`${kelasInput()} h-auto py-2 leading-relaxed`}
              />
            </Bidang>

            {galat !== null ? (
              <p role="alert" className="text-[12px] text-danger">
                {galat}
              </p>
            ) : null}

            <p className="text-[11px] leading-relaxed text-text-subtle">
              Nilai tersimpan:{' '}
              <strong className="tabular font-medium text-text">
                {manual ? angkaLain.trim() || '—' : formatSkor(totalPilihan)}
              </strong>{' '}
              tahun
              {terpilih.length > 1
                ? ` (${terpilih.map((p) => `${p.jenjang} ${formatSkor(p.totalTahun)}`).join(' + ')})`
                : ''}
              . Kategori &amp; skornya ditentukan rubrik (≥5 tahun → 100 · ≥2 → 80 · &lt;2 → 60),
              dihitung langsung setelah disimpan.
              {nilaiSekarang === null ? null : ` Nilai sekarang: ${nilaiSekarang} tahun.`}
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="halus" onClick={() => setBuka(false)} disabled={pending}>
                Batal
              </Button>
              <Button onClick={simpan} pending={pending}>
                Simpan nilai manual
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  )
}
