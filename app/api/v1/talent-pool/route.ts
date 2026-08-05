import { tanganiV1 } from '@/lib/api/bungkus'
import { ambilTalentPool } from '@/lib/kueri/suksesi'
import { angkaPositif, dariDaftar } from '@/lib/param'
import { giliranSiapa, LABEL_GILIRAN, LABEL_POOL, type StatusPool } from '@/lib/workflow'

/**
 * `GET /api/v1/talent-pool` — kandidat talent pool per jabatan target (PRD §7.2).
 *
 * Memakai `ambilTalentPool()` yang sama dengan halaman Talent Pool, termasuk
 * "giliran siapa" yang diturunkan dari `lib/workflow.ts` — bukan disimpulkan ulang
 * di sini. Satu definisi keadaan workflow, dua permukaan.
 *
 * **Skor selalu berdampingan dengan konteks kinerja** (`kotak_9`,
 * `predikat_kinerja`), sama seperti aturan K-4 yang mengikat seluruh UI. Match
 * score tidak memuat unsur kinerja sama sekali; mengirimkannya sendirian ke
 * instansi lain berarti mengirim peringkat yang bisa menaruh pegawai berpredikat
 * rendah di puncak tanpa satu pun petunjuk bahwa itu mungkin.
 */
const STATUS_POOL = ['KANDIDAT', 'DINOMINASIKAN', 'DIVERIFIKASI', 'DITETAPKAN', 'DITOLAK'] as const

export const GET = tanganiV1('talent-pool', async (ctx) => {
  const q = (n: string) => ctx.url.searchParams.get(n) ?? undefined
  const bolehPersonal = ctx.klien.scope.dataPersonal

  const baris = await ambilTalentPool({
    jabatanTargetId: angkaPositif(q('jabatan_target')),
    status: dariDaftar(q('status'), STATUS_POOL) as StatusPool | undefined,
  })

  return {
    data: baris.map((b) => {
      const giliran = giliranSiapa({ statusPool: b.status, statusNominasi: b.statusNominasi })
      return {
        ...(bolehPersonal ? { nip: b.nip, nama: b.nama } : {}),
        id_anonim: ctx.idAnonim(b.nip),
        jabatan_target: b.namaTarget,
        jabatan_target_id: b.jabatanTargetId,
        peringkat: b.ranking,
        status: b.status,
        status_label: LABEL_POOL[b.status],
        giliran: giliran,
        giliran_label: LABEL_GILIRAN[giliran],
        skor_total: b.skorTotal,
        lolos_syarat: b.eligible,
        // K-4: konteks kinerja wajib berdampingan dengan match score.
        kotak_9: b.kotak9,
        predikat_kinerja: b.predikatKinerja,
        ditetapkan_pada: b.ditetapkanPada,
        // `catatan_reviewer` TIDAK dikirim: isinya alasan keputusan atas nama
        // orang, ditulis untuk pembaca internal. Tidak ada scope yang mencakupnya.
      }
    }),
    meta: {
      jumlah: baris.length,
      catatan_skor:
        'skor_total adalah match score (65% Potensi & Kompetensi + 20% Kualifikasi + 15% Integritas). Ketiga komponennya milik sumbu potensial — skor ini TIDAK memuat unsur kinerja. Pakai kotak_9 & predikat_kinerja sebagai konteksnya.',
    },
  }
})
