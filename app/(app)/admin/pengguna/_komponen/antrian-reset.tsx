'use client'

import { KeyRound, MailQuestion } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { resetSandiPengguna, tandaiResetDitangani } from '@/lib/aksi/pengguna'
import { formatTanggalWaktu } from '@/lib/format'
import type { PermintaanReset } from '@/lib/kueri/admin'

/**
 * Antrian permintaan Lupa Password.
 *
 * Ini **pekerjaan yang menunggu**, bukan log. Selama belum ada transport surel
 * (lihat `doc/sql/012_auth.sql`), satu-satunya yang bisa menyelesaikan
 * permintaan ini adalah Super Admin — jadi ia harus terlihat di halaman yang
 * Super Admin buka, bukan tersimpan di tabel yang tidak pernah dilihat.
 *
 * Permintaan dari email yang **tidak terdaftar** tetap ditampilkan, ditandai
 * jelas. Itu bukan sampah: pola email asing yang berulang adalah percobaan
 * mencacah akun, dan menyembunyikannya berarti tidak ada yang tahu.
 */
export function AntrianReset({ permintaan }: { permintaan: PermintaanReset[] }) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [sandiTampil, setSandiTampil] = useState<{ nama: string; sandi: string } | null>(null)
  const [tolakId, setTolakId] = useState<number | null>(null)
  const [catatan, setCatatan] = useState('')

  function terbitkan(p: PermintaanReset) {
    if (p.userId === null) return
    mulaiTransisi(async () => {
      const hasil = await resetSandiPengguna(p.userId!, p.id)
      if (hasil.ok) {
        setSandiTampil({ nama: p.namaPengguna ?? p.email, sandi: hasil.data.sandiSementara })
      } else {
        tampilkan({ nada: 'bahaya', judul: 'Gagal', keterangan: hasil.pesan })
      }
    })
  }

  function tutupPermintaan() {
    if (tolakId === null) return
    mulaiTransisi(async () => {
      const hasil = await tandaiResetDitangani(tolakId, catatan)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Ditandai selesai.' }
          : { nada: 'bahaya', judul: 'Gagal', keterangan: hasil.pesan },
      )
      if (hasil.ok) {
        setTolakId(null)
        setCatatan('')
      }
    })
  }

  return (
    <>
      <ul className="divide-y divide-border">
        {permintaan.map((p) => (
          <li key={p.id} className="flex flex-wrap items-start gap-3 py-2.5 first:pt-0 last:pb-0">
            <MailQuestion className="mt-0.5 size-4 shrink-0 text-text-subtle" />
            <div className="min-w-0 flex-1">
              <p className="text-[13px] text-text">
                {p.namaPengguna ? (
                  <>
                    <span className="font-medium">{p.namaPengguna}</span>{' '}
                    <span className="font-mono text-[11px] text-text-subtle">
                      {p.usernamePengguna}
                    </span>
                  </>
                ) : (
                  <span className="text-text-muted">
                    {p.email}{' '}
                    <span className="rounded bg-warning-subtle px-1.5 py-px text-[10px] font-medium text-warning">
                      tidak terdaftar
                    </span>
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-text-subtle">
                {p.email} · diminta {formatTanggalWaktu(p.createdAt)}
                {p.ipAddress ? ` · IP ${p.ipAddress}` : ''}
              </p>
            </div>
            <span className="flex shrink-0 gap-1">
              {p.userId !== null ? (
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() => terbitkan(p)}
                  ikon={<KeyRound className="size-3.5" />}
                >
                  Terbitkan sandi sementara
                </Button>
              ) : null}
              <Button
                variant="halus"
                size="sm"
                disabled={pending}
                onClick={() => setTolakId(p.id)}
              >
                Tandai selesai
              </Button>
            </span>
          </li>
        ))}
      </ul>

      <Dialog
        buka={tolakId !== null}
        onTutup={() => setTolakId(null)}
        judul="Tandai permintaan selesai"
        deskripsi="Tulis bagaimana permintaan ini ditangani — catatan ini yang menjelaskan kenapa tidak ada sandi yang diterbitkan."
        lebar="sm"
        aksi={
          <>
            <Button variant="sekunder" size="sm" onClick={() => setTolakId(null)} disabled={pending}>
              Batal
            </Button>
            <Button size="sm" onClick={tutupPermintaan} pending={pending} labelPending="Menyimpan…">
              Simpan
            </Button>
          </>
        }
      >
        <textarea
          value={catatan}
          onChange={(e) => setCatatan(e.target.value)}
          rows={3}
          placeholder="mis. Sudah ditelepon, ternyata salah ketik username."
          className="w-full rounded-md border border-border bg-surface px-2.5 py-2 text-[13px] text-text outline-none transition-colors placeholder:text-text-subtle focus:border-accent"
        />
      </Dialog>

      <Dialog
        buka={sandiTampil !== null}
        onTutup={() => setSandiTampil(null)}
        judul={`Sandi sementara untuk ${sandiTampil?.nama ?? ''}`}
        deskripsi="Salin sekarang — setelah dialog ditutup, sandinya tidak bisa dilihat lagi."
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
          Serahkan lewat jalur kepegawaian, bukan kanal terbuka. Seluruh sesi lama pemiliknya sudah
          diputus, dan ia akan diminta mengganti sandi ini saat masuk.
        </p>
      </Dialog>
    </>
  )
}
