/**
 * Remove ALL agents, characters, and dependent rows (participants, archived, agent-linked events).
 * Stages and user-authored twists/events without agent/character refs are kept.
 *
 * Default mode is dry-run. Pass --yes to actually delete.
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { inArray, or } from 'drizzle-orm'
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

  const allAgents = await db
    .select({
      id: agents.id,
      name: agents.name,
      userId: agents.userId,
      status: agents.status,
      enrolledAt: agents.enrolledAt,
    })
    .from(agents)
    .orderBy(agents.enrolledAt)

  const allCharacters = await db
    .select({ id: characters.id, agentId: characters.agentId, name: characters.name })
    .from(characters)

  const allArchived = await db
    .select({ id: archivedCharacters.id })
    .from(archivedCharacters)

  console.log(
    `Found ${allAgents.length} agent(s), ${allCharacters.length} active character(s), ${allArchived.length} archived character(s).`,
  )
  for (const a of allAgents) {
    console.log(
      `  agent ${a.id}  name=${a.name ?? '(unset)'}  user=${a.userId}  status=${a.status}`,
    )
  }

  if (allAgents.length === 0 && allCharacters.length === 0 && allArchived.length === 0) {
    console.log('Nothing to delete.')
    return
  }

  if (!apply) {
    console.log('\nDry run. Pass --yes to delete.')
    return
  }

  const agentIds = allAgents.map((a) => a.id)
  const characterIds = allCharacters.map((c) => c.id)

  const eventWhere =
    characterIds.length > 0 && agentIds.length > 0
      ? or(
          inArray(stageEvents.agentId, agentIds),
          inArray(stageEvents.characterId, characterIds),
        )
      : characterIds.length > 0
        ? inArray(stageEvents.characterId, characterIds)
        : agentIds.length > 0
          ? inArray(stageEvents.agentId, agentIds)
          : undefined

  const deletedEvents = eventWhere
    ? await db.delete(stageEvents).where(eventWhere).returning({ id: stageEvents.id })
    : []

  const deletedNpc = agentIds.length
    ? await db
        .delete(npcPersonas)
        .where(inArray(npcPersonas.agentId, agentIds))
        .returning({ id: npcPersonas.id })
    : []

  const deletedParticipants = agentIds.length
    ? await db
        .delete(stageParticipants)
        .where(inArray(stageParticipants.agentId, agentIds))
        .returning({ id: stageParticipants.id })
    : []

  const deletedCharacters = await db
    .delete(characters)
    .returning({ id: characters.id })

  const deletedArchived = await db
    .delete(archivedCharacters)
    .returning({ id: archivedCharacters.id })

  const deletedAgents = await db.delete(agents).returning({ id: agents.id })

  const leftoverCharacters = await db.select({ id: characters.id }).from(characters)
  const leftoverAgents = await db.select({ id: agents.id }).from(agents)

  console.log('\nDeleted:')
  console.log(`  stage_events: ${deletedEvents.length}`)
  console.log(`  npc_personas: ${deletedNpc.length}`)
  console.log(`  stage_participants: ${deletedParticipants.length}`)
  console.log(`  characters: ${deletedCharacters.length}`)
  console.log(`  archived_characters: ${deletedArchived.length}`)
  console.log(`  agents: ${deletedAgents.length}`)

  if (leftoverCharacters.length > 0 || leftoverAgents.length > 0) {
    console.error(
      `Warning: ${leftoverAgents.length} agent(s) and ${leftoverCharacters.length} character(s) remain.`,
    )
    process.exit(1)
  }

  console.log('\nAll agents and characters removed.')
}

main().catch((err) => {
  console.error('Cleanup failed:', err)
  process.exit(1)
})
