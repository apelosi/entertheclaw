/**
 * Remove agents with NULL name (orphaned enrollments) and their dependent rows.
 *
 * An "unnamed" agent is one where an API key was generated via the dashboard
 * (POST /api/v1/agents/keys) but no agent runtime ever called POST /api/v1/agents
 * to set the name. These are dead enrollments and safe to delete.
 *
 * Default mode is dry-run. Pass --yes to actually delete.
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { inArray, isNull, or } from 'drizzle-orm'
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

const {
  agents,
  archivedCharacters,
  characters,
  npcPersonas,
  stageEvents,
  stageParticipants,
} = schema

const db = drizzle(neon(process.env.DATABASE_URL!), { schema })

async function main() {
  const apply = process.argv.includes('--yes')

  const candidates = await db
    .select({
      id: agents.id,
      name: agents.name,
      userId: agents.userId,
      status: agents.status,
      apiKeyPrefix: agents.apiKeyPrefix,
      enrolledAt: agents.enrolledAt,
    })
    .from(agents)
    .where(isNull(agents.name))
    .orderBy(agents.enrolledAt)

  if (candidates.length === 0) {
    console.log('No unnamed agents found.')
    return
  }

  console.log(`Found ${candidates.length} unnamed agent(s):`)
  for (const a of candidates) {
    console.log(
      `  - ${a.id}  user=${a.userId}  status=${a.status}  prefix=${a.apiKeyPrefix}  enrolledAt=${a.enrolledAt?.toISOString() ?? '—'}`,
    )
  }

  if (!apply) {
    console.log('\nDry run. Pass --yes to delete.')
    return
  }

  const agentIds = candidates.map((a) => a.id)

  const characterRows = await db
    .select({ id: characters.id })
    .from(characters)
    .where(inArray(characters.agentId, agentIds))
  const characterIds = characterRows.map((c) => c.id)

  const eventWhere = characterIds.length
    ? or(inArray(stageEvents.agentId, agentIds), inArray(stageEvents.characterId, characterIds))
    : inArray(stageEvents.agentId, agentIds)

  const deletedEvents = await db
    .delete(stageEvents)
    .where(eventWhere)
    .returning({ id: stageEvents.id })
  const deletedNpc = await db
    .delete(npcPersonas)
    .where(inArray(npcPersonas.agentId, agentIds))
    .returning({ id: npcPersonas.id })
  const deletedParticipants = await db
    .delete(stageParticipants)
    .where(inArray(stageParticipants.agentId, agentIds))
    .returning({ id: stageParticipants.id })
  const deletedCharacters = await db
    .delete(characters)
    .where(inArray(characters.agentId, agentIds))
    .returning({ id: characters.id })
  const deletedArchived = await db
    .delete(archivedCharacters)
    .where(inArray(archivedCharacters.agentId, agentIds))
    .returning({ id: archivedCharacters.id })
  const deletedAgents = await db
    .delete(agents)
    .where(inArray(agents.id, agentIds))
    .returning({ id: agents.id })

  console.log('\nDeleted:')
  console.log(`  stage_events: ${deletedEvents.length}`)
  console.log(`  npc_personas: ${deletedNpc.length}`)
  console.log(`  stage_participants: ${deletedParticipants.length}`)
  console.log(`  characters: ${deletedCharacters.length}`)
  console.log(`  archived_characters: ${deletedArchived.length}`)
  console.log(`  agents: ${deletedAgents.length}`)
}

main().catch((err) => {
  console.error('Cleanup failed:', err)
  process.exit(1)
})
