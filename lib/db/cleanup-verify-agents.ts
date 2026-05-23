/**
 * Remove agents/stages left by scripts/verify-turn-open-snapshot.ts.
 * Matches: user_id like verify-turn-open-%, or name ILIKE VerifyAgent%.
 */
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { eq, inArray, like, or, sql } from 'drizzle-orm'
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
  stages,
} = schema

const db = drizzle(neon(process.env.DATABASE_URL!), { schema })

const verifyAgentFilter = or(
  like(agents.userId, 'verify-turn-open-%'),
  sql`lower(${agents.name}) like 'verifyagent%'`,
)

async function main() {
  const verifyAgents = await db
    .select({ id: agents.id, name: agents.name, userId: agents.userId })
    .from(agents)
    .where(verifyAgentFilter)

  const verifyStages = await db
    .select({ id: stages.id, name: stages.name })
    .from(stages)
    .where(like(stages.createdByUserId, 'verify-turn-open-%'))

  if (verifyAgents.length === 0 && verifyStages.length === 0) {
    console.log('No verify-script agents or stages found.')
    return
  }

  const agentIds = verifyAgents.map((a) => a.id)
  if (verifyAgents.length > 0) {
    console.log(`Found ${verifyAgents.length} verify-script agent(s):`)
    for (const a of verifyAgents) {
      console.log(`  - ${a.id}  name=${a.name ?? '(unset)'}  user=${a.userId}`)
    }
  }

  const stageIds = verifyStages.map((s) => s.id)
  if (verifyStages.length > 0) {
    console.log(`Found ${verifyStages.length} verify-script stage(s):`)
    for (const s of verifyStages) {
      console.log(`  - ${s.id}  name=${s.name}`)
    }
  }

  const characterRows =
    agentIds.length > 0
      ? await db
          .select({ id: characters.id })
          .from(characters)
          .where(inArray(characters.agentId, agentIds))
      : []
  const characterIds = characterRows.map((c) => c.id)

  if (stageIds.length > 0) {
    const deletedStageEvents = await db
      .delete(stageEvents)
      .where(inArray(stageEvents.stageId, stageIds))
      .returning({ id: stageEvents.id })
    const deletedStageParticipants = await db
      .delete(stageParticipants)
      .where(inArray(stageParticipants.stageId, stageIds))
      .returning({ id: stageParticipants.id })
    const deletedStageCharacters = await db
      .delete(characters)
      .where(inArray(characters.stageId, stageIds))
      .returning({ id: characters.id })
    const deletedStages = await db
      .delete(stages)
      .where(inArray(stages.id, stageIds))
      .returning({ id: stages.id })
    console.log('\nDeleted verify stages:')
    console.log(`  stage_events: ${deletedStageEvents.length}`)
    console.log(`  stage_participants: ${deletedStageParticipants.length}`)
    console.log(`  characters (by stage): ${deletedStageCharacters.length}`)
    console.log(`  stages: ${deletedStages.length}`)
  }

  if (agentIds.length > 0) {
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

    console.log('\nDeleted verify agents:')
    console.log(`  stage_events: ${deletedEvents.length}`)
    console.log(`  npc_personas: ${deletedNpc.length}`)
    console.log(`  stage_participants: ${deletedParticipants.length}`)
    console.log(`  characters: ${deletedCharacters.length}`)
    console.log(`  archived_characters: ${deletedArchived.length}`)
    console.log(`  agents: ${deletedAgents.length}`)
  }
}

main().catch((err) => {
  console.error('Cleanup failed:', err)
  process.exit(1)
})
