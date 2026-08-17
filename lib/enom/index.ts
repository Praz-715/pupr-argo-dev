/**
 * `lib/enom` — klien BACA untuk API eNominasi (`karir.pu.go.id/enom`).
 *
 * Pembagian tugasnya sengaja tegas:
 *   - `klien.ts`    — HTTP + env + taksonomi galat. `server-only`.
 *   - `pemetaan.ts` — terjemahan bentuk payload. MURNI, bisa diuji tanpa jaringan.
 *   - `tipe.ts`     — skema Zod balasan, diturunkan dari balasan nyata.
 *
 * Tidak ada jalur TULIS ke DB di sini, dan itu disengaja — lihat catatan status
 * keputusan di `klien.ts`.
 */

export * from './tipe'
export * from './pemetaan'
