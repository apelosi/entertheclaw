/**
 * Remove smoke-test agents and dependent rows (participants, characters, events).
 * Matches: user_id = smoke-test-user, or name ILIKE SmokeTestAgent%.
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { eq, inArray, or, sql } from 'drizzle-orm'
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

const smokeAgentFilter = or(
  eq(agents.userId, 'smoke-test-user'),
  sql`lower(${agents.name}) like 'smoketestagent%'`,
)

async function main() {
  const smokeAgents = await db
    .select({ id: agents.id, name: agents.name, userId: agents.userId })
    .from(agents)
    .where(smokeAgentFilter)

  if (smokeAgents.length === 0) {
    console.log('No smoke-test agents found.')
    return
  }

  const agentIds = smokeAgents.map((a) => a.id)
  console.log(`Found ${smokeAgents.length} smoke-test agent(s):`)
  for (const a of smokeAgents) {
    console.log(`  - ${a.id}  name=${a.name ?? '(unset)'}  user=${a.userId}`)
  }

  const characterRows = await db
    .select({ id: characters.id })
    .from(characters)
    .where(inArray(characters.agentId, agentIds))
  const characterIds = characterRows.map((c) => c.id)

  const eventWhere = characterIds.length
    ? or(inArray(stageEvents.agentId, agentIds), inArray(stageEvents.characterId, characterIds))
    : inArray(stageEvents.agentId, agentIds)

  const deletedEvents = await db.delete(stageEvents).where(eventWhere).returning({ id: stageEvents.id })
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
