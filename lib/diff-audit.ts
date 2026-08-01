/**
 * Membandingkan isi `data_sebelum` vs `data_sesudah` sebuah baris `audit_log`.
 *
 * **Kenapa ini bukan sekadar menampilkan dua JSON berdampingan.** Pertanyaan
 * pemeriksa selalu "apa yang berubah", bukan "seperti apa barisnya". Dua blok
 * JSON dengan 14 field yang sama dan 1 berbeda menyuruh pembacanya mengerjakan
 * pekerjaan itu sendiri — dan pada baris ke-30 ia akan berhenti membaca, yang
 * artinya jejak auditnya ada tapi tidak dipakai.
 *
 * Modul ini **murni**: tidak menyentuh DB, tidak `server-only`. Fungsi yang
 * memutuskan "apakah ini berubah" adalah tempat yang mudah salah diam-diam
 * (`1` vs `"1"`, `null` vs `undefined`), jadi ia harus bisa diuji.
 */

export type JenisPerubahan = 'DITAMBAH' | 'DIHAPUS' | 'DIUBAH' | 'TETAP'

export interface BarisPerubahan {
  field: string
  sebelum: unknown
  sesudah: unknown
  jenis: JenisPerubahan
}

export interface HasilDiffAudit {
  /** Hanya field yang berubah, urut abjad. */
  berubah: BarisPerubahan[]
  /** Field yang nilainya sama — disembunyikan secara bawaan, tetap bisa dibuka. */
  tetap: BarisPerubahan[]
  /** `true` kalau salah satu sisi bukan objek (mis. mutasi BUAT atau HAPUS). */
  satuSisi: boolean
}

/**
 * Bandingkan longgar, bukan `===`.
 *
 * MySQL mengembalikan `TINYINT(1)` sebagai angka tapi kolom JSON menyimpan apa
 * yang ditulis JavaScript, sehingga `status_aktif` bisa tercatat `1` di satu
 * baris dan `true` di baris berikutnya tanpa ada yang berubah sungguhan.
 * Perbandingan ketat akan menandai keduanya sebagai perubahan, dan riwayat
 * yang penuh perubahan palsu tidak bisa dibedakan dari riwayat yang benar.
 *
 * `null` dan `undefined` juga dianggap sama: kolom yang tidak diikutkan dalam
 * SELECT dan kolom yang memang NULL bukan dua peristiwa berbeda.
 */
export function nilaiSama(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if ((a === null || a === undefined) && (b === null || b === undefined)) return true
  if (a === null || a === undefined || b === null || b === undefined) return false

  if (typeof a === 'boolean' || typeof b === 'boolean') {
    return keBoolean(a) === keBoolean(b)
  }
  if (typeof a === 'object' || typeof b === 'object') {
    return JSON.stringify(a) === JSON.stringify(b)
  }
  // Angka vs teks angka: `10` dan `"10"` adalah nilai yang sama yang lewat
  // dua jalur driver berbeda, bukan perubahan.
  const na = Number(a)
  const nb = Number(b)
  if (Number.isFinite(na) && Number.isFinite(nb) && String(a).trim() !== '' && String(b).trim() !== '') {
    return na === nb
  }
  return String(a) === String(b)
}

function keBoolean(v: unknown): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') return v !== '' && v !== '0' && v.toLowerCase() !== 'false'
  return Boolean(v)
}

function objek(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

export function diffAudit(sebelum: unknown, sesudah: unknown): HasilDiffAudit {
  const a = objek(sebelum)
  const b = objek(sesudah)

  if (!a || !b) {
    // BUAT (tidak ada sebelum) atau HAPUS (tidak ada sesudah): seluruh field
    // sisi yang ada dilaporkan sebagai ditambah/dihapus. Menampilkannya sebagai
    // "tidak ada perubahan" akan menyembunyikan justru mutasi paling besar.
    const satu = a ?? b
    const jenis: JenisPerubahan = a ? 'DIHAPUS' : 'DITAMBAH'
    if (!satu) return { berubah: [], tetap: [], satuSisi: true }
    return {
      berubah: Object.keys(satu)
        .sort()
        .map((field) => ({
          field,
          sebelum: a ? satu[field] : null,
          sesudah: a ? null : satu[field],
          jenis,
        })),
      tetap: [],
      satuSisi: true,
    }
  }

  const semuaField = [...new Set([...Object.keys(a), ...Object.keys(b)])].sort()
  const berubah: BarisPerubahan[] = []
  const tetap: BarisPerubahan[] = []

  for (const field of semuaField) {
    const adaDiA = field in a
    const adaDiB = field in b
    const nilaiA = a[field]
    const nilaiB = b[field]

    if (nilaiSama(nilaiA, nilaiB)) {
      tetap.push({ field, sebelum: nilaiA, sesudah: nilaiB, jenis: 'TETAP' })
      continue
    }

    berubah.push({
      field,
      sebelum: nilaiA,
      sesudah: nilaiB,
      jenis: !adaDiA ? 'DITAMBAH' : !adaDiB ? 'DIHAPUS' : 'DIUBAH',
    })
  }

  return { berubah, tetap, satuSisi: false }
}

/** Nilai jadi teks siap tampil. `null` jadi em dash, bukan string "null". */
export function tampilNilai(v: unknown): string {
  if (v === null || v === undefined) return '—'
  if (typeof v === 'boolean') return v ? 'ya' : 'tidak'
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  return s.trim() === '' ? '(kosong)' : s
}

/** `unit_organisasi_id` → `Unit organisasi id`. Nama kolom apa adanya sulit dibaca cepat. */
export function labelField(field: string): string {
  const teks = field.replace(/_/g, ' ').trim()
  return teks.charAt(0).toUpperCase() + teks.slice(1)
}
