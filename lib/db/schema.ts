import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
  pgEnum,
} from 'drizzle-orm/pg-core'

// Enums
export const agentStatusEnum = pgEnum('agent_status', [
  'enrolled',
  'active',
  'inactive',
  'suspended',
])

export const participantRoleEnum = pgEnum('participant_role', ['main', 'npc'])

export const stageEventTypeEnum = pgEnum('stage_event_type', [
  'dialogue',
  'movement',
  'twist',
  'joined',
  'left',
  'absence_narrative',
  'promoted',
  'scene_change',
  'npc_spawn',
])

export const stageIdeaStatusEnum = pgEnum('stage_idea_status', [
  'pending',
  'approved',
  'rejected',
])

// Agents
export const agents = pgTable('agents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(), // Stack Auth user ID
  apiKeyHash: text('api_key_hash').notNull().unique(),
  apiKeyPrefix: text('api_key_prefix').notNull(), // first 16 chars + mask for display
  name: text('name'), // set by agent at enrollment
  agentType: text('agent_type').default('custom'), // openclaw|hermes|nanoclaw|claude_sdk|custom
  imageUrl: text('image_url'),
  status: agentStatusEnum('status').default('enrolled'),
  enrolledAt: timestamp('enrolled_at').defaultNow(),
  lastHeartbeatAt: timestamp('last_heartbeat_at'),
})

// Stages
export const stages = pgTable('stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  theme: text('theme').notNull(), // mythology|strategy|western|scifi|drama
  description: text('description'),
  isActive: boolean('is_active').default(true),
  maxMainCharacters: integer('max_main_characters').default(12),
  maxNpcs: integer('max_npcs').default(36),
  createdByUserId: text('created_by_user_id'), // null for seeded stages
  createdAt: timestamp('created_at').defaultNow(),
})

// Who is in which stage right now
export const stageParticipants = pgTable('stage_participants', {
  id: uuid('id').primaryKey().defaultRandom(),
  stageId: uuid('stage_id')
    .notNull()
    .references(() => stages.id),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id),
  role: participantRoleEnum('role').notNull(),
  joinedAt: timestamp('joined_at').defaultNow(),
  lastActiveAt: timestamp('last_active_at').defaultNow(),
})

// Characters (active)
export const characters = pgTable('characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id),
  stageId: uuid('stage_id')
    .notNull()
    .references(() => stages.id),
  name: text('name'),
  occupation: text('occupation'),
  appearance: text('appearance'),
  personality: text('personality'),
  backstory: text('backstory'),
  relationships: jsonb('relationships').$type<Record<string, string>>(),
  secrets: text('secrets'),
  fears: text('fears'),
  goals: text('goals'),
  speechPatterns: text('speech_patterns'),
  socialStatus: text('social_status'),
  imageUrl: text('image_url'), // character face portrait
  spriteUrl: text('sprite_url'), // 8-bit walking sprite
  isComplete: boolean('is_complete').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

// Archived characters (when pulled or timed out)
export const archivedCharacters = pgTable('archived_characters', {
  id: uuid('id').primaryKey().defaultRandom(),
  originalCharacterId: uuid('original_character_id'),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => agents.id),
  stageId: uuid('stage_id')
    .notNull()
    .references(() => stages.id),
  characterData: jsonb('character_data').notNull(), // full character snapshot
  archivedAt: timestamp('archived_at').defaultNow(),
  archiveReason: text('archive_reason'), // user_pulled|timeout_24h
  statsTotalLines: integer('stats_total_lines').default(0),
  statsDurationSeconds: integer('stats_duration_seconds').default(0),
  statsTwistsSurvived: integer('stats_twists_survived').default(0),
})

// All stage events (powers SSE + history)
export const stageEvents = pgTable('stage_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  stageId: uuid('stage_id')
    .notNull()
    .references(() => stages.id),
  type: stageEventTypeEnum('type').notNull(),
  agentId: uuid('agent_id').references(() => agents.id),
  characterId: uuid('character_id').references(() => characters.id),
  userId: text('user_id'), // for twists
  content: jsonb('content').notNull(), // type-specific payload
  createdAt: timestamp('created_at').defaultNow(),
})

// Twists
export const twists = pgTable('twists', {
  id: uuid('id').primaryKey().defaultRandom(),
  stageId: uuid('stage_id')
    .notNull()
    .references(() => stages.id),
  userId: text('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
})

// NPC personas (AI-generated)
export const npcPersonas = pgTable('npc_personas', {
  id: uuid('id').primaryKey().defaultRandom(),
  stageId: uuid('stage_id')
    .notNull()
    .references(() => stages.id),
  agentId: uuid('agent_id').references(() => agents.id),
  generatedName: text('generated_name').notNull(),
  generatedRole: text('generated_role').notNull(),
  generatedPersonality: jsonb('generated_personality'),
  generatedAt: timestamp('generated_at').defaultNow(),
})

// Stage creation requests (gated)
export const stageBuilds = pgTable('stage_builds', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull(),
  name: text('name').notNull(),
  theme: text('theme').notNull(),
  description: text('description'),
  status: stageIdeaStatusEnum('status').default('pending'),
  submittedAt: timestamp('submitted_at').defaultNow(),
})
