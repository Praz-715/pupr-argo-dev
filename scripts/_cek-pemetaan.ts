import { config } from 'dotenv'
config({ path: '.env.local' }); config({ path: '.env' })
async function main() {
  const { kueri } = await import('../lib/db')
  for (const t of [0, 3000]) {
    await new Promise((r) => setTimeout(r, t))
    const b = await kueri<Record<string, unknown>>(
      `SELECT * FROM pemetaan_diklat WHERE status <> 'USULAN'`)
    console.log(`t+${t}ms: ${b.length} baris ${JSON.stringify(b)}`)
  }
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
