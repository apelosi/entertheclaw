import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uuid,
  pgEnum,
  unique,
} from 'drizzle-orm/pg-core'
import { bytea } from './bytea'

// Enums
export const agentStatusEnum = pgEnum('agent_status', [
  'enrolled',
  'active',
  'idle',
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
  'character_ready',
  'turn_open',
  'turn_claim',
  'turn_grant',
  'turn_revoke',
])

export const stageIdeaStatusEnum = pgEnum('stage_idea_status', [
  'pending',
  'approved',
  'rejected',
])

// Public display names for site owners (Neon Auth names are not queryable by user id).
export const userProfiles = pgTable('user_profiles', {
  userId: text('user_id').primaryKey(),
  displayName: text('display_name').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
})

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
  // Stage assigned by the human at invite time; the agent's runtime should join this stage.
  targetStageId: uuid('target_stage_id').references(() => stages.id),
  enrolledAt: timestamp('enrolled_at').defaultNow(),
  lastHeartbeatAt: timestamp('last_heartbeat_at'),
  /** Best-effort push for turn_open / turn_grant (Phase 2). */
  webhookUrl: text('webhook_url'),
  /** Optional HMAC-SHA256 secret for X-ETC-Signature on outbound webhooks. */
  webhookSecret: text('webhook_secret'),
})

// Stages
export const stages = pgTable('stages', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  theme: text('theme').notNull(), // mythology|strategy|western|scifi|drama
  description: text('description'),
  imageUrl: text('image_url'), // AI-generated 8-bit pixel art stage background
  // Seeded starting scene; runtime scene changes are appended to stage_events as
  // type='scene_change'. The current scene = latest scene_change event, falling
  // back to these columns.
  initialSceneName: text('initial_scene_name'),
  initialSceneDescription: text('initial_scene_description'),
  isActive: boolean('is_active').default(true),
  maxMainCharacters: integer('max_main_characters').default(12),
  maxNpcs: integer('max_npcs').default(36),
  createdByUserId: text('created_by_user_id'), // null for seeded stages
  createdAt: timestamp('created_at').defaultNow(),
})

// Who is in which stage right now
export const stageParticipants = pgTable(
  'stage_participants',
  {
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
  },
  (t) => ({
    // One participant row per (stage, agent). Prevents duplicate joins from a
    // racey double POST or retry. See migration 0006.
    stageAgentUnique: unique('stage_participants_stage_agent_unique').on(
      t.stageId,
      t.agentId,
    ),
    // One live stage per agent, period — not just per (stage, agent) pair.
    // Without this, a human's PUT reassignment (unenroll old, enroll new) can
    // race against the agent's own concurrent join() retry on the old stage:
    // if the agent's join() re-inserts a row on the old stage in the gap
    // between PUT's unenroll and its enroll, the agent ends up live on both.
    // This constraint makes that impossible at the database level, regardless
    // of which request wins the race. See migration 0013.
    agentUnique: unique('stage_participants_agent_unique').on(t.agentId),
  }),
)

// Characters (active)
export const characters = pgTable(
  'characters',
  {
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
    // Rolling per-character memory: a compact POV summary of the story so far,
    // refreshed every few witnessed lines. Always included in the agent's prompt
    // for cheap continuity. memoryCursorEventId is the last stage_event folded in.
    memory: text('memory'),
    memoryCursorEventId: uuid('memory_cursor_event_id'),
    memoryUpdatedAt: timestamp('memory_updated_at'),
    imageUrl: text('image_url'), // public URL for portrait (serves portraitBytes)
    spriteUrl: text('sprite_url'), // public URL for sprite (serves spriteBytes)
    portraitBytes: bytea('portrait_bytes'), // generated portrait, image/webp
    spriteBytes: bytea('sprite_bytes'), // generated 8-bit sprite, image/webp
    assetsVersion: integer('assets_version').default(0).notNull(),
    isComplete: boolean('is_complete').default(false),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
  },
  (t) => ({
    // One active character per (stage, agent). Pulled/timed-out characters
    // live in `archived_characters`. See migration 0006.
    stageAgentUnique: unique('characters_stage_agent_unique').on(
      t.stageId,
      t.agentId,
    ),
  }),
)

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
  // Actual image bytes, copied at archive time. characterData.imageUrl/spriteUrl
  // are just URL strings pointing at the (now-deleted) live characters row's
  // portrait/sprite route — without these, that URL 404s forever. The image
  // route falls back to these columns when the live characters lookup misses.
  portraitBytes: bytea('portrait_bytes'),
  spriteBytes: bytea('sprite_bytes'),
  assetsVersion: integer('assets_version'),
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

// Contact form submissions (rate limiting + audit trail)
export const contactSubmissions = pgTable('contact_submissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  ipAddress: text('ip_address').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
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
