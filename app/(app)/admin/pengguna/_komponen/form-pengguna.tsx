'use client'

import { useState, useTransition } from 'react'

import { Bidang, kelasInput } from '@/components/ui/bidang'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toast'
import { buatPengguna, ubahPengguna } from '@/lib/aksi/pengguna'
import type { BarisPengguna, OpsiPeran, OpsiUnitRingkas } from '@/lib/kueri/admin'

export function FormPengguna({
  pengguna,
  opsiPeran,
  opsiUnit,
  onTutup,
  onSandiBaru,
}: {
  pengguna: BarisPengguna | null
  opsiPeran: OpsiPeran[]
  opsiUnit: OpsiUnitRingkas[]
  onTutup: () => void
  /** Sandi sementara akun baru — ditampilkan sekali oleh pemanggil. */
  onSandiBaru: (info: { nama: string; sandi: string }) => void
}) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()
  const [galat, setGalat] = useState<Record<string, string>>({})

  const [nama, setNama] = useState(pengguna?.nama ?? '')
  const [email, setEmail] = useState(pengguna?.email ?? '')
  const [username, setUsername] = useState(pengguna?.username ?? '')
  const [roleId, setRoleId] = useState(String(pengguna?.roleId ?? ''))
  const [unitId, setUnitId] = useState(
    pengguna?.unitOrganisasiId ? String(pengguna.unitOrganisasiId) : '',
  )

  const peranTerpilih = opsiPeran.find((p) => String(p.id) === roleId)
  const unitWajibDiisi = peranTerpilih?.nama === 'Pengelola Unit'

  function simpan() {
    setGalat({})
    const masukan = {
      nama: nama.trim(),
      email: email.trim(),
      username: username.trim().toLowerCase(),
      roleId: roleId === '' ? 0 : Number(roleId),
      unitOrganisasiId: unitId === '' ? null : Number(unitId),
    }

    mulaiTransisi(async () => {
      if (pengguna) {
        const hasil = await ubahPengguna(pengguna.id, masukan)
        if (hasil.ok) {
          tampilkan({ nada: 'sukses', judul: hasil.pesan ?? 'Tersimpan.' })
          onTutup()
        } else {
          tanganiGagal(hasil.pesan, hasil.galatField)
        }
      } else {
        const hasil = await buatPengguna(masukan)
        if (hasil.ok) {
          onSandiBaru({ nama: masukan.nama, sandi: hasil.data.sandiSementara })
          onTutup()
        } else {
          tanganiGagal(hasil.pesan, hasil.galatField)
        }
      }
    })
  }

  function tanganiGagal(pesan: string, galatField?: Record<string, string>) {
    setGalat(galatField ?? {})
    if (!galatField) tampilkan({ nada: 'bahaya', judul: 'Gagal menyimpan', keterangan: pesan })
  }

  return (
    <Dialog
      buka
      onTutup={onTutup}
      judul={pengguna ? `Ubah akun ${pengguna.nama}` : 'Tambah pengguna'}
      deskripsi={
        pengguna
          ? 'Mengubah peran atau unit akan memutus sesi aktifnya — wewenang lama tidak boleh ikut terbawa sampai ia keluar sendiri.'
          : 'Akun dibuat dengan sandi sementara yang ditampilkan satu kali. Pemiliknya wajib menggantinya saat pertama masuk.'
      }
      lebar="lg"
      aksi={
        <>
          <Button variant="sekunder" size="sm" onClick={onTutup} disabled={pending}>
            Batal
          </Button>
          <Button size="sm" onClick={simpan} pending={pending} labelPending="Menyimpan…">
            {pengguna ? 'Simpan' : 'Buat akun'}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <Bidang label="Nama lengkap" galat={galat.nama} wajib>
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            disabled={pending}
            className={kelasInput(galat.nama)}
          />
        </Bidang>

        <div className="grid gap-3.5 sm:grid-cols-2">
          <Bidang label="Username" galat={galat.username} wajib keterangan="huruf kecil, tanpa spasi">
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={pending}
              className={`${kelasInput(galat.username)} font-mono`}
            />
          </Bidang>

          <Bidang label="Email" galat={galat.email} wajib>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={pending}
              className={kelasInput(galat.email)}
            />
          </Bidang>
        </div>

        <Bidang label="Peran" galat={galat.roleId} wajib>
          <select
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            disabled={pending}
            className={kelasInput(galat.roleId)}
          >
            <option value="">— Pilih peran —</option>
            {opsiPeran.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.nama} ({p.jumlahPengguna} aktif)
              </option>
            ))}
          </select>
          {peranTerpilih?.deskripsi ? (
            <span className="mt-1 block text-[11px] leading-relaxed text-text-subtle">
              {peranTerpilih.deskripsi}
            </span>
          ) : null}
        </Bidang>

        <Bidang
          label="Unit organisasi"
          galat={galat.unitOrganisasiId}
          wajib={unitWajibDiisi}
          keterangan={unitWajibDiisi ? 'wajib untuk Pengelola Unit' : 'kosongkan untuk akses pusat'}
        >
          <select
            value={unitId}
            onChange={(e) => setUnitId(e.target.value)}
            disabled={pending}
            className={kelasInput(galat.unitOrganisasiId)}
          >
            <option value="">— Tanpa unit (akses pusat) —</option>
            {opsiUnit.map((u) => (
              <option key={u.id} value={String(u.id)}>
                {u.label}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[11px] leading-relaxed text-text-subtle">
            {unitWajibDiisi
              ? 'Pengelola Unit hanya melihat pegawai unit ini dan seluruh unit di bawahnya. Tanpa unit, ia tidak akan melihat data apa pun.'
              : 'Peran ini melihat seluruh data, jadi unit di sini hanya keterangan penempatan.'}
          </span>
        </Bidang>
      </div>
    </Dialog>
  )
}
