'use client'

import { Monitor, X } from 'lucide-react'
import { useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { cabutSesiSaya } from '@/lib/aksi/auth'
import { formatTanggalWaktu } from '@/lib/format'
import type { BarisSesi } from '@/lib/sesi'

/**
 * Daftar sesi aktif milik sendiri.
 *
 * Ada bukan sebagai hiasan keamanan: satu-satunya cara pengguna bisa TAHU
 * bahwa akunnya dipakai di tempat lain adalah melihat daftarnya. Tanpa ini,
 * "ganti sandi" jadi satu-satunya tindakan yang bisa ia ambil atas kecurigaan
 * apa pun — dan itu terlalu berat untuk laptop yang cuma lupa di-logout.
 */
export function DaftarSesi({ sesi }: { sesi: BarisSesi[] }) {
  const { tampilkan } = useToast()
  const [pending, mulaiTransisi] = useTransition()

  function cabut(id: number) {
    mulaiTransisi(async () => {
      const hasil = await cabutSesiSaya(id)
      tampilkan(
        hasil.ok
          ? { nada: 'sukses', judul: hasil.pesan ?? 'Sesi diakhiri.' }
          : { nada: 'bahaya', judul: 'Gagal mengakhiri sesi', keterangan: hasil.pesan },
      )
    })
  }

  return (
    <ul className="divide-y divide-border">
      {sesi.map((s) => (
        <li key={s.id} className="flex items-start gap-3 py-2.5 first:pt-0 last:pb-0">
          <Monitor className="mt-0.5 size-4 shrink-0 text-text-subtle" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-text">
              {ringkasPeramban(s.userAgent)}
              {s.iniSesiSaya ? (
                <span className="ml-1.5 rounded bg-accent-subtle px-1.5 py-px text-[10px] font-medium text-accent">
                  perangkat ini
                </span>
              ) : null}
            </p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-text-subtle">
              Terakhir aktif {formatTanggalWaktu(s.terakhirAktifPada)}
              {s.ipAddress ? ` · IP ${s.ipAddress}` : ''} · berakhir{' '}
              {formatTanggalWaktu(s.kedaluwarsaPada)}
            </p>
          </div>
          {!s.iniSesiSaya ? (
            <Button
              variant="sekunder"
              size="sm"
              pending={pending}
              onClick={() => cabut(s.id)}
              ikon={<X className="size-3.5" />}
            >
              Akhiri
            </Button>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

/**
 * User-Agent jadi kalimat pendek.
 *
 * Sengaja kasar dan tidak lengkap: yang ditanyakan pengguna cuma "itu perangkat
 * saya yang mana", bukan versi mesin renderernya. Pustaka pengurai UA lengkap
 * akan menambah dependensi demi ketelitian yang tidak dipakai siapa pun di sini.
 */
function ringkasPeramban(ua: string | null): string {
  if (!ua) return 'Perangkat tidak dikenali'
  const peramban = /Edg\//.test(ua)
    ? 'Edge'
    : /OPR\//.test(ua)
      ? 'Opera'
      : /Chrome\//.test(ua)
        ? 'Chrome'
        : /Firefox\//.test(ua)
          ? 'Firefox'
          : /Safari\//.test(ua)
            ? 'Safari'
            : 'Peramban lain'
  const sistem = /Windows/.test(ua)
    ? 'Windows'
    : /Android/.test(ua)
      ? 'Android'
      : /iPhone|iPad/.test(ua)
        ? 'iOS'
        : /Mac OS X/.test(ua)
          ? 'macOS'
          : /Linux/.test(ua)
            ? 'Linux'
            : 'sistem lain'
  return `${peramban} di ${sistem}`
}
