'use client'

import { KeyRound, Plus, ShieldOff } from 'lucide-react'
import { useState, useTransition } from 'react'

import { Bidang, kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { Dialog, DialogKonfirmasi } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { buatKlienApi, cabutTokenApi, terbitkanTokenApi, ubahKlienApi } from '@/lib/aksi/api'
import { ENDPOINT_V1 } from '@/lib/api/scope'

/**
 * Interaksi halaman Integrasi API. Ketiganya disatukan karena mereka satu alur
 * kerja — mendaftarkan klien, menerbitkan tokennya, mencabutnya — dan memisahnya
 * jadi tiga berkas hanya memindahkan `useToast`/`useTransition` yang sama ke tiga
 * tempat.
 */

export interface NilaiKlien {
  id?: number
  namaInstansi: string
  kodeInstansi: string
  contactPerson: string
  email: string
  noMou: string
  status: 'AKTIF' | 'NONAKTIF' | 'PENDING'
  endpoints: string[]
  dataPersonal: boolean
}

const KOSONG: NilaiKlien = {
  namaInstansi: '',
  kodeInstansi: '',
  contactPerson: '',
  email: '',
  noMou: '',
  status: 'PENDING',
  endpoints: [],
  dataPersonal: false,
}

export function FormKlienApi({ awal, label }: { awal?: NilaiKlien; label: string }) {
  const [buka, setBuka] = useState(false)
  const [nilai, setNilai] = useState<NilaiKlien>(awal ?? KOSONG)
  const [galat, setGalat] = useState<Record<string, string>>({})
  const [pending, mulai] = useTransition()
  const { tampilkan } = useToast()

  function simpan() {
    setGalat({})
    mulai(async () => {
      const masukan = {
        namaInstansi: nilai.namaInstansi,
        kodeInstansi: nilai.kodeInstansi,
        contactPerson: nilai.contactPerson.trim() === '' ? null : nilai.contactPerson,
        email: nilai.email.trim() === '' ? null : nilai.email,
        noMou: nilai.noMou.trim() === '' ? null : nilai.noMou,
        status: nilai.status,
        endpoints: nilai.endpoints,
        dataPersonal: nilai.dataPersonal,
      }
      const hasil =
        awal?.id === undefined
          ? await buatKlienApi(masukan)
          : await ubahKlienApi(awal.id, masukan)

      if (hasil.ok) {
        tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Tersimpan.' })
        setBuka(false)
        if (awal?.id === undefined) setNilai(KOSONG)
      } else {
        setGalat(hasil.galatField ?? {})
        tampilkan({ nada: 'bahaya', judul: hasil.pesan })
      }
    })
  }

  return (
    <>
      <Button
        size="sm"
        variant={awal ? 'halus' : 'utama'}
        onClick={() => setBuka(true)}
        ikon={awal ? undefined : <Plus className="size-3.5" />}
      >
        {label}
      </Button>

      <Dialog
        buka={buka}
        onTutup={() => setBuka(false)}
        judul={awal ? `Ubah klien ${awal.kodeInstansi}` : 'Tambah klien API'}
        deskripsi="Scope menentukan endpoint mana yang boleh dipanggil dan apakah NIP & nama pegawai ikut terkirim."
        lebar="lg"
        aksi={
          <>
            <Button variant="halus" size="sm" onClick={() => setBuka(false)}>
              Batal
            </Button>
            <Button size="sm" onClick={simpan} pending={pending}>
              Simpan
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Bidang label="Nama instansi" wajib galat={galat.namaInstansi}>
            <input
              className={kelasInput()}
              value={nilai.namaInstansi}
              onChange={(e) => setNilai({ ...nilai, namaInstansi: e.target.value })}
            />
          </Bidang>
          <Bidang label="Kode instansi" wajib galat={galat.kodeInstansi}>
            <input
              className={kelasInput()}
              value={nilai.kodeInstansi}
              onChange={(e) => setNilai({ ...nilai, kodeInstansi: e.target.value })}
            />
          </Bidang>
          <Bidang label="Contact person" galat={galat.contactPerson}>
            <input
              className={kelasInput()}
              value={nilai.contactPerson}
              onChange={(e) => setNilai({ ...nilai, contactPerson: e.target.value })}
            />
          </Bidang>
          <Bidang label="Email" galat={galat.email}>
            <input
              className={kelasInput()}
              value={nilai.email}
              onChange={(e) => setNilai({ ...nilai, email: e.target.value })}
            />
          </Bidang>
          <Bidang
            label="Nomor MoU / PKS"
            galat={galat.noMou}
            keterangan="Wajib sebelum status AKTIF — dasar hukum berbagi data ASN (UU PDP)."
          >
            <input
              className={kelasInput()}
              value={nilai.noMou}
              onChange={(e) => setNilai({ ...nilai, noMou: e.target.value })}
            />
          </Bidang>
          <Bidang label="Status" galat={galat.status}>
            <select
              className={kelasInput()}
              value={nilai.status}
              onChange={(e) =>
                setNilai({ ...nilai, status: e.target.value as NilaiKlien['status'] })
              }
            >
              <option value="PENDING">PENDING — belum boleh memanggil</option>
              <option value="AKTIF">AKTIF</option>
              <option value="NONAKTIF">NONAKTIF</option>
            </select>
          </Bidang>
        </div>

        <div className="mt-4">
          <Bidang
            label="Endpoint yang diizinkan"
            keterangan="Tidak ada yang dicentang = klien tidak bisa memanggil apa pun."
          >
            <div className="space-y-1.5 pt-1">
              {ENDPOINT_V1.map((e) => (
                <label key={e} className="flex items-center gap-2 text-[13px] text-text">
                  <input
                    type="checkbox"
                    checked={nilai.endpoints.includes(e)}
                    onChange={(ev) =>
                      setNilai({
                        ...nilai,
                        endpoints: ev.target.checked
                          ? [...nilai.endpoints, e]
                          : nilai.endpoints.filter((x) => x !== e),
                      })
                    }
                  />
                  <code className="text-[12px]">/api/v1/{e === 'kotak-9-summary' ? 'kotak-9/summary' : e}</code>
                </label>
              ))}
            </div>
          </Bidang>
        </div>

        <div className="mt-3 rounded-lg border border-warning-border bg-warning-subtle px-3 py-2.5">
          <label className="flex items-start gap-2 text-[13px]">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={nilai.dataPersonal}
              onChange={(e) => setNilai({ ...nilai, dataPersonal: e.target.checked })}
            />
            <span>
              <strong className="font-medium text-text">Izinkan data personal (NIP &amp; nama)</strong>
              <span className="mt-0.5 block text-[12px] leading-relaxed text-text-muted">
                Tanpa ini, balasan API tidak memuat NIP maupun nama — hanya pengenal semu yang
                berbeda per klien. Endpoint detail satu pegawai butuh izin ini; tidak ada versi
                tersamarkannya.
              </span>
            </span>
          </label>
        </div>
      </Dialog>
    </>
  )
}

export function TerbitkanToken({
  apiClientId,
  kodeInstansi,
}: {
  apiClientId: number
  kodeInstansi: string
}) {
  const [buka, setBuka] = useState(false)
  const [label, setLabel] = useState('')
  const [expired, setExpired] = useState('')
  const [token, setToken] = useState<string | null>(null)
  const [pending, mulai] = useTransition()
  const { tampilkan } = useToast()

  function terbitkan() {
    mulai(async () => {
      const hasil = await terbitkanTokenApi({ apiClientId, label, expiredAt: expired || null })
      if (hasil.ok) setToken(hasil.data.token)
      else tampilkan({ nada: 'bahaya', judul: hasil.pesan })
    })
  }

  return (
    <>
      <Button
        size="sm"
        variant="sekunder"
        onClick={() => setBuka(true)}
        ikon={<KeyRound className="size-3.5" />}
      >
        Terbitkan token
      </Button>

      <Dialog
        buka={buka}
        onTutup={() => {
          setBuka(false)
          setToken(null)
          setLabel('')
          setExpired('')
        }}
        judul={token ? 'Token diterbitkan' : `Terbitkan token untuk ${kodeInstansi}`}
        deskripsi={
          token
            ? undefined
            : 'Token dibuat acak 256 bit. Yang tersimpan hanya hash-nya — plaintext-nya ditampilkan tepat sekali.'
        }
        aksi={
          token ? (
            <Button
              size="sm"
              onClick={() => {
                setBuka(false)
                setToken(null)
                setLabel('')
                setExpired('')
              }}
            >
              Saya sudah menyalinnya
            </Button>
          ) : (
            <>
              <Button variant="halus" size="sm" onClick={() => setBuka(false)}>
                Batal
              </Button>
              <Button size="sm" onClick={terbitkan} pending={pending}>
                Terbitkan
              </Button>
            </>
          )
        }
      >
        {token ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-danger-border bg-danger-subtle px-3 py-2.5">
              <p className="text-[13px] font-semibold text-text">
                Salin sekarang — token ini tidak bisa ditampilkan lagi.
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-text-muted">
                Yang tersimpan di database hanya hash SHA-256-nya. Kalau hilang, terbitkan token
                baru dan cabut yang ini.
              </p>
            </div>
            <code className="block break-all rounded-md border border-border bg-surface-3 px-3 py-2.5 text-[12px] text-text">
              {token}
            </code>
            <p className="text-[12px] text-text-subtle">
              Kirim ke klien lewat kanal yang aman, bukan email biasa.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <Bidang
              label="Label"
              wajib
              keterangan="Satu-satunya cara membedakan token nanti — tulis kegunaannya, bukan angka."
            >
              <input
                className={kelasInput()}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="mis. Token Produksi BKN 2026"
              />
            </Bidang>
            <Bidang label="Berlaku sampai" keterangan="Kosongkan untuk token tanpa tenggat.">
              <input
                type="date"
                className={kelasInput()}
                value={expired}
                onChange={(e) => setExpired(e.target.value)}
              />
            </Bidang>
          </div>
        )}
      </Dialog>
    </>
  )
}

export function CabutToken({ id, label }: { id: number; label: string }) {
  const [buka, setBuka] = useState(false)
  const [pending, mulai] = useTransition()
  const { tampilkan } = useToast()

  return (
    <>
      <Button
        size="sm"
        variant="garisBahaya"
        onClick={() => setBuka(true)}
        ikon={<ShieldOff className="size-3.5" />}
      >
        Cabut
      </Button>
      <DialogKonfirmasi
        buka={buka}
        onTutup={() => setBuka(false)}
        destruktif
        judul={`Cabut token "${label}"?`}
        deskripsi="Pemakaian berikutnya langsung ditolak 401. Barisnya tidak dihapus — ia tetap jadi jejak siapa pernah punya akses, dan log aktivitas menunjuk ke sini."
        labelKonfirmasi="Cabut token"
        pending={pending}
        onKonfirmasi={() =>
          mulai(async () => {
            const hasil = await cabutTokenApi(id)
            tampilkan({
              nada: hasil.ok ? 'sukses' : 'bahaya',
              judul: hasil.ok ? (hasil.pesan ?? 'Token dicabut.') : hasil.pesan,
            })
            if (hasil.ok) setBuka(false)
          })
        }
      />
    </>
  )
}
