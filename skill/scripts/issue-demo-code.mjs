// Run on VM as fsops with PHONE_HMAC_SECRET and DATABASE_* loaded by the operator.
// Writes the one-time participation code to a new owner-only file; never logs it.
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createDatabase } from '../src/database.js'
import { loadConfig } from '../src/config.js'
import { hashCode, newCode } from '../src/auth.js'

const output = process.argv[2]
const cfg = loadConfig()
if (!output || !cfg.ok || !cfg.config.database || !cfg.config.hmacKey) {
  console.error('Usage: node skill/scripts/issue-demo-code.mjs /absolute/private/output-file (server environment required)')
  process.exit(1)
}
const db = createDatabase(cfg.config.database)
try {
  const code = newCode()
  await db.service(async tx => {
    await tx.query('insert into private.demo_codes(code_hash) values ($1)', [hashCode(code,cfg.config.hmacKey)])
    writeFileSync(resolve(output), `${code}\n`, { mode:0o600,flag:'wx' })
  })
  console.log('Created a one-time code file. Expires in 10 minutes. Do not commit or share it publicly.')
} catch {
  console.error('Code issuance failed. Check the output path and server configuration.')
  process.exitCode = 1
} finally { await db.close() }
