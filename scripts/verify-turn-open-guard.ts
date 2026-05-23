import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

if (process.env.VERIFY_ALLOW_DB_WRITES !== '1') {
  console.error(
    'Refusing to run: verify-turn-open-snapshot inserts test agents and stages into DATABASE_URL.\n' +
      'Set VERIFY_ALLOW_DB_WRITES=1 only after explicit approval to create test agents.\n' +
      'Orphans: bun run db:cleanup-verify-agents',
  )
  process.exit(3)
}
