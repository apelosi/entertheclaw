#!/usr/bin/env tsx
/**
 * notify-owners — send a one-off plain-text email to a chosen set of users.
 *
 * SAFE BY DEFAULT: without --send it is a DRY RUN (resolves and prints the
 * recipients, sends nothing). Add --send to actually deliver.
 *
 * Runs against whatever DATABASE_URL is set — point it at PRODUCTION (Neon prod
 * branch) to reach real owners, and make sure RESEND_API_KEY is set for --send.
 *
 * Recipient selection (combine freely; deduped by email):
 *   --all-owners            every user who owns at least one agent
 *   --all-users             every registered user
 *   --user <id>             an auth user id (repeatable)
 *   --agent <id>            an agent id → its owner (repeatable)
 *   --email <addr>          a literal address (repeatable)
 *
 * Message:
 *   --subject "..."         required
 *   --body "..."            inline body, OR
 *   --body-file <path>      read the body from a file
 *
 * Examples:
 *   # dry run: who would get the MCP-upgrade notice?
 *   bun run notify-owners --all-owners --subject "Upgrade" --body-file notice.txt
 *   # actually send to one owner:
 *   bun run notify-owners --agent dbfba74c-... --subject "Upgrade" --body-file notice.txt --send
 */
import './load-env-local'
import { readFileSync } from 'fs'
import { resolveRecipients, sendOwnerBroadcast, type RecipientSelector } from '../lib/email/broadcast'

function parseArgs(argv: string[]) {
  const sel: RecipientSelector = { emails: [], userIds: [], agentIds: [] }
  let subject = ''
  let body: string | null = null
  let bodyFile: string | null = null
  let send = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const next = () => argv[++i]
    switch (a) {
      case '--all-owners': sel.allOwners = true; break
      case '--all-users': sel.allUsers = true; break
      case '--user': sel.userIds!.push(next()); break
      case '--agent': sel.agentIds!.push(next()); break
      case '--email': sel.emails!.push(next()); break
      case '--subject': subject = next(); break
      case '--body': body = next(); break
      case '--body-file': bodyFile = next(); break
      case '--send': send = true; break
      default:
        console.error(`Unknown argument: ${a}`)
        process.exit(1)
    }
  }
  return { sel, subject, body, bodyFile, send }
}

function maskEmail(e: string): string {
  const [local, domain] = e.split('@')
  if (!domain) return e
  const head = local.slice(0, 2)
  return `${head}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}`
}

async function main() {
  const { sel, subject, body, bodyFile, send } = parseArgs(process.argv.slice(2))

  const hasTarget =
    sel.allOwners || sel.allUsers ||
    (sel.userIds?.length ?? 0) + (sel.agentIds?.length ?? 0) + (sel.emails?.length ?? 0) > 0
  if (!hasTarget) {
    console.error('No recipients selected. Use --all-owners / --all-users / --user / --agent / --email.')
    process.exit(1)
  }
  if (!subject) {
    console.error('--subject is required.')
    process.exit(1)
  }
  const text = bodyFile ? readFileSync(bodyFile, 'utf-8') : body
  if (!text) {
    console.error('Provide --body "..." or --body-file <path>.')
    process.exit(1)
  }

  const recipients = await resolveRecipients(sel)
  console.log(`Resolved ${recipients.length} recipient(s):`)
  for (const r of recipients) console.log(`  ${maskEmail(r.email)}${r.userId ? `  (user ${r.userId})` : ''}`)
  console.log(`\nSubject: ${subject}`)
  console.log(`Body: ${text.length} chars\n`)

  if (!send) {
    console.log('DRY RUN — nothing sent. Re-run with --send to deliver.')
    process.exit(0)
  }

  console.log('Sending…')
  const res = await sendOwnerBroadcast({ recipients, subject, text, dryRun: false })
  console.log(`\nSent ${res.sent}/${res.planned}.`)
  if (res.failed.length) {
    console.log('Failures:')
    for (const f of res.failed) console.log(`  ${maskEmail(f.email)}: ${f.error}`)
    process.exit(1)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
