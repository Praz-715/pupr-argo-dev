import { config } from 'dotenv'
config({ path: '.env.local' }); config({ path: '.env' })
async function main() {
  const { kueri } = await import('../lib/db')
  const b = await kueri<Record<string, unknown>>(
    `SELECT id, user_id, aksi, entitas, entitas_id, ip_address, created_at
       FROM audit_log
      WHERE entitas = 'pemetaan_diklat' AND entitas_id = 12
      ORDER BY created_at DESC LIMIT 10`)
  for (const r of b) console.log(`${r.created_at} · ${r.aksi} ${r.entitas}#${r.entitas_id} · user ${r.user_id} · ip ${r.ip_address}`)
  process.exit(0)
}
main().catch((e) => { console.error(e); process.exit(1) })
