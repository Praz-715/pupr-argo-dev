'use client'

import { KeyRound, Lock, LockOpen, Pencil, Power, UserPlus } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogKonfirmasi } from '@/components/ui/dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { useToast } from '@/components/ui/toast'
import { bukaKunciPengguna, resetSandiPengguna, ubahStatusPengguna } from '@/lib/aksi/pengguna'
import { formatTanggalWaktu } from '@/lib/format'
import type { BarisPengguna, OpsiPeran, OpsiUnitRingkas } from '@/lib/kueri/admin'
import { FormPengguna } from './form-pengguna'

/**
 * Tabel pengguna + seluruh aksinya.
 *
 * Tabel ini **tidak** memakai `DataTable`: jumlah pengguna internal dihitung
 * puluhan, bukan ribuan, jadi paginasi & pemilihan kolom hanya menambah
 * perkakas untuk daftar yang muat dalam satu layar. Yang justru penting di
 * sini dan tidak dipunyai `DataTable` adalah kolom aksi per baris yang
 * isinya berbeda-beda menurut keadaan akun.
 */
export function TabelPengguna({
  daftar,
  opsiPeran,
  opsiUnit,
  idSaya,
}: {
  daftar: BarisPengguna[]
  opsiPeran: OpsiPeran[]
  opsiUnit: OpsiUnitRingkas[]
  idSaya: number
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [formBuka, setFormBuka] = useState(false)
  const [sedangDiubah, setSedangDiubah] = useState<BarisPengguna | null>(null)
  const [konfirmasi, setKonfirmasi] = useState<{ baris: BarisPengguna; jenis: 'status' | 'reset' } | null>(
    null,
  )
  const [sandiTampil, setSandiTampil] = useState<{ nama: string; sandi: string } | null>(null)

  function jalankan(fn: () => Promise<{ ok: boolean; pesan?: string }>) {
    mulaiTransisi(async () => {
      const hasil = await fn()
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Selesai.' }
          : { nada: 'bahaya', judul: 'Gagal', keterangan: hasil.pesan },
      )
      setKonfirmasi(null)
    })
  }

  function konfirmasiOk() {
    if (!konfirmasi) return
    const { baris, jenis } = konfirmasi
    if (jenis === 'status') {
      jalankan(() => ubahStatusPengguna(baris.id, !baris.statusAktif))
    } else {
      mulaiTransisi(async () => {
        const hasil = await resetSandiPengguna(baris.id)
        if (hasil.ok) {
          setSandiTampil({ nama: baris.nama, sandi: hasil.data.sandiSementara })
          tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Sandi diatur ulang.' })
        } else {
          tampilkan({ nada: 'bahaya', judul: 'Gagal', keterangan: hasil.pesan })
        }
        setKonfirmasi(null)
      })
    }
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setSedangDiubah(null)
            setFormBuka(true)
          }}
          ikon={<UserPlus className="size-3.5" />}
        >
          Tambah pengguna
        </Button>
      </div>

      {daftar.length === 0 ? (
        <EmptyState
          judul="Belum ada pengguna"
          deskripsi="Tambahkan akun untuk staf yang perlu mengakses aplikasi."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[64rem] border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-border bg-surface-2 text-left">
                <Th>Nama</Th>
                <Th>Username</Th>
                <Th>Peran</Th>
                <Th>Unit</Th>
                <Th>Status</Th>
                <Th>Masuk terakhir</Th>
                <Th className="text-right">Aksi</Th>
              </tr>
            </thead>
            <tbody>
              {daftar.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border last:border-0 hover:bg-surface-2/60"
                >
                  <Td>
                    <span className="font-medium text-text">{u.nama}</span>
                    {u.id === idSaya ? (
                      <span className="ml-1.5 rounded bg-accent-subtle px-1.5 py-px text-[10px] font-medium text-accent">
                        Anda
                      </span>
                    ) : null}
                    <span className="block text-[11px] text-text-subtle">{u.email}</span>
                  </Td>
                  <Td className="font-mono text-[12px] text-text-muted">{u.username}</Td>
                  <Td>{u.peran}</Td>
                  <Td className="text-text-muted">
                    {u.namaUnit ?? <span className="text-text-subtle">— pusat —</span>}
                  </Td>
                  <Td>
                    <span className="flex flex-wrap gap-1">
                      {u.statusAktif ? (
                        <Badge tone="sukses">Aktif</Badge>
                      ) : (
                        <Badge tone="netral">Nonaktif</Badge>
                      )}
                      {u.terkunci ? (
                        <Badge tone="bahaya" title={`${u.gagalMasukBeruntun} percobaan gagal`}>
                          Terkunci
                        </Badge>
                      ) : null}
                      {u.harusGantiSandi ? (
                        <Badge tone="peringatan" title="Sandi diatur Super Admin, belum diganti pemiliknya">
                          Sandi sementara
                        </Badge>
                      ) : null}
                      {u.sesiAktif > 0 ? (
                        <Badge tone="aksen" title="Sesi yang sedang berjalan">
                          {u.sesiAktif} sesi
                        </Badge>
                      ) : null}
                    </span>
                  </Td>
                  <Td className="tabular-nums text-text-muted">
                    {u.lastLoginAt ? formatTanggalWaktu(u.lastLoginAt) : '—'}
                  </Td>
                  <Td className="text-right">
                    <span className="inline-flex gap-1">
                      <Button
                        variant="halus"
                        size="sm"
                        disabled={pending}
                        onClick={() => {
                          setSedangDiubah(u)
                          setFormBuka(true)
                        }}
                        ikon={<Pencil className="size-3.5" />}
                      >
                        Ubah
                      </Button>
                      {u.terkunci ? (
                        <Button
                          variant="halus"
                          size="sm"
                          disabled={pending}
                          onClick={() => jalankan(() => bukaKunciPengguna(u.id))}
                          ikon={<LockOpen className="size-3.5" />}
                        >
                          Buka kunci
                        </Button>
                      ) : null}
                      <Button
                        variant="halus"
                        size="sm"
                        disabled={pending}
                        onClick={() => setKonfirmasi({ baris: u, jenis: 'reset' })}
                        ikon={<KeyRound className="size-3.5" />}
                      >
                        Reset sandi
                      </Button>
                      <Button
                        variant="halus"
                        size="sm"
                        disabled={pending || u.id === idSaya}
                        title={
                          u.id === idSaya
                            ? 'Anda tidak bisa menonaktifkan akun Anda sendiri'
                            : undefined
                        }
                        onClick={() => setKonfirmasi({ baris: u, jenis: 'status' })}
                        ikon={u.statusAktif ? <Power className="size-3.5" /> : <Lock className="size-3.5" />}
                      >
                        {u.statusAktif ? 'Nonaktifkan' : 'Aktifkan'}
                      </Button>
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {formBuka ? (
        <FormPengguna
          pengguna={sedangDiubah}
          opsiPeran={opsiPeran}
          opsiUnit={opsiUnit}
          onTutup={() => setFormBuka(false)}
          onSandiBaru={setSandiTampil}
        />
      ) : null}

      <DialogKonfirmasi
        buka={konfirmasi !== null}
        onTutup={() => setKonfirmasi(null)}
        onKonfirmasi={konfirmasiOk}
        pending={pending}
        destruktif={konfirmasi?.jenis === 'status' && konfirmasi.baris.statusAktif}
        judul={
          konfirmasi?.jenis === 'reset'
            ? `Atur ulang sandi ${konfirmasi.baris.nama}?`
            : konfirmasi?.baris.statusAktif
              ? `Nonaktifkan ${konfirmasi.baris.nama}?`
              : `Aktifkan kembali ${konfirmasi?.baris.nama}?`
        }
        deskripsi={pesanKonfirmasi(konfirmasi)}
        labelKonfirmasi={konfirmasi?.jenis === 'reset' ? 'Atur ulang' : 'Lanjutkan'}
      />

      {/* Sandi sementara ditampilkan TEPAT SEKALI. Tidak disimpan terbaca di
          mana pun dan tidak bisa dilihat ulang — kalau hilang, atur ulang lagi. */}
      <Dialog
        buka={sandiTampil !== null}
        onTutup={() => setSandiTampil(null)}
        judul={`Sandi sementara untuk ${sandiTampil?.nama ?? ''}`}
        deskripsi="Salin sekarang. Setelah dialog ini ditutup, sandinya tidak bisa dilihat lagi — yang tersimpan hanya hash-nya."
        lebar="sm"
        aksi={
          <Button size="sm" onClick={() => setSandiTampil(null)}>
            Sudah saya salin
          </Button>
        }
      >
        <p className="select-all rounded-md border border-border bg-surface-inset px-3 py-2.5 text-center font-mono text-[16px] tracking-wider text-text">
          {sandiTampil?.sandi}
        </p>
        <p className="mt-3 text-[12px] leading-relaxed text-text-muted">
          Serahkan lewat jalur kepegawaian, jangan lewat kanal terbuka. Pemiliknya akan diminta
          menggantinya saat pertama masuk, dan sampai itu terjadi ia belum bisa membuka aplikasi.
        </p>
      </Dialog>
    </>
  )
}

function pesanKonfirmasi(
  k: { baris: BarisPengguna; jenis: 'status' | 'reset' } | null,
): string | undefined {
  if (!k) return undefined
  if (k.jenis === 'reset') {
    return `Sandi lama langsung tidak berlaku${k.baris.sesiAktif > 0 ? ` dan ${k.baris.sesiAktif} sesi aktifnya diputus` : ''}. Sandi sementara akan ditampilkan sekali untuk Anda serahkan.`
  }
  return k.baris.statusAktif
    ? `Akun tidak bisa dipakai masuk lagi${k.baris.sesiAktif > 0 ? `, dan ${k.baris.sesiAktif} sesi yang sedang berjalan langsung diputus` : ''}. Data yang pernah ia ubah tetap tercatat di audit log.`
    : 'Akun bisa dipakai masuk lagi dengan sandi terakhirnya.'
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={`px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-text-subtle ${className ?? ''}`}
    >
      {children}
    </th>
  )
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-3 py-2.5 align-top ${className ?? ''}`}>{children}</td>
}
