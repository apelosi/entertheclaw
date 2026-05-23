/**
 * Wipe all runtime user/agent data from the database pointed at by DATABASE_URL:
 * agents, characters, stage dialogue/runtime events, twists, user_profiles, stage_builds.
 *
 * Seeded stages (rows in `stages`) and each stage's origin story are kept:
 * - `stages.initial_scene_name` / `initial_scene_description` columns
 * - opening `scene_change` events (`reason: "Opening scene"`, no agent_id)
 * Missing openings are re-inserted from those columns after the wipe.
 *
 * Safety:
 * - Default: refuses if DATABASE_URL host matches `.env.local` (dev branch).
 * - Pass `--allow-dev` only when you intend to wipe the dev database.
 * - Pass `--yes` to apply; otherwise dry-run counts only.
 *
 * Production example (Neon main — same DB as entertheclaw.com):
 *   bun run db:wipe-runtime -- --database-url='postgresql://...' --yes
 */
import { count, sql } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { users, sessions, accounts, verifications } from './auth-schema'
import {
  deleteRuntimeStageEvents,
  openingSceneEventFilter,
  originStoriesReady,
  prepareOriginStories,
  printOriginAudit,
} from './ensure-opening-scene-events'
import { logDatabaseTarget, resolveDatabaseUrlFromArgv } from './resolve-database-url'

const {
  agents,
  archivedCharacters,
  characters,
  contactSubmissions,
  npcPersonas,
  stageBuilds,
  stageEvents,
  stageParticipants,
  twists,
  userProfiles,
} = schema

