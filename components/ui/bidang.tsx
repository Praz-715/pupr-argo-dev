import { cn } from '@/lib/cn'

/**
 * Satu bidang isian: label, penanda wajib, keterangan, dan pesan galat per-field.
 *
 * **Kenapa dipindah ke sini di Fase 7.** Komponen ini sudah disalin ke lima
 * berkas form (unit, jabatan, hukuman disiplin, jabatan target, rubrik) dengan
 * isi yang praktis sama, dan Fase 7 menambah lima form lagi. Sepuluh salinan
 * dari komponen yang menampilkan pesan kesalahan berarti sepuluh kemungkinan
 * cara pesan kesalahan terlihat berbeda — dan yang paling mungkin tertinggal
 * justru `role="alert"`-nya, satu-satunya bagian yang membuat pesan itu
 * terbaca pembaca layar (CLAUDE.md prinsip #1).
 *
 * Bukan Client Component: tidak ada interaktivitas di sini, hanya penataan.
 * Dengan begitu ia bisa dipakai form klien maupun halaman server.
 */

export function Bidang({
  label,
  galat,
  wajib,
  keterangan,
  htmlFor,
  children,
}: {
  label: string
  galat?: string
  wajib?: boolean
  keterangan?: string
  /**
   * Isi kalau kontrolnya BUKAN anak langsung (mis. sekelompok radio). Tanpa
   * ini, komponen memakai `<label>` pembungkus, yang sudah menautkan dirinya
   * ke kontrol tunggal di dalamnya.
   */
  htmlFor?: string
  children: React.ReactNode
}) {
  const Pembungkus = htmlFor ? 'div' : 'label'
  return (
    <Pembungkus className="block">
      <span className="mb-1 flex flex-wrap items-baseline gap-1.5">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-[12px] font-medium text-text">
            {label}
          </label>
        ) : (
          <span className="text-[12px] font-medium text-text">{label}</span>
        )}
        {wajib ? (
          <span aria-hidden className="text-[12px] text-danger">
            *
          </span>
        ) : null}
        {keterangan ? <span className="text-[10px] text-text-subtle">{keterangan}</span> : null}
      </span>
      {children}
      {galat ? (
        <span role="alert" className="mt-1 block text-[11px] leading-relaxed text-danger">
          {galat}
        </span>
      ) : null}
    </Pembungkus>
  )
}

/** Kelas untuk `<input>` / `<select>` setinggi 36px, dengan varian bergalat. */
export function kelasInput(galat?: string): string {
  return cn(
    'h-9 w-full rounded-md border bg-surface px-2.5 text-[13px] text-text outline-none transition-colors placeholder:text-text-subtle disabled:opacity-60',
    galat ? 'border-danger-border focus:border-danger' : 'border-border focus:border-accent',
  )
}
