/**
 * `lib/importer` — gerbang masuk data dari sistem sumber (eHRM/eNominasi/eKinerja).
 *
 * Tugasnya dua, dan keduanya sama pentingnya:
 *
 *   1. **Menormalisasi** supaya isi DB selalu memenuhi phase.md §2 — tidak ada
 *      lapisan aplikasi lain yang perlu tahu bahwa sumber pernah mengirim skor
 *      115, golongan "IV.b", atau integritas berskala 1–4.
 *   2. **Melaporkan** setiap penyimpangan sebagai temuan. Data yang dibersihkan
 *      diam-diam menghilangkan sinyal bahwa sistem sumbernya perlu dibetulkan.
 *
 * Spesifikasi lengkap tiap aturan: phase.md §6.
 */

export * from './temuan'
export * from './normalisasi-baris'