async function main() {
  const apply = process.argv.includes('--yes')
  const allowDev = process.argv.includes('--allow-dev')
  const includeAuthUsers = process.argv.includes('--include-auth-users')

  const { url: databaseUrl, host: targetHost } = resolveDatabaseUrlFromArgv()

  logDatabaseTarget(targetHost)

  const probe = neon(databaseUrl)
  try {
    await probe`SELECT 1 FROM stages LIMIT 1`
  } catch {
    throw new Error(
      'Refusing: this database has no stages table — wrong URL or migrations not applied. ' +
        'Use the connection string from Netlify production / Neon main.',
    )
  }

  const db = drizzle(neon(databaseUrl), { schema })

  const [
    agentsN,
    charactersN,
    archivedN,
    participantsN,
    twistsN,
    profilesN,
    buildsN,
    contactN,
    npcN,
    authUsersN,
  ] = await Promise.all([
    db.select({ n: count() }).from(agents),
    db.select({ n: count() }).from(characters),
    db.select({ n: count() }).from(archivedCharacters),
    db.select({ n: count() }).from(stageParticipants),
    db.select({ n: count() }).from(twists),
    db.select({ n: count() }).from(userProfiles),
    db.select({ n: count() }).from(stageBuilds),
    db.select({ n: count() }).from(contactSubmissions),
    db.select({ n: count() }).from(npcPersonas),
    includeAuthUsers ? db.select({ n: count() }).from(users) : Promise.resolve([{ n: 0 }]),
  ])

  console.log(`Target host: ${targetHost}${allowDev ? ' (--allow-dev)' : ''}`)
  console.log('Counts:')
  console.log(`  agents: ${agentsN[0]?.n ?? 0}`)
  console.log(`  characters: ${charactersN[0]?.n ?? 0}`)
  console.log(`  archived_characters: ${archivedN[0]?.n ?? 0}`)
  const [openingEventsN, runtimeEventsN] = await Promise.all([
    db
      .select({ n: count() })
      .from(stageEvents)
      .where(openingSceneEventFilter),
    db
      .select({ n: count() })
      .from(stageEvents)
      .where(sql`NOT ${openingSceneEventFilter}`),
  ])
  console.log(`  stage_events (runtime, excl. origin): ${runtimeEventsN[0]?.n ?? 0}`)
  console.log(`  stage_events (opening origin): ${openingEventsN[0]?.n ?? 0}`)
  console.log(`  stage_participants: ${participantsN[0]?.n ?? 0}`)
  console.log(`  twists: ${twistsN[0]?.n ?? 0}`)
  console.log(`  user_profiles: ${profilesN[0]?.n ?? 0}`)
  console.log(`  stage_builds: ${buildsN[0]?.n ?? 0}`)
  console.log(`  contact_submissions: ${contactN[0]?.n ?? 0}`)
  console.log(`  npc_personas: ${npcN[0]?.n ?? 0}`)
  if (includeAuthUsers) {
    console.log(`  auth users: ${authUsersN[0]?.n ?? 0}`)
  }

  const total =
    Number(agentsN[0]?.n ?? 0) +
    Number(runtimeEventsN[0]?.n ?? 0) +
    Number(profilesN[0]?.n ?? 0)

  if (total === 0) {
    console.log('\nNothing to delete.')
    return
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --yes to delete.')
    console.log('Before wiping production, run:')
    console.log('  DATABASE_URL=<main> bun run db:seed-scenes')
    console.log('  DATABASE_URL=<main> bun run db:ensure-origin-stories -- --apply')
    return
  }

  console.log('\nPreparing origin stories (migrate / insert / dedupe)…')
  const before = await prepareOriginStories(db)
  printOriginAudit(before.audit)
  if (!originStoriesReady(before.audit)) {
    console.error(
      '\nRefusing wipe: not every stage has exactly one origin story. Run db:seed-scenes then db:ensure-origin-stories -- --apply',
    )
    process.exit(1)
  }

  // Runtime events only — preserve opening scene_change (origin story) per stage.
  const deletedEvents = await deleteRuntimeStageEvents(db)
  const after = await prepareOriginStories(db)
  const deletedTwists = await db.delete(twists).returning({ id: twists.id })
  const deletedNpc = await db.delete(npcPersonas).returning({ id: npcPersonas.id })
  const deletedParticipants = await db
    .delete(stageParticipants)
    .returning({ id: stageParticipants.id })
  const deletedCharacters = await db.delete(characters).returning({ id: characters.id })
  const deletedArchived = await db
    .delete(archivedCharacters)
    .returning({ id: archivedCharacters.id })
  const deletedAgents = await db.delete(agents).returning({ id: agents.id })
  const deletedProfiles = await db.delete(userProfiles).returning({ userId: userProfiles.userId })
  const deletedBuilds = await db.delete(stageBuilds).returning({ id: stageBuilds.id })
  const deletedContact = await db
    .delete(contactSubmissions)
    .returning({ id: contactSubmissions.id })

  let deletedVerifications: { id: string }[] = []
  let deletedSessions: { id: string }[] = []
  let deletedAccounts: { id: string }[] = []
  let deletedUsers: { id: string }[] = []
  if (includeAuthUsers) {
    try {
      deletedVerifications = await db
        .delete(verifications)
        .returning({ id: verifications.id })
      deletedSessions = await db.delete(sessions).returning({ id: sessions.id })
      deletedAccounts = await db.delete(accounts).returning({ id: accounts.id })
      deletedUsers = await db.delete(users).returning({ id: users.id })
    } catch (err) {
      const code = (err as { code?: string })?.code
      if (code === '42P01') {
        console.log(
          '  auth tables: skipped (not in this database — Neon Auth is hosted separately)',
        )
      } else {
        throw err
      }
    }
  }

  const [leftAgents, leftRuntimeEvents, leftProfiles, leftUsers] = await Promise.all([
    db.select({ n: count() }).from(agents),
    db
      .select({ n: count() })
      .from(stageEvents)
      .where(sql`NOT ${openingSceneEventFilter}`),
    db.select({ n: count() }).from(userProfiles),
    includeAuthUsers ? db.select({ n: count() }).from(users) : Promise.resolve([{ n: 0 }]),
  ])

  console.log('\nDeleted:')
  console.log(`  stage_events (runtime): ${deletedEvents}`)
  console.log(
    `  origin stories after wipe: ${after.audit.withOpening}/${after.audit.stageCount} stages`,
  )
  console.log(`  twists: ${deletedTwists.length}`)
  console.log(`  npc_personas: ${deletedNpc.length}`)
  console.log(`  stage_participants: ${deletedParticipants.length}`)
  console.log(`  characters: ${deletedCharacters.length}`)
  console.log(`  archived_characters: ${deletedArchived.length}`)
  console.log(`  agents: ${deletedAgents.length}`)
  console.log(`  user_profiles: ${deletedProfiles.length}`)
  console.log(`  stage_builds: ${deletedBuilds.length}`)
  console.log(`  contact_submissions: ${deletedContact.length}`)
  if (includeAuthUsers) {
    console.log(`  verifications: ${deletedVerifications.length}`)
    console.log(`  sessions: ${deletedSessions.length}`)
    console.log(`  accounts: ${deletedAccounts.length}`)
    console.log(`  users: ${deletedUsers.length}`)
  }

  if (
    Number(leftAgents[0]?.n ?? 0) > 0 ||
    Number(leftRuntimeEvents[0]?.n ?? 0) > 0 ||
    Number(leftProfiles[0]?.n ?? 0) > 0 ||
    Number(leftUsers[0]?.n ?? 0) > 0
  ) {
    console.error(
      `\nWarning: leftover agents=${leftAgents[0]?.n} runtime_events=${leftRuntimeEvents[0]?.n} profiles=${leftProfiles[0]?.n} users=${leftUsers[0]?.n}`,
    )
    process.exit(1)
  }

  if (!originStoriesReady(after.audit)) {
    console.error('\nWarning: origin story check failed after wipe.')
    process.exit(1)
  }

  console.log('\nRuntime data wiped. Seeded stages and origin stories preserved (1 per stage).')
  if (!includeAuthUsers) {
    console.log(
      'Auth sign-in users kept. Pass --include-auth-users to delete users/sessions/accounts too.',
    )
  }
}

main().catch((err) => {
  console.error('Wipe failed:', err)
  process.exit(1)
})
