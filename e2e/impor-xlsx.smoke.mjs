/**
 * SMOKE — impor pegawai dari berkas `.xlsx` Talent Pool lewat UI.
 *
 *   node e2e/impor-xlsx.smoke.mjs .next/smoke http://localhost:5000 [--lewati]
 *
 * ## Yang dijaga di sini, dan yang dijaga di tempat lain
 *
 * Pembacaan berkasnya dijaga uji unit `lib/importer/talentpool-xlsx.test.ts`, yang
 * membandingkan hasilnya dengan ekstraktor Python. Yang TIDAK bisa dijaga uji unit
 * adalah jalur ujung-ke-ujungnya, dan justru di situ dua penghalang tersembunyi
 * ditemukan pada 24 Agu 2026: **batas body server action 1 MB** dan **batas body
 * middleware 10 MB**, keduanya menolak berkas 17,13 MB SEBELUM kode aksi berjalan
 * sehingga pemeriksaan ukuran & pesan galat di dalam aksi tidak pernah terpakai.
 * Yang terlihat pengguna hanya tombol menggantung; sebabnya cuma ada di log server.
 *
 * Berkas sumbernya di luar repo, jadi langkahnya DILEWATI — bukan gagal — kalau
 * berkasnya tidak ada. Uji yang merah karena berkas milik satu mesin tidak ada akan
 * diabaikan orang, dan bersamanya uji yang sungguhan.
 */

import { chromium } from 'playwright'
import { existsSync } from 'node:fs'

import { AKUN, konteksMasuk } from './_masuk.mjs'
// argv[2] = folder tangkapan layar (konvensi berkas smoke lain), argv[3] = base URL
const BASE = process.argv[3] ?? process.argv[2] ?? 'http://localhost:5000'
const BERKAS = process.env.XLSX_TALENTPOOL ?? '/home/user1/TALENT POOL PENGAWAS#2 fix.xlsx'
if (!existsSync(BERKAS)) {
  console.log(`DILEWATI: berkas sumber tidak ada (${BERKAS}). Setel XLSX_TALENTPOOL untuk mengarahkannya.`)
  process.exit(0)
}
const b = await chromium.launch()
try {
  const ctx = await konteksMasuk(b, { base: BASE, akun: AKUN.superAdmin })
  const hal = await ctx.newPage()
  await hal.setViewportSize({ width: 1600, height: 1100 })
  let gagal = 0
  const cek = (ok, m) => { if (!ok) gagal++; console.log(`  ${ok ? '✓' : '✗'} ${m}`) }

  await hal.goto(`${BASE}/talenta`, { waitUntil: 'networkidle' })
  await hal.waitForSelector('main table tbody tr')
  await hal.click('button:has-text("Tambah pegawai")')
  await hal.waitForSelector('dialog[open]')
  const dlg = hal.locator('dialog[open]')
  cek((await dlg.locator('button:has-text("Unggah Excel")').count()) === 1, 'tab "Unggah Excel" ada')
  await dlg.locator('button:has-text("Unggah Excel")').click()
  cek((await dlg.locator('input[type="file"]').count()) === 1, 'input berkas muncul')
  const cbPerbarui = dlg.locator('label:has-text("Perbarui pegawai") input[type="checkbox"]')
  const cbLewati = dlg.locator('label:has-text("Lewati baris") input[type="checkbox"]')
  cek(await cbPerbarui.isChecked(), 'opsi "perbarui yang NIP-nya sudah ada" tercentang secara baku')
  cek(!(await cbLewati.isChecked()), 'opsi "lewati baris bermasalah" TIDAK tercentang secara baku')
  if (process.argv.includes('--lewati')) await cbLewati.check()

  await dlg.locator('input[type="file"]').setInputFiles(BERKAS)
  const info = await dlg.innerText()
  cek(/TALENT POOL PENGAWAS.*MB/s.test(info), 'nama & ukuran berkas ditampilkan')

  await dlg.locator('button:has-text("Impor dari berkas")').click()
  /*
    Tunggu WADAH TOAST berisi, bukan teks badan halaman.

    Percobaan pertama menunggu regex pada `document.body.innerText` — dan panel
    penjelas di dialognya sendiri memuat kata "diperbarui" dan "master", jadi
    penantiannya lolos SEKETIKA sebelum server menjawab. Itu jebakan #1 di
    CLAUDE.md, dan saya kena di pemeriksa saya sendiri.
  */
  const toast = hal.locator('[role="status"][aria-live="polite"]')
  await hal.waitForFunction(
    () => {
      const w = document.querySelector('[role="status"][aria-live="polite"]')
      return !!w && w.innerText.trim().length > 0
    },
    null, { timeout: 120000, polling: 400 },
  )
  const pesan = (await toast.innerText()).split('\n').filter((l) => l.trim() !== '')
  console.log('\n  TOAST:')
  for (const p of pesan.slice(0, 8)) console.log(`     ${p.trim().slice(0, 260)}`)
  cek(pesan.length > 0, 'server menjawab (toast muncul)')
  console.log(`\n${gagal === 0 ? 'kontrol UI: LULUS' : `${gagal} GAGAL`}\n`)
  await ctx.close()
} finally { await b.close() }
